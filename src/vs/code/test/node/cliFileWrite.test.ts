/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { chmodSync, mkdirSync, readFileSync, rmSync, statSync, truncateSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { randomPath } from '../../../base/common/extpath.js';
import { executeCliFileWrite, ICliFileWriteFs } from '../../node/cli.js';

suite('CLI --file-write', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	let testDir: string;
	let sourcePath: string;
	let targetPath: string;

	setup(() => {
		testDir = randomPath(join(tmpdir(), 'vscode-cli-file-write'));
		mkdirSync(testDir, { recursive: true });
		sourcePath = join(testDir, 'source.txt');
		targetPath = join(testDir, 'target.txt');
		writeFileSync(sourcePath, 'source-bytes');
		writeFileSync(targetPath, 'original-target-bytes');
	});

	teardown(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	test('file-write succeeds with Windows strategy and restores chmod mode', () => {
		const readonlyMode = statSync(targetPath).mode & ~0o200;
		chmodSync(targetPath, readonlyMode);

		executeCliFileWrite(sourcePath, targetPath, true, true);

		assert.strictEqual(readFileSync(targetPath).toString(), 'source-bytes');
		assert.strictEqual(statSync(targetPath).mode, readonlyMode);
	});

	test('file-write restores target bytes after Windows strategy write failure', () => {
		const original = readFileSync(targetPath);
		let rPlusWrites = 0;
		const fs: ICliFileWriteFs = {
			readFileSync: (path) => readFileSync(path),
			statSync: (path) => statSync(path),
			chmodSync: (path, mode) => chmodSync(path, mode),
			truncateSync: (path, length) => truncateSync(path, length),
			writeFileSync: (path, data, options) => {
				if (options?.flag === 'r+') {
					rPlusWrites++;
					if (rPlusWrites === 1) {
						throw new Error('simulated r+ write failure');
					}
				}
				writeFileSync(path, data, options);
			},
		};

		assert.throws(() => executeCliFileWrite(sourcePath, targetPath, false, true, fs), (error: Error) => error.message === 'simulated r+ write failure');
		assert.deepStrictEqual(readFileSync(targetPath), original);
	});

	test('file-write restores chmod after Windows strategy failure with file-chmod', () => {
		const readonlyMode = statSync(targetPath).mode & ~0o200;
		chmodSync(targetPath, readonlyMode);
		const sourceBytes = readFileSync(sourcePath);
		const fs: ICliFileWriteFs = {
			readFileSync: (path) => readFileSync(path),
			statSync: (path) => statSync(path),
			chmodSync: (path, mode) => chmodSync(path, mode),
			truncateSync: (path, length) => truncateSync(path, length),
			writeFileSync: (path, data, options) => {
				if (options?.flag === 'r+' && data.equals(sourceBytes)) {
					throw new Error('simulated write failure');
				}
				writeFileSync(path, data, options);
			},
		};

		assert.throws(() => executeCliFileWrite(sourcePath, targetPath, true, true, fs), (error: Error) => error.message === 'simulated write failure');
		assert.strictEqual(statSync(targetPath).mode, readonlyMode);
	});

	test('file-write leaves bytes unchanged when truncate fails under Windows strategy', () => {
		const original = readFileSync(targetPath);
		const readonlyMode = statSync(targetPath).mode & ~0o200;
		chmodSync(targetPath, readonlyMode);
		const fs: ICliFileWriteFs = {
			readFileSync: (path) => readFileSync(path),
			statSync: (path) => statSync(path),
			chmodSync: (path, mode) => chmodSync(path, mode),
			truncateSync: () => {
				throw new Error('simulated truncate failure');
			},
			writeFileSync: (path, data, options) => writeFileSync(path, data, options),
		};

		assert.throws(() => executeCliFileWrite(sourcePath, targetPath, true, true, fs), /simulated truncate failure/);
		assert.deepStrictEqual(readFileSync(targetPath), original);
		assert.strictEqual(statSync(targetPath).mode, readonlyMode);
	});
});
