/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode } from '../../../../base/common/keyCodes.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import type { ConversationViewFrameApplied, IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SyncChrome } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { IConversationReviewNavService } from '../common/conversationReviewEntry.js';
import { attachReviewEntries, computeReviewNavSidecarApplied } from '../common/conversationReviewEntry.js';
import { projectSnapshotToEntries, formatSyncChromeLabel } from './conversationSessionView.js';
import type { ConversationTimelineEntry } from './conversationSessionView.js';
import {
	collectConversationTrajectoryTurnIds,
	collectTrajectoryTurnIdsFromSnapshot,
	findTrajectoryRecordIdForTurn,
} from './conversationTrajectoryModel.js';
import {
	conversationLensPhasePreFirstClass,
	conversationLensPhasePreFirstDockHiddenClass,
} from './conversationLensDockStrings.js';
import { ConversationTimelineTree } from './conversationTimelineTree.js';
import { ConversationTrajectory } from './conversationTrajectory.js';
import { IConversationRosterService } from './conversationStubService.js';
import { ConversationIdentityStrip } from './conversationIdentityStrip.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';

export const CONVERSATION_LENS_ID_STORAGE_KEY = 'conversation.lensId';

export type ConversationLensId = 'conversation' | 'trajectory';

export interface IConversationLensProjectionHost {
	lensId: ConversationLensId;
	filterAgentId: string | undefined;
	inputMaximized: boolean;
	conversationPhase: 'prefirst' | 'active' | undefined;
	composerPolicy: 'compose' | 'turnEdit' | 'queueEdit';
	lastAttachedEntries: ConversationTimelineEntry[];
	sessionViewLease: IConversationSessionViewLease | undefined;
	relayoutReadingSurfaces(): void;
	readonly slotHosts: IConversationLensSlots;
	readonly stubService: IConversationRosterService;
	readonly storageService: IStorageService;
	readonly reviewNavService: IConversationReviewNavService;
	timelineTree: ConversationTimelineTree;
	trajectoryView: ConversationTrajectory;
	readingColumn: HTMLElement;
	prefirstHero: HTMLElement;
	dockRoot: HTMLElement;
	gateRow: HTMLElement;
	identityStrip: ConversationIdentityStrip;
	inboxOverlay: ConversationInboxOverlay;
	sessionSyncBadge: HTMLElement;
	lensTabConversation: HTMLButtonElement;
	lensTabTrajectory: HTMLButtonElement;
	setInputMaximized(maximized: boolean): void;
	updateLensTabs(): void;
	updateReadingColumn(): void;
	refreshTrajectoryRecords(sessionId: string): void;
	updateSyncChrome(sync: SyncChrome): void;
	updateConversationPhase(): void;
	syncComposerPlacement(): void;
	applyConversationDensity(): void;
	renderInboxStatus(): void;
	exitComposerEdit(restoreComposeDraft?: boolean, releaseQueueHold?: boolean): void;
	updateSessionConfigVisibility(preFirst: boolean): void;
	updateGateRow(): void;
}

export function trajectoryProjectionOptions(host: IConversationLensProjectionHost): { readonly filterAgentId?: string } | undefined {

		return host.filterAgentId ? { filterAgentId: host.filterAgentId } : undefined;
	
}

export function isPreFirst(host: IConversationLensProjectionHost): boolean {

		const sessionId = host.stubService.getActiveSessionId();
		if (host.stubService.getTurns(sessionId).length > 0) {
			return false;
		}
		// localPendingSends are visible timeline rows but dropped from getTurns().
		const pending = host.sessionViewLease?.snapshot.localPendingSends?.length ?? 0;
		return pending === 0;
	
}

