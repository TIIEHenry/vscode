/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentTrigger } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';
import {
	canSendEngineTriggerListRequest,
	ENGINE_TRIGGER_LIST_EMPTY_COPY,
	ENGINE_TRIGGER_LIST_FEATURE,
	engineTriggerListRequest,
	formatEngineTriggerListLabel,
} from './engineTriggerList.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

/**
 * Engine Preferences Triggers — honest ListTriggers list.
 * Connected + hook only. Empty scope / scopeId / typeFilter are sent as-is.
 * Empty triggerId / name / type stay empty. No upsert / delete / fire.
 */
export class EngineTriggersSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly listHost: HTMLElement;

	private sectionActive = false;
	private renderGeneration = 0;
	private triggers: UniverseAgentTrigger[] = [];

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
		this.listHost.style.display = 'none';
		DOM.clearNode(this.listHost);

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
		}
	}
}
