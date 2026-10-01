/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SOURCES_EDITOR_OPEN_MODE_SETTING } from '../../../services/editor/common/editorOpenSlot.js';
import { SOURCES_FILES_VIEW_MODE_SETTING } from './sourcesFilesViewMode.js';

export const SOURCES_DIFF_DEFAULT_OWNER_SETTING = 'sources.diff.defaultOwner';

export type SourcesDiffDefaultOwner = 'preview' | 'conversation' | 'panel';

export function registerSourcesDiffConfiguration(): void {
	const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	configurationRegistry.registerConfiguration({
		id: 'sourcesDiff',
		title: localize('sourcesDiffSettingsTitle', "Sources Diff"),
		type: 'object',
		properties: {
			[SOURCES_DIFF_DEFAULT_OWNER_SETTING]: {
				type: 'string',
				enum: ['preview', 'conversation', 'panel'],
				default: 'preview',
				description: localize(
					'sourcesDiffDefaultOwner',
					"Where to open a diff when clicking a Changes or Review row in Sources.",
				),
			},
			[SOURCES_EDITOR_OPEN_MODE_SETTING]: {
				type: 'string',
				enum: ['newTab', 'replace'],
				default: 'replace',
				enumDescriptions: [
					localize('sources.editorOpenMode.newTab', "Open the file or diff in a new tab in the current editor group."),
					localize('sources.editorOpenMode.replace', "Replace the current tab. A file that is already open is revealed instead."),
				],
				description: localize(
					'sources.editorOpenMode',
					"Controls whether a Sources row opens in a new tab or replaces the current tab. The other action stays in the row context menu.",
				),
			},
			[SOURCES_FILES_VIEW_MODE_SETTING]: {
				type: 'string',
				enum: ['tree', 'list'],
				default: 'tree',
				enumDescriptions: [
					localize('sources.files.viewMode.tree', "Group the search projection as a read-only folder tree."),
					localize('sources.files.viewMode.list', "List the folder of the file in the current Preview tab, one level only."),
				],
				description: localize(
					'sources.files.viewMode',
					"Controls whether Sources Files shows a folder tree or the current tab's folder. Opening a file from Sources does not move the Explorer.",
				),
			},
		},
	});
}
