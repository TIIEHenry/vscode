/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Checkbox, ICheckboxStyles, Toggle, TriStateCheckbox, unthemedToggleStyles } from '../../../../browser/ui/toggle/toggle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../common/utils.js';

suite('Toggle', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const checkboxStyles: ICheckboxStyles = {
		checkboxBackground: undefined,
		checkboxBorder: undefined,
		checkboxForeground: undefined,
		checkboxDisabledBackground: undefined,
		checkboxDisabledForeground: undefined,
	};
	const states = [false, true, 'mixed'] as const;
	const activations = [
		{ name: 'click', keyboard: false, activate: (element: HTMLElement) => element.click() },
		{ name: 'Space', keyboard: true, activate: (element: HTMLElement) => keydown(element, 32) },
		{ name: 'Enter', keyboard: true, activate: (element: HTMLElement) => keydown(element, 13) },
	];
	let container: HTMLElement;

	setup(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	teardown(() => {
		container.remove();
	});

	function mount<T extends Toggle | Checkbox | TriStateCheckbox>(control: T): T {
		store.add(control);
		container.appendChild(control.domNode);
		return control;
	}

	function keydown(element: HTMLElement, keyCode: number): void {
		// StandardKeyboardEvent reads the legacy keyCode, including for Space and Enter.
		const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
		Object.defineProperty(event, 'keyCode', { get: () => keyCode });
		element.dispatchEvent(event);
	}

	function projection(control: Toggle | Checkbox | TriStateCheckbox) {
		return {
			checked: control.checked,
			role: control.domNode.getAttribute('role'),
			ariaChecked: control.domNode.getAttribute('aria-checked'),
			label: control.domNode.getAttribute('aria-label'),
			checkedClass: control.domNode.classList.contains('checked'),
			checkIcon: control.domNode.classList.contains('codicon-check'),
			dashIcon: control.domNode.classList.contains('codicon-dash'),
		};
	}

	function expectedProjection(state: boolean | 'mixed', label = 'checkbox', hasCheckIcon = true) {
		return {
			checked: state,
			role: 'checkbox',
			ariaChecked: String(state),
			label,
			checkedClass: state === true,
			checkIcon: hasCheckIcon && state === true,
			dashIcon: state === 'mixed',
		};
	}

	test('focusable toggle is removed from the tab order when disabled', () => {
		const toggle = new Toggle({ title: 'toggle', isChecked: false, ...unthemedToggleStyles });

		// Focusable toggles are tabbable by default.
		assert.strictEqual(toggle.domNode.tabIndex, 0);

		toggle.disable();
		assert.strictEqual(toggle.domNode.tabIndex, -1, 'disabled toggle should not be tabbable');

		toggle.enable();
		assert.strictEqual(toggle.domNode.tabIndex, 0, 'enabled toggle should be tabbable again');

		toggle.dispose();
	});

	test('notFocusable toggle keeps externally managed tabIndex when enabled/disabled', () => {
		const toggle = new Toggle({ title: 'toggle', isChecked: false, notFocusable: true, ...unthemedToggleStyles });

		// notFocusable toggles are never tabbable on their own; their tabIndex is managed by the owner.
		assert.strictEqual(toggle.domNode.tabIndex, -1);

		// The owner (e.g. a toolbar using roving tabindex) may make it focusable.
		toggle.domNode.tabIndex = 0;

		toggle.disable();
		assert.strictEqual(toggle.domNode.tabIndex, 0, 'notFocusable toggle tabIndex should be left untouched on disable');

		toggle.enable();
		assert.strictEqual(toggle.domNode.tabIndex, 0, 'notFocusable toggle tabIndex should be left untouched on enable');

		toggle.dispose();
	});

	suite('TriStateCheckbox', () => {
		for (const initial of states) {
			test(`projects initial ${initial} to the checkbox DOM`, () => {
				const checkbox = mount(new TriStateCheckbox('checkbox', initial, checkboxStyles));
				assert.deepStrictEqual(projection(checkbox), expectedProjection(initial));
			});

			test(`focuses the actual checkbox DOM for ${initial}`, () => {
				const checkbox = mount(new TriStateCheckbox('checkbox', initial, checkboxStyles));
				checkbox.focus();
				assert.strictEqual(document.activeElement, checkbox.domNode);
				assert.strictEqual(checkbox.hasFocus(), true);
			});

			for (const target of states) {
				test(`programmatic ${initial} to ${target} projects without a change event`, () => {
					const checkbox = mount(new TriStateCheckbox('checkbox', initial, checkboxStyles));
					const events: boolean[] = [];
					store.add(checkbox.onChange(keyboard => events.push(keyboard)));
					checkbox.checked = target;
					assert.deepStrictEqual({ projection: projection(checkbox), events }, { projection: expectedProjection(target), events: [] });
				});
			}

			test(`ordinary keys preserve ${initial} without a change event`, () => {
				const checkbox = mount(new TriStateCheckbox('checkbox', initial, checkboxStyles));
				const events: boolean[] = [];
				store.add(checkbox.onChange(keyboard => events.push(keyboard)));
				for (const keyCode of [65, 27, 37, 39]) {
					keydown(checkbox.domNode, keyCode);
				}
				assert.deepStrictEqual({ projection: projection(checkbox), events }, { projection: expectedProjection(initial), events: [] });
			});

			for (const activation of activations) {
				test(`${activation.name} activates ${initial} with a fully projected public event`, () => {
					const checkbox = mount(new TriStateCheckbox('checkbox', initial, checkboxStyles));
					const events: { keyboard: boolean; projection: ReturnType<typeof projection> }[] = [];
					store.add(checkbox.onChange(keyboard => events.push({ keyboard, projection: projection(checkbox) })));
					activation.activate(checkbox.domNode);
					const expected = expectedProjection(initial !== true);
					assert.deepStrictEqual({ projection: projection(checkbox), events }, { projection: expected, events: [{ keyboard: activation.keyboard, projection: expected }] });
				});

				test(`disabled ${initial} ignores ${activation.name}`, () => {
					const checkbox = mount(new TriStateCheckbox('checkbox', initial, checkboxStyles));
					const events: boolean[] = [];
					store.add(checkbox.onChange(keyboard => events.push(keyboard)));
					checkbox.disable();
					activation.activate(checkbox.domNode);
					assert.deepStrictEqual({
						projection: projection(checkbox), events,
						enabled: checkbox.enabled, ariaDisabled: checkbox.domNode.getAttribute('aria-disabled'), tabIndex: checkbox.domNode.tabIndex,
					}, { projection: expectedProjection(initial), events: [], enabled: false, ariaDisabled: 'true', tabIndex: -1 });
				});

				for (const target of states) {
					test(`disabled ${initial} to ${target} assignment survives enable and ${activation.name}`, () => {
						const checkbox = mount(new TriStateCheckbox('checkbox', initial, checkboxStyles));
						const events: { keyboard: boolean; projection: ReturnType<typeof projection> }[] = [];
						store.add(checkbox.onChange(keyboard => events.push({ keyboard, projection: projection(checkbox) })));
						checkbox.disable();
						checkbox.checked = target;
						assert.deepStrictEqual({
							projection: projection(checkbox), events,
							enabled: checkbox.enabled, ariaDisabled: checkbox.domNode.getAttribute('aria-disabled'), tabIndex: checkbox.domNode.tabIndex,
						}, { projection: expectedProjection(target), events: [], enabled: false, ariaDisabled: 'true', tabIndex: -1 });
						checkbox.enable();
						assert.deepStrictEqual({
							projection: projection(checkbox), events,
							enabled: checkbox.enabled, ariaDisabled: checkbox.domNode.getAttribute('aria-disabled'), tabIndex: checkbox.domNode.tabIndex,
						}, { projection: expectedProjection(target), events: [], enabled: true, ariaDisabled: 'false', tabIndex: 0 });
						activation.activate(checkbox.domNode);
						const expected = expectedProjection(target !== true);
						assert.deepStrictEqual({ projection: projection(checkbox), events }, { projection: expected, events: [{ keyboard: activation.keyboard, projection: expected }] });
					});
				}

				for (const target of states) {
					test(`${activation.name} from ${initial} preserves public listener assignment to ${target}`, () => {
						const checkbox = mount(new TriStateCheckbox('checkbox', initial, checkboxStyles));
						const events: { keyboard: boolean; before: ReturnType<typeof projection>; after: ReturnType<typeof projection> }[] = [];
						const observed: ReturnType<typeof projection>[] = [];
						store.add(checkbox.onChange(keyboard => {
							const before = projection(checkbox);
							checkbox.checked = target;
							events.push({ keyboard, before, after: projection(checkbox) });
						}));
						store.add(checkbox.onChange(() => observed.push(projection(checkbox))));
						activation.activate(checkbox.domNode);
						const expected = expectedProjection(target);
						assert.deepStrictEqual({ projection: projection(checkbox), events, observed }, {
							projection: expected,
							events: [{ keyboard: activation.keyboard, before: expectedProjection(initial !== true), after: expected }],
							observed: [expected],
						});
					});
				}
			}
		}
	});

	for (const control of [
		{ name: 'Toggle', create: (checked: boolean) => new Toggle({ title: 'checkbox', isChecked: checked, ...unthemedToggleStyles }) },
		{ name: 'Checkbox', create: (checked: boolean) => new Checkbox('checkbox', checked, checkboxStyles) },
	]) {
		suite(`${control.name} boolean contract`, () => {
			for (const initial of [false, true]) {
				test(`initial ${initial} and programmatic assignments stay boolean without events`, () => {
					const checkbox = mount(control.create(initial));
					const events: boolean[] = [];
					store.add(checkbox.onChange(keyboard => events.push(keyboard)));
					assert.deepStrictEqual(projection(checkbox), expectedProjection(initial, 'checkbox', control.name === 'Checkbox'));
					for (const target of [false, true]) {
						checkbox.checked = target;
						assert.deepStrictEqual({ projection: projection(checkbox), events }, { projection: expectedProjection(target, 'checkbox', control.name === 'Checkbox'), events: [] });
					}
				});

				for (const activation of activations) {
					test(`${activation.name} preserves boolean ${initial} activation and disabled behavior`, () => {
						const checkbox = mount(control.create(initial));
						const events: { keyboard: boolean; projection: ReturnType<typeof projection> }[] = [];
						store.add(checkbox.onChange(keyboard => events.push({ keyboard, projection: projection(checkbox) })));
						checkbox.disable();
						activation.activate(checkbox.domNode);
						assert.deepStrictEqual({
							projection: projection(checkbox), events,
							enabled: checkbox.enabled, ariaDisabled: checkbox.domNode.getAttribute('aria-disabled'), tabIndex: checkbox.domNode.tabIndex,
						}, { projection: expectedProjection(initial, 'checkbox', control.name === 'Checkbox'), events: [], enabled: false, ariaDisabled: 'true', tabIndex: -1 });
						checkbox.enable();
						assert.deepStrictEqual({ enabled: checkbox.enabled, ariaDisabled: checkbox.domNode.getAttribute('aria-disabled'), tabIndex: checkbox.domNode.tabIndex }, { enabled: true, ariaDisabled: 'false', tabIndex: 0 });
						activation.activate(checkbox.domNode);
						const expected = expectedProjection(!initial, 'checkbox', control.name === 'Checkbox');
						assert.deepStrictEqual({ projection: projection(checkbox), events }, { projection: expected, events: [{ keyboard: activation.keyboard, projection: expected }] });
					});
				}
			}
		});
	}
});
