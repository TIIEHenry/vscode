/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canOfferSourcesGitAcceptHunk,
	rememberSourcesGitAcceptCursor,
	SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE,
	SOURCES_GIT_APPLY_CACHED_ARGV,
	sourcesGitAcceptCursorFromEditors,
	sourcesGitHunkPatchAtCursor,
} from '../../common/sourcesGitHunkPatch.js';

suite('Sources - git hunk patch', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const header = [
		'diff --git a/src/old.ts b/src/new.ts',
		'similarity index 90%',
		'rename from src/old.ts',
		'rename to src/new.ts',
		'old mode 100644',
		'new mode 100755',
		'index 1111111..2222222 100755',
		'--- a/src/old.ts',
		'+++ b/src/new.ts',
	].join('\n');
	const hunk1 = [
		'@@ -1,3 +1,4 @@',
		' line1',
		'-old',
		'+new',
		'+extra',
	].join('\n');
	const hunk2 = [
		'@@ -10,2 +11,3 @@',
		' keep',
		'-gone',
		'+added',
		'+more',
		'\\ No newline at end of file',
	].join('\n');
	const diff = `${header}\n${hunk1}\n${hunk2}`;

	test('keeps the file header and only the hunk under the cursor', () => {
		const second = sourcesGitHunkPatchAtCursor(diff, 12, 'new');
		assert.strictEqual(second, `${header}\n${hunk2}\n`);
		assert.ok(second?.includes('rename from src/old.ts'));
		assert.ok(second?.includes('rename to src/new.ts'));
		assert.ok(second?.includes('old mode 100644'));
		assert.ok(second?.includes('new mode 100755'));
		assert.ok(second?.includes('@@ -10,2 +11,3 @@'));
		assert.ok(second?.includes('\\ No newline at end of file'));
		assert.ok(!second?.includes('@@ -1,3 +1,4 @@'));
		assert.ok(!second?.includes('+extra'));

		const first = sourcesGitHunkPatchAtCursor(diff, 2, 'new');
		assert.strictEqual(first, `${header}\n${hunk1}\n`);
		assert.ok(first?.startsWith('diff --git a/src/old.ts b/src/new.ts\n'));
		assert.ok(!first?.includes('\\ No newline at end of file'));
		assert.ok(!first?.includes('@@ -10,2 +11,3 @@'));
	});

	test('binary diffs, empty diffs, and a cursor outside every hunk yield no patch', () => {
		assert.strictEqual(sourcesGitHunkPatchAtCursor('Binary files a/a.bin and b/a.bin differ', 1), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor('diff --git a/a.bin b/a.bin\nGIT binary patch\nliteral 0\n', 1), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor('(no changes)', 1), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor('  (No Changes)\n', 1), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor('   ', 1), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor('', 1), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor(diff, 5, 'new'), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor(diff, 14, 'new'), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor(diff, 0, 'new'), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor(diff, 1.5, 'new'), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor('@@ -1 +1 @@\n-a\n+b\n', 1), undefined);
	});

	test('omitted hunk counts mean 1 and an explicit 0 stays 0', () => {
		const omitted = [
			'diff --git a/a b/a',
			'--- a/a',
			'+++ b/a',
			'@@ -4 +9 @@',
			'-old',
			'+new',
		].join('\n');
		assert.ok(sourcesGitHunkPatchAtCursor(omitted, 9, 'new')?.includes('@@ -4 +9 @@'));
		assert.strictEqual(sourcesGitHunkPatchAtCursor(omitted, 10, 'new'), undefined);
		assert.ok(sourcesGitHunkPatchAtCursor(omitted, 4, 'old')?.includes('@@ -4 +9 @@'));
		assert.strictEqual(sourcesGitHunkPatchAtCursor(omitted, 5, 'old'), undefined);

		const explicitZero = [
			'diff --git a/a b/a',
			'--- a/a',
			'+++ b/a',
			'@@ -3,0 +8,0 @@',
		].join('\n');
		assert.strictEqual(sourcesGitHunkPatchAtCursor(explicitZero, 8, 'new'), undefined);
		assert.strictEqual(sourcesGitHunkPatchAtCursor(explicitZero, 3, 'old'), undefined);

		const newSideZero = [
			'diff --git a/a b/a',
			'--- a/a',
			'+++ b/a',
			'@@ -1 +1,0 @@',
		].join('\n');
		assert.strictEqual(sourcesGitHunkPatchAtCursor(newSideZero, 1, 'new'), undefined);
		assert.ok(sourcesGitHunkPatchAtCursor(newSideZero, 1, 'old')?.includes('@@ -1 +1,0 @@'));
	});

	test('a bad hunk header returns undefined instead of throwing', () => {
		const bad = [
			'diff --git a/a b/a',
			'--- a/a',
			'+++ b/a',
			'@@ not-a-hunk',
			'+x',
		].join('\n');
		assert.strictEqual(sourcesGitHunkPatchAtCursor(bad, 1), undefined);

		const laterBad = [
			'diff --git a/a b/a',
			'--- a/a',
			'+++ b/a',
			'@@ -1 +1 @@',
			'-a',
			'+b',
			'@@ garbage',
		].join('\n');
		assert.strictEqual(sourcesGitHunkPatchAtCursor(laterBad, 1, 'new'), undefined);
	});

	test('trailing function context after @@ stays on the hunk line', () => {
		const withContext = [
			'diff --git a/a.ts b/a.ts',
			'--- a/a.ts',
			'+++ b/a.ts',
			'@@ -8,1 +8,1 @@ function foo()',
			'-old',
			'+new',
		].join('\n');
		const patch = sourcesGitHunkPatchAtCursor(withContext, 8, 'new');
		assert.ok(patch?.includes('@@ -8,1 +8,1 @@ function foo()'));
		assert.ok(patch?.includes('--- a/a.ts'));
	});

	test('old side matches the old file line range', () => {
		const both = [
			'diff --git a/a b/a',
			'--- a/a',
			'+++ b/a',
			'@@ -20,2 +40,2 @@',
			' keep',
			'-old',
			'+new',
		].join('\n');
		assert.ok(sourcesGitHunkPatchAtCursor(both, 21, 'old')?.includes('@@ -20,2 +40,2 @@'));
		assert.strictEqual(sourcesGitHunkPatchAtCursor(both, 21, 'new'), undefined);
		assert.ok(sourcesGitHunkPatchAtCursor(both, 40, 'new')?.includes('@@ -20,2 +40,2 @@'));
	});

	test('a synced caret on the unfocused side does not steal the hunk line', () => {
		const onOriginal = { side: 'old' as const, line: 4 };
		assert.deepStrictEqual(
			rememberSourcesGitAcceptCursor(onOriginal, { side: 'new', line: 9, editorHasFocus: false }),
			onOriginal,
		);
		assert.deepStrictEqual(
			rememberSourcesGitAcceptCursor(onOriginal, { side: 'new', line: 9, editorHasFocus: true }),
			{ side: 'new', line: 9 },
		);
		assert.deepStrictEqual(
			rememberSourcesGitAcceptCursor(onOriginal, { side: 'old', line: 0, editorHasFocus: true }),
			onOriginal,
		);
	});

	test('Accept uses the focused side, else the last focused side, else the modified caret', () => {
		const onOriginal = { side: 'old' as const, line: 4 };
		assert.deepStrictEqual(sourcesGitAcceptCursorFromEditors({
			focused: undefined,
			remembered: onOriginal,
			modifiedLine: 9,
			originalLine: 4,
		}), onOriginal);
		assert.deepStrictEqual(sourcesGitAcceptCursorFromEditors({
			focused: 'new',
			remembered: onOriginal,
			modifiedLine: 12,
			originalLine: 4,
		}), { side: 'new', line: 12 });
		assert.deepStrictEqual(sourcesGitAcceptCursorFromEditors({
			focused: 'old',
			remembered: { side: 'new', line: 12 },
			modifiedLine: 12,
			originalLine: 7,
		}), { side: 'old', line: 7 });
		assert.deepStrictEqual(sourcesGitAcceptCursorFromEditors({
			focused: undefined,
			remembered: undefined,
			modifiedLine: 2,
			originalLine: 8,
		}), { side: 'new', line: 2 });
		assert.strictEqual(sourcesGitAcceptCursorFromEditors({
			focused: undefined,
			remembered: undefined,
			modifiedLine: undefined,
			originalLine: undefined,
		}), undefined);
	});

	test('cached apply argv is fixed and FileDiff index state is Unstaged', () => {
		assert.deepStrictEqual([...SOURCES_GIT_APPLY_CACHED_ARGV], ['git', 'apply', '--cached', '--whitespace=nowarn']);
		assert.ok(!(SOURCES_GIT_APPLY_CACHED_ARGV as readonly string[]).includes('-R'));
		assert.strictEqual(SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE, 'Unstaged');
	});

	test('Accept offer uses kind and indexState', () => {
		const cases: ReadonlyArray<readonly [string, string, boolean]> = [
			['Modified', 'Unstaged', true],
			['MODIFIED', 'WORKTREE', true],
			['Modified', 'working tree', true],
			['Modified', 'StagedAndUnstaged', true],
			['Modified', 'STAGED_AND_WORKTREE', true],
			['Modified', 'Staged And Unstaged', true],
			['Added', 'Unstaged', true],
			['Deleted', 'WorkingTree', true],
			['Renamed', 'unstaged', true],
			['Conflict', 'Unstaged', false],
			['UNMERGED', 'WORKTREE', false],
			['BOTH_MODIFIED', 'Unstaged', false],
			['BOTH ADDED', 'Unstaged', false],
			['both-deleted', 'Unstaged', false],
			['Modified', 'Untracked', false],
			['Untracked', 'Unstaged', false],
			['UNTRACKED', 'WORKTREE', false],
			['Modified', 'Staged', false],
			['Modified', 'INDEX', false],
			['Modified', 'STAGED', false],
			['Modified', 'Conflict', false],
			['Modified', '', false],
			['', 'Unstaged', false],
		];
		for (const [kind, indexState, expected] of cases) {
			assert.strictEqual(canOfferSourcesGitAcceptHunk(kind, indexState), expected, `${kind} / ${indexState}`);
		}
	});
});
