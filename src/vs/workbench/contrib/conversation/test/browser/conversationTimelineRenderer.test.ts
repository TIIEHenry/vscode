/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ITreeNode } from '../../../../../base/browser/ui/tree/tree.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationConfirmationSeat } from '../../browser/conversationConfirmationSeat.js';
import { ConversationQuestionSeat } from '../../browser/conversationQuestionSeat.js';
import { conversationLensErrorRetry, ConversationTimelineRenderer, renderHonestTimelineRow, renderStandaloneThinkingOrToolRow } from '../../browser/conversationTimelineRenderer.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import type { ConversationTimelineItem } from '../../browser/conversationTimelineTypes.js';
import type { IWebviewService } from '../../../webview/browser/webview.js';

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
});

suite('ConversationTimelineRenderer user-bubble writesEnabled', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function userBubbleNode(): ITreeNode<ConversationTimelineItem, void> {
		return {
			element: { variant: 'turn', turn: { id: 'u1', kind: 'user', text: 'hi' } },
			children: [],
			depth: 0,
			visibleChildrenCount: 0,
			visibleChildIndex: 0,
			collapsible: false,
			collapsed: false,
			filterData: undefined,
		} as ITreeNode<ConversationTimelineItem, void>;
	}

	function renderUserBubble(writesEnabled: boolean, edits: string[]): { bubble: HTMLElement; dispose: () => void } {
		const renderer = new ConversationTimelineRenderer(
			{ renderTurnBody: () => Disposable.None },
			undefined,
			undefined,
			undefined,
			undefined,
			turnId => edits.push(turnId),
			undefined,
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
		renderer.renderElement(userBubbleNode(), 0, template);
		const bubble = container.querySelector('.conversation-lens-turn-body--user-bubble') as HTMLElement | null;
		assert.ok(bubble);
		return {
			bubble,
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
});
