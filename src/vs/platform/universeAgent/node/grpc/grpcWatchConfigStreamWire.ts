/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentWatchConfigRequest } from '../../common/universeAgentTypes.js';
import type { ConfigChangedEventWire } from './grpcClientMappersSession.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * ConfigService.Watch — repeated `keys`=1.
 * Empty `keys` is an empty payload (engine watches all). Empty string keys omitted.
 */
export function encodeWatchConfigRequest(request: UniverseAgentWatchConfigRequest): Uint8Array {
	return Buffer.concat(request.keys.map(key => encodeStringField(1, key)));
}

/**
 * ConfigChangedEvent — `key`=1 `old_value`=2 `new_value`=3 `scope`=4 `timestamp`=5.
 * proto3: absent string/0 omitted on the wire; present empty string and explicit 0 are kept.
 * Unknown fields unread. Shape matches the existing mapper.
 */
export function decodeConfigChangedEvent(bytes: Uint8Array): ConfigChangedEventWire {
	const fields = readProtoFields(bytes);
	const key = lastString(fields, 1);
	const oldValue = lastString(fields, 2);
	const newValue = lastString(fields, 3);
	const scope = lastString(fields, 4);
	const timestamp = lastVarint(fields, 5);
	return {
		...(key !== undefined ? { key } : {}),
		...(oldValue !== undefined ? { old_value: oldValue } : {}),
		...(newValue !== undefined ? { new_value: newValue } : {}),
		...(scope !== undefined ? { scope } : {}),
		...(timestamp !== undefined ? { timestamp: Number(timestamp) } : {}),
	};
}
