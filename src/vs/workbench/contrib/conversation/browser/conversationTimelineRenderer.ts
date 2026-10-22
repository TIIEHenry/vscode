/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, getWindow } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { ITreeElementRenderDetails, ITreeNode, ITreeRenderer } from '../../../../base/browser/ui/tree/tree.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import { ConversationConfirmationSeat } from './conversationConfirmationSeat.js';
import { ConversationQuestionSeat } from './conversationQuestionSeat.js';
import { conversationLensTurnCopy, conversationLensTurnDelete, conversationLensTurnViewInTrajectory } from './conversationLensSessionBarStrings.js';
import { ConversationMermaidExtensionInfo, createMermaidHostContext } from './conversationMermaidHost.js';
import type { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { DiffEditorPool } from '../../chat/browser/widget/chatContentParts/chatContentCodePools.js';
import { renderFileEditCard, renderProcessFoldSpan } from './conversationProcessFold.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import {
	getConversationEntryAriaLabel,
	getConversationHonestFields,
	getConversationHonestKind,
} from './conversationSessionView.js';
import {
	ConversationTimelineItem,
	ITurnTemplateData,
} from './conversationTimelineTypes.js';
import { renderConversationVisualizeCard } from './conversationVisualizeCard.js';
import { IConversationTurnContentAdapter } from './conversationTurnContentAdapter.js';
import { getTrajectoryKindLabel } from './conversationTrajectory.js';
import { getConversationTurnRoleLabel } from './conversationTrajectoryList.js';
import type { ConversationQuestionRespondAnswers } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { conversationTurnReadText } from './conversationUserRefs.js';
import {
	shouldCollapseUserBubble,
	shouldScrollExpandedUserBubble,
} from './conversationUserBubbleCollapse.js';

export const conversationLensUserBubbleShowMore = localize('conversationLens.userBubbleShowMore', "Show more");
export const conversationLensUserBubbleShowLess = localize('conversationLens.userBubbleShowLess', "Show less");
export const conversationLensErrorRetry = localize('conversationLens.errorRetry', "Retry");
export const conversationLensTurnRegenerate = localize('conversationLens.regenerateTurn', "Regenerate");
const conversationLensTurnNeutral = localize('conversationLens.turnNeutral', "Text");
const conversationLensTurnSending = localize('conversationLens.turnSending', "Sending…");

/**
 * Turn edit stays on the docked composer. Callers still pass the node on enter
 * and clear it on exit; the timeline does not mount it.
 */
export function provideTurnEditComposer(_composer: HTMLElement | undefined): void {
}

export class ConversationTimelineDelegate implements IListVirtualDelegate<ConversationTimelineItem> {

	private readonly heights = new Map<string, number>();

	getHeight(element: ConversationTimelineItem): number {
		const key = this.heightKey(element);
		if (this.heights.has(key)) {
			return this.heights.get(key)!;
		}
		const kind = getConversationHonestKind(element.turn);
		if (kind === 'reviewNav' || kind === 'question' || kind === 'error' || kind === 'unknown' || kind === 'system') {
			return 36;
		}
		return element.variant === 'process-fold' ? 40 : 72;
	}

