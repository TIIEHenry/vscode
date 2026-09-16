/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentSuspendLoopRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.SuspendLoopResponse.
 * Mapper: `ok: wire.success === true` (suspendLoop).
 * ≠ Pause.
 */
export interface SuspendLoopResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * AgentService.SuspendLoop — `session_id`=1 `agent_id`=2.
 * proto3 / proto comment: empty strings omitted.
 * ≠ Pause.
 */
export function encodeSuspendLoopRequest(request: UniverseAgentSuspendLoopRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * SuspendLoopResponse — `success`=1 `message`=2.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches suspendLoop JSON `{ success?: boolean; message?: string }`.
 * ≠ Pause.
 */
export function decodeSuspendLoopResponse(bytes: Uint8Array): SuspendLoopResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}
