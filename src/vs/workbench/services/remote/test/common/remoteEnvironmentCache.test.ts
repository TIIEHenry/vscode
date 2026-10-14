/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IRemoteAgentEnvironment } from '../../../../../platform/remote/common/remoteAgentEnvironment.js';
import { IWorkbenchEnvironmentService } from '../../../environment/common/environmentService.js';
import { AbstractRemoteAgentService } from '../../common/abstractRemoteAgentService.js';

class TestRemoteAgentService extends AbstractRemoteAgentService {

	fetchCount = 0;

	constructor(private readonly _fetchRaw: () => Promise<IRemoteAgentEnvironment | null>) {
		super(
			undefined!,
			undefined!,
			{ remoteAuthority: undefined } as IWorkbenchEnvironmentService,
			undefined!,
			undefined!,
			undefined!,
			undefined!,
		);
	}

	protected override fetchRawEnvironment(): Promise<IRemoteAgentEnvironment | null> {
		this.fetchCount++;
		return this._fetchRaw();
	}
}

suite('AbstractRemoteAgentService environment cache', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('fetches again after the first getRawEnvironment rejects', async () => {
		const env = { pid: 3 } as IRemoteAgentEnvironment;
		let attempt = 0;
		const service = disposables.add(new TestRemoteAgentService(() => {
			attempt++;
			if (attempt === 1) {
				return Promise.reject(new Error('unavailable'));
			}
			return Promise.resolve(env);
		}));
		assert.strictEqual(service.getConnection(), null);

		await assert.rejects(() => service.getRawEnvironment(), /unavailable/);
		assert.strictEqual(service.fetchCount, 1, 'a rejected read must not fetch again inside the same call');

		assert.strictEqual(await service.getRawEnvironment(), env);
		assert.strictEqual(service.fetchCount, 2, 'the next getRawEnvironment must fetch again');

		assert.strictEqual(await service.getRawEnvironment(), env);
		assert.strictEqual(service.fetchCount, 2, 'a successful result stays cached');
	});

	test('does not fetch again after a successful result, including null', async () => {
		const env = { pid: 7 } as IRemoteAgentEnvironment;
		const valued = disposables.add(new TestRemoteAgentService(() => Promise.resolve(env)));
		assert.strictEqual(await valued.getRawEnvironment(), env);
		assert.strictEqual(await valued.getRawEnvironment(), env);
		assert.strictEqual(valued.fetchCount, 1);

		const empty = disposables.add(new TestRemoteAgentService(() => Promise.resolve(null)));
		assert.strictEqual(await empty.getRawEnvironment(), null);
		assert.strictEqual(await empty.getRawEnvironment(), null);
		assert.strictEqual(empty.fetchCount, 1);
	});

	test('concurrent getRawEnvironment calls share one fetch', async () => {
		const env = { pid: 9 } as IRemoteAgentEnvironment;
		let resolveFetch!: (value: IRemoteAgentEnvironment | null) => void;
		const service = disposables.add(new TestRemoteAgentService(() => new Promise(resolve => {
			resolveFetch = resolve;
		})));

		const first = service.getRawEnvironment();
		const second = service.getRawEnvironment();
		assert.strictEqual(service.fetchCount, 1);
		assert.strictEqual(first, second);

		resolveFetch(env);
		assert.strictEqual(await first, env);
		assert.strictEqual(await second, env);
		assert.strictEqual(await service.getRawEnvironment(), env);
		assert.strictEqual(service.fetchCount, 1);
	});

	test('getEnvironment becomes null when fetch rejects and fetches again next time', async () => {
		const service = disposables.add(new TestRemoteAgentService(() => Promise.reject(new Error('unavailable'))));

		assert.strictEqual(await service.getEnvironment(), null);
		assert.strictEqual(service.fetchCount, 1);

		assert.strictEqual(await service.getEnvironment(), null);
		assert.strictEqual(service.fetchCount, 2);
	});
});
