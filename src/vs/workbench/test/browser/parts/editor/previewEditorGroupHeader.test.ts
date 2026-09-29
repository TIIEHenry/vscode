/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

suite('Preview Editor Group Header Invariants', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('MainEditorPart passes localized Preview label', () => {
		const editorPartPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editorPart.ts');
		const content = fs.readFileSync(editorPartPath, 'utf8');

		assert.ok(
			content.includes("super(editorPartsView, Parts.EDITOR_PART, localize('preview', \"Preview\"), mainWindow.vscodeWindowId,"),
			'MainEditorPart should pass localize preview as its groups label',
		);
	});

	test('editorgroupview.css and multieditortabscontrol.css keep header visible when empty', () => {
		const groupViewCssPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css');
		const tabsControlCssPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css');

		const groupViewCss = fs.readFileSync(groupViewCssPath, 'utf8');
		const tabsControlCss = fs.readFileSync(tabsControlCssPath, 'utf8');

		assert.ok(
			!groupViewCss.includes('.editor-group-container.empty > .title {\n\tdisplay: none;\n}'),
			'editorgroupview.css must not hide title when group is empty',
		);

		assert.ok(
			!tabsControlCss.includes('.title > .tabs-and-actions-container.empty {\n\tdisplay: none;\n}'),
			'multieditortabscontrol.css must not hide tabs-and-actions-container when empty',
		);

		assert.ok(
			tabsControlCss.includes('.tab.empty-placeholder'),
			'multieditortabscontrol.css should style .tab.empty-placeholder',
		);
	});

	test('editorGroupView creates editor actions on scopedContextKeyService when empty', () => {
		const groupViewPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editorGroupView.ts');
		const content = fs.readFileSync(groupViewPath, 'utf8');

		assert.ok(
			content.includes('this.menuService.createMenu(menuId, this.scopedContextKeyService,'),
			'editorGroupView should query menu with scopedContextKeyService when activeEditorPane is not present',
		);
	});

	test('multiEditorTabsControl renders empty placeholder tab when count is 0', () => {
		const tabsControlPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts');
		const content = fs.readFileSync(tabsControlPath, 'utf8');

		assert.ok(
			content.includes('renderEmptyPlaceholderTab'),
			'multiEditorTabsControl should have renderEmptyPlaceholderTab method',
		);
		assert.ok(
			content.includes('emptyPlaceholderTab'),
			'multiEditorTabsControl should manage emptyPlaceholderTab',
		);
		assert.ok(
			content.includes("showTabs !== 'none'"),
			'visible should be true when showTabs !== none',
		);
	});

	test('editorgroupview.css and sourcesPart.css define continuous vertical and horizontal dividers for End column', () => {
		const groupViewCssPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css');
		const sourcesCssPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/sources/media/sourcesPart.css');
		const groupViewPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editorGroupView.ts');

		const groupViewCss = fs.readFileSync(groupViewCssPath, 'utf8');
		const sourcesCss = fs.readFileSync(sourcesCssPath, 'utf8');
		const groupViewTs = fs.readFileSync(groupViewPath, 'utf8');

		assert.ok(
			groupViewCss.includes('.monaco-workbench .part.editor:not(.conversation-editor-part-container):not(.auxiliary) {') &&
			groupViewCss.includes('border-left: 1px solid var(--vscode-sideBar-border'),
			'editorgroupview.css should draw border-left on End Preview part',
		);

		assert.ok(
			sourcesCss.includes('border-left: 1px solid var(--vscode-sideBar-border'),
			'sourcesPart.css should draw border-left on Sources part',
		);

		assert.ok(
			sourcesCss.includes('.monaco-workbench:not(.nomaineditorarea) .part.sources {') &&
			sourcesCss.includes('border-top: 1px solid var(--vscode-sideBar-border'),
			'sourcesPart.css should draw border-top separating Sources from Preview',
		);

		assert.ok(
			groupViewTs.includes('EDITOR_GROUP_HEADER_TABS_BORDER') &&
			groupViewTs.includes('this.getColor(EDITOR_GROUP_HEADER_TABS_BORDER) || this.getColor(EDITOR_GROUP_HEADER_BORDER)'),
			'editorGroupView.ts should check EDITOR_GROUP_HEADER_TABS_BORDER for title-border-bottom',
		);
	});

	test('category bar is owned by the categorized main part, not the tab row', () => {
		const tabsControlPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts');
		const titleControlPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editorTitleControl.ts');
		const commandsPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editorCommands.ts');
		const partsPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editorParts.ts');
		const contributionPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editor.contribution.ts');
		const tabsCssPath = path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css');

		const tabsControlContent = fs.readFileSync(tabsControlPath, 'utf8');
		const titleControlContent = fs.readFileSync(titleControlPath, 'utf8');
		const commandsContent = fs.readFileSync(commandsPath, 'utf8');
		const partsContent = fs.readFileSync(partsPath, 'utf8');
		const contributionContent = fs.readFileSync(contributionPath, 'utf8');
		const tabsCssContent = fs.readFileSync(tabsCssPath, 'utf8');

		assert.ok(
			!tabsControlContent.includes('PreviewCategorySwitcher'),
			'multiEditorTabsControl must not mount the category bar',
		);

		assert.ok(
			!titleControlContent.includes('setActiveCategory') &&
			!titleControlContent.includes('CategoryFilteredEditorGroupModel'),
			'editorTitleControl must not filter tabs or force the active category',
		);

		assert.ok(
			partsContent.includes('CategorizedMainEditorPart'),
			'workbench createMainEditorPart must return the categorized preview part',
		);

		assert.ok(
			commandsContent.includes('workbench.action.preview.switchCategoryCode') &&
			commandsContent.includes('workbench.action.preview.moveEditorToOverview') &&
			commandsContent.includes('workbench.action.preview.moveEditorToTerminal') &&
			commandsContent.includes('workbench.action.preview.moveEditorToCode') &&
			commandsContent.includes('workbench.action.preview.moveEditorToWeb') &&
			commandsContent.includes('workbench.action.preview.moveEditorToPlanning') &&
			commandsContent.includes('workbench.action.preview.moveEditorToHistory') &&
			commandsContent.includes('workbench.action.preview.moveEditorToArtifacts'),
			'editorCommands must register switching and moving for all seven categories',
		);

		assert.ok(
			!commandsContent.includes('MenuId.EditorTitleContext'),
			'move commands must not sit beside Pin on the title context menu',
		);

		assert.ok(
			contributionContent.includes('when: PreviewCategorizedContext') &&
			contributionContent.includes('workbench.action.preview.moveEditorToOverview') &&
			contributionContent.includes('workbench.action.preview.moveEditorToTerminal') &&
			contributionContent.includes('workbench.action.preview.moveEditorToCode') &&
			contributionContent.includes('workbench.action.preview.moveEditorToWeb') &&
			contributionContent.includes('workbench.action.preview.moveEditorToPlanning') &&
			contributionContent.includes('workbench.action.preview.moveEditorToHistory') &&
			contributionContent.includes('workbench.action.preview.moveEditorToArtifacts'),
			'Move to Category submenu lists all seven categories only on the categorized part',
		);

		assert.ok(
			!tabsCssContent.includes('.title .preview-category-tab'),
			'tab-row category switcher styles are removed',
		);
	});
});
