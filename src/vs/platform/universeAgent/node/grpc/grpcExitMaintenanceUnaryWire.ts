/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentExitMaintenanceRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.ExitMaintenanceResponse.
 * Mapper: `success: wire.success === true`.
 */
export interface ExitMaintenanceResponseWire {
	readonly success?: boolean;
}

/**
 * RemoteAgentService.ExitMaintenance — `node_id`=1.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeExitMaintenanceRequest(request: UniverseAgentExitMaintenanceRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.nodeId),
	]);
}

/**
 * ExitMaintenanceResponse — `success`=1.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches ExitMaintenanceResponseWire `{ success?: boolean }`.
 */
export function decodeExitMaintenanceResponse(bytes: Uint8Array): ExitMaintenanceResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
	};
}
