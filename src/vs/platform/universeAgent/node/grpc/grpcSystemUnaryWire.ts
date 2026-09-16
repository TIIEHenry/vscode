/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentShutdownRequest } from '../../common/universeAgentTypes.js';
import type {
	DoctorCheckWire,
	DoctorResponseWire,
	HealthCheckResponseWire,
	ShutdownResponseWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * SystemService.HealthCheck — `HealthCheckRequest` is empty (no fields).
 * proto3 empty message: 0 payload bytes, never JSON `{}`.
 */
export function encodeHealthCheckRequest(): Uint8Array {
	return new Uint8Array(0);
}

/**
 * HealthCheckResponse — `status`=1 `version`=2 `active_sessions`=3 `uptime_ms`=4.
 * Unknown fields unread. Shape matches `mapHealthCheckResponse` input.
 */
export function decodeHealthCheckResponse(bytes: Uint8Array): HealthCheckResponseWire {
	const fields = readProtoFields(bytes);
	return {
		status: lastString(fields, 1),
		version: lastString(fields, 2),
		active_sessions: numberOrUndefined(lastVarint(fields, 3)),
		uptime_ms: numberOrUndefined(lastVarint(fields, 4)),
	};
}

/**
 * SystemService.Shutdown — `force`=1 `grace_period_ms`=2.
 * proto3: false / 0 omitted.
 */
export function encodeShutdownRequest(request: UniverseAgentShutdownRequest): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, request.force === true ? 1 : 0),
		encodeInt32Field(2, request.gracePeriodMs),
	]);
}

/**
 * ShutdownResponse — `accepted`=1 `message`=2.
 * Unknown fields unread. Shape matches `mapShutdownResponse` input.
 */
export function decodeShutdownResponse(bytes: Uint8Array): ShutdownResponseWire {
	const fields = readProtoFields(bytes);
	return {
		accepted: lastVarint(fields, 1) === 1n,
		message: lastString(fields, 2),
	};
}

/**
 * SystemService.Doctor — `DoctorRequest` is empty (no fields).
 * proto3 empty message: 0 payload bytes, never JSON `{}`.
 */
export function encodeDoctorRequest(): Uint8Array {
	return new Uint8Array(0);
}

/**
 * DoctorResponse — repeated `checks`=1 `all_passed`=2.
 * DoctorCheck: `name`=1 `passed`=2 `message`=3 `fix_hint`=4.
 * proto3: false omitted. Unknown fields unread.
 * Shape matches `mapDoctorResponse` input.
 */
export function decodeDoctorResponse(bytes: Uint8Array): DoctorResponseWire {
	const fields = readProtoFields(bytes);
	const allPassed = lastVarint(fields, 2);
	return {
		checks: allLengthDelimited(fields, 1).map(decodeDoctorCheck),
		all_passed: allPassed === undefined ? undefined : allPassed === 1n,
	};
}

function decodeDoctorCheck(bytes: Uint8Array): DoctorCheckWire {
	const fields = readProtoFields(bytes);
	const passed = lastVarint(fields, 2);
	return {
		name: lastString(fields, 1),
		passed: passed === undefined ? undefined : passed === 1n,
		message: lastString(fields, 3),
		fix_hint: lastString(fields, 4),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
