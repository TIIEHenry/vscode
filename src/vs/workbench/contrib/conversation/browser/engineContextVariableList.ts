/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type {
	UniverseAgentContextVariableEntry,
	UniverseAgentContextVariableEntrySummary,
	UniverseAgentContextVariableListRequest,
	UniverseAgentContextVariableReadRequest,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Engine Preferences Context Variables → List. Empty ids are still sent. */
export function canSendEngineContextVariableListRequest(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Engine Preferences Context Variables list action → Read. Empty ids are still sent. */
export function canSendEngineContextVariableRead(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/**
 * Always send empty `sessionId` / `agentId` as-is.
 * This list does not invent a session or agent default.
 */
export function engineContextVariableListRequest(): UniverseAgentContextVariableListRequest {
	return {
		sessionId: '',
		agentId: '',
	};
}

/**
 * Always send empty `sessionId` / `agentId` as-is.
 * Pass through empty `name` as-is (no default / no trim).
 */
export function engineContextVariableReadRequest(
	selected: { readonly name?: string } | undefined,
): UniverseAgentContextVariableReadRequest {
	return {
		sessionId: '',
		name: selected?.name ?? '',
		agentId: '',
	};
}

export type EngineContextVariableListSource = 'current' | 'inherited';

export interface EngineContextVariableListRow {
	readonly source: EngineContextVariableListSource;
	readonly entry: UniverseAgentContextVariableEntrySummary;
}

/** Honest list-row label. Empty name / updatedBy / contentPreview stay empty. updatedAt 0 stays as-is. */
export function formatEngineContextVariableListLabel(
	source: EngineContextVariableListSource,
	entry: UniverseAgentContextVariableEntrySummary,
): string {
	return `${source} — ${entry.name} — ${entry.scope} — ${entry.updatedBy} — ${entry.updatedAt} — ${entry.contentPreview}`;
}

/** Honest Read result. Empty fields and updatedAt 0 stay as-is. */
export function formatEngineContextVariableReadLabel(entry: UniverseAgentContextVariableEntry): string {
	return `${entry.name} — ${entry.content} — ${entry.scope} — ${entry.updatedBy} — ${entry.updatedAt}`;
}

export function flattenEngineContextVariableList(
	current: readonly UniverseAgentContextVariableEntrySummary[],
	inherited: readonly UniverseAgentContextVariableEntrySummary[],
): EngineContextVariableListRow[] {
	return [
		...current.map(entry => ({ source: 'current' as const, entry })),
		...inherited.map(entry => ({ source: 'inherited' as const, entry })),
	];
}

export const ENGINE_CONTEXT_VARIABLE_LIST_EMPTY_COPY = localize(
	'ua.engineContextVariableEmpty',
	"No context variables.",
);

export const ENGINE_CONTEXT_VARIABLE_LIST_FEATURE = localize(
	'ua.engineContextVariableFeatureLabel',
	"context variables",
);

export const ENGINE_CONTEXT_VARIABLE_READ_LABEL = localize(
	'ua.engineContextVariableRead',
	"Read",
);
