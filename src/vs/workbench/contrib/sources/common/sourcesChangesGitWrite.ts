/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type {
	UniverseAgentWriteGitApplyHunksRequest,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitStagePathsRequest,
	UniverseAgentWriteGitWriteResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	isSourcesChangeRevertible,
	isSourcesChangeStageable,
	isSourcesChangeUnstageable,
} from './sourcesChangesGit.js';

/** Roster / engine git RPCs require a real session. Empty sessionId → no hook. */
export function hasSourcesGitSessionId(sessionId: string): boolean {
	return sessionId !== '';
}

/**
 * Write door for Stage / Commit / Accept.
 * `connected` is still `isEngineConnected()` (D283). Pairing-hold leftover
 * and leftover-looks-live (`connected===true` + pairingPending) both refuse.
 */
export function isSourcesGitWriteLive(connected: boolean, pairingHold = false): boolean {
	return connected && !pairingHold;
}

/** Sources Changes Stage → WriteGitStagePaths. Empty sessionId does not call the hook. */
export function canSendSourcesGitStagePaths(connected: boolean, hasHook: boolean, sessionId: string, pairingHold = false): boolean {
	return isSourcesGitWriteLive(connected, pairingHold) && hasHook && hasSourcesGitSessionId(sessionId);
}

/** Sources Changes Commit → WriteGitCommit. Empty sessionId does not call the hook. */
export function canSendSourcesGitCommit(connected: boolean, hasHook: boolean, sessionId: string, pairingHold = false): boolean {
	return isSourcesGitWriteLive(connected, pairingHold) && hasHook && hasSourcesGitSessionId(sessionId);
}

/** Sources Review Accept → WriteGitApplyHunks. Connection + hook only; empty session or empty patches are refused in tryWrite. */
export function canSendSourcesGitApplyHunks(connected: boolean, hasHook: boolean, pairingHold = false): boolean {
	return isSourcesGitWriteLive(connected, pairingHold) && hasHook;
}

/** Accept RPC payload: both sides required. Empty sessionId or empty / whitespace-only patches → no hook. */
export function hasSourcesGitApplyHunksPayload(sessionId: string, patches: readonly string[]): boolean {
	return hasSourcesGitSessionId(sessionId) && patches.some(patch => patch.trim() !== '');
}

/**
 * Pass through `sessionId` as-is. Each path becomes one command `{ argv: [path] }`.
 * Empty path / empty `paths` stay as-is. This write does not invent `git add`.
 */
export function sourcesGitStagePathsRequest(sessionId: string, paths: readonly string[]): UniverseAgentWriteGitStagePathsRequest {
	return {
		sessionId,
		commands: paths.map(path => ({ argv: [path] })),
	};
}

/**
 * Pass through `sessionId` / empty `message` as-is (no default / no trim).
 * `signOff` / `amend` stay false.
 */
export function sourcesGitCommitRequest(sessionId: string, message: string): UniverseAgentWriteGitCommitRequest {
	return {
		sessionId,
		message,
		signOff: false,
		amend: false,
	};
}

/**
 * Pass through `sessionId` / `argv` / `patches` as-is.
 * Defaults stay empty. Does not invent a session, path, or hunk.
 */
export function sourcesGitApplyHunksRequest(
	sessionId: string = '',
	argv: readonly string[] = [],
	patches: readonly string[] = [],
): UniverseAgentWriteGitApplyHunksRequest {
	return {
		sessionId,
		argv,
		patches,
	};
}

/** Honest write failure text. Empty `errorMessage` stays empty. */
export function sourcesGitWriteFailureDetail(result: UniverseAgentWriteGitWriteResult): string {
	return result.errorMessage;
}

/** Hook answered and GitService performed the write. `success` alone is not enough. */
export function isSourcesGitWriteAccepted(result: UniverseAgentWriteGitWriteResult | undefined): boolean {
	return !!result && result.supported && result.success;
}

/** Hook answered `supported: false` — treat as unavailable, not success or hard fail. */
export function isSourcesGitWriteUnsupported(result: UniverseAgentWriteGitWriteResult | undefined): boolean {
	return !!result && !result.supported;
}

/** Review Accept is ApplyHunks only. No payload → hide Accept; local SCM stays on Stage. */
export function canShowSourcesReviewAccept(canWriteAccept: boolean, hasApplyHunksPayload: boolean): boolean {
	return canWriteAccept && hasApplyHunksPayload;
}

export type SourcesGitWriteAttemptResult =
	| { readonly kind: 'accepted' }
	| { readonly kind: 'failed'; readonly detail: string }
	| { readonly kind: 'fallback' };

/**
 * Shared write gate for Changes / Review / Panel.
 * `supported && success` is the only accept; `supported: false` or no
 * answer means fall back to local git. Do not treat `success` alone as ok.
 */
