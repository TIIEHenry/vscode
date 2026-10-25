/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../base/common/event.js';
import type { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { PolicyChannelClient } from '../../common/policyIpc.js';

class TestChannel implements IChannel {

	readonly onDidChange = new Emitter<Record<string, unknown>>();
	result: Record<string, unknown> = {};

	call<T>(_command: string, _arg?: unknown): Promise<T> {
		return Promise.resolve(this.result as T);
	}

	listen<T>(_event: string, _arg?: unknown): ReturnType<typeof this.onDidChange.event> {
		return this.onDidChange.event as ReturnType<typeof this.onDidChange.event>;
	}
}

suite('PolicyChannelClient', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('replaces the startup snapshot with the returned full set and reports removals', async () => {
		const channel = new TestChannel();
		disposables.add(channel.onDidChange);
		const client = disposables.add(new PolicyChannelClient({
			PolicyA: { definition: { type: 'string' }, value: 'startup' },
			PolicyB: { definition: { type: 'boolean' }, value: true },
		}, channel));
		const changes: string[][] = [];
		disposables.add(client.onDidChange(names => changes.push([...names])));

		channel.result = { PolicyB: true };
		await client.updatePolicyDefinitions({
			PolicyA: { type: 'string' },
			PolicyB: { type: 'boolean' },
		});

		assert.strictEqual(client.getPolicyValue('PolicyA'), undefined);
		assert.strictEqual(client.getPolicyValue('PolicyB'), true);
		assert.deepStrictEqual(changes, [['PolicyA']]);
	});

	test('a null event still deletes the value and reports the name', () => {
		const channel = new TestChannel();
		disposables.add(channel.onDidChange);
		const client = disposables.add(new PolicyChannelClient({
			PolicyA: { definition: { type: 'string' }, value: 'startup' },
		}, channel));
		const changes: string[][] = [];
		disposables.add(client.onDidChange(names => changes.push([...names])));

		channel.onDidChange.fire({ PolicyA: null });

		assert.strictEqual(client.getPolicyValue('PolicyA'), undefined);
		assert.deepStrictEqual(changes, [['PolicyA']]);
	});
});
