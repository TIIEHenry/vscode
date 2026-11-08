/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { GroupsOrder, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { SettingsEditor2Input } from '../../../services/preferences/common/preferencesEditorInput.js';
import { TestEditorGroupsService } from '../../../test/browser/workbenchTestServices.js';
import {
	UniverseAgentDeepLinkHandler,
	UNIVERSE_AGENT_SCHEME,
} from './universeAgentDeepLink.contribution.js';
import { UA_ENGINE_PANE_ID } from '../common/uaPreferencesPanes.js';

suite('UniverseAgentDeepLinkHandler', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHandler(
		preferencesService: IPreferencesService,
		editorGroupsService: IEditorGroupsService = new TestEditorGroupsService([]),
	) {
		const layoutService = {
			isVisible: () => false,
			setPartHidden: () => { },
		} as unknown as IWorkbenchLayoutService;

		return new UniverseAgentDeepLinkHandler(
			{ registerHandler: () => ({ dispose: () => { } }) } as never,
			editorGroupsService,
			preferencesService,
			layoutService,
		);
	}

	test('stale connection deep link does not override a newer engine deep link', async () => {
		const openPreferencesCalls: string[] = [];

		const preferencesService = {
			openSettings: async () => undefined,
			openPreferences: async (opts?: { paneId?: string }) => {
				openPreferencesCalls.push(opts?.paneId ?? '');
			},
		} as IPreferencesService;

		const handler = store.add(createHandler(preferencesService));

		await Promise.all([
			handler.handleURL(URI.parse(`${UNIVERSE_AGENT_SCHEME}://settings/connection`)),
			handler.handleURL(URI.parse(`${UNIVERSE_AGENT_SCHEME}://settings/engine`)),
		]);

		assert.deepStrictEqual(openPreferencesCalls, [UA_ENGINE_PANE_ID]);
	});

	test('dispose suppresses in-flight deep link navigation', async () => {
		let resolveSlowClose: () => void;
		const slowClose = new Promise<void>(resolve => {
			resolveSlowClose = resolve;
		});

		const settingsEditor = Object.create(SettingsEditor2Input.prototype) as SettingsEditor2Input;
		const editorGroupsService = {
			getGroups: (_order: GroupsOrder) => [{
				editors: [settingsEditor],
				closeEditor: async (editor: unknown) => {
					if (editor instanceof SettingsEditor2Input) {
						await slowClose;
					}
				},
			}],
		} as unknown as IEditorGroupsService;

		let openPreferencesCalls = 0;
		const preferencesService = {
			openSettings: async () => undefined,
			openPreferences: async () => {
				openPreferencesCalls++;
			},
		} as IPreferencesService;

		const handler = createHandler(preferencesService, editorGroupsService);
		const navigation = handler.handleURL(URI.parse(`${UNIVERSE_AGENT_SCHEME}://settings/connection`));
		handler.dispose();
		resolveSlowClose!();
		await navigation;

		assert.strictEqual(openPreferencesCalls, 0);
	});
});
