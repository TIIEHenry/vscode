/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { parseLogEntryAt, FileOutputChannelModel, MultiFileOutputChannelModel } from '../../common/outputChannelModel.js';
import { TextModel } from '../../../../../editor/common/model/textModel.js';
import { ITextModel } from '../../../../../editor/common/model.js';
import { TextEdit } from '../../../../../editor/common/languages.js';
import { IEditorWorkerService } from '../../../../../editor/common/services/editorWorker.js';
import { OutputChannelUpdateMode } from '../../../../services/output/common/output.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { LogLevel } from '../../../../../platform/log/common/log.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { createFileStat, TestFileService } from '../../../../test/common/workbenchTestServices.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';

suite('Logs Parsing', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;

	setup(() => {
		instantiationService = disposables.add(workbenchInstantiationService({}, disposables));
	});

	test('should parse log entry with all components', () => {
		const text = '2023-10-15 14:30:45.123 [info] [Git] Initializing repository';
		const model = createModel(text);
		const entry = parseLogEntryAt(model, 1);

		assert.strictEqual(entry?.timestamp, new Date('2023-10-15 14:30:45.123').getTime());
		assert.strictEqual(entry?.logLevel, LogLevel.Info);
		assert.strictEqual(entry?.category, 'Git');
		assert.strictEqual(model.getValueInRange(entry?.range), text);
	});

	test('should parse multi-line log entry', () => {
		const text = [
			'2023-10-15 14:30:45.123 [error] [Extension] Failed with error:',
			'Error: Could not load extension',
			'    at Object.load (/path/to/file:10:5)'
		].join('\n');
		const model = createModel(text);
		const entry = parseLogEntryAt(model, 1);

		assert.strictEqual(entry?.timestamp, new Date('2023-10-15 14:30:45.123').getTime());
		assert.strictEqual(entry?.logLevel, LogLevel.Error);
		assert.strictEqual(entry?.category, 'Extension');
		assert.strictEqual(model.getValueInRange(entry?.range), text);
	});

	test('should parse log entry without category', () => {
		const text = '2023-10-15 14:30:45.123 [warning] System is running low on memory';
		const model = createModel(text);
		const entry = parseLogEntryAt(model, 1);

		assert.strictEqual(entry?.timestamp, new Date('2023-10-15 14:30:45.123').getTime());
		assert.strictEqual(entry?.logLevel, LogLevel.Warning);
		assert.strictEqual(entry?.category, undefined);
		assert.strictEqual(model.getValueInRange(entry?.range), text);
	});

	test('should return null for invalid log entry', () => {
		const model = createModel('Not a valid log entry');
		const entry = parseLogEntryAt(model, 1);

		assert.strictEqual(entry, null);
	});

	test('should parse all supported log levels', () => {
		const levels = {
			info: LogLevel.Info,
			trace: LogLevel.Trace,
			debug: LogLevel.Debug,
			warning: LogLevel.Warning,
			error: LogLevel.Error
		};

		for (const [levelText, expectedLevel] of Object.entries(levels)) {
			const model = createModel(`2023-10-15 14:30:45.123 [${levelText}] Test message`);
			const entry = parseLogEntryAt(model, 1);
			assert.strictEqual(entry?.logLevel, expectedLevel, `Failed for log level: ${levelText}`);
		}
	});

	test('should parse timestamp correctly', () => {
		const timestamps = [
			'2023-01-01 00:00:00.000',
			'2023-12-31 23:59:59.999',
			'2023-06-15 12:30:45.500'
		];

		for (const timestamp of timestamps) {
			const model = createModel(`${timestamp} [info] Test message`);
			const entry = parseLogEntryAt(model, 1);
			assert.strictEqual(entry?.timestamp, new Date(timestamp).getTime(), `Failed for timestamp: ${timestamp}`);
		}
	});

	test('should handle last line of file', () => {
		const model = createModel([
			'2023-10-15 14:30:45.123 [info] First message',
			'2023-10-15 14:30:45.124 [info] Last message',
			''
		].join('\n'));

		let actual = parseLogEntryAt(model, 1);
		assert.strictEqual(actual?.timestamp, new Date('2023-10-15 14:30:45.123').getTime());
		assert.strictEqual(actual?.logLevel, LogLevel.Info);
		assert.strictEqual(actual?.category, undefined);
		assert.strictEqual(model.getValueInRange(actual?.range), '2023-10-15 14:30:45.123 [info] First message');

		actual = parseLogEntryAt(model, 2);
		assert.strictEqual(actual?.timestamp, new Date('2023-10-15 14:30:45.124').getTime());
		assert.strictEqual(actual?.logLevel, LogLevel.Info);
		assert.strictEqual(actual?.category, undefined);
		assert.strictEqual(model.getValueInRange(actual?.range), '2023-10-15 14:30:45.124 [info] Last message');

		actual = parseLogEntryAt(model, 3);
		assert.strictEqual(actual, null);
	});

	test('should parse multi-line log entry with empty lines', () => {
		const text = [
			'2025-01-27 09:53:00.450 [info] Found with version <20.18.1>',
			'Now using node v20.18.1 (npm v10.8.2)',
			'',
			'> husky - npm run -s precommit',
			'> husky - node v20.18.1',
			'',
			'Reading git index versions...'
		].join('\n');
		const model = createModel(text);
		const entry = parseLogEntryAt(model, 1);

		assert.strictEqual(entry?.timestamp, new Date('2025-01-27 09:53:00.450').getTime());
		assert.strictEqual(entry?.logLevel, LogLevel.Info);
		assert.strictEqual(entry?.category, undefined);
		assert.strictEqual(model.getValueInRange(entry?.range), text);

	});

	test('skips appending a file read that lost its content generation', async function () {
		this.timeout(8000);
		const fileService = instantiationService.get(IFileService);
		assert.ok(fileService instanceof TestFileService);
		const resource = URI.file('/output-race.log');
		let etag = 'e1';
		let hold: Promise<void> | undefined;
		fileService.setContent('alpha\n');
		const originalReadFile = fileService.readFile.bind(fileService);
		const statStub = sinon.stub(fileService, 'stat').callsFake(async candidate => ({
			...createFileStat(candidate),
			etag,
			size: VSBuffer.fromString(fileService.getContent()).byteLength,
		}));
		const readStub = sinon.stub(fileService, 'readFile').callsFake(async (candidate, options) => {
			const pending = hold;
			if (pending) {
				await pending;
			}
			const result = await originalReadFile(candidate, options);
			return { ...result, etag, value: VSBuffer.fromString(fileService.getContent()) };
		});
		const channel = disposables.add(instantiationService.createInstance(
			FileOutputChannelModel,
			URI.parse('output:race.log'),
			{ languageId: 'log', onDidChange: Event.None },
			{ resource, name: 'race' },
		));
		let textModel: Awaited<ReturnType<FileOutputChannelModel['loadModel']>> | undefined;
		try {
			textModel = await channel.loadModel();
			assert.strictEqual(textModel.getValue(), 'alpha\n');

			let releaseRead: () => void = () => { };
			hold = new Promise<void>(resolve => { releaseRead = resolve; });
			etag = 'e2';
			fileService.setContent('alpha\nbeta\n');
			await new Promise(resolve => setTimeout(resolve, 700));
			etag = 'e3';
			fileService.setContent('alpha\nbeta\ngamma\n');
			await new Promise(resolve => setTimeout(resolve, 700));
			hold = undefined;
			releaseRead();
			await new Promise(resolve => setTimeout(resolve, 900));

			const value = textModel.getValue();
			assert.strictEqual(value.split('beta\n').length, 2, value);
			assert.strictEqual(value.split('gamma\n').length, 2, value);
		} finally {
			hold = undefined;
			readStub.restore();
			statStub.restore();
			channel.dispose();
			textModel?.dispose();
		}
	});

	function createModel(content: string): TextModel {
		return disposables.add(instantiationService.createInstance(TextModel, content, 'log', TextModel.DEFAULT_CREATION_OPTIONS, null));
	}
});

