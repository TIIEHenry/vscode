/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationStubService } from '../../browser/conversationStubService.js';

suite('ConversationStubService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('exposes at least three seed stub sessions', () => {
		const service = store.add(new ConversationStubService());
		assert.ok(service.getSessions().length >= 3);
	});

	test('switchSession changes the active session id', () => {
		const service = store.add(new ConversationStubService());
		const sessions = service.getSessions();
		assert.ok(sessions.length >= 2);

		const initialId = service.getActiveSessionId();
		const target = sessions.find(session => session.id !== initialId);
		assert.ok(target);

		service.switchSession(target.id);
		assert.strictEqual(service.getActiveSessionId(), target.id);
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
		const target = service.getSessions().find(s => s.id !== activeId);
		assert.ok(target);
		const initialCount = service.getSessions().length;
		let activeChanged = false;

		store.add(service.onDidChangeActiveSession(() => {
			activeChanged = true;
		}));

		assert.strictEqual(service.deleteSession(target.id), true);
		assert.strictEqual(service.getSessions().length, initialCount - 1);
		assert.strictEqual(service.getActiveSessionId(), activeId);
		assert.strictEqual(activeChanged, false);
		assert.strictEqual(service.getSessions().some(s => s.id === target.id), false);
	});

	test('deleteSession on active session switches to another session', () => {
		const service = store.add(new ConversationStubService());
		const sessions = service.getSessions();
		const activeId = service.getActiveSessionId();
		const remaining = sessions.filter(s => s.id !== activeId);
		assert.ok(remaining.length >= 1);
		let newActiveId: string | undefined;

		store.add(service.onDidChangeActiveSession(id => {
			newActiveId = id;
		}));

		assert.strictEqual(service.deleteSession(activeId), true);
		assert.notStrictEqual(service.getActiveSessionId(), activeId);
		assert.strictEqual(newActiveId, service.getActiveSessionId());
		assert.ok(remaining.some(s => s.id === service.getActiveSessionId()));
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

	test('deleteSession returns false for unknown id', () => {
		const service = store.add(new ConversationStubService());
		const initialCount = service.getSessions().length;
		assert.strictEqual(service.deleteSession('missing'), false);
		assert.strictEqual(service.getSessions().length, initialCount);
	});
});
