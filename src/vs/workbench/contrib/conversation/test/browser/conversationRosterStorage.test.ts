/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../test/common/workbenchTestServices.js';
import { entriesToLegacyTurns, projectSnapshotToEntries } from './conversationSessionView.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { ConversationStubService } from './conversationStubService.js';
import { CONVERSATION_ROSTER_STORAGE_KEY, ConversationRosterStorageV1, loadConversationRosterStorage, saveConversationRosterStorage, withEngineCache } from './conversationRosterStorage.js';

suite('conversationRosterStorage (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function roster(turns: readonly ConversationStubTurn[]): ConversationRosterStorageV1 {
		const local = { id: 'local', title: 'Local', source: 'local' as const, turns };
		const cached = { id: 'cache', title: 'Cache', source: 'engine-cache' as const, turns };
		return { version: 1, wasEverConnected: false, activeSessionId: 'local', nextTurnId: 100,
			localSessions: [local], engineCache: { sessions: [cached] }, engineCaches: { engine: { sessions: [cached] } } };
	}

	test('new storage and actual service restoration preserve unknown and every explicit tool status', () => {
		const storage = store.add(new TestStorageService());
		const turns: ConversationStubTurn[] = [
			{ id: 'unknown', kind: 'tool', text: 'Unknown', toolName: 'read', payload: 'body' },
			...(['pending', 'running', 'completed', 'failed', 'cancelled'] as const).map(toolStatus => ({ id: toolStatus, kind: 'tool' as const, text: toolStatus, toolName: 'read', toolStatus })),
		];
		saveConversationRosterStorage(storage, roster(turns));
		const loaded = loadConversationRosterStorage(storage);
		assert.ok(loaded);
		assert.strictEqual(loaded.toolStatusEncoding, 'explicit');
		for (const sessions of [loaded.localSessions, loaded.engineCache!.sessions, loaded.engineCaches!.engine.sessions]) {
			assert.deepStrictEqual(sessions[0].turns, turns);
		}
		const service = store.add(new ConversationStubService(storage));
		assert.deepStrictEqual(service.getTurns('local'), turns);
		assert.deepStrictEqual(service.getTrajectoryRecords('local').map(record => [record.id, record.kind]), turns.map(turn => [turn.id, 'tool']));
		const lease = store.add(service.acquireSessionView('local'));
		assert.deepStrictEqual(entriesToLegacyTurns(projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details)), turns);
	});

	test('legacy completed omission migrates all buckets before a partial update stamps explicit encoding', () => {
		const storage = store.add(new TestStorageService());
		const turns: ConversationStubTurn[] = [
			{ id: 'old-completed', kind: 'tool', text: 'Old completed', toolName: 'read' },
			{ id: 'text', kind: 'assistant', text: 'Ordinary text' },
			...(['pending', 'running', 'failed', 'cancelled'] as const).map(toolStatus => ({ id: toolStatus, kind: 'tool' as const, text: toolStatus, toolName: 'read', toolStatus })),
		];
		storage.store(CONVERSATION_ROSTER_STORAGE_KEY, JSON.stringify(roster(turns)), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		const loaded = loadConversationRosterStorage(storage);
		assert.ok(loaded);
		const migrated = turns.map(turn => turn.id === 'old-completed' ? { ...turn, toolStatus: 'completed' as const } : turn);
		for (const sessions of [loaded.localSessions, loaded.engineCache!.sessions, loaded.engineCaches!.engine.sessions]) {
			assert.deepStrictEqual(sessions[0].turns, migrated);
		}
		const unknown: ConversationStubTurn = { id: 'new-unknown', kind: 'tool', text: 'Unknown', toolName: 'read' };
		const updated = withEngineCache(loaded, 'engine', { sessions: [{ id: 'new-cache', title: 'New cache', source: 'engine-cache', turns: [unknown] }] });
		saveConversationRosterStorage(storage, updated);
		const reloaded = loadConversationRosterStorage(storage);
		assert.ok(reloaded);
		assert.deepStrictEqual(reloaded.localSessions[0].turns, migrated);
		assert.deepStrictEqual(reloaded.engineCache!.sessions[0].turns, migrated);
		assert.deepStrictEqual(reloaded.engineCaches!.engine.sessions[0].turns, [unknown]);
		const service = store.add(new ConversationStubService(storage));
		const lease = store.add(service.acquireSessionView('local'));
		assert.deepStrictEqual(entriesToLegacyTurns(projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details)), migrated);
	});

	test('localSessions bucket coerces engine-cache source tags so roster rows stay visible', () => {
		const storage = store.add(new TestStorageService());
		storage.store(
			CONVERSATION_ROSTER_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				wasEverConnected: false,
				activeSessionId: 'misplaced-cache',
				nextTurnId: 100,
				localSessions: [{
					id: 'misplaced-cache',
					title: 'Local row',
					source: 'engine-cache',
					turns: [{ id: 'turn-1', kind: 'user', text: 'hello' }],
				}],
			}),
			StorageScope.WORKSPACE,
			StorageTarget.MACHINE,
		);

		const loaded = loadConversationRosterStorage(storage);
		assert.ok(loaded);
		assert.strictEqual(loaded.localSessions.length, 1);
		assert.strictEqual(loaded.localSessions[0].source, 'local');

		const roster = store.add(new ConversationStubService(storage));
		assert.ok(roster.getSessions().some(session => session.id === 'misplaced-cache'));
		assert.strictEqual(roster.getActiveSessionId(), 'misplaced-cache');
	});
});
