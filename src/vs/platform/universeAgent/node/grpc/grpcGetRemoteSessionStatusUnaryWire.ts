/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetRemoteSessionStatusRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.GetRemoteSessionStatusResponse.
 * Shape matches GetRemoteSessionStatusResponseWire (`status` / `call_id` /
 * `progress` / `elapsed_ms` / `expires_at` / `pending_permissions` /
 * `pending_questions`). Mapper: `mapGetRemoteSessionStatusResponse`
 * (missing pending → `[]`). Nested `pending_permissions`=6
 * RemotePendingPermission 1–7; `pending_questions`=7 RemotePendingQuestion
 * 1–2.
 */
export interface GetRemoteSessionStatusResponseWire {
	readonly status?: string;
	readonly call_id?: string;
	readonly progress?: string;
	readonly elapsed_ms?: number | string;
	readonly expires_at?: number | string;
	readonly pending_permissions?: RemotePendingPermissionJsonWire[];
	readonly pending_questions?: RemotePendingQuestionJsonWire[];
}

/** RemotePendingPermission — proto fields 1–7. Unknown nested unread. */
export interface RemotePendingPermissionJsonWire {
	readonly request_id?: string;
	readonly tool_name?: string;
	readonly path?: string;
	readonly command?: string;
	readonly arguments_json?: string;
	readonly danger_level?: string;
	readonly bubble_target?: string;
}

/** RemotePendingQuestion — proto fields 1–2. Unknown nested unread. */
export interface RemotePendingQuestionJsonWire {
	readonly question_id?: string;
	readonly questions_json?: string;
}

/**
 * RemoteAgentService.GetRemoteSessionStatus — `call_id`=1.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeGetRemoteSessionStatusRequest(request: UniverseAgentGetRemoteSessionStatusRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.callId),
	]);
}

/**
 * GetRemoteSessionStatusResponse — `status`=1 `call_id`=2 `progress`=3
 * `elapsed_ms`=4 `expires_at`=5. Nested `pending_permissions`=6
 * RemotePendingPermission (`request_id`=1 `tool_name`=2 `path`=3
 * `command`=4 `arguments_json`=5 `danger_level`=6 `bubble_target`=7).
 * Nested `pending_questions`=7 RemotePendingQuestion (`question_id`=1
 * `questions_json`=2).
 * proto3: empty / 0 omitted. Unknown fields unread.
 * `elapsed_ms` / `expires_at` via lastVarint.
 * Shape matches GetRemoteSessionStatusResponseWire /
 * `mapGetRemoteSessionStatusResponse`.
 */
export function decodeGetRemoteSessionStatusResponse(bytes: Uint8Array): GetRemoteSessionStatusResponseWire {
	const fields = readProtoFields(bytes);
	return {
		status: lastString(fields, 1),
		call_id: lastString(fields, 2),
		progress: lastString(fields, 3),
		elapsed_ms: numberOrUndefined(lastVarint(fields, 4)),
		expires_at: numberOrUndefined(lastVarint(fields, 5)),
		pending_permissions: allLengthDelimited(fields, 6).map(decodeRemotePendingPermission),
		pending_questions: allLengthDelimited(fields, 7).map(decodeRemotePendingQuestion),
	};
}

function decodeRemotePendingPermission(bytes: Uint8Array): RemotePendingPermissionJsonWire {
	const fields = readProtoFields(bytes);
	return {
		request_id: lastString(fields, 1),
		tool_name: lastString(fields, 2),
		path: lastString(fields, 3),
		command: lastString(fields, 4),
		arguments_json: lastString(fields, 5),
		danger_level: lastString(fields, 6),
		bubble_target: lastString(fields, 7),
	};
}

function decodeRemotePendingQuestion(bytes: Uint8Array): RemotePendingQuestionJsonWire {
	const fields = readProtoFields(bytes);
	return {
		question_id: lastString(fields, 1),
		questions_json: lastString(fields, 2),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
