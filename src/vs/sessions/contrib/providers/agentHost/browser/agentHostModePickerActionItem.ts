/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../base/browser/dom.js';
import { renderLabelWithIcons } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { IAction } from '../../../../../base/common/actions.js';
import { DisposableMap, DisposableStore, IDisposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, IObservable, ISettableObservable } from '../../../../../base/common/observable.js';
import { localize } from '../../../../../nls.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IActionWidgetDropdownAction, IActionWidgetDropdownActionProvider } from '../../../../../platform/actionWidget/browser/actionWidgetDropdown.js';
import { SessionConfigKey } from '../../../../../platform/agentHost/common/sessionConfigKeys.js';
import { SessionConfigPropertySchema } from '../../../../../platform/agentHost/common/state/protocol/commands.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ChatPetAchievementIds, didExplicitlyEnableChatPetAutopilot } from '../../../../../workbench/contrib/chat/browser/chatPetAchievements.js';
import { IChatPetService } from '../../../../../workbench/contrib/chat/browser/chatPetService.js';
import { getCompactCodicon } from '../../../../../workbench/contrib/chat/browser/chatIcons.js';
import { ChatInputPickerActionViewItem, IChatInputPickerOptions } from '../../../../../workbench/contrib/chat/browser/widget/input/chatInputPickerActionItem.js';
import { IChatInputPickerResponsiveState } from '../../../../../workbench/contrib/chat/browser/widget/input/chatInputPickerResponsiveLayout.js';
import { type IAgentHostSessionsProvider, isAgentHostProvider } from '../../../../common/agentHostSessionsProvider.js';
import { ISessionsProvidersService } from '../../../../services/sessions/browser/sessionsProvidersService.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import type { ISessionsProvider } from '../../../../services/sessions/common/sessionsProvider.js';
import { reportNewChatPickerClosed } from '../../../chat/browser/newChatPickerTelemetry.js';
import { getAgentHostModeIcon } from './agentHostModeIcon.js';
import { isWellKnownModeSchema } from './agentHostPermissionPickerDelegate.js';

interface IAgentHostModeContext {
	readonly provider: IAgentHostSessionsProvider;
	readonly sessionId: string;
	readonly currentValue: string;
	readonly items: readonly { value: string; label: string; description?: string }[];
	readonly tooltip: string;
	readonly resolving: boolean;
}

/**
 * Renders the agent-host `mode` enum (interactive / plan / autopilot, or a
 * Codex interactive+plan subset) through the editor picker chrome. Writes
 * {@link SessionConfigKey.Mode}. Does not offer Ask / Edit / Agent.
 */
export class AgentHostModePickerActionItem extends ChatInputPickerActionViewItem implements IChatInputPickerResponsiveState {

	private readonly _providerListeners = this._register(new DisposableMap<string>());
	private readonly _compact: ISettableObservable<boolean>;
	private _container: HTMLElement | undefined;
	private _hoverElement: HTMLElement | undefined;
	private readonly _hover = this._register(new MutableDisposable<IDisposable>());

	constructor(
		action: IAction,
		pickerOptions: IChatInputPickerOptions & { readonly compact: ISettableObservable<boolean> },
		private readonly _session: IObservable<IActiveSession | undefined>,
		@IActionWidgetService actionWidgetService: IActionWidgetService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@ISessionsProvidersService private readonly _sessionsProvidersService: ISessionsProvidersService,
		@IHoverService private readonly _hoverService: IHoverService,
		@IChatPetService private readonly _chatPetService: IChatPetService,
	) {
		const actionProvider: IActionWidgetDropdownActionProvider = {
			getActions: () => this._getActions(action),
		};
		super(action, {
			actionProvider,
			listOptions: { minWidth: 260, ...pickerOptions.listOptions },
		}, pickerOptions, actionWidgetService, keybindingService, contextKeyService, _telemetryService);
		this._compact = pickerOptions.compact;

		this._watchProviders(this._sessionsProvidersService.getProviders());
		this._register(this._sessionsProvidersService.onDidChangeProviders(e => {
			for (const provider of e.removed) {
				this._providerListeners.deleteAndDispose(provider.id);
			}
			this._watchProviders(e.added);
			this._refresh();
		}));
		this._register(autorun(reader => {
			const session = this._session.read(reader);
			if (session) {
				this._getProvider(session.providerId)?.isSessionConfigResolving(session.sessionId).read(reader);
			}
			this._refresh();
		}));
	}

	isCompact(): boolean {
		return this._compact.get();
	}

	setCompact(compact: boolean): void {
		this._compact.set(compact, undefined);
	}

	override render(container: HTMLElement): void {
		this._container = container;
		super.render(container);
		// Label rendering runs before the dropdown exists, so enabled state is applied again here.
		this._refresh();
	}

