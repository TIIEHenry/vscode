/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import {
	UA_CLIENT_CHAT_INPUT_AUTO_FOCUS,
	UA_CLIENT_CHAT_INPUT_RESTORE_DRAFTS,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	type UaClientConversationDensity,
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

/** CS-2+ / deleted-key helpers: defaults only until those slices register keys. */
export function shouldShowAgentIdentity(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldOpenConversationOnStartup(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldRestoreLastSessionOnStartup(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function getUaClientKeyboardEnterBehavior(_configurationService?: IConfigurationService): 'send' | 'newline' {
	return 'send';
}

export function shouldNotifyPermissionRequests(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldNotifyTurnCompleted(_configurationService?: IConfigurationService): boolean {
	return false;
}

export function shouldOpenPendingOnFocus(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldConfirmBeforeExternalOpen(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldAdvertiseWorkspaceTools(_configurationService?: IConfigurationService): boolean {
	return true;
}

export function shouldShowClientToolInvocationDetails(_configurationService?: IConfigurationService): boolean {
	return true;
}
