/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { Schemas } from '../../../../../base/common/network.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { ServiceIdentifier, ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { DEBUG_START_COMMAND_ID } from '../../browser/debugCommands.js';
import { DebugService } from '../../browser/debugService.js';
import { DebugTaskRunner, TaskRunResult } from '../../browser/debugTaskRunner.js';
import { IDebugService, IDebugSession, State } from '../../common/debug.js';
import { saveAllBeforeDebugStart } from '../../common/debugUtils.js';

function editorService(options: {
	saveAllSuccess: boolean;
	saveSuccess?: boolean;
	untitled?: boolean;
	onSaveAll?: () => void;
	onSave?: () => void;
}): IEditorService {
	const resource = options.untitled
		? URI.from({ scheme: Schemas.untitled, path: 'Untitled-1' })
		: URI.file('/tmp/saved.ts');
	return {
		activeTextEditorLanguageId: 'plaintext',
		activeEditorPane: {
			input: { resource },
			group: { id: 1 },
		},
		saveAll: async () => {
			options.onSaveAll?.();
			return { success: options.saveAllSuccess, editors: [] };
		},
		save: async () => {
			options.onSave?.();
			return { success: options.saveSuccess !== false, editors: [] };
		},
	} as unknown as IEditorService;
}

function configurationService(saveBeforeStart: string): { service: IConfigurationService; reloads: () => number } {
	let reloadCount = 0;
	const service = {
		getValue: () => saveBeforeStart,
		reloadConfiguration: async () => {
			reloadCount++;
		},
	} as unknown as IConfigurationService;
	return { service, reloads: () => reloadCount };
}

function accessorFor(services: Map<ServiceIdentifier<unknown>, unknown>): ServicesAccessor {
	return {
		get<T>(id: ServiceIdentifier<T>): T {
			if (!services.has(id as ServiceIdentifier<unknown>)) {
				throw new Error('unexpected service');
			}
			return services.get(id as ServiceIdentifier<unknown>) as T;
		},
	};
}

type DebugServiceTestStub = {
	workspaceTrustRequestService: { requestWorkspaceTrust(): Promise<boolean> };
	haveDoneLazySetup: boolean;
	initializing: boolean;
	previousState: State | undefined;
	hasDebugged: { set(): void };
	extensionService: {
		activateByEvent(): Promise<void>;
		whenInstalledExtensionsRegistered(): Promise<void>;
	};
	configurationService: IConfigurationService;
	editorService: IEditorService;
	viewModel: { focusedSession: undefined };
	contextKeyService: { bufferChangeEvents(callback: () => void): void };
	debugState: { set(): void };
	inDebugMode: { set(): void };
	adapterManager: { hasEnabledDebuggers(): boolean };
	configurationManager: { selectedConfiguration: { name: undefined } };
	debugUx: { set(): void };
	debugStorage: { storeDebugUxState(): void };
	_onDidChangeState: { fire(state: State): void };
	notificationService: { error(): void };
	taskRunner: Pick<DebugTaskRunner, 'runTask' | 'runTaskAndCheckErrors'>;
	startDebugging: DebugService['startDebugging'];
	restartSession: DebugService['restartSession'];
	readonly state: State;
};

function createDebugServiceTestStub(): DebugServiceTestStub {
	return Object.create(DebugService.prototype) as unknown as DebugServiceTestStub;
}

