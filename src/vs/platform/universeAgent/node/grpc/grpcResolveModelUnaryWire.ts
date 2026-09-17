/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentResolveModelRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of ConfigService.ResolveModelResponse.
 * Nested `selected`=1 `candidates`=2 `filtered`=3 are ModelEntryProto
 * (`id`=1 `type`=2 `enabled`=3 `level`=4 `description`=5 `cost`=6
 * `speed`=7 `provider`=8 `model_id`=9). Unknown fields unread.
 * Shape matches catalog `ResolveModelResponseWire` / `mapResolveModelResponse`.
 */
export interface ResolveModelEntryWire {
	readonly id?: string;
	readonly type?: string;
	readonly enabled?: boolean;
	readonly level?: number;
	readonly description?: string;
	readonly cost?: string;
	readonly speed?: string;
	readonly provider?: string;
	readonly model_id?: string;
}

export interface ResolveModelResponseWire {
	readonly selected?: ResolveModelEntryWire;
	readonly candidates?: readonly ResolveModelEntryWire[];
	readonly filtered?: readonly ResolveModelEntryWire[];
}

/**
 * ConfigService.ResolveModel — `session_id`=1 `type`=2.
 * proto3: empty strings omitted.
 */
export function encodeResolveModelRequest(request: UniverseAgentResolveModelRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.type),
	]);
}

/**
 * ResolveModelResponse — nested `selected`=1 `candidates`=2 `filtered`=3
 * ModelEntryProto (`id`=1 `type`=2 `enabled`=3 `level`=4 `description`=5
 * `cost`=6 `speed`=7 `provider`=8 `model_id`=9). proto3: empty / 0 omitted.
 * Unknown fields unread. Missing selected omitted; missing repeated → `[]`.
 * Shape matches `mapResolveModelResponse`.
 */
export function decodeResolveModelResponse(bytes: Uint8Array): ResolveModelResponseWire {
	const fields = readProtoFields(bytes);
	const selected = lastBytes(fields, 1);
	return {
		...(selected ? { selected: decodeModelEntry(selected) } : {}),
		candidates: allLengthDelimited(fields, 2).map(decodeModelEntry),
		filtered: allLengthDelimited(fields, 3).map(decodeModelEntry),
	};
}

/** ModelEntryProto — same field numbers as catalog `decodeModelEntry`. */
function decodeModelEntry(bytes: Uint8Array): ResolveModelEntryWire {
	const fields = readProtoFields(bytes);
	const level = lastVarint(fields, 4);
	return {
		id: lastString(fields, 1) ?? '',
		type: lastString(fields, 2) ?? '',
		enabled: lastVarint(fields, 3) === 1n,
		level: level === undefined ? undefined : Number(level),
		description: lastString(fields, 5),
		cost: lastString(fields, 6),
		speed: lastString(fields, 7),
		provider: lastString(fields, 8),
		model_id: lastString(fields, 9),
	};
}
