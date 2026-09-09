/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as grpc from '@grpc/grpc-js';
import { grpcSslTargetNameOverride } from './deviceGrant/observe-candidate-leaf.js';
import { createPinnedServerIdentityCheck, type PinnedTlsPlanInput, verifyPinnedTlsPlan } from './deviceGrant/tls-pin.js';
import { createPinnedTlsSecureContext } from './pinnedTlsChannel.js';

export type UniverseAgentPinnedTlsTarget = {
	readonly address: string;
	readonly tls: PinnedTlsPlanInput;
	readonly sslTargetNameOverride: string;
};

let grpcModule: typeof grpc | undefined;

/**
 * `@grpc/grpc-js` pulls in a large native addon that nothing needs until the
 * user dials an engine, and `code/electron-main/app.ts` reaches this module
 * through the electron-main service graph — a static import would put that
 * cost on main-process startup. Every path that creates a transport awaits
 * this first.
 */
export async function loadGrpcModule(): Promise<void> {
	grpcModule ??= await import('@grpc/grpc-js');
}

export function loadedGrpcModule(): typeof grpc {
	if (!grpcModule) {
		throw new Error('@grpc/grpc-js is not loaded yet: await loadGrpcModule() before creating a transport');
	}
	return grpcModule;
}

export function createPinnedTlsChannelCredentials(tlsPlan: PinnedTlsPlanInput): grpc.ChannelCredentials {
	const secureContext = createPinnedTlsSecureContext(tlsPlan);
	const pinnedCheck = createPinnedServerIdentityCheck(tlsPlan.expectedLeafSha256Hex);
	return loadedGrpcModule().credentials.createFromSecureContext(secureContext, {
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
	return {
		'grpc.ssl_target_name_override': grpcSslTargetNameOverride(sslTargetNameOverride),
	};
}

export function createPinnedUniverseAgentGrpcClient(target: UniverseAgentPinnedTlsTarget): grpc.Client {
	const verified = verifyPinnedTlsPlan(target.tls);
	if (!verified.ok) {
		throw new Error(verified.reason);
	}
	return new (loadedGrpcModule().Client)(
		target.address,
		createPinnedTlsChannelCredentials(target.tls),
		createPinnedChannelOptions(target.sslTargetNameOverride),
	);
}

export { derToPemCertificate, createPinnedTlsSecureContext, probePinnedTlsHandshake } from './pinnedTlsChannel.js';
