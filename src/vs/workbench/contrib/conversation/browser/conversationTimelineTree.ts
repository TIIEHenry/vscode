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
import { conversationLensTurnCopy, conversationLensTurnDelete, conversationLensPinnedUserPromptAria, conversationLensPinnedUserPromptCopyAria, conversationLensTurnViewInTrajectory } from './conversationLensSessionBarStrings.js';
import { ConversationMermaidExtensionInfo, createMermaidHostContext } from './conversationMermaidHost.js';
import { renderProcessFoldSpan } from './conversationProcessFold.js';
import { ProcessFoldSpan, projectProcessFoldSpans } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import type { ConversationViewFrameApplied } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import {
	ConversationTimelineEntry,
	entriesToRenderableTurns,
	stubTurnsToEntries,
} from './conversationSessionView.js';
import { computeTimelineApplyPlan } from './conversationTimelineApply.js';
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
	readonly onEditUserTurn?: (turnId: string) => void;
	readonly onViewInTrajectory?: (turnId: string) => void;
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
		private readonly onEditUserTurn: ((turnId: string) => void) | undefined,
		private readonly onViewInTrajectory: ((turnId: string) => void) | undefined,
		private readonly getEditingTurnId: () => string | undefined,
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
				onViewInTrajectory: this.onViewInTrajectory,
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
				const editing = this.getEditingTurnId() === turn.id;
				if (editing) {
					el.classList.add('conversation-lens-turn--editing');
					const host = append(el, $('.conversation-lens-turn-edit-host'));
					host.setAttribute('data-turn-id', turn.id);
					templateData.container.appendChild(el);
					this.scheduleHeightUpdate(item, templateData.container);
					return;
				}
			}

			const header = append(el, $('.conversation-lens-turn-header'));
			header.textContent = getConversationTurnRoleLabel(turn.kind);

			if (turn.kind === 'user' && this.onViewInTrajectory) {
				appendTurnTrajectoryButton(header, turn.id, this.onViewInTrajectory, templateData.disposables, 'conversation-lens-turn-header-trajectory');
			}

			const body = append(el, $('.conversation-lens-turn-body'));
			if (turn.kind === 'user') {
				body.classList.add('conversation-lens-turn-body--user-bubble', 'conversation-lens-turn-body--clickable');
				body.setAttribute('role', 'button');
				body.tabIndex = 0;
				templateData.disposables.add(addDisposableListener(body, 'click', (e) => {
					if ((e.target as HTMLElement).closest('.conversation-lens-turn-fold-button')) {
						return;
					}
					this.onEditUserTurn?.(turn.id);
				}));
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

			if (turn.kind === 'assistant') {
				const actions = append(el, $('.conversation-lens-turn-actions'));
				if (this.onViewInTrajectory) {
					appendTurnTrajectoryButton(actions, turn.id, this.onViewInTrajectory, templateData.disposables);
				}
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

	pruneUserBubbleExpanded(knownIds: ReadonlySet<string>): void {
		for (const id of this.userBubbleExpanded.keys()) {
			if (!knownIds.has(id)) {
				this.userBubbleExpanded.delete(id);
			}
		}
	}

	pruneProcessFoldExpanded(knownIds: ReadonlySet<string>): void {
		for (const id of this.processFoldOuterExpanded.keys()) {
			if (!knownIds.has(id)) {
				this.processFoldOuterExpanded.delete(id);
			}
		}
		for (const id of this.processFoldThinkingExpanded.keys()) {
			if (!knownIds.has(id)) {
				this.processFoldThinkingExpanded.delete(id);
			}
		}
		for (const id of this.processFoldToolExpanded.keys()) {
			if (!knownIds.has(id)) {
				this.processFoldToolExpanded.delete(id);
			}
		}
	}

	pruneVisualizeExpanded(knownIds: ReadonlySet<string>): void {
		for (const id of this.visualizeExpanded.keys()) {
			if (!knownIds.has(id)) {
				this.visualizeExpanded.delete(id);
			}
		}
	}

	pruneConfirmationSeats(knownIds: ReadonlySet<string>): void {
		for (const [id, seat] of this.confirmationSeats) {
			if (!knownIds.has(id)) {
				seat.dispose();
				this.confirmationSeats.delete(id);
			}
		}
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

function appendTurnTrajectoryButton(
	parent: HTMLElement,
	turnId: string,
	onViewInTrajectory: (turnId: string) => void,
	disposables: DisposableStore,
	containerClass = 'conversation-lens-turn-action-trajectory',
): void {
	const trajectoryContainer = append(parent, $(`span.${containerClass}`));
	const trajectoryButton = disposables.add(new Button(trajectoryContainer, {
		...defaultButtonStyles,
		supportIcons: true,
		small: true,
		secondary: true,
		title: conversationLensTurnViewInTrajectory,
		ariaLabel: conversationLensTurnViewInTrajectory,
	}));
	trajectoryButton.icon = Codicon.listTree;
	disposables.add(trajectoryButton.onDidClick(() => onViewInTrajectory(turnId)));
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
	private readonly timelineIdentity = {
		getId: (item: ConversationTimelineItem) => item.variant === 'process-fold'
			? item.processFoldSpan?.id ?? item.turn.id
			: item.turn.id,
	};
	private mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;
	private editingTurnId: string | undefined;
	private currentEntries: readonly ConversationTimelineEntry[] = [];
	private currentTurns: readonly ConversationStubTurn[] = [];
	private _testSetChildrenCount = 0;
	private _testRerenderCount = 0;

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
			options.onEditUserTurn,
			options.onViewInTrajectory,
			() => this.editingTurnId,
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
		this.applyEntries(stubTurnsToEntries(turns), { kind: 'baseline' });
	}

	applyEntries(entries: readonly ConversationTimelineEntry[], applied: ConversationViewFrameApplied): void {
		const nextTurns = entriesToRenderableTurns(entries);
		const plan = computeTimelineApplyPlan(this.currentTurns, nextTurns, applied);

		if (plan.mode === 'none') {
			return;
		}

		this.currentEntries = entries;
		this.currentTurns = nextTurns;

		if (plan.mode === 'baseline') {
			this.applyBaseline(nextTurns, plan.removedTreeIds);
			return;
		}

		if (plan.mode === 'structure') {
			this.applyStructure(nextTurns, plan.removedTreeIds);
			return;
		}

		this.applyContentPatches(nextTurns, plan.rerenderIds, plan.removedTreeIds);
	}

	/** @internal Test instrumentation for applyEntries (plan §3.4). */
	getTestApplyMetrics(): { setChildrenCount: number; rerenderCount: number } {
		return { setChildrenCount: this._testSetChildrenCount, rerenderCount: this._testRerenderCount };
	}

	/** @internal */
	resetTestApplyMetrics(): void {
		this._testSetChildrenCount = 0;
		this._testRerenderCount = 0;
	}

	/** @internal Returns the live DOM node for a tree row identity (type B DOM reuse tests). */
	getTimelineRowElement(treeId: string): HTMLElement | undefined {
		return this.treeContainer.querySelector(`[data-turn-id="${treeId}"], [data-fold-id="${treeId}"]`) as HTMLElement | undefined
			?? this.treeContainer.querySelector(`[data-turn-id="${treeId}"]`) as HTMLElement | undefined;
	}

	private applyBaseline(turns: readonly ConversationStubTurn[], removedTreeIds: ReadonlySet<string>): void {
		this.withPersistedAutoScroll(() => {
			this.pruneExpandedState(removedTreeIds, turns);
			this.rebuildTreeFromTurns(turns);
		});
	}

	private applyStructure(turns: readonly ConversationStubTurn[], removedTreeIds: ReadonlySet<string>): void {
		this.withPersistedAutoScroll(() => {
			this.pruneExpandedState(removedTreeIds, turns);
			this.rebuildTreeFromTurns(turns, { diff: true });
		});
	}

	private applyContentPatches(
		turns: readonly ConversationStubTurn[],
		rerenderIds: ReadonlySet<string>,
		removedTreeIds: ReadonlySet<string>,
	): void {
		this.withPersistedAutoScroll(() => {
			this.pruneExpandedState(removedTreeIds, turns);
			this.patchTurnItemsInPlace(turns);
			for (const treeId of rerenderIds) {
				const item = this.turnItems.get(treeId);
				if (!item || !this.tree.hasElement(item)) {
					continue;
				}
				this._testRerenderCount += 1;
				this.tree.rerender(item);
			}
			this.renderEmptyState(turns.length === 0);
			this.updatePinnedUserPromptVisibility();
		});
	}

	private pruneExpandedState(removedTreeIds: ReadonlySet<string>, turns: readonly ConversationStubTurn[]): void {
		const knownIds = this.collectKnownExpandedIds(turns);
		for (const id of removedTreeIds) {
			knownIds.delete(id);
		}
		this.renderer.pruneConfirmationSeats(knownIds);
		this.renderer.pruneUserBubbleExpanded(knownIds);
		this.renderer.pruneProcessFoldExpanded(knownIds);
		this.renderer.pruneVisualizeExpanded(knownIds);
	}

	private collectKnownExpandedIds(turns: readonly ConversationStubTurn[]): Set<string> {
		const knownIds = new Set<string>();
		for (const turn of turns) {
			knownIds.add(turn.id);
		}
		for (const span of projectProcessFoldSpans(turns)) {
			knownIds.add(span.id);
			for (const turnId of span.turnIds) {
				knownIds.add(turnId);
			}
		}
		return knownIds;
	}

	private rebuildTreeFromTurns(turns: readonly ConversationStubTurn[], options?: { diff?: boolean }): void {
		const items = this.buildTreeElements(turns);
		this.indexTurnItems(turns, items);
		this._testSetChildrenCount += 1;
		if (options?.diff) {
			this.tree.setChildren(null, items, { diffIdentityProvider: this.timelineIdentity });
		} else {
			this.tree.setChildren(null, items);
		}
		this.renderEmptyState(turns.length === 0);
		this.updatePinnedUserPromptVisibility();
	}

	private indexTurnItems(turns: readonly ConversationStubTurn[], items: readonly IObjectTreeElement<ConversationTimelineItem>[]): void {
		this.flatItems = flattenConversationTimelineItems(turns);
		this.turnItems.clear();
		for (const treeElement of items) {
			const item = treeElement.element;
			const treeId = this.timelineIdentity.getId(item);
			this.turnItems.set(treeId, item);
			this.turnItems.set(item.turn.id, item);
			if (item.variant === 'process-fold' && item.processFoldSpan) {
				for (const turnId of item.processFoldSpan.turnIds) {
					this.turnItems.set(turnId, item);
				}
			}
		}
	}

	private patchTurnItemsInPlace(turns: readonly ConversationStubTurn[]): void {
		this.flatItems = flattenConversationTimelineItems(turns);
		const freshById = new Map<string, ConversationTimelineItem>();
		for (const treeElement of this.buildTreeElements(turns)) {
			const item = treeElement.element;
			freshById.set(this.timelineIdentity.getId(item), item);
		}

		const indexedLiveItems = new Map<string, ConversationTimelineItem>();
		for (const item of this.turnItems.values()) {
			indexedLiveItems.set(this.timelineIdentity.getId(item), item);
		}

		for (const [treeId, fresh] of freshById) {
			const live = indexedLiveItems.get(treeId);
			if (!live) {
				continue;
			}
			const mutable = live as { turn: ConversationStubTurn; variant: ConversationTimelineItemVariant; processFoldSpan?: ProcessFoldSpan };
			mutable.turn = fresh.turn;
			mutable.variant = fresh.variant;
			mutable.processFoldSpan = fresh.processFoldSpan;
		}

		this.turnItems.clear();
		for (const item of new Set(indexedLiveItems.values())) {
			const treeId = this.timelineIdentity.getId(item);
			this.turnItems.set(treeId, item);
			this.turnItems.set(item.turn.id, item);
			if (item.variant === 'process-fold' && item.processFoldSpan) {
				for (const turnId of item.processFoldSpan.turnIds) {
					this.turnItems.set(turnId, item);
				}
			}
		}
	}

	setEditingTurnId(turnId: string | undefined): void {
		if (this.editingTurnId === turnId) {
			return;
		}
		this.editingTurnId = turnId;
		this.refreshTurnPresentation();
	}

	getTurnEditHost(turnId: string): HTMLElement | undefined {
		return this.treeContainer.querySelector(`.conversation-lens-turn-edit-host[data-turn-id="${turnId}"]`) as HTMLElement | undefined;
	}

	private refreshTurnPresentation(): void {
		if (this.currentEntries.length === 0 && this.currentTurns.length === 0) {
			return;
		}
		if (this.currentEntries.length > 0) {
			this.applyEntries(this.currentEntries, { kind: 'baseline' });
		} else {
			this.setTurns(this.currentTurns);
		}
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
		let lastVisible: ConversationTimelineItem | null | undefined;
		try {
			// Unlike firstVisibleElement, the tree's lastVisibleElement getter has no bounds check and
			// throws when the view has no laid-out rows yet (zero-height layout, first render).
			lastVisible = this.tree.lastVisibleElement;
		} catch {
			lastVisible = undefined;
		}
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
