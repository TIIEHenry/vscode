/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IAction, Separator } from '../../../../../base/common/actions.js';
import { AnchorAlignment } from '../../../../../base/browser/ui/contextview/contextview.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IContextMenuDelegate } from '../../../../../base/browser/contextmenu.js';
import type { IContextMenuService, IContextViewService } from '../../../../../platform/contextview/browser/contextView.js';
import { attachComposerPicker } from '../../browser/conversationComposerPicker.js';

suite('Conversation composer picker', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function setup(labels: string[], selected: number, footer?: () => void) {
		const disposables = store.add(new DisposableStore());
		const container = mainWindow.document.createElement('div');
		const select = mainWindow.document.createElement('select');
		for (const text of labels) {
			const option = mainWindow.document.createElement('option');
			option.text = text;
			select.appendChild(option);
		}
		select.selectedIndex = selected;
		container.appendChild(select);
		mainWindow.document.body.appendChild(container);
		disposables.add({ dispose: () => container.remove() });

		let delegate: IContextMenuDelegate | undefined;
		let hidden = 0;
		const contextViewService = {
			hideContextView() {
				const current = delegate;
				delegate = undefined;
				hidden++;
				current?.onHide?.(true);
			},
		} as unknown as IContextViewService;
		const contextMenuService = {
			showContextMenu(next: IContextMenuDelegate) {
				delegate = next;
			},
		} as unknown as IContextMenuService;

		disposables.add(attachComposerPicker(container, contextViewService, contextMenuService, {
			ariaLabel: 'Model',
			alignment: AnchorAlignment.RIGHT,
			footer: footer ? { label: 'Manage Models…', run: footer } : undefined,
		}));
		const changes: number[] = [];
		select.addEventListener('change', () => changes.push(select.selectedIndex));
		const actions = () => delegate?.getActions() ?? [];
		const run = async (action: IAction) => {
			await action.run();
			contextViewService.hideContextView();
		};
		return { select, changes, hidden: () => hidden, actions, run, isOpen: () => !!delegate, disposables };
	}

	const press = (target: Element) => target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
	const key = (target: Element, keyName: string, keyCode: number) => {
		const event = new KeyboardEvent('keydown', { key: keyName, keyCode, bubbles: true, cancelable: true });
		target.dispatchEvent(event);
		return event;
	};

	test('pressing the control opens the workbench menu with the current value checked', () => {
		const { select, actions, isOpen, disposables } = setup(['gpt-4o', 'ark-code-latest'], 1);
		press(select);
		assert.strictEqual(isOpen(), true);
		assert.strictEqual(select.getAttribute('aria-haspopup'), 'menu');
		assert.strictEqual(select.getAttribute('aria-expanded'), 'true');
		const items = actions();
		assert.strictEqual(items[0].label, 'gpt-4o');
		assert.strictEqual(items[0].checked, false);
		assert.strictEqual(items[1].label, 'ark-code-latest');
		assert.strictEqual(items[1].checked, true);
		disposables.dispose();
	});

	test('picker defensively omits No model when actual models are present', () => {
		const { select, actions, isOpen, disposables } = setup(['No model', 'ark-code-latest'], 1);
		press(select);
		assert.strictEqual(isOpen(), true);
		const items = actions();
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, 'ark-code-latest');
		assert.strictEqual(items[0].checked, true);
		disposables.dispose();
	});

	test('picker displays No model when it is the only option', () => {
		const { select, actions, isOpen, disposables } = setup(['No model'], 0);
		press(select);
		assert.strictEqual(isOpen(), true);
		const items = actions();
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].label, 'No model');
		assert.strictEqual(items[0].checked, true);
		disposables.dispose();
	});

	test('running an action writes the index back and fires change once', async () => {
		const { select, actions, changes, hidden, run, disposables } = setup(['A', 'B', 'C'], 0);
		press(select);
		await run(actions()[2]);
		assert.deepStrictEqual(changes, [2]);
		assert.strictEqual(hidden(), 1);
		press(select);
		await run(actions()[2]);
		assert.deepStrictEqual(changes, [2], 'picking the current row is not a change');
		disposables.dispose();
	});

	test('pressing the control again closes the menu', () => {
		const { select, hidden, isOpen, disposables } = setup(['A', 'B'], 0);
		press(select);
		press(select);
		assert.strictEqual(hidden(), 1);
		assert.strictEqual(isOpen(), false);
		assert.strictEqual(select.getAttribute('aria-expanded'), 'false');
		disposables.dispose();
	});

	test('the footer entry is a menu item after a separator', async () => {
		let ran = 0;
		const { select, actions, hidden, run, disposables } = setup(['A'], 0, () => ran++);
		press(select);
		const items = actions();
		assert.ok(items[1] instanceof Separator);
		assert.strictEqual(items[2].label, 'Manage Models…');
		await run(items[2]);
		assert.strictEqual(ran, 1);
		assert.strictEqual(hidden(), 1);
		disposables.dispose();
	});

	test('disabled controls do not open', () => {
		const { select, isOpen, disposables } = setup(['A', 'B'], 0);
		select.disabled = true;
		press(select);
		assert.strictEqual(isOpen(), false);
		disposables.dispose();
	});

	test('value-changing keys on the control open the menu instead of changing the value', () => {
		const { select, changes, isOpen, disposables } = setup(['A', 'B', 'C'], 0);
		const typed = key(select, 'c', 67);
		assert.strictEqual(typed.defaultPrevented, true);
		assert.strictEqual(isOpen(), false);
		const end = key(select, 'End', 35);
		assert.strictEqual(end.defaultPrevented, true);
		assert.strictEqual(isOpen(), true);
		assert.strictEqual(select.selectedIndex, 0);
		assert.deepStrictEqual(changes, []);
		disposables.dispose();
	});

	test('native select mode does not capture the click or mark the control as a menu', () => {
		const disposables = store.add(new DisposableStore());
		const container = mainWindow.document.createElement('div');
		const select = mainWindow.document.createElement('select');
		const option = mainWindow.document.createElement('option');
		option.text = 'Ask';
		select.appendChild(option);
		container.appendChild(select);
		mainWindow.document.body.appendChild(container);
		disposables.add({ dispose: () => container.remove() });
		let opened = false;
		disposables.add(attachComposerPicker(container, { hideContextView() { } } as unknown as IContextViewService, {
			showContextMenu() { opened = true; },
		} as unknown as IContextMenuService, {
			ariaLabel: 'Permission',
			alignment: AnchorAlignment.LEFT,
			useNativeSelect: true,
		}));
		press(select);
		assert.strictEqual(opened, false);
		assert.strictEqual(select.getAttribute('aria-haspopup'), null);
		disposables.dispose();
	});

	test('a pick against options replaced while open is dropped', async () => {
		const { select, actions, changes, hidden, run, disposables } = setup(['Probing…', 'B'], 0);
		press(select);
		select.options[1].text = 'Other';
		await run(actions()[1]);
		assert.strictEqual(hidden(), 1);
		assert.deepStrictEqual(changes, []);
		disposables.dispose();
	});

	test('getItemDetail supplies detail to keybinding and action without altering label', () => {
		const disposables = store.add(new DisposableStore());
		const container = mainWindow.document.createElement('div');
		const select = mainWindow.document.createElement('select');
		for (const text of ['Session 1', 'Session 2']) {
			const option = mainWindow.document.createElement('option');
			option.text = text;
			select.appendChild(option);
		}
		select.selectedIndex = 0;
		container.appendChild(select);
		mainWindow.document.body.appendChild(container);
		disposables.add({ dispose: () => container.remove() });

		let delegate: IContextMenuDelegate | undefined;
		const contextViewService = {
			hideContextView() { },
		} as unknown as IContextViewService;
		const contextMenuService = {
			showContextMenu(next: IContextMenuDelegate) {
				delegate = next;
			},
		} as unknown as IContextMenuService;

		disposables.add(attachComposerPicker(container, contextViewService, contextMenuService, {
			ariaLabel: 'Session',
			getItemDetail: (index: number) => index === 0 ? '5 messages' : undefined,
		}));

		press(select);
		assert.ok(delegate);
		const actions = delegate.getActions();
		assert.strictEqual(actions[0].label, 'Session 1');
		assert.strictEqual((actions[0] as { detail?: string }).detail, '5 messages');
		assert.strictEqual(delegate.getKeyBinding?.(actions[0])?.getLabel(), '5 messages');

		assert.strictEqual(actions[1].label, 'Session 2');
		assert.strictEqual((actions[1] as { detail?: string }).detail, undefined);
		assert.strictEqual(delegate.getKeyBinding?.(actions[1]), undefined);

		disposables.dispose();
	});
});
