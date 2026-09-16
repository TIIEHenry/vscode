/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentFireTriggerWebhookRequest,
	UniverseAgentInstallSessionDemoFakeRequest,
} from '../../common/universeAgentTypes.js';
import {
	encodeBytesField,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.FireTriggerWebhookResponse.
 * `status` is FireTriggerWebhookStatus varint (0–4). Mapper: `mapFireTriggerWebhookStatus`.
 */
export interface FireTriggerWebhookResponseWire {
	readonly status?: number;
	readonly event_id?: string;
	readonly reason?: string;
}

/**
 * JSON-shaped decode of AgentService.InstallSessionDemoFakeResponse.
 * Mapper: `ok: wire.success === true`.
 */
export interface InstallSessionDemoFakeResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly reason_code?: string;
}

/**
 * AgentService.FireTriggerWebhook — `session_id`=1 `trigger_id`=2 optional `payload_json`=3.
 * proto3 / proto comment: empty or absent `payload_json` omitted (JsonNull).
 */
export function encodeFireTriggerWebhookRequest(request: UniverseAgentFireTriggerWebhookRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.triggerId),
		encodeStringField(3, request.payloadJson),
	]);
}

/**
 * FireTriggerWebhookResponse — `status`=1 (FireTriggerWebhookStatus 0–4) `event_id`=2 `reason`=3.
 * proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `mapFireTriggerWebhookStatus(wire.status)`.
 */
export function decodeFireTriggerWebhookResponse(bytes: Uint8Array): FireTriggerWebhookResponseWire {
	const fields = readProtoFields(bytes);
	return {
		status: numberOrUndefined(lastVarint(fields, 1)),
		event_id: lastString(fields, 2),
		reason: lastString(fields, 3),
	};
}

/**
 * AgentService.InstallSessionDemoFake — `session_id`=1 `queues_payload`=2 (bytes)
 * `content_type`=3 `playbook_id`=4.
 * proto3: empty strings / empty bytes omitted. `queues_payload` via encodeBytesField (TS `Uint8Array`).
 */
export function encodeInstallSessionDemoFakeRequest(request: UniverseAgentInstallSessionDemoFakeRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeBytesField(2, request.queuesPayload),
		encodeStringField(3, request.contentType),
		encodeStringField(4, request.playbookId),
	]);
}

/**
 * InstallSessionDemoFakeResponse — `success`=1 `message`=2 `reason_code`=3.
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches JSON `{ success?: boolean; message?: string; reason_code?: string }`.
 */
export function decodeInstallSessionDemoFakeResponse(bytes: Uint8Array): InstallSessionDemoFakeResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		reason_code: lastString(fields, 3),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
