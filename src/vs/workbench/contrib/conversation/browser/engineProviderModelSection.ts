/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import {
	getCatalogUnknownCopy,
	getCatalogUnsupportedCopy,
} from './engineCatalog.js';
import {
	getEngineSectionApiUnavailableCopy,
	getEngineSectionDisconnectedCopy,
} from './engineSectionChrome.js';

const $ = DOM.$;

const PROVIDER_FEATURE = localize('ua.engineProviderFeatureLabel', "provider configuration");
const MODEL_FEATURE = localize('ua.engineModelFeatureLabel', "model profiles");

export class EngineProviderModelSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly form: HTMLElement;
	private readonly providerTypeInput: HTMLInputElement;
	private readonly endpointInput: HTMLInputElement;
	private readonly credentialInput: HTMLInputElement;
	private readonly modelList: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-provider-model-section'));
		this.container.style.display = 'none';

		this.statusMessage = DOM.append(this.container, $('.engine-section-status'));
		this.statusMessage.style.display = 'none';

		this.form = DOM.append(this.container, $('.engine-provider-model-form'));

		const providerGroup = DOM.append(this.form, $('.engine-provider-model-group'));
		DOM.append(providerGroup, $('h4')).textContent = localize('ua.engineProviderHeading', "Provider");
		this.providerTypeInput = this.appendDisabledField(providerGroup, localize('ua.engineProviderType', "Type"));
		this.endpointInput = this.appendDisabledField(providerGroup, localize('ua.engineProviderEndpoint', "Endpoint"));
		this.credentialInput = this.appendDisabledField(providerGroup, localize('ua.engineProviderCredential', "Credential"));
		this.credentialInput.type = 'password';
		this.credentialInput.placeholder = localize('ua.engineProviderCredentialPlaceholder', "Configured credentials are not shown");

		const modelGroup = DOM.append(this.form, $('.engine-provider-model-group'));
		DOM.append(modelGroup, $('h4')).textContent = localize('ua.engineModelHeading', "Model profiles");
		this.modelList = DOM.append(modelGroup, $('.engine-provider-model-list'));
		this.modelList.textContent = localize('ua.engineModelListEmpty', "No model profiles available.");

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
		// Static form.
	}

	private appendDisabledField(group: HTMLElement, label: string): HTMLInputElement {
		const row = DOM.append(group, $('.engine-provider-model-field'));
		DOM.append(row, $('label')).textContent = label;
		const input = DOM.append(row, $('input.engine-provider-model-input')) as HTMLInputElement;
		input.disabled = true;
		return input;
	}

	private render(): void {
		this.hideStatus();
		this.setFormDisabled(true);

		if (!this.connection.isEngineConnected()) {
			this.showStatus(getEngineSectionDisconnectedCopy());
			return;
		}

		const capabilities = this.connection.getCapabilitySnapshot();
		if (capabilities.agentProfiles.support === 'UNKNOWN') {
			this.showStatus(getCatalogUnknownCopy());
			return;
		}

		// Provider/Model APIs are not on IUniverseAgentConnection yet.
		this.showStatus(getEngineSectionApiUnavailableCopy(`${PROVIDER_FEATURE} / ${MODEL_FEATURE}`));
		if (capabilities.agentProfiles.support === 'UNSUPPORTED') {
			this.showStatus(getCatalogUnsupportedCopy(MODEL_FEATURE, capabilities.agentProfiles.reason));
		}
	}

	private setFormDisabled(disabled: boolean): void {
		for (const input of [this.providerTypeInput, this.endpointInput, this.credentialInput]) {
			input.disabled = disabled;
			input.value = '';
		}
		this.modelList.textContent = localize('ua.engineModelListEmpty', "No model profiles available.");
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
