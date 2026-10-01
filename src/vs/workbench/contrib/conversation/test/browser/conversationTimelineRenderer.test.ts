/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ITreeNode } from '../../../../../base/browser/ui/tree/tree.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationConfirmationSeat } from '../../browser/conversationConfirmationSeat.js';
import { ConversationQuestionSeat } from '../../browser/conversationQuestionSeat.js';
import { getConversationEntryAriaLabel } from '../../browser/conversationSessionView.js';
import { IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { conversationLensErrorRetry, ConversationTimelineDelegate, ConversationTimelineRenderer, renderHonestTimelineRow, renderStandaloneThinkingOrToolRow } from '../../browser/conversationTimelineRenderer.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import type { ConversationTimelineItem } from '../../browser/conversationTimelineTypes.js';
import { ConversationTurnContentAdapter, type IConversationTurnContentAdapter } from '../../browser/conversationTurnContentAdapter.js';
import { CONVERSATION_REFS_MARKER, conversationTurnReadText } from '../../browser/conversationUserRefs.js';
import { getConversationChatResource } from '../../common/conversationChatInput.js';
import { IConversationSessionChatService } from '../../common/conversationSessionChat.js';
import type { IWebviewService } from '../../../webview/browser/webview.js';
import { createEmptyConversationSessionChatService, createNoopConversationSessionWindowService } from './conversationTimelineLinkTestStubs.js';

suite('renderHonestTimelineRow error retry (PRD-021)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function render(turn: ConversationStubTurn, onRetryError?: (turn: ConversationStubTurn) => void): HTMLElement {
		const disposables = store.add(new DisposableStore());
		const container = document.createElement('div');
		renderHonestTimelineRow(container, turn, 'error', disposables, onRetryError);
		return container;
	}

	function retryButton(container: HTMLElement): HTMLElement | null {
		return container.querySelector('.conversation-lens-turn-error-retry .monaco-button');
	}

	test('retryable true draws a Retry button and click calls onRetryError', () => {
		const clicks: string[] = [];
		const container = render(
			{ id: 'err-1', kind: 'error', text: 'boom', retryable: true, turnId: 'turn-1', agentId: 'sub:a' },
			turn => clicks.push(turn.id),
		);

		assert.ok(container.querySelector('.conversation-lens-turn-honest-status')?.textContent?.includes('Retryable'));
		const button = retryButton(container);
		assert.ok(button);
		assert.strictEqual(button.textContent, conversationLensErrorRetry);
		button.click();
		assert.deepStrictEqual(clicks, ['err-1']);
	});

	test('retryable false keeps the badge and does not draw a button', () => {
		const clicks: string[] = [];
		const container = render(
			{ id: 'err-2', kind: 'error', text: 'fatal', retryable: false },
			turn => clicks.push(turn.id),
		);

		assert.ok(container.querySelector('.conversation-lens-turn-honest-status')?.textContent?.includes('Not retryable'));
		assert.strictEqual(retryButton(container), null);
		assert.deepStrictEqual(clicks, []);
	});

	test('retryable absent does not draw a button', () => {
		const clicks: string[] = [];
		const container = render(
			{ id: 'err-3', kind: 'error', text: 'oops' },
			turn => clicks.push(turn.id),
		);

		assert.ok(container.querySelector('.conversation-lens-turn-honest-status')?.textContent?.includes('Not retryable'));
		assert.strictEqual(retryButton(container), null);
		assert.deepStrictEqual(clicks, []);
	});

	test('retryable true without onRetryError does not draw a fake button', () => {
		const container = render({ id: 'err-4', kind: 'error', text: 'boom', retryable: true });
		assert.ok(container.querySelector('.conversation-lens-turn-honest-status')?.textContent?.includes('Retryable'));
		assert.strictEqual(retryButton(container), null);
	});

	test('retryable true with writesEnabled false stays disabled and does not retry', () => {
		const clicks: string[] = [];
		const disposables = store.add(new DisposableStore());
		const container = document.createElement('div');
		renderHonestTimelineRow(
			container,
			{ id: 'err-hold', kind: 'error', text: 'boom', retryable: true, turnId: 'turn-1', agentId: 'sub:a' },
			'error',
			disposables,
			turn => clicks.push(turn.id),
			false,
		);
		const button = retryButton(container);
		assert.ok(button);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'true');
		button.click();
		assert.deepStrictEqual(clicks, []);
	});
});

