/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mock } from '../../../../base/test/common/mock.js';
import { TestConfigurationService } from '../../../configuration/test/common/testConfigurationService.js';
import { INativeEnvironmentService } from '../../../environment/common/environment.js';
import { NullLogService } from '../../../log/common/log.js';
import { IProductService } from '../../../product/common/productService.js';
import { NullTelemetryService } from '../../../telemetry/common/telemetryUtils.js';
import { DevContainerAgentHostMainService } from '../../node/devContainerAgentHostService.js';

class ShellEnvironmentCacheService extends DevContainerAgentHostMainService {

	shellReads = 0;
	shellResolves = 0;

	constructor(private readonly _load: () => Promise<typeof process.env>) {
		super(
			new NullLogService(),
			new class extends mock<IProductService>() {
				override readonly quality = 'insider';
				override readonly serverDataFolderName = '.vscode-server-oss';
				override readonly commit = undefined;
			}(),
			NullTelemetryService,
			new TestConfigurationService(),
			new class extends mock<INativeEnvironmentService>() {
				override readonly args = Object.create(null);
			}(),
		);
	}

	protected override loadShellEnvironment(): Promise<typeof process.env> {
		this.shellReads++;
		return this._load();
	}

	protected override _resolveShellEnvironment(): Promise<typeof process.env> {
		this.shellResolves++;
		return super._resolveShellEnvironment();
	}

	resolveShellEnvironment(): Promise<typeof process.env> {
		return this._resolveShellEnvironment();
	}
}

suite('Dev Container Agent Host environment cache', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('reads the shell environment again after the first rejection', async () => {
		const error = new Error('shell unavailable');
		const env = { PATH: '/cached-shell' } as typeof process.env;
		let attempt = 0;
		const service = store.add(new ShellEnvironmentCacheService(() => {
			attempt++;
			if (attempt === 1) {
				return Promise.reject(error);
			}
			return Promise.resolve(env);
		}));

		const first = service.resolveShellEnvironment();
		const second = service.resolveShellEnvironment();
		assert.strictEqual(first, second);
		assert.strictEqual(service.shellReads, 1);

		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(service.shellReads, 1, 'a rejected read must not read again inside the same call');

		assert.strictEqual(await service.resolveShellEnvironment(), env);
		assert.strictEqual(service.shellReads, 2, 'the next read must resolve the shell environment again');

		assert.strictEqual(await service.resolveShellEnvironment(), env);
		assert.strictEqual(service.shellReads, 2, 'a successful result stays cached');
	});

	test('does not read the shell environment again after it resolves', async () => {
		const env = { PATH: '/cached-shell' } as typeof process.env;
		const service = store.add(new ShellEnvironmentCacheService(() => Promise.resolve(env)));

		const first = service.resolveShellEnvironment();
		const second = service.resolveShellEnvironment();
		assert.strictEqual(first, second);
		assert.strictEqual(service.shellReads, 1);

		assert.strictEqual(await first, env);
		assert.strictEqual(await service.resolveShellEnvironment(), env);
		assert.strictEqual(service.shellReads, 1);
	});

	test('probes for docker again after the first rejection', async () => {
		const error = new Error('shell unavailable');
		const env = { PATH: '/no/such/docker/bin' } as typeof process.env;
		let attempt = 0;
		const service = store.add(new ShellEnvironmentCacheService(() => {
			attempt++;
			if (attempt === 1) {
				return Promise.reject(error);
			}
			return Promise.resolve(env);
		}));

		const first = service.isDockerAvailable();
		const second = service.isDockerAvailable();
		assert.strictEqual(first, second);
		assert.strictEqual(service.shellReads, 1);
		assert.strictEqual(service.shellResolves, 1);

		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(service.shellReads, 1, 'a rejected probe must not run again inside the same call');
		assert.strictEqual(service.shellResolves, 1);

		const available = await service.isDockerAvailable();
		assert.strictEqual(typeof available, 'boolean');
		assert.strictEqual(service.shellReads, 2, 'the next probe must read the shell environment again');
		assert.strictEqual(service.shellResolves, 2);

		assert.strictEqual(await service.isDockerAvailable(), available);
		assert.strictEqual(service.shellReads, 2, 'a successful probe stays cached');
		assert.strictEqual(service.shellResolves, 2);
	});

	test('does not probe for docker again after it resolves', async () => {
		const service = store.add(new ShellEnvironmentCacheService(() => Promise.resolve({ PATH: '/no/such/docker/bin' } as typeof process.env)));

		const first = service.isDockerAvailable();
		const second = service.isDockerAvailable();
		assert.strictEqual(first, second);
		assert.strictEqual(service.shellReads, 1);
		assert.strictEqual(service.shellResolves, 1);

		const available = await first;
		assert.strictEqual(typeof available, 'boolean');
		assert.strictEqual(await second, available);
		assert.strictEqual(await service.isDockerAvailable(), available);
		assert.strictEqual(service.shellReads, 1);
		assert.strictEqual(service.shellResolves, 1);
	});
});
