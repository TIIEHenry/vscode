/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, getWindow, scheduleAtNextAnimationFrame } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { RenderIndentGuides } from '../../../../base/browser/ui/tree/abstractTree.js';
import { IObjectTreeElement, ITreeElementRenderDetails, ITreeNode, ITreeRenderer } from '../../../../base/browser/ui/tree/tree.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { asCssVariable, asCssVariableWithDefault, buttonSecondaryBackground, buttonSecondaryForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import { ConversationConfirmationSeat } from './conversationConfirmationSeat.js';
import { conversationLensTurnCopy, conversationLensTurnDelete, conversationLensPinnedUserPromptAria, conversationLensPinnedUserPromptCopyAria } from './conversationLensSessionBarStrings.js';
import { ConversationMermaidExtensionInfo, createMermaidHostContext } from './conversationMermaidHost.js';
import { renderProcessFoldSpan } from './conversationProcessFold.js';
import { ProcessFoldSpan, projectProcessFoldSpans } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { renderConversationVisualizeCard } from './conversationVisualizeCard.js';
import {
	ConversationTimelineFlatItem,
	flattenConversationTimelineItems,
	indexOfConversationTimelineFlatItem,
	PinnedUserPromptState,
	rangeVisibleTimelineIndices,
	resolvePinnedUserPromptState,
} from './conversationPinnedUserPrompt.js';
import {
	computeConversationScrollDownState,
	ConversationAutoScrollHolds,
	isConversationTimelineScrolledToBottom,
} from './conversationTimelineScroll.js';
import { ConversationTurnContentAdapter, IConversationTurnContentAdapter } from './conversationTurnContentAdapter.js';
import { getConversationTurnRoleLabel } from './conversationTrajectoryList.js';
import {
	shouldCollapseUserBubble,
	shouldScrollExpandedUserBubble,
} from './conversationUserBubbleCollapse.js';

export const conversationLensUserBubbleShowMore = localize('conversationLens.userBubbleShowMore', "Show more");
export const conversationLensUserBubbleShowLess = localize('conversationLens.userBubbleShowLess', "Show less");

export type ConversationTimelineItemVariant = 'turn' | 'process-fold';

export interface ConversationTimelineItem {
	readonly turn: ConversationStubTurn;
	readonly variant: ConversationTimelineItemVariant;
	readonly processFoldSpan?: ProcessFoldSpan;
}

export interface IConversationTimelineTreeOptions {
	readonly onResolveConfirmation?: (turnId: string, status: 'allowed' | 'skipped') => void;
	readonly onCopyTurn?: (turnId: string, text: string) => void;
	readonly onDeleteTurn?: (turnId: string) => void;
	readonly onOpenVisualizeFullscreen?: (source: string, title?: string) => void;
	readonly contentAdapter?: IConversationTurnContentAdapter;
	readonly paddingBottom?: number;
}

interface ITurnTemplateData {
	readonly container: HTMLElement;
	readonly disposables: DisposableStore;
}

class ConversationTimelineDelegate implements IListVirtualDelegate<ConversationTimelineItem> {

	private readonly heights = new Map<string, number>();

	getHeight(element: ConversationTimelineItem): number {
		const key = this.heightKey(element);
		return this.heights.get(key) ?? (element.variant === 'process-fold' ? 40 : 72);
	}

	getTemplateId(element: ConversationTimelineItem): string {
		return element.variant === 'process-fold'
			? ConversationTimelineRenderer.PROCESS_FOLD_TEMPLATE_ID
			: ConversationTimelineRenderer.TEMPLATE_ID;
	}

	hasDynamicHeight(): boolean {
		return true;
	}

	setDynamicHeight(element: ConversationTimelineItem, height: number): void {
		this.heights.set(this.heightKey(element), height);
	}

	private heightKey(element: ConversationTimelineItem): string {
		return element.variant === 'process-fold'
			? element.processFoldSpan?.id ?? element.turn.id
			: element.turn.id;
	}
}

class ConversationTimelineRenderer implements ITreeRenderer<ConversationTimelineItem, void, ITurnTemplateData> {

