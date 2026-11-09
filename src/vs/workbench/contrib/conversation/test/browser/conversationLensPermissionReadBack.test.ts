/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { createUnknownConversationEntryCapability } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentSessionToolPermissionMode } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { TestLayoutService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IWebviewService } from '../../../webview/browser/webview.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import { IConversationSessionChoiceService } from '../../browser/conversationSessionChoiceService.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { createTestSessionChoiceService } from './conversationSessionChoiceTestUtils.js';
import { stubConversationLensRuntimeServices, stubConversationTimelineLinkServices } from './conversationTimelineLinkTestStubs.js';

suite('ConversationLens permission mode read-back', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountLens(engineMode: () => UniverseAgentSessionToolPermissionMode) {
		const reads: string[] = [];
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let snapshot: UniverseAgentConnectionSnapshot = {
			...createConversationConnectionTestStub().getConnectionSnapshot(),
			linkId: 1,
			conversationEntryCapability: { ...createUnknownConversationEntryCapability(), getPermissionMode: 'SUPPORTED' },
		};
		const connection = createConversationConnectionTestStub({
			getConnectionSnapshot: () => snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			getPermissionMode: async request => {
				reads.push(request.sessionId);
				return { mode: engineMode() };
			},
		});

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IStorageService, store.add(new TestStorageService()));
		const stubService = store.add(new ConversationStubService());
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IUniverseAgentConnection, connection);
		stubConversationTimelineLinkServices(instantiationService);
		stubConversationLensRuntimeServices(instantiationService);
		instantiationService.stub(IConversationSessionChoiceService, createTestSessionChoiceService(store, { connection }));
		instantiationService.stub(IClipboardService, new TestClipboardService());
		instantiationService.stub(ICommandService, new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand() { return Promise.resolve(undefined); }
		}());
		instantiationService.stub(IExtensionService, {
			_serviceBrand: undefined,
			getExtension: () => Promise.resolve(undefined),
		} as unknown as IExtensionService);
		instantiationService.stub(IWebviewService, {
			_serviceBrand: undefined,
			activeWebview: undefined,
			webviews: [],
			onDidChangeActiveWebview: Event.None,
			createWebviewOverlay: () => { throw new Error('not used'); },
			createWebviewElement: () => { throw new Error('not used'); },
		} as unknown as IWebviewService);
		const layoutContainer = document.createElement('div');
		layoutContainer.classList.add('monaco-workbench');
		document.body.appendChild(layoutContainer);
		store.add(toDisposable(() => layoutContainer.remove()));
		const layoutService = new TestLayoutService();
		layoutService.getContainer = () => layoutContainer;
		instantiationService.stub(ILayoutService, layoutService);

		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);
		const partSlots = part.getSlots();
		assert.ok(partSlots);
		const slots: IConversationLensSlots = {
			sessionBar: partSlots.sessionBar,
			timeline: document.createElement('div'),
			dock: document.createElement('div'),
		};
		parent.appendChild(slots.timeline);
		parent.appendChild(slots.dock);
		store.add(instantiationService.createInstance(ConversationLens, slots));

		return {
			reads,
			sessionId: stubService.getActiveSessionId(),
			shownIndex: () => (slots.dock.querySelector('.conversation-lens-dock-permission select') as HTMLSelectElement | null)?.selectedIndex,
			changeLink(linkId: number) {
				snapshot = { ...snapshot, linkId };
				onDidChangeConnection.fire(snapshot);
			},
		};
	}

	test('binding a session and replacing the link both read the engine mode into the permission select', async () => {
		let engineMode: UniverseAgentSessionToolPermissionMode = 'SESSION_TOOL_PERMISSION_MODE_PERMIT';
		const lens = mountLens(() => engineMode);
		await timeout(0);
		const afterBind = { reads: [...lens.reads], shown: lens.shownIndex() };

		engineMode = 'SESSION_TOOL_PERMISSION_MODE_AGENT';
		lens.changeLink(2);
		await timeout(0);

		assert.deepStrictEqual({ afterBind, afterReconnect: { reads: lens.reads, shown: lens.shownIndex() } }, {
			afterBind: { reads: [lens.sessionId], shown: 2 },
			afterReconnect: { reads: [lens.sessionId, lens.sessionId], shown: 1 },
		});
	});
});
