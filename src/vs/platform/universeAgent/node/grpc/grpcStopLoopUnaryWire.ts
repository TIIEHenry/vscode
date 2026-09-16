/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentStopLoopRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.StopLoopResponse.
 * Mapper: `ok: wire.success === true` (stopLoop).
 */
export interface StopLoopResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * AgentService.StopLoop — `session_id`=1 `agent_id`=2 `detail`=3.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeStopLoopRequest(request: UniverseAgentStopLoopRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.detail),
	]);
}

/**
 * StopLoopResponse — `success`=1 `message`=2.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches stopLoop JSON `{ success?: boolean; message?: string }`.
 */
export function decodeStopLoopResponse(bytes: Uint8Array): StopLoopResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}
