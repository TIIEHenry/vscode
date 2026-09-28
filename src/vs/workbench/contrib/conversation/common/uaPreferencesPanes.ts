/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { UA_CLIENT_DISPLAY_CONVERSATION_DENSITY } from './uaClientSettingsKeys.js';

export const UA_CONNECTION_PANE_ID = 'ua.connection';
export const UA_ENGINE_PANE_ID = 'ua.engine';

export const UA_CONNECTION_PANE_ORDER = 10;
export const UA_ENGINE_PANE_ORDER = 20;

export const BACK_TO_CLIENT_SETTINGS_COMMAND_ID = 'workbench.action.backToClientSettings';
export const OPEN_CONNECTION_PREFERENCES_COMMAND_ID = 'workbench.action.openConnectionPreferences';
export const OPEN_ENGINE_PREFERENCES_COMMAND_ID = 'workbench.action.openEnginePreferences';

/** Connection pane zone opened from a non-live engine chip. */
export const CONNECTION_PROFILES_ZONE = 'profiles';

const connectionProfilesRevealListeners = new Set<() => void>();

/** Fired after Connection preferences is open, so a live pane can select Connection profiles. */
export function onDidRevealConnectionProfiles(listener: () => void): { dispose(): void } {
	connectionProfilesRevealListeners.add(listener);
	return {
		dispose: () => {
			connectionProfilesRevealListeners.delete(listener);
		},
	};
}

export function revealConnectionProfilesZone(): void {
	for (const listener of [...connectionProfilesRevealListeners]) {
		listener();
	}
}

/** Settings UI query that lands on the Client group, not Commonly Used. */
export const BACK_TO_CLIENT_SETTINGS_QUERY = `@id:${UA_CLIENT_DISPLAY_CONVERSATION_DENSITY}`;

export function getBackToClientSettingsOpenOptions(): { readonly focusSearch: false; readonly query: string } {
	return {
		focusSearch: false,
		query: BACK_TO_CLIENT_SETTINGS_QUERY,
	};
}
