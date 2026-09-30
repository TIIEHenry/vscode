/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const assert = require('assert');
const path = require('path');
const { test } = require('node:test');
const { createMassagePath } = require('./massagePath');

const rootDir = path.resolve('/tmp/vscode-browser-test-root');
const prefix = '/a1b2c3d4e5f67890';

test('allows in-repo path after prefix is replaced with rootDir', () => {
	const massagePath = createMassagePath(rootDir, prefix);
	const input = `${prefix}/src/vs/base/test/common/__snapshots__/example.snap`;
	const result = massagePath(input);
	assert.strictEqual(result, path.resolve(rootDir, 'src/vs/base/test/common/__snapshots__/example.snap'));
});

test('allows absolute path under rootDir without URL prefix', () => {
	const massagePath = createMassagePath(rootDir, prefix);
	const input = path.join(rootDir, 'src/foo.test.js');
	const result = massagePath(input);
	assert.strictEqual(result, path.resolve(input));
});

test('rejects absolute path outside rootDir without URL prefix', () => {
	const massagePath = createMassagePath(rootDir, prefix);
	assert.throws(
		() => massagePath('/tmp/outside-repo-secret'),
		/Path is outside of the test workspace/
	);
});

test('rejects path that escapes rootDir via .. after prefix replacement', () => {
	const massagePath = createMassagePath(rootDir, prefix);
	assert.throws(
		() => massagePath(`${prefix}/../../../etc/passwd`),
		/Path is outside of the test workspace/
	);
});

test('does not invoke fs when path is rejected', () => {
	const massagePath = createMassagePath(rootDir, prefix);
	let fsCalled = false;
	const readFile = () => {
		fsCalled = true;
	};
	assert.throws(() => {
		const resolved = massagePath('/tmp/no-fs-touch');
		readFile(resolved);
	});
	assert.strictEqual(fsCalled, false);
});
