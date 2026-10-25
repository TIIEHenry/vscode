/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { conversationLensDockEngineNotConnected, conversationLensDockSessionLoading, conversationLensDockSessionUnavailable, conversationLensDockSessionUnavailableReason } from '../../browser/conversationLensDockStrings.js';
import { conversationSessionHoldReason, conversationSessionShortStatus, conversationTimelineEmptyKind, getConversationSessionReadiness, isConversationSessionNotReady, type ConversationSessionReadiness } from '../../browser/conversationSessionAvailability.js';

suite('ConversationSessionAvailability', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('missing roster, a disconnected roster, and a roster without a ready probe stay ready', () => {
		assert.strictEqual(getConversationSessionReadiness(undefined), 'ready');
		assert.strictEqual(isConversationSessionNotReady(undefined), false);
		assert.strictEqual(getConversationSessionReadiness({ isEngineConnected: () => false, isEngineSessionReady: () => false }), 'ready');
		assert.strictEqual(getConversationSessionReadiness({ isEngineConnected: () => true }), 'ready');
		assert.strictEqual(isConversationSessionNotReady({ isEngineConnected: () => true }), false);
	});

	test('an explicit readiness wins, and a false ready probe without it is unavailable', () => {
		const readiness = (value: ConversationSessionReadiness) => ({
			isEngineConnected: () => true,
			isEngineSessionReady: () => false,
			getEngineSessionReadiness: () => value,
		});
		assert.strictEqual(getConversationSessionReadiness(readiness('loading')), 'loading');
		assert.strictEqual(getConversationSessionReadiness(readiness('unavailable')), 'unavailable');
		assert.strictEqual(getConversationSessionReadiness(readiness('ready')), 'ready');
		assert.strictEqual(isConversationSessionNotReady(readiness('loading')), true);
		assert.strictEqual(getConversationSessionReadiness({
			isEngineConnected: () => true,
			isEngineSessionReady: () => false,
		}), 'unavailable');
	});

	test('hold reason and short status keep pairing ahead of readiness', () => {
		const sentence = `${conversationLensDockSessionUnavailable} — ${conversationLensDockSessionUnavailableReason}`;
		assert.strictEqual(conversationSessionHoldReason(true, 'unavailable'), conversationLensDockEngineNotConnected);
		assert.strictEqual(conversationSessionHoldReason(false, 'loading'), conversationLensDockSessionLoading);
		assert.strictEqual(conversationSessionHoldReason(false, 'unavailable'), sentence);
		assert.strictEqual(conversationSessionHoldReason(false, 'ready'), undefined);
		assert.strictEqual(conversationSessionShortStatus('loading'), conversationLensDockSessionLoading);
		assert.strictEqual(conversationSessionShortStatus('unavailable'), conversationLensDockSessionUnavailable);
		assert.strictEqual(conversationSessionShortStatus('ready'), undefined);
		assert.strictEqual(conversationTimelineEmptyKind('loading'), 'loading');
		assert.strictEqual(conversationTimelineEmptyKind('unavailable'), 'unavailable');
		assert.strictEqual(conversationTimelineEmptyKind('ready'), 'empty');
	});
});
