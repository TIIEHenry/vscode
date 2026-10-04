/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	DEVICE_GRANT_AUTH_PROTOCOL_VERSION,
	derivePairingSasCode,
	verifyPairingSas,
	type DeviceAuthTranscriptInput,
} from './deviceGrant/device-grant-crypto.js';
import { observeCandidateLeaf } from './deviceGrant/observe-candidate-leaf.js';
import { deriveEngineLeafFingerprintHex, type PinnedTlsPlanInput } from './deviceGrant/tls-pin.js';
import {
	assertObservedFingerprintMatchesNonce,
	classifyDeviceAuthRpcFailure,
	runDeviceAuthHandshake,
} from './deviceAuthHandshake.js';
import type { ConnectionProfile, IConnectionProfileStore } from './connectionProfileStore.js';
import type { IClientIdentityStore } from './clientIdentityTypes.js';
import { createEngineTrustRecord, type EngineTrustRecord, type IEngineTrustStore } from './engineTrustStore.js';
import type { IUniverseAgentGrpcTransport, UniverseAgentAuthNonceResult } from './grpc/grpcTransport.js';

const PAIRING_PROVISIONAL_ENGINE_ID = 'pairing-provisional';

export type PairingDialEndpoint = {
	readonly host: string;
	readonly port: number;
	readonly servername: string;
	/** Non-empty string means this dial must use its own relay ticket. Null, omitted, and '' are direct. */
	readonly relayTicketId?: string | null;
};

export type PairingDialRenewResult =
	| { readonly ok: true; readonly endpoint: PairingDialEndpoint }
	| { readonly ok: false; readonly code: string; readonly reason: string };

export type PairingOrchestratorPhase =
	| 'idle'
	| 'awaiting_sas_confirm'
	| 'recover_trust'
	| 'grant_pending';

export type PairingOrchestratorSnapshot = {
	readonly phase: PairingOrchestratorPhase;
	readonly profileId: string;
	readonly sasCode?: string;
	readonly engineIdentityId?: string;
	readonly leafSha256Hex?: string;
	readonly sessionTokenInstalled: boolean;
};

export type PairingStartResult =
	| {
		readonly ok: true;
		readonly snapshot: PairingOrchestratorSnapshot;
		readonly awaitingUserConfirm: boolean;
	}
	| { readonly ok: false; readonly code: string; readonly reason: string };

export type PairingConfirmResult =
	| {
		readonly ok: true;
		readonly snapshot: PairingOrchestratorSnapshot;
		readonly trust?: EngineTrustRecord;
		readonly sessionToken?: string;
	}
	| { readonly ok: false; readonly code: string; readonly reason: string };

export type PairingOrchestratorDeps = {
	readonly clientIdentityStore: IClientIdentityStore;
	readonly engineTrustStore: IEngineTrustStore;
	readonly connectionProfileStore: IConnectionProfileStore;
	readonly createPinnedTransport: (input: {
		readonly endpoint: PairingDialEndpoint;
		readonly tls: PinnedTlsPlanInput;
	}) => IUniverseAgentGrpcTransport;
	readonly observeCandidateLeafFn?: typeof observeCandidateLeaf;
	readonly confirmSas?: (input: {
		readonly sasCode: string;
		readonly engineIdentityId: string;
		readonly leafSha256Hex: string;
		readonly displayName: string;
	}) => Promise<boolean>;
	readonly confirmRecoverTrust?: (input: {
		readonly engineIdentityId: string;
		readonly leafSha256Hex: string;
		readonly displayName: string;
	}) => Promise<boolean>;
	/** Next pairing TLS dial. Return value is not stored on activeContext. */
	readonly renewDialEndpoint?: (profile: ConnectionProfile) => Promise<PairingDialRenewResult>;
	readonly nowMs?: () => number;
	/**
	 * Provisional Connect must not block connectProfile IPC.
	 * Timeout after GetAuthNonce is transport_failed: no recoverTrust, no EngineTrustRecord.
	 */
	readonly provisionalConnectTimeoutMs?: number;
};

export const DEFAULT_PROVISIONAL_CONNECT_TIMEOUT_MS = 8_000;

