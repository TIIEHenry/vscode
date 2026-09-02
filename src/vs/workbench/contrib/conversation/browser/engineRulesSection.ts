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

const RULES_FEATURE = localize('ua.engineRulesFeatureLabel', "rules catalog");

export class EngineRulesSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly scopePanels: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-rules-section'));
		this.container.style.display = 'none';

		this.statusMessage = DOM.append(this.container, $('.engine-section-status'));
		this.statusMessage.style.display = 'none';

		this.scopePanels = DOM.append(this.container, $('.engine-rules-scopes'));
		this.scopePanels.style.display = 'none';

		const globalPanel = DOM.append(this.scopePanels, $('.engine-rules-scope'));
		DOM.append(globalPanel, $('h4')).textContent = localize('ua.engineRulesGlobal', "Global");
		const globalList = DOM.append(globalPanel, $('.engine-rules-list'));
		globalList.textContent = localize('ua.engineRulesEmpty', "No rules.");

		const projectPanel = DOM.append(this.scopePanels, $('.engine-rules-scope'));
		DOM.append(projectPanel, $('h4')).textContent = localize('ua.engineRulesProject', "Project");
		const projectList = DOM.append(projectPanel, $('.engine-rules-list'));
		projectList.textContent = localize('ua.engineRulesEmpty', "No rules.");

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
		// Static scopes until list API exists.
	}

	private render(): void {
		this.hideStatus();
		this.scopePanels.style.display = 'none';

		if (!this.connection.isEngineConnected()) {
			this.showStatus(getEngineSectionDisconnectedCopy());
			return;
		}

		const capabilities = this.connection.getCapabilitySnapshot();
		const global = capabilities.globalRules;
		const project = capabilities.projectRules;

		if (global.support === 'UNKNOWN' || project.support === 'UNKNOWN') {
			this.showStatus(getCatalogUnknownCopy());
			return;
		}

		if (global.support === 'UNSUPPORTED' && project.support === 'UNSUPPORTED') {
			this.showStatus(getCatalogUnsupportedCopy(RULES_FEATURE, global.reason ?? project.reason));
			return;
		}

		// Capability may be SUPPORTED but list CRUD API is not wired on IUniverseAgentConnection.
		this.showStatus(getEngineSectionApiUnavailableCopy(RULES_FEATURE));
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
