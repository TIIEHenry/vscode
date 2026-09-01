/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IURLHandler, IURLService } from '../../../../platform/url/common/url.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { UA_CONNECTION_PANE_ID, UA_ENGINE_PANE_ID } from '../common/uaPreferencesPanes.js';
import { closeAllSettingsEditor2ForService } from './uaPreferencesNavigation.js';

export const UNIVERSE_AGENT_SCHEME = 'universe-agent';

const CLIENT_GROUP_ALIASES = new Set([
	'display',
	'chat-input',
	'chatinput',
	'startup',
	'keyboard-enter',
	'keyboardenter',
	'notifications',
	'permissions',
	'client-tools',
	'clienttools',
]);

export function parseUniverseAgentSettingsPage(uri: URI): string {
	let path = uri.path.replace(/\/+$/, '').replace(/^\/+/, '').toLowerCase().trim();

	if (path.startsWith('settings/')) {
		path = path.slice('settings/'.length);
	} else if (path === 'settings' || path === '') {
		if (uri.authority && uri.authority !== 'settings') {
			return uri.authority.toLowerCase();
		}
		return 'client';
	}

	if (!path && uri.authority && uri.authority !== 'settings') {
		return uri.authority.toLowerCase();
	}

	return path || 'client';
}

export class UniverseAgentDeepLinkHandler extends Disposable implements IWorkbenchContribution, IURLHandler {

	static readonly ID = 'workbench.contrib.universeAgentDeepLink';

	constructor(
		@IURLService urlService: IURLService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IPreferencesService private readonly preferencesService: IPreferencesService,
	) {
		super();
		this._register(urlService.registerHandler(this));
	}

	async handleURL(uri: URI): Promise<boolean> {
		if (uri.scheme !== UNIVERSE_AGENT_SCHEME) {
			return false;
		}

		const page = parseUniverseAgentSettingsPage(uri);

		switch (page) {
			case 'connection':
				await closeAllSettingsEditor2ForService(this.editorGroupsService);
				await this.preferencesService.openPreferences({ paneId: UA_CONNECTION_PANE_ID });
				return true;
			case 'engine':
				await closeAllSettingsEditor2ForService(this.editorGroupsService);
				await this.preferencesService.openPreferences({ paneId: UA_ENGINE_PANE_ID });
				return true;
			case 'client':
				await this.preferencesService.openSettings({ focusSearch: false });
				return true;
			default:
				if (CLIENT_GROUP_ALIASES.has(page)) {
					await this.preferencesService.openSettings({ focusSearch: false });
					return true;
				}
				await this.preferencesService.openSettings({ focusSearch: false });
				return true;
		}
	}
}

registerWorkbenchContribution2(UniverseAgentDeepLinkHandler.ID, UniverseAgentDeepLinkHandler, WorkbenchPhase.AfterRestored);
