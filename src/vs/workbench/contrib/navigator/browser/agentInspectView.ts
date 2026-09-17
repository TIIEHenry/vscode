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
import { agentStatusTone, formatAgentStatusLabel, formatAgentTypeShort, type AgentStatusTone } from '../common/navigatorAgentHierarchy.js';
import { AGENT_INSPECT_VIEW_ID } from './agentInspectIds.js';

const $ = dom.$;

export interface IAgentInspectEntry {
	readonly id: string;
	readonly field: string;
	readonly value: string;
	readonly tone?: AgentStatusTone;
	readonly label: string;
}

function inspectEntry(id: string, field: string, value: string, tone?: AgentStatusTone): IAgentInspectEntry {
	return { id, field, value, tone, label: `${field}: ${value}` };
}

class InspectDelegate implements IListVirtualDelegate<IAgentInspectEntry> {
	constructor(private readonly isCompact: () => boolean) { }

	getHeight(): number {
		return this.isCompact() ? 44 : 22;
	}

	getTemplateId(): string {
		return 'agentInspectEntry';
	}
}

interface IInspectTemplateData {
	readonly row: HTMLElement;
	readonly field: HTMLElement;
	readonly value: HTMLElement;
}

class InspectRenderer implements IListRenderer<IAgentInspectEntry, IInspectTemplateData> {
	static readonly TEMPLATE_ID = 'agentInspectEntry';
	readonly templateId = InspectRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IInspectTemplateData {
		const row = dom.append(container, $('.agent-inspect-entry'));
		const field = dom.append(row, $('.agent-inspect-entry-field'));
		const value = dom.append(row, $('.agent-inspect-entry-value'));
		return { row, field, value };
	}

	renderElement(entry: IAgentInspectEntry, _index: number, templateData: IInspectTemplateData): void {
		templateData.field.textContent = entry.field;
		templateData.value.textContent = entry.value;
		templateData.value.className = entry.tone
			? `agent-inspect-entry-value is-${entry.tone}`
			: 'agent-inspect-entry-value';
		templateData.row.title = entry.label;
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
		// GC-5d: both leaves hidden / not following — do not mark stale.
		// Leftover writes an empty Set, which is stale below.
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
				inspectEntry('agent_id', localize('agentInspect.field.agentId', "Agent ID"), target.node.agentId),
				inspectEntry('name', localize('agentInspect.field.name', "Name"), target.node.name),
				inspectEntry('type', localize('agentInspect.field.type', "Type"), formatAgentTypeShort(target.node.type)),
				inspectEntry('status', localize('agentInspect.field.status', "Status"), formatAgentStatusLabel(target.node.status), agentStatusTone(target.node.status)),
				inspectEntry('model', localize('agentInspect.field.model', "Model"), target.node.model),
				inspectEntry('turn_count', localize('agentInspect.field.turns', "Turns"), String(target.node.turnCount)),
				inspectEntry('created_at', localize('agentInspect.field.created', "Created"), String(target.node.createdAt)),
			];
		case 'member':
			return [
				inspectEntry('member_name', localize('agentInspect.field.member', "Member"), target.info.memberName),
				inspectEntry('member_agent_id', localize('agentInspect.field.memberAgentId', "Member agent ID"), target.info.memberAgentId),
				inspectEntry('status', localize('agentInspect.field.status', "Status"), target.info.status, agentStatusTone(target.info.status)),
				inspectEntry('preset', localize('agentInspect.field.preset', "Preset"), target.info.preset),
				inspectEntry('dynamic', localize('agentInspect.field.dynamic', "Dynamic"), target.info.dynamic),
				inspectEntry('turn_count', localize('agentInspect.field.turns', "Turns"), String(target.info.turnCount)),
			];
		case 'task':
			return [
				inspectEntry('task_id', localize('agentInspect.field.taskId', "Task ID"), target.task.taskId),
				inspectEntry('subject', localize('agentInspect.field.subject', "Subject"), target.task.subject),
				inspectEntry('owner', localize('agentInspect.field.owner', "Owner"), target.task.owner),
				inspectEntry('status', localize('agentInspect.field.status', "Status"), target.task.status, agentStatusTone(target.task.status)),
				inspectEntry('blocked_by', localize('agentInspect.field.blockedBy', "Blocked by"), target.task.blockedBy),
				inspectEntry('last_message', localize('agentInspect.field.lastMessage', "Last message"), target.task.lastMessage),
				inspectEntry('description', localize('agentInspect.field.description', "Description"), target.task.description),
			];
		case 'activity':
			return [
				inspectEntry('tool', localize('agentInspect.field.tool', "Tool"), target.item.toolName),
				inspectEntry('agent', localize('agentInspect.field.agent', "Agent"), target.item.agentId ?? ''),
				inspectEntry('status', localize('agentInspect.field.status', "Status"), target.item.status, agentStatusTone(target.item.status)),
				inspectEntry('itemId', localize('agentInspect.field.itemId', "Item ID"), target.item.itemId),
			];
	}
}

export class AgentInspectView extends ViewPane {

	static readonly ID = AGENT_INSPECT_VIEW_ID;

	private list: WorkbenchList<IAgentInspectEntry> | undefined;
	private listContainer: HTMLElement | undefined;
	private entries: IAgentInspectEntry[] = [];
	private staleNote: HTMLElement | undefined;
	private bodyHeight = 0;
	private bodyWidth = 0;

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

		container.classList.add('agent-inspect-body');
		this.staleNote = dom.append(container, $('.agent-inspect-stale-note'));
		this.staleNote.textContent = localize('agentInspectView.staleTarget', "No longer in the current tree");
		this.staleNote.style.display = 'none';
		this.listContainer = dom.append(container, $('.agent-inspect-list'));
		this.ensureList();
		this.renderTarget();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.bodyHeight = height;
		this.bodyWidth = width;
		const compact = width > 0 && width < 300;
		const compactChanged = compact !== this.element.classList.contains('is-compact');
		this.element.classList.toggle('is-narrow', width > 0 && width < 600);
		this.element.classList.toggle('is-compact', compact);
		if (compactChanged && this.list) {
			this.list.splice(0, this.list.length, this.entries);
		}
		this.layoutInspectList();
	}

	private layoutInspectList(): void {
		const staleHeight = this.staleNote && this.staleNote.style.display !== 'none'
			? this.staleNote.offsetHeight
			: 0;
		this.list?.layout(Math.max(0, this.bodyHeight - staleHeight), this.bodyWidth);
	}

	private ensureList(): WorkbenchList<IAgentInspectEntry> {
		if (this.list) {
			return this.list;
		}

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'AgentInspect',
			this.listContainer!,
			new InspectDelegate(() => this.element.classList.contains('is-compact')),
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
		this.layoutInspectList();
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
