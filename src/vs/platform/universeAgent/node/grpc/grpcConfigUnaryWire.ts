/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentGetConfigRequest,
	UniverseAgentSetConfigRequest,
} from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON wire for ConfigService.Get — matches grpcClient `getConfig` unary:
 * `{ values?: Record<string, string>; scope?: string }`.
 */
export interface GetConfigResponseWire {
	readonly values?: Record<string, string>;
	readonly scope?: string;
}

/**
 * JSON wire for ConfigService.Set — matches grpcClient `setConfig` unary:
 * `{ success?: boolean; message?: string }`.
 */
export interface SetConfigResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * ConfigService.Get — `key`=1 `scope`=2 `session_id`=3.
 * proto3: empty strings omitted.
 */
export function encodeGetConfigRequest(request: UniverseAgentGetConfigRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.key),
		encodeStringField(2, request.scope),
		encodeStringField(3, request.sessionId),
	]);
}

/**
 * GetConfigResponse — map `values`=1 (MapEntry `key`=1 `value`=2) `scope`=2.
 * Unknown fields unread. Shape matches grpcClient JSON mapper input.
 */
export function decodeGetConfigResponse(bytes: Uint8Array): GetConfigResponseWire {
	const fields = readProtoFields(bytes);
	return {
		values: decodeStringStringMap(allLengthDelimited(fields, 1)),
		scope: lastString(fields, 2),
	};
}

/**
 * ConfigService.Set — `key`=1 `value`=2 `scope`=3 `session_id`=4.
 * proto3: empty strings omitted.
 */
export function encodeSetConfigRequest(request: UniverseAgentSetConfigRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.key),
		encodeStringField(2, request.value),
		encodeStringField(3, request.scope),
		encodeStringField(4, request.sessionId),
	]);
}

/**
 * SetConfigResponse — `success`=1 `message`=2.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches grpcClient JSON `{ success, message }` (`ok: wire.success === true`).
 */
export function decodeSetConfigResponse(bytes: Uint8Array): SetConfigResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}

/** proto3 `map<string,string>` = repeated MapEntry (`key`=1 `value`=2). */
function decodeStringStringMap(entries: readonly Uint8Array[]): Record<string, string> | undefined {
	if (entries.length === 0) {
		return undefined;
	}
	const values: Record<string, string> = {};
	for (const entry of entries) {
		const fields = readProtoFields(entry);
		const key = lastString(fields, 1);
		if (!key) {
			continue;
		}
		values[key] = lastString(fields, 2) ?? '';
	}
	return values;
}
