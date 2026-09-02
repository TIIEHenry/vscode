/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ConversationStubModel, ConversationStubSession, ConversationStubTurn } from './conversationStubModel.js';

/** PRD-017 / D13: workspace-local roster; never roams via Settings Sync. */
export const CONVERSATION_ROSTER_STORAGE_KEY = 'conversation.roster.v1';

export type ConversationSessionSource = 'local' | 'engine-cache';

export interface PersistedConversationSession {
	readonly id: string;
	readonly title: string;
	readonly turns: readonly ConversationStubTurn[];
	readonly source: ConversationSessionSource;
}

export interface ConversationRosterEngineCache {
	readonly activeSessionId?: string;
	readonly sessions: readonly PersistedConversationSession[];
}

export interface ConversationRosterStorageV1 {
	readonly version: 1;
	readonly wasEverConnected: boolean;
	readonly activeSessionId: string;
	readonly nextTurnId: number;
	readonly localSessions: readonly PersistedConversationSession[];
	readonly engineCache?: ConversationRosterEngineCache;
}

const STORAGE_SCOPE = StorageScope.WORKSPACE;
const STORAGE_TARGET = StorageTarget.MACHINE;

export function loadConversationRosterStorage(storageService: IStorageService): ConversationRosterStorageV1 | undefined {
	const raw = storageService.get(CONVERSATION_ROSTER_STORAGE_KEY, STORAGE_SCOPE);
	if (!raw) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<ConversationRosterStorageV1>;
		if (parsed.version !== 1 || !Array.isArray(parsed.localSessions) || typeof parsed.activeSessionId !== 'string') {
			return undefined;
		}
		return {
			version: 1,
			wasEverConnected: parsed.wasEverConnected === true,
			activeSessionId: parsed.activeSessionId,
			nextTurnId: typeof parsed.nextTurnId === 'number' && parsed.nextTurnId > 0 ? parsed.nextTurnId : 100,
			localSessions: sanitizeSessions(parsed.localSessions, 'local'),
			engineCache: parsed.engineCache ? {
				activeSessionId: typeof parsed.engineCache.activeSessionId === 'string' ? parsed.engineCache.activeSessionId : undefined,
				sessions: sanitizeSessions(parsed.engineCache.sessions, 'engine-cache'),
			} : undefined,
		};
	} catch {
		return undefined;
	}
}

export function saveConversationRosterStorage(storageService: IStorageService, state: ConversationRosterStorageV1): void {
	storageService.store(
		CONVERSATION_ROSTER_STORAGE_KEY,
		JSON.stringify(state),
		STORAGE_SCOPE,
		STORAGE_TARGET,
	);
}

export function buildLocalSessionsFromModel(model: ConversationStubModel): PersistedConversationSession[] {
	return model.getSessions()
		.filter(session => session.source !== 'engine-cache')
		.map(session => ({
			id: session.id,
			title: session.title,
			turns: model.getTurns(session.id).map(cloneTurn),
			source: 'local' as const,
		}));
}

export function persistedSessionsToStubSessions(sessions: readonly PersistedConversationSession[]): ConversationStubSession[] {
	return sessions.map(session => ({
		id: session.id,
		title: session.title,
		source: session.source,
		turns: session.turns.map(cloneTurn),
	}));
}

function sanitizeSessions(
	sessions: readonly Partial<PersistedConversationSession>[] | undefined,
	defaultSource: ConversationSessionSource,
): PersistedConversationSession[] {
	if (!Array.isArray(sessions)) {
		return [];
	}
	const result: PersistedConversationSession[] = [];
	for (const session of sessions) {
		if (!session || typeof session.id !== 'string' || typeof session.title !== 'string' || !Array.isArray(session.turns)) {
			continue;
		}
		const source = session.source === 'engine-cache' ? 'engine-cache' : defaultSource;
		result.push({
			id: session.id,
			title: session.title,
			turns: session.turns.filter(isTurn).map(cloneTurn),
			source,
		});
	}
	return result;
}

function isTurn(value: unknown): value is ConversationStubTurn {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const turn = value as ConversationStubTurn;
	return typeof turn.id === 'string'
		&& typeof turn.kind === 'string'
		&& typeof turn.text === 'string';
}

function cloneTurn(turn: ConversationStubTurn): ConversationStubTurn {
	return { ...turn };
}
