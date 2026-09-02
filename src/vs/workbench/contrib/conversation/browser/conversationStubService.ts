/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SyncChrome } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { ConversationStubFrameSource } from './conversationStubFrameSource.js';
import { ConversationStubModel, ConversationStubSession, ConversationStubTurn } from './conversationStubModel.js';
import {
	mergeTrajectoryFixtureExtras,
	projectTurnsToTrajectory,
} from './conversationTrajectoryModel.js';
import {
	entriesToLegacyTurns,
	projectSnapshotToEntries,
} from './conversationSessionView.js';
import { ConversationTrajectoryRecord } from './conversationTrajectoryModel.js';
import {
	ConversationMessageQueueState,
	ConversationQueueItemHoldReason,
} from './conversationMessageQueueModel.js';

export const IConversationRosterService = createDecorator<IConversationRosterService>('conversationStubService');

export interface IConversationRosterService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeActiveSession: Event<string>;
	readonly onDidChangeSession: Event<string>;
	readonly onDidChangeEngineConnection: Event<boolean>;

	getSessions(): readonly ConversationStubSession[];
	getActiveSessionId(): string;
	getActiveSession(): ConversationStubSession;
	switchSession(sessionId: string): void;
	createSession(): string;
	renameSession(sessionId: string, title: string): boolean;
	deleteSession(sessionId: string): boolean;
	getTurns(sessionId: string): readonly ConversationStubTurn[];
	getTrajectoryRecords(sessionId: string): readonly ConversationTrajectoryRecord[];
	getSessionSync(sessionId: string): SyncChrome;
	appendUserTurn(sessionId: string, text: string): ConversationStubTurn | undefined;
	appendStubEchoAssistant(sessionId: string, text: string): ConversationStubTurn | undefined;
	appendConfirmationTurn(sessionId: string, text: string): ConversationStubTurn | undefined;
	appendThinkingTurn(sessionId: string, text: string): ConversationStubTurn | undefined;
	appendToolTurn(sessionId: string, text: string): ConversationStubTurn | undefined;
	resolveConfirmation(sessionId: string, turnId: string, status: 'allowed' | 'skipped'): void;
	countPendingConfirmations(sessionId: string): number;
	deleteTurn(sessionId: string, turnId: string): boolean;
	updateUserTurnText(sessionId: string, turnId: string, text: string): boolean;
	updateMessageQueueItemContent(sessionId: string, itemId: string, content: string): boolean;
	getMessageQueueState(sessionId: string): ConversationMessageQueueState;
	setMessageQueueFixture(sessionId: string, state: ConversationMessageQueueState): void;
	pauseMessageQueue(sessionId: string): void;
	resumeMessageQueue(sessionId: string): void;
	clearMessageQueue(sessionId: string): void;
	holdMessageQueueItem(sessionId: string, itemId: string, hold: ConversationQueueItemHoldReason): void;
	releaseMessageQueueItemHold(sessionId: string, itemId: string): void;
	getAutoDriveTasks(sessionId: string): readonly string[];
	getAutoDriveTaskCount(sessionId: string): number;
	setAutoDriveTaskFixture(sessionId: string, tasks: readonly string[]): void;
	isEngineConnected(): boolean;
	setEngineConnected(connected: boolean): void;

	/**
	 * Fine-grained frame channel for one session (dev/plans/conversation-stream-timeline.md §3.2).
	 * Each chat tab / dialog / split column holds its own lease; same-session leases share one
	 * subscription. Same token as the roster — the engine implementation replaces the class, not the id.
	 */
	acquireSessionView(sessionId: string): IConversationSessionViewLease;
}

export type IConversationStubService = IConversationRosterService;
export const IConversationStubService = IConversationRosterService;

export class ConversationStubService extends Disposable implements IConversationRosterService {

	declare readonly _serviceBrand: undefined;

	private readonly model = new ConversationStubModel();
	private engineConnected = false;

	private readonly _onDidChangeActiveSession = this._register(new Emitter<string>());
	readonly onDidChangeActiveSession = this._onDidChangeActiveSession.event;

