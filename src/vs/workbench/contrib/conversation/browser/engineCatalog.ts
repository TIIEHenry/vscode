/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/**
 * Engine catalog pane rendering mode (engine-preferences-completion §2).
 * Decision order is top-down; first match wins.
 */
export type EngineCatalogPaneMode =
	| 'disconnected'
	| 'unsupported'
	| 'loading'
	| 'failed'
	| 'empty'
	| 'ready';

/** List RPC phase. `inFlight` and `failed` are mutually exclusive. */
export type EngineCatalogListPhase =
	| { readonly kind: 'none' }
	| { readonly kind: 'inFlight' }
	| { readonly kind: 'failed'; readonly error?: string }
	| { readonly kind: 'success'; readonly itemCount: number };

export function resolveEngineCatalogPaneMode(
	isConnected: boolean,
	capabilitySupport: UniverseAgentCapabilitySupport,
	listPhase: EngineCatalogListPhase = { kind: 'none' },
): EngineCatalogPaneMode {
	if (!isConnected) {
		return 'disconnected';
	}
	if (capabilitySupport === 'UNSUPPORTED') {
		return 'unsupported';
	}
	if (capabilitySupport === 'UNKNOWN' || listPhase.kind === 'inFlight') {
		return 'loading';
	}
	if (listPhase.kind === 'failed') {
		return 'failed';
	}
	if (listPhase.kind === 'success') {
		return listPhase.itemCount === 0 ? 'empty' : 'ready';
	}
	return 'loading';
}

/** Rows only when a successful list returned items. Failed must not paint as 0 rows. */
export function canShowCatalogRows(mode: EngineCatalogPaneMode): boolean {
	return mode === 'ready';
}

/** Write paths (Save/Delete/CRUD / New/Add) when empty or ready (§2). */
export function canPerformCatalogWrite(mode: EngineCatalogPaneMode): boolean {
	return mode === 'empty' || mode === 'ready';
}

/**
 * @deprecated E2-1 abolished hide-on-disconnect. Navigation stays reachable;
 * use {@link canShowCatalogRows} for list visibility.
 */
export function shouldHideCatalogRows(mode: EngineCatalogPaneMode): boolean {
	return mode !== 'ready';
}

export function getCatalogUnsupportedCopy(featureLabel: string, reason?: string): string {
	if (reason) {
		return localize(
			'ua.engineCatalogUnsupportedWithReason',
			"The current engine does not expose {0} ({1}).",
			featureLabel,
			reason,
		);
	}
	return localize(
		'ua.engineCatalogUnsupported',
		"The current engine does not expose {0}.",
		featureLabel,
	);
}

export function getCatalogUnknownCopy(): string {
	return localize('ua.engineCatalogUnknown', "Confirming engine capability…");
}

export function getCatalogListLoadingCopy(): string {
	return localize('ua.engineCatalogListLoading', "Reading…");
}

export function getCatalogTransportFailedCopy(featureLabel: string): string {
	return localize(
		'ua.engineCatalogTransportFailed',
		"Could not load {0} from the engine.",
		featureLabel,
	);
}

export function getCatalogFailedCopy(featureLabel: string, reason?: string): string {
	if (reason) {
		return localize(
			'ua.engineCatalogFailedWithReason',
			"Could not load {0} from the engine ({1}).",
			featureLabel,
			reason,
		);
	}
	return getCatalogTransportFailedCopy(featureLabel);
}

export function getCatalogEmptyCopy(featureLabel: string): string {
	return localize('ua.engineCatalogEmpty', "No {0} yet.", featureLabel);
}

export function getCatalogRetryLabel(): string {
	return localize('ua.engineCatalogRetry', "Retry");
}
