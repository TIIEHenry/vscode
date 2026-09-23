/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesDiffPanel.css';
import * as dom from '../../../../base/browser/dom.js';
import { DisposableStore, IReference, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { basename } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IDiffEditorConstructionOptions } from '../../../../editor/browser/editorBrowser.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { DiffEditorWidget } from '../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { IEditorOptions } from '../../../../editor/common/config/editorOptions.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { EditorModel } from '../../../common/editor/editorModel.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { isConversationPairingHold } from '../../conversation/browser/conversationSessionStatus.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { ISCMResource, ISCMService } from '../../scm/common/scm.js';
import { findScmResourceForUri, ISourcesChangeRef, sourcesDiffLocalWritePath, sourcesGitApplyHunksPatches } from '../common/sourcesChangeRef.js';
import {
	isSourcesChangeStageable,
	SOURCES_GIT_CLEAN_COMMAND,
	SOURCES_GIT_STAGE_COMMAND,
	SOURCES_GIT_UNSTAGE_COMMAND,
} from '../common/sourcesChangesGit.js';
import {
	attemptSourcesGitWrite,
	canSendSourcesGitApplyHunks,
	canSendSourcesGitStagePaths,
	hasSourcesGitApplyHunksPayload,
	isSourcesKeepLeftoverWrite,
	resolveSourcesDiffWriteActions,
	sourcesGitUnstageUnavailableMessage,
	tryWriteSourcesGitApplyHunks,
	tryWriteSourcesGitStagePaths,
} from '../common/sourcesChangesGitWrite.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { SOURCES_DIFF_PANEL_VIEW_ID } from './sourcesDiffPanelIds.js';

const $ = dom.$;

export function sourcesDiffPanelComparisonLoadFailedMessage(): string {
	return localize('sourcesDiffPanel.loadFailed', "Unable to load this comparison.");
}

interface ISourcesDiffPanelComparisonWatch {
	started: boolean;
	settled: boolean;
	readonly whenSettled: Promise<boolean>;
	resolve(ok: boolean): void;
}

const sourcesDiffPanelComparisonWatches = new WeakMap<object, ISourcesDiffPanelComparisonWatch>();

function getSourcesDiffPanelComparisonWatch(ref: object): ISourcesDiffPanelComparisonWatch {
	const existing = sourcesDiffPanelComparisonWatches.get(ref);
	if (existing) {
		return existing;
	}

	let resolve!: (ok: boolean) => void;
	const whenSettled = new Promise<boolean>(ok => {
		resolve = ok;
	});
	const watch: ISourcesDiffPanelComparisonWatch = {
		started: false,
		settled: false,
		whenSettled,
		resolve: (ok: boolean) => {
			if (!watch.settled) {
				watch.settled = true;
				resolve(ok);
			}
		},
	};
	sourcesDiffPanelComparisonWatches.set(ref, watch);
	return watch;
}

export function watchSourcesDiffPanelComparison(ref: object): { get started(): boolean; readonly whenSettled: Promise<boolean> } {
	const watch = getSourcesDiffPanelComparisonWatch(ref);
	return {
		get started() {
			return watch.started;
		},
		whenSettled: watch.whenSettled,
	};
}

function startSourcesDiffPanelComparison(ref: object): void {
	getSourcesDiffPanelComparisonWatch(ref).started = true;
}

function settleSourcesDiffPanelComparison(ref: object, ok: boolean): void {
	const watch = getSourcesDiffPanelComparisonWatch(ref);
	watch.started = true;
	watch.resolve(ok);
}

class SourcesDiffEditorModel extends EditorModel {
	readonly original: ITextModel;
	readonly modified: ITextModel;

	constructor(
		private readonly originalRef: IReference<IResolvedTextEditorModel>,
		private readonly modifiedRef: IReference<IResolvedTextEditorModel>,
	) {
		super();
		this.original = originalRef.object.textEditorModel;
		this.modified = modifiedRef.object.textEditorModel;
	}

	override dispose(): void {
		super.dispose();
		this.originalRef.dispose();
		this.modifiedRef.dispose();
	}
}

const readOnlyEditorOptions: IEditorOptions = {
	readOnly: true,
	scrollBeyondLastLine: false,
	minimap: { enabled: false },
	automaticLayout: false,
	lineNumbers: 'on',
};

export class SourcesDiffPanelView extends ViewPane {

	static readonly ID = SOURCES_DIFF_PANEL_VIEW_ID;

