/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * INV-NO-COPILOT: Copilot quota, rate-limit, and setup chrome is Agents Window only.
 */
export function shouldShowCopilotQuotaChrome(isSessionsWindow: boolean): boolean {
	return isSessionsWindow;
}
