/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSessionEvent,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
} from '../../common/universeAgentTypes.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, UniverseAgentAuthNonceRequest, UniverseAgentAuthNonceResult, UniverseAgentDeviceAuthConnectRequest, UniverseAgentGrpcServices, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import type { IUniverseAgentConnection } from '../../common/universeAgentConnection.js';
import { UniverseAgentConnectionService } from '../../node/universeAgentConnectionService.js';
import type { ConnectionProfile, IConnectionProfileStore } from '../../node/connectionProfileStore.js';
import { createEngineTrustRecord } from '../../node/engineTrustStore.js';
import type { ConnectionResolver } from '../../node/connectionResolver.js';
import type { PairingOrchestrator } from '../../node/pairingOrchestrator.js';
import { InMemoryHubSessionStore } from '../../node/hubSessionStore.js';

class MockUniverseAgentGrpcTransport implements IUniverseAgentGrpcTransport {

	private _alive = true;

	constructor(
		private readonly handlers: {
			connect?: (request: UniverseAgentConnectRequest) => Promise<UniverseAgentConnectResult>;
			probeRpc?: (service: string, method: string) => Promise<number>;
			listSessions?: (request: UniverseAgentListSessionsRequest) => Promise<UniverseAgentListSessionsResult>;
			saveSkillContent?: (request: UniverseAgentSaveSkillContentRequest) => Promise<UniverseAgentSaveSkillContentResult>;
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

	async listSkills() {
		return { skills: [] };
	}

	async setSkillEnabled() {
		return { ok: true };
	}

	async getSkillInfo() {
		return { name: '', content: '', source: 'unknown' as const, enabled: false };
	}

	async saveSkillContent(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult> {
		if (this.handlers.saveSkillContent) {
			return this.handlers.saveSkillContent(request);
		}
		return { ok: true };
	}

	async listAgentProfiles() {
		return { profiles: [] };
	}

	async saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest) {
		return { profile: request.profile };
	}

	async deleteAgentProfile() {
		return { ok: true };
	}

	async resetAgentProfile() {
		return { ok: true };
	}

	async listMcpServers() {
		return { servers: [] };
	}

	async getMcpServerStatuses() {
		return { statuses: [] };
	}

	async getMcpServerTools() {
		return { tools: [] };
	}

	async listPlugins() {
		return { plugins: [] };
	}

	async getPluginInfo() {
		return { summary: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const }, hooks: [] };
	}

	async enablePlugin() {
		return { plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } };
	}

	async reloadPlugin() {
		return { plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } };
	}

	async unloadPlugin() {
		return { removedHookCount: 0 };
	}

	async scanNewPlugins() {
		return { newPlugins: [], skippedCount: 0 };
	}

	async toggleMcpServer() {
		return { ok: true };
	}

	async addMcpServer() {
		return { ok: true };
	}

	async updateMcpServer() {
		return { ok: true };
	}

	async removeMcpServer() {
		return { ok: true };
	}

	async listTools() {
		return { tools: [] };
	}

	async listModels() {
		return { models: [] };
	}

	async fetchAgentTree() {
		return undefined;
	}

	async fetchToolDetail() {
		return { success: false, content: '', truncated: false };
	}

	async memberStatus() {
		return [];
	}

	async taskList() {
		return [];
	}

	async teamInfo() {
		return undefined;
	}
}

