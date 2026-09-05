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
