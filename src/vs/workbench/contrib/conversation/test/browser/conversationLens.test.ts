/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { KeyCode } from '../../../../../base/common/keyCodes.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { Parts } from '../../../../services/layout/browser/layoutService.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { TestLayoutService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationChatInput } from '../../common/conversationChatInput.js';
import { ConversationEditorPane } from '../../browser/conversationEditorPane.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import { conversationLensStaleSnapshotClass } from '../../browser/conversationLensReadingColumn.js';
import { ConversationTimelineTree, conversationLensUserBubbleShowLess, conversationLensUserBubbleShowMore } from '../../browser/conversationTimelineTree.js';
import { ConversationTrajectory } from '../../browser/conversationTrajectory.js';
import {
	conversationLensDockAgentLabel,
	conversationLensDockControlHeightPx,
	conversationLensDockEditExit,
	conversationLensDockEditingMessage,
	conversationLensDockEngineNotConnected,
	conversationLensDockGoal,
	conversationLensDockInboxNoQueue,
	conversationLensDockMaximizeInput,
	conversationLensDockGoalUnavailable,
	conversationLensDockNoGoal,
	conversationLensDockNoModel,
	conversationLensDockNoTools,
	conversationLensDockNoEngineTools,
	conversationLensDockNoAgent,
	conversationLensDockPermissionAsk,
	conversationLensDockPermissionLabel,
	conversationLensDockPermissionPermit,
	conversationLensDockPlaceholder,
	conversationLensPostFailed,
	conversationLensPostFailedDisconnected,
	conversationLensDockRestoreTimeline,
	conversationLensDockStop,
	conversationLensDockStopNotGenerating,
	conversationLensDockTuneTitle,
	conversationLensInputMaximizedClass,
	conversationLensPhasePreFirstClass,
	conversationLensPhasePreFirstDockHiddenClass,
	conversationLensPrefirstHeroClass,
	conversationLensInboxQueueEditingTag,
	conversationLensInboxQueuePause,
} from '../../browser/conversationLensDockStrings.js';
import { conversationLensDockAgentUnavailable, conversationLensDockModelFailed, conversationLensDockModelUnavailable, conversationLensDockPermissionUnavailable } from '../../browser/conversationLensComposerChrome.js';
import {
	conversationLensSessionBarConversationTab,
	conversationLensSessionBarDeleteSession,
	conversationLensSessionBarNewSession,
	conversationLensSessionBarNoTrajectory,
	conversationLensSessionBarRenameTitle,
	conversationLensSessionBarTrajectoryTab,
	conversationLensPinnedUserPromptAria,
	conversationLensPinnedUserPromptCopyAria,
	conversationLensTurnCopy,
	conversationLensTurnDelete,
} from '../../browser/conversationLensSessionBarStrings.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';
import { entriesToLegacyTurns, projectSnapshotToEntries } from '../../browser/conversationSessionView.js';
import { TestConversationFrameSource } from './testConversationFrameSource.js';
import { conversationIdentityStripClass } from '../../browser/conversationIdentityStrip.js';
import { getConversationSessionStatusText } from '../../browser/conversationSessionStatus.js';
import { shouldRenderTurnAsMarkdown } from '../../browser/conversationTurnMarkdown.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IStorageService, StorageScope } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { IWebviewService } from '../../../webview/browser/webview.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { flushConversationLensLayout, installConversationLensResizeObserverHarness, yieldConversationLensPaint } from './conversationLensLayoutHarness.js';
import { getWindow } from '../../../../../base/browser/dom.js';

