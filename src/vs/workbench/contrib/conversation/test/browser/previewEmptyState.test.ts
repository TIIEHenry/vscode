/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { InstantiationService } from '../../../../../platform/instantiation/common/instantiationService.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { MenuWorkbenchToolBar } from '../../../../../platform/actions/browser/toolbar.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IUniverseAgentPty, previewUniverseAgentPtyEditorCommandId } from '../../../../../platform/universeAgent/common/universeAgentPty.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../../platform/workspace/common/workspace.js';
import { EditorGroupWatermark, executePreviewTerminalEmptyState } from '../../../../browser/parts/editor/editorGroupWatermark.js';
import { previewTerminalLocalCommandId } from '../../../../services/editor/common/editorGroupWatermarkTips.js';
import { PreviewCategoryService } from '../../../../services/editor/browser/previewCategoryService.js';
import { PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { previewTerminalEmptyStateCommand } from '../../browser/previewEmptyState.contribution.js';

/**
 * The tips contribution registers itself when its module is imported, so
 * these tests drive the real watermark through the real contribution.
 */
suite('Preview empty state tips', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const snapshot = {} as UniverseAgentConnectionSnapshot;

	interface IWatermarkHarness {
		readonly container: HTMLElement;
		readonly watermark: EditorGroupWatermark;
		readonly lookedUpKeybindingIds: string[];
		readonly executedCommands: string[];
	}

	function createTerminalWatermark(disposables: DisposableStore, connection: IUniverseAgentConnection, pty: IUniverseAgentPty): IWatermarkHarness {
		const container = document.createElement('div');
		const storage = disposables.add(new TestStorageService());
		const previewCategoryService = disposables.add(new PreviewCategoryService(storage));
		previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
		const config = new TestConfigurationService();
		config.setUserConfiguration('workbench', { tips: { enabled: false } });

		const lookedUpKeybindingIds: string[] = [];
		const executedCommands: string[] = [];
		const commandService = new class extends mock<ICommandService>() {
			override executeCommand<T = unknown>(id: string, ..._args: unknown[]): Promise<T | undefined> {
				executedCommands.push(id);
				return Promise.resolve(undefined);
			}
		}();

		const real = disposables.add(new InstantiationService(new ServiceCollection(
			[ICommandService, commandService],
			[IUniverseAgentConnection, connection],
			[IUniverseAgentPty, pty],
		)));
		const instantiationService = new class extends mock<IInstantiationService>() {
			override createInstance(ctor: unknown, ...args: unknown[]): unknown {
				if (ctor === MenuWorkbenchToolBar) {
					return { dispose() { } };
				}
				return (real.createInstance as (c: unknown, ...a: unknown[]) => unknown)(ctor, ...args);
			}
		}();

		const watermark = disposables.add(new EditorGroupWatermark(
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
			instantiationService,
			previewCategoryService,
			commandService
		));

		return { container, watermark, lookedUpKeybindingIds, executedCommands };
	}

	function actionButton(container: HTMLElement): HTMLButtonElement {
		const button = container.querySelector('.preview-category-empty-action-button') as HTMLButtonElement;
		assert.ok(button);
		return button;
	}

	test('command is the engine pty only when connected and the bridge is available', () => {
		assert.strictEqual(previewTerminalEmptyStateCommand(true, true), previewUniverseAgentPtyEditorCommandId);
		assert.strictEqual(previewTerminalEmptyStateCommand(true, false), previewTerminalLocalCommandId);
		assert.strictEqual(previewTerminalEmptyStateCommand(false, true), previewTerminalLocalCommandId);
		assert.strictEqual(previewTerminalEmptyStateCommand(false, false), previewTerminalLocalCommandId);
	});

	test('terminal empty state command resolves consistently for keybinding lookup and execution', async () => {
		const disposables = new DisposableStore();
		try {
			let connected = true;
			let bridgeAvailable = true;
			const connectionEmitter = disposables.add(new Emitter<UniverseAgentConnectionSnapshot>());
			const { container, lookedUpKeybindingIds, executedCommands } = createTerminalWatermark(
				disposables,
				new class extends mock<IUniverseAgentConnection>() {
					override isEngineConnected() { return connected; }
					override onDidChangeConnection = connectionEmitter.event;
				}(),
				new class extends mock<IUniverseAgentPty>() {
					override isBridgeAvailable() { return Promise.resolve(bridgeAvailable); }
				}()
			);

			// Wait for the first probe to resolve and render.
			await Promise.resolve();

			lookedUpKeybindingIds.length = 0;
			executedCommands.length = 0;

			connectionEmitter.fire(snapshot);
			await Promise.resolve();

			assert.ok(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId));
			assert.strictEqual(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId), false);

			actionButton(container).click();
			assert.deepStrictEqual(executedCommands, [previewUniverseAgentPtyEditorCommandId]);
			actionButton(container).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
			assert.deepStrictEqual(executedCommands, [previewUniverseAgentPtyEditorCommandId]);

			// Disconnected
			connected = false;
			lookedUpKeybindingIds.length = 0;
			executedCommands.length = 0;
			connectionEmitter.fire(snapshot);
			await Promise.resolve();

			assert.ok(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId));
			assert.strictEqual(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId), false);
			actionButton(container).click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);

			// Connected, bridge unavailable
			connected = true;
			bridgeAvailable = false;
			lookedUpKeybindingIds.length = 0;
			executedCommands.length = 0;
			connectionEmitter.fire(snapshot);
			await Promise.resolve();

			assert.ok(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId));
			assert.strictEqual(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId), false);
			actionButton(container).click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);
		} finally {
			disposables.dispose();
		}
	});

	test('stale async isBridgeAvailable result is ignored when connection drops or generation advances', async () => {
		const disposables = new DisposableStore();
		try {
			let connected = true;
			const connectionEmitter = disposables.add(new Emitter<UniverseAgentConnectionSnapshot>());
			const deferredBridge1 = new DeferredPromise<boolean>();
			const deferredBridge2 = new DeferredPromise<boolean>();
			let callIndex = 0;
			const { container, executedCommands } = createTerminalWatermark(
				disposables,
				new class extends mock<IUniverseAgentConnection>() {
					override isEngineConnected() { return connected; }
					override onDidChangeConnection = connectionEmitter.event;
				}(),
				new class extends mock<IUniverseAgentPty>() {
					override isBridgeAvailable() {
						callIndex++;
						return callIndex === 1 ? deferredBridge1.p : deferredBridge2.p;
					}
				}()
			);

			assert.strictEqual(callIndex, 1);

			// Connection drops: synchronous reset to disconnected/local command
			connected = false;
			connectionEmitter.fire(snapshot);

			actionButton(container).click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);

			// The first probe finishes with `true` while disconnected: ignored
			deferredBridge1.complete(true);
			await Promise.resolve();

			executedCommands.length = 0;
			actionButton(container).click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);

			// Reconnect and trigger a second query that returns false
			connected = true;
			connectionEmitter.fire(snapshot);
			assert.strictEqual(callIndex, 2);

			deferredBridge2.complete(false);
			await Promise.resolve();

			executedCommands.length = 0;
			actionButton(container).click();
			assert.deepStrictEqual(executedCommands, [previewTerminalLocalCommandId]);
		} finally {
			disposables.dispose();
		}
	});

	test('isBridgeAvailable is not called when disconnected', async () => {
		const disposables = new DisposableStore();
		try {
			let connected = false;
			const connectionEmitter = disposables.add(new Emitter<UniverseAgentConnectionSnapshot>());
			let bridgeCallCount = 0;
			createTerminalWatermark(
				disposables,
				new class extends mock<IUniverseAgentConnection>() {
					override isEngineConnected() { return connected; }
					override onDidChangeConnection = connectionEmitter.event;
				}(),
				new class extends mock<IUniverseAgentPty>() {
					override isBridgeAvailable() {
						bridgeCallCount++;
						return Promise.resolve(true);
					}
				}()
			);

			await Promise.resolve();
			assert.strictEqual(bridgeCallCount, 0, 'Should not query bridge when created disconnected');

			connectionEmitter.fire(snapshot);
			await Promise.resolve();
			assert.strictEqual(bridgeCallCount, 0, 'Should not query bridge when connection event fires but still disconnected');

			connected = true;
			connectionEmitter.fire(snapshot);
			await Promise.resolve();
			assert.strictEqual(bridgeCallCount, 1, 'Should query bridge when connected');
		} finally {
			disposables.dispose();
		}
	});

	test('watermark disposal while isBridgeAvailable is in flight does not trigger render', async () => {
		const disposables = new DisposableStore();
		try {
			const deferredBridge = new DeferredPromise<boolean>();
			const { container, watermark } = createTerminalWatermark(
				disposables,
				new class extends mock<IUniverseAgentConnection>() {
					override isEngineConnected() { return true; }
					override onDidChangeConnection = Event.None;
				}(),
				new class extends mock<IUniverseAgentPty>() {
					override isBridgeAvailable() { return deferredBridge.p; }
				}()
			);

			// Dispose while isBridgeAvailable is still pending
			watermark.dispose();

			// Clear container children to observe if render runs after disposal
			container.replaceChildren();

			deferredBridge.complete(true);
			await Promise.resolve();

			// render() must not run on the disposed watermark
			assert.strictEqual(container.childNodes.length, 0);
		} finally {
			disposables.dispose();
		}
	});

	test('pending isBridgeAvailable click does not run the local terminal command', async () => {
		const disposables = new DisposableStore();
		try {
			const deferredBridge = new DeferredPromise<boolean>();
			let bridgeCalls = 0;
			const { container, lookedUpKeybindingIds, executedCommands } = createTerminalWatermark(
				disposables,
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
			);

			assert.strictEqual(bridgeCalls, 1);
			assert.strictEqual(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId), false);
			assert.strictEqual(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId), false);

			actionButton(container).click();
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
			actionButton(container).click();
			assert.deepStrictEqual(executedCommands, [previewUniverseAgentPtyEditorCommandId]);
		} finally {
			disposables.dispose();
		}
	});

	test('rejected isBridgeAvailable stays unknown until the next click probes again', async () => {
		const disposables = new DisposableStore();
		try {
			const deferredBridge = new DeferredPromise<boolean>();
			let bridgeCalls = 0;
			const { container, lookedUpKeybindingIds, executedCommands } = createTerminalWatermark(
				disposables,
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
			);

			await Promise.resolve();
			assert.strictEqual(bridgeCalls, 1);
			assert.deepStrictEqual(executedCommands, []);
			assert.strictEqual(lookedUpKeybindingIds.includes(previewTerminalLocalCommandId), false);
			assert.strictEqual(lookedUpKeybindingIds.includes(previewUniverseAgentPtyEditorCommandId), false);

			actionButton(container).click();
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
				const deferredFirst = new DeferredPromise<boolean>();
				const deferredSecond = new DeferredPromise<boolean>();
				let bridgeCalls = 0;
				const connectionEmitter = disposables.add(new Emitter<UniverseAgentConnectionSnapshot>());
				const { container, executedCommands } = createTerminalWatermark(
					disposables,
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
				);

				assert.strictEqual(bridgeCalls, 1, outcome.label);

				actionButton(container).click();
				assert.strictEqual(bridgeCalls, 1, `${outcome.label}: click must not start another probe`);
				assert.deepStrictEqual(executedCommands, [], `${outcome.label}: click must not send a command while the first probe is in flight`);

				connectionEmitter.fire(snapshot);
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

	suite('executePreviewTerminalEmptyState', () => {

		function createAccessorServices(disposables: DisposableStore, connected: boolean, bridgeAvailable: boolean, executed: { id: string; args: unknown[] }[]): InstantiationService {
			return disposables.add(new InstantiationService(new ServiceCollection(
				[ICommandService, new class extends mock<ICommandService>() {
					override executeCommand<T = unknown>(id: string, ...args: unknown[]): Promise<T | undefined> {
						executed.push({ id, args });
						return Promise.resolve(undefined);
					}
				}()],
				[IUniverseAgentConnection, new class extends mock<IUniverseAgentConnection>() {
					override isEngineConnected() { return connected; }
				}()],
				[IUniverseAgentPty, new class extends mock<IUniverseAgentPty>() {
					override isBridgeAvailable() { return Promise.resolve(bridgeAvailable); }
				}()],
			)));
		}

		test('opens the pty editor when connected and the bridge is available', async () => {
			const disposables = new DisposableStore();
			try {
				const executed: { id: string; args: unknown[] }[] = [];
				const instantiationService = createAccessorServices(disposables, true, true, executed);
				await instantiationService.invokeFunction(accessor => executePreviewTerminalEmptyState(accessor, 2));
				assert.deepStrictEqual(executed, [{ id: previewUniverseAgentPtyEditorCommandId, args: [{ location: { viewColumn: 2 } }] }]);
			} finally {
				disposables.dispose();
			}
		});

		test('opens the local terminal when disconnected', async () => {
			const disposables = new DisposableStore();
			try {
				const executed: { id: string; args: unknown[] }[] = [];
				const instantiationService = createAccessorServices(disposables, false, true, executed);
				await instantiationService.invokeFunction(accessor => executePreviewTerminalEmptyState(accessor, 1));
				assert.deepStrictEqual(executed, [{ id: previewTerminalLocalCommandId, args: [{ location: { viewColumn: 1 } }] }]);
			} finally {
				disposables.dispose();
			}
		});
	});
});
