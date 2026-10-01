/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from '../../../base/common/errors.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, combinedDisposable, type IDisposable } from '../../../base/common/lifecycle.js';
import { localize } from '../../../nls.js';
import { finalizeConnectProfileResult, readConnectProfileSasCode } from '../common/connectProfileResult.js';
import { PAIRING_REQUIRED_USE_CONNECT_REASON, type ConnectionPath, type ConnectionPhase, type ConnectionFailureCode, type ConnectionProbeResult, type UniverseAgentConnectProfileResult } from '../common/connectionHubTypes.js';
import { sanitizeDesktopCapabilitySnapshot } from '../common/universeAgentRendererSync.js';
import type { IUniverseAgentConnection, IUniverseAgentTeamApi, UniverseAgentNavigatorCapabilityKey, UniverseAgentProbeEngineResult } from '../common/universeAgentConnection.js';
import type { IUniverseAgentHostConnection } from '../common/universeAgentHostConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentChatSyncRequest,
	UniverseAgentChatSyncResult,
	UniverseAgentSyncInputDeliveryRequest,
	UniverseAgentSyncInputDeliveryResult,
	UniverseAgentChatStream,
	UniverseAgentContinueGenerationRequest,
	UniverseAgentContinuationStream,
	UniverseAgentRegenerateRequest,
	UniverseAgentRegenerateStream,
	UniverseAgentResumeRequest,
	UniverseAgentResumeStream,
	UniverseAgentSubscribeToolDetailRequest,
	UniverseAgentSubscribeToolDetailChunk,
	UniverseAgentSubscribeToolDetailStream,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentConnectionSnapshot,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentSessionInfoRequest,
	UniverseAgentSessionInfoResult,
	UniverseAgentResumeSessionRequest,
	UniverseAgentResumeSessionResult,
	UniverseAgentPrewarmSessionsRequest,
	UniverseAgentPrewarmSessionsResult,
	UniverseAgentShelveSessionRequest,
	UniverseAgentShelveSessionResult,
	UniverseAgentUnshelveSessionRequest,
	UniverseAgentUnshelveSessionResult,
	UniverseAgentPurgeSessionRequest,
	UniverseAgentPurgeSessionResult,
	UniverseAgentExportSessionRequest,
	UniverseAgentExportSessionResult,
	UniverseAgentResolveTurnRequest,
	UniverseAgentResolveTurnResult,
	UniverseAgentAgentStatusRequest,
	UniverseAgentAgentStatusResult,
	UniverseAgentTodoRequest,
	UniverseAgentTodoResult,
	UniverseAgentCompactRequest,
	UniverseAgentCompactResult,
	UniverseAgentResolveAnchorRequest,
	UniverseAgentResolveAnchorResult,
	UniverseAgentUsageRequest,
	UniverseAgentUsageResult,
	UniverseAgentListAgentsRequest,
	UniverseAgentListAgentsResult,
	UniverseAgentAgentHistoryRequest,
	UniverseAgentAgentHistoryResult,
	UniverseAgentPauseAgentRequest,
	UniverseAgentPauseAgentResult,
	UniverseAgentBackRequest,
	UniverseAgentBackResult,
	UniverseAgentPruneRequest,
	UniverseAgentPruneResult,
	UniverseAgentResetAgentRequest,
	UniverseAgentResetAgentResult,
	UniverseAgentBranchRequest,
	UniverseAgentBranchResult,
	UniverseAgentSuspendLoopRequest,
	UniverseAgentSuspendLoopResult,
	UniverseAgentResumeLoopRequest,
	UniverseAgentResumeLoopResult,
	UniverseAgentStopLoopRequest,
	UniverseAgentStopLoopResult,
	UniverseAgentRenameSessionRequest,
	UniverseAgentRenameSessionResult,
	UniverseAgentCancelGenerationRequest,
	UniverseAgentCancelGenerationResult,
	UniverseAgentCancelToolCallRequest,
	UniverseAgentCancelToolCallResult,
	UniverseAgentRunToolInBackgroundRequest,
	UniverseAgentRunToolInBackgroundResult,
	UniverseAgentStopShellTaskRequest,
	UniverseAgentStopShellTaskResult,
	UniverseAgentSendShellSessionClientControlRequest,
	UniverseAgentSendShellSessionClientControlResult,
	UniverseAgentFetchToolUsageDetailRequest,
	UniverseAgentFetchToolUsageDetailResult,
	UniverseAgentFireTriggerWebhookRequest,
	UniverseAgentFireTriggerWebhookResult,
	UniverseAgentInstallSessionDemoFakeRequest,
	UniverseAgentInstallSessionDemoFakeResult,
	UniverseAgentClearSessionDemoFakeRequest,
	UniverseAgentClearSessionDemoFakeResult,
	UniverseAgentSwitchWorkDirRequest,
	UniverseAgentSwitchWorkDirResult,
	UniverseAgentTestModelProfileRequest,
	UniverseAgentTestModelProfileResult,
	UniverseAgentSetConfigRequest,
	UniverseAgentSetConfigResult,
	UniverseAgentSetModelPreferencesRequest,
	UniverseAgentSetModelPreferencesResult,
	UniverseAgentSetSessionGoalRequest,
	UniverseAgentSetSessionGoalResult,
	UniverseAgentCancelSessionGoalRequest,
	UniverseAgentCancelSessionGoalResult,
	UniverseAgentRespondPermissionRequest,
	UniverseAgentRespondPermissionResult,
	UniverseAgentSyncPermissionRuleRequest,
	UniverseAgentSyncPermissionRuleResult,
	UniverseAgentPromotePermissionRuleRequest,
	UniverseAgentPromotePermissionRuleResult,
	UniverseAgentGetSessionRulesRequest,
	UniverseAgentGetSessionRulesResult,
	UniverseAgentSetPermissionModeRequest,
	UniverseAgentSetPermissionModeResult,
	UniverseAgentTaskUpdateRequest,
	UniverseAgentTaskUpdateResult,
	UniverseAgentTaskCancelRequest,
	UniverseAgentTaskCancelResult,
	UniverseAgentMessageMemberRequest,
	UniverseAgentMessageMemberResult,
	UniverseAgentCreateTeamRequest,
	UniverseAgentCreateTeamResult,
	UniverseAgentStartMemberRequest,
	UniverseAgentStartMemberResult,
	UniverseAgentKillMemberRequest,
	UniverseAgentKillMemberResult,
	UniverseAgentAbortTeamRequest,
	UniverseAgentAbortTeamResult,
	UniverseAgentRespondQuestionRequest,
	UniverseAgentRespondQuestionResult,
	UniverseAgentEnqueueQueueItemRequest,
	UniverseAgentInsertQueueItemRequest,
	UniverseAgentReorderQueueRequest,
	UniverseAgentDeleteQueueItemRequest,
	UniverseAgentRetryQueueItemRequest,
	UniverseAgentRetryAllFailedRequest,
	UniverseAgentRetryQueueItemUploadRequest,
	UniverseAgentPinQueueItemRequest,
	UniverseAgentSetQueueItemLockedRequest,
	UniverseAgentInjectQueueItemRequest,
	UniverseAgentSetQueueItemForkAnchorRequest,
	UniverseAgentEditQueueItemRequest,
	UniverseAgentHoldQueueItemRequest,
	UniverseAgentQueueItemRefRequest,
	UniverseAgentQueueMutationResult,
	UniverseAgentQueueRefRequest,
	UniverseAgentForkAgentRequest,
	UniverseAgentForkAgentResult,
	UniverseAgentKillAgentRequest,
	UniverseAgentKillAgentResult,
	UniverseAgentDeleteMessageRequest,
	UniverseAgentDeleteMessageResult,
	UniverseAgentEditMessageRequest,
	UniverseAgentEditMessageResult,
	UniverseAgentSendClientToolResponseRequest,
	UniverseAgentSendClientToolResponseResult,
	UniverseAgentListSnapshotsRequest,
	UniverseAgentListSnapshotsResult,
	UniverseAgentListLoopSnapshotsRequest,
	UniverseAgentListLoopSnapshotsResult,
	UniverseAgentCreateSnapshotRequest,
	UniverseAgentCreateSnapshotResult,
	UniverseAgentRestoreSnapshotRequest,
	UniverseAgentRestoreSnapshotResult,
	UniverseAgentDeleteSnapshotRequest,
	UniverseAgentDeleteSnapshotResult,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentListSkillsResult,
	UniverseAgentListAgentProfilesRequest,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSaveAgentProfileResult,
	UniverseAgentDeleteAgentProfileRequest,
	UniverseAgentDeleteAgentProfileResult,
	UniverseAgentResetAgentProfileRequest,
	UniverseAgentResetAgentProfileResult,
	UniverseAgentListMcpServersRequest,
	UniverseAgentListMcpServersResult,
	UniverseAgentGetMcpServerStatusesResult,
	UniverseAgentGetMcpServerToolsResult,
	UniverseAgentListPluginsResult,
	UniverseAgentPluginInfoResult,
	UniverseAgentEnablePluginResult,
	UniverseAgentReloadPluginResult,
	UniverseAgentUnloadPluginResult,
	UniverseAgentScanNewPluginsResult,
	UniverseAgentAddMcpServerRequest,
	UniverseAgentAddMcpServerResult,
	UniverseAgentUpdateMcpServerRequest,
	UniverseAgentUpdateMcpServerResult,
	UniverseAgentRemoveMcpServerRequest,
	UniverseAgentRemoveMcpServerResult,
	UniverseAgentListToolsResult,
	UniverseAgentToolInfoRequest,
	UniverseAgentToolInfoResult,
	UniverseAgentListCommandsResult,
	UniverseAgentGetCommandDefRequest,
	UniverseAgentGetCommandDefResult,
	UniverseAgentListFilesRequest,
	UniverseAgentListFilesResult,
	UniverseAgentReadFileRequest,
	UniverseAgentReadFileResult,
	UniverseAgentGetFileInfoRequest,
	UniverseAgentGetFileInfoResult,
	UniverseAgentWriteFileRequest,
	UniverseAgentWriteFileResult,
	UniverseAgentForceWriteFileRequest,
	UniverseAgentAgentMergeRequest,
	UniverseAgentAgentMergeResult,
	UniverseAgentReadGitSummaryRequest,
	UniverseAgentReadGitSummaryResult,
	UniverseAgentReadGitChangesRequest,
	UniverseAgentReadGitChangesResult,
	UniverseAgentReadGitFileDiffRequest,
	UniverseAgentReadGitFileDiffResult,
	UniverseAgentWriteGitStagePathsRequest,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitApplyHunksRequest,
	UniverseAgentWriteGitWriteResult,
	UniverseAgentGetSessionUsageRequest,
	UniverseAgentGetSessionUsageResult,
	UniverseAgentGetGlobalUsageResult,
	UniverseAgentSaveMemoryRequest,
	UniverseAgentSaveMemoryResult,
	UniverseAgentMemorySearchRequest,
	UniverseAgentMemorySearchResult,
	UniverseAgentMemorySearchDeepRequest,
	UniverseAgentMemorySearchDeepResult,
	UniverseAgentReadMemoryRequest,
	UniverseAgentReadMemoryResult,
	UniverseAgentMemoryListRequest,
	UniverseAgentMemoryListResult,
	UniverseAgentDeleteMemoryRequest,
	UniverseAgentDeleteMemoryResult,
	UniverseAgentReflectMemoryRequest,
	UniverseAgentReflectMemoryResult,
	UniverseAgentMemoryRebuildRequest,
	UniverseAgentMemoryRebuildEvent,
	UniverseAgentMemoryRebuildStream,
	UniverseAgentRevertMemoryRequest,
	UniverseAgentRevertMemoryResult,
	UniverseAgentMemoryHistoryRequest,
	UniverseAgentMemoryHistoryResult,
	UniverseAgentContextVariableListRequest,
	UniverseAgentContextVariableListResult,
	UniverseAgentContextVariableReadRequest,
	UniverseAgentContextVariableReadResult,
	UniverseAgentListNodesRequest,
	UniverseAgentListNodesResult,
	UniverseAgentGetNodeRequest,
	UniverseAgentRemoteAgentInfo,
	UniverseAgentCheckConnectionRequest,
	UniverseAgentConnectionReport,
	UniverseAgentSetMaintenanceRequest,
	UniverseAgentSetMaintenanceResult,
	UniverseAgentExitMaintenanceRequest,
	UniverseAgentExitMaintenanceResult,
	UniverseAgentListConfigsResult,
	UniverseAgentGetRemoteAgentConfigRequest,
	UniverseAgentSaveRemoteAgentConfigRequest,
	UniverseAgentSaveRemoteAgentConfigResult,
	UniverseAgentRemoteAgentConfig,
	UniverseAgentResetErrorRequest,
	UniverseAgentResetErrorResult,
	UniverseAgentDeleteRemoteAgentConfigRequest,
	UniverseAgentDeleteRemoteAgentConfigResult,
	UniverseAgentReloadRemoteAgentsResult,
	UniverseAgentCreateRemoteSessionRequest,
	UniverseAgentCreateRemoteSessionResult,
	UniverseAgentDestroyRemoteSessionRequest,
	UniverseAgentDestroyRemoteSessionResult,
	UniverseAgentGetRemoteSessionStatusRequest,
	UniverseAgentGetRemoteSessionStatusResult,
	UniverseAgentGetRemoteSessionHistoryRequest,
	UniverseAgentGetRemoteSessionHistoryResult,
	UniverseAgentResumeRemoteSessionRequest,
	UniverseAgentResumeRemoteSessionResult,
	UniverseAgentCancelRemoteSessionRequest,
	UniverseAgentCancelRemoteSessionResult,
	UniverseAgentRemoteChatRequest,
	UniverseAgentRemoteChatResponse,
	UniverseAgentRemoteChatStream,
	UniverseAgentGetUploadProgressRequest,
	UniverseAgentGetUploadProgressResult,
	UniverseAgentUploadAttachmentResult,
	UniverseAgentUploadAttachmentStream,
	UniverseAgentDownloadAttachmentRequest,
	UniverseAgentDownloadChunk,
	UniverseAgentDownloadAttachmentStream,
	UniverseAgentPtyServerMessage,
	UniverseAgentPtyStream,
	UniverseAgentHealthCheckResult,
	UniverseAgentDoctorResult,
	UniverseAgentShutdownRequest,
	UniverseAgentShutdownResult,
	UniverseAgentListDevicesResult,
	UniverseAgentPairApproveRequest,
	UniverseAgentPairApproveResult,
	UniverseAgentPairRejectRequest,
	UniverseAgentPairRejectResult,
	UniverseAgentRevokeRequest,
	UniverseAgentRevokeResult,
	UniverseAgentRotateTokenRequest,
	UniverseAgentRotateTokenResult,
	UniverseAgentListPendingResult,
	UniverseAgentListTriggersRequest,
	UniverseAgentListTriggersResult,
	UniverseAgentUpsertTriggerRequest,
	UniverseAgentUpsertTriggerResult,
	UniverseAgentDeleteTriggerRequest,
	UniverseAgentDeleteTriggerResult,
	UniverseAgentSetTriggerEnabledRequest,
	UniverseAgentSetTriggerEnabledResult,
	UniverseAgentFireTriggerRequest,
	UniverseAgentFireTriggerResult,
	UniverseAgentWriteClipboardRequest,
	UniverseAgentWriteClipboardResult,
	UniverseAgentReadClipboardRequest,
	UniverseAgentReadClipboardResult,
	UniverseAgentListClipboardRequest,
	UniverseAgentListClipboardResult,
	UniverseAgentClearClipboardRequest,
	UniverseAgentClearClipboardResult,
	UniverseAgentSetPermissionPolicyRequest,
	UniverseAgentSetPermissionPolicyResult,
	UniverseAgentListModelsResult,
	UniverseAgentListProviderStatusResult,
	UniverseAgentListProjectRulesRequest,
	UniverseAgentListProjectRulesResult,
	UniverseAgentListHookPointsResult,
	UniverseAgentListTeamsResult,
	UniverseAgentGetConfigRequest,
	UniverseAgentGetConfigResult,
	UniverseAgentSwitchModelRequest,
	UniverseAgentSwitchModelResult,
	UniverseAgentGetModelPreferencesRequest,
	UniverseAgentGetModelPreferencesResult,
	UniverseAgentResolveModelRequest,
	UniverseAgentResolveModelResult,
	UniverseAgentWatchConfigRequest,
	UniverseAgentConfigChangedEvent,
	UniverseAgentWatchConfigStream,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentTransportState,
	UniverseAgentAgentTreeNode,
	UniverseAgentFetchToolDetailRequest,
	UniverseAgentFetchToolDetailResult,
	IFileMutationRecord,
	ITurnSettleSignal,
} from '../common/universeAgentTypes.js';
import { createEmptyCapabilitySnapshot } from '../common/universeAgentCapabilities.js';
import { probeEngineCapabilities, probeSessionListCapability } from './grpcCapabilityProbe.js';
import { createGrpcUniverseAgentClient, createLoopbackTlsGrpcClient, createPinnedGrpcUniverseAgentClient, type GrpcUniverseAgentClient } from './grpc/grpcClient.js';
import { findLocalEnginePort, probeLocalEnginePort } from './localEngineDiscovery.js';
import { loadGrpcModule, type UniverseAgentPinnedTlsTarget } from './universeAgentChannel.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, isTransportFailureCode, UniverseAgentFetchToolDetailMethodKey, UniverseAgentGrpcServices, UniverseAgentSaveSkillContentMethodKey, UniverseAgentTransportError } from './grpc/grpcTransport.js';
import { createSessionRecoveringAlreadyExists, runCreateSessionSingleFlight } from './sessionCreateRecover.js';
import type { ConnectionResolver, ResolvedEndpoint } from './connectionResolver.js';
import { classifyDeviceAuthRpcFailure, isNonRetryableDeviceAuthRpcFailure, runDeviceAuthHandshake } from './deviceAuthHandshake.js';
import type { IClientIdentityStore } from './clientIdentityTypes.js';
import type { ConnectionProfile, IConnectionProfileStore } from './connectionProfileStore.js';
import type { IEngineTrustStore } from './engineTrustStore.js';
import { hubBaseUrlIdentityKey } from './hubSessionStore.js';
import { createPairingOrchestrator, isPairingOrchestratorProfile, PairingOrchestrator, type PairingDialEndpoint } from './pairingOrchestrator.js';
import type { IUniverseAgentHubService } from '../common/hub.js';
import { UniverseAgentHubService, type UniverseAgentHubServiceOptions } from './universeAgentHubService.js';

