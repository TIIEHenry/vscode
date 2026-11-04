/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { PreviewCategorySwitcher } from '../../../../browser/parts/editor/previewCategorySwitcher.js';
import { PreviewCategoryService } from '../../../../services/editor/browser/previewCategoryService.js';
import { IPreviewCategoryService, PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';
import { TestStorageService } from '../../../common/workbenchTestServices.js';
import { $ } from '../../../../../base/browser/dom.js';
import { DraggedEditorIdentifier } from '../../../../browser/dnd.js';
import { LocalSelectionTransfer } from '../../../../../platform/dnd/browser/dnd.js';

class TestCategoryEditorInput extends EditorInput {
	static readonly ID = 'testCategoryEditorInput';

	override get typeId(): string {
		return TestCategoryEditorInput.ID;
	}

	constructor(
		public readonly resource: URI
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

	function createServices(): { previewCategoryService: IPreviewCategoryService } {
		const storage = disposables.add(new TestStorageService());
		const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
		return { previewCategoryService };
	}

	test('PreviewCategorySwitcher renders tabs and badge counts', () => {
		const { previewCategoryService } = createServices();

		const parent = $('.switcher-test-container');
		document.body.appendChild(parent);
		const switcher = disposables.add(new PreviewCategorySwitcher(parent, undefined, previewCategoryService));
		assert.strictEqual(switcher.domNode.getAttribute('role'), 'tablist');
		assert.strictEqual(switcher.domNode.getAttribute('aria-orientation'), 'horizontal');

		const codeTab = switcher.domNode.querySelector('[data-category="code"]') as HTMLElement;
		const terminalTab = switcher.domNode.querySelector('[data-category="terminal"]') as HTMLElement;
		const overviewTab = switcher.domNode.querySelector('[data-category="overview"]') as HTMLElement;
		const artifactsTab = switcher.domNode.querySelector('[data-category="artifacts"]') as HTMLElement;
		const planningTab = switcher.domNode.querySelector('[data-category="planning"]') as HTMLElement;
		const webTab = switcher.domNode.querySelector('[data-category="web"]') as HTMLElement;

		assert.ok(codeTab, 'code tab exists');
		assert.ok(artifactsTab, 'artifacts tab exists');
		assert.ok(planningTab, 'planning tab exists');

		assert.strictEqual(codeTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(codeTab.tabIndex, 0);
		assert.strictEqual(artifactsTab.getAttribute('aria-selected'), 'false');
		assert.strictEqual(artifactsTab.tabIndex, -1);

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
			[PreviewCategory.Planning]: 0,
			[PreviewCategory.Artifacts]: 1,
		});
		assert.strictEqual(codeCount.style.display, 'none');
		assert.strictEqual(artifactsCount.textContent, '1');
		assert.strictEqual(artifactsCount.style.display, '');

		// Click to switch
		artifactsTab.click();
		assert.strictEqual(previewCategoryService.activeCategory, PreviewCategory.Artifacts);
		assert.strictEqual(artifactsTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(artifactsTab.tabIndex, 0);
		assert.strictEqual(codeTab.getAttribute('aria-selected'), 'false');
		assert.strictEqual(codeTab.tabIndex, -1);

		const arrowRightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
		codeTab.dispatchEvent(arrowRightEvent);
		assert.strictEqual(previewCategoryService.activeCategory, PreviewCategory.Artifacts);
		assert.strictEqual(document.activeElement, switcher.domNode.querySelector('[data-category="web"]'));
		assert.strictEqual(webTab.tabIndex, 0);
		assert.strictEqual(codeTab.tabIndex, -1);
		assert.strictEqual(arrowRightEvent.defaultPrevented, true);

		const homeEvent = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
		webTab.dispatchEvent(homeEvent);
		assert.strictEqual(document.activeElement, overviewTab);
		assert.strictEqual(overviewTab.tabIndex, 0);
		assert.strictEqual(homeEvent.defaultPrevented, true);

		const endEvent = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
		codeTab.dispatchEvent(endEvent);
		assert.strictEqual(document.activeElement, artifactsTab);
		assert.strictEqual(artifactsTab.tabIndex, 0);
		assert.strictEqual(endEvent.defaultPrevented, true);

		webTab.focus();
		webTab.dispatchEvent(new FocusEvent('focus'));
		const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
		webTab.dispatchEvent(enterEvent);
		assert.strictEqual(previewCategoryService.activeCategory, PreviewCategory.Web);
		assert.strictEqual(webTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(webTab.tabIndex, 0);
		assert.strictEqual(artifactsTab.getAttribute('aria-selected'), 'false');
		assert.strictEqual(artifactsTab.tabIndex, -1);
		assert.strictEqual(enterEvent.defaultPrevented, true);

		// An external category change while the switcher is unfocused must move
		// the roving tab stop to the newly active category.
		const outside = document.createElement('button');
		document.body.appendChild(outside);
		outside.focus();
		previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
		assert.strictEqual(terminalTab.getAttribute('aria-selected'), 'true');
		assert.strictEqual(terminalTab.tabIndex, 0);
		assert.strictEqual(webTab.tabIndex, -1);
		outside.remove();
		parent.remove();
	});

	test('Drop dragged editor onto category switcher tab moves editor', () => {
		const { previewCategoryService } = createServices();
		const moved: { editor: EditorInput; category: PreviewCategory; source?: number }[] = [];

		const parent = document.createElement('div');
		const switcher = disposables.add(new PreviewCategorySwitcher(parent, {
			moveEditorToCategory: (editor, category, source) => {
				moved.push({ editor, category, source });
			}
		}, previewCategoryService));

		const artifactsTab = switcher.domNode.querySelector('[data-category="artifacts"]') as HTMLElement;
		const input = disposables.add(new TestCategoryEditorInput(URI.file('/workspace/src/app.ts')));

		assert.strictEqual(previewCategoryService.getCategoryForInput(input), PreviewCategory.Code);

		const editorTransfer = LocalSelectionTransfer.getInstance<DraggedEditorIdentifier>();
		editorTransfer.setData([new DraggedEditorIdentifier({ editor: input, groupId: 0 })], DraggedEditorIdentifier.prototype);

		const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
		artifactsTab.dispatchEvent(dropEvent);

		assert.strictEqual(moved.length, 1);
		assert.strictEqual(moved[0].editor, input);
		assert.strictEqual(moved[0].category, PreviewCategory.Artifacts);
		assert.strictEqual(moved[0].source, 0);
		assert.strictEqual(previewCategoryService.getCategoryForInput(input), PreviewCategory.Code);

		editorTransfer.clearData(DraggedEditorIdentifier.prototype);
	});
});
