/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, getActiveElement, getWindow, scheduleAtNextAnimationFrame } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { asCssVariable, asCssVariableWithDefault, buttonSecondaryBackground, buttonSecondaryForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import type { ConversationViewFrameApplied } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import { conversationLensPinnedUserPromptAria, conversationLensPinnedUserPromptCopyAria } from './conversationLensSessionBarStrings.js';
import { ConversationMermaidExtensionInfo } from './conversationMermaidHost.js';
import { ProcessFoldSpan, projectProcessFoldSpans, summarizeProcessSteps } from './conversationProcessFoldModel.js';
import {
	ConversationTimelineFlatItem,
	flattenConversationTimelineItems,
	rangeVisibleTimelineIndices,
	resolvePinnedUserPromptState,
} from './conversationPinnedUserPrompt.js';
import {
	ConversationTimelineEntry,
	createConversationProjectionCache,
	entriesToRenderableTurns,
	getConversationEntryAriaLabel,
	stubTurnsToEntries,
} from './conversationSessionView.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { ConversationTimelineFollowController } from './conversationTimelineFollow.js';
import { ConversationTimelineItemHost, ConversationTimelineHostRoot, ConversationTimelineItemHostHooks } from './conversationTimelineItemHost.js';
import { computeTimelineReconcile } from './conversationTimelineReconcile.js';
import { ConversationTimelineRenderer } from './conversationTimelineRenderer.js';
import { ConversationTimelineResourceBudget, ConversationTimelineVisibilityObserverFactory } from './conversationTimelineResourceBudget.js';
import {
	computeConversationScrollDownState,
	isConversationTimelineScrolledToBottom,
} from './conversationTimelineScroll.js';
import { IConversationTimelineHostOptions } from './conversationTimelineTypes.js';
import { IConversationTimelineLinkHit } from './resolveConversationTimelineLink.js';
import { ConversationTurnContentAdapter, IConversationTurnContentAdapter } from './conversationTurnContentAdapter.js';

const CONVERSATION_TIMELINE_INITIAL_WINDOW = 60;
const CONVERSATION_TIMELINE_WINDOW_BATCH = 40;
const CONVERSATION_TIMELINE_CV_TAIL = 3;

/**
 * Document-flow conversation timeline. Native scrollport, one article per root,
 * keyed by id. Public surface matches {@link ConversationTimelineTree}.
 */
export class ConversationTimelineHost extends Disposable {

	private readonly _domNode: HTMLElement;
	private readonly viewport: HTMLElement;
	private readonly stream: HTMLElement;
	private readonly sentinel: HTMLElement;
	private readonly emptyState: HTMLElement;
	private readonly pinnedHost: HTMLElement;
	private readonly pinnedUserBubble: HTMLButtonElement;
	private readonly pinnedUserText: HTMLElement;
	private readonly pinnedUserCopyButton: Button;
	private readonly scrollDownButton: Button;
	private readonly renderer: ConversationTimelineRenderer;
	private readonly turnContentAdapter: IConversationTurnContentAdapter;
	private readonly follow = new ConversationTimelineFollowController();
	private readonly hooks: ConversationTimelineItemHostHooks;
	private readonly projectionCache = createConversationProjectionCache();
	private readonly itemHosts = new Map<string, ConversationTimelineItemHost>();
	private readonly articleById = new Map<string, HTMLElement>();
	private readonly thinkingExpanded = new Map<string, boolean>();
	private readonly toolExpanded = new Map<string, boolean>();

	private resizeObserver: { disconnect(): void } | undefined;
	private intersectionObserver: { disconnect(): void } | undefined;

	private currentTurns: readonly ConversationStubTurn[] = [];
	private flatItems: readonly ConversationTimelineFlatItem[] = [];
	private latestRoots: readonly ConversationTimelineHostRoot[] = [];
	private committedRoots: readonly ConversationTimelineHostRoot[] = [];
	private mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;
	private editingTurnId: string | undefined;
	private pinnedUserState: { turnId: string; fullText: string } | undefined;

	private _visible = true;
	private domStale = false;
	private windowInitialized = false;
	private windowStart = 0;
	private windowAnchorId: string | undefined;
	private applying = false;
	private intersectionBusy = false;
	private intersectionQueued = false;
	private pinnedFrame = false;
	private suppressUserToggle = false;

	private rovingRootId: string | undefined;
	private lastRevealTurnId: string | undefined;
	private pendingRevealId: string | undefined;
	private revealMissNotifiedFor: string | undefined;
	/** Set by {@link revealPendingTurn}. Cleared once that turn is scrolled. */
	private releaseFollowTurnId: string | undefined;

	private _testSetChildrenCount = 0;
	private _testRerenderCount = 0;

	constructor(
		parent: HTMLElement,
		private readonly options: IConversationTimelineHostOptions,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWebviewService private readonly webviewService: IWebviewService,
	) {
		super();

		const timeline = append(parent, $('.conversation-lens-timeline'));
		timeline.setAttribute('role', 'log');
		timeline.setAttribute('aria-label', localize('conversationLens.timeline', "Conversation timeline"));
		timeline.style.position = 'relative';
		timeline.style.flexDirection = 'column';
		timeline.style.height = '100%';
		// Display stays in CSS. An inline display:flex beats PreFirst `display: none`
		// and pins the empty-session composer to the top of the column.
		this._domNode = timeline;

		// Chrome column only. Inline diagram wheels must not write this node's scrollTop.
		const scrollChrome = append(timeline, $('.conversation-lens-timeline-scroll'));
		scrollChrome.style.display = 'flex';
		scrollChrome.style.flexDirection = 'column';
		scrollChrome.style.flex = '1';
		scrollChrome.style.minHeight = '0';
		scrollChrome.style.position = 'relative';

		this.viewport = append(scrollChrome, $('.conversation-timeline-viewport'));
		this.viewport.style.overflowY = 'auto';
		this.viewport.style.overflowX = 'hidden';
		this.viewport.style.overflowAnchor = 'auto';
		this.viewport.style.scrollbarGutter = 'stable';
		this.viewport.style.scrollPaddingTop = '44px';
		this.viewport.style.flex = '1';
		this.viewport.style.minHeight = '0';
		this.viewport.style.height = '100%';

		this.emptyState = append(this.viewport, $('.conversation-lens-timeline-empty'));
		append(this.emptyState, $('p.conversation-lens-timeline-empty-title')).textContent =
			localize('conversationLens.timelineEmptyTitle', "No messages yet");

		this.stream = append(this.viewport, $('.conversation-timeline-stream.conversation-lens-timeline-content'));
		this.stream.setAttribute('role', 'feed');
		this.stream.style.paddingBottom = `${options.paddingBottom ?? 36}px`;
		this.sentinel = append(this.stream, $('div.conversation-timeline-sentinel'));
		this.sentinel.setAttribute('aria-hidden', 'true');

		this.pinnedHost = append(timeline, $('.conversation-timeline-pinned.conversation-timeline-pinned-user'));
		this.pinnedHost.hidden = true;
		this.pinnedHost.style.position = 'absolute';
		this.pinnedHost.style.top = '0';
		this.pinnedHost.style.left = '0';
		this.pinnedHost.style.right = '0';
		const pinnedUserInner = append(this.pinnedHost, $('.conversation-timeline-pinned-user-inner.conversation-lens-turn-body--user-bubble'));
		this.pinnedUserBubble = append(pinnedUserInner, $('button.conversation-timeline-pinned-user-bubble')) as HTMLButtonElement;
		this.pinnedUserBubble.type = 'button';
		this.pinnedUserBubble.setAttribute('aria-label', conversationLensPinnedUserPromptAria);
		this.pinnedUserText = append(this.pinnedUserBubble, $('span.conversation-timeline-pinned-user-text'));
		const pinnedUserCopyContainer = append(pinnedUserInner, $('span.conversation-timeline-pinned-user-copy'));
		this.pinnedUserCopyButton = this._register(new Button(pinnedUserCopyContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensPinnedUserPromptCopyAria,
			ariaLabel: conversationLensPinnedUserPromptCopyAria,
		}));
		this.pinnedUserCopyButton.icon = Codicon.copy;
		this._register(this.pinnedUserCopyButton.onDidClick(e => {
			e?.stopPropagation();
			if (this.pinnedUserState && options.onCopyTurn) {
				options.onCopyTurn(this.pinnedUserState.turnId, this.pinnedUserState.fullText);
			}
		}));
		this._register(addDisposableListener(this.pinnedUserBubble, 'click', () => {
			if (this.pinnedUserState) {
				this.revealTurn(this.pinnedUserState.turnId);
			}
		}));

		const contentAdapter = options.contentAdapter
			?? this.instantiationService.createInstance(ConversationTurnContentAdapter);
		this.turnContentAdapter = contentAdapter;

		this.renderer = new ConversationTimelineRenderer(
			contentAdapter,
			options.onResolveConfirmation,
			options.onQuestionRespond,
			options.onCopyTurn,
			options.onDeleteTurn,
			options.onEditUserTurn,
			options.onViewInTrajectory,
			options.onCancelToolCall,
			options.onRetryError,
			options.onReviewNavClick,
			() => this.editingTurnId,
			options.onOpenVisualizeFullscreen,
			() => this.mermaidExtensionInfo,
			() => options.showLiveChrome?.() ?? false,
			() => options.writesEnabled?.() ?? true,
			() => options.showToolInvocationDetails?.() ?? true,
			this.webviewService,
			() => this.viewport,
			() => { /* document flow has no row-height cache */ },
			options.diffEditorPool,
			this.instantiationService,
			options.onRegenerateTurn,
			options.onRespondClientTool,
			() => this.refreshScrollChrome(),
		);

		const expanded = () => this.renderer.getTestExpandedState();
		this.hooks = {
			renderer: this.renderer,
			contentAdapter,
			isOuterExpanded: spanId => expanded().processFoldOuterExpanded.get(spanId) ?? false,
			setOuterExpanded: (spanId, expandedState) => {
				const map = expanded().processFoldOuterExpanded;
				if (expandedState) {
					map.set(spanId, true);
				} else {
					map.delete(spanId);
				}
			},
			isThinkingExpanded: turnId => this.thinkingExpanded.get(turnId) ?? false,
			setThinkingExpanded: (turnId, expandedState) => {
				if (expandedState) {
					this.thinkingExpanded.set(turnId, true);
					this.renderer.ensureThinkingExpanded(turnId);
				} else {
					this.thinkingExpanded.delete(turnId);
				}
			},
			isToolExpanded: turnId => this.toolExpanded.get(turnId) ?? false,
			setToolExpanded: (turnId, expandedState) => {
				if (expandedState) {
					this.toolExpanded.set(turnId, true);
				} else {
					this.toolExpanded.delete(turnId);
				}
			},
			onProcessFoldLayout: rootId => this.onProcessFoldLayout(rootId),
			showLiveChrome: () => options.showLiveChrome?.() ?? false,
			writesEnabled: () => options.writesEnabled?.() ?? true,
			showToolInvocationDetails: () => options.showToolInvocationDetails?.() ?? true,
			onViewInTrajectory: options.onViewInTrajectory,
			onCancelToolCall: options.onCancelToolCall,
			onRespondClientTool: options.onRespondClientTool,
			diffEditorPool: options.diffEditorPool,
			instantiationService: this.instantiationService,
		};

		const scrollToBottomLabel = localize('conversationLens.scrollToBottom', "Scroll to Bottom");
		const scrollToBottomBackground = asCssVariableWithDefault('chat.list.background', asCssVariable(buttonSecondaryBackground));
		this.scrollDownButton = this._register(new Button(timeline, {
			title: scrollToBottomLabel,
			ariaLabel: scrollToBottomLabel,
			buttonBackground: scrollToBottomBackground,
			buttonForeground: asCssVariable(buttonSecondaryForeground),
			buttonHoverBackground: scrollToBottomBackground,
			buttonSecondaryBackground: undefined,
			buttonSecondaryForeground: undefined,
			buttonSecondaryHoverBackground: undefined,
			buttonSeparator: undefined,
			supportIcons: true,
		}));
		this.scrollDownButton.element.classList.add('conversation-timeline-scroll-down');
		this.scrollDownButton.label = `$(${Codicon.chevronDown.id})`;
		this.scrollDownButton.element.style.display = 'none';
		this._register(this.scrollDownButton.onDidClick(() => {
			this.follow.setScrollLock(true);
			this.scrollToEnd();
		}));

		this._register(addDisposableListener(this.viewport, 'scroll', () => {
			this.follow.handleScroll(this.viewport.scrollTop, this.viewport.clientHeight, this.viewport.scrollHeight);
			this.updateScrollDownButton();
			this.schedulePinnedRefresh();
		}));
		this._register(addDisposableListener(this.stream, 'keydown', e => this.onStreamKeyDown(e)));
		this._register(addDisposableListener(this.stream, 'focusin', () => this.onStreamFocusIn()));

		try {
			this._register(new ConversationTimelineResourceBudget({
				root: this.viewport,
				createObserver: this.adaptIntersectionObserver(options),
			}));
		} catch {
			// Budget observation is optional for this step. A throwing IntersectionObserver must not block mount.
		}
		this.connectObservers();
		this.updateScrollDownButton();
	}

	get domNode(): HTMLElement {
		return this._domNode;
	}

	show(): void {
		this.setVisible(true);
	}

	hide(): void {
		this.setVisible(false);
	}

	setVisible(visible: boolean): void {
		if (this._visible === visible) {
			return;
		}
		this._visible = visible;
		this._domNode.hidden = !visible;
		if (visible && this.domStale) {
			this.domStale = false;
			this.commit(this.latestRoots);
		}
	}

	setMermaidExtensionInfo(info: ConversationMermaidExtensionInfo | undefined): void {
		this.mermaidExtensionInfo = info;
		let count = 0;
		for (const host of this.itemHosts.values()) {
			if (host.root.turns.some(entry => entry.turn.kind === 'visualization')) {
				host.render('full');
				count++;
			}
		}
		this._testRerenderCount += count;
	}

	setTurns(turns: readonly ConversationStubTurn[]): void {
		this.applyEntries(stubTurnsToEntries(turns), { kind: 'baseline' });
	}

	applyEntries(entries: readonly ConversationTimelineEntry[], _applied: ConversationViewFrameApplied): void {
		const projected = this.project(entries);
		this.currentTurns = projected.turns;
		this.flatItems = projected.flat;
		this.latestRoots = projected.roots;
		if (!this._visible) {
			this.domStale = true;
			return;
		}
		this.commit(projected.roots);
	}

	getTestApplyMetrics(): { setChildrenCount: number; rerenderCount: number } {
		return { setChildrenCount: this._testSetChildrenCount, rerenderCount: this._testRerenderCount };
	}

	resetTestApplyMetrics(): void {
		this._testSetChildrenCount = 0;
		this._testRerenderCount = 0;
	}

	getTestExpandedState(): {
		userBubbleExpanded: Map<string, boolean>;
		processFoldOuterExpanded: Map<string, boolean>;
		visualizeExpanded: Map<string, boolean>;
	} {
		return this.renderer.getTestExpandedState();
	}

	getTimelineRowElement(id: string): HTMLElement | undefined {
		return this.articleById.get(id) ?? this.findStreamArticle(id);
	}

	refreshPresentation(): void {
		let count = 0;
		for (const host of this.orderedHosts()) {
			if (!rootReadsPresentation(host.root)) {
				continue;
			}
			host.render('full');
			count++;
		}
		this._testRerenderCount += count;
		this.updateChrome();
	}

	/**
	 * Expand maps outlive a session. A hidden timeline commits only on show, and
	 * a structurally identical frame is `none`, so the open DOM survives a map
	 * clear unless the mounted folds are repainted here. `update()` returns
	 * before thinking and tool rows when the outer fold is shut, so this is a
	 * full render rather than `refreshProcessFold`.
	 */
	clearProcessFoldExpanded(): void {
		this.renderer.clearProcessFoldExpanded();
		this.thinkingExpanded.clear();
		this.toolExpanded.clear();
		for (const host of this.orderedHosts()) {
			if (host.root.kind === 'process-fold') {
				host.render('full');
			}
		}
	}

	setEditingTurnId(turnId: string | undefined): void {
		if (this.editingTurnId === turnId) {
			return;
		}
		const previous = this.editingTurnId;
		this.editingTurnId = turnId;
		const ids = new Set<string>();
		if (previous) {
			ids.add(previous);
		}
		if (turnId) {
			ids.add(turnId);
		}
		const seen = new Set<string>();
		for (const id of ids) {
			const host = this.ensureTurnRendered(id);
			if (!host || seen.has(host.root.id)) {
				continue;
			}
			seen.add(host.root.id);
			host.render('full');
			this._testRerenderCount++;
		}
		this.updateChrome();
	}

	getTurnEditHost(turnId: string): HTMLElement | undefined {
		if (this.editingTurnId !== turnId) {
			return undefined;
		}
		const host = this.itemHostForTurn(turnId);
		if (!host) {
			return undefined;
		}
		return findDescendant(host.article, el => el.classList.contains('conversation-lens-turn-edit-host'));
	}

	private revealRelativeTop = 0.5;

	revealTurn(turnId: string, relativeTop = 0.5): void {
		this.lastRevealTurnId = turnId;
		this.pendingRevealId = turnId;
		this.revealRelativeTop = relativeTop;
		if (this._visible && !this.domStale) {
			this.flushPendingReveal();
		}
	}

	/**
	 * Inbox pending chip, return-to-session, and notification Show.
	 * Instant reveal (not a smooth `scrollIntoView`). When the seat is not the
	 * tail root, drop stick-to-bottom so the next frame or resize does not
	 * yank the viewport back to the end.
	 */
	revealPendingTurn(turnId: string): void {
		this.releaseFollowTurnId = turnId;
		this.revealTurn(turnId, 0.5);
	}

	focusRecord(turnId: string): void {
		if (this._isDisposed) {
			return;
		}
		this.lastRevealTurnId = turnId;
		if (!this._visible || this.domStale) {
			this.pendingRevealId = turnId;
			return;
		}
		const article = this.prepareTurn(turnId);
		if (!article) {
			this.notifyRevealMiss(turnId);
			return;
		}
		this.revealMissNotifiedFor = undefined;
		this.pendingRevealId = undefined;
		const root = this.rootForTurn(turnId);
		if (root) {
			this.rovingRootId = root.id;
			this.updateRoving();
		}
		const el = this.getConfirmationElement(turnId) ?? article;
		if (el.tabIndex < 0) {
			el.tabIndex = 0;
		}
		el.focus({ preventScroll: true });
		this.scrollArticleIntoView(article);
	}

	acquireAutoScrollHold(): IDisposable {
		return this.follow.acquireHold();
	}

	get isAutoScrollHeld(): boolean {
		return this.follow.held;
	}

	get scrollLock(): boolean {
		return this.follow.scrollLock;
	}

	set scrollLock(value: boolean) {
		this.setScrollLock(value);
	}

	setScrollLock(value: boolean): void {
		this.follow.setScrollLock(value);
		this.updateScrollDownButton();
		this.schedulePinnedRefresh();
	}

	scrollToEnd(): void {
		const top = this.viewport.scrollHeight;
		this.follow.recordWrite(top);
		this.viewport.scrollTop = top;
		this.updateScrollDownButton();
		this.updatePinnedUserPrompt();
	}

	refreshScrollChrome(): void {
		this.updateScrollDownButton();
		this.updatePinnedUserPrompt();
	}

	isScrolledToBottom(): boolean {
		return isConversationTimelineScrolledToBottom(this.viewport.scrollTop, this.viewport.clientHeight, this.viewport.scrollHeight);
	}

	getConfirmationElement(turnId: string): HTMLElement | undefined {
		return this.renderer.getConfirmationElement(turnId)
			?? this.findConfirmationInArticle(turnId);
	}

	getFocusedTurn(): ConversationStubTurn | undefined {
		const active = getActiveElement();
		const article = active?.closest('article.conversation-timeline-item');
		if (article instanceof HTMLElement && this.stream.contains(article)) {
			const rootId = article.dataset.rootId;
			const root = rootId ? this.latestRoots.find(candidate => candidate.id === rootId) : undefined;
			if (root?.turns[0]) {
				return root.turns[0].turn;
			}
		}
		if (this.lastRevealTurnId) {
			for (const root of this.latestRoots) {
				const match = root.turns.find(entry => entry.id === this.lastRevealTurnId);
				if (match) {
					return match.turn;
				}
			}
		}
		return this.currentTurns.at(-1);
	}

	layout(height: number, width: number): void {
		if (height === 0 || width === 0) {
			return;
		}
		if (typeof height === 'number') {
			this.viewport.style.height = `${height}px`;
		}
	}

	private _isDisposed = false;
	get isDisposed(): boolean {
		return this._isDisposed;
	}

	override dispose(): void {
		if (this._isDisposed) {
			return;
		}
		this._isDisposed = true;
		for (const host of this.itemHosts.values()) {
			host.dispose();
		}
		this.itemHosts.clear();
		this.articleById.clear();
		this.renderer.clearConfirmationSeats();
		this.resizeObserver?.disconnect();
		this.intersectionObserver?.disconnect();
		super.dispose();
	}

	private project(entries: readonly ConversationTimelineEntry[]): {
		turns: readonly ConversationStubTurn[];
		roots: readonly ConversationTimelineHostRoot[];
		flat: readonly ConversationTimelineFlatItem[];
	} {
		const turns = entriesToRenderableTurns(entries, this.projectionCache);
		const spans = projectProcessFoldSpans(turns);
		const roots = buildHostRoots(turns, spans);
		const flat = flattenConversationTimelineItems(turns, spans);
		return { turns, roots, flat };
	}

	private commit(next: readonly ConversationTimelineHostRoot[]): void {
		const plan = computeTimelineReconcile(this.committedRoots, next);
		if (plan.mode === 'none') {
			this.committedRoots = next;
			this.flushPendingReveal();
			return;
		}

		const lastKnownAtBottom = this.isScrolledToBottom();
		this.committedRoots = next;
		this.latestRoots = next;
		this.windowStart = this.computeWindowStart(next);
		this.windowAnchorId = next[this.windowStart]?.id;

		this.applying = true;
		let mutated = false;
		let rerenders = 0;
		try {
			const result = this.syncArticles(new Set(plan.changed));
			mutated = result.mutated;
			rerenders = result.rerenders;
		} finally {
			this.applying = false;
		}
		if (this.intersectionQueued) {
			this.intersectionQueued = false;
			this.prependWindowBatch();
		}
		if (mutated) {
			this._testSetChildrenCount++;
		}
		this._testRerenderCount += rerenders;

		if (this.follow.shouldStickOnFrame(lastKnownAtBottom)) {
			const top = this.viewport.scrollHeight;
			this.follow.recordWrite(top);
			this.viewport.scrollTop = top;
		}

		this.pruneExpanded(next);
		this.flushPendingReveal();
		this.updateScrollDownButton();
		this.schedulePinnedRefresh();
	}

	private syncArticles(changed: ReadonlySet<string>): { mutated: boolean; rerenders: number } {
		const slice = this.latestRoots.slice(this.windowStart);
		const sliceIds = new Set(slice.map(root => root.id));
		let mutated = false;
		let rerenders = 0;

		for (const [id, host] of [...this.itemHosts]) {
			if (!sliceIds.has(id)) {
				host.dispose();
				this.itemHosts.delete(id);
				mutated = true;
			}
		}

		let previous: Node = this.sentinel;
		for (const root of slice) {
			let host = this.itemHosts.get(root.id);
			if (!host) {
				host = new ConversationTimelineItemHost(root, this.hooks);
				host.render('full');
				this.itemHosts.set(root.id, host);
				mutated = true;
			} else {
				host.adopt(root);
				if (changed.has(root.id)) {
					host.render('auto');
					rerenders++;
				}
			}
			const expectedNext = previous.nextSibling;
			if (expectedNext !== host.article) {
				const existed = host.article.parentNode === this.stream;
				this.stream.insertBefore(host.article, expectedNext);
				if (existed) {
					mutated = true;
				}
			}
			previous = host.article;
		}

		this.reindexArticles();
		this.updateEmptyState();
		this.updateChrome();
		this.updateRoving();
		return { mutated, rerenders };
	}

	private computeWindowStart(roots: readonly ConversationTimelineHostRoot[]): number {
		if (roots.length === 0) {
			return 0;
		}
		const pending = earliestPendingRootIndex(roots);
		let start: number;
		if (!this.windowInitialized) {
			start = Math.max(0, roots.length - CONVERSATION_TIMELINE_INITIAL_WINDOW);
			this.windowInitialized = true;
		} else {
			start = this.windowAnchorId ? roots.findIndex(root => root.id === this.windowAnchorId) : -1;
			if (start < 0) {
				start = roots.findIndex(root => this.itemHosts.has(root.id));
			}
			if (start < 0) {
				start = Math.max(0, roots.length - CONVERSATION_TIMELINE_INITIAL_WINDOW);
			}
			const earliestRendered = roots.findIndex(root => this.itemHosts.has(root.id));
			if (earliestRendered >= 0) {
				start = Math.min(start, earliestRendered);
			}
		}
		if (pending >= 0) {
			start = Math.min(start, pending);
		}
		return start;
	}

	private prependWindowBatch(): void {
		if (this.applying) {
			this.intersectionQueued = true;
			return;
		}
		if (this.intersectionBusy || !this._visible || this.windowStart <= 0) {
			return;
		}
		this.intersectionBusy = true;
		try {
			const nextStart = Math.max(0, this.windowStart - CONVERSATION_TIMELINE_WINDOW_BATCH);
			if (nextStart === this.windowStart) {
				return;
			}
			this.windowStart = nextStart;
			this.windowAnchorId = this.latestRoots[nextStart]?.id;
			this.syncArticles(new Set());
		} finally {
			this.intersectionBusy = false;
		}
	}

	private ensureWindowIncludes(index: number): void {
		if (index < 0 || index >= this.latestRoots.length) {
			return;
		}
		let moved = false;
		if (index < this.windowStart) {
			this.windowStart = index;
			this.windowAnchorId = this.latestRoots[index]?.id;
			moved = true;
		}
		const root = this.latestRoots[index];
		if (root && (moved || !this.itemHosts.has(root.id))) {
			this.syncArticles(new Set());
		}
	}

	private flushPendingReveal(): void {
		const turnId = this.pendingRevealId;
		if (!turnId || !this._visible) {
			return;
		}
		const article = this.prepareTurn(turnId);
		if (!article) {
			if (this.releaseFollowTurnId === turnId) {
				this.releaseFollowTurnId = undefined;
			}
			this.notifyRevealMiss(turnId);
			return;
		}
		this.revealMissNotifiedFor = undefined;
		this.pendingRevealId = undefined;
		this.scrollArticleIntoView(article);
	}

	private prepareTurn(turnId: string): HTMLElement | undefined {
		if (this._isDisposed) {
			return undefined;
		}
		const index = this.latestRoots.findIndex(root => root.id === turnId || root.turns.some(entry => entry.id === turnId));
		if (index < 0) {
			return undefined;
		}
		const root = this.latestRoots[index]!;
		if (root.kind === 'process-fold' && root.span) {
			this.renderer.ensureProcessFoldExpanded(root.span.id);
		}
		this.ensureWindowIncludes(index);
		const host = this.itemHosts.get(root.id);
		if (!host) {
			return undefined;
		}
		if (root.kind === 'process-fold') {
			host.refreshProcessFold();
			const turn = root.turns.find(entry => entry.id === turnId)?.turn;
			if (turn?.kind === 'thinking') {
				this.expandThinkingForReveal(host, turn.id);
			}
		}
		return host.article;
	}

	private expandThinkingForReveal(host: ConversationTimelineItemHost, turnId: string): void {
		const thinking = findDescendant(host.article, el => el.dataset.turnId === turnId);
		const header = thinking ? findDescendant(thinking, el => el.tagName === 'BUTTON') : undefined;
		if (header && header.getAttribute('aria-expanded') === 'false') {
			this.suppressUserToggle = true;
			try {
				header.click();
			} finally {
				this.suppressUserToggle = false;
			}
			return;
		}
		if (!header) {
			this.thinkingExpanded.set(turnId, true);
			this.renderer.ensureThinkingExpanded(turnId);
			host.refreshProcessFold();
		}
	}

	private scrollArticleIntoView(article: HTMLElement): void {
		const block: ScrollLogicalPosition = this.revealRelativeTop <= 0.2 ? 'start' : (this.revealRelativeTop >= 0.8 ? 'end' : 'nearest');
		article.scrollIntoView({ block, inline: 'nearest' });
		this.follow.recordWrite(this.viewport.scrollTop);
		this.follow.onReveal(this.isScrolledToBottom());
		if (this.releaseFollowTurnId && this.releaseFollowTurnId === this.lastRevealTurnId) {
			const releaseId = this.releaseFollowTurnId;
			this.releaseFollowTurnId = undefined;
			if (!this.isTailRootTurn(releaseId)) {
				this.follow.onReveal(false);
			}
		}
		this.updateScrollDownButton();
		this.updatePinnedUserPrompt();
	}

	private isTailRootTurn(turnId: string): boolean {
		const root = this.rootForTurn(turnId);
		const tail = this.latestRoots[this.latestRoots.length - 1];
		return !!root && !!tail && root.id === tail.id;
	}

	private ensureTurnRendered(turnId: string): ConversationTimelineItemHost | undefined {
		const index = this.latestRoots.findIndex(root => root.id === turnId || root.turns.some(entry => entry.id === turnId));
		if (index < 0) {
			return undefined;
		}
		this.ensureWindowIncludes(index);
		const root = this.latestRoots[index];
		return root ? this.itemHosts.get(root.id) : undefined;
	}

	private itemHostForTurn(turnId: string): ConversationTimelineItemHost | undefined {
		const root = this.rootForTurn(turnId);
		return root ? this.itemHosts.get(root.id) : undefined;
	}

	private rootForTurn(turnId: string): ConversationTimelineHostRoot | undefined {
		return this.latestRoots.find(root => root.id === turnId || root.turns.some(entry => entry.id === turnId));
	}

	private notifyRevealMiss(turnId: string): void {
		if (this.revealMissNotifiedFor === turnId) {
			return;
		}
		if (this.currentTurns.length === 0 && this.latestRoots.length === 0) {
			return;
		}
		this.revealMissNotifiedFor = turnId;
		this.instantiationService.invokeFunction(accessor => {
			accessor.get(INotificationService).info(localize(
				'conversationReveal.itemNotFound',
				"This step was not found in the conversation",
			));
		});
	}

	private onProcessFoldLayout(rootId: string): void {
		if (this.suppressUserToggle) {
			return;
		}
		const isTail = this.latestRoots.at(-1)?.id === rootId;
		this.follow.onUserToggle(isTail);
		if (this.follow.shouldStickOnResize()) {
			this.scrollToEnd();
		}
	}

	private updateEmptyState(): void {
		this.emptyState.style.display = this.latestRoots.length === 0 ? '' : 'none';
	}

	private updateChrome(): void {
		const total = this.latestRoots.length;
		const tailFrom = Math.max(0, total - CONVERSATION_TIMELINE_CV_TAIL);
		const showLive = this.options.showLiveChrome?.() ?? false;
		for (let index = 0; index < this.latestRoots.length; index++) {
			const root = this.latestRoots[index]!;
			const host = this.itemHosts.get(root.id);
			if (!host) {
				continue;
			}
			const streaming = root.turns.some(entry => entry.turn.streaming === true);
			const editing = this.editingTurnId !== undefined && root.turns.some(entry => entry.id === this.editingTurnId);
			const pending = rootHasPendingSeat(root);
			host.setChrome({
				posinset: index + 1,
				setsize: total,
				label: rootAriaLabel(root, showLive),
				cvVisible: streaming || editing || pending || index >= tailFrom,
				busy: streaming,
			});
		}
	}

	private updateRoving(): void {
		const hosts = this.orderedHosts();
		if (hosts.length === 0) {
			this.rovingRootId = undefined;
			return;
		}
		let active = hosts.find(host => host.root.id === this.rovingRootId);
		if (!active) {
			active = hosts[hosts.length - 1];
			this.rovingRootId = active?.root.id;
		}
		for (const host of hosts) {
			host.article.tabIndex = host === active ? 0 : -1;
		}
	}

	private orderedHosts(): ConversationTimelineItemHost[] {
		const hosts: ConversationTimelineItemHost[] = [];
		for (let index = this.windowStart; index < this.latestRoots.length; index++) {
			const root = this.latestRoots[index];
			if (!root) {
				continue;
			}
			const host = this.itemHosts.get(root.id);
			if (host) {
				hosts.push(host);
			}
		}
		return hosts;
	}

	private reindexArticles(): void {
		this.articleById.clear();
		for (const [id, host] of this.itemHosts) {
			this.articleById.set(id, host.article);
			for (const turn of host.root.turns) {
				this.articleById.set(turn.id, host.article);
			}
		}
	}

	private findStreamArticle(id: string): HTMLElement | undefined {
		for (const child of this.stream.children) {
			if (child instanceof HTMLElement && child.dataset.rootId === id) {
				return child;
			}
		}
		return undefined;
	}

	private findConfirmationInArticle(turnId: string): HTMLElement | undefined {
		const article = this.getTimelineRowElement(turnId);
		if (!article) {
			return undefined;
		}
		return findDescendant(article, el => el.dataset.turnId === turnId && (
			el.classList.contains('conversation-lens-turn--permission')
			|| el.dataset.kind === 'confirmation'
			|| el.dataset.kind === 'question'
		));
	}

	private pruneExpanded(roots: readonly ConversationTimelineHostRoot[]): void {
		const known = new Set<string>();
		for (const root of roots) {
			known.add(root.id);
			for (const turn of root.turns) {
				known.add(turn.id);
			}
		}
		this.renderer.pruneConfirmationSeats(known);
		this.renderer.pruneUserBubbleExpanded(known);
		this.renderer.pruneProcessFoldExpanded(known);
		this.renderer.pruneVisualizeExpanded(known);
		for (const id of [...this.thinkingExpanded.keys()]) {
			if (!known.has(id)) {
				this.thinkingExpanded.delete(id);
			}
		}
		for (const id of [...this.toolExpanded.keys()]) {
			if (!known.has(id)) {
				this.toolExpanded.delete(id);
			}
		}
	}

	private updateScrollDownButton(): void {
		const atBottom = this.follow.following || isConversationTimelineScrolledToBottom(
			this.viewport.scrollTop,
			this.viewport.clientHeight,
			this.viewport.scrollHeight,
		);
		const { showButton } = computeConversationScrollDownState(atBottom, this.follow.scrollLock);
		this.scrollDownButton.element.style.display = showButton ? 'flex' : 'none';
		this.viewport.classList.toggle('conversation-timeline-scroll-down-visible', showButton);
		this.viewport.classList.toggle('conversation-timeline-at-bottom', atBottom);
	}

	activateConversationLink(hit: IConversationTimelineLinkHit): Promise<void> {
		return this.turnContentAdapter.activateConversationLink?.(hit) ?? Promise.resolve();
	}

	private schedulePinnedRefresh(): void {
		if (this.pinnedFrame) {
			return;
		}
		this.pinnedFrame = true;
		scheduleAtNextAnimationFrame(getWindow(this.viewport), () => {
			this.pinnedFrame = false;
			if (this._store.isDisposed) {
				return;
			}
			this.updatePinnedUserPrompt();
		});
	}

	private updatePinnedUserPrompt(): void {
		const indices = this.visibleModelIndices();
		const atBottom = this.isScrolledToBottom();
				const state = resolvePinnedUserPromptState(this.flatItems, indices, atBottom);
		this.pinnedUserState = state;
		if (!state) {
			this.pinnedHost.hidden = true;
			this.pinnedHost.classList.remove('conversation-timeline-pinned-user--visible');
			this.pinnedUserText.textContent = '';
			return;
		}
		this.pinnedHost.hidden = false;
		this.pinnedHost.classList.add('conversation-timeline-pinned-user--visible');
		this.pinnedUserText.textContent = state.previewText;
	}

	private visibleModelIndices(): number[] {
		if (this.flatItems.length === 0) {
			return [];
		}
		const vpRect = this.viewport.getBoundingClientRect();
		// If getBoundingClientRect has 0 height, use offset geometry
		const useOffset = vpRect.height < 1;
		if (!useOffset && vpRect.height < 1) {
			return [];
		} if (useOffset && this.viewport.clientHeight < 1) { return []; }

		let firstVisibleRootIdx = -1;
		let lastVisibleRootIdx = -1;
		const vpTop = useOffset ? this.viewport.scrollTop : vpRect.top;
		const vpHeight = useOffset ? this.viewport.clientHeight : vpRect.height;
		const vpBottom = vpTop + vpHeight;
		const effectiveTop = vpTop + 44.5;

		for (let i = 0; i < this.latestRoots.length; i++) {
			const root = this.latestRoots[i];
			const article = this.articleById.get(root.id);
			if (!article) {
				continue;
			}
			const artTop = useOffset ? article.offsetTop : article.getBoundingClientRect().top;
			const artHeight = useOffset ? article.offsetHeight : article.getBoundingClientRect().height;
			const artBottom = artTop + artHeight;
			if (artBottom > effectiveTop && artTop < vpBottom) {
				if (firstVisibleRootIdx === -1) {
					firstVisibleRootIdx = i;
				}
				lastVisibleRootIdx = i;
			}
		}

		if (firstVisibleRootIdx === -1) {
			return [];
		}

		const firstRoot = this.latestRoots[firstVisibleRootIdx];
		const lastRoot = this.latestRoots[lastVisibleRootIdx];
		const firstTurnId = firstRoot?.turns[0]?.id;
		const lastTurnId = lastRoot?.turns[lastRoot.turns.length - 1]?.id;

		const firstIndex = firstTurnId ? this.flatItems.findIndex(item => item.turn.id === firstTurnId) : 0;
		const lastIndex = lastTurnId ? this.flatItems.findIndex(item => item.turn.id === lastTurnId) : this.flatItems.length - 1;

		return rangeVisibleTimelineIndices(
			firstIndex >= 0 ? firstIndex : 0,
			lastIndex >= 0 ? lastIndex : this.flatItems.length - 1,
		);
	}

	private onStreamKeyDown(e: KeyboardEvent): void {
		const target = e.target instanceof Element ? e.target : getActiveElement();
		if (!target) {
			return;
		}
		const article = target.closest('article.conversation-timeline-item');
		if (!(article instanceof HTMLElement) || !this.stream.contains(article)) {
			return;
		}
		const onArticle = target === article;
		if (e.key === 'Escape') {
			if (!onArticle) {
				e.preventDefault();
				if (article.tabIndex < 0) {
					article.tabIndex = 0;
				}
				article.focus({ preventScroll: true });
			}
			return;
		}
		if (!onArticle) {
			return;
		}
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End') {
			e.preventDefault();
			this.moveRoving(e.key);
			return;
		}
		if (e.key === 'Enter') {
			const next = firstFocusable(article);
			if (next) {
				e.preventDefault();
				next.focus({ preventScroll: true });
			}
		}
	}

	private moveRoving(key: string): void {
		const hosts = this.orderedHosts();
		if (hosts.length === 0) {
			return;
		}
		let nextIndex = hosts.findIndex(host => host.root.id === this.rovingRootId);
		if (nextIndex < 0) {
			nextIndex = hosts.length - 1;
		}
		if (key === 'ArrowDown' || key === 'PageDown') {
			nextIndex = Math.min(hosts.length - 1, nextIndex + 1);
		} else if (key === 'ArrowUp' || key === 'PageUp') {
			nextIndex = Math.max(0, nextIndex - 1);
		} else if (key === 'Home') {
			nextIndex = 0;
		} else if (key === 'End') {
			nextIndex = hosts.length - 1;
		}
		const host = hosts[nextIndex];
		if (!host) {
			return;
		}
		this.rovingRootId = host.root.id;
		this.updateRoving();
		host.article.focus({ preventScroll: true });
		host.article.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	private onStreamFocusIn(): void {
		const active = getActiveElement();
		const article = active?.closest('article.conversation-timeline-item');
		if (!(article instanceof HTMLElement) || !this.stream.contains(article)) {
			return;
		}
		const rootId = article.dataset.rootId;
		if (!rootId || rootId === this.rovingRootId) {
			return;
		}
		this.rovingRootId = rootId;
		this.updateRoving();
	}

	private connectObservers(): void {
		const onResize = () => {
			if (this.follow.shouldStickOnResize()) {
				this.scrollToEnd();
			}
			this.updatePinnedUserPrompt();
		};
		try {
			if (this.options.createResizeObserver) {
				const observer = this.options.createResizeObserver(onResize);
				observer.observe(this.stream);
				observer.observe(this.viewport);
				this.resizeObserver = observer;
			} else if (typeof ResizeObserver === 'function') {
				const observer = new ResizeObserver(() => onResize());
				observer.observe(this.stream);
				observer.observe(this.viewport);
				this.resizeObserver = observer;
			}
		} catch {
			// Observer factories are optional. A missing or broken implementation must not block the host.
		}

		const onIntersect = (entry: { target: Element; isIntersecting: boolean }) => {
			if (entry.isIntersecting && entry.target === this.sentinel) {
				this.prependWindowBatch();
			}
		};
		try {
			if (this.options.createIntersectionObserver) {
				const observer = this.options.createIntersectionObserver(onIntersect);
				observer.observe(this.sentinel);
				this.intersectionObserver = observer;
			} else if (typeof IntersectionObserver === 'function') {
				const observer = new IntersectionObserver(entries => {
					for (const entry of entries) {
						if (entry.target === this.sentinel && entry.isIntersecting) {
							this.prependWindowBatch();
							break;
						}
					}
				}, { root: this.viewport, rootMargin: '150% 0px 0px 0px' });
				observer.observe(this.sentinel);
				this.intersectionObserver = observer;
			}
		} catch {
			// Same as the resize observer: tests can omit a working IntersectionObserver.
		}
	}

	private adaptIntersectionObserver(options: IConversationTimelineHostOptions): ConversationTimelineVisibilityObserverFactory | undefined {
		if (!options.createIntersectionObserver) {
			return undefined;
		}
		const create = options.createIntersectionObserver;
		return (callback, _observerOptions) => {
			const observer = create(entry => callback([entry]));
			return {
				observe: target => observer.observe(target),
				unobserve: () => { /* injected factory has no unobserve */ },
				disconnect: () => observer.disconnect(),
			};
		};
	}
}

