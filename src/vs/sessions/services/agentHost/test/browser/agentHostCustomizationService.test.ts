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
import { IAgentHostMcpServer } from '../../../../../platform/agentHost/common/agentHostMcpServer.js';
import { IAgentHostSessionsProvider } from '../../../../common/agentHostSessionsProvider.js';
import { AgentHostCustomizationService } from '../../browser/agentHostCustomizationService.js';
import { IChat, ISession } from '../../../sessions/common/session.js';
import { IActiveSession, ISessionsManagementService } from '../../../sessions/common/sessionsManagement.js';
import { ISessionsProvidersService } from '../../../sessions/browser/sessionsProvidersService.js';
import { ISessionsService } from '../../../sessions/browser/sessionsService.js';
import { ISessionsProvider } from '../../../sessions/common/sessionsProvider.js';

suite('AgentHostCustomizationService', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(options: {
		readonly sessionResource: URI;
		readonly sessionId?: string;
		readonly activeSession?: ISession;
		readonly extraSessions?: readonly ISession[];
		readonly chatOwnerSessionIds?: ReadonlyMap<string, string>;
		readonly getCustomizations?: (sessionId: string) => Customization[];
		readonly getRootConfig?: () => RootConfigState | undefined;
		readonly setRootConfigValue?: (property: string, value: unknown) => Promise<void>;
		readonly isBundledMcpServer?: (pluginUri: string, serverName: string) => boolean;
		readonly mapAgentHostResource?: (uri: URI) => URI;
		readonly feedbackFromAgentHost?: (uri: URI) => URI;
		readonly onStart?: (sessionId: string) => void;
		readonly onEnablement?: (sessionId: string, rawId: string) => void;
	}): AgentHostCustomizationService {
		const session = new class extends mock<ISession>() {
			override readonly resource = options.sessionResource;
			override readonly providerId = 'agenthost-test';
			override readonly sessionId = options.sessionId ?? 'agenthost-test:session-1';
			override readonly mode = observableValue<{ readonly id: string; readonly kind: string } | undefined>(this, undefined);
		};
		const sessions = [session, ...(options.extraSessions ?? [])];
		const provider = new class extends mock<IAgentHostSessionsProvider>() {
			override readonly id = 'agenthost-test';
			override readonly onDidChangeCustomAgents = Event.None;
			override readonly onDidChangeCustomizations = Event.None;
			override getCustomizations(sessionId: string): Customization[] {
				return options.getCustomizations?.(sessionId) ?? [];
			}
			override getCustomAgents() {
				return [];
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
			override mapAgentHostResource(uri: URI): URI {
				return options.mapAgentHostResource?.(uri) ?? uri;
			}
			override getFeedbackAnnotationsChannel() {
				if (!options.feedbackFromAgentHost) {
					return undefined;
				}
				const fromAgentHost = options.feedbackFromAgentHost;
				return {
					connection: {
						resourceUris: {
							fromAgentHost,
							toAgentHost: (uri: URI) => uri,
						},
					},
					annotationsUri: URI.parse('file:///annotations'),
				} as NonNullable<ReturnType<IAgentHostSessionsProvider['getFeedbackAnnotationsChannel']>>;
			}
			override getMcpServers(sessionId: string): readonly IAgentHostMcpServer[] {
				return [{
					id: '/docs',
					name: 'docs',
					enabled: true,
					status: McpServerStatus.Stopped,
					state: { kind: McpServerStatus.Stopped },
					start: async () => { options.onStart?.(sessionId); },
					stop: async () => { },
					setEnabled: (_enabled: boolean) => { },
				} as IAgentHostMcpServer];
			}
			override authenticate() {
				return Promise.resolve({ authenticated: false });
			}
			override setCustomizationEnablement(sessionId: string, rawId: string): void {
				options.onEnablement?.(sessionId, rawId);
			}
		};
		const sessionsManagementService = new class extends mock<ISessionsManagementService>() {
			override readonly onDidChangeSessions = Event.None;
			override getSession(resource: URI): ISession | undefined {
				return sessions.find(candidate => candidate.resource.toString() === resource.toString());
			}
			override getSessionForChatResource(resource: URI): { session: ISession; chat: IChat } | undefined {
				const ownerSessionId = options.chatOwnerSessionIds?.get(resource.toString());
				const owner = sessions.find(candidate => candidate.sessionId === ownerSessionId);
				if (!owner) {
					return undefined;
				}
				return { session: owner, chat: { resource } as IChat };
			}
		};
		const sessionsService = new class extends mock<ISessionsService>() {
			override readonly activeSession = observableValue(this, options.activeSession as IActiveSession | undefined);
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

	test('routes a peer chat to the owning session instead of the active session', async () => {
		const activeResource = URI.parse('agent-host-copilot:///session-a');
		const ownerResource = URI.parse('agent-host-copilot:///session-b');
		const peer = ownerResource.with({ fragment: 'side-chat' });
		const unlisted = ownerResource.with({ fragment: 'not-yet-listed' });
		const activePeer = activeResource.with({ fragment: 'peer' });
		const activeSessionId = 'agenthost-test:session-a';
		const ownerSessionId = 'agenthost-test:session-b';
		const activeSession = new class extends mock<ISession>() {
			override readonly resource = activeResource;
			override readonly providerId = 'agenthost-test';
			override readonly sessionId = activeSessionId;
			override readonly mode = observableValue<{ readonly id: string; readonly kind: string } | undefined>(this, { id: 'file:///side.agent.md', kind: 'agent' });
		};
		const managementActive = new class extends mock<ISession>() {
			override readonly resource = activeResource;
			override readonly providerId = 'agenthost-test';
			override readonly sessionId = activeSessionId;
			override readonly mode = observableValue<{ readonly id: string; readonly kind: string } | undefined>(this, undefined);
		};
		const ownerServer: McpServerCustomization = {
			type: CustomizationType.McpServer,
			id: 'docs',
			uri: 'file:///plugin/.mcp.json',
			name: 'docs',
			state: { kind: McpServerStatus.Stopped },
		};
		const ownerPlugin: PluginCustomization = {
			type: CustomizationType.Plugin,
			id: 'plugin-b',
			uri: 'vscode-synced-customization:///plugin-b',
			name: 'from-b',
			children: [ownerServer],
		};
		const activePlugin: PluginCustomization = {
			type: CustomizationType.Plugin,
			id: 'plugin-a',
			uri: 'vscode-synced-customization:///plugin-a',
			name: 'from-a',
		};
		const started: string[] = [];
		const toggled: { sessionId: string; rawId: string }[] = [];
		const service = createService({
			sessionResource: ownerResource,
			sessionId: ownerSessionId,
			activeSession,
			extraSessions: [managementActive],
			chatOwnerSessionIds: new Map([[peer.toString(), ownerSessionId]]),
			getCustomizations: sessionId => sessionId === ownerSessionId ? [ownerPlugin] : [activePlugin],
			onStart: sessionId => started.push(sessionId),
			onEnablement: (sessionId, rawId) => toggled.push({ sessionId, rawId }),
		});

		const server = service.getMcpServers(peer)[0];
		if (server) {
			await server.start();
			server.setEnabled(false);
		}

		assert.deepStrictEqual({
			customizationNames: service.getCustomizations(peer).map(item => item.name),
			unlistedNames: service.getCustomizations(unlisted).map(item => item.name),
			activePeerAgent: service.getCustomAgents(activePeer).map(agent => agent.name),
			started,
			toggled,
		}, {
			customizationNames: ['from-b'],
			unlistedNames: ['from-b'],
			activePeerAgent: ['side'],
			started: [ownerSessionId],
			toggled: [{ sessionId: ownerSessionId, rawId: 'docs' }],
		});
	});

	test('maps MCP sources through the provider when the feedback channel is gone', () => {
		const sessionResource = URI.parse('agent-host-copilot:///session-1');
		const source = URI.file('/remote/plugin/.mcp.json');
		const wrapped = URI.from({ scheme: 'vscode-agent-host', authority: 'ssh:box', path: source.path });
		const live = URI.from({ scheme: 'vscode-agent-host', authority: '127.0.0.1:1', path: source.path });
		const server: McpServerCustomization = {
			type: CustomizationType.McpServer,
			id: 'docs',
			uri: source.toString(),
			name: 'docs',
			state: { kind: McpServerStatus.Stopped },
		};
		const plugin: PluginCustomization = {
			type: CustomizationType.Plugin,
			id: 'plugin',
			uri: 'vscode-synced-customization:///plugin',
			name: 'Plugin',
			children: [server],
		};
		const disconnected = createService({
			sessionResource,
			getCustomizations: () => [plugin],
			mapAgentHostResource: uri => uri.scheme === 'file' ? wrapped : uri,
		});
		const connected = createService({
			sessionResource,
			getCustomizations: () => [plugin],
			mapAgentHostResource: () => URI.file('/local-mistake'),
			feedbackFromAgentHost: uri => uri.scheme === 'file' ? live : uri,
		});

		assert.deepStrictEqual({
			disconnected: disconnected.getMcpServers(sessionResource).map(item => item.sourceUri?.toString()),
			connected: connected.getMcpServers(sessionResource).map(item => item.sourceUri?.toString()),
		}, {
			disconnected: [wrapped.toString()],
			connected: [live.toString()],
		});
	});
});
