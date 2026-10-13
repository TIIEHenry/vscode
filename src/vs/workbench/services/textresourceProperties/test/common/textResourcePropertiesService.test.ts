/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { OperatingSystem, OS } from '../../../../../base/common/platform.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IWorkbenchEnvironmentService } from '../../../environment/common/environmentService.js';
import { IRemoteAgentService } from '../../../remote/common/remoteAgentService.js';
import { TextResourcePropertiesService } from '../../common/textResourcePropertiesService.js';

const remoteResource = URI.from({ scheme: 'vscode-remote', path: '/workspace/file.txt' });

function flush(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

function remoteEnvironment(os: OperatingSystem): IRemoteAgentEnvironment {
	return { os } as IRemoteAgentEnvironment;
}

function createService(getEnvironment: () => Promise<IRemoteAgentEnvironment | null>): TextResourcePropertiesService {
	return new TextResourcePropertiesService(
		{ getValue: () => 'auto' } as unknown as IConfigurationService,
		{ getEnvironment } as unknown as IRemoteAgentService,
		{ remoteAuthority: 'test-remote' } as unknown as IWorkbenchEnvironmentService,
		{
			getNumber: (_key: string, _scope: number, fallback: number) => fallback,
			store: () => undefined,
		} as unknown as IStorageService,
	);
}

suite('TextResourcePropertiesService remote environment', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	let originalErrorHandler: (error: unknown) => void;

	setup(() => {
		originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
	});

	teardown(() => {
		setUnexpectedErrorHandler(originalErrorHandler);
	});

	test('getEOL reads getEnvironment again after a rejection and shares the in-flight read', async () => {
		let resolveRetry!: (environment: IRemoteAgentEnvironment | null) => void;
		let rejectFirst!: (error: Error) => void;
		const first = new Promise<IRemoteAgentEnvironment | null>((_resolve, reject) => { rejectFirst = reject; });
		const retry = new Promise<IRemoteAgentEnvironment | null>(resolve => { resolveRetry = resolve; });
		let calls = 0;
		const service = createService(() => {
			calls++;
			return calls === 1 ? first : retry;
		});

		assert.strictEqual(calls, 1);
		service.getEOL(remoteResource);
		assert.strictEqual(calls, 1);

		rejectFirst(new Error('remote environment failed'));
		await flush();

		service.getEOL(remoteResource);
		assert.strictEqual(calls, 2);
		service.getEOL(remoteResource);
		assert.strictEqual(calls, 2);

		resolveRetry(remoteEnvironment(OperatingSystem.Windows));
		await flush();

		assert.strictEqual(service.getEOL(remoteResource), '\r\n');
		assert.strictEqual(calls, 2);
	});

	test('getEOL does not read getEnvironment again after it resolves', async () => {
		let calls = 0;
		const service = createService(() => {
			calls++;
			return Promise.resolve(remoteEnvironment(OperatingSystem.Windows));
		});

		await flush();

		assert.strictEqual(service.getEOL(remoteResource), '\r\n');
		assert.strictEqual(service.getEOL(remoteResource), '\r\n');
		assert.strictEqual(calls, 1);
	});

	test('getEOL does not read getEnvironment again after it resolves to null', async () => {
		let calls = 0;
		const service = createService(() => {
			calls++;
			return Promise.resolve(null);
		});

		await flush();

		const localEOL = OS === OperatingSystem.Windows ? '\r\n' : '\n';
		assert.strictEqual(service.getEOL(remoteResource), localEOL);
		assert.strictEqual(service.getEOL(remoteResource), localEOL);
		assert.strictEqual(calls, 1);
	});
});
