/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from '../../../../base/common/errors.js';
import { URI } from '../../../../base/common/uri.js';
import { fromAgentHostUri, type IAgentHostResourceUriMapper } from '../../../../platform/agentHost/common/agentHostUri.js';
import { combinedDisposable, DisposableMap } from '../../../../base/common/lifecycle.js';
import { basename, isEqual } from '../../../../base/common/resources.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IAgentHostCustomizationService, AbstractAgentHostCustomizationService, type IAgentHostCustomizationTarget } from '../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostCustomizationService.js';
import { IAgentHostSessionsProvider, isAgentHostProvider } from '../../../common/agentHostSessionsProvider.js';
import { ISessionsProvidersService } from '../../sessions/browser/sessionsProvidersService.js';
import { ISessionsManagementService } from '../../sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../sessions/browser/sessionsService.js';
import { ISessionsProvider } from '../../sessions/common/sessionsProvider.js';
import { AgentCustomization, CustomizationType } from '../../../../platform/agentHost/common/state/sessionState.js';
import { type CustomizationEnablement } from '../../../../platform/agentHost/common/state/protocol/state.js';
import { ISession } from '../../sessions/common/session.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IAgentHostActiveClientService } from '../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostActiveClientService.js';

export class AgentHostCustomizationService extends AbstractAgentHostCustomizationService {
	private readonly _providerListeners = this._register(new DisposableMap<ISessionsProvider>());

	constructor(
		@ISessionsManagementService private readonly _sessionsManagementService: ISessionsManagementService,
		@ISessionsService private readonly _sessionsService: ISessionsService,
		@ISessionsProvidersService private readonly _sessionsProvidersService: ISessionsProvidersService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ILogService logService: ILogService,
		@IAgentHostActiveClientService private readonly _activeClientService: IAgentHostActiveClientService,
	) {
		super(instantiationService, logService);
		this._register(this._sessionsManagementService.onDidChangeSessions(e => {
			for (const session of e.removed) {
				this._disposeMcpDiagnostics(session.resource);
			}
			this._fireCustomAgentsChanged();
			this._fireCustomizationsChanged();
		}));
	}

	private _getSession(sessionResource: URI): ISession | undefined {
		const activeSession = this._sessionsService.activeSession.get();
		if (activeSession && isEqual(activeSession.resource, sessionResource)) {
			return activeSession;
		}
		// A real session resource wins over chat-owner inference. Peer and side
		// chats reuse the session path and put the chat id in the fragment, which
		// is what the chat widget hands this service.
		const listed = this._sessionsManagementService.getSession(sessionResource);
		if (listed) {
			return listed;
		}
		if (activeSession && this._sessionOwnsChat(activeSession, sessionResource)) {
			return activeSession;
		}
		const owned = this._sessionsManagementService.getSessionForChatResource(sessionResource)?.session;
		if (owned) {
			return this._preferLiveActive(activeSession, owned);
		}
		if (sessionResource.fragment) {
			const stripped = this._sessionsManagementService.getSession(sessionResource.with({ fragment: '' }));
			if (stripped) {
				return this._preferLiveActive(activeSession, stripped);
			}
		}
		return undefined;
	}

	private _sessionOwnsChat(session: ISession, chatResource: URI): boolean {
		if (chatResource.fragment && isEqual(session.resource, chatResource.with({ fragment: '' }))) {
			return true;
		}
		const chats = session.chats?.get();
		if (chats?.some(chat => isEqual(chat.resource, chatResource))) {
			return true;
		}
		const mainChat = session.mainChat?.get();
		return !!mainChat && isEqual(mainChat.resource, chatResource);
	}

	private _preferLiveActive(activeSession: ISession | undefined, session: ISession): ISession {
		if (activeSession && (activeSession.sessionId === session.sessionId || isEqual(activeSession.resource, session.resource))) {
			return activeSession;
		}
		return session;
	}

	private _getAHSProvider(session: ISession): IAgentHostSessionsProvider | undefined {
		const provider = this._sessionsProvidersService.getProvider(session.providerId);
		if (provider && isAgentHostProvider(provider)) {
			this._ensureProviderListener(provider);
			return provider;
		}
		return undefined;
	}

