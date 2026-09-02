/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** M7 Client settings key SSOT (PRD-026 closed set). */
export const UA_CLIENT_DISPLAY_CONVERSATION_DENSITY = 'ua.client.display.conversationDensity';
export const UA_CLIENT_DISPLAY_SHOW_AGENT_IDENTITY = 'ua.client.display.showAgentIdentity';

export const UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS = 'ua.client.chatInput.restoreDrafts';
export const UA_CLIENT_CHAT_INPUT_AUTO_FOCUS = 'ua.client.chatInput.autoFocus';

export const UA_CLIENT_STARTUP_OPEN_CONVERSATION = 'ua.client.startup.openConversation';
export const UA_CLIENT_STARTUP_RESTORE_LAST_SESSION = 'ua.client.startup.restoreLastSession';

export const UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR = 'ua.client.keyboardEnter.behavior';

export const UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS = 'ua.client.notifications.permissionRequests';
export const UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED = 'ua.client.notifications.turnCompleted';

export const UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS = 'ua.client.permissions.openPendingOnFocus';
export const UA_CLIENT_PERMISSIONS_CONFIRM_BEFORE_EXTERNAL_OPEN = 'ua.client.permissions.confirmBeforeExternalOpen';

export const UA_CLIENT_CLIENT_TOOLS_ADVERTISE_WORKSPACE_TOOLS = 'ua.client.clientTools.advertiseWorkspaceTools';
export const UA_CLIENT_CLIENT_TOOLS_SHOW_INVOCATION_DETAILS = 'ua.client.clientTools.showInvocationDetails';

export type UaClientConversationDensity = 'comfortable' | 'compact';
export type UaClientKeyboardEnterBehavior = 'send' | 'newline';
