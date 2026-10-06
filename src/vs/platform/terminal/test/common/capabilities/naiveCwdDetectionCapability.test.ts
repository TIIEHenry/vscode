/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NaiveCwdDetectionCapability } from '../../../common/capabilities/naiveCwdDetectionCapability.js';
import { ITerminalChildProcess } from '../../../common/terminal.js';

suite('NaiveCwdDetectionCapability', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('overlapping getCwd returns committed path and fires once for the latest result', async () => {
		let firstResolve!: (cwd: string) => void;
		let secondResolve!: (cwd: string) => void;
		let call = 0;

		const process = {
			getCwd: () => {
				call++;
				if (call === 1) {
					return new Promise<string>(resolve => { firstResolve = resolve; });
				}
				return new Promise<string>(resolve => { secondResolve = resolve; });
			}
		} as unknown as ITerminalChildProcess;

		const capability = new NaiveCwdDetectionCapability(process);
		const fired: string[] = [];
		capability.onDidChangeCwd(cwd => fired.push(cwd));

		const firstPromise = capability.getCwd();
		const secondPromise = capability.getCwd();

		secondResolve('/new');
		const secondResult = await secondPromise;
		assert.strictEqual(secondResult, '/new');
		assert.deepStrictEqual(fired, ['/new']);

		firstResolve('/stale');
		const firstResult = await firstPromise;
		assert.strictEqual(firstResult, '/new');
		assert.deepStrictEqual(fired, ['/new']);
	});

	test('when the first query resolves before the second starts, only the latest path is committed', async () => {
		let firstResolve!: (cwd: string) => void;
		let secondResolve!: (cwd: string) => void;
		let call = 0;

		const process = {
			getCwd: () => {
				call++;
				if (call === 1) {
					return new Promise<string>(resolve => { firstResolve = resolve; });
				}
				return new Promise<string>(resolve => { secondResolve = resolve; });
			}
		} as unknown as ITerminalChildProcess;

		const capability = new NaiveCwdDetectionCapability(process);
		const fired: string[] = [];
		capability.onDidChangeCwd(cwd => fired.push(cwd));

		const firstPromise = capability.getCwd();
		firstResolve('/first');
		assert.strictEqual(await firstPromise, '/first');
		assert.deepStrictEqual(fired, ['/first']);

		const secondPromise = capability.getCwd();
		secondResolve('/second');
		assert.strictEqual(await secondPromise, '/second');
		assert.deepStrictEqual(fired, ['/first', '/second']);
	});
});