suite('ConversationConfirmationSeat pairing-hold writes', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('writesEnabled false keeps Allow/Skip disabled and does not resolve', () => {
		const decisions: string[] = [];
		const seat = store.add(new ConversationConfirmationSeat({
			message: 'Allow this tool?',
			status: 'pending',
			onAllow: () => decisions.push('allowed'),
			onSkip: () => decisions.push('skipped'),
			writesEnabled: false,
		}));
		const buttons = seat.element.querySelectorAll('.conversation-lens-confirmation-actions .monaco-button');
		assert.strictEqual(buttons.length, 2);
		assert.strictEqual(buttons[0].getAttribute('aria-disabled'), 'true');
		assert.strictEqual(buttons[1].getAttribute('aria-disabled'), 'true');
		(buttons[0] as HTMLElement).click();
		(buttons[1] as HTMLElement).click();
		assert.deepStrictEqual(decisions, []);
	});
});

suite('ConversationQuestionSeat pairing-hold writes', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('writesEnabled false keeps Submit disabled and does not respond', () => {
		const responds: string[] = [];
		const seat = store.add(new ConversationQuestionSeat({
			message: 'Pick one',
			status: 'pending',
			questionItems: [{ id: 'q1', title: 'Choice', options: ['a', 'b'], multiSelect: true }],
			answerKeysValid: true,
			questionRequestId: 'req-1',
			onRespond: requestId => responds.push(requestId),
			writesEnabled: false,
		}));
		const submit = seat.element.querySelector('.conversation-lens-question-actions .monaco-button') as HTMLElement | null;
		assert.ok(submit);
		assert.strictEqual(submit.getAttribute('aria-disabled'), 'true');
		submit.click();
		assert.deepStrictEqual(responds, []);
	});
});

suite('renderStandaloneThinkingOrToolRow (D36)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('standalone thinking is an honest summary row, not process-fold chrome', () => {
		const container = document.createElement('div');
		renderStandaloneThinkingOrToolRow(container, { id: 't1', kind: 'thinking', text: 'considering', summary: 'think summary' });

		const row = container.querySelector('.conversation-lens-turn') as HTMLElement | null;
		assert.ok(row);
		assert.strictEqual(row.getAttribute('data-kind'), 'thinking');
		assert.strictEqual(row.getAttribute('data-honest-kind'), 'thinking');
		assert.strictEqual(row.getAttribute('data-turn-id'), 't1');
		assert.strictEqual(row.classList.contains('conversation-lens-turn-process'), false);
		assert.strictEqual(container.querySelector('.conversation-process-fold'), null);
		assert.strictEqual(container.querySelector('.conversation-lens-turn-summary'), null);
		assert.strictEqual(container.querySelector('.conversation-lens-turn-header')?.textContent, 'Thinking');
		assert.strictEqual(container.querySelector('.conversation-lens-turn-body')?.textContent, 'think summary');
	});

	test('standalone tool falls back to text when summary is absent', () => {
		const container = document.createElement('div');
		renderStandaloneThinkingOrToolRow(container, { id: 'tool1', kind: 'tool', text: 'grep src', toolName: 'grep' });

		const row = container.querySelector('.conversation-lens-turn') as HTMLElement | null;
		assert.ok(row);
		assert.strictEqual(row.getAttribute('data-kind'), 'tool');
		assert.strictEqual(row.classList.contains('conversation-lens-turn-process'), false);
		assert.strictEqual(container.querySelector('.conversation-process-fold'), null);
		assert.strictEqual(container.querySelector('.conversation-lens-turn-header')?.textContent, 'Tool');
		assert.strictEqual(container.querySelector('.conversation-lens-turn-body')?.textContent, 'grep src');
	});

	test('standalone file_edit tool renders diff stats and expandable diff area', () => {
		const container = document.createElement('div');
		const disposables = new DisposableStore();
		try {
			renderStandaloneThinkingOrToolRow(container, {
				id: 'fe1',
				kind: 'tool',
				toolName: 'file_edit',
				text: 'edit src/app.ts',
				summary: 'edited src/app.ts',
				metadata: {
					diff: '--- a\n+++ b\n-old\n+new',
					filediff: { file: 'src/app.ts', additions: 5, deletions: 2 },
				},
			}, undefined, disposables);

			const row = container.querySelector('.conversation-lens-turn') as HTMLElement | null;
			assert.ok(row);
			const diffStats = container.querySelector('.conversation-lens-turn-diff-stats');
			assert.ok(diffStats);
			assert.strictEqual(diffStats.textContent, '+5 \u22122');

			const toggleBtn = container.querySelector('.conversation-lens-turn-diff-toggle') as HTMLButtonElement | null;
			assert.ok(toggleBtn);
			assert.strictEqual(toggleBtn.textContent, 'Show diff');

			const diffContainer = container.querySelector('.conversation-lens-turn-diff-body') as HTMLElement | null;
			assert.ok(diffContainer);
			assert.strictEqual(diffContainer.hidden, true);

			toggleBtn.click();
			assert.strictEqual(diffContainer.hidden, false);
			assert.strictEqual(toggleBtn.textContent, 'Hide diff');
			assert.ok(diffContainer.textContent?.includes('-old'));
			assert.ok(diffContainer.textContent?.includes('+new'));
		} finally {
			disposables.dispose();
		}
	});
});

