/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ITunnelProxyInfo } from '../../../tunnel/common/tunnelProxy.js';
import { BrowserViewStorageScope } from '../../common/browserView.js';
import type { BrowserSession } from '../../electron-main/browserSession.js';
import { BrowserSessionRemote } from '../../electron-main/browserSessionRemote.js';

function proxyInfo(url: string): ITunnelProxyInfo {
	return {
		url,
		host: '127.0.0.1',
		port: 9,
		credentials: { username: 'user', password: 'pass' },
		certFingerprint: 'sha256/abc',
	};
}

function createRemote(setProxy: Electron.Session['setProxy']): BrowserSessionRemote {
	return new BrowserSessionRemote(upcastPartial<BrowserSession>({
		storageScope: BrowserViewStorageScope.Ephemeral,
		electronSession: upcastPartial<Electron.Session>({ setProxy }),
	}));
}

suite('BrowserSessionRemote', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function trackEvents(remote: BrowserSessionRemote): { starts: number; stops: number } {
		const counts = { starts: 0, stops: 0 };
		disposables.add(remote.onDidStart(() => { counts.starts++; }));
		disposables.add(remote.onDidStop(() => { counts.stops++; }));
		return counts;
	}

	test('applies the same proxy again after setProxy rejects, then caches the success', async () => {
		const error = new Error('setProxy failed');
		const url = 'https://127.0.0.1:9';
		const seen: Electron.ProxyConfig[] = [];
		const remote = createRemote(async config => {
			seen.push(config);
			if (seen.length === 1) {
				throw error;
			}
		});
		const events = trackEvents(remote);

		remote.acquire('view', proxyInfo(url));
		const failed = remote.whenReady;
		assert.strictEqual(events.starts, 1);
		assert.strictEqual(events.stops, 0);

		await assert.rejects(failed, (reason: unknown) => reason === error);
		assert.strictEqual(remote.proxy, undefined);
		assert.strictEqual(remote.isRemote, false);
		assert.notStrictEqual(remote.whenReady, failed);
		await remote.whenReady;
		assert.strictEqual(events.starts, 1);
		assert.strictEqual(events.stops, 0);
		assert.strictEqual(seen.length, 1);

		remote.acquire('view', proxyInfo(url));
		assert.strictEqual(seen.length, 2);
		assert.strictEqual(seen[0].proxyRules, url);
		assert.strictEqual(seen[0].proxyBypassRules, '<-loopback>');
		assert.strictEqual(seen[1].proxyRules, url);
		assert.strictEqual(events.starts, 2);
		await remote.whenReady;
		assert.deepStrictEqual(remote.proxy, proxyInfo(url));
		assert.strictEqual(remote.isRemote, true);

		remote.acquire('view', proxyInfo(url));
		assert.strictEqual(seen.length, 2);
		assert.strictEqual(events.starts, 2);
		assert.strictEqual(events.stops, 0);
		await remote.whenReady;
	});

	test('shares one in-flight apply for the same proxy', async () => {
		let resolveSet!: () => void;
		const seen: Electron.ProxyConfig[] = [];
		const remote = createRemote(config => {
			seen.push(config);
			return new Promise(resolve => { resolveSet = resolve; });
		});
		const info = proxyInfo('https://127.0.0.1:9');

		remote.acquire('view-a', info);
		const ready = remote.whenReady;
		remote.acquire('view-b', proxyInfo(info.url));
		assert.strictEqual(seen.length, 1);
		assert.strictEqual(remote.whenReady, ready);

		resolveSet();
		await ready;
		await remote.whenReady;
		remote.acquire('view-a', proxyInfo(info.url));
		assert.strictEqual(seen.length, 1);
	});

	test('does not roll back a newer proxy when an older apply rejects', async () => {
		const error = new Error('old proxy failed');
		let rejectOld!: (reason: Error) => void;
		let resolveNew!: () => void;
		const seen: Electron.ProxyConfig[] = [];
		const remote = createRemote(config => {
			seen.push(config);
			if (seen.length === 1) {
				return new Promise<void>((_resolve, reject) => { rejectOld = reject; });
			}
			return new Promise<void>(resolve => { resolveNew = resolve; });
		});
		const events = trackEvents(remote);
		const older = proxyInfo('https://127.0.0.1:1');
		const newer = proxyInfo('https://127.0.0.1:2');

		remote.acquire('view', older);
		const olderReady = remote.whenReady;
		remote.acquire('view', newer);
		const newerReady = remote.whenReady;
		assert.notStrictEqual(olderReady, newerReady);
		assert.strictEqual(seen.length, 2);
		assert.strictEqual(events.starts, 2);
		assert.strictEqual(events.stops, 0);

		rejectOld(error);
		await assert.rejects(olderReady, (reason: unknown) => reason === error);
		assert.strictEqual(remote.proxy, newer);
		assert.strictEqual(remote.whenReady, newerReady);
		assert.strictEqual(seen.length, 2);
		assert.strictEqual(events.starts, 2);
		assert.strictEqual(events.stops, 0);

		resolveNew();
		await newerReady;
		remote.acquire('view', proxyInfo(newer.url));
		assert.strictEqual(seen.length, 2);
		assert.strictEqual(remote.proxy, newer);
	});

	test('rolls back to the previous proxy when the new apply rejects', async () => {
		const error = new Error('new proxy failed');
		const seen: Electron.ProxyConfig[] = [];
		const remote = createRemote(async config => {
			seen.push(config);
			if (seen.length === 2) {
				throw error;
			}
		});
		const events = trackEvents(remote);
		const first = proxyInfo('https://127.0.0.1:1');
		const second = proxyInfo('https://127.0.0.1:2');

		remote.acquire('view', first);
		await remote.whenReady;
		assert.strictEqual(seen.length, 1);
		assert.strictEqual(events.starts, 1);

		remote.acquire('view', second);
		const failed = remote.whenReady;
		assert.strictEqual(events.starts, 2);
		await assert.rejects(failed, (reason: unknown) => reason === error);
		assert.strictEqual(remote.proxy, first);
		assert.strictEqual(remote.isRemote, true);
		assert.notStrictEqual(remote.whenReady, failed);
		await remote.whenReady;
		assert.strictEqual(events.starts, 2);
		assert.strictEqual(events.stops, 0);

		remote.acquire('view', second);
		assert.strictEqual(seen.length, 3);
		assert.strictEqual(seen[2].proxyRules, second.url);
		await remote.whenReady;
		assert.strictEqual(remote.proxy?.url, second.url);

		remote.acquire('view', proxyInfo(second.url));
		assert.strictEqual(seen.length, 3);
		assert.strictEqual(events.stops, 0);
	});
});
