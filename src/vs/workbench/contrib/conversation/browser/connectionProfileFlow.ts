/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import type { UniverseAgentConnectProfileResult } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import { type ConnectionProfileProjection, IUniverseAgentHubService } from '../../../../platform/universeAgent/common/hub.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { asConnectionProfileList, isUniverseAgentPhaseConnected } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import {
	getConnectionPhaseTone,
	isRecoverTrustConnectResult,
	readHandshakeSasCode,
	readRecoverTrustLeafFingerprint,
	type ConnectionStatusTone,
} from './connectionPreferencesPaneLabels.js';
import { getConnectionTestStatusText } from './connectionPreferencesZone.js';
import { IConversationRosterService } from './conversationStubService.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';

/** Canonical direct-address label when the user leaves Name empty. */
export function directAddressEndpointLabel(host: string, port: number): string {
	return `${host}:${port}`;
}

/**
 * Port from the Direct Address field. The label says 1–65535.
 * `Number('')` is 0, so an empty field must not become a connect or add.
 */
export function readDirectAddressPort(value: string): number | undefined {
	const trimmed = value.trim();
	if (!/^[0-9]+$/.test(trimmed)) {
		return undefined;
	}
	const port = Number(trimmed);
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		return undefined;
	}
	return port;
}

/** directAddress rows whose displayName is exactly `host:port`. Name is not an endpoint. */
export function findDirectAddressProfilesForEndpoint(
	profiles: readonly ConnectionProfileProjection[],
	host: string,
	port: number,
	_displayNameInput?: string,
): readonly ConnectionProfileProjection[] {
	const canonical = directAddressEndpointLabel(host, port);
	return profiles.filter(profile =>
		profile.targetKind === 'directAddress'
		&& profile.displayName === canonical
	);
}

/** `host:port` with a trimmed, lowercased host. Friendly names are not endpoints. */
function normalizeDirectAddressEndpoint(host: string, port: number): string {
	return `${host.trim().toLowerCase()}:${port}`;
}

function directAddressEndpointFromLabel(label: string): string | undefined {
	const trimmed = label.trim();
	const colon = trimmed.lastIndexOf(':');
	if (colon <= 0) {
		return undefined;
	}
	const port = readDirectAddressPort(trimmed.slice(colon + 1));
	const host = trimmed.slice(0, colon).trim();
	if (!host || port === undefined) {
		return undefined;
	}
	return normalizeDirectAddressEndpoint(host, port);
}

export type ConnectProfileDiagnosticExtras = {
	readonly profilePairingPending?: boolean;
	readonly dialogError?: string;
};

/** Non-secret connect diagnostics for E2E / testStatus (never includes SAS codes). */
export function formatConnectProfileDiagnostics(
	result: UniverseAgentConnectProfileResult,
	extras?: ConnectProfileDiagnosticExtras,
): string {
	if (!result.ok) {
		return `ok=false reason=${result.reason}`;
	}
	const hasSas = !!readHandshakeSasCode(result);
	const recoverTrust = isRecoverTrustConnectResult(result);
	const pairingPending = result.pairingPending || hasSas;
	const parts = [
		'ok=true',
		`pairingPending=${pairingPending}`,
		`hasSas=${hasSas}`,
		`recoverTrust=${recoverTrust}`,
	];
	if (extras?.profilePairingPending) {
		parts.push('profilePairingPending=true');
	}
	if (extras?.dialogError) {
		parts.push(`dialogError=${extras.dialogError}`);
	}
	return parts.join(' ');
}

type DirectAddressEnsureResult =
	| { readonly ok: true; readonly profileId: string; readonly replacedProfileIds: readonly string[] }
	| { readonly ok: false; readonly reason: string };

function isConnectPairingPending(result: UniverseAgentConnectProfileResult): boolean {
	return result.ok && (result.pairingPending || !!readHandshakeSasCode(result));
}

