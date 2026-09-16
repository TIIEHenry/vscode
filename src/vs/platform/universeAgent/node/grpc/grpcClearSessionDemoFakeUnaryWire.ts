/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentClearSessionDemoFakeRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.ClearSessionDemoFakeResponse.
 * Mapper: `ok: wire.success === true`.
 */
export interface ClearSessionDemoFakeResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly reason_code?: string;
}

/**
 * AgentService.ClearSessionDemoFake — `session_id`=1.
 * proto3: empty string omitted.
 */
export function encodeClearSessionDemoFakeRequest(request: UniverseAgentClearSessionDemoFakeRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
	]);
}

/**
 * ClearSessionDemoFakeResponse — `success`=1 `message`=2 `reason_code`=3.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches JSON `{ success?: boolean; message?: string; reason_code?: string }`.
 */
export function decodeClearSessionDemoFakeResponse(bytes: Uint8Array): ClearSessionDemoFakeResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		reason_code: lastString(fields, 3),
	};
}
