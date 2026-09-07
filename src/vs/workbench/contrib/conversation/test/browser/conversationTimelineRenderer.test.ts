/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { conversationLensErrorRetry, renderHonestTimelineRow, renderStandaloneThinkingOrToolRow } from '../../browser/conversationTimelineRenderer.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

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
});

suite('renderStandaloneThinkingOrToolRow (D36)', () => {

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