	private readonly _onDidChangeSession = this._register(new Emitter<string>());
	readonly onDidChangeSession = this._onDidChangeSession.event;

	private readonly _onDidChangeEngineConnection = this._register(new Emitter<boolean>());
	readonly onDidChangeEngineConnection = this._onDidChangeEngineConnection.event;

	protected frameSource = this._register(new ConversationStubFrameSource(this.model, sessionId => this._onDidChangeSession.fire(sessionId)));

	protected useTestFrameSource(source: ConversationStubFrameSource): void {
		this.frameSource = source;
	}

	/** Used by test/browser to construct TestConversationFrameSource against this roster. */
	createTestFrameSourceCallback(): { readonly model: ConversationStubModel; readonly onSessionChanged: (sessionId: string) => void } {
		return {
			model: this.model,
			onSessionChanged: sessionId => this._onDidChangeSession.fire(sessionId),
		};
	}

	/** Swaps the fixture frame producer (test/browser only). */
	wireTestFrameSource(source: ConversationStubFrameSource): void {
		this.useTestFrameSource(source);
	}

	acquireSessionView(sessionId: string): IConversationSessionViewLease {
		return this.frameSource.acquire(sessionId);
	}

	getSessions(): readonly ConversationStubSession[] {
		return this.model.getSessions();
	}

	getActiveSessionId(): string {
		return this.model.getActiveSessionId();
	}

	getActiveSession(): ConversationStubSession {
		return this.model.getActiveSession();
	}

	switchSession(sessionId: string): void {
		const previous = this.model.getActiveSessionId();
		this.model.switchSession(sessionId);
		const current = this.model.getActiveSessionId();
		if (previous !== current) {
			this._onDidChangeActiveSession.fire(current);
		}
	}

	createSession(): string {
		const previous = this.model.getActiveSessionId();
		const sessionId = this.model.createSession();
		const current = this.model.getActiveSessionId();
		if (previous !== current) {
			this._onDidChangeActiveSession.fire(current);
		}
		this._onDidChangeSession.fire(sessionId);
		return sessionId;
	}

	renameSession(sessionId: string, title: string): boolean {
		const changed = this.model.renameSession(sessionId, title);
		if (changed) {
			this._onDidChangeSession.fire(sessionId);
		}
		return changed;
	}

	deleteSession(sessionId: string): boolean {
		const previousActive = this.model.getActiveSessionId();
		const deleted = this.model.deleteSession(sessionId);
		if (!deleted) {
			return false;
		}
		const currentActive = this.model.getActiveSessionId();
		if (previousActive !== currentActive) {
			this._onDidChangeActiveSession.fire(currentActive);
		}
		this._onDidChangeSession.fire(sessionId);
		if (previousActive !== currentActive && currentActive !== sessionId) {
			this._onDidChangeSession.fire(currentActive);
		}
		return true;
	}

