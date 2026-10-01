/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';

/** Files tab empty chrome when the tree projection has no workspace files. */
export const sourcesFilesListEmptyMessage = localize(
	'sourcesFilesList.empty',
	"No workspace files.",
);

/** List mode with no file resource on the current Preview tab. */
export const sourcesFilesListNoOpenFileMessage = localize(
	'sourcesFilesList.noOpenFile',
	"Open a file to list its folder.",
);

/** List mode resolved a directory and it has no children. */
export const sourcesFilesListEmptyFolderMessage = localize(
	'sourcesFilesList.emptyFolder',
	"This folder is empty.",
);

/** Honest fetch failure; leftover rows stay, this is not an empty-workspace success. */
export function sourcesFilesListReadFailureMessage(error: unknown): string {
	return localize('sourcesFilesList.readFailed', "Unable to read workspace files: {0}", getErrorMessage(error));
}

/** A hit limit or a merged cap. Not an empty-workspace success and not a full listing. */
export function sourcesFilesListTruncatedMessage(): string {
	return localize('sourcesFilesList.truncated', "Not all files are listed.");
}
