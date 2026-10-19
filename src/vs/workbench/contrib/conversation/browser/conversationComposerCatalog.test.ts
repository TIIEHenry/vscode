/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { conversationLensDockNoModel } from './conversationLensDockStrings.js';
import { composerEnabledModelIds, composerModelIds, composerModelSelectionIndex, composerModelSelectOptions } from './conversationComposerCatalog.js';

suite('conversationComposerCatalog (unit)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('model catalog ids trim registry id fallback to match recorded modelProfileId', () => {
		const models = [
			{ id: '  spaced-model  ', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: '' },
		] as const;
		const recordedProfileId = 'spaced-model';
		assert.strictEqual(composerModelIds(models).indexOf(recordedProfileId), 1);
		assert.deepStrictEqual(composerModelSelectOptions(models), [
			{ text: conversationLensDockNoModel },
			{ text: recordedProfileId },
		]);
	});

	test('composerModelSelectionIndex defaults to the first enabled model and keeps an explicit empty choice', () => {
		const models = [
			{ id: '1', type: 'chat', enabled: false, level: 1, provider: 'p', modelId: 'off' },
			{ id: '2', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'on' },
		] as const;
		const ids = composerModelIds(models);
		assert.deepStrictEqual(composerEnabledModelIds(models), ['on']);
		assert.strictEqual(composerModelSelectionIndex(ids, models, '', false), 2);
		assert.strictEqual(composerModelSelectionIndex(ids, models, '', true), 0);
		assert.strictEqual(composerModelSelectionIndex(ids, models, 'missing', false), 0);
		assert.strictEqual(composerModelSelectionIndex(ids, models, 'on', false), 2);
		assert.strictEqual(ids[0], '');
	});
});