	getDynamicHeight(element: ConversationTimelineItem): number | null {
		const key = this.heightKey(element);
		return this.heights.get(key) ?? null;
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

/**
 * Visible source line for a reading-surface turn.
 * User rows and the default assistant do not show You / Agent. A non-default
 * assistant shows its agent id. Screen-reader names stay on the article label.
 */
export function readingTurnSourceName(turn: { kind: string; agentId?: string }): string | undefined {
	if (turn.kind === 'assistant' && turn.agentId && turn.agentId !== 'default') {
		return turn.agentId;
	}
	return undefined;
}

export class ConversationTimelineRenderer implements ITreeRenderer<ConversationTimelineItem, void, ITurnTemplateData> {

	static readonly TEMPLATE_ID = 'conversationTimelineTurn';
	static readonly PROCESS_FOLD_TEMPLATE_ID = 'conversationTimelineProcessFold';

	readonly templateId = ConversationTimelineRenderer.TEMPLATE_ID;

	private readonly confirmationSeats = new Map<string, ConversationConfirmationSeat>();
	private readonly questionSeats = new Map<string, ConversationQuestionSeat>();
	/** Pending seat id → message text for a decision posted before a failure or a closed status. */
	private readonly openDecisionHold = new Map<string, string>();
	private readonly userBubbleExpanded = new Map<string, boolean>();
	private readonly processFoldOuterExpanded = new Map<string, boolean>();
	private readonly processFoldThinkingExpanded = new Map<string, boolean>();
	private readonly processFoldToolExpanded = new Map<string, boolean>();
	private readonly visualizeExpanded = new Map<string, boolean>();
	/** Supersedes stale rAF height callbacks when a recycled row paints another item. */
	private readonly rowHeightGeneration = new WeakMap<ITurnTemplateData, number>();

	constructor(
		private readonly contentAdapter: IConversationTurnContentAdapter,
		private readonly onResolveConfirmation: ((turnId: string, status: 'allowed' | 'skipped') => void) | undefined,
		private readonly onQuestionRespond: ((turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string) => void) | undefined,
		private readonly onCopyTurn: ((turnId: string, text: string) => void) | undefined,
		private readonly onDeleteTurn: ((turn: ConversationStubTurn) => void) | undefined,
		private readonly onEditUserTurn: ((turnId: string) => void) | undefined,
		private readonly onViewInTrajectory: ((turnId: string) => void) | undefined,
		private readonly onCancelToolCall: ((turn: ConversationStubTurn) => void) | undefined,
		private readonly onRetryError: ((turn: ConversationStubTurn) => void) | undefined,
		private readonly onReviewNavClick: ((paths: readonly string[]) => void) | undefined,
		private readonly getEditingTurnId: () => string | undefined,
		private readonly onOpenVisualizeFullscreen: ((source: string, title?: string) => void) | undefined,
		private readonly getMermaidExtensionInfo: () => ConversationMermaidExtensionInfo | undefined,
		private readonly showLiveChrome: () => boolean,
		private readonly writesEnabled: () => boolean,
		private readonly showToolInvocationDetails: () => boolean,
		private readonly webviewService: IWebviewService,
		private readonly getTimelineScrollHost: () => HTMLElement | undefined,
		private readonly onHeightChange: (item: ConversationTimelineItem, height: number) => void,
		private readonly diffEditorPool?: DiffEditorPool,
		private readonly instantiationService?: IInstantiationService,
		private readonly onRegenerateTurn?: (turn: ConversationStubTurn) => void,
		private readonly onRespondClientTool?: (turn: ConversationStubTurn) => void,
		private readonly onInlineDiagramWheel?: () => void,
	) { }

	renderTemplate(container: HTMLElement): ITurnTemplateData {
		container.classList.add('conversation-lens-timeline-row');
		return { container, disposables: new DisposableStore() };
	}

	renderElement(node: ITreeNode<ConversationTimelineItem, void>, _index: number, templateData: ITurnTemplateData): void {
		templateData.disposables.clear();
		clearNode(templateData.container);
		const rowHeightGen = this.bumpRowHeightGeneration(templateData);

		const item = node.element;
		const turn = item.turn;

		if (item.variant === 'process-fold' && item.processFoldSpan) {
			const span = item.processFoldSpan;
			renderProcessFoldSpan(templateData.container, span, {
				defaultOuterExpanded: false,
				showLiveChrome: this.showLiveChrome(),
				writesEnabled: this.writesEnabled(),
				showToolInvocationDetails: this.showToolInvocationDetails(),
				diffEditorPool: this.diffEditorPool,
				instantiationService: this.instantiationService,
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
				onCancelToolCall: this.onCancelToolCall,
				onRespondClientTool: this.onRespondClientTool,
				onLayoutChange: () => this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen),
			}, templateData.disposables);
			this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen);
			return;
		}

		if (turn.readOnlyText === 'context' || turn.readOnlyText === 'neutral') {
			renderReadOnlyTextRow(templateData.container, turn, turn.readOnlyText);
			this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen);
			return;
		}

