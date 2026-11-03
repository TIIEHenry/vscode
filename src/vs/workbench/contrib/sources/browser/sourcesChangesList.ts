/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesChangesList.css';
import * as dom from '../../../../base/browser/dom.js';
import { Button, type IButtonStyles } from '../../../../base/browser/ui/button/button.js';
import { Checkbox, TriStateCheckbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles, defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { sourcesAlternateOpenAction, sourcesEditorOpenSlot } from './sourcesEditorOpenMode.js';
import { conversationSessionReadinessProbe, getConversationSessionReadiness } from '../../conversation/common/conversationSessionReadiness.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import {
	SOURCES_GIT_COMMIT_COMMAND,
	SOURCES_GIT_STAGE_COMMAND,
	SOURCES_GIT_UNSTAGE_COMMAND,
	isSourcesChangeStageable,
	isSourcesChangeUnstageable,
	sourcesRepositoryCommitName,
	sourcesRepositoryRootUris,
	uniqueSourcesStagedRepository,
} from '../common/sourcesChangesGit.js';
import {
	resolveSourcesGitResourceRoot,
	sourcesGitChangeDescription,
	sourcesGitDiffOpenFailureMessage,
	sourcesGitLocalOnlyMessage,
	sourcesGitReadPairingHoldMessage,
	sourcesGitReadUnavailableNoHookMessage,
	tryReadSourcesGitFileDiff,
} from '../common/sourcesChangesGitRead.js';

/**
 * No inline paint: Button writes these as element styles, which would fill the
 * 22-24px icon actions with the solid primary background; the stylesheet owns
 * the ghost toolbar look.
 */
const ghostActionButtonStyles: IButtonStyles = {
	buttonBackground: undefined,
	buttonHoverBackground: undefined,
	buttonSeparator: undefined,
	buttonForeground: undefined,
	buttonBorder: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined,
	buttonSecondaryBorder: undefined,
};
import {
	canSendSourcesGitCommit,
	canSendSourcesGitStagePaths,
	sourcesGitWriteHookPresent,
	isSourcesEngineStageButtonBlocked,
	isSourcesEngineWriteSessionBlocked,
	isSourcesGitWriteAccepted,
	isSourcesGitWriteUnsupported,
	isSourcesKeepLeftoverWrite,
	resolveSourcesChangesRowAction,
	sourcesGitCommitNotAcceptedMessage,
	sourcesGitEmptyStagePathMessage,
	sourcesGitSessionChangedMessage,
	sourcesGitStageNotAcceptedMessage,
	sourcesGitUnstageUnavailableMessage,
	sourcesGitWriteFailureDetail,
	tryWriteSourcesGitCommit,
	tryWriteSourcesGitStagePaths,
} from '../common/sourcesChangesGitWrite.js';
import { filterSourcesEntries } from '../common/sourcesFilterModel.js';
import { ISourcesChangeEntry, ISourcesChangesModel, ISourcesChangesSnapshot, isSourcesChangesReadFailed, sourcesChangeEntryIdentity, sourcesChangesWriteSessionId } from '../common/sourcesChangesModel.js';
import {
	SOURCES_CHANGE_FILE_ROW_HEIGHT,
	SOURCES_CHANGE_GROUP_HEADER_HEIGHT,
	sourcesChangeGroupCounts,
	sourcesChangeGroupStartIdentities,
	sourcesChangeParentDirectory,
	sourcesChangeStatusMark,
} from '../common/sourcesChangesPresentation.js';
import { SourcesListViewport } from './sourcesListViewport.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { openSourcesChangeEntry, ISourcesChangeEntryOpenOptions, sourcesChangeOpenIncompleteMessage } from './sourcesChangeEntryOpen.js';
import { beginSourcesChangesOpenStatus, isCurrentSourcesChangesOpenStatus, settleSourcesOpenStatus } from './sourcesOpenStatus.js';
import { SourcesListFilterBox } from './sourcesListFilterBox.js';

const $ = dom.$;

function isSourcesChangesErrorStatus(message: string): boolean {
	return message !== sourcesGitReadPairingHoldMessage()
		&& message !== sourcesGitReadUnavailableNoHookMessage()
		&& message !== sourcesGitLocalOnlyMessage();
}

function sourcesChangeFileCount(count: number): string {
	return count === 1
		? localize('sourcesChangesList.oneFile', "1 file")
		: localize('sourcesChangesList.fileCount', "{0} files", count);
}

export type { ISourcesChangeEntryOpenOptions };
export { openSourcesChangeEntry };

type SourcesChangeRowAction = 'stage' | 'unstage';

interface ISourcesChangeFolderHeader {
	readonly id: string;
	readonly label: string;
	readonly depth: number;
	readonly count: number;
	readonly expanded: boolean;
}

class SourcesChangesDelegate implements IListVirtualDelegate<ISourcesChangeEntry> {
	constructor(
		private readonly isGroupStart: (element: ISourcesChangeEntry) => boolean,
		private readonly folderHeaders: (element: ISourcesChangeEntry) => readonly ISourcesChangeFolderHeader[],
		private readonly isFolderCollapsedAnchor: (element: ISourcesChangeEntry) => boolean,
	) { }

	getHeight(element: ISourcesChangeEntry): number {
		const groupHeight = this.isGroupStart(element) ? SOURCES_CHANGE_GROUP_HEADER_HEIGHT : 0;
		const folderHeight = this.folderHeaders(element).length * SOURCES_CHANGE_GROUP_HEADER_HEIGHT;
		const fileHeight = this.isFolderCollapsedAnchor(element) ? 0 : SOURCES_CHANGE_FILE_ROW_HEIGHT;
		return groupHeight + folderHeight + fileHeight;
	}

	getTemplateId(): string {
		return 'sourcesChange';
	}
}

interface ISourcesChangeTemplateData {
	readonly container: HTMLElement;
	readonly group: HTMLElement;
	readonly groupToggle: HTMLElement;
	readonly groupTitle: HTMLElement;
	readonly groupCount: HTMLElement;
	readonly groupCheckbox: TriStateCheckbox;
	readonly groupAction: Button;
	readonly folders: HTMLElement;
	readonly fileRow: HTMLElement;
	readonly fileCheckbox: Checkbox;
	readonly labelContainer: HTMLElement;
	readonly label: IResourceLabel;
	readonly statusLetter: HTMLElement;
	readonly actionButton: Button;
	readonly templateDisposables: DisposableStore;
	readonly elementDisposables: DisposableStore;
}

interface ISourcesChangesRendererDelegate {
	isGitCommandAvailable(commandId: string): boolean;
	canWriteStage(): boolean;
	isSourcesGitWritePairingHold(): boolean;
	isSourcesGitWriteListFailed(): boolean;
	isSourcesKeepLeftoverWrite(): boolean;
	isGroupStart(entry: ISourcesChangeEntry): boolean;
	groupCount(groupId: string): number;
	groupCheckboxState(groupId: string): boolean | 'mixed';
	groupCheckboxEnabled(groupId: string): boolean;
	setGroupChecked(groupId: string, checked: boolean): void;
	isGroupExpanded(groupId: string): boolean;
	toggleGroup(groupId: string): void;
	folderHeaders(entry: ISourcesChangeEntry): readonly ISourcesChangeFolderHeader[];
	folderCheckboxState(folderId: string): boolean | 'mixed';
	folderCheckboxEnabled(folderId: string): boolean;
	setFolderChecked(folderId: string, checked: boolean): void;
	isFolderCollapsedAnchor(entry: ISourcesChangeEntry): boolean;
	setEntryChecked(entry: ISourcesChangeEntry, checked: boolean): void;
	isEntryChecked(entry: ISourcesChangeEntry): boolean;
	toggleFolder(folderId: string): void;
	groupHasScmResource(groupId: string): boolean;
	isEngineStageButtonBlocked(entry: ISourcesChangeEntry): boolean;
	isGroupStageBlocked(groupId: string): boolean;
	writeHoldReason(): string | undefined;
	stageBlockReason(entry: ISourcesChangeEntry): string | undefined;
	groupStageBlockReason(groupId: string): string | undefined;
	getResourceRoot(): URI | undefined;
	onRowAction(entry: ISourcesChangeEntry, action: SourcesChangeRowAction): void;
	onGroupAction(groupId: string, action: SourcesChangeRowAction): void;
}

class SourcesChangesRenderer implements IListRenderer<ISourcesChangeEntry, ISourcesChangeTemplateData> {
	static readonly TEMPLATE_ID = 'sourcesChange';

	readonly templateId = SourcesChangesRenderer.TEMPLATE_ID;

	constructor(
		private readonly labels: ResourceLabels,
		private readonly delegate: ISourcesChangesRendererDelegate,
		private readonly onDidChangeCheckedState: Event<void>,
	) { }

