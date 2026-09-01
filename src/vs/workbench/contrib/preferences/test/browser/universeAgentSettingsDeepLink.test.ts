/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IPreferencesService } from '../../../../services/preferences/common/preferences.js';
import { TestEditorGroupsService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { registerUaPreferencesNavigationActions } from '../../../conversation/browser/uaPreferencesNavigation.js';
import {
	parseUniverseAgentSettingsPage,
	UniverseAgentDeepLinkHandler,
	UNIVERSE_AGENT_SCHEME,
} from '../../../conversation/browser/universeAgentDeepLink.contribution.js';
import { UA_CONNECTION_PANE_ID, UA_ENGINE_PANE_ID } from '../../../conversation/common/uaPreferencesPanes.js';

suite('Universe Agent settings deep links', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHandler() {
		const openSettingsCalls: Array<{ focusSearch?: boolean; query?: string; revealSetting?: { key: string } }> = [];
		const openPreferencesCalls: Array<{ paneId?: string }> = [];

		const preferencesService = {
			openSettings: async (opts?: { focusSearch?: boolean; query?: string; revealSetting?: { key: string } }) => {
				openSettingsCalls.push(opts ?? {});
			},
			openPreferences: async (opts?: { paneId?: string }) => {
				openPreferencesCalls.push(opts ?? {});
			},
		} as IPreferencesService;

		const handler = store.add(new UniverseAgentDeepLinkHandler(
			{ registerHandler: () => ({ dispose: () => { } }) } as never,
			new TestEditorGroupsService([]),
			preferencesService,
		));

		return { handler, openSettingsCalls, openPreferencesCalls };
	}

	test('parseUniverseAgentSettingsPage resolves aliases', () => {
		assert.strictEqual(parseUniverseAgentSettingsPage(URI.parse('universe-agent://settings/connection')), 'connection');
		assert.strictEqual(parseUniverseAgentSettingsPage(URI.parse('universe-agent://connection')), 'connection');
		assert.strictEqual(parseUniverseAgentSettingsPage(URI.parse('universe-agent://settings/engine')), 'engine');
		assert.strictEqual(parseUniverseAgentSettingsPage(URI.parse('universe-agent://settings')), 'client');
		assert.strictEqual(parseUniverseAgentSettingsPage(URI.parse('universe-agent://settings/client')), 'client');
		assert.strictEqual(parseUniverseAgentSettingsPage(URI.parse('universe-agent://settings/display')), 'display');
		assert.strictEqual(parseUniverseAgentSettingsPage(URI.parse('universe-agent://settings/unknown')), 'unknown');
	});

	test('connection deep link opens Preferences Connection pane', async () => {
		const { handler, openPreferencesCalls, openSettingsCalls } = createHandler();
		const handled = await handler.handleURL(URI.parse(`${UNIVERSE_AGENT_SCHEME}://settings/connection`));
		assert.strictEqual(handled, true);
		assert.strictEqual(openPreferencesCalls.length, 1);
		assert.strictEqual(openPreferencesCalls[0].paneId, UA_CONNECTION_PANE_ID);
		assert.strictEqual(openSettingsCalls.length, 0);
	});

	test('engine deep link opens Preferences Engine pane', async () => {
		const { handler, openPreferencesCalls } = createHandler();
		const handled = await handler.handleURL(URI.parse(`${UNIVERSE_AGENT_SCHEME}://settings/engine`));
		assert.strictEqual(handled, true);
		assert.strictEqual(openPreferencesCalls.length, 1);
		assert.strictEqual(openPreferencesCalls[0].paneId, UA_ENGINE_PANE_ID);
	});

	test('settings/unknown opens Client Settings without revealSetting or Preferences', async () => {
		const { handler, openSettingsCalls, openPreferencesCalls } = createHandler();
		const handled = await handler.handleURL(URI.parse(`${UNIVERSE_AGENT_SCHEME}://settings/unknown`));
		assert.strictEqual(handled, true);
		assert.strictEqual(openSettingsCalls.length, 1);
		assert.strictEqual(openSettingsCalls[0].query, undefined);
		assert.strictEqual(openSettingsCalls[0].revealSetting, undefined);
		assert.strictEqual(openPreferencesCalls.length, 0);
	});

	test('client group alias opens Client Settings without scrolling', async () => {
		const { handler, openSettingsCalls, openPreferencesCalls } = createHandler();
		await handler.handleURL(URI.parse(`${UNIVERSE_AGENT_SCHEME}://settings/display`));
		assert.strictEqual(openSettingsCalls.length, 1);
		assert.strictEqual(openSettingsCalls[0].revealSetting, undefined);
		assert.strictEqual(openPreferencesCalls.length, 0);
	});
});

suite('Open Connection Preferences action', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('workbench.action.openConnectionPreferences calls openPreferences with ua.connection', async () => {
		registerUaPreferencesNavigationActions();

		let openPreferencesPaneId: string | undefined;
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IPreferencesService, {
			openPreferences: async (options?: { paneId?: string }) => {
				openPreferencesPaneId = options?.paneId;
			},
			openSettings: async () => undefined,
		} as IPreferencesService);

		const command = CommandsRegistry.getCommand('workbench.action.openConnectionPreferences');
		assert.ok(command);

		await instantiationService.invokeFunction(accessor => command!.handler(accessor));
		assert.strictEqual(openPreferencesPaneId, UA_CONNECTION_PANE_ID);
	});
});
