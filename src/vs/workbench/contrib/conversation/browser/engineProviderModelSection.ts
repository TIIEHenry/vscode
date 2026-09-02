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

const PROVIDER_FEATURE = localize('ua.engineProviderFeatureLabel', "provider configuration");
const MODEL_FEATURE = localize('ua.engineModelFeatureLabel', "model profiles");

export class EngineProviderModelSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly form: HTMLElement;
	private readonly providerTypeInput: HTMLInputElement;
	private readonly endpointInput: HTMLInputElement;
	private readonly credentialInput: HTMLInputElement;
	private readonly modelList: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-provider-model-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

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
		this.setFormDisabled(true);
		this.form.style.display = 'none';

		if (!this.connection.isEngineConnected()) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID),
			});
			return;
		}

		const capabilities = this.connection.getCapabilitySnapshot();
		const mode = resolveEngineCatalogPaneMode(true, capabilities.agentProfiles.support);
		if (mode === 'loading') {
			this.status.render({ mode, loadingKind: 'capability', featureLabel: MODEL_FEATURE });
			return;
		}
		if (mode === 'unsupported') {
			this.status.render({
				mode,
				featureLabel: MODEL_FEATURE,
				reason: capabilities.agentProfiles.reason,
			});
			return;
		}

		// Provider/Model APIs are not on IUniverseAgentConnection yet.
		this.status.render({
			mode: 'unsupported',
			featureLabel: `${PROVIDER_FEATURE} / ${MODEL_FEATURE}`,
			reason: getEngineSectionApiUnavailableCopy(`${PROVIDER_FEATURE} / ${MODEL_FEATURE}`),
		});
	}

	private setFormDisabled(disabled: boolean): void {
		for (const input of [this.providerTypeInput, this.endpointInput, this.credentialInput]) {
			input.disabled = disabled;
			input.value = '';
		}
		this.modelList.textContent = localize('ua.engineModelListEmpty', "No model profiles available.");
	}

}