	renderTemplate(container: HTMLElement): ISourcesChangeTemplateData {
		container.classList.add('sources-change-row');

		const templateDisposables = new DisposableStore();
		const elementDisposables = new DisposableStore();
		const group = dom.append(container, $('.sources-change-group'));
		const groupCheckbox = templateDisposables.add(new TriStateCheckbox('', false, defaultCheckboxStyles));
		groupCheckbox.domNode.tabIndex = -1;
		groupCheckbox.domNode.classList.add('sources-change-checkbox');
		dom.append(group, groupCheckbox.domNode);
		const groupToggle = dom.append(group, $('span.sources-change-group-toggle.codicon'));
		const groupTitle = dom.append(group, $('span.sources-change-group-title'));
		const groupCount = dom.append(group, $('span.sources-change-group-count'));
		const groupAction = templateDisposables.add(new Button(group, {
			supportIcons: true,
			title: '',
			...ghostActionButtonStyles,
		}));
		groupAction.element.classList.add('sources-change-group-action');

		const folders = dom.append(container, $('.sources-change-folder-container'));
		const fileRow = dom.append(container, $('.sources-change-file'));
		const fileCheckbox = templateDisposables.add(new Checkbox('', false, defaultCheckboxStyles));
		fileCheckbox.domNode.tabIndex = -1;
		fileCheckbox.domNode.classList.add('sources-change-checkbox');
		dom.append(fileRow, fileCheckbox.domNode);
		const labelContainer = dom.append(fileRow, $('.sources-change-label'));
		const label = this.labels.create(labelContainer, { supportDescriptionHighlights: true });
		const statusLetter = dom.append(fileRow, $('span.sources-change-status-letter'));
		statusLetter.setAttribute('aria-hidden', 'true');
		const actionButton = templateDisposables.add(new Button(fileRow, {
			supportIcons: true,
			title: '',
			...ghostActionButtonStyles,
		}));
		actionButton.element.classList.add('sources-change-action');

		return {
			container, group, groupToggle, groupTitle, groupCount, groupCheckbox, groupAction, folders, fileRow, fileCheckbox, labelContainer, label, statusLetter, actionButton, templateDisposables, elementDisposables,
		};
	}

	renderElement(element: ISourcesChangeEntry, _index: number, templateData: ISourcesChangeTemplateData): void {
		const parentPath = sourcesChangeParentDirectory(element.gitPath, element.resource, this.delegate.getResourceRoot());
		const mark = sourcesChangeStatusMark({
			groupId: element.groupId,
			indexState: element.indexState,
			kind: element.kind,
			strikeThrough: element.scmResource?.decorations.strikeThrough,
			tooltip: element.scmResource?.decorations.tooltip,
			iconPath: scmDecorationIconPath(element),
		});
		templateData.label.setResource({
			resource: element.resource,
			name: element.name,
			description: parentPath || undefined,
		}, {
			hideIcon: false,
			strikethrough: mark.strikethrough,
			fileDecorations: { colors: false, badges: false },
		});
		templateData.statusLetter.textContent = mark.letter;
		templateData.statusLetter.title = mark.tooltip;
		templateData.statusLetter.style.color = mark.color;
		templateData.fileRow.style.setProperty('--sources-change-status-color', mark.color);

		templateData.elementDisposables.clear();
		templateData.folders.replaceChildren();
		const folderHeaders = this.delegate.folderHeaders(element);
		templateData.fileRow.style.setProperty('--sources-change-depth', String(folderHeaders.length));
		templateData.container.classList.toggle('is-group-start', this.delegate.isGroupStart(element));
		if (this.delegate.isGroupStart(element)) {
			const heading = sourcesGitChangeDescription(element.groupId);
			const count = this.delegate.groupCount(element.groupId);
			templateData.groupCheckbox.checked = this.delegate.groupCheckboxState(element.groupId);
			if (this.delegate.groupCheckboxEnabled(element.groupId)) {
				templateData.groupCheckbox.enable();
			} else {
				templateData.groupCheckbox.disable();
			}
			templateData.groupCheckbox.setTitle(localize('sourcesChangesList.groupCheckbox', "Select all {0}", heading));
			templateData.group.classList.toggle('is-collapsed', !this.delegate.isGroupExpanded(element.groupId));
			templateData.groupToggle.classList.toggle('codicon-chevron-down', this.delegate.isGroupExpanded(element.groupId));
			templateData.groupToggle.classList.toggle('codicon-chevron-right', !this.delegate.isGroupExpanded(element.groupId));
			templateData.groupTitle.textContent = heading;
			templateData.groupCount.textContent = sourcesChangeFileCount(count);
			templateData.group.setAttribute('aria-label', localize('sourcesChangesList.groupAria', "{0}, {1} files", heading, count));
			templateData.elementDisposables.add(templateData.groupCheckbox.onChange(() => this.delegate.setGroupChecked(element.groupId, templateData.groupCheckbox.checked === true)));
			templateData.elementDisposables.add(dom.addDisposableListener(templateData.group, 'click', event => {
				const target = event.target;
				if (dom.isHTMLElement(target) && (target.closest('.sources-change-group-action') || target.closest('.monaco-custom-toggle'))) {
					return;
				}
				this.delegate.toggleGroup(element.groupId);
			}));
			this.renderGroupAction(element, templateData);
		}

		const folderCheckboxes: { id: string; checkbox: TriStateCheckbox }[] = [];
		for (const folder of folderHeaders) {
			const folderRow = dom.append(templateData.folders, $('.sources-change-folder-row'));
			folderRow.style.setProperty('--sources-change-depth', String(folder.depth));
			const checkbox = templateData.elementDisposables.add(new TriStateCheckbox('', this.delegate.folderCheckboxState(folder.id), defaultCheckboxStyles));
			folderCheckboxes.push({ id: folder.id, checkbox });
			checkbox.domNode.tabIndex = -1;
			checkbox.domNode.classList.add('sources-change-folder-checkbox');
			if (this.delegate.folderCheckboxEnabled(folder.id)) {
				checkbox.enable();
			} else {
				checkbox.disable();
			}
			checkbox.setTitle(localize('sourcesChangesList.folderCheckbox', "Select folder {0}", folder.label));
			dom.append(folderRow, checkbox.domNode);
			const twistie = dom.append(folderRow, $('span.sources-change-folder-toggle.codicon'));
			twistie.classList.toggle('codicon-chevron-down', folder.expanded);
			twistie.classList.toggle('codicon-chevron-right', !folder.expanded);
			const icon = dom.append(folderRow, $('span.sources-change-folder-icon.codicon.codicon-folder'));
			icon.setAttribute('aria-hidden', 'true');
			const title = dom.append(folderRow, $('span.sources-change-folder-name'));
			title.textContent = folder.label;
			const count = dom.append(folderRow, $('span.sources-change-folder-count'));
			count.textContent = sourcesChangeFileCount(folder.count);
			folderRow.setAttribute('aria-label', localize('sourcesChangesList.folderAria', "{0}, {1} files", folder.label, folder.count));
			templateData.elementDisposables.add(checkbox.onChange(() => this.delegate.setFolderChecked(folder.id, checkbox.checked === true)));
			templateData.elementDisposables.add(dom.addDisposableListener(folderRow, 'click', event => {
				dom.EventHelper.stop(event, true);
				const target = event.target;
				if (dom.isHTMLElement(target) && target.closest('.monaco-custom-toggle')) {
					return;
				}
				this.delegate.toggleFolder(folder.id);
			}));
		}

		const collapsed = this.delegate.isFolderCollapsedAnchor(element);
		templateData.fileRow.style.display = collapsed ? 'none' : '';
		templateData.fileCheckbox.checked = this.delegate.isEntryChecked(element);
		templateData.fileCheckbox.setTitle(localize('sourcesChangesList.fileCheckbox', "Select {0}", element.name));
		templateData.elementDisposables.add(templateData.fileCheckbox.onChange(() => this.delegate.setEntryChecked(element, templateData.fileCheckbox.checked)));
		templateData.elementDisposables.add(dom.addDisposableListener(templateData.fileCheckbox.domNode, 'click', event => dom.EventHelper.stop(event, true)));
		templateData.elementDisposables.add(this.onDidChangeCheckedState(() => {
			templateData.fileCheckbox.checked = this.delegate.isEntryChecked(element);
			if (this.delegate.isGroupStart(element)) {
				templateData.groupCheckbox.checked = this.delegate.groupCheckboxState(element.groupId);
			}
			for (const { id, checkbox } of folderCheckboxes) {
				checkbox.checked = this.delegate.folderCheckboxState(id);
			}
		}));

		this.renderFileAction(element, templateData);
	}