/** Visible connect copy: honest, no SAS secrets, never pretends the engine is connected. */
export function formatConnectProfileStatusText(
	result: UniverseAgentConnectProfileResult,
	extras?: ConnectProfileDiagnosticExtras,
): string {
	if (extras?.dialogError) {
		return localize('ua.connectionPairingDialogFailed', "Pairing dialog failed — {0}", extras.dialogError);
	}
	if (!result.ok) {
		return result.reason;
	}
	if (extras?.profilePairingPending) {
		return localize(
			'ua.connectionConnectPairingStillPending',
			"This profile still needs pairing confirmation.",
		);
	}
	if (isRecoverTrustConnectResult(result)) {
		return localize('ua.connectionTrustRecoveryPending', "Trust recovery required — not connected yet.");
	}
	if (isConnectPairingPending(result)) {
		return localize('ua.connectionPairingPendingStatus', "Pairing pending — not connected yet.");
	}
	return localize('ua.connectionHandshakeSucceeded', "Profile accepted — pairing is complete.");
}

function pairingPromptDisplayName(profile: ConnectionProfileProjection | undefined, profileId: string): string {
	const name = profile?.displayName.trim();
	return name ? name : profileId;
}

/** What the connection pane supplies: form input, status lines, the list selection and the in-pane pairing prompts. */
export interface IConnectionProfileFlowHost {
	getActiveProfileId(): string | undefined;
	/** Direct write of the list selection; never goes through the list selection callback. */
	setActiveProfileId(profileId: string | undefined): void;
	readDirectAddressForm(): { readonly host: string; readonly port: number } | undefined;
	readDirectProfileFields(): { readonly displayName: string | undefined; readonly allowPrivateNetwork: boolean };
	writeConnectStatus(text: string, tone: ConnectionStatusTone): void;
	writeDirectStatus(text: string, tone: ConnectionStatusTone): void;
	updateConnectGates(): void;
	renderProfiles(): void;
	renderConnectionPhase(): void;
	isPairingConfirmHostLive(): boolean;
	isDeviceWritePairingHold(): boolean;
	isDeviceWriteListFailed(): boolean;
	isPendingWriteListFailed(): boolean;
	promptSasConfirm(options: { readonly displayName: string; readonly sasCode: string | undefined; readonly engineIdentityId: string }): Promise<{ readonly confirmed: boolean }>;
	promptRecoverTrustConfirm(options: { readonly displayName: string; readonly engineIdentityId: string; readonly leafSha256Hex: string }): Promise<{ readonly confirmed: boolean }>;
}

export interface IConnectionProfileFlow {
	/** Profile this flow settled a connect for. Not the list selection and not a snapshot field. */
	getSettledProfileId(): string | undefined;
	readonly onDidChangeSettledProfile: Event<string | undefined>;
	isConnectWriteHeld(): boolean;
	writeHoldReason(): string;
	connectDirectAddress(): Promise<void>;
	connectSelectedProfile(): Promise<void>;
	disconnect(): Promise<void>;
	forgetSelectedProfile(): Promise<void>;
	connectProfileWithPairing(profileId: string, options?: { readonly skipEngineSwitchConfirm?: boolean }): Promise<void>;
}

/**
 * Connect / forget / direct sequences of the connection pane. Holds no DOM.
 * The Direct Connect profile-write hold and `connectInFlight` stay two states:
 * the first is dropped synchronously before `connectProfileWithPairing`, which
 * refuses to dial while any hold is set and raises the second before its first await.
 */
export class ConnectionProfileFlow extends Disposable implements IConnectionProfileFlow {

	private readonly _onDidChangeSettledProfile = this._register(new Emitter<string | undefined>());
	readonly onDidChangeSettledProfile = this._onDidChangeSettledProfile.event;

	private settledProfileId: string | undefined;
	private connectInFlight = false;
	/** Direct Connect add / replaced-profile forget. */
	private directProfileWriteInFlight = false;
	/** True while the engine-switch warning is open, so a second click cannot dial. */
	private engineSwitchPromptOpen = false;
	private forgetProfileGeneration = 0;

	constructor(
		private readonly host: IConnectionProfileFlowHost,
		@IUniverseAgentHubService private readonly hubService: IUniverseAgentHubService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
		@IDialogService private readonly dialogService: IDialogService,
		@IConversationRosterService private readonly roster: IConversationRosterService,
	) {
		super();
	}

