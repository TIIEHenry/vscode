/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { createEmptyConversationSessionChatService, createNoopConversationSessionWindowService } from '../test/browser/conversationTimelineLinkTestStubs.js';
import { IConversationSessionChatService } from '../common/conversationSessionChat.js';
import { ConversationTurnContentAdapter } from './conversationTurnContentAdapter.js';
import { conversationSessionPillClass } from './conversationSessionPill.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';

suite('ConversationTurnContentAdapter (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('streaming assistant body repaints session pills when catalog arrives late', () => {
		const disposables = store.add(new DisposableStore());
		const onDidChangeSession = new Emitter<void>();
		const onDidChangeCatalog = new Emitter<string>();
		disposables.add(onDidChangeSession);
		disposables.add(onDidChangeCatalog);
		const catalog: Array<{ sessionKey: string; chatId: string; title: string; originKind: 'tool' }> = [];

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, {
			getSessions: () => [{ id: 'untitled', title: 'Untitled' }],
			getActiveSessionId: () => 'untitled',
			onDidChangeSession: onDidChangeSession.event,
			onDidChangeActiveSession: onDidChangeSession.event,
			isEngineConnected: () => false,
		} as unknown as IConversationRosterService);
		instantiationService.stub(IConversationSessionChatService, {
			...createEmptyConversationSessionChatService(),
			onDidChangeCatalog: onDidChangeCatalog.event,
			getCatalog: (sessionKey: string) => catalog.filter(entry => entry.sessionKey === sessionKey),
			registerSubAgentChat: (sessionKey: string, chatId: string, title: string) => {
				const entry = { sessionKey, chatId, title, originKind: 'tool' as const };
				catalog.push(entry);
				onDidChangeCatalog.fire(sessionKey);
				return entry;
			},
		} as unknown as IConversationSessionChatService);
		instantiationService.stub(IConversationSessionWindowService, createNoopConversationSessionWindowService());
		instantiationService.stub(IOpenerService, { open: async () => true } as unknown as IOpenerService);
		instantiationService.stub(IHoverService, {
			setupManagedHover: () => ({ dispose: () => { }, update: () => { }, show: () => { } }),
		} as unknown as IHoverService);
		instantiationService.stub(IEditorGroupsService, {
			getActiveConversationEditorPart: () => ({ sessionKey: 'untitled' }),
		} as IEditorGroupsService);

		const adapter = instantiationService.createInstance(ConversationTurnContentAdapter);
		const container = document.createElement('div');
		document.body.appendChild(container);
		disposables.add({ dispose: () => container.remove() });

		const markdown = '[Agent](conversation-chat:/session/untitled/chat/c1)';
		const streaming = adapter.renderStreamingBody({ id: 'a1', kind: 'assistant', text: markdown }, container);
		disposables.add({ dispose: () => streaming.dispose() });
		streaming.update(markdown);

		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 0);

		const sessionChat = instantiationService.invokeFunction(accessor => accessor.get(IConversationSessionChatService));
		sessionChat.registerSubAgentChat('untitled', 'c1', 'Agent');

		assert.strictEqual(container.querySelectorAll(`.${conversationSessionPillClass}`).length, 1);
	});
});
