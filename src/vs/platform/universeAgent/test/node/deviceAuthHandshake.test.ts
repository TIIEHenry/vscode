/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { runDeviceAuthHandshake } from '../../node/deviceAuthHandshake.js';
import { createEd25519DeviceAuthSigner } from '../../node/deviceGrant/device-grant-crypto.js';
import type {
	IUniverseAgentGrpcTransport,
	UniverseAgentAuthNonceRequest,
	UniverseAgentAuthNonceResult,
	UniverseAgentConnectResult,
	UniverseAgentDeviceAuthConnectRequest,
} from '../../node/grpc/grpcTransport.js';
import type { UniverseAgentSessionStreamCloseCause } from '../../common/universeAgentTypes.js';

const ED25519_PUBLIC_RAW_LEN = 32;

function mintTestIdentity() {
	const { privateKey, publicKey } = generateKeyPairSync('ed25519');
	const privateKeyPkcs8 = Uint8Array.from(privateKey.export({ type: 'pkcs8', format: 'der' }));
	const spki = publicKey.export({ type: 'spki', format: 'der' });
	const clientPublicKey = Uint8Array.from(spki.subarray(spki.length - ED25519_PUBLIC_RAW_LEN));
	const clientIdentityId = createHash('sha256').update(clientPublicKey).digest('hex');
	return { clientIdentityId, clientPublicKey, privateKeyPkcs8 };
}

class MockDeviceAuthTransport implements IUniverseAgentGrpcTransport {

	private _alive = true;

	constructor(
		private readonly authNonce: UniverseAgentAuthNonceResult,
		private readonly connectResult: UniverseAgentConnectResult,
	) { }

	get isChannelAlive(): boolean {
		return this._alive;
	}

	async connect(): Promise<UniverseAgentConnectResult> {
		throw new Error('loopback connect not used');
	}

	async getAuthNonce(_request: UniverseAgentAuthNonceRequest): Promise<UniverseAgentAuthNonceResult> {
		return this.authNonce;
	}

	async connectWithDeviceAuth(_request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult> {
		return this.connectResult;
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

	async getAgentStatus(): Promise<{ agent: undefined }> {
		return { agent: undefined };
	}

	async getTodo(): Promise<{ items: [] }> {
		return { items: [] };
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

suite('deviceAuthHandshake SEC-3', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('observed fingerprint != AuthNonce self-report => fail-closed', async () => {
		const identity = mintTestIdentity();
		const observed = 'a'.repeat(64);
		const reported = 'b'.repeat(64);
		const transport = new MockDeviceAuthTransport(
			{
				authNonce: new Uint8Array(32).fill(1),
				engineIdentityId: '0123456789abcdef'.repeat(4),
				engineCertFingerprint: reported,
			},
			{
				methods: [],
				events: [],
			},
		);
		const signer = createEd25519DeviceAuthSigner(identity.privateKeyPkcs8);

		const result = await runDeviceAuthHandshake(
			transport,
			{
				clientIdentityId: identity.clientIdentityId,
				clientPublicKey: identity.clientPublicKey,
				engineIdentityId: '0123456789abcdef'.repeat(4),
				observedLeafSha256Hex: observed,
			},
			signer,
		);

		assert.strictEqual(result.kind, 'failed');
		if (result.kind === 'failed') {
			assert.strictEqual(result.code, 'fingerprint_mismatch');
		}
	});
});
