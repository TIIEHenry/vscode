/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type {
	UniverseAgentListTriggersRequest,
	UniverseAgentTrigger,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Engine Preferences Triggers → ListTriggers. Empty ids are still sent. */
export function canSendEngineTriggerListRequest(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
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
