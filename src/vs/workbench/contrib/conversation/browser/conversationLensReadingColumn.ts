/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, getWindow } from '../../../../base/browser/dom.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND } from '../../sources/browser/sourcesReview.contribution.js';
import { applyConversationDensityClass, shouldShowClientToolInvocationDetails } from '../common/uaClientSettingsHelpers.js';
import { ConversationIdentityStrip } from './conversationIdentityStrip.js';
import { ConversationTimelineTree } from './conversationTimelineTree.js';
import { ConversationTrajectory } from './conversationTrajectory.js';
import type { ConversationQuestionRespondAnswers } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { conversationLensPhasePreFirstClass, conversationLensPrefirstHeroClass } from './conversationLensDockStrings.js';
import type { ConversationLensId } from './conversationLensProjection.js';
import { conversationLeafWidthBucket, isConversationLeafCompact, isConversationLeafNarrow } from './conversationNarrowLayout.js';
import { IConversationRosterService } from './conversationStubService.js';

export interface IConversationLensReadingColumnHost {
	lensId: ConversationLensId;
	lastReadingWidth: number;
	lastRevealItemId: string | undefined;
	readingColumn: HTMLElement;
	prefirstHero: HTMLElement;
	identityStrip: ConversationIdentityStrip;
	timelineTree: ConversationTimelineTree;
	trajectoryView: ConversationTrajectory;
	sessionViewLease: IConversationSessionViewLease | undefined;
	readonly slotHosts: IConversationLensSlots;
	readonly stubService: IConversationRosterService;
	readonly configurationService: IConfigurationService;
	readonly commandService: ICommandService;
	readonly instantiationService: IInstantiationService;
	register<T extends IDisposable>(disposable: T): T;
	resolveConfirmation(turnId: string, status: 'allowed' | 'skipped'): Promise<void>;
	resolveQuestion(turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string): Promise<void>;
	copyTurn(text: string): void;
	deleteTurn(turnId: string): void;
	beginTurnEdit(turnId: string): void;
	navigateToTrajectoryFromTurn(turnId: string): void;
	cancelToolCall(turn: { readonly id: string; readonly agentId?: string }): void;
	openVisualizeOverlay(source: string, title?: string): void;
	navigateToTurnFromTrajectory(turnId: string): void;
}

export function mountTimeline(host: IConversationLensReadingColumnHost, timelineHost: HTMLElement): void {

	host.readingColumn = append(timelineHost, $('.conversation-lens-reading-column'));
	host.identityStrip = host.register(host.instantiationService.createInstance(ConversationIdentityStrip, host.readingColumn));
	host.prefirstHero = append(host.readingColumn, $(`.${conversationLensPrefirstHeroClass}`));
	host.prefirstHero.hidden = true;
	host.timelineTree = host.register(host.instantiationService.createInstance(ConversationTimelineTree, host.readingColumn, {
		onResolveConfirmation: (turnId, status) => host.resolveConfirmation(turnId, status),
		onQuestionRespond: (turnId, requestId, answers, customText) => host.resolveQuestion(turnId, requestId, answers, customText),
		onCopyTurn: (_turnId, text) => host.copyTurn(text),
		onDeleteTurn: turnId => host.deleteTurn(turnId),
		onEditUserTurn: turnId => host.beginTurnEdit(turnId),
		onViewInTrajectory: turnId => host.navigateToTrajectoryFromTurn(turnId),
		onCancelToolCall: turn => host.cancelToolCall(turn),
		onReviewNavClick: paths => {
			void host.commandService.executeCommand(
				SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND,
				paths.map(path => URI.parse(path)),
			);
		},
		onOpenVisualizeFullscreen: (source, title) => host.openVisualizeOverlay(source, title),
		showLiveChrome: () => host.stubService.isEngineConnected(),
		showToolInvocationDetails: () => shouldShowClientToolInvocationDetails(host.configurationService),
	}));
	host.trajectoryView = host.register(host.instantiationService.createInstance(ConversationTrajectory, host.readingColumn, {
		onNavigateToLinkedTurn: turnId => host.navigateToTurnFromTrajectory(turnId),
		showLiveChrome: () => host.stubService.isEngineConnected(),
		detailContext: {
			supportsDetailFetch: () => typeof host.sessionViewLease?.requestDetail === 'function',
			getDetailBody: ref => host.sessionViewLease?.details.get(ref),
			requestDetail: ref => {
				const lease = host.sessionViewLease;
				if (!lease?.requestDetail) {
					return Promise.resolve({ ok: false as const, reason: 'unavailable' as const });
				}
				return lease.requestDetail(ref);
			},
		},
	}));
	host.timelineTree.domNode.id = 'conversation-lens-panel-conversation';
	host.timelineTree.domNode.setAttribute('role', 'tabpanel');
	host.timelineTree.domNode.setAttribute('aria-labelledby', 'conversation-lens-tab-conversation');
	const trajectoryHost = host.readingColumn.querySelector('.conversation-lens-trajectory') as HTMLElement;
	trajectoryHost.id = 'conversation-lens-panel-trajectory';
	trajectoryHost.setAttribute('role', 'tabpanel');
	trajectoryHost.setAttribute('aria-labelledby', 'conversation-lens-tab-trajectory');

}

