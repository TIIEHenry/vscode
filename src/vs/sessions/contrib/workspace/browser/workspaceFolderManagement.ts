/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution } from '../../../../workbench/common/contributions.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { ensureSessionWorktreesTrusted } from '../../../services/sessions/browser/worktreeTrust.js';
import { IWorkspaceContextService, WorkspaceFolder } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceEditingService } from '../../../../workbench/services/workspaces/common/workspaceEditing.js';
import { IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { URI } from '../../../../base/common/uri.js';
import { autorun } from '../../../../base/common/observable.js';
import { IWorkspaceFolderCreationData } from '../../../../platform/workspaces/common/workspaces.js';
import { Queue } from '../../../../base/common/async.js';
import { ISession } from '../../../services/sessions/common/session.js';
import { IWorkspaceFolderLabelService } from '../../../../workbench/services/workspaces/common/workspaceFolderLabelService.js';

export class WorkspaceFolderManagementContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.workspaceFolderManagement';
	private queue = this._register(new Queue<void>());

	constructor(
		@ISessionsService private readonly sessionsService: ISessionsService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IWorkspaceEditingService private readonly workspaceEditingService: IWorkspaceEditingService,
		@IWorkspaceTrustManagementService private readonly workspaceTrustManagementService: IWorkspaceTrustManagementService,
		@IWorkspaceFolderLabelService private readonly workspaceFolderLabelService: IWorkspaceFolderLabelService,
	) {
		super();
		this._register(autorun(reader => {
			const activeSession = this.sessionsService.activeSession.read(reader);
			activeSession?.workspace.read(reader);
			this.queue.queue(() => this.updateWorkspaceFoldersForSession(activeSession));
		}));
	}

	private shouldAbortStaleSessionFolderUpdate(session: ISession | undefined): boolean {
		const activeSessionId = this.sessionsService.activeSession.get()?.sessionId;
		const sessionId = session?.sessionId;
		if (activeSessionId === undefined && sessionId === undefined) {
			return false;
		}
		return activeSessionId !== sessionId;
	}

	private async updateWorkspaceFoldersForSession(session: ISession | undefined): Promise<void> {
		if (this.shouldAbortStaleSessionFolderUpdate(session)) {
			return;
		}
		// Auto-trust an isolated worktree VS Code created off a trusted repo, so a
		// worktree session mounts without tripping the untrusted-folder backstop.
		await ensureSessionWorktreesTrusted(session?.workspace.get(), this.workspaceTrustManagementService);
		if (this.shouldAbortStaleSessionFolderUpdate(session)) {
			return;
		}

		const sessionFolders = this.getSessionFolderCreationData(session);
		const primaryFolder = sessionFolders[0];
		const currentFolders = this.workspaceContextService.getWorkspace().folders;
		const currentUris = currentFolders.map(folder => folder.uri);

		// Never mount an untrusted folder: mounting it would flip the whole Agents
		// Window into Restricted Mode. Sessions opened from the list are already
		// gated on trust (see `ISessionsService.canOpenSession`); this backstop
		// keeps paths that bypass that gate (e.g. startup restore) safe too by
		// leaving the folder unmounted rather than mounting it untrusted.
		if (primaryFolder && !await this.isFolderMountable(session, primaryFolder.uri)) {
			if (this.shouldAbortStaleSessionFolderUpdate(session)) {
				return;
			}
			if (currentUris.length > 0) {
				await this.workspaceEditingService.removeFolders(currentUris, true);
			}
			return;
		}

		if (!primaryFolder) {
			if (this.shouldAbortStaleSessionFolderUpdate(session)) {
				return;
			}
			if (currentUris.length > 0) {
				await this.workspaceEditingService.removeFolders(currentUris, true);
			}
			return;
		}

		const desiredFolders: IWorkspaceFolderCreationData[] = [];
		for (const folder of sessionFolders) {
			if (await this.isFolderMountable(session, folder.uri)) {
				desiredFolders.push(folder);
			}
		}

		if (this.folderListsEqual(currentUris, desiredFolders)) {
			return;
		}

		if (this.shouldAbortStaleSessionFolderUpdate(session)) {
			return;
		}

		if (desiredFolders.length === 0) {
			if (currentUris.length > 0) {
				await this.workspaceEditingService.removeFolders(currentUris, true);
			}
			return;
		}

		if (currentFolders.length === 0) {
			await this.workspaceEditingService.addFolders(desiredFolders, true);
			return;
		}

		await this.workspaceEditingService.updateFolders(0, currentFolders.length, desiredFolders, true);
	}

	private folderListsEqual(currentUris: readonly URI[], desiredFolders: readonly IWorkspaceFolderCreationData[]): boolean {
		if (currentUris.length !== desiredFolders.length) {
			return false;
		}
		return currentUris.every((uri, index) => this.uriIdentityService.extUri.isEqual(uri, desiredFolders[index].uri));
	}

	private getSessionFolderCreationData(session: ISession | undefined): IWorkspaceFolderCreationData[] {
		if (!session) {
			return [];
		}

		const workspace = session.workspace.get();
		if (!workspace?.folders.length) {
			return [];
		}

		return workspace.folders.map((folder, index) => ({
			uri: folder.workingDirectory,
			name: this.workspaceFolderLabelService.getWorkspaceFolderLabel(
				new WorkspaceFolder({ uri: folder.workingDirectory, name: folder.name, index }),
				true
			) ?? folder.name
		}));
	}

	/**
	 * Whether `uri` may be mounted as the workspace folder. A session that
	 * requires workspace trust may only mount a trusted folder; anything else is
	 * left unmounted so the window never enters Restricted Mode behind the user's
	 * back. Sessions that don't require trust (e.g. virtual/cloud) always mount.
	 */
	private async isFolderMountable(session: ISession | undefined, uri: URI): Promise<boolean> {
		const workspace = session?.workspace.get();
		if (!workspace?.requiresWorkspaceTrust) {
			return true;
		}
		return (await this.workspaceTrustManagementService.getUriTrustInfo(uri)).trusted;
	}
}
