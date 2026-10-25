/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { hasModifierKeys, StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { Button, type IButtonStyles } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { conversationEntryHookPresent, isAdvertisedEngineRpc, readConversationEntryCapability } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentTrigger, UniverseAgentTriggerDeliveryTarget } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';
import {
	canSendEngineTriggerDelete,
	canSendEngineTriggerFire,
	canSendEngineTriggerListRequest,
	canSendEngineTriggerSetEnabled,
	canSendEngineTriggerUpsert,
	ENGINE_TRIGGER_ADD_LABEL,
	ENGINE_TRIGGER_DELETE_LABEL,
	ENGINE_TRIGGER_DELETE_SUCCESS_COPY,
	ENGINE_TRIGGER_DISABLE_LABEL,
	ENGINE_TRIGGER_EDIT_LABEL,
	ENGINE_TRIGGER_ENABLE_LABEL,
	ENGINE_TRIGGER_FIRE_LABEL,
	ENGINE_TRIGGER_LIST_EMPTY_COPY,
	ENGINE_TRIGGER_LIST_FEATURE,
	engineTriggerDeleteRequest,
	engineTriggerFireRequest,
	engineTriggerListRequest,
	engineTriggerSetEnabledRequest,
	engineTriggerUpsertRequest,
	formatEngineTriggerListLabel,
} from './engineTriggerList.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { writeStatus } from './connectionPreferencesPane.js';

const $ = DOM.$;

/**
 * Button writes these inline. Leaving them unset lets the toolbar class rules
 * paint the ghost icon buttons.
 */
const triggerIconButtonStyles: IButtonStyles = {
	buttonBackground: undefined,
	buttonHoverBackground: undefined,
	buttonSeparator: undefined,
	buttonForeground: undefined,
	buttonBorder: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined,
	buttonSecondaryBorder: undefined,
};

function createTriggerIconButton(parent: HTMLElement, label: string, icon: ThemeIcon): Button {
	const button = new Button(parent, {
		...triggerIconButtonStyles,
		supportIcons: true,
		title: label,
		ariaLabel: label,
	});
	button.icon = icon;
	return button;
}

/**
 * Engine Preferences Triggers — honest ListTriggers list + FireTrigger +
 * SetTriggerEnabled toggle + DeleteTrigger + UpsertTrigger add/edit. Connected +
 * hook only. List, fire, enable, and delete still send empty scope /
 * scopeId / typeFilter / triggerId as-is. Add and Edit open a dialog after
 * the upsert gate passes. Edit with nothing selected returns before the
 * dialog. Name and type are required; an empty form does not send. Enabled
 * comes from the checkbox, and a missing checkbox sends false. Blank
 * prompt, interval, cron, and target keep the selected values on edit and
 * send '', 0, '', and an unspecified target on add. Upsert scope and
 * scopeId stay empty.
 * List throw after a live paint keeps leftover rows + failed (D240);
 * first-pull throw stays empty+failed and must not paint empty-success.
 * Connected + missing list hook after a live paint keeps leftover rows +
 * unsupported (D258); first-pull no-hook stays empty+unsupported.
 * Disconnect still clears rows.
 * Pairing-hold leftover keeps rows + disconnected note (D281) and disables
 * Fire/Enable/Disable/Delete/Upsert (D311). Pairing-hold-first refresh (D350)
 * leftover-looks-live first-pull (`isEngineConnected()===true` + pairingPending,
 * no leftover) stays empty + disconnected and skips list. Leftover WITH leftover
 * still KEEP + 0 extra list. KEEP `applyDisconnectedRefresh` already closes
 * write buttons (D311); do not redo KEEP. List-fail leftover keeps rows +
 * failed and closes Fire/Enable/Delete/Upsert (D437); write gate is not only
 * connected+pairingHold (`leftoverListFailed` / mode failed).
 */
