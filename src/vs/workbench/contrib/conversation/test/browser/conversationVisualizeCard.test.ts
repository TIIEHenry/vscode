/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $, append } from '../../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { renderConversationVisualizeCard } from '../../browser/conversationVisualizeCard.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('ConversationVisualizeCard', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountCard(turn: ConversationStubTurn): { host: HTMLElement; disposables: DisposableStore } {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });
		const disposables = store.add(new DisposableStore());
		renderConversationVisualizeCard(host, turn, {
			isExpanded: () => true,
			setExpanded: () => { },
			onLayoutChange: () => { },
		}, disposables);
		return { host, disposables };
	}

	test('diagram card exposes mermaid source placeholder with roadmap labels', () => {
		const turn: ConversationStubTurn = {
			id: 'v-diagram',
			kind: 'visualization',
			text: '',
			visualize: {
				type: 'diagram',
				title: 'Stub: 实现路线状态',
				mermaid: 'flowchart TD\n  frozen["冻结"] --> active["进行中"] --> backlog["未立项"]',
			},
		};

		const { host } = mountCard(turn);
		const card = host.querySelector('[data-kind="visualization"][data-visualize-type="diagram"]');
		assert.ok(card);
		assert.strictEqual(card!.querySelector('.conversation-lens-turn-header'), null);

		const source = host.querySelector('pre[data-mermaid-source]');
		assert.ok(source);
		const text = source!.textContent ?? '';
		assert.ok(text.includes('冻结'));
		assert.ok(text.includes('进行中'));
		assert.ok(text.includes('未立项'));

		const title = host.querySelector('.conversation-visualize-title');
		assert.ok(title);
		assert.ok(title!.textContent!.includes('Stub'));
	});

	test('comparison card renders recommended badge and pros/cons lists', () => {
		const turn: ConversationStubTurn = {
			id: 'v-comparison',
			kind: 'visualization',
			text: '',
			visualize: {
				type: 'comparison',
				title: 'Stub: host options',
				options: [
					{
						name: 'Stub: DOM card',
						pros: ['Simple layout'],
						cons: ['No mermaid runtime'],
						recommended: false,
					},
					{
						name: 'Stub: webview host',
						pros: ['Theme-aware SVG'],
						cons: ['Requires extension'],
						recommended: true,
					},
				],
			},
		};

		const { host } = mountCard(turn);
		const card = host.querySelector('[data-kind="visualization"][data-visualize-type="comparison"]');
		assert.ok(card);

		const options = host.querySelectorAll('.conversation-visualize-option');
		assert.strictEqual(options.length, 2);
		assert.ok(host.querySelector('.conversation-visualize-option[data-recommended="true"]'));
		assert.ok(host.textContent!.includes('Recommended'));
		assert.ok(host.querySelector('.conversation-visualize-pros .codicon-check'));
		assert.ok(host.querySelector('.conversation-visualize-cons .codicon-error'));
	});

	test('invalid payload renders in-card error without throwing', () => {
		const host = append(document.body, $('.conversation-visualize-test-host'));
		store.add({ dispose: () => host.remove() });
		const disposables = store.add(new DisposableStore());

		const turn: ConversationStubTurn = {
			id: 'v-invalid',
			kind: 'visualization',
			text: '',
			payload: JSON.stringify({ type: 'diagram', mermaid: '' }),
		};

		assert.doesNotThrow(() => {
			renderConversationVisualizeCard(host, turn, {
				isExpanded: () => true,
				setExpanded: () => { },
				onLayoutChange: () => { },
			}, disposables);
		});

		assert.ok(host.querySelector('[data-visualize-type="error"]'));
		assert.ok(host.querySelector('.conversation-visualize-error'));
		assert.ok(host.querySelector('.conversation-visualize-fence'));
	});

	test('collapsing the header hides card body', () => {
		const expanded = new Map<string, boolean>();
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });
		const disposables = store.add(new DisposableStore());

		const turn: ConversationStubTurn = {
			id: 'v-fold',
			kind: 'visualization',
			text: '',
			visualize: { type: 'diagram', mermaid: 'graph LR; A-->B' },
		};

		renderConversationVisualizeCard(host, turn, {
			isExpanded: (turnId) => expanded.get(turnId) ?? true,
			setExpanded: (turnId, value) => {
				if (value) {
					expanded.set(turnId, true);
				} else {
					expanded.delete(turnId);
				}
			},
			onLayoutChange: () => { },
		}, disposables);

		const header = host.querySelector('.conversation-visualize-header') as HTMLButtonElement;
		const body = host.querySelector('.conversation-visualize-body') as HTMLElement;
		assert.ok(header);
		assert.ok(body);
		assert.strictEqual(body.hidden, false);

		header.click();
		assert.strictEqual(body.hidden, true);
		assert.strictEqual(header.getAttribute('aria-expanded'), 'false');

		header.click();
		assert.strictEqual(body.hidden, false);
		assert.strictEqual(header.getAttribute('aria-expanded'), 'true');
	});
});
