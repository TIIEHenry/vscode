/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Action, IAction } from '../../../../../base/common/actions.js';
import { isCancellationError } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { UriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentityService.js';
import { IUserDataProfilesService, ProfileResourceType } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IHostService } from '../../../../services/host/browser/host.js';
import { IWorkbenchExtensionManagementService } from '../../../../services/extensionManagement/common/extensionManagement.js';
import { IUserDataProfileImportExportService, IUserDataProfileManagementService, IUserDataProfileTemplate } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { NewProfileElement } from '../../browser/userDataProfilesEditorModel.js';

suite('NewProfileElement resolveTemplate', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	const source = URI.file('/profile-template.json');
	const kept: IUserDataProfileTemplate = { name: 'Remote' };

	let reads: URI[];
	let resolvers: Array<(value: IUserDataProfileTemplate | null) => void>;
	let rejecters: Array<(reason?: unknown) => void>;
	let instantiationService: TestInstantiationService;

	setup(() => {
		reads = [];
		resolvers = [];
		rejecters = [];

		instantiationService = disposables.add(new TestInstantiationService());
		const fileService = disposables.add(new FileService(new NullLogService()));
		instantiationService.stub(IFileService, fileService);
		instantiationService.stub(IUriIdentityService, disposables.add(new UriIdentityService(fileService)));
		instantiationService.stub(IUserDataProfilesService, { profiles: [] });
		instantiationService.stub(IUserDataProfileManagementService, {});
		instantiationService.stub(ICommandService, {});
		instantiationService.stub(IWorkspaceContextService, {});
		instantiationService.stub(IHostService, {});
		instantiationService.stub(IWorkbenchExtensionManagementService, {
			onProfileAwareDidInstallExtensions: Event.None,
			onProfileAwareDidUninstallExtension: Event.None,
			onProfileAwareDidUpdateExtensionMetadata: Event.None,
		});
		instantiationService.stub(IUserDataProfileImportExportService, {
			resolveProfileTemplate: (uri: URI) => {
				reads.push(uri);
				return new Promise<IUserDataProfileTemplate | null>((resolve, reject) => {
					resolvers.push(resolve);
					rejecters.push(reject);
				});
			}
		});
	});

	function createElement(copyFrom: URI): NewProfileElement {
		return disposables.add(instantiationService.createInstance(
			NewProfileElement,
			copyFrom,
			[[], []] as [Action[], Action[]],
			[[], []] as [IAction[], IAction[]],
		));
	}

	test('in-flight callers share one read and a template stays cached', async () => {
		const element = createElement(source);
		const pending = element.resolveTemplate(source);
		const children = element.getChildren(ProfileResourceType.Settings);

		assert.strictEqual(reads.length, 1);

		resolvers[0](kept);
		assert.strictEqual(await pending, kept);
		assert.deepStrictEqual(await children, []);

		await element.resolveTemplate(source);
		assert.strictEqual(reads.length, 1);
	});

	test('null is returned to every in-flight caller and the next read tries again', async () => {
		const element = createElement(source);
		const first = element.resolveTemplate(source);
		const second = element.resolveTemplate(source);
		assert.strictEqual(reads.length, 1);

		resolvers[0](null);
		assert.strictEqual(await first, null);
		assert.strictEqual(await second, null);

		const children = element.getChildren(ProfileResourceType.Settings);
		assert.strictEqual(reads.length, 2);
		resolvers[1](null);
		assert.deepStrictEqual(await children, []);

		const third = element.resolveTemplate(source);
		assert.strictEqual(reads.length, 3);
		resolvers[2](kept);
		assert.strictEqual(await third, kept);
		await element.resolveTemplate(source);
		assert.strictEqual(reads.length, 3);
	});

	test('a rejected read is reported and the next read tries again', async () => {
		const element = createElement(source);
		resolvers[0](null);
		assert.strictEqual(await element.resolveTemplate(source), null);

		const error = new Error('invalid profile');
		const first = element.resolveTemplate(source);
		const second = element.resolveTemplate(source);
		assert.strictEqual(reads.length, 2);
		rejecters[1](error);

		await assert.rejects(first, (err: unknown) => err === error);
		await assert.rejects(second, (err: unknown) => err === error);

		const third = element.resolveTemplate(source);
		assert.strictEqual(reads.length, 3);
		resolvers[2](kept);
		assert.strictEqual(await third, kept);
	});

	test('replacing copyFrom cancels the in-flight read without dropping the replacement', async () => {
		const element = createElement(source);
		const first = element.resolveTemplate(source);
		const other = URI.file('/other-profile.json');

		element.copyFrom = other;
		assert.strictEqual(reads.length, 2);
		assert.strictEqual(reads[1].toString(), other.toString());

		await assert.rejects(first, (err: unknown) => isCancellationError(err));

		const joined = element.resolveTemplate(other);
		assert.strictEqual(reads.length, 2);
		resolvers[1](kept);
		assert.strictEqual(await joined, kept);

		element.copyFrom = other;
		await element.resolveTemplate(other);
		assert.strictEqual(reads.length, 2);

		const third = URI.file('/third-profile.json');
		element.copyFrom = third;
		assert.strictEqual(reads.length, 3);
		resolvers[2]({ name: 'Third' });
		assert.strictEqual((await element.resolveTemplate(third))?.name, 'Third');
	});
});
