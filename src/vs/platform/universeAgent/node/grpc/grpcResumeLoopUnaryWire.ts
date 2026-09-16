/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentResumeLoopRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.ResumeLoopResponse.
 * Mapper: `ok: wire.success === true` (resumeLoop).
 */
export interface ResumeLoopResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * AgentService.ResumeLoop — `session_id`=1 `agent_id`=2.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeResumeLoopRequest(request: UniverseAgentResumeLoopRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * ResumeLoopResponse — `success`=1 `message`=2.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches resumeLoop JSON `{ success?: boolean; message?: string }`.
 */
export function decodeResumeLoopResponse(bytes: Uint8Array): ResumeLoopResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}
