/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';

/** Files tab empty chrome. Implementation is a flat Explorer list projection (not a tree or Chat). */
export const sourcesFilesListEmptyMessage = localize(
	'sourcesFilesList.empty',
	"No workspace files.",
);

/** Honest fetch failure; leftover rows stay, this is not an empty-workspace success. */
export function sourcesFilesListReadFailureMessage(error: unknown): string {
	return localize('sourcesFilesList.readFailed', "Unable to read workspace files: {0}", getErrorMessage(error));
}
