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
import { ConversationStubTurn } from './conversationStubModel.js';
import { ProcessFoldNode, ProcessFoldSpan, summarizeProcessSteps, summarizeThinkingTools } from './conversationProcessFoldModel.js';

export const conversationProcessFoldThinkingLabel = localize('conversationProcessFold.thinking', "Thinking");
export const conversationProcessFoldToolCancel = localize('conversationProcessFold.toolCancel', "Cancel Tool");
export const conversationProcessFoldToolRespond = localize('conversationProcessFold.toolRespond', "Respond");

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
	/** Live executing tool row → AgentService.CancelToolCall (timeline). */
	readonly onCancelToolCall?: (turn: ConversationStubTurn) => void;
	/** Respondable client-tool row → roster `respondClientTool`. */
	readonly onRespondClientTool?: (turn: ConversationStubTurn) => void;
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
}

type FoldChildEntry = ThinkingRowEntry | ToolRowEntry;

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

function processFoldHasExecutingTool(span: ProcessFoldSpan): boolean {
	for (const node of span.nodes) {
		if (node.kind === 'tool') {
			if (node.turn.toolStatus === 'running' || node.turn.toolStatus === 'pending') {
				return true;
			}
			continue;
		}
		for (const tool of node.tools) {
			if (tool.toolStatus === 'running' || tool.toolStatus === 'pending') {
				return true;
			}
		}
	}
	return false;
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
 * Child rows are created on first expand. `update` keeps the header, scroll container, and sticky breadcrumb.
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

	const summary = append(header, $('span.conversation-process-fold-summary'));
	const children = append(root, $('div.conversation-process-fold-children'));
	children.hidden = !options.isOuterExpanded(span.id);
	const stickyBreadcrumb = append(children, $('div.conversation-process-fold-sticky-breadcrumb'));
	stickyBreadcrumb.hidden = true;
	const stickySummary = append(stickyBreadcrumb, $('span.conversation-process-fold-sticky-summary'));
	const mounted = new Map<string, FoldChildEntry>();

	function syncSticky(): void {
		if (!options.isOuterExpanded(current.id)) {
			stickyBreadcrumb.hidden = true;
			return;
		}
		const overflow = children.scrollHeight > children.clientHeight + 4;
		const scrolled = children.scrollTop > 0;
		stickyBreadcrumb.hidden = !overflow || !scrolled;
		if (overflow && scrolled) {
			stickySummary.textContent = summary.textContent ?? '';
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
		syncProcessFoldOuterAria(header, summary.textContent ?? '', expanded);
		children.hidden = !expanded;
		chevron.classList.toggle('conversation-process-fold-chevron--expanded', expanded);
	}

	function syncFoldExecuting(next: ProcessFoldSpan): void {
		if (options.showLiveChrome && processFoldHasExecutingTool(next)) {
			children.setAttribute('data-fold-executing', '');
		} else {
			children.removeAttribute('data-fold-executing');
		}
	}

	function mountTool(turn: ConversationStubTurn, nested: boolean, parent: HTMLElement, owner: DisposableStore): ToolRowEntry {
		const store = owner.add(new DisposableStore());
		const element = renderToolRow(parent, turn, nested, childOptions, store);
		return { kind: 'tool', turn, element, store };
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
			entry.body.classList.toggle('conversation-process-fold-body--executing', isExecutingTurn(node.turn, options));
		}
		const summaryText = formatThinkingSummary(node.turn, node.tools, options);
		if (entry.summary.textContent !== summaryText) {
			entry.summary.textContent = summaryText;
			const expanded = entry.header.getAttribute('aria-expanded') === 'true';
			syncProcessFoldThinkingAria(entry.header, summaryText, expanded);
		}
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
		};
		reconcileToolRows(entry.toolsHost, node.tools, true, entry.store, entry.nested);
		return entry;
	}

	function dropChild(entry: FoldChildEntry): void {
		entry.element.remove();
		disposables.delete(entry.store);
	}

	function reconcileTop(): void {
		const keep = new Set<string>();
		const ordered: HTMLElement[] = [];
		for (const node of current.nodes) {
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
				}
			} else if (entry.kind === 'tool' && entry.turn !== node.turn) {
				const fresh = mountTool(node.turn, false, children, disposables);
				entry.element.replaceWith(fresh.element);
				disposables.delete(entry.store);
				entry = fresh;
				mounted.set(id, entry);
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
		summary.textContent = summarizeProcessSteps(next, { showLiveChrome: options.showLiveChrome });
		const expanded = options.isOuterExpanded(next.id);
		applyOuterExpanded(expanded);
		syncFoldExecuting(next);
		if (!expanded) {
			stickyBreadcrumb.hidden = true;
			return;
		}
		reconcileTop();
		syncSticky();
	}

	summary.textContent = summarizeProcessSteps(current, { showLiveChrome: options.showLiveChrome });
	applyOuterExpanded(options.isOuterExpanded(current.id));
	syncFoldExecuting(current);
	if (options.isOuterExpanded(current.id)) {
		reconcileTop();
	}

	disposables.add(addDisposableListener(children, 'scroll', () => syncSticky()));
	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
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
}

