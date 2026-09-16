/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentRunToolInBackgroundRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.RunToolInBackgroundResponse.
 * Mapper: `ok: wire.success === true`.
 */
export interface RunToolInBackgroundResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly reason_code?: string;
}

/**
 * AgentService.RunToolInBackground — `session_id`=1 `agent_id`=2 `tool_call_id`=3.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeRunToolInBackgroundRequest(request: UniverseAgentRunToolInBackgroundRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.toolCallId),
	]);
}

/**
 * RunToolInBackgroundResponse — `success`=1 `message`=2 `reason_code`=3.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches runToolInBackground JSON `{ success?: boolean; message?: string; reason_code?: string }`.
 */
export function decodeRunToolInBackgroundResponse(bytes: Uint8Array): RunToolInBackgroundResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		reason_code: lastString(fields, 3),
	};
}
