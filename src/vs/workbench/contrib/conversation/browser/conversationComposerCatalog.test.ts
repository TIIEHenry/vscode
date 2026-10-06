/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { conversationLensDockNoModel } from './conversationLensDockStrings.js';
import { composerModelIds, composerModelSelectOptions } from './conversationComposerCatalog.js';

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
});
