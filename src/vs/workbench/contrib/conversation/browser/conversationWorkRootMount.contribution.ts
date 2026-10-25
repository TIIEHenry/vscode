/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isAbsolute } from '../../../../base/common/path.js';
import { isEqualOrParent } from '../../../../base/common/resources.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import type { ConnectionPhase } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from '../../../../platform/workspace/common/workspaceTrust.js';
import { IConversationWorkRootMount, IWorkRootMountOffer, workspaceBlocksAutoMount } from './conversationWorkRootMount.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { IAgentWorkRoot, normalizeAgentWorkDirKey, normalizeAgentWorkDirUri } from '../../../services/agentSession/common/agentWorkRoot.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkspaceEditingService } from '../../../services/workspaces/common/workspaceEditing.js';

/**
 * Folder to add for the active session, or undefined.
 * Only a Loopback engine shares this machine's file system; a remote engine's
 * path that happens to exist here is a different directory.
 */
export function resolveWorkRootMountCandidate(input: {
	readonly root: IAgentWorkRoot | undefined;
	readonly phase: ConnectionPhase;
	readonly pairingPending: boolean;
	readonly remoteAuthority: string | undefined;
	readonly workspaceFolders: readonly URI[];
}): URI | undefined {
	const { root } = input;
	const workDir = root?.workDir?.trim();
	if (!root || root.access !== 'engine' || !workDir) {
		return undefined;
	}
	if (input.phase.kind !== 'connected' || input.phase.path !== 'loopback' || input.pairingPending) {
		return undefined;
	}
	if (input.remoteAuthority || !isAbsolute(workDir)) {
		return undefined;
	}
	const candidate = normalizeAgentWorkDirUri(URI.file(workDir));
	// Inside an open folder the files are already in the Explorer; a nested root would list them twice.
	if (input.workspaceFolders.some(folder => folder.scheme === Schemas.file && isEqualOrParent(candidate, folder))) {
		return undefined;
	}
	return candidate;
}

/**
 * PRD-029 acceptance 8: switching to a session whose work directory is on this
 * machine adds it to the workspace. Folders are never removed. One attempt per
 * directory until the active root moves elsewhere, or trust / workspace folders change.
 * An untrusted directory, and a saved workspace file, wait for a click.
 */
export class ConversationWorkRootMountContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationWorkRootMount';

	private attemptedKey: string | undefined;
	private activeWorkDirKey: string | undefined;
	private resolveGeneration = 0;

	constructor(
		@IAgentSessionContext private readonly sessionContext: IAgentSessionContext,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IWorkspaceEditingService private readonly workspaceEditingService: IWorkspaceEditingService,
		@IFileService private readonly fileService: IFileService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@ILogService private readonly logService: ILogService,
		@IWorkspaceTrustEnablementService private readonly trustEnablementService: IWorkspaceTrustEnablementService,
		@IWorkspaceTrustManagementService private readonly trustManagementService: IWorkspaceTrustManagementService,
		@IConversationWorkRootMount private readonly mountModel: IConversationWorkRootMount,
	) {
		super();
		const onDidChangeActiveWorkRoot = this.sessionContext.onDidChangeActiveWorkRoot;
		if (onDidChangeActiveWorkRoot) {
			this._register(onDidChangeActiveWorkRoot(() => this.evaluate()));
		}
		this._register(this.connection.onDidChangeConnection(() => this.evaluate()));
		this._register(this.contextService.onDidChangeWorkspaceFolders(() => {
			this.attemptedKey = undefined;
			this.evaluate();
		}));
		this._register(this.trustManagementService.onDidChangeTrustedFolders(() => {
			this.attemptedKey = undefined;
			this.evaluate();
		}));
		this.evaluate();
	}

	private currentCandidate(): { readonly root: IAgentWorkRoot | undefined; readonly candidate: URI | undefined } {
		const root = this.sessionContext.getActiveWorkRoot?.();
		const candidate = resolveWorkRootMountCandidate({
			root,
			phase: this.connection.getConnectionPhase(),
			pairingPending: this.connection.getConnectionSnapshot().pairingPending,
			remoteAuthority: this.environmentService.remoteAuthority,
			workspaceFolders: this.contextService.getWorkspace().folders.map(folder => folder.uri),
		});
		return { root, candidate };
	}

	private evaluate(): void {
		const { root, candidate } = this.currentCandidate();
		const workDirKey = root ? `${root.sessionId}\n${normalizeAgentWorkDirKey(root.workDir)}` : undefined;
		if (workDirKey !== this.activeWorkDirKey) {
			this.activeWorkDirKey = workDirKey;
			this.attemptedKey = undefined;
		}
		if (!candidate) {
			this.resolveGeneration++;
			this.attemptedKey = undefined;
			this.publish(undefined);
			return;
		}
		const key = candidate.toString();
		if (this.attemptedKey === key) {
			return;
		}
		this.attemptedKey = key;
		const generation = ++this.resolveGeneration;
		void this.mount(candidate, generation).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private stillCurrent(candidate: URI, generation: number): boolean {
		return generation === this.resolveGeneration
			&& !this._store.isDisposed
			&& this.currentCandidate().candidate?.toString() === candidate.toString();
	}

	private publish(offer: IWorkRootMountOffer | undefined): void {
		this.mountModel.setOffer(offer, offer ? () => this.accept(offer.uri) : undefined);
	}

	/** The click is explicit, so the workspace trust dialog and error notification stay. */
	private accept(uri: URI): Promise<void> {
		if (this.currentCandidate().candidate?.toString() !== uri.toString()) {
			return Promise.resolve();
		}
		return this.workspaceEditingService.addFolders([{ uri }]);
	}

	private async mount(candidate: URI, generation: number): Promise<void> {
		let isDirectory = false;
		try {
			isDirectory = (await this.fileService.stat(candidate)).isDirectory;
		} catch {
			isDirectory = false;
		}
		if (!this.stillCurrent(candidate, generation)) {
			return;
		}
		if (!isDirectory) {
			this.publish(undefined);
			return;
		}
		const untrusted = await this.isUntrusted(candidate);
		if (!this.stillCurrent(candidate, generation)) {
			return;
		}
		const savedWorkspace = workspaceBlocksAutoMount(this.contextService.getWorkspace().configuration, this.environmentService);
		if (untrusted || savedWorkspace) {
			// The trust dialog only runs when the current workspace is already trusted.
			const asksTrust = untrusted && this.trustManagementService.isWorkspaceTrusted();
			this.publish({ uri: candidate, reason: asksTrust ? 'trust' : 'confirm' });
			return;
		}
		this.publish(undefined);
		try {
			await this.workspaceEditingService.addFolders([{ uri: candidate }], true);
		} catch (error) {
			this.logService.warn(`[conversation] Could not add session folder to the workspace: ${candidate.fsPath}`, error);
		}
	}

	private async isUntrusted(candidate: URI): Promise<boolean> {
		if (!this.trustEnablementService.isWorkspaceTrustEnabled()) {
			return false;
		}
		await this.trustManagementService.workspaceTrustInitialized;
		return !(await this.trustManagementService.getUriTrustInfo(candidate)).trusted;
	}
}

registerWorkbenchContribution2(ConversationWorkRootMountContribution.ID, ConversationWorkRootMountContribution, WorkbenchPhase.AfterRestored);
