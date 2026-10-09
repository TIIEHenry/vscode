/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditorGroupWatermark, getEditorGroupWatermarkEntryActionIds, previewTerminalLocalCommandId } from '../../../../browser/parts/editor/editorGroupWatermark.js';

import { DeferredPromise } from '../../../../../base/common/async.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { Event, Emitter } from '../../../../../base/common/event.js';
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
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentPty, previewUniverseAgentPtyEditorCommandId } from '../../../../../platform/universeAgent/common/universeAgentPty.js';

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
				true,
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
					override executeCommand<T = unknown>(id: string, ..._args: unknown[]): Promise<T | undefined> {
						executedCommands.push(id);
						return Promise.resolve(undefined);
					}
				}(),
				new class extends mock<IUniverseAgentConnection>() {
					override isEngineConnected() { return false; }
					override onDidChangeConnection = Event.None;
				}(),
				new class extends mock<IUniverseAgentPty>() {
					override isBridgeAvailable() { return Promise.resolve(false); }
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

	test('terminal empty state command resolves consistently for keybinding lookup and execution', async () => {
		const disposables = new DisposableStore();
		try {
			const container = document.createElement('div');
			const storage = disposables.add(new TestStorageService());
			const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
			previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
			const config = new TestConfigurationService();
			config.setUserConfiguration('workbench', { tips: { enabled: false } });

			const lookedUpKeybindingIds: string[] = [];
			const executedCommands: string[] = [];
			let connected = true;
			const connectionEmitter = disposables.add(new Emitter<any>());

			const keybindingService = new class extends mock<IKeybindingService>() {
				override lookupKeybinding(id: string) {
					lookedUpKeybindingIds.push(id);
					return undefined;
				}
				override onDidUpdateKeybindings = Event.None;
			}();

			const connection = new class extends mock<IUniverseAgentConnection>() {
				override isEngineConnected() { return connected; }
				override onDidChangeConnection = connectionEmitter.event;
			}();

			let bridgeAvailable = true;
			const pty = new class extends mock<IUniverseAgentPty>() {
				override isBridgeAvailable() { return Promise.resolve(bridgeAvailable); }
			}();

			const commandService = new class extends mock<ICommandService>() {
				override executeCommand<T = unknown>(id: string, ..._args: unknown[]): Promise<T | undefined> {
					executedCommands.push(id);
					return Promise.resolve(undefined);
				}
			}();

			disposables.add(new EditorGroupWatermark(
				container,
				true,
				keybindingService,
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
				commandService,
				connection,
				pty
			));

			// Wait for queryBridgeAvailable promise to resolve and re-render
			await Promise.resolve();

			lookedUpKeybindingIds.length = 0;
			executedCommands.length = 0;

			// Trigger render to inspect fresh keybinding lookup when connected && bridgeAvailable
			connectionEmitter.fire({});
			await Promise.resolve();

			assert.ok(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId));
			assert.strictEqual(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId), false);

			const actionButton = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			assert.ok(actionButton);
			actionButton.click();
			assert.deepStrictEqual(executedCommands, [previewUniverseAgentPtyEditorCommandId]);

			// Now disconnect: connected = false
			connected = false;
			lookedUpKeybindingIds.length = 0;
			executedCommands.length = 0;
			connectionEmitter.fire({});
			await Promise.resolve();

			assert.ok(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId));
			assert.strictEqual(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId), false);

			const disconnectedButton = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			disconnectedButton.click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);

			// Now connected = true, but bridgeAvailable = false
			connected = true;
			bridgeAvailable = false;
			lookedUpKeybindingIds.length = 0;
			executedCommands.length = 0;
			connectionEmitter.fire({});
			await Promise.resolve();

			assert.ok(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId));
			assert.strictEqual(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId), false);

			const bridgeUnavailableButton = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			bridgeUnavailableButton.click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);
		} finally {
			disposables.dispose();
		}
	});

	test('stale async isBridgeAvailable result is ignored when connection drops or generation advances', async () => {
		const disposables = new DisposableStore();
		try {
			const container = document.createElement('div');
			const storage = disposables.add(new TestStorageService());
			const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
			previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
			const config = new TestConfigurationService();
			config.setUserConfiguration('workbench', { tips: { enabled: false } });

			let connected = true;
			const connectionEmitter = disposables.add(new Emitter<any>());
			const connection = new class extends mock<IUniverseAgentConnection>() {
				override isEngineConnected() { return connected; }
				override onDidChangeConnection = connectionEmitter.event;
			}();

			const deferredBridge1 = new DeferredPromise<boolean>();
			const deferredBridge2 = new DeferredPromise<boolean>();
			let callIndex = 0;
			const pty = new class extends mock<IUniverseAgentPty>() {
				override isBridgeAvailable() {
					callIndex++;
					return callIndex === 1 ? deferredBridge1.p : deferredBridge2.p;
				}
			}();

			const executedCommands: string[] = [];
			const commandService = new class extends mock<ICommandService>() {
				override executeCommand<T = unknown>(id: string, ..._args: unknown[]): Promise<T | undefined> {
					executedCommands.push(id);
					return Promise.resolve(undefined);
				}
			}();

			disposables.add(new EditorGroupWatermark(
				container,
				true,
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
				commandService,
				connection,
				pty
			));

			assert.strictEqual(callIndex, 1);

			// Connection drops: synchronous reset to disconnected/local command
			connected = false;
			connectionEmitter.fire({});

			const btn = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			assert.ok(btn);
			btn.click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);

			// Now deferredBridge1 finishes with `true` while disconnected - must be ignored
			deferredBridge1.complete(true);
			await Promise.resolve();

			executedCommands.length = 0;
			const btnAfterStaleResolve = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			btnAfterStaleResolve.click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);

			// Now reconnect and trigger a second query that returns false
			connected = true;
			connectionEmitter.fire({});
			assert.strictEqual(callIndex, 2);

			deferredBridge2.complete(false);
			await Promise.resolve();

			executedCommands.length = 0;
			const btnAfterSecondQuery = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			btnAfterSecondQuery.click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);
		} finally {
			disposables.dispose();
		}
	});

	test('isBridgeAvailable is not called when disconnected', async () => {
		const disposables = new DisposableStore();
		try {
			const container = document.createElement('div');
			const storage = disposables.add(new TestStorageService());
			const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
			previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
			const config = new TestConfigurationService();
			config.setUserConfiguration('workbench', { tips: { enabled: false } });

			let connected = false;
			const connectionEmitter = disposables.add(new Emitter<any>());
			const connection = new class extends mock<IUniverseAgentConnection>() {
				override isEngineConnected() { return connected; }
				override onDidChangeConnection = connectionEmitter.event;
			}();

			let bridgeCallCount = 0;
			const pty = new class extends mock<IUniverseAgentPty>() {
				override isBridgeAvailable() {
					bridgeCallCount++;
					return Promise.resolve(true);
				}
			}();

			disposables.add(new EditorGroupWatermark(
				container,
				true,
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
					override executeCommand() { return Promise.resolve(undefined); }
				}(),
				connection,
				pty
			));

			await Promise.resolve();
			assert.strictEqual(bridgeCallCount, 0, 'Should not query bridge when created disconnected');

			connectionEmitter.fire({});
			await Promise.resolve();
			assert.strictEqual(bridgeCallCount, 0, 'Should not query bridge when connection event fires but still disconnected');

			connected = true;
			connectionEmitter.fire({});
			await Promise.resolve();
			assert.strictEqual(bridgeCallCount, 1, 'Should query bridge when connected');
		} finally {
			disposables.dispose();
		}
	});

	test('watermark disposal while isBridgeAvailable is in flight does not trigger render', async () => {
		const disposables = new DisposableStore();
		try {
			const container = document.createElement('div');
			const storage = disposables.add(new TestStorageService());
			const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
			previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
			const config = new TestConfigurationService();
			config.setUserConfiguration('workbench', { tips: { enabled: false } });

			const deferredBridge = new DeferredPromise<boolean>();
			const connection = new class extends mock<IUniverseAgentConnection>() {
				override isEngineConnected() { return true; }
				override onDidChangeConnection = Event.None;
			}();

			const pty = new class extends mock<IUniverseAgentPty>() {
				override isBridgeAvailable() {
					return deferredBridge.p;
				}
			}();

			const watermark = new EditorGroupWatermark(
				container,
				true,
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
					override executeCommand() { return Promise.resolve(undefined); }
				}(),
				connection,
				pty
			);

			// Dispose while isBridgeAvailable is still pending
			watermark.dispose();

			// Clear container children to observe if render runs after disposal
			container.replaceChildren();

			// Complete the pending bridge promise
			deferredBridge.complete(true);
			await Promise.resolve();

			// render() must not run on disposed watermark
			assert.strictEqual(container.childNodes.length, 0);
		} finally {
			disposables.dispose();
		}
	});

	test('pending isBridgeAvailable click does not run the local terminal command', async () => {
		const disposables = new DisposableStore();
		try {
			const container = document.createElement('div');
			const storage = disposables.add(new TestStorageService());
			const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
			previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
			const config = new TestConfigurationService();
			config.setUserConfiguration('workbench', { tips: { enabled: false } });

			const lookedUpKeybindingIds: string[] = [];
			const executedCommands: string[] = [];
			const deferredBridge = new DeferredPromise<boolean>();
			let bridgeCalls = 0;

			disposables.add(new EditorGroupWatermark(
				container,
				true,
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
				}(),
				new class extends mock<IUniverseAgentConnection>() {
					override isEngineConnected() { return true; }
					override onDidChangeConnection = Event.None;
				}(),
				new class extends mock<IUniverseAgentPty>() {
					override isBridgeAvailable() {
						bridgeCalls++;
						return deferredBridge.p;
					}
				}()
			));

			assert.strictEqual(bridgeCalls, 1);
			assert.strictEqual(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId), false);
			assert.strictEqual(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId), false);

			const actionButton = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			assert.ok(actionButton);
			actionButton.click();
			assert.strictEqual(bridgeCalls, 1, 'in-flight probe is awaited, not started again');
			assert.deepStrictEqual(executedCommands, []);

			deferredBridge.complete(true);
			// Probe continuation rebinds the button; the click continuation runs on the next turn.
			await Promise.resolve();
			await Promise.resolve();

			assert.ok(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId));
			assert.strictEqual(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId), false);
			assert.deepStrictEqual(executedCommands, [previewUniverseAgentPtyEditorCommandId]);

			executedCommands.length = 0;
			const rebound = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			rebound.click();
			assert.deepStrictEqual(executedCommands, [previewUniverseAgentPtyEditorCommandId]);
		} finally {
			disposables.dispose();
		}
	});

	test('rejected isBridgeAvailable stays unknown until the next click probes again', async () => {
		const disposables = new DisposableStore();
		try {
			const container = document.createElement('div');
			const storage = disposables.add(new TestStorageService());
			const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
			previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
			const config = new TestConfigurationService();
			config.setUserConfiguration('workbench', { tips: { enabled: false } });

			const lookedUpKeybindingIds: string[] = [];
			const executedCommands: string[] = [];
			const deferredBridge = new DeferredPromise<boolean>();
			let bridgeCalls = 0;

			disposables.add(new EditorGroupWatermark(
				container,
				true,
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
				}(),
				// Same connection for the whole test: onDidChangeConnection is never fired.
				new class extends mock<IUniverseAgentConnection>() {
					override isEngineConnected() { return true; }
					override onDidChangeConnection = Event.None;
				}(),
				new class extends mock<IUniverseAgentPty>() {
					override isBridgeAvailable() {
						bridgeCalls++;
						if (bridgeCalls === 1) {
							return Promise.reject(new Error('bridge probe failed'));
						}
						return deferredBridge.p;
					}
				}()
			));

			await Promise.resolve();
			assert.strictEqual(bridgeCalls, 1);
			assert.deepStrictEqual(executedCommands, []);
			assert.strictEqual(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId), false);
			assert.strictEqual(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId), false);

			const actionButton = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
			assert.ok(actionButton);
			actionButton.click();
			assert.strictEqual(bridgeCalls, 2);
			assert.deepStrictEqual(executedCommands, []);

			deferredBridge.complete(true);
			await Promise.resolve();
			await Promise.resolve();

			assert.ok(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId));
			assert.strictEqual(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId), false);
			assert.deepStrictEqual(executedCommands, [previewUniverseAgentPtyEditorCommandId]);
		} finally {
			disposables.dispose();
		}
	});

	test('click follows the replacement bridge probe instead of dropping the command', async () => {
		const cases: { label: string; settleSecond: (deferred: DeferredPromise<boolean>) => void; expected: readonly string[] }[] = [
			{
				label: 'true',
				settleSecond: deferred => { deferred.complete(true); },
				expected: [previewUniverseAgentPtyEditorCommandId],
			},
			{
				label: 'false',
				settleSecond: deferred => { deferred.complete(false); },
				expected: [previewTerminalLocalCommandId],
			},
			{
				label: 'rejected',
				settleSecond: deferred => { deferred.error(new Error('bridge probe failed')); },
				expected: [],
			},
		];

		for (const outcome of cases) {
			const disposables = new DisposableStore();
			try {
				const container = document.createElement('div');
				const storage = disposables.add(new TestStorageService());
				const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
				previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
				const config = new TestConfigurationService();
				config.setUserConfiguration('workbench', { tips: { enabled: false } });

				const executedCommands: string[] = [];
				const deferredFirst = new DeferredPromise<boolean>();
				const deferredSecond = new DeferredPromise<boolean>();
				let bridgeCalls = 0;
				const connectionEmitter = disposables.add(new Emitter<any>());

				disposables.add(new EditorGroupWatermark(
					container,
					true,
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
						override executeCommand<T = unknown>(id: string, ..._args: unknown[]): Promise<T | undefined> {
							executedCommands.push(id);
							return Promise.resolve(undefined);
						}
					}(),
					new class extends mock<IUniverseAgentConnection>() {
						override isEngineConnected() { return true; }
						override onDidChangeConnection = connectionEmitter.event;
					}(),
					new class extends mock<IUniverseAgentPty>() {
						override isBridgeAvailable() {
							bridgeCalls++;
							return bridgeCalls === 1 ? deferredFirst.p : deferredSecond.p;
						}
					}()
				));

				assert.strictEqual(bridgeCalls, 1, outcome.label);

				const actionButton = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
				assert.ok(actionButton, outcome.label);
				actionButton.click();
				assert.strictEqual(bridgeCalls, 1, `${outcome.label}: click must not start another probe`);
				assert.deepStrictEqual(executedCommands, [], `${outcome.label}: click must not send a command while the first probe is in flight`);

				connectionEmitter.fire({});
				assert.strictEqual(bridgeCalls, 2, `${outcome.label}: a still-connected change starts the replacement probe`);
				assert.deepStrictEqual(executedCommands, [], outcome.label);

				deferredFirst.complete(true);
				await Promise.resolve();
				await Promise.resolve();
				assert.strictEqual(bridgeCalls, 2, `${outcome.label}: settling the retired probe must not start another query`);
				assert.deepStrictEqual(executedCommands, [], `${outcome.label}: a stale true result must not send a command`);

				outcome.settleSecond(deferredSecond);
				await Promise.resolve();
				await Promise.resolve();
				assert.strictEqual(bridgeCalls, 2, outcome.label);
				assert.deepStrictEqual(executedCommands, [...outcome.expected], outcome.label);
			} finally {
				disposables.dispose();
			}
		}
	});

});
