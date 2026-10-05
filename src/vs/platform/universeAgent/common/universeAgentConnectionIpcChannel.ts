/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken } from '../../../base/common/cancellation.js';
import { ErrorNoTelemetry } from '../../../base/common/errors.js';
import type { Event } from '../../../base/common/event.js';
import { revive } from '../../../base/common/marshalling.js';
import type { IServerChannel } from '../../../base/parts/ipc/common/ipc.js';
import type { IUniverseAgentHubService } from './hub.js';
import type { IUniverseAgentHostConnection } from './universeAgentHostConnection.js';
import type { IUniverseAgentConnection, IUniverseAgentTeamApi } from './universeAgentConnection.js';
import {
	navigatorTeamInfoCommand,
	navigatorTeamMemberStatusCommand,
	navigatorTeamTaskListCommand,
} from './universeAgentNavigatorTeamIpc.js';

/**
 * Window-facing allowlist over one shared ProxyChannel.
 * Host methods, the removed connect() command name, and callback streams are rejected before the inner channel.
 * Team reads are three unary commands because the nested team object cannot cross ProxyChannel.
 */

type ConnectionEventName = Extract<keyof IUniverseAgentConnection, `on${string}`>;

type DeniedConnectionCall =
	| 'connect'
	| 'subscribeSessionEventStream'
	| 'chat'
	| 'openChatStream'
	| 'openContinuationStream'
	| 'openRegenerateStream'
	| 'openResumeStream'
	| 'openSubscribeToolDetailStream'
	| 'openRebuildMemoryStream'
	| 'openRemoteChatStream'
	| 'openUploadAttachmentStream'
	| 'openDownloadAttachmentStream'
	| 'openPtyStream'
	| 'openWatchConfigStream';

type ConnectionForwardedCall = Exclude<
	keyof IUniverseAgentConnection,
	'_serviceBrand' | 'team' | ConnectionEventName | DeniedConnectionCall
>;

type HostEventName = Extract<keyof IUniverseAgentHostConnection, `on${string}`>;
type HostCallName = Exclude<keyof IUniverseAgentHostConnection, HostEventName>;

type HubEventName = Extract<keyof IUniverseAgentHubService, `on${string}`>;
type HubForwardedCall = Exclude<keyof IUniverseAgentHubService, '_serviceBrand' | HubEventName>;

type Exact<Missing, Extra> = [Missing] extends [never]
	? ([Extra] extends [never] ? true : never)
	: never;

const DENIED_CONNECTION_CALLS = {
	connect: true,
	subscribeSessionEventStream: true,
	chat: true,
	openChatStream: true,
	openContinuationStream: true,
	openRegenerateStream: true,
	openResumeStream: true,
	openSubscribeToolDetailStream: true,
	openRebuildMemoryStream: true,
	openRemoteChatStream: true,
	openUploadAttachmentStream: true,
	openDownloadAttachmentStream: true,
	openPtyStream: true,
	openWatchConfigStream: true,
} as const;

const FORWARDED_CONNECTION_EVENTS = {
	onDidChangeConnection: true,
	onDidFileMutation: true,
	onDidTurnSettle: true,
	onDidChangeTeamRuntime: true,
} as const;

