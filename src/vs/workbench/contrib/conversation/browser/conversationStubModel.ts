/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ConversationVisualizeArgs } from '../common/conversationVisualize.js';
import {
	ConversationTrajectoryRecord,
	mergeTrajectoryFixtureExtras,
	projectTurnsToTrajectory,
} from './conversationTrajectoryModel.js';

export type StubTurnKind = 'user' | 'assistant' | 'confirmation' | 'thinking' | 'tool' | 'visualization';
export type ConfirmationStatus = 'pending' | 'allowed' | 'skipped';

export interface ConversationStubTurn {
	readonly id: string;
	readonly kind: StubTurnKind;
	readonly text: string;
	readonly status?: ConfirmationStatus;
	readonly stubEcho?: boolean;
	readonly toolName?: string;
	readonly summary?: string;
	readonly payload?: string;
	readonly visualize?: ConversationVisualizeArgs;
}

export interface ConversationStubSession {
	readonly id: string;
	title: string;
	turns: ConversationStubTurn[];
}

function createUntitledFixtureTurns(): ConversationStubTurn[] {
	return [
		{ id: 'untitled-u1', kind: 'user', text: localize('conversationStub.untitledUser', "Help me draft the README.") },
		{
			id: 'untitled-t1',
			kind: 'thinking',
			text: 'Stub: outline sections',
			payload: 'Stub: Consider intro, setup, usage, and license sections.',
		},
		{
			id: 'untitled-tool1',
			kind: 'tool',
			text: 'Stub: README.md',
			toolName: 'read',
			summary: 'Stub: README.md',
			payload: 'Stub: # Project\n\n(existing readme content)',
		},
		{
			id: 'untitled-t2',
			kind: 'thinking',
			text: 'Stub: draft',
			payload: 'Stub: Draft updated sections based on read output.',
		},
		{
			id: 'untitled-tool2',
			kind: 'tool',
			text: 'Stub: README.md',
			toolName: 'write',
			summary: 'Stub: README.md',
			payload: 'Stub: Wrote draft to README.md.',
		},
		{
			id: 'untitled-a1',
			kind: 'assistant',
			text: localize('conversationStub.untitledAssistant', "Stub: README draft ready."),
			stubEcho: true,
		},
		{
			id: 'untitled-c1',
			kind: 'confirmation',
			text: localize('conversationStub.untitledConfirmation', "Allow write to README.md?"),
			status: 'pending',
		},
	];
}

function createVisualizeFixtureTurns(): ConversationStubTurn[] {
	const diagramMermaid = [
		'flowchart TD',
		'  frozen["冻结"] --> active["进行中"] --> backlog["未立项"]',
	].join('\n');

	return [
		{
			id: 'visualize-u1',
			kind: 'user',
			text: localize('conversationStub.visualizeUser', "Show the implementation roadmap."),
		},
		{
			id: 'visualize-v1',
			kind: 'visualization',
			text: '',
			visualize: {
				type: 'diagram',
				title: localize('conversationStub.visualizeDiagramTitle', "Stub: 实现路线状态"),
				mermaid: diagramMermaid,
			},
		},
		{
			id: 'visualize-v2',
			kind: 'visualization',
			text: '',
			visualize: {
				type: 'comparison',
				title: localize('conversationStub.visualizeComparisonTitle', "Stub: host options"),
				options: [
					{
						name: localize('conversationStub.visualizeDomCard', "Stub: DOM card"),
						description: localize('conversationStub.visualizeDomCardDesc', "Pure workbench DOM; no webview."),
						pros: [localize('conversationStub.visualizeDomPro', "Simple layout")],
						cons: [localize('conversationStub.visualizeDomCon', "No mermaid runtime")],
						recommended: false,
					},
					{
						name: localize('conversationStub.visualizeWebviewHost', "Stub: webview host"),
						description: localize('conversationStub.visualizeWebviewHostDesc', "Mermaid via extension bundle."),
						pros: [localize('conversationStub.visualizeWebviewPro', "Theme-aware SVG")],
						cons: [localize('conversationStub.visualizeWebviewCon', "Requires extension")],
						recommended: true,
					},
				],
			},
		},
		{
			id: 'visualize-a1',
			kind: 'assistant',
			text: localize('conversationStub.visualizeAssistant', "Stub echo — visualize cards above are fixtures, no engine."),
			stubEcho: true,
		},
	];
}

function createSeedSessions(): ConversationStubSession[] {
	return [
		{
			id: 'untitled',
			title: localize('conversationLens.sessionUntitled', "Untitled session"),
			turns: createUntitledFixtureTurns(),
		},
		{
			id: 'visualize',
			title: localize('conversationStub.visualizeSessionTitle', "Visualize (Stub)"),
			turns: createVisualizeFixtureTurns(),
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
		nextTurnId = 100;
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

	renameSession(sessionId: string, title: string): boolean {
		const trimmed = title.trim();
		if (!trimmed) {
			return false;
		}
		const session = this.sessions.find(s => s.id === sessionId);
		if (!session || session.title === trimmed) {
			return false;
		}
		session.title = trimmed;
		return true;
	}

	deleteSession(sessionId: string): boolean {
		const index = this.sessions.findIndex(s => s.id === sessionId);
		if (index < 0) {
			return false;
		}

		const wasActive = this.activeSessionId === sessionId;
		this.sessions.splice(index, 1);

		if (this.sessions.length === 0) {
			const id = nextId('session');
			this.sessions.push({
				id,
				title: localize('conversationLens.sessionUntitled', "Untitled session"),
				turns: [],
			});
			this.activeSessionId = id;
		} else if (wasActive) {
			const newIndex = Math.min(index, this.sessions.length - 1);
			this.activeSessionId = this.sessions[newIndex].id;
		}

		return true;
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

	getTrajectoryRecords(sessionId: string): readonly ConversationTrajectoryRecord[] {
		const turns = this.getTurns(sessionId);
		const projected = projectTurnsToTrajectory(turns);
		return mergeTrajectoryFixtureExtras(sessionId, projected);
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

	appendConfirmationTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		const session = this.sessions.find(s => s.id === sessionId);
		if (!session) {
			return undefined;
		}
		const turn: ConversationStubTurn = { id: nextId(sessionId), kind: 'confirmation', text, status: 'pending' };
		session.turns.push(turn);
		return turn;
	}

	appendThinkingTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		const session = this.sessions.find(s => s.id === sessionId);
		if (!session) {
			return undefined;
		}
		const turn: ConversationStubTurn = { id: nextId(sessionId), kind: 'thinking', text };
		session.turns.push(turn);
		return turn;
	}

	appendToolTurn(sessionId: string, text: string): ConversationStubTurn | undefined {
		const session = this.sessions.find(s => s.id === sessionId);
		if (!session) {
			return undefined;
		}
		const turn: ConversationStubTurn = { id: nextId(sessionId), kind: 'tool', text };
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

	deleteTurn(sessionId: string, turnId: string): boolean {
		const session = this.sessions.find(s => s.id === sessionId);
		if (!session) {
			return false;
		}
		const index = session.turns.findIndex(t => t.id === turnId);
		if (index < 0) {
			return false;
		}
		session.turns.splice(index, 1);
		return true;
	}
}
