/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesChangesList.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import { collectSourcesChangeEntries, ISourcesChangeEntry } from '../common/sourcesChangesModel.js';

const $ = dom.$;

class SourcesChangesDelegate implements IListVirtualDelegate<ISourcesChangeEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'sourcesChange';
	}
}

interface ISourcesChangeTemplateData {
	readonly container: HTMLElement;
	readonly label: IResourceLabel;
}

class SourcesChangesRenderer implements IListRenderer<ISourcesChangeEntry, ISourcesChangeTemplateData> {
	static readonly TEMPLATE_ID = 'sourcesChange';

	readonly templateId = SourcesChangesRenderer.TEMPLATE_ID;

	constructor(private readonly labels: ResourceLabels) { }

	renderTemplate(container: HTMLElement): ISourcesChangeTemplateData {
		const label = this.labels.create(container, { supportDescriptionHighlights: true });
		return { container, label };
	}

	renderElement(element: ISourcesChangeEntry, _index: number, templateData: ISourcesChangeTemplateData): void {
		templateData.label.setResource({
			resource: element.resource,
			name: element.name,
			description: element.description,
		}, { hideIcon: false });
	}

	disposeTemplate(templateData: ISourcesChangeTemplateData): void {
		templateData.label.dispose();
	}
}

class SourcesChangesAccessibilityProvider implements IListAccessibilityProvider<ISourcesChangeEntry> {
	getWidgetAriaLabel(): string {
		return localize('sourcesChangesList.ariaLabel', "Sources Changes");
	}

	getAriaLabel(element: ISourcesChangeEntry): string {
		return `${element.name}, ${element.description}`;
	}
}

export class SourcesChangesList extends Disposable {

	private readonly listContainer: HTMLElement;
	private readonly emptyMessage: HTMLElement;
	private list: WorkbenchList<ISourcesChangeEntry> | undefined;
	private labels: ResourceLabels | undefined;
	private readonly refreshScheduler: RunOnceScheduler;
	private readonly repositoryListeners = this._register(new DisposableMap<ISCMRepository>());

	constructor(
		host: HTMLElement,
		@ISCMService private readonly scmService: ISCMService,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		host.classList.add('show-file-icons');

		this.listContainer = dom.append(host, $('.sources-changes-list'));
		this.emptyMessage = dom.append(host, $('.sources-changes-empty'));
		this.emptyMessage.style.display = 'none';

		this.refreshScheduler = this._register(new RunOnceScheduler(() => this.refresh(), 250));
		this.scheduleRefresh();

		this._register(this.scmService.onDidAddRepository(repo => {
			this.registerRepository(repo);
			this.scheduleRefresh();
		}));
		this._register(this.scmService.onDidRemoveRepository(repo => {
			this.unregisterRepository(repo);
			this.scheduleRefresh();
		}));

		for (const repo of this.scmService.repositories) {
			this.registerRepository(repo);
		}
	}

	private registerRepository(repo: ISCMRepository): void {
		if (this.repositoryListeners.has(repo)) {
			return;
		}

		const store = new DisposableStore();
		store.add(repo.provider.onDidChangeResources(() => this.scheduleRefresh()));
		store.add(repo.provider.onDidChangeResourceGroups(() => this.scheduleRefresh()));
		this.repositoryListeners.set(repo, store);
	}

	private unregisterRepository(repo: ISCMRepository): void {
		this.repositoryListeners.deleteAndDispose(repo);
	}

	private scheduleRefresh(): void {
		if (!this.refreshScheduler.isScheduled()) {
			this.refreshScheduler.schedule();
		}
	}

	private ensureList(): WorkbenchList<ISourcesChangeEntry> {
		if (this.list) {
			return this.list;
		}

		this.labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const delegate = new SourcesChangesDelegate();
		const renderer = new SourcesChangesRenderer(this.labels);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'SourcesChanges',
			this.listContainer,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (element: ISourcesChangeEntry) => element.resource.toString() },
				accessibilityProvider: new SourcesChangesAccessibilityProvider(),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesChangeEntry>;

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

	private refresh(): void {
		const hasRepository = this.scmService.repositoryCount > 0;
		const entries = collectSourcesChangeEntries(this.scmService.repositories);
		const hasEntries = entries.length > 0;

		if (!hasRepository) {
			this.emptyMessage.textContent = localize('sourcesChangesList.noRepository', "No source control repository.");
		} else if (!hasEntries) {
			this.emptyMessage.textContent = localize('sourcesChangesList.noChanges', "No changes.");
		}

		this.emptyMessage.style.display = hasEntries ? 'none' : 'block';
		this.listContainer.style.display = hasEntries ? 'block' : 'none';

		if (!hasEntries) {
			return;
		}

		const list = this.ensureList();
		list.splice(0, list.length, entries);
	}
}
