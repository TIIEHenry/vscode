/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { shouldRestoreLastSessionOnStartup } from '../common/uaClientSettingsHelpers.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isConversationEngineLive } from './conversationSessionStatus.js';
import { IUniverseAgentSessionView } from '../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type { ConversationQuestionRespondAnswers, IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationEngineFrameSource } from './conversationEngineFrameSource.js';
import { IUaClientWorkspaceToolsGate } from './uaClientWorkspaceToolsGate.js';
import {
	buildLocalSessionsFromModel,
	loadConversationRosterStorage,
	type ConversationRosterEngineCache,
	type PersistedConversationSession,
} from './conversationRosterStorage.js';
import type { SyncChrome } from '../../../../platform/universeAgent/common/sessionView/types.js';
import { entriesToLegacyTurns, projectSnapshotToEntries } from './conversationSessionView.js';
import { projectSnapshotToTrajectory, projectTurnsToTrajectory, type ConversationTrajectoryRecord, type TrajectoryProjectionOptions } from './conversationTrajectoryModel.js';
import {
	ConversationStubService,
	IConversationRosterService,
	type ILiveAgentTreeChangeEvent,
} from './conversationStubService.js';
import {
	createEmptyMessageQueueState,
	type ConversationMessageQueueState,
	type ConversationQueueItemHoldReason,
} from './conversationMessageQueueModel.js';
import { allocateConversationStubSessionId, ConversationStubSession, ConversationStubTurn, getConversationStubNextTurnId } from './conversationStubModel.js';

const STUB_SEED_IDS = new Set(['untitled', 'visualize']);
/** Placeholder roster row when connected but no engine session could be bound. */
export const ENGINE_BIND_FAILED_SESSION_ID = '__engine_bind_failed__';

export function isEngineRosterPlaceholderSessionId(sessionId: string | undefined): boolean {
	return !!sessionId && (sessionId === ENGINE_BIND_FAILED_SESSION_ID || STUB_SEED_IDS.has(sessionId));
}

/**
 * Engine-backed roster (M6-A2): same token as stub; switches frame source and
 * session catalog when UA is connected.
 */
export class ConversationEngineRosterService extends ConversationStubService implements IConversationRosterService {

	private readonly engineFrameSource: ConversationEngineFrameSource;
	private readonly liveTreeObservationStore = this._register(new DisposableStore());
	protected readonly _onDidChangeLiveAgentTree = this._register(new Emitter<ILiveAgentTreeChangeEvent>());
	override readonly onDidChangeLiveAgentTree = this._onDidChangeLiveAgentTree.event;
	private engineSessions: ConversationStubSession[] = [];
	private activeEngineSessionId: string | undefined;
	private listCompleted = false;
	private engineSessionEnsure: Promise<string | undefined> | undefined;
	private refreshEngineCatalogInflight: Promise<void> | undefined;
	/** Stable local id for the in-flight auto-bind CreateSession.client_session_id. */
	private pendingEngineBindClientSessionId: string | undefined;
	/** Session id adopted locally but awaiting host lease/bind before roster display. */
	private pendingEngineBindSessionId: string | undefined;
	private suppressBindLiveTreeObservationLease = false;
	private activePendingBindLeaseSessionId: string | undefined;
	/** Bumps when live-tree lease is replaced so stale bind monitors are ignored. */
	private listedBindMonitorGeneration = 0;
	/** True when connected catalog refresh finished but no engine session could be bound. */
	private engineSessionBindFailed = false;
	/** Session ids whose host lease acquire resolved successfully. */
	private engineBoundSessionIds = new Set<string>();
	private wasEverConnected = false;
	private testEngineConnected: boolean | undefined;
	private readonly sessionGoals = new Map<string, string>();

	constructor(
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IUniverseAgentSessionView sessionView: IUniverseAgentSessionView,
		@IUaClientWorkspaceToolsGate private readonly workspaceToolsGate: IUaClientWorkspaceToolsGate,
		@IStorageService storageService?: IStorageService,
		@IConfigurationService configurationService?: IConfigurationService,
	) {
		super(storageService, configurationService);
		this.engineFrameSource = this._register(new ConversationEngineFrameSource(sessionView));
		this.restoreEngineCacheFromStorage();
		this._register(uaConnection.onDidChangeConnection(() => this.onUaConnectionChanged()));
		this._register(this.onDidChangeActiveSession(() => this.bindLiveTreeObservationLease()));
		this._register(this.onDidChangeEngineConnection(() => this.bindLiveTreeObservationLease()));
		this.bindLiveTreeObservationLease();
	}

	override isEngineConnected(): boolean {
		if (this.testEngineConnected !== undefined) {
			return this.testEngineConnected;
		}
		const snapshot = this.uaConnection.getConnectionSnapshot();
		return isConversationEngineLive(this.uaConnection.getConnectionPhase(), snapshot.pairingPending);
	}

	override isEngineSessionReady(): boolean {
		if (!this.isEngineConnected()) {
			return true;
		}
		if (!this.listCompleted || this.pendingEngineBindSessionId) {
			return false;
		}
		const sessionId = this.getActiveSessionId();
		if (!sessionId || isEngineRosterPlaceholderSessionId(sessionId)) {
			return false;
		}
		return this.engineSessions.some(session => session.id === sessionId);
	}

	private isEngineSessionBindFailed(): boolean {
		return this.isEngineConnected()
			&& this.listCompleted
			&& !this.pendingEngineBindSessionId
			&& this.engineSessionBindFailed;
	}

	private getEngineBindFailedSession(): ConversationStubSession {
		return {
			id: ENGINE_BIND_FAILED_SESSION_ID,
			title: localize('conversationLens.sessionBindFailed', "Engine session bind failed"),
			turns: [],
			source: 'engine-cache',
		};
	}

