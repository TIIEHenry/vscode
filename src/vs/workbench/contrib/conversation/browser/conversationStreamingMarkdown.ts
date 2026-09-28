/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as marked from '../../../../base/common/marked/marked.js';

/** Top-level tokens kept live so a list or paragraph that looks finished can still grow. */
const liveTailTokenCount = 2;

export interface ConversationStreamingRenderTarget {
	/** Replace target's children with a render of markdown. fillInIncompleteTokens is true only for the live tail. */
	render(markdown: string, target: HTMLElement, fillInIncompleteTokens: boolean): void;
	/** Called once when a prefix block is frozen. Optional. */
	decorate?(target: HTMLElement): void;
}

export interface ConversationStreamingMarkdownHandle {
	update(text: string): void;
	/** Render the full text once with fillInIncompleteTokens false, replacing incremental DOM. */
	finalize(): void;
	dispose(): void;
}

interface LexToken {
	readonly raw: string;
}

function lexTopLevel(source: string): readonly LexToken[] {
	const lex = marked.lexer;
	if (typeof lex !== 'function') {
		return [];
	}
	return lex(source);
}

/**
 * Append the unseen suffix of `next` when `next` starts with `previous`.
 * Returns false and leaves `node` unchanged otherwise.
 */
export function appendPrefixText(node: Text, previous: string, next: string): boolean {
	if (!next.startsWith(previous)) {
		return false;
	}
	node.appendData(next.slice(previous.length));
	return true;
}

export function createConversationStreamingMarkdown(container: HTMLElement, renderer: ConversationStreamingRenderTarget): ConversationStreamingMarkdownHandle {
	let disposed = false;
	let finalized = false;
	let processed = '';
	let frozenOffset = 0;
	let tailNodes: HTMLElement[] = [];

	function clearIncrementalDom(): void {
		container.replaceChildren();
		tailNodes = [];
		frozenOffset = 0;
	}

	function removeTail(): void {
		for (const node of tailNodes) {
			node.remove();
		}
		tailNodes = [];
	}

	function renderBlock(markdown: string, fillInIncompleteTokens: boolean): HTMLElement {
		const target = document.createElement('div');
		container.appendChild(target);
		renderer.render(markdown, target, fillInIncompleteTokens);
		return target;
	}

	function update(text: string): void {
		if (disposed || text === processed) {
			return;
		}
		if (finalized || !text.startsWith(processed)) {
			clearIncrementalDom();
			finalized = false;
		}

		const tokens = lexTopLevel(text.slice(frozenOffset));
		const tailStart = Math.max(0, tokens.length - liveTailTokenCount);
		// Drop the previous tail before appending newly frozen blocks so they stay in source order.
		removeTail();
		for (let i = 0; i < tailStart; i++) {
			const raw = tokens[i].raw;
			const block = renderBlock(raw, false);
			renderer.decorate?.(block);
			frozenOffset += raw.length;
		}
		if (tailStart < tokens.length) {
			let markdown = '';
			for (let i = tailStart; i < tokens.length; i++) {
				markdown += tokens[i].raw;
			}
			tailNodes = [renderBlock(markdown, true)];
		}
		processed = text;
	}

	function finalize(): void {
		if (disposed) {
			return;
		}
		const text = processed;
		clearIncrementalDom();
		finalized = true;
		processed = text;
		renderer.render(text, container, false);
	}

	function dispose(): void {
		if (disposed) {
			return;
		}
		disposed = true;
		tailNodes = [];
		processed = '';
		frozenOffset = 0;
		finalized = false;
	}

	return { update, finalize, dispose };
}