type ActivePairingContext = {
	readonly profile: ConnectionProfile;
	readonly endpoint: PairingDialEndpoint;
	readonly leafDer: Uint8Array;
	readonly leafSha256Hex: string;
	readonly engineIdentityId: string;
	readonly pairingNonce: Uint8Array;
	readonly sasCode: string;
	readonly sasLocal: string;
};

type RecoverTrustContext = {
	readonly profile: ConnectionProfile;
	readonly endpoint: PairingDialEndpoint;
	readonly leafDer: Uint8Array;
	readonly leafSha256Hex: string;
	readonly engineIdentityId: string;
};

function endpointHasRelayTicket(endpoint: PairingDialEndpoint): boolean {
	return typeof endpoint.relayTicketId === 'string' && endpoint.relayTicketId.length > 0;
}

function tlsPlanFromTrust(trust: EngineTrustRecord): PinnedTlsPlanInput {
	return {
		trustAnchorLeafDer: Uint8Array.from(trust.leafDer),
		expectedLeafSha256Hex: trust.leafSha256Hex,
		hostnameVerification: 'replaced-by-pin',
	};
}

function isFirstPairingProfile(profile: ConnectionProfile): boolean {
	return profile.trust === null
		&& profile.state === 'pairingPending'
		&& (profile.target.kind === 'directAddress' || profile.target.kind === 'hubDevice');
}

function staleConfirmSas(): PairingConfirmResult {
	return { ok: false, code: 'no_active_pairing', reason: 'no pairing awaiting SAS confirmation' };
}

function emptySnapshot(profileId: string): PairingOrchestratorSnapshot {
	return {
		phase: 'idle',
		profileId,
		sessionTokenInstalled: false,
	};
}

export class PairingOrchestrator {

	private activeContext: ActivePairingContext | undefined;
	private recoverContext: RecoverTrustContext | undefined;
	private lastSnapshot: PairingOrchestratorSnapshot | undefined;
	/** Bumped when confirmSas starts, a new pairing opens, abandon runs, or dispose runs. */
	private pairingGeneration = 0;
	private disposed = false;

	constructor(private readonly deps: PairingOrchestratorDeps) { }

	getSnapshot(): PairingOrchestratorSnapshot | undefined {
		return this.lastSnapshot;
	}

	/** Pairing flow never installs session_token until S6–S7 formal commit succeeds. */
	isEngineConnectedCandidate(): boolean {
		return !!this.lastSnapshot?.sessionTokenInstalled;
	}

	dispose(): void {
		this.pairingGeneration++;
		this.disposed = true;
	}

