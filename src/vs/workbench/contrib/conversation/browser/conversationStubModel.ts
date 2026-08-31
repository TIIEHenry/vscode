/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

export type StubTurnKind = 'user' | 'assistant' | 'confirmation';
export type ConfirmationStatus = 'pending' | 'allowed' | 'skipped';

export interface ConversationStubTurn {
	readonly id: string;
	readonly kind: StubTurnKind;
	readonly text: string;
	readonly status?: ConfirmationStatus;
	readonly stubEcho?: boolean;
}

export interface ConversationStubSession {
	readonly id: string;
	title: string;
	turns: ConversationStubTurn[];
}

function createSeedSessions(): ConversationStubSession[] {
	return [
		{
			id: 'untitled',
			title: localize('conversationLens.sessionUntitled', "Untitled session"),
			turns: [
				{ id: 'untitled-u1', kind: 'user', text: localize('conversationLens.stubUntitledUser', "Help me scaffold the project README.") },
				{ id: 'untitled-a1', kind: 'assistant', text: localize('conversationLens.stubUntitledAssistant', "I can draft a README with setup and contribution sections.") },
				{ id: 'untitled-c1', kind: 'confirmation', text: localize('conversationLens.confirmationMessage', "Write README.md?"), status: 'pending' },
			],
		},
		{
			id: 'tour',
			title: localize('conversationLens.sessionTour', "Product tour"),
			turns: [
				{ id: 'tour-u1', kind: 'user', text: localize('conversationLens.stubTourUser1', "What lives in the center lens?") },
				{ id: 'tour-a1', kind: 'assistant', text: localize('conversationLens.stubTourAssistant1', "SessionBar, timeline, and dock — not ChatEditor.") },
				{ id: 'tour-u2', kind: 'user', text: localize('conversationLens.stubTourUser2', "Where does Inbox go?") },
				{ id: 'tour-a2', kind: 'assistant', text: localize('conversationLens.stubTourAssistant2', "Dock top status row; no fake queue list without authority.") },
			],
		},
		{
			id: 'blank',
			title: localize('conversationLens.sessionBlank', "Blank session"),
			turns: [],
		},
	];
}

/** Exported for tests that need stable seed metadata. */
export const CONVERSATION_STUB_SEED_SESSIONS: readonly ConversationStubSession[] = createSeedSessions();

let nextTurnId = 1;

function nextId(prefix: string): string {
	return `${prefix}-${nextTurnId++}`;
}

/**
 * In-memory stub conversation model (no engine, no persistence).
 */
export class ConversationStubModel {

	private readonly sessions: ConversationStubSession[];
	private activeSessionId: string;

	constructor() {
		this.sessions = createSeedSessions().map(session => ({
			...session,
			turns: session.turns.map(turn => ({ ...turn })),
		}));
		this.activeSessionId = this.sessions[0].id;
	}

	getSessions(): readonly ConversationStubSession[] {
		return this.sessions;
	}

	getActiveSessionId(): string {
		return this.activeSessionId;
	}

	getActiveSession(): ConversationStubSession {
		return this.sessions.find(s => s.id === this.activeSessionId) ?? this.sessions[0];
	}

	switchSession(sessionId: string): void {
		if (this.sessions.some(s => s.id === sessionId)) {
			this.activeSessionId = sessionId;
		}
	}

	createSession(): string {
		const id = nextId('session');
		const title = this.createUniqueNewSessionTitle();
		this.sessions.push({ id, title, turns: [] });
		this.activeSessionId = id;
		return id;
	}

	private createUniqueNewSessionTitle(): string {
		const base = localize('conversationLens.sessionNew', "New session");
		if (!this.sessions.some(s => s.title === base)) {
			return base;
		}
		let n = 2;
		while (this.sessions.some(s => s.title === `${base} ${n}`)) {
			n++;
		}
		return `${base} ${n}`;
	}

	getTurns(sessionId: string): readonly ConversationStubTurn[] {
		return this.sessions.find(s => s.id === sessionId)?.turns ?? [];
	}

	appendUserTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		const session = this.sessions.find(s => s.id === sessionId);
		if (!session) {
			return undefined;
		}
		const turn: ConversationStubTurn = { id: nextId(sessionId), kind: 'user', text };
		session.turns.push(turn);
		return turn;
	}

	appendStubEchoAssistant(sessionId: string, text: string): ConversationStubTurn | undefined {
		const session = this.sessions.find(s => s.id === sessionId);
		if (!session) {
			return undefined;
		}
		const turn: ConversationStubTurn = { id: nextId(sessionId), kind: 'assistant', text, stubEcho: true };
		session.turns.push(turn);
		return turn;
	}

	resolveConfirmation(sessionId: string, turnId: string, status: 'allowed' | 'skipped'): void {
		const session = this.sessions.find(s => s.id === sessionId);
		const turn = session?.turns.find(t => t.id === turnId && t.kind === 'confirmation') as ConversationStubTurn | undefined;
		if (turn) {
			(turn as { status?: ConfirmationStatus }).status = status;
		}
	}

	countPendingConfirmations(sessionId: string): number {
		return this.getTurns(sessionId).filter(t => t.kind === 'confirmation' && t.status === 'pending').length;
	}
}
