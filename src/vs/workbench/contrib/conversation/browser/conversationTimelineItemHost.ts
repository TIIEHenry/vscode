/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode, getActiveElement, isHTMLElement } from '../../../../base/browser/dom.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import type { ITreeNode } from '../../../../base/browser/ui/tree/tree.js';
import type { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import type { DiffEditorPool } from '../../chat/browser/widget/chatContentParts/chatContentCodePools.js';
import { ProcessFoldSpanHandle, renderProcessFoldSpan } from './conversationProcessFold.js';
import { ProcessFoldSpan } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { ConversationTimelineRenderer, readingTurnSourceName } from './conversationTimelineRenderer.js';
import { ConversationTimelineItem } from './conversationTimelineTypes.js';
import { IConversationTurnContentAdapter } from './conversationTurnContentAdapter.js';
import type { ConversationDisplayMode } from './conversationLivePhase.js';

export interface ConversationTimelineHostRoot {
	readonly id: string;
	readonly kind: 'item' | 'process-fold';
	readonly turns: readonly { readonly id: string; readonly turn: ConversationStubTurn }[];
	readonly span?: ProcessFoldSpan;
	readonly item: ConversationTimelineItem;
}

export interface ConversationTimelineItemHostHooks {
	readonly renderer: ConversationTimelineRenderer;
	readonly contentAdapter: IConversationTurnContentAdapter;
	readonly isOuterExpanded: (spanId: string) => boolean;
	readonly setOuterExpanded: (spanId: string, expanded: boolean) => void;
	readonly isThinkingExpanded: (turnId: string) => boolean;
	readonly setThinkingExpanded: (turnId: string, expanded: boolean) => void;
	readonly isToolExpanded: (turnId: string) => boolean;
	readonly setToolExpanded: (turnId: string, expanded: boolean) => void;
	readonly onProcessFoldLayout: (rootId: string) => void;
	readonly showLiveChrome: () => boolean;
	readonly displayMode?: () => ConversationDisplayMode;
	readonly writesEnabled: () => boolean;
	readonly showToolInvocationDetails: () => boolean;
	readonly onViewInTrajectory?: (turnId: string) => void;
	readonly onCancelToolCall?: (turn: ConversationStubTurn) => void;
	readonly onRespondClientTool?: (turn: ConversationStubTurn) => void;
	readonly diffEditorPool?: DiffEditorPool;
	readonly instantiationService?: IInstantiationService;
}

/**
 * One timeline root. The article element is stable across content updates.
 * Process folds and streaming assistant bodies patch in place; everything else
 * re-renders inside the article.
 */
export class ConversationTimelineItemHost {

	readonly article: HTMLElement;
	private readonly inner: HTMLElement;
	private readonly disposables = new DisposableStore();
	private foldHandle: ProcessFoldSpanHandle | undefined;
	private streamingHandle: { update(text: string): void; dispose(): void } | undefined;
	private streamingText = '';

	root: ConversationTimelineHostRoot;

	constructor(
		root: ConversationTimelineHostRoot,
		private readonly hooks: ConversationTimelineItemHostHooks,
	) {
		this.root = root;
		this.article = $('article.conversation-timeline-item');
		this.article.tabIndex = -1;
		this.article.style.userSelect = 'text';
		this.inner = append(this.article, $('div.conversation-timeline-item-body'));
		this.inner.classList.add('conversation-lens-timeline-row');
		this.adopt(root);
	}

	adopt(root: ConversationTimelineHostRoot): void {
		this.root = root;
		this.article.dataset.rootId = root.id;
		this.article.dataset.kind = root.kind;
	}

	/**
	 * `auto` patches a process fold or a streaming prefix.
	 * `full` rebuilds the inner DOM and keeps the article element.
	 */
	render(mode: 'auto' | 'full'): void {
		if (mode === 'auto' && this.tryIncremental()) {
			return;
		}
		this.fullRender();
	}

	/** Re-read expansion and summary without rebuilding the fold chrome. */
	refreshProcessFold(): void {
		if (this.root.kind === 'process-fold' && this.root.span && this.foldHandle) {
			this.foldHandle.update(this.root.span);
		}
	}

	setChrome(chrome: {
		readonly posinset: number;
		readonly setsize: number;
		readonly label: string;
		readonly cvVisible: boolean;
		readonly busy: boolean;
		readonly latestAssistant: boolean;
	}): void {
		this.article.setAttribute('aria-posinset', String(chrome.posinset));
		this.article.setAttribute('aria-setsize', String(chrome.setsize));
		this.article.setAttribute('aria-label', chrome.label);
		this.article.classList.toggle('conversation-timeline-item--latest-assistant', chrome.latestAssistant);
		// Class only. Inline content-visibility / contain-intrinsic-block-size
		// beat the stylesheet :focus-within rule and clamp a focused older row
		// to the 120px placeholder.
		this.article.classList.toggle('conversation-timeline-item--cv-visible', chrome.cvVisible);
		if (chrome.busy) {
			this.article.setAttribute('aria-busy', 'true');
		} else {
			this.article.removeAttribute('aria-busy');
		}
	}

	dispose(): void {
		this.foldHandle = undefined;
		this.streamingHandle = undefined;
		this.disposables.dispose();
		this.article.remove();
	}

	private tryIncremental(): boolean {
		const root = this.root;
		if (root.kind === 'process-fold' && root.span && this.foldHandle) {
			this.foldHandle.update(root.span);
			return true;
		}
		const turn = root.turns[0]?.turn;
		if (
			turn
			&& this.streamingHandle
			&& turn.streaming === true
			&& turn.kind === 'assistant'
			&& turn.text.startsWith(this.streamingText)
		) {
			this.streamingHandle.update(turn.text);
			this.streamingText = turn.text;
			return true;
		}
		return false;
	}

	private fullRender(): void {
		const active = getActiveElement();
		const restoreFocus = !!active && active !== this.article && this.article.contains(active);
		const restoreDescendant = restoreFocus && isHTMLElement(active)
			? captureFocusedDescendant(this.inner, active)
			: undefined;

		this.disposables.clear();
		this.foldHandle = undefined;
		this.streamingHandle = undefined;
		this.streamingText = '';
		clearNode(this.inner);

		const root = this.root;
		if (root.kind === 'process-fold' && root.span) {
			this.foldHandle = renderProcessFoldSpan(this.inner, root.span, {
				defaultOuterExpanded: false,
				showLiveChrome: this.hooks.showLiveChrome(),
				displayMode: this.hooks.displayMode?.() ?? (this.hooks.showLiveChrome() ? 'live' : 'stub'),
				writesEnabled: this.hooks.writesEnabled(),
				showToolInvocationDetails: this.hooks.showToolInvocationDetails(),
				diffEditorPool: this.hooks.diffEditorPool,
				instantiationService: this.hooks.instantiationService,
				isOuterExpanded: spanId => this.hooks.isOuterExpanded(spanId),
				setOuterExpanded: (spanId, expanded) => this.hooks.setOuterExpanded(spanId, expanded),
				isThinkingExpanded: turnId => this.hooks.isThinkingExpanded(turnId),
				setThinkingExpanded: (turnId, expanded) => this.hooks.setThinkingExpanded(turnId, expanded),
				isToolExpanded: turnId => this.hooks.isToolExpanded(turnId),
				setToolExpanded: (turnId, expanded) => this.hooks.setToolExpanded(turnId, expanded),
				onViewInTrajectory: this.hooks.onViewInTrajectory,
				onCancelToolCall: this.hooks.onCancelToolCall,
				onRespondClientTool: this.hooks.onRespondClientTool,
				onLayoutChange: () => this.hooks.onProcessFoldLayout(this.root.id),
			}, this.disposables);
		} else {
			const turn = root.turns[0]?.turn;
			if (turn && turn.streaming === true && turn.kind === 'assistant' && this.hooks.contentAdapter.renderStreamingBody) {
				this.mountStreaming(turn);
			} else {
				this.hooks.renderer.renderElement(
					{ element: root.item } as ITreeNode<ConversationTimelineItem, void>,
					0,
					{ container: this.inner, disposables: this.disposables },
				);
			}
		}

		if (restoreFocus) {
			const matched = restoreDescendant?.();
			if (matched && !(matched as HTMLButtonElement).disabled && !matched.hidden && !matched.inert) {
				if (matched.tabIndex < 0) {
					matched.tabIndex = 0;
				}
				matched.focus({ preventScroll: true });
				return;
			}
			if (this.article.tabIndex < 0) {
				this.article.tabIndex = 0;
			}
			this.article.focus({ preventScroll: true });
		}
	}

	private mountStreaming(turn: ConversationStubTurn): void {
		const renderStreamingBody = this.hooks.contentAdapter.renderStreamingBody;
		if (!renderStreamingBody) {
			return;
		}
		const row = append(this.inner, $('div.conversation-lens-turn'));
		row.setAttribute('data-kind', turn.kind);
		row.setAttribute('data-turn-id', turn.id);
		const sourceName = readingTurnSourceName(turn);
		if (sourceName) {
			const header = append(row, $('.conversation-lens-turn-header'));
			const identity = append(header, $('span.conversation-lens-turn-source'));
			identity.textContent = sourceName;
			identity.title = sourceName;
		}
		const body = append(row, $('.conversation-lens-turn-body.conversation-lens-turn-body--reading-text.rendered-markdown'));
		const handle = renderStreamingBody.call(this.hooks.contentAdapter, turn, body);
		if (turn.text.length > 0) {
			handle.update(turn.text);
		}
		this.streamingHandle = handle;
		this.streamingText = turn.text;
		let disposed = false;
		this.disposables.add(toDisposable(() => {
			if (disposed) {
				return;
			}
			disposed = true;
			handle.dispose();
			if (this.streamingHandle === handle) {
				this.streamingHandle = undefined;
			}
		}));
	}
}

function collectMatchingDescendants(root: HTMLElement, predicate: (el: HTMLElement) => boolean, out: HTMLElement[] = []): HTMLElement[] {
	for (const child of root.children) {
		if (!isHTMLElement(child)) {
			continue;
		}
		if (predicate(child)) {
			out.push(child);
		}
		collectMatchingDescendants(child, predicate, out);
	}
	return out;
}

function captureFocusedDescendant(root: HTMLElement, active: HTMLElement): () => HTMLElement | undefined {
	const turnId = active.closest<HTMLElement>('[data-turn-id]')?.dataset.turnId;
	const tagName = active.tagName;
	const isMonacoButton = active.classList.contains('monaco-button');
	const parentClassName = isMonacoButton ? active.parentElement?.className : undefined;
	const convClasses = [...active.classList].filter(cls => cls.startsWith('conversation-'));
	const matches = (el: HTMLElement): boolean => {
		if (el.tagName !== tagName) {
			return false;
		}
		if (turnId !== undefined && el.closest<HTMLElement>('[data-turn-id]')?.dataset.turnId !== turnId) {
			return false;
		}
		if (isMonacoButton) {
			if (!el.classList.contains('monaco-button')) {
				return false;
			}
			if (parentClassName && el.parentElement?.className !== parentClassName) {
				return false;
			}
			return true;
		}
		return convClasses.length > 0 && convClasses.every(cls => el.classList.contains(cls));
	};
	const before = collectMatchingDescendants(root, matches);
	const index = Math.max(0, before.indexOf(active));
	return () => {
		const after = collectMatchingDescendants(root, matches);
		return after[index] ?? after[0];
	};
}
