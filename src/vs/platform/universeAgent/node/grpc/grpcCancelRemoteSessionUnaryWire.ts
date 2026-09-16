/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentCancelRemoteSessionRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.CancelRemoteSessionResponse.
 * Mapper: `success: wire.success === true`, `callId`, `status`, `message`.
 */
export interface CancelRemoteSessionResponseWire {
	readonly success?: boolean;
	readonly call_id?: string;
	readonly status?: string;
	readonly message?: string;
}

/**
 * RemoteAgentService.CancelRemoteSession — `call_id`=1 `reason`=2.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeCancelRemoteSessionRequest(request: UniverseAgentCancelRemoteSessionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.callId),
		encodeStringField(2, request.reason),
	]);
}

/**
 * CancelRemoteSessionResponse — `success`=1 `call_id`=2 `status`=3 `message`=4.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches CancelRemoteSessionResponseWire
 * `{ success?: boolean; call_id?: string; status?: string; message?: string }`.
 */
export function decodeCancelRemoteSessionResponse(bytes: Uint8Array): CancelRemoteSessionResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		call_id: lastString(fields, 2),
		status: lastString(fields, 3),
		message: lastString(fields, 4),
	};
}
