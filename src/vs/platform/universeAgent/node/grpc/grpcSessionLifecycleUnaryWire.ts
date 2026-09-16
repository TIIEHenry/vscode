/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentExportSessionRequest,
	UniverseAgentPrewarmSessionsRequest,
	UniverseAgentPurgeSessionRequest,
	UniverseAgentShelveSessionRequest,
	UniverseAgentUnshelveSessionRequest,
} from '../../common/universeAgentTypes.js';
import type {
	ExportSessionResponseWire,
	PrewarmSessionEntryWire,
	PrewarmSessionsResponseWire,
	PurgeSessionResponseWire,
	ShelveSessionResponseWire,
	UnshelveSessionResponseWire,
} from './grpcClientMappersSession.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * SessionService.Prewarm — repeated `session_ids`=1 (repeated length-delimited field 1).
 * proto3: empty strings omitted.
 */
export function encodePrewarmSessionsRequest(request: UniverseAgentPrewarmSessionsRequest): Uint8Array {
	return Buffer.concat(request.sessionIds.map(sessionId => encodeStringField(1, sessionId)));
}

/**
 * PrewarmSessionsResponse — repeated `entries`=1.
 * PrewarmSessionEntry: `session_id`=1 `outcome`=2 `message`=3.
 * PrewarmSessionOutcomeProto: UNSPECIFIED=0 ALREADY_RESTORED=1 RESTORED=2 SKIPPED=3 FAILED=4.
 * proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `mapPrewarmSessionsResponse` input.
 */
export function decodePrewarmSessionsResponse(bytes: Uint8Array): PrewarmSessionsResponseWire {
	return {
		entries: allLengthDelimited(readProtoFields(bytes), 1).map(decodePrewarmSessionEntry),
	};
}

function decodePrewarmSessionEntry(bytes: Uint8Array): PrewarmSessionEntryWire {
	const fields = readProtoFields(bytes);
	return {
		session_id: lastString(fields, 1),
		outcome: numberOrUndefined(lastVarint(fields, 2)),
		message: lastString(fields, 3),
	};
}

/**
 * SessionService.Shelve — `session_id`=1.
 * proto3: empty string omitted.
 */
export function encodeShelveSessionRequest(request: UniverseAgentShelveSessionRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

/**
 * ShelveSessionResponse — `success`=1 `message`=2.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches `mapShelveSessionResponse` input.
 */
export function decodeShelveSessionResponse(bytes: Uint8Array): ShelveSessionResponseWire {
	return decodeSuccessMessage(bytes);
}

/**
 * SessionService.Unshelve — `session_id`=1.
 * proto3: empty string omitted.
 */
export function encodeUnshelveSessionRequest(request: UniverseAgentUnshelveSessionRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

/**
 * UnshelveSessionResponse — `success`=1 `message`=2.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches `mapUnshelveSessionResponse` input.
 */
export function decodeUnshelveSessionResponse(bytes: Uint8Array): UnshelveSessionResponseWire {
	return decodeSuccessMessage(bytes);
}

/**
 * SessionService.Purge — `session_id`=1.
 * proto3: empty string omitted.
 */
export function encodePurgeSessionRequest(request: UniverseAgentPurgeSessionRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

/**
 * PurgeSessionResponse — `success`=1 `message`=2.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches `mapPurgeSessionResponse` input.
 */
export function decodePurgeSessionResponse(bytes: Uint8Array): PurgeSessionResponseWire {
	return decodeSuccessMessage(bytes);
}

/**
 * SessionService.Export — `session_id`=1 `format`=2.
 * proto3: empty strings omitted.
 */
export function encodeExportSessionRequest(request: UniverseAgentExportSessionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.format),
	]);
}

/**
 * ExportSessionResponse — `content`=1 `format`=2.
 * proto3: empty strings omitted. Unknown fields unread.
 * Shape matches `mapExportSessionResponse` input.
 */
export function decodeExportSessionResponse(bytes: Uint8Array): ExportSessionResponseWire {
	const fields = readProtoFields(bytes);
	return {
		content: lastString(fields, 1),
		format: lastString(fields, 2),
	};
}

function decodeSuccessMessage(bytes: Uint8Array): ShelveSessionResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
