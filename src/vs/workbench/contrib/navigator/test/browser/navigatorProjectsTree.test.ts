/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { ConversationStubSession } from '../../../conversation/browser/conversationStubModel.js';
import { NAVIGATOR_STALE_SNAPSHOT_COPY } from '../../common/navigatorAgentTreeEmptyState.js';
import {
	buildNavigatorProjectsTree,
	countLocalFolders,
	workDirGroupLabel,
} from '../../browser/navigatorProjectsTree.js';

suite('NavigatorProjectsTree (N1)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const localFolder = {
		id: 'recent:/tmp/demo',
		resource: URI.file('/tmp/demo'),
		name: 'demo',
		openable: { folderUri: URI.file('/tmp/demo') },
	};

	test('no engine yields only local folder group', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: false,
			wasEverConnected: false,
			transportFailed: false,
			sessionListCapability: 'UNKNOWN',
			sessions: [],
			localFolders: [localFolder],
		});
		assert.strictEqual(tree.length, 1);
		assert.strictEqual(tree[0]?.kind, 'local-group');
		assert.strictEqual(countLocalFolders(tree), 1);
	});

	test('engine connected builds work_dir groups and sessions without an Engine root', () => {
		const sessions: ConversationStubSession[] = [
			{ id: 'ua-1', title: 'Session A', turns: [] },
			{ id: 'ua-2', title: 'Session B', turns: [] },
		];
		const tree = buildNavigatorProjectsTree({
			engineConnected: true,
			wasEverConnected: true,
			transportFailed: false,
			sessionListCapability: 'SUPPORTED',
			workDir: '/engine/work',
			sessions,
			localFolders: [localFolder],
		});
		assert.strictEqual(tree.length, 2);
		assert.strictEqual(tree[0]?.kind, 'workdir');
		assert.strictEqual(tree[0]?.children?.length, 2);
		assert.strictEqual(tree[1]?.kind, 'local-group');
		assert.strictEqual(tree.some(node => node.id === 'engine:root'), false);
	});

	test('sessionList UNSUPPORTED shows an honest top-level note', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: true,
			wasEverConnected: true,
			transportFailed: false,
			sessionListCapability: 'UNSUPPORTED',
			workDir: '/engine/work',
			sessions: [],
			localFolders: [],
		});
		const note = tree[0];
		assert.strictEqual(note?.kind, 'note');
		assert.ok(note?.label.includes('session list'));
	});

	test('connected empty sessions with SUPPORTED sessionList shows workdir without loading note', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: true,
			wasEverConnected: true,
			transportFailed: false,
			sessionListCapability: 'SUPPORTED',
			workDir: '/engine/work',
			sessions: [],
			localFolders: [],
		});
		assert.ok(!tree.some(node => node.id === 'engine:session-list-loading'));
		assert.strictEqual(tree[0]?.kind, 'workdir');
		assert.deepStrictEqual(tree[0]?.children ?? [], []);
	});

	test('disconnect shows a top-level transport note', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: false,
			wasEverConnected: true,
			transportFailed: true,
			sessionListCapability: 'SUPPORTED',
			workDir: '/engine/work',
			sessions: [{ id: 'ua-1', title: 'Cached', turns: [] }],
			localFolders: [],
		});
		assert.strictEqual(tree[0]?.kind, 'note');
		assert.ok(tree[0]?.label.includes('snapshot from before disconnect'));
		assert.strictEqual(tree.some(node => node.id === 'engine:root'), false);
	});

	test('clean disconnect leftover sessions keep workdir but mark stale snapshot', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: false,
			wasEverConnected: true,
			transportFailed: false,
			sessionListCapability: 'SUPPORTED',
			workDir: '/engine/work',
			sessions: [{ id: 'ua-1', title: 'Cached', turns: [] }],
			localFolders: [],
		});
		assert.strictEqual(tree[0]?.kind, 'note');
		assert.strictEqual(tree[0]?.label, NAVIGATOR_STALE_SNAPSHOT_COPY);
		const workdir = tree.find(child => child.kind === 'workdir');
		assert.strictEqual(workdir?.children?.[0]?.label, 'Cached');
	});

	test('sessions with distinct workDir split into separate groups', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: true,
			wasEverConnected: true,
			transportFailed: false,
			sessionListCapability: 'SUPPORTED',
			workDir: '/engine/work',
			workspaceRoots: ['/home/me/current'],
			sessions: [
				{ id: 'ua-1', title: 'Here', turns: [], workDir: '/home/me/current' },
				{ id: 'ua-2', title: 'There', turns: [], workDir: '/other/project' },
			],
			localFolders: [],
		});
		const groups = tree.filter(child => child.kind === 'workdir');
		assert.strictEqual(groups.length, 2);
		assert.strictEqual(groups[0]?.currentWorkspace, true);
		assert.ok(groups[0]?.label.includes('current workspace'));
		assert.deepStrictEqual(groups[0]?.children?.map(child => child.sessionId), ['ua-1']);
		assert.strictEqual(groups[1]?.currentWorkspace, false);
		assert.deepStrictEqual(groups[1]?.children?.map(child => child.sessionId), ['ua-2']);
	});

	test('session without workDir falls back to connection workDir group', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: true,
			wasEverConnected: true,
			transportFailed: false,
			sessionListCapability: 'SUPPORTED',
			workDir: '/engine/work',
			sessions: [
				{ id: 'ua-1', title: 'A', turns: [] },
				{ id: 'ua-2', title: 'B', turns: [], workDir: '/engine/work' },
			],
			localFolders: [],
		});
		const groups = tree.filter(child => child.kind === 'workdir');
		assert.strictEqual(groups.length, 1);
		assert.strictEqual(groups[0]?.description, '/engine/work');
		assert.strictEqual(groups[0]?.children?.length, 2);
	});
	test('current window folder is marked and other folders are not', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: false,
			wasEverConnected: false,
			transportFailed: false,
			sessionListCapability: 'UNKNOWN',
			workspaceRoots: ['/projects/demo'],
			sessions: [],
			localFolders: [
				{
					id: 'current:/projects/demo',
					resource: URI.file('/projects/demo'),
					name: 'demo',
					openable: { folderUri: URI.file('/projects/demo') },
				},
				localFolder,
			],
		});
		const folders = tree[0]?.children ?? [];
		assert.strictEqual(folders[0]?.kind, 'local-folder');
		assert.strictEqual(folders[0]?.currentWorkspace, true);
		assert.ok(folders[0]?.label.includes('current workspace'));
		assert.strictEqual(folders[1]?.currentWorkspace, false);
		assert.strictEqual(folders[1]?.label, 'demo');
	});

	test('session rows carry roster detail and the active flag', () => {
		const sessions: ConversationStubSession[] = [
			{ id: 'ua-1', title: 'Same', turns: [] },
			{ id: 'ua-2', title: 'Same', turns: [{ id: 't', kind: 'user', text: 'hi' }] },
		];
		const tree = buildNavigatorProjectsTree({
			engineConnected: true,
			wasEverConnected: true,
			transportFailed: false,
			sessionListCapability: 'SUPPORTED',
			workDir: '/engine/work',
			activeSessionId: 'ua-2',
			sessionDetail: session => session.turns.length === 0 ? 'No messages' : '1 message',
			sessions,
			localFolders: [],
		});
		const rows = tree[0]?.children ?? [];
		assert.strictEqual(rows[0]?.detail, 'No messages');
		assert.strictEqual(rows[0]?.active, false);
		assert.strictEqual(rows[1]?.detail, '1 message');
		assert.strictEqual(rows[1]?.active, true);
	});

	test('workDirGroupLabel falls back to default label when basename is empty', () => {
		assert.strictEqual(workDirGroupLabel('/', false), 'Working directory');
		assert.strictEqual(workDirGroupLabel('/', true), 'Working directory · current workspace');
		assert.strictEqual(workDirGroupLabel('', false), 'Working directory');
		assert.strictEqual(workDirGroupLabel(undefined, false), 'Working directory');
		assert.strictEqual(workDirGroupLabel('/home/project', false), 'project');
		assert.strictEqual(workDirGroupLabel('/home/project', true), 'project · current workspace');
	});
});
