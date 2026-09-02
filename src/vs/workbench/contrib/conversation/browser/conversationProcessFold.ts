/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { conversationLensTurnViewInTrajectory } from './conversationLensSessionBarStrings.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { ProcessFoldNode, ProcessFoldSpan, summarizeProcessSteps } from './conversationProcessFoldModel.js';

export const conversationProcessFoldThinkingLabel = localize('conversationProcessFold.thinking', "Thinking");

function syncProcessFoldOuterAria(header: HTMLElement, summaryText: string, expanded: boolean): void {
	header.setAttribute('aria-label', expanded
		? localize('conversationProcessFold.outerHeaderExpanded', "Process steps, {0}, expanded", summaryText)
		: localize('conversationProcessFold.outerHeaderCollapsed', "Process steps, {0}, collapsed", summaryText));
}

function syncProcessFoldThinkingAria(header: HTMLElement, summaryText: string, expanded: boolean): void {
	header.setAttribute('aria-label', expanded
		? localize('conversationProcessFold.thinkingHeaderExpanded', "Thinking, {0}, expanded", summaryText)
		: localize('conversationProcessFold.thinkingHeaderCollapsed', "Thinking, {0}, collapsed", summaryText));
}

function syncProcessFoldToolAria(header: HTMLElement, toolName: string, summaryText: string, expanded: boolean): void {
	header.setAttribute('aria-label', expanded
		? localize('conversationProcessFold.toolHeaderExpanded', "Tool {0}, {1}, expanded", toolName, summaryText)
		: localize('conversationProcessFold.toolHeaderCollapsed', "Tool {0}, {1}, collapsed", toolName, summaryText));
}

export interface ProcessFoldDomOptions {
	readonly defaultOuterExpanded: boolean;
	readonly isOuterExpanded: (spanId: string) => boolean;
	readonly setOuterExpanded: (spanId: string, expanded: boolean) => void;
	readonly isThinkingExpanded: (turnId: string) => boolean;
	readonly setThinkingExpanded: (turnId: string, expanded: boolean) => void;
	readonly isToolExpanded: (turnId: string) => boolean;
	readonly setToolExpanded: (turnId: string, expanded: boolean) => void;
	readonly onViewInTrajectory?: (turnId: string) => void;
	readonly onLayoutChange: () => void;
	/** When false (stub fixture), omit loading / live / duration chrome (Q4). */
	readonly showLiveChrome: boolean;
	/**
	 * When false, every tool row (including client-tool) shows only name + status.
	 * Payload body is not rendered and the row is not expandable.
	 */
	readonly showToolInvocationDetails?: boolean;
}

/**
 * Renders ADR-046 process-fold chrome for one span overlay (conversation default collapsed).
 */
export function renderProcessFoldSpan(
	container: HTMLElement,
	span: ProcessFoldSpan,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): void {
	const root = append(container, $('div.conversation-process-fold'));
	root.setAttribute('data-process-fold', '');
	root.dataset.foldId = span.id;

	const outerExpanded = options.isOuterExpanded(span.id);

	const stickyBreadcrumb = append(root, $('div.conversation-process-fold-sticky-breadcrumb'));
	stickyBreadcrumb.hidden = true;
	const stickySummary = append(stickyBreadcrumb, $('span.conversation-process-fold-sticky-summary'));

	const header = append(root, $('button.conversation-process-fold-header')) as HTMLButtonElement;
	header.type = 'button';
	header.setAttribute('role', 'button');
	header.setAttribute('aria-expanded', String(outerExpanded));

	const chevron = append(header, $('span.conversation-process-fold-chevron.ua-motion'));
	chevron.setAttribute('aria-hidden', 'true');
	chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
	chevron.classList.toggle('conversation-process-fold-chevron--expanded', outerExpanded);

	const summary = append(header, $('span.conversation-process-fold-summary'));
	summary.textContent = summarizeProcessSteps(span, { showLiveChrome: options.showLiveChrome });
	syncProcessFoldOuterAria(header, summary.textContent ?? '', outerExpanded);

	const children = append(root, $('div.conversation-process-fold-children'));
	children.hidden = !outerExpanded;

	const syncSticky = (): void => {
		if (!options.isOuterExpanded(span.id)) {
			stickyBreadcrumb.hidden = true;
			return;
		}
		const overflow = children.scrollHeight > children.clientHeight + 4;
		stickyBreadcrumb.hidden = !overflow;
		if (overflow) {
			stickySummary.textContent = summary.textContent ?? '';
		}
	};

	const childOptions: ProcessFoldDomOptions = {
		...options,
		onLayoutChange: () => {
			syncSticky();
			options.onLayoutChange();
		},
	};

	for (const node of span.nodes) {
		if (node.kind === 'thinking') {
			renderThinkingNode(children, node, childOptions, disposables);
		} else {
			renderToolRow(children, node.turn, false, childOptions, disposables);
		}
	}

	disposables.add(addDisposableListener(children, 'scroll', () => syncSticky()));

	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
		const next = !options.isOuterExpanded(span.id);
		options.setOuterExpanded(span.id, next);
		header.setAttribute('aria-expanded', String(next));
		syncProcessFoldOuterAria(header, summary.textContent ?? '', next);
		children.hidden = !next;
		chevron.classList.toggle('conversation-process-fold-chevron--expanded', next);
		syncSticky();
		options.onLayoutChange();
	}));

	syncSticky();
}