suite('ConversationTimelineRenderer user-bubble writesEnabled', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function renderUserBubble(writesEnabled: boolean, edits: string[], turn: ConversationStubTurn = { id: 'u1', kind: 'user', text: 'hi' }, onViewInTrajectory?: (turnId: string) => void): { bubble: HTMLElement; row: HTMLElement; dispose: () => void } {
		const renderer = new ConversationTimelineRenderer(
			{ renderTurnBody: () => Disposable.None },
			undefined,
			undefined,
			undefined,
			undefined,
			turnId => edits.push(turnId),
			onViewInTrajectory,
			undefined,
			undefined,
			undefined,
			() => undefined,
			undefined,
			() => undefined,
			() => false,
			() => writesEnabled,
			() => false,
			{} as IWebviewService,
			() => undefined,
			() => { },
		);
		const container = document.createElement('div');
		const template = renderer.renderTemplate(container);
		renderer.renderElement({
			element: { variant: 'turn', turn },
			children: [],
			depth: 0,
			visibleChildrenCount: 0,
			visibleChildIndex: 0,
			collapsible: false,
			collapsed: false,
			filterData: undefined,
		} as unknown as ITreeNode<ConversationTimelineItem, void>, 0, template);
		const row = container.querySelector('.conversation-lens-turn') as HTMLElement | null;
		const bubble = container.querySelector('.conversation-lens-turn-body--user-bubble') as HTMLElement | null;
		assert.ok(row);
		assert.ok(bubble);
		return {
			bubble,
			row,
			dispose: () => template.disposables.dispose(),
		};
	}

	test('writesEnabled false does not call onEditUserTurn', () => {
		const edits: string[] = [];
		const { bubble, dispose } = renderUserBubble(false, edits);
		bubble.click();
		assert.deepStrictEqual(edits, []);
		dispose();
	});

	test('writesEnabled true still calls onEditUserTurn', () => {
		const edits: string[] = [];
		const { bubble, dispose } = renderUserBubble(true, edits);
		bubble.click();
		assert.deepStrictEqual(edits, ['u1']);
		dispose();
	});

	test('pending user row shows Sending and is not an edit button', () => {
		const edits: string[] = [];
		const trajectory: string[] = [];
		const { bubble, row, dispose } = renderUserBubble(true, edits, { id: 'send:op-1', kind: 'user', text: 'second', pending: true }, turnId => trajectory.push(turnId));
		assert.strictEqual(row.getAttribute('data-pending'), 'true');
		assert.strictEqual(row.querySelector('.conversation-lens-turn-honest-status')?.textContent, 'Sending…');
		assert.strictEqual(bubble.getAttribute('role'), null);
		assert.strictEqual(bubble.getAttribute('tabindex'), null);
		assert.ok(!bubble.classList.contains('conversation-lens-turn-body--clickable'));
		assert.strictEqual(row.querySelector('.conversation-lens-turn-header-trajectory'), null);
		bubble.click();
		bubble.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		assert.deepStrictEqual(edits, []);
		assert.deepStrictEqual(trajectory, []);
		dispose();
	});
});

