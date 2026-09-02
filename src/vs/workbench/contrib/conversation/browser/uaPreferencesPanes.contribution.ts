/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { GroupsOrder, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { Extensions, IPreferencesEditorPaneRegistry } from '../../../services/preferences/browser/preferencesEditorPaneRegistry.js';
import { IPreferencesService } from '../../../services/preferences/common/preferences.js';
import { PreferencesEditorInput } from '../../../services/preferences/common/preferencesEditorInput.js';
import {
	BACK_TO_CLIENT_SETTINGS_COMMAND_ID,
	UA_CONNECTION_PANE_ID,
	UA_CONNECTION_PANE_ORDER,
	UA_ENGINE_PANE_ID,
	UA_ENGINE_PANE_ORDER,
} from '../common/uaPreferencesPanes.js';
import './connectionHub.contribution.js';
import { ConnectionPreferencesPane } from './connectionPreferencesPane.js';
import { EnginePreferencesPane } from './enginePreferencesPane.js';

const preferencesEditorPaneRegistry = Registry.as<IPreferencesEditorPaneRegistry>(Extensions.PreferencesEditorPane);

preferencesEditorPaneRegistry.registerPreferencesEditorPane({
	id: UA_CONNECTION_PANE_ID,
	title: localize('ua.connectionPane', "Connection"),
	icon: Codicon.plug,
	order: UA_CONNECTION_PANE_ORDER,
	showBackToClientSettings: true,
	ctorDescriptor: new SyncDescriptor(ConnectionPreferencesPane),
});

preferencesEditorPaneRegistry.registerPreferencesEditorPane({
	id: UA_ENGINE_PANE_ID,
	title: localize('ua.enginePane', "Engine"),
	icon: Codicon.server,
	order: UA_ENGINE_PANE_ORDER,
	showBackToClientSettings: true,
	ctorDescriptor: new SyncDescriptor(EnginePreferencesPane),
});

registerAction2(class BackToClientSettingsAction extends Action2 {
	constructor() {
		super({
			id: BACK_TO_CLIENT_SETTINGS_COMMAND_ID,
			title: localize2('ua.backToClientSettings', "Back to Client Settings"),
			f1: false,
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorGroupsService = accessor.get(IEditorGroupsService);
		for (const group of editorGroupsService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
			for (const editor of [...group.editors]) {
				if (editor instanceof PreferencesEditorInput) {
					await group.closeEditor(editor);
				}
			}
		}

		await accessor.get(IPreferencesService).openSettings({ focusSearch: false });
	}
});
