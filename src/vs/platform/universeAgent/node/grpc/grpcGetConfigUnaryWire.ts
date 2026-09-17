/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetRemoteAgentConfigRequest } from '../../common/universeAgentTypes.js';
import type {
	RemoteAgentArgConditionWire,
	RemoteAgentAuthConfigWire,
	RemoteAgentConfigWire,
	RemoteAgentEndpointWire,
	RemoteAgentHealthCheckConfigWire,
	RemoteAgentPermissionBudgetWire,
	RemoteAgentPermissionDelegateWire,
	RemoteAgentWhitelistEntryWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastBytes,
	lastFixed64,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

export type { RemoteAgentConfigWire };

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
 * RemoteAgentConfig: `id`=1 `name`=2 `description`=3 `enabled`=4
 * nested `endpoint`=5 Endpoint (`host`=1 `port`=2 `tls`=3 `tls_cert_path`=4)
 * nested `auth`=6 AuthConfig (`type`=1 `api_key_ref`=2 `token_ref`=3)
 * repeated `tags`=7 `max_concurrent_sessions`=8 `session_lifecycle`=9
 * nested `default_permission_delegate`=10 PermissionDelegate (`mode`=1
 * repeated `whitelist`=2 WhitelistEntry (`tool_name`=1 repeated
 * `arg_conditions`=2 ArgCondition `field`=1 `operator`=2 `value`=3)
 * nested `budget`=3 PermissionBudget (`max_tool_calls`=1 `max_tokens`=2
 * `timeout_ms`=3 `window_ms`=4 `max_bubble_to_user_per_day`=5)
 * `timeout_policy`=4 `fallback`=5 `bubble_target`=6)
 * nested `health_check`=11 HealthCheckConfig (`interval_ms`=1
 * `timeout_ms`=2 `unhealthy_threshold`=3 `healthy_threshold`=4
 * `use_watch`=5 `degraded_error_rate_threshold`=6 IEEE 754 LE
 * `lastFixed64` `degraded_p99_latency_ms`=7).
 * proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches catalog `RemoteAgentConfigWire` / `mapRemoteAgentConfig`.
 */
export function decodeGetConfigResponse(bytes: Uint8Array): RemoteAgentConfigWire {
	const fields = readProtoFields(bytes);
	const endpoint = lastBytes(fields, 5);
	const auth = lastBytes(fields, 6);
	const delegate = lastBytes(fields, 10);
	const health = lastBytes(fields, 11);
	return {
		id: lastString(fields, 1),
		name: lastString(fields, 2),
		description: lastString(fields, 3),
		enabled: optionalBool(lastVarint(fields, 4)),
		endpoint: endpoint === undefined ? undefined : decodeEndpoint(endpoint),
		auth: auth === undefined ? undefined : decodeAuthConfig(auth),
		tags: allLengthDelimited(fields, 7).map(value => Buffer.from(value).toString('utf8')),
		max_concurrent_sessions: numberOrUndefined(lastVarint(fields, 8)),
		session_lifecycle: lastString(fields, 9),
		default_permission_delegate: delegate === undefined ? undefined : decodePermissionDelegate(delegate),
		health_check: health === undefined ? undefined : decodeHealthCheckConfig(health),
	};
}

function decodeEndpoint(bytes: Uint8Array): RemoteAgentEndpointWire {
	const fields = readProtoFields(bytes);
	return {
		host: lastString(fields, 1),
		port: numberOrUndefined(lastVarint(fields, 2)),
		tls: optionalBool(lastVarint(fields, 3)),
		tls_cert_path: lastString(fields, 4),
	};
}

function decodeAuthConfig(bytes: Uint8Array): RemoteAgentAuthConfigWire {
	const fields = readProtoFields(bytes);
	return {
		type: lastString(fields, 1),
		api_key_ref: lastString(fields, 2),
		token_ref: lastString(fields, 3),
	};
}

function decodePermissionDelegate(bytes: Uint8Array): RemoteAgentPermissionDelegateWire {
	const fields = readProtoFields(bytes);
	const budget = lastBytes(fields, 3);
	return {
		mode: lastString(fields, 1),
		whitelist: allLengthDelimited(fields, 2).map(decodeWhitelistEntry),
		budget: budget === undefined ? undefined : decodePermissionBudget(budget),
		timeout_policy: lastString(fields, 4),
		fallback: lastString(fields, 5),
		bubble_target: lastString(fields, 6),
	};
}

function decodeWhitelistEntry(bytes: Uint8Array): RemoteAgentWhitelistEntryWire {
	const fields = readProtoFields(bytes);
	return {
		tool_name: lastString(fields, 1),
		arg_conditions: allLengthDelimited(fields, 2).map(decodeArgCondition),
	};
}

function decodeArgCondition(bytes: Uint8Array): RemoteAgentArgConditionWire {
	const fields = readProtoFields(bytes);
	return {
		field: lastString(fields, 1),
		operator: lastString(fields, 2),
		value: lastString(fields, 3),
	};
}

function decodePermissionBudget(bytes: Uint8Array): RemoteAgentPermissionBudgetWire {
	const fields = readProtoFields(bytes);
	return {
		max_tool_calls: numberOrUndefined(lastVarint(fields, 1)),
		max_tokens: numberOrUndefined(lastVarint(fields, 2)),
		timeout_ms: numberOrUndefined(lastVarint(fields, 3)),
		window_ms: numberOrUndefined(lastVarint(fields, 4)),
		max_bubble_to_user_per_day: numberOrUndefined(lastVarint(fields, 5)),
	};
}

function decodeHealthCheckConfig(bytes: Uint8Array): RemoteAgentHealthCheckConfigWire {
	const fields = readProtoFields(bytes);
	return {
		interval_ms: numberOrUndefined(lastVarint(fields, 1)),
		timeout_ms: numberOrUndefined(lastVarint(fields, 2)),
		unhealthy_threshold: numberOrUndefined(lastVarint(fields, 3)),
		healthy_threshold: numberOrUndefined(lastVarint(fields, 4)),
		use_watch: optionalBool(lastVarint(fields, 5)),
		degraded_error_rate_threshold: lastFixed64(fields, 6),
		degraded_p99_latency_ms: numberOrUndefined(lastVarint(fields, 7)),
	};
}

function optionalBool(value: bigint | undefined): boolean | undefined {
	return value === undefined ? undefined : value === 1n;
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
