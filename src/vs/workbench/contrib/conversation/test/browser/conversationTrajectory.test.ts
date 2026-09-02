/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import { ConversationTimelineTree } from '../../browser/conversationTimelineTree.js';
import { ConversationTrajectory } from '../../browser/conversationTrajectory.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import {
	CONVERSATION_TRAJECTORY_RECORD_LIMIT,
	CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT,
	CONVERSATION_TRAJECTORY_STUB_SOURCE_BLOCK_CONTENT,
	CONVERSATION_TRAJECTORY_STUB_SUBTOOL_TEXT,
	CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT,
	applyTrajectoryRecordLimit,
	filterTrajectoryRecordsBySearch,
	projectSnapshotToTrajectory,
	projectTurnsToTrajectory,
	shouldMergeTrajectoryFixtureExtras,
} from '../../browser/conversationTrajectoryModel.js';
import type { ItemAttribution } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SessionViewSnapshot, TimelineItemId } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { getTrajectoryKindLabel, conversationTrajectoryKindTool } from '../../browser/conversationTrajectory.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { Event } from '../../../../../base/common/event.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IConversationReviewNavService } from '../../common/conversationReviewEntry.js';

function turn(id: string, kind: ConversationStubTurn['kind'], text = id, status?: ConversationStubTurn['status']): ConversationStubTurn {
	return status ? { id, kind, text, status } : { id, kind, text };
}

