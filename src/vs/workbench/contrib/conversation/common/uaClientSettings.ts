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
	UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS,
	UA_CLIENT_CONVERSATION_DENSITY_VALUES,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES,
	UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS,
	UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED,
	UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS,
	UA_CLIENT_STARTUP_RESTORE_LAST_SESSION,
} from './uaClientSettingsKeys.js';

export function registerUaClientSettings(): void {
	const conversationDensityComfortable = localize('ua.client.display.conversationDensity.comfortable', "舒适：默认行距");
	const conversationDensityCompact = localize('ua.client.display.conversationDensity.compact', "紧凑：更小行距与过程折间距");
	const keyboardEnterSend = localize('ua.client.keyboardEnter.behavior.send', "Enter 发送，Shift+Enter 换行");
	const keyboardEnterNewline = localize('ua.client.keyboardEnter.behavior.newline', "Enter 换行，Shift+Enter 发送");
	const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
	configurationRegistry.registerConfiguration({
		id: 'uaClient',
		title: localize('uaClientSettingsTitle', "Client"),
		type: 'object',
		properties: {
			[UA_CLIENT_DISPLAY_CONVERSATION_DENSITY]: {
				type: 'string',
				enum: [...UA_CLIENT_CONVERSATION_DENSITY_VALUES],
				default: 'comfortable',
				enumDescriptions: [
					conversationDensityComfortable,
					conversationDensityCompact,
				],
				keywords: [
					conversationDensityComfortable,
					conversationDensityCompact,
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
				keywords: [localize('ua.client.chatInput.restoreDrafts.keyword', "草稿")],
				description: localize(
					'ua.client.chatInput.restoreDrafts',
					"Restore unsent Composer drafts per workspace, session, and chat (window scope). Draft text is stored locally on this machine and does not sync through Settings Sync. Applies immediately.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_CHAT_INPUT_AUTO_FOCUS]: {
				type: 'boolean',
				default: true,
				keywords: [localize('ua.client.chatInput.autoFocus.keyword', "聚焦")],
				description: localize(
					'ua.client.chatInput.autoFocus',
					"Focus the Composer textarea when opening or returning to Conversation (window scope). Applies immediately. Turning this off does not skip the rest of Conversation focus handling.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_STARTUP_RESTORE_LAST_SESSION]: {
				type: 'boolean',
				default: true,
				keywords: [localize('ua.client.startup.restoreLastSession.keyword', "恢复会话")],
				description: localize(
					'ua.client.startup.restoreLastSession',
					"Restore the last active Conversation session when this window starts (window scope). When off or the stored session id is invalid, the session list still loads and the first session becomes active. Applies on next window startup.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR]: {
				type: 'string',
				enum: [...UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES],
				default: 'send',
				enumDescriptions: [
					keyboardEnterSend,
					keyboardEnterNewline,
				],
				keywords: [
					keyboardEnterSend,
					keyboardEnterNewline,
				],
				description: localize(
					'ua.client.keyboardEnter.behavior',
					"Choose whether Enter sends the Composer draft or inserts a newline (window scope). Shift+Enter performs the other action so both modes keep a keyboard-only send path. Applies immediately.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS]: {
				type: 'boolean',
				default: true,
				keywords: [localize('ua.client.notifications.permissionRequests.keyword', "权限通知")],
				description: localize(
					'ua.client.notifications.permissionRequests',
					"Show a window toast when an inactive session gets a permission or question seat (window scope). A session is inactive when it is not the active session or Conversation is hidden. Click the toast to open that session and locate the seat. Does not grant, deny, Allow, or Skip. Applies immediately. Not an operating-system notification.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED]: {
				type: 'boolean',
				default: false,
				keywords: [localize('ua.client.notifications.turnCompleted.keyword', "回合完成")],
				description: localize(
					'ua.client.notifications.turnCompleted',
					"Show a window toast when an inactive engine session finishes a turn (window scope). A session is inactive when it is not the active session or Conversation is hidden. Local stub sessions do not produce this toast. Applies immediately. Not an operating-system notification.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS]: {
				type: 'boolean',
				default: true,
				keywords: [localize('ua.client.permissions.openPendingOnFocus.keyword', "待确认")],
				description: localize(
					'ua.client.permissions.openPendingOnFocus',
					"When returning to Conversation (switching session or focusing the Conversation part), scroll to the first pending permission or question seat if one exists (window scope). Does not grant, deny, Allow, or Skip. Applies immediately.",
				),
				scope: ConfigurationScope.WINDOW,
			},
			[UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS]: {
				type: 'boolean',
				default: true,
				keywords: [localize('ua.client.clientTools.showToolInvocationDetails.keyword', "工具详情")],
				description: localize(
					'ua.client.clientTools.showToolInvocationDetails',
					"Show argument and result details on every process-fold tool row, including client-tool rows (window scope). After projection, tool rows are not split into client-tool vs Engine tool. Turning this off shows only the tool name and status and does not make the row expandable. Applies immediately in open Conversation views. Does not change whether Engine tools are available or granted.",
				),
				scope: ConfigurationScope.WINDOW,
			},
		}
	});
}
