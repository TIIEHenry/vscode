/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigurationTarget } from '../../../../platform/configuration/common/configuration.js';
import type { ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';

/**
 * User / remote / workspace / folder tab and language override that were selected
 * when the edit was made. The write must use this, not the tab selected when a
 * delayer later fires.
 */
export interface SettingsEditContext {
	languageFilter: string | undefined;
	configurationTarget: ConfigurationTarget;
	/** `URI.toString()` of a workspace-folder target; otherwise undefined. */
	resource: string | undefined;
}

/**
 * A settings-editor edit that is waiting on the fast or slow update delayer.
 * Each delayer keeps only the latest task. A later edit of another setting,
 * language override, or settings target used to replace that task without writing it.
 */
export interface PendingSettingsEdit extends SettingsEditContext {
	key: string;
	value: unknown;
	scope: ConfigurationScope | undefined;
}

export interface SettingsEditFlushPlan {
	/** Previous edit that must be written now; null when the incoming edit is the same slot. */
	flushPrevious: PendingSettingsEdit | null;
	/** Incoming edit is written immediately on manual reset or when switching slots. */
	writeIncomingNow: boolean;
}

export interface SettingsEditLeavePlan {
	/** Pending edit to write before delayers are cancelled. */
	write: PendingSettingsEdit | null;
	/** Leave always cancels both delayers so dispose cannot drop or replay the task. */
	cancelDelayers: boolean;
}

export function sameSettingsEditContext(pending: SettingsEditContext, incoming: SettingsEditContext): boolean {
	return pending.languageFilter === incoming.languageFilter
		&& pending.configurationTarget === incoming.configurationTarget
		&& pending.resource === incoming.resource;
}

export function planSettingsEditFlush(pending: PendingSettingsEdit | null, incomingKey: string, manualReset: boolean, incomingContext?: SettingsEditContext): SettingsEditFlushPlan {
	const switchingSetting = !!pending && (
		pending.key !== incomingKey
		|| (!!incomingContext && !sameSettingsEditContext(pending, incomingContext))
	);
	return {
		flushPrevious: switchingSetting ? pending : null,
		writeIncomingNow: manualReset || switchingSetting,
	};
}

/**
 * Search or settings-target changes that move the editor to another language
 * override or target. The pending edit must be written for the context it was
 * made in; a search that keeps that context can stay on the delayer.
 */
export function planSettingsEditContextChange(pending: PendingSettingsEdit | null, next: SettingsEditContext): PendingSettingsEdit | null {
	if (!pending || sameSettingsEditContext(pending, next)) {
		return null;
	}
	return pending;
}

/** Close, hide, or clear the settings editor input. */
export function planSettingsEditLeave(pending: PendingSettingsEdit | null): SettingsEditLeavePlan {
	return {
		write: pending,
		cancelDelayers: true,
	};
}

/**
 * A completed write may clear the pending slot only when it is still that edit.
 * Same key and value under another language or target is a newer edit.
 */
export function shouldClearPendingSettingsEdit(pending: PendingSettingsEdit | null, completed: SettingsEditContext & { key: string; value: unknown }): boolean {
	if (!pending) {
		return false;
	}
	return pending.key === completed.key
		&& pending.value === completed.value
		&& sameSettingsEditContext(pending, completed);
}