	getSettledProfileId(): string | undefined {
		return this.settledProfileId;
	}

	private setSettledProfileId(profileId: string | undefined): void {
		if (this.settledProfileId === profileId) {
			return;
		}
		this.settledProfileId = profileId;
		this._onDidChangeSettledProfile.fire(profileId);
	}

	isConnectWriteHeld(): boolean {
		return this.connectInFlight
			|| this.directProfileWriteInFlight
			|| this.engineSwitchPromptOpen
			|| this.host.isDeviceWritePairingHold()
			|| this.host.isPairingConfirmHostLive();
	}

	/** Copy order is not the order of {@link isConnectWriteHeld}: device pairing hold reads first. */
	writeHoldReason(): string {
		if (this.host.isDeviceWritePairingHold()) {
			return localize('ua.connectionActionPairingHold', "Engine not connected");
		}
		if (this.connectInFlight || this.directProfileWriteInFlight) {
			return localize('ua.connectionActionInFlight', "A connection is already in progress.");
		}
		if (this.engineSwitchPromptOpen) {
			return localize('ua.connectionActionEngineSwitch', "Confirm the engine switch before connecting.");
		}
		if (this.host.isPairingConfirmHostLive()) {
			return localize('ua.connectionActionPairingConfirm', "Finish pairing before this action.");
		}
		if (this.host.isDeviceWriteListFailed() || this.host.isPendingWriteListFailed()) {
			return localize('ua.connectionActionListFailed', "The list is not ready.");
		}
		return localize('ua.connectionActionUnavailable', "This action is unavailable right now.");
	}

	/**
	 * Sessions this window's roster lists, that still have a pending attention seat.
	 * Generating is not counted: there is no per-session read for it.
	 * Missing in pane unit tests; the workbench always registers the roster.
	 */
	private engineSwitchPendingAttentionCount(): number {
		const roster = this.roster as IConversationRosterService | undefined;
		if (!roster) {
			return 0;
		}
		let count = 0;
		for (const session of roster.getSessions()) {
			if (roster.hasPendingAttentionSeat(session.id)) {
				count++;
			}
		}
		return count;
	}

	/** Live direct-address `host:port`. Direct Address mints a new profileId on every connect. */
	private isSameConnectedDirectAddress(host: string, port: number): boolean {
		const profileId = this.settledProfileId;
		if (!profileId || !isUniverseAgentPhaseConnected(this.connectionService.getConnectionPhase())) {
			return false;
		}
		const profile = asConnectionProfileList(this.hubService.listConnectionProfiles())
			.find(item => item.profileId === profileId && item.targetKind === 'directAddress');
		if (!profile) {
			return false;
		}
		const current = directAddressEndpointFromLabel(profile.displayName);
		return current !== undefined && current === normalizeDirectAddressEndpoint(host, port);
	}

	/** False means cancel: caller must not forget, disconnect, or dial. */
	private async confirmEngineSwitchWhilePendingAttention(count: number): Promise<boolean> {
		this.engineSwitchPromptOpen = true;
		this.host.updateConnectGates();
		try {
			const message = count === 1
				? localize('ua.connectionSwitchEnginePendingOne', "This window has 1 open session waiting for confirmation.")
				: localize('ua.connectionSwitchEnginePendingMany', "This window has {0} open sessions waiting for confirmation.", count);
			const result = await this.dialogService.confirm({
				type: 'warning',
				message,
				detail: localize(
					'ua.connectionSwitchEnginePendingDetail',
					"Switching engines stays in this window and disconnects the current connection. Cancel keeps the current connection.",
				),
				primaryButton: localize('ua.connectionSwitchEngineContinue', "Continue"),
			});
			return result.confirmed;
		} finally {
			this.engineSwitchPromptOpen = false;
			this.host.updateConnectGates();
		}
	}

