/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getEngineStatusCommandArguments } from './conversationSessionStatus.js';
import { CONNECTION_PROFILES_ZONE } from '../common/uaPreferencesPanes.js';

suite('ConversationSessionStatus (browser)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getEngineStatusCommandArguments ignores stale pairingPending when phase is disconnected or failed', () => {
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'disconnected' }, true), [CONNECTION_PROFILES_ZONE]);
		assert.deepStrictEqual(
			getEngineStatusCommandArguments({ kind: 'failed', code: 'transport_failed', reason: 'down' }, true),
			[CONNECTION_PROFILES_ZONE],
		);
		assert.deepStrictEqual(getEngineStatusCommandArguments({ kind: 'connecting', reason: 'initial' }, true), []);
	});
});
