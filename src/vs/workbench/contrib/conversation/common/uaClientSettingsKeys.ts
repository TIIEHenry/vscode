/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** CS-1…CS-5 registered Client settings (PRD-026). CS-6 adds migration / emptyCopy closeout. */
export const UA_CLIENT_DISPLAY_CONVERSATION_DENSITY = 'ua.client.display.conversationDensity';

export const UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS = 'ua.client.chatInput.restoreDrafts';
export const UA_CLIENT_CHAT_INPUT_AUTO_FOCUS = 'ua.client.chatInput.autoFocus';

export const UA_CLIENT_STARTUP_RESTORE_LAST_SESSION = 'ua.client.startup.restoreLastSession';
export const UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR = 'ua.client.keyboardEnter.behavior';

export const UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS = 'ua.client.notifications.permissionRequests';
export const UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED = 'ua.client.notifications.turnCompleted';

export const UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS = 'ua.client.permissions.openPendingOnFocus';

export const UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS = 'ua.client.clientTools.showToolInvocationDetails';

export const UA_CLIENT_CONVERSATION_DENSITY_VALUES = ['comfortable', 'compact'] as const;
export const UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES = ['send', 'newline'] as const;

export type UaClientConversationDensity = typeof UA_CLIENT_CONVERSATION_DENSITY_VALUES[number];
export type UaClientKeyboardEnterBehavior = typeof UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR_VALUES[number];

/** Closed 9-key whitelist. Do not register a 10th key or any removed key. */
export const UA_CLIENT_REGISTERED_SETTING_KEYS = [
	UA_CLIENT_CHAT_INPUT_AUTO_FOCUS,
	UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS,
	UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
	UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS,
	UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED,
	UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS,
	UA_CLIENT_STARTUP_RESTORE_LAST_SESSION,
] as const;

/** Deleted during CS review — migrate out of settings.json; never re-register. */
export const UA_CLIENT_REMOVED_SETTING_KEYS = [
	'ua.client.clientTools.advertiseWorkspaceTools',
	'ua.client.display.showAgentIdentity',
	'ua.client.permissions.confirmBeforeExternalOpen',
	'ua.client.startup.openConversation',
] as const;
