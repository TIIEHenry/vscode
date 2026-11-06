/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { localize } from '../../../../nls.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import type { ConnectionPhase, ConnectionProbeResult } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import type { IUniverseAgentConnection, UniverseAgentProbeEngineResult } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type { ConnectionStatusTone } from './connectionPreferencesPaneLabels.js';
import { getConnectionPhaseStatusBarText } from './conversationSessionStatus.js';
import { shouldDrawDesktopConnectionControls } from './engineSectionChrome.js';

const $ = DOM.$;

/** Every status line in the pane is written through here so tone and copy never drift apart. */
export function writeStatus(element: HTMLElement, text: string, tone: ConnectionStatusTone = 'neutral'): void {
	const copy = text.trim();
	element.textContent = copy;
	element.classList.toggle('is-success', tone === 'success');
	element.classList.toggle('is-pending', tone === 'pending');
	element.classList.toggle('is-warning', tone === 'warning');
	element.classList.toggle('is-error', tone === 'error');
}

export interface IConnectionFieldInputOptions {
	readonly type?: string;
	readonly placeholder?: string;
	readonly ariaLabel?: string;
	readonly rowClass?: string;
	readonly description?: string;
	readonly layout?: 'setting-row';
}

export function createConnectionFieldInput(
	store: DisposableStore,
	contextViewService: IContextViewService,
	parent: HTMLElement,
	labelText: string,
	options: IConnectionFieldInputOptions,
): { readonly row: HTMLElement; readonly label: HTMLElement; readonly input: InputBox } {
	const row = DOM.append(parent, $(options.rowClass ? `.connection-field-row.${options.rowClass}` : '.connection-field-row'));
	if (options.layout === 'setting-row') {
		row.classList.add('ua-setting-row', 'connection-input-row');
	}
	const copy = options.layout === 'setting-row' ? DOM.append(row, $('.ua-setting-copy')) : row;
	const label = DOM.append(copy, $('label'));
	label.textContent = labelText;
	if (options.description) {
		const description = DOM.append(copy, $('.connection-field-description'));
		description.textContent = options.description;
	}
	const host = DOM.append(row, $('.connection-field-input'));
	const input = store.add(new InputBox(host, contextViewService, {
		type: options.type,
		placeholder: options.placeholder,
		ariaLabel: options.ariaLabel ?? labelText,
		inputBoxStyles: defaultInputBoxStyles,
	}));
	return { row, label, input };
}

/** Hub, Direct and Test are desktop-only; Web and unsupported environments hide them. */
export function shouldDrawDesktopConnectionZones(connectionService: IUniverseAgentConnection): boolean {
	return shouldDrawDesktopConnectionControls({
		phase: connectionService.getConnectionPhase(),
		snapshot: connectionService.getConnectionSnapshot(),
		capabilities: ensureCapabilitySnapshot(connectionService.getCapabilitySnapshot()),
	});
}

/** Rows are 32px; the pane hands each list the same height budget. */
export function layoutConnectionList<T>(list: WorkbenchList<T>, host: HTMLElement, budget: number, detailWidth: () => number): void {
	const height = Math.min(budget, Math.max(32, list.length * 32));
	const width = DOM.getContentWidth(host) || Math.max(0, detailWidth() - 34);
	host.style.height = `${height}px`;
	list.layout(height, width);
}

/** Disabled buttons carry their reason in the title and the accessible name. */
export function presentConnectionAction(button: Button, enabled: boolean, disabledReason: string): void {
	button.enabled = enabled;
	const enabledTitle = typeof button.label === 'string' ? button.label : '';
	button.setTitle(enabled ? enabledTitle : disabledReason);
	button.setAriaLabel(enabled ? enabledTitle : `${enabledTitle}. ${disabledReason}`);
}

/** Test Connection 结果与 StatusBar / Engine 共用 H4b 文案。 */
export function getConnectionTestStatusText(phase?: ConnectionPhase, pairingPending = false): string {
	return getConnectionPhaseStatusBarText(phase ?? { kind: 'disconnected' }, pairingPending);
}

export function formatConnectionProbeStatus(result: ConnectionProbeResult): string;
export function formatConnectionProbeStatus(result: UniverseAgentProbeEngineResult, phaseText: string): string;
export function formatConnectionProbeStatus(
	result: ConnectionProbeResult | UniverseAgentProbeEngineResult,
	phaseText?: string,
): string {
	if (phaseText !== undefined) {
		const engine = result as UniverseAgentProbeEngineResult;
		return engine.ok
			? localize('ua.connectionEngineTestOk', "Reachable — {0}", phaseText)
			: localize('ua.connectionTestFailed', "Unreachable — {0}", engine.reason);
	}
	const profile = result as ConnectionProbeResult;
	if (profile.ok) {
		return localize('ua.connectionTestOk', "Reachable · {0} · {1} ms", profile.path, profile.latencyMs);
	}
	return profile.reason;
}

export function getConnectionEmptyCopy(): string {
	return localize('ua.connectionEmptyWelcome', "No connection profiles yet");
}

export function getConnectionRemoteIoHintCopy(): string {
	return localize(
		'ua.connectionRemoteIoHint',
		"When this window talks to a remote Engine, files and the terminal still run on this computer.",
	);
}
