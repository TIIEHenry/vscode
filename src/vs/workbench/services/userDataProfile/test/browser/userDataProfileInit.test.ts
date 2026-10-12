/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService, IFileStatWithMetadata } from '../../../../../platform/files/common/files.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IBrowserWorkbenchEnvironmentService } from '../../../environment/browser/environmentService.js';
import { UserDataProfileInitializer } from '../../browser/userDataProfileInit.js';
import { IUserDataProfile, IUserDataProfileService } from '../../common/userDataProfile.js';

function stub<T>(partial: Partial<T>): T {
	return partial as T;
}

function writtenStat(resource: URI): IFileStatWithMetadata {
	return {
		resource,
		name: 'settings.json',
		isFile: true,
		isDirectory: false,
		isSymbolicLink: false,
		mtime: 0,
		ctime: 0,
		etag: '',
		size: 0,
		readonly: false,
		locked: false,
		executable: false,
		children: undefined,
	};
}

suite('UserDataProfileInitializer', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('retries settings until initialize succeeds, then skips', async () => {
		const settingsResource = URI.file('/profile/settings.json');
		const settingsContent = '{"settings":"{}"}';
		const info: string[] = [];
		const errors: Array<string | Error> = [];
		let failuresLeft = 2;
		const writeError = new Error('settings write failed');
		let phaseAttempts: string[] = [];
		let phaseWritten: string[] = [];

		const fileService = stub<IFileService>({
			async writeFile(resource, content) {
				phaseAttempts.push(resource.toString());
				if (failuresLeft > 0) {
					failuresLeft--;
					throw writeError;
				}
				phaseWritten.push(content instanceof VSBuffer ? content.toString() : '');
				return writtenStat(resource);
			},
		});
		const logService = stub<ILogService>({
			trace() { },
			info(message: string) {
				info.push(message);
			},
			error(message: string | Error) {
				errors.push(message);
			},
		});
		const environmentService = stub<IBrowserWorkbenchEnvironmentService>({
			options: {
				profile: {
					name: 'test',
					contents: JSON.stringify({ settings: settingsContent }),
				},
			},
		});
		const userDataProfileService = stub<IUserDataProfileService>({
			currentProfile: { settingsResource } as IUserDataProfile,
		});
		const storageService = stub<IStorageService>({
			isNew() {
				throw new Error('initializeRequiredResources must not call requiresInitialization');
			},
		});
		const initializer = new UserDataProfileInitializer(
			environmentService,
			fileService,
			userDataProfileService,
			storageService,
			logService,
			stub<IUriIdentityService>({}),
			stub<IRequestService>({}),
		);

		const report: Array<{ info: string[]; errors: string[]; attempts: string[]; written: string[] }> = [];
		async function call(): Promise<void> {
			const infoStart = info.length;
			const errorStart = errors.length;
			phaseAttempts = [];
			phaseWritten = [];
			await initializer.initializeRequiredResources();
			report.push({
				info: info.slice(infoStart),
				errors: errors.slice(errorStart).map(error => error instanceof Error ? error.message : error),
				attempts: phaseAttempts.slice(),
				written: phaseWritten.slice(),
			});
		}

		await call();
		await call();
		await call();
		await call();

		const settingsUri = settingsResource.toString();
		assert.deepStrictEqual(report, [
			{
				info: ['UserDataProfileInitializer: Error while initializing settings'],
				errors: ['settings write failed'],
				attempts: [settingsUri],
				written: [],
			},
			{
				info: ['UserDataProfileInitializer: Error while initializing settings'],
				errors: ['settings write failed'],
				attempts: [settingsUri],
				written: [],
			},
			{
				info: ['UserDataProfileInitializer: Initialized settings'],
				errors: [],
				attempts: [settingsUri],
				written: ['{}'],
			},
			{
				info: ['UserDataProfileInitializer: settings initialized already.'],
				errors: [],
				attempts: [],
				written: [],
			},
		]);
	});
});
