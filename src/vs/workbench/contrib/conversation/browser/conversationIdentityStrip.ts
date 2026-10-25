/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationIdentityStrip.css';
import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { isEqual, isEqualOrParent } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { autorun } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { normalizeAgentWorkDirUri, type IAgentWorkRoot } from '../../../services/agentSession/common/agentWorkRoot.js';
import { IConversationWorkRootMount } from './conversationWorkRootMount.js';
import { ActionListItemKind, IActionListDelegate, IActionListItem, IActionListOptions } from '../../../../platform/actionWidget/browser/actionList.js';
import { IActionWidgetService } from '../../../../platform/actionWidget/browser/actionWidget.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { isRecentFolder, IRecentFolder, IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { ISCMHistoryItemRef } from '../../scm/common/history.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkspaceEditingService } from '../../../services/workspaces/common/workspaceEditing.js';
import { ADD_ROOT_FOLDER_COMMAND_ID } from '../../../browser/actions/workspaceCommands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { getConnectionPhaseStatusBarText, getConversationEngineChipTone, getEngineStatusCommandArguments, getEngineStatusCommandId } from './conversationSessionStatus.js';
import { IConversationRosterService } from './conversationStubService.js';

const GIT_CHECKOUT_COMMAND_ID = 'git.checkout';

export const conversationIdentityStripClass = 'conversation-identity-strip';
export const conversationIdentityEngineChipClass = 'conversation-identity-chip-engine';
export const conversationIdentityEngineOfflineClass = 'conversation-identity-chip-engine--offline';
export const conversationIdentityFolderChipClass = 'conversation-identity-chip-folder';
export const conversationIdentityBranchChipClass = 'conversation-identity-chip-branch';
export const conversationIdentityBranchReadOnlyClass = 'conversation-identity-chip-branch--readonly';
export const conversationIdentityFolderReadOnlyClass = 'conversation-identity-chip-folder--readonly';
export const conversationIdentityAddFolderClass = 'conversation-identity-add-folder';

export interface IConversationIdentityFolder {
	readonly resource: URI;
	readonly label: string;
}

/** First workspace folder for the identity strip; undefined when no folder is open. */
export function getConversationIdentityFolder(
	contextService: IWorkspaceContextService,
): IConversationIdentityFolder | undefined {
	const folder = contextService.getWorkspace().folders.at(0);
	if (!folder) {
		return undefined;
	}
	// Not getUriLabel(relative): for the folder itself it returns '' by design
	// ("no label if paths are identical"), which painted an empty chip forever.
	const label = folder.name.trim();
	if (!label) {
		return undefined;
	}
	return {
		resource: folder.uri,
		label,
	};
}

/** SCM HEAD of the repo rooted at `folderUri`. No folder, no matching repo, or no HEAD name → undefined. */
export function getConversationIdentityBranchName(scmService: ISCMService, folderUri?: URI): string | undefined {
	if (!folderUri) {
		return undefined;
	}
	for (const repository of scmService.repositories) {
		const rootUri = repository.provider.rootUri;
		if (rootUri && isEqual(rootUri, folderUri)) {
			return readRepositoryBranchName(repository);
		}
	}
	return undefined;
}

function readRepositoryBranchName(repository: ISCMRepository): string | undefined {
	const historyProvider = repository.provider.historyProvider.get();
	const historyItemRef = historyProvider?.historyItemRef.get();
	return historyItemRef?.name?.trim() || undefined;
}

/** Last path segment. A slash-only directory has no folder name. */
function folderNameFromPath(path: string | undefined): string | undefined {
	const normalized = path?.trim().replace(/\\/g, '/').replace(/\/+$/, '');
	if (!normalized) {
		return undefined;
	}
	return normalized.split('/').filter(Boolean).pop() || undefined;
}

