/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage, isCancellationError } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';

/**
 * A load that finishes without a model, while this view is still the one
 * showing that chat, is a failure. Cancellation, or a view that has already
 * moved on, must not be reported and must not drop the chat it has since switched to.
 */
export function isChatViewLoadFailure(cancelled: boolean, acquired: boolean, stillCurrent: boolean): boolean {
	return !cancelled && !acquired && stillCurrent;
}

/** User-facing copy when a chat view cannot bind a model. Cancellation is not a failure. */
export function chatViewLoadFailureMessage(error?: unknown): string {
	if (error !== undefined && !isCancellationError(error)) {
		const detail = getErrorMessage(error);
		if (detail) {
			return localize('chatView.loadFailedDetail', "Failed to open chat session: {0}", detail);
		}
	}
	return localize('chatView.loadFailed', "Failed to open chat session.");
}
