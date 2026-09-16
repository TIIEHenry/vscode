/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetRemoteSessionStatusRequest } from '../../common/universeAgentTypes.js';
import {
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
 * `pending_questions`=7 unread this slice (no PendingPermission /
 * PendingQuestion codecs).
 */
export interface GetRemoteSessionStatusResponseWire {
	readonly status?: string;
	readonly call_id?: string;
	readonly progress?: string;
	readonly elapsed_ms?: number | string;
	readonly expires_at?: number | string;
	readonly pending_permissions?: readonly RemotePendingPermissionJsonWire[];
	readonly pending_questions?: readonly RemotePendingQuestionJsonWire[];
}

/** JSON shape only; no proto codec. */
export interface RemotePendingPermissionJsonWire {
	readonly request_id?: string;
	readonly tool_name?: string;
	readonly path?: string;
	readonly command?: string;
	readonly arguments_json?: string;
	readonly danger_level?: string;
	readonly bubble_target?: string;
}

/** JSON shape only; no proto codec. */
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
 * `pending_questions`=7 unread this slice.
 * proto3: empty / 0 omitted. Unknown fields unread.
 * `elapsed_ms` / `expires_at` via lastVarint.
 * Shape matches GetRemoteSessionStatusResponseWire.
 */
export function decodeGetRemoteSessionStatusResponse(bytes: Uint8Array): GetRemoteSessionStatusResponseWire {
	const fields = readProtoFields(bytes);
	return {
		status: lastString(fields, 1),
		call_id: lastString(fields, 2),
		progress: lastString(fields, 3),
		elapsed_ms: numberOrUndefined(lastVarint(fields, 4)),
		expires_at: numberOrUndefined(lastVarint(fields, 5)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