function buildHostRoots(turns: readonly ConversationStubTurn[], spans: readonly ProcessFoldSpan[]): ConversationTimelineHostRoot[] {
	const spanByStartIndex = new Map(spans.map(span => [span.startIndex, span]));
	const covered = new Set<number>();
	for (const span of spans) {
		for (let index = span.startIndex + 1; index < span.endIndex; index++) {
			covered.add(index);
		}
	}

	const roots: ConversationTimelineHostRoot[] = [];
	for (let index = 0; index < turns.length; index++) {
		if (covered.has(index)) {
			continue;
		}
		const span = spanByStartIndex.get(index);
		if (span) {
			const spanTurns: { id: string; turn: ConversationStubTurn }[] = [];
			for (let cursor = span.startIndex; cursor < span.endIndex; cursor++) {
				const turn = turns[cursor];
				if (turn) {
					spanTurns.push({ id: turn.id, turn });
				}
			}
			const head = turns[span.startIndex];
			if (!head) {
				continue;
			}
			roots.push({
				id: span.id,
				kind: 'process-fold',
				turns: spanTurns,
				span,
				item: { turn: head, variant: 'process-fold', processFoldSpan: span },
			});
			continue;
		}
		const turn = turns[index];
		if (!turn) {
			continue;
		}
		roots.push({
			id: turn.id,
			kind: 'item',
			turns: [{ id: turn.id, turn }],
			item: { turn, variant: 'turn' },
		});
	}
	return roots;
}

