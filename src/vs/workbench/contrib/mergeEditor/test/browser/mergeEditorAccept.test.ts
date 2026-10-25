/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { observableValue } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { TestDialogService } from '../../../../../platform/dialogs/test/common/testDialogService.js';
import { IEditorIdentifier } from '../../../../common/editor.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { AcceptMerge } from '../../browser/commands/commands.js';
import { MergeEditorInput } from '../../browser/mergeEditorInput.js';
import { IMergeEditorInputModel } from '../../browser/mergeEditorInputModel.js';
import { MergeEditorViewModel } from '../../browser/view/viewModel.js';

declare function __readFileInTests(path: string): Promise<string>;

suite('merge editor accept', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHarness(accepted: boolean) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IDialogService, new TestDialogService());
		let closeEditorCalls = 0;
		instantiationService.stub(IEditorService, {
			closeEditor: async () => { closeEditorCalls++; },
		} as unknown as IEditorService);

		const inputModel = {
			resultUri: URI.file('/result.txt'),
			accept: async () => accepted,
		} as unknown as IMergeEditorInputModel;
		const viewModel = {
			model: {
				unhandledConflictsCount: observableValue('unhandledConflictsCount', 0),
			},
		} as unknown as MergeEditorViewModel;
		const editorIdentifier = {
			editor: {} as MergeEditorInput,
			groupId: 1,
		} satisfies IEditorIdentifier;

		return {
			run: () => instantiationService.invokeFunction(accessor => new AcceptMerge().runWithMergeEditor({
				inputModel,
				viewModel,
				input: editorIdentifier.editor,
				editorIdentifier,
			}, accessor)),
			get closeEditorCalls() { return closeEditorCalls; },
		};
	}

	test('accept failure reports failure and keeps the merge editor open', async () => {
		const harness = createHarness(false);

		const result = await harness.run();

		assert.deepStrictEqual(result, { successful: false });
		assert.strictEqual(harness.closeEditorCalls, 0);
	});

	test('accept success reports success and closes the merge editor', async () => {
		const harness = createHarness(true);

		const result = await harness.run();

		assert.deepStrictEqual(result, { successful: true });
		assert.strictEqual(harness.closeEditorCalls, 1);
	});

	test('input models only finish after the save was confirmed', async () => {
		const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/mergeEditor/browser/mergeEditorInputModel.ts`);

		const tempAccept = source.indexOf('async accept(): Promise<boolean> {');
		const tempSave = source.indexOf('const savedUri = await this.textFileService.save(this.result.textEditorModel.uri);', tempAccept);
		const tempGuard = source.indexOf('if (!savedUri || this.model.resultTextModel.getAlternativeVersionId() !== versionBeforeSave) {', tempSave);
		const tempFinished = source.indexOf('this.finished = true;', tempGuard);
		const tempReturnTrue = source.indexOf('return true;', tempFinished);

		assert.ok(tempAccept >= 0);
		assert.ok(tempSave > tempAccept);
		assert.ok(tempGuard > tempSave);
		assert.ok(tempFinished > tempGuard);
		assert.ok(tempReturnTrue > tempFinished);
		assert.ok(!source.slice(tempSave, tempGuard).includes('this.finished = true;'));
		assert.ok(!source.slice(tempSave, tempGuard).includes('savedAltVersionId.set'));

		const workspaceAccept = source.indexOf('public async accept(): Promise<boolean> {');
		const workspaceSave = source.indexOf('const saved = await this.resultTextFileModel.save();', workspaceAccept);
		const workspaceGuard = source.indexOf('if (!saved) {', workspaceSave);
		const workspaceReportClose = source.indexOf('this.reportClose(true);', workspaceGuard);
		const workspaceReturnTrue = source.indexOf('return true;', workspaceReportClose);

		assert.ok(workspaceAccept >= 0);
		assert.ok(workspaceSave > workspaceAccept);
		assert.ok(workspaceGuard > workspaceSave);
		assert.ok(workspaceReportClose > workspaceGuard);
		assert.ok(workspaceReturnTrue > workspaceReportClose);
		assert.ok(!source.slice(workspaceSave, workspaceGuard).includes('reportClose(true)'));
	});
});
