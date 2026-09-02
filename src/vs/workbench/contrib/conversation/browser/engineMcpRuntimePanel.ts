/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { resolveEngineCatalogPaneMode } from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { getEngineSectionApiUnavailableCopy } from './engineSectionChrome.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const MCP_RUNTIME_FEATURE = localize('ua.engineMcpRuntimeFeatureLabel', "MCP server runtime");

export class EngineMcpRuntimePanel extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly listPlaceholder: HTMLElement;
	private readonly refreshButton: Button;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-mcp-runtime-panel'));
		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		const toolbar = DOM.append(this.container, $('.engine-mcp-runtime-toolbar'));
		this.refreshButton = this._register(new Button(toolbar, defaultButtonStyles));
		this.refreshButton.label = localize('ua.engineMcpRuntimeRefresh', "Refresh runtime");
		this.refreshButton.enabled = false;
		this._register(this.refreshButton.onDidClick(() => this.render()));

		this.listPlaceholder = DOM.append(this.container, $('.engine-mcp-runtime-list'));
		this.listPlaceholder.style.display = 'none';
		this.listPlaceholder.textContent = localize('ua.engineMcpRuntimeEmpty', "No MCP servers in runtime.");

		this._register(this.connection.onDidChangeConnection(() => this.render()));
		this.render();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setVisible(visible: boolean): void {
		this.container.style.display = visible ? '' : 'none';
	}

	layout(_width: number, _height: number): void {
		// Static until runtime API exists.
	}

	render(): void {
		this.listPlaceholder.style.display = 'none';
		this.refreshButton.enabled = false;

		if (!this.connection.isEngineConnected()) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID),
			});
			return;
		}

		const mcp = this.connection.getCapabilitySnapshot().mcp;
		const mode = resolveEngineCatalogPaneMode(true, mcp.support);
		if (mode === 'loading') {
			this.status.render({ mode, loadingKind: 'capability', featureLabel: MCP_RUNTIME_FEATURE });
			return;
		}
		if (mode === 'unsupported') {
			this.status.render({ mode, featureLabel: MCP_RUNTIME_FEATURE, reason: mcp.reason });
			return;
		}

		// GetMcpServerStatuses / GetMcpServerTools are not on IUniverseAgentConnection.
		this.status.render({
			mode: 'unsupported',
			featureLabel: MCP_RUNTIME_FEATURE,
			reason: getEngineSectionApiUnavailableCopy(MCP_RUNTIME_FEATURE),
		});
	}
}
