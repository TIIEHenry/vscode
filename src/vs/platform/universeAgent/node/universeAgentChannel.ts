/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as grpc from '@grpc/grpc-js';
import { createPinnedServerIdentityCheck, type PinnedTlsPlanInput, verifyPinnedTlsPlan } from './deviceGrant/tls-pin.js';
import { createPinnedTlsSecureContext, derToPemCertificate } from './pinnedTlsChannel.js';

export type UniverseAgentPinnedTlsTarget = {
	readonly address: string;
	readonly tls: PinnedTlsPlanInput;
	readonly sslTargetNameOverride: string;
};

export function createPinnedTlsChannelCredentials(tlsPlan: PinnedTlsPlanInput): grpc.ChannelCredentials {
	const secureContext = createPinnedTlsSecureContext(tlsPlan);
	const pinnedCheck = createPinnedServerIdentityCheck(tlsPlan.expectedLeafSha256Hex);
	return grpc.credentials.createFromSecureContext(secureContext, {
		checkServerIdentity: (_hostname, certificate) => {
			const raw = certificate?.raw;
			if (!raw || raw.length === 0) {
				return new Error('Engine TLS peer certificate missing');
			}
			return pinnedCheck({ raw: Uint8Array.from(raw) });
		},
	});
}

export function createPinnedChannelOptions(sslTargetNameOverride: string): grpc.ChannelOptions {
	const trimmed = sslTargetNameOverride.trim();
	if (trimmed.length === 0) {
		return {};
	}
	return {
		'grpc.ssl_target_name_override': trimmed,
	};
}

export function createPinnedUniverseAgentGrpcClient(target: UniverseAgentPinnedTlsTarget): grpc.Client {
	const verified = verifyPinnedTlsPlan(target.tls);
	if (!verified.ok) {
		throw new Error(verified.reason);
	}
	return new grpc.Client(
		target.address,
		createPinnedTlsChannelCredentials(target.tls),
		createPinnedChannelOptions(target.sslTargetNameOverride),
	);
}

export { derToPemCertificate, createPinnedTlsSecureContext, probePinnedTlsHandshake } from './pinnedTlsChannel.js';
