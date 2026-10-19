/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { shareShellExecutableRequest } from '../../node/copilot/copilotShellTools.js';

suite('shareShellExecutableRequest', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected shell resolution is not reused; the next resolution starts again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('shell resolution failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('/bin/bash');
		};

		const first = shareShellExecutableRequest(slot, load);
		const second = shareShellExecutableRequest(slot, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected resolution must not call load again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareShellExecutableRequest(slot, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, '/bin/bash');
		assert.strictEqual(starts, 2, 'the next resolution must start again');
		await shareShellExecutableRequest(slot, load);
		assert.strictEqual(starts, 2, 'a fulfilled resolution stays cached');
	});

	test('a rejection does not clear a replacement already stored for that slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareShellExecutableRequest(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('/bin/zsh');
		slot.promise = replacement;

		const error = new Error('late shell resolution failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareShellExecutableRequest(slot, () => {
			starts++;
			return Promise.resolve('/bin/bash');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
