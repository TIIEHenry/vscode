/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { BaseActionViewItem, IActionViewItemOptions } from '../../../../../base/browser/ui/actionbar/actionViewItems.js';
import { IAction } from '../../../../../base/common/actions.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, constObservable, derived, IObservable, observableValue } from '../../../../../base/common/observable.js';
import * as nls from '../../../../../nls.js';
import { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { Action2, IMenuService, MenuId, MenuItemAction, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { agentHostAgentPickerStorageKey, resolveAgentHostAgent } from '../../../../../platform/agentHost/common/customAgents.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../../workbench/common/contributions.js';
import { IsSessionsWindowContext } from '../../../../../workbench/common/contextkeys.js';
import { IChatWidgetService } from '../../../../../workbench/contrib/chat/browser/chat.js';
import { reportNewChatPickerClosed } from '../../../chat/browser/newChatPickerTelemetry.js';
import { IChatInputPickerOptions } from '../../../../../workbench/contrib/chat/browser/widget/input/chatInputPickerActionItem.js';
import { IModePickerDelegate, ModePickerActionItem } from '../../../../../workbench/contrib/chat/browser/widget/input/modePickerActionItem.js';
import { ChatContextKeyExprs, ChatContextKeys } from '../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { ChatMode, IChatMode, IChatModeService, IChatModes } from '../../../../../workbench/contrib/chat/common/chatModes.js';
import { reportChatModeChange } from '../../../../../workbench/contrib/chat/common/chatModeTelemetry.js';
import { IChatService } from '../../../../../workbench/contrib/chat/common/chatService/chatService.js';
import { IChatSessionsService } from '../../../../../workbench/contrib/chat/common/chatSessionsService.js';
import { logChangesToStateModel } from '../../../../../workbench/contrib/chat/common/model/chatModel.js';
import { getChatSessionType } from '../../../../../workbench/contrib/chat/common/model/chatUri.js';
import { ChatModeKind } from '../../../../../workbench/contrib/chat/common/constants.js';
import { Target } from '../../../../../workbench/contrib/chat/common/promptSyntax/promptTypes.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IChatAgentService } from '../../../../../workbench/contrib/chat/common/participants/chatAgents.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IWorkbenchAssignmentService } from '../../../../../workbench/services/assignment/common/assignmentService.js';
import { Menus } from '../../../../browser/menus.js';
import { IAgentHostSessionsProvider, isAgentHostProvider, LOCAL_AGENT_HOST_PROVIDER_ID, REMOTE_AGENT_HOST_PROVIDER_RE } from '../../../../common/agentHostSessionsProvider.js';
import { SessionProviderIdContext, IsPhoneLayoutContext } from '../../../../common/contextkeys.js';
import { ISessionsProvidersService } from '../../../../services/sessions/browser/sessionsProvidersService.js';
import { ISession, ISessionAgentRef, SessionStatus } from '../../../../services/sessions/common/session.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { ModePicker, ModePickerModel } from '../../copilotChatSessions/browser/modePicker.js';
import { CopilotCLISessionType } from './baseAgentHostSessionsProvider.js';
import { ISessionContext } from '../../../../services/sessions/browser/sessionContext.js';

const IsActiveSessionAgentHost = ContextKeyExpr.or(
	ContextKeyExpr.equals(SessionProviderIdContext.key, LOCAL_AGENT_HOST_PROVIDER_ID),
	ContextKeyExpr.regex(SessionProviderIdContext.key, REMOTE_AGENT_HOST_PROVIDER_RE),
);

const EMPTY_AGENT_PICKER_MODES: IChatModes = {
	onDidChange: Event.None,
	builtin: [ChatMode.Agent],
	custom: [],
	findModeById: id => id === ChatMode.Agent.id ? ChatMode.Agent : undefined,
	findModeByName: name => name === ChatMode.Agent.name.get() ? ChatMode.Agent : undefined,
	waitForPendingUpdates: async () => { },
};

/**
 * Session types in the Agents window contribute no custom-agent target.
 * The sessions mode picker then still lists GitHub Copilot agents and
 * target-less agent-host agents, and does not list Ask or Edit.
 */
export function agentHostAgentPickerTarget(contributedTarget: Target | undefined): Target {
	return contributedTarget && contributedTarget !== Target.Undefined ? contributedTarget : Target.GitHubCopilot;
}

/** Writes the selection the sessions mode picker persisted for this chip. */
export function writeAgentHostAgentPickerSelection(storageService: IStorageService, session: IActiveSession, provider: IAgentHostSessionsProvider, mode: IChatMode): void {
	const agent = mode.id === ChatMode.Agent.id ? undefined : { uri: mode.id, name: mode.name.get() };
	persistAgentHostAgentPickerSelection(storageService, session, provider, agent);
}

function persistAgentHostAgentPickerSelection(storageService: IStorageService, session: IActiveSession, provider: IAgentHostSessionsProvider, agent: ISessionAgentRef | undefined): void {
	const key = agentHostAgentPickerStorageKey(session.resource.scheme);
	if (agent) {
		storageService.store(key, agent.uri, StorageScope.PROFILE, StorageTarget.MACHINE);
	} else {
		storageService.remove(key, StorageScope.PROFILE);
	}
	const chatResource = session.activeChat.get().resource;
	provider.setAgent?.(session.sessionId, chatResource, agent ? { uri: agent.uri, name: agent.name } : undefined);
}

// -- Agent Host Agent Picker Action --

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sessions.agentHost.agentPicker',
			title: nls.localize2('agentHostAgentPicker', "Agent"),
			f1: false,
			menu: [{
				id: Menus.NewSessionConfig,
				group: 'navigation',
				order: -1,
				when: ContextKeyExpr.and(IsActiveSessionAgentHost, IsPhoneLayoutContext.negate()),
			}, {
				// Running-session input bar — only inside the dedicated
				// Agents Window. The regular VS Code chat editor uses the
				// built-in mode picker for Agent Host custom agents.
				id: MenuId.ChatInput,
				group: 'navigation',
				order: 1,
				// Hide the agent picker while a delegation (continue in) target is pending.
				when: ContextKeyExpr.and(ChatContextKeyExprs.isAgentHostSession, IsSessionsWindowContext, IsPhoneLayoutContext.negate(), ChatContextKeys.hasPendingDelegationTarget.negate()),
			}],
		});
	}
	override async run(): Promise<void> { /* handled by action view item */ }
});