suite('ConversationTrajectory', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const LENS_LAYOUT_WIDTH = 640;
	const LENS_LAYOUT_HEIGHT = 480;

	async function flushTimelineHeightUpdates(): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 20));
	}

	function getTimelineScroll(slots: IConversationLensSlots): HTMLElement {
		const scroll = slots.timeline.querySelector('.conversation-lens-timeline-scroll');
		assert.ok(scroll);
		return scroll as HTMLElement;
	}

	function layoutReadingColumn(lens: ConversationLens, slots: IConversationLensSlots): void {
		const readingColumn = slots.timeline.querySelector('.conversation-lens-reading-column') as HTMLElement | null;
		const timelineScroll = slots.timeline.querySelector('.conversation-lens-timeline-scroll') as HTMLElement | null;
		const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
		const treeContainer = slots.timeline.querySelector('.conversation-timeline-tree') as HTMLElement | null;
		if (readingColumn) {
			readingColumn.style.width = `${LENS_LAYOUT_WIDTH}px`;
			readingColumn.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		}
		if (timelineScroll) {
			timelineScroll.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
			timelineScroll.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (contentHost) {
			contentHost.style.display = '';
			contentHost.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (treeContainer) {
			treeContainer.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		const timelineTree = (lens as unknown as { timelineTree: ConversationTimelineTree }).timelineTree;
		const trajectoryView = (lens as unknown as { trajectoryView: ConversationTrajectory }).trajectoryView;
		const timelineHeight = LENS_LAYOUT_HEIGHT - 120;
		timelineTree.layout(timelineHeight, LENS_LAYOUT_WIDTH);
		trajectoryView.layout(LENS_LAYOUT_HEIGHT, LENS_LAYOUT_WIDTH);
	}

	function mountLens(): { part: ConversationPart; lens: ConversationLens; stubService: ConversationStubService; layoutReadingColumn: () => void; slots: IConversationLensSlots } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const storageService = store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		const stubService = store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
		});
		instantiationService.stub(IClipboardService, clipboardService);
		instantiationService.stub(ICommandService, new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand() { return Promise.resolve(undefined); }
		}());
		instantiationService.stub(IExplorerService, {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService);
		instantiationService.stub(ISCMService, {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService);
		instantiationService.stub(IConversationReviewNavService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getReviewNavForSession: () => [],
		});
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		parent.classList.add('monaco-workbench');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);
		const partSlots = part.getSlots();
		assert.ok(partSlots);
		const slots: IConversationLensSlots = {
			sessionBar: partSlots.sessionBar,
			timeline: document.createElement('div'),
			dock: document.createElement('div'),
		};
		slots.timeline.classList.add('conversation-timeline');
		slots.dock.classList.add('conversation-dock');
		parent.appendChild(slots.timeline);
		parent.appendChild(slots.dock);
		const layout = () => layoutReadingColumn(lens, slots);
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		layout();
		return { part, lens, stubService, layoutReadingColumn: layout, slots };
	}

	test('projectTurnsToTrajectory skips confirmation turns', () => {
		const turns = [
			turn('u1', 'user', 'Help me'),
			turn('c1', 'confirmation', 'Allow write?', 'pending'),
			turn('a1', 'assistant', 'Done'),
		];

		const records = projectTurnsToTrajectory(turns);

		assert.deepStrictEqual(records.map(record => record.kind), ['user', 'message']);
		assert.ok(!records.some(record => record.id === 'c1'));
		assert.strictEqual(records[0]!.text, 'Help me');
		assert.strictEqual(records[1]!.text, 'Done');
	});

	test('projectTurnsToTrajectory skips visualization turns', () => {
		const turns = [
			turn('u1', 'user', 'Show roadmap'),
			turn('v1', 'visualization', ''),
			turn('a1', 'assistant', 'Done'),
		];

		const records = projectTurnsToTrajectory(turns);

		assert.deepStrictEqual(records.map(record => record.kind), ['user', 'message']);
		assert.ok(!records.some(record => record.id === 'v1'));
	});

	test('projectTurnsToTrajectory maps thinking and tool turns', () => {
		const turns = [
			turn('t1', 'thinking', 'Stub: outline sections'),
			turn('tool1', 'tool', 'Stub: README.md'),
		];

		const records = projectTurnsToTrajectory(turns);

		assert.deepStrictEqual(records.map(record => [record.kind, record.text]), [
			['thinking', 'Stub: outline sections'],
			['tool', 'Stub: README.md'],
		]);
		assert.strictEqual(records[1]!.callId, 'tool1');
	});

	test('getTrajectoryRecords uses snapshot projection and filterAgentId option', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		service.appendUserTurn(sessionId, 'hello');
		service.appendStubEchoAssistant(sessionId, 'reply');

		const all = service.getTrajectoryRecords(sessionId);
		assert.ok(all.some(record => record.kind === 'message'));

		// Non-matching agent filter removes assistant rows without agent attribution.
		const filtered = service.getTrajectoryRecords(sessionId, { filterAgentId: 'agent-sub' });
		assert.ok(filtered.some(record => record.kind === 'user'));
		assert.ok(!filtered.some(record => record.kind === 'message'));
	});

	test('getTrajectoryRecords merges untitled stub fixtures with Stub copy', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		assert.strictEqual(sessionId, 'untitled');

		const user = service.appendUserTurn(sessionId, 'Draft the README');
		assert.ok(user);
		service.appendThinkingTurn(sessionId, 'Stub: outline sections');
		service.appendToolTurn(sessionId, 'Stub: README.md');

		const records = service.getTrajectoryRecords(sessionId);
		assert.ok(records.some(record => record.kind === 'system' && record.text.includes('Stub')));
		assert.ok(records.some(record => record.kind === 'context' && record.text.includes('Stub')));
		const userRecord = records.find(record => record.id === user!.id);
		assert.ok(userRecord);
		assert.strictEqual(userRecord!.kind, 'user');
		assert.ok(userRecord!.sourceBlocks?.some(block => block.content.includes('Stub')));
		const subtool = records.find(record => record.kind === 'subtool');
		assert.ok(subtool);
		assert.strictEqual(subtool!.text, CONVERSATION_TRAJECTORY_STUB_SUBTOOL_TEXT);
		assert.strictEqual(subtool!.depth, 1);
	});

	test('getTrajectoryRecords is empty for createSession without fixture extras', () => {
		const service = store.add(new ConversationStubService());
		const emptySessionId = service.createSession();

		assert.strictEqual(service.getTrajectoryRecords(emptySessionId).length, 0);
	});

	test('conversation lens hides trajectory fixture copy on the Conversation page', async () => {
		const { stubService, layoutReadingColumn, slots } = mountLens();
		const sessionId = stubService.getActiveSessionId();
		assert.strictEqual(sessionId, 'untitled');

		for (const turn of [...stubService.getTurns(sessionId)]) {
			stubService.deleteTurn(sessionId, turn.id);
		}

		stubService.appendUserTurn(sessionId, 'Only the user prompt belongs here');
		stubService.appendThinkingTurn(sessionId, 'Stub: hidden thinking');
		stubService.appendToolTurn(sessionId, 'Stub: hidden tool');
		stubService.appendStubEchoAssistant(sessionId, 'Visible assistant reply');
		await flushTimelineHeightUpdates();
		layoutReadingColumn();

		const timeline = getTimelineScroll(slots);
		const timelineText = timeline.textContent ?? '';

		assert.ok(timelineText.includes('Only the user prompt belongs here'));
		assert.ok(timelineText.includes('Visible assistant reply'));
		assert.ok(!timelineText.includes(CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT));
		assert.ok(!timelineText.includes(CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT));
		assert.ok(!timelineText.includes(CONVERSATION_TRAJECTORY_STUB_SOURCE_BLOCK_CONTENT));
		assert.strictEqual(timeline.querySelector('[data-kind="context"]'), null);
		assert.strictEqual(timeline.querySelector('[data-kind="system"]'), null);
		assert.strictEqual(timeline.querySelector('.conversation-lens-trajectory-source-block'), null);
	});

	test('trajectory records expose fixture copy even when conversation page hides it', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		service.appendUserTurn(sessionId, 'Trajectory-only inject should stay off the conversation page');

		const records = service.getTrajectoryRecords(sessionId);
		assert.ok(records.some(record => record.kind === 'system' && record.text === CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT));
		assert.ok(records.some(record => record.kind === 'context' && record.text === CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT));
		assert.ok(records.some(record =>
			record.kind === 'user'
			&& record.sourceBlocks?.some(block => block.content === CONVERSATION_TRAJECTORY_STUB_SOURCE_BLOCK_CONTENT),
		));
	});

	function engineSnapshotWithTool(): { snapshot: SessionViewSnapshot; attribution: Map<string, ItemAttribution> } {
		const attribution = new Map<string, ItemAttribution>([
			['u1', { role: 'user' }],
			['tool-root', { role: 'tool', toolCallId: 'call-root' } as ItemAttribution],
			['tool-child', { role: 'tool', toolCallId: 'call-child', parentToolCallId: 'call-root' } as ItemAttribution],
		]);
		const snapshot: SessionViewSnapshot = {
			sessionId: 'ua-live' as SessionViewSnapshot['sessionId'],
			sync: { kind: 'live' },
			timeline: [
				{ id: 'u1' as TimelineItemId, orderKey: '0000000000000001', summary: { kind: 'text', title: 'Run grep', preview: 'Run grep' } },
				{
					id: 'tool-root' as TimelineItemId,
					orderKey: '0000000000000002',
					summary: {
						kind: 'tool',
						title: 'grep pattern',
						toolName: 'grep',
						status: 'completed',
						argPreview: '{"pattern":"foo"}',
						resultPreview: 'src/a.ts:1:match',
					},
				},
				{
					id: 'tool-child' as TimelineItemId,
					orderKey: '0000000000000003',
					summary: {
						kind: 'tool',
						title: 'read result file',
						toolName: 'read',
						status: 'completed',
						resultPreview: 'file body preview',
					},
				},
			],
			overlay: { blocks: [] },
			pendingActions: [],
			localPendingSends: [],
		};
		return { snapshot, attribution };
	}

	test('projectSnapshotToTrajectory folds tool rows with bounded previews only (G3)', () => {
		const { snapshot, attribution } = engineSnapshotWithTool();
		const fullBody = '{"pattern":"foo","path":"/secret/full/path"}';
		const details = new Map<string, string>([['detail:tool-root', fullBody]]);

		const records = projectSnapshotToTrajectory(snapshot, attribution, details);

		const rootTool = records.find(record => record.id === 'tool-root');
		assert.ok(rootTool);
		assert.strictEqual(rootTool!.kind, 'tool');
		assert.strictEqual(rootTool!.inputDetail, '{"pattern":"foo"}');
		assert.strictEqual(rootTool!.result, 'src/a.ts:1:match');
		assert.notStrictEqual(rootTool!.inputDetail, fullBody);

		const subtool = records.find(record => record.id === 'tool-child');
		assert.ok(subtool);
		assert.strictEqual(subtool!.kind, 'subtool');
		assert.strictEqual(subtool!.parentCallId, 'call-root');
		assert.strictEqual(subtool!.depth, 1);
	});

	test('projectSnapshotToTrajectory filters sub-agent rows by attribution', () => {
		const attribution = new Map<string, ItemAttribution>([
			['u1', { role: 'user' }],
			['tool-root', { role: 'tool', toolCallId: 'call-root' } as ItemAttribution],
			['a1', { role: 'assistant', agentId: 'agent-root' }],
			['a2', { role: 'assistant', agentId: 'agent-sub' }],
		]);
		const snapshot: SessionViewSnapshot = {
			sessionId: 'ua-live' as SessionViewSnapshot['sessionId'],
			sync: { kind: 'live' },
			timeline: [
				{ id: 'u1' as TimelineItemId, orderKey: '0000000000000001', summary: { kind: 'text', title: 'Run grep', preview: 'Run grep' } },
				{
					id: 'tool-root' as TimelineItemId,
					orderKey: '0000000000000002',
					summary: { kind: 'tool', title: 'grep pattern', toolName: 'grep', status: 'completed' },
				},
				{ id: 'a1' as TimelineItemId, orderKey: '0000000000000003', summary: { kind: 'text', title: 'Root reply', preview: 'Root reply' } },
				{ id: 'a2' as TimelineItemId, orderKey: '0000000000000004', summary: { kind: 'text', title: 'Sub reply', preview: 'Sub reply' } },
			],
			overlay: { blocks: [] },
			pendingActions: [],
			localPendingSends: [],
		};

		const filtered = projectSnapshotToTrajectory(snapshot, attribution, new Map(), { filterAgentId: 'agent-sub' });

		assert.ok(filtered.some(record => record.id === 'u1'));
		assert.ok(filtered.some(record => record.id === 'a2'));
		assert.ok(!filtered.some(record => record.id === 'a1'));
		assert.ok(!filtered.some(record => record.id === 'tool-root'));
	});

	test('shouldMergeTrajectoryFixtureExtras is false for UA session ids when disconnected', () => {
		assert.strictEqual(shouldMergeTrajectoryFixtureExtras('untitled', false), true);
		assert.strictEqual(shouldMergeTrajectoryFixtureExtras('untitled', true), false);
		assert.strictEqual(shouldMergeTrajectoryFixtureExtras('ua-only', false), false);
		assert.strictEqual(shouldMergeTrajectoryFixtureExtras('ua-only', true), false);
	});

	test('ua session trajectory projection never includes Stub fixture rows', () => {
		const { snapshot, attribution } = engineSnapshotWithTool();
		const records = projectSnapshotToTrajectory(snapshot, attribution, new Map());
		assert.ok(!records.some(record => record.text.includes('Stub')));
		assert.ok(!records.some(record => record.kind === 'system'));
		assert.ok(records.some(record => record.kind === 'tool'));
	});

	test('connected trajectory UI shows engine tool row label', () => {
		const { snapshot, attribution } = engineSnapshotWithTool();
		const records = projectSnapshotToTrajectory(snapshot, attribution, new Map());
		const tool = records.find(record => record.kind === 'tool');
		assert.ok(tool);
		assert.strictEqual(getTrajectoryKindLabel(tool!.kind), conversationTrajectoryKindTool);
	});

	test('applyTrajectoryRecordLimit keeps most recent records and reports omitted count', () => {
		const records = Array.from({ length: CONVERSATION_TRAJECTORY_RECORD_LIMIT + 42 }, (_, index) => ({
			id: `r${index}`,
			kind: 'message' as const,
			text: `Record ${index}`,
		}));

		const limited = applyTrajectoryRecordLimit(records);

		assert.strictEqual(limited.totalCount, CONVERSATION_TRAJECTORY_RECORD_LIMIT + 42);
		assert.strictEqual(limited.omittedCount, 42);
		assert.strictEqual(limited.visibleRecords.length, CONVERSATION_TRAJECTORY_RECORD_LIMIT);
		assert.strictEqual(limited.visibleRecords[0]!.id, 'r42');
		assert.strictEqual(limited.visibleRecords.at(-1)!.id, `r${CONVERSATION_TRAJECTORY_RECORD_LIMIT + 41}`);
	});

	test('filterTrajectoryRecordsBySearch matches kind, text, and source blocks', () => {
		const records = [
			{ id: '1', kind: 'system' as const, text: 'Stub environment' },
			{ id: '2', kind: 'user' as const, text: 'Find me', sourceBlocks: [{ type: 'text', content: 'needle.txt', toolName: 'readme' }] },
			{ id: '3', kind: 'message' as const, text: 'Other reply' },
		];

		assert.strictEqual(filterTrajectoryRecordsBySearch(records, '').length, 3);
		assert.deepStrictEqual(filterTrajectoryRecordsBySearch(records, 'stub').map(record => record.id), ['1']);
		assert.deepStrictEqual(filterTrajectoryRecordsBySearch(records, 'needle').map(record => record.id), ['2']);
		assert.deepStrictEqual(filterTrajectoryRecordsBySearch(records, 'missing').length, 0);
	});
});