	static readonly TEMPLATE_ID = 'conversationTimelineTurn';
	static readonly PROCESS_FOLD_TEMPLATE_ID = 'conversationTimelineProcessFold';

	readonly templateId = ConversationTimelineRenderer.TEMPLATE_ID;

	private readonly confirmationSeats = new Map<string, ConversationConfirmationSeat>();
	private readonly userBubbleExpanded = new Map<string, boolean>();
	private readonly processFoldOuterExpanded = new Map<string, boolean>();
	private readonly processFoldThinkingExpanded = new Map<string, boolean>();
	private readonly processFoldToolExpanded = new Map<string, boolean>();
	private readonly visualizeExpanded = new Map<string, boolean>();

	constructor(
		private readonly contentAdapter: IConversationTurnContentAdapter,
		private readonly onResolveConfirmation: ((turnId: string, status: 'allowed' | 'skipped') => void) | undefined,
		private readonly onCopyTurn: ((turnId: string, text: string) => void) | undefined,
		private readonly onDeleteTurn: ((turnId: string) => void) | undefined,
		private readonly onOpenVisualizeFullscreen: ((source: string, title?: string) => void) | undefined,
		private readonly getMermaidExtensionInfo: () => ConversationMermaidExtensionInfo | undefined,
		private readonly webviewService: IWebviewService,
		private readonly getTimelineScrollHost: () => HTMLElement | undefined,
		private readonly onHeightChange: (item: ConversationTimelineItem, height: number) => void,
	) { }

	renderTemplate(container: HTMLElement): ITurnTemplateData {
		container.classList.add('conversation-lens-timeline-row');
		return { container, disposables: new DisposableStore() };
	}

