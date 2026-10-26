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
	readonly workDir?: string;
	readonly turnCount?: number;
	readonly lastAccessedAt?: number;
}

export interface ConversationRosterEngineCache {
	readonly activeSessionId?: string;
	readonly sessions: readonly PersistedConversationSession[];
}

export interface ConversationRosterStorageV1 {
	readonly version: 1;
	/** Absent in old caches, where completed tool status was omitted. */
	readonly toolStatusEncoding?: 'explicit';
	readonly wasEverConnected: boolean;
	readonly activeSessionId: string;
	readonly nextTurnId: number;
	readonly localSessions: readonly PersistedConversationSession[];
	/** Legacy unkeyed cache. Only the unknown-identity bucket. */
	readonly engineCache?: ConversationRosterEngineCache;
	/** Known engines, keyed by engineIdentityId. */
	readonly engineCaches?: Readonly<Record<string, ConversationRosterEngineCache>>;
	/** Last engine identity used to select the read-only roster bucket after disconnect / cold start. */
	readonly lastDisplayedEngineIdentityId?: string;
}

/** Non-empty engine identity. Anything else is the unknown-identity bucket. */
export function engineIdentityKey(engineIdentityId: string | undefined): string | undefined {
	return typeof engineIdentityId === 'string' && engineIdentityId.length > 0 ? engineIdentityId : undefined;
}

/** Read the bucket for this snapshot. A known identity never sees the unkeyed legacy cache. */
export function selectEngineCache(
	state: ConversationRosterStorageV1 | undefined,
	engineIdentityId: string | undefined,
): ConversationRosterEngineCache | undefined {
	if (!state) {
		return undefined;
	}
	const key = engineIdentityKey(engineIdentityId);
	if (!key) {
		return state.engineCache;
	}
	return state.engineCaches?.[key];
}

/**
 * Write one bucket. Known identities do not replace `engineCache` or other keys.
 * An unknown identity does not write into `engineCaches`.
 */
export function withEngineCache(
	state: ConversationRosterStorageV1,
	engineIdentityId: string | undefined,
	cache: ConversationRosterEngineCache | undefined,
): ConversationRosterStorageV1 {
	const key = engineIdentityKey(engineIdentityId);
	if (!key) {
		return { ...state, engineCache: cache };
	}
	const buckets: Record<string, ConversationRosterEngineCache> = { ...(state.engineCaches ?? {}) };
	if (cache) {
		buckets[key] = cache;
	} else {
		delete buckets[key];
	}
	return {
		...state,
		engineCaches: Object.keys(buckets).length > 0 ? buckets : undefined,
	};
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
		const legacyToolStatus = parsed.toolStatusEncoding !== 'explicit';
		return {
			version: 1,
			toolStatusEncoding: 'explicit',
			wasEverConnected: parsed.wasEverConnected === true,
			activeSessionId: parsed.activeSessionId,
			nextTurnId: typeof parsed.nextTurnId === 'number' && parsed.nextTurnId > 0 ? parsed.nextTurnId : 100,
			localSessions: sanitizeSessions(parsed.localSessions, 'local', legacyToolStatus),
			engineCache: parseEngineCache(parsed.engineCache, legacyToolStatus),
			engineCaches: parseEngineCaches(parsed.engineCaches, legacyToolStatus),
			lastDisplayedEngineIdentityId: engineIdentityKey(
				typeof parsed.lastDisplayedEngineIdentityId === 'string' ? parsed.lastDisplayedEngineIdentityId : undefined,
			),
		};
	} catch {
		return undefined;
	}
}

export function saveConversationRosterStorage(storageService: IStorageService, state: ConversationRosterStorageV1): void {
	storageService.store(
		CONVERSATION_ROSTER_STORAGE_KEY,
		JSON.stringify({ ...state, toolStatusEncoding: 'explicit' }),
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
			...(session.workDir ? { workDir: session.workDir } : {}),
			...(typeof session.turnCount === 'number' && Number.isFinite(session.turnCount) ? { turnCount: session.turnCount } : {}),
			...(typeof session.lastAccessedAt === 'number' && Number.isFinite(session.lastAccessedAt) && session.lastAccessedAt > 0 ? { lastAccessedAt: session.lastAccessedAt } : {}),
		}));
}

export function persistedSessionsToStubSessions(sessions: readonly PersistedConversationSession[]): ConversationStubSession[] {
	return sessions.map(session => ({
		id: session.id,
		title: session.title,
		source: session.source,
		turns: session.turns.map(cloneTurn),
		...(session.workDir ? { workDir: session.workDir } : {}),
		...(typeof session.turnCount === 'number' && Number.isFinite(session.turnCount) ? { turnCount: session.turnCount } : {}),
		...(typeof session.lastAccessedAt === 'number' && Number.isFinite(session.lastAccessedAt) && session.lastAccessedAt > 0 ? { lastAccessedAt: session.lastAccessedAt } : {}),
	}));
}

function isEngineIdentityKey(key: string): boolean {
	return key.length > 0 && key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
}

function parseEngineCache(raw: unknown, legacyToolStatus: boolean): ConversationRosterEngineCache | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const cache = raw as Partial<ConversationRosterEngineCache>;
	return {
		activeSessionId: typeof cache.activeSessionId === 'string' ? cache.activeSessionId : undefined,
		sessions: sanitizeSessions(cache.sessions, 'engine-cache', legacyToolStatus),
	};
}

function parseEngineCaches(raw: unknown, legacyToolStatus: boolean): Readonly<Record<string, ConversationRosterEngineCache>> | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return undefined;
	}
	const buckets: Record<string, ConversationRosterEngineCache> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (!isEngineIdentityKey(key)) {
			continue;
		}
		const cache = parseEngineCache(value, legacyToolStatus);
		if (!cache) {
			continue;
		}
		buckets[key] = cache;
	}
	return Object.keys(buckets).length > 0 ? buckets : undefined;
}

function sanitizeSessions(
	sessions: readonly Partial<PersistedConversationSession>[] | undefined,
	defaultSource: ConversationSessionSource,
	legacyToolStatus: boolean,
): PersistedConversationSession[] {
	if (!Array.isArray(sessions)) {
		return [];
	}
	const result: PersistedConversationSession[] = [];
	for (const session of sessions) {
		if (!session || typeof session.id !== 'string' || typeof session.title !== 'string' || !Array.isArray(session.turns)) {
			continue;
		}
		const source = defaultSource;
		const turnCount = typeof session.turnCount === 'number' && Number.isFinite(session.turnCount) ? session.turnCount : undefined;
		const lastAccessedAt = typeof session.lastAccessedAt === 'number' && Number.isFinite(session.lastAccessedAt) && session.lastAccessedAt > 0 ? session.lastAccessedAt : undefined;
		result.push({
			id: session.id,
			title: session.title,
			// Migrate every bucket before a later save stamps the root encoding marker.
			turns: session.turns.filter(isTurn).map(turn => legacyToolStatus && turn.kind === 'tool' && turn.toolStatus === undefined
				? { ...turn, toolStatus: 'completed' as const }
				: cloneTurn(turn)),
			source,
			...(typeof session.workDir === 'string' && session.workDir ? { workDir: session.workDir } : {}),
			...(turnCount !== undefined ? { turnCount } : {}),
			...(lastAccessedAt !== undefined ? { lastAccessedAt } : {}),
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
