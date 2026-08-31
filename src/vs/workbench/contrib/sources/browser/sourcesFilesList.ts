/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesFilesList.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IExplorerService } from '../../files/browser/files.js';
import { filterSourcesEntries } from '../common/sourcesFilterModel.js';
import { collectSourcesFileEntries, ISourcesFileEntry } from '../common/sourcesFilesModel.js';
import { SourcesListFilterBox } from './sourcesListFilterBox.js';

const $ = dom.$;

class SourcesFilesDelegate implements IListVirtualDelegate<ISourcesFileEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'sourcesFile';
	}
}

interface ISourcesFileTemplateData {
	readonly container: HTMLElement;
	readonly label: IResourceLabel;
}

class SourcesFilesRenderer implements IListRenderer<ISourcesFileEntry, ISourcesFileTemplateData> {
	static readonly TEMPLATE_ID = 'sourcesFile';

	readonly templateId = SourcesFilesRenderer.TEMPLATE_ID;

	constructor(private readonly labels: ResourceLabels) { }

	renderTemplate(container: HTMLElement): ISourcesFileTemplateData {
		const label = this.labels.create(container, { supportDescriptionHighlights: true });
		return { container, label };
	}

	renderElement(element: ISourcesFileEntry, _index: number, templateData: ISourcesFileTemplateData): void {
		templateData.label.setResource({
			resource: element.resource,
			name: element.name,
			description: element.description,
		}, { hideIcon: false });
	}

	disposeTemplate(templateData: ISourcesFileTemplateData): void {
		templateData.label.dispose();
	}
}

class SourcesFilesAccessibilityProvider implements IListAccessibilityProvider<ISourcesFileEntry> {
	getWidgetAriaLabel(): string {
		return localize('sourcesFilesList.ariaLabel', "Sources Files");
	}

	getAriaLabel(element: ISourcesFileEntry): string {
		return element.description;
	}
}

export class SourcesFilesList extends Disposable {

	private readonly listContainer: HTMLElement;
	private readonly emptyMessage: HTMLElement;
	private readonly filterBox: SourcesListFilterBox;
	private list: WorkbenchList<ISourcesFileEntry> | undefined;
	private labels: ResourceLabels | undefined;
	private readonly refreshScheduler: RunOnceScheduler;

	constructor(
		host: HTMLElement,
		@IExplorerService private readonly explorerService: IExplorerService,
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		host.classList.add('show-file-icons');

		this.filterBox = this._register(new SourcesListFilterBox(
			host,
			localize('sourcesFilesList.filterPlaceholder', "Filter files"),
			localize('sourcesFilesList.filterAriaLabel', "Filter files"),
		));
		this._register(this.filterBox.onDidChange(() => this.scheduleRefresh()));

		this.listContainer = dom.append(host, $('.sources-files-list'));
		this.emptyMessage = dom.append(host, $('.sources-files-empty'));
		this.emptyMessage.style.display = 'none';

		this.refreshScheduler = this._register(new RunOnceScheduler(() => this.refresh(), 250));
		this.scheduleRefresh();

		this._register(this.fileService.onDidFilesChange(() => this.scheduleRefresh()));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('explorer.sortOrder') || e.affectsConfiguration('explorer.fileNesting')) {
				this.scheduleRefresh();
			}
		}));
	}

	private scheduleRefresh(): void {
		if (!this.refreshScheduler.isScheduled()) {
			this.refreshScheduler.schedule();
		}
	}

	private ensureList(): WorkbenchList<ISourcesFileEntry> {
		if (this.list) {
			return this.list;
		}

		this.labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const delegate = new SourcesFilesDelegate();
		const renderer = new SourcesFilesRenderer(this.labels);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'SourcesFiles',
			this.listContainer,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (element: ISourcesFileEntry) => element.resource.toString() },
				accessibilityProvider: new SourcesFilesAccessibilityProvider(),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesFileEntry>;

		this._register(this.list.onDidOpen(async e => {
			const element = e.element;
			if (!element) {
				return;
			}

			await this.editorService.openEditor({
				resource: element.resource,
				options: {
					preserveFocus: e.editorOptions.preserveFocus,
					pinned: e.editorOptions.pinned,
					source: EditorOpenSource.USER,
				},
			}, ACTIVE_GROUP);
		}));

		return this.list;
	}

	private async refresh(): Promise<void> {
		const sortOrder = this.explorerService.sortOrderConfiguration.sortOrder;
		const allEntries = await collectSourcesFileEntries(this.explorerService.roots, sortOrder);
		const entries = filterSourcesEntries(allEntries, this.filterBox.value);

		const hasAnyEntries = allEntries.length > 0;
		const hasVisibleEntries = entries.length > 0;

		if (!hasAnyEntries) {
			this.emptyMessage.textContent = localize('sourcesFilesList.empty', "No workspace files to show.");
		} else if (!hasVisibleEntries) {
			this.emptyMessage.textContent = localize('sourcesFilesList.noMatching', "No matching files.");
		}

		this.emptyMessage.style.display = hasVisibleEntries ? 'none' : 'block';
		this.listContainer.style.display = hasVisibleEntries ? 'block' : 'none';
		this.filterBox.element.style.display = hasAnyEntries ? 'block' : 'none';

		if (!hasVisibleEntries) {
			return;
		}

		const list = this.ensureList();
		list.splice(0, list.length, entries);
	}
}