	renderElement(node: ITreeNode<ConversationTimelineItem, void>, _index: number, templateData: ITurnTemplateData): void {
		templateData.disposables.clear();
		clearNode(templateData.container);

		const item = node.element;
		const turn = item.turn;

		if (item.variant === 'process-fold' && item.processFoldSpan) {
			const span = item.processFoldSpan;
			renderProcessFoldSpan(templateData.container, span, {
				defaultOuterExpanded: false,
				isOuterExpanded: (spanId) => this.processFoldOuterExpanded.get(spanId) ?? false,
				setOuterExpanded: (spanId, expanded) => {
					if (expanded) {
						this.processFoldOuterExpanded.set(spanId, true);
					} else {
						this.processFoldOuterExpanded.delete(spanId);
					}
				},
				isThinkingExpanded: (turnId) => this.processFoldThinkingExpanded.get(turnId) ?? false,
				setThinkingExpanded: (turnId, expanded) => {
					if (expanded) {
						this.processFoldThinkingExpanded.set(turnId, true);
					} else {
						this.processFoldThinkingExpanded.delete(turnId);
					}
				},
				isToolExpanded: (turnId) => this.processFoldToolExpanded.get(turnId) ?? false,
				setToolExpanded: (turnId, expanded) => {
					if (expanded) {
						this.processFoldToolExpanded.set(turnId, true);
					} else {
						this.processFoldToolExpanded.delete(turnId);
					}
				},
				onLayoutChange: () => this.scheduleHeightUpdate(item, templateData.container),
			}, templateData.disposables);
			this.scheduleHeightUpdate(item, templateData.container);
			return;
		}

		if (turn.kind === 'visualization') {
			const mermaidHost = createMermaidHostContext(
				templateData.container,
				this.getMermaidExtensionInfo(),
				this.webviewService,
			);
			renderConversationVisualizeCard(templateData.container, turn, {
				isExpanded: (turnId) => this.visualizeExpanded.get(turnId) ?? true,
				setExpanded: (turnId, expanded) => {
					if (expanded) {
						this.visualizeExpanded.set(turnId, true);
					} else {
						this.visualizeExpanded.delete(turnId);
					}
				},
				onLayoutChange: () => this.scheduleHeightUpdate(item, templateData.container),
				mermaidHost,
				onOpenFullscreen: this.onOpenVisualizeFullscreen,
				onWheelDelegate: (e) => {
					const scrollHost = this.getTimelineScrollHost();
					if (scrollHost) {
						scrollHost.scrollTop += e.deltaY;
					}
				},
			}, templateData.disposables);
			this.scheduleHeightUpdate(item, templateData.container);
			return;
		}

		if (turn.kind === 'confirmation') {
			const seat = templateData.disposables.add(new ConversationConfirmationSeat({
				message: turn.text,
				status: turn.status ?? 'pending',
				onAllow: turn.status === 'pending' && this.onResolveConfirmation
					? () => this.onResolveConfirmation!(turn.id, 'allowed')
					: undefined,
				onSkip: turn.status === 'pending' && this.onResolveConfirmation
					? () => this.onResolveConfirmation!(turn.id, 'skipped')
					: undefined,
			}));
			seat.element.setAttribute('data-turn-id', turn.id);
			seat.element.classList.add('conversation-lens-turn');
			seat.element.setAttribute('data-kind', turn.kind);
			this.confirmationSeats.set(turn.id, seat);
			templateData.container.appendChild(seat.element);
		} else if (turn.kind === 'thinking' || turn.kind === 'tool') {
			// Process-fold spans render thinking/tool turns; standalone hits should not occur.
			const el = append(templateData.container, $('div.conversation-lens-turn.conversation-lens-turn-process'));
			el.setAttribute('data-kind', turn.kind);
			el.setAttribute('data-turn-id', turn.id);
			const summary = append(el, $('.conversation-lens-turn-summary'));
			summary.textContent = turn.text;
		} else {
			const el = $('div.conversation-lens-turn');
			el.setAttribute('data-kind', turn.kind);
			el.setAttribute('data-turn-id', turn.id);
			if (turn.stubEcho) {
				el.setAttribute('data-stub', 'true');
			}
			if (turn.kind === 'user') {
				el.classList.add('conversation-lens-turn--user-align-end');
			}

			const header = append(el, $('.conversation-lens-turn-header'));
			header.textContent = getConversationTurnRoleLabel(turn.kind);

			const body = append(el, $('.conversation-lens-turn-body'));
			if (turn.kind === 'user') {
				body.classList.add('conversation-lens-turn-body--user-bubble');
			} else if (turn.kind === 'assistant') {
				body.classList.add('conversation-lens-turn-body--reading-text');
			}
			templateData.disposables.add(this.contentAdapter.renderTurnBody(turn, body));

			if (turn.kind === 'user' && shouldCollapseUserBubble(turn.text)) {
				const expanded = this.userBubbleExpanded.get(turn.id) ?? false;
				body.classList.add('conversation-lens-turn-body--collapsible');
				this.applyUserBubbleCollapseState(body, turn.text, expanded);

				const foldControl = append(el, $('.conversation-lens-turn-fold'));
				const foldButton = append(foldControl, $('button.conversation-lens-turn-fold-button')) as HTMLButtonElement;
				foldButton.type = 'button';
				foldButton.textContent = expanded ? conversationLensUserBubbleShowLess : conversationLensUserBubbleShowMore;
				foldButton.setAttribute('aria-expanded', String(expanded));
				foldButton.setAttribute('aria-label', expanded ? conversationLensUserBubbleShowLess : conversationLensUserBubbleShowMore);
				templateData.disposables.add(addDisposableListener(foldButton, 'click', (e) => {
					e.stopPropagation();
					const nextExpanded = !(this.userBubbleExpanded.get(turn.id) ?? false);
					this.userBubbleExpanded.set(turn.id, nextExpanded);
					this.applyUserBubbleCollapseState(body, turn.text, nextExpanded);
					foldButton.textContent = nextExpanded ? conversationLensUserBubbleShowLess : conversationLensUserBubbleShowMore;
					foldButton.setAttribute('aria-expanded', String(nextExpanded));
					foldButton.setAttribute('aria-label', nextExpanded ? conversationLensUserBubbleShowLess : conversationLensUserBubbleShowMore);
					this.scheduleHeightUpdate(item, templateData.container);
				}));
			}

			if (turn.kind === 'user' || turn.kind === 'assistant') {
				const actions = append(el, $('.conversation-lens-turn-actions'));
				const copyContainer = append(actions, $('span.conversation-lens-turn-action-copy'));
				const copyButton = templateData.disposables.add(new Button(copyContainer, {
					...defaultButtonStyles,
					supportIcons: true,
					small: true,
					secondary: true,
					title: conversationLensTurnCopy,
					ariaLabel: conversationLensTurnCopy,
				}));
				copyButton.icon = Codicon.copy;
				if (this.onCopyTurn) {
					templateData.disposables.add(copyButton.onDidClick(() => this.onCopyTurn!(turn.id, turn.text)));
				}

				const deleteContainer = append(actions, $('span.conversation-lens-turn-action-delete'));
				const deleteButton = templateData.disposables.add(new Button(deleteContainer, {
					...defaultButtonStyles,
					supportIcons: true,
					small: true,
					secondary: true,
					title: conversationLensTurnDelete,
					ariaLabel: conversationLensTurnDelete,
				}));
				deleteButton.icon = Codicon.trash;
				if (this.onDeleteTurn) {
					templateData.disposables.add(deleteButton.onDidClick(() => this.onDeleteTurn!(turn.id)));
				}
			}

			templateData.container.appendChild(el);
		}

		this.scheduleHeightUpdate(item, templateData.container);
	}