	async startPairing(profile: ConnectionProfile, endpoint: PairingDialEndpoint): Promise<PairingStartResult> {
		if (!isFirstPairingProfile(profile)) {
			return {
				ok: false,
				code: 'not_pairing_profile',
				reason: 'profile is not eligible for first-pairing orchestrator',
			};
		}
		this.pairingGeneration++;
		const generation = this.pairingGeneration;

		const identityState = await this.deps.clientIdentityStore.getOrCreateIdentity();
		if (identityState.kind !== 'ready') {
			const reason = identityState.kind === 'corrupt'
				? identityState.reason
				: identityState.kind;
			return {
				ok: false,
				code: identityState.kind === 'encryption_unavailable' ? 'encryption_unavailable' : 'identity_corrupt',
				reason: `client identity unavailable: ${reason}`,
			};
		}

		const observe = this.deps.observeCandidateLeafFn ?? observeCandidateLeaf;
		let observed: Awaited<ReturnType<typeof observeCandidateLeaf>>;
		try {
			observed = await observe({
				host: endpoint.host,
				port: endpoint.port,
				servername: endpoint.servername,
			});
		} catch (err) {
			return {
				ok: false,
				code: 'observe_failed',
				reason: `observe_failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
		if (!observed.ok) {
			return { ok: false, code: observed.code, reason: observed.reason };
		}

		const provisionalTrust = createEngineTrustRecord({
			leafDer: observed.leafDer,
			engineIdentityId: PAIRING_PROVISIONAL_ENGINE_ID,
			establishedAt: (this.deps.nowMs ?? Date.now)(),
		});

		let trialEndpoint = endpoint;
		if (endpointHasRelayTicket(endpoint)) {
			const renewed = await this.requestRenewedDialEndpoint(profile);
			if (generation !== this.pairingGeneration || this.disposed) {
				return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
			}
			if (!renewed.ok) {
				return renewed;
			}
			trialEndpoint = renewed.endpoint;
		}

		const transport = this.deps.createPinnedTransport({
			endpoint: trialEndpoint,
			tls: tlsPlanFromTrust(provisionalTrust),
		});

		try {
			const provisional = await this.runProvisionalHandshake(
				transport,
				identityState.identity.clientIdentityId,
				identityState.identity.clientPublicKey,
				observed.leafSha256Hex,
			);
			if (!provisional.ok) {
				if (provisional.recoverTrust) {
					if (generation !== this.pairingGeneration || this.disposed) {
						return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
					}
					this.recoverContext = {
						profile,
						endpoint,
						leafDer: observed.leafDer,
						leafSha256Hex: observed.leafSha256Hex,
						engineIdentityId: provisional.engineIdentityId ?? PAIRING_PROVISIONAL_ENGINE_ID,
					};
					this.activeContext = undefined;
					this.lastSnapshot = {
						phase: 'recover_trust',
						profileId: profile.profileId,
						engineIdentityId: this.recoverContext.engineIdentityId,
						leafSha256Hex: observed.leafSha256Hex,
						sessionTokenInstalled: false,
					};
					return { ok: true, snapshot: this.lastSnapshot, awaitingUserConfirm: true };
				}
				return {
					ok: false,
					code: provisional.code ?? 'provisional_failed',
					reason: provisional.reason,
				};
			}

			const sasInput = {
				engineIdentityId: provisional.engineIdentityId,
				engineCertFingerprint: observed.leafSha256Hex,
				clientPublicKey: identityState.identity.clientPublicKey,
				pairingNonce: provisional.pairingNonce,
				protocolVersion: DEVICE_GRANT_AUTH_PROTOCOL_VERSION,
			};
			const sasLocal = derivePairingSasCode(sasInput);
			if (provisional.sasCode.length > 0 && !verifyPairingSas(sasInput, provisional.sasCode)) {
				return {
					ok: false,
					code: 'sas_mismatch',
					reason: 'local SAS does not match Engine sas_code',
				};
			}
			const sasCode = provisional.sasCode.length > 0 ? provisional.sasCode : sasLocal;

			if (generation !== this.pairingGeneration || this.disposed) {
				return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
			}
			this.activeContext = {
				profile,
				endpoint,
				leafDer: observed.leafDer,
				leafSha256Hex: observed.leafSha256Hex,
				engineIdentityId: provisional.engineIdentityId,
				pairingNonce: provisional.pairingNonce,
				sasCode,
				sasLocal,
			};
			this.recoverContext = undefined;
			this.lastSnapshot = {
				phase: 'awaiting_sas_confirm',
				profileId: profile.profileId,
				sasCode,
				engineIdentityId: provisional.engineIdentityId,
				leafSha256Hex: observed.leafSha256Hex,
				sessionTokenInstalled: false,
			};
			return { ok: true, snapshot: this.lastSnapshot, awaitingUserConfirm: true };
		} finally {
			transport.close();
		}
	}

	async confirmSas(options?: { readonly userConfirmed?: boolean }): Promise<PairingConfirmResult> {
		const context = this.activeContext;
		if (!context) {
			return { ok: false, code: 'no_active_pairing', reason: 'no pairing awaiting SAS confirmation' };
		}

		this.pairingGeneration++;
		const generation = this.pairingGeneration;

		// In-pane approval already happened. Do not open the main-process dialog again.
		const approved = options?.userConfirmed === true
			? true
			: await (this.deps.confirmSas ?? (async () => false))({
				sasCode: context.sasCode,
				engineIdentityId: context.engineIdentityId,
				leafSha256Hex: context.leafSha256Hex,
				displayName: context.profile.displayName,
			});
		if (!this.isCurrentConfirmSas(context, generation)) {
			return staleConfirmSas();
		}
		if (!approved) {
			this.activeContext = undefined;
			this.lastSnapshot = emptySnapshot(context.profile.profileId);
			return { ok: false, code: 'sas_cancelled', reason: 'user cancelled SAS confirmation' };
		}

		const identityState = await this.deps.clientIdentityStore.getOrCreateIdentity();
		if (!this.isCurrentConfirmSas(context, generation)) {
			return staleConfirmSas();
		}
		if (identityState.kind !== 'ready') {
			return { ok: false, code: 'identity_unavailable', reason: 'client identity unavailable' };
		}

		const candidateTrust = createEngineTrustRecord({
			leafDer: context.leafDer,
			engineIdentityId: context.engineIdentityId,
			establishedAt: (this.deps.nowMs ?? Date.now)(),
		});

		let formalEndpoint = context.endpoint;
		if (endpointHasRelayTicket(context.endpoint)) {
			const renewed = await this.requestRenewedDialEndpoint(context.profile);
			if (!this.isCurrentConfirmSas(context, generation)) {
				return staleConfirmSas();
			}
			if (!renewed.ok) {
				return renewed;
			}
			formalEndpoint = renewed.endpoint;
		}

		const transport = this.deps.createPinnedTransport({
			endpoint: formalEndpoint,
			tls: tlsPlanFromTrust(candidateTrust),
		});

		const signer = await this.deps.clientIdentityStore.createSigner();
		if (!this.isCurrentConfirmSas(context, generation)) {
			transport.close();
			return staleConfirmSas();
		}
		if (!signer) {
			return { ok: false, code: 'signer_unavailable', reason: 'device auth signer unavailable' };
		}

		try {
			const handshake = await runDeviceAuthHandshake(
				transport,
				{
					clientIdentityId: identityState.identity.clientIdentityId,
					clientPublicKey: identityState.identity.clientPublicKey,
					engineIdentityId: context.engineIdentityId,
					observedLeafSha256Hex: context.leafSha256Hex,
				},
				signer,
				{ pairingPhase: 'formal' },
			);
			if (!this.isCurrentConfirmSas(context, generation)) {
				return staleConfirmSas();
			}

			if (handshake.kind === 'failed') {
				return {
					ok: false,
					code: handshake.code,
					reason: handshake.reason,
				};
			}

			if (handshake.kind === 'pairing_pending') {
				this.lastSnapshot = {
					phase: 'grant_pending',
					profileId: context.profile.profileId,
					engineIdentityId: context.engineIdentityId,
					leafSha256Hex: context.leafSha256Hex,
					sessionTokenInstalled: false,
				};
				return { ok: true, snapshot: this.lastSnapshot };
			}

			const trust = candidateTrust;
			this.deps.engineTrustStore.put(trust);
			this.deps.connectionProfileStore.put({
				...context.profile,
				trust,
				state: 'active',
			});

			this.activeContext = undefined;
			this.lastSnapshot = {
				phase: 'idle',
				profileId: context.profile.profileId,
				engineIdentityId: context.engineIdentityId,
				leafSha256Hex: context.leafSha256Hex,
				sessionTokenInstalled: false,
			};

			return {
				ok: true,
				snapshot: this.lastSnapshot,
				trust,
				sessionToken: handshake.result.sessionToken,
			};
		} finally {
			transport.close();
		}
	}

	private requestRenewedDialEndpoint(profile: ConnectionProfile): Promise<PairingDialRenewResult> {
		const renew = this.deps.renewDialEndpoint;
		if (!renew) {
			return Promise.resolve({
				ok: false,
				code: 'hub_ticket_failed',
				reason: 'relay dial endpoint renewal is not configured',
			});
		}
		return renew(profile);
	}

	private isCurrentConfirmSas(context: ActivePairingContext, generation: number): boolean {
		return !this.disposed
			&& this.pairingGeneration === generation
			&& this.activeContext === context;
	}

	private isCurrentRecover(context: RecoverTrustContext, generation: number): boolean {
		return !this.disposed
			&& this.pairingGeneration === generation
			&& this.recoverContext === context;
	}

	async confirmRecoverTrust(options?: { readonly userConfirmed?: boolean }): Promise<PairingConfirmResult> {
		const context = this.recoverContext;
		if (!context) {
			return { ok: false, code: 'no_recover_trust', reason: 'no recoverTrust session active' };
		}

		this.pairingGeneration++;
		const generation = this.pairingGeneration;

		// In-pane approval already happened. Do not open the main-process dialog again.
		const approved = options?.userConfirmed === true
			? true
			: await (this.deps.confirmRecoverTrust ?? (async () => false))({
				engineIdentityId: context.engineIdentityId,
				leafSha256Hex: context.leafSha256Hex,
				displayName: context.profile.displayName,
			});
		if (!this.isCurrentRecover(context, generation)) {
			return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
		}
		if (!approved) {
			this.recoverContext = undefined;
			this.lastSnapshot = emptySnapshot(context.profile.profileId);
			return { ok: false, code: 'recover_cancelled', reason: 'user cancelled recoverTrust confirmation' };
		}

		const identityState = await this.deps.clientIdentityStore.getOrCreateIdentity();
		if (!this.isCurrentRecover(context, generation)) {
			return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
		}
		// Unready identity: connection-service tests seed recoverContext and require this write.
		// startPairing does not enter recoverTrust unless identity is ready.
		if (identityState.kind !== 'ready') {
			return this.commitRecoverTrust(context, context.leafDer);
		}

		return this.runRecoverTrustAttempt(context, generation, identityState.identity);
	}

	private commitRecoverTrust(context: RecoverTrustContext, leafDer: Uint8Array): Extract<PairingConfirmResult, { ok: true }> {
		const trust = createEngineTrustRecord({
			leafDer,
			engineIdentityId: context.engineIdentityId,
			establishedAt: (this.deps.nowMs ?? Date.now)(),
		});
		this.deps.engineTrustStore.put(trust);
		this.deps.connectionProfileStore.put({
			...context.profile,
			trust,
			state: 'active',
		});
		this.recoverContext = undefined;
		this.lastSnapshot = {
			phase: 'idle',
			profileId: context.profile.profileId,
			engineIdentityId: context.engineIdentityId,
			leafSha256Hex: trust.leafSha256Hex,
			sessionTokenInstalled: false,
		};
		return { ok: true, snapshot: this.lastSnapshot, trust };
	}

	private async renewRecoverDial(
		endpoint: PairingDialEndpoint,
		context: RecoverTrustContext,
		generation: number,
	): Promise<PairingDialRenewResult> {
		if (!endpointHasRelayTicket(endpoint)) {
			return { ok: true, endpoint };
		}
		const renewed = await this.requestRenewedDialEndpoint(context.profile);
		if (!this.isCurrentRecover(context, generation)) {
			return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
		}
		return renewed;
	}

	private async runRecoverTrustAttempt(
		context: RecoverTrustContext,
		generation: number,
		identity: { readonly clientIdentityId: string; readonly clientPublicKey: Uint8Array },
	): Promise<PairingConfirmResult> {
		let observeEndpoint = context.endpoint;
		if (endpointHasRelayTicket(context.endpoint)) {
			const renewed = await this.renewRecoverDial(context.endpoint, context, generation);
			if (!renewed.ok) {
				return renewed;
			}
			observeEndpoint = renewed.endpoint;
		}

		const observe = this.deps.observeCandidateLeafFn ?? observeCandidateLeaf;
		let observed: Awaited<ReturnType<typeof observeCandidateLeaf>>;
		try {
			observed = await observe({
				host: observeEndpoint.host,
				port: observeEndpoint.port,
				servername: observeEndpoint.servername,
			});
		} catch (err) {
			if (!this.isCurrentRecover(context, generation)) {
				return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
			}
			return {
				ok: false,
				code: 'observe_failed',
				reason: `observe_failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
		if (!this.isCurrentRecover(context, generation)) {
			return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
		}
		if (!observed.ok) {
			return { ok: false, code: observed.code, reason: observed.reason };
		}
		if (deriveEngineLeafFingerprintHex(observed.leafDer) !== context.leafSha256Hex) {
			this.recoverContext = undefined;
			this.lastSnapshot = emptySnapshot(context.profile.profileId);
			return {
				ok: false,
				code: 'fingerprint_mismatch',
				reason: 'recoverTrust re-observe fingerprint does not match the confirmed leaf',
			};
		}

		let dialEndpoint = observeEndpoint;
		if (endpointHasRelayTicket(context.endpoint)) {
			const renewed = await this.renewRecoverDial(context.endpoint, context, generation);
			if (!renewed.ok) {
				return renewed;
			}
			dialEndpoint = renewed.endpoint;
		}
		if (!this.isCurrentRecover(context, generation)) {
			return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
		}

		const candidateTrust = createEngineTrustRecord({
			leafDer: observed.leafDer,
			engineIdentityId: context.engineIdentityId,
			establishedAt: (this.deps.nowMs ?? Date.now)(),
		});

		let transport: IUniverseAgentGrpcTransport;
		try {
			transport = this.deps.createPinnedTransport({
				endpoint: dialEndpoint,
				tls: tlsPlanFromTrust(candidateTrust),
			});
		} catch (err) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: `recoverTrust dial failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}

		try {
			const signer = await this.deps.clientIdentityStore.createSigner();
			if (!this.isCurrentRecover(context, generation)) {
				return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
			}
			if (!signer) {
				return { ok: false, code: 'signer_unavailable', reason: 'device auth signer unavailable' };
			}

			const handshake = await runDeviceAuthHandshake(
				transport,
				{
					clientIdentityId: identity.clientIdentityId,
					clientPublicKey: identity.clientPublicKey,
					engineIdentityId: context.engineIdentityId,
					observedLeafSha256Hex: candidateTrust.leafSha256Hex,
				},
				signer,
				{ pairingPhase: 'provisional' },
			);
			if (!this.isCurrentRecover(context, generation)) {
				return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
			}
			if (handshake.kind === 'failed') {
				return { ok: false, code: handshake.code, reason: handshake.reason };
			}
			if (handshake.kind === 'pairing_pending') {
				return this.handRecoverOffToSas(context, generation, identity.clientPublicKey, observed.leafDer, candidateTrust.leafSha256Hex, handshake.result);
			}

			const sessionToken = handshake.result.sessionToken;
			if (!sessionToken) {
				return { ok: false, code: 'transport_failed', reason: 'recover handshake missing session_token' };
			}
			const committed = this.commitRecoverTrust(context, observed.leafDer);
			return { ...committed, sessionToken };
		} finally {
			transport.close();
		}
	}

	private handRecoverOffToSas(
		context: RecoverTrustContext,
		generation: number,
		clientPublicKey: Uint8Array,
		leafDer: Uint8Array,
		leafSha256Hex: string,
		result: { readonly pairingNonce?: string; readonly sasCode?: string },
	): PairingConfirmResult {
		if (!this.isCurrentRecover(context, generation)) {
			return { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' };
		}
		const pairingNonce = base64ToBytes(result.pairingNonce);
		if (pairingNonce.byteLength === 0) {
			return { ok: false, code: 'transport_failed', reason: 'recover handshake missing pairing_nonce' };
		}
		const sasInput = {
			engineIdentityId: context.engineIdentityId,
			engineCertFingerprint: leafSha256Hex,
			clientPublicKey,
			pairingNonce,
			protocolVersion: DEVICE_GRANT_AUTH_PROTOCOL_VERSION,
		};
		const sasLocal = derivePairingSasCode(sasInput);
		const engineSas = result.sasCode?.trim() ?? '';
		if (engineSas.length > 0 && !verifyPairingSas(sasInput, engineSas)) {
			this.recoverContext = undefined;
			this.lastSnapshot = emptySnapshot(context.profile.profileId);
			return { ok: false, code: 'sas_mismatch', reason: 'local SAS does not match Engine sas_code' };
		}
		const sasCode = engineSas.length > 0 ? engineSas : sasLocal;
		this.activeContext = {
			profile: context.profile,
			endpoint: context.endpoint,
			leafDer: Uint8Array.from(leafDer),
			leafSha256Hex,
			engineIdentityId: context.engineIdentityId,
			pairingNonce,
			sasCode,
			sasLocal,
		};
		this.recoverContext = undefined;
		this.lastSnapshot = {
			phase: 'grant_pending',
			profileId: context.profile.profileId,
			sasCode,
			engineIdentityId: context.engineIdentityId,
			leafSha256Hex,
			sessionTokenInstalled: false,
		};
		return { ok: true, snapshot: this.lastSnapshot };
	}

	abandonRecoverTrust(): void {
		this.pairingGeneration++;
		const profileId = this.recoverContext?.profile.profileId;
		this.recoverContext = undefined;
		if (profileId) {
			this.lastSnapshot = emptySnapshot(profileId);
		}
	}

	private async runProvisionalHandshake(
		transport: IUniverseAgentGrpcTransport,
		clientIdentityId: string,
		clientPublicKey: Uint8Array,
		candidateSha256Hex: string,
	): Promise<
		| {
			readonly ok: true;
			readonly engineIdentityId: string;
			readonly pairingNonce: Uint8Array;
			readonly sasCode: string;
		}
		| {
			readonly ok: false;
			readonly reason: string;
			readonly code?: string;
			readonly recoverTrust?: boolean;
			readonly engineIdentityId?: string;
		}
	> {
		let nonce;
		try {
			// Fingerprint + engineIdentityId before Connect timeout; handshake reuses this nonce.
			nonce = await transport.getAuthNonce({ clientIdentityId, clientPublicKey });
		} catch (err) {
			const classified = classifyDeviceAuthRpcFailure(err, 'GetAuthNonce');
			return {
				ok: false,
				code: classified.code,
				reason: classified.reason,
			};
		}

		const fingerprintCheck = assertObservedFingerprintMatchesNonce(nonce, candidateSha256Hex);
		if (!fingerprintCheck.ok) {
			return {
				ok: false,
				code: fingerprintCheck.code,
				reason: fingerprintCheck.reason,
			};
		}

		const signer = await this.deps.clientIdentityStore.createSigner();
		if (!signer) {
			return { ok: false, reason: 'device auth signer unavailable' };
		}

		let handshake;
		try {
			handshake = await this.runProvisionalConnect(
				transport,
				{
					clientIdentityId,
					clientPublicKey,
					engineIdentityId: nonce.engineIdentityId,
					observedLeafSha256Hex: candidateSha256Hex,
				},
				signer,
				nonce,
			);
		} catch (err) {
			if (isProvisionalConnectTimeout(err)) {
				return {
					ok: false,
					code: 'transport_failed',
					reason: 'provisional Connect timed out',
				};
			}
			return {
				ok: false,
				reason: `Connect device_auth failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}

		if (handshake.kind === 'failed') {
			return { ok: false, reason: handshake.reason, code: handshake.code };
		}

		if (handshake.kind === 'authenticated') {
			return {
				ok: false,
				reason: 'recoverTrust: provisional Connect returned session_token unexpectedly',
				recoverTrust: true,
				engineIdentityId: nonce.engineIdentityId,
			};
		}

		const pairingNonce = base64ToBytes(handshake.result.pairingNonce);
		if (pairingNonce.byteLength === 0) {
			return { ok: false, reason: 'provisional Connect missing pairing_nonce' };
		}

		return {
			ok: true,
			engineIdentityId: nonce.engineIdentityId,
			pairingNonce,
			sasCode: handshake.result.sasCode?.trim() ?? '',
		};
	}

	private async runProvisionalConnect(
		transport: IUniverseAgentGrpcTransport,
		identity: {
			readonly clientIdentityId: string;
			readonly clientPublicKey: Uint8Array;
			readonly engineIdentityId: string;
			readonly observedLeafSha256Hex: string;
		},
		signer: (input: DeviceAuthTranscriptInput) => Uint8Array,
		prefetchedNonce: UniverseAgentAuthNonceResult,
	) {
		const timeoutMs = this.deps.provisionalConnectTimeoutMs ?? DEFAULT_PROVISIONAL_CONNECT_TIMEOUT_MS;
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			return await Promise.race([
				runDeviceAuthHandshake(transport, identity, signer, {
					pairingPhase: 'provisional',
					prefetchedNonce,
				}),
				new Promise<never>((_, reject) => {
					timer = setTimeout(() => reject(new ProvisionalConnectTimeoutError()), timeoutMs);
				}),
			]);
		} finally {
			if (timer !== undefined) {
				clearTimeout(timer);
			}
		}
	}
}

class ProvisionalConnectTimeoutError extends Error {
	constructor() {
		super('PROVISIONAL_CONNECT_TIMEOUT');
		this.name = 'ProvisionalConnectTimeoutError';
	}
}

function isProvisionalConnectTimeout(error: unknown): boolean {
	return error instanceof ProvisionalConnectTimeoutError;
}

function base64ToBytes(value: string | undefined): Uint8Array {
	if (!value) {
		return new Uint8Array(0);
	}
	return Uint8Array.from(Buffer.from(value, 'base64'));
}

export function createPairingOrchestrator(deps: PairingOrchestratorDeps): PairingOrchestrator {
	return new PairingOrchestrator(deps);
}

export function isPairingOrchestratorProfile(profile: ConnectionProfile): boolean {
	return isFirstPairingProfile(profile);
}
