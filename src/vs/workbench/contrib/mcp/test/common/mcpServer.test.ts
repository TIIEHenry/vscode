/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { derived, waitForState } from '../../../../../base/common/observable.js';
import { upcast } from '../../../../../base/common/types.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILoggerService } from '../../../../../platform/log/common/log.js';
import { IAllowedMcpServersService } from '../../../../../platform/mcp/common/mcpManagement.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IStorageService, StorageScope } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IOutputService } from '../../../../services/output/common/output.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IExtensionService, NullExtensionService } from '../../../../services/extensions/common/extensions.js';
import { TestContextService, TestLoggerService, TestProductService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IMcpHostDelegate, IMcpMessageTransport, IMcpRegistry } from '../../common/mcpRegistryTypes.js';
import { McpServer, McpServerMetadataCache, McpPrefixGenerator } from '../../common/mcpServer.js';
import { IMcpSandboxService } from '../../common/mcpSandboxService.js';
import {
	ElicitationKind,
	IMcpElicitationService,
	IMcpSamplingService,
	McpConnectionState,
	McpServerDefinition,
	McpServerLaunch,
	McpToolVisibility,
	UserInteractionRequiredError,
} from '../../common/mcpTypes.js';
import { MCP } from '../../common/modelContextProtocol.js';
import { TestEnablementModel } from './testMcpService.js';
import { TestMcpMessageTransport, TestMcpRegistry } from './mcpRegistryTypes.js';

class ErrorThenRunningDelegate extends Disposable implements IMcpHostDelegate {
	startCallCount = 0;
	priority = 0;

	substituteVariables(_serverDefinition: McpServerDefinition, launch: McpServerLaunch): Promise<McpServerLaunch> {
		return Promise.resolve(launch);
	}

	canStart(): boolean {
		return true;
	}

	waitForInitialProviderPromises(): Promise<void> {
		return Promise.resolve();
	}

	start(): IMcpMessageTransport {
		this.startCallCount++;
		const transport = new TestMcpMessageTransport();
		if (this.startCallCount === 1) {
			transport.setConnectionState({ state: McpConnectionState.Kind.Error, message: 'failed' });
		} else {
			transport.setConnectionState({ state: McpConnectionState.Kind.Running });
		}
		return transport;
	}
}

class RunningToolsDelegate extends Disposable implements IMcpHostDelegate {
	priority = 0;

	constructor(private readonly _tools: readonly MCP.Tool[]) {
		super();
	}

	substituteVariables(_serverDefinition: McpServerDefinition, launch: McpServerLaunch): Promise<McpServerLaunch> {
		return Promise.resolve(launch);
	}

	canStart(): boolean {
		return true;
	}

	waitForInitialProviderPromises(): Promise<void> {
		return Promise.resolve();
	}

	start(): IMcpMessageTransport {
		const transport = new TestMcpMessageTransport();
		transport.setResponder('tools/list', message => ({
			jsonrpc: MCP.JSONRPC_VERSION,
			id: (message as MCP.JSONRPCRequest).id,
			result: { tools: [...this._tools] } satisfies MCP.ListToolsResult,
		}));
		transport.setConnectionState({ state: McpConnectionState.Kind.Running });
		return transport;
	}
}

