/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
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
	type UaClientConversationDensity,
	type UaClientKeyboardEnterBehavior,
} from './uaClientSettingsKeys.js';

export {
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
	UA_CLIENT_CLIENT_TOOLS_SHOW_INVOCATION_DETAILS,
	UA_CLIENT_DISPLAY_SHOW_AGENT_IDENTITY,
};

export const UA_CLIENT_CONVERSATION_DENSITY_CLASS = 'conversation-lens-density';
export const UA_CLIENT_CONVERSATION_DENSITY_COMPACT_CLASS = 'conversation-lens-density--compact';

export function getUaClientConversationDensity(configurationService: IConfigurationService): UaClientConversationDensity {
	const value = configurationService.getValue<string>(UA_CLIENT_DISPLAY_CONVERSATION_DENSITY);
	return value === 'compact' ? 'compact' : 'comfortable';
}

export function shouldShowAgentIdentity(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_DISPLAY_SHOW_AGENT_IDENTITY) !== false;
}

export function shouldRestoreComposerDrafts(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS) !== false;
}

export function shouldAutoFocusComposer(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_CHAT_INPUT_AUTO_FOCUS) !== false;
}

export function shouldOpenConversationOnStartup(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_STARTUP_OPEN_CONVERSATION) !== false;
}

export function shouldRestoreLastSessionOnStartup(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_STARTUP_RESTORE_LAST_SESSION) !== false;
}

export function getUaClientKeyboardEnterBehavior(configurationService: IConfigurationService): UaClientKeyboardEnterBehavior {
	const value = configurationService.getValue<string>(UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR);
	return value === 'newline' ? 'newline' : 'send';
}

export function shouldNotifyPermissionRequests(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS) !== false;
}

export function shouldNotifyTurnCompleted(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED) === true;
}

export function shouldOpenPendingOnFocus(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS) !== false;
}

export function shouldConfirmBeforeExternalOpen(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_PERMISSIONS_CONFIRM_BEFORE_EXTERNAL_OPEN) !== false;
}

export function shouldAdvertiseWorkspaceTools(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_CLIENT_TOOLS_ADVERTISE_WORKSPACE_TOOLS) !== false;
}

export function shouldShowClientToolInvocationDetails(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_CLIENT_TOOLS_SHOW_INVOCATION_DETAILS) !== false;
}

export function applyConversationDensityClass(host: HTMLElement, configurationService: IConfigurationService): void {
	host.classList.add(UA_CLIENT_CONVERSATION_DENSITY_CLASS);
	host.classList.toggle(
		UA_CLIENT_CONVERSATION_DENSITY_COMPACT_CLASS,
		getUaClientConversationDensity(configurationService) === 'compact',
	);
}