suite('ConversationTimelineRenderer assistant delete agentId', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function assistantNode(agentId?: string, turnId?: string): ITreeNode<ConversationTimelineItem, void> {
		return {
			element: { variant: 'turn', turn: { id: 'a1', kind: 'assistant', text: 'hello', agentId, turnId } },
			children: [],
			depth: 0,
			visibleChildrenCount: 0,
			visibleChildIndex: 0,
			collapsible: false,
			collapsed: false,
			filterData: undefined,
		} as unknown as ITreeNode<ConversationTimelineItem, void>;
	}

	function renderAssistantDelete(onDeleteTurn: (turn: ConversationStubTurn) => void, turnId?: string): { button: HTMLElement; dispose: () => void } {
		const renderer = new ConversationTimelineRenderer(
			{ renderTurnBody: () => Disposable.None },
			undefined,
			undefined,
			undefined,
			onDeleteTurn,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			() => undefined,
			undefined,
			() => undefined,
			() => false,
			() => true,
			() => false,
			{} as IWebviewService,
			() => undefined,
			() => { },
		);
		const container = document.createElement('div');
		const template = renderer.renderTemplate(container);
		renderer.renderElement(assistantNode('sub:a', turnId), 0, template);
		const button = container.querySelector('.conversation-lens-turn-action-delete .monaco-button') as HTMLElement | null;
		assert.ok(button);
		return {
			button,
			dispose: () => template.disposables.dispose(),
		};
	}

	function deleteTurnFromRow(turn: ConversationStubTurn, deleteTurn: (turnId: string, agentId?: string) => void): void {
		deleteTurn(turn.turnId?.trim() || turn.id, turn.agentId);
	}

	test('delete click hands L1 turnId to deleteTurn when snapshot admits one', () => {
		const deleted: { turnId: string; agentId?: string }[] = [];
		const deleteTurn = (turnId: string, agentId?: string) => {
			deleted.push({ turnId, agentId });
		};
		const { button, dispose } = renderAssistantDelete(turn => deleteTurnFromRow(turn, deleteTurn), 't1');
		button.click();
		assert.deepStrictEqual(deleted, [{ turnId: 't1', agentId: 'sub:a' }]);
		dispose();
	});

	test('delete click hands row agentId to deleteTurn, not only turn.id', () => {
		const deleted: { turnId: string; agentId?: string }[] = [];
		const deleteTurn = (turnId: string, agentId?: string) => {
			deleted.push({ turnId, agentId });
		};
		const { button, dispose } = renderAssistantDelete(turn => deleteTurnFromRow(turn, deleteTurn));
		button.click();
		assert.deepStrictEqual(deleted, [{ turnId: 'a1', agentId: 'sub:a' }]);
		dispose();
	});

	test('delete click treats blank turnId as missing and still sends display id', () => {
		const deleted: { turnId: string; agentId?: string }[] = [];
		const deleteTurn = (turnId: string, agentId?: string) => {
			deleted.push({ turnId, agentId });
		};
		const { button, dispose } = renderAssistantDelete(turn => deleteTurnFromRow(turn, deleteTurn), '   ');
		button.click();
		assert.deepStrictEqual(deleted, [{ turnId: 'a1', agentId: 'sub:a' }]);
		dispose();
	});
});

suite('ConversationTimelineDelegate dynamic heights', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('getDynamicHeight returns recorded height or null', () => {
		const delegate = new ConversationTimelineDelegate();
		const item: ConversationTimelineItem = {
			turn: { id: 't1', kind: 'user', text: 'hello' },
			variant: 'turn',
		};
		assert.strictEqual(delegate.getDynamicHeight(item), null);
		delegate.setDynamicHeight(item, 180);
		assert.strictEqual(delegate.getDynamicHeight(item), 180);
		assert.strictEqual(delegate.getHeight(item), 180);
	});
});

