/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { KeyCode } from '../../../../base/common/keyCodes.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import type { ConversationViewFrameApplied, IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { SyncChrome } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { IConversationReviewNavService, attachReviewEntries, computeReviewNavSidecarApplied, createReviewNavAttachCache, type ReviewNavAttachCache } from './conversationReviewEntry.js';
import { projectSnapshotToEntries, formatSyncChromeLabel, createConversationProjectionCache, type ConversationProjectionCache, type ConversationTimelineEntry } from './conversationSessionView.js';
import {
	collectConversationTrajectoryTurnIds,
	collectTrajectoryTurnIdsFromSnapshot,
	findTrajectoryRecordIdForTurn,
} from './conversationTrajectoryModel.js';
import {
	conversationLensPhasePreFirstClass,
	conversationLensPhasePreFirstDockHiddenClass,
	conversationLensShowingTrajectoryClass,
} from './conversationLensDockStrings.js';
import { ConversationTimelineHost } from './conversationTimelineHost.js';
import { ConversationTrajectory } from './conversationTrajectory.js';
import { IConversationRosterService } from './conversationStubService.js';
import { ConversationIdentityStrip } from './conversationIdentityStrip.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { refreshStaleSnapshotBanner } from './conversationLensReadingColumn.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';

export const CONVERSATION_LENS_ID_STORAGE_KEY = 'conversation.lensId';

export type ConversationLensId = 'conversation' | 'trajectory';

export interface IConversationLensProjectionHost {
	/** Same dispose gate Mermaid resolve uses. */
	readonly isDisposed: boolean;
	lensId: ConversationLensId;
	filterAgentId: string | undefined;
	inputMaximized: boolean;
	conversationPhase: 'prefirst' | 'active' | undefined;
	composerPolicy: 'compose' | 'turnEdit' | 'queueEdit';
	lastAttachedEntries: readonly ConversationTimelineEntry[];
	sessionViewLease: IConversationSessionViewLease | undefined;
	relayoutReadingSurfaces(): void;
	readonly slotHosts: IConversationLensSlots;
	readonly stubService: IConversationRosterService;
	readonly uaConnection: IUniverseAgentConnection;
	readonly storageService: IStorageService;
	readonly reviewNavService: IConversationReviewNavService;
	getBoundSessionId(): string;
	/** When set, lens id changes stay local and do not write shared storage. */
	readonly pinConversationLens?: boolean;
	timelineTree: ConversationTimelineHost;
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
	updateSyncChrome(sync?: SyncChrome): void;
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

		const sessionId = host.getBoundSessionId();
		if (host.stubService.getTurns(sessionId).length > 0) {
			return false;
		}
		// Visible rows can exist when getTurns() is empty: localPendingSends are
		// dropped from legacy turns, and a painted lease timeline is the reading
		// column the user actually sees. Ignore a lease for a different session.
		const lease = host.sessionViewLease;
		const snapshot = lease?.sessionId === sessionId ? lease.snapshot : undefined;
		if ((snapshot?.localPendingSends.length ?? 0) > 0) {
			return false;
		}
		return (snapshot?.timeline.length ?? 0) === 0;
	
}

const projectionCacheByHost = new WeakMap<IConversationLensProjectionHost, ConversationProjectionCache>();
const reviewNavCacheByHost = new WeakMap<IConversationLensProjectionHost, ReviewNavAttachCache>();

function projectionCacheFor(host: IConversationLensProjectionHost): ConversationProjectionCache {
	let cache = projectionCacheByHost.get(host);
	if (!cache) {
		cache = createConversationProjectionCache();
		projectionCacheByHost.set(host, cache);
	}
	return cache;
}

function reviewNavCacheFor(host: IConversationLensProjectionHost): ReviewNavAttachCache {
	let cache = reviewNavCacheByHost.get(host);
	if (!cache) {
		cache = createReviewNavAttachCache();
		reviewNavCacheByHost.set(host, cache);
	}
	return cache;
}

export function applySessionViewTimeline(host: IConversationLensProjectionHost, applied: ConversationViewFrameApplied,
		options?: { readonly sidecarOnly?: boolean },): void {

		if (host.isDisposed) {
			return;
		}
		if (!host.sessionViewLease) {
			return;
		}
		const baseEntries = projectSnapshotToEntries(
			host.sessionViewLease.snapshot,
			host.sessionViewLease.attribution,
			host.sessionViewLease.details,
			host.stubService.stubTurnSessionLinkCatalog,
			projectionCacheFor(host),
			host.sessionViewLease.respondFailures,
			{ filterAgentId: host.filterAgentId });
		const reviewNav = host.reviewNavService.getReviewNavForSession(host.sessionViewLease.sessionId);
		const entries = attachReviewEntries(baseEntries, host.sessionViewLease.snapshot, reviewNav, reviewNavCacheFor(host));

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
		updateSyncChrome(host, host.stubService.getSessionSync(host.sessionViewLease.sessionId));
		updateConversationPhase(host);
		host.syncComposerPlacement();
		host.applyConversationDensity();
	
}