	private readonly bodyDisposables = this._register(new DisposableStore());
	private readonly diffWidget = this._register(new MutableDisposable<DiffEditorWidget>());
	private readonly codeWidget = this._register(new MutableDisposable<CodeEditorWidget>());
	private readonly model = this._register(new MutableDisposable<SourcesDiffEditorModel>());
	private readonly modifiedModelRef = this._register(new MutableDisposable<IReference<IResolvedTextEditorModel>>());

	private bodyContainer: HTMLElement | undefined;
	private editorContainer: HTMLElement | undefined;
	private headerElement: HTMLElement | undefined;
	private headerTitle: HTMLElement | undefined;
	private stageButton: HTMLButtonElement | undefined;
	private acceptButton: HTMLButtonElement | undefined;
	private revertButton: HTMLButtonElement | undefined;
	private unstageButton: HTMLButtonElement | undefined;
	private unstageUnavailable: HTMLElement | undefined;
	private newFileNoticeElement: HTMLElement | undefined;
	private actionNoticeElement: HTMLElement | undefined;
	private dimension: dom.Dimension | undefined;
	private currentRef: ISourcesChangeRef | undefined;
	private comparisonLoadFailed = false;
	private renderGeneration = 0;
	private renderSettledGeneration = 0;
	/** Engine stage accepted for this modified URI; hide Stage until renderRef switches away. */
	private stageEngineAcceptedModified: URI | undefined;
	/** git.clean succeeded for this modified URI; hide Revert until renderRef switches away. */
	private gitCleanSucceededModified: URI | undefined;
	/** git.unstage succeeded for this modified URI; hide Unstage until renderRef switches away. */
	private gitUnstageSucceededModified: URI | undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ITextModelService private readonly textModelService: ITextModelService,
		@ISourcesDiffPanelService private readonly sourcesDiffPanelService: ISourcesDiffPanelService,
		@ICommandService private readonly commandService: ICommandService,
		@ISCMService private readonly scmService: ISCMService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IConversationRosterService private readonly roster: IConversationRosterService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this.element.classList.add('sources-diff-panel');

