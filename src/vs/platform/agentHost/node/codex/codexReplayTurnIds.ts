/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Separator between codex turn id and user-message item id in a split replay host turn id. */
const CODEX_REPLAY_SPLIT_HOST_TURN_ID_SEP = '\0';

/**
 * Host turn id for the second and later user-text segments replayed from one
 * codex turn. Stable across `thread/read` as long as the codex turn and item
 * ids are unchanged.
 */
export function buildCodexReplaySplitHostTurnId(codexTurnId: string, userMessageItemId: string): string {
	return `${codexTurnId}${CODEX_REPLAY_SPLIT_HOST_TURN_ID_SEP}${userMessageItemId}`;
}

/**
 * If {@link hostTurnId} is a split replay id, returns its source codex turn id;
 * otherwise `undefined` (callers fall back to the host id itself).
 */
export function resolveCodexTurnIdFromReplaySplitHostTurnId(hostTurnId: string): string | undefined {
	const sep = hostTurnId.indexOf(CODEX_REPLAY_SPLIT_HOST_TURN_ID_SEP);
	if (sep <= 0 || sep >= hostTurnId.length - 1) {
		return undefined;
	}
	return hostTurnId.slice(0, sep);
}

/**
 * Resolve a workbench host turn id to the codex turn id used in `thread/read`
 * and `thread/rollback`, using the live map when present and split-replay ids
 * when the map misses.
 */
export function resolveCodexTurnIdFromHostTurnId(
	hostTurnId: string,
	codexTurnIdByHostTurnId: ReadonlyMap<string, string> | undefined,
): string {
	return codexTurnIdByHostTurnId?.get(hostTurnId)
		?? resolveCodexTurnIdFromReplaySplitHostTurnId(hostTurnId)
		?? hostTurnId;
}
