/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { encodeEmptyProtoMessage } from './grpcCatalogUnaryWire.js';
import type { ListConfigsResponseWire, RemoteAgentConfigWire } from './grpcClientMappersCatalog.js';
import { decodeGetConfigResponse } from './grpcGetConfigUnaryWire.js';
import {
	allLengthDelimited,
	readProtoFields,
} from './grpcProtoCodec.js';

export type { ListConfigsResponseWire, RemoteAgentConfigWire };

/**
 * RemoteAgentService.ListConfigs — `ListRemoteAgentConfigsRequest` is empty.
 * proto3 empty message: 0 payload bytes, never JSON `{}`.
 */
export function encodeListConfigsRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

/**
 * ListRemoteAgentConfigsResponse — repeated `configs`=1 (RemoteAgentConfig).
 * Each config is decoded by `decodeGetConfigResponse` (scalars 1–4, 7–9 plus
 * nested `endpoint`=5 `auth`=6 `default_permission_delegate`=10
 * `health_check`=11). proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches catalog `ListConfigsResponseWire` / `mapListConfigsResponse`.
 */
export function decodeListConfigsResponse(bytes: Uint8Array): ListConfigsResponseWire {
	return {
		configs: allLengthDelimited(readProtoFields(bytes), 1).map(decodeGetConfigResponse),
	};
}
