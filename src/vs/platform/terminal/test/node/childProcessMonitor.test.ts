/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { runWithFakedTimers } from '../../../../base/test/common/virtualScheduling/index.js';
import { NullLogService } from '../../../log/common/log.js';
import { ChildProcessMonitor } from '../../node/childProcessMonitor.js';

suite('ChildProcessMonitor', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('input and output do not throw and nothing is reported after dispose', () => runWithFakedTimers({}, async () => {
		const monitor = store.add(new ChildProcessMonitor(process.pid, new NullLogService()));
		let changes = 0;
		store.add(monitor.onDidChangeHasChildProcesses(() => changes++));

		monitor.handleInput();
		monitor.handleOutput();
		monitor.handleOutput();
		monitor.dispose();

		// Past both the 1000 ms input debounce and the 5000 ms output throttle
		await timeout(6000);
		assert.strictEqual(changes, 0);
	}));
});
