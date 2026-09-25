/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { LocalChatSessionUri } from '../../common/model/chatUri.js';
import { resolveSendSessionAfterPromptApply } from '../../browser/widget/chatWidget.js';

suite('resolveSendSessionAfterPromptApply', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const captured = LocalChatSessionUri.forSession('captured');
	const replacement = LocalChatSessionUri.forSession('replacement');

	test('keeps the captured session when prompt apply did not change it', () => {
		const session = resolveSendSessionAfterPromptApply(captured, { sessionResource: captured }, false, { clearedSession: false });
		assert.strictEqual(session?.toString(), captured.toString());
	});

	test('aborts when a newer session replaced the captured one without clear', () => {
		assert.strictEqual(resolveSendSessionAfterPromptApply(captured, { sessionResource: replacement }, false, { clearedSession: false }), undefined);
	});

	test('sends on the session clear() installed', () => {
		const session = resolveSendSessionAfterPromptApply(captured, { sessionResource: replacement }, false, { clearedSession: true });
		assert.strictEqual(session?.toString(), replacement.toString());
	});

	test('aborts when prompt apply was cancelled or the widget is gone', () => {
		assert.strictEqual(resolveSendSessionAfterPromptApply(captured, { sessionResource: captured }, false, false), undefined);
		assert.strictEqual(resolveSendSessionAfterPromptApply(captured, { sessionResource: replacement }, true, { clearedSession: true }), undefined);
		assert.strictEqual(resolveSendSessionAfterPromptApply(captured, undefined, false, { clearedSession: true }), undefined);
	});
});
