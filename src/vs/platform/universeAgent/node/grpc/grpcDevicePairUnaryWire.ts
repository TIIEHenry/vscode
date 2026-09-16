/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentPairApproveRequest,
	UniverseAgentPairRejectRequest,
	UniverseAgentRotateTokenRequest,
} from '../../common/universeAgentTypes.js';
import type {
	ListPendingResponseWire,
	PairApproveResponseWire,
	PairRejectResponseWire,
	PendingPairInfoWire,
	RotateTokenResponseWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * DeviceService.PairApprove — `pairing_code`=1 `display_name`=2 `role`=3.
 * proto3: empty strings omitted.
 */
export function encodePairApproveRequest(request: UniverseAgentPairApproveRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.pairingCode),
		encodeStringField(2, request.displayName),
		encodeStringField(3, request.role),
	]);
}

/**
 * PairApproveResponse — `success`=1 `device_id`=2 reserved 3 unread `message`=4.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches `mapPairApproveResponse` input.
 */
export function decodePairApproveResponse(bytes: Uint8Array): PairApproveResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		device_id: lastString(fields, 2),
		message: lastString(fields, 4),
	};
}

/**
 * DeviceService.PairReject — `pairing_code`=1.
 * proto3: empty string omitted.
 */
export function encodePairRejectRequest(request: UniverseAgentPairRejectRequest): Uint8Array {
	return encodeStringField(1, request.pairingCode);
}

/**
 * PairRejectResponse — `success`=1 `message`=2.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches `mapPairRejectResponse` input.
 */
export function decodePairRejectResponse(bytes: Uint8Array): PairRejectResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}

/**
 * DeviceService.RotateToken — `device_id`=1.
 * proto3: empty string omitted. Reserved 2 is never encoded.
 */
export function encodeRotateTokenRequest(request: UniverseAgentRotateTokenRequest): Uint8Array {
	return encodeStringField(1, request.deviceId);
}

/**
 * RotateTokenResponse — `success`=1 reserved 2 unread `message`=3.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches `mapRotateTokenResponse` input.
 */
export function decodeRotateTokenResponse(bytes: Uint8Array): RotateTokenResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 3),
	};
}

/**
 * DeviceService.ListPending — `ListPendingRequest` is empty (no fields).
 * proto3 empty message: 0 payload bytes, never JSON `{}`.
 */
export function encodeListPendingRequest(): Uint8Array {
	return new Uint8Array(0);
}

/**
 * ListPendingResponse — repeated `pending`=1.
 * PendingPairInfo: `pairing_code`=1 `device_id`=2 `display_name`=3
 * `platform`=4 `requested_at`=5 `expires_in_seconds`=6.
 * proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `mapListPendingResponse` input.
 */
export function decodeListPendingResponse(bytes: Uint8Array): ListPendingResponseWire {
	return {
		pending: allLengthDelimited(readProtoFields(bytes), 1).map(decodePendingPairInfo),
	};
}

function decodePendingPairInfo(bytes: Uint8Array): PendingPairInfoWire {
	const fields = readProtoFields(bytes);
	return {
		pairing_code: lastString(fields, 1),
		device_id: lastString(fields, 2),
		display_name: lastString(fields, 3),
		platform: lastString(fields, 4),
		requested_at: numberOrUndefined(lastVarint(fields, 5)),
		expires_in_seconds: numberOrUndefined(lastVarint(fields, 6)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
