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
import { ConversationChatInput, getDefaultConversationChatResource } from '../common/conversationChatInput.js';
import { ConversationEditorPane } from './conversationEditorPane.js';
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
		group.activeEditorPane = pane;

		const input = store.add(instantiationService.createInstance(ConversationChatInput, getDefaultConversationChatResource(sessionKey)));

		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		assert.ok(pane.leafSessionBarHost, 'first mount should create leaf session bar');

		pane.clearInput();
		assert.strictEqual(sessionBar.querySelector('.conversation-lens-session-bar'), null, 'teardown should remove orphaned session bar DOM');

		await pane.setInput(input, undefined, Object.create(null), CancellationToken.None);
		assert.ok(pane.leafSessionBarHost, 'second mount should recreate leaf session bar');
	});
});
