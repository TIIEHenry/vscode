/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/navigatorProjectsList.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { splitRecentLabel } from '../../../../base/common/labels.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Verbosity, ILabelService } from '../../../../platform/label/common/label.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWindowOpenable } from '../../../../platform/window/common/window.js';
import { isRecentFolder, IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { matchesNavigatorProjectsInlineFilter } from '../common/navigatorProjectsInlineFilter.js';
import { NavigatorProjectsInlineFilterBox } from './navigatorProjectsInlineFilterBox.js';
import { NAVIGATOR_PROJECTS_VIEW_ID } from './navigatorStubView.js';

const $ = dom.$;

export interface INavigatorProjectEntry {
	readonly id: string;
	readonly resource: URI;
	readonly name: string;
	readonly description?: string;
	readonly openable: IWindowOpenable;
	readonly remoteAuthority?: string;
}

class ProjectsDelegate implements IListVirtualDelegate<INavigatorProjectEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'navigatorProject';
	}
}

interface IProjectTemplateData {
	readonly container: HTMLElement;
	readonly label: IResourceLabel;
}

class ProjectsRenderer implements IListRenderer<INavigatorProjectEntry, IProjectTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorProject';

	readonly templateId = ProjectsRenderer.TEMPLATE_ID;

	constructor(private readonly labels: ResourceLabels) { }

	renderTemplate(container: HTMLElement): IProjectTemplateData {
		const label = this.labels.create(container, { supportDescriptionHighlights: true });
		return { container, label };
	}

	renderElement(entry: INavigatorProjectEntry, _index: number, templateData: IProjectTemplateData): void {
		templateData.label.setResource({
			resource: entry.resource,
			name: entry.name,
			description: entry.description,
		}, { hideIcon: false });
	}

	disposeTemplate(templateData: IProjectTemplateData): void {
		templateData.label.dispose();
	}
}

class ProjectsAccessibilityProvider implements IListAccessibilityProvider<INavigatorProjectEntry> {
	getWidgetAriaLabel(): string {
		return localize('navigatorProjectsView.ariaLabel', "Projects");
	}

	getAriaLabel(entry: INavigatorProjectEntry): string {
		return entry.description ? `${entry.name}, ${entry.description}` : entry.name;
	}
}

export class NavigatorProjectsView extends ViewPane {

	static readonly ID = NAVIGATOR_PROJECTS_VIEW_ID;

	private list: WorkbenchList<INavigatorProjectEntry> | undefined;
	private listContainer: HTMLElement | undefined;
	private filterBox: NavigatorProjectsInlineFilterBox | undefined;
	private filterQuery = '';
	private entries: INavigatorProjectEntry[] = [];

