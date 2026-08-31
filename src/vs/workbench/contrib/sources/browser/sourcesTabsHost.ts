/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesTabs.css';
import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { DEFAULT_SOURCES_TAB, nextSourcesTab, SOURCES_TAB_ORDER, SourcesTabId } from '../common/sourcesTabs.js';
import { SourcesChangesList } from './sourcesChangesList.js';
import { SourcesFilesList } from './sourcesFilesList.js';
import { SourcesReviewList } from './sourcesReviewList.js';

const $ = dom.$;

interface ISourcesTabDescriptor {
	readonly id: SourcesTabId;
	readonly label: string;
}

const TAB_DESCRIPTORS: readonly ISourcesTabDescriptor[] = [
	{ id: SourcesTabId.Files, label: localize('sourcesTab.files', "Files") },
	{ id: SourcesTabId.Changes, label: localize('sourcesTab.changes', "Changes") },
	{ id: SourcesTabId.Review, label: localize('sourcesTab.review', "Review") },
];

export class SourcesTabsHost extends Disposable {

	private selectedTab: SourcesTabId = DEFAULT_SOURCES_TAB;
	private readonly tabButtons = new Map<SourcesTabId, HTMLElement>();
	private readonly tabPanels = new Map<SourcesTabId, HTMLElement>();
	private tabList: HTMLElement | undefined;

	constructor(
		private readonly tabHost: HTMLElement,
		private readonly contentHost: HTMLElement,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this.renderTabStrip();
		this.renderPanels();
		this.selectTab(DEFAULT_SOURCES_TAB, false);
	}

	private renderTabStrip(): void {
		this.tabHost.classList.add('sources-tab-host');

		const tabList = dom.append(this.tabHost, $('.sources-tab-list'));
		tabList.setAttribute('role', 'tablist');
		tabList.setAttribute('aria-label', localize('sourcesTabList.ariaLabel', "Sources tabs"));
		this.tabList = tabList;

		for (const descriptor of TAB_DESCRIPTORS) {
			const tab = dom.append(tabList, $('button.sources-tab'));
			tab.type = 'button';
			tab.setAttribute('role', 'tab');
			tab.setAttribute('data-tab-id', descriptor.id);
			tab.setAttribute('aria-controls', `sources-panel-${descriptor.id}`);
			tab.id = `sources-tab-${descriptor.id}`;
			tab.textContent = descriptor.label;

			this.tabButtons.set(descriptor.id, tab);

			this._register(dom.addDisposableListener(tab, dom.EventType.CLICK, () => {
				this.selectTab(descriptor.id, true);
			}));
		}

		this._register(dom.addDisposableListener(tabList, dom.EventType.KEY_DOWN, e => {
			this.onTabListKeyDown(new StandardKeyboardEvent(e));
		}));
	}

	private renderPanels(): void {
		this.contentHost.classList.add('sources-tabs-content');

		for (const tabId of SOURCES_TAB_ORDER) {
			const panel = dom.append(this.contentHost, $(`.sources-tab-panel#sources-panel-${tabId}`));
			panel.setAttribute('role', 'tabpanel');
			panel.setAttribute('aria-labelledby', `sources-tab-${tabId}`);
			panel.tabIndex = -1;
			this.tabPanels.set(tabId, panel);
		}

		const filesPanel = this.tabPanels.get(SourcesTabId.Files)!;
		filesPanel.classList.add('show-file-icons');
		this._register(this.instantiationService.createInstance(SourcesFilesList, filesPanel));

		const changesPanel = this.tabPanels.get(SourcesTabId.Changes)!;
		this._register(this.instantiationService.createInstance(SourcesChangesList, changesPanel));

		const reviewPanel = this.tabPanels.get(SourcesTabId.Review)!;
		this._register(this.instantiationService.createInstance(SourcesReviewList, reviewPanel));
	}

	private onTabListKeyDown(event: StandardKeyboardEvent): void {
		let nextTab: SourcesTabId | undefined;

		switch (event.keyCode) {
			case KeyCode.LeftArrow:
			case KeyCode.UpArrow:
				event.preventDefault();
				event.stopPropagation();
				nextTab = nextSourcesTab(this.selectedTab, -1);
				break;
			case KeyCode.RightArrow:
			case KeyCode.DownArrow:
				event.preventDefault();
				event.stopPropagation();
				nextTab = nextSourcesTab(this.selectedTab, 1);
				break;
			case KeyCode.Home:
				event.preventDefault();
				event.stopPropagation();
				nextTab = SOURCES_TAB_ORDER[0];
				break;
			case KeyCode.End:
				event.preventDefault();
				event.stopPropagation();
				nextTab = SOURCES_TAB_ORDER[SOURCES_TAB_ORDER.length - 1];
				break;
			case KeyCode.Enter:
			case KeyCode.Space:
				event.preventDefault();
				event.stopPropagation();
				this.tabButtons.get(this.selectedTab)?.focus();
				return;
		}

		if (nextTab !== undefined) {
			this.selectTab(nextTab, true);
		}
	}

	private selectTab(tabId: SourcesTabId, focusTab: boolean): void {
		if (this.selectedTab === tabId && !focusTab) {
			this.updateTabPresentation();
			return;
		}

		this.selectedTab = tabId;
		this.updateTabPresentation();

		if (focusTab) {
			this.tabButtons.get(tabId)?.focus();
		}
	}

	private updateTabPresentation(): void {
		for (const tabId of SOURCES_TAB_ORDER) {
			const selected = tabId === this.selectedTab;
			const tab = this.tabButtons.get(tabId);
			const panel = this.tabPanels.get(tabId);

			tab?.classList.toggle('selected', selected);
			tab?.setAttribute('aria-selected', String(selected));
			tab?.tabIndex = selected ? 0 : -1;

			panel?.classList.toggle('visible', selected);
			panel?.toggleAttribute('hidden', !selected);
		}
	}
}
