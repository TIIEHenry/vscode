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
import "./media/sourcesDiffPanel.css";
import * as dom from "../../../../base/browser/dom.js";
import { DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { basename } from "../../../../base/common/resources.js";
import { CodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/codeEditorWidget.js";
import { DiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { getErrorMessage, onUnexpectedError } from "../../../../base/common/errors.js";
import { localize } from "../../../../nls.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUniverseAgentConnection } from "../../../../platform/universeAgent/common/universeAgentConnection.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { EditorModel } from "../../../common/editor/editorModel.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { conversationSessionReadinessProbe, getConversationSessionReadiness } from "../../conversation/common/conversationSessionReadiness.js";
import { IAgentSessionContext } from "../../../services/agentSession/common/agentSessionContext.js";
import { ISCMService } from "../../scm/common/scm.js";
import { resolveSourcesDiffWriteGate } from "../common/sourcesChangeRef.js";
import {
  SOURCES_GIT_CLEAN_COMMAND,
  SOURCES_GIT_STAGE_COMMAND,
  SOURCES_GIT_UNSTAGE_COMMAND
} from "../common/sourcesChangesGit.js";
import { tryReadSourcesGitFileDiff } from "../common/sourcesChangesGitRead.js";
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
import { ISourcesDiffPanelService } from "../common/sourcesDiffPanelService.js";
import { allocateSourcesDiffLoadGeneration, fireSourcesDiffLoad } from "./sourcesDiffLoadSignal.js";
import { SOURCES_DIFF_PANEL_VIEW_ID } from "./sourcesDiffPanelIds.js";
const $ = dom.$;
function sourcesDiffPanelComparisonLoadFailedMessage() {
  return localize("sourcesDiffPanel.loadFailed", "Unable to load this comparison.");
}
class SourcesDiffEditorModel extends EditorModel {
  constructor(originalRef, modifiedRef) {
    super();
    this.originalRef = originalRef;
    this.modifiedRef = modifiedRef;
    this.original = originalRef.object.textEditorModel;
    this.modified = modifiedRef.object.textEditorModel;
  }
  dispose() {
    super.dispose();
    this.originalRef.dispose();
    this.modifiedRef.dispose();
  }
}
const readOnlyEditorOptions = {
  readOnly: true,
  scrollBeyondLastLine: false,
  minimap: { enabled: false },
  automaticLayout: false,
  lineNumbers: "on"
};
let SourcesDiffPanelView = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, textModelService, sourcesDiffPanelService, commandService, scmService, uaConnection, session, changesModel) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.textModelService = textModelService;
    this.sourcesDiffPanelService = sourcesDiffPanelService;
    this.commandService = commandService;
    this.scmService = scmService;
    this.uaConnection = uaConnection;
    this.session = session;
    this.changesModel = changesModel;
    this.bodyDisposables = this._register(new DisposableStore());
    this.diffWidget = this._register(new MutableDisposable());
    this.diffViewModel = this._register(new MutableDisposable());
    this.codeWidget = this._register(new MutableDisposable());
    this.model = this._register(new MutableDisposable());
    this.modifiedModelRef = this._register(new MutableDisposable());
    this.comparisonLoadFailed = false;
    this.renderGeneration = 0;
    this.renderSettledGeneration = 0;
    this._stageGeneration = 0;
    this.element.classList.add("sources-diff-panel");
    this._register(this.sourcesDiffPanelService.onDidChangeRef((ref) => {
      this.currentRef = ref;
      if (!this.bodyContainer) {
        return;
      }
      const generation = ref ? this.sourcesDiffPanelService.getPendingRenderGeneration() : void 0;
      if (generation !== void 0) {
        this.beginRender(ref, generation);
        return;
      }
      if (!ref) {
        this.beginRender(void 0, allocateSourcesDiffLoadGeneration());
      }
    }));
    this._register(this.uaConnection.onDidChangeConnection(() => this.onWriteFactsChanged()));
    this._register(this.session.onDidChangeActiveSession(() => this.onWriteFactsChanged()));
    this._register(this.session.onDidChangeSession(() => this.onWriteFactsChanged()));
    this._register(this.changesModel.onDidChange(() => this.onWriteFactsChanged()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("diffEditor.renderSideBySide") && this.diffWidget.value) {
        this.diffWidget.value.updateOptions(this.getDiffEditorOptions());
      }
    }));
    this.currentRef = this.sourcesDiffPanelService.getCurrentRef();
  }
  dispose() {
    this.renderGeneration = allocateSourcesDiffLoadGeneration();
    this.clearEditors();
    super.dispose();
  }
  renderBody(container) {
    super.renderBody(container);
    this.bodyContainer = dom.append(container, $(".sources-diff-panel-body"));
    this.headerElement = dom.append(this.bodyContainer, $(".sources-diff-panel-header"));
    this.headerTitle = dom.append(this.headerElement, $(".sources-diff-panel-title"));
    const headerActions = dom.append(this.headerElement, $(".sources-diff-panel-actions"));
    this.stageButton = this.createHeaderAction(headerActions, "sources-diff-panel-stage", localize("sourcesDiffPanel.stage", "Stage"), () => {
      void this.runStage().catch(onUnexpectedError).catch(onUnexpectedError);
    });
    this.acceptButton = this.createHeaderAction(headerActions, "sources-diff-panel-accept", localize("sourcesDiffPanel.accept", "Accept"), () => {
      void this.runAccept().catch(onUnexpectedError).catch(onUnexpectedError);
    });
    this.revertButton = this.createHeaderAction(headerActions, "sources-diff-panel-revert", localize("sourcesDiffPanel.revert", "Revert"), () => {
      void this.runGitAction(SOURCES_GIT_CLEAN_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
    });
    this.unstageButton = this.createHeaderAction(headerActions, "sources-diff-panel-unstage", localize("sourcesDiffPanel.unstage", "Unstage"), () => {
      void this.runGitAction(SOURCES_GIT_UNSTAGE_COMMAND).catch(onUnexpectedError).catch(onUnexpectedError);
    });
    this.unstageUnavailable = dom.append(headerActions, $("span.sources-diff-panel-unstage-unavailable"));
    this.unstageUnavailable.textContent = sourcesGitUnstageUnavailableMessage();
    this.unstageUnavailable.style.display = "none";
    this.newFileNoticeElement = dom.append(this.bodyContainer, $(".sources-diff-panel-new-file-notice"));
    this.newFileNoticeElement.style.display = "none";
    this.actionNoticeElement = dom.append(this.bodyContainer, $(".sources-diff-panel-action-notice"));
    this.actionNoticeElement.style.display = "none";
    this.editorContainer = dom.append(this.bodyContainer, $(".sources-diff-panel-editor"));
    const generation = this.sourcesDiffPanelService.getPendingRenderGeneration();
    if (generation !== void 0) {
      this.beginRender(this.currentRef, generation);
    }
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.dimension = new dom.Dimension(width, height);
    const headerHeight = this.headerElement?.offsetHeight ?? 0;
    const noticeHeight = this.newFileNoticeElement?.style.display === "none" ? 0 : this.newFileNoticeElement?.offsetHeight ?? 0;
    const actionNoticeHeight = this.actionNoticeElement?.style.display === "none" ? 0 : this.actionNoticeElement?.offsetHeight ?? 0;
    const editorHeight = Math.max(0, height - headerHeight - noticeHeight - actionNoticeHeight);
    const editorDimension = new dom.Dimension(width, editorHeight);
    this.diffWidget.value?.layout(editorDimension);
    this.codeWidget.value?.layout(editorDimension);
  }
  getDiffEditorOptions() {
    return {
      ...readOnlyEditorOptions,
      originalEditable: false,
      renderSideBySide: this.configurationService.getValue("diffEditor.renderSideBySide") ?? true,
      renderOverviewRuler: false
    };
  }
  beginRender(ref, generation) {
    if (this.activeRender?.generation === generation) {
      this.sourcesDiffPanelService.attachPendingRender(generation, this.activeRender.promise);
      return;
    }
    const promise = this.renderRef(ref, generation);
    this.activeRender = { generation, promise };
    this.sourcesDiffPanelService.attachPendingRender(generation, promise);
    promise.catch(onUnexpectedError).catch(onUnexpectedError);
  }
  async renderRef(ref, generation) {
    this.renderGeneration = generation;
    this.writeCollapse = sourcesDiffWriteCollapseFor(this.writeCollapse, ref?.modified);
    this.clearEditors();
    this.comparisonLoadFailed = false;
    if (!this.headerElement || !this.headerTitle || !this.newFileNoticeElement || !this.editorContainer) {
      this.settleRenderGeneration(generation);
      return;
    }
    this.hideActionNotice();
    this.hideWriteChrome();
    if (!ref) {
      this.headerTitle.textContent = "";
      this.headerTitle.title = "";
      this.headerElement.style.display = "none";
      this.newFileNoticeElement.style.display = "none";
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
        this.newFileNoticeElement.classList.remove("is-error");
        this.newFileNoticeElement.textContent = localize("sourcesDiffPanel.newFile", "New file with no previous version to compare.");
        this.newFileNoticeElement.style.display = "";
      }
    } else {
      this.newFileNoticeElement.style.display = "none";
      loaded = await this.renderDiff(ref.original, ref.modified, generation);
      if (generation !== this.renderGeneration) {
        return;
      }
    }
    if (!loaded) {
      this.comparisonLoadFailed = true;
      this.headerTitle.textContent = "";
      this.headerTitle.title = "";
      this.headerElement.style.display = "none";
      this.hideWriteChrome();
      this.showLoadNotice(sourcesDiffPanelComparisonLoadFailedMessage());
      if (this.dimension) {
        this.layoutBody(this.dimension.height, this.dimension.width);
      }
      this.settleRenderGeneration(generation);
      fireSourcesDiffLoad({ resource: ref.modified, generation, ok: false });
      return;
    }
    this.headerElement.style.display = "";
    this.headerTitle.textContent = basename(ref.modified);
    this.headerTitle.title = ref.modified.fsPath;
    this.settleRenderGeneration(generation);
    this.updateWriteActions();
    if (this.dimension) {
      this.layoutBody(this.dimension.height, this.dimension.width);
    }
    fireSourcesDiffLoad({ resource: ref.modified, generation, ok: true });
  }
  createHeaderAction(parent, className, label, onClick) {
    const button = dom.append(parent, $(`button.${className}`));
    button.type = "button";
    button.textContent = label;
    button.style.display = "none";
    button.addEventListener("click", onClick);
    return button;
  }
  getWriteContext() {
    const ref = this.currentRef;
    if (!ref) {
      return void 0;
    }
    return resolveSourcesDiffWriteGate(this.scmService, ref);
  }
  onWriteFactsChanged() {
    this.updateWriteActions();
    if (this.dimension) {
      this.layoutBody(this.dimension.height, this.dimension.width);
    }
  }
  getGitSessionId() {
    const snapshot = this.changesModel.getSnapshot();
    const modified = this.currentRef?.modified;
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
  hideWriteChrome() {
    if (!this.stageButton || !this.acceptButton || !this.revertButton || !this.unstageButton || !this.unstageUnavailable) {
      return;
    }
    this.stageButton.style.display = "none";
    this.acceptButton.style.display = "none";
    this.revertButton.style.display = "none";
    this.unstageButton.style.display = "none";
    this.unstageUnavailable.style.display = "none";
  }
  isRenderPending() {
    return this.renderSettledGeneration !== this.renderGeneration;
  }
  settleRenderGeneration(generation) {
    if (generation === this.renderGeneration) {
      this.renderSettledGeneration = generation;
    }
  }
  updateWriteActions() {
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
    this.stageButton.style.display = chrome.showStage ? "" : "none";
    this.acceptButton.style.display = chrome.showAccept ? "" : "none";
    this.revertButton.style.display = chrome.showRevert ? "" : "none";
    this.unstageButton.style.display = chrome.showUnstage ? "" : "none";
    this.unstageUnavailable.style.display = chrome.unstageUnavailable ? "" : "none";
    this.applyEmptyStagePathChrome(facts);
  }
  /** Empty engine identity: disable Stage and show status. The click path still must not send. */
  applyEmptyStagePathChrome(facts) {
    if (!this.stageButton) {
      return;
    }
    const emptyStage = resolveSourcesDiffEmptyStageChrome(facts);
    const stageLabel = localize("sourcesDiffPanel.stage", "Stage");
    this.stageButton.disabled = emptyStage.disableStage;
    this.stageButton.setAttribute("aria-disabled", emptyStage.disableStage ? "true" : "false");
    const emptyMessage = sourcesGitEmptyStagePathMessage();
    this.stageButton.title = emptyStage.disableStage ? emptyMessage : stageLabel;
    this.stageButton.setAttribute("aria-label", emptyStage.disableStage ? `${stageLabel}. ${emptyMessage}` : stageLabel);
    if (emptyStage.status) {
      this.showActionNotice(emptyStage.status);
      return;
    }
    if (this.actionNoticeElement?.textContent === emptyMessage) {
      this.hideActionNotice();
    }
  }
  currentWriteFacts() {
    const context = this.getWriteContext();
    const ref = this.currentRef;
    if (!context || !ref) {
      return void 0;
    }
    const fallbackSessionId = this.getGitSessionId();
    const pairingHold = this.session.isPairingHold();
    const readFailed = this.isReadFailed();
    const engineSessionReady = this.getEngineSessionReady();
    const pinnedSessionId = ref.sessionId ?? "";
    return {
      identity: {
        origin: ref.origin,
        sessionId: ref.sessionId,
        modified: ref.modified
      },
      changesSnapshotKind: this.changesModel.getSnapshot().state.kind,
      writeClosed: this.isSourcesDiffWriteHold(),
      activeSessionId: this.session.getActiveSessionId(),
      fallbackSessionId,
      groupId: context.groupId,
      path: context.path,
      scmResource: context.scmResource,
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
      hasApplyHunksPayload: canOfferSourcesGitAcceptHunk(ref.kind, ref.indexState) && context.path !== "" && hasSourcesGitSessionId(pinnedSessionId),
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
    const stagedRef = this.currentRef;
    const plan = planSourcesDiffStageAttempt(this.currentWriteFacts());
    if (plan.kind === "blocked") {
      return;
    }
    if (plan.kind === "notice") {
      this.showActionNotice(plan.message);
      this.updateWriteActions();
      return;
    }
    const generation = ++this._stageGeneration;
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
      if (generation !== this._stageGeneration || this._store.isDisposed || this.currentRef !== stagedRef) {
        return;
      }
      const facts = this.currentWriteFacts();
      if (!facts) {
        return;
      }
      const after = planSourcesDiffStageAfterAttempt(attempt, facts);
      if (after.kind === "collapse-stage") {
        this.writeCollapse = markSourcesDiffWriteCollapsed(facts.identity.modified, "stage");
        this.hideActionNotice();
        this.updateWriteActions();
        return;
      }
      if (after.kind === "clear-notice") {
        this.hideActionNotice();
        this.updateWriteActions();
        return;
      }
      if (after.kind === "notice") {
        this.showActionNotice(after.message);
        this.updateWriteActions();
        return;
      }
      if (after.kind === "local") {
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
      this.bodyDisposables.add(editor.onDidChangeCursorPosition(remember));
      this.bodyDisposables.add(editor.onDidFocusEditorText(remember));
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
    const stagedRef = this.currentRef;
    const plan = planSourcesDiffAcceptAttempt(this.currentWriteFacts());
    if (plan.kind === "blocked") {
      return;
    }
    if (plan.kind === "notice") {
      this.showActionNotice(plan.message);
      this.updateWriteActions();
      return;
    }
    const generation = this.renderGeneration;
    const isCurrent = () => !this._store.isDisposed && this.currentRef === stagedRef && generation === this.renderGeneration;
    const sessionId = stagedRef?.sessionId ?? "";
    const path = this.currentWriteFacts()?.path ?? "";
    const cursor = this.readAcceptCursor();
    if (!isCurrent() || !canOfferSourcesGitAcceptHunk(stagedRef?.kind, stagedRef?.indexState) || path === "" || sessionId === "" || !cursor) {
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
          this.showActionNotice(writePlan.message);
        }
        this.updateWriteActions();
        return;
      }
      if (writePlan.sessionId !== sessionId) {
        this.showActionNotice(sourcesGitSessionChangedMessage());
        this.updateWriteActions();
        return;
      }
      if (!beforeWriteFacts?.canWriteAccept) {
        this.updateWriteActions();
        return;
      }
      const patch = read?.supported ? sourcesGitHunkPatchAtCursor(read.unifiedDiff, cursor.line, cursor.side) : void 0;
      if (!patch || !hasSourcesGitApplyHunksPayload(sessionId, [patch])) {
        this.showActionNotice(sourcesDiffAcceptUnavailableMessage());
        this.updateWriteActions();
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
        this.hideActionNotice();
        this.changesModel.scheduleRefresh();
        this.updateWriteActions();
        return;
      }
      if (after.kind === "notice") {
        this.showActionNotice(after.message);
        this.updateWriteActions();
        return;
      }
      this.updateWriteActions();
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      this.showActionNotice(getErrorMessage(error));
      this.updateWriteActions();
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
  showActionNotice(message) {
    if (!this.actionNoticeElement) {
      return;
    }
    this.actionNoticeElement.textContent = message;
    this.actionNoticeElement.classList.add("is-error");
    this.actionNoticeElement.style.display = "";
  }
  hideActionNotice() {
    if (!this.actionNoticeElement) {
      return;
    }
    this.actionNoticeElement.textContent = "";
    this.actionNoticeElement.classList.remove("is-error");
    this.actionNoticeElement.style.display = "none";
  }
  showLoadNotice(message) {
    if (!this.newFileNoticeElement) {
      return;
    }
    this.newFileNoticeElement.textContent = message;
    this.newFileNoticeElement.classList.add("is-error");
    this.newFileNoticeElement.style.display = "";
  }
  async renderDiff(original, modified, generation) {
    if (!this.editorContainer || this._store.isDisposed) {
      return false;
    }
    const isCurrent = () => !this._store.isDisposed && generation === this.renderGeneration;
    let originalRef;
    let modifiedRef;
    let editorModel;
    let widget;
    let viewModel;
    let installedWidget;
    const local = new DisposableStore();
    local.add(toDisposable(() => {
      widget?.setModel(null);
      widget?.dispose();
      viewModel?.dispose();
      editorModel?.dispose();
      originalRef?.dispose();
      modifiedRef?.dispose();
    }));
    try {
      originalRef = await this.textModelService.createModelReference(original);
      if (!isCurrent()) {
        return false;
      }
      modifiedRef = await this.textModelService.createModelReference(modified);
      if (!isCurrent()) {
        return false;
      }
      editorModel = new SourcesDiffEditorModel(originalRef, modifiedRef);
      originalRef = void 0;
      modifiedRef = void 0;
      widget = this.instantiationService.createInstance(DiffEditorWidget, this.editorContainer, this.getDiffEditorOptions(), {});
      if (!isCurrent()) {
        return false;
      }
      viewModel = widget.createViewModel(editorModel);
      if (!isCurrent()) {
        return false;
      }
      widget.setModel(viewModel);
      if (this.dimension) {
        const headerHeight = this.headerElement?.offsetHeight ?? 0;
        widget.layout(new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - headerHeight)));
      }
      if (!isCurrent()) {
        return false;
      }
      this.model.value = editorModel;
      editorModel = void 0;
      this.diffViewModel.value = viewModel;
      viewModel = void 0;
      this.diffWidget.value = installedWidget = widget;
      widget = void 0;
      this.bindAcceptCursor(installedWidget);
      return true;
    } catch {
      if (isCurrent() && installedWidget && this.diffWidget.value === installedWidget) {
        this.clearEditors();
      }
      return false;
    } finally {
      local.dispose();
    }
  }
  async renderModifiedOnly(modified, generation) {
    if (!this.editorContainer || this._store.isDisposed) {
      return false;
    }
    const isCurrent = () => !this._store.isDisposed && generation === this.renderGeneration;
    let modifiedRef;
    let widget;
    let installedWidget;
    const local = new DisposableStore();
    local.add(toDisposable(() => {
      widget?.setModel(null);
      widget?.dispose();
      modifiedRef?.dispose();
    }));
    try {
      modifiedRef = await this.textModelService.createModelReference(modified);
      if (!isCurrent()) {
        return false;
      }
      widget = this.instantiationService.createInstance(CodeEditorWidget, this.editorContainer, readOnlyEditorOptions, { isSimpleWidget: true });
      widget.setModel(modifiedRef.object.textEditorModel);
      if (this.dimension) {
        const headerHeight = this.headerElement?.offsetHeight ?? 0;
        const noticeHeight = this.newFileNoticeElement?.offsetHeight ?? 0;
        widget.layout(new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - headerHeight - noticeHeight)));
      }
      if (!isCurrent()) {
        return false;
      }
      this.modifiedModelRef.value = modifiedRef;
      modifiedRef = void 0;
      this.codeWidget.value = installedWidget = widget;
      widget = void 0;
      return true;
    } catch {
      if (isCurrent() && installedWidget && this.codeWidget.value === installedWidget) {
        this.clearEditors();
      }
      return false;
    } finally {
      local.dispose();
    }
  }
  clearEditors() {
    this.bodyDisposables.clear();
    this.acceptCursor = void 0;
    this.diffWidget.value?.setModel(null);
    this.codeWidget.value?.setModel(null);
    this.diffWidget.clear();
    this.codeWidget.clear();
    this.diffViewModel.clear();
    this.model.clear();
    this.modifiedModelRef.clear();
  }
};
SourcesDiffPanelView.ID = SOURCES_DIFF_PANEL_VIEW_ID;
SourcesDiffPanelView = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService),
  __decorateParam(10, ITextModelService),
  __decorateParam(11, ISourcesDiffPanelService),
  __decorateParam(12, ICommandService),
  __decorateParam(13, ISCMService),
  __decorateParam(14, IUniverseAgentConnection),
  __decorateParam(15, IAgentSessionContext),
  __decorateParam(16, ISourcesChangesModel)
], SourcesDiffPanelView);
export {
  SourcesDiffPanelView,
  sourcesDiffPanelComparisonLoadFailedMessage
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL3NvdXJjZXMvYnJvd3Nlci9zb3VyY2VzRGlmZlBhbmVsVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9zb3VyY2VzRGlmZlBhbmVsLmNzcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElSZWZlcmVuY2UsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElEaWZmRWRpdG9yQ29uc3RydWN0aW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2RpZmZFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElEaWZmRWRpdG9yVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkVGV4dEVkaXRvck1vZGVsLCBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldEVycm9yTWVzc2FnZSwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi91bml2ZXJzZUFnZW50Q29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZSwgSVZpZXdQYW5lT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgY29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzc1Byb2JlLCBnZXRDb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzIH0gZnJvbSAnLi4vLi4vY29udmVyc2F0aW9uL2NvbW1vbi9jb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzLmpzJztcbmltcG9ydCB7IElBZ2VudFNlc3Npb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYWdlbnRTZXNzaW9uL2NvbW1vbi9hZ2VudFNlc3Npb25Db250ZXh0LmpzJztcbmltcG9ydCB7IElTQ01SZXNvdXJjZSwgSVNDTVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zY20vY29tbW9uL3NjbS5qcyc7XG5pbXBvcnQgeyBJU291cmNlc0NoYW5nZVJlZiwgcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVHYXRlIH0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VSZWYuanMnO1xuaW1wb3J0IHtcblx0U09VUkNFU19HSVRfQ0xFQU5fQ09NTUFORCxcblx0U09VUkNFU19HSVRfU1RBR0VfQ09NTUFORCxcblx0U09VUkNFU19HSVRfVU5TVEFHRV9DT01NQU5ELFxufSBmcm9tICcuLi9jb21tb24vc291cmNlc0NoYW5nZXNHaXQuanMnO1xuaW1wb3J0IHsgdHJ5UmVhZFNvdXJjZXNHaXRGaWxlRGlmZiB9IGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzQ2hhbmdlc0dpdFJlYWQuanMnO1xuaW1wb3J0IHtcblx0YXR0ZW1wdFNvdXJjZXNHaXRXcml0ZSxcblx0Y2FuU2VuZFNvdXJjZXNHaXRBcHBseUh1bmtzLFxuXHRjYW5TZW5kU291cmNlc0dpdFN0YWdlUGF0aHMsXG5cdHNvdXJjZXNHaXRXcml0ZUhvb2tQcmVzZW50LFxuXHRoYXNTb3VyY2VzR2l0QXBwbHlIdW5rc1BheWxvYWQsXG5cdGhhc1NvdXJjZXNHaXRTZXNzaW9uSWQsXG5cdGlzU291cmNlc0tlZXBMZWZ0b3ZlcldyaXRlLFxuXHRzb3VyY2VzR2l0RW1wdHlTdGFnZVBhdGhNZXNzYWdlLFxuXHRzb3VyY2VzR2l0U2Vzc2lvbkNoYW5nZWRNZXNzYWdlLFxuXHRzb3VyY2VzR2l0VW5zdGFnZVVuYXZhaWxhYmxlTWVzc2FnZSxcblx0dHJ5V3JpdGVTb3VyY2VzR2l0QXBwbHlIdW5rcyxcblx0dHJ5V3JpdGVTb3VyY2VzR2l0U3RhZ2VQYXRocyxcbn0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzR2l0V3JpdGUuanMnO1xuaW1wb3J0IHtcblx0Y2FuT2ZmZXJTb3VyY2VzR2l0QWNjZXB0SHVuayxcblx0dHlwZSBJU291cmNlc0dpdEFjY2VwdEN1cnNvcixcblx0cmVtZW1iZXJTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yLFxuXHRTT1VSQ0VTX0dJVF9BQ0NFUFRfRklMRV9ESUZGX0lOREVYX1NUQVRFLFxuXHRTT1VSQ0VTX0dJVF9BUFBMWV9DQUNIRURfQVJHVixcblx0c291cmNlc0dpdEFjY2VwdEN1cnNvckZyb21FZGl0b3JzLFxuXHRzb3VyY2VzR2l0SHVua1BhdGNoQXRDdXJzb3IsXG59IGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzR2l0SHVua1BhdGNoLmpzJztcbmltcG9ydCB7IElTb3VyY2VzQ2hhbmdlc01vZGVsLCBpc1NvdXJjZXNDaGFuZ2VzUmVhZEZhaWxlZCwgc291cmNlc0NoYW5nZXNXcml0ZVNlc3Npb25JZCB9IGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzQ2hhbmdlc01vZGVsLmpzJztcbmltcG9ydCB7XG5cdElTb3VyY2VzRGlmZldyaXRlQ29sbGFwc2UsXG5cdElTb3VyY2VzRGlmZldyaXRlRmFjdHMsXG5cdG1hcmtTb3VyY2VzRGlmZldyaXRlQ29sbGFwc2VkLFxuXHRwbGFuU291cmNlc0RpZmZBY2NlcHRBZnRlckF0dGVtcHQsXG5cdHBsYW5Tb3VyY2VzRGlmZkFjY2VwdEF0dGVtcHQsXG5cdHBsYW5Tb3VyY2VzRGlmZkxvY2FsR2l0QWN0aW9uLFxuXHRwbGFuU291cmNlc0RpZmZTdGFnZUFmdGVyQXR0ZW1wdCxcblx0cGxhblNvdXJjZXNEaWZmU3RhZ2VBdHRlbXB0LFxuXHRyZXNvbHZlU291cmNlc0RpZmZFbXB0eVN0YWdlQ2hyb21lLFxuXHRyZXNvbHZlU291cmNlc0RpZmZXcml0ZUNvbnRyb2xsZXJDaHJvbWUsXG5cdHNvdXJjZXNEaWZmQWNjZXB0VW5hdmFpbGFibGVNZXNzYWdlLFxuXHRzb3VyY2VzRGlmZldyaXRlQ29sbGFwc2VGb3IsXG59IGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzRGlmZldyaXRlQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc291cmNlc0RpZmZQYW5lbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYWxsb2NhdGVTb3VyY2VzRGlmZkxvYWRHZW5lcmF0aW9uLCBmaXJlU291cmNlc0RpZmZMb2FkIH0gZnJvbSAnLi9zb3VyY2VzRGlmZkxvYWRTaWduYWwuanMnO1xuaW1wb3J0IHsgU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQgfSBmcm9tICcuL3NvdXJjZXNEaWZmUGFuZWxJZHMuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBzb3VyY2VzRGlmZlBhbmVsQ29tcGFyaXNvbkxvYWRGYWlsZWRNZXNzYWdlKCk6IHN0cmluZyB7XG5cdHJldHVybiBsb2NhbGl6ZSgnc291cmNlc0RpZmZQYW5lbC5sb2FkRmFpbGVkJywgXCJVbmFibGUgdG8gbG9hZCB0aGlzIGNvbXBhcmlzb24uXCIpO1xufVxuXG5jbGFzcyBTb3VyY2VzRGlmZkVkaXRvck1vZGVsIGV4dGVuZHMgRWRpdG9yTW9kZWwge1xuXHRyZWFkb25seSBvcmlnaW5hbDogSVRleHRNb2RlbDtcblx0cmVhZG9ubHkgbW9kaWZpZWQ6IElUZXh0TW9kZWw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBvcmlnaW5hbFJlZjogSVJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbW9kaWZpZWRSZWY6IElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPixcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLm9yaWdpbmFsID0gb3JpZ2luYWxSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblx0XHR0aGlzLm1vZGlmaWVkID0gbW9kaWZpZWRSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMub3JpZ2luYWxSZWYuZGlzcG9zZSgpO1xuXHRcdHRoaXMubW9kaWZpZWRSZWYuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNvbnN0IHJlYWRPbmx5RWRpdG9yT3B0aW9uczogSUVkaXRvck9wdGlvbnMgPSB7XG5cdHJlYWRPbmx5OiB0cnVlLFxuXHRzY3JvbGxCZXlvbmRMYXN0TGluZTogZmFsc2UsXG5cdG1pbmltYXA6IHsgZW5hYmxlZDogZmFsc2UgfSxcblx0YXV0b21hdGljTGF5b3V0OiBmYWxzZSxcblx0bGluZU51bWJlcnM6ICdvbicsXG59O1xuXG5leHBvcnQgY2xhc3MgU291cmNlc0RpZmZQYW5lbFZpZXcgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBib2R5RGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpZmZXaWRnZXQgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8RGlmZkVkaXRvcldpZGdldD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlmZlZpZXdNb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJRGlmZkVkaXRvclZpZXdNb2RlbD4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgY29kZVdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxDb2RlRWRpdG9yV2lkZ2V0PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBtb2RlbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxTb3VyY2VzRGlmZkVkaXRvck1vZGVsPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBtb2RpZmllZE1vZGVsUmVmID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPj4oKSk7XG5cblx0cHJpdmF0ZSBib2R5Q29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBlZGl0b3JDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGhlYWRlckVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGhlYWRlclRpdGxlOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzdGFnZUJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYWNjZXB0QnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZXZlcnRCdXR0b246IEhUTUxCdXR0b25FbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHVuc3RhZ2VCdXR0b246IEhUTUxCdXR0b25FbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHVuc3RhZ2VVbmF2YWlsYWJsZTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbmV3RmlsZU5vdGljZUVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGFjdGlvbk5vdGljZUVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGRpbWVuc2lvbjogZG9tLkRpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjdXJyZW50UmVmOiBJU291cmNlc0NoYW5nZVJlZiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBjb21wYXJpc29uTG9hZEZhaWxlZCA9IGZhbHNlO1xuXHRwcml2YXRlIHJlbmRlckdlbmVyYXRpb24gPSAwO1xuXHRwcml2YXRlIHJlbmRlclNldHRsZWRHZW5lcmF0aW9uID0gMDtcblx0cHJpdmF0ZSBfc3RhZ2VHZW5lcmF0aW9uID0gMDtcblx0cHJpdmF0ZSBhY3RpdmVSZW5kZXI6IHsgZ2VuZXJhdGlvbjogbnVtYmVyOyBwcm9taXNlOiBQcm9taXNlPHZvaWQ+IH0gfCB1bmRlZmluZWQ7XG5cdC8qKiBSZXZlcnQgLyBVbnN0YWdlIC8gZW5naW5lIFN0YWdlIGhpZGUuIENsZWFyZWQgd2hlbiB0aGUgbW9kaWZpZWQgVVJJIGNoYW5nZXMuICovXG5cdHByaXZhdGUgd3JpdGVDb2xsYXBzZTogSVNvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZSB8IHVuZGVmaW5lZDtcblx0LyoqIExhc3QgZGlmZiBjdXJzb3Igc2lkZSBhbmQgbGluZS4gRWRpdG9yIHRleHQgaXMgbm90IHN0b3JlZC4gKi9cblx0cHJpdmF0ZSBhY2NlcHRDdXJzb3I6IElTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3UGFuZU9wdGlvbnMsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlOiBJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElTQ01TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2NtU2VydmljZTogSVNDTVNlcnZpY2UsXG5cdFx0QElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiBwcml2YXRlIHJlYWRvbmx5IHVhQ29ubmVjdGlvbjogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uLFxuXHRcdEBJQWdlbnRTZXNzaW9uQ29udGV4dCBwcml2YXRlIHJlYWRvbmx5IHNlc3Npb246IElBZ2VudFNlc3Npb25Db250ZXh0LFxuXHRcdEBJU291cmNlc0NoYW5nZXNNb2RlbCBwcml2YXRlIHJlYWRvbmx5IGNoYW5nZXNNb2RlbDogSVNvdXJjZXNDaGFuZ2VzTW9kZWwsXG5cdCkge1xuXHRcdHN1cGVyKG9wdGlvbnMsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzb3VyY2VzLWRpZmYtcGFuZWwnKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc291cmNlc0RpZmZQYW5lbFNlcnZpY2Uub25EaWRDaGFuZ2VSZWYocmVmID0+IHtcblx0XHRcdHRoaXMuY3VycmVudFJlZiA9IHJlZjtcblx0XHRcdGlmICghdGhpcy5ib2R5Q29udGFpbmVyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGdlbmVyYXRpb24gPSByZWZcblx0XHRcdFx0PyB0aGlzLnNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLmdldFBlbmRpbmdSZW5kZXJHZW5lcmF0aW9uKClcblx0XHRcdFx0OiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMuYmVnaW5SZW5kZXIocmVmLCBnZW5lcmF0aW9uKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFyZWYpIHtcblx0XHRcdFx0dGhpcy5iZWdpblJlbmRlcih1bmRlZmluZWQsIGFsbG9jYXRlU291cmNlc0RpZmZMb2FkR2VuZXJhdGlvbigpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51YUNvbm5lY3Rpb24ub25EaWRDaGFuZ2VDb25uZWN0aW9uKCgpID0+IHRoaXMub25Xcml0ZUZhY3RzQ2hhbmdlZCgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXNzaW9uLm9uRGlkQ2hhbmdlQWN0aXZlU2Vzc2lvbigoKSA9PiB0aGlzLm9uV3JpdGVGYWN0c0NoYW5nZWQoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc2Vzc2lvbi5vbkRpZENoYW5nZVNlc3Npb24oKCkgPT4gdGhpcy5vbldyaXRlRmFjdHNDaGFuZ2VkKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYW5nZXNNb2RlbC5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLm9uV3JpdGVGYWN0c0NoYW5nZWQoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZGlmZkVkaXRvci5yZW5kZXJTaWRlQnlTaWRlJykgJiYgdGhpcy5kaWZmV2lkZ2V0LnZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuZGlmZldpZGdldC52YWx1ZS51cGRhdGVPcHRpb25zKHRoaXMuZ2V0RGlmZkVkaXRvck9wdGlvbnMoKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5jdXJyZW50UmVmID0gdGhpcy5zb3VyY2VzRGlmZlBhbmVsU2VydmljZS5nZXRDdXJyZW50UmVmKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMucmVuZGVyR2VuZXJhdGlvbiA9IGFsbG9jYXRlU291cmNlc0RpZmZMb2FkR2VuZXJhdGlvbigpO1xuXHRcdHRoaXMuY2xlYXJFZGl0b3JzKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckJvZHkoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlckJvZHkoY29udGFpbmVyKTtcblxuXHRcdHRoaXMuYm9keUNvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcuc291cmNlcy1kaWZmLXBhbmVsLWJvZHknKSk7XG5cdFx0dGhpcy5oZWFkZXJFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmJvZHlDb250YWluZXIsICQoJy5zb3VyY2VzLWRpZmYtcGFuZWwtaGVhZGVyJykpO1xuXHRcdHRoaXMuaGVhZGVyVGl0bGUgPSBkb20uYXBwZW5kKHRoaXMuaGVhZGVyRWxlbWVudCwgJCgnLnNvdXJjZXMtZGlmZi1wYW5lbC10aXRsZScpKTtcblx0XHRjb25zdCBoZWFkZXJBY3Rpb25zID0gZG9tLmFwcGVuZCh0aGlzLmhlYWRlckVsZW1lbnQsICQoJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWN0aW9ucycpKTtcblxuXHRcdHRoaXMuc3RhZ2VCdXR0b24gPSB0aGlzLmNyZWF0ZUhlYWRlckFjdGlvbihoZWFkZXJBY3Rpb25zLCAnc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJywgbG9jYWxpemUoJ3NvdXJjZXNEaWZmUGFuZWwuc3RhZ2UnLCBcIlN0YWdlXCIpLCAoKSA9PiB7XG5cdFx0XHR2b2lkIHRoaXMucnVuU3RhZ2UoKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdH0pO1xuXHRcdHRoaXMuYWNjZXB0QnV0dG9uID0gdGhpcy5jcmVhdGVIZWFkZXJBY3Rpb24oaGVhZGVyQWN0aW9ucywgJ3NvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnLCBsb2NhbGl6ZSgnc291cmNlc0RpZmZQYW5lbC5hY2NlcHQnLCBcIkFjY2VwdFwiKSwgKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLnJ1bkFjY2VwdCgpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0fSk7XG5cdFx0dGhpcy5yZXZlcnRCdXR0b24gPSB0aGlzLmNyZWF0ZUhlYWRlckFjdGlvbihoZWFkZXJBY3Rpb25zLCAnc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcsIGxvY2FsaXplKCdzb3VyY2VzRGlmZlBhbmVsLnJldmVydCcsIFwiUmV2ZXJ0XCIpLCAoKSA9PiB7XG5cdFx0XHR2b2lkIHRoaXMucnVuR2l0QWN0aW9uKFNPVVJDRVNfR0lUX0NMRUFOX0NPTU1BTkQpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0fSk7XG5cdFx0dGhpcy51bnN0YWdlQnV0dG9uID0gdGhpcy5jcmVhdGVIZWFkZXJBY3Rpb24oaGVhZGVyQWN0aW9ucywgJ3NvdXJjZXMtZGlmZi1wYW5lbC11bnN0YWdlJywgbG9jYWxpemUoJ3NvdXJjZXNEaWZmUGFuZWwudW5zdGFnZScsIFwiVW5zdGFnZVwiKSwgKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLnJ1bkdpdEFjdGlvbihTT1VSQ0VTX0dJVF9VTlNUQUdFX0NPTU1BTkQpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0fSk7XG5cdFx0dGhpcy51bnN0YWdlVW5hdmFpbGFibGUgPSBkb20uYXBwZW5kKGhlYWRlckFjdGlvbnMsICQoJ3NwYW4uc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UtdW5hdmFpbGFibGUnKSk7XG5cdFx0dGhpcy51bnN0YWdlVW5hdmFpbGFibGUudGV4dENvbnRlbnQgPSBzb3VyY2VzR2l0VW5zdGFnZVVuYXZhaWxhYmxlTWVzc2FnZSgpO1xuXHRcdHRoaXMudW5zdGFnZVVuYXZhaWxhYmxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cblx0XHR0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmJvZHlDb250YWluZXIsICQoJy5zb3VyY2VzLWRpZmYtcGFuZWwtbmV3LWZpbGUtbm90aWNlJykpO1xuXHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuYm9keUNvbnRhaW5lciwgJCgnLnNvdXJjZXMtZGlmZi1wYW5lbC1hY3Rpb24tbm90aWNlJykpO1xuXHRcdHRoaXMuYWN0aW9uTm90aWNlRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMuZWRpdG9yQ29udGFpbmVyID0gZG9tLmFwcGVuZCh0aGlzLmJvZHlDb250YWluZXIsICQoJy5zb3VyY2VzLWRpZmYtcGFuZWwtZWRpdG9yJykpO1xuXG5cdFx0Y29uc3QgZ2VuZXJhdGlvbiA9IHRoaXMuc291cmNlc0RpZmZQYW5lbFNlcnZpY2UuZ2V0UGVuZGluZ1JlbmRlckdlbmVyYXRpb24oKTtcblx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmJlZ2luUmVuZGVyKHRoaXMuY3VycmVudFJlZiwgZ2VuZXJhdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMuZGltZW5zaW9uID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGgsIGhlaWdodCk7XG5cblx0XHRjb25zdCBoZWFkZXJIZWlnaHQgPSB0aGlzLmhlYWRlckVsZW1lbnQ/Lm9mZnNldEhlaWdodCA/PyAwO1xuXHRcdGNvbnN0IG5vdGljZUhlaWdodCA9IHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQ/LnN0eWxlLmRpc3BsYXkgPT09ICdub25lJyA/IDAgOiAodGhpcy5uZXdGaWxlTm90aWNlRWxlbWVudD8ub2Zmc2V0SGVpZ2h0ID8/IDApO1xuXHRcdGNvbnN0IGFjdGlvbk5vdGljZUhlaWdodCA9IHRoaXMuYWN0aW9uTm90aWNlRWxlbWVudD8uc3R5bGUuZGlzcGxheSA9PT0gJ25vbmUnID8gMCA6ICh0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQ/Lm9mZnNldEhlaWdodCA/PyAwKTtcblx0XHRjb25zdCBlZGl0b3JIZWlnaHQgPSBNYXRoLm1heCgwLCBoZWlnaHQgLSBoZWFkZXJIZWlnaHQgLSBub3RpY2VIZWlnaHQgLSBhY3Rpb25Ob3RpY2VIZWlnaHQpO1xuXHRcdGNvbnN0IGVkaXRvckRpbWVuc2lvbiA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBlZGl0b3JIZWlnaHQpO1xuXG5cdFx0dGhpcy5kaWZmV2lkZ2V0LnZhbHVlPy5sYXlvdXQoZWRpdG9yRGltZW5zaW9uKTtcblx0XHR0aGlzLmNvZGVXaWRnZXQudmFsdWU/LmxheW91dChlZGl0b3JEaW1lbnNpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREaWZmRWRpdG9yT3B0aW9ucygpOiBJRGlmZkVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMge1xuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5yZWFkT25seUVkaXRvck9wdGlvbnMsXG5cdFx0XHRvcmlnaW5hbEVkaXRhYmxlOiBmYWxzZSxcblx0XHRcdHJlbmRlclNpZGVCeVNpZGU6IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2RpZmZFZGl0b3IucmVuZGVyU2lkZUJ5U2lkZScpID8/IHRydWUsXG5cdFx0XHRyZW5kZXJPdmVydmlld1J1bGVyOiBmYWxzZSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBiZWdpblJlbmRlcihyZWY6IElTb3VyY2VzQ2hhbmdlUmVmIHwgdW5kZWZpbmVkLCBnZW5lcmF0aW9uOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5hY3RpdmVSZW5kZXI/LmdlbmVyYXRpb24gPT09IGdlbmVyYXRpb24pIHtcblx0XHRcdHRoaXMuc291cmNlc0RpZmZQYW5lbFNlcnZpY2UuYXR0YWNoUGVuZGluZ1JlbmRlcihnZW5lcmF0aW9uLCB0aGlzLmFjdGl2ZVJlbmRlci5wcm9taXNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcHJvbWlzZSA9IHRoaXMucmVuZGVyUmVmKHJlZiwgZ2VuZXJhdGlvbik7XG5cdFx0dGhpcy5hY3RpdmVSZW5kZXIgPSB7IGdlbmVyYXRpb24sIHByb21pc2UgfTtcblx0XHR0aGlzLnNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLmF0dGFjaFBlbmRpbmdSZW5kZXIoZ2VuZXJhdGlvbiwgcHJvbWlzZSk7XG5cdFx0cHJvbWlzZS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZW5kZXJSZWYocmVmOiBJU291cmNlc0NoYW5nZVJlZiB8IHVuZGVmaW5lZCwgZ2VuZXJhdGlvbjogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5yZW5kZXJHZW5lcmF0aW9uID0gZ2VuZXJhdGlvbjtcblx0XHR0aGlzLndyaXRlQ29sbGFwc2UgPSBzb3VyY2VzRGlmZldyaXRlQ29sbGFwc2VGb3IodGhpcy53cml0ZUNvbGxhcHNlLCByZWY/Lm1vZGlmaWVkKTtcblx0XHR0aGlzLmNsZWFyRWRpdG9ycygpO1xuXHRcdHRoaXMuY29tcGFyaXNvbkxvYWRGYWlsZWQgPSBmYWxzZTtcblxuXHRcdGlmICghdGhpcy5oZWFkZXJFbGVtZW50IHx8ICF0aGlzLmhlYWRlclRpdGxlIHx8ICF0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50IHx8ICF0aGlzLmVkaXRvckNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5zZXR0bGVSZW5kZXJHZW5lcmF0aW9uKGdlbmVyYXRpb24pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlkZUFjdGlvbk5vdGljZSgpO1xuXHRcdHRoaXMuaGlkZVdyaXRlQ2hyb21lKCk7XG5cblx0XHRpZiAoIXJlZikge1xuXHRcdFx0dGhpcy5oZWFkZXJUaXRsZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0dGhpcy5oZWFkZXJUaXRsZS50aXRsZSA9ICcnO1xuXHRcdFx0dGhpcy5oZWFkZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLnNldHRsZVJlbmRlckdlbmVyYXRpb24oZ2VuZXJhdGlvbik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGxvYWRlZCA9IGZhbHNlO1xuXHRcdGlmICghcmVmLm9yaWdpbmFsKSB7XG5cdFx0XHRsb2FkZWQgPSBhd2FpdCB0aGlzLnJlbmRlck1vZGlmaWVkT25seShyZWYubW9kaWZpZWQsIGdlbmVyYXRpb24pO1xuXHRcdFx0aWYgKGdlbmVyYXRpb24gIT09IHRoaXMucmVuZGVyR2VuZXJhdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAobG9hZGVkKSB7XG5cdFx0XHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaXMtZXJyb3InKTtcblx0XHRcdFx0dGhpcy5uZXdGaWxlTm90aWNlRWxlbWVudC50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdzb3VyY2VzRGlmZlBhbmVsLm5ld0ZpbGUnLCBcIk5ldyBmaWxlIHdpdGggbm8gcHJldmlvdXMgdmVyc2lvbiB0byBjb21wYXJlLlwiKTtcblx0XHRcdFx0dGhpcy5uZXdGaWxlTm90aWNlRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdGxvYWRlZCA9IGF3YWl0IHRoaXMucmVuZGVyRGlmZihyZWYub3JpZ2luYWwsIHJlZi5tb2RpZmllZCwgZ2VuZXJhdGlvbik7XG5cdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gdGhpcy5yZW5kZXJHZW5lcmF0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWxvYWRlZCkge1xuXHRcdFx0dGhpcy5jb21wYXJpc29uTG9hZEZhaWxlZCA9IHRydWU7XG5cdFx0XHR0aGlzLmhlYWRlclRpdGxlLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHR0aGlzLmhlYWRlclRpdGxlLnRpdGxlID0gJyc7XG5cdFx0XHR0aGlzLmhlYWRlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdHRoaXMuaGlkZVdyaXRlQ2hyb21lKCk7XG5cdFx0XHR0aGlzLnNob3dMb2FkTm90aWNlKHNvdXJjZXNEaWZmUGFuZWxDb21wYXJpc29uTG9hZEZhaWxlZE1lc3NhZ2UoKSk7XG5cdFx0XHRpZiAodGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdFx0dGhpcy5sYXlvdXRCb2R5KHRoaXMuZGltZW5zaW9uLmhlaWdodCwgdGhpcy5kaW1lbnNpb24ud2lkdGgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zZXR0bGVSZW5kZXJHZW5lcmF0aW9uKGdlbmVyYXRpb24pO1xuXHRcdFx0ZmlyZVNvdXJjZXNEaWZmTG9hZCh7IHJlc291cmNlOiByZWYubW9kaWZpZWQsIGdlbmVyYXRpb24sIG9rOiBmYWxzZSB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmhlYWRlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICcnO1xuXHRcdHRoaXMuaGVhZGVyVGl0bGUudGV4dENvbnRlbnQgPSBiYXNlbmFtZShyZWYubW9kaWZpZWQpO1xuXHRcdHRoaXMuaGVhZGVyVGl0bGUudGl0bGUgPSByZWYubW9kaWZpZWQuZnNQYXRoO1xuXG5cdFx0dGhpcy5zZXR0bGVSZW5kZXJHZW5lcmF0aW9uKGdlbmVyYXRpb24pO1xuXHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0aWYgKHRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHR0aGlzLmxheW91dEJvZHkodGhpcy5kaW1lbnNpb24uaGVpZ2h0LCB0aGlzLmRpbWVuc2lvbi53aWR0aCk7XG5cdFx0fVxuXHRcdGZpcmVTb3VyY2VzRGlmZkxvYWQoeyByZXNvdXJjZTogcmVmLm1vZGlmaWVkLCBnZW5lcmF0aW9uLCBvazogdHJ1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlSGVhZGVyQWN0aW9uKHBhcmVudDogSFRNTEVsZW1lbnQsIGNsYXNzTmFtZTogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBvbkNsaWNrOiAoKSA9PiB2b2lkKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuXHRcdGNvbnN0IGJ1dHRvbiA9IGRvbS5hcHBlbmQocGFyZW50LCAkKGBidXR0b24uJHtjbGFzc05hbWV9YCkpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG5cdFx0YnV0dG9uLnRleHRDb250ZW50ID0gbGFiZWw7XG5cdFx0YnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0YnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25DbGljayk7XG5cdFx0cmV0dXJuIGJ1dHRvbjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0V3JpdGVDb250ZXh0KCk6IHsgZ3JvdXBJZDogc3RyaW5nOyBzY21SZXNvdXJjZTogSVNDTVJlc291cmNlIHwgdW5kZWZpbmVkOyBwYXRoOiBzdHJpbmcgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVmID0gdGhpcy5jdXJyZW50UmVmO1xuXHRcdGlmICghcmVmKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVHYXRlKHRoaXMuc2NtU2VydmljZSwgcmVmKTtcblx0fVxuXG5cdHByaXZhdGUgb25Xcml0ZUZhY3RzQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdGlmICh0aGlzLmRpbWVuc2lvbikge1xuXHRcdFx0dGhpcy5sYXlvdXRCb2R5KHRoaXMuZGltZW5zaW9uLmhlaWdodCwgdGhpcy5kaW1lbnNpb24ud2lkdGgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0R2l0U2Vzc2lvbklkKCk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgc25hcHNob3QgPSB0aGlzLmNoYW5nZXNNb2RlbC5nZXRTbmFwc2hvdCgpO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gdGhpcy5jdXJyZW50UmVmPy5tb2RpZmllZDtcblx0XHRjb25zdCBtYXRjaGVzID0gbW9kaWZpZWRcblx0XHRcdD8gc25hcHNob3QuZW50cmllcy5maWx0ZXIoZW50cnkgPT4gZW50cnkucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gbW9kaWZpZWQudG9TdHJpbmcoKSlcblx0XHRcdDogdW5kZWZpbmVkO1xuXHRcdHJldHVybiBzb3VyY2VzQ2hhbmdlc1dyaXRlU2Vzc2lvbklkKHNuYXBzaG90LCBtYXRjaGVzLCB0aGlzLnNlc3Npb24uZ2V0QWN0aXZlU2Vzc2lvbklkKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRFbmdpbmVTZXNzaW9uUmVhZHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MoY29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzc1Byb2JlKHRoaXMuc2Vzc2lvbikpID09PSAncmVhZHknO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1JlYWRGYWlsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlzU291cmNlc0NoYW5nZXNSZWFkRmFpbGVkKHRoaXMuY2hhbmdlc01vZGVsLmdldFNuYXBzaG90KCkuc3RhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1NvdXJjZXNLZWVwTGVmdG92ZXJXcml0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXNTb3VyY2VzS2VlcExlZnRvdmVyV3JpdGUoXG5cdFx0XHR0aGlzLnVhQ29ubmVjdGlvbi5pc0VuZ2luZUNvbm5lY3RlZCgpLFxuXHRcdFx0ISF0aGlzLnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3Q/LigpLnBhaXJpbmdQZW5kaW5nLFxuXHRcdFx0dGhpcy5nZXRFbmdpbmVTZXNzaW9uUmVhZHkoKSxcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1NvdXJjZXNEaWZmV3JpdGVIb2xkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNoYW5nZXNNb2RlbC5pc1dyaXRlQ2xvc2VkKCk7XG5cdH1cblxuXHRwcml2YXRlIGhpZGVXcml0ZUNocm9tZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuc3RhZ2VCdXR0b24gfHwgIXRoaXMuYWNjZXB0QnV0dG9uIHx8ICF0aGlzLnJldmVydEJ1dHRvbiB8fCAhdGhpcy51bnN0YWdlQnV0dG9uIHx8ICF0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnN0YWdlQnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy5hY2NlcHRCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLnJldmVydEJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMudW5zdGFnZUJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMudW5zdGFnZVVuYXZhaWxhYmxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdH1cblxuXHRwcml2YXRlIGlzUmVuZGVyUGVuZGluZygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5yZW5kZXJTZXR0bGVkR2VuZXJhdGlvbiAhPT0gdGhpcy5yZW5kZXJHZW5lcmF0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXR0bGVSZW5kZXJHZW5lcmF0aW9uKGdlbmVyYXRpb246IG51bWJlcik6IHZvaWQge1xuXHRcdGlmIChnZW5lcmF0aW9uID09PSB0aGlzLnJlbmRlckdlbmVyYXRpb24pIHtcblx0XHRcdHRoaXMucmVuZGVyU2V0dGxlZEdlbmVyYXRpb24gPSBnZW5lcmF0aW9uO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlV3JpdGVBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5zdGFnZUJ1dHRvbiB8fCAhdGhpcy5hY2NlcHRCdXR0b24gfHwgIXRoaXMucmV2ZXJ0QnV0dG9uIHx8ICF0aGlzLnVuc3RhZ2VCdXR0b24gfHwgIXRoaXMudW5zdGFnZVVuYXZhaWxhYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNSZW5kZXJQZW5kaW5nKCkpIHtcblx0XHRcdHRoaXMuaGlkZVdyaXRlQ2hyb21lKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY29tcGFyaXNvbkxvYWRGYWlsZWQpIHtcblx0XHRcdHRoaXMuaGlkZVdyaXRlQ2hyb21lKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmFjdHMgPSB0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCk7XG5cdFx0aWYgKCFmYWN0cykge1xuXHRcdFx0dGhpcy5oaWRlV3JpdGVDaHJvbWUoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgY2hyb21lID0gcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVDb250cm9sbGVyQ2hyb21lKGZhY3RzKTtcblx0XHR0aGlzLnN0YWdlQnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBjaHJvbWUuc2hvd1N0YWdlID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy5hY2NlcHRCdXR0b24uc3R5bGUuZGlzcGxheSA9IGNocm9tZS5zaG93QWNjZXB0ID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy5yZXZlcnRCdXR0b24uc3R5bGUuZGlzcGxheSA9IGNocm9tZS5zaG93UmV2ZXJ0ID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy51bnN0YWdlQnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBjaHJvbWUuc2hvd1Vuc3RhZ2UgPyAnJyA6ICdub25lJztcblx0XHR0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZS5zdHlsZS5kaXNwbGF5ID0gY2hyb21lLnVuc3RhZ2VVbmF2YWlsYWJsZSA/ICcnIDogJ25vbmUnO1xuXHRcdHRoaXMuYXBwbHlFbXB0eVN0YWdlUGF0aENocm9tZShmYWN0cyk7XG5cdH1cblxuXHQvKiogRW1wdHkgZW5naW5lIGlkZW50aXR5OiBkaXNhYmxlIFN0YWdlIGFuZCBzaG93IHN0YXR1cy4gVGhlIGNsaWNrIHBhdGggc3RpbGwgbXVzdCBub3Qgc2VuZC4gKi9cblx0cHJpdmF0ZSBhcHBseUVtcHR5U3RhZ2VQYXRoQ2hyb21lKGZhY3RzOiBJU291cmNlc0RpZmZXcml0ZUZhY3RzKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnN0YWdlQnV0dG9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGVtcHR5U3RhZ2UgPSByZXNvbHZlU291cmNlc0RpZmZFbXB0eVN0YWdlQ2hyb21lKGZhY3RzKTtcblx0XHRjb25zdCBzdGFnZUxhYmVsID0gbG9jYWxpemUoJ3NvdXJjZXNEaWZmUGFuZWwuc3RhZ2UnLCBcIlN0YWdlXCIpO1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24uZGlzYWJsZWQgPSBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZTtcblx0XHR0aGlzLnN0YWdlQnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsIGVtcHR5U3RhZ2UuZGlzYWJsZVN0YWdlID8gJ3RydWUnIDogJ2ZhbHNlJyk7XG5cdFx0Y29uc3QgZW1wdHlNZXNzYWdlID0gc291cmNlc0dpdEVtcHR5U3RhZ2VQYXRoTWVzc2FnZSgpO1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24udGl0bGUgPSBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZSA/IGVtcHR5TWVzc2FnZSA6IHN0YWdlTGFiZWw7XG5cdFx0dGhpcy5zdGFnZUJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZSA/IGAke3N0YWdlTGFiZWx9LiAke2VtcHR5TWVzc2FnZX1gIDogc3RhZ2VMYWJlbCk7XG5cdFx0aWYgKGVtcHR5U3RhZ2Uuc3RhdHVzKSB7XG5cdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2UoZW1wdHlTdGFnZS5zdGF0dXMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50Py50ZXh0Q29udGVudCA9PT0gZW1wdHlNZXNzYWdlKSB7XG5cdFx0XHR0aGlzLmhpZGVBY3Rpb25Ob3RpY2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGN1cnJlbnRXcml0ZUZhY3RzKCk6IElTb3VyY2VzRGlmZldyaXRlRmFjdHMgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNvbnRleHQgPSB0aGlzLmdldFdyaXRlQ29udGV4dCgpO1xuXHRcdGNvbnN0IHJlZiA9IHRoaXMuY3VycmVudFJlZjtcblx0XHRpZiAoIWNvbnRleHQgfHwgIXJlZikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgZmFsbGJhY2tTZXNzaW9uSWQgPSB0aGlzLmdldEdpdFNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IHBhaXJpbmdIb2xkID0gdGhpcy5zZXNzaW9uLmlzUGFpcmluZ0hvbGQoKTtcblx0XHRjb25zdCByZWFkRmFpbGVkID0gdGhpcy5pc1JlYWRGYWlsZWQoKTtcblx0XHRjb25zdCBlbmdpbmVTZXNzaW9uUmVhZHkgPSB0aGlzLmdldEVuZ2luZVNlc3Npb25SZWFkeSgpO1xuXHRcdGNvbnN0IHBpbm5lZFNlc3Npb25JZCA9IHJlZi5zZXNzaW9uSWQgPz8gJyc7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkZW50aXR5OiB7XG5cdFx0XHRcdG9yaWdpbjogcmVmLm9yaWdpbixcblx0XHRcdFx0c2Vzc2lvbklkOiByZWYuc2Vzc2lvbklkLFxuXHRcdFx0XHRtb2RpZmllZDogcmVmLm1vZGlmaWVkLFxuXHRcdFx0fSxcblx0XHRcdGNoYW5nZXNTbmFwc2hvdEtpbmQ6IHRoaXMuY2hhbmdlc01vZGVsLmdldFNuYXBzaG90KCkuc3RhdGUua2luZCxcblx0XHRcdHdyaXRlQ2xvc2VkOiB0aGlzLmlzU291cmNlc0RpZmZXcml0ZUhvbGQoKSxcblx0XHRcdGFjdGl2ZVNlc3Npb25JZDogdGhpcy5zZXNzaW9uLmdldEFjdGl2ZVNlc3Npb25JZCgpLFxuXHRcdFx0ZmFsbGJhY2tTZXNzaW9uSWQsXG5cdFx0XHRncm91cElkOiBjb250ZXh0Lmdyb3VwSWQsXG5cdFx0XHRwYXRoOiBjb250ZXh0LnBhdGgsXG5cdFx0XHRzY21SZXNvdXJjZTogY29udGV4dC5zY21SZXNvdXJjZSxcblx0XHRcdGNhbldyaXRlU3RhZ2U6IGNhblNlbmRTb3VyY2VzR2l0U3RhZ2VQYXRocyhcblx0XHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdFx0c291cmNlc0dpdFdyaXRlSG9va1ByZXNlbnQodGhpcy51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90Py4oKSwgJ3dyaXRlR2l0U3RhZ2VQYXRocycsIHRoaXMudWFDb25uZWN0aW9uLndyaXRlR2l0U3RhZ2VQYXRocyksXG5cdFx0XHRcdGZhbGxiYWNrU2Vzc2lvbklkLFxuXHRcdFx0XHRwYWlyaW5nSG9sZCxcblx0XHRcdFx0cmVhZEZhaWxlZCxcblx0XHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5LFxuXHRcdFx0KSxcblx0XHRcdGNhbldyaXRlQWNjZXB0OiBjYW5TZW5kU291cmNlc0dpdEFwcGx5SHVua3MoXG5cdFx0XHRcdHRoaXMudWFDb25uZWN0aW9uLmlzRW5naW5lQ29ubmVjdGVkKCksXG5cdFx0XHRcdHNvdXJjZXNHaXRXcml0ZUhvb2tQcmVzZW50KHRoaXMudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdD8uKCksICd3cml0ZUdpdEFwcGx5SHVua3MnLCB0aGlzLnVhQ29ubmVjdGlvbi53cml0ZUdpdEFwcGx5SHVua3MpLFxuXHRcdFx0XHRwYWlyaW5nSG9sZCxcblx0XHRcdFx0cmVhZEZhaWxlZCxcblx0XHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5LFxuXHRcdFx0KSxcblx0XHRcdGhhc0FwcGx5SHVua3NQYXlsb2FkOiBjYW5PZmZlclNvdXJjZXNHaXRBY2NlcHRIdW5rKHJlZi5raW5kLCByZWYuaW5kZXhTdGF0ZSkgJiYgY29udGV4dC5wYXRoICE9PSAnJyAmJiBoYXNTb3VyY2VzR2l0U2Vzc2lvbklkKHBpbm5lZFNlc3Npb25JZCksXG5cdFx0XHRoYXNHaXRTdGFnZUNvbW1hbmQ6ICEhQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKFNPVVJDRVNfR0lUX1NUQUdFX0NPTU1BTkQpLFxuXHRcdFx0aGFzR2l0VW5zdGFnZUNvbW1hbmQ6ICEhQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKFNPVVJDRVNfR0lUX1VOU1RBR0VfQ09NTUFORCksXG5cdFx0XHRoYXNHaXRDbGVhbkNvbW1hbmQ6ICEhQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKFNPVVJDRVNfR0lUX0NMRUFOX0NPTU1BTkQpLFxuXHRcdFx0cGFpcmluZ0hvbGQsXG5cdFx0XHRrZWVwTGVmdG92ZXI6IHRoaXMuaXNTb3VyY2VzS2VlcExlZnRvdmVyV3JpdGUoKSxcblx0XHRcdHBhdGNoZXM6IFtdLFxuXHRcdFx0Y29sbGFwc2U6IHRoaXMud3JpdGVDb2xsYXBzZSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5TdGFnZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzdGFnZWRSZWYgPSB0aGlzLmN1cnJlbnRSZWY7XG5cdFx0Y29uc3QgcGxhbiA9IHBsYW5Tb3VyY2VzRGlmZlN0YWdlQXR0ZW1wdCh0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCkpO1xuXHRcdGlmIChwbGFuLmtpbmQgPT09ICdibG9ja2VkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAocGxhbi5raW5kID09PSAnbm90aWNlJykge1xuXHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKHBsYW4ubWVzc2FnZSk7XG5cdFx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGdlbmVyYXRpb24gPSArK3RoaXMuX3N0YWdlR2VuZXJhdGlvbjtcblx0XHRjb25zdCBob29rID0gdGhpcy51YUNvbm5lY3Rpb24ud3JpdGVHaXRTdGFnZVBhdGhzO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhdHRlbXB0ID0gcGxhbi5raW5kID09PSAnc2tpcC1lbmdpbmUnXG5cdFx0XHRcdD8geyBraW5kOiAnZmFsbGJhY2snIGFzIGNvbnN0IH1cblx0XHRcdFx0OiBhd2FpdCBhdHRlbXB0U291cmNlc0dpdFdyaXRlKCgpID0+IHRyeVdyaXRlU291cmNlc0dpdFN0YWdlUGF0aHMoXG5cdFx0XHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdFx0XHRob29rID8gcmVxdWVzdCA9PiBob29rLmNhbGwodGhpcy51YUNvbm5lY3Rpb24sIHJlcXVlc3QpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHBsYW4uc2Vzc2lvbklkLFxuXHRcdFx0XHRcdFtwbGFuLnBhdGhdLFxuXHRcdFx0XHRcdHRoaXMuc2Vzc2lvbi5pc1BhaXJpbmdIb2xkKCksXG5cdFx0XHRcdFx0dGhpcy5pc1JlYWRGYWlsZWQoKSxcblx0XHRcdFx0XHR0aGlzLmdldEVuZ2luZVNlc3Npb25SZWFkeSgpLFxuXHRcdFx0XHQpKTtcblx0XHRcdGlmIChnZW5lcmF0aW9uICE9PSB0aGlzLl9zdGFnZUdlbmVyYXRpb24gfHwgdGhpcy5fc3RvcmUuaXNEaXNwb3NlZCB8fCB0aGlzLmN1cnJlbnRSZWYgIT09IHN0YWdlZFJlZikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmYWN0cyA9IHRoaXMuY3VycmVudFdyaXRlRmFjdHMoKTtcblx0XHRcdGlmICghZmFjdHMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWZ0ZXIgPSBwbGFuU291cmNlc0RpZmZTdGFnZUFmdGVyQXR0ZW1wdChhdHRlbXB0LCBmYWN0cyk7XG5cdFx0XHRpZiAoYWZ0ZXIua2luZCA9PT0gJ2NvbGxhcHNlLXN0YWdlJykge1xuXHRcdFx0XHR0aGlzLndyaXRlQ29sbGFwc2UgPSBtYXJrU291cmNlc0RpZmZXcml0ZUNvbGxhcHNlZChmYWN0cy5pZGVudGl0eS5tb2RpZmllZCwgJ3N0YWdlJyk7XG5cdFx0XHRcdHRoaXMuaGlkZUFjdGlvbk5vdGljZSgpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoYWZ0ZXIua2luZCA9PT0gJ2NsZWFyLW5vdGljZScpIHtcblx0XHRcdFx0dGhpcy5oaWRlQWN0aW9uTm90aWNlKCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChhZnRlci5raW5kID09PSAnbm90aWNlJykge1xuXHRcdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2UoYWZ0ZXIubWVzc2FnZSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChhZnRlci5raW5kID09PSAnbG9jYWwnKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucnVuR2l0QWN0aW9uKFNPVVJDRVNfR0lUX1NUQUdFX0NPTU1BTkQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gdGhpcy5fc3RhZ2VHZW5lcmF0aW9uIHx8IHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgfHwgdGhpcy5jdXJyZW50UmVmICE9PSBzdGFnZWRSZWYpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKGdldEVycm9yTWVzc2FnZShlcnJvcikpO1xuXHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGJpbmRBY2NlcHRDdXJzb3Iod2lkZ2V0OiBEaWZmRWRpdG9yV2lkZ2V0KTogdm9pZCB7XG5cdFx0Y29uc3QgbGlzdGVuID0gKHNpZGU6IElTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yWydzaWRlJ10sIGVkaXRvcjogUmV0dXJuVHlwZTxEaWZmRWRpdG9yV2lkZ2V0WydnZXRNb2RpZmllZEVkaXRvciddPikgPT4ge1xuXHRcdFx0Y29uc3QgcmVtZW1iZXIgPSAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0UG9zaXRpb24oKT8ubGluZU51bWJlcjtcblx0XHRcdFx0aWYgKGxpbmUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmFjY2VwdEN1cnNvciA9IHJlbWVtYmVyU291cmNlc0dpdEFjY2VwdEN1cnNvcih0aGlzLmFjY2VwdEN1cnNvciwge1xuXHRcdFx0XHRcdHNpZGUsXG5cdFx0XHRcdFx0bGluZSxcblx0XHRcdFx0XHRlZGl0b3JIYXNGb2N1czogZWRpdG9yLmhhc1RleHRGb2N1cygpLFxuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLmJvZHlEaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24ocmVtZW1iZXIpKTtcblx0XHRcdHRoaXMuYm9keURpc3Bvc2FibGVzLmFkZChlZGl0b3Iub25EaWRGb2N1c0VkaXRvclRleHQocmVtZW1iZXIpKTtcblx0XHR9O1xuXHRcdGxpc3RlbignbmV3Jywgd2lkZ2V0LmdldE1vZGlmaWVkRWRpdG9yKCkpO1xuXHRcdGxpc3Rlbignb2xkJywgd2lkZ2V0LmdldE9yaWdpbmFsRWRpdG9yKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkQWNjZXB0Q3Vyc29yKCk6IElTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmRpZmZXaWRnZXQudmFsdWU7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSB3aWRnZXQ/LmdldE1vZGlmaWVkRWRpdG9yKCk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB3aWRnZXQ/LmdldE9yaWdpbmFsRWRpdG9yKCk7XG5cdFx0cmV0dXJuIHNvdXJjZXNHaXRBY2NlcHRDdXJzb3JGcm9tRWRpdG9ycyh7XG5cdFx0XHRmb2N1c2VkOiBtb2RpZmllZD8uaGFzVGV4dEZvY3VzKCkgPyAnbmV3JyA6IG9yaWdpbmFsPy5oYXNUZXh0Rm9jdXMoKSA/ICdvbGQnIDogdW5kZWZpbmVkLFxuXHRcdFx0cmVtZW1iZXJlZDogdGhpcy5hY2NlcHRDdXJzb3IsXG5cdFx0XHRtb2RpZmllZExpbmU6IG1vZGlmaWVkPy5nZXRQb3NpdGlvbigpPy5saW5lTnVtYmVyLFxuXHRcdFx0b3JpZ2luYWxMaW5lOiBvcmlnaW5hbD8uZ2V0UG9zaXRpb24oKT8ubGluZU51bWJlcixcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuQWNjZXB0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHN0YWdlZFJlZiA9IHRoaXMuY3VycmVudFJlZjtcblx0XHRjb25zdCBwbGFuID0gcGxhblNvdXJjZXNEaWZmQWNjZXB0QXR0ZW1wdCh0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCkpO1xuXHRcdGlmIChwbGFuLmtpbmQgPT09ICdibG9ja2VkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAocGxhbi5raW5kID09PSAnbm90aWNlJykge1xuXHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKHBsYW4ubWVzc2FnZSk7XG5cdFx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGdlbmVyYXRpb24gPSB0aGlzLnJlbmRlckdlbmVyYXRpb247XG5cdFx0Y29uc3QgaXNDdXJyZW50ID0gKCkgPT4gIXRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgJiYgdGhpcy5jdXJyZW50UmVmID09PSBzdGFnZWRSZWYgJiYgZ2VuZXJhdGlvbiA9PT0gdGhpcy5yZW5kZXJHZW5lcmF0aW9uO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0YWdlZFJlZj8uc2Vzc2lvbklkID8/ICcnO1xuXHRcdGNvbnN0IHBhdGggPSB0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCk/LnBhdGggPz8gJyc7XG5cdFx0Y29uc3QgY3Vyc29yID0gdGhpcy5yZWFkQWNjZXB0Q3Vyc29yKCk7XG5cdFx0aWYgKCFpc0N1cnJlbnQoKSB8fCAhY2FuT2ZmZXJTb3VyY2VzR2l0QWNjZXB0SHVuayhzdGFnZWRSZWY/LmtpbmQsIHN0YWdlZFJlZj8uaW5kZXhTdGF0ZSkgfHwgcGF0aCA9PT0gJycgfHwgc2Vzc2lvbklkID09PSAnJyB8fCAhY3Vyc29yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVhZEdpdEZpbGVEaWZmID0gdGhpcy51YUNvbm5lY3Rpb24ucmVhZEdpdEZpbGVEaWZmO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZWFkID0gYXdhaXQgdHJ5UmVhZFNvdXJjZXNHaXRGaWxlRGlmZihcblx0XHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdFx0cmVhZEdpdEZpbGVEaWZmID8gcmVxdWVzdCA9PiByZWFkR2l0RmlsZURpZmYuY2FsbCh0aGlzLnVhQ29ubmVjdGlvbiwgcmVxdWVzdCkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdHNlc3Npb25JZCxcblx0XHRcdFx0cGF0aCxcblx0XHRcdFx0U09VUkNFU19HSVRfQUNDRVBUX0ZJTEVfRElGRl9JTkRFWF9TVEFURSxcblx0XHRcdFx0dGhpcy5zZXNzaW9uLmlzUGFpcmluZ0hvbGQoKSxcblx0XHRcdFx0dGhpcy5pc1JlYWRGYWlsZWQoKSxcblx0XHRcdCk7XG5cdFx0XHRpZiAoIWlzQ3VycmVudCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdC8vIFJlLWF1dGhvcml6ZSB0aGUgY2FwdHVyZWQgcmVhZCB0YXJnZXQ7IG5ldmVyIHJlZGlyZWN0IGl0cyBwYXRjaCB0byBhIG5ldyBzZXNzaW9uLlxuXHRcdFx0Y29uc3QgYmVmb3JlV3JpdGVGYWN0cyA9IHRoaXMuY3VycmVudFdyaXRlRmFjdHMoKTtcblx0XHRcdGNvbnN0IHdyaXRlUGxhbiA9IHBsYW5Tb3VyY2VzRGlmZkFjY2VwdEF0dGVtcHQoYmVmb3JlV3JpdGVGYWN0cyk7XG5cdFx0XHRpZiAod3JpdGVQbGFuLmtpbmQgIT09ICdlbmdpbmUnKSB7XG5cdFx0XHRcdGlmICh3cml0ZVBsYW4ua2luZCA9PT0gJ25vdGljZScpIHtcblx0XHRcdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2Uod3JpdGVQbGFuLm1lc3NhZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICh3cml0ZVBsYW4uc2Vzc2lvbklkICE9PSBzZXNzaW9uSWQpIHtcblx0XHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKHNvdXJjZXNHaXRTZXNzaW9uQ2hhbmdlZE1lc3NhZ2UoKSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghYmVmb3JlV3JpdGVGYWN0cz8uY2FuV3JpdGVBY2NlcHQpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcGF0Y2ggPSByZWFkPy5zdXBwb3J0ZWQgPyBzb3VyY2VzR2l0SHVua1BhdGNoQXRDdXJzb3IocmVhZC51bmlmaWVkRGlmZiwgY3Vyc29yLmxpbmUsIGN1cnNvci5zaWRlKSA6IHVuZGVmaW5lZDtcblx0XHRcdGlmICghcGF0Y2ggfHwgIWhhc1NvdXJjZXNHaXRBcHBseUh1bmtzUGF5bG9hZChzZXNzaW9uSWQsIFtwYXRjaF0pKSB7XG5cdFx0XHRcdHRoaXMuc2hvd0FjdGlvbk5vdGljZShzb3VyY2VzRGlmZkFjY2VwdFVuYXZhaWxhYmxlTWVzc2FnZSgpKTtcblx0XHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaG9vayA9IHRoaXMudWFDb25uZWN0aW9uLndyaXRlR2l0QXBwbHlIdW5rcztcblx0XHRcdGNvbnN0IGF0dGVtcHQgPSBhd2FpdCBhdHRlbXB0U291cmNlc0dpdFdyaXRlKCgpID0+IHRyeVdyaXRlU291cmNlc0dpdEFwcGx5SHVua3MoXG5cdFx0XHRcdHRoaXMudWFDb25uZWN0aW9uLmlzRW5naW5lQ29ubmVjdGVkKCksXG5cdFx0XHRcdGhvb2sgPyByZXF1ZXN0ID0+IGhvb2suY2FsbCh0aGlzLnVhQ29ubmVjdGlvbiwgcmVxdWVzdCkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdHNlc3Npb25JZCxcblx0XHRcdFx0U09VUkNFU19HSVRfQVBQTFlfQ0FDSEVEX0FSR1YsXG5cdFx0XHRcdFtwYXRjaF0sXG5cdFx0XHRcdHRoaXMuc2Vzc2lvbi5pc1BhaXJpbmdIb2xkKCksXG5cdFx0XHRcdHRoaXMuaXNSZWFkRmFpbGVkKCksXG5cdFx0XHRcdHRoaXMuZ2V0RW5naW5lU2Vzc2lvblJlYWR5KCksXG5cdFx0XHQpKTtcblx0XHRcdGlmICghaXNDdXJyZW50KCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZmFjdHMgPSB0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCk7XG5cdFx0XHRpZiAoIWZhY3RzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGFmdGVyID0gcGxhblNvdXJjZXNEaWZmQWNjZXB0QWZ0ZXJBdHRlbXB0KGF0dGVtcHQsIGZhY3RzKTtcblx0XHRcdGlmIChhZnRlci5raW5kID09PSAnY2xlYXItbm90aWNlJykge1xuXHRcdFx0XHR0aGlzLmhpZGVBY3Rpb25Ob3RpY2UoKTtcblx0XHRcdFx0dGhpcy5jaGFuZ2VzTW9kZWwuc2NoZWR1bGVSZWZyZXNoKCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChhZnRlci5raW5kID09PSAnbm90aWNlJykge1xuXHRcdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2UoYWZ0ZXIubWVzc2FnZSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICghaXNDdXJyZW50KCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKGdldEVycm9yTWVzc2FnZShlcnJvcikpO1xuXHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJ1bkdpdEFjdGlvbihjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZhY3RzID0gdGhpcy5jdXJyZW50V3JpdGVGYWN0cygpO1xuXHRcdGNvbnN0IHBsYW4gPSBwbGFuU291cmNlc0RpZmZMb2NhbEdpdEFjdGlvbihjb21tYW5kSWQsIGZhY3RzKTtcblx0XHRpZiAocGxhbi5raW5kICE9PSAnbG9jYWwnIHx8ICFmYWN0cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHBsYW4uY29tbWFuZElkLCBwbGFuLnNjbVJlc291cmNlKTtcblx0XHRcdHRoaXMuaGlkZUFjdGlvbk5vdGljZSgpO1xuXHRcdFx0aWYgKHBsYW4uY29sbGFwc2UpIHtcblx0XHRcdFx0dGhpcy53cml0ZUNvbGxhcHNlID0gbWFya1NvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZWQoZmFjdHMuaWRlbnRpdHkubW9kaWZpZWQsIHBsYW4uY29sbGFwc2UpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2UoZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzaG93QWN0aW9uTm90aWNlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuYWN0aW9uTm90aWNlRWxlbWVudC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cdFx0dGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2lzLWVycm9yJyk7XG5cdFx0dGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnJztcblx0fVxuXG5cdHByaXZhdGUgaGlkZUFjdGlvbk5vdGljZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuYWN0aW9uTm90aWNlRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQudGV4dENvbnRlbnQgPSAnJztcblx0XHR0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaXMtZXJyb3InKTtcblx0XHR0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0fVxuXG5cdHByaXZhdGUgc2hvd0xvYWROb3RpY2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaXMtZXJyb3InKTtcblx0XHR0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnJztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyRGlmZihvcmlnaW5hbDogVVJJLCBtb2RpZmllZDogVVJJLCBnZW5lcmF0aW9uOiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yQ29udGFpbmVyIHx8IHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBpc0N1cnJlbnQgPSAoKSA9PiAhdGhpcy5fc3RvcmUuaXNEaXNwb3NlZCAmJiBnZW5lcmF0aW9uID09PSB0aGlzLnJlbmRlckdlbmVyYXRpb247XG5cdFx0bGV0IG9yaWdpbmFsUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IG1vZGlmaWVkUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGVkaXRvck1vZGVsOiBTb3VyY2VzRGlmZkVkaXRvck1vZGVsIHwgdW5kZWZpbmVkO1xuXHRcdGxldCB3aWRnZXQ6IERpZmZFZGl0b3JXaWRnZXQgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHZpZXdNb2RlbDogSURpZmZFZGl0b3JWaWV3TW9kZWwgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGluc3RhbGxlZFdpZGdldDogRGlmZkVkaXRvcldpZGdldCB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBsb2NhbCA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRsb2NhbC5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHdpZGdldD8uc2V0TW9kZWwobnVsbCk7XG5cdFx0XHR3aWRnZXQ/LmRpc3Bvc2UoKTtcblx0XHRcdHZpZXdNb2RlbD8uZGlzcG9zZSgpO1xuXHRcdFx0ZWRpdG9yTW9kZWw/LmRpc3Bvc2UoKTtcblx0XHRcdG9yaWdpbmFsUmVmPy5kaXNwb3NlKCk7XG5cdFx0XHRtb2RpZmllZFJlZj8uZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0XHR0cnkge1xuXHRcdFx0b3JpZ2luYWxSZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2Uob3JpZ2luYWwpO1xuXHRcdFx0aWYgKCFpc0N1cnJlbnQoKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRtb2RpZmllZFJlZiA9IGF3YWl0IHRoaXMudGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShtb2RpZmllZCk7XG5cdFx0XHRpZiAoIWlzQ3VycmVudCgpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0ZWRpdG9yTW9kZWwgPSBuZXcgU291cmNlc0RpZmZFZGl0b3JNb2RlbChvcmlnaW5hbFJlZiwgbW9kaWZpZWRSZWYpO1xuXHRcdFx0b3JpZ2luYWxSZWYgPSB1bmRlZmluZWQ7XG5cdFx0XHRtb2RpZmllZFJlZiA9IHVuZGVmaW5lZDtcblx0XHRcdHdpZGdldCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGlmZkVkaXRvcldpZGdldCwgdGhpcy5lZGl0b3JDb250YWluZXIsIHRoaXMuZ2V0RGlmZkVkaXRvck9wdGlvbnMoKSwge30pO1xuXHRcdFx0aWYgKCFpc0N1cnJlbnQoKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHR2aWV3TW9kZWwgPSB3aWRnZXQuY3JlYXRlVmlld01vZGVsKGVkaXRvck1vZGVsKTtcblx0XHRcdGlmICghaXNDdXJyZW50KCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0d2lkZ2V0LnNldE1vZGVsKHZpZXdNb2RlbCk7XG5cdFx0XHRpZiAodGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdFx0Y29uc3QgaGVhZGVySGVpZ2h0ID0gdGhpcy5oZWFkZXJFbGVtZW50Py5vZmZzZXRIZWlnaHQgPz8gMDtcblx0XHRcdFx0d2lkZ2V0LmxheW91dChuZXcgZG9tLkRpbWVuc2lvbih0aGlzLmRpbWVuc2lvbi53aWR0aCwgTWF0aC5tYXgoMCwgdGhpcy5kaW1lbnNpb24uaGVpZ2h0IC0gaGVhZGVySGVpZ2h0KSkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFpc0N1cnJlbnQoKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMubW9kZWwudmFsdWUgPSBlZGl0b3JNb2RlbDtcblx0XHRcdGVkaXRvck1vZGVsID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5kaWZmVmlld01vZGVsLnZhbHVlID0gdmlld01vZGVsO1xuXHRcdFx0dmlld01vZGVsID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5kaWZmV2lkZ2V0LnZhbHVlID0gaW5zdGFsbGVkV2lkZ2V0ID0gd2lkZ2V0O1xuXHRcdFx0d2lkZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5iaW5kQWNjZXB0Q3Vyc29yKGluc3RhbGxlZFdpZGdldCk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdGlmIChpc0N1cnJlbnQoKSAmJiBpbnN0YWxsZWRXaWRnZXQgJiYgdGhpcy5kaWZmV2lkZ2V0LnZhbHVlID09PSBpbnN0YWxsZWRXaWRnZXQpIHtcblx0XHRcdFx0dGhpcy5jbGVhckVkaXRvcnMoKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0bG9jYWwuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyTW9kaWZpZWRPbmx5KG1vZGlmaWVkOiBVUkksIGdlbmVyYXRpb246IG51bWJlcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmICghdGhpcy5lZGl0b3JDb250YWluZXIgfHwgdGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzQ3VycmVudCA9ICgpID0+ICF0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkICYmIGdlbmVyYXRpb24gPT09IHRoaXMucmVuZGVyR2VuZXJhdGlvbjtcblx0XHRsZXQgbW9kaWZpZWRSZWY6IElSZWZlcmVuY2U8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgd2lkZ2V0OiBDb2RlRWRpdG9yV2lkZ2V0IHwgdW5kZWZpbmVkO1xuXHRcdGxldCBpbnN0YWxsZWRXaWRnZXQ6IENvZGVFZGl0b3JXaWRnZXQgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgbG9jYWwgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0bG9jYWwuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR3aWRnZXQ/LnNldE1vZGVsKG51bGwpO1xuXHRcdFx0d2lkZ2V0Py5kaXNwb3NlKCk7XG5cdFx0XHRtb2RpZmllZFJlZj8uZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0XHR0cnkge1xuXHRcdFx0bW9kaWZpZWRSZWYgPSBhd2FpdCB0aGlzLnRleHRNb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWxSZWZlcmVuY2UobW9kaWZpZWQpO1xuXHRcdFx0aWYgKCFpc0N1cnJlbnQoKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHR3aWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvZGVFZGl0b3JXaWRnZXQsIHRoaXMuZWRpdG9yQ29udGFpbmVyLCByZWFkT25seUVkaXRvck9wdGlvbnMsIHsgaXNTaW1wbGVXaWRnZXQ6IHRydWUgfSk7XG5cdFx0XHR3aWRnZXQuc2V0TW9kZWwobW9kaWZpZWRSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbCk7XG5cdFx0XHRpZiAodGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdFx0Y29uc3QgaGVhZGVySGVpZ2h0ID0gdGhpcy5oZWFkZXJFbGVtZW50Py5vZmZzZXRIZWlnaHQgPz8gMDtcblx0XHRcdFx0Y29uc3Qgbm90aWNlSGVpZ2h0ID0gdGhpcy5uZXdGaWxlTm90aWNlRWxlbWVudD8ub2Zmc2V0SGVpZ2h0ID8/IDA7XG5cdFx0XHRcdHdpZGdldC5sYXlvdXQobmV3IGRvbS5EaW1lbnNpb24odGhpcy5kaW1lbnNpb24ud2lkdGgsIE1hdGgubWF4KDAsIHRoaXMuZGltZW5zaW9uLmhlaWdodCAtIGhlYWRlckhlaWdodCAtIG5vdGljZUhlaWdodCkpKTtcblx0XHRcdH1cblx0XHRcdGlmICghaXNDdXJyZW50KCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLm1vZGlmaWVkTW9kZWxSZWYudmFsdWUgPSBtb2RpZmllZFJlZjtcblx0XHRcdG1vZGlmaWVkUmVmID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5jb2RlV2lkZ2V0LnZhbHVlID0gaW5zdGFsbGVkV2lkZ2V0ID0gd2lkZ2V0O1xuXHRcdFx0d2lkZ2V0ID0gdW5kZWZpbmVkO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHRpZiAoaXNDdXJyZW50KCkgJiYgaW5zdGFsbGVkV2lkZ2V0ICYmIHRoaXMuY29kZVdpZGdldC52YWx1ZSA9PT0gaW5zdGFsbGVkV2lkZ2V0KSB7XG5cdFx0XHRcdHRoaXMuY2xlYXJFZGl0b3JzKCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGxvY2FsLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRWRpdG9ycygpOiB2b2lkIHtcblx0XHR0aGlzLmJvZHlEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMuYWNjZXB0Q3Vyc29yID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuZGlmZldpZGdldC52YWx1ZT8uc2V0TW9kZWwobnVsbCk7XG5cdFx0dGhpcy5jb2RlV2lkZ2V0LnZhbHVlPy5zZXRNb2RlbChudWxsKTtcblx0XHR0aGlzLmRpZmZXaWRnZXQuY2xlYXIoKTtcblx0XHR0aGlzLmNvZGVXaWRnZXQuY2xlYXIoKTtcblx0XHR0aGlzLmRpZmZWaWV3TW9kZWwuY2xlYXIoKTtcblx0XHR0aGlzLm1vZGVsLmNsZWFyKCk7XG5cdFx0dGhpcy5tb2RpZmllZE1vZGVsUmVmLmNsZWFyKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFlBQVksU0FBUztBQUNyQixTQUFTLGlCQUE2QixtQkFBbUIsb0JBQW9CO0FBQzdFLFNBQVMsZ0JBQWdCO0FBR3pCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsd0JBQXdCO0FBSWpDLFNBQW1DLHlCQUF5QjtBQUM1RCxTQUFTLGlCQUFpQix5QkFBeUI7QUFDbkQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxrQkFBa0IsdUJBQXVCO0FBQ2xELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0JBQWtDO0FBQzNDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsbUNBQW1DLHVDQUF1QztBQUNuRixTQUFTLDRCQUE0QjtBQUNyQyxTQUF1QixtQkFBbUI7QUFDMUMsU0FBNEIsbUNBQW1DO0FBQy9EO0FBQUEsRUFDQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsT0FDTTtBQUNQLFNBQVMsaUNBQWlDO0FBQzFDO0FBQUEsRUFDQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxF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
