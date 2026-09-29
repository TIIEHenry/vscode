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
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { ISCMResource, ISCMService } from '../../scm/common/scm.js';
import { findScmResourceForUri, ISourcesChangeRef, sourcesDiffLocalWritePath } from '../common/sourcesChangeRef.js';
import {
	SOURCES_GIT_CLEAN_COMMAND,
	SOURCES_GIT_STAGE_COMMAND,
	SOURCES_GIT_UNSTAGE_COMMAND,
} from '../common/sourcesChangesGit.js';
import { tryReadSourcesGitFileDiff } from '../common/sourcesChangesGitRead.js';
import {
	attemptSourcesGitWrite,
	canSendSourcesGitApplyHunks,
	canSendSourcesGitStagePaths,
	hasSourcesGitApplyHunksPayload,
	hasSourcesGitSessionId,
	isSourcesKeepLeftoverWrite,
	sourcesGitUnstageUnavailableMessage,
	tryWriteSourcesGitApplyHunks,
	tryWriteSourcesGitStagePaths,
} from '../common/sourcesChangesGitWrite.js';
import {
	canOfferSourcesGitAcceptHunk,
	type ISourcesGitAcceptCursor,
	SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE,
	SOURCES_GIT_APPLY_CACHED_ARGV,
	sourcesGitHunkPatchAtCursor,
} from '../common/sourcesGitHunkPatch.js';
import { ISourcesChangesModel, isSourcesChangesReadFailed, sourcesChangesWriteSessionId } from '../common/sourcesChangesModel.js';
import {
	ISourcesDiffWriteCollapse,
	ISourcesDiffWriteFacts,
	markSourcesDiffWriteCollapsed,
	planSourcesDiffAcceptAfterAttempt,
	planSourcesDiffAcceptAttempt,
	planSourcesDiffLocalGitAction,
	planSourcesDiffStageAfterAttempt,
	planSourcesDiffStageAttempt,
	resolveSourcesDiffWriteControllerChrome,
	sourcesDiffWriteCollapseFor,
} from '../common/sourcesDiffWriteController.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { allocateSourcesDiffLoadGeneration, fireSourcesDiffLoad } from './sourcesDiffLoadSignal.js';
import { SOURCES_DIFF_PANEL_VIEW_ID } from './sourcesDiffPanelIds.js';

const $ = dom.$;

