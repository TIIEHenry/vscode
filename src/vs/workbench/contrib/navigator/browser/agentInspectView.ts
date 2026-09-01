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

export class AgentInspectView extends ViewPane {

	static readonly ID = AGENT_INSPECT_VIEW_ID;

	private list: WorkbenchList<IAgentInspectEntry> | undefined;
	private listContainer: HTMLElement | undefined;
	private entries: IAgentInspectEntry[] = [];

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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	override shouldShowWelcome(): boolean {
		return this.entries.length === 0;
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.listContainer = dom.append(container, $('.agent-inspect-list'));
		this.ensureList();
		this.setEntries([]);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.list?.layout(height, width);
	}

	private ensureList(): WorkbenchList<IAgentInspectEntry> {
		if (this.list) {
			return this.list;
		}

		const delegate = new InspectDelegate();
		const renderer = new InspectRenderer();

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'AgentInspect',
			this.listContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (entry: IAgentInspectEntry) => entry.id },
				accessibilityProvider: new InspectAccessibilityProvider(),
			}
		)) as WorkbenchList<IAgentInspectEntry>;

		return this.list;
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
