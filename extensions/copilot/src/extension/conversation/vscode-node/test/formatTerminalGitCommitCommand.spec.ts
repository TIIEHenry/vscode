/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, suite, test } from 'vitest';
import { formatTerminalGitCommitCommand } from '../formatTerminalGitCommitCommand';

suite('formatTerminalGitCommitCommand', () => {
	test('escapes quotes, backslashes, dollars, and backticks in order', () => {
		expect(formatTerminalGitCommitCommand('say "hi"')).toBe('git commit -m "say \\"hi\\""');
		expect(formatTerminalGitCommitCommand('say `id`')).toBe('git commit -m "say \\`id\\`"');
		expect(formatTerminalGitCommitCommand('$(id)')).toBe('git commit -m "\\$(id)"');
		expect(formatTerminalGitCommitCommand('path\\to "x"')).toBe('git commit -m "path\\\\to \\"x\\""');
	});

	test('collapses newlines and omits carriage returns', () => {
		const line = formatTerminalGitCommitCommand('line1\nline2\r\nline3');
		expect(line).not.toMatch(/\r|\n/);
		expect(line).toBe('git commit -m "line1 line2 line3"');
	});
});
