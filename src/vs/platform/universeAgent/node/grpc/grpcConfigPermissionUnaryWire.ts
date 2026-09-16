/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentPermissionPolicy,
	UniverseAgentSetPermissionPolicyRequest,
} from '../../common/universeAgentTypes.js';
import {
	encodeInt32Field,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON wire for ConfigService.SetPermissionPolicy — `{ success?: boolean; message?: string }`.
 * Mapper: `ok: wire.success === true`.
 */
export interface SetPermissionPolicyResponseWire {
	readonly success?: boolean;
	readonly message?: string;
}

/**
 * ConfigService.SetPermissionPolicy — `session_id`=1 `tool_name`=2 `policy`=3.
 * PermissionPolicy: UNSPECIFIED=0 ASK=1 AGENT=2 PERMIT=3.
 * proto3: empty strings omitted; UNSPECIFIED policy=0 omitted.
 */
export function encodeSetPermissionPolicyRequest(request: UniverseAgentSetPermissionPolicyRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.toolName),
		encodeInt32Field(3, permissionPolicyNumber(request.policy)),
	]);
}

/**
 * SetPermissionPolicyResponse — `success`=1 `message`=2.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches JSON `{ success?: boolean; message?: string }` (`ok: wire.success === true`).
 */
export function decodeSetPermissionPolicyResponse(bytes: Uint8Array): SetPermissionPolicyResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
	};
}

function permissionPolicyNumber(policy: UniverseAgentPermissionPolicy): number {
	switch (policy) {
		case 'PERMISSION_POLICY_ASK':
			return 1;
		case 'PERMISSION_POLICY_AGENT':
			return 2;
		case 'PERMISSION_POLICY_PERMIT':
			return 3;
		default:
			return 0;
	}
}
