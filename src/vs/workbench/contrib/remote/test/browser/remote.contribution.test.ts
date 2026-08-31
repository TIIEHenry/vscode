/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { ActivityBarVisibleViewlets } from '../../../../common/activityViewletEnablement.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { remoteHelpPanelWhen } from '../../browser/remote.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('RemoteContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Remote Help panel respects optional Activity setting', () => {
		assert.ok(remoteHelpPanelWhen, 'Remote Help panel should have a when clause');

		const defaultWindowHidden = {
			[IsSessionsWindowContext.key]: false,
			[`config.${ActivityBarVisibleViewlets.remote}`]: false,
		};
		const defaultWindowShown = {
			[IsSessionsWindowContext.key]: false,
			[`config.${ActivityBarVisibleViewlets.remote}`]: true,
		};
		const agentsWindow = {
			[IsSessionsWindowContext.key]: true,
			[`config.${ActivityBarVisibleViewlets.remote}`]: false,
		};

		assert.strictEqual(
			evalWhen(remoteHelpPanelWhen, defaultWindowHidden),
			false,
			'default Code window must hide Remote Help when setting is off'
		);
		assert.strictEqual(
			evalWhen(remoteHelpPanelWhen, defaultWindowShown),
			true,
			'default Code window may show Remote Help when setting is on'
		);
		assert.strictEqual(
			evalWhen(remoteHelpPanelWhen, agentsWindow),
			true,
			'Agents Window may show Remote Help in Activity sidebar'
		);
	});
});