	disposeElement(_element: ITreeNode<ConversationTimelineItem, void>, _index: number, templateData: ITurnTemplateData, _details?: ITreeElementRenderDetails): void {
		templateData.disposables.clear();
	}

	disposeTemplate(templateData: ITurnTemplateData): void {
		templateData.disposables.dispose();
	}

	getConfirmationElement(turnId: string): HTMLElement | undefined {
		return this.confirmationSeats.get(turnId)?.element;
	}

	clearConfirmationSeats(): void {
		for (const seat of this.confirmationSeats.values()) {
			seat.dispose();
		}
		this.confirmationSeats.clear();
	}

	clearUserBubbleExpanded(): void {
		this.userBubbleExpanded.clear();
	}

	clearProcessFoldExpanded(): void {
		this.processFoldOuterExpanded.clear();
		this.processFoldThinkingExpanded.clear();
	}

	clearVisualizeExpanded(): void {
		this.visualizeExpanded.clear();
	}

	private applyUserBubbleCollapseState(body: HTMLElement, text: string, expanded: boolean): void {
		body.classList.toggle('conversation-lens-turn-body--collapsed', !expanded);
		body.classList.toggle('conversation-lens-turn-body--scrollable', expanded && shouldScrollExpandedUserBubble(text));
		if (!expanded) {
			body.setAttribute('title', text);
		} else {
			body.removeAttribute('title');
		}
	}

	private scheduleHeightUpdate(item: ConversationTimelineItem, row: HTMLElement): void {
		const targetWindow = getWindow(row);
		targetWindow.requestAnimationFrame(() => {
			const height = Math.max(row.offsetHeight, 1);
			this.onHeightChange(item, height);
		});
	}
}

class ConversationTimelineProcessFoldRenderer implements ITreeRenderer<ConversationTimelineItem, void, ITurnTemplateData> {

	readonly templateId = ConversationTimelineRenderer.PROCESS_FOLD_TEMPLATE_ID;

	constructor(
		private readonly inner: ConversationTimelineRenderer,
	) { }

	renderTemplate(container: HTMLElement): ITurnTemplateData {
		return this.inner.renderTemplate(container);
	}

	renderElement(node: ITreeNode<ConversationTimelineItem, void>, index: number, templateData: ITurnTemplateData): void {
		this.inner.renderElement(node, index, templateData);
	}

	disposeElement(_node: ITreeNode<ConversationTimelineItem, void>, _index: number, templateData: ITurnTemplateData): void {
		templateData.disposables.clear();
	}

	disposeTemplate(templateData: ITurnTemplateData): void {
		this.inner.disposeTemplate(templateData);
	}
}

/**
 * Greenfield conversation timeline list. WorkbenchObjectTree-based; zero import of
 * ChatListWidget / ChatListItemRenderer (see conversationImportBoundaries.test.ts).
 */
export class ConversationTimelineTree extends Disposable {

