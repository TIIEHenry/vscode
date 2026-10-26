/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import type { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { DiffEditorPool } from '../../chat/browser/widget/chatContentParts/chatContentCodePools.js';
import { MarkdownDiffBlockPart, parseUnifiedDiff, type IMarkdownDiffBlockData } from '../../chat/browser/widget/chatContentParts/chatDiffBlockPart.js';
import { conversationLensTurnViewInTrajectory } from './conversationLensSessionBarStrings.js';
import { conversationLensDockSendBusy } from './conversationLensDockStrings.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { ProcessFoldNode, ProcessFoldSpan, countProcessFoldToolStatuses, summarizeProcessStepParts, summarizeThinkingTools } from './conversationProcessFoldModel.js';

export const conversationProcessFoldThinkingLabel = localize('conversationProcessFold.thinking', "Thinking");
export const conversationProcessFoldToolCancel = localize('conversationProcessFold.toolCancel', "Cancel Tool");
export const conversationProcessFoldToolRespond = localize('conversationProcessFold.toolRespond', "Respond");
const conversationProcessFoldWritesUnavailable = localize('conversationLens.turnWritesUnavailable', "This session cannot be edited right now.");

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

const conversationProcessFoldCollapsedClass = 'conversation-process-fold--collapsed';
const conversationProcessFoldMotionClass = 'conversation-process-fold-motion';

/** Collapsed class on the panel and its grid wrapper. `hidden` would cancel the grid-row transition. */
function setProcessFoldCollapsed(panel: HTMLElement, collapsed: boolean): void {
	panel.classList.toggle(conversationProcessFoldCollapsedClass, collapsed);
	const motion = panel.parentElement;
	if (motion?.classList.contains(conversationProcessFoldMotionClass)) {
		motion.classList.toggle(conversationProcessFoldCollapsedClass, collapsed);
	}
}

function appendProcessFoldPanel(parent: HTMLElement, panelSelector: string): HTMLElement {
	const motion = append(parent, $('div.conversation-process-fold-motion'));
	return append(motion, $(panelSelector));
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
	/** Live executing tool row → AgentService.CancelToolCall (timeline). */
	readonly onCancelToolCall?: (turn: ConversationStubTurn) => void;
	/** Respondable client-tool row → roster `respondClientTool`. */
	readonly onRespondClientTool?: (turn: ConversationStubTurn) => void;
	/** Whether a client-tool response is waiting for the next snapshot. */
	readonly isRespondInFlight?: (turn: ConversationStubTurn) => boolean;
	readonly onLayoutChange: () => void;
	/** When false (stub fixture), omit loading / live / duration chrome (Q4). */
	readonly showLiveChrome: boolean;
	/** When false, Cancel stays painted but aria-disabled (D297 pairing-hold). */
	readonly writesEnabled?: boolean;
	/**
	 * When false, every tool row (including client-tool) shows only name + status.
	 * Payload body is not rendered and the row is not expandable.
	 */
	readonly showToolInvocationDetails?: boolean;
	readonly diffEditorPool?: DiffEditorPool;
	readonly instantiationService?: IInstantiationService;
}

export interface ProcessFoldSpanHandle {
	/** In-place update. Header summary text updates in the existing summary node. Children are keyed by turn id: append new, rebuild only the changed child (replace that child's root element), remove missing ones. Do not recreate the outer header button, the children scroll container, or the sticky breadcrumb element — scrollTop on the children container must survive update(). */
	update(span: ProcessFoldSpan): void;
	dispose(): void;
}

interface ToolRowEntry {
	readonly kind: 'tool';
	turn: ConversationStubTurn;
	readonly element: HTMLElement;
	readonly store: DisposableStore;
	readonly paint: (turn: ConversationStubTurn) => void;
}

interface FileCardEntry {
	readonly kind: 'files';
	turns: readonly ConversationStubTurn[];
	readonly element: HTMLElement;
	readonly store: DisposableStore;
}

interface ThinkingRowEntry {
	readonly kind: 'thinking';
	turn: ConversationStubTurn;
	tools: readonly ConversationStubTurn[];
	readonly element: HTMLElement;
	readonly store: DisposableStore;
	readonly header: HTMLElement;
	readonly summary: HTMLElement;
	readonly body: HTMLElement;
	readonly textNode: Text;
	readonly toolsHost: HTMLElement;
	readonly nested: Map<string, ToolRowEntry>;
	readonly paint: (turn: ConversationStubTurn) => void;
}

type FoldChildEntry = ThinkingRowEntry | ToolRowEntry | FileCardEntry;

type FoldRenderBlock =
	| { readonly kind: 'node'; readonly node: ProcessFoldNode }
	| { readonly kind: 'files'; readonly turns: readonly ConversationStubTurn[] };

function coalesceFileEditNodes(nodes: readonly ProcessFoldNode[]): FoldRenderBlock[] {
	const blocks: FoldRenderBlock[] = [];
	let files: ConversationStubTurn[] = [];
	const flush = () => {
		if (files.length > 0) {
			blocks.push({ kind: 'files', turns: files });
			files = [];
		}
	};
	for (const node of nodes) {
		if (node.kind === 'tool' && node.turn.toolName === 'file_edit') {
			files.push(node.turn);
		} else {
			flush();
			blocks.push({ kind: 'node', node });
		}
	}
	flush();
	return blocks;
}

function thinkingBodyText(turn: ConversationStubTurn): string {
	return turn.payload ?? turn.text;
}

function sameTurnRefs(left: readonly ConversationStubTurn[], right: readonly ConversationStubTurn[]): boolean {
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}

function resolveProcessFoldHeaderIcon(span: ProcessFoldSpan, showLiveChrome: boolean): ThemeIcon | undefined {
	const counts = countProcessFoldToolStatuses(span);
	if (showLiveChrome && counts.executing > 0) {
		return Codicon.loading;
	}
	if (counts.failed > 0) {
		return Codicon.error;
	}
	if (counts.cancelled > 0) {
		return Codicon.circleSlash;
	}
	return undefined;
}

function orderElementsAfter(parent: HTMLElement, anchor: Node | null, elements: readonly HTMLElement[]): void {
	let prev: Node | null = anchor;
	for (const element of elements) {
		const next = prev ? prev.nextSibling : parent.firstChild;
		if (next !== element) {
			parent.insertBefore(element, next);
		}
		prev = element;
	}
}

/**
 * Renders ADR-046 process-fold chrome for one span overlay (conversation default collapsed).
 * Child rows are created when the fold is painted open. Live execution paints open without writing the stored maps.
 * `update` keeps the header, scroll container, and sticky breadcrumb.
 */
export function renderProcessFoldSpan(
	container: HTMLElement,
	span: ProcessFoldSpan,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): ProcessFoldSpanHandle {
	let current = span;
	const root = append(container, $('div.conversation-process-fold'));
	root.setAttribute('data-process-fold', '');
	root.dataset.foldId = span.id;

	const header = append(root, $('button.conversation-process-fold-header')) as HTMLButtonElement;
	header.type = 'button';
	header.setAttribute('role', 'button');

	const chevron = append(header, $('span.conversation-process-fold-chevron.ua-motion'));
	chevron.setAttribute('aria-hidden', 'true');
	chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));

	let statusIcon: HTMLElement | undefined;
	const summary = append(header, $('span.conversation-process-fold-summary'));
	const statuses = append(header, $('span.conversation-process-fold-statuses'));
	let summaryText = '';
	const children = appendProcessFoldPanel(root, 'div.conversation-process-fold-children');
	const stickyBreadcrumb = append(children, $('div.conversation-process-fold-sticky-breadcrumb'));
	stickyBreadcrumb.hidden = true;
	const stickySummary = append(stickyBreadcrumb, $('span.conversation-process-fold-sticky-summary'));
	const mounted = new Map<string, FoldChildEntry>();

	function outerPaintedOpen(): boolean {
		return processFoldSpanHasExecutingTurn(current, options) || options.isOuterExpanded(current.id);
	}

	function syncSticky(): void {
		if (!outerPaintedOpen()) {
			stickyBreadcrumb.hidden = true;
			return;
		}
		const overflow = children.scrollHeight > children.clientHeight + 4;
		const scrolled = children.scrollTop > 0;
		stickyBreadcrumb.hidden = !overflow || !scrolled;
		if (overflow && scrolled) {
			stickySummary.textContent = summaryText;
		}
	}

	const childOptions: ProcessFoldDomOptions = {
		...options,
		onLayoutChange: () => {
			syncSticky();
			options.onLayoutChange();
		},
	};

	function applyOuterExpanded(expanded: boolean): void {
		header.setAttribute('aria-expanded', String(expanded));
		if (processFoldSpanHasExecutingTurn(current, options)) {
			header.setAttribute('aria-disabled', 'true');
		} else {
			header.removeAttribute('aria-disabled');
		}
		syncProcessFoldOuterAria(header, summaryText, expanded);
		setProcessFoldCollapsed(children, !expanded);
		chevron.classList.toggle('conversation-process-fold-chevron--expanded', expanded);
	}

	function syncFoldStatusIcon(next: ProcessFoldSpan): void {
		const icon = resolveProcessFoldHeaderIcon(next, options.showLiveChrome);
		const loading = icon === Codicon.loading;
		const failed = icon === Codicon.error;
		if (statusIcon) {
			const same = (loading && statusIcon.classList.contains('codicon-loading'))
				|| (failed && statusIcon.classList.contains('codicon-error'))
				|| (icon === Codicon.circleSlash && statusIcon.classList.contains('codicon-circle-slash'));
			if (same) {
				return;
			}
			statusIcon.remove();
			statusIcon = undefined;
		}
		if (!icon) {
			return;
		}
		const glyph = renderIcon(icon);
		glyph.classList.add('conversation-process-fold-status', 'ua-motion');
		if (loading) {
			glyph.classList.add('conversation-process-fold-status--loading');
		} else if (failed) {
			glyph.classList.add('conversation-process-fold-status--error');
		}
		glyph.setAttribute('aria-hidden', 'true');
		chevron.insertAdjacentElement('afterend', glyph);
		statusIcon = glyph;
	}

	function syncFoldSummary(next: ProcessFoldSpan): void {
		const parts = summarizeProcessStepParts(next, { showLiveChrome: options.showLiveChrome });
		summary.textContent = parts.steps;
		statuses.replaceChildren(...parts.statuses.map(text => {
			const count = $('span.conversation-process-fold-status-count');
			count.textContent = text;
			return count;
		}));
		statuses.hidden = parts.statuses.length === 0;
		summaryText = [parts.steps, ...parts.statuses].join(' · ');
	}

	function syncFoldExecuting(next: ProcessFoldSpan): void {
		const executing = countProcessFoldToolStatuses(next).executing > 0;
		if (options.showLiveChrome && executing) {
			children.setAttribute('data-fold-executing', '');
		} else {
			children.removeAttribute('data-fold-executing');
		}
		syncFoldStatusIcon(next);
	}

	function mountTool(turn: ConversationStubTurn, nested: boolean, parent: HTMLElement, owner: DisposableStore): ToolRowEntry {
		const store = owner.add(new DisposableStore());
		const rendered = renderToolRow(parent, turn, nested, childOptions, store);
		return { kind: 'tool', turn, element: rendered.element, store, paint: rendered.paint };
	}

	function reconcileToolRows(parent: HTMLElement, turns: readonly ConversationStubTurn[], nested: boolean, owner: DisposableStore, mountedTools: Map<string, ToolRowEntry>): void {
		const keep = new Set<string>();
		const ordered: HTMLElement[] = [];
		for (const turn of turns) {
			const id = turn.id;
			if (keep.has(id)) {
				continue;
			}
			keep.add(id);
			let entry = mountedTools.get(id);
			if (!entry) {
				entry = mountTool(turn, nested, parent, owner);
				mountedTools.set(id, entry);
			} else if (entry.turn !== turn) {
				const fresh = mountTool(turn, nested, parent, owner);
				entry.element.replaceWith(fresh.element);
				owner.delete(entry.store);
				entry = fresh;
				mountedTools.set(id, entry);
			} else {
				entry.paint(turn);
			}
			ordered.push(entry.element);
		}
		for (const [id, entry] of [...mountedTools]) {
			if (!keep.has(id)) {
				entry.element.remove();
				owner.delete(entry.store);
				mountedTools.delete(id);
			}
		}
		orderElementsAfter(parent, null, ordered);
	}

	function syncThinkingRowChrome(entry: ThinkingRowEntry, node: Extract<ProcessFoldNode, { kind: 'thinking' }>): void {
		const summaryText = formatThinkingSummary(node.turn, node.tools, options);
		if (entry.summary.textContent !== summaryText) {
			entry.summary.textContent = summaryText;
		}
		entry.paint(node.turn);
	}

	function patchThinking(entry: ThinkingRowEntry, node: Extract<ProcessFoldNode, { kind: 'thinking' }>): boolean {
		if (entry.turn !== node.turn) {
			const nextText = thinkingBodyText(node.turn);
			const previousText = entry.textNode.data;
			if (!nextText.startsWith(previousText)) {
				return false;
			}
			if (nextText.length > previousText.length) {
				entry.textNode.appendData(nextText.slice(previousText.length));
			}
		}
		const summaryText = formatThinkingSummary(node.turn, node.tools, options);
		if (entry.summary.textContent !== summaryText) {
			entry.summary.textContent = summaryText;
		}
		entry.paint(node.turn);
		reconcileToolRows(entry.toolsHost, node.tools, true, entry.store, entry.nested);
		return true;
	}

	function mountThinking(node: Extract<ProcessFoldNode, { kind: 'thinking' }>): ThinkingRowEntry {
		const store = disposables.add(new DisposableStore());
		const chrome = renderThinkingNode(children, node, childOptions, store);
		const entry: ThinkingRowEntry = {
			kind: 'thinking',
			turn: node.turn,
			tools: node.tools,
			element: chrome.element,
			store,
			header: chrome.header,
			summary: chrome.summary,
			body: chrome.body,
			textNode: chrome.textNode,
			toolsHost: chrome.toolsHost,
			nested: new Map(),
			paint: chrome.paint,
		};
		reconcileToolRows(entry.toolsHost, node.tools, true, entry.store, entry.nested);
		return entry;
	}

	function dropChild(entry: FoldChildEntry): void {
		entry.element.remove();
		disposables.delete(entry.store);
	}

	function mountFileCard(turns: readonly ConversationStubTurn[]): FileCardEntry {
		const store = disposables.add(new DisposableStore());
		const element = renderFileEditCard(children, turns, childOptions, store);
		return { kind: 'files', turns, element, store };
	}

	function reconcileTop(): void {
		const keep = new Set<string>();
		const ordered: HTMLElement[] = [];
		for (const block of coalesceFileEditNodes(current.nodes)) {
			if (block.kind === 'files') {
				const id = `files:${block.turns.map(turn => turn.id).join('\n')}`;
				if (keep.has(id)) {
					continue;
				}
				keep.add(id);
				let entry = mounted.get(id);
				if (!entry || entry.kind !== 'files' || !sameTurnRefs(entry.turns, block.turns)) {
					if (entry) {
						dropChild(entry);
						mounted.delete(id);
					}
					entry = mountFileCard(block.turns);
					mounted.set(id, entry);
				}
				ordered.push(entry.element);
				continue;
			}
			const node = block.node;
			const id = node.turn.id;
			if (keep.has(id)) {
				continue;
			}
			keep.add(id);
			let entry = mounted.get(id);
			if (!entry || entry.kind !== node.kind) {
				if (entry) {
					dropChild(entry);
					mounted.delete(id);
				}
				entry = node.kind === 'thinking' ? mountThinking(node) : mountTool(node.turn, false, children, disposables);
				mounted.set(id, entry);
			} else if (entry.kind === 'thinking' && node.kind === 'thinking') {
				if (entry.turn !== node.turn || !sameTurnRefs(entry.tools, node.tools)) {
					if (patchThinking(entry, node)) {
						entry.turn = node.turn;
						entry.tools = node.tools;
					} else {
						const fresh = mountThinking(node);
						entry.element.replaceWith(fresh.element);
						disposables.delete(entry.store);
						entry = fresh;
						mounted.set(id, entry);
					}
				} else {
					syncThinkingRowChrome(entry, node);
				}
			} else if (entry.kind === 'tool' && node.kind === 'tool') {
				if (entry.turn !== node.turn) {
					const fresh = mountTool(node.turn, false, children, disposables);
					entry.element.replaceWith(fresh.element);
					disposables.delete(entry.store);
					entry = fresh;
					mounted.set(id, entry);
				} else {
					entry.paint(node.turn);
				}
			}
			ordered.push(entry.element);
		}
		for (const [id, entry] of [...mounted]) {
			if (!keep.has(id)) {
				dropChild(entry);
				mounted.delete(id);
			}
		}
		orderElementsAfter(children, stickyBreadcrumb, ordered);
	}

	function update(next: ProcessFoldSpan): void {
		if (disposables.isDisposed) {
			return;
		}
		current = next;
		root.dataset.foldId = next.id;
		syncFoldSummary(next);
		const open = outerPaintedOpen();
		applyOuterExpanded(open);
		syncFoldExecuting(next);
		if (!open) {
			stickyBreadcrumb.hidden = true;
			if (mounted.size > 0) {
				reconcileTop();
			}
			return;
		}
		reconcileTop();
		syncSticky();
	}

	syncFoldSummary(current);
	applyOuterExpanded(outerPaintedOpen());
	syncFoldExecuting(current);
	if (outerPaintedOpen()) {
		reconcileTop();
	}

	disposables.add(addDisposableListener(children, 'scroll', () => syncSticky()));
	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
		if (processFoldSpanHasExecutingTurn(current, options)) {
			return;
		}
		const next = !options.isOuterExpanded(current.id);
		options.setOuterExpanded(current.id, next);
		applyOuterExpanded(next);
		if (next) {
			reconcileTop();
		}
		syncSticky();
		options.onLayoutChange();
	}));

	syncSticky();

	return {
		update,
		dispose(): void {
			// Caller owns `disposables`. Row stores are registered there and dropped on replace.
		},
	};
}

