/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { resolveEngineCatalogPaneMode } from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const PLUGINS_FEATURE = localize('ua.enginePluginsFeatureLabel', "engine plugins");

export class EnginePluginsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly listPlaceholder: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-plugins-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.listPlaceholder = DOM.append(this.container, $('.engine-plugins-list'));
		this.listPlaceholder.style.display = 'none';
		this.listPlaceholder.textContent = localize('ua.enginePluginsEmpty', "No engine plugins.");

		this._register(this.connection.onDidChangeConnection(() => this.render()));
		this.render();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		this.container.style.display = active ? '' : 'none';
	}

	setShowSectionHeading(_show: boolean): void {
		// Pane detail title only.
	}

	layout(_width: number, _height: number): void {
		// Static list placeholder.
	}

	private render(): void {
		this.listPlaceholder.style.display = 'none';

		if (!this.connection.isEngineConnected()) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID),
			});
			return;
		}

		const plugins = this.connection.getCapabilitySnapshot().plugins;
		const mode = resolveEngineCatalogPaneMode(true, plugins.support);
		if (mode === 'loading') {
			this.status.render({ mode, loadingKind: 'capability', featureLabel: PLUGINS_FEATURE });
			return;
		}
		if (mode === 'unsupported') {
			this.status.render({ mode, featureLabel: PLUGINS_FEATURE, reason: plugins.reason });
			return;
		}

		this.status.render({
			mode: 'unsupported',
			featureLabel: PLUGINS_FEATURE,
			reason: getEngineSectionApiUnavailableCopy(PLUGINS_FEATURE),
		});
	}
}
