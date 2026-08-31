/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	getConversationEngineStatusText,
	getConversationModelEchoStatusText,
	getConversationSessionStatusText,
	shouldShowConversationModelEchoInStatusBar,
} from '../../browser/conversationSessionStatus.js';
import { ConversationStubSession } from '../../browser/conversationStubModel.js';
import * as conversationSessionStatus from '../../browser/conversationSessionStatus.js';

suite('ConversationSessionStatus', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getConversationSessionStatusText returns session title when present', () => {
		const session: ConversationStubSession = {
			id: 'test',
			title: 'Product tour',
			turns: [],
		};
		assert.strictEqual(getConversationSessionStatusText(session), 'Product tour');
	});

	test('getConversationSessionStatusText returns empty label when session is missing', () => {
		assert.strictEqual(getConversationSessionStatusText(undefined), 'No session');
	});

	test('getConversationSessionStatusText returns empty label when title is blank', () => {
		const session: ConversationStubSession = {
			id: 'blank',
			title: '   ',
			turns: [],
		};
		assert.strictEqual(getConversationSessionStatusText(session), 'No session');
	});

	test('getConversationEngineStatusText returns honest not-connected copy', () => {
		assert.strictEqual(getConversationEngineStatusText(), 'Engine not connected');
	});

	test('getConversationModelEchoStatusText returns honest no-model copy', () => {
		assert.strictEqual(getConversationModelEchoStatusText(), 'No model');
	});

	test('shouldShowConversationModelEchoInStatusBar is true only when Conversation part is hidden', () => {
		assert.strictEqual(shouldShowConversationModelEchoInStatusBar(true), false);
		assert.strictEqual(shouldShowConversationModelEchoInStatusBar(false), true);
	});

	test('does not export session usage helpers that paint zero placeholders', () => {
		const exports = Object.keys(conversationSessionStatus);
		for (const key of exports) {
			assert.ok(!/usage|turns|tok/i.test(key), `unexpected usage-like export: ${key}`);
		}
	});
});
