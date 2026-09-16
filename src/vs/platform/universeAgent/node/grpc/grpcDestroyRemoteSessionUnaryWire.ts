/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentDestroyRemoteSessionRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.DestroyRemoteSessionResponse.
 * Mapper: `success: wire.success === true`, `message: wire.message ?? ''`
 * (mapDestroyRemoteSessionResponse).
 */
export interface DestroyRemoteSessionResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * RemoteAgentService.DestroyRemoteSession — `call_id`=1.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeDestroyRemoteSessionRequest(request: UniverseAgentDestroyRemoteSessionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.callId),
	]);
}

/**
 * DestroyRemoteSessionResponse — `success`=1 `message`=2.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches DestroyRemoteSessionResponseWire `{ success?: boolean; message?: string }`.
 */
export function decodeDestroyRemoteSessionResponse(bytes: Uint8Array): DestroyRemoteSessionResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}