class AgentHostModePickerActionViewItem extends BaseActionViewItem {
	constructor(private readonly picker: ModePicker, disposable: IDisposable) {
		super(undefined, { id: '', label: '', enabled: true, class: undefined, tooltip: '', run: () => { } });
		this._register(disposable);
	}

	override render(container: HTMLElement): void {
		container.classList.add('chat-input-picker-item', 'chat-agent-picker-item');
		this.picker.render(container);
	}

	override dispose(): void {
		this.picker.dispose();
		super.dispose();
	}
}

/**
 * Editor {@link ModePickerActionItem} delegate for the new-session Agent chip.
 * `sessionResource` stays undefined so a pick calls {@link setMode} instead of
 * `ToggleAgentModeActionId`, which needs a registered `IChatWidget` this
 * composer does not have.
 */
class AgentHostNewSessionModePickerDelegate extends Disposable implements IModePickerDelegate {

	private readonly _modes = observableValue<IChatModes>('agentHostNewSessionAgentPicker.modes', EMPTY_AGENT_PICKER_MODES);
	private readonly _modesVersion = observableValue('agentHostNewSessionAgentPicker.modesVersion', 0);
	private readonly _modesLifetime = this._register(new MutableDisposable<DisposableStore>());
	private _trackedResource: string | undefined;

	readonly currentChatModes: IObservable<IChatModes> = this._modes;

	readonly currentMode = derived(this, reader => {
		this._modesVersion.read(reader);
		const selectedId = this._session.read(reader)?.mode.read(reader)?.id;
		const modes = this._modes.read(reader);
		if (!selectedId) {
			return ChatMode.Agent;
		}
		return modes.findModeById(selectedId) ?? ChatMode.Agent;
	});

