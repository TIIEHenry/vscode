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
import { ConversationStubTurn } from './conversationStubModel.js';
import { ProcessFoldNode, ProcessFoldSpan, summarizeProcessSteps } from './conversationProcessFoldModel.js';

export const conversationProcessFoldThinkingLabel = localize('conversationProcessFold.thinking', "Thinking");

export interface ProcessFoldDomOptions {
	readonly defaultOuterExpanded: boolean;
	readonly isOuterExpanded: (spanId: string) => boolean;
	readonly setOuterExpanded: (spanId: string, expanded: boolean) => void;
	readonly isThinkingExpanded: (turnId: string) => boolean;
	readonly setThinkingExpanded: (turnId: string, expanded: boolean) => void;
	readonly onLayoutChange: () => void;
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

	const header = append(root, $('button.conversation-process-fold-header')) as HTMLButtonElement;
	header.type = 'button';
	header.setAttribute('role', 'button');
	header.setAttribute('aria-expanded', String(outerExpanded));

	const chevron = append(header, $('span.conversation-process-fold-chevron'));
	chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
	chevron.classList.toggle('conversation-process-fold-chevron--expanded', outerExpanded);

	const summary = append(header, $('span.conversation-process-fold-summary'));
	summary.textContent = summarizeProcessSteps(span);

	const children = append(root, $('div.conversation-process-fold-children'));
	children.hidden = !outerExpanded;

	for (const node of span.nodes) {
		if (node.kind === 'thinking') {
			renderThinkingNode(children, node, options, disposables);
		} else {
			renderToolRow(children, node.turn, false, disposables);
		}
	}

	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
		const next = !options.isOuterExpanded(span.id);
		options.setOuterExpanded(span.id, next);
		header.setAttribute('aria-expanded', String(next));
		children.hidden = !next;
		chevron.classList.toggle('conversation-process-fold-chevron--expanded', next);
		options.onLayoutChange();
	}));
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

	const chevron = append(header, $('span.conversation-process-fold-chevron'));
	chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
	chevron.classList.toggle('conversation-process-fold-chevron--expanded', thinkingExpanded);

	const label = append(header, $('span.conversation-process-fold-thinking-label'));
	label.textContent = conversationProcessFoldThinkingLabel;

	const summary = append(header, $('span.conversation-process-fold-thinking-summary'));
	summary.textContent = turn.text;

	const body = append(thinking, $('div.conversation-process-fold-thinking-body'));
	body.hidden = !thinkingExpanded;
	body.textContent = turn.text;

	const tools = append(thinking, $('div.conversation-process-fold-thinking-tools'));
	for (const toolTurn of node.tools) {
		renderToolRow(tools, toolTurn, true, disposables);
	}

	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
		const next = !options.isThinkingExpanded(turn.id);
		options.setThinkingExpanded(turn.id, next);
		header.setAttribute('aria-expanded', String(next));
		body.hidden = !next;
		chevron.classList.toggle('conversation-process-fold-chevron--expanded', next);
		options.onLayoutChange();
	}));
}

function renderToolRow(
	parent: HTMLElement,
	turn: ConversationStubTurn,
	nested: boolean,
	disposables: DisposableStore,
): void {
	const row = append(parent, $('div.conversation-process-fold-tool'));
	row.setAttribute('data-turn-id', turn.id);
	row.setAttribute('data-kind', turn.kind);
	if (nested) {
		row.classList.add('conversation-process-fold-tool--nested');
	}

	const icon = append(row, $('span.conversation-process-fold-tool-icon'));
	icon.appendChild(renderIcon(Codicon.check));

	const name = append(row, $('span.conversation-process-fold-tool-name'));
	name.textContent = turn.toolName ?? turn.kind;

	const summary = append(row, $('span.conversation-process-fold-tool-summary'));
	summary.textContent = turn.summary ?? turn.text;
}
