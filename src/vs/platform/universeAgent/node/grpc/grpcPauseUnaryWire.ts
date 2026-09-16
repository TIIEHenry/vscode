/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentPauseAgentRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.PauseResponse.
 * Mapper: `ok: wire.success === true` (pauseAgent).
 */
export interface PauseResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * AgentService.Pause — `session_id`=1 `agent_id`=2.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodePauseRequest(request: UniverseAgentPauseAgentRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * PauseResponse — `success`=1 `message`=2.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches pauseAgent JSON `{ success?: boolean; message?: string }`.
 */
export function decodePauseResponse(bytes: Uint8Array): PauseResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}