interface ThinkingNodeChrome {
	readonly element: HTMLElement;
	readonly header: HTMLElement;
	readonly summary: HTMLElement;
	readonly body: HTMLElement;
	readonly textNode: Text;
	readonly toolsHost: HTMLElement;
	readonly paint: (turn: ConversationStubTurn) => void;
}

function renderThinkingNode(
	parent: HTMLElement,
	node: Extract<ProcessFoldNode, { kind: 'thinking' }>,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): ThinkingNodeChrome {
	const turn = node.turn;
	let liveTurn = turn;

	const thinking = append(parent, $('div.conversation-process-fold-thinking'));
	thinking.setAttribute('data-turn-id', turn.id);
	thinking.setAttribute('data-kind', turn.kind);

	const line = append(thinking, $('div.conversation-process-fold-thinking-line'));
	const header = append(line, $('button.conversation-process-fold-thinking-header')) as HTMLButtonElement;
	header.type = 'button';
	header.setAttribute('role', 'button');

	const label = append(header, $('span.conversation-process-fold-thinking-label'));
	label.textContent = conversationProcessFoldThinkingLabel;

	const summary = append(header, $('span.conversation-process-fold-thinking-summary'));
	summary.textContent = formatThinkingSummary(turn, node.tools, options);

	appendProcessFoldTrajectoryJump(line, turn.id, options, disposables);

	const body = appendProcessFoldPanel(thinking, 'div.conversation-process-fold-thinking-body');
	const textNode = body.ownerDocument.createTextNode(thinkingBodyText(turn));
	body.appendChild(textNode);

	const tools = append(thinking, $('div.conversation-process-fold-thinking-tools'));

	const paint = (next: ConversationStubTurn) => {
		liveTurn = next;
		const locked = isExecutingTurn(next, options);
		const open = locked || options.isThinkingExpanded(next.id);
		header.setAttribute('aria-expanded', String(open));
		if (locked) {
			header.setAttribute('aria-disabled', 'true');
		} else {
			header.removeAttribute('aria-disabled');
		}
		syncProcessFoldThinkingAria(header, summary.textContent ?? '', open);
		setProcessFoldCollapsed(body, !open);
		tools.hidden = !open;
		body.classList.toggle('conversation-process-fold-body--executing', locked);
	};
	paint(turn);

	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
		if (isExecutingTurn(liveTurn, options)) {
			return;
		}
		const next = !options.isThinkingExpanded(liveTurn.id);
		options.setThinkingExpanded(liveTurn.id, next);
		paint(liveTurn);
		options.onLayoutChange();
	}));

	return { element: thinking, header, summary, body, textNode, toolsHost: tools, paint };
}

