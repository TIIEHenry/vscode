/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getWindow } from '../../../../base/browser/dom.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import type { ConversationQuestionRespondAnswers, ConversationViewFrameApplied, ConversationWriteMessage, IConversationSessionViewLease, PostOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { ConversationTimelineEntry } from './conversationSessionView.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationEngineHistoryList } from './conversationEngineHistoryList.js';
import { ConversationEngineSnapshotsList } from './conversationEngineSnapshotsList.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { ConversationTimelineFrameScheduler } from './conversationTimelineScheduler.js';
import { ConversationTimelineHost } from './conversationTimelineHost.js';
import { ConversationTrajectory } from './conversationTrajectory.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';
import type { ConversationMermaidExtensionInfo } from './conversationMermaidHost.js';
import { findFirstPendingConfirmationTurnId as findFirstPendingConfirmationTurnIdFromTurns } from './conversationPendingSeat.js';
import { isConversationEngineLive, isConversationPairingHold } from './conversationSessionStatus.js';
import { applyComposerSurfaceText } from './conversationComposerRefs.js';
import { IConversationRosterService } from './conversationStubService.js';
import type { ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
export interface IConversationLensSessionBindingHost {
	/** Same dispose gate Mermaid resolve uses. */
	readonly isDisposed: boolean;
	lastAttachedEntries: ConversationTimelineEntry[];
	sessionViewLease: IConversationSessionViewLease | undefined;
	sessionViewLifetime: DisposableStore;
	dockTextarea: HTMLTextAreaElement;
	inboxOverlay: ConversationInboxOverlay;
	timelineTree: ConversationTimelineHost;
	trajectoryView: ConversationTrajectory;
	engineHistoryList: ConversationEngineHistoryList | undefined;
	engineSnapshotsList: ConversationEngineSnapshotsList | undefined;
	mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;
	readonly slotHosts: IConversationLensSlots;
	readonly stubService: IConversationRosterService;
	readonly uaConnection: IUniverseAgentConnection;
	readonly clipboardService: IClipboardService;
	readonly webviewService: IWebviewService;
	readonly visualizeOverlay: ConversationVisualizeOverlay;
	getBoundSessionId(): string;
	bindSessionView(sessionId: string): void;
	applySessionViewTimeline(applied: ConversationViewFrameApplied, options?: { readonly sidecarOnly?: boolean }): void;
	exitComposerEdit(restoreComposeDraft?: boolean, releaseQueueHold?: boolean): void;
	resetInputHistoryBrowse(): void;
	refreshSessionSelectOptions(): void;
	syncSessionConfigSelects(sessionId: string): void;
	updateSessionTitle(): void;
	readComposerDraft(sessionId: string): string;
	renderInboxStatus(): void;
	updateConversationPhase(): void;
	updateSyncChrome(): void;
	postBound(msg: ConversationWriteMessage): Promise<PostOutcome>;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
	focusTimelineRecord(turnId: string): void;
	setInputMaximized(maximized: boolean): void;
}

/** D285: phase still connected, pairing pending — do not treat as true disconnect. */
function shouldKeepLeftoverTimelineForPairingHold(host: IConversationLensSessionBindingHost): boolean {
	if (host.lastAttachedEntries.length === 0) {
		return false;
	}
	const ua = host.uaConnection;
	if (!ua) {
		return false;
	}
	const snapshot = ua.getConnectionSnapshot();
	return snapshot.pairingPending && isConversationEngineLive(ua.getConnectionPhase(), false);
}

/** Host surface shared by binding + composer leftover write gates (D294 / D295). */
export interface IConversationPairingHoldWriteHost {
	readonly uaConnection: IUniverseAgentConnection;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
}

/** KEEP leftover list-fail write host (D460/D462): roster optional so missing `isEngineSessionReady` stays live. */
export interface IConversationKeepLeftoverWriteHost {
	readonly stubService: {
		isEngineConnected?(): boolean;
		isEngineSessionReady?(): boolean;
	};
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
}

/** D294: leftover engine lease stays readable; writes use the disconnect notice. */
export function rejectPairingHoldWrite(host: IConversationPairingHoldWriteHost): boolean {
	if (!isConversationPairingHold(host.uaConnection)) {
		return false;
	}
	host.showPostFailure('engine_disconnected');
	return true;
}

/** KEEP leftover list-fail (D449/D460): connected but roster not ready is not a live write surface. */
function isKeepLeftoverListFailWrite(host: IConversationKeepLeftoverWriteHost): boolean {
	return host.stubService.isEngineConnected?.() === true
		&& host.stubService.isEngineSessionReady?.() === false;
}

export function rejectKeepLeftoverListFailWrite(host: IConversationKeepLeftoverWriteHost): boolean {
	if (!isKeepLeftoverListFailWrite(host)) {
		return false;
	}
	host.showPostFailure('engine_disconnected');
	return true;
}

/**
 * Fold expand is stored on the lens and keyed only by span id. Another session
 * that reuses `fold:` / `fold:overlay:` must not inherit it. Same-session
 * first pull (no painted entries yet) must not wipe a trajectory already shown.
 */
function leavingPaintedSession(previousSessionId: string | undefined, sessionId: string, hadEntries: boolean): boolean {
	if (!sessionId) {
		return true;
	}
	if (previousSessionId !== undefined && previousSessionId !== sessionId) {
		return true;
	}
	return previousSessionId === undefined && hadEntries;
}

function dropOtherSessionPaint(host: IConversationLensSessionBindingHost): void {
	host.timelineTree.clearProcessFoldExpanded?.();
	host.trajectoryView?.clearSessionState?.();
	// Omit the linked-id set and the previous session's ids stay on the table.
	host.trajectoryView?.setRecords?.([], new Set<string>());
}

function blankDetachedTimeline(host: IConversationLensSessionBindingHost, dropPaint: boolean): void {
	host.lastAttachedEntries = [];
	host.timelineTree.applyEntries([], { kind: 'baseline' });
	if (dropPaint) {
		dropOtherSessionPaint(host);
	}
}

export function bindSessionView(host: IConversationLensSessionBindingHost, sessionId: string): void {

	if (host.isDisposed) {
		return;
	}
	const previousSessionId = host.sessionViewLease?.sessionId;
	const hadEntries = host.lastAttachedEntries.length > 0;
	const dropPaint = leavingPaintedSession(previousSessionId, sessionId, hadEntries);
	if (!sessionId) {
		host.sessionViewLifetime.clear();
		host.sessionViewLease = undefined;
		blankDetachedTimeline(host, dropPaint);
		return;
	}
	if (host.stubService.isEngineConnected() && !host.stubService.isEngineSessionReady()) {
		// D269: same-session leftover stays painted. Cross-session / first pull still clears.
		if (hadEntries && previousSessionId === sessionId) {
			return;
		}
		host.sessionViewLifetime.clear();
		host.sessionViewLease = undefined;
		blankDetachedTimeline(host, dropPaint);
		return;
	}
	if (shouldKeepLeftoverTimelineForPairingHold(host)) {
		// D285: same-session pairing-hold leftover stays painted. Cross-session still first-pull clears.
		if (previousSessionId === sessionId) {
			return;
		}
		host.sessionViewLifetime.clear();
		host.sessionViewLease = undefined;
		blankDetachedTimeline(host, dropPaint);
		return;
	}
	host.sessionViewLifetime.clear();
	try {
		const lease = host.sessionViewLifetime.add(host.stubService.acquireSessionView(sessionId));
		host.sessionViewLease = lease;
		const scheduler = host.sessionViewLifetime.add(new ConversationTimelineFrameScheduler(flush => {
			if (flush.applied) {
				host.applySessionViewTimeline(flush.applied);
				return;
			}
			if (flush.effects.length > 0) {
				host.applySessionViewTimeline({ kind: 'effects', effects: flush.effects });
				return;
			}
			if (flush.sidecar) {
				host.applySessionViewTimeline({ kind: 'patches', changedIds: new Set() });
			}
		}));
		host.sessionViewLifetime.add(lease.onDidApplyFrame(applied => scheduler.push(applied)));
		// Stub leases fire baseline during construction. Engine leases start as an
		// empty `pending` replica — applying that on the same session flashes an
		// empty tree. A different session must not keep the previous paint.
		if (lease.snapshot.sessionId !== 'pending') {
			if (dropPaint) {
				host.timelineTree.clearProcessFoldExpanded?.();
				host.trajectoryView?.clearSessionState?.();
			}
			host.applySessionViewTimeline({ kind: 'baseline' });
		} else if (dropPaint) {
			blankDetachedTimeline(host, true);
		}
	} catch {
		host.sessionViewLease = undefined;
		host.showPostFailure('failed');
		return;
	}

}

export function applyActiveSession(host: IConversationLensSessionBindingHost, sessionId: string): void {

	host.visualizeOverlay.close();
	host.engineHistoryList?.close();
	host.engineSnapshotsList?.close();
	host.inboxOverlay.closeListPanel();
	host.trajectoryView.clearSessionState();
	host.exitComposerEdit();
	host.resetInputHistoryBrowse();
	host.refreshSessionSelectOptions();
	host.syncSessionConfigSelects(sessionId);
	host.updateSessionTitle();
	applyComposerSurfaceText(host, host.readComposerDraft(sessionId));
	host.bindSessionView(sessionId);
	host.renderInboxStatus();
	host.updateConversationPhase();
	host.updateSyncChrome();

}

export function renderInboxStatus(host: IConversationLensSessionBindingHost): void {

	host.inboxOverlay.render();

}

export function findFirstPendingConfirmationTurnId(host: IConversationLensSessionBindingHost): string | undefined {

	const fromEntries = host.lastAttachedEntries.find(entry =>
		((entry.kind === 'confirmation' || entry.kind === 'question') && entry.status === 'pending')
		|| (entry.kind === 'tool' && entry.respondable === true)
	);
	if (fromEntries) {
		return fromEntries.id;
	}
	return findFirstPendingConfirmationTurnIdFromTurns(host.stubService.getTurns(host.getBoundSessionId()));

}

export async function resolveConfirmation(host: IConversationLensSessionBindingHost, turnId: string, status: 'allowed' | 'skipped'): Promise<void> {

	if (rejectPairingHoldWrite(host)) {
		return;
	}
	if (rejectKeepLeftoverListFailWrite(host)) {
		return;
	}
	if (host.stubService.isEngineConnected()) {
		const forwarded = host.stubService.resolveConfirmation(
			host.getBoundSessionId(),
			turnId,
			status,
		);
		if (!forwarded) {
			host.showPostFailure(
				!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			return;
		}
		host.focusTimelineRecord(turnId);
		return;
	}
	const sessionId = host.getBoundSessionId();
	try {
		const outcome = await host.postBound({
			kind: 'permissionRespond',
			requestId: turnId,
			decision: status === 'allowed' ? 'allow' : 'deny',
		});
		if (!host.isDisposed && host.getBoundSessionId() === sessionId) {
			if (!outcome.accepted) {
				host.showPostFailure(outcome.reason);
				return;
			}
			host.focusTimelineRecord(turnId);
		}
	} catch {
		if (!host.isDisposed && host.getBoundSessionId() === sessionId) {
			host.showPostFailure('failed');
		}
	}

}

export async function resolveQuestion(host: IConversationLensSessionBindingHost, turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string): Promise<void> {

	if (rejectPairingHoldWrite(host)) {
		return;
	}
	if (rejectKeepLeftoverListFailWrite(host)) {
		return;
	}
	if (host.stubService.isEngineConnected()) {
		const forwarded = host.stubService.respondQuestion(
			host.getBoundSessionId(),
			requestId,
			answers,
			customText,
		);
		if (!forwarded) {
			host.showPostFailure(
				!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			return;
		}
		host.focusTimelineRecord(turnId);
		return;
	}
	const sessionId = host.getBoundSessionId();
	try {
		const outcome = await host.postBound({
			kind: 'questionRespond',
			requestId,
			answers,
			...(customText !== undefined ? { customText } : {}),
		});
		if (!host.isDisposed && host.getBoundSessionId() === sessionId) {
			if (!outcome.accepted) {
				host.showPostFailure(outcome.reason);
				return;
			}
			host.focusTimelineRecord(turnId);
		}
	} catch {
		if (!host.isDisposed && host.getBoundSessionId() === sessionId) {
			host.showPostFailure('failed');
		}
	}

}

export function focusTimelineRecord(host: IConversationLensSessionBindingHost, turnId: string): void {

	const targetWindow = getWindow(host.timelineTree.domNode);
	targetWindow.requestAnimationFrame(() => {
		if (host.timelineTree && !host.timelineTree.isDisposed) {
			host.timelineTree.focusRecord(turnId);
		}
	});

}

export function copyTurn(host: IConversationLensSessionBindingHost, text: string): void {

	void host.clipboardService.writeText(text).catch(() => {
		host.showPostFailure('failed');
	}).catch(onUnexpectedError).catch(onUnexpectedError);

}

export function deleteTurn(host: IConversationLensSessionBindingHost, turnId: string, agentId?: string): void {

	if (rejectPairingHoldWrite(host)) {
		return;
	}
	if (rejectKeepLeftoverListFailWrite(host)) {
		return;
	}
	const trimmedAgentId = agentId?.trim();
	const deleted = host.stubService.deleteTurn(host.getBoundSessionId(), turnId, trimmedAgentId || undefined);
	if (!deleted) {
		host.showPostFailure(
			!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
				? 'engine_disconnected'
				: 'failed'
		);
	}

}

export function cancelToolCall(host: IConversationLensSessionBindingHost, turn: { readonly id: string; readonly agentId?: string }): void {

	const toolCallId = turn.id.trim();
	if (!toolCallId) {
		return;
	}
	if (rejectPairingHoldWrite(host)) {
		return;
	}
	if (rejectKeepLeftoverListFailWrite(host)) {
		return;
	}
	const agentId = turn.agentId?.trim();
	const cancelled = host.stubService.cancelToolCall(host.getBoundSessionId(), {
		toolCallId,
		...(agentId ? { agentId } : {}),
	});
	if (!cancelled) {
		host.showPostFailure(
			!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
				? 'engine_disconnected'
				: 'failed'
		);
	}

}

export function respondClientTool(host: IConversationLensSessionBindingHost, turn: { readonly id: string }): void {

	const callId = turn.id.trim();
	if (!callId) {
		return;
	}
	if (rejectPairingHoldWrite(host)) {
		return;
	}
	if (rejectKeepLeftoverListFailWrite(host)) {
		return;
	}
	const forwarded = host.stubService.respondClientTool(host.getBoundSessionId(), callId, { content: '' });
	if (!forwarded) {
		host.showPostFailure(
			!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
				? 'engine_disconnected'
				: 'failed'
		);
	}

}

type RegeneratableRow = {
	readonly id: string;
	readonly kind: string;
	readonly text: string;
	readonly turnId?: string;
	readonly agentId?: string;
};

function resolveRegenerateUserTurn(
	rows: readonly RegeneratableRow[],
	assistantTurn: { readonly id: string; readonly turnId?: string; readonly agentId?: string },
): { readonly userTurnId: string; readonly preservedContent: string; readonly agentId?: string } | undefined {
	const assistantId = assistantTurn.id.trim();
	const assistantTurnId = assistantTurn.turnId?.trim();
	if (!assistantId) {
		return undefined;
	}
	const index = rows.findIndex(row =>
		row.id === assistantId
		|| (assistantTurnId !== undefined && (row.turnId === assistantTurnId || row.id === assistantTurnId))
	);
	if (index < 0) {
		return undefined;
	}
	for (let i = index - 1; i >= 0; i--) {
		const row = rows[i];
		if (row.kind !== 'user') {
			continue;
		}
		const userTurnId = (row.turnId ?? row.id).trim();
		if (!userTurnId || row.text.trim().length === 0) {
			return undefined;
		}
		const agentId = assistantTurn.agentId?.trim() || rows[index].agentId?.trim();
		return {
			userTurnId,
			preservedContent: row.text,
			...(agentId ? { agentId } : {}),
		};
	}
	return undefined;
}

export function regenerateTurn(
	host: IConversationLensSessionBindingHost,
	turn: {
		readonly id: string;
		readonly turnId?: string;
		readonly agentId?: string;
		readonly userTurnId?: string;
		readonly preservedContent?: string;
	},
): void {

	const assistantId = turn.id.trim();
	const explicitUserTurnId = turn.userTurnId?.trim();
	if (!assistantId && !explicitUserTurnId) {
		return;
	}
	if (rejectPairingHoldWrite(host)) {
		return;
	}
	if (rejectKeepLeftoverListFailWrite(host)) {
		return;
	}

	const explicitContent = turn.preservedContent;
	const resolved = explicitUserTurnId && explicitContent && explicitContent.trim().length > 0
		? {
			userTurnId: explicitUserTurnId,
			preservedContent: explicitContent,
			...(turn.agentId?.trim() ? { agentId: turn.agentId.trim() } : {}),
		}
		: resolveRegenerateUserTurn(host.lastAttachedEntries, turn)
			?? resolveRegenerateUserTurn(host.stubService.getTurns(host.getBoundSessionId()), turn);
	if (!resolved) {
		host.showPostFailure('failed');
		return;
	}

	void host.postBound({
		kind: 'regenerateTurn',
		userTurnId: resolved.userTurnId,
		preservedContent: resolved.preservedContent,
		...(resolved.agentId ? { agentId: resolved.agentId } : {}),
	}).then(outcome => {
		if (!outcome.accepted) {
			host.showPostFailure(outcome.reason);
		}
	}).catch(() => {
		host.showPostFailure('failed');
	}).catch(onUnexpectedError).catch(onUnexpectedError);

}

export function retryError(host: IConversationLensSessionBindingHost, turn: { readonly id: string; readonly turnId?: string; readonly agentId?: string }): void {

	const messageId = turn.id.trim();
	if (!messageId) {
		return;
	}
	const turnId = turn.turnId?.trim() || messageId;
	const agentId = turn.agentId?.trim() || 'root';
	if (rejectPairingHoldWrite(host)) {
		return;
	}
	if (rejectKeepLeftoverListFailWrite(host)) {
		return;
	}
	void host.postBound({
		kind: 'continueGeneration',
		agentId,
		turnId,
		messageId,
	}).then(outcome => {
		if (!outcome.accepted) {
			host.showPostFailure(outcome.reason);
		}
	}).catch(() => {
		host.showPostFailure('failed');
	}).catch(onUnexpectedError).catch(onUnexpectedError);

}

export function openVisualizeOverlay(host: IConversationLensSessionBindingHost, source: string, title?: string): void {

	host.setInputMaximized(false);
	host.engineHistoryList?.close();
	host.engineSnapshotsList?.close();
	host.visualizeOverlay.open({
		source,
		title,
		extensionInfo: host.mermaidExtensionInfo,
		targetWindow: getWindow(host.slotHosts.timeline),
		webviewService: host.webviewService,
		host: host.slotHosts.timeline,
	});

}
