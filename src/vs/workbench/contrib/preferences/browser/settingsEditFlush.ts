/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';

/**
 * A settings-editor edit that is waiting on the fast or slow update delayer.
 * Both delayers keep only the latest task, so a later edit of a different setting
 * used to cancel the previous one without ever writing it.
 */
export interface PendingSettingsEdit {
	key: string;
	value: unknown;
	languageFilter: string | undefined;
	scope: ConfigurationScope | undefined;
}

export interface SettingsEditFlushPlan {
	/** Previous edit that must be written now; null when the incoming edit is the same setting. */
	flushPrevious: PendingSettingsEdit | null;
	/** Incoming edit is written immediately on manual reset or when switching settings. */
	writeIncomingNow: boolean;
}

export function planSettingsEditFlush(pending: PendingSettingsEdit | null, incomingKey: string, manualReset: boolean): SettingsEditFlushPlan {
	const switchingSetting = !!pending && pending.key !== incomingKey;
	return {
		flushPrevious: switchingSetting ? pending : null,
		writeIncomingNow: manualReset || switchingSetting,
	};
}