export function sourcesDiffPanelComparisonLoadFailedMessage(): string {
	return localize('sourcesDiffPanel.loadFailed', "Unable to load this comparison.");
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
	private _stageGeneration = 0;
	private activeRender: { generation: number; promise: Promise<void> } | undefined;
	/** Revert / Unstage / engine Stage hide. Cleared when the modified URI changes. */
	private writeCollapse: ISourcesDiffWriteCollapse | undefined;
	/** Last diff cursor side and line. Editor text is not stored. */
	private acceptCursor: ISourcesGitAcceptCursor | undefined;

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
		@IAgentSessionContext private readonly session: IAgentSessionContext,
		@ISourcesChangesModel private readonly changesModel: ISourcesChangesModel,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this.element.classList.add('sources-diff-panel');

		this._register(this.sourcesDiffPanelService.onDidChangeRef(ref => {
			this.currentRef = ref;
			if (!this.bodyContainer) {
				return;
			}
			const generation = ref
				? this.sourcesDiffPanelService.getPendingRenderGeneration()
				: undefined;
			if (generation !== undefined) {
				this.beginRender(ref, generation);
				return;
			}
			if (!ref) {
				this.beginRender(undefined, allocateSourcesDiffLoadGeneration());
			}
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => this.onWriteFactsChanged()));
		this._register(this.session.onDidChangeActiveSession(() => this.onWriteFactsChanged()));
		this._register(this.session.onDidChangeSession(() => this.onWriteFactsChanged()));
		this._register(this.changesModel.onDidChange(() => this.onWriteFactsChanged()));

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

		const generation = this.sourcesDiffPanelService.getPendingRenderGeneration();
		if (generation !== undefined) {
			this.beginRender(this.currentRef, generation);
		}
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

	private beginRender(ref: ISourcesChangeRef | undefined, generation: number): void {
		if (this.activeRender?.generation === generation) {
			this.sourcesDiffPanelService.attachPendingRender(generation, this.activeRender.promise);
			return;
		}
		const promise = this.renderRef(ref, generation);
		this.activeRender = { generation, promise };
		this.sourcesDiffPanelService.attachPendingRender(generation, promise);
		promise.catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private async renderRef(ref: ISourcesChangeRef | undefined, generation: number): Promise<void> {
		this.renderGeneration = generation;
		this.writeCollapse = sourcesDiffWriteCollapseFor(this.writeCollapse, ref?.modified);
		this.bodyDisposables.clear();
		this.clearEditors();
		this.comparisonLoadFailed = false;

		if (!this.headerElement || !this.headerTitle || !this.newFileNoticeElement || !this.editorContainer) {
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
			fireSourcesDiffLoad({ resource: ref.modified, generation, ok: false });
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
		fireSourcesDiffLoad({ resource: ref.modified, generation, ok: true });
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
		const liveMatch = findScmResourceForUri(this.scmService, ref.modified);
		const match = liveMatch ?? (ref.scmResource ? { resource: ref.scmResource, groupId: ref.groupId } : undefined);
		return {
			groupId: match?.groupId || ref.groupId,
			scmResource: match?.resource,
			path: sourcesDiffLocalWritePath({
				modified: ref.modified,
				scmResource: match?.resource ?? ref.scmResource,
				origin: ref.origin,
				gitPath: ref.gitPath,
			}),
		};
	}

	private onWriteFactsChanged(): void {
		this.updateWriteActions();
		if (this.dimension) {
			this.layoutBody(this.dimension.height, this.dimension.width);
		}
	}

	private getGitSessionId(): string {
		const snapshot = this.changesModel.getSnapshot();
		const modified = this.currentRef?.modified;
		const matches = modified
			? snapshot.entries.filter(entry => entry.resource.toString() === modified.toString())
			: undefined;
		return sourcesChangesWriteSessionId(snapshot, matches, this.session.getActiveSessionId());
	}

	private getEngineSessionReady(): boolean {
		return this.session.isEngineSessionReady();
	}

	private isReadFailed(): boolean {
		return isSourcesChangesReadFailed(this.changesModel.getSnapshot().state);
	}

	private isSourcesKeepLeftoverWrite(): boolean {
		return isSourcesKeepLeftoverWrite(
			this.uaConnection.isEngineConnected(),
			!!this.uaConnection.getConnectionSnapshot?.().pairingPending,
			this.getEngineSessionReady(),
		);
	}

	private isSourcesDiffWriteHold(): boolean {
		return this.changesModel.isWriteClosed();
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

		const facts = this.currentWriteFacts();
		if (!facts) {
			this.hideWriteChrome();
			return;
		}
		const chrome = resolveSourcesDiffWriteControllerChrome(facts);
		this.stageButton.style.display = chrome.showStage ? '' : 'none';
		this.acceptButton.style.display = chrome.showAccept ? '' : 'none';
		this.revertButton.style.display = chrome.showRevert ? '' : 'none';
		this.unstageButton.style.display = chrome.showUnstage ? '' : 'none';
		this.unstageUnavailable.style.display = chrome.unstageUnavailable ? '' : 'none';
	}

	private currentWriteFacts(): ISourcesDiffWriteFacts | undefined {
		const context = this.getWriteContext();
		const ref = this.currentRef;
		if (!context || !ref) {
			return undefined;
		}
		const fallbackSessionId = this.getGitSessionId();
		const pairingHold = this.session.isPairingHold();
		const readFailed = this.isReadFailed();
		const engineSessionReady = this.getEngineSessionReady();
		const pinnedSessionId = ref.sessionId ?? '';
		return {
			identity: {
				origin: ref.origin,
				sessionId: ref.sessionId,
				modified: ref.modified,
			},
			writeClosed: this.isSourcesDiffWriteHold(),
			activeSessionId: this.session.getActiveSessionId(),
			fallbackSessionId,
			groupId: context.groupId,
			path: context.path,
			scmResource: context.scmResource,
			canWriteStage: canSendSourcesGitStagePaths(
				this.uaConnection.isEngineConnected(),
				typeof this.uaConnection.writeGitStagePaths === 'function',
				fallbackSessionId,
				pairingHold,
				readFailed,
				engineSessionReady,
			),
			canWriteAccept: canSendSourcesGitApplyHunks(
				this.uaConnection.isEngineConnected(),
				typeof this.uaConnection.writeGitApplyHunks === 'function',
				pairingHold,
				readFailed,
				engineSessionReady,
			),
			hasApplyHunksPayload: canOfferSourcesGitAcceptHunk(ref.kind, ref.indexState) && context.path !== '' && hasSourcesGitSessionId(pinnedSessionId),
			hasGitStageCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_STAGE_COMMAND),
			hasGitUnstageCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_UNSTAGE_COMMAND),
			hasGitCleanCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_CLEAN_COMMAND),
			pairingHold,
			keepLeftover: this.isSourcesKeepLeftoverWrite(),
			patches: [],
			collapse: this.writeCollapse,
		};
	}

	private async runStage(): Promise<void> {
		const stagedRef = this.currentRef;
		const plan = planSourcesDiffStageAttempt(this.currentWriteFacts());
		if (plan.kind === 'blocked') {
			return;
		}
		if (plan.kind === 'notice') {
			this.showActionNotice(plan.message);
			this.updateWriteActions();
			return;
		}

		const generation = ++this._stageGeneration;
		const hook = this.uaConnection.writeGitStagePaths;
		try {
			const attempt = plan.kind === 'skip-engine'
				? { kind: 'fallback' as const }
				: await attemptSourcesGitWrite(() => tryWriteSourcesGitStagePaths(
					this.uaConnection.isEngineConnected(),
					hook ? request => hook.call(this.uaConnection, request) : undefined,
					plan.sessionId,
					[plan.path],
					this.session.isPairingHold(),
					this.isReadFailed(),
					this.getEngineSessionReady(),
				));
			if (generation !== this._stageGeneration || this._store.isDisposed || this.currentRef !== stagedRef) {
				return;
			}
			const facts = this.currentWriteFacts();
			if (!facts) {
				return;
			}
			const after = planSourcesDiffStageAfterAttempt(attempt, facts);
			if (after.kind === 'collapse-stage') {
				this.writeCollapse = markSourcesDiffWriteCollapsed(facts.identity.modified, 'stage');
				this.hideActionNotice();
				this.updateWriteActions();
				return;
			}
			if (after.kind === 'clear-notice') {
				this.hideActionNotice();
				this.updateWriteActions();
				return;
			}
			if (after.kind === 'notice') {
				this.showActionNotice(after.message);
				this.updateWriteActions();
				return;
			}
			if (after.kind === 'local') {
				await this.runGitAction(SOURCES_GIT_STAGE_COMMAND);
				return;
			}
			this.updateWriteActions();
		} catch (error) {
			if (generation !== this._stageGeneration || this._store.isDisposed || this.currentRef !== stagedRef) {
				return;
			}
			this.showActionNotice(getErrorMessage(error));
			this.updateWriteActions();
		}
	}

	private bindAcceptCursor(widget: DiffEditorWidget): void {
		const listen = (side: ISourcesGitAcceptCursor['side'], editor: ReturnType<DiffEditorWidget['getModifiedEditor']>) => {
			this.bodyDisposables.add(editor.onDidChangeCursorPosition(event => {
				this.acceptCursor = { side, line: event.position.lineNumber };
			}));
		};
		listen('new', widget.getModifiedEditor());
		listen('old', widget.getOriginalEditor());
	}

	private readAcceptCursor(): ISourcesGitAcceptCursor | undefined {
		if (this.acceptCursor) {
			return this.acceptCursor;
		}
		const modifiedPosition = this.diffWidget.value?.getModifiedEditor().getPosition();
		if (modifiedPosition) {
			return { side: 'new', line: modifiedPosition.lineNumber };
		}
		const originalPosition = this.diffWidget.value?.getOriginalEditor().getPosition();
		if (originalPosition) {
			return { side: 'old', line: originalPosition.lineNumber };
		}
		return undefined;
	}

	private async runAccept(): Promise<void> {
		const stagedRef = this.currentRef;
		const plan = planSourcesDiffAcceptAttempt(this.currentWriteFacts());
		if (plan.kind === 'blocked') {
			return;
		}
		if (plan.kind === 'notice') {
			this.showActionNotice(plan.message);
			this.updateWriteActions();
			return;
		}

		const sessionId = stagedRef?.sessionId ?? '';
		const path = this.currentWriteFacts()?.path ?? '';
		const cursor = this.readAcceptCursor();
		if (!canOfferSourcesGitAcceptHunk(stagedRef?.kind, stagedRef?.indexState) || path === '' || sessionId === '' || !cursor) {
			return;
		}

		const readGitFileDiff = this.uaConnection.readGitFileDiff;
		try {
			const read = await tryReadSourcesGitFileDiff(
				this.uaConnection.isEngineConnected(),
				readGitFileDiff ? request => readGitFileDiff.call(this.uaConnection, request) : undefined,
				sessionId,
				path,
				SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE,
				this.session.isPairingHold(),
				this.isReadFailed(),
			);
			if (this._store.isDisposed || this.currentRef !== stagedRef) {
				return;
			}
			const patch = read?.supported ? sourcesGitHunkPatchAtCursor(read.unifiedDiff, cursor.line, cursor.side) : undefined;
			if (!patch || !hasSourcesGitApplyHunksPayload(sessionId, [patch])) {
				return;
			}
			const hook = this.uaConnection.writeGitApplyHunks;
			const attempt = await attemptSourcesGitWrite(() => tryWriteSourcesGitApplyHunks(
				this.uaConnection.isEngineConnected(),
				hook ? request => hook.call(this.uaConnection, request) : undefined,
				sessionId,
				SOURCES_GIT_APPLY_CACHED_ARGV,
				[patch],
				this.session.isPairingHold(),
				this.isReadFailed(),
				this.getEngineSessionReady(),
			));
			if (this._store.isDisposed || this.currentRef !== stagedRef) {
				return;
			}
			const facts = this.currentWriteFacts();
			if (!facts) {
				return;
			}
			const after = planSourcesDiffAcceptAfterAttempt(attempt, facts);
			if (after.kind === 'clear-notice') {
				this.hideActionNotice();
				this.changesModel.scheduleRefresh();
				this.updateWriteActions();
				return;
			}
			if (after.kind === 'notice') {
				this.showActionNotice(after.message);
				this.updateWriteActions();
				return;
			}
			this.updateWriteActions();
		} catch (error) {
			if (this._store.isDisposed || this.currentRef !== stagedRef) {
				return;
			}
			this.showActionNotice(getErrorMessage(error));
			this.updateWriteActions();
		}
	}

	private async runGitAction(commandId: string): Promise<void> {
		const facts = this.currentWriteFacts();
		const plan = planSourcesDiffLocalGitAction(commandId, facts);
		if (plan.kind !== 'local' || !facts) {
			return;
		}

		try {
			await this.commandService.executeCommand(plan.commandId, plan.scmResource);
			this.hideActionNotice();
			if (plan.collapse) {
				this.writeCollapse = markSourcesDiffWriteCollapsed(facts.identity.modified, plan.collapse);
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
		if (generation === this.renderGeneration) {
			this.bindAcceptCursor(widget);
		}

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
		this.acceptCursor = undefined;
		this.model.clear();
		this.modifiedModelRef.clear();
		this.diffWidget.clear();
		this.codeWidget.clear();
	}
}
