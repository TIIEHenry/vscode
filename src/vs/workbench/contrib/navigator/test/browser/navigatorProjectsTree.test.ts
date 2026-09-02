/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { ConversationStubSession } from '../../../conversation/browser/conversationStubModel.js';
import {
	buildNavigatorProjectsTree,
	countLocalFolders,
} from '../../common/navigatorProjectsTree.js';

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

	test('engine connected builds engine root, work_dir, and sessions', () => {
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
		assert.strictEqual(tree[0]?.kind, 'engine-root');
		assert.strictEqual(tree[0]?.children?.[0]?.kind, 'workdir');
		assert.strictEqual(tree[0]?.children?.[0]?.children?.length, 2);
		assert.strictEqual(tree[1]?.kind, 'local-group');
	});

	test('sessionList UNSUPPORTED shows honest note under engine root', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: true,
			wasEverConnected: true,
			transportFailed: false,
			sessionListCapability: 'UNSUPPORTED',
			workDir: '/engine/work',
			sessions: [],
			localFolders: [],
		});
		const note = tree[0]?.children?.[0];
		assert.strictEqual(note?.kind, 'note');
		assert.ok(note?.label.includes('会话列表'));
	});

	test('disconnect retains engine root with transport note', () => {
		const tree = buildNavigatorProjectsTree({
			engineConnected: false,
			wasEverConnected: true,
			transportFailed: true,
			sessionListCapability: 'SUPPORTED',
			workDir: '/engine/work',
			sessions: [{ id: 'ua-1', title: 'Cached', turns: [] }],
			localFolders: [],
		});
		assert.strictEqual(tree[0]?.kind, 'engine-root');
		assert.ok(tree[0]?.children?.some(child => child.kind === 'note' && child.label.includes('断开前快照')));
	});
});