	private readonly scrollHost: HTMLElement;
	private readonly emptyState: HTMLElement;
	private readonly contentHost: HTMLElement;
	private readonly treeContainer: HTMLElement;
	private readonly scrollDownButton: Button;
	private readonly pinnedUserHost: HTMLElement;
	private readonly pinnedUserBubble: HTMLButtonElement;
	private readonly pinnedUserText: HTMLElement;
	private readonly pinnedUserCopyButton: Button;
	private readonly tree: WorkbenchObjectTree<ConversationTimelineItem, void>;
	private readonly renderer: ConversationTimelineRenderer;
	private readonly delegate: ConversationTimelineDelegate;
	private readonly autoScrollHolds = new ConversationAutoScrollHolds();
	private readonly turnItems = new Map<string, ConversationTimelineItem>();
	private mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;

	private _scrollLock = true;
	private flatItems: readonly ConversationTimelineFlatItem[] = [];
	private pinnedUserState: PinnedUserPromptState | undefined;

	constructor(
		parent: HTMLElement,
		options: IConversationTimelineTreeOptions,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWebviewService private readonly webviewService: IWebviewService,
	) {
		super();

		const timeline = append(parent, $('.conversation-lens-timeline'));
		timeline.setAttribute('role', 'log');
		timeline.setAttribute('aria-label', localize('conversationLens.timeline', "Conversation timeline"));

		this.scrollHost = append(timeline, $('.conversation-lens-timeline-scroll'));
		this.emptyState = append(this.scrollHost, $('.conversation-lens-timeline-empty'));
		append(this.emptyState, $('p.conversation-lens-timeline-empty-title')).textContent =
			localize('conversationLens.timelineEmptyTitle', "No messages yet");

		this.contentHost = append(this.scrollHost, $('.conversation-lens-timeline-content'));
		this.pinnedUserHost = append(this.contentHost, $('.conversation-timeline-pinned-user'));
		const pinnedUserInner = append(this.pinnedUserHost, $('.conversation-timeline-pinned-user-inner.conversation-lens-turn-body--user-bubble'));
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
		this._register(this.pinnedUserCopyButton.onDidClick((e) => {
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

		this.treeContainer = append(this.contentHost, $('.conversation-timeline-tree'));

		const contentAdapter = options.contentAdapter
			?? this.instantiationService.createInstance(ConversationTurnContentAdapter);

		this.delegate = new ConversationTimelineDelegate();
		this.renderer = new ConversationTimelineRenderer(
			contentAdapter,
			options.onResolveConfirmation,
			options.onCopyTurn,
			options.onDeleteTurn,
			options.onOpenVisualizeFullscreen,
			() => this.mermaidExtensionInfo,
			this.webviewService,
			() => this.scrollHost,
			(item, height) => this.safeUpdateElementHeight(item, height),
		);
		const processFoldRenderer = new ConversationTimelineProcessFoldRenderer(this.renderer);

		this.tree = this._register(this.instantiationService.createInstance(
			WorkbenchObjectTree<ConversationTimelineItem, void>,
			'ConversationTimeline',
			this.treeContainer,
			this.delegate,
			[this.renderer, processFoldRenderer],
			{
				identityProvider: {
					getId: (e: ConversationTimelineItem) => e.variant === 'process-fold'
						? e.processFoldSpan?.id ?? e.turn.id
						: e.turn.id,
				},
				horizontalScrolling: false,
				alwaysConsumeMouseWheel: false,
				supportDynamicHeights: true,
				paddingBottom: options.paddingBottom ?? 30,
				hideTwistiesOfChildlessElements: true,
				enableStickyScroll: false,
				indent: 12,
				expandOnDoubleClick: false,
				renderIndentGuides: RenderIndentGuides.None,
				multipleSelectionSupport: false,
				setRowLineHeight: false,
				accessibilityProvider: {
					getAriaLabel: (item: ConversationTimelineItem) => {
						if (item.variant === 'process-fold') {
							return localize('conversationProcessFold.accessibility', "Process steps");
						}
						const turn = item.turn;
						if (turn.kind === 'confirmation') {
							return localize('conversationLens.confirmationSeat', "Confirmation");
						}
						if (turn.kind === 'visualization') {
							return localize('conversationVisualize.accessibility', "Visualize");
						}
						return getConversationTurnRoleLabel(turn.kind);
					},
					getWidgetAriaLabel: () => localize('conversationLens.timeline', "Conversation timeline"),
				},
				keyboardNavigationLabelProvider: {
					getKeyboardNavigationLabel: (item: ConversationTimelineItem) => item.turn.text,
				},
			},
		));

		const scrollToBottomLabel = localize('conversationLens.scrollToBottom', "Scroll to Bottom");
		const scrollToBottomBackground = asCssVariableWithDefault('chat.list.background', asCssVariable(buttonSecondaryBackground));
		this.scrollDownButton = this._register(new Button(this.scrollHost, {
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
			this.setScrollLock(true);
			this.scrollToEnd();
		}));

		this._register(this.tree.onDidScroll(() => {
			if (!this.isScrolledToBottom()) {
				this.setScrollLock(false);
			}
			this.updateScrollDownButtonVisibility();
			this.updatePinnedUserPromptVisibility();
		}));

		this._register(this.tree.onDidChangeContentHeight(() => {
			if (this._scrollLock && !this.autoScrollHolds.isHeld) {
				this.scrollToEnd();
			}
			this.updateScrollDownButtonVisibility();
			this.updatePinnedUserPromptVisibility();
		}));

		this._register(addDisposableListener(this.treeContainer, 'wheel', () => {
			if (!this.isScrolledToBottom()) {
				this.setScrollLock(false);
			}
		}));

		this.updateScrollDownButtonVisibility();
		this.updatePinnedUserPromptVisibility();
		this.renderEmptyState(true);
	}

	get domNode(): HTMLElement {
		return this.scrollHost.parentElement!;
	}

	show(): void {
		this.domNode.hidden = false;
	}

	hide(): void {
		this.domNode.hidden = true;
	}

	setMermaidExtensionInfo(info: ConversationMermaidExtensionInfo | undefined): void {
		this.mermaidExtensionInfo = info;
	}

	setTurns(turns: readonly ConversationStubTurn[]): void {
		this.withPersistedAutoScroll(() => {
			this.renderer.clearConfirmationSeats();
			this.renderer.clearUserBubbleExpanded();
			this.renderer.clearProcessFoldExpanded();
			this.renderer.clearVisualizeExpanded();
			this.turnItems.clear();
			this.flatItems = flattenConversationTimelineItems(turns);
			const items = this.buildTreeElements(turns);
			for (const treeElement of items) {
				const item = treeElement.element;
				this.turnItems.set(item.turn.id, item);
				if (item.variant === 'process-fold' && item.processFoldSpan) {
					for (const turnId of item.processFoldSpan.turnIds) {
						this.turnItems.set(turnId, item);
					}
				}
			}
			this.tree.setChildren(null, items);
			this.renderEmptyState(turns.length === 0);
			this.updatePinnedUserPromptVisibility();
		});
	}

	private buildTreeElements(turns: readonly ConversationStubTurn[]): IObjectTreeElement<ConversationTimelineItem>[] {
		const spans = projectProcessFoldSpans(turns);
		const spanByStartIndex = new Map(spans.map(span => [span.startIndex, span]));
		const coveredIndices = new Set<number>();
		for (const span of spans) {
			for (let index = span.startIndex + 1; index < span.endIndex; index++) {
				coveredIndices.add(index);
			}
		}

		const elements: IObjectTreeElement<ConversationTimelineItem>[] = [];
		for (let index = 0; index < turns.length; index++) {
			if (coveredIndices.has(index)) {
				continue;
			}

			const turn = turns[index]!;
			const span = spanByStartIndex.get(index);
			if (span) {
				elements.push({
					element: {
						turn: turns[span.startIndex]!,
						variant: 'process-fold',
						processFoldSpan: span,
					},
				});
				continue;
			}

			elements.push({ element: { turn, variant: 'turn' } });
		}
		return elements;
	}

	revealTurn(turnId: string, relativeTop = 0.5): void {
		const item = this.turnItems.get(turnId);
		if (!item) {
			return;
		}
		this.revealTurnElement(item, relativeTop);
	}

	private revealTurnElement(item: ConversationTimelineItem, relativeTop = 0.5, attempt = 0): void {
		if (!this.tree.hasElement(item)) {
			if (attempt < 3) {
				scheduleAtNextAnimationFrame(getWindow(this.domNode), () => this.revealTurnElement(item, relativeTop, attempt + 1));
			}
			return;
		}
		try {
			this.tree.reveal(item, relativeTop);
			this.refreshScrollChrome();
		} catch {
			if (attempt < 3) {
				scheduleAtNextAnimationFrame(getWindow(this.domNode), () => this.revealTurnElement(item, relativeTop, attempt + 1));
			}
		}
	}

	private safeUpdateElementHeight(item: ConversationTimelineItem, height: number): void {
		if (!this.tree.hasElement(item)) {
			return;
		}
		this.delegate.setDynamicHeight(item, height);
		this.tree.updateElementHeight(item, height);
	}

	acquireAutoScrollHold(): IDisposable {
		return this.autoScrollHolds.acquire();
	}

	get isAutoScrollHeld(): boolean {
		return this.autoScrollHolds.isHeld;
	}

	get scrollLock(): boolean {
		return this._scrollLock;
	}

	setScrollLock(value: boolean): void {
		this._scrollLock = value;
		this.updateScrollDownButtonVisibility();
		this.updatePinnedUserPromptVisibility();
	}

	scrollToEnd(): void {
		this.tree.scrollTop = this.tree.scrollHeight;
		this.refreshScrollChrome();
	}

	/** Sync scroll affordances after programmatic scrollTop changes (ObjectTree may not emit onDidScroll). */
	refreshScrollChrome(): void {
		this.updateScrollDownButtonVisibility();
		this.updatePinnedUserPromptVisibility();
	}

	isScrolledToBottom(): boolean {
		return isConversationTimelineScrolledToBottom(this.tree.scrollTop, this.tree.renderHeight, this.tree.scrollHeight);
	}

	getConfirmationElement(turnId: string): HTMLElement | undefined {
		return this.renderer.getConfirmationElement(turnId);
	}

	layout(height: number, width: number): void {
		this.tree.layout(height, width);
		this.refreshScrollChrome();
	}

	private renderEmptyState(empty: boolean): void {
		this.emptyState.style.display = empty ? '' : 'none';
		this.contentHost.style.display = empty ? 'none' : '';
	}

	private updateScrollDownButtonVisibility(): void {
		const { showButton, atBottom } = computeConversationScrollDownState(this.isScrolledToBottom(), this._scrollLock);
		this.scrollDownButton.element.style.display = showButton ? 'flex' : 'none';
		this.scrollHost.classList.toggle('conversation-timeline-at-bottom', atBottom);
	}

	private updatePinnedUserPromptVisibility(): void {
		const visibleIndices = this.getVisibleTimelineIndices();
		const state = resolvePinnedUserPromptState(this.flatItems, visibleIndices, this.isScrolledToBottom());
		this.pinnedUserState = state;
		if (!state) {
			this.pinnedUserHost.classList.remove('conversation-timeline-pinned-user--visible');
			this.pinnedUserText.textContent = '';
			return;
		}

		this.pinnedUserHost.classList.add('conversation-timeline-pinned-user--visible');
		this.pinnedUserText.textContent = state.previewText;
	}

	private getVisibleTimelineIndices(): number[] {
		const firstVisible = this.tree.firstVisibleElement;
		if (!firstVisible) {
			return [];
		}
		const lastVisible = this.tree.lastVisibleElement;
		if (!lastVisible) {
			return [];
		}
		const firstIndex = indexOfConversationTimelineFlatItem(this.flatItems, firstVisible);
		const lastIndex = indexOfConversationTimelineFlatItem(this.flatItems, lastVisible);
		return rangeVisibleTimelineIndices(firstIndex, lastIndex);
	}

	private withPersistedAutoScroll(fn: () => void): void {
		if (this.autoScrollHolds.isHeld) {
			fn();
			return;
		}
		const wasScrolledToBottom = this.isScrolledToBottom();
		fn();
		if (wasScrolledToBottom || this._scrollLock) {
			this.scrollToEnd();
		}
	}

	override dispose(): void {
		this.renderer.clearConfirmationSeats();
		super.dispose();
	}
}
