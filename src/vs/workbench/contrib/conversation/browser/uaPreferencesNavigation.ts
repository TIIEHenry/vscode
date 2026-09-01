/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { GroupsOrder, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { SettingsEditor2Input } from '../../../services/preferences/common/preferencesEditorInput.js';
import {
	OPEN_CONNECTION_PREFERENCES_COMMAND_ID,
	OPEN_ENGINE_PREFERENCES_COMMAND_ID,
	UA_CONNECTION_PANE_ID,
	UA_ENGINE_PANE_ID,
} from '../common/uaPreferencesPanes.js';

export async function closeAllSettingsEditor2ForService(editorGroupsService: IEditorGroupsService): Promise<void> {
	for (const group of editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
		for (const editor of [...group.editors]) {
			if (editor instanceof SettingsEditor2Input) {
				await group.closeEditor(editor);
			}
		}
	}
}

export async function closeAllSettingsEditor2(accessor: ServicesAccessor): Promise<void> {
	await closeAllSettingsEditor2ForService(accessor.get(IEditorGroupsService));
}

export async function openUaPaneReplacingClientSettings(accessor: ServicesAccessor, paneId: string): Promise<void> {
	await closeAllSettingsEditor2(accessor);
	await accessor.get(IPreferencesService).openPreferences({ paneId });
}

export function registerUaPreferencesNavigationActions(): void {
	registerAction2(class OpenConnectionPreferencesAction extends Action2 {
		constructor() {
			super({
				id: OPEN_CONNECTION_PREFERENCES_COMMAND_ID,
				title: localize2('openConnectionPreferences', "Open Connection Preferences"),
				f1: false,
			});
		}

		override run(accessor: ServicesAccessor): Promise<void> {
			return openUaPaneReplacingClientSettings(accessor, UA_CONNECTION_PANE_ID);
		}
	});

	registerAction2(class OpenEnginePreferencesAction extends Action2 {
		constructor() {
			super({
				id: OPEN_ENGINE_PREFERENCES_COMMAND_ID,
				title: localize2('openEnginePreferences', "Open Engine Preferences"),
				f1: false,
			});
		}

		override run(accessor: ServicesAccessor): Promise<void> {
			return openUaPaneReplacingClientSettings(accessor, UA_ENGINE_PANE_ID);
		}
	});
}
