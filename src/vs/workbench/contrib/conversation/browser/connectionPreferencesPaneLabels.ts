/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { ConnectionPhase } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import type { HubAuthStatus, HubDeviceProjection, HubDirectoryStatus } from '../../../../platform/universeAgent/common/hub.js';

/** §3.7 presence matrix — device row status label. */
export function getHubDeviceRowStatusLabel(device: HubDeviceProjection): string {
	if (device.revoked) {
		return localize('ua.connectionDeviceRevoked', "Revoked");
	}
	if (device.presence === 'OFFLINE') {
		return localize('ua.connectionDeviceOffline', "Offline (unreachable via Hub)");
	}
	if (device.engineStatus === 'NOT_SERVING') {
		return localize('ua.connectionDeviceNotServing', "Engine unavailable");
	}
	if (device.engineStatus === 'SERVING') {
		return localize('ua.connectionDeviceAvailable', "Available");
	}
	return localize('ua.connectionDeviceUnknown', "Unknown");
}

export function canConnectHubDevice(device: HubDeviceProjection, directoryStatus: HubDirectoryStatus): boolean {
	if (directoryStatus.kind === 'authExpired' || directoryStatus.kind === 'unreachable' || directoryStatus.kind === 'error') {
		return false;
	}
	if (device.revoked) {
		return false;
	}
	if (device.presence === 'OFFLINE') {
		return false;
	}
	return device.engineStatus === 'SERVING';
}

/** Hub account zone badge copy. */
export function getHubAuthStatusLabel(status: HubAuthStatus): string {
	switch (status.kind) {
		case 'signedOut':
			return localize('ua.connectionHubSignedOut', "Not signed in");
		case 'signedIn':
			return localize('ua.connectionHubSignedIn', "Signed in as {0}", status.email);
		case 'mustChangePassword':
			return localize('ua.connectionHubMustChangePassword', "Password change required");
		case 'authExpired':
			return localize('ua.connectionHubAuthExpired', "Hub sign-in expired");
		case 'unavailable':
			return localize('ua.connectionHubUnavailable', "Hub unavailable in this environment");
		default:
			return localize('ua.connectionHubSignedOut', "Not signed in");
	}
}

/** Directory-level banner when live listing fails. */
export function getHubDirectoryBannerLabel(status: HubDirectoryStatus): string | undefined {
	switch (status.kind) {
		case 'authExpired':
			return localize('ua.connectionHubAuthExpired', "Hub sign-in expired");
		case 'unreachable':
			return localize('ua.connectionHubUnreachable', "Hub unreachable");
		case 'error':
			return localize('ua.connectionHubDirectoryError', "Hub directory error");
		default:
			return undefined;
	}
}

/** Connection phase label for pane device row / profile row (not StatusBar — H4b). */
export function getConnectionPhasePaneLabel(phase: ConnectionPhase): string {
	switch (phase.kind) {
		case 'disconnected':
			return localize('ua.connectionPhaseDisconnected', "Not connected");
		case 'connecting':
			return phase.reason === 'transport_lost'
				? localize('ua.connectionPhaseReconnecting', "Reconnecting…")
				: localize('ua.connectionPhaseConnecting', "Connecting…");
		case 'connected':
			return phase.path === 'hubRelay'
				? localize('ua.connectionPhaseConnectedRelay', "Engine · Hub relay")
				: phase.path === 'direct'
					? localize('ua.connectionPhaseConnectedDirect', "Engine · Direct")
					: localize('ua.connectionPhaseConnectedLoopback', "Engine · Loopback");
		case 'failed':
			return localize('ua.connectionPhaseFailed', "Connection failed ({0})", phase.code);
		case 'closed':
			return localize('ua.connectionPhaseClosed', "Disconnected");
		default:
			return localize('ua.connectionPhaseDisconnected', "Not connected");
	}
}

export const SAS_CONFIRM_BUTTON_LABEL = localize('ua.connectionSasConfirm', "Verified on Engine");
export const SAS_CANCEL_BUTTON_LABEL = localize('ua.connectionSasCancel', "Cancel");

/** Forbidden SAS dialog button labels (must stay absent). */
export const SAS_FORBIDDEN_BUTTON_PATTERNS = [
	/skip/i,
	/trust/i,
	/跳过/,
	/信任/,
] as const;

export function formatSasDialogBody(input: {
	readonly displayName: string;
	readonly sasCode: string;
	readonly engineIdentityId: string;
}): string {
	const idPrefix = input.engineIdentityId.slice(0, 8);
	return localize(
		'ua.connectionSasBody',
		"Verify the short code on Engine \"{0}\" matches {1}. Engine identity prefix: {2}.",
		input.displayName,
		input.sasCode,
		idPrefix,
	);
}