export function bindReadingColumnLayout(host: IConversationLensReadingColumnHost): void {

	const targetWindow = getWindow(host.readingColumn);
	if (typeof targetWindow.ResizeObserver !== 'function') {
		return;
	}
	const observer = new targetWindow.ResizeObserver(entries => {
		for (const entry of entries) {
			const width = Math.floor(entry.contentRect.width);
			const height = Math.floor(entry.contentRect.height);
			const restored = host.lastReadingWidth < 1 && width > 0;
			host.lastReadingWidth = width;
			applyConversationWidth(host, width);
			layoutReadingSurfaces(host, height, width);
			if (restored && host.lastRevealItemId && host.lensId === 'conversation') {
				host.timelineTree.revealTurn(host.lastRevealItemId);
			}
		}
	});
	observer.observe(host.readingColumn);
	host.register(toDisposable(() => observer.disconnect()));

}

/** PreFirst hero owns the reading column; do not let an empty tree consume the leaf height. */
export function layoutReadingSurfaces(host: IConversationLensReadingColumnHost, height: number, width: number): void {
	const preFirst = host.readingColumn.classList.contains(conversationLensPhasePreFirstClass);
	const surfaceHeight = preFirst ? 0 : height;
	host.timelineTree.layout(surfaceHeight, width);
	host.trajectoryView.layout(surfaceHeight, width);
}

export function applyConversationDensity(host: IConversationLensReadingColumnHost): void {

	applyConversationDensityClass(host.slotHosts.timeline, host.configurationService);
	if (host.readingColumn) {
		applyConversationDensityClass(host.readingColumn, host.configurationService);
	}
	if (host.timelineTree?.domNode) {
		applyConversationDensityClass(host.timelineTree.domNode, host.configurationService);
	}
	for (const root of host.slotHosts.timeline.querySelectorAll<HTMLElement>('[data-process-fold]')) {
		applyConversationDensityClass(root, host.configurationService);
	}

}

export function applyConversationWidth(host: IConversationLensReadingColumnHost, width: number): void {

	applyLeafWidthClasses(host.readingColumn, width);
	applyLeafWidthClasses(host.slotHosts.timeline, width);
	applyLeafWidthClasses(host.slotHosts.dock, width);
	if (host.slotHosts.sessionBar) {
		// Part 级 sessionBar 用自己的盒宽，避免并列窄叶把共享栏打成 .is-narrow。
		// Overlay 自备栏在尚未 paint 时回退到本次叶宽。
		const measured = host.slotHosts.sessionBar.clientWidth;
		const barWidth = measured > 0
			? measured
			: isOverlaySessionBarHost(host)
				? width
				: 0;
		if (barWidth > 0) {
			applyLeafWidthClasses(host.slotHosts.sessionBar, barWidth);
		}
	}

}

function isOverlaySessionBarHost(host: IConversationLensReadingColumnHost): boolean {
	return !!host.slotHosts.sessionBar?.classList.contains('conversation-subagent-overlay-session-bar');
}

function applyLeafWidthClasses(element: HTMLElement, width: number): void {
	element.dataset.conversationWidth = conversationLeafWidthBucket(width);
	element.classList.toggle('is-narrow', isConversationLeafNarrow(width));
	element.classList.toggle('is-compact', isConversationLeafCompact(width));
}
