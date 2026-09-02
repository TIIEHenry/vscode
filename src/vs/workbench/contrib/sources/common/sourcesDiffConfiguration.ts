/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

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
		},
	});
}
