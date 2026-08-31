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
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import { ConversationTimelineTree, conversationLensUserBubbleShowLess, conversationLensUserBubbleShowMore } from '../../browser/conversationTimelineTree.js';
import { ConversationTrajectoryList } from '../../browser/conversationTrajectoryList.js';
import {
	conversationLensDockAttachTitle,
	conversationLensDockEngineNotConnected,
	conversationLensDockGoal,
	conversationLensDockInboxNoQueue,
	conversationLensDockMaximizeInput,
	conversationLensDockNoAttachments,
	conversationLensDockNoGoal,
	conversationLensDockNoModel,
	conversationLensDockPlaceholder,
	conversationLensDockRestoreTimeline,
	conversationLensDockStop,
	conversationLensDockStopNotGenerating,
	conversationLensInputMaximizedClass,
} from '../../browser/conversationLensDockStrings.js';
import { conversationLensSessionBarDeleteSession, conversationLensSessionBarHistoryTitle, conversationLensSessionBarNewSession, conversationLensSessionBarNoTrajectory, conversationLensSessionBarRenameTitle, conversationLensThinkingNotConnected, conversationLensToolNotConnected, conversationLensPinnedUserPromptAria, conversationLensPinnedUserPromptCopyAria } from '../../browser/conversationLensSessionBarStrings.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { getConversationSessionStatusText } from '../../browser/conversationSessionStatus.js';
import { shouldRenderTurnAsMarkdown } from '../../browser/conversationTurnMarkdown.js';
import { conversationLensTurnCopy, conversationLensTurnDelete } from '../../browser/conversationLensSessionBarStrings.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';

