/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationDiffReviewPane.css';
import * as dom from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore, IReference, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IDiffEditorConstructionOptions } from '../../../../editor/browser/editorBrowser.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { DiffEditorWidget } from '../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { IEditorOptions as ICodeEditorOptions } from '../../../../editor/common/config/editorOptions.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { ISCMService } from '../../scm/common/scm.js';
import { ConversationDiffReviewEditorId } from '../../../common/editor/conversationDiffReviewInput.js';
import { resolveSourcesDiffWriteGate } from '../common/sourcesChangeRef.js';
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
	sourcesGitWriteHookPresent,
	hasSourcesGitApplyHunksPayload,
	hasSourcesGitSessionId,
	isSourcesKeepLeftoverWrite,
	sourcesGitEmptyStagePathMessage,
	sourcesGitUnstageUnavailableMessage,
	tryWriteSourcesGitApplyHunks,
	tryWriteSourcesGitStagePaths,
} from '../common/sourcesChangesGitWrite.js';
import {
	canOfferSourcesGitAcceptHunk,
	type ISourcesGitAcceptCursor,
	rememberSourcesGitAcceptCursor,
	SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE,
	SOURCES_GIT_APPLY_CACHED_ARGV,
	sourcesGitAcceptCursorFromEditors,
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
	resolveSourcesDiffEmptyStageChrome,
	resolveSourcesDiffWriteControllerChrome,
	sourcesDiffWriteCollapseFor,
} from '../common/sourcesDiffWriteController.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';
import { fireSourcesDiffLoad } from './sourcesDiffLoadSignal.js';

const $ = dom.$;

export function conversationDiffComparisonLoadFailedMessage(): string {
	return localize('conversationDiffReviewPane.loadFailed', "Unable to load this comparison.");
}

const readOnlyEditorOptions: ICodeEditorOptions = {
	readOnly: true,
	scrollBeyondLastLine: false,
	minimap: { enabled: false },
	automaticLayout: false,
	lineNumbers: 'on',
};

export class ConversationDiffReviewPane extends EditorPane {

	static readonly ID = ConversationDiffReviewEditorId;

	private readonly diffWidget = this._register(new MutableDisposable<DiffEditorWidget>());
	private readonly codeWidget = this._register(new MutableDisposable<CodeEditorWidget>());
	private readonly originalModelRef = this._register(new MutableDisposable<IReference<IResolvedTextEditorModel>>());
	private readonly modifiedModelRef = this._register(new MutableDisposable<IReference<IResolvedTextEditorModel>>());
	private readonly acceptCursorListeners = this._register(new DisposableStore());

