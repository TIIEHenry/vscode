/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type {
	UniverseAgentFireTriggerRequest,
	UniverseAgentListTriggersRequest,
	UniverseAgentSetTriggerEnabledRequest,
	UniverseAgentTrigger,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Engine Preferences Triggers → ListTriggers. Empty ids are still sent. */
export function canSendEngineTriggerListRequest(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Engine Preferences Triggers list action → FireTrigger. Empty ids are still sent. */
export function canSendEngineTriggerFire(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Engine Preferences Triggers list action → SetTriggerEnabled. Empty ids are still sent. */
export function canSendEngineTriggerSetEnabled(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/**
 * Always send empty `scope` / `scopeId` as-is.
 * Pass through empty `triggerId` as-is (no default / no trim).
 */
export function engineTriggerFireRequest(
	selected: { readonly triggerId?: string } | undefined,
): UniverseAgentFireTriggerRequest {
	return {
		scope: '',
		scopeId: '',
		triggerId: selected?.triggerId ?? '',
	};
}

/**
 * Always send empty `scope` / `scopeId` as-is.
 * Pass through empty `triggerId` as-is (no default / no trim).
 * Pass through `enabled` false as-is (no default true).
 */
export function engineTriggerSetEnabledRequest(
	selected: { readonly triggerId?: string } | undefined,
	enabled: boolean,
): UniverseAgentSetTriggerEnabledRequest {
	return {
		scope: '',
		scopeId: '',
		triggerId: selected?.triggerId ?? '',
		enabled,
	};
}

/**
 * Always send empty `scope` / `scopeId` / `typeFilter` as-is.
 * This list does not invent a session / project / type default.
 */
export function engineTriggerListRequest(): UniverseAgentListTriggersRequest {
	return {
		scope: '',
		scopeId: '',
		typeFilter: '',
	};
}

/** Honest trigger-row label. Empty name / type / triggerId stay empty. */
export function formatEngineTriggerListLabel(trigger: UniverseAgentTrigger): string {
	return `${trigger.name} — ${trigger.type} — ${trigger.triggerId}`;
}

export const ENGINE_TRIGGER_LIST_EMPTY_COPY = localize(
	'ua.engineTriggersEmpty',
	"No triggers.",
);

export const ENGINE_TRIGGER_LIST_FEATURE = localize(
	'ua.engineTriggersFeatureLabel',
	"triggers",
);

export const ENGINE_TRIGGER_FIRE_LABEL = localize(
	'ua.engineTriggersFire',
	"Fire",
);

export const ENGINE_TRIGGER_ENABLE_LABEL = localize(
	'ua.engineTriggersEnable',
	"Enable",
);

export const ENGINE_TRIGGER_DISABLE_LABEL = localize(
	'ua.engineTriggersDisable',
	"Disable",
);