export class EngineTriggersSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly listHost: HTMLElement;
	private readonly addButton: Button;
	private readonly editButton: Button;
	private readonly fireButton: Button;
	private readonly setEnabledButton: Button;
	private readonly deleteButton: Button;
	private readonly fireStatus: HTMLElement;
	private readonly enabledStatus: HTMLElement;
	private readonly deleteStatus: HTMLElement;
	private readonly upsertStatus: HTMLElement;

	private sectionActive = false;
	private renderGeneration = 0;
	private _setEnabledGeneration = 0;
	private _fireGeneration = 0;
	private _deleteGeneration = 0;
	private _upsertGeneration = 0;
	private leftoverListFailed = false;
	private triggers: UniverseAgentTrigger[] = [];
	private triggerCount = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;
	private selectedTrigger: UniverseAgentTrigger | undefined;
	private renderedRows: { readonly element: HTMLElement; readonly model: UniverseAgentTrigger }[] = [];

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-triggers-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.listHost = DOM.append(this.container, $('.engine-triggers-list'));
		this.listHost.setAttribute('role', 'list');
		this.listHost.style.display = 'none';

		const actionsRow = DOM.append(this.container, $('.engine-triggers-actions'));
		this.addButton = this._register(createTriggerIconButton(actionsRow, ENGINE_TRIGGER_ADD_LABEL, Codicon.add));
		this._register(this.addButton.onDidClick(() => void this.handleUpsert('add').catch(onUnexpectedError).catch(onUnexpectedError)));

		this.editButton = this._register(createTriggerIconButton(actionsRow, ENGINE_TRIGGER_EDIT_LABEL, Codicon.edit));
		this._register(this.editButton.onDidClick(() => void this.handleUpsert('edit').catch(onUnexpectedError).catch(onUnexpectedError)));

		this.fireButton = this._register(createTriggerIconButton(actionsRow, ENGINE_TRIGGER_FIRE_LABEL, Codicon.play));
		this._register(this.fireButton.onDidClick(() => void this.handleFire().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.setEnabledButton = this._register(createTriggerIconButton(actionsRow, ENGINE_TRIGGER_ENABLE_LABEL, Codicon.check));
		this._register(this.setEnabledButton.onDidClick(() => void this.handleSetEnabled().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.deleteButton = this._register(createTriggerIconButton(actionsRow, ENGINE_TRIGGER_DELETE_LABEL, Codicon.trash));
		this.deleteButton.element.classList.add('is-danger');
		this._register(this.deleteButton.onDidClick(() => void this.handleDelete().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.fireStatus = DOM.append(this.container, $('.engine-triggers-fire-status'));
		this.fireStatus.style.display = 'none';
		this.enabledStatus = DOM.append(this.container, $('.engine-triggers-enabled-status'));
		this.enabledStatus.style.display = 'none';
		this.deleteStatus = DOM.append(this.container, $('.engine-triggers-delete-status'));
		this.deleteStatus.style.display = 'none';
		this.upsertStatus = DOM.append(this.container, $('.engine-triggers-upsert-status'));
		this.upsertStatus.style.display = 'none';
		this.updateFireAction();
		this.updateSetEnabledAction();
		this.updateDeleteAction();
		this.updateUpsertAction();

		this._register(this.connection.onDidChangeConnection(() => {
			if (this.sectionActive) {
				void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
				return;
			}
			// The nav stays visible while this section is hidden. A real disconnect
			// still drops the leftover count; pairing-hold and a live engine do not list.
			if (isConversationPairingHold(this.connection) || this.connection.isEngineConnected()) {
				return;
			}
			this.applyDisconnectedRefresh(this.triggers.length > 0);
		}));
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	getItemCount(): number | undefined {
		return this.triggerCount > 0 ? this.triggerCount : undefined;
	}

	private setTriggerCount(count: number): void {
		if (this.triggerCount === count) {
			return;
		}
		this.triggerCount = count;
		this._onDidChangeItemCount.fire();
	}

	setSectionActive(active: boolean): void {
		this.sectionActive = active;
		this.container.style.display = active ? '' : 'none';
		if (active) {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}
	}

	setShowSectionHeading(_show: boolean): void {
		// Pane detail title only.
	}

	layout(_width: number, _height: number): void {
		// Static list.
	}

	override dispose(): void {
		++this._setEnabledGeneration;
		super.dispose();
	}

	private async refresh(): Promise<boolean> {
		const generation = ++this.renderGeneration;
		++this._setEnabledGeneration;
		++this._fireGeneration;
		++this._deleteGeneration;
		++this._upsertGeneration;
		const hook = this.connection.listTriggers;
		const pairingHold = isConversationPairingHold(this.connection);
		const listSupport = readConversationEntryCapability(this.connection.getConnectionSnapshot()).listTriggers;
		const advertised = listSupport === 'SUPPORTED';
		const canSend = canSendEngineTriggerListRequest(
			this.connection.isEngineConnected(),
			advertised && typeof hook === 'function',
			pairingHold,
		);

		this.clearWriteStatuses();
		this.updateWriteActions();

		// D350 leftover-looks-live: pairing-hold first. KEEP is not only leftover + pairingHold.
		if (pairingHold || !this.connection.isEngineConnected()) {
			return this.applyDisconnectedRefresh(this.triggers.length > 0);
		}

		if (listSupport === 'UNKNOWN') {
			if (this.triggers.length === 0) {
				this.clearListPresentation();
			}
			this.status.render({
				mode: 'loading',
				loadingKind: 'capability',
				featureLabel: ENGINE_TRIGGER_LIST_FEATURE,
			});
			return false;
		}

		if (!canSend || !hook) {
			if (this.triggers.length === 0) {
				this.clearListPresentation();
			}
			this.status.render({
				mode: 'unsupported',
				featureLabel: ENGINE_TRIGGER_LIST_FEATURE,
				reason: getEngineSectionApiUnavailableCopy(ENGINE_TRIGGER_LIST_FEATURE),
			});
			return false;
		}

		this.status.render({
			mode: 'loading',
			loadingKind: 'list',
			featureLabel: ENGINE_TRIGGER_LIST_FEATURE,
		});

		try {
			const result = await hook.call(this.connection, engineTriggerListRequest());
			if (generation !== this.renderGeneration || this._store.isDisposed) {
				return false;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				return this.applyDisconnectedRefresh(this.triggers.length > 0);
			}
			this.leftoverListFailed = false;
			this.triggers = [...result.triggers];
			this.paintList();
			this.updateWriteActions();
			return true;
		} catch (error) {
			if (generation !== this.renderGeneration || this._store.isDisposed) {
				return false;
			}
			const reason = error instanceof Error ? error.message : String(error);
			this.leftoverListFailed = true;
			this.status.render({
				mode: 'failed',
				featureLabel: ENGINE_TRIGGER_LIST_FEATURE,
				reason,
				onRetry: () => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError),
			});
			// D437: leftover rows stay; write chrome must close after list-fail.
			this.updateWriteActions();
			return false;
		}
	}

	private clearWriteStatuses(): void {
		this.fireStatus.style.display = 'none';
		writeStatus(this.fireStatus, '');
		this.enabledStatus.style.display = 'none';
		writeStatus(this.enabledStatus, '');
		this.deleteStatus.style.display = 'none';
		writeStatus(this.deleteStatus, '');
		this.upsertStatus.style.display = 'none';
		writeStatus(this.upsertStatus, '');
	}

	private keepLeftoverCatalogForPairingHold(hadLiveCatalog: boolean): boolean {
		return hadLiveCatalog && isConversationPairingHold(this.connection);
	}

	private isTriggerWritePairingHold(): boolean {
		return isConversationPairingHold(this.connection);
	}

	/** Catalog leftover contract: list-fail leftover is not a live write surface. */
	private isTriggerWriteListFailed(): boolean {
		return this.leftoverListFailed;
	}

	private updateWriteActions(): void {
		this.updateFireAction();
		this.updateSetEnabledAction();
		this.updateDeleteAction();
		this.updateUpsertAction();
	}

	private applyDisconnectedRefresh(hadLiveCatalog: boolean): boolean {
		++this._setEnabledGeneration;
		++this._fireGeneration;
		++this._deleteGeneration;
		++this._upsertGeneration;
		this.updateWriteActions();
		if (this.keepLeftoverCatalogForPairingHold(hadLiveCatalog)) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError),
			});
			return false;
		}
		this.clearListPresentation();
		this.status.render({
			mode: 'disconnected',
			onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError),
		});
		return false;
	}

	private clearListPresentation(): void {
		this.triggers = [];
		this.setTriggerCount(0);
		++this._setEnabledGeneration;
		this.selectedTrigger = undefined;
		this.listHost.style.display = 'none';
		DOM.clearNode(this.listHost);
		this.renderedRows = [];
	}

	private paintList(): void {
		this.setTriggerCount(this.triggers.length);
		++this._setEnabledGeneration;
		this.selectedTrigger = undefined;
		DOM.clearNode(this.listHost);
		this.renderedRows = [];

		if (this.triggers.length === 0) {
			this.listHost.style.display = 'none';
			this.status.render({
				mode: 'empty',
				featureLabel: ENGINE_TRIGGER_LIST_FEATURE,
				emptyCopy: ENGINE_TRIGGER_LIST_EMPTY_COPY,
			});
			return;
		}

		this.status.hide();
		this.listHost.style.display = '';
		for (const trigger of this.triggers) {
			const row = DOM.append(this.listHost, $('.engine-triggers-row'));
			this.renderedRows.push({ element: row, model: trigger });
			row.setAttribute('role', 'listitem');
			row.tabIndex = 0;
			row.setAttribute('aria-selected', 'false');
			row.textContent = formatEngineTriggerListLabel(trigger);
			row.addEventListener('click', () => this.selectTrigger(trigger));
			row.addEventListener('keydown', event => this.onTriggerRowKeyDown(event, trigger));
		}
	}

	private selectTrigger(trigger: UniverseAgentTrigger): void {
		++this._setEnabledGeneration;
		this.selectedTrigger = trigger;
		this.paintSelection();
		this.updateSetEnabledAction();
	}

	private onTriggerRowKeyDown(event: KeyboardEvent, trigger: UniverseAgentTrigger): void {
		const action = readEngineListRowKey(event);
		if (!action) {
			return;
		}
		// Enter/Space select this row, the same as click. Arrows move .selected.
		// None of these keys call Fire, Enable, Disable, Delete, or Upsert.
		stopEngineListRowKey(event);
		if (action === 'activate') {
			this.selectTrigger(trigger);
			return;
		}
		this.moveTriggerSelection(action === 'next' ? 1 : -1, event.currentTarget);
	}

	private moveTriggerSelection(delta: number, from: EventTarget | null): void {
		const rows = this.renderedRows;
		if (rows.length === 0) {
			return;
		}
		let index = rows.findIndex(row => row.element === from);
		if (index < 0) {
			index = rows.findIndex(row => row.model === this.selectedTrigger);
		}
		const nextIndex = index < 0
			? (delta > 0 ? 0 : rows.length - 1)
			: Math.min(rows.length - 1, Math.max(0, index + delta));
		const next = rows[nextIndex];
		if (next.model !== this.selectedTrigger) {
			this.selectTrigger(next.model);
		}
		next.element.focus();
	}

	private paintSelection(): void {
		for (const rendered of this.renderedRows) {
			const selected = rendered.model === this.selectedTrigger;
			rendered.element.classList.toggle('selected', selected);
			rendered.element.setAttribute('aria-selected', String(selected));
		}
	}

	private triggerSupported(key: 'fireTrigger' | 'setTriggerEnabled' | 'deleteTrigger' | 'upsertTrigger', method: unknown): boolean {
		const entry = this.connection.getCapabilitySnapshot()?.[key];
		return entry?.support === 'SUPPORTED' && typeof method === 'function';
	}

	private updateButtonCapabilityHover(
		button: Button,
		key: 'fireTrigger' | 'setTriggerEnabled' | 'deleteTrigger' | 'upsertTrigger',
		actionLabel: string,
	): void {
		const entry = this.connection.getCapabilitySnapshot()?.[key];
		const title = entry?.support === 'SUPPORTED'
			? actionLabel
			: (entry?.reason?.trim() || getEngineSectionApiUnavailableCopy(actionLabel));
		button.setTitle(title);
		button.element.title = title;
	}

	private updateFireAction(): void {
		const supported = this.triggerSupported('fireTrigger', this.connection.fireTrigger);
		this.fireButton.enabled = !this.isTriggerWriteListFailed() && canSendEngineTriggerFire(
			this.connection.isEngineConnected(),
			supported,
			this.isTriggerWritePairingHold(),
		);
		this.updateButtonCapabilityHover(this.fireButton, 'fireTrigger', ENGINE_TRIGGER_FIRE_LABEL);
	}

	private updateSetEnabledAction(): void {
		const supported = this.triggerSupported('setTriggerEnabled', this.connection.setTriggerEnabled);
		const selected = this.selectedTrigger;
		const nextEnabled = selected ? !selected.enabled : true;
		const actionLabel = nextEnabled ? ENGINE_TRIGGER_ENABLE_LABEL : ENGINE_TRIGGER_DISABLE_LABEL;
		this.setEnabledButton.icon = nextEnabled ? Codicon.check : Codicon.circleSlash;
		this.setEnabledButton.enabled = !!selected && !this.isTriggerWriteListFailed() && canSendEngineTriggerSetEnabled(
			this.connection.isEngineConnected(),
			supported,
			this.isTriggerWritePairingHold(),
		);
		this.setEnabledButton.element.setAttribute('aria-label', actionLabel);
		this.updateButtonCapabilityHover(this.setEnabledButton, 'setTriggerEnabled', actionLabel);
	}

	private updateDeleteAction(): void {
		const supported = this.triggerSupported('deleteTrigger', this.connection.deleteTrigger);
		this.deleteButton.enabled = !this.isTriggerWriteListFailed() && canSendEngineTriggerDelete(
			this.connection.isEngineConnected(),
			supported,
			this.isTriggerWritePairingHold(),
		);
		this.updateButtonCapabilityHover(this.deleteButton, 'deleteTrigger', ENGINE_TRIGGER_DELETE_LABEL);
	}

	private updateUpsertAction(): void {
		const supported = this.triggerSupported('upsertTrigger', this.connection.upsertTrigger);
		const enabled = !this.isTriggerWriteListFailed() && canSendEngineTriggerUpsert(
			this.connection.isEngineConnected(),
			supported,
			this.isTriggerWritePairingHold(),
		);
		this.addButton.enabled = enabled;
		this.editButton.enabled = enabled;
		this.updateButtonCapabilityHover(this.addButton, 'upsertTrigger', ENGINE_TRIGGER_ADD_LABEL);
		this.updateButtonCapabilityHover(this.editButton, 'upsertTrigger', ENGINE_TRIGGER_EDIT_LABEL);
	}

	private async handleSetEnabled(): Promise<void> {
		const hook = this.connection.setTriggerEnabled;
		if (this.isTriggerWriteListFailed() || !canSendEngineTriggerSetEnabled(this.connection.isEngineConnected(), this.triggerSupported('setTriggerEnabled', hook), this.isTriggerWritePairingHold()) || !hook) {
			return;
		}
		const generation = ++this._setEnabledGeneration;
		const trigger = this.selectedTrigger;
		if (!trigger) {
			return;
		}
		const enabled = !trigger.enabled;
		const request = engineTriggerSetEnabledRequest(trigger, enabled);
		try {
			const result = await hook.call(this.connection, request);
			if (generation !== this._setEnabledGeneration || this.selectedTrigger !== trigger || this._store.isDisposed) {
				return;
			}
			this.enabledStatus.style.display = '';
			const enabledCopy = `${formatEngineTriggerListLabel(result.trigger)} — ${result.trigger.enabled}`;
			writeStatus(this.enabledStatus, enabledCopy, result.trigger.enabled === enabled ? 'success' : 'error');
			this.selectedTrigger = result.trigger;
			this.updateSetEnabledAction();
		} catch (error) {
			if (generation !== this._setEnabledGeneration || this.selectedTrigger !== trigger || this._store.isDisposed) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.enabledStatus.style.display = '';
			writeStatus(this.enabledStatus, reason, 'error');
		}
	}

	private async handleFire(): Promise<void> {
		const hook = this.connection.fireTrigger;
		if (this.isTriggerWriteListFailed() || !canSendEngineTriggerFire(this.connection.isEngineConnected(), this.triggerSupported('fireTrigger', hook), this.isTriggerWritePairingHold()) || !hook) {
			return;
		}
		const generation = this.renderGeneration;
		const fireGeneration = ++this._fireGeneration;
		const request = engineTriggerFireRequest(this.selectedTrigger);
		try {
			const result = await hook.call(this.connection, request);
			if (generation !== this.renderGeneration || fireGeneration !== this._fireGeneration || !this.connection.isEngineConnected() || isConversationPairingHold(this.connection) || this._store.isDisposed) {
				return;
			}
			this.fireStatus.style.display = '';
			const tone = result.status === '' ? 'error' : 'neutral';
			writeStatus(this.fireStatus, `${result.status} — ${result.eventId} — ${result.reason}`, tone);
		} catch (error) {
			if (generation !== this.renderGeneration || fireGeneration !== this._fireGeneration || !this.connection.isEngineConnected() || isConversationPairingHold(this.connection) || this._store.isDisposed) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.fireStatus.style.display = '';
			writeStatus(this.fireStatus, reason, 'error');
		}
	}

	private async handleDelete(): Promise<void> {
		const hook = this.connection.deleteTrigger;
		if (this.isTriggerWriteListFailed() || !canSendEngineTriggerDelete(this.connection.isEngineConnected(), this.triggerSupported('deleteTrigger', hook), this.isTriggerWritePairingHold()) || !hook) {
			return;
		}
		const generation = this.renderGeneration;
		const deleteGeneration = ++this._deleteGeneration;
		const request = engineTriggerDeleteRequest(this.selectedTrigger);
		try {
			await hook.call(this.connection, request);
			if (generation !== this.renderGeneration || deleteGeneration !== this._deleteGeneration || !this.connection.isEngineConnected() || isConversationPairingHold(this.connection) || this._store.isDisposed) {
				return;
			}
			this.deleteStatus.style.display = '';
			writeStatus(this.deleteStatus, ENGINE_TRIGGER_DELETE_SUCCESS_COPY, 'success');
			const listed = await this.refresh();
			if (listed) {
				this.deleteStatus.style.display = '';
				writeStatus(this.deleteStatus, ENGINE_TRIGGER_DELETE_SUCCESS_COPY, 'success');
			}
		} catch (error) {
			if (generation !== this.renderGeneration || deleteGeneration !== this._deleteGeneration || !this.connection.isEngineConnected() || isConversationPairingHold(this.connection) || this._store.isDisposed) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.deleteStatus.style.display = '';
			writeStatus(this.deleteStatus, reason, 'error');
		}
	}

	private async promptTrigger(mode: 'add' | 'edit'): Promise<UniverseAgentTrigger | undefined> {
		const selected = mode === 'edit' ? this.selectedTrigger : undefined;
		if (mode === 'edit' && !selected) {
			return undefined;
		}
		const result = await this.dialogService.input({
			type: 'question',
			message: mode === 'add'
				? localize('ua.engineTriggerAddTitle', "Add trigger")
				: localize('ua.engineTriggerEditTitle', "Edit trigger"),
			detail: localize('ua.engineTriggerDialogDetail', "Name and type are required."),
			primaryButton: mode === 'add'
				? ENGINE_TRIGGER_ADD_LABEL
				: localize('ua.engineTriggerSave', "Save"),
			checkbox: {
				label: localize('ua.engineTriggerEnabled', "Enabled"),
				checked: selected ? selected.enabled : false,
			},
			inputs: triggerFormInputs(selected),
			validate: triggerFormValidate,
		});
		if (!result.confirmed) {
			return undefined;
		}
		const values = result.values ?? [];
		const problem = triggerFormProblem(values);
		if (problem) {
			this.upsertStatus.style.display = '';
			writeStatus(this.upsertStatus, problem, 'error');
			return undefined;
		}
		return buildTriggerDraft(mode, selected, values, result.checkboxChecked);
	}

	private async handleUpsert(mode: 'add' | 'edit'): Promise<void> {
		const hook = this.connection.upsertTrigger;
		if (this.isTriggerWriteListFailed() || !canSendEngineTriggerUpsert(this.connection.isEngineConnected(), this.triggerSupported('upsertTrigger', hook), this.isTriggerWritePairingHold()) || !hook) {
			return;
		}
		const generation = this.renderGeneration;
		const upsertGeneration = ++this._upsertGeneration;
		const drafted = await this.promptTrigger(mode);
		if (!drafted) {
			return;
		}
		const liveHook = this.connection.upsertTrigger;
		if (generation !== this.renderGeneration || this.isTriggerWriteListFailed() || !canSendEngineTriggerUpsert(this.connection.isEngineConnected(), this.triggerSupported('upsertTrigger', liveHook), this.isTriggerWritePairingHold()) || !liveHook) {
			return;
		}
		const request = engineTriggerUpsertRequest(drafted);
		try {
			const result = await liveHook.call(this.connection, request);
			if (generation !== this.renderGeneration || upsertGeneration !== this._upsertGeneration || !this.connection.isEngineConnected() || isConversationPairingHold(this.connection) || this._store.isDisposed) {
				return;
			}
			this.upsertStatus.style.display = '';
			writeStatus(this.upsertStatus, formatEngineTriggerListLabel(result.trigger), 'success');
			const listed = await this.refresh();
			if (listed) {
				this.upsertStatus.style.display = '';
				writeStatus(this.upsertStatus, formatEngineTriggerListLabel(result.trigger), 'success');
			}
		} catch (error) {
			if (generation !== this.renderGeneration || upsertGeneration !== this._upsertGeneration || !this.connection.isEngineConnected() || isConversationPairingHold(this.connection) || this._store.isDisposed) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.upsertStatus.style.display = '';
			writeStatus(this.upsertStatus, reason, 'error');
		}
	}
}

