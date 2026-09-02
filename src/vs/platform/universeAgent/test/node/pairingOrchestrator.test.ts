/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ConnectionProfile } from '../../node/connectionProfileStore.js';
import { derivePairingSasCode, DEVICE_GRANT_AUTH_PROTOCOL_VERSION } from '../../node/deviceGrant/device-grant-crypto.js';
import { createEd25519DeviceAuthSigner, type DeviceAuthTranscriptInput } from '../../node/deviceGrant/device-grant-crypto.js';
import { deriveEngineLeafFingerprintHex } from '../../node/deviceGrant/tls-pin.js';
import type {
	IUniverseAgentGrpcTransport,
	UniverseAgentAuthNonceRequest,
	UniverseAgentAuthNonceResult,
	UniverseAgentConnectResult,
	UniverseAgentDeviceAuthConnectRequest,
} from '../../node/grpc/grpcTransport.js';
import { createPairingOrchestrator, type PairingDialEndpoint } from '../../node/pairingOrchestrator.js';
import type { IClientIdentityStore } from '../../node/clientIdentityTypes.js';

const ED25519_PUBLIC_RAW_LEN = 32;

type TestIdentityMaterial = {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
	readonly privateKeyPkcs8: Uint8Array;
};

function mintTestIdentity(): TestIdentityMaterial {
	const { privateKey, publicKey } = generateKeyPairSync('ed25519');
	const privateKeyPkcs8 = Uint8Array.from(privateKey.export({ type: 'pkcs8', format: 'der' }));
	const spki = publicKey.export({ type: 'spki', format: 'der' });
	const clientPublicKey = Uint8Array.from(spki.subarray(spki.length - ED25519_PUBLIC_RAW_LEN));
	const clientIdentityId = createHash('sha256').update(clientPublicKey).digest('hex');
	return { clientIdentityId, clientPublicKey, privateKeyPkcs8 };
}

class TestClientIdentityStore implements IClientIdentityStore {

	constructor(private readonly identity: TestIdentityMaterial) { }

	async getState(): Promise<import('../../node/clientIdentityTypes.js').ClientIdentityStoreState> {
		return { kind: 'ready', identity: this.identity };
	}

	async getOrCreateIdentity(): Promise<import('../../node/clientIdentityTypes.js').ClientIdentityStoreState> {
		return { kind: 'ready', identity: this.identity };
	}

	async createSigner(): Promise<((input: DeviceAuthTranscriptInput) => Uint8Array) | undefined> {
		return createEd25519DeviceAuthSigner(this.identity.privateKeyPkcs8);
	}
}

class RecordingMockTransport implements IUniverseAgentGrpcTransport {

	private _alive = true;
	readonly connectCalls: UniverseAgentDeviceAuthConnectRequest[] = [];

	constructor(
		private readonly handlers: {
			getAuthNonce?: (request: UniverseAgentAuthNonceRequest) => Promise<UniverseAgentAuthNonceResult>;
			connectWithDeviceAuth?: (request: UniverseAgentDeviceAuthConnectRequest) => Promise<UniverseAgentConnectResult>;
		},
	) { }

	get isChannelAlive(): boolean {
		return this._alive;
	}

	async connect(): Promise<UniverseAgentConnectResult> {
		throw new Error('not used');
	}

	async getAuthNonce(request: UniverseAgentAuthNonceRequest): Promise<UniverseAgentAuthNonceResult> {
		if (this.handlers.getAuthNonce) {
			return this.handlers.getAuthNonce(request);
		}
		throw new Error('getAuthNonce not configured');
	}

