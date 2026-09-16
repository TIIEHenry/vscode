/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentTodoRequest } from '../../common/universeAgentTypes.js';
import type { TodoItemWire, TodoResponseWire } from './grpcClientMappersSession.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * AgentService.Todo — `session_id`=1 `agent_id`=2.
 * proto3: empty strings omitted.
 */
export function encodeTodoRequest(request: UniverseAgentTodoRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * TodoResponse — repeated `items`=1 (length-delimited TodoItem).
 * TodoItem: `id`=1 `content`=2 `status`=3 `priority`=4 `require_confirm`=5 `blocked`=6.
 * proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches `mapTodoItem` / `mapTodoResponse` (`require_confirm` boolean).
 */
export function decodeTodoResponse(bytes: Uint8Array): TodoResponseWire {
	return {
		items: allLengthDelimited(readProtoFields(bytes), 1).map(decodeTodoItem),
	};
}

function decodeTodoItem(bytes: Uint8Array): TodoItemWire {
	const fields = readProtoFields(bytes);
	const requireConfirm = lastVarint(fields, 5);
	return {
		id: lastString(fields, 1),
		content: lastString(fields, 2),
		status: lastString(fields, 3),
		priority: numberOrUndefined(lastVarint(fields, 4)),
		require_confirm: requireConfirm === undefined ? undefined : requireConfirm === 1n,
		blocked: lastString(fields, 6),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
