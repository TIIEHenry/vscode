/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { isLinux, isMacintosh, isWindows, OperatingSystem } from '../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IExtensionManagementServerService } from '../../../../services/extensionManagement/common/extensionManagement.js';
import { IRemoteAgentService } from '../../../../services/remote/common/remoteAgentService.js';
import { WorkspacePlatformContribution } from '../../browser/gettingStarted.contribution.js';

function expectedLocalPlatform(): 'mac' | 'linux' | 'windows' {
	if (isMacintosh) {
		return 'mac';
	}
	if (isLinux) {
		return 'linux';
	}
	if (isWindows) {
		return 'windows';
	}
	throw new Error('workspace platform fallback has no local OS');
}

function extensionServers(kind: 'local' | 'web'): IExtensionManagementServerService {
	return {
		localExtensionManagementServer: kind === 'local' ? { id: 'local' } : null,
		webExtensionManagementServer: kind === 'web' ? { id: 'web' } : null,
	} as IExtensionManagementServerService;
}

function remoteEnvironment(os: OperatingSystem): IRemoteAgentEnvironment {
	return { os } as IRemoteAgentEnvironment;
}

const WorkspacePlatformKey = 'workspacePlatform';

suite('WorkspacePlatformContribution', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const unexpected: unknown[] = [];
	let previousHandler = errorHandler.getUnexpectedErrorHandler();

	setup(() => {
		unexpected.length = 0;
		previousHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => { unexpected.push(error); });
	});

	teardown(() => {
		setUnexpectedErrorHandler(previousHandler);
	});

	async function readPlatform(
		getEnvironment: () => Promise<IRemoteAgentEnvironment | null>,
		kind: 'local' | 'web',
	): Promise<{ platform: string | undefined; calls: number }> {
		let calls = 0;
		const remoteAgentService = {
			getEnvironment: () => {
				calls++;
				return getEnvironment();
			},
		} as IRemoteAgentService;
		const contextService = new MockContextKeyService();
		new WorkspacePlatformContribution(extensionServers(kind), remoteAgentService, contextService);
		await timeout(0);
		return {
			platform: contextService.getContextKeyValue(WorkspacePlatformKey) as string | undefined,
			calls,
		};
	}

	test('rejected getEnvironment sets the local platform once', async () => {
		const result = await readPlatform(() => Promise.reject(new Error('getEnvironment failed')), 'local');
		assert.strictEqual(result.platform, expectedLocalPlatform());
		assert.strictEqual(result.calls, 1);
		assert.strictEqual(unexpected.length, 1);
	});

	test('rejected getEnvironment sets webworker when there is no local server', async () => {
		const result = await readPlatform(() => Promise.reject(new Error('getEnvironment failed')), 'web');
		assert.strictEqual(result.platform, 'webworker');
		assert.strictEqual(result.calls, 1);
		assert.strictEqual(unexpected.length, 1);
	});

	test('resolved Windows, Mac, and Linux use the remote platform', async () => {
		const cases = [
			[OperatingSystem.Windows, 'windows'],
			[OperatingSystem.Macintosh, 'mac'],
			[OperatingSystem.Linux, 'linux'],
		] as const;
		for (const [os, platform] of cases) {
			unexpected.length = 0;
			const result = await readPlatform(() => Promise.resolve(remoteEnvironment(os)), 'local');
			assert.strictEqual(result.platform, platform, `remote ${platform} must not be overwritten by the local server`);
			assert.strictEqual(result.calls, 1);
			assert.deepStrictEqual(unexpected, []);
		}
	});

	test('resolved environment without an OS uses the local or web fallback', async () => {
		const local = await readPlatform(() => Promise.resolve(null), 'local');
		assert.strictEqual(local.platform, expectedLocalPlatform());
		assert.strictEqual(local.calls, 1);
		assert.deepStrictEqual(unexpected, []);

		const web = await readPlatform(() => Promise.resolve({ os: undefined } as unknown as IRemoteAgentEnvironment), 'web');
		assert.strictEqual(web.platform, 'webworker');
		assert.strictEqual(web.calls, 1);
		assert.deepStrictEqual(unexpected, []);
	});
});
