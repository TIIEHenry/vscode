/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type {
	UniverseAgentClearClipboardRequest,
	UniverseAgentClipboardEntry,
	UniverseAgentClipboardEntrySummary,
	UniverseAgentListClipboardRequest,
	UniverseAgentReadClipboardRequest,
	UniverseAgentWriteClipboardRequest,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Engine Preferences Clipboard → List. Empty ids are still sent. */
export function canSendEngineClipboardListRequest(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Engine Preferences Clipboard list action → Read. Empty ids are still sent. */
export function canSendEngineClipboardRead(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Engine Preferences Clipboard list action → Write. Empty ids are still sent. */
export function canSendEngineClipboardWrite(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Engine Preferences Clipboard list action → Clear. Empty ids are still sent. */
export function canSendEngineClipboardClear(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/**
 * Always send empty `sessionId` as-is.
 * This list does not invent a session default.
 */
export function engineClipboardListRequest(): UniverseAgentListClipboardRequest {
	return {
		sessionId: '',
	};
}

/**
 * Always send empty `sessionId` as-is.
 * Pass through empty `clipId` as-is (no default / no trim).
 */
export function engineClipboardReadRequest(
	selected: { readonly clipId?: string } | undefined,
): UniverseAgentReadClipboardRequest {
	return {
		sessionId: '',
		clipId: selected?.clipId ?? '',
	};
}

/**
 * Always send empty `sessionId` / `agentId` / `label` / `content` /
 * `filePath` / `url` as-is. Write is TEXT-only; type is CLIPBOARD_TEXT.
 * This action does not invent a session / agent / content default.
 */
export function engineClipboardWriteRequest(): UniverseAgentWriteClipboardRequest {
	return {
		sessionId: '',
		agentId: '',
		label: '',
		type: 'CLIPBOARD_TEXT',
		content: '',
		filePath: '',
		url: '',
	};
}

/**
 * Always send empty `sessionId` as-is.
 * This action does not invent a session default.
 */
export function engineClipboardClearRequest(): UniverseAgentClearClipboardRequest {
	return {
		sessionId: '',
	};
}

/** Honest clipboard-row label. Empty label / type / clipId stay empty. */
export function formatEngineClipboardListLabel(entry: UniverseAgentClipboardEntrySummary): string {
	return `${entry.label} — ${entry.type} — ${entry.clipId}`;
}

/** Honest Read result. Empty fields and createdAt 0 stay as-is. */
export function formatEngineClipboardReadLabel(entry: UniverseAgentClipboardEntry): string {
	return `${entry.clipId} — ${entry.label} — ${entry.type} — ${entry.content} — ${entry.createdBy} — ${entry.createdAt}`;
}

/** Honest Write result. Empty clipId stays empty. */
export function formatEngineClipboardWriteLabel(clipId: string): string {
	return clipId;
}

/** Honest Clear result. removedCount 0 stays 0. */
export function formatEngineClipboardClearLabel(removedCount: number): string {
	return `${removedCount}`;
}

export const ENGINE_CLIPBOARD_LIST_EMPTY_COPY = localize(
	'ua.engineClipboardEmpty',
	"No clipboard entries.",
);

export const ENGINE_CLIPBOARD_LIST_FEATURE = localize(
	'ua.engineClipboardFeatureLabel',
	"clipboard",
);

export const ENGINE_CLIPBOARD_READ_LABEL = localize(
	'ua.engineClipboardRead',
	"Read",
);

export const ENGINE_CLIPBOARD_WRITE_LABEL = localize(
	'ua.engineClipboardWrite',
	"Write",
);

export const ENGINE_CLIPBOARD_CLEAR_LABEL = localize(
	'ua.engineClipboardClear',
	"Clear",
);
