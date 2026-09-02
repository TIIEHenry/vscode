/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

const $ = DOM.$;

export function getEngineSectionDisconnectedCopy(): string {
	return localize('ua.engineSectionDisconnected', "No engine connected. Connect from Connection preferences to load this section.");
}

export function getEngineSectionApiUnavailableCopy(featureLabel: string): string {
	return localize(
		'ua.engineSectionApiUnavailable',
		"The connected engine does not expose a {0} API in this client yet.",
		featureLabel,
	);
}

export function formatCapabilitySupportLabel(support: UniverseAgentCapabilitySupport): string {
	switch (support) {
		case 'SUPPORTED':
			return localize('ua.engineCapabilitySupported', "Supported");
		case 'UNSUPPORTED':
			return localize('ua.engineCapabilityUnsupported', "Unsupported");
		default:
			return localize('ua.engineCapabilityUnknown', "Unknown");
	}
}

export interface IEnginePreferencesSectionHost {
	setSectionActive(active: boolean): void;
	setShowSectionHeading(show: boolean): void;
	layout(width: number, height: number): void;
	getDomNode(): HTMLElement;
}

export abstract class EnginePreferencesSectionBase implements IEnginePreferencesSectionHost {

	protected readonly container: HTMLElement;
	protected readonly heading: HTMLElement;
	protected readonly statusMessage: HTMLElement;

	private sectionActive = false;

	constructor(parent: HTMLElement, containerClass: string, headingText: string) {
		this.container = DOM.append(parent, $(containerClass));
		this.container.style.display = 'none';
		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = headingText;
		this.heading.style.display = 'none';
		this.statusMessage = DOM.append(this.container, $('.engine-section-status'));
		this.statusMessage.style.display = 'none';
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		this.sectionActive = active;
		this.updateContainerVisibility();
	}

	setShowSectionHeading(show: boolean): void {
		this.heading.style.display = show ? '' : 'none';
	}

	protected updateContainerVisibility(): void {
		this.container.style.display = this.sectionActive ? '' : 'none';
	}

	protected showStatus(message: string): void {
		this.statusMessage.style.display = '';
		this.statusMessage.textContent = message;
	}

	protected hideStatus(): void {
		this.statusMessage.style.display = 'none';
		this.statusMessage.textContent = '';
	}

	abstract layout(width: number, height: number): void;
}