		if (turn.kind === 'reviewNav') {
			const button = append(templateData.container, $('button.conversation-review-nav')) as HTMLButtonElement;
			button.type = 'button';
			button.textContent = turn.text;
			button.setAttribute('data-turn-id', turn.id);
			button.setAttribute('data-kind', turn.kind);
			button.setAttribute('aria-label', getConversationEntryAriaLabel(turn));
			if (this.onReviewNavClick && turn.reviewNavPaths && turn.reviewNavPaths.length > 0) {
				templateData.disposables.add(addDisposableListener(button, 'click', (e) => {
					e.stopPropagation();
					this.onReviewNavClick!(turn.reviewNavPaths!);
				}));
			}
			this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen);
			return;
		}

		const honestKind = getConversationHonestKind(turn);
		if (honestKind === 'question') {
			const fields = getConversationHonestFields(turn);
			const responseInFlight = this.decisionHeld(turn);
			const seat = templateData.disposables.add(new ConversationQuestionSeat({
				message: turn.text,
				status: turn.status ?? 'pending',
				questionItems: fields.questionItems,
				answerKeysValid: fields.answerKeysValid,
				questionRequestId: fields.questionRequestId,
				payload: turn.payload,
				agentId: fields.agentId,
				onRespond: (turn.status ?? 'pending') === 'pending' && this.onQuestionRespond
					? (requestId, answers, customText) => {
						this.noteFreshDecision(turn);
						this.onQuestionRespond!(turn.id, requestId, answers, customText);
					}
					: undefined,
				writesEnabled: this.writesEnabled() && !responseInFlight,
				responseInFlight,
				respondFailure: turn.respondFailure,
			}));
			seat.element.setAttribute('data-turn-id', turn.id);
			this.questionSeats.set(turn.id, seat);
			templateData.container.appendChild(seat.element);
			this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen);
			return;
		}
		if (honestKind === 'error' || honestKind === 'unknown' || honestKind === 'system') {
			renderHonestTimelineRow(templateData.container, turn, honestKind, templateData.disposables, this.onRetryError, this.writesEnabled());
			this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen);
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
					this.visualizeExpanded.set(turnId, expanded);
				},
				onLayoutChange: () => this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen),
				mermaidHost,
				onOpenFullscreen: this.onOpenVisualizeFullscreen,
				onWheelDelegate: (e) => {
					const scrollHost = this.getTimelineScrollHost();
					if (scrollHost) {
						scrollHost.scrollTop += e.deltaY;
					}
					this.onInlineDiagramWheel?.();
				},
			}, templateData.disposables);
			// eslint-disable-next-line no-restricted-syntax -- the visualize card is rendered by the visualize component
			const visualizeRoot = templateData.container.querySelector('.conversation-visualize-card') as HTMLElement | null;
			visualizeRoot?.setAttribute('aria-label', getConversationEntryAriaLabel(turn));
			this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen);
			return;
		}

		if (turn.kind === 'confirmation') {
			const responseInFlight = this.decisionHeld(turn);
			const seat = templateData.disposables.add(new ConversationConfirmationSeat({
				message: turn.text,
				status: turn.status ?? 'pending',
				onAllow: (turn.status ?? 'pending') === 'pending' && this.onResolveConfirmation
					? () => {
						this.noteFreshDecision(turn);
						this.onResolveConfirmation!(turn.id, 'allowed');
					}
					: undefined,
				onSkip: (turn.status ?? 'pending') === 'pending' && this.onResolveConfirmation
					? () => {
						this.noteFreshDecision(turn);
						this.onResolveConfirmation!(turn.id, 'skipped');
					}
					: undefined,
				writesEnabled: this.writesEnabled() && !responseInFlight,
				responseInFlight,
				respondFailure: turn.respondFailure,
			}));
			seat.element.setAttribute('data-turn-id', turn.id);
			seat.element.classList.add('conversation-lens-turn', 'conversation-lens-turn--permission');
			seat.element.setAttribute('data-kind', turn.kind);
			seat.element.setAttribute('data-honest-kind', 'permission');
			this.confirmationSeats.set(turn.id, seat);
			templateData.container.appendChild(seat.element);
		} else if (turn.kind === 'thinking' || turn.kind === 'tool') {
			// Process-fold spans own thinking/tool; a standalone hit is a fallback, not fold chrome.
			renderStandaloneThinkingOrToolRow(templateData.container, turn, {
				diffEditorPool: this.diffEditorPool,
				instantiationService: this.instantiationService,
				isToolExpanded: (turnId) => this.processFoldToolExpanded.get(turnId) ?? false,
				setToolExpanded: (turnId, expanded) => {
					if (expanded) {
						this.processFoldToolExpanded.set(turnId, true);
					} else {
						this.processFoldToolExpanded.delete(turnId);
					}
				},
				onLayoutChange: () => this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen),
			}, templateData.disposables);
		} else {
			const el = $('div.conversation-lens-turn');
			el.setAttribute('data-kind', turn.kind);
			el.setAttribute('data-turn-id', turn.id);
			if (turn.stubEcho) {
				el.setAttribute('data-stub', 'true');
			}
			const sending = turn.kind === 'user' && turn.pending === true;
			if (turn.kind === 'user') {
				el.classList.add('conversation-lens-turn--user');
				if (sending) {
					el.setAttribute('data-pending', 'true');
				}
				const editing = !sending && this.getEditingTurnId() === turn.id;
				if (editing) {
					el.classList.add('conversation-lens-turn--editing');
				}
			}

			const sourceName = readingTurnSourceName(turn);
			const showTrajectory = turn.kind === 'user' && !sending && !!this.onViewInTrajectory;
			if (sourceName || sending || showTrajectory) {
				const header = append(el, $('.conversation-lens-turn-header'));
				if (sourceName) {
					const identity = append(header, $('span.conversation-lens-turn-source'));
					identity.textContent = sourceName;
				}
				if (sending) {
					const status = append(header, $('span.conversation-lens-turn-honest-status'));
					status.textContent = conversationLensTurnSending;
				}
				if (showTrajectory) {
					appendTurnTrajectoryButton(header, turn.id, this.onViewInTrajectory!, templateData.disposables, 'conversation-lens-turn-header-trajectory');
				}
			}

			const body = append(el, $('.conversation-lens-turn-body'));
			if (turn.kind === 'user') {
				body.classList.add('conversation-lens-turn-body--user-bubble');
				if (!sending) {
					body.classList.add('conversation-lens-turn-body--clickable');
					body.setAttribute('role', 'button');
					body.tabIndex = 0;
					const triggerEdit = () => {
						if (!this.writesEnabled()) {
							return;
						}
						this.onEditUserTurn?.(turn.id);
					};
					templateData.disposables.add(addDisposableListener(body, 'click', (e) => {
						const target = e.target as HTMLElement | null;
						if (target?.closest('.conversation-lens-turn-fold-button, .conversation-lens-turn-user-refs')) {
							return;
						}
						const selection = getWindow(templateData.container).getSelection()?.toString();
						if (selection && selection.length > 0) {
							return;
						}
						triggerEdit();
					}));
					templateData.disposables.add(addDisposableListener(body, 'keydown', (e: KeyboardEvent) => {
						const target = e.target as HTMLElement | null;
						if (target?.closest('.conversation-lens-turn-user-refs')) {
							return;
						}
						if ((e.key === 'Enter' || e.key === ' ') && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
							e.preventDefault();
							triggerEdit();
						}
					}));
				}
			} else if (turn.kind === 'assistant') {
				body.classList.add('conversation-lens-turn-body--reading-text');
			}
			templateData.disposables.add(this.contentAdapter.renderTurnBody(turn, body));

			const userBody = conversationTurnReadText(turn.kind, turn.text);
			if (turn.kind === 'user' && shouldCollapseUserBubble(userBody)) {
				const expanded = this.userBubbleExpanded.get(turn.id) ?? false;
				body.classList.add('conversation-lens-turn-body--collapsible');
				this.applyUserBubbleCollapseState(body, userBody, expanded);

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
					this.applyUserBubbleCollapseState(body, userBody, nextExpanded);
					foldButton.textContent = nextExpanded ? conversationLensUserBubbleShowLess : conversationLensUserBubbleShowMore;
					foldButton.setAttribute('aria-expanded', String(nextExpanded));
					foldButton.setAttribute('aria-label', nextExpanded ? conversationLensUserBubbleShowLess : conversationLensUserBubbleShowMore);
					this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen);
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
					templateData.disposables.add(copyButton.onDidClick(() => this.onCopyTurn!(turn.id, userBody)));
				}

				const regenerateContainer = append(actions, $('span.conversation-lens-turn-action-regenerate'));
				const regenerateButton = templateData.disposables.add(new Button(regenerateContainer, {
					...defaultButtonStyles,
					supportIcons: true,
					small: true,
					secondary: true,
					title: conversationLensTurnRegenerate,
					ariaLabel: conversationLensTurnRegenerate,
				}));
				regenerateButton.icon = Codicon.refresh;
				regenerateButton.enabled = this.writesEnabled();
				if (this.onRegenerateTurn) {
					templateData.disposables.add(regenerateButton.onDidClick(() => this.onRegenerateTurn!(turn)));
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
				deleteButton.enabled = this.writesEnabled();
				if (this.onDeleteTurn) {
					templateData.disposables.add(deleteButton.onDidClick(() => this.onDeleteTurn!(turn)));
				}
			}

			templateData.container.appendChild(el);
		}

		this.scheduleHeightUpdate(item, templateData.container, templateData, rowHeightGen);
	}

	disposeElement(_element: ITreeNode<ConversationTimelineItem, void>, _index: number, templateData: ITurnTemplateData, _details?: ITreeElementRenderDetails): void {
		templateData.disposables.clear();
	}

	disposeTemplate(templateData: ITurnTemplateData): void {
		templateData.disposables.dispose();
	}

	getConfirmationElement(turnId: string): HTMLElement | undefined {
		return this.confirmationSeats.get(turnId)?.element ?? this.questionSeats.get(turnId)?.element;
	}

	clearConfirmationSeats(): void {
		for (const seat of this.confirmationSeats.values()) {
			seat.dispose();
		}
		this.confirmationSeats.clear();
		for (const seat of this.questionSeats.values()) {
			seat.dispose();
		}
		this.questionSeats.clear();
		this.openDecisionHold.clear();
	}

	clearUserBubbleExpanded(): void {
		this.userBubbleExpanded.clear();
	}

	clearProcessFoldExpanded(): void {
		this.processFoldOuterExpanded.clear();
		this.processFoldThinkingExpanded.clear();
		this.processFoldToolExpanded.clear();
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
		for (const [id, seat] of this.questionSeats) {
			if (!knownIds.has(id)) {
				seat.dispose();
				this.questionSeats.delete(id);
			}
		}
		for (const id of this.openDecisionHold.keys()) {
			if (!knownIds.has(id)) {
				this.openDecisionHold.delete(id);
			}
		}
	}

	/**
	 * First post of a still-pending seat with no respond failure. A later paint of
	 * that same message stays disabled. A different message, a failure, a closed
	 * status, or a retry that already shows a failure does not use this hold.
	 */
	private decisionHeld(turn: ConversationStubTurn): boolean {
		const pending = (turn.status ?? 'pending') === 'pending';
		const heldText = this.openDecisionHold.get(turn.id);
		if (!pending || turn.respondFailure || heldText === undefined) {
			if (!pending || turn.respondFailure) {
				this.openDecisionHold.delete(turn.id);
			}
			return false;
		}
		if (heldText !== turn.text) {
			this.openDecisionHold.delete(turn.id);
			return false;
		}
		return true;
	}

	private noteFreshDecision(turn: ConversationStubTurn): void {
		if (turn.respondFailure || (turn.status ?? 'pending') !== 'pending') {
			this.openDecisionHold.delete(turn.id);
			return;
		}
		this.openDecisionHold.set(turn.id, turn.text);
	}

	/** D11: reveal into a collapsed process fold expands that fold before scroll. */
	ensureProcessFoldExpanded(spanId: string): void {
		this.processFoldOuterExpanded.set(spanId, true);
	}

	/** D11: reveal of a thinking turn expands that thinking group. */
	ensureThinkingExpanded(turnId: string): void {
		this.processFoldThinkingExpanded.set(turnId, true);
	}

	/** Live expansion maps. Test hook for the document-flow host. */
	getTestExpandedState(): {
		userBubbleExpanded: Map<string, boolean>;
		processFoldOuterExpanded: Map<string, boolean>;
		visualizeExpanded: Map<string, boolean>;
	} {
		return {
			userBubbleExpanded: this.userBubbleExpanded,
			processFoldOuterExpanded: this.processFoldOuterExpanded,
			visualizeExpanded: this.visualizeExpanded,
		};
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

	private bumpRowHeightGeneration(templateData: ITurnTemplateData): number {
		const next = (this.rowHeightGeneration.get(templateData) ?? 0) + 1;
		this.rowHeightGeneration.set(templateData, next);
		return next;
	}

	private scheduleHeightUpdate(
		item: ConversationTimelineItem,
		row: HTMLElement,
		templateData: ITurnTemplateData,
		heightGen: number,
		retryCount = 0,
	): void {
		const targetWindow = getWindow(row);
		targetWindow.requestAnimationFrame(() => {
			if (this.rowHeightGeneration.get(templateData) !== heightGen) {
				return;
			}
			if (!row.isConnected) {
				return;
			}
			const previousStyleHeight = row.style.height;
			row.style.height = '';
			const measured = Math.max(row.offsetHeight, row.scrollHeight);
			row.style.height = previousStyleHeight;
			if (measured <= 0) {
				if (retryCount < 3) {
					this.scheduleHeightUpdate(item, row, templateData, heightGen, retryCount + 1);
				}
				return;
			}
			this.onHeightChange(item, measured);
		});
	}
}

