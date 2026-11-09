/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConversationEngineQueueReader } from './conversationEngineQueueReader.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { toErrorMessage } from '../../../../base/common/errorMessage.js';
import type { ConversationResponseKind } from '../../../../platform/universeAgent/common/conversationResponseState.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { shouldRestoreLastSessionOnStartup } from '../common/uaClientSettingsHelpers.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { captureConversationDeleteOwner, guardConversationDeleteConfirmation, sameConversationDeleteOwner } from './conversationDeleteSessionConfirm.js';
import { isConversationEngineLive, isConversationPairingHold, shouldKeepLiveTreeLeaseWhilePairing, shouldRebindLiveTreeLeaseWhilePairing } from './conversationSessionStatus.js';
import { IUniverseAgentSessionView } from '../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type { ConversationQuestionRespondAnswers, IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationEngineFrameSource } from './conversationEngineFrameSource.js';
import { IUaClientWorkspaceToolsGate } from './uaClientWorkspaceToolsGate.js';
import {
	buildLocalSessionsFromModel,
	engineIdentityKey,
	loadConversationRosterStorage,
	selectEngineCache,
	withEngineCache,
	type ConversationRosterEngineCache,
	type ConversationRosterStorageV1,
	type ConversationSessionSource,
	type PersistedConversationSession,
} from './conversationRosterStorage.js';
import type { ConversationStubTurnCatalogLookup } from './rewriteConversationStubTurnSessionLinks.js';
import type { SessionViewSnapshot, ViewPatch, SyncChrome } from '../../../../platform/universeAgent/common/sessionView/types.js';
import { clientToolRespondCleanupPatches, permissionRespondCleanupPatches, questionRespondCleanupPatches } from '../../../../platform/universeAgent/common/sessionView/respond-cleanup.js';
import { projectSnapshotToTrajectory, projectTurnsToTrajectory, type ConversationTrajectoryRecord, type TrajectoryProjectionOptions } from './conversationTrajectoryModel.js';
import {
	ConversationStubService,
	copyConversationDeleteOwner,
	IConversationRosterService,
	type ConversationDeleteOwner,
	type ConversationQueueMutationDispatch,
	type IConversationEngineActionFailure,
	type ILiveAgentTreeChangeEvent,
} from './conversationStubService.js';
import {
	type ConversationMessageQueueState,
	type ConversationQueueItemHoldReason,
} from './conversationMessageQueueModel.js';
import { isPendingAttentionAction } from './conversationPendingSeat.js';
import { projectSnapshotToEntries } from './conversationSessionView.js';
import { orderSessionsForRoster } from './conversationSessionsViewStrings.js';
import { isConversationRowStreaming } from './conversationLivePhase.js';
import { allocateConversationStubSessionId, ConversationStubSession, ConversationStubTurn, getConversationStubNextTurnId } from './conversationStubModel.js';
import type { ConversationSessionReadiness } from './conversationSessionAvailability.js';

const STUB_SEED_IDS = new Set(['untitled', 'visualize']);
/** Placeholder roster row when connected but no engine session could be bound. */
export const ENGINE_BIND_FAILED_SESSION_ID = '__engine_bind_failed__';

interface EngineSessionDeleteSnapshot {
	readonly session: ConversationStubSession;
	readonly index: number;
	readonly previousGoal: string | undefined;
	readonly previousActiveId: string | undefined;
	readonly previousListCompleted: boolean;
	readonly previousBindFailed: boolean;
}

/**
 * Which backend a roster write goes to. Order is fixed: pairing hold, leftover
 * list failure, connected, cached disconnect, then stub. Each write keeps its
 * own return value per branch.
 */
type RosterWriteRoute = 'pairingHold' | 'leftoverListFail' | 'connected' | 'cachedDisconnect' | 'stub';

export function isEngineRosterPlaceholderSessionId(sessionId: string | undefined): boolean {
	return !!sessionId && (sessionId === ENGINE_BIND_FAILED_SESSION_ID || STUB_SEED_IDS.has(sessionId));
}

/**
 * Engine-backed roster (M6-A2): same token as stub; switches frame source and
 * session catalog when UA is connected.
 */