type EngineListRowKey = 'activate' | 'next' | 'previous';

function readEngineListRowKey(event: KeyboardEvent): EngineListRowKey | undefined {
	if (event.isComposing || hasModifierKeys(event)) {
		return undefined;
	}
	const standard = new StandardKeyboardEvent(event);
	if (standard.equals(KeyCode.Enter) || standard.equals(KeyCode.Space) || event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
		return 'activate';
	}
	if (standard.equals(KeyCode.DownArrow) || standard.equals(KeyCode.RightArrow) || event.key === 'ArrowDown' || event.key === 'ArrowRight') {
		return 'next';
	}
	if (standard.equals(KeyCode.UpArrow) || standard.equals(KeyCode.LeftArrow) || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
		return 'previous';
	}
	return undefined;
}

function stopEngineListRowKey(event: KeyboardEvent): void {
	const standard = new StandardKeyboardEvent(event);
	standard.preventDefault();
	standard.stopPropagation();
}

const ENGINE_TRIGGER_NAME_REQUIRED = localize('ua.engineTriggerNameRequired', "Name is required.");
const ENGINE_TRIGGER_TYPE_REQUIRED = localize('ua.engineTriggerTypeRequired', "Type is required.");
const ENGINE_TRIGGER_INTERVAL_INVALID = localize('ua.engineTriggerIntervalInvalid', "Interval must be a whole number, or left blank.");
const ENGINE_TRIGGER_TARGET_INVALID = localize('ua.engineTriggerTargetInvalid', "Target must be self, bound:<sessionId>, or new:<profileId>.");
const ENGINE_TRIGGER_TARGET_PLACEHOLDER = localize('ua.engineTriggerTargetPlaceholder', "self, bound:<sessionId>, or new:<profileId>");

