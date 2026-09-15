/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { UA_CLIENT_DISPLAY_CONVERSATION_DENSITY } from '../../common/uaClientSettingsKeys.js';
import { getBackToClientSettingsOpenOptions } from '../../common/uaPreferencesPanes.js';

suite('UA preferences panes', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Back to Client Settings opens the Client group, not Commonly Used', () => {
		const options = getBackToClientSettingsOpenOptions();
		assert.strictEqual(options.focusSearch, false);
		assert.strictEqual(options.query, `@id:${UA_CLIENT_DISPLAY_CONVERSATION_DENSITY}`);
		assert.ok(options.query.startsWith('@id:ua.client.'));
	});
});
