/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentAnchorResolveScope,
	UniverseAgentEnvelopeAnchor,
	UniverseAgentResolveAnchorRequest,
	UniverseAgentResolveTurnRequest,
} from '../../common/universeAgentTypes.js';
import type {
	ResolveAnchorResponseWire,
	ResolveTurnExpiredWire,
	ResolveTurnHitWire,
	ResolveTurnResponseWire,
	ResolveTurnTombstoneWire,
} from './grpcClientMappersSession.js';
import { decodeMessageEnvelope } from './grpcSessionAttachWire.js';
import {
	encodeInt32Field,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * SessionService.ResolveTurn — `session_id`=1 `turn_id`=2 optional `current_leaf_turn_id`=3.
 * proto3: empty strings omitted (blank leaf ≡ absent at the store).
 */
export function encodeResolveTurnRequest(request: UniverseAgentResolveTurnRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.turnId),
		encodeStringField(3, request.currentLeafTurnId),
	]);
}

/**
 * ResolveTurnResponse oneof — `hit`=1 `tombstone`=2 `expired`=3.
 * Empty submessage is still that arm. Unknown fields unread.
 * `hit.envelope` is the existing GetHistory envelope object.
 */
export function decodeResolveTurnResponse(bytes: Uint8Array): ResolveTurnResponseWire {
	return decodeResolveResult(bytes);
}

/**
 * SessionService.ResolveAnchor — `anchor`=1 `scope`=2 optional `current_leaf_turn_id`=3.
 * Anchor submessage is always present. Scope 0 omitted. Optional generation 0 is present.
 * proto3: empty non-optional strings omitted.
 */
export function encodeResolveAnchorRequest(request: UniverseAgentResolveAnchorRequest): Uint8Array {
	return Buffer.concat([
		encodePresentMessageField(1, encodeEnvelopeAnchor(request.anchor)),
		encodeInt32Field(2, anchorResolveScope(request.scope)),
		encodeStringField(3, request.currentLeafTurnId),
	]);
}

/** Same oneof as ResolveTurnResponse. Shape matches the existing anchor mapper. */
export function decodeResolveAnchorResponse(bytes: Uint8Array): ResolveAnchorResponseWire {
	return decodeResolveResult(bytes);
}

function encodeEnvelopeAnchor(anchor: UniverseAgentEnvelopeAnchor): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, anchor.sessionId),
		encodeStringField(2, anchor.envelopeId),
		encodeOptionalInt64(3, anchor.generation),
	]);
}

function anchorResolveScope(scope: UniverseAgentAnchorResolveScope): number {
	switch (scope) {
		case 'ANCHOR_RESOLVE_SCOPE_ACTIVE':
			return 1;
		case 'ANCHOR_RESOLVE_SCOPE_OFF_PATH':
			return 2;
		case 'ANCHOR_RESOLVE_SCOPE_INCLUDING_ARCHIVED':
			return 3;
		default:
			return 0;
	}
}

/** Optional int64, including explicit 0 (absent means latest generation). */
function encodeOptionalInt64(field: number, value: number | undefined): Buffer {
	if (value === undefined) {
		return Buffer.alloc(0);
	}
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(value),
	]);
}

function decodeResolveResult(bytes: Uint8Array): ResolveTurnResponseWire {
	const fields = readProtoFields(bytes);
	const hit = lastBytes(fields, 1);
	const tombstone = lastBytes(fields, 2);
	const expired = lastBytes(fields, 3);
	return {
		...(hit !== undefined ? { hit: decodeHit(hit) } : {}),
		...(tombstone !== undefined ? { tombstone: decodeTombstone(tombstone) } : {}),
		...(expired !== undefined ? { expired: decodeExpired(expired) } : {}),
	};
}

/** AnchorHitProto — `envelope`=1 `presence`=2 optional `generation`=3. */
function decodeHit(bytes: Uint8Array): ResolveTurnHitWire {
	const fields = readProtoFields(bytes);
	const envelope = lastBytes(fields, 1);
	const presence = lastVarint(fields, 2);
	const generation = lastVarint(fields, 3);
	return {
		...(envelope !== undefined ? { envelope: decodeMessageEnvelope(envelope) } : {}),
		...(presence !== undefined ? { presence: Number(presence) } : {}),
		...(generation !== undefined ? { generation: Number(generation) } : {}),
	};
}

/** AnchorTombstoneProto — `session_id`=1 `envelope_id`=2 `seq`=3 optional `turn_id`=4 optional `generation`=5. */
function decodeTombstone(bytes: Uint8Array): ResolveTurnTombstoneWire {
	const fields = readProtoFields(bytes);
	const sessionId = lastString(fields, 1);
	const envelopeId = lastString(fields, 2);
	const seq = lastVarint(fields, 3);
	const turnId = lastString(fields, 4);
	const generation = lastVarint(fields, 5);
	return {
		...(sessionId !== undefined ? { session_id: sessionId } : {}),
		...(envelopeId !== undefined ? { envelope_id: envelopeId } : {}),
		...(seq !== undefined ? { seq: Number(seq) } : {}),
		...(turnId !== undefined ? { turn_id: turnId } : {}),
		...(generation !== undefined ? { generation: Number(generation) } : {}),
	};
}

/** AnchorExpiredProto — `anchor`=1 (EnvelopeAnchorProto). */
function decodeExpired(bytes: Uint8Array): ResolveTurnExpiredWire {
	const anchor = lastBytes(readProtoFields(bytes), 1);
	if (anchor === undefined) {
		return {};
	}
	const fields = readProtoFields(anchor);
	const sessionId = lastString(fields, 1);
	const envelopeId = lastString(fields, 2);
	const generation = lastVarint(fields, 3);
	return {
		anchor: {
			...(sessionId !== undefined ? { session_id: sessionId } : {}),
			...(envelopeId !== undefined ? { envelope_id: envelopeId } : {}),
			...(generation !== undefined ? { generation: Number(generation) } : {}),
		},
	};
}
