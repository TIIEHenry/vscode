/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { shellQuotePluginRootInCommand } from '../../../common/plugins/agentPluginServiceImpl.js';

suite('shellQuotePluginRootInCommand', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const TOKEN = '${PLUGIN_ROOT}';
	const SH = 'sh' as const;
	const CMD = 'cmd' as const;

	test('returns command unchanged when token is not present', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('echo hello', '/safe/path', TOKEN, SH),
			'echo hello',
		);
	});

	test('plain replacement when path has no special characters', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', '/safe/path', TOKEN, SH),
			'/safe/path/run.sh',
		);
	});

	test('plain replacement for multiple occurrences with safe path', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/a && ${PLUGIN_ROOT}/b', '/safe', TOKEN, SH),
			'/safe/a && /safe/b',
		);
	});

	test('quotes path with spaces', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', '/path with spaces', TOKEN, SH),
			"'/path with spaces/run.sh'",
		);
	});

	test('quotes path with ampersand', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', '/path&dir', TOKEN, SH),
			"'/path&dir/run.sh'",
		);
	});

	test('quotes multiple occurrences with unsafe path', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/a && ${PLUGIN_ROOT}/b', '/my dir', TOKEN, SH),
			"'/my dir/a' && '/my dir/b'",
		);
	});

	test('does not double-quote when already in double quotes', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('"${PLUGIN_ROOT}/run.sh"', '/my dir', TOKEN, SH),
			"'/my dir/run.sh'",
		);
	});

	test('does not double-quote when already in single quotes', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand(`'\${PLUGIN_ROOT}/run.sh'`, '/my dir', TOKEN, SH),
			"'/my dir/run.sh'",
		);
	});

	test('escapes embedded double-quote characters in path', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', '/path"with"quotes', TOKEN, SH),
			`'/path"with"quotes/run.sh'`,
		);
	});

	test('handles token without trailing path suffix', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('cd ${PLUGIN_ROOT} && run', '/my dir', TOKEN, SH),
			"cd '/my dir' && run",
		);
	});

	test('does not consume shell operators adjacent to token', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('cd ${PLUGIN_ROOT}&& echo ok', '/my dir', TOKEN, SH),
			"cd '/my dir'&& echo ok",
		);
	});

	test('handles token at start, middle and end of command', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/a ${PLUGIN_ROOT}/b ${PLUGIN_ROOT}/c', '/sp ace', TOKEN, SH),
			"'/sp ace/a' '/sp ace/b' '/sp ace/c'",
		);
	});

	test('uses default CLAUDE_PLUGIN_ROOT token when not specified', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${CLAUDE_PLUGIN_ROOT}/run.sh', '/safe/path', '${CLAUDE_PLUGIN_ROOT}', SH),
			'/safe/path/run.sh',
		);
	});

	test('uses default CLAUDE_PLUGIN_ROOT token with quoting', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${CLAUDE_PLUGIN_ROOT}/run.sh', '/my dir', '${CLAUDE_PLUGIN_ROOT}', SH),
			"'/my dir/run.sh'",
		);
	});

	test('handles Windows-style paths with spaces', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}\\scripts\\run.bat', 'C:\\Program Files\\plugin', TOKEN, CMD),
			'"C:\\Program Files\\plugin\\scripts\\run.bat"',
		);
	});

	test('handles path with parentheses', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', '/path(1)', TOKEN, SH),
			"'/path(1)/run.sh'",
		);
	});

	test('sh quotes dollar, command substitution, backtick, and single-quote segments', () => {
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', '/plugins/$VAR', TOKEN, SH),
			"'/plugins/$VAR/run.sh'",
		);
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', '/plugins/$(whoami)', TOKEN, SH),
			"'/plugins/$(whoami)/run.sh'",
		);
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', '/plugins/`id`', TOKEN, SH),
			"'/plugins/`id`/run.sh'",
		);
		assert.strictEqual(
			shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.sh', `/plugins/o'brien`, TOKEN, SH),
			`'/plugins/o'\\''brien/run.sh'`,
		);
	});

	test('cmd keeps dollar signs literal without backslashes', () => {
		const quoted = shellQuotePluginRootInCommand('${PLUGIN_ROOT}/run.bat', 'C:/plugins/$VAR', TOKEN, CMD);
		assert.strictEqual(quoted, '"C:/plugins/$VAR/run.bat"');
		assert.ok(!quoted.includes('\\$'));
	});
});