function triggerTextField(key: string, label: string, value: string): { type: 'text'; label: string; placeholder: string; value: string } {
	const text = localize(key, label);
	return { type: 'text', label: text, placeholder: text, value };
}

function triggerFormInputs(selected: UniverseAgentTrigger | undefined) {
	return [
		triggerTextField('ua.engineTriggerName', "Name", selected?.name ?? ''),
		triggerTextField('ua.engineTriggerType', "Type", selected?.type ?? ''),
		triggerTextField('ua.engineTriggerPrompt', "Prompt", selected?.promptTemplate ?? ''),
		triggerTextField('ua.engineTriggerInterval', "Interval (ms)", selected ? String(selected.intervalMs) : ''),
		triggerTextField('ua.engineTriggerCron', "Cron", selected?.cronExpression ?? ''),
		{
			type: 'text' as const,
			label: localize('ua.engineTriggerTarget', "Target"),
			placeholder: ENGINE_TRIGGER_TARGET_PLACEHOLDER,
			value: selected ? formatTriggerTarget(selected.target) : '',
		},
	];
}

/** Name, then type. Interval and target stay out of the dialog so a bad value can reach write-status. */
function triggerFormValidate(values: readonly string[]): string | undefined {
	if (isBlankField(values[0])) {
		return ENGINE_TRIGGER_NAME_REQUIRED;
	}
	if (isBlankField(values[1])) {
		return ENGINE_TRIGGER_TYPE_REQUIRED;
	}
	return undefined;
}

