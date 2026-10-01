/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action } from '../../../../base/common/actions.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { alternateEditorOpenSlot, EditorOpenSlot, readEditorOpenSlot, SOURCES_EDITOR_OPEN_MODE_SETTING } from '../../../services/editor/common/editorOpenSlot.js';

export function sourcesEditorOpenSlot(configurationService: IConfigurationService): EditorOpenSlot {
	return readEditorOpenSlot(configurationService.getValue(SOURCES_EDITOR_OPEN_MODE_SETTING), 'replace');
}

export function sourcesAlternateOpenLabel(slot: EditorOpenSlot): string {
	return slot === 'newTab'
		? localize('sources.openInNewTab', "Open in New Tab")
		: localize('sources.replaceCurrentTab', "Replace Current Tab");
}

export function sourcesAlternateOpenAction(current: EditorOpenSlot, run: (slot: EditorOpenSlot) => void): Action {
	const alternate = alternateEditorOpenSlot(current);
	return new Action(
		alternate === 'newTab' ? 'sources.openInNewTab' : 'sources.replaceActiveEditor',
		sourcesAlternateOpenLabel(alternate),
		undefined,
		true,
		() => { run(alternate); },
	);
}
