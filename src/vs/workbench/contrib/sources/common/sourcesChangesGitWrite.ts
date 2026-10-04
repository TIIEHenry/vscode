/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { isAdvertisedEngineRpcSupport } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentGitWriteCapability,
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
import { isSourcesChangesReadFailed, SourcesChangesOrigin, SourcesChangesReadState } from './sourcesChangesModel.js';

/**
 * Desktop IPC makes every connection method a function. UNSUPPORTED closes
 * the write even then. UNKNOWN keeps the installed-method check for stubs.
 */
export function sourcesGitWriteHookPresent(
	snapshot: Pick<UniverseAgentConnectionSnapshot, 'gitWriteCapability'> | undefined,
	key: keyof UniverseAgentGitWriteCapability,
	method: unknown,
): boolean {
	return isAdvertisedEngineRpcSupport(snapshot?.gitWriteCapability?.[key], method);
}

/** Roster / engine git RPCs require a real session. Empty sessionId → no hook. */
export function hasSourcesGitSessionId(sessionId: string): boolean {
	return sessionId !== '';
}

/**
 * D449 / D459 KEEP leftover list-fail: connected engine, not pairing-hold,
 * session catalog not ready. Distinct from git-read `leftoverListFailed`.
 */
export function isSourcesKeepLeftoverWrite(connected: boolean, pairingPending: boolean, engineSessionReady: boolean): boolean {
	return connected && !pairingPending && !engineSessionReady;
}

export interface ISourcesChangesWriteFacts {
	readonly phaseConnected: boolean;
	readonly pairingPending: boolean;
	readonly engineConnected: boolean;
	readonly engineSessionReady: boolean;
}

/**
 * Write door. Closed only for pairing wait, read-failed leftover, or a
 * connected engine whose session catalog is not ready. `failureMessage` on
 * an `scm` snapshot does not close. Disconnected does not close local SCM.
 * `engineConnected` is `isEngineConnected()`, not `phase.kind === 'connected'`.
 */
export function isSourcesChangesWriteClosed(state: SourcesChangesReadState, facts: ISourcesChangesWriteFacts): boolean {
	if (facts.phaseConnected && facts.pairingPending) {
		return true;
	}
	if (isSourcesChangesReadFailed(state)) {
		return true;
	}
	if (facts.engineConnected && !facts.pairingPending && !facts.engineSessionReady) {
		return true;
	}
	return false;
}

function sourcesGitEngineRpcAllowed(connected: boolean, pairingHold: boolean, leftoverListFailed: boolean, engineSessionReady: boolean): boolean {
	const state: SourcesChangesReadState = leftoverListFailed
		? { kind: 'engine-leftover', sessionId: '', reason: 'read-failed' }
		: { kind: 'scm' };
	return connected && !isSourcesChangesWriteClosed(state, {
		phaseConnected: pairingHold,
		pairingPending: pairingHold,
		engineConnected: connected,
		engineSessionReady,
	});
}

/** Sources Changes Stage → WriteGitStagePaths. Empty sessionId does not call the hook. */
export function canSendSourcesGitStagePaths(connected: boolean, hasHook: boolean, sessionId: string, pairingHold = false, leftoverListFailed = false, engineSessionReady = true): boolean {
	return sourcesGitEngineRpcAllowed(connected, pairingHold, leftoverListFailed, engineSessionReady) && hasHook && hasSourcesGitSessionId(sessionId);
}

/** Sources Changes Commit → WriteGitCommit. Empty sessionId does not call the hook. */
export function canSendSourcesGitCommit(connected: boolean, hasHook: boolean, sessionId: string, pairingHold = false, leftoverListFailed = false, engineSessionReady = true): boolean {
	return sourcesGitEngineRpcAllowed(connected, pairingHold, leftoverListFailed, engineSessionReady) && hasHook && hasSourcesGitSessionId(sessionId);
}