/** Same required checks as validate, plus interval and target. Skipped validate still stops here. */
function triggerFormProblem(values: readonly string[]): string | undefined {
	const required = triggerFormValidate(values);
	if (required) {
		return required;
	}
	if (!isBlankField(values[3]) && !isWholeInterval((values[3] ?? '').trim())) {
		return ENGINE_TRIGGER_INTERVAL_INVALID;
	}
	if (!isBlankField(values[5]) && !parseTriggerTarget(values[5] ?? '')) {
		return ENGINE_TRIGGER_TARGET_INVALID;
	}
	return undefined;
}

function isBlankField(value: string | undefined): boolean {
	return !(value ?? '').trim();
}

function isWholeInterval(trimmed: string): boolean {
	if (!/^\d+$/.test(trimmed)) {
		return false;
	}
	return Number.isSafeInteger(Number(trimmed));
}

function parseTriggerTarget(raw: string): UniverseAgentTriggerDeliveryTarget | undefined {
	const trimmed = raw.trim();
	if (trimmed === 'self') {
		return { kind: 'self' };
	}
	if (trimmed.startsWith('bound:')) {
		return { kind: 'boundSession', sessionId: trimmed.slice('bound:'.length) };
	}
	if (trimmed.startsWith('new:')) {
		return { kind: 'newSession', engineProfileId: trimmed.slice('new:'.length) };
	}
	return undefined;
}

