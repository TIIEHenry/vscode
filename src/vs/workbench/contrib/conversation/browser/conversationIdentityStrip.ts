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
import { isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { autorun } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { ActionListItemKind, IActionListDelegate, IActionListItem, IActionListOptions } from '../../../../platform/actionWidget/browser/actionList.js';
import { IActionWidgetService } from '../../../../platform/actionWidget/browser/actionWidget.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { isRecentFolder, IRecentFolder, IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { ISCMHistoryItemRef } from '../../scm/common/history.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { getConnectionPhaseStatusBarText, getConversationEngineChipTone, getEngineStatusCommandArguments, getEngineStatusCommandId } from './conversationSessionStatus.js';
import { IConversationRosterService } from './conversationStubService.js';

const OPEN_FOLDER_COMMAND_ID = 'workbench.action.files.openFolder';
const GIT_CHECKOUT_COMMAND_ID = 'git.checkout';

export const conversationIdentityStripClass = 'conversation-identity-strip';
export const conversationIdentityEngineChipClass = 'conversation-identity-chip-engine';
export const conversationIdentityEngineOfflineClass = 'conversation-identity-chip-engine--offline';
export const conversationIdentityFolderChipClass = 'conversation-identity-chip-folder';
export const conversationIdentityBranchChipClass = 'conversation-identity-chip-branch';

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

/**
 * L1h″ conversation identity strip — engine · workspace folder · git branch.
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

	/** Which chip's menu is open. A second click on that chip closes it. */
	private openMenu: 'folder' | 'branch' | undefined;
	/** Set while a menu is still loading, so a second click cancels instead of opening twice. */
	private menuLoad: 'folder' | 'branch' | undefined;

	private readonly repositoryListeners = this._register(new DisposableStore());

	private folderResource: URI | undefined;

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
		openAffordance.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronRight));
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
		const folderChevron = append(this.folderChip, $('span.conversation-identity-chip-open'));
		folderChevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
		folderChevron.setAttribute('aria-hidden', 'true');
		this._register(addDisposableListener(this.folderChip, 'click', () => this.onFolderChipClick()));

		this.branchChip = append(this.element, $(`button.conversation-identity-chip.${conversationIdentityBranchChipClass}`)) as HTMLButtonElement;
		this.branchChip.type = 'button';
		this.branchChip.setAttribute('aria-haspopup', 'listbox');
		this.branchChip.setAttribute('aria-expanded', 'false');
		this.branchLabel = this.branchChip.ownerDocument.createTextNode('');
		this.branchChip.appendChild(this.branchLabel);
		const branchChevron = append(this.branchChip, $('span.conversation-identity-chip-open'));
		branchChevron.classList.add(...ThemeIcon.asClassNameArray(Codicon.chevronDown));
		branchChevron.setAttribute('aria-hidden', 'true');
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

		const folder = getConversationIdentityFolder(this.contextService);
		this.folderResource = folder?.resource;
		if (folder) {
			this.folderChip.hidden = false;
			this.folderLabel.data = folder.label;
			this.folderChip.setAttribute('aria-label', localize('conversationIdentityStrip.folderAriaLabel', "Workspace folder: {0}. Open the folder list.", folder.label));
		} else {
			this.folderChip.hidden = true;
			this.folderLabel.data = '';
			this.folderChip.removeAttribute('aria-label');
		}

		const branchName = getConversationIdentityBranchName(this.scmService, folder?.resource);
		if (branchName) {
			this.branchChip.hidden = false;
			this.branchLabel.data = branchName;
			this.branchChip.setAttribute('aria-label', localize('conversationIdentityStrip.branchAriaLabel', "Git branch: {0}. Open the branch list.", branchName));
		} else {
			this.branchChip.hidden = true;
			this.branchLabel.data = '';
			this.branchChip.removeAttribute('aria-label');
		}
	}

	private onFolderChipClick(): void {
		if (!this.folderResource) {
			return;
		}
		if (this.consumeToggle('folder')) {
			return;
		}
		void this.showFolderMenu().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private onBranchChipClick(): void {
		if (this.branchChip.hidden || !this.folderResource) {
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
		const current = getConversationIdentityFolder(this.contextService);
		if (!current) {
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

		type FolderAction = { readonly kind: 'recent'; readonly folder: IRecentFolder } | { readonly kind: 'browse' };
		const items: IActionListItem<FolderAction>[] = [{
			kind: ActionListItemKind.Header,
			label: localize('conversationIdentityStrip.recents', "Recents"),
		}];
		items.push({
			kind: ActionListItemKind.Action,
			label: current.label,
			description: this.labelService.getUriLabel(current.resource, { relative: false }),
			group: { title: '', icon: Codicon.check },
			item: { kind: 'recent', folder: { folderUri: current.resource, label: current.label } },
		});
		for (const folder of recents) {
			if (isEqual(folder.folderUri, current.resource)) {
				continue;
			}
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
			label: localize('conversationIdentityStrip.openFolder', "Open Folder…"),
			group: { title: '', icon: Codicon.folderOpened },
			item: { kind: 'browse' },
		});
		this.presentMenu('folder', this.folderChip, items, action => {
			if (action.kind === 'browse') {
				void this.commandService.executeCommand(OPEN_FOLDER_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError);
				return;
			}
			if (isEqual(action.folder.folderUri, current.resource)) {
				return;
			}
			void this.hostService.openWindow([{ folderUri: action.folder.folderUri }], {
				forceReuseWindow: true,
				remoteAuthority: action.folder.remoteAuthority ?? null,
			}).catch(onUnexpectedError).catch(onUnexpectedError);
		}, {
			showFilter: true,
			filterPlaceholder: localize('conversationIdentityStrip.searchFolders', "Search folders..."),
			minWidth: 280,
		});
	}

	private async showBranchMenu(): Promise<void> {
		const folder = getConversationIdentityFolder(this.contextService);
		const current = getConversationIdentityBranchName(this.scmService, folder?.resource);
		if (!folder || !current) {
			return;
		}
		this.menuLoad = 'branch';
		const names = new Map<string, boolean>();
		names.set(current, true);
		try {
			const repository = this.repositoryFor(folder.resource);
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
			void this.commandService.executeCommand(GIT_CHECKOUT_COMMAND_ID, folder.resource, name).catch(onUnexpectedError).catch(onUnexpectedError);
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
		this.folderChip.setAttribute('aria-expanded', String(this.openMenu === 'folder'));
		this.branchChip.setAttribute('aria-expanded', String(this.openMenu === 'branch'));
	}
}

function localBranchName(ref: ISCMHistoryItemRef): string | undefined {
	if (!ref.id.startsWith('refs/heads/')) {
		return undefined;
	}
	const name = ref.name.trim();
	return name || undefined;
}
