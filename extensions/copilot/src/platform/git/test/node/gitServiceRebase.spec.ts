/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { afterEach, beforeEach, suite, test } from 'vitest';
import { Event } from '../../../../util/vs/base/common/event';
import { DisposableStore } from '../../../../util/vs/base/common/lifecycle';
import { URI } from '../../../../util/vs/base/common/uri';
import { IInstantiationService } from '../../../../util/vs/platform/instantiation/common/instantiation';
import { IGitExtensionService } from '../../common/gitExtensionService';
import { ILogService } from '../../../log/common/logService';
import { createPlatformServices, ITestingServicesAccessor } from '../../../test/node/services';
import { GitServiceImpl } from '../../vscode-node/gitServiceImpl';
import { API, Repository } from '../../vscode/git';

class StubGitExtensionService implements IGitExtensionService {
	declare readonly _serviceBrand: undefined;

	constructor(private readonly api: API | undefined) { }

	onDidChange = Event.None;
	extensionAvailable = !!this.api;

	getExtensionApi(): API | undefined {
		return this.api;
	}
}

function createMinimalGitApi(getRepository: (uri: URI) => Repository | null | undefined): API {
	return {
		state: 'initialized',
		onDidChangeState: Event.None,
		onDidPublish: Event.None,
		git: {} as API['git'],
		repositories: [],
		recentRepositories: [],
		onDidOpenRepository: Event.None,
		onDidCloseRepository: Event.None,
		getRepository: (uri: URI) => getRepository(uri) ?? null,
	} as API;
}

suite('GitServiceImpl.rebase', () => {
	let disposables: DisposableStore;
	let accessor: ITestingServicesAccessor;
	const repoUri = URI.file('/workspace/repo');

	beforeEach(() => {
		disposables = new DisposableStore();
	});

	afterEach(() => {
		disposables.dispose();
	});

	test('rejects when no repository is open for the uri', async () => {
		const services = createPlatformServices();
		services.define(IGitExtensionService, new StubGitExtensionService(createMinimalGitApi(() => undefined)));
		accessor = disposables.add(services.createTestingAccessor());

		const gitService = disposables.add(accessor.get(IInstantiationService).createInstance(GitServiceImpl));
		await assert.rejects(
			() => gitService.rebase(repoUri, 'main'),
			/no open repository/i,
		);
	});

	test('propagates repository.rebase rejection after logging', async () => {
		const rebaseError = new Error('rebase conflict');
		const repository = {
			rebase: async () => {
				throw rebaseError;
			},
		} as unknown as Repository;

		const services = createPlatformServices();
		services.define(IGitExtensionService, new StubGitExtensionService(createMinimalGitApi(() => repository)));
		accessor = disposables.add(services.createTestingAccessor());

		const logService = accessor.get(ILogService);
		const errorCalls: string[] = [];
		const originalError = logService.error.bind(logService);
		logService.error = (message: string) => {
			errorCalls.push(message);
			originalError(message);
		};

		const gitService = disposables.add(accessor.get(IInstantiationService).createInstance(GitServiceImpl));
		await assert.rejects(
			() => gitService.rebase(repoUri, 'feature'),
			(err: unknown) => err === rebaseError,
		);
		assert.ok(errorCalls.some(msg => msg.includes('Failed to rebase')));
	});
});
