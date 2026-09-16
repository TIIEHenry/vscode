/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentDeleteTriggerRequest,
	UniverseAgentFireTriggerRequest,
	UniverseAgentListTriggersRequest,
	UniverseAgentSetTriggerEnabledRequest,
	UniverseAgentTrigger,
	UniverseAgentTriggerDeliveryTarget,
	UniverseAgentUpsertTriggerRequest,
} from '../../common/universeAgentTypes.js';
import type {
	DeliveryTargetDtoWire,
	FireTriggerResponseWire,
	ListTriggersResponseWire,
	SetTriggerEnabledResponseWire,
	TriggerDtoWire,
	UpsertTriggerResponseWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodePresentMessageField,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * TriggerService.ListTriggers — `scope`=1 `scope_id`=2 optional `type_filter`=3.
 * proto3: empty strings omitted.
 */
export function encodeListTriggersRequest(request: UniverseAgentListTriggersRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.scopeId),
		encodeStringField(3, request.typeFilter),
	]);
}

/**
 * ListTriggersResponse — repeated `triggers`=1 (TriggerDto 1–10).
 * Unknown fields unread. Shape matches `mapListTriggersResponse` input.
 */
export function decodeListTriggersResponse(bytes: Uint8Array): ListTriggersResponseWire {
	return {
		triggers: allLengthDelimited(readProtoFields(bytes), 1).map(decodeTriggerDto),
	};
}

/**
 * TriggerService.UpsertTrigger — `scope`=1 `scope_id`=2 nested `trigger`=3.
 * proto3: empty strings / 0 / false omitted. Nested TriggerDto via encodeMessageField.
 */
export function encodeUpsertTriggerRequest(request: UniverseAgentUpsertTriggerRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.scopeId),
		encodeMessageField(3, encodeTriggerDto(request.trigger)),
	]);
}

/**
 * UpsertTriggerResponse — `trigger`=1 (TriggerDto). Unknown fields unread.
 * Shape matches `mapUpsertTriggerResponse` input.
 */
export function decodeUpsertTriggerResponse(bytes: Uint8Array): UpsertTriggerResponseWire {
	const trigger = lastBytes(readProtoFields(bytes), 1);
	return {
		trigger: trigger !== undefined ? decodeTriggerDto(trigger) : undefined,
	};
}

/**
 * TriggerService.DeleteTrigger — `scope`=1 `scope_id`=2 `trigger_id`=3.
 * proto3: empty strings omitted.
 */
export function encodeDeleteTriggerRequest(request: UniverseAgentDeleteTriggerRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.scopeId),
		encodeStringField(3, request.triggerId),
	]);
}

/**
 * DeleteTriggerResponse — empty message. Unknown fields unread.
 * Shape matches `mapDeleteTriggerResponse` input.
 */
export function decodeDeleteTriggerResponse(_bytes: Uint8Array): Record<string, unknown> {
	return {};
}

/**
 * TriggerService.SetTriggerEnabled — `scope`=1 `scope_id`=2 `trigger_id`=3 `enabled`=4.
 * proto3: empty strings / false omitted.
 */
export function encodeSetTriggerEnabledRequest(request: UniverseAgentSetTriggerEnabledRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.scopeId),
		encodeStringField(3, request.triggerId),
		encodeInt32Field(4, request.enabled ? 1 : 0),
	]);
}

/**
 * SetTriggerEnabledResponse — `trigger`=1 (TriggerDto). Unknown fields unread.
 * Shape matches `mapSetTriggerEnabledResponse` input.
 */
export function decodeSetTriggerEnabledResponse(bytes: Uint8Array): SetTriggerEnabledResponseWire {
	const trigger = lastBytes(readProtoFields(bytes), 1);
	return {
		trigger: trigger !== undefined ? decodeTriggerDto(trigger) : undefined,
	};
}

/**
 * TriggerService.FireTrigger — `scope`=1 `scope_id`=2 `trigger_id`=3.
 * proto3: empty strings omitted.
 */
