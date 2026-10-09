/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import {
	CONNECTION_PROFILES_ZONE,
	ENGINE_TOOLS_ZONE,
	onDidRevealConnectionProfiles,
	onDidRevealEngineTools,
	OPEN_CONNECTION_PREFERENCES_COMMAND_ID,
	OPEN_ENGINE_PREFERENCES_COMMAND_ID,
	UA_CONNECTION_PANE_ID,
	UA_ENGINE_PANE_ID,
} from '../common/uaPreferencesPanes.js';
import { registerUaPreferencesNavigationActions } from './uaPreferencesNavigation.js';

suite('uaPreferencesNavigation', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('openUaPaneReplacingClientSettings reveals profiles only for the latest navigation', async () => {
		registerUaPreferencesNavigationActions();

		let resolveSlowOpen: () => void;
		const slowOpen = new Promise<void>(resolve => {
			resolveSlowOpen = resolve;
		});
		let openCallCount = 0;

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWorkbenchLayoutService, {
			isVisible: () => true,
			setPartHidden: () => { },
		} as unknown as IWorkbenchLayoutService);
		instantiationService.stub(IPreferencesService, {
			openPreferences: async () => {
				openCallCount++;
				if (openCallCount === 1) {
					await slowOpen;
				}
			},
			openSettings: async () => undefined,
		} as IPreferencesService);

		let revealCount = 0;
		const listener = onDidRevealConnectionProfiles(() => {
			revealCount++;
		});
		store.add(listener);

		const connectionCommand = CommandsRegistry.getCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		const engineCommand = CommandsRegistry.getCommand(OPEN_ENGINE_PREFERENCES_COMMAND_ID);
		assert.ok(connectionCommand);
		assert.ok(engineCommand);

		const slowProfiles = instantiationService.invokeFunction(accessor =>
			connectionCommand!.handler(accessor, CONNECTION_PROFILES_ZONE));
		const fastEngine = instantiationService.invokeFunction(accessor => engineCommand!.handler(accessor));

		await fastEngine;
		resolveSlowOpen!();
		await slowProfiles;

		assert.strictEqual(revealCount, 0);
	});

	test('openConnectionPreferences with profiles reveals after the pane opens', async () => {
		registerUaPreferencesNavigationActions();

		let revealCount = 0;
		const listener = onDidRevealConnectionProfiles(() => {
			revealCount++;
		});
		store.add(listener);

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWorkbenchLayoutService, {
			isVisible: () => true,
			setPartHidden: () => { },
		} as unknown as IWorkbenchLayoutService);
		instantiationService.stub(IPreferencesService, {
			openPreferences: async (options?: { paneId?: string }) => {
				assert.strictEqual(options?.paneId, UA_CONNECTION_PANE_ID);
			},
			openSettings: async () => undefined,
		} as IPreferencesService);

		const connectionCommand = CommandsRegistry.getCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		assert.ok(connectionCommand);
		await instantiationService.invokeFunction(accessor => connectionCommand!.handler(accessor, CONNECTION_PROFILES_ZONE));

		assert.strictEqual(revealCount, 1);
	});

	test('openEnginePreferences with tools reveals the Tools section after the pane opens', async () => {
		registerUaPreferencesNavigationActions();

		let revealCount = 0;
		const listener = onDidRevealEngineTools(() => {
			revealCount++;
		});
		store.add(listener);

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IWorkbenchLayoutService, {
			isVisible: () => true,
			setPartHidden: () => { },
		} as unknown as IWorkbenchLayoutService);
		instantiationService.stub(IPreferencesService, {
			openPreferences: async (options?: { paneId?: string }) => {
				assert.strictEqual(options?.paneId, UA_ENGINE_PANE_ID);
			},
			openSettings: async () => undefined,
		} as IPreferencesService);

		const engineCommand = CommandsRegistry.getCommand(OPEN_ENGINE_PREFERENCES_COMMAND_ID);
		assert.ok(engineCommand);
		await instantiationService.invokeFunction(accessor => engineCommand!.handler(accessor, ENGINE_TOOLS_ZONE));

		assert.strictEqual(revealCount, 1);
	});
});
