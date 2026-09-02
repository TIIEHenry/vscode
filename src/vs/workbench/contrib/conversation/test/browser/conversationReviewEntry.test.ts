/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import type { SessionViewSnapshot, TimelineItemSummary } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IFileMutationRecord } from '../../../sources/common/sourcesReviewAttribution.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { ConversationReviewNavService } from '../../browser/conversationReviewNavService.js';
import {
	attachReviewEntries,
	classifyReviewNavApplyMode,
	formatReviewNavLabel,
	IReviewNavRecord,
	materializeReviewNavRecords,
	reviewNavEntryId,
	reviewNavIndicesOutsideProcessFold,
} from '../../common/conversationReviewEntry.js';
import {
	entriesToLegacyTurns,
	projectSnapshotToEntries,
	type ConversationTimelineEntry,
} from '../../browser/conversationSessionView.js';

suite('conversationReviewEntry (R4b)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const WORKSPACE_ROOT = URI.file('/home/test/project');

	const textSummary = (preview: string): TimelineItemSummary => ({ kind: 'text', title: 'Agent', preview });

	function makeSnapshot(
		timeline: SessionViewSnapshot['timeline'],
	): SessionViewSnapshot {
		return {
			...emptySessionViewSnapshot('session-1' as SessionViewSnapshot['sessionId']),
			sync: { kind: 'live' },
			timeline,
		};
	}

	function makeRecord(overrides: Partial<IFileMutationRecord> & Pick<IFileMutationRecord, 'path' | 'toolCallId' | 'turnId'>): IFileMutationRecord {
		return {
			sessionId: 'session-1',
			agentId: 'coder',
			operation: 'modify',
			...overrides,
		};
	}

	function baseEntriesForTurn(turnId: string, toolItemId = 'tool-1'): { snapshot: SessionViewSnapshot; entries: ConversationTimelineEntry[] } {
		const snapshot = makeSnapshot([
			{ id: 'u1' as SessionViewSnapshot['timeline'][number]['id'], orderKey: '0000000000000001', turnId: turnId as SessionViewSnapshot['timeline'][number]['turnId'], summary: textSummary('hi') },
			{ id: 't1' as SessionViewSnapshot['timeline'][number]['id'], orderKey: '0000000000000002', turnId: turnId as SessionViewSnapshot['timeline'][number]['turnId'], summary: { kind: 'reasoning', title: 'think' } },
			{ id: toolItemId as SessionViewSnapshot['timeline'][number]['id'], orderKey: '0000000000000003', turnId: turnId as SessionViewSnapshot['timeline'][number]['turnId'], summary: { kind: 'tool', title: 'write', toolName: 'write', status: 'completed' } },
			{ id: 'a1' as SessionViewSnapshot['timeline'][number]['id'], orderKey: '0000000000000004', turnId: turnId as SessionViewSnapshot['timeline'][number]['turnId'], summary: textSummary('done') },
		]);
		const attribution = new Map([
			['u1', { role: 'user' as const }],
			['t1', { role: 'assistant' as const }],
			[toolItemId, { role: 'tool' as const, toolCallId: 'tc-1' }],
			['a1', { role: 'assistant' as const }],
		]);
		const entries = projectSnapshotToEntries(snapshot, attribution, new Map());
		return { snapshot, entries };
	}

	test('no mutation → no reviewNav row', () => {
		const records = materializeReviewNavRecords({
			sessionId: 'session-1',
			mutations: [],
			settledTurnIds: new Set(['turn-1']),
			workDir: WORKSPACE_ROOT.fsPath,
			workspaceRoots: [WORKSPACE_ROOT],
			hasScmProvider: true,
		});
		assert.deepStrictEqual(records, []);
		const { snapshot, entries } = baseEntriesForTurn('turn-1');
		assert.deepStrictEqual(attachReviewEntries(entries, snapshot, records).map(e => e.kind), entries.map(e => e.kind));
	});

	test('no SCM provider → no reviewNav row', () => {
		const records = materializeReviewNavRecords({
			sessionId: 'session-1',
			mutations: [makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' })],
			settledTurnIds: new Set(['turn-1']),
			workDir: WORKSPACE_ROOT.fsPath,
			workspaceRoots: [WORKSPACE_ROOT],
			hasScmProvider: false,
		});
		assert.deepStrictEqual(records, []);
	});

	test('work_dir mismatch → no reviewNav row', () => {
		const records = materializeReviewNavRecords({
			sessionId: 'session-1',
			mutations: [makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'turn-1' })],
			settledTurnIds: new Set(['turn-1']),
			workDir: '/other/workdir',
			workspaceRoots: [WORKSPACE_ROOT],
			hasScmProvider: true,
		});
		assert.deepStrictEqual(records, []);
	});

	test('unsettled turn → no row; after settle → row appears', () => {
		const mutation = makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'runtime-1' });
		const unsettled = materializeReviewNavRecords({
			sessionId: 'session-1',
			mutations: [mutation],
			settledTurnIds: new Set(),
			workDir: WORKSPACE_ROOT.fsPath,
			workspaceRoots: [WORKSPACE_ROOT],
			hasScmProvider: true,
		});
		assert.deepStrictEqual(unsettled, []);

		const settled = materializeReviewNavRecords({
			sessionId: 'session-1',
			mutations: [{ ...mutation, turnId: 'assistant-1' }],
			settledTurnIds: new Set(['assistant-1']),
			workDir: WORKSPACE_ROOT.fsPath,
			workspaceRoots: [WORKSPACE_ROOT],
			hasScmProvider: true,
		});
		assert.strictEqual(settled.length, 1);
		assert.strictEqual(settled[0]!.turnId, 'assistant-1');
		assert.strictEqual(settled[0]!.paths.length, 1);

		const { snapshot, entries } = baseEntriesForTurn('assistant-1');
		const attached = attachReviewEntries(entries, snapshot, settled);
		assert.ok(attached.some(entry => entry.kind === 'reviewNav'));
	});

	test('late snapshot updates N with stable id → frame class A', function () {
		const { snapshot, entries } = baseEntriesForTurn('turn-1');
		const pathA = URI.file('/project/a.ts').toString();
		const pathB = URI.file('/project/b.ts').toString();
		const oneFile: IReviewNavRecord = { sessionId: 'session-1', turnId: 'turn-1', paths: [pathA] };
		const twoFiles: IReviewNavRecord = { sessionId: 'session-1', turnId: 'turn-1', paths: [pathA, pathB] };

		const prev = attachReviewEntries(entries, snapshot, [oneFile]);
		const next = attachReviewEntries(entries, snapshot, [twoFiles]);
		assert.strictEqual(classifyReviewNavApplyMode(prev, next), 'content');
		assert.strictEqual(prev.find(e => e.kind === 'reviewNav')!.id, reviewNavEntryId('turn-1'));
		assert.strictEqual(next.find(e => e.kind === 'reviewNav')!.text, formatReviewNavLabel(2));
	});

	test('reviewNav add/remove → frame class B', () => {
		const { snapshot, entries } = baseEntriesForTurn('turn-1');
		const pathA = URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString();
		const nav: IReviewNavRecord = { sessionId: 'session-1', turnId: 'turn-1', paths: [pathA] };
		const withNav = attachReviewEntries(entries, snapshot, [nav]);
		assert.strictEqual(classifyReviewNavApplyMode(entries, withNav), 'structure');
		assert.strictEqual(classifyReviewNavApplyMode(withNav, entries), 'structure');
	});

	test('inserts after last L2 entry for turn including tool', function () {
		const { snapshot, entries } = baseEntriesForTurn('turn-1');
		const nav: IReviewNavRecord = {
			sessionId: 'session-1',
			turnId: 'turn-1',
			paths: [URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()],
		};
		const attached = attachReviewEntries(entries, snapshot, [nav]);
		const toolIndex = attached.findIndex(e => e.id === 'tool-1');
		const navIndex = attached.findIndex(e => e.kind === 'reviewNav');
		const assistantIndex = attached.findIndex(e => e.id === 'a1');
		assert.ok(toolIndex >= 0);
		assert.ok(navIndex > toolIndex);
		assert.ok(navIndex > assistantIndex);
	});

	test('skips insert when turn has no timeline entries yet', function () {
		const { snapshot, entries } = baseEntriesForTurn('turn-1');
		const nav: IReviewNavRecord = {
			sessionId: 'session-1',
			turnId: 'turn-other',
			paths: [URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()],
		};
		const attached = attachReviewEntries(entries, snapshot, [nav]);
		assert.strictEqual(attached.filter(e => e.kind === 'reviewNav').length, 0);
	});

	test('reviewNav sits outside process-fold spans', function () {
		const { snapshot, entries } = baseEntriesForTurn('turn-1');
		const nav: IReviewNavRecord = {
			sessionId: 'session-1',
			turnId: 'turn-1',
			paths: [URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()],
		};
		const attached = attachReviewEntries(entries, snapshot, [nav]);
		assert.ok(reviewNavIndicesOutsideProcessFold(attached));
	});

	test('entriesToLegacyTurns drops reviewNav kind', function () {
		const { snapshot, entries } = baseEntriesForTurn('turn-1');
		const nav: IReviewNavRecord = {
			sessionId: 'session-1',
			turnId: 'turn-1',
			paths: [URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()],
		};
		const attached = attachReviewEntries(entries, snapshot, [nav]);
		const legacy = entriesToLegacyTurns(attached);
		assert.ok(!legacy.some(turn => turn.id.startsWith('reviewNav:')));
	});

	test('sidecar retains rows after disconnect', () => {
		const root = WORKSPACE_ROOT;
		const mutationEmitter = store.add(new Emitter<IFileMutationRecord>());
		const connectionChangeEmitter = store.add(new Emitter<import('../../../../../platform/universeAgent/common/universeAgentTypes.js').UniverseAgentConnectionSnapshot>());
		const settleEmitter = store.add(new Emitter<import('../../common/conversationReviewEntry.js').ITurnSettleSignal>());

		const connection = {
			isEngineConnected: () => false,
			getConnectionSnapshot: () => ({
				transport: 'idle' as const,
				workDir: root.fsPath,
				pairingPending: false,
				channelAlive: false,
				capabilities: {} as never,
			}),
			onDidFileMutation: mutationEmitter.event,
			onDidChangeConnection: connectionChangeEmitter.event,
			onDidTurnSettle: settleEmitter.event,
		} as unknown as IUniverseAgentConnection;

		const roster = {
			getActiveSessionId: () => 'session-1',
			onDidChangeActiveSession: Event.None,
			acquireSessionView: () => { throw new Error('not used'); },
		} as unknown as IConversationRosterService;

		const workspace = {
			getWorkspace: () => ({ folders: [{ uri: root, name: 'project', index: 0, toResource: () => root }] }),
		} as unknown as IWorkspaceContextService;

		const scm = {
			repositories: [{}],
		} as unknown as ISCMService;

		const service = store.add(new ConversationReviewNavService(connection, roster, workspace, scm));

		mutationEmitter.fire(makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'runtime-1' }));
		settleEmitter.fire({ sessionId: 'session-1', runtimeTurnId: 'runtime-1', assistantTurnId: 'assistant-1' });
		const beforeDisconnect = service.getReviewNavForSession('session-1');
		assert.strictEqual(beforeDisconnect.length, 1);

		connectionChangeEmitter.fire({
			transport: 'idle',
			workDir: root.fsPath,
			pairingPending: false,
			channelAlive: false,
			capabilities: {} as never,
		});
		assert.deepStrictEqual(service.getReviewNavForSession('session-1'), beforeDisconnect);
	});
});
