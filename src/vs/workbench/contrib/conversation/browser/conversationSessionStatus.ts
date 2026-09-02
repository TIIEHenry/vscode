/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { ConnectionFailureCode, ConnectionPhase } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { ConversationStubSession } from './conversationStubModel.js';

/** Pure mapping from stub session metadata to StatusBar label text. */
export function getConversationSessionStatusText(session: ConversationStubSession | undefined): string {
	const title = session?.title?.trim();
	if (!title) {
		return localize('conversationStatus.noSession', "No session");
	}
	return title;
}

/** Legacy boolean helper — identity strip still uses disconnected copy until wired. */
export function getConversationEngineStatusText(isConnected = false): string {
	if (isConnected) {
		return localize('conversationStatus.engineConnected', "Engine connected");
	}
	return localize('conversationStatus.engineNotConnected', "Engine not connected");
}

function getConnectionFailureStatusBarText(code: ConnectionFailureCode): string {
	switch (code) {
		case 'trust_missing':
			return localize('conversationStatus.failureTrustMissing', "Trust not established");
		case 'private_network_denied':
			return localize('conversationStatus.failurePrivateNetwork', "Private network denied");
		case 'pairing_required':
			return localize('conversationStatus.failurePairingRequired', "Pairing required");
		case 'sas_mismatch':
			return localize('conversationStatus.failureSasMismatch', "SAS code mismatch");
		case 'grant_pending':
			return localize('conversationStatus.failureGrantPending', "Grant pending on Engine");
		case 'grant_revoked':
			return localize('conversationStatus.failureGrantRevoked', "Grant revoked");
		case 'pin_mismatch':
			return localize('conversationStatus.failurePinMismatch', "Pin mismatch");
		case 'hub_session_required':
			return localize('conversationStatus.failureHubSessionRequired', "Hub sign-in required");
		case 'hub_password_change_required':
			return localize('conversationStatus.failureHubPasswordChange', "Hub password change required");
		case 'hub_auth_expired':
			return localize('conversationStatus.failureHubAuthExpired', "Hub sign-in expired");
		case 'hub_unreachable':
			return localize('conversationStatus.failureHubUnreachable', "Hub unreachable");
		case 'hub_device_not_in_directory':
			return localize('conversationStatus.failureHubDeviceMissing', "Engine not in Hub directory");
		case 'hub_device_revoked':
			return localize('conversationStatus.failureHubDeviceRevoked', "Engine revoked");
		case 'engine_not_serving':
			return localize('conversationStatus.failureEngineNotServing', "Engine unavailable");
		case 'hub_ticket_failed':
			return localize('conversationStatus.failureHubTicket', "Hub relay ticket failed");
		case 'hub_rate_limited':
			return localize('conversationStatus.failureHubRateLimited', "Hub rate limited");
		case 'transport_failed':
			return localize('conversationStatus.failureTransport', "Connection failed");
		default:
			return localize('conversationStatus.failureTransport', "Connection failed");
	}
}

/** StatusBar engine chip copy per connection-hub-client §4.2 (pairing-pending stays not connected). */
export function getConnectionPhaseStatusBarText(phase: ConnectionPhase, pairingPending = false): string {
	if (pairingPending) {
		return localize('conversationStatus.engineNotConnected', "Engine not connected");
	}
	switch (phase.kind) {
		case 'disconnected':
		case 'closed':
			return localize('conversationStatus.engineNotConnected', "Engine not connected");
		case 'connecting':
			return phase.reason === 'transport_lost'
				? localize('conversationStatus.engineReconnecting', "Reconnecting…")
				: localize('conversationStatus.engineConnecting', "Connecting…");
		case 'connected':
			return phase.path === 'hubRelay'
				? localize('conversationStatus.engineConnectedHubRelay', "Engine · Hub relay")
				: phase.path === 'direct'
					? localize('conversationStatus.engineConnectedDirect', "Engine · Direct")
					: localize('conversationStatus.engineConnectedLoopback', "Engine · Loopback");
		case 'failed':
			return getConnectionFailureStatusBarText(phase.code);
		default:
			return localize('conversationStatus.engineNotConnected', "Engine not connected");
	}
}

/** Honest session-model echo when Conversation seat is hidden (matches Dock phrasing). */
export function getConversationModelEchoStatusText(): string {
	return localize('conversationStatus.noModel', "No model");
}

/**
 * UI-INV-14: StatusBar `session-model` echo only when Conversation part is hidden;
 * Dock owns model while the seat is visible.
 */
export function shouldShowConversationModelEchoInStatusBar(isConversationPartVisible: boolean): boolean {
	return !isConversationPartVisible;
}

/** Show and focus the center ConversationPart (default Code window shell). */
export function showConversationPart(accessor: ServicesAccessor): void {
	const layoutService = accessor.get(IWorkbenchLayoutService);
	const conversationPartService = accessor.get(IConversationPartService);
	if (!layoutService.isVisible(Parts.CONVERSATION_PART)) {
		layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
	}
	conversationPartService.focus();
}
