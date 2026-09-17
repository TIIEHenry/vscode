/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentListNodesRequest } from '../../common/universeAgentTypes.js';
import type { ListNodesResponseWire, RemoteAgentInfoWire } from './grpcClientMappersCatalog.js';
import { decodeRemoteAgentInfoScalars } from './grpcGetNodeUnaryWire.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

export type { ListNodesResponseWire, RemoteAgentInfoWire };

/**
 * RemoteAgentService.ListNodes — repeated `filter_status`=1 repeated `filter_tags`=2.
 * proto3: empty strings / empty repeated omitted.
 */
export function encodeListNodesRequest(request: UniverseAgentListNodesRequest): Uint8Array {
	return Buffer.concat([
		...request.filterStatus.map(status => encodeStringField(1, status)),
		...request.filterTags.map(tag => encodeStringField(2, tag)),
	]);
}

/**
 * ListNodesResponse — repeated `nodes`=1 (RemoteAgentInfo) `total`=2 `online_count`=3.
 * RemoteAgentInfo: `id`=1 `name`=2 `description`=3 `status`=4 `endpoint`=5
 * repeated `tags`=6 `capabilities`=7 `load`=8 `last_heartbeat_at`=9.
 * Nested capabilities/load decoded via `decodeRemoteAgentInfoScalars`
 * (same numbers/shape as GetNode). proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `ListNodesResponseWire` / `RemoteAgentInfoWire` / `mapListNodesResponse`.
 */
export function decodeListNodesResponse(bytes: Uint8Array): ListNodesResponseWire {
	const fields = readProtoFields(bytes);
	return {
		nodes: allLengthDelimited(fields, 1).map(decodeRemoteAgentInfoScalars),
		total: numberOrUndefined(lastVarint(fields, 2)),
		online_count: numberOrUndefined(lastVarint(fields, 3)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
