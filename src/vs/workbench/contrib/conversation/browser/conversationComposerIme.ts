/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * How long an unmodified Enter after `compositionend` still belongs to the IME.
 * The keydown that confirms a candidate often arrives with `isComposing === false`.
 */
export const COMPOSER_IME_COMMIT_GUARD_MS = 500;

/** DOM `KeyboardEvent.keyCode` while an IME composition owns the key. */
const IME_DOM_KEY_CODE = 229;

export interface IComposerImeBlockedEnterInput {
	/** Browser `KeyboardEvent.isComposing`, not the remapped `StandardKeyboardEvent`. */
	readonly isComposing: boolean;
	/** Browser `KeyboardEvent.keyCode` (`13` for Enter, `229` during composition). */
	readonly keyCode: number;
	readonly shiftKey: boolean;
	readonly metaKey: boolean;
	readonly ctrlKey: boolean;
	readonly altKey: boolean;
	/** `timeStamp` from the last `compositionend`, or `undefined` when none has fired. */
	readonly compositionEndedAt: number | undefined;
	/** Same clock as `compositionEndedAt` (event `timeStamp`). */
	readonly now: number;
}

/**
 * True when this Enter is the one spurious confirm that follows `compositionend`.
 * In-flight composition is not this case. The caller clears `compositionEndedAt`
 * after the current event so the next unmodified Enter can send.
 */
export function isComposerImeCommitGuardEnter(input: IComposerImeBlockedEnterInput): boolean {
	if (input.isComposing || input.keyCode === IME_DOM_KEY_CODE || input.compositionEndedAt === undefined) {
		return false;
	}
	const elapsed = input.now - input.compositionEndedAt;
	if (elapsed < 0 || elapsed >= COMPOSER_IME_COMMIT_GUARD_MS) {
		return false;
	}
	return !input.shiftKey && !input.metaKey && !input.ctrlKey && !input.altKey;
}

/**
 * True when this Enter must not submit and must be `preventDefault`'d.
 * In-flight composition blocks every modifier. The post-`compositionend` window
 * blocks one unmodified Enter; {@link isComposerImeCommitGuardEnter} is that case.
 */
export function isComposerImeBlockedEnter(input: IComposerImeBlockedEnterInput): boolean {
	return input.isComposing || input.keyCode === IME_DOM_KEY_CODE || isComposerImeCommitGuardEnter(input);
}
