/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentBackRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.BackResponse.
 * Mapper: `mapBackResponse` (`ok: wire.success === true`).
 */
export interface BackResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly current_turn_id?: string;
}

/**
 * AgentService.Back — `session_id`=1 `agent_id`=2 `operation_id`=3.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeBackRequest(request: UniverseAgentBackRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.operationId),
	]);
}

/**
 * BackResponse — `success`=1 `message`=2 `current_turn_id`=3.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches `mapBackResponse`.
 */
export function decodeBackResponse(bytes: Uint8Array): BackResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		current_turn_id: lastString(fields, 3),
	};
}