suite('ConversationLens', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const lensSlotsByPart = new WeakMap<ConversationPart, IConversationLensSlots>();

	installConversationLensResizeObserverHarness();

	function getLensSlots(part: ConversationPart): IConversationLensSlots {
		const slots = lensSlotsByPart.get(part);
		assert.ok(slots);
		return slots;
	}

	async function flushTimelineHeightUpdates(): Promise<void> {
		await flushConversationLensLayout();
	}

	async function flushAnimationFrames(): Promise<void> {
		await flushConversationLensLayout();
	}

	async function inflateTimelineRowHeights(lens: ConversationLens, layout: () => void, rowHeight = 400): Promise<void> {
		const timelineTree = getTimelineTree(lens);
		const internal = timelineTree as unknown as {
			turnItems: Map<string, object>;
			safeUpdateElementHeight: (item: object, height: number) => void;
		};
		for (const item of internal.turnItems.values()) {
			internal.safeUpdateElementHeight(item, rowHeight);
		}
		layout();
		await flushAnimationFrames();
		await flushTimelineHeightUpdates();
	}

	teardown(async () => {
		await flushConversationLensLayout();
	});

	const LENS_LAYOUT_WIDTH = 640;
	const LENS_LAYOUT_HEIGHT = 480;
	const LENS_MIN_WIDTH = 300;

	function getLensTab(slots: IConversationLensSlots, lensId: 'conversation' | 'trajectory'): HTMLButtonElement {
		const tabHost = slots.sessionBar ?? slots.lensTablist;
		assert.ok(tabHost);
		const tab = tabHost.querySelector(`button.conversation-lens-lens-tab[data-lens-id="${lensId}"]`) as HTMLButtonElement | null;
		assert.ok(tab);
		return tab;
	}

	function clickLensTab(slots: IConversationLensSlots, lensId: 'conversation' | 'trajectory'): void {
		getLensTab(slots, lensId).click();
	}

	function getReadingColumn(slots: IConversationLensSlots): HTMLElement {
		const column = slots.timeline.querySelector('.conversation-lens-reading-column');
		assert.ok(column);
		return column as HTMLElement;
	}

	function getTimelineScroll(slots: IConversationLensSlots): HTMLElement {
		const scroll = slots.timeline.querySelector('.conversation-lens-timeline-scroll');
		assert.ok(scroll);
		return scroll as HTMLElement;
	}

	function getTimelineEmpty(slots: IConversationLensSlots): HTMLElement | null {
		const empty = getTimelineScroll(slots).querySelector<HTMLElement>('.conversation-lens-timeline-empty');
		if (!empty || empty.style.display === 'none') {
			return null;
		}
		return empty;
	}

	async function flushProjectedTimeline(layoutReadingColumn?: () => void): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 20));
		layoutReadingColumn?.();
	}

	async function showVisualizeSeed(stubService: ConversationStubService, layoutReadingColumn: () => void): Promise<void> {
		stubService.switchSession('visualize');
		await flushProjectedTimeline(layoutReadingColumn);
		await flushTimelineHeightUpdates();
	}

	function isRevealedTurnPainted(lens: ConversationLens, turnId: string): boolean {
		const tree = getTimelineTree(lens);
		return !!tree.getTimelineRowElement(turnId)
			|| !!tree.domNode.querySelector(`[data-turn-id="${turnId}"]`)
			|| !!tree.domNode.querySelector(`[data-fold-id="${turnId}"]`);
	}

	function restoreDelegateRowHeights(lens: ConversationLens): void {
		const internal = getTimelineTree(lens) as unknown as {
			turnItems: Map<string, { variant?: string }>;
			safeUpdateElementHeight: (item: object, height: number) => void;
		};
		const seen = new Set<object>();
		for (const item of internal.turnItems.values()) {
			if (seen.has(item)) {
				continue;
			}
			seen.add(item);
			internal.safeUpdateElementHeight(item, item.variant === 'process-fold' ? 40 : 72);
		}
	}

	async function revealVisualizeTurn(lens: ConversationLens, layoutReadingColumn: () => void, turnId: string): Promise<void> {
		// Layout first so ListView has a real viewport, then reveal. Leftover
		// reveal-then-await-rAF hung on merge transpile: Electron mocha can
		// stall requestAnimationFrame (no vsync / height-update rAF storm),
		// so mocha hit Timeout of 5000ms. A stalled rAF can also write 1px
		// dynamic heights (offsetHeight 0) and unpaint every virtual row.
		// Restore delegate defaults and yield with setTimeout — not rAF.
		// Stop after a few tries so a missing row fails the product assert.
		const tree = getTimelineTree(lens);
		await new Promise<void>(resolve => setTimeout(resolve, 16));
		layoutReadingColumn();
		tree.revealTurn(turnId, 0);
		layoutReadingColumn();
		if (isRevealedTurnPainted(lens, turnId)) {
			return;
		}
		restoreDelegateRowHeights(lens);
		layoutReadingColumn();
		tree.revealTurn(turnId, 0);
		layoutReadingColumn();
		for (let attempt = 0; attempt < 4; attempt++) {
			if (isRevealedTurnPainted(lens, turnId)) {
				return;
			}
			await new Promise<void>(resolve => setTimeout(resolve, 16));
			restoreDelegateRowHeights(lens);
			layoutReadingColumn();
			tree.revealTurn(turnId, 0);
			layoutReadingColumn();
		}
	}

	async function revealUntitledProcessFold(lens: ConversationLens, layoutReadingColumn: () => void): Promise<void> {
		await revealVisualizeTurn(lens, layoutReadingColumn, 'untitled-t1');
	}

	async function revealLatestTurn(
		lens: ConversationLens,
		stubService: ConversationStubService,
		layoutReadingColumn: () => void,
		match: (turn: { kind: string; text: string; stubEcho?: boolean }) => boolean,
	): Promise<string> {
		const turn = [...stubService.getTurns(stubService.getActiveSessionId())].reverse().find(match);
		assert.ok(turn);
		await revealVisualizeTurn(lens, layoutReadingColumn, turn.id);
		return turn.id;
	}

	function scrollTimelineToEndWithoutClobber(lens: ConversationLens): void {
		getTimelineTree(lens).scrollToEnd();
	}

	function queryTimeline(slots: IConversationLensSlots, selector: string): Element | null {
		return slots.timeline.querySelector(selector);
	}

	function queryAllTimeline(slots: IConversationLensSlots, selector: string): NodeListOf<Element> {
		return slots.timeline.querySelectorAll(selector);
	}

	function getTimelineTree(lens: ConversationLens): ConversationTimelineTree {
		return (lens as unknown as { timelineTree: ConversationTimelineTree }).timelineTree;
	}

	function getTrajectoryView(lens: ConversationLens): ConversationTrajectory {
		return (lens as unknown as { trajectoryView: ConversationTrajectory }).trajectoryView;
	}

	function countTrajectoryRecordRows(slots: IConversationLensSlots): number {
		return slots.timeline.querySelectorAll('.conversation-lens-trajectory-record-row').length;
	}

	function isPinnedUserPromptPainted(slots: IConversationLensSlots, expectedPreview?: string): boolean {
		const host = getPinnedUserPrompt(slots);
		if (!host?.classList.contains('conversation-timeline-pinned-user--visible')) {
			return false;
		}
		const preview = host.querySelector('.conversation-timeline-pinned-user-text')?.textContent ?? '';
		return expectedPreview === undefined ? preview.length > 0 : preview === expectedPreview;
	}

	async function paintTrajectoryRows(
		lens: ConversationLens,
		slots: IConversationLensSlots,
		stubService: ConversationStubService,
		layout: () => void,
		expectedCount: number,
	): Promise<void> {
		const view = getTrajectoryView(lens);
		const recordIds = stubService.getTurns(stubService.getActiveSessionId()).map(turn => turn.id);
		await yieldConversationLensPaint();
		layout();
		for (const recordId of recordIds) {
			view.revealRecord(recordId);
		}
		layout();
		if (countTrajectoryRecordRows(slots) === expectedCount) {
			return;
		}
		for (let attempt = 0; attempt < 4; attempt++) {
			if (countTrajectoryRecordRows(slots) === expectedCount) {
				return;
			}
			await yieldConversationLensPaint();
			layout();
			for (const recordId of recordIds) {
				view.revealRecord(recordId);
			}
			layout();
		}
	}

	async function scrollTimelineAwayFromPinnedRead(lens: ConversationLens, slots: IConversationLensSlots, layout: () => void, rowHeight = 400): Promise<void> {
		const timelineTree = getTimelineTree(lens);
		const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
		assert.ok(assistantTurn);
		const turnId = assistantTurn!.getAttribute('data-turn-id');
		assert.ok(turnId);

		// Layout first, then reveal the assistant row so the user prompt leaves
		// the virtual window. Bounded setTimeout — not rAF — so Electron mocha
		// without vsync still paints the sticky preview instead of hanging.
		for (let attempt = 0; attempt < 4; attempt++) {
			await yieldConversationLensPaint();
			layout();
			await inflateTimelineRowHeights(lens, layout, rowHeight + attempt * 40);
			timelineTree.setScrollLock(false);
			layout();
			timelineTree.revealTurn(turnId!, 0);
			layout();
			if (!timelineTree.isScrolledToBottom() && isPinnedUserPromptPainted(slots)) {
				return;
			}
		}
		assert.fail('could not scroll timeline away from bottom');
	}

	function getPinnedUserPrompt(slots: IConversationLensSlots): HTMLElement | null {
		return queryTimeline(slots, '.conversation-timeline-pinned-user') as HTMLElement | null;
	}

	function getPinnedUserPromptBubble(slots: IConversationLensSlots): HTMLButtonElement | null {
		return queryTimeline(slots, '.conversation-timeline-pinned-user-bubble') as HTMLButtonElement | null;
	}

	function layoutReadingColumn(lens: ConversationLens, slots: IConversationLensSlots, layoutWidth = LENS_LAYOUT_WIDTH, layoutHeight = LENS_LAYOUT_HEIGHT): void {
		const readingColumn = slots.timeline.querySelector('.conversation-lens-reading-column') as HTMLElement | null;
		const timelineScroll = slots.timeline.querySelector('.conversation-lens-timeline-scroll') as HTMLElement | null;
		const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
		const treeContainer = slots.timeline.querySelector('.conversation-timeline-tree') as HTMLElement | null;
		if (readingColumn) {
			readingColumn.style.width = `${layoutWidth}px`;
			readingColumn.style.height = `${layoutHeight}px`;
		}
		if (timelineScroll) {
			timelineScroll.style.height = `${layoutHeight - 120}px`;
			timelineScroll.style.minHeight = `${layoutHeight - 120}px`;
		}
		if (contentHost) {
			contentHost.style.display = '';
			contentHost.style.minHeight = `${layoutHeight - 120}px`;
		}
		if (treeContainer) {
			treeContainer.style.height = `${layoutHeight - 120}px`;
		}
		const trajectoryHost = slots.timeline.querySelector('.conversation-lens-trajectory') as HTMLElement | null;
		const trajectoryScroll = slots.timeline.querySelector('.conversation-lens-trajectory-table-scroll') as HTMLElement | null;
		if (trajectoryHost) {
			trajectoryHost.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
			trajectoryHost.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
		}
		if (trajectoryScroll) {
			trajectoryScroll.style.height = `${LENS_LAYOUT_HEIGHT - 200}px`;
			trajectoryScroll.style.minHeight = `${LENS_LAYOUT_HEIGHT - 200}px`;
		}
		// Part sessionBar measures clientWidth before applying is-narrow / is-compact.
		if (slots.sessionBar) {
			slots.sessionBar.style.width = `${layoutWidth}px`;
			slots.sessionBar.style.minWidth = `${layoutWidth}px`;
		}
		const timelineHeight = layoutHeight - 120;
		lens.layout(timelineHeight, layoutWidth);
	}

	function getPrefirstHero(slots: IConversationLensSlots): HTMLElement | null {
		return getReadingColumn(slots).querySelector(`.${conversationLensPrefirstHeroClass}`) as HTMLElement | null;
	}

	function countComposers(slots: IConversationLensSlots): number {
		return slots.timeline.querySelectorAll('.conversation-lens-composer').length
			+ slots.dock.querySelectorAll('.conversation-lens-composer').length;
	}

	function getInboxOverlay(slots: IConversationLensSlots): HTMLElement {
		const overlay = slots.dock.querySelector('.conversation-lens-inbox-overlay');
		assert.ok(overlay);
		return overlay as HTMLElement;
	}

	function getInboxQueueChip(slots: IConversationLensSlots): HTMLButtonElement {
		const chip = getInboxOverlay(slots).querySelector('.conversation-lens-inbox-queue') as HTMLButtonElement | null;
		assert.ok(chip);
		return chip;
	}

	function getVisibleInboxListPanel(): HTMLElement | null {
		for (const panel of document.querySelectorAll<HTMLElement>('.conversation-lens-inbox-list-panel')) {
			const host = panel.closest('.context-view') as HTMLElement | null;
			if (!host || host.style.display !== 'none') {
				return panel;
			}
		}
		return null;
	}

	function getInboxGoalButton(slots: IConversationLensSlots): HTMLElement {
		const button = slots.dock.querySelector('.conversation-lens-inbox-goal .conversation-lens-inbox-goal-button');
		assert.ok(button);
		return button as HTMLElement;
	}

	function getInboxStopButton(slots: IConversationLensSlots): HTMLElement {
		const button = slots.dock.querySelector('.conversation-lens-inbox-stop .conversation-lens-inbox-stop-button');
		assert.ok(button);
		return button as HTMLElement;
	}

	function getComposerBottomBar(slots: IConversationLensSlots): HTMLElement {
		const bottomBar = (slots.dock.querySelector('.conversation-lens-dock-bottom-bar')
			?? getReadingColumn(slots).querySelector('.conversation-lens-dock-bottom-bar')) as HTMLElement | null;
		assert.ok(bottomBar);
		return bottomBar;
	}

	function getPermissionSelect(slots: IConversationLensSlots): HTMLSelectElement {
		const select = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-permission select.monaco-select-box') as HTMLSelectElement | null;
		assert.ok(select);
		return select;
	}

	function getModelSelect(slots: IConversationLensSlots): HTMLSelectElement {
		const select = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-model select.monaco-select-box') as HTMLSelectElement | null;
		assert.ok(select);
		return select;
	}

	function getAgentSelect(slots: IConversationLensSlots): HTMLSelectElement {
		const select = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-agent select.monaco-select-box') as HTMLSelectElement | null;
		assert.ok(select);
		return select;
	}

	function assertDisconnectedComposerCatalogsHonest(slots: IConversationLensSlots): void {
		const agentSelect = getAgentSelect(slots);
		const modelSelect = getModelSelect(slots);
		assert.strictEqual(agentSelect.options.length, 1);
		assert.strictEqual(agentSelect.options[0]?.text, conversationLensDockNoAgent);
		assert.ok(![...agentSelect.options].some(option => option.text === 'Stub agent'));
		assert.strictEqual(modelSelect.options.length, 1);
		assert.strictEqual(modelSelect.options[0]?.text, conversationLensDockNoModel);
		assert.ok(![...modelSelect.options].some(option => option.text === 'Stub model'));
	}

	async function waitForModelOption(slots: IConversationLensSlots, text: string): Promise<void> {
		for (let i = 0; i < 16; i++) {
			if ([...getModelSelect(slots).options].some(option => option.text === text)) {
				return;
			}
			await Promise.resolve();
		}
		assert.fail(`model option "${text}" did not load`);
	}

	function getDockSendButton(slots: IConversationLensSlots): HTMLButtonElement {
		const button = (slots.dock.querySelector('.conversation-lens-dock-send .monaco-button')
			?? getReadingColumn(slots).querySelector('.conversation-lens-dock-send .monaco-button')) as HTMLButtonElement | null;
		assert.ok(button);
		return button;
	}

	function selectDockModel(slots: IConversationLensSlots, optionIndex: number): void {
		const bottomBar = getComposerBottomBar(slots);
		const modelSelect = bottomBar.querySelector('.conversation-lens-dock-model select.monaco-select-box') as HTMLSelectElement | null;
		assert.ok(modelSelect);
		modelSelect.selectedIndex = optionIndex;
		modelSelect.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
	}

	function getDockTextarea(slots: IConversationLensSlots): HTMLTextAreaElement {
		const textarea = (slots.dock.querySelector('textarea.conversation-lens-dock-input')
			?? getReadingColumn(slots).querySelector('textarea.conversation-lens-dock-input')) as HTMLTextAreaElement | null;
		assert.ok(textarea);
		return textarea;
	}

	async function sendDockDraft(slots: IConversationLensSlots, message: string): Promise<void> {
		const textarea = getDockTextarea(slots);
		const sendButton = getDockSendButton(slots);
		textarea.value = message;
		textarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		sendButton.click();
		await Promise.resolve();
		// Stub echo is scheduled with setTimeout(0); wait so getTurns() includes durable rows.
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	async function sendDockDraftAndFlush(slots: IConversationLensSlots, message: string, layoutReadingColumn?: () => void): Promise<void> {
		await sendDockDraft(slots, message);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		layoutReadingColumn?.();
		await flushTimelineHeightUpdates();
	}

	function dispatchDockKeydown(textarea: HTMLTextAreaElement, keyCode: KeyCode): void {
		const domKeyCodeByVsCode: Partial<Record<KeyCode, number>> = {
			[KeyCode.Enter]: 13,
			[KeyCode.Escape]: 27,
			[KeyCode.UpArrow]: 38,
			[KeyCode.DownArrow]: 40,
			[KeyCode.Space]: 32,
		};
		const domKeyCode = domKeyCodeByVsCode[keyCode];
		assert.ok(domKeyCode !== undefined, `missing DOM keyCode mapping for ${keyCode}`);
		textarea.dispatchEvent(new KeyboardEvent('keydown', { keyCode: domKeyCode, bubbles: true, cancelable: true }));
	}

	function getSessionSelectLabel(slots: IConversationLensSlots): string | undefined {
		const select = slots.sessionBar!.querySelector('.conversation-lens-session-select select.monaco-select-box') as HTMLSelectElement | null;
		if (!select || select.options.length === 0) {
			return undefined;
		}
		return select.options[select.selectedIndex]?.text;
	}

	function mountLens(options?: { storageService?: TestStorageService; layoutWidth?: number; layoutHeight?: number; connection?: IUniverseAgentConnection; stubService?: ConversationStubService; sessionKey?: string; tablistOnly?: boolean }): { part: ConversationPart; lens: ConversationLens; stubService: ConversationStubService; clipboardService: TestClipboardService; storageService: TestStorageService; layoutReadingColumn: () => void; openInEditorCalls: { count: number }; layoutContainer: HTMLElement } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const storageService = options?.storageService ?? store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		const stubService = options?.stubService ?? store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		const openInEditorCalls = { count: 0 };
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IUniverseAgentConnection, options?.connection ?? createConversationConnectionTestStub());
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => { },
		});
		instantiationService.stub(IConversationReviewNavService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getReviewNavForSession: () => [],
		});
		instantiationService.stub(IClipboardService, clipboardService);
		instantiationService.stub(ICommandService, new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand(id: string) {
				if (id === '_mermaid-markdown.openInEditor') {
					openInEditorCalls.count++;
				}
				return Promise.resolve(undefined);
			}
		}());
		instantiationService.stub(IExtensionService, {
			_serviceBrand: undefined,
			getExtension: () => Promise.resolve(undefined),
		} as unknown as IExtensionService);
		instantiationService.stub(IWebviewService, {
			_serviceBrand: undefined,
			activeWebview: undefined,
			webviews: [],
			onDidChangeActiveWebview: Event.None,
			createWebviewOverlay: () => { throw new Error('not used'); },
			createWebviewElement: () => ({
				mountTo(parent: HTMLElement) {
					const el = document.createElement('div');
					el.setAttribute('data-mermaid-host', 'stub');
					parent.appendChild(el);
				},
				setHtml() { },
				postMessage: () => Promise.resolve(true),
				onDidWheel: Event.None,
				onFatalError: Event.None,
				intrinsicContentSize: observableValue('intrinsicContentSize', undefined),
				dispose() { },
			}),
		} as unknown as IWebviewService);
		// Product selectors are `.monaco-workbench .part.conversation …` (descendant).
		// Overlay host is `timeline.closest('.part.conversation')`. Same ancestor
		// chain as conversationIdentityStrip.test.ts — do not stack both classes
		// on one node, and do not park layoutService.getContainer on a sibling.
		const layoutContainer = document.createElement('div');
		layoutContainer.classList.add('monaco-workbench');
		const parent = document.createElement('div');
		parent.classList.add('part', 'conversation');
		const layoutWidth = options?.layoutWidth ?? LENS_LAYOUT_WIDTH;
		const layoutHeight = options?.layoutHeight ?? LENS_LAYOUT_HEIGHT;
		parent.style.width = `${layoutWidth}px`;
		parent.style.height = `${layoutHeight}px`;
		layoutContainer.appendChild(parent);
		document.body.appendChild(layoutContainer);
		store.add(toDisposable(() => layoutContainer.remove()));
		// IWorkbenchLayoutService shares this decorator: Part registers itself and ConversationPart.layout
		// asks isVisible(), so a bare { getContainer } stub is not enough.
		const layoutService = new TestLayoutService();
		layoutService.getContainer = () => layoutContainer;
		instantiationService.stub(ILayoutService, layoutService);
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
		part.create(parent);
		const partSlots = part.getSlots();
		assert.ok(partSlots);
		const lensTablist = document.createElement('div');
		const slots: IConversationLensSlots = {
			sessionBar: options?.tablistOnly ? undefined : partSlots.sessionBar,
			lensTablist: options?.tablistOnly ? lensTablist : undefined,
			timeline: document.createElement('div'),
			dock: document.createElement('div'),
			sessionKey: options?.sessionKey,
		};
		slots.timeline.classList.add('conversation-timeline', 'part', 'conversation');
		slots.dock.classList.add('conversation-dock');
		if (slots.lensTablist) {
			parent.appendChild(slots.lensTablist);
		}
		parent.appendChild(slots.timeline);
		parent.appendChild(slots.dock);
		part.layout(layoutWidth, layoutHeight, 0, 0);
		const layoutCallbacks: Array<() => void> = [];
		const runLayouts = () => {
			for (const layout of layoutCallbacks) {
				layout();
			}
		};
		store.add(stubService.onDidChangeSession(() => runLayouts()));
		store.add(stubService.onDidChangeActiveSession(() => runLayouts()));
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		lensSlotsByPart.set(part, slots);
		const layout = () => layoutReadingColumn(lens, slots, layoutWidth, layoutHeight);
		layoutCallbacks.push(layout);
		layout();
		const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
		if (contentHost) {
			contentHost.style.display = '';
		}
		layout();
		return { part, lens, stubService, clipboardService, storageService, layoutReadingColumn: layout, openInEditorCalls, layoutContainer };
	}

	async function seedPendingConfirmation(stubService: ConversationStubService, layoutReadingColumn: () => void, message = 'Write README.md?'): Promise<string> {
		const sessionId = stubService.createSession();
		stubService.appendUserTurn(sessionId, 'Help me scaffold the project README.');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		stubService.appendConfirmationTurn(sessionId, message);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		return sessionId;
	}

	function userMessageLines(lineCount: number): string {
		return Array.from({ length: lineCount }, (_, index) => `User line ${index + 1}`).join('\n');
	}

	function getUserTurnBody(slots: IConversationLensSlots): HTMLElement {
		const body = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body');
		assert.ok(body);
		return body as HTMLElement;
	}

	function getUserFoldButton(slots: IConversationLensSlots): HTMLButtonElement | null {
		return queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-fold-button') as HTMLButtonElement | null;
	}

	test('short user turn does not show Show more control', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.appendUserTurn(sessionId, userMessageLines(2));
		await flushProjectedTimeline(layoutReadingColumn);

		assert.strictEqual(getUserFoldButton(slots), null);
		assert.strictEqual(getUserTurnBody(slots).classList.contains('conversation-lens-turn-body--collapsed'), false);
	});

	test('long user turn collapses with Show more and full-text title', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const message = userMessageLines(8);
		stubService.appendUserTurn(sessionId, message);
		await flushProjectedTimeline(layoutReadingColumn);

		const body = getUserTurnBody(slots);
		const foldButton = getUserFoldButton(slots);

		assert.ok(body.classList.contains('conversation-lens-turn-body--collapsed'));
		assert.ok(foldButton);
		assert.strictEqual(foldButton!.textContent, conversationLensUserBubbleShowMore);
		assert.strictEqual(body.getAttribute('title'), message);

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')!;
		const fold = userTurn.querySelector('.conversation-lens-turn-fold');
		assert.ok(fold);
		assert.strictEqual(userTurn.querySelector('.conversation-lens-turn-actions'), null);
	});

	test('Show more expands user bubble and Show less collapses it again', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.appendUserTurn(sessionId, userMessageLines(8));
		await flushProjectedTimeline(layoutReadingColumn);

		const body = getUserTurnBody(slots);
		const foldButton = getUserFoldButton(slots)!;

		foldButton.click();
		await flushProjectedTimeline(layoutReadingColumn);

		assert.strictEqual(body.classList.contains('conversation-lens-turn-body--collapsed'), false);
		assert.strictEqual(foldButton.textContent, conversationLensUserBubbleShowLess);
		assert.strictEqual(foldButton.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(body.getAttribute('title'), null);

		foldButton.click();
		await flushProjectedTimeline(layoutReadingColumn);

		assert.ok(body.classList.contains('conversation-lens-turn-body--collapsed'));
		assert.strictEqual(foldButton.textContent, conversationLensUserBubbleShowMore);
		assert.strictEqual(foldButton.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(body.getAttribute('title'), userMessageLines(8));
	});

	test('long assistant stub echo does not get user bubble collapse chrome', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.appendStubEchoAssistant(sessionId, userMessageLines(8));
		await flushProjectedTimeline(layoutReadingColumn);

		const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
		assert.ok(assistantTurn);
		assert.strictEqual(assistantTurn.querySelector('.conversation-lens-turn-fold'), null);
		assert.strictEqual(assistantTurn.querySelector('.conversation-lens-turn-body--collapsed'), null);
	});

	test('default session shows seeded untitled fixture without fake engine history', async () => {
		const { part, stubService, lens, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const pendingButton = slots.dock.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.strictEqual(stubService.getSessions().length, 2);
		assert.strictEqual(stubService.getTurns(stubService.getActiveSessionId()).length, 7);
		assert.strictEqual(getTimelineEmpty(slots), null);
		await revealUntitledProcessFold(lens, layoutReadingColumn);
		assert.ok(queryTimeline(slots, '[data-process-fold]'));
		await revealVisualizeTurn(lens, layoutReadingColumn, 'untitled-u1');
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
		await revealVisualizeTurn(lens, layoutReadingColumn, 'untitled-c1');
		assert.ok(queryTimeline(slots, '.conversation-lens-confirmation-seat'));
		assert.ok(pendingButton);
		assert.ok(!pendingButton.hidden);
	});

	test('fills SessionBar, stub timeline, and stub dock slots', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-bar'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-select'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-history'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-snapshots'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-lens-tab[data-lens-id="trajectory"]'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-trajectory'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-gate-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-inbox-overlay'));
		assert.ok(slots.dock.querySelector('textarea.conversation-lens-dock-input'));
	});

	test('exposes Agent IDE chrome landmarks', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);

		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-icon'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-title'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-lens-tabs[role="tablist"]'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-switcher-label'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-history'));
		assert.ok(slots.sessionBar!.querySelector('.conversation-lens-session-snapshots'));
		assert.ok(getReadingColumn(slots));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline-scroll'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline-content'));
		assert.ok(slots.dock.querySelector('.conversation-lens-composer'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-input-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-bottom-bar'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-send'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-gate-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-model'));
		assert.strictEqual(slots.dock.querySelector('.conversation-lens-inbox-task'), null);
		assert.ok(slots.dock.querySelector('.conversation-lens-inbox-queue'));
	});

	test('compact chrome: scroll region is timeline inner scroll only', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const timelineSlot = slots.timeline;

		assert.ok(timelineSlot.querySelector('.conversation-lens-timeline-scroll'));
		assert.strictEqual(timelineSlot.classList.contains('conversation-timeline'), true);
		assert.ok(!timelineSlot.querySelector('.conversation-lens-dock'));
	});

	test('compact chrome: dock composer textarea with bottom bar send', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		const inputRow = slots.dock.querySelector('.conversation-lens-dock-input-row')!;
		const bottomBar = slots.dock.querySelector('.conversation-lens-dock-bottom-bar')!;
		const sendButton = bottomBar.querySelector('.conversation-lens-dock-send .monaco-button');

		assert.strictEqual(textarea.rows, 1);
		assert.strictEqual(textarea.placeholder, conversationLensDockPlaceholder);
		assert.ok(inputRow.contains(textarea));
		assert.ok(sendButton);
		assert.ok(bottomBar.contains(sendButton!.parentElement!));
		assert.ok(!inputRow.querySelector('.conversation-lens-dock-send'));
	});

	test('T2 composer chrome: 32px bottom bar with tune permission model more send codicons', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const bottomBar = getComposerBottomBar(slots);

		const bottomBarMinHeight = parseInt(getWindow(bottomBar).getComputedStyle(bottomBar).minHeight, 10);
		if (bottomBarMinHeight > 0) {
			assert.strictEqual(bottomBarMinHeight, conversationLensDockControlHeightPx);
		}

		const leading = bottomBar.querySelector('.conversation-lens-dock-bottom-leading')!;
		const trailing = bottomBar.querySelector('.conversation-lens-dock-bottom-trailing')!;
		assert.strictEqual(leading.querySelector('.conversation-lens-dock-add'), null);
		assert.ok(leading.querySelector('.conversation-lens-dock-tune .codicon-settings-gear'));
		assert.ok(leading.querySelector('.conversation-lens-dock-permission .monaco-select-box'));
		assert.ok(leading.querySelector('.conversation-lens-dock-more .codicon-ellipsis'));
		assert.ok(trailing.querySelector('.conversation-lens-dock-model .monaco-select-box'));
		assert.strictEqual(trailing.querySelector('.conversation-lens-dock-templates'), null);
		assert.ok(trailing.querySelector('.conversation-lens-dock-maximize-input .codicon-screen-full'));
		assert.strictEqual(trailing.querySelector('.conversation-lens-dock-mic'), null);
		assert.ok(trailing.querySelector('.conversation-lens-dock-send .codicon-arrow-up'));

		const ghostTune = leading.querySelector('.conversation-lens-dock-tune .monaco-button') as HTMLElement;
		const filledSend = trailing.querySelector('.conversation-lens-dock-send .monaco-button') as HTMLElement;
		assert.ok(ghostTune.classList.contains('conversation-lens-dock-control--ghost'));
		assert.ok(filledSend.classList.contains('conversation-lens-dock-control--filled'));

		for (const control of bottomBar.querySelectorAll('.conversation-lens-dock-control')) {
			const controlElement = control as HTMLElement;
			const height = parseInt(getWindow(controlElement).getComputedStyle(controlElement).height, 10);
			if (height > 0) {
				assert.strictEqual(height, conversationLensDockControlHeightPx);
			}
		}

		const tuneButton = leading.querySelector('.conversation-lens-dock-tune .monaco-button') as HTMLButtonElement;
		assert.strictEqual(tuneButton.getAttribute('aria-label'), conversationLensDockTuneTitle);
		assert.strictEqual(leading.querySelector('.conversation-lens-dock-route'), null);

		const permissionSelect = leading.querySelector('.conversation-lens-dock-permission select.monaco-select-box') as HTMLSelectElement;
		const modelSelect = trailing.querySelector('.conversation-lens-dock-model select.monaco-select-box') as HTMLSelectElement;
		assert.strictEqual(permissionSelect.options[permissionSelect.selectedIndex]?.text, conversationLensDockPermissionAsk);
		assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, conversationLensDockNoModel);
		assertDisconnectedComposerCatalogsHonest(slots);

		const sendButton = getDockSendButton(slots);
		assert.strictEqual(sendButton.classList.contains('disabled'), true);
		const textarea = getDockTextarea(slots);
		textarea.value = 'hello';
		textarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		assert.strictEqual(sendButton.classList.contains('disabled'), false);
	});

	test('permission select is disabled until the engine can setPermissionMode', () => {
		const connection = createConversationConnectionTestStub({
			setPermissionMode: async () => ({ ok: true }),
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		const permissionSelect = getPermissionSelect(slots);
		const permissionContainer = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-permission') as HTMLElement;

		assert.strictEqual(permissionSelect.disabled, true);
		assert.strictEqual(permissionSelect.getAttribute('aria-label'), `${conversationLensDockPermissionLabel} — ${conversationLensDockPermissionUnavailable}`);
		assert.strictEqual(permissionContainer.title, conversationLensDockPermissionUnavailable);

		stubService.setEngineConnected(true);

		assert.strictEqual(permissionSelect.disabled, false);
		assert.strictEqual(permissionSelect.getAttribute('aria-label'), conversationLensDockPermissionLabel);
		assert.strictEqual(permissionContainer.title, conversationLensDockPermissionLabel);
	});

	test('agent select is disabled without SwitchAgent and does not write agentIndex', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			getCapabilitySnapshot: () => ({
				...capabilities,
				agentProfiles: { support: 'SUPPORTED' },
			}),
			listAgentProfiles: async () => ({ profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] }),
		});
		const { part, stubService, lens } = mountLens({ connection });
		const slots = getLensSlots(part);
		const sessionId = stubService.getActiveSessionId();
		const agentSelect = getAgentSelect(slots);
		const agentContainer = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-agent') as HTMLElement;

		assert.strictEqual(agentSelect.disabled, true);
		assert.strictEqual(agentSelect.getAttribute('aria-label'), `${conversationLensDockAgentLabel} — ${conversationLensDockAgentUnavailable}`);
		assert.strictEqual(agentContainer.title, conversationLensDockAgentUnavailable);
		assert.strictEqual(lens.getSessionConfig(sessionId).agentIndex, 0);

		stubService.setEngineConnected(true);
		for (let i = 0; i < 8; i++) {
			await Promise.resolve();
		}
		assert.ok([...agentSelect.options].some(option => option.text === 'Coder'));
		assert.strictEqual(agentSelect.disabled, true);
		const coderIndex = [...agentSelect.options].findIndex(option => option.text === 'Coder');
		assert.ok(coderIndex >= 0);
		agentSelect.selectedIndex = coderIndex;
		agentSelect.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
		assert.strictEqual(lens.getSessionConfig(sessionId).agentIndex, 0);
		assert.strictEqual(agentSelect.selectedIndex, 0);
	});

	test('model select is disabled until the engine can switchModel', () => {
		const connection = createConversationConnectionTestStub({
			switchModel: async () => ({ resolvedModelId: 'gpt-test', provider: '', level: 0, cost: '', speed: '' }),
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		const modelSelect = getModelSelect(slots);
		const modelContainer = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-model') as HTMLElement;

		assert.strictEqual(modelSelect.disabled, true);
		assert.strictEqual(modelSelect.getAttribute('aria-label'), `Model — ${conversationLensDockModelUnavailable}`);
		assert.strictEqual(modelContainer.title, conversationLensDockModelUnavailable);

		stubService.setEngineConnected(true);

		assert.strictEqual(modelSelect.disabled, false);
		assert.strictEqual(modelSelect.getAttribute('aria-label'), 'Model');
		assert.strictEqual(modelContainer.title, 'Model');
	});

	test('model select does not keep a new index without switchModel', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			getCapabilitySnapshot: () => ({
				...capabilities,
				models: { support: 'SUPPORTED' },
			}),
			listModels: async () => ({ models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] }),
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		stubService.setEngineConnected(true);
		await waitForModelOption(slots, 'gpt-test');

		selectDockModel(slots, 1);
		await Promise.resolve();

		assert.strictEqual(getModelSelect(slots).selectedIndex, 0);
		assert.strictEqual(getModelSelect(slots).options[getModelSelect(slots).selectedIndex]?.text, conversationLensDockNoModel);
	});

	test('permission select rolls back and shows the gate when setPermissionMode fails', async () => {
		const calls: { sessionId: string; mode: string }[] = [];
		const connection = createConversationConnectionTestStub({
			setPermissionMode: async request => {
				calls.push(request);
				return { ok: false, message: 'engine rejected permit' };
			},
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		stubService.setEngineConnected(true);

		const permissionSelect = getPermissionSelect(slots);
		assert.strictEqual(permissionSelect.disabled, false);
		assert.strictEqual(permissionSelect.options[permissionSelect.selectedIndex]?.text, conversationLensDockPermissionAsk);

		permissionSelect.selectedIndex = 2;
		permissionSelect.dispatchEvent(new globalThis.Event('change', { bubbles: true }));
		await Promise.resolve();

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].mode, 'SESSION_TOOL_PERMISSION_MODE_PERMIT');
		assert.strictEqual(permissionSelect.selectedIndex, 0);
		assert.strictEqual(permissionSelect.options[permissionSelect.selectedIndex]?.text, conversationLensDockPermissionAsk);
		const gateRow = slots.dock.querySelector('.conversation-lens-dock-gate-row') as HTMLElement;
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes('engine rejected permit'));
	});

	test('model select does not call switchModel until the engine is connected', async () => {
		const calls: { sessionId: string; modelId: string }[] = [];
		const connection = createConversationConnectionTestStub({
			switchModel: async request => {
				calls.push({ sessionId: request.sessionId, modelId: request.modelId });
				return { resolvedModelId: request.modelId, provider: '', level: 0, cost: '', speed: '' };
			},
		});
		const { part } = mountLens({ connection });
		const slots = getLensSlots(part);
		assertDisconnectedComposerCatalogsHonest(slots);

		selectDockModel(slots, 0);
		await Promise.resolve();

		assert.strictEqual(calls.length, 0);
		assert.strictEqual(getModelSelect(slots).selectedIndex, 0);
		assert.strictEqual(getModelSelect(slots).options.length, 1);
	});

	test('model select writes sessionId and modelId when switchModel is available', async () => {
		const calls: { sessionId: string; modelId: string }[] = [];
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			getCapabilitySnapshot: () => ({
				...capabilities,
				models: { support: 'SUPPORTED' },
			}),
			listModels: async () => ({ models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] }),
			switchModel: async request => {
				calls.push({ sessionId: request.sessionId, modelId: request.modelId });
				return { resolvedModelId: request.modelId, provider: 'p', level: 1, cost: '', speed: '' };
			},
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		stubService.setEngineConnected(true);
		await waitForModelOption(slots, 'gpt-test');

		selectDockModel(slots, 1);
		await Promise.resolve();

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].sessionId, stubService.getActiveSessionId());
		assert.strictEqual(calls[0].modelId, 'gpt-test');
		assert.strictEqual(getModelSelect(slots).selectedIndex, 1);
	});

	test('model select rolls back and shows the gate when switchModel fails', async () => {
		const calls: { sessionId: string; modelId: string }[] = [];
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			getCapabilitySnapshot: () => ({
				...capabilities,
				models: { support: 'SUPPORTED' },
			}),
			listModels: async () => ({ models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] }),
			switchModel: async request => {
				calls.push({ sessionId: request.sessionId, modelId: request.modelId });
				throw new Error('engine rejected model');
			},
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		stubService.setEngineConnected(true);
		await waitForModelOption(slots, 'gpt-test');

		const modelSelect = getModelSelect(slots);
		assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, conversationLensDockNoModel);

		selectDockModel(slots, 1);
		await Promise.resolve();

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].modelId, 'gpt-test');
		assert.strictEqual(modelSelect.selectedIndex, 0);
		assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, conversationLensDockNoModel);
		const gateRow = slots.dock.querySelector('.conversation-lens-dock-gate-row') as HTMLElement;
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes('engine rejected model'));
	});

	test('model select rolls back and shows the gate when switchModel resolves with an empty resolvedModelId', async () => {
		const calls: { sessionId: string; modelId: string }[] = [];
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			getCapabilitySnapshot: () => ({
				...capabilities,
				models: { support: 'SUPPORTED' },
			}),
			listModels: async () => ({ models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] }),
			switchModel: async request => {
				calls.push({ sessionId: request.sessionId, modelId: request.modelId });
				return { resolvedModelId: '', provider: '', level: 0, cost: '', speed: '' };
			},
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		stubService.setEngineConnected(true);
		await waitForModelOption(slots, 'gpt-test');

		const modelSelect = getModelSelect(slots);
		assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, conversationLensDockNoModel);

		selectDockModel(slots, 1);
		await Promise.resolve();

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].modelId, 'gpt-test');
		assert.strictEqual(modelSelect.selectedIndex, 0);
		assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, conversationLensDockNoModel);
		const gateRow = slots.dock.querySelector('.conversation-lens-dock-gate-row') as HTMLElement;
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes(conversationLensDockModelFailed));
	});

	test('narrow More permission radios stay disabled without setPermissionMode', () => {
		const { part } = mountLens({ layoutWidth: LENS_MIN_WIDTH });
		const slots = getLensSlots(part);
		const moreButton = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-more .monaco-button') as HTMLButtonElement;
		moreButton.click();

		const radios = [...document.querySelectorAll('.conversation-lens-dock-more-permission [role="menuitemradio"]')] as HTMLButtonElement[];
		assert.strictEqual(radios.length, 3);
		assert.ok(radios.some(radio => radio.textContent === conversationLensDockPermissionPermit));
		for (const radio of radios) {
			assert.strictEqual(radio.disabled, true);
			assert.strictEqual(radio.getAttribute('aria-disabled'), 'true');
			assert.strictEqual(radio.title, conversationLensDockPermissionUnavailable);
		}
	});

	test('disconnected compose enables send from draft without Stub model', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const sendButton = getDockSendButton(slots);
		assert.strictEqual(sendButton.classList.contains('disabled'), true);
		assert.strictEqual(stubService.hasEngineConnectionHistory(), false);
		assertDisconnectedComposerCatalogsHonest(slots);
		const textarea = getDockTextarea(slots);
		textarea.value = 'hello';
		textarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		assert.strictEqual(sendButton.classList.contains('disabled'), false);

		sendButton.click();
		await Promise.resolve();
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const readingColumn = getReadingColumn(slots);
		assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), false, 'first pending must leave PreFirst');
		assert.ok(!/已同步|synced/i.test(slots.dock.textContent ?? ''));
		assert.ok(!/已同步|synced/i.test(slots.sessionBar?.textContent ?? ''));
		assert.ok(!/已同步|synced/i.test(readingColumn.textContent ?? ''));
		assert.ok(stubService.getTurns(sessionId).some(turn => turn.kind === 'user' && turn.text === 'hello'));
		assert.ok(stubService.getTurns(sessionId).some(turn => turn.kind === 'assistant' && /Stub echo/i.test(turn.text)));
		assert.strictEqual(textarea.value, '');
	});

	test('engine-cache disconnect keeps Send enabled and does not pretend delivered', async () => {
		class EngineCacheRoster extends ConversationStubService {
			override hasEngineConnectionHistory(): boolean {
				return true;
			}
		}
		const roster = store.add(new EngineCacheRoster());
		const { part } = mountLens({ stubService: roster });
		const slots = getLensSlots(part);
		const sessionId = roster.createSession();
		const sendButton = getDockSendButton(slots);
		const textarea = getDockTextarea(slots);
		textarea.value = 'keep this draft';
		textarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		assert.strictEqual(sendButton.classList.contains('disabled'), false);

		sendButton.click();
		await Promise.resolve();
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(textarea.value, 'keep this draft');
		assert.strictEqual(roster.getTurns(sessionId).length, 0);
		assert.strictEqual(roster.enqueueMessageQueueItem(sessionId, 'keep this draft'), false);
		const gateRow = (getReadingColumn(slots).querySelector('.conversation-lens-dock-gate-row')
			?? slots.dock.querySelector('.conversation-lens-dock-gate-row')) as HTMLElement | null;
		assert.ok(gateRow);
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes(conversationLensPostFailedDisconnected));
		assert.ok(!/已同步|已发送|synced|delivered/i.test(gateRow.textContent ?? ''));
		assert.ok(!/已同步|synced/i.test(slots.sessionBar?.textContent ?? ''));
		assert.strictEqual(getReadingColumn(slots).classList.contains(conversationLensPhasePreFirstClass), true);
		assert.strictEqual(sendButton.classList.contains('disabled'), false);
	});

	test('engine-cache disconnect Send uses enqueue when the roster API accepts', async () => {
		class QueuingEngineCacheRoster extends ConversationStubService {
			readonly queued: string[] = [];
			override hasEngineConnectionHistory(): boolean {
				return true;
			}
			override enqueueMessageQueueItem(sessionId: string, text: string): boolean {
				const trimmed = text.trim();
				if (!trimmed) {
					return false;
				}
				this.queued.push(`${sessionId}:${trimmed}`);
				return true;
			}
		}
		const roster = store.add(new QueuingEngineCacheRoster());
		const { part } = mountLens({ stubService: roster });
		const slots = getLensSlots(part);
		const sessionId = roster.createSession();
		const textarea = getDockTextarea(slots);
		textarea.value = 'queued later';
		textarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		getDockSendButton(slots).click();
		await Promise.resolve();

		assert.deepStrictEqual(roster.queued, [`${sessionId}:queued later`]);
		assert.strictEqual(textarea.value, '');
		assert.strictEqual(roster.getTurns(sessionId).length, 0);
		assert.ok(!/已同步|已发送|synced/i.test(slots.dock.textContent ?? ''));
		assert.ok(!/已同步|已发送|synced/i.test(getReadingColumn(slots).textContent ?? ''));
	});

	test('PreFirst: centered composer cluster hides dock inbox and moves identity above composer', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const emptySessionId = stubService.createSession();
		assert.strictEqual(stubService.getActiveSessionId(), emptySessionId);

		const readingColumn = getReadingColumn(slots);
		const prefirstHero = getPrefirstHero(slots);
		assert.ok(prefirstHero);
		assert.ok(!prefirstHero!.hidden);
		assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), true);
		assert.strictEqual(slots.dock.classList.contains(conversationLensPhasePreFirstDockHiddenClass), true);
		const dockInbox = slots.dock.querySelector('.conversation-lens-inbox-overlay') as HTMLElement | null;
		assert.ok(dockInbox);
		assert.ok(dockInbox.hidden);
		assert.strictEqual(slots.dock.querySelector('.conversation-lens-composer'), null);
		assert.strictEqual(readingColumn.querySelector(`.${conversationIdentityStripClass}`), prefirstHero!.querySelector(`.${conversationIdentityStripClass}`));
		assert.ok(prefirstHero!.querySelector('.conversation-lens-composer'));
		assert.ok(prefirstHero!.querySelector('.conversation-lens-dock-gate-row'));
		assert.strictEqual(readingColumn.firstElementChild?.classList.contains(conversationIdentityStripClass), false);
	});

	test('Active: first message restores dock inbox row and identity at reading column top', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		await sendDockDraft(slots, 'Hello PreFirst');

		const readingColumn = getReadingColumn(slots);
		assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), false);
		assert.strictEqual(slots.dock.classList.contains(conversationLensPhasePreFirstDockHiddenClass), false);
		assert.ok(slots.dock.querySelector('.conversation-lens-inbox-overlay'));
		assert.ok(slots.dock.querySelector('.conversation-lens-composer'));
		assert.strictEqual(readingColumn.firstElementChild?.classList.contains(conversationIdentityStripClass), true);
		assert.strictEqual(getPrefirstHero(slots)?.hidden, true);

		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.strictEqual(stubService.getTurns(sessionId).length, 2);
	});

	test('T3 SessionConfig XOR: agent only in PreFirst composer; no Route SelectBox; clearing turns returns PreFirst', async () => {
		const { part, stubService, lens } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const readingColumn = getReadingColumn(slots);

		const getLeading = () => getComposerBottomBar(slots).querySelector('.conversation-lens-dock-bottom-leading')!;
		const agentSlot = () => getLeading().querySelector('.conversation-lens-dock-agent') as HTMLElement;
		const queryRoute = (root: ParentNode) => root.querySelector('.conversation-lens-dock-route, .conversation-lens-session-route');

		assert.ok(agentSlot());
		assert.strictEqual(agentSlot().hidden, false);
		assert.strictEqual(queryRoute(getLeading()), null);
		assert.strictEqual(queryRoute(slots.sessionBar!), null);
		assert.ok(!('routeIndex' in lens.getSessionConfig(sessionId)));

		const agentSelect = agentSlot().querySelector('select.monaco-select-box') as HTMLSelectElement;
		assert.strictEqual(agentSelect.options[agentSelect.selectedIndex]?.text, conversationLensDockNoAgent);
		assert.strictEqual(agentSelect.disabled, true);
		assert.strictEqual(agentSelect.getAttribute('aria-label'), `${conversationLensDockAgentLabel} — ${conversationLensDockAgentUnavailable}`);
		assertDisconnectedComposerCatalogsHonest(slots);

		await sendDockDraft(slots, 'Hello Active');

		assert.strictEqual(agentSlot().hidden, true);
		assert.strictEqual(queryRoute(getComposerBottomBar(slots)), null);
		assert.strictEqual(queryRoute(slots.sessionBar!), null);

		await new Promise<void>(resolve => setTimeout(resolve, 0));
		for (const turn of [...stubService.getTurns(sessionId)]) {
			stubService.deleteTurn(sessionId, turn.id);
		}

		assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), true);
		assert.strictEqual(agentSlot().hidden, false);
		assert.strictEqual(queryRoute(getLeading()), null);
		assert.strictEqual(queryRoute(slots.sessionBar!), null);
	});

	test('T3 SessionConfig XOR: SessionBar has no Route SelectBox in PreFirst', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		stubService.createSession();
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-session-route'), null);
		stubService.createSession();
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-session-route'), null);
	});

	test('PreFirst layout does not give the empty timeline the full reading height', () => {
		const { lens, stubService, part } = mountLens();
		const slots = getLensSlots(part);
		stubService.createSession();
		lens.layout(600, 800);
		const readingColumn = getReadingColumn(slots);
		assert.ok(readingColumn.classList.contains(conversationLensPhasePreFirstClass));
		const prefirstHero = getPrefirstHero(slots);
		assert.ok(prefirstHero);
		assert.ok(!prefirstHero.hidden);
		assert.ok(prefirstHero.querySelector('.conversation-lens-composer'));
		assert.ok(readingColumn.querySelector('.conversation-lens-timeline'));
	});

	test('T3 SessionConfig: Route SelectBox is gone from composer and SessionBar', async () => {
		const { part, stubService, lens } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();

		assert.strictEqual(getComposerBottomBar(slots).querySelector('.conversation-lens-dock-route'), null);
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-session-route'), null);
		assert.ok(!('routeIndex' in lens.getSessionConfig(sessionId)));

		await sendDockDraft(slots, 'No pretend route setting');

		assert.strictEqual(getComposerBottomBar(slots).querySelector('.conversation-lens-dock-route'), null);
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-session-route'), null);
		assert.ok(!('routeIndex' in lens.getSessionConfig(sessionId)));
	});

	test('Active inbox: left/right clusters with MessageQueue and no Task chip', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		stubService.createSession();
		await sendDockDraft(slots, 'Activate inbox overlay');
		const overlay = getInboxOverlay(slots);
		const left = overlay.querySelector('.conversation-lens-inbox-left')!;
		const right = overlay.querySelector('.conversation-lens-inbox-right')!;

		assert.strictEqual(left.querySelector('.conversation-lens-inbox-task'), null);
		assert.ok(left.querySelector('.conversation-lens-inbox-queue'));
		assert.ok(left.querySelector('.conversation-lens-inbox-goal'));
		assert.ok(right.querySelector('.conversation-lens-inbox-stop'));
		assert.strictEqual(right.querySelector('.conversation-lens-inbox-context-ring'), null);
		assert.strictEqual(left.querySelector('.conversation-lens-inbox-label'), null);

		assert.ok(getInboxQueueChip(slots).textContent?.includes(conversationLensDockInboxNoQueue));
		assert.ok(overlay.textContent?.includes(conversationLensDockNoGoal));
	});

	test('inbox queue list opens without a Task chip or task list', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		stubService.createSession();
		await sendDockDraft(slots, 'Open inbox lists');
		await flushProjectedTimeline(layoutReadingColumn);

		assert.strictEqual(getInboxOverlay(slots).querySelector('.conversation-lens-inbox-task'), null);
		getInboxQueueChip(slots).click();
		const queuePanel = getVisibleInboxListPanel();
		assert.ok(queuePanel?.querySelector('.conversation-lens-message-queue-list'));
		assert.strictEqual(queuePanel?.querySelector('.conversation-lens-inbox-task-list'), null);
		assert.strictEqual(getInboxQueueChip(slots).getAttribute('aria-pressed'), 'true');
	});

	test('message queue fixture renders Singularity queue rows with hold tag', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		await sendDockDraft(slots, 'Queue fixture');
		await flushProjectedTimeline(layoutReadingColumn);
		stubService.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [{
				id: 'q1',
				content: 'Follow up after deploy',
				status: 'PENDING',
				hold: undefined,
				uploadProgress: undefined,
				retryCount: 0,
				lastError: undefined,
				locked: false,
				pinned: false,
			}],
		});

		getInboxQueueChip(slots).click();
		const panel = getVisibleInboxListPanel()!;
		const row = panel.querySelector('.queue-item[data-item-id="q1"]') as HTMLElement;
		assert.ok(row);
		assert.ok(panel.querySelector('.queue-bar-summary')?.textContent?.includes('1'));
		assert.ok(panel.querySelector('.queue-bar-action')?.textContent?.includes(conversationLensInboxQueuePause));

		row.click();
		assert.strictEqual(stubService.getMessageQueueState(sessionId).items[0]?.hold, 'EDITING');
		assert.strictEqual(getVisibleInboxListPanel(), null);

		getInboxQueueChip(slots).click();
		const heldRow = getVisibleInboxListPanel()?.querySelector('.queue-item.hold-editing[data-item-id="q1"]');
		assert.ok(heldRow);
		assert.ok(heldRow?.querySelector('.queue-item-meta .tag.hold')?.textContent?.includes(conversationLensInboxQueueEditingTag));
	});

	test('inbox goal is honest: disabled without engine, no goal field', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const goalButton = getInboxGoalButton(slots);

		assert.ok(goalButton.classList.contains('disabled'));
		assert.strictEqual(goalButton.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(goalButton.getAttribute('aria-label'), `${conversationLensDockGoal} — ${conversationLensDockGoalUnavailable}`);
		assert.strictEqual(goalButton.textContent?.trim(), conversationLensDockNoGoal);

		goalButton.click();
		assert.ok(goalButton.classList.contains('disabled'));
	});

	test('inbox stop is honest: disabled without engine, no stopLoop side effects', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		await sendDockDraft(slots, 'Activate inbox chrome');
		const overlay = getInboxOverlay(slots);
		const stopButton = getInboxStopButton(slots);
		const turnCountBefore = queryAllTimeline(slots, '.conversation-lens-turn').length;
		const pendingButton = overlay.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(stopButton.classList.contains('disabled'));
		assert.strictEqual(stopButton.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(stopButton.getAttribute('aria-label'), `${conversationLensDockStop}, ${conversationLensDockStopNotGenerating}`);
		assert.strictEqual(stopButton.textContent?.trim(), conversationLensDockStop);

		stopButton.click();

		assert.strictEqual(queryAllTimeline(slots, '.conversation-lens-turn').length, turnCountBefore);
		assert.ok(getInboxQueueChip(slots).textContent?.includes(conversationLensDockInboxNoQueue));
		assert.strictEqual(pendingButton.hidden, true);
		assert.strictEqual(stubService.getTurns(sessionId).length, 2);
	});

	test('honest dock gate and model labels without Copilot CTAs', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const gateRow = slots.dock.querySelector('.conversation-lens-dock-gate-row')!;
		const modelSelect = slots.dock.querySelector('.conversation-lens-dock-model select.monaco-select-box') as HTMLSelectElement;
		const sendButton = getDockSendButton(slots);

		assert.ok(gateRow.textContent?.includes(conversationLensDockEngineNotConnected));
		assert.strictEqual(gateRow.hasAttribute('hidden'), false);
		assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, conversationLensDockNoModel);
		assertDisconnectedComposerCatalogsHonest(slots);
		assert.strictEqual(sendButton.getAttribute('aria-label'), 'Send');
		assert.ok(sendButton.classList.contains('codicon-arrow-up'));
		assert.strictEqual(slots.dock.querySelector('.chat-setup'), null);
		assert.strictEqual(slots.dock.querySelector('.monaco-button[aria-label*="Sign in"]'), null);
	});

	test('connected dock hides gate, sends without stub model, and fills catalog labels', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			getCapabilitySnapshot: () => ({
				...capabilities,
				agentProfiles: { support: 'SUPPORTED' },
				tools: { support: 'SUPPORTED' },
				models: { support: 'SUPPORTED' },
			}),
			listAgentProfiles: async () => ({ profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] }),
			listTools: async () => ({ tools: [{ name: 'bash' }] }),
			listModels: async () => ({ models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] }),
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		stubService.setEngineConnected(true);
		for (let i = 0; i < 8; i++) {
			await Promise.resolve();
		}

		const gateRow = slots.dock.querySelector('.conversation-lens-dock-gate-row') as HTMLElement;
		assert.strictEqual(gateRow.hidden, true);
		assert.strictEqual(gateRow.textContent, '');
		assert.strictEqual(gateRow.getAttribute('aria-label'), null);
		assert.strictEqual(getPermissionSelect(slots).disabled, true);

		const textarea = getDockTextarea(slots);
		textarea.value = 'hello engine';
		textarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		const sendButton = getDockSendButton(slots);
		assert.ok(!sendButton.classList.contains('disabled'), 'connected send must not require Stub model');

		const agentSelect = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-agent select.monaco-select-box') as HTMLSelectElement;
		assert.ok([...agentSelect.options].some(option => option.text === 'Coder'));
		assert.ok(![...agentSelect.options].some(option => option.text === 'Stub agent'));

		const tuneButton = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-tune .monaco-button') as HTMLButtonElement;
		tuneButton.click();
		const popup = document.querySelector('.conversation-lens-dock-tune-popup');
		assert.ok(popup?.textContent?.includes('bash'));
		assert.ok(!popup?.textContent?.includes(conversationLensDockNoTools));
	});

	test('connected catalog RPC throws keep No agent / No model / empty tools', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			getCapabilitySnapshot: () => ({
				...capabilities,
				agentProfiles: { support: 'SUPPORTED' },
				tools: { support: 'SUPPORTED' },
				models: { support: 'SUPPORTED' },
			}),
			listAgentProfiles: async () => {
				throw new Error('listAgentProfiles exploded');
			},
			listTools: async () => {
				throw new Error('listTools exploded');
			},
			listModels: async () => {
				throw new Error('listModels exploded');
			},
		});
		const { part, stubService } = mountLens({ connection });
		const slots = getLensSlots(part);
		stubService.setEngineConnected(true);
		for (let i = 0; i < 8; i++) {
			await Promise.resolve();
		}

		const agentSelect = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-agent select.monaco-select-box') as HTMLSelectElement;
		assert.strictEqual(agentSelect.options[agentSelect.selectedIndex]?.text, conversationLensDockNoAgent);
		assert.ok(![...agentSelect.options].some(option => option.text === 'Coder'));
		assert.ok(![...agentSelect.options].some(option => option.text === 'Stub agent'));

		assert.strictEqual(getModelSelect(slots).options[getModelSelect(slots).selectedIndex]?.text, conversationLensDockNoModel);
		assert.ok(![...getModelSelect(slots).options].some(option => option.text === 'gpt-test'));
		assert.ok(![...getModelSelect(slots).options].some(option => option.text === 'Stub model'));

		const tuneButton = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-tune .monaco-button') as HTMLButtonElement;
		tuneButton.click();
		const popup = document.querySelector('.conversation-lens-dock-tune-popup');
		assert.strictEqual(popup?.textContent, conversationLensDockNoEngineTools);
		assert.ok(!popup?.textContent?.includes('bash'));
	});

	test('connected Enter submits draft through lease.post(submitInput)', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.setEngineConnected(true);

		const textarea = getDockTextarea(slots);
		textarea.value = 'hello engine';
		dispatchDockKeydown(textarea, KeyCode.Enter);
		await Promise.resolve();
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(textarea.value, '');
		const userTurn = stubService.getTurns(sessionId).find(turn => turn.kind === 'user' && turn.text === 'hello engine');
		assert.ok(userTurn, 'submitInput must reach the session view lease when connected');
	});

	test('connected Send click submits without input event when draft is prefilled', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		stubService.createSession();
		stubService.setEngineConnected(true);

		const textarea = getDockTextarea(slots);
		const sendButton = getDockSendButton(slots);
		textarea.value = 'prefilled draft';
		assert.strictEqual(sendButton.classList.contains('disabled'), true);

		sendButton.click();
		await Promise.resolve();
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(textarea.value, '');
	});

	test('dock input exposes stable automation test ids', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		assert.strictEqual(getDockTextarea(slots).getAttribute('data-testid'), 'conversation-composer-input');
		assert.strictEqual(getDockSendButton(slots).getAttribute('data-testid'), 'conversation-composer-send');
	});

	test('dock input placeholder is product Message copy, not Ask anything', () => {
		assert.strictEqual(conversationLensDockPlaceholder, 'Message');
		assert.ok(!conversationLensDockPlaceholder.toLowerCase().includes('ask anything'));
		assert.ok(!conversationLensDockPlaceholder.toLowerCase().includes('copilot'));

		const { part } = mountLens();
		const textarea = getLensSlots(part).dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		assert.strictEqual(textarea.placeholder, conversationLensDockPlaceholder);
		assert.strictEqual(textarea.getAttribute('aria-label'), 'Message');
	});

	test('dock has no Add control or attachments popup', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		assert.strictEqual(slots.dock.querySelector('.conversation-lens-dock-add'), null);
		assert.strictEqual(slots.dock.querySelector('.conversation-lens-dock-attachment-list'), null);
		assert.strictEqual(slots.dock.querySelector('.chat-attachments-container'), null);
		assert.strictEqual(slots.dock.querySelector('.chat-setup'), null);
		assert.strictEqual(document.querySelector('.conversation-lens-dock-add-popup'), null);
	});

	test('dock tune popup is honest and Templates chrome is gone', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const tuneButton = slots.dock.querySelector('.conversation-lens-dock-tune .monaco-button') as HTMLButtonElement;

		assert.strictEqual(tuneButton.getAttribute('aria-label'), conversationLensDockTuneTitle);
		assert.strictEqual(slots.dock.querySelector('.conversation-lens-dock-templates'), null);

		tuneButton.click();
		const tunePopup = document.querySelector('.conversation-lens-dock-tune-popup');
		assert.ok(tunePopup);
		assert.strictEqual(tunePopup.textContent, conversationLensDockNoTools);
		tuneButton.click();

		assert.strictEqual(document.querySelector('.conversation-lens-dock-templates-popup'), null);
	});

	test('empty session shows timeline empty state without send-below hint', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const emptySessionId = stubService.createSession();
		assert.strictEqual(stubService.getActiveSessionId(), emptySessionId);
		const empty = getTimelineEmpty(slots);
		assert.ok(empty);
		assert.ok(empty.textContent?.includes('No messages yet'));
		assert.strictEqual(empty.querySelector('.conversation-lens-timeline-empty-hint'), null);
		assert.ok(!empty.textContent?.toLowerCase().includes('send a message below'));
		assert.strictEqual(stubService.getTurns(emptySessionId).length, 0);
	});

	test('renders confirmation as a timeline list item with Allow and Skip', async () => {
		// Taller than the suite default: this test asserts on virtualized rows, and
		// how many fit depends on font metrics, which differ across machines.
		const { part, stubService, layoutReadingColumn } = mountLens({ layoutHeight: 1200 });
		const slots = getLensSlots(part);
		await seedPendingConfirmation(stubService, layoutReadingColumn);
		const seat = queryTimeline(slots, '.conversation-lens-confirmation-seat');
		assert.ok(seat);
		assert.ok(seat.textContent?.includes('confirmation pending'));
		assert.ok(seat.textContent?.includes('Input needed'));
		assert.ok(seat.textContent?.includes('Write README.md?'));
		const buttons = [...seat.querySelectorAll('button, .monaco-button')].map(el => el.textContent?.trim());
		assert.ok(buttons.some(label => label === 'Allow'));
		assert.ok(buttons.some(label => label === 'Skip'));
		assert.strictEqual(queryAllTimeline(slots, '.conversation-lens-turn').length >= 2, true);
	});

	test('renders user and assistant turns with role headers', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.appendUserTurn(sessionId, 'What lives in the center lens?');
		stubService.appendStubEchoAssistant(sessionId, 'SessionBar, timeline, and dock — not ChatEditor.');
		await flushProjectedTimeline(layoutReadingColumn);
		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]');
		const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
		assert.ok(userTurn?.classList.contains('conversation-lens-turn--user-align-end'));
		const userBody = userTurn?.querySelector('.conversation-lens-turn-body');
		assert.ok(userBody?.classList.contains('conversation-lens-turn-body--user-bubble'));
		assert.strictEqual(userBody?.classList.contains('conversation-lens-turn-body--reading-text'), false);
		assert.ok(userTurn?.querySelector('.conversation-lens-turn-header')?.textContent?.includes('You'));
		assert.ok(userBody);
		assert.strictEqual(assistantTurn?.classList.contains('conversation-lens-turn--user-align-end'), false);
		const assistantBody = assistantTurn?.querySelector('.conversation-lens-turn-body');
		assert.ok(assistantBody?.classList.contains('conversation-lens-turn-body--reading-text'));
		assert.strictEqual(assistantBody?.classList.contains('conversation-lens-turn-body--user-bubble'), false);
		assert.ok(assistantTurn?.querySelector('.conversation-lens-turn-header')?.textContent?.includes('Agent'));
		assert.ok(assistantBody);
		assert.strictEqual(shouldRenderTurnAsMarkdown('assistant'), true);
		assert.strictEqual(shouldRenderTurnAsMarkdown('user'), false);
		assert.strictEqual(userBody?.classList.contains('rendered-markdown'), false);
		assert.ok(assistantBody?.classList.contains('rendered-markdown'));
	});

	test('renders assistant turns as markdown, user turns as plain text', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const markdownEcho = '**bold** stub echo';
		stubService.appendStubEchoAssistant(sessionId, markdownEcho);
		await flushProjectedTimeline(layoutReadingColumn);

		const assistantBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"] .conversation-lens-turn-body')!;
		const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body');

		assert.ok(assistantBody.classList.contains('rendered-markdown'));
		assert.ok(assistantBody.querySelector('strong'));
		assert.strictEqual(assistantBody.textContent, 'bold stub echo');
		assert.notStrictEqual(assistantBody.textContent, markdownEcho);
		assert.strictEqual(userBody, null);
	});

	test('keeps user turn body as plain text without markdown rendering', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const userMessage = 'plain **not bold** text';
		stubService.appendUserTurn(sessionId, userMessage);
		await flushProjectedTimeline(layoutReadingColumn);

		const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body')!;
		assert.strictEqual(userBody.textContent, userMessage);
		assert.strictEqual(userBody.classList.contains('rendered-markdown'), false);
		assert.strictEqual(userBody.querySelector('strong'), null);
	});

	test('does not host the lens as ChatEditorInput', () => {
		const { part } = mountLens();
		assert.notStrictEqual(ConversationChatInput.TypeID, ChatEditorInput.TypeID);
		assert.notStrictEqual(ConversationEditorPane.ID, ChatEditorInput.EditorID);
		assert.deepStrictEqual(part.toJSON(), { type: Parts.CONVERSATION_PART });
		const lensHost = document.createElement('div');
		const timeline = document.createElement('div');
		timeline.className = 'conversation-timeline';
		lensHost.appendChild(timeline);
		assert.strictEqual(timeline.querySelector('.chat-setup'), null);
	});

	test('session switcher changes visible title and timeline turns', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const title = slots.sessionBar!.querySelector('.conversation-lens-session-title')!;

		const first = stubService.getActiveSession();
		const secondId = stubService.createSession();
		stubService.switchSession(first.id);
		stubService.appendUserTurn(first.id, 'First session message');
		await flushProjectedTimeline(layoutReadingColumn);
		const second = stubService.getSessions().find(s => s.id === secondId)!;
		stubService.appendUserTurn(secondId, 'Second session message');
		await flushProjectedTimeline(layoutReadingColumn);

		assert.strictEqual(title.textContent, first.title);
		assert.ok(slots.timeline.textContent?.includes('First session message'));

		stubService.switchSession(second.id);
		await flushProjectedTimeline(layoutReadingColumn);

		assert.strictEqual(title.textContent, second.title);
		assert.ok(slots.timeline.textContent?.includes('Second session message'));
		assert.ok(!slots.timeline.textContent?.includes('First session message'));
	});

	test('two leaves bound to different sessionKeys render their own sessions', async () => {
		const stubService = store.add(new ConversationStubService());
		const sessionA = stubService.getActiveSessionId();
		stubService.appendUserTurn(sessionA, 'Alpha leaf only');
		const sessionB = stubService.createSession();
		stubService.appendUserTurn(sessionB, 'Beta leaf only');
		stubService.switchSession(sessionB);

		const leafA = mountLens({ stubService, sessionKey: sessionA });
		const leafB = mountLens({ stubService, sessionKey: sessionB });
		const slotsA = getLensSlots(leafA.part);
		const slotsB = getLensSlots(leafB.part);
		const alphaTurn = stubService.getTurns(sessionA).find(turn => turn.text === 'Alpha leaf only');
		const betaTurn = stubService.getTurns(sessionB).find(turn => turn.text === 'Beta leaf only');
		assert.ok(alphaTurn);
		assert.ok(betaTurn);
		await revealVisualizeTurn(leafA.lens, leafA.layoutReadingColumn, alphaTurn.id);
		await revealVisualizeTurn(leafB.lens, leafB.layoutReadingColumn, betaTurn.id);

		assert.ok(slotsA.timeline.textContent?.includes('Alpha leaf only'));
		assert.ok(!slotsA.timeline.textContent?.includes('Beta leaf only'));
		assert.ok(slotsB.timeline.textContent?.includes('Beta leaf only'));
		assert.ok(!slotsB.timeline.textContent?.includes('Alpha leaf only'));

		stubService.switchSession(sessionA);
		await revealVisualizeTurn(leafA.lens, leafA.layoutReadingColumn, alphaTurn.id);
		await revealVisualizeTurn(leafB.lens, leafB.layoutReadingColumn, betaTurn.id);

		assert.ok(slotsB.timeline.textContent?.includes('Beta leaf only'));
		assert.ok(!slotsB.timeline.textContent?.includes('Alpha leaf only'));
	});

	test('tablist-only slot still hosts Conversation and Trajectory tabs', async () => {
		const { part, layoutReadingColumn } = mountLens({ tablistOnly: true });
		const slots = getLensSlots(part);
		assert.ok(slots.lensTablist);
		assert.strictEqual(slots.sessionBar, undefined);
		assert.ok(slots.lensTablist.querySelector('.conversation-lens-lens-tabs[role="tablist"]'));
		assert.strictEqual(getLensTab(slots, 'conversation').getAttribute('aria-selected'), 'true');

		await flushTimelineHeightUpdates();
		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		assert.strictEqual(getLensTab(slots, 'trajectory').getAttribute('aria-selected'), 'true');
		assert.ok(!slots.timeline.querySelector('.conversation-lens-trajectory')!.hasAttribute('hidden'));
	});

	test('SessionBar new session button creates an empty stub session', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const newButton = slots.sessionBar!.querySelector('.conversation-lens-session-new .monaco-button') as HTMLButtonElement;
		const title = slots.sessionBar!.querySelector('.conversation-lens-session-title')!;
		const initialCount = stubService.getSessions().length;

		assert.ok(newButton);
		assert.strictEqual(newButton.getAttribute('aria-label'), conversationLensSessionBarNewSession);
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-session-maximize'), null);
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-session-drawer'), null);

		newButton.click();

		assert.strictEqual(stubService.getSessions().length, initialCount + 1);
		assert.strictEqual(stubService.getTurns(stubService.getActiveSessionId()).length, 0);
		assert.ok(title.textContent?.includes('New session'));
		assert.ok(getTimelineEmpty(slots));
		assert.ok(getTimelineScroll(slots).textContent?.includes('No messages yet'));
		assert.ok(!getTimelineScroll(slots).textContent?.toLowerCase().includes('send a message below'));
	});

	test('SessionBar delete button removes active stub session', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const deleteButton = slots.sessionBar!.querySelector('.conversation-lens-session-delete .monaco-button') as HTMLButtonElement;
		const initialCount = stubService.getSessions().length;
		const deletedId = stubService.getActiveSessionId();

		assert.ok(deleteButton);
		assert.strictEqual(deleteButton.getAttribute('aria-label'), conversationLensSessionBarDeleteSession);
		assert.strictEqual(deleteButton.getAttribute('aria-label'), 'Delete session');

		deleteButton.click();
		await flushTimelineHeightUpdates();

		// Seed is untitled + visualize; deleting the active one leaves the other.
		assert.strictEqual(stubService.getSessions().length, initialCount - 1);
		assert.notStrictEqual(stubService.getActiveSessionId(), deletedId);
		assert.strictEqual(stubService.getSessions().some(s => s.id === deletedId), false);
	});

	test('SessionBar delete on last session creates fresh untitled stub', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const deleteButton = slots.sessionBar!.querySelector('.conversation-lens-session-delete .monaco-button') as HTMLButtonElement;
		const title = slots.sessionBar!.querySelector('.conversation-lens-session-title')!;
		const sessions = [...stubService.getSessions()];

		for (const session of sessions) {
			if (stubService.getActiveSessionId() !== session.id) {
				stubService.switchSession(session.id);
			}
			deleteButton.click();
		}

		assert.strictEqual(stubService.getSessions().length, 1);
		assert.ok(title.textContent?.includes('Untitled'));
		assert.ok(getTimelineEmpty(slots));
	});

	test('SessionBar lens tablist defaults to Conversation and switches to Trajectory', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const conversationTab = getLensTab(slots, 'conversation');
		const trajectoryTab = getLensTab(slots, 'trajectory');

		assert.strictEqual(conversationTab.textContent, conversationLensSessionBarConversationTab);
		assert.strictEqual(trajectoryTab.textContent, conversationLensSessionBarTrajectoryTab);
		assert.strictEqual(conversationTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(trajectoryTab.getAttribute('aria-selected'), 'false');
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline:not([hidden])'));
		assert.strictEqual(slots.timeline.querySelector('.conversation-lens-trajectory')!.hasAttribute('hidden'), true);

		stubService.appendUserTurn(sessionId, 'First turn in trajectory');
		stubService.appendStubEchoAssistant(sessionId, 'Stub reply');
		await flushProjectedTimeline(layoutReadingColumn);

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushProjectedTimeline(layoutReadingColumn);

		assert.strictEqual(conversationTab.getAttribute('aria-selected'), 'false');
		assert.strictEqual(trajectoryTab.getAttribute('aria-selected'), 'true');
		const trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.ok(!trajectory.hasAttribute('hidden'));
		assert.strictEqual(slots.timeline.querySelector('.conversation-lens-timeline')!.hasAttribute('hidden'), true);
		assert.strictEqual(trajectory.querySelectorAll('.conversation-lens-trajectory-record-row').length, 2);
		assert.ok(trajectory.textContent?.includes('First turn in trajectory'));

		clickLensTab(slots, 'conversation');
		await flushTimelineHeightUpdates();

		assert.strictEqual(conversationTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(trajectoryTab.getAttribute('aria-selected'), 'false');
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline:not([hidden])'));
		assert.strictEqual(slots.timeline.querySelector('.conversation-lens-trajectory')!.hasAttribute('hidden'), true);
	});

	test('SessionBar exposes lens tablist, session title, confirmation, and process fold aria', async function () {
		this.timeout(15000);
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		// seedPendingConfirmation creates and activates its own session, so the
		// process step has to land there to show up in the rendered timeline.
		const sessionId = await seedPendingConfirmation(stubService, layoutReadingColumn);
		stubService.appendThinkingTurn(sessionId, 'Weighing options');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const tablist = slots.sessionBar!.querySelector('.conversation-lens-lens-tabs[role="tablist"]') as HTMLElement;
		assert.ok(tablist.getAttribute('aria-label')?.includes('Conversation lens'));
		const conversationTab = getLensTab(slots, 'conversation');
		const trajectoryTab = getLensTab(slots, 'trajectory');
		assert.strictEqual(conversationTab.getAttribute('aria-controls'), 'conversation-lens-panel-conversation');
		assert.strictEqual(trajectoryTab.getAttribute('aria-controls'), 'conversation-lens-panel-trajectory');
		assert.strictEqual(conversationTab.tabIndex, 0);
		assert.strictEqual(trajectoryTab.tabIndex, -1);

		const titleButton = slots.sessionBar!.querySelector('.conversation-lens-session-title') as HTMLButtonElement;
		assert.ok(titleButton.getAttribute('aria-label')?.includes('Session title:'));

		conversationTab.focus();
		conversationTab.dispatchEvent(new KeyboardEvent('keydown', { keyCode: KeyCode.RightArrow, bubbles: true, cancelable: true }));
		assert.strictEqual(trajectoryTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(document.activeElement, trajectoryTab);

		const seat = queryTimeline(slots, '.conversation-lens-confirmation-seat') as HTMLElement;
		const seatAria = seat.getAttribute('aria-label') ?? '';
		assert.ok(seat.textContent?.includes('confirmation pending'));
		assert.ok(seatAria.includes('Permission'));
		assert.ok(seatAria.includes('Input needed'));
		assert.ok(seatAria.includes('Write README.md?'));

		const foldHeader = queryTimeline(slots, '.conversation-process-fold-header') as HTMLElement;
		assert.ok(foldHeader.getAttribute('aria-label')?.includes('Process steps'));
	});

	test('SessionBar lens tabs stay visible at 300px minimum width with 22px bar height', () => {
		const { part } = mountLens({ layoutWidth: LENS_MIN_WIDTH });
		const slots = getLensSlots(part);
		const bar = slots.sessionBar!.querySelector('.conversation-lens-session-bar') as HTMLElement;
		const conversationTab = getLensTab(slots, 'conversation');
		const trajectoryTab = getLensTab(slots, 'trajectory');
		const switcherLabel = slots.sessionBar!.querySelector('.conversation-lens-session-switcher-label') as HTMLElement;

		assert.ok(bar);
		assert.ok(conversationTab);
		assert.ok(trajectoryTab);
		// 300px is the narrow bucket, not compact (`width < 300`). Switcher hide is CSS on `.is-narrow`.
		assert.ok(slots.sessionBar!.classList.contains('is-narrow'));
		assert.ok(!slots.sessionBar!.classList.contains('is-compact'));
		assert.ok(switcherLabel);
	});

	test('lensId persists across remount via workspace storage', async () => {
		const storageService = store.add(new TestStorageService());
		const first = mountLens({ storageService });
		const slots = getLensSlots(first.part);

		clickLensTab(slots, 'trajectory');
		assert.strictEqual(storageService.get('conversation.lensId', StorageScope.WORKSPACE), 'trajectory');

		first.lens.dispose();
		const second = mountLens({ storageService });
		const remountedSlots = getLensSlots(second.part);

		assert.strictEqual(getLensTab(remountedSlots, 'trajectory').getAttribute('aria-selected'), 'true');
		assert.ok(!remountedSlots.timeline.querySelector('.conversation-lens-trajectory')!.hasAttribute('hidden'));
	});

	test('switching sessions keeps the active lens tab', async function () {
		this.timeout(15000);
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const firstId = stubService.getActiveSessionId();
		const secondId = stubService.createSession();

		stubService.appendUserTurn(firstId, 'First session message');
		await flushTimelineHeightUpdates();
		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		stubService.switchSession(secondId);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(getLensTab(slots, 'trajectory').getAttribute('aria-selected'), 'true');
		assert.ok(!slots.timeline.querySelector('.conversation-lens-trajectory')!.hasAttribute('hidden'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-trajectory')!.textContent?.includes(conversationLensSessionBarNoTrajectory));
	});

	test('empty trajectory shows honest copy for any zero-turn session', () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const emptySessionId = stubService.createSession();
		stubService.switchSession(emptySessionId);

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();

		const trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.ok(trajectory.textContent?.includes(conversationLensSessionBarNoTrajectory));
		assert.strictEqual(trajectory.querySelector('.conversation-lens-trajectory-record-row'), null);
	});

	test('inbox pending click from Trajectory lens switches back to Conversation', async function () {
		this.timeout(15000);
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		await seedPendingConfirmation(stubService, layoutReadingColumn);

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const pendingButton = slots.dock.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;
		assert.ok(!pendingButton.hidden);

		pendingButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		const confirmationTurn = stubService.getTurns(stubService.getActiveSessionId()).find(turn => turn.kind === 'confirmation');
		assert.ok(confirmationTurn);
		await revealVisualizeTurn(lens, layoutReadingColumn, confirmationTurn.id);

		assert.strictEqual(getLensTab(slots, 'conversation').getAttribute('aria-selected'), 'true');
		assert.strictEqual(lens.isInputMaximized(), false);
		assert.ok(queryTimeline(slots, '.conversation-lens-confirmation-seat'));
	});

	test('thinking and tool turns render inside a collapsed process fold by default', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.appendThinkingTurn(sessionId, 'Weighing options');
		stubService.appendToolTurn(sessionId, 'grep src');
		await flushProjectedTimeline(layoutReadingColumn);

		const fold = queryTimeline(slots, '[data-process-fold]');
		assert.ok(fold);
		const header = fold!.querySelector('.conversation-process-fold-header') as HTMLElement;
		assert.strictEqual(header.getAttribute('aria-expanded'), 'false');
		const children = fold!.querySelector('.conversation-process-fold-children') as HTMLElement;
		assert.strictEqual(children.hidden, true);
		assert.ok(header.textContent?.includes('Stub'));

		header.click();

		assert.strictEqual(header.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(children.hidden, false);
		const thinking = fold!.querySelector('.conversation-process-fold-thinking[data-kind="thinking"]');
		const tool = fold!.querySelector('.conversation-process-fold-tool[data-kind="tool"]');
		assert.ok(thinking?.textContent?.includes('Weighing options'));
		assert.ok(tool?.textContent?.includes('grep src'));
	});

	test('ConversationPart.focus lands on dock textarea when lens is mounted', () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;

		part.focus();

		assert.strictEqual(document.activeElement, textarea);
	});

	test('ConversationPart.focus falls back to part element without lens', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);

		part.focus();

		assert.strictEqual(document.activeElement, parent);
	});

	test('inbox overlay is honest: no inline queue rows until opened, pending hidden without confirmations', async () => {
		const { part, stubService } = mountLens();
		const emptySlots = getLensSlots(part);
		stubService.createSession();
		// PreFirst keeps the overlay mounted and hides it; it does not unmount.
		const prefirstInbox = emptySlots.dock.querySelector('.conversation-lens-inbox-overlay') as HTMLElement | null;
		assert.ok(prefirstInbox);
		assert.ok(prefirstInbox.hidden);

		await sendDockDraft(emptySlots, 'Activate inbox overlay');
		const slots = getLensSlots(part);
		const overlay = getInboxOverlay(slots);
		const pendingButton = overlay.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(getInboxQueueChip(slots).textContent?.includes(conversationLensDockInboxNoQueue));
		assert.strictEqual(overlay.querySelector('.conversation-lens-message-queue-list'), null);
		assert.strictEqual(overlay.querySelector('.queue-item'), null);
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-inbox-badge'), null);
		assert.strictEqual(pendingButton.hidden, true);
	});

	test('allow on confirmation hides CTAs and updates inbox pending count', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		await seedPendingConfirmation(stubService, layoutReadingColumn);
		const seat = queryTimeline(slots, '.conversation-lens-confirmation-seat')!;
		const allowButton = seat.querySelector('.conversation-lens-confirmation-actions .monaco-button') as HTMLElement | null;
		const pendingButton = slots.dock.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(allowButton);
		allowButton.click();
		await flushProjectedTimeline(layoutReadingColumn);

		const seatAfter = queryTimeline(slots, '.conversation-lens-confirmation-seat')!;
		const buttonsAfter = [...seatAfter.querySelectorAll('button, .monaco-button')].map(el => el.textContent?.trim());
		assert.ok(!buttonsAfter.includes('Allow'));
		assert.ok(!buttonsAfter.includes('Skip'));
		assert.ok(seatAfter.textContent?.includes('Allowed'));
		assert.ok(seatAfter.textContent?.includes('Write README.md?'));
		assert.strictEqual(pendingButton.hidden, true);
	});

	test('dock appends a local user turn and stub echo to the current session timeline', async function () {
		this.timeout(15000);
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const textarea = getDockTextarea(slots);

		const message = 'Local stub message from test';
		assert.ok(!slots.timeline.textContent?.includes(message));

		await sendDockDraftAndFlush(slots, message, layoutReadingColumn);
		await revealLatestTurn(lens, stubService, layoutReadingColumn, turn => turn.kind === 'user' && turn.text === message);
		assert.ok(slots.timeline.textContent?.includes(message));

		await revealLatestTurn(lens, stubService, layoutReadingColumn, turn => turn.kind === 'assistant' && turn.stubEcho === true);
		assert.ok(queryTimeline(slots, '[data-stub="true"]'));
		assert.strictEqual(textarea.value, '');
	});

	test('dock maximize input toggles conversation-lens-input-maximized on slot hosts', () => {
		const { part, lens } = mountLens();
		const slots = getLensSlots(part);
		const maximizeButton = slots.dock.querySelector('.conversation-lens-dock-maximize-input .monaco-button') as HTMLButtonElement;

		assert.ok(maximizeButton);
		assert.ok(maximizeButton.classList.contains('codicon-screen-full'));
		assert.strictEqual(maximizeButton.getAttribute('aria-label'), conversationLensDockMaximizeInput);
		assert.strictEqual(lens.isInputMaximized(), false);
		assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), false);
		assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), false);
		assert.strictEqual(slots.sessionBar!.classList.contains(conversationLensInputMaximizedClass), false);
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-session-maximize'), null);

		maximizeButton.click();

		assert.strictEqual(lens.isInputMaximized(), true);
		assert.ok(maximizeButton.classList.contains('codicon-screen-normal'));
		assert.strictEqual(maximizeButton.getAttribute('aria-label'), conversationLensDockRestoreTimeline);
		assert.strictEqual(maximizeButton.getAttribute('aria-pressed'), 'true');
		assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), true);
		assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), true);

		maximizeButton.click();

		assert.strictEqual(lens.isInputMaximized(), false);
		assert.ok(maximizeButton.classList.contains('codicon-screen-full'));
		assert.strictEqual(maximizeButton.getAttribute('aria-label'), conversationLensDockMaximizeInput);
		assert.strictEqual(maximizeButton.getAttribute('aria-pressed'), 'false');
		assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), false);
		assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), false);
	});

	test('input maximize keeps pending confirmation reachable via dock inbox row', async () => {
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const maximizeButton = slots.dock.querySelector('.conversation-lens-dock-maximize-input .monaco-button') as HTMLButtonElement;
		const pendingButton = slots.dock.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		await seedPendingConfirmation(stubService, layoutReadingColumn);

		assert.ok(pendingButton);
		assert.ok(!pendingButton.hidden);

		maximizeButton.click();
		assert.strictEqual(lens.isInputMaximized(), true);
		assert.ok(!pendingButton.hidden);
		assert.ok(pendingButton.textContent?.includes('confirmation pending'));

		pendingButton.click();

		assert.strictEqual(lens.isInputMaximized(), false);
		assert.ok(queryTimeline(slots, '.conversation-lens-confirmation-seat'));
	});

	test('SessionBar title button enters rename mode and commits on Enter', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const titleButton = slots.sessionBar!.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleInput = slots.sessionBar!.querySelector('input.conversation-lens-session-title-input') as HTMLInputElement;
		const sessionId = stubService.getActiveSessionId();
		const previousTitle = stubService.getActiveSession().title;

		assert.ok(titleButton);
		assert.strictEqual(titleButton.title, conversationLensSessionBarRenameTitle);
		assert.ok(titleInput.hidden);

		titleButton.click();

		assert.ok(titleButton.hidden);
		assert.ok(!titleInput.hidden);
		assert.strictEqual(titleInput.value, previousTitle);

		titleInput.value = 'Renamed from test';
		titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: KeyCode.Enter, bubbles: true }));

		assert.ok(!titleButton.hidden);
		assert.ok(titleInput.hidden);
		assert.strictEqual(titleButton.textContent, 'Renamed from test');
		assert.strictEqual(stubService.getActiveSession().title, 'Renamed from test');
		assert.strictEqual(stubService.getSessions().find(s => s.id === sessionId)?.title, 'Renamed from test');
		assert.strictEqual(getConversationSessionStatusText(stubService.getActiveSession()), 'Renamed from test');
	});

	test('SessionBar rename rejects empty title and Escape cancels edit', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const titleButton = slots.sessionBar!.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleInput = slots.sessionBar!.querySelector('input.conversation-lens-session-title-input') as HTMLInputElement;
		const previousTitle = stubService.getActiveSession().title;

		titleButton.click();
		titleInput.value = '   ';
		titleInput.dispatchEvent(new globalThis.Event('blur', { bubbles: true }));

		assert.strictEqual(stubService.getActiveSession().title, previousTitle);
		assert.strictEqual(titleButton.textContent, previousTitle);

		titleButton.click();
		titleInput.value = 'Temporary edit';
		titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: KeyCode.Escape, bubbles: true }));

		assert.strictEqual(stubService.getActiveSession().title, previousTitle);
		assert.strictEqual(titleButton.textContent, previousTitle);
		assert.ok(!titleButton.hidden);
		assert.ok(titleInput.hidden);
	});

	test('SessionBar select and aria-live stay in sync after rename', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const titleButton = slots.sessionBar!.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleInput = slots.sessionBar!.querySelector('input.conversation-lens-session-title-input') as HTMLInputElement;
		const titleLive = slots.sessionBar!.querySelector('.conversation-lens-session-title-live') as HTMLElement;
		const sessionId = stubService.getActiveSessionId();

		assert.ok(titleLive);
		assert.strictEqual(titleLive.getAttribute('aria-live'), 'polite');

		titleButton.click();
		titleInput.value = 'Renamed for select sync';
		titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: KeyCode.Enter, bubbles: true }));

		assert.strictEqual(titleButton.textContent, 'Renamed for select sync');
		assert.strictEqual(titleLive.textContent, 'Renamed for select sync');
		assert.strictEqual(getSessionSelectLabel(slots), 'Renamed for select sync');
		assert.strictEqual(stubService.getSessions().find(s => s.id === sessionId)?.title, 'Renamed for select sync');
	});

	test('SessionBar renameSession false shows failed notice and keeps previous title', () => {
		class RejectingRenameRoster extends ConversationStubService {
			override renameSession(_sessionId: string, _title: string): boolean {
				return false;
			}
		}
		const roster = store.add(new RejectingRenameRoster());
		const { part } = mountLens({ stubService: roster });
		const slots = getLensSlots(part);
		const titleButton = slots.sessionBar!.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleInput = slots.sessionBar!.querySelector('input.conversation-lens-session-title-input') as HTMLInputElement;
		const titleLive = slots.sessionBar!.querySelector('.conversation-lens-session-title-live') as HTMLElement;
		const sessionId = roster.getActiveSessionId();
		const previousTitle = roster.getActiveSession().title;

		titleButton.click();
		titleInput.value = 'Rejected rename';
		titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: KeyCode.Enter, bubbles: true }));

		assert.strictEqual(roster.getActiveSession().title, previousTitle);
		assert.strictEqual(roster.getSessions().find(s => s.id === sessionId)?.title, previousTitle);
		assert.strictEqual(titleButton.textContent, previousTitle);
		assert.strictEqual(titleLive.textContent, previousTitle);
		assert.strictEqual(getSessionSelectLabel(slots), previousTitle);
		assert.ok(!titleButton.hidden);
		assert.ok(titleInput.hidden);
		const gateRow = (getReadingColumn(slots).querySelector('.conversation-lens-dock-gate-row')
			?? slots.dock.querySelector('.conversation-lens-dock-gate-row')) as HTMLElement | null;
		assert.ok(gateRow);
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes(conversationLensPostFailed));
	});

	test('SessionBar renameSession false after engine-cache disconnect shows disconnected notice', () => {
		class EngineCacheRejectingRenameRoster extends ConversationStubService {
			override hasEngineConnectionHistory(): boolean {
				return true;
			}
			override renameSession(_sessionId: string, _title: string): boolean {
				return false;
			}
		}
		const roster = store.add(new EngineCacheRejectingRenameRoster());
		const { part } = mountLens({ stubService: roster });
		const slots = getLensSlots(part);
		const titleButton = slots.sessionBar!.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleInput = slots.sessionBar!.querySelector('input.conversation-lens-session-title-input') as HTMLInputElement;
		const sessionId = roster.getActiveSessionId();
		const previousTitle = roster.getActiveSession().title;

		titleButton.click();
		titleInput.value = 'Rejected while disconnected';
		titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: KeyCode.Enter, bubbles: true }));

		assert.strictEqual(roster.getActiveSession().title, previousTitle);
		assert.strictEqual(roster.getSessions().find(s => s.id === sessionId)?.title, previousTitle);
		assert.strictEqual(titleButton.textContent, previousTitle);
		assert.strictEqual(getSessionSelectLabel(slots), previousTitle);
		const gateRow = (getReadingColumn(slots).querySelector('.conversation-lens-dock-gate-row')
			?? slots.dock.querySelector('.conversation-lens-dock-gate-row')) as HTMLElement | null;
		assert.ok(gateRow);
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes(conversationLensPostFailedDisconnected));
	});

	test('SessionBar deleteSession false shows failed notice and keeps the session', () => {
		class RejectingDeleteRoster extends ConversationStubService {
			override deleteSession(_sessionId: string): boolean {
				return false;
			}
		}
		const roster = store.add(new RejectingDeleteRoster());
		const { part } = mountLens({ stubService: roster });
		const slots = getLensSlots(part);
		const deleteButton = slots.sessionBar!.querySelector('.conversation-lens-session-delete .monaco-button') as HTMLButtonElement;
		const sessionId = roster.getActiveSessionId();
		const initialCount = roster.getSessions().length;

		assert.ok(deleteButton);
		deleteButton.click();

		assert.strictEqual(roster.getSessions().length, initialCount);
		assert.strictEqual(roster.getActiveSessionId(), sessionId);
		assert.strictEqual(roster.getSessions().some(s => s.id === sessionId), true);
		const gateRow = (getReadingColumn(slots).querySelector('.conversation-lens-dock-gate-row')
			?? slots.dock.querySelector('.conversation-lens-dock-gate-row')) as HTMLElement | null;
		assert.ok(gateRow);
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes(conversationLensPostFailed));
	});

	test('SessionBar deleteSession false after engine-cache disconnect shows disconnected notice', () => {
		class EngineCacheRejectingDeleteRoster extends ConversationStubService {
			override hasEngineConnectionHistory(): boolean {
				return true;
			}
			override deleteSession(_sessionId: string): boolean {
				return false;
			}
		}
		const roster = store.add(new EngineCacheRejectingDeleteRoster());
		const { part } = mountLens({ stubService: roster });
		const slots = getLensSlots(part);
		const deleteButton = slots.sessionBar!.querySelector('.conversation-lens-session-delete .monaco-button') as HTMLButtonElement;
		const sessionId = roster.getActiveSessionId();
		const initialCount = roster.getSessions().length;

		assert.ok(deleteButton);
		deleteButton.click();

		assert.strictEqual(roster.getSessions().length, initialCount);
		assert.strictEqual(roster.getActiveSessionId(), sessionId);
		assert.strictEqual(roster.getSessions().some(s => s.id === sessionId), true);
		const gateRow = (getReadingColumn(slots).querySelector('.conversation-lens-dock-gate-row')
			?? slots.dock.querySelector('.conversation-lens-dock-gate-row')) as HTMLElement | null;
		assert.ok(gateRow);
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes(conversationLensPostFailedDisconnected));
	});

	test('SessionBar createNewSession after engine-cache disconnect shows disconnected notice and does not create', () => {
		class EngineCacheCreateRoster extends ConversationStubService {
			createSessionCalls = 0;
			override hasEngineConnectionHistory(): boolean {
				return true;
			}
			override isEngineConnected(): boolean {
				return false;
			}
			override createSession(): string {
				this.createSessionCalls += 1;
				return super.createSession();
			}
		}
		const roster = store.add(new EngineCacheCreateRoster());
		const { part } = mountLens({ stubService: roster });
		const slots = getLensSlots(part);
		const newButton = slots.sessionBar!.querySelector('.conversation-lens-session-new .monaco-button') as HTMLButtonElement;
		const sessionId = roster.getActiveSessionId();
		const initialCount = roster.getSessions().length;

		assert.ok(newButton);
		newButton.click();

		assert.strictEqual(roster.createSessionCalls, 0);
		assert.strictEqual(roster.getSessions().length, initialCount);
		assert.strictEqual(roster.getActiveSessionId(), sessionId);
		const gateRow = (getReadingColumn(slots).querySelector('.conversation-lens-dock-gate-row')
			?? slots.dock.querySelector('.conversation-lens-dock-gate-row')) as HTMLElement | null;
		assert.ok(gateRow);
		assert.strictEqual(gateRow.hidden, false);
		assert.ok(gateRow.textContent?.includes(conversationLensPostFailedDisconnected));
	});

	test('SessionBar createNewSession while engine connected still calls createSession', () => {
		class ConnectedCreateRoster extends ConversationStubService {
			createSessionCalls = 0;
			override hasEngineConnectionHistory(): boolean {
				return true;
			}
			override isEngineConnected(): boolean {
				return true;
			}
			override createSession(): string {
				this.createSessionCalls += 1;
				return super.createSession();
			}
		}
		const roster = store.add(new ConnectedCreateRoster());
		const { part } = mountLens({ stubService: roster });
		const slots = getLensSlots(part);
		const newButton = slots.sessionBar!.querySelector('.conversation-lens-session-new .monaco-button') as HTMLButtonElement;
		const initialCount = roster.getSessions().length;

		assert.ok(newButton);
		newButton.click();

		assert.strictEqual(roster.createSessionCalls, 1);
		assert.strictEqual(roster.getSessions().length, initialCount + 1);
		const gateRow = (getReadingColumn(slots).querySelector('.conversation-lens-dock-gate-row')
			?? slots.dock.querySelector('.conversation-lens-dock-gate-row')) as HTMLElement | null;
		assert.ok(!gateRow || gateRow.hidden);
	});

	test('SessionBar select refreshes after deleting the last stub session', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const deleteButton = slots.sessionBar!.querySelector('.conversation-lens-session-delete .monaco-button') as HTMLButtonElement;
		const titleLive = slots.sessionBar!.querySelector('.conversation-lens-session-title-live') as HTMLElement;
		const sessions = [...stubService.getSessions()];

		for (const session of sessions) {
			if (stubService.getActiveSessionId() !== session.id) {
				stubService.switchSession(session.id);
			}
			deleteButton.click();
		}

		assert.strictEqual(stubService.getSessions().length, 1);
		assert.ok(stubService.getActiveSession().title.includes('Untitled'));
		assert.strictEqual(getSessionSelectLabel(slots), stubService.getActiveSession().title);
		assert.strictEqual(titleLive.textContent, stubService.getActiveSession().title);
		assert.strictEqual(slots.sessionBar!.querySelector('.conversation-lens-session-select select.monaco-select-box option')?.textContent, stubService.getActiveSession().title);
	});

	test('user turns are display-only; assistant turns expose Copy and Delete action bars', async () => {
		// Taller than the suite default: this test asserts on virtualized rows, and
		// how many fit depends on font metrics, which differ across machines.
		const { part, stubService, layoutReadingColumn } = mountLens({ layoutHeight: 1200 });
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();

		stubService.appendUserTurn(sessionId, 'Click me user');
		stubService.appendStubEchoAssistant(sessionId, 'Copy me assistant');
		stubService.appendThinkingTurn(sessionId, 'Thinking summary');
		stubService.appendToolTurn(sessionId, 'Tool summary');
		stubService.appendConfirmationTurn(sessionId, 'Confirm this?');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const foldHeader = queryTimeline(slots, '.conversation-process-fold-header');
		assert.ok(foldHeader);
		(foldHeader as HTMLElement).click();

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')!;
		const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]')!;

		assert.ok(userTurn.classList.contains('conversation-lens-turn--user-align-end'));
		assert.strictEqual(assistantTurn.classList.contains('conversation-lens-turn--user-align-end'), false);
		assert.ok(userTurn.querySelector('.conversation-lens-turn-body--clickable'));
		assert.strictEqual(userTurn.querySelector('.conversation-lens-turn-actions'), null);

		const assistantActions = assistantTurn.querySelector('.conversation-lens-turn-actions')!;
		assert.ok(assistantActions);

		const assistantCopy = assistantActions.querySelector('.conversation-lens-turn-action-copy .monaco-button') as HTMLElement;
		const assistantDelete = assistantActions.querySelector('.conversation-lens-turn-action-delete .monaco-button') as HTMLElement;

		assert.strictEqual(assistantCopy.getAttribute('aria-label'), conversationLensTurnCopy);
		assert.strictEqual(assistantDelete.getAttribute('aria-label'), conversationLensTurnDelete);

		assert.strictEqual(queryTimeline(slots, '.conversation-process-fold-thinking .conversation-lens-turn-actions'), null);
		assert.strictEqual(queryTimeline(slots, '.conversation-process-fold-tool .conversation-lens-turn-actions'), null);
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-confirmation-seat .conversation-lens-turn-actions'), null);

		assert.strictEqual(queryTimeline(slots, '[aria-label*="Regenerate"]'), null);
		assert.strictEqual(queryTimeline(slots, '[aria-label*="Quote"]'), null);
		assert.strictEqual(queryTimeline(slots, '[aria-label*="Edit"]'), null);
	});

	test('Delete turn removes it from timeline and trajectory; Copy writes turn text to clipboard', async function () {
		this.timeout(30000);
		const { part, lens, stubService, clipboardService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const userText = 'Delete and copy user text';
		const assistantText = 'Delete and copy assistant text';

		stubService.appendUserTurn(sessionId, userText);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		stubService.appendStubEchoAssistant(sessionId, assistantText);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await revealLatestTurn(lens, stubService, layoutReadingColumn, turn => turn.kind === 'user' && turn.text === userText);
		await revealLatestTurn(lens, stubService, layoutReadingColumn, turn => turn.kind === 'assistant' && turn.text === assistantText);

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')!;
		const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]')!;
		assert.ok(userTurn);
		assert.ok(assistantTurn);

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await paintTrajectoryRows(lens, slots, stubService, layoutReadingColumn, 2);

		let trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.strictEqual(trajectory.querySelectorAll('.conversation-lens-trajectory-record-row').length, 2);

		clickLensTab(slots, 'conversation');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await revealLatestTurn(lens, stubService, layoutReadingColumn, turn => turn.kind === 'assistant' && turn.text === assistantText);
		const liveAssistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]')!;
		assert.ok(liveAssistantTurn);

		const assistantCopy = liveAssistantTurn.querySelector('.conversation-lens-turn-action-copy .monaco-button') as HTMLElement;
		assistantCopy.click();
		assert.strictEqual(await clipboardService.readText(), assistantText);

		const assistantDelete = liveAssistantTurn.querySelector('.conversation-lens-turn-action-delete .monaco-button') as HTMLElement;
		assistantDelete.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(stubService.getTurns(sessionId).length, 1);
		assert.strictEqual(stubService.getTurns(sessionId)[0].text, userText);

		clickLensTab(slots, 'trajectory');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await paintTrajectoryRows(lens, slots, stubService, layoutReadingColumn, 1);

		trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.strictEqual(trajectory.querySelectorAll('.conversation-lens-trajectory-record-row').length, 1);
		assert.ok(trajectory.textContent?.includes(userText));
		assert.ok(!trajectory.textContent?.includes(assistantText));

		clickLensTab(slots, 'conversation');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await revealLatestTurn(lens, stubService, layoutReadingColumn, turn => turn.kind === 'user' && turn.text === userText);
		await flushAnimationFrames();

		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]'), null);
	});

	test('T5 Edit XOR: entering turn edit hosts composer before ListView measure (no 0px warn)', async function () {
		this.timeout(15000);
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.appendUserTurn(sessionId, 'Edit this user turn');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await revealLatestTurn(lens, stubService, layoutReadingColumn, turn => turn.kind === 'user' && turn.text === 'Edit this user turn');

		const listViewZeroPx: string[] = [];
		const originalWarn = console.warn;
		console.warn = (...args: unknown[]) => {
			const message = args.map(String).join(' ');
			if (message.includes('Measured item node at 0px')) {
				listViewZeroPx.push(message);
			}
			originalWarn.apply(console, args);
		};

		try {
			const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body--clickable') as HTMLElement;
			assert.ok(userBody);
			userBody.click();
			const editHost = queryTimeline(slots, '.conversation-lens-turn-edit-host') as HTMLElement | null;
			assert.ok(editHost);
			assert.ok(editHost.querySelector('.conversation-lens-composer'));
			assert.strictEqual(editHost.style.minHeight, '');
			layoutReadingColumn();
			await flushTimelineHeightUpdates();
			await flushAnimationFrames();
		} finally {
			console.warn = originalWarn;
		}

		assert.deepStrictEqual(listViewZeroPx, []);
		assert.strictEqual(countComposers(slots), 1);
		assert.strictEqual(slots.dock.querySelector('.conversation-lens-composer'), null);
	});

	test('T5 Edit XOR: user card click mounts composer with Exit; dock has no composer', async function () {
		this.timeout(15000);
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const userText = 'Edit this user turn';

		stubService.appendUserTurn(sessionId, userText);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.ok(slots.dock.querySelector('.conversation-lens-composer'));
		assert.strictEqual(countComposers(slots), 1);

		const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body--clickable') as HTMLElement;
		assert.ok(userBody);
		userBody.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.strictEqual(countComposers(slots), 1);
		assert.strictEqual(slots.dock.querySelector('.conversation-lens-composer'), null);
		const inlineComposer = queryTimeline(slots, '.conversation-lens-turn-edit-host .conversation-lens-composer');
		assert.ok(inlineComposer);
		assert.ok(inlineComposer?.querySelector('.conversation-lens-composer-edit-header'));
		assert.strictEqual(inlineComposer?.querySelector('.conversation-lens-composer-edit-title')?.textContent, conversationLensDockEditingMessage);

		const textarea = inlineComposer!.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		assert.strictEqual(textarea.value, userText);

		const exitButton = inlineComposer!.querySelector('.conversation-lens-composer-edit-exit .monaco-button') as HTMLElement;
		assert.strictEqual(exitButton.getAttribute('title'), null);
		assert.strictEqual(exitButton.getAttribute('aria-label'), conversationLensDockEditExit);
		exitButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(countComposers(slots), 1);
		assert.ok(slots.dock.querySelector('.conversation-lens-composer'));
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-turn-edit-host .conversation-lens-composer'), null);
	});

	test('T5 Edit XOR: queue row edit mounts composer in dock and XORs compose', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		await sendDockDraft(slots, 'Activate queue edit');
		stubService.setMessageQueueFixture(sessionId, {
			isPaused: false,
			isProcessing: false,
			items: [{
				id: 'q-edit',
				content: 'Queued message body',
				status: 'PENDING',
				hold: undefined,
				uploadProgress: undefined,
				retryCount: 0,
				lastError: undefined,
				locked: false,
				pinned: false,
			}],
		});

		getInboxQueueChip(slots).click();
		const row = getVisibleInboxListPanel()!.querySelector('.queue-item[data-item-id="q-edit"]') as HTMLElement;
		row.click();
		await flushAnimationFrames();

		assert.strictEqual(countComposers(slots), 1);
		const dockComposer = slots.dock.querySelector('.conversation-lens-composer')!;
		assert.ok(dockComposer.classList.contains('conversation-lens-composer--edit'));
		assert.ok(dockComposer.querySelector('.conversation-lens-composer-edit-title')?.textContent?.includes('Queued message body'));

		const textarea = dockComposer.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		assert.strictEqual(textarea.value, 'Queued message body');
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-composer'), null);

		const exitButton = dockComposer.querySelector('.conversation-lens-composer-edit-exit .monaco-button') as HTMLElement;
		exitButton.click();

		assert.strictEqual(stubService.getMessageQueueState(sessionId).items[0]?.hold, undefined);
		assert.strictEqual(countComposers(slots), 1);
		assert.ok(slots.dock.querySelector('.conversation-lens-composer'));
		assert.strictEqual(slots.dock.querySelector('.conversation-lens-composer--edit'), null);
	});

	test('T6 Voice: no mic, no transcript bar, and no stub phrase written to draft', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		await sendDockDraftAndFlush(slots, 'seed active composer');

		const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
		const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
		stubService.wireTestFrameSource(testSource);
		assert.deepStrictEqual(stubService.getSessionSync(sessionId), { kind: 'idle' });

		const trailing = getComposerBottomBar(slots).querySelector('.conversation-lens-dock-bottom-trailing')!;
		assert.strictEqual(trailing.querySelector('.conversation-lens-dock-mic'), null);
		assert.strictEqual(
			slots.dock.querySelector('.conversation-lens-voice-transcript-bar')
			?? getReadingColumn(slots).querySelector('.conversation-lens-voice-transcript-bar'),
			null);

		stubService.setEngineConnected(true);
		assert.strictEqual(trailing.querySelector('.conversation-lens-dock-mic'), null);
		assert.deepStrictEqual(stubService.getSessionSync(sessionId), { kind: 'idle' });

		stubService.setMessageQueueFixture(sessionId, {
			items: [{ id: 'q1', content: 'Queued item', status: 'PENDING', hold: undefined, uploadProgress: undefined, retryCount: 0, lastError: undefined, locked: false, pinned: false }],
			isPaused: false,
			isProcessing: false,
		});

		getInboxQueueChip(slots).click();
		const queuePanel = getVisibleInboxListPanel();
		assert.ok(queuePanel);
		assert.strictEqual(queuePanel!.querySelector('.conversation-lens-voice-transcript-bar'), null);
		assert.ok(!queuePanel!.textContent?.includes('Stub voice segment'));

		const draftBefore = getDockTextarea(slots).value;
		await new Promise<void>(resolve => setTimeout(resolve, 50));
		assert.strictEqual(getDockTextarea(slots).value, draftBefore);
		assert.ok(!getDockTextarea(slots).value.includes('Stub voice segment one'));
		assert.ok(!getDockTextarea(slots).value.includes('Stub voice segment two'));
		assert.ok(!getDockTextarea(slots).value.includes('Stub voice segment three'));

		stubService.setEngineConnected(false);
		assert.strictEqual(trailing.querySelector('.conversation-lens-dock-mic'), null);
	});

	test('T6 Voice: connected engine still has no mic write-to-draft path', () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
		const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
		stubService.wireTestFrameSource(testSource);
		assert.deepStrictEqual(stubService.getSessionSync(sessionId), { kind: 'idle' });
		stubService.setEngineConnected(true);

		assert.strictEqual(getComposerBottomBar(slots).querySelector('.conversation-lens-dock-mic'), null);
		assert.ok(!getDockTextarea(slots).value.includes('Stub voice segment'));
	});

	test('S3 send: dock post shows pending user row then supersedes to durable turns', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();

		await sendDockDraft(slots, 'pending then durable');
		layoutReadingColumn();
		await flushAnimationFrames();
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));

		await new Promise<void>(resolve => setTimeout(resolve, 0));
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]'));
		assert.strictEqual(stubService.getSessionSync(sessionId).kind, 'idle');
		const syncBadge = slots.sessionBar!.querySelector('.conversation-lens-session-sync-badge') as HTMLElement | null;
		assert.ok(syncBadge);
		assert.strictEqual(syncBadge.hidden, false);
		assert.strictEqual(syncBadge.textContent, 'Session not connected');
	});

	test('PRD-007: closed session shows column-top stale snapshot and keeps prior turns', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.appendUserTurn(sessionId, 'Keep this turn after disconnect');
		stubService.appendStubEchoAssistant(sessionId, 'Echo before disconnect');
		await flushProjectedTimeline(layoutReadingColumn);

		const banner = getReadingColumn(slots).querySelector(`.${conversationLensStaleSnapshotClass}`) as HTMLElement | null;
		assert.ok(banner);
		assert.strictEqual(banner.hidden, true);
		assert.strictEqual(banner.getAttribute('role'), 'status');
		assert.strictEqual(banner.getAttribute('aria-live'), 'polite');
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')?.textContent?.includes('Keep this turn after disconnect'));

		const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
		const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
		stubService.wireTestFrameSource(testSource);

		testSource.setSessionSync(sessionId, { kind: 'live' });
		onSessionChanged(sessionId);
		assert.strictEqual(banner.hidden, true);
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')?.textContent?.includes('Keep this turn after disconnect'));

		testSource.setSessionSync(sessionId, { kind: 'closed', reason: 'Subscription ended' });
		onSessionChanged(sessionId);
		assert.strictEqual(stubService.getSessionSync(sessionId).kind, 'closed');
		assert.strictEqual(banner.hidden, false);
		assert.strictEqual(banner.textContent, 'Showing snapshot from before disconnect: Subscription ended');
		assert.ok(!/synced|已同步|session live/i.test(banner.textContent ?? ''));
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')?.textContent?.includes('Keep this turn after disconnect'));
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]')?.textContent?.includes('Echo before disconnect'));
		assert.notStrictEqual(document.activeElement, banner);

		testSource.setSessionSync(sessionId, { kind: 'live' });
		onSessionChanged(sessionId);
		assert.strictEqual(banner.hidden, true);
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')?.textContent?.includes('Keep this turn after disconnect'));
	});

	test('PRD-007: lease apply closed sync shows stale snapshot without onDidChangeSession', async () => {
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		stubService.appendUserTurn(sessionId, 'Keep this turn after lease-only sync');
		stubService.appendStubEchoAssistant(sessionId, 'Echo before lease-only sync');
		await flushProjectedTimeline(layoutReadingColumn);

		const banner = getReadingColumn(slots).querySelector(`.${conversationLensStaleSnapshotClass}`) as HTMLElement | null;
		assert.ok(banner);
		assert.strictEqual(banner.hidden, true);

		const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
		const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
		stubService.wireTestFrameSource(testSource);
		lens.bindSessionView(sessionId);

		let sessionChangedAfterBind = 0;
		store.add(stubService.onDidChangeSession(() => { sessionChangedAfterBind++; }));

		testSource.setSessionSync(sessionId, { kind: 'closed', reason: 'Subscription ended' });
		await new Promise<void>(resolve => setTimeout(resolve, 20));

		assert.strictEqual(sessionChangedAfterBind, 0);
		assert.strictEqual(stubService.getSessionSync(sessionId).kind, 'closed');
		assert.strictEqual(banner.hidden, false);
		assert.strictEqual(banner.textContent, 'Showing snapshot from before disconnect: Subscription ended');
	});

	test('S3 shim: getTurns matches lease projection after fixture writes', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.createSession();
		service.appendUserTurn(sessionId, 'shim check');
		const lease = store.add(service.acquireSessionView(sessionId));
		assert.deepStrictEqual(
			service.getTurns(sessionId),
			entriesToLegacyTurns(projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details)),
		);
	});

	test('dock input history recalls sent user drafts with ArrowUp and ArrowDown on empty composer', async () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const textarea = getDockTextarea(slots);

		await sendDockDraft(slots, 'first message');
		await sendDockDraft(slots, 'second message');
		assert.strictEqual(textarea.value, '');

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'second message');

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'first message');

		dispatchDockKeydown(textarea, KeyCode.DownArrow);
		assert.strictEqual(textarea.value, 'second message');
	});

	test('dock input history is isolated per session', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const textarea = getDockTextarea(slots);

		await sendDockDraft(slots, 'session A only');
		const sessionBId = stubService.createSession();
		assert.strictEqual(stubService.getActiveSessionId(), sessionBId);

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, '');

		stubService.switchSession(stubService.getSessions()[0].id);
		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'session A only');
	});

	test('dock input history Escape restores unsent draft snapshot', async () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const textarea = getDockTextarea(slots);

		await sendDockDraft(slots, 'sent message');
		textarea.value = '  ';
		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'sent message');

		dispatchDockKeydown(textarea, KeyCode.Escape);
		assert.strictEqual(textarea.value, '  ');
	});

	test('dock input history typing exits browse and keeps edited text', async () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const textarea = getDockTextarea(slots);

		await sendDockDraft(slots, 'sent message');
		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'sent message');

		textarea.value = `${textarea.value}a`;
		textarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		assert.strictEqual(textarea.value, 'sent messagea');

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'sent messagea');
	});

	test('dock input history ignores deleted user turns', async () => {
		const { part, stubService } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const textarea = getDockTextarea(slots);

		await sendDockDraft(slots, 'delete me');
		await sendDockDraft(slots, 'keep me');
		const doomed = stubService.getTurns(sessionId).find(turn => turn.kind === 'user' && turn.text === 'delete me');
		assert.ok(doomed);
		stubService.deleteTurn(sessionId, doomed.id);

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'keep me');

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'keep me');
	});

	test('dock input history ignores ArrowUp when composer is not trim-empty', async () => {
		const { part } = mountLens();
		const slots = getLensSlots(part);
		const textarea = getDockTextarea(slots);

		await sendDockDraft(slots, 'sent message');
		textarea.value = 'typing now';
		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'typing now');
	});

	test('pinned user prompt is hidden at bottom and on empty session', async function () {
		this.timeout(30000);
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();

		assert.notStrictEqual(getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'), true);

		stubService.appendUserTurn(sessionId, 'What is pinned?');
		stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		scrollTimelineToEndWithoutClobber(lens);
		await flushAnimationFrames();

		assert.ok(!getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'));

		await scrollTimelineAwayFromPinnedRead(lens, slots, layoutReadingColumn);

		assert.ok(getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'));

		scrollTimelineToEndWithoutClobber(lens);
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.ok(!getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'));
	});

	test('pinned user prompt shows one-line preview and reveals user turn on click', async function () {
		this.timeout(30000);
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const userText = 'Scroll target user prompt';

		stubService.appendUserTurn(sessionId, userText);
		stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await scrollTimelineAwayFromPinnedRead(lens, slots, layoutReadingColumn);

		const bubble = getPinnedUserPromptBubble(slots);
		assert.ok(bubble);
		assert.strictEqual(bubble!.getAttribute('aria-label'), conversationLensPinnedUserPromptAria);
		assert.strictEqual(bubble!.querySelector('.conversation-timeline-pinned-user-text')?.textContent, userText);
		assert.strictEqual(bubble!.textContent?.includes('Pinned prompt'), false);

		bubble!.click();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();
		await revealLatestTurn(lens, stubService, layoutReadingColumn, turn => turn.kind === 'user' && turn.text === userText);

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]');
		assert.ok(userTurn);
		assert.ok(!getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'));
	});

	test('untitled fixture renders collapsed process fold header with Stub summary', async () => {
		const { part, lens, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		await revealUntitledProcessFold(lens, layoutReadingColumn);
		const fold = queryTimeline(slots, '[data-process-fold]');
		assert.ok(fold);
		const header = fold!.querySelector('.conversation-process-fold-header') as HTMLElement;
		assert.strictEqual(header.getAttribute('aria-expanded'), 'false');
		assert.ok(header.textContent?.includes('Stub'));
		assert.ok(header.textContent?.includes('4 steps'));
		const children = fold!.querySelector('.conversation-process-fold-children') as HTMLElement;
		assert.strictEqual(children.hidden, true);
	});

	test('expanding untitled process fold reveals nested thinking and tool indent layers', async () => {
		const { part, lens, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		await revealUntitledProcessFold(lens, layoutReadingColumn);
		const fold = queryTimeline(slots, '[data-process-fold]')!;
		const header = fold.querySelector('.conversation-process-fold-header') as HTMLElement;
		header.click();

		const children = fold.querySelector('.conversation-process-fold-children') as HTMLElement;
		assert.strictEqual(children.hidden, false);

		const thinkingBlocks = fold.querySelectorAll('.conversation-process-fold-thinking');
		assert.strictEqual(thinkingBlocks.length, 2);
		const nestedTools = fold.querySelectorAll('.conversation-process-fold-tool--nested');
		assert.strictEqual(nestedTools.length, 2);

		const childrenStyle = getWindow(children).getComputedStyle(children);
		const firstNestedTool = nestedTools[0] as HTMLElement;
		const nestedToolStyle = getWindow(firstNestedTool).getComputedStyle(firstNestedTool);
		const thinkingToolsHost = fold.querySelector('.conversation-process-fold-thinking-tools') as HTMLElement;
		const thinkingToolsStyle = getWindow(thinkingToolsHost).getComputedStyle(thinkingToolsHost);
		assert.ok(parseFloat(childrenStyle.paddingInlineStart) >= 12);
		assert.ok(parseFloat(thinkingToolsStyle.paddingInlineStart) >= 12);
		assert.ok(parseFloat(nestedToolStyle.paddingInlineStart) >= 0);
	});

	test('user and confirmation seats stay outside process fold on untitled fixture', async () => {
		const { part, lens, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		await revealUntitledProcessFold(lens, layoutReadingColumn);
		const fold = queryTimeline(slots, '[data-process-fold]')!;
		assert.strictEqual(fold.querySelector('.conversation-lens-turn[data-kind="user"]'), null);
		assert.strictEqual(fold.querySelector('.conversation-lens-confirmation-seat'), null);
		await revealVisualizeTurn(lens, layoutReadingColumn, 'untitled-u1');
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
		await revealVisualizeTurn(lens, layoutReadingColumn, 'untitled-c1');
		assert.ok(queryTimeline(slots, '.conversation-lens-confirmation-seat'));
	});

	test('expanding untitled thinking reveals Stub payload body distinct from header summary', async () => {
		const { part, lens, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		await revealUntitledProcessFold(lens, layoutReadingColumn);
		const fold = queryTimeline(slots, '[data-process-fold]')!;
		(fold.querySelector('.conversation-process-fold-header') as HTMLElement).click();

		const firstThinking = fold.querySelector('.conversation-process-fold-thinking[data-turn-id="untitled-t1"]')!;
		const thinkingHeader = firstThinking.querySelector('.conversation-process-fold-thinking-header') as HTMLElement;
		assert.ok(thinkingHeader.textContent?.includes('Stub: outline sections'));

		thinkingHeader.click();

		const body = firstThinking.querySelector('.conversation-process-fold-thinking-body') as HTMLElement;
		assert.strictEqual(body.hidden, false);
		assert.ok(body.textContent?.includes('Stub: Consider intro'));
		assert.notStrictEqual(body.textContent, thinkingHeader.textContent);
	});

	test('expanding untitled tool row reveals Stub payload text', async () => {
		const { part, lens, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		await revealUntitledProcessFold(lens, layoutReadingColumn);
		const fold = queryTimeline(slots, '[data-process-fold]')!;
		(fold.querySelector('.conversation-process-fold-header') as HTMLElement).click();

		const firstThinking = fold.querySelector('.conversation-process-fold-thinking[data-turn-id="untitled-t1"]')!;
		(firstThinking.querySelector('.conversation-process-fold-thinking-header') as HTMLElement).click();

		const readTool = fold.querySelector('.conversation-process-fold-tool[data-turn-id="untitled-tool1"]')!;
		const toolHeader = readTool.querySelector('.conversation-process-fold-tool-header') as HTMLElement;
		assert.ok(toolHeader.textContent?.includes('read'));
		assert.ok(toolHeader.textContent?.includes('Stub: README.md'));

		toolHeader.click();

		const payload = readTool.querySelector('.conversation-process-fold-tool-body') as HTMLElement;
		assert.strictEqual(payload.hidden, false);
		assert.ok(payload.textContent?.includes('Stub: # Project'));
	});

	test('pinned user prompt copy writes full text and exposes no Quote Edit or Regenerate', async function () {
		this.timeout(15000);
		const { part, lens, stubService, clipboardService, layoutReadingColumn } = mountLens();
		const slots = getLensSlots(part);
		const sessionId = stubService.createSession();
		const userText = userMessageLines(8);

		stubService.appendUserTurn(sessionId, userText);
		stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await scrollTimelineAwayFromPinnedRead(lens, slots, layoutReadingColumn);

		const pinnedHost = getPinnedUserPrompt(slots);
		assert.ok(pinnedHost?.classList.contains('conversation-timeline-pinned-user--visible'));

		const copyButton = pinnedHost!.querySelector('.conversation-timeline-pinned-user-copy .monaco-button') as HTMLElement;
		assert.strictEqual(copyButton.getAttribute('aria-label'), conversationLensPinnedUserPromptCopyAria);
		copyButton.click();
		assert.strictEqual(await clipboardService.readText(), userText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim());

		assert.strictEqual(pinnedHost!.querySelector('[aria-label*="Quote"]'), null);
		assert.strictEqual(pinnedHost!.querySelector('[aria-label*="Edit"]'), null);
		assert.strictEqual(pinnedHost!.querySelector('[aria-label*="Regenerate"]'), null);
		assert.strictEqual(pinnedHost!.querySelector('.conversation-lens-turn-actions'), null);
	});

	test('visualize seed session renders two visualization cards without Agent header', async () => {
		const { part, stubService, layoutReadingColumn, lens } = mountLens();
		const slots = getLensSlots(part);
		await showVisualizeSeed(stubService, layoutReadingColumn);

		const projected = lens.lastAttachedEntries.filter(entry => entry.kind === 'visualization');
		assert.strictEqual(projected.length, 2);
		assert.deepStrictEqual(projected.map(entry => entry.id), ['visualize-v1', 'visualize-v2']);

		// Virtual window may leave comparison unattached at the default 360px
		// height; reveal so the card is in the DOM (diagram stays covered by
		// the expand test).
		await revealVisualizeTurn(lens, layoutReadingColumn, 'visualize-v2');
		const comparison = queryTimeline(slots, '[data-visualize-type="comparison"]');
		assert.ok(comparison);
		assert.strictEqual(comparison!.querySelector('.conversation-lens-turn-header'), null);
		assert.ok(comparison!.querySelector('.conversation-visualize-option[data-recommended="true"]'));
	});

	test('visualize card header collapses and expands body', async () => {
		const { part, stubService, layoutReadingColumn, lens } = mountLens();
		const slots = getLensSlots(part);
		await showVisualizeSeed(stubService, layoutReadingColumn);
		await revealVisualizeTurn(lens, layoutReadingColumn, 'visualize-v2');

		const header = queryTimeline(slots, '[data-visualize-type="comparison"] .conversation-visualize-header') as HTMLButtonElement;
		const body = queryTimeline(slots, '[data-visualize-type="comparison"] .conversation-visualize-body') as HTMLElement;
		assert.ok(header);
		assert.ok(body);
		assert.strictEqual(body.hidden, false);

		header.click();
		assert.strictEqual(body.hidden, true);
	});

	test('visualize diagram expand opens overlay dialog closed by Escape and session switch', async function () {
		this.timeout(15000);
		const { part, stubService, layoutReadingColumn, openInEditorCalls, layoutContainer, lens } = mountLens();
		const slots = getLensSlots(part);
		await showVisualizeSeed(stubService, layoutReadingColumn);
		await revealVisualizeTurn(lens, layoutReadingColumn, 'visualize-v1');

		const diagram = queryTimeline(slots, '[data-visualize-type="diagram"]');
		assert.ok(diagram);
		assert.strictEqual(diagram!.querySelector('.conversation-lens-turn-header'), null);
		const source = queryTimeline(slots, 'pre[data-mermaid-source], [data-mermaid-host]');
		assert.ok(source);
		const sourceText = source!.textContent ?? '';
		if (source!.matches('pre[data-mermaid-source]')) {
			assert.ok(sourceText.includes('冻结'));
			assert.ok(sourceText.includes('进行中'));
			assert.ok(sourceText.includes('未立项'));
		}

		const expandButton = queryTimeline(slots, '[data-visualize-type="diagram"] .conversation-visualize-expand') as HTMLButtonElement;
		assert.ok(expandButton);
		expandButton.click();

		assert.ok(layoutContainer.querySelector('.conversation-visualize-overlay[role="dialog"]'));

		const dialog = layoutContainer.querySelector('.conversation-visualize-overlay') as HTMLElement;
		dialog.dispatchEvent(new KeyboardEvent('keydown', { keyCode: KeyCode.Escape, bubbles: true }));
		assert.strictEqual(layoutContainer.querySelector('.conversation-visualize-overlay[role="dialog"]'), null);

		expandButton.click();
		assert.ok(layoutContainer.querySelector('.conversation-visualize-overlay[role="dialog"]'));

		stubService.switchSession('untitled');
		assert.strictEqual(layoutContainer.querySelector('.conversation-visualize-overlay[role="dialog"]'), null);
		assert.strictEqual(openInEditorCalls.count, 0);
	});
});
