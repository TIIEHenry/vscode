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
import type { UniverseAgentSessionStreamCloseCause } from '../../common/universeAgentTypes.js';

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

	async getSessionInfo(): Promise<{ sessionId: ''; createdAt: 0; lastAccessedAt: 0; provider: ''; model: '' }> {
		return { sessionId: '', createdAt: 0, lastAccessedAt: 0, provider: '', model: '' };
	}

	async resumeSession(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async shelveSession(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async unshelveSession(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async purgeSession(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async exportSession(): Promise<{ content: ''; format: '' }> {
		return { content: '', format: '' };
	}

	async resolveTurn(): Promise<{ kind: 'unspecified' }> {
		return { kind: 'unspecified' };
	}

	async getAgentStatus(): Promise<{ agent: undefined }> {
		return { agent: undefined };
	}

	async getTodo(): Promise<{ items: [] }> {
		return { items: [] };
	}

	async compact(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async resolveAnchor(): Promise<Record<string, never>> {
		return {};
	}

	async getUsage(): Promise<{ totalInputTokens: 0; totalOutputTokens: 0; totalTurns: 0; agentUsages: []; recentRequestSpans: [] }> {
		return { totalInputTokens: 0, totalOutputTokens: 0, totalTurns: 0, agentUsages: [], recentRequestSpans: [] };
	}

	async listAgents(): Promise<{ agents: [] }> {
		return { agents: [] };
	}

	async getAgentHistory(): Promise<{ entries: []; total: 0 }> {
		return { entries: [], total: 0 };
	}

	async pauseAgent(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async back(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}
	async prune(): Promise<{ ok: false; message: 'test'; removedCount: 0 }> {
		return { ok: false, message: 'test', removedCount: 0 };
	}

	async resetAgent(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async branch(): Promise<{ ok: false; message: 'test'; currentBranch: 0; totalBranches: 0 }> {
		return { ok: false, message: 'test', currentBranch: 0, totalBranches: 0 };
	}

	async suspendLoop(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async resumeLoop(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async stopLoop(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async renameSession(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async cancelGeneration(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async cancelToolCall(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async runToolInBackground(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async stopShellTask(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async sendShellSessionClientControl(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async fetchToolUsageDetail(): Promise<{ ok: false; toolCallId: ''; contextSources: []; message: 'test' }> {
		return { ok: false, toolCallId: '', contextSources: [], message: 'test' };
	}

	async fireTriggerWebhook(): Promise<{ status: ''; eventId: ''; reason: 'test' }> {
		return { status: '', eventId: '', reason: 'test' };
	}

	async switchWorkDir(): Promise<{ ok: false; previousWorkDir: ''; currentWorkDir: ''; message: 'test' }> {
		return { ok: false, previousWorkDir: '', currentWorkDir: '', message: 'test' };
	}

	async testModelProfile(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async setSessionGoal(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async cancelSessionGoal(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async respondPermission(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async respondQuestion(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async enqueueQueueItem(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async insertQueueItem(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async reorderQueue(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async deleteQueueItem(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async retryQueueItem(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async retryAllFailed(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async retryQueueItemUpload(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async pinQueueItem(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async setQueueItemLocked(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async injectQueueItem(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async setQueueItemForkAnchor(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async pauseQueue(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async resumeQueue(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async clearQueue(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async holdQueueItem(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async releaseQueueItemHold(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async editQueueItem(): Promise<{ ok: false; error: 'test' }> {
		return { ok: false, error: 'test' };
	}

	async forkAgent(): Promise<{ ok: false }> {
		return { ok: false };
	}

	async killAgent(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async deleteMessage(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}
	async editMessage(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async sendClientToolResponse(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async listSnapshots(): Promise<{ snapshots: [] }> {
		return { snapshots: [] };
	}

	async listLoopSnapshots(): Promise<{ snapshots: [] }> {
		return { snapshots: [] };
	}

	async createSnapshot(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async restoreSnapshot(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async deleteSnapshot(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async getHistory(): Promise<{ envelopes: [] }> {
		return { envelopes: [] };
	}

	subscribeSessionEventStream(
		_sessionId: string,
		_listener: (event: { payload: unknown }) => void,
		_onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		return { dispose: () => { } };
	}

	async chat(): Promise<void> {
	}

	openChatStream(): { write(): void; dispose(): void } {
		return { write() { }, dispose() { } };
	}

	openContinuationStream(): { dispose(): void } {
		return { dispose() { } };
	}

	openRegenerateStream(): { dispose(): void } {
		return { dispose() { } };
	}

	openResumeStream(): { dispose(): void } {
		return { dispose() { } };
	}

	openSubscribeToolDetailStream(): { dispose(): void } {
		return { dispose() { } };
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
	async getMcpServerStatuses() { return { statuses: [] }; }
	async getMcpServerTools() { return { tools: [] }; }
	async listPlugins() { return { plugins: [] }; }
	async getPluginInfo() { return { summary: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const }, hooks: [] }; }
	async enablePlugin() { return { plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }; }
	async reloadPlugin() { return { plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }; }
	async unloadPlugin() { return { removedHookCount: 0 }; }
	async scanNewPlugins() { return { newPlugins: [], skippedCount: 0 }; }
	async toggleMcpServer() { return { ok: true }; }
	async addMcpServer() { return { ok: true }; }
	async updateMcpServer() { return { ok: true }; }
	async removeMcpServer() { return { ok: true }; }
	async listTools() { return { tools: [] }; }
	async getToolInfo() { return { name: '', aliases: [] }; }
	async listModels() { return { models: [] }; }

	async fetchAgentTree() { return undefined; }
	async fetchToolDetail() { return { success: false, content: '', truncated: false }; }
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
