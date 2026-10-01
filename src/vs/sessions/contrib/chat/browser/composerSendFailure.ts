/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage, isCancellationError } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';

/**
 * A composer send threw before the call returned. Cancellation is not a
 * failure. A background send that already returned reports a later provider
 * failure from the sessions management service — do not call this for that
 * path, or the user sees the same error twice.
 */
export function notifyComposerSendFailure(
	notificationService: { error(message: string): void },
	error: unknown,
	background: boolean,
): void {
	if (isCancellationError(error)) {
		return;
	}
	const detail = getErrorMessage(error);
	notificationService.error(background
		? localize('sessions.composerBackgroundSendFailed', "Couldn't send in the background: {0}", detail)
		: localize('sessions.composerSendFailed', "Couldn't send: {0}", detail));
}
