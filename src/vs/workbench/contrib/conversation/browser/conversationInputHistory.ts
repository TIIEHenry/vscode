/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConversationStubTurn } from './conversationStubModel.js';

export const CONVERSATION_INPUT_HISTORY_MAX = 100;

export interface InputHistoryBrowseState {
	browseIndex: number;
	savedDraft: string;
}

export function createInputHistoryBrowseState(): InputHistoryBrowseState {
	return { browseIndex: -1, savedDraft: '' };
}

/** Sent user turn texts for a session, newest first (in-memory, capped). */
export function buildSessionUserInputHistory(
	turns: readonly ConversationStubTurn[],
	maxEntries = CONVERSATION_INPUT_HISTORY_MAX,
): readonly string[] {
	const userTexts: string[] = [];
	for (const turn of turns) {
		if (turn.kind === 'user') {
			userTexts.push(turn.text);
		}
	}
	if (userTexts.length > maxEntries) {
		userTexts.splice(0, userTexts.length - maxEntries);
	}
	userTexts.reverse();
	return userTexts;
}

export type InputHistoryDirection = 'older' | 'newer';

/**
 * History recall only when the caret is a collapsed selection on the edge
 * the arrow would leave: older on the first line, newer on the last line.
 * A range, or a caret still inside the text, must move the caret instead.
 */
export function inputHistoryCaretAllowsBrowse(
	value: string,
	selectionStart: number,
	selectionEnd: number,
	direction: InputHistoryDirection,
): boolean {
	if (!Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd)) {
		return false;
	}
	if (selectionStart !== selectionEnd || selectionStart < 0 || selectionStart > value.length) {
		return false;
	}
	if (direction === 'older') {
		return !value.slice(0, selectionStart).includes('\n');
	}
	return !value.slice(selectionStart).includes('\n');
}

/** After a recall, park the caret on the edge so the next arrow in that direction can continue. */
export function inputHistoryCaretAfterRecall(value: string, direction: InputHistoryDirection): number {
	return direction === 'older' ? 0 : value.length;
}

export interface InputHistoryNavigateResult {
	state: InputHistoryBrowseState;
	textareaValue: string | undefined;
	handled: boolean;
}

function resolveInputHistoryBrowseIndex(
	history: readonly string[],
	state: InputHistoryBrowseState,
	composerValue: string,
): number | undefined {
	if (state.browseIndex < 0) {
		return state.browseIndex;
	}
	if (history[state.browseIndex] === composerValue) {
		return state.browseIndex;
	}
	const found = history.indexOf(composerValue);
	if (found === -1) {
		return undefined;
	}
	return found;
}

export function navigateInputHistoryBrowse(
	history: readonly string[],
	state: InputHistoryBrowseState,
	direction: InputHistoryDirection,
	composerValue: string,
): InputHistoryNavigateResult {
	if (history.length === 0) {
		return { state, textareaValue: undefined, handled: false };
	}

	const browseIndex = resolveInputHistoryBrowseIndex(history, state, composerValue);
	if (browseIndex === undefined) {
		return {
			state: { browseIndex: -1, savedDraft: state.savedDraft },
			textareaValue: undefined,
			handled: false,
		};
	}
	const browseState: InputHistoryBrowseState = browseIndex === state.browseIndex
		? state
		: { ...state, browseIndex };

	const composerTrimEmpty = !composerValue.trim();

	if (direction === 'older') {
		if (browseIndex < 0) {
			if (!composerTrimEmpty) {
				return { state: browseState, textareaValue: undefined, handled: false };
			}
			return {
				state: { browseIndex: 0, savedDraft: composerValue },
				textareaValue: history[0],
				handled: true,
			};
		}
		if (browseIndex >= history.length - 1) {
			return { state: browseState, textareaValue: undefined, handled: false };
		}
		const nextIndex = browseIndex + 1;
		return {
			state: { ...browseState, browseIndex: nextIndex },
			textareaValue: history[nextIndex],
			handled: true,
		};
	}

	if (browseIndex < 0) {
		return { state: browseState, textareaValue: undefined, handled: false };
	}
	if (browseIndex > 0) {
		const nextIndex = browseIndex - 1;
		return {
			state: { ...browseState, browseIndex: nextIndex },
			textareaValue: history[nextIndex],
			handled: true,
		};
	}
	return {
		state: { browseIndex: -1, savedDraft: '' },
		textareaValue: browseState.savedDraft,
		handled: true,
	};
}

export function exitInputHistoryBrowse(state: InputHistoryBrowseState): InputHistoryNavigateResult {
	if (state.browseIndex < 0) {
		return { state, textareaValue: undefined, handled: false };
	}
	return {
		state: { browseIndex: -1, savedDraft: '' },
		textareaValue: state.savedDraft,
		handled: true,
	};
}
