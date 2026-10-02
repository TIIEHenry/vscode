/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { observableValue } from '../../../../../base/common/observable.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditorPartModalContext, EditorPartModalVisibleContext } from '../../../../../workbench/common/contextkeys.js';
import { ChatContextKeys } from '../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { createNewSessionTour } from '../../browser/tours/newSessionTour.js';

suite('NewSessionTour', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('stays hidden while a modal editor is visible, not only while focus is inside it', () => {
		const trigger = observableValue<boolean>(disposables, false);
		const scenario = createNewSessionTour(trigger);
		const keys = scenario.when?.keys() ?? [];

		assert.deepStrictEqual({
			serialized: scenario.when?.serialize(),
			includesVisibleGate: keys.includes(EditorPartModalVisibleContext.key),
			includesFocusGate: keys.includes(EditorPartModalContext.key),
			includesChatEnabled: keys.includes(ChatContextKeys.enabled.key),
		}, {
			serialized: 'chatIsEnabled && !editorPartModalVisible',
			includesVisibleGate: true,
			includesFocusGate: false,
			includesChatEnabled: true,
		});
	});
});
