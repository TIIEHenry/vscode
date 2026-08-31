/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getEditorGroupWatermarkEntryActionIds } from '../../../../browser/parts/editor/editorGroupWatermark.js';

suite('Editor Group Watermark', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('primary entries are file-oriented and exclude Copilot Chat', () => {
		const actionIds = getEditorGroupWatermarkEntryActionIds();

		assert.ok(actionIds.includes('workbench.action.showCommands'));
		assert.ok(actionIds.includes('workbench.action.quickOpen'));
		assert.ok(actionIds.includes('workbench.action.files.openFile'));
		assert.ok(actionIds.includes('workbench.action.findInFiles'));
		assert.strictEqual(actionIds.includes('workbench.action.chat.open'), false);
	});

});
