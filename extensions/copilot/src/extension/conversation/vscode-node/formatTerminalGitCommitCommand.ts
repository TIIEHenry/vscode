/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Shell-safe single-line `git commit -m "..."` for terminal sendText (second arg false). */
export function formatTerminalGitCommitCommand(commitMessage: string): string {
	let payload = commitMessage.replace(/\r\n|\r|\n/g, ' ');
	payload = payload.replace(/\\/g, '\\\\');
	payload = payload.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
	return `git commit -m "${payload}"`;
}