function getLanguageIdFromFilepath(filepath: string): string {
	if (!filepath) {
		return 'plaintext';
	}
	const ext = filepath.split('.').pop()?.toLowerCase();
	switch (ext) {
		case 'ts':
		case 'tsx':
			return 'typescript';
		case 'js':
		case 'jsx':
			return 'javascript';
		case 'json':
			return 'json';
		case 'py':
			return 'python';
		case 'md':
			return 'markdown';
		case 'html':
			return 'html';
		case 'css':
			return 'css';
		case 'sh':
		case 'bash':
			return 'shellscript';
		default:
			return 'plaintext';
	}
}

export function formatProcessFoldDiffStats(metadata: Record<string, unknown> | undefined, diffText?: string): string | undefined {
	if (!metadata) {
		return undefined;
	}
	const filediff = typeof metadata.filediff === 'object' && metadata.filediff !== null
		? (metadata.filediff as Record<string, unknown>)
		: undefined;
	let additions = typeof filediff?.additions === 'number'
		? filediff.additions
		: typeof metadata.additions === 'number'
			? metadata.additions
			: undefined;
	let deletions = typeof filediff?.deletions === 'number'
		? filediff.deletions
		: typeof metadata.deletions === 'number'
			? metadata.deletions
			: undefined;

	if (additions === undefined && deletions === undefined && diffText) {
		let a = 0;
		let d = 0;
		for (const line of diffText.split('\n')) {
			if (line.startsWith('+++') || line.startsWith('---')) {
				continue;
			}
			if (line.startsWith('+')) {
				a++;
			} else if (line.startsWith('-')) {
				d++;
			}
		}
		additions = a;
		deletions = d;
	}

	if (additions !== undefined || deletions !== undefined) {
		return `+${additions ?? 0} \u2212${deletions ?? 0}`;
	}
	return undefined;
}

