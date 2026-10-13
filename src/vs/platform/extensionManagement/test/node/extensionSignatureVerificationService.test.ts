/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NullLogService } from '../../../log/common/log.js';
import { NullTelemetryService } from '../../../telemetry/common/telemetryUtils.js';
import { ExtensionSignatureVerificationCode } from '../../common/extensionManagement.js';
import { ExtensionSignatureVerificationResult, ExtensionSignatureVerificationService } from '../../node/extensionSignatureVerificationService.js';

type VsceSignModule = {
	verify(vsixFilePath: string, signatureArchiveFilePath: string, verbose: boolean): Promise<ExtensionSignatureVerificationResult>;
};

class TestExtensionSignatureVerificationService extends ExtensionSignatureVerificationService {

	calls = 0;
	result: Promise<VsceSignModule> | undefined;

	constructor() {
		super(new NullLogService(), NullTelemetryService);
	}

	protected override resolveVsceSign(): Promise<VsceSignModule> {
		this.calls++;
		const result = this.result;
		if (!result) {
			return Promise.reject(new Error('missing vsce-sign module'));
		}
		return result;
	}
}

suite('ExtensionSignatureVerificationService', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createService(): TestExtensionSignatureVerificationService {
		return new TestExtensionSignatureVerificationService();
	}

	function verify(service: TestExtensionSignatureVerificationService) {
		return service.verify('publisher.extension', '1.2.3', '/extensions/extension.vsix', '/extensions/extension.sigzip');
	}

	function successModule(onVerify?: () => void): VsceSignModule {
		return {
			verify: async () => {
				onVerify?.();
				return {
					code: ExtensionSignatureVerificationCode.Success,
					didExecute: true,
				};
			}
		};
	}

	test('imports again after the module load rejects', async () => {
		const service = createService();
		const error = new Error('vsce-sign failed');
		service.result = Promise.reject(error);

		const first = await verify(service);
		assert.strictEqual(first, undefined);
		assert.strictEqual(service.calls, 1);

		let verifyCalls = 0;
		service.result = Promise.resolve(successModule(() => { verifyCalls++; }));
		const second = await verify(service);
		assert.deepStrictEqual(second, { code: ExtensionSignatureVerificationCode.Success });
		assert.strictEqual(service.calls, 2);
		assert.strictEqual(verifyCalls, 1);

		const third = await verify(service);
		assert.deepStrictEqual(third, { code: ExtensionSignatureVerificationCode.Success });
		assert.strictEqual(service.calls, 2);
		assert.strictEqual(verifyCalls, 2);
	});

	test('shares one import while it is in flight', async () => {
		const service = createService();
		let resolveResult!: (value: VsceSignModule) => void;
		service.result = new Promise(resolve => { resolveResult = resolve; });

		const first = verify(service);
		const second = verify(service);
		assert.strictEqual(service.calls, 1);

		let verifyCalls = 0;
		resolveResult(successModule(() => { verifyCalls++; }));
		assert.deepStrictEqual(await first, { code: ExtensionSignatureVerificationCode.Success });
		assert.deepStrictEqual(await second, { code: ExtensionSignatureVerificationCode.Success });
		assert.strictEqual(verifyCalls, 2);
		assert.strictEqual(service.calls, 1);

		const third = await verify(service);
		assert.deepStrictEqual(third, { code: ExtensionSignatureVerificationCode.Success });
		assert.strictEqual(service.calls, 1);
		assert.strictEqual(verifyCalls, 3);
	});

	test('does not import again after success', async () => {
		const service = createService();
		let verifyCalls = 0;
		service.result = Promise.resolve(successModule(() => {
			verifyCalls++;
			if (verifyCalls === 2) {
				throw new Error('signature verification failed');
			}
		}));

		const first = await verify(service);
		assert.deepStrictEqual(first, { code: ExtensionSignatureVerificationCode.Success });
		const failed = await verify(service);
		assert.deepStrictEqual(failed, { code: ExtensionSignatureVerificationCode.UnknownError });
		const third = await verify(service);
		assert.deepStrictEqual(third, { code: ExtensionSignatureVerificationCode.Success });
		assert.strictEqual(service.calls, 1);
		assert.strictEqual(verifyCalls, 3);
	});
});
