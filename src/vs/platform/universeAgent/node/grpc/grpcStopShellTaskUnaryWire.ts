/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentStopShellTaskRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.StopShellTaskResponse.
 * Mapper: `ok: wire.success === true` (stopShellTask).
 */
export interface StopShellTaskResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * AgentService.StopShellTask — `session_id`=1 `task_id`=2.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeStopShellTaskRequest(request: UniverseAgentStopShellTaskRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.taskId),
	]);
}

/**
 * StopShellTaskResponse — `success`=1 `message`=2.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches stopShellTask JSON `{ success?: boolean; message?: string }`.
 */
export function decodeStopShellTaskResponse(bytes: Uint8Array): StopShellTaskResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}
