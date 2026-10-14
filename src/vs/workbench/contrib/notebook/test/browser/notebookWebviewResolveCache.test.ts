/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareNotebookWebviewResolve } from '../../browser/notebookWebviewResolveCache.js';

suite('shareNotebookWebviewResolve', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('concurrent resolves start once', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		let starts = 0;
		let resolveFirst: ((value: string) => void) | undefined;
		const start = () => {
			starts++;
			return new Promise<string>(resolve => {
				resolveFirst = resolve;
			});
		};

		const first = shareNotebookWebviewResolve(slot, start);
		const second = shareNotebookWebviewResolve(slot, start);
		assert.strictEqual(first, second);
		assert.strictEqual(slot.promise, first);
		assert.strictEqual(starts, 1);

		resolveFirst!('webview');
		assert.strictEqual(await first, 'webview');
		assert.strictEqual(await second, 'webview');
		assert.strictEqual(await shareNotebookWebviewResolve(slot, start), 'webview');
		assert.strictEqual(starts, 1);
	});

	test('starts again after the first rejection and not inside that call', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		const error = new Error('webview create failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const start = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('webview');
		};

		const first = shareNotebookWebviewResolve(slot, start);
		const second = shareNotebookWebviewResolve(slot, start);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected resolve must not start again inside the same call');
		assert.strictEqual(slot.promise, null);

		assert.strictEqual(await shareNotebookWebviewResolve(slot, start), 'webview');
		assert.strictEqual(starts, 2, 'the next resolve must start again');
		assert.strictEqual(await shareNotebookWebviewResolve(slot, start), 'webview');
		assert.strictEqual(starts, 2, 'a fulfilled webview stays cached');
	});

	test('does not start again after the first success', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		let starts = 0;
		const start = () => {
			starts++;
			return Promise.resolve('webview');
		};

		const first = shareNotebookWebviewResolve(slot, start);
		const second = shareNotebookWebviewResolve(slot, start);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);
		assert.strictEqual(await first, 'webview');
		assert.strictEqual(await second, 'webview');
		assert.strictEqual(await shareNotebookWebviewResolve(slot, start), 'webview');
		assert.strictEqual(starts, 1);
		assert.strictEqual(slot.promise, first);
	});

	test('a rejection clears the slot only while it still points at that attempt', async () => {
		const slot: { promise: Promise<string> | null } = { promise: null };
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareNotebookWebviewResolve(slot, () => {
			starts++;
			return new Promise<string>((_resolve, reject) => {
				rejectFirst = reject;
			});
		});
		const replacement = Promise.resolve('newer');
		slot.promise = replacement;

		const error = new Error('late webview failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);

		assert.strictEqual(slot.promise, replacement);
		const second = shareNotebookWebviewResolve(slot, () => {
			starts++;
			return Promise.resolve('other');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(await second, 'newer');
		assert.strictEqual(starts, 1);

		const cleared: { promise: Promise<string> | null } = { promise: null };
		let rejectCleared: ((reason: unknown) => void) | undefined;
		const dropped = shareNotebookWebviewResolve(cleared, () => new Promise<string>((_resolve, reject) => {
			rejectCleared = reject;
		}));
		cleared.promise = null;
		const droppedError = new Error('disposed while resolving');
		rejectCleared!(droppedError);
		await assert.rejects(dropped, (reason: unknown) => reason === droppedError);
		assert.strictEqual(cleared.promise, null);
	});
});
