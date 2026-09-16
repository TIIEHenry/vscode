/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentSetMaintenanceRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.SetMaintenanceResponse.
 * Mapper: `success: wire.success === true`.
 */
export interface SetMaintenanceResponseWire {
	readonly success?: boolean;
}

/**
 * RemoteAgentService.SetMaintenance — `node_id`=1.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeSetMaintenanceRequest(request: UniverseAgentSetMaintenanceRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.nodeId),
	]);
}

/**
 * SetMaintenanceResponse — `success`=1.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches SetMaintenanceResponseWire `{ success?: boolean }`.
 */
export function decodeSetMaintenanceResponse(bytes: Uint8Array): SetMaintenanceResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
	};
}
