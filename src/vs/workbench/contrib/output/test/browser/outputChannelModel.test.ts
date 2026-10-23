/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as sinon from 'sinon';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { parseLogEntryAt, FileOutputChannelModel } from '../../common/outputChannelModel.js';
import { TextModel } from '../../../../../editor/common/model/textModel.js';
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
