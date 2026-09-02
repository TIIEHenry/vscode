/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import type { ConnectionPhase } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
	UniverseAgentConnectionSnapshot,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** P0 capability / connectProfile reason；UI 只对照 common 符号，不 import browser stub。 */
const LOCAL_ENGINE_UNSUPPORTED_REASON = 'Web 不支持本机 Engine 连接';

export interface IDesktopConnectionControlContext {
	readonly phase: ConnectionPhase;
	readonly snapshot?: UniverseAgentConnectionSnapshot;
	readonly capabilities?: UniverseAgentCapabilitySnapshot;
}

function capabilityMarksUnsupportedEnvironment(capabilities: UniverseAgentCapabilitySnapshot | undefined): boolean {
	if (!capabilities) {
		return false;
	}
	for (const entry of Object.values(capabilities)) {
		if (entry && typeof entry === 'object' && 'reason' in entry && entry.reason === LOCAL_ENGINE_UNSUPPORTED_REASON) {
			return true;
		}
	}
	return false;
}

/**
 * 省略桌面连接控件当且仅当环境不支持本机 Engine。
 * 桌面 `disconnected` 不是省略条件。
 */
export function isUnsupportedLocalEngineEnvironment(context: IDesktopConnectionControlContext): boolean {
	if (context.phase.kind === 'failed' && context.phase.code === 'unsupported_environment') {
		return true;
	}
	if (capabilityMarksUnsupportedEnvironment(context.capabilities)) {
		return true;
	}
	return capabilityMarksUnsupportedEnvironment(context.snapshot?.capabilities);
}

export function shouldDrawDesktopConnectionControls(context: IDesktopConnectionControlContext): boolean {
	return !isUnsupportedLocalEngineEnvironment(context);
}

/** a11y §7 / E2-1：Web 与 unsupported_environment 的产品文案，不是 capability reason 原文。 */
export function getUnsupportedEnvironmentCopy(): string {
	return localize('ua.unsupportedLocalEngineEnvironment', "此环境不支持本机 Engine 连接");
}

/** a11y RWD-2：叶级 pane `layout(dimension).width`，不是 Part 宽。 */
export const PREFERENCES_PANE_NARROW_WIDTH = 600;
export const PREFERENCES_PANE_COMPACT_WIDTH = 300;

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
