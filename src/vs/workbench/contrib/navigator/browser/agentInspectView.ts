/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/agentInspect.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { AgentInspectTarget, IAgentInspectService } from '../common/agentInspect.js';
import { formatAgentStatusLabel, formatAgentTypeShort } from '../common/navigatorAgentHierarchy.js';
import { AGENT_INSPECT_VIEW_ID } from './agentInspectIds.js';

const $ = dom.$;

export interface IAgentInspectEntry {
	readonly id: string;
	readonly label: string;
}

class InspectDelegate implements IListVirtualDelegate<IAgentInspectEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'agentInspectEntry';
	}
}

interface IInspectTemplateData {
	readonly label: HTMLElement;
}

class InspectRenderer implements IListRenderer<IAgentInspectEntry, IInspectTemplateData> {
	static readonly TEMPLATE_ID = 'agentInspectEntry';
	readonly templateId = InspectRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IInspectTemplateData {
		return { label: dom.append(container, $('.agent-inspect-entry-label')) };
	}

	renderElement(entry: IAgentInspectEntry, _index: number, templateData: IInspectTemplateData): void {
		templateData.label.textContent = entry.label;
		templateData.label.title = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class InspectAccessibilityProvider implements IListAccessibilityProvider<IAgentInspectEntry> {
	getWidgetAriaLabel(): string {
		return localize('agentInspectView.ariaLabel', "Inspect");
	}

	getAriaLabel(entry: IAgentInspectEntry): string {
		return entry.label;
	}
}

const INSPECT_TITLE = localize('agentInspectView.title', "Inspect");

export function inspectTitleFromTarget(target: AgentInspectTarget | undefined): string {
	if (!target) {
		return INSPECT_TITLE;
	}
	switch (target.kind) {
		case 'agent':
			return localize('agentInspectView.titleAgent', "Inspect: {0}", target.node.name || target.node.agentId);
		case 'member':
			return localize('agentInspectView.titleMember', "Inspect: {0}", target.info.memberName);
		case 'task':
			return localize('agentInspectView.titleTask', "Inspect: {0}", target.task.subject || target.task.taskId);
		case 'activity':
			return localize('agentInspectView.titleActivity', "Inspect: {0}", target.item.toolName);
	}
}

export function isInspectTargetStale(
	target: AgentInspectTarget | undefined,
	liveAgentIds: ReadonlySet<string> | undefined,
): boolean {
	if (!target || liveAgentIds === undefined) {
		return false;
	}
	switch (target.kind) {
		case 'agent':
			return !liveAgentIds.has(target.node.agentId);
		case 'member':
			return !liveAgentIds.has(target.info.memberAgentId);
		default:
			return false;
	}
}

function entriesFromTarget(target: AgentInspectTarget | undefined): IAgentInspectEntry[] {
	if (!target) {
		return [];
	}
	switch (target.kind) {
		case 'agent':
			return [
				{ id: 'agent_id', label: `agent_id: ${target.node.agentId}` },
				{ id: 'name', label: `name: ${target.node.name}` },
				{ id: 'type', label: `type: ${formatAgentTypeShort(target.node.type)}` },
				{ id: 'status', label: `status: ${formatAgentStatusLabel(target.node.status)}` },
				{ id: 'model', label: `model: ${target.node.model}` },
				{ id: 'turn_count', label: `turn_count: ${target.node.turnCount}` },
				{ id: 'created_at', label: `created_at: ${target.node.createdAt}` },
			];
		case 'member':
			return [
				{ id: 'member_name', label: `member_name: ${target.info.memberName}` },
				{ id: 'member_agent_id', label: `member_agent_id: ${target.info.memberAgentId}` },
				{ id: 'status', label: `status: ${target.info.status}` },
				{ id: 'preset', label: `preset: ${target.info.preset}` },
				{ id: 'dynamic', label: `dynamic: ${target.info.dynamic}` },
				{ id: 'turn_count', label: `turn_count: ${target.info.turnCount}` },
			];
		case 'task':
			return [
				{ id: 'task_id', label: `task_id: ${target.task.taskId}` },
				{ id: 'subject', label: `subject: ${target.task.subject}` },
				{ id: 'owner', label: `owner: ${target.task.owner}` },
				{ id: 'status', label: `status: ${target.task.status}` },
				{ id: 'blocked_by', label: `blocked_by: ${target.task.blockedBy}` },
				{ id: 'last_message', label: `last_message: ${target.task.lastMessage}` },
				{ id: 'description', label: `description: ${target.task.description}` },
			];
		case 'activity':
			return [
				{ id: 'tool', label: `tool: ${target.item.toolName}` },
				{ id: 'agent', label: `agent: ${target.item.agentId ?? ''}` },
				{ id: 'status', label: `status: ${target.item.status}` },
				{ id: 'itemId', label: `itemId: ${target.item.itemId}` },
			];
	}
}

export class AgentInspectView extends ViewPane {

	static readonly ID = AGENT_INSPECT_VIEW_ID;

	private list: WorkbenchList<IAgentInspectEntry> | undefined;
	private listContainer: HTMLElement | undefined;
	private entries: IAgentInspectEntry[] = [];
	private staleNote: HTMLElement | undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IAgentInspectService private readonly inspectService: IAgentInspectService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(this.inspectService.onDidChangeTarget(() => this.renderTarget()));
		this._register(this.inspectService.onDidChangeLiveAgentIds(() => this.renderTarget()));
	}

	override shouldShowWelcome(): boolean {
		return this.entries.length === 0;
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.staleNote = dom.append(container, $('.agent-inspect-stale-note'));
		this.staleNote.textContent = localize('agentInspectView.staleTarget', "已不在当前树中");
		this.staleNote.style.display = 'none';
		this.listContainer = dom.append(container, $('.agent-inspect-list'));
		this.ensureList();
		this.renderTarget();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.classList.toggle('is-narrow', width > 0 && width < 600);
		this.element.classList.toggle('is-compact', width > 0 && width < 300);
		this.list?.layout(height, width);
	}

	private ensureList(): WorkbenchList<IAgentInspectEntry> {
		if (this.list) {
			return this.list;
		}

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'AgentInspect',
			this.listContainer!,
			new InspectDelegate(),
			[new InspectRenderer()],
			{
				identityProvider: { getId: (entry: IAgentInspectEntry) => entry.id },
				accessibilityProvider: new InspectAccessibilityProvider(),
			},
		)) as WorkbenchList<IAgentInspectEntry>;

		return this.list;
	}

	private renderTarget(): void {
		const target = this.inspectService.getTarget();
		this.updateTitle(inspectTitleFromTarget(target));
		const stale = isInspectTargetStale(target, this.inspectService.getLiveAgentIds());
		if (this.staleNote) {
			this.staleNote.style.display = stale ? '' : 'none';
		}
		this.setEntries(entriesFromTarget(target));
	}

	private setEntries(entries: IAgentInspectEntry[]): void {
		const hadEntries = this.entries.length > 0;
		this.entries = entries;

		if (this.list) {
			this.list.splice(0, this.list.length, entries);
		}

		if (hadEntries !== (entries.length > 0)) {
			this._onDidChangeViewWelcomeState.fire();
		}
	}
}
