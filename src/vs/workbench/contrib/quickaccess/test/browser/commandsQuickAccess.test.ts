/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldOfferCommandPaletteAiRelatedPicks, shouldOfferCommandPaletteAskInChat } from '../../browser/commandsQuickAccess.js';

suite('CommandsQuickAccessProvider helpers', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('shouldOfferCommandPaletteAskInChat is false in default Code window', () => {
		assert.strictEqual(shouldOfferCommandPaletteAskInChat(false, true), false);
		assert.strictEqual(shouldOfferCommandPaletteAskInChat(false, false), false);
	});

	test('shouldOfferCommandPaletteAskInChat respects showAskInChat in Agents window', () => {
		assert.strictEqual(shouldOfferCommandPaletteAskInChat(true, true), true);
		assert.strictEqual(shouldOfferCommandPaletteAskInChat(true, false), false);
	});

	test('shouldOfferCommandPaletteAiRelatedPicks is false in default Code window', () => {
		assert.strictEqual(shouldOfferCommandPaletteAiRelatedPicks(false, true, true), false);
	});

	test('shouldOfferCommandPaletteAiRelatedPicks requires all flags in Agents window', () => {
		assert.strictEqual(shouldOfferCommandPaletteAiRelatedPicks(true, true, true), true);
		assert.strictEqual(shouldOfferCommandPaletteAiRelatedPicks(true, false, true), false);
		assert.strictEqual(shouldOfferCommandPaletteAiRelatedPicks(true, true, false), false);
	});
});