suite('UniverseAgentConnectionService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

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

	test('onDidFileMutation fires joined records from host', () => {
		const service = new UniverseAgentConnectionService({
			createTransport: () => new MockUniverseAgentGrpcTransport(),
		});
		const records: unknown[] = [];
		store.add(service.onDidFileMutation(r => records.push(r)));
		service.notifyFileMutation({
			sessionId: 's1',
			toolCallId: 'tc',
			turnId: 't1',
			agentId: 'a1',
			path: 'p.ts',
			operation: 'edit',
		});
		assert.strictEqual(records.length, 1);
		service.dispose();
	});

	test('onDidTurnSettle fires from host notifyTurnSettle', () => {
		const service = new UniverseAgentConnectionService({
			createTransport: () => new MockUniverseAgentGrpcTransport(),
		});
		const signals: unknown[] = [];
		store.add(service.onDidTurnSettle(s => signals.push(s)));
		service.notifyTurnSettle({
			sessionId: 's1',
			runtimeTurnId: 'runtime-1',
			assistantTurnId: 'assistant-1',
		});
		assert.deepStrictEqual(signals, [{
			sessionId: 's1',
			runtimeTurnId: 'runtime-1',
			assistantTurnId: 'assistant-1',
		}]);
		service.dispose();
	});

	test('agentTree UNIMPLEMENTED probe → UNSUPPORTED capability', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['AgentService.Tree'],
				events: [],
			}),
			probeRpc: async (_service, method) => {
				if (method === 'Tree') {
					return GrpcStatusCode.UNIMPLEMENTED;
				}
				return GrpcStatusCode.OK;
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		assert.strictEqual(service.getCapabilitySnapshot().agentTree.support, 'UNSUPPORTED');
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

	test('SaveSkillContent advertised + probe OK => saveSkillContent writes via transport', async () => {
		let saved: UniverseAgentSaveSkillContentRequest | undefined;
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['ToolService.ListSkills', 'ToolService.SaveSkillContent'],
				events: [],
			}),
			probeRpc: async (_service, method) => {
				if (method === UniverseAgentGrpcServices.Tool.SaveSkillContent) {
					return GrpcStatusCode.OK;
				}
				return GrpcStatusCode.OK;
			},
			saveSkillContent: async (request) => {
				saved = request;
				return { ok: true };
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const connection: IUniverseAgentConnection = service;
		assert.strictEqual(typeof connection.saveSkillContent, 'function');
		const result = await connection.saveSkillContent!({
			skillName: 'demo-skill',
			content: '# Demo',
		});
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(saved, { skillName: 'demo-skill', content: '# Demo' });
		service.dispose();
	});

	test('SaveSkillContent UNIMPLEMENTED probe => saveSkillContent absent', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['ToolService.ListSkills', 'ToolService.SaveSkillContent'],
				events: [],
			}),
			probeRpc: async (_service, method) => {
				if (method === UniverseAgentGrpcServices.Tool.SaveSkillContent) {
					return GrpcStatusCode.UNIMPLEMENTED;
				}
				return GrpcStatusCode.OK;
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const connection: IUniverseAgentConnection = service;
		assert.strictEqual(connection.saveSkillContent, undefined);
		service.dispose();
	});

	test('saveSkillContent runtime UNIMPLEMENTED => ok false without throwing', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['ToolService.ListSkills', 'ToolService.SaveSkillContent'],
				events: [],
			}),
			probeRpc: async (_service, method) => {
				if (method === UniverseAgentGrpcServices.Tool.SaveSkillContent) {
					return GrpcStatusCode.OK;
				}
				return GrpcStatusCode.OK;
			},
			saveSkillContent: async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.UNIMPLEMENTED, 'SaveSkillContent not implemented');
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const connection: IUniverseAgentConnection = service;
		const result = await connection.saveSkillContent!({
			skillName: 'demo-skill',
			content: '# Demo',
		});
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.reason, 'UNIMPLEMENTED');
		assert.strictEqual(connection.saveSkillContent, undefined);
		service.dispose();
	});
});

const PAIRING_PROFILE_ID = '11111111-1111-4111-8111-111111111111';

class PairingTestProfileStore implements IConnectionProfileStore {
	constructor(private profile: ConnectionProfile) { }

	list(): ConnectionProfile[] {
		return [this.profile];
	}

	get(profileId: string): ConnectionProfile | undefined {
		return profileId === this.profile.profileId ? this.profile : undefined;
	}

	put(profile: ConnectionProfile): void {
		this.profile = profile;
	}

	remove(_profileId: string): void {
	}

	createDraft(input: {
		readonly displayName: string;
		readonly target: ConnectionProfile['target'];
		readonly allowPrivateNetwork?: boolean;
	}): ConnectionProfile {
		return {
			profileId: PAIRING_PROFILE_ID,
			displayName: input.displayName,
			target: input.target,
			trust: null,
			state: 'pairingPending',
			allowPrivateNetwork: input.allowPrivateNetwork ?? false,
		};
	}
}

function createHubDevicePairingProfile(): ConnectionProfile {
	return {
		profileId: PAIRING_PROFILE_ID,
		displayName: 'Studio',
		target: {
			kind: 'hubDevice',
			hubBaseUrl: 'https://hub.example.com',
			accountId: 'usr_1',
			hubDeviceId: 'dev-1',
		},
		trust: null,
		state: 'pairingPending',
		allowPrivateNetwork: false,
	};
}