	protected _resolveTarget(sessionResource: URI): IAgentHostCustomizationTarget | undefined {
		const session = this._getSession(sessionResource);
		if (!session) {
			return undefined;
		}
		const provider = this._getAHSProvider(session);
		if (!provider) {
			return undefined;
		}
		return {
			customizations: provider.getCustomizations(session.sessionId),
			resourceUris: this._resourceUriMapper(provider, session),
			workingDirectory: provider.getWorkingDirectory(session.sessionId),
			workingDirectories: provider.getWorkingDirectories(session.sessionId),
			rootConfig: provider.getRootConfig(),
			isBundledMcpServer: (pluginUri, serverName) => this._activeClientService.isBundledMcpServer(pluginUri, serverName),
			authenticate: request => provider.authenticate(request),
			setCustomizationEnablement: (rawId, enablement: readonly CustomizationEnablement[]) => {
				provider.setCustomizationEnablement(session.sessionId, rawId, enablement);
			},
			startMcpServer: rawId => {
				return provider.getMcpServers(session.sessionId).find(server => this._serverIdMatchesRawId(server.id, rawId))?.start() ?? Promise.resolve();
			},
			stopMcpServer: rawId => {
				return provider.getMcpServers(session.sessionId).find(server => this._serverIdMatchesRawId(server.id, rawId))?.stop() ?? Promise.resolve();
			},
			setRootConfigValue: (property, value) => {
				void provider.setRootConfigValue(property, value).catch(onUnexpectedError).catch(onUnexpectedError);
			},
		};
	}

	private _resourceUriMapper(provider: IAgentHostSessionsProvider, session: ISession): IAgentHostResourceUriMapper {
		// The live connection mapper follows the authority the file system is
		// registered under, including an SSH forward that differs from the stable
		// host key. Drafts and a dropped connection have no channel; the provider
		// mapper still wraps a remote file, where identity would open it locally.
		const live = provider.getFeedbackAnnotationsChannel?.(session.sessionId)?.connection.resourceUris;
		if (live) {
			return live;
		}
		return {
			fromAgentHost: uri => provider.mapAgentHostResource(uri),
			toAgentHost: uri => fromAgentHostUri(uri),
		};
	}

	override getCustomAgents(sessionResource: URI): readonly AgentCustomization[] {
		const session = this._getSession(sessionResource);
		if (session) {
			const provider = this._getAHSProvider(session);
			if (provider) {
				const agents = provider.getCustomAgents(session.sessionId);
				const activeMode = session.mode.get()?.id;
				return agents.length === 0 && activeMode ? [this._agentFromMode(activeMode)] : agents;
			}
		}
		return [];
	}

	private _ensureProviderListener(provider: IAgentHostSessionsProvider): void {
		if (this._providerListeners.has(provider)) {
			return;
		}

		// Keep both subscriptions alive under one map key so replacing the provider entry disposes both together.
		this._providerListeners.set(provider, combinedDisposable(
			provider.onDidChangeCustomAgents(() => {
				this._fireCustomAgentsChanged();
			}),
			provider.onDidChangeCustomizations(() => {
				this._fireCustomizationsChanged();
			})
		));
	}

	private _serverIdMatchesRawId(serverId: string, rawId: string): boolean {
		const separator = serverId.indexOf('/');
		return serverId === rawId || (separator >= 0 && serverId.slice(separator + 1) === rawId);
	}

	private _agentFromMode(uri: string): AgentCustomization {
		return {
			id: uri,
			uri,
			name: agentNameFromUri(uri),
			type: CustomizationType.Agent,
		};
	}
}

function agentNameFromUri(uri: string): string {
	try {
		let name = basename(URI.parse(uri));
		for (const suffix of ['.agent.md', '.md']) {
			if (name.endsWith(suffix)) {
				name = name.substring(0, name.length - suffix.length);
				break;
			}
		}
		return name || uri;
	} catch {
		return uri;
	}
}

registerSingleton(IAgentHostCustomizationService, AgentHostCustomizationService, InstantiationType.Delayed);
