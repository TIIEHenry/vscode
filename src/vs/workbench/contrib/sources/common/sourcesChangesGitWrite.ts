/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentWriteGitApplyHunksRequest,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitStagePathsRequest,
	UniverseAgentWriteGitWriteResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Sources Changes Stage → WriteGitStagePaths. Empty sessionId / commands / argv are still sent. */
export function canSendSourcesGitStagePaths(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Sources Changes Commit → WriteGitCommit. Empty sessionId / message are still sent. */
export function canSendSourcesGitCommit(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/** Sources Review Accept → WriteGitApplyHunks. Empty sessionId / argv / patches are still sent. */
export function canSendSourcesGitApplyHunks(connected: boolean, hasHook: boolean): boolean {
	return connected && hasHook;
}

/**
 * Always send empty `sessionId` as-is.
 * Each path becomes one command `{ argv: [path] }`. Empty path / empty
 * `paths` stay as-is. This write does not invent `git add` or a session.
 */
export function sourcesGitStagePathsRequest(paths: readonly string[]): UniverseAgentWriteGitStagePathsRequest {
	return {
		sessionId: '',
		commands: paths.map(path => ({ argv: [path] })),
	};
}

/**
 * Always send empty `sessionId` as-is.
 * Pass through empty `message` as-is (no default / no trim).
 * `signOff` / `amend` stay false.
 */
export function sourcesGitCommitRequest(message: string): UniverseAgentWriteGitCommitRequest {
	return {
		sessionId: '',
		message,
		signOff: false,
		amend: false,
	};
}

/**
 * Always send empty `sessionId` as-is.
 * Pass through empty `argv` / `patches` as-is (no default hunk / no path invent).
 */
export function sourcesGitApplyHunksRequest(
	argv: readonly string[] = [],
	patches: readonly string[] = [],
): UniverseAgentWriteGitApplyHunksRequest {
	return {
		sessionId: '',
		argv,
		patches,
	};
}

/** Honest write failure text. Empty `errorMessage` stays empty. */
export function sourcesGitWriteFailureDetail(result: UniverseAgentWriteGitWriteResult): string {
	return result.errorMessage;
}

export async function tryWriteSourcesGitStagePaths(
	connected: boolean,
	hook: ((request: UniverseAgentWriteGitStagePathsRequest) => Promise<UniverseAgentWriteGitWriteResult>) | undefined,
	paths: readonly string[],
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitStagePaths(connected, typeof hook === 'function') || !hook) {
		return undefined;
	}
	return hook(sourcesGitStagePathsRequest(paths));
}

export async function tryWriteSourcesGitCommit(
	connected: boolean,
	hook: ((request: UniverseAgentWriteGitCommitRequest) => Promise<UniverseAgentWriteGitWriteResult>) | undefined,
	message: string,
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitCommit(connected, typeof hook === 'function') || !hook) {
		return undefined;
	}
	return hook(sourcesGitCommitRequest(message));
}

export async function tryWriteSourcesGitApplyHunks(
	connected: boolean,
	hook: ((request: UniverseAgentWriteGitApplyHunksRequest) => Promise<UniverseAgentWriteGitWriteResult>) | undefined,
	argv: readonly string[] = [],
	patches: readonly string[] = [],
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitApplyHunks(connected, typeof hook === 'function') || !hook) {
		return undefined;
	}
	return hook(sourcesGitApplyHunksRequest(argv, patches));
}