	private renderGroupAction(element: ISourcesChangeEntry, templateData: ISourcesChangeTemplateData): void {
		const rowAction = resolveSourcesChangesRowAction({
			groupId: element.groupId,
			hasScmResource: this.delegate.groupHasScmResource(element.groupId),
			canWriteStage: this.delegate.canWriteStage(),
			hasGitStageCommand: this.delegate.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND),
			hasGitUnstageCommand: this.delegate.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND),
		});
		const keepGroupAction = (e: MouseEvent) => {
			const target = e.target;
			if (dom.isHTMLElement(target) && target.closest('.sources-change-group-action')) {
				return;
			}
			dom.EventHelper.stop(e, true);
		};
		templateData.elementDisposables.add(dom.addDisposableListener(templateData.group, 'mousedown', keepGroupAction));
		templateData.elementDisposables.add(dom.addDisposableListener(templateData.group, 'click', keepGroupAction));
		this.bindRowAction(
			templateData.groupAction,
			rowAction,
			element.groupId,
			templateData,
			true,
			rowAction === 'stage' && this.delegate.isGroupStageBlocked(element.groupId),
		);
	}

	private renderFileAction(element: ISourcesChangeEntry, templateData: ISourcesChangeTemplateData): void {
		const rowAction = resolveSourcesChangesRowAction({
			groupId: element.groupId,
			hasScmResource: !!element.scmResource,
			canWriteStage: this.delegate.canWriteStage(),
			hasGitStageCommand: this.delegate.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND),
			hasGitUnstageCommand: this.delegate.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND),
		});
		this.bindRowAction(
			templateData.actionButton,
			rowAction,
			element,
			templateData,
			false,
			rowAction === 'stage' && this.delegate.isEngineStageButtonBlocked(element),
		);
	}

	private bindRowAction(
		button: Button,
		rowAction: ReturnType<typeof resolveSourcesChangesRowAction>,
		target: ISourcesChangeEntry | string,
		templateData: ISourcesChangeTemplateData,
		group: boolean,
		stageBlocked: boolean,
	): void {
		const pairingHold = this.delegate.isSourcesGitWritePairingHold();
		const listFailed = this.delegate.isSourcesGitWriteListFailed();
		const keepLeftover = this.delegate.isSourcesKeepLeftoverWrite();
		const writeHold = pairingHold || listFailed || keepLeftover;

		if (rowAction === 'stage' || rowAction === 'unstage') {
			const label = group
				? (rowAction === 'stage'
					? localize('sourcesChangesList.stageAll', "Stage All")
					: localize('sourcesChangesList.unstageAll', "Unstage All"))
				: (rowAction === 'stage'
					? localize('sourcesChangesList.stage', "Stage")
					: localize('sourcesChangesList.unstage', "Unstage"));
			button.element.style.display = pairingHold ? 'none' : '';
			button.icon = rowAction === 'stage' ? Codicon.add : Codicon.remove;
			const reason = writeHold
				? this.delegate.writeHoldReason()
				: (stageBlocked
					? (group && typeof target === 'string'
						? this.delegate.groupStageBlockReason(target)
						: (!group && typeof target !== 'string' ? this.delegate.stageBlockReason(target) : undefined))
					: undefined);
			button.enabled = !reason;
			button.setTitle(reason ?? label);
			button.setAriaLabel(reason ? `${label}. ${reason}` : label);
			if (reason) {
				return;
			}
			templateData.elementDisposables.add(button.onDidClick(e => {
				dom.EventHelper.stop(e, true);
				if (group && typeof target === 'string') {
					this.delegate.onGroupAction(target, rowAction);
				} else if (!group && typeof target !== 'string') {
					this.delegate.onRowAction(target, rowAction);
				}
			}));
			return;
		}

		if (rowAction === 'unstageUnavailable') {
			const message = sourcesGitUnstageUnavailableMessage();
			button.element.style.display = '';
			button.icon = Codicon.remove;
			button.enabled = false;
			button.setAriaLabel(message);
			button.setTitle(message);
			return;
		}

		button.element.style.display = 'none';
		button.enabled = false;
	}

	disposeElement(_element: ISourcesChangeEntry, _index: number, templateData: ISourcesChangeTemplateData): void {
		templateData.elementDisposables.clear();
	}

	disposeTemplate(templateData: ISourcesChangeTemplateData): void {
		templateData.elementDisposables.dispose();
		templateData.templateDisposables.dispose();
		templateData.label.dispose();
	}
}

function scmDecorationIconPath(entry: ISourcesChangeEntry): string {
	const icon = entry.scmResource?.decorations.icon ?? entry.scmResource?.decorations.iconDark;
	if (!icon || ThemeIcon.isThemeIcon(icon)) {
		return '';
	}
	return URI.isUri(icon) ? icon.path : '';
}

class SourcesChangesAccessibilityProvider implements IListAccessibilityProvider<ISourcesChangeEntry> {
	constructor(private readonly describe: (element: ISourcesChangeEntry) => string) { }

	getWidgetAriaLabel(): string {
		return localize('sourcesChangesList.ariaLabel', "Sources Changes");
	}

	getAriaLabel(element: ISourcesChangeEntry): string {
		return this.describe(element);
	}
}

export class SourcesChangesList extends Disposable implements ISourcesChangesRendererDelegate {

	private readonly host: HTMLElement;
	private readonly contentContainer: HTMLElement;
	private readonly toolbar: HTMLElement;
	private readonly filterBox: SourcesListFilterBox;
	private readonly stageSelectedButton: Button;
	private readonly unstageSelectedButton: Button;
	private readonly refreshButton: Button;
	private readonly expandAllButton: Button;
	private readonly collapseAllButton: Button;
	private readonly listContainer: HTMLElement;
	private readonly emptyMessage: HTMLElement;
	private readonly commitRow: HTMLElement;
	private readonly commitInput: HTMLTextAreaElement;
	private readonly provenance: HTMLElement;
	private readonly provenanceText: HTMLElement;
	private groupStartKeys = new Set<string>();
	private groupCounts = new Map<string, number>();
	private currentEntries: readonly ISourcesChangeEntry[] = [];
	private readonly checkedEntryIds = new Set<string>();
	private readonly onDidChangeCheckedState = this._register(new Emitter<void>());
	private readonly expandedGroupIds = new Set<string>();
	private readonly expandedFolderIds = new Set<string>();
	private folderHeadersByEntry = new Map<string, readonly ISourcesChangeFolderHeader[]>();
	private folderCounts = new Map<string, number>();
	private folderEntries = new Map<string, ISourcesChangeEntry[]>();
	private folderFirstEntries = new Map<string, string>();
	private collapsedAnchorIds = new Set<string>();
	private readonly commitButton: Button;
	private readonly statusMessage: HTMLElement;

	private list: WorkbenchList<ISourcesChangeEntry> | undefined;
	private listViewport: SourcesListViewport | undefined;
	private labels: ResourceLabels | undefined;
	private readonly refreshScheduler = { flush: () => this.changesModel.flushScheduledRefresh() };
	private readonly inputListeners = this._register(new DisposableMap<ISCMRepository>());
	private activeRepository: ISCMRepository | undefined;
	private gitCommandsAvailable = false;
	private isCommitInFlight = false;
	private writeStatusMessage: string | undefined;
	private openStatusMessage: string | undefined;

	setFilterDock(dock: HTMLElement | undefined): void {
		this.filterBox.dock(dock);
	}