/** Paint `+N −M` so only the counts take color. Parent textContent stays the same string. Zero counts omit color classes (V8). */
export function fillProcessFoldDiffStats(el: HTMLElement, text: string): void {
	const match = /^\+(\d+) \u2212(\d+)$/.exec(text);
	el.replaceChildren();
	if (!match) {
		el.textContent = text;
		return;
	}
	const addCount = Number(match[1]);
	const delCount = Number(match[2]);

	const added = append(el, $(addCount > 0 ? 'span.conversation-diff-stat-add' : 'span'));
	added.textContent = `+${match[1]}`;
	el.appendChild(document.createTextNode(' '));
	const removed = append(el, $(delCount > 0 ? 'span.conversation-diff-stat-del' : 'span'));
	removed.textContent = `\u2212${match[2]}`;
}

export function renderProcessFoldDiffBlock(
	container: HTMLElement,
	diffText: string,
	filediff: Record<string, unknown> | undefined,
	options: { readonly diffEditorPool?: DiffEditorPool; readonly instantiationService?: IInstantiationService },
	disposables: DisposableStore,
): void {
	const { before, after } = parseUnifiedDiff(diffText);
	const filepath = typeof filediff?.file === 'string' ? filediff.file : '';
	const languageId = getLanguageIdFromFilepath(filepath);

	if (options.diffEditorPool && options.instantiationService) {
		try {
			class DiffElementStub {
				setVote(): void { }
			}
			const dummyElement = new DiffElementStub() as unknown as IMarkdownDiffBlockData['element'];
			const diffData: IMarkdownDiffBlockData = {
				element: dummyElement,
				codeBlockIndex: 0,
				languageId,
				beforeContent: before,
				afterContent: after,
				codeBlockResource: filepath ? URI.file(filepath) : undefined,
				isReadOnly: true,
			};
			const diffPart = options.instantiationService.createInstance(
				MarkdownDiffBlockPart,
				diffData,
				options.diffEditorPool,
				container.clientWidth || 400,
			);
			disposables.add(diffPart);
			container.appendChild(diffPart.element);
			return;
		} catch {
			// Fallback to pre if editor instantiation fails
		}
	}

	const pre = append(container, $('pre.conversation-diff-fallback'));
	pre.textContent = diffText;
}

