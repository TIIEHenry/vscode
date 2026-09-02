/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentSessionView } from '../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationEngineFrameSource } from './conversationEngineFrameSource.js';
import {
	buildLocalSessionsFromModel,
	loadConversationRosterStorage,
	type PersistedConversationSession,
} from './conversationRosterStorage.js';
import { entriesToLegacyTurns, projectSnapshotToEntries } from './conversationSessionView.js';
import {
	ConversationStubService,
	IConversationRosterService,
} from './conversationStubService.js';
import { ConversationStubSession, ConversationStubTurn, getConversationStubNextTurnId } from './conversationStubModel.js';

const STUB_SEED_IDS = new Set(['untitled', 'visualize']);

/**
 * Engine-backed roster (M6-A2): same token as stub; switches frame source and
 * session catalog when UA is connected.
 */
export class ConversationEngineRosterService extends ConversationStubService implements IConversationRosterService {

	private readonly engineFrameSource: ConversationEngineFrameSource;
	private engineSessions: ConversationStubSession[] = [];
	private activeEngineSessionId: string | undefined;
	private listCompleted = false;
	private wasEverConnected = false;
	private testEngineConnected: boolean | undefined;

	constructor(
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IUniverseAgentSessionView sessionView: IUniverseAgentSessionView,
		@IStorageService storageService?: IStorageService,
	) {
		super(storageService);
		this.engineFrameSource = this._register(new ConversationEngineFrameSource(sessionView));
		this.restoreEngineCacheFromStorage();
		this._register(uaConnection.onDidChangeConnection(() => this.onUaConnectionChanged()));
	}

	override isEngineConnected(): boolean {
		if (this.testEngineConnected !== undefined) {
			return this.testEngineConnected;
		}
		return this.uaConnection.isEngineConnected();
	}

	override setEngineConnected(connected: boolean): void {
		if (!connected && this.isEngineConnected()) {
			this.captureEngineCache();
		}
		this.testEngineConnected = connected;
		super.setEngineConnected(connected);
		if (connected) {
			this.wasEverConnected = true;
			void this.refreshEngineCatalog();
		} else {
			this.listCompleted = this.engineSessions.length > 0;
		}
	}

	override getSessions(): readonly ConversationStubSession[] {
		if (this.isEngineConnected()) {
			if (!this.listCompleted) {
				return [];
			}
			return this.engineSessions;
		}
		if (this.wasEverConnected) {
			return this.engineSessions;
		}
		return super.getSessions();
	}

	override getActiveSessionId(): string {
		if (this.isEngineConnected() || this.wasEverConnected) {
			if (this.engineSessions.length === 0) {
				return this.activeEngineSessionId ?? super.getActiveSessionId();
			}
			if (this.activeEngineSessionId && this.engineSessions.some(s => s.id === this.activeEngineSessionId)) {
				return this.activeEngineSessionId;
			}
			return this.engineSessions[0]!.id;
		}
		return super.getActiveSessionId();
	}

	override getTurns(sessionId: string): readonly ConversationStubTurn[] {
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
			this.persistEngineAwareRoster();
			return;
		}
		if (!this.isEngineConnected() && !this.wasEverConnected) {
			super.switchSession(sessionId);
		}
	}

	override createSession(): string {
		if (this.isEngineConnected()) {
			void this.uaConnection.createSession({
				title: localize('conversationLens.sessionNew', "New session"),
			}).then(result => {
				this.engineSessions = [...this.engineSessions, { id: result.sessionId, title: localize('conversationLens.sessionNew', "New session"), turns: [], source: 'engine-cache' }];
				this.activeEngineSessionId = result.sessionId;
				this._onDidChangeSession.fire(result.sessionId);
				this._onDidChangeActiveSession.fire(result.sessionId);
				this.persistEngineAwareRoster();
			});
			return super.getActiveSessionId();
		}
		return super.createSession();
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

	override acquireSessionView(sessionId: string): IConversationSessionViewLease {
		if (this.isEngineConnected()) {
			return this.engineFrameSource.acquire(sessionId);
		}
		return super.acquireSessionView(sessionId);
	}

	protected override shouldSkipLocalPersistence(): boolean {
		return this.wasEverConnected;
	}

	private deleteEngineSession(sessionId: string, callRemote: boolean): boolean {
		const index = this.engineSessions.findIndex(s => s.id === sessionId);
		if (index < 0) {
			return false;
		}
		const wasActive = this.getActiveSessionId() === sessionId;
		this.engineSessions = this.engineSessions.filter(s => s.id !== sessionId);
		if (callRemote) {
			void this.uaConnection.deleteSession({ sessionId });
		}
		if (this.engineSessions.length === 0) {
			// Honest empty — no stub seed refill (m6 §6 / M6-A2).
			this.listCompleted = true;
			this.activeEngineSessionId = undefined;
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
		if (this.uaConnection.isEngineConnected()) {
			this.wasEverConnected = true;
			this.testEngineConnected = undefined;
			void this.refreshEngineCatalog();
		} else {
			this.captureEngineCache();
			this.listCompleted = this.engineSessions.length > 0;
			this._onDidChangeEngineConnection.fire(false);
		}
	}

	private async refreshEngineCatalog(): Promise<void> {
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
			if (this.engineSessions.length > 0 && !(this.activeEngineSessionId && this.engineSessions.some(s => s.id === this.activeEngineSessionId))) {
				this.activeEngineSessionId = this.engineSessions[0]!.id;
				this._onDidChangeActiveSession.fire(this.activeEngineSessionId);
			}
			this._onDidChangeEngineConnection.fire(true);
			this._onDidChangeSession.fire(this.getActiveSessionId());
			this.persistEngineAwareRoster();
		} catch {
			this.listCompleted = false;
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
		this.activeEngineSessionId = cache.activeSessionId && this.engineSessions.some(session => session.id === cache.activeSessionId)
			? cache.activeSessionId
			: this.engineSessions[0]?.id;
		this.listCompleted = true;
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
			activeSessionId: this.activeEngineSessionId,
			sessions,
		});
	}

	private persistEngineAwareRoster(
		wasEverConnected = this.wasEverConnected,
		engineCache = loadConversationRosterStorage(this.storageService!)?.engineCache,
	): void {
		if (!this.storageService) {
			return;
		}
		this.saveRosterStorage({
			version: 1,
			wasEverConnected,
			activeSessionId: this.wasEverConnected ? (this.activeEngineSessionId ?? super.getActiveSessionId()) : this.model.getActiveSessionId(),
			nextTurnId: getConversationStubNextTurnId(),
			localSessions: buildLocalSessionsFromModel(this.model),
			engineCache,
		});
	}
}
