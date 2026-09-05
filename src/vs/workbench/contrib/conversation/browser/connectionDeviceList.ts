/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { HubDeviceProjection } from '../../../../platform/universeAgent/common/hub.js';
import type { UniverseAgentDeviceInfo } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Connection Devices paired list → ListDevices. Empty ids are still shown. */
export function canSendConnectionDeviceListRequest(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Connection Devices paired-list action → RotateToken. Empty ids are still sent. */
export function canSendConnectionDeviceRotateToken(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Pass through empty `deviceId` as-is (no default / no trim). */
export function connectionDeviceRotateTokenIds(
	selected: { readonly id?: string } | undefined,
): { deviceId: string } {
	return { deviceId: selected?.id ?? '' };
}

export const CONNECTION_DEVICE_ROTATE_TOKEN_LABEL = localize(
	'ua.connectionDeviceRotateToken',
	"Rotate Token",
);

/**
 * Map DeviceInfo onto the existing paired-list row. Empty `deviceId` /
 * `displayName` stay empty (no default / no trim). `active` false stays
 * offline / not serving. `revoked` is not a ListDevices field — leave false.
 */
export function toConnectionPairedDevice(device: UniverseAgentDeviceInfo): HubDeviceProjection {
	return {
		id: device.deviceId,
		name: device.displayName,
		presence: device.active ? 'ONLINE' : 'OFFLINE',
		engineStatus: device.active ? 'SERVING' : 'NOT_SERVING',
		engineIdentityId: device.deviceId,
		revoked: false,
	};
}

/** Honest paired-row label. Empty displayName / role / platform stay empty. */
export function formatConnectionPairedDeviceLabel(device: UniverseAgentDeviceInfo): string {
	return `${device.displayName} — ${device.role} — ${device.platform}`;
}
