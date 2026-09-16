/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentReadGitChangesRequest,
	UniverseAgentReadGitFileDiffRequest,
	UniverseAgentReadGitSummaryRequest,
	UniverseAgentGitArgvCommand,
	UniverseAgentWriteGitApplyHunksRequest,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitStagePathsRequest,
} from '../../common/universeAgentTypes.js';
import type {
	GitChangeEntryWire,
	ReadGitChangesResponseWire,
	ReadGitFileDiffResponseWire,
	ReadGitSummaryResponseWire,
	WriteGitWriteResponseWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * GitService.ReadGitSummary / ReadGitChanges — `session_id` = 1.
 * proto3: empty string omitted.
 */
export function encodeReadGitSummaryRequest(request: UniverseAgentReadGitSummaryRequest): Uint8Array {
	return encodeStringField(1, request.sessionId);
}

export function encodeReadGitChangesRequest(request: UniverseAgentReadGitChangesRequest): Uint8Array {
	return encodeReadGitSummaryRequest(request);
}

/**
 * ReadGitSummaryResponse — `supported` = 1, `reason` = 2, `branch` = 3, `change_count` = 4.
 * Unknown fields unread.
 */
export function decodeReadGitSummaryResponse(bytes: Uint8Array): ReadGitSummaryResponseWire {
	const fields = readProtoFields(bytes);
	return {
		supported: lastVarint(fields, 1) === 1n,
		reason: lastString(fields, 2),
		branch: lastString(fields, 3),
		change_count: numberOrUndefined(lastVarint(fields, 4)),
	};
}

/**
 * ReadGitChangesResponse — 1–3 same as summary, `entries` = 4.
 * GitChangeEntryProto: `path` = 1, `old_path` = 2, `kind` = 3, `index_state` = 4.
 * Unknown fields unread.
 */
export function decodeReadGitChangesResponse(bytes: Uint8Array): ReadGitChangesResponseWire {
	const fields = readProtoFields(bytes);
	return {
		supported: lastVarint(fields, 1) === 1n,
		reason: lastString(fields, 2),
		branch: lastString(fields, 3),
		entries: allLengthDelimited(fields, 4).map(decodeGitChangeEntry),
	};
}

function decodeGitChangeEntry(bytes: Uint8Array): GitChangeEntryWire {
	const fields = readProtoFields(bytes);
	return {
		path: lastString(fields, 1),
		old_path: lastString(fields, 2),
		kind: lastString(fields, 3),
		index_state: lastString(fields, 4),
	};
}

/**
 * GitService.ReadGitFileDiff — `session_id` = 1, `path` = 2, `index_state` = 3.
 * proto3: empty strings omitted.
 */
export function encodeReadGitFileDiffRequest(request: UniverseAgentReadGitFileDiffRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.path),
		encodeStringField(3, request.indexState),
	]);
}

/**
 * ReadGitFileDiffResponse — `supported` = 1, `reason` = 2, `path` = 3, `unified_diff` = 4.
 * Unknown fields unread.
 */
export function decodeReadGitFileDiffResponse(bytes: Uint8Array): ReadGitFileDiffResponseWire {
	const fields = readProtoFields(bytes);
	return {
		supported: lastVarint(fields, 1) === 1n,
		reason: lastString(fields, 2),
		path: lastString(fields, 3),
		unified_diff: lastString(fields, 4),
	};
}

/**
 * GitService.WriteGitStagePaths — `session_id` = 1, repeated `GitArgvCommand commands` = 2.
 * GitArgvCommand.argv = 1 (repeated string). proto3: empty strings / empty nested omitted.
 */
export function encodeWriteGitStagePathsRequest(request: UniverseAgentWriteGitStagePathsRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		...request.commands.map(command => encodeMessageField(2, encodeGitArgvCommand(command))),
	]);
}

function encodeGitArgvCommand(command: UniverseAgentGitArgvCommand): Uint8Array {
	return encodeRepeatedString(1, command.argv);
}

/**
 * GitService.WriteGitCommit — `session_id` = 1, `message` = 2, `sign_off` = 3, `amend` = 4.
 * proto3: empty strings / bool false omitted.
 */
export function encodeWriteGitCommitRequest(request: UniverseAgentWriteGitCommitRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.message),
		encodeInt32Field(3, request.signOff === true ? 1 : 0),
		encodeInt32Field(4, request.amend === true ? 1 : 0),
	]);
}

/**
 * GitService.WriteGitApplyHunks — `session_id` = 1, repeated `argv` = 2, repeated `patches` = 3.
 * proto3: empty strings omitted.
 */
export function encodeWriteGitApplyHunksRequest(request: UniverseAgentWriteGitApplyHunksRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeRepeatedString(2, request.argv),
		encodeRepeatedString(3, request.patches),
	]);
}

/**
 * WriteGitWriteResponse — `supported` = 1, `reason` = 2, `success` = 3,
 * `error_message` = 4, `exit_code` = 5, `stdout` = 6. Unknown fields unread.
 */
export function decodeWriteGitWriteResponse(bytes: Uint8Array): WriteGitWriteResponseWire {
	const fields = readProtoFields(bytes);
	return {
		supported: lastVarint(fields, 1) === 1n,
		reason: lastString(fields, 2),
		success: lastVarint(fields, 3) === 1n,
		error_message: lastString(fields, 4),
		exit_code: numberOrUndefined(lastVarint(fields, 5)),
		stdout: lastString(fields, 6),
	};
}

function encodeRepeatedString(field: number, values: readonly string[]): Buffer {
	if (values.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(values.map(value => encodeStringField(field, value)));
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
