/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentRemoteAgentArgCondition,
	UniverseAgentRemoteAgentAuthConfig,
	UniverseAgentRemoteAgentConfig,
	UniverseAgentRemoteAgentEndpoint,
	UniverseAgentRemoteAgentHealthCheckConfig,
	UniverseAgentRemoteAgentPermissionBudget,
	UniverseAgentRemoteAgentPermissionDelegate,
	UniverseAgentRemoteAgentWhitelistEntry,
	UniverseAgentSaveRemoteAgentConfigRequest,
} from '../../common/universeAgentTypes.js';
import { decodeCheckConnectionResponse, type ConnectionReportWire } from './grpcCheckConnectionUnaryWire.js';
import {
	encodeDouble,
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
 * JSON-shaped decode of RemoteAgentService.SaveRemoteAgentConfigResponse
 * scalars `success`=1 `message`=2 `async_test_id`=4.
 * Nested `connection_test`=3 is ConnectionReport via
 * `decodeCheckConnectionResponse` (`reachable`=1 `authenticated`=2
 * `can_create_session`=3 `latency_ms`=4 nested `capabilities`=5
 * `errors`=6 `load`=7). Shape matches
 * `mapSaveRemoteAgentConfigResponse`.
 */
export interface SaveRemoteAgentConfigResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly connection_test?: ConnectionReportWire;
	readonly async_test_id?: string;
}

/**
 * RemoteAgentService.SaveConfig — nested `config`=1 (RemoteAgentConfig)
 * `skip_connection_test`=2 `async_test`=3.
 * Config uses `encodePresentMessageField(1, inner)`. Inner:
 * `id`=1 `name`=2 `description`=3 `enabled`=4 nested `endpoint`=5
 * Endpoint (`host`=1 `port`=2 `tls`=3 `tls_cert_path`=4) nested `auth`=6
 * AuthConfig (`type`=1 `api_key_ref`=2 `token_ref`=3) repeated `tags`=7
 * `max_concurrent_sessions`=8 `session_lifecycle`=9 nested
 * `default_permission_delegate`=10 PermissionDelegate (`mode`=1 repeated
 * `whitelist`=2 WhitelistEntry (`tool_name`=1 repeated `arg_conditions`=2
 * ArgCondition `field`=1 `operator`=2 `value`=3) nested `budget`=3
 * PermissionBudget (`max_tool_calls`=1 `max_tokens`=2 `timeout_ms`=3
 * `window_ms`=4 `max_bubble_to_user_per_day`=5) `timeout_policy`=4
 * `fallback`=5 `bubble_target`=6) nested `health_check`=11
 * HealthCheckConfig (`interval_ms`=1 `timeout_ms`=2
 * `unhealthy_threshold`=3 `healthy_threshold`=4 `use_watch`=5
 * `degraded_error_rate_threshold`=6 `encodeDouble` IEEE 754 LE
 * `degraded_p99_latency_ms`=7). Nested 5/6/10/11 via
 * `encodeMessageField` (empty payload omitted).
 * Bool true via `encodeInt32Field(n, 1)`; omit false.
 * proto3: empty strings / empty repeated / 0 omitted.
 */
export function encodeSaveConfigRequest(request: UniverseAgentSaveRemoteAgentConfigRequest): Uint8Array {
	return Buffer.concat([
		encodePresentMessageField(1, encodeRemoteAgentConfig(request.config)),
		encodeInt32Field(2, request.skipConnectionTest ? 1 : 0),
		encodeInt32Field(3, request.asyncTest ? 1 : 0),
	]);
}

/**
 * SaveRemoteAgentConfigResponse — `success`=1 `message`=2
 * `connection_test`=3 `async_test_id`=4.
 * Nested `connection_test` length-delimited bytes go through
 * `decodeCheckConnectionResponse` (scalars 1–4 and nested 5/6/7).
 * proto3: false / empty omitted. Unknown fields unread.
 * Shape matches SaveRemoteAgentConfigResponseWire
 * `{ success?: boolean; message?: string; connection_test?: ConnectionReportWire; async_test_id?: string }`.
 */
export function decodeSaveConfigResponse(bytes: Uint8Array): SaveRemoteAgentConfigResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	const connectionTest = lastBytes(fields, 3);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		connection_test: connectionTest === undefined ? undefined : decodeCheckConnectionResponse(connectionTest),
		async_test_id: lastString(fields, 4),
	};
}

function encodeRemoteAgentConfig(config: UniverseAgentRemoteAgentConfig): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, config.id),
		encodeStringField(2, config.name),
		encodeStringField(3, config.description),
		encodeInt32Field(4, config.enabled ? 1 : 0),
		encodeMessageField(5, encodeEndpoint(config.endpoint)),
		encodeMessageField(6, encodeAuthConfig(config.auth)),
		...config.tags.map(tag => encodeStringField(7, tag)),
		encodeInt32Field(8, config.maxConcurrentSessions),
		encodeStringField(9, config.sessionLifecycle),
		encodeMessageField(10, encodePermissionDelegate(config.defaultPermissionDelegate)),
		encodeMessageField(11, encodeHealthCheckConfig(config.healthCheck)),
	]);
}

function encodeEndpoint(endpoint: UniverseAgentRemoteAgentEndpoint): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, endpoint.host),
		encodeInt32Field(2, endpoint.port),
		encodeInt32Field(3, endpoint.tls ? 1 : 0),
		encodeStringField(4, endpoint.tlsCertPath),
	]);
}

function encodeAuthConfig(auth: UniverseAgentRemoteAgentAuthConfig): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, auth.type),
		encodeStringField(2, auth.apiKeyRef),
		encodeStringField(3, auth.tokenRef),
	]);
}

function encodePermissionDelegate(delegate: UniverseAgentRemoteAgentPermissionDelegate): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, delegate.mode),
		...delegate.whitelist.map(entry => encodeMessageField(2, encodeWhitelistEntry(entry))),
		encodeMessageField(3, encodePermissionBudget(delegate.budget)),
		encodeStringField(4, delegate.timeoutPolicy),
		encodeStringField(5, delegate.fallback),
		encodeStringField(6, delegate.bubbleTarget),
	]);
}

function encodeWhitelistEntry(entry: UniverseAgentRemoteAgentWhitelistEntry): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, entry.toolName),
		...entry.argConditions.map(condition => encodeMessageField(2, encodeArgCondition(condition))),
	]);
}

function encodeArgCondition(condition: UniverseAgentRemoteAgentArgCondition): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, condition.field),
		encodeStringField(2, condition.operator),
		encodeStringField(3, condition.value),
	]);
}

function encodePermissionBudget(budget: UniverseAgentRemoteAgentPermissionBudget): Uint8Array {
	return Buffer.concat([
		encodeInt64Field(1, budget.maxToolCalls),
		encodeInt64Field(2, budget.maxTokens),
		encodeInt64Field(3, budget.timeoutMs),
		encodeInt64Field(4, budget.windowMs),
		encodeInt32Field(5, budget.maxBubbleToUserPerDay),
	]);
}

function encodeHealthCheckConfig(health: UniverseAgentRemoteAgentHealthCheckConfig): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, health.intervalMs),
		encodeInt32Field(2, health.timeoutMs),
		encodeInt32Field(3, health.unhealthyThreshold),
		encodeInt32Field(4, health.healthyThreshold),
		encodeInt32Field(5, health.useWatch ? 1 : 0),
		encodeDouble(6, health.degradedErrorRateThreshold),
		encodeInt32Field(7, health.degradedP99LatencyMs),
	]);
}
