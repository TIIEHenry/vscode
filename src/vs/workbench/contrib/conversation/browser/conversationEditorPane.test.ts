/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Event } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { ConversationStubService, IConversationRosterService } from './conversationStubService.js';

class TrackingRosterService extends ConversationStubService {
	renameCalls = 0;
	override renameSession(sessionId: string, title: string): boolean {
		this.renameCalls++;
		return super.renameSession(sessionId, title);
	}
}
import { ConversationChatInput, getDefaultConversationChatResource } from '../common/conversationChatInput.js';
import { conversationLensInputMaximizedClass } from './conversationLensDockStrings.js';
import { ConversationEditorPane } from './conversationEditorPane.js';
import { IVisibleEditorPane } from '../../../common/editor.js';
import { TestEditorGroupView, workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';
import {
	createNoopConversationSessionWindowService,
	stubConversationLensRuntimeServices,
	stubConversationTimelineLinkServices,
} from '../test/browser/conversationTimelineLinkTestStubs.js';
import { installConversationLensResizeObserverHarness } from '../test/browser/conversationLensLayoutHarness.js';

suite('ConversationEditorPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	installConversationLensResizeObserverHarness();

	test('clearInput then setInput remounts leaf session bar after teardown', async () => {
		const sessionKey = 'pane-remount-bar';
		const sessionBar = document.createElement('div');
		document.body.appendChild(sessionBar);
		store.add({ dispose: () => sessionBar.remove() });

		const disposables = store as unknown as DisposableStore;
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubConversationTimelineLinkServices(instantiationService);
		stubConversationLensRuntimeServices(instantiationService);
		instantiationService.stub(IConversationSessionWindowService, {
			...createNoopConversationSessionWindowService(),
			getLeafSlots: (key: string) => (key === sessionKey ? { sessionBar } : undefined),
			isSessionWindowHidden: () => false,
		} as IConversationSessionWindowService);

		const group = store.add(Object.assign(new TestEditorGroupView(0), {
			onDidActiveEditorChange: Event.None,
		}));

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const pane = store.add(instantiationService.createInstance(ConversationEditorPane, group));
		pane.create(parent);
		group.activeEditorPane = pane as unknown as IVisibleEditorPane;

		const input = store.add(instantiationService.createInstance(ConversationChatInput, getDefaultConversationChatResource(sessionKey)));

		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		assert.ok(pane.leafSessionBarHost, 'first mount should create leaf session bar');

		pane.clearInput();
		assert.strictEqual(sessionBar.querySelector('.conversation-lens-session-bar'), null, 'teardown should remove orphaned session bar DOM');

		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		assert.ok(pane.leafSessionBarHost, 'second mount should recreate leaf session bar');
	});

	test('clearInput while renaming session title does not commit rename on teardown blur', async () => {
		const rosterService = store.add(new TrackingRosterService());
		const sessionKey = rosterService.createSession();
		const originalTitle = rosterService.getSessions().find(session => session.id === sessionKey)?.title ?? '';
		const sessionBar = document.createElement('div');
		document.body.appendChild(sessionBar);
		store.add({ dispose: () => sessionBar.remove() });

		const disposables = store as unknown as DisposableStore;
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConversationRosterService, rosterService);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubConversationTimelineLinkServices(instantiationService);
		stubConversationLensRuntimeServices(instantiationService);
		instantiationService.stub(IConversationSessionWindowService, {
			...createNoopConversationSessionWindowService(),
			getLeafSlots: (key: string) => (key === sessionKey ? { sessionBar } : undefined),
			isSessionWindowHidden: () => false,
		} as IConversationSessionWindowService);

		const group = store.add(Object.assign(new TestEditorGroupView(0), {
			onDidActiveEditorChange: Event.None,
		}));

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const pane = store.add(instantiationService.createInstance(ConversationEditorPane, group));
		pane.create(parent);
		group.activeEditorPane = pane as unknown as IVisibleEditorPane;

		const input = store.add(instantiationService.createInstance(ConversationChatInput, getDefaultConversationChatResource(sessionKey)));

		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		const bar = pane.leafSessionBarHost;
		assert.ok(bar, 'leaf session bar should mount');
		bar.beginSessionTitleEdit();
		bar.sessionTitleInput.value = 'Committed only if blur rename runs on close';

		pane.clearInput();

		assert.strictEqual(rosterService.renameCalls, 0, 'teardown blur must not rename after tab close');
		assert.strictEqual(
			rosterService.getSessions().find(session => session.id === sessionKey)?.title,
			originalTitle,
			'session title must stay unchanged when closing during edit');
	});

	test('leaf setInputMaximized(false) clears the lens maximized class when History or Snapshots open', async () => {
		const sessionKey = 'pane-leaf-input-maximized';
		const sessionBar = document.createElement('div');
		document.body.appendChild(sessionBar);
		store.add({ dispose: () => sessionBar.remove() });

		const disposables = store as unknown as DisposableStore;
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubConversationTimelineLinkServices(instantiationService);
		stubConversationLensRuntimeServices(instantiationService);
		instantiationService.stub(IConversationSessionWindowService, {
			...createNoopConversationSessionWindowService(),
			getLeafSlots: (key: string) => (key === sessionKey ? { sessionBar } : undefined),
			isSessionWindowHidden: () => false,
		} as IConversationSessionWindowService);

		const group = store.add(Object.assign(new TestEditorGroupView(0), {
			onDidActiveEditorChange: Event.None,
		}));

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const pane = store.add(instantiationService.createInstance(ConversationEditorPane, group));
		pane.create(parent);
		group.activeEditorPane = pane as unknown as IVisibleEditorPane;

		const input = store.add(instantiationService.createInstance(ConversationChatInput, getDefaultConversationChatResource(sessionKey)));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);

		const bar = pane.leafSessionBarHost;
		const lens = pane.activeConversationLens;
		assert.ok(bar, 'leaf session bar should mount');
		assert.ok(lens, 'editor pane should own the lens');
		const mountedLens: NonNullable<typeof lens> = lens;
		const history = bar.engineHistoryList;
		const snapshots = bar.engineSnapshotsList;
		assert.ok(history);
		assert.ok(snapshots);

		const timeline = parent.querySelector('.conversation-timeline');
		const dock = parent.querySelector('.conversation-dock');
		const reading = parent.querySelector('.conversation-lens-reading-column');
		assert.ok(timeline);
		assert.ok(dock);
		assert.ok(reading);
		const timelineEl: Element = timeline;
		const dockEl: Element = dock;
		const readingEl: Element = reading;

		const assertMaximized = (maximized: boolean) => {
			assert.strictEqual(mountedLens.isInputMaximized(), maximized);
			assert.strictEqual(timelineEl.classList.contains(conversationLensInputMaximizedClass), maximized);
			assert.strictEqual(dockEl.classList.contains(conversationLensInputMaximizedClass), maximized);
			assert.strictEqual(readingEl.classList.contains(conversationLensInputMaximizedClass), maximized);
		};

		mountedLens.setInputMaximized(true);
		assertMaximized(true);

		bar.setInputMaximized(false);
		assertMaximized(false);

		bar.setInputMaximized(true);
		assertMaximized(true);
		history.show();
		assert.strictEqual(history.isOpen(), true);
		assertMaximized(false);

		history.close();
		mountedLens.setInputMaximized(true);
		snapshots.show();
		assert.strictEqual(snapshots.isOpen(), true);
		assertMaximized(false);
	});

	test('lens maximize closes open leaf History and Snapshots', async () => {
		const sessionKey = 'pane-leaf-maximize-closes-lists';
		const sessionBar = document.createElement('div');
		document.body.appendChild(sessionBar);
		store.add({ dispose: () => sessionBar.remove() });

		const disposables = store as unknown as DisposableStore;
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		stubConversationTimelineLinkServices(instantiationService);
		stubConversationLensRuntimeServices(instantiationService);
		instantiationService.stub(IConversationSessionWindowService, {
			...createNoopConversationSessionWindowService(),
			getLeafSlots: (key: string) => (key === sessionKey ? { sessionBar } : undefined),
			isSessionWindowHidden: () => false,
		} as IConversationSessionWindowService);

		const group = store.add(Object.assign(new TestEditorGroupView(0), {
			onDidActiveEditorChange: Event.None,
		}));

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const pane = store.add(instantiationService.createInstance(ConversationEditorPane, group));
		pane.create(parent);
		group.activeEditorPane = pane as unknown as IVisibleEditorPane;

		const input = store.add(instantiationService.createInstance(ConversationChatInput, getDefaultConversationChatResource(sessionKey)));
		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);

		const bar = pane.leafSessionBarHost;
		const lens = pane.activeConversationLens;
		assert.ok(bar);
		assert.ok(lens);
		const history = bar.engineHistoryList;
		const snapshots = bar.engineSnapshotsList;
		assert.ok(history);
		assert.ok(snapshots);
		assert.strictEqual(lens.engineHistoryList, history);
		assert.strictEqual(lens.engineSnapshotsList, snapshots);

		history.show();
		snapshots.show();
		assert.strictEqual(history.isOpen(), true);
		assert.strictEqual(snapshots.isOpen(), true);
		assert.strictEqual(lens.isInputMaximized(), false);

		lens.setInputMaximized(true);

		assert.strictEqual(lens.isInputMaximized(), true);
		assert.strictEqual(history.isOpen(), false);
		assert.strictEqual(snapshots.isOpen(), false);

		history.show();
		assert.strictEqual(history.isOpen(), true);
		assert.strictEqual(snapshots.isOpen(), false);
		assert.strictEqual(lens.isInputMaximized(), false);
		lens.setInputMaximized(true);
		assert.strictEqual(lens.isInputMaximized(), true);
		assert.strictEqual(history.isOpen(), false);
		assert.strictEqual(snapshots.isOpen(), false);

		snapshots.show();
		assert.strictEqual(snapshots.isOpen(), true);
		assert.strictEqual(lens.isInputMaximized(), false);
		// Flag already says maximized while this leaf list is still open.
		lens.inputMaximized = true;
		lens.setInputMaximized(true);
		assert.strictEqual(lens.isInputMaximized(), true);
		assert.strictEqual(history.isOpen(), false);
		assert.strictEqual(snapshots.isOpen(), false);
	});
});