function formatTriggerTarget(target: UniverseAgentTriggerDeliveryTarget): string {
	switch (target.kind) {
		case 'self':
			return 'self';
		case 'boundSession':
			return `bound:${target.sessionId}`;
		case 'newSession':
			return `new:${target.engineProfileId}`;
		case 'unspecified':
			return '';
		default: {
			const unknown: never = target;
			return unknown;
		}
	}
}

function keptText(raw: string | undefined, kept: string): string {
	return isBlankField(raw) ? kept : (raw ?? '');
}

function buildTriggerDraft(
	mode: 'add' | 'edit',
	selected: UniverseAgentTrigger | undefined,
	values: readonly string[],
	checkboxChecked: boolean | undefined,
): UniverseAgentTrigger {
	const editing = mode === 'edit' && !!selected;
	const intervalRaw = values[3] ?? '';
	const targetRaw = values[5] ?? '';
	const parsedTarget = isBlankField(targetRaw) ? undefined : parseTriggerTarget(targetRaw);
	const target: UniverseAgentTriggerDeliveryTarget = parsedTarget
		?? (editing && selected ? selected.target : { kind: 'unspecified' });
	return {
		triggerId: editing && selected ? selected.triggerId : '',
		name: values[0] ?? '',
		type: values[1] ?? '',
		promptTemplate: keptText(values[2], editing && selected ? selected.promptTemplate : ''),
		enabled: checkboxChecked ?? false,
		pauseReason: editing && selected ? selected.pauseReason : '',
		target,
		intervalMs: isBlankField(intervalRaw)
			? (editing && selected ? selected.intervalMs : 0)
			: Number(intervalRaw.trim()),
		cronExpression: keptText(values[4], editing && selected ? selected.cronExpression : ''),
		runAtEpochMs: editing && selected ? selected.runAtEpochMs : 0,
	};
}