export function applySessionViewTimeline(host: IConversationLensProjectionHost, applied: ConversationViewFrameApplied,
		options?: { readonly sidecarOnly?: boolean },): void {

		if (!host.sessionViewLease) {
			return;
		}
		const baseEntries = projectSnapshotToEntries(
			host.sessionViewLease.snapshot,
			host.sessionViewLease.attribution,
			host.sessionViewLease.details);
		const reviewNav = host.reviewNavService.getReviewNavForSession(host.sessionViewLease.sessionId);
		const entries = attachReviewEntries(baseEntries, host.sessionViewLease.snapshot, reviewNav);

		let effectiveApplied = applied;
		if (options?.sidecarOnly) {
			effectiveApplied = computeReviewNavSidecarApplied(host.lastAttachedEntries, entries);
			if (effectiveApplied.kind === 'patches' && effectiveApplied.changedIds.size === 0) {
				host.lastAttachedEntries = entries;
				return;
			}
		}

		host.lastAttachedEntries = entries;
		host.timelineTree.applyEntries(entries, effectiveApplied);
		if (host.lensId === 'trajectory') {
			refreshTrajectoryRecords(host, host.sessionViewLease.sessionId);
			host.trajectoryView.refreshDetailInspector();
		}
		updateSyncChrome(host, host.sessionViewLease.snapshot.sync);
		updateConversationPhase(host);
		host.syncComposerPlacement();
		host.applyConversationDensity();
	
}

export function updateSyncChrome(host: IConversationLensProjectionHost, sync: SyncChrome): void {

		const label = formatSyncChromeLabel(sync);
		if (host.sessionSyncBadge) {
			if (label) {
				host.sessionSyncBadge.hidden = false;
				host.sessionSyncBadge.textContent = label;
				host.sessionSyncBadge.setAttribute('aria-label', label);
			} else {
				host.sessionSyncBadge.hidden = true;
				host.sessionSyncBadge.textContent = '';
				host.sessionSyncBadge.removeAttribute('aria-label');
			}
		}
		host.renderInboxStatus();
	
}

export function updateConversationPhase(host: IConversationLensProjectionHost): void {

		const preFirst = isPreFirst(host);
		if (preFirst && host.composerPolicy !== 'compose') {
			host.exitComposerEdit();
		}
		const nextPhase = preFirst ? 'prefirst' : 'active';
		if (host.conversationPhase === nextPhase) {
			// SessionBar Route mounts after the first phase apply; keep XOR in sync.
			host.updateSessionConfigVisibility(preFirst);
			return;
		}
		host.conversationPhase = nextPhase;

		host.readingColumn.classList.toggle(conversationLensPhasePreFirstClass, preFirst);
		host.slotHosts.dock.classList.toggle(conversationLensPhasePreFirstDockHiddenClass, preFirst);
		host.prefirstHero.hidden = !preFirst;
		host.updateSessionConfigVisibility(preFirst);

		if (preFirst) {
			host.prefirstHero.appendChild(host.identityStrip.element);
			host.prefirstHero.appendChild(host.gateRow);
			host.inboxOverlay.element.hidden = true;
		} else if (!host.filterAgentId) {
			host.readingColumn.insertBefore(host.identityStrip.element, host.readingColumn.firstChild);
			host.dockRoot.insertBefore(host.gateRow, host.inboxOverlay.element);
			host.inboxOverlay.element.hidden = false;
		} else {
			host.identityStrip.element.remove();
			host.dockRoot.insertBefore(host.gateRow, host.inboxOverlay.element);
			host.inboxOverlay.element.hidden = false;
		}
		host.updateGateRow();
		host.syncComposerPlacement();
		host.relayoutReadingSurfaces();
	
}

export function updateReadingColumn(host: IConversationLensProjectionHost): void {

		const sessionId = host.stubService.getActiveSessionId();
		if (host.lensId === 'trajectory') {
			host.timelineTree.hide();
			refreshTrajectoryRecords(host, sessionId);
			host.trajectoryView.show();
		} else {
			host.trajectoryView.hide();
			host.timelineTree.show();
		}
	
}

export function refreshTrajectoryRecords(host: IConversationLensProjectionHost, sessionId: string): void {

		const options = trajectoryProjectionOptions(host);
		const records = host.stubService.getTrajectoryRecords(sessionId, options);
		const lease = host.sessionViewLease?.sessionId === sessionId ? host.sessionViewLease : undefined;
		const turnIds = host.stubService.isEngineConnected() && lease
			? collectTrajectoryTurnIdsFromSnapshot(lease.snapshot)
			: collectConversationTrajectoryTurnIds(host.stubService.getTurns(sessionId));
		host.trajectoryView.setRecords(records, turnIds);
	
}

