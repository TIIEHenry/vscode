/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { extUri } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IConfigurationCache } from '../../common/configuration.js';
import { IRemoteAgentService } from '../../../remote/common/remoteAgentService.js';
import { RemoteUserConfiguration } from '../../browser/configuration.js';

suite('RemoteUserConfiguration', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const settingsPath = URI.from({ scheme: 'vscode-remote', authority: 'test-remote', path: '/settings.json' });

	test('reads getEnvironment again on the second initialize after rejection', async () => {
		const error = new Error('remote environment unavailable');
		let calls = 0;
		await withExpectedRemoteFailure(async () => {
			const configuration = disposables.add(createRemoteUserConfiguration({
				getEnvironment: () => {
					calls++;
					return Promise.reject(error);
				}
			}));
			await flushPromises();
			assert.strictEqual(calls, 1);

			await assert.rejects(() => configuration.initialize(), (reason: unknown) => reason === error);
			assert.strictEqual(calls, 1);

			await assert.rejects(() => configuration.initialize(), (reason: unknown) => reason === error);
			assert.strictEqual(calls, 2);
		});
	});

	test('does not call getEnvironment again after remote user configuration initializes', async () => {
		let calls = 0;
		const configuration = disposables.add(createRemoteUserConfiguration({
			getEnvironment: () => {
				calls++;
				return Promise.resolve({ settingsPath } as IRemoteAgentEnvironment);
			}
		}));

		await Event.toPromise(configuration.onDidInitialize);
		assert.strictEqual(calls, 1);
		await configuration.initialize();
		await configuration.initialize();
		assert.strictEqual(calls, 1);
	});

	test('in-flight initialize calls share one getEnvironment read', async () => {
		let calls = 0;
		let releaseEnvironment: ((value: IRemoteAgentEnvironment | null) => void) | undefined;
		const configuration = disposables.add(createRemoteUserConfiguration({
			getEnvironment: () => {
				calls++;
				return new Promise(resolve => { releaseEnvironment = resolve; });
			}
		}));

		const first = configuration.initialize();
		const second = configuration.initialize();
		assert.strictEqual(calls, 1);
		releaseEnvironment!(null);
		await first;
		await second;
		await flushPromises();
		await configuration.initialize();
		assert.strictEqual(calls, 1);
	});

	test('a rejected attempt is shared, then the next initialize reads again', async () => {
		const error = new Error('remote environment unavailable');
		let calls = 0;
		let rejectRetry: ((reason: Error) => void) | undefined;
		await withExpectedRemoteFailure(async () => {
			const configuration = disposables.add(createRemoteUserConfiguration({
				getEnvironment: () => {
					calls++;
					if (calls === 1) {
						return Promise.reject(error);
					}
					return new Promise((_resolve, reject) => { rejectRetry = reject; });
				}
			}));
			await flushPromises();
			await assert.rejects(() => configuration.initialize(), (reason: unknown) => reason === error);
			assert.strictEqual(calls, 1);

			const firstRetry = configuration.initialize();
			const sharedRetry = configuration.initialize();
			assert.strictEqual(calls, 2);
			rejectRetry!(error);
			await assert.rejects(firstRetry, (reason: unknown) => reason === error);
			await sharedRetry;
			assert.strictEqual(calls, 2);
		});
	});

	test('reads getEnvironment again on the second initialize after user configuration initialize rejects', async () => {
		const error = new Error('remote settings unavailable');
		let calls = 0;
		await withExpectedRemoteFailure(async () => {
			const configuration = disposables.add(createRemoteUserConfiguration({
				getEnvironment: () => {
					calls++;
					return Promise.resolve({ settingsPath } as IRemoteAgentEnvironment);
				}
			}, {
				exists: async () => { throw error; }
			}));
			await flushPromises();
			assert.strictEqual(calls, 1);

			await assert.rejects(() => configuration.initialize(), (reason: unknown) => reason === error);
			assert.strictEqual(calls, 1);

			await assert.rejects(() => configuration.initialize(), (reason: unknown) => reason === error);
			assert.strictEqual(calls, 2);
		});
	});

	test('does not read getEnvironment again when the environment is missing', async () => {
		let calls = 0;
		const configuration = disposables.add(createRemoteUserConfiguration({
			getEnvironment: () => {
				calls++;
				return Promise.resolve(null);
			}
		}));
		await flushPromises();
		await configuration.initialize();
		await configuration.initialize();
		assert.strictEqual(calls, 1);
	});
});

function createRemoteUserConfiguration(remoteAgentService: Partial<IRemoteAgentService>, fileService?: Partial<IFileService>): RemoteUserConfiguration {
	const cache: IConfigurationCache = {
		needsCaching: () => false,
		read: async () => '',
		write: async () => { },
		remove: async () => { },
	};
	return new RemoteUserConfiguration(
		'test-remote',
		cache,
		createFileService(fileService),
		{ extUri } as IUriIdentityService,
		remoteAgentService as IRemoteAgentService,
		new NullLogService(),
	);
}

function createFileService(overrides?: Partial<IFileService>): IFileService {
	return {
		onDidFilesChange: Event.None,
		onDidRunOperation: Event.None,
		watch: () => Disposable.None,
		exists: async () => true,
		readFile: async () => ({ value: VSBuffer.fromString('{}') }),
		...overrides,
	} as unknown as IFileService;
}

async function flushPromises(): Promise<void> {
	await new Promise(resolve => setTimeout(resolve, 0));
}

async function withExpectedRemoteFailure<T>(run: () => Promise<T>): Promise<T> {
	const original = errorHandler.getUnexpectedErrorHandler();
	setUnexpectedErrorHandler(() => { /* asserted by the caller */ });
	try {
		return await run();
	} finally {
		setUnexpectedErrorHandler(original);
	}
}