function renderThinkingNode(
	parent: HTMLElement,
	node: Extract<ProcessFoldNode, { kind: 'thinking' }>,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): ThinkingNodeChrome {
	const turn = node.turn;
	const thinkingExpanded = options.isThinkingExpanded(turn.id);

	const thinking = append(parent, $('div.conversation-process-fold-thinking'));
	thinking.setAttribute('data-turn-id', turn.id);
	thinking.setAttribute('data-kind', turn.kind);

	const line = append(thinking, $('div.conversation-process-fold-thinking-line'));
	const header = append(line, $('button.conversation-process-fold-thinking-header')) as HTMLButtonElement;
	header.type = 'button';
	header.setAttribute('role', 'button');
	header.setAttribute('aria-expanded', String(thinkingExpanded));

	const label = append(header, $('span.conversation-process-fold-thinking-label'));
	label.textContent = conversationProcessFoldThinkingLabel;

	const summary = append(header, $('span.conversation-process-fold-thinking-summary'));
	summary.textContent = formatThinkingSummary(turn, node.tools, options);
	syncProcessFoldThinkingAria(header, summary.textContent ?? '', thinkingExpanded);

	appendProcessFoldTrajectoryJump(line, turn.id, options, disposables);

	const body = append(thinking, $('div.conversation-process-fold-thinking-body'));
	body.hidden = !thinkingExpanded;
	const textNode = body.ownerDocument.createTextNode(thinkingBodyText(turn));
	body.appendChild(textNode);
	if (isExecutingTurn(turn, options)) {
		body.classList.add('conversation-process-fold-body--executing');
	}

	const tools = append(thinking, $('div.conversation-process-fold-thinking-tools'));
	tools.hidden = !thinkingExpanded;

	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
		const next = !options.isThinkingExpanded(turn.id);
		options.setThinkingExpanded(turn.id, next);
		header.setAttribute('aria-expanded', String(next));
		syncProcessFoldThinkingAria(header, summary.textContent ?? '', next);
		body.hidden = !next;
		tools.hidden = !next;
		options.onLayoutChange();
	}));

	return { element: thinking, header, summary, body, textNode, toolsHost: tools };
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

