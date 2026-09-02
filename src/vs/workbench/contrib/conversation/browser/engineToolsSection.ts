/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentToolSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	type EngineCatalogPaneMode,
	getCatalogTransportFailedCopy,
	getCatalogUnsupportedCopy,
	getCatalogUnknownCopy,
	resolveEngineCatalogPaneMode,
	shouldHideCatalogRows,
} from './engineCatalog.js';

const $ = DOM.$;

const TOOLS_FEATURE = localize('ua.engineToolsFeatureLabel', "engine tools");

type EngineToolListEntry = { readonly kind: 'tool'; readonly tool: UniverseAgentToolSummary };

class EngineToolListDelegate implements IListVirtualDelegate<EngineToolListEntry> {
	getHeight(_entry: EngineToolListEntry): number {
		return 36;
	}

	getTemplateId(_entry: EngineToolListEntry): string {
		return 'toolRow';
	}
}

interface IToolRowTemplateData {
	readonly name: HTMLElement;
	readonly description: HTMLElement;
}

class EngineToolRowRenderer implements IListRenderer<EngineToolListEntry, IToolRowTemplateData> {
	static readonly TEMPLATE_ID = 'toolRow';
	readonly templateId = EngineToolRowRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IToolRowTemplateData {
		const row = DOM.append(container, $('.engine-catalog-row'));
		const text = DOM.append(row, $('.engine-catalog-text'));
		return {
			name: DOM.append(text, $('.engine-catalog-name')),
			description: DOM.append(text, $('.engine-catalog-description')),
		};
	}

	renderElement(entry: EngineToolListEntry, _index: number, templateData: IToolRowTemplateData): void {
		templateData.name.textContent = entry.tool.name;
		const parts: string[] = [];
		if (entry.tool.category) {
			parts.push(entry.tool.category);
		}
		if (entry.tool.description) {
			parts.push(entry.tool.description);
		}
		templateData.description.textContent = parts.join(' — ');
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineToolListAccessibilityProvider implements IListAccessibilityProvider<EngineToolListEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.engineToolsList', "Engine tools");
	}

	getAriaLabel(entry: EngineToolListEntry): string {
		return entry.tool.name;
	}
}

export class EngineToolsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly list: WorkbenchList<EngineToolListEntry>;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineToolListEntry[] = [];

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-tools-section.engine-catalog-section'));
		this.container.style.display = 'none';

		const heading = DOM.append(this.container, $('h3'));
		heading.textContent = localize('ua.engineToolsSectionTitle', "Tools");

		this.statusMessage = DOM.append(this.container, $('.engine-catalog-status'));
		this.statusMessage.style.display = 'none';

		this.listContainer = DOM.append(this.container, $('.engine-catalog-list'));
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'EngineTools',
			this.listContainer,
			new EngineToolListDelegate(),
			[new EngineToolRowRenderer()],
			{
				identityProvider: {
					getId: (entry: EngineToolListEntry) => `tool:${entry.tool.name}`,
				},
				accessibilityProvider: new EngineToolListAccessibilityProvider(),
			},
		)) as WorkbenchList<EngineToolListEntry>;

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh();
		}));

		void this.refresh();
	}

	layout(width: number, listHeight: number): void {
		this.list.layout(Math.max(80, listHeight), width);
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	getMode(): EngineCatalogPaneMode {
		return this.mode;
	}

	getListEntryCount(): number {
		return this.listEntries.length;
	}

	private async refresh(): Promise<void> {
		this.clearCatalogPresentation();

		const capabilities = this.connection.getCapabilitySnapshot();
		this.mode = resolveEngineCatalogPaneMode(
			this.connection.isEngineConnected(),
			capabilities.tools.support,
		);

		if (this.mode === 'disconnected') {
			this.container.style.display = 'none';
			return;
		}

		this.container.style.display = '';

		if (shouldHideCatalogRows(this.mode)) {
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = this.mode === 'unknown'
				? getCatalogUnknownCopy()
				: getCatalogUnsupportedCopy(TOOLS_FEATURE, capabilities.tools.reason);
			return;
		}

		this.listContainer.style.display = '';

		try {
			const result = await this.connection.listTools();
			if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				return;
			}
			this.setTools(result.tools);
		} catch {
			this.clearCatalogPresentation();
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = getCatalogTransportFailedCopy(TOOLS_FEATURE);
		}
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.list.splice(0, this.list.length, []);
		this.statusMessage.style.display = 'none';
		this.statusMessage.textContent = '';
		this.listContainer.style.display = 'none';
	}

	private setTools(tools: readonly UniverseAgentToolSummary[]): void {
		const entries: EngineToolListEntry[] = tools.map(tool => ({ kind: 'tool', tool }));
		this.listEntries = entries;
		this.list.splice(0, this.list.length, entries);
	}
}
