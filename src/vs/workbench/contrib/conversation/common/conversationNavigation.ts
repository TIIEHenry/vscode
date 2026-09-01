/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Extensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';

export const CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING = 'conversation.navigate.closeChildOnBack';

export function registerConversationNavigationConfiguration(): void {
	const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	configurationRegistry.registerConfiguration({
		id: 'conversationNavigation',
		title: localize('conversationNavigationSettingsTitle', "Conversation Navigation"),
		type: 'object',
		properties: {
			[CONVERSATION_CLOSE_CHILD_ON_BACK_SETTING]: {
				type: 'boolean',
				default: true,
				description: localize(
					'conversationNavigateCloseChildOnBack',
					"When enabled, navigating back in a conversation session window closes extension chat tabs or agent dialogs instead of leaving them open.",
				),
			},
		},
	});
}
