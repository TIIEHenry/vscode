/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationAgentBreadcrumbBox } from '../../browser/conversationAgentBreadcrumb.js';

suite('ConversationAgentBreadcrumb', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function keydown(key: string, keyCode: number): void {
		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, bubbles: true, cancelable: true }));
	}

	function focusedLabel(box: ConversationAgentBreadcrumbBox): string | undefined {
		return box.element.contains(document.activeElement) ? document.activeElement?.textContent ?? undefined : undefined;
	}

	test('arrow keys move between levels and Enter opens the focused ancestor', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		const box = store.add(new ConversationAgentBreadcrumbBox(parent));
		const selected: string[] = [];
		store.add(box.onDidSelect(chatId => selected.push(chatId)));
		box.setItems([
			{ chatId: 'default', title: 'Root', isCurrent: false },
			{ chatId: 'planner', title: 'Planner', isCurrent: false },
			{ chatId: 'worker', title: 'Worker', isCurrent: true },
		]);
		box.layout(400);

		(box.element.querySelector('.monaco-breadcrumbs') as HTMLElement).focus();
		keydown('ArrowLeft', 37);
		const first = focusedLabel(box);
		keydown('ArrowLeft', 37);
		const second = focusedLabel(box);
		keydown('ArrowRight', 39);
		const third = focusedLabel(box);
		keydown('Enter', 13);
		keydown('ArrowRight', 39);
		keydown('Enter', 13);

		assert.deepStrictEqual({ steps: [first, second, third], selected }, {
			steps: ['Worker', 'Planner', 'Worker'],
			selected: [],
		});
	});

	test('Enter on an ancestor selects it', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		const box = store.add(new ConversationAgentBreadcrumbBox(parent));
		const selected: string[] = [];
		store.add(box.onDidSelect(chatId => selected.push(chatId)));
		box.setItems([
			{ chatId: 'default', title: 'Root', isCurrent: false },
			{ chatId: 'worker', title: 'Worker', isCurrent: true },
		]);
		box.layout(400);

		(box.element.querySelector('.monaco-breadcrumbs') as HTMLElement).focus();
		keydown('ArrowLeft', 37);
		keydown('ArrowLeft', 37);
		keydown('Enter', 13);

		assert.deepStrictEqual(selected, ['default']);
	});
});
