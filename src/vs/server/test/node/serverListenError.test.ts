/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { resolveServerListenErrorAction } from '../../node/serverListenError.js';

suite('server listen failure', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('listen failure exits before address is assigned', () => {
		const action = resolveServerListenErrorAction(null);
		assert.deepStrictEqual(action, { kind: 'exit', exitCode: 1 });
	});

	test('listen failure delegates to handleServerError when address is a socket path', () => {
		const action = resolveServerListenErrorAction('/tmp/vscode.sock');
		assert.deepStrictEqual(action, { kind: 'handleServerError' });
	});

	test('listen failure delegates to handleServerError when address is bound', () => {
		const action = resolveServerListenErrorAction({ address: '127.0.0.1', port: 8080, family: 'IPv4' });
		assert.deepStrictEqual(action, { kind: 'handleServerError' });
	});
});
