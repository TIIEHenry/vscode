/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import * as Constants from '../../common/constants.js';
import { SearchWithAIAction } from '../../browser/searchActionsTopBar.js';

function evalPrecondition(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

const searchWithAIReady: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
	[Constants.SearchContext.hasAIResultProvider.key]: true,
};

const agentsWindowSearchWithAIReady: Record<string, ContextKeyValue> = {
	...searchWithAIReady,
	[IsSessionsWindowContext.key]: true,
};

suite('SearchWithAIAction', function () {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Search with AI F1 is gated to Agents Window', () => {
		const action = new SearchWithAIAction();
		const precondition = action.desc.precondition;
		assert.ok(precondition);
		assert.strictEqual(evalPrecondition(precondition, searchWithAIReady), false, 'default Code window must hide Search with AI in F1');
		assert.strictEqual(evalPrecondition(precondition, agentsWindowSearchWithAIReady), true, 'Agents Window may show Search with AI in F1');
	});
});
