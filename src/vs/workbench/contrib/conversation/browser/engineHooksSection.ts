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

const HOOKS_FEATURE = localize('ua.engineHooksFeatureLabel', "hook metadata");

export class EngineHooksSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly layoutHost: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-hooks-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.layoutHost = DOM.append(this.container, $('.engine-hooks-layout'));
		this.layoutHost.style.display = 'none';

		const definitionsColumn = DOM.append(this.layoutHost, $('.engine-hooks-column'));
		DOM.append(definitionsColumn, $('h4')).textContent = localize('ua.engineHooksDefinitions', "Definitions");
		const definitionsList = DOM.append(definitionsColumn, $('.engine-hooks-list'));
		definitionsList.textContent = localize('ua.engineHooksDefinitionsEmpty', "No hook definitions.");

		const pointsColumn = DOM.append(this.layoutHost, $('.engine-hooks-column'));
		DOM.append(pointsColumn, $('h4')).textContent = localize('ua.engineHooksPoints', "Hook points");
		const pointsList = DOM.append(pointsColumn, $('.engine-hooks-list'));
		pointsList.textContent = localize('ua.engineHooksPointsUnavailable', "Current engine does not provide hook metadata.");

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
		// Static two-column chrome until APIs exist.
	}

	private render(): void {
		this.layoutHost.style.display = 'none';

		if (!this.connection.isEngineConnected()) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID),
			});
			return;
		}

		const hooksMetadata = this.connection.getCapabilitySnapshot().hooksMetadata;
		const mode = resolveEngineCatalogPaneMode(true, hooksMetadata.support);
		if (mode === 'loading') {
			this.status.render({ mode, loadingKind: 'capability', featureLabel: HOOKS_FEATURE });
			return;
		}
		if (mode === 'unsupported') {
			this.status.render({
				mode,
				featureLabel: HOOKS_FEATURE,
				reason: hooksMetadata.reason ?? localize(
					'ua.engineHooksMetadataUnsupported',
					"Current engine does not provide hook metadata.",
				),
			});
			return;
		}

		this.status.render({
			mode: 'unsupported',
			featureLabel: HOOKS_FEATURE,
			reason: getEngineSectionApiUnavailableCopy(HOOKS_FEATURE),
		});
	}
}
