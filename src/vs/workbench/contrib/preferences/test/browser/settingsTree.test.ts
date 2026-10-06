/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as DOM from '../../../../../base/browser/dom.js';
import { ITreeNode } from '../../../../../base/browser/ui/tree/tree.js';
import { ToolBar } from '../../../../../base/browser/ui/toolbar/toolbar.js';
import { IAction } from '../../../../../base/common/actions.js';
import { Disposable, DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ISetting } from '../../../../services/preferences/common/preferences.js';
import { SettingsTarget } from '../../browser/preferencesWidgets.js';
import {
	AbstractSettingRenderer,
	SettingArrayRenderer,
	SettingBoolObjectRenderer,
	SettingObjectRenderer
} from '../../browser/settingsTree.js';
import { SettingsTreeSettingElement } from '../../browser/settingsTreeModels.js';
import {
	ListSettingWidget,
	ObjectSettingCheckboxWidget,
	ObjectSettingDropdownWidget
} from '../../browser/settingsWidgets.js';
import {
	AiSearchToggleVisibilityUpdate,
	planAiSearchToggleVisibilityUpdate
} from '../../browser/settingsEditor2Search.js';

class TestSettingRenderer extends AbstractSettingRenderer {
	readonly templateId = 'test';
	toolbarDisposed = false;

	constructor() {
		super(
			[],
			(_setting: ISetting, _settingTarget: SettingsTarget): IAction[] => [],
			undefined!,
			undefined!,
			undefined!,
			{ createInstance: () => ({ dispose() { } }) } as never,
			undefined!,
			undefined!,
			undefined!,
			new TestConfigurationService(),
			undefined!,
			undefined!,
			undefined!,
			undefined!,
			{ setupDelayedHover: () => Disposable.None } as never,
			undefined!,
		);
	}

	renderTemplate(container: HTMLElement) {
		return this.renderCommonTemplate(undefined, container, 'test');
	}

	renderElement(_element: ITreeNode<SettingsTreeSettingElement, never>, _index: number, _templateData: unknown): void {
	}

	protected override renderSettingToolbar(_container: HTMLElement): ToolBar {
		return {
			dispose: () => this.toolbarDisposed = true
		} as unknown as ToolBar;
	}

	protected renderValue(): void {
	}
}

suite('SettingsTree renderer', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('disposes the setting toolbar with its template', () => {
		const renderer = new TestSettingRenderer();
		const template = renderer.renderTemplate(document.createElement('div'));

		assert.strictEqual(renderer.toolbarDisposed, false);
		renderer.disposeTemplate(template);
		assert.strictEqual(renderer.toolbarDisposed, true);

		renderer.dispose();
	});
});