export interface FileEditCardOptions {
	readonly showToolInvocationDetails?: boolean;
	readonly isToolExpanded?: (turnId: string) => boolean;
	readonly setToolExpanded?: (turnId: string, expanded: boolean) => void;
	readonly onLayoutChange?: () => void;
	readonly showLiveChrome?: boolean;
	readonly onCancelToolCall?: (turn: ConversationStubTurn) => void;
	readonly writesEnabled?: boolean;
	readonly onViewInTrajectory?: (turnId: string) => void;
	readonly diffEditorPool?: DiffEditorPool;
	readonly instantiationService?: IInstantiationService;
}

const conversationEditedOneFile = localize('conversation.editedOneFile', "Edited 1 file");
const conversationEditedFileUnnamed = localize('conversation.editedFileUnnamed', "File");

function fileEditFilediff(turn: ConversationStubTurn): Record<string, unknown> | undefined {
	const filediff = turn.metadata?.filediff;
	if (typeof filediff === 'object' && filediff !== null) {
		return filediff as Record<string, unknown>;
	}
	return undefined;
}

function fileEditDisplayPath(turn: ConversationStubTurn): string {
	const filediff = fileEditFilediff(turn);
	if (typeof filediff?.file === 'string' && filediff.file.length > 0) {
		return filediff.file;
	}
	const file = turn.metadata?.file;
	if (typeof file === 'string' && file.length > 0) {
		return file;
	}
	const summary = (turn.summary ?? turn.text).trim();
	return summary || conversationEditedFileUnnamed;
}