const FORWARDED_CONNECTION_CALLS = {
	isEngineConnected: true,
	getTransportState: true,
	getConnectionSnapshot: true,
	getCapabilitySnapshot: true,
	requestAgentTreeRefresh: true,
	getNavigatorCapability: true,
	isAgentTreeFetchFailed: true,
	connectProfile: true,
	confirmPairing: true,
	cancelPairing: true,
	probeConnectionProfile: true,
	getConnectionPhase: true,
	disconnect: true,
	listSessions: true,
	createSession: true,
	deleteSession: true,
	getSessionInfo: true,
	resumeSession: true,
	prewarmSessions: true,
	shelveSession: true,
	unshelveSession: true,
	purgeSession: true,
	exportSession: true,
	resolveTurn: true,
	getAgentStatus: true,
	getTodo: true,
	compact: true,
	resolveAnchor: true,
	getUsage: true,
	listAgents: true,
	getAgentHistory: true,
	pauseAgent: true,
	back: true,
	prune: true,
	resetAgent: true,
	branch: true,
	suspendLoop: true,
	resumeLoop: true,
	stopLoop: true,
	renameSession: true,
	cancelGeneration: true,
	cancelToolCall: true,
	runToolInBackground: true,
	stopShellTask: true,
	sendShellSessionClientControl: true,
	fetchToolUsageDetail: true,
	fireTriggerWebhook: true,
	installSessionDemoFake: true,
	clearSessionDemoFake: true,
	switchWorkDir: true,
	testModelProfile: true,
	setConfig: true,
	setModelPreferences: true,
	setSessionGoal: true,
	cancelSessionGoal: true,
	respondPermission: true,
	syncPermissionRule: true,
	promotePermissionRule: true,
	getSessionRules: true,
	setPermissionMode: true,
	taskUpdate: true,
	taskCancel: true,
	messageMember: true,
	createTeam: true,
	startMember: true,
	killMember: true,
	abort: true,
	respondQuestion: true,
	enqueueQueueItem: true,
	insertQueueItem: true,
	reorderQueue: true,
	deleteQueueItem: true,
	retryQueueItem: true,
	retryAllFailed: true,
	retryQueueItemUpload: true,
	pinQueueItem: true,
	setQueueItemLocked: true,
	injectQueueItem: true,
	setQueueItemForkAnchor: true,
	pauseQueue: true,
	resumeQueue: true,
	clearQueue: true,
	holdQueueItem: true,
	releaseQueueItemHold: true,
	editQueueItem: true,
	forkAgent: true,
	killAgent: true,
	deleteMessage: true,
	editMessage: true,
	sendClientToolResponse: true,
	listSnapshots: true,
	listLoopSnapshots: true,
	createSnapshot: true,
	restoreSnapshot: true,
	deleteSnapshot: true,
	getHistory: true,
	chatSync: true,
	syncInputDelivery: true,
	listSkills: true,
	setSkillEnabled: true,
	getSkillInfo: true,
	saveSkillContent: true,
	listAgentProfiles: true,
	saveAgentProfile: true,
	deleteAgentProfile: true,
	resetAgentProfile: true,
	listMcpServers: true,
	getMcpServerStatuses: true,
	getMcpServerTools: true,
	listPlugins: true,
	getPluginInfo: true,
	enablePlugin: true,
	reloadPlugin: true,
	unloadPlugin: true,
	scanNewPlugins: true,
	addMcpServer: true,
	updateMcpServer: true,
	removeMcpServer: true,
	toggleMcpServer: true,
	listTools: true,
	getToolInfo: true,
	listCommands: true,
	getCommandDef: true,
	listFiles: true,
	readFile: true,
	getFileInfo: true,
	writeFile: true,
	forceWriteFile: true,
	agentMerge: true,
	readGitSummary: true,
	readGitChanges: true,
	readGitFileDiff: true,
	writeGitStagePaths: true,
	writeGitCommit: true,
	writeGitApplyHunks: true,
	getSessionUsage: true,
	getGlobalUsage: true,
	saveMemory: true,
	searchMemory: true,
	searchDeepMemory: true,
	readMemory: true,
	listMemory: true,
	deleteMemory: true,
	reflectMemory: true,
	revertMemory: true,
	historyMemory: true,
	listContextVariable: true,
	readContextVariable: true,
	listNodes: true,
	getNode: true,
	checkConnection: true,
	setMaintenance: true,
	exitMaintenance: true,
	listConfigs: true,
	getRemoteAgentConfig: true,
	saveRemoteAgentConfig: true,
	resetError: true,
	deleteRemoteAgentConfig: true,
	reloadRemoteAgents: true,
	createRemoteSession: true,
	destroyRemoteSession: true,
	getRemoteSessionStatus: true,
	getRemoteSessionHistory: true,
	resumeRemoteSession: true,
	cancelRemoteSession: true,
	getUploadProgress: true,
	healthCheck: true,
	doctor: true,
	shutdown: true,
	listDevices: true,
	pairApprove: true,
	pairReject: true,
	revoke: true,
	rotateToken: true,
	listPending: true,
	listTriggers: true,
	upsertTrigger: true,
	deleteTrigger: true,
	setTriggerEnabled: true,
	fireTrigger: true,
	writeClipboard: true,
	readClipboard: true,
	listClipboard: true,
	clearClipboard: true,
	setPermissionPolicy: true,
	listModels: true,
	listProviderStatus: true,
	listProjectRules: true,
	listHookPoints: true,
	listTeams: true,
	getConfig: true,
	switchModel: true,
	getModelPreferences: true,
	resolveModel: true,
	probeEngine: true,
} as const;

const DENIED_HOST_CALLS = {
	fetchAgentTree: true,
	isAgentTreeUnsupported: true,
	fetchToolDetail: true,
	notifyFileMutation: true,
	notifyTurnSettle: true,
	notifyTeamRuntimeChange: true,
} as const;

const DENIED_HOST_EVENTS = {
	onRequestAgentTreeRefresh: true,
} as const;

const FORWARDED_HUB_CALLS = {
	getActiveHubBaseUrl: true,
	setActiveHubBaseUrl: true,
	getAuthStatus: true,
	getDirectoryStatus: true,
	listConnectionProfiles: true,
	login: true,
	logout: true,
	changePassword: true,
	refreshDirectory: true,
	renameDevice: true,
	revokeDevice: true,
	confirmDeviceCode: true,
	addDirectAddressProfile: true,
	addHubDeviceProfile: true,
	forgetConnectionProfile: true,
	isEncryptionAvailable: true,
} as const;

const FORWARDED_HUB_EVENTS = {
	onDidChangeAuthStatus: true,
	onDidChangeDirectory: true,
	onDidChangeProfiles: true,
} as const;


function hasOwn(record: object, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(record, key);
}

function reviveArgs(arg: unknown): unknown[] {
	if (!Array.isArray(arg)) {
		return [];
	}
	return arg.map(value => revive(value));
}

