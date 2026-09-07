/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentCreateSessionResult,
	UniverseAgentListSessionsResult,
	UniverseAgentResumeSessionRequest,
	UniverseAgentResumeSessionResult,
} from '../common/universeAgentTypes.js';
import { isAlreadyExistsError } from './grpc/grpcTransport.js';

export type ResumeSessionFn = (sessionId: string) => Promise<unknown>;

/**
 * Host / facade that may have dropped the optional `resumeSession` method
 * (IPC Channel Client, `createRemoteForwardingProxy` undefined own-property).
 * Bind still Resumes via `transport.resumeSession` when present.
 */
export type ResumeSessionHost = {
	readonly resumeSession?: (request: UniverseAgentResumeSessionRequest) => Promise<UniverseAgentResumeSessionResult>;
	readonly transport?: {
		readonly resumeSession?: (request: UniverseAgentResumeSessionRequest) => Promise<UniverseAgentResumeSessionResult>;
	};
};

export function resolveResumeSession(
	host: ResumeSessionHost,
): (request: UniverseAgentResumeSessionRequest) => Promise<UniverseAgentResumeSessionResult> {
	if (typeof host.resumeSession === 'function') {
		return request => host.resumeSession!(request);
	}
	const transportResume = host.transport?.resumeSession;
	if (typeof transportResume === 'function') {
		return request => transportResume.call(host.transport, request);
	}
	throw new Error('SessionService.Resume is required before CreateSession');
}

export async function callResumeSession(
	host: ResumeSessionHost,
	sessionId: string,
): Promise<UniverseAgentResumeSessionResult> {
	return resolveResumeSession(host)({ sessionId });
}

export function bindResumeSessionFn(host: ResumeSessionHost): ResumeSessionFn {
	return sessionId => callResumeSession(host, sessionId);
}

/**
 * Connection-service CreateSession entry wraps this once (grpc transport
 * is a raw unary). List+Resume an existing engine session on ALREADY_EXISTS
 * instead of throwing status 6 to UI.
 *
 * Create's client_session_id (field 4) is the engine session id. When List
 * fails or is empty, Resume that id instead of throwing "no session_id".
 * Resume `{ ok: false }` or a thrown Resume is not treated as Create success.
 */
export async function createSessionRecoveringAlreadyExists(
	create: () => Promise<UniverseAgentCreateSessionResult>,
	listSessions: () => Promise<UniverseAgentListSessionsResult>,
	resumeSession: ((sessionId: string) => Promise<unknown>) | undefined,
	title: string | undefined,
	clientSessionId?: string,
): Promise<UniverseAgentCreateSessionResult> {
	try {
		return await create();
	} catch (error) {
		if (!isAlreadyExistsError(error)) {
			throw error;
		}
		return recoverSessionAfterAlreadyExists(listSessions, resumeSession, title, clientSessionId);
	}
}

/**
 * Coalesce concurrent Create RPCs that share a `clientSessionId`. Callers
 * without an id are not joined. The inflight map is owned by the entry
 * (connection service).
 */
export function runCreateSessionSingleFlight(
	inflight: Map<string, Promise<UniverseAgentCreateSessionResult>>,
	clientSessionId: string | undefined,
	create: () => Promise<UniverseAgentCreateSessionResult>,
): Promise<UniverseAgentCreateSessionResult> {
	const key = clientSessionId?.trim();
	if (!key) {
		return create();
	}
	const existing = inflight.get(key);
	if (existing) {
		return existing;
	}
	const task = Promise.resolve().then(create).finally(() => {
		inflight.delete(key);
	});
	inflight.set(key, task);
	return task;
}

export async function recoverSessionAfterAlreadyExists(
	listSessions: () => Promise<UniverseAgentListSessionsResult>,
	resumeSession: ((sessionId: string) => Promise<unknown>) | undefined,
	title: string | undefined,
	clientSessionId?: string,
): Promise<UniverseAgentCreateSessionResult> {
	let listed: UniverseAgentListSessionsResult;
	try {
		listed = await listSessions();
	} catch (error) {
		const fallback = await resumeClientSessionIfKnown(resumeSession, clientSessionId);
		if (fallback) {
			return fallback;
		}
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`CreateSession ALREADY_EXISTS and List failed: ${detail}`, { cause: error });
	}
	const match = listed.sessions.find(session => !!title && session.title === title && session.sessionId)
		?? listed.sessions.find(session => !!session.sessionId);
	if (!match?.sessionId) {
		const fallback = await resumeClientSessionIfKnown(resumeSession, clientSessionId);
		if (fallback) {
			return fallback;
		}
		throw new Error('CreateSession ALREADY_EXISTS and List returned no session_id');
	}
	if (resumeSession) {
		const result = await resumeSession(match.sessionId);
		assertResumeSucceeded(result, match.sessionId);
	}
	return { sessionId: match.sessionId };
}

async function resumeClientSessionIfKnown(
	resumeSession: ((sessionId: string) => Promise<unknown>) | undefined,
	clientSessionId: string | undefined,
): Promise<UniverseAgentCreateSessionResult | undefined> {
	const sessionId = clientSessionId?.trim();
	if (!sessionId) {
		return undefined;
	}
	if (!resumeSession) {
		return undefined;
	}
	const result = await resumeSession(sessionId);
	assertResumeSucceeded(result, sessionId);
	return { sessionId };
}

function assertResumeSucceeded(result: unknown, sessionId: string): void {
	if (!result || typeof result !== 'object' || !('ok' in result)) {
		return;
	}
	if ((result as { ok: unknown }).ok === true) {
		return;
	}
	const message = 'message' in result && typeof (result as { message?: unknown }).message === 'string'
		? (result as { message: string }).message
		: 'ok=false';
	throw new Error(`CreateSession ALREADY_EXISTS and Resume(${sessionId}) failed: ${message}`);
}
