/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { encodeEmptyProtoMessage } from './grpcCatalogUnaryWire.js';
import {
	allLengthDelimited,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.ReloadRemoteAgentsResponse.
 * Shape matches `ReloadRemoteAgentsResponseWire` /
 * TEST-only `mapReloadRemoteAgentsResponse`.
 */
export interface ReloadRemoteAgentsResponseWire {
	readonly success?: boolean;
	readonly added?: string[];
	readonly removed?: string[];
	readonly changed?: string[];
	readonly errors?: string[];
	readonly duration_ms?: number | string;
}

/**
 * RemoteAgentService.Reload — `ReloadRemoteAgentsRequest` is empty.
 * proto3 empty message: 0 payload bytes, never JSON `{}`.
 */
export function encodeReloadRemoteAgentsRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

/**
 * ReloadRemoteAgentsResponse — `success`=1 repeated `added`=2 `removed`=3
 * `changed`=4 `errors`=5 `duration_ms`=6 (lastVarint).
 * Collect repeated strings per field. proto3: empty / 0 / false omitted.
 * Unknown fields unread.
 * Shape matches `mapReloadRemoteAgentsResponse`.
 */
export function decodeReloadRemoteAgentsResponse(bytes: Uint8Array): ReloadRemoteAgentsResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		added: repeatedStrings(fields, 2),
		removed: repeatedStrings(fields, 3),
		changed: repeatedStrings(fields, 4),
		errors: repeatedStrings(fields, 5),
		duration_ms: numberOrUndefined(lastVarint(fields, 6)),
	};
}

function repeatedStrings(fields: ReturnType<typeof readProtoFields>, field: number): string[] {
	return allLengthDelimited(fields, field).map(value => Buffer.from(value).toString('utf8'));
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