suite('ConversationLens', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	async function flushTimelineHeightUpdates(): Promise<void> {
		await new Promise<void>(resolve => setTimeout(resolve, 20));
	}

	async function flushAnimationFrames(): Promise<void> {
		await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	}

	teardown(async () => {
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();
	});

	const LENS_LAYOUT_WIDTH = 640;
	const LENS_LAYOUT_HEIGHT = 480;

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
		return getTimelineScroll(slots).querySelector<HTMLElement>('.conversation-lens-timeline-empty');
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

	function scrollTimelineAwayFromBottom(lens: ConversationLens, offsetFromBottom = 200): void {
		const timelineTree = getTimelineTree(lens);
		timelineTree.setScrollLock(false);
		const tree = (timelineTree as unknown as { tree: { scrollTop: number; scrollHeight: number; renderHeight: number } }).tree;
		tree.scrollTop = Math.max(0, tree.scrollHeight - tree.renderHeight - offsetFromBottom);
	}

	function getPinnedUserPrompt(slots: IConversationLensSlots): HTMLElement | null {
		return queryTimeline(slots, '.conversation-timeline-pinned-user') as HTMLElement | null;
	}

	function getPinnedUserPromptBubble(slots: IConversationLensSlots): HTMLButtonElement | null {
		return queryTimeline(slots, '.conversation-timeline-pinned-user-bubble') as HTMLButtonElement | null;
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
		timelineTree.layout(LENS_LAYOUT_HEIGHT, LENS_LAYOUT_WIDTH);
		trajectoryList.layout(LENS_LAYOUT_HEIGHT, LENS_LAYOUT_WIDTH);
	}

	function getInboxGoalButton(slots: IConversationLensSlots): HTMLElement {
		const button = slots.dock.querySelector('.conversation-lens-inbox-goal .monaco-button');
		assert.ok(button);
		return button as HTMLElement;
	}

	function getInboxStopButton(slots: IConversationLensSlots): HTMLElement {
		const button = slots.dock.querySelector('.conversation-lens-inbox-stop .monaco-button');
		assert.ok(button);
		return button as HTMLElement;
	}

	function getVisibleDockAttachPopup(): HTMLElement | null {
		for (const popup of document.querySelectorAll<HTMLElement>('.conversation-lens-dock-attach-popup')) {
			const host = popup.closest('.context-view') as HTMLElement | null;
			if (!host || host.style.display !== 'none') {
				return popup;
			}
		}
		return null;
	}

	function getDockTextarea(slots: IConversationLensSlots): HTMLTextAreaElement {
		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement | null;
		assert.ok(textarea);
		return textarea;
	}

	function sendDockDraft(slots: IConversationLensSlots, message: string): void {
		const textarea = getDockTextarea(slots);
		const sendButton = slots.dock.querySelector('.conversation-lens-dock-actions .monaco-button') as HTMLElement;
		textarea.value = message;
		sendButton.click();
	}

	function dispatchDockKeydown(textarea: HTMLTextAreaElement, keyCode: KeyCode): void {
		textarea.dispatchEvent(new KeyboardEvent('keydown', { keyCode, bubbles: true, cancelable: true }));
	}

	function getSessionSelectLabel(slots: NonNullable<ReturnType<ConversationPart['getSlots']>>): string | undefined {
		const select = slots.sessionBar.querySelector('select.monaco-select-box') as HTMLSelectElement | null;
		if (!select || select.options.length === 0) {
			return undefined;
		}
		return select.options[select.selectedIndex]?.text;
	}

	function mountLens(): { part: ConversationPart; lens: ConversationLens; stubService: ConversationStubService; clipboardService: TestClipboardService; layoutReadingColumn: () => void } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const stubService = store.add(new ConversationStubService());
		const clipboardService = new TestClipboardService();
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IClipboardService, clipboardService);
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
		slots.timeline.classList.add('part', 'conversation');
		part.layout(LENS_LAYOUT_WIDTH, LENS_LAYOUT_HEIGHT, 0, 0);
		const layoutCallbacks: Array<() => void> = [];
		const runLayouts = () => {
			for (const layout of layoutCallbacks) {
				layout();
			}
		};
		store.add(stubService.onDidChangeSession(() => runLayouts()));
		store.add(stubService.onDidChangeActiveSession(() => runLayouts()));
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		const layout = () => layoutReadingColumn(lens, slots);
		layoutCallbacks.push(layout);
		layout();
		const contentHost = slots.timeline.querySelector('.conversation-lens-timeline-content') as HTMLElement | null;
		if (contentHost) {
			contentHost.style.display = '';
		}
		layout();
		return { part, lens, stubService, clipboardService, layoutReadingColumn: layout };
	}

	async function seedPendingConfirmation(stubService: ConversationStubService, layoutReadingColumn: () => void, message = 'Write README.md?'): Promise<void> {
		const sessionId = stubService.getActiveSessionId();
		stubService.appendUserTurn(sessionId, 'Help me scaffold the project README.');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		stubService.appendConfirmationTurn(sessionId, message);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
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

	test('short user turn does not show Show more control', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		stubService.appendUserTurn(sessionId, userMessageLines(2));

		assert.strictEqual(getUserFoldButton(slots), null);
		assert.strictEqual(getUserTurnBody(slots).classList.contains('conversation-lens-turn-body--collapsed'), false);
	});

	test('long user turn collapses with Show more and full-text title', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		const message = userMessageLines(8);
		stubService.appendUserTurn(sessionId, message);

		const body = getUserTurnBody(slots);
		const foldButton = getUserFoldButton(slots);

		assert.ok(body.classList.contains('conversation-lens-turn-body--collapsed'));
		assert.ok(foldButton);
		assert.strictEqual(foldButton!.textContent, conversationLensUserBubbleShowMore);
		assert.strictEqual(body.getAttribute('title'), message);

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')!;
		const actions = userTurn.querySelector('.conversation-lens-turn-actions');
		const fold = userTurn.querySelector('.conversation-lens-turn-fold');
		assert.ok(fold);
		assert.ok(actions);
		assert.ok(fold!.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING);
	});

	test('Show more expands user bubble and Show less collapses it again', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		stubService.appendUserTurn(sessionId, userMessageLines(8));
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const body = getUserTurnBody(slots);
		const foldButton = getUserFoldButton(slots)!;

		foldButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.strictEqual(body.classList.contains('conversation-lens-turn-body--collapsed'), false);
		assert.strictEqual(foldButton.textContent, conversationLensUserBubbleShowLess);
		assert.strictEqual(foldButton.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(body.getAttribute('title'), null);

		foldButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.ok(body.classList.contains('conversation-lens-turn-body--collapsed'));
		assert.strictEqual(foldButton.textContent, conversationLensUserBubbleShowMore);
		assert.strictEqual(foldButton.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(body.getAttribute('title'), userMessageLines(8));
	});

	test('long assistant stub echo does not get user bubble collapse chrome', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		stubService.appendStubEchoAssistant(sessionId, userMessageLines(8));

		const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
		assert.ok(assistantTurn);
		assert.strictEqual(assistantTurn.querySelector('.conversation-lens-turn-fold'), null);
		assert.strictEqual(assistantTurn.querySelector('.conversation-lens-turn-body--collapsed'), null);
	});

	test('default session shows honest empty timeline without fake history', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const timelineEmpty = getTimelineEmpty(slots);
		const pendingButton = slots.dock.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.strictEqual(stubService.getSessions().length, 1);
		assert.strictEqual(stubService.getTurns(stubService.getActiveSessionId()).length, 0);
		assert.ok(timelineEmpty);
		assert.ok(timelineEmpty.textContent?.includes('No messages yet'));
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-turn'), null);
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-confirmation-seat'), null);
		assert.strictEqual(pendingButton.hidden, true);
	});

	test('fills SessionBar, stub timeline, and stub dock slots', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-bar'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-select'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-gate-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-inbox-row'));
		assert.ok(slots.dock.querySelector('textarea.conversation-lens-dock-input'));
	});

	test('exposes Agent IDE chrome landmarks', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;

		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-icon'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-title'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-switcher-label'));
		assert.ok(getReadingColumn(slots));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline-scroll'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline-content'));
		assert.ok(slots.dock.querySelector('.conversation-lens-composer'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-input-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-bottom-bar'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-actions'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-gate-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-model'));
		assert.ok(slots.dock.querySelector('.conversation-lens-inbox-label'));
	});

	test('compact chrome: scroll region is timeline inner scroll only', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const timelineSlot = slots.timeline;

		assert.ok(timelineSlot.querySelector('.conversation-lens-timeline-scroll'));
		assert.strictEqual(timelineSlot.classList.contains('conversation-timeline'), true);
		assert.ok(!timelineSlot.querySelector('.conversation-lens-dock'));
	});

	test('compact chrome: dock composer textarea with bottom bar send', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		const inputRow = slots.dock.querySelector('.conversation-lens-dock-input-row')!;
		const bottomBar = slots.dock.querySelector('.conversation-lens-dock-bottom-bar')!;
		const sendButton = bottomBar.querySelector('.conversation-lens-dock-actions .monaco-button');

		assert.strictEqual(textarea.rows, 1);
		assert.strictEqual(textarea.placeholder, conversationLensDockPlaceholder);
		assert.ok(inputRow.contains(textarea));
		assert.ok(sendButton);
		assert.ok(bottomBar.contains(sendButton!.parentElement!));
		assert.ok(!inputRow.querySelector('.conversation-lens-dock-actions'));
	});

	test('compact chrome: inbox status stays on one row', () => {
		const { part } = mountLens();
		const inboxRow = part.getSlots()!.dock.querySelector('.conversation-lens-inbox-row')!;

		assert.ok(inboxRow.querySelector('.conversation-lens-inbox-label'));
		assert.ok(inboxRow.querySelector('.conversation-lens-inbox-queue'));
		assert.ok(inboxRow.querySelector('.conversation-lens-inbox-goal'));
		assert.ok(inboxRow.querySelector('.conversation-lens-inbox-stop'));
		assert.ok(inboxRow.textContent?.includes(conversationLensDockInboxNoQueue));
		assert.ok(inboxRow.textContent?.includes(conversationLensDockNoGoal));
	});

	test('inbox goal is honest: disabled without engine, no goal field', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const goalButton = getInboxGoalButton(slots);

		assert.ok(goalButton.classList.contains('disabled'));
		assert.strictEqual(goalButton.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(goalButton.getAttribute('aria-label'), `${conversationLensDockGoal}, ${conversationLensDockNoGoal}`);
		assert.strictEqual(goalButton.textContent?.trim(), conversationLensDockNoGoal);

		goalButton.click();
		assert.ok(goalButton.classList.contains('disabled'));
	});

	test('inbox stop is honest: disabled without engine, no stopLoop side effects', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const inboxRow = slots.dock.querySelector('.conversation-lens-inbox-row')!;
		const stopButton = getInboxStopButton(slots);
		const turnCountBefore = queryAllTimeline(slots, '.conversation-lens-turn').length;
		const pendingButton = inboxRow.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(stopButton.classList.contains('disabled'));
		assert.strictEqual(stopButton.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(stopButton.getAttribute('aria-label'), `${conversationLensDockStop}, ${conversationLensDockStopNotGenerating}`);
		assert.strictEqual(stopButton.textContent?.trim(), conversationLensDockStop);

		stopButton.click();

		assert.strictEqual(queryAllTimeline(slots, '.conversation-lens-turn').length, turnCountBefore);
		assert.ok(inboxRow.textContent?.includes(conversationLensDockInboxNoQueue));
		assert.strictEqual(pendingButton.hidden, true);
	});

	test('honest dock gate and model labels without Copilot CTAs', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const gateRow = slots.dock.querySelector('.conversation-lens-dock-gate-row')!;
		const modelLabel = slots.dock.querySelector('.conversation-lens-dock-model')!;
		const sendButton = slots.dock.querySelector('.conversation-lens-dock-actions .monaco-button')!;

		assert.ok(gateRow.textContent?.includes(conversationLensDockEngineNotConnected));
		assert.strictEqual(modelLabel.textContent, conversationLensDockNoModel);
		assert.ok(sendButton.textContent?.includes('Send'));
		assert.strictEqual(slots.dock.querySelector('.chat-setup'), null);
		assert.strictEqual(slots.dock.querySelector('.monaco-button[aria-label*="Sign in"]'), null);
	});

	test('dock input placeholder is product Message copy, not Ask anything', () => {
		assert.strictEqual(conversationLensDockPlaceholder, 'Message');
		assert.ok(!conversationLensDockPlaceholder.toLowerCase().includes('ask anything'));
		assert.ok(!conversationLensDockPlaceholder.toLowerCase().includes('copilot'));

		const { part } = mountLens();
		const textarea = part.getSlots()!.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		assert.strictEqual(textarea.placeholder, conversationLensDockPlaceholder);
		assert.strictEqual(textarea.getAttribute('aria-label'), 'Message');
	});

	test('dock attach control is honest: no file picker or attachment list', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const attachHost = slots.dock.querySelector('.conversation-lens-dock-attach');
		const attachButton = attachHost?.querySelector('.monaco-button') as HTMLButtonElement | null;

		assert.ok(attachHost);
		assert.ok(attachButton);
		assert.strictEqual(attachButton.getAttribute('aria-label'), conversationLensDockAttachTitle);
		assert.strictEqual(attachHost.querySelector('.conversation-lens-dock-attachment-list'), null);
		assert.strictEqual(attachHost.querySelector('.chat-attachments-container'), null);
		assert.strictEqual(slots.dock.querySelector('.chat-setup'), null);
		assert.strictEqual(getVisibleDockAttachPopup(), null);

		attachButton.click();

		const popup = getVisibleDockAttachPopup();
		assert.ok(popup);
		assert.strictEqual(popup.textContent, conversationLensDockNoAttachments);
		assert.strictEqual(popup.querySelectorAll('[role="option"], .monaco-list-row, .conversation-lens-dock-attachment-item').length, 0);

		attachButton.click();
		assert.strictEqual(getVisibleDockAttachPopup(), null);
	});

	test('empty session shows timeline empty state', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const empty = getTimelineEmpty(slots);
		assert.ok(empty);
		assert.ok(empty.textContent?.includes('No messages yet'));
		assert.strictEqual(stubService.getTurns(stubService.getActiveSessionId()).length, 0);
	});

	test('renders confirmation as a timeline list item with Allow and Skip', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
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

	test('renders user and assistant turns with role headers', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		stubService.appendUserTurn(sessionId, 'What lives in the center lens?');
		stubService.appendStubEchoAssistant(sessionId, 'SessionBar, timeline, and dock — not ChatEditor.');
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

	test('renders assistant turns as markdown, user turns as plain text', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		const markdownEcho = '**bold** stub echo';
		stubService.appendStubEchoAssistant(sessionId, markdownEcho);

		const assistantBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"] .conversation-lens-turn-body')!;
		const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body');

		assert.ok(assistantBody.classList.contains('rendered-markdown'));
		assert.ok(assistantBody.querySelector('strong'));
		assert.strictEqual(assistantBody.textContent, 'bold stub echo');
		assert.notStrictEqual(assistantBody.textContent, markdownEcho);
		assert.strictEqual(userBody, null);
	});

	test('keeps user turn body as plain text without markdown rendering', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		const userMessage = 'plain **not bold** text';
		stubService.appendUserTurn(sessionId, userMessage);

		const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body')!;
		assert.strictEqual(userBody.textContent, userMessage);
		assert.strictEqual(userBody.classList.contains('rendered-markdown'), false);
		assert.strictEqual(userBody.querySelector('strong'), null);
	});

	test('does not host the lens as ChatEditorInput', () => {
		const { part } = mountLens();
		assert.notStrictEqual(Parts.CONVERSATION_PART, ChatEditorInput.TypeID);
		assert.notStrictEqual(Parts.CONVERSATION_PART, ChatEditorInput.EditorID);
		assert.deepStrictEqual(part.toJSON(), { type: Parts.CONVERSATION_PART });
		assert.strictEqual(part.getSlots()!.timeline.querySelector('.chat-setup'), null);
	});

	test('session switcher changes visible title and timeline turns', async () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const title = slots.sessionBar.querySelector('.conversation-lens-session-title')!;

		const first = stubService.getActiveSession();
		const secondId = stubService.createSession();
		stubService.switchSession(first.id);
		stubService.appendUserTurn(first.id, 'First session message');
		await flushTimelineHeightUpdates();
		const second = stubService.getSessions().find(s => s.id === secondId)!;
		stubService.appendUserTurn(secondId, 'Second session message');
		await flushTimelineHeightUpdates();

		assert.strictEqual(title.textContent, first.title);
		assert.ok(slots.timeline.textContent?.includes('First session message'));

		stubService.switchSession(second.id);
		await flushTimelineHeightUpdates();

		assert.strictEqual(title.textContent, second.title);
		assert.ok(slots.timeline.textContent?.includes('Second session message'));
		assert.ok(!slots.timeline.textContent?.includes('First session message'));
	});

	test('SessionBar new session button creates an empty stub session', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const newButton = slots.sessionBar.querySelector('.conversation-lens-session-new .monaco-button') as HTMLButtonElement;
		const title = slots.sessionBar.querySelector('.conversation-lens-session-title')!;
		const initialCount = stubService.getSessions().length;

		assert.ok(newButton);
		assert.strictEqual(newButton.getAttribute('aria-label'), conversationLensSessionBarNewSession);
		assert.strictEqual(slots.sessionBar.querySelector('.conversation-lens-session-maximize'), null);
		assert.strictEqual(slots.sessionBar.querySelector('.conversation-lens-session-drawer'), null);

		newButton.click();

		assert.strictEqual(stubService.getSessions().length, initialCount + 1);
		assert.strictEqual(stubService.getTurns(stubService.getActiveSessionId()).length, 0);
		assert.ok(title.textContent?.includes('New session'));
		assert.ok(getTimelineEmpty(slots));
		assert.ok(getTimelineScroll(slots).textContent?.includes('No messages yet'));
	});

	test('SessionBar delete button removes active stub session', async () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const deleteButton = slots.sessionBar.querySelector('.conversation-lens-session-delete .monaco-button') as HTMLButtonElement;
		const initialCount = stubService.getSessions().length;
		const deletedId = stubService.getActiveSessionId();

		assert.ok(deleteButton);
		assert.strictEqual(deleteButton.getAttribute('aria-label'), conversationLensSessionBarDeleteSession);
		assert.strictEqual(deleteButton.getAttribute('aria-label'), 'Delete session');

		deleteButton.click();
		await flushTimelineHeightUpdates();

		// Last-delete respawns a fresh untitled stub instead of leaving zero sessions.
		assert.strictEqual(stubService.getSessions().length, initialCount);
		assert.notStrictEqual(stubService.getActiveSessionId(), deletedId);
		assert.strictEqual(stubService.getSessions().some(s => s.id === deletedId), false);
		assert.ok(getTimelineEmpty(slots));
	});

	test('SessionBar delete on last session creates fresh untitled stub', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const deleteButton = slots.sessionBar.querySelector('.conversation-lens-session-delete .monaco-button') as HTMLButtonElement;
		const title = slots.sessionBar.querySelector('.conversation-lens-session-title')!;
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

	test('SessionBar history toggles in-column trajectory for current session turns', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const historyButton = slots.sessionBar.querySelector('.conversation-lens-session-history .monaco-button') as HTMLButtonElement;
		const sessionId = stubService.getActiveSessionId();
		const activeTitle = stubService.getActiveSession().title;

		stubService.appendUserTurn(sessionId, 'First turn in trajectory');
		stubService.appendStubEchoAssistant(sessionId, 'Stub reply');
		await flushTimelineHeightUpdates();

		assert.ok(historyButton);
		assert.strictEqual(historyButton.getAttribute('aria-label'), conversationLensSessionBarHistoryTitle);
		assert.strictEqual(historyButton.getAttribute('aria-pressed'), 'false');
		assert.strictEqual(slots.timeline.querySelector('.conversation-lens-trajectory[hidden]'), slots.timeline.querySelector('.conversation-lens-trajectory'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline:not([hidden])'));

		historyButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(historyButton.getAttribute('aria-pressed'), 'true');
		const trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.ok(trajectory);
		assert.ok(!trajectory.hasAttribute('hidden'));
		assert.strictEqual(slots.timeline.querySelector('.conversation-lens-timeline')!.hasAttribute('hidden'), true);
		assert.strictEqual(trajectory.querySelectorAll('.monaco-list-row').length, 2);
		assert.ok(trajectory.textContent?.includes('First turn in trajectory'));
		assert.strictEqual(stubService.getActiveSession().title, activeTitle);

		historyButton.click();
		await flushTimelineHeightUpdates();

		assert.strictEqual(historyButton.getAttribute('aria-pressed'), 'false');
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline:not([hidden])'));
		assert.strictEqual(slots.timeline.querySelector('.conversation-lens-trajectory')!.hasAttribute('hidden'), true);
	});

	test('trajectory row click reveals matching timeline turn and returns to conversation view', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const historyButton = slots.sessionBar.querySelector('.conversation-lens-session-history .monaco-button') as HTMLButtonElement;
		const sessionId = stubService.getActiveSessionId();

		stubService.appendUserTurn(sessionId, 'Reveal me in timeline');
		stubService.appendStubEchoAssistant(sessionId, 'Later reply');
		await flushTimelineHeightUpdates();

		historyButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		const firstRow = trajectory.querySelector('.monaco-list-row') as HTMLElement;
		assert.ok(firstRow);
		firstRow.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(historyButton.getAttribute('aria-pressed'), 'false');
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline:not([hidden])'));
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-turn-id][data-kind="user"]'));
	});

	test('empty trajectory shows honest copy without fake history', () => {
		const { part, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const historyButton = slots.sessionBar.querySelector('.conversation-lens-session-history .monaco-button') as HTMLButtonElement;

		historyButton.click();
		layoutReadingColumn();

		const trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.ok(trajectory.textContent?.includes(conversationLensSessionBarNoTrajectory));
		assert.strictEqual(trajectory.querySelector('.monaco-list-row'), null);
		assert.strictEqual(trajectory.querySelector('.conversation-lens-session-history-popup'), null);
	});

	test('thinking and tool turns render as collapsible process rows with honest not-connected bodies', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		stubService.appendThinkingTurn(sessionId, 'Weighing options');
		stubService.appendToolTurn(sessionId, 'grep src');

		const thinking = queryTimeline(slots, '.conversation-lens-turn-process[data-kind="thinking"]');
		const tool = queryTimeline(slots, '.conversation-lens-turn-process[data-kind="tool"]');

		assert.ok(thinking?.textContent?.includes('Weighing options'));
		assert.ok(tool?.textContent?.includes('grep src'));
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-turn-process-body'), null);

		const twisties = queryAllTimeline(slots, '.monaco-tl-twistie');
		assert.ok(twisties.length >= 2);
		for (const twistie of twisties) {
			(twistie as HTMLElement).click();
		}

		const bodies = queryAllTimeline(slots, '.conversation-lens-turn-process-body');
		assert.ok([...bodies].some(body => body.textContent === conversationLensThinkingNotConnected));
		assert.ok([...bodies].some(body => body.textContent === conversationLensToolNotConnected));
	});

	test('ConversationPart.focus lands on dock textarea when lens is mounted', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
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

	test('inbox status row is honest: no fake queue list, pending hidden without confirmations', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const inboxRow = slots.dock.querySelector('.conversation-lens-inbox-row')!;
		const pendingButton = inboxRow.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(inboxRow.textContent?.includes(conversationLensDockInboxNoQueue));
		assert.strictEqual(inboxRow.querySelector('.conversation-lens-inbox-list'), null);
		assert.strictEqual(inboxRow.querySelector('.conversation-lens-inbox-item'), null);
		assert.strictEqual(slots.sessionBar.querySelector('.conversation-lens-inbox-badge'), null);
		assert.strictEqual(pendingButton.hidden, true);
	});

	test('allow on confirmation hides CTAs and updates inbox pending count', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		await seedPendingConfirmation(stubService, layoutReadingColumn);
		const seat = queryTimeline(slots, '.conversation-lens-confirmation-seat')!;
		const allowButton = seat.querySelector('.conversation-lens-confirmation-actions .monaco-button') as HTMLElement | null;
		const pendingButton = slots.dock.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(allowButton);
		allowButton.click();

		const seatAfter = queryTimeline(slots, '.conversation-lens-confirmation-seat')!;
		const buttonsAfter = [...seatAfter.querySelectorAll('button, .monaco-button')].map(el => el.textContent?.trim());
		assert.ok(!buttonsAfter.includes('Allow'));
		assert.ok(!buttonsAfter.includes('Skip'));
		assert.ok(seatAfter.textContent?.includes('Allowed'));
		assert.ok(seatAfter.textContent?.includes('Write README.md?'));
		assert.strictEqual(pendingButton.hidden, true);
	});

	test('dock appends a local user turn and stub echo to the current session timeline', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		const sendButton = slots.dock.querySelector('.conversation-lens-dock-actions .monaco-button') as HTMLElement;

		const message = 'Local stub message from test';
		assert.ok(!slots.timeline.textContent?.includes(message));

		textarea.value = message;
		sendButton.click();

		assert.ok(slots.timeline.textContent?.includes(message));
		assert.ok(queryTimeline(slots, '[data-stub="true"]'));
		assert.strictEqual(textarea.value, '');
	});

	test('dock maximize input toggles conversation-lens-input-maximized on slot hosts', () => {
		const { part, lens } = mountLens();
		const slots = part.getSlots()!;
		const maximizeButton = slots.dock.querySelector('.conversation-lens-dock-maximize-input-button') as HTMLButtonElement;

		assert.ok(maximizeButton);
		assert.strictEqual(maximizeButton.textContent?.trim(), conversationLensDockMaximizeInput);
		assert.strictEqual(lens.isInputMaximized(), false);
		assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), false);
		assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), false);
		assert.strictEqual(slots.sessionBar.classList.contains(conversationLensInputMaximizedClass), false);
		assert.strictEqual(slots.sessionBar.querySelector('.conversation-lens-session-maximize'), null);

		maximizeButton.click();

		assert.strictEqual(lens.isInputMaximized(), true);
		assert.strictEqual(maximizeButton.textContent?.trim(), conversationLensDockRestoreTimeline);
		assert.strictEqual(maximizeButton.getAttribute('aria-pressed'), 'true');
		assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), true);
		assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), true);

		maximizeButton.click();

		assert.strictEqual(lens.isInputMaximized(), false);
		assert.strictEqual(maximizeButton.textContent?.trim(), conversationLensDockMaximizeInput);
		assert.strictEqual(maximizeButton.getAttribute('aria-pressed'), 'false');
		assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), false);
		assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), false);
	});

	test('input maximize keeps pending confirmation reachable via dock inbox row', async () => {
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const maximizeButton = slots.dock.querySelector('.conversation-lens-dock-maximize-input-button') as HTMLButtonElement;
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
		const slots = part.getSlots()!;
		const titleButton = slots.sessionBar.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleInput = slots.sessionBar.querySelector('input.conversation-lens-session-title-input') as HTMLInputElement;
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
		const slots = part.getSlots()!;
		const titleButton = slots.sessionBar.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleInput = slots.sessionBar.querySelector('input.conversation-lens-session-title-input') as HTMLInputElement;
		const previousTitle = stubService.getActiveSession().title;

		titleButton.click();
		titleInput.value = '   ';
		titleInput.dispatchEvent(new Event('blur', { bubbles: true }));

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
		const slots = part.getSlots()!;
		const titleButton = slots.sessionBar.querySelector('button.conversation-lens-session-title') as HTMLButtonElement;
		const titleInput = slots.sessionBar.querySelector('input.conversation-lens-session-title-input') as HTMLInputElement;
		const titleLive = slots.sessionBar.querySelector('.conversation-lens-session-title-live') as HTMLElement;
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

	test('SessionBar select refreshes after deleting the last stub session', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const deleteButton = slots.sessionBar.querySelector('.conversation-lens-session-delete .monaco-button') as HTMLButtonElement;
		const titleLive = slots.sessionBar.querySelector('.conversation-lens-session-title-live') as HTMLElement;
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
		assert.strictEqual(slots.sessionBar.querySelector('select.monaco-select-box option')?.textContent, stubService.getActiveSession().title);
	});

	test('user and assistant turns expose Copy and Delete action bars; process and confirmation rows do not', async () => {
		const { part, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();

		stubService.appendUserTurn(sessionId, 'Copy me user');
		stubService.appendStubEchoAssistant(sessionId, 'Copy me assistant');
		stubService.appendThinkingTurn(sessionId, 'Thinking summary');
		stubService.appendToolTurn(sessionId, 'Tool summary');
		stubService.appendConfirmationTurn(sessionId, 'Confirm this?');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')!;
		const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]')!;

		assert.ok(userTurn.classList.contains('conversation-lens-turn--user-align-end'));
		assert.strictEqual(assistantTurn.classList.contains('conversation-lens-turn--user-align-end'), false);

		const userActions = userTurn.querySelector('.conversation-lens-turn-actions')!;
		const assistantActions = assistantTurn.querySelector('.conversation-lens-turn-actions')!;
		assert.ok(userActions);
		assert.ok(assistantActions);

		const userCopy = userActions.querySelector('.conversation-lens-turn-action-copy .monaco-button') as HTMLElement;
		const userDelete = userActions.querySelector('.conversation-lens-turn-action-delete .monaco-button') as HTMLElement;
		const assistantCopy = assistantActions.querySelector('.conversation-lens-turn-action-copy .monaco-button') as HTMLElement;
		const assistantDelete = assistantActions.querySelector('.conversation-lens-turn-action-delete .monaco-button') as HTMLElement;

		assert.strictEqual(userCopy.getAttribute('aria-label'), conversationLensTurnCopy);
		assert.strictEqual(userDelete.getAttribute('aria-label'), conversationLensTurnDelete);
		assert.strictEqual(assistantCopy.getAttribute('aria-label'), conversationLensTurnCopy);
		assert.strictEqual(assistantDelete.getAttribute('aria-label'), conversationLensTurnDelete);

		assert.strictEqual(queryTimeline(slots, '.conversation-lens-turn-process[data-kind="thinking"] .conversation-lens-turn-actions'), null);
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-turn-process[data-kind="tool"] .conversation-lens-turn-actions'), null);
		assert.strictEqual(queryTimeline(slots, '.conversation-lens-confirmation-seat .conversation-lens-turn-actions'), null);

		assert.strictEqual(queryTimeline(slots, '[aria-label*="Regenerate"]'), null);
		assert.strictEqual(queryTimeline(slots, '[aria-label*="Quote"]'), null);
		assert.strictEqual(queryTimeline(slots, '[aria-label*="Edit"]'), null);
	});

	test('Delete turn removes it from timeline and trajectory; Copy writes turn text to clipboard', async () => {
		const { part, stubService, clipboardService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		const userText = 'Delete and copy user text';
		const assistantText = 'Delete and copy assistant text';

		stubService.appendUserTurn(sessionId, userText);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		stubService.appendStubEchoAssistant(sessionId, assistantText);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')!;
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]'));
		const userCopy = userTurn.querySelector('.conversation-lens-turn-action-copy .monaco-button') as HTMLElement;
		userCopy.click();
		assert.strictEqual(await clipboardService.readText(), userText);

		const historyButton = slots.sessionBar.querySelector('.conversation-lens-session-history .monaco-button') as HTMLButtonElement;
		historyButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		let trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.strictEqual(trajectory.querySelectorAll('.monaco-list-row').length, 2);

		historyButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const userDelete = userTurn.querySelector('.conversation-lens-turn-action-delete .monaco-button') as HTMLElement;
		userDelete.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.strictEqual(stubService.getTurns(sessionId).length, 1);
		assert.strictEqual(stubService.getTurns(sessionId)[0].text, assistantText);

		historyButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		trajectory = slots.timeline.querySelector('.conversation-lens-trajectory')!;
		assert.strictEqual(trajectory.querySelectorAll('.monaco-list-row').length, 1);
		assert.ok(trajectory.textContent?.includes(assistantText));
		assert.ok(!trajectory.textContent?.includes(userText));

		historyButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.strictEqual(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'), null);
		assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]'));
	});

	test('dock input history recalls sent user drafts with ArrowUp and ArrowDown on empty composer', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = getDockTextarea(slots);

		sendDockDraft(slots, 'first message');
		sendDockDraft(slots, 'second message');
		assert.strictEqual(textarea.value, '');

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'second message');

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'first message');

		dispatchDockKeydown(textarea, KeyCode.DownArrow);
		assert.strictEqual(textarea.value, 'second message');
	});

	test('dock input history is isolated per session', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const textarea = getDockTextarea(slots);

		sendDockDraft(slots, 'session A only');
		const sessionBId = stubService.createSession();
		assert.strictEqual(stubService.getActiveSessionId(), sessionBId);

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, '');

		stubService.switchSession(stubService.getSessions()[0].id);
		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'session A only');
	});

	test('dock input history Escape restores unsent draft snapshot', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = getDockTextarea(slots);

		sendDockDraft(slots, 'sent message');
		textarea.value = '  ';
		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'sent message');

		dispatchDockKeydown(textarea, KeyCode.Escape);
		assert.strictEqual(textarea.value, '  ');
	});

	test('dock input history typing exits browse and keeps edited text', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = getDockTextarea(slots);

		sendDockDraft(slots, 'sent message');
		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'sent message');

		textarea.value = `${textarea.value}a`;
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		assert.strictEqual(textarea.value, 'sent messagea');

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'sent messagea');
	});

	test('dock input history ignores deleted user turns', async () => {
		const { part, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const textarea = getDockTextarea(slots);

		sendDockDraft(slots, 'delete me');
		sendDockDraft(slots, 'keep me');
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')!;
		const deleteButton = userTurn.querySelector('.conversation-lens-turn-action-delete .monaco-button') as HTMLElement;
		deleteButton.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'keep me');

		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'keep me');
	});

	test('dock input history ignores ArrowUp when composer is not trim-empty', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = getDockTextarea(slots);

		sendDockDraft(slots, 'sent message');
		textarea.value = 'typing now';
		dispatchDockKeydown(textarea, KeyCode.UpArrow);
		assert.strictEqual(textarea.value, 'typing now');
	});

	test('pinned user prompt is hidden at bottom and on empty session', async () => {
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();

		assert.notStrictEqual(getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'), true);

		stubService.appendUserTurn(sessionId, 'What is pinned?');
		stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		assert.ok(!getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'));

		scrollTimelineAwayFromBottom(lens);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.ok(getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'));

		getTimelineTree(lens).scrollToEnd();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		assert.ok(!getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'));
	});

	test('pinned user prompt shows one-line preview and reveals user turn on click', async () => {
		const { part, lens, stubService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		const userText = 'Scroll target user prompt';

		stubService.appendUserTurn(sessionId, userText);
		stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		scrollTimelineAwayFromBottom(lens);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		const bubble = getPinnedUserPromptBubble(slots);
		assert.ok(bubble);
		assert.strictEqual(bubble!.getAttribute('aria-label'), conversationLensPinnedUserPromptAria);
		assert.strictEqual(bubble!.querySelector('.conversation-timeline-pinned-user-text')?.textContent, userText);
		assert.strictEqual(bubble!.textContent?.includes('Pinned prompt'), false);

		bubble!.click();
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

		const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]');
		assert.ok(userTurn);
		assert.ok(!getPinnedUserPrompt(slots)?.classList.contains('conversation-timeline-pinned-user--visible'));
	});

	test('pinned user prompt copy writes full text and exposes no Quote Edit or Regenerate', async () => {
		const { part, lens, stubService, clipboardService, layoutReadingColumn } = mountLens();
		const slots = part.getSlots()!;
		const sessionId = stubService.getActiveSessionId();
		const userText = userMessageLines(8);

		stubService.appendUserTurn(sessionId, userText);
		stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
		layoutReadingColumn();
		await flushTimelineHeightUpdates();

		scrollTimelineAwayFromBottom(lens);
		layoutReadingColumn();
		await flushTimelineHeightUpdates();
		await flushAnimationFrames();

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
});
