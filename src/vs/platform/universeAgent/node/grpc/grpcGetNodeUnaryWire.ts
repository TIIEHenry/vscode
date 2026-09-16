/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetNodeRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.RemoteAgentInfo scalars.
 * Shape matches `RemoteAgentInfoWire` (`id`/`name`/`description`/`status`/
 * `endpoint`/`tags`/`last_heartbeat_at`). `capabilities`=7 `load`=8 unread
 * this slice (no nested codecs).
 */
export interface RemoteAgentInfoWire {
	readonly id?: string;
	readonly name?: string;
	readonly description?: string;
	readonly status?: string;
	readonly endpoint?: string;
	readonly tags?: string[];
	readonly last_heartbeat_at?: number | string;
}

/**
 * RemoteAgentService.GetNode — `node_id`=1.
 * proto3: empty strings omitted.
 */
export function encodeGetNodeRequest(request: UniverseAgentGetNodeRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.nodeId),
	]);
}

/**
 * GetNode returns RemoteAgentInfo (not wrapped).
 * RemoteAgentInfo: `id`=1 `name`=2 `description`=3 `status`=4 `endpoint`=5
 * repeated `tags`=6 `last_heartbeat_at`=9.
 * `capabilities`=7 `load`=8 unread this slice.
 * proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `RemoteAgentInfoWire` / `mapRemoteAgentInfo`.
 */
export function decodeGetNodeResponse(bytes: Uint8Array): RemoteAgentInfoWire {
	return decodeRemoteAgentInfoScalars(bytes);
}

/** Local scalar decode of RemoteAgentInfo; nested 7/8 unread. */
export function decodeRemoteAgentInfoScalars(bytes: Uint8Array): RemoteAgentInfoWire {
	const fields = readProtoFields(bytes);
	const tags = allLengthDelimited(fields, 6).map(value => Buffer.from(value).toString('utf8'));
	return {
		id: lastString(fields, 1),
		name: lastString(fields, 2),
		description: lastString(fields, 3),
		status: lastString(fields, 4),
		endpoint: lastString(fields, 5),
		tags: tags.length === 0 ? undefined : tags,
		last_heartbeat_at: numberOrUndefined(lastVarint(fields, 9)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