function workRootFolderLabel(root: IAgentWorkRoot): string | undefined {
	if (root.access === 'local' && root.localRoot) {
		return folderNameFromPath(root.localRoot.path);
	}
	if (root.access === 'engine') {
		return folderNameFromPath(root.workDir);
	}
	return undefined;
}

/**
 * L1h″ conversation identity strip — engine · session work root · git branch.
 * Mounted at the top of the reading column only (XOR with SessionBar and dock).
 */
export class ConversationIdentityStrip extends Disposable {

	readonly element: HTMLElement;

	private readonly engineChip: HTMLButtonElement;
	private readonly engineLabel: Text;
	private readonly folderChip: HTMLButtonElement;
	private readonly folderLabel: Text;
	private readonly branchChip: HTMLButtonElement;
	private readonly branchLabel: Text;
	private readonly folderChevron: HTMLElement;
	private readonly addFolderButton: HTMLButtonElement;
	private folderMenuEnabled = false;

	/** Which chip's menu is open. A second click on that chip closes it. */
	private openMenu: 'folder' | 'branch' | undefined;
	/** Set while a menu is still loading, so a second click cancels instead of opening twice. */
	private menuLoad: 'folder' | 'branch' | undefined;

	private readonly repositoryListeners = this._register(new DisposableStore());

