/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesReviewList.css';
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
import { filterSourcesEntries } from '../common/sourcesFilterModel.js';
import { collectSourcesReviewEntries, ISourcesReviewEntry } from '../common/sourcesReviewModel.js';
import { SourcesListFilterBox } from './sourcesListFilterBox.js';

const $ = dom.$;

class SourcesReviewDelegate implements IListVirtualDelegate<ISourcesReviewEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'sourcesReview';
	}
}

interface ISourcesReviewTemplateData {
	readonly container: HTMLElement;
	readonly label: IResourceLabel;
}

class SourcesReviewRenderer implements IListRenderer<ISourcesReviewEntry, ISourcesReviewTemplateData> {
	static readonly TEMPLATE_ID = 'sourcesReview';

	readonly templateId = SourcesReviewRenderer.TEMPLATE_ID;

	constructor(private readonly labels: ResourceLabels) { }

	renderTemplate(container: HTMLElement): ISourcesReviewTemplateData {
		const label = this.labels.create(container, { supportDescriptionHighlights: true });
		return { container, label };
	}

	renderElement(element: ISourcesReviewEntry, _index: number, templateData: ISourcesReviewTemplateData): void {
		templateData.label.setResource({
			resource: element.resource,
			name: element.name,
			description: element.description,
		}, { hideIcon: false });
	}

	disposeTemplate(templateData: ISourcesReviewTemplateData): void {
		templateData.label.dispose();
	}
}

class SourcesReviewAccessibilityProvider implements IListAccessibilityProvider<ISourcesReviewEntry> {
	getWidgetAriaLabel(): string {
		return localize('sourcesReviewList.ariaLabel', "Sources Review");
	}

	getAriaLabel(element: ISourcesReviewEntry): string {
		return `${element.name}, ${element.description}`;
	}
}

export class SourcesReviewList extends Disposable {

	private readonly filterBox: SourcesListFilterBox;
	private readonly listContainer: HTMLElement;
	private readonly emptyMessage: HTMLElement;
	private list: WorkbenchList<ISourcesReviewEntry> | undefined;
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

		this.filterBox = this._register(new SourcesListFilterBox(
			host,
			localize('sourcesReviewList.filterPlaceholder', "Filter changes"),
			localize('sourcesReviewList.filterAriaLabel', "Filter changes"),
		));
		this._register(this.filterBox.onDidChange(() => this.scheduleRefresh()));

		this.listContainer = dom.append(host, $('.sources-review-list'));
		this.emptyMessage = dom.append(host, $('.sources-review-empty'));
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

	private ensureList(): WorkbenchList<ISourcesReviewEntry> {
		if (this.list) {
			return this.list;
		}

		this.labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const delegate = new SourcesReviewDelegate();
		const renderer = new SourcesReviewRenderer(this.labels);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'SourcesReview',
			this.listContainer,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (element: ISourcesReviewEntry) => element.resource.toString() },
				accessibilityProvider: new SourcesReviewAccessibilityProvider(),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesReviewEntry>;

		this._register(this.list.onDidOpen(async e => {
			const element = e.element;
			if (!element) {
				return;
			}

			await this.editorService.openEditor({
				resource: element.resource,
				options: {
					preserveFocus: e.editorOptions.preserveFocus,
					pinned: false,
					source: EditorOpenSource.USER,
				},
			}, ACTIVE_GROUP);
		}));

		return this.list;
	}

	private refresh(): void {
		const hasRepository = this.scmService.repositoryCount > 0;
		const allEntries = collectSourcesReviewEntries(this.scmService.repositories);
		const entries = filterSourcesEntries(allEntries, this.filterBox.value);
		const hasAnyEntries = allEntries.length > 0;
		const hasVisibleEntries = entries.length > 0;

		if (!hasRepository) {
			this.emptyMessage.textContent = localize('sourcesReviewList.noRepository', "No source control repository.");
		} else if (!hasAnyEntries) {
			this.emptyMessage.textContent = localize('sourcesReviewList.noChanges', "No changes to review.");
		} else if (!hasVisibleEntries) {
			this.emptyMessage.textContent = localize('sourcesReviewList.noMatching', "No matching changes.");
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
