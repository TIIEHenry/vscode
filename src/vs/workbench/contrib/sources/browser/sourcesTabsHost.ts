/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesTabs.css';
import './sourcesReview.contribution.js';
import * as dom from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { URI } from '../../../../base/common/uri.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ISourcesPartService } from '../../../browser/parts/sources/sourcesPart.js';
import { DEFAULT_SOURCES_TAB, nextSourcesTab, SOURCES_TAB_ORDER, SourcesTabId } from '../common/sourcesTabs.js';
import { ISourcesReviewHostService, ISourcesReviewListHost } from '../common/sourcesReviewHostService.js';
import { ISourcesReviewEntry } from '../common/sourcesReviewModel.js';
import { SourcesChangesList } from './sourcesChangesList.js';
import { SourcesFilesExplorerHost } from './sourcesFilesExplorer.js';
import { SourcesReviewList } from './sourcesReviewList.js';
import { sourcesFilterFitsOnBar } from '../common/sourcesFilesListMode.js';

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

export class SourcesTabsHost extends Disposable implements ISourcesReviewListHost {

	private selectedTab: SourcesTabId = DEFAULT_SOURCES_TAB;
	private readonly tabButtons = new Map<SourcesTabId, HTMLElement>();
	private readonly tabPanels = new Map<SourcesTabId, HTMLElement>();
	private reviewList: SourcesReviewList | undefined;
	private changesList: SourcesChangesList | undefined;
	private filesExplorer: SourcesFilesExplorerHost | undefined;
	private filterSlot: HTMLElement | undefined;

	constructor(
		private readonly tabHost: HTMLElement,
		private readonly contentHost: HTMLElement,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ISourcesReviewHostService reviewHostService: ISourcesReviewHostService,
		@ISourcesPartService private readonly sourcesPartService: ISourcesPartService,
	) {
		super();

		reviewHostService.registerReviewListHost(this);

		this.renderTabStrip();
		this.renderPanels();
		this.selectTab(DEFAULT_SOURCES_TAB, false);
		this.sourcesPartService.setFocusDelegate(() => this.focusSelectedPanel());
		const observer = new ResizeObserver(() => this.syncFilterDock());
		observer.observe(this.tabHost);
		this._register(toDisposable(() => observer.disconnect()));
		this.syncFilterDock();
	}

	override dispose(): void {
		this.sourcesPartService.setFocusDelegate(undefined);
		this.instantiationService.invokeFunction(accessor => {
			accessor.get(ISourcesReviewHostService).registerReviewListHost(undefined);
		});
		super.dispose();
	}

	selectReviewTab(): void {
		this.selectTab(SourcesTabId.Review, true);
	}

	setPathFilter(paths: URI[] | undefined): void {
		this.reviewList?.setPathFilter(paths);
	}

	getSelectedEntry(): ISourcesReviewEntry | undefined {
		return this.reviewList?.getSelectedEntry();
	}

	toggleReviewedSelected(): void {
		this.reviewList?.toggleReviewedSelected();
	}

	markAllReviewed(): void {
		this.reviewList?.markAllReviewed();
	}

	setStatusMessage(message: string | undefined, isError?: boolean): void {
		this.reviewList?.setStatusMessage(message, isError);
	}

	private focusSelectedPanel(): boolean {
		if (this.focusDockedFilter()) {
			return true;
		}
		const panel = this.tabPanels.get(this.selectedTab);
		const tab = this.tabButtons.get(this.selectedTab);
		// `visible` / absence of `hidden` is the selected panel. `.active` is not a tab state.
		if (panel && panel.classList.contains('visible') && !panel.hidden) {
			if (focusFirstControlInSourcesPanel(panel)) {
				return true;
			}
		}
		if (tab && tab.classList.contains('selected')) {
			tab.focus();
			return dom.isActiveElement(tab);
		}
		return false;
	}

