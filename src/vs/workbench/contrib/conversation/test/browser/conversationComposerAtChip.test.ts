/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationTurnContentAdapter } from '../../browser/conversationTurnContentAdapter.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import {
	CONVERSATION_REFS_MARKER,
	composeConversationPayload,
	splitConversationRefs,
} from '../../browser/conversationComposerRefs.js';
import { saveQueueEdit, saveTurnEdit, submitDraft } from '../../browser/conversationLensComposer.js';
import { IConversationSessionChatService } from '../../common/conversationSessionChat.js';
import { getConversationChatResource } from '../../common/conversationChatInput.js';
import { shouldRenderTurnAsMarkdown } from '../../browser/conversationTurnMarkdown.js';
import { createEmptyConversationSessionChatService, createNoopConversationSessionWindowService } from './conversationTimelineLinkTestStubs.js';

suite('Conversation composer @ chips', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function resource(sessionKey = 's1', chatId = 'c1'): string {
		return getConversationChatResource(sessionKey, chatId).toString();
	}

	function trailer(body: string, refs: readonly string[]): string {
		return `${body}\n\n${CONVERSATION_REFS_MARKER}\n${refs.join('\n')}`;
	}

	function assertIllegal(text: string): void {
		const split = splitConversationRefs(text);
		assert.strictEqual(split.trailer, false);
		assert.strictEqual(split.body, text);
		assert.deepStrictEqual([...split.refs], []);
	}

	function composerSurface(body: string, refs: readonly string[]) {
		const textarea = document.createElement('textarea');
		textarea.value = body;
		const composerRefResources = [...refs];
		const drafts = new Map<string, string>();
		const base = {
			dockTextarea: textarea,
			composerRefResources,
			drafts,
			composerPolicy: 'compose' as const,
			submitInFlight: false,
			catalogModelIds: ['model-a'],
			modelSelectedIndex: 0,
			getBoundSessionId: () => 'sess',
			configurationService: { getValue: () => false },
			uaConnection: {
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
			showPostFailure: () => { },
			resetInputHistoryBrowse: () => { },
			updateSendEnabled: () => { },
			updateConversationPhase: () => { },
			exitComposerEdit: () => { },
			renderInboxStatus: () => { },
		};
		return { textarea, composerRefResources, drafts, base };
	}

	test('text with refs carries a conversation-refs trailer', async () => {
		const line = resource();
		assert.strictEqual(composeConversationPayload('  hello  ', [line]), trailer('hello', [line]));
		assert.strictEqual(composeConversationPayload('   ', [line]), `${CONVERSATION_REFS_MARKER}\n${line}`);
		assert.strictEqual(composeConversationPayload('  hello  ', []), 'hello');
		assert.strictEqual(composeConversationPayload('   ', []), undefined);
		assert.ok(!composeConversationPayload('  hello  ', [])!.includes(CONVERSATION_REFS_MARKER));

		const posted: Array<{ kind: string; text: string; modelProfileId?: string }> = [];
		const compose = composerSurface('  hello  ', [line]);
		await submitDraft({
			...compose.base,
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => false,
			},
			sessionViewLease: {
				post: async (message: { kind: string; text: string; modelProfileId?: string }) => {
					posted.push(message);
					return { accepted: true };
				},
			},
		} as never);
		assert.strictEqual(posted.length, 1);
		assert.strictEqual(posted[0].kind, 'submitInput');
		assert.strictEqual(posted[0].text, trailer('hello', [line]));
		assert.strictEqual(posted[0].modelProfileId, 'model-a');
		assert.deepStrictEqual(Object.keys(posted[0]).sort(), ['kind', 'modelProfileId', 'text']);

		let enqueued = '';
		const queued = composerSurface('  hello  ', [line]);
		await submitDraft({
			...queued.base,
			stubService: {
				isEngineConnected: () => false,
				isEngineSessionReady: () => false,
				hasEngineConnectionHistory: () => true,
				enqueueMessageQueueItem: (_sessionId: string, text: string) => {
					enqueued = text;
					return true;
				},
			},
		} as never);
		assert.strictEqual(enqueued, trailer('hello', [line]));

		let turned = '';
		const editing = composerSurface('  hello  ', [line]);
		saveTurnEdit({
			...editing.base,
			composerPolicy: 'turnEdit',
			editingTurnId: 'u1',
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				getTurns: () => [{ id: 'u1', kind: 'user', text: 'old' }],
				updateUserTurnText: (_sessionId: string, _turnId: string, text: string) => {
					turned = text;
					return true;
				},
			},
		} as never);
		assert.strictEqual(turned, trailer('hello', [line]));

		let queueSaved = '';
		const queueEdit = composerSurface('  hello  ', [line]);
		saveQueueEdit({
			...queueEdit.base,
			composerPolicy: 'queueEdit',
			getEditingQueueItem: () => ({ id: 'q1', content: 'old' }),
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				updateMessageQueueItemContent: (_sessionId: string, _itemId: string, text: string) => {
					queueSaved = text;
					return true;
				},
				releaseMessageQueueItemHold: () => { },
			},
		} as never);
		assert.strictEqual(queueSaved, trailer('hello', [line]));
	});

	test('an illegal trailer is the entire body', () => {
		const line = resource();
		const body = 'hello';
		assertIllegal(`${body}\n\n${CONVERSATION_REFS_MARKER}\n${CONVERSATION_REFS_MARKER}`);
		assertIllegal(`${body}\n\n${CONVERSATION_REFS_MARKER}\nnot-a-resource`);
		assertIllegal(`${body}\n\n${CONVERSATION_REFS_MARKER}\nconversation-chat://evil/session/s1/chat/c1`);
		assertIllegal(`${body}\n\n${CONVERSATION_REFS_MARKER}\n${line}?x=1`);
		assertIllegal(`${body}\n\n${CONVERSATION_REFS_MARKER}\n${line}#frag`);
		assertIllegal(`see ${CONVERSATION_REFS_MARKER} inside the sentence`);

		const absent = splitConversationRefs('  hello  ');
		assert.strictEqual(absent.trailer, false);
		assert.strictEqual(absent.body, '  hello  ');
	});

	test('user row keeps an illegal trailer as plain text and puts a legal one under the body', () => {
		assert.strictEqual(shouldRenderTurnAsMarkdown('user'), false);

		const disposables = store.add(new DisposableStore());
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, {
			getSessions: () => [{ id: 's1', title: 'Alpha' }],
			getActiveSessionId: () => 's1',
			onDidChangeSession: Event.None,
			onDidChangeActiveSession: Event.None,
			isEngineConnected: () => false,
		} as unknown as IConversationRosterService);
		instantiationService.stub(IConversationSessionChatService, createEmptyConversationSessionChatService());
		instantiationService.stub(IConversationSessionWindowService, createNoopConversationSessionWindowService());
		instantiationService.stub(IOpenerService, { open: async () => true } as IOpenerService);
		const adapter = instantiationService.createInstance(ConversationTurnContentAdapter);
		const container = document.createElement('div');
		document.body.appendChild(container);
		disposables.add({ dispose: () => container.remove() });

		const illegal = `hello\n\n${CONVERSATION_REFS_MARKER}\nnot-a-resource`;
		const illegalTurn: ConversationStubTurn = { id: 'u-illegal', kind: 'user', text: illegal };
		disposables.add(adapter.renderTurnBody(illegalTurn, container));
		assert.strictEqual(container.textContent, illegal);
		assert.strictEqual(container.querySelector('.conversation-lens-turn-user-text'), null);
		assert.strictEqual(container.querySelector('.conversation-lens-turn-user-refs'), null);
		assert.strictEqual(container.querySelector('.conversation-session-pill'), null);

		container.replaceChildren();
		const line = resource('s1', 'default');
		const legalTurn: ConversationStubTurn = { id: 'u-legal', kind: 'user', text: trailer('hello', [line]) };
		disposables.add(adapter.renderTurnBody(legalTurn, container));
		const text = container.querySelector('.conversation-lens-turn-user-text');
		assert.ok(text);
		assert.strictEqual(text.textContent, 'hello');
		assert.ok(!text.textContent!.includes(CONVERSATION_REFS_MARKER));
		assert.ok(container.querySelector('.conversation-lens-turn-user-refs'));
		assert.ok(container.querySelector('.conversation-session-pill'));
	});
});
