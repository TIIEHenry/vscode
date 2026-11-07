/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IFilesConfigurationService } from '../../../filesConfiguration/common/filesConfigurationService.js';
import { ITextFileService } from '../../../textfile/common/textfiles.js';
import { JSONEditingService } from '../../common/jsonEditingService.js';

suite('JSONEditingService', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('replacing the whole file with a shorter value removes the old content', async () => {
		const resource = URI.file('/test/settings.json');
		const model = disposables.add(createTextModel('{\n    "a.very.long.setting.name": "with a fairly long value",\n    "another": true\n}', null, undefined, resource));
		const service = new JSONEditingService(
			{ exists: async () => true } as Partial<IFileService> as IFileService,
			{ createModelReference: async () => ({ object: { textEditorModel: model } as Partial<IResolvedTextEditorModel> as IResolvedTextEditorModel, dispose: () => { } }) } as Partial<ITextModelService> as ITextModelService,
			{ save: async (uri: URI) => uri } as Partial<ITextFileService> as ITextFileService,
			{ enableAutoSaveAfterShortDelay: () => Disposable.None } as Partial<IFilesConfigurationService> as IFilesConfigurationService,
		);

		await service.write(resource, [{ path: [], value: { b: 1 } }]);

		assert.strictEqual(model.getValue(), '{\n    "b": 1\n}');
	});
});
