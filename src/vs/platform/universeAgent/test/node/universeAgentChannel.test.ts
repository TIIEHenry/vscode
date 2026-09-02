/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import tls from 'node:tls';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { deriveEngineLeafFingerprintHex } from '../../node/deviceGrant/tls-pin.js';
import { probePinnedTlsHandshake } from '../../node/pinnedTlsChannel.js';

function createSelfSignedCert(): { cert: X509Certificate; certPem: string; keyPem: string } {
	const dir = mkdtempSync(join(tmpdir(), 'ua-tls-test-'));
	try {
		const keyPath = join(dir, 'key.pem');
		const certPath = join(dir, 'cert.pem');
		execFileSync('openssl', [
			'req', '-x509', '-newkey', 'rsa:2048',
			'-keyout', keyPath, '-out', certPath,
			'-days', '1', '-nodes', '-subj', '/CN=mock-engine',
		], { stdio: 'ignore' });
		const certPem = readFileSync(certPath, 'utf8');
		const keyPem = readFileSync(keyPath, 'utf8');
		return { cert: new X509Certificate(certPem), certPem, keyPem };
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function startMockTlsServer(input: {
	readonly certPem: string;
	readonly keyPem: string;
	readonly alpn?: string[];
}): Promise<{ readonly port: number; readonly close: () => void }> {
	return new Promise((resolve, reject) => {
		const server = tls.createServer(
			{
				key: input.keyPem,
				cert: input.certPem,
				ALPNProtocols: input.alpn ?? ['h2'],
			},
			(socket) => {
				socket.end();
			},
		);
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				reject(new Error('failed to bind mock TLS server'));
				return;
			}
			resolve({
				port: address.port,
				close: () => server.close(),
			});
		});
	});
}

suite('universeAgentChannel pinned TLS (S21)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('wrong pin fails / correct pin succeeds / random SNI does not block nonce hostname', async () => {
		const { cert, certPem, keyPem } = createSelfSignedCert();
		const leafDer = Uint8Array.from(cert.raw);
		const correctFingerprint = deriveEngineLeafFingerprintHex(leafDer);
		const wrongFingerprint = '0'.repeat(64);

		const server = await startMockTlsServer({ certPem, keyPem });
		try {
			const wrongPin = await probePinnedTlsHandshake({
				host: '127.0.0.1',
				port: server.port,
				servername: 'r-random-nonce.example',
				tls: {
					trustAnchorLeafDer: leafDer,
					expectedLeafSha256Hex: wrongFingerprint,
					hostnameVerification: 'replaced-by-pin',
				},
			});
			assert.strictEqual(wrongPin.ok, false);

			const correctPin = await probePinnedTlsHandshake({
				host: '127.0.0.1',
				port: server.port,
				servername: 'r-random-nonce.example',
				tls: {
					trustAnchorLeafDer: leafDer,
					expectedLeafSha256Hex: correctFingerprint,
					hostnameVerification: 'replaced-by-pin',
				},
			});
			assert.strictEqual(correctPin.ok, true);
		} finally {
			server.close();
		}
	});
});