	private container: HTMLElement | undefined;
	private toolbar: HTMLElement | undefined;
	private revertButton: HTMLButtonElement | undefined;
	private unstageButton: HTMLButtonElement | undefined;
	private unstageUnavailable: HTMLElement | undefined;
	private stageButton: HTMLButtonElement | undefined;
	private acceptButton: HTMLButtonElement | undefined;
	private previewButton: HTMLButtonElement | undefined;
	private noticeElement: HTMLElement | undefined;
	private editorContainer: HTMLElement | undefined;
	private dimension: dom.Dimension | undefined;
	private comparisonLoadFailed = false;
	private comparisonState: 'pending' | 'ok' | 'fail' | undefined;
	private renderGeneration = 0;
	/** Revert / Unstage / engine Stage hide. Cleared when the modified URI changes. */
	private writeCollapse: ISourcesDiffWriteCollapse | undefined;
	/** Bumped by setInput / clearInput / dispose so in-flight Stage / Accept cannot write back. */
	private stageAttemptGeneration = 0;
	/** Last diff cursor side and line. Editor text is not stored. */
	private acceptCursor: ISourcesGitAcceptCursor | undefined;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICommandService private readonly commandService: ICommandService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ITextModelService private readonly textModelService: ITextModelService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ISCMService private readonly scmService: ISCMService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
		@ISourcesChangesModel private readonly changesModel: ISourcesChangesModel,
	) {
		super(ConversationDiffReviewPane.ID, group, telemetryService, themeService, storageService);

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('diffEditor.renderSideBySide') && this.diffWidget.value) {
				this.diffWidget.value.updateOptions(this.getDiffEditorOptions());
			}
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => this.onWriteFactsChanged()));
		this._register(this.session.onDidChangeActiveSession(() => this.onWriteFactsChanged()));
		this._register(this.session.onDidChangeSession(() => this.onWriteFactsChanged()));
		this._register(this.changesModel.onDidChange(() => this.onWriteFactsChanged()));
	}

	protected override createEditor(parent: HTMLElement): void {
		this.container = dom.append(parent, $('.conversation-diff-review-pane'));
		this.container.setAttribute('role', 'document');
		this.container.setAttribute('aria-label', localize('conversationDiffReviewPane.ariaLabel', "Conversation Diff Review"));

		this.toolbar = dom.append(this.container, $('.conversation-diff-review-toolbar'));

		this.revertButton = dom.append(this.toolbar, $('button.conversation-diff-review-revert')) as HTMLButtonElement;
		this.revertButton.type = 'button';
		this.revertButton.textContent = localize('conversationDiffReviewPane.revert', "Revert");
		this.revertButton.style.display = 'none';
		this._register(dom.addDisposableListener(this.revertButton, 'click', () => {
			void this.runGitAction(SOURCES_GIT_CLEAN_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this.unstageButton = dom.append(this.toolbar, $('button.conversation-diff-review-unstage')) as HTMLButtonElement;
		this.unstageButton.type = 'button';
		this.unstageButton.textContent = localize('conversationDiffReviewPane.unstage', "Unstage");
		this.unstageButton.style.display = 'none';
		this._register(dom.addDisposableListener(this.unstageButton, 'click', () => {
			void this.runGitAction(SOURCES_GIT_UNSTAGE_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this.unstageUnavailable = dom.append(this.toolbar, $('span.conversation-diff-review-unstage-unavailable'));
		this.unstageUnavailable.textContent = sourcesGitUnstageUnavailableMessage();
		this.unstageUnavailable.style.display = 'none';

		this.stageButton = dom.append(this.toolbar, $('button.conversation-diff-review-stage')) as HTMLButtonElement;
		this.stageButton.type = 'button';
		this.stageButton.textContent = localize('conversationDiffReviewPane.stage', "Stage");
		this.stageButton.style.display = 'none';
		this._register(dom.addDisposableListener(this.stageButton, 'click', () => {
			void this.runStage().catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this.acceptButton = dom.append(this.toolbar, $('button.conversation-diff-review-accept')) as HTMLButtonElement;
		this.acceptButton.type = 'button';
		this.acceptButton.textContent = localize('conversationDiffReviewPane.accept', "Accept");
		this.acceptButton.style.display = 'none';
		this._register(dom.addDisposableListener(this.acceptButton, 'click', () => {
			void this.runAccept().catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this.previewButton = dom.append(this.toolbar, $('button.conversation-diff-review-open-preview')) as HTMLButtonElement;
		this.previewButton.type = 'button';
		this.previewButton.textContent = localize('conversationDiffReviewPane.openPreview', "Open Diff in Preview");
		this.previewButton.style.display = 'none';
		this._register(dom.addDisposableListener(this.previewButton, 'click', () => {
			void this.commandService.executeCommand('sources.diff.moveToPreview').catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		this.toolbar.style.display = 'none';

		this.noticeElement = dom.append(this.container, $('.conversation-diff-review-notice'));
		this.noticeElement.style.display = 'none';
		this.editorContainer = dom.append(this.container, $('.conversation-diff-review-editor'));
	}

	override async setInput(input: ConversationDiffReviewInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		this.stageAttemptGeneration++;
		const generation = input.loadGeneration;
		this.renderGeneration = generation;
		this.comparisonState = 'pending';
		this.writeCollapse = sourcesDiffWriteCollapseFor(this.writeCollapse, input.modified);
		await super.setInput(input, options, context, token);
		if (this._store.isDisposed || token.isCancellationRequested || generation !== this.renderGeneration) {
			return;
		}

		this.clearEditors();
		this.comparisonLoadFailed = false;
		this.hideWriteChrome();
		this.hideNotice();
		this.setReviewChromeVisible(false);

		let loaded = false;
		if (!input.original) {
			loaded = await this.renderModifiedOnly(input, token, generation);
			if (loaded && generation === this.renderGeneration) {
				this.showNotice(localize('conversationDiffReviewPane.newFile', "New file with no previous version to compare."), false);
			}
		} else {
			loaded = await this.renderDiff(input, token, generation);
		}

		if (this._store.isDisposed || this.input !== input || token.isCancellationRequested || generation !== this.renderGeneration) {
			return;
		}

		if (!loaded) {
			this.comparisonState = 'fail';
			this.comparisonLoadFailed = true;
			this.hideWriteChrome();
			this.setReviewChromeVisible(false);
			this.showNotice(conversationDiffComparisonLoadFailedMessage());
			this.layoutEditors();
			this._onDidChangeControl.fire();
			fireSourcesDiffLoad({ resource: input.modified, generation, ok: false });
			return;
		}

		this.comparisonState = 'ok';
		this.setReviewChromeVisible(true);
		this.updateReviewActions();
		this.layoutEditors();
		this._onDidChangeControl.fire();
		fireSourcesDiffLoad({ resource: input.modified, generation, ok: true });
	}

	didComparisonLoadFail(): boolean {
		return this.comparisonLoadFailed;
	}

	getComparisonLoadState(): 'pending' | 'ok' | 'fail' | undefined {
		return this.comparisonState;
	}

	override dispose(): void {
		this.stageAttemptGeneration++;
		this.clearEditors();
		super.dispose();
	}

	override clearInput(): void {
		this.stageAttemptGeneration++;
		this.writeCollapse = undefined;
		this.comparisonLoadFailed = false;
		this.comparisonState = undefined;
		this.clearEditors();
		this.hideNotice();
		this.setReviewChromeVisible(false);
		if (this.revertButton) {
			this.revertButton.style.display = 'none';
		}
		if (this.unstageButton) {
			this.unstageButton.style.display = 'none';
		}
		if (this.unstageUnavailable) {
			this.unstageUnavailable.style.display = 'none';
		}
		if (this.stageButton) {
			this.stageButton.style.display = 'none';
		}
		if (this.acceptButton) {
			this.acceptButton.style.display = 'none';
		}
		super.clearInput();
	}

	override getControl(): DiffEditorWidget | CodeEditorWidget | undefined {
		return this.diffWidget.value ?? this.codeWidget.value;
	}

	override focus(): void {
		super.focus();
		(this.diffWidget.value?.getModifiedEditor() ?? this.codeWidget.value)?.focus();
	}

	override layout(dimension: { width: number; height: number }): void {
		this.dimension = new dom.Dimension(dimension.width, dimension.height);
		if (this.container) {
			this.container.style.width = `${dimension.width}px`;
			this.container.style.height = `${dimension.height}px`;
		}
		this.layoutEditors();
	}

	private getDiffEditorOptions(): IDiffEditorConstructionOptions {
		return {
			...readOnlyEditorOptions,
			originalEditable: false,
			renderSideBySide: this.configurationService.getValue<boolean>('diffEditor.renderSideBySide') ?? true,
			useInlineViewWhenSpaceIsLimited: true,
			renderOverviewRuler: false,
		};
	}

	private onWriteFactsChanged(): void {
		this.updateReviewActions();
		this.layoutEditors();
	}

	private getGitSessionId(): string {
		const snapshot = this.changesModel.getSnapshot();
		const modified = this.input instanceof ConversationDiffReviewInput ? this.input.modified : undefined;
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

	private setReviewChromeVisible(visible: boolean): void {
		if (this.toolbar) {
			this.toolbar.style.display = visible ? '' : 'none';
		}
		if (this.previewButton) {
			this.previewButton.style.display = visible ? '' : 'none';
		}
	}

	private hideWriteChrome(): void {
		if (this.revertButton) {
			this.revertButton.style.display = 'none';
		}
		if (this.unstageButton) {
			this.unstageButton.style.display = 'none';
		}
		if (this.unstageUnavailable) {
			this.unstageUnavailable.style.display = 'none';
		}
		if (this.stageButton) {
			this.stageButton.style.display = 'none';
		}
		if (this.acceptButton) {
			this.acceptButton.style.display = 'none';
		}
	}

	private updateReviewActions(): void {
		if (!this.revertButton || !this.stageButton || !this.acceptButton || !this.unstageButton || !this.unstageUnavailable) {
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
		this.revertButton.style.display = chrome.showRevert ? '' : 'none';
		this.unstageButton.style.display = chrome.showUnstage ? '' : 'none';
		this.unstageUnavailable.style.display = chrome.unstageUnavailable ? '' : 'none';
		this.stageButton.style.display = chrome.showStage ? '' : 'none';
		this.acceptButton.style.display = chrome.showAccept ? '' : 'none';
		this.applyEmptyStagePathChrome(facts);
	}

	/** Empty engine identity: disable Stage and show status. The click path still must not send. */
	private applyEmptyStagePathChrome(facts: ISourcesDiffWriteFacts): void {
		if (!this.stageButton) {
			return;
		}
		const emptyStage = resolveSourcesDiffEmptyStageChrome(facts);
		this.stageButton.disabled = emptyStage.disableStage;
		this.stageButton.setAttribute('aria-disabled', emptyStage.disableStage ? 'true' : 'false');
		const emptyMessage = sourcesGitEmptyStagePathMessage();
		if (emptyStage.status) {
			this.showNotice(emptyStage.status);
			return;
		}
		if (this.noticeElement?.textContent === emptyMessage) {
			this.hideNotice();
		}
	}

	private currentWriteFacts(): ISourcesDiffWriteFacts | undefined {
		const input = this.input;
		if (!(input instanceof ConversationDiffReviewInput)) {
			return undefined;
		}
		const gate = resolveSourcesDiffWriteGate(this.scmService, {
			modified: input.modified,
			groupId: input.groupId,
			origin: input.origin,
			gitPath: input.gitPath,
		});
		const fallbackSessionId = this.getGitSessionId();
		const pairingHold = this.session.isPairingHold();
		const readFailed = this.isReadFailed();
		const engineSessionReady = this.getEngineSessionReady();
		const pinnedSessionId = input.sessionId ?? '';
		return {
			identity: {
				origin: input.origin,
				sessionId: input.sessionId,
				modified: input.modified,
			},
			changesSnapshotKind: this.changesModel.getSnapshot().state.kind,
			writeClosed: this.isSourcesDiffWriteHold(),
			activeSessionId: this.session.getActiveSessionId(),
			fallbackSessionId,
			groupId: gate.groupId,
			path: gate.path,
			scmResource: gate.scmResource,
			canWriteStage: canSendSourcesGitStagePaths(
				this.uaConnection.isEngineConnected(),
				sourcesGitWriteHookPresent(this.uaConnection.getConnectionSnapshot?.(), 'writeGitStagePaths', this.uaConnection.writeGitStagePaths),
				fallbackSessionId,
				pairingHold,
				readFailed,
				engineSessionReady,
			),
			canWriteAccept: canSendSourcesGitApplyHunks(
				this.uaConnection.isEngineConnected(),
				sourcesGitWriteHookPresent(this.uaConnection.getConnectionSnapshot?.(), 'writeGitApplyHunks', this.uaConnection.writeGitApplyHunks),
				pairingHold,
				readFailed,
				engineSessionReady,
			),
			hasApplyHunksPayload: canOfferSourcesGitAcceptHunk(input.kind, input.indexState) && gate.path !== '' && hasSourcesGitSessionId(pinnedSessionId),
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
		const input = this.input;
		const plan = planSourcesDiffStageAttempt(this.currentWriteFacts());
		if (plan.kind === 'blocked') {
			return;
		}
		if (plan.kind === 'notice') {
			this.showNotice(plan.message);
			this.updateReviewActions();
			return;
		}

		const stageAttemptGeneration = this.stageAttemptGeneration;
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
			if (this._store.isDisposed || this.input !== input || stageAttemptGeneration !== this.stageAttemptGeneration) {
				return;
			}
			const facts = this.currentWriteFacts();
			if (!facts) {
				return;
			}
			const after = planSourcesDiffStageAfterAttempt(attempt, facts);
			if (after.kind === 'collapse-stage') {
				this.writeCollapse = markSourcesDiffWriteCollapsed(facts.identity.modified, 'stage');
				this.hideNotice();
				this.updateReviewActions();
				return;
			}
			if (after.kind === 'clear-notice') {
				this.hideNotice();
				this.updateReviewActions();
				return;
			}
			if (after.kind === 'notice') {
				this.showNotice(after.message);
				this.updateReviewActions();
				return;
			}
			if (after.kind === 'local') {
				await this.runGitAction(SOURCES_GIT_STAGE_COMMAND);
				return;
			}
			this.updateReviewActions();
		} catch (error) {
			if (this._store.isDisposed || this.input !== input || stageAttemptGeneration !== this.stageAttemptGeneration) {
				return;
			}
			this.showNotice(getErrorMessage(error));
			this.updateReviewActions();
		}
	}

	private bindAcceptCursor(widget: DiffEditorWidget): void {
		const listen = (side: ISourcesGitAcceptCursor['side'], editor: ReturnType<DiffEditorWidget['getModifiedEditor']>) => {
			const remember = () => {
				const line = editor.getPosition()?.lineNumber;
				if (line === undefined) {
					return;
				}
				this.acceptCursor = rememberSourcesGitAcceptCursor(this.acceptCursor, {
					side,
					line,
					editorHasFocus: editor.hasTextFocus(),
				});
			};
			this.acceptCursorListeners.add(editor.onDidChangeCursorPosition(remember));
			this.acceptCursorListeners.add(editor.onDidFocusEditorText(remember));
		};
		listen('new', widget.getModifiedEditor());
		listen('old', widget.getOriginalEditor());
	}

	private readAcceptCursor(): ISourcesGitAcceptCursor | undefined {
		const widget = this.diffWidget.value;
		const modified = widget?.getModifiedEditor();
		const original = widget?.getOriginalEditor();
		return sourcesGitAcceptCursorFromEditors({
			focused: modified?.hasTextFocus() ? 'new' : original?.hasTextFocus() ? 'old' : undefined,
			remembered: this.acceptCursor,
			modifiedLine: modified?.getPosition()?.lineNumber,
			originalLine: original?.getPosition()?.lineNumber,
		});
	}

	private async runAccept(): Promise<void> {
		const input = this.input;
		const plan = planSourcesDiffAcceptAttempt(this.currentWriteFacts());
		if (plan.kind === 'blocked') {
			return;
		}
		if (plan.kind === 'notice') {
			this.showNotice(plan.message);
			this.updateReviewActions();
			return;
		}

		const stageAttemptGeneration = this.stageAttemptGeneration;
		const sessionId = input instanceof ConversationDiffReviewInput ? (input.sessionId ?? '') : '';
		const path = this.currentWriteFacts()?.path ?? '';
		const cursor = this.readAcceptCursor();
		const kind = input instanceof ConversationDiffReviewInput ? input.kind : undefined;
		const indexState = input instanceof ConversationDiffReviewInput ? input.indexState : undefined;
		if (!canOfferSourcesGitAcceptHunk(kind, indexState) || path === '' || sessionId === '' || !cursor) {
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
			if (this._store.isDisposed || this.input !== input || stageAttemptGeneration !== this.stageAttemptGeneration) {
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
			if (this._store.isDisposed || this.input !== input || stageAttemptGeneration !== this.stageAttemptGeneration) {
				return;
			}
			const facts = this.currentWriteFacts();
			if (!facts) {
				return;
			}
			const after = planSourcesDiffAcceptAfterAttempt(attempt, facts);
			if (after.kind === 'clear-notice') {
				this.hideNotice();
				this.changesModel.scheduleRefresh();
				this.updateReviewActions();
				return;
			}
			if (after.kind === 'notice') {
				this.showNotice(after.message);
				this.updateReviewActions();
				return;
			}
			this.updateReviewActions();
		} catch (error) {
			if (this._store.isDisposed || this.input !== input || stageAttemptGeneration !== this.stageAttemptGeneration) {
				return;
			}
			this.showNotice(getErrorMessage(error));
			this.updateReviewActions();
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
			this.hideNotice();
			if (plan.collapse) {
				this.writeCollapse = markSourcesDiffWriteCollapsed(facts.identity.modified, plan.collapse);
			}
		} catch (error) {
			this.showNotice(getErrorMessage(error));
		} finally {
			this.updateReviewActions();
		}
	}

	private showNotice(message: string, isError = true): void {
		if (!this.noticeElement) {
			return;
		}
		this.noticeElement.textContent = message;
		this.noticeElement.classList.toggle('is-error', isError);
		this.noticeElement.style.display = '';
	}

	private hideNotice(): void {
		if (!this.noticeElement) {
			return;
		}
		this.noticeElement.textContent = '';
		this.noticeElement.classList.remove('is-error');
		this.noticeElement.style.display = 'none';
	}

	private async renderDiff(input: ConversationDiffReviewInput, token: CancellationToken, generation: number): Promise<boolean> {
		if (!this.editorContainer || !input.original) {
			return false;
		}

		let originalRef: IReference<IResolvedTextEditorModel> | undefined;
		let modifiedRef: IReference<IResolvedTextEditorModel> | undefined;
		try {
			originalRef = await this.textModelService.createModelReference(input.original);
			modifiedRef = await this.textModelService.createModelReference(input.modified);
		} catch {
			originalRef?.dispose();
			modifiedRef?.dispose();
			return false;
		}

		if (this._store.isDisposed || this.input !== input || token.isCancellationRequested || generation !== this.renderGeneration) {
			originalRef.dispose();
			modifiedRef.dispose();
			return false;
		}

		this.originalModelRef.value = originalRef;
		this.modifiedModelRef.value = modifiedRef;

		const widget = this.diffWidget.value = this.instantiationService.createInstance(
			DiffEditorWidget,
			this.editorContainer,
			this.getDiffEditorOptions(),
			{},
		);
		widget.setModel({
			original: originalRef.object.textEditorModel,
			modified: modifiedRef.object.textEditorModel,
		});
		if (!this._store.isDisposed && this.input === input && generation === this.renderGeneration) {
			this.bindAcceptCursor(widget);
		}
		return true;
	}

	private async renderModifiedOnly(input: ConversationDiffReviewInput, token: CancellationToken, generation: number): Promise<boolean> {
		if (!this.editorContainer) {
			return false;
		}

		let modifiedRef: IReference<IResolvedTextEditorModel>;
		try {
			modifiedRef = await this.textModelService.createModelReference(input.modified);
		} catch {
			return false;
		}

		if (this._store.isDisposed || this.input !== input || token.isCancellationRequested || generation !== this.renderGeneration) {
			modifiedRef.dispose();
			return false;
		}

		this.modifiedModelRef.value = modifiedRef;
		const widget = this.codeWidget.value = this.instantiationService.createInstance(
			CodeEditorWidget,
			this.editorContainer,
			readOnlyEditorOptions,
			{ isSimpleWidget: true },
		);
		widget.setModel(modifiedRef.object.textEditorModel);
		return true;
	}

	private layoutEditors(): void {
		if (!this.dimension) {
			return;
		}

		const toolbarHeight = this.toolbar?.offsetHeight ?? 0;
		const noticeHeight = this.noticeElement?.style.display === 'none' ? 0 : (this.noticeElement?.offsetHeight ?? 0);
		const editorDimension = new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - toolbarHeight - noticeHeight));
		this.diffWidget.value?.layout(editorDimension);
		this.codeWidget.value?.layout(editorDimension);
	}

	private clearEditors(): void {
		this.acceptCursorListeners.clear();
		this.acceptCursor = undefined;
		this.diffWidget.value?.setModel(null);
		this.codeWidget.value?.setModel(null);
		this.diffWidget.clear();
		this.codeWidget.clear();
		this.originalModelRef.clear();
		this.modifiedModelRef.clear();
	}
}

export function didSourcesConversationComparisonLoadFail(pane: unknown): boolean {
	return pane instanceof ConversationDiffReviewPane && pane.didComparisonLoadFail();
}

export function readOpenedSourcesConversationComparison(pane: unknown): { readonly state: 'pending' | 'ok' | 'fail' | undefined; readonly matches: (input: ConversationDiffReviewInput) => boolean } | undefined {
	if (!(pane instanceof ConversationDiffReviewPane)) {
		return undefined;
	}
	const state = pane.getComparisonLoadState();
	return {
		state,
		matches: input => pane.input instanceof ConversationDiffReviewInput && input.matches(pane.input),
	};
}