/** SessionBar / stale banner follow roster `getSessionSync` (D293 demote), not raw lease sync. */
export function resolveLensSessionSync(host: IConversationLensProjectionHost): SyncChrome {
	return host.stubService.getSessionSync(host.sessionViewLease?.sessionId ?? host.getBoundSessionId());
}

export function updateSyncChrome(host: IConversationLensProjectionHost, _sync?: SyncChrome): void {

		const sync = resolveLensSessionSync(host);
		const label = formatSyncChromeLabel(sync);
		if (host.sessionSyncBadge) {
			if (label) {
				host.sessionSyncBadge.hidden = false;
				host.sessionSyncBadge.textContent = label;
				host.sessionSyncBadge.title = label;
				host.sessionSyncBadge.setAttribute('aria-label', label);
			} else {
				host.sessionSyncBadge.hidden = true;
				host.sessionSyncBadge.textContent = '';
				host.sessionSyncBadge.removeAttribute('aria-label');
				host.sessionSyncBadge.removeAttribute('title');
			}
		}
		host.renderInboxStatus();
		refreshStaleSnapshotBanner(host);
	
}

export function updateConversationPhase(host: IConversationLensProjectionHost): void {

		const preFirst = isPreFirst(host);
		if (preFirst && host.composerPolicy !== 'compose') {
			host.exitComposerEdit();
		}
		const nextPhase = preFirst ? 'prefirst' : 'active';
		if (host.conversationPhase === nextPhase) {
			// Agent SelectBox mounts after the first phase apply; keep PreFirst XOR in sync.
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

		const sessionId = host.getBoundSessionId();
		if (host.lensId === 'trajectory') {
			host.timelineTree.hide();
			host.trajectoryView.show();
			refreshTrajectoryRecords(host, sessionId);
		} else {
			host.trajectoryView.hide();
			host.timelineTree.show();
		}
	
}

export function refreshTrajectoryRecords(host: IConversationLensProjectionHost, sessionId: string): void {

		if (host.isDisposed) {
			return;
		}
		const options = trajectoryProjectionOptions(host);
		const records = host.stubService.getTrajectoryRecords(sessionId, options);
		const lease = host.sessionViewLease?.sessionId === sessionId ? host.sessionViewLease : undefined;
		const pairingHold = isConversationPairingHold(host.uaConnection);
		if ((host.stubService.isEngineConnected() || pairingHold) && lease) {
			host.trajectoryView.setRecords(records, collectTrajectoryTurnIdsFromSnapshot(lease.snapshot));
			return;
		}
		const stubTurnIds = collectConversationTrajectoryTurnIds(host.stubService.getTurns(sessionId));
		if (pairingHold && host.trajectoryView.getPaintedRecordCount() > 0 && stubTurnIds.size === 0) {
			return;
		}
		host.trajectoryView.setRecords(records, stubTurnIds);
	
}

export function navigateToTurnFromTrajectory(host: IConversationLensProjectionHost, turnId: string): void {

		if (host.lensId !== 'conversation') {
			host.lensId = 'conversation';
			storeLensId(host, 'conversation');
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

		const sessionId = host.getBoundSessionId();
		const records = host.stubService.getTrajectoryRecords(sessionId, trajectoryProjectionOptions(host));
		const recordId = findTrajectoryRecordIdForTurn(turnId, records);
		if (!recordId) {
			return;
		}
		if (host.lensId !== 'trajectory') {
			host.lensId = 'trajectory';
			storeLensId(host, 'trajectory');
			updateLensTabs(host);
			host.timelineTree.hide();
			host.trajectoryView.show();
			refreshTrajectoryRecords(host, sessionId);
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

function storeLensId(host: IConversationLensProjectionHost, lensId: ConversationLensId): void {
	if (host.pinConversationLens) {
		return;
	}
	host.storageService.store(CONVERSATION_LENS_ID_STORAGE_KEY, lensId, StorageScope.WORKSPACE, StorageTarget.MACHINE);
}

export function setLensId(host: IConversationLensProjectionHost, lensId: ConversationLensId): void {

		if (host.lensId === lensId) {
			return;
		}
		host.lensId = lensId;
		storeLensId(host, lensId);
		updateLensTabs(host);
		updateReadingColumn(host);
	
}

export function updateLensTabs(host: IConversationLensProjectionHost): void {

		const showingTrajectory = host.lensId === 'trajectory';
		host.slotHosts.timeline.classList.toggle(conversationLensShowingTrajectoryClass, showingTrajectory);
		host.slotHosts.dock.classList.toggle(conversationLensShowingTrajectoryClass, showingTrajectory);
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
