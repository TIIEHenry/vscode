/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import tls from 'node:tls';
import {
	createPinnedServerIdentityCheck,
	type PinnedTlsPlanInput,
	verifyPinnedTlsPlan,
} from './deviceGrant/tls-pin.js';

export function derToPemCertificate(der: Uint8Array): string {
	const b64 = Buffer.from(der).toString('base64');
	const lines = b64.match(/.{1,64}/g) ?? [];
	return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

export function createPinnedTlsSecureContext(tlsPlan: PinnedTlsPlanInput): tls.SecureContext {
	const verified = verifyPinnedTlsPlan(tlsPlan);
	if (!verified.ok) {
		throw new Error(verified.reason);
	}
	return tls.createSecureContext({
		ca: derToPemCertificate(tlsPlan.trustAnchorLeafDer),
	});
}

/**
 * TLS-only probe using the same pinned secure context as the gRPC channel (S21 mock tests).
 */
export function probePinnedTlsHandshake(input: {
	readonly host: string;
	readonly port: number;
	readonly tls: PinnedTlsPlanInput;
	readonly servername: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
	const verified = verifyPinnedTlsPlan(input.tls);
	if (!verified.ok) {
		return Promise.resolve({ ok: false, reason: verified.reason });
	}

	const secureContext = createPinnedTlsSecureContext(input.tls);
	const pinnedCheck = createPinnedServerIdentityCheck(input.tls.expectedLeafSha256Hex);

	return new Promise((resolve) => {
		const socket = tls.connect({
			host: input.host,
			port: input.port,
			servername: input.servername.trim(),
			secureContext,
			checkServerIdentity: (_hostname, certificate) => {
				const raw = certificate?.raw;
				if (!raw || raw.length === 0) {
					return new Error('Engine TLS peer certificate missing');
				}
				return pinnedCheck({ raw: Uint8Array.from(raw) });
			},
			ALPNProtocols: ['h2'],
		}, () => {
			socket.destroy();
			resolve({ ok: true });
		});

		socket.on('error', (err) => {
			resolve({ ok: false, reason: err.message });
		});
	});
}
