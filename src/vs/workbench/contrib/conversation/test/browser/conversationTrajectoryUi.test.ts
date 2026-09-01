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
import { ConversationTrajectory } from '../../browser/conversationTrajectory.js';
import {
	conversationTrajectoryInspectorPayload,
	conversationTrajectoryInspectorSummary,
	conversationTrajectoryKindContext,
	conversationTrajectoryKindSubtool,
	conversationTrajectoryKindSystem,
	conversationTrajectoryKindTool,
} from '../../browser/conversationTrajectory.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import {
	CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT,
	CONVERSATION_TRAJECTORY_STUB_SUBTOOL_TEXT,
	CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT,
} from '../../browser/conversationTrajectoryModel.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { Event } from '../../../../../base/common/event.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';

suite('ConversationTrajectoryUi', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const LENS_LAYOUT_WIDTH = 640;
	const LENS_LAYOUT_HEIGHT = 480;

	async function flushTimelineHeightUpdates(): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 20));
	}

	function getLensTab(slots: IConversationLensSlots, lensId: 'conversation' | 'trajectory'): HTMLButtonElement {
		const tab = slots.sessionBar.querySelector(`button[data-lens-id="${lensId}"]`);
		assert.ok(tab);
		return tab as HTMLButtonElement;
	}

	function clickLensTab(slots: IConversationLensSlots, lensId: 'conversation' | 'trajectory'): void {
		getLensTab(slots, lensId).click();
	}

	function layoutReadingColumn(lens: ConversationLens, slots: IConversationLensSlots): void {
		const readingColumn = slots.timeline.querySelector('.conversation-lens-reading-column') as HTMLElement | null;
		if (readingColumn) {
			readingColumn.style.width = `${LENS_LAYOUT_WIDTH}px`;
			readingColumn.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		}
		const trajectoryView = (lens as unknown as { trajectoryView: ConversationTrajectory }).trajectoryView;
		trajectoryView.layout(LENS_LAYOUT_HEIGHT, LENS_LAYOUT_WIDTH);
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

	function seedUntitledTrajectory(stubService: ConversationStubService): string {
		const sessionId = stubService.getActiveSessionId();
		stubService.appendUserTurn(sessionId, 'Draft the README');
		stubService.appendThinkingTurn(sessionId, 'Stub: outline sections');
		stubService.appendToolTurn(sessionId, 'Stub: README.md');
		stubService.appendStubEchoAssistant(sessionId, 'Stub: README draft ready.');
		return sessionId;
	}

	test('trajectory table renders record kinds and opens inspector on row select', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		seedUntitledTrajectory(stubService);
		await flushTimelineHeightUpdates();

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.ok(trajectory.querySelector('.conversation-lens-trajectory-table[role="table"]'));
		assert.ok(trajectory.textContent?.includes(conversationTrajectoryKindSystem));
		assert.ok(trajectory.textContent?.includes(conversationTrajectoryKindContext));
		assert.ok(trajectory.textContent?.includes(conversationTrajectoryKindTool));
		assert.ok(trajectory.textContent?.includes(conversationTrajectoryKindSubtool));

		const systemRow = trajectory.querySelector('.conversation-lens-trajectory-record-row[data-kind="system"]') as HTMLElement;
		assert.ok(systemRow);
		systemRow.click();
		layoutReadingColumn();

		const inspector = trajectory.querySelector('.conversation-lens-trajectory-inspector') as HTMLElement;
		assert.ok(!inspector.hidden);
		assert.ok(inspector.textContent?.includes(conversationTrajectoryInspectorSummary));
		assert.ok(inspector.textContent?.includes(CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT));
		assert.ok(inspector.textContent?.includes(conversationTrajectoryInspectorPayload));
	});

	test('subtool row is indented relative to parent tool', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		seedUntitledTrajectory(stubService);
		await flushTimelineHeightUpdates();

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const subtoolRow = slots.timeline.querySelector('.conversation-lens-trajectory-record-row[data-kind="subtool"]') as HTMLElement;
		assert.ok(subtoolRow);
		assert.ok(subtoolRow.classList.contains('conversation-lens-trajectory-record-row--indented'));
		assert.strictEqual(subtoolRow.style.paddingInlineStart, '12px');
		assert.ok(subtoolRow.textContent?.includes(CONVERSATION_TRAJECTORY_STUB_SUBTOOL_TEXT));
	});

	test('process fold defaults expanded on trajectory and keeps SYSTEM/context outside when collapsed', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		seedUntitledTrajectory(stubService);
		await flushTimelineHeightUpdates();

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		const foldHeader = trajectory.querySelector('.conversation-process-fold-header') as HTMLButtonElement;
		assert.ok(foldHeader);
		assert.strictEqual(foldHeader.getAttribute('aria-expanded'), 'true');
		assert.ok(foldHeader.textContent?.includes('Stub'));

		const foldChildren = trajectory.querySelector('.conversation-process-fold-children') as HTMLElement;
		assert.ok(foldChildren);
		assert.strictEqual(foldChildren.hidden, false);
		assert.ok(foldChildren.querySelector('.conversation-lens-trajectory-record-row[data-kind="thinking"]'));
		assert.ok(foldChildren.querySelector('.conversation-lens-trajectory-record-row[data-kind="tool"]'));
		assert.ok(foldChildren.querySelector('.conversation-lens-trajectory-record-row[data-kind="subtool"]'));

		const systemOutside = trajectory.querySelector('.conversation-lens-trajectory-table-body > .conversation-lens-trajectory-record-row[data-kind="system"]');
		const contextOutside = trajectory.querySelector('.conversation-lens-trajectory-table-body > .conversation-lens-trajectory-record-row[data-kind="context"]');
		assert.ok(systemOutside);
		assert.ok(contextOutside);
		assert.ok(systemOutside.textContent?.includes(CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT));
		assert.ok(contextOutside.textContent?.includes(CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT));

		foldHeader.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(foldHeader.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(foldChildren.hidden, true);
		assert.ok(trajectory.querySelector('.conversation-lens-trajectory-record-row[data-kind="system"]'));
		assert.ok(trajectory.querySelector('.conversation-lens-trajectory-record-row[data-kind="context"]'));
	});
});
