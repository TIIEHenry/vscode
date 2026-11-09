/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { renderConversationVisualizeCard } from '../../browser/conversationVisualizeCard.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('ConversationVisualizeCard ARIA', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountCard(initialExpanded: boolean): { readonly host: HTMLElement; readonly disposables: DisposableStore } {
		const host = document.createElement('div');
		document.body.appendChild(host);
		store.add({ dispose: () => host.remove() });
		const disposables = store.add(new DisposableStore());
		let expanded = initialExpanded;
		const turn: ConversationStubTurn = {
			id: 'aria-visualize-card',
			kind: 'visualization',
			text: '',
			visualize: {
				type: 'diagram',
				mermaid: 'flowchart TD\n  one --> two',
			},
		};
		renderConversationVisualizeCard(host, turn, {
			isExpanded: () => expanded,
			setExpanded: (_turnId, next) => { expanded = next; },
			onLayoutChange: () => { },
		}, disposables);
		return { host, disposables };
	}

	test('expanded disclosure button controls the visible body', () => {
		const { host } = mountCard(true);
		const header = host.querySelector('.conversation-visualize-header') as HTMLButtonElement | null;
		const body = host.querySelector('.conversation-visualize-body') as HTMLElement | null;
		assert.ok(header);
		assert.ok(body);
		assert.strictEqual(header!.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(header!.getAttribute('aria-controls'), body!.id);
		assert.ok(body!.id);
		assert.strictEqual(body!.hidden, false);
	});

	test('clicking the disclosure keeps aria-expanded and hidden state in sync', () => {
		const { host } = mountCard(true);
		const header = host.querySelector('.conversation-visualize-header') as HTMLButtonElement;
		const body = host.querySelector('.conversation-visualize-body') as HTMLElement;
		header.click();
		assert.strictEqual(header.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(header.getAttribute('aria-controls'), body.id);
		assert.strictEqual(body.hidden, true);
		header.click();
		assert.strictEqual(header.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(body.hidden, false);
	});
});
