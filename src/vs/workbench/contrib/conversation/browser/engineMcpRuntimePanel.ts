/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { getCatalogUnknownCopy, getCatalogUnsupportedCopy } from './engineCatalog.js';
import { getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';

const $ = DOM.$;

const MCP_RUNTIME_FEATURE = localize('ua.engineMcpRuntimeFeatureLabel', "MCP server runtime");

export class EngineMcpRuntimePanel extends Disposable {

	private readonly container: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly listPlaceholder: HTMLElement;
	private readonly refreshButton: Button;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-mcp-runtime-panel'));
		this.statusMessage = DOM.append(this.container, $('.engine-section-status'));
		this.statusMessage.style.display = 'none';

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
		this.hideStatus();
		this.listPlaceholder.style.display = 'none';
		this.refreshButton.enabled = false;

		if (!this.connection.isEngineConnected()) {
			this.showStatus(getEngineSectionDisconnectedCopy());
			return;
		}

		const mcp = this.connection.getCapabilitySnapshot().mcp;
		if (mcp.support === 'UNKNOWN') {
			this.showStatus(getCatalogUnknownCopy());
			return;
		}

		if (mcp.support === 'UNSUPPORTED') {
			this.showStatus(getCatalogUnsupportedCopy(MCP_RUNTIME_FEATURE, mcp.reason));
			return;
		}

		// GetMcpServerStatuses / GetMcpServerTools are not on IUniverseAgentConnection.
		this.showStatus(getEngineSectionApiUnavailableCopy(MCP_RUNTIME_FEATURE));
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