	async connectDirectAddress(): Promise<void> {
		if (this.isConnectWriteHeld()) {
			return;
		}
		const endpoint = this.host.readDirectAddressForm();
		if (!endpoint) {
			return;
		}
		const { host, port } = endpoint;
		// Before forget/disconnect/dial. A new profileId is minted later, so compare host:port.
		if (!this.isSameConnectedDirectAddress(host, port)) {
			const pendingAttention = this.engineSwitchPendingAttentionCount();
			if (pendingAttention > 0 && !(await this.confirmEngineSwitchWhilePendingAttention(pendingAttention))) {
				return;
			}
		}

		const { displayName, allowPrivateNetwork } = this.host.readDirectProfileFields();
		this.host.writeDirectStatus(
			localize('ua.connectionDirectConnecting', "Connecting…"),
			getConnectionPhaseTone({ kind: 'connecting', reason: 'initial' }),
		);
		this.directProfileWriteInFlight = true;
		this.host.updateConnectGates();
		let ensured: DirectAddressEnsureResult;
		try {
			ensured = await this.ensureDirectAddressProfileForConnect(host, port, displayName, allowPrivateNetwork);
		} finally {
			this.directProfileWriteInFlight = false;
			this.host.updateConnectGates();
		}
		if (!ensured.ok) {
			this.host.writeDirectStatus(ensured.reason, 'error');
			return;
		}

		this.host.setActiveProfileId(ensured.profileId);
		await this.connectProfileWithPairing(ensured.profileId, { skipEngineSwitchConfirm: true });
		// Old `host:port` profiles go only after the new one settled; a failed or pairing dial keeps them.
		if (this.settledProfileId === ensured.profileId) {
			const replaced = ensured.replacedProfileIds.filter(id => id !== ensured.profileId);
			this.directProfileWriteInFlight = true;
			this.host.updateConnectGates();
			try {
				await this.forgetReplacedDirectAddressProfiles(replaced);
			} finally {
				this.directProfileWriteInFlight = false;
				this.host.updateConnectGates();
			}
		}
		this.host.renderProfiles();
	}

	/** Adds the new profile; `replacedProfileIds` are the canonical `host:port` matches seen before the add. */
	private async ensureDirectAddressProfileForConnect(
		host: string,
		port: number,
		displayName: string | undefined,
		allowPrivateNetwork: boolean,
	): Promise<DirectAddressEnsureResult> {
		const profiles = asConnectionProfileList(this.hubService.listConnectionProfiles());
		const replacedProfileIds = findDirectAddressProfilesForEndpoint(profiles, host, port, displayName).map(match => match.profileId);
		const added = await this.hubService.addDirectAddressProfile({ host, port, displayName, allowPrivateNetwork });
		if (!added.ok) {
			return added;
		}
		return { ok: true, profileId: added.profileId, replacedProfileIds };
	}

	private async forgetReplacedDirectAddressProfiles(profileIds: readonly string[]): Promise<void> {
		for (const profileId of profileIds) {
			const forgot = await this.hubService.forgetConnectionProfile(profileId);
			if (!forgot.ok) {
				this.host.writeDirectStatus(forgot.reason, 'error');
				return;
			}
			if (profileId === this.settledProfileId) {
				try {
					await this.connectionService.disconnect();
				} catch (error) {
					const reason = error instanceof Error && error.message ? error.message : String(error);
					this.host.writeDirectStatus(reason, 'error');
					return;
				}
				if (this.settledProfileId === profileId) {
					this.setSettledProfileId(undefined);
				}
			}
		}
	}

	async connectSelectedProfile(): Promise<void> {
		if (this.isConnectWriteHeld()) {
			return;
		}
		const activeProfileId = this.host.getActiveProfileId();
		if (!activeProfileId) {
			this.host.writeConnectStatus(localize('ua.connectionNoActiveProfile', "Select a connection profile first."), 'warning');
			return;
		}
		await this.connectProfileWithPairing(activeProfileId);
		this.host.renderProfiles();
	}

	async disconnect(): Promise<void> {
		try {
			await this.connectionService.disconnect();
			this.setSettledProfileId(undefined);
			this.host.renderConnectionPhase();
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.host.writeConnectStatus(reason, 'error');
		}
	}

