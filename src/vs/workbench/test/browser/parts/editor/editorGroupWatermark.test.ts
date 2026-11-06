/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditorGroupWatermark, executePreviewTerminalEmptyState, getEditorGroupWatermarkEntryActionIds } from '../../../../browser/parts/editor/editorGroupWatermark.js';

import { DisposableStore } from '../../../../../base/common/lifecycle.js';
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
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { IEditorGroupWatermarkTips, IEditorGroupWatermarkTipsSession, IPreviewCategoryEmptyState, overrideEditorGroupWatermarkTips, previewTerminalLocalCommandId, registerEditorGroupWatermarkTips } from '../../../../services/editor/common/editorGroupWatermarkTips.js';

suite('Editor Group Watermark', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	interface IStubTipsLog {
		sessionsCreated: number;
		sessionsDisposed: number;
		pendingRuns: number;
		resolvedAccessors: number;
		notifyChange: () => void;
	}

	/** Tips whose Terminal action has the given command id (`undefined`: not known yet), plus Planning and Artifacts states. */
	function createStubTips(terminalCommandId: string | undefined, resolvedCommandId = 'stub.resolved'): { tips: IEditorGroupWatermarkTips; log: IStubTipsLog } {
		const log: IStubTipsLog = { sessionsCreated: 0, sessionsDisposed: 0, pendingRuns: 0, resolvedAccessors: 0, notifyChange: () => { } };
		const tips: IEditorGroupWatermarkTips = {
			createSession(_instantiationService, onDidChange) {
				log.sessionsCreated++;
				log.notifyChange = onDidChange;
				const session: IEditorGroupWatermarkTipsSession = {
					getCategoryEmptyState(category): IPreviewCategoryEmptyState | undefined {
						switch (category) {
							case PreviewCategory.Terminal:
								return { icon: 'terminal', title: 'Stub Terminal Title', description: 'stub terminal', actions: [{ id: terminalCommandId, label: 'Stub New Terminal', icon: 'terminal' }] };
							case PreviewCategory.Planning:
								return { icon: 'checklist', title: 'Stub Planning Title', description: 'stub planning', actions: [{ id: 'workbench.action.planning.openTodos', label: 'Stub Todos', icon: 'checklist' }] };
							case PreviewCategory.Artifacts:
								return { icon: 'package', title: 'Stub Artifacts Title', description: 'stub artifacts', actions: [] };
							default:
								return undefined;
						}
					},
					runPendingTerminalEmptyState() {
						log.pendingRuns++;
						return Promise.resolve();
					},
					dispose() {
						log.sessionsDisposed++;
					}
				};
				return session;
			},
			resolveTerminalEmptyStateCommand() {
				log.resolvedAccessors++;
				return Promise.resolve(resolvedCommandId);
			}
		};
		return { tips, log };
	}

	function createWatermark(disposables: DisposableStore, category: PreviewCategory, previewCategoryEmpty: boolean): {
		container: HTMLElement;
		watermark: EditorGroupWatermark;
		previewCategoryService: PreviewCategoryService;
		executedCommands: string[];
		lookedUpKeybindingIds: string[];
	} {
		const container = document.createElement('div');
		const storage = disposables.add(new TestStorageService());
		const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
		previewCategoryService.setActiveCategory(category);
		const config = new TestConfigurationService();
		config.setUserConfiguration('workbench', { tips: { enabled: false } });
		const executedCommands: string[] = [];
		const lookedUpKeybindingIds: string[] = [];

		const watermark = disposables.add(new EditorGroupWatermark(
			container,
			previewCategoryEmpty,
			new class extends mock<IKeybindingService>() {
				override lookupKeybinding(id: string) {
					lookedUpKeybindingIds.push(id);
					return undefined;
				}
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
				override executeCommand<T = unknown>(id: string, ..._args: unknown[]): Promise<T | undefined> {
					executedCommands.push(id);
					return Promise.resolve(undefined);
				}
			}()
		));
		return { container, watermark, previewCategoryService, executedCommands, lookedUpKeybindingIds };
	}

	test('renders the category empty state the registered tips return', () => {
		const disposables = new DisposableStore();
		try {
			const { tips, log } = createStubTips('stub.terminal.command');
			disposables.add(registerEditorGroupWatermarkTips(tips));
			const { container, previewCategoryService, executedCommands, lookedUpKeybindingIds } = createWatermark(disposables, PreviewCategory.Terminal, true);

			assert.strictEqual(log.sessionsCreated, 1);
			assert.strictEqual(container.querySelector('.preview-category-empty-title')?.textContent, 'Stub Terminal Title');
			assert.strictEqual(container.querySelector('.preview-category-empty-desc')?.textContent, 'stub terminal');
			assert.ok(container.querySelector('.preview-category-empty-icon')?.className.includes('codicon-terminal'));
			assert.strictEqual(container.querySelector('.preview-category-empty-action-label')?.textContent, 'Stub New Terminal');
			assert.deepStrictEqual(lookedUpKeybindingIds, ['stub.terminal.command']);

			(container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement).click();
			assert.deepStrictEqual(executedCommands, ['stub.terminal.command']);
			assert.strictEqual(log.pendingRuns, 0);

			previewCategoryService.setActiveCategory(PreviewCategory.Artifacts);
			assert.strictEqual(container.querySelector('.preview-category-empty-title')?.textContent, 'Stub Artifacts Title');
			assert.ok(container.querySelector('.preview-category-empty-icon')?.className.includes('codicon-package'));
			assert.strictEqual(container.querySelectorAll('.preview-category-empty-action-button').length, 0);

			previewCategoryService.setActiveCategory(PreviewCategory.Planning);
			executedCommands.length = 0;
			(container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement).click();
			assert.deepStrictEqual(executedCommands, ['workbench.action.planning.openTodos']);
		} finally {
			disposables.dispose();
		}
	});

	test('a category the tips do not know falls back to the default text', () => {
		const disposables = new DisposableStore();
		try {
			const { tips } = createStubTips('stub.terminal.command');
			disposables.add(registerEditorGroupWatermarkTips(tips));
			const { container } = createWatermark(disposables, PreviewCategory.Code, true);

			assert.strictEqual(container.querySelector('.preview-category-empty-title')?.textContent, 'No Preview Content');
			assert.ok(container.querySelector('.preview-category-empty-icon')?.className.includes('codicon-symbol-misc'));
			assert.strictEqual(container.querySelectorAll('.preview-category-empty-action-button').length, 0);
		} finally {
			disposables.dispose();
		}
	});

	test('a button without a command id waits on the tips session instead of running a command', () => {
		const disposables = new DisposableStore();
		try {
			const { tips, log } = createStubTips(undefined);
			disposables.add(registerEditorGroupWatermarkTips(tips));
			const { container, executedCommands, lookedUpKeybindingIds } = createWatermark(disposables, PreviewCategory.Terminal, true);

			assert.deepStrictEqual(lookedUpKeybindingIds, []);
			(container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement).click();
			assert.deepStrictEqual(executedCommands, []);
			assert.strictEqual(log.pendingRuns, 1);
		} finally {
			disposables.dispose();
		}
	});

	test('the tips session asks for a new render and is disposed with the watermark', () => {
		const disposables = new DisposableStore();
		try {
			const { tips, log } = createStubTips('stub.terminal.command');
			disposables.add(registerEditorGroupWatermarkTips(tips));
			const { container, watermark } = createWatermark(disposables, PreviewCategory.Terminal, true);

			const firstTitle = container.querySelector('.preview-category-empty-title');
			assert.ok(firstTitle);
			log.notifyChange();
			const secondTitle = container.querySelector('.preview-category-empty-title');
			assert.ok(secondTitle);
			assert.notStrictEqual(secondTitle, firstTitle, 'the watermark rendered again');

			watermark.dispose();
			assert.strictEqual(log.sessionsDisposed, 1);
			const titleBeforeDisposedNotify = container.querySelector('.preview-category-empty-title');
			log.notifyChange();
			assert.strictEqual(container.querySelector('.preview-category-empty-title'), titleBeforeDisposedNotify, 'a disposed watermark does not render');
		} finally {
			disposables.dispose();
		}
	});

	test('no tips session when the group does not use Preview category empty states', () => {
		const disposables = new DisposableStore();
		try {
			const { tips, log } = createStubTips('stub.terminal.command');
			disposables.add(registerEditorGroupWatermarkTips(tips));
			createWatermark(disposables, PreviewCategory.Terminal, false);
			assert.strictEqual(log.sessionsCreated, 0);
		} finally {
			disposables.dispose();
		}
	});

	suite('without registered tips', () => {

		test('the category empty state is the default text without actions', () => {
			const disposables = new DisposableStore();
			try {
				disposables.add(overrideEditorGroupWatermarkTips(undefined));
				const { container } = createWatermark(disposables, PreviewCategory.Terminal, true);

				assert.strictEqual(container.querySelector('.preview-category-empty-title')?.textContent, 'No Preview Content');
				assert.strictEqual(container.querySelectorAll('.preview-category-empty-action-button').length, 0);
			} finally {
				disposables.dispose();
			}
		});

		test('executePreviewTerminalEmptyState opens the local terminal in the given column', async () => {
			const disposables = new DisposableStore();
			try {
				disposables.add(overrideEditorGroupWatermarkTips(undefined));
				const executed: { id: string; args: unknown[] }[] = [];
				const instantiationService = disposables.add(new InstantiationService(new ServiceCollection(
					[ICommandService, new class extends mock<ICommandService>() {
						override executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T | undefined> {
							executed.push({ id, args });
							return Promise.resolve(undefined);
						}
					}()],
				)));
				await instantiationService.invokeFunction(accessor => executePreviewTerminalEmptyState(accessor, 3));
				assert.deepStrictEqual(executed, [{ id: previewTerminalLocalCommandId, args: [{ location: { viewColumn: 3 } }] }]);
			} finally {
				disposables.dispose();
			}
		});
	});

	test('executePreviewTerminalEmptyState runs the command the registered tips resolve', async () => {
		const disposables = new DisposableStore();
		try {
			const { tips, log } = createStubTips(undefined, 'stub.resolved');
			disposables.add(registerEditorGroupWatermarkTips(tips));
			const executed: { id: string; args: unknown[] }[] = [];
			const instantiationService = disposables.add(new InstantiationService(new ServiceCollection(
				[ICommandService, new class extends mock<ICommandService>() {
					override executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T | undefined> {
						executed.push({ id, args });
						return Promise.resolve(undefined);
					}
				}()],
			)));
			await instantiationService.invokeFunction(accessor => executePreviewTerminalEmptyState(accessor, 2));
			assert.strictEqual(log.resolvedAccessors, 1);
			assert.deepStrictEqual(executed, [{ id: 'stub.resolved', args: [{ location: { viewColumn: 2 } }] }]);
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
