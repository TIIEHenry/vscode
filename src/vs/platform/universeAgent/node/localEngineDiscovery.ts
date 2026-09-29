/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createLoopbackTlsGrpcClient } from './grpc/grpcClient.js';
import { loadGrpcModule } from './universeAgentChannel.js';

/**
 * Debug pin first, then the engine's own default. The first port whose
 * HealthCheck succeeds is the local engine.
 */
export const LOCAL_ENGINE_PROBE_PORTS = [50061, 50051] as const;

export const LOCAL_ENGINE_PROBE_DEADLINE_MS = 800;

export type LocalEnginePortProbe = (port: number) => Promise<boolean>;

/**
 * Returns the first loopback port that answers, in candidate order.
 */
export async function findLocalEnginePort(
	probe: LocalEnginePortProbe,
	ports: readonly number[] = LOCAL_ENGINE_PROBE_PORTS,
): Promise<number | undefined> {
	for (const port of ports) {
		if (await probe(port)) {
			return port;
		}
	}
	return undefined;
}

/**
 * HealthCheck over TLS without a leaf pin. A refused or non-engine port is a miss.
 */
export async function probeLocalEnginePort(port: number, timeoutMs = LOCAL_ENGINE_PROBE_DEADLINE_MS): Promise<boolean> {
	await loadGrpcModule();
	const client = createLoopbackTlsGrpcClient(`127.0.0.1:${port}`, timeoutMs);
	try {
		await client.healthCheck();
		return true;
	} catch {
		return false;
	} finally {
		client.close();
	}
}