		this._register(this.sourcesDiffPanelService.onDidChangeRef(ref => {
			this.currentRef = ref;
			void this.renderRef(ref).catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => {
			this.updateWriteActions();
			if (this.dimension) {
				this.layoutBody(this.dimension.height, this.dimension.width);
			}
		}));
		this._register(this.roster.onDidChangeActiveSession(() => {
			this.updateWriteActions();
			if (this.dimension) {
				this.layoutBody(this.dimension.height, this.dimension.width);
			}
		}));
		if (this.roster.onDidChangeSession) {
			this._register(this.roster.onDidChangeSession(() => {
				this.updateWriteActions();
				if (this.dimension) {
					this.layoutBody(this.dimension.height, this.dimension.width);
				}
			}));
		}

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('diffEditor.renderSideBySide') && this.diffWidget.value) {
				this.diffWidget.value.updateOptions(this.getDiffEditorOptions());
			}
		}));

		this.currentRef = this.sourcesDiffPanelService.getCurrentRef();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.bodyContainer = dom.append(container, $('.sources-diff-panel-body'));
		this.headerElement = dom.append(this.bodyContainer, $('.sources-diff-panel-header'));
		this.headerTitle = dom.append(this.headerElement, $('.sources-diff-panel-title'));
		const headerActions = dom.append(this.headerElement, $('.sources-diff-panel-actions'));

		this.stageButton = this.createHeaderAction(headerActions, 'sources-diff-panel-stage', localize('sourcesDiffPanel.stage', "Stage"), () => {
			void this.runStage().catch(onUnexpectedError).catch(onUnexpectedError);
		});
		this.acceptButton = this.createHeaderAction(headerActions, 'sources-diff-panel-accept', localize('sourcesDiffPanel.accept', "Accept"), () => {
			void this.runAccept().catch(onUnexpectedError).catch(onUnexpectedError);
		});
		this.revertButton = this.createHeaderAction(headerActions, 'sources-diff-panel-revert', localize('sourcesDiffPanel.revert', "Revert"), () => {
			void this.runGitAction(SOURCES_GIT_CLEAN_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
		});
		this.unstageButton = this.createHeaderAction(headerActions, 'sources-diff-panel-unstage', localize('sourcesDiffPanel.unstage', "Unstage"), () => {
			void this.runGitAction(SOURCES_GIT_UNSTAGE_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
		});
		this.unstageUnavailable = dom.append(headerActions, $('span.sources-diff-panel-unstage-unavailable'));
		this.unstageUnavailable.textContent = sourcesGitUnstageUnavailableMessage();
		this.unstageUnavailable.style.display = 'none';

		this.newFileNoticeElement = dom.append(this.bodyContainer, $('.sources-diff-panel-new-file-notice'));
		this.newFileNoticeElement.style.display = 'none';
		this.actionNoticeElement = dom.append(this.bodyContainer, $('.sources-diff-panel-action-notice'));
		this.actionNoticeElement.style.display = 'none';
		this.editorContainer = dom.append(this.bodyContainer, $('.sources-diff-panel-editor'));

		void this.renderRef(this.currentRef).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.dimension = new dom.Dimension(width, height);

		const headerHeight = this.headerElement?.offsetHeight ?? 0;
		const noticeHeight = this.newFileNoticeElement?.style.display === 'none' ? 0 : (this.newFileNoticeElement?.offsetHeight ?? 0);
		const actionNoticeHeight = this.actionNoticeElement?.style.display === 'none' ? 0 : (this.actionNoticeElement?.offsetHeight ?? 0);
		const editorHeight = Math.max(0, height - headerHeight - noticeHeight - actionNoticeHeight);
		const editorDimension = new dom.Dimension(width, editorHeight);

		this.diffWidget.value?.layout(editorDimension);
		this.codeWidget.value?.layout(editorDimension);
	}

	private getDiffEditorOptions(): IDiffEditorConstructionOptions {
		return {
			...readOnlyEditorOptions,
			originalEditable: false,
			renderSideBySide: this.configurationService.getValue<boolean>('diffEditor.renderSideBySide') ?? true,
			renderOverviewRuler: false,
		};
	}

	private async renderRef(ref: ISourcesChangeRef | undefined): Promise<void> {
		const generation = ++this.renderGeneration;
		if (this.stageEngineAcceptedModified && (!ref || ref.modified.toString() !== this.stageEngineAcceptedModified.toString())) {
			this.stageEngineAcceptedModified = undefined;
		}
		if (this.gitCleanSucceededModified && (!ref || ref.modified.toString() !== this.gitCleanSucceededModified.toString())) {
			this.gitCleanSucceededModified = undefined;
		}
		if (this.gitUnstageSucceededModified && (!ref || ref.modified.toString() !== this.gitUnstageSucceededModified.toString())) {
			this.gitUnstageSucceededModified = undefined;
		}
		this.bodyDisposables.clear();
		this.clearEditors();
		this.comparisonLoadFailed = false;

		if (!this.headerElement || !this.headerTitle || !this.newFileNoticeElement || !this.editorContainer) {
			if (ref) {
				startSourcesDiffPanelComparison(ref);
				settleSourcesDiffPanelComparison(ref, false);
			}
			this.settleRenderGeneration(generation);
			return;
		}

		this.hideActionNotice();
		this.hideWriteChrome();

		if (!ref) {
			this.headerTitle.textContent = '';
			this.headerTitle.title = '';
			this.headerElement.style.display = 'none';
			this.newFileNoticeElement.style.display = 'none';
			this.settleRenderGeneration(generation);
			return;
		}

		startSourcesDiffPanelComparison(ref);
		let loadedOk = false;
		try {
			let loaded = false;
			if (!ref.original) {
				loaded = await this.renderModifiedOnly(ref.modified, generation);
				if (generation !== this.renderGeneration) {
					return;
				}
				if (loaded) {
					this.newFileNoticeElement.classList.remove('is-error');
					this.newFileNoticeElement.textContent = localize('sourcesDiffPanel.newFile', "New file with no previous version to compare.");
					this.newFileNoticeElement.style.display = '';
				}
			} else {
				this.newFileNoticeElement.style.display = 'none';
				loaded = await this.renderDiff(ref.original, ref.modified, generation);
				if (generation !== this.renderGeneration) {
					return;
				}
			}

			if (!loaded) {
				this.comparisonLoadFailed = true;
				this.headerTitle.textContent = '';
				this.headerTitle.title = '';
				this.headerElement.style.display = 'none';
				this.hideWriteChrome();
				this.showLoadNotice(sourcesDiffPanelComparisonLoadFailedMessage());
				if (this.dimension) {
					this.layoutBody(this.dimension.height, this.dimension.width);
				}
				this.settleRenderGeneration(generation);
				return;
			}

			this.headerElement.style.display = '';
			this.headerTitle.textContent = basename(ref.modified);
			this.headerTitle.title = ref.modified.fsPath;

			this.settleRenderGeneration(generation);
			this.updateWriteActions();
			if (this.dimension) {
				this.layoutBody(this.dimension.height, this.dimension.width);
			}
			loadedOk = true;
		} finally {
			settleSourcesDiffPanelComparison(ref, loadedOk);
		}
	}

	private createHeaderAction(parent: HTMLElement, className: string, label: string, onClick: () => void): HTMLButtonElement {
		const button = dom.append(parent, $(`button.${className}`)) as HTMLButtonElement;
		button.type = 'button';
		button.textContent = label;
		button.style.display = 'none';
		button.addEventListener('click', onClick);
		return button;
	}

	private getWriteContext(): { groupId: string; scmResource: ISCMResource | undefined; path: string } | undefined {
		const ref = this.currentRef;
		if (!ref) {
			return undefined;
		}
		const match = ref.scmResource
			? { resource: ref.scmResource, groupId: ref.groupId }
			: findScmResourceForUri(this.scmService, ref.modified);
		return {
			groupId: match?.groupId || ref.groupId,
			scmResource: match?.resource,
			path: sourcesDiffLocalWritePath({
				modified: ref.modified,
				scmResource: match?.resource ?? ref.scmResource,
			}),
		};
	}

	private getApplyHunksPatches(): readonly string[] {
		return sourcesGitApplyHunksPatches(this.currentRef);
	}

	private getGitSessionId(): string {
		return this.roster.getActiveSessionId();
	}

	private getEngineSessionReady(): boolean {
		return this.roster.isEngineSessionReady?.() ?? true;
	}

	private isSourcesKeepLeftoverWrite(): boolean {
		return isSourcesKeepLeftoverWrite(
			this.uaConnection.isEngineConnected(),
			!!this.uaConnection.getConnectionSnapshot?.().pairingPending,
			this.getEngineSessionReady(),
		);
	}

	private isSourcesDiffWriteHold(): boolean {
		return isConversationPairingHold(this.uaConnection) || this.isSourcesKeepLeftoverWrite();
	}

	private hideWriteChrome(): void {
		if (!this.stageButton || !this.acceptButton || !this.revertButton || !this.unstageButton || !this.unstageUnavailable) {
			return;
		}
		this.stageButton.style.display = 'none';
		this.acceptButton.style.display = 'none';
		this.revertButton.style.display = 'none';
		this.unstageButton.style.display = 'none';
		this.unstageUnavailable.style.display = 'none';
	}

	private isRenderPending(): boolean {
		return this.renderSettledGeneration !== this.renderGeneration;
	}

	private settleRenderGeneration(generation: number): void {
		if (generation === this.renderGeneration) {
			this.renderSettledGeneration = generation;
		}
	}

	private updateWriteActions(): void {
		if (!this.stageButton || !this.acceptButton || !this.revertButton || !this.unstageButton || !this.unstageUnavailable) {
			return;
		}

		if (this.isRenderPending()) {
			this.hideWriteChrome();
			return;
		}

		if (this.comparisonLoadFailed) {
			this.hideWriteChrome();
			return;
		}

		const context = this.getWriteContext();
		if (!context) {
			this.hideWriteChrome();
			return;
		}

		const sessionId = this.getGitSessionId();
		const pairingHold = isConversationPairingHold(this.uaConnection);
		const keepLeftover = this.isSourcesKeepLeftoverWrite();
		const writeHold = pairingHold || keepLeftover;
		const engineSessionReady = this.getEngineSessionReady();
		const actions = resolveSourcesDiffWriteActions({
			groupId: context.groupId,
			hasScmResource: !!context.scmResource,
			canWriteStage: canSendSourcesGitStagePaths(
				this.uaConnection.isEngineConnected(),
				typeof this.uaConnection.writeGitStagePaths === 'function',
				sessionId,
				pairingHold,
				false,
				engineSessionReady,
			),
			canWriteAccept: canSendSourcesGitApplyHunks(
				this.uaConnection.isEngineConnected(),
				typeof this.uaConnection.writeGitApplyHunks === 'function',
				pairingHold,
				false,
				engineSessionReady,
			),
			hasApplyHunksPayload: hasSourcesGitApplyHunksPayload(sessionId, this.getApplyHunksPatches()),
			hasGitStageCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_STAGE_COMMAND),
			hasGitUnstageCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_UNSTAGE_COMMAND),
			hasGitCleanCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_CLEAN_COMMAND),
			pairingHold,
			keepLeftover,
		});
		const hideStageAfterEngineAccepted = !!this.stageEngineAcceptedModified
			&& !!this.currentRef
			&& this.currentRef.modified.toString() === this.stageEngineAcceptedModified.toString();
		const hideRevertAfterGitClean = !!this.gitCleanSucceededModified
			&& !!this.currentRef
			&& this.currentRef.modified.toString() === this.gitCleanSucceededModified.toString();
		const hideUnstageAfterGitUnstage = !!this.gitUnstageSucceededModified
			&& !!this.currentRef
			&& this.currentRef.modified.toString() === this.gitUnstageSucceededModified.toString();
		this.stageButton.style.display = actions.showStage && !writeHold && !hideStageAfterEngineAccepted ? '' : 'none';
		this.acceptButton.style.display = actions.showAccept ? '' : 'none';
		this.revertButton.style.display = actions.showRevert && !writeHold && !hideRevertAfterGitClean ? '' : 'none';
		this.unstageButton.style.display = actions.showUnstage && !writeHold && !hideUnstageAfterGitUnstage ? '' : 'none';
		this.unstageUnavailable.style.display = actions.unstageUnavailable && !writeHold ? '' : 'none';
	}

	private async runStage(): Promise<void> {
		const context = this.getWriteContext();
		if (!context || this.isSourcesDiffWriteHold()) {
			return;
		}

		const hook = this.uaConnection.writeGitStagePaths;
		try {
			const attempt = await attemptSourcesGitWrite(() => tryWriteSourcesGitStagePaths(
				this.uaConnection.isEngineConnected(),
				hook ? request => hook.call(this.uaConnection, request) : undefined,
				this.getGitSessionId(),
				[context.path],
				isConversationPairingHold(this.uaConnection),
				false,
				this.getEngineSessionReady(),
			));
			if (attempt.kind === 'accepted') {
				const ref = this.currentRef;
				if (ref && isSourcesChangeStageable(ref.groupId)) {
					this.stageEngineAcceptedModified = ref.modified;
				}
				this.hideActionNotice();
				this.updateWriteActions();
				return;
			}
			if (attempt.kind === 'failed') {
				this.showActionNotice(attempt.detail);
				this.updateWriteActions();
				return;
			}
		} catch (error) {
			this.showActionNotice(getErrorMessage(error));
			this.updateWriteActions();
			return;
		}

		if (context.scmResource && !this.isSourcesDiffWriteHold()) {
			await this.runGitAction(SOURCES_GIT_STAGE_COMMAND);
			return;
		}

		if (canSendSourcesGitStagePaths(
			this.uaConnection.isEngineConnected(),
			typeof this.uaConnection.writeGitStagePaths === 'function',
			this.getGitSessionId(),
			isConversationPairingHold(this.uaConnection),
			false,
			this.getEngineSessionReady(),
		)) {
			this.showActionNotice(localize('sourcesDiffPanel.stageUnavailable', "Git stage is not available."));
		}
		this.updateWriteActions();
	}

	private async runAccept(): Promise<void> {
		const context = this.getWriteContext();
		if (!context || this.isSourcesDiffWriteHold()) {
			return;
		}

		const sessionId = this.getGitSessionId();
		const patches = this.getApplyHunksPatches();
		const hook = this.uaConnection.writeGitApplyHunks;
		try {
			const attempt = await attemptSourcesGitWrite(() => tryWriteSourcesGitApplyHunks(
				this.uaConnection.isEngineConnected(),
				hook ? request => hook.call(this.uaConnection, request) : undefined,
				sessionId,
				[],
				patches,
				isConversationPairingHold(this.uaConnection),
				false,
				this.getEngineSessionReady(),
			));
			if (attempt.kind === 'accepted') {
				this.hideActionNotice();
				this.updateWriteActions();
				return;
			}
			if (attempt.kind === 'failed') {
				this.showActionNotice(attempt.detail);
				this.updateWriteActions();
				return;
			}
		} catch (error) {
			this.showActionNotice(getErrorMessage(error));
			this.updateWriteActions();
			return;
		}

		if (canSendSourcesGitApplyHunks(
			this.uaConnection.isEngineConnected(),
			typeof this.uaConnection.writeGitApplyHunks === 'function',
			isConversationPairingHold(this.uaConnection),
			false,
			this.getEngineSessionReady(),
		) || hasSourcesGitApplyHunksPayload(sessionId, patches)) {
			this.showActionNotice(localize('sourcesDiffPanel.acceptUnavailable', "Git accept is not available."));
		}
		this.updateWriteActions();
	}

	private async runGitAction(commandId: string): Promise<void> {
		if (
			(commandId === SOURCES_GIT_UNSTAGE_COMMAND || commandId === SOURCES_GIT_CLEAN_COMMAND)
			&& this.isSourcesDiffWriteHold()
		) {
			return;
		}

		const context = this.getWriteContext();
		if (!context?.scmResource) {
			return;
		}

		try {
			await this.commandService.executeCommand(commandId, context.scmResource);
			this.hideActionNotice();
			if (commandId === SOURCES_GIT_CLEAN_COMMAND && this.currentRef) {
				this.gitCleanSucceededModified = this.currentRef.modified;
			}
			if (commandId === SOURCES_GIT_UNSTAGE_COMMAND && this.currentRef) {
				this.gitUnstageSucceededModified = this.currentRef.modified;
			}
		} catch (error) {
			this.showActionNotice(getErrorMessage(error));
		} finally {
			this.updateWriteActions();
		}
	}

	private showActionNotice(message: string): void {
		if (!this.actionNoticeElement) {
			return;
		}
		this.actionNoticeElement.textContent = message;
		this.actionNoticeElement.classList.add('is-error');
		this.actionNoticeElement.style.display = '';
	}

	private hideActionNotice(): void {
		if (!this.actionNoticeElement) {
			return;
		}
		this.actionNoticeElement.textContent = '';
		this.actionNoticeElement.classList.remove('is-error');
		this.actionNoticeElement.style.display = 'none';
	}

	private showLoadNotice(message: string): void {
		if (!this.newFileNoticeElement) {
			return;
		}
		this.newFileNoticeElement.textContent = message;
		this.newFileNoticeElement.classList.add('is-error');
		this.newFileNoticeElement.style.display = '';
	}

	private async renderDiff(original: URI, modified: URI, generation: number): Promise<boolean> {
		if (!this.editorContainer) {
			return false;
		}

		let originalRef: IReference<IResolvedTextEditorModel> | undefined;
		let modifiedRef: IReference<IResolvedTextEditorModel> | undefined;
		try {
			originalRef = await this.textModelService.createModelReference(original);
			modifiedRef = await this.textModelService.createModelReference(modified);
		} catch {
			originalRef?.dispose();
			modifiedRef?.dispose();
			return false;
		}

		if (generation !== this.renderGeneration) {
			originalRef.dispose();
			modifiedRef.dispose();
			return false;
		}

		this.bodyDisposables.add(originalRef);
		this.bodyDisposables.add(modifiedRef);

		const editorModel = this.model.value = new SourcesDiffEditorModel(originalRef, modifiedRef);
		const widget = this.diffWidget.value = this.instantiationService.createInstance(
			DiffEditorWidget,
			this.editorContainer,
			this.getDiffEditorOptions(),
			{},
		);
		widget.setModel(editorModel);

		if (this.dimension) {
			const headerHeight = this.headerElement?.offsetHeight ?? 0;
			widget.layout(new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - headerHeight)));
		}
		return true;
	}

	private async renderModifiedOnly(modified: URI, generation: number): Promise<boolean> {
		if (!this.editorContainer) {
			return false;
		}

		let modifiedRef: IReference<IResolvedTextEditorModel>;
		try {
			modifiedRef = await this.textModelService.createModelReference(modified);
		} catch {
			return false;
		}
		if (generation !== this.renderGeneration) {
			modifiedRef.dispose();
			return false;
		}
		this.modifiedModelRef.value = modifiedRef;
		this.bodyDisposables.add(modifiedRef);

		const widget = this.codeWidget.value = this.instantiationService.createInstance(
			CodeEditorWidget,
			this.editorContainer,
			readOnlyEditorOptions,
			{ isSimpleWidget: true },
		);
		widget.setModel(modifiedRef.object.textEditorModel);

		if (this.dimension) {
			const headerHeight = this.headerElement?.offsetHeight ?? 0;
			const noticeHeight = this.newFileNoticeElement?.offsetHeight ?? 0;
			widget.layout(new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - headerHeight - noticeHeight)));
		}
		return true;
	}

	private clearEditors(): void {
		this.model.clear();
		this.modifiedModelRef.clear();
		this.diffWidget.clear();
		this.codeWidget.clear();
	}
}
