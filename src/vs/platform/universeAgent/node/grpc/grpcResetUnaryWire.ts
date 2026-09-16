/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentResetAgentRequest } from '../../common/universeAgentTypes.js';
import {
	encodeInt32Field,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.ResetResponse.
 * Mapper: `ok: wire.success === true`.
 */
export interface ResetResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * AgentService.Reset — `session_id`=1 `agent_id`=2 `clear_profile_only`=3 bool.
 * proto3: empty strings omitted. `clear_profile_only` false omitted;
 * `encodeInt32Field` 1 only when true.
 */
export function encodeResetRequest(request: UniverseAgentResetAgentRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		request.clearProfileOnly === true ? encodeInt32Field(3, 1) : Buffer.alloc(0),
	]);
}

/**
 * ResetResponse — `success`=1 `message`=2.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches JSON `{ success?: boolean; message?: string }`.
 */
export function decodeResetResponse(bytes: Uint8Array): ResetResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}
