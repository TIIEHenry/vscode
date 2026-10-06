/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { AuthInfo, Credentials } from '../../../request/common/request.js';
import { doResolveProxyCredentials, DoResolveProxyCredentialsDeps, DoResolveProxyCredentialsState, IProxyCredentialsDialogWebContents, waitForProxyCredentialsDialogReply } from '../../electron-main/proxyAuthResolveCredentials.js';

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

suite('waitForProxyCredentialsDialogReply', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('resolves undefined in the same turn when webContents is missing', async () => {
		let cancelCount = 0;
		let sendCount = 0;

		const result = await waitForProxyCredentialsDialogReply(
			'reply-channel',
			Event.None,
			undefined,
			() => { sendCount++; },
			async () => {
				cancelCount++;
				return undefined;
			},
		);

		assert.strictEqual(result, undefined);
		assert.strictEqual(cancelCount, 0);
		assert.strictEqual(sendCount, 0);
	});

	test('resolves undefined on window close without treating it as user cancel', async () => {
		const onDidClose = new Emitter<void>();
		let cancelCount = 0;
		const webContents: IProxyCredentialsDialogWebContents = {
			isDestroyed: () => false,
			on: () => { },
			off: () => { },
		};

		const promise = waitForProxyCredentialsDialogReply(
			'reply-channel',
			onDidClose.event,
			webContents,
			() => { },
			async (reply) => {
				if (!reply) {
					cancelCount++;
				}
				return undefined;
			},
		);

		onDidClose.fire();
		const result = await promise;

		assert.strictEqual(result, undefined);
		assert.strictEqual(cancelCount, 0);
	});
});

suite('doResolveProxyCredentials dialog recovery', () => {

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

	test('opens the dialog again after a window-close wait completes', async () => {
		const onDidClose = new Emitter<void>();
		let dialogCalls = 0;

		const deps: DoResolveProxyCredentialsDeps = {
			logService: { trace: () => { }, error: () => { } },
			extensionTestsLocationURI: undefined,
			getHttpProxyUrl: () => undefined,
			getStoredCredentials: async () => undefined,
			showProxyCredentialsDialog: async () => {
				dialogCalls++;
				if (dialogCalls === 1) {
					const webContents: IProxyCredentialsDialogWebContents = {
						isDestroyed: () => false,
						on: () => { },
						off: () => { },
					};
					const result = await waitForProxyCredentialsDialogReply(
						'reply-channel',
						onDidClose.event,
						webContents,
						() => { },
						async () => undefined,
					);
					onDidClose.fire();
					return result;
				}
				return { username: 'dialog', password: 'ok' };
			},
		};

		const state: DoResolveProxyCredentialsState = {
			sessionCredentials: new Map<string, Credentials | undefined>(),
			currentDialog: undefined,
		};

		const first = await doResolveProxyCredentials(baseAuthInfo(2), authInfoHash, deps, state);
		assert.strictEqual(first, undefined);

		const second = await doResolveProxyCredentials(baseAuthInfo(2), authInfoHash, deps, state);
		assert.deepStrictEqual(second, { username: 'dialog', password: 'ok' });
		assert.strictEqual(dialogCalls, 2);
	});
});
