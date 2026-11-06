/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { createSessionViewDiagnosticsPort } from '../../node/sessionViewHostPorts.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

suite('SessionViewHost diagnostics port (S4a)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('releaseLeasesOwnedBy logs view.lease_released_by_owner', () => {
		const lines: string[] = [];
		const logService = {
			info(message: string): void {
				lines.push(message);
			},
			warn(): void { },
		};
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
			diagnostics: createSessionViewDiagnosticsPort(logService),
		}));
		viewHost.acquireLease('sess-owner-log', 'window:1');
		const released = viewHost.releaseLeasesOwnedBy('window:1');
		assert.strictEqual(released, 1);
		assert.ok(lines.some(line => line.includes('view.lease_released_by_owner')), `expected metric in logs, got ${JSON.stringify(lines)}`);
	});
});