/** Sources Review Accept → WriteGitApplyHunks. Connection + hook only; empty session, empty argv, or empty patches are refused in tryWrite. */
export function canSendSourcesGitApplyHunks(connected: boolean, hasHook: boolean, pairingHold = false, leftoverListFailed = false, engineSessionReady = true): boolean {
	return sourcesGitEngineRpcAllowed(connected, pairingHold, leftoverListFailed, engineSessionReady) && hasHook;
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
	/** leftover-looks-live pairing-hold: hide Stage the same way chrome hides Unstage. */
	readonly pairingHold?: boolean;
	/** KEEP leftover list-fail: hide Stage the same way pairing-hold hides it (D459). */
	readonly keepLeftover?: boolean;
	/** Changes list engine Stage chrome: empty gitPath or session mismatch on an engine snapshot row. */
	readonly engineStageButtonBlocked?: boolean;
}): ISourcesDiffWriteActionVisibility {
	const stageable = isSourcesChangeStageable(input.groupId);
	const unstageable = isSourcesChangeUnstageable(input.groupId);
	const revertible = isSourcesChangeRevertible(input.groupId);
	const hasLocalStage = stageable && input.hasScmResource && input.hasGitStageCommand;
	const hasLocalUnstage = unstageable && input.hasScmResource && input.hasGitUnstageCommand;
	const hasLocalRevert = revertible && input.hasScmResource && input.hasGitCleanCommand;
	const writeHold = !!input.pairingHold || !!input.keepLeftover;
	const engineStageBlocked = !!input.engineStageButtonBlocked;

	return {
		showStage: stageable && !writeHold && !engineStageBlocked && (input.canWriteStage || hasLocalStage),
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

/** Engine row whose pinned session is empty or no longer the active session. Do not write, and do not fall back to local git. */
export function isSourcesEngineWriteSessionBlocked(origin: SourcesChangesOrigin | undefined, pinnedSessionId: string | undefined, activeSessionId: string): boolean {
	return origin === 'engine' && (!pinnedSessionId || pinnedSessionId !== activeSessionId);
}

/**
 * Changes list Stage chrome for the two engine click refusals.
 * A `scm` snapshot, or a row whose `origin` is not `engine`, still uses `git.stage`.
 */
export function isSourcesEngineStageButtonBlocked(
	snapshotKind: SourcesChangesReadState['kind'],
	origin: SourcesChangesOrigin | undefined,
	sessionId: string | undefined,
	gitPath: string | undefined,
	activeSessionId: string,
): boolean {
	if (snapshotKind === 'scm' || origin !== 'engine') {
		return false;
	}
	return isSourcesEngineWriteSessionBlocked(origin, sessionId, activeSessionId) || !gitPath;
}

export function sourcesGitSessionChangedMessage(): string {
	return localize('sourcesChangesGitWrite.sessionChanged', "The session changed. This change was not written.");
}

export function sourcesGitEmptyStagePathMessage(): string {
	return localize('sourcesChangesGitWrite.emptyStagePath', "This change has no engine path to stage.");
}

export function sourcesGitStageNotAcceptedMessage(): string {
	return localize('sourcesChangesGitWrite.stageNotAccepted', "The engine did not accept this stage.");
}

export function sourcesGitCommitNotAcceptedMessage(): string {
	return localize('sourcesChangesGitWrite.commitNotAccepted', "The engine did not accept this commit.");
}

export async function tryWriteSourcesGitStagePaths(
	connected: boolean,
	hook: ((request: UniverseAgentWriteGitStagePathsRequest) => Promise<UniverseAgentWriteGitWriteResult>) | undefined,
	sessionId: string,
	paths: readonly string[],
	pairingHold = false,
	leftoverListFailed = false,
	engineSessionReady = true,
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitStagePaths(connected, typeof hook === 'function', sessionId, pairingHold, leftoverListFailed, engineSessionReady) || !hook) {
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
	leftoverListFailed = false,
	engineSessionReady = true,
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitCommit(connected, typeof hook === 'function', sessionId, pairingHold, leftoverListFailed, engineSessionReady) || !hook) {
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
	leftoverListFailed = false,
	engineSessionReady = true,
): Promise<UniverseAgentWriteGitWriteResult | undefined> {
	if (!canSendSourcesGitApplyHunks(connected, typeof hook === 'function', pairingHold, leftoverListFailed, engineSessionReady) || !hook) {
		return undefined;
	}
	if (!hasSourcesGitApplyHunksPayload(sessionId, patches)) {
		return undefined;
	}
	if (!argv.some(part => part.trim() !== '')) {
		return undefined;
	}
	return hook(sourcesGitApplyHunksRequest(sessionId, argv, patches));
}
