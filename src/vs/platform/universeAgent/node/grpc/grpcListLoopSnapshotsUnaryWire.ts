/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentListLoopSnapshotsRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.LoopSnapshotRecord (scalars only).
 * Shape matches `LoopSnapshotRecordWire` / `mapLoopSnapshotRecord`.
 */
export interface LoopSnapshotRecordWire {
	readonly timestamp?: number;
	readonly turn_id?: string;
	readonly loop_id?: string;
	readonly iteration?: number;
	readonly max_iterations?: number;
	readonly goal?: string;
	readonly exit_condition?: string;
	readonly tmp_file_relative_path?: string;
	readonly is_exit?: boolean;
	readonly self_supervise?: string;
	readonly terminal_reason?: string;
}

/**
 * JSON-shaped decode of AgentService.ListLoopSnapshotsResponse.
 * Shape matches `ListLoopSnapshotsResponseWire` / `mapListLoopSnapshotsResponse`.
 */
export interface ListLoopSnapshotsResponseWire {
	readonly snapshots?: LoopSnapshotRecordWire[];
}

/**
 * AgentService.ListLoopSnapshots — `session_id`=1 optional `loop_id`=2.
 * proto3: empty strings omitted.
 */
export function encodeListLoopSnapshotsRequest(request: UniverseAgentListLoopSnapshotsRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.loopId),
	]);
}

/**
 * ListLoopSnapshotsResponse — repeated `snapshots`=1 (LoopSnapshotRecord).
 * LoopSnapshotRecord: `timestamp`=1 `turn_id`=2 `loop_id`=3 `iteration`=4
 * `max_iterations`=5 `goal`=6 `exit_condition`=7 `tmp_file_relative_path`=8
 * `is_exit`=9 optional `self_supervise`=10 optional `terminal_reason`=11.
 * proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches `mapListLoopSnapshotsResponse`.
 */
export function decodeListLoopSnapshotsResponse(bytes: Uint8Array): ListLoopSnapshotsResponseWire {
	return {
		snapshots: allLengthDelimited(readProtoFields(bytes), 1).map(decodeLoopSnapshotRecord),
	};
}

function decodeLoopSnapshotRecord(bytes: Uint8Array): LoopSnapshotRecordWire {
	const fields = readProtoFields(bytes);
	const isExit = lastVarint(fields, 9);
	return {
		timestamp: numberOrUndefined(lastVarint(fields, 1)),
		turn_id: lastString(fields, 2),
		loop_id: lastString(fields, 3),
		iteration: numberOrUndefined(lastVarint(fields, 4)),
		max_iterations: numberOrUndefined(lastVarint(fields, 5)),
		goal: lastString(fields, 6),
		exit_condition: lastString(fields, 7),
		tmp_file_relative_path: lastString(fields, 8),
		is_exit: isExit === undefined ? undefined : isExit === 1n,
		self_supervise: lastString(fields, 10),
		terminal_reason: lastString(fields, 11),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
