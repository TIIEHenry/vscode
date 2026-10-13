/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TargetPlatform } from '../../../extensions/common/extensions.js';
import { IAllowedExtensionsService } from '../../common/extensionManagement.js';
import { ExtensionManagementChannelClient } from '../../common/extensionManagementIpc.js';
import { IProductService } from '../../../product/common/productService.js';

class FakeTargetPlatformChannel implements IChannel {

	calls = 0;
	result: Promise<TargetPlatform> | undefined;

	call<T>(command: string): Promise<T> {
		assert.strictEqual(command, 'getTargetPlatform');
		this.calls++;
		const result = this.result;
		if (!result) {
			return Promise.reject(new Error('missing target platform result'));
		}
		return result as Promise<T>;
	}

	listen<T>(): Event<T> {
		return Event.None;
	}
}

suite('ExtensionManagementChannelClient target platform', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const productService = new class extends mock<IProductService>() { };
	const allowedExtensionsService = new class extends mock<IAllowedExtensionsService>() { };

	function createClient(channel: FakeTargetPlatformChannel): ExtensionManagementChannelClient {
		return disposables.add(new ExtensionManagementChannelClient(channel, productService, allowedExtensionsService));
	}

	test('computes again after the cached promise rejects', async () => {
		const channel = new FakeTargetPlatformChannel();
		const client = createClient(channel);
		const error = new Error('target platform failed');
		channel.result = Promise.reject(error);

		const first = client.getTargetPlatform();
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(channel.calls, 1);

		channel.result = Promise.resolve(TargetPlatform.LINUX_X64);
		const second = client.getTargetPlatform();
		assert.notStrictEqual(second, first);
		assert.strictEqual(await second, TargetPlatform.LINUX_X64);
		assert.strictEqual(channel.calls, 2);
		assert.strictEqual(client.getTargetPlatform(), second);
		assert.strictEqual(channel.calls, 2);
	});

	test('shares one computation while it is in flight', async () => {
		const channel = new FakeTargetPlatformChannel();
		const client = createClient(channel);
		let resolveResult!: (value: TargetPlatform) => void;
		channel.result = new Promise<TargetPlatform>(resolve => { resolveResult = resolve; });

		const first = client.getTargetPlatform();
		const second = client.getTargetPlatform();
		assert.strictEqual(channel.calls, 1);
		assert.strictEqual(second, first);

		resolveResult(TargetPlatform.LINUX_X64);
		assert.strictEqual(await first, TargetPlatform.LINUX_X64);
		assert.strictEqual(await second, TargetPlatform.LINUX_X64);
		assert.strictEqual(client.getTargetPlatform(), first);
		assert.strictEqual(channel.calls, 1);
	});

	test('does not compute again after success', async () => {
		const channel = new FakeTargetPlatformChannel();
		const client = createClient(channel);
		channel.result = Promise.resolve(TargetPlatform.LINUX_X64);

		const first = client.getTargetPlatform();
		assert.strictEqual(await first, TargetPlatform.LINUX_X64);
		const second = client.getTargetPlatform();
		assert.strictEqual(second, first);
		assert.strictEqual(await second, TargetPlatform.LINUX_X64);
		assert.strictEqual(channel.calls, 1);
	});
});
