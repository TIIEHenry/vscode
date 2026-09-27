/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditorGroupWatermark, getEditorGroupWatermarkEntryActionIds } from '../../../../browser/parts/editor/editorGroupWatermark.js';

import { DisposableStore, IDisposable } from '../../../../../base/common/lifecycle.js';
import { Event } from '../../../../../base/common/event.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { TestStorageService } from '../../../common/workbenchTestServices.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { PreviewCategoryService } from '../../../../services/editor/browser/previewCategoryService.js';
import { PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';

suite('Editor Group Watermark', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('renders category empty state tailored to active category', () => {
		const disposables = new DisposableStore();
		try {
			const container = document.createElement('div');
			const storage = disposables.add(new TestStorageService());
			const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
			const config = new TestConfigurationService();
			config.setUserConfiguration('workbench', { tips: { enabled: false } });
			const executedCommands: string[] = [];

			disposables.add(new EditorGroupWatermark(
				container,
				new class extends mock<IKeybindingService>() {
					override lookupKeybinding() { return undefined; }
					override onDidUpdateKeybindings = Event.None;
				}(),
				new class extends mock<IWorkspaceContextService>() {
					override getWorkbenchState() { return WorkbenchState.WORKSPACE; }
					override onDidChangeWorkbenchState = Event.None;
				}(),
				new class extends mock<IContextKeyService>() {
					override contextMatchesRules() { return true; }
				}(),
				config,
				storage,
				new class extends mock<IInstantiationService>() {
					override createInstance<T>(_ctor: unknown, ..._args: unknown[]): T {
						return { dispose() { } } as unknown as T;
					}
				}(),
				previewCategoryService,
				new class extends mock<ICommandService>() {
					override executeCommand(id: string) {
						executedCommands.push(id);
						return Promise.resolve();
					}
				}()
			));

			const title = container.querySelector('.preview-category-empty-title') as HTMLElement;
			const icon = container.querySelector('.preview-category-empty-icon') as HTMLElement;
			const actionButtons = container.querySelectorAll('.preview-category-empty-action-button');
			assert.ok(title);
			assert.ok(icon);
			assert.ok(actionButtons.length > 0);

			(actionButtons[0] as HTMLButtonElement).click();
			assert.strictEqual(executedCommands.length, 1);
			// Initially Code
			assert.strictEqual(previewCategoryService.activeCategory, PreviewCategory.Code);
			assert.ok(title.textContent?.includes('Code'));

			// Switch to Terminal
			previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
			const terminalTitle = container.querySelector('.preview-category-empty-title') as HTMLElement;
			const terminalIcon = container.querySelector('.preview-category-empty-icon') as HTMLElement;
			assert.ok(terminalTitle.textContent?.includes('Terminal'));
			assert.ok(terminalIcon.className.includes('codicon-terminal'));

			// Switch to Artifacts
			previewCategoryService.setActiveCategory(PreviewCategory.Artifacts);
			const artifactsTitle = container.querySelector('.preview-category-empty-title') as HTMLElement;
			const artifactsIcon = container.querySelector('.preview-category-empty-icon') as HTMLElement;
			assert.ok(artifactsTitle.textContent?.includes('Artifacts'));
			assert.ok(artifactsIcon.className.includes('codicon-package'));
		} finally {
			disposables.dispose();
		}
	});

	test('primary entries are file-oriented and exclude Copilot Chat', () => {
		const actionIds = getEditorGroupWatermarkEntryActionIds();

		assert.ok(actionIds.includes('workbench.action.showCommands'));
		assert.ok(actionIds.includes('workbench.action.quickOpen'));
		assert.ok(actionIds.includes('workbench.action.files.openFile'));
		assert.ok(actionIds.includes('workbench.action.findInFiles'));
		assert.strictEqual(actionIds.includes('workbench.action.chat.open'), false);
	});

});
