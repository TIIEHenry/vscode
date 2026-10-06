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
/** User-message item id encoded in a split replay host turn id, if any. */
export function resolveUserMessageItemIdFromReplaySplitHostTurnId(hostTurnId: string): string | undefined {
	const sep = hostTurnId.indexOf(CODEX_REPLAY_SPLIT_HOST_TURN_ID_SEP);
	if (sep <= 0 || sep >= hostTurnId.length - 1) {
		return undefined;
	}
	return hostTurnId.slice(sep + 1);
}

/** Minimal codex turn item shape for replay split / truncate checks. */
export interface ICodexReplayTurnItem {
	readonly type: string;
	readonly id?: string;
	readonly content?: readonly { readonly type: string; readonly text?: string }[];
}

/**
 * Whether `userMessageItemId` is the last user message in `items` that carries
 * non-empty text — the same rule {@link replayTurnToTurn} uses before opening
 * a new host segment after a split.
 */
export function isLastUserMessageWithTextInCodexTurn(items: readonly ICodexReplayTurnItem[], userMessageItemId: string): boolean {
	let lastIdWithText: string | undefined;
	for (const item of items) {
		if (item.type !== 'userMessage') {
			continue;
		}
		const hasText = item.content?.some(c => c.type === 'text' && (c.text?.length ?? 0) > 0);
		if (hasText) {
			lastIdWithText = item.id;
		}
	}
	return lastIdWithText !== undefined && lastIdWithText === userMessageItemId;
}

export function resolveCodexTurnIdFromHostTurnId(
	hostTurnId: string,
	codexTurnIdByHostTurnId: ReadonlyMap<string, string> | undefined,
): string {
	const direct = codexTurnIdByHostTurnId?.get(hostTurnId);
	if (direct !== undefined) {
		return direct;
	}
	const derivedCodexTurnId = resolveCodexTurnIdFromReplaySplitHostTurnId(hostTurnId);
	if (derivedCodexTurnId !== undefined) {
		return codexTurnIdByHostTurnId?.get(derivedCodexTurnId) ?? derivedCodexTurnId;
	}
	return hostTurnId;
}