function fileEditDiffText(turn: ConversationStubTurn): string | undefined {
	const diff = turn.metadata?.diff;
	return typeof diff === 'string' && diff.length > 0 ? diff : undefined;
}

/** One card for a run of file edits: title, summed +N −M, then each path. */
export function renderFileEditCard(
	parent: HTMLElement,
	turns: readonly ConversationStubTurn[],
	options: FileEditCardOptions,
	disposables: DisposableStore,
): HTMLElement {
	const showDetails = options.showToolInvocationDetails !== false;
	const card = append(parent, $('div.conversation-file-edit-card'));
	card.setAttribute('data-kind', 'file-edits');
	if (turns.length === 1) {
		card.setAttribute('data-turn-id', turns[0]!.id);
	}

	const head = append(card, $('div.conversation-file-edit-head'));
	const icon = append(head, $('span.conversation-file-edit-icon'));
	icon.setAttribute('aria-hidden', 'true');
	icon.appendChild(renderIcon(Codicon.file));
	const title = append(head, $('span.conversation-file-edit-title'));
	title.textContent = turns.length === 1
		? conversationEditedOneFile
		: localize('conversation.editedFilesCount', "Edited {0} files", turns.length);

	let additions = 0;
	let deletions = 0;
	let sawStats = false;
	for (const turn of turns) {
		const stats = formatProcessFoldDiffStats(turn.metadata, fileEditDiffText(turn));
		const match = stats ? /^\+(\d+) \u2212(\d+)$/.exec(stats) : undefined;
		if (match) {
			sawStats = true;
			additions += Number(match[1]);
			deletions += Number(match[2]);
		}
	}
	if (showDetails && sawStats) {
		const diffStats = append(head, $('span.conversation-file-edit-stats'));
		fillProcessFoldDiffStats(diffStats, `+${additions} \u2212${deletions}`);
	}
	appendProcessFoldTrajectoryJump(head, turns[0]!.id, options, disposables);

	for (const turn of turns) {
		const diffText = fileEditDiffText(turn);
		const canOpen = showDetails && !!diffText;
		const line = append(card, $('div.conversation-file-edit-line'));
		const path = canOpen
			? append(line, $('button.conversation-file-edit-path')) as HTMLButtonElement
			: append(line, $('div.conversation-file-edit-path'));
		if (canOpen) {
			(path as HTMLButtonElement).type = 'button';
		} else {
			path.classList.add('is-static');
		}
		const label = fileEditDisplayPath(turn);
		path.textContent = label;
		path.title = label;
		const executing = isExecutingTurn(turn, { showLiveChrome: options.showLiveChrome === true });
		appendProcessFoldToolCancel(line, turn, executing, options, disposables);

		if (!canOpen) {
			continue;
		}
		const button = path as HTMLButtonElement;
		const diffArea = append(card, $('div.conversation-file-edit-diff'));
		let expanded = options.isToolExpanded?.(turn.id) ?? false;
		const filediff = fileEditFilediff(turn);
		const paint = (open: boolean) => {
			expanded = open;
			button.setAttribute('aria-expanded', String(open));
			diffArea.hidden = !open;
			if (open && !diffArea.hasChildNodes()) {
				renderProcessFoldDiffBlock(diffArea, diffText!, filediff, options, disposables);
			}
		};
		paint(expanded);
		disposables.add(addDisposableListener(button, 'click', (e) => {
			e.stopPropagation();
			const next = !expanded;
			options.setToolExpanded?.(turn.id, next);
			paint(next);
			options.onLayoutChange?.();
		}));
	}

	return card;
}

