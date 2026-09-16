/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentSendShellSessionClientControlRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.SendShellSessionClientControlResponse.
 * Mapper (call site): `ok: wire.success === true`, `message: wire.error_message`,
 * `errorCode: wire.error_code`, `debounced: wire.debounced`,
 * `deliveredToSubscribe: wire.delivered_to_subscribe`.
 */
export interface SendShellSessionClientControlResponseWire {
	readonly success?: boolean;
	readonly error_message?: string;
	readonly error_code?: string;
	readonly debounced?: boolean;
	readonly delivered_to_subscribe?: boolean;
}

/**
 * AgentService.SendShellSessionClientControl — `session_id`=1 `tool_call_id`=2
 * `ref_id`=3 `control_payload_json`=4.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeSendShellSessionClientControlRequest(request: UniverseAgentSendShellSessionClientControlRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.toolCallId),
		encodeStringField(3, request.refId),
		encodeStringField(4, request.controlPayloadJson),
	]);
}

/**
 * SendShellSessionClientControlResponse — `success`=1 `error_message`=2
 * `error_code`=3 `debounced`=4 `delivered_to_subscribe`=5.
 * proto3: false / empty / 0 omitted. Unknown fields unread.
 * Shape matches `{ success?: boolean; error_message?: string; error_code?: string; debounced?: boolean; delivered_to_subscribe?: boolean }`.
 */
export function decodeSendShellSessionClientControlResponse(bytes: Uint8Array): SendShellSessionClientControlResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	const debounced = lastVarint(fields, 4);
	const deliveredToSubscribe = lastVarint(fields, 5);
	return {
		success: success === undefined ? undefined : success === 1n,
		error_message: lastString(fields, 2),
		error_code: lastString(fields, 3),
		debounced: debounced === undefined ? undefined : debounced === 1n,
		delivered_to_subscribe: deliveredToSubscribe === undefined ? undefined : deliveredToSubscribe === 1n,
	};
}