	private markEngineSessionBindFailed(): void {
		if (!this.isEngineConnected() || !this.listCompleted || this.pendingEngineBindSessionId) {
			return;
		}
		if (this.engineSessionBindFailed) {
			return;
		}
		this.engineSessionBindFailed = true;
		this.engineSessions = [];
		this.engineBoundSessionIds.clear();
		const previous = this.activeEngineSessionId;
		this.activeEngineSessionId = ENGINE_BIND_FAILED_SESSION_ID;
		if (previous !== ENGINE_BIND_FAILED_SESSION_ID) {
			this._onDidChangeActiveSession.fire(ENGINE_BIND_FAILED_SESSION_ID);
		}
	}

	/** Client setting gate for advertising IDE workspace tools to Engine (PRD-026). */
	shouldAdvertiseClientWorkspaceTools(): boolean {
		return this.isEngineConnected() && this.workspaceToolsGate.shouldAdvertise();
	}

	override setEngineConnected(connected: boolean): void {
		if (!connected && this.isEngineConnected()) {
			this.captureEngineCache();
		}
		this.testEngineConnected = connected;
		super.setEngineConnected(connected);
		if (connected) {
			this.wasEverConnected = true;
			if (!this.shouldAdvertiseClientWorkspaceTools()) {
				// Workspace-tool advertisement withheld by ua.client.clientTools.advertiseWorkspaceTools.
			}
			void this.refreshEngineCatalog();
		} else {
			this.listCompleted = this.engineSessions.length > 0;
		}
		this.bindLiveTreeObservationLease();
	}

	override getSessions(): readonly ConversationStubSession[] {
		if (this.isEngineConnected()) {
			if (!this.listCompleted) {
				return [];
			}
			if (this.isEngineSessionBindFailed()) {
				return [this.getEngineBindFailedSession()];
			}
			return this.engineSessions;
		}
		if (this.wasEverConnected) {
			return this.engineSessions;
		}
		return super.getSessions();
	}

	override getActiveSession(): ConversationStubSession {
		if (this.isEngineSessionBindFailed()) {
			return this.getEngineBindFailedSession();
		}
		if (this.isEngineConnected() || this.wasEverConnected) {
			const sessionId = this.getActiveSessionId();
			const engineSession = this.engineSessions.find(session => session.id === sessionId);
			if (engineSession) {
				return engineSession;
			}
			if (this.isEngineConnected()) {
				// List-fail / pending / in-flight must not mint stub untitled or "New session".
				if (!this.listCompleted || this.pendingEngineBindSessionId) {
					return {
						id: sessionId || this.pendingEngineBindSessionId || '',
						title: '',
						turns: [],
						source: 'engine-cache',
					};
				}
				return this.getEngineBindFailedSession();
			}
		}
		return super.getActiveSession();
	}

	override getActiveSessionId(): string {
		if (this.isEngineConnected()) {
			if (!this.listCompleted) {
				return this.activeEngineSessionId ?? '';
			}
			if (this.isEngineSessionBindFailed()) {
				return ENGINE_BIND_FAILED_SESSION_ID;
			}
			if (this.engineSessions.length === 0) {
				return this.activeEngineSessionId ?? '';
			}
			if (this.activeEngineSessionId && this.engineSessions.some(s => s.id === this.activeEngineSessionId)) {
				return this.activeEngineSessionId;
			}
			return this.engineSessions[0]!.id;
		}
		if (this.wasEverConnected) {
			if (this.engineSessions.length === 0) {
				return this.activeEngineSessionId ?? '';
			}
			if (this.activeEngineSessionId && this.engineSessions.some(s => s.id === this.activeEngineSessionId)) {
				return this.activeEngineSessionId;
			}
			return this.engineSessions[0]!.id;
		}
		return super.getActiveSessionId();
	}

	override getTrajectoryRecords(sessionId: string, options?: TrajectoryProjectionOptions): readonly ConversationTrajectoryRecord[] {
		if ((this.isEngineConnected() || this.wasEverConnected) && this.engineSessions.some(session => session.id === sessionId)) {
			if (this.isEngineConnected()) {
				const projection = this.engineFrameSource.getCachedProjection(sessionId);
				if (projection) {
					return projectSnapshotToTrajectory(projection.snapshot, projection.attribution, projection.details, options);
				}
			}
			return projectTurnsToTrajectory(this.getTurns(sessionId));
		}
		return super.getTrajectoryRecords(sessionId, options);
	}

