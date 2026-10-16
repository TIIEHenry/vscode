/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	agentWorkDirIsFileRoot,
	normalizeAgentWorkDirKey,
	resolveAgentWorkRoot,
} from '../../common/agentWorkRoot.js';

suite('agentWorkRoot', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('session workDir wins over the connection workDir', () => {
		const root = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: '/session',
			connectionWorkDir: '/connection',
			engineIdentityId: 'eng',
			repositoryRoots: [],
			workspaceFolders: [],
		});
		assert.strictEqual(root.workDir, '/session');
		assert.strictEqual(root.source, 'session');
		assert.strictEqual(root.access, 'engine');
		assert.strictEqual(root.projectKey, 'eng\n/session');
	});

	test('blank session workDir falls back to the connection workDir', () => {
		const root = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: '   ',
			connectionWorkDir: '/connection',
			engineIdentityId: 'eng',
			repositoryRoots: [],
			workspaceFolders: [],
		});
		assert.strictEqual(root.workDir, '/connection');
		assert.strictEqual(root.source, 'connection');
	});

	test('missing session and connection workDir is none', () => {
		const root = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: undefined,
			connectionWorkDir: '  ',
			engineIdentityId: 'eng',
			repositoryRoots: [],
			workspaceFolders: [],
		});
		assert.strictEqual(root.source, 'none');
		assert.strictEqual(root.access, 'none');
		assert.strictEqual(root.workDir, undefined);
		assert.strictEqual(root.projectKey, undefined);
	});

	test('trailing slash and backslash normalize to one project key', () => {
		assert.strictEqual(normalizeAgentWorkDirKey('/proj/'), '/proj');
		assert.strictEqual(normalizeAgentWorkDirKey('C:\\proj\\'), 'C:/proj');
		assert.strictEqual(normalizeAgentWorkDirKey('/'), '/');
		const left = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: '/proj/',
			connectionWorkDir: undefined,
			engineIdentityId: 'eng',
			repositoryRoots: [],
			workspaceFolders: [],
		});
		const right = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: '/proj',
			connectionWorkDir: undefined,
			engineIdentityId: 'eng',
			repositoryRoots: [],
			workspaceFolders: [],
		});
		assert.strictEqual(left.projectKey, right.projectKey);
	});

	test('SCM root wins over a window folder, including a nested repository', () => {
		const windowRoot = URI.file('/a');
		const repoRoot = URI.file('/a/b');
		const root = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: '/a/b/',
			connectionWorkDir: undefined,
			engineIdentityId: 'eng',
			repositoryRoots: [repoRoot],
			workspaceFolders: [windowRoot],
		});
		assert.strictEqual(root.access, 'local');
		assert.strictEqual(root.localRoot?.toString(), repoRoot.toString());
	});

	test('a matching file folder is local when no repository root is set', () => {
		const folder = URI.file('/repo');
		const root = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: '/repo',
			connectionWorkDir: undefined,
			engineIdentityId: 'eng',
			repositoryRoots: [],
			workspaceFolders: [folder, URI.file('/other')],
		});
		assert.strictEqual(root.access, 'local');
		assert.strictEqual(root.localRoot?.toString(), folder.toString());
		assert.strictEqual(agentWorkDirIsFileRoot('/repo/', [folder]), true);
		assert.strictEqual(agentWorkDirIsFileRoot('/repo/src', [folder]), false);
	});

	test('several matching candidates stay unrooted', () => {
		const folder = URI.file('/repo');
		const root = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: '/repo',
			connectionWorkDir: undefined,
			engineIdentityId: 'eng',
			repositoryRoots: [folder, URI.file('/repo/')],
			workspaceFolders: [],
		});
		assert.strictEqual(root.localRoot, undefined);
		assert.strictEqual(root.access, 'engine');
	});

	test('a missing engine identity has no project key', () => {
		const root = resolveAgentWorkRoot({
			sessionId: 's1',
			sessionWorkDir: '/repo',
			connectionWorkDir: undefined,
			engineIdentityId: '   ',
			repositoryRoots: [],
			workspaceFolders: [],
		});
		assert.strictEqual(root.engineIdentityId, undefined);
		assert.strictEqual(root.projectKey, undefined);
	});
});
