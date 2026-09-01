/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { IMouseWheelEvent } from '../../../../base/browser/mouseEvent.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import {
	ConversationVisualizeArgs,
	ConversationVisualizeOption,
	parseVisualizeArgs,
} from '../common/conversationVisualize.js';
import { ConversationMermaidHostContext, mountConversationMermaidHost } from './conversationMermaidHost.js';
import { ConversationStubTurn } from './conversationStubModel.js';

export const conversationVisualizeExpandDiagram = localize('conversationVisualize.expandDiagram', "Expand diagram");

export const conversationVisualizeHeaderLabel = localize('conversationVisualize.header', "Visualize");

export interface ConversationVisualizeCardOptions {
	readonly isExpanded: (turnId: string) => boolean;
	readonly setExpanded: (turnId: string, expanded: boolean) => void;
	readonly onLayoutChange: () => void;
	readonly mermaidHost?: ConversationMermaidHostContext;
	readonly onOpenFullscreen?: (source: string, title?: string) => void;
	readonly onWheelDelegate?: (event: IMouseWheelEvent) => void;
}

/**
 * Renders PRD-014 visualize inline card chrome for one timeline turn (T2: stub mermaid host).
 */
export function renderConversationVisualizeCard(
	container: HTMLElement,
	turn: ConversationStubTurn,
	options: ConversationVisualizeCardOptions,
	disposables: DisposableStore,
): void {
	const root = append(container, $('div.conversation-visualize-card.conversation-lens-turn'));
	root.setAttribute('data-kind', 'visualization');
	root.setAttribute('data-turn-id', turn.id);

	const parsed = turn.visualize
		? { ok: true as const, args: turn.visualize }
		: parseVisualizeArgs(turn.payload ?? turn.text);

	if (!parsed.ok) {
		root.setAttribute('data-visualize-type', 'error');
		renderVisualizeCardChrome(root, turn.id, conversationVisualizeHeaderLabel, 'Stub: error', options, disposables, (body) => {
			append(body, $('div.conversation-visualize-error')).textContent = parsed.error;
			const fence = append(body, $('pre.conversation-visualize-fence'));
			fence.textContent = parsed.fallbackMarkdown;
		});
		return;
	}

	const args = parsed.args;
	root.setAttribute('data-visualize-type', args.type);
	const stubKind = args.type === 'diagram' ? localize('conversationVisualize.stubDiagram', "Stub: diagram") : localize('conversationVisualize.stubComparison', "Stub: comparison");

	renderVisualizeCardChrome(root, turn.id, conversationVisualizeHeaderLabel, stubKind, options, disposables, (body) => {
		if (args.title) {
			append(body, $('div.conversation-visualize-title')).textContent = args.title;
		}
		if (args.type === 'diagram') {
			renderDiagramBody(body, args, options, disposables);
		} else {
			renderComparisonBody(body, args, options, disposables);
		}
	});
}

function renderVisualizeCardChrome(
	root: HTMLElement,
	turnId: string,
	headerPrefix: string,
	stubLabel: string,
	options: ConversationVisualizeCardOptions,
	disposables: DisposableStore,
	renderBody: (body: HTMLElement) => void,
): void {
	const expanded = options.isExpanded(turnId);

	const header = append(root, $('button.conversation-visualize-header')) as HTMLButtonElement;
	header.type = 'button';
	header.setAttribute('aria-expanded', String(expanded));

	const chevron = append(header, $('span.conversation-visualize-chevron'));
	chevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
	chevron.classList.toggle('conversation-visualize-chevron--expanded', expanded);

	const label = append(header, $('span.conversation-visualize-header-label'));
	label.textContent = `${headerPrefix} · ${stubLabel}`;

	const body = append(root, $('div.conversation-visualize-body'));
	body.hidden = !expanded;
	renderBody(body);

	disposables.add(addDisposableListener(header, 'click', (e) => {
		e.stopPropagation();
		const next = !options.isExpanded(turnId);
		options.setExpanded(turnId, next);
		header.setAttribute('aria-expanded', String(next));
		body.hidden = !next;
		chevron.classList.toggle('conversation-visualize-chevron--expanded', next);
		options.onLayoutChange();
	}));
}

