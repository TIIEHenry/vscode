/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentBranchRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	encodeVarint,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.BranchResponse.
 * Mapper: `mapBranchResponse`.
 */
export interface BranchResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly current_branch?: number;
	readonly total_branches?: number;
	readonly current_turn_id?: string;
}

/**
 * AgentService.Branch — `session_id`=1 `agent_id`=2 `branch_index`=3 `turn_id`=4.
 * `branch_index` is 0-based; -1 lists only. Field 3 is always written (0 and -1)
 * because the default int32 helper omits 0. Empty `turnId` omitted.
 */
export function encodeBranchRequest(request: UniverseAgentBranchRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeSignedInt32Field(3, request.branchIndex),
		encodeStringField(4, request.turnId),
	]);
}

/**
 * BranchResponse — `success`=1 `message`=2 `current_branch`=3 `total_branches`=4
 * `current_turn_id`=5. proto3: false / empty / 0 omitted. Unknown fields unread.
 * Shape matches `mapBranchResponse`.
 */
export function decodeBranchResponse(bytes: Uint8Array): BranchResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		current_branch: numberOrUndefined(lastVarint(fields, 3)),
		total_branches: numberOrUndefined(lastVarint(fields, 4)),
		current_turn_id: lastString(fields, 5),
	};
}

/**
 * proto int32 with presence. The default int32 helper treats 0 as omit
 * (a real 0-based index must stay present). Negatives use two's-complement varint.
 */
function encodeSignedInt32Field(field: number, value: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(value),
	]);
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
