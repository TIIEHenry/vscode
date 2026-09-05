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
import { renderProcessFoldSpan } from './conversationProcessFold.js';
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
import { getConversationTurnRoleLabel } from './conversationTrajectoryList.js';
import type { ConversationQuestionRespondAnswers } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import {
	shouldCollapseUserBubble,
	shouldScrollExpandedUserBubble,
} from './conversationUserBubbleCollapse.js';

export const conversationLensUserBubbleShowMore = localize('conversationLens.userBubbleShowMore', "Show more");
export const conversationLensUserBubbleShowLess = localize('conversationLens.userBubbleShowLess', "Show less");

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

export class ConversationTimelineRenderer implements ITreeRenderer<ConversationTimelineItem, void, ITurnTemplateData> {

	static readonly TEMPLATE_ID = 'conversationTimelineTurn';
	static readonly PROCESS_FOLD_TEMPLATE_ID = 'conversationTimelineProcessFold';

	readonly templateId = ConversationTimelineRenderer.TEMPLATE_ID;

	private readonly confirmationSeats = new Map<string, ConversationConfirmationSeat>();
	private readonly questionSeats = new Map<string, ConversationQuestionSeat>();
	private readonly userBubbleExpanded = new Map<string, boolean>();
	private readonly processFoldOuterExpanded = new Map<string, boolean>();
	private readonly processFoldThinkingExpanded = new Map<string, boolean>();
	private readonly processFoldToolExpanded = new Map<string, boolean>();
	private readonly visualizeExpanded = new Map<string, boolean>();

	constructor(
		private readonly contentAdapter: IConversationTurnContentAdapter,
		private readonly onResolveConfirmation: ((turnId: string, status: 'allowed' | 'skipped') => void) | undefined,
		private readonly onQuestionRespond: ((turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string) => void) | undefined,
		private readonly onCopyTurn: ((turnId: string, text: string) => void) | undefined,
		private readonly onDeleteTurn: ((turnId: string) => void) | undefined,
		private readonly onEditUserTurn: ((turnId: string) => void) | undefined,
		private readonly onViewInTrajectory: ((turnId: string) => void) | undefined,
		private readonly onCancelToolCall: ((turn: ConversationStubTurn) => void) | undefined,
		private readonly onReviewNavClick: ((paths: readonly string[]) => void) | undefined,
		private readonly getEditingTurnId: () => string | undefined,
		private readonly onOpenVisualizeFullscreen: ((source: string, title?: string) => void) | undefined,
		private readonly getMermaidExtensionInfo: () => ConversationMermaidExtensionInfo | undefined,
		private readonly showLiveChrome: () => boolean,
		private readonly showToolInvocationDetails: () => boolean,
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
				showLiveChrome: this.showLiveChrome(),
				showToolInvocationDetails: this.showToolInvocationDetails(),
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
				onLayoutChange: () => this.scheduleHeightUpdate(item, templateData.container),
			}, templateData.disposables);
			this.scheduleHeightUpdate(item, templateData.container);
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
			this.scheduleHeightUpdate(item, templateData.container);
			return;
		}

		const honestKind = getConversationHonestKind(turn);
		if (honestKind === 'question') {
			const fields = getConversationHonestFields(turn);
			const seat = templateData.disposables.add(new ConversationQuestionSeat({
				message: turn.text,
				status: turn.status ?? 'pending',
				questionItems: fields.questionItems,
				answerKeysValid: fields.answerKeysValid,
				questionRequestId: fields.questionRequestId,
				payload: turn.payload,
				agentId: fields.agentId,
				onRespond: turn.status !== 'allowed' && this.onQuestionRespond
					? (requestId, answers, customText) => this.onQuestionRespond!(turn.id, requestId, answers, customText)
					: undefined,
			}));
			seat.element.setAttribute('data-turn-id', turn.id);
			this.questionSeats.set(turn.id, seat);
			templateData.container.appendChild(seat.element);
			this.scheduleHeightUpdate(item, templateData.container);
			return;
		}
		if (honestKind === 'error' || honestKind === 'unknown' || honestKind === 'system') {
			renderHonestTimelineRow(templateData.container, turn, honestKind, templateData.disposables);
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
					this.visualizeExpanded.set(turnId, expanded);
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
			const visualizeRoot = templateData.container.querySelector('.conversation-visualize-card') as HTMLElement | null;
			visualizeRoot?.setAttribute('aria-label', getConversationEntryAriaLabel(turn));
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
			seat.element.classList.add('conversation-lens-turn', 'conversation-lens-turn--permission');
			seat.element.setAttribute('data-kind', turn.kind);
			seat.element.setAttribute('data-honest-kind', 'permission');
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
			if (turn.agentId && turn.agentId !== 'default') {
				const identity = append(header, $('span.conversation-lens-turn-agent-identity'));
				identity.textContent = turn.agentId;
			}

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

export function renderHonestTimelineRow(
	container: HTMLElement,
	turn: ConversationStubTurn,
	kind: 'error' | 'unknown' | 'system',
	_disposables: DisposableStore,
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
	} else if (kind === 'unknown') {
		const status = append(header, $('span.conversation-lens-turn-honest-status'));
		status.textContent = fields.typeName || fields.rawContent || localize('conversationLens.unknownTypeBadge', "Unknown type");
	}

	const body = append(el, $('.conversation-lens-turn-body.conversation-lens-turn-body--honest'));
	body.textContent = kind === 'unknown' ? (fields.rawContent ?? turn.text) : turn.text;
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
