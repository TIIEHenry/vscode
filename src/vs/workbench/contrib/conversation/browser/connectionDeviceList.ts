/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { HubDeviceProjection } from '../../../../platform/universeAgent/common/hub.js';
import type { UniverseAgentDeviceInfo } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Connection Devices paired list → ListDevices. Empty ids are still shown. */
export function canSendConnectionDeviceListRequest(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

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
