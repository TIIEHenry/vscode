/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationIdentityStrip.css';
import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { autorun } from '../../../../base/common/observable.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IExplorerService } from '../../files/browser/files.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { getConversationEngineStatusText } from './conversationSessionStatus.js';

export const conversationIdentityStripClass = 'conversation-identity-strip';
export const conversationIdentityEngineChipClass = 'conversation-identity-chip-engine';
export const conversationIdentityFolderChipClass = 'conversation-identity-chip-folder';
export const conversationIdentityBranchChipClass = 'conversation-identity-chip-branch';

export interface IConversationIdentityFolder {
	readonly resource: URI;
	readonly label: string;
}

/** First workspace folder label for the identity strip; undefined when no folder is open. */
export function getConversationIdentityFolder(
	contextService: IWorkspaceContextService,
	labelService: ILabelService,
): IConversationIdentityFolder | undefined {
	const folder = contextService.getWorkspace().folders.at(0);
	if (!folder) {
		return undefined;
	}
	return {
		resource: folder.uri,
		label: labelService.getUriLabel(folder.uri, { relative: true }),
	};
}

/** SCM HEAD ref name for the identity strip; undefined when no repository or HEAD is available. */
export function getConversationIdentityBranchName(scmService: ISCMService): string | undefined {
	for (const repository of scmService.repositories) {
		const branchName = readRepositoryBranchName(repository);
		if (branchName) {
			return branchName;
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
	private readonly folderChip: HTMLButtonElement;
	private readonly branchChip: HTMLElement;

	private readonly repositoryListeners = this._register(new DisposableStore());

	private folderResource: URI | undefined;

	constructor(
		parent: HTMLElement,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@ILabelService private readonly labelService: ILabelService,
		@ISCMService private readonly scmService: ISCMService,
		@ICommandService private readonly commandService: ICommandService,
		@IExplorerService private readonly explorerService: IExplorerService,
	) {
		super();

		this.element = append(parent, $(`.${conversationIdentityStripClass}`));
		this.element.setAttribute('role', 'group');
		this.element.setAttribute('aria-label', localize('conversationIdentityStrip.ariaLabel', "Conversation context"));

		this.engineChip = append(this.element, $(`button.conversation-identity-chip.${conversationIdentityEngineChipClass}`)) as HTMLButtonElement;
		this.engineChip.type = 'button';
		this._register(addDisposableListener(this.engineChip, 'click', () => {
			this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		}));

		this.folderChip = append(this.element, $(`button.conversation-identity-chip.${conversationIdentityFolderChipClass}`)) as HTMLButtonElement;
		this.folderChip.type = 'button';
		this._register(addDisposableListener(this.folderChip, 'click', () => {
			if (this.folderResource) {
				this.explorerService.select(this.folderResource);
			}
		}));

		this.branchChip = append(this.element, $(`.conversation-identity-chip.${conversationIdentityBranchChipClass}`));
		this.branchChip.setAttribute('role', 'status');

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
		const engineText = getConversationEngineStatusText();
		this.engineChip.textContent = engineText;
		this.engineChip.setAttribute('aria-label', localize('conversationIdentityStrip.engineAriaLabel', "Engine: {0}", engineText));

		const folder = getConversationIdentityFolder(this.contextService, this.labelService);
		this.folderResource = folder?.resource;
		if (folder) {
			this.folderChip.hidden = false;
			this.folderChip.textContent = folder.label;
			this.folderChip.setAttribute('aria-label', localize('conversationIdentityStrip.folderAriaLabel', "Workspace folder: {0}", folder.label));
		} else {
			this.folderChip.hidden = true;
			this.folderChip.textContent = '';
			this.folderChip.removeAttribute('aria-label');
		}

		const branchName = getConversationIdentityBranchName(this.scmService);
		if (branchName) {
			this.branchChip.hidden = false;
			this.branchChip.textContent = branchName;
			this.branchChip.setAttribute('aria-label', localize('conversationIdentityStrip.branchAriaLabel', "Git branch: {0}", branchName));
		} else {
			this.branchChip.hidden = true;
			this.branchChip.textContent = '';
			this.branchChip.removeAttribute('aria-label');
		}
	}
}
