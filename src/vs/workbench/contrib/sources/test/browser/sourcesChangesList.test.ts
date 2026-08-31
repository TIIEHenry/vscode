/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { EditorOpenSource } from '../../../../../platform/editor/common/editor.js';
import { ISCMResource } from '../../../scm/common/scm.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { openSourcesChangeEntry } from '../../browser/sourcesChangesList.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';

suite('Sources - Changes list open', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createEntry(resource: URI, scmResource?: ISCMResource): ISourcesChangeEntry {
		return {
			resource,
			name: resource.path.split('/').pop() ?? '',
			description: 'Changes',
			groupId: 'workingTree',
			scmResource,
		};
	}

	test('openSourcesChangeEntry uses scmResource.open for working-tree diff', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let openedPreserveFocus: boolean | undefined;
		const scmResource = {
			open: async (preserveFocus: boolean) => {
				openedPreserveFocus = preserveFocus;
			},
		} as unknown as ISCMResource;

		await openSourcesChangeEntry(createEntry(resource, scmResource), {
			openEditor: async () => {
				assert.fail('must not open file preview when scmResource is present');
			},
		} as unknown as IEditorService, { preserveFocus: true });

		assert.strictEqual(openedPreserveFocus, true);
	});

	test('openSourcesChangeEntry falls back to file preview without scmResource', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let openedResource: URI | undefined;

		await openSourcesChangeEntry(createEntry(resource), {
			openEditor: async input => {
				openedResource = input.resource;
				return undefined;
			},
		} as unknown as IEditorService, { preserveFocus: false, pinned: true });

		assert.strictEqual(openedResource?.toString(), resource.toString());
	});

	test('openSourcesChangeEntry passes editor options on preview fallback', async function () {
		const resource = toResource.call(this, '/project/src/a.ts');
		let capturedOptions: { preserveFocus?: boolean; pinned?: boolean; source?: EditorOpenSource } | undefined;

		await openSourcesChangeEntry(createEntry(resource), {
			openEditor: async input => {
				capturedOptions = input.options;
				return undefined;
			},
		} as unknown as IEditorService, { preserveFocus: true, pinned: true });

		assert.strictEqual(capturedOptions?.preserveFocus, true);
		assert.strictEqual(capturedOptions?.pinned, true);
		assert.strictEqual(capturedOptions?.source, EditorOpenSource.USER);
	});
});