export class ConversationEngineRosterService extends Disposable implements IConversationRosterService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeActiveSession = this._register(new Emitter<string>());
	readonly onDidChangeActiveSession = this._onDidChangeActiveSession.event;
	private readonly _onDidChangeSession = this._register(new Emitter<string>());
	readonly onDidChangeSession = this._onDidChangeSession.event;
	private readonly _onDidDeleteSession = this._register(new Emitter<string>());
	readonly onDidDeleteSession = this._onDidDeleteSession.event;
	private readonly _onDidChangeEngineConnection = this._register(new Emitter<boolean>());
	readonly onDidChangeEngineConnection = this._onDidChangeEngineConnection.event;
	/** Never-connected backend; its own events reach subscribers only through the forwards in the constructor. */
	private readonly stub: ConversationStubService;

	private readonly queueReader: ConversationEngineQueueReader;
	private queueBoundLease: IConversationSessionViewLease | undefined;
	private readonly engineFrameSource: ConversationEngineFrameSource;
	private readonly liveTreeObservationStore = this._register(new DisposableStore());
	private liveTreeObservationLease: IConversationSessionViewLease | undefined;
	protected readonly _onDidChangeLiveAgentTree = this._register(new Emitter<ILiveAgentTreeChangeEvent>());
	readonly onDidChangeLiveAgentTree = this._onDidChangeLiveAgentTree.event;
	private readonly _onDidChangeSessionRosterDetail = this._register(new Emitter<string>());
	readonly onDidChangeSessionRosterDetail = this._onDidChangeSessionRosterDetail.event;
	/** Last published subtitle key (`turnCount:pending`) per session. */
	private readonly rosterDetailKeys = new Map<string, string>();
	private readonly _onDidFailEngineAction = this._register(new Emitter<IConversationEngineActionFailure>());
	readonly onDidFailEngineAction = this._onDidFailEngineAction.event;
	private readonly _onDidPruneEngineSessions = this._register(new Emitter<readonly string[]>());
	readonly onDidPruneEngineSessions = this._onDidPruneEngineSessions.event;
	private lastDispatchedEngineAction: Promise<boolean> | undefined;
	private readonly deleteScopes = this._register(new DisposableStore());
	private engineSessions: ConversationStubSession[] = [];
	private activeEngineSessionId: string | undefined;
	private listCompleted = false;
	private engineSessionEnsure: Promise<string | undefined> | undefined;
	private refreshEngineCatalogInflight: Promise<void> | undefined;
	private refreshEngineCatalogGeneration = 0;
	private connectionGeneration = 0;
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
	/**
	 * Roster cache bucket key for in-memory engine sessions.
	 * Tracks published identity while connected; on disconnect keeps the last displayed identity for read-only cache only.
	 */
	private boundEngineIdentityId: string | undefined;
	/** Cache ownership changes may synchronously notify response consumers. */
	private responseWriteTransitions = 0;
	private testEngineConnected: boolean | undefined;
	private readonly sessionGoals = new Map<string, string>();

	constructor(
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IUniverseAgentSessionView sessionView: IUniverseAgentSessionView,
		@IUaClientWorkspaceToolsGate private readonly workspaceToolsGate: IUaClientWorkspaceToolsGate,
		@IStorageService private readonly storageService?: IStorageService,
		@IConfigurationService private readonly configurationService?: IConfigurationService,
	) {
		super();
		this.stub = this._register(new ConversationStubService(storageService, configurationService, () => this.wasEverConnected));
		this._register(this.stub.onDidChangeActiveSession(sessionId => this._onDidChangeActiveSession.fire(sessionId)));
		this._register(this.stub.onDidChangeSession(sessionId => this._onDidChangeSession.fire(sessionId)));
		this._register(this.stub.onDidDeleteSession(sessionId => this._onDidDeleteSession.fire(sessionId)));
		this._register(this.stub.onDidChangeEngineConnection(connected => this._onDidChangeEngineConnection.fire(connected)));
		this.engineFrameSource = this._register(new ConversationEngineFrameSource(sessionView));
		this.queueReader = this._register(new ConversationEngineQueueReader(
			engineSessionId => this.uaConnection.getQueue!({ sessionId: engineSessionId }),
			sessionId => this._onDidChangeSession.fire(sessionId),
		));
		const snapshot = uaConnection.getConnectionSnapshot();
		const published = readPublishedEngineIdentityId(snapshot);
		if (published !== undefined) {
			this.boundEngineIdentityId = published;
		} else if (!isConversationEngineLive(uaConnection.getConnectionPhase(), snapshot.pairingPending)) {
			this.boundEngineIdentityId = engineIdentityKey(this.stub.loadedStorage?.lastDisplayedEngineIdentityId);
		} else {
			this.boundEngineIdentityId = undefined;
		}
		this.restoreEngineCacheFromStorage();
		this._register(uaConnection.onDidChangeConnection(() => this.onUaConnectionChanged()));
		this._register(this.onDidChangeActiveSession(() => this.bindLiveTreeObservationLease()));
		this._register(this.onDidChangeEngineConnection(() => this.bindLiveTreeObservationLease()));
		this.bindLiveTreeObservationLease();
		// Delayed singleton: the desktop channel may already be Loopback before
		// this service exists, and that snapshot is not replayed.
		if (this.isEngineConnected()) {
			this.onUaConnectionChanged();
		}
	}

	isEngineConnected(): boolean {
		if (this.testEngineConnected !== undefined) {
			return this.testEngineConnected;
		}
		const snapshot = this.uaConnection.getConnectionSnapshot();
		return isConversationEngineLive(this.uaConnection.getConnectionPhase(), snapshot.pairingPending);
	}

	/**
	 * D374 leftover-looks-live: pairing-hold first. `isEngineConnected()===true`
	 * + pairingPending / `isConversationPairingHold` is not live KEEP-chrome.
	 */
	private isEngineLiveChrome(): boolean {
		return this.isEngineConnected() && !isConversationPairingHold(this.uaConnection);
	}

	getEngineSessionReadiness(): ConversationSessionReadiness {
		if (!this.isEngineConnected()) {
			return 'ready';
		}
		if (this.engineSessionBindFailed) {
			return 'unavailable';
		}
		if (!this.listCompleted || this.pendingEngineBindSessionId) {
			return 'loading';
		}
		const sessionId = this.getActiveSessionId();
		if (!sessionId || isEngineRosterPlaceholderSessionId(sessionId)) {
			return 'unavailable';
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return 'unavailable';
		}
		return 'ready';
	}

	isEngineSessionReady(): boolean {
		return this.getEngineSessionReadiness() === 'ready';
	}

	private isEngineSessionBindFailed(): boolean {
		return this.isEngineConnected()
			&& this.listCompleted
			&& !this.pendingEngineBindSessionId
			&& this.engineSessionBindFailed;
	}

	/** List-fail leftover KEEP (D447): last-good rows stay; first-pull empty still uses the bind-failed placeholder. */
	private hasLeftoverEngineCatalogListFailed(): boolean {
		return this.isEngineSessionBindFailed() && this.engineSessions.length > 0;
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
		return this.isEngineLiveChrome() && this.workspaceToolsGate.shouldAdvertise();
	}

	setEngineConnected(connected: boolean): void {
		const wasConnected = this.isEngineConnected();
		// Close the public write gate before any cache or scope notification.
		this.testEngineConnected = connected;
		if (!connected) {
			this.connectionGeneration++;
			if (wasConnected) {
				this.captureEngineCache();
			}
		}
		this.stub.setEngineConnected(connected);
		if (!connected) {
			this.engineFrameSource.resetResponseScopes();
		}
		if (connected) {
			if (this.isEngineLiveChrome()) {
				this.wasEverConnected = true;
			}
			if (!this.shouldAdvertiseClientWorkspaceTools()) {
				// Workspace-tool advertisement withheld by ua.client.clientTools.advertiseWorkspaceTools.
			}
			void this.refreshEngineCatalog().catch(onUnexpectedError);
		} else {
			this.listCompleted = this.engineSessions.length > 0;
		}
		this.bindLiveTreeObservationLease();
	}

	getSessions(): readonly ConversationStubSession[] {
		if (this.isEngineConnected()) {
			if (!this.listCompleted) {
				// In-flight refresh: last-good leftover stays visible. First pull (no leftover) stays [].
				return this.engineSessions.length > 0 ? this.engineSessions : [];
			}
			if (this.isEngineSessionBindFailed()) {
				return this.hasLeftoverEngineCatalogListFailed()
					? this.engineSessions
					: [this.getEngineBindFailedSession()];
			}
			return this.engineSessions;
		}
		if (this.wasEverConnected) {
			return this.engineSessions;
		}
		return this.stub.getSessions();
	}

	getActiveSession(): ConversationStubSession {
		if (this.isEngineSessionBindFailed()) {
			if (this.hasLeftoverEngineCatalogListFailed()) {
				const sessionId = this.activeEngineSessionId;
				return this.engineSessions.find(session => session.id === sessionId)
					?? this.engineSessions[0]!;
			}
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
		return this.stub.getActiveSession();
	}

	getActiveSessionId(): string {
		if (this.isEngineConnected()) {
			if (!this.listCompleted) {
				return this.activeEngineSessionId ?? '';
			}
			if (this.isEngineSessionBindFailed()) {
				if (this.hasLeftoverEngineCatalogListFailed()) {
					if (this.activeEngineSessionId && this.engineSessions.some(s => s.id === this.activeEngineSessionId)) {
						return this.activeEngineSessionId;
					}
					return this.engineSessions[0]!.id;
				}
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
		return this.stub.getActiveSessionId();
	}

	getTrajectoryRecords(sessionId: string, options?: TrajectoryProjectionOptions): readonly ConversationTrajectoryRecord[] {
		if ((this.isEngineConnected() || this.wasEverConnected) && this.engineSessions.some(session => session.id === sessionId)) {
			if (this.canReadCachedEngineProjection()) {
				const projection = this.engineFrameSource.getCachedProjection(sessionId);
				if (projection) {
					return this.stub.rewriteTrajectoryMessageLinks(
						projectSnapshotToTrajectory(projection.snapshot, projection.attribution, projection.details, options),
					);
				}
			}
			return projectTurnsToTrajectory(this.getTurns(sessionId));
		}
		return this.stub.getTrajectoryRecords(sessionId, options);
	}

	getTurns(sessionId: string): readonly ConversationStubTurn[] {
		// Seed ids are placeholders only once an engine roster exists. While never
		// connected, `untitled` / `visualize` are the local sessions and must keep
		// their turns — otherwise the reading column stays PreFirst and hides them.
		if (sessionId === ENGINE_BIND_FAILED_SESSION_ID) {
			return [];
		}
		if ((this.isEngineConnected() || this.wasEverConnected) && isEngineRosterPlaceholderSessionId(sessionId)) {
			return [];
		}
		// Roster rows are the offline disconnect cache: `rememberObservedProjection`
		// copies them on lease rebind and `doRefreshEngineCatalog` carries them
		// across a re-list, so an inactive session (lease already released) stays
		// readable after the engine drops. The live projection stays gated by
		// {@link canReadCachedEngineProjection} (D287–D291): while it is still
		// held, the captured model/persisted cache is the authority and this
		// method must fall through to it instead of serving the raw projection.
		if ((this.canReadCachedEngineProjection() || this.wasEverConnected) && this.engineSessions.some(session => session.id === sessionId)) {
			if (this.canReadCachedEngineProjection()) {
				const projection = this.engineFrameSource.getCachedProjection(sessionId);
				if (projection) {
					return this.stub.projectSnapshotToLegacyTurns(projection.snapshot, projection.attribution, projection.details);
				}
				return this.engineSessions.find(session => session.id === sessionId)?.turns ?? [];
			}
			if (!this.engineFrameSource.getCachedProjection(sessionId)) {
				return this.engineSessions.find(session => session.id === sessionId)?.turns ?? [];
			}
		}
		return this.stub.getTurns(sessionId);
	}

	/** D287–D289/D291: leftover cached projection stays readable while pairing-hold; true disconnect does not. */
	private canReadCachedEngineProjection(): boolean {
		return this.isEngineConnected() || isConversationPairingHold(this.uaConnection);
	}

	switchSession(sessionId: string): void {
		if (isConversationPairingHold(this.uaConnection)) {
			if (this.engineSessions.some(s => s.id === sessionId)) {
				const previous = this.getActiveSessionId();
				this.activeEngineSessionId = sessionId;
				if (previous !== sessionId) {
					this._onDidChangeActiveSession.fire(sessionId);
				}
				this.persistEngineAwareRoster();
			}
			return;
		}
		if ((this.isEngineConnected() || this.wasEverConnected) && this.engineSessions.some(s => s.id === sessionId)) {
			const previous = this.getActiveSessionId();
			this.activeEngineSessionId = sessionId;
			if (previous !== sessionId) {
				this._onDidChangeActiveSession.fire(sessionId);
			}
			if (this.isEngineConnected() && !this.engineSessionBindFailed) {
				this.uaConnection.requestAgentTreeRefresh(sessionId);
			}
			this.persistEngineAwareRoster();
			return;
		}
		if (!this.isEngineConnected() && !this.wasEverConnected) {
			this.stub.switchSession(sessionId);
		}
	}

	/**
	 * Pairing hold comes first: during it `isConversationEngineLive` is false
	 * while `wasEverConnected` may be true (or still false on first pairing), and
	 * a pinned `testEngineConnected` may keep `isEngineConnected()` true.
	 */
	private routeRosterWrite(): RosterWriteRoute {
		if (isConversationPairingHold(this.uaConnection)) {
			return 'pairingHold';
		}
		if (this.hasLeftoverEngineCatalogListFailed()) {
			return 'leftoverListFail';
		}
		if (this.isEngineConnected()) {
			return 'connected';
		}
		if (this.wasEverConnected) {
			return 'cachedDisconnect';
		}
		return 'stub';
	}

	/** Boolean writes whose engine helper takes `callRemote` (true connected, false cached disconnect). */
	private routeRosterBooleanWrite(engine: (callRemote: boolean) => boolean, stub: () => boolean): boolean {
		switch (this.routeRosterWrite()) {
			case 'pairingHold':
			case 'leftoverListFail':
				return false;
			case 'connected':
				return engine(true);
			case 'cachedDisconnect':
				return engine(false);
			case 'stub':
				return stub();
		}
	}

	createSession(): string {
		switch (this.routeRosterWrite()) {
			case 'pairingHold':
			case 'leftoverListFail':
			case 'cachedDisconnect':
				return '';
			case 'connected':
				void this.ensureEngineSession().then(() => {
					this.bindLiveTreeObservationLease();
				}).catch(error => {
					this._onDidFailEngineAction.fire({
						sessionId: this.pendingEngineBindSessionId ?? this.getActiveSessionId(),
						action: 'createSession',
						error,
					});
				}).catch(onUnexpectedError);
				return '';
			case 'stub':
				return this.stub.createSession();
		}
	}

	renameSession(sessionId: string, title: string): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.renameEngineSession(sessionId, title, callRemote),
			() => this.stub.renameSession(sessionId, title),
		);
	}

	cancelGeneration(sessionId: string, agentId?: string): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.cancelEngineGeneration(sessionId, agentId, callRemote),
			() => this.stub.cancelGeneration(sessionId, agentId),
		);
	}

	setSessionGoal(sessionId: string, goal: string): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.setEngineSessionGoal(sessionId, goal, callRemote),
			() => this.stub.setSessionGoal(sessionId, goal),
		);
	}

	cancelSessionGoal(sessionId: string): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.cancelEngineSessionGoal(sessionId, callRemote),
			() => this.stub.cancelSessionGoal(sessionId),
		);
	}

	getSessionGoal(sessionId: string): string | undefined {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return this.sessionGoals.get(sessionId);
		}
		return this.stub.getSessionGoal(sessionId);
	}

	forkSubAgent(sessionId: string, options?: { name?: string; task?: string; parentAgentId?: string; anchorTurnId?: string }): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.forkEngineSubAgent(sessionId, options, callRemote),
			() => this.stub.forkSubAgent(sessionId, options),
		);
	}

	killSubAgent(sessionId: string, options?: { agentId?: string; force?: boolean }): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.killEngineSubAgent(sessionId, options, callRemote),
			() => this.stub.killSubAgent(sessionId, options),
		);
	}

	createSnapshot(sessionId: string, options?: { title?: string; description?: string }): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.createEngineSnapshot(sessionId, options, callRemote),
			() => this.stub.createSnapshot(sessionId, options),
		);
	}

	cancelToolCall(sessionId: string, options: { toolCallId: string; agentId?: string }): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.cancelEngineToolCall(sessionId, options, callRemote),
			() => this.stub.cancelToolCall(sessionId, options),
		);
	}

	retryError(sessionId: string, options: { messageId: string; turnId?: string; agentId?: string }): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.continueEngineGeneration(sessionId, options, callRemote),
			() => this.stub.retryError(sessionId, options),
		);
	}

	deleteTurn(sessionId: string, turnId: string, agentId?: string): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.deleteEngineMessage(sessionId, turnId, callRemote, agentId),
			() => this.stub.deleteTurn(sessionId, turnId, agentId),
		);
	}

	updateUserTurnText(sessionId: string, turnId: string, text: string, agentId?: string): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.editEngineMessage(sessionId, turnId, text, callRemote, agentId),
			() => this.stub.updateUserTurnText(sessionId, turnId, text, agentId),
		);
	}

	enqueueMessageQueueItem(sessionId: string, text: string, options?: { priority?: 'NORMAL' | 'HIGH' | 'LOW'; opId?: string }): boolean {
		switch (this.routeRosterWrite()) {
			case 'pairingHold':
			case 'leftoverListFail':
			case 'connected':
				// Enqueue while connected is refused without an RPC.
				return false;
			case 'cachedDisconnect':
				return this.enqueueEngineQueueItem(sessionId, text, options, false);
			case 'stub':
				return this.stub.enqueueMessageQueueItem(sessionId, text, options);
		}
	}

	retryMessageQueueItem(sessionId: string, itemId: string, options?: { upload?: boolean }): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.retryEngineQueueItem(sessionId, itemId, options, callRemote),
			() => this.stub.retryMessageQueueItem(sessionId, itemId, options),
		);
	}

	getMessageQueueState(sessionId: string): ConversationMessageQueueState {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return this.queueReader.getState(sessionId);
		}
		return this.stub.getMessageQueueState(sessionId);
	}

	setMessageQueueFixture(sessionId: string, state: ConversationMessageQueueState): void {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return;
		}
		this.stub.setMessageQueueFixture(sessionId, state);
	}

	getAutoDriveTasks(sessionId: string): readonly string[] {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return [];
		}
		return this.stub.getAutoDriveTasks(sessionId);
	}

	getAutoDriveTaskCount(sessionId: string): number {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return 0;
		}
		return this.stub.getAutoDriveTaskCount(sessionId);
	}

	setAutoDriveTaskFixture(sessionId: string, tasks: readonly string[]): void {
		if (this.isEngineConnected() || this.wasEverConnected) {
			return;
		}
		this.stub.setAutoDriveTaskFixture(sessionId, tasks);
	}

	pauseMessageQueue(sessionId: string): void {
		switch (this.routeRosterWrite()) {
			case 'connected':
				this.forwardEngineQueueRef(sessionId, 'pauseQueue', true, engineSessionId => this.uaConnection.pauseQueue({ sessionId: engineSessionId }));
				return;
			case 'stub':
				this.stub.pauseMessageQueue(sessionId);
				return;
			case 'pairingHold':
			case 'leftoverListFail':
			case 'cachedDisconnect':
				// Cached disconnect sends no RPC and leaves the stub queue alone.
				return;
		}
	}

	resumeMessageQueue(sessionId: string): void {
		switch (this.routeRosterWrite()) {
			case 'connected':
				this.forwardEngineQueueRef(sessionId, 'resumeQueue', true, engineSessionId => this.uaConnection.resumeQueue({ sessionId: engineSessionId }));
				return;
			case 'stub':
				this.stub.resumeMessageQueue(sessionId);
				return;
			case 'pairingHold':
			case 'leftoverListFail':
			case 'cachedDisconnect':
				return;
		}
	}

	clearMessageQueue(sessionId: string): void {
		switch (this.routeRosterWrite()) {
			case 'connected':
				this.forwardEngineQueueRef(sessionId, 'clearQueue', true, engineSessionId => this.uaConnection.clearQueue({ sessionId: engineSessionId }));
				return;
			case 'stub':
				this.stub.clearMessageQueue(sessionId);
				return;
			case 'pairingHold':
			case 'leftoverListFail':
			case 'cachedDisconnect':
				return;
		}
	}

	holdMessageQueueItem(sessionId: string, itemId: string, hold: ConversationQueueItemHoldReason): void {
		this.holdMessageQueueItemWithSettlement(sessionId, itemId, hold);
	}

	holdMessageQueueItemWithSettlement(sessionId: string, itemId: string, hold: ConversationQueueItemHoldReason): ConversationQueueMutationDispatch {
		switch (this.routeRosterWrite()) {
			case 'pairingHold':
			case 'leftoverListFail':
			case 'cachedDisconnect':
				return { sent: false };
			case 'connected':
				return this.forwardEngineQueueItemWithSettlement(sessionId, itemId, 'holdQueueItem', true, (id, engineSessionId) => this.uaConnection.holdQueueItem({
					sessionId: engineSessionId,
					itemId: id,
					reason: hold,
				}));
			case 'stub':
				this.stub.holdMessageQueueItem(sessionId, itemId, hold);
				return { sent: true };
		}
	}

	releaseMessageQueueItemHold(sessionId: string, itemId: string): void {
		this.releaseMessageQueueItemHoldWithSettlement(sessionId, itemId);
	}

	releaseMessageQueueItemHoldWithSettlement(sessionId: string, itemId: string): ConversationQueueMutationDispatch {
		switch (this.routeRosterWrite()) {
			case 'pairingHold':
			case 'leftoverListFail':
			case 'cachedDisconnect':
				return { sent: false };
			case 'connected':
				return this.forwardEngineQueueItemWithSettlement(sessionId, itemId, 'releaseQueueItemHold', true, (id, engineSessionId) => this.uaConnection.releaseQueueItemHold({
					sessionId: engineSessionId,
					itemId: id,
				}));
			case 'stub':
				this.stub.releaseMessageQueueItemHold(sessionId, itemId);
				return { sent: true };
		}
	}

	updateMessageQueueItemContent(sessionId: string, itemId: string, content: string): boolean {
		return this.updateMessageQueueItemContentWithSettlement(sessionId, itemId, content).sent;
	}

	updateMessageQueueItemContentWithSettlement(sessionId: string, itemId: string, content: string): ConversationQueueMutationDispatch {
		switch (this.routeRosterWrite()) {
			case 'pairingHold':
			case 'leftoverListFail':
			case 'cachedDisconnect':
				return { sent: false };
			case 'connected':
				return this.editEngineQueueItemWithSettlement(sessionId, itemId, content, true);
			case 'stub':
				return { sent: this.stub.updateMessageQueueItemContent(sessionId, itemId, content) };
		}
	}

	resolveConfirmation(sessionId: string, turnId: string, status: 'allowed' | 'skipped'): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.respondEnginePermission(sessionId, turnId, status, callRemote),
			() => this.stub.resolveConfirmation(sessionId, turnId, status),
		);
	}

	respondClientTool(sessionId: string, callId: string, options?: { content?: string; isError?: boolean; metadataJson?: string }): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.sendEngineClientToolResponse(sessionId, callId, options, callRemote),
			() => this.stub.respondClientTool(sessionId, callId, options),
		);
	}

	respondQuestion(sessionId: string, questionId: string, answers?: ConversationQuestionRespondAnswers, customText?: string): boolean {
		return this.routeRosterBooleanWrite(
			callRemote => this.respondEngineQuestion(sessionId, questionId, answers, customText, callRemote),
			() => this.stub.respondQuestion(sessionId, questionId, answers, customText),
		);
	}

	deleteSession(sessionId: string, owner?: ConversationDeleteOwner): boolean {
		const supplied = owner !== undefined;
		const captured = copyConversationDeleteOwner(supplied ? owner : captureConversationDeleteOwner(this, this.uaConnection));
		if (supplied && !captured) {
			return false;
		}
		switch (this.routeRosterWrite()) {
			case 'pairingHold':
			case 'leftoverListFail':
				return false;
			case 'connected':
				if (captured?.kind !== 'engine' || !sameConversationDeleteOwner(captured, this, this.uaConnection)) {
					return false;
				}
				return this.deleteEngineSession(sessionId, captured);
			case 'cachedDisconnect':
				// Trusted local cache cleanup is not an Engine delete and never crosses IPC.
				return supplied ? false : this.deleteEngineSession(sessionId);
			case 'stub':
				return captured?.kind === 'local' ? this.stub.deleteSession(sessionId, captured) : false;
		}
	}

	get stubTurnSessionLinkCatalog(): ConversationStubTurnCatalogLookup | undefined {
		return this.stub.stubTurnSessionLinkCatalog;
	}

	set stubTurnSessionLinkCatalog(catalog: ConversationStubTurnCatalogLookup | undefined) {
		this.stub.stubTurnSessionLinkCatalog = catalog;
	}

	getSessionSource(sessionId: string): ConversationSessionSource {
		return this.stub.getSessionSource(sessionId);
	}

	appendUserTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		return this.stub.appendUserTurn(sessionId, text);
	}

	appendStubEchoAssistant(sessionId: string, text: string) {
		if (this.isEngineConnected()) {
			throw new Error('appendStubEchoAssistant is forbidden while the engine is connected');
		}
		return this.stub.appendStubEchoAssistant(sessionId, text);
	}

	appendConfirmationTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		return this.stub.appendConfirmationTurn(sessionId, text);
	}

	appendThinkingTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		return this.stub.appendThinkingTurn(sessionId, text);
	}

	appendToolTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		return this.stub.appendToolTurn(sessionId, text);
	}

	hasEngineConnectionHistory(): boolean {
		return this.wasEverConnected;
	}

	acquireSessionView(sessionId: string): IConversationSessionViewLease {
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
		// D289: pairing-hold leftover still acquires engine frames (notifications/reveal new lease).
		if (this.shouldKeepEngineSessionViewLeaseWhilePairing(sessionId)) {
			return this.engineFrameSource.acquire(sessionId);
		}
		return this.stub.acquireSessionView(sessionId);
	}

	/** Pairing-hold + leftover engine session/cache. True disconnect and placeholders stay stub. */
	private shouldKeepEngineSessionViewLeaseWhilePairing(sessionId: string): boolean {
		if (!isConversationPairingHold(this.uaConnection) || isEngineRosterPlaceholderSessionId(sessionId)) {
			return false;
		}
		return (this.wasEverConnected && this.engineSessions.some(session => session.id === sessionId))
			|| !!this.engineFrameSource.getCachedProjection(sessionId);
	}

	getSessionSync(sessionId: string): SyncChrome {
		if (this.canReadCachedEngineProjection()) {
			const projection = this.engineFrameSource.getCachedProjection(sessionId);
			if (projection) {
				return this.sessionSyncFromCachedProjection(projection.snapshot.sync);
			}
			if (this.isEngineConnected()) {
				return { kind: 'idle' };
			}
		}
		return this.stub.getSessionSync(sessionId);
	}

	/**
	 * D293 / D374: pairing-hold leftover live/syncing/degraded still says
	 * "Session live" while writes are closed — including leftover-looks-live
	 * (`isEngineConnected()===true` + pairing-hold). Keep literal closed leftover
	 * (D288); demote active kinds to the existing engine-cache closed chrome.
	 */
	private sessionSyncFromCachedProjection(sync: SyncChrome): SyncChrome {
		if (this.isEngineLiveChrome() || sync.kind === 'closed' || sync.kind === 'idle') {
			return sync;
		}
		return {
			kind: 'closed',
			reason: localize('conversationRoster.engineCacheReason', "Cached snapshot (read-only)"),
		};
	}

	countPendingConfirmations(sessionId: string): number {
		if (this.canReadCachedEngineProjection()) {
			const projection = this.engineFrameSource.getCachedProjection(sessionId);
			if (projection) {
				return projection.snapshot.pendingActions.filter(action => action.summary.kind === 'permission').length;
			}
		}
		return this.stub.countPendingConfirmations(sessionId);
	}

	hasPendingAttentionSeat(sessionId: string): boolean {
		if (this.canReadCachedEngineProjection()) {
			const projection = this.engineFrameSource.getCachedProjection(sessionId);
			if (projection) {
				return projection.snapshot.pendingActions.some(isPendingAttentionAction);
			}
		}
		return this.stub.hasPendingAttentionSeat(sessionId);
	}

	private allocateEngineBindClientSessionId(forceNew = false): string {
		if (forceNew) {
			this.pendingEngineBindClientSessionId = undefined;
		}
		if (!this.pendingEngineBindClientSessionId) {
			this.pendingEngineBindClientSessionId = this.allocateUnusedEngineClientSessionId();
		}
		return this.pendingEngineBindClientSessionId;
	}

	/**
	 * The in-memory counter restarts at session-100, and those ids are already
	 * live engine rows. Resume of a taken id switches to that row and never Creates.
	 */
	private allocateUnusedEngineClientSessionId(): string {
		const taken = new Set<string>();
		for (const session of this.engineSessions) {
			taken.add(session.id);
		}
		for (const session of this.stub.model.getSessions()) {
			taken.add(session.id);
		}
		let id = allocateConversationStubSessionId();
		for (let guard = 0; taken.has(id) && guard < 10000; guard++) {
			id = allocateConversationStubSessionId();
		}
		return id;
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

	private adoptEngineSession(sessionId: string, title: string, options?: { skipBindLease?: boolean }): ConversationStubSession {
		let record = this.engineSessions.find(session => session.id === sessionId);
		if (!record) {
			// The list groups by access time once any row has one; until the next List replaces it,
			// the local adopt time keeps a new session out of Earlier. An undated list stays flat.
			const catalogDated = this.engineSessions.some(session => typeof session.lastAccessedAt === 'number' && Number.isFinite(session.lastAccessedAt) && session.lastAccessedAt > 0);
			record = { id: sessionId, title, turns: [], source: 'engine-cache', ...(catalogDated ? { lastAccessedAt: Date.now() } : {}) };
			this.engineSessions = [...this.engineSessions, record];
			this._onDidChangeSession.fire(sessionId);
		}
		this.listCompleted = true;
		this.activateEngineSession(sessionId);
		this.persistEngineAwareRoster();
		if (!options?.skipBindLease) {
			this.bindLiveTreeObservationLease();
		}
		return record;
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
		if (isConversationPairingHold(this.uaConnection)) {
			return;
		}
		if (this.isEngineConnected() && !this.engineSessionBindFailed) {
			this.uaConnection.requestAgentTreeRefresh(sessionId);
		}
	}

	/**
	 * The roster API is synchronous, so engine actions are dispatched without
	 * awaiting and the `true` return only means "sent". A rejected RPC still
	 * means the engine never applied the action, so report it rather than
	 * dropping the rejection. `recover` runs first, for callers that already
	 * wrote local state the engine has now refused.
	 *
	 * The returned promise is the one stored on `lastDispatchedEngineAction`.
	 * A later dispatch replaces that field, so a caller that must follow this
	 * action keeps the return value instead of reading
	 * {@link whenDispatchedEngineActionSettles} afterwards.
	 */
	private dispatchEngineAction(
		sessionId: string,
		action: string,
		send: () => Promise<unknown>,
		recover?: () => void,
		isCurrent?: () => boolean,
	): Promise<boolean> {
		const settled = (isCurrent?.() === false ? Promise.resolve(undefined) : send()).then(
			() => isCurrent?.() !== false,
			error => {
				if (isCurrent?.() === false) {
					return false;
				}
				recover?.();
				if (isCurrent?.() === false) {
					return false;
				}
				this._onDidFailEngineAction.fire({ sessionId, action, error });
				return false;
			},
		);
		this.lastDispatchedEngineAction = settled;
		return settled;
	}

	whenDispatchedEngineActionSettles(): Promise<boolean> {
		return this.lastDispatchedEngineAction ?? Promise.resolve(true);
	}

	private cancelEngineGeneration(sessionId: string, agentId: string | undefined, callRemote: boolean): boolean {
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		const resolved = agentId?.trim() || this.lastStreamingAgentId(sessionId) || 'root';
		if (callRemote) {
			this.dispatchEngineAction(sessionId, 'cancelGeneration', this.wrapEngineQueueMutation(
				'cancelGeneration',
				() => this.uaConnection.cancelGeneration({ sessionId, agentId: resolved }),
			));
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
			const previous = this.sessionGoals.get(sessionId);
			this.dispatchEngineAction(
				sessionId,
				'setSessionGoal',
				async () => {
					const result = await this.uaConnection.setSessionGoal!({ sessionId, goal: trimmed });
					if (result && result.ok === false) {
						throw new Error('setSessionGoal refused');
					}
				},
				() => this.restoreSessionGoal(sessionId, previous),
			);
			this.sessionGoals.set(sessionId, trimmed);
			this._onDidChangeSession.fire(sessionId);
			return true;
		}
		return false;
	}

	/** Undo a locally applied goal the engine then refused. */
	private restoreSessionGoal(sessionId: string, previous: string | undefined): void {
		if (previous === undefined) {
			this.sessionGoals.delete(sessionId);
		} else {
			this.sessionGoals.set(sessionId, previous);
		}
		this._onDidChangeSession.fire(sessionId);
	}

	private cancelEngineSessionGoal(sessionId: string, callRemote: boolean): boolean {
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			if (!this.uaConnection.cancelSessionGoal) {
				return false;
			}
			const previous = this.sessionGoals.get(sessionId);
			this.dispatchEngineAction(
				sessionId,
				'cancelSessionGoal',
				async () => {
					const result = await this.uaConnection.cancelSessionGoal!({ sessionId });
					if (result && result.ok === false) {
						throw new Error('cancelSessionGoal refused');
					}
				},
				() => this.restoreSessionGoal(sessionId, previous),
			);
			this.sessionGoals.delete(sessionId);
			this._onDidChangeSession.fire(sessionId);
			return true;
		}
		return false;
	}

	private forkEngineSubAgent(
		sessionId: string,
		options: { name?: string; task?: string; parentAgentId?: string; anchorTurnId?: string } | undefined,
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
			const anchorTurnId = options?.anchorTurnId?.trim();
			this.dispatchEngineAction(sessionId, 'forkAgent', this.wrapEngineQueueMutation(
				'forkAgent',
				() => this.uaConnection.forkAgent!({
					sessionId,
					parentAgentId,
					...(name ? { name } : {}),
					...(task ? { task } : {}),
					...(anchorTurnId ? { anchorTurnId } : {}),
				}),
			));
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
			this.dispatchEngineAction(sessionId, 'createSnapshot', this.wrapEngineQueueMutation(
				'createSnapshot',
				() => this.uaConnection.createSnapshot!({
					sessionId,
					title,
					...(description !== undefined ? { description } : {}),
				}),
			));
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
			this.dispatchEngineAction(sessionId, 'killAgent', this.wrapEngineQueueMutation(
				'killAgent',
				() => this.uaConnection.killAgent!({
					sessionId,
					agentId,
					...(options?.force === true ? { force: true } : {}),
				}),
			));
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
			return this.dispatchEngineResponse(sessionId, 'clientTool', trimmedCallId, 'sendClientToolResponse',
				() => this.uaConnection.sendClientToolResponse!({
					sessionId, callId: trimmedCallId,
					...(options?.isError === true ? { isError: true } : {}),
					...(content !== undefined ? { content } : {}),
					...(metadataJson !== undefined ? { metadataJson } : {}),
				}),
				snapshot => clientToolRespondCleanupPatches(snapshot, { callId: trimmedCallId, isError: options?.isError === true, content: content ?? '' }), true);
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
			const decision: 'allow' | 'deny' = status === 'allowed' ? 'allow' : 'deny';
			return this.dispatchEngineResponse(sessionId, 'permission', requestId, 'respondPermission',
				() => this.uaConnection.respondPermission!({ sessionId, requestId, granted: decision === 'allow' }),
				snapshot => permissionRespondCleanupPatches(snapshot, { requestId, decision }));
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
			return this.dispatchEngineResponse(sessionId, 'question', trimmedQuestionId, 'respondQuestion',
				() => this.uaConnection.respondQuestion!({
					sessionId, questionId: trimmedQuestionId,
					...(answers !== undefined ? { answers } : {}),
					...(customText !== undefined ? { customText } : {}),
				}),
				snapshot => questionRespondCleanupPatches(snapshot, { questionId: trimmedQuestionId, ...(answers !== undefined ? { answers } : {}) }));
		}
		return false;
	}

	/** Own a response before notifying any leaf or invoking a possibly reentrant hook. */
	private dispatchEngineResponse(
		sessionId: string, kind: ConversationResponseKind, requestId: string, action: string,
		send: () => Promise<unknown>, cleanup: (snapshot: SessionViewSnapshot) => readonly ViewPatch[], requireExplicitOk = false,
	): boolean {
		const canWrite = () => !this._store.isDisposed && this.responseWriteTransitions === 0 && this.isEngineConnected()
			&& isConversationEngineLive(this.uaConnection.getConnectionPhase(), this.uaConnection.getConnectionSnapshot().pairingPending);
		if (!canWrite()) {
			return false;
		}
		const generation = this.connectionGeneration;
		const identity = this.boundEngineIdentityId;
		const response = this.engineFrameSource.beginResponse(sessionId, kind, requestId);
		if (response.kind === 'blocked') {
			return false;
		}
		if (response.kind === 'inFlight') {
			return true;
		}
		const current = () => canWrite() && generation === this.connectionGeneration && identity === this.boundEngineIdentityId
			&& (response.kind !== 'started' || response.isCurrent());
		if (!current()) {
			return false;
		}
		const mutation = this.wrapEngineQueueMutation(action, send, () => {
			if (response.kind === 'started' && current()) {
				response.complete(undefined, cleanup);
			}
		}, requireExplicitOk);
		this.dispatchEngineAction(sessionId, action, async () => {
			try {
				await mutation();
			} catch (error) {
				if (response.kind === 'started' && current()) {
					response.complete({ retryable: true, error: toErrorMessage(error) });
				}
				throw error;
			}
		});
		return true;
	}

	private deleteEngineMessage(sessionId: string, turnId: string, callRemote: boolean, agentId?: string): boolean {
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
			const resolvedAgentId = agentId?.trim() || this.lastStreamingAgentId(sessionId) || 'root';
			this.dispatchEngineAction(sessionId, 'deleteMessage', this.wrapEngineQueueMutation(
				'deleteMessage',
				() => this.uaConnection.deleteMessage!({ sessionId, turnId: trimmedTurnId, agentId: resolvedAgentId }),
			));
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
			this.dispatchEngineAction(sessionId, 'cancelToolCall', this.wrapEngineQueueMutation(
				'cancelToolCall',
				() => this.uaConnection.cancelToolCall!({ sessionId, agentId, toolCallId }),
			));
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
			void pending.catch(onUnexpectedError);
			return true;
		}
		return false;
	}

	/**
	 * Writes that resolve `{ ok }` without throwing. `ok:false` is still a
	 * refusal — same as {@link setEngineSessionGoal}. Queue snapshots are refreshed
	 * after the authoritative mutation response; item ids are never invented locally.
	 * `onAccepted` runs only after the engine accepts, in this same turn, so a
	 * refusal still rejects before any local cleanup.
	 */
	private wrapEngineQueueMutation(action: string, send: () => Promise<unknown>, onAccepted?: () => void, requireExplicitOk = false): () => Promise<void> {
		return async () => {
			const result = await send() as { ok?: boolean; error?: string; message?: string } | undefined;
			if (result && result.ok === false) {
				throw new Error(result.error?.trim() || result.message?.trim() || `${action} refused`);
			}
			if (requireExplicitOk && (!result || result.ok !== true)) {
				throw new Error(`${action} refused`);
			}
			onAccepted?.();
		};
	}

	private dispatchQueueMutation(sessionId: string, action: string, send: () => Promise<unknown>): Promise<boolean> {
		const epoch = this.queueReader.captureEpoch();
		const pending = this.wrapEngineQueueMutation(action, send, undefined, true)().then(() => true, error => {
			if (this.queueReader.isCurrent(epoch)) { this._onDidFailEngineAction.fire({ sessionId, action, error }); }
			return false;
		});
		// Refresh only after the settlement's consumers have run. The queue-edit chain
		// (Hold→Edit→Release) forwards its next mutation on the previous explicit ok,
		// and refresh withdraws ready while the readback runs, which must not gate that
		// forward off. Consumers run synchronously after their settlement, so one
		// microtask keeps "mutation done, refresh immediately" without preempting them.
		void pending.then(ok => {
			queueMicrotask(() => {
				if (this.queueReader.isCurrent(epoch)) { this.queueReader.refresh(sessionId); }
			});
			return ok;
		});
		this.lastDispatchedEngineAction = pending;
		return pending;
	}

	private forwardEngineQueueRef(sessionId: string, action: string, callRemote: boolean, send: (engineSessionId: string) => Promise<unknown>): boolean {
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return false;
		}
		if (callRemote) {
			const engineSessionId = this.queueReader.readyEngineSessionId(sessionId);
			if (!engineSessionId) { return false; }
			this.dispatchQueueMutation(sessionId, action, () => send(engineSessionId));
			this._onDidChangeSession.fire(sessionId);
			return true;
		}
		return false;
	}

	private forwardEngineQueueItem(sessionId: string, itemId: string, action: string, callRemote: boolean, send: (itemId: string, engineSessionId: string) => Promise<unknown>): boolean {
		return this.forwardEngineQueueItemWithSettlement(sessionId, itemId, action, callRemote, send).sent;
	}

	private forwardEngineQueueItemWithSettlement(sessionId: string, itemId: string, action: string, callRemote: boolean, send: (itemId: string, engineSessionId: string) => Promise<unknown>): ConversationQueueMutationDispatch {
		const trimmedId = itemId.trim();
		if (!trimmedId) {
			return { sent: false };
		}
		if (!this.engineSessions.some(session => session.id === sessionId)) {
			return { sent: false };
		}
		if (callRemote) {
			const engineSessionId = this.queueReader.readyEngineSessionId(sessionId);
			if (!engineSessionId) { return { sent: false }; }
			const settlement = this.dispatchQueueMutation(sessionId, action, () => send(trimmedId, engineSessionId));
			this._onDidChangeSession.fire(sessionId);
			return { sent: true, settlement };
		}
		return { sent: false };
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
		return this.forwardEngineQueueRef(sessionId, 'enqueueQueueItem', callRemote, engineSessionId => this.uaConnection.enqueueQueueItem({
			sessionId: engineSessionId,
			text: trimmed,
			...(options?.priority ? { priority: options.priority } : {}),
			...(opId ? { opId } : {}),
		}));
	}

	private editEngineQueueItemWithSettlement(sessionId: string, itemId: string, content: string, callRemote: boolean): ConversationQueueMutationDispatch {
		const trimmed = content.trim();
		if (!trimmed) {
			return { sent: false };
		}
		return this.forwardEngineQueueItemWithSettlement(sessionId, itemId, 'editQueueItem', callRemote, (id, engineSessionId) => this.uaConnection.editQueueItem({
			sessionId: engineSessionId,
			itemId: id,
			text: trimmed,
		}));
	}

	private retryEngineQueueItem(sessionId: string, itemId: string, options: { upload?: boolean } | undefined, callRemote: boolean): boolean {
		const send = options?.upload ? this.uaConnection.retryQueueItemUpload : this.uaConnection.retryQueueItem;
		if (!send) { return false; }
		return this.forwardEngineQueueItem(sessionId, itemId, options?.upload ? 'retryQueueItemUpload' : 'retryQueueItem', callRemote,
			(id, engineSessionId) => {
				const request = { sessionId: engineSessionId, itemId: id };
				return options?.upload ? this.uaConnection.retryQueueItemUpload!(request) : this.uaConnection.retryQueueItem!(request);
			});
	}

	private editEngineMessage(sessionId: string, turnId: string, text: string, callRemote: boolean, agentId?: string): boolean {
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
			const resolvedAgentId = agentId?.trim() || 'root';
			this.dispatchEngineAction(sessionId, 'editMessage', this.wrapEngineQueueMutation(
				'editMessage',
				() => this.uaConnection.editMessage!({
					sessionId,
					turnId: trimmedTurnId,
					newContent: trimmedText,
					agentId: resolvedAgentId,
				}),
			));
			return true;
		}
		return false;
	}

	private lastStreamingAgentId(sessionId: string): string | undefined {
		const projection = this.engineFrameSource.getCachedProjection(sessionId);
		if (projection) {
			const entries = projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details);
			for (let i = entries.length - 1; i >= 0; i--) {
				const entry = entries[i];
				if (entry && isConversationRowStreaming(entry, 'live')) {
					const id = entry.agentId?.trim();
					if (id) {
						return id;
					}
				}
			}
		}
		const turns = this.getTurns(sessionId);
		for (let i = turns.length - 1; i >= 0; i--) {
			const turn = turns[i];
			if (turn && isConversationRowStreaming(turn, 'live')) {
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
		const previousTitle = session.title;
		session.title = trimmed;
		if (callRemote) {
			this.dispatchEngineAction(
				sessionId,
				'renameSession',
				async () => {
					const result = await this.uaConnection.renameSession({ sessionId, title: trimmed });
					if (!result.ok) {
						throw new Error('renameSession refused');
					}
				},
				() => this.rollbackEngineSessionTitle(sessionId, previousTitle),
			);
		}
		this._onDidChangeSession.fire(sessionId);
		this.persistEngineAwareRoster();
		return true;
	}

	private rollbackEngineSessionTitle(sessionId: string, previousTitle: string): void {
		const session = this.engineSessions.find(s => s.id === sessionId);
		if (!session || session.title === previousTitle) {
			return;
		}
		session.title = previousTitle;
		this._onDidChangeSession.fire(sessionId);
		this.persistEngineAwareRoster();
	}

	private createEngineDeleteScope(owner?: Extract<ConversationDeleteOwner, { kind: 'engine' }>): { isCurrent(): boolean; dispose(): void } {
		const store = new DisposableStore();
		this.deleteScopes.add(store);
		const generation = this.connectionGeneration;
		const identity = this.boundEngineIdentityId;
		const remote = owner ? store.add(guardConversationDeleteConfirmation(owner, this, this.uaConnection)) : undefined;
		let invalidated = false;
		const matches = () => !this._store.isDisposed && (remote
			? remote.isCurrent()
			: generation === this.connectionGeneration && identity === this.boundEngineIdentityId
				&& !this.isEngineConnected() && !isConversationPairingHold(this.uaConnection));
		const isCurrent = () => {
			invalidated ||= !matches();
			return !invalidated;
		};
		store.add(this.uaConnection.onDidChangeConnection(() => { isCurrent(); }));
		store.add(this.onDidChangeEngineConnection(() => { isCurrent(); }));
		return { isCurrent, dispose: () => { this.deleteScopes.delete(store); } };
	}

	private deleteEngineSession(sessionId: string, owner?: Extract<ConversationDeleteOwner, { kind: 'engine' }>): boolean {
		const index = this.engineSessions.findIndex(s => s.id === sessionId);
		if (index < 0) {
			return false;
		}
		const scope = this.createEngineDeleteScope(owner);
		if (!scope.isCurrent()) {
			scope.dispose();
			return false;
		}
		const callRemote = owner !== undefined;
		const removed = this.engineSessions[index]!;
		const snapshot: EngineSessionDeleteSnapshot = {
			session: {
				id: removed.id,
				title: removed.title,
				turns: removed.turns,
				source: removed.source,
				...(typeof removed.turnCount === 'number' && Number.isFinite(removed.turnCount) ? { turnCount: removed.turnCount } : {}),
				...(typeof removed.lastAccessedAt === 'number' && Number.isFinite(removed.lastAccessedAt) && removed.lastAccessedAt > 0 ? { lastAccessedAt: removed.lastAccessedAt } : {}),
			},
			index,
			previousGoal: this.sessionGoals.get(sessionId),
			previousActiveId: this.activeEngineSessionId,
			previousListCompleted: this.listCompleted,
			previousBindFailed: this.engineSessionBindFailed,
		};
		const wasActive = this.getActiveSessionId() === sessionId;
		const shownOrder = orderSessionsForRoster(this.engineSessions);
		const shownIndex = shownOrder.findIndex(session => session.id === sessionId);
		const nextShownId = (shownOrder[shownIndex + 1] ?? shownOrder[shownIndex - 1])?.id;
		this.engineSessions = this.engineSessions.filter(s => s.id !== sessionId);
		this.sessionGoals.delete(sessionId);
		this.rosterDetailKeys.delete(sessionId);
		// Remote delete: keep this unary. A listener below can dispatch another
		// action and replace lastDispatchedEngineAction before we return.
		const remoteDeleteSettled = owner
			? this.dispatchEngineAction(
				sessionId,
				'deleteSession',
				async () => this.uaConnection.deleteSession({ sessionId }, { linkId: owner.linkId, engineIdentityId: owner.engineIdentityId }),
				() => this.rollbackEngineSessionDelete(snapshot, scope.isCurrent),
				scope.isCurrent,
			)
			: undefined;
		if (remoteDeleteSettled) {
			// The scope outlives both dispatch and this delete's completion handler.
			void remoteDeleteSettled.then(applied => {
				if (!applied || !scope.isCurrent()) {
					return;
				}
				if (!this.engineSessions.some(session => session.id === sessionId) && this.engineSessions.length === 0) {
					this.persistEngineAwareRoster(this.wasEverConnected, { sessions: [] });
				}
				if (scope.isCurrent()) {
					this._onDidDeleteSession.fire(sessionId);
				}
			}).finally(() => scope.dispose()).catch(onUnexpectedError);
		}
		try {
			if (!scope.isCurrent()) {
				return true;
			}
			if (this.engineSessions.length === 0) {
				// Honest empty — no stub seed refill (m6 §6 / M6-A2).
				this.listCompleted = true;
				if (this.isEngineConnected()) {
					this.markEngineSessionBindFailed();
					if (!scope.isCurrent()) {
						return true;
					}
				} else {
					this.activeEngineSessionId = undefined;
				}
			} else if (wasActive) {
				const nextId = nextShownId ?? this.engineSessions[Math.min(index, this.engineSessions.length - 1)]!.id;
				this.activeEngineSessionId = nextId;
				this._onDidChangeActiveSession.fire(nextId);
				if (!scope.isCurrent()) {
					return true;
				}
			}
			this._onDidChangeSession.fire(sessionId);
			if (!scope.isCurrent()) {
				return true;
			}
			// An empty remote delete must not persist yet. buildPersistedEngineCache
			// would write the previous bucket back while the unary is still open.
			const remoteEmptiedRoster = !!remoteDeleteSettled && this.engineSessions.length === 0;
			if (!remoteEmptiedRoster) {
				this.persistEngineAwareRoster();
			}
			if (!remoteDeleteSettled && scope.isCurrent()) {
				this._onDidDeleteSession.fire(sessionId);
			}
			return true;
		} finally {
			if (!callRemote) {
				scope.dispose();
			}
		}
	}

	private rollbackEngineSessionDelete(snapshot: EngineSessionDeleteSnapshot, isCurrent: () => boolean): void {
		if (!isCurrent()) {
			return;
		}
		this.engineSessionBindFailed = snapshot.previousBindFailed;
		this.listCompleted = snapshot.previousListCompleted;
		if (!this.engineSessions.some(session => session.id === snapshot.session.id)) {
			const next = this.engineSessions.slice();
			const insertAt = Math.min(Math.max(snapshot.index, 0), next.length);
			next.splice(insertAt, 0, snapshot.session);
			this.engineSessions = next;
		}
		if (snapshot.previousGoal === undefined) {
			this.sessionGoals.delete(snapshot.session.id);
		} else {
			this.sessionGoals.set(snapshot.session.id, snapshot.previousGoal);
		}
		const currentActiveId = this.activeEngineSessionId;
		this.activeEngineSessionId = snapshot.previousActiveId;
		if (currentActiveId !== snapshot.previousActiveId && snapshot.previousActiveId !== undefined) {
			this._onDidChangeActiveSession.fire(snapshot.previousActiveId);
			if (!isCurrent()) {
				return;
			}
		}
		this._onDidChangeSession.fire(snapshot.session.id);
		if (isCurrent()) {
			this.persistEngineAwareRoster();
		}
	}

	private onUaConnectionChanged(): void {
		// A real disconnect overrides the test/display flag before scope listeners
		// can attempt a new response. Pairing's existing leftover display is kept.
		if (this.uaConnection.getConnectionPhase().kind === 'disconnected' && !isConversationPairingHold(this.uaConnection)) {
			this.testEngineConnected = undefined;
		}
		this.adoptSnapshotEngineIdentity();
		const connected = this.isEngineConnected();
		if (connected) {
			if (this.isEngineLiveChrome()) {
				this.wasEverConnected = true;
			}
			this.testEngineConnected = undefined;
			this.stub.setEngineConnected(true);
			void this.refreshEngineCatalog().catch(onUnexpectedError);
		} else {
			this.connectionGeneration++;
			this.captureEngineCache();
			this.listCompleted = this.engineSessions.length > 0;
			if (this.testEngineConnected === undefined) {
				this.stub.setEngineConnected(false);
			}
			this.engineFrameSource.resetResponseScopes();
		}
		this.bindLiveTreeObservationLease();
		this.syncQueueReader();
	}

	private syncQueueReader(): void {
		const snapshot = this.uaConnection.getConnectionSnapshot();
		const lease = this.queueBoundLease;
		this.queueReader.update({
			engineIdentityId: readPublishedEngineIdentityId(snapshot), linkId: readPublishedLinkId(snapshot),
			leaseGeneration: this.listedBindMonitorGeneration, localSessionId: this.getActiveSessionId(),
			engineSessionId: this.isEngineSessionReady() && lease?.sessionId === this.getActiveSessionId() ? this.engineFrameSource.boundEngineSessionId(lease) : undefined,
			live: this.isEngineLiveChrome(),
			support: this.uaConnection.getQueue ? snapshot.conversationEntryCapability?.getQueue ?? 'UNKNOWN' : 'UNSUPPORTED',
		});
	}

	private bindLiveTreeObservationLease(): void {
		if (this._store.isDisposed || this.suppressBindLiveTreeObservationLease) {
			return;
		}
		this.queueBoundLease = undefined;
		this.syncQueueReader();
		const sessionId = this.pendingEngineBindSessionId || this.getActiveSessionId();
		if (!this.isEngineConnected()) {
			const leaseSessionId = this.liveTreeObservationLease?.sessionId;
			if (shouldKeepLiveTreeLeaseWhilePairing(this.uaConnection, leaseSessionId, sessionId)
				|| !shouldRebindLiveTreeLeaseWhilePairing(this.uaConnection, leaseSessionId, sessionId)) {
				// D286/D292: pairing-hold same session keeps observation. True disconnect
				// still returns without clearing. Session switch while pairing falls through.
				return;
			}
		}
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
		// Dropping this lease forgets the projection. Keep the turns on the roster
		// row so the subtitle still counts them after a switch.
		this.rememberObservedProjection();
		let lease: IConversationSessionViewLease;
		try {
			lease = this.acquireSessionView(sessionId);
		} catch (error) {
			this._onDidFailEngineAction.fire({ sessionId, action: 'acquireSessionView', error });
			return;
		}
		this.liveTreeObservationStore.clear();
		this.listedBindMonitorGeneration++;
		if (pendingBind) {
			this.activePendingBindLeaseSessionId = sessionId;
		} else {
			this.activePendingBindLeaseSessionId = undefined;
		}
		this.liveTreeObservationLease = lease;
		this.liveTreeObservationStore.add(lease);
		this.liveTreeObservationStore.add(lease.onDidApplyFrame(() => {
			this.emitLiveAgentTreeFromLease(lease);
			this.publishRosterDetailIfChanged(lease.sessionId);
		}));
		this.emitLiveAgentTreeFromLease(lease);
		this.publishRosterDetailIfChanged(lease.sessionId);
		if (pendingBind) {
			void this.monitorPendingEngineSessionBind(sessionId, lease).catch(onUnexpectedError);
		} else {
			void this.monitorListedEngineSessionBind(sessionId, lease, this.listedBindMonitorGeneration).catch(onUnexpectedError);
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
			this.queueBoundLease = lease;
			this.syncQueueReader();
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
			const engineSessionId = this.engineFrameSource.boundEngineSessionId(lease);
			const engineTitle = this.engineSessions.find(session =>
				session.id === sessionId || (engineSessionId !== undefined && session.id === engineSessionId)
			)?.title.trim();
			const title = engineTitle || localize('conversationLens.sessionNew', "New session");
			const existed = this.engineSessions.some(session => session.id === sessionId);
			const ownerSnapshot = this.uaConnection.getConnectionSnapshot();
			const owner = { engineIdentityId: readPublishedEngineIdentityId(ownerSnapshot), linkId: readPublishedLinkId(ownerSnapshot), generation: this.connectionGeneration };
			let record: ConversationStubSession;
			this.suppressBindLiveTreeObservationLease = true;
			try {
				record = this.adoptEngineSession(sessionId, title, { skipBindLease: true });
			} finally {
				this.suppressBindLiveTreeObservationLease = false;
			}
			this.queueBoundLease = lease;
			this.syncQueueReader();
			if (!existed && engineSessionId) {
				void this.hydrateNewSessionWorkDir(record, engineSessionId, owner);
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

	private async hydrateNewSessionWorkDir(record: ConversationStubSession, engineSessionId: string, owner: { engineIdentityId: string | undefined; linkId: number | undefined; generation: number }): Promise<void> {
		try {
			const { engineIdentityId, linkId, generation } = owner;
			if (!this.uaConnection.getSessionInfo || !engineIdentityId || linkId === undefined) {
				return;
			}
			const current = () => !this._store.isDisposed && this.isEngineConnected()
				&& isConversationEngineLive(this.uaConnection.getConnectionPhase(), this.uaConnection.getConnectionSnapshot().pairingPending)
				&& generation === this.connectionGeneration
				&& readPublishedEngineIdentityId(this.uaConnection.getConnectionSnapshot()) === engineIdentityId
				&& readPublishedLinkId(this.uaConnection.getConnectionSnapshot()) === linkId
				&& this.engineSessions.find(session => session.id === record.id) === record && !record.workDir?.trim();
			if (!current()) {
				return;
			}
			const result = await this.uaConnection.getSessionInfo({ sessionId: engineSessionId }, { engineIdentityId, linkId });
			if (!current() || result.sessionId !== engineSessionId || !result.workDir?.trim()) {
				return;
			}
			record.workDir = result.workDir;
			this.persistEngineAwareRoster();
			this._onDidChangeSession.fire(record.id);
		} catch {
			// Metadata is optional: a successful bind keeps its connection work-root fallback.
		}
	}

	private emitLiveAgentTreeFromLease(lease: IConversationSessionViewLease): void {
		const tree = lease.snapshot.liveAgentTree;
		if (tree) {
			this._onDidChangeLiveAgentTree.fire({ sessionId: lease.sessionId, tree });
		}
	}

	/** Copy the live projection onto the roster row before its lease is released. */
	private rememberObservedProjection(): void {
		const sessionId = this.liveTreeObservationLease?.sessionId;
		if (!sessionId || isEngineRosterPlaceholderSessionId(sessionId)) {
			return;
		}
		if (!this.engineFrameSource.getCachedProjection(sessionId)) {
			return;
		}
		const session = this.engineSessions.find(item => item.id === sessionId);
		if (!session) {
			return;
		}
		session.turns = this.getTurns(sessionId).map(turn => ({ ...turn }));
	}

	/** Notify subtitle listeners when the projected message or confirmation count changes. */
	private publishRosterDetailIfChanged(sessionId: string): void {
		if (!sessionId || isEngineRosterPlaceholderSessionId(sessionId)) {
			return;
		}
		const key = `${this.getTurns(sessionId).length}:${this.countPendingConfirmations(sessionId)}`;
		const previous = this.rosterDetailKeys.get(sessionId);
		if (previous === key) {
			return;
		}
		this.rosterDetailKeys.set(sessionId, key);
		// An empty first observation is not a change. A later baseline still publishes.
		if (previous === undefined && key === '0:0') {
			return;
		}
		this._onDidChangeSessionRosterDetail.fire(sessionId);
	}

	/**
	 * Catalog list no longer contains these ids. Local delete does not call this:
	 * that path fires {@link onDidDeleteSession} only after the unary succeeds.
	 */
	private firePrunedEngineSessions(previousIds: readonly string[]): void {
		const dropped = previousIds.filter(id => !this.engineSessions.some(session => session.id === id));
		if (dropped.length === 0) {
			return;
		}
		this._onDidPruneEngineSessions.fire(dropped);
	}

	/** @internal Await the in-flight engine catalog refresh (tests). */
	async whenEngineCatalogRefreshComplete(): Promise<void> {
		while (this.refreshEngineCatalogInflight) {
			await this.refreshEngineCatalogInflight;
		}
	}

	private refreshEngineCatalog(): Promise<void> {
		// D344 leftover-looks-live: pairing-hold first. KEEP leftover roster; do not extra listSessions.
		if (isConversationPairingHold(this.uaConnection)) {
			return this.refreshEngineCatalogInflight ?? Promise.resolve();
		}
		if (this.refreshEngineCatalogInflight && this.refreshEngineCatalogGeneration === this.connectionGeneration) {
			return this.refreshEngineCatalogInflight;
		}
		const generation = this.connectionGeneration;
		this.refreshEngineCatalogGeneration = generation;
		const inflight = this.doRefreshEngineCatalog(generation).finally(() => {
			if (this.refreshEngineCatalogInflight === inflight) {
				this.refreshEngineCatalogInflight = undefined;
			}
		});
		this.refreshEngineCatalogInflight = inflight;
		return inflight;
	}

	private async doRefreshEngineCatalog(generation: number): Promise<void> {
		const capturedConnection = this.uaConnection;
		const capturedIdentity = this.boundEngineIdentityId;
		this.listCompleted = false;
		this.engineSessionBindFailed = false;
		this.engineBoundSessionIds.clear();
		this.clearPendingEngineBindClientSessionId();
		try {
			const result = await capturedConnection.listSessions({});
			if (capturedConnection !== this.uaConnection || generation !== this.connectionGeneration || capturedIdentity !== this.boundEngineIdentityId || !this.isEngineConnected()) {
				return;
			}
			// D379 leftover-looks-live: pairing-hold first after await. KEEP leftover; 0 Create / activate-as-live.
			if (isConversationPairingHold(this.uaConnection)) {
				return;
			}
			const previousRowTurns = new Map<string, ConversationStubTurn[]>();
			const previousEngineSessionIds = this.engineSessions.map(session => session.id);
			for (const session of this.engineSessions) {
				if (session.turns.length > 0) {
					previousRowTurns.set(session.id, session.turns.map(turn => ({ ...turn })));
				}
			}
			this.engineSessions = result.sessions
				.filter(s => s.sessionId && !STUB_SEED_IDS.has(s.sessionId))
				.map(s => {
					const id = s.sessionId;
					const cached = this.engineFrameSource.getCachedProjection(id);
					const carried = !cached ? previousRowTurns.get(id) : undefined;
					const turnCount = typeof s.turnCount === 'number' && Number.isFinite(s.turnCount) ? s.turnCount : undefined;
					const lastAccessedAt = typeof s.lastAccessedAt === 'number' && Number.isFinite(s.lastAccessedAt) && s.lastAccessedAt > 0 ? s.lastAccessedAt : undefined;
					return {
						id,
						title: s.title ?? localize('conversationLens.sessionUntitled', "Untitled session"),
						turns: carried ? carried.map(turn => ({ ...turn })) : [],
						source: 'engine-cache' as const,
						...(s.workDir ? { workDir: s.workDir } : {}),
						...(turnCount !== undefined ? { turnCount } : {}),
						...(lastAccessedAt !== undefined ? { lastAccessedAt } : {}),
					};
				});
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
			if (capturedConnection !== this.uaConnection || generation !== this.connectionGeneration || capturedIdentity !== this.boundEngineIdentityId || !this.isEngineConnected()) {
				return;
			}
			this._onDidChangeSession.fire(this.getActiveSessionId());
			this.persistEngineAwareRoster();
			this.firePrunedEngineSessions(previousEngineSessionIds);
		} catch {
			if (capturedConnection !== this.uaConnection || generation !== this.connectionGeneration || capturedIdentity !== this.boundEngineIdentityId) {
				return;
			}
			this.pendingEngineBindSessionId = undefined;
			this.activePendingBindLeaseSessionId = undefined;
			this.engineSessionEnsure = undefined;
			this.listCompleted = true;
			if (this.engineSessions.length > 0) {
				// D447: KEEP last-good leftover + failed. First-pull empty still uses bind-failed placeholder.
				this.engineSessionBindFailed = true;
			} else {
				this.markEngineSessionBindFailed();
			}
			this._onDidChangeSession.fire(this.getActiveSessionId());
			this.persistEngineAwareRoster();
		} finally {
			if (capturedConnection === this.uaConnection && generation === this.connectionGeneration && capturedIdentity === this.boundEngineIdentityId) {
				this.bindLiveTreeObservationLease();
			}
		}
	}

	protected saveRosterStorage(state: ConversationRosterStorageV1): void {
		this.stub.saveRosterStorage(state);
	}

	private currentRosterStorage(): ConversationRosterStorageV1 | undefined {
		return this.storageService ? loadConversationRosterStorage(this.storageService) : this.stub.loadedStorage;
	}

	/**
	 * Published link identity when present; while disconnected, keep the last displayed bucket for read-only roster.
	 * Connected links without a published identity use the unknown-identity legacy bucket.
	 */
	private rosterCacheBucketEngineIdentityId(): string | undefined {
		const published = readPublishedEngineIdentityId(this.uaConnection.getConnectionSnapshot());
		if (published !== undefined) {
			return published;
		}
		if (this.isEngineConnected()) {
			return undefined;
		}
		return this.boundEngineIdentityId;
	}

	/** Persist the current bucket, then load only the snapshot's bucket. */
	private adoptSnapshotEngineIdentity(): void {
		const next = this.rosterCacheBucketEngineIdentityId();
		if (next === this.boundEngineIdentityId) {
			return;
		}
		this.responseWriteTransitions++;
		try {
			this.connectionGeneration++;
			// Persist under the old owner before committing the new identity/catalog.
			this.captureEngineCache();
			this.boundEngineIdentityId = next;
			this.engineSessions = [];
			this.activeEngineSessionId = undefined;
			this.listCompleted = false;
			this.engineSessionBindFailed = false;
			this.engineBoundSessionIds.clear();
			this.restoreEngineCacheFromStorage();
			this.engineFrameSource.resetResponseScopes();
			this._onDidChangeSession.fire(this.getActiveSessionId());
		} finally {
			this.responseWriteTransitions--;
		}
	}

	private restoreEngineCacheFromStorage(): void {
		const state = this.currentRosterStorage();
		const cache = selectEngineCache(state, this.boundEngineIdentityId);
		if (!state?.wasEverConnected || !cache || cache.sessions.length === 0) {
			return;
		}
		this.wasEverConnected = true;
		this.engineSessions = cache.sessions.map(session => ({
			id: session.id,
			title: session.title,
			turns: session.turns.map(turn => ({ ...turn })),
			source: 'engine-cache' as const,
			...(session.workDir ? { workDir: session.workDir } : {}),
			...(typeof session.turnCount === 'number' && Number.isFinite(session.turnCount) ? { turnCount: session.turnCount } : {}),
			...(typeof session.lastAccessedAt === 'number' && Number.isFinite(session.lastAccessedAt) && session.lastAccessedAt > 0 ? { lastAccessedAt: session.lastAccessedAt } : {}),
		}));
		const restoreLast = shouldRestoreLastSessionOnStartup(this.configurationService);
		this.activeEngineSessionId = restoreLast && cache.activeSessionId && this.engineSessions.some(session => session.id === cache.activeSessionId)
			? cache.activeSessionId
			: this.engineSessions[0]?.id;
		// Cache is for disconnect display only — bind waits for engine List reconciliation.
		this.listCompleted = false;
		for (const session of this.engineSessions) {
			this.stub.model.upsertCachedSession(session);
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
				? this.stub.projectSnapshotToLegacyTurns(projection.snapshot, projection.attribution, projection.details)
				: session.turns;
			const cached: ConversationStubSession = {
				id: session.id,
				title: session.title,
				turns: [...turns],
				source: 'engine-cache',
				...(session.workDir ? { workDir: session.workDir } : {}),
				...(typeof session.turnCount === 'number' && Number.isFinite(session.turnCount) ? { turnCount: session.turnCount } : {}),
				...(typeof session.lastAccessedAt === 'number' && Number.isFinite(session.lastAccessedAt) && session.lastAccessedAt > 0 ? { lastAccessedAt: session.lastAccessedAt } : {}),
			};
			this.stub.model.upsertCachedSession(cached);
			return {
				id: cached.id,
				title: cached.title,
				turns: cached.turns,
				source: 'engine-cache' as const,
				...(cached.workDir ? { workDir: cached.workDir } : {}),
				...(typeof cached.turnCount === 'number' && Number.isFinite(cached.turnCount) ? { turnCount: cached.turnCount } : {}),
				...(typeof cached.lastAccessedAt === 'number' && Number.isFinite(cached.lastAccessedAt) && cached.lastAccessedAt > 0 ? { lastAccessedAt: cached.lastAccessedAt } : {}),
			};
		});
		this.engineSessions = sessions.map(session => ({
			id: session.id,
			title: session.title,
			turns: session.turns.map(turn => ({ ...turn })),
			source: 'engine-cache',
			...(session.workDir ? { workDir: session.workDir } : {}),
			...(typeof session.turnCount === 'number' && Number.isFinite(session.turnCount) ? { turnCount: session.turnCount } : {}),
			...(typeof session.lastAccessedAt === 'number' && Number.isFinite(session.lastAccessedAt) && session.lastAccessedAt > 0 ? { lastAccessedAt: session.lastAccessedAt } : {}),
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
			? (this.activeEngineSessionId ?? this.stub.getActiveSessionId())
			: this.stub.model.getActiveSessionId();
		if (isEngineRosterPlaceholderSessionId(raw)) {
			const cached = this.engineSessions[0]?.id ?? this.stub.getActiveSessionId();
			return isEngineRosterPlaceholderSessionId(cached) ? this.stub.getActiveSessionId() : cached;
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
		const existing = this.currentRosterStorage();
		this.saveRosterStorage(withEngineCache({
			version: 1,
			wasEverConnected,
			activeSessionId: this.resolvePersistedActiveSessionId(),
			nextTurnId: getConversationStubNextTurnId(),
			localSessions: buildLocalSessionsFromModel(this.stub.model),
			engineCache: existing?.engineCache,
			engineCaches: existing?.engineCaches,
			lastDisplayedEngineIdentityId: engineIdentityKey(this.boundEngineIdentityId),
		}, this.boundEngineIdentityId, resolvedEngineCache));
	}

	private buildPersistedEngineCache(): ConversationRosterEngineCache | undefined {
		if (this.engineSessions.length === 0) {
			return selectEngineCache(this.currentRosterStorage(), this.boundEngineIdentityId);
		}
		const activeSessionId = isEngineRosterPlaceholderSessionId(this.activeEngineSessionId)
			? undefined
			: this.activeEngineSessionId;
		return {
			activeSessionId,
			sessions: this.engineSessions.map(session => {
				const projection = this.engineFrameSource.getCachedProjection(session.id);
				const turns = projection
					? this.stub.projectSnapshotToLegacyTurns(projection.snapshot, projection.attribution, projection.details)
					: session.turns;
				return {
					id: session.id,
					title: session.title,
					turns: turns.map(turn => ({ ...turn })),
					source: 'engine-cache' as const,
					...(session.workDir ? { workDir: session.workDir } : {}),
					...(typeof session.turnCount === 'number' && Number.isFinite(session.turnCount) ? { turnCount: session.turnCount } : {}),
					...(typeof session.lastAccessedAt === 'number' && Number.isFinite(session.lastAccessedAt) && session.lastAccessedAt > 0 ? { lastAccessedAt: session.lastAccessedAt } : {}),
				};
			}),
		};
	}
}
