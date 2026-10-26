/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../base/common/async.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import type { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { PolicyChannelClient } from '../../common/policyIpc.js';

class TestChannel implements IChannel {

	readonly onDidChange = new Emitter<Record<string, unknown>>();
	result: Record<string, unknown> = {};
	calls = 0;
	response: (() => Promise<Record<string, unknown>>) | undefined;

	call<T>(_command: string, _arg?: unknown): Promise<T> {
		this.calls++;
		return (this.response?.() ?? Promise.resolve(this.result)).then(result => result as T);
	}

	listen<T>(_event: string, _arg?: unknown): Event<T> {
		return this.onDidChange.event as Event<T>;
	}
}

suite('PolicyChannelClient', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('same definition waits for the shared IPC response', async () => {
		const channel = new TestChannel();
		disposables.add(channel.onDidChange);
		const response = new DeferredPromise<Record<string, unknown>>();
		channel.response = () => response.p;
		const client = disposables.add(new PolicyChannelClient({}, channel));
		const definitions = { PolicyA: { type: 'string' as const } };
		const first = client.updatePolicyDefinitions(definitions);
		await Promise.resolve();
		let secondSettled = false;
		const second = client.updatePolicyDefinitions(definitions).then(result => {
			secondSettled = true;
			return result;
		});
		await Promise.resolve();
		assert.strictEqual(secondSettled, false);
		assert.strictEqual(channel.calls, 1);
		await response.complete({ PolicyA: 'applied' });
		assert.deepStrictEqual(await first, { PolicyA: 'applied' });
		assert.deepStrictEqual(await second, { PolicyA: 'applied' });
	});

	test('IPC rejection is preserved and the same definition is sent again on retry', async () => {
		const channel = new TestChannel();
		disposables.add(channel.onDidChange);
		const response = new DeferredPromise<Record<string, unknown>>();
		channel.response = () => response.p;
		const client = disposables.add(new PolicyChannelClient({}, channel));
		const definitions = { PolicyA: { type: 'string' as const } };
		const first = client.updatePolicyDefinitions(definitions);
		const error = new Error('IPC unavailable');
		const rejected = assert.rejects(first, reason => reason === error);
		await response.error(error);
		await rejected;
		assert.strictEqual(client.getPolicyValue('PolicyA'), undefined);

		channel.response = undefined;
		channel.result = { PolicyA: 'retried' };
		assert.deepStrictEqual(await client.updatePolicyDefinitions(definitions), { PolicyA: 'retried' });
		assert.strictEqual(channel.calls, 2);
	});

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
