/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentDeleteRemoteAgentConfigRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.DeleteConfigResponse.
 * Mapper: `success: wire.success === true` (mapDeleteRemoteAgentConfigResponse).
 */
export interface DeleteRemoteAgentConfigResponseWire {
	readonly success?: boolean;
}

/**
 * RemoteAgentService.DeleteConfig — `node_id`=1.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeDeleteConfigRequest(request: UniverseAgentDeleteRemoteAgentConfigRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.nodeId),
	]);
}

/**
 * DeleteRemoteAgentConfigResponse — `success`=1.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches DeleteRemoteAgentConfigResponseWire `{ success?: boolean }`.
 */
export function decodeDeleteConfigResponse(bytes: Uint8Array): DeleteRemoteAgentConfigResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
	};
}
