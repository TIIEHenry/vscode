/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import assert from 'assert';
import { tmpdir } from 'os';
import { createCancelablePromise } from '../../../common/async.js';
import { CancellationTokenSource } from '../../../common/cancellation.js';
import { isCancellationError } from '../../../common/errors.js';
import { FileAccess } from '../../../common/network.js';
import * as path from '../../../common/path.js';
import { Promises } from '../../../node/pfs.js';
import { buffer, extract, IFile, isZipEntryWithinTarget, validateZip, zip } from '../../../node/zip.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../common/utils.js';
import { getRandomTestPath } from '../testUtils.js';

suite('Zip', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isZipEntryWithinTarget keeps extracted paths inside the target directory', () => {
		const target = '/tmp/out';
		assert.strictEqual(isZipEntryWithinTarget('foo/../../out-evil/pwned.txt', target), false);
		assert.strictEqual(isZipEntryWithinTarget('../../outside/', target), false);
		assert.strictEqual(isZipEntryWithinTarget('foo/bar.txt', target), true);
		assert.strictEqual(isZipEntryWithinTarget('extension/', target), true);
	});

	test('extract should handle directories', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip');
		await fs.promises.mkdir(testDir, { recursive: true });

		const fixtures = FileAccess.asFileUri('vs/base/test/node/zip/fixtures').fsPath;
		const fixture = path.join(fixtures, 'extract.zip');

		await createCancelablePromise(token => extract(fixture, testDir, {}, token));
		const doesExist = await Promises.exists(path.join(testDir, 'extension'));
		assert(doesExist);

		await Promises.rm(testDir);
	});

	test('zip should stream a fixed prefix of a local file', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip');
		const sourcePath = path.join(testDir, 'source.txt');
		const zipPath = path.join(testDir, 'logs.zip');
		await fs.promises.mkdir(testDir, { recursive: true });
		await fs.promises.writeFile(sourcePath, 'snapshot-appended');
		await zip(zipPath, [{ path: 'source.txt', localPath: sourcePath, localPathSize: 8 }]);

		assert.strictEqual((await buffer(zipPath, 'source.txt')).toString(), 'snapshot');

		await Promises.rm(testDir);
	});

	test('zip should clamp a prefix larger than the current file size', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip');
		const sourcePath = path.join(testDir, 'source.txt');
		const zipPath = path.join(testDir, 'logs.zip');
		await fs.promises.mkdir(testDir, { recursive: true });
		await fs.promises.writeFile(sourcePath, 'shrunk');
		// Request more bytes than the file holds: the entry contains the whole file.
		await zip(zipPath, [{ path: 'source.txt', localPath: sourcePath, localPathSize: 1024 }]);

		assert.strictEqual((await buffer(zipPath, 'source.txt')).toString(), 'shrunk');

		await Promises.rm(testDir);
	});

	test('zip should write an empty entry for a zero-length prefix', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip');
		const sourcePath = path.join(testDir, 'source.txt');
		const zipPath = path.join(testDir, 'logs.zip');
		await fs.promises.mkdir(testDir, { recursive: true });
		await fs.promises.writeFile(sourcePath, 'ignored');
		await zip(zipPath, [{ path: 'source.txt', localPath: sourcePath, localPathSize: 0 }]);

		assert.strictEqual((await buffer(zipPath, 'source.txt')).toString(), '');

		await Promises.rm(testDir);
	});

	test('zip should skip an unavailable best-effort bounded source without failing the archive', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip');
		const presentPath = path.join(testDir, 'present.txt');
		const missingPath = path.join(testDir, 'missing.txt');
		const zipPath = path.join(testDir, 'logs.zip');
		await fs.promises.mkdir(testDir, { recursive: true });
		await fs.promises.writeFile(presentPath, 'present-contents');
		await zip(zipPath, [
			{ path: 'missing.txt', localPath: missingPath, localPathSize: 8, skipSourceErrors: true },
			{ path: 'present.txt', localPath: presentPath, localPathSize: 7 },
		]);

		assert.strictEqual((await buffer(zipPath, 'present.txt')).toString(), 'present');
		await assert.rejects(buffer(zipPath, 'missing.txt'));

		await Promises.rm(testDir);
	});

	test('zip should skip an unavailable best-effort source without a size limit', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip');
		const presentPath = path.join(testDir, 'present.txt');
		const missingPath = path.join(testDir, 'missing.txt');
		const zipPath = path.join(testDir, 'logs.zip');
		await fs.promises.mkdir(testDir, { recursive: true });
		await fs.promises.writeFile(presentPath, 'present-contents');
		await zip(zipPath, [
			{ path: 'missing.txt', localPath: missingPath, skipSourceErrors: true },
			{ path: 'present.txt', localPath: presentPath },
		]);

		assert.strictEqual((await buffer(zipPath, 'present.txt')).toString(), 'present-contents');
		await assert.rejects(buffer(zipPath, 'missing.txt'));

		await Promises.rm(testDir);
	});

	test('extract sourcePath matches literal path boundaries', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip-source-path');
		const targetDir = path.join(testDir, 'out');
		const zipPath = path.join(testDir, 'paths.zip');
		await fs.promises.mkdir(testDir, { recursive: true });

		await zip(zipPath, [
			{ path: 'fooXbar/a.txt', contents: 'wrong' },
			{ path: 'extension-extra/a.txt', contents: 'wrong' },
			{ path: 'extension.vsixmanifest', contents: 'wrong' },
			{ path: 'extension/a.txt', contents: 'right' },
			{ path: 'extension/', contents: '' },
		]);

		await createCancelablePromise(token => extract(zipPath, targetDir, { sourcePath: 'foo.bar/' }, token));
		assert.strictEqual(await Promises.exists(path.join(targetDir, 'fooXbar', 'a.txt')), false);

		await Promises.rm(targetDir);
		await createCancelablePromise(token => extract(zipPath, targetDir, { sourcePath: 'extension' }, token));
		assert.strictEqual(await Promises.exists(path.join(targetDir, 'extension-extra', 'a.txt')), false);
		assert.strictEqual(await Promises.exists(path.join(targetDir, '.vsixmanifest')), false);
		assert.strictEqual(await Promises.exists(path.join(targetDir, 'a.txt')), true);
		assert.strictEqual((await fs.promises.readFile(path.join(targetDir, 'a.txt'), 'utf8')), 'right');

		const extensionDirOnlyZip = path.join(testDir, 'extension-dir-only.zip');
		await zip(extensionDirOnlyZip, [{ path: 'extension/', contents: '' }]);
		const extensionOnlyTarget = path.join(testDir, 'extension-only-out');
		await fs.promises.mkdir(extensionOnlyTarget, { recursive: true });
		await createCancelablePromise(token => extract(extensionDirOnlyZip, extensionOnlyTarget, { sourcePath: 'extension/' }, token));
		const extensionOnlyStat = await fs.promises.stat(extensionOnlyTarget);
		assert.strictEqual(extensionOnlyStat.isDirectory(), true);

		await Promises.rm(testDir);
	});

	test('extract overwrite keeps existing content until success', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip-overwrite');
		const targetDir = path.join(testDir, 'out');
		const zipPath = path.join(testDir, 'content.zip');
		const markerPath = path.join(targetDir, 'keep-me.txt');
		await fs.promises.mkdir(targetDir, { recursive: true });
		await fs.promises.writeFile(markerPath, 'marker');

		await zip(zipPath, [
			{ path: 'nested/new.txt', contents: 'new' },
			{ path: '../../outside.txt', contents: 'evil' },
		]);

		const tokenSource = new CancellationTokenSource();
		await assert.rejects(createCancelablePromise(token => extract(zipPath, targetDir, { overwrite: true }, token)));
		assert.strictEqual((await fs.promises.readFile(markerPath, 'utf8')), 'marker');

		tokenSource.cancel();
		await assert.rejects(createCancelablePromise(token => extract(zipPath, targetDir, { overwrite: true }, tokenSource.token)));
		assert.strictEqual((await fs.promises.readFile(markerPath, 'utf8')), 'marker');

		await createCancelablePromise(token => extract(zipPath, targetDir, { overwrite: true, sourcePath: 'nested/' }, token));
		assert.strictEqual(await Promises.exists(markerPath), false);
		assert.strictEqual((await fs.promises.readFile(path.join(targetDir, 'new.txt'), 'utf8')), 'new');

		await Promises.rm(testDir);
	});

	test('validateZip enforces entry and expanded-size limits', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip-validation');
		const zipPath = path.join(testDir, 'logs.zip');
		await fs.promises.mkdir(testDir, { recursive: true });
		await zip(zipPath, [
			{ path: 'one.txt', contents: '1234' },
			{ path: 'two.txt', contents: '5678' },
		]);

		await validateZip(zipPath, { maxEntries: 10 });
		await assert.rejects(validateZip(zipPath, { maxEntries: 1, maxUncompressedSize: 100 }), /too many entries/);
		await assert.rejects(validateZip(zipPath, { maxEntries: 10, maxUncompressedSize: 7 }), /expands beyond the allowed size/);
		await Promises.rm(testDir);
	});

	test('extract rejects and cleans up temp directory when cancelled during extraction', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip-cancel');
		const targetDir = path.join(testDir, 'out');
		const zipPath = path.join(testDir, 'content.zip');
		const markerPath = path.join(targetDir, 'keep-me.txt');
		await fs.promises.mkdir(targetDir, { recursive: true });
		await fs.promises.writeFile(markerPath, 'original-content');

		const files: IFile[] = [];
		for (let i = 0; i < 20; i++) {
			files.push({ path: `file${i}.txt`, contents: Buffer.alloc(10 * 1024, `data-${i}`) });
		}
		await zip(zipPath, files);

		const tokenSource = new CancellationTokenSource();

		let watcher: fs.FSWatcher | undefined;
		let pollInterval: any;

		try {
			watcher = fs.watch(testDir, (_eventType, filename) => {
				if (filename && filename.includes('.extract-temp-')) {
					tokenSource.cancel();
					watcher?.close();
				}
			});

			pollInterval = setInterval(async () => {
				try {
					const entries = await fs.promises.readdir(testDir);
					if (entries.some(e => e.includes('.extract-temp-'))) {
						clearInterval(pollInterval);
						tokenSource.cancel();
						watcher?.close();
					}
				} catch {
					// ignore
				}
			}, 1);

			await assert.rejects(
				extract(zipPath, targetDir, { overwrite: true }, tokenSource.token),
				(err: any) => isCancellationError(err)
			);
		} finally {
			if (pollInterval) {
				clearInterval(pollInterval);
			}
			watcher?.close();
			tokenSource.dispose();
		}

		// Ensure target directory was not overwritten or destroyed
		assert.strictEqual(await Promises.exists(markerPath), true);
		assert.strictEqual((await fs.promises.readFile(markerPath, 'utf8')), 'original-content');
		assert.strictEqual(await Promises.exists(path.join(targetDir, 'file0.txt')), false);

		// Ensure temporary extraction directory was cleaned up
		const entries = await fs.promises.readdir(testDir);
		const tempDirs = entries.filter(e => e.includes('.extract-temp-'));
		assert.strictEqual(tempDirs.length, 0);

		await Promises.rm(testDir);
	});

	test('extract rejects when cancelled before extraction starts and preserves target', async () => {
		const testDir = getRandomTestPath(tmpdir(), 'vsctests', 'zip-cancel-precancel');
		const targetDir = path.join(testDir, 'out');
		const zipPath = path.join(testDir, 'content.zip');
		const markerPath = path.join(targetDir, 'keep-me.txt');
		await fs.promises.mkdir(targetDir, { recursive: true });
		await fs.promises.writeFile(markerPath, 'original-content');

		await zip(zipPath, [{ path: 'file.txt', contents: 'new-content' }]);

		const tokenSource = new CancellationTokenSource();
		tokenSource.cancel();

		try {
			await assert.rejects(
				extract(zipPath, targetDir, { overwrite: true }, tokenSource.token),
				(err: any) => isCancellationError(err)
			);
		} finally {
			tokenSource.dispose();
		}

		assert.strictEqual(await Promises.exists(markerPath), true);
		assert.strictEqual((await fs.promises.readFile(markerPath, 'utf8')), 'original-content');
		assert.strictEqual(await Promises.exists(path.join(targetDir, 'file.txt')), false);

		const entries = await fs.promises.readdir(testDir);
		const tempDirs = entries.filter(e => e.includes('.extract-temp-'));
		assert.strictEqual(tempDirs.length, 0);

		await Promises.rm(testDir);
	});
});
