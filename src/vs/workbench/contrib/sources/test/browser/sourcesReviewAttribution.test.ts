/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getErrorMessage } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { type SessionViewSnapshot, type TimelineItemSummary, emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isConversationPairingHold } from '../../../conversation/browser/conversationSessionStatus.js';
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

	function stubNotification(errors: string[] = []): INotificationService {
		return {
			error: (error: string | Error) => {
				errors.push(typeof error === 'string' ? error : getErrorMessage(error));
			},
		} as INotificationService;
	}

	function createService(testContext: Mocha.Context, options: {
		records?: IFileMutationRecord[];
		activeSessionId?: string;
		workDir?: string;
		connected?: boolean;
		pairingPending?: boolean;
		looksLive?: boolean;
		snapshot?: SessionViewSnapshot;
		attribution?: ReadonlyMap<string, IReviewItemAttribution>;
		acquireSessionView?: () => IConversationSessionViewLease;
		notificationErrors?: string[];
	} = {}): SourcesReviewAttributionService {
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
		const connectionChangeEmitter = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const activeSessionId = options.activeSessionId ?? 'session-1';
		const workspaceRoot = workspaceRootFor(testContext);
		const workDirValue = options.workDir ?? workspaceRoot.fsPath;
		const connected = options.connected ?? true;
		const pairingPending = options.pairingPending ?? false;
		const looksLive = options.looksLive ?? false;

		const connection = {
			isEngineConnected: () => looksLive ? connected : (connected && !pairingPending),
			getConnectionPhase: () => ({ kind: (connected || pairingPending) ? 'connected' as const : 'disconnected' as const, path: 'direct' as const }),
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				workDir: workDirValue,
				pairingPending,
				channelAlive: connected,
				capabilities: {} as never,
			}),
			onDidFileMutation: mutationEmitter.event,
			onDidTurnSettle: Event.None,
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
			post: async () => ({ accepted: false, reason: 'no_such_session' }),
			requestResync: () => undefined,
			dispose: () => undefined,
		};

		const roster = {
			getActiveSessionId: () => activeSessionId,
			onDidChangeActiveSession: Event.None,
			acquireSessionView: options.acquireSessionView ?? (() => lease),
		} as unknown as IConversationRosterService;

		const workspace = {
			getWorkspace: () => ({ folders: [{ uri: workspaceRoot, name: 'project', index: 0, toResource: () => workspaceRoot }] }),
		} as unknown as IWorkspaceContextService;

		const service = store.add(new SourcesReviewAttributionService(connection, roster, workspace, stubNotification(options.notificationErrors)));

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
			onDidTurnSettle: Event.None,
			onDidChangeConnection: connectionChangeEmitter.event,
		} as unknown as IUniverseAgentConnection;

		const lease: IConversationSessionViewLease = {
			sessionId: 'session-1',
			snapshot: makeSnapshot([]),
			attribution: makeAttribution([]),
			details: new Map(),
			onDidApplyFrame: Event.None,
			post: async () => ({ accepted: false, reason: 'no_such_session' }),
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

		const service = store.add(new SourcesReviewAttributionService(connection, roster, workspace, stubNotification()));
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

	test('leftover-looks-live first-pull pairing without leftover does not enable connected-engine attribution', function () {
		const workspaceRoot = workspaceRootFor(this);
		const workDir = '/other-workspace';
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
		const connectionChangeEmitter = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const pairingPending = true;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const, path: 'direct' as const }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				workDir,
				pairingPending,
				channelAlive: true,
				capabilities: {} as never,
			}),
			onDidFileMutation: mutationEmitter.event,
			onDidTurnSettle: Event.None,
			onDidChangeConnection: connectionChangeEmitter.event,
		} as unknown as IUniverseAgentConnection;

		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const lease: IConversationSessionViewLease = {
			sessionId: 'session-1',
			snapshot: makeSnapshot([]),
			attribution: makeAttribution([]),
			details: new Map(),
			onDidApplyFrame: Event.None,
			post: async () => ({ accepted: false, reason: 'no_such_session' }),
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

		const service = store.add(new SourcesReviewAttributionService(connection, roster, workspace, stubNotification()));
		assert.strictEqual(service.isAttributionEnabled(), false);
		assert.strictEqual(service.getAttributionHeaderSuffix(), undefined);
		assert.strictEqual(service.getWorkDirMismatchNote(), undefined);

		connectionChangeEmitter.fire({
			...connection.getConnectionSnapshot(),
			sessionToken: 'tok',
		});
		mutationEmitter.fire(makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' }));

		const resource = toResource.call(this, '/project/src/a.ts');
		assert.strictEqual(service.buildChipMapForEntries([{ resource }]).size, 0);
		assert.strictEqual(service.isAttributionEnabled(), false, 'first-pull leftover-looks-live must not invent everConnected from sessionToken or mutation');
		assert.strictEqual(service.getAttributionHeaderSuffix(), undefined);
		assert.ok(!(service.getAttributionHeaderSuffix() ?? '').includes('connected engine'));
		assert.strictEqual(service.getWorkDirMismatchNote(), undefined, 'first-pull leftover-looks-live must not invent mismatch from sessionToken');
	});

	test('leftover-looks-live first-pull compatible workDir plus sessionToken and mutation stays 0 chips', function () {
		const workspaceRoot = workspaceRootFor(this);
		const workDir = workspaceRoot.fsPath;
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
		const connectionChangeEmitter = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const pairingPending = true;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const, path: 'direct' as const }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				workDir,
				pairingPending,
				channelAlive: true,
				capabilities: {} as never,
			}),
			onDidFileMutation: mutationEmitter.event,
			onDidTurnSettle: Event.None,
			onDidChangeConnection: connectionChangeEmitter.event,
		} as unknown as IUniverseAgentConnection;

		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);

		const lease: IConversationSessionViewLease = {
			sessionId: 'session-1',
			snapshot: makeSnapshot([]),
			attribution: makeAttribution([]),
			details: new Map(),
			onDidApplyFrame: Event.None,
			post: async () => ({ accepted: false, reason: 'no_such_session' }),
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

		const service = store.add(new SourcesReviewAttributionService(connection, roster, workspace, stubNotification()));
		connectionChangeEmitter.fire({
			...connection.getConnectionSnapshot(),
			sessionToken: 'tok',
		});
		mutationEmitter.fire(makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' }));

		const resource = toResource.call(this, '/project/src/a.ts');
		assert.strictEqual(service.buildChipMapForEntries([{ resource }]).size, 0, 'first-pull leftover-looks-live must not ingest live mutation chips');
		assert.strictEqual(service.isAttributionEnabled(), false);
		assert.strictEqual(service.getAttributionHeaderSuffix(), undefined);
		assert.ok(!(service.getAttributionHeaderSuffix() ?? '').includes('connected engine'));
		assert.strictEqual(service.getWorkDirMismatchNote(), undefined);
	});

	test('leftover records plus prior everConnected KEEP chips while pairing-hold without connected-engine suffix', function () {
		const workspaceRoot = workspaceRootFor(this);
		const workDir = workspaceRoot.fsPath;
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
		const connectionChangeEmitter = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		let pairingPending = false;
		const connection = {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected' as const, path: 'direct' as const }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				workDir,
				pairingPending,
				channelAlive: true,
				capabilities: {} as never,
			}),
			onDidFileMutation: mutationEmitter.event,
			onDidTurnSettle: Event.None,
			onDidChangeConnection: connectionChangeEmitter.event,
		} as unknown as IUniverseAgentConnection;

		const lease: IConversationSessionViewLease = {
			sessionId: 'session-1',
			snapshot: makeSnapshot([]),
			attribution: makeAttribution([]),
			details: new Map(),
			onDidApplyFrame: Event.None,
			post: async () => ({ accepted: false, reason: 'no_such_session' }),
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

		const service = store.add(new SourcesReviewAttributionService(connection, roster, workspace, stubNotification()));
		mutationEmitter.fire(makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' }));
		assert.strictEqual(service.isAttributionEnabled(), true);
		assert.match(service.getAttributionHeaderSuffix() ?? '', /connected engine/);

		pairingPending = true;
		connectionChangeEmitter.fire({
			...connection.getConnectionSnapshot(),
			sessionToken: 'tok',
		});
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		assert.strictEqual(service.isAttributionEnabled(), true, 'prior everConnected + leftover records KEEP while pairing-hold');
		const leftoverSuffix = service.getAttributionHeaderSuffix();
		assert.ok(!(leftoverSuffix ?? '').includes('connected engine'), 'leftover-looks-live KEEP suffix is disconnected KEEP-chrome, not connected-engine');
		assert.strictEqual(leftoverSuffix, undefined);

		const resource = toResource.call(this, '/project/src/a.ts');
		assert.strictEqual(service.buildChipMapForEntries([{ resource }]).get(resource.toString())?.length, 1, 'KEEP leftover chips stay');

		mutationEmitter.fire(makeRecord({ path: 'src/b.ts', toolCallId: 'tc-2', turnId: 'turn-2' }));
		assert.strictEqual(service.buildChipMapForEntries([{ resource }]).get(resource.toString())?.length, 1, 'leftover-looks-live must not ingest new live mutations');
		assert.strictEqual(service.buildChipMapForEntries([{ resource: toResource.call(this, '/project/src/b.ts') }]).size, 0);
	});

	test('true connect without pairing enables attribution when records exist', function () {
		const service = createService(this, {
			connected: true,
			pairingPending: false,
			records: [makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' })],
		});
		assert.strictEqual(service.isAttributionEnabled(), true);
		assert.match(service.getAttributionHeaderSuffix() ?? '', /connected engine/);
	});

	test('true disconnect first-pull does not invent everConnected attribution', function () {
		const service = createService(this, {
			connected: false,
			pairingPending: false,
			records: [],
		});
		assert.strictEqual(service.isAttributionEnabled(), false);
		assert.strictEqual(service.getAttributionHeaderSuffix(), undefined);
	});

	test('resolveRevealItemId returns item id or undefined silently', () => {
		const attribution = makeAttribution([
			['item-1', { role: 'tool', toolCallId: 'tc-1' }],
		]);
		assert.strictEqual(resolveRevealItemId(attribution, 'tc-1'), 'item-1');
		assert.strictEqual(resolveRevealItemId(attribution, 'missing'), undefined);
	});

	test('service resolveRevealItemId uses the active session lease', function () {
		const service = createService(this, {
			attribution: makeAttribution([
				['item-1', { role: 'tool', toolCallId: 'tc-1' }],
			]),
		});
		assert.strictEqual(service.resolveRevealItemId('tc-1'), 'item-1');
		assert.strictEqual(service.resolveRevealItemId('missing'), undefined);
	});

	test('service resolveRevealItemId acquireSessionView throw notifies error without unhandled rejection', async function () {
		const boom = new Error('acquireSessionView: session untitled is not engine-bound');
		const errors: string[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const service = createService(this, {
				acquireSessionView: () => { throw boom; },
				notificationErrors: errors,
			});
			assert.strictEqual(service.resolveRevealItemId('tc-1'), undefined);
			assert.deepStrictEqual(errors, [getErrorMessage(boom)]);
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('buildChipMapForEntries acquireSessionView throw notifies error and returns empty map', async function () {
		const boom = new Error('acquireSessionView: session untitled is not engine-bound');
		const errors: string[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		const resource = toResource.call(this, '/project/src/a.ts');
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const service = createService(this, {
				records: [makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' })],
				acquireSessionView: () => { throw boom; },
				notificationErrors: errors,
			});
			const chipMap = service.buildChipMapForEntries([{ resource }]);
			assert.strictEqual(chipMap.size, 0);
			assert.deepStrictEqual(errors, [getErrorMessage(boom)]);
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
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
