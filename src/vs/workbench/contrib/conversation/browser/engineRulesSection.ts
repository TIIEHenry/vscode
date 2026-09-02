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

const RULES_FEATURE = localize('ua.engineRulesFeatureLabel', "rules catalog");

export class EngineRulesSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly scopePanels: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-rules-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

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
		this.scopePanels.style.display = 'none';

		if (!this.connection.isEngineConnected()) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID),
			});
			return;
		}

		const capabilities = this.connection.getCapabilitySnapshot();
		const global = capabilities.globalRules;
		const project = capabilities.projectRules;
		const support = global.support === 'UNKNOWN' || project.support === 'UNKNOWN'
			? 'UNKNOWN'
			: global.support === 'UNSUPPORTED' && project.support === 'UNSUPPORTED'
				? 'UNSUPPORTED'
				: 'SUPPORTED';
		const mode = resolveEngineCatalogPaneMode(true, support);

		if (mode === 'loading') {
			this.status.render({ mode, loadingKind: 'capability', featureLabel: RULES_FEATURE });
			return;
		}

		if (mode === 'unsupported') {
			this.status.render({
				mode,
				featureLabel: RULES_FEATURE,
				reason: global.reason ?? project.reason,
			});
			return;
		}

		// Capability may be SUPPORTED but list CRUD API is not wired on IUniverseAgentConnection.
		this.status.render({
			mode: 'unsupported',
			featureLabel: RULES_FEATURE,
			reason: getEngineSectionApiUnavailableCopy(RULES_FEATURE),
		});
	}
}
