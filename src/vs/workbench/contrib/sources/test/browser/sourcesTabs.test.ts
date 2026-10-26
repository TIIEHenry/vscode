/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { Emitter } from '../../../../../base/common/event.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DEFAULT_SOURCES_TAB, nextSourcesTab, SOURCES_TAB_ORDER, SourcesTabId } from '../../common/sourcesTabs.js';
import { readSourcesSelectedTab, sourcesSelectedTabStorageKey, sourcesTabForSessionChange, SourcesTabsHost } from '../../browser/sourcesTabsHost.js';
import { ISourcesPartService, SourcesPart } from '../../../../browser/parts/sources/sourcesPart.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { SourcesChangesList } from '../../browser/sourcesChangesList.js';
import { SourcesFilesExplorerHost } from '../../browser/sourcesFilesExplorer.js';
import { SourcesReviewList } from '../../browser/sourcesReviewList.js';
import { ISourcesReviewHostService } from '../../common/sourcesReviewHostService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { createSourcesTestSessionContext } from './sourcesTestSessionContext.js';

suite('Sources - tab model', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default tab is Files', () => {
		assert.strictEqual(DEFAULT_SOURCES_TAB, SourcesTabId.Files);
	});

	test('tab order matches Desktop IA roster', () => {
		assert.deepStrictEqual(SOURCES_TAB_ORDER, [
			SourcesTabId.Files,
			SourcesTabId.Changes,
			SourcesTabId.Review,
		]);
	});

	test('nextSourcesTab wraps in both directions', () => {
		assert.strictEqual(nextSourcesTab(SourcesTabId.Files, 1), SourcesTabId.Changes);
		assert.strictEqual(nextSourcesTab(SourcesTabId.Changes, 1), SourcesTabId.Review);
		assert.strictEqual(nextSourcesTab(SourcesTabId.Review, 1), SourcesTabId.Files);

		assert.strictEqual(nextSourcesTab(SourcesTabId.Files, -1), SourcesTabId.Review);
		assert.strictEqual(nextSourcesTab(SourcesTabId.Review, -1), SourcesTabId.Changes);
	});

	test('switching sessions saves the tab you left and restores the tab that session last had', () => {
		const values = new Map<string, string>();
		const read = (key: string) => {
			assert.ok(key.startsWith('sources.selectedTab.session:'), key);
			return values.get(key);
		};

		assert.strictEqual(readSourcesSelectedTab(read, 'sess-a'), SourcesTabId.Files);
		assert.strictEqual(values.size, 0);

		values.set(sourcesSelectedTabStorageKey('sess-a'), SourcesTabId.Changes);
		const toB = sourcesTabForSessionChange({ sessionId: 'sess-a', tab: SourcesTabId.Changes }, 'sess-b', read);
		values.set(toB.saved.key, toB.saved.tab);
		assert.strictEqual(toB.saved.key, sourcesSelectedTabStorageKey('sess-a'));
		assert.strictEqual(toB.saved.tab, SourcesTabId.Changes);
		assert.strictEqual(toB.restored, SourcesTabId.Files);

		values.set(sourcesSelectedTabStorageKey('sess-b'), SourcesTabId.Review);
		const backToA = sourcesTabForSessionChange({ sessionId: 'sess-b', tab: SourcesTabId.Review }, 'sess-a', read);
		values.set(backToA.saved.key, backToA.saved.tab);
		assert.strictEqual(backToA.restored, SourcesTabId.Changes);
		assert.strictEqual(values.get(sourcesSelectedTabStorageKey('sess-b')), SourcesTabId.Review);
		assert.strictEqual(values.has('sources.selectedTab'), false);
	});
});

