/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** TypeScript AI quick fixes that start Inline Chat belong to the Agents window. */
export function isTypeScriptEditorChatAllowed(isAgentSessionsWorkspace: boolean | undefined): boolean {
	return isAgentSessionsWorkspace === true;
}

export function shouldOfferTypeScriptAiQuickFix(options: {
	isAgentSessionsWorkspace: boolean | undefined;
	copilotChatActive: boolean;
}): boolean {
	return isTypeScriptEditorChatAllowed(options.isAgentSessionsWorkspace) && options.copilotChatActive;
}

export async function runTypeScriptEditorChatFollowUp(options: {
	isAgentSessionsWorkspace: boolean | undefined;
	sendTelemetry: () => void;
	startEditorChat: () => Promise<void>;
}): Promise<boolean> {
	if (!isTypeScriptEditorChatAllowed(options.isAgentSessionsWorkspace)) {
		return false;
	}
	options.sendTelemetry();
	await options.startEditorChat();
	return true;
}
