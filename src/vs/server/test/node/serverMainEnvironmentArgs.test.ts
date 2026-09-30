/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { applyServerEnvironmentVariablesToParsedArgs } from '../../../../server-main-environment-args.js';

suite('applyServerEnvironmentVariablesToParsedArgs', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('VSCODE_SERVER_ACCEPT_SERVER_LICENSE_TERMS=true yields boolean true', () => {
		const parsedArgs: Record<string, unknown> = { 'accept-server-license-terms': false };
		applyServerEnvironmentVariablesToParsedArgs(parsedArgs, {
			VSCODE_SERVER_ACCEPT_SERVER_LICENSE_TERMS: 'true',
		});
		assert.strictEqual(parsedArgs['accept-server-license-terms'], true);
	});

	test('hyphenated environment variable names are not read', () => {
		const parsedArgs: Record<string, unknown> = {};
		applyServerEnvironmentVariablesToParsedArgs(parsedArgs, {
			'VSCODE_SERVER_ACCEPT_SERVER-LICENSE-TERMS': 'true',
		});
		assert.strictEqual(parsedArgs['accept-server-license-terms'], undefined);
	});

	test('VSCODE_SERVER_PORT remains a string', () => {
		const parsedArgs: Record<string, unknown> = {};
		applyServerEnvironmentVariablesToParsedArgs(parsedArgs, {
			VSCODE_SERVER_PORT: '8080',
		});
		assert.strictEqual(parsedArgs['port'], '8080');
		assert.strictEqual(typeof parsedArgs['port'], 'string');
	});
});
