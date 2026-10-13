/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { IDialogService, IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { InMemoryFileSystemProvider } from '../../../../../platform/files/common/inMemoryFilesystemProvider.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IProgressService } from '../../../../../platform/progress/common/progress.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { UriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentityService.js';
import { IUserDataProfilesService } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { IExtensionService } from '../../../extensions/common/extensions.js';
import { ITextFileService } from '../../../textfile/common/textfiles.js';
import { UserDataProfileImportExportService } from '../../browser/userDataProfileImportExportService.js';
import { IUserDataProfileManagementService, IUserDataProfileService } from '../../common/userDataProfile.js';

const ROOT = URI.file('tests').with({ scheme: 'vscode-tests' });

suite('UserDataProfileImportExportService', () => {

	let disposables: DisposableStore;
	let fileService: FileService;
	let service: UserDataProfileImportExportService;
	const profileUri = joinPath(ROOT, 'profile.json');

	setup(() => {
		disposables = new DisposableStore();
		const instantiationService = disposables.add(new TestInstantiationService());
		fileService = disposables.add(new FileService(new NullLogService()));
		const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
		disposables.add(fileService.registerProvider(ROOT.scheme, fileSystemProvider));

		instantiationService.stub(IFileService, fileService);
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IUriIdentityService, disposables.add(new UriIdentityService(fileService)));
		instantiationService.stub(IProductService, { urlProtocol: 'code-oss' } as IProductService);
		instantiationService.stub(IUserDataProfileService, {} as IUserDataProfileService);
		instantiationService.stub(IUserDataProfileManagementService, {} as IUserDataProfileManagementService);
		instantiationService.stub(IUserDataProfilesService, {} as IUserDataProfilesService);
		instantiationService.stub(IExtensionService, {} as IExtensionService);
		instantiationService.stub(IQuickInputService, {} as IQuickInputService);
		instantiationService.stub(IProgressService, {} as IProgressService);
		instantiationService.stub(IDialogService, {} as IDialogService);
		instantiationService.stub(IFileDialogService, {} as IFileDialogService);
		instantiationService.stub(IClipboardService, {} as IClipboardService);
		instantiationService.stub(IOpenerService, {} as IOpenerService);
		instantiationService.stub(IRequestService, {} as IRequestService);
		instantiationService.stub(ITextFileService, {} as ITextFileService);
		instantiationService.stub(IInstantiationService, instantiationService);

		service = disposables.add(instantiationService.createInstance(UserDataProfileImportExportService));
	});

	teardown(() => {
		disposables.dispose();
	});

	async function writeProfile(content: string): Promise<void> {
		await fileService.writeFile(profileUri, VSBuffer.fromString(content));
	}

	test('non-string mcp is not a template until the same file is rewritten as a string', async () => {
		for (const content of [
			'{"name":"P","mcp":null}',
			'{"name":"P","mcp":1}',
			'{"name":"P","mcp":{"servers":{}}}',
		]) {
			await writeProfile(content);
			assert.strictEqual(await service.resolveProfileTemplate(profileUri), null, content);
		}

		const valid = '{"name":"P","mcp":"servers"}';
		await writeProfile(valid);
		assert.deepStrictEqual(await service.resolveProfileTemplate(profileUri), JSON.parse(valid));
	});

	test('JSON arrays are not profile templates', async () => {
		for (const content of ['[]', '[{"name":"P"}]']) {
			await writeProfile(content);
			assert.strictEqual(await service.resolveProfileTemplate(profileUri), null, content);
		}
	});

	test('invalid JSON still throws the localized profile error', async () => {
		await writeProfile('{');
		await assert.rejects(() => service.resolveProfileTemplate(profileUri), (error: Error) => {
			assert.ok(error instanceof Error);
			assert.strictEqual(error.message, 'This profile is not valid.');
			return true;
		});
	});
});
