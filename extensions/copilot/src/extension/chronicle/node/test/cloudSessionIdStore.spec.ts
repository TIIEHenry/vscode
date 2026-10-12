/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CloudSessionIdStore } from '../cloudSessionIdStore';

describe('CloudSessionIdStore', () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'cloud-session-store-test-'));
	});

	afterEach(async () => {
		await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
	});

	it('starts empty when no file exists', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		expect(store.size).toBe(0);
		expect(store.has('session-1')).toBe(false);
	});

	it('set and get work correctly', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		store.set('session-1', { cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' });

		expect(store.has('session-1')).toBe(true);
		expect(store.get('session-1')).toEqual({ cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' });
		expect(store.size).toBe(1);
	});

	it('delete removes entry and returns true', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		store.set('session-1', { cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' });

		const existed = store.delete('session-1');
		expect(existed).toBe(true);
		expect(store.has('session-1')).toBe(false);
		expect(store.size).toBe(0);
	});

	it('delete returns false for nonexistent entry', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		expect(store.delete('nonexistent')).toBe(false);
	});

	it('persists data and survives reload', async () => {
		const store1 = new CloudSessionIdStore(tmpDir);
		await store1.load();
		store1.set('session-1', { cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' });
		store1.set('session-2', { cloudSessionId: 'cloud-2', cloudTaskId: 'task-2' });

		// Wait for async persist
		await new Promise(resolve => setTimeout(resolve, 50));

		const store2 = new CloudSessionIdStore(tmpDir);
		await store2.load();
		expect(store2.size).toBe(2);
		expect(store2.get('session-1')).toEqual({ cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' });
		expect(store2.get('session-2')).toEqual({ cloudSessionId: 'cloud-2', cloudTaskId: 'task-2' });
	});

	it('delete persists removal', async () => {
		const store1 = new CloudSessionIdStore(tmpDir);
		await store1.load();
		store1.set('session-1', { cloudSessionId: 'cloud-1', cloudTaskId: 'task-1' });

		// Wait for persist
		await new Promise(resolve => setTimeout(resolve, 50));

		store1.delete('session-1');

		// Wait for persist
		await new Promise(resolve => setTimeout(resolve, 50));

		const store2 = new CloudSessionIdStore(tmpDir);
		await store2.load();
		expect(store2.size).toBe(0);
	});

	it('mergeFromCloud adds new entries without removing existing', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		store.set('local-1', { cloudSessionId: 'cloud-local', cloudTaskId: 'local-1' });

		store.mergeFromCloud([
			{ id: 'cloud-remote', agent_task_id: 'remote-1' },
			{ id: 'cloud-local', agent_task_id: 'local-1' }, // already exists — should not overwrite
		]);

		expect(store.size).toBe(2);
		expect(store.get('remote-1')).toEqual({ cloudSessionId: 'cloud-remote', cloudTaskId: 'remote-1' });
		// Original entry preserved
		expect(store.get('local-1')).toEqual({ cloudSessionId: 'cloud-local', cloudTaskId: 'local-1' });
	});

	it('mergeFromCloud skips entries without agent_task_id', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();

		store.mergeFromCloud([
			{ id: 'cloud-1', agent_task_id: undefined as any },
			{ id: 'cloud-2', agent_task_id: '' },
			{ id: 'cloud-3', agent_task_id: 'valid-task' },
		]);

		expect(store.size).toBe(1);
		expect(store.has('valid-task')).toBe(true);
	});

	it('mergeFromCloud prefers task_id over agent_task_id for cloudTaskId', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();

		store.mergeFromCloud([
			{ id: 'cloud-with-task', agent_task_id: 'local-a', task_id: 'server-task-a' },
			{ id: 'cloud-no-task', agent_task_id: 'local-b' },
		]);

		expect(store.get('local-a')).toEqual({ cloudSessionId: 'cloud-with-task', cloudTaskId: 'server-task-a' });
		expect(store.get('local-b')).toEqual({ cloudSessionId: 'cloud-no-task', cloudTaskId: 'local-b' });
	});

	it('mergeFromCloud refreshes stale cloudTaskId when the cloud listing later provides task_id', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();

		// Simulate an entry reconciled before task_id was exposed (cloudTaskId
		// fell back to agent_task_id).
		store.mergeFromCloud([{ id: 'cloud-1', agent_task_id: 'local-1' }]);
		expect(store.get('local-1')).toEqual({ cloudSessionId: 'cloud-1', cloudTaskId: 'local-1' });

		// Cloud listing now returns a real server task_id — the entry should
		// be refreshed so delete uses the correct identifier.
		store.mergeFromCloud([{ id: 'cloud-1', agent_task_id: 'local-1', task_id: 'server-task-1' }]);
		expect(store.get('local-1')).toEqual({ cloudSessionId: 'cloud-1', cloudTaskId: 'server-task-1' });
	});

	it('keys returns all session IDs', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		store.set('session-1', { cloudSessionId: 'c1', cloudTaskId: 't1' });
		store.set('session-2', { cloudSessionId: 'c2', cloudTaskId: 't2' });

		const keys = [...store.keys()];
		expect(keys).toContain('session-1');
		expect(keys).toContain('session-2');
		expect(keys).toHaveLength(2);
	});

	it('clear removes all entries', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		store.set('session-1', { cloudSessionId: 'c1', cloudTaskId: 't1' });
		store.set('session-2', { cloudSessionId: 'c2', cloudTaskId: 't2' });

		store.clear();
		expect(store.size).toBe(0);
	});

	it('load is idempotent', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		store.set('session-1', { cloudSessionId: 'c1', cloudTaskId: 't1' });

		// Wait for persist
		await new Promise(resolve => setTimeout(resolve, 50));

		await store.load();
		await store.load(); // Second call should be no-op
		expect(store.size).toBe(1);
	});

	it('handles corrupted JSON file gracefully', async () => {
		await fsp.writeFile(path.join(tmpDir, 'cloudSessions.json'), 'not valid json', 'utf-8');

		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		expect(store.size).toBe(0); // Should start fresh
	});

	it('handles malformed entries in JSON file', async () => {
		const data = {
			'valid': { cloudSessionId: 'c1', cloudTaskId: 't1' },
			'missing-cloud-id': { cloudTaskId: 't2' },
			'missing-task-id': { cloudSessionId: 'c3' },
			'null-entry': null,
		};
		await fsp.writeFile(path.join(tmpDir, 'cloudSessions.json'), JSON.stringify(data), 'utf-8');

		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		expect(store.size).toBe(1); // Only the valid entry
		expect(store.has('valid')).toBe(true);
	});

	function loadedFlag(store: CloudSessionIdStore): boolean {
		return (store as unknown as { _loaded: boolean })._loaded;
	}

	it('does not clobber corrupted JSON on load or later mutations', async () => {
		const filePath = path.join(tmpDir, 'cloudSessions.json');
		const original = 'not valid json {{{';
		await fsp.writeFile(filePath, original, 'utf-8');

		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		expect(store.size).toBe(0);
		expect(loadedFlag(store)).toBe(false);
		expect(await fsp.readFile(filePath, 'utf-8')).toBe(original);

		store.set('session-1', { cloudSessionId: 'c1', cloudTaskId: 't1' });
		store.delete('session-1');
		store.mergeFromCloud([{ id: 'cloud-x', agent_task_id: 'remote-1', task_id: 'server-1' }]);
		store.clear();
		await new Promise(resolve => setTimeout(resolve, 50));

		expect(await fsp.readFile(filePath, 'utf-8')).toBe(original);
		expect(loadedFlag(store)).toBe(false);
	});

	it('stays unloaded when the read fails, writes nothing, and reads again on the next load', async () => {
		const filePath = path.join(tmpDir, 'cloudSessions.json');
		await fsp.mkdir(filePath);

		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		expect(loadedFlag(store)).toBe(false);
		expect((await fsp.stat(filePath)).isDirectory()).toBe(true);

		store.set('session-1', { cloudSessionId: 'c1', cloudTaskId: 't1' });
		await new Promise(resolve => setTimeout(resolve, 50));
		expect((await fsp.stat(filePath)).isDirectory()).toBe(true);
		expect(await fsp.readdir(tmpDir)).toEqual(['cloudSessions.json']);

		await fsp.rm(filePath, { recursive: true });
		const payload = { 'from-disk': { cloudSessionId: 'c-disk', cloudTaskId: 't-disk' } };
		await fsp.writeFile(filePath, JSON.stringify(payload), 'utf-8');

		await store.load();
		expect(loadedFlag(store)).toBe(true);
		expect(store.get('from-disk')).toEqual(payload['from-disk']);
		// The set() from the failed load is merged after the file is actually read,
		// not written over it as the only entry.
		await new Promise(resolve => setTimeout(resolve, 50));
		expect(JSON.parse(await fsp.readFile(filePath, 'utf-8'))).toEqual({
			'from-disk': payload['from-disk'],
			'session-1': { cloudSessionId: 'c1', cloudTaskId: 't1' },
		});
	});

	it('does not replace an existing file with entries set before load', async () => {
		const filePath = path.join(tmpDir, 'cloudSessions.json');
		const kept = { cloudSessionId: 'c-kept', cloudTaskId: 't-kept' };
		await fsp.writeFile(filePath, JSON.stringify({ kept }), 'utf-8');

		const store = new CloudSessionIdStore(tmpDir);
		store.set('added', { cloudSessionId: 'c-added', cloudTaskId: 't-added' });
		await new Promise(resolve => setTimeout(resolve, 50));
		expect(JSON.parse(await fsp.readFile(filePath, 'utf-8'))).toEqual({ kept });

		await store.load();
		expect(store.get('kept')).toEqual(kept);
		expect(store.get('added')).toEqual({ cloudSessionId: 'c-added', cloudTaskId: 't-added' });

		await new Promise(resolve => setTimeout(resolve, 50));
		expect(JSON.parse(await fsp.readFile(filePath, 'utf-8'))).toEqual({
			kept,
			added: { cloudSessionId: 'c-added', cloudTaskId: 't-added' },
		});
	});

	it('writes via a temporary file and leaves no temp file behind', async () => {
		const store = new CloudSessionIdStore(tmpDir);
		await store.load();
		store.set('session-1', { cloudSessionId: 'c1', cloudTaskId: 't1' });
		await new Promise(resolve => setTimeout(resolve, 50));

		const names = await fsp.readdir(tmpDir);
		expect(names.filter(name => name.includes('.tmp'))).toEqual([]);
		expect(JSON.parse(await fsp.readFile(path.join(tmpDir, 'cloudSessions.json'), 'utf-8'))).toEqual({
			'session-1': { cloudSessionId: 'c1', cloudTaskId: 't1' },
		});
	});
});
