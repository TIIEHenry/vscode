/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';
import { ConversationSessionChatContribution } from './conversationSessionChat.contribution.js';
import { ConversationSessionChatService, IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { ConversationStubService, IConversationRosterService } from './conversationStubService.js';
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
		let conversationPart: IConversationEditorPart = partA;

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
		assert.deepStrictEqual(harness.registerPartListenerCalls.map(part => (part as unknown as { id: string }).id), ['part-a']);

		harness.setConversationPart(harness.partB);
		harness.onDidChangeVisibleWindows.fire();
		assert.deepStrictEqual(harness.registerPartListenerCalls.map(part => (part as unknown as { id: string }).id), ['part-a', 'part-b']);
	});

	test('does not register part listeners after contribution dispose', () => {
		const harness = createHarness();
		harness.contribution.dispose();
		harness.setConversationPart(harness.partB);
		harness.onDidChangeVisibleWindows.fire();
		assert.strictEqual(harness.registerPartListenerCalls.length, 1);
	});

	test('moves an open sub-agent overlay onto a late editor timeline without recreating it', async () => {
		const sessionKey = 'session-chat-overlay-rehost';
		const sessionWindow = document.createElement('div');
		document.body.appendChild(sessionWindow);
		store.add({ dispose: () => sessionWindow.remove() });

		const onDidChangeVisibleWindows = store.add(new Emitter<void>());
		let leafKeys = [sessionKey];

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		const sessionChatService = store.add(instantiationService.createInstance(ConversationSessionChatService));
		instantiationService.stub(IConversationPartService, {
			getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: document.createElement('div') }),
			onDidCreateSlots: Event.None,
		} as unknown as IConversationPartService);
		instantiationService.stub(IConversationSessionWindowService, {
			...createNoopConversationSessionWindowService(),
			onDidChangeVisibleWindows: onDidChangeVisibleWindows.event,
			getAllLeafSessionKeys: () => leafKeys,
			getLeafSlots: (key: string) => {
				if (key !== sessionKey || !leafKeys.includes(sessionKey)) {
					return undefined;
				}
				return {
					sessionKey,
					container: sessionWindow,
					sessionBar: sessionWindow,
					sessionWindow,
					editorPartHost: sessionWindow,
				};
			},
		});
		instantiationService.stub(IConversationSessionChatService, sessionChatService);

		store.add(instantiationService.createInstance(ConversationSessionChatContribution));

		const overlay = sessionWindow.querySelector('.conversation-subagent-overlay') as HTMLElement;
		assert.ok(overlay);
		assert.strictEqual(overlay.parentElement, sessionWindow);
		assert.strictEqual(overlay.hidden, true);

		await sessionChatService.openSubAgent(sessionKey, 'child-agent', 'Child');
		assert.strictEqual(overlay.hidden, false);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(sessionKey), true);
		assert.strictEqual(sessionChatService.getOpenSubAgentDialogChatId(sessionKey), 'child-agent');
		const innerTimeline = overlay.querySelector('.conversation-timeline');
		assert.ok(innerTimeline);
		// open() inserts a timeline inside the overlay. That node is not a new host.
		await timeout(0);
		assert.strictEqual(overlay.parentElement, sessionWindow);
		assert.strictEqual(overlay.hidden, false);

		const editorPane = document.createElement('div');
		const editorTimeline = document.createElement('div');
		editorTimeline.className = 'conversation-timeline';
		editorPane.appendChild(editorTimeline);
		sessionWindow.appendChild(editorPane);
		// The session-window observer reports the inserted timeline on a microtask.
		await timeout(0);

		assert.strictEqual(overlay.parentElement, editorTimeline);
		assert.ok(overlay.contains(innerTimeline));
		assert.notStrictEqual(innerTimeline, editorTimeline);
		assert.strictEqual(overlay.hidden, false);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(sessionKey), true);
		assert.strictEqual(sessionChatService.getOpenSubAgentDialogChatId(sessionKey), 'child-agent');
		assert.strictEqual(editorTimeline.querySelector('.conversation-subagent-overlay'), overlay);
		assert.strictEqual(sessionWindow.querySelectorAll('.conversation-subagent-overlay').length, 1);

		onDidChangeVisibleWindows.fire();
		assert.strictEqual(overlay.parentElement, editorTimeline);
		assert.strictEqual(overlay.isConnected, true);
		assert.strictEqual(overlay.hidden, false);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(sessionKey), true);
		assert.strictEqual(sessionWindow.querySelectorAll('.conversation-subagent-overlay').length, 1);

		leafKeys = [];
		onDidChangeVisibleWindows.fire();
		assert.strictEqual(overlay.isConnected, false);
		assert.strictEqual(sessionWindow.querySelector('.conversation-subagent-overlay'), null);
		assert.strictEqual(editorTimeline.querySelector('.conversation-subagent-overlay'), null);
		assert.strictEqual(sessionChatService.isSubAgentDialogOpen(sessionKey), false);
	});

	test('reparents subagent overlay on late-appearing timeline without unmounting (r08-3)', () => {
		const sessionWindow = document.createElement('div');
		document.body.appendChild(sessionWindow);
		store.add({ dispose: () => sessionWindow.remove() });

		const onDidChangeVisibleWindows = new Emitter<void>();
		store.add(onDidChangeVisibleWindows);

		let leafKeys = [SESSION_KEY];
		const mountCalls: Array<{ sessionKey: string; host: unknown }> = [];
		const reparentCalls: Array<{ sessionKey: string; newHost: unknown }> = [];
		const unmountCalls: string[] = [];

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationPartService, {
			getSlots: () => ({ sessionBar: document.createElement('div'), sessionWindowGrid: document.createElement('div') }),
			onDidCreateSlots: Event.None,
		} as unknown as IConversationPartService);
		instantiationService.stub(IConversationSessionWindowService, {
			...createNoopConversationSessionWindowService(),
			onDidChangeVisibleWindows: onDidChangeVisibleWindows.event,
			getAllLeafSessionKeys: () => leafKeys,
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
			mountSubAgentOverlay: (key: string, host: unknown) => {
				mountCalls.push({ sessionKey: key, host });
			},
			reparentSubAgentOverlay: (key: string, newHost: unknown) => {
				reparentCalls.push({ sessionKey: key, newHost });
			},
			unmountSubAgentOverlay: (key: string) => {
				unmountCalls.push(key);
			},
			getConversationPart: () => undefined,
			registerPartListeners: () => ({ dispose: () => { } }),
		});

		store.add(instantiationService.createInstance(ConversationSessionChatContribution));

		// 1. Initial mount on sessionWindow
		assert.strictEqual(mountCalls.length, 1);
		assert.strictEqual(mountCalls[0].sessionKey, SESSION_KEY);
		assert.strictEqual(mountCalls[0].host, sessionWindow);
		assert.strictEqual(unmountCalls.length, 0);
		assert.strictEqual(reparentCalls.length, 0);

		// 2. An internal timeline inside subagent overlay must NOT be selected as host
		const fakeOverlay = document.createElement('div');
		fakeOverlay.className = 'conversation-subagent-overlay';
		const internalTimeline = document.createElement('div');
		internalTimeline.className = 'conversation-timeline';
		fakeOverlay.appendChild(internalTimeline);
		sessionWindow.appendChild(fakeOverlay);

		onDidChangeVisibleWindows.fire();
		assert.strictEqual(mountCalls.length, 1);
		assert.strictEqual(reparentCalls.length, 0, 'Internal overlay timeline must not trigger reparent');
		assert.strictEqual(unmountCalls.length, 0);

		// 3. Late appearing editor timeline outside overlay triggers reparent
		const editorTimeline = document.createElement('div');
		editorTimeline.className = 'conversation-timeline';
		sessionWindow.appendChild(editorTimeline);

		onDidChangeVisibleWindows.fire();
		assert.strictEqual(reparentCalls.length, 1);
		assert.strictEqual(reparentCalls[0].sessionKey, SESSION_KEY);
		assert.strictEqual(reparentCalls[0].newHost, editorTimeline);
		assert.strictEqual(unmountCalls.length, 0, 'Must not unmount existing overlay on reparent');
		assert.strictEqual(mountCalls.length, 1, 'Must not create a second overlay');

		// 4. Repeated visible window notification keeps existing overlay and host
		onDidChangeVisibleWindows.fire();
		assert.strictEqual(reparentCalls.length, 1);
		assert.strictEqual(mountCalls.length, 1);
		assert.strictEqual(unmountCalls.length, 0);

		// 5. Leaf disappearing unmounts overlay
		leafKeys = [];
		onDidChangeVisibleWindows.fire();
		assert.deepStrictEqual(unmountCalls, [SESSION_KEY]);
	});

});