function renderToolRow(
	parent: HTMLElement,
	turn: ConversationStubTurn,
	nested: boolean,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): { readonly element: HTMLElement; readonly paint: (turn: ConversationStubTurn) => void } {
	const payload = turn.payload?.trim();
	const metadata = turn.metadata;
	const diffText = typeof metadata?.diff === 'string' && metadata.diff.length > 0 ? metadata.diff : undefined;
	const isFileEdit = turn.toolName === 'file_edit';
	const showDetails = options.showToolInvocationDetails !== false;
	const hasDiff = showDetails && isFileEdit && !!diffText;
	const hasPayload = showDetails && !!payload;
	const hasContent = hasPayload || hasDiff;
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
	if (isFileEdit) {
		row.classList.add('conversation-process-fold-tool--file');
	}
	if (turn.toolStatus === 'failed') {
		row.classList.add('conversation-process-fold-tool--failed');
	} else if (turn.toolStatus === 'cancelled') {
		row.classList.add('conversation-process-fold-tool--cancelled');
	}

	const line = append(row, $('div.conversation-process-fold-tool-line'));
	const header = append(line, hasContent
		? $('button.conversation-process-fold-tool-header') as HTMLButtonElement
		: $('div.conversation-process-fold-tool-header'));
	if (hasContent) {
		(header as HTMLButtonElement).type = 'button';
		header.setAttribute('role', 'button');
	}

	const name = append(header, $('span.conversation-process-fold-tool-name'));
	name.textContent = turn.toolName ?? turn.kind;

	const summary = append(header, $('span.conversation-process-fold-tool-summary'));
	summary.textContent = formatToolSummary(turn, options);

	// Diff counts are invocation detail. Details off keeps the name and summary only.
	const diffStatsText = showDetails && isFileEdit ? formatProcessFoldDiffStats(metadata, diffText) : undefined;
	if (diffStatsText) {
		const diffStats = append(header, $('span.conversation-process-fold-tool-diff-stats'));
		fillProcessFoldDiffStats(diffStats, diffStatsText);
	}

	const statusIcon = resolveToolStatusIcon(turn, options);
	if (statusIcon) {
		const icon = append(header, $('span.conversation-process-fold-tool-icon.ua-motion'));
		icon.setAttribute('aria-hidden', 'true');
		icon.appendChild(renderIcon(statusIcon));
	}

	const toolName = turn.toolName ?? turn.kind;
	// Invocation details off means name and status only. The split-out thought
	// is detail, not a status, so it stays hidden with the payload.
	const thinkingText = showDetails ? visibleToolThinkingText(turn) : '';
	const spokenDetail = toolAriaDetail(summary.textContent ?? '', thinkingText);
	if (!hasContent) {
		header.setAttribute('aria-label', localize('conversationProcessFold.toolHeaderStatic', "Tool {0}, {1}", toolName, spokenDetail));
	}

	appendProcessFoldToolCancel(line, turn, executing, options, disposables);
	appendProcessFoldToolRespond(line, turn, options, disposables);
	appendProcessFoldTrajectoryJump(line, turn.id, options, disposables);

	// Live tool blocks keep `:think:` chunks out of `text` (D10). The thought
	// stays under the title so collapsing the payload does not hide it.
	if (thinkingText) {
		const thought = append(row, $('div.conversation-process-fold-tool-thinking'));
		thought.textContent = thinkingText;
	}

	let liveTurn = turn;
	let paint: (next: ConversationStubTurn) => void;
	if (hasContent) {
		const body = appendProcessFoldPanel(row, 'div.conversation-process-fold-tool-body');
		const filediff = typeof metadata?.filediff === 'object' && metadata?.filediff !== null
			? (metadata.filediff as Record<string, unknown>)
			: undefined;

		if (hasPayload) {
			const payloadElem = append(body, $('div.conversation-process-fold-tool-payload'));
			payloadElem.textContent = payload!;
		}

		let diffArea: HTMLElement | undefined;
		if (hasDiff) {
			diffArea = append(body, $('div.conversation-process-fold-tool-diff'));
		}

		paint = (next: ConversationStubTurn) => {
			liveTurn = next;
			const locked = isExecutingTurn(next, options);
			const open = locked || options.isToolExpanded(next.id);
			row.classList.toggle('conversation-process-fold-tool--executing', locked);
			header.setAttribute('aria-expanded', String(open));
			if (locked) {
				header.setAttribute('aria-disabled', 'true');
			} else {
				header.removeAttribute('aria-disabled');
			}
			syncProcessFoldToolAria(header, toolName, toolAriaDetail(summary.textContent ?? '', thinkingText), open);
			setProcessFoldCollapsed(body, !open);
			body.classList.toggle('conversation-process-fold-body--executing', locked);
			if (open && hasDiff && diffArea && !diffArea.hasChildNodes()) {
				renderProcessFoldDiffBlock(diffArea, diffText!, filediff, options, disposables);
			}
		};

		disposables.add(addDisposableListener(header, 'click', (e) => {
			e.stopPropagation();
			if (isExecutingTurn(liveTurn, options)) {
				return;
			}
			const next = !options.isToolExpanded(liveTurn.id);
			options.setToolExpanded(liveTurn.id, next);
			paint(liveTurn);
			options.onLayoutChange();
		}));
	} else {
		paint = (next: ConversationStubTurn) => {
			liveTurn = next;
			row.classList.toggle('conversation-process-fold-tool--executing', isExecutingTurn(next, options));
		};
	}
	paint(turn);

	return { element: row, paint };
}

/** Non-empty `:think:` text carried beside a tool row. Whitespace-only is absent. */
function visibleToolThinkingText(turn: ConversationStubTurn): string {
	return turn.thinkingText?.trim() ?? '';
}

function toolAriaDetail(summaryText: string, thinkingText: string): string {
	if (!thinkingText) {
		return summaryText;
	}
	return summaryText
		? localize('conversationProcessFold.toolDetailWithThought', "{0}, {1}", summaryText, thinkingText)
		: thinkingText;
}

function formatThinkingSummary(turn: ConversationStubTurn, tools: readonly ConversationStubTurn[], options: ProcessFoldDomOptions): string {
	const base = summarizeThinkingTools(turn.text, tools);
	if (!options.showLiveChrome || !turn.streaming) {
		return base;
	}
	return localize('conversationProcessFold.thinkingLoading', "{0} · Loading", base);
}

