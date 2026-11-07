/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as net from 'net';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IConnectionOptions } from '../../../remote/common/remoteAgentConnection.js';
import { NodeRemoteTunnel } from '../../node/tunnelService.js';

suite('NodeRemoteTunnel', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('falls back to a random port when the first listen fails', async function () {
		// Occupy a port on ::1 only, so the free-port probe (which uses 127.0.0.1) reports it as free
		// while listening on ::1 fails with EADDRINUSE.
		const blocker = net.createServer();
		const blocked = await new Promise<number | undefined>(resolve => {
			blocker.once('error', () => resolve(undefined));
			blocker.listen(0, '::1', () => resolve((blocker.address() as net.AddressInfo).port));
		});
		if (blocked === undefined) {
			this.skip();
		}

		const tunnel = new NodeRemoteTunnel({} as IConnectionOptions, '::1', '127.0.0.1', blocked!);
		let handle: ReturnType<typeof setTimeout> | undefined;
		try {
			const ready = await Promise.race([tunnel.waitForReady(), new Promise<undefined>(resolve => handle = setTimeout(resolve, 2000))]);
			assert.ok(ready, 'waitForReady should not hang when the suggested port is taken');
			assert.notStrictEqual(ready.tunnelLocalPort, blocked);
			assert.ok(ready.tunnelLocalPort > 0);
		} finally {
			clearTimeout(handle);
			await tunnel.dispose();
			await new Promise(resolve => blocker.close(resolve));
		}
	});

	test('rejects with the listen error when the random port retry also fails', async () => {
		// 192.0.2.1 (TEST-NET-1) is not assigned locally, so every listen() on it fails.
		const tunnel = new NodeRemoteTunnel({} as IConnectionOptions, '192.0.2.1', '127.0.0.1', 8080);
		try {
			await assert.rejects(tunnel.waitForReady(), (error: Error) => {
				assert.match(error.message, /^Unable to listen on a local port for the tunnel to 127\.0\.0\.1:8080: /);
				assert.ok(error.cause instanceof Error && (error.cause as NodeJS.ErrnoException).code, 'the original listen error is attached as cause');
				return true;
			});
		} finally {
			await tunnel.dispose();
		}
	});
});
