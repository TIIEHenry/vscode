/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Memento } from '../../../../common/memento.js';
import { StorageScope } from '../../../../../platform/storage/common/storage.js';
import { SyncDescriptor } from '../../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorExtensions, EditorsOrder, IEditorFactoryRegistry } from '../../../../common/editor.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { CategorizedMainEditorPart } from '../../../../browser/parts/editor/categorizedMainEditorPart.js';
import { MainEditorPart } from '../../../../browser/parts/editor/editorPart.js';
import { EditorParts } from '../../../../browser/parts/editor/editorParts.js';
import { ConfirmResult } from '../../../../../platform/dialogs/common/dialogs.js';
import { EditorActivation } from '../../../../../platform/editor/common/editor.js';
import { TestFileEditorInput, workbenchInstantiationService, workbenchTeardown, registerTestEditor, ITestInstantiationService, TestServiceAccessor } from '../../../browser/workbenchTestServices.js';
import { GroupDirection, GroupLayoutArgument, GroupOrientation, GroupsOrder, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { EditorService } from '../../../../services/editor/browser/editorService.js';
import { findGroup } from '../../../../services/editor/common/editorGroupFinder.js';
import { isEditorGroupShown } from '../../../../services/editor/common/previewCategoryRouting.js';
import { IPreviewCategoryService, PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';

class TestCategorizedMainEditorPart extends CategorizedMainEditorPart {
	saveForTest(): void {
		this.saveState();
	}
}

class TestCategorizedEditorParts extends EditorParts {
	testMainPart!: TestCategorizedMainEditorPart;

	protected override createMainEditorPart(): MainEditorPart {
		this.testMainPart = this.instantiationService.createInstance(TestCategorizedMainEditorPart, this);
		return this.testMainPart;
	}
}

suite('PreviewCategoryPart', () => {

	const TEST_EDITOR_ID = 'MyFileEditorForPreviewCategory';
	const TEST_EDITOR_INPUT_ID = 'testEditorInputForPreviewCategory';

	const disposables = new DisposableStore();
	let instantiationService: ITestInstantiationService | undefined;

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
		// A categorized grid has one group per category, so leaving it here makes a
		// later plain EditorPart restore that grid and treat SIDE_GROUP as a no-op.
		Memento.clear(StorageScope.WORKSPACE);
		Memento.clear(StorageScope.PROFILE);
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	async function createPart(existing?: ITestInstantiationService): Promise<{ parts: TestCategorizedEditorParts; part: TestCategorizedMainEditorPart; service: ITestInstantiationService }> {
		const service = existing ?? workbenchInstantiationService(undefined, disposables);
		if (!existing) {
			service.invokeFunction(accessor => Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).start(accessor));
		}
		const parts = disposables.add(service.createInstance(TestCategorizedEditorParts));
		const part = parts.testMainPart;
		part.create(document.createElement('div'));
		part.layout(1080, 800, 0, 0);
		await parts.whenReady;
		service.stub(IEditorGroupsService, parts);
		instantiationService = service;
		return { parts, part, service };
	}

	function categoryServiceOf(service: ITestInstantiationService): IPreviewCategoryService {
		return service.invokeFunction(accessor => accessor.get(IPreviewCategoryService));
	}

	function input(resource: URI): TestFileEditorInput {
		return disposables.add(new TestFileEditorInput(resource, TEST_EDITOR_INPUT_ID));
	}

	async function openRouted(service: ITestInstantiationService, editor: EditorInput, options?: { inactive?: boolean; preserveFocus?: boolean; pinned?: boolean }) {
		const found = service.invokeFunction(accessor => findGroup(accessor, { editor, options }, undefined));
		const [group, activation] = found instanceof Promise ? await found : found;
		await group.openEditor(editor, { ...options, activation });
		return group;
	}

	function editorsIn(part: TestCategorizedMainEditorPart, category: PreviewCategory): EditorInput[] {
		return part.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)
			.filter(group => part.getGroupCategory(group) === category)
			.flatMap(group => group.editors);
	}

	test('category bar is a single row above the grid for every tab mode', async () => {
		const { part } = await createPart();

		assert.strictEqual(part.element.querySelectorAll('.preview-category-bar').length, 1);
		assert.strictEqual(part.element.querySelectorAll('.preview-category-switcher').length, 1);
		assert.strictEqual(part.element.querySelector('.editor-group-container .preview-category-switcher'), null);
		assert.strictEqual(part.element.querySelectorAll('.preview-category-tab').length, 7);

		const enforce = part.enforcePartOptions({ showTabs: 'none' });
		assert.strictEqual(part.element.querySelectorAll('.preview-category-switcher').length, 1);
		enforce.dispose();
	});

	test('empty active category does not drop the layout memento', async () => {
		const { part, service } = await createPart();
		const categoryService = categoryServiceOf(service);

		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		await code.openEditor(input(URI.file('/src/app.ts')), { pinned: true });
		categoryService.setActiveCategory(PreviewCategory.Terminal);

		part.saveForTest();

		assert.strictEqual(part.hasRestorableState, true);
		assert.strictEqual(categoryService.activeCategory, PreviewCategory.Terminal);
		assert.ok(editorsIn(part, PreviewCategory.Code).length === 1);
	});

	test('close all affects only the visible category', async () => {
		const { part, service } = await createPart();
		const categoryService = categoryServiceOf(service);
		const codeEditor = input(URI.file('/src/app.ts'));
		const terminalEditor = input(URI.parse('vscode-terminal:/1'));

		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		await code.openEditor(codeEditor, { pinned: true });
		const terminal = part.ensureCategoryGroup(PreviewCategory.Terminal);
		await terminal.openEditor(terminalEditor, { pinned: true, inactive: true });
		categoryService.setActiveCategory(PreviewCategory.Code);

		for (const group of part.getGroups(GroupsOrder.GRID_APPEARANCE)) {
			if (!part.isGroupVisible(group)) {
				continue;
			}
			await group.closeAllEditors();
		}

		assert.strictEqual(editorsIn(part, PreviewCategory.Code).length, 0);
		assert.strictEqual(editorsIn(part, PreviewCategory.Terminal).length, 1);
		assert.ok(part.getGroup(terminal.id));
	});

	test('inactive open does not switch; opening again reveals the editor category', async () => {
		const { part, service } = await createPart();
		const categoryService = categoryServiceOf(service);
		const codeEditor = input(URI.file('/src/app.ts'));
		const terminalEditor = input(URI.parse('vscode-terminal:/1'));

		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		await code.openEditor(codeEditor, { pinned: true });
		assert.strictEqual(categoryService.activeCategory, PreviewCategory.Code);

		const target = await openRouted(service, terminalEditor, { inactive: true, preserveFocus: true, pinned: true });

		assert.strictEqual(categoryService.activeCategory, PreviewCategory.Code);
		assert.strictEqual(categoryService.hasCategoryHint(PreviewCategory.Terminal), true);
		assert.ok(target.contains(terminalEditor));
		assert.strictEqual(part.isGroupVisible(target), false);

		const revealed = await openRouted(service, terminalEditor, { pinned: true });

		assert.strictEqual(categoryService.activeCategory, PreviewCategory.Terminal);
		assert.strictEqual(part.isGroupVisible(revealed), true);
		assert.strictEqual(revealed.id, target.id);
		assert.strictEqual(categoryService.hasCategoryHint(PreviewCategory.Terminal), false);
		assert.strictEqual(editorsIn(part, PreviewCategory.Terminal).length, 1);

		categoryService.setActiveCategory(PreviewCategory.Code);
		await openRouted(service, terminalEditor, { inactive: true, preserveFocus: true, pinned: true });
		assert.strictEqual(categoryService.activeCategory, PreviewCategory.Code);
		assert.strictEqual(categoryService.hasCategoryHint(PreviewCategory.Terminal), true);
		assert.strictEqual(part.isGroupVisible(target), false);
	});

	test('split group keeps the source category', async () => {
		const { part, service } = await createPart();
		const categoryService = categoryServiceOf(service);
		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		const side = part.addGroup(code, GroupDirection.RIGHT);

		assert.strictEqual(part.getGroupCategory(side), PreviewCategory.Code);
		categoryService.setActiveCategory(PreviewCategory.Artifacts);
		assert.strictEqual(part.isGroupVisible(side), false);
		categoryService.setActiveCategory(PreviewCategory.Code);

		const grid = part.getGroups(GroupsOrder.GRID_APPEARANCE);
		const visible = grid.filter(group => part.isGroupVisible(group));
		assert.ok(grid.length > visible.length);
		assert.ok(visible.some(group => group.id === side.id));
		assert.ok(visible.every(group => part.getGroupCategory(group) === PreviewCategory.Code));
		assert.ok(grid.some(group => part.getGroupCategory(group) === PreviewCategory.Terminal));
	});

	test('sticky index stays inside the group', async () => {
		const { part, service } = await createPart();
		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		const first = input(URI.file('/src/a.ts'));
		const second = input(URI.file('/src/b.ts'));
		await code.openEditor(first, { pinned: true });
		await code.openEditor(second, { pinned: true });
		code.stickEditor(first);

		const terminal = part.ensureCategoryGroup(PreviewCategory.Terminal);
		const terminalEditor = input(URI.parse('vscode-terminal:/2'));
		await terminal.openEditor(terminalEditor, { pinned: true });
		terminal.stickEditor(terminalEditor);

		assert.strictEqual(code.getIndexOfEditor(first), 0);
		assert.strictEqual(code.isSticky(first), true);
		assert.strictEqual(code.isSticky(second), false);
		assert.strictEqual(terminal.isSticky(terminalEditor), true);
		assert.notStrictEqual(categoryServiceOf(service).activeCategory, undefined);
	});

	test('hidden dirty editors stay out of the visible set and in the open set', async () => {
		const { part, service } = await createPart();
		const editorService = disposables.add(service.createInstance(EditorService, part));
		const terminalEditor = input(URI.parse('vscode-terminal:/3'));
		terminalEditor.setDirty();

		const target = await openRouted(service, terminalEditor, { inactive: true, preserveFocus: true, pinned: true });

		assert.ok(!editorService.visibleEditors.includes(terminalEditor));
		assert.ok(editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).some(entry => entry.editor === terminalEditor));
		assert.strictEqual(part.getGroupCategory(target), PreviewCategory.Terminal);
	});

	test('move editor lands in the target category group', async () => {
		const { part } = await createPart();
		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		const file = input(URI.file('/src/moved.ts'));
		await code.openEditor(file, { pinned: true });

		part.moveEditorToCategory(file, PreviewCategory.Artifacts, code);

		assert.strictEqual(part.getGroupCategory(part.activeGroup), PreviewCategory.Artifacts);
		assert.ok(part.activeGroup.contains(file));
		assert.ok(!code.contains(file));
	});

	test('restored groups keep their category', async () => {
		const { part, service } = await createPart();
		const categoryService = categoryServiceOf(service);
		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		const file = input(URI.file('/src/restore.ts'));
		await code.openEditor(file, { pinned: true });
		const codeId = code.id;

		categoryService.setActiveCategory(PreviewCategory.History);
		part.saveForTest();
		// dispose() drops groups without closing. Editors restored from the
		// previous test's memento would otherwise leak.
		for (const group of [...part.groups]) {
			await group.closeAllEditors();
		}
		part.dispose();

		const restored = await createPart(service);
		assert.strictEqual(categoryServiceOf(restored.service).activeCategory, PreviewCategory.History);
		const restoredCode = restored.part.getGroup(codeId);
		assert.ok(restoredCode);
		assert.strictEqual(restored.part.getGroupCategory(restoredCode), PreviewCategory.Code);
		assert.ok(restoredCode.editors.some(editor => editor.resource?.toString() === file.resource.toString()));
		assert.strictEqual(restored.part.isGroupVisible(restoredCode), false);
		assert.ok(restored.part.getGroups(GroupsOrder.GRID_APPEARANCE).filter(group => restored.part.isGroupVisible(group)).every(group => restored.part.getGroupCategory(group) === PreviewCategory.History));
		// Serializer builds a new input. Track it so the leak check sees a parent.
		for (const group of restored.part.groups) {
			for (const editor of group.editors) {
				disposables.add(editor);
			}
		}
	});

	test('applyLayout keeps hidden category editors', async () => {
		const { part } = await createPart();
		const terminal = part.ensureCategoryGroup(PreviewCategory.Terminal);
		const terminalEditor = input(URI.parse('vscode-terminal:/layout'));
		await terminal.openEditor(terminalEditor, { pinned: true, inactive: true, preserveFocus: true, activation: EditorActivation.PRESERVE });

		part.applyLayout({ orientation: GroupOrientation.HORIZONTAL, groups: [{ size: 0.5 }, { size: 0.5 }] });

		assert.ok(terminal.contains(terminalEditor));
		assert.strictEqual(part.isGroupVisible(terminal), false);
		assert.strictEqual(part.getGroupCategory(terminal), PreviewCategory.Terminal);
		const visible = part.getGroups(GroupsOrder.GRID_APPEARANCE).filter(group => part.isGroupVisible(group));
		assert.strictEqual(visible.length, 2);
		assert.ok(visible.every(group => part.getGroupCategory(group) === PreviewCategory.Code));
	});

	test('inactive open into an empty hidden group stays on the current category', async () => {
		const { part, service } = await createPart();
		const categoryService = categoryServiceOf(service);
		const terminal = part.ensureCategoryGroup(PreviewCategory.Terminal);
		const terminalEditor = input(URI.parse('vscode-terminal:/empty-inactive'));

		await terminal.openEditor(terminalEditor, { pinned: true, inactive: true });

		assert.strictEqual(categoryService.activeCategory, PreviewCategory.Code);
		assert.strictEqual(part.isGroupVisible(terminal), false);
		assert.ok(terminal.contains(terminalEditor));
	});

	test('getLayout omits hidden category groups', async () => {
		const { part } = await createPart();
		const visibleCount = () => part.getGroups(GroupsOrder.GRID_APPEARANCE).filter(group => part.isGroupVisible(group)).length;
		const layoutCount = (groups: readonly GroupLayoutArgument[]): number => {
			let count = 0;
			for (const group of groups) {
				if (group.groups && group.groups.length > 0) {
					count += layoutCount(group.groups);
				} else {
					count++;
				}
			}
			return count;
		};

		assert.strictEqual(layoutCount(part.getLayout().groups), 1);
		assert.ok(part.getGroups(GroupsOrder.GRID_APPEARANCE).length > 1);

		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		part.addGroup(code, GroupDirection.RIGHT);
		assert.strictEqual(visibleCount(), 2);
		assert.strictEqual(layoutCount(part.getLayout().groups), visibleCount());
		assert.ok(part.getGroups(GroupsOrder.GRID_APPEARANCE).length > visibleCount());
	});

	test('visible grid order skips hidden groups', async () => {
		const { part } = await createPart();
		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		const side = part.addGroup(code, GroupDirection.RIGHT);
		const grid = part.getGroups(GroupsOrder.GRID_APPEARANCE);
		const visible = grid.filter(group => part.isGroupVisible(group));

		assert.ok(grid.length > visible.length);
		assert.strictEqual(visible[0].id, code.id);
		assert.strictEqual(visible[1].id, side.id);
		assert.strictEqual(code.index, 0);
		assert.strictEqual(side.index, 1);
	});

	test('applyState keeps a hidden editor in its category', async () => {
		const { part, service } = await createPart();
		const categoryService = categoryServiceOf(service);
		const code = part.getMostRecentGroup(PreviewCategory.Code)!;
		const file = input(URI.file('/src/apply-state.ts'));
		await code.openEditor(file, { pinned: true });
		const codeId = code.id;

		categoryService.setActiveCategory(PreviewCategory.Terminal);
		const state = part.createState();
		await part.applyState(state);

		const restoredCode = part.getGroup(codeId);
		assert.ok(restoredCode);
		assert.strictEqual(part.getGroupCategory(restoredCode), PreviewCategory.Code);
		assert.ok(restoredCode.editors.some(editor => editor.resource?.toString() === file.resource.toString()));
		assert.strictEqual(part.isGroupVisible(restoredCode), false);
		assert.strictEqual(categoryService.activeCategory, PreviewCategory.Terminal);
		for (const group of part.groups) {
			for (const editor of group.editors) {
				disposables.add(editor);
			}
		}
	});

	test('hidden dirty editor still enters close confirmation', async () => {
		const { part, service } = await createPart();
		const accessor = service.createInstance(TestServiceAccessor);
		const editorService = disposables.add(service.createInstance(EditorService, part));
		const terminalEditor = input(URI.parse('vscode-terminal:/dirty-confirm'));
		terminalEditor.setDirty();

		const target = await openRouted(service, terminalEditor, { inactive: true, preserveFocus: true, pinned: true });

		assert.strictEqual(part.isGroupVisible(target), false);
		assert.ok(!editorService.visibleEditors.includes(terminalEditor));
		assert.ok(editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).some(entry => entry.editor === terminalEditor));

		accessor.fileDialogService.setConfirmResult(ConfirmResult.CANCEL);
		const closed = await target.closeEditor(terminalEditor);

		assert.strictEqual(closed, false);
		assert.ok(target.contains(terminalEditor));
		assert.strictEqual(terminalEditor.isDirty(), true);
	});

	test('focus second editor group skips hidden category groups', async () => {
		const { parts, part, service } = await createPart();
		const categoryService = categoryServiceOf(service);
		categoryService.setActiveCategory(PreviewCategory.Artifacts);
		const artifacts = part.getMostRecentGroup(PreviewCategory.Artifacts)!;
		const side = part.addGroup(artifacts, GroupDirection.RIGHT);

		// workbench.action.focusSecondEditorGroup indexes this visible list at groupIndex 1.
		const grid = parts.getGroups(GroupsOrder.GRID_APPEARANCE);
		const shown = grid.filter(group => isEditorGroupShown(parts, group));
		assert.strictEqual(shown[1]?.id, side.id);
		assert.ok(shown.every(group => part.isGroupVisible(group)));
		assert.ok(grid.length > shown.length);
		const sideIndex = grid.findIndex(group => group.id === side.id);
		const beforeSide = grid.slice(0, sideIndex);
		assert.ok(sideIndex > 1);
		assert.strictEqual(beforeSide.filter(group => part.isGroupVisible(group)).length, 1);
		assert.ok(beforeSide.some(group => !part.isGroupVisible(group)));

		let focusedId: number | undefined;
		const hiddenFocused: number[] = [];
		disposables.add(side.onDidFocus(() => { focusedId = side.id; }));
		for (const group of grid) {
			if (!part.isGroupVisible(group)) {
				disposables.add(group.onDidFocus(() => hiddenFocused.push(group.id)));
			}
		}

		shown[1].focus();
		assert.strictEqual(focusedId, side.id);
		assert.deepStrictEqual(hiddenFocused, []);
		assert.strictEqual(categoryService.activeCategory, PreviewCategory.Artifacts);
	});
});
