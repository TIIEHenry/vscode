/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewsRegistry } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { HISTORY_VIEW_PANE_ID, REPOSITORIES_VIEW_PANE_ID, VIEW_PANE_ID } from '../../common/scm.js';

import '../../browser/scm.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('SCMContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Source Control sidebar views are gated to Agents Window', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		const changesView = viewsRegistry.getView(VIEW_PANE_ID);
		const repositoriesView = viewsRegistry.getView(REPOSITORIES_VIEW_PANE_ID);
		const historyView = viewsRegistry.getView(HISTORY_VIEW_PANE_ID);

		assert.ok(changesView, 'Changes view should remain registered');
		assert.ok(repositoriesView, 'Repositories view should remain registered');
		assert.ok(historyView, 'Graph view should remain registered');

		assert.ok(changesView.when, 'Changes view should have a when clause');
		assert.ok(repositoriesView.when, 'Repositories view should have a when clause');
		assert.ok(historyView.when, 'Graph view should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		assert.strictEqual(
			evalWhen(changesView.when, defaultWindow),
			false,
			'default Code window must hide Source Control Changes from Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(changesView.when, agentsWindow),
			true,
			'Agents Window may show Source Control Changes in Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(repositoriesView.when, defaultWindow),
			false,
			'default Code window must hide Source Control Repositories from Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(repositoriesView.when, agentsWindow),
			false,
			'Repositories view remains provider-gated even in Agents Window'
		);
		assert.strictEqual(
			evalWhen(historyView.when, defaultWindow),
			false,
			'default Code window must hide Source Control Graph from Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(historyView.when, agentsWindow),
			false,
			'Graph view remains history-provider-gated even in Agents Window'
		);

		assert.ok(changesView.openCommandActionDescriptor?.keybindings?.when, 'Changes open command keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(changesView.openCommandActionDescriptor!.keybindings!.when, defaultWindow),
			false,
			'default Code window must hide Source Control keybinding'
		);
		assert.strictEqual(
			evalWhen(changesView.openCommandActionDescriptor!.keybindings!.when, agentsWindow),
			true,
			'Agents Window may keep Source Control keybinding'
		);
	});
});
