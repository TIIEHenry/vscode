/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, getWindow, scheduleAtNextAnimationFrame } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { RenderIndentGuides } from '../../../../base/browser/ui/tree/abstractTree.js';
import { IObjectTreeElement, ITreeElementRenderDetails, ITreeNode, ITreeRenderer, ObjectTreeElementCollapseState } from '../../../../base/browser/ui/tree/tree.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { asCssVariable, asCssVariableWithDefault, buttonSecondaryBackground, buttonSecondaryForeground } from '../../../../platform/theme/common/colorRegistry.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ConversationConfirmationSeat } from './conversationConfirmationSeat.js';
import { conversationLensThinkingNotConnected, conversationLensToolNotConnected } from './conversationLensSessionBarStrings.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import {
	computeConversationScrollDownState,
	ConversationAutoScrollHolds,
	isConversationTimelineScrolledToBottom,
} from './conversationTimelineScroll.js';
import { ConversationTurnContentAdapter, IConversationTurnContentAdapter } from './conversationTurnContentAdapter.js';
import { getConversationTurnRoleLabel } from './conversationTrajectoryList.js';

export type ConversationTimelineItemVariant = 'turn' | 'process-body';

export interface ConversationTimelineItem {
	readonly turn: ConversationStubTurn;
	readonly variant: ConversationTimelineItemVariant;
}

export interface IConversationTimelineTreeOptions {
	readonly onResolveConfirmation?: (turnId: string, status: 'allowed' | 'skipped') => void;
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
		return this.heights.get(key) ?? (element.variant === 'process-body' ? 40 : 72);
	}

	getTemplateId(element: ConversationTimelineItem): string {
		return element.variant === 'process-body'
			? ConversationTimelineRenderer.PROCESS_BODY_TEMPLATE_ID
			: ConversationTimelineRenderer.TEMPLATE_ID;
	}

	hasDynamicHeight(): boolean {
		return true;
	}

	setDynamicHeight(element: ConversationTimelineItem, height: number): void {
		this.heights.set(this.heightKey(element), height);
	}

	private heightKey(element: ConversationTimelineItem): string {
		return element.variant === 'process-body'
			? `${element.turn.id}:body`
			: element.turn.id;
	}
}

class ConversationTimelineRenderer implements ITreeRenderer<ConversationTimelineItem, void, ITurnTemplateData> {

	static readonly TEMPLATE_ID = 'conversationTimelineTurn';
	static readonly PROCESS_BODY_TEMPLATE_ID = 'conversationTimelineProcessBody';

	readonly templateId = ConversationTimelineRenderer.TEMPLATE_ID;

	private readonly confirmationSeats = new Map<string, ConversationConfirmationSeat>();