	getTurns(sessionId: string): readonly ConversationStubTurn[] {
		const projection = this.frameSource.project(sessionId);
		return entriesToLegacyTurns(projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details));
	}

	getTrajectoryRecords(sessionId: string): readonly ConversationTrajectoryRecord[] {
		const turns = this.getTurns(sessionId);
		return mergeTrajectoryFixtureExtras(sessionId, projectTurnsToTrajectory(turns));
	}

	getSessionSync(sessionId: string): SyncChrome {
		return this.frameSource.project(sessionId).snapshot.sync;
	}

	appendUserTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		const turn = this.model.appendUserTurn(sessionId, text);
		if (turn) {
			this.frameSource.refresh(sessionId);
			this._onDidChangeSession.fire(sessionId);
		}
		return turn;
	}

	appendStubEchoAssistant(sessionId: string, text: string): ConversationStubTurn | undefined {
		const turn = this.model.appendStubEchoAssistant(sessionId, text);
		if (turn) {
			this.frameSource.refresh(sessionId);
			this._onDidChangeSession.fire(sessionId);
		}
		return turn;
	}

	appendConfirmationTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		const turn = this.model.appendConfirmationTurn(sessionId, text);
		if (turn) {
			this.frameSource.refresh(sessionId);
			this._onDidChangeSession.fire(sessionId);
		}
		return turn;
	}

	appendThinkingTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		const turn = this.model.appendThinkingTurn(sessionId, text);
		if (turn) {
			this.frameSource.refresh(sessionId);
			this._onDidChangeSession.fire(sessionId);
		}
		return turn;
	}

	appendToolTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		const turn = this.model.appendToolTurn(sessionId, text);
		if (turn) {
			this.frameSource.refresh(sessionId);
			this._onDidChangeSession.fire(sessionId);
		}
		return turn;
	}

	resolveConfirmation(sessionId: string, turnId: string, status: 'allowed' | 'skipped'): void {
		this.frameSource.write(sessionId, {
			kind: 'permissionRespond',
			requestId: turnId,
			decision: status === 'allowed' ? 'allow' : 'deny',
		});
	}

	countPendingConfirmations(sessionId: string): number {
		return this.frameSource.project(sessionId).snapshot.pendingActions.length;
	}

	deleteTurn(sessionId: string, turnId: string): boolean {
		const deleted = this.model.deleteTurn(sessionId, turnId);
		if (deleted) {
			this.frameSource.refresh(sessionId);
			this._onDidChangeSession.fire(sessionId);
		}
		return deleted;
	}

	updateUserTurnText(sessionId: string, turnId: string, text: string): boolean {
		const updated = this.model.updateUserTurnText(sessionId, turnId, text);
		if (updated) {
			this.frameSource.refresh(sessionId);
			this._onDidChangeSession.fire(sessionId);
		}
		return updated;
	}

	updateMessageQueueItemContent(sessionId: string, itemId: string, content: string): boolean {
		const updated = this.model.updateMessageQueueItemContent(sessionId, itemId, content);
		if (updated) {
			this._onDidChangeSession.fire(sessionId);
		}
		return updated;
	}

	getMessageQueueState(sessionId: string): ConversationMessageQueueState {
		return this.model.getMessageQueueState(sessionId);
	}

	setMessageQueueFixture(sessionId: string, state: ConversationMessageQueueState): void {
		this.model.setMessageQueueFixture(sessionId, state);
		this._onDidChangeSession.fire(sessionId);
	}

	pauseMessageQueue(sessionId: string): void {
		this.model.pauseMessageQueue(sessionId);
		this._onDidChangeSession.fire(sessionId);
	}

	resumeMessageQueue(sessionId: string): void {
		this.model.resumeMessageQueue(sessionId);
		this._onDidChangeSession.fire(sessionId);
	}

	clearMessageQueue(sessionId: string): void {
		this.model.clearMessageQueue(sessionId);
		this._onDidChangeSession.fire(sessionId);
	}

	holdMessageQueueItem(sessionId: string, itemId: string, hold: ConversationQueueItemHoldReason): void {
		this.model.holdMessageQueueItem(sessionId, itemId, hold);
		this._onDidChangeSession.fire(sessionId);
	}

	releaseMessageQueueItemHold(sessionId: string, itemId: string): void {
		this.model.releaseMessageQueueItemHold(sessionId, itemId);
		this._onDidChangeSession.fire(sessionId);
	}

	getAutoDriveTasks(sessionId: string): readonly string[] {
		return this.model.getAutoDriveTasks(sessionId);
	}

	getAutoDriveTaskCount(sessionId: string): number {
		return this.model.getAutoDriveTaskCount(sessionId);
	}

	setAutoDriveTaskFixture(sessionId: string, tasks: readonly string[]): void {
		this.model.setAutoDriveTaskFixture(sessionId, tasks);
		this._onDidChangeSession.fire(sessionId);
	}

	isEngineConnected(): boolean {
		return this.engineConnected;
	}

	setEngineConnected(connected: boolean): void {
		if (this.engineConnected === connected) {
			return;
		}
		this.engineConnected = connected;
		this._onDidChangeEngineConnection.fire(connected);
	}
}
