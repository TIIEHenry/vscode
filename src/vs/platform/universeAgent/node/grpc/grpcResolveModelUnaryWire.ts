/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentResolveModelRequest } from '../../common/universeAgentTypes.js';
import { encodeStringField, readProtoFields } from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of ConfigService.ResolveModelResponse.
 * Nested `selected`=1 `candidates`=2 `filtered`=3 unread this slice
 * (no nested ModelEntry codecs). Decode returns `{}`.
 * Shape matches catalog `ResolveModelResponseWire` / `mapResolveModelResponse`.
 */
/** JSON ModelEntry shape only — no nested codec this slice. */
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
 * unread this slice (no nested ModelEntry codecs). Unknown fields unread.
 * Decode returns empty wire `{}` (no selected/candidates/filtered fields).
 * Shape matches `mapResolveModelResponse` (missing nested → no selected,
 * empty arrays).
 */
export function decodeResolveModelResponse(bytes: Uint8Array): ResolveModelResponseWire {
	readProtoFields(bytes);
	return {};
}
