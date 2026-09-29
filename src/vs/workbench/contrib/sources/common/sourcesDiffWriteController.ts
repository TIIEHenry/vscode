/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
import { ISCMResource } from '../../scm/common/scm.js';
import { isSourcesChangeStageable, SOURCES_GIT_CLEAN_COMMAND, SOURCES_GIT_STAGE_COMMAND, SOURCES_GIT_UNSTAGE_COMMAND } from './sourcesChangesGit.js';
import { SourcesChangesOrigin } from './sourcesChangesModel.js';
import {
	ISourcesDiffWriteActionVisibility,
	isSourcesEngineWriteSessionBlocked,
	resolveSourcesDiffWriteActions,
	SourcesGitWriteAttemptResult,
	sourcesGitEmptyStagePathMessage,
	sourcesGitSessionChangedMessage,
} from './sourcesChangesGitWrite.js';

export type SourcesDiffWriteCollapseKind = 'stage' | 'revert' | 'unstage';

/** One explicit hide, keyed to the modified URI. A different URI clears it. */
export interface ISourcesDiffWriteCollapse {
	readonly modified: string;
	readonly kind: SourcesDiffWriteCollapseKind;
}

export function sourcesDiffWriteCollapseFor(collapse: ISourcesDiffWriteCollapse | undefined, modified: URI | undefined): ISourcesDiffWriteCollapse | undefined {
	if (!collapse || !modified || collapse.modified !== modified.toString()) {
		return undefined;
	}
	return collapse;
}

export function markSourcesDiffWriteCollapsed(modified: URI, kind: SourcesDiffWriteCollapseKind): ISourcesDiffWriteCollapse {
	return { modified: modified.toString(), kind };
}

export function isSourcesDiffWriteCollapsed(collapse: ISourcesDiffWriteCollapse | undefined, modified: URI | undefined, kind: SourcesDiffWriteCollapseKind): boolean {
	return !!collapse && !!modified && collapse.modified === modified.toString() && collapse.kind === kind;
}

export function sourcesDiffStageUnavailableMessage(): string {
	return localize('sourcesDiffWriteController.stageUnavailable', "Git stage is not available.");
}

export function sourcesDiffAcceptUnavailableMessage(): string {
	return localize('sourcesDiffWriteController.acceptUnavailable', "Git accept is not available.");
}

export interface ISourcesDiffWriteIdentity {
	readonly origin: SourcesChangesOrigin | undefined;
	readonly sessionId: string | undefined;
	readonly modified: URI;
}

/** DOM-free facts. Hosts pass the P2 gate and the P3 identity they already resolved. */
export interface ISourcesDiffWriteFacts {
	readonly identity: ISourcesDiffWriteIdentity;
	readonly writeClosed: boolean;
	readonly activeSessionId: string;
	readonly fallbackSessionId: string;
	readonly groupId: string;
	readonly path: string;
	readonly scmResource: ISCMResource | undefined;
	readonly canWriteStage: boolean;
	readonly canWriteAccept: boolean;
	readonly hasApplyHunksPayload: boolean;
	readonly hasGitStageCommand: boolean;
	readonly hasGitUnstageCommand: boolean;
	readonly hasGitCleanCommand: boolean;
	readonly pairingHold: boolean;
	readonly keepLeftover: boolean;
	readonly patches: readonly string[];
	readonly collapse: ISourcesDiffWriteCollapse | undefined;
}

export function resolveSourcesDiffWriteControllerChrome(facts: ISourcesDiffWriteFacts): ISourcesDiffWriteActionVisibility {
	const actions = resolveSourcesDiffWriteActions({
		groupId: facts.groupId,
		hasScmResource: !!facts.scmResource,
		canWriteStage: facts.canWriteStage,
		canWriteAccept: facts.canWriteAccept,
		hasApplyHunksPayload: facts.hasApplyHunksPayload,
		hasGitStageCommand: facts.hasGitStageCommand,
		hasGitUnstageCommand: facts.hasGitUnstageCommand,
		hasGitCleanCommand: facts.hasGitCleanCommand,
		pairingHold: facts.pairingHold,
		keepLeftover: facts.keepLeftover,
	});
	const modified = facts.identity.modified;
	const collapsed = (kind: SourcesDiffWriteCollapseKind) => isSourcesDiffWriteCollapsed(facts.collapse, modified, kind);
	return {
		showStage: actions.showStage && !facts.writeClosed && !collapsed('stage'),
		showAccept: actions.showAccept,
		showRevert: actions.showRevert && !facts.writeClosed && !collapsed('revert'),
		showUnstage: actions.showUnstage && !facts.writeClosed && !collapsed('unstage'),
		unstageUnavailable: actions.unstageUnavailable && !facts.writeClosed,
	};
}

export type SourcesDiffStageAttemptPlan =
	| { readonly kind: 'blocked' }
	| { readonly kind: 'notice'; readonly message: string }
	| { readonly kind: 'engine'; readonly sessionId: string; readonly path: string }
	| { readonly kind: 'skip-engine' };