	override getTurns(sessionId: string): readonly ConversationStubTurn[] {
		if (isEngineRosterPlaceholderSessionId(sessionId)) {
			return [];
		}
		if ((this.isEngineConnected() || this.wasEverConnected) && this.engineSessions.some(session => session.id === sessionId)) {
			if (this.isEngineConnected()) {
				const projection = this.engineFrameSource.getCachedProjection(sessionId);
				if (projection) {
					return entriesToLegacyTurns(projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details));
				}
			}
			return this.engineSessions.find(session => session.id === sessionId)?.turns ?? [];
		}
		return super.getTurns(sessionId);
	}

	override switchSession(sessionId: string): void {
		if ((this.isEngineConnected() || this.wasEverConnected) && this.engineSessions.some(s => s.id === sessionId)) {
			const previous = this.getActiveSessionId();
			this.activeEngineSessionId = sessionId;
			if (previous !== sessionId) {
				this._onDidChangeActiveSession.fire(sessionId);
			}
			if (this.isEngineConnected()) {
				this.uaConnection.requestAgentTreeRefresh(sessionId);
			}
			this.persistEngineAwareRoster();
			return;
		}
		if (!this.isEngineConnected() && !this.wasEverConnected) {
			super.switchSession(sessionId);
		}
	}

	override createSession(): string {
		if (this.isEngineConnected()) {
			void this.ensureEngineSession().then(() => {
				this.bindLiveTreeObservationLease();
			});
			return '';
		}
		if (this.wasEverConnected) {
			return '';
		}
		return super.createSession();
	}

	override renameSession(sessionId: string, title: string): boolean {
		if (this.isEngineConnected()) {
			return this.renameEngineSession(sessionId, title, true);
		}
		if (this.wasEverConnected) {
			return this.renameEngineSession(sessionId, title, false);
		}
		return super.renameSession(sessionId, title);
	}

	override cancelGeneration(sessionId: string, agentId?: string): boolean {
		if (this.isEngineConnected()) {
			return this.cancelEngineGeneration(sessionId, agentId, true);
		}
		if (this.wasEverConnected) {
			return this.cancelEngineGeneration(sessionId, agentId, false);
		}
		return super.cancelGeneration(sessionId, agentId);
	}

	override setSessionGoal(sessionId: string, goal: string): boolean {
		if (this.isEngineConnected()) {
			return this.setEngineSessionGoal(sessionId, goal, true);
		}
		if (this.wasEverConnected) {
			return this.setEngineSessionGoal(sessionId, goal, false);
		}
		return super.setSessionGoal(sessionId, goal);
	}

	override cancelSessionGoal(sessionId: string): boolean {
		if (this.isEngineConnected()) {
			return this.cancelEngineSessionGoal(sessionId, true);
		}
		if (this.wasEverConnected) {
			return this.cancelEngineSessionGoal(sessionId, false);
		}
		return super.cancelSessionGoal(sessionId);
	}

	override getSessionGoal(sessionId: string): string | undefined {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return this.sessionGoals.get(sessionId);
		}
		return super.getSessionGoal(sessionId);
	}

	override forkSubAgent(sessionId: string, options?: { name?: string; task?: string; parentAgentId?: string }): boolean {
		if (this.isEngineConnected()) {
			return this.forkEngineSubAgent(sessionId, options, true);
		}
		if (this.wasEverConnected) {
			return this.forkEngineSubAgent(sessionId, options, false);
		}
		return super.forkSubAgent(sessionId, options);
	}

	override killSubAgent(sessionId: string, options?: { agentId?: string; force?: boolean }): boolean {
		if (this.isEngineConnected()) {
			return this.killEngineSubAgent(sessionId, options, true);
		}
		if (this.wasEverConnected) {
			return this.killEngineSubAgent(sessionId, options, false);
		}
		return super.killSubAgent(sessionId, options);
	}

	override createSnapshot(sessionId: string, options?: { title?: string; description?: string }): boolean {
		if (this.isEngineConnected()) {
			return this.createEngineSnapshot(sessionId, options, true);
		}
		if (this.wasEverConnected) {
			return this.createEngineSnapshot(sessionId, options, false);
		}
		return super.createSnapshot(sessionId, options);
	}

	override cancelToolCall(sessionId: string, options: { toolCallId: string; agentId?: string }): boolean {
		if (this.isEngineConnected()) {
			return this.cancelEngineToolCall(sessionId, options, true);
		}
		if (this.wasEverConnected) {
			return this.cancelEngineToolCall(sessionId, options, false);
		}
		return super.cancelToolCall(sessionId, options);
	}

	override retryError(sessionId: string, options: { messageId: string; turnId?: string; agentId?: string }): boolean {
		if (this.isEngineConnected()) {
			return this.continueEngineGeneration(sessionId, options, true);
		}
		if (this.wasEverConnected) {
			return this.continueEngineGeneration(sessionId, options, false);
		}
		return super.retryError(sessionId, options);
	}

	override deleteTurn(sessionId: string, turnId: string): boolean {
		if (this.isEngineConnected()) {
			return this.deleteEngineMessage(sessionId, turnId, true);
		}
		if (this.wasEverConnected) {
			return this.deleteEngineMessage(sessionId, turnId, false);
		}
		return super.deleteTurn(sessionId, turnId);
	}

	override updateUserTurnText(sessionId: string, turnId: string, text: string): boolean {
		if (this.isEngineConnected()) {
			return this.editEngineMessage(sessionId, turnId, text, true);
		}
		if (this.wasEverConnected) {
			return this.editEngineMessage(sessionId, turnId, text, false);
		}
		return super.updateUserTurnText(sessionId, turnId, text);
	}

	override enqueueMessageQueueItem(sessionId: string, text: string, options?: { priority?: 'NORMAL' | 'HIGH' | 'LOW'; opId?: string }): boolean {
		if (this.isEngineConnected()) {
			return this.enqueueEngineQueueItem(sessionId, text, options, true);
		}
		if (this.wasEverConnected) {
			return this.enqueueEngineQueueItem(sessionId, text, options, false);
		}
		return super.enqueueMessageQueueItem(sessionId, text, options);
	}

	override retryMessageQueueItem(sessionId: string, itemId: string, options?: { upload?: boolean }): boolean {
		if (this.isEngineConnected()) {
			return this.retryEngineQueueItem(sessionId, itemId, options, true);
		}
		if (this.wasEverConnected) {
			return this.retryEngineQueueItem(sessionId, itemId, options, false);
		}
		return super.retryMessageQueueItem(sessionId, itemId, options);
	}

	override getMessageQueueState(sessionId: string): ConversationMessageQueueState {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return createEmptyMessageQueueState();
		}
		return super.getMessageQueueState(sessionId);
	}

	override setMessageQueueFixture(sessionId: string, state: ConversationMessageQueueState): void {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return;
		}
		super.setMessageQueueFixture(sessionId, state);
	}

	override getAutoDriveTasks(sessionId: string): readonly string[] {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return [];
		}
		return super.getAutoDriveTasks(sessionId);
	}

	override getAutoDriveTaskCount(sessionId: string): number {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return 0;
		}
		return super.getAutoDriveTaskCount(sessionId);
	}

	override setAutoDriveTaskFixture(sessionId: string, tasks: readonly string[]): void {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return;
		}
		super.setAutoDriveTaskFixture(sessionId, tasks);
	}

	override pauseMessageQueue(sessionId: string): void {
		if (this.isEngineConnected()) {
			this.forwardEngineQueueRef(sessionId, true, () => this.uaConnection.pauseQueue({ sessionId }));
			return;
		}
		if (!this.wasEverConnected) {
			super.pauseMessageQueue(sessionId);
		}
	}

	override resumeMessageQueue(sessionId: string): void {
		if (this.isEngineConnected()) {
			this.forwardEngineQueueRef(sessionId, true, () => this.uaConnection.resumeQueue({ sessionId }));
			return;
		}
		if (!this.wasEverConnected) {
			super.resumeMessageQueue(sessionId);
		}
	}

	override clearMessageQueue(sessionId: string): void {
		if (this.isEngineConnected()) {
			this.forwardEngineQueueRef(sessionId, true, () => this.uaConnection.clearQueue({ sessionId }));
			return;
		}
		if (!this.wasEverConnected) {
			super.clearMessageQueue(sessionId);
		}
	}

	override holdMessageQueueItem(sessionId: string, itemId: string, hold: ConversationQueueItemHoldReason): void {
		if (this.isEngineConnected()) {
			this.forwardEngineQueueItem(sessionId, itemId, true, id => this.uaConnection.holdQueueItem({
				sessionId,
				itemId: id,
				reason: hold,
			}));
			return;
		}
		if (!this.wasEverConnected) {
			super.holdMessageQueueItem(sessionId, itemId, hold);
		}
	}

	override releaseMessageQueueItemHold(sessionId: string, itemId: string): void {
		if (this.isEngineConnected()) {
			this.forwardEngineQueueItem(sessionId, itemId, true, id => this.uaConnection.releaseQueueItemHold({
				sessionId,
				itemId: id,
			}));
			return;
		}
		if (!this.wasEverConnected) {
			super.releaseMessageQueueItemHold(sessionId, itemId);
		}
	}

	override updateMessageQueueItemContent(sessionId: string, itemId: string, content: string): boolean {
		if (this.isEngineConnected()) {
			return this.editEngineQueueItem(sessionId, itemId, content, true);
		}
		if (this.wasEverConnected) {
			return false;
		}
		return super.updateMessageQueueItemContent(sessionId, itemId, content);
	}

	override resolveConfirmation(sessionId: string, turnId: string, status: 'allowed' | 'skipped'): boolean {
		if (this.isEngineConnected()) {
			return this.respondEnginePermission(sessionId, turnId, status, true);
		}
		if (this.wasEverConnected) {
			return this.respondEnginePermission(sessionId, turnId, status, false);
		}
		return super.resolveConfirmation(sessionId, turnId, status);
	}

	override respondClientTool(sessionId: string, callId: string, options?: { content?: string; isError?: boolean; metadataJson?: string }): boolean {
		if (this.isEngineConnected()) {
			return this.sendEngineClientToolResponse(sessionId, callId, options, true);
		}
		if (this.wasEverConnected) {
			return this.sendEngineClientToolResponse(sessionId, callId, options, false);
		}
		return super.respondClientTool(sessionId, callId, options);
	}

	override respondQuestion(sessionId: string, questionId: string, answers?: ConversationQuestionRespondAnswers, customText?: string): boolean {
		if (this.isEngineConnected()) {
			return this.respondEngineQuestion(sessionId, questionId, answers, customText, true);
		}
		if (this.wasEverConnected) {
			return this.respondEngineQuestion(sessionId, questionId, answers, customText, false);
		}
		return super.respondQuestion(sessionId, questionId, answers, customText);
	}

	override deleteSession(sessionId: string): boolean {
		if (this.isEngineConnected()) {
			return this.deleteEngineSession(sessionId, true);
		}
		if (this.wasEverConnected) {
			return this.deleteEngineSession(sessionId, false);
		}
		return super.deleteSession(sessionId);
	}

	override appendStubEchoAssistant(sessionId: string, text: string) {
		if (this.isEngineConnected()) {
			throw new Error('appendStubEchoAssistant is forbidden while the engine is connected');
		}
		return super.appendStubEchoAssistant(sessionId, text);
	}

	override hasEngineConnectionHistory(): boolean {
		return this.wasEverConnected;
	}

	override acquireSessionView(sessionId: string): IConversationSessionViewLease {
		if (this.isEngineConnected()) {
			if (isEngineRosterPlaceholderSessionId(sessionId)) {
				throw new Error(`acquireSessionView: session ${sessionId} is not engine-bound`);
			}
			const engineBound = this.engineSessions.some(session => session.id === sessionId);
			const pendingBind = sessionId === this.pendingEngineBindSessionId;
			if (!engineBound && !pendingBind) {
				throw new Error(`acquireSessionView: session ${sessionId} is not engine-bound`);
			}
			return this.engineFrameSource.acquire(sessionId);
		}
		return super.acquireSessionView(sessionId);
	}

	override getSessionSync(sessionId: string): SyncChrome {
		if (this.isEngineConnected()) {
			const projection = this.engineFrameSource.getCachedProjection(sessionId);
			if (projection) {
				return projection.snapshot.sync;
			}
			return { kind: 'idle' };
		}
		return super.getSessionSync(sessionId);
	}

	protected override shouldSkipLocalPersistence(): boolean {
		return this.wasEverConnected;
	}

	private allocateEngineBindClientSessionId(forceNew = false): string {
		if (forceNew) {
			this.pendingEngineBindClientSessionId = undefined;
		}
		if (!this.pendingEngineBindClientSessionId) {
			this.pendingEngineBindClientSessionId = allocateConversationStubSessionId();
		}
		return this.pendingEngineBindClientSessionId;
	}

	private clearPendingEngineBindClientSessionId(): void {
		this.pendingEngineBindClientSessionId = undefined;
	}

	private ensureEngineSession(): Promise<string | undefined> {
		if (this.engineSessionEnsure) {
			return this.engineSessionEnsure;
		}
		const clientSessionId = this.allocateEngineBindClientSessionId(true);
		this.pendingEngineBindSessionId = clientSessionId;
		this.engineSessionEnsure = Promise.resolve(clientSessionId);
		void this.engineSessionEnsure.finally(() => {
			this.engineSessionEnsure = undefined;
		});
		return this.engineSessionEnsure;
	}

	private adoptEngineSession(sessionId: string, title: string, options?: { skipBindLease?: boolean }): string {
		const existed = this.engineSessions.some(session => session.id === sessionId);
		if (!existed) {
			this.engineSessions = [...this.engineSessions, { id: sessionId, title, turns: [], source: 'engine-cache' }];
			this._onDidChangeSession.fire(sessionId);
		}
		this.listCompleted = true;
		this.activateEngineSession(sessionId);
		this.persistEngineAwareRoster();
		if (!options?.skipBindLease) {
			this.bindLiveTreeObservationLease();
		}
		return sessionId;
	}

	private activateEngineSession(sessionId: string): void {
		if (!sessionId || isEngineRosterPlaceholderSessionId(sessionId)) {
			if (sessionId === ENGINE_BIND_FAILED_SESSION_ID) {
				this.markEngineSessionBindFailed();
			}
			return;
		}
		const previous = this.activeEngineSessionId;
		this.activeEngineSessionId = sessionId;
		if (previous !== sessionId) {
			this._onDidChangeActiveSession.fire(sessionId);
		}
		if (this.isEngineConnected()) {
			this.uaConnection.requestAgentTreeRefresh(sessionId);
		}
	}

	private cancelEngineGeneration(sessionId: string, agentId: string | undefined, callRemote: boolean): boolean {
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		const resolved = agentId?.trim() || this.lastStreamingAgentId(sessionId) || 'root';
		if (callRemote) {
			void this.uaConnection.cancelGeneration({ sessionId, agentId: resolved });
			return true;
		}
		return false;
	}

	private setEngineSessionGoal(sessionId: string, goal: string, callRemote: boolean): boolean {
		const trimmed = goal.trim();
		if (!trimmed) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (this.sessionGoals.get(sessionId) === trimmed) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.setSessionGoal) {
				return false;
			}
			void this.uaConnection.setSessionGoal({ sessionId, goal: trimmed });
			this.sessionGoals.set(sessionId, trimmed);
			this._onDidChangeSession.fire(sessionId);
			return true;
		}
		return false;
	}

	private cancelEngineSessionGoal(sessionId: string, callRemote: boolean): boolean {
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.cancelSessionGoal) {
				return false;
			}
			void this.uaConnection.cancelSessionGoal({ sessionId });
			this.sessionGoals.delete(sessionId);
			this._onDidChangeSession.fire(sessionId);
			return true;
		}
		return false;
	}

	private forkEngineSubAgent(
		sessionId: string,
		options: { name?: string; task?: string; parentAgentId?: string } | undefined,
		callRemote: boolean,
	): boolean {
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.forkAgent) {
				return false;
			}
			const parentAgentId = options?.parentAgentId?.trim() || this.lastStreamingAgentId(sessionId) || 'root';
			const name = options?.name?.trim();
			const task = options?.task?.trim();
			void this.uaConnection.forkAgent({
				sessionId,
				parentAgentId,
				...(name ? { name } : {}),
				...(task ? { task } : {}),
			});
			return true;
		}
		return false;
	}

	private createEngineSnapshot(
		sessionId: string,
		options: { title?: string; description?: string } | undefined,
		callRemote: boolean,
	): boolean {
		if (!sessionId.trim()) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.createSnapshot) {
				return false;
			}
			const title = options?.title !== undefined
				? options.title
				: localize('conversationCreateSnapshotDefaultTitle', "Snapshot");
			const description = options?.description;
			void this.uaConnection.createSnapshot({
				sessionId,
				title,
				...(description !== undefined ? { description } : {}),
			});
			return true;
		}
		return false;
	}

	private killEngineSubAgent(
		sessionId: string,
		options: { agentId?: string; force?: boolean } | undefined,
		callRemote: boolean,
	): boolean {
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.killAgent) {
				return false;
			}
			const agentId = options?.agentId !== undefined
				? options.agentId.trim()
				: (this.lastStreamingAgentId(sessionId) ?? '');
			void this.uaConnection.killAgent({
				sessionId,
				agentId,
				...(options?.force === true ? { force: true } : {}),
			});
			return true;
		}
		return false;
	}

	private sendEngineClientToolResponse(
		sessionId: string,
		callId: string,
		options: { content?: string; isError?: boolean; metadataJson?: string } | undefined,
		callRemote: boolean,
	): boolean {
		const trimmedCallId = callId.trim();
		if (!trimmedCallId) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.sendClientToolResponse) {
				return false;
			}
			const content = options?.content;
			const metadataJson = options?.metadataJson;
			void this.uaConnection.sendClientToolResponse({
				sessionId,
				callId: trimmedCallId,
				...(options?.isError === true ? { isError: true } : {}),
				...(content !== undefined ? { content } : {}),
				...(metadataJson !== undefined ? { metadataJson } : {}),
			});
			return true;
		}
		return false;
	}

	private respondEnginePermission(
		sessionId: string,
		turnId: string,
		status: 'allowed' | 'skipped',
		callRemote: boolean,
	): boolean {
		const requestId = turnId.trim();
		if (!requestId) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.respondPermission) {
				return false;
			}
			void this.uaConnection.respondPermission({
				sessionId,
				requestId,
				granted: status === 'allowed',
			});
			return true;
		}
		return false;
	}

	private respondEngineQuestion(
		sessionId: string,
		questionId: string,
		answers: ConversationQuestionRespondAnswers | undefined,
		customText: string | undefined,
		callRemote: boolean,
	): boolean {
		const trimmedQuestionId = questionId.trim();
		if (!trimmedQuestionId) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.respondQuestion) {
				return false;
			}
			void this.uaConnection.respondQuestion({
				sessionId,
				questionId: trimmedQuestionId,
				...(answers !== undefined ? { answers } : {}),
				...(customText !== undefined ? { customText } : {}),
			});
			return true;
		}
		return false;
	}

	private deleteEngineMessage(sessionId: string, turnId: string, callRemote: boolean): boolean {
		const trimmedTurnId = turnId.trim();
		if (!trimmedTurnId) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.deleteMessage) {
				return false;
			}
			const agentId = this.lastStreamingAgentId(sessionId) || 'root';
			void this.uaConnection.deleteMessage({ sessionId, turnId: trimmedTurnId, agentId });
			return true;
		}
		return false;
	}

	private cancelEngineToolCall(
		sessionId: string,
		options: { toolCallId: string; agentId?: string },
		callRemote: boolean,
	): boolean {
		const toolCallId = options.toolCallId.trim();
		if (!toolCallId) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.cancelToolCall) {
				return false;
			}
			const agentId = options.agentId?.trim() || this.lastStreamingAgentId(sessionId) || 'root';
			void this.uaConnection.cancelToolCall({ sessionId, agentId, toolCallId });
			return true;
		}
		return false;
	}

	private continueEngineGeneration(
		sessionId: string,
		options: { messageId: string; turnId?: string; agentId?: string },
		callRemote: boolean,
	): boolean {
		const messageId = options.messageId.trim();
		const turnId = (options.turnId ?? options.messageId).trim();
		if (!messageId || !turnId) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			const agentId = options.agentId?.trim() || this.lastStreamingAgentId(sessionId) || 'root';
			const pending = this.engineFrameSource.postIfHeld(sessionId, {
				kind: 'continueGeneration',
				agentId,
				turnId,
				messageId,
			});
			if (!pending) {
				return false;
			}
			void pending;
			return true;
		}
		return false;
	}

	private forwardEngineQueueRef(sessionId: string, callRemote: boolean, send: () => void): boolean {
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			send();
			this._onDidChangeSession.fire(sessionId);
			return true;
		}
		return false;
	}

	private forwardEngineQueueItem(sessionId: string, itemId: string, callRemote: boolean, send: (itemId: string) => void): boolean {
		const trimmedId = itemId.trim();
		if (!trimmedId) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			send(trimmedId);
			this._onDidChangeSession.fire(sessionId);
			return true;
		}
		return false;
	}

	private enqueueEngineQueueItem(
		sessionId: string,
		text: string,
		options: { priority?: 'NORMAL' | 'HIGH' | 'LOW'; opId?: string } | undefined,
		callRemote: boolean,
	): boolean {
		const trimmed = text.trim();
		if (!trimmed) {
			return false;
		}
		const opId = options?.opId?.trim();
		return this.forwardEngineQueueRef(sessionId, callRemote, () => this.uaConnection.enqueueQueueItem({
			sessionId,
			text: trimmed,
			...(options?.priority ? { priority: options.priority } : {}),
			...(opId ? { opId } : {}),
		}));
	}

	private editEngineQueueItem(sessionId: string, itemId: string, content: string, callRemote: boolean): boolean {
		const trimmed = content.trim();
		if (!trimmed) {
			return false;
		}
		return this.forwardEngineQueueItem(sessionId, itemId, callRemote, id => this.uaConnection.editQueueItem({
			sessionId,
			itemId: id,
			text: trimmed,
		}));
	}

	private retryEngineQueueItem(
		sessionId: string,
		itemId: string,
		options: { upload?: boolean } | undefined,
		callRemote: boolean,
	): boolean {
		const trimmedId = itemId.trim();
		if (!trimmedId) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (options?.upload === true) {
				if (!this.uaConnection.retryQueueItemUpload) {
					return false;
				}
				void this.uaConnection.retryQueueItemUpload({
					sessionId,
					itemId: trimmedId,
				});
			} else {
				if (!this.uaConnection.retryQueueItem) {
					return false;
				}
				void this.uaConnection.retryQueueItem({
					sessionId,
					itemId: trimmedId,
				});
			}
			this._onDidChangeSession.fire(sessionId);
			return true;
		}
		return false;
	}

	private editEngineMessage(sessionId: string, turnId: string, text: string, callRemote: boolean): boolean {
		const trimmedTurnId = turnId.trim();
		const trimmedText = text.trim();
		if (!trimmedTurnId || !trimmedText) {
			return false;
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.editMessage) {
				return false;
			}
			const agentId = this.lastStreamingAgentId(sessionId) || 'root';
			void this.uaConnection.editMessage({
				sessionId,
				turnId: trimmedTurnId,
				newContent: trimmedText,
				agentId,
			});
			return true;
		}
		return false;
	}

	private lastStreamingAgentId(sessionId: string): string | undefined {
		const turns = this.getTurns(sessionId);
		for (let i = turns.length - 1; i >= 0; i--) {
			const turn = turns[i];
			if (turn?.streaming) {
				const id = turn.agentId?.trim();
				if (id) {
					return id;
				}
			}
		}
		return undefined;
	}

	private renameEngineSession(sessionId: string, title: string, callRemote: boolean): boolean {
		const trimmed = title.trim();
		if (!trimmed) {
			return false;
		}
		const session = this.engineSessions.find(s => s.id === sessionId);
		if (!session || session.title === trimmed) {
			return false;
		}
		session.title = trimmed;
		if (callRemote) {
			void this.uaConnection.renameSession({ sessionId, title: trimmed });
		}
		this._onDidChangeSession.fire(sessionId);
		this.persistEngineAwareRoster();
		return true;
	}

	private deleteEngineSession(sessionId: string, callRemote: boolean): boolean {
		const index = this.engineSessions.findIndex(s => s.id === sessionId);
		if (index < 0) {
			return false;
		}
		const wasActive = this.getActiveSessionId() === sessionId;
		this.engineSessions = this.engineSessions.filter(s => s.id !== sessionId);
		this.sessionGoals.delete(sessionId);
		if (callRemote) {
			void this.uaConnection.deleteSession({ sessionId });
		}
		if (this.engineSessions.length === 0) {
			// Honest empty — no stub seed refill (m6 §6 / M6-A2).
			this.listCompleted = true;
			if (this.isEngineConnected()) {
				this.markEngineSessionBindFailed();
			} else {
				this.activeEngineSessionId = undefined;
			}
		} else if (wasActive) {
			const newIndex = Math.min(index, this.engineSessions.length - 1);
			const nextId = this.engineSessions[newIndex]!.id;
			this.activeEngineSessionId = nextId;
			this._onDidChangeActiveSession.fire(nextId);
		}
		this._onDidChangeSession.fire(sessionId);
		this.persistEngineAwareRoster();
		return true;
	}

	private onUaConnectionChanged(): void {
		const connected = this.isEngineConnected();
		if (connected) {
			this.wasEverConnected = true;
			this.testEngineConnected = undefined;
			super.setEngineConnected(true);
			void this.refreshEngineCatalog();
		} else {
			this.captureEngineCache();
			this.listCompleted = this.engineSessions.length > 0;
			if (this.testEngineConnected === undefined) {
				super.setEngineConnected(false);
			}
		}
		this.bindLiveTreeObservationLease();
	}

	private bindLiveTreeObservationLease(): void {
		if (this._store.isDisposed || this.suppressBindLiveTreeObservationLease) {
			return;
		}
		if (!this.isEngineConnected()) {
			return;
		}
		const sessionId = this.pendingEngineBindSessionId || this.getActiveSessionId();
		if (!sessionId || isEngineRosterPlaceholderSessionId(sessionId)) {
			return;
		}
		const rosterReady = this.isEngineSessionReady();
		const pendingBind = sessionId === this.pendingEngineBindSessionId;
		if (!rosterReady && !pendingBind) {
			return;
		}
		if (pendingBind && this.activePendingBindLeaseSessionId === sessionId) {
			return;
		}
		this.liveTreeObservationStore.clear();
		this.listedBindMonitorGeneration++;
		if (pendingBind) {
			this.activePendingBindLeaseSessionId = sessionId;
		} else {
			this.activePendingBindLeaseSessionId = undefined;
		}
		const lease = this.acquireSessionView(sessionId);
		this.liveTreeObservationStore.add(lease);
		this.liveTreeObservationStore.add(lease.onDidApplyFrame(() => this.emitLiveAgentTreeFromLease(lease)));
		this.emitLiveAgentTreeFromLease(lease);
		if (pendingBind) {
			void this.monitorPendingEngineSessionBind(sessionId, lease);
		} else {
			void this.monitorListedEngineSessionBind(sessionId, lease, this.listedBindMonitorGeneration);
		}
	}

	private async monitorListedEngineSessionBind(sessionId: string, lease: IConversationSessionViewLease, generation: number): Promise<void> {
		const bindReady = this.engineFrameSource.whenLeaseBindReady(lease);
		if (!bindReady) {
			return;
		}
		const ok = await bindReady;
		if (generation !== this.listedBindMonitorGeneration) {
			return;
		}
		if (sessionId !== this.getActiveSessionId() || this.pendingEngineBindSessionId) {
			return;
		}
		if (ok) {
			this.engineBoundSessionIds.add(sessionId);
			return;
		}
		if (this.engineBoundSessionIds.size > 0) {
			return;
		}
		this.markEngineSessionBindFailed();
		this._onDidChangeSession.fire(this.getActiveSessionId());
		this.persistEngineAwareRoster();
	}

	private async monitorPendingEngineSessionBind(sessionId: string, lease: IConversationSessionViewLease): Promise<void> {
		const bindReady = this.engineFrameSource.whenLeaseBindReady(lease);
		if (!bindReady) {
			return;
		}
		const ok = await bindReady;
		if (sessionId !== this.pendingEngineBindSessionId) {
			return;
		}
		this.pendingEngineBindSessionId = undefined;
		this.activePendingBindLeaseSessionId = undefined;
		this.engineSessionEnsure = undefined;
		this.clearPendingEngineBindClientSessionId();
		if (ok) {
			this.engineBoundSessionIds.add(sessionId);
			const title = localize('conversationLens.sessionNew', "New session");
			this.suppressBindLiveTreeObservationLease = true;
			try {
				this.adoptEngineSession(sessionId, title, { skipBindLease: true });
			} finally {
				this.suppressBindLiveTreeObservationLease = false;
			}
			return;
		}
		if (this.engineBoundSessionIds.size === 0) {
			if (this.engineSessions.length === 0) {
				this.markEngineSessionBindFailed();
			} else {
				const activeId = this.getActiveSessionId();
				if (!activeId || !this.engineSessions.some(session => session.id === activeId) || activeId === sessionId) {
					this.activateEngineSession(this.engineSessions[0]!.id);
				}
			}
		} else {
			const activeId = this.getActiveSessionId();
			const fallback = this.engineSessions.find(session => this.engineBoundSessionIds.has(session.id))?.id
				?? [...this.engineBoundSessionIds][0];
			if (fallback && (!activeId || !this.engineBoundSessionIds.has(activeId) || activeId === sessionId)) {
				this.activateEngineSession(fallback);
			}
		}
		this._onDidChangeSession.fire(this.getActiveSessionId());
		this.persistEngineAwareRoster();
	}

	private emitLiveAgentTreeFromLease(lease: IConversationSessionViewLease): void {
		const tree = lease.snapshot.liveAgentTree;
		if (tree) {
			this._onDidChangeLiveAgentTree.fire({ sessionId: lease.sessionId, tree });
		}
	}

	/** @internal Await the in-flight engine catalog refresh (tests). */
	whenEngineCatalogRefreshComplete(): Promise<void> {
		return this.refreshEngineCatalogInflight ?? Promise.resolve();
	}

	private refreshEngineCatalog(): Promise<void> {
		if (this.refreshEngineCatalogInflight) {
			return this.refreshEngineCatalogInflight;
		}
		this.refreshEngineCatalogInflight = this.doRefreshEngineCatalog().finally(() => {
			this.refreshEngineCatalogInflight = undefined;
		});
		return this.refreshEngineCatalogInflight;
	}

	private async doRefreshEngineCatalog(): Promise<void> {
		this.listCompleted = false;
		this.engineSessionBindFailed = false;
		this.engineBoundSessionIds.clear();
		this.clearPendingEngineBindClientSessionId();
		try {
			const result = await this.uaConnection.listSessions({});
			this.engineSessions = result.sessions
				.filter(s => s.sessionId && !STUB_SEED_IDS.has(s.sessionId))
				.map(s => ({
					id: s.sessionId,
					title: s.title ?? localize('conversationLens.sessionUntitled', "Untitled session"),
					turns: [],
					source: 'engine-cache' as const,
				}));
			this.listCompleted = true;
			if (this.activeEngineSessionId && !this.engineSessions.some(s => s.id === this.activeEngineSessionId)) {
				this.activeEngineSessionId = undefined;
			}
			if (this.engineSessions.length > 0) {
				const targetId = this.activeEngineSessionId && this.engineSessions.some(s => s.id === this.activeEngineSessionId)
					? this.activeEngineSessionId
					: this.engineSessions[0]!.id;
				this.activateEngineSession(targetId);
			} else {
				await this.ensureEngineSession();
			}
			this._onDidChangeSession.fire(this.getActiveSessionId());
			this.persistEngineAwareRoster();
		} catch {
			this.pendingEngineBindSessionId = undefined;
			this.activePendingBindLeaseSessionId = undefined;
			this.engineSessionEnsure = undefined;
			this.listCompleted = true;
			this.markEngineSessionBindFailed();
			this._onDidChangeSession.fire(this.getActiveSessionId());
			this.persistEngineAwareRoster();
		} finally {
			this.bindLiveTreeObservationLease();
		}
	}

	private restoreEngineCacheFromStorage(): void {
		const cache = this.loadedStorage?.engineCache;
		if (!this.loadedStorage?.wasEverConnected || !cache || cache.sessions.length === 0) {
			return;
		}
		this.wasEverConnected = true;
		this.engineSessions = cache.sessions.map(session => ({
			id: session.id,
			title: session.title,
			turns: session.turns.map(turn => ({ ...turn })),
			source: 'engine-cache' as const,
		}));
		const restoreLast = shouldRestoreLastSessionOnStartup(this.configurationService);
		this.activeEngineSessionId = restoreLast && cache.activeSessionId && this.engineSessions.some(session => session.id === cache.activeSessionId)
			? cache.activeSessionId
			: this.engineSessions[0]?.id;
		// Cache is for disconnect display only — bind waits for engine List reconciliation.
		this.listCompleted = false;
		for (const session of this.engineSessions) {
			this.model.upsertCachedSession(session);
		}
	}

	private captureEngineCache(): void {
		if (!this.storageService || this.engineSessions.length === 0) {
			this.persistEngineAwareRoster(this.wasEverConnected);
			return;
		}
		const sessions: PersistedConversationSession[] = this.engineSessions.map(session => {
			const projection = this.engineFrameSource.getCachedProjection(session.id);
			const turns = projection
				? entriesToLegacyTurns(projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details))
				: session.turns;
			const cached: ConversationStubSession = {
				id: session.id,
				title: session.title,
				turns: [...turns],
				source: 'engine-cache',
			};
			this.model.upsertCachedSession(cached);
			return {
				id: cached.id,
				title: cached.title,
				turns: cached.turns,
				source: 'engine-cache' as const,
			};
		});
		this.engineSessions = sessions.map(session => ({
			id: session.id,
			title: session.title,
			turns: session.turns.map(turn => ({ ...turn })),
			source: 'engine-cache',
		}));
		this.persistEngineAwareRoster(true, {
			activeSessionId: isEngineRosterPlaceholderSessionId(this.activeEngineSessionId)
				? undefined
				: this.activeEngineSessionId,
			sessions,
		});
	}

	private resolvePersistedActiveSessionId(): string {
		const raw = this.wasEverConnected
			? (this.activeEngineSessionId ?? super.getActiveSessionId())
			: this.model.getActiveSessionId();
		if (isEngineRosterPlaceholderSessionId(raw)) {
			const cached = this.engineSessions[0]?.id ?? super.getActiveSessionId();
			return isEngineRosterPlaceholderSessionId(cached) ? super.getActiveSessionId() : cached;
		}
		return raw;
	}

	private persistEngineAwareRoster(
		wasEverConnected = this.wasEverConnected,
		engineCache?: ConversationRosterEngineCache,
	): void {
		if (!this.storageService) {
			return;
		}
		const resolvedEngineCache = engineCache ?? this.buildPersistedEngineCache();
		this.saveRosterStorage({
			version: 1,
			wasEverConnected,
			activeSessionId: this.resolvePersistedActiveSessionId(),
			nextTurnId: getConversationStubNextTurnId(),
			localSessions: buildLocalSessionsFromModel(this.model),
			engineCache: resolvedEngineCache,
		});
	}

	private buildPersistedEngineCache(): ConversationRosterEngineCache | undefined {
		if (this.engineSessions.length === 0) {
			return loadConversationRosterStorage(this.storageService!)?.engineCache;
		}
		const activeSessionId = isEngineRosterPlaceholderSessionId(this.activeEngineSessionId)
			? undefined
			: this.activeEngineSessionId;
		return {
			activeSessionId,
			sessions: this.engineSessions.map(session => {
				const projection = this.engineFrameSource.getCachedProjection(session.id);
				const turns = projection
					? entriesToLegacyTurns(projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details))
					: session.turns;
				return {
					id: session.id,
					title: session.title,
					turns: turns.map(turn => ({ ...turn })),
					source: 'engine-cache' as const,
				};
			}),
		};
	}
}
