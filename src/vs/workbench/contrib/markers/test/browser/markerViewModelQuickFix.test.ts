/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { CancellationError } from '../../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { IMarker, MarkerSeverity } from '../../../../../platform/markers/common/markers.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { LanguageFeatureRegistry } from '../../../../../editor/common/languageFeatureRegistry.js';
import * as languages from '../../../../../editor/common/languages.js';
import { IModelService } from '../../../../../editor/common/services/model.js';
import { ILanguageFeaturesService } from '../../../../../editor/common/services/languageFeatures.js';
import { createTextModel } from '../../../../../editor/test/common/testTextModel.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { Marker } from '../../browser/markersModel.js';
import { MarkerViewModel } from '../../browser/markersTreeViewer.js';

suite('MarkerViewModel quick fixes', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('requests getCodeActions again after the first quick fix read rejects', async () => {
		const uri = URI.parse('file:///quick-fix-retry.ts');
		const model = disposables.add(createTextModel('const x = 1;\n', 'plaintext', undefined, uri));
		const registry = new LanguageFeatureRegistry<languages.CodeActionProvider>();
		let calls = 0;
		disposables.add(registry.register('*', {
			provideCodeActions(): Promise<languages.CodeActionList> {
				calls++;
				return Promise.reject(new CancellationError());
			}
		}));

		const markerData: IMarker = {
			owner: 'test',
			resource: uri,
			severity: MarkerSeverity.Error,
			message: 'bad',
			startLineNumber: 1,
			startColumn: 1,
			endLineNumber: 1,
			endColumn: 2,
		};
		const viewModel = disposables.add(new MarkerViewModel(
			new Marker('marker-1', markerData),
			upcastPartial<IModelService>({ getModel: () => model }),
			{} as IInstantiationService,
			{} as IEditorService,
			{ codeActionProvider: registry } as ILanguageFeaturesService,
		));

		viewModel.showLightBulb();
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.strictEqual(calls, 1, 'a rejected quick fix read must not request again inside the same call');

		viewModel.showLightBulb();
		await new Promise(resolve => setTimeout(resolve, 0));
		assert.strictEqual(calls, 2, 'the next quick fix read must call getCodeActions again');
	});
});