export function planSourcesDiffStageAttempt(facts: ISourcesDiffWriteFacts | undefined): SourcesDiffStageAttemptPlan {
	if (!facts || facts.writeClosed) {
		return { kind: 'blocked' };
	}
	const engineRow = facts.identity.origin === 'engine';
	if (engineRow && isSourcesEngineWriteSessionBlocked(facts.identity.origin, facts.identity.sessionId, facts.activeSessionId)) {
		return { kind: 'notice', message: sourcesGitSessionChangedMessage() };
	}
	if (engineRow && !facts.path) {
		return { kind: 'notice', message: sourcesGitEmptyStagePathMessage() };
	}
	if (facts.path === '') {
		return { kind: 'skip-engine' };
	}
	const sessionId = engineRow ? (facts.identity.sessionId ?? '') : facts.fallbackSessionId;
	return { kind: 'engine', sessionId, path: facts.path };
}

export type SourcesDiffStageAfterPlan =
	| { readonly kind: 'collapse-stage' }
	| { readonly kind: 'clear-notice' }
	| { readonly kind: 'notice'; readonly message: string }
	| { readonly kind: 'local' }
	| { readonly kind: 'done' };

export function planSourcesDiffStageAfterAttempt(attempt: SourcesGitWriteAttemptResult, facts: ISourcesDiffWriteFacts): SourcesDiffStageAfterPlan {
	if (attempt.kind === 'accepted') {
		if (isSourcesChangeStageable(facts.groupId)) {
			return { kind: 'collapse-stage' };
		}
		return { kind: 'clear-notice' };
	}
	if (attempt.kind === 'failed') {
		return { kind: 'notice', message: attempt.detail };
	}
	if (facts.identity.origin === 'engine') {
		return { kind: 'notice', message: sourcesDiffStageUnavailableMessage() };
	}
	if (facts.scmResource && !facts.writeClosed) {
		return { kind: 'local' };
	}
	if (facts.canWriteStage) {
		return { kind: 'notice', message: sourcesDiffStageUnavailableMessage() };
	}
	return { kind: 'done' };
}

export type SourcesDiffAcceptAttemptPlan =
	| { readonly kind: 'blocked' }
	| { readonly kind: 'notice'; readonly message: string }
	| { readonly kind: 'engine'; readonly sessionId: string; readonly patches: readonly string[] };

export function planSourcesDiffAcceptAttempt(facts: ISourcesDiffWriteFacts | undefined): SourcesDiffAcceptAttemptPlan {
	if (!facts || facts.writeClosed) {
		return { kind: 'blocked' };
	}
	if (isSourcesEngineWriteSessionBlocked(facts.identity.origin, facts.identity.sessionId, facts.activeSessionId)) {
		return { kind: 'notice', message: sourcesGitSessionChangedMessage() };
	}
	const sessionId = facts.identity.origin === 'engine' ? (facts.identity.sessionId ?? '') : facts.fallbackSessionId;
	return { kind: 'engine', sessionId, patches: facts.patches };
}

export type SourcesDiffAcceptAfterPlan =
	| { readonly kind: 'clear-notice' }
	| { readonly kind: 'notice'; readonly message: string }
	| { readonly kind: 'done' };

export function planSourcesDiffAcceptAfterAttempt(attempt: SourcesGitWriteAttemptResult, facts: ISourcesDiffWriteFacts): SourcesDiffAcceptAfterPlan {
	if (attempt.kind === 'accepted') {
		return { kind: 'clear-notice' };
	}
	if (attempt.kind === 'failed') {
		return { kind: 'notice', message: attempt.detail };
	}
	if (facts.canWriteAccept || facts.hasApplyHunksPayload) {
		return { kind: 'notice', message: sourcesDiffAcceptUnavailableMessage() };
	}
	return { kind: 'done' };
}

export type SourcesDiffLocalGitPlan =
	| { readonly kind: 'blocked' }
	| { readonly kind: 'skip' }
	| { readonly kind: 'local'; readonly commandId: string; readonly scmResource: ISCMResource; readonly collapse: 'revert' | 'unstage' | undefined };

/** Gate closed → no stage / unstage / clean, including `read-failed` `git.unstage`. Local stage does not collapse. */
export function planSourcesDiffLocalGitAction(commandId: string, facts: ISourcesDiffWriteFacts | undefined): SourcesDiffLocalGitPlan {
	if (!facts) {
		return { kind: 'skip' };
	}
	const gated = commandId === SOURCES_GIT_STAGE_COMMAND
		|| commandId === SOURCES_GIT_UNSTAGE_COMMAND
		|| commandId === SOURCES_GIT_CLEAN_COMMAND;
	if (gated && facts.writeClosed) {
		return { kind: 'blocked' };
	}
	if (!facts.scmResource) {
		return { kind: 'skip' };
	}
	const collapse = commandId === SOURCES_GIT_CLEAN_COMMAND
		? 'revert' as const
		: commandId === SOURCES_GIT_UNSTAGE_COMMAND
			? 'unstage' as const
			: undefined;
	return { kind: 'local', commandId, scmResource: facts.scmResource, collapse };
}