export function navigateToTurnFromTrajectory(host: IConversationLensProjectionHost, turnId: string): void {

		if (host.lensId !== 'conversation') {
			host.lensId = 'conversation';
			host.storageService.store(CONVERSATION_LENS_ID_STORAGE_KEY, 'conversation', StorageScope.WORKSPACE, StorageTarget.MACHINE);
			updateLensTabs(host);
			host.trajectoryView.hide();
			host.timelineTree.show();
		}
		if (host.inputMaximized) {
			host.setInputMaximized(false);
		}
		host.timelineTree.revealTurn(turnId);
	
}

export function navigateToTrajectoryFromTurn(host: IConversationLensProjectionHost, turnId: string): void {

		const sessionId = host.stubService.getActiveSessionId();
		const records = host.stubService.getTrajectoryRecords(sessionId, trajectoryProjectionOptions(host));
		const recordId = findTrajectoryRecordIdForTurn(turnId, records);
		if (!recordId) {
			return;
		}
		if (host.lensId !== 'trajectory') {
			host.lensId = 'trajectory';
			host.storageService.store(CONVERSATION_LENS_ID_STORAGE_KEY, 'trajectory', StorageScope.WORKSPACE, StorageTarget.MACHINE);
			updateLensTabs(host);
			host.timelineTree.hide();
			refreshTrajectoryRecords(host, sessionId);
			host.trajectoryView.show();
		}
		host.trajectoryView.revealRecord(recordId);
	
}

export function loadLensId(host: IConversationLensProjectionHost): ConversationLensId {

		const stored = host.storageService.get(CONVERSATION_LENS_ID_STORAGE_KEY, StorageScope.WORKSPACE);
		if (stored === 'conversation' || stored === 'trajectory') {
			return stored;
		}
		return 'conversation';
	
}

export function setLensId(host: IConversationLensProjectionHost, lensId: ConversationLensId): void {

		if (host.lensId === lensId) {
			return;
		}
		host.lensId = lensId;
		host.storageService.store(CONVERSATION_LENS_ID_STORAGE_KEY, lensId, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		updateLensTabs(host);
		updateReadingColumn(host);
	
}

export function updateLensTabs(host: IConversationLensProjectionHost): void {

		if (!host.lensTabConversation || !host.lensTabTrajectory) {
			return;
		}
		const isConversation = host.lensId === 'conversation';
		host.lensTabConversation.setAttribute('aria-selected', String(isConversation));
		host.lensTabTrajectory.setAttribute('aria-selected', String(!isConversation));
		host.lensTabConversation.setAttribute('aria-controls', 'conversation-lens-panel-conversation');
		host.lensTabTrajectory.setAttribute('aria-controls', 'conversation-lens-panel-trajectory');
		host.lensTabConversation.tabIndex = isConversation ? 0 : -1;
		host.lensTabTrajectory.tabIndex = isConversation ? -1 : 0;
	
}

export function handleLensTablistKeyDown(host: IConversationLensProjectionHost, event: KeyboardEvent): void {

		const target = event.target;
		if (target !== host.lensTabConversation && target !== host.lensTabTrajectory) {
			return;
		}
		let next: ConversationLensId | undefined;
		if (event.keyCode === KeyCode.RightArrow || event.keyCode === KeyCode.LeftArrow) {
			event.preventDefault();
			next = host.lensId === 'conversation' ? 'trajectory' : 'conversation';
		} else if (event.keyCode === KeyCode.Home) {
			event.preventDefault();
			next = 'conversation';
		} else if (event.keyCode === KeyCode.End) {
			event.preventDefault();
			next = 'trajectory';
		}
		if (!next) {
			return;
		}
		if (next !== host.lensId) {
			setLensId(host, next);
		}
		(next === 'conversation' ? host.lensTabConversation : host.lensTabTrajectory).focus();
	
}
