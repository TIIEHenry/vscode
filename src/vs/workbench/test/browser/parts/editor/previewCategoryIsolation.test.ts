/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditorGroupModel } from '../../../../common/editor/editorGroupModel.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { CategoryFilteredEditorGroupModel } from '../../../../browser/parts/editor/categoryFilteredEditorGroupModel.js';
import { PreviewCategorySwitcher } from '../../../../browser/parts/editor/previewCategorySwitcher.js';
import { PreviewCategoryService } from '../../../../services/editor/browser/previewCategoryService.js';
import { IPreviewCategoryService, PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';
import { TestStorageService } from '../../../common/workbenchTestServices.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { $ } from '../../../../../base/browser/dom.js';
import { DraggedEditorIdentifier } from '../../../../browser/dnd.js';
import { LocalSelectionTransfer } from '../../../../../platform/dnd/browser/dnd.js';

class TestCategoryEditorInput extends EditorInput {
	static readonly ID = 'testCategoryEditorInput';

	override get typeId(): string {
		return TestCategoryEditorInput.ID;
	}

	constructor(
		public readonly resource: URI,
		public readonly isArtifactInput: boolean = false,
		public readonly isPlanningInput: boolean = false
	) {
		super();
	}

	override matches(other: unknown): boolean {
		return other instanceof TestCategoryEditorInput && this.resource.toString() === other.resource.toString();
	}
}

suite('PreviewCategoryIsolation', () => {

	const disposables = new DisposableStore();

	teardown(() => {
		disposables.clear();
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	function createServices(): { instantiationService: TestInstantiationService; previewCategoryService: IPreviewCategoryService } {
		const instantiationService = disposables.add(new TestInstantiationService());
		const storage = disposables.add(new TestStorageService());
		const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
		instantiationService.stub(IPreviewCategoryService, previewCategoryService);

		const config = new TestConfigurationService();
		config.setUserConfiguration('workbench', { editor: { openPositioning: 'right', focusRecentEditorAfterClose: true } });
		instantiationService.stub(IConfigurationService, config);

		return { instantiationService, previewCategoryService };
	}

	test('CategoryFilteredEditorGroupModel filters editors by activeCategory', () => {
		const { instantiationService, previewCategoryService } = createServices();

		const rawModel = disposables.add(instantiationService.createInstance(EditorGroupModel, undefined));
		const code1 = disposables.add(new TestCategoryEditorInput(URI.file('/workspace/src/app.ts')));
		const code2 = disposables.add(new TestCategoryEditorInput(URI.file('/workspace/src/util.ts')));
		const artifact1 = disposables.add(new TestCategoryEditorInput(URI.parse('canvas://test/flow1'), true));
		const planning1 = disposables.add(new TestCategoryEditorInput(URI.parse('planning://test/task1'), false, true));

		rawModel.openEditor(code1, { pinned: true });
		rawModel.openEditor(code2, { pinned: true });
		rawModel.openEditor(artifact1, { pinned: true });
		rawModel.openEditor(planning1, { pinned: true });

		const filteredModel = disposables.add(new CategoryFilteredEditorGroupModel(rawModel, previewCategoryService));

		// Initially Code is active
		assert.strictEqual(previewCategoryService.activeCategory, PreviewCategory.Code);
		assert.strictEqual(filteredModel.count, 2);
		assert.strictEqual(filteredModel.contains(code1), true);
		assert.strictEqual(filteredModel.contains(code2), true);
		assert.strictEqual(filteredModel.contains(artifact1), false);
		assert.strictEqual(filteredModel.contains(planning1), false);

		// Counts reflected on service
		const counts = previewCategoryService.getCategoryCounts();
		assert.strictEqual(counts[PreviewCategory.Code], 2);
		assert.strictEqual(counts[PreviewCategory.Artifacts], 1);
		assert.strictEqual(counts[PreviewCategory.Planning], 1);

		// Switch to Artifacts
		previewCategoryService.setActiveCategory(PreviewCategory.Artifacts);
		assert.strictEqual(filteredModel.count, 1);
		assert.strictEqual(filteredModel.contains(code1), false);
		assert.strictEqual(filteredModel.contains(artifact1), true);
		assert.strictEqual(filteredModel.activeEditor?.matches(artifact1), true);

		// Switch to Planning
		previewCategoryService.setActiveCategory(PreviewCategory.Planning);
		assert.strictEqual(filteredModel.count, 1);
		assert.strictEqual(filteredModel.contains(planning1), true);
		assert.strictEqual(filteredModel.activeEditor?.matches(planning1), true);

		// Close an editor
		rawModel.closeEditor(code1);
		const updatedCounts = previewCategoryService.getCategoryCounts();
		assert.strictEqual(updatedCounts[PreviewCategory.Code], 1);
	});

	test('PreviewCategorySwitcher renders tabs and badge counts', () => {
		const { previewCategoryService } = createServices();

		const parent = $('.switcher-test-container');
		const switcher = disposables.add(new PreviewCategorySwitcher(parent, previewCategoryService));

		const codeTab = switcher.domNode.querySelector('[data-category="code"]') as HTMLElement;
		const artifactsTab = switcher.domNode.querySelector('[data-category="artifacts"]') as HTMLElement;
		const planningTab = switcher.domNode.querySelector('[data-category="planning"]') as HTMLElement;

		assert.ok(codeTab, 'code tab exists');
		assert.ok(artifactsTab, 'artifacts tab exists');
		assert.ok(planningTab, 'planning tab exists');

		assert.strictEqual(codeTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(artifactsTab.getAttribute('aria-selected'), 'false');

		// Update counts
		previewCategoryService.setCategoryCounts({
			[PreviewCategory.Code]: 4,
			[PreviewCategory.Artifacts]: 2,
			[PreviewCategory.Planning]: 0
		});

		const codeCount = codeTab.querySelector('.category-count') as HTMLElement;
		const artifactsCount = artifactsTab.querySelector('.category-count') as HTMLElement;
		const planningCount = planningTab.querySelector('.category-count') as HTMLElement;

		assert.strictEqual(codeCount.textContent, '4');
		assert.strictEqual(codeCount.style.display, '');
		assert.ok(codeTab.classList.contains('has-count'));
		assert.strictEqual(artifactsCount.textContent, '2');
		assert.strictEqual(artifactsCount.style.display, '');
		assert.strictEqual(planningCount.style.display, 'none');
		assert.ok(!planningTab.classList.contains('has-count'));

		previewCategoryService.setCategoryCounts({
			[PreviewCategory.Code]: 0,
			[PreviewCategory.Artifacts]: 1
		});
		assert.strictEqual(codeCount.style.display, 'none');
		assert.strictEqual(artifactsCount.textContent, '1');
		assert.strictEqual(artifactsCount.style.display, '');

		// Click to switch
		artifactsTab.click();
		assert.strictEqual(previewCategoryService.activeCategory, PreviewCategory.Artifacts);
		assert.strictEqual(artifactsTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(codeTab.getAttribute('aria-selected'), 'false');
	});

	test('Move editor between categories via setCategoryForInput', () => {
		const { instantiationService, previewCategoryService } = createServices();

		const rawModel = disposables.add(instantiationService.createInstance(EditorGroupModel, undefined));
		const file = disposables.add(new TestCategoryEditorInput(URI.file('/workspace/readme.md')));
		rawModel.openEditor(file, { pinned: true });

		const filteredModel = disposables.add(new CategoryFilteredEditorGroupModel(rawModel, previewCategoryService));

		assert.strictEqual(previewCategoryService.getCategoryForInput(file), PreviewCategory.Code);
		assert.strictEqual(filteredModel.count, 1);

		// Move to planning
		previewCategoryService.setCategoryForInput(file, PreviewCategory.Planning);

		assert.strictEqual(previewCategoryService.getCategoryForInput(file), PreviewCategory.Planning);
		assert.strictEqual(previewCategoryService.activeCategory, PreviewCategory.Planning);
		assert.strictEqual(filteredModel.count, 1);
		assert.strictEqual(filteredModel.contains(file), true);

		// Switch back to Code -> file not in Code
		previewCategoryService.setActiveCategory(PreviewCategory.Code);
		assert.strictEqual(filteredModel.count, 0);
	});
	test('Drop dragged editor onto category switcher tab moves editor', () => {
		const { previewCategoryService } = createServices();

		const parent = document.createElement('div');
		const switcher = disposables.add(new PreviewCategorySwitcher(parent, previewCategoryService));

		const artifactsTab = switcher.domNode.querySelector('[data-category="artifacts"]') as HTMLElement;
		const input = disposables.add(new TestCategoryEditorInput(URI.file('/workspace/src/app.ts')));

		assert.strictEqual(previewCategoryService.getCategoryForInput(input), PreviewCategory.Code);

		// Simulate drag transfer
		const editorTransfer = LocalSelectionTransfer.getInstance<DraggedEditorIdentifier>();
		editorTransfer.setData([new DraggedEditorIdentifier({ editor: input, groupId: 0 })], DraggedEditorIdentifier.prototype);

		// Dispatch drop event on artifacts tab
		const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
		artifactsTab.dispatchEvent(dropEvent);

		assert.strictEqual(previewCategoryService.getCategoryForInput(input), PreviewCategory.Artifacts);
		assert.strictEqual(previewCategoryService.activeCategory, PreviewCategory.Artifacts);

		editorTransfer.clearData(DraggedEditorIdentifier.prototype);
	});
});
