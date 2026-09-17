/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentMemoryRebuildRequest } from '../../common/universeAgentTypes.js';
import type { MemoryRebuildEventWire } from './grpcClientMappersCatalog.js';
import {
	encodeInt32Field,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * MemoryService.Rebuild — `scope`=1 `dry_run`=2.
 * proto3: empty strings / false omitted.
 * Mapper for events: `mapMemoryRebuildEvent`.
 */
export function encodeMemoryRebuildRequest(request: UniverseAgentMemoryRebuildRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeInt32Field(2, request.dryRun === true ? 1 : 0),
	]);
}

/**
 * MemoryRebuildEvent — `phase`=1 `message`=2 `progress`=3
 * `files_processed`=4 `files_total`=5.
 * proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches existing `MemoryRebuildEventWire`.
 * Mapper: `mapMemoryRebuildEvent`.
 */
export function decodeMemoryRebuildEvent(bytes: Uint8Array): MemoryRebuildEventWire {
	const fields = readProtoFields(bytes);
	return {
		phase: lastString(fields, 1),
		message: lastString(fields, 2),
		progress: numberOrUndefined(lastVarint(fields, 3)),
		files_processed: numberOrUndefined(lastVarint(fields, 4)),
		files_total: numberOrUndefined(lastVarint(fields, 5)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