const UNKNOWN_RAW_CONTENT_PREVIEW_MAX_CHARS = 240;
const ERROR_SUMMARY_MAX_CHARS = 120;

const conversationErrorShowDetails = localize('conversationLens.errorShowDetails', "Show details");
const conversationErrorHideDetails = localize('conversationLens.errorHideDetails', "Hide details");
const conversationErrorSubscriptionUnavailable = localize('conversationLens.errorSubscriptionUnavailable', "Subscription unavailable");

export interface ConversationErrorSummary {
	readonly summary: string;
	readonly detail: string | undefined;
}

function firstErrorSentence(text: string): string {
	const line = (text.split('\n')[0] ?? text).trim();
	const sentence = /^(.{1,160}?[.!?])(?:\s|$)/.exec(line);
	return (sentence?.[1] ?? line).trim();
}

function parseClientErrorPayload(text: string): { code?: string; message?: string } | undefined {
	const start = text.indexOf('{');
	if (start < 0) {
		return undefined;
	}
	try {
		const parsed: unknown = JSON.parse(text.slice(start));
		if (typeof parsed !== 'object' || parsed === null) {
			return undefined;
		}
		const record = parsed as Record<string, unknown>;
		const error = typeof record.error === 'object' && record.error !== null
			? record.error as Record<string, unknown>
			: record;
		const code = typeof error.code === 'string' ? error.code : undefined;
		const message = typeof error.message === 'string' ? error.message : undefined;
		if (!code && !message) {
			return undefined;
		}
		return { code, message };
	} catch {
		return undefined;
	}
}

