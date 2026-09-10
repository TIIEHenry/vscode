/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationDiffReviewPane.css';
import * as dom from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IReference, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IDiffEditorConstructionOptions } from '../../../../editor/browser/editorBrowser.js';
import { CodeEditorWidget } from '../../../../editor/browser/widget/codeEditor/codeEditorWidget.js';
import { DiffEditorWidget } from '../../../../editor/browser/widget/diffEditor/diffEditorWidget.js';
import { IEditorOptions as ICodeEditorOptions } from '../../../../editor/common/config/editorOptions.js';
import { IResolvedTextEditorModel, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
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
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { ISCMService } from '../../scm/common/scm.js';
import { ConversationDiffReviewEditorId } from '../common/conversationDiffReviewInput.js';
import { findScmResourceForUri, sourcesDiffLocalWritePath } from '../common/sourcesChangeRef.js';
import {
	SOURCES_GIT_CLEAN_COMMAND,
	SOURCES_GIT_STAGE_COMMAND,
	SOURCES_GIT_UNSTAGE_COMMAND,
} from '../common/sourcesChangesGit.js';
import {
	attemptSourcesGitWrite,
	canSendSourcesGitApplyHunks,
	canSendSourcesGitStagePaths,
	hasSourcesGitApplyHunksPayload,
	resolveSourcesDiffWriteActions,
	sourcesGitUnstageUnavailableMessage,
	tryWriteSourcesGitApplyHunks,
	tryWriteSourcesGitStagePaths,
} from '../common/sourcesChangesGitWrite.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';

const $ = dom.$;

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

	private container: HTMLElement | undefined;
	private toolbar: HTMLElement | undefined;
	private revertButton: HTMLButtonElement | undefined;
	private unstageButton: HTMLButtonElement | undefined;
	private unstageUnavailable: HTMLElement | undefined;
	private stageButton: HTMLButtonElement | undefined;
	private acceptButton: HTMLButtonElement | undefined;
	private noticeElement: HTMLElement | undefined;
	private editorContainer: HTMLElement | undefined;
	private dimension: dom.Dimension | undefined;

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
		@IConversationRosterService private readonly roster: IConversationRosterService,
	) {
		super(ConversationDiffReviewPane.ID, group, telemetryService, themeService, storageService);

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('diffEditor.renderSideBySide') && this.diffWidget.value) {
				this.diffWidget.value.updateOptions(this.getDiffEditorOptions());
			}
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => this.updateReviewActions()));
		this._register(this.roster.onDidChangeActiveSession(() => this.updateReviewActions()));
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
			void this.runGitAction(SOURCES_GIT_CLEAN_COMMAND);
		}));

		this.unstageButton = dom.append(this.toolbar, $('button.conversation-diff-review-unstage')) as HTMLButtonElement;
		this.unstageButton.type = 'button';
		this.unstageButton.textContent = localize('conversationDiffReviewPane.unstage', "Unstage");
		this.unstageButton.style.display = 'none';
		this._register(dom.addDisposableListener(this.unstageButton, 'click', () => {
			void this.runGitAction(SOURCES_GIT_UNSTAGE_COMMAND);
		}));

		this.unstageUnavailable = dom.append(this.toolbar, $('span.conversation-diff-review-unstage-unavailable'));
		this.unstageUnavailable.textContent = sourcesGitUnstageUnavailableMessage();
		this.unstageUnavailable.style.display = 'none';

		this.stageButton = dom.append(this.toolbar, $('button.conversation-diff-review-stage')) as HTMLButtonElement;
		this.stageButton.type = 'button';
		this.stageButton.textContent = localize('conversationDiffReviewPane.stage', "Stage");
		this.stageButton.style.display = 'none';
		this._register(dom.addDisposableListener(this.stageButton, 'click', () => {
			void this.runStage();
		}));

		this.acceptButton = dom.append(this.toolbar, $('button.conversation-diff-review-accept')) as HTMLButtonElement;
		this.acceptButton.type = 'button';
		this.acceptButton.textContent = localize('conversationDiffReviewPane.accept', "Accept");
		this.acceptButton.style.display = 'none';
		this._register(dom.addDisposableListener(this.acceptButton, 'click', () => {
			void this.runAccept();
		}));

		const previewButton = dom.append(this.toolbar, $('button.conversation-diff-review-open-preview')) as HTMLButtonElement;
		previewButton.type = 'button';
		previewButton.textContent = localize('conversationDiffReviewPane.openPreview', "Open Diff in Preview");
		this._register(dom.addDisposableListener(previewButton, 'click', () => {
			void this.commandService.executeCommand('sources.diff.moveToPreview');
		}));

		this.noticeElement = dom.append(this.container, $('.conversation-diff-review-notice'));
		this.noticeElement.style.display = 'none';
		this.editorContainer = dom.append(this.container, $('.conversation-diff-review-editor'));
	}

	override async setInput(input: ConversationDiffReviewInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (this._store.isDisposed || token.isCancellationRequested) {
			return;
		}

		this.clearEditors();
		this.updateReviewActions();

		if (!input.original) {
			this.showNotice(localize('conversationDiffReviewPane.newFile', "New file with no previous version to compare."));
			await this.renderModifiedOnly(input, token);
		} else {
			this.hideNotice();
			await this.renderDiff(input, token);
		}

		if (this._store.isDisposed || this.input !== input || token.isCancellationRequested) {
			return;
		}

		this.layoutEditors();
		this._onDidChangeControl.fire();
	}

	override dispose(): void {
		this.clearEditors();
		super.dispose();
	}

	override clearInput(): void {
		this.clearEditors();
		this.hideNotice();
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

	private getGitSessionId(): string {
		return this.roster.getActiveSessionId();
	}

	private updateReviewActions(): void {
		const input = this.input;
		if (!(input instanceof ConversationDiffReviewInput) || !this.revertButton || !this.stageButton || !this.acceptButton || !this.unstageButton || !this.unstageUnavailable) {
			return;
		}

		const match = findScmResourceForUri(this.scmService, input.modified);
		const sessionId = this.getGitSessionId();
		const actions = resolveSourcesDiffWriteActions({
			groupId: match?.groupId || input.groupId,
			hasScmResource: !!match,
			canWriteStage: canSendSourcesGitStagePaths(
				this.uaConnection.isEngineConnected(),
				typeof this.uaConnection.writeGitStagePaths === 'function',
				sessionId,
			),
			canWriteAccept: canSendSourcesGitApplyHunks(
				this.uaConnection.isEngineConnected(),
				typeof this.uaConnection.writeGitApplyHunks === 'function',
			),
			hasApplyHunksPayload: hasSourcesGitApplyHunksPayload(sessionId, []),
			hasGitStageCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_STAGE_COMMAND),
			hasGitUnstageCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_UNSTAGE_COMMAND),
			hasGitCleanCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_CLEAN_COMMAND),
		});

		this.revertButton.style.display = actions.showRevert ? '' : 'none';
		this.unstageButton.style.display = actions.showUnstage ? '' : 'none';
		this.unstageUnavailable.style.display = actions.unstageUnavailable ? '' : 'none';
		this.stageButton.style.display = actions.showStage ? '' : 'none';
		this.acceptButton.style.display = actions.showAccept ? '' : 'none';
	}

	private async runStage(): Promise<void> {
		const input = this.input;
		if (!(input instanceof ConversationDiffReviewInput)) {
			return;
		}

		const match = findScmResourceForUri(this.scmService, input.modified);
		const hook = this.uaConnection.writeGitStagePaths;
		try {
			const attempt = await attemptSourcesGitWrite(() => tryWriteSourcesGitStagePaths(
				this.uaConnection.isEngineConnected(),
				hook ? request => hook.call(this.uaConnection, request) : undefined,
				this.getGitSessionId(),
				[sourcesDiffLocalWritePath({ modified: input.modified, scmResource: match?.resource })],
			));
			if (attempt.kind === 'accepted') {
				this.hideNotice();
				this.updateReviewActions();
				return;
			}
			if (attempt.kind === 'failed') {
				this.showNotice(attempt.detail);
				this.updateReviewActions();
				return;
			}
		} catch (error) {
			this.showNotice(getErrorMessage(error));
			this.updateReviewActions();
			return;
		}

		if (match) {
			await this.runGitAction(SOURCES_GIT_STAGE_COMMAND);
			return;
		}

		if (canSendSourcesGitStagePaths(
			this.uaConnection.isEngineConnected(),
			typeof this.uaConnection.writeGitStagePaths === 'function',
			this.getGitSessionId(),
		)) {
			this.showNotice(localize('conversationDiffReviewPane.stageUnavailable', "Git stage is not available."));
		}
		this.updateReviewActions();
	}

	private async runAccept(): Promise<void> {
		const input = this.input;
		if (!(input instanceof ConversationDiffReviewInput)) {
			return;
		}

		const sessionId = this.getGitSessionId();
		const patches: readonly string[] = [];
		const hook = this.uaConnection.writeGitApplyHunks;
		try {
			const attempt = await attemptSourcesGitWrite(() => tryWriteSourcesGitApplyHunks(
				this.uaConnection.isEngineConnected(),
				hook ? request => hook.call(this.uaConnection, request) : undefined,
				sessionId,
			));
			if (attempt.kind === 'accepted') {
				this.hideNotice();
				this.updateReviewActions();
				return;
			}
			if (attempt.kind === 'failed') {
				this.showNotice(attempt.detail);
				this.updateReviewActions();
				return;
			}
		} catch (error) {
			this.showNotice(getErrorMessage(error));
			this.updateReviewActions();
			return;
		}

		if (canSendSourcesGitApplyHunks(
			this.uaConnection.isEngineConnected(),
			typeof this.uaConnection.writeGitApplyHunks === 'function',
		) || hasSourcesGitApplyHunksPayload(sessionId, patches)) {
			this.showNotice(localize('conversationDiffReviewPane.acceptUnavailable', "Git accept is not available."));
		}
		this.updateReviewActions();
	}

	private async runGitAction(commandId: string): Promise<void> {
		const input = this.input;
		if (!(input instanceof ConversationDiffReviewInput)) {
			return;
		}

		const match = findScmResourceForUri(this.scmService, input.modified);
		if (!match?.resource) {
			return;
		}

		try {
			await this.commandService.executeCommand(commandId, match.resource);
		} catch (error) {
			this.showNotice(getErrorMessage(error));
		} finally {
			this.updateReviewActions();
		}
	}

	private showNotice(message: string): void {
		if (!this.noticeElement) {
			return;
		}
		this.noticeElement.textContent = message;
		this.noticeElement.style.display = '';
	}

	private hideNotice(): void {
		if (!this.noticeElement) {
			return;
		}
		this.noticeElement.textContent = '';
		this.noticeElement.style.display = 'none';
	}

	private async renderDiff(input: ConversationDiffReviewInput, token: CancellationToken): Promise<void> {
		if (!this.editorContainer || !input.original) {
			return;
		}

		let originalRef: IReference<IResolvedTextEditorModel> | undefined;
		let modifiedRef: IReference<IResolvedTextEditorModel> | undefined;
		try {
			originalRef = await this.textModelService.createModelReference(input.original);
			modifiedRef = await this.textModelService.createModelReference(input.modified);
		} catch {
			originalRef?.dispose();
			modifiedRef?.dispose();
			this.showNotice(localize('conversationDiffReviewPane.loadFailed', "Unable to load this comparison."));
			return;
		}

		if (this._store.isDisposed || this.input !== input || token.isCancellationRequested) {
			originalRef.dispose();
			modifiedRef.dispose();
			return;
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
	}

	private async renderModifiedOnly(input: ConversationDiffReviewInput, token: CancellationToken): Promise<void> {
		if (!this.editorContainer) {
			return;
		}

		let modifiedRef: IReference<IResolvedTextEditorModel>;
		try {
			modifiedRef = await this.textModelService.createModelReference(input.modified);
		} catch {
			this.showNotice(localize('conversationDiffReviewPane.loadFailed', "Unable to load this comparison."));
			return;
		}

		if (this._store.isDisposed || this.input !== input || token.isCancellationRequested) {
			modifiedRef.dispose();
			return;
		}

		this.modifiedModelRef.value = modifiedRef;
		const widget = this.codeWidget.value = this.instantiationService.createInstance(
			CodeEditorWidget,
			this.editorContainer,
			readOnlyEditorOptions,
			{ isSimpleWidget: true },
		);
		widget.setModel(modifiedRef.object.textEditorModel);
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
		this.diffWidget.value?.setModel(null);
		this.codeWidget.value?.setModel(null);
		this.diffWidget.clear();
		this.codeWidget.clear();
		this.originalModelRef.clear();
		this.modifiedModelRef.clear();
	}
}