type UniverseAgentReconnectTimeoutHandle = ReturnType<typeof setTimeout>;
type UniverseAgentSetTimeoutFn = (callback: () => void, delay?: number) => UniverseAgentReconnectTimeoutHandle;
type UniverseAgentClearTimeoutFn = (handle: UniverseAgentReconnectTimeoutHandle) => void;

export const SESSION_TOKEN_REJECT_GRACE_MS = 60_000;
export const SESSION_TOKEN_REJECTED_REASON = 'session token rejected by engine';
export const TRANSPORT_UNAVAILABLE_REASON = 'transport unavailable';
const DIAL_SUPERSEDED_REASON = 'dial superseded';
const MISSING_SESSION_TOKEN_REASON = 'connect response missing session token';

type LinkCondemned = 'rejected' | 'unavailable';
type LinkSettlement = 'grace' | 'reconnect';

/** Per-attempt state. Not a service field: D944 publishes `this._transport` later. */
interface AuthenticatedLinkAttempt {
	readonly transport: IUniverseAgentGrpcTransport;
	readonly installedAtMs: number;
	condemned: LinkCondemned | undefined;
	committed: boolean;
	settled: LinkSettlement | undefined;
}

interface PairingMainDialogOptions {
	readonly type?: 'none' | 'info' | 'error' | 'question' | 'warning';
	readonly message: string;
	readonly detail?: string;
	readonly buttons?: string[];
	readonly cancelId?: number;
	readonly defaultId?: number;
}

/** Structural view of IDialogMainService.showMessageBox. Response 0 is the first button. */
interface PairingMainDialog {
	showMessageBox(options: PairingMainDialogOptions): Promise<{ readonly response: number }>;
}

export interface UniverseAgentConnectionServiceOptions extends UniverseAgentHubServiceOptions {
	readonly loopbackAddress?: string;
	readonly createTransport?: (address: string) => IUniverseAgentGrpcTransport;
	readonly createPinnedTransport?: (target: UniverseAgentPinnedTlsTarget) => IUniverseAgentGrpcTransport;
	readonly connectionResolver?: ConnectionResolver;
	readonly connectionProfileStore?: IConnectionProfileStore;
	readonly clientIdentityStore?: IClientIdentityStore;
	readonly engineTrustStore?: IEngineTrustStore;
	/**
	 * Native main-process dialog. Production passes IDialogMainService.
	 * Any response other than the first button is user refusal (`false`).
	 * A missing dialog or a rejected dialog is not refusal: the promise rejects
	 * so callers can tell the box never appeared (`dialogError` on the pane).
	 */
	readonly dialogMainService?: PairingMainDialog;
	readonly pairingOrchestrator?: PairingOrchestrator;
	/** Connection-level reconnect backoff base. Default 1000. Aligns with S2 stream reopen. */
	readonly reconnectBaseMs?: number;
	/** Connection-level reconnect backoff cap. Default 30_000. */
	readonly reconnectMaxMs?: number;
	/** ± ratio applied to reconnect delay. `0` disables jitter. Default 0.2. */
	readonly reconnectJitterRatio?: number;
	readonly setTimeoutFn?: UniverseAgentSetTimeoutFn;
	readonly clearTimeoutFn?: UniverseAgentClearTimeoutFn;
	/**
	 * Probe loopback engine ports and connect without Device Grant.
	 * Electron-main turns this on. Tests leave it off.
	 */
	readonly autoConnectLocalEngine?: boolean;
	readonly findLocalEnginePort?: () => Promise<number | undefined>;
	readonly openLocalEngineTransport?: (address: string) => GrpcUniverseAgentClient;
}

function isPairingPending(sessionToken: string | undefined, pairingNonce: string | undefined): boolean {
	return !sessionToken && !!pairingNonce;
}

function sameConnectionPhase(left: ConnectionPhase, right: ConnectionPhase): boolean {
	if (left.kind !== right.kind) {
		return false;
	}
	if (left.kind === 'connecting' && right.kind === 'connecting') {
		return left.reason === right.reason;
	}
	if (left.kind === 'connected' && right.kind === 'connected') {
		return left.path === right.path;
	}
	if (left.kind === 'failed' && right.kind === 'failed') {
		return left.code === right.code && left.reason === right.reason;
	}
	return true;
}

function formatResolvedDialAddress(resolvedIp: string, port: number): string {
	let host = resolvedIp.trim();
	if (host.startsWith('[') && host.endsWith(']') && host.length >= 2) {
		host = host.slice(1, -1);
	}
	return host.includes(':') ? `[${host}]:${port}` : `${host}:${port}`;
}

function pairingIdentityPrefix(engineIdentityId: string): string {
	return engineIdentityId.slice(0, 8);
}

function readablePairingSasCode(sasCode: string): string | undefined {
	const trimmed = sasCode.trim();
	if (!trimmed || trimmed === 'XXXX-XXXX') {
		return undefined;
	}
	return trimmed;
}

async function askPairingMainDialog(dialog: PairingMainDialog | undefined, options: PairingMainDialogOptions): Promise<boolean> {
	if (!dialog) {
		throw new Error(localize(
			'ua.mainPairingDialogUnavailable',
			"Pairing confirmation dialog is not available.",
		));
	}
	const result = await dialog.showMessageBox(options);
	// Response 0 is the confirm button. cancelId and every other index are user refusal.
	return result.response === 0;
}

function confirmPairingSasWithMainDialog(
	dialog: PairingMainDialog | undefined,
	input: { readonly sasCode: string; readonly engineIdentityId: string; readonly displayName: string },
): Promise<boolean> {
	const sasCode = readablePairingSasCode(input.sasCode);
	const idPrefix = pairingIdentityPrefix(input.engineIdentityId);
	const detail = sasCode
		? localize(
			'ua.mainPairingSasBody',
			"Verify the short code on Engine \"{0}\" matches {1}. Engine identity prefix: {2}.",
			input.displayName,
			sasCode,
			idPrefix,
		)
		: localize(
			'ua.mainPairingSasBodyMissing',
			"Engine \"{0}\" did not provide a pairing code to verify. Engine identity prefix: {1}.",
			input.displayName,
			idPrefix,
		);
	return askPairingMainDialog(dialog, {
		type: 'warning',
		message: localize('ua.mainPairingSasTitle', "Confirm Engine pairing code"),
		detail,
		buttons: [
			localize({ key: 'ua.mainPairingSasConfirm', comment: ['&& denotes a mnemonic'] }, "&&Verified on Engine"),
			localize({ key: 'ua.mainPairingSasCancel', comment: ['&& denotes a mnemonic'] }, "&&Cancel"),
		],
		defaultId: 0,
		cancelId: 1,
	});
}

function confirmPairingRecoverTrustWithMainDialog(
	dialog: PairingMainDialog | undefined,
	input: { readonly engineIdentityId: string; readonly leafSha256Hex: string; readonly displayName: string },
): Promise<boolean> {
	return askPairingMainDialog(dialog, {
		type: 'warning',
		message: localize('ua.mainPairingRecoverTitle', "Recover trust for {0}?", input.displayName),
		detail: localize(
			'ua.mainPairingRecoverBody',
			"Engine identity: {0}\nCertificate fingerprint (SHA-256): {1}\n\nThis does not create a new Engine Grant and does not use a pairing code (SAS).\nConfirm only if you recognize Engine \"{2}\".",
			input.engineIdentityId,
			input.leafSha256Hex,
			input.displayName,
		),
		buttons: [
			localize({ key: 'ua.mainPairingRecoverConfirm', comment: ['&& denotes a mnemonic'] }, "&&Recover trust"),
			localize({ key: 'ua.mainPairingRecoverCancel', comment: ['&& denotes a mnemonic'] }, "&&Cancel"),
		],
		defaultId: 0,
		cancelId: 1,
	});
}

