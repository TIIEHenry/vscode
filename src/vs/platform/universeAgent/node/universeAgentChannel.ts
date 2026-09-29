/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as grpc from '@grpc/grpc-js';
import { grpcSslTargetNameOverride } from './deviceGrant/observe-candidate-leaf.js';
import { createPinnedServerIdentityCheck, type PinnedTlsPlanInput, verifyPinnedTlsPlan } from './deviceGrant/tls-pin.js';
import { createPinnedTlsSecureContext } from './pinnedTlsChannel.js';

/** Above 2^31-1, Node timers collapse to 1ms. ~24.8 days; grpc-js idles only when callCount is 0. */
export const RELAY_CLIENT_IDLE_TIMEOUT_MS = 2_147_483_647;

export type UniverseAgentPinnedTlsTarget = {
	readonly address: string;
	readonly tls: PinnedTlsPlanInput;
	readonly sslTargetNameOverride: string;
	/** Hub relay dial. Short-lived pairing and probe transports omit this. */
	readonly relay?: boolean;
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

/**
 * TLS to a loopback engine that skips auth. The leaf is not pinned: the peer is
 * trusted because it is bound to loopback with Hub off, not because of SAS.
 */
export function createLoopbackTlsChannelCredentials(): grpc.ChannelCredentials {
	return loadedGrpcModule().credentials.createSsl(null, null, null, {
		rejectUnauthorized: false,
		checkServerIdentity: () => undefined,
	});
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

export function createPinnedChannelOptions(sslTargetNameOverride: string, relay = false): grpc.ChannelOptions {
	const options: grpc.ChannelOptions = {
		'grpc.ssl_target_name_override': grpcSslTargetNameOverride(sslTargetNameOverride),
	};
	if (relay) {
		options['grpc.client_idle_timeout_ms'] = RELAY_CLIENT_IDLE_TIMEOUT_MS;
	}
	return options;
}

export function createPinnedUniverseAgentGrpcClient(target: UniverseAgentPinnedTlsTarget): grpc.Client {
	const verified = verifyPinnedTlsPlan(target.tls);
	if (!verified.ok) {
		throw new Error(verified.reason);
	}
	return new (loadedGrpcModule().Client)(
		target.address,
		createPinnedTlsChannelCredentials(target.tls),
		createPinnedChannelOptions(target.sslTargetNameOverride, target.relay === true),
	);
}

export { derToPemCertificate, createPinnedTlsSecureContext, probePinnedTlsHandshake } from './pinnedTlsChannel.js';