	constructor(
		private readonly _session: IObservable<IActiveSession | undefined>,
		private readonly _chatModeService: IChatModeService,
		private readonly _chatSessionsService: IChatSessionsService,
		private readonly _telemetryService: ITelemetryService,
		private readonly _chatService: IChatService,
		private readonly _onSetMode: (mode: IChatMode, session: IActiveSession | undefined) => void,
	) {
		super();
		this._register(autorun(reader => {
			const resource = this._session.read(reader)?.resource;
			const resourceKey = resource?.toString();
			if (resourceKey === this._trackedResource) {
				return;
			}
			this._trackedResource = resourceKey;
			this._modesLifetime.clear();
			if (!resource) {
				this._modes.set(EMPTY_AGENT_PICKER_MODES, undefined);
				return;
			}
			const modes = this._chatModeService.createModes(resource);
			const lifetime = new DisposableStore();
			lifetime.add(modes);
			lifetime.add(modes.onDidChange(() => {
				this._modesVersion.set(this._modesVersion.get() + 1, undefined);
			}));
			this._modesLifetime.value = lifetime;
			this._modes.set(toAgentPickerModes(modes), undefined);
		}));
	}

	sessionResource(): undefined {
		return undefined;
	}

	customAgentTarget(): Target {
		const session = this._session.get();
		const sessionType = session ? getChatSessionType(session.resource) : CopilotCLISessionType.id;
		return agentHostAgentPickerTarget(this._chatSessionsService.getCustomAgentTargetForSessionType(sessionType));
	}

	setMode(mode: IChatMode): void {
		const session = this._session.get();
		const visible = this._visibleModes();
		const activeChat = session?.activeChat.get();
		const previousModeId = activeChat?.mode.get()?.id;
		const previousMode = visible.find(candidate => candidate.id === previousModeId) ?? ChatMode.Agent;
		reportNewChatPickerClosed(this._telemetryService, {
			id: 'NewChatModePicker',
			optionIdBefore: previousMode.id,
			optionIdAfter: mode.id,
			optionLabelBefore: previousMode.label.get(),
			optionLabelAfter: mode.label.get(),
			isPII: true,
		});
		const requestCount = activeChat ? this._chatService.getSession(activeChat.resource)?.getRequests().length ?? 0 : 0;
		reportChatModeChange(this._telemetryService, previousMode, mode, requestCount);
		this._onSetMode(mode, session);
	}

	private _visibleModes(): readonly IChatMode[] {
		const target = this.customAgentTarget();
		const visible: IChatMode[] = [ChatMode.Agent];
		for (const mode of this._modes.get().custom) {
			const modeTarget = mode.target.get();
			if (modeTarget === target || modeTarget === Target.Undefined) {
				visible.push(mode);
			}
		}
		return visible;
	}
}

function toAgentPickerModes(modes: IChatModes): IChatModes {
	return {
		onDidChange: modes.onDidChange,
		get builtin() { return modes.builtin; },
		get custom() {
			return modes.custom.filter(mode => {
				const visibility = mode.visibility?.get();
				return !visibility || visibility.userInvocable;
			});
		},
		findModeById: id => modes.findModeById(id),
		findModeByName: name => modes.findModeByName(name),
		waitForPendingUpdates: () => modes.waitForPendingUpdates(),
	};
}

/**
 * New-session Agent chip. Hosts the editor mode picker and keeps the
 * agent-host selection write. The running-session `MenuId.ChatInput` entry
 * still uses the sessions {@link ModePicker}.
 */
export class AgentHostNewSessionAgentPickerActionItem extends ModePickerActionItem {

	constructor(
		action: MenuItemAction,
		session: IObservable<IActiveSession | undefined>,
		onSetMode: (mode: IChatMode, session: IActiveSession | undefined) => void,
		@IActionWidgetService actionWidgetService: IActionWidgetService,
		@IChatAgentService chatAgentService: IChatAgentService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IMenuService menuService: IMenuService,
		@ICommandService commandService: ICommandService,
		@IProductService productService: IProductService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IOpenerService openerService: IOpenerService,
		@IWorkbenchAssignmentService assignmentService: IWorkbenchAssignmentService,
		@IChatModeService chatModeService: IChatModeService,
		@IChatSessionsService chatSessionsService: IChatSessionsService,
		@IChatService chatService: IChatService,
	) {
		const delegate = new AgentHostNewSessionModePickerDelegate(session, chatModeService, chatSessionsService, telemetryService, chatService, onSetMode);
		const pickerOptions: IChatInputPickerOptions = { compact: constObservable(false) };
		super(action, delegate, pickerOptions, actionWidgetService, chatAgentService, keybindingService, configurationService, contextKeyService, menuService, commandService, productService, telemetryService, openerService, assignmentService);
		this._register(delegate);
	}
}

class AgentHostAgentPickerContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'sessions.contrib.agentHostAgentPicker';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
		@IInstantiationService instantiationService: IInstantiationService,
		@ISessionsService sessionsService: ISessionsService,
		@ISessionsProvidersService sessionsProvidersService: ISessionsProvidersService,
		@IChatService private readonly chatService: IChatService,
		@IChatWidgetService private readonly chatWidgetService: IChatWidgetService,
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		const modePickerModel = this._register(instantiationService.createInstance(ModePickerModel));
		let settingAgentInternally = false;

		const initAgentFromActiveSession = () => {
			const session = sessionsService.activeSession.get();
			this._initAgent(session, session?.mode.get()?.id, session?.status.get() === SessionStatus.Untitled, sessionsProvidersService, () => settingAgentInternally = true, () => settingAgentInternally = false);
		};
		const syncChatInputModeFromActiveSession = () => {
			const session = sessionsService.activeSession.get();
			const selectedAgentUri = session?.mode.get()?.id;
			this._syncChatInputMode(session, selectedAgentUri, sessionsProvidersService);
		};

		this._register(autorun(reader => {
			const session = sessionsService.activeSession.read(reader);
			const provider = this._getProvider(session, sessionsProvidersService);
			const selectedAgentUri = session?.mode.read(reader)?.id;

			modePickerModel.setSession(provider ? session : undefined, selectedAgentUri);

			const isUntitled = session?.status.read(reader) === SessionStatus.Untitled;
			this._syncChatInputMode(session, selectedAgentUri, sessionsProvidersService);
			this._initAgent(session, selectedAgentUri, isUntitled, sessionsProvidersService, () => settingAgentInternally = true, () => settingAgentInternally = false);
		}));
		this._register(this.chatWidgetService.onDidAddWidget(() => {
			syncChatInputModeFromActiveSession();
		}));
		this._register(this.chatWidgetService.onDidChangeFocusedSession(() => {
			syncChatInputModeFromActiveSession();
		}));

		const customAgentsListener = this._register(new MutableDisposable());
		this._register(autorun(reader => {
			const session = sessionsService.activeSession.read(reader);
			const provider = this._getProvider(session, sessionsProvidersService);
			customAgentsListener.value = provider?.onDidChangeCustomAgents(() => {
				if (!settingAgentInternally) {
					initAgentFromActiveSession();
				}
			});
		}));

		const runningSessionFactory = (_action: IAction, _options: IActionViewItemOptions, scopedInstantiationService: IInstantiationService) => {
			const { session } = scopedInstantiationService.invokeFunction(accessor => accessor.get(ISessionContext));
			const picker = scopedInstantiationService.createInstance(ModePicker, modePickerModel, session);
			const disposableStore = new DisposableStore();

			disposableStore.add(picker.onDidSelect(mode => {
				this._selectMode(mode, session.get(), sessionsProvidersService);
			}));
			return scopedInstantiationService.createInstance(AgentHostModePickerActionViewItem, picker, disposableStore);
		};
		const newSessionFactory = (action: IAction, _options: IActionViewItemOptions, scopedInstantiationService: IInstantiationService) => {
			const { session } = scopedInstantiationService.invokeFunction(accessor => accessor.get(ISessionContext));
			return scopedInstantiationService.createInstance(
				AgentHostNewSessionAgentPickerActionItem,
				action as MenuItemAction,
				session,
				(mode: IChatMode, activeSession: IActiveSession | undefined) => this._selectMode(mode, activeSession, sessionsProvidersService),
			);
		};

		this._register(actionViewItemService.register(Menus.NewSessionConfig, 'sessions.agentHost.agentPicker', newSessionFactory));
		this._register(actionViewItemService.register(MenuId.ChatInput, 'sessions.agentHost.agentPicker', runningSessionFactory));
	}

	private _getProvider(session: ISession | undefined, sessionsProvidersService: ISessionsProvidersService): IAgentHostSessionsProvider | undefined {
		if (!session) {
			return undefined;
		}
		const provider = sessionsProvidersService.getProvider(session.providerId);
		return provider && isAgentHostProvider(provider) ? provider : undefined;
	}

	private _syncChatInputMode(session: ISession | undefined, selectedAgentUri: string | undefined, sessionsProvidersService: ISessionsProvidersService): void {
		if (!session || !this._getProvider(session, sessionsProvidersService)) {
			return;
		}

		const chatModel = this.chatService.getSession(session.resource);
		const currentMode = chatModel?.inputModel.state.get()?.mode;
		const nextMode = selectedAgentUri ? { id: selectedAgentUri, kind: ChatModeKind.Agent } : { id: ChatMode.Agent.id, kind: ChatModeKind.Agent };
		if (currentMode?.id === nextMode.id && currentMode.kind === nextMode.kind) {
			this._syncVisibleChatInputMode(session, nextMode.id);
			return;
		}

		chatModel?.inputModel.setState({ mode: nextMode });
		this._syncVisibleChatInputMode(session, nextMode.id);
	}

	private _syncVisibleChatInputMode(session: ISession, modeId: string): void {
		const widget = this.chatWidgetService.getWidgetBySessionResource(session.resource);
		if (!widget) {
			return;
		}

		const currentMode = widget.input.currentModeObs.get();
		if (currentMode.id === modeId) {
			return;
		}

		const apply = async () => {
			await widget.input.currentChatModesObs.get().waitForPendingUpdates();
			if (widget.viewModel?.model.sessionResource.toString() !== session.resource.toString()) {
				return;
			}

			const mode = widget.input.currentChatModesObs.get().findModeById(modeId);
			if (!mode) {
				return;
			}

			const chatModel = this.chatService.getSession(session.resource);
			logChangesToStateModel(chatModel?.inputModel, `[AGPK] _syncVisibleChatInputMode -> widget.input.setChatMode(${modeId}) for ${session.resource.toString()}`, undefined, chatModel?.inputModel.state.get(), this.logService);
			widget.input.setChatMode(modeId, false);
		};

		apply().catch(err => this.logService.error('[AgentHostAgentPickerProbe] sync visible chat input mode failed', err));
	}

	private _initAgent(
		session: IActiveSession | undefined,
		selectedAgentUri: string | undefined,
		isUntitled: boolean,
		sessionsProvidersService: ISessionsProvidersService,
		beginInternalSet: () => void,
		endInternalSet: () => void,
	): void {
		const provider = this._getProvider(session, sessionsProvidersService);
		if (!session || !provider) {
			return;
		}

		const agents = provider.getCustomAgents(session.sessionId);
		const storedUri = isUntitled
			? this.storageService.get(agentHostAgentPickerStorageKey(session.resource.scheme), StorageScope.PROFILE)
			: undefined;
		const resolved = resolveAgentHostAgent(agents, selectedAgentUri, storedUri);

		if (!selectedAgentUri && isUntitled && resolved) {
			beginInternalSet();
			try {
				this._setAgent(session, provider, resolved);
			} finally {
				endInternalSet();
			}
		} else if (selectedAgentUri && !resolved && agents.length > 0 && !isUntitled) {
			beginInternalSet();
			try {
				this._setAgent(session, provider, undefined);
			} finally {
				endInternalSet();
			}
		}
	}

	private _selectMode(mode: IChatMode, session: IActiveSession | undefined, sessionsProvidersService: ISessionsProvidersService): void {
		if (!session) {
			return;
		}
		const provider = sessionsProvidersService.getProvider(session.providerId);
		if (!provider || !isAgentHostProvider(provider)) {
			return;
		}
		writeAgentHostAgentPickerSelection(this.storageService, session, provider, mode);
	}

	private _setAgent(session: IActiveSession, provider: IAgentHostSessionsProvider, agent: ISessionAgentRef | undefined): void {
		persistAgentHostAgentPickerSelection(this.storageService, session, provider, agent);
	}
}

registerWorkbenchContribution2(AgentHostAgentPickerContribution.ID, AgentHostAgentPickerContribution, WorkbenchPhase.AfterRestored);