suite('UniverseAgentConnectionService pairing (GC-1b)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('hubDevice without trust returns pairingPending with handshake sasCode', async () => {
		const profile = createHubDevicePairingProfile();
		const profileStore = new PairingTestProfileStore(profile);
		const mockResolver = {
			resolve: async (_profileId: string, options?: { readonly forPairing?: boolean }) => {
				if (options?.forPairing) {
					return {
						ok: true as const,
						allowRelayFallback: true,
						endpoint: {
							attemptId: 'a1',
							authority: 'relay.example.com',
							port: 443,
							resolvedIp: '203.0.113.1',
							servername: 'relay.example.com',
							relayTicketId: 'ticket-1',
							tls: null,
							expiresAtMs: Date.now() + 60_000,
							path: 'hubRelay' as const,
						},
					};
				}
				return {
					ok: false as const,
					code: 'pairing_required' as const,
					reason: 'pairing required',
					allowRelayFallback: true,
				};
			},
			createIssueRelayTicketHook: () => async () => ({ ok: false as const, code: 'hub_session_required' as const, reason: 'test' }),
		};
		const mockOrchestrator = {
			startPairing: async () => ({
				ok: true as const,
				awaitingUserConfirm: true,
				snapshot: {
					phase: 'awaiting_sas_confirm' as const,
					profileId: PAIRING_PROFILE_ID,
					sasCode: 'ABCD-EFGH',
					engineIdentityId: 'eng-handshake-id',
					sessionTokenInstalled: false,
				},
			}),
			confirmSas: async () => ({ ok: false as const, code: 'unused', reason: 'unused' }),
			confirmRecoverTrust: async () => ({ ok: false as const, code: 'unused', reason: 'unused' }),
			getSnapshot: () => undefined,
			abandonRecoverTrust: () => { },
		};

		const service = new UniverseAgentConnectionService({
			connectionProfileStore: profileStore,
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			pairingOrchestrator: mockOrchestrator as unknown as PairingOrchestrator,
		});

		const result = await service.connectProfile(PAIRING_PROFILE_ID);
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.pairingPending, true);
			assert.strictEqual(result.sasCode, 'ABCD-EFGH');
			assert.strictEqual(result.engineIdentityId, 'eng-handshake-id');
		}
		assert.notStrictEqual(service.getConnectionPhase().kind, 'connected');
		service.dispose();
	});

	test('confirmPairing writes trust; cancelPairing leaves trust null', async () => {
		const leafDer = new Uint8Array([1, 2, 3, 4]);
		const trust = createEngineTrustRecord({
			leafDer,
			engineIdentityId: 'eng-handshake-id',
			establishedAt: Date.now(),
		});
		let profile = createHubDevicePairingProfile();
		const profileStore = new PairingTestProfileStore(profile);
		let confirmCalls = 0;
		const mockOrchestrator = {
			startPairing: async () => ({
				ok: true as const,
				awaitingUserConfirm: true,
				snapshot: {
					phase: 'awaiting_sas_confirm' as const,
					profileId: PAIRING_PROFILE_ID,
					sasCode: 'ABCD-EFGH',
					engineIdentityId: 'eng-handshake-id',
					sessionTokenInstalled: false,
				},
			}),
			confirmSas: async () => {
				confirmCalls++;
				profileStore.put({ ...profile, trust, state: 'active' });
				return {
					ok: true as const,
					snapshot: {
						phase: 'idle' as const,
						profileId: PAIRING_PROFILE_ID,
						sessionTokenInstalled: false,
					},
					trust,
					sessionToken: 'session-token',
				};
			},
			confirmRecoverTrust: async () => ({ ok: false as const, code: 'no_recover_trust', reason: 'test' }),
			getSnapshot: () => ({
				phase: 'awaiting_sas_confirm' as const,
				profileId: PAIRING_PROFILE_ID,
				sasCode: 'ABCD-EFGH',
				engineIdentityId: 'eng-handshake-id',
				sessionTokenInstalled: false,
			}),
			abandonRecoverTrust: () => { },
		};
		const mockResolver = {
			resolve: async (_profileId: string, options?: { readonly forPairing?: boolean }) => {
				if (options?.forPairing || profileStore.get(PAIRING_PROFILE_ID)?.trust) {
					return {
						ok: true as const,
						allowRelayFallback: true,
						endpoint: {
							attemptId: 'a1',
							authority: 'relay.example.com',
							port: 443,
							resolvedIp: '203.0.113.1',
							servername: 'relay.example.com',
							relayTicketId: 'ticket-1',
							tls: profileStore.get(PAIRING_PROFILE_ID)?.trust ? {
								trustAnchorLeafDer: leafDer,
								expectedLeafSha256Hex: trust.leafSha256Hex,
								hostnameVerification: 'replaced-by-pin' as const,
							} : null,
							expiresAtMs: Date.now() + 60_000,
							path: 'hubRelay' as const,
						},
					};
				}
				return {
					ok: false as const,
					code: 'pairing_required' as const,
					reason: 'pairing required',
					allowRelayFallback: true,
				};
			},
			createIssueRelayTicketHook: () => async () => ({ ok: false as const, code: 'hub_session_required' as const, reason: 'test' }),
		};

		const service = new UniverseAgentConnectionService({
			connectionProfileStore: profileStore,
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			pairingOrchestrator: mockOrchestrator as unknown as PairingOrchestrator,
			clientIdentityStore: {
				getState: async () => ({ kind: 'encryption_unavailable' as const }),
				getOrCreateIdentity: async () => ({ kind: 'encryption_unavailable' as const }),
				createSigner: async () => undefined,
			},
		});

		await service.connectProfile(PAIRING_PROFILE_ID);
		await service.confirmPairing();
		assert.strictEqual(confirmCalls, 1);
		assert.strictEqual(profileStore.get(PAIRING_PROFILE_ID)?.trust?.engineIdentityId, 'eng-handshake-id');

		profile = createHubDevicePairingProfile();
		const cancelStore = new PairingTestProfileStore(profile);
		const cancelService = new UniverseAgentConnectionService({
			connectionProfileStore: cancelStore,
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			pairingOrchestrator: mockOrchestrator as unknown as PairingOrchestrator,
		});
		await cancelService.connectProfile(PAIRING_PROFILE_ID);
		await cancelService.cancelPairing();
		assert.strictEqual(cancelStore.get(PAIRING_PROFILE_ID)?.trust, null);
		assert.strictEqual(cancelService.getConnectionPhase().kind, 'closed');
		cancelService.dispose();
		service.dispose();
	});

	test('S4 recoverTrust branch does not install session token on startPairing', async () => {
		const profileStore = new PairingTestProfileStore(createHubDevicePairingProfile());
		const mockOrchestrator = {
			startPairing: async () => ({
				ok: true as const,
				awaitingUserConfirm: true,
				snapshot: {
					phase: 'recover_trust' as const,
					profileId: PAIRING_PROFILE_ID,
					engineIdentityId: 'eng-recover',
					sessionTokenInstalled: false,
				},
			}),
			confirmSas: async () => ({ ok: false as const, code: 'no_active_pairing', reason: 'test' }),
			confirmRecoverTrust: async () => ({ ok: true as const, snapshot: { phase: 'idle' as const, profileId: PAIRING_PROFILE_ID, sessionTokenInstalled: false } }),
			getSnapshot: () => ({
				phase: 'recover_trust' as const,
				profileId: PAIRING_PROFILE_ID,
				engineIdentityId: 'eng-recover',
				sessionTokenInstalled: false,
			}),
			abandonRecoverTrust: () => { },
		};
		const mockResolver = {
			resolve: async (_profileId: string, options?: { readonly forPairing?: boolean }) => {
				if (options?.forPairing) {
					return {
						ok: true as const,
						allowRelayFallback: true,
						endpoint: {
							attemptId: 'a1',
							authority: 'relay.example.com',
							port: 443,
							resolvedIp: '203.0.113.1',
							servername: 'relay.example.com',
							relayTicketId: 'ticket-1',
							tls: null,
							expiresAtMs: Date.now() + 60_000,
							path: 'hubRelay' as const,
						},
					};
				}
				return { ok: false as const, code: 'pairing_required' as const, reason: 'pairing', allowRelayFallback: true };
			},
			createIssueRelayTicketHook: () => async () => ({ ok: false as const, code: 'hub_session_required' as const, reason: 'test' }),
		};
		const service = new UniverseAgentConnectionService({
			connectionProfileStore: profileStore,
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			pairingOrchestrator: mockOrchestrator as unknown as PairingOrchestrator,
		});

		const started = await service.connectProfile(PAIRING_PROFILE_ID);
		assert.strictEqual(started.ok, true);
		if (started.ok) {
			assert.strictEqual(started.pairingPending, true);
			assert.strictEqual(started.sessionToken, undefined);
		}
		assert.strictEqual(service.isEngineConnected(), false);
		service.dispose();
	});
});
