/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Connection Devices Revoke → DeviceService.Revoke. Empty ids are still sent. */
export function canSendConnectionDeviceRevokeRequest(connected: boolean, hasHook: boolean, pairingHold = false): boolean {
	return connected && hasHook && !pairingHold;
}

/** Pass through empty `deviceId` as-is (no default / no trim). */
export function connectionDeviceRevokeIds(deviceId: string | undefined): { deviceId: string } {
	return { deviceId: deviceId ?? '' };
}
