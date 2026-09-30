/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { AuthInfo, Credentials } from '../../../request/common/request.js';
import { doResolveProxyCredentials, DoResolveProxyCredentialsDeps, DoResolveProxyCredentialsState } from '../../electron-main/proxyAuthResolveCredentials.js';

suite('doResolveProxyCredentials (proxy URL credentials)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const authInfoHash = 'proxy-auth-hash';

	function baseAuthInfo(attempt: number): AuthInfo {
		return {
			isProxy: true,
			attempt,
			scheme: 'http',
			host: 'proxy.example',
			port: 8080,
			realm: '',
		};
	}

	function createDeps(overrides: Partial<DoResolveProxyCredentialsDeps> = {}): DoResolveProxyCredentialsDeps {
		return {
			logService: { trace: () => { }, error: () => { } },
			extensionTestsLocationURI: undefined,
			getHttpProxyUrl: () => 'http://user:wrong@proxy.example:8080',
			getStoredCredentials: async () => undefined,
			showProxyCredentialsDialog: async () => undefined,
			...overrides,
		};
	}

	function createState(): DoResolveProxyCredentialsState {
		return {
			sessionCredentials: new Map<string, Credentials | undefined>(),
			currentDialog: undefined,
		};
	}

	test('attempt 1 returns config credentials from proxy URL without opening dialog', async () => {
		let dialogCalls = 0;
		const deps = createDeps({
			showProxyCredentialsDialog: async () => {
				dialogCalls++;
				return { username: 'dialog', password: 'dialog' };
			},
		});
		const state = createState();

		const result = await doResolveProxyCredentials(baseAuthInfo(1), authInfoHash, deps, state);

		assert.deepStrictEqual(result, { username: 'user', password: 'wrong' });
		assert.strictEqual(dialogCalls, 0);
	});

	test('attempt 2 falls through to dialog and returns dialog credentials', async () => {
		let dialogCalls = 0;
		const dialogCredentials: Credentials = { username: 'fixed', password: 'correct' };
		const deps = createDeps({
			showProxyCredentialsDialog: async () => {
				dialogCalls++;
				return dialogCredentials;
			},
		});
		const state = createState();

		const result = await doResolveProxyCredentials(baseAuthInfo(2), authInfoHash, deps, state);

		assert.deepStrictEqual(result, dialogCredentials);
		assert.strictEqual(dialogCalls, 1);
	});
});
