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
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
	UA_CLIENT_STARTUP_RESTORE_LAST_SESSION,
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
			[UA_CLIENT_STARTUP_RESTORE_LAST_SESSION]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.startup.restoreLastSession',
					"Restore the last active Conversation session when this window starts (window scope). When off or the stored session id is invalid, the session list still loads and the first session becomes active. Applies on next window startup.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR]: {
				type: 'string',
				enum: ['send', 'newline'],
				default: 'send',
				enumDescriptions: [
					localize('ua.client.keyboardEnter.behavior.send', "Enter 发送，Shift+Enter 换行"),
					localize('ua.client.keyboardEnter.behavior.newline', "Enter 换行，Shift+Enter 发送"),
				],
				description: localize(
					'ua.client.keyboardEnter.behavior',
					"Choose whether Enter sends the Composer draft or inserts a newline (window scope). Shift+Enter performs the other action so both modes keep a keyboard-only send path. Applies immediately.",
				),
				scope: ConfigurationScope.WINDOW,
			},
		}
	});
}
