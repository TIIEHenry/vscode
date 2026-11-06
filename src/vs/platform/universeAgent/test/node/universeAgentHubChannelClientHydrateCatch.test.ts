/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import type { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { UniverseAgentHubChannelClient } from '../../common/universeAgentHubChannelClient.js';

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

suite('UniverseAgentHubChannelClient fire-and-forget leftover catch', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('constructor hydrate void is single-caught; bare void this.hydrate() gone in this file only', async () => {
		const proto = UniverseAgentHubChannelClient.prototype as unknown as { hydrate: () => Promise<void> };
		const origHydrate = proto.hydrate;
		const seen = await captureUnexpectedErrors(async () => {
			proto.hydrate = () => Promise.reject(new Error('hydrate-boom'));
			try {
				const channel: IChannel = {
					call: <T>(): Promise<T> => Promise.resolve([] as unknown as T),
					listen: () => Event.None,
				};
				store.add(new UniverseAgentHubChannelClient(channel));
			} finally {
				proto.hydrate = origHydrate;
			}
		});
		assert.strictEqual(seen.length, 1);
		assert.ok(seen[0] instanceof Error && seen[0].message === 'hydrate-boom');
	});

	test('setActiveHubBaseUrl remote void is single-caught; hydrate single-catch stays (D562)', async () => {
		const seen = await captureUnexpectedErrors(async () => {
			const channel: IChannel = {
				call: <T>(command: string): Promise<T> => {
					if (command === 'setActiveHubBaseUrl') {
						return Promise.reject(new Error('set-hub-boom'));
					}
					return Promise.resolve(undefined as T);
				},
				listen: () => Event.None,
			};
			const client = store.add(new UniverseAgentHubChannelClient(channel));
			client.setActiveHubBaseUrl('https://hub.example.com');
		});
		assert.strictEqual(seen.length, 1);
		assert.ok(seen[0] instanceof Error && seen[0].message === 'set-hub-boom');
	});
});
