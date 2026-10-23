/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { conversationLensSessionBarNewSession } from '../../browser/conversationLensSessionBarStrings.js';
import { conversationSessionsViewEmptyMessage, conversationSessionsViewNoMatches, formatSessionRosterAriaLabel, formatSessionRosterGroupLabel, formatSessionRosterSubtitle, groupSessionsForRoster, resolveSessionRosterTone } from '../../browser/conversationSessionsViewStrings.js';
import type { ConversationStubSession, ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('ConversationSessionsView strings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty chrome is a user-facing roster empty, not a stub conversation', () => {
		assert.ok(conversationSessionsViewEmptyMessage.includes('No sessions'));
		assert.ok(conversationSessionsViewEmptyMessage.includes(conversationLensSessionBarNewSession));
		assert.ok(!conversationSessionsViewEmptyMessage.match(/stub conversation/i));
		assert.ok(!conversationSessionsViewEmptyMessage.match(/in-memory/i));
		assert.ok(!conversationSessionsViewEmptyMessage.match(/engine session/i));
		assert.ok(!conversationSessionsViewEmptyMessage.toLowerCase().includes('open chat'));
		assert.ok(!conversationSessionsViewEmptyMessage.match(/copilot/i), 'must not mention Copilot');
	});

	test('filter miss copy matches Agents / Team', () => {
		assert.strictEqual(conversationSessionsViewNoMatches, 'No matches');
	});

	function session(partial: Partial<ConversationStubSession> & Pick<ConversationStubSession, 'id' | 'title'>): ConversationStubSession {
		return { turns: [], ...partial };
	}

	function tool(id: string, toolStatus: ConversationStubTurn['toolStatus']): ConversationStubTurn {
		return { id, kind: 'tool', text: id, toolStatus };
	}

	test('subtitle uses relative time when the session was accessed, and keeps the pending count', () => {
		const timed = session({ id: 'timed', title: 'Timed', lastAccessedAt: Date.now() });
		const subtitle = formatSessionRosterSubtitle(timed, 1, 4);
		assert.ok(!subtitle.includes('message'));
		assert.ok(subtitle.includes('1 confirmation pending'));
		assert.ok(subtitle.startsWith('now') || subtitle.includes('sec'));

		const quiet = session({ id: 'quiet', title: 'Quiet' });
		assert.strictEqual(formatSessionRosterSubtitle(quiet, 0, 2), '2 messages');
		assert.strictEqual(formatSessionRosterSubtitle(quiet, 2, 0), 'No messages · 2 confirmations pending');
		assert.strictEqual(formatSessionRosterSubtitle(quiet, 0, 2, 'running'), '2 messages · running');
		assert.strictEqual(formatSessionRosterSubtitle(quiet, 0, 2, 'failed'), '2 messages · failed');
		assert.strictEqual(formatSessionRosterSubtitle(quiet, 1, 2, 'waiting'), '2 messages · 1 confirmation pending');
	});

	test('roster tone prefers a pending confirmation, then a running tool, then a failure', () => {
		assert.strictEqual(resolveSessionRosterTone([tool('a', 'failed'), tool('b', 'running')], 1), 'waiting');
		assert.strictEqual(resolveSessionRosterTone([tool('a', 'failed'), tool('b', 'running')], 0), 'running');
		assert.strictEqual(resolveSessionRosterTone([tool('a', 'failed')], 0), 'failed');
		assert.strictEqual(resolveSessionRosterTone([tool('a', 'completed')], 0), 'idle');
		assert.strictEqual(resolveSessionRosterTone([
			{ id: 'a1', kind: 'assistant', text: 'still writing', streaming: true },
		], 0), 'running');
		assert.strictEqual(resolveSessionRosterTone([
			{ id: 't1', kind: 'tool', text: 'write', toolStatus: 'pending' },
		], 0), 'idle');
	});

	test('roster groups by access time and stays flat when no session has one', () => {
		const now = new Date(2026, 9, 22, 12, 0, 0).getTime();
		const today = session({ id: 'today', title: 'Today item', lastAccessedAt: now - 60_000 });
		const yesterday = session({ id: 'yesterday', title: 'Yesterday item', lastAccessedAt: now - 24 * 60 * 60 * 1000 });
		const earlier = session({ id: 'earlier', title: 'Earlier item', lastAccessedAt: now - 3 * 24 * 60 * 60 * 1000 });
		const undated = session({ id: 'undated', title: 'Undated' });
		const grouped = groupSessionsForRoster([earlier, today, undated, yesterday], now);
		assert.deepStrictEqual(grouped.map(entry => entry.kind === 'header' ? formatSessionRosterGroupLabel(entry.group) : entry.session.id), [
			'Today', 'today',
			'Yesterday', 'yesterday',
			'Earlier', 'earlier', 'undated',
		]);
		assert.strictEqual(groupSessionsForRoster([undated, session({ id: 'other', title: 'Other' })], now).every(entry => entry.kind === 'session'), true);
	});

	test('roster aria label names the status and the active session', () => {
		const quiet = session({ id: 'quiet', title: 'Quiet' });
		assert.strictEqual(
			formatSessionRosterAriaLabel(quiet, 0, 1, 'failed', true),
			'Quiet, 1 message · failed, active session',
		);
		assert.strictEqual(
			formatSessionRosterAriaLabel(quiet, 0, 1, 'idle', false),
			'Quiet, 1 message',
		);
		assert.strictEqual(
			formatSessionRosterAriaLabel(quiet, 1, 1, 'waiting', false),
			'Quiet, 1 message · 1 confirmation pending, waiting for confirmation',
		);
	});
});