	async forgetSelectedProfile(): Promise<void> {
		const profileId = this.host.getActiveProfileId();
		if (!profileId) {
			return;
		}
		const generation = ++this.forgetProfileGeneration;
		try {
			const result = await this.hubService.forgetConnectionProfile(profileId);
			// A newer Forget owns the status line, but this call still drops the live
			// engine when it is the profile that was just forgotten.
			if (result.ok && profileId === this.settledProfileId && !this._store.isDisposed) {
				try {
					await this.connectionService.disconnect();
				} catch (error) {
					if (generation !== this.forgetProfileGeneration || this._store.isDisposed) {
						return;
					}
					const reason = error instanceof Error && error.message ? error.message : String(error);
					this.host.writeConnectStatus(reason, 'error');
					return;
				}
				if (this.settledProfileId === profileId) {
					this.setSettledProfileId(undefined);
				}
			}
			if (generation !== this.forgetProfileGeneration || this._store.isDisposed) {
				return;
			}
			if (!result.ok) {
				if (this.host.getActiveProfileId() === profileId) {
					this.host.writeConnectStatus(result.reason, 'error');
				}
				return;
			}
			if (this.host.getActiveProfileId() === profileId) {
				this.host.setActiveProfileId(undefined);
			}
			this.host.renderProfiles();
			this.host.renderConnectionPhase();
		} catch (error) {
			if (generation !== this.forgetProfileGeneration || this._store.isDisposed) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.host.writeConnectStatus(reason, 'error');
		}
	}

	/**
	 * In-pane Cancel disconnects and does not write trust.
	 * In-pane Confirm calls confirmPairing once with userConfirmed so the main-process dialog stays closed.
	 */
	private async applyInPanePairingDecision(
		confirmed: boolean,
		cancelled: UniverseAgentConnectProfileResult,
	): Promise<{ readonly finalResult: UniverseAgentConnectProfileResult; readonly statusPrefix?: string }> {
		if (!confirmed) {
			await this.connectionService.cancelPairing();
			return { finalResult: cancelled };
		}
		const confirmResult = await this.connectionService.confirmPairing({ userConfirmed: true });
		if (!confirmResult.ok) {
			await this.finishPairingAfterMainDialogDeclined();
			return { finalResult: confirmResult, statusPrefix: confirmResult.reason };
		}
		return { finalResult: confirmResult };
	}

