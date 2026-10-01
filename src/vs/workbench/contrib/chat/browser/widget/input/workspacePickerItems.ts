/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ThemeIcon } from '../../../../../../base/common/themables.js';
import { URI } from '../../../../../../base/common/uri.js';
import { localize } from '../../../../../../nls.js';

/**
 * One workspace row. `isFolder` picks the editor's folder vs workspace-file
 * icon. Omit it when the model does not know; `fallbackIcon` is kept.
 */
export interface IWorkspacePickerRowModel {
	readonly uri: URI;
	readonly label: string;
	readonly isFolder?: boolean;
	readonly fallbackIcon?: ThemeIcon;
}

export interface IWorkspacePickerWorkspaceRow {
	readonly id: string;
	readonly label: string;
	readonly checked: boolean;
	readonly tooltip: string;
	readonly icon: ThemeIcon | undefined;
	readonly sourceIndex: number;
}

/**
 * Trailing Open Folder row. No icon: the editor dropdown paints a blank
 * check slot because `checked` is false and no icon is set.
 */
export interface IWorkspacePickerOpenFolderRow {
	readonly id: 'workspace.openFolder';
	readonly label: string;
	readonly checked: false;
	readonly tooltip: string;
}

export interface IWorkspacePickerBuiltRows {
	readonly workspaceRows: readonly IWorkspacePickerWorkspaceRow[];
	readonly openFolderRow: IWorkspacePickerOpenFolderRow;
}

/**
 * Label, folder vs `file-symlink-directory` when `isFolder` is known, checked
 * via URI string, fsPath tooltip, and the Open Folder label. Does not run
 * commands; callers attach their own handlers.
 */
export function buildWorkspacePickerRows(workspaces: readonly IWorkspacePickerRowModel[], currentUri: URI | undefined): IWorkspacePickerBuiltRows {
	return {
		workspaceRows: workspaces.map((workspace, sourceIndex) => ({
			id: `workspace.${workspace.uri.toString()}`,
			label: workspace.label,
			checked: currentUri?.toString() === workspace.uri.toString(),
			icon: workspacePickerIcon(workspace),
			tooltip: workspace.uri.fsPath,
			sourceIndex,
		})),
		openFolderRow: {
			id: 'workspace.openFolder',
			label: localize('openFolder', "Open Folder..."),
			checked: false,
			tooltip: localize('openFolderTooltip', "Open Folder..."),
		},
	};
}

function workspacePickerIcon(workspace: IWorkspacePickerRowModel): ThemeIcon | undefined {
	if (workspace.isFolder === true) {
		return { id: 'folder' };
	}
	if (workspace.isFolder === false) {
		return { id: 'file-symlink-directory' };
	}
	return workspace.fallbackIcon;
}
