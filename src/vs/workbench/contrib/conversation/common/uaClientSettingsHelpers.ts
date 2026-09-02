/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import {
	UA_CLIENT_CHAT_INPUT_AUTO_FOCUS,
	UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS,
	UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR,
	UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS,
	UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED,
	UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS,
	UA_CLIENT_STARTUP_RESTORE_LAST_SESSION,
	type UaClientConversationDensity,
	type UaClientKeyboardEnterBehavior,
} from './uaClientSettingsKeys.js';

export {
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
};

/** Plan CS-1 class name on the lens host (and inherited by process-fold roots). */
export const UA_CLIENT_CONVERSATION_DENSITY_COMPACT_CLASS = 'density-compact';

export function getUaClientConversationDensity(configurationService: IConfigurationService): UaClientConversationDensity {
	const value = configurationService.getValue<string>(UA_CLIENT_DISPLAY_CONVERSATION_DENSITY);
	return value === 'compact' ? 'compact' : 'comfortable';
}

export function shouldRestoreComposerDrafts(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS) !== false;
}

export function shouldAutoFocusComposer(configurationService: IConfigurationService): boolean {
	return configurationService.getValue<boolean>(UA_CLIENT_CHAT_INPUT_AUTO_FOCUS) !== false;
}

export function applyConversationDensityClass(host: HTMLElement, configurationService: IConfigurationService): void {
	host.classList.toggle(
		UA_CLIENT_CONVERSATION_DENSITY_COMPACT_CLASS,
		getUaClientConversationDensity(configurationService) === 'compact',
	);
}

export function shouldRestoreLastSessionOnStartup(configurationService?: IConfigurationService): boolean {
	if (!configurationService) {
		return true;
	}
	return configurationService.getValue<boolean>(UA_CLIENT_STARTUP_RESTORE_LAST_SESSION) !== false;
}

export function getUaClientKeyboardEnterBehavior(configurationService?: IConfigurationService): UaClientKeyboardEnterBehavior {
	if (!configurationService) {
		return 'send';
	}
	return configurationService.getValue<string>(UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR) === 'newline' ? 'newline' : 'send';
}

/** Deleted-key helpers: defaults only; do not read unregistered settings. */
export function shouldShowAgentIdentity(_configurationService?: IConfigurationService): boolean {
	return true;
}

/** Deleted key `ua.client.startup.openConversation` — do not read an unregistered setting. */
export function shouldOpenConversationOnStartup(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldNotifyPermissionRequests(configurationService?: IConfigurationService): boolean {
	if (!configurationService) {
		return true;
	}
	return configurationService.getValue<boolean>(UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS) !== false;
}

export function shouldNotifyTurnCompleted(configurationService?: IConfigurationService): boolean {
	if (!configurationService) {
		return false;
	}
	return configurationService.getValue<boolean>(UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED) === true;
}

export function shouldOpenPendingOnFocus(configurationService?: IConfigurationService): boolean {
	if (!configurationService) {
		return true;
	}
	return configurationService.getValue<boolean>(UA_CLIENT_PERMISSIONS_OPEN_PENDING_ON_FOCUS) !== false;
}

export function shouldConfirmBeforeExternalOpen(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldAdvertiseWorkspaceTools(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldShowClientToolInvocationDetails(configurationService?: IConfigurationService): boolean {
	if (!configurationService) {
		return true;
	}
	return configurationService.getValue<boolean>(UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS) !== false;
}
