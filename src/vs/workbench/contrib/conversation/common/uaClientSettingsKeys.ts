/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** CS-1/CS-2 registered Client settings (PRD-026). CS-3…CS-5 keys are not declared until those slices. */
export const UA_CLIENT_DISPLAY_CONVERSATION_DENSITY = 'ua.client.display.conversationDensity';

export const UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS = 'ua.client.chatInput.restoreDrafts';
export const UA_CLIENT_CHAT_INPUT_AUTO_FOCUS = 'ua.client.chatInput.autoFocus';

export const UA_CLIENT_STARTUP_RESTORE_LAST_SESSION = 'ua.client.startup.restoreLastSession';
export const UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR = 'ua.client.keyboardEnter.behavior';

export type UaClientConversationDensity = 'comfortable' | 'compact';
export type UaClientKeyboardEnterBehavior = 'send' | 'newline';