suite('user row refs trailer is not read or copied', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function turnNode(turn: ConversationStubTurn): ITreeNode<ConversationTimelineItem, void> {
		return {
			element: { variant: 'turn', turn },
			children: [],
			depth: 0,
			visibleChildrenCount: 0,
			visibleChildIndex: 0,
			collapsible: false,
			collapsed: false,
			filterData: undefined,
		} as unknown as ITreeNode<ConversationTimelineItem, void>;
	}

	function renderTurn(
		turn: ConversationStubTurn,
		contentAdapter: IConversationTurnContentAdapter,
		onCopyTurn?: (turnId: string, text: string) => void,
	): { container: HTMLElement; dispose: () => void } {
		const renderer = new ConversationTimelineRenderer(
			contentAdapter,
			undefined,
			undefined,
			onCopyTurn,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			() => undefined,
			undefined,
			() => undefined,
			() => false,
			() => true,
			() => false,
			{} as IWebviewService,
			() => undefined,
			() => { },
		);
		const container = document.createElement('div');
		document.body.appendChild(container);
		const template = renderer.renderTemplate(container);
		renderer.renderElement(turnNode(turn), 0, template);
		return {
			container,
			dispose: () => {
				template.disposables.dispose();
				container.remove();
			},
		};
	}

	test('user row aria and copy omit the trailer while the visible body stays stripped', () => {
		const line = getConversationChatResource('s1', 'default').toString();
		const body = 'See the other chat';
		const text = `${body}\n\n${CONVERSATION_REFS_MARKER}\n${line}`;
		const userTurn: ConversationStubTurn = { id: 'u-refs', kind: 'user', text };
		const assistantTurn: ConversationStubTurn = { id: 'a-refs', kind: 'assistant', text };

		const aria = getConversationEntryAriaLabel(userTurn);
		assert.ok(aria.includes(body));
		assert.ok(!aria.includes(CONVERSATION_REFS_MARKER));
		assert.ok(!aria.includes(line));
		const copied = conversationTurnReadText(userTurn.kind, userTurn.text);
		assert.strictEqual(copied, body);
		assert.ok(!copied.includes(CONVERSATION_REFS_MARKER));
		assert.ok(!copied.includes(line));

		const assistantAria = getConversationEntryAriaLabel(assistantTurn);
		assert.ok(assistantAria.includes(CONVERSATION_REFS_MARKER));
		assert.ok(assistantAria.includes(line));
		assert.strictEqual(conversationTurnReadText(assistantTurn.kind, assistantTurn.text), text);

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, {
			getSessions: () => [{ id: 's1', title: 'Alpha' }],
			getActiveSessionId: () => 's1',
			onDidChangeSession: Event.None,
			onDidChangeActiveSession: Event.None,
			isEngineConnected: () => false,
		} as unknown as IConversationRosterService);
		instantiationService.stub(IConversationSessionChatService, createEmptyConversationSessionChatService());
		instantiationService.stub(IConversationSessionWindowService, createNoopConversationSessionWindowService());
		instantiationService.stub(IOpenerService, { open: async () => true } as IOpenerService);
		const adapter = instantiationService.createInstance(ConversationTurnContentAdapter);

		const user = renderTurn(userTurn, adapter);
		try {
			const visible = user.container.querySelector('.conversation-lens-turn-user-text');
			assert.ok(visible);
			assert.strictEqual(visible.textContent, body);
			assert.ok(!visible.textContent!.includes(CONVERSATION_REFS_MARKER));
			assert.ok(!visible.textContent!.includes(line));
			assert.strictEqual(user.container.querySelector('.conversation-lens-turn-actions'), null);
		} finally {
			user.dispose();
		}

		const copies: string[] = [];
		const assistant = renderTurn(
			assistantTurn,
			{ renderTurnBody: () => Disposable.None },
			(_turnId, copyText) => copies.push(copyText),
		);
		try {
			const button = assistant.container.querySelector('.conversation-lens-turn-action-copy .monaco-button') as HTMLElement | null;
			assert.ok(button);
			button.click();
			assert.deepStrictEqual(copies, [text]);
			assert.ok(copies[0]!.includes(CONVERSATION_REFS_MARKER));
			assert.ok(copies[0]!.includes(line));
		} finally {
			assistant.dispose();
		}
	});
});
