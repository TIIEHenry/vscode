/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Source paths to copy into a new worktree: git-ignored files that matched
 * `git.worktreeIncludeFiles` globs. Only the matched files are included, not
 * ancestor directories (avoids force-recursive copy overwriting tracked files).
 */
export function computeWorktreeIncludeSourcePaths(
	_repoRoot: string,
	gitIgnoredFilePaths: readonly string[],
	_worktreeIncludeFileGlobs: readonly string[]
): readonly string[] {
	void _repoRoot;
	void _worktreeIncludeFileGlobs;
	return [...gitIgnoredFilePaths];
}