	async connectProfileWithPairing(profileId: string, options?: { readonly skipEngineSwitchConfirm?: boolean }): Promise<void> {
		if (this.isConnectWriteHeld()) {
			return;
		}
		// Before dial. Direct Address already gated, and its new profileId must not prompt again.
		if (!options?.skipEngineSwitchConfirm && profileId !== this.settledProfileId) {
			const pendingAttention = this.engineSwitchPendingAttentionCount();
			if (pendingAttention > 0 && !(await this.confirmEngineSwitchWhilePendingAttention(pendingAttention))) {
				return;
			}
		}
		this.connectInFlight = true;
		this.host.updateConnectGates();
		try {
			this.host.setActiveProfileId(profileId);
			const profiles = asConnectionProfileList(this.hubService.listConnectionProfiles());
			const profile = profiles.find(p => p.profileId === profileId);
			this.host.writeConnectStatus(
				getConnectionTestStatusText({ kind: 'connecting', reason: 'initial' }),
				getConnectionPhaseTone({ kind: 'connecting', reason: 'initial' }),
			);
			let result: Awaited<ReturnType<IUniverseAgentConnection['connectProfile']>>;
			try {
				result = await this.connectionService.connectProfile(profileId);
			} catch (error) {
				const reason = error instanceof Error ? error.message : String(error);
				this.host.writeConnectStatus(reason, 'error');
				this.host.renderConnectionPhase();
				return;
			}
			let dialogError: string | undefined;
			let statusPrefix: string | undefined;
			let finalResult: UniverseAgentConnectProfileResult = result;
			if (!result.ok) {
				this.host.writeConnectStatus(formatConnectProfileStatusText(result), 'error');
				this.host.renderConnectionPhase();
				return;
			}

			const awaitingPairing = result.pairingPending || !!readHandshakeSasCode(result);
			const profilePairingPending = profile?.state === 'pairingPending';

			if (!awaitingPairing && profilePairingPending) {
				statusPrefix = localize(
					'ua.connectionConnectPairingStillPending',
					"This profile still needs pairing confirmation.",
				);
				this.setConnectTestStatus(statusPrefix, result, { profilePairingPending: true });
				this.host.renderConnectionPhase();
				return;
			}

			if (awaitingPairing) {
				this.setConnectTestStatus(undefined, result);
				try {
					if (isRecoverTrustConnectResult(result)) {
						const leafSha256Hex = readRecoverTrustLeafFingerprint(result);
						if (!leafSha256Hex) {
							statusPrefix = localize(
								'ua.connectionRecoverTrustMissingFingerprint',
								"Trust recovery requires the observed certificate fingerprint.",
							);
							await this.connectionService.cancelPairing();
							finalResult = { ok: false, code: 'trust_missing', reason: statusPrefix };
						} else {
							const decision = await this.host.promptRecoverTrustConfirm({
								displayName: pairingPromptDisplayName(profile, profileId),
								engineIdentityId: result.engineIdentityId ?? '',
								leafSha256Hex,
							});
							const applied = await this.applyInPanePairingDecision(decision.confirmed, {
								ok: false,
								code: 'recover_cancelled',
								reason: 'user cancelled recoverTrust confirmation',
							});
							finalResult = applied.finalResult;
							statusPrefix = applied.statusPrefix;
						}
					} else {
						const decision = await this.host.promptSasConfirm({
							displayName: pairingPromptDisplayName(profile, profileId),
							sasCode: readHandshakeSasCode(result),
							engineIdentityId: result.engineIdentityId ?? '',
						});
						const applied = await this.applyInPanePairingDecision(decision.confirmed, {
							ok: false,
							code: 'sas_cancelled',
							reason: 'user cancelled SAS confirmation',
						});
						finalResult = applied.finalResult;
						statusPrefix = applied.statusPrefix;
					}
				} catch (error) {
					dialogError = error instanceof Error && error.message ? error.message : String(error);
					await this.connectionService.cancelPairing().catch(() => undefined);
				}
			}

			this.setConnectTestStatus(statusPrefix, finalResult, {
				profilePairingPending: profilePairingPending && !awaitingPairing ? true : undefined,
				dialogError,
			});
			// Settled accept only. The pairing-still-pending return above must not record a connect.
			this.rememberSettledConnect(profileId, finalResult);
			this.host.renderConnectionPhase();
			this.host.renderProfiles();
		} finally {
			this.connectInFlight = false;
			this.host.updateConnectGates();
		}
	}

	/** Confirm returned a failure after the in-pane prompt. Disconnect only while pairing is still held — no second dialog. */
	private async finishPairingAfterMainDialogDeclined(): Promise<void> {
		if (this.connectionService.getConnectionSnapshot().pairingPending || isConversationPairingHold(this.connectionService)) {
			await this.connectionService.cancelPairing().catch(() => undefined);
		}
	}

	/** Pairing, recoverTrust, and failed connects leave any recorded id unchanged. */
	private rememberSettledConnect(profileId: string, result: UniverseAgentConnectProfileResult): void {
		if (!result.ok || isConnectPairingPending(result) || isRecoverTrustConnectResult(result)) {
			return;
		}
		this.setSettledProfileId(profileId);
	}

	private setConnectTestStatus(
		prefix: string | undefined,
		result: UniverseAgentConnectProfileResult,
		extras?: ConnectProfileDiagnosticExtras,
	): void {
		const text = prefix ?? formatConnectProfileStatusText(result, extras);
		const pairingPending = extras?.profilePairingPending || isConnectPairingPending(result) || isRecoverTrustConnectResult(result);
		const tone: ConnectionStatusTone = extras?.dialogError || !result.ok || extras?.profilePairingPending
			? 'error'
			: pairingPending
				? 'warning'
				: 'neutral';
		this.host.writeConnectStatus(text, tone);
	}
}
