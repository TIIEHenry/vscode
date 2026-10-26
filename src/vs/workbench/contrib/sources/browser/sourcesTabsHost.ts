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
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { ISourcesPartService } from '../../../browser/parts/sources/sourcesPart.js';
import { DEFAULT_SOURCES_TAB, isSourcesTabId, nextSourcesTab, SOURCES_TAB_ORDER, SourcesTabId } from '../common/sourcesTabs.js';
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

export function sourcesSelectedTabStorageKey(sessionId: string): string {
	return `sources.selectedTab.session:${sessionId}`;
}

/** No window-level seed. A session with no stored tab stays on Files. */
export function readSourcesSelectedTab(read: (key: string) => string | undefined, sessionId: string): SourcesTabId {
	const stored = read(sourcesSelectedTabStorageKey(sessionId));
	return stored !== undefined && isSourcesTabId(stored) ? stored : DEFAULT_SOURCES_TAB;
}

/** Save the tab being left, then read the tab the next session last had. */
export function sourcesTabForSessionChange(
	leaving: { readonly sessionId: string; readonly tab: SourcesTabId },
	nextSessionId: string,
	read: (key: string) => string | undefined,
): { readonly saved: { readonly key: string; readonly tab: SourcesTabId }; readonly restored: SourcesTabId } {
	return {
		saved: { key: sourcesSelectedTabStorageKey(leaving.sessionId), tab: leaving.tab },
		restored: readSourcesSelectedTab(read, nextSessionId),
	};
}

export class SourcesTabsHost extends Disposable implements ISourcesReviewListHost {

	private selectedTab: SourcesTabId = DEFAULT_SOURCES_TAB;
	private selectedTabSessionId: string | undefined;
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
		@ISourcesReviewHostService private readonly reviewHostService: ISourcesReviewHostService,
		@ISourcesPartService private readonly sourcesPartService: ISourcesPartService,
		@IStorageService private readonly storageService: IStorageService,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
	) {
		super();

		this.reviewHostService.registerReviewListHost(this);

		this.renderTabStrip();
		this.renderPanels();
		this.selectedTabSessionId = this.session.getActiveSessionId();
		const initialTab = this.selectedTabSessionId
			? readSourcesSelectedTab(key => this.storageService.get(key, StorageScope.WORKSPACE), this.selectedTabSessionId)
			: DEFAULT_SOURCES_TAB;
		this.selectTab(initialTab, false);
		this._register(this.session.onDidChangeActiveSession(sessionId => this.restoreTabForSession(sessionId)));
		this.sourcesPartService.setFocusDelegate(() => this.focusSelectedPanel());
		const observer = new ResizeObserver(() => this.syncFilterDock());
		observer.observe(this.tabHost);
		this._register(toDisposable(() => observer.disconnect()));
		this.syncFilterDock();
	}

	override dispose(): void {
		this.sourcesPartService.setFocusDelegate(undefined);
		this.reviewHostService.registerReviewListHost(undefined);
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

	getFilterSlot(): HTMLElement | undefined {
		return this.filterSlot;
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

		const changed = this.selectedTab !== tabId;
		this.selectedTab = tabId;
		if (changed) {
			this.persistSelectedTab();
		}
		this.updateTabPresentation();

		if (focusTab) {
			this.tabButtons.get(tabId)?.focus();
		}
	}

	private persistSelectedTab(): void {
		const sessionId = this.selectedTabSessionId;
		if (!sessionId) {
			return;
		}
		this.storageService.store(sourcesSelectedTabStorageKey(sessionId), this.selectedTab, StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	private restoreTabForSession(nextSessionId: string): void {
		const leavingId = this.selectedTabSessionId;
		if (!leavingId || leavingId === nextSessionId) {
			this.selectedTabSessionId = nextSessionId;
			return;
		}
		const change = sourcesTabForSessionChange(
			{ sessionId: leavingId, tab: this.selectedTab },
			nextSessionId,
			key => this.storageService.get(key, StorageScope.WORKSPACE),
		);
		this.storageService.store(change.saved.key, change.saved.tab, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this.selectedTabSessionId = nextSessionId;
		this.selectTab(change.restored, false);
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
		const isFiles = this.selectedTab === SourcesTabId.Files;
		const dock = sourcesFilterFitsOnBar(this.partWidth()) ? slot : undefined;
		this.filesExplorer?.setFilterDock(isFiles ? dock : undefined);
		this.filesExplorer?.setActionsDock(isFiles ? slot : undefined);
		this.changesList?.setFilterDock(this.selectedTab === SourcesTabId.Changes ? dock : undefined);
		this.reviewList?.setFilterDock(this.selectedTab === SourcesTabId.Review ? dock : undefined);
	}

	private partWidth(): number {
		const part = this.tabHost.closest('.part.sources');
		return dom.isHTMLElement(part) ? part.clientWidth : 0;
	}

	private focusDockedFilter(): boolean {
		const slot = this.filterSlot;
		if (!slot || !sourcesFilterFitsOnBar(this.partWidth())) {
			return false;
		}
		const input = findFirstInput(slot);
		if (!input || input.offsetParent === null) {
			return false;
		}
		input.focus();
		return dom.isActiveElement(input);
	}
}

function findFirstInput(container: HTMLElement): HTMLInputElement | undefined {
	for (let i = 0; i < container.children.length; i++) {
		const child = container.children[i];
		if (dom.isHTMLInputElement(child)) {
			return child;
		}
		if (dom.isHTMLElement(child)) {
			const nested = findFirstInput(child);
			if (nested) {
				return nested;
			}
		}
	}
	return undefined;
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