	constructor(
		options: IViewPaneOptions,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IWorkspacesService private readonly workspacesService: IWorkspacesService,
		@ILabelService private readonly labelService: ILabelService,
		@IHostService private readonly hostService: IHostService,
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

		this._register(this.contextService.onDidChangeWorkbenchState(() => this.refresh()));
		this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.refresh()));
		this._register(this.workspacesService.onDidChangeRecentlyOpened(() => this.refresh()));
		this._register(this.labelService.onDidChangeFormatters(() => this.refresh()));
	}

	override shouldShowWelcome(): boolean {
		return this.entries.length === 0;
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		container.classList.add('show-file-icons', 'navigator-projects-body');

		const filterPlaceholder = localize('navigatorProjectsFilterPlaceholder', "Filter projects");
		this.filterBox = this._register(new NavigatorProjectsInlineFilterBox(
			container,
			filterPlaceholder,
			filterPlaceholder,
		));
		this.filterBox.setVisible(false);
		this._register(this.filterBox.onDidChange(query => {
			this.filterQuery = query;
			this.applyFilterToList();
		}));

		this.listContainer = dom.append(container, $('.navigator-projects-list'));
		this.ensureList();
		this.refresh();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		const filterHeight = this.entries.length > 0 ? NavigatorProjectsInlineFilterBox.HEIGHT : 0;
		this.list?.layout(height - filterHeight, width);
	}

	private ensureList(): WorkbenchList<INavigatorProjectEntry> {
		if (this.list) {
			return this.list;
		}

		const labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility }));
		const delegate = new ProjectsDelegate();
		const renderer = new ProjectsRenderer(labels);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'NavigatorProjects',
			this.listContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (entry: INavigatorProjectEntry) => entry.id },
				accessibilityProvider: new ProjectsAccessibilityProvider(),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<INavigatorProjectEntry>;

		this._register(this.list.onDidOpen(e => this.openProjectEntry(e.element, e.browserEvent)));

		return this.list;
	}

	private openProjectEntry(entry: INavigatorProjectEntry | undefined, browserEvent?: UIEvent): void {
		if (!entry) {
			return;
		}

		const mouseEvent = browserEvent instanceof MouseEvent ? browserEvent : undefined;
		void this.hostService.openWindow([entry.openable], {
			forceNewWindow: !!(mouseEvent && (mouseEvent.ctrlKey || mouseEvent.metaKey)),
			forceReuseWindow: !!(mouseEvent && mouseEvent.altKey),
			remoteAuthority: entry.remoteAuthority ?? null,
		});
	}

	private refresh(): void {
		const currentEntries = this.getCurrentFolderEntries();
		this.setEntries(currentEntries);
		void this.appendRecentEntries();
	}

	private async appendRecentEntries(): Promise<void> {
		const recentEntries = await this.getRecentFolderEntries();
		this.setEntries([...this.getCurrentFolderEntries(), ...recentEntries]);
	}

	private setEntries(entries: INavigatorProjectEntry[]): void {
		const hadEntries = this.entries.length > 0;
		this.entries = entries;
		const hasEntries = entries.length > 0;

		this.filterBox?.setVisible(hasEntries);

		if (this.list) {
			this.applyFilterToList();
		}

		if (hadEntries !== hasEntries) {
			this._onDidChangeViewWelcomeState.fire();
		}
	}

	private applyFilterToList(): void {
		if (!this.list) {
			return;
		}

		const filtered = this.getFilteredEntries();
		this.list.splice(0, this.list.length, filtered);
	}

	private getFilteredEntries(): INavigatorProjectEntry[] {
		return this.entries.filter(entry => matchesNavigatorProjectsInlineFilter(entry.name, entry.description, this.filterQuery));
	}

	private getCurrentFolderEntries(): INavigatorProjectEntry[] {
		return this.contextService.getWorkspace().folders.map(folder => {
			const fullLabel = this.labelService.getWorkspaceLabel(folder.uri, { verbose: Verbosity.LONG });
			const { name, parentPath } = splitRecentLabel(fullLabel);
			return {
				id: `current:${folder.uri.toString()}`,
				resource: folder.uri,
				name: folder.name || name,
				description: parentPath || undefined,
				openable: { folderUri: folder.uri },
				remoteAuthority: folder.uri.scheme === 'vscode-remote' ? folder.uri.authority : undefined,
			};
		});
	}

	private async getRecentFolderEntries(): Promise<INavigatorProjectEntry[]> {
		const recentlyOpened = await this.workspacesService.getRecentlyOpened();
		const currentUris = new Set(this.contextService.getWorkspace().folders.map(folder => folder.uri.toString()));
		const entries: INavigatorProjectEntry[] = [];

		for (const recent of recentlyOpened.workspaces) {
			if (!isRecentFolder(recent)) {
				continue;
			}

			const uriString = recent.folderUri.toString();
			if (currentUris.has(uriString)) {
				continue;
			}

			const fullLabel = recent.label || this.labelService.getWorkspaceLabel(recent.folderUri, { verbose: Verbosity.LONG });
			const { name, parentPath } = splitRecentLabel(fullLabel);
			entries.push({
				id: `recent:${uriString}`,
				resource: recent.folderUri,
				name,
				description: parentPath || undefined,
				openable: { folderUri: recent.folderUri },
				remoteAuthority: recent.remoteAuthority,
			});
		}

		return entries;
	}
}
