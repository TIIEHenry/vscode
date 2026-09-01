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
import { ConversationTrajectoryList } from '../../browser/conversationTrajectoryList.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import {
	CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT,
	CONVERSATION_TRAJECTORY_STUB_SOURCE_BLOCK_CONTENT,
	CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT,
	projectTurnsToTrajectory,
} from '../../browser/conversationTrajectoryModel.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { Event } from '../../../../../base/common/event.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';

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
		const trajectoryList = (lens as unknown as { trajectoryList: ConversationTrajectoryList }).trajectoryList;
		const timelineHeight = LENS_LAYOUT_HEIGHT - 120;
		timelineTree.layout(timelineHeight, LENS_LAYOUT_WIDTH);
		trajectoryList.layout(LENS_LAYOUT_HEIGHT, LENS_LAYOUT_WIDTH);
	}

	function mountLens(): { part: ConversationPart; lens: ConversationLens; stubService: ConversationStubService; layoutReadingColumn: () => void } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const storageService = store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		const stubService = store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		instantiationService.stub(IConversationRosterService, stubService);
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
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		parent.classList.add('monaco-workbench');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);
		const slots = part.getSlots();
		assert.ok(slots);
		const layout = () => layoutReadingColumn(lens, slots);
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		layout();
		return { part, lens, stubService, layoutReadingColumn: layout };
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

	test('getTrajectoryRecords merges untitled stub fixtures with Stub copy', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		assert.strictEqual(sessionId, 'untitled');

		const user = service.appendUserTurn(sessionId, 'Draft the README');
		assert.ok(user);

		const records = service.getTrajectoryRecords(sessionId);
		assert.ok(records.some(record => record.kind === 'system' && record.text.includes('Stub')));
		assert.ok(records.some(record => record.kind === 'context' && record.text.includes('Stub')));
		const userRecord = records.find(record => record.id === user!.id);
		assert.ok(userRecord);
		assert.strictEqual(userRecord!.kind, 'user');
		assert.ok(userRecord!.sourceBlocks?.some(block => block.content.includes('Stub')));
	});

	test('getTrajectoryRecords is empty for createSession without fixture extras', () => {
		const service = store.add(new ConversationStubService());
		const emptySessionId = service.createSession();

		assert.strictEqual(service.getTrajectoryRecords(emptySessionId).length, 0);
	});

	test('conversation lens hides trajectory fixture copy on the Conversation page', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();

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
});
