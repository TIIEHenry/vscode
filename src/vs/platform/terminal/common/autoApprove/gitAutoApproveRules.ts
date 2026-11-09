/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Default auto-approval rules for safe Git subcommands.
 *
 * These patterns support `-C <path>` and `--no-pager` immediately after `git`.
 * Git's uppercase `-C` changes directory, while lowercase `-c` injects configuration.
 */
export const gitAutoApproveRules: Readonly<Record<string, boolean>> = {
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+status\\b/': true,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+log\\b/': true,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+log\\b.*\\s--output(=|\\s|$)/': false,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+show\\b/': true,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+show\\b.*\\s--output(=|\\s|$)/': false,
	// `git log`, `git show` and `git diff` write to a file with `--output`. The shell drops quotes,
	// `$` before a quote, backslashes and line continuations, so they may surround or split the option.
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+(?:log|show|diff)\\b[\\s\\S]*\\s(?-i:(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*-(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*-(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*o(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*u(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*t(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*p(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*u(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*t(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*(?:=|\\s|$))/': false,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+diff\\b/': true,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+ls-files\\b/': true,

	// git grep
	// - `-O`, `--open-files-in-pager`: May execute an external pager
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+grep\\b/': true,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+grep\\b.*\\s(?-i:-[aIivwhHEGPFnlLqzco]*[^\\w\\s]*O\\S*)(\\s|$)/': false,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+grep\\b.*\\s(?-i:--[^\\w\\s]*o[^\\w\\s]*p\\S*)(\\s|$)/': false,
	// Quotes, backslashes and line continuations may also surround or split these options, and
	// any short option without an argument may precede `O` in a cluster.
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+grep\\b[\\s\\S]*\\s(?-i:(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*-(?:\\$?[\'"]|\\\\\\r?\\n|\\\\|[aIivwhHEGPFnlLqzcopWr0-9])*O)/': false,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+grep\\b[\\s\\S]*\\s(?-i:(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*-(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*-(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*o(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*p)/': false,

	// git branch
	// - `-d`, `-D`, `--delete`: Prevent branch deletion
	// - `-m`, `-M`: Prevent branch renaming
	// - `--force`: Generally dangerous
	// - `-f`, `-C`, `--move`, and clustered, abbreviated, quoted or continued spellings: Also
	//   delete, rename, force-reset or overwrite branches
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+branch\\b/': true,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+branch\\b.*\\s-(d|D|m|M|-delete|-force)\\b/': false,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+branch\\b[\\s\\S]*\\s(?-i:(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*-(?:\\$?[\'"]|\\\\\\r?\\n|\\\\|[vqtrlaic])*[dDmMfC])/': false,
	'/^git(\\s+(-(?-i:C)\\s+\\S+|--no-pager))*\\s+branch\\b[\\s\\S]*\\s(?-i:(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*-(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*-(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*(?:d|m(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*o|f(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*o(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*r(?:\\$?[\'"]|\\\\\\r?\\n|\\\\)*c))/': false,
};
