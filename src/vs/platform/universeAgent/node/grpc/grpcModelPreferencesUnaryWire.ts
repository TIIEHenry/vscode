/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentGetModelPreferencesRequest,
	UniverseAgentSetModelPreferencesRequest,
} from '../../common/universeAgentTypes.js';
import {
	encodeInt32Field,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of ConfigService.GetModelPreferencesResponse.
 * Mapper: `minLevel: wire.min_level ?? 0`.
 */
export interface GetModelPreferencesResponseWire {
	readonly min_level?: number;
	readonly max_cost?: string;
	readonly min_speed?: string;
	readonly strategy?: string;
}

/**
 * JSON-shaped decode of ConfigService.SetModelPreferencesResponse.
 * Nested `preferences`=1 is length-delimited GetModelPreferencesResponse.
 */
export interface SetModelPreferencesResponseWire {
	readonly preferences?: GetModelPreferencesResponseWire;
}

/**
 * ConfigService.GetModelPreferences — `session_id`=1.
 * proto3: empty string omitted.
 */
export function encodeGetModelPreferencesRequest(request: UniverseAgentGetModelPreferencesRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
	]);
}

/**
 * GetModelPreferencesResponse — `min_level`=1 `max_cost`=2 `min_speed`=3 `strategy`=4.
 * proto3: 0 / empty omitted. Unknown fields unread.
 */
export function decodeGetModelPreferencesResponse(bytes: Uint8Array): GetModelPreferencesResponseWire {
	const fields = readProtoFields(bytes);
	return {
		min_level: numberOrUndefined(lastVarint(fields, 1)),
		max_cost: lastString(fields, 2),
		min_speed: lastString(fields, 3),
		strategy: lastString(fields, 4),
	};
}

/**
 * ConfigService.SetModelPreferences — `session_id`=1 optional `min_level`=2
 * `max_cost`=3 `min_speed`=4 `strategy`=5.
 * proto3: empty strings omitted; `min_level` 0 omitted (`encodeInt32Field`).
 */
export function encodeSetModelPreferencesRequest(request: UniverseAgentSetModelPreferencesRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeInt32Field(2, request.minLevel),
		encodeStringField(3, request.maxCost),
		encodeStringField(4, request.minSpeed),
		encodeStringField(5, request.strategy),
	]);
}

/**
 * SetModelPreferencesResponse — length-delimited `preferences`=1
 * (nested GetModelPreferencesResponse). Unknown fields unread.
 */
export function decodeSetModelPreferencesResponse(bytes: Uint8Array): SetModelPreferencesResponseWire {
	const fields = readProtoFields(bytes);
	const nested = lastBytes(fields, 1);
	return {
		preferences: nested === undefined ? undefined : decodeGetModelPreferencesResponse(nested),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
