/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../../base/browser/dom.js';
import { renderLabelWithIcons } from '../../../../../base/browser/ui/iconLabel/iconLabels.js';
import { IAction } from '../../../../../base/common/actions.js';
import { Delayer } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { IDisposable, MutableDisposable } from '../../../../../base/common/lifecycle.js';
import { autorun, IObservable } from '../../../../../base/common/observable.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { localize } from '../../../../../nls.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IActionWidgetDropdownAction, IActionWidgetDropdownActionProvider } from '../../../../../platform/actionWidget/browser/actionWidgetDropdown.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { IHoverService } from '../../../../../platform/hover/browser/hover.js';
import { IKeybindingService } from '../../../../../platform/keybinding/common/keybinding.js';
import { ITelemetryService } from '../../../../../platform/telemetry/common/telemetry.js';
import { ChatInputPickerActionViewItem, IChatInputPickerOptions } from '../../../../../workbench/contrib/chat/browser/widget/input/chatInputPickerActionItem.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';

const FILTER_THRESHOLD = 10;
const FILTER_DELAY_MS = 200;

export interface IAgentHostBranchMenuItem {
	readonly value: string;
	readonly label: string;
	readonly checked: boolean;
	readonly icon: ThemeIcon;
	readonly detail?: string;
	readonly ariaDescription?: string;
}

export interface IAgentHostBranchTriggerState {
	readonly label: string;
	readonly icon: ThemeIcon;
	readonly ariaLabel: string;
	readonly tooltip: string;
	readonly enabled: boolean;
	readonly resolving: boolean;
}

/**
 * Data for the branch chip. The host keeps the New Worktree checkbox beside
 * this picker and owns the session-config writes.
 */
export interface IAgentHostBranchPickerModel {
	readonly session: IObservable<IActiveSession | undefined>;
	/** `true` when branch options are remote completions and the filter must re-query. */
	readonly enumDynamic: boolean;
	load(query?: string): Promise<readonly IAgentHostBranchMenuItem[] | undefined>;
	select(item: IAgentHostBranchMenuItem): void;
	getTrigger(): IAgentHostBranchTriggerState;
}

/**
 * Branch list hosted in the editor picker chrome. The isolation checkbox stays
 * outside this item so the footer can keep it beside the chip.
 */
export class AgentHostBranchPickerActionItem extends ChatInputPickerActionViewItem {

	private _items: readonly IAgentHostBranchMenuItem[] = [];
	private readonly _filterDelayer = this._register(new Delayer<readonly IAgentHostBranchMenuItem[] | undefined>(FILTER_DELAY_MS));
	private _slot: HTMLElement | undefined;
	private _hoverElement: HTMLElement | undefined;
	private readonly _hover = this._register(new MutableDisposable<IDisposable>());

	constructor(
		action: IAction,
		private readonly _model: IAgentHostBranchPickerModel,
		pickerOptions: IChatInputPickerOptions,
		@IActionWidgetService actionWidgetService: IActionWidgetService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService private readonly _hoverService: IHoverService,
	) {
		const actionProvider: IActionWidgetDropdownActionProvider = {
			getActions: () => this._toActions(this._items),
		};
		super(action, {
			actionProvider,
			prepareActions: async () => {
				const items = await this._model.load();
				if (!items || items.length === 0) {
					this._items = [];
					return false;
				}
				this._items = items;
				return true;
			},
			filterActions: _model.enumDynamic
				? (query, token) => this._filter(query, token)
				: undefined,
			listOptionsProvider: {
				getListOptions: () => this._items.length > FILTER_THRESHOLD
					? { showFilter: true, filterPlaceholder: localize('agentHostSessionConfig.filter', "Filter options..."), minWidth: 255 }
					: { minWidth: 255 },
			},
		}, pickerOptions, actionWidgetService, keybindingService, contextKeyService, telemetryService);

		this._register(autorun(reader => {
			const session = this._model.session.read(reader);
			session?.workspace.read(reader);
			if (this.element) {
				this.renderLabel(this.element);
			}
		}));
	}

	override render(container: HTMLElement): void {
		this._slot = container;
		super.render(container);
		this._applyInteractionState();
	}

	protected override renderLabel(element: HTMLElement): IDisposable | null {
		const trigger = this._model.getTrigger();
		const compact = this.pickerOptions.compact.get();
		element.classList.toggle('icon-only', compact);
		const labelElements = [...renderLabelWithIcons(`$(${trigger.icon.id})`)];
		if (!compact) {
			const labelSpan = dom.$('span.chat-input-picker-label.sessions-chat-dropdown-label');
			labelSpan.textContent = trigger.label;
			labelElements.push(labelSpan);
		}
		dom.reset(element, ...labelElements);
		this.setAriaLabelAttributes(element);
		element.setAttribute('aria-label', trigger.ariaLabel);
		this._applyInteractionState();

		if (this._hoverElement !== element) {
			this._hoverElement = element;
			this._hover.value = this._hoverService.setupDelayedHover(element, () => ({ content: this._model.getTrigger().tooltip }));
		}
		return null;
	}

	private async _filter(query: string, token: CancellationToken): Promise<readonly IActionWidgetDropdownAction[]> {
		const items = await this._filterDelayer.trigger(async () => {
			if (token.isCancellationRequested) {
				return undefined;
			}
			return this._model.load(query);
		});
		if (token.isCancellationRequested || !items) {
			return this._toActions(this._items);
		}
		this._items = items;
		return this._toActions(items);
	}

	private _toActions(items: readonly IAgentHostBranchMenuItem[]): IActionWidgetDropdownAction[] {
		const checked = items.filter(item => item.checked);
		const rest = items.filter(item => !item.checked);
		const split = checked.length > 0 && rest.length > 0;
		const currentCategory = { label: 'current', order: 0 };
		const restCategory = { label: 'rest', order: 1 };
		return [
			...checked.map(item => this._toAction(item, split ? currentCategory : undefined)),
			...rest.map(item => this._toAction(item, split ? restCategory : undefined)),
		];
	}

	private _toAction(item: IAgentHostBranchMenuItem, category: { label: string; order: number } | undefined): IActionWidgetDropdownAction {
		return {
			...this.action,
			id: `agentHost.branch.${item.value}`,
			label: item.label,
			detail: item.detail,
			ariaDescription: item.ariaDescription,
			icon: item.icon,
			checked: item.checked,
			enabled: true,
			tooltip: '',
			category,
			run: async () => {
				this._model.select(item);
				if (this.element) {
					this.renderLabel(this.element);
				}
			},
		};
	}

	private _applyInteractionState(): void {
		const trigger = this._model.getTrigger();
		this._slot?.classList.toggle('resolving', trigger.resolving);
		this._slot?.classList.toggle('disabled', !trigger.enabled && !trigger.resolving);
		const interactive = trigger.enabled && !trigger.resolving;
		this.setDropdownEnabled(interactive);
		if (!this.element) {
			return;
		}
		if (interactive) {
			this.element.removeAttribute('aria-disabled');
		} else {
			this.element.setAttribute('aria-disabled', 'true');
		}
	}
}
