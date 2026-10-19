/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentDeleteModelRequest,
	UniverseAgentDeleteModelResult,
	UniverseAgentSetModelEnabledRequest,
	UniverseAgentUpsertModelRequest,
} from '../../common/universeAgentTypes.js';
import { decodeModelEntryWire, type ModelEntryWire } from './grpcCatalogUnaryWire.js';
import { encodeInt32Field, encodePresentMessageField, encodeStringField, lastVarint, readProtoFields } from './grpcProtoCodec.js';

export function encodeModelEntry(request: UniverseAgentUpsertModelRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.id),
		encodeStringField(2, request.type),
		encodeInt32Field(3, request.enabled ? 1 : undefined),
		encodeInt32Field(4, request.level > 0 ? request.level : undefined),
		encodeStringField(5, request.description),
		encodeStringField(6, request.cost),
		encodeStringField(7, request.speed),
		encodeStringField(8, request.provider),
		encodeStringField(9, request.modelId),
	]);
}

export function encodeUpsertModelRequest(request: UniverseAgentUpsertModelRequest): Uint8Array {
	return encodePresentMessageField(1, encodeModelEntry(request));
}

export function decodeModelEntryResponse(bytes: Uint8Array): ModelEntryWire {
	return decodeModelEntryWire(bytes);
}

export function encodeDeleteModelRequest(request: UniverseAgentDeleteModelRequest): Uint8Array {
	return encodeStringField(1, request.id);
}

export function decodeDeleteModelResponse(bytes: Uint8Array): UniverseAgentDeleteModelResult {
	return { deleted: lastVarint(readProtoFields(bytes), 1) === 1n };
}

export function encodeSetModelEnabledRequest(request: UniverseAgentSetModelEnabledRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.id),
		encodeInt32Field(2, request.enabled ? 1 : undefined),
	]);
}
