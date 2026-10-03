/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ISourcesPartService, SourcesPart } from '../../../../browser/parts/sources/sourcesPart.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SourcesChangesList } from '../../browser/sourcesChangesList.js';
import { SourcesFilesExplorerHost } from '../../browser/sourcesFilesExplorer.js';
import { SourcesReviewList } from '../../browser/sourcesReviewList.js';
import { SourcesTabsHost } from '../../browser/sourcesTabsHost.js';
import { ISourcesReviewHostService } from '../../common/sourcesReviewHostService.js';
import { SourcesTabId } from '../../common/sourcesTabs.js';

suite('Sources - part focus', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountPart(): { part: SourcesPart; parent: HTMLElement } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const part = store.add(instantiationService.createInstance(SourcesPart));
		const parent = mainWindow.document.createElement('div');
		mainWindow.document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);
		return { part, parent };
	}

	function mountHost(): {
		part: SourcesPart;
		parent: HTMLElement;
		host: SourcesTabsHost;
		filesPanel: HTMLElement;
		filesTab: HTMLElement;
		changesPanel: HTMLElement;
		changesTab: HTMLElement;
		reviewPanel: HTMLElement;
		reviewTab: HTMLElement;
	} {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stubInstance(SourcesFilesExplorerHost, Object.assign(toDisposable(() => { }), {
			setFilesTabActive() { },
		}));
		instantiationService.stubInstance(SourcesChangesList, toDisposable(() => { }));
		instantiationService.stubInstance(SourcesReviewList, toDisposable(() => { }));
		instantiationService.stub(ISourcesReviewHostService, {
			registerReviewListHost() { },
			showForPaths() { },
			getReviewListHost() { return undefined; },
		});

		const part = store.add(instantiationService.createInstance(SourcesPart));
		instantiationService.set(ISourcesPartService, part);

		const parent = mainWindow.document.createElement('div');
		mainWindow.document.body.appendChild(parent);
		part.create(parent);
		const tabHost = part.tabHost;
		const contentHost = part.contentHost;
		assert.ok(tabHost);
		assert.ok(contentHost);
		const host = store.add(instantiationService.createInstance(SourcesTabsHost, tabHost, contentHost));
		store.add(toDisposable(() => parent.remove()));

		const filesTab = tabById(tabHost, SourcesTabId.Files);
		// Decoy: the old fallback looked for `.sources-tab.active`, which this class is not.
		filesTab.classList.add('active');

		return {
			part,
			parent,
			host,
			filesPanel: panelByTab(contentHost, SourcesTabId.Files),
			filesTab,
			changesPanel: panelByTab(contentHost, SourcesTabId.Changes),
			changesTab: tabById(tabHost, SourcesTabId.Changes),
			reviewPanel: panelByTab(contentHost, SourcesTabId.Review),
			reviewTab: tabById(tabHost, SourcesTabId.Review),
		};
	}

	function tabById(tabHost: HTMLElement, tabId: SourcesTabId): HTMLElement {
		const tab = tabHost.querySelector(`#sources-tab-${tabId}`);
		assert.ok(tab instanceof HTMLElement, `missing tab ${tabId}`);
		return tab;
	}

	function panelByTab(contentHost: HTMLElement, tabId: SourcesTabId): HTMLElement {
		const panel = contentHost.querySelector(`[aria-labelledby="sources-tab-${tabId}"]`);
		assert.ok(panel instanceof HTMLElement, `missing panel ${tabId}`);
		return panel;
	}

	function appendFilesTrap(panel: HTMLElement): HTMLInputElement {
		const doc = mainWindow.document;
		const textarea = doc.createElement('textarea');
		const input = doc.createElement('input');
		const button = doc.createElement('button');
		const list = doc.createElement('div');
		list.className = 'monaco-list';
		list.tabIndex = 0;
		panel.append(textarea, input, button, list);
		return input;
	}

	function appendProbe(panel: HTMLElement): HTMLInputElement {
		const doc = mainWindow.document;
		const disabled = doc.createElement('a');
		disabled.className = 'monaco-button disabled';
		disabled.tabIndex = 0;
		disabled.setAttribute('aria-disabled', 'true');
		const input = doc.createElement('input');
		panel.append(disabled, input);
		return input;
	}

	function appendUnfocusable(panel: HTMLElement): void {
		const doc = mainWindow.document;
		const disabled = doc.createElement('button');
		disabled.disabled = true;
		const hidden = doc.createElement('div');
		hidden.style.display = 'none';
		hidden.appendChild(doc.createElement('input'));
		const hiddenArea = doc.createElement('textarea');
		hiddenArea.hidden = true;
		panel.append(disabled, hidden, hiddenArea);
	}

	test('tab aria-controls matches the panel id', () => {
		const mounted = mountHost();
		const cases = [
			{ tab: mounted.filesTab, panel: mounted.filesPanel, tabId: SourcesTabId.Files },
			{ tab: mounted.changesTab, panel: mounted.changesPanel, tabId: SourcesTabId.Changes },
			{ tab: mounted.reviewTab, panel: mounted.reviewPanel, tabId: SourcesTabId.Review },
		];
		for (const { tab, panel, tabId } of cases) {
			assert.strictEqual(panel.id, `sources-panel-${tabId}`);
			assert.strictEqual(tab.getAttribute('aria-controls'), panel.id);
			assert.strictEqual(panel.getAttribute('aria-labelledby'), tab.id);
			assert.strictEqual(mainWindow.document.getElementById(panel.id), panel);
			assert.ok(panel.classList.contains('sources-tab-panel'));
		}
	});

	test('focuses the part root when no delegate is registered', () => {
		const { part, parent } = mountPart();
		const contentHost = part.contentHost;
		const tabHost = part.tabHost;
		assert.ok(contentHost);
		assert.ok(tabHost);
		const filesInput = appendFilesTrap(contentHost);
		const decoy = mainWindow.document.createElement('button');
		decoy.className = 'sources-tab active';
		tabHost.appendChild(decoy);

		filesInput.focus();
		part.focus();

		assert.strictEqual(mainWindow.document.activeElement, parent);
	});

	test('focuses the part root when the delegate returns false', () => {
		const { part, parent } = mountPart();
		const contentHost = part.contentHost;
		assert.ok(contentHost);
		const filesInput = appendFilesTrap(contentHost);
		part.setFocusDelegate(() => false);

		filesInput.focus();
		part.focus();

		assert.strictEqual(mainWindow.document.activeElement, parent);
	});

	test('Changes focus stays in the visible panel and not on the Files input', () => {
		const mounted = mountHost();
		const filesInput = appendFilesTrap(mounted.filesPanel);
		const changesInput = appendProbe(mounted.changesPanel);
		mounted.host.selectTab(SourcesTabId.Changes, false);

		mounted.parent.focus();
		mounted.part.focus();

		assert.strictEqual(mounted.changesTab.classList.contains('selected'), true);
		assert.strictEqual(mounted.filesTab.classList.contains('selected'), false);
		assert.strictEqual(mounted.filesTab.classList.contains('active'), true);
		assert.strictEqual(mainWindow.document.activeElement, changesInput);
		assert.strictEqual(mounted.changesPanel.contains(mainWindow.document.activeElement), true);
		assert.strictEqual(mounted.filesPanel.contains(mainWindow.document.activeElement), false);
		assert.notStrictEqual(mainWindow.document.activeElement, filesInput);
		assert.notStrictEqual(mainWindow.document.activeElement, mounted.changesTab);
	});

	test('Review focus stays in the visible panel and not on the Files input', () => {
		const mounted = mountHost();
		const filesInput = appendFilesTrap(mounted.filesPanel);
		const reviewInput = appendProbe(mounted.reviewPanel);
		mounted.host.selectTab(SourcesTabId.Review, false);

		mounted.parent.focus();
		mounted.part.focus();

		assert.strictEqual(mounted.reviewTab.classList.contains('selected'), true);
		assert.strictEqual(mounted.filesTab.classList.contains('active'), true);
		assert.strictEqual(mainWindow.document.activeElement, reviewInput);
		assert.strictEqual(mounted.reviewPanel.contains(mainWindow.document.activeElement), true);
		assert.strictEqual(mounted.filesPanel.contains(mainWindow.document.activeElement), false);
		assert.notStrictEqual(mainWindow.document.activeElement, filesInput);
		assert.notStrictEqual(mainWindow.document.activeElement, mounted.reviewTab);
	});

	test('Changes focus lands on the selected tab button when the panel has no focusable control', () => {
		const mounted = mountHost();
		appendFilesTrap(mounted.filesPanel);
		appendUnfocusable(mounted.changesPanel);
		mounted.host.selectTab(SourcesTabId.Changes, false);

		mounted.parent.focus();
		mounted.part.focus();

		assert.strictEqual(mounted.changesTab.classList.contains('selected'), true);
		assert.strictEqual(mounted.changesTab.classList.contains('active'), false);
		assert.strictEqual(mounted.filesTab.classList.contains('active'), true);
		assert.strictEqual(mainWindow.document.activeElement, mounted.changesTab);
		assert.strictEqual(mounted.filesPanel.contains(mainWindow.document.activeElement), false);
	});

	test('Review focus lands on the selected tab button when the panel has no focusable control', () => {
		const mounted = mountHost();
		appendFilesTrap(mounted.filesPanel);
		appendUnfocusable(mounted.reviewPanel);
		mounted.host.selectTab(SourcesTabId.Review, false);

		mounted.parent.focus();
		mounted.part.focus();

		assert.strictEqual(mounted.reviewTab.classList.contains('selected'), true);
		assert.strictEqual(mounted.reviewTab.classList.contains('active'), false);
		assert.strictEqual(mainWindow.document.activeElement, mounted.reviewTab);
		assert.strictEqual(mounted.filesPanel.contains(mainWindow.document.activeElement), false);
	});

	test('disposed tabs host clears the focus delegate', () => {
		const mounted = mountHost();
		const changesInput = appendProbe(mounted.changesPanel);
		mounted.host.selectTab(SourcesTabId.Changes, false);
		mounted.part.focus();
		assert.strictEqual(mainWindow.document.activeElement, changesInput);

		mounted.host.dispose();
		mounted.parent.focus();
		mounted.part.focus();

		assert.strictEqual(mainWindow.document.activeElement, mounted.parent);
	});
});
