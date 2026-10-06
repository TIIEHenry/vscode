/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { ConversationTrajectoryList } from './conversationTrajectoryList.js';

suite('ConversationTrajectoryList (browser widget)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('setTurns([]) clears prior rows so empty sessions do not keep stale turn ids', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		const trajectoryList = store.add(instantiationService.createInstance(ConversationTrajectoryList, parent, {}));
		trajectoryList.show();
		trajectoryList.layout(200, 320);

		trajectoryList.setTurns([{ id: 'turn-session-a', kind: 'user', text: 'Session A' }]);
		assert.strictEqual(parent.querySelectorAll('[data-turn-id="turn-session-a"]').length, 1);

		trajectoryList.setTurns([]);
		assert.strictEqual(parent.querySelectorAll('[data-turn-id]').length, 0);
	});
});