	async connectWithDeviceAuth(request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult> {
		this.connectCalls.push(request);
		if (this.handlers.connectWithDeviceAuth) {
			return this.handlers.connectWithDeviceAuth(request);
		}
		throw new Error('connectWithDeviceAuth not configured');
	}

	close(): void {
		this._alive = false;
	}

	async probeRpc(): Promise<number> {
		return 0;
	}

	async listSessions(): Promise<{ sessions: []; totalCount: 0 }> {
		return { sessions: [], totalCount: 0 };
	}

	async createSession(): Promise<{ sessionId: 's' }> {
		return { sessionId: 's' };
	}

	async deleteSession(): Promise<void> {
	}

	async getHistory(): Promise<{ envelopes: [] }> {
		return { envelopes: [] };
	}

	subscribeSessionEventStream(): { dispose(): void } {
		return { dispose: () => { } };
	}

	async chat(): Promise<void> {
	}

	async listSkills() {
		return { skills: [] };
	}

	async setSkillEnabled() {
		return { ok: true };
	}

	async getSkillInfo() {
		return { name: '', content: '', source: 'unknown' as const, enabled: false };
	}

	async saveSkillContent() {
		return { ok: true };
	}

	async listAgentProfiles() { return { profiles: [] }; }
	async saveAgentProfile(request: { profile: { id: string; name: string } }) { return { profile: request.profile }; }
	async deleteAgentProfile() { return { ok: true }; }
	async resetAgentProfile() { return { ok: true }; }
	async listMcpServers() { return { servers: [] }; }
	async toggleMcpServer() { return { ok: true }; }
	async addMcpServer() { return { ok: true }; }
	async updateMcpServer() { return { ok: true }; }
	async removeMcpServer() { return { ok: true }; }
	async listTools() { return { tools: [] }; }

	async fetchAgentTree() { return undefined; }
	async memberStatus() { return []; }
	async taskList() { return []; }
	async teamInfo() { return undefined; }
}

function createPairingProfile(): ConnectionProfile {
	return {
		profileId: '11111111-1111-4111-8111-111111111111',
		displayName: 'Test Engine',
		target: { kind: 'directAddress', host: '127.0.0.1', port: 50051 },
		trust: null,
		state: 'pairingPending',
		allowPrivateNetwork: true,
	};
}

suite('pairingOrchestrator H2', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const leafDer = new Uint8Array([1, 2, 3, 4, 5]);
	const leafSha256Hex = deriveEngineLeafFingerprintHex(leafDer);
	const engineIdentityId = '0123456789abcdef'.repeat(4);
	const pairingNonceBytes = new Uint8Array(32).fill(0xaa);
	const pairingNonceB64 = Buffer.from(pairingNonceBytes).toString('base64');
	const endpoint: PairingDialEndpoint = { host: '127.0.0.1', port: 50051, servername: '127.0.0.1' };

	test('pairing provisional return does not install session token / connected', async () => {
		const identity = mintTestIdentity();
		const sasCode = derivePairingSasCode({
			engineIdentityId,
			engineCertFingerprint: leafSha256Hex,
			clientPublicKey: identity.clientPublicKey,
			pairingNonce: pairingNonceBytes,
			protocolVersion: DEVICE_GRANT_AUTH_PROTOCOL_VERSION,
		});

		const transport = new RecordingMockTransport({
			getAuthNonce: async () => ({
				authNonce: new Uint8Array(32).fill(0x11),
				engineIdentityId,
				engineCertFingerprint: leafSha256Hex,
			}),
			connectWithDeviceAuth: async () => ({
				pairingNonce: pairingNonceB64,
				sasCode,
				methods: [],
				events: [],
			}),
		});

		const orchestrator = createPairingOrchestrator({
			clientIdentityStore: new TestClientIdentityStore(identity),
			engineTrustStore: { get: () => undefined, list: () => [], put: () => { }, remove: () => { } },
			connectionProfileStore: { list: () => [], get: () => undefined, put: () => { }, remove: () => { }, createDraft: () => createPairingProfile() },
			createPinnedTransport: () => transport,
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
			confirmSas: async () => false,
		});

		const started = await orchestrator.startPairing(createPairingProfile(), endpoint);
		assert.strictEqual(started.ok, true);
		if (started.ok) {
			assert.strictEqual(started.snapshot.sessionTokenInstalled, false);
			assert.strictEqual(started.snapshot.phase, 'awaiting_sas_confirm');
		}
		assert.strictEqual(orchestrator.isEngineConnectedCandidate(), false);
	});

	test('S4 unexpected session_token enters recoverTrust without install', async () => {
		const identity = mintTestIdentity();
		const transport = new RecordingMockTransport({
			getAuthNonce: async () => ({
				authNonce: new Uint8Array(32).fill(0x11),
				engineIdentityId,
				engineCertFingerprint: leafSha256Hex,
			}),
			connectWithDeviceAuth: async () => ({
				sessionToken: 'unexpected-token',
				methods: [],
				events: [],
			}),
		});

		const orchestrator = createPairingOrchestrator({
			clientIdentityStore: new TestClientIdentityStore(identity),
			engineTrustStore: { get: () => undefined, list: () => [], put: () => { }, remove: () => { } },
			connectionProfileStore: { list: () => [], get: () => undefined, put: () => { }, remove: () => { }, createDraft: () => createPairingProfile() },
			createPinnedTransport: () => transport,
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
		});

		const started = await orchestrator.startPairing(createPairingProfile(), endpoint);
		assert.strictEqual(started.ok, true);
		if (started.ok) {
			assert.strictEqual(started.snapshot.phase, 'recover_trust');
			assert.strictEqual(started.snapshot.sessionTokenInstalled, false);
		}
		assert.strictEqual(orchestrator.isEngineConnectedCandidate(), false);
		assert.strictEqual(transport.connectCalls.length, 1);
	});
});
