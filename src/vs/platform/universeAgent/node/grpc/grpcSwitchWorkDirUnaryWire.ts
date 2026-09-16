/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentSwitchWorkDirRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.SwitchWorkDirResponse.
 * Mapper: `ok: wire.success === true`.
 */
export interface SwitchWorkDirResponseWire {
	readonly success?: boolean;
	readonly previous_work_dir?: string;
	readonly current_work_dir?: string;
	readonly message?: string;
}

/**
 * AgentService.SwitchWorkDir — `session_id`=1 `agent_id`=2 `new_work_dir`=3.
 * Empty `newWorkDir` is passed through as-is. `encodeStringField` omits empty
 * strings (proto3 omit empty), matching other wires; no fourth field.
 */
export function encodeSwitchWorkDirRequest(request: UniverseAgentSwitchWorkDirRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.newWorkDir),
	]);
}

/**
 * SwitchWorkDirResponse — `success`=1 `previous_work_dir`=2 `current_work_dir`=3 `message`=4.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches JSON `{ success?: boolean; previous_work_dir?: string; current_work_dir?: string; message?: string }`.
 */
export function decodeSwitchWorkDirResponse(bytes: Uint8Array): SwitchWorkDirResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		previous_work_dir: lastString(fields, 2),
		current_work_dir: lastString(fields, 3),
		message: lastString(fields, 4),
	};
}
