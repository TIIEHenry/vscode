/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
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

const $ = DOM.$;

/**
 * Engine Preferences Triggers — honest ListTriggers list + FireTrigger +
 * SetTriggerEnabled + DeleteTrigger + UpsertTrigger add/edit. Connected +
 * hook only. Empty scope / scopeId / typeFilter / triggerId are sent as-is.
 * Add always sends an empty TriggerDto. Edit sends the selected trigger
 * as-is (empty DTO when none). `enabled` false is sent as-is. Empty
 * triggerId / name / type stay empty.
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
	private triggers: UniverseAgentTrigger[] = [];
	private selectedTrigger: UniverseAgentTrigger | undefined;

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
		this._register(this.addButton.onDidClick(() => void this.handleUpsert('add')));

		this.editButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.editButton.label = ENGINE_TRIGGER_EDIT_LABEL;
		this._register(this.editButton.onDidClick(() => void this.handleUpsert('edit')));

		this.fireButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.fireButton.label = ENGINE_TRIGGER_FIRE_LABEL;
		this._register(this.fireButton.onDidClick(() => void this.handleFire()));

		this.enableButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.enableButton.label = ENGINE_TRIGGER_ENABLE_LABEL;
		this._register(this.enableButton.onDidClick(() => void this.handleSetEnabled(true)));

		this.disableButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.disableButton.label = ENGINE_TRIGGER_DISABLE_LABEL;
		this._register(this.disableButton.onDidClick(() => void this.handleSetEnabled(false)));

		this.deleteButton = this._register(new Button(actionsRow, { ...defaultButtonStyles, secondary: true }));
		this.deleteButton.label = ENGINE_TRIGGER_DELETE_LABEL;
		this._register(this.deleteButton.onDidClick(() => void this.handleDelete()));

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
				void this.refresh();
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
			void this.refresh();
		}
	}

	setShowSectionHeading(_show: boolean): void {
		// Pane detail title only.
	}

	layout(_width: number, _height: number): void {
		// Static list.
	}

	private async refresh(): Promise<void> {
		const generation = ++this.renderGeneration;
		const hook = this.connection.listTriggers;
		const canSend = canSendEngineTriggerListRequest(
			this.connection.isEngineConnected(),
			typeof hook === 'function',
		);

		this.triggers = [];
		this.selectedTrigger = undefined;
		this.listHost.style.display = 'none';
		this.fireStatus.style.display = 'none';
		this.fireStatus.textContent = '';
		this.enabledStatus.style.display = 'none';
		this.enabledStatus.textContent = '';
		this.deleteStatus.style.display = 'none';
		this.deleteStatus.textContent = '';
		this.upsertStatus.style.display = 'none';
		this.upsertStatus.textContent = '';
		DOM.clearNode(this.listHost);
		this.updateFireAction();
		this.updateSetEnabledAction();
		this.updateDeleteAction();
		this.updateUpsertAction();

		if (!this.connection.isEngineConnected()) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID),
			});
			return;
		}

		if (!canSend || !hook) {
			this.status.render({
				mode: 'unsupported',
				featureLabel: ENGINE_TRIGGER_LIST_FEATURE,
				reason: getEngineSectionApiUnavailableCopy(ENGINE_TRIGGER_LIST_FEATURE),
			});
			return;
		}

		this.status.render({
			mode: 'loading',
			loadingKind: 'list',
			featureLabel: ENGINE_TRIGGER_LIST_FEATURE,
		});

		try {
			const result = await hook.call(this.connection, engineTriggerListRequest());
			if (generation !== this.renderGeneration) {
				return;
			}
			if (!this.connection.isEngineConnected()) {
				return;
			}
			this.triggers = [...result.triggers];
			this.paintList();
		} catch (error) {
			if (generation !== this.renderGeneration) {
				return;
			}
			const reason = error instanceof Error ? error.message : String(error);
			this.status.render({
				mode: 'failed',
				featureLabel: ENGINE_TRIGGER_LIST_FEATURE,
				reason,
				onRetry: () => void this.refresh(),
			});
		}
	}

	private paintList(): void {
		if (this.triggers.length === 0) {
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
			row.setAttribute('role', 'listitem');
			row.textContent = formatEngineTriggerListLabel(trigger);
			row.addEventListener('click', () => {
				this.selectedTrigger = trigger;
				this.paintSelection();
			});
		}
	}

	private paintSelection(): void {
		const rows = this.listHost.querySelectorAll('.engine-triggers-row');
		rows.forEach((row, index) => {
			row.classList.toggle('selected', this.triggers[index] === this.selectedTrigger);
		});
	}

	private updateFireAction(): void {
		this.fireButton.enabled = canSendEngineTriggerFire(
			this.connection.isEngineConnected(),
			typeof this.connection.fireTrigger === 'function',
		);
	}

	private updateSetEnabledAction(): void {
		const enabled = canSendEngineTriggerSetEnabled(
			this.connection.isEngineConnected(),
			typeof this.connection.setTriggerEnabled === 'function',
		);
		this.enableButton.enabled = enabled;
		this.disableButton.enabled = enabled;
	}

	private updateDeleteAction(): void {
		this.deleteButton.enabled = canSendEngineTriggerDelete(
			this.connection.isEngineConnected(),
			typeof this.connection.deleteTrigger === 'function',
		);
	}

	private updateUpsertAction(): void {
		const enabled = canSendEngineTriggerUpsert(
			this.connection.isEngineConnected(),
			typeof this.connection.upsertTrigger === 'function',
		);
		this.addButton.enabled = enabled;
		this.editButton.enabled = enabled;
	}

	private async handleSetEnabled(enabled: boolean): Promise<void> {
		const hook = this.connection.setTriggerEnabled;
		if (!canSendEngineTriggerSetEnabled(this.connection.isEngineConnected(), typeof hook === 'function') || !hook) {
			return;
		}
		const request = engineTriggerSetEnabledRequest(this.selectedTrigger, enabled);
		try {
			const result = await hook.call(this.connection, request);
			this.enabledStatus.textContent = `${formatEngineTriggerListLabel(result.trigger)} — ${result.trigger.enabled}`;
			this.enabledStatus.style.display = '';
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.enabledStatus.textContent = reason;
			this.enabledStatus.style.display = '';
		}
	}

	private async handleFire(): Promise<void> {
		const hook = this.connection.fireTrigger;
		if (!canSendEngineTriggerFire(this.connection.isEngineConnected(), typeof hook === 'function') || !hook) {
			return;
		}
		const request = engineTriggerFireRequest(this.selectedTrigger);
		try {
			const result = await hook.call(this.connection, request);
			this.fireStatus.textContent = `${result.status} — ${result.eventId} — ${result.reason}`;
			this.fireStatus.style.display = '';
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.fireStatus.textContent = reason;
			this.fireStatus.style.display = '';
		}
	}

	private async handleDelete(): Promise<void> {
		const hook = this.connection.deleteTrigger;
		if (!canSendEngineTriggerDelete(this.connection.isEngineConnected(), typeof hook === 'function') || !hook) {
			return;
		}
		const request = engineTriggerDeleteRequest(this.selectedTrigger);
		try {
			await hook.call(this.connection, request);
			this.deleteStatus.textContent = '';
			this.deleteStatus.style.display = '';
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.deleteStatus.textContent = reason;
			this.deleteStatus.style.display = '';
		}
	}

	private async handleUpsert(mode: 'add' | 'edit'): Promise<void> {
		const hook = this.connection.upsertTrigger;
		if (!canSendEngineTriggerUpsert(this.connection.isEngineConnected(), typeof hook === 'function') || !hook) {
			return;
		}
		const request = engineTriggerUpsertRequest(this.selectedTrigger, mode);
		try {
			const result = await hook.call(this.connection, request);
			this.upsertStatus.textContent = formatEngineTriggerListLabel(result.trigger);
			this.upsertStatus.style.display = '';
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.upsertStatus.textContent = reason;
			this.upsertStatus.style.display = '';
		}
	}
}
