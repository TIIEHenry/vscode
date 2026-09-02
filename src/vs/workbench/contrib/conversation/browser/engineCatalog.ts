/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Engine catalog pane rendering mode (customizations-engine §2). */
export type EngineCatalogPaneMode = 'disconnected' | 'unsupported' | 'unknown' | 'supported';

export function resolveEngineCatalogPaneMode(
	isConnected: boolean,
	capabilitySupport: UniverseAgentCapabilitySupport,
): EngineCatalogPaneMode {
	if (!isConnected) {
		return 'disconnected';
	}
	if (capabilitySupport === 'SUPPORTED') {
		return 'supported';
	}
	if (capabilitySupport === 'UNKNOWN') {
		return 'unknown';
	}
	return 'unsupported';
}

export function shouldHideCatalogRows(mode: EngineCatalogPaneMode): boolean {
	return mode !== 'supported';
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

export function getCatalogTransportFailedCopy(featureLabel: string): string {
	return localize(
		'ua.engineCatalogTransportFailed',
		"Could not load {0} from the engine.",
		featureLabel,
	);
}