export async function attemptSourcesGitWrite(
	write: () => Promise<UniverseAgentWriteGitWriteResult | undefined>,
): Promise<SourcesGitWriteAttemptResult> {
	const result = await write();
	if (isSourcesGitWriteAccepted(result)) {
		return { kind: 'accepted' };
	}
	if (result && !isSourcesGitWriteUnsupported(result)) {
		return { kind: 'failed', detail: sourcesGitWriteFailureDetail(result) };
	}
	return { kind: 'fallback' };
}

export interface ISourcesDiffWriteActionVisibility {
	readonly showStage: boolean;
	readonly showAccept: boolean;
	readonly showRevert: boolean;
	readonly showUnstage: boolean;
	/** Staged row but no `git.unstage` + SCM — honest unavailable, not a fake button. */
	readonly unstageUnavailable: boolean;
}

export function resolveSourcesDiffWriteActions(input: {
	readonly groupId: string;
	readonly hasScmResource: boolean;
	readonly canWriteStage: boolean;
	readonly canWriteAccept: boolean;
	readonly hasApplyHunksPayload: boolean;
	readonly hasGitStageCommand: boolean;
	readonly hasGitUnstageCommand: boolean;
	readonly hasGitCleanCommand: boolean;
}): ISourcesDiffWriteActionVisibility {
	const stageable = isSourcesChangeStageable(input.groupId);
	const unstageable = isSourcesChangeUnstageable(input.groupId);
	const revertible = isSourcesChangeRevertible(input.groupId);
	const hasLocalStage = stageable && input.hasScmResource && input.hasGitStageCommand;
	const hasLocalUnstage = unstageable && input.hasScmResource && input.hasGitUnstageCommand;
	const hasLocalRevert = revertible && input.hasScmResource && input.hasGitCleanCommand;

	return {
		showStage: stageable && (input.canWriteStage || hasLocalStage),
		showAccept: canShowSourcesReviewAccept(input.canWriteAccept, input.hasApplyHunksPayload),
		showRevert: hasLocalRevert,
		showUnstage: hasLocalUnstage,
		unstageUnavailable: unstageable && !hasLocalUnstage,
	};
}

export type SourcesChangesRowActionKind = 'stage' | 'unstage' | 'unstageUnavailable' | 'hidden';

/**
 * Changes list row control. Staged git-source rows without local Unstage
 * stay visible as disabled + unavailable text, not a hidden or fake button.
 */
export function resolveSourcesChangesRowAction(input: {
	readonly groupId: string;
	readonly hasScmResource: boolean;
	readonly canWriteStage: boolean;
	readonly hasGitStageCommand: boolean;
	readonly hasGitUnstageCommand: boolean;
}): SourcesChangesRowActionKind {
	const actions = resolveSourcesDiffWriteActions({
		groupId: input.groupId,
		hasScmResource: input.hasScmResource,
		canWriteStage: input.canWriteStage,
		canWriteAccept: false,
		hasApplyHunksPayload: false,
		hasGitStageCommand: input.hasGitStageCommand,
		hasGitUnstageCommand: input.hasGitUnstageCommand,
		hasGitCleanCommand: false,
	});
	if (actions.showStage) {
		return 'stage';
	}
	if (actions.showUnstage) {
		return 'unstage';
	}
	if (actions.unstageUnavailable) {
		return 'unstageUnavailable';
	}
	return 'hidden';
}

export function sourcesGitUnstageUnavailableMessage(): string {
	return localize('sourcesChangesGitWrite.unstageUnavailable', "Unstage is not available.");
}

export async function tryWriteSourcesGitStagePaths(
	connected: boolean,
	hook: ((request: UniverseAgentWriteGitStagePathsRequest) => Promise<UniverseAgentWriteGitWriteResult>) | undefined,
	sessionId: string,
	paths: readonly string[],
	pairingHold = false,
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitStagePaths(connected, typeof hook === 'function', sessionId, pairingHold) || !hook) {
		return undefined;
	}
	return hook(sourcesGitStagePathsRequest(sessionId, paths));
}

export async function tryWriteSourcesGitCommit(
	connected: boolean,
	hook: ((request: UniverseAgentWriteGitCommitRequest) => Promise<UniverseAgentWriteGitWriteResult>) | undefined,
	sessionId: string,
	message: string,
	pairingHold = false,
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitCommit(connected, typeof hook === 'function', sessionId, pairingHold) || !hook) {
		return undefined;
	}
	return hook(sourcesGitCommitRequest(sessionId, message));
}

export async function tryWriteSourcesGitApplyHunks(
	connected: boolean,
	hook: ((request: UniverseAgentWriteGitApplyHunksRequest) => Promise<UniverseAgentWriteGitWriteResult>) | undefined,
	sessionId: string = '',
	argv: readonly string[] = [],
	patches: readonly string[] = [],
	pairingHold = false,
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitApplyHunks(connected, typeof hook === 'function', pairingHold) || !hook) {
		return undefined;
	}
	if (!hasSourcesGitApplyHunksPayload(sessionId, patches)) {
		return undefined;
	}
	return hook(sourcesGitApplyHunksRequest(sessionId, argv, patches));
}
