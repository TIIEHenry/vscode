/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { workbenchInstantiationService, TestInMemoryFileSystemProvider, TestServiceAccessor, TestTextFileService } from '../../../../test/browser/workbenchTestServices.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { FileService } from '../../../../../platform/files/common/fileService.js';
import { Schemas } from '../../../../../base/common/network.js';
import { TextFileEditorModelManager } from '../../common/textFileEditorModelManager.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { FileOperationError, FileOperationResult, IFileService, TooLargeFileOperationError } from '../../../../../platform/files/common/files.js';
import { URI } from '../../../../../base/common/uri.js';
import { VSBuffer } from '../../../../../base/common/buffer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { IDialogService, IConfirmation, IConfirmationResult } from '../../../../../platform/dialogs/common/dialogs.js';
import { dirname } from '../../../../../base/common/resources.js';
import { ISaveErrorHandler, TextFileOperationError, TextFileOperationResult } from '../../common/textfiles.js';
import { IWorkingCopyFileService, WorkingCopyFileService } from '../../../workingCopy/common/workingCopyFileService.js';
import { WorkingCopyService } from '../../../workingCopy/common/workingCopyService.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { UriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentityService.js';
import { ITextFileService } from '../../common/textfiles.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { TextFileEditorModel } from '../../common/textFileEditorModel.js';
import { IUntitledTextEditorModel } from '../../../untitled/common/untitledTextEditorModel.js';

const ASSOCIATED_PATH = '/some/associated.bin';
const ASSOCIATED_URI = URI.file(ASSOCIATED_PATH);
const OTHER_TARGET_URI = URI.file('/some/other-target.bin');
const ORIGINAL_BINARY = VSBuffer.concat([VSBuffer.fromString('original-bytes'), VSBuffer.wrap(new Uint8Array([0]))]);

class ConfirmCountingDialogService extends TestDialogService {
	confirmCount = 0;

	override async confirm(confirmation: IConfirmation): Promise<IConfirmationResult> {
		this.confirmCount++;
		return super.confirm(confirmation);
	}
}

