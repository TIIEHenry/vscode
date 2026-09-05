/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentCreateSessionResult,
	UniverseAgentListSessionsResult,
} from '../common/universeAgentTypes.js';
import { isAlreadyExistsError } from './grpc/grpcTransport.js';

/**
 * Every CreateSession entry (connection service / grpc client / host) must
 * List+Resume an existing engine session on ALREADY_EXISTS instead of
 * throwing status 6 to UI.
 *
 * Create's client_session_id (field 4) is the engine session id. When List
 * fails or is empty, Resume that id instead of throwing "no session_id".
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
		await resumeSession(match.sessionId);
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
	if (resumeSession) {
		await resumeSession(sessionId);
	}
	return { sessionId };
}
