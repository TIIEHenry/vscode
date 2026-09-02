/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** CS-1…CS-4 registered Client settings (PRD-026). CS-5 keys are not declared until that slice. */
export const UA_CLIENT_DISPLAY_CONVERSATION_DENSITY = 'ua.client.display.conversationDensity';

export const UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS = 'ua.client.chatInput.restoreDrafts';
export const UA_CLIENT_CHAT_INPUT_AUTO_FOCUS = 'ua.client.chatInput.autoFocus';

export const UA_CLIENT_STARTUP_RESTORE_LAST_SESSION = 'ua.client.startup.restoreLastSession';
export const UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR = 'ua.client.keyboardEnter.behavior';

export const UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS = 'ua.client.notifications.permissionRequests';
export const UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED = 'ua.client.notifications.turnCompleted';

export const UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS = 'ua.client.permissions.openPendingOnFocus';

export type UaClientConversationDensity = 'comfortable' | 'compact';
export type UaClientKeyboardEnterBehavior = 'send' | 'newline';