suite('Files - TextFileService saveAs associated binary overwrite', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	let parentInstantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;
	let fileService: IFileService;
	let fileProvider: TestInMemoryFileSystemProvider;
	let dialogService: ConfirmCountingDialogService;

	async function disposeTextFileEditorModel(model: TextFileEditorModel): Promise<void> {
		if (model.isDisposed()) {
			return;
		}

		if (model.isDirty()) {
			await model.revert({ soft: true });
		}

		model.dispose();
	}

	async function disposeTextFileEditorModelsFrom(...managers: TextFileEditorModelManager[]): Promise<void> {
		for (const manager of managers) {
			for (const textFileEditorModel of [...manager.models]) {
				await disposeTextFileEditorModel(textFileEditorModel);
			}
		}
	}

	async function disposeUntitledModel(model: IUntitledTextEditorModel | undefined): Promise<void> {
		if (!model || model.isDisposed()) {
			return;
		}

		if (model.isDirty()) {
			await model.revert({ soft: true });
		}

		model.dispose();
	}

	async function releaseSaveAsTestModels(untitledModel?: IUntitledTextEditorModel): Promise<void> {
		const parentTextFileService = parentInstantiationService.invokeFunction(accessor => accessor.get(ITextFileService)) as TestTextFileService;
		await disposeTextFileEditorModelsFrom(
			<TextFileEditorModelManager>accessor.textFileService.files,
			<TextFileEditorModelManager>parentTextFileService.files,
		);
		await disposeUntitledModel(untitledModel);
	}

	async function writeBinaryTarget(uri: URI = ASSOCIATED_URI, contents: VSBuffer = ORIGINAL_BINARY): Promise<void> {
		await fileProvider.writeFile(uri, contents, { create: true, overwrite: true, unlock: false, atomic: false });
	}

	async function readTargetBytes(uri: URI = ASSOCIATED_URI): Promise<VSBuffer> {
		return (await fileService.readFile(uri)).value;
	}

	async function countFilesInDir(dir: URI): Promise<number> {
		const stat = await fileService.resolve(dir);
		return stat.children?.length ?? 0;
	}

	async function createAssociatedUntitled(sourceText: string) {
		const model = disposables.add(await accessor.textFileService.untitled.resolve({ associatedResource: { path: ASSOCIATED_PATH } }));
		await model.resolve();
		model.textEditorModel!.setValue(sourceText);
		return model;
	}

	setup(async () => {
		const logService = new NullLogService();
		fileService = disposables.add(new FileService(logService));
		fileProvider = disposables.add(new TestInMemoryFileSystemProvider());
		disposables.add(fileService.registerProvider(Schemas.file, fileProvider));
		dialogService = new ConfirmCountingDialogService();

		parentInstantiationService = workbenchInstantiationService(undefined, disposables);
		const uriIdentityService = disposables.add(new UriIdentityService(fileService));
		const instantiationService = parentInstantiationService.createChild(new ServiceCollection());
		instantiationService.stub(IFileService, fileService);
		instantiationService.stub(IDialogService, dialogService);
		instantiationService.stub(IUriIdentityService, uriIdentityService);
		instantiationService.stub(IWorkingCopyFileService, disposables.add(new WorkingCopyFileService(fileService, disposables.add(new WorkingCopyService()), instantiationService, uriIdentityService)));
		instantiationService.stub(ITextFileService, disposables.add(instantiationService.createInstance(TestTextFileService)));

		accessor = instantiationService.createInstance(TestServiceAccessor);
		disposables.add(<TextFileEditorModelManager>accessor.textFileService.files);

		await fileProvider.mkdir(URI.file('/some'));
	});

	teardown(async () => {
		await releaseSaveAsTestModels();
	});

	test('cancel overwrite keeps target bytes and leaves no temp file', async function () {
		await writeBinaryTarget();
		const model = await createAssociatedUntitled('untitled source text');

		const result = await accessor.textFileService.save(model.resource);
		assert.strictEqual(result, undefined);

		assert.ok((await readTargetBytes()).equals(ORIGINAL_BINARY));
		assert.strictEqual(await countFilesInDir(dirname(ASSOCIATED_URI)), 1);
		assert.strictEqual(dialogService.confirmCount, 1);

		await releaseSaveAsTestModels(model);
	});

	test('confirmed overwrite writes source text and removes temp file', async function () {
		await writeBinaryTarget();
		const model = await createAssociatedUntitled('saved text content');
		dialogService.setConfirmResult({ confirmed: true });

		const result = await accessor.textFileService.save(model.resource);
		assert.strictEqual(result?.toString(), ASSOCIATED_URI.toString());
		assert.strictEqual((await readTargetBytes()).toString(), 'saved text content');
		assert.strictEqual(await countFilesInDir(dirname(ASSOCIATED_URI)), 1);
		assert.strictEqual(model.isDirty(), false);
		assert.strictEqual(dialogService.confirmCount, 1);

		await releaseSaveAsTestModels(model);
	});

	test('write failure restores target bytes and does not invoke saveErrorHandler', async function () {
		await writeBinaryTarget();
		const model = await createAssociatedUntitled('will fail to write');
		dialogService.setConfirmResult({ confirmed: true });

		let saveErrorCount = 0;
		const previousHandler: ISaveErrorHandler = accessor.textFileService.files.saveErrorHandler;
		accessor.textFileService.files.saveErrorHandler = {
			onSaveError(): void {
				saveErrorCount++;
			}
		};

		(accessor.textFileService as TestTextFileService).setReadStreamErrorOnce(new TextFileOperationError('binary', TextFileOperationResult.FILE_IS_BINARY));
		(accessor.textFileService as TestTextFileService).setWriteErrorOnce(new FileOperationError('write failed', FileOperationResult.FILE_OTHER_ERROR));

		let error: Error | undefined;
		try {
			await accessor.textFileService.save(model.resource);
		} catch (e) {
			error = e as Error;
		}

		accessor.textFileService.files.saveErrorHandler = previousHandler;

		assert.ok(error);
		assert.ok((await readTargetBytes()).equals(ORIGINAL_BINARY));
		assert.strictEqual(saveErrorCount, 0);
		assert.ok(!accessor.textFileService.files.get(ASSOCIATED_URI)?.isDirty());

		await releaseSaveAsTestModels(model);
	});

	test('non-associated target does not call confirmOverwrite', async function () {
		await writeBinaryTarget(OTHER_TARGET_URI);
		const model = await createAssociatedUntitled('text for other path');

		const result = await accessor.textFileService.saveAs(model.resource, OTHER_TARGET_URI);
		assert.strictEqual(result?.toString(), OTHER_TARGET_URI.toString());
		assert.strictEqual(dialogService.confirmCount, 0);
		assert.strictEqual((await readTargetBytes(OTHER_TARGET_URI)).toString(), 'text for other path');

		await releaseSaveAsTestModels(model);
	});

	test('FILE_TOO_LARGE on resolve uses overwrite path', async function () {
		await writeBinaryTarget();
		const model = await createAssociatedUntitled('large file replacement');
		dialogService.setConfirmResult({ confirmed: true });

		(accessor.textFileService as TestTextFileService).setReadStreamErrorOnce(new TooLargeFileOperationError('too large', FileOperationResult.FILE_TOO_LARGE, 1000));

		const result = await accessor.textFileService.save(model.resource);
		assert.strictEqual(result?.toString(), ASSOCIATED_URI.toString());
		assert.strictEqual((await readTargetBytes()).toString(), 'large file replacement');

		await releaseSaveAsTestModels(model);
	});
});
