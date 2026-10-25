/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';

/**
 * Shared delete confirmation for SessionBar, its More menu, and the Sessions view.
 * Callers resolve an empty title with the same session-title lookup the SessionBar shows.
 */
export async function confirmDeleteConversationSession(dialogService: IDialogService, title: string): Promise<boolean> {
	const result = await dialogService.confirm({
		type: 'warning',
		message: localize('conversationLens.deleteSessionConfirm', "Delete session \"{0}\"?", title),
		detail: localize('conversationLens.deleteSessionConfirmDetail', "This permanently deletes the session and its messages. This cannot be undone."),
		primaryButton: localize('conversationLens.deleteSessionConfirmPrimary', "&&Delete"),
	});
	return result.confirmed;
}
