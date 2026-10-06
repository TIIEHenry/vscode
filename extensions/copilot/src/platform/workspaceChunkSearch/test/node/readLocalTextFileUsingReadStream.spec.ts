/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, suite, test } from 'vitest';
import { readLocalTextFileUsingReadStream } from '../../node/workspaceFileIndex';

suite('readLocalTextFileUsingReadStream', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'read-local-text-stream-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	test('detects binary when first chunk exceeds 1024 bytes with NUL', async () => {
		const content = Buffer.alloc(1100, 0x41);
		content[500] = 0;
		const filePath = join(dir, 'large-binary.txt');
		writeFileSync(filePath, content);

		const result = await readLocalTextFileUsingReadStream(filePath, 10_000_000);
		assert.strictEqual(result, 'binary');
	});

	test('detects binary for short files with NUL before stream ends', async () => {
		const content = Buffer.from([0x41, 0x00, 0x42]);
		const filePath = join(dir, 'short-binary.txt');
		writeFileSync(filePath, content);

		const result = await readLocalTextFileUsingReadStream(filePath, 10_000_000);
		assert.strictEqual(result, 'binary');
	});

	test('returns full buffer for long printable text', async () => {
		const content = Buffer.alloc(1500, 0x61);
		const filePath = join(dir, 'long-text.txt');
		writeFileSync(filePath, content);

		const result = await readLocalTextFileUsingReadStream(filePath, 10_000_000);
		assert.ok(Buffer.isBuffer(result));
		assert.deepStrictEqual(result, content);
	});
});