function renderDiagramBody(
	parent: HTMLElement,
	args: Extract<ConversationVisualizeArgs, { type: 'diagram' }>,
	options: ConversationVisualizeCardOptions,
	disposables: DisposableStore,
): void {
	const diagram = append(parent, $('div.conversation-visualize-diagram'));
	const toolbar = append(diagram, $('div.conversation-visualize-diagram-toolbar'));
	const expandButton = append(toolbar, $('button.conversation-visualize-expand')) as HTMLButtonElement;
	expandButton.type = 'button';
	expandButton.title = conversationVisualizeExpandDiagram;
	expandButton.setAttribute('aria-label', conversationVisualizeExpandDiagram);
	expandButton.appendChild(renderIcon(Codicon.screenFull));

	disposables.add(addDisposableListener(expandButton, 'click', (e) => {
		e.stopPropagation();
		options.onOpenFullscreen?.(args.mermaid, args.title);
	}));

	if (options.mermaidHost) {
		mountConversationMermaidHost(diagram, options.mermaidHost, {
			mode: 'inline',
			source: args.mermaid,
			title: args.title,
			onLayoutChange: options.onLayoutChange,
			onWheelDelegate: options.onWheelDelegate,
		}, disposables);
	} else {
		const pre = append(diagram, $('pre.conversation-visualize-mermaid-source')) as HTMLPreElement;
		pre.setAttribute('data-mermaid-source', '');
		pre.textContent = args.mermaid.trim();
	}
}

function renderComparisonBody(
	parent: HTMLElement,
	args: Extract<ConversationVisualizeArgs, { type: 'comparison' }>,
	options: ConversationVisualizeCardOptions,
	disposables: DisposableStore,
): void {
	const grid = append(parent, $('div.conversation-visualize-comparison-grid'));
	for (const option of args.options) {
		grid.appendChild(renderComparisonOptionCard(option, options, disposables));
	}
}

function renderComparisonOptionCard(
	option: ConversationVisualizeOption,
	options: ConversationVisualizeCardOptions,
	disposables: DisposableStore,
): HTMLElement {
	const card = $('div.conversation-visualize-option');
	card.classList.toggle('conversation-visualize-option--recommended', option.recommended);
	if (option.recommended) {
		card.setAttribute('data-recommended', 'true');
	}

	const titleRow = append(card, $('div.conversation-visualize-option-title-row'));
	append(titleRow, $('span.conversation-visualize-option-name')).textContent = option.name;
	if (option.recommended) {
		append(titleRow, $('span.conversation-visualize-option-badge')).textContent =
			localize('conversationVisualize.recommended', "Recommended");
	}

	if (option.description) {
		append(card, $('p.conversation-visualize-option-description')).textContent = option.description;
	}

	if (option.pros.length > 0) {
		const prosList = append(card, $('ul.conversation-visualize-pros'));
		for (const pro of option.pros) {
			const item = append(prosList, $('li.conversation-visualize-list-item'));
			item.appendChild(renderIcon(Codicon.check));
			append(item, $('span')).textContent = pro;
		}
	}

	if (option.cons.length > 0) {
		const consList = append(card, $('ul.conversation-visualize-cons'));
		for (const con of option.cons) {
			const item = append(consList, $('li.conversation-visualize-list-item'));
			item.appendChild(renderIcon(Codicon.error));
			append(item, $('span')).textContent = con;
		}
	}

	if (option.mermaid && option.mermaid.trim() !== '') {
		const host = append(card, $('div.conversation-visualize-option-diagram'));
		if (options.mermaidHost) {
			mountConversationMermaidHost(host, options.mermaidHost, {
				mode: 'inline',
				source: option.mermaid,
				title: option.name,
				onLayoutChange: options.onLayoutChange,
				onWheelDelegate: options.onWheelDelegate,
			}, disposables);
		} else {
			const pre = append(host, $('pre.conversation-visualize-mermaid-source')) as HTMLPreElement;
			pre.setAttribute('data-mermaid-source', '');
			pre.textContent = option.mermaid.trim();
		}
	}

	return card;
}
