/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { groupCustomizationItemsByStorage, storageForAgentInstructionFile } from '../../common/aiCustomizationTreeGroups.js';
import { PromptsStorage } from '../../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));

function readViewsSource(): string {
	const rel = 'src/vs/sessions/contrib/aiCustomizationTreeView/browser/aiCustomizationTreeViewViews.ts';
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../browser/aiCustomizationTreeViewViews.ts'),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `views source not found (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

suite('AI customization tree storage groups', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('plugin items stay in their own group instead of being dropped', () => {
		const groups = groupCustomizationItemsByStorage([
			{ storage: 'local', id: 'workspace-skill' },
			{ storage: 'plugin', id: 'plugin-skill' },
			{ storage: 'plugin', id: 'plugin-agent' },
			{ storage: 'builtin', id: 'builtin-skill' },
		]);

		assert.deepStrictEqual(groups.map(group => group.storage), ['local', 'plugin', 'builtin']);
		assert.deepStrictEqual(groups[1].items.map(item => item.id), ['plugin-skill', 'plugin-agent']);
	});

	test('empty storages are omitted and unknown storages do not become a group', () => {
		const groups = groupCustomizationItemsByStorage([
			{ storage: 'user', id: 'user-skill' },
			{ storage: 'remote-host', id: 'remote' },
		]);

		assert.deepStrictEqual(groups.map(group => group.storage), ['user']);
		assert.strictEqual(groups[0].items.length, 1);
	});

	test('group order is workspace, user, plugins, extensions, built-in', () => {
		const groups = groupCustomizationItemsByStorage([
			{ storage: 'builtin' },
			{ storage: 'extension' },
			{ storage: 'plugin' },
			{ storage: 'user' },
			{ storage: 'local' },
		]);

		assert.deepStrictEqual(groups.map(group => group.storage), ['local', 'user', 'plugin', 'extension', 'builtin']);
	});

	test('skills and other prompt types both group through the same storage list', () => {
		const source = readViewsSource();
		const calls = source.match(/groupCustomizationItemsByStorage\(/g) ?? [];
		assert.strictEqual(calls.length, 2);
		assert.ok(source.includes('for (const storage of AI_CUSTOMIZATION_TREE_GROUP_STORAGES)'));
		assert.ok(!source.includes('cached.skills.filter(s => s.storage === PromptsStorage.local)'));
		assert.ok(!source.includes('[PromptsStorage.plugin,'));
	});

	test('user-home claude and copilot instructions are user storage, workspace copies stay local', () => {
		const home = URI.file('/home/me');
		const cases = [
			{ uri: URI.joinPath(home, '.claude', 'CLAUDE.md'), storage: PromptsStorage.user },
			{ uri: URI.joinPath(home, '.claude', 'claude.md'), storage: PromptsStorage.user },
			{ uri: URI.joinPath(home, '.copilot', 'copilot-instructions.md'), storage: PromptsStorage.user },
			{ uri: URI.joinPath(home, 'repo', 'CLAUDE.md'), storage: PromptsStorage.local },
			{ uri: URI.joinPath(home, 'repo', '.claude', 'CLAUDE.md'), storage: PromptsStorage.local },
			{ uri: URI.joinPath(home, 'repo', '.github', 'copilot-instructions.md'), storage: PromptsStorage.local },
			{ uri: URI.joinPath(home, 'repo', 'AGENTS.md'), storage: PromptsStorage.local },
			{ uri: URI.joinPath(home, '.claude', 'CLAUDE.local.md'), storage: PromptsStorage.local },
			{ uri: URI.file('/other/home/.claude/CLAUDE.md'), storage: PromptsStorage.local },
		];

		assert.deepStrictEqual(
			cases.map(item => storageForAgentInstructionFile(item.uri, home)),
			cases.map(item => item.storage),
		);
	});

	test('instruction grouping asks for user-home storage instead of forcing workspace', () => {
		const source = readViewsSource();
		assert.ok(source.includes('storage: userHome ? storageForAgentInstructionFile(file.uri, userHome) : PromptsStorage.local'));
		assert.ok(!source.includes('storage: PromptsStorage.local, type: PromptsType.instructions'));
		assert.ok(source.includes('() => this.pathService.userHome()'));
	});
});
