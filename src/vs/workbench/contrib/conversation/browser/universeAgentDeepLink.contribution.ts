/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { UNIVERSE_AGENT_SCHEME } from '../../../../platform/product/common/universeAgentScheme.js';
import { IURLHandler, IURLService } from '../../../../platform/url/common/url.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { UA_CONNECTION_PANE_ID, UA_ENGINE_PANE_ID } from '../common/uaPreferencesPanes.js';
import { closeAllSettingsEditor2ForService, ensurePreviewVisibleForPreferences } from './uaPreferencesNavigation.js';

export { UNIVERSE_AGENT_SCHEME };

/** Bumped at the start of each deep-link navigation; stale async completions must not open a pane. */
let latestUniverseAgentDeepLinkNavigationEpoch = 0;

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
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();
		this._register(urlService.registerHandler(this));
	}

	async handleURL(uri: URI): Promise<boolean> {
		if (uri.scheme !== UNIVERSE_AGENT_SCHEME) {
			return false;
		}
		if (this._store.isDisposed) {
			return false;
		}

		const page = parseUniverseAgentSettingsPage(uri);
		const navigationEpoch = ++latestUniverseAgentDeepLinkNavigationEpoch;

		switch (page) {
			case 'connection':
				await this.openPreferencesPaneForDeepLink(navigationEpoch, UA_CONNECTION_PANE_ID);
				return true;
			case 'engine':
				await this.openPreferencesPaneForDeepLink(navigationEpoch, UA_ENGINE_PANE_ID);
				return true;
			case 'client':
				if (this.shouldApplyDeepLinkNavigation(navigationEpoch)) {
					await this.preferencesService.openSettings({ focusSearch: false });
				}
				return true;
			default:
				if (CLIENT_GROUP_ALIASES.has(page)) {
					if (this.shouldApplyDeepLinkNavigation(navigationEpoch)) {
						await this.preferencesService.openSettings({ focusSearch: false });
					}
					return true;
				}
				if (this.shouldApplyDeepLinkNavigation(navigationEpoch)) {
					await this.preferencesService.openSettings({ focusSearch: false });
				}
				return true;
		}
	}

	private shouldApplyDeepLinkNavigation(navigationEpoch: number): boolean {
		return !this._store.isDisposed && navigationEpoch === latestUniverseAgentDeepLinkNavigationEpoch;
	}

	private async openPreferencesPaneForDeepLink(navigationEpoch: number, paneId: string): Promise<void> {
		ensurePreviewVisibleForPreferences(this.layoutService);
		await closeAllSettingsEditor2ForService(this.editorGroupsService);
		if (!this.shouldApplyDeepLinkNavigation(navigationEpoch)) {
			return;
		}
		await this.preferencesService.openPreferences({ paneId });
	}
}

registerWorkbenchContribution2(UniverseAgentDeepLinkHandler.ID, UniverseAgentDeepLinkHandler, WorkbenchPhase.AfterRestored);
