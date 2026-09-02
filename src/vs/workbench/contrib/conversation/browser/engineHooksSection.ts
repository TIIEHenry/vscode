/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { getCatalogUnknownCopy } from './engineCatalog.js';
import { getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';

const $ = DOM.$;

const HOOKS_FEATURE = localize('ua.engineHooksFeatureLabel', "hook metadata");

export class EngineHooksSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly layoutHost: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-hooks-section'));
		this.container.style.display = 'none';

		this.statusMessage = DOM.append(this.container, $('.engine-section-status'));
		this.statusMessage.style.display = 'none';

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
		this.hideStatus();
		this.layoutHost.style.display = 'none';

		if (!this.connection.isEngineConnected()) {
			this.showStatus(getEngineSectionDisconnectedCopy());
			return;
		}

		const hooksMetadata = this.connection.getCapabilitySnapshot().hooksMetadata;
		if (hooksMetadata.support === 'UNKNOWN') {
			this.showStatus(getCatalogUnknownCopy());
			return;
		}

		if (hooksMetadata.support === 'UNSUPPORTED') {
			this.showStatus(localize(
				'ua.engineHooksMetadataUnsupported',
				"Current engine does not provide hook metadata.",
			));
			return;
		}

		this.showStatus(getEngineSectionApiUnavailableCopy(HOOKS_FEATURE));
	}

	private showStatus(message: string): void {
		this.statusMessage.style.display = '';
		this.statusMessage.textContent = message;
	}

	private hideStatus(): void {
		this.statusMessage.style.display = 'none';
		this.statusMessage.textContent = '';
	}
}