function isExecutingTurn(turn: ConversationStubTurn, options: { readonly showLiveChrome: boolean }): boolean {
	if (!options.showLiveChrome) {
		return false;
	}
	return turn.toolStatus === 'pending' || turn.toolStatus === 'running' || !!turn.streaming;
}

function processFoldSpanHasExecutingTurn(span: ProcessFoldSpan, options: { readonly showLiveChrome: boolean }): boolean {
	for (const node of span.nodes) {
		if (isExecutingTurn(node.turn, options)) {
			return true;
		}
		if (node.kind === 'thinking') {
			for (const tool of node.tools) {
				if (isExecutingTurn(tool, options)) {
					return true;
				}
			}
		}
	}
	return false;
}

function resolveToolStatusIcon(turn: ConversationStubTurn, options: ProcessFoldDomOptions): ThemeIcon | undefined {
	switch (turn.toolStatus) {
		case 'pending':
		case 'running':
			// A disconnected fixture must not paint a live spinner, and a pending
			// write must not wear the completion check while permission is open.
			return options.showLiveChrome ? Codicon.loading : undefined;
		case 'failed':
			return Codicon.error;
		case 'cancelled':
			return Codicon.circleSlash;
		case 'completed':
			return Codicon.check;
		default:
			return undefined;
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

/** Non-empty exact tool_call_id. Blank and padded ids are absent, not trimmed. */
function admittedToolCallId(value: string | undefined): string | undefined {
	if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
		return undefined;
	}
	return value;
}

function appendProcessFoldToolCancel(
	parent: HTMLElement,
	turn: ConversationStubTurn,
	executing: boolean,
	options: { readonly onCancelToolCall?: (turn: ConversationStubTurn) => void; readonly writesEnabled?: boolean },
	disposables: DisposableStore,
): void {
	const toolCallId = admittedToolCallId(turn.toolCallId);
	if (!executing || !options.onCancelToolCall || toolCallId === undefined) {
		return;
	}
	const writesEnabled = options.writesEnabled !== false;
	const cancel = append(parent, $('button.conversation-process-fold-tool-cancel')) as HTMLButtonElement;
	cancel.type = 'button';
	cancel.classList.add(...ThemeIcon.asClassNameArray(Codicon.debugStop));
	cancel.title = writesEnabled ? conversationProcessFoldToolCancel : conversationProcessFoldWritesUnavailable;
	cancel.setAttribute('aria-label', writesEnabled ? conversationProcessFoldToolCancel : `${conversationProcessFoldToolCancel}. ${conversationProcessFoldWritesUnavailable}`);
	cancel.setAttribute('data-tool-call-id', toolCallId);
	cancel.disabled = !writesEnabled;
	cancel.setAttribute('aria-disabled', String(!writesEnabled));
	disposables.add(addDisposableListener(cancel, 'click', (e) => {
		e.stopPropagation();
		if (!writesEnabled) {
			return;
		}
		options.onCancelToolCall!(turn);
	}));
}

function appendProcessFoldToolRespond(
	parent: HTMLElement,
	turn: ConversationStubTurn,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): void {
	if (turn.respondable !== true || !turn.id.trim()) {
		return;
	}
	const writesEnabled = options.writesEnabled !== false;
	const responseInFlight = turn.responseState?.inFlight === true || (options.isRespondInFlight?.(turn) === true && turn.respondFailure === undefined);
	const respondFailure = turn.respondFailure;
	if (respondFailure) {
		const failure = append(parent, $('span.conversation-process-fold-tool-respond-failure'));
		failure.textContent = localize('conversationProcessFold.toolRespondFailed', "Couldn't send this response: {0}", respondFailure.error);
		failure.setAttribute('role', 'alert');
	}
	const toolStillOpen = turn.toolStatus === undefined || turn.toolStatus === 'pending' || turn.toolStatus === 'running';
	if (!toolStillOpen || !options.onRespondClientTool || respondFailure?.retryable === false || turn.responseState?.blocked === true) {
		return;
	}
	const respond = append(parent, $('button.conversation-process-fold-tool-respond')) as HTMLButtonElement;
	respond.type = 'button';
	respond.classList.add(...ThemeIcon.asClassNameArray(Codicon.reply));
	const holdReason = responseInFlight ? conversationLensDockSendBusy : undefined;
	const presented = !writesEnabled
		? `${conversationProcessFoldToolRespond}. ${conversationProcessFoldWritesUnavailable}`
		: holdReason
			? `${conversationProcessFoldToolRespond}. ${holdReason}`
			: conversationProcessFoldToolRespond;
	respond.title = presented;
	respond.setAttribute('aria-label', presented);
	respond.disabled = !writesEnabled || responseInFlight;
	respond.setAttribute('aria-disabled', String(!writesEnabled || responseInFlight));
	if (responseInFlight) {
		respond.setAttribute('aria-busy', 'true');
		parent.setAttribute('aria-busy', 'true');
		parent.closest('.conversation-process-fold-tool')?.setAttribute('aria-busy', 'true');
	}
	disposables.add(addDisposableListener(respond, 'click', (e) => {
		e.stopPropagation();
		if (!writesEnabled || responseInFlight) {
			return;
		}
		options.onRespondClientTool!(turn);
	}));
}

function appendProcessFoldTrajectoryJump(
	parent: HTMLElement,
	turnId: string,
	options: { readonly onViewInTrajectory?: (turnId: string) => void },
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

