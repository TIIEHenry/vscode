/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentSessionView } from '../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationEngineFrameSource } from './conversationEngineFrameSource.js';
import {
	ConversationStubService,
	IConversationRosterService,
} from './conversationStubService.js';
import { ConversationStubSession } from './conversationStubModel.js';

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
	) {
		super();
		this.engineFrameSource = this._register(new ConversationEngineFrameSource(sessionView));
		this._register(uaConnection.onDidChangeConnection(() => this.onUaConnectionChanged()));
	}

	override isEngineConnected(): boolean {
		if (this.testEngineConnected !== undefined) {
			return this.testEngineConnected;
		}
		return this.uaConnection.isEngineConnected();
	}

	override setEngineConnected(connected: boolean): void {
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

	override switchSession(sessionId: string): void {
		if ((this.isEngineConnected() || this.wasEverConnected) && this.engineSessions.some(s => s.id === sessionId)) {
			const previous = this.getActiveSessionId();
			this.activeEngineSessionId = sessionId;
			if (previous !== sessionId) {
				this._onDidChangeActiveSession.fire(sessionId);
			}
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
				this.engineSessions = [...this.engineSessions, { id: result.sessionId, title: localize('conversationLens.sessionNew', "New session"), turns: [] }];
				this.activeEngineSessionId = result.sessionId;
				this._onDidChangeSession.fire(result.sessionId);
				this._onDidChangeActiveSession.fire(result.sessionId);
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
		return true;
	}

	private onUaConnectionChanged(): void {
		if (this.uaConnection.isEngineConnected()) {
			this.wasEverConnected = true;
			this.testEngineConnected = undefined;
			void this.refreshEngineCatalog();
		} else {
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
				}));
			this.listCompleted = true;
			if (this.engineSessions.length > 0 && !(this.activeEngineSessionId && this.engineSessions.some(s => s.id === this.activeEngineSessionId))) {
				this.activeEngineSessionId = this.engineSessions[0]!.id;
				this._onDidChangeActiveSession.fire(this.activeEngineSessionId);
			}
			this._onDidChangeEngineConnection.fire(true);
			this._onDidChangeSession.fire(this.getActiveSessionId());
		} catch {
			this.listCompleted = false;
		}
	}
}
