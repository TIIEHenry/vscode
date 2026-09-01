/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { ConversationStubTurn, StubTurnKind } from './conversationStubModel.js';
import {
	conversationLensSessionBarNoTrajectory,
	conversationLensSessionBarTrajectoryListAria,
} from './conversationLensSessionBarStrings.js';

export interface IConversationTrajectoryListOptions {
	readonly onDidSelectTurn?: (turnId: string) => void;
}

export interface ConversationTrajectoryEntry {
	readonly turn: ConversationStubTurn;
}

interface ITrajectoryTemplateData {
	readonly container: HTMLElement;
	readonly role: HTMLElement;
	readonly summary: HTMLElement;
}

class TrajectoryDelegate implements IListVirtualDelegate<ConversationTrajectoryEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'conversationTrajectoryEntry';
	}
}

class TrajectoryRenderer implements IListRenderer<ConversationTrajectoryEntry, ITrajectoryTemplateData> {
	static readonly TEMPLATE_ID = 'conversationTrajectoryEntry';

	readonly templateId = TrajectoryRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ITrajectoryTemplateData {
		container.classList.add('conversation-lens-trajectory-row');
		const role = append(container, $('.conversation-lens-trajectory-role'));
		const summary = append(container, $('.conversation-lens-trajectory-summary'));
		return { container, role, summary };
	}

	renderElement(entry: ConversationTrajectoryEntry, _index: number, templateData: ITrajectoryTemplateData): void {
		templateData.role.textContent = getConversationTurnRoleLabel(entry.turn.kind);
		templateData.summary.textContent = getConversationTurnSummary(entry.turn);
		templateData.container.setAttribute('data-turn-id', entry.turn.id);
		templateData.container.setAttribute('data-kind', entry.turn.kind);
	}

	disposeTemplate(): void {
		// noop
	}
}

class TrajectoryAccessibilityProvider implements IListAccessibilityProvider<ConversationTrajectoryEntry> {
	getWidgetAriaLabel(): string {
		return conversationLensSessionBarTrajectoryListAria;
	}

	getAriaLabel(entry: ConversationTrajectoryEntry): string {
		return localize(
			'conversationLens.trajectoryEntryAria',
			"{0}: {1}",
			getConversationTurnRoleLabel(entry.turn.kind),
			getConversationTurnSummary(entry.turn),
		);
	}
}

/** Role label for trajectory rows and tree headers. */
export function getConversationTurnRoleLabel(kind: StubTurnKind): string {
	switch (kind) {
		case 'user':
			return localize('conversationLens.turnYou', "You");
		case 'assistant':
			return localize('conversationLens.turnAgent', "Agent");
		case 'confirmation':
			return localize('conversationLens.turnConfirmation', "Confirmation");
		case 'thinking':
			return localize('conversationLens.turnThinking', "Thinking");
		case 'tool':
			return localize('conversationLens.turnTool', "Tool");
		case 'visualization':
			return localize('conversationVisualize.turnLabel', "Visualize");
	}
}

/** One-line summary for trajectory navigation. */
export function getConversationTurnSummary(turn: ConversationStubTurn): string {
	const trimmed = turn.text.trim();
	if (!trimmed) {
		return localize('conversationLens.turnEmptySummary', "(empty)");
	}
	return trimmed.length > 120 ? `${trimmed.slice(0, 119)}…` : trimmed;
}

/**
 * In-column MessageNavigator: current session turn index (role + summary).
 * SessionBar History toggles this list; row click reveals the timeline turn.
 */
export class ConversationTrajectoryList extends Disposable {

	private readonly host: HTMLElement;
	private readonly emptyState: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly list: WorkbenchList<ConversationTrajectoryEntry>;
	private visible = false;

	constructor(
		parent: HTMLElement,
		options: IConversationTrajectoryListOptions,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.host = append(parent, $('.conversation-lens-trajectory'));
		this.host.hidden = true;
		this.host.setAttribute('role', 'navigation');
		this.host.setAttribute('aria-label', conversationLensSessionBarTrajectoryListAria);

		this.emptyState = append(this.host, $('.conversation-lens-trajectory-empty'));
		append(this.emptyState, $('p.conversation-lens-trajectory-empty-title')).textContent =
			conversationLensSessionBarNoTrajectory;

		this.listContainer = append(this.host, $('.conversation-lens-trajectory-list'));

		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'ConversationTrajectory',
			this.listContainer,
			new TrajectoryDelegate(),
			[new TrajectoryRenderer()],
			{
				identityProvider: { getId: (entry: ConversationTrajectoryEntry) => entry.turn.id },
				accessibilityProvider: new TrajectoryAccessibilityProvider(),
				openOnSingleClick: true,
			},
		)) as WorkbenchList<ConversationTrajectoryEntry>;

		if (options.onDidSelectTurn) {
			this._register(this.list.onDidOpen(e => {
				if (e.element) {
					options.onDidSelectTurn!(e.element.turn.id);
				}
			}));
		}
	}

	show(): void {
		this.visible = true;
		this.host.hidden = false;
	}

	hide(): void {
		this.visible = false;
		this.host.hidden = true;
	}

	isVisible(): boolean {
		return this.visible;
	}

	setTurns(turns: readonly ConversationStubTurn[]): void {
		const entries = turns.map(turn => ({ turn }));
		const empty = entries.length === 0;
		this.emptyState.style.display = empty ? '' : 'none';
		this.listContainer.style.display = empty ? 'none' : '';
		if (!empty) {
			this.list.splice(0, this.list.length, entries);
		}
	}

	layout(height: number, width: number): void {
		this.list.layout(height, width);
	}
}
