/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentResumeRemoteSessionRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.ResumeRemoteSessionResponse.
 * Shape matches ResumeRemoteSessionResponseWire (`success` / `call_id` /
 * `status` / `message` / `expires_at`). Mapper:
 * `mapResumeRemoteSessionResponse` (`expiresAt: requiredInt64(wire.expires_at)`).
 */
export interface ResumeRemoteSessionResponseWire {
	readonly success?: boolean;
	readonly call_id?: string;
	readonly status?: string;
	readonly message?: string;
	readonly expires_at?: number | string;
}

/**
 * RemoteAgentService.ResumeRemoteSession — `call_id`=1 `node_id`=2.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeResumeRemoteSessionRequest(request: UniverseAgentResumeRemoteSessionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.callId),
		encodeStringField(2, request.nodeId),
	]);
}

/**
 * ResumeRemoteSessionResponse — `success`=1 `call_id`=2 `status`=3
 * `message`=4 `expires_at`=5.
 * proto3: false / empty / 0 omitted. Unknown fields unread.
 * `expires_at` via lastVarint.
 */
export function decodeResumeRemoteSessionResponse(bytes: Uint8Array): ResumeRemoteSessionResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		call_id: lastString(fields, 2),
		status: lastString(fields, 3),
		message: lastString(fields, 4),
		expires_at: numberOrUndefined(lastVarint(fields, 5)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