function earliestPendingRootIndex(roots: readonly ConversationTimelineHostRoot[]): number {
	for (let index = 0; index < roots.length; index++) {
		if (rootHasPendingSeat(roots[index]!)) {
			return index;
		}
	}
	return -1;
}

function rootHasPendingSeat(root: ConversationTimelineHostRoot): boolean {
	for (const entry of root.turns) {
		if (entry.turn.status === 'pending' && (entry.turn.kind === 'confirmation' || entry.turn.kind === 'question')) {
			return true;
		}
	}
	return false;
}

function rootReadsPresentation(root: ConversationTimelineHostRoot): boolean {
	if (root.kind === 'process-fold') {
		return true;
	}
	const kind = root.turns[0]?.turn.kind;
	return kind === 'confirmation' || kind === 'question' || kind === 'assistant' || kind === 'tool';
}

function rootAriaLabel(root: ConversationTimelineHostRoot, showLiveChrome: boolean): string {
	if (root.kind === 'process-fold' && root.span) {
		return localize(
			'conversationProcessFold.accessibility',
			"Process steps: {0}",
			summarizeProcessSteps(root.span, { showLiveChrome }),
		);
	}
	const turn = root.turns[0]?.turn;
	return turn ? getConversationEntryAriaLabel(turn) : '';
}

function findDescendant(root: HTMLElement, predicate: (el: HTMLElement) => boolean): HTMLElement | undefined {
	for (const child of root.children) {
		if (!(child instanceof HTMLElement)) {
			continue;
		}
		if (predicate(child)) {
			return child;
		}
		const nested = findDescendant(child, predicate);
		if (nested) {
			return nested;
		}
	}
	return undefined;
}

function firstFocusable(root: HTMLElement): HTMLElement | undefined {
	return findDescendant(root, el => {
		if (el.tabIndex < 0) {
			return false;
		}
		const tag = el.tagName;
		if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
			return !(el as HTMLButtonElement).disabled;
		}
		if (tag === 'A') {
			return el.hasAttribute('href');
		}
		return el.tabIndex >= 0;
	});
}
