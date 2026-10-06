/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import { computeWorktreeIncludeSourcePaths } from '../worktreeIncludeFiles';

suite('worktree include source paths', () => {
	const root = path.join('/repo', 'root');

	test('**/.env hit under src/app yields only that file', () => {
		const envFile = path.join(root, 'src', 'app', '.env');
		const result = computeWorktreeIncludeSourcePaths(root, [envFile], ['**/.env']);
		assert.deepStrictEqual(result, [envFile]);
		assert.ok(!result.some(p => p === path.join(root, 'src')));
		assert.ok(!result.some(p => p === path.join(root, 'src', 'app')));
	});

	test('foo/**/.env hit yields only that file', () => {
		const envFile = path.join(root, 'foo', 'a', '.env');
		const result = computeWorktreeIncludeSourcePaths(root, [envFile], ['foo/**/.env']);
		assert.deepStrictEqual(result, [envFile]);
		assert.ok(!result.some(p => p === path.join(root, 'foo')));
	});

	test('root .env yields only that file', () => {
		const envFile = path.join(root, '.env');
		const result = computeWorktreeIncludeSourcePaths(root, [envFile], ['**/.env']);
		assert.deepStrictEqual(result, [envFile]);
	});
});
