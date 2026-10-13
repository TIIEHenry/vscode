/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { URI } from '../../../../base/common/uri.js';
import { upcastPartial } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { FileOperationError, FileOperationResult, IFileContent, IFileService, IFileStatWithMetadata } from '../../../files/common/files.js';
import { FileLogger } from '../../common/fileLog.js';
import { LogLevel } from '../../common/log.js';

class LogFileProbe {

	createCount = 0;
	private readonly contents = new Map<string, string>();
	createGate: Promise<void> | undefined;
	createFailure: ((attempt: number) => Error | undefined) | undefined;

	readonly service: IFileService;

	constructor() {
		this.service = upcastPartial<IFileService>({
			createFile: async resource => {
				this.createCount++;
				const attempt = this.createCount;
				if (this.createGate) {
					await this.createGate;
				}
				const error = this.createFailure?.(attempt);
				if (error) {
					throw error;
				}
				const key = resource.toString();
				if (!this.contents.has(key)) {
					this.contents.set(key, '');
				}
				return upcastPartial<IFileStatWithMetadata>({});
			},
			readFile: async resource => {
				const text = this.contents.get(resource.toString());
				if (text === undefined) {
					throw new Error(`file not found: ${resource.toString()}`);
				}
				return upcastPartial<IFileContent>({ value: VSBuffer.fromString(text) });
			},
			writeFile: async (resource, content) => {
				if (!(content instanceof VSBuffer)) {
					throw new Error('FileLogger should write a VSBuffer');
				}
				this.contents.set(resource.toString(), content.toString());
				return upcastPartial<IFileStatWithMetadata>({});
			},
		});
	}

	text(resource: URI): string {
		return this.contents.get(resource.toString()) ?? '';
	}
}

suite('FileLogger', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const resource = URI.parse('file:///logs/file-logger.log');

	function createLogger(probe: LogFileProbe): FileLogger {
		return disposables.add(new FileLogger(resource, LogLevel.Info, true, probe.service));
	}

	test('second flush creates the file again and writes after the first createFile fails', async () => {
		const probe = new LogFileProbe();
		const error = new FileOperationError('parent missing', FileOperationResult.FILE_NOT_FOUND);
		probe.createFailure = attempt => attempt === 1 ? error : undefined;
		const logger = createLogger(probe);

		logger.info('kept');
		await assert.rejects(() => logger.flush(), (reason: unknown) => reason === error);
		assert.strictEqual(probe.createCount, 1);
		assert.strictEqual(probe.text(resource), '');

		await logger.flush();
		assert.strictEqual(probe.createCount, 2);
		assert.strictEqual(probe.text(resource), 'kept');
	});

	test('concurrent flushes share one in-flight createFile', async () => {
		const probe = new LogFileProbe();
		let releaseCreate!: () => void;
		probe.createGate = new Promise<void>(resolve => { releaseCreate = resolve; });
		const logger = createLogger(probe);

		logger.info('hello');
		const first = logger.flush();
		const second = logger.flush();
		await Promise.resolve();
		assert.strictEqual(probe.createCount, 1);

		releaseCreate();
		await Promise.all([first, second]);
		assert.strictEqual(probe.createCount, 1);
		assert.strictEqual(probe.text(resource), 'hello');
	});

	test('treats FILE_MODIFIED_SINCE as a successful initialize', async () => {
		const probe = new LogFileProbe();
		probe.createFailure = () => new FileOperationError('exists', FileOperationResult.FILE_MODIFIED_SINCE);
		const logger = createLogger(probe);

		logger.info('hello');
		await logger.flush();
		logger.info('again');
		await logger.flush();

		assert.strictEqual(probe.createCount, 1);
		assert.strictEqual(probe.text(resource), 'helloagain');
	});

	test('does not create the file again after initialize succeeds', async () => {
		const probe = new LogFileProbe();
		const logger = createLogger(probe);

		logger.info('one');
		await logger.flush();
		logger.info('two');
		await logger.flush();

		assert.strictEqual(probe.createCount, 1);
		assert.strictEqual(probe.text(resource), 'onetwo');
	});
});
