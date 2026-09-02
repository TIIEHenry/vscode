/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	DEVICE_GRANT_AUTH_PROTOCOL_VERSION,
	derivePairingSasCode,
	verifyPairingSas,
} from './deviceGrant/device-grant-crypto.js';
import { observeCandidateLeaf } from './deviceGrant/observe-candidate-leaf.js';
import type { PinnedTlsPlanInput } from './deviceGrant/tls-pin.js';
import {
	assertObservedFingerprintMatchesNonce,
	runDeviceAuthHandshake,
} from './deviceAuthHandshake.js';
import type { ConnectionProfile, IConnectionProfileStore } from './connectionProfileStore.js';
import type { IClientIdentityStore } from './clientIdentityTypes.js';
import { createEngineTrustRecord, type EngineTrustRecord, type IEngineTrustStore } from './engineTrustStore.js';
import type { IssueRelayTicketFn } from './connectionResolver.js';
import type { IUniverseAgentGrpcTransport } from './grpc/grpcTransport.js';

const PAIRING_PROVISIONAL_ENGINE_ID = 'pairing-provisional';

export type PairingDialEndpoint = {
	readonly host: string;
	readonly port: number;
	readonly servername: string;
};

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
	/** Hub pairing S1/S2/S6 relay ticket issuance; injected by ConnectionResolver (H3). */
	readonly issueRelayTicket?: IssueRelayTicketFn;
	readonly nowMs?: () => number;
};

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

	constructor(private readonly deps: PairingOrchestratorDeps) { }

	getSnapshot(): PairingOrchestratorSnapshot | undefined {
		return this.lastSnapshot;
	}

	/** Pairing flow never installs session_token until S6–S7 formal commit succeeds. */
	isEngineConnectedCandidate(): boolean {
		return !!this.lastSnapshot?.sessionTokenInstalled;
	}

	async startPairing(profile: ConnectionProfile, endpoint: PairingDialEndpoint): Promise<PairingStartResult> {
		if (!isFirstPairingProfile(profile)) {
			return {
				ok: false,
				code: 'not_pairing_profile',
				reason: 'profile is not eligible for first-pairing orchestrator',
			};
		}

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
		const observed = await observe({
			host: endpoint.host,
			port: endpoint.port,
			servername: endpoint.servername,
		});
		if (!observed.ok) {
			return { ok: false, code: observed.code, reason: observed.reason };
		}

		const provisionalTrust = createEngineTrustRecord({
			leafDer: observed.leafDer,
			engineIdentityId: PAIRING_PROVISIONAL_ENGINE_ID,
			establishedAt: (this.deps.nowMs ?? Date.now)(),
		});

		const transport = this.deps.createPinnedTransport({
			endpoint,
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
			if (!verifyPairingSas(sasInput, provisional.sasCode)) {
				return {
					ok: false,
					code: 'sas_mismatch',
					reason: 'local SAS does not match Engine sas_code',
				};
			}

			this.activeContext = {
				profile,
				endpoint,
				leafDer: observed.leafDer,
				leafSha256Hex: observed.leafSha256Hex,
				engineIdentityId: provisional.engineIdentityId,
				pairingNonce: provisional.pairingNonce,
				sasCode: provisional.sasCode,
				sasLocal,
			};
			this.recoverContext = undefined;
			this.lastSnapshot = {
				phase: 'awaiting_sas_confirm',
				profileId: profile.profileId,
				sasCode: provisional.sasCode,
				engineIdentityId: provisional.engineIdentityId,
				leafSha256Hex: observed.leafSha256Hex,
				sessionTokenInstalled: false,
			};
			return { ok: true, snapshot: this.lastSnapshot, awaitingUserConfirm: true };
		} finally {
			transport.close();
		}
	}

	async confirmSas(): Promise<PairingConfirmResult> {
		const context = this.activeContext;
		if (!context) {
			return { ok: false, code: 'no_active_pairing', reason: 'no pairing awaiting SAS confirmation' };
		}

		const confirm = this.deps.confirmSas ?? (async () => true);
		const approved = await confirm({
			sasCode: context.sasCode,
			engineIdentityId: context.engineIdentityId,
			leafSha256Hex: context.leafSha256Hex,
			displayName: context.profile.displayName,
		});
		if (!approved) {
			this.activeContext = undefined;
			this.lastSnapshot = emptySnapshot(context.profile.profileId);
			return { ok: false, code: 'sas_cancelled', reason: 'user cancelled SAS confirmation' };
		}

		const identityState = await this.deps.clientIdentityStore.getOrCreateIdentity();
		if (identityState.kind !== 'ready') {
			return { ok: false, code: 'identity_unavailable', reason: 'client identity unavailable' };
		}

		const candidateTrust = createEngineTrustRecord({
			leafDer: context.leafDer,
			engineIdentityId: context.engineIdentityId,
			establishedAt: (this.deps.nowMs ?? Date.now)(),
		});

		const transport = this.deps.createPinnedTransport({
			endpoint: context.endpoint,
			tls: tlsPlanFromTrust(candidateTrust),
		});

		const signer = await this.deps.clientIdentityStore.createSigner();
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

	async confirmRecoverTrust(): Promise<PairingConfirmResult> {
		const context = this.recoverContext;
		if (!context) {
			return { ok: false, code: 'no_recover_trust', reason: 'no recoverTrust session active' };
		}

		const confirm = this.deps.confirmRecoverTrust ?? (async () => true);
		const approved = await confirm({
			engineIdentityId: context.engineIdentityId,
			leafSha256Hex: context.leafSha256Hex,
			displayName: context.profile.displayName,
		});
		if (!approved) {
			this.recoverContext = undefined;
			this.lastSnapshot = emptySnapshot(context.profile.profileId);
			return { ok: false, code: 'recover_cancelled', reason: 'user cancelled recoverTrust confirmation' };
		}

		const trust = createEngineTrustRecord({
			leafDer: context.leafDer,
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
			leafSha256Hex: context.leafSha256Hex,
			sessionTokenInstalled: false,
		};

		return { ok: true, snapshot: this.lastSnapshot, trust };
	}

	abandonRecoverTrust(): void {
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
			nonce = await transport.getAuthNonce({ clientIdentityId, clientPublicKey });
		} catch (err) {
			return {
				ok: false,
				reason: `GetAuthNonce failed: ${err instanceof Error ? err.message : String(err)}`,
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

		const handshake = await runDeviceAuthHandshake(
			transport,
			{
				clientIdentityId,
				clientPublicKey,
				engineIdentityId: nonce.engineIdentityId,
				observedLeafSha256Hex: candidateSha256Hex,
			},
			signer,
			{ pairingPhase: 'provisional' },
		);

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
		const sasCode = handshake.result.sasCode ?? '';
		if (pairingNonce.byteLength === 0 || sasCode.length === 0) {
			return { ok: false, reason: 'provisional Connect missing pairing_nonce or sas_code' };
		}

		return {
			ok: true,
			engineIdentityId: nonce.engineIdentityId,
			pairingNonce,
			sasCode,
		};
	}
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
