var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import "./media/conversationDiffReviewPane.css";
import * as dom from "../../../../base/browser/dom.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { DiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { getErrorMessage, onUnexpectedError } from "../../../../base/common/errors.js";
import { localize } from "../../../../nls.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUniverseAgentConnection } from "../../../../platform/universeAgent/common/universeAgentConnection.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { conversationSessionReadinessProbe, getConversationSessionReadiness } from "../../conversation/common/conversationSessionReadiness.js";
import { IAgentSessionContext } from "../../../services/agentSession/common/agentSessionContext.js";
import { ISCMService } from "../../scm/common/scm.js";
import { ConversationDiffReviewEditorId } from "../../../common/editor/conversationDiffReviewInput.js";
import { resolveSourcesDiffWriteGate } from "../common/sourcesChangeRef.js";
import {
  SOURCES_GIT_CLEAN_COMMAND,
  SOURCES_GIT_STAGE_COMMAND,
  SOURCES_GIT_UNSTAGE_COMMAND
} from "../common/sourcesChangesGit.js";
import { sourcesGitDiffOpenFailureMessage, tryReadSourcesGitFileDiff } from "../common/sourcesChangesGitRead.js";
import {
  attemptSourcesGitWrite,
  canSendSourcesGitApplyHunks,
  canSendSourcesGitStagePaths,
  sourcesGitWriteHookPresent,
  hasSourcesGitApplyHunksPayload,
  hasSourcesGitSessionId,
  isSourcesKeepLeftoverWrite,
  sourcesGitEmptyStagePathMessage,
  sourcesGitSessionChangedMessage,
  sourcesGitUnstageUnavailableMessage,
  tryWriteSourcesGitApplyHunks,
  tryWriteSourcesGitStagePaths
} from "../common/sourcesChangesGitWrite.js";
import {
  canOfferSourcesGitAcceptHunk,
  rememberSourcesGitAcceptCursor,
  SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE,
  SOURCES_GIT_APPLY_CACHED_ARGV,
  sourcesGitAcceptCursorFromEditors,
  sourcesGitHunkPatchAtCursor
} from "../common/sourcesGitHunkPatch.js";
import { ISourcesChangesModel, isSourcesChangesReadFailed, sourcesChangesWriteSessionId } from "../common/sourcesChangesModel.js";
import {
  markSourcesDiffWriteCollapsed,
  planSourcesDiffAcceptAfterAttempt,
  planSourcesDiffAcceptAttempt,
  planSourcesDiffLocalGitAction,
  planSourcesDiffStageAfterAttempt,
  planSourcesDiffStageAttempt,
  resolveSourcesDiffEmptyStageChrome,
  resolveSourcesDiffWriteControllerChrome,
  sourcesDiffAcceptUnavailableMessage,
  sourcesDiffWriteCollapseFor
} from "../common/sourcesDiffWriteController.js";
import { ConversationDiffReviewInput } from "./conversationDiffReviewInput.js";
import { fireSourcesDiffLoad } from "./sourcesDiffLoadSignal.js";
import { sourcesChangeOpenIncompleteMessage } from "./sourcesChangeEntryOpen.js";
const $ = dom.$;
function conversationDiffComparisonLoadFailedMessage() {
  return localize("conversationDiffReviewPane.loadFailed", "Unable to load this comparison.");
}
const readOnlyEditorOptions = {
  readOnly: true,
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  automaticLayout: false,
  lineNumbers: "on"
};
let ConversationDiffReviewPane = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, commandService, instantiationService, textModelService, configurationService, scmService, uaConnection, session, changesModel) {
    super(ConversationDiffReviewPane.ID, group, telemetryService, themeService, storageService);
    this.commandService = commandService;
    this.instantiationService = instantiationService;
    this.textModelService = textModelService;
    this.configurationService = configurationService;
    this.scmService = scmService;
    this.uaConnection = uaConnection;
    this.session = session;
    this.changesModel = changesModel;
    this.diffWidget = this._register(new MutableDisposable());
    this.diffViewModel = this._register(new MutableDisposable());
    this.codeWidget = this._register(new MutableDisposable());
    this.originalModelRef = this._register(new MutableDisposable());
    this.modifiedModelRef = this._register(new MutableDisposable());
    this.acceptCursorListeners = this._register(new DisposableStore());
    this.moveAttemptGeneration = 0;
    this.comparisonLoadFailed = false;
    this.renderGeneration = 0;
    /** Bumped by setInput / clearInput / dispose so in-flight Stage / Accept cannot write back. */
    this.stageAttemptGeneration = 0;
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("diffEditor.renderSideBySide") && this.diffWidget.value) {
        this.diffWidget.value.updateOptions(this.getDiffEditorOptions());
      }
    }));
    this._register(this.uaConnection.onDidChangeConnection(() => this.onWriteFactsChanged()));
    this._register(this.session.onDidChangeActiveSession(() => this.onWriteFactsChanged()));
    this._register(this.session.onDidChangeSession(() => this.onWriteFactsChanged()));
    this._register(this.changesModel.onDidChange(() => this.onWriteFactsChanged()));
  }
  createEditor(parent) {
    this.container = dom.append(parent, $(".conversation-diff-review-pane"));
    this.container.setAttribute("role", "document");
    this.container.setAttribute("aria-label", localize("conversationDiffReviewPane.ariaLabel", "Conversation Diff Review"));
    this.toolbar = dom.append(this.container, $(".conversation-diff-review-toolbar"));
    this.revertButton = dom.append(this.toolbar, $("button.conversation-diff-review-revert"));
    this.revertButton.type = "button";
    this.revertButton.textContent = localize("conversationDiffReviewPane.revert", "Revert");
    this.revertButton.style.display = "none";
    this._register(dom.addDisposableListener(this.revertButton, "click", () => {
      void this.runGitAction(SOURCES_GIT_CLEAN_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
    }));
    this.unstageButton = dom.append(this.toolbar, $("button.conversation-diff-review-unstage"));
    this.unstageButton.type = "button";
    this.unstageButton.textContent = localize("conversationDiffReviewPane.unstage", "Unstage");
    this.unstageButton.style.display = "none";
    this._register(dom.addDisposableListener(this.unstageButton, "click", () => {
      void this.runGitAction(SOURCES_GIT_UNSTAGE_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
    }));
    this.unstageUnavailable = dom.append(this.toolbar, $("span.conversation-diff-review-unstage-unavailable"));
    this.unstageUnavailable.textContent = sourcesGitUnstageUnavailableMessage();
    this.unstageUnavailable.style.display = "none";
    this.stageButton = dom.append(this.toolbar, $("button.conversation-diff-review-stage"));
    this.stageButton.type = "button";
    this.stageButton.textContent = localize("conversationDiffReviewPane.stage", "Stage");
    this.stageButton.style.display = "none";
    this._register(dom.addDisposableListener(this.stageButton, "click", () => {
      void this.runStage().catch(onUnexpectedError).catch(onUnexpectedError);
    }));
    this.acceptButton = dom.append(this.toolbar, $("button.conversation-diff-review-accept"));
    this.acceptButton.type = "button";
    this.acceptButton.textContent = localize("conversationDiffReviewPane.accept", "Accept");
    this.acceptButton.style.display = "none";
    this._register(dom.addDisposableListener(this.acceptButton, "click", () => {
      void this.runAccept().catch(onUnexpectedError).catch(onUnexpectedError);
    }));
    this.previewButton = dom.append(this.toolbar, $("button.conversation-diff-review-open-preview"));
    this.previewButton.type = "button";
    this.previewButton.textContent = localize("conversationDiffReviewPane.openPreview", "Open Diff in Preview");
    this.previewButton.style.display = "none";
    this._register(dom.addDisposableListener(this.previewButton, "click", () => {
      void this.runMoveToPreview().catch(onUnexpectedError).catch(onUnexpectedError);
    }));
    this.toolbar.style.display = "none";
    this.noticeElement = dom.append(this.container, $(".conversation-diff-review-notice"));
    this.noticeElement.style.display = "none";
    this.moveNoticeElement = dom.append(this.container, $(".conversation-diff-review-notice.conversation-diff-review-move-notice"));
    this.hideMoveNotice();
    this.editorContainer = dom.append(this.container, $(".conversation-diff-review-editor"));
  }
  async setInput(input, options, context, token) {
    this.stageAttemptGeneration++;
    this.moveAttemptGeneration++;
    this.hideMoveNotice();
    const generation = input.loadGeneration;
    this.renderGeneration = generation;
    this.comparisonState = "pending";
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
        this.showNotice(localize("conversationDiffReviewPane.newFile", "New file with no previous version to compare."), false);
      }
    } else {
      loaded = await this.renderDiff(input, token, generation);
    }
    if (this._store.isDisposed || this.input !== input || token.isCancellationRequested || generation !== this.renderGeneration) {
      return;
    }
    if (!loaded) {
      this.comparisonState = "fail";
      this.comparisonLoadFailed = true;
      this.hideWriteChrome();
      this.setReviewChromeVisible(false);
      this.showNotice(conversationDiffComparisonLoadFailedMessage());
      this.layoutEditors();
      this._onDidChangeControl.fire();
      fireSourcesDiffLoad({ resource: input.modified, generation, ok: false });
      return;
    }
    this.comparisonState = "ok";
    this.setReviewChromeVisible(true);
    this.updateReviewActions();
    this.layoutEditors();
    this._onDidChangeControl.fire();
    fireSourcesDiffLoad({ resource: input.modified, generation, ok: true });
  }
  didComparisonLoadFail() {
    return this.comparisonLoadFailed;
  }
  getComparisonLoadState() {
    return this.comparisonState;
  }
  dispose() {
    this.stageAttemptGeneration++;
    this.moveAttemptGeneration++;
    this.hideMoveNotice();
    this.clearEditors();
    super.dispose();
  }
  clearInput() {
    this.stageAttemptGeneration++;
    this.moveAttemptGeneration++;
    this.hideMoveNotice();
    this.writeCollapse = void 0;
    this.comparisonLoadFailed = false;
    this.comparisonState = void 0;
    this.clearEditors();
    this.hideNotice();
    this.setReviewChromeVisible(false);
    if (this.revertButton) {
      this.revertButton.style.display = "none";
    }
    if (this.unstageButton) {
      this.unstageButton.style.display = "none";
    }
    if (this.unstageUnavailable) {
      this.unstageUnavailable.style.display = "none";
    }
    if (this.stageButton) {
      this.stageButton.style.display = "none";
    }
    if (this.acceptButton) {
      this.acceptButton.style.display = "none";
    }
    super.clearInput();
  }
  getControl() {
    return this.diffWidget.value ?? this.codeWidget.value;
  }
  focus() {
    super.focus();
    (this.diffWidget.value?.getModifiedEditor() ?? this.codeWidget.value)?.focus();
  }
  layout(dimension) {
    this.dimension = new dom.Dimension(dimension.width, dimension.height);
    if (this.container) {
      this.container.style.width = `${dimension.width}px`;
      this.container.style.height = `${dimension.height}px`;
    }
    this.layoutEditors();
  }
  getDiffEditorOptions() {
    return {
      ...readOnlyEditorOptions,
      originalEditable: false,
      renderSideBySide: this.configurationService.getValue("diffEditor.renderSideBySide") ?? true,
      useInlineViewWhenSpaceIsLimited: true,
      renderOverviewRuler: false
    };
  }
  onWriteFactsChanged() {
    this.updateReviewActions();
    this.layoutEditors();
  }
  getGitSessionId() {
    const snapshot = this.changesModel.getSnapshot();
    const modified = this.input instanceof ConversationDiffReviewInput ? this.input.modified : void 0;
    const matches = modified ? snapshot.entries.filter((entry) => entry.resource.toString() === modified.toString()) : void 0;
    return sourcesChangesWriteSessionId(snapshot, matches, this.session.getActiveSessionId());
  }
  getEngineSessionReady() {
    return getConversationSessionReadiness(conversationSessionReadinessProbe(this.session)) === "ready";
  }
  isReadFailed() {
    return isSourcesChangesReadFailed(this.changesModel.getSnapshot().state);
  }
  isSourcesKeepLeftoverWrite() {
    return isSourcesKeepLeftoverWrite(
      this.uaConnection.isEngineConnected(),
      !!this.uaConnection.getConnectionSnapshot?.().pairingPending,
      this.getEngineSessionReady()
    );
  }
  isSourcesDiffWriteHold() {
    return this.changesModel.isWriteClosed();
  }
  setReviewChromeVisible(visible) {
    if (this.toolbar) {
      this.toolbar.style.display = visible ? "" : "none";
    }
    if (this.previewButton) {
      this.previewButton.style.display = visible ? "" : "none";
    }
  }
  hideWriteChrome() {
    if (this.revertButton) {
      this.revertButton.style.display = "none";
    }
    if (this.unstageButton) {
      this.unstageButton.style.display = "none";
    }
    if (this.unstageUnavailable) {
      this.unstageUnavailable.style.display = "none";
    }
    if (this.stageButton) {
      this.stageButton.style.display = "none";
    }
    if (this.acceptButton) {
      this.acceptButton.style.display = "none";
    }
  }
  updateReviewActions() {
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
    this.revertButton.style.display = chrome.showRevert ? "" : "none";
    this.unstageButton.style.display = chrome.showUnstage ? "" : "none";
    this.unstageUnavailable.style.display = chrome.unstageUnavailable ? "" : "none";
    this.stageButton.style.display = chrome.showStage ? "" : "none";
    this.acceptButton.style.display = chrome.showAccept ? "" : "none";
    this.applyEmptyStagePathChrome(facts);
  }
  /** Empty engine identity: disable Stage and show status. The click path still must not send. */
  applyEmptyStagePathChrome(facts) {
    if (!this.stageButton) {
      return;
    }
    const emptyStage = resolveSourcesDiffEmptyStageChrome(facts);
    const stageLabel = localize("conversationDiffReviewPane.stage", "Stage");
    this.stageButton.disabled = emptyStage.disableStage;
    this.stageButton.setAttribute("aria-disabled", emptyStage.disableStage ? "true" : "false");
    const emptyMessage = sourcesGitEmptyStagePathMessage();
    this.stageButton.title = emptyStage.disableStage ? emptyMessage : stageLabel;
    this.stageButton.setAttribute("aria-label", emptyStage.disableStage ? `${stageLabel}. ${emptyMessage}` : stageLabel);
    if (emptyStage.status) {
      this.showNotice(emptyStage.status);
      return;
    }
    if (this.noticeElement?.textContent === emptyMessage) {
      this.hideNotice();
    }
  }
  currentWriteFacts() {
    const input = this.input;
    if (!(input instanceof ConversationDiffReviewInput)) {
      return void 0;
    }
    const gate = resolveSourcesDiffWriteGate(this.scmService, {
      modified: input.modified,
      groupId: input.groupId,
      origin: input.origin,
      gitPath: input.gitPath
    });
    const fallbackSessionId = this.getGitSessionId();
    const pairingHold = this.session.isPairingHold();
    const readFailed = this.isReadFailed();
    const engineSessionReady = this.getEngineSessionReady();
    const pinnedSessionId = input.sessionId ?? "";
    return {
      identity: {
        origin: input.origin,
        sessionId: input.sessionId,
        modified: input.modified
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
        sourcesGitWriteHookPresent(this.uaConnection.getConnectionSnapshot?.(), "writeGitStagePaths", this.uaConnection.writeGitStagePaths),
        fallbackSessionId,
        pairingHold,
        readFailed,
        engineSessionReady
      ),
      canWriteAccept: canSendSourcesGitApplyHunks(
        this.uaConnection.isEngineConnected(),
        sourcesGitWriteHookPresent(this.uaConnection.getConnectionSnapshot?.(), "writeGitApplyHunks", this.uaConnection.writeGitApplyHunks),
        pairingHold,
        readFailed,
        engineSessionReady
      ),
      hasApplyHunksPayload: canOfferSourcesGitAcceptHunk(input.kind, input.indexState) && gate.path !== "" && hasSourcesGitSessionId(pinnedSessionId),
      hasGitStageCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_STAGE_COMMAND),
      hasGitUnstageCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_UNSTAGE_COMMAND),
      hasGitCleanCommand: !!CommandsRegistry.getCommand(SOURCES_GIT_CLEAN_COMMAND),
      pairingHold,
      keepLeftover: this.isSourcesKeepLeftoverWrite(),
      patches: [],
      collapse: this.writeCollapse
    };
  }
  async runStage() {
    const input = this.input;
    const plan = planSourcesDiffStageAttempt(this.currentWriteFacts());
    if (plan.kind === "blocked") {
      return;
    }
    if (plan.kind === "notice") {
      this.showNotice(plan.message);
      this.updateReviewActions();
      return;
    }
    const stageAttemptGeneration = this.stageAttemptGeneration;
    const hook = this.uaConnection.writeGitStagePaths;
    try {
      const attempt = plan.kind === "skip-engine" ? { kind: "fallback" } : await attemptSourcesGitWrite(() => tryWriteSourcesGitStagePaths(
        this.uaConnection.isEngineConnected(),
        hook ? (request) => hook.call(this.uaConnection, request) : void 0,
        plan.sessionId,
        [plan.path],
        this.session.isPairingHold(),
        this.isReadFailed(),
        this.getEngineSessionReady()
      ));
      if (this._store.isDisposed || this.input !== input || stageAttemptGeneration !== this.stageAttemptGeneration) {
        return;
      }
      const facts = this.currentWriteFacts();
      if (!facts) {
        return;
      }
      const after = planSourcesDiffStageAfterAttempt(attempt, facts);
      if (after.kind === "collapse-stage") {
        this.writeCollapse = markSourcesDiffWriteCollapsed(facts.identity.modified, "stage");
        this.hideNotice();
        this.updateReviewActions();
        return;
      }
      if (after.kind === "clear-notice") {
        this.hideNotice();
        this.updateReviewActions();
        return;
      }
      if (after.kind === "notice") {
        this.showNotice(after.message);
        this.updateReviewActions();
        return;
      }
      if (after.kind === "local") {
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
  bindAcceptCursor(widget) {
    const listen = (side, editor) => {
      const remember = () => {
        const line = editor.getPosition()?.lineNumber;
        if (line === void 0) {
          return;
        }
        this.acceptCursor = rememberSourcesGitAcceptCursor(this.acceptCursor, {
          side,
          line,
          editorHasFocus: editor.hasTextFocus()
        });
      };
      this.acceptCursorListeners.add(editor.onDidChangeCursorPosition(remember));
      this.acceptCursorListeners.add(editor.onDidFocusEditorText(remember));
    };
    listen("new", widget.getModifiedEditor());
    listen("old", widget.getOriginalEditor());
  }
  readAcceptCursor() {
    const widget = this.diffWidget.value;
    const modified = widget?.getModifiedEditor();
    const original = widget?.getOriginalEditor();
    return sourcesGitAcceptCursorFromEditors({
      focused: modified?.hasTextFocus() ? "new" : original?.hasTextFocus() ? "old" : void 0,
      remembered: this.acceptCursor,
      modifiedLine: modified?.getPosition()?.lineNumber,
      originalLine: original?.getPosition()?.lineNumber
    });
  }
  async runAccept() {
    const input = this.input;
    const plan = planSourcesDiffAcceptAttempt(this.currentWriteFacts());
    if (plan.kind === "blocked") {
      return;
    }
    if (plan.kind === "notice") {
      this.showNotice(plan.message);
      this.updateReviewActions();
      return;
    }
    const stageAttemptGeneration = this.stageAttemptGeneration;
    const isCurrent = () => !this._store.isDisposed && input instanceof ConversationDiffReviewInput && !input.isDisposed() && this.input === input && stageAttemptGeneration === this.stageAttemptGeneration;
    const sessionId = input instanceof ConversationDiffReviewInput ? input.sessionId ?? "" : "";
    const path = this.currentWriteFacts()?.path ?? "";
    const cursor = this.readAcceptCursor();
    const kind = input instanceof ConversationDiffReviewInput ? input.kind : void 0;
    const indexState = input instanceof ConversationDiffReviewInput ? input.indexState : void 0;
    if (!isCurrent() || !canOfferSourcesGitAcceptHunk(kind, indexState) || path === "" || sessionId === "" || !cursor) {
      return;
    }
    const readGitFileDiff = this.uaConnection.readGitFileDiff;
    try {
      const read = await tryReadSourcesGitFileDiff(
        this.uaConnection.isEngineConnected(),
        readGitFileDiff ? (request) => readGitFileDiff.call(this.uaConnection, request) : void 0,
        sessionId,
        path,
        SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE,
        this.session.isPairingHold(),
        this.isReadFailed()
      );
      if (!isCurrent()) {
        return;
      }
      const beforeWriteFacts = this.currentWriteFacts();
      const writePlan = planSourcesDiffAcceptAttempt(beforeWriteFacts);
      if (writePlan.kind !== "engine") {
        if (writePlan.kind === "notice") {
          this.showNotice(writePlan.message);
        }
        this.updateReviewActions();
        return;
      }
      if (writePlan.sessionId !== sessionId) {
        this.showNotice(sourcesGitSessionChangedMessage());
        this.updateReviewActions();
        return;
      }
      if (!beforeWriteFacts?.canWriteAccept) {
        this.updateReviewActions();
        return;
      }
      const patch = read?.supported ? sourcesGitHunkPatchAtCursor(read.unifiedDiff, cursor.line, cursor.side) : void 0;
      if (!patch || !hasSourcesGitApplyHunksPayload(sessionId, [patch])) {
        this.showNotice(sourcesDiffAcceptUnavailableMessage());
        this.updateReviewActions();
        return;
      }
      const hook = this.uaConnection.writeGitApplyHunks;
      const attempt = await attemptSourcesGitWrite(() => tryWriteSourcesGitApplyHunks(
        this.uaConnection.isEngineConnected(),
        hook ? (request) => hook.call(this.uaConnection, request) : void 0,
        sessionId,
        SOURCES_GIT_APPLY_CACHED_ARGV,
        [patch],
        this.session.isPairingHold(),
        this.isReadFailed(),
        this.getEngineSessionReady()
      ));
      if (!isCurrent()) {
        return;
      }
      const facts = this.currentWriteFacts();
      if (!facts) {
        return;
      }
      const after = planSourcesDiffAcceptAfterAttempt(attempt, facts);
      if (after.kind === "clear-notice") {
        this.hideNotice();
        this.changesModel.scheduleRefresh();
        this.updateReviewActions();
        return;
      }
      if (after.kind === "notice") {
        this.showNotice(after.message);
        this.updateReviewActions();
        return;
      }
      this.updateReviewActions();
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      this.showNotice(getErrorMessage(error));
      this.updateReviewActions();
    }
  }
  async runGitAction(commandId) {
    const facts = this.currentWriteFacts();
    const plan = planSourcesDiffLocalGitAction(commandId, facts);
    if (plan.kind !== "local" || !facts) {
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
  /** Keep button feedback on the original Pane/input and on this move attempt. */
  async runMoveToPreview() {
    const input = this.input;
    if (!(input instanceof ConversationDiffReviewInput)) {
      return;
    }
    const generation = this.renderGeneration;
    const attempt = ++this.moveAttemptGeneration;
    const source = { kind: "conversationPane", editor: input, group: this.group, pane: this };
    const isCurrent = () => !this._store.isDisposed && this.input === input && !input.isDisposed() && this.renderGeneration === generation && this.moveAttemptGeneration === attempt;
    let result;
    try {
      result = await this.commandService.executeCommand("sources.diff.moveToPreview", source);
    } catch (error) {
      if (isCurrent()) {
        this.showMoveNotice(sourcesGitDiffOpenFailureMessage(error));
      }
      return;
    }
    if (!isCurrent() || result === "stale") {
      return;
    }
    if (result === true) {
      this.hideMoveNotice();
    } else {
      this.showMoveNotice(sourcesChangeOpenIncompleteMessage());
    }
  }
  showMoveNotice(message) {
    if (this.moveNoticeElement) {
      this.moveNoticeElement.textContent = message;
      this.moveNoticeElement.classList.add("is-error");
      this.moveNoticeElement.style.display = "";
    }
  }
  hideMoveNotice() {
    if (this.moveNoticeElement) {
      this.moveNoticeElement.textContent = "";
      this.moveNoticeElement.style.display = "none";
    }
  }
  showNotice(message, isError = true) {
    if (!this.noticeElement) {
      return;
    }
    this.noticeElement.textContent = message;
    this.noticeElement.classList.toggle("is-error", isError);
    this.noticeElement.style.display = "";
  }
  hideNotice() {
    if (!this.noticeElement) {
      return;
    }
    this.noticeElement.textContent = "";
    this.noticeElement.classList.remove("is-error");
    this.noticeElement.style.display = "none";
  }
  async renderDiff(input, token, generation) {
    if (!this.editorContainer || !input.original) {
      return false;
    }
    let originalRef;
    let modifiedRef;
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
      {}
    );
    const viewModel = this.diffViewModel.value = widget.createViewModel({
      original: originalRef.object.textEditorModel,
      modified: modifiedRef.object.textEditorModel
    });
    widget.setModel(viewModel);
    if (!this._store.isDisposed && this.input === input && generation === this.renderGeneration) {
      this.bindAcceptCursor(widget);
    }
    return true;
  }
  async renderModifiedOnly(input, token, generation) {
    if (!this.editorContainer) {
      return false;
    }
    let modifiedRef;
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
      { isSimpleWidget: true }
    );
    widget.setModel(modifiedRef.object.textEditorModel);
    return true;
  }
  layoutEditors() {
    if (!this.dimension) {
      return;
    }
    const toolbarHeight = this.toolbar?.offsetHeight ?? 0;
    const noticeHeight = this.noticeElement?.style.display === "none" ? 0 : this.noticeElement?.offsetHeight ?? 0;
    const editorDimension = new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - toolbarHeight - noticeHeight));
    this.diffWidget.value?.layout(editorDimension);
    this.codeWidget.value?.layout(editorDimension);
  }
  clearEditors() {
    this.acceptCursorListeners.clear();
    this.acceptCursor = void 0;
    this.diffWidget.value?.setModel(null);
    this.codeWidget.value?.setModel(null);
    this.diffWidget.clear();
    this.codeWidget.clear();
    this.diffViewModel.clear();
    this.originalModelRef.clear();
    this.modifiedModelRef.clear();
  }
};
ConversationDiffReviewPane.ID = ConversationDiffReviewEditorId;
ConversationDiffReviewPane = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ITextModelService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ISCMService),
  __decorateParam(9, IUniverseAgentConnection),
  __decorateParam(10, IAgentSessionContext),
  __decorateParam(11, ISourcesChangesModel)
], ConversationDiffReviewPane);
function didSourcesConversationComparisonLoadFail(pane) {
  return pane instanceof ConversationDiffReviewPane && pane.didComparisonLoadFail();
}
function readOpenedSourcesConversationComparison(pane) {
  if (!(pane instanceof ConversationDiffReviewPane)) {
    return void 0;
  }
  const state = pane.getComparisonLoadState();
  return {
    state,
    matches: (input) => pane.input instanceof ConversationDiffReviewInput && input.matches(pane.input)
  };
}
export {
  ConversationDiffReviewPane,
  conversationDiffComparisonLoadFailedMessage,
  didSourcesConversationComparisonLoadFail,
  readOpenedSourcesConversationComparison
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL3NvdXJjZXMvYnJvd3Nlci9jb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9jb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZS5jc3MnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJUmVmZXJlbmNlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRGlmZkVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9kaWZmRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIGFzIElDb2RlRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSURpZmZFZGl0b3JWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0RXJyb3JNZXNzYWdlLCBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL3VuaXZlcnNlQWdlbnRDb25uZWN0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvclBhbmUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JQYW5lLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcGVuQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3NQcm9iZSwgZ2V0Q29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzcyB9IGZyb20gJy4uLy4uL2NvbnZlcnNhdGlvbi9jb21tb24vY29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzcy5qcyc7XG5pbXBvcnQgeyBJQWdlbnRTZXNzaW9uQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2FnZW50U2Vzc2lvbi9jb21tb24vYWdlbnRTZXNzaW9uQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBJU0NNU2VydmljZSB9IGZyb20gJy4uLy4uL3NjbS9jb21tb24vc2NtLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdFZGl0b3JJZCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvY29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0LmpzJztcbmltcG9ydCB7IHJlc29sdmVTb3VyY2VzRGlmZldyaXRlR2F0ZSB9IGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzQ2hhbmdlUmVmLmpzJztcbmltcG9ydCB7XG5cdFNPVVJDRVNfR0lUX0NMRUFOX0NPTU1BTkQsXG5cdFNPVVJDRVNfR0lUX1NUQUdFX0NPTU1BTkQsXG5cdFNPVVJDRVNfR0lUX1VOU1RBR0VfQ09NTUFORCxcbn0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzR2l0LmpzJztcbmltcG9ydCB7IHNvdXJjZXNHaXREaWZmT3BlbkZhaWx1cmVNZXNzYWdlLCB0cnlSZWFkU291cmNlc0dpdEZpbGVEaWZmIH0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzR2l0UmVhZC5qcyc7XG5pbXBvcnQge1xuXHRhdHRlbXB0U291cmNlc0dpdFdyaXRlLFxuXHRjYW5TZW5kU291cmNlc0dpdEFwcGx5SHVua3MsXG5cdGNhblNlbmRTb3VyY2VzR2l0U3RhZ2VQYXRocyxcblx0c291cmNlc0dpdFdyaXRlSG9va1ByZXNlbnQsXG5cdGhhc1NvdXJjZXNHaXRBcHBseUh1bmtzUGF5bG9hZCxcblx0aGFzU291cmNlc0dpdFNlc3Npb25JZCxcblx0aXNTb3VyY2VzS2VlcExlZnRvdmVyV3JpdGUsXG5cdHNvdXJjZXNHaXRFbXB0eVN0YWdlUGF0aE1lc3NhZ2UsXG5cdHNvdXJjZXNHaXRTZXNzaW9uQ2hhbmdlZE1lc3NhZ2UsXG5cdHNvdXJjZXNHaXRVbnN0YWdlVW5hdmFpbGFibGVNZXNzYWdlLFxuXHR0cnlXcml0ZVNvdXJjZXNHaXRBcHBseUh1bmtzLFxuXHR0cnlXcml0ZVNvdXJjZXNHaXRTdGFnZVBhdGhzLFxufSBmcm9tICcuLi9jb21tb24vc291cmNlc0NoYW5nZXNHaXRXcml0ZS5qcyc7XG5pbXBvcnQge1xuXHRjYW5PZmZlclNvdXJjZXNHaXRBY2NlcHRIdW5rLFxuXHR0eXBlIElTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yLFxuXHRyZW1lbWJlclNvdXJjZXNHaXRBY2NlcHRDdXJzb3IsXG5cdFNPVVJDRVNfR0lUX0FDQ0VQVF9GSUxFX0RJRkZfSU5ERVhfU1RBVEUsXG5cdFNPVVJDRVNfR0lUX0FQUExZX0NBQ0hFRF9BUkdWLFxuXHRzb3VyY2VzR2l0QWNjZXB0Q3Vyc29yRnJvbUVkaXRvcnMsXG5cdHNvdXJjZXNHaXRIdW5rUGF0Y2hBdEN1cnNvcixcbn0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNHaXRIdW5rUGF0Y2guanMnO1xuaW1wb3J0IHsgSVNvdXJjZXNDaGFuZ2VzTW9kZWwsIGlzU291cmNlc0NoYW5nZXNSZWFkRmFpbGVkLCBzb3VyY2VzQ2hhbmdlc1dyaXRlU2Vzc2lvbklkIH0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzTW9kZWwuanMnO1xuaW1wb3J0IHtcblx0SVNvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZSxcblx0SVNvdXJjZXNEaWZmV3JpdGVGYWN0cyxcblx0bWFya1NvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZWQsXG5cdHBsYW5Tb3VyY2VzRGlmZkFjY2VwdEFmdGVyQXR0ZW1wdCxcblx0cGxhblNvdXJjZXNEaWZmQWNjZXB0QXR0ZW1wdCxcblx0cGxhblNvdXJjZXNEaWZmTG9jYWxHaXRBY3Rpb24sXG5cdHBsYW5Tb3VyY2VzRGlmZlN0YWdlQWZ0ZXJBdHRlbXB0LFxuXHRwbGFuU291cmNlc0RpZmZTdGFnZUF0dGVtcHQsXG5cdHJlc29sdmVTb3VyY2VzRGlmZkVtcHR5U3RhZ2VDaHJvbWUsXG5cdHJlc29sdmVTb3VyY2VzRGlmZldyaXRlQ29udHJvbGxlckNocm9tZSxcblx0c291cmNlc0RpZmZBY2NlcHRVbmF2YWlsYWJsZU1lc3NhZ2UsXG5cdHNvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZUZvcixcbn0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNEaWZmV3JpdGVDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCB9IGZyb20gJy4vY29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0LmpzJztcbmltcG9ydCB7IGZpcmVTb3VyY2VzRGlmZkxvYWQgfSBmcm9tICcuL3NvdXJjZXNEaWZmTG9hZFNpZ25hbC5qcyc7XG5pbXBvcnQgeyBzb3VyY2VzQ2hhbmdlT3BlbkluY29tcGxldGVNZXNzYWdlIH0gZnJvbSAnLi9zb3VyY2VzQ2hhbmdlRW50cnlPcGVuLmpzJztcbmltcG9ydCB0eXBlIHsgSVNvdXJjZXNDb252ZXJzYXRpb25EaWZmTW92ZVNvdXJjZSwgU291cmNlc0RpZmZNb3ZlUmVzdWx0IH0gZnJvbSAnLi9zb3VyY2VzRGlmZlJlZkhlbHBlcnMuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb252ZXJzYXRpb25EaWZmQ29tcGFyaXNvbkxvYWRGYWlsZWRNZXNzYWdlKCk6IHN0cmluZyB7XG5cdHJldHVybiBsb2NhbGl6ZSgnY29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUubG9hZEZhaWxlZCcsIFwiVW5hYmxlIHRvIGxvYWQgdGhpcyBjb21wYXJpc29uLlwiKTtcbn1cblxuY29uc3QgcmVhZE9ubHlFZGl0b3JPcHRpb25zOiBJQ29kZUVkaXRvck9wdGlvbnMgPSB7XG5cdHJlYWRPbmx5OiB0cnVlLFxuXHRzY3JvbGxCZXlvbmRMYXN0TGluZTogZmFsc2UsXG5cdG1pbmltYXA6IHsgZW5hYmxlZDogZmFsc2UgfSxcblx0YXV0b21hdGljTGF5b3V0OiBmYWxzZSxcblx0bGluZU51bWJlcnM6ICdvbicsXG59O1xuXG5leHBvcnQgY2xhc3MgQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUgZXh0ZW5kcyBFZGl0b3JQYW5lIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSBDb252ZXJzYXRpb25EaWZmUmV2aWV3RWRpdG9ySWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaWZmV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPERpZmZFZGl0b3JXaWRnZXQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpZmZWaWV3TW9kZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SURpZmZFZGl0b3JWaWV3TW9kZWw+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvZGVXaWRnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8Q29kZUVkaXRvcldpZGdldD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgb3JpZ2luYWxNb2RlbFJlZiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGlmaWVkTW9kZWxSZWYgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SVJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBhY2NlcHRDdXJzb3JMaXN0ZW5lcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdHByaXZhdGUgY29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB0b29sYmFyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZXZlcnRCdXR0b246IEhUTUxCdXR0b25FbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHVuc3RhZ2VCdXR0b246IEhUTUxCdXR0b25FbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHVuc3RhZ2VVbmF2YWlsYWJsZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgc3RhZ2VCdXR0b246IEhUTUxCdXR0b25FbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGFjY2VwdEJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcHJldmlld0J1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbm90aWNlRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbW92ZU5vdGljZUVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIG1vdmVBdHRlbXB0R2VuZXJhdGlvbiA9IDA7XG5cdHByaXZhdGUgZWRpdG9yQ29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBkaW1lbnNpb246IGRvbS5EaW1lbnNpb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY29tcGFyaXNvbkxvYWRGYWlsZWQgPSBmYWxzZTtcblx0cHJpdmF0ZSBjb21wYXJpc29uU3RhdGU6ICdwZW5kaW5nJyB8ICdvaycgfCAnZmFpbCcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVuZGVyR2VuZXJhdGlvbiA9IDA7XG5cdC8qKiBSZXZlcnQgLyBVbnN0YWdlIC8gZW5naW5lIFN0YWdlIGhpZGUuIENsZWFyZWQgd2hlbiB0aGUgbW9kaWZpZWQgVVJJIGNoYW5nZXMuICovXG5cdHByaXZhdGUgd3JpdGVDb2xsYXBzZTogSVNvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZSB8IHVuZGVmaW5lZDtcblx0LyoqIEJ1bXBlZCBieSBzZXRJbnB1dCAvIGNsZWFySW5wdXQgLyBkaXNwb3NlIHNvIGluLWZsaWdodCBTdGFnZSAvIEFjY2VwdCBjYW5ub3Qgd3JpdGUgYmFjay4gKi9cblx0cHJpdmF0ZSBzdGFnZUF0dGVtcHRHZW5lcmF0aW9uID0gMDtcblx0LyoqIExhc3QgZGlmZiBjdXJzb3Igc2lkZSBhbmQgbGluZS4gRWRpdG9yIHRleHQgaXMgbm90IHN0b3JlZC4gKi9cblx0cHJpdmF0ZSBhY2NlcHRDdXJzb3I6IElTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGdyb3VwOiBJRWRpdG9yR3JvdXAsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElTQ01TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2NtU2VydmljZTogSVNDTVNlcnZpY2UsXG5cdFx0QElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiBwcml2YXRlIHJlYWRvbmx5IHVhQ29ubmVjdGlvbjogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uLFxuXHRcdEBJQWdlbnRTZXNzaW9uQ29udGV4dCBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb246IElBZ2VudFNlc3Npb25Db250ZXh0LFxuXHRcdEBJU291cmNlc0NoYW5nZXNNb2RlbCBwcml2YXRlIHJlYWRvbmx5IGNoYW5nZXNNb2RlbDogSVNvdXJjZXNDaGFuZ2VzTW9kZWwsXG5cdCkge1xuXHRcdHN1cGVyKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLklELCBncm91cCwgdGVsZW1ldHJ5U2VydmljZSwgdGhlbWVTZXJ2aWNlLCBzdG9yYWdlU2VydmljZSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdkaWZmRWRpdG9yLnJlbmRlclNpZGVCeVNpZGUnKSAmJiB0aGlzLmRpZmZXaWRnZXQudmFsdWUpIHtcblx0XHRcdFx0dGhpcy5kaWZmV2lkZ2V0LnZhbHVlLnVwZGF0ZU9wdGlvbnModGhpcy5nZXREaWZmRWRpdG9yT3B0aW9ucygpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51YUNvbm5lY3Rpb24ub25EaWRDaGFuZ2VDb25uZWN0aW9uKCgpID0+IHRoaXMub25Xcml0ZUZhY3RzQ2hhbmdlZCgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXNzaW9uLm9uRGlkQ2hhbmdlQWN0aXZlU2Vzc2lvbigoKSA9PiB0aGlzLm9uV3JpdGVGYWN0c0NoYW5nZWQoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2Vzc2lvbi5vbkRpZENoYW5nZVNlc3Npb24oKCkgPT4gdGhpcy5vbldyaXRlRmFjdHNDaGFuZ2VkKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYW5nZXNNb2RlbC5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLm9uV3JpdGVGYWN0c0NoYW5nZWQoKSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGNyZWF0ZUVkaXRvcihwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5jb250YWluZXIgPSBkb20uYXBwZW5kKHBhcmVudCwgJCgnLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1wYW5lJykpO1xuXHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgncm9sZScsICdkb2N1bWVudCcpO1xuXHRcdHRoaXMuY29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGxvY2FsaXplKCdjb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZS5hcmlhTGFiZWwnLCBcIkNvbnZlcnNhdGlvbiBEaWZmIFJldmlld1wiKSk7XG5cblx0XHR0aGlzLnRvb2xiYXIgPSBkb20uYXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXRvb2xiYXInKSk7XG5cblx0XHR0aGlzLnJldmVydEJ1dHRvbiA9IGRvbS5hcHBlbmQodGhpcy50b29sYmFyLCAkKCdidXR0b24uY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHR0aGlzLnJldmVydEJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG5cdFx0dGhpcy5yZXZlcnRCdXR0b24udGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnY29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUucmV2ZXJ0JywgXCJSZXZlcnRcIik7XG5cdFx0dGhpcy5yZXZlcnRCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMucmV2ZXJ0QnV0dG9uLCAnY2xpY2snLCAoKSA9PiB7XG5cdFx0XHR2b2lkIHRoaXMucnVuR2l0QWN0aW9uKFNPVVJDRVNfR0lUX0NMRUFOX0NPTU1BTkQpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy51bnN0YWdlQnV0dG9uID0gZG9tLmFwcGVuZCh0aGlzLnRvb2xiYXIsICQoJ2J1dHRvbi5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctdW5zdGFnZScpKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHR0aGlzLnVuc3RhZ2VCdXR0b24udHlwZSA9ICdidXR0b24nO1xuXHRcdHRoaXMudW5zdGFnZUJ1dHRvbi50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdjb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZS51bnN0YWdlJywgXCJVbnN0YWdlXCIpO1xuXHRcdHRoaXMudW5zdGFnZUJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy51bnN0YWdlQnV0dG9uLCAnY2xpY2snLCAoKSA9PiB7XG5cdFx0XHR2b2lkIHRoaXMucnVuR2l0QWN0aW9uKFNPVVJDRVNfR0lUX1VOU1RBR0VfQ09NTUFORCkuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZSA9IGRvbS5hcHBlbmQodGhpcy50b29sYmFyLCAkKCdzcGFuLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy11bnN0YWdlLXVuYXZhaWxhYmxlJykpO1xuXHRcdHRoaXMudW5zdGFnZVVuYXZhaWxhYmxlLnRleHRDb250ZW50ID0gc291cmNlc0dpdFVuc3RhZ2VVbmF2YWlsYWJsZU1lc3NhZ2UoKTtcblx0XHR0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG5cdFx0dGhpcy5zdGFnZUJ1dHRvbiA9IGRvbS5hcHBlbmQodGhpcy50b29sYmFyLCAkKCdidXR0b24uY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXN0YWdlJykpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24udHlwZSA9ICdidXR0b24nO1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24udGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnY29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUuc3RhZ2UnLCBcIlN0YWdlXCIpO1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuc3RhZ2VCdXR0b24sICdjbGljaycsICgpID0+IHtcblx0XHRcdHZvaWQgdGhpcy5ydW5TdGFnZSgpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5hY2NlcHRCdXR0b24gPSBkb20uYXBwZW5kKHRoaXMudG9vbGJhciwgJCgnYnV0dG9uLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1hY2NlcHQnKSkgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0dGhpcy5hY2NlcHRCdXR0b24udHlwZSA9ICdidXR0b24nO1xuXHRcdHRoaXMuYWNjZXB0QnV0dG9uLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLmFjY2VwdCcsIFwiQWNjZXB0XCIpO1xuXHRcdHRoaXMuYWNjZXB0QnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmFjY2VwdEJ1dHRvbiwgJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLnJ1bkFjY2VwdCgpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5wcmV2aWV3QnV0dG9uID0gZG9tLmFwcGVuZCh0aGlzLnRvb2xiYXIsICQoJ2J1dHRvbi5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctb3Blbi1wcmV2aWV3JykpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdHRoaXMucHJldmlld0J1dHRvbi50eXBlID0gJ2J1dHRvbic7XG5cdFx0dGhpcy5wcmV2aWV3QnV0dG9uLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLm9wZW5QcmV2aWV3JywgXCJPcGVuIERpZmYgaW4gUHJldmlld1wiKTtcblx0XHR0aGlzLnByZXZpZXdCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMucHJldmlld0J1dHRvbiwgJ2NsaWNrJywgKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLnJ1bk1vdmVUb1ByZXZpZXcoKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdH0pKTtcblx0XHR0aGlzLnRvb2xiYXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuXHRcdHRoaXMubm90aWNlRWxlbWVudCA9IGRvbS5hcHBlbmQodGhpcy5jb250YWluZXIsICQoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctbm90aWNlJykpO1xuXHRcdHRoaXMubm90aWNlRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMubW92ZU5vdGljZUVsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW5vdGljZS5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctbW92ZS1ub3RpY2UnKSk7XG5cdFx0dGhpcy5oaWRlTW92ZU5vdGljZSgpO1xuXHRcdHRoaXMuZWRpdG9yQ29udGFpbmVyID0gZG9tLmFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJCgnLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1lZGl0b3InKSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBzZXRJbnB1dChpbnB1dDogQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0LCBvcHRpb25zOiBJRWRpdG9yT3B0aW9ucyB8IHVuZGVmaW5lZCwgY29udGV4dDogSUVkaXRvck9wZW5Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnN0YWdlQXR0ZW1wdEdlbmVyYXRpb24rKztcblx0XHR0aGlzLm1vdmVBdHRlbXB0R2VuZXJhdGlvbisrO1xuXHRcdHRoaXMuaGlkZU1vdmVOb3RpY2UoKTtcblx0XHRjb25zdCBnZW5lcmF0aW9uID0gaW5wdXQubG9hZEdlbmVyYXRpb247XG5cdFx0dGhpcy5yZW5kZXJHZW5lcmF0aW9uID0gZ2VuZXJhdGlvbjtcblx0XHR0aGlzLmNvbXBhcmlzb25TdGF0ZSA9ICdwZW5kaW5nJztcblx0XHR0aGlzLndyaXRlQ29sbGFwc2UgPSBzb3VyY2VzRGlmZldyaXRlQ29sbGFwc2VGb3IodGhpcy53cml0ZUNvbGxhcHNlLCBpbnB1dC5tb2RpZmllZCk7XG5cdFx0YXdhaXQgc3VwZXIuc2V0SW5wdXQoaW5wdXQsIG9wdGlvbnMsIGNvbnRleHQsIHRva2VuKTtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCB8fCB0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCB8fCBnZW5lcmF0aW9uICE9PSB0aGlzLnJlbmRlckdlbmVyYXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmNsZWFyRWRpdG9ycygpO1xuXHRcdHRoaXMuY29tcGFyaXNvbkxvYWRGYWlsZWQgPSBmYWxzZTtcblx0XHR0aGlzLmhpZGVXcml0ZUNocm9tZSgpO1xuXHRcdHRoaXMuaGlkZU5vdGljZSgpO1xuXHRcdHRoaXMuc2V0UmV2aWV3Q2hyb21lVmlzaWJsZShmYWxzZSk7XG5cblx0XHRsZXQgbG9hZGVkID0gZmFsc2U7XG5cdFx0aWYgKCFpbnB1dC5vcmlnaW5hbCkge1xuXHRcdFx0bG9hZGVkID0gYXdhaXQgdGhpcy5yZW5kZXJNb2RpZmllZE9ubHkoaW5wdXQsIHRva2VuLCBnZW5lcmF0aW9uKTtcblx0XHRcdGlmIChsb2FkZWQgJiYgZ2VuZXJhdGlvbiA9PT0gdGhpcy5yZW5kZXJHZW5lcmF0aW9uKSB7XG5cdFx0XHRcdHRoaXMuc2hvd05vdGljZShsb2NhbGl6ZSgnY29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUubmV3RmlsZScsIFwiTmV3IGZpbGUgd2l0aCBubyBwcmV2aW91cyB2ZXJzaW9uIHRvIGNvbXBhcmUuXCIpLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGxvYWRlZCA9IGF3YWl0IHRoaXMucmVuZGVyRGlmZihpbnB1dCwgdG9rZW4sIGdlbmVyYXRpb24pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkIHx8IHRoaXMuaW5wdXQgIT09IGlucHV0IHx8IHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkIHx8IGdlbmVyYXRpb24gIT09IHRoaXMucmVuZGVyR2VuZXJhdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghbG9hZGVkKSB7XG5cdFx0XHR0aGlzLmNvbXBhcmlzb25TdGF0ZSA9ICdmYWlsJztcblx0XHRcdHRoaXMuY29tcGFyaXNvbkxvYWRGYWlsZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5oaWRlV3JpdGVDaHJvbWUoKTtcblx0XHRcdHRoaXMuc2V0UmV2aWV3Q2hyb21lVmlzaWJsZShmYWxzZSk7XG5cdFx0XHR0aGlzLnNob3dOb3RpY2UoY29udmVyc2F0aW9uRGlmZkNvbXBhcmlzb25Mb2FkRmFpbGVkTWVzc2FnZSgpKTtcblx0XHRcdHRoaXMubGF5b3V0RWRpdG9ycygpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250cm9sLmZpcmUoKTtcblx0XHRcdGZpcmVTb3VyY2VzRGlmZkxvYWQoeyByZXNvdXJjZTogaW5wdXQubW9kaWZpZWQsIGdlbmVyYXRpb24sIG9rOiBmYWxzZSB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmNvbXBhcmlzb25TdGF0ZSA9ICdvayc7XG5cdFx0dGhpcy5zZXRSZXZpZXdDaHJvbWVWaXNpYmxlKHRydWUpO1xuXHRcdHRoaXMudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHRcdHRoaXMubGF5b3V0RWRpdG9ycygpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udHJvbC5maXJlKCk7XG5cdFx0ZmlyZVNvdXJjZXNEaWZmTG9hZCh7IHJlc291cmNlOiBpbnB1dC5tb2RpZmllZCwgZ2VuZXJhdGlvbiwgb2s6IHRydWUgfSk7XG5cdH1cblxuXHRkaWRDb21wYXJpc29uTG9hZEZhaWwoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuY29tcGFyaXNvbkxvYWRGYWlsZWQ7XG5cdH1cblxuXHRnZXRDb21wYXJpc29uTG9hZFN0YXRlKCk6ICdwZW5kaW5nJyB8ICdvaycgfCAnZmFpbCcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNvbXBhcmlzb25TdGF0ZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5zdGFnZUF0dGVtcHRHZW5lcmF0aW9uKys7XG5cdFx0dGhpcy5tb3ZlQXR0ZW1wdEdlbmVyYXRpb24rKztcblx0XHR0aGlzLmhpZGVNb3ZlTm90aWNlKCk7XG5cdFx0dGhpcy5jbGVhckVkaXRvcnMoKTtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cblxuXHRvdmVycmlkZSBjbGVhcklucHV0KCk6IHZvaWQge1xuXHRcdHRoaXMuc3RhZ2VBdHRlbXB0R2VuZXJhdGlvbisrO1xuXHRcdHRoaXMubW92ZUF0dGVtcHRHZW5lcmF0aW9uKys7XG5cdFx0dGhpcy5oaWRlTW92ZU5vdGljZSgpO1xuXHRcdHRoaXMud3JpdGVDb2xsYXBzZSA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmNvbXBhcmlzb25Mb2FkRmFpbGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jb21wYXJpc29uU3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5jbGVhckVkaXRvcnMoKTtcblx0XHR0aGlzLmhpZGVOb3RpY2UoKTtcblx0XHR0aGlzLnNldFJldmlld0Nocm9tZVZpc2libGUoZmFsc2UpO1xuXHRcdGlmICh0aGlzLnJldmVydEJ1dHRvbikge1xuXHRcdFx0dGhpcy5yZXZlcnRCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR9XG5cdFx0aWYgKHRoaXMudW5zdGFnZUJ1dHRvbikge1xuXHRcdFx0dGhpcy51bnN0YWdlQnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZSkge1xuXHRcdFx0dGhpcy51bnN0YWdlVW5hdmFpbGFibGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR9XG5cdFx0aWYgKHRoaXMuc3RhZ2VCdXR0b24pIHtcblx0XHRcdHRoaXMuc3RhZ2VCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR9XG5cdFx0aWYgKHRoaXMuYWNjZXB0QnV0dG9uKSB7XG5cdFx0XHR0aGlzLmFjY2VwdEJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblx0XHRzdXBlci5jbGVhcklucHV0KCk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRDb250cm9sKCk6IERpZmZFZGl0b3JXaWRnZXQgfCBDb2RlRWRpdG9yV2lkZ2V0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5kaWZmV2lkZ2V0LnZhbHVlID8/IHRoaXMuY29kZVdpZGdldC52YWx1ZTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0KHRoaXMuZGlmZldpZGdldC52YWx1ZT8uZ2V0TW9kaWZpZWRFZGl0b3IoKSA/PyB0aGlzLmNvZGVXaWRnZXQudmFsdWUpPy5mb2N1cygpO1xuXHR9XG5cblx0b3ZlcnJpZGUgbGF5b3V0KGRpbWVuc2lvbjogeyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9KTogdm9pZCB7XG5cdFx0dGhpcy5kaW1lbnNpb24gPSBuZXcgZG9tLkRpbWVuc2lvbihkaW1lbnNpb24ud2lkdGgsIGRpbWVuc2lvbi5oZWlnaHQpO1xuXHRcdGlmICh0aGlzLmNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5jb250YWluZXIuc3R5bGUud2lkdGggPSBgJHtkaW1lbnNpb24ud2lkdGh9cHhgO1xuXHRcdFx0dGhpcy5jb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7ZGltZW5zaW9uLmhlaWdodH1weGA7XG5cdFx0fVxuXHRcdHRoaXMubGF5b3V0RWRpdG9ycygpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREaWZmRWRpdG9yT3B0aW9ucygpOiBJRGlmZkVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMge1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5yZWFkT25seUVkaXRvck9wdGlvbnMsXG5cdFx0XHRvcmlnaW5hbEVkaXRhYmxlOiBmYWxzZSxcblx0XHRcdHJlbmRlclNpZGVCeVNpZGU6IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2RpZmZFZGl0b3IucmVuZGVyU2lkZUJ5U2lkZScpID8/IHRydWUsXG5cdFx0XHR1c2VJbmxpbmVWaWV3V2hlblNwYWNlSXNMaW1pdGVkOiB0cnVlLFxuXHRcdFx0cmVuZGVyT3ZlcnZpZXdSdWxlcjogZmFsc2UsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgb25Xcml0ZUZhY3RzQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0XHR0aGlzLmxheW91dEVkaXRvcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0R2l0U2Vzc2lvbklkKCk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgc25hcHNob3QgPSB0aGlzLmNoYW5nZXNNb2RlbC5nZXRTbmFwc2hvdCgpO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gdGhpcy5pbnB1dCBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCA/IHRoaXMuaW5wdXQubW9kaWZpZWQgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgbWF0Y2hlcyA9IG1vZGlmaWVkXG5cdFx0XHQ/IHNuYXBzaG90LmVudHJpZXMuZmlsdGVyKGVudHJ5ID0+IGVudHJ5LnJlc291cmNlLnRvU3RyaW5nKCkgPT09IG1vZGlmaWVkLnRvU3RyaW5nKCkpXG5cdFx0XHQ6IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4gc291cmNlc0NoYW5nZXNXcml0ZVNlc3Npb25JZChzbmFwc2hvdCwgbWF0Y2hlcywgdGhpcy5zZXNzaW9uLmdldEFjdGl2ZVNlc3Npb25JZCgpKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RW5naW5lU2Vzc2lvblJlYWR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBnZXRDb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzKGNvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3NQcm9iZSh0aGlzLnNlc3Npb24pKSA9PT0gJ3JlYWR5Jztcblx0fVxuXG5cdHByaXZhdGUgaXNSZWFkRmFpbGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBpc1NvdXJjZXNDaGFuZ2VzUmVhZEZhaWxlZCh0aGlzLmNoYW5nZXNNb2RlbC5nZXRTbmFwc2hvdCgpLnN0YXRlKTtcblx0fVxuXG5cdHByaXZhdGUgaXNTb3VyY2VzS2VlcExlZnRvdmVyV3JpdGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlzU291cmNlc0tlZXBMZWZ0b3ZlcldyaXRlKFxuXHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdCEhdGhpcy51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90Py4oKS5wYWlyaW5nUGVuZGluZyxcblx0XHRcdHRoaXMuZ2V0RW5naW5lU2Vzc2lvblJlYWR5KCksXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgaXNTb3VyY2VzRGlmZldyaXRlSG9sZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5jaGFuZ2VzTW9kZWwuaXNXcml0ZUNsb3NlZCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRSZXZpZXdDaHJvbWVWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy50b29sYmFyKSB7XG5cdFx0XHR0aGlzLnRvb2xiYXIuc3R5bGUuZGlzcGxheSA9IHZpc2libGUgPyAnJyA6ICdub25lJztcblx0XHR9XG5cdFx0aWYgKHRoaXMucHJldmlld0J1dHRvbikge1xuXHRcdFx0dGhpcy5wcmV2aWV3QnV0dG9uLnN0eWxlLmRpc3BsYXkgPSB2aXNpYmxlID8gJycgOiAnbm9uZSc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoaWRlV3JpdGVDaHJvbWUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMucmV2ZXJ0QnV0dG9uKSB7XG5cdFx0XHR0aGlzLnJldmVydEJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblx0XHRpZiAodGhpcy51bnN0YWdlQnV0dG9uKSB7XG5cdFx0XHR0aGlzLnVuc3RhZ2VCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR9XG5cdFx0aWYgKHRoaXMudW5zdGFnZVVuYXZhaWxhYmxlKSB7XG5cdFx0XHR0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblx0XHRpZiAodGhpcy5zdGFnZUJ1dHRvbikge1xuXHRcdFx0dGhpcy5zdGFnZUJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblx0XHRpZiAodGhpcy5hY2NlcHRCdXR0b24pIHtcblx0XHRcdHRoaXMuYWNjZXB0QnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVSZXZpZXdBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5yZXZlcnRCdXR0b24gfHwgIXRoaXMuc3RhZ2VCdXR0b24gfHwgIXRoaXMuYWNjZXB0QnV0dG9uIHx8ICF0aGlzLnVuc3RhZ2VCdXR0b24gfHwgIXRoaXMudW5zdGFnZVVuYXZhaWxhYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLmNvbXBhcmlzb25Mb2FkRmFpbGVkKSB7XG5cdFx0XHR0aGlzLmhpZGVXcml0ZUNocm9tZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBmYWN0cyA9IHRoaXMuY3VycmVudFdyaXRlRmFjdHMoKTtcblx0XHRpZiAoIWZhY3RzKSB7XG5cdFx0XHR0aGlzLmhpZGVXcml0ZUNocm9tZSgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjaHJvbWUgPSByZXNvbHZlU291cmNlc0RpZmZXcml0ZUNvbnRyb2xsZXJDaHJvbWUoZmFjdHMpO1xuXHRcdHRoaXMucmV2ZXJ0QnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBjaHJvbWUuc2hvd1JldmVydCA/ICcnIDogJ25vbmUnO1xuXHRcdHRoaXMudW5zdGFnZUJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gY2hyb21lLnNob3dVbnN0YWdlID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy51bnN0YWdlVW5hdmFpbGFibGUuc3R5bGUuZGlzcGxheSA9IGNocm9tZS51bnN0YWdlVW5hdmFpbGFibGUgPyAnJyA6ICdub25lJztcblx0XHR0aGlzLnN0YWdlQnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBjaHJvbWUuc2hvd1N0YWdlID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy5hY2NlcHRCdXR0b24uc3R5bGUuZGlzcGxheSA9IGNocm9tZS5zaG93QWNjZXB0ID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy5hcHBseUVtcHR5U3RhZ2VQYXRoQ2hyb21lKGZhY3RzKTtcblx0fVxuXG5cdC8qKiBFbXB0eSBlbmdpbmUgaWRlbnRpdHk6IGRpc2FibGUgU3RhZ2UgYW5kIHNob3cgc3RhdHVzLiBUaGUgY2xpY2sgcGF0aCBzdGlsbCBtdXN0IG5vdCBzZW5kLiAqL1xuXHRwcml2YXRlIGFwcGx5RW1wdHlTdGFnZVBhdGhDaHJvbWUoZmFjdHM6IElTb3VyY2VzRGlmZldyaXRlRmFjdHMpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuc3RhZ2VCdXR0b24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZW1wdHlTdGFnZSA9IHJlc29sdmVTb3VyY2VzRGlmZkVtcHR5U3RhZ2VDaHJvbWUoZmFjdHMpO1xuXHRcdGNvbnN0IHN0YWdlTGFiZWwgPSBsb2NhbGl6ZSgnY29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUuc3RhZ2UnLCBcIlN0YWdlXCIpO1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24uZGlzYWJsZWQgPSBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZTtcblx0XHR0aGlzLnN0YWdlQnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsIGVtcHR5U3RhZ2UuZGlzYWJsZVN0YWdlID8gJ3RydWUnIDogJ2ZhbHNlJyk7XG5cdFx0Y29uc3QgZW1wdHlNZXNzYWdlID0gc291cmNlc0dpdEVtcHR5U3RhZ2VQYXRoTWVzc2FnZSgpO1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24udGl0bGUgPSBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZSA/IGVtcHR5TWVzc2FnZSA6IHN0YWdlTGFiZWw7XG5cdFx0dGhpcy5zdGFnZUJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZSA/IGAke3N0YWdlTGFiZWx9LiAke2VtcHR5TWVzc2FnZX1gIDogc3RhZ2VMYWJlbCk7XG5cdFx0aWYgKGVtcHR5U3RhZ2Uuc3RhdHVzKSB7XG5cdFx0XHR0aGlzLnNob3dOb3RpY2UoZW1wdHlTdGFnZS5zdGF0dXMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5ub3RpY2VFbGVtZW50Py50ZXh0Q29udGVudCA9PT0gZW1wdHlNZXNzYWdlKSB7XG5cdFx0XHR0aGlzLmhpZGVOb3RpY2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGN1cnJlbnRXcml0ZUZhY3RzKCk6IElTb3VyY2VzRGlmZldyaXRlRmFjdHMgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGlucHV0ID0gdGhpcy5pbnB1dDtcblx0XHRpZiAoIShpbnB1dCBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGdhdGUgPSByZXNvbHZlU291cmNlc0RpZmZXcml0ZUdhdGUodGhpcy5zY21TZXJ2aWNlLCB7XG5cdFx0XHRtb2RpZmllZDogaW5wdXQubW9kaWZpZWQsXG5cdFx0XHRncm91cElkOiBpbnB1dC5ncm91cElkLFxuXHRcdFx0b3JpZ2luOiBpbnB1dC5vcmlnaW4sXG5cdFx0XHRnaXRQYXRoOiBpbnB1dC5naXRQYXRoLFxuXHRcdH0pO1xuXHRcdGNvbnN0IGZhbGxiYWNrU2Vzc2lvbklkID0gdGhpcy5nZXRHaXRTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBwYWlyaW5nSG9sZCA9IHRoaXMuc2Vzc2lvbi5pc1BhaXJpbmdIb2xkKCk7XG5cdFx0Y29uc3QgcmVhZEZhaWxlZCA9IHRoaXMuaXNSZWFkRmFpbGVkKCk7XG5cdFx0Y29uc3QgZW5naW5lU2Vzc2lvblJlYWR5ID0gdGhpcy5nZXRFbmdpbmVTZXNzaW9uUmVhZHkoKTtcblx0XHRjb25zdCBwaW5uZWRTZXNzaW9uSWQgPSBpbnB1dC5zZXNzaW9uSWQgPz8gJyc7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkZW50aXR5OiB7XG5cdFx0XHRcdG9yaWdpbjogaW5wdXQub3JpZ2luLFxuXHRcdFx0XHRzZXNzaW9uSWQ6IGlucHV0LnNlc3Npb25JZCxcblx0XHRcdFx0bW9kaWZpZWQ6IGlucHV0Lm1vZGlmaWVkLFxuXHRcdFx0fSxcblx0XHRcdGNoYW5nZXNTbmFwc2hvdEtpbmQ6IHRoaXMuY2hhbmdlc01vZGVsLmdldFNuYXBzaG90KCkuc3RhdGUua2luZCxcblx0XHRcdHdyaXRlQ2xvc2VkOiB0aGlzLmlzU291cmNlc0RpZmZXcml0ZUhvbGQoKSxcblx0XHRcdGFjdGl2ZVNlc3Npb25JZDogdGhpcy5zZXNzaW9uLmdldEFjdGl2ZVNlc3Npb25JZCgpLFxuXHRcdFx0ZmFsbGJhY2tTZXNzaW9uSWQsXG5cdFx0XHRncm91cElkOiBnYXRlLmdyb3VwSWQsXG5cdFx0XHRwYXRoOiBnYXRlLnBhdGgsXG5cdFx0XHRzY21SZXNvdXJjZTogZ2F0ZS5zY21SZXNvdXJjZSxcblx0XHRcdGNhbldyaXRlU3RhZ2U6IGNhblNlbmRTb3VyY2VzR2l0U3RhZ2VQYXRocyhcblx0XHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdFx0c291cmNlc0dpdFdyaXRlSG9va1ByZXNlbnQodGhpcy51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90Py4oKSwgJ3dyaXRlR2l0U3RhZ2VQYXRocycsIHRoaXMudWFDb25uZWN0aW9uLndyaXRlR2l0U3RhZ2VQYXRocyksXG5cdFx0XHRcdGZhbGxiYWNrU2Vzc2lvbklkLFxuXHRcdFx0XHRwYWlyaW5nSG9sZCxcblx0XHRcdFx0cmVhZEZhaWxlZCxcblx0XHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5LFxuXHRcdFx0KSxcblx0XHRcdGNhbldyaXRlQWNjZXB0OiBjYW5TZW5kU291cmNlc0dpdEFwcGx5SHVua3MoXG5cdFx0XHRcdHRoaXMudWFDb25uZWN0aW9uLmlzRW5naW5lQ29ubmVjdGVkKCksXG5cdFx0XHRcdHNvdXJjZXNHaXRXcml0ZUhvb2tQcmVzZW50KHRoaXMudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdD8uKCksICd3cml0ZUdpdEFwcGx5SHVua3MnLCB0aGlzLnVhQ29ubmVjdGlvbi53cml0ZUdpdEFwcGx5SHVua3MpLFxuXHRcdFx0XHRwYWlyaW5nSG9sZCxcblx0XHRcdFx0cmVhZEZhaWxlZCxcblx0XHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5LFxuXHRcdFx0KSxcblx0XHRcdGhhc0FwcGx5SHVua3NQYXlsb2FkOiBjYW5PZmZlclNvdXJjZXNHaXRBY2NlcHRIdW5rKGlucHV0LmtpbmQsIGlucHV0LmluZGV4U3RhdGUpICYmIGdhdGUucGF0aCAhPT0gJycgJiYgaGFzU291cmNlc0dpdFNlc3Npb25JZChwaW5uZWRTZXNzaW9uSWQpLFxuXHRcdFx0aGFzR2l0U3RhZ2VDb21tYW5kOiAhIUNvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZChTT1VSQ0VTX0dJVF9TVEFHRV9DT01NQU5EKSxcblx0XHRcdGhhc0dpdFVuc3RhZ2VDb21tYW5kOiAhIUNvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZChTT1VSQ0VTX0dJVF9VTlNUQUdFX0NPTU1BTkQpLFxuXHRcdFx0aGFzR2l0Q2xlYW5Db21tYW5kOiAhIUNvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZChTT1VSQ0VTX0dJVF9DTEVBTl9DT01NQU5EKSxcblx0XHRcdHBhaXJpbmdIb2xkLFxuXHRcdFx0a2VlcExlZnRvdmVyOiB0aGlzLmlzU291cmNlc0tlZXBMZWZ0b3ZlcldyaXRlKCksXG5cdFx0XHRwYXRjaGVzOiBbXSxcblx0XHRcdGNvbGxhcHNlOiB0aGlzLndyaXRlQ29sbGFwc2UsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuU3RhZ2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5wdXQgPSB0aGlzLmlucHV0O1xuXHRcdGNvbnN0IHBsYW4gPSBwbGFuU291cmNlc0RpZmZTdGFnZUF0dGVtcHQodGhpcy5jdXJyZW50V3JpdGVGYWN0cygpKTtcblx0XHRpZiAocGxhbi5raW5kID09PSAnYmxvY2tlZCcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHBsYW4ua2luZCA9PT0gJ25vdGljZScpIHtcblx0XHRcdHRoaXMuc2hvd05vdGljZShwbGFuLm1lc3NhZ2UpO1xuXHRcdFx0dGhpcy51cGRhdGVSZXZpZXdBY3Rpb25zKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhZ2VBdHRlbXB0R2VuZXJhdGlvbiA9IHRoaXMuc3RhZ2VBdHRlbXB0R2VuZXJhdGlvbjtcblx0XHRjb25zdCBob29rID0gdGhpcy51YUNvbm5lY3Rpb24ud3JpdGVHaXRTdGFnZVBhdGhzO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhdHRlbXB0ID0gcGxhbi5raW5kID09PSAnc2tpcC1lbmdpbmUnXG5cdFx0XHRcdD8geyBraW5kOiAnZmFsbGJhY2snIGFzIGNvbnN0IH1cblx0XHRcdFx0OiBhd2FpdCBhdHRlbXB0U291cmNlc0dpdFdyaXRlKCgpID0+IHRyeVdyaXRlU291cmNlc0dpdFN0YWdlUGF0aHMoXG5cdFx0XHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdFx0XHRob29rID8gcmVxdWVzdCA9PiBob29rLmNhbGwodGhpcy51YUNvbm5lY3Rpb24sIHJlcXVlc3QpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHBsYW4uc2Vzc2lvbklkLFxuXHRcdFx0XHRcdFtwbGFuLnBhdGhdLFxuXHRcdFx0XHRcdHRoaXMuc2Vzc2lvbi5pc1BhaXJpbmdIb2xkKCksXG5cdFx0XHRcdFx0dGhpcy5pc1JlYWRGYWlsZWQoKSxcblx0XHRcdFx0XHR0aGlzLmdldEVuZ2luZVNlc3Npb25SZWFkeSgpLFxuXHRcdFx0XHQpKTtcblx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkIHx8IHRoaXMuaW5wdXQgIT09IGlucHV0IHx8IHN0YWdlQXR0ZW1wdEdlbmVyYXRpb24gIT09IHRoaXMuc3RhZ2VBdHRlbXB0R2VuZXJhdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmYWN0cyA9IHRoaXMuY3VycmVudFdyaXRlRmFjdHMoKTtcblx0XHRcdGlmICghZmFjdHMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWZ0ZXIgPSBwbGFuU291cmNlc0RpZmZTdGFnZUFmdGVyQXR0ZW1wdChhdHRlbXB0LCBmYWN0cyk7XG5cdFx0XHRpZiAoYWZ0ZXIua2luZCA9PT0gJ2NvbGxhcHNlLXN0YWdlJykge1xuXHRcdFx0XHR0aGlzLndyaXRlQ29sbGFwc2UgPSBtYXJrU291cmNlc0RpZmZXcml0ZUNvbGxhcHNlZChmYWN0cy5pZGVudGl0eS5tb2RpZmllZCwgJ3N0YWdlJyk7XG5cdFx0XHRcdHRoaXMuaGlkZU5vdGljZSgpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGFmdGVyLmtpbmQgPT09ICdjbGVhci1ub3RpY2UnKSB7XG5cdFx0XHRcdHRoaXMuaGlkZU5vdGljZSgpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGFmdGVyLmtpbmQgPT09ICdub3RpY2UnKSB7XG5cdFx0XHRcdHRoaXMuc2hvd05vdGljZShhZnRlci5tZXNzYWdlKTtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXZpZXdBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChhZnRlci5raW5kID09PSAnbG9jYWwnKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucnVuR2l0QWN0aW9uKFNPVVJDRVNfR0lUX1NUQUdFX0NPTU1BTkQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgfHwgdGhpcy5pbnB1dCAhPT0gaW5wdXQgfHwgc3RhZ2VBdHRlbXB0R2VuZXJhdGlvbiAhPT0gdGhpcy5zdGFnZUF0dGVtcHRHZW5lcmF0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuc2hvd05vdGljZShnZXRFcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdHRoaXMudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYmluZEFjY2VwdEN1cnNvcih3aWRnZXQ6IERpZmZFZGl0b3JXaWRnZXQpOiB2b2lkIHtcblx0XHRjb25zdCBsaXN0ZW4gPSAoc2lkZTogSVNvdXJjZXNHaXRBY2NlcHRDdXJzb3JbJ3NpZGUnXSwgZWRpdG9yOiBSZXR1cm5UeXBlPERpZmZFZGl0b3JXaWRnZXRbJ2dldE1vZGlmaWVkRWRpdG9yJ10+KSA9PiB7XG5cdFx0XHRjb25zdCByZW1lbWJlciA9ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgbGluZSA9IGVkaXRvci5nZXRQb3NpdGlvbigpPy5saW5lTnVtYmVyO1xuXHRcdFx0XHRpZiAobGluZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuYWNjZXB0Q3Vyc29yID0gcmVtZW1iZXJTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yKHRoaXMuYWNjZXB0Q3Vyc29yLCB7XG5cdFx0XHRcdFx0c2lkZSxcblx0XHRcdFx0XHRsaW5lLFxuXHRcdFx0XHRcdGVkaXRvckhhc0ZvY3VzOiBlZGl0b3IuaGFzVGV4dEZvY3VzKCksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fTtcblx0XHRcdHRoaXMuYWNjZXB0Q3Vyc29yTGlzdGVuZXJzLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbihyZW1lbWJlcikpO1xuXHRcdFx0dGhpcy5hY2NlcHRDdXJzb3JMaXN0ZW5lcnMuYWRkKGVkaXRvci5vbkRpZEZvY3VzRWRpdG9yVGV4dChyZW1lbWJlcikpO1xuXHRcdH07XG5cdFx0bGlzdGVuKCduZXcnLCB3aWRnZXQuZ2V0TW9kaWZpZWRFZGl0b3IoKSk7XG5cdFx0bGlzdGVuKCdvbGQnLCB3aWRnZXQuZ2V0T3JpZ2luYWxFZGl0b3IoKSk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRBY2NlcHRDdXJzb3IoKTogSVNvdXJjZXNHaXRBY2NlcHRDdXJzb3IgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuZGlmZldpZGdldC52YWx1ZTtcblx0XHRjb25zdCBtb2RpZmllZCA9IHdpZGdldD8uZ2V0TW9kaWZpZWRFZGl0b3IoKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHdpZGdldD8uZ2V0T3JpZ2luYWxFZGl0b3IoKTtcblx0XHRyZXR1cm4gc291cmNlc0dpdEFjY2VwdEN1cnNvckZyb21FZGl0b3JzKHtcblx0XHRcdGZvY3VzZWQ6IG1vZGlmaWVkPy5oYXNUZXh0Rm9jdXMoKSA/ICduZXcnIDogb3JpZ2luYWw/Lmhhc1RleHRGb2N1cygpID8gJ29sZCcgOiB1bmRlZmluZWQsXG5cdFx0XHRyZW1lbWJlcmVkOiB0aGlzLmFjY2VwdEN1cnNvcixcblx0XHRcdG1vZGlmaWVkTGluZTogbW9kaWZpZWQ/LmdldFBvc2l0aW9uKCk/LmxpbmVOdW1iZXIsXG5cdFx0XHRvcmlnaW5hbExpbmU6IG9yaWdpbmFsPy5nZXRQb3NpdGlvbigpPy5saW5lTnVtYmVyLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5BY2NlcHQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5wdXQgPSB0aGlzLmlucHV0O1xuXHRcdGNvbnN0IHBsYW4gPSBwbGFuU291cmNlc0RpZmZBY2NlcHRBdHRlbXB0KHRoaXMuY3VycmVudFdyaXRlRmFjdHMoKSk7XG5cdFx0aWYgKHBsYW4ua2luZCA9PT0gJ2Jsb2NrZWQnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChwbGFuLmtpbmQgPT09ICdub3RpY2UnKSB7XG5cdFx0XHR0aGlzLnNob3dOb3RpY2UocGxhbi5tZXNzYWdlKTtcblx0XHRcdHRoaXMudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YWdlQXR0ZW1wdEdlbmVyYXRpb24gPSB0aGlzLnN0YWdlQXR0ZW1wdEdlbmVyYXRpb247XG5cdFx0Y29uc3QgaXNDdXJyZW50ID0gKCkgPT4gIXRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgJiYgaW5wdXQgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXRcblx0XHRcdCYmICFpbnB1dC5pc0Rpc3Bvc2VkKCkgJiYgdGhpcy5pbnB1dCA9PT0gaW5wdXQgJiYgc3RhZ2VBdHRlbXB0R2VuZXJhdGlvbiA9PT0gdGhpcy5zdGFnZUF0dGVtcHRHZW5lcmF0aW9uO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IGlucHV0IGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0ID8gKGlucHV0LnNlc3Npb25JZCA/PyAnJykgOiAnJztcblx0XHRjb25zdCBwYXRoID0gdGhpcy5jdXJyZW50V3JpdGVGYWN0cygpPy5wYXRoID8/ICcnO1xuXHRcdGNvbnN0IGN1cnNvciA9IHRoaXMucmVhZEFjY2VwdEN1cnNvcigpO1xuXHRcdGNvbnN0IGtpbmQgPSBpbnB1dCBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCA/IGlucHV0LmtpbmQgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgaW5kZXhTdGF0ZSA9IGlucHV0IGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0ID8gaW5wdXQuaW5kZXhTdGF0ZSA6IHVuZGVmaW5lZDtcblx0XHRpZiAoIWlzQ3VycmVudCgpIHx8ICFjYW5PZmZlclNvdXJjZXNHaXRBY2NlcHRIdW5rKGtpbmQsIGluZGV4U3RhdGUpIHx8IHBhdGggPT09ICcnIHx8IHNlc3Npb25JZCA9PT0gJycgfHwgIWN1cnNvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlYWRHaXRGaWxlRGlmZiA9IHRoaXMudWFDb25uZWN0aW9uLnJlYWRHaXRGaWxlRGlmZjtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVhZCA9IGF3YWl0IHRyeVJlYWRTb3VyY2VzR2l0RmlsZURpZmYoXG5cdFx0XHRcdHRoaXMudWFDb25uZWN0aW9uLmlzRW5naW5lQ29ubmVjdGVkKCksXG5cdFx0XHRcdHJlYWRHaXRGaWxlRGlmZiA/IHJlcXVlc3QgPT4gcmVhZEdpdEZpbGVEaWZmLmNhbGwodGhpcy51YUNvbm5lY3Rpb24sIHJlcXVlc3QpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRzZXNzaW9uSWQsXG5cdFx0XHRcdHBhdGgsXG5cdFx0XHRcdFNPVVJDRVNfR0lUX0FDQ0VQVF9GSUxFX0RJRkZfSU5ERVhfU1RBVEUsXG5cdFx0XHRcdHRoaXMuc2Vzc2lvbi5pc1BhaXJpbmdIb2xkKCksXG5cdFx0XHRcdHRoaXMuaXNSZWFkRmFpbGVkKCksXG5cdFx0XHQpO1xuXHRcdFx0aWYgKCFpc0N1cnJlbnQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQvLyBSZS1hdXRob3JpemUgdGhlIGNhcHR1cmVkIHJlYWQgdGFyZ2V0OyBuZXZlciByZWRpcmVjdCBpdHMgcGF0Y2ggdG8gYSBuZXcgc2Vzc2lvbi5cblx0XHRcdGNvbnN0IGJlZm9yZVdyaXRlRmFjdHMgPSB0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCk7XG5cdFx0XHRjb25zdCB3cml0ZVBsYW4gPSBwbGFuU291cmNlc0RpZmZBY2NlcHRBdHRlbXB0KGJlZm9yZVdyaXRlRmFjdHMpO1xuXHRcdFx0aWYgKHdyaXRlUGxhbi5raW5kICE9PSAnZW5naW5lJykge1xuXHRcdFx0XHRpZiAod3JpdGVQbGFuLmtpbmQgPT09ICdub3RpY2UnKSB7XG5cdFx0XHRcdFx0dGhpcy5zaG93Tm90aWNlKHdyaXRlUGxhbi5tZXNzYWdlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHdyaXRlUGxhbi5zZXNzaW9uSWQgIT09IHNlc3Npb25JZCkge1xuXHRcdFx0XHR0aGlzLnNob3dOb3RpY2Uoc291cmNlc0dpdFNlc3Npb25DaGFuZ2VkTWVzc2FnZSgpKTtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXZpZXdBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghYmVmb3JlV3JpdGVGYWN0cz8uY2FuV3JpdGVBY2NlcHQpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXZpZXdBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHBhdGNoID0gcmVhZD8uc3VwcG9ydGVkID8gc291cmNlc0dpdEh1bmtQYXRjaEF0Q3Vyc29yKHJlYWQudW5pZmllZERpZmYsIGN1cnNvci5saW5lLCBjdXJzb3Iuc2lkZSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoIXBhdGNoIHx8ICFoYXNTb3VyY2VzR2l0QXBwbHlIdW5rc1BheWxvYWQoc2Vzc2lvbklkLCBbcGF0Y2hdKSkge1xuXHRcdFx0XHR0aGlzLnNob3dOb3RpY2Uoc291cmNlc0RpZmZBY2NlcHRVbmF2YWlsYWJsZU1lc3NhZ2UoKSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBob29rID0gdGhpcy51YUNvbm5lY3Rpb24ud3JpdGVHaXRBcHBseUh1bmtzO1xuXHRcdFx0Y29uc3QgYXR0ZW1wdCA9IGF3YWl0IGF0dGVtcHRTb3VyY2VzR2l0V3JpdGUoKCkgPT4gdHJ5V3JpdGVTb3VyY2VzR2l0QXBwbHlIdW5rcyhcblx0XHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdFx0aG9vayA/IHJlcXVlc3QgPT4gaG9vay5jYWxsKHRoaXMudWFDb25uZWN0aW9uLCByZXF1ZXN0KSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0c2Vzc2lvbklkLFxuXHRcdFx0XHRTT1VSQ0VTX0dJVF9BUFBMWV9DQUNIRURfQVJHVixcblx0XHRcdFx0W3BhdGNoXSxcblx0XHRcdFx0dGhpcy5zZXNzaW9uLmlzUGFpcmluZ0hvbGQoKSxcblx0XHRcdFx0dGhpcy5pc1JlYWRGYWlsZWQoKSxcblx0XHRcdFx0dGhpcy5nZXRFbmdpbmVTZXNzaW9uUmVhZHkoKSxcblx0XHRcdCkpO1xuXHRcdFx0aWYgKCFpc0N1cnJlbnQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmYWN0cyA9IHRoaXMuY3VycmVudFdyaXRlRmFjdHMoKTtcblx0XHRcdGlmICghZmFjdHMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWZ0ZXIgPSBwbGFuU291cmNlc0RpZmZBY2NlcHRBZnRlckF0dGVtcHQoYXR0ZW1wdCwgZmFjdHMpO1xuXHRcdFx0aWYgKGFmdGVyLmtpbmQgPT09ICdjbGVhci1ub3RpY2UnKSB7XG5cdFx0XHRcdHRoaXMuaGlkZU5vdGljZSgpO1xuXHRcdFx0XHR0aGlzLmNoYW5nZXNNb2RlbC5zY2hlZHVsZVJlZnJlc2goKTtcblx0XHRcdFx0dGhpcy51cGRhdGVSZXZpZXdBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChhZnRlci5raW5kID09PSAnbm90aWNlJykge1xuXHRcdFx0XHR0aGlzLnNob3dOb3RpY2UoYWZ0ZXIubWVzc2FnZSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKCFpc0N1cnJlbnQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnNob3dOb3RpY2UoZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0XHR0aGlzLnVwZGF0ZVJldmlld0FjdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJ1bkdpdEFjdGlvbihjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZhY3RzID0gdGhpcy5jdXJyZW50V3JpdGVGYWN0cygpO1xuXHRcdGNvbnN0IHBsYW4gPSBwbGFuU291cmNlc0RpZmZMb2NhbEdpdEFjdGlvbihjb21tYW5kSWQsIGZhY3RzKTtcblx0XHRpZiAocGxhbi5raW5kICE9PSAnbG9jYWwnIHx8ICFmYWN0cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHBsYW4uY29tbWFuZElkLCBwbGFuLnNjbVJlc291cmNlKTtcblx0XHRcdHRoaXMuaGlkZU5vdGljZSgpO1xuXHRcdFx0aWYgKHBsYW4uY29sbGFwc2UpIHtcblx0XHRcdFx0dGhpcy53cml0ZUNvbGxhcHNlID0gbWFya1NvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZWQoZmFjdHMuaWRlbnRpdHkubW9kaWZpZWQsIHBsYW4uY29sbGFwc2UpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLnNob3dOb3RpY2UoZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBLZWVwIGJ1dHRvbiBmZWVkYmFjayBvbiB0aGUgb3JpZ2luYWwgUGFuZS9pbnB1dCBhbmQgb24gdGhpcyBtb3ZlIGF0dGVtcHQuICovXG5cdHByaXZhdGUgYXN5bmMgcnVuTW92ZVRvUHJldmlldygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbnB1dCA9IHRoaXMuaW5wdXQ7XG5cdFx0aWYgKCEoaW5wdXQgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGdlbmVyYXRpb24gPSB0aGlzLnJlbmRlckdlbmVyYXRpb247XG5cdFx0Y29uc3QgYXR0ZW1wdCA9ICsrdGhpcy5tb3ZlQXR0ZW1wdEdlbmVyYXRpb247XG5cdFx0Y29uc3Qgc291cmNlOiBJU291cmNlc0NvbnZlcnNhdGlvbkRpZmZNb3ZlU291cmNlID0geyBraW5kOiAnY29udmVyc2F0aW9uUGFuZScsIGVkaXRvcjogaW5wdXQsIGdyb3VwOiB0aGlzLmdyb3VwLCBwYW5lOiB0aGlzIH07XG5cdFx0Y29uc3QgaXNDdXJyZW50ID0gKCkgPT4gIXRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgJiYgdGhpcy5pbnB1dCA9PT0gaW5wdXQgJiYgIWlucHV0LmlzRGlzcG9zZWQoKVxuXHRcdFx0JiYgdGhpcy5yZW5kZXJHZW5lcmF0aW9uID09PSBnZW5lcmF0aW9uICYmIHRoaXMubW92ZUF0dGVtcHRHZW5lcmF0aW9uID09PSBhdHRlbXB0O1xuXHRcdGxldCByZXN1bHQ6IFNvdXJjZXNEaWZmTW92ZVJlc3VsdDtcblx0XHR0cnkge1xuXHRcdFx0cmVzdWx0ID0gYXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZDxTb3VyY2VzRGlmZk1vdmVSZXN1bHQ+KCdzb3VyY2VzLmRpZmYubW92ZVRvUHJldmlldycsIHNvdXJjZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmIChpc0N1cnJlbnQoKSkge1xuXHRcdFx0XHR0aGlzLnNob3dNb3ZlTm90aWNlKHNvdXJjZXNHaXREaWZmT3BlbkZhaWx1cmVNZXNzYWdlKGVycm9yKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghaXNDdXJyZW50KCkgfHwgcmVzdWx0ID09PSAnc3RhbGUnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChyZXN1bHQgPT09IHRydWUpIHtcblx0XHRcdHRoaXMuaGlkZU1vdmVOb3RpY2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zaG93TW92ZU5vdGljZShzb3VyY2VzQ2hhbmdlT3BlbkluY29tcGxldGVNZXNzYWdlKCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvd01vdmVOb3RpY2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubW92ZU5vdGljZUVsZW1lbnQpIHtcblx0XHRcdHRoaXMubW92ZU5vdGljZUVsZW1lbnQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdFx0dGhpcy5tb3ZlTm90aWNlRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpcy1lcnJvcicpO1xuXHRcdFx0dGhpcy5tb3ZlTm90aWNlRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoaWRlTW92ZU5vdGljZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5tb3ZlTm90aWNlRWxlbWVudCkge1xuXHRcdFx0dGhpcy5tb3ZlTm90aWNlRWxlbWVudC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0dGhpcy5tb3ZlTm90aWNlRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvd05vdGljZShtZXNzYWdlOiBzdHJpbmcsIGlzRXJyb3IgPSB0cnVlKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm5vdGljZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5ub3RpY2VFbGVtZW50LnRleHRDb250ZW50ID0gbWVzc2FnZTtcblx0XHR0aGlzLm5vdGljZUVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnaXMtZXJyb3InLCBpc0Vycm9yKTtcblx0XHR0aGlzLm5vdGljZUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICcnO1xuXHR9XG5cblx0cHJpdmF0ZSBoaWRlTm90aWNlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5ub3RpY2VFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMubm90aWNlRWxlbWVudC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdHRoaXMubm90aWNlRWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdpcy1lcnJvcicpO1xuXHRcdHRoaXMubm90aWNlRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZW5kZXJEaWZmKGlucHV0OiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgZ2VuZXJhdGlvbjogbnVtYmVyKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvckNvbnRhaW5lciB8fCAhaW5wdXQub3JpZ2luYWwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgb3JpZ2luYWxSZWY6IElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgbW9kaWZpZWRSZWY6IElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPiB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0b3JpZ2luYWxSZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoaW5wdXQub3JpZ2luYWwpO1xuXHRcdFx0bW9kaWZpZWRSZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UoaW5wdXQubW9kaWZpZWQpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0b3JpZ2luYWxSZWY/LmRpc3Bvc2UoKTtcblx0XHRcdG1vZGlmaWVkUmVmPy5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgfHwgdGhpcy5pbnB1dCAhPT0gaW5wdXQgfHwgdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQgfHwgZ2VuZXJhdGlvbiAhPT0gdGhpcy5yZW5kZXJHZW5lcmF0aW9uKSB7XG5cdFx0XHRvcmlnaW5hbFJlZi5kaXNwb3NlKCk7XG5cdFx0XHRtb2RpZmllZFJlZi5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0dGhpcy5vcmlnaW5hbE1vZGVsUmVmLnZhbHVlID0gb3JpZ2luYWxSZWY7XG5cdFx0dGhpcy5tb2RpZmllZE1vZGVsUmVmLnZhbHVlID0gbW9kaWZpZWRSZWY7XG5cblx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmRpZmZXaWRnZXQudmFsdWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0RGlmZkVkaXRvcldpZGdldCxcblx0XHRcdHRoaXMuZWRpdG9yQ29udGFpbmVyLFxuXHRcdFx0dGhpcy5nZXREaWZmRWRpdG9yT3B0aW9ucygpLFxuXHRcdFx0e30sXG5cdFx0KTtcblx0XHRjb25zdCB2aWV3TW9kZWwgPSB0aGlzLmRpZmZWaWV3TW9kZWwudmFsdWUgPSB3aWRnZXQuY3JlYXRlVmlld01vZGVsKHtcblx0XHRcdG9yaWdpbmFsOiBvcmlnaW5hbFJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsLFxuXHRcdFx0bW9kaWZpZWQ6IG1vZGlmaWVkUmVmLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwsXG5cdFx0fSk7XG5cdFx0d2lkZ2V0LnNldE1vZGVsKHZpZXdNb2RlbCk7XG5cdFx0aWYgKCF0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkICYmIHRoaXMuaW5wdXQgPT09IGlucHV0ICYmIGdlbmVyYXRpb24gPT09IHRoaXMucmVuZGVyR2VuZXJhdGlvbikge1xuXHRcdFx0dGhpcy5iaW5kQWNjZXB0Q3Vyc29yKHdpZGdldCk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZW5kZXJNb2RpZmllZE9ubHkoaW5wdXQ6IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBnZW5lcmF0aW9uOiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yQ29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IG1vZGlmaWVkUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD47XG5cdFx0dHJ5IHtcblx0XHRcdG1vZGlmaWVkUmVmID0gYXdhaXQgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKGlucHV0Lm1vZGlmaWVkKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCB8fCB0aGlzLmlucHV0ICE9PSBpbnB1dCB8fCB0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCB8fCBnZW5lcmF0aW9uICE9PSB0aGlzLnJlbmRlckdlbmVyYXRpb24pIHtcblx0XHRcdG1vZGlmaWVkUmVmLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLm1vZGlmaWVkTW9kZWxSZWYudmFsdWUgPSBtb2RpZmllZFJlZjtcblx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmNvZGVXaWRnZXQudmFsdWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0Q29kZUVkaXRvcldpZGdldCxcblx0XHRcdHRoaXMuZWRpdG9yQ29udGFpbmVyLFxuXHRcdFx0cmVhZE9ubHlFZGl0b3JPcHRpb25zLFxuXHRcdFx0eyBpc1NpbXBsZVdpZGdldDogdHJ1ZSB9LFxuXHRcdCk7XG5cdFx0d2lkZ2V0LnNldE1vZGVsKG1vZGlmaWVkUmVmLm9iamVjdC50ZXh0RWRpdG9yTW9kZWwpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBsYXlvdXRFZGl0b3JzKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB0b29sYmFySGVpZ2h0ID0gdGhpcy50b29sYmFyPy5vZmZzZXRIZWlnaHQgPz8gMDtcblx0XHRjb25zdCBub3RpY2VIZWlnaHQgPSB0aGlzLm5vdGljZUVsZW1lbnQ/LnN0eWxlLmRpc3BsYXkgPT09ICdub25lJyA/IDAgOiAodGhpcy5ub3RpY2VFbGVtZW50Py5vZmZzZXRIZWlnaHQgPz8gMCk7XG5cdFx0Y29uc3QgZWRpdG9yRGltZW5zaW9uID0gbmV3IGRvbS5EaW1lbnNpb24odGhpcy5kaW1lbnNpb24ud2lkdGgsIE1hdGgubWF4KDAsIHRoaXMuZGltZW5zaW9uLmhlaWdodCAtIHRvb2xiYXJIZWlnaHQgLSBub3RpY2VIZWlnaHQpKTtcblx0XHR0aGlzLmRpZmZXaWRnZXQudmFsdWU/LmxheW91dChlZGl0b3JEaW1lbnNpb24pO1xuXHRcdHRoaXMuY29kZVdpZGdldC52YWx1ZT8ubGF5b3V0KGVkaXRvckRpbWVuc2lvbik7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRWRpdG9ycygpOiB2b2lkIHtcblx0XHR0aGlzLmFjY2VwdEN1cnNvckxpc3RlbmVycy5jbGVhcigpO1xuXHRcdHRoaXMuYWNjZXB0Q3Vyc29yID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZGlmZldpZGdldC52YWx1ZT8uc2V0TW9kZWwobnVsbCk7XG5cdFx0dGhpcy5jb2RlV2lkZ2V0LnZhbHVlPy5zZXRNb2RlbChudWxsKTtcblx0XHR0aGlzLmRpZmZXaWRnZXQuY2xlYXIoKTtcblx0XHR0aGlzLmNvZGVXaWRnZXQuY2xlYXIoKTtcblx0XHR0aGlzLmRpZmZWaWV3TW9kZWwuY2xlYXIoKTtcblx0XHR0aGlzLm9yaWdpbmFsTW9kZWxSZWYuY2xlYXIoKTtcblx0XHR0aGlzLm1vZGlmaWVkTW9kZWxSZWYuY2xlYXIoKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGlkU291cmNlc0NvbnZlcnNhdGlvbkNvbXBhcmlzb25Mb2FkRmFpbChwYW5lOiB1bmtub3duKTogYm9vbGVhbiB7XG5cdHJldHVybiBwYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUgJiYgcGFuZS5kaWRDb21wYXJpc29uTG9hZEZhaWwoKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlYWRPcGVuZWRTb3VyY2VzQ29udmVyc2F0aW9uQ29tcGFyaXNvbihwYW5lOiB1bmtub3duKTogeyByZWFkb25seSBzdGF0ZTogJ3BlbmRpbmcnIHwgJ29rJyB8ICdmYWlsJyB8IHVuZGVmaW5lZDsgcmVhZG9ubHkgbWF0Y2hlczogKGlucHV0OiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQpID0+IGJvb2xlYW4gfSB8IHVuZGVmaW5lZCB7XG5cdGlmICghKHBhbmUgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSkpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGNvbnN0IHN0YXRlID0gcGFuZS5nZXRDb21wYXJpc29uTG9hZFN0YXRlKCk7XG5cdHJldHVybiB7XG5cdFx0c3RhdGUsXG5cdFx0bWF0Y2hlczogaW5wdXQgPT4gcGFuZS5pbnB1dCBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCAmJiBpbnB1dC5tYXRjaGVzKHBhbmUuaW5wdXQpLFxuXHR9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBRXJCLFNBQVMsaUJBQTZCLHlCQUF5QjtBQUUvRCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUdqQyxTQUFtQyx5QkFBeUI7QUFDNUQsU0FBUyxpQkFBaUIseUJBQXlCO0FBQ25ELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCLHVCQUF1QjtBQUNsRCxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGtCQUFrQjtBQUczQixTQUFTLG1DQUFtQyx1Q0FBdUM7QUFDbkYsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxtQ0FBbUM7QUFDNUM7QUFBQSxFQUNDO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxPQUNNO0FBQ1AsU0FBUyxrQ0FBa0MsaUNBQWlDO0FBQzVFO0FBQUEsRUFDQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsT0FDTTtBQUNQO0FBQUEsRUFDQztBQUFBLEVBRUE7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsT0FDTTtBQUNQLFNBQVMsc0JBQXNCLDRCQUE0QixvQ0FBb0M7QUFDL0Y7QUFBQSxFQUdDO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsT0FDTTtBQUNQLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMENBQTBDO0FBR25ELE1BQU0sSUFBSSxJQUFJO0FBRVAsU0FBUyw4Q0FBc0Q7QUFDckUsU0FBTyxTQUFTLHlDQUF5QyxpQ0FBaUM7QUFDM0Y7QUFFQSxNQUFNLHdCQUE0QztBQUFBLEVBQ2pELFVBQVU7QUFBQSxFQUNWLHNCQUFzQjtBQUFBLEVBQ3RCLFNBQVMsRUFBRSxTQUFTLE1BQU07QUFBQSxFQUMxQixpQkFBaUI7QUFBQSxFQUNqQixhQUFhO0FBQ2Q7QUFFTyxJQUFNLDZCQUFOLGNBQXlDLFdBQVc7QUFBQSxFQWtDMUQsWUFDQyxPQUNtQixrQkFDSixjQUNFLGdCQUNpQixnQkFDTSxzQkFDSixrQkFDSSxzQkFDVixZQUNhLGNBQ0osU0FDQSxjQUN0QztBQUNELFVBQU0sMkJBQTJCLElBQUksT0FBTyxrQkFBa0IsY0FBYyxjQUFjO0FBVHhEO0FBQ007QUFDSjtBQUNJO0FBQ1Y7QUFDYTtBQUNKO0FBQ0E7QUExQ3hDLFNBQWlCLGFBQWEsS0FBSyxVQUFVLElBQUksa0JBQW9DLENBQUM7QUFDdEYsU0FBaUIsZ0JBQWdCLEtBQUssVUFBVSxJQUFJLGtCQUF3QyxDQUFDO0FBQzdGLFNBQWlCLGFBQWEsS0FBSyxVQUFVLElBQUksa0JBQW9DLENBQUM7QUFDdEYsU0FBaUIsbUJBQW1CLEtBQUssVUFBVSxJQUFJLGtCQUF3RCxDQUFDO0FBQ2hILFNBQWlCLG1CQUFtQixLQUFLLFVBQVUsSUFBSSxrQkFBd0QsQ0FBQztBQUNoSCxTQUFpQix3QkFBd0IsS0FBSyxVQUFVLElBQUksZ0JBQWdCLENBQUM7QUFZN0UsU0FBUSx3QkFBd0I7QUFHaEMsU0FBUSx1QkFBdUI7QUFFL0IsU0FBUSxtQkFBbUI7QUFJM0I7QUFBQSxTQUFRLHlCQUF5QjtBQW9CaEMsU0FBSyxVQUFVLEtBQUsscUJBQXFCLHlCQUF5QixPQUFLO0FBQ3RFLFVBQUksRUFBRSxxQkFBcUIsNkJBQTZCLEtBQUssS0FBSyxXQUFXLE9BQU87QUFDbkYsYUFBSyxXQUFXLE1BQU0sY0FBYyxLQUFLLHFCQUFxQixDQUFDO0FBQUEsTUFDaEU7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLFNBQUssVUFBVSxLQUFLLGFBQWEsc0JBQXNCLE1BQU0sS0FBSyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ3hGLFNBQUssVUFBVSxLQUFLLFFBQVEseUJBQXlCLE1BQU0sS0FBSyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ3RGLFNBQUssVUFBVSxLQUFLLFFBQVEsbUJBQW1CLE1BQU0sS0FBSyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ2hGLFNBQUssVUFBVSxLQUFLLGFBQWEsWUFBWSxNQUFNLEtBQUssb0JBQW9CLENBQUMsQ0FBQztBQUFBLEVBQy9FO0FBQUEsRUFFbUIsYUFBYSxRQUEyQjtBQUMxRCxTQUFLLFlBQVksSUFBSSxPQUFPLFFBQVEsRUFBRSxnQ0FBZ0MsQ0FBQztBQUN2RSxTQUFLLFVBQVUsYUFBYSxRQUFRLFVBQVU7QUFDOUMsU0FBSyxVQUFVLGFBQWEsY0FBYyxTQUFTLHdDQUF3QywwQkFBMEIsQ0FBQztBQUV0SCxTQUFLLFVBQVUsSUFBSSxPQUFPLEtBQUssV0FBVyxFQUFFLG1DQUFtQyxDQUFDO0FBRWhGLFNBQUssZUFBZSxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsd0NBQXdDLENBQUM7QUFDeEYsU0FBSyxhQUFhLE9BQU87QUFDekIsU0FBSyxhQUFhLGNBQWMsU0FBUyxxQ0FBcUMsUUFBUTtBQUN0RixTQUFLLGFBQWEsTUFBTSxVQUFVO0FBQ2xDLFNBQUssVUFBVSxJQUFJLHNCQUFzQixLQUFLLGNBQWMsU0FBUyxNQUFNO0FBQzFFLFdBQUssS0FBSyxhQUFhLHlCQUF5QixFQUFFLE1BQU0saUJBQWlCLEVBQUUsTUFBTSxpQkFBaUI7QUFBQSxJQUNuRyxDQUFDLENBQUM7QUFFRixTQUFLLGdCQUFnQixJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUseUNBQXlDLENBQUM7QUFDMUYsU0FBSyxjQUFjLE9BQU87QUFDMUIsU0FBSyxjQUFjLGNBQWMsU0FBUyxzQ0FBc0MsU0FBUztBQUN6RixTQUFLLGNBQWMsTUFBTSxVQUFVO0FBQ25DLFNBQUssVUFBVSxJQUFJLHNCQUFzQixLQUFLLGVBQWUsU0FBUyxNQUFNO0FBQzNFLFdBQUssS0FBSyxhQUFhLDJCQUEyQixFQUFFLE1BQU0saUJBQWlCLEVBQUUsTUFBTSxpQkFBaUI7QUFBQSxJQUNyRyxDQUFDLENBQUM7QUFFRixTQUFLLHFCQUFxQixJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsbURBQW1ELENBQUM7QUFDekcsU0FBSyxtQkFBbUIsY0FBYyxvQ0FBb0M7QUFDMUUsU0FBSyxtQkFBbUIsTUFBTSxVQUFVO0FBRXhDLFNBQUssY0FBYyxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsdUNBQXVDLENBQUM7QUFDdEYsU0FBSyxZQUFZLE9BQU87QUFDeEIsU0FBSyxZQUFZLGNBQWMsU0FBUyxvQ0FBb0MsT0FBTztBQUNuRixTQUFLLFlBQVksTUFBTSxVQUFVO0FBQ2pDLFNBQUssVUFBVSxJQUFJLHNCQUFzQixLQUFLLGFBQWEsU0FBUyxNQUFNO0FBQ3pFLFdBQUssS0FBSyxTQUFTLEVBQUUsTUFBTSxpQkFBaUIsRUFBRSxNQUFNLGlCQUFpQjtBQUFBLElBQ3RFLENBQUMsQ0FBQztBQUVGLFNBQUssZUFBZSxJQUFJLE9BQU8sS0FBSyxTQUFTLEVBQUUsd0NBQXdDLENBQUM7QUFDeEYsU0FBSyxhQUFhLE9BQU87QUFDekIsU0FBSyxhQUFhLGNBQWMsU0FBUyxxQ0FBcUMsUUFBUTtBQUN0RixTQUFLLGFBQWEsTUFBTSxVQUFVO0FBQ2xDLFNBQUssVUFBVSxJQUFJLHNCQUFzQixLQUFLLGNBQWMsU0FBUyxNQUFNO0FBQzFFLFdBQUssS0FBSyxVQUFVLEVBQUUsTUFBTSxpQkFBaUIsRUFBRSxNQUFNLGlCQUFpQjtBQUFBLElBQ3ZFLENBQUMsQ0FBQztBQUVGLFNBQUssZ0JBQWdCLElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRSw4Q0FBOEMsQ0FBQztBQUMvRixTQUFLLGNBQWMsT0FBTztBQUMxQixTQUFLLGNBQWMsY0FBYyxTQUFTLDBDQUEwQyxzQkFBc0I7QUFDMUcsU0FBSyxjQUFjLE1BQU0sVUFBVTtBQUNuQyxTQUFLLFVBQVUsSUFBSSxzQkFBc0IsS0FBSyxlQUFlLFNBQVMsTUFBTTtBQUMzRSxXQUFLLEtBQUssaUJBQWlCLEVBQUUsTUFBTSxpQkFBaUIsRUFBRSxNQUFNLGlCQUFpQjtBQUFBLElBQzlFLENBQUMsQ0FBQztBQUNGLFNBQUssUUFBUSxNQUFNLFVBQVU7QUFFN0IsU0FBSyxnQkFBZ0IsSUFBSSxPQUFPLEtBQUssV0FBVyxFQUFFLGtDQUFrQyxDQUFDO0FBQ3JGLFNBQUssY0FBYyxNQUFNLFVBQVU7QUFDbkMsU0FBSyxvQkFBb0IsSUFBSSxPQUFPLEtBQUssV0FBVyxFQUFFLHVFQUF1RSxDQUFDO0FBQzlILFNBQUssZUFBZTtBQUNwQixTQUFLLGtCQUFrQixJQUFJLE9BQU8sS0FBSyxXQUFXLEVBQUUsa0NBQWtDLENBQUM7QUFBQSxFQUN4RjtBQUFBLEVBRUEsTUFBZSxTQUFTLE9BQW9DLFNBQXFDLFNBQTZCLE9BQXlDO0FBQ3RLLFNBQUs7QUFDTCxTQUFLO0FBQ0wsU0FBSyxlQUFlO0FBQ3BCLFVBQU0sYUFBYSxNQUFNO0FBQ3pCLFNBQUssbUJBQW1CO0FBQ3hCLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssZ0JBQWdCLDRCQUE0QixLQUFLLGVBQWUsTUFBTSxRQUFRO0FBQ25GLFVBQU0sTUFBTSxTQUFTLE9BQU8sU0FBUyxTQUFTLEtBQUs7QUFDbkQsUUFBSSxLQUFLLE9BQU8sY0FBYyxNQUFNLDJCQUEyQixlQUFlLEtBQUssa0JBQWtCO0FBQ3BHO0FBQUEsSUFDRDtBQUVBLFNBQUssYUFBYTtBQUNsQixTQUFLLHVCQUF1QjtBQUM1QixTQUFLLGdCQUFnQjtBQUNyQixTQUFLLFdBQVc7QUFDaEIsU0FBSyx1QkFBdUIsS0FBSztBQUVqQyxRQUFJLFNBQVM7QUFDYixRQUFJLENBQUMsTUFBTSxVQUFVO0FBQ3BCLGVBQVMsTUFBTSxLQUFLLG1CQUFtQixPQUFPLE9BQU8sVUFBVTtBQUMvRCxVQUFJLFVBQVUsZUFBZSxLQUFLLGtCQUFrQjtBQUNuRCxhQUFLLFdBQVcsU0FBUyxzQ0FBc0MsK0NBQStDLEdBQUcsS0FBSztBQUFBLE1BQ3ZIO0FBQUEsSUFDRCxPQUFPO0FBQ04sZUFBUyxNQUFNLEtBQUssV0FBVyxPQUFPLE9BQU8sVUFBVTtBQUFBLElBQ3hEO0FBRUEsUUFBSSxLQUFLLE9BQU8sY0FBYyxLQUFLLFVBQVUsU0FBUyxNQUFNLDJCQUEyQixlQUFlLEtBQUssa0JBQWtCO0FBQzVIO0FBQUEsSUFDRDtBQUVBLFFBQUksQ0FBQyxRQUFRO0FBQ1osV0FBSyxrQkFBa0I7QUFDdkIsV0FBSyx1QkFBdUI7QUFDNUIsV0FBSyxnQkFBZ0I7QUFDckIsV0FBSyx1QkFBdUIsS0FBSztBQUNqQyxXQUFLLFdBQVcsNENBQTRDLENBQUM7QUFDN0QsV0FBSyxjQUFjO0FBQ25CLFdBQUssb0JBQW9CLEtBQUs7QUFDOUIsMEJBQW9CLEVBQUUsVUFBVSxNQUFNLFVBQVUsWUFBWSxJQUFJLE1BQU0sQ0FBQztBQUN2RTtBQUFBLElBQ0Q7QUFFQSxTQUFLLGtCQUFrQjtBQUN2QixTQUFLLHVCQUF1QixJQUFJO0FBQ2hDLFNBQUssb0JBQW9CO0FBQ3pCLFNBQUssY0FBYztBQUNuQixTQUFLLG9CQUFvQixLQUFLO0FBQzlCLHdCQUFvQixFQUFFLFVBQVUsTUFBTSxVQUFVLFlBQVksSUFBSSxLQUFLLENBQUM7QUFBQSxFQUN2RTtBQUFBLEVBRUEsd0JBQWlDO0FBQ2hDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLHlCQUFnRTtBQUMvRCxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFUyxVQUFnQjtBQUN4QixTQUFLO0FBQ0wsU0FBSztBQUNMLFNBQUssZUFBZTtBQUNwQixTQUFLLGFBQWE7QUFDbEIsVUFBTSxRQUFRO0FBQUEsRUFDZjtBQUFBLEVBRVMsYUFBbUI7QUFDM0IsU0FBSztBQUNMLFNBQUs7QUFDTCxTQUFLLGVBQWU7QUFDcEIsU0FBSyxnQkFBZ0I7QUFDckIsU0FBSyx1QkFBdUI7QUFDNUIsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxhQUFhO0FBQ2xCLFNBQUssV0FBVztBQUNoQixTQUFLLHVCQUF1QixLQUFLO0FBQ2pDLFFBQUksS0FBSyxjQUFjO0FBQ3RCLFdBQUssYUFBYSxNQUFNLFVBQVU7QUFBQSxJQUNuQztBQUNBLFFBQUksS0FBSyxlQUFlO0FBQ3ZCLFdBQUssY0FBYyxNQUFNLFVBQVU7QUFBQSxJQUNwQztBQUNBLFFBQUksS0FBSyxvQkFBb0I7QUFDNUIsV0FBSyxtQkFBbUIsTUFBTSxVQUFVO0FBQUEsSUFDekM7QUFDQSxRQUFJLEtBQUssYUFBYTtBQUNyQixXQUFLLFlBQVksTUFBTSxVQUFVO0FBQUEsSUFDbEM7QUFDQSxRQUFJLEtBQUssY0FBYztBQUN0QixXQUFLLGFBQWEsTUFBTSxVQUFVO0FBQUEsSUFDbkM7QUFDQSxVQUFNLFdBQVc7QUFBQSxFQUNsQjtBQUFBLEVBRVMsYUFBOEQ7QUFDdEUsV0FBTyxLQUFLLFdBQVcsU0FBUyxLQUFLLFdBQVc7QUFBQSxFQUNqRDtBQUFBLEVBRVMsUUFBYztBQUN0QixVQUFNLE1BQU07QUFDWixLQUFDLEtBQUssV0FBVyxPQUFPLGtCQUFrQixLQUFLLEtBQUssV0FBVyxRQUFRLE1BQU07QUFBQSxFQUM5RTtBQUFBLEVBRVMsT0FBTyxXQUFvRDtBQUNuRSxTQUFLLFlBQVksSUFBSSxJQUFJLFVBQVUsVUFBVSxPQUFPLFVBQVUsTUFBTTtBQUNwRSxRQUFJLEtBQUssV0FBVztBQUNuQixXQUFLLFVBQVUsTUFBTSxRQUFRLEdBQUcsVUFBVSxLQUFLO0FBQy9DLFdBQUssVUFBVSxNQUFNLFNBQVMsR0FBRyxVQUFVLE1BQU07QUFBQSxJQUNsRDtBQUNBLFNBQUssY0FBYztBQUFBLEVBQ3BCO0FBQUEsRUFFUSx1QkFBdUQ7QUFDOUQsV0FBTztBQUFBLE1BQ04sR0FBRztBQUFBLE1BQ0gsa0JBQWtCO0FBQUEsTUFDbEIsa0JBQWtCLEtBQUsscUJBQXFCLFNBQWtCLDZCQUE2QixLQUFLO0FBQUEsTUFDaEcsaUNBQWlDO0FBQUEsTUFDakMscUJBQXFCO0FBQUEsSUFDdEI7QUFBQSxFQUNEO0FBQUEsRUFFUSxzQkFBNEI7QUFDbkMsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxjQUFjO0FBQUEsRUFDcEI7QUFBQSxFQUVRLGtCQUEwQjtBQUNqQyxVQUFNLFdBQVcsS0FBSyxhQUFhLFlBQVk7QUFDL0MsVUFBTSxXQUFXLEtBQUssaUJBQWlCLDhCQUE4QixLQUFLLE1BQU0sV0FBVztBQUMzRixVQUFNLFVBQVUsV0FDYixTQUFTLFFBQVEsT0FBTyxXQUFTLE1BQU0sU0FBUyxTQUFTLE1BQU0sU0FBUyxTQUFTLENBQUMsSUFDbEY7QUFDSCxXQUFPLDZCQUE2QixVQUFVLFNBQVMsS0FBSyxRQUFRLG1CQUFtQixDQUFDO0FBQUEsRUFDekY7QUFBQSxFQUVRLHdCQUFpQztBQUN4QyxXQUFPLGdDQUFnQyxrQ0FBa0MsS0FBSyxPQUFPLENBQUMsTUFBTTtBQUFBLEVBQzdGO0FBQUEsRUFFUSxlQUF3QjtBQUMvQixXQUFPLDJCQUEyQixLQUFLLGFBQWEsWUFBWSxFQUFFLEtBQUs7QUFBQSxFQUN4RTtBQUFBLEVBRVEsNkJBQXNDO0FBQzdDLFdBQU87QUFBQSxNQUNOLEtBQUssYUFBYSxrQkFBa0I7QUFBQSxNQUNwQyxDQUFDLENBQUMsS0FBSyxhQUFhLHdCQUF3QixFQUFFO0FBQUEsTUFDOUMsS0FBSyxzQkFBc0I7QUFBQSxJQUM1QjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHlCQUFrQztBQUN6QyxXQUFPLEtBQUssYUFBYSxjQUFjO0FBQUEsRUFDeEM7QUFBQSxFQUVRLHVCQUF1QixTQUF3QjtBQUN0RCxRQUFJLEtBQUssU0FBUztBQUNqQixXQUFLLFFBQVEsTUFBTSxVQUFVLFVBQVUsS0FBSztBQUFBLElBQzdDO0FBQ0EsUUFBSSxLQUFLLGVBQWU7QUFDdkIsV0FBSyxjQUFjLE1BQU0sVUFBVSxVQUFVLEtBQUs7QUFBQSxJQUNuRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGtCQUF3QjtBQUMvQixRQUFJLEtBQUssY0FBYztBQUN0QixXQUFLLGFBQWEsTUFBTSxVQUFVO0FBQUEsSUFDbkM7QUFDQSxRQUFJLEtBQUssZUFBZTtBQUN2QixXQUFLLGNBQWMsTUFBTSxVQUFVO0FBQUEsSUFDcEM7QUFDQSxRQUFJLEtBQUssb0JBQW9CO0FBQzVCLFdBQUssbUJBQW1CLE1BQU0sVUFBVTtBQUFBLElBQ3pDO0FBQ0EsUUFBSSxLQUFLLGFBQWE7QUFDckIsV0FBSyxZQUFZLE1BQU0sVUFBVTtBQUFBLElBQ2xDO0FBQ0EsUUFBSSxLQUFLLGNBQWM7QUFDdEIsV0FBSyxhQUFhLE1BQU0sVUFBVTtBQUFBLElBQ25DO0FBQUEsRUFDRDtBQUFBLEVBRVEsc0JBQTRCO0FBQ25DLFFBQUksQ0FBQyxLQUFLLGdCQUFnQixDQUFDLEtBQUssZUFBZSxDQUFDLEtBQUssZ0JBQWdCLENBQUMsS0FBSyxpQkFBaUIsQ0FBQyxLQUFLLG9CQUFvQjtBQUNySDtBQUFBLElBQ0Q7QUFDQSxRQUFJLEtBQUssc0JBQXNCO0FBQzlCLFdBQUssZ0JBQWdCO0FBQ3JCO0FBQUEsSUFDRDtBQUNBLFVBQU0sUUFBUSxLQUFLLGtCQUFrQjtBQUNyQyxRQUFJLENBQUMsT0FBTztBQUNYLFdBQUssZ0JBQWdCO0FBQ3JCO0FBQUEsSUFDRDtBQUNBLFVBQU0sU0FBUyx3Q0FBd0MsS0FBSztBQUM1RCxTQUFLLGFBQWEsTUFBTSxVQUFVLE9BQU8sYUFBYSxLQUFLO0FBQzNELFNBQUssY0FBYyxNQUFNLFVBQVUsT0FBTyxjQUFjLEtBQUs7QUFDN0QsU0FBSyxtQkFBbUIsTUFBTSxVQUFVLE9BQU8scUJBQXFCLEtBQUs7QUFDekUsU0FBSyxZQUFZLE1BQU0sVUFBVSxPQUFPLFlBQVksS0FBSztBQUN6RCxTQUFLLGFBQWEsTUFBTSxVQUFVLE9BQU8sYUFBYSxLQUFLO0FBQzNELFNBQUssMEJBQTBCLEtBQUs7QUFBQSxFQUNyQztBQUFBO0FBQUEsRUFHUSwwQkFBMEIsT0FBcUM7QUFDdEUsUUFBSSxDQUFDLEtBQUssYUFBYTtBQUN0QjtBQUFBLElBQ0Q7QUFDQSxVQUFNLGFBQWEsbUNBQW1DLEtBQUs7QUFDM0QsVUFBTSxhQUFhLFNBQVMsb0NBQW9DLE9BQU87QUFDdkUsU0FBSyxZQUFZLFdBQVcsV0FBVztBQUN2QyxTQUFLLFlBQVksYUFBYSxpQkFBaUIsV0FBVyxlQUFlLFNBQVMsT0FBTztBQUN6RixVQUFNLGVBQWUsZ0NBQWdDO0FBQ3JELFNBQUssWUFBWSxRQUFRLFdBQVcsZUFBZSxlQUFlO0FBQ2xFLFNBQUssWUFBWSxhQUFhLGNBQWMsV0FBVyxlQUFlLEdBQUcsVUFBVSxLQUFLLFlBQVksS0FBSyxVQUFVO0FBQ25ILFFBQUksV0FBVyxRQUFRO0FBQ3RCLFdBQUssV0FBVyxXQUFXLE1BQU07QUFDakM7QUFBQSxJQUNEO0FBQ0EsUUFBSSxLQUFLLGVBQWUsZ0JBQWdCLGNBQWM7QUFDckQsV0FBSyxXQUFXO0FBQUEsSUFDakI7QUFBQSxFQUNEO0FBQUEsRUFFUSxvQkFBd0Q7QUFDL0QsVUFBTSxRQUFRLEtBQUs7QUFDbkIsUUFBSSxFQUFFLGlCQUFpQiw4QkFBOEI7QUFDcEQsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLE9BQU8sNEJBQTRCLEtBQUssWUFBWTtBQUFBLE1BQ3pELFVBQVUsTUFBTTtBQUFBLE1BQ2hCLFNBQVMsTUFBTTtBQUFBLE1BQ2YsUUFBUSxNQUFNO0FBQUEsTUFDZCxTQUFTLE1BQU07QUFBQSxJQUNoQixDQUFDO0FBQ0QsVUFBTSxvQkFBb0IsS0FBSyxnQkFBZ0I7QUFDL0MsVUFBTSxjQUFjLEtBQUssUUFBUSxjQUFjO0FBQy9DLFVBQU0sYUFBYSxLQUFLLGFBQWE7QUFDckMsVUFBTSxxQkFBcUIsS0FBSyxzQkFBc0I7QUFDdEQsVUFBTSxrQkFBa0IsTUFBTSxhQUFhO0FBQzNDLFdBQU87QUFBQSxNQUNOLFVBQVU7QUFBQSxRQUNULFFBQVEsTUFBTTtBQUFBLFFBQ2QsV0FBVyxNQUFNO0FBQUEsUUFDakIsVUFBVSxNQUFNO0FBQUEsTUFDakI7QUFBQSxNQUNBLHFCQUFxQixLQUFLLGFBQWEsWUFBWSxFQUFFLE1BQU07QUFBQSxNQUMzRCxhQUFhLEtBQUssdUJBQXVCO0FBQUEsTUFDekMsaUJBQWlCLEtBQUssUUFBUSxtQkFBbUI7QUFBQSxNQUNqRDtBQUFBLE1BQ0EsU0FBUyxLQUFLO0FBQUEsTUFDZCxNQUFNLEtBQUs7QUFBQSxNQUNYLGFBQWEsS0FBSztBQUFBLE1BQ2xCLGVBQWU7QUFBQSxRQUNkLEtBQUssYUFBYSxrQkFBa0I7QUFBQSxRQUNwQywyQkFBMkIsS0FBSyxhQUFhLHdCQUF3QixHQUFHLHNCQUFzQixLQUFLLGFBQWEsa0JBQWtCO0FBQUEsUUFDbEk7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxRQUNmLEtBQUssYUFBYSxrQkFBa0I7QUFBQSxRQUNwQywyQkFBMkIsS0FBSyxhQUFhLHdCQUF3QixHQUFHLHNCQUFzQixLQUFLLGFBQWEsa0JBQWtCO0FBQUEsUUFDbEk7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLHNCQUFzQiw2QkFBNkIsTUFBTSxNQUFNLE1BQU0sVUFBVSxLQUFLLEtBQUssU0FBUyxNQUFNLHVCQUF1QixlQUFlO0FBQUEsTUFDOUksb0JBQW9CLENBQUMsQ0FBQyxpQkFBaUIsV0FBVyx5QkFBeUI7QUFBQSxNQUMzRSxzQkFBc0IsQ0FBQyxDQUFDLGlCQUFpQixXQUFXLDJCQUEyQjtBQUFBLE1BQy9FLG9CQUFvQixDQUFDLENBQUMsaUJBQWlCLFdBQVcseUJBQXlCO0FBQUEsTUFDM0U7QUFBQSxNQUNBLGNBQWMsS0FBSywyQkFBMkI7QUFBQSxNQUM5QyxTQUFTLENBQUM7QUFBQSxNQUNWLFVBQVUsS0FBSztBQUFBLElBQ2hCO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxXQUEwQjtBQUN2QyxVQUFNLFFBQVEsS0FBSztBQUNuQixVQUFNLE9BQU8sNEJBQTRCLEtBQUssa0JBQWtCLENBQUM7QUFDakUsUUFBSSxLQUFLLFNBQVMsV0FBVztBQUM1QjtBQUFBLElBQ0Q7QUFDQSxRQUFJLEtBQUssU0FBUyxVQUFVO0FBQzNCLFdBQUssV0FBVyxLQUFLLE9BQU87QUFDNUIsV0FBSyxvQkFBb0I7QUFDekI7QUFBQSxJQUNEO0FBRUEsVUFBTSx5QkFBeUIsS0FBSztBQUNwQyxVQUFNLE9BQU8sS0FBSyxhQUFhO0FBQy9CLFFBQUk7QUFDSCxZQUFNLFVBQVUsS0FBSyxTQUFTLGdCQUMzQixFQUFFLE1BQU0sV0FBb0IsSUFDNUIsTUFBTSx1QkFBdUIsTUFBTTtBQUFBLFFBQ3BDLEtBQUssYUFBYSxrQkFBa0I7QUFBQSxRQUNwQyxPQUFPLGFBQVcsS0FBSyxLQUFLLEtBQUssY0FBYyxPQUFPLElBQUk7QUFBQSxRQUMxRCxLQUFLO0FBQUEsUUFDTCxDQUFDLEtBQUssSUFBSTtBQUFBLFFBQ1YsS0FBSyxRQUFRLGNBQWM7QUFBQSxRQUMzQixLQUFLLGFBQWE7QUFBQSxRQUNsQixLQUFLLHNCQUFzQjtBQUFBLE1BQzVCLENBQUM7QUFDRixVQUFJLEtBQUssT0FBTyxjQUFjLEtBQUssVUFBVSxTQUFTLDJCQUEyQixLQUFLLHdCQUF3QjtBQUM3RztBQUFBLE1BQ0Q7QUFDQSxZQUFNLFFBQVEsS0FBSyxrQkFBa0I7QUFDckMsVUFBSSxDQUFDLE9BQU87QUFDWDtBQUFBLE1BQ0Q7QUFDQSxZQUFNLFFBQVEsaUNBQWlDLFNBQVMsS0FBSztBQUM3RCxVQUFJLE1BQU0sU0FBUyxrQkFBa0I7QUFDcEMsYUFBSyxnQkFBZ0IsOEJBQThCLE1BQU0sU0FBUyxVQUFVLE9BQU87QUFDbkYsYUFBSyxXQUFXO0FBQ2hCLGFBQUssb0JBQW9CO0FBQ3pCO0FBQUEsTUFDRDtBQUNBLFVBQUksTUFBTSxTQUFTLGdCQUFnQjtBQUNsQyxhQUFLLFdBQVc7QUFDaEIsYUFBSyxvQkFBb0I7QUFDekI7QUFBQSxNQUNEO0FBQ0EsVUFBSSxNQUFNLFNBQVMsVUFBVTtBQUM1QixhQUFLLFdBQVcsTUFBTSxPQUFPO0FBQzdCLGFBQUssb0JBQW9CO0FBQ3pCO0FBQUEsTUFDRDtBQUNBLFVBQUksTUFBTSxTQUFTLFNBQVM7QUFDM0IsY0FBTSxLQUFLLGFBQWEseUJBQXlCO0FBQ2pEO0FBQUEsTUFDRDtBQUNBLFdBQUssb0JBQW9CO0FBQUEsSUFDMUIsU0FBUyxPQUFPO0FBQ2YsVUFBSSxLQUFLLE9BQU8sY0FBYyxLQUFLLFVBQVUsU0FBUywyQkFBMkIsS0FBSyx3QkFBd0I7QUFDN0c7QUFBQSxNQUNEO0FBQ0EsV0FBSyxXQUFXLGdCQUFnQixLQUFLLENBQUM7QUFDdEMsV0FBSyxvQkFBb0I7QUFBQSxJQUMxQjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLGlCQUFpQixRQUFnQztBQUN4RCxVQUFNLFNBQVMsQ0FBQyxNQUF1QyxXQUE4RDtBQUNwSCxZQUFNLFdBQVcsTUFBTTtBQUN0QixjQUFNLE9BQU8sT0FBTyxZQUFZLEdBQUc7QUFDbkMsWUFBSSxTQUFTLFFBQVc7QUFDdkI7QUFBQSxRQUNEO0FBQ0EsYUFBSyxlQUFlLCtCQUErQixLQUFLLGNBQWM7QUFBQSxVQUNyRTtBQUFBLFVBQ0E7QUFBQSxVQUNBLGdCQUFnQixPQUFPLGFBQWE7QUFBQSxRQUNyQyxDQUFDO0FBQUEsTUFDRjtBQUNBLFdBQUssc0JBQXNCLElBQUksT0FBTywwQkFBMEIsUUFBUSxDQUFDO0FBQ3pFLFdBQUssc0JBQXNCLElBQUksT0FBTyxxQkFBcUIsUUFBUSxDQUFDO0FBQUEsSUFDckU7QUFDQSxXQUFPLE9BQU8sT0FBTyxrQkFBa0IsQ0FBQztBQUN4QyxXQUFPLE9BQU8sT0FBTyxrQkFBa0IsQ0FBQztBQUFBLEVBQ3pDO0FBQUEsRUFFUSxtQkFBd0Q7QUFDL0QsVUFBTSxTQUFTLEtBQUssV0FBVztBQUMvQixVQUFNLFdBQVcsUUFBUSxrQkFBa0I7QUFDM0MsVUFBTSxXQUFXLFFBQVEsa0JBQWtCO0FBQzNDLFdBQU8sa0NBQWtDO0FBQUEsTUFDeEMsU0FBUyxVQUFVLGFBQWEsSUFBSSxRQUFRLFVBQVUsYUFBYSxJQUFJLFFBQVE7QUFBQSxNQUMvRSxZQUFZLEtBQUs7QUFBQSxNQUNqQixjQUFjLFVBQVUsWUFBWSxHQUFHO0FBQUEsTUFDdkMsY0FBYyxVQUFVLFlBQVksR0FBRztBQUFBLElBQ3hDLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxNQUFjLFlBQTJCO0FBQ3hDLFVBQU0sUUFBUSxLQUFLO0FBQ25CLFVBQU0sT0FBTyw2QkFBNkIsS0FBSyxrQkFBa0IsQ0FBQztBQUNsRSxRQUFJLEtBQUssU0FBUyxXQUFXO0FBQzVCO0FBQUEsSUFDRDtBQUNBLFFBQUksS0FBSyxTQUFTLFVBQVU7QUFDM0IsV0FBSyxXQUFXLEtBQUssT0FBTztBQUM1QixXQUFLLG9CQUFvQjtBQUN6QjtBQUFBLElBQ0Q7QUFFQSxVQUFNLHlCQUF5QixLQUFLO0FBQ3BDLFVBQU0sWUFBWSxNQUFNLENBQUMsS0FBSyxPQUFPLGNBQWMsaUJBQWlCLCtCQUNoRSxDQUFDLE1BQU0sV0FBVyxLQUFLLEtBQUssVUFBVSxTQUFTLDJCQUEyQixLQUFLO0FBQ25GLFVBQU0sWUFBWSxpQkFBaUIsOEJBQStCLE1BQU0sYUFBYSxLQUFNO0FBQzNGLFVBQU0sT0FBTyxLQUFLLGtCQUFrQixHQUFHLFFBQVE7QUFDL0MsVUFBTSxTQUFTLEtBQUssaUJBQWlCO0FBQ3JDLFVBQU0sT0FBTyxpQkFBaUIsOEJBQThCLE1BQU0sT0FBTztBQUN6RSxVQUFNLGFBQWEsaUJBQWlCLDhCQUE4QixNQUFNLGFBQWE7QUFDckYsUUFBSSxDQUFDLFVBQVUsS0FBSyxDQUFDLDZCQUE2QixNQUFNLFVBQVUsS0FBSyxTQUFTLE1BQU0sY0FBYyxNQUFNLENBQUMsUUFBUTtBQUNsSDtBQUFBLElBQ0Q7QUFFQSxVQUFNLGtCQUFrQixLQUFLLGFBQWE7QUFDMUMsUUFBSTtBQUNILFlBQU0sT0FBTyxNQUFNO0FBQUEsUUFDbEIsS0FBSyxhQUFhLGtCQUFrQjtBQUFBLFFBQ3BDLGtCQUFrQixhQUFXLGdCQUFnQixLQUFLLEtBQUssY0FBYyxPQUFPLElBQUk7QUFBQSxRQUNoRjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQSxLQUFLLFFBQVEsY0FBYztBQUFBLFFBQzNCLEtBQUssYUFBYTtBQUFBLE1BQ25CO0FBQ0EsVUFBSSxDQUFDLFVBQVUsR0FBRztBQUNqQjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLG1CQUFtQixLQUFLLGtCQUFrQjtBQUNoRCxZQUFNLFlBQVksNkJBQTZCLGdCQUFnQjtBQUMvRCxVQUFJLFVBQVUsU0FBUyxVQUFVO0FBQ2hDLFlBQUksVUFBVSxTQUFTLFVBQVU7QUFDaEMsZUFBSyxXQUFXLFVBQVUsT0FBTztBQUFBLFFBQ2xDO0FBQ0EsYUFBSyxvQkFBb0I7QUFDekI7QUFBQSxNQUNEO0FBQ0EsVUFBSSxVQUFVLGNBQWMsV0FBVztBQUN0QyxhQUFLLFdBQVcsZ0NBQWdDLENBQUM7QUFDakQsYUFBSyxvQkFBb0I7QUFDekI7QUFBQSxNQUNEO0FBQ0EsVUFBSSxDQUFDLGtCQUFrQixnQkFBZ0I7QUFDdEMsYUFBSyxvQkFBb0I7QUFDekI7QUFBQSxNQUNEO0FBQ0EsWUFBTSxRQUFRLE1BQU0sWUFBWSw0QkFBNEIsS0FBSyxhQUFhLE9BQU8sTUFBTSxPQUFPLElBQUksSUFBSTtBQUMxRyxVQUFJLENBQUMsU0FBUyxDQUFDLCtCQUErQixXQUFXLENBQUMsS0FBSyxDQUFDLEdBQUc7QUFDbEUsYUFBSyxXQUFXLG9DQUFvQyxDQUFDO0FBQ3JELGFBQUssb0JBQW9CO0FBQ3pCO0FBQUEsTUFDRDtBQUNBLFlBQU0sT0FBTyxLQUFLLGFBQWE7QUFDL0IsWUFBTSxVQUFVLE1BQU0sdUJBQXVCLE1BQU07QUFBQSxRQUNsRCxLQUFLLGFBQWEsa0JBQWtCO0FBQUEsUUFDcEMsT0FBTyxhQUFXLEtBQUssS0FBSyxLQUFLLGNBQWMsT0FBTyxJQUFJO0FBQUEsUUFDMUQ7QUFBQSxRQUNBO0FBQUEsUUFDQSxDQUFDLEtBQUs7QUFBQSxRQUNOLEtBQUssUUFBUSxjQUFjO0FBQUEsUUFDM0IsS0FBSyxhQUFhO0FBQUEsUUFDbEIsS0FBSyxzQkFBc0I7QUFBQSxNQUM1QixDQUFDO0FBQ0QsVUFBSSxDQUFDLFVBQVUsR0FBRztBQUNqQjtBQUFBLE1BQ0Q7QUFDQSxZQUFNLFFBQVEsS0FBSyxrQkFBa0I7QUFDckMsVUFBSSxDQUFDLE9BQU87QUFDWDtBQUFBLE1BQ0Q7QUFDQSxZQUFNLFFBQVEsa0NBQWtDLFNBQVMsS0FBSztBQUM5RCxVQUFJLE1BQU0sU0FBUyxnQkFBZ0I7QUFDbEMsYUFBSyxXQUFXO0FBQ2hCLGFBQUssYUFBYSxnQkFBZ0I7QUFDbEMsYUFBSyxvQkFBb0I7QUFDekI7QUFBQSxNQUNEO0FBQ0EsVUFBSSxNQUFNLFNBQVMsVUFBVTtBQUM1QixhQUFLLFdBQVcsTUFBTSxPQUFPO0FBQzdCLGFBQUssb0JBQW9CO0FBQ3pCO0FBQUEsTUFDRDtBQUNBLFdBQUssb0JBQW9CO0FBQUEsSUFDMUIsU0FBUyxPQUFPO0FBQ2YsVUFBSSxDQUFDLFVBQVUsR0FBRztBQUNqQjtBQUFBLE1BQ0Q7QUFDQSxXQUFLLFdBQVcsZ0JBQWdCLEtBQUssQ0FBQztBQUN0QyxXQUFLLG9CQUFvQjtBQUFBLElBQzFCO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxhQUFhLFdBQWtDO0FBQzVELFVBQU0sUUFBUSxLQUFLLGtCQUFrQjtBQUNyQyxVQUFNLE9BQU8sOEJBQThCLFdBQVcsS0FBSztBQUMzRCxRQUFJLEtBQUssU0FBUyxXQUFXLENBQUMsT0FBTztBQUNwQztBQUFBLElBQ0Q7QUFFQSxRQUFJO0FBQ0gsWUFBTSxLQUFLLGVBQWUsZUFBZSxLQUFLLFdBQVcsS0FBSyxXQUFXO0FBQ3pFLFdBQUssV0FBVztBQUNoQixVQUFJLEtBQUssVUFBVTtBQUNsQixhQUFLLGdCQUFnQiw4QkFBOEIsTUFBTSxTQUFTLFVBQVUsS0FBSyxRQUFRO0FBQUEsTUFDMUY7QUFBQSxJQUNELFNBQVMsT0FBTztBQUNmLFdBQUssV0FBVyxnQkFBZ0IsS0FBSyxDQUFDO0FBQUEsSUFDdkMsVUFBRTtBQUNELFdBQUssb0JBQW9CO0FBQUEsSUFDMUI7QUFBQSxFQUNEO0FBQUE7QUFBQSxFQUdBLE1BQWMsbUJBQWtDO0FBQy9DLFVBQU0sUUFBUSxLQUFLO0FBQ25CLFFBQUksRUFBRSxpQkFBaUIsOEJBQThCO0FBQ3BEO0FBQUEsSUFDRDtBQUNBLFVBQU0sYUFBYSxLQUFLO0FBQ3hCLFVBQU0sVUFBVSxFQUFFLEtBQUs7QUFDdkIsVUFBTSxTQUE2QyxFQUFFLE1BQU0sb0JBQW9CLFFBQVEsT0FBTyxPQUFPLEtBQUssT0FBTyxNQUFNLEtBQUs7QUFDNUgsVUFBTSxZQUFZLE1BQU0sQ0FBQyxLQUFLLE9BQU8sY0FBYyxLQUFLLFVBQVUsU0FBUyxDQUFDLE1BQU0sV0FBVyxLQUN6RixLQUFLLHFCQUFxQixjQUFjLEtBQUssMEJBQTBCO0FBQzNFLFFBQUk7QUFDSixRQUFJO0FBQ0gsZUFBUyxNQUFNLEtBQUssZUFBZSxlQUFzQyw4QkFBOEIsTUFBTTtBQUFBLElBQzlHLFNBQVMsT0FBTztBQUNmLFVBQUksVUFBVSxHQUFHO0FBQ2hCLGFBQUssZUFBZSxpQ0FBaUMsS0FBSyxDQUFDO0FBQUEsTUFDNUQ7QUFDQTtBQUFBLElBQ0Q7QUFDQSxRQUFJLENBQUMsVUFBVSxLQUFLLFdBQVcsU0FBUztBQUN2QztBQUFBLElBQ0Q7QUFDQSxRQUFJLFdBQVcsTUFBTTtBQUNwQixXQUFLLGVBQWU7QUFBQSxJQUNyQixPQUFPO0FBQ04sV0FBSyxlQUFlLG1DQUFtQyxDQUFDO0FBQUEsSUFDekQ7QUFBQSxFQUNEO0FBQUEsRUFFUSxlQUFlLFNBQXVCO0FBQzdDLFFBQUksS0FBSyxtQkFBbUI7QUFDM0IsV0FBSyxrQkFBa0IsY0FBYztBQUNyQyxXQUFLLGtCQUFrQixVQUFVLElBQUksVUFBVTtBQUMvQyxXQUFLLGtCQUFrQixNQUFNLFVBQVU7QUFBQSxJQUN4QztBQUFBLEVBQ0Q7QUFBQSxFQUVRLGlCQUF1QjtBQUM5QixRQUFJLEtBQUssbUJBQW1CO0FBQzNCLFdBQUssa0JBQWtCLGNBQWM7QUFDckMsV0FBSyxrQkFBa0IsTUFBTSxVQUFVO0FBQUEsSUFDeEM7QUFBQSxFQUNEO0FBQUEsRUFFUSxXQUFXLFNBQWlCLFVBQVUsTUFBWTtBQUN6RCxRQUFJLENBQUMsS0FBSyxlQUFlO0FBQ3hCO0FBQUEsSUFDRDtBQUNBLFNBQUssY0FBYyxjQUFjO0FBQ2pDLFNBQUssY0FBYyxVQUFVLE9BQU8sWUFBWSxPQUFPO0FBQ3ZELFNBQUssY0FBYyxNQUFNLFVBQVU7QUFBQSxFQUNwQztBQUFBLEVBRVEsYUFBbUI7QUFDMUIsUUFBSSxDQUFDLEtBQUssZUFBZTtBQUN4QjtBQUFBLElBQ0Q7QUFDQSxTQUFLLGNBQWMsY0FBYztBQUNqQyxTQUFLLGNBQWMsVUFBVSxPQUFPLFVBQVU7QUFDOUMsU0FBSyxjQUFjLE1BQU0sVUFBVTtBQUFBLEVBQ3BDO0FBQUEsRUFFQSxNQUFjLFdBQVcsT0FBb0MsT0FBMEIsWUFBc0M7QUFDNUgsUUFBSSxDQUFDLEtBQUssbUJBQW1CLENBQUMsTUFBTSxVQUFVO0FBQzdDLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSTtBQUNKLFFBQUk7QUFDSixRQUFJO0FBQ0gsb0JBQWMsTUFBTSxLQUFLLGlCQUFpQixxQkFBcUIsTUFBTSxRQUFRO0FBQzdFLG9CQUFjLE1BQU0sS0FBSyxpQkFBaUIscUJBQXFCLE1BQU0sUUFBUTtBQUFBLElBQzlFLFFBQVE7QUFDUCxtQkFBYSxRQUFRO0FBQ3JCLG1CQUFhLFFBQVE7QUFDckIsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLEtBQUssT0FBTyxjQUFjLEtBQUssVUFBVSxTQUFTLE1BQU0sMkJBQTJCLGVBQWUsS0FBSyxrQkFBa0I7QUFDNUgsa0JBQVksUUFBUTtBQUNwQixrQkFBWSxRQUFRO0FBQ3BCLGFBQU87QUFBQSxJQUNSO0FBRUEsU0FBSyxpQkFBaUIsUUFBUTtBQUM5QixTQUFLLGlCQUFpQixRQUFRO0FBRTlCLFVBQU0sU0FBUyxLQUFLLFdBQVcsUUFBUSxLQUFLLHFCQUFxQjtBQUFBLE1BQ2hFO0FBQUEsTUFDQSxLQUFLO0FBQUEsTUFDTCxLQUFLLHFCQUFxQjtBQUFBLE1BQzFCLENBQUM7QUFBQSxJQUNGO0FBQ0EsVUFBTSxZQUFZLEtBQUssY0FBYyxRQUFRLE9BQU8sZ0JBQWdCO0FBQUEsTUFDbkUsVUFBVSxZQUFZLE9BQU87QUFBQSxNQUM3QixVQUFVLFlBQVksT0FBTztBQUFBLElBQzlCLENBQUM7QUFDRCxXQUFPLFNBQVMsU0FBUztBQUN6QixRQUFJLENBQUMsS0FBSyxPQUFPLGNBQWMsS0FBSyxVQUFVLFNBQVMsZUFBZSxLQUFLLGtCQUFrQjtBQUM1RixXQUFLLGlCQUFpQixNQUFNO0FBQUEsSUFDN0I7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBYyxtQkFBbUIsT0FBb0MsT0FBMEIsWUFBc0M7QUFDcEksUUFBSSxDQUFDLEtBQUssaUJBQWlCO0FBQzFCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSTtBQUNKLFFBQUk7QUFDSCxvQkFBYyxNQUFNLEtBQUssaUJBQWlCLHFCQUFxQixNQUFNLFFBQVE7QUFBQSxJQUM5RSxRQUFRO0FBQ1AsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJLEtBQUssT0FBTyxjQUFjLEtBQUssVUFBVSxTQUFTLE1BQU0sMkJBQTJCLGVBQWUsS0FBSyxrQkFBa0I7QUFDNUgsa0JBQVksUUFBUTtBQUNwQixhQUFPO0FBQUEsSUFDUjtBQUVBLFNBQUssaUJBQWlCLFFBQVE7QUFDOUIsVUFBTSxTQUFTLEtBQUssV0FBVyxRQUFRLEtBQUsscUJBQXFCO0FBQUEsTUFDaEU7QUFBQSxNQUNBLEtBQUs7QUFBQSxNQUNMO0FBQUEsTUFDQSxFQUFFLGdCQUFnQixLQUFLO0FBQUEsSUFDeEI7QUFDQSxXQUFPLFNBQVMsWUFBWSxPQUFPLGVBQWU7QUFDbEQsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGdCQUFzQjtBQUM3QixRQUFJLENBQUMsS0FBSyxXQUFXO0FBQ3BCO0FBQUEsSUFDRDtBQUVBLFVBQU0sZ0JBQWdCLEtBQUssU0FBUyxnQkFBZ0I7QUFDcEQsVUFBTSxlQUFlLEtBQUssZUFBZSxNQUFNLFlBQVksU0FBUyxJQUFLLEtBQUssZUFBZSxnQkFBZ0I7QUFDN0csVUFBTSxrQkFBa0IsSUFBSSxJQUFJLFVBQVUsS0FBSyxVQUFVLE9BQU8sS0FBSyxJQUFJLEdBQUcsS0FBSyxVQUFVLFNBQVMsZ0JBQWdCLFlBQVksQ0FBQztBQUNqSSxTQUFLLFdBQVcsT0FBTyxPQUFPLGVBQWU7QUFDN0MsU0FBSyxXQUFXLE9BQU8sT0FBTyxlQUFlO0FBQUEsRUFDOUM7QUFBQSxFQUVRLGVBQXFCO0FBQzVCLFNBQUssc0JBQXNCLE1BQU07QUFDakMsU0FBSyxlQUFlO0FBQ3BCLFNBQUssV0FBVyxPQUFPLFNBQVMsSUFBSTtBQUNwQyxTQUFLLFdBQVcsT0FBTyxTQUFTLElBQUk7QUFDcEMsU0FBSyxXQUFXLE1BQU07QUFDdEIsU0FBSyxXQUFXLE1BQU07QUFDdEIsU0FBSyxjQUFjLE1BQU07QUFDekIsU0FBSyxpQkFBaUIsTUFBTTtBQUM1QixTQUFLLGlCQUFpQixNQUFNO0FBQUEsRUFDN0I7QUFDRDtBQTN3QmEsMkJBRUksS0FBSztBQUZULDZCQUFOO0FBQUEsRUFvQ0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0E5Q1U7QUE2d0JOLFNBQVMseUNBQXlDLE1BQXdCO0FBQ2hGLFNBQU8sZ0JBQWdCLDhCQUE4QixLQUFLLHNCQUFzQjtBQUNqRjtBQUVPLFNBQVMsd0NBQXdDLE1BQXlKO0FBQ2hOLE1BQUksRUFBRSxnQkFBZ0IsNkJBQTZCO0FBQ2xELFdBQU87QUFBQSxFQUNSO0FBQ0EsUUFBTSxRQUFRLEtBQUssdUJBQXVCO0FBQzFDLFNBQU87QUFBQSxJQUNOO0FBQUEsSUFDQSxTQUFTLFdBQVMsS0FBSyxpQkFBaUIsK0JBQStCLE1BQU0sUUFBUSxLQUFLLEtBQUs7QUFBQSxFQUNoRztBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