function renderThinkingNode(
	parent: HTMLElement,
	node: Extract<ProcessFoldNode, { kind: 'thinking' }>,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): void {
	const turn = node.turn;
	const thinkingExpanded = options.isThinkingExpanded(turn.id);

	const thinking = append(parent, $('div.conversation-process-fold-thinking'));
	thinking.setAttribute('data-turn-id', turn.id);
	thinking.setAttribute('data-kind', turn.kind);

	const header = append(thinking, $('button.conversation-process-fold-thinking-header')) as HTMLButtonElement;
	header.type = 'button';
	header.setAttribute('role', 'button');
	header.setAttribute('aria-expanded', String(thinkingExpanded));

	const chevron = append(header, $('span.conversation-process-fold-chevron.ua-motion'));
	chevron.setAttribute('aria-hidden', 'true');
	chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
	chevron.classList.toggle('conversation-process-fold-chevron--expanded', thinkingExpanded);

	const label = append(header, $('span.conversation-process-fold-thinking-label'));
	label.textContent = conversationProcessFoldThinkingLabel;

	const summary = append(header, $('span.conversation-process-fold-thinking-summary'));
	summary.textContent = formatThinkingSummary(turn, options);
	syncProcessFoldThinkingAria(header, summary.textContent ?? '', thinkingExpanded);

	appendProcessFoldTrajectoryJump(thinking, turn.id, options, disposables);

	const body = append(thinking, $('div.conversation-process-fold-thinking-body'));
	body.hidden = !thinkingExpanded;
	body.textContent = turn.payload ?? turn.text;
	if (isExecutingTurn(turn, options)) {
		body.classList.add('conversation-process-fold-body--executing');
	}

	const tools = append(thinking, $('div.conversation-process-fold-thinking-tools'));
	tools.hidden = !thinkingExpanded;
	for (const toolTurn of node.tools) {
		renderToolRow(tools, toolTurn, true, options, disposables);
	}

	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
		const next = !options.isThinkingExpanded(turn.id);
		options.setThinkingExpanded(turn.id, next);
		header.setAttribute('aria-expanded', String(next));
		syncProcessFoldThinkingAria(header, summary.textContent ?? '', next);
		body.hidden = !next;
		tools.hidden = !next;
		chevron.classList.toggle('conversation-process-fold-chevron--expanded', next);
		options.onLayoutChange();
	}));
}

function renderToolRow(
	parent: HTMLElement,
	turn: ConversationStubTurn,
	nested: boolean,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): void {
	const payload = turn.payload?.trim();
	const showDetails = options.showToolInvocationDetails !== false;
	const hasPayload = showDetails && !!payload;
	const executing = isExecutingTurn(turn, options);

	const row = append(parent, $('div.conversation-process-fold-tool'));
	row.setAttribute('data-turn-id', turn.id);
	row.setAttribute('data-kind', turn.kind);
	if (nested) {
		row.classList.add('conversation-process-fold-tool--nested');
	}
	if (executing) {
		row.classList.add('conversation-process-fold-tool--executing');
	}

	const header = append(row, hasPayload
		? $('button.conversation-process-fold-tool-header') as HTMLButtonElement
		: $('div.conversation-process-fold-tool-header'));
	if (hasPayload) {
		(header as HTMLButtonElement).type = 'button';
		header.setAttribute('role', 'button');
	}

	const toolExpanded = hasPayload && options.isToolExpanded(turn.id);
	if (hasPayload) {
		header.setAttribute('aria-expanded', String(toolExpanded));
	}

	const chevron = append(header, $('span.conversation-process-fold-tool-chevron.ua-motion'));
	chevron.setAttribute('aria-hidden', 'true');
	if (hasPayload) {
		chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
		chevron.classList.toggle('conversation-process-fold-chevron--expanded', toolExpanded);
	} else {
		chevron.hidden = true;
	}

	const icon = append(header, $('span.conversation-process-fold-tool-icon.ua-motion'));
	icon.setAttribute('aria-hidden', 'true');
	icon.appendChild(renderIcon(resolveToolStatusIcon(turn, options)));

	const name = append(header, $('span.conversation-process-fold-tool-name'));
	name.textContent = turn.toolName ?? turn.kind;

	const summary = append(header, $('span.conversation-process-fold-tool-summary'));
	summary.textContent = formatToolSummary(turn, options);
	const toolName = turn.toolName ?? turn.kind;
	if (hasPayload) {
		syncProcessFoldToolAria(header, toolName, summary.textContent ?? '', toolExpanded);
	} else {
		header.setAttribute('aria-label', localize('conversationProcessFold.toolHeaderStatic', "Tool {0}, {1}", toolName, summary.textContent ?? ''));
	}

	appendProcessFoldTrajectoryJump(row, turn.id, options, disposables);

	if (hasPayload) {
		const body = append(row, $('div.conversation-process-fold-tool-body'));
		body.hidden = !toolExpanded;
		body.textContent = payload!;
		if (executing) {
			body.classList.add('conversation-process-fold-body--executing');
		}

		disposables.add(addDisposableListener(header, 'click', (e) => {
			e.stopPropagation();
			const next = !options.isToolExpanded(turn.id);
			options.setToolExpanded(turn.id, next);
			header.setAttribute('aria-expanded', String(next));
			syncProcessFoldToolAria(header, toolName, summary.textContent ?? '', next);
			body.hidden = !next;
			chevron.classList.toggle('conversation-process-fold-chevron--expanded', next);
			options.onLayoutChange();
		}));
	}
}

function formatThinkingSummary(turn: ConversationStubTurn, options: ProcessFoldDomOptions): string {
	const base = turn.text;
	if (!options.showLiveChrome || !turn.streaming) {
		return base;
	}
	return localize('conversationProcessFold.thinkingLoading', "{0} · Loading", base);
}

function isExecutingTurn(turn: ConversationStubTurn, options: ProcessFoldDomOptions): boolean {
	if (!options.showLiveChrome) {
		return false;
	}
	return turn.toolStatus === 'pending' || turn.toolStatus === 'running' || !!turn.streaming;
}

function resolveToolStatusIcon(turn: ConversationStubTurn, options: ProcessFoldDomOptions): ThemeIcon {
	if (!options.showLiveChrome) {
		return Codicon.check;
	}
	switch (turn.toolStatus) {
		case 'pending':
		case 'running':
			return Codicon.loading;
		case 'failed':
			return Codicon.error;
		case 'cancelled':
			return Codicon.circleSlash;
		case 'completed':
		default:
			return Codicon.check;
	}
}

function formatToolSummary(turn: ConversationStubTurn, options: ProcessFoldDomOptions): string {
	const base = turn.summary ?? turn.text;
	if (!options.showLiveChrome) {
		return base;
	}
	switch (turn.toolStatus) {
		case 'pending':
			return localize('conversationProcessFold.toolPending', "{0} · Pending", base);
		case 'running':
			return localize('conversationProcessFold.toolRunning', "{0} · Running", base);
		case 'failed':
			return localize('conversationProcessFold.toolFailed', "{0} · Failed", base);
		case 'cancelled':
			return localize('conversationProcessFold.toolCancelled', "{0} · Cancelled", base);
		case 'completed':
		default:
			return base;
	}
}

function appendProcessFoldTrajectoryJump(
	parent: HTMLElement,
	turnId: string,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): void {
	if (!options.onViewInTrajectory) {
		return;
	}
	const jump = append(parent, $('button.conversation-process-fold-trajectory-jump')) as HTMLButtonElement;
	jump.type = 'button';
	jump.classList.add(...ThemeIcon.asClassNameArray(Codicon.listTree));
	jump.title = conversationLensTurnViewInTrajectory;
	jump.setAttribute('aria-label', conversationLensTurnViewInTrajectory);
	disposables.add(addDisposableListener(jump, 'click', (e) => {
		e.stopPropagation();
		options.onViewInTrajectory!(turnId);
	}));
}
