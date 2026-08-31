/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ContextKeyExpr, ContextKeyValue } from '../../../../platform/contextkey/common/contextkey.js';
import { ActivityBarVisibleViewlets } from '../../../common/activityViewletEnablement.js';
import { IsSessionsWindowContext } from '../../../common/contextkeys.js';
import { VIEWLET_ID as DEBUG } from '../../../contrib/debug/common/debug.js';
import { VIEWLET_ID as EXPLORER } from '../../../contrib/files/common/files.js';
import { VIEWLET_ID as REMOTE } from '../../../contrib/remote/browser/remoteExplorer.js';
import { VIEWLET_ID as SCM } from '../../../contrib/scm/common/scm.js';
import { gateActivityExtensionViewWhen } from '../../browser/viewsExtensionPoint.js';

suite('ViewsExtensionPoint - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('gates extension views contributed to Activity sidebar containers', () => {
		const npmWhen = gateActivityExtensionViewWhen(EXPLORER, ContextKeyExpr.deserialize('npm:showScriptExplorer'));
		assert.strictEqual(
			npmWhen?.serialize(),
			ContextKeyExpr.deserialize('npm:showScriptExplorer')?.serialize(),
			'Explorer extension views should keep their original when clause'
		);

		const defaultWindowHidden = {
			[IsSessionsWindowContext.key]: false,
			[`config.${ActivityBarVisibleViewlets.scm}`]: false,
			'npm:showScriptExplorer': true,
		};
		const defaultWindowShown = {
			[IsSessionsWindowContext.key]: false,
			[`config.${ActivityBarVisibleViewlets.scm}`]: true,
			'npm:showScriptExplorer': true,
		};
		const agentsWindow = {
			[IsSessionsWindowContext.key]: true,
			[`config.${ActivityBarVisibleViewlets.scm}`]: false,
			'npm:showScriptExplorer': true,
		};

		const scmWhen = gateActivityExtensionViewWhen(SCM, ContextKeyExpr.deserialize('npm:showScriptExplorer'));
		assert.ok(scmWhen, 'SCM extension views should receive a when clause');
		assert.strictEqual(
			scmWhen!.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => defaultWindowHidden[key as keyof typeof defaultWindowHidden] as T }),
			false,
			'SCM extension views must hide from default Code window when setting is off'
		);
		assert.strictEqual(
			scmWhen!.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => defaultWindowShown[key as keyof typeof defaultWindowShown] as T }),
			true,
			'SCM extension views may show in default Code window when setting is on'
		);
		assert.strictEqual(
			scmWhen!.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => agentsWindow[key as keyof typeof agentsWindow] as T }),
			true,
			'SCM extension views may show in Agents Window'
		);

		const debugWhen = gateActivityExtensionViewWhen(DEBUG, undefined);
		assert.ok(debugWhen, 'Debug extension views should receive a when clause');
		assert.strictEqual(
			debugWhen!.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => defaultWindowHidden[key as keyof typeof defaultWindowHidden] as T }),
			false,
			'Debug extension views must hide from default Code window when setting is off'
		);

		const remoteWhen = gateActivityExtensionViewWhen(REMOTE, undefined);
		assert.ok(remoteWhen, 'Remote extension views should receive a when clause');
		assert.strictEqual(
			remoteWhen!.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => defaultWindowShown[key as keyof typeof defaultWindowShown] as T }),
			true,
			'Remote extension views may show in default Code window when setting is on'
		);

		const ungatedWhen = gateActivityExtensionViewWhen('workbench.view.extension.custom', ContextKeyExpr.deserialize('foo'));
		assert.strictEqual(
			ungatedWhen?.serialize(),
			ContextKeyExpr.deserialize('foo')?.serialize(),
			'Custom extension containers should keep their original when clause'
		);
	});
});
