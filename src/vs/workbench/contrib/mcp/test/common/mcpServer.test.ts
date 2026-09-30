/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
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
	IMcpElicitationService,
	IMcpSamplingService,
	McpConnectionState,
	McpServerDefinition,
	McpServerLaunch,
	UserInteractionRequiredError,
} from '../../common/mcpTypes.js';
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

suite('Workbench - MCP - McpServer', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let registry: TestMcpRegistry;
	let delegate: ErrorThenRunningDelegate;

	setup(() => {
		delegate = store.add(new ErrorThenRunningDelegate());

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
				launchInSandboxIfEnabled: (_serverDef, launch) => Promise.resolve(launch),
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
			[IMcpElicitationService, {
				_serviceBrand: undefined,
				elicit: async () => ({ dispose: () => { }, value: { action: 'cancel' as const } }),
			}],
		);

		const parentInstantiationService = store.add(new TestInstantiationService(services));

		registry = new TestMcpRegistry(parentInstantiationService);
		registry.delegates.set([delegate], undefined);

		instantiationService = store.add(parentInstantiationService.createChild(new ServiceCollection(
			[IMcpRegistry, registry],
		)));
	});

	function createServer(): McpServer {
		const collection = registry.collections.get()[0];
		const definition = collection.serverDefinitions.get()[0];

		return store.add(instantiationService.createInstance(
			McpServer,
			collection,
			definition,
			undefined,
			false,
			store.add(instantiationService.createInstance(McpServerMetadataCache, StorageScope.APPLICATION)),
			new McpPrefixGenerator(),
			new TestEnablementModel(),
		));
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
});