	constructor(
		host: HTMLElement,
		@ISCMService private readonly scmService: ISCMService,
		@IEditorService private readonly editorService: IEditorService,
		@ICommandService private readonly commandService: ICommandService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IQuickDiffService private readonly quickDiffService: IQuickDiffService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ISourcesDiffPanelService private readonly sourcesDiffPanelService: ISourcesDiffPanelService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
		@IModelService private readonly modelService: IModelService,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
		@ISourcesChangesModel private readonly changesModel: ISourcesChangesModel,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
	) {
		super();
		this.host = host;

		host.classList.add('show-file-icons', 'sources-changes-host');

		this.filterBox = this._register(new SourcesListFilterBox(
			host,
			localize('sourcesChangesList.filterPlaceholder', "Filter changes"),
			localize('sourcesChangesList.filterAriaLabel', "Filter changes"),
		));
		this._register(this.filterBox.onDidChange(() => this.renderFromSnapshot()));

		this.toolbar = dom.append(host, $('.sources-changes-toolbar'));
		this.stageSelectedButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.stageSelected', "Stage Selected"),
			...ghostActionButtonStyles,
		}));
		this.stageSelectedButton.icon = Codicon.add;
		this.unstageSelectedButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.unstageSelected', "Unstage Selected"),
			...ghostActionButtonStyles,
		}));
		this.unstageSelectedButton.icon = Codicon.remove;
		this.refreshButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.refresh', "Refresh Changes"),
			...ghostActionButtonStyles,
		}));
		this.refreshButton.icon = Codicon.refresh;
		this.expandAllButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.expandAll', "Expand All Folders"),
			...ghostActionButtonStyles,
		}));
		this.expandAllButton.icon = Codicon.chevronDown;
		this.collapseAllButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.collapseAll', "Collapse All Folders"),
			...ghostActionButtonStyles,
		}));
		this.collapseAllButton.icon = Codicon.chevronUp;

		this.contentContainer = dom.append(host, $('.sources-changes-content'));
		this.listContainer = dom.append(this.contentContainer, $('.sources-changes-list'));
		this.emptyMessage = dom.append(this.contentContainer, $('.sources-changes-empty'));
		this.emptyMessage.setAttribute('role', 'status');
		this.emptyMessage.style.display = 'none';

		this.commitRow = dom.append(host, $('.sources-changes-commit'));
		this.commitInput = dom.append(this.commitRow, $('textarea.sources-changes-commit-input')) as HTMLTextAreaElement;
		this.commitInput.rows = 1;
		this.commitInput.placeholder = localize('sourcesChangesList.commitMessage', "Commit message");
		this.commitInput.setAttribute('aria-label', localize('sourcesChangesList.commitMessage', "Commit message"));
		this.commitInput.title = localize('sourcesChangesList.commitHint', "Enter commits. Shift+Enter inserts a new line.");
		this.commitButton = this._register(new Button(this.commitRow, defaultButtonStyles));
		this.commitButton.label = localize('sourcesChangesList.commit', "Commit");
		this.provenance = dom.append(this.commitRow, $('.sources-changes-provenance'));
		this.provenance.setAttribute('role', 'status');
		this.provenance.style.display = 'none';
		const provenanceIcon = dom.append(this.provenance, $('span.sources-changes-provenance-icon.codicon.codicon-info'));
		provenanceIcon.setAttribute('aria-hidden', 'true');
		this.provenanceText = dom.append(this.provenance, $('span.sources-changes-provenance-text'));
		this.provenanceText.setAttribute('aria-hidden', 'true');

		this.statusMessage = dom.append(host, $('.sources-changes-status'));
		this.statusMessage.style.display = 'none';
		this.statusMessage.setAttribute('role', 'status');

		this._register(this.stageSelectedButton.onDidClick(() => void this.runOnSelected('stage').catch(onUnexpectedError)));
		this._register(this.unstageSelectedButton.onDidClick(() => void this.runOnSelected('unstage').catch(onUnexpectedError)));
		this._register(this.refreshButton.onDidClick(() => void this.changesModel.refresh().catch(onUnexpectedError)));
		this._register(this.expandAllButton.onDidClick(() => this.setAllFoldersExpanded(true)));
		this._register(this.collapseAllButton.onDidClick(() => this.setAllFoldersExpanded(false)));
		this._register(this.commitButton.onDidClick(() => void this.runCommit().catch(onUnexpectedError)));
		this._register(dom.addStandardDisposableListener(this.commitInput, 'input', () => {
			const repo = this.activeRepository;
			if (repo && this.commitInput.value !== repo.input.value) {
				repo.input.setValue(this.commitInput.value, true);
				repo.provider.inputBoxTextModel.setValue(this.commitInput.value);
			}
			this.layoutCommitInput();
			this.updateCommitRow();
		}));
		this._register(dom.addDisposableListener(this.commitInput, 'keydown', (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);
			if (event.keyCode === KeyCode.Enter && !event.shiftKey && this.commitButton.enabled && !this.isCommitInFlight) {
				event.preventDefault();
				event.stopPropagation();
				void this.runCommit().catch(onUnexpectedError);
			}
		}));

		this._register(CommandsRegistry.onDidRegisterCommand(commandId => {
			if (commandId === SOURCES_GIT_STAGE_COMMAND || commandId === SOURCES_GIT_UNSTAGE_COMMAND || commandId === SOURCES_GIT_COMMIT_COMMAND) {
				this.renderFromSnapshot();
			}
		}));

		this._register(this.scmService.onDidAddRepository(repo => {
			this.registerRepository(repo);
		}));
		this._register(this.scmService.onDidRemoveRepository(repo => {
			this.unregisterRepository(repo);
		}));

		for (const repo of this.scmService.repositories) {
			this.registerRepository(repo);
		}

		this._register(this.changesModel.onDidChange(() => {
			void this.paintFromModel().catch(onUnexpectedError);
		}));
		this._register(this.session.onDidChangeActiveSession(() => this.refreshStageChrome()));
		void this.paintFromModel().catch(onUnexpectedError);
		// Leak tests flush this proxy. The model owns the timer.
		void this.refreshScheduler;
	}

	override dispose(): void {
		this.toolbar.remove();
		this.contentContainer.remove();
		this.commitRow.remove();
		this.host.classList.remove('show-file-icons', 'sources-changes-host');
		super.dispose();
	}

	isGitCommandAvailable(commandId: string): boolean {
		return !!CommandsRegistry.getCommand(commandId);
	}

	/** Phase connected + pairingPending — leftover-looks-live still refuses writes. */
	isSourcesGitWritePairingHold(): boolean {
		return this.session.isPairingHold();
	}

	/** Catalog leftover contract: git-read list-fail leftover is not a live write surface. */
	isSourcesGitWriteListFailed(): boolean {
		return isSourcesChangesReadFailed(this.changesModel.getSnapshot().state);
	}

	/** D449 / D459 KEEP leftover list-fail: connected + !pairingPending + session not ready. */
	isSourcesKeepLeftoverWrite(): boolean {
		return isSourcesKeepLeftoverWrite(
			this.uaConnection.isEngineConnected(),
			!!this.uaConnection.getConnectionSnapshot?.().pairingPending,
			this.getEngineSessionReady(),
		);
	}

	private isSourcesGitWriteClosed(): boolean {
		return this.changesModel.isWriteClosed();
	}

	private getEngineSessionReady(): boolean {
		return getConversationSessionReadiness(conversationSessionReadinessProbe(this.session)) === 'ready';
	}

	/** List-fail leftover or KEEP pairing-hold leftover is not a live FileDiff / preview surface (D444 / D446). */
	isSourcesGitFileDiffOpenSkipped(): boolean {
		return this.changesModel.isFileDiffOpenSkipped();
	}

	canWriteStage(): boolean {
		return canSendSourcesGitStagePaths(
			this.uaConnection.isEngineConnected(),
			sourcesGitWriteHookPresent(this.uaConnection.getConnectionSnapshot?.(), 'writeGitStagePaths', this.uaConnection.writeGitStagePaths),
			this.writeSessionId(this.list?.getSelectedElements()),
			this.isSourcesGitWritePairingHold(),
			this.isSourcesGitWriteListFailed(),
			this.getEngineSessionReady(),
		);
	}

	isEngineStageButtonBlocked(entry: ISourcesChangeEntry): boolean {
		return isSourcesEngineStageButtonBlocked(
			this.changesModel.getSnapshot().state.kind,
			entry.origin,
			entry.sessionId,
			entry.gitPath,
			this.session.getActiveSessionId(),
		);
	}

	writeHoldReason(): string | undefined {
		if (this.isSourcesGitWritePairingHold()) {
			return sourcesGitReadPairingHoldMessage();
		}
		if (this.isSourcesGitWriteListFailed() || this.isSourcesKeepLeftoverWrite() || this.isSourcesGitWriteClosed()) {
			return localize('sourcesChangesList.sessionNotReady', "The engine is connected, but the active session is not ready.");
		}
		return undefined;
	}

	stageBlockReason(entry: ISourcesChangeEntry): string | undefined {
		if (!this.isEngineStageButtonBlocked(entry)) {
			return undefined;
		}
		if (isSourcesEngineWriteSessionBlocked(entry.origin, entry.sessionId, this.session.getActiveSessionId())) {
			return sourcesGitSessionChangedMessage();
		}
		return sourcesGitEmptyStagePathMessage();
	}

	groupStageBlockReason(groupId: string): string | undefined {
		if (!this.isGroupStageBlocked(groupId)) {
			return undefined;
		}
		const activeSessionId = this.session.getActiveSessionId();
		const stageable = this.entriesInGroup(groupId).filter(entry => isSourcesChangeStageable(entry.groupId));
		if (stageable.some(entry => isSourcesEngineWriteSessionBlocked(entry.origin, entry.sessionId, activeSessionId))) {
			return sourcesGitSessionChangedMessage();
		}
		return sourcesGitEmptyStagePathMessage();
	}

	isGroupStageBlocked(groupId: string): boolean {
		const snapshot = this.changesModel.getSnapshot();
		const listed = this.entriesInGroup(groupId);
		const source = listed.length > 0 ? listed : snapshot.entries.filter(entry => entry.groupId === groupId);
		const activeSessionId = this.session.getActiveSessionId();
		const stageable = source.filter(entry => isSourcesChangeStageable(entry.groupId));
		return stageable.length > 0 && stageable.every(entry => isSourcesEngineStageButtonBlocked(
			snapshot.state.kind,
			entry.origin,
			entry.sessionId,
			entry.gitPath,
			activeSessionId,
		));
	}

	canWriteCommit(): boolean {
		return canSendSourcesGitCommit(
			this.uaConnection.isEngineConnected(),
			sourcesGitWriteHookPresent(this.uaConnection.getConnectionSnapshot?.(), 'writeGitCommit', this.uaConnection.writeGitCommit),
			this.writeSessionId(this.changesModel.getSnapshot().entries),
			this.isSourcesGitWritePairingHold(),
			this.isSourcesGitWriteListFailed(),
			this.getEngineSessionReady(),
		);
	}

	private writeSessionId(entries?: readonly { sessionId?: string }[]): string {
		return sourcesChangesWriteSessionId(this.changesModel.getSnapshot(), entries, this.session.getActiveSessionId());
	}

	onRowAction(entry: ISourcesChangeEntry, action: SourcesChangeRowAction): void {
		void this.runResourceAction(entry, action).catch(onUnexpectedError);
	}

	private registerRepository(repo: ISCMRepository): void {
		if (this.inputListeners.has(repo)) {
			return;
		}

		const inputStore = new DisposableStore();
		inputStore.add(repo.input.onDidChange(() => this.syncCommitInputFromRepository()));
		this.inputListeners.set(repo, inputStore);
	}

	private unregisterRepository(repo: ISCMRepository): void {
		this.inputListeners.deleteAndDispose(repo);
		if (this.activeRepository === repo) {
			this.activeRepository = undefined;
		}
	}

	private scheduleRefresh(): void {
		this.changesModel.scheduleRefresh();
	}

	// Click and the alternate-slot menu share one open-status generation. This list does not mark reviewed.
	private async openChangeEntry(element: ISourcesChangeEntry, options: ISourcesChangeEntryOpenOptions): Promise<void> {
		// List-fail leftover and KEEP pairing-hold leftover are not live FileDiff / preview surfaces (D444 / D446).
		if (this.isSourcesGitFileDiffOpenSkipped()) {
			return;
		}

		const generation = beginSourcesChangesOpenStatus();
		try {
			const opened = await openSourcesChangeEntry(element, {
				commandService: this.commandService,
				editorService: this.editorService,
				quickDiffService: this.quickDiffService,
				configurationService: this.configurationService,
				instantiationService: this.instantiationService,
				sourcesDiffPanelService: this.sourcesDiffPanelService,
				modelService: this.modelService,
				readGitFileDiff: entry => this.readGitFileDiff(entry),
				editorGroupsService: this.editorGroupsService,
				session: this.session,
			}, options);
			settleSourcesOpenStatus(generation, isCurrentSourcesChangesOpenStatus, opened, {
				onFalse: () => {
					this.setOpenStatusMessage(sourcesGitDiffOpenFailureMessage(new Error(sourcesChangeOpenIncompleteMessage())));
				},
				onTrue: () => {
					this.setOpenStatusMessage(undefined);
				},
			});
		} catch (error) {
			if (!isCurrentSourcesChangesOpenStatus(generation)) {
				return;
			}
			this.setOpenStatusMessage(sourcesGitDiffOpenFailureMessage(error));
		}
	}

	private ensureList(): WorkbenchList<ISourcesChangeEntry> {
		if (this.list) {
			return this.list;
		}

		this.labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const delegate = new SourcesChangesDelegate(
			element => this.isGroupStart(element),
			element => this.folderHeaders(element),
			element => this.isFolderCollapsedAnchor(element),
		);
		const renderer = new SourcesChangesRenderer(this.labels, this, this.onDidChangeCheckedState.event);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'SourcesChanges',
			this.listContainer,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (element: ISourcesChangeEntry) => sourcesChangeEntryIdentity(element) },
				accessibilityProvider: new SourcesChangesAccessibilityProvider(element => this.describeEntry(element)),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesChangeEntry>;

		this._register(this.list.onDidOpen(e => {
			void (async () => {
				const element = e.element;
				if (!element) {
					return;
				}
				// List-fail leftover and KEEP pairing-hold leftover are not live FileDiff / preview surfaces (D444 / D446).
				if (this.isSourcesGitFileDiffOpenSkipped()) {
					return;
				}

				await this.openChangeEntry(element, {
					preserveFocus: e.editorOptions.preserveFocus,
					pinned: e.editorOptions.pinned,
					slot: e.sideBySide ? undefined : sourcesEditorOpenSlot(this.configurationService),
				});
			})().catch(onUnexpectedError);
		}));

		this._register(this.list.onDidChangeSelection(() => this.updateSelectionToolbar()));

		this._register(this.list.onContextMenu(e => {
			const element = e.element;
			if (!element || this.isSourcesGitFileDiffOpenSkipped()) {
				return;
			}
			const current = sourcesEditorOpenSlot(this.configurationService);
			this.contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => [sourcesAlternateOpenAction(current, slot => {
					void this.openChangeEntry(element, { preserveFocus: true, slot }).catch(onUnexpectedError);
				})],
			});
		}));

		this.listViewport = this._register(new SourcesListViewport(this.listContainer, () => this.list));
		return this.list;
	}

	private async paintFromModel(): Promise<void> {
		this.renderFromSnapshot();
	}

	/** Filter and other synchronous paints re-read the snapshot and do not start a git read. */
	private renderFromSnapshot(): void {
		if (this._store.isDisposed) {
			return;
		}
		const snapshot = this.changesModel.getSnapshot();
		this.activeRepository = snapshot.state.kind === 'scm'
			? uniqueSourcesStagedRepository(this.scmService.repositories)
			: undefined;
		if (!snapshot.settled) {
			if (!this.list || this.list.length === 0) {
				this.emptyMessage.textContent = localize('sourcesChangesList.loading', "Loading…");
				this.emptyMessage.style.display = '';
				this.listContainer.style.display = 'none';
			}
			return;
		}
		if (snapshot.failureMessage) {
			this.writeStatusMessage = undefined;
		}

		const allEntries = snapshot.entries;
		const gitReadError = snapshot.failureMessage;
		const hasRepository = snapshot.state.kind !== 'scm' || this.scmService.repositoryCount > 0;
		const entries = filterSourcesEntries(allEntries, this.filterBox.value);
		const hasAnyEntries = allEntries.length > 0;
		const hasVisibleEntries = entries.length > 0;

		this.gitCommandsAvailable = this.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND)
			|| this.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND)
			|| this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND);

		if (gitReadError && !hasAnyEntries) {
			this.emptyMessage.textContent = gitReadError;
		} else if (!hasRepository) {
			this.emptyMessage.textContent = localize('sourcesChangesList.noRepository', "No source control repository.");
		} else if (!hasAnyEntries) {
			this.emptyMessage.textContent = localize('sourcesChangesList.noChanges', "No changes.");
		} else if (!hasVisibleEntries) {
			this.emptyMessage.textContent = localize('sourcesChangesList.noMatching', "No matching changes.");
		}

		this.emptyMessage.classList.toggle('is-error', !!gitReadError && !hasAnyEntries);
		this.emptyMessage.style.display = hasVisibleEntries ? 'none' : '';
		this.listContainer.style.display = hasVisibleEntries ? 'block' : 'none';
		this.filterBox.setAvailable(hasAnyEntries);
		this.commitRow.style.display = hasRepository && !(gitReadError && !hasAnyEntries) ? 'flex' : 'none';

		this.renderStatus(snapshot);

		this.syncCommitInputFromRepository();
		this.updateCommitRow();

		this.rememberGroups(entries);
		this.checkedEntryIds.forEach(id => {
			if (!entries.some(entry => sourcesChangeEntryIdentity(entry) === id)) {
				this.checkedEntryIds.delete(id);
			}
		});
		if (this.list) {
			this.list.splice(0, this.list.length, this.getVisibleEntries(entries));
		} else if (hasVisibleEntries) {
			this.ensureList().splice(0, 0, this.getVisibleEntries(entries));
		}
		this.listViewport?.layout();
		this.updateSelectionToolbar();
	}

	private getGitResourceRoot(): URI | undefined {
		const sessionId = this.session.getActiveSessionId();
		return resolveSourcesGitResourceRoot({
			workDir: this.session.getWorkRoot?.(sessionId)?.workDir,
			repositoryRoots: sourcesRepositoryRootUris(this.scmService.repositories),
			workspaceFolders: this.workspaceContext.getWorkspace().folders.map(folder => folder.uri),
		});
	}

	private async readGitFileDiff(entry: ISourcesChangeEntry) {
		const hook = this.uaConnection.readGitFileDiff;
		return tryReadSourcesGitFileDiff(
			this.uaConnection.isEngineConnected(),
			hook ? request => hook.call(this.uaConnection, request) : undefined,
			this.writeSessionId([entry]),
			entry.gitPath ?? '',
			entry.indexState ?? '',
			this.isSourcesGitWritePairingHold(),
			this.isSourcesGitWriteListFailed(),
		);
	}

	isGroupStart(entry: ISourcesChangeEntry): boolean {
		return this.groupStartKeys.has(sourcesChangeEntryIdentity(entry));
	}

	groupCount(groupId: string): number {
		return this.groupCounts.get(groupId) ?? 0;
	}

	groupCheckboxState(groupId: string): boolean | 'mixed' {
		return this.selectionState(this.entriesInGroup(groupId));
	}

	groupCheckboxEnabled(groupId: string): boolean {
		return this.entriesInGroup(groupId).some(entry => this.isEntryCheckboxEnabled(entry));
	}

	setGroupChecked(groupId: string, checked: boolean): void {
		for (const entry of this.entriesInGroup(groupId)) {
			this.setEntryChecked(entry, checked, false);
		}
		this.onDidChangeCheckedState.fire();
		this.updateSelectionToolbar();
	}

	isGroupExpanded(groupId: string): boolean {
		return this.expandedGroupIds.has(groupId);
	}

	toggleGroup(groupId: string): void {
		if (this.expandedGroupIds.has(groupId)) {
			this.expandedGroupIds.delete(groupId);
		} else {
			this.expandedGroupIds.add(groupId);
		}
		this.refreshVisibleList();
	}

	toggleFolder(folderId: string): void {
		if (this.expandedFolderIds.has(folderId)) {
			this.expandedFolderIds.delete(folderId);
		} else {
			this.expandedFolderIds.add(folderId);
		}
		this.refreshVisibleList();
	}

	folderHeaders(entry: ISourcesChangeEntry): readonly ISourcesChangeFolderHeader[] {
		if (!this.isGroupExpanded(entry.groupId)) {
			return [];
		}
		const headers = this.folderHeadersByEntry.get(sourcesChangeEntryIdentity(entry)) ?? [];
		const collapsedIndex = this.folderIdsForEntry(entry).findIndex(id => !this.expandedFolderIds.has(id));
		const visible = collapsedIndex < 0 ? headers : headers.filter(header => header.depth <= collapsedIndex);
		return visible.map(header => ({ ...header, expanded: this.expandedFolderIds.has(header.id) }));
	}

	folderCheckboxState(folderId: string): boolean | 'mixed' {
		return this.selectionState(this.folderEntries.get(folderId) ?? []);
	}

	folderCheckboxEnabled(folderId: string): boolean {
		return (this.folderEntries.get(folderId) ?? []).some(entry => this.isEntryCheckboxEnabled(entry));
	}

	setFolderChecked(folderId: string, checked: boolean): void {
		for (const entry of this.folderEntries.get(folderId) ?? []) {
			this.setEntryChecked(entry, checked, false);
		}
		this.onDidChangeCheckedState.fire();
		this.updateSelectionToolbar();
	}

	isFolderCollapsedAnchor(entry: ISourcesChangeEntry): boolean {
		return this.collapsedAnchorIds.has(sourcesChangeEntryIdentity(entry));
	}

	setEntryChecked(entry: ISourcesChangeEntry, checked: boolean, refresh = true): void {
		const id = sourcesChangeEntryIdentity(entry);
		if (checked && this.isEntryCheckboxEnabled(entry)) {
			this.checkedEntryIds.add(id);
		} else {
			this.checkedEntryIds.delete(id);
		}
		if (refresh) {
			this.onDidChangeCheckedState.fire();
			this.updateSelectionToolbar();
		}
	}

	isEntryChecked(entry: ISourcesChangeEntry): boolean {
		return this.checkedEntryIds.has(sourcesChangeEntryIdentity(entry));
	}

	groupHasScmResource(groupId: string): boolean {
		return this.entriesInGroup(groupId).some(entry => !!entry.scmResource);
	}

	getResourceRoot(): URI | undefined {
		return this.getGitResourceRoot();
	}

	onGroupAction(groupId: string, action: SourcesChangeRowAction): void {
		void this.runOnEntries(this.entriesInGroup(groupId), action).catch(onUnexpectedError);
	}

	private rememberGroups(entries: readonly ISourcesChangeEntry[]): void {
		this.currentEntries = entries;
		this.groupStartKeys = sourcesChangeGroupStartIdentities(entries);
		this.groupCounts = new Map(sourcesChangeGroupCounts(entries));
		const root = this.getGitResourceRoot();
		this.folderHeadersByEntry = new Map();
		this.folderCounts = new Map();
		this.folderEntries = new Map();
		this.folderFirstEntries = new Map();
		const headersByEntry = new Map<string, ISourcesChangeFolderHeader[]>();
		for (const entry of entries) {
			const identity = sourcesChangeEntryIdentity(entry);
			const parent = sourcesChangeParentDirectory(entry.gitPath, entry.resource, root);
			const segments = parent.split(/[\\/]/).filter(Boolean);
			let path = '';
			const headers: ISourcesChangeFolderHeader[] = [];
			for (let depth = 0; depth < segments.length; depth++) {
				path = path ? `${path}/${segments[depth]}` : segments[depth];
				const id = `${entry.groupId}\0${path}`;
				if (!this.expandedFolderIds.has(id)) {
					this.expandedFolderIds.add(id);
				}
				const folderEntries = this.folderEntries.get(id) ?? [];
				folderEntries.push(entry);
				this.folderEntries.set(id, folderEntries);
				this.folderCounts.set(id, folderEntries.length);
				if (!this.folderFirstEntries.has(id)) {
					this.folderFirstEntries.set(id, identity);
				}
				if (this.folderFirstEntries.get(id) === identity) {
					headers.push({ id, label: segments[depth], depth, count: 0, expanded: this.expandedFolderIds.has(id) });
				}
			}
			headersByEntry.set(identity, headers);
			if (!this.expandedGroupIds.has(entry.groupId)) {
				this.expandedGroupIds.add(entry.groupId);
			}
		}
		for (const [identity, headers] of headersByEntry) {
			this.folderHeadersByEntry.set(identity, headers.map(header => ({
				...header,
				count: this.folderCounts.get(header.id) ?? 0,
				expanded: this.expandedFolderIds.has(header.id),
			})));
		}
	}

	private folderIdsForEntry(entry: ISourcesChangeEntry): string[] {
		const parent = sourcesChangeParentDirectory(entry.gitPath, entry.resource, this.getGitResourceRoot());
		const segments = parent.split(/[\\/]/).filter(Boolean);
		const ids: string[] = [];
		let path = '';
		for (const segment of segments) {
			path = path ? `${path}/${segment}` : segment;
			ids.push(`${entry.groupId}\0${path}`);
		}
		return ids;
	}

	private getVisibleEntries(entries: readonly ISourcesChangeEntry[]): ISourcesChangeEntry[] {
		this.collapsedAnchorIds.clear();
		const visible: ISourcesChangeEntry[] = [];
		for (const entry of entries) {
			if (!this.expandedGroupIds.has(entry.groupId)) {
				if (this.groupStartKeys.has(sourcesChangeEntryIdentity(entry))) {
					this.collapsedAnchorIds.add(sourcesChangeEntryIdentity(entry));
					visible.push(entry);
				}
				continue;
			}
			const collapsedFolder = this.folderIdsForEntry(entry).find(id => !this.expandedFolderIds.has(id));
			if (collapsedFolder) {
				if (this.folderFirstEntries.get(collapsedFolder) === sourcesChangeEntryIdentity(entry)) {
					this.collapsedAnchorIds.add(sourcesChangeEntryIdentity(entry));
					visible.push(entry);
				}
				continue;
			}
			visible.push(entry);
		}
		return visible;
	}

	private refreshVisibleList(): void {
		if (this.list) {
			this.list.splice(0, this.list.length, this.getVisibleEntries(this.currentEntries));
			this.listViewport?.layout();
		}
	}

	private setAllFoldersExpanded(expanded: boolean): void {
		for (const id of this.folderCounts.keys()) {
			if (expanded) {
				this.expandedFolderIds.add(id);
			} else {
				this.expandedFolderIds.delete(id);
			}
		}
		for (const groupId of this.groupCounts.keys()) {
			if (expanded) {
				this.expandedGroupIds.add(groupId);
			} else {
				this.expandedGroupIds.delete(groupId);
			}
		}
		this.refreshVisibleList();
	}

	private selectionState(entries: readonly ISourcesChangeEntry[]): boolean | 'mixed' {
		const selectable = entries.filter(entry => this.isEntryCheckboxEnabled(entry));
		if (selectable.length === 0) {
			return false;
		}
		const checked = selectable.filter(entry => this.isEntryChecked(entry)).length;
		return checked === 0 ? false : checked === selectable.length ? true : 'mixed';
	}

	private isEntryCheckboxEnabled(entry: ISourcesChangeEntry): boolean {
		return this.isEntryStageOffered(entry)
			|| (isSourcesChangeUnstageable(entry.groupId) && !!entry.scmResource && this.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND));
	}

	private entriesInGroup(groupId: string): ISourcesChangeEntry[] {
		return this.currentEntries.filter(entry => entry.groupId === groupId);
	}

	private describeEntry(element: ISourcesChangeEntry): string {
		const parent = sourcesChangeParentDirectory(element.gitPath, element.resource, this.getGitResourceRoot());
		const mark = sourcesChangeStatusMark({
			groupId: element.groupId,
			indexState: element.indexState,
			kind: element.kind,
			strikeThrough: element.scmResource?.decorations.strikeThrough,
			tooltip: element.scmResource?.decorations.tooltip,
			iconPath: scmDecorationIconPath(element),
		});
		const parts: string[] = [];
		if (this.isGroupStart(element)) {
			parts.push(`${sourcesGitChangeDescription(element.groupId)}, ${this.groupCount(element.groupId)}`);
		}
		parts.push(element.name);
		if (parent) {
			parts.push(parent);
		}
		parts.push(mark.tooltip);
		return parts.join(', ');
	}

	private refreshStageChrome(): void {
		this.refreshVisibleList();
		this.updateSelectionToolbar();
	}

	private isEntryStageOffered(entry: ISourcesChangeEntry): boolean {
		if (!isSourcesChangeStageable(entry.groupId) || this.isEngineStageButtonBlocked(entry)) {
			return false;
		}
		return this.canWriteStage()
			|| (!!entry.scmResource && this.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND));
	}

	private updateSelectionToolbar(): void {
		const selected = this.checkedEntryIds.size > 0
			? this.currentEntries.filter(entry => this.checkedEntryIds.has(sourcesChangeEntryIdentity(entry)))
			: this.list?.getSelectedElements() ?? [];
		const canStage = selected.some(entry => this.isEntryStageOffered(entry));
		const canUnstage = selected.some(entry =>
			isSourcesChangeUnstageable(entry.groupId)
			&& !!entry.scmResource
			&& this.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND));

		this.presentToolbarAction(
			this.stageSelectedButton,
			localize('sourcesChangesList.stageSelected', "Stage Selected"),
			canStage && !this.isSourcesGitWriteClosed(),
			canStage ? undefined : localize('sourcesChangesList.selectChangeToStage', "Select a change to stage."),
		);
		this.presentToolbarAction(
			this.unstageSelectedButton,
			localize('sourcesChangesList.unstageSelected', "Unstage Selected"),
			canUnstage && !this.isSourcesGitWriteClosed(),
			canUnstage ? undefined : localize('sourcesChangesList.selectChangeToUnstage', "Select a staged change to unstage."),
		);
		const show = this.currentEntries.length > 0 && (
			this.stageSelectedButton.enabled
			|| this.unstageSelectedButton.enabled
			|| this.gitCommandsAvailable
		);
		const next = show ? 'flex' : 'none';
		if (this.toolbar.style.display !== next) {
			this.toolbar.style.display = next;
			this.listViewport?.layout();
		}
		this.refreshButton.enabled = this.gitCommandsAvailable;
		this.expandAllButton.enabled = this.folderCounts.size > 0;
		this.collapseAllButton.enabled = this.folderCounts.size > 0;
	}

	private async runOnSelected(action: SourcesChangeRowAction): Promise<void> {
		const selected = this.checkedEntryIds.size > 0
			? this.currentEntries.filter(entry => this.checkedEntryIds.has(sourcesChangeEntryIdentity(entry)))
			: this.list?.getSelectedElements() ?? [];
		await this.runOnEntries(selected, action);
	}

	private async runOnEntries(entries: readonly ISourcesChangeEntry[], action: SourcesChangeRowAction): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		if ((action === 'stage' || action === 'unstage') && this.isSourcesGitWriteClosed()) {
			return;
		}

		if (action === 'stage') {
			const snapshot = this.changesModel.getSnapshot();
			if (snapshot.state.kind !== 'scm') {
				const enginePathsBySession = new Map<string, string[]>();
				const otherEntries: ISourcesChangeEntry[] = [];
				for (const entry of entries) {
					if (!isSourcesChangeStageable(entry.groupId)) {
						continue;
					}
					if (entry.origin === 'engine') {
						if (isSourcesEngineWriteSessionBlocked(entry.origin, entry.sessionId, this.session.getActiveSessionId())) {
							this.setWriteStatusMessage(sourcesGitSessionChangedMessage());
							return;
						}
						if (!entry.gitPath) {
							this.setWriteStatusMessage(sourcesGitEmptyStagePathMessage());
							return;
						}
						const sessionId = entry.sessionId ?? '';
						let paths = enginePathsBySession.get(sessionId);
						if (!paths) {
							paths = [];
							enginePathsBySession.set(sessionId, paths);
						}
						paths.push(entry.gitPath);
					} else {
						otherEntries.push(entry);
					}
				}

				for (const [sessionId, paths] of enginePathsBySession) {
					if (this._store.isDisposed) {
						return;
					}
					const handled = await this.tryStagePaths(paths, sessionId);
					if (this._store.isDisposed) {
						return;
					}
					if (!handled) {
						this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
					}
				}

				for (const entry of otherEntries) {
					if (this._store.isDisposed) {
						return;
					}
					await this.runResourceAction(entry, action);
					if (this._store.isDisposed) {
						return;
					}
				}
				return;
			}
		}

		for (const entry of entries) {
			if (this._store.isDisposed) {
				return;
			}
			await this.runResourceAction(entry, action);
			if (this._store.isDisposed) {
				return;
			}
		}
	}

	private async runResourceAction(entry: ISourcesChangeEntry, action: SourcesChangeRowAction): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		if (action === 'stage' && !isSourcesChangeStageable(entry.groupId)) {
			return;
		}
		if (action === 'unstage' && !isSourcesChangeUnstageable(entry.groupId)) {
			return;
		}
		if ((action === 'stage' || action === 'unstage') && this.isSourcesGitWriteClosed()) {
			return;
		}

		if (action === 'unstage') {
			await this.runLocalGitResource(entry, SOURCES_GIT_UNSTAGE_COMMAND);
			return;
		}

		const snapshot = this.changesModel.getSnapshot();
		if (snapshot.state.kind === 'scm' || entry.origin !== 'engine') {
			await this.runLocalGitResource(entry, SOURCES_GIT_STAGE_COMMAND);
			return;
		}

		if (isSourcesEngineWriteSessionBlocked(entry.origin, entry.sessionId, this.session.getActiveSessionId())) {
			this.setWriteStatusMessage(sourcesGitSessionChangedMessage());
			return;
		}
		// `gitPath === ''` is not a path. `??` leaves the empty string, so do not substitute resource.fsPath.
		if (!entry.gitPath) {
			this.setWriteStatusMessage(sourcesGitEmptyStagePathMessage());
			return;
		}
		const handled = await this.tryStagePaths([entry.gitPath], entry.sessionId ?? '');
		if (this._store.isDisposed) {
			return;
		}
		if (!handled) {
			this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
		}
	}

	private async runLocalGitResource(entry: ISourcesChangeEntry, commandId: string): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		const resource = entry.scmResource;
		if (!resource) {
			if (commandId === SOURCES_GIT_STAGE_COMMAND && this.canWriteStage()) {
				this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
			}
			return;
		}

		if (!this.isGitCommandAvailable(commandId)) {
			this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
			return;
		}

		try {
			await this.commandService.executeCommand(commandId, resource);
			if (this._store.isDisposed) {
				return;
			}
			this.setWriteStatusMessage(undefined);
			this.scheduleRefresh();
		} catch (error) {
			if (this._store.isDisposed) {
				return;
			}
			this.setWriteStatusMessage(commandId === SOURCES_GIT_STAGE_COMMAND
				? localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", getErrorMessage(error))
				: localize('sourcesChangesList.unstageFailed', "Unable to unstage: {0}", getErrorMessage(error)));
		}
	}

	private async tryStagePaths(paths: readonly string[], sessionId: string): Promise<boolean> {
		if (this.isSourcesGitWriteClosed()) {
			return true;
		}
		if (paths.some(path => !path)) {
			return false;
		}
		const hook = this.uaConnection.writeGitStagePaths;
		try {
			const result = await tryWriteSourcesGitStagePaths(
				this.uaConnection.isEngineConnected(),
				hook ? request => hook.call(this.uaConnection, request) : undefined,
				sessionId,
				paths,
				this.isSourcesGitWritePairingHold(),
				this.isSourcesGitWriteListFailed(),
				this.getEngineSessionReady(),
			);
			if (!result) {
				return false;
			}
			if (isSourcesGitWriteUnsupported(result)) {
				this.setWriteStatusMessage(localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", sourcesGitStageNotAcceptedMessage()));
				return true;
			}
			if (!isSourcesGitWriteAccepted(result)) {
				this.setWriteStatusMessage(localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", sourcesGitWriteFailureDetail(result) || sourcesGitStageNotAcceptedMessage()));
				return true;
			}
			this.setWriteStatusMessage(undefined);
			this.scheduleRefresh();
			return true;
		} catch (error) {
			this.setWriteStatusMessage(localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", getErrorMessage(error)));
			return true;
		}
	}

	private setOpenStatusMessage(message: string | undefined): void {
		this.openStatusMessage = message;
		this.renderStatus(this.changesModel.getSnapshot());
	}

	private renderStatus(snapshot: ISourcesChangesSnapshot): void {
		const readError = snapshot.failureMessage;
		const hasEntries = snapshot.entries.length > 0;
		const hasRepository = snapshot.state.kind !== 'scm' || this.scmService.repositoryCount > 0;
		const pairingHold = snapshot.state.kind === 'engine-leftover' && snapshot.state.reason === 'pairing-hold';
		const noHook = snapshot.state.kind === 'engine-leftover' && snapshot.state.reason === 'no-hook';
		if (readError) {
			this.presentStatus(hasEntries ? readError : undefined, undefined);
		} else if (this.openStatusMessage && !pairingHold && !noHook) {
			this.presentStatus(this.openStatusMessage, undefined);
		} else if (this.writeStatusMessage) {
			this.presentStatus(this.writeStatusMessage, undefined);
		} else if (pairingHold) {
			this.presentStatus(sourcesGitReadPairingHoldMessage(), undefined);
		} else if (noHook) {
			this.presentStatus(sourcesGitReadUnavailableNoHookMessage(), undefined);
		} else if (snapshot.state.kind === 'scm' && hasEntries) {
			this.presentStatus(undefined, sourcesGitLocalOnlyMessage());
		} else if (hasRepository && !this.gitCommandsAvailable && !this.canWriteStage() && !this.canWriteCommit()) {
			this.presentStatus(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."), undefined);
		} else {
			this.presentStatus(undefined, undefined);
		}
	}

	private setWriteStatusMessage(message: string | undefined): void {
		this.writeStatusMessage = message;
		this.presentStatus(message, undefined);
	}

	private presentStatus(message: string | undefined, provenance: string | undefined): void {
		this.setStatusMessage(message);
		this.setProvenance(provenance);
	}

	private setProvenance(message: string | undefined): void {
		if (!message) {
			this.provenanceText.textContent = '';
			this.provenance.title = '';
			this.provenance.removeAttribute('aria-label');
			this.provenance.style.display = 'none';
			return;
		}
		this.provenanceText.textContent = message;
		this.provenance.title = message;
		this.provenance.setAttribute('aria-label', message);
		this.provenance.style.display = 'flex';
	}

	private setStatusMessage(message: string | undefined): void {
		if (!message) {
			this.statusMessage.textContent = '';
			this.statusMessage.style.display = 'none';
			this.statusMessage.classList.remove('is-error');
			return;
		}
		this.statusMessage.textContent = message;
		this.statusMessage.style.display = 'block';
		this.statusMessage.classList.toggle('is-error', isSourcesChangesErrorStatus(message));
	}

	private syncCommitInputFromRepository(): void {
		const repo = this.activeRepository;
		if (!repo) {
			// Engine and other paints with no repository have nothing to copy.
			// Leave a message the user already typed in this textarea.
			return;
		}

		const value = repo.input.value;
		if (this.commitInput.value !== value) {
			this.commitInput.value = value;
			this.layoutCommitInput();
		}
	}

	/** Keep the commit field one line with the button, and grow with Shift+Enter. */
	private layoutCommitInput(): void {
		const input = this.commitInput;
		const min = 28;
		const max = 112;
		input.style.height = 'auto';
		const border = Math.max(0, input.offsetHeight - input.clientHeight);
		const scroll = input.scrollHeight + border;
		const next = scroll > 0 ? Math.min(Math.max(scroll, min), max) : min;
		input.style.height = `${next}px`;
	}

	private setCommitButtonLabel(repositoryName: string): string {
		const label = repositoryName
			? localize('sourcesChangesList.commitRepo', "Commit ({0})", repositoryName)
			: localize('sourcesChangesList.commit', "Commit");
		this.commitButton.label = label;
		return label;
	}

	private presentToolbarAction(button: Button, label: string, enabled: boolean, idleReason: string | undefined): void {
		const reason = this.writeHoldReason() ?? (enabled ? undefined : idleReason);
		button.enabled = enabled && !this.writeHoldReason();
		button.setTitle(reason ?? label);
		button.setAriaLabel(reason ? `${label}. ${reason}` : label);
	}

	private updateCommitRow(): void {
		const hasMessage = this.commitInput.value.trim().length > 0;
		const snapshot = this.changesModel.getSnapshot();
		if (snapshot.state.kind === 'scm') {
			const staged = uniqueSourcesStagedRepository(this.scmService.repositories);
			const repo = this.activeRepository === staged ? staged : undefined;
			const commitLabel = this.setCommitButtonLabel(repo ? sourcesRepositoryCommitName(repo) : '');
			const acceptCommand = repo?.provider.acceptInputCommand;
			const localCommit = (!!acceptCommand?.id && this.isGitCommandAvailable(acceptCommand.id))
				|| this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND);
			this.commitInput.disabled = !repo || this.isCommitInFlight;
			this.presentToolbarAction(
				this.commitButton,
				commitLabel,
				!this.isCommitInFlight && !!repo && hasMessage && localCommit && !this.isSourcesGitWriteClosed(),
				!hasMessage
					? localize('sourcesChangesList.commitNeedsMessage', "Enter a commit message.")
					: localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."),
			);
			return;
		}

		const commitLabel = this.setCommitButtonLabel('');
		const repo = this.activeRepository;
		const acceptCommand = repo?.provider.acceptInputCommand;
		const commitAvailable = this.canWriteCommit()
			|| (!!acceptCommand?.id && this.isGitCommandAvailable(acceptCommand.id))
			|| this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND);

		this.commitInput.disabled = (!repo && !this.canWriteCommit()) || this.isCommitInFlight;
		this.presentToolbarAction(
			this.commitButton,
			commitLabel,
			!this.isCommitInFlight
				&& (!this.isSourcesGitWriteClosed())
				&& (!!repo || this.canWriteCommit())
				&& hasMessage
				&& commitAvailable,
			!hasMessage
				? localize('sourcesChangesList.commitNeedsMessage', "Enter a commit message.")
				: localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."),
		);
	}

	/** Snapshot or leftover-row session. Never the active session. */
	private commitSessionId(snapshot: ISourcesChangesSnapshot): string {
		for (const entry of snapshot.entries) {
			if (entry.sessionId) {
				return entry.sessionId;
			}
		}
		if (snapshot.state.kind !== 'scm') {
			return snapshot.state.sessionId;
		}
		return '';
	}

	private async runLocalCommit(repo: ISCMRepository | undefined, repository: ISCMRepository | undefined): Promise<void> {
		if (this._store.isDisposed || this.activeRepository !== repository) {
			return;
		}
		if (!repo) {
			this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
			return;
		}

		const acceptCommand = repo.provider.acceptInputCommand;
		if (acceptCommand?.id && this.isGitCommandAvailable(acceptCommand.id)) {
			try {
				await this.commandService.executeCommand(acceptCommand.id, ...(acceptCommand.arguments ?? []));
				this.setWriteStatusMessage(undefined);
			} catch (error) {
				this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
			}
			return;
		}

		if (this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND)) {
			try {
				await this.commandService.executeCommand(SOURCES_GIT_COMMIT_COMMAND);
				this.setWriteStatusMessage(undefined);
			} catch (error) {
				this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
			}
			return;
		}

		this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
	}

	private async runEngineCommit(sessionId: string, message: string, repository: ISCMRepository | undefined): Promise<void> {
		const writeHook = this.uaConnection.writeGitCommit;
		try {
			const written = await tryWriteSourcesGitCommit(
				this.uaConnection.isEngineConnected(),
				writeHook ? request => writeHook.call(this.uaConnection, request) : undefined,
				sessionId,
				message,
				this.isSourcesGitWritePairingHold(),
				this.isSourcesGitWriteListFailed(),
				this.getEngineSessionReady(),
			);
			if (this._store.isDisposed || this.activeRepository !== repository) {
				return;
			}
			if (isSourcesGitWriteAccepted(written)) {
				// The accepted result belongs to the session this commit was
				// issued for. If the active session changed while the write was
				// in flight, its status line describes the new session and must
				// not be cleared by the previous one.
				if (this.session.getActiveSessionId() === sessionId) {
					this.setWriteStatusMessage(undefined);
				}
				this.scheduleRefresh();
				return;
			}
			if (!written || isSourcesGitWriteUnsupported(written)) {
				this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
				return;
			}
			const detail = sourcesGitWriteFailureDetail(written) || sourcesGitCommitNotAcceptedMessage();
			this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", detail));
		} catch (error) {
			if (this._store.isDisposed || this.activeRepository !== repository) {
				return;
			}
			this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
		}
	}

	private async runCommit(): Promise<void> {
		if (this.isCommitInFlight || this.isSourcesGitWriteClosed()) {
			return;
		}
		this.isCommitInFlight = true;
		this.updateCommitRow();
		try {
			const message = this.commitInput.value;
			if (!message.trim()) {
				return;
			}

			const snapshot = this.changesModel.getSnapshot();
			if (snapshot.state.kind === 'scm') {
				const staged = uniqueSourcesStagedRepository(this.scmService.repositories);
				if (!staged || this.activeRepository !== staged) {
					return;
				}
				staged.input.setValue(message, false);
				staged.provider.inputBoxTextModel.setValue(message);
				await this.runLocalCommit(staged, staged);
				return;
			}

			const repo = this.activeRepository;
			if (!repo && !this.canWriteCommit()) {
				this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
				return;
			}
			const commitSessionId = this.commitSessionId(snapshot);
			if (isSourcesEngineWriteSessionBlocked('engine', commitSessionId, this.session.getActiveSessionId())) {
				this.setWriteStatusMessage(sourcesGitSessionChangedMessage());
				return;
			}
			await this.runEngineCommit(commitSessionId, message, this.activeRepository);
		} finally {
			this.isCommitInFlight = false;
			this.updateCommitRow();
		}
	}
}
