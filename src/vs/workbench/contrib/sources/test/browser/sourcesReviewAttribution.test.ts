/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import type { SessionViewSnapshot, TimelineItemSummary } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import type { IConversationSessionViewLease } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { SourcesReviewAttributionService } from '../../browser/sourcesReviewAttributionService.js';
import {
	buildAttributionChips,
	computeTurnNumber,
	CONVERSATION_REVEAL_ITEM_COMMAND,
	filterRecordsForResource,
	IFileMutationRecord,
	IReviewItemAttribution,
	isWorkDirCompatible,
	resolveRevealItemId,
} from '../../common/sourcesReviewAttribution.js';

suite('Sources - review attribution', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const textSummary: TimelineItemSummary = { kind: 'text', title: 'You', preview: 'hello' };

	function workspaceRootFor(testContext: Mocha.Context): URI {
		return toResource.call(testContext, '/project');
	}

	function makeSnapshot(timeline: SessionViewSnapshot['timeline']): SessionViewSnapshot {
		return {
			...emptySessionViewSnapshot('session-1' as SessionViewSnapshot['sessionId']),
			sync: { kind: 'live' },
			timeline,
		};
	}

	function makeAttribution(entries: readonly [string, IReviewItemAttribution][]): ReadonlyMap<string, IReviewItemAttribution> {
		return new Map(entries);
	}

	function makeRecord(overrides: Partial<IFileMutationRecord> & Pick<IFileMutationRecord, 'path' | 'toolCallId' | 'turnId'>): IFileMutationRecord {
		return {
			sessionId: 'session-1',
			agentId: 'coder',
			operation: 'modify',
			...overrides,
		};
	}

	function createService(testContext: Mocha.Context, options: {
		records?: IFileMutationRecord[];
		activeSessionId?: string;
		workDir?: string;
		connected?: boolean;
		snapshot?: SessionViewSnapshot;
		attribution?: ReadonlyMap<string, IReviewItemAttribution>;
	} = {}): SourcesReviewAttributionService {
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
		const connectionChangeEmitter = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const activeSessionId = options.activeSessionId ?? 'session-1';
		const workspaceRoot = workspaceRootFor(testContext);
		const workDirValue = options.workDir ?? workspaceRoot.fsPath;
		const connected = options.connected ?? true;

		const connection = {
			isEngineConnected: () => connected,
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				workDir: workDirValue,
				pairingPending: false,
				channelAlive: connected,
				capabilities: {} as never,
			}),
			onDidFileMutation: mutationEmitter.event,
			onDidChangeConnection: connectionChangeEmitter.event,
		} as unknown as IUniverseAgentConnection;

		const snapshot = options.snapshot ?? makeSnapshot([]);
		const attribution = options.attribution ?? makeAttribution([]);
		const lease: IConversationSessionViewLease = {
			sessionId: activeSessionId,
			snapshot,
			attribution,
			details: new Map(),
			onDidApplyFrame: Event.None,
			post: () => ({ accepted: false, reason: 'no_such_session' }),
			requestResync: () => undefined,
			dispose: () => undefined,
		};

		const roster = {
			getActiveSessionId: () => activeSessionId,
			onDidChangeActiveSession: Event.None,
			acquireSessionView: () => lease,
		} as unknown as IConversationRosterService;

		const workspace = {
			getWorkspace: () => ({ folders: [{ uri: workspaceRoot, name: 'project', index: 0, toResource: () => workspaceRoot }] }),
		} as unknown as IWorkspaceContextService;

		const service = store.add(new SourcesReviewAttributionService(connection, roster, workspace));

		for (const record of options.records ?? []) {
			mutationEmitter.fire(record);
		}

		return service;
	}

	test('Turn n counts user items with orderKey <= tool item', () => {
		const snapshot = makeSnapshot([
			{ id: 'u1' as never, orderKey: '0000000000000001', summary: textSummary },
			{ id: 'a1' as never, orderKey: '0000000000000002', summary: textSummary },
			{ id: 'u2' as never, orderKey: '0000000000000003', summary: textSummary },
			{ id: 'tool-1' as never, orderKey: '0000000000000004', summary: textSummary },
		]);
		const attribution = makeAttribution([
			['u1', { role: 'user' }],
			['a1', { role: 'assistant' }],
			['u2', { role: 'user' }],
			['tool-1', { role: 'tool', toolCallId: 'tc-1', agentPath: ['team', 'coder'] }],
		]);

		assert.strictEqual(computeTurnNumber(snapshot, attribution, 'tc-1'), 2);
	});

	test('toolCallId lookup miss shows agent only', () => {
		const snapshot = makeSnapshot([
			{ id: 'tool-1' as never, orderKey: '0000000000000001', summary: textSummary },
		]);
		const attribution = makeAttribution([
			['tool-1', { role: 'tool', agentPath: ['team', 'coder'] }],
		]);
		const chips = buildAttributionChips([
			makeRecord({ path: 'src/a.ts', toolCallId: 'missing', turnId: 'turn-1' }),
		], snapshot, attribution);

		assert.strictEqual(chips.length, 1);
		assert.strictEqual(chips[0]?.label, 'coder');
	});

	test('dedupes by turnId and renders +n overflow', () => {
		const snapshot = makeSnapshot([]);
		const attribution = makeAttribution([]);
		const chips = buildAttributionChips([
			makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1', agentId: 'a' }),
			makeRecord({ path: 'src/a.ts', toolCallId: 'tc-2', turnId: 'turn-1', agentId: 'a' }),
			makeRecord({ path: 'src/a.ts', toolCallId: 'tc-3', turnId: 'turn-2', agentId: 'b' }),
			makeRecord({ path: 'src/a.ts', toolCallId: 'tc-4', turnId: 'turn-3', agentId: 'c' }),
		], snapshot, attribution);

		assert.strictEqual(chips.length, 3);
		assert.strictEqual(chips[0]?.label, 'a');
		assert.strictEqual(chips[1]?.label, 'b');
		assert.strictEqual(chips[2]?.overflow, true);
		assert.match(chips[2]?.label ?? '', /\+1/);
	});

	test('work_dir mismatch yields zero chips', function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const workspaceRoot = workspaceRootFor(this);
		const service = createService(this, {
			workDir: '/other-workspace',
			records: [makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' })],
		});

		assert.strictEqual(isWorkDirCompatible('/other-workspace', [workspaceRoot]), false);
		const chipMap = service.buildChipMapForEntries([{ resource }]);
		assert.strictEqual(chipMap.size, 0);
		assert.ok(service.getWorkDirMismatchNote());
	});

	test('disconnect retains sidecar chips for active session', function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const workspaceRoot = workspaceRootFor(this);
		const workDir = workspaceRoot.fsPath;
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
		const connectionChangeEmitter = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());

		let connected = true;
		const connection = {
			isEngineConnected: () => connected,
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				workDir,
				pairingPending: false,
				channelAlive: connected,
				capabilities: {} as never,
			}),
			onDidFileMutation: mutationEmitter.event,
			onDidChangeConnection: connectionChangeEmitter.event,
		} as unknown as IUniverseAgentConnection;

		const lease: IConversationSessionViewLease = {
			sessionId: 'session-1',
			snapshot: makeSnapshot([]),
			attribution: makeAttribution([]),
			details: new Map(),
			onDidApplyFrame: Event.None,
			post: () => ({ accepted: false, reason: 'no_such_session' }),
			requestResync: () => undefined,
			dispose: () => undefined,
		};

		const roster = {
			getActiveSessionId: () => 'session-1',
			onDidChangeActiveSession: Event.None,
			acquireSessionView: () => lease,
		} as unknown as IConversationRosterService;

		const workspace = {
			getWorkspace: () => ({ folders: [{ uri: workspaceRoot, name: 'project', index: 0, toResource: () => workspaceRoot }] }),
		} as unknown as IWorkspaceContextService;

		const service = store.add(new SourcesReviewAttributionService(connection, roster, workspace));
		mutationEmitter.fire(makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' }));

		connected = false;
		connectionChangeEmitter.fire(connection.getConnectionSnapshot());

		const chipMap = service.buildChipMapForEntries([{ resource }]);
		assert.strictEqual(chipMap.get(resource.toString())?.length, 1);
	});

	test('never connected yields zero chips', function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const service = createService(this, { connected: false, records: [] });
		const chipMap = service.buildChipMapForEntries([{ resource }]);
		assert.strictEqual(chipMap.size, 0);
		assert.strictEqual(service.isAttributionEnabled(), false);
	});

	test('resolveRevealItemId returns item id or undefined silently', () => {
		const attribution = makeAttribution([
			['item-1', { role: 'tool', toolCallId: 'tc-1' }],
		]);
		assert.strictEqual(resolveRevealItemId(attribution, 'tc-1'), 'item-1');
		assert.strictEqual(resolveRevealItemId(attribution, 'missing'), undefined);
	});

	test('filterRecordsForResource matches joined work_dir paths', function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		const workspaceRoot = workspaceRootFor(this);
		const workDir = workspaceRoot.fsPath;
		const records = [
			makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' }),
			makeRecord({ path: 'src/b.ts', toolCallId: 'tc-2', turnId: 'turn-2' }),
		];
		const matched = filterRecordsForResource(records, resource, workDir, [workspaceRoot]);
		assert.strictEqual(matched.length, 1);
		assert.strictEqual(matched[0]?.toolCallId, 'tc-1');
	});

	test('reveal command id is stable for chip click integration', () => {
		assert.strictEqual(CONVERSATION_REVEAL_ITEM_COMMAND, 'conversation.revealItem');
	});
});