suite('Debug - saveAllBeforeDebugStart', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('saveAllBeforeDebugStart returns false and skips reload when saveAll fails', async () => {
		const configuration = configurationService('nonUntitledEditorsInActiveGroup');
		let saves = 0;
		const editors = editorService({
			saveAllSuccess: false,
			untitled: true,
			onSave: () => { saves++; },
		});
		const saved = await saveAllBeforeDebugStart(configuration.service, editors);
		assert.strictEqual(saved, false);
		assert.strictEqual(configuration.reloads(), 0);
		assert.strictEqual(saves, 0);
	});

	test('saveAllBeforeDebugStart returns false and skips reload when untitled save fails', async () => {
		const configuration = configurationService('allEditorsInActiveGroup');
		let saveAllCalls = 0;
		let saveCalls = 0;
		const editors = editorService({
			saveAllSuccess: true,
			saveSuccess: false,
			untitled: true,
			onSaveAll: () => { saveAllCalls++; },
			onSave: () => { saveCalls++; },
		});
		const saved = await saveAllBeforeDebugStart(configuration.service, editors);
		assert.strictEqual(saved, false);
		assert.strictEqual(configuration.reloads(), 0);
		assert.strictEqual(saveAllCalls, 1);
		assert.strictEqual(saveCalls, 1);
	});

	test('saveAllBeforeDebugStart returns true for none without saveAll', async () => {
		const configuration = configurationService('none');
		let saveAllCalls = 0;
		const editors = editorService({
			saveAllSuccess: false,
			onSaveAll: () => { saveAllCalls++; },
		});
		const saved = await saveAllBeforeDebugStart(configuration.service, editors);
		assert.strictEqual(saved, true);
		assert.strictEqual(saveAllCalls, 0);
		assert.strictEqual(configuration.reloads(), 1);
	});

	test('saveAllBeforeDebugStart reloads when both saves succeed', async () => {
		const configuration = configurationService('allEditorsInActiveGroup');
		const editors = editorService({
			saveAllSuccess: true,
			saveSuccess: true,
			untitled: true,
		});
		const saved = await saveAllBeforeDebugStart(configuration.service, editors);
		assert.strictEqual(saved, true);
		assert.strictEqual(configuration.reloads(), 1);
	});

	test('startDebugging returns false and leaves initializing when save fails', async () => {
		const configuration = configurationService('nonUntitledEditorsInActiveGroup');
		const editors = editorService({ saveAllSuccess: false });
		const seenStates: State[] = [];
		let notified = false;
		const service = createDebugServiceTestStub();
		service.workspaceTrustRequestService = { requestWorkspaceTrust: async () => true };
		service.haveDoneLazySetup = true;
		service.initializing = false;
		service.previousState = undefined;
		service.hasDebugged = { set() { } };
		service.extensionService = {
			activateByEvent: async () => { },
			whenInstalledExtensionsRegistered: async () => {
				throw new Error('startDebugging continued after failed save');
			},
		};
		service.configurationService = configuration.service;
		service.editorService = editors;
		service.viewModel = { focusedSession: undefined };
		service.contextKeyService = { bufferChangeEvents: (callback: () => void) => callback() };
		service.debugState = { set() { } };
		service.inDebugMode = { set() { } };
		service.adapterManager = { hasEnabledDebuggers: () => false };
		service.configurationManager = { selectedConfiguration: { name: undefined } };
		service.debugUx = { set() { } };
		service.debugStorage = { storeDebugUxState() { } };
		service._onDidChangeState = { fire: (state: State) => seenStates.push(state) };
		service.notificationService = { error() { notified = true; } };

		const result = await service.startDebugging(undefined, undefined, undefined, true);

		assert.strictEqual(result, false);
		assert.strictEqual(notified, false);
		assert.strictEqual(service.state, State.Inactive);
		assert.deepStrictEqual(seenStates, [State.Initializing, State.Inactive]);
		assert.strictEqual(configuration.reloads(), 0);
	});

	test('DEBUG_START_COMMAND_ID does not call startDebugging when save fails', async () => {
		const configuration = configurationService('allEditorsInActiveGroup');
		const editors = editorService({ saveAllSuccess: false });
		let started = 0;
		const debugService = {
			startDebugging: async () => {
				started++;
				return true;
			},
			getConfigurationManager() {
				throw new Error('start command continued after failed save');
			},
		};
		const services = new Map<ServiceIdentifier<unknown>, unknown>();
		services.set(IDebugService, debugService);
		services.set(IConfigurationService, configuration.service);
		services.set(IEditorService, editors);
		const command = CommandsRegistry.getCommand(DEBUG_START_COMMAND_ID);
		assert.ok(command);
		await command!.handler(accessorFor(services));
		assert.strictEqual(started, 0);
		assert.strictEqual(configuration.reloads(), 0);
	});

	test('restartSession returns before tasks when save fails', async () => {
		const configuration = configurationService('allEditorsInActiveGroup');
		const editors = editorService({ saveAllSuccess: false });
		let tasks = 0;
		const service = createDebugServiceTestStub();
		service.configurationService = configuration.service;
		service.editorService = editors;
		service.taskRunner = {
			runTask: (root, taskId, token?) => {
				tasks++;
				return Promise.resolve(null);
			},
			runTaskAndCheckErrors: (root, taskId) => {
				tasks++;
				return Promise.resolve(TaskRunResult.Failure);
			},
		};
		const session = {
			saveBeforeRestart: true,
			configuration: { type: 'node', name: 'app', request: 'launch' },
			root: undefined,
		};
		await service.restartSession(session as unknown as IDebugSession);
		assert.strictEqual(tasks, 0);
		assert.strictEqual(configuration.reloads(), 0);
	});
});
