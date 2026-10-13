/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TargetPlatform } from '../../../../../platform/extensions/common/extensions.js';
import { ExtensionManagementService } from '../../common/extensionManagementService.js';

class TargetPlatformExtensionManagementService extends ExtensionManagementService {

	calls = 0;
	result: Promise<TargetPlatform> | undefined;

	protected override computeTargetPlatform(): Promise<TargetPlatform> {
		this.calls++;
		const result = this.result;
		if (!result) {
			return Promise.reject(new Error('missing target platform result'));
		}
		return result;
	}
}

suite('Workbench ExtensionManagementService target platform', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): TargetPlatformExtensionManagementService {
		// Skip the constructor. It wires extension servers that this cache does not use.
		const service: TargetPlatformExtensionManagementService = Object.assign(Object.create(TargetPlatformExtensionManagementService.prototype), {
			calls: 0,
			result: undefined,
		});
		return service;
	}

	test('computes again after the cached promise rejects', async () => {
		const service = createService();
		const error = new Error('target platform failed');
		service.result = Promise.reject(error);

		const first = service.getTargetPlatform();
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(service.calls, 1);

		service.result = Promise.resolve(TargetPlatform.LINUX_X64);
		const second = service.getTargetPlatform();
		assert.notStrictEqual(second, first);
		assert.strictEqual(await second, TargetPlatform.LINUX_X64);
		assert.strictEqual(service.calls, 2);
		assert.strictEqual(service.getTargetPlatform(), second);
		assert.strictEqual(service.calls, 2);
	});

	test('shares one computation while it is in flight', async () => {
		const service = createService();
		let resolveResult!: (value: TargetPlatform) => void;
		service.result = new Promise<TargetPlatform>(resolve => { resolveResult = resolve; });

		const first = service.getTargetPlatform();
		const second = service.getTargetPlatform();
		assert.strictEqual(service.calls, 1);
		assert.strictEqual(second, first);

		resolveResult(TargetPlatform.LINUX_X64);
		assert.strictEqual(await first, TargetPlatform.LINUX_X64);
		assert.strictEqual(await second, TargetPlatform.LINUX_X64);
		assert.strictEqual(service.getTargetPlatform(), first);
		assert.strictEqual(service.calls, 1);
	});

	test('does not compute again after success', async () => {
		const service = createService();
		service.result = Promise.resolve(TargetPlatform.LINUX_X64);

		const first = service.getTargetPlatform();
		assert.strictEqual(await first, TargetPlatform.LINUX_X64);
		const second = service.getTargetPlatform();
		assert.strictEqual(second, first);
		assert.strictEqual(await second, TargetPlatform.LINUX_X64);
		assert.strictEqual(service.calls, 1);
	});
});
