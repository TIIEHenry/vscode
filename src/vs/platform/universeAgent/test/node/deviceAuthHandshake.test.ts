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

	async fetchAgentTree() { return undefined; }
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