/** One visible line. The raw payload stays behind Show details when it is longer. */
export function summarizeConversationError(text: string): ConversationErrorSummary {
	const trimmed = text.trim();
	if (!trimmed) {
		return { summary: trimmed, detail: undefined };
	}
	const parsed = parseClientErrorPayload(trimmed);
	let summary = parsed?.code === 'InvalidSubscription'
		? conversationErrorSubscriptionUnavailable
		: firstErrorSentence(parsed?.message ?? trimmed);
	if (summary.length > ERROR_SUMMARY_MAX_CHARS) {
		summary = `${summary.slice(0, ERROR_SUMMARY_MAX_CHARS - 1)}…`;
	}
	return { summary, detail: summary === trimmed ? undefined : trimmed };
}

export interface StandaloneToolRowOptions {
	readonly diffEditorPool?: DiffEditorPool;
	readonly instantiationService?: IInstantiationService;
	readonly isToolExpanded?: (turnId: string) => boolean;
	readonly setToolExpanded?: (turnId: string, expanded: boolean) => void;
	readonly onLayoutChange?: () => void;
}

/**
 * Honest summary row for a thinking/tool turn that is not inside a process-fold.
 * No fold chrome (`conversation-lens-turn-process` / chevron) — that path is a stub.
 */
export function renderStandaloneThinkingOrToolRow(
	container: HTMLElement,
	turn: ConversationStubTurn,
	options?: StandaloneToolRowOptions,
	disposables?: DisposableStore,
): void {
	const el = append(container, $('div.conversation-lens-turn'));
	el.setAttribute('data-kind', turn.kind);
	el.setAttribute('data-honest-kind', turn.kind);
	el.setAttribute('data-turn-id', turn.id);

	if (turn.toolName === 'file_edit') {
		const store = disposables ?? new DisposableStore();
		renderFileEditCard(el, [turn], {
			showToolInvocationDetails: true,
			isToolExpanded: options?.isToolExpanded,
			setToolExpanded: options?.setToolExpanded,
			onLayoutChange: options?.onLayoutChange,
			diffEditorPool: options?.diffEditorPool,
			instantiationService: options?.instantiationService,
		}, store);
		return;
	}

	const header = append(el, $('.conversation-lens-turn-header'));
	header.textContent = getConversationTurnRoleLabel(turn.kind);

	const body = append(el, $('.conversation-lens-turn-body.conversation-lens-turn-body--honest'));
	body.textContent = turn.summary ?? turn.text;
}

