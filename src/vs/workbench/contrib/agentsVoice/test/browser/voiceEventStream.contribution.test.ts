/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { VoiceEventStreamViewPane } from '../../browser/transcriptsView/voiceEventStreamView.js';

import '../../browser/transcriptsView/voiceEventStream.contribution.js';

const CONTAINER_ID = 'workbench.view.voiceEventStreamContainer';
const SHOW_VIEW_COMMAND_ID = 'agentsVoice.showEventStream';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function findCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const defaultWindow: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: true,
};

suite('VoiceEventStreamContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Voice Event Stream sidebar view is gated to Agents Window', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const viewContainer = viewContainersRegistry.get(CONTAINER_ID);
		assert.ok(viewContainer, 'Voice Event Stream view container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Voice Event Stream sidebar container should hide when empty');
		assert.strictEqual(viewContainer.order, 11, 'Voice Event Stream sidebar container should keep order 11');

		const view = viewsRegistry.getView(VoiceEventStreamViewPane.ID);
		assert.ok(view, 'Voice Event Stream view should remain registered');
		assert.ok(view.when, 'Voice Event Stream view should have a when clause');

		const defaultWindowShowRequested = {
			[IsSessionsWindowContext.key]: false,
			'voiceEventStream.showView': true,
		};
		const agentsWindowHidden = {
			[IsSessionsWindowContext.key]: true,
			'voiceEventStream.showView': false,
		};
		const agentsWindowShowRequested = {
			[IsSessionsWindowContext.key]: true,
			'voiceEventStream.showView': true,
		};

		assert.strictEqual(
			evalWhen(view.when, defaultWindowShowRequested),
			false,
			'default Code window must hide Voice Event Stream from Activity sidebar even when showView is true'
		);
		assert.strictEqual(
			evalWhen(view.when, agentsWindowHidden),
			false,
			'Agents Window hides Voice Event Stream until showView is set'
		);
		assert.strictEqual(
			evalWhen(view.when, agentsWindowShowRequested),
			true,
			'Agents Window may show Voice Event Stream in Activity sidebar when showView is true'
		);
	});

	test('Show Voice Event Stream F1 command stays in Command Palette for Agents Window only', () => {
		const item = findCommandPaletteItem(SHOW_VIEW_COMMAND_ID);
		assert.ok(item, `${SHOW_VIEW_COMMAND_ID} should remain registered for Agents Window`);
		assert.ok(item.when, `${SHOW_VIEW_COMMAND_ID} Command Palette item should have a when clause`);

		assert.strictEqual(
			evalWhen(item.when, defaultWindow),
			false,
			'default Code window must hide Show Voice Event Stream in Command Palette'
		);
		assert.strictEqual(
			evalWhen(item.when, agentsWindow),
			true,
			'Agents Window may list Show Voice Event Stream in Command Palette'
		);
	});
});