suite('Output channel model replace', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	let instantiationService: TestInstantiationService;
	let computeEdits: sinon.SinonSpy;

	interface IFakeLogFile {
		content: string;
		etag: string;
		/** When set, `stat` reports this etag, as if no poll had seen the latest write yet. */
		statEtag?: string;
		hold?: Promise<void>;
		reads: number;
		stats: number;
	}

	setup(() => {
		instantiationService = disposables.add(workbenchInstantiationService({}, disposables));
		// The default test worker returns no edits, which would hide every replace.
		computeEdits = instantiationService.stub(IEditorWorkerService, 'computeMoreMinimalEdits', (_resource: URI, edits: TextEdit[] | null | undefined) => Promise.resolve(edits ?? undefined));
	});

	function logFile(content: string, etag: string): IFakeLogFile {
		return { content, etag, reads: 0, stats: 0 };
	}

	function logLine(seconds: string, message: string): string {
		return `2026-11-07 10:00:${seconds} [info] ${message}\n`;
	}

	function shownLine(seconds: string, name: string, message: string): string {
		return `2026-11-07 10:00:${seconds} [info] [${name}] ${message}\n`;
	}

	function getTestFileService(): TestFileService {
		const fileService = instantiationService.get(IFileService);
		assert.ok(fileService instanceof TestFileService);
		return fileService;
	}

	function stubLogFiles(fileService: TestFileService, files: Map<string, IFakeLogFile>): () => void {
		const originalReadFile = fileService.readFile.bind(fileService);
		const statStub = sinon.stub(fileService, 'stat').callsFake(async candidate => {
			const file = files.get(candidate.toString())!;
			file.stats++;
			return {
				...createFileStat(candidate),
				etag: file.statEtag ?? file.etag,
				size: VSBuffer.fromString(file.content).byteLength,
			};
		});
		const readStub = sinon.stub(fileService, 'readFile').callsFake(async (candidate, options) => {
			const file = files.get(candidate.toString())!;
			file.reads++;
			const pending = file.hold;
			if (pending) {
				await pending;
			}
			const result = await originalReadFile(candidate, options);
			return { ...result, etag: file.etag, value: VSBuffer.fromString(file.content).slice(options?.position ?? 0) };
		});
		return () => {
			readStub.restore();
			statStub.restore();
		};
	}

	function holdReads(file: IFakeLogFile): () => void {
		let release: () => void = () => { };
		file.hold = new Promise<void>(resolve => { release = resolve; });
		return () => {
			file.hold = undefined;
			release();
		};
	}

	async function waitUntil(condition: () => boolean, timeoutMs: number): Promise<boolean> {
		const deadline = Date.now() + timeoutMs;
		while (!condition()) {
			if (Date.now() > deadline) {
				return false;
			}
			await new Promise(resolve => setTimeout(resolve, 20));
		}
		return true;
	}

	function settle(): Promise<unknown> {
		// Longer than one poll (500ms) plus one append delay (300ms).
		return new Promise(resolve => setTimeout(resolve, 900));
	}

	function createFileChannel(resource: URI): FileOutputChannelModel {
		return disposables.add(instantiationService.createInstance(
			FileOutputChannelModel,
			URI.parse('output:replace.log'),
			{ languageId: 'log', onDidChange: Event.None },
			{ resource, name: 'replace' },
		));
	}

	function createCompoundChannel(sources: { resource: URI; name: string }[]): MultiFileOutputChannelModel {
		return disposables.add(instantiationService.createInstance(
			MultiFileOutputChannelModel,
			URI.parse('output:compound.log'),
			{ languageId: 'log', onDidChange: Event.None },
			sources,
		));
	}

	test('a replace whose read loses its content generation reads again instead of leaving the bytes to an append', async function () {
		this.timeout(10000);
		const resource = URI.file('/output-replace.log');
		const file = logFile('old\n', 'e1');
		const restore = stubLogFiles(getTestFileService(), new Map([[resource.toString(), file]]));
		const channel = createFileChannel(resource);
		let textModel: ITextModel | undefined;
		let release = () => { };
		try {
			textModel = await channel.loadModel();
			const model = textModel;
			assert.strictEqual(model.getValue(), 'old\n');

			const till = VSBuffer.fromString(file.content).byteLength;
			file.content = 'old\nnew\n';
			file.etag = 'e2';
			release = holdReads(file);
			const statsBefore = file.stats;
			channel.update(OutputChannelUpdateMode.Replace, till, true);
			assert.ok(await waitUntil(() => file.stats > statsBefore, 3000), 'a poll should see the replaced file while the replace read is held');
			release();

			await waitUntil(() => model.getValue() === 'new\n', 3000);
			await settle();
			assert.strictEqual(model.getValue(), 'new\n');
		} finally {
			release();
			channel.dispose();
			restore();
			textModel?.dispose();
		}
	});

	test('a compound read rejected for one file moves no offsets, so the next read keeps the new lines of every file', async function () {
		this.timeout(10000);
		const one = URI.file('/output-1.log');
		const two = URI.file('/output-2.log');
		const first = logFile(logLine('00.000', 'one-a'), 'one-1');
		const second = logFile(logLine('01.000', 'two-b'), 'two-1');
		const restore = stubLogFiles(getTestFileService(), new Map([[one.toString(), first], [two.toString(), second]]));
		const channel = createCompoundChannel([{ resource: one, name: 'one' }, { resource: two, name: 'two' }]);
		let textModel: ITextModel | undefined;
		let release = () => { };
		try {
			textModel = await channel.loadModel();
			const model = textModel;
			assert.strictEqual(model.getValue(), shownLine('00.000', 'one', 'one-a') + shownLine('01.000', 'two', 'two-b'));

			first.content += logLine('02.000', 'one-c');
			first.etag = 'one-2';
			second.content += logLine('03.000', 'two-d');
			second.etag = 'two-2';
			second.statEtag = 'two-1';
			release = holdReads(first);
			const readsBefore = first.reads;
			assert.ok(await waitUntil(() => first.reads > readsBefore, 3000), 'an append should start reading both files');
			const statsDuringRead = first.stats;
			assert.ok(await waitUntil(() => first.stats > statsDuringRead, 3000), 'a poll of the held file should land while it is read');
			release();

			const expected = shownLine('00.000', 'one', 'one-a') + shownLine('01.000', 'two', 'two-b') + shownLine('02.000', 'one', 'one-c') + shownLine('03.000', 'two', 'two-d');
			await waitUntil(() => model.getValue() === expected, 4000);
			second.statEtag = undefined;
			await settle();
			assert.strictEqual(model.getValue(), expected);
		} finally {
			release();
			channel.dispose();
			restore();
			textModel?.dispose();
		}
	});

	test('a compound replace after a source joins reads every file again when the new file\'s first poll voids the read', async function () {
		this.timeout(10000);
		const one = URI.file('/output-1.log');
		const two = URI.file('/output-2.log');
		const three = URI.file('/output-3.log');
		const first = logFile(logLine('00.000', 'one-a') + logLine('02.000', 'one-c'), 'one-1');
		const second = logFile(logLine('01.000', 'two-b') + logLine('03.000', 'two-f'), 'two-1');
		const third = logFile(logLine('01.500', 'three-x') + logLine('02.500', 'three-y'), 'three-1');
		const restore = stubLogFiles(getTestFileService(), new Map([[one.toString(), first], [two.toString(), second], [three.toString(), third]]));
		const channel = createCompoundChannel([{ resource: one, name: 'one' }, { resource: two, name: 'two' }]);
		let textModel: ITextModel | undefined;
		let release = () => { };
		try {
			textModel = await channel.loadModel();
			const model = textModel;
			assert.strictEqual(model.getValue(), shownLine('00.000', 'one', 'one-a') + shownLine('01.000', 'two', 'two-b') + shownLine('02.000', 'one', 'one-c') + shownLine('03.000', 'two', 'two-f'));

			release = holdReads(third);
			channel.updateChannelSources([{ resource: one, name: 'one' }, { resource: two, name: 'two' }, { resource: three, name: 'three' }]);
			assert.ok(await waitUntil(() => third.reads > 0 && third.stats > 0, 3000), 'the new file should be polled while the replace still reads it');
			release();

			const expected = [
				shownLine('00.000', 'one', 'one-a'),
				shownLine('01.000', 'two', 'two-b'),
				shownLine('01.500', 'three', 'three-x'),
				shownLine('02.000', 'one', 'one-c'),
				shownLine('02.500', 'three', 'three-y'),
				shownLine('03.000', 'two', 'two-f'),
			].join('');
			await waitUntil(() => model.getValue() === expected, 4000);
			await settle();
			assert.strictEqual(model.getValue(), expected);
		} finally {
			release();
			channel.dispose();
			restore();
			textModel?.dispose();
		}
	});

	test('a source change while the compound model is still loading leaves the read to the load', async function () {
		this.timeout(10000);
		const one = URI.file('/output-1.log');
		const two = URI.file('/output-2.log');
		const three = URI.file('/output-3.log');
		const first = logFile(logLine('00.000', 'one-a'), 'one-1');
		const second = logFile(logLine('01.000', 'two-b'), 'two-1');
		const third = logFile(logLine('01.500', 'three-x'), 'three-1');
		const restore = stubLogFiles(getTestFileService(), new Map([[one.toString(), first], [two.toString(), second], [three.toString(), third]]));
		const channel = createCompoundChannel([{ resource: one, name: 'one' }, { resource: two, name: 'two' }]);
		let textModel: ITextModel | undefined;
		const release = holdReads(first);
		const loading = channel.loadModel();
		try {
			assert.ok(await waitUntil(() => first.reads > 0, 1000), 'the load should be reading');
			channel.updateChannelSources([{ resource: one, name: 'one' }, { resource: two, name: 'two' }, { resource: three, name: 'three' }]);
			release();
			textModel = await loading;
			const model = textModel;

			const expected = shownLine('00.000', 'one', 'one-a') + shownLine('01.000', 'two', 'two-b') + shownLine('01.500', 'three', 'three-x');
			await waitUntil(() => model.getValue() === expected, 3000);
			assert.strictEqual(model.getValue(), expected);
			assert.strictEqual(computeEdits.callCount, 0, 'no replace may run before the load has placed its content');
			const reads = first.reads + second.reads + third.reads;
			await settle();
			assert.strictEqual(first.reads + second.reads + third.reads, reads, 'reads should stop once the load has placed its content');
			assert.strictEqual(model.getValue(), expected);
		} finally {
			release();
			channel.dispose();
			restore();
			if (!textModel) {
				textModel = await loading.catch(() => undefined);
			}
			textModel?.dispose();
		}
	});

	test('a clear while the replace read is held stops the replace (loop guard)', async function () {
		this.timeout(10000);
		const resource = URI.file('/output-replace.log');
		const file = logFile('old\n', 'e1');
		const restore = stubLogFiles(getTestFileService(), new Map([[resource.toString(), file]]));
		const channel = createFileChannel(resource);
		let textModel: ITextModel | undefined;
		let release = () => { };
		try {
			textModel = await channel.loadModel();
			const model = textModel;

			const till = VSBuffer.fromString(file.content).byteLength;
			file.content = 'old\nnew\n';
			file.etag = 'e2';
			release = holdReads(file);
			const readsBefore = file.reads;
			channel.update(OutputChannelUpdateMode.Replace, till, true);
			assert.ok(await waitUntil(() => file.reads > readsBefore, 1000), 'the replace should be reading');
			channel.update(OutputChannelUpdateMode.Clear, VSBuffer.fromString(file.content).byteLength, true);
			assert.ok(await waitUntil(() => model.getValue() === '', 1000), 'the clear should empty the model');
			release();
			await settle();
			assert.strictEqual(model.getValue(), '');

			file.content += 'more\n';
			file.etag = 'e3';
			await waitUntil(() => model.getValue() === 'more\n', 3000);
			await settle();
			assert.strictEqual(model.getValue(), 'more\n');
		} finally {
			release();
			channel.dispose();
			restore();
			textModel?.dispose();
		}
	});

	test('disposing the channel while the replace read is held does not read again (loop guard)', async function () {
		this.timeout(10000);
		const resource = URI.file('/output-replace.log');
		const file = logFile('old\n', 'e1');
		const restore = stubLogFiles(getTestFileService(), new Map([[resource.toString(), file]]));
		const channel = createFileChannel(resource);
		let textModel: ITextModel | undefined;
		let release = () => { };
		try {
			textModel = await channel.loadModel();
			const model = textModel;

			const till = VSBuffer.fromString(file.content).byteLength;
			file.content = 'old\nnew\n';
			file.etag = 'e2';
			release = holdReads(file);
			const readsBefore = file.reads;
			channel.update(OutputChannelUpdateMode.Replace, till, true);
			assert.ok(await waitUntil(() => file.reads > readsBefore, 1000), 'the replace should be reading');
			channel.dispose();
			release();
			await settle();
			assert.strictEqual(file.reads, readsBefore + 1);
			assert.strictEqual(model.getValue(), 'old\n');
		} finally {
			release();
			channel.dispose();
			restore();
			textModel?.dispose();
		}
	});
});