suite('Workbench - MCP - McpServer', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let registry: TestMcpRegistry;
	let delegate: ErrorThenRunningDelegate;
	let elicit: IMcpElicitationService['elicit'];

	setup(() => {
		delegate = store.add(new ErrorThenRunningDelegate());
		elicit = async () => ({ kind: ElicitationKind.Form, dispose: () => { }, value: { action: 'cancel' } });

		const services = new ServiceCollection(
			[IStorageService, store.add(new TestStorageService())],
			[ILoggerService, store.add(new TestLoggerService())],
			[IWorkspaceContextService, new TestContextService()],
			[IWorkbenchEnvironmentService, upcast({ remoteAuthority: undefined })],
			[ITelemetryService, NullTelemetryService],
			[IProductService, TestProductService],
			[IOutputService, upcast({ showChannel: () => { } })],
			[INotificationService, new TestNotificationService()],
			[IOpenerService, upcast({ open: async () => true })],
			[ICommandService, upcast({ executeCommand: async () => undefined })],
			[IExtensionService, new NullExtensionService()],
			[IDialogService, upcast({ prompt: async () => ({}) })],
			[IAllowedMcpServersService, {
				_serviceBrand: undefined,
				onDidChangeAllowedMcpServers: Event.None,
				isAllowed: () => true,
				isServerAllowed: () => true,
			}],
			[IMcpSandboxService, {
				_serviceBrand: undefined,
				launchInSandboxIfEnabled: (_serverDef: McpServerDefinition, launch: McpServerLaunch) => Promise.resolve(launch),
				isEnabled: () => Promise.resolve(false),
				getSandboxConfigSuggestionMessage: () => undefined,
				applySandboxConfigSuggestion: () => Promise.resolve(false),
			}],
			[IMcpSamplingService, {
				_serviceBrand: undefined,
				sample: async () => ({ sample: {} as never }),
				hasLogs: () => false,
				getLogText: () => '',
				getConfig: () => ({} as never),
				updateConfig: async () => ({} as never),
			}],
			[IMcpElicitationService, upcast<IMcpElicitationService>({
				_serviceBrand: undefined,
				elicit: (server, context, elicitation, token) => elicit(server, context, elicitation, token),
			})],
		);

		const parentInstantiationService = store.add(new TestInstantiationService(services));

		registry = new TestMcpRegistry(parentInstantiationService);
		registry.delegates.set([delegate], undefined);

		instantiationService = store.add(parentInstantiationService.createChild(new ServiceCollection(
			[IMcpRegistry, registry],
		)));
	});

	function createServer(cache?: McpServerMetadataCache): McpServer {
		const collection = registry.collections.get()[0];
		const definition = collection.serverDefinitions.get()[0];

		return store.add(instantiationService.createInstance(
			McpServer,
			collection,
			definition,
			undefined,
			false,
			cache ?? store.add(instantiationService.createInstance(McpServerMetadataCache, StorageScope.APPLICATION)),
			new McpPrefixGenerator(),
			new TestEnablementModel(),
		));
	}

	const liveTool: MCP.Tool = { name: 'live_tool', description: 'Live tool', inputSchema: { type: 'object', properties: {} } };

	function setupPendingToolValidation() {
		registry.delegates.set([store.add(new RunningToolsDelegate([liveTool]))], undefined);
		const validateCalled = new DeferredPromise<void>();
		const validateResult = new DeferredPromise<undefined>();
		instantiationService.stub(ICommandService, {
			executeCommand: <R>(id: string): Promise<R | undefined> => {
				if (id !== 'json.validate') {
					return Promise.resolve(undefined);
				}
				validateCalled.complete();
				return validateResult.p;
			},
		});
		const cache = store.add(instantiationService.createInstance(McpServerMetadataCache, StorageScope.APPLICATION));
		const definition = registry.collections.get()[0].serverDefinitions.get()[0];
		cache.store(definition.id, {
			tools: [{
				name: 'cached_tool',
				description: 'Cached tool',
				inputSchema: { type: 'object', properties: {} },
				serverToolName: 'cached_tool',
				_icons: [],
				visibility: McpToolVisibility.Model | McpToolVisibility.App,
			}],
			nonce: definition.cacheNonce,
		});
		return { validateCalled, validateResult, cache, definition, server: createServer(cache) };
	}

	test('non-quiet error start settles and the next queued start runs', async () => {
		const server = createServer();

		const first = await server.start();
		assert.strictEqual(first.state, McpConnectionState.Kind.Error);
		assert.strictEqual(first.message, 'failed');

		const second = await server.start();
		assert.strictEqual(second.state, McpConnectionState.Kind.Running);
		assert.strictEqual(delegate.startCallCount, 2);
	});

	test('quiet error start rejects with UserInteractionRequiredError', async () => {
		const server = createServer();

		await assert.rejects(
			() => server.start({ errorOnUserInteraction: true }),
			(err: unknown) => {
				assert.ok(err instanceof UserInteractionRequiredError);
				assert.strictEqual(err.reason, 'start');
				assert.strictEqual(err.message, 'User interaction required: start');
				return true;
			},
		);
	});

	test('accepted URL elicitation keeps waiting for completion after responding', async () => {
		delegate.startCallCount = 1; // next start is Running
		let transport: TestMcpMessageTransport | undefined;
		const start = delegate.start.bind(delegate);
		delegate.start = () => transport = start() as TestMcpMessageTransport;

		const wait = new DeferredPromise<void>();
		let disposed = 0;
		elicit = async () => ({ kind: ElicitationKind.URL, value: { action: 'accept' }, wait: wait.p, dispose: () => { disposed++; } });

		const server = createServer();
		const state = await server.start();
		assert.strictEqual(state.state, McpConnectionState.Kind.Running);
		await waitForState(derived(reader => server.connection.read(reader)?.handler.read(reader)));

		transport!.simulateReceiveMessage({
			jsonrpc: MCP.JSONRPC_VERSION,
			id: 99,
			method: 'elicitation/create',
			params: { mode: 'url', message: 'Sign in', elicitationId: 'e1', url: 'https://example.com' },
		});
		while (!transport!.getSentMessages().some(m => (m as Partial<MCP.JSONRPCResultResponse>).id === 99 && (m as Partial<MCP.JSONRPCResultResponse>).result !== undefined)) {
			await timeout(1);
		}

		assert.strictEqual(disposed, 0, 'URL elicitation must not be disposed before the completion notification');
		wait.complete();
		await wait.p;
		await timeout(0);
		assert.strictEqual(disposed, 1);
	});

	test('late tool validation after dispose keeps the cached tools', async () => {
		const { validateCalled, validateResult, cache, definition, server } = setupPendingToolValidation();
		const cachedTools = cache.get(definition.id)?.tools;
		assert.strictEqual(cachedTools?.length, 1);

		const state = await server.start();
		assert.strictEqual(state.state, McpConnectionState.Kind.Running);
		await validateCalled.p;
		server.dispose();
		await validateResult.complete(undefined);
		await timeout(0);

		assert.strictEqual(cache.get(definition.id)?.tools, cachedTools, 'a server disposed during validation must not overwrite the cached tools');
		assert.deepStrictEqual(cache.get(definition.id)?.tools.map(tool => tool.serverToolName), ['cached_tool']);
	});

	test('tool validation on a live server stores the validated tools', async () => {
		const { validateCalled, validateResult, cache, definition, server } = setupPendingToolValidation();

		const state = await server.start();
		assert.strictEqual(state.state, McpConnectionState.Kind.Running);
		await validateCalled.p;
		await validateResult.complete(undefined);
		await timeout(0);

		assert.deepStrictEqual(cache.get(definition.id)?.tools.map(tool => tool.serverToolName), [liveTool.name]);
		assert.strictEqual(cache.get(definition.id)?.nonce, definition.cacheNonce);
	});
});
