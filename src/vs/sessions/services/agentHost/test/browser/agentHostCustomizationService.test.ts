/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CustomizationType, McpServerStatus, type Customization, type McpServerCustomization, type PluginCustomization, type RootConfigState } from '../../../../../platform/agentHost/common/state/protocol/state.js';
import { McpServerType } from '../../../../../platform/mcp/common/mcpPlatformTypes.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILoggerService, NullLoggerService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IOutputService } from '../../../../../workbench/services/output/common/output.js';
import { IAgentHostActiveClientService } from '../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostActiveClientService.js';
import { IAgentHostSessionsProvider } from '../../../../common/agentHostSessionsProvider.js';
import { AgentHostCustomizationService } from '../../browser/agentHostCustomizationService.js';
import { ISession } from '../../../sessions/common/session.js';
import { ISessionsManagementService } from '../../../sessions/common/sessionsManagement.js';
import { ISessionsProvidersService } from '../../../sessions/browser/sessionsProvidersService.js';
import { ISessionsService } from '../../../sessions/browser/sessionsService.js';
import { ISessionsProvider } from '../../../sessions/common/sessionsProvider.js';

suite('AgentHostCustomizationService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(options: {
		readonly sessionResource: URI;
		readonly getCustomizations?: () => Customization[];
		readonly getRootConfig?: () => RootConfigState | undefined;
		readonly setRootConfigValue?: (property: string, value: unknown) => Promise<void>;
		readonly isBundledMcpServer?: (pluginUri: string, serverName: string) => boolean;
	}): AgentHostCustomizationService {
		const session = new class extends mock<ISession>() {
			override readonly resource = options.sessionResource;
			override readonly providerId = 'agenthost-test';
			override readonly sessionId = 'agenthost-test:session-1';
		};
		const provider = new class extends mock<IAgentHostSessionsProvider>() {
			override readonly id = 'agenthost-test';
			override readonly onDidChangeCustomAgents = Event.None;
			override readonly onDidChangeCustomizations = Event.None;
			override getCustomizations(): Customization[] {
				return options.getCustomizations?.() ?? [];
			}
			override getWorkingDirectory(): string | undefined {
				return undefined;
			}
			override getWorkingDirectories(): readonly string[] {
				return [];
			}
			override getRootConfig() {
				return options.getRootConfig?.();
			}
			override setRootConfigValue(property: string, value: unknown): Promise<void> {
				return options.setRootConfigValue?.(property, value) ?? Promise.resolve();
			}
			override getMcpServers() {
				return [];
			}
			override authenticate() {
				return Promise.resolve({ authenticated: false });
			}
			override setCustomizationEnablement(): void {
				// no-op
			}
		};
		const sessionsManagementService = new class extends mock<ISessionsManagementService>() {
			override readonly onDidChangeSessions = Event.None;
			override getSession(resource: URI): ISession | undefined {
				return resource.toString() === options.sessionResource.toString() ? session : undefined;
			}
		};
		const sessionsService = new class extends mock<ISessionsService>() {
			override readonly activeSession = observableValue(this, undefined);
		};
		const sessionsProvidersService = new class extends mock<ISessionsProvidersService>() {
			constructor(private readonly _provider: ISessionsProvider) {
				super();
			}
			override getProvider<T extends ISessionsProvider>(): T | undefined {
				return this._provider as T;
			}
		}(provider);
		const activeClientService = new class extends mock<IAgentHostActiveClientService>() {
			override isBundledMcpServer(pluginUri: string, serverName: string): boolean {
				return options.isBundledMcpServer?.(pluginUri, serverName) ?? false;
			}
		};
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(ILoggerService, store.add(new NullLoggerService()));
		instantiationService.stub(IOutputService, {
			getChannel: () => undefined,
			getChannelDescriptor: () => undefined,
			showChannel: async () => { },
		});
		return store.add(new AgentHostCustomizationService(
			sessionsManagementService,
			sessionsService,
			sessionsProvidersService,
			instantiationService,
			new NullLogService(),
			activeClientService,
		));
	}

	test('reports client-bundled MCP servers from the active client', () => {
		const sessionResource = URI.parse('agent-host-copilot:///session-1');
		const server: McpServerCustomization = {
			type: CustomizationType.McpServer,
			id: 'context7',
			uri: 'file:///plugin/.mcp.json',
			name: 'context7',
			state: { kind: McpServerStatus.Stopped },
		};
		const plugin: PluginCustomization = {
			type: CustomizationType.Plugin,
			id: 'plugin',
			uri: 'vscode-synced-customization:///plugin',
			name: 'Plugin',
			children: [server],
		};
		const service = createService({
			sessionResource,
			getCustomizations: () => [plugin],
			isBundledMcpServer: (pluginUri, serverName) => pluginUri === plugin.uri && serverName === server.name,
		});

		const [mcpServer] = service.getMcpServers(sessionResource);

		assert.deepStrictEqual({ isClientBundled: mcpServer.isClientBundled }, { isClientBundled: true });
	});

	test('does not leak unhandled rejection when setRootConfigValue rejects', async () => {
		const sessionResource = URI.parse('agent-host-copilot:///session-1');
		const service = createService({
			sessionResource,
			getRootConfig: () => ({ schema: { type: 'object', properties: {} }, values: {} }),
			setRootConfigValue: async () => {
				throw new Error('boom');
			},
		});

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			service.addMcpServer(sessionResource, 'demo', { type: McpServerType.LOCAL, command: 'echo' });
			await timeout(0);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