	protected override renderLabel(element: HTMLElement): IDisposable | null {
		const ctx = this._getContext();
		const item = ctx?.items.find(candidate => candidate.value === ctx.currentValue);
		const label = item?.label ?? ctx?.currentValue ?? '';
		const icon = getAgentHostModeIcon(ctx?.currentValue);
		const compact = this.pickerOptions.compact.get();
		element.classList.toggle('icon-only', compact);
		const labelElements = [];
		if (icon) {
			labelElements.push(...renderLabelWithIcons(`$(${getCompactCodicon(icon).id})`));
		}
		if (!compact && label) {
			const labelSpan = dom.$('span.chat-input-picker-label.sessions-chat-dropdown-label');
			labelSpan.textContent = label;
			labelElements.push(labelSpan);
		}
		dom.reset(element, ...labelElements);
		this.setAriaLabelAttributes(element);
		element.ariaLabel = label
			? localize('agentHostModePicker.triggerAriaLabel', "Pick Agent Mode, {0}", label)
			: localize('agentHostModePicker.ariaLabel', "Agent Mode Picker");

		const resolving = ctx?.resolving ?? false;
		element.classList.toggle('sessions-chat-config-resolving', resolving);
		this.setDropdownEnabled(!resolving && !!ctx);
		if (resolving) {
			element.setAttribute('aria-disabled', 'true');
		} else {
			element.removeAttribute('aria-disabled');
		}

		const tooltip = ctx?.tooltip ?? '';
		if (this._hoverElement !== element) {
			this._hoverElement = element;
			this._hover.value = tooltip || ctx
				? this._hoverService.setupDelayedHover(element, () => ({ content: this._getContext()?.tooltip ?? '' }))
				: undefined;
		}
		return null;
	}

	private _refresh(): void {
		if (this.element) {
			this.renderLabel(this.element);
		}
		this._applyVisibility();
	}

	private _applyVisibility(): void {
		if (!this._container) {
			return;
		}
		this._container.style.display = this._getContext() ? '' : 'none';
	}

	private _getActions(action: IAction): IActionWidgetDropdownAction[] {
		const ctx = this._getContext();
		if (!ctx || ctx.resolving) {
			return [];
		}
		return ctx.items.map(item => ({
			...action,
			id: `agentHost.mode.${item.value}`,
			label: item.label,
			detail: item.description,
			icon: getAgentHostModeIcon(item.value),
			checked: item.value === ctx.currentValue,
			enabled: true,
			tooltip: item.description ?? '',
			hover: item.description ? { content: item.description } : undefined,
			run: async () => {
				const previous = ctx.currentValue;
				reportNewChatPickerClosed(this._telemetryService, {
					id: 'NewChatAgentHostModePicker',
					optionIdBefore: previous,
					optionIdAfter: item.value,
					optionLabelBefore: ctx.items.find(candidate => candidate.value === previous)?.label ?? previous,
					optionLabelAfter: item.label,
					isPII: false,
				});
				try {
					await ctx.provider.setSessionConfigValue(ctx.sessionId, SessionConfigKey.Mode, item.value);
				} catch {
					return;
				}
				if (didExplicitlyEnableChatPetAutopilot(previous, item.value)) {
					this._chatPetService.unlockAchievement(ChatPetAchievementIds.AutopilotEnabled);
				}
				if (this.element) {
					this.renderLabel(this.element);
				}
			},
		} satisfies IActionWidgetDropdownAction));
	}

	private _getContext(): IAgentHostModeContext | undefined {
		const session = this._session.get();
		if (!session) {
			return undefined;
		}
		const provider = this._getProvider(session.providerId);
		if (!provider) {
			return undefined;
		}
		const config = provider.getSessionConfig(session.sessionId);
		const schema = config?.schema.properties[SessionConfigKey.Mode];
		if (!schema || !isWellKnownModeSchema(schema)) {
			return undefined;
		}
		const items = this._enumItems(schema);
		const rawCurrent = config?.values[SessionConfigKey.Mode] ?? schema.default;
		const currentValue = typeof rawCurrent === 'string' && items.some(item => item.value === rawCurrent)
			? rawCurrent
			: items[0]?.value ?? '';
		return {
			provider,
			sessionId: session.sessionId,
			currentValue,
			items,
			tooltip: schema.description ?? schema.title ?? '',
			resolving: provider.isSessionConfigResolving(session.sessionId).get(),
		};
	}

	private _enumItems(schema: SessionConfigPropertySchema): readonly { value: string; label: string; description?: string }[] {
		const enumValues = (schema.enum ?? []).map(value => String(value));
		const enumLabels = schema.enumLabels ?? [];
		const enumDescriptions = schema.enumDescriptions ?? [];
		return enumValues.map((value, index) => ({
			value,
			label: enumLabels[index] ?? value,
			description: enumDescriptions[index],
		}));
	}

	private _getProvider(providerId: string): IAgentHostSessionsProvider | undefined {
		const provider = this._sessionsProvidersService.getProvider(providerId);
		return provider && isAgentHostProvider(provider) ? provider : undefined;
	}

	private _watchProviders(providers: readonly ISessionsProvider[]): void {
		for (const provider of providers) {
			if (!isAgentHostProvider(provider) || this._providerListeners.has(provider.id)) {
				continue;
			}
			const subscriptions = new DisposableStore();
			subscriptions.add(provider.onDidChangeSessionConfig(() => this._refresh()));
			this._providerListeners.set(provider.id, subscriptions);
		}
	}
}