export function encodeFireTriggerRequest(request: UniverseAgentFireTriggerRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.scope),
		encodeStringField(2, request.scopeId),
		encodeStringField(3, request.triggerId),
	]);
}

/**
 * FireTriggerResponse — `status`=1 optional `event_id`=2 optional `reason`=3.
 * Unknown fields unread. Shape matches `mapFireTriggerResponse` input.
 */
export function decodeFireTriggerResponse(bytes: Uint8Array): FireTriggerResponseWire {
	const fields = readProtoFields(bytes);
	return {
		status: lastString(fields, 1),
		event_id: lastString(fields, 2),
		reason: lastString(fields, 3),
	};
}

/**
 * TriggerDto — `trigger_id`=1 `name`=2 `type`=3 `prompt_template`=4 `enabled`=5
 * optional `pause_reason`=6 nested `target`=7 optional `interval_ms`=8
 * optional `cron_expression`=9 optional `run_at_epoch_ms`=10.
 * proto3: empty / 0 / false omitted. Nested DeliveryTargetDto via encodeMessageField.
 */
function encodeTriggerDto(trigger: UniverseAgentTrigger): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, trigger.triggerId),
		encodeStringField(2, trigger.name),
		encodeStringField(3, trigger.type),
		encodeStringField(4, trigger.promptTemplate),
		encodeInt32Field(5, trigger.enabled ? 1 : 0),
		encodeStringField(6, trigger.pauseReason),
		encodeMessageField(7, encodeDeliveryTargetDto(trigger.target)),
		encodeInt64Field(8, trigger.intervalMs),
		encodeStringField(9, trigger.cronExpression),
		encodeInt64Field(10, trigger.runAtEpochMs),
	]);
}

function decodeTriggerDto(bytes: Uint8Array): TriggerDtoWire {
	const fields = readProtoFields(bytes);
	const enabled = lastVarint(fields, 5);
	const target = lastBytes(fields, 7);
	return {
		trigger_id: lastString(fields, 1),
		name: lastString(fields, 2),
		type: lastString(fields, 3),
		prompt_template: lastString(fields, 4),
		enabled: enabled === undefined ? undefined : enabled === 1n,
		pause_reason: lastString(fields, 6),
		target: target !== undefined ? decodeDeliveryTargetDto(target) : undefined,
		interval_ms: numberOrUndefined(lastVarint(fields, 8)),
		cron_expression: lastString(fields, 9),
		run_at_epoch_ms: numberOrUndefined(lastVarint(fields, 10)),
	};
}

/**
 * DeliveryTargetDto oneof: `self`=1 (empty SelfConversationTarget; presence
 * matters) `bound_session`=2 (`session_id`=1) `new_session`=3
 * (`engine_profile_id`=1). Empty nested oneof arms keep a length-delimited
 * field (encodeMessageField omits empty bytes).
 */
function encodeDeliveryTargetDto(target: UniverseAgentTriggerDeliveryTarget): Uint8Array {
	if (target.kind === 'self') {
		return encodePresentMessageField(1, new Uint8Array(0));
	}
	if (target.kind === 'boundSession') {
		return encodePresentMessageField(2, encodeStringField(1, target.sessionId));
	}
	if (target.kind === 'newSession') {
		return encodePresentMessageField(3, encodeStringField(1, target.engineProfileId));
	}
	return new Uint8Array(0);
}

function decodeDeliveryTargetDto(bytes: Uint8Array): DeliveryTargetDtoWire {
	const fields = readProtoFields(bytes);
	const self = lastBytes(fields, 1);
	const boundSession = lastBytes(fields, 2);
	const newSession = lastBytes(fields, 3);
	return {
		self: self !== undefined ? {} : undefined,
		bound_session: boundSession !== undefined ? { session_id: lastString(readProtoFields(boundSession), 1) } : undefined,
		new_session: newSession !== undefined ? { engine_profile_id: lastString(readProtoFields(newSession), 1) } : undefined,
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
