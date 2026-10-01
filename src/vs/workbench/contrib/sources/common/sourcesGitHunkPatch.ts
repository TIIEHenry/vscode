/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Accept hunk bytes are sliced from a unified diff.
 * Monaco only supplies a cursor line; this file does not read editor text.
 */

/** Desktop stage-hunk argv. One cached apply, whitespace warnings ignored. */
export const SOURCES_GIT_APPLY_CACHED_ARGV = ['git', 'apply', '--cached', '--whitespace=nowarn'] as const;

/** ReadGitFileDiff index_state for Accept. Not the row's own spelling. */
export const SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE = 'Unstaged';

export type SourcesGitAcceptCursorSide = 'new' | 'old';

export interface ISourcesGitAcceptCursor {
	readonly side: SourcesGitAcceptCursorSide;
	readonly line: number;
}

/**
 * Diff editors move both carets together. Only the editor that still has
 * text focus may replace the hunk line. A synced caret on the other side
 * leaves the last focused side in place.
 */
export function rememberSourcesGitAcceptCursor(
	current: ISourcesGitAcceptCursor | undefined,
	event: { readonly side: SourcesGitAcceptCursorSide; readonly line: number; readonly editorHasFocus: boolean },
): ISourcesGitAcceptCursor | undefined {
	if (!event.editorHasFocus) {
		return current;
	}
	const line = sourcesGitAcceptCursorLine(event.line);
	if (line === undefined) {
		return current;
	}
	return { side: event.side, line };
}

/**
 * Accept clicks move focus onto the button, so the live editors are usually
 * blurred. Prefer a side that still has focus, then the last focused side,
 * then the modified caret when the diff was never focused.
 */
export function sourcesGitAcceptCursorFromEditors(input: {
	readonly focused: SourcesGitAcceptCursorSide | undefined;
	readonly remembered: ISourcesGitAcceptCursor | undefined;
	readonly modifiedLine: number | undefined;
	readonly originalLine: number | undefined;
}): ISourcesGitAcceptCursor | undefined {
	if (input.focused === 'new') {
		const live = sourcesGitAcceptCursorLine(input.modifiedLine);
		if (live !== undefined) {
			return { side: 'new', line: live };
		}
	} else if (input.focused === 'old') {
		const live = sourcesGitAcceptCursorLine(input.originalLine);
		if (live !== undefined) {
			return { side: 'old', line: live };
		}
	}
	const rememberedLine = input.remembered ? sourcesGitAcceptCursorLine(input.remembered.line) : undefined;
	if (input.remembered && rememberedLine !== undefined) {
		return { side: input.remembered.side, line: rememberedLine };
	}
	const modified = sourcesGitAcceptCursorLine(input.modifiedLine);
	if (modified !== undefined) {
		return { side: 'new', line: modified };
	}
	const original = sourcesGitAcceptCursorLine(input.originalLine);
	if (original !== undefined) {
		return { side: 'old', line: original };
	}
	return undefined;
}

function sourcesGitAcceptCursorLine(line: number | undefined): number | undefined {
	if (line === undefined || !Number.isInteger(line) || line < 1) {
		return undefined;
	}
	return line;
}

const CONFLICT_KINDS = new Set(['CONFLICT', 'UNMERGED', 'BOTHMODIFIED', 'BOTHADDED', 'BOTHDELETED']);
const UNTRACKED_KINDS = new Set(['UNTRACKED']);
const UNSTAGED_INDEX_STATES = new Set(['UNSTAGED', 'WORKTREE', 'WORKINGTREE', 'STAGEDANDUNSTAGED', 'STAGEDANDWORKTREE']);
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Show Accept from the opened ref's kind and indexState.
 * groupId is not an input: a conflict row can still be labeled workingTree.
 */
export function canOfferSourcesGitAcceptHunk(kind: string | undefined, indexState: string | undefined): boolean {
	const kindToken = sourcesGitAcceptToken(kind);
	const stateToken = sourcesGitAcceptToken(indexState);
	if (kindToken === '' || stateToken === '') {
		return false;
	}
	if (CONFLICT_KINDS.has(kindToken) || UNTRACKED_KINDS.has(kindToken)) {
		return false;
	}
	return UNSTAGED_INDEX_STATES.has(stateToken);
}

/**
 * File header (every line before the first `@@`, including rename / mode)
 * plus the single hunk whose new-side or old-side range contains `cursorLine`.
 * Binary diffs and a cursor outside every hunk return undefined (0 Apply).
 */
export function sourcesGitHunkPatchAtCursor(unifiedDiff: string, cursorLine: number, side: SourcesGitAcceptCursorSide = 'new'): string | undefined {
	const trimmed = unifiedDiff.trim();
	if (trimmed === '' || trimmed.toLowerCase().includes('(no changes)')) {
		return undefined;
	}
	if (trimmed.includes('Binary files') || trimmed.includes('GIT binary patch')) {
		return undefined;
	}
	if (!Number.isInteger(cursorLine) || cursorLine < 1) {
		return undefined;
	}

	const lines = trimmed.split(/\r?\n/);
	const firstHunk = lines.findIndex(line => line.startsWith('@@'));
	if (firstHunk <= 0) {
		return undefined;
	}
	const rawHeaders = lines.slice(0, firstHunk).join('\n').replace(/\n+$/, '');
	if (rawHeaders.trim() === '') {
		return undefined;
	}

	const starts: number[] = [];
	for (let index = firstHunk; index < lines.length; index++) {
		if (lines[index].startsWith('@@')) {
			starts.push(index);
		}
	}

	let selected: string | undefined;
	for (let hunkIndex = 0; hunkIndex < starts.length; hunkIndex++) {
		const start = starts[hunkIndex];
		const end = starts[hunkIndex + 1] ?? lines.length;
		const parsed = parseHunkHeader(lines[start]);
		if (!parsed) {
			return undefined;
		}
		if (selected !== undefined) {
			continue;
		}
		const count = side === 'new' ? parsed.newCount : parsed.oldCount;
		const rangeStart = side === 'new' ? parsed.newStart : parsed.oldStart;
		if (!lineInHunk(rangeStart, count, cursorLine)) {
			continue;
		}
		const body = lines.slice(start, end).join('\n').replace(/\n+$/, '');
		selected = `${rawHeaders}\n${body}\n`;
	}
	return selected;
}

function sourcesGitAcceptToken(value: string | undefined): string {
	return (value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function parseHunkHeader(header: string): { oldStart: number; oldCount: number; newStart: number; newCount: number } | undefined {
	const match = HUNK_HEADER.exec(header);
	if (!match) {
		return undefined;
	}
	const oldStart = Number(match[1]);
	const newStart = Number(match[3]);
	const oldCount = hunkCount(match[2]);
	const newCount = hunkCount(match[4]);
	if (!Number.isInteger(oldStart) || !Number.isInteger(newStart) || !Number.isInteger(oldCount) || !Number.isInteger(newCount)) {
		return undefined;
	}
	return { oldStart, oldCount, newStart, newCount };
}

/** Omitted `,count` means 1. An explicit 0 stays 0. */
function hunkCount(raw: string | undefined): number {
	return raw === undefined ? 1 : Number(raw);
}

function lineInHunk(start: number, count: number, line: number): boolean {
	if (count <= 0) {
		return false;
	}
	return line >= start && line < start + count;
}