	selectTab(tabId: SourcesTabId, focusTab: boolean): void {
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

	private renderTabStrip(): void {
		this.tabHost.classList.add('sources-tab-host');

		const tabList = dom.append(this.tabHost, $('.sources-tab-list'));
		tabList.setAttribute('role', 'tablist');
		tabList.setAttribute('aria-label', localize('sourcesTabList.ariaLabel', "Sources tabs"));

		for (const descriptor of TAB_DESCRIPTORS) {
			const tab = dom.append(tabList, $('button.sources-tab')) as HTMLButtonElement;
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

		this.filterSlot = dom.append(this.tabHost, $('.sources-title-filter'));
	}

	private renderPanels(): void {
		this.contentHost.classList.add('sources-tabs-content');

		for (const tabId of SOURCES_TAB_ORDER) {
			const panel = dom.append(this.contentHost, $(`#sources-panel-${tabId}.sources-tab-panel`));
			panel.setAttribute('role', 'tabpanel');
			panel.setAttribute('aria-labelledby', `sources-tab-${tabId}`);
			panel.tabIndex = -1;
			this.tabPanels.set(tabId, panel);
		}

		const filesPanel = this.tabPanels.get(SourcesTabId.Files)!;
		filesPanel.classList.add('show-file-icons');
		this.filesExplorer = this._register(this.instantiationService.createInstance(SourcesFilesExplorerHost, filesPanel));

		const changesPanel = this.tabPanels.get(SourcesTabId.Changes)!;
		this.changesList = this._register(this.instantiationService.createInstance(SourcesChangesList, changesPanel));

		const reviewPanel = this.tabPanels.get(SourcesTabId.Review)!;
		this.reviewList = this._register(this.instantiationService.createInstance(SourcesReviewList, reviewPanel));
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

	private updateTabPresentation(): void {
		for (const tabId of SOURCES_TAB_ORDER) {
			const selected = tabId === this.selectedTab;
			const tab = this.tabButtons.get(tabId);
			const panel = this.tabPanels.get(tabId);

			tab?.classList.toggle('selected', selected);
			tab?.setAttribute('aria-selected', String(selected));
			if (tab) {
				tab.tabIndex = selected ? 0 : -1;
				if (selected) {
					tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
				}
			}

			panel?.classList.toggle('visible', selected);
			panel?.toggleAttribute('hidden', !selected);
			if (tabId === SourcesTabId.Files) {
				this.filesExplorer?.setFilesTabActive(selected);
			}
		}
		this.syncFilterDock();
	}

	private syncFilterDock(): void {
		const slot = this.filterSlot;
		if (!slot) {
			return;
		}
		const dock = sourcesFilterFitsOnBar(this.partWidth()) ? slot : undefined;
		this.filesExplorer?.setFilterDock(this.selectedTab === SourcesTabId.Files ? dock : undefined);
		this.changesList?.setFilterDock(this.selectedTab === SourcesTabId.Changes ? dock : undefined);
		this.reviewList?.setFilterDock(this.selectedTab === SourcesTabId.Review ? dock : undefined);
	}

	private partWidth(): number {
		const part = this.tabHost.closest('.part.sources');
		return part instanceof HTMLElement ? part.clientWidth : 0;
	}

	private focusDockedFilter(): boolean {
		const slot = this.filterSlot;
		if (!slot || !sourcesFilterFitsOnBar(this.partWidth())) {
			return false;
		}
		const input = slot.querySelector('input');
		if (!(input instanceof HTMLInputElement) || input.offsetParent === null) {
			return false;
		}
		input.focus();
		return dom.isActiveElement(input);
	}
}

function focusFirstControlInSourcesPanel(panel: HTMLElement): boolean {
	const children = panel.children;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (!dom.isHTMLElement(child)) {
			continue;
		}
		if (focusSourcesControl(child)) {
			return true;
		}
	}
	return false;
}

function focusSourcesControl(element: HTMLElement): boolean {
	if (isSourcesNodeHidden(element)) {
		return false;
	}
	if (isSourcesFocusableControl(element)) {
		element.focus();
		if (dom.isActiveElement(element)) {
			return true;
		}
	}
	const children = element.children;
	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		if (!dom.isHTMLElement(child)) {
			continue;
		}
		if (focusSourcesControl(child)) {
			return true;
		}
	}
	return false;
}

function isSourcesNodeHidden(element: HTMLElement): boolean {
	if (element.hidden || element.getAttribute('aria-hidden') === 'true') {
		return true;
	}
	if (element.style.display === 'none' || element.style.visibility === 'hidden' || element.style.visibility === 'collapse') {
		return true;
	}
	const computed = dom.getWindow(element).getComputedStyle(element);
	return computed.display === 'none' || computed.visibility === 'hidden' || computed.visibility === 'collapse';
}

function isSourcesFocusableControl(element: HTMLElement): boolean {
	if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true' || element.classList.contains('disabled')) {
		return false;
	}
	if (element.tagName === 'INPUT' && element.getAttribute('type') === 'hidden') {
		return false;
	}
	return element.tabIndex >= 0;
}
