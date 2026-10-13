/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { SnippetParser } from '../../../../../editor/contrib/snippet/browser/snippetParser.js';
import { IFileContent, IFileService } from '../../../../../platform/files/common/files.js';
import { SnippetFile, Snippet, SnippetSource } from '../../browser/snippetsFile.js';

suite('Snippets', function () {

	ensureNoDisposablesAreLeakedInTestSuite();

	class TestSnippetFile extends SnippetFile {
		constructor(filepath: URI, snippets: Snippet[]) {
			super(SnippetSource.Extension, filepath, undefined, undefined, undefined!, undefined!);
			this.data.push(...snippets);
		}
	}

	test('SnippetFile#select', () => {
		let file = new TestSnippetFile(URI.file('somepath/foo.code-snippets'), []);
		let bucket: Snippet[] = [];
		file.select('', bucket);
		assert.strictEqual(bucket.length, 0);

		file = new TestSnippetFile(URI.file('somepath/foo.code-snippets'), [
			new Snippet(false, ['foo'], 'FooSnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User, generateUuid()),
			new Snippet(false, ['foo'], 'FooSnippet2', 'foo', '', 'snippet', 'test', SnippetSource.User, generateUuid()),
			new Snippet(false, ['bar'], 'BarSnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User, generateUuid()),
			new Snippet(false, ['bar.comment'], 'BarSnippet2', 'foo', '', 'snippet', 'test', SnippetSource.User, generateUuid()),
			new Snippet(false, ['bar.strings'], 'BarSnippet2', 'foo', '', 'snippet', 'test', SnippetSource.User, generateUuid()),
			new Snippet(false, ['bazz', 'bazz'], 'BazzSnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User, generateUuid()),
		]);

		bucket = [];
		file.select('foo', bucket);
		assert.strictEqual(bucket.length, 2);

		bucket = [];
		file.select('fo', bucket);
		assert.strictEqual(bucket.length, 0);

		bucket = [];
		file.select('bar', bucket);
		assert.strictEqual(bucket.length, 1);

		bucket = [];
		file.select('bar.comment', bucket);
		assert.strictEqual(bucket.length, 2);

		bucket = [];
		file.select('bazz', bucket);
		assert.strictEqual(bucket.length, 1);
	});

	test('SnippetFile#select - any scope', function () {

		const file = new TestSnippetFile(URI.file('somepath/foo.code-snippets'), [
			new Snippet(false, [], 'AnySnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User, generateUuid()),
			new Snippet(false, ['foo'], 'FooSnippet1', 'foo', '', 'snippet', 'test', SnippetSource.User, generateUuid()),
		]);

		const bucket: Snippet[] = [];
		file.select('foo', bucket);
		assert.strictEqual(bucket.length, 2);

	});

	test('Snippet#needsClipboard', function () {

		function assertNeedsClipboard(body: string, expected: boolean): void {
			const snippet = new Snippet(false, ['foo'], 'FooSnippet1', 'foo', '', body, 'test', SnippetSource.User, generateUuid());
			assert.strictEqual(snippet.needsClipboard, expected);

			assert.strictEqual(SnippetParser.guessNeedsClipboard(body), expected);
		}

		assertNeedsClipboard('foo$CLIPBOARD', true);
		assertNeedsClipboard('${CLIPBOARD}', true);
		assertNeedsClipboard('foo${CLIPBOARD}bar', true);
		assertNeedsClipboard('foo$clipboard', false);
		assertNeedsClipboard('foo${clipboard}', false);
		assertNeedsClipboard('baba', false);
	});

	test('Snippet#isTrivial', function () {

		function assertIsTrivial(body: string, expected: boolean): void {
			const snippet = new Snippet(false, ['foo'], 'FooSnippet1', 'foo', '', body, 'test', SnippetSource.User, generateUuid());
			assert.strictEqual(snippet.isTrivial, expected);
		}

		assertIsTrivial('foo', true);
		assertIsTrivial('foo$0', true);
		assertIsTrivial('foo$0bar', false);
		assertIsTrivial('foo$1', false);
		assertIsTrivial('foo$1$0', false);
		assertIsTrivial('${1:foo}', false);
	});

	const snippetText = '{"A":{"prefix":"a","body":"body"}}';

	function fileContent(text: string): IFileContent {
		return upcastPartial<IFileContent>({ value: VSBuffer.fromString(text) });
	}

	function createFile(readFile: () => Promise<IFileContent>): SnippetFile {
		return new SnippetFile(
			SnippetSource.User,
			URI.file('somepath/foo.code-snippets'),
			undefined,
			undefined,
			upcastPartial<IFileService>({ readFile }),
			undefined!,
		);
	}

	test('SnippetFile#load reads again after the file read fails', async () => {
		const error = new Error('read failed');
		let reads = 0;
		const file = createFile(async () => {
			reads++;
			if (reads === 1) {
				throw error;
			}
			return fileContent(snippetText);
		});

		await assert.rejects(file.load(), (reason: unknown) => reason === error);
		assert.strictEqual(reads, 1);
		assert.strictEqual(file.data.length, 0);

		assert.strictEqual(await file.load(), file);
		assert.strictEqual(reads, 2);
		assert.strictEqual(file.data.length, 1);
		assert.strictEqual(file.data[0].prefix, 'a');

		assert.strictEqual(await file.load(), file);
		assert.strictEqual(reads, 2);
		assert.strictEqual(file.data.length, 1);
	});

	test('SnippetFile#load reads again after parsing fails', async () => {
		let reads = 0;
		const file = createFile(async () => {
			reads++;
			return fileContent(reads === 1 ? '{"Bad":null}' : snippetText);
		});

		await assert.rejects(file.load(), (reason: unknown) => reason instanceof TypeError);
		assert.strictEqual(reads, 1);
		assert.strictEqual(file.data.length, 0);

		assert.strictEqual(await file.load(), file);
		assert.strictEqual(reads, 2);
		assert.strictEqual(file.data.length, 1);
		assert.strictEqual(file.data[0].body, 'body');
	});

	test('SnippetFile#load does not read again after success', async () => {
		let reads = 0;
		const file = createFile(async () => {
			reads++;
			return fileContent(snippetText);
		});

		assert.strictEqual(await file.load(), file);
		assert.strictEqual(reads, 1);
		assert.strictEqual(file.data.length, 1);

		assert.strictEqual(await file.load(), file);
		assert.strictEqual(reads, 1);
		assert.strictEqual(file.data.length, 1);
	});

	test('SnippetFile#load shares one in-flight read', async () => {
		let reads = 0;
		let release!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const file = createFile(async () => {
			reads++;
			await gate;
			return fileContent(snippetText);
		});

		const first = file.load();
		const second = file.load();
		assert.strictEqual(reads, 1);

		release();
		const [loadedFirst, loadedSecond] = await Promise.all([first, second]);
		assert.strictEqual(loadedFirst, file);
		assert.strictEqual(loadedSecond, file);
		assert.strictEqual(reads, 1);
		assert.strictEqual(file.data.length, 1);

		assert.strictEqual(await file.load(), file);
		assert.strictEqual(reads, 1);
	});

	test('SnippetFile#load drops a rejected attempt only while it still points at that attempt', async () => {
		const error = new Error('read failed late');
		let reads = 0;
		let rejectRead!: (reason: Error) => void;
		const file = createFile(() => {
			reads++;
			return new Promise((_resolve, reject) => {
				rejectRead = reject;
			});
		});

		const first = file.load();
		assert.strictEqual(reads, 1);
		const replacement = Promise.resolve(file);
		(file as unknown as { _loadPromise: Promise<SnippetFile> | undefined })._loadPromise = replacement;

		rejectRead(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(reads, 1);

		assert.strictEqual(await file.load(), file);
		assert.strictEqual(reads, 1);
	});

});