	constructor(
		private readonly contentAdapter: IConversationTurnContentAdapter,
		private readonly onResolveConfirmation: ((turnId: string, status: 'allowed' | 'skipped') => void) | undefined,
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

		if (item.variant === 'process-body') {
			const el = append(templateData.container, $('.conversation-lens-turn-process-body'));
			el.setAttribute('data-turn-id', turn.id);
			el.setAttribute('data-kind', turn.kind);
			el.textContent = turn.kind === 'thinking'
				? conversationLensThinkingNotConnected
				: conversationLensToolNotConnected;
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
			const el = append(templateData.container, $('div.conversation-lens-turn.conversation-lens-turn-process'));
			el.setAttribute('data-kind', turn.kind);
			el.setAttribute('data-turn-id', turn.id);

			const header = append(el, $('.conversation-lens-turn-header'));
			header.textContent = getConversationTurnRoleLabel(turn.kind);

			const summary = append(el, $('.conversation-lens-turn-summary'));
			summary.textContent = turn.text;
			templateData.container.appendChild(el);
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

	private scheduleHeightUpdate(item: ConversationTimelineItem, row: HTMLElement): void {
		const targetWindow = getWindow(row);
		targetWindow.requestAnimationFrame(() => {
			const height = Math.max(row.offsetHeight, 1);
			this.onHeightChange(item, height);
		});
	}
}

class ConversationTimelineProcessBodyRenderer implements ITreeRenderer<ConversationTimelineItem, void, ITurnTemplateData> {

	readonly templateId = ConversationTimelineRenderer.PROCESS_BODY_TEMPLATE_ID;

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
	private readonly tree: WorkbenchObjectTree<ConversationTimelineItem, void>;
	private readonly renderer: ConversationTimelineRenderer;
	private readonly delegate: ConversationTimelineDelegate;
	private readonly autoScrollHolds = new ConversationAutoScrollHolds();
	private readonly turnItems = new Map<string, ConversationTimelineItem>();

	private _scrollLock = true;

	constructor(
		parent: HTMLElement,
		options: IConversationTimelineTreeOptions,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		const timeline = append(parent, $('.conversation-lens-timeline'));
		timeline.setAttribute('role', 'log');
		timeline.setAttribute('aria-label', localize('conversationLens.timeline', "Conversation timeline"));

		this.scrollHost = append(timeline, $('.conversation-lens-timeline-scroll'));
		this.emptyState = append(this.scrollHost, $('.conversation-lens-timeline-empty'));
		append(this.emptyState, $('p.conversation-lens-timeline-empty-title')).textContent =
			localize('conversationLens.timelineEmptyTitle', "No messages yet");
		append(this.emptyState, $('p.conversation-lens-timeline-empty-hint')).textContent =
			localize('conversationLens.timelineEmptyHint', "Send a message below to start this session.");

		this.contentHost = append(this.scrollHost, $('.conversation-lens-timeline-content'));
		this.treeContainer = append(this.contentHost, $('.conversation-timeline-tree'));

		const contentAdapter = options.contentAdapter
			?? this.instantiationService.createInstance(ConversationTurnContentAdapter);

		this.delegate = new ConversationTimelineDelegate();
		this.renderer = new ConversationTimelineRenderer(
			contentAdapter,
			options.onResolveConfirmation,
			(item, height) => this.safeUpdateElementHeight(item, height),
		);
		const processBodyRenderer = new ConversationTimelineProcessBodyRenderer(this.renderer);

		this.tree = this._register(this.instantiationService.createInstance(
			WorkbenchObjectTree<ConversationTimelineItem, void>,
			'ConversationTimeline',
			this.treeContainer,
			this.delegate,
			[this.renderer, processBodyRenderer],
			{
				identityProvider: {
					getId: (e: ConversationTimelineItem) => e.variant === 'process-body'
						? `${e.turn.id}:body`
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
						if (item.variant === 'process-body') {
							return item.turn.kind === 'thinking'
								? conversationLensThinkingNotConnected
								: conversationLensToolNotConnected;
						}
						const turn = item.turn;
						if (turn.kind === 'confirmation') {
							return localize('conversationLens.confirmationSeat', "Confirmation");
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
		}));

		this._register(this.tree.onDidChangeContentHeight(() => {
			if (this._scrollLock && !this.autoScrollHolds.isHeld) {
				this.scrollToEnd();
			}
			this.updateScrollDownButtonVisibility();
		}));

		this._register(addDisposableListener(this.treeContainer, 'wheel', () => {
			if (!this.isScrolledToBottom()) {
				this.setScrollLock(false);
			}
		}));

		this.updateScrollDownButtonVisibility();
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

	setTurns(turns: readonly ConversationStubTurn[]): void {
		this.withPersistedAutoScroll(() => {
			this.renderer.clearConfirmationSeats();
			this.turnItems.clear();
			const items = turns.map(turn => this.toTreeElement(turn));
			for (const treeElement of items) {
				this.turnItems.set(treeElement.element.turn.id, treeElement.element);
			}
			this.tree.setChildren(null, items);
			this.renderEmptyState(turns.length === 0);
		});
	}

	revealTurn(turnId: string): void {
		const item = this.turnItems.get(turnId);
		if (!item) {
			return;
		}
		this.revealTurnElement(item);
	}

	private revealTurnElement(item: ConversationTimelineItem, attempt = 0): void {
		if (!this.tree.hasElement(item)) {
			if (attempt < 3) {
				scheduleAtNextAnimationFrame(getWindow(this.domNode), () => this.revealTurnElement(item, attempt + 1));
			}
			return;
		}
		try {
			this.tree.reveal(item, 0.5);
		} catch {
			if (attempt < 3) {
				scheduleAtNextAnimationFrame(getWindow(this.domNode), () => this.revealTurnElement(item, attempt + 1));
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
	}

	scrollToEnd(): void {
		this.tree.scrollTop = this.tree.scrollHeight;
	}

	isScrolledToBottom(): boolean {
		return isConversationTimelineScrolledToBottom(this.tree.scrollTop, this.tree.renderHeight, this.tree.scrollHeight);
	}

	getConfirmationElement(turnId: string): HTMLElement | undefined {
		return this.renderer.getConfirmationElement(turnId);
	}

	layout(height: number, width: number): void {
		this.tree.layout(height, width);
	}

	private toTreeElement(turn: ConversationStubTurn): IObjectTreeElement<ConversationTimelineItem> {
		const element: ConversationTimelineItem = { turn, variant: 'turn' };
		if (turn.kind === 'thinking' || turn.kind === 'tool') {
			return {
				element,
				collapsible: true,
				collapsed: ObjectTreeElementCollapseState.PreserveOrCollapsed,
				children: [{ element: { turn, variant: 'process-body' } }],
			};
		}
		return { element };
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