function renderReadOnlyTextRow(container: HTMLElement, turn: ConversationStubTurn, role: 'context' | 'neutral'): void {
	const el = append(container, $('div.conversation-lens-turn.conversation-lens-turn--readonly'));
	el.setAttribute('data-kind', role);
	el.setAttribute('data-readonly-text', role);
	el.setAttribute('data-turn-id', turn.id);
	const header = append(el, $('.conversation-lens-turn-header'));
	header.textContent = role === 'context' ? getTrajectoryKindLabel('context') : conversationLensTurnNeutral;
	const body = append(el, $('.conversation-lens-turn-body'));
	body.textContent = turn.text;
}

export function renderHonestTimelineRow(
	container: HTMLElement,
	turn: ConversationStubTurn,
	kind: 'error' | 'unknown' | 'system',
	disposables: DisposableStore,
	onRetryError?: (turn: ConversationStubTurn) => void,
	writesEnabled = true,
): void {
	const fields = getConversationHonestFields(turn);
	const el = append(container, $(`div.conversation-lens-turn.conversation-lens-turn--${kind}`));
	el.setAttribute('data-kind', kind);
	el.setAttribute('data-honest-kind', kind);
	el.setAttribute('data-turn-id', turn.id);
	el.tabIndex = 0;
	el.setAttribute('role', 'group');
	el.setAttribute('aria-label', getConversationEntryAriaLabel(turn));

	const header = append(el, $('.conversation-lens-turn-header'));
	header.textContent = getConversationTurnRoleLabel(kind);
	if (fields.agentId && fields.agentId !== 'default') {
		const identity = append(header, $('span.conversation-lens-turn-agent-identity'));
		identity.textContent = fields.agentId;
	}

	if (kind === 'error') {
		const status = append(header, $('span.conversation-lens-turn-honest-status'));
		status.textContent = fields.retryable
			? localize('conversationLens.errorRetryableBadge', "Retryable")
			: localize('conversationLens.errorNotRetryableBadge', "Not retryable");
		if (fields.retryable === true && onRetryError) {
			const retryHost = append(header, $('span.conversation-lens-turn-error-retry'));
			const retry = disposables.add(new Button(retryHost, {
				...defaultButtonStyles,
				small: true,
				secondary: true,
				title: conversationLensErrorRetry,
				ariaLabel: conversationLensErrorRetry,
			}));
			retry.label = conversationLensErrorRetry;
			retry.enabled = writesEnabled;
			disposables.add(retry.onDidClick(() => onRetryError(turn)));
		}
	} else if (kind === 'unknown') {
		const status = append(header, $('span.conversation-lens-turn-honest-status'));
		status.textContent = fields.typeName || fields.rawContent || localize('conversationLens.unknownTypeBadge', "Unknown type");
	}

	const body = append(el, $('.conversation-lens-turn-body.conversation-lens-turn-body--honest'));
	if (kind === 'error') {
		const { summary, detail } = summarizeConversationError(turn.text);
		const summaryEl = append(body, $('div.conversation-lens-turn-error-summary'));
		summaryEl.textContent = summary;
		summaryEl.title = summary;
		if (detail) {
			const toggle = append(body, $('button.conversation-lens-turn-error-details-toggle')) as HTMLButtonElement;
			toggle.type = 'button';
			toggle.textContent = conversationErrorShowDetails;
			const details = append(body, $('div.conversation-lens-turn-error-details'));
			details.hidden = true;
			details.textContent = detail;
			disposables.add(addDisposableListener(toggle, 'click', (e) => {
				e.stopPropagation();
				const open = details.hidden;
				details.hidden = !open;
				toggle.textContent = open ? conversationErrorHideDetails : conversationErrorShowDetails;
				toggle.setAttribute('aria-expanded', String(open));
			}));
		}
	} else if (kind === 'unknown') {
		const raw = fields.rawContent ?? turn.text;
		if (raw.length > UNKNOWN_RAW_CONTENT_PREVIEW_MAX_CHARS) {
			body.textContent = raw.slice(0, UNKNOWN_RAW_CONTENT_PREVIEW_MAX_CHARS);
			const mark = append(body, $('span.conversation-lens-turn-unknown-truncated'));
			mark.textContent = localize('conversationLens.unknownContentTruncated', "… (truncated)");
		} else {
			body.textContent = raw;
		}
	} else {
		body.textContent = turn.text;
	}
}

export function appendTurnTrajectoryButton(
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

export class ConversationTimelineProcessFoldRenderer implements ITreeRenderer<ConversationTimelineItem, void, ITurnTemplateData> {

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
