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
export interface IConversationLensSessionBindingHost {
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
	showPostFailure(reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated'): void;
	focusTimelineRecord(turnId: string): void;
}

export function bindSessionView(host: IConversationLensSessionBindingHost, sessionId: string): void {

	host.sessionViewLifetime.clear();
	const lease = host.sessionViewLifetime.add(host.stubService.acquireSessionView(sessionId));
	host.sessionViewLease = lease;
	const coalescer = host.sessionViewLifetime.add(new ConversationSessionViewFrameCoalescer(applied => host.applySessionViewTimeline(applied)));
	host.sessionViewLifetime.add(lease.onDidApplyFrame(applied => coalescer.push(applied)));
	// Baseline fires during lease construction, before the listener above is attached.
	host.applySessionViewTimeline({ kind: 'baseline' });

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
	return findFirstPendingConfirmationTurnIdFromTurns(host.stubService.getTurns(host.stubService.getActiveSessionId()));

}

export async function resolveConfirmation(host: IConversationLensSessionBindingHost, turnId: string, status: 'allowed' | 'skipped'): Promise<void> {

	if (host.stubService.isEngineConnected()) {
		const forwarded = host.stubService.resolveConfirmation(
			host.stubService.getActiveSessionId(),
			turnId,
			status,
		);
		if (!forwarded) {
			return;
		}
		host.focusTimelineRecord(turnId);
		return;
	}
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

}

export async function resolveQuestion(host: IConversationLensSessionBindingHost, turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string): Promise<void> {

	if (host.stubService.isEngineConnected()) {
		const forwarded = host.stubService.respondQuestion(
			host.stubService.getActiveSessionId(),
			requestId,
			answers,
			customText,
		);
		if (!forwarded) {
			return;
		}
		host.focusTimelineRecord(turnId);
		return;
	}
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

}

export function focusTimelineRecord(host: IConversationLensSessionBindingHost, turnId: string): void {

	const targetWindow = getWindow(host.timelineTree.domNode);
	targetWindow.requestAnimationFrame(() => host.timelineTree.focusRecord(turnId));

}

export function copyTurn(host: IConversationLensSessionBindingHost, text: string): void {

	host.clipboardService.writeText(text);

}

export function deleteTurn(host: IConversationLensSessionBindingHost, turnId: string): void {

	host.stubService.deleteTurn(host.stubService.getActiveSessionId(), turnId);

}

export function cancelToolCall(host: IConversationLensSessionBindingHost, turn: { readonly id: string; readonly agentId?: string }): void {

	const toolCallId = turn.id.trim();
	if (!toolCallId) {
		return;
	}
	const agentId = turn.agentId?.trim();
	host.stubService.cancelToolCall(host.stubService.getActiveSessionId(), {
		toolCallId,
		...(agentId ? { agentId } : {}),
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
