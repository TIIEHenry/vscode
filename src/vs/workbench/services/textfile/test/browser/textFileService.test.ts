/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { workbenchInstantiationService, TestServiceAccessor, ITestTextFileEditorModelManager } from '../../../../test/browser/workbenchTestServices.js';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { TextFileEditorModel } from '../../common/textFileEditorModel.js';
import { FileOperation } from '../../../../../platform/files/common/files.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { EncodingMode } from '../../common/textfiles.js';
import { URI } from '../../../../../base/common/uri.js';
import { ExtUri } from '../../../../../base/common/resources.js';

suite('Files - TextFileService', () => {

	const disposables = new DisposableStore();
	const sandbox = sinon.createSandbox();
	let instantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;

	setup(() => {
		instantiationService = workbenchInstantiationService(undefined, disposables);
		accessor = instantiationService.createInstance(TestServiceAccessor);
		disposables.add(<ITestTextFileEditorModelManager>accessor.textFileService.files);
	});

	teardown(() => {
		sandbox.restore();
		disposables.clear();
	});

	test('isDirty/getDirty - files and untitled', async function () {
		const model: TextFileEditorModel = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/file.txt'), 'utf8', undefined));
		(<ITestTextFileEditorModelManager>accessor.textFileService.files).add(model.resource, model);

		await model.resolve();

		assert.ok(!accessor.textFileService.isDirty(model.resource));
		model.textEditorModel!.setValue('foo');

		assert.ok(accessor.textFileService.isDirty(model.resource));

		const untitled = disposables.add(await accessor.textFileService.untitled.resolve());

		assert.ok(!accessor.textFileService.isDirty(untitled.resource));
		untitled.textEditorModel?.setValue('changed');

		assert.ok(accessor.textFileService.isDirty(untitled.resource));
	});

	test('save - file', async function () {
		const model: TextFileEditorModel = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/file.txt'), 'utf8', undefined));
		(<ITestTextFileEditorModelManager>accessor.textFileService.files).add(model.resource, model);

		await model.resolve();
		model.textEditorModel!.setValue('foo');
		assert.ok(accessor.textFileService.isDirty(model.resource));

		const res = await accessor.textFileService.save(model.resource);
		assert.strictEqual(res?.toString(), model.resource.toString());
		assert.ok(!accessor.textFileService.isDirty(model.resource));
	});

	test('saveAll - file', async function () {
		const model: TextFileEditorModel = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/file.txt'), 'utf8', undefined));
		(<ITestTextFileEditorModelManager>accessor.textFileService.files).add(model.resource, model);

		await model.resolve();
		model.textEditorModel!.setValue('foo');
		assert.ok(accessor.textFileService.isDirty(model.resource));

		const res = await accessor.textFileService.save(model.resource);
		assert.strictEqual(res?.toString(), model.resource.toString());
		assert.ok(!accessor.textFileService.isDirty(model.resource));
	});

	test('saveAs - file', async function () {
		const model: TextFileEditorModel = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/file.txt'), 'utf8', undefined));
		(<ITestTextFileEditorModelManager>accessor.textFileService.files).add(model.resource, model);
		accessor.fileDialogService.setPickFileToSave(model.resource);

		await model.resolve();
		model.textEditorModel!.setValue('foo');
		assert.ok(accessor.textFileService.isDirty(model.resource));

		const res = await accessor.textFileService.saveAs(model.resource);
		assert.strictEqual(res!.toString(), model.resource.toString());
		assert.ok(!accessor.textFileService.isDirty(model.resource));
	});

	test('saveAs - same identity move reports undefined when neither save writes', async function () {
		const source = URI.file('/path/FILE.txt');
		const target = URI.file('/path/file.txt');
		const uriIdentity = accessor.uriIdentityService;
		sandbox.stub(uriIdentity, 'extUri').value(new ExtUri(() => true));
		sandbox.stub(accessor.workingCopyFileService, 'move').resolves([]);
		const save = sandbox.stub(accessor.textFileService, 'save').resolves(undefined);

		const result = await accessor.textFileService.saveAs(source, target);

		assert.strictEqual(result, undefined);
		assert.strictEqual(save.callCount, 2);
	});

	test('saveAs - same identity move returns target when a later save writes', async function () {
		const source = URI.file('/path/FILE.txt');
		const target = URI.file('/path/file.txt');
		const uriIdentity = accessor.uriIdentityService;
		sandbox.stub(uriIdentity, 'extUri').value(new ExtUri(() => true));
		sandbox.stub(accessor.workingCopyFileService, 'move').resolves([]);
		sandbox.stub(accessor.textFileService, 'save').onFirstCall().resolves(undefined).onSecondCall().resolves(target);

		const result = await accessor.textFileService.saveAs(source, target);

		assert.strictEqual(result?.toString(), target.toString());
	});

	test('revert - file', async function () {
		const model: TextFileEditorModel = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/file.txt'), 'utf8', undefined));
		(<ITestTextFileEditorModelManager>accessor.textFileService.files).add(model.resource, model);
		accessor.fileDialogService.setPickFileToSave(model.resource);

		await model.resolve();
		model.textEditorModel!.setValue('foo');
		assert.ok(accessor.textFileService.isDirty(model.resource));

		await accessor.textFileService.revert(model.resource);
		assert.ok(!accessor.textFileService.isDirty(model.resource));
	});

	test('create does not overwrite existing model', async function () {
		const model: TextFileEditorModel = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/file.txt'), 'utf8', undefined));
		(<ITestTextFileEditorModelManager>accessor.textFileService.files).add(model.resource, model);

		await model.resolve();
		model.textEditorModel!.setValue('foo');
		assert.ok(accessor.textFileService.isDirty(model.resource));

		let eventCounter = 0;

		disposables.add(accessor.workingCopyFileService.addFileOperationParticipant({
			participate: async files => {
				assert.strictEqual(files[0].target.toString(), model.resource.toString());
				eventCounter++;
			}
		}));

		disposables.add(accessor.workingCopyFileService.onDidRunWorkingCopyFileOperation(e => {
			assert.strictEqual(e.operation, FileOperation.CREATE);
			assert.strictEqual(e.files[0].target.toString(), model.resource.toString());
			eventCounter++;
		}));

		await accessor.textFileService.create([{ resource: model.resource, value: 'Foo' }]);
		assert.ok(!accessor.textFileService.isDirty(model.resource));

		assert.strictEqual(eventCounter, 2);
	});

	test('Filename Suggestion - Suggest prefix only when there are no relevant extensions', () => {
		disposables.add(accessor.languageService.registerLanguage({
			id: 'plumbus0',
			extensions: ['.one', '.two']
		}));

		const suggested = accessor.textFileService.suggestFilename('shleem', 'Untitled-1');
		assert.strictEqual(suggested, 'Untitled-1');
	});

	test('Filename Suggestion - Suggest prefix with first extension', () => {
		disposables.add(accessor.languageService.registerLanguage({
			id: 'plumbus1',
			extensions: ['.shleem', '.gazorpazorp'],
			filenames: ['plumbus']
		}));

		const suggested = accessor.textFileService.suggestFilename('plumbus1', 'Untitled-1');
		assert.strictEqual(suggested, 'Untitled-1.shleem');
	});

	test('Filename Suggestion - Preserve extension if it matchers', () => {
		disposables.add(accessor.languageService.registerLanguage({
			id: 'plumbus2',
			extensions: ['.shleem', '.gazorpazorp'],
		}));

		const suggested = accessor.textFileService.suggestFilename('plumbus2', 'Untitled-1.gazorpazorp');
		assert.strictEqual(suggested, 'Untitled-1.gazorpazorp');
	});

	test('Filename Suggestion - Rewrite extension according to language', () => {
		disposables.add(accessor.languageService.registerLanguage({
			id: 'plumbus2',
			extensions: ['.shleem', '.gazorpazorp'],
		}));

		const suggested = accessor.textFileService.suggestFilename('plumbus2', 'Untitled-1.foobar');
		assert.strictEqual(suggested, 'Untitled-1.shleem');
	});

	test('Filename Suggestion - Suggest filename if there are no extensions', () => {
		disposables.add(accessor.languageService.registerLanguage({
			id: 'plumbus2',
			filenames: ['plumbus', 'shleem', 'gazorpazorp']
		}));

		const suggested = accessor.textFileService.suggestFilename('plumbus2', 'Untitled-1');
		assert.strictEqual(suggested, 'plumbus');
	});

	test('Filename Suggestion - Preserve filename if it matches', () => {
		disposables.add(accessor.languageService.registerLanguage({
			id: 'plumbus2',
			filenames: ['plumbus', 'shleem', 'gazorpazorp']
		}));

		const suggested = accessor.textFileService.suggestFilename('plumbus2', 'gazorpazorp');
		assert.strictEqual(suggested, 'gazorpazorp');
	});

	test('Filename Suggestion - Rewrites filename according to language', () => {
		disposables.add(accessor.languageService.registerLanguage({
			id: 'plumbus2',
			filenames: ['plumbus', 'shleem', 'gazorpazorp']
		}));

		const suggested = accessor.textFileService.suggestFilename('plumbus2', 'foobar');
		assert.strictEqual(suggested, 'plumbus');
	});

	test('getEncoding() - files and untitled', async function () {
		const model: TextFileEditorModel = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, '/path/file.txt'), 'utf8', undefined));
		(<ITestTextFileEditorModelManager>accessor.textFileService.files).add(model.resource, model);

		await model.resolve();

		assert.strictEqual(accessor.textFileService.getEncoding(model.resource), 'utf8');
		await model.setEncoding('utf16', EncodingMode.Encode);
		assert.strictEqual(accessor.textFileService.getEncoding(model.resource), 'utf16');

		const untitled = disposables.add(await accessor.textFileService.untitled.resolve());

		assert.strictEqual(accessor.textFileService.getEncoding(untitled.resource), 'utf8');
		await untitled.setEncoding('utf16');
		assert.strictEqual(accessor.textFileService.getEncoding(untitled.resource), 'utf16');
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
