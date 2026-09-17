/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentTrigger } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
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
 * Engine Preferences Triggers — honest ListTriggers list + FireTrigger +
 * SetTriggerEnabled + DeleteTrigger + UpsertTrigger add/edit. Connected +
 * hook only. Empty scope / scopeId / typeFilter / triggerId are sent as-is.
 * Add always sends an empty TriggerDto. Edit sends the selected trigger
 * as-is (empty DTO when none). `enabled` false is sent as-is. Empty
 * triggerId / name / type stay empty.
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
	private readonly enableButton: Button;
	private readonly disableButton: Button;
	private readonly deleteButton: Button;
	private readonly fireStatus: HTMLElement;
	private readonly enabledStatus: HTMLElement;
	private readonly deleteStatus: HTMLElement;
	private readonly upsertStatus: HTMLElement;

	private sectionActive = false;
	private renderGeneration = 0;
	private leftoverListFailed = false;
	private triggers: UniverseAgentTrigger[] = [];
	private selectedTrigger: UniverseAgentTrigger | undefined;
	private renderedRows: { readonly element: HTMLElement; readonly model: UniverseAgentTrigger }[] = [];

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-triggers-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.listHost = DOM.append(this.container, $('.engine-triggers-list'));
		this.listHost.setAttribute('role', 'list');
		this.listHost.style.display = 'none';

		const actionsRow = DOM.append(this.container, $('.engine-triggers-actions'));
		this.addButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.addButton.label = ENGINE_TRIGGER_ADD_LABEL;
		this._register(this.addButton.onDidClick(() => void this.handleUpsert('add').catch(onUnexpectedError).catch(onUnexpectedError)));

		this.editButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.editButton.label = ENGINE_TRIGGER_EDIT_LABEL;
		this._register(this.editButton.onDidClick(() => void this.handleUpsert('edit').catch(onUnexpectedError).catch(onUnexpectedError)));

		this.fireButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.fireButton.label = ENGINE_TRIGGER_FIRE_LABEL;
		this._register(this.fireButton.onDidClick(() => void this.handleFire().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.enableButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.enableButton.label = ENGINE_TRIGGER_ENABLE_LABEL;
		this._register(this.enableButton.onDidClick(() => void this.handleSetEnabled(true).catch(onUnexpectedError).catch(onUnexpectedError)));

		this.disableButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.disableButton.label = ENGINE_TRIGGER_DISABLE_LABEL;
		this._register(this.disableButton.onDidClick(() => void this.handleSetEnabled(false).catch(onUnexpectedError).catch(onUnexpectedError)));

		this.deleteButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.deleteButton.label = ENGINE_TRIGGER_DELETE_LABEL;
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
			}
		}));
	}

	getDomNode(): HTMLElement {
		return this.container;
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

	private async refresh(): Promise<boolean> {
		const generation = ++this.renderGeneration;
		const hook = this.connection.listTriggers;
		const pairingHold = isConversationPairingHold(this.connection);
		const canSend = canSendEngineTriggerListRequest(
			this.connection.isEngineConnected(),
			typeof hook === 'function',
			pairingHold,
		);

		this.clearWriteStatuses();
		this.updateWriteActions();

		// D350 leftover-looks-live: pairing-hold first. KEEP is not only leftover + pairingHold.
		if (pairingHold || !this.connection.isEngineConnected()) {
			return this.applyDisconnectedRefresh(this.triggers.length > 0);
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
			if (generation !== this.renderGeneration) {
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
			if (generation !== this.renderGeneration) {
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
		this.selectedTrigger = undefined;
		this.listHost.style.display = 'none';
		DOM.clearNode(this.listHost);
		this.renderedRows = [];
	}

	private paintList(): void {
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
			row.textContent = formatEngineTriggerListLabel(trigger);
			row.addEventListener('click', () => {
				this.selectedTrigger = trigger;
				this.paintSelection();
			});
		}
	}

	private paintSelection(): void {
		for (const rendered of this.renderedRows) {
			rendered.element.classList.toggle('selected', rendered.model === this.selectedTrigger);
		}
	}

	private updateFireAction(): void {
		this.fireButton.enabled = !this.isTriggerWriteListFailed() && canSendEngineTriggerFire(
			this.connection.isEngineConnected(),
			typeof this.connection.fireTrigger === 'function',
			this.isTriggerWritePairingHold(),
		);
	}

	private updateSetEnabledAction(): void {
		const enabled = !this.isTriggerWriteListFailed() && canSendEngineTriggerSetEnabled(
			this.connection.isEngineConnected(),
			typeof this.connection.setTriggerEnabled === 'function',
			this.isTriggerWritePairingHold(),
		);
		this.enableButton.enabled = enabled;
		this.disableButton.enabled = enabled;
	}

	private updateDeleteAction(): void {
		this.deleteButton.enabled = !this.isTriggerWriteListFailed() && canSendEngineTriggerDelete(
			this.connection.isEngineConnected(),
			typeof this.connection.deleteTrigger === 'function',
			this.isTriggerWritePairingHold(),
		);
	}

	private updateUpsertAction(): void {
		const enabled = !this.isTriggerWriteListFailed() && canSendEngineTriggerUpsert(
			this.connection.isEngineConnected(),
			typeof this.connection.upsertTrigger === 'function',
			this.isTriggerWritePairingHold(),
		);
		this.addButton.enabled = enabled;
		this.editButton.enabled = enabled;
	}

	private async handleSetEnabled(enabled: boolean): Promise<void> {
		const hook = this.connection.setTriggerEnabled;
		if (this.isTriggerWriteListFailed() || !canSendEngineTriggerSetEnabled(this.connection.isEngineConnected(), typeof hook === 'function', this.isTriggerWritePairingHold()) || !hook) {
			return;
		}
		const request = engineTriggerSetEnabledRequest(this.selectedTrigger, enabled);
		try {
			const result = await hook.call(this.connection, request);
			this.enabledStatus.style.display = '';
			writeStatus(this.enabledStatus, `${formatEngineTriggerListLabel(result.trigger)} — ${result.trigger.enabled}`, 'success');
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.enabledStatus.style.display = '';
			writeStatus(this.enabledStatus, reason, 'error');
		}
	}

	private async handleFire(): Promise<void> {
		const hook = this.connection.fireTrigger;
		if (this.isTriggerWriteListFailed() || !canSendEngineTriggerFire(this.connection.isEngineConnected(), typeof hook === 'function', this.isTriggerWritePairingHold()) || !hook) {
			return;
		}
		const request = engineTriggerFireRequest(this.selectedTrigger);
		try {
			const result = await hook.call(this.connection, request);
			this.fireStatus.style.display = '';
			writeStatus(this.fireStatus, `${result.status} — ${result.eventId} — ${result.reason}`, 'success');
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.fireStatus.style.display = '';
			writeStatus(this.fireStatus, reason, 'error');
		}
	}

	private async handleDelete(): Promise<void> {
		const hook = this.connection.deleteTrigger;
		if (this.isTriggerWriteListFailed() || !canSendEngineTriggerDelete(this.connection.isEngineConnected(), typeof hook === 'function', this.isTriggerWritePairingHold()) || !hook) {
			return;
		}
		const request = engineTriggerDeleteRequest(this.selectedTrigger);
		try {
			await hook.call(this.connection, request);
			this.deleteStatus.style.display = '';
			writeStatus(this.deleteStatus, ENGINE_TRIGGER_DELETE_SUCCESS_COPY, 'success');
			const listed = await this.refresh();
			if (listed) {
				this.deleteStatus.style.display = '';
				writeStatus(this.deleteStatus, ENGINE_TRIGGER_DELETE_SUCCESS_COPY, 'success');
			}
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.deleteStatus.style.display = '';
			writeStatus(this.deleteStatus, reason, 'error');
		}
	}

	private async handleUpsert(mode: 'add' | 'edit'): Promise<void> {
		const hook = this.connection.upsertTrigger;
		if (this.isTriggerWriteListFailed() || !canSendEngineTriggerUpsert(this.connection.isEngineConnected(), typeof hook === 'function', this.isTriggerWritePairingHold()) || !hook) {
			return;
		}
		const request = engineTriggerUpsertRequest(this.selectedTrigger, mode);
		try {
			const result = await hook.call(this.connection, request);
			this.upsertStatus.style.display = '';
			writeStatus(this.upsertStatus, formatEngineTriggerListLabel(result.trigger), 'success');
			const listed = await this.refresh();
			if (listed) {
				this.upsertStatus.style.display = '';
				writeStatus(this.upsertStatus, formatEngineTriggerListLabel(result.trigger), 'success');
			}
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.upsertStatus.style.display = '';
			writeStatus(this.upsertStatus, reason, 'error');
		}
	}
}
