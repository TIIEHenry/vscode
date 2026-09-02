/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Extensions, IConfigurationRegistry, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	UA_CLIENT_CHAT_INPUT_AUTO_FOCUS,
	UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
} from './uaClientSettingsKeys.js';

export function registerUaClientSettings(): void {
	const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	configurationRegistry.registerConfiguration({
		id: 'uaClient',
		title: localize('uaClientSettingsTitle', "Client"),
		type: 'object',
		properties: {
			[UA_CLIENT_DISPLAY_CONVERSATION_DENSITY]: {
				type: 'string',
				enum: ['comfortable', 'compact'],
				default: 'comfortable',
				enumDescriptions: [
					localize('ua.client.display.conversationDensity.comfortable', "舒适：默认行距"),
					localize('ua.client.display.conversationDensity.compact', "紧凑：更小行距与过程折间距"),
				],
				description: localize(
					'ua.client.display.conversationDensity',
					"Conversation timeline and process-fold row spacing (window scope). Applies immediately in open Conversation views.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.chatInput.restoreDrafts',
					"Restore unsent Composer drafts per workspace, session, and chat (window scope). Draft text is stored locally on this machine and does not sync through Settings Sync. Applies immediately.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_CHAT_INPUT_AUTO_FOCUS]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.chatInput.autoFocus',
					"Focus the Composer textarea when opening or returning to Conversation (window scope). Applies immediately. Turning this off does not skip the rest of Conversation focus handling.",
				),
				scope: ConfigurationScope.WINDOW,
			},
		}
	});
}
