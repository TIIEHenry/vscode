/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';

type SourcesFilesReadFailureKind = 'permission' | 'notFound' | 'unavailable' | 'timeout' | 'unimplemented';

/** gRPC status names and Node fs codes whose meaning for a file listing is unambiguous. */
const KNOWN_STATUS_NAME: Readonly<Record<string, SourcesFilesReadFailureKind>> = {
	PERMISSION_DENIED: 'permission',
	NOT_FOUND: 'notFound',
	UNAVAILABLE: 'unavailable',
	DEADLINE_EXCEEDED: 'timeout',
	UNIMPLEMENTED: 'unimplemented',
	ENOENT: 'notFound',
	EACCES: 'permission',
	EPERM: 'permission',
};

const KNOWN_STATUS_CODE: Readonly<Record<number, SourcesFilesReadFailureKind>> = {
	4: 'timeout',
	5: 'notFound',
	7: 'permission',
	12: 'unimplemented',
	14: 'unavailable',
};

/** Files tab empty chrome when the tree projection has no workspace files. */
export const sourcesFilesListEmptyMessage = localize(
	'sourcesFilesList.empty',
	"No workspace files.",
);

/** List mode when the Preview tab has no listable file (missing, untitled, or no file provider). */
export const sourcesFilesListNoOpenFileMessage = localize(
	'sourcesFilesList.noOpenFile',
	"Open a file to list its folder.",
);

/** List mode resolved a directory and it has no children. */
export const sourcesFilesListEmptyFolderMessage = localize(
	'sourcesFilesList.emptyFolder',
	"This folder is empty.",
);

const sourcesFilesListReadFailureGenericSummary = localize(
	'sourcesFilesList.readFailedSummary',
	"Unable to read workspace files.",
);

const sourcesFilesListReadFailurePermissionSummary = localize(
	'sourcesFilesList.readFailedPermission',
	"Workspace files cannot be read from this path.",
);

const sourcesFilesListReadFailureNotFoundSummary = localize(
	'sourcesFilesList.readFailedNotFound',
	"The workspace folder was not found.",
);

const sourcesFilesListReadFailureUnavailableSummary = localize(
	'sourcesFilesList.readFailedUnavailable',
	"The engine is unavailable.",
);

const sourcesFilesListReadFailureTimeoutSummary = localize(
	'sourcesFilesList.readFailedTimeout',
	"Reading workspace files timed out.",
);

const sourcesFilesListReadFailureUnimplementedSummary = localize(
	'sourcesFilesList.readFailedUnimplemented',
	"This engine cannot list workspace files.",
);

export const sourcesFilesListReadFailureDetailsLabel = localize(
	'sourcesFilesList.readFailedDetails',
	"Error details",
);

export const sourcesFilesListReadFailureRetryLabel = localize(
	'sourcesFilesList.readFailedRetry',
	"Retry",
);

/**
 * One foreground sentence. Known status codes get a specific sentence.
 * Anything else, including free text that merely mentions a code, stays generic.
 */
export function sourcesFilesListReadFailureSummaryFor(error: unknown): string {
	switch (sourcesFilesReadFailureKind(error)) {
		case 'permission':
			return sourcesFilesListReadFailurePermissionSummary;
		case 'notFound':
			return sourcesFilesListReadFailureNotFoundSummary;
		case 'unavailable':
			return sourcesFilesListReadFailureUnavailableSummary;
		case 'timeout':
			return sourcesFilesListReadFailureTimeoutSummary;
		case 'unimplemented':
			return sourcesFilesListReadFailureUnimplementedSummary;
		default:
			return sourcesFilesListReadFailureGenericSummary;
	}
}

/** Raw error for the tooltip and the expandable details. Not the visible sentence. */
export function sourcesFilesListReadFailureDetail(error: unknown): string {
	return getErrorMessage(error);
}

function sourcesFilesReadFailureKind(error: unknown): SourcesFilesReadFailureKind | undefined {
	if (error && typeof error === 'object') {
		const code = (error as { code?: unknown }).code;
		if (typeof code === 'number') {
			return KNOWN_STATUS_CODE[code];
		}
		if (typeof code === 'string') {
			return KNOWN_STATUS_NAME[code];
		}
	}
	const match = /^(?:\d+\s+)?([A-Z][A-Z0-9_]+)\b/.exec(getErrorMessage(error));
	return match ? KNOWN_STATUS_NAME[match[1]] : undefined;
}

/** A hit limit or a merged cap. Not an empty-workspace success and not a full listing. */
export function sourcesFilesListTruncatedMessage(): string {
	return localize('sourcesFilesList.truncated', "Not all files are listed.");
}
