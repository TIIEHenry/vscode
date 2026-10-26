/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetQueueRequest, UniverseAgentQueueState, UniverseAgentSaveSkillContentRequest, UniverseAgentSaveSkillContentResult } from '../../common/universeAgentTypes.js';
import { allLengthDelimited, encodeInt32Field, encodePresentMessageField, encodeStringField, lastString, lastVarint, readProtoFields } from './grpcProtoCodec.js';

type Fields = ReturnType<typeof readProtoFields>;
function enumValue<T extends string>(fields: Fields, tag: number, values: readonly T[]): T {
	const value = Number(lastVarint(fields, tag) ?? 0n);
	if (!Number.isSafeInteger(value) || !values[value]) { throw new Error(`Unknown queue enum at field ${tag}`); }
	return values[value];
}
function int64(fields: Fields, tag: number): string {
	const value = lastVarint(fields, tag) ?? 0n;
	if (value < 0n || value > 0x7fffffffffffffffn) { throw new Error(`Invalid queue int64 at field ${tag}`); }
	return value.toString();
}
function int32(fields: Fields, tag: number): number {
	const value = lastVarint(fields, tag) ?? 0n;
	if (value < 0n || value > 0x7fffffffn) { throw new Error(`Invalid queue count at field ${tag}`); }
	return Number(value);
}

export function encodeGetQueueRequest(request: UniverseAgentGetQueueRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

export function decodeQueueState(bytes: Uint8Array): UniverseAgentQueueState {
	const fields = readProtoFields(bytes);
	const items = allLengthDelimited(fields, 1).map(bytes => {
		const fields = readProtoFields(bytes);
		const id = lastString(fields, 1) ?? '';
		if (!id) { throw new Error('Queue item id is missing'); }
		const status = enumValue(fields, 5, ['UNSPECIFIED', 'UPLOADING', 'UPLOAD_FAILED', 'PENDING', 'SENDING', 'FAILED'] as const);
		if (status === 'UNSPECIFIED') { throw new Error('Queue item status is missing'); }
		const hold = enumValue(fields, 6, ['NONE', 'EDITING'] as const);
		const progressField = [...fields].reverse().find(field => field.field === 7 && field.wireType === 5);
		const uploadProgress = progressField?.wireType === 5 ? Buffer.from(progressField.fixed32).readFloatLE(0) : 0;
		if (!Number.isFinite(uploadProgress) || uploadProgress < 0 || uploadProgress > 1) { throw new Error('Invalid upload progress'); }
		return {
			id, clientMessageId: lastString(fields, 2) ?? '', text: lastString(fields, 3) ?? '', createdAt: int64(fields, 4),
			status, hold: hold === 'NONE' ? undefined : hold, uploadProgress, retryCount: int32(fields, 8), lastError: lastString(fields, 9),
			priority: enumValue(fields, 10, ['NORMAL', 'HIGH', 'LOW'] as const), pinned: lastVarint(fields, 11) === 1n, locked: lastVarint(fields, 12) === 1n,
			forkFromTurnId: lastString(fields, 13), forkFromPreview: lastString(fields, 14), version: int32(fields, 15),
			uploadTotalCount: int32(fields, 16), uploadCompletedCount: int32(fields, 17),
		};
	});
	if (new Set(items.map(item => item.id)).size !== items.length) { throw new Error('Duplicate queue item id'); }
	return { items, isPaused: lastVarint(fields, 2) === 1n, pauseReason: enumValue(fields, 3, ['NONE', 'MANUAL', 'STOP', 'LOCK'] as const),
		lockBlockedItemId: lastString(fields, 4), opId: lastString(fields, 5), isProcessing: lastVarint(fields, 6) === 1n, version: int64(fields, 7) };
}

export function encodeSaveSkillContentRequest(request: UniverseAgentSaveSkillContentRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.skillName), encodeStringField(2, request.content), encodeInt32Field(3, request.create ? 1 : 0),
		...(!request.create ? [encodeStringField(4, request.expectedSource), encodePresentMessageField(5, Buffer.from(request.expectedContent, 'utf8'))] : []),
	]);
}

export function decodeSaveSkillContentResponse(bytes: Uint8Array): UniverseAgentSaveSkillContentResult {
	const fields = readProtoFields(bytes);
	return { ok: lastVarint(fields, 1) === 1n, reason: lastString(fields, 2) };
}
