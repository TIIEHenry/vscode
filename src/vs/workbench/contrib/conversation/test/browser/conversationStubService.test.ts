/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationStubService } from '../../browser/conversationStubService.js';

suite('ConversationStubService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('starts with one empty untitled session', () => {
		const service = store.add(new ConversationStubService());
		const sessions = service.getSessions();
		assert.strictEqual(sessions.length, 1);
		assert.ok(sessions[0].title.includes('Untitled'));
		assert.strictEqual(service.getTurns(sessions[0].id).length, 0);
		assert.strictEqual(service.getActiveSessionId(), sessions[0].id);
	});

	test('switchSession changes the active session id', () => {
		const service = store.add(new ConversationStubService());
		const initialId = service.getActiveSessionId();
		const secondId = service.createSession();

		service.switchSession(initialId);
		assert.strictEqual(service.getActiveSessionId(), initialId);

		service.switchSession(secondId);
		assert.strictEqual(service.getActiveSessionId(), secondId);
	});

	test('createSession increases session count and switches active', () => {
		const service = store.add(new ConversationStubService());
		const initialCount = service.getSessions().length;
		const initialId = service.getActiveSessionId();

		const newId = service.createSession();

		assert.strictEqual(service.getSessions().length, initialCount + 1);
		assert.strictEqual(service.getActiveSessionId(), newId);
		assert.notStrictEqual(newId, initialId);
		assert.strictEqual(service.getTurns(newId).length, 0);
		assert.ok(service.getActiveSession().title.includes('New session'));
	});

	test('renameSession trims title and fires onDidChangeSession', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		const previousTitle = service.getActiveSession().title;
		let changedSessionId: string | undefined;

		store.add(service.onDidChangeSession(id => {
			changedSessionId = id;
		}));

		assert.strictEqual(service.renameSession(sessionId, '  My renamed session  '), true);
		assert.strictEqual(changedSessionId, sessionId);
		assert.strictEqual(service.getActiveSession().title, 'My renamed session');
		assert.strictEqual(service.getSessions().find(s => s.id === sessionId)?.title, 'My renamed session');

		assert.strictEqual(service.renameSession(sessionId, '   '), false);
		assert.strictEqual(service.getActiveSession().title, 'My renamed session');

		assert.strictEqual(service.renameSession(sessionId, previousTitle), false);
		assert.strictEqual(service.getActiveSession().title, 'My renamed session');

		assert.strictEqual(service.renameSession('missing', 'Nope'), false);
	});

	test('deleteSession removes a non-active session without changing active', () => {
		const service = store.add(new ConversationStubService());
		const activeId = service.getActiveSessionId();
		const otherId = service.createSession();
		service.switchSession(activeId);
		const initialCount = service.getSessions().length;
		let activeChanged = false;

		store.add(service.onDidChangeActiveSession(() => {
			activeChanged = true;
		}));

		assert.strictEqual(service.deleteSession(otherId), true);
		assert.strictEqual(service.getSessions().length, initialCount - 1);
		assert.strictEqual(service.getActiveSessionId(), activeId);
		assert.strictEqual(activeChanged, false);
		assert.strictEqual(service.getSessions().some(s => s.id === otherId), false);
	});

	test('deleteSession on active session switches to another session', () => {
		const service = store.add(new ConversationStubService());
		const activeId = service.getActiveSessionId();
		const otherId = service.createSession();
		service.switchSession(activeId);
		let newActiveId: string | undefined;

		store.add(service.onDidChangeActiveSession(id => {
			newActiveId = id;
		}));

		assert.strictEqual(service.deleteSession(activeId), true);
		assert.notStrictEqual(service.getActiveSessionId(), activeId);
		assert.strictEqual(newActiveId, service.getActiveSessionId());
		assert.strictEqual(service.getActiveSessionId(), otherId);
	});

	test('deleteSession on last session creates a fresh untitled stub', () => {
		const service = store.add(new ConversationStubService());
		const sessions = [...service.getSessions()];
		for (const session of sessions) {
			assert.strictEqual(service.deleteSession(session.id), true);
		}

		assert.strictEqual(service.getSessions().length, 1);
		assert.ok(service.getActiveSession().title.includes('Untitled'));
		assert.strictEqual(service.getTurns(service.getActiveSessionId()).length, 0);
	});

	test('deleteSession on last session fires onDidChangeSession for the new active stub', () => {
		const service = store.add(new ConversationStubService());
		const sessions = [...service.getSessions()];
		for (const session of sessions.slice(0, -1)) {
			service.deleteSession(session.id);
		}
		const lastId = service.getActiveSessionId();
		const changedIds: string[] = [];
		store.add(service.onDidChangeSession(id => changedIds.push(id)));

		service.deleteSession(lastId);

		assert.strictEqual(service.getSessions().length, 1);
		assert.strictEqual(changedIds.length, 2);
		assert.strictEqual(changedIds[0], lastId);
		assert.strictEqual(changedIds[1], service.getActiveSessionId());
		assert.notStrictEqual(changedIds[1], lastId);
	});

	test('deleteSession returns false for unknown id', () => {
		const service = store.add(new ConversationStubService());
		const initialCount = service.getSessions().length;
		assert.strictEqual(service.deleteSession('missing'), false);
		assert.strictEqual(service.getSessions().length, initialCount);
	});

	test('appendThinkingTurn and appendToolTurn add seedable process turns', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();

		const thinking = service.appendThinkingTurn(sessionId, 'Planning next steps');
		const tool = service.appendToolTurn(sessionId, 'Read package.json');

		assert.ok(thinking);
		assert.ok(tool);
		assert.strictEqual(thinking!.kind, 'thinking');
		assert.strictEqual(tool!.kind, 'tool');
		assert.strictEqual(service.getTurns(sessionId).length, 2);
	});

	test('deleteTurn removes one turn and returns false for unknown id', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		const user = service.appendUserTurn(sessionId, 'Hello');
		const assistant = service.appendStubEchoAssistant(sessionId, 'Echo');
		assert.ok(user);
		assert.ok(assistant);

		let changedSessionId: string | undefined;
		store.add(service.onDidChangeSession(id => {
			changedSessionId = id;
		}));

		assert.strictEqual(service.deleteTurn(sessionId, user!.id), true);
		assert.strictEqual(changedSessionId, sessionId);
		assert.strictEqual(service.getTurns(sessionId).length, 1);
		assert.strictEqual(service.getTurns(sessionId)[0].id, assistant!.id);

		assert.strictEqual(service.deleteTurn(sessionId, 'missing-turn'), false);
		assert.strictEqual(service.deleteTurn('missing-session', assistant!.id), false);
	});

	test('deleteTurn on last turn does not create a session', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		const initialSessionCount = service.getSessions().length;
		const user = service.appendUserTurn(sessionId, 'Only message');
		assert.ok(user);

		assert.strictEqual(service.deleteTurn(sessionId, user!.id), true);
		assert.strictEqual(service.getSessions().length, initialSessionCount);
		assert.strictEqual(service.getActiveSessionId(), sessionId);
		assert.strictEqual(service.getTurns(sessionId).length, 0);
	});
});
