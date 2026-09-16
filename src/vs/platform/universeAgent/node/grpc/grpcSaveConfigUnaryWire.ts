/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentRemoteAgentConfig, UniverseAgentSaveRemoteAgentConfigRequest } from '../../common/universeAgentTypes.js';
import {
	encodeInt32Field,
	encodePresentMessageField,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.SaveRemoteAgentConfigResponse
 * scalars `success`=1 `message`=2 `async_test_id`=4.
 * Nested `connection_test`=3 unread this slice (no nested codec).
 * Shape matches `SaveRemoteAgentConfigResponseWire`.
 */
export interface SaveRemoteAgentConfigResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly async_test_id?: string;
}

/**
 * RemoteAgentService.SaveConfig — nested `config`=1 (RemoteAgentConfig
 * scalars this slice) `skip_connection_test`=2 `async_test`=3.
 * Config uses `encodePresentMessageField(1, inner)`. Inner scalars:
 * `id`=1 `name`=2 `description`=3 `enabled`=4 repeated `tags`=7
 * `max_concurrent_sessions`=8 `session_lifecycle`=9.
 * Nested `endpoint`=5 `auth`=6 `default_permission_delegate`=10
 * `health_check`=11 omitted this slice (no nested codecs).
 * Bool true via `encodeInt32Field(n, 1)`; omit false.
 * proto3: empty strings / empty repeated / 0 omitted.
 */
export function encodeSaveConfigRequest(request: UniverseAgentSaveRemoteAgentConfigRequest): Uint8Array {
	return Buffer.concat([
		encodePresentMessageField(1, encodeRemoteAgentConfigScalars(request.config)),
		encodeInt32Field(2, request.skipConnectionTest ? 1 : 0),
		encodeInt32Field(3, request.asyncTest ? 1 : 0),
	]);
}

/**
 * SaveRemoteAgentConfigResponse — `success`=1 `message`=2 `async_test_id`=4.
 * Nested `connection_test`=3 unread this slice.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches SaveRemoteAgentConfigResponseWire
 * `{ success?: boolean; message?: string; async_test_id?: string }`.
 */
export function decodeSaveConfigResponse(bytes: Uint8Array): SaveRemoteAgentConfigResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		async_test_id: lastString(fields, 4),
	};
}

function encodeRemoteAgentConfigScalars(config: UniverseAgentRemoteAgentConfig): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, config.id),
		encodeStringField(2, config.name),
		encodeStringField(3, config.description),
		encodeInt32Field(4, config.enabled ? 1 : 0),
		...config.tags.map(tag => encodeStringField(7, tag)),
		encodeInt32Field(8, config.maxConcurrentSessions),
		encodeStringField(9, config.sessionLifecycle),
	]);
}
