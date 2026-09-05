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
 */
export async function createSessionRecoveringAlreadyExists(
	create: () => Promise<UniverseAgentCreateSessionResult>,
	listSessions: () => Promise<UniverseAgentListSessionsResult>,
	resumeSession: ((sessionId: string) => Promise<unknown>) | undefined,
	title: string | undefined,
): Promise<UniverseAgentCreateSessionResult> {
	try {
		return await create();
	} catch (error) {
		if (!isAlreadyExistsError(error)) {
			throw error;
		}
		return recoverSessionAfterAlreadyExists(listSessions, resumeSession, title);
	}
}

export async function recoverSessionAfterAlreadyExists(
	listSessions: () => Promise<UniverseAgentListSessionsResult>,
	resumeSession: ((sessionId: string) => Promise<unknown>) | undefined,
	title: string | undefined,
): Promise<UniverseAgentCreateSessionResult> {
	let listed: UniverseAgentListSessionsResult;
	try {
		listed = await listSessions();
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		throw new Error(`CreateSession ALREADY_EXISTS and List failed: ${detail}`, { cause: error });
	}
	const match = listed.sessions.find(session => !!title && session.title === title && session.sessionId)
		?? listed.sessions.find(session => !!session.sessionId);
	if (!match?.sessionId) {
		throw new Error('CreateSession ALREADY_EXISTS and List returned no session_id');
	}
	if (resumeSession) {
		await resumeSession(match.sessionId);
	}
	return { sessionId: match.sessionId };
}
