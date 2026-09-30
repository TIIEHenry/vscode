/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const assert = require('assert');
const { test } = require('node:test');
const { formatRunTestsInBrowserResult } = require('./runTestsInBrowserResult');

const base = {
	failingModuleIds: [],
	browserType: 'chromium',
	rendererUrl: 'http://localhost:1234/test/unit/browser/renderer.html',
};

test('returns undefined when there are no failing tests and no page error', () => {
	assert.strictEqual(
		formatRunTestsInBrowserResult({ ...base, failingTests: [] }),
		undefined
	);
});

test('returns page evaluate error message when failingTests is empty', () => {
	const result = formatRunTestsInBrowserResult({
		...base,
		failingTests: [],
		pageEvaluateError: new Error('loadAndRun blew up'),
	});
	assert.match(result, /loadAndRun blew up/);
	assert.match(result, /^Running tests in the browser failed:/);
});

test('returns failing test summary when failingTests is non-empty', () => {
	const result = formatRunTestsInBrowserResult({
		...base,
		failingTests: [{ title: 'suite test', message: 'boom' }],
		pageEvaluateError: new Error('ignored'),
	});
	assert.match(result, /suite test \(reason: boom\)/);
	assert.doesNotMatch(result, /ignored/);
});

test('includes debug hint when failing module ids are present', () => {
	const result = formatRunTestsInBrowserResult({
		...base,
		failingTests: [{ title: 'suite test', message: 'boom' }],
		failingModuleIds: ['vs/foo.test'],
	});
	assert.match(result, /vs\/foo\.test/);
	assert.match(result, /CHROMIUM/);
});
