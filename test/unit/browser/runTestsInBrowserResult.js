/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

/**
 * @param {{ title: string, message: string }} failingTests
 * @param {string[]} failingModuleIds
 * @param {string} browserType
 * @param {string} rendererUrl
 * @returns {string}
 */
function formatFailingTestsSummary(failingTests, failingModuleIds, browserType, rendererUrl) {
	let res = `The followings tests are failing:\n - ${failingTests.map(({ title, message }) => `${title} (reason: ${message})`).join('\n - ')}`;

	if (failingModuleIds.length > 0) {
		res += `\n\nTo DEBUG, open ${browserType.toUpperCase()} and navigate to ${rendererUrl}?${failingModuleIds.map(module => `m=${module}`).join('&')}`;
	}

	return `${res}\n`;
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function formatPageEvaluateError(err) {
	const message = err instanceof Error ? err.message : String(err);
	return `Running tests in the browser failed: ${message}\n`;
}

/**
 * @param {{
 *   failingTests: { title: string, message: string }[];
 *   failingModuleIds: string[];
 *   pageEvaluateError?: unknown;
 *   browserType: string;
 *   rendererUrl: string;
 * }} input
 * @returns {string | undefined}
 */
function formatRunTestsInBrowserResult({ failingTests, failingModuleIds, pageEvaluateError, browserType, rendererUrl }) {
	if (failingTests.length > 0) {
		return formatFailingTestsSummary(failingTests, failingModuleIds, browserType, rendererUrl);
	}
	if (pageEvaluateError !== undefined && pageEvaluateError !== null) {
		return formatPageEvaluateError(pageEvaluateError);
	}
	return undefined;
}

module.exports = { formatRunTestsInBrowserResult, formatFailingTestsSummary, formatPageEvaluateError };