export class UniverseAgentConnectionService extends Disposable implements IUniverseAgentConnection, IUniverseAgentHostConnection, IUniverseAgentHubService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidFileMutation = this._register(new Emitter<IFileMutationRecord>());
	readonly onDidFileMutation = this._onDidFileMutation.event;

	private readonly _onDidTurnSettle = this._register(new Emitter<ITurnSettleSignal>());
	readonly onDidTurnSettle = this._onDidTurnSettle.event;

	private readonly _onDidChangeTeamRuntime = this._register(new Emitter<{ readonly sessionId: string }>());
	readonly onDidChangeTeamRuntime = this._onDidChangeTeamRuntime.event;

	private readonly _onRequestAgentTreeRefresh = this._register(new Emitter<{ readonly sessionId: string }>());
	readonly onRequestAgentTreeRefresh = this._onRequestAgentTreeRefresh.event;

	readonly team: IUniverseAgentTeamApi;

	private readonly _hub: UniverseAgentHubService;

	private readonly _onDidChangeConnection = this._register(new Emitter<UniverseAgentConnectionSnapshot>());
	readonly onDidChangeConnection = this._onDidChangeConnection.event;

	private _transport: IUniverseAgentGrpcTransport | undefined;
	private _transportState: UniverseAgentTransportState = 'idle';
	/** Subscription for the in-flight authenticated attempt. Attempt flags live in the closure. */
	private _linkEvents: IDisposable | undefined;
	private readonly _nowMs: () => number;
	private _sessionToken: string | undefined;
	private _workDir: string | undefined;
	private _sharedFsRootSent = false;
	private _pairingPending = false;
	private _agentTreeProbeUnsupported = false;
	private _agentTreeFetchFailed = false;
	private _fetchToolDetailUnsupported = false;
	private _advertisedMethods: readonly string[] = [];
	private _capabilities: UniverseAgentCapabilitySnapshot = createEmptyCapabilitySnapshot();
	private _sessionListCapability: UniverseAgentCapabilitySupport = 'UNKNOWN';
	private _connectionPhase: ConnectionPhase = { kind: 'disconnected' };
	private _lastConnectedPath: ConnectionPath | undefined;
	private _activeProfileId: string | undefined;
	/** User Disconnect / dispose / cancelPairing / user connectProfile. Reconnect does not bump. */
	private _connectEpoch = 0;
	/** Epoch of the last connected commit. Same-epoch reconnect must not tear that winner down. */
	private _connectedEpoch = 0;
	private _userDialInFlight = false;
	private _userDialSerial = 0;
	/** Profile awaiting SAS / recover confirm. Not the connected profile id. */
	private _pairingContextProfileId: string | undefined;
	private _reconnectAttempt = 0;
	private _reconnectTimer: UniverseAgentReconnectTimeoutHandle | undefined;
	private _userDisconnecting = false;
	private _reconnectDisposed = false;
	private _profileReconnectDial = false;
	private _loopbackSkipAuth = false;
	private _suppressLocalEngineDiscovery = false;
	private _localEngineDiscoveryAttempt = 0;
	private _localEngineDiscoveryTimer: UniverseAgentReconnectTimeoutHandle | undefined;
	private readonly _autoConnectLocalEngine: boolean;
	private readonly _findLocalEnginePort: () => Promise<number | undefined>;
	private readonly _openLocalEngineTransport: (address: string) => GrpcUniverseAgentClient;

	private readonly _createSessionInflight = new Map<string, Promise<UniverseAgentCreateSessionResult>>();
	private readonly _loopbackAddress: string;
	private readonly _createTransport: (address: string) => IUniverseAgentGrpcTransport;
	private readonly _createPinnedTransport: (target: UniverseAgentPinnedTlsTarget) => IUniverseAgentGrpcTransport;
	private readonly _connectionResolver: ConnectionResolver | undefined;
	private readonly _connectionProfileStore: IConnectionProfileStore | undefined;
	private readonly _clientIdentityStore: IClientIdentityStore | undefined;
	private readonly _pairingOrchestrator: PairingOrchestrator | undefined;
	private readonly _reconnectBaseMs: number;
	private readonly _reconnectMaxMs: number;
	private readonly _reconnectJitterRatio: number;
	private readonly _setTimeoutFn: UniverseAgentSetTimeoutFn;
	private readonly _clearTimeoutFn: UniverseAgentClearTimeoutFn;

	constructor(options: UniverseAgentConnectionServiceOptions = {}) {
		super();
		this._hub = this._register(new UniverseAgentHubService(options));
		this._loopbackAddress = options.loopbackAddress ?? '127.0.0.1:50051';
		this._createTransport = options.createTransport ?? createGrpcUniverseAgentClient;
		this._createPinnedTransport = options.createPinnedTransport ?? createPinnedGrpcUniverseAgentClient;
		this._connectionResolver = options.connectionResolver;
		this._connectionProfileStore = options.connectionProfileStore;
		this._clientIdentityStore = options.clientIdentityStore;
		if (options.pairingOrchestrator) {
			this._pairingOrchestrator = options.pairingOrchestrator;
		} else if (this._clientIdentityStore && this._connectionProfileStore && options.engineTrustStore) {
			this._pairingOrchestrator = createPairingOrchestrator({
				clientIdentityStore: this._clientIdentityStore,
				engineTrustStore: options.engineTrustStore,
				connectionProfileStore: this._connectionProfileStore,
				createPinnedTransport: ({ endpoint, tls }) => createPinnedGrpcUniverseAgentClient({
					address: formatResolvedDialAddress(endpoint.host, endpoint.port),
					tls,
					sslTargetNameOverride: endpoint.servername,
				}),
				renewDialEndpoint: profile => this._renewPairingDialEndpoint(profile),
				// Button refusal is false. A missing or failed dialog rejects; do not auto-approve.
				confirmSas: input => confirmPairingSasWithMainDialog(options.dialogMainService, input),
				confirmRecoverTrust: input => confirmPairingRecoverTrustWithMainDialog(options.dialogMainService, input),
			});
		}
		this._reconnectBaseMs = options.reconnectBaseMs ?? 1000;
		this._reconnectMaxMs = options.reconnectMaxMs ?? 30_000;
		this._reconnectJitterRatio = options.reconnectJitterRatio ?? 0.2;
		this._setTimeoutFn = options.setTimeoutFn ?? ((callback: () => void, delay?: number) => setTimeout(callback, delay));
		this._clearTimeoutFn = options.clearTimeoutFn ?? ((handle: UniverseAgentReconnectTimeoutHandle) => clearTimeout(handle));
		this._nowMs = options.nowMs ?? Date.now;
		this._autoConnectLocalEngine = options.autoConnectLocalEngine === true;
		this._findLocalEnginePort = options.findLocalEnginePort ?? (() => findLocalEnginePort(probeLocalEnginePort));
		this._openLocalEngineTransport = options.openLocalEngineTransport ?? createLoopbackTlsGrpcClient;
		if (this._autoConnectLocalEngine) {
			const ready = options.storageReady ?? Promise.resolve();
			void ready.then(() => {
				if (this._reconnectDisposed || this._suppressLocalEngineDiscovery) {
					return;
				}
				this._scheduleLocalEngineDiscovery(0);
			}, () => { /* storage failure leaves the IDE disconnected */ });
		}
		this.team = {
			memberStatus: (sessionId, agentId) => this._withTransport(t => t.memberStatus(sessionId, agentId)),
			taskList: (sessionId, agentId) => this._withTransport(t => t.taskList(sessionId, agentId)),
			teamInfo: (sessionId, agentId, teamId) => this._withTransport(t => t.teamInfo(sessionId, agentId, teamId)),
		};
	}

	isEngineConnected(): boolean {
		if (this._pairingPending || !this._transport?.isChannelAlive) {
			return false;
		}
		if (this._sessionToken) {
			return true;
		}
		return this._loopbackSkipAuth && this._connectionPhase.kind === 'connected';
	}

	getConnectionPhase(): ConnectionPhase {
		return this._connectionPhase;
	}

	getTransportState(): UniverseAgentTransportState {
		return this._transportState;
	}

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot {
		return this._buildSnapshot();
	}

	getCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
		return this._capabilities;
	}

	getNavigatorCapability(key: UniverseAgentNavigatorCapabilityKey): UniverseAgentCapabilitySupport {
		if (key === 'sessionList') {
			return this._sessionListCapability;
		}
		return this._capabilities[key]?.support ?? 'UNKNOWN';
	}

	requestAgentTreeRefresh(sessionId: string): void {
		if (sessionId) {
			this._onRequestAgentTreeRefresh.fire({ sessionId });
		}
	}

	async fetchAgentTree(sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined> {
		if (this._agentTreeProbeUnsupported) {
			return undefined;
		}
		try {
			const root = await this._withTransport(transport => transport.fetchAgentTree(sessionId));
			this._setAgentTreeFetchFailed(false);
			return root;
		} catch (error) {
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this._agentTreeProbeUnsupported = true;
				this._setAgentTreeFetchFailed(false);
				this._capabilities = {
					...this._capabilities,
					agentTree: { support: 'UNSUPPORTED', reason: 'UNIMPLEMENTED' },
				};
				this._fireSnapshotChanged();
			} else {
				this._setAgentTreeFetchFailed(true);
			}
			throw error;
		}
	}

	isAgentTreeUnsupported(): boolean {
		return this._agentTreeProbeUnsupported || this._capabilities.agentTree.support === 'UNSUPPORTED';
	}

	isAgentTreeFetchFailed(): boolean {
		return this._agentTreeFetchFailed;
	}

	async fetchToolDetail(request: UniverseAgentFetchToolDetailRequest): Promise<UniverseAgentFetchToolDetailResult> {
		if (!this.isEngineConnected() || !this._transport) {
			return { ok: false, reason: 'failed', message: 'Engine not connected' };
		}
		if (this._fetchToolDetailUnsupported || !this._advertisedMethods.includes(UniverseAgentFetchToolDetailMethodKey)) {
			return { ok: false, reason: 'unavailable' };
		}
		try {
			const wire = await this._transport.fetchToolDetail(request);
			if (!wire.success) {
				return { ok: false, reason: 'failed', message: wire.errorMessage };
			}
			return {
				ok: true,
				content: wire.content,
				truncated: wire.truncated,
				...(wire.totalBytes !== undefined ? { totalBytes: wire.totalBytes } : {}),
			};
		} catch (error) {
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this._fetchToolDetailUnsupported = true;
				return { ok: false, reason: 'unavailable' };
			}
			return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : undefined };
		}
	}

	notifyFileMutation(record: IFileMutationRecord): void {
		this._onDidFileMutation.fire(record);
	}

	notifyTurnSettle(signal: ITurnSettleSignal): void {
		this._onDidTurnSettle.fire(signal);
	}

	notifyTeamRuntimeChange(sessionId: string): void {
		this._onDidChangeTeamRuntime.fire({ sessionId });
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		const epoch = this._connectEpoch;
		this._sharedFsRootSent = !!request.workDir;
		this._publishConnectionPhase({
			kind: 'connecting',
			reason: this._keepTransportLostOnConnect() ? 'transport_lost' : 'initial',
		});
		let transport: IUniverseAgentGrpcTransport;
		try {
			transport = await this._openLoopbackTransport();
		} catch (error) {
			// D420: loadGrpcModule / createTransport throw before the connect try.
			// `_scheduleReconnect` no-ops without an active profile, while pairingPending,
			// during a user dial, or after user disconnect.
			this._scheduleReconnect();
			throw error;
		}
		try {
			const result = await transport.connect(request);
			if (!result.sessionToken || this._lostCapturedDial(epoch, transport)) {
				this._abandonCaptured(transport);
				return result;
			}
			const capabilities = await probeEngineCapabilities({ methods: result.methods, transport });
			if (this._lostCapturedDial(epoch, transport)) {
				this._abandonCaptured(transport);
				return result;
			}
			const sessionList = (await probeSessionListCapability({ methods: result.methods, transport })).support;
			if (this._lostCapturedDial(epoch, transport)) {
				this._abandonCaptured(transport);
				return result;
			}
			const saveSkill = await this._probeSaveSkill(transport, result.methods);
			if (this._lostCapturedDial(epoch, transport)) {
				this._abandonCaptured(transport);
				return result;
			}
			this._applyConnectedCommit({
				epoch,
				transport,
				profileId: undefined,
				token: result.sessionToken,
				workDir: result.workDir,
				methods: result.methods,
				capabilities,
				sessionList,
				saveSkill,
				path: 'loopback',
			});
			return result;
		} catch (error) {
			if (!this._lostCapturedDial(epoch, transport)) {
				this._markTransportFailed(error);
				if (!(error instanceof UniverseAgentTransportError)) {
					this._maybeScheduleReconnectAfterTransportFailedReturn(
						'transport_failed',
						this._keepTransportLostOnConnect(),
					);
				}
			}
			this._abandonCaptured(transport);
			throw error;
		}
	}

	async connectProfile(profileId: string, options: { readonly reconnect?: boolean } = {}): Promise<UniverseAgentConnectProfileResult> {
		const scheduleHint = options.reconnect === true || this._transportState === 'failed';
		const userDial = options.reconnect !== true;
		let epoch = this._connectEpoch;
		let serial = 0;
		if (userDial) {
			this._bumpConnectEpoch();
			epoch = this._connectEpoch;
			serial = this._beginUserDial();
		}
		const finishUserDial = () => {
			if (userDial) {
				this._endUserDial(serial);
			}
		};
		try {
			const result = await this._connectProfileRaw(profileId, options, epoch);
			finishUserDial();
			// Grace rejection already cancelled the timer. Scheduling from `transportState === 'failed'` would rearm it.
			if (!result.ok && result.reason !== SESSION_TOKEN_REJECTED_REASON && this._connectEpoch === epoch && !this._liveConnectedPublished()) {
				this._maybeScheduleReconnectAfterTransportFailedReturn(result.code, scheduleHint);
			}
			return finalizeConnectProfileResult(result);
		} catch (error) {
			finishUserDial();
			if (this._connectEpoch === epoch && !this._liveConnectedPublished()) {
				this._maybeScheduleReconnectAfterTransportFailedReturn('transport_failed', scheduleHint);
			}
			throw error;
		}
	}

	private async _connectProfileRaw(
		profileId: string,
		options: { readonly reconnect?: boolean },
		epoch: number,
	): Promise<UniverseAgentConnectProfileResult> {
		const entryTransport = this._transport;
		const reconnect = options.reconnect === true || this._transportState === 'failed';
		this._cancelReconnectTimer();
		if (!this._connectionResolver) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'connection resolver is not configured',
			};
		}

		let resolved: Awaited<ReturnType<ConnectionResolver['resolve']>>;
		try {
			resolved = await this._connectionResolver.resolve(profileId, { forceNewTicket: reconnect });
		} catch (error) {
			if (!this._epochCurrent(epoch) || this._liveConnectedPublished()) {
				return this._staleDial();
			}
			throw error;
		}
		if (!resolved.ok) {
			const profile = this._connectionProfileStore?.get(profileId);
			if (resolved.code === 'pairing_required' && profile && isPairingOrchestratorProfile(profile)) {
				return this._startProfilePairing(profileId, profile, reconnect, epoch);
			}
			if (!this._canMutateDial(epoch) || this._liveConnectedPublished()) {
				return { ok: false, code: resolved.code, reason: resolved.reason };
			}
			return this._writeDialFailure(epoch, resolved.code, resolved.reason, reconnect);
		}
		if (!this._canMutateDial(epoch)) {
			return this._staleDial();
		}
		if (!this._clientIdentityStore) {
			if (this._liveConnectedPublished()) {
				return {
					ok: false,
					code: 'trust_missing',
					reason: 'client identity store is not configured',
				};
			}
			return this._writeDialFailure(epoch, 'trust_missing', 'client identity store is not configured', reconnect);
		}

		try {
			await loadGrpcModule();
		} catch (error) {
			if (!this._epochCurrent(epoch) || this._liveConnectedPublished()) {
				return this._staleDial();
			}
			throw error;
		}
		if (!this._canMutateDial(epoch)) {
			return this._staleDial();
		}
		this._takeOverEntry(entryTransport, profileId);

		const endpoint = resolved.endpoint;
		const dialAddress = formatResolvedDialAddress(endpoint.resolvedIp, endpoint.port);
		let captured: IUniverseAgentGrpcTransport;
		try {
			if (endpoint.tls) {
				this._connectionResolver.consumeRelayTicket(profileId);
				captured = this._createPinnedTransport({
					address: dialAddress,
					tls: endpoint.tls,
					sslTargetNameOverride: endpoint.servername,
					relay: endpoint.relayTicketId !== null,
				});
			} else {
				captured = this._createTransport(dialAddress);
			}
		} catch (error) {
			if (!this._epochCurrent(epoch) || this._liveConnectedPublished()) {
				return this._staleDial();
			}
			throw error;
		}

		try {
			const identityState = await this._clientIdentityStore.getOrCreateIdentity();
			if (identityState.kind !== 'ready') {
				this._abandonCaptured(captured);
				const reason = `client identity unavailable: ${identityState.kind}`;
				return this._writeDialFailure(epoch, 'trust_missing', reason, reconnect);
			}
			if (!endpoint.tls) {
				return await this._dialPlain(epoch, profileId, captured, endpoint, identityState.identity.clientIdentityId, reconnect);
			}
			return await this._dialDeviceAuth(epoch, profileId, captured, endpoint, identityState.identity, reconnect);
		} catch (error) {
			if (this._transport !== captured) {
				this._abandonCaptured(captured);
			}
			if (!this._epochCurrent(epoch) || this._liveConnectedPublished()) {
				return this._staleDial();
			}
			throw error;
		}
	}

	private async _dialPlain(
		epoch: number,
		profileId: string,
		captured: IUniverseAgentGrpcTransport,
		endpoint: ResolvedEndpoint,
		clientIdentityId: string,
		reconnect: boolean,
	): Promise<UniverseAgentConnectProfileResult> {
		this._markDialConnecting(reconnect);
		let result: UniverseAgentConnectResult;
		try {
			result = await captured.connect({
				clientId: clientIdentityId,
				protocolVersion: '1',
			});
		} catch (error) {
			if (this._lostCapturedDial(epoch, captured)) {
				this._abandonCaptured(captured);
				return this._staleDial();
			}
			this._abandonCaptured(captured);
			this._markTransportFailed(error);
			if (!(error instanceof UniverseAgentTransportError)) {
				throw error;
			}
			const reason = error instanceof Error ? error.message : String(error);
			return { ok: false, code: 'transport_failed', reason };
		}
		if (this._lostCapturedDial(epoch, captured)) {
			this._abandonCaptured(captured);
			return this._staleDial();
		}
		if (!result.sessionToken) {
			this._abandonCaptured(captured);
			this._pairingPending = false;
			this._connectionPhase = { kind: 'failed', code: 'transport_failed', reason: MISSING_SESSION_TOKEN_REASON };
			this._transportState = this._transportState === 'ok' ? 'idle' : this._transportState;
			this._fireSnapshotChanged();
			return { ok: false, code: 'transport_failed', reason: MISSING_SESSION_TOKEN_REASON };
		}
		const capabilities = await probeEngineCapabilities({ methods: result.methods, transport: captured });
		if (this._lostCapturedDial(epoch, captured)) {
			this._abandonCaptured(captured);
			return this._staleDial();
		}
		const sessionList = (await probeSessionListCapability({ methods: result.methods, transport: captured })).support;
		if (this._lostCapturedDial(epoch, captured)) {
			this._abandonCaptured(captured);
			return this._staleDial();
		}
		const saveSkill = await this._probeSaveSkill(captured, result.methods);
		if (this._lostCapturedDial(epoch, captured)) {
			this._abandonCaptured(captured);
			return this._staleDial();
		}
		this._applyConnectedCommit({
			epoch,
			transport: captured,
			profileId,
			token: result.sessionToken,
			workDir: result.workDir,
			methods: result.methods,
			capabilities,
			sessionList,
			saveSkill,
			path: endpoint.path,
		});
		return {
			ok: true,
			path: endpoint.path,
			authenticated: true,
			workDir: result.workDir,
			pairingPending: false,
		};
	}

	private async _dialDeviceAuth(
		epoch: number,
		profileId: string,
		captured: IUniverseAgentGrpcTransport,
		endpoint: ResolvedEndpoint,
		identity: { readonly clientIdentityId: string; readonly clientPublicKey: Uint8Array },
		reconnect: boolean,
	): Promise<UniverseAgentConnectProfileResult> {
		if (!endpoint.tls) {
			this._abandonCaptured(captured);
			return this._writeDialFailure(epoch, 'trust_missing', 'paired profile trust is required for pinned dial', reconnect);
		}
		const profile = this._connectionProfileStore?.get(profileId);
		const engineIdentityId = profile?.trust?.engineIdentityId;
		if (!engineIdentityId) {
			this._abandonCaptured(captured);
			return this._writeDialFailure(epoch, 'trust_missing', 'paired profile trust is required for pinned dial', reconnect);
		}
		const signer = await this._clientIdentityStore!.createSigner();
		if (!signer) {
			this._abandonCaptured(captured);
			return this._writeDialFailure(epoch, 'trust_missing', 'device auth signer unavailable', reconnect);
		}
		this._markDialConnecting(reconnect);
		try {
			const handshake = await runDeviceAuthHandshake(
				captured,
				{
					clientIdentityId: identity.clientIdentityId,
					clientPublicKey: identity.clientPublicKey,
					engineIdentityId,
					observedLeafSha256Hex: endpoint.tls.expectedLeafSha256Hex,
				},
				signer,
				{ pairingPhase: 'formal' },
			);
			if (this._lostCapturedDial(epoch, captured)) {
				this._abandonCaptured(captured);
				return this._staleDial();
			}
			if (handshake.kind === 'failed') {
				this._abandonCaptured(captured);
				const code = handshake.code === 'fingerprint_mismatch' ? 'pin_mismatch' : handshake.code;
				if (code === 'grant_revoked' && this._epochCurrent(epoch) && !this._liveConnectedPublished()) {
					this._prepareGrantRevokedRepair(profile);
				}
				return this._writeDialFailure(epoch, code, handshake.reason, reconnect);
			}
			if (handshake.kind === 'pairing_pending') {
				const cleared: ConnectionProfile = profile
					? { ...profile, trust: null, state: 'pairingPending' }
					: {
						profileId,
						displayName: profileId,
						target: { kind: 'directAddress', host: endpoint.resolvedIp, port: endpoint.port },
						trust: null,
						state: 'pairingPending',
						allowPrivateNetwork: false,
					};
				this._connectionProfileStore?.put(cleared);
				this._abandonCaptured(captured);
				return this._startProfilePairing(profileId, cleared, reconnect, epoch);
			}
			const token = handshake.result.sessionToken ?? '';
			const attempt = this._armAuthenticatedLink(captured, token);
			const capabilities = await probeEngineCapabilities({ methods: handshake.result.methods, transport: captured });
			const afterProbe = this._afterCapturedProbe(attempt, epoch, profileId);
			if (afterProbe) {
				return afterProbe;
			}
			const sessionList = (await probeSessionListCapability({ methods: handshake.result.methods, transport: captured })).support;
			const afterSessionList = this._afterCapturedProbe(attempt, epoch, profileId);
			if (afterSessionList) {
				return afterSessionList;
			}
			const saveSkill = await this._probeSaveSkill(captured, handshake.result.methods);
			const afterSkill = this._afterCapturedProbe(attempt, epoch, profileId);
			if (afterSkill) {
				return afterSkill;
			}
			if (this._lostCapturedDial(epoch, captured)) {
				this._abandonCaptured(captured);
				return this._staleDial();
			}
			this._applyConnectedCommit({
				epoch,
				transport: captured,
				profileId,
				token,
				workDir: handshake.result.workDir,
				methods: handshake.result.methods,
				capabilities,
				sessionList,
				saveSkill,
				path: endpoint.path,
			});
			attempt.committed = true;
			if (attempt.condemned && !attempt.settled && this._canCloseoutAuthenticatedLink(attempt)) {
				this._closeoutAuthenticatedLink(attempt);
				return this._authenticatedLinkFailure(attempt);
			}
			return {
				ok: true,
				path: endpoint.path,
				authenticated: token.length > 0,
				workDir: handshake.result.workDir,
				pairingPending: false,
			};
		} catch (error) {
			if (this._lostCapturedDial(epoch, captured)) {
				this._abandonCaptured(captured);
				return this._staleDial();
			}
			this._markTransportFailed(error);
			this._abandonCaptured(captured);
			const reason = error instanceof Error ? error.message : String(error);
			if (!(error instanceof UniverseAgentTransportError)) {
				this._scheduleOwnedFailure(epoch, 'transport_failed', reconnect);
			}
			return { ok: false, code: 'transport_failed', reason };
		}
	}

	async confirmPairing(): Promise<UniverseAgentConnectProfileResult> {
		if (!this._pairingOrchestrator) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'pairing orchestrator is not configured',
			};
		}

		const snapshot = this._pairingOrchestrator.getSnapshot();
		const profileId = this._pairingContextProfileId;
		if (!snapshot || !profileId) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'no pairing awaiting confirmation',
			};
		}

		await loadGrpcModule();
		const confirmResult = snapshot.phase === 'recover_trust'
			? await this._pairingOrchestrator.confirmRecoverTrust()
			: await this._pairingOrchestrator.confirmSas();
		if (this._pairingContextProfileId !== profileId) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'no pairing awaiting confirmation',
			};
		}

		if (!confirmResult.ok) {
			const code = this._mapPairingFailureCode(confirmResult.code);
			this._connectionPhase = { kind: 'failed', code, reason: confirmResult.reason };
			this._fireSnapshotChanged();
			return { ok: false, code, reason: confirmResult.reason };
		}

		if (confirmResult.snapshot.phase === 'grant_pending') {
			this._pairingPending = true;
			this._cancelReconnectTimer();
			this._connectionPhase = { kind: 'connecting', reason: 'initial' };
			this._fireSnapshotChanged();
			const sasCode = readConnectProfileSasCode(confirmResult.snapshot);
			return finalizeConnectProfileResult({
				ok: true,
				path: 'direct',
				authenticated: false,
				pairingPending: true,
				grantPending: !sasCode,
				sasCode,
				engineIdentityId: confirmResult.snapshot.engineIdentityId,
			});
		}

		const dialId = this._pairingContextProfileId;
		if (dialId !== profileId) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'no pairing awaiting confirmation',
			};
		}
		this._pairingPending = false;
		return this.connectProfile(dialId);
	}

	async cancelPairing(): Promise<void> {
		this._pairingOrchestrator?.abandonRecoverTrust();
		await this.disconnect();
	}

	async probeConnectionProfile(profileId: string): Promise<ConnectionProbeResult> {
		if (!this._connectionResolver || !this._clientIdentityStore) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'connection resolver is not configured',
			};
		}

		const resolved = await this._connectionResolver.resolve(profileId, { useRelayTicketCache: false });
		if (resolved.ok) {
			return await this._probeResolvedEndpoint(resolved.endpoint);
		}
		if (resolved.code !== 'pairing_required') {
			return { ok: false, code: resolved.code, reason: resolved.reason };
		}
		const pairingResolved = await this._connectionResolver.resolve(profileId, { forPairing: true, useRelayTicketCache: false });
		if (!pairingResolved.ok) {
			return {
				ok: false,
				code: 'pairing_required',
				reason: PAIRING_REQUIRED_USE_CONNECT_REASON,
			};
		}
		return await this._probeResolvedEndpoint(pairingResolved.endpoint);
	}

	async disconnect(): Promise<void> {
		this._userDisconnecting = true;
		this._bumpConnectEpoch();
		this._suppressLocalEngineDiscovery = true;
		this._cancelLocalEngineDiscoveryTimer();
		this._loopbackSkipAuth = false;
		this._resetReconnectBackoff();
		this._disposeLinkEvents();
		this._transport?.close();
		this._transport = undefined;
		this._sessionToken = undefined;
		this._workDir = undefined;
		this._sharedFsRootSent = false;
		this._pairingPending = false;
		this._agentTreeProbeUnsupported = false;
		this._agentTreeFetchFailed = false;
		this._fetchToolDetailUnsupported = false;
		this._advertisedMethods = [];
		this._clearSaveSkillContentBinding();
		this._transportState = 'idle';
		this._capabilities = createEmptyCapabilitySnapshot();
		this._sessionListCapability = 'UNKNOWN';
		this._connectionPhase = { kind: 'closed' };
		this._activeProfileId = undefined;
		this._fireSnapshotChanged();
		this._userDisconnecting = false;
	}

	async listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		return this._withTransport(transport => transport.listSessions(request));
	}

	async createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		return runCreateSessionSingleFlight(
			this._createSessionInflight,
			request.clientSessionId,
			() => this._withTransport(transport => createSessionRecoveringAlreadyExists(
				() => transport.createSession(request),
				() => transport.listSessions({}),
				async sessionId => transport.resumeSession({ sessionId }),
				request.title,
				request.clientSessionId,
			)),
		);
	}

	async deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void> {
		await this._withTransport(transport => transport.deleteSession(request));
	}

	async getSessionInfo(request: UniverseAgentSessionInfoRequest): Promise<UniverseAgentSessionInfoResult> {
		return this._withTransport(transport => transport.getSessionInfo(request));
	}

	async resumeSession(request: UniverseAgentResumeSessionRequest): Promise<UniverseAgentResumeSessionResult> {
		return this._withTransport(transport => {
			if (typeof transport.resumeSession !== 'function') {
				throw new Error('SessionService.Resume is required before CreateSession');
			}
			return transport.resumeSession(request);
		});
	}

	async prewarmSessions(request: UniverseAgentPrewarmSessionsRequest): Promise<UniverseAgentPrewarmSessionsResult> {
		return this._withTransport(transport => transport.prewarmSessions(request));
	}

	async shelveSession(request: UniverseAgentShelveSessionRequest): Promise<UniverseAgentShelveSessionResult> {
		return this._withTransport(transport => transport.shelveSession(request));
	}

	async unshelveSession(request: UniverseAgentUnshelveSessionRequest): Promise<UniverseAgentUnshelveSessionResult> {
		return this._withTransport(transport => transport.unshelveSession(request));
	}

	async purgeSession(request: UniverseAgentPurgeSessionRequest): Promise<UniverseAgentPurgeSessionResult> {
		return this._withTransport(transport => transport.purgeSession(request));
	}

	async exportSession(request: UniverseAgentExportSessionRequest): Promise<UniverseAgentExportSessionResult> {
		return this._withTransport(transport => transport.exportSession(request));
	}

	async resolveTurn(request: UniverseAgentResolveTurnRequest): Promise<UniverseAgentResolveTurnResult> {
		return this._withTransport(transport => transport.resolveTurn(request));
	}

	async getAgentStatus(request: UniverseAgentAgentStatusRequest): Promise<UniverseAgentAgentStatusResult> {
		return this._withTransport(transport => transport.getAgentStatus(request));
	}

	async getTodo(request: UniverseAgentTodoRequest): Promise<UniverseAgentTodoResult> {
		return this._withTransport(transport => transport.getTodo(request));
	}

	async compact(request: UniverseAgentCompactRequest): Promise<UniverseAgentCompactResult> {
		return this._withTransport(transport => transport.compact(request));
	}

	async resolveAnchor(request: UniverseAgentResolveAnchorRequest): Promise<UniverseAgentResolveAnchorResult> {
		return this._withTransport(transport => transport.resolveAnchor(request));
	}

	async getUsage(request: UniverseAgentUsageRequest): Promise<UniverseAgentUsageResult> {
		return this._withTransport(transport => transport.getUsage(request));
	}

	async listAgents(request: UniverseAgentListAgentsRequest): Promise<UniverseAgentListAgentsResult> {
		return this._withTransport(transport => transport.listAgents(request));
	}

	async getAgentHistory(request: UniverseAgentAgentHistoryRequest): Promise<UniverseAgentAgentHistoryResult> {
		return this._withTransport(transport => transport.getAgentHistory(request));
	}

	async pauseAgent(request: UniverseAgentPauseAgentRequest): Promise<UniverseAgentPauseAgentResult> {
		return this._withTransport(transport => transport.pauseAgent(request));
	}

	async back(request: UniverseAgentBackRequest): Promise<UniverseAgentBackResult> {
		return this._withTransport(transport => transport.back(request));
	}
	async prune(request: UniverseAgentPruneRequest): Promise<UniverseAgentPruneResult> {
		return this._withTransport(transport => transport.prune(request));
	}
	async resetAgent(request: UniverseAgentResetAgentRequest): Promise<UniverseAgentResetAgentResult> {
		return this._withTransport(transport => transport.resetAgent(request));
	}

	async branch(request: UniverseAgentBranchRequest): Promise<UniverseAgentBranchResult> {
		return this._withTransport(transport => transport.branch(request));
	}
	async suspendLoop(request: UniverseAgentSuspendLoopRequest): Promise<UniverseAgentSuspendLoopResult> {
		return this._withTransport(transport => transport.suspendLoop(request));
	}

	async resumeLoop(request: UniverseAgentResumeLoopRequest): Promise<UniverseAgentResumeLoopResult> {
		return this._withTransport(transport => transport.resumeLoop(request));
	}

	async stopLoop(request: UniverseAgentStopLoopRequest): Promise<UniverseAgentStopLoopResult> {
		return this._withTransport(transport => transport.stopLoop(request));
	}

	async renameSession(request: UniverseAgentRenameSessionRequest): Promise<UniverseAgentRenameSessionResult> {
		return this._withTransport(transport => transport.renameSession(request));
	}

	async cancelGeneration(request: UniverseAgentCancelGenerationRequest): Promise<UniverseAgentCancelGenerationResult> {
		return this._withTransport(transport => transport.cancelGeneration(request));
	}

	async cancelToolCall(request: UniverseAgentCancelToolCallRequest): Promise<UniverseAgentCancelToolCallResult> {
		return this._withTransport(transport => transport.cancelToolCall(request));
	}

	async runToolInBackground(request: UniverseAgentRunToolInBackgroundRequest): Promise<UniverseAgentRunToolInBackgroundResult> {
		return this._withTransport(transport => transport.runToolInBackground(request));
	}

	async stopShellTask(request: UniverseAgentStopShellTaskRequest): Promise<UniverseAgentStopShellTaskResult> {
		return this._withTransport(transport => transport.stopShellTask(request));
	}

	async sendShellSessionClientControl(request: UniverseAgentSendShellSessionClientControlRequest): Promise<UniverseAgentSendShellSessionClientControlResult> {
		return this._withTransport(transport => transport.sendShellSessionClientControl(request));
	}

	async fetchToolUsageDetail(request: UniverseAgentFetchToolUsageDetailRequest): Promise<UniverseAgentFetchToolUsageDetailResult> {
		return this._withTransport(transport => transport.fetchToolUsageDetail(request));
	}

	async fireTriggerWebhook(request: UniverseAgentFireTriggerWebhookRequest): Promise<UniverseAgentFireTriggerWebhookResult> {
		return this._withTransport(transport => transport.fireTriggerWebhook(request));
	}

	async installSessionDemoFake(request: UniverseAgentInstallSessionDemoFakeRequest): Promise<UniverseAgentInstallSessionDemoFakeResult> {
		return this._withTransport(transport => transport.installSessionDemoFake(request));
	}

	async clearSessionDemoFake(request: UniverseAgentClearSessionDemoFakeRequest): Promise<UniverseAgentClearSessionDemoFakeResult> {
		return this._withTransport(transport => transport.clearSessionDemoFake(request));
	}

	async switchWorkDir(request: UniverseAgentSwitchWorkDirRequest): Promise<UniverseAgentSwitchWorkDirResult> {
		return this._withTransport(transport => transport.switchWorkDir(request));
	}

	async testModelProfile(request: UniverseAgentTestModelProfileRequest): Promise<UniverseAgentTestModelProfileResult> {
		return this._withTransport(transport => transport.testModelProfile(request));
	}

	async setConfig(request: UniverseAgentSetConfigRequest): Promise<UniverseAgentSetConfigResult> {
		return this._withTransport(transport => transport.setConfig(request));
	}

	async setModelPreferences(request: UniverseAgentSetModelPreferencesRequest): Promise<UniverseAgentSetModelPreferencesResult> {
		return this._withTransport(transport => transport.setModelPreferences(request));
	}

	async setSessionGoal(request: UniverseAgentSetSessionGoalRequest): Promise<UniverseAgentSetSessionGoalResult> {
		return this._withTransport(transport => transport.setSessionGoal(request));
	}

	async cancelSessionGoal(request: UniverseAgentCancelSessionGoalRequest): Promise<UniverseAgentCancelSessionGoalResult> {
		return this._withTransport(transport => transport.cancelSessionGoal(request));
	}

	async respondPermission(request: UniverseAgentRespondPermissionRequest): Promise<UniverseAgentRespondPermissionResult> {
		return this._withTransport(transport => transport.respondPermission(request));
	}

	async syncPermissionRule(request: UniverseAgentSyncPermissionRuleRequest): Promise<UniverseAgentSyncPermissionRuleResult> {
		return this._withTransport(transport => transport.syncPermissionRule(request));
	}

	async promotePermissionRule(request: UniverseAgentPromotePermissionRuleRequest): Promise<UniverseAgentPromotePermissionRuleResult> {
		return this._withTransport(transport => transport.promotePermissionRule(request));
	}

	async getSessionRules(request: UniverseAgentGetSessionRulesRequest): Promise<UniverseAgentGetSessionRulesResult> {
		return this._withTransport(transport => transport.getSessionRules(request));
	}

	async setPermissionMode(request: UniverseAgentSetPermissionModeRequest): Promise<UniverseAgentSetPermissionModeResult> {
		return this._withTransport(transport => transport.setPermissionMode(request));
	}

	async taskUpdate(request: UniverseAgentTaskUpdateRequest): Promise<UniverseAgentTaskUpdateResult> {
		return this._withTransport(transport => transport.taskUpdate(request));
	}

	async taskCancel(request: UniverseAgentTaskCancelRequest): Promise<UniverseAgentTaskCancelResult> {
		return this._withTransport(transport => transport.taskCancel(request));
	}

	async messageMember(request: UniverseAgentMessageMemberRequest): Promise<UniverseAgentMessageMemberResult> {
		return this._withTransport(transport => transport.messageMember(request));
	}

	async createTeam(request: UniverseAgentCreateTeamRequest): Promise<UniverseAgentCreateTeamResult> {
		return this._withTransport(transport => transport.createTeam(request));
	}

	async startMember(request: UniverseAgentStartMemberRequest): Promise<UniverseAgentStartMemberResult> {
		return this._withTransport(transport => transport.startMember(request));
	}

	async killMember(request: UniverseAgentKillMemberRequest): Promise<UniverseAgentKillMemberResult> {
		return this._withTransport(transport => transport.killMember(request));
	}

	async abort(request: UniverseAgentAbortTeamRequest): Promise<UniverseAgentAbortTeamResult> {
		return this._withTransport(transport => transport.abort(request));
	}

	async respondQuestion(request: UniverseAgentRespondQuestionRequest): Promise<UniverseAgentRespondQuestionResult> {
		return this._withTransport(transport => transport.respondQuestion(request));
	}

	async enqueueQueueItem(request: UniverseAgentEnqueueQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.enqueueQueueItem(request));
	}

	async insertQueueItem(request: UniverseAgentInsertQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.insertQueueItem(request));
	}

	async reorderQueue(request: UniverseAgentReorderQueueRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.reorderQueue(request));
	}

	async deleteQueueItem(request: UniverseAgentDeleteQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.deleteQueueItem(request));
	}

	async retryQueueItem(request: UniverseAgentRetryQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.retryQueueItem(request));
	}

	async retryAllFailed(request: UniverseAgentRetryAllFailedRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.retryAllFailed(request));
	}

	async retryQueueItemUpload(request: UniverseAgentRetryQueueItemUploadRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.retryQueueItemUpload(request));
	}

	async pinQueueItem(request: UniverseAgentPinQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.pinQueueItem(request));
	}

	async setQueueItemLocked(request: UniverseAgentSetQueueItemLockedRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.setQueueItemLocked(request));
	}

	async injectQueueItem(request: UniverseAgentInjectQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.injectQueueItem(request));
	}

	async setQueueItemForkAnchor(request: UniverseAgentSetQueueItemForkAnchorRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.setQueueItemForkAnchor(request));
	}

	async pauseQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.pauseQueue(request));
	}

	async resumeQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.resumeQueue(request));
	}

	async clearQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.clearQueue(request));
	}

	async holdQueueItem(request: UniverseAgentHoldQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.holdQueueItem(request));
	}

	async releaseQueueItemHold(request: UniverseAgentQueueItemRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.releaseQueueItemHold(request));
	}

	async editQueueItem(request: UniverseAgentEditQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._withTransport(transport => transport.editQueueItem(request));
	}

	async forkAgent(request: UniverseAgentForkAgentRequest): Promise<UniverseAgentForkAgentResult> {
		return this._withTransport(transport => transport.forkAgent(request));
	}

	async killAgent(request: UniverseAgentKillAgentRequest): Promise<UniverseAgentKillAgentResult> {
		return this._withTransport(transport => transport.killAgent(request));
	}

	async deleteMessage(request: UniverseAgentDeleteMessageRequest): Promise<UniverseAgentDeleteMessageResult> {
		return this._withTransport(transport => transport.deleteMessage(request));
	}

	async editMessage(request: UniverseAgentEditMessageRequest): Promise<UniverseAgentEditMessageResult> {
		return this._withTransport(transport => transport.editMessage(request));
	}

	async sendClientToolResponse(request: UniverseAgentSendClientToolResponseRequest): Promise<UniverseAgentSendClientToolResponseResult> {
		return this._withTransport(transport => transport.sendClientToolResponse(request));
	}

	async listSnapshots(request: UniverseAgentListSnapshotsRequest): Promise<UniverseAgentListSnapshotsResult> {
		return this._withTransport(transport => transport.listSnapshots(request));
	}

	async listLoopSnapshots(request: UniverseAgentListLoopSnapshotsRequest): Promise<UniverseAgentListLoopSnapshotsResult> {
		return this._withTransport(transport => transport.listLoopSnapshots(request));
	}

	async createSnapshot(request: UniverseAgentCreateSnapshotRequest): Promise<UniverseAgentCreateSnapshotResult> {
		return this._withTransport(transport => transport.createSnapshot(request));
	}

	async restoreSnapshot(request: UniverseAgentRestoreSnapshotRequest): Promise<UniverseAgentRestoreSnapshotResult> {
		return this._withTransport(transport => transport.restoreSnapshot(request));
	}

	async deleteSnapshot(request: UniverseAgentDeleteSnapshotRequest): Promise<UniverseAgentDeleteSnapshotResult> {
		return this._withTransport(transport => transport.deleteSnapshot(request));
	}

	async getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		return this._withTransport(transport => transport.getHistory(request));
	}

	subscribeSessionEventStream(
		sessionId: string,
		listener: (event: UniverseAgentSessionEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this._assertTransportReady();
		return this._transport!.subscribeSessionEventStream(sessionId, listener, onClosed);
	}

	async chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
		await this._withTransport(transport => transport.chat(request, onResponse));
	}

	async chatSync(request: UniverseAgentChatSyncRequest): Promise<UniverseAgentChatSyncResult> {
		return this._withTransport(transport => transport.chatSync(request));
	}

	async syncInputDelivery(request: UniverseAgentSyncInputDeliveryRequest): Promise<UniverseAgentSyncInputDeliveryResult> {
		return this._withTransport(transport => transport.syncInputDelivery(request));
	}

	openChatStream(
		sessionId: string,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentChatStream {
		this._assertTransportReady();
		return this._transport!.openChatStream(sessionId, onResponse, onClosed);
	}

	openContinuationStream(
		request: UniverseAgentContinueGenerationRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentContinuationStream {
		this._assertTransportReady();
		return this._transport!.openContinuationStream(request, onResponse, onClosed);
	}

	openRegenerateStream(
		request: UniverseAgentRegenerateRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentRegenerateStream {
		this._assertTransportReady();
		return this._transport!.openRegenerateStream(request, onResponse, onClosed);
	}

	openResumeStream(
		request: UniverseAgentResumeRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentResumeStream {
		this._assertTransportReady();
		return this._transport!.openResumeStream(request, onResponse, onClosed);
	}

	openSubscribeToolDetailStream(
		request: UniverseAgentSubscribeToolDetailRequest,
		onResponse: (response: UniverseAgentSubscribeToolDetailChunk) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentSubscribeToolDetailStream {
		this._assertTransportReady();
		return this._transport!.openSubscribeToolDetailStream(request, onResponse, onClosed);
	}

	async listSkills(): Promise<UniverseAgentListSkillsResult> {
		return this._withTransport(transport => transport.listSkills());
	}

	async setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult> {
		return this._withTransport(transport => transport.setSkillEnabled(request));
	}

	async getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult> {
		return this._withTransport(transport => transport.getSkillInfo(request));
	}

	async listAgentProfiles(request: UniverseAgentListAgentProfilesRequest = {}): Promise<UniverseAgentListAgentProfilesResult> {
		const workDir = this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.listAgentProfiles({
			projectPath: request.projectPath ?? workDir,
		}));
	}

	async saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult> {
		return this._withTransport(transport => transport.saveAgentProfile(request));
	}

	async deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult> {
		return this._withTransport(transport => transport.deleteAgentProfile(request));
	}

	async resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult> {
		return this._withTransport(transport => transport.resetAgentProfile(request));
	}

	async listMcpServers(request: UniverseAgentListMcpServersRequest = {}): Promise<UniverseAgentListMcpServersResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.listMcpServers({
			...request,
			workDir,
		}));
	}

	async getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult> {
		return this._withTransport(transport => transport.getMcpServerStatuses(serverIds));
	}

	async getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult> {
		return this._withTransport(transport => transport.getMcpServerTools(serverId, forceRefresh));
	}

	async listPlugins(): Promise<UniverseAgentListPluginsResult> {
		return this._withTransport(transport => transport.listPlugins());
	}

	async getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult> {
		return this._withTransport(transport => transport.getPluginInfo(id));
	}

	async enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult> {
		return this._withTransport(transport => transport.enablePlugin(id, enabled));
	}

	async reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult> {
		return this._withTransport(transport => transport.reloadPlugin(id));
	}

	async unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult> {
		return this._withTransport(transport => transport.unloadPlugin(id));
	}

	async scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult> {
		return this._withTransport(transport => transport.scanNewPlugins());
	}

	async addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.addMcpServer({
			...request,
			workDir: request.scope === 'project' ? workDir : request.workDir,
		}));
	}

	async updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.updateMcpServer({
			...request,
			workDir: request.scope === 'project' ? workDir : request.workDir,
		}));
	}

	async removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.removeMcpServer({
			...request,
			workDir: request.scope === 'project' ? workDir : request.workDir,
		}));
	}

	async toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.toggleMcpServer({
			...request,
			workDir: request.scope === 'project' ? workDir : request.workDir,
		}));
	}

	async listTools(): Promise<UniverseAgentListToolsResult> {
		return this._withTransport(transport => transport.listTools());
	}

	async getToolInfo(request: UniverseAgentToolInfoRequest): Promise<UniverseAgentToolInfoResult> {
		return this._withTransport(transport => transport.getToolInfo(request));
	}

	async listCommands(): Promise<UniverseAgentListCommandsResult> {
		return this._withTransport(transport => transport.listCommands());
	}

	async getCommandDef(request: UniverseAgentGetCommandDefRequest): Promise<UniverseAgentGetCommandDefResult> {
		return this._withTransport(transport => transport.getCommandDef(request));
	}

	async listFiles(request: UniverseAgentListFilesRequest): Promise<UniverseAgentListFilesResult> {
		return this._withTransport(transport => transport.listFiles(request));
	}

	async readFile(request: UniverseAgentReadFileRequest): Promise<UniverseAgentReadFileResult> {
		return this._withTransport(transport => transport.readFile(request));
	}

	async getFileInfo(request: UniverseAgentGetFileInfoRequest): Promise<UniverseAgentGetFileInfoResult> {
		return this._withTransport(transport => transport.getFileInfo(request));
	}

	async writeFile(request: UniverseAgentWriteFileRequest): Promise<UniverseAgentWriteFileResult> {
		return this._withTransport(transport => transport.writeFile(request));
	}

	async forceWriteFile(request: UniverseAgentForceWriteFileRequest): Promise<UniverseAgentWriteFileResult> {
		return this._withTransport(transport => transport.forceWriteFile(request));
	}

	async agentMerge(request: UniverseAgentAgentMergeRequest): Promise<UniverseAgentAgentMergeResult> {
		return this._withTransport(transport => transport.agentMerge(request));
	}

	async readGitSummary(request: UniverseAgentReadGitSummaryRequest): Promise<UniverseAgentReadGitSummaryResult> {
		return this._withTransport(transport => transport.readGitSummary(request));
	}

	async readGitChanges(request: UniverseAgentReadGitChangesRequest): Promise<UniverseAgentReadGitChangesResult> {
		return this._withTransport(transport => transport.readGitChanges(request));
	}

	async readGitFileDiff(request: UniverseAgentReadGitFileDiffRequest): Promise<UniverseAgentReadGitFileDiffResult> {
		return this._withTransport(transport => transport.readGitFileDiff(request));
	}

	async writeGitStagePaths(request: UniverseAgentWriteGitStagePathsRequest): Promise<UniverseAgentWriteGitWriteResult> {
		return this._withTransport(transport => transport.writeGitStagePaths(request));
	}

	async writeGitCommit(request: UniverseAgentWriteGitCommitRequest): Promise<UniverseAgentWriteGitWriteResult> {
		return this._withTransport(transport => transport.writeGitCommit(request));
	}

	async writeGitApplyHunks(request: UniverseAgentWriteGitApplyHunksRequest): Promise<UniverseAgentWriteGitWriteResult> {
		return this._withTransport(transport => transport.writeGitApplyHunks(request));
	}

	async getSessionUsage(request: UniverseAgentGetSessionUsageRequest): Promise<UniverseAgentGetSessionUsageResult> {
		return this._withTransport(transport => transport.getSessionUsage(request));
	}

	async getGlobalUsage(): Promise<UniverseAgentGetGlobalUsageResult> {
		return this._withTransport(transport => transport.getGlobalUsage());
	}

	async saveMemory(request: UniverseAgentSaveMemoryRequest): Promise<UniverseAgentSaveMemoryResult> {
		return this._withTransport(transport => transport.saveMemory(request));
	}

	async searchMemory(request: UniverseAgentMemorySearchRequest): Promise<UniverseAgentMemorySearchResult> {
		return this._withTransport(transport => transport.searchMemory(request));
	}

	async searchDeepMemory(request: UniverseAgentMemorySearchDeepRequest): Promise<UniverseAgentMemorySearchDeepResult> {
		return this._withTransport(transport => transport.searchDeepMemory(request));
	}

	async readMemory(request: UniverseAgentReadMemoryRequest): Promise<UniverseAgentReadMemoryResult> {
		return this._withTransport(transport => transport.readMemory(request));
	}

	async listMemory(request: UniverseAgentMemoryListRequest): Promise<UniverseAgentMemoryListResult> {
		return this._withTransport(transport => transport.listMemory(request));
	}

	async deleteMemory(request: UniverseAgentDeleteMemoryRequest): Promise<UniverseAgentDeleteMemoryResult> {
		return this._withTransport(transport => transport.deleteMemory(request));
	}

	async reflectMemory(request: UniverseAgentReflectMemoryRequest): Promise<UniverseAgentReflectMemoryResult> {
		return this._withTransport(transport => transport.reflectMemory(request));
	}

	openRebuildMemoryStream(
		request: UniverseAgentMemoryRebuildRequest,
		onResponse: (response: UniverseAgentMemoryRebuildEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentMemoryRebuildStream {
		this._assertTransportReady();
		return this._transport!.openRebuildMemoryStream(request, onResponse, onClosed);
	}

	async revertMemory(request: UniverseAgentRevertMemoryRequest): Promise<UniverseAgentRevertMemoryResult> {
		return this._withTransport(transport => transport.revertMemory(request));
	}

	async historyMemory(request: UniverseAgentMemoryHistoryRequest): Promise<UniverseAgentMemoryHistoryResult> {
		return this._withTransport(transport => transport.historyMemory(request));
	}

	async listContextVariable(request: UniverseAgentContextVariableListRequest): Promise<UniverseAgentContextVariableListResult> {
		return this._withTransport(transport => transport.listContextVariable(request));
	}

	async readContextVariable(request: UniverseAgentContextVariableReadRequest): Promise<UniverseAgentContextVariableReadResult> {
		return this._withTransport(transport => transport.readContextVariable(request));
	}

	async listNodes(request: UniverseAgentListNodesRequest): Promise<UniverseAgentListNodesResult> {
		return this._withTransport(transport => transport.listNodes(request));
	}

	async getNode(request: UniverseAgentGetNodeRequest): Promise<UniverseAgentRemoteAgentInfo> {
		return this._withTransport(transport => transport.getNode(request));
	}

	async checkConnection(request: UniverseAgentCheckConnectionRequest): Promise<UniverseAgentConnectionReport> {
		return this._withTransport(transport => transport.checkConnection(request));
	}

	async setMaintenance(request: UniverseAgentSetMaintenanceRequest): Promise<UniverseAgentSetMaintenanceResult> {
		return this._withTransport(transport => transport.setMaintenance(request));
	}

	async exitMaintenance(request: UniverseAgentExitMaintenanceRequest): Promise<UniverseAgentExitMaintenanceResult> {
		return this._withTransport(transport => transport.exitMaintenance(request));
	}

	async listConfigs(): Promise<UniverseAgentListConfigsResult> {
		return this._withTransport(transport => transport.listConfigs());
	}

	async getRemoteAgentConfig(request: UniverseAgentGetRemoteAgentConfigRequest): Promise<UniverseAgentRemoteAgentConfig> {
		return this._withTransport(transport => transport.getRemoteAgentConfig(request));
	}

	async saveRemoteAgentConfig(request: UniverseAgentSaveRemoteAgentConfigRequest): Promise<UniverseAgentSaveRemoteAgentConfigResult> {
		return this._withTransport(transport => transport.saveRemoteAgentConfig(request));
	}

	async resetError(request: UniverseAgentResetErrorRequest): Promise<UniverseAgentResetErrorResult> {
		return this._withTransport(transport => transport.resetError(request));
	}

	async deleteRemoteAgentConfig(request: UniverseAgentDeleteRemoteAgentConfigRequest): Promise<UniverseAgentDeleteRemoteAgentConfigResult> {
		return this._withTransport(transport => transport.deleteRemoteAgentConfig(request));
	}

	async reloadRemoteAgents(): Promise<UniverseAgentReloadRemoteAgentsResult> {
		return this._withTransport(transport => transport.reloadRemoteAgents());
	}

	openRemoteChatStream(
		request: UniverseAgentRemoteChatRequest,
		onResponse: (response: UniverseAgentRemoteChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentRemoteChatStream {
		this._assertTransportReady();
		return this._transport!.openRemoteChatStream(request, onResponse, onClosed);
	}

	async createRemoteSession(request: UniverseAgentCreateRemoteSessionRequest): Promise<UniverseAgentCreateRemoteSessionResult> {
		return this._withTransport(transport => transport.createRemoteSession(request));
	}

	async destroyRemoteSession(request: UniverseAgentDestroyRemoteSessionRequest): Promise<UniverseAgentDestroyRemoteSessionResult> {
		return this._withTransport(transport => transport.destroyRemoteSession(request));
	}

	async getRemoteSessionStatus(request: UniverseAgentGetRemoteSessionStatusRequest): Promise<UniverseAgentGetRemoteSessionStatusResult> {
		return this._withTransport(transport => transport.getRemoteSessionStatus(request));
	}

	async getRemoteSessionHistory(request: UniverseAgentGetRemoteSessionHistoryRequest): Promise<UniverseAgentGetRemoteSessionHistoryResult> {
		return this._withTransport(transport => transport.getRemoteSessionHistory(request));
	}
	async resumeRemoteSession(request: UniverseAgentResumeRemoteSessionRequest): Promise<UniverseAgentResumeRemoteSessionResult> {
		return this._withTransport(transport => transport.resumeRemoteSession(request));
	}
	async cancelRemoteSession(request: UniverseAgentCancelRemoteSessionRequest): Promise<UniverseAgentCancelRemoteSessionResult> {
		return this._withTransport(transport => transport.cancelRemoteSession(request));
	}

	async getUploadProgress(request: UniverseAgentGetUploadProgressRequest): Promise<UniverseAgentGetUploadProgressResult> {
		return this._withTransport(transport => transport.getUploadProgress(request));
	}

	openUploadAttachmentStream(
		onResponse: (response: UniverseAgentUploadAttachmentResult) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentUploadAttachmentStream {
		this._assertTransportReady();
		return this._transport!.openUploadAttachmentStream(onResponse, onClosed);
	}

	openDownloadAttachmentStream(
		request: UniverseAgentDownloadAttachmentRequest,
		onResponse: (response: UniverseAgentDownloadChunk) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentDownloadAttachmentStream {
		this._assertTransportReady();
		return this._transport!.openDownloadAttachmentStream(request, onResponse, onClosed);
	}

	openPtyStream(
		onResponse: (response: UniverseAgentPtyServerMessage) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentPtyStream {
		this._assertTransportReady();
		return this._transport!.openPtyStream(onResponse, onClosed);
	}

	async healthCheck(): Promise<UniverseAgentHealthCheckResult> {
		return this._withTransport(transport => transport.healthCheck());
	}

	async doctor(): Promise<UniverseAgentDoctorResult> {
		return this._withTransport(transport => transport.doctor());
	}

	async shutdown(request: UniverseAgentShutdownRequest): Promise<UniverseAgentShutdownResult> {
		return this._withTransport(transport => transport.shutdown(request));
	}

	async listDevices(): Promise<UniverseAgentListDevicesResult> {
		return this._withTransport(transport => transport.listDevices());
	}

	async pairApprove(request: UniverseAgentPairApproveRequest): Promise<UniverseAgentPairApproveResult> {
		return this._withTransport(transport => transport.pairApprove(request));
	}

	async pairReject(request: UniverseAgentPairRejectRequest): Promise<UniverseAgentPairRejectResult> {
		return this._withTransport(transport => transport.pairReject(request));
	}

	async revoke(request: UniverseAgentRevokeRequest): Promise<UniverseAgentRevokeResult> {
		return this._withTransport(transport => transport.revoke(request));
	}

	async rotateToken(request: UniverseAgentRotateTokenRequest): Promise<UniverseAgentRotateTokenResult> {
		return this._withTransport(transport => transport.rotateToken(request));
	}

	async listPending(): Promise<UniverseAgentListPendingResult> {
		return this._withTransport(transport => transport.listPending());
	}

	async listTriggers(request: UniverseAgentListTriggersRequest): Promise<UniverseAgentListTriggersResult> {
		return this._withTransport(transport => transport.listTriggers(request));
	}

	async upsertTrigger(request: UniverseAgentUpsertTriggerRequest): Promise<UniverseAgentUpsertTriggerResult> {
		return this._withTransport(transport => transport.upsertTrigger(request));
	}

	async deleteTrigger(request: UniverseAgentDeleteTriggerRequest): Promise<UniverseAgentDeleteTriggerResult> {
		return this._withTransport(transport => transport.deleteTrigger(request));
	}

	async setTriggerEnabled(request: UniverseAgentSetTriggerEnabledRequest): Promise<UniverseAgentSetTriggerEnabledResult> {
		return this._withTransport(transport => transport.setTriggerEnabled(request));
	}

	async fireTrigger(request: UniverseAgentFireTriggerRequest): Promise<UniverseAgentFireTriggerResult> {
		return this._withTransport(transport => transport.fireTrigger(request));
	}

	async writeClipboard(request: UniverseAgentWriteClipboardRequest): Promise<UniverseAgentWriteClipboardResult> {
		return this._withTransport(transport => transport.writeClipboard(request));
	}

	async readClipboard(request: UniverseAgentReadClipboardRequest): Promise<UniverseAgentReadClipboardResult> {
		return this._withTransport(transport => transport.readClipboard(request));
	}

	async listClipboard(request: UniverseAgentListClipboardRequest): Promise<UniverseAgentListClipboardResult> {
		return this._withTransport(transport => transport.listClipboard(request));
	}

	async clearClipboard(request: UniverseAgentClearClipboardRequest): Promise<UniverseAgentClearClipboardResult> {
		return this._withTransport(transport => transport.clearClipboard(request));
	}

	async setPermissionPolicy(request: UniverseAgentSetPermissionPolicyRequest): Promise<UniverseAgentSetPermissionPolicyResult> {
		return this._withTransport(transport => transport.setPermissionPolicy(request));
	}

	async listModels(): Promise<UniverseAgentListModelsResult> {
		return this._withTransport(transport => transport.listModels());
	}

	async listProviderStatus(): Promise<UniverseAgentListProviderStatusResult> {
		return this._withTransport(transport => transport.listProviderStatus());
	}

	async listProjectRules(request: UniverseAgentListProjectRulesRequest): Promise<UniverseAgentListProjectRulesResult> {
		return this._withTransport(transport => transport.listProjectRules(request));
	}

	async listHookPoints(): Promise<UniverseAgentListHookPointsResult> {
		return this._withTransport(transport => transport.listHookPoints());
	}

	async listTeams(sessionId: string): Promise<UniverseAgentListTeamsResult> {
		return this._withTransport(transport => transport.listTeams(sessionId));
	}

	async getConfig(request: UniverseAgentGetConfigRequest): Promise<UniverseAgentGetConfigResult> {
		return this._withTransport(transport => transport.getConfig(request));
	}

	async switchModel(request: UniverseAgentSwitchModelRequest): Promise<UniverseAgentSwitchModelResult> {
		return this._withTransport(transport => transport.switchModel(request));
	}

	async getModelPreferences(request: UniverseAgentGetModelPreferencesRequest): Promise<UniverseAgentGetModelPreferencesResult> {
		return this._withTransport(transport => transport.getModelPreferences(request));
	}

	async resolveModel(request: UniverseAgentResolveModelRequest): Promise<UniverseAgentResolveModelResult> {
		return this._withTransport(transport => transport.resolveModel(request));
	}

	openWatchConfigStream(
		request: UniverseAgentWatchConfigRequest,
		onResponse: (response: UniverseAgentConfigChangedEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentWatchConfigStream {
		this._assertTransportReady();
		return this._transport!.openWatchConfigStream(request, onResponse, onClosed);
	}

	async probeEngine(): Promise<UniverseAgentProbeEngineResult> {
		if (!this._transport) {
			return { ok: false, reason: 'Engine is not connected.' };
		}
		if (!this._clientIdentityStore) {
			return { ok: false, reason: 'Client identity store is unavailable.' };
		}
		const identityState = await this._clientIdentityStore.getOrCreateIdentity();
		if (identityState.kind !== 'ready') {
			return { ok: false, reason: `client identity unavailable: ${identityState.kind}` };
		}
		try {
			const nonce = await this._transport.getAuthNonce({
				clientIdentityId: identityState.identity.clientIdentityId,
				clientPublicKey: identityState.identity.clientPublicKey,
			});
			return { ok: true, engineIdentityId: nonce.engineIdentityId };
		} catch (error) {
			return { ok: false, reason: error instanceof Error ? error.message : String(error) };
		}
	}

	getActiveHubBaseUrl(): string | undefined {
		return this._hub.getActiveHubBaseUrl();
	}

	setActiveHubBaseUrl(hubBaseUrl: string | undefined): void {
		this._hub.setActiveHubBaseUrl(hubBaseUrl);
	}

	getAuthStatus() {
		return this._hub.getAuthStatus();
	}

	getDirectoryStatus() {
		return this._hub.getDirectoryStatus();
	}

	listConnectionProfiles() {
		return this._hub.listConnectionProfiles();
	}

	get onDidChangeAuthStatus() {
		return this._hub.onDidChangeAuthStatus;
	}

	get onDidChangeDirectory() {
		return this._hub.onDidChangeDirectory;
	}

	get onDidChangeProfiles() {
		return this._hub.onDidChangeProfiles;
	}

	login(hubBaseUrl: string, email: string, password: string) {
		return this._hub.login(hubBaseUrl, email, password);
	}

	logout() {
		return this._hub.logout();
	}

	changePassword(oldPassword: string, newPassword: string) {
		return this._hub.changePassword(oldPassword, newPassword);
	}

	refreshDirectory() {
		return this._hub.refreshDirectory();
	}

	renameDevice(deviceId: string, name: string) {
		return this._hub.renameDevice(deviceId, name);
	}

	revokeDevice(deviceId: string) {
		const activeProfileId = this._activeProfileId;
		const wasConnected = this._connectionPhase.kind === 'connected' || this._connectionPhase.kind === 'connecting';
		const hubBaseUrlAtCall = this.getActiveHubBaseUrl();
		return this._hub.revokeDevice(deviceId).then(async result => {
			if (result.ok && wasConnected && activeProfileId && hubBaseUrlAtCall) {
				const profile = this._connectionProfileStore?.get(activeProfileId);
				if (
					profile?.target.kind === 'hubDevice'
					&& profile.target.hubDeviceId === deviceId
					&& hubBaseUrlIdentityKey(profile.target.hubBaseUrl) === hubBaseUrlIdentityKey(hubBaseUrlAtCall)
				) {
					await this.disconnect();
				}
			}
			return result;
		});
	}

	confirmDeviceCode(code: string) {
		return this._hub.confirmDeviceCode(code);
	}

	addDirectAddressProfile(input: {
		readonly host: string;
		readonly port: number;
		readonly displayName?: string;
		readonly allowPrivateNetwork?: boolean;
	}) {
		return this._hub.addDirectAddressProfile(input);
	}

	addHubDeviceProfile(input: {
		readonly hubDeviceId: string;
		readonly displayName?: string;
	}) {
		return this._hub.addHubDeviceProfile(input);
	}

	forgetConnectionProfile(profileId: string) {
		return this._hub.forgetConnectionProfile(profileId);
	}

	isEncryptionAvailable() {
		return this._hub.isEncryptionAvailable();
	}

	override dispose(): void {
		this._bumpConnectEpoch();
		this._reconnectDisposed = true;
		this._sessionToken = undefined;
		this._pairingPending = false;
		this._cancelLocalEngineDiscoveryTimer();
		this._resetReconnectBackoff();
		this._disposeLinkEvents();
		this._transport?.close();
		this._transport = undefined;
		if (this._connectionPhase.kind === 'connected' || this._connectionPhase.kind === 'connecting') {
			this._connectionPhase = { kind: 'disconnected' };
			this._fireSnapshotChanged();
		}
		super.dispose();
	}

	private async _openLoopbackTransport(): Promise<IUniverseAgentGrpcTransport> {
		if (this._transport) {
			return this._transport;
		}
		await loadGrpcModule();
		return this._createTransport(this._loopbackAddress);
	}

	private _assertTransportReady(): void {
		if (!this._transport || this._transportState === 'failed') {
			throw new UniverseAgentTransportError(14, 'UniverseAgent transport is not available');
		}
	}

	private async _withTransport<T>(operation: (transport: IUniverseAgentGrpcTransport) => Promise<T>): Promise<T> {
		const transport = this._transport;
		if (!transport) {
			throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'UniverseAgent transport is not available');
		}
		try {
			const result = await operation(transport);
			if (transport !== this._transport) {
				return result;
			}
			if (this._transportState !== 'ok') {
				this._transportState = 'ok';
				if (
					this._connectionPhase.kind === 'connecting'
					&& this._connectionPhase.reason === 'transport_lost'
					&& this.isEngineConnected()
					&& this._lastConnectedPath
				) {
					this._connectionPhase = { kind: 'connected', path: this._lastConnectedPath };
				}
				this._resetReconnectBackoff();
				this._fireSnapshotChanged();
			}
			return result;
		} catch (error) {
			if (transport !== this._transport) {
				throw error;
			}
			this._markTransportFailed(error);
			throw error;
		}
	}

	private _markTransportFailed(error: unknown): void {
		if (error instanceof UniverseAgentTransportError && isTransportFailureCode(error.code)) {
			this._transportState = 'failed';
			if (this._activeProfileId) {
				this._connectionPhase = { kind: 'connecting', reason: 'transport_lost' };
				this._scheduleReconnect();
			} else if (this._loopbackSkipAuth) {
				this._loopbackSkipAuth = false;
				this._sessionToken = undefined;
				this._connectionPhase = { kind: 'disconnected' };
				this._localEngineDiscoveryAttempt += 1;
				this._scheduleLocalEngineDiscovery(this._computeReconnectDelay(this._localEngineDiscoveryAttempt));
			} else if (this._connectionPhase.kind === 'connecting') {
				this._connectionPhase = { kind: 'failed', code: 'transport_failed', reason: error.message };
			}
			this._fireSnapshotChanged();
		}
	}

	private _computeReconnectDelay(attempt: number): number {
		const n = Math.max(0, attempt - 1);
		const raw = Math.min(this._reconnectBaseMs * (2 ** n), this._reconnectMaxMs);
		if (this._reconnectJitterRatio <= 0) {
			return raw;
		}
		const jitter = raw * this._reconnectJitterRatio * (2 * Math.random() - 1);
		return Math.max(0, Math.round(raw + jitter));
	}

	private _canScheduleReconnect(): boolean {
		return !this._reconnectDisposed
			&& !this._userDisconnecting
			&& !this._userDialInFlight
			&& !this._pairingPending
			&& !!this._activeProfileId
			&& this._reconnectTimer === undefined;
	}

	private _cancelReconnectTimer(): void {
		if (this._reconnectTimer !== undefined) {
			this._clearTimeoutFn(this._reconnectTimer);
			this._reconnectTimer = undefined;
		}
	}

	private _cancelLocalEngineDiscoveryTimer(): void {
		if (this._localEngineDiscoveryTimer !== undefined) {
			this._clearTimeoutFn(this._localEngineDiscoveryTimer);
			this._localEngineDiscoveryTimer = undefined;
		}
	}

	private _canDiscoverLocalEngine(): boolean {
		return this._autoConnectLocalEngine
			&& !this._suppressLocalEngineDiscovery
			&& !this._reconnectDisposed
			&& this._connectionPhase.kind === 'disconnected';
	}

	private _scheduleLocalEngineDiscovery(delayMs: number): void {
		if (!this._canDiscoverLocalEngine() || this._localEngineDiscoveryTimer !== undefined) {
			return;
		}
		this._localEngineDiscoveryTimer = this._setTimeoutFn(() => {
			this._localEngineDiscoveryTimer = undefined;
			void this._discoverAndConnectLocalEngine().catch(onUnexpectedError);
		}, delayMs);
	}

	private async _discoverAndConnectLocalEngine(): Promise<void> {
		if (!this._canDiscoverLocalEngine()) {
			return;
		}
		const port = await this._findLocalEnginePort();
		if (!this._canDiscoverLocalEngine()) {
			return;
		}
		if (port === undefined) {
			this._localEngineDiscoveryAttempt += 1;
			this._scheduleLocalEngineDiscovery(this._computeReconnectDelay(this._localEngineDiscoveryAttempt));
			return;
		}
		await this._connectLocalSkipAuth(port);
	}

	private async _connectLocalSkipAuth(port: number): Promise<void> {
		if (!this._canDiscoverLocalEngine()) {
			return;
		}
		this._connectionPhase = { kind: 'connecting', reason: 'initial' };
		this._fireSnapshotChanged();
		let transport: GrpcUniverseAgentClient | undefined;
		try {
			await loadGrpcModule();
			transport = this._openLocalEngineTransport(`127.0.0.1:${port}`);
			const result = await transport.connectWithoutDeviceAuth();
			if (this._reconnectDisposed || this._suppressLocalEngineDiscovery || this._connectionPhase.kind !== 'connecting') {
				transport.close();
				return;
			}
			if (isPairingPending(result.sessionToken, result.pairingNonce)) {
				transport.close();
				this._suppressLocalEngineDiscovery = true;
				this._connectionPhase = { kind: 'disconnected' };
				this._fireSnapshotChanged();
				return;
			}
			this._transport = transport;
			this._sessionToken = result.sessionToken;
			this._workDir = result.workDir;
			this._pairingPending = false;
			this._loopbackSkipAuth = !result.sessionToken;
			this._transportState = 'ok';
			this._lastConnectedPath = 'loopback';
			const attempt = this._armAuthenticatedLink(transport, result.sessionToken ?? '');
			this._rememberAdvertisedMethods(result.methods);
			this._capabilities = await probeEngineCapabilities({
				methods: result.methods,
				transport,
			});
			const afterProbe = this._afterAuthenticatedAwait(attempt);
			if (afterProbe) {
				return;
			}
			await this._refreshSessionListCapability(result.methods);
			const afterSessionList = this._afterAuthenticatedAwait(attempt);
			if (afterSessionList) {
				return;
			}
			await this._refreshSaveSkillContentBinding(result.methods);
			const afterSkill = this._afterAuthenticatedAwait(attempt);
			if (afterSkill) {
				return;
			}
			this._connectionPhase = { kind: 'connected', path: 'loopback' };
			this._localEngineDiscoveryAttempt = 0;
			this._resetReconnectBackoff();
			attempt.committed = true;
			this._agentTreeFetchFailed = false;
			this._fireSnapshotChanged();
			if (attempt.condemned && this._canCloseoutAuthenticatedLink(attempt)) {
				this._closeoutAuthenticatedLink(attempt);
			}
		} catch (error) {
			transport?.close();
			if (this._transport === transport) {
				this._transport = undefined;
			}
			if (!this._reconnectDisposed && !this._suppressLocalEngineDiscovery && this._connectionPhase.kind === 'connecting') {
				this._connectionPhase = { kind: 'disconnected' };
				this._fireSnapshotChanged();
				this._localEngineDiscoveryAttempt += 1;
				this._scheduleLocalEngineDiscovery(this._computeReconnectDelay(this._localEngineDiscoveryAttempt));
			}
			if (!(error instanceof UniverseAgentTransportError)) {
				onUnexpectedError(error);
			}
		}
	}

	private _resetReconnectBackoff(): void {
		this._cancelReconnectTimer();
		this._reconnectAttempt = 0;
	}

	private _scheduleReconnect(): void {
		if (!this._canScheduleReconnect()) {
			return;
		}
		const profileId = this._activeProfileId;
		if (!profileId) {
			return;
		}
		this._reconnectAttempt += 1;
		const delay = this._computeReconnectDelay(this._reconnectAttempt);
		this._reconnectTimer = this._setTimeoutFn(() => {
			this._reconnectTimer = undefined;
			void this._fireReconnect(profileId).catch(onUnexpectedError).catch(onUnexpectedError);
		}, delay);
	}

	private _keepTransportLostOnConnect(): boolean {
		return this._profileReconnectDial
			|| this._transportState === 'failed'
			|| (this._connectionPhase.kind === 'connecting' && this._connectionPhase.reason === 'transport_lost');
	}

	private _isReconnectHaltCode(code: ConnectionFailureCode): boolean {
		return code === 'pairing_required'
			|| code === 'hub_session_required'
			|| code === 'trust_missing'
			|| code === 'pin_mismatch'
			|| code === 'grant_revoked'
			|| code.startsWith('hub_auth_');
	}

	private _maybeScheduleReconnectAfterTransportFailedReturn(code: ConnectionFailureCode, reconnect: boolean): void {
		if (code !== 'transport_failed' || this._isReconnectHaltCode(code)) {
			return;
		}
		if (!this._activeProfileId || (!reconnect && this._transportState !== 'failed')) {
			return;
		}
		this._scheduleReconnect();
	}

	private _rescheduleReconnectAfterAttempt(): void {
		if (this._reconnectDisposed || this._userDisconnecting || this._pairingPending || this._userDialInFlight) {
			return;
		}
		// `_markTransportFailed` may already have a timer; `_canScheduleReconnect`
		// no-ops when one is pending so attempt is not incremented twice.
		this._scheduleReconnect();
	}

	private async _fireReconnect(profileId: string): Promise<void> {
		if (this._reconnectDisposed || this._userDisconnecting || this._pairingPending || this._activeProfileId !== profileId) {
			return;
		}
		if (this._userDialInFlight) {
			return;
		}
		const epoch = this._connectEpoch;
		try {
			const result = await this.connectProfile(profileId, { reconnect: true });
			if (this._connectEpoch !== epoch || this._userDialInFlight) {
				return;
			}
			if (this._reconnectDisposed || this._userDisconnecting) {
				return;
			}
			if (result.ok && !result.pairingPending) {
				this._resetReconnectBackoff();
				return;
			}
			if (result.ok && result.pairingPending) {
				this._cancelReconnectTimer();
				return;
			}
			if (!result.ok && (this._isReconnectHaltCode(result.code) || isNonRetryableDeviceAuthRpcFailure(result.reason))) {
				this._cancelReconnectTimer();
				return;
			}
			if (!result.ok && result.code === 'transport_failed' && result.reason === SESSION_TOKEN_REJECTED_REASON) {
				this._cancelReconnectTimer();
				return;
			}
			// D410: non-halt !ok keeps the backoff loop. A superseded dial must not tear down a winner.
			if (!result.ok && (this._liveConnectedPublished() || result.reason === DIAL_SUPERSEDED_REASON)) {
				return;
			}
			this._rescheduleReconnectAfterAttempt();
		} catch {
			if (this._connectEpoch !== epoch || this._userDialInFlight) {
				return;
			}
			if (this._activeProfileId !== profileId) {
				return;
			}
			this._rescheduleReconnectAfterAttempt();
		}
	}

	private _buildSnapshot(): UniverseAgentConnectionSnapshot {
		return {
			transport: this._transportState,
			authenticated: !!this._sessionToken,
			workDir: this._workDir,
			sharedFsRootSent: this._sharedFsRootSent,
			pairingPending: this._pairingPending,
			channelAlive: !!this._transport?.isChannelAlive,
			capabilities: sanitizeDesktopCapabilitySnapshot(this._capabilities),
			sessionListCapability: this._sessionListCapability,
			phase: this._connectionPhase,
			agentTreeFetchFailed: this._agentTreeFetchFailed,
		};
	}

	private _setAgentTreeFetchFailed(failed: boolean): void {
		if (this._agentTreeFetchFailed === failed) {
			return;
		}
		this._agentTreeFetchFailed = failed;
		this._fireSnapshotChanged();
	}

	private _publishConnectionPhase(phase: ConnectionPhase): void {
		if (sameConnectionPhase(this._connectionPhase, phase)) {
			return;
		}
		this._connectionPhase = phase;
		this._fireSnapshotChanged();
	}

	private _fireSnapshotChanged(): void {
		this._onDidChangeConnection.fire(this._buildSnapshot());
	}

	private async _renewPairingDialEndpoint(profile: ConnectionProfile): Promise<
		{ readonly ok: true; readonly endpoint: PairingDialEndpoint } | { readonly ok: false; readonly code: string; readonly reason: string }
	> {
		if (!this._connectionResolver) {
			return {
				ok: false,
				code: 'hub_ticket_failed',
				reason: 'connection resolver is not configured',
			};
		}
		const resolved = await this._connectionResolver.resolve(profile.profileId, {
			forPairing: true,
			forceNewTicket: true,
			useRelayTicketCache: false,
		});
		if (!resolved.ok) {
			return { ok: false, code: resolved.code, reason: resolved.reason };
		}
		return { ok: true, endpoint: this._toPairingDialEndpoint(resolved.endpoint) };
	}

	private _toPairingDialEndpoint(endpoint: ResolvedEndpoint): PairingDialEndpoint {
		return {
			host: endpoint.resolvedIp,
			port: endpoint.port,
			servername: endpoint.servername,
			relayTicketId: endpoint.relayTicketId,
		};
	}

	private _bumpConnectEpoch(): void {
		this._connectEpoch++;
		this._pairingContextProfileId = undefined;
	}

	private _beginUserDial(): number {
		this._userDialSerial++;
		this._userDialInFlight = true;
		return this._userDialSerial;
	}

	private _endUserDial(serial: number): void {
		if (serial === this._userDialSerial) {
			this._userDialInFlight = false;
		}
	}

	private _epochCurrent(epoch: number): boolean {
		return epoch === this._connectEpoch && !this._reconnectDisposed;
	}

	private _liveConnectedPublished(): boolean {
		return !!this._transport
			&& this._connectionPhase.kind === 'connected'
			&& this._transportState === 'ok'
			&& !!this._sessionToken
			&& !this._pairingPending;
	}

	private _blockedBySameEpochWinner(epoch: number): boolean {
		return this._liveConnectedPublished() && this._connectedEpoch === epoch;
	}

	private _canMutateDial(epoch: number): boolean {
		return this._epochCurrent(epoch) && !this._blockedBySameEpochWinner(epoch);
	}

	private _staleDial(): UniverseAgentConnectProfileResult {
		return { ok: false, code: 'transport_failed', reason: DIAL_SUPERSEDED_REASON };
	}

	private _lostCapturedDial(epoch: number, captured: IUniverseAgentGrpcTransport): boolean {
		if (!this._epochCurrent(epoch) || this._blockedBySameEpochWinner(epoch)) {
			return true;
		}
		return this._liveConnectedPublished() && this._transport !== captured;
	}

	private _abandonCaptured(captured: IUniverseAgentGrpcTransport): void {
		if (this._transport === captured && this._liveConnectedPublished()) {
			return;
		}
		if (this._transport === captured) {
			this._transport = undefined;
		}
		captured.close();
	}

	private _dropPublishedTransport(): void {
		const current = this._transport;
		if (!current) {
			return;
		}
		this._disposeLinkEvents();
		this._transport = undefined;
		current.close();
		this._sessionToken = undefined;
		this._workDir = undefined;
		this._clearSaveSkillContentBinding();
		this._capabilities = createEmptyCapabilitySnapshot();
		this._sessionListCapability = 'UNKNOWN';
		this._transportState = 'idle';
	}

	private _takeOverEntry(entry: IUniverseAgentGrpcTransport | undefined, profileId: string): void {
		if (entry && this._transport === entry) {
			this._dropPublishedTransport();
			this._connectionPhase = { kind: 'disconnected' };
			this._fireSnapshotChanged();
		}
		if (!this._liveConnectedPublished()) {
			this._activeProfileId = profileId;
		}
	}

	private _markDialConnecting(reconnect: boolean): void {
		this._publishConnectionPhase({
			kind: 'connecting',
			reason: reconnect ? 'transport_lost' : 'initial',
		});
	}

	private _scheduleOwnedFailure(epoch: number, code: ConnectionFailureCode, reconnectHint: boolean): void {
		if (!this._epochCurrent(epoch) || this._liveConnectedPublished()) {
			return;
		}
		this._maybeScheduleReconnectAfterTransportFailedReturn(code, reconnectHint);
	}

	private _writeDialFailure(
		epoch: number,
		code: ConnectionFailureCode,
		reason: string,
		reconnectHint: boolean,
	): UniverseAgentConnectProfileResult {
		if (!this._epochCurrent(epoch) || this._liveConnectedPublished()) {
			return this._staleDial();
		}
		this._connectionPhase = { kind: 'failed', code, reason };
		this._fireSnapshotChanged();
		this._scheduleOwnedFailure(epoch, code, reconnectHint);
		return { ok: false, code, reason };
	}

	/** Next user Connect uses existing pairing_required. This dial does not start pairing. */
	private _prepareGrantRevokedRepair(profile: ConnectionProfile | undefined): void {
		if (!profile || !this._connectionProfileStore) {
			return;
		}
		if (profile.target.kind !== 'directAddress' && profile.target.kind !== 'hubDevice') {
			return;
		}
		this._connectionProfileStore.put({
			...profile,
			trust: null,
			state: 'pairingPending',
		});
	}

	private _applyConnectedCommit(input: {
		readonly epoch: number;
		readonly transport: IUniverseAgentGrpcTransport;
		readonly profileId: string | undefined;
		readonly token: string;
		readonly workDir: string | undefined;
		readonly methods: readonly string[];
		readonly capabilities: UniverseAgentCapabilitySnapshot;
		readonly sessionList: UniverseAgentCapabilitySupport;
		readonly saveSkill: boolean;
		readonly path: ConnectionPath;
	}): void {
		this._transport = input.transport;
		this._sessionToken = input.token;
		this._workDir = input.workDir;
		this._pairingPending = false;
		this._transportState = 'ok';
		this._rememberAdvertisedMethods(input.methods);
		this._capabilities = input.capabilities;
		this._sessionListCapability = input.sessionList;
		if (input.saveSkill) {
			this._bindSaveSkillContent();
		} else {
			this._clearSaveSkillContentBinding();
		}
		this._connectionPhase = { kind: 'connected', path: input.path };
		this._lastConnectedPath = input.path;
		this._agentTreeFetchFailed = false;
		if (input.profileId) {
			this._activeProfileId = input.profileId;
		}
		this._connectedEpoch = input.epoch;
		this._resetReconnectBackoff();
		this._fireSnapshotChanged();
	}

	private async _probeSaveSkill(transport: IUniverseAgentGrpcTransport, methods: readonly string[]): Promise<boolean> {
		if (!methods.includes(UniverseAgentSaveSkillContentMethodKey)) {
			return false;
		}
		const status = await transport.probeRpc(
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SaveSkillContent,
		);
		return status === GrpcStatusCode.OK;
	}

	private _afterCapturedProbe(
		attempt: AuthenticatedLinkAttempt,
		epoch: number,
		profileId: string,
	): UniverseAgentConnectProfileResult | undefined {
		if (attempt.settled) {
			return this._authenticatedLinkFailure(attempt);
		}
		if (this._lostCapturedDial(epoch, attempt.transport)) {
			this._abandonCaptured(attempt.transport);
			return this._staleDial();
		}
		if (!attempt.condemned) {
			return undefined;
		}
		return this._closeoutUnpublishedLink(attempt, profileId);
	}

	private _closeoutUnpublishedLink(attempt: AuthenticatedLinkAttempt, profileId: string): UniverseAgentConnectProfileResult {
		if (!this._activeProfileId) {
			this._activeProfileId = profileId;
		}
		if (attempt.settled) {
			return this._authenticatedLinkFailure(attempt);
		}
		const previous = this._transport;
		const previousState = this._transportState;
		this._transport = attempt.transport;
		this._transportState = 'ok';
		if (this._canCloseoutAuthenticatedLink(attempt)) {
			this._closeoutAuthenticatedLink(attempt);
			return this._authenticatedLinkFailure(attempt);
		}
		if (this._transport === attempt.transport) {
			this._transport = previous;
		}
		this._transportState = previousState;
		attempt.transport.close();
		return this._authenticatedLinkFailure(attempt);
	}

	private async _startProfilePairing(
		profileId: string,
		profile: ConnectionProfile,
		reconnect: boolean,
		epoch: number,
	): Promise<UniverseAgentConnectProfileResult> {
		if (!this._epochCurrent(epoch) || this._blockedBySameEpochWinner(epoch)) {
			return this._staleDial();
		}
		if (!this._pairingOrchestrator || !this._connectionResolver) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'pairing orchestrator is not configured',
			};
		}

		const pairingResolved = await this._connectionResolver.resolve(profileId, {
			forceNewTicket: true,
			forPairing: true,
		});
		if (!this._epochCurrent(epoch) || this._blockedBySameEpochWinner(epoch)) {
			return this._staleDial();
		}
		if (!pairingResolved.ok) {
			if (this._liveConnectedPublished()) {
				return { ok: false, code: pairingResolved.code, reason: pairingResolved.reason };
			}
			return this._writeDialFailure(epoch, pairingResolved.code, pairingResolved.reason, reconnect);
		}

		const endpoint = pairingResolved.endpoint;
		const pairingEndpoint = this._toPairingDialEndpoint(endpoint);
		this._dropPublishedTransport();
		if (this._activeProfileId === profileId) {
			this._activeProfileId = undefined;
		}
		this._pairingContextProfileId = profileId;
		this._pairingPending = true;
		this._cancelReconnectTimer();
		this._transportState = 'idle';
		this._connectionPhase = {
			kind: 'connecting',
			reason: reconnect ? 'transport_lost' : 'initial',
		};
		this._fireSnapshotChanged();

		let startResult: Awaited<ReturnType<PairingOrchestrator['startPairing']>>;
		try {
			await loadGrpcModule();
			this._connectionResolver.consumeRelayTicket(profileId);
			startResult = await this._pairingOrchestrator.startPairing(profile, pairingEndpoint);
		} catch (error) {
			if (!this._canMutateDial(epoch) || this._liveConnectedPublished()) {
				return this._staleDial();
			}
			const reason = error instanceof Error ? error.message : String(error);
			this._pairingPending = false;
			this._connectionPhase = { kind: 'failed', code: 'transport_failed', reason };
			this._fireSnapshotChanged();
			return { ok: false, code: 'transport_failed', reason };
		}
		if (!this._canMutateDial(epoch) || this._liveConnectedPublished()) {
			return this._staleDial();
		}
		if (!startResult.ok) {
			const code = this._mapPairingFailureCode(startResult.code);
			this._pairingPending = false;
			this._connectionPhase = { kind: 'failed', code, reason: startResult.reason };
			this._fireSnapshotChanged();
			return { ok: false, code, reason: startResult.reason };
		}

		const snapshot = startResult.snapshot;
		this._fireSnapshotChanged();
		if (snapshot.phase === 'recover_trust') {
			return {
				ok: true,
				path: endpoint.path,
				authenticated: false,
				pairingPending: true,
				recoverTrust: true,
				engineIdentityId: snapshot.engineIdentityId,
				leafSha256Hex: snapshot.leafSha256Hex,
			};
		}

		return {
			ok: true,
			path: endpoint.path,
			authenticated: false,
			pairingPending: true,
			sasCode: snapshot.sasCode,
			engineIdentityId: snapshot.engineIdentityId,
		};
	}

	private _mapPairingFailureCode(code: string): ConnectionFailureCode {
		switch (code) {
			case 'sas_mismatch':
			case 'sas_cancelled':
			case 'recover_cancelled':
			case 'pin_mismatch':
			case 'grant_revoked':
			case 'grant_pending':
			case 'trust_missing':
			case 'hub_session_required':
			case 'hub_password_change_required':
			case 'hub_auth_expired':
			case 'hub_unreachable':
			case 'hub_device_not_in_directory':
			case 'hub_device_revoked':
			case 'engine_not_serving':
			case 'hub_ticket_failed':
			case 'hub_rate_limited':
			case 'private_network_denied':
			case 'unsupported_environment':
				return code;
			default:
				return 'transport_failed';
		}
	}

	private async _probeResolvedEndpoint(endpoint: ResolvedEndpoint): Promise<ConnectionProbeResult> {
		await loadGrpcModule();
		const dialAddress = formatResolvedDialAddress(endpoint.resolvedIp, endpoint.port);
		const probeTransport = endpoint.tls
			? createPinnedGrpcUniverseAgentClient({
				address: dialAddress,
				tls: endpoint.tls,
				sslTargetNameOverride: endpoint.servername,
			})
			: this._createTransport(dialAddress);

		const identityState = await this._clientIdentityStore!.getOrCreateIdentity();
		if (identityState.kind !== 'ready') {
			probeTransport.close();
			return {
				ok: false,
				code: 'trust_missing',
				reason: `client identity unavailable: ${identityState.kind}`,
			};
		}

		const startMs = Date.now();
		const probeTimeoutMs = 10_000;
		try {
			await Promise.race([
				probeTransport.getAuthNonce({
					clientIdentityId: identityState.identity.clientIdentityId,
					clientPublicKey: identityState.identity.clientPublicKey,
				}),
				new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('probe timed out after 10s')), probeTimeoutMs);
				}),
			]);
			return {
				ok: true,
				path: endpoint.path,
				authority: endpoint.authority,
				latencyMs: Date.now() - startMs,
			};
		} catch (error) {
			return this._mapProbeTransportError(error);
		} finally {
			probeTransport.close();
		}
	}

	private _mapProbeTransportError(error: unknown): ConnectionProbeResult {
		const classified = classifyDeviceAuthRpcFailure(error, 'GetAuthNonce');
		if (classified.code === 'pin_mismatch' || classified.code === 'grant_revoked') {
			return { ok: false, code: classified.code, reason: classified.reason };
		}
		return {
			ok: false,
			code: 'transport_failed',
			reason: error instanceof Error ? error.message : String(error),
		};
	}

	private _rememberAdvertisedMethods(methods: readonly string[]): void {
		this._advertisedMethods = methods;
		this._fetchToolDetailUnsupported = false;
	}

	private async _refreshSessionListCapability(methods: readonly string[]): Promise<void> {
		if (!this._transport) {
			this._sessionListCapability = 'UNKNOWN';
			return;
		}
		this._sessionListCapability = (await probeSessionListCapability({
			methods,
			transport: this._transport,
		})).support;
	}

	private async _refreshSaveSkillContentBinding(methods: readonly string[]): Promise<void> {
		this._clearSaveSkillContentBinding();
		if (!this._transport || !methods.includes(UniverseAgentSaveSkillContentMethodKey)) {
			return;
		}
		const status = await this._transport.probeRpc(
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SaveSkillContent,
		);
		if (status === GrpcStatusCode.OK) {
			this._bindSaveSkillContent();
		}
	}

	private _bindSaveSkillContent(): void {
		Object.defineProperty(this, 'saveSkillContent', {
			configurable: true,
			enumerable: true,
			writable: true,
			value: (request: UniverseAgentSaveSkillContentRequest) => this._invokeSaveSkillContent(request),
		});
	}

	private _clearSaveSkillContentBinding(): void {
		// The binding is only ever installed as an own property, and deleting a
		// missing one is a no-op, so no presence check is needed.
		delete (this as Partial<IUniverseAgentConnection>).saveSkillContent;
	}

	private async _invokeSaveSkillContent(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult> {
		this._assertTransportReady();
		const transport = this._transport;
		if (!transport) {
			throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'UniverseAgent transport is not available');
		}
		try {
			const result = await transport.saveSkillContent(request);
			if (transport !== this._transport) {
				return result;
			}
			if (this._transportState !== 'ok') {
				this._transportState = 'ok';
				this._fireSnapshotChanged();
			}
			return result;
		} catch (error) {
			if (transport !== this._transport) {
				throw error;
			}
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this._clearSaveSkillContentBinding();
				return { ok: false, reason: 'UNIMPLEMENTED' };
			}
			this._markTransportFailed(error);
			throw error;
		}
	}

	private _disposeLinkEvents(): void {
		this._linkEvents?.dispose();
		this._linkEvents = undefined;
	}

	private _armAuthenticatedLink(transport: IUniverseAgentGrpcTransport, token: string): AuthenticatedLinkAttempt {
		const attempt: AuthenticatedLinkAttempt = {
			transport,
			installedAtMs: this._nowMs(),
			condemned: undefined,
			committed: false,
			settled: undefined,
		};
		if (token.length > 0) {
			transport.installSessionToken(token);
		}
		this._disposeLinkEvents();
		this._linkEvents = combinedDisposable(
			transport.onDidRejectSessionToken(() => this._onLinkCondemned(attempt, 'rejected')),
			transport.onDidObserveUnavailable(() => this._onLinkCondemned(attempt, 'unavailable')),
		);
		return attempt;
	}

	private _onLinkCondemned(attempt: AuthenticatedLinkAttempt, kind: LinkCondemned): void {
		if (attempt.settled) {
			return;
		}
		if (kind === 'rejected') {
			attempt.condemned = 'rejected';
		} else if (attempt.condemned !== 'rejected') {
			attempt.condemned = 'unavailable';
		}
		if (!attempt.committed) {
			return;
		}
		if (!this._canCloseoutAuthenticatedLink(attempt)) {
			return;
		}
		this._closeoutAuthenticatedLink(attempt);
	}

	private _canCloseoutAuthenticatedLink(attempt: AuthenticatedLinkAttempt): boolean {
		return attempt.transport === this._transport
			&& this._transportState === 'ok'
			&& !this._pairingPending
			&& !this._userDisconnecting;
	}

	private _closeoutAuthenticatedLink(attempt: AuthenticatedLinkAttempt): LinkSettlement {
		if (attempt.settled) {
			return attempt.settled;
		}
		const withinGrace = attempt.condemned === 'rejected'
			&& this._nowMs() - attempt.installedAtMs < SESSION_TOKEN_REJECT_GRACE_MS;
		attempt.settled = withinGrace ? 'grace' : 'reconnect';
		const transport = attempt.transport;
		if (this._transport === transport) {
			this._transport = undefined;
		}
		transport.close();
		this._disposeLinkEvents();
		if (attempt.settled === 'grace') {
			this._sessionToken = undefined;
			this._transportState = 'failed';
			this._cancelReconnectTimer();
			this._connectionPhase = {
				kind: 'failed',
				code: 'transport_failed',
				reason: SESSION_TOKEN_REJECTED_REASON,
			};
			this._fireSnapshotChanged();
			return 'grace';
		}
		this._markTransportFailed(new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, TRANSPORT_UNAVAILABLE_REASON));
		return 'reconnect';
	}

	private _authenticatedLinkFailure(attempt: AuthenticatedLinkAttempt): UniverseAgentConnectProfileResult {
		if (attempt.settled === 'grace') {
			return { ok: false, code: 'transport_failed', reason: SESSION_TOKEN_REJECTED_REASON };
		}
		if (attempt.settled === 'reconnect') {
			return { ok: false, code: 'transport_failed', reason: TRANSPORT_UNAVAILABLE_REASON };
		}
		return { ok: false, code: 'transport_failed', reason: 'link superseded' };
	}

	private _afterAuthenticatedAwait(attempt: AuthenticatedLinkAttempt): UniverseAgentConnectProfileResult | undefined {
		if (attempt.settled) {
			return this._authenticatedLinkFailure(attempt);
		}
		if (this._transport !== attempt.transport) {
			attempt.transport.close();
			return { ok: false, code: 'transport_failed', reason: 'link superseded' };
		}
		if (!attempt.condemned) {
			return undefined;
		}
		this._closeoutAuthenticatedLink(attempt);
		return this._authenticatedLinkFailure(attempt);
	}
}
