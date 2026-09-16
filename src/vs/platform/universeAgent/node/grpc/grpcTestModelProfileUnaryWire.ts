/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentTestModelProfileRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.TestModelProfileResponse.
 * Mapper: `ok: wire.success === true`, `message: wire.error_message`.
 */
export interface TestModelProfileResponseWire {
	readonly success?: boolean;
	readonly error_message?: string;
}

/**
 * AgentService.TestModelProfile — `provider_id`=1 `model_id`=2 `api_key`=3
 * `base_url`=4 `protocol`=5. map `params`=6 unused unread / omit on encode
 * (no invented map encoding). proto3: empty strings omitted.
 */
export function encodeTestModelProfileRequest(request: UniverseAgentTestModelProfileRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.providerId),
		encodeStringField(2, request.modelId),
		encodeStringField(3, request.apiKey),
		encodeStringField(4, request.baseUrl),
		encodeStringField(5, request.protocol),
	]);
}

/**
 * TestModelProfileResponse — `success`=1 `error_message`=2.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches JSON `{ success?: boolean; error_message?: string }`.
 */
export function decodeTestModelProfileResponse(bytes: Uint8Array): TestModelProfileResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		error_message: lastString(fields, 2),
	};
}
