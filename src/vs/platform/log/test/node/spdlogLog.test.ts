/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { tmpdir } from 'os';
import { join } from '../../../../base/common/path.js';
import { Promises } from '../../../../base/node/pfs.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getRandomTestPath } from '../../../../base/test/node/testUtils.js';
import { LogLevel } from '../../common/log.js';
import { SpdLogLogger } from '../../node/spdlogLog.js';

interface ISpdLogLoggerInternals {
	readonly buffer: readonly unknown[];
	readonly _loggerCreationPromise: Promise<void>;
}

suite('SpdLogLogger', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	let testDir: string;

	setup(async () => {
		testDir = getRandomTestPath(tmpdir(), 'vsctests', 'spdloglogger');
		await fs.promises.mkdir(testDir, { recursive: true });
	});

	teardown(() => Promises.rm(testDir));

	test('spdlog logger creation failure stops buffering further messages', async () => {
		// a log file below a regular file can never be created, whether or not spdlog loads
		const blocker = join(testDir, 'blocker');
		await fs.promises.writeFile(blocker, '');

		const logger = store.add(new SpdLogLogger('spdlog-failure', join(blocker, 'test.log'), false, false, LogLevel.Trace));
		const internals = logger as unknown as ISpdLogLoggerInternals;
		const originalConsoleError = console.error;
		console.error = () => { };
		try {
			await internals._loggerCreationPromise;
		} finally {
			console.error = originalConsoleError;
		}

		for (let i = 0; i < 100; i++) {
			logger.info(`message ${i}`);
		}

		assert.strictEqual(internals.buffer.length, 0);
	});
});
