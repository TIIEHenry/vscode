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
	UA_CLIENT_CLIENT_TOOLS_ADVERTISE_WORKSPACE_TOOLS,
	UA_CLIENT_CLIENT_TOOLS_SHOW_INVOCATION_DETAILS,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	UA_CLIENT_DISPLAY_SHOW_AGENT_IDENTITY,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
	UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS,
	UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED,
	UA_CLIENT_PERMISSIONS_CONFIRM_BEFORE_EXTERNAL_OPEN,
	UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS,
	UA_CLIENT_STARTUP_OPEN_CONVERSATION,
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
					localize('ua.client.display.conversationDensity.comfortable', "More spacing between timeline rows and process folds."),
					localize('ua.client.display.conversationDensity.compact', "Tighter timeline and process-fold density."),
				],
				description: localize(
					'ua.client.display.conversationDensity',
					"Controls Conversation timeline row spacing. Applies immediately in open Conversation views.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_DISPLAY_SHOW_AGENT_IDENTITY]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.display.showAgentIdentity',
					"Show identity labels for non-root agents in the Conversation timeline. Role and permission information remain visible.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.chatInput.restoreDrafts',
					"Restore unsent Composer drafts per workspace and session. Draft text is stored locally and does not sync through Settings Sync.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_CHAT_INPUT_AUTO_FOCUS]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.chatInput.autoFocus',
					"Focus the Composer when opening or switching Conversation.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_STARTUP_OPEN_CONVERSATION]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.startup.openConversation',
					"Show the Conversation part after the default window starts.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_STARTUP_RESTORE_LAST_SESSION]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.startup.restoreLastSession',
					"Restore the last active session on startup. If restoration fails, the first roster session is selected.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR]: {
				type: 'string',
				enum: ['send', 'newline'],
				default: 'send',
				enumDescriptions: [
					localize('ua.client.keyboardEnter.send', "Enter sends; Shift+Enter inserts a new line."),
					localize('ua.client.keyboardEnter.newline', "Enter inserts a new line; Shift+Enter sends."),
				],
				description: localize(
					'ua.client.keyboardEnter.behavior',
					"Primary Enter action in the Conversation Composer. The alternate action is always available with Shift+Enter.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.notifications.permissionRequests',
					"Show a native notification when a background session has a pending permission or question.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED]: {
				type: 'boolean',
				default: false,
				description: localize(
					'ua.client.notifications.turnCompleted',
					"Show a native notification when a background session completes a turn.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.permissions.openPendingOnFocus',
					"When returning to a session, scroll to the first pending permission seat. Does not auto-approve.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_PERMISSIONS_CONFIRM_BEFORE_EXTERNAL_OPEN]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.permissions.confirmBeforeExternalOpen',
					"Ask for confirmation before opening external URLs from Conversation links.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_CLIENT_TOOLS_ADVERTISE_WORKSPACE_TOOLS]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.clientTools.advertiseWorkspaceTools',
					"Advertise IDE workspace tools to a connected Engine. Engine capability and per-call permission checks still apply.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
			[UA_CLIENT_CLIENT_TOOLS_SHOW_INVOCATION_DETAILS]: {
				type: 'boolean',
				default: true,
				description: localize(
					'ua.client.clientTools.showInvocationDetails',
					"Show client-tool parameter and result details in the Trajectory lens.",
				),
				scope: ConfigurationScope.APPLICATION,
			},
		}
	});
}