suite('Settings Widgets ReadOnly & AI Toggle (r12)', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createListWidget(container: HTMLElement): ListSettingWidget<any> {
		return disposables.add(new ListSettingWidget(
			container,
			{ getColorTheme: () => undefined } as never,
			{ showContextView: () => undefined, hideContextView: () => undefined } as never,
			{ setupDelayedHover: () => Disposable.None } as never,
			new TestConfigurationService()
		));
	}

	function createObjectDropdownWidget(container: HTMLElement): ObjectSettingDropdownWidget {
		return disposables.add(new ObjectSettingDropdownWidget(
			container,
			{ getColorTheme: () => undefined } as never,
			{ showContextView: () => undefined, hideContextView: () => undefined } as never,
			{ setupDelayedHover: () => Disposable.None } as never,
			new TestConfigurationService()
		));
	}

	function createObjectCheckboxWidget(container: HTMLElement): ObjectSettingCheckboxWidget {
		return disposables.add(new ObjectSettingCheckboxWidget(
			container,
			{ getColorTheme: () => undefined } as never,
			{ showContextView: () => undefined, hideContextView: () => undefined } as never,
			{ setupDelayedHover: () => Disposable.None } as never,
			new TestConfigurationService()
		));
	}

	suite('ListSettingWidget (r12-1)', () => {
		test('isReadOnly disables actions, add button, drag and double click editing', () => {
			const container = DOM.$('div');
			const widget = createListWidget(container);
			const items = [{ value: { type: 'string' as const, data: 'item1' } }];

			widget.setValue(items, { isReadOnly: true });

			assert.strictEqual((widget as any).isReadOnly, true);
			assert.deepStrictEqual((widget as any).getActionsForItem(items[0], 0), []);
			assert.strictEqual((widget as any).isAddButtonVisible(), false);
			assert.strictEqual(container.classList.contains('setting-list-hide-add-button'), true);

			const row = container.querySelector('.setting-list-row') as HTMLElement;
			assert.ok(row);
			assert.strictEqual(row.draggable, false);
			assert.strictEqual(row.classList.contains('draggable'), false);

			const valueElement = container.querySelector('.setting-list-value') as HTMLElement;
			valueElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
			assert.strictEqual(!!(widget as any).model.items[0].editing, false);
		});

		test('editable list enables actions, add button, drag and double click editing', () => {
			const container = DOM.$('div');
			const widget = createListWidget(container);
			const items = [{ value: { type: 'string' as const, data: 'item1' } }];

			widget.setValue(items, { isReadOnly: false });

			assert.strictEqual((widget as any).isReadOnly, false);
			assert.strictEqual((widget as any).getActionsForItem(items[0], 0).length, 2);
			assert.strictEqual((widget as any).isAddButtonVisible(), true);
			assert.strictEqual(container.classList.contains('setting-list-hide-add-button'), false);

			const row = container.querySelector('.setting-list-row') as HTMLElement;
			assert.ok(row);
			assert.strictEqual(row.draggable, true);
			assert.strictEqual(row.classList.contains('draggable'), true);

			const valueElement = container.querySelector('.setting-list-value') as HTMLElement;
			valueElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
			assert.strictEqual((widget as any).model.items[0].editing, true);
		});
	});

	suite('ObjectSettingDropdownWidget (r12-1)', () => {
		test('isReadOnly clears actions and hides add button', () => {
			const container = DOM.$('div');
			const widget = createObjectDropdownWidget(container);
			const items = [{
				key: { type: 'string' as const, data: 'prop' },
				value: { type: 'string' as const, data: 'val' },
				removable: true,
				resetable: true
			}];

			widget.setValue(items, { settingKey: 'test.setting', isReadOnly: true, showAddButton: true });

			assert.strictEqual((widget as any).isReadOnly, true);
			assert.deepStrictEqual((widget as any).getActionsForItem(items[0], 0), []);
			assert.strictEqual((widget as any).isAddButtonVisible(), false);
			assert.strictEqual(container.classList.contains('setting-list-hide-add-button'), true);
		});

		test('editable object widget preserves actions and add button', () => {
			const container = DOM.$('div');
			const widget = createObjectDropdownWidget(container);
			const items = [{
				key: { type: 'string' as const, data: 'prop' },
				value: { type: 'string' as const, data: 'val' },
				removable: true,
				resetable: true
			}];

			widget.setValue(items, { settingKey: 'test.setting', isReadOnly: false, showAddButton: true });

			assert.strictEqual((widget as any).isReadOnly, false);
			assert.strictEqual((widget as any).getActionsForItem(items[0], 0).length > 0, true);
			assert.strictEqual((widget as any).isAddButtonVisible(), true);
			assert.strictEqual(container.classList.contains('setting-list-hide-add-button'), false);
		});
	});

	suite('ObjectSettingCheckboxWidget (r12-1)', () => {
		test('isReadOnly disables checkbox toggle and blocks mousedown on wrapper and label', () => {
			const container = DOM.$('div');
			const widget = createObjectCheckboxWidget(container);
			const items = [{
				key: { type: 'string' as const, data: 'feature.enabled' },
				value: { type: 'boolean' as const, data: false },
				removable: false as const,
				resetable: true
			}];

			widget.setValue(items, { settingKey: 'test.setting', isReadOnly: true });

			assert.strictEqual((widget as any).isReadOnly, true);

			let changeFired = false;
			disposables.add(widget.onDidChangeList(() => { changeFired = true; }));

			const wrapper = container.querySelector('.setting-list-object-input-key-checkbox') as HTMLElement;
			assert.ok(wrapper);
			const checkbox = wrapper.querySelector('.setting-value-checkbox') as HTMLElement;
			assert.ok(checkbox);
			assert.strictEqual(checkbox.getAttribute('aria-disabled'), 'true');
			assert.strictEqual(checkbox.classList.contains('disabled'), true);

			// Mousedown on wrapper does not toggle or emit change
			wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			assert.strictEqual(changeFired, false);

			// Mousedown on label text does not toggle or emit change
			const label = container.querySelector('.setting-list-object-value') as HTMLElement;
			assert.ok(label);
			label.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
			assert.strictEqual(changeFired, false);
		});

		test('editable checkbox toggles value on mousedown', () => {
			const container = DOM.$('div');
			const widget = createObjectCheckboxWidget(container);
			const items = [{
				key: { type: 'string' as const, data: 'feature.enabled' },
				value: { type: 'boolean' as const, data: false },
				removable: false as const,
				resetable: true
			}];

			widget.setValue(items, { settingKey: 'test.setting', isReadOnly: false });

			assert.strictEqual((widget as any).isReadOnly, false);

			let changeEvent: any;
			disposables.add(widget.onDidChangeList(e => { changeEvent = e; }));

			const wrapper = container.querySelector('.setting-list-object-input-key-checkbox') as HTMLElement;
			assert.ok(wrapper);
			wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

			assert.ok(changeEvent);
			assert.strictEqual(changeEvent.type, 'change');
			assert.strictEqual(changeEvent.newItem.value.data, true);
		});
	});

	suite('Renderers pass isReadOnly down to widgets (r12-1)', () => {
		test('SettingArrayRenderer forwards policy and agentsWindow readonly', () => {
			const captures: any[] = [];
			const mockWidget = {
				setValue: (_val: any, opts: any) => captures.push(opts),
				cancelEdit: () => {}
			};
			const store = disposables.add(new DisposableStore());
			const template = {
				listWidget: mockWidget,
				containerElement: DOM.$('div'),
				validationErrorMessageElement: DOM.$('div'),
				elementDisposables: store
			} as any;

			const render = (SettingArrayRenderer.prototype as any).renderValue;

			// hasPolicyValue
			render.call(null, { setting: { key: 'test.array' }, value: ['item'], scopeValue: ['item'], defaultValue: [], hasPolicyValue: true, isAgentsWindowReadOnly: false }, template, () => {});
			assert.strictEqual(captures[0].isReadOnly, true);

			// isAgentsWindowReadOnly
			render.call(null, { setting: { key: 'test.array' }, value: ['item'], scopeValue: ['item'], defaultValue: [], hasPolicyValue: false, isAgentsWindowReadOnly: true }, template, () => {});
			assert.strictEqual(captures[1].isReadOnly, true);

			// editable
			render.call(null, { setting: { key: 'test.array' }, value: ['item'], scopeValue: ['item'], defaultValue: [], hasPolicyValue: false, isAgentsWindowReadOnly: false }, template, () => {});
			assert.strictEqual(captures[2].isReadOnly, false);
		});

		test('SettingObjectRenderer forwards policy and agentsWindow readonly', () => {
			const captures: any[] = [];
			const mockWidget = {
				setValue: (_val: any, opts: any) => captures.push(opts),
				cancelEdit: () => {}
			};
			const store = disposables.add(new DisposableStore());
			const template = {
				objectDropdownWidget: mockWidget,
				containerElement: DOM.$('div'),
				validationErrorMessageElement: DOM.$('div'),
				elementDisposables: store
			} as any;

			const render = (SettingObjectRenderer.prototype as any).renderValue;

			// hasPolicyValue
			render.call(null, { setting: { key: 'test.obj' }, value: {}, scopeValue: {}, defaultValue: {}, hasPolicyValue: true, isAgentsWindowReadOnly: false }, template, () => {});
			assert.strictEqual(captures[0].isReadOnly, true);

			// isAgentsWindowReadOnly
			render.call(null, { setting: { key: 'test.obj' }, value: {}, scopeValue: {}, defaultValue: {}, hasPolicyValue: false, isAgentsWindowReadOnly: true }, template, () => {});
			assert.strictEqual(captures[1].isReadOnly, true);

			// editable
			render.call(null, { setting: { key: 'test.obj' }, value: {}, scopeValue: {}, defaultValue: {}, hasPolicyValue: false, isAgentsWindowReadOnly: false }, template, () => {});
			assert.strictEqual(captures[2].isReadOnly, false);
		});

		test('SettingBoolObjectRenderer forwards policy and agentsWindow readonly', () => {
			const captures: any[] = [];
			const mockWidget = {
				setValue: (_val: any, opts: any) => captures.push(opts)
			};
			const template = {
				objectCheckboxWidget: mockWidget
			} as any;

			const render = (SettingBoolObjectRenderer.prototype as any).renderValue;

			// hasPolicyValue
			render.call(null, { setting: { key: 'test.boolObj' }, hasPolicyValue: true, isAgentsWindowReadOnly: false }, template, () => {});
			assert.strictEqual(captures[0].isReadOnly, true);

			// isAgentsWindowReadOnly
			render.call(null, { setting: { key: 'test.boolObj' }, hasPolicyValue: false, isAgentsWindowReadOnly: true }, template, () => {});
			assert.strictEqual(captures[1].isReadOnly, true);

			// editable
			render.call(null, { setting: { key: 'test.boolObj' }, hasPolicyValue: false, isAgentsWindowReadOnly: false }, template, () => {});
			assert.strictEqual(captures[2].isReadOnly, false);
		});
	});

	suite('AI Search Toggle Visibility (r12-2)', () => {
		test('keeps toggle visible when alreadyVisible and canShowToggle', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(true, true), AiSearchToggleVisibilityUpdate.None);
		});

		test('removes toggle when alreadyVisible and !canShowToggle', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(true, false), AiSearchToggleVisibilityUpdate.Remove);
		});

		test('inserts toggle when !alreadyVisible and canShowToggle', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(false, true), AiSearchToggleVisibilityUpdate.Insert);
		});

		test('keeps toggle hidden when !alreadyVisible and !canShowToggle', () => {
			assert.strictEqual(planAiSearchToggleVisibilityUpdate(false, false), AiSearchToggleVisibilityUpdate.None);
		});
	});
});
