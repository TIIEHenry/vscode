/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getWindow } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import type { ConversationQuestionRespondAnswers, ConversationViewFrameApplied, ConversationWriteMessage, IConversationSessionViewLease, PostOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { ConversationTimelineEntry } from './conversationSessionView.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationEngineHistoryList } from './conversationEngineHistoryList.js';
import { ConversationEngineSnapshotsList } from './conversationEngineSnapshotsList.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { ConversationSessionViewFrameCoalescer } from './conversationSessionViewFrameCoalescer.js';
import { ConversationTimelineTree } from './conversationTimelineTree.js';
import { ConversationTrajectory } from './conversationTrajectory.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';
import type { ConversationMermaidExtensionInfo } from './conversationMermaidHost.js';
import { findFirstPendingConfirmationTurnId as findFirstPendingConfirmationTurnIdFromTurns } from './conversationPendingSeat.js';
import { IConversationRosterService } from './conversationStubService.js';
import type { ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
export interface IConversationLensSessionBindingHost {
	/** Same dispose gate Mermaid resolve uses (`this._store.isDisposed`). */
	readonly _store: { readonly isDisposed: boolean };
	lastAttachedEntries: ConversationTimelineEntry[];
	sessionViewLease: IConversationSessionViewLease | undefined;
	sessionViewLifetime: DisposableStore;
	dockTextarea: HTMLTextAreaElement;
	inboxOverlay: ConversationInboxOverlay;
	timelineTree: ConversationTimelineTree;
	trajectoryView: ConversationTrajectory;
	engineHistoryList: ConversationEngineHistoryList | undefined;
	engineSnapshotsList: ConversationEngineSnapshotsList | undefined;
	mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;
	readonly slotHosts: IConversationLensSlots;
	readonly stubService: IConversationRosterService;
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
	renderVoiceTranscriptBar(): void;
	updateVoiceMicChrome(): void;
	postBound(msg: ConversationWriteMessage): Promise<PostOutcome>;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
	focusTimelineRecord(turnId: string): void;
}

export function bindSessionView(host: IConversationLensSessionBindingHost, sessionId: string): void {

	if (host._store.isDisposed) {
		return;
	}
	host.sessionViewLifetime.clear();
	if (!sessionId || (host.stubService.isEngineConnected() && !host.stubService.isEngineSessionReady())) {
		host.sessionViewLease = undefined;
		host.lastAttachedEntries = [];
		host.timelineTree.applyEntries([], { kind: 'baseline' });
		return;
	}
	try {
		const lease = host.sessionViewLifetime.add(host.stubService.acquireSessionView(sessionId));
		host.sessionViewLease = lease;
		const coalescer = host.sessionViewLifetime.add(new ConversationSessionViewFrameCoalescer(applied => host.applySessionViewTimeline(applied)));
		host.sessionViewLifetime.add(lease.onDidApplyFrame(applied => coalescer.push(applied)));
		// Stub leases fire baseline during construction. Engine leases start as an
		// empty `pending` replica — applying that as baseline flashes an empty tree.
		if (lease.snapshot.sessionId !== 'pending') {
			host.applySessionViewTimeline({ kind: 'baseline' });
		}
	} catch {
		host.sessionViewLease = undefined;
		host.showPostFailure('failed');
		return;
	}

}

export function applyActiveSession(host: IConversationLensSessionBindingHost, sessionId: string): void {

	host.visualizeOverlay.close();
	host.trajectoryView.clearSessionState();
	host.exitComposerEdit();
	host.resetInputHistoryBrowse();
	host.refreshSessionSelectOptions();
	host.syncSessionConfigSelects(sessionId);
	host.updateSessionTitle();
	host.dockTextarea.value = host.readComposerDraft(sessionId);
	host.bindSessionView(sessionId);
	host.renderInboxStatus();
	host.renderVoiceTranscriptBar();
	host.updateVoiceMicChrome();

}

export function renderInboxStatus(host: IConversationLensSessionBindingHost): void {

	host.inboxOverlay.render();

}

export function findFirstPendingConfirmationTurnId(host: IConversationLensSessionBindingHost): string | undefined {

	const fromEntries = host.lastAttachedEntries.find(entry =>
		(entry.kind === 'confirmation' || entry.kind === 'question') && entry.status === 'pending'
	);
	if (fromEntries) {
		return fromEntries.id;
	}
	return findFirstPendingConfirmationTurnIdFromTurns(host.stubService.getTurns(host.getBoundSessionId()));

}

export async function resolveConfirmation(host: IConversationLensSessionBindingHost, turnId: string, status: 'allowed' | 'skipped'): Promise<void> {

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
	try {
		const outcome = await host.postBound({
			kind: 'permissionRespond',
			requestId: turnId,
			decision: status === 'allowed' ? 'allow' : 'deny',
		});
		if (!outcome.accepted) {
			host.showPostFailure(outcome.reason);
			return;
		}
		host.focusTimelineRecord(turnId);
	} catch {
		host.showPostFailure('failed');
	}

}

export async function resolveQuestion(host: IConversationLensSessionBindingHost, turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string): Promise<void> {

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
	try {
		const outcome = await host.postBound({
			kind: 'questionRespond',
			requestId,
			answers,
			...(customText !== undefined ? { customText } : {}),
		});
		if (!outcome.accepted) {
			host.showPostFailure(outcome.reason);
			return;
		}
		host.focusTimelineRecord(turnId);
	} catch {
		host.showPostFailure('failed');
	}

}

export function focusTimelineRecord(host: IConversationLensSessionBindingHost, turnId: string): void {

	const targetWindow = getWindow(host.timelineTree.domNode);
	targetWindow.requestAnimationFrame(() => host.timelineTree.focusRecord(turnId));

}

export function copyTurn(host: IConversationLensSessionBindingHost, text: string): void {

	host.clipboardService.writeText(text);

}

export function deleteTurn(host: IConversationLensSessionBindingHost, turnId: string): void {

	const deleted = host.stubService.deleteTurn(host.getBoundSessionId(), turnId);
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

export function retryError(host: IConversationLensSessionBindingHost, turn: { readonly id: string; readonly turnId?: string; readonly agentId?: string }): void {

	const messageId = turn.id.trim();
	if (!messageId) {
		return;
	}
	const turnId = turn.turnId?.trim() || messageId;
	const agentId = turn.agentId?.trim() || 'root';
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
	});

}

export function openVisualizeOverlay(host: IConversationLensSessionBindingHost, source: string, title?: string): void {

	host.engineHistoryList?.close();
	host.engineSnapshotsList?.close();
	host.visualizeOverlay.open({
		source,
		title,
		extensionInfo: host.mermaidExtensionInfo,
		targetWindow: getWindow(host.slotHosts.timeline),
		webviewService: host.webviewService,
		host: host.slotHosts.timeline.closest('.part.conversation') ?? undefined,
	});

}