	/** Window folder for the reopen-window menu. Not the session work root. */
	private folderResource: URI | undefined;
	/** Local work root checked out by the branch menu. Unset for an engine root. */
	private branchCheckoutUri: URI | undefined;
	private branchMenuEnabled = false;
	private branchRequestId = 0;
	private engineBranchKey: string | undefined;
	private readonly branchChevron: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@ISCMService private readonly scmService: ISCMService,
		@ICommandService private readonly commandService: ICommandService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IActionWidgetService private readonly actionWidgetService: IActionWidgetService,
		@IWorkspacesService private readonly workspacesService: IWorkspacesService,
		@IHostService private readonly hostService: IHostService,
		@ILabelService private readonly labelService: ILabelService,
		@IAgentSessionContext private readonly sessionContext: IAgentSessionContext,
		@IWorkspaceEditingService private readonly workspaceEditingService: IWorkspaceEditingService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IConversationWorkRootMount private readonly workRootMount: IConversationWorkRootMount,
	) {
		super();

		this.element = append(parent, $(`.${conversationIdentityStripClass}`));
		this.element.setAttribute('role', 'group');
		this.element.setAttribute('aria-label', localize('conversationIdentityStrip.ariaLabel', "Conversation context"));

		this.engineChip = append(this.element, $(`button.conversation-identity-chip.${conversationIdentityEngineChipClass}`)) as HTMLButtonElement;
		this.engineChip.type = 'button';
		this.engineLabel = this.engineChip.ownerDocument.createTextNode('');
		this.engineChip.appendChild(this.engineLabel);
		const openAffordance = append(this.engineChip, $('span.conversation-identity-chip-open'));
		openAffordance.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
		openAffordance.setAttribute('aria-hidden', 'true');
		this._register(addDisposableListener(this.engineChip, 'click', () => {
			const phase = this.uaConnection.getConnectionPhase();
			const pairingPending = this.uaConnection.getConnectionSnapshot().pairingPending;
			void this.commandService.executeCommand(getEngineStatusCommandId(
				phase,
				pairingPending,
			), ...getEngineStatusCommandArguments(phase, pairingPending)).catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this.folderChip = append(this.element, $(`button.conversation-identity-chip.${conversationIdentityFolderChipClass}`)) as HTMLButtonElement;
		this.folderChip.type = 'button';
		this.folderChip.setAttribute('aria-haspopup', 'listbox');
		this.folderChip.setAttribute('aria-expanded', 'false');
		this.folderLabel = this.folderChip.ownerDocument.createTextNode('');
		this.folderChip.appendChild(this.folderLabel);
		this.folderChevron = append(this.folderChip, $('span.conversation-identity-chip-open'));
		this.folderChevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
		this.folderChevron.setAttribute('aria-hidden', 'true');
		this._register(addDisposableListener(this.folderChip, 'click', () => this.onFolderChipClick()));

		this.addFolderButton = append(this.element, $(`button.${conversationIdentityAddFolderClass}`)) as HTMLButtonElement;
		this.addFolderButton.type = 'button';
		this.addFolderButton.hidden = true;
		this._register(addDisposableListener(this.addFolderButton, 'click', () => this.onAddFolderClick()));

		this.branchChip = append(this.element, $(`button.conversation-identity-chip.${conversationIdentityBranchChipClass}`)) as HTMLButtonElement;
		this.branchChip.type = 'button';
		this.branchChip.setAttribute('aria-haspopup', 'listbox');
		this.branchChip.setAttribute('aria-expanded', 'false');
		this.branchLabel = this.branchChip.ownerDocument.createTextNode('');
		this.branchChip.appendChild(this.branchLabel);
		this.branchChevron = append(this.branchChip, $('span.conversation-identity-chip-open'));
		this.branchChevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
		this.branchChevron.setAttribute('aria-hidden', 'true');
		this._register(addDisposableListener(this.branchChip, 'click', () => this.onBranchChipClick()));

		this._register(this.rosterService.onDidChangeEngineConnection(() => this.render()));
		this._register(this.uaConnection.onDidChangeConnection(() => this.render()));
		this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.render()));
		this._register(this.scmService.onDidAddRepository(repository => {
			this.registerRepositoryListeners(repository);
			this.render();
		}));
		this._register(this.scmService.onDidRemoveRepository(() => {
			this.repositoryListeners.clear();
			for (const repository of this.scmService.repositories) {
				this.registerRepositoryListeners(repository);
			}
			this.render();
		}));

		for (const repository of this.scmService.repositories) {
			this.registerRepositoryListeners(repository);
		}

		const onDidChangeActiveWorkRoot = this.sessionContext?.onDidChangeActiveWorkRoot;
		if (onDidChangeActiveWorkRoot) {
			this._register(onDidChangeActiveWorkRoot(() => this.render()));
		}
		this._register(this.workRootMount.onDidChangeOffer(() => this.render()));

		this.render();
	}

	private registerRepositoryListeners(repository: ISCMRepository): void {
		this.repositoryListeners.add(autorun(reader => {
			repository.provider.historyProvider.read(reader)?.historyItemRef.read(reader);
			this.render();
		}));
	}

	private render(): void {
		const snapshot = this.uaConnection.getConnectionSnapshot();
		const phase = this.uaConnection.getConnectionPhase();
		const engineText = getConnectionPhaseStatusBarText(
			phase,
			snapshot.pairingPending,
		);
		this.engineLabel.data = engineText;
		this.engineChip.setAttribute('aria-label', localize('conversationIdentityStrip.engineAriaLabel', "Engine: {0}", engineText));
		const tone = getConversationEngineChipTone(phase, snapshot.pairingPending);
		this.engineChip.classList.toggle('conversation-identity-chip-engine--failed', tone === 'error');
		this.engineChip.classList.toggle(conversationIdentityEngineOfflineClass, tone === 'warning');

		const windowFolder = getConversationIdentityFolder(this.contextService);
		// The folder menu adds to this window's workspace. It needs a workspace folder to start from.
		this.folderResource = windowFolder?.resource;
		const root = this.sessionContext?.getActiveWorkRoot?.();
		if (!root) {
			this.leaveEngineBranch();
			this.branchCheckoutUri = windowFolder?.resource;
			this.paintFolder(windowFolder?.label, !!windowFolder?.resource);
			const branchName = getConversationIdentityBranchName(this.scmService, windowFolder?.resource);
			this.paintBranch(branchName, !!branchName);
			this.paintAddOffer();
			return;
		}

		if (root.access === 'local' && root.localRoot) {
			this.leaveEngineBranch();
			this.paintFolder(workRootFolderLabel(root), !!this.folderResource);
			this.branchCheckoutUri = root.localRoot;
			this.paintBranch(getConversationIdentityBranchName(this.scmService, root.localRoot), true);
			this.paintAddOffer();
			return;
		}
		if (root.access === 'engine' && root.workDir) {
			this.paintFolder(workRootFolderLabel(root), false);
			this.branchCheckoutUri = undefined;
			this.beginEngineBranchRead(root);
			this.paintAddOffer();
			return;
		}
		this.leaveEngineBranch();
		this.paintFolder(workRootFolderLabel(root), false);
		this.branchCheckoutUri = undefined;
		this.paintBranch(undefined, false);
		this.paintAddOffer();
	}

	private paintFolder(label: string | undefined, menu: boolean = true): void {
		const menuEnabled = menu && !!label;
		if (!menuEnabled) {
			if (this.menuLoad === 'folder') {
				this.menuLoad = undefined;
			}
			if (this.openMenu === 'folder' && this.actionWidgetService.isVisible) {
				this.actionWidgetService.hide(true);
			}
		}
		this.folderMenuEnabled = menuEnabled;
		this.folderChevron.hidden = !menuEnabled;
		this.folderChip.tabIndex = menuEnabled ? 0 : -1;
		if (!label) {
			this.folderChip.hidden = true;
			this.folderLabel.data = '';
			this.folderChip.removeAttribute('aria-label');
			this.folderChip.removeAttribute('aria-haspopup');
			this.folderChip.removeAttribute('aria-expanded');
			this.folderChip.classList.remove(conversationIdentityFolderReadOnlyClass);
			return;
		}
		this.folderChip.hidden = false;
		this.folderLabel.data = label;
		this.folderChip.classList.toggle(conversationIdentityFolderReadOnlyClass, !menuEnabled);
		if (menuEnabled) {
			this.folderChip.setAttribute('aria-haspopup', 'listbox');
			this.folderChip.setAttribute('aria-label', localize('conversationIdentityStrip.folderAriaLabel', "Session folder: {0}. Add a folder to the workspace.", label));
			this.syncMenuExpanded();
		} else {
			this.folderChip.removeAttribute('aria-haspopup');
			this.folderChip.removeAttribute('aria-expanded');
			this.folderChip.setAttribute('aria-label', localize('conversationIdentityStrip.folderReadOnlyAriaLabel', "Session folder: {0}", label));
		}
	}

	private paintBranch(name: string | undefined, menu: boolean): void {
		const menuEnabled = menu && !!name;
		if (!menuEnabled) {
			if (this.menuLoad === 'branch') {
				this.menuLoad = undefined;
			}
			if (this.openMenu === 'branch' && this.actionWidgetService.isVisible) {
				this.actionWidgetService.hide(true);
			}
		}
		this.branchMenuEnabled = menuEnabled;
		this.branchChevron.hidden = !menuEnabled;
		this.branchChip.tabIndex = menuEnabled ? 0 : -1;
		if (!name) {
			this.branchChip.hidden = true;
			this.branchLabel.data = '';
			this.branchChip.removeAttribute('aria-label');
			this.branchChip.removeAttribute('aria-haspopup');
			this.branchChip.removeAttribute('aria-expanded');
			this.branchChip.classList.remove(conversationIdentityBranchReadOnlyClass);
			return;
		}
		this.branchChip.hidden = false;
		this.branchLabel.data = name;
		this.branchChip.classList.toggle(conversationIdentityBranchReadOnlyClass, !menuEnabled);
		if (menuEnabled) {
			this.branchChip.setAttribute('aria-haspopup', 'listbox');
			this.branchChip.setAttribute('aria-label', localize('conversationIdentityStrip.branchAriaLabel', "Git branch: {0}. Open the branch list.", name));
			this.syncMenuExpanded();
		} else {
			this.branchChip.removeAttribute('aria-haspopup');
			this.branchChip.removeAttribute('aria-expanded');
			this.branchChip.setAttribute('aria-label', localize('conversationIdentityStrip.branchReadOnlyAriaLabel', "Git branch: {0}", name));
		}
	}

	private leaveEngineBranch(): void {
		this.branchRequestId++;
		this.engineBranchKey = undefined;
	}

	private beginEngineBranchRead(root: IAgentWorkRoot): void {
		const key = `${root.sessionId}\n${root.workDir ?? ''}`;
		if (key !== this.engineBranchKey) {
			this.engineBranchKey = key;
			this.paintBranch(undefined, false);
		}
		const requestId = ++this.branchRequestId;
		const sessionId = root.sessionId;
		const read = this.uaConnection.readGitSummary?.bind(this.uaConnection);
		if (!read || !sessionId.trim()) {
			this.paintBranch(undefined, false);
			return;
		}
		void read({ sessionId }).then(result => {
			if (requestId !== this.branchRequestId || this._store.isDisposed) {
				return;
			}
			const current = this.sessionContext?.getActiveWorkRoot?.();
			if (!current || current.access !== 'engine' || current.sessionId !== sessionId) {
				return;
			}
			const branch = result.supported ? result.branch.trim() : '';
			this.paintBranch(branch || undefined, false);
		}, () => {
			if (requestId !== this.branchRequestId || this._store.isDisposed) {
				return;
			}
			this.paintBranch(undefined, false);
		});
	}

	private paintAddOffer(): void {
		const offer = this.workRootMount.getOffer();
		const root = this.sessionContext?.getActiveWorkRoot?.();
		const label = root ? workRootFolderLabel(root) : undefined;
		const matches = !!offer && !!root && root.access === 'engine' && !!root.workDir && !!label
			&& isEqual(offer.uri, normalizeAgentWorkDirUri(URI.file(root.workDir)));
		if (!matches || !offer || !label) {
			this.addFolderButton.hidden = true;
			this.addFolderButton.textContent = '';
			this.addFolderButton.removeAttribute('aria-label');
			return;
		}
		const text = offer.reason === 'trust'
			? localize('conversationIdentityStrip.addAndTrust', "Add and trust")
			: localize('conversationIdentityStrip.addToWorkspace', "Add to workspace");
		this.addFolderButton.hidden = false;
		this.addFolderButton.textContent = text;
		this.addFolderButton.setAttribute('aria-label', offer.reason === 'trust'
			? localize('conversationIdentityStrip.addAndTrustAria', "Session folder: {0}. Add and trust it.", label)
			: localize('conversationIdentityStrip.addToWorkspaceAria', "Session folder: {0}. Add it to the workspace.", label));
	}

	private onAddFolderClick(): void {
		if (this.addFolderButton.hidden) {
			return;
		}
		void this.workRootMount.acceptOffer().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private onFolderChipClick(): void {
		if (!this.folderMenuEnabled || this.folderChip.hidden || !this.folderResource) {
			return;
		}
		if (this.consumeToggle('folder')) {
			return;
		}
		void this.showFolderMenu().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private onBranchChipClick(): void {
		if (!this.branchMenuEnabled || this.branchChip.hidden || !this.branchCheckoutUri) {
			return;
		}
		if (this.consumeToggle('branch')) {
			return;
		}
		void this.showBranchMenu().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	/** Close an open menu, or cancel a menu that has not painted yet. */
	private consumeToggle(which: 'folder' | 'branch'): boolean {
		if (this.actionWidgetService.isVisible && this.openMenu === which) {
			this.actionWidgetService.hide(true);
			this.menuLoad = undefined;
			return true;
		}
		if (this.menuLoad === which) {
			this.menuLoad = undefined;
			return true;
		}
		return false;
	}

	private async showFolderMenu(): Promise<void> {
		const workspaceFolders = this.contextService.getWorkspace().folders;
		const root = this.sessionContext?.getActiveWorkRoot?.();
		const current = root?.access === 'local' && root.localRoot
			? root.localRoot
			: getConversationIdentityFolder(this.contextService)?.resource;
		if (!current || workspaceFolders.length === 0) {
			return;
		}
		this.menuLoad = 'folder';
		let recents: IRecentFolder[] = [];
		try {
			const opened = await this.workspacesService.getRecentlyOpened();
			recents = opened.workspaces.filter(isRecentFolder);
		} catch {
			recents = [];
		}
		if (this.menuLoad !== 'folder') {
			return;
		}
		this.menuLoad = undefined;

		// A nested SCM root is not itself a workspace folder; check the folder that contains it.
		const currentFolder = workspaceFolders.find(folder => isEqual(folder.uri, current))
			?? workspaceFolders.find(folder => isEqualOrParent(current, folder.uri));
		type FolderAction = { readonly kind: 'workspace' } | { readonly kind: 'recent'; readonly folder: IRecentFolder } | { readonly kind: 'browse' };
		const items: IActionListItem<FolderAction>[] = [{
			kind: ActionListItemKind.Header,
			label: localize('conversationIdentityStrip.workspaceFolders', "Workspace"),
		}];
		for (const folder of workspaceFolders) {
			items.push({
				kind: ActionListItemKind.Action,
				label: folder.name,
				description: this.labelService.getUriLabel(folder.uri, { relative: false }),
				group: { title: '', icon: folder === currentFolder ? Codicon.check : Codicon.folder },
				item: { kind: 'workspace' },
			});
		}
		const addable = recents.filter(recent => !workspaceFolders.some(folder => isEqual(folder.uri, recent.folderUri)));
		if (addable.length > 0) {
			items.push({
				kind: ActionListItemKind.Header,
				label: localize('conversationIdentityStrip.recents', "Recents"),
			});
		}
		for (const folder of addable) {
			const label = folder.label?.trim()
				|| this.labelService.getUriLabel(folder.folderUri, { relative: true }).trim()
				|| this.labelService.getUriLabel(folder.folderUri, { relative: false });
			items.push({
				kind: ActionListItemKind.Action,
				label,
				group: { title: '', icon: Codicon.folder },
				item: { kind: 'recent', folder },
			});
		}
		items.push({ kind: ActionListItemKind.Separator });
		items.push({
			kind: ActionListItemKind.Action,
			label: localize('conversationIdentityStrip.addFolder', "Add Folder to Workspace…"),
			group: { title: '', icon: Codicon.folderOpened },
			item: { kind: 'browse' },
		});
		this.presentMenu('folder', this.folderChip, items, action => {
			if (action.kind === 'browse') {
				void this.commandService.executeCommand(ADD_ROOT_FOLDER_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError);
				return;
			}
			if (action.kind === 'recent') {
				this.addRecentFolder(action.folder);
			}
		}, {
			showFilter: true,
			filterPlaceholder: localize('conversationIdentityStrip.searchFolders', "Search folders..."),
			minWidth: 280,
		});
	}

	/** Adds to this window's workspace. A folder on another remote cannot join it, so that one opens a new window. */
	private addRecentFolder(folder: IRecentFolder): void {
		const windowAuthority = this.environmentService.remoteAuthority || undefined;
		const folderAuthority = folder.remoteAuthority || undefined;
		if (folderAuthority !== windowAuthority) {
			void this.hostService.openWindow([{ folderUri: folder.folderUri }], {
				forceNewWindow: true,
				remoteAuthority: folder.remoteAuthority ?? null,
			}).catch(onUnexpectedError).catch(onUnexpectedError);
			return;
		}
		void this.workspaceEditingService.addFolders([{ uri: folder.folderUri }]).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private async showBranchMenu(): Promise<void> {
		const folderUri = this.branchCheckoutUri;
		const current = getConversationIdentityBranchName(this.scmService, folderUri);
		if (!this.branchMenuEnabled || !folderUri || !current) {
			return;
		}
		this.menuLoad = 'branch';
		const names = new Map<string, boolean>();
		names.set(current, true);
		try {
			const repository = this.repositoryFor(folderUri);
			const historyProvider = repository?.provider.historyProvider.get();
			const refs = await historyProvider?.provideHistoryItemRefs?.();
			for (const ref of refs ?? []) {
				const name = localBranchName(ref);
				if (name && !names.has(name)) {
					names.set(name, name === current);
				}
			}
		} catch {
			// The current branch still opens. Checkout of other refs waits for the next click.
		}
		if (this.menuLoad !== 'branch') {
			return;
		}
		this.menuLoad = undefined;

		const ordered = [...names.entries()].sort((a, b) => {
			if (a[1] !== b[1]) {
				return a[1] ? -1 : 1;
			}
			return a[0].localeCompare(b[0]);
		});
		const items: IActionListItem<string>[] = ordered.slice(0, 300).map(([name, isCurrent]) => ({
			kind: ActionListItemKind.Action,
			label: name,
			group: { title: '', icon: isCurrent ? Codicon.check : Codicon.gitBranch },
			item: name,
		}));
		this.presentMenu('branch', this.branchChip, items, name => {
			if (name === current) {
				return;
			}
			void this.commandService.executeCommand(GIT_CHECKOUT_COMMAND_ID, folderUri, name).catch(onUnexpectedError).catch(onUnexpectedError);
		}, {
			showFilter: true,
			filterPlaceholder: localize('conversationIdentityStrip.searchBranches', "Search branches..."),
			minWidth: 280,
		});
	}

	private repositoryFor(folderUri: URI): ISCMRepository | undefined {
		for (const repository of this.scmService.repositories) {
			const rootUri = repository.provider.rootUri;
			if (rootUri && isEqual(rootUri, folderUri)) {
				return repository;
			}
		}
		return undefined;
	}

	private presentMenu<T>(
		which: 'folder' | 'branch',
		anchor: HTMLButtonElement,
		items: readonly IActionListItem<T>[],
		onSelect: (item: T) => void,
		listOptions: IActionListOptions,
	): void {
		const delegate: IActionListDelegate<T> = {
			onSelect: item => {
				this.actionWidgetService.hide();
				onSelect(item);
			},
			onHide: () => {
				if (this.openMenu === which) {
					this.openMenu = undefined;
					this.syncMenuExpanded();
				}
			},
		};
		this.openMenu = which;
		this.syncMenuExpanded();
		this.actionWidgetService.show(
			which === 'folder' ? 'conversationIdentityFolder' : 'conversationIdentityBranch',
			false,
			items,
			delegate,
			anchor,
			undefined,
			[],
			{
				getAriaLabel: item => item.label ?? '',
				getWidgetAriaLabel: () => which === 'folder'
					? localize('conversationIdentityStrip.folderList', "Folders")
					: localize('conversationIdentityStrip.branchList', "Branches"),
			},
			listOptions,
		);
	}

	private syncMenuExpanded(): void {
		if (this.folderMenuEnabled) {
			this.folderChip.setAttribute('aria-expanded', String(this.openMenu === 'folder'));
		} else {
			this.folderChip.removeAttribute('aria-expanded');
		}
		if (this.branchMenuEnabled) {
			this.branchChip.setAttribute('aria-expanded', String(this.openMenu === 'branch'));
		} else {
			this.branchChip.removeAttribute('aria-expanded');
		}
	}
}

function localBranchName(ref: ISCMHistoryItemRef): string | undefined {
	if (!ref.id.startsWith('refs/heads/')) {
		return undefined;
	}
	const name = ref.name.trim();
	return name || undefined;
}
