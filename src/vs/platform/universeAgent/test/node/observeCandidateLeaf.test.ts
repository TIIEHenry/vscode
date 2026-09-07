/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import net from 'node:net';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	buildObserveTlsOptions,
	DIRECT_ADDRESS_SNI_PLACEHOLDER,
	grpcSslTargetNameOverride,
	observeCandidateLeaf,
	tlsServernameForObserve,
} from '../../node/deviceGrant/observe-candidate-leaf.js';

suite('observeCandidateLeaf Direct Address SNI', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('omits IP literals from TLS servername (Node forbids IP SNI)', () => {
		assert.strictEqual(tlsServernameForObserve('127.0.0.1'), undefined);
		assert.strictEqual(tlsServernameForObserve('::1'), undefined);
		assert.strictEqual(tlsServernameForObserve('203.0.113.10'), undefined);
		assert.strictEqual(tlsServernameForObserve(' 192.168.1.4 '), undefined);
		assert.strictEqual(tlsServernameForObserve('engine.example.com'), 'engine.example.com');
		assert.strictEqual(tlsServernameForObserve('  relay.example.com  '), 'relay.example.com');
		assert.strictEqual(tlsServernameForObserve(undefined), undefined);
		assert.strictEqual(tlsServernameForObserve(''), undefined);
		assert.strictEqual(grpcSslTargetNameOverride('127.0.0.1'), DIRECT_ADDRESS_SNI_PLACEHOLDER);
		assert.strictEqual(grpcSslTargetNameOverride('::1'), DIRECT_ADDRESS_SNI_PLACEHOLDER);
		assert.strictEqual(grpcSslTargetNameOverride(''), DIRECT_ADDRESS_SNI_PLACEHOLDER);
		assert.strictEqual(grpcSslTargetNameOverride('relay.example.com'), 'relay.example.com');
	});

	test('buildObserveTlsOptions drops IP SNI and keeps Hub hostname SNI', () => {
		const direct = buildObserveTlsOptions({
			host: '127.0.0.1',
			port: 50061,
			servername: '127.0.0.1',
		});
		assert.strictEqual(direct.servername, undefined);
		assert.deepStrictEqual(direct.ALPNProtocols, ['h2']);
		assert.strictEqual(direct.rejectUnauthorized, false);

		const hub = buildObserveTlsOptions({
			host: '203.0.113.1',
			port: 443,
			servername: 'relay.example.com',
		});
		assert.strictEqual(hub.servername, 'relay.example.com');
	});

	test('IP servername does not throw; TCP-only peer fails closed with timeout', async () => {
		const sockets = new Set<net.Socket>();
		const server = net.createServer(socket => {
			sockets.add(socket);
			socket.on('close', () => sockets.delete(socket));
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		const address = server.address();
		assert.ok(address && typeof address === 'object');
		try {
			const result = await observeCandidateLeaf(
				{ host: '127.0.0.1', port: address.port, servername: '127.0.0.1' },
				{ timeoutMs: 150 },
			);
			assert.strictEqual(result.ok, false);
			if (!result.ok) {
				assert.strictEqual(result.code, 'observe_failed');
				assert.ok(result.reason.includes('timed out') || result.reason.includes('observe_failed'));
			}
		} finally {
			for (const socket of sockets) {
				socket.destroy();
			}
			server.close();
		}
	});
});