suite('Sources - tabs host docking', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createInstantiationService(session: IAgentSessionContext = createSourcesTestSessionContext()) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IAgentSessionContext, session);
		instantiationService.stubInstance(SourcesChangesList, Object.assign(toDisposable(() => { }), {
			setFilterDock() { },
		}));
		instantiationService.stubInstance(SourcesReviewList, Object.assign(toDisposable(() => { }), {
			setFilterDock() { },
		}));
		instantiationService.stub(ISourcesReviewHostService, {
			registerReviewListHost() { },
			showForPaths() { },
			getReviewListHost() { return undefined; },
		});
		return instantiationService;
	}

	test('injected session events restore each tab and stop saving after disposal', () => {
		const sessionChanges = store.add(new Emitter<string>());
		let activeSessionId = 'sess-a';
		const instantiationService = createInstantiationService(createSourcesTestSessionContext({
			getActiveSessionId: () => activeSessionId,
			onDidChangeActiveSession: sessionChanges.event,
		}));
		instantiationService.stubInstance(SourcesFilesExplorerHost, Object.assign(toDisposable(() => { }), {
			setFilesTabActive() { },
			setFilterDock() { },
			setActionsDock() { },
		}));
		const storage = instantiationService.invokeFunction(accessor => accessor.get(IStorageService));
		storage.store(sourcesSelectedTabStorageKey('sess-b'), SourcesTabId.Review, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		const part = store.add(instantiationService.createInstance(SourcesPart));
		instantiationService.set(ISourcesPartService, part);
		const parent = mainWindow.document.createElement('div');
		mainWindow.document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);
		const host = store.add(instantiationService.createInstance(SourcesTabsHost, part.tabHost!, part.contentHost!));
		const selectedTab = () => part.tabHost!.querySelector('.sources-tab.selected')?.getAttribute('data-tab-id');
		const switchSession = (sessionId: string) => {
			activeSessionId = sessionId;
			sessionChanges.fire(sessionId);
		};

		host.selectTab(SourcesTabId.Changes, false);
		switchSession('sess-b');
		assert.strictEqual(selectedTab(), SourcesTabId.Review);
		switchSession('sess-a');
		assert.strictEqual(selectedTab(), SourcesTabId.Changes);
		assert.deepStrictEqual(['sess-a', 'sess-b'].map(sessionId => storage.get(sourcesSelectedTabStorageKey(sessionId), StorageScope.WORKSPACE)), [
			SourcesTabId.Changes,
			SourcesTabId.Review,
		]);

		host.dispose();
		storage.store(sourcesSelectedTabStorageKey('sess-a'), SourcesTabId.Files, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		switchSession('sess-b');
		assert.deepStrictEqual({
			hasSessionListener: sessionChanges.hasListeners(),
			selected: selectedTab(),
			savedA: storage.get(sourcesSelectedTabStorageKey('sess-a'), StorageScope.WORKSPACE),
		}, { hasSessionListener: false, selected: SourcesTabId.Changes, savedA: SourcesTabId.Files });
	});

	test('filterSlot docks Files actions only when Files tab is active', () => {
		const instantiationService = createInstantiationService();
		let dockedActions: HTMLElement | undefined;

		instantiationService.stubInstance(SourcesFilesExplorerHost, Object.assign(toDisposable(() => { }), {
			setFilesTabActive() { },
			setFilterDock() { },
			setActionsDock(dock: HTMLElement | undefined) { dockedActions = dock; },
		}));
		const part = store.add(instantiationService.createInstance(SourcesPart));
		instantiationService.set(ISourcesPartService, part);

		const parent = mainWindow.document.createElement('div');
		mainWindow.document.body.appendChild(parent);
		part.create(parent);
		store.add(toDisposable(() => parent.remove()));

		const host = store.add(instantiationService.createInstance(SourcesTabsHost, part.tabHost!, part.contentHost!));

		const filterSlot = host.getFilterSlot();
		assert.ok(filterSlot, 'filterSlot should exist');
		assert.ok(filterSlot.classList.contains('sources-title-filter'), 'filterSlot should have sources-title-filter class');

		// Initial tab is Files: actions should be docked into filterSlot
		assert.strictEqual(dockedActions, filterSlot, 'Actions should be docked into filterSlot on Files tab');

		// Switch to Changes tab: actions should be undocked
		host.selectTab(SourcesTabId.Changes, false);
		assert.strictEqual(dockedActions, undefined, 'Actions should be undocked on Changes tab');

		// Switch to Review tab: actions should remain undocked
		host.selectTab(SourcesTabId.Review, false);
		assert.strictEqual(dockedActions, undefined, 'Actions should remain undocked on Review tab');

		// Switch back to Files tab: actions should be restored to filterSlot
		host.selectTab(SourcesTabId.Files, false);
		assert.strictEqual(dockedActions, filterSlot, 'Actions should be restored to filterSlot on Files tab');
	});

	test('docked actions element preserves accessibility and DOM containment', () => {
		const instantiationService = createInstantiationService();
		const actionsElement = mainWindow.document.createElement('div');
		actionsElement.className = 'actions';

		const btn = mainWindow.document.createElement('a');
		btn.className = 'action-label codicon codicon-new-file';
		btn.setAttribute('role', 'button');
		btn.setAttribute('aria-label', 'New File...');
		btn.title = 'New File...';
		btn.tabIndex = 0;
		actionsElement.appendChild(btn);

		let dockedSlot: HTMLElement | undefined;
		const originalParent = mainWindow.document.createElement('div');
		originalParent.appendChild(actionsElement);
		store.add(toDisposable(() => originalParent.remove()));

		instantiationService.stubInstance(SourcesFilesExplorerHost, Object.assign(toDisposable(() => {
			actionsElement.remove();
		}), {
			setFilesTabActive() { },
			setFilterDock() { },
			setActionsDock(dock: HTMLElement | undefined) {
				dockedSlot = dock;
				if (dock) {
					dock.appendChild(actionsElement);
					actionsElement.classList.add('is-docked');
				} else {
					actionsElement.classList.remove('is-docked');
					originalParent.appendChild(actionsElement);
				}
			},
		}));
		const part = store.add(instantiationService.createInstance(SourcesPart));
		instantiationService.set(ISourcesPartService, part);

		const parent = mainWindow.document.createElement('div');
		mainWindow.document.body.appendChild(parent);
		part.create(parent);
		store.add(toDisposable(() => parent.remove()));

		const host = store.add(instantiationService.createInstance(SourcesTabsHost, part.tabHost!, part.contentHost!));
		const filterSlot = host.getFilterSlot()!;

		// In Files tab: actions element is child of filterSlot and marked is-docked
		assert.strictEqual(dockedSlot, filterSlot);
		assert.strictEqual(actionsElement.parentElement, filterSlot);
		assert.ok(actionsElement.classList.contains('is-docked'));
		assert.strictEqual(btn.getAttribute('role'), 'button');
		assert.strictEqual(btn.getAttribute('aria-label'), 'New File...');
		assert.strictEqual(btn.title, 'New File...');
		assert.strictEqual(btn.tabIndex, 0);

		// In Changes tab: actions element removed from filterSlot and restored to originalParent
		host.selectTab(SourcesTabId.Changes, false);
		assert.strictEqual(actionsElement.parentElement, originalParent);
		assert.strictEqual(actionsElement.classList.contains('is-docked'), false);

		// Back in Files tab: actions element returned to filterSlot
		host.selectTab(SourcesTabId.Files, false);
		assert.strictEqual(actionsElement.parentElement, filterSlot);
		assert.ok(actionsElement.classList.contains('is-docked'));
	});
});
