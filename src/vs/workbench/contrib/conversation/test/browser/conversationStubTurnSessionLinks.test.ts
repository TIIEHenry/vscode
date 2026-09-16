/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { rewriteConversationStubTurnSessionLinks } from '../../browser/rewriteConversationStubTurnSessionLinks.js';
import { IConversationSessionChatEntry } from '../../common/conversationSessionChat.js';
import { ConversationStubService } from '../../browser/conversationStubService.js';

suite('rewriteConversationStubTurnSessionLinks (D472)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const toolA: IConversationSessionChatEntry = {
		sessionKey: 'untitled',
		chatId: 'tool-a',
		title: 'Tool A (Stub)',
		originKind: 'tool',
	};

	function catalogFor(entries: readonly IConversationSessionChatEntry[]) {
		return (sessionKey: string) => entries.filter(entry => entry.sessionKey === sessionKey);
	}

	test('parseable stub path + catalog hit rewrites to conversation-chat', () => {
		const rewritten = rewriteConversationStubTurnSessionLinks(
			'See [Tool A (Stub)](/session/untitled/chat/tool-a).',
			catalogFor([toolA]),
		);
		assert.strictEqual(
			rewritten,
			'See [Tool A (Stub)](conversation-chat:/session/untitled/chat/tool-a).',
		);
	});

	test('catalog miss leaves original text unchanged', () => {
		const original = 'See [missing](/session/untitled/chat/no-such-agent).';
		assert.strictEqual(rewriteConversationStubTurnSessionLinks(original, catalogFor([])), original);
		assert.strictEqual(rewriteConversationStubTurnSessionLinks(original, catalogFor([toolA])), original);
	});

	test('already conversation-chat links are unchanged even on catalog hit', () => {
		const original = 'See [ok](conversation-chat:/session/untitled/chat/tool-a).';
		assert.strictEqual(rewriteConversationStubTurnSessionLinks(original, catalogFor([toolA])), original);
	});

	test('does not guess live-engine or donor schemes and does not invent RPC', () => {
		const original = [
			'[host](agent-host-session://untitled/tool-a)',
			'[web](https://example.com/session/untitled/chat/tool-a)',
			'[ok](/session/untitled/chat/tool-a)',
		].join(' ');
		let lookups = 0;
		const rewritten = rewriteConversationStubTurnSessionLinks(original, sessionKey => {
			lookups++;
			assert.strictEqual(sessionKey, 'untitled');
			return [toolA];
		});
		assert.ok(rewritten.includes('[host](agent-host-session://untitled/tool-a)'));
		assert.ok(rewritten.includes('[web](https://example.com/session/untitled/chat/tool-a)'));
		assert.ok(rewritten.includes('[ok](conversation-chat:/session/untitled/chat/tool-a)'));
		assert.strictEqual(lookups, 1);
	});

	test('sideChat catalog rows do not rewrite', () => {
		const original = 'See [side](/session/untitled/chat/side-1).';
		const rewritten = rewriteConversationStubTurnSessionLinks(original, catalogFor([{
			sessionKey: 'untitled',
			chatId: 'side-1',
			title: 'Side',
			originKind: 'sideChat',
		}]));
		assert.strictEqual(rewritten, original);
	});
});

suite('D472 stub getTurns projection rewrite', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const toolA: IConversationSessionChatEntry = {
		sessionKey: 'untitled',
		chatId: 'tool-a',
		title: 'Tool A (Stub)',
		originKind: 'tool',
	};

	test('path-only + catalog hit writes conversation-chat onto projected assistant text', () => {
		const service = store.add(new ConversationStubService());
		service.stubTurnSessionLinkCatalog = sessionKey => sessionKey === 'untitled' ? [toolA] : [];
		const echo = service.appendStubEchoAssistant('untitled', 'See [Tool A (Stub)](/session/untitled/chat/tool-a).');
		assert.ok(echo);
		const projected = service.getTurns('untitled').find(turn => turn.id === echo.id);
		assert.strictEqual(projected?.text, 'See [Tool A (Stub)](conversation-chat:/session/untitled/chat/tool-a).');
		const record = service.getTrajectoryRecords('untitled').find(item => item.id === echo.id);
		assert.strictEqual(record?.text, projected?.text);
	});

	test('catalog miss leaves getTurns assistant text byte-for-byte unchanged', () => {
		const service = store.add(new ConversationStubService());
		service.stubTurnSessionLinkCatalog = () => [];
		const original = 'See [missing](/session/untitled/chat/no-such-agent).';
		const echo = service.appendStubEchoAssistant('untitled', original);
		assert.ok(echo);
		const projected = service.getTurns('untitled').find(turn => turn.id === echo.id);
		assert.strictEqual(projected?.text, original);
	});
});