function asString(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

function asTeamId(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	throw new ErrorNoTelemetry('Invalid team id');
}

function sealIpcContract(..._proofs: true[]): void {
	// The arguments are compile-time proofs. A drifted allowlist is not assignable to true.
}

sealIpcContract(
	true as Exact<
		Exclude<DeniedConnectionCall, keyof typeof DENIED_CONNECTION_CALLS>,
		Exclude<keyof typeof DENIED_CONNECTION_CALLS, DeniedConnectionCall>
	>,
	true as Exact<
		Exclude<ConnectionForwardedCall, keyof typeof FORWARDED_CONNECTION_CALLS>,
		Exclude<keyof typeof FORWARDED_CONNECTION_CALLS, ConnectionForwardedCall>
	>,
	true as Exact<
		Exclude<ConnectionEventName, keyof typeof FORWARDED_CONNECTION_EVENTS>,
		Exclude<keyof typeof FORWARDED_CONNECTION_EVENTS, ConnectionEventName>
	>,
	true as Exact<
		Exclude<HostCallName, keyof typeof DENIED_HOST_CALLS>,
		Exclude<keyof typeof DENIED_HOST_CALLS, HostCallName>
	>,
	true as Exact<
		Exclude<HostEventName, keyof typeof DENIED_HOST_EVENTS>,
		Exclude<keyof typeof DENIED_HOST_EVENTS, HostEventName>
	>,
	true as Exact<
		Exclude<HubForwardedCall, keyof typeof FORWARDED_HUB_CALLS>,
		Exclude<keyof typeof FORWARDED_HUB_CALLS, HubForwardedCall>
	>,
	true as Exact<
		Exclude<HubEventName, keyof typeof FORWARDED_HUB_EVENTS>,
		Exclude<keyof typeof FORWARDED_HUB_EVENTS, HubEventName>
	>,
	true as Exact<Extract<HostCallName, ConnectionForwardedCall>, never>,
	true as Exact<Extract<HubForwardedCall, ConnectionForwardedCall>, never>,
	true as Exact<Extract<DeniedConnectionCall, ConnectionForwardedCall>, never>,
);

export interface IUniverseAgentConnectionIpcTarget {
	readonly team: IUniverseAgentTeamApi;
}

export class UniverseAgentConnectionIpcChannel implements IServerChannel<string> {

	constructor(
		private readonly service: IUniverseAgentConnectionIpcTarget,
		private readonly inner: IServerChannel<string>,
	) { }

	call<T>(ctx: string, command: string, arg?: unknown, cancellationToken?: CancellationToken): Promise<T> {
		const teamCall = this.tryTeamCall<T>(command, arg);
		if (teamCall) {
			return teamCall;
		}
		if (hasOwn(DENIED_HOST_CALLS, command) || hasOwn(DENIED_CONNECTION_CALLS, command) || !hasOwn(FORWARDED_CONNECTION_CALLS, command)) {
			throw new ErrorNoTelemetry(`Method not found: ${command}`);
		}
		return this.inner.call<T>(ctx, command, arg, cancellationToken);
	}

	listen<T>(ctx: string, event: string, arg?: unknown): Event<T> {
		if (hasOwn(DENIED_HOST_EVENTS, event) || !hasOwn(FORWARDED_CONNECTION_EVENTS, event)) {
			throw new ErrorNoTelemetry(`Event not found: ${event}`);
		}
		return this.inner.listen<T>(ctx, event, arg);
	}

	private tryTeamCall<T>(command: string, arg: unknown): Promise<T> | undefined {
		if (command !== navigatorTeamMemberStatusCommand && command !== navigatorTeamTaskListCommand && command !== navigatorTeamInfoCommand) {
			return undefined;
		}
		const args = reviveArgs(arg);
		if (command === navigatorTeamMemberStatusCommand) {
			return Promise.resolve(this.service.team.memberStatus(asString(args[0]), asString(args[1]))) as Promise<T>;
		}
		if (command === navigatorTeamTaskListCommand) {
			return Promise.resolve(this.service.team.taskList(asString(args[0]), asString(args[1]))) as Promise<T>;
		}
		const teamId = asTeamId(args[2]);
		return Promise.resolve(this.service.team.teamInfo(asString(args[0]), asString(args[1]), teamId)) as Promise<T>;
	}
}

export class UniverseAgentHubIpcChannel implements IServerChannel<string> {

	constructor(
		private readonly inner: IServerChannel<string>,
	) { }

	call<T>(ctx: string, command: string, arg?: unknown, cancellationToken?: CancellationToken): Promise<T> {
		if (!hasOwn(FORWARDED_HUB_CALLS, command)) {
			throw new ErrorNoTelemetry(`Method not found: ${command}`);
		}
		return this.inner.call<T>(ctx, command, arg, cancellationToken);
	}

	listen<T>(ctx: string, event: string, arg?: unknown): Event<T> {
		if (!hasOwn(FORWARDED_HUB_EVENTS, event)) {
			throw new ErrorNoTelemetry(`Event not found: ${event}`);
		}
		return this.inner.listen<T>(ctx, event, arg);
	}
}

