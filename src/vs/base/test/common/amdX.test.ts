/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';
import { shareAmdNodeModuleImport } from '../../../amdX.js';

suite('shareAmdNodeModuleImport', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected import is not reused; the next import calls load again', async () => {
		const cache = new Map<string, Promise<any>>();
		const error = new Error('amd import failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('module');
		};

		const first = shareAmdNodeModuleImport(cache, 'vscode-textmate/release/main.js', load);
		const second = shareAmdNodeModuleImport(cache, 'vscode-textmate/release/main.js', load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected import must not call load again inside the same call');
		assert.strictEqual(cache.has('vscode-textmate/release/main.js'), false);

		const third = shareAmdNodeModuleImport(cache, 'vscode-textmate/release/main.js', load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'module');
		assert.strictEqual(starts, 2, 'the next import must call load again');
		await shareAmdNodeModuleImport(cache, 'vscode-textmate/release/main.js', load);
		assert.strictEqual(starts, 2, 'a fulfilled import stays cached');
	});

	test('concurrent imports share one in-flight load', async () => {
		const cache = new Map<string, Promise<any>>();
		let starts = 0;
		let resolveFirst: ((value: string) => void) | undefined;
		const load = () => {
			starts++;
			return new Promise<string>(resolve => {
				resolveFirst = resolve;
			});
		};

		const first = shareAmdNodeModuleImport(cache, 'vscode-oniguruma/release/main.js', load);
		const second = shareAmdNodeModuleImport(cache, 'vscode-oniguruma/release/main.js', load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		resolveFirst!('onig');
		assert.strictEqual(await first, 'onig');
		assert.strictEqual(await second, 'onig');
		assert.strictEqual(cache.get('vscode-oniguruma/release/main.js'), first);
	});

	test('a rejection does not clear a replacement already stored for that module', async () => {
		const cache = new Map<string, Promise<any>>();
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareAmdNodeModuleImport(cache, 'katex/dist/katex.min.js', () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		cache.set('katex/dist/katex.min.js', replacement);

		const error = new Error('late amd import failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get('katex/dist/katex.min.js'), replacement);

		let starts = 0;
		const second = shareAmdNodeModuleImport(cache, 'katex/dist/katex.min.js', () => {
			starts++;
			return Promise.resolve('again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
