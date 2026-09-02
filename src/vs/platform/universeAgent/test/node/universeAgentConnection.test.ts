/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type {
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentSessionEvent,
} from '../../common/universeAgentTypes.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, UniverseAgentAuthNonceRequest, UniverseAgentAuthNonceResult, UniverseAgentConnectRequest, UniverseAgentConnectResult, UniverseAgentDeviceAuthConnectRequest, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import { UniverseAgentConnectionService } from '../../node/universeAgentConnectionService.js';
import { InMemoryHubSessionStore } from '../../node/hubSessionStore.js';

class MockUniverseAgentGrpcTransport implements IUniverseAgentGrpcTransport {

	private _alive = true;

	constructor(
		private readonly handlers: {
			connect?: (request: UniverseAgentConnectRequest) => Promise<UniverseAgentConnectResult>;
			probeRpc?: (service: string, method: string) => Promise<number>;
			listSessions?: (request: UniverseAgentListSessionsRequest) => Promise<UniverseAgentListSessionsResult>;
		} = {},
	) { }

	get isChannelAlive(): boolean {
		return this._alive;
	}

	setChannelAlive(alive: boolean): void {
		this._alive = alive;
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		if (this.handlers.connect) {
			return this.handlers.connect(request);
		}
		return {
			sessionToken: 'token-1',
			workDir: '/tmp/work',
			methods: ['ToolService.ListSkills'],
			events: [],
		};
	}

	async getAuthNonce(_request: UniverseAgentAuthNonceRequest): Promise<UniverseAgentAuthNonceResult> {
		return {
			authNonce: new Uint8Array(32),
			engineIdentityId: 'engine-id',
			engineCertFingerprint: 'a'.repeat(64),
		};
	}

	async connectWithDeviceAuth(_request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult> {
		return {
			sessionToken: 'token-1',
			methods: [],
			events: [],
		};
	}

	close(): void {
		this._alive = false;
	}

	async probeRpc(service: string, method: string): Promise<number> {
		if (this.handlers.probeRpc) {
			return this.handlers.probeRpc(service, method);
		}
		return GrpcStatusCode.OK;
	}

	async listSessions(_request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		if (this.handlers.listSessions) {
			return this.handlers.listSessions(_request);
		}
		return { sessions: [], totalCount: 0 };
	}

	async createSession(_request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		return { sessionId: 'new-session' };
	}

	async deleteSession(_request: UniverseAgentDeleteSessionRequest): Promise<void> {
	}

	async getHistory(_request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		return { envelopes: [] };
	}

	subscribeSessionEventStream(_sessionId: string, _listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void } {
		return { dispose: () => { } };
	}

	async chat(_request: UniverseAgentChatRequest, _onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
	}
}

suite('UniverseAgentConnectionService', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('token + live channel => isEngineConnected === true', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(service.getTransportState(), 'ok');
		assert.strictEqual(service.getConnectionSnapshot().sessionToken, 'token-1');
		service.dispose();
	});

	test('pairing-pending => isEngineConnected === false', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				pairingNonce: 'nonce-1',
				sasCode: 'ABCD-EFGH',
				methods: ['ToolService.ListSkills'],
				events: [],
			}),
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		assert.strictEqual(service.isEngineConnected(), false);
		assert.strictEqual(service.getConnectionSnapshot().pairingPending, true);
		service.dispose();
	});

	test('GrpcCapabilityProbe UNIMPLEMENTED on skills => UNSUPPORTED', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['ToolService.ListSkills'],
				events: [],
			}),
			probeRpc: async () => GrpcStatusCode.UNIMPLEMENTED,
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		assert.strictEqual(service.getCapabilitySnapshot().skills.support, 'UNSUPPORTED');
		assert.strictEqual(service.getCapabilitySnapshot().skills.reason, 'UNIMPLEMENTED');
		service.dispose();
	});

	test('transport failure => transport failed rather than empty list', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: [],
				events: [],
			}),
			listSessions: async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'engine unavailable');
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		await assert.rejects(
			() => service.listSessions({ limit: 10 }),
			(error: unknown) => error instanceof UniverseAgentTransportError,
		);
		assert.strictEqual(service.getTransportState(), 'failed');
		service.dispose();
	});

	test('onDidFileMutation === Event.None', () => {
		const service = new UniverseAgentConnectionService({
			createTransport: () => new MockUniverseAgentGrpcTransport(),
		});

		assert.strictEqual(service.onDidFileMutation, Event.None);
		service.dispose();
	});

	test('Hub signedIn does not set isEngineConnected (H4a connection-state honesty)', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		const service = new UniverseAgentConnectionService({ hubSessionStore });
		await hubSessionStore.applyAuthSession('https://hub.example.com', {
			accessToken: 'token',
			expiresIn: 3600,
			csrfToken: 'csrf',
			mustChangePassword: false,
			user: { id: 'u1', email: 'a@example.com', role: 'user', status: 'active' },
		}, Date.now());
		service.setActiveHubBaseUrl('https://hub.example.com');

		assert.strictEqual(service.getAuthStatus().kind, 'signedIn');
		assert.strictEqual(service.isEngineConnected(), false);
		assert.strictEqual(service.getConnectionPhase().kind, 'disconnected');
		service.dispose();
	});
});
