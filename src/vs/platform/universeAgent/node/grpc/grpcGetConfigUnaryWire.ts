/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetRemoteAgentConfigRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.RemoteAgentConfig scalars 1–4, 7–9.
 * Nested `endpoint`=5 `auth`=6 `default_permission_delegate`=10 `health_check`=11
 * unread this slice. Shape matches `RemoteAgentConfigWire` /
 * `mapRemoteAgentConfig`.
 */
export interface RemoteAgentConfigWire {
	readonly id?: string;
	readonly name?: string;
	readonly description?: string;
	readonly enabled?: boolean;
	readonly tags?: string[];
	readonly max_concurrent_sessions?: number;
	readonly session_lifecycle?: string;
}

/**
 * RemoteAgentService.GetConfig — `node_id`=1.
 * proto3: empty strings omitted.
 */
export function encodeGetConfigRequest(request: UniverseAgentGetRemoteAgentConfigRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.nodeId),
	]);
}

/**
 * GetConfig returns RemoteAgentConfig (not wrapped).
 * RemoteAgentConfig scalars: `id`=1 `name`=2 `description`=3 `enabled`=4
 * repeated `tags`=7 `max_concurrent_sessions`=8 `session_lifecycle`=9.
 * Nested `endpoint`=5 `auth`=6 `default_permission_delegate`=10
 * `health_check`=11 unread this slice.
 * proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches `mapRemoteAgentConfig`.
 */
export function decodeGetConfigResponse(bytes: Uint8Array): RemoteAgentConfigWire {
	const fields = readProtoFields(bytes);
	const enabled = lastVarint(fields, 4);
	return {
		id: lastString(fields, 1),
		name: lastString(fields, 2),
		description: lastString(fields, 3),
		enabled: enabled === undefined ? undefined : enabled === 1n,
		tags: allLengthDelimited(fields, 7).map(value => Buffer.from(value).toString('utf8')),
		max_concurrent_sessions: numberOrUndefined(lastVarint(fields, 8)),
		session_lifecycle: lastString(fields, 9),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
