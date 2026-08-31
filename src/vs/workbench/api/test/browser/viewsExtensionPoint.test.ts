/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../common/contextkeys.js';
import { VIEWLET_ID as EXPLORER } from '../../../contrib/files/common/files.js';
import { gateActivityExtensionViewWhen } from '../../browser/viewsExtensionPoint.js';

suite('ViewsExtensionPoint - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('gates extension views contributed to Activity sidebar containers', () => {
		const npmWhen = gateActivityExtensionViewWhen(EXPLORER, ContextKeyExpr.deserialize('npm:showScriptExplorer'));
		assert.ok(npmWhen, 'Explorer extension views should receive a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false, 'npm:showScriptExplorer': true };
		const agentsWindow = { [IsSessionsWindowContext.key]: true, 'npm:showScriptExplorer': true };

		assert.strictEqual(
			npmWhen!.evaluate({ getValue: key => defaultWindow[key as keyof typeof defaultWindow] }),
			false,
			'Npm Scripts explorer must not occupy Files in the default Code window'
		);
		assert.strictEqual(
			npmWhen!.evaluate({ getValue: key => agentsWindow[key as keyof typeof agentsWindow] }),
			true,
			'Npm Scripts explorer may show in Agents Window when enabled'
		);

		const ungatedWhen = gateActivityExtensionViewWhen('workbench.view.extension.custom', ContextKeyExpr.deserialize('foo'));
		assert.strictEqual(
			ungatedWhen?.serialize(),
			ContextKeyExpr.deserialize('foo')?.serialize(),
			'Custom extension containers should keep their original when clause'
		);
	});
});
