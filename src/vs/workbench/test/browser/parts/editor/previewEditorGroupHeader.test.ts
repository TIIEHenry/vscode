/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { $ } from '../../../../../base/browser/dom.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IMenu, IMenuService, isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { StorageScope } from '../../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../../platform/theme/common/themeService.js';
import { TestColorTheme, TestThemeService } from '../../../../../platform/theme/test/common/testThemeService.js';
import { ActiveEditorContext } from '../../../../common/contextkeys.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { Memento } from '../../../../common/memento.js';
import { EDITOR_GROUP_HEADER_BORDER, EDITOR_GROUP_HEADER_TABS_BORDER } from '../../../../common/theme.js';
import { IEditorGroupView } from '../../../../browser/parts/editor/editor.js';
import { CategorizedMainEditorPart } from '../../../../browser/parts/editor/categorizedMainEditorPart.js';
import { setup as setupEditorCommands } from '../../../../browser/parts/editor/editorCommands.js';
import { MainEditorPart } from '../../../../browser/parts/editor/editorPart.js';
import { EditorParts } from '../../../../browser/parts/editor/editorParts.js';
import { GroupDirection, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { PreviewCategorizedContext } from '../../../../services/editor/common/previewCategoryRouting.js';
import { IPreviewCategoryService, PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';
import { ITestInstantiationService, registerTestEditor, TestFileEditorInput, TestMenuService, workbenchInstantiationService, workbenchTeardown } from '../../../browser/workbenchTestServices.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

class RecordingMainEditorPart extends MainEditorPart {
	readonly doubleClickedGroups: number[] = [];

	override handleEmptyGroupDoubleClick(group: IEditorGroupView): boolean {
		this.doubleClickedGroups.push(group.id);
		return true;
	}
}

class RecordingCategorizedMainEditorPart extends CategorizedMainEditorPart {
	readonly doubleClickedGroups: number[] = [];

	override handleEmptyGroupDoubleClick(group: IEditorGroupView): boolean {
		this.doubleClickedGroups.push(group.id);
		return true;
	}
}

class MainEditorParts extends EditorParts {
	protected override createMainEditorPart(): MainEditorPart {
		return this.instantiationService.createInstance(RecordingMainEditorPart, this);
	}
}

class CategorizedEditorParts extends EditorParts {
	protected override createMainEditorPart(): MainEditorPart {
		return this.instantiationService.createInstance(RecordingCategorizedMainEditorPart, this);
	}
}

class RecordingMenuService extends TestMenuService {
	readonly created: { id: MenuId; contextKeyService: IContextKeyService }[] = [];

	override createMenu(id: MenuId, contextKeyService: IContextKeyService): IMenu {
		this.created.push({ id, contextKeyService });
		return super.createMenu(id, contextKeyService);
	}
}

/** Style rules of the loaded CSS modules; the unit test runners load each one as an `@import` rule. */
function loadedStyleRules(): CSSStyleRule[] {
	const rules: CSSStyleRule[] = [];
	const visit = (list: CSSRuleList) => {
		for (const rule of Array.from(list)) {
			if (rule instanceof CSSImportRule && rule.styleSheet) {
				visit(rule.styleSheet.cssRules);
			} else if (rule instanceof CSSStyleRule) {
				rules.push(rule);
			}
		}
	};
	for (const sheet of Array.from(document.styleSheets)) {
		try {
			visit(sheet.cssRules);
		} catch {
			// cross-origin sheet
		}
	}
	return rules;
}

suite('Preview Editor Group Header', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForPreviewHeader';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForPreviewHeader';

	const disposables = new DisposableStore();
	let instantiationService: ITestInstantiationService | undefined;

	suiteSetup(() => {
		// These startup registrations live for the test process, outside each test's disposable scope.
		if (!CommandsRegistry.getCommand('workbench.action.preview.switchCategoryCode')) {
			setupEditorCommands();
		}
	});

	setup(() => {
		disposables.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput)], TEST_EDITOR_INPUT_ID));
	});

	teardown(async () => {
		if (instantiationService) {
			await workbenchTeardown(instantiationService);
			instantiationService = undefined;
		}
		disposables.clear();
		// The editor-part memento cache is process-global and keyed only by part id.
		Memento.clear(StorageScope.WORKSPACE);
		Memento.clear(StorageScope.PROFILE);
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	/** Mounts the main editor part as the workbench does: `.monaco-workbench > .part.editor`, in the document. */
	async function mount<T extends MainEditorPart>(ctor: typeof EditorParts, configure?: (service: ITestInstantiationService) => void): Promise<{ part: T; parts: EditorParts; service: ITestInstantiationService; workbench: HTMLElement }> {
		const service = workbenchInstantiationService(undefined, disposables);
		service.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));
		configure?.(service);

		const parts = disposables.add(service.createInstance(ctor));
		const workbench = $('.monaco-workbench');
		const partElement = $('.part.editor');
		workbench.appendChild(partElement);
		document.body.appendChild(workbench);
		disposables.add(toDisposable(() => workbench.remove()));

		parts.mainPart.create(partElement);
		parts.mainPart.layout(1080, 800, 0, 0);
		await parts.whenReady;
		service.stub(IEditorGroupsService, parts);
		instantiationService = service;

		return { part: parts.mainPart as T, parts, service, workbench };
	}

	function input(resource: URI): TestFileEditorInput {
		return disposables.add(new TestFileEditorInput(resource, TEST_EDITOR_INPUT_ID));
	}

	function titleOf(group: IEditorGroupView): HTMLElement {
		const title = group.element.querySelector(':scope > .title');
		assert.ok(title instanceof HTMLElement, 'group title');
		return title;
	}

	test('the main part labels its groups Preview', async () => {
		const { part } = await mount<RecordingMainEditorPart>(MainEditorParts);

		assert.strictEqual(part.activeGroup.label, 'Preview: Group 1');
	});

	test('an empty group keeps its header and shows a placeholder tab', async () => {
		const { part } = await mount<RecordingMainEditorPart>(MainEditorParts);
		const group = part.activeGroup;
		const title = titleOf(group);
		const tabsAndActions = title.querySelector('.tabs-and-actions-container');
		assert.ok(tabsAndActions instanceof HTMLElement);

		assert.strictEqual(group.isEmpty, true);
		assert.notStrictEqual(mainWindow.getComputedStyle(title).display, 'none', 'empty group header stays visible');
		assert.strictEqual(tabsAndActions.classList.contains('empty'), false, 'tabs row counts as visible while tabs are shown');
		assert.notStrictEqual(mainWindow.getComputedStyle(tabsAndActions).display, 'none');

		const placeholder = () => title.querySelector('.tabs-container > .tab.empty-placeholder');
		const tab = placeholder();
		assert.ok(tab instanceof HTMLElement, 'placeholder tab');
		assert.strictEqual(tab.textContent, 'Preview: Group 1');
		assert.strictEqual(mainWindow.getComputedStyle(tab).cursor, 'default');

		const editor = input(URI.file('/src/app.ts'));
		await group.openEditor(editor, { pinned: true });
		assert.strictEqual(placeholder(), null, 'a real tab replaces the placeholder');

		await group.closeEditor(editor);
		assert.strictEqual(group.isEmpty, true);
		assert.strictEqual(placeholder()?.textContent, 'Preview: Group 1', 'the placeholder comes back when the last editor closes');
	});

	test('a split group that closes its last editor leaves no tabs layout frame behind', async () => {
		const { part } = await mount<RecordingMainEditorPart>(MainEditorParts);
		const side = part.addGroup(part.activeGroup, GroupDirection.RIGHT);
		const editor = input(URI.file('/src/side.ts'));
		await side.openEditor(editor, { pinned: true });
		const sideId = side.id;

		// The group removes itself while closing and then forwards the close to its disposed tabs control.
		await side.closeEditor(editor);
		assert.strictEqual(part.getGroup(sideId), undefined);

		await new Promise<void>(resolve => mainWindow.requestAnimationFrame(() => resolve()));
	});

	test('an empty group builds its editor title actions from the group context keys', async () => {
		const menuService = new RecordingMenuService();
		const { part } = await mount<RecordingMainEditorPart>(MainEditorParts, service => service.stub(IMenuService, menuService));
		const group = part.activeGroup;
		assert.strictEqual(group.isEmpty, true);

		menuService.created.length = 0;
		const store = new DisposableStore();
		group.createEditorActions(store);
		store.dispose();

		assert.deepStrictEqual(menuService.created.map(({ id, contextKeyService }) => ({ id, scoped: contextKeyService === group.scopedContextKeyService })), [{ id: MenuId.EditorTitle, scoped: true }]);
	});

	test('the header bottom border prefers the tabs border color', async () => {
		const { part, service } = await mount<RecordingMainEditorPart>(MainEditorParts);
		const themeService = service.invokeFunction(accessor => accessor.get(IThemeService)) as TestThemeService;
		const title = titleOf(part.activeGroup);

		themeService.setTheme(new TestColorTheme({ [EDITOR_GROUP_HEADER_TABS_BORDER]: '#ff0000', [EDITOR_GROUP_HEADER_BORDER]: '#00ff00' }));
		assert.strictEqual(title.classList.contains('title-border-bottom'), true);
		assert.strictEqual(title.style.getPropertyValue('--title-border-bottom-color'), '#ff0000');

		themeService.setTheme(new TestColorTheme({ [EDITOR_GROUP_HEADER_BORDER]: '#00ff00' }));
		assert.strictEqual(title.style.getPropertyValue('--title-border-bottom-color'), '#00ff00');

		themeService.setTheme(new TestColorTheme({}));
		assert.strictEqual(title.classList.contains('title-border-bottom'), false);
	});

	test('the main editor and the sources part draw one continuous divider', async () => {
		const { part, workbench } = await mount<RecordingMainEditorPart>(MainEditorParts);
		workbench.style.setProperty('--vscode-sideBar-border', 'rgb(1, 2, 3)');

		const editorStyle = mainWindow.getComputedStyle(part.element);
		assert.deepStrictEqual([editorStyle.borderLeftWidth, editorStyle.borderLeftStyle, editorStyle.borderLeftColor], ['1px', 'solid', 'rgb(1, 2, 3)']);

		for (const className of ['auxiliary', 'conversation-editor-part-container']) {
			const other = workbench.appendChild($(`.part.editor.${className}`));
			assert.strictEqual(mainWindow.getComputedStyle(other).borderLeftWidth, '0px', `${className} part has no divider`);
			other.remove();
		}

		const stylesheet = document.createElement('link');
		stylesheet.rel = 'stylesheet';
		stylesheet.href = new URL('../../../../browser/parts/sources/media/sourcesPart.css', import.meta.url).href;
		disposables.add(toDisposable(() => stylesheet.remove()));
		await new Promise<void>((resolve, reject) => {
			stylesheet.onload = () => resolve();
			stylesheet.onerror = () => reject(new Error('sourcesPart.css failed to load'));
			document.head.appendChild(stylesheet);
		});

		const sources = workbench.appendChild($('.part.sources'));
		const sourcesStyle = mainWindow.getComputedStyle(sources);
		assert.deepStrictEqual([sourcesStyle.borderLeftWidth, sourcesStyle.borderLeftStyle, sourcesStyle.borderLeftColor], ['1px', 'solid', 'rgb(1, 2, 3)']);
		assert.deepStrictEqual([sourcesStyle.borderTopWidth, sourcesStyle.borderTopStyle, sourcesStyle.borderTopColor], ['1px', 'solid', 'rgb(1, 2, 3)'], 'Sources is separated from Preview above it');

		workbench.classList.add('nomaineditorarea');
		assert.strictEqual(mainWindow.getComputedStyle(sources).borderTopWidth, '0px', 'no top divider without a Preview above');
	});

	test('the categorized main part owns the only category bar, above the grid', async () => {
		const plain = await mount<RecordingMainEditorPart>(MainEditorParts);
		assert.strictEqual(plain.part.element.querySelectorAll(':scope > .content > .preview-category-bar').length, 1, 'MainEditorPart mounts the bar');
		assert.strictEqual(plain.part.element.querySelector('.editor-group-container .preview-category-switcher'), null, 'the tabs control does not mount it');

		const parts = disposables.add(plain.service.createInstance(EditorParts));
		assert.ok(parts.mainPart instanceof CategorizedMainEditorPart, 'the workbench main part is the categorized Preview part');
	});

	test('category counts sit beside the 16px icon in the metadata size', async () => {
		const { part, service, workbench } = await mount<RecordingCategorizedMainEditorPart>(CategorizedEditorParts);
		workbench.style.setProperty('--vscode-fontSize-label2', '10px');
		workbench.style.setProperty('--vscode-codiconFontSize', '15px');
		service.invokeFunction(accessor => accessor.get(IPreviewCategoryService)).setCategoryCounts({ [PreviewCategory.Code]: 3, [PreviewCategory.Planning]: 0, [PreviewCategory.Artifacts]: 0 });

		const codeTab = part.element.querySelector(`.preview-category-tab[data-category="${PreviewCategory.Code}"]`);
		const overviewTab = part.element.querySelector(`.preview-category-tab[data-category="${PreviewCategory.Overview}"]`);
		assert.ok(codeTab instanceof HTMLElement && overviewTab instanceof HTMLElement);
		const count = codeTab.querySelector('.category-count');
		const icon = codeTab.querySelector('.category-icon');
		assert.ok(count instanceof HTMLElement && icon instanceof HTMLElement);

		assert.strictEqual(count.textContent, '3');
		const countStyle = mainWindow.getComputedStyle(count);
		assert.strictEqual(countStyle.position, 'static', 'count stays in flow beside the icon, not an overlay badge');
		assert.strictEqual(countStyle.fontSize, '10px', 'count uses the label2 metadata size');

		const iconStyle = mainWindow.getComputedStyle(icon);
		assert.deepStrictEqual([iconStyle.width, iconStyle.height, iconStyle.fontSize], ['16px', '16px', '15px'], 'icon box is 16px and uses the codicon size');
		assert.strictEqual(mainWindow.getComputedStyle(codeTab).minWidth, '24px', 'icon hit target stays 24px');
		assert.ok(codeTab.offsetWidth > overviewTab.offsetWidth, 'a tab grows when its count is shown');

		const switcher = part.element.querySelector('.preview-category-switcher');
		assert.ok(switcher instanceof HTMLElement);
		switcher.classList.add('hide-counts');
		assert.strictEqual(mainWindow.getComputedStyle(count).display, 'none', 'a row that does not fit hides counts');
	});

	test('the empty category state uses the body and label size tokens and keeps a focus ring', async () => {
		const { part, workbench } = await mount<RecordingCategorizedMainEditorPart>(CategorizedEditorParts);
		workbench.style.setProperty('--vscode-fontSize-body1', '14px');
		workbench.style.setProperty('--vscode-fontSize-label1', '10px');

		const card = part.activeGroup.element.querySelector('.preview-category-empty-state');
		assert.ok(card, 'the categorized part draws the category empty state');
		const title = card.querySelector('.preview-category-empty-title');
		const desc = card.querySelector('.preview-category-empty-desc');
		assert.ok(title instanceof HTMLElement && desc instanceof HTMLElement);
		assert.strictEqual(mainWindow.getComputedStyle(title).fontSize, '14px', 'empty title uses body1');
		assert.strictEqual(mainWindow.getComputedStyle(desc).fontSize, '10px', 'empty description uses label1');

		const focusRing = loadedStyleRules().find(rule => rule.selectorText.endsWith('.preview-category-empty-action-button:focus-visible') && !rule.selectorText.includes('.hc-'));
		assert.ok(focusRing, 'empty actions have a keyboard focus rule');
		assert.ok(focusRing.style.getPropertyValue('outline').startsWith('1px solid'), focusRing.style.getPropertyValue('outline'));
	});

	test('empty groups use the category empty state only on the categorized part', async () => {
		const plain = await mount<RecordingMainEditorPart>(MainEditorParts);
		assert.strictEqual(plain.part.element.querySelector('.preview-category-empty-state'), null);
	});

	test('double click on an empty group goes to the editor part, except on the empty state card', async () => {
		const plain = await mount<RecordingMainEditorPart>(MainEditorParts);
		plain.part.activeGroup.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		assert.deepStrictEqual(plain.part.doubleClickedGroups, [plain.part.activeGroup.id]);

		await workbenchTeardown(plain.service);
		instantiationService = undefined;
		disposables.clear();
		Memento.clear(StorageScope.WORKSPACE);
		Memento.clear(StorageScope.PROFILE);
		disposables.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput)], TEST_EDITOR_INPUT_ID));

		const { part } = await mount<RecordingCategorizedMainEditorPart>(CategorizedEditorParts);
		const card = part.activeGroup.element.querySelector('.preview-category-empty-state');
		assert.ok(card);
		card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		assert.deepStrictEqual(part.doubleClickedGroups, [], 'the card owns its own clicks');
		part.activeGroup.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		assert.deepStrictEqual(part.doubleClickedGroups, [part.activeGroup.id]);
	});

	test('empty categorized preview parks the group actions on the category bar', async () => {
		const { part } = await mount<RecordingCategorizedMainEditorPart>(CategorizedEditorParts);
		const group = part.activeGroup;
		const bar = part.element.querySelector(':scope > .content > .preview-category-bar');
		assert.ok(bar instanceof HTMLElement);

		const title = titleOf(group);
		assert.deepStrictEqual([mainWindow.getComputedStyle(title).position, mainWindow.getComputedStyle(title).top], ['absolute', '-28px'], 'empty title is lifted onto the 28px category row');

		const slot = bar.querySelector(':scope > .preview-category-empty-group-actions');
		assert.ok(slot instanceof HTMLElement);
		assert.strictEqual(slot.style.display, 'flex');
		assert.strictEqual(mainWindow.getComputedStyle(slot).height, '28px', 'parked actions stay on the 28px row');
		assert.ok(slot.querySelector(':scope > .editor-group-container-toolbar'), 'the close toolbar is parked while the group is empty');
		assert.strictEqual(group.element.querySelector(':scope > .editor-group-container-toolbar'), null);

		await group.openEditor(input(URI.file('/src/app.ts')), { pinned: true });
		assert.strictEqual(slot.style.display, 'none');
		assert.ok(group.element.querySelector(':scope > .editor-group-container-toolbar'), 'the toolbar goes back to its group');
	});

	test('category commands are in the command palette only on the categorized part', () => {
		const paletteWhen = (id: string) => MenuRegistry.getMenuItems(MenuId.CommandPalette).find(item => isIMenuItem(item) && item.command.id === id)?.when;
		const categoryOf = (id: string) => {
			const category = MenuRegistry.getCommand(id)?.category;
			return typeof category === 'string' ? category : category?.value;
		};
		const titleOf = (id: string) => {
			const title = MenuRegistry.getCommand(id)?.title;
			return typeof title === 'string' ? title : title?.value;
		};

		const switchIds = ['Overview', 'Terminal', 'Code', 'Web', 'Planning', 'History', 'Artifacts'].map(name => `workbench.action.preview.switchCategory${name}`);
		for (const id of switchIds) {
			assert.ok(CommandsRegistry.getCommand(id), id);
			assert.strictEqual(categoryOf(id), 'Preview', id);
			assert.ok(!titleOf(id)?.startsWith('Preview:'), `${id} has no doubled "Preview:" prefix`);
			assert.ok(paletteWhen(id)?.equals(PreviewCategorizedContext), `${id} is in the palette only on the categorized part`);
		}

		const moveWhen = ContextKeyExpr.and(PreviewCategorizedContext, ActiveEditorContext)!;
		const moveIds = ['Overview', 'Terminal', 'Code', 'Web', 'Planning', 'History', 'Artifacts'].map(name => `workbench.action.preview.moveEditorTo${name}`);
		for (const id of moveIds) {
			assert.ok(CommandsRegistry.getCommand(id), id);
			assert.strictEqual(categoryOf(id), 'Preview', id);
			assert.ok(paletteWhen(id)?.equals(moveWhen), `${id} needs the categorized part and an active editor`);
		}

		const titleContextCommands = MenuRegistry.getMenuItems(MenuId.EditorTitleContext).filter(isIMenuItem).map(item => item.command.id);
		assert.deepStrictEqual(titleContextCommands.filter(id => moveIds.includes(id)), [], 'move commands do not sit beside Pin on the tab context menu');
	});

	// Kept as source reads: the Agents window part lives in `src/vs/sessions`, which workbench
	// tests may not import, and the Move to Category submenu is registered by
	// `editor.contribution.ts`, whose import would register the whole editor contribution
	// into the registries every suite in this process shares.
	test('the Agents window part does not draw the category bar', () => {
		const sessionsPart = fs.readFileSync(path.join(repoRoot, 'src/vs/sessions/browser/parts/editorPart.ts'), 'utf8');
		assert.ok(sessionsPart.includes('showsPreviewCategoryBar(): boolean {\n\t\treturn false;'));
	});

	test('the Move to Category submenu lists all seven categories only on the categorized part', () => {
		const contribution = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editor.contribution.ts'), 'utf8');
		assert.ok(contribution.includes('submenu: MenuId.EditorCategorySubmenu, title: localize(\'moveToCategory\', "Move to Category"), group: \'6_category\', order: 10, when: PreviewCategorizedContext'));
		for (const name of ['Overview', 'Terminal', 'Code', 'Web', 'Planning', 'History', 'Artifacts']) {
			assert.ok(contribution.includes(`'workbench.action.preview.moveEditorTo${name}'`), name);
		}
	});
});
