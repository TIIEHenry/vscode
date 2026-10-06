/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { ConversationSessionChatContribution } from './conversationSessionChat.contribution.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { createEmptyConversationSessionChatService, createNoopConversationSessionWindowService } from '../test/browser/conversationTimelineLinkTestStubs.js';

const SESSION_KEY = 'session-chat-contribution';

suite('ConversationSessionChatContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHarness(options?: {
		readonly getConversationPart?: () => IConversationEditorPart | undefined;
	}) {
		const sessionWindow = document.createElement('div');
		document.body.appendChild(sessionWindow);
		store.add({ dispose: () => sessionWindow.remove() });

		const onDidChangeVisibleWindows = new Emitter<void>();
		store.add(onDidChangeVisibleWindows);

		const registerPartListenerCalls: IConversationEditorPart[] = [];
		const partA = { sessionKey: SESSION_KEY, id: 'part-a' } as IConversationEditorPart & { id: string };
		const partB = { sessionKey: SESSION_KEY, id: 'part-b' } as IConversationEditorPart & { id: string };
		let conversationPart = partA;

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationPartService, {
			getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: document.createElement('div') }),
			onDidCreateSlots: Event.None,
		} as unknown as IConversationPartService);
		instantiationService.stub(IConversationSessionWindowService, {
			...createNoopConversationSessionWindowService(),
			onDidChangeVisibleWindows: onDidChangeVisibleWindows.event,
			getAllLeafSessionKeys: () => [SESSION_KEY],
			getLeafSlots: () => ({
				sessionKey: SESSION_KEY,
				container: document.createElement('div'),
				sessionBar: document.createElement('div'),
				sessionWindow,
				editorPartHost: sessionWindow,
			}),
		});
		instantiationService.stub(IConversationSessionChatService, {
			...createEmptyConversationSessionChatService(),
			getConversationPart: () => options?.getConversationPart?.() ?? conversationPart,
			registerPartListeners: (part: IConversationEditorPart) => {
				registerPartListenerCalls.push(part);
				return { dispose: () => { } };
			},
		});

		const contribution = instantiationService.createInstance(ConversationSessionChatContribution);

		return {
			contribution,
			onDidChangeVisibleWindows,
			registerPartListenerCalls,
			setConversationPart: (part: IConversationEditorPart) => {
				conversationPart = part;
			},
			partA,
			partB,
		};
	}

	test('re-registers part listeners when the conversation editor part is recreated for the same session key', () => {
		const harness = createHarness();
		assert.deepStrictEqual(harness.registerPartListenerCalls.map(part => (part as { id: string }).id), ['part-a']);

		harness.setConversationPart(harness.partB);
		harness.onDidChangeVisibleWindows.fire();
		assert.deepStrictEqual(harness.registerPartListenerCalls.map(part => (part as { id: string }).id), ['part-a', 'part-b']);
	});

	test('does not register part listeners after contribution dispose', () => {
		const harness = createHarness();
		harness.contribution.dispose();
		harness.setConversationPart(harness.partB);
		harness.onDidChangeVisibleWindows.fire();
		assert.strictEqual(harness.registerPartListenerCalls.length, 1);
	});
});
