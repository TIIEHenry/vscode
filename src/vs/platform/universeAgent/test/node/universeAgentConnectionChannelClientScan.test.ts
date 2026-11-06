/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import type { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { UniverseAgentConnectionChannelClient } from '../../common/universeAgentConnectionChannelClient.js';

async function captureUnexpectedErrors(run: () => Promise<void>): Promise<unknown[]> {
	const seen: unknown[] = [];
	const orig = errorHandler.getUnexpectedErrorHandler();
	setUnexpectedErrorHandler(err => seen.push(err));
	try {
		await run();
		await new Promise(resolve => setTimeout(resolve, 10));
	} finally {
		setUnexpectedErrorHandler(orig);
	}
	return seen;
}

suite('UniverseAgentConnectionChannelClient fire-and-forget scan', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('hydrate void is single-caught and snapshot does not IPC for phase', async () => {
		const calls: string[] = [];
		const channel: IChannel = {
			call: (command: string) => {
				calls.push(command);
				return Promise.reject(new Error('hydrate-ignored'));
			},
			listen: () => Event.None,
		};
		const client = store.add(new UniverseAgentConnectionChannelClient(channel));
		await new Promise(resolve => setTimeout(resolve, 10));
		assert.strictEqual(client.getConnectionPhase().kind, 'disconnected');
		assert.strictEqual(client.isAgentTreeFetchFailed(), false);
		assert.deepStrictEqual(calls, ['getConnectionSnapshot']);
	});

	test('requestAgentTreeRefresh remote void is single-caught (D561)', async () => {
		const seen = await captureUnexpectedErrors(async () => {
			const channel: IChannel = {
				call: (command: string) => {
					if (command === 'requestAgentTreeRefresh') {
						return Promise.reject(new Error('refresh-tree-boom'));
					}
					return Promise.resolve(undefined);
				},
				listen: () => Event.None,
			};
			const client = store.add(new UniverseAgentConnectionChannelClient(channel));
			client.requestAgentTreeRefresh('sess-1');
		});
		assert.strictEqual(seen.length, 1);
		assert.ok(seen[0] instanceof Error && seen[0].message === 'refresh-tree-boom');
	});
});
