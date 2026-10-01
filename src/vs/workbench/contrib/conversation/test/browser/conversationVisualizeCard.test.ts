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

		assert.strictEqual(host.querySelector('.conversation-visualize-title'), null);
		assert.strictEqual(host.querySelector('.conversation-visualize-diagram-toolbar'), null);
		const label = host.querySelector('.conversation-visualize-header-label');
		assert.strictEqual(label?.textContent, 'Stub: 实现路线状态');
		const expand = host.querySelector('.conversation-visualize-expand');
		assert.ok(expand);
		assert.ok(host.querySelector('.conversation-visualize-header-row')?.contains(expand));
		assert.ok(host.querySelector('.conversation-visualize-body--flush'));
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

		assert.strictEqual(host.querySelector('.conversation-visualize-title'), null);
		assert.strictEqual(host.querySelector('.conversation-visualize-header-label')?.textContent, 'Stub: host options');
		const options = host.querySelectorAll('.conversation-visualize-option');
		assert.strictEqual(options.length, 2);
		assert.ok(host.querySelector('.conversation-visualize-option[data-recommended="true"]'));
		assert.ok(host.textContent!.includes('Recommended'));
		assert.ok(host.querySelector('.conversation-visualize-pros .codicon-check'));
		assert.ok(host.querySelector('.conversation-visualize-cons .codicon-error'));
	});

	test('unvalidated visualize object renders the error card without throwing', () => {
		const diagramHost = append(document.body, $('.conversation-visualize-test-host'));
		store.add({ dispose: () => diagramHost.remove() });
		const diagramDisposables = store.add(new DisposableStore());
		const diagramTurn: ConversationStubTurn = {
			id: 'v-unvalidated-diagram',
			kind: 'visualization',
			text: '',
			visualize: { type: 'diagram', mermaid: '' } as ConversationStubTurn['visualize'],
		};
		assert.doesNotThrow(() => {
			renderConversationVisualizeCard(diagramHost, diagramTurn, {
				isExpanded: () => true,
				setExpanded: () => { },
				onLayoutChange: () => { },
			}, diagramDisposables);
		});
		assert.ok(diagramHost.querySelector('[data-visualize-type="error"]'));
		assert.strictEqual(diagramHost.querySelector('.conversation-visualize-diagram'), null);

		const comparisonHost = append(document.body, $('.conversation-visualize-test-host'));
		store.add({ dispose: () => comparisonHost.remove() });
		const comparisonDisposables = store.add(new DisposableStore());
		const comparisonTurn: ConversationStubTurn = {
			id: 'v-unvalidated-comparison',
			kind: 'visualization',
			text: '',
			visualize: { type: 'comparison' } as ConversationStubTurn['visualize'],
		};
		assert.doesNotThrow(() => {
			renderConversationVisualizeCard(comparisonHost, comparisonTurn, {
				isExpanded: () => true,
				setExpanded: () => { },
				onLayoutChange: () => { },
			}, comparisonDisposables);
		});
		assert.ok(comparisonHost.querySelector('[data-visualize-type="error"]'));
		assert.strictEqual(comparisonHost.querySelector('.conversation-visualize-comparison-grid'), null);
		assert.strictEqual(comparisonHost.querySelector('.conversation-visualize-option'), null);
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
		const label = host.querySelector('.conversation-visualize-header-label');
		assert.strictEqual(label?.textContent, "Visualize · Couldn't read this visualization");
		assert.ok(!label?.textContent?.includes('Stub'));
		assert.ok(host.querySelector('.conversation-visualize-error')?.textContent?.includes('payload must be an object'));
	});

	test('comparison without a title uses the comparison name', () => {
		const turn: ConversationStubTurn = {
			id: 'v-comparison-untitled',
			kind: 'visualization',
			text: '',
			visualize: {
				type: 'comparison',
				options: [
					{ name: 'DOM card', pros: ['Simple layout'], cons: ['No mermaid runtime'], recommended: false },
				],
			},
		};
		const { host } = mountCard(turn);
		assert.strictEqual(host.querySelector('.conversation-visualize-header-label')?.textContent, 'Visualize · Comparison');
		assert.ok(!host.querySelector('.conversation-visualize-header-label')?.textContent?.includes('Stub'));
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
				expanded.set(turnId, value);
			},
			onLayoutChange: () => { },
		}, disposables);

		const header = host.querySelector('.conversation-visualize-header') as HTMLButtonElement;
		const body = host.querySelector('.conversation-visualize-body') as HTMLElement;
		assert.ok(header);
		assert.ok(body);
		assert.strictEqual(header.querySelector('.conversation-visualize-header-label')?.textContent, 'Visualize · Diagram');
		assert.strictEqual(body.hidden, false);

		const expand = host.querySelector('.conversation-visualize-expand') as HTMLButtonElement;
		expand.click();
		assert.strictEqual(body.hidden, false);
		assert.strictEqual(header.getAttribute('aria-expanded'), 'true');

		header.click();
		assert.strictEqual(body.hidden, true);
		assert.strictEqual(header.getAttribute('aria-expanded'), 'false');

		header.click();
		assert.strictEqual(body.hidden, false);
		assert.strictEqual(header.getAttribute('aria-expanded'), 'true');
	});
});
