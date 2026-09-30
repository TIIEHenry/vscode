/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ConnectionProfile } from '../../node/connectionProfileStore.js';
import { derivePairingSasCode, DEVICE_GRANT_AUTH_PROTOCOL_VERSION, createEd25519DeviceAuthSigner, type DeviceAuthTranscriptInput } from '../../node/deviceGrant/device-grant-crypto.js';
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
	readonly authNonceCalls: UniverseAgentAuthNonceRequest[] = [];
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
		this.authNonceCalls.push(request);
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

	installSessionToken(_token: string): void {
	}

	readonly onDidRejectSessionToken = Event.None;
	readonly onDidObserveUnavailable = Event.None;

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

	async prewarmSessions(): Promise<{ entries: [] }> {
		return { entries: [] };
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

	async installSessionDemoFake(): Promise<{ ok: false; message: 'test'; reasonCode: 'test' }> {
		return { ok: false, message: 'test', reasonCode: 'test' };
	}

	async clearSessionDemoFake(): Promise<{ ok: false; message: 'test'; reasonCode: 'test' }> {
		return { ok: false, message: 'test', reasonCode: 'test' };
	}

	async switchWorkDir(): Promise<{ ok: false; previousWorkDir: ''; currentWorkDir: ''; message: 'test' }> {
		return { ok: false, previousWorkDir: '', currentWorkDir: '', message: 'test' };
	}

	async testModelProfile(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async setConfig(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async setModelPreferences(): Promise<{ minLevel: 0; maxCost: ''; minSpeed: ''; strategy: '' }> {
		return { minLevel: 0, maxCost: '', minSpeed: '', strategy: '' };
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

	async syncPermissionRule(): Promise<{ ok: false; ruleId: '' }> {
		return { ok: false, ruleId: '' };
	}

	async promotePermissionRule(): Promise<{ ok: false }> {
		return { ok: false };
	}

	async getSessionRules(): Promise<{ rules: [] }> {
		return { rules: [] };
	}

	async setPermissionMode(): Promise<{ ok: false; message: 'test' }> {
		return { ok: false, message: 'test' };
	}

	async taskUpdate(): Promise<{ ok: false }> {
		return { ok: false };
	}

	async taskCancel(): Promise<{ ok: false }> {
		return { ok: false };
	}

	async messageMember(): Promise<{ ok: false }> {
		return { ok: false };
	}

	async createTeam(): Promise<{ teamId: 0; memberCount: 0 }> {
		return { teamId: 0, memberCount: 0 };
	}

	async startMember(): Promise<{ memberAgentId: ''; memberName: ''; dynamic: false }> {
		return { memberAgentId: '', memberName: '', dynamic: false };
	}

	async killMember(): Promise<{ ok: false }> {
		return { ok: false };
	}

	async abort(): Promise<{ ok: false; stoppedMembers: [] }> {
		return { ok: false, stoppedMembers: [] };
	}

	async setPermissionPolicy(): Promise<{ ok: false; message: 'test' }> {
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

	async chatSync(): Promise<{
		sessionId: '';
		agentId: '';
		text: '';
		stopReason: '';
		inputTokens: 0;
		outputTokens: 0;
		turnCount: 0;
		toolResults: [];
		error: 'test';
		inputDeliveryEvents: [];
	}> {
		return {
			sessionId: '',
			agentId: '',
			text: '',
			stopReason: '',
			inputTokens: 0,
			outputTokens: 0,
			turnCount: 0,
			toolResults: [],
			error: 'test',
			inputDeliveryEvents: [],
		};
	}

	async syncInputDelivery(): Promise<{
		inputDeliveryEvents: [];
	}> {
		return {
			inputDeliveryEvents: [],
		};
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
	async listCommands() { return { commands: [], total: 0 }; }
	async getCommandDef() {
		return { name: '', source: '' as const, template: '', agent: '', model: '', subtask: false, mcpServerId: '', mcpPromptName: '', mcpArgumentNames: [], skillSource: '' };
	}
	async listFiles() { return { entries: [], total: 0 }; }
	async readFile() {
		return { content: new Uint8Array(0), totalSize: 0, mimeType: '', lineCount: 0, contentHash: '' };
	}
	async getFileInfo() {
		return { file: { name: '', path: '', isDirectory: false, size: 0, lastModified: 0, mimeType: '' } };
	}
	async writeFile() {
		return { status: 'SAVED' as const, newHash: '', size: 0, modifiedAt: 0, currentContent: new Uint8Array(0), currentHash: '', mergedContent: new Uint8Array(0) };
	}
	async forceWriteFile() {
		return { status: 'SAVED' as const, newHash: '', size: 0, modifiedAt: 0, currentContent: new Uint8Array(0), currentHash: '', mergedContent: new Uint8Array(0) };
	}
	async agentMerge() {
		return { accepted: false };
	}
	async readGitSummary() {
		return { supported: false, reason: '', branch: '', changeCount: 0 };
	}
	async readGitChanges() {
		return { supported: false, reason: '', branch: '', entries: [] };
	}
	async readGitFileDiff() {
		return { supported: false, reason: '', path: '', unifiedDiff: '' };
	}
	async writeGitStagePaths() {
		return { supported: false, reason: '', success: false, errorMessage: '', exitCode: 0, stdout: '' };
	}
	async writeGitCommit() {
		return { supported: false, reason: '', success: false, errorMessage: '', exitCode: 0, stdout: '' };
	}
	async writeGitApplyHunks() {
		return { supported: false, reason: '', success: false, errorMessage: '', exitCode: 0, stdout: '' };
	}
	async getSessionUsage() {
		return { usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalCostMicros: 0, currency: '', requestCount: 0 } };
	}
	async getGlobalUsage() {
		return {
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				thinkingTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalCostMicros: 0,
				currency: '',
				requestCount: 0,
			},
		};
	}
	async saveMemory() {
		return { success: false, message: '', filePath: '' };
	}
	async searchMemory() {
		return { results: [] };
	}
	async searchDeepMemory() {
		return { results: [], searchedCategories: [] };
	}
	async readMemory() {
		return { content: '', metadata: { category: '', filename: '', title: '', tags: [], createdAt: 0, updatedAt: 0, version: 0 } };
	}
	async listMemory() {
		return { categories: [] };
	}
	async deleteMemory() {
		return { success: false, message: '' };
	}
	async reflectMemory() {
		return { diagnoses: [], summary: '' };
	}
	openRebuildMemoryStream(): { dispose(): void } {
		return { dispose() { } };
	}
	async revertMemory() {
		return { success: false, message: '', revertedToVersion: 0 };
	}
	async historyMemory() {
		return { changes: [] };
	}
	async listContextVariable() {
		return { current: [], inherited: [] };
	}
	async readContextVariable() {
		return { entry: { name: '', content: '', scope: 'VARIABLE_GLOBAL' as const, updatedBy: '', updatedAt: 0 } };
	}
	async listNodes() {
		return { nodes: [], total: 0, onlineCount: 0 };
	}
	async getNode() {
		return {
			id: '',
			name: '',
			description: '',
			status: '',
			endpoint: '',
			tags: [],
			capabilities: {
				models: [],
				tools: [],
				modes: [],
				serverVersion: '',
				protocolVersion: '',
				properties: {},
			},
			load: {
				activeSessions: 0,
				queueDepth: 0,
				cpuPercent: 0,
				memoryUsedMb: 0,
			},
			lastHeartbeatAt: 0,
		};
	}
	async checkConnection() {
		return {
			reachable: false,
			authenticated: false,
			canCreateSession: false,
			latencyMs: 0,
			capabilities: {
				models: [],
				tools: [],
				modes: [],
				serverVersion: '',
				protocolVersion: '',
				properties: {},
			},
			errors: [],
			load: {
				activeSessions: 0,
				queueDepth: 0,
				cpuPercent: 0,
				memoryUsedMb: 0,
			},
		};
	}
	async setMaintenance() {
		return { success: false };
	}
	async exitMaintenance() {
		return { success: false };
	}
	async listConfigs() {
		return { configs: [] };
	}
	async getRemoteAgentConfig() {
		return {
			id: '',
			name: '',
			description: '',
			enabled: false,
			endpoint: { host: '', port: 0, tls: false, tlsCertPath: '' },
			auth: { type: '', apiKeyRef: '', tokenRef: '' },
			tags: [],
			maxConcurrentSessions: 0,
			sessionLifecycle: '',
			defaultPermissionDelegate: {
				mode: '',
				whitelist: [],
				budget: { maxToolCalls: 0, maxTokens: 0, timeoutMs: 0, windowMs: 0, maxBubbleToUserPerDay: 0 },
				timeoutPolicy: '',
				fallback: '',
				bubbleTarget: '',
			},
			healthCheck: {
				intervalMs: 0,
				timeoutMs: 0,
				unhealthyThreshold: 0,
				healthyThreshold: 0,
				useWatch: false,
				degradedErrorRateThreshold: 0,
				degradedP99LatencyMs: 0,
			},
		};
	}
	async saveRemoteAgentConfig() {
		return {
			success: false,
			message: '',
			connectionTest: {
				reachable: false,
				authenticated: false,
				canCreateSession: false,
				latencyMs: 0,
				capabilities: {
					models: [],
					tools: [],
					modes: [],
					serverVersion: '',
					protocolVersion: '',
					properties: {},
				},
				errors: [],
				load: {
					activeSessions: 0,
					queueDepth: 0,
					cpuPercent: 0,
					memoryUsedMb: 0,
				},
			},
			asyncTestId: '',
		};
	}
	async resetError() {
		return { success: false };
	}
	async deleteRemoteAgentConfig() {
		return { success: false };
	}
	async reloadRemoteAgents() {
		return { success: false, added: [], removed: [], changed: [], errors: [], durationMs: 0 };
	}
	openRemoteChatStream(): { dispose(): void } {
		return { dispose() { } };
	}
	async createRemoteSession() {
		return { callId: '', status: '', createdAt: 0, expiresAt: 0 };
	}
	async destroyRemoteSession() {
		return { success: false, message: '' };
	}
	async getRemoteSessionStatus() {
		return { status: '', callId: '', progress: '', elapsedMs: 0, expiresAt: 0, pendingPermissions: [], pendingQuestions: [] };
	}

	async getRemoteSessionHistory() {
		return { messages: [], version: 0, hasMore: false };
	}
	async resumeRemoteSession() {
		return { success: false, callId: '', status: '', message: '', expiresAt: 0 };
	}
	async cancelRemoteSession() {
		return { success: false, callId: '', status: '', message: '' };
	}
	async getUploadProgress() {
		return { exists: false, bytesReceived: 0, partialPath: '' };
	}
	async shutdown() {
		return { accepted: false, message: '' };
	}
	async writeClipboard() {
		return { clipId: '' };
	}
	async readClipboard() {
		return {
			entry: {
				clipId: '',
				label: '',
				type: 'CLIPBOARD_TEXT' as const,
				content: '',
				createdBy: '',
				createdAt: 0,
			},
		};
	}
	async listClipboard() {
		return { entries: [] };
	}
	async clearClipboard() {
		return { removedCount: 0 };
	}
	openUploadAttachmentStream(): { write(): void; end(): void; dispose(): void } {
		return { write() { }, end() { }, dispose() { } };
	}
	openDownloadAttachmentStream(): { dispose(): void } {
		return { dispose() { } };
	}
	openPtyStream(): { write(): void; end(): void; dispose(): void } {
		return { write() { }, end() { }, dispose() { } };
	}

	async healthCheck() {
		return { status: '', version: '', activeSessions: 0, uptimeMs: 0 };
	}

	async doctor() {
		return { checks: [], allPassed: false };
	}

	async listDevices() {
		return { devices: [] };
	}

	async pairApprove() {
		return { success: false, deviceId: '', message: '' };
	}

	async pairReject() {
		return { success: false, message: '' };
	}

	async revoke() {
		return { success: false, message: '' };
	}

	async rotateToken() {
		return { success: false, message: '' };
	}

	async listPending() {
		return { pending: [] };
	}

	async listTriggers() {
		return { triggers: [] };
	}

	async upsertTrigger() {
		return {
			trigger: {
				triggerId: '',
				name: '',
				type: '',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'unspecified' as const },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			},
		};
	}

	async deleteTrigger() {
		return {};
	}

	async setTriggerEnabled() {
		return {
			trigger: {
				triggerId: '',
				name: '',
				type: '',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'unspecified' as const },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			},
		};
	}
	async fireTrigger() {
		return { status: '', eventId: '', reason: '' };
	}
	async listModels() { return { models: [] }; }
	async getConfig(): Promise<{ values: Record<string, string>; scope: '' }> {
		return { values: {}, scope: '' };
	}
	async switchModel() { return { resolvedModelId: '', provider: '', level: 0, cost: '', speed: '' }; }
	async getModelPreferences() { return { minLevel: 0, maxCost: '', minSpeed: '', strategy: '' }; }
	async resolveModel() { return { candidates: [], filtered: [] }; }
	openWatchConfigStream(): { dispose(): void } {
		return { dispose() { } };
	}

	async fetchAgentTree() { return undefined; }
	async fetchToolDetail() { return { success: false, content: '', truncated: false }; }
	async memberStatus() { return []; }
	async taskList() { return []; }
	async teamInfo() { return undefined; }
	async listProviderStatus() { return { providers: [] }; }
	async upsertProviderCredentials() { return { providerId: '', brand: '', protocol: '', configured: false, credentialSource: 'NONE', hasBaseUrl: false, enabled: false }; }
	async clearProviderCredentials() { return { providerId: '', brand: '', protocol: '', configured: false, credentialSource: 'NONE', hasBaseUrl: false, enabled: false }; }
	async listProjectRules() { return { rules: [] }; }
	async upsertProjectRule() { return { id: '', title: '', enabled: false, priority: 0 as const, body: '', scope: 0 as const, globs: [], appliesTo: [] }; }
	async deleteProjectRule() { return { deleted: false }; }
	async listHookPoints() { return { points: [], catalogRevision: '' }; }
	async listTeams() { return { teams: [] }; }
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
		assert.strictEqual(transport.authNonceCalls.length, 1);
	});

	test('provisional pairing calls GetAuthNonce only once', async () => {
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
		});

		const started = await orchestrator.startPairing(createPairingProfile(), endpoint);
		assert.strictEqual(started.ok, true);
		assert.strictEqual(transport.authNonceCalls.length, 1);
		assert.strictEqual(transport.connectCalls.length, 1);
	});

	test('provisional Connect with pairing_nonce and empty sas_code uses locally derived SAS', async () => {
		const identity = mintTestIdentity();
		const expectedSas = derivePairingSasCode({
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
			assert.strictEqual(started.snapshot.phase, 'awaiting_sas_confirm');
			assert.strictEqual(started.snapshot.sasCode, expectedSas);
			assert.strictEqual(started.snapshot.sessionTokenInstalled, false);
		}
		assert.strictEqual(transport.authNonceCalls.length, 1);
	});

	test('startPairing does not wait for confirmSas', async () => {
		const identity = mintTestIdentity();
		let confirmCalls = 0;
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
			confirmSas: async () => {
				confirmCalls++;
				return new Promise<boolean>(() => { /* never resolves */ });
			},
		});

		const started = await orchestrator.startPairing(createPairingProfile(), endpoint);
		assert.strictEqual(started.ok, true);
		if (started.ok) {
			assert.strictEqual(started.snapshot.phase, 'awaiting_sas_confirm');
			assert.strictEqual(started.awaitingUserConfirm, true);
		}
		assert.strictEqual(confirmCalls, 0);
		assert.strictEqual(transport.authNonceCalls.length, 1);
	});

	test('provisional Connect timeout after GetAuthNonce is transport_failed and does not enter recoverTrust', async () => {
		const identity = mintTestIdentity();
		let trustPuts = 0;
		let profilePuts = 0;
		let recoverConfirmCalls = 0;
		const transport = new RecordingMockTransport({
			getAuthNonce: async () => ({
				authNonce: new Uint8Array(32).fill(0x11),
				engineIdentityId,
				engineCertFingerprint: leafSha256Hex,
			}),
			connectWithDeviceAuth: () => new Promise<never>(() => { /* engine holds Connect */ }),
		});
		const orchestrator = createPairingOrchestrator({
			clientIdentityStore: new TestClientIdentityStore(identity),
			engineTrustStore: {
				get: () => undefined,
				list: () => [],
				put: () => { trustPuts++; },
				remove: () => { },
			},
			connectionProfileStore: {
				list: () => [],
				get: () => undefined,
				put: () => { profilePuts++; },
				remove: () => { },
				createDraft: () => createPairingProfile(),
			},
			createPinnedTransport: () => transport,
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
			confirmRecoverTrust: async () => {
				recoverConfirmCalls++;
				return true;
			},
			provisionalConnectTimeoutMs: 20,
		});

		const started = await orchestrator.startPairing(createPairingProfile(), endpoint);
		assert.strictEqual(started.ok, false);
		if (!started.ok) {
			assert.strictEqual(started.code, 'transport_failed');
		}
		assert.notStrictEqual(orchestrator.getSnapshot()?.phase, 'recover_trust');
		assert.strictEqual(transport.authNonceCalls.length, 1);
		assert.strictEqual(trustPuts, 0);
		assert.strictEqual(profilePuts, 0);
		assert.strictEqual(recoverConfirmCalls, 0);

		const confirmed = await orchestrator.confirmRecoverTrust();
		assert.strictEqual(confirmed.ok, false);
		if (!confirmed.ok) {
			assert.strictEqual(confirmed.code, 'no_recover_trust');
		}
		assert.strictEqual(trustPuts, 0);
		assert.strictEqual(profilePuts, 0);
		assert.strictEqual(recoverConfirmCalls, 0);
	});

	test('confirmSas and confirmRecoverTrust reject when confirmation hooks are not injected', async () => {
		const identity = mintTestIdentity();
		const sasCode = derivePairingSasCode({
			engineIdentityId,
			engineCertFingerprint: leafSha256Hex,
			clientPublicKey: identity.clientPublicKey,
			pairingNonce: pairingNonceBytes,
			protocolVersion: DEVICE_GRANT_AUTH_PROTOCOL_VERSION,
		});
		const sasTransport = new RecordingMockTransport({
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
		const sasOrchestrator = createPairingOrchestrator({
			clientIdentityStore: new TestClientIdentityStore(identity),
			engineTrustStore: { get: () => undefined, list: () => [], put: () => { }, remove: () => { } },
			connectionProfileStore: { list: () => [], get: () => undefined, put: () => { }, remove: () => { }, createDraft: () => createPairingProfile() },
			createPinnedTransport: () => sasTransport,
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
		});
		const sasStarted = await sasOrchestrator.startPairing(createPairingProfile(), endpoint);
		assert.strictEqual(sasStarted.ok, true);
		const sasRejected = await sasOrchestrator.confirmSas();
		assert.deepStrictEqual(sasRejected, { ok: false, code: 'sas_cancelled', reason: 'user cancelled SAS confirmation' });

		const recoverTransport = new RecordingMockTransport({
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
		const recoverOrchestrator = createPairingOrchestrator({
			clientIdentityStore: new TestClientIdentityStore(identity),
			engineTrustStore: { get: () => undefined, list: () => [], put: () => { }, remove: () => { } },
			connectionProfileStore: { list: () => [], get: () => undefined, put: () => { }, remove: () => { }, createDraft: () => createPairingProfile() },
			createPinnedTransport: () => recoverTransport,
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
		});
		const recoverStarted = await recoverOrchestrator.startPairing(createPairingProfile(), endpoint);
		assert.strictEqual(recoverStarted.ok, true);
		if (recoverStarted.ok) {
			assert.strictEqual(recoverStarted.snapshot.phase, 'recover_trust');
		}
		const recoverRejected = await recoverOrchestrator.confirmRecoverTrust();
		assert.deepStrictEqual(recoverRejected, { ok: false, code: 'recover_cancelled', reason: 'user cancelled recoverTrust confirmation' });
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
		assert.strictEqual(transport.authNonceCalls.length, 1);
	});

	test('observe throw becomes observe_failed instead of rejecting startPairing', async () => {
		const identity = mintTestIdentity();
		const orchestrator = createPairingOrchestrator({
			clientIdentityStore: new TestClientIdentityStore(identity),
			engineTrustStore: { get: () => undefined, list: () => [], put: () => { }, remove: () => { } },
			connectionProfileStore: { list: () => [], get: () => undefined, put: () => { }, remove: () => { }, createDraft: () => createPairingProfile() },
			createPinnedTransport: () => {
				throw new Error('transport must not be created when observe throws');
			},
			observeCandidateLeafFn: async () => {
				throw new Error('Setting the TLS ServerName to an IP address is not permitted.');
			},
		});

		const started = await orchestrator.startPairing(createPairingProfile(), endpoint);
		assert.strictEqual(started.ok, false);
		if (!started.ok) {
			assert.strictEqual(started.code, 'observe_failed');
			assert.ok(started.reason.includes('TLS ServerName'));
		}
	});

	function nonceResult() {
		return {
			authNonce: new Uint8Array(32).fill(0x11),
			engineIdentityId,
			engineCertFingerprint: leafSha256Hex,
		};
	}

	function pairedTransport(identity: TestIdentityMaterial, kind: 'trial' | 'formal'): RecordingMockTransport {
		const sasCode = derivePairingSasCode({
			engineIdentityId,
			engineCertFingerprint: leafSha256Hex,
			clientPublicKey: identity.clientPublicKey,
			pairingNonce: pairingNonceBytes,
			protocolVersion: DEVICE_GRANT_AUTH_PROTOCOL_VERSION,
		});
		return new RecordingMockTransport({
			getAuthNonce: async () => nonceResult(),
			connectWithDeviceAuth: async () => kind === 'formal'
				? { sessionToken: 'token-formal', methods: [], events: [] }
				: { pairingNonce: pairingNonceB64, sasCode, methods: [], events: [] },
		});
	}

	function claimedTransport(): RecordingMockTransport {
		return new RecordingMockTransport({
			getAuthNonce: async () => {
				throw new Error('relay ticket already claimed');
			},
		});
	}

	function orchestratorBase(identity: TestIdentityMaterial) {
		return {
			clientIdentityStore: new TestClientIdentityStore(identity),
			engineTrustStore: { get: () => undefined, list: () => [], put: () => { }, remove: () => { } },
			connectionProfileStore: { list: () => [], get: () => undefined, put: () => { }, remove: () => { }, createDraft: () => createPairingProfile() },
			confirmSas: async () => true,
			confirmRecoverTrust: async () => true,
		};
	}

	test('ticketed pairing renews before trial and formal dials and does not reuse a servername', async () => {
		const identity = mintTestIdentity();
		const observedEndpoint: PairingDialEndpoint = {
			host: '203.0.113.9',
			port: 443,
			servername: 'observe.example',
			relayTicketId: 'ticket-observe',
		};
		const trialEndpoint: PairingDialEndpoint = {
			host: '203.0.113.10',
			port: 443,
			servername: 'trial.example',
			relayTicketId: 'ticket-trial',
		};
		const formalEndpoint: PairingDialEndpoint = {
			host: '203.0.113.11',
			port: 443,
			servername: 'formal.example',
			relayTicketId: 'ticket-formal',
		};
		const claims = new Set<string>();
		const claim = (servername: string): boolean => {
			if (claims.has(servername)) {
				return false;
			}
			claims.add(servername);
			return true;
		};
		const observed: string[] = [];
		const dialed: PairingDialEndpoint[] = [];
		const renewed: PairingDialEndpoint[] = [];
		let dialKind: 'trial' | 'formal' = 'trial';
		const orchestrator = createPairingOrchestrator({
			...orchestratorBase(identity),
			observeCandidateLeafFn: async input => {
				observed.push(input.servername ?? '');
				if (!claim(input.servername ?? '')) {
					return { ok: false, code: 'observe_failed', reason: 'relay ticket already claimed' };
				}
				return { ok: true, leafDer, leafSha256Hex };
			},
			renewDialEndpoint: async () => {
				const endpointForDial = renewed.length === 0 ? trialEndpoint : formalEndpoint;
				renewed.push(endpointForDial);
				return { ok: true, endpoint: endpointForDial };
			},
			createPinnedTransport: ({ endpoint: dial }) => {
				dialed.push(dial);
				if (!claim(dial.servername)) {
					return claimedTransport();
				}
				return pairedTransport(identity, dialKind);
			},
		});

		const started = await orchestrator.startPairing(createPairingProfile(), observedEndpoint);
		assert.strictEqual(started.ok, true);
		const active = (orchestrator as unknown as { activeContext?: { endpoint: PairingDialEndpoint } }).activeContext;
		assert.strictEqual(active?.endpoint, observedEndpoint);
		assert.notStrictEqual(active?.endpoint, trialEndpoint);
		dialKind = 'formal';
		const confirmed = await orchestrator.confirmSas();
		assert.strictEqual(confirmed.ok, true);
		if (confirmed.ok) {
			assert.strictEqual(confirmed.sessionToken, 'token-formal');
		}
		assert.deepStrictEqual(renewed, [trialEndpoint, formalEndpoint]);
		assert.deepStrictEqual(observed, ['observe.example']);
		assert.strictEqual(dialed[0], trialEndpoint);
		assert.strictEqual(dialed[1], formalEndpoint);
		assert.deepStrictEqual(
			[observed[0], dialed[0].servername, dialed[1].servername],
			['observe.example', 'trial.example', 'formal.example'],
		);
		assert.notStrictEqual(dialed[1].servername, active?.endpoint.servername);
	});

	test('direct pairing never renews and reuses the same endpoint', async () => {
		const cases: Array<PairingDialEndpoint['relayTicketId']> = [undefined, null, ''];
		for (const relayTicketId of cases) {
			const identity = mintTestIdentity();
			let renews = 0;
			const dialed: string[] = [];
			const directEndpoint: PairingDialEndpoint = {
				host: '198.51.100.8',
				port: 443,
				servername: 'direct.example',
				relayTicketId,
			};
			const orchestrator = createPairingOrchestrator({
				...orchestratorBase(identity),
				observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
				renewDialEndpoint: async () => {
					renews++;
					return { ok: false, code: 'hub_ticket_failed', reason: 'must not renew a direct dial' };
				},
				createPinnedTransport: ({ endpoint: dial }) => {
					dialed.push(dial.servername);
					return pairedTransport(identity, dialed.length === 1 ? 'trial' : 'formal');
				},
			});
			const started = await orchestrator.startPairing(createPairingProfile(), directEndpoint);
			assert.strictEqual(started.ok, true, `relayTicketId ${String(relayTicketId)}`);
			const confirmed = await orchestrator.confirmSas();
			assert.strictEqual(confirmed.ok, true, `relayTicketId ${String(relayTicketId)}`);
			assert.strictEqual(renews, 0);
			assert.deepStrictEqual(dialed, ['direct.example', 'direct.example']);
		}
	});

	test('ticketed pairing fails closed when renewal is missing or returns hub_unreachable', async () => {
		const identity = mintTestIdentity();
		const ticketed: PairingDialEndpoint = {
			host: '203.0.113.9',
			port: 443,
			servername: 'observe.example',
			relayTicketId: 'ticket-observe',
		};
		let created = 0;
		const missing = createPairingOrchestrator({
			...orchestratorBase(identity),
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
			createPinnedTransport: () => {
				created++;
				throw new Error('transport must not be created');
			},
		});
		const missingResult = await missing.startPairing(createPairingProfile(), ticketed);
		assert.strictEqual(missingResult.ok, false);
		if (!missingResult.ok) {
			assert.strictEqual(missingResult.code, 'hub_ticket_failed');
		}
		assert.strictEqual(created, 0);

		const unreachable = createPairingOrchestrator({
			...orchestratorBase(identity),
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
			renewDialEndpoint: async () => ({ ok: false, code: 'hub_unreachable', reason: 'hub down' }),
			createPinnedTransport: () => {
				created++;
				throw new Error('transport must not be created');
			},
		});
		const unreachableResult = await unreachable.startPairing(createPairingProfile(), ticketed);
		assert.deepStrictEqual(unreachableResult, { ok: false, code: 'hub_unreachable', reason: 'hub down' });
		assert.strictEqual(created, 0);

		let formalCreated = 0;
		const trialEndpoint: PairingDialEndpoint = {
			host: '203.0.113.10',
			port: 443,
			servername: 'trial.example',
			relayTicketId: 'ticket-trial',
		};
		let renews = 0;
		const formalFailure = createPairingOrchestrator({
			...orchestratorBase(identity),
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
			renewDialEndpoint: async () => {
				renews++;
				if (renews === 1) {
					return { ok: true, endpoint: trialEndpoint };
				}
				return { ok: false, code: 'hub_unreachable', reason: 'hub down' };
			},
			createPinnedTransport: ({ endpoint: dial }) => {
				formalCreated++;
				assert.strictEqual(dial, trialEndpoint);
				return pairedTransport(identity, 'trial');
			},
		});
		const started = await formalFailure.startPairing(createPairingProfile(), ticketed);
		assert.strictEqual(started.ok, true);
		const confirmed = await formalFailure.confirmSas();
		assert.deepStrictEqual(confirmed, { ok: false, code: 'hub_unreachable', reason: 'hub down' });
		assert.strictEqual(formalCreated, 1);
	});

	test('a new pairing during renewal returns superseded or stale and does not dial', async () => {
		const identity = mintTestIdentity();
		const ticketed: PairingDialEndpoint = {
			host: '203.0.113.9',
			port: 443,
			servername: 'observe.example',
			relayTicketId: 'ticket-observe',
		};
		const renewedEndpoint: PairingDialEndpoint = {
			host: '203.0.113.10',
			port: 443,
			servername: 'renewed.example',
			relayTicketId: 'ticket-renewed',
		};
		const directEndpoint: PairingDialEndpoint = {
			host: '198.51.100.2',
			port: 443,
			servername: 'direct.example',
		};
		const dialed: string[] = [];
		let trialOrchestrator!: ReturnType<typeof createPairingOrchestrator>;
		trialOrchestrator = createPairingOrchestrator({
			...orchestratorBase(identity),
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
			renewDialEndpoint: async () => {
				await trialOrchestrator.startPairing(createPairingProfile(), directEndpoint);
				return { ok: true, endpoint: renewedEndpoint };
			},
			createPinnedTransport: ({ endpoint: dial }) => {
				dialed.push(dial.servername);
				return pairedTransport(identity, 'trial');
			},
		});
		const superseded = await trialOrchestrator.startPairing(createPairingProfile(), ticketed);
		assert.deepStrictEqual(superseded, { ok: false, code: 'pairing_superseded', reason: 'pairing superseded' });
		assert.ok(!dialed.includes('renewed.example'));

		const formalDialed: string[] = [];
		const trialOnly: PairingDialEndpoint = {
			host: '203.0.113.12',
			port: 443,
			servername: 'trial-only.example',
			relayTicketId: 'ticket-trial',
		};
		const formalEndpoint: PairingDialEndpoint = {
			host: '203.0.113.13',
			port: 443,
			servername: 'formal-only.example',
			relayTicketId: 'ticket-formal',
		};
		let renews = 0;
		let formalOrchestrator!: ReturnType<typeof createPairingOrchestrator>;
		formalOrchestrator = createPairingOrchestrator({
			...orchestratorBase(identity),
			observeCandidateLeafFn: async () => ({ ok: true, leafDer, leafSha256Hex }),
			renewDialEndpoint: async () => {
				renews++;
				if (renews === 1) {
					return { ok: true, endpoint: trialOnly };
				}
				await formalOrchestrator.startPairing(createPairingProfile(), directEndpoint);
				return { ok: true, endpoint: formalEndpoint };
			},
			createPinnedTransport: ({ endpoint: dial }) => {
				formalDialed.push(dial.servername);
				return pairedTransport(identity, formalDialed.length === 1 ? 'trial' : 'formal');
			},
		});
		const started = await formalOrchestrator.startPairing(createPairingProfile(), ticketed);
		assert.strictEqual(started.ok, true);
		const stale = await formalOrchestrator.confirmSas();
		assert.deepStrictEqual(stale, { ok: false, code: 'no_active_pairing', reason: 'no pairing awaiting SAS confirmation' });
		assert.ok(!formalDialed.includes('formal-only.example'));
	});
});