function renderToolRow(
	parent: HTMLElement,
	turn: ConversationStubTurn,
	nested: boolean,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): HTMLElement {
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

	const toolExpanded = hasContent && options.isToolExpanded(turn.id);
	if (hasContent) {
		header.setAttribute('aria-expanded', String(toolExpanded));
	}

	const name = append(header, $('span.conversation-process-fold-tool-name'));
	name.textContent = turn.toolName ?? turn.kind;

	const summary = append(header, $('span.conversation-process-fold-tool-summary'));
	summary.textContent = formatToolSummary(turn, options);

	// Diff counts are invocation detail. Details off keeps the name and summary only.
	const diffStatsText = showDetails && isFileEdit ? formatProcessFoldDiffStats(metadata, diffText) : undefined;
	if (diffStatsText) {
		const diffStats = append(header, $('span.conversation-process-fold-tool-diff-stats'));
		diffStats.textContent = diffStatsText;
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
	if (hasContent) {
		syncProcessFoldToolAria(header, toolName, spokenDetail, toolExpanded);
	} else {
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

	if (hasContent) {
		const body = append(row, $('div.conversation-process-fold-tool-body'));
		body.hidden = !toolExpanded;
		if (executing) {
			body.classList.add('conversation-process-fold-body--executing');
		}

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
			if (toolExpanded) {
				renderProcessFoldDiffBlock(diffArea, diffText!, filediff, options, disposables);
			}
		}

		disposables.add(addDisposableListener(header, 'click', (e) => {
			e.stopPropagation();
			const next = !options.isToolExpanded(turn.id);
			options.setToolExpanded(turn.id, next);
			header.setAttribute('aria-expanded', String(next));
			syncProcessFoldToolAria(header, toolName, toolAriaDetail(summary.textContent ?? '', thinkingText), next);
			body.hidden = !next;
			if (next && hasDiff && diffArea && !diffArea.hasChildNodes()) {
				renderProcessFoldDiffBlock(diffArea, diffText!, filediff, options, disposables);
			}
			options.onLayoutChange();
		}));
	}

	return row;
}

/** Non-empty `:think:` text carried beside a tool row. Whitespace-only is absent. */
function visibleToolThinkingText(turn: ConversationStubTurn): string {
	return turn.thinkingText?.trim() ?? '';
}

function toolAriaDetail(summaryText: string, thinkingText: string): string {
	if (!thinkingText) {
		return summaryText;
	}
	return summaryText ? `${summaryText}, ${thinkingText}` : thinkingText;
}

function formatThinkingSummary(turn: ConversationStubTurn, tools: readonly ConversationStubTurn[], options: ProcessFoldDomOptions): string {
	const base = summarizeThinkingTools(turn.text, tools);
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
			return options.showLiveChrome ? undefined : Codicon.check;
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

function appendProcessFoldToolCancel(
	parent: HTMLElement,
	turn: ConversationStubTurn,
	executing: boolean,
	options: ProcessFoldDomOptions,
	disposables: DisposableStore,
): void {
	if (!executing || !options.onCancelToolCall || !turn.id.trim()) {
		return;
	}
	const writesEnabled = options.writesEnabled !== false;
	const cancel = append(parent, $('button.conversation-process-fold-tool-cancel')) as HTMLButtonElement;
	cancel.type = 'button';
	cancel.classList.add(...ThemeIcon.asClassNameArray(Codicon.debugStop));
	cancel.title = conversationProcessFoldToolCancel;
	cancel.setAttribute('aria-label', conversationProcessFoldToolCancel);
	cancel.setAttribute('data-tool-call-id', turn.id);
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
	if (turn.respondable !== true || !options.onRespondClientTool || !turn.id.trim()) {
		return;
	}
	const writesEnabled = options.writesEnabled !== false;
	const respond = append(parent, $('button.conversation-process-fold-tool-respond')) as HTMLButtonElement;
	respond.type = 'button';
	respond.classList.add(...ThemeIcon.asClassNameArray(Codicon.reply));
	respond.title = conversationProcessFoldToolRespond;
	respond.setAttribute('aria-label', conversationProcessFoldToolRespond);
	respond.disabled = !writesEnabled;
	respond.setAttribute('aria-disabled', String(!writesEnabled));
	disposables.add(addDisposableListener(respond, 'click', (e) => {
		e.stopPropagation();
		if (!writesEnabled) {
			return;
		}
		options.onRespondClientTool!(turn);
	}));
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

