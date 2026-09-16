/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentPruneRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.PruneResponse.
 * Mapper: `mapPruneResponse` → `ok` / `message` / `removedCount`.
 */
export interface PruneResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly removed_count?: number;
}

/**
 * AgentService.Prune — `session_id`=1 `agent_id`=2.
 * proto3: empty strings omitted.
 */
export function encodePruneRequest(request: UniverseAgentPruneRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * PruneResponse — `success`=1 `message`=2 `removed_count`=3.
 * proto3: false / empty / 0 omitted. Unknown fields unread.
 * Shape matches `mapPruneResponse` (`ok: wire.success === true`).
 */
export function decodePruneResponse(bytes: Uint8Array): PruneResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		removed_count: numberOrUndefined(lastVarint(fields, 3)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
