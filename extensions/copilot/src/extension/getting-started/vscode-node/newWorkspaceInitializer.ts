/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { l10n } from 'vscode';
import { IVSCodeExtensionContext } from '../../../platform/extContext/common/extensionContext';
import { IFileSystemService } from '../../../platform/filesystem/common/fileSystemService';
import { IWorkspaceService } from '../../../platform/workspace/common/workspaceService';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import { INewWorkspaceStoredData, NEW_WORKSPACE_STORAGE_KEY } from '../common/newWorkspaceContext';

/** Resume-setup modal that opens chat belongs to the Agents window. */
export function shouldOfferNewWorkspaceSetupResume(isAgentSessionsWorkspace: boolean | undefined): boolean {
	return isAgentSessionsWorkspace === true;
}

export interface INewWorkspaceSetupResumeHost {
	readonly isAgentSessionsWorkspace: boolean | undefined;
	readonly workspaceFolderUri: string | undefined;
	readContexts(): INewWorkspaceStoredData[];
	writeContexts(contexts: INewWorkspaceStoredData[]): void;
	readDirectoryNames(): Promise<readonly string[]>;
	showContinuePrompt(): Promise<boolean>;
	openChat(query: string): void;
	readonly continueWithSetupQuery: string;
}

/**
 * Continues a stored new-workspace setup by opening chat.
 * Default Code windows return before the modal, storage writes, or chat open.
 */
export async function runNewWorkspaceSetupResume(host: INewWorkspaceSetupResumeHost): Promise<void> {
	if (!shouldOfferNewWorkspaceSetupResume(host.isAgentSessionsWorkspace) || !host.workspaceFolderUri) {
		return;
	}

	const newWorkspaceContextsList = host.readContexts();
	const exactIndex = newWorkspaceContextsList.findIndex(c => c.workspaceURI === host.workspaceFolderUri);
	if (exactIndex === -1) {
		return;
	}

	const context = newWorkspaceContextsList[exactIndex];
	if (!context.initialized) {
		context.initialized = true;
		newWorkspaceContextsList[exactIndex] = context;
		host.writeContexts(newWorkspaceContextsList);

		const confirmed = await host.showContinuePrompt();
		if (confirmed) {
			host.openChat(host.continueWithSetupQuery);
		} else {
			newWorkspaceContextsList.splice(exactIndex, 1);
			host.writeContexts(newWorkspaceContextsList);
		}
		return;
	}

	const entries = await host.readDirectoryNames();
	const isEffectivelyEmpty = entries.every(name => name === '.git');
	if (!isEffectivelyEmpty) {
		newWorkspaceContextsList.splice(exactIndex, 1);
		host.writeContexts(newWorkspaceContextsList);
		return;
	}

	const confirmed = await host.showContinuePrompt();
	if (confirmed) {
		host.openChat(context.userPrompt);
	} else {
		newWorkspaceContextsList.splice(exactIndex, 1);
		host.writeContexts(newWorkspaceContextsList);
	}
}

export class NewWorkspaceInitializer extends Disposable {
	constructor(
		@IVSCodeExtensionContext private readonly _extensionContext: IVSCodeExtensionContext,
		@IWorkspaceService private readonly workspaceService: IWorkspaceService,
		@IFileSystemService private readonly fileSystemService: IFileSystemService
	) {
		super();
		this._updateWorkspace();
	}

	private async _updateWorkspace(): Promise<void> {
		const workspace = this.workspaceService.getWorkspaceFolders();
		const folder = workspace?.[0];
		const confirm = l10n.t('Continue Setup');
		const message = l10n.t('Continue Workspace Setup?');
		const detail = l10n.t('Copilot will resume setting up the workspace by creating the necessary files.');

		await runNewWorkspaceSetupResume({
			isAgentSessionsWorkspace: vscode.workspace.isAgentSessionsWorkspace,
			workspaceFolderUri: folder?.toString(),
			readContexts: () => this._extensionContext.globalState.get<INewWorkspaceStoredData[]>(NEW_WORKSPACE_STORAGE_KEY, []),
			writeContexts: contexts => {
				this._extensionContext.globalState.update(NEW_WORKSPACE_STORAGE_KEY, contexts);
			},
			readDirectoryNames: async () => {
				if (!folder) {
					return [];
				}
				const entries = await this.fileSystemService.readDirectory(folder);
				return entries.map(([name]) => name);
			},
			showContinuePrompt: async () => {
				const result = await vscode.window.showInformationMessage(message, { modal: true, detail }, confirm);
				return result === confirm;
			},
			openChat: query => {
				vscode.commands.executeCommand('workbench.action.chat.open', { mode: 'agent', query });
			},
			continueWithSetupQuery: l10n.t('Continue with #new workspace setup'),
		});
	}
}