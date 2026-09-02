/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { getCatalogUnknownCopy, getCatalogUnsupportedCopy } from './engineCatalog.js';
import { getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';

const $ = DOM.$;

const PLUGINS_FEATURE = localize('ua.enginePluginsFeatureLabel', "engine plugins");

export class EnginePluginsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly listPlaceholder: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-plugins-section'));
		this.container.style.display = 'none';

		this.statusMessage = DOM.append(this.container, $('.engine-section-status'));
		this.statusMessage.style.display = 'none';

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
		this.hideStatus();
		this.listPlaceholder.style.display = 'none';

		if (!this.connection.isEngineConnected()) {
			this.showStatus(getEngineSectionDisconnectedCopy());
			return;
		}

		const plugins = this.connection.getCapabilitySnapshot().plugins;
		if (plugins.support === 'UNKNOWN') {
			this.showStatus(getCatalogUnknownCopy());
			return;
		}

		if (plugins.support === 'UNSUPPORTED') {
			this.showStatus(getCatalogUnsupportedCopy(PLUGINS_FEATURE, plugins.reason));
			return;
		}

		this.showStatus(getEngineSectionApiUnavailableCopy(PLUGINS_FEATURE));
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
