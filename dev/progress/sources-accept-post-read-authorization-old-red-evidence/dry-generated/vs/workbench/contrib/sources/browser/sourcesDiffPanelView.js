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
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
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
    const sessionId = stagedRef?.sessionId ?? "";
    const path = this.currentWriteFacts()?.path ?? "";
    const cursor = this.readAcceptCursor();
    if (!canOfferSourcesGitAcceptHunk(stagedRef?.kind, stagedRef?.indexState) || path === "" || sessionId === "" || !cursor) {
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
      if (this._store.isDisposed || this.currentRef !== stagedRef) {
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
      if (this._store.isDisposed || this.currentRef !== stagedRef) {
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
      if (this._store.isDisposed || this.currentRef !== stagedRef) {
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
    if (!this.editorContainer) {
      return false;
    }
    let originalRef;
    let modifiedRef;
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
    if (generation !== this.renderGeneration) {
      return false;
    }
    const editorModel = this.model.value = new SourcesDiffEditorModel(originalRef, modifiedRef);
    const widget = this.diffWidget.value = this.instantiationService.createInstance(
      DiffEditorWidget,
      this.editorContainer,
      this.getDiffEditorOptions(),
      {}
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
  async renderModifiedOnly(modified, generation) {
    if (!this.editorContainer) {
      return false;
    }
    let modifiedRef;
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
    if (generation !== this.renderGeneration) {
      return false;
    }
    const widget = this.codeWidget.value = this.instantiationService.createInstance(
      CodeEditorWidget,
      this.editorContainer,
      readOnlyEditorOptions,
      { isSimpleWidget: true }
    );
    widget.setModel(modifiedRef.object.textEditorModel);
    if (this.dimension) {
      const headerHeight = this.headerElement?.offsetHeight ?? 0;
      const noticeHeight = this.newFileNoticeElement?.offsetHeight ?? 0;
      widget.layout(new dom.Dimension(this.dimension.width, Math.max(0, this.dimension.height - headerHeight - noticeHeight)));
    }
    return true;
  }
  clearEditors() {
    this.acceptCursor = void 0;
    this.model.clear();
    this.modifiedModelRef.clear();
    this.diffWidget.clear();
    this.codeWidget.clear();
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL3NvdXJjZXMvYnJvd3Nlci9zb3VyY2VzRGlmZlBhbmVsVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9zb3VyY2VzRGlmZlBhbmVsLmNzcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElSZWZlcmVuY2UsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRGlmZkVkaXRvckNvbnN0cnVjdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9jb2RlRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9kaWZmRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZ2V0RXJyb3JNZXNzYWdlLCBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL3VuaXZlcnNlQWdlbnRDb25uZWN0aW9uLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lLCBJVmlld1BhbmVPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBjb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzUHJvYmUsIGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MgfSBmcm9tICcuLi8uLi9jb252ZXJzYXRpb24vY29tbW9uL2NvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MuanMnO1xuaW1wb3J0IHsgSUFnZW50U2Vzc2lvbkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hZ2VudFNlc3Npb24vY29tbW9uL2FnZW50U2Vzc2lvbkNvbnRleHQuanMnO1xuaW1wb3J0IHsgSVNDTVJlc291cmNlLCBJU0NNU2VydmljZSB9IGZyb20gJy4uLy4uL3NjbS9jb21tb24vc2NtLmpzJztcbmltcG9ydCB7IElTb3VyY2VzQ2hhbmdlUmVmLCByZXNvbHZlU291cmNlc0RpZmZXcml0ZUdhdGUgfSBmcm9tICcuLi9jb21tb24vc291cmNlc0NoYW5nZVJlZi5qcyc7XG5pbXBvcnQge1xuXHRTT1VSQ0VTX0dJVF9DTEVBTl9DT01NQU5ELFxuXHRTT1VSQ0VTX0dJVF9TVEFHRV9DT01NQU5ELFxuXHRTT1VSQ0VTX0dJVF9VTlNUQUdFX0NPTU1BTkQsXG59IGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzQ2hhbmdlc0dpdC5qcyc7XG5pbXBvcnQgeyB0cnlSZWFkU291cmNlc0dpdEZpbGVEaWZmIH0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzR2l0UmVhZC5qcyc7XG5pbXBvcnQge1xuXHRhdHRlbXB0U291cmNlc0dpdFdyaXRlLFxuXHRjYW5TZW5kU291cmNlc0dpdEFwcGx5SHVua3MsXG5cdGNhblNlbmRTb3VyY2VzR2l0U3RhZ2VQYXRocyxcblx0c291cmNlc0dpdFdyaXRlSG9va1ByZXNlbnQsXG5cdGhhc1NvdXJjZXNHaXRBcHBseUh1bmtzUGF5bG9hZCxcblx0aGFzU291cmNlc0dpdFNlc3Npb25JZCxcblx0aXNTb3VyY2VzS2VlcExlZnRvdmVyV3JpdGUsXG5cdHNvdXJjZXNHaXRFbXB0eVN0YWdlUGF0aE1lc3NhZ2UsXG5cdHNvdXJjZXNHaXRVbnN0YWdlVW5hdmFpbGFibGVNZXNzYWdlLFxuXHR0cnlXcml0ZVNvdXJjZXNHaXRBcHBseUh1bmtzLFxuXHR0cnlXcml0ZVNvdXJjZXNHaXRTdGFnZVBhdGhzLFxufSBmcm9tICcuLi9jb21tb24vc291cmNlc0NoYW5nZXNHaXRXcml0ZS5qcyc7XG5pbXBvcnQge1xuXHRjYW5PZmZlclNvdXJjZXNHaXRBY2NlcHRIdW5rLFxuXHR0eXBlIElTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yLFxuXHRyZW1lbWJlclNvdXJjZXNHaXRBY2NlcHRDdXJzb3IsXG5cdFNPVVJDRVNfR0lUX0FDQ0VQVF9GSUxFX0RJRkZfSU5ERVhfU1RBVEUsXG5cdFNPVVJDRVNfR0lUX0FQUExZX0NBQ0hFRF9BUkdWLFxuXHRzb3VyY2VzR2l0QWNjZXB0Q3Vyc29yRnJvbUVkaXRvcnMsXG5cdHNvdXJjZXNHaXRIdW5rUGF0Y2hBdEN1cnNvcixcbn0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNHaXRIdW5rUGF0Y2guanMnO1xuaW1wb3J0IHsgSVNvdXJjZXNDaGFuZ2VzTW9kZWwsIGlzU291cmNlc0NoYW5nZXNSZWFkRmFpbGVkLCBzb3VyY2VzQ2hhbmdlc1dyaXRlU2Vzc2lvbklkIH0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzTW9kZWwuanMnO1xuaW1wb3J0IHtcblx0SVNvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZSxcblx0SVNvdXJjZXNEaWZmV3JpdGVGYWN0cyxcblx0bWFya1NvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZWQsXG5cdHBsYW5Tb3VyY2VzRGlmZkFjY2VwdEFmdGVyQXR0ZW1wdCxcblx0cGxhblNvdXJjZXNEaWZmQWNjZXB0QXR0ZW1wdCxcblx0cGxhblNvdXJjZXNEaWZmTG9jYWxHaXRBY3Rpb24sXG5cdHBsYW5Tb3VyY2VzRGlmZlN0YWdlQWZ0ZXJBdHRlbXB0LFxuXHRwbGFuU291cmNlc0RpZmZTdGFnZUF0dGVtcHQsXG5cdHJlc29sdmVTb3VyY2VzRGlmZkVtcHR5U3RhZ2VDaHJvbWUsXG5cdHJlc29sdmVTb3VyY2VzRGlmZldyaXRlQ29udHJvbGxlckNocm9tZSxcblx0c291cmNlc0RpZmZBY2NlcHRVbmF2YWlsYWJsZU1lc3NhZ2UsXG5cdHNvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZUZvcixcbn0gZnJvbSAnLi4vY29tbW9uL3NvdXJjZXNEaWZmV3JpdGVDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9zb3VyY2VzRGlmZlBhbmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBhbGxvY2F0ZVNvdXJjZXNEaWZmTG9hZEdlbmVyYXRpb24sIGZpcmVTb3VyY2VzRGlmZkxvYWQgfSBmcm9tICcuL3NvdXJjZXNEaWZmTG9hZFNpZ25hbC5qcyc7XG5pbXBvcnQgeyBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCB9IGZyb20gJy4vc291cmNlc0RpZmZQYW5lbElkcy5qcyc7XG5cbmNvbnN0ICQgPSBkb20uJDtcblxuZXhwb3J0IGZ1bmN0aW9uIHNvdXJjZXNEaWZmUGFuZWxDb21wYXJpc29uTG9hZEZhaWxlZE1lc3NhZ2UoKTogc3RyaW5nIHtcblx0cmV0dXJuIGxvY2FsaXplKCdzb3VyY2VzRGlmZlBhbmVsLmxvYWRGYWlsZWQnLCBcIlVuYWJsZSB0byBsb2FkIHRoaXMgY29tcGFyaXNvbi5cIik7XG59XG5cbmNsYXNzIFNvdXJjZXNEaWZmRWRpdG9yTW9kZWwgZXh0ZW5kcyBFZGl0b3JNb2RlbCB7XG5cdHJlYWRvbmx5IG9yaWdpbmFsOiBJVGV4dE1vZGVsO1xuXHRyZWFkb25seSBtb2RpZmllZDogSVRleHRNb2RlbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9yaWdpbmFsUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtb2RpZmllZFJlZjogSVJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMub3JpZ2luYWwgPSBvcmlnaW5hbFJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXHRcdHRoaXMubW9kaWZpZWQgPSBtb2RpZmllZFJlZi5vYmplY3QudGV4dEVkaXRvck1vZGVsO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5vcmlnaW5hbFJlZi5kaXNwb3NlKCk7XG5cdFx0dGhpcy5tb2RpZmllZFJlZi5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY29uc3QgcmVhZE9ubHlFZGl0b3JPcHRpb25zOiBJRWRpdG9yT3B0aW9ucyA9IHtcblx0cmVhZE9ubHk6IHRydWUsXG5cdHNjcm9sbEJleW9uZExhc3RMaW5lOiBmYWxzZSxcblx0bWluaW1hcDogeyBlbmFibGVkOiBmYWxzZSB9LFxuXHRhdXRvbWF0aWNMYXlvdXQ6IGZhbHNlLFxuXHRsaW5lTnVtYmVyczogJ29uJyxcbn07XG5cbmV4cG9ydCBjbGFzcyBTb3VyY2VzRGlmZlBhbmVsVmlldyBleHRlbmRzIFZpZXdQYW5lIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGJvZHlEaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlmZldpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxEaWZmRWRpdG9yV2lkZ2V0PigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBjb2RlV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPENvZGVFZGl0b3JXaWRnZXQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPFNvdXJjZXNEaWZmRWRpdG9yTW9kZWw+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGlmaWVkTW9kZWxSZWYgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SVJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+PigpKTtcblxuXHRwcml2YXRlIGJvZHlDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGVkaXRvckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgaGVhZGVyRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgaGVhZGVyVGl0bGU6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHN0YWdlQnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBhY2NlcHRCdXR0b246IEhUTUxCdXR0b25FbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJldmVydEJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdW5zdGFnZUJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgdW5zdGFnZVVuYXZhaWxhYmxlOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBuZXdGaWxlTm90aWNlRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYWN0aW9uTm90aWNlRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZGltZW5zaW9uOiBkb20uRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGN1cnJlbnRSZWY6IElTb3VyY2VzQ2hhbmdlUmVmIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbXBhcmlzb25Mb2FkRmFpbGVkID0gZmFsc2U7XG5cdHByaXZhdGUgcmVuZGVyR2VuZXJhdGlvbiA9IDA7XG5cdHByaXZhdGUgcmVuZGVyU2V0dGxlZEdlbmVyYXRpb24gPSAwO1xuXHRwcml2YXRlIF9zdGFnZUdlbmVyYXRpb24gPSAwO1xuXHRwcml2YXRlIGFjdGl2ZVJlbmRlcjogeyBnZW5lcmF0aW9uOiBudW1iZXI7IHByb21pc2U6IFByb21pc2U8dm9pZD4gfSB8IHVuZGVmaW5lZDtcblx0LyoqIFJldmVydCAvIFVuc3RhZ2UgLyBlbmdpbmUgU3RhZ2UgaGlkZS4gQ2xlYXJlZCB3aGVuIHRoZSBtb2RpZmllZCBVUkkgY2hhbmdlcy4gKi9cblx0cHJpdmF0ZSB3cml0ZUNvbGxhcHNlOiBJU291cmNlc0RpZmZXcml0ZUNvbGxhcHNlIHwgdW5kZWZpbmVkO1xuXHQvKiogTGFzdCBkaWZmIGN1cnNvciBzaWRlIGFuZCBsaW5lLiBFZGl0b3IgdGV4dCBpcyBub3Qgc3RvcmVkLiAqL1xuXHRwcml2YXRlIGFjY2VwdEN1cnNvcjogSVNvdXJjZXNHaXRBY2NlcHRDdXJzb3IgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdQYW5lT3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc291cmNlc0RpZmZQYW5lbFNlcnZpY2U6IElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVNDTVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzY21TZXJ2aWNlOiBJU0NNU2VydmljZSxcblx0XHRASVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIHByaXZhdGUgcmVhZG9ubHkgdWFDb25uZWN0aW9uOiBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sXG5cdFx0QElBZ2VudFNlc3Npb25Db250ZXh0IHByaXZhdGUgcmVhZG9ubHkgc2Vzc2lvbjogSUFnZW50U2Vzc2lvbkNvbnRleHQsXG5cdFx0QElTb3VyY2VzQ2hhbmdlc01vZGVsIHByaXZhdGUgcmVhZG9ubHkgY2hhbmdlc01vZGVsOiBJU291cmNlc0NoYW5nZXNNb2RlbCxcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC5hZGQoJ3NvdXJjZXMtZGlmZi1wYW5lbCcpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zb3VyY2VzRGlmZlBhbmVsU2VydmljZS5vbkRpZENoYW5nZVJlZihyZWYgPT4ge1xuXHRcdFx0dGhpcy5jdXJyZW50UmVmID0gcmVmO1xuXHRcdFx0aWYgKCF0aGlzLmJvZHlDb250YWluZXIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZ2VuZXJhdGlvbiA9IHJlZlxuXHRcdFx0XHQ/IHRoaXMuc291cmNlc0RpZmZQYW5lbFNlcnZpY2UuZ2V0UGVuZGluZ1JlbmRlckdlbmVyYXRpb24oKVxuXHRcdFx0XHQ6IHVuZGVmaW5lZDtcblx0XHRcdGlmIChnZW5lcmF0aW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5iZWdpblJlbmRlcihyZWYsIGdlbmVyYXRpb24pO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXJlZikge1xuXHRcdFx0XHR0aGlzLmJlZ2luUmVuZGVyKHVuZGVmaW5lZCwgYWxsb2NhdGVTb3VyY2VzRGlmZkxvYWRHZW5lcmF0aW9uKCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVhQ29ubmVjdGlvbi5vbkRpZENoYW5nZUNvbm5lY3Rpb24oKCkgPT4gdGhpcy5vbldyaXRlRmFjdHNDaGFuZ2VkKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnNlc3Npb24ub25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uKCgpID0+IHRoaXMub25Xcml0ZUZhY3RzQ2hhbmdlZCgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZXNzaW9uLm9uRGlkQ2hhbmdlU2Vzc2lvbigoKSA9PiB0aGlzLm9uV3JpdGVGYWN0c0NoYW5nZWQoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY2hhbmdlc01vZGVsLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMub25Xcml0ZUZhY3RzQ2hhbmdlZCgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdkaWZmRWRpdG9yLnJlbmRlclNpZGVCeVNpZGUnKSAmJiB0aGlzLmRpZmZXaWRnZXQudmFsdWUpIHtcblx0XHRcdFx0dGhpcy5kaWZmV2lkZ2V0LnZhbHVlLnVwZGF0ZU9wdGlvbnModGhpcy5nZXREaWZmRWRpdG9yT3B0aW9ucygpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLmN1cnJlbnRSZWYgPSB0aGlzLnNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLmdldEN1cnJlbnRSZWYoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLmJvZHlDb250YWluZXIgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNvdXJjZXMtZGlmZi1wYW5lbC1ib2R5JykpO1xuXHRcdHRoaXMuaGVhZGVyRWxlbWVudCA9IGRvbS5hcHBlbmQodGhpcy5ib2R5Q29udGFpbmVyLCAkKCcuc291cmNlcy1kaWZmLXBhbmVsLWhlYWRlcicpKTtcblx0XHR0aGlzLmhlYWRlclRpdGxlID0gZG9tLmFwcGVuZCh0aGlzLmhlYWRlckVsZW1lbnQsICQoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdGl0bGUnKSk7XG5cdFx0Y29uc3QgaGVhZGVyQWN0aW9ucyA9IGRvbS5hcHBlbmQodGhpcy5oZWFkZXJFbGVtZW50LCAkKCcuc291cmNlcy1kaWZmLXBhbmVsLWFjdGlvbnMnKSk7XG5cblx0XHR0aGlzLnN0YWdlQnV0dG9uID0gdGhpcy5jcmVhdGVIZWFkZXJBY3Rpb24oaGVhZGVyQWN0aW9ucywgJ3NvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScsIGxvY2FsaXplKCdzb3VyY2VzRGlmZlBhbmVsLnN0YWdlJywgXCJTdGFnZVwiKSwgKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLnJ1blN0YWdlKCkuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKTtcblx0XHR9KTtcblx0XHR0aGlzLmFjY2VwdEJ1dHRvbiA9IHRoaXMuY3JlYXRlSGVhZGVyQWN0aW9uKGhlYWRlckFjdGlvbnMsICdzb3VyY2VzLWRpZmYtcGFuZWwtYWNjZXB0JywgbG9jYWxpemUoJ3NvdXJjZXNEaWZmUGFuZWwuYWNjZXB0JywgXCJBY2NlcHRcIiksICgpID0+IHtcblx0XHRcdHZvaWQgdGhpcy5ydW5BY2NlcHQoKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdH0pO1xuXHRcdHRoaXMucmV2ZXJ0QnV0dG9uID0gdGhpcy5jcmVhdGVIZWFkZXJBY3Rpb24oaGVhZGVyQWN0aW9ucywgJ3NvdXJjZXMtZGlmZi1wYW5lbC1yZXZlcnQnLCBsb2NhbGl6ZSgnc291cmNlc0RpZmZQYW5lbC5yZXZlcnQnLCBcIlJldmVydFwiKSwgKCkgPT4ge1xuXHRcdFx0dm9pZCB0aGlzLnJ1bkdpdEFjdGlvbihTT1VSQ0VTX0dJVF9DTEVBTl9DT01NQU5EKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdH0pO1xuXHRcdHRoaXMudW5zdGFnZUJ1dHRvbiA9IHRoaXMuY3JlYXRlSGVhZGVyQWN0aW9uKGhlYWRlckFjdGlvbnMsICdzb3VyY2VzLWRpZmYtcGFuZWwtdW5zdGFnZScsIGxvY2FsaXplKCdzb3VyY2VzRGlmZlBhbmVsLnVuc3RhZ2UnLCBcIlVuc3RhZ2VcIiksICgpID0+IHtcblx0XHRcdHZvaWQgdGhpcy5ydW5HaXRBY3Rpb24oU09VUkNFU19HSVRfVU5TVEFHRV9DT01NQU5EKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdH0pO1xuXHRcdHRoaXMudW5zdGFnZVVuYXZhaWxhYmxlID0gZG9tLmFwcGVuZChoZWFkZXJBY3Rpb25zLCAkKCdzcGFuLnNvdXJjZXMtZGlmZi1wYW5lbC11bnN0YWdlLXVuYXZhaWxhYmxlJykpO1xuXHRcdHRoaXMudW5zdGFnZVVuYXZhaWxhYmxlLnRleHRDb250ZW50ID0gc291cmNlc0dpdFVuc3RhZ2VVbmF2YWlsYWJsZU1lc3NhZ2UoKTtcblx0XHR0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG5cdFx0dGhpcy5uZXdGaWxlTm90aWNlRWxlbWVudCA9IGRvbS5hcHBlbmQodGhpcy5ib2R5Q29udGFpbmVyLCAkKCcuc291cmNlcy1kaWZmLXBhbmVsLW5ldy1maWxlLW5vdGljZScpKTtcblx0XHR0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50ID0gZG9tLmFwcGVuZCh0aGlzLmJvZHlDb250YWluZXIsICQoJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWN0aW9uLW5vdGljZScpKTtcblx0XHR0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLmVkaXRvckNvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy5ib2R5Q29udGFpbmVyLCAkKCcuc291cmNlcy1kaWZmLXBhbmVsLWVkaXRvcicpKTtcblxuXHRcdGNvbnN0IGdlbmVyYXRpb24gPSB0aGlzLnNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLmdldFBlbmRpbmdSZW5kZXJHZW5lcmF0aW9uKCk7XG5cdFx0aWYgKGdlbmVyYXRpb24gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5iZWdpblJlbmRlcih0aGlzLmN1cnJlbnRSZWYsIGdlbmVyYXRpb24pO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBsYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIubGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLmRpbWVuc2lvbiA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXG5cdFx0Y29uc3QgaGVhZGVySGVpZ2h0ID0gdGhpcy5oZWFkZXJFbGVtZW50Py5vZmZzZXRIZWlnaHQgPz8gMDtcblx0XHRjb25zdCBub3RpY2VIZWlnaHQgPSB0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50Py5zdHlsZS5kaXNwbGF5ID09PSAnbm9uZScgPyAwIDogKHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQ/Lm9mZnNldEhlaWdodCA/PyAwKTtcblx0XHRjb25zdCBhY3Rpb25Ob3RpY2VIZWlnaHQgPSB0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQ/LnN0eWxlLmRpc3BsYXkgPT09ICdub25lJyA/IDAgOiAodGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50Py5vZmZzZXRIZWlnaHQgPz8gMCk7XG5cdFx0Y29uc3QgZWRpdG9ySGVpZ2h0ID0gTWF0aC5tYXgoMCwgaGVpZ2h0IC0gaGVhZGVySGVpZ2h0IC0gbm90aWNlSGVpZ2h0IC0gYWN0aW9uTm90aWNlSGVpZ2h0KTtcblx0XHRjb25zdCBlZGl0b3JEaW1lbnNpb24gPSBuZXcgZG9tLkRpbWVuc2lvbih3aWR0aCwgZWRpdG9ySGVpZ2h0KTtcblxuXHRcdHRoaXMuZGlmZldpZGdldC52YWx1ZT8ubGF5b3V0KGVkaXRvckRpbWVuc2lvbik7XG5cdFx0dGhpcy5jb2RlV2lkZ2V0LnZhbHVlPy5sYXlvdXQoZWRpdG9yRGltZW5zaW9uKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGlmZkVkaXRvck9wdGlvbnMoKTogSURpZmZFZGl0b3JDb25zdHJ1Y3Rpb25PcHRpb25zIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4ucmVhZE9ubHlFZGl0b3JPcHRpb25zLFxuXHRcdFx0b3JpZ2luYWxFZGl0YWJsZTogZmFsc2UsXG5cdFx0XHRyZW5kZXJTaWRlQnlTaWRlOiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KCdkaWZmRWRpdG9yLnJlbmRlclNpZGVCeVNpZGUnKSA/PyB0cnVlLFxuXHRcdFx0cmVuZGVyT3ZlcnZpZXdSdWxlcjogZmFsc2UsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYmVnaW5SZW5kZXIocmVmOiBJU291cmNlc0NoYW5nZVJlZiB8IHVuZGVmaW5lZCwgZ2VuZXJhdGlvbjogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuYWN0aXZlUmVuZGVyPy5nZW5lcmF0aW9uID09PSBnZW5lcmF0aW9uKSB7XG5cdFx0XHR0aGlzLnNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLmF0dGFjaFBlbmRpbmdSZW5kZXIoZ2VuZXJhdGlvbiwgdGhpcy5hY3RpdmVSZW5kZXIucHJvbWlzZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHByb21pc2UgPSB0aGlzLnJlbmRlclJlZihyZWYsIGdlbmVyYXRpb24pO1xuXHRcdHRoaXMuYWN0aXZlUmVuZGVyID0geyBnZW5lcmF0aW9uLCBwcm9taXNlIH07XG5cdFx0dGhpcy5zb3VyY2VzRGlmZlBhbmVsU2VydmljZS5hdHRhY2hQZW5kaW5nUmVuZGVyKGdlbmVyYXRpb24sIHByb21pc2UpO1xuXHRcdHByb21pc2UuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyUmVmKHJlZjogSVNvdXJjZXNDaGFuZ2VSZWYgfCB1bmRlZmluZWQsIGdlbmVyYXRpb246IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMucmVuZGVyR2VuZXJhdGlvbiA9IGdlbmVyYXRpb247XG5cdFx0dGhpcy53cml0ZUNvbGxhcHNlID0gc291cmNlc0RpZmZXcml0ZUNvbGxhcHNlRm9yKHRoaXMud3JpdGVDb2xsYXBzZSwgcmVmPy5tb2RpZmllZCk7XG5cdFx0dGhpcy5ib2R5RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0aGlzLmNsZWFyRWRpdG9ycygpO1xuXHRcdHRoaXMuY29tcGFyaXNvbkxvYWRGYWlsZWQgPSBmYWxzZTtcblxuXHRcdGlmICghdGhpcy5oZWFkZXJFbGVtZW50IHx8ICF0aGlzLmhlYWRlclRpdGxlIHx8ICF0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50IHx8ICF0aGlzLmVkaXRvckNvbnRhaW5lcikge1xuXHRcdFx0dGhpcy5zZXR0bGVSZW5kZXJHZW5lcmF0aW9uKGdlbmVyYXRpb24pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuaGlkZUFjdGlvbk5vdGljZSgpO1xuXHRcdHRoaXMuaGlkZVdyaXRlQ2hyb21lKCk7XG5cblx0XHRpZiAoIXJlZikge1xuXHRcdFx0dGhpcy5oZWFkZXJUaXRsZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0dGhpcy5oZWFkZXJUaXRsZS50aXRsZSA9ICcnO1xuXHRcdFx0dGhpcy5oZWFkZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0aGlzLnNldHRsZVJlbmRlckdlbmVyYXRpb24oZ2VuZXJhdGlvbik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGxvYWRlZCA9IGZhbHNlO1xuXHRcdGlmICghcmVmLm9yaWdpbmFsKSB7XG5cdFx0XHRsb2FkZWQgPSBhd2FpdCB0aGlzLnJlbmRlck1vZGlmaWVkT25seShyZWYubW9kaWZpZWQsIGdlbmVyYXRpb24pO1xuXHRcdFx0aWYgKGdlbmVyYXRpb24gIT09IHRoaXMucmVuZGVyR2VuZXJhdGlvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAobG9hZGVkKSB7XG5cdFx0XHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaXMtZXJyb3InKTtcblx0XHRcdFx0dGhpcy5uZXdGaWxlTm90aWNlRWxlbWVudC50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdzb3VyY2VzRGlmZlBhbmVsLm5ld0ZpbGUnLCBcIk5ldyBmaWxlIHdpdGggbm8gcHJldmlvdXMgdmVyc2lvbiB0byBjb21wYXJlLlwiKTtcblx0XHRcdFx0dGhpcy5uZXdGaWxlTm90aWNlRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdGxvYWRlZCA9IGF3YWl0IHRoaXMucmVuZGVyRGlmZihyZWYub3JpZ2luYWwsIHJlZi5tb2RpZmllZCwgZ2VuZXJhdGlvbik7XG5cdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gdGhpcy5yZW5kZXJHZW5lcmF0aW9uKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIWxvYWRlZCkge1xuXHRcdFx0dGhpcy5jb21wYXJpc29uTG9hZEZhaWxlZCA9IHRydWU7XG5cdFx0XHR0aGlzLmhlYWRlclRpdGxlLnRleHRDb250ZW50ID0gJyc7XG5cdFx0XHR0aGlzLmhlYWRlclRpdGxlLnRpdGxlID0gJyc7XG5cdFx0XHR0aGlzLmhlYWRlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHRcdHRoaXMuaGlkZVdyaXRlQ2hyb21lKCk7XG5cdFx0XHR0aGlzLnNob3dMb2FkTm90aWNlKHNvdXJjZXNEaWZmUGFuZWxDb21wYXJpc29uTG9hZEZhaWxlZE1lc3NhZ2UoKSk7XG5cdFx0XHRpZiAodGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdFx0dGhpcy5sYXlvdXRCb2R5KHRoaXMuZGltZW5zaW9uLmhlaWdodCwgdGhpcy5kaW1lbnNpb24ud2lkdGgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zZXR0bGVSZW5kZXJHZW5lcmF0aW9uKGdlbmVyYXRpb24pO1xuXHRcdFx0ZmlyZVNvdXJjZXNEaWZmTG9hZCh7IHJlc291cmNlOiByZWYubW9kaWZpZWQsIGdlbmVyYXRpb24sIG9rOiBmYWxzZSB9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmhlYWRlckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICcnO1xuXHRcdHRoaXMuaGVhZGVyVGl0bGUudGV4dENvbnRlbnQgPSBiYXNlbmFtZShyZWYubW9kaWZpZWQpO1xuXHRcdHRoaXMuaGVhZGVyVGl0bGUudGl0bGUgPSByZWYubW9kaWZpZWQuZnNQYXRoO1xuXG5cdFx0dGhpcy5zZXR0bGVSZW5kZXJHZW5lcmF0aW9uKGdlbmVyYXRpb24pO1xuXHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0aWYgKHRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHR0aGlzLmxheW91dEJvZHkodGhpcy5kaW1lbnNpb24uaGVpZ2h0LCB0aGlzLmRpbWVuc2lvbi53aWR0aCk7XG5cdFx0fVxuXHRcdGZpcmVTb3VyY2VzRGlmZkxvYWQoeyByZXNvdXJjZTogcmVmLm1vZGlmaWVkLCBnZW5lcmF0aW9uLCBvazogdHJ1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlSGVhZGVyQWN0aW9uKHBhcmVudDogSFRNTEVsZW1lbnQsIGNsYXNzTmFtZTogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBvbkNsaWNrOiAoKSA9PiB2b2lkKTogSFRNTEJ1dHRvbkVsZW1lbnQge1xuXHRcdGNvbnN0IGJ1dHRvbiA9IGRvbS5hcHBlbmQocGFyZW50LCAkKGBidXR0b24uJHtjbGFzc05hbWV9YCkpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG5cdFx0YnV0dG9uLnRleHRDb250ZW50ID0gbGFiZWw7XG5cdFx0YnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0YnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25DbGljayk7XG5cdFx0cmV0dXJuIGJ1dHRvbjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0V3JpdGVDb250ZXh0KCk6IHsgZ3JvdXBJZDogc3RyaW5nOyBzY21SZXNvdXJjZTogSVNDTVJlc291cmNlIHwgdW5kZWZpbmVkOyBwYXRoOiBzdHJpbmcgfSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVmID0gdGhpcy5jdXJyZW50UmVmO1xuXHRcdGlmICghcmVmKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVHYXRlKHRoaXMuc2NtU2VydmljZSwgcmVmKTtcblx0fVxuXG5cdHByaXZhdGUgb25Xcml0ZUZhY3RzQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdGlmICh0aGlzLmRpbWVuc2lvbikge1xuXHRcdFx0dGhpcy5sYXlvdXRCb2R5KHRoaXMuZGltZW5zaW9uLmhlaWdodCwgdGhpcy5kaW1lbnNpb24ud2lkdGgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0R2l0U2Vzc2lvbklkKCk6IHN0cmluZyB7XG5cdFx0Y29uc3Qgc25hcHNob3QgPSB0aGlzLmNoYW5nZXNNb2RlbC5nZXRTbmFwc2hvdCgpO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gdGhpcy5jdXJyZW50UmVmPy5tb2RpZmllZDtcblx0XHRjb25zdCBtYXRjaGVzID0gbW9kaWZpZWRcblx0XHRcdD8gc25hcHNob3QuZW50cmllcy5maWx0ZXIoZW50cnkgPT4gZW50cnkucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gbW9kaWZpZWQudG9TdHJpbmcoKSlcblx0XHRcdDogdW5kZWZpbmVkO1xuXHRcdHJldHVybiBzb3VyY2VzQ2hhbmdlc1dyaXRlU2Vzc2lvbklkKHNuYXBzaG90LCBtYXRjaGVzLCB0aGlzLnNlc3Npb24uZ2V0QWN0aXZlU2Vzc2lvbklkKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRFbmdpbmVTZXNzaW9uUmVhZHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MoY29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzc1Byb2JlKHRoaXMuc2Vzc2lvbikpID09PSAncmVhZHknO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1JlYWRGYWlsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlzU291cmNlc0NoYW5nZXNSZWFkRmFpbGVkKHRoaXMuY2hhbmdlc01vZGVsLmdldFNuYXBzaG90KCkuc3RhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1NvdXJjZXNLZWVwTGVmdG92ZXJXcml0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXNTb3VyY2VzS2VlcExlZnRvdmVyV3JpdGUoXG5cdFx0XHR0aGlzLnVhQ29ubmVjdGlvbi5pc0VuZ2luZUNvbm5lY3RlZCgpLFxuXHRcdFx0ISF0aGlzLnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3Q/LigpLnBhaXJpbmdQZW5kaW5nLFxuXHRcdFx0dGhpcy5nZXRFbmdpbmVTZXNzaW9uUmVhZHkoKSxcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1NvdXJjZXNEaWZmV3JpdGVIb2xkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNoYW5nZXNNb2RlbC5pc1dyaXRlQ2xvc2VkKCk7XG5cdH1cblxuXHRwcml2YXRlIGhpZGVXcml0ZUNocm9tZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuc3RhZ2VCdXR0b24gfHwgIXRoaXMuYWNjZXB0QnV0dG9uIHx8ICF0aGlzLnJldmVydEJ1dHRvbiB8fCAhdGhpcy51bnN0YWdlQnV0dG9uIHx8ICF0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnN0YWdlQnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0dGhpcy5hY2NlcHRCdXR0b24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0aGlzLnJldmVydEJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMudW5zdGFnZUJ1dHRvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMudW5zdGFnZVVuYXZhaWxhYmxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdH1cblxuXHRwcml2YXRlIGlzUmVuZGVyUGVuZGluZygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5yZW5kZXJTZXR0bGVkR2VuZXJhdGlvbiAhPT0gdGhpcy5yZW5kZXJHZW5lcmF0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXR0bGVSZW5kZXJHZW5lcmF0aW9uKGdlbmVyYXRpb246IG51bWJlcik6IHZvaWQge1xuXHRcdGlmIChnZW5lcmF0aW9uID09PSB0aGlzLnJlbmRlckdlbmVyYXRpb24pIHtcblx0XHRcdHRoaXMucmVuZGVyU2V0dGxlZEdlbmVyYXRpb24gPSBnZW5lcmF0aW9uO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlV3JpdGVBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5zdGFnZUJ1dHRvbiB8fCAhdGhpcy5hY2NlcHRCdXR0b24gfHwgIXRoaXMucmV2ZXJ0QnV0dG9uIHx8ICF0aGlzLnVuc3RhZ2VCdXR0b24gfHwgIXRoaXMudW5zdGFnZVVuYXZhaWxhYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaXNSZW5kZXJQZW5kaW5nKCkpIHtcblx0XHRcdHRoaXMuaGlkZVdyaXRlQ2hyb21lKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY29tcGFyaXNvbkxvYWRGYWlsZWQpIHtcblx0XHRcdHRoaXMuaGlkZVdyaXRlQ2hyb21lKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmFjdHMgPSB0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCk7XG5cdFx0aWYgKCFmYWN0cykge1xuXHRcdFx0dGhpcy5oaWRlV3JpdGVDaHJvbWUoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgY2hyb21lID0gcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVDb250cm9sbGVyQ2hyb21lKGZhY3RzKTtcblx0XHR0aGlzLnN0YWdlQnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBjaHJvbWUuc2hvd1N0YWdlID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy5hY2NlcHRCdXR0b24uc3R5bGUuZGlzcGxheSA9IGNocm9tZS5zaG93QWNjZXB0ID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy5yZXZlcnRCdXR0b24uc3R5bGUuZGlzcGxheSA9IGNocm9tZS5zaG93UmV2ZXJ0ID8gJycgOiAnbm9uZSc7XG5cdFx0dGhpcy51bnN0YWdlQnV0dG9uLnN0eWxlLmRpc3BsYXkgPSBjaHJvbWUuc2hvd1Vuc3RhZ2UgPyAnJyA6ICdub25lJztcblx0XHR0aGlzLnVuc3RhZ2VVbmF2YWlsYWJsZS5zdHlsZS5kaXNwbGF5ID0gY2hyb21lLnVuc3RhZ2VVbmF2YWlsYWJsZSA/ICcnIDogJ25vbmUnO1xuXHRcdHRoaXMuYXBwbHlFbXB0eVN0YWdlUGF0aENocm9tZShmYWN0cyk7XG5cdH1cblxuXHQvKiogRW1wdHkgZW5naW5lIGlkZW50aXR5OiBkaXNhYmxlIFN0YWdlIGFuZCBzaG93IHN0YXR1cy4gVGhlIGNsaWNrIHBhdGggc3RpbGwgbXVzdCBub3Qgc2VuZC4gKi9cblx0cHJpdmF0ZSBhcHBseUVtcHR5U3RhZ2VQYXRoQ2hyb21lKGZhY3RzOiBJU291cmNlc0RpZmZXcml0ZUZhY3RzKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnN0YWdlQnV0dG9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGVtcHR5U3RhZ2UgPSByZXNvbHZlU291cmNlc0RpZmZFbXB0eVN0YWdlQ2hyb21lKGZhY3RzKTtcblx0XHRjb25zdCBzdGFnZUxhYmVsID0gbG9jYWxpemUoJ3NvdXJjZXNEaWZmUGFuZWwuc3RhZ2UnLCBcIlN0YWdlXCIpO1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24uZGlzYWJsZWQgPSBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZTtcblx0XHR0aGlzLnN0YWdlQnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsIGVtcHR5U3RhZ2UuZGlzYWJsZVN0YWdlID8gJ3RydWUnIDogJ2ZhbHNlJyk7XG5cdFx0Y29uc3QgZW1wdHlNZXNzYWdlID0gc291cmNlc0dpdEVtcHR5U3RhZ2VQYXRoTWVzc2FnZSgpO1xuXHRcdHRoaXMuc3RhZ2VCdXR0b24udGl0bGUgPSBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZSA/IGVtcHR5TWVzc2FnZSA6IHN0YWdlTGFiZWw7XG5cdFx0dGhpcy5zdGFnZUJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBlbXB0eVN0YWdlLmRpc2FibGVTdGFnZSA/IGAke3N0YWdlTGFiZWx9LiAke2VtcHR5TWVzc2FnZX1gIDogc3RhZ2VMYWJlbCk7XG5cdFx0aWYgKGVtcHR5U3RhZ2Uuc3RhdHVzKSB7XG5cdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2UoZW1wdHlTdGFnZS5zdGF0dXMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50Py50ZXh0Q29udGVudCA9PT0gZW1wdHlNZXNzYWdlKSB7XG5cdFx0XHR0aGlzLmhpZGVBY3Rpb25Ob3RpY2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGN1cnJlbnRXcml0ZUZhY3RzKCk6IElTb3VyY2VzRGlmZldyaXRlRmFjdHMgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNvbnRleHQgPSB0aGlzLmdldFdyaXRlQ29udGV4dCgpO1xuXHRcdGNvbnN0IHJlZiA9IHRoaXMuY3VycmVudFJlZjtcblx0XHRpZiAoIWNvbnRleHQgfHwgIXJlZikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgZmFsbGJhY2tTZXNzaW9uSWQgPSB0aGlzLmdldEdpdFNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IHBhaXJpbmdIb2xkID0gdGhpcy5zZXNzaW9uLmlzUGFpcmluZ0hvbGQoKTtcblx0XHRjb25zdCByZWFkRmFpbGVkID0gdGhpcy5pc1JlYWRGYWlsZWQoKTtcblx0XHRjb25zdCBlbmdpbmVTZXNzaW9uUmVhZHkgPSB0aGlzLmdldEVuZ2luZVNlc3Npb25SZWFkeSgpO1xuXHRcdGNvbnN0IHBpbm5lZFNlc3Npb25JZCA9IHJlZi5zZXNzaW9uSWQgPz8gJyc7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkZW50aXR5OiB7XG5cdFx0XHRcdG9yaWdpbjogcmVmLm9yaWdpbixcblx0XHRcdFx0c2Vzc2lvbklkOiByZWYuc2Vzc2lvbklkLFxuXHRcdFx0XHRtb2RpZmllZDogcmVmLm1vZGlmaWVkLFxuXHRcdFx0fSxcblx0XHRcdGNoYW5nZXNTbmFwc2hvdEtpbmQ6IHRoaXMuY2hhbmdlc01vZGVsLmdldFNuYXBzaG90KCkuc3RhdGUua2luZCxcblx0XHRcdHdyaXRlQ2xvc2VkOiB0aGlzLmlzU291cmNlc0RpZmZXcml0ZUhvbGQoKSxcblx0XHRcdGFjdGl2ZVNlc3Npb25JZDogdGhpcy5zZXNzaW9uLmdldEFjdGl2ZVNlc3Npb25JZCgpLFxuXHRcdFx0ZmFsbGJhY2tTZXNzaW9uSWQsXG5cdFx0XHRncm91cElkOiBjb250ZXh0Lmdyb3VwSWQsXG5cdFx0XHRwYXRoOiBjb250ZXh0LnBhdGgsXG5cdFx0XHRzY21SZXNvdXJjZTogY29udGV4dC5zY21SZXNvdXJjZSxcblx0XHRcdGNhbldyaXRlU3RhZ2U6IGNhblNlbmRTb3VyY2VzR2l0U3RhZ2VQYXRocyhcblx0XHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdFx0c291cmNlc0dpdFdyaXRlSG9va1ByZXNlbnQodGhpcy51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90Py4oKSwgJ3dyaXRlR2l0U3RhZ2VQYXRocycsIHRoaXMudWFDb25uZWN0aW9uLndyaXRlR2l0U3RhZ2VQYXRocyksXG5cdFx0XHRcdGZhbGxiYWNrU2Vzc2lvbklkLFxuXHRcdFx0XHRwYWlyaW5nSG9sZCxcblx0XHRcdFx0cmVhZEZhaWxlZCxcblx0XHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5LFxuXHRcdFx0KSxcblx0XHRcdGNhbldyaXRlQWNjZXB0OiBjYW5TZW5kU291cmNlc0dpdEFwcGx5SHVua3MoXG5cdFx0XHRcdHRoaXMudWFDb25uZWN0aW9uLmlzRW5naW5lQ29ubmVjdGVkKCksXG5cdFx0XHRcdHNvdXJjZXNHaXRXcml0ZUhvb2tQcmVzZW50KHRoaXMudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdD8uKCksICd3cml0ZUdpdEFwcGx5SHVua3MnLCB0aGlzLnVhQ29ubmVjdGlvbi53cml0ZUdpdEFwcGx5SHVua3MpLFxuXHRcdFx0XHRwYWlyaW5nSG9sZCxcblx0XHRcdFx0cmVhZEZhaWxlZCxcblx0XHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5LFxuXHRcdFx0KSxcblx0XHRcdGhhc0FwcGx5SHVua3NQYXlsb2FkOiBjYW5PZmZlclNvdXJjZXNHaXRBY2NlcHRIdW5rKHJlZi5raW5kLCByZWYuaW5kZXhTdGF0ZSkgJiYgY29udGV4dC5wYXRoICE9PSAnJyAmJiBoYXNTb3VyY2VzR2l0U2Vzc2lvbklkKHBpbm5lZFNlc3Npb25JZCksXG5cdFx0XHRoYXNHaXRTdGFnZUNvbW1hbmQ6ICEhQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKFNPVVJDRVNfR0lUX1NUQUdFX0NPTU1BTkQpLFxuXHRcdFx0aGFzR2l0VW5zdGFnZUNvbW1hbmQ6ICEhQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKFNPVVJDRVNfR0lUX1VOU1RBR0VfQ09NTUFORCksXG5cdFx0XHRoYXNHaXRDbGVhbkNvbW1hbmQ6ICEhQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKFNPVVJDRVNfR0lUX0NMRUFOX0NPTU1BTkQpLFxuXHRcdFx0cGFpcmluZ0hvbGQsXG5cdFx0XHRrZWVwTGVmdG92ZXI6IHRoaXMuaXNTb3VyY2VzS2VlcExlZnRvdmVyV3JpdGUoKSxcblx0XHRcdHBhdGNoZXM6IFtdLFxuXHRcdFx0Y29sbGFwc2U6IHRoaXMud3JpdGVDb2xsYXBzZSxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5TdGFnZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzdGFnZWRSZWYgPSB0aGlzLmN1cnJlbnRSZWY7XG5cdFx0Y29uc3QgcGxhbiA9IHBsYW5Tb3VyY2VzRGlmZlN0YWdlQXR0ZW1wdCh0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCkpO1xuXHRcdGlmIChwbGFuLmtpbmQgPT09ICdibG9ja2VkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAocGxhbi5raW5kID09PSAnbm90aWNlJykge1xuXHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKHBsYW4ubWVzc2FnZSk7XG5cdFx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGdlbmVyYXRpb24gPSArK3RoaXMuX3N0YWdlR2VuZXJhdGlvbjtcblx0XHRjb25zdCBob29rID0gdGhpcy51YUNvbm5lY3Rpb24ud3JpdGVHaXRTdGFnZVBhdGhzO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhdHRlbXB0ID0gcGxhbi5raW5kID09PSAnc2tpcC1lbmdpbmUnXG5cdFx0XHRcdD8geyBraW5kOiAnZmFsbGJhY2snIGFzIGNvbnN0IH1cblx0XHRcdFx0OiBhd2FpdCBhdHRlbXB0U291cmNlc0dpdFdyaXRlKCgpID0+IHRyeVdyaXRlU291cmNlc0dpdFN0YWdlUGF0aHMoXG5cdFx0XHRcdFx0dGhpcy51YUNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSxcblx0XHRcdFx0XHRob29rID8gcmVxdWVzdCA9PiBob29rLmNhbGwodGhpcy51YUNvbm5lY3Rpb24sIHJlcXVlc3QpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHBsYW4uc2Vzc2lvbklkLFxuXHRcdFx0XHRcdFtwbGFuLnBhdGhdLFxuXHRcdFx0XHRcdHRoaXMuc2Vzc2lvbi5pc1BhaXJpbmdIb2xkKCksXG5cdFx0XHRcdFx0dGhpcy5pc1JlYWRGYWlsZWQoKSxcblx0XHRcdFx0XHR0aGlzLmdldEVuZ2luZVNlc3Npb25SZWFkeSgpLFxuXHRcdFx0XHQpKTtcblx0XHRcdGlmIChnZW5lcmF0aW9uICE9PSB0aGlzLl9zdGFnZUdlbmVyYXRpb24gfHwgdGhpcy5fc3RvcmUuaXNEaXNwb3NlZCB8fCB0aGlzLmN1cnJlbnRSZWYgIT09IHN0YWdlZFJlZikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmYWN0cyA9IHRoaXMuY3VycmVudFdyaXRlRmFjdHMoKTtcblx0XHRcdGlmICghZmFjdHMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWZ0ZXIgPSBwbGFuU291cmNlc0RpZmZTdGFnZUFmdGVyQXR0ZW1wdChhdHRlbXB0LCBmYWN0cyk7XG5cdFx0XHRpZiAoYWZ0ZXIua2luZCA9PT0gJ2NvbGxhcHNlLXN0YWdlJykge1xuXHRcdFx0XHR0aGlzLndyaXRlQ29sbGFwc2UgPSBtYXJrU291cmNlc0RpZmZXcml0ZUNvbGxhcHNlZChmYWN0cy5pZGVudGl0eS5tb2RpZmllZCwgJ3N0YWdlJyk7XG5cdFx0XHRcdHRoaXMuaGlkZUFjdGlvbk5vdGljZSgpO1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoYWZ0ZXIua2luZCA9PT0gJ2NsZWFyLW5vdGljZScpIHtcblx0XHRcdFx0dGhpcy5oaWRlQWN0aW9uTm90aWNlKCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChhZnRlci5raW5kID09PSAnbm90aWNlJykge1xuXHRcdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2UoYWZ0ZXIubWVzc2FnZSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChhZnRlci5raW5kID09PSAnbG9jYWwnKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMucnVuR2l0QWN0aW9uKFNPVVJDRVNfR0lUX1NUQUdFX0NPTU1BTkQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gdGhpcy5fc3RhZ2VHZW5lcmF0aW9uIHx8IHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgfHwgdGhpcy5jdXJyZW50UmVmICE9PSBzdGFnZWRSZWYpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKGdldEVycm9yTWVzc2FnZShlcnJvcikpO1xuXHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGJpbmRBY2NlcHRDdXJzb3Iod2lkZ2V0OiBEaWZmRWRpdG9yV2lkZ2V0KTogdm9pZCB7XG5cdFx0Y29uc3QgbGlzdGVuID0gKHNpZGU6IElTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yWydzaWRlJ10sIGVkaXRvcjogUmV0dXJuVHlwZTxEaWZmRWRpdG9yV2lkZ2V0WydnZXRNb2RpZmllZEVkaXRvciddPikgPT4ge1xuXHRcdFx0Y29uc3QgcmVtZW1iZXIgPSAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGxpbmUgPSBlZGl0b3IuZ2V0UG9zaXRpb24oKT8ubGluZU51bWJlcjtcblx0XHRcdFx0aWYgKGxpbmUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmFjY2VwdEN1cnNvciA9IHJlbWVtYmVyU291cmNlc0dpdEFjY2VwdEN1cnNvcih0aGlzLmFjY2VwdEN1cnNvciwge1xuXHRcdFx0XHRcdHNpZGUsXG5cdFx0XHRcdFx0bGluZSxcblx0XHRcdFx0XHRlZGl0b3JIYXNGb2N1czogZWRpdG9yLmhhc1RleHRGb2N1cygpLFxuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLmJvZHlEaXNwb3NhYmxlcy5hZGQoZWRpdG9yLm9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb24ocmVtZW1iZXIpKTtcblx0XHRcdHRoaXMuYm9keURpc3Bvc2FibGVzLmFkZChlZGl0b3Iub25EaWRGb2N1c0VkaXRvclRleHQocmVtZW1iZXIpKTtcblx0XHR9O1xuXHRcdGxpc3RlbignbmV3Jywgd2lkZ2V0LmdldE1vZGlmaWVkRWRpdG9yKCkpO1xuXHRcdGxpc3Rlbignb2xkJywgd2lkZ2V0LmdldE9yaWdpbmFsRWRpdG9yKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkQWNjZXB0Q3Vyc29yKCk6IElTb3VyY2VzR2l0QWNjZXB0Q3Vyc29yIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmRpZmZXaWRnZXQudmFsdWU7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSB3aWRnZXQ/LmdldE1vZGlmaWVkRWRpdG9yKCk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB3aWRnZXQ/LmdldE9yaWdpbmFsRWRpdG9yKCk7XG5cdFx0cmV0dXJuIHNvdXJjZXNHaXRBY2NlcHRDdXJzb3JGcm9tRWRpdG9ycyh7XG5cdFx0XHRmb2N1c2VkOiBtb2RpZmllZD8uaGFzVGV4dEZvY3VzKCkgPyAnbmV3JyA6IG9yaWdpbmFsPy5oYXNUZXh0Rm9jdXMoKSA/ICdvbGQnIDogdW5kZWZpbmVkLFxuXHRcdFx0cmVtZW1iZXJlZDogdGhpcy5hY2NlcHRDdXJzb3IsXG5cdFx0XHRtb2RpZmllZExpbmU6IG1vZGlmaWVkPy5nZXRQb3NpdGlvbigpPy5saW5lTnVtYmVyLFxuXHRcdFx0b3JpZ2luYWxMaW5lOiBvcmlnaW5hbD8uZ2V0UG9zaXRpb24oKT8ubGluZU51bWJlcixcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcnVuQWNjZXB0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHN0YWdlZFJlZiA9IHRoaXMuY3VycmVudFJlZjtcblx0XHRjb25zdCBwbGFuID0gcGxhblNvdXJjZXNEaWZmQWNjZXB0QXR0ZW1wdCh0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCkpO1xuXHRcdGlmIChwbGFuLmtpbmQgPT09ICdibG9ja2VkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAocGxhbi5raW5kID09PSAnbm90aWNlJykge1xuXHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKHBsYW4ubWVzc2FnZSk7XG5cdFx0XHR0aGlzLnVwZGF0ZVdyaXRlQWN0aW9ucygpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0YWdlZFJlZj8uc2Vzc2lvbklkID8/ICcnO1xuXHRcdGNvbnN0IHBhdGggPSB0aGlzLmN1cnJlbnRXcml0ZUZhY3RzKCk/LnBhdGggPz8gJyc7XG5cdFx0Y29uc3QgY3Vyc29yID0gdGhpcy5yZWFkQWNjZXB0Q3Vyc29yKCk7XG5cdFx0aWYgKCFjYW5PZmZlclNvdXJjZXNHaXRBY2NlcHRIdW5rKHN0YWdlZFJlZj8ua2luZCwgc3RhZ2VkUmVmPy5pbmRleFN0YXRlKSB8fCBwYXRoID09PSAnJyB8fCBzZXNzaW9uSWQgPT09ICcnIHx8ICFjdXJzb3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZWFkR2l0RmlsZURpZmYgPSB0aGlzLnVhQ29ubmVjdGlvbi5yZWFkR2l0RmlsZURpZmY7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlYWQgPSBhd2FpdCB0cnlSZWFkU291cmNlc0dpdEZpbGVEaWZmKFxuXHRcdFx0XHR0aGlzLnVhQ29ubmVjdGlvbi5pc0VuZ2luZUNvbm5lY3RlZCgpLFxuXHRcdFx0XHRyZWFkR2l0RmlsZURpZmYgPyByZXF1ZXN0ID0+IHJlYWRHaXRGaWxlRGlmZi5jYWxsKHRoaXMudWFDb25uZWN0aW9uLCByZXF1ZXN0KSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0c2Vzc2lvbklkLFxuXHRcdFx0XHRwYXRoLFxuXHRcdFx0XHRTT1VSQ0VTX0dJVF9BQ0NFUFRfRklMRV9ESUZGX0lOREVYX1NUQVRFLFxuXHRcdFx0XHR0aGlzLnNlc3Npb24uaXNQYWlyaW5nSG9sZCgpLFxuXHRcdFx0XHR0aGlzLmlzUmVhZEZhaWxlZCgpLFxuXHRcdFx0KTtcblx0XHRcdGlmICh0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkIHx8IHRoaXMuY3VycmVudFJlZiAhPT0gc3RhZ2VkUmVmKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHBhdGNoID0gcmVhZD8uc3VwcG9ydGVkID8gc291cmNlc0dpdEh1bmtQYXRjaEF0Q3Vyc29yKHJlYWQudW5pZmllZERpZmYsIGN1cnNvci5saW5lLCBjdXJzb3Iuc2lkZSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoIXBhdGNoIHx8ICFoYXNTb3VyY2VzR2l0QXBwbHlIdW5rc1BheWxvYWQoc2Vzc2lvbklkLCBbcGF0Y2hdKSkge1xuXHRcdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2Uoc291cmNlc0RpZmZBY2NlcHRVbmF2YWlsYWJsZU1lc3NhZ2UoKSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGhvb2sgPSB0aGlzLnVhQ29ubmVjdGlvbi53cml0ZUdpdEFwcGx5SHVua3M7XG5cdFx0XHRjb25zdCBhdHRlbXB0ID0gYXdhaXQgYXR0ZW1wdFNvdXJjZXNHaXRXcml0ZSgoKSA9PiB0cnlXcml0ZVNvdXJjZXNHaXRBcHBseUh1bmtzKFxuXHRcdFx0XHR0aGlzLnVhQ29ubmVjdGlvbi5pc0VuZ2luZUNvbm5lY3RlZCgpLFxuXHRcdFx0XHRob29rID8gcmVxdWVzdCA9PiBob29rLmNhbGwodGhpcy51YUNvbm5lY3Rpb24sIHJlcXVlc3QpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRzZXNzaW9uSWQsXG5cdFx0XHRcdFNPVVJDRVNfR0lUX0FQUExZX0NBQ0hFRF9BUkdWLFxuXHRcdFx0XHRbcGF0Y2hdLFxuXHRcdFx0XHR0aGlzLnNlc3Npb24uaXNQYWlyaW5nSG9sZCgpLFxuXHRcdFx0XHR0aGlzLmlzUmVhZEZhaWxlZCgpLFxuXHRcdFx0XHR0aGlzLmdldEVuZ2luZVNlc3Npb25SZWFkeSgpLFxuXHRcdFx0KSk7XG5cdFx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCB8fCB0aGlzLmN1cnJlbnRSZWYgIT09IHN0YWdlZFJlZikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmYWN0cyA9IHRoaXMuY3VycmVudFdyaXRlRmFjdHMoKTtcblx0XHRcdGlmICghZmFjdHMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWZ0ZXIgPSBwbGFuU291cmNlc0RpZmZBY2NlcHRBZnRlckF0dGVtcHQoYXR0ZW1wdCwgZmFjdHMpO1xuXHRcdFx0aWYgKGFmdGVyLmtpbmQgPT09ICdjbGVhci1ub3RpY2UnKSB7XG5cdFx0XHRcdHRoaXMuaGlkZUFjdGlvbk5vdGljZSgpO1xuXHRcdFx0XHR0aGlzLmNoYW5nZXNNb2RlbC5zY2hlZHVsZVJlZnJlc2goKTtcblx0XHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGFmdGVyLmtpbmQgPT09ICdub3RpY2UnKSB7XG5cdFx0XHRcdHRoaXMuc2hvd0FjdGlvbk5vdGljZShhZnRlci5tZXNzYWdlKTtcblx0XHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQgfHwgdGhpcy5jdXJyZW50UmVmICE9PSBzdGFnZWRSZWYpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5zaG93QWN0aW9uTm90aWNlKGdldEVycm9yTWVzc2FnZShlcnJvcikpO1xuXHRcdFx0dGhpcy51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJ1bkdpdEFjdGlvbihjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZhY3RzID0gdGhpcy5jdXJyZW50V3JpdGVGYWN0cygpO1xuXHRcdGNvbnN0IHBsYW4gPSBwbGFuU291cmNlc0RpZmZMb2NhbEdpdEFjdGlvbihjb21tYW5kSWQsIGZhY3RzKTtcblx0XHRpZiAocGxhbi5raW5kICE9PSAnbG9jYWwnIHx8ICFmYWN0cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHBsYW4uY29tbWFuZElkLCBwbGFuLnNjbVJlc291cmNlKTtcblx0XHRcdHRoaXMuaGlkZUFjdGlvbk5vdGljZSgpO1xuXHRcdFx0aWYgKHBsYW4uY29sbGFwc2UpIHtcblx0XHRcdFx0dGhpcy53cml0ZUNvbGxhcHNlID0gbWFya1NvdXJjZXNEaWZmV3JpdGVDb2xsYXBzZWQoZmFjdHMuaWRlbnRpdHkubW9kaWZpZWQsIHBsYW4uY29sbGFwc2UpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLnNob3dBY3Rpb25Ob3RpY2UoZ2V0RXJyb3JNZXNzYWdlKGVycm9yKSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMudXBkYXRlV3JpdGVBY3Rpb25zKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzaG93QWN0aW9uTm90aWNlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuYWN0aW9uTm90aWNlRWxlbWVudC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG5cdFx0dGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2lzLWVycm9yJyk7XG5cdFx0dGhpcy5hY3Rpb25Ob3RpY2VFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnJztcblx0fVxuXG5cdHByaXZhdGUgaGlkZUFjdGlvbk5vdGljZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuYWN0aW9uTm90aWNlRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQudGV4dENvbnRlbnQgPSAnJztcblx0XHR0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaXMtZXJyb3InKTtcblx0XHR0aGlzLmFjdGlvbk5vdGljZUVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0fVxuXG5cdHByaXZhdGUgc2hvd0xvYWROb3RpY2UobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdHRoaXMubmV3RmlsZU5vdGljZUVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaXMtZXJyb3InKTtcblx0XHR0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnJztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyRGlmZihvcmlnaW5hbDogVVJJLCBtb2RpZmllZDogVVJJLCBnZW5lcmF0aW9uOiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yQ29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IG9yaWdpbmFsUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IG1vZGlmaWVkUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4gfCB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdG9yaWdpbmFsUmVmID0gYXdhaXQgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKG9yaWdpbmFsKTtcblx0XHRcdG1vZGlmaWVkUmVmID0gYXdhaXQgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKG1vZGlmaWVkKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdG9yaWdpbmFsUmVmPy5kaXNwb3NlKCk7XG5cdFx0XHRtb2RpZmllZFJlZj8uZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChnZW5lcmF0aW9uICE9PSB0aGlzLnJlbmRlckdlbmVyYXRpb24pIHtcblx0XHRcdG9yaWdpbmFsUmVmLmRpc3Bvc2UoKTtcblx0XHRcdG1vZGlmaWVkUmVmLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHR0aGlzLmJvZHlEaXNwb3NhYmxlcy5hZGQob3JpZ2luYWxSZWYpO1xuXHRcdHRoaXMuYm9keURpc3Bvc2FibGVzLmFkZChtb2RpZmllZFJlZik7XG5cblx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gdGhpcy5yZW5kZXJHZW5lcmF0aW9uKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdG9yTW9kZWwgPSB0aGlzLm1vZGVsLnZhbHVlID0gbmV3IFNvdXJjZXNEaWZmRWRpdG9yTW9kZWwob3JpZ2luYWxSZWYsIG1vZGlmaWVkUmVmKTtcblx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLmRpZmZXaWRnZXQudmFsdWUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0RGlmZkVkaXRvcldpZGdldCxcblx0XHRcdHRoaXMuZWRpdG9yQ29udGFpbmVyLFxuXHRcdFx0dGhpcy5nZXREaWZmRWRpdG9yT3B0aW9ucygpLFxuXHRcdFx0e30sXG5cdFx0KTtcblx0XHR3aWRnZXQuc2V0TW9kZWwoZWRpdG9yTW9kZWwpO1xuXHRcdGlmIChnZW5lcmF0aW9uID09PSB0aGlzLnJlbmRlckdlbmVyYXRpb24pIHtcblx0XHRcdHRoaXMuYmluZEFjY2VwdEN1cnNvcih3aWRnZXQpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmRpbWVuc2lvbikge1xuXHRcdFx0Y29uc3QgaGVhZGVySGVpZ2h0ID0gdGhpcy5oZWFkZXJFbGVtZW50Py5vZmZzZXRIZWlnaHQgPz8gMDtcblx0XHRcdHdpZGdldC5sYXlvdXQobmV3IGRvbS5EaW1lbnNpb24odGhpcy5kaW1lbnNpb24ud2lkdGgsIE1hdGgubWF4KDAsIHRoaXMuZGltZW5zaW9uLmhlaWdodCAtIGhlYWRlckhlaWdodCkpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlbmRlck1vZGlmaWVkT25seShtb2RpZmllZDogVVJJLCBnZW5lcmF0aW9uOiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuZWRpdG9yQ29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0bGV0IG1vZGlmaWVkUmVmOiBJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD47XG5cdFx0dHJ5IHtcblx0XHRcdG1vZGlmaWVkUmVmID0gYXdhaXQgdGhpcy50ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKG1vZGlmaWVkKTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKGdlbmVyYXRpb24gIT09IHRoaXMucmVuZGVyR2VuZXJhdGlvbikge1xuXHRcdFx0bW9kaWZpZWRSZWYuZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHR0aGlzLm1vZGlmaWVkTW9kZWxSZWYudmFsdWUgPSBtb2RpZmllZFJlZjtcblx0XHR0aGlzLmJvZHlEaXNwb3NhYmxlcy5hZGQobW9kaWZpZWRSZWYpO1xuXG5cdFx0aWYgKGdlbmVyYXRpb24gIT09IHRoaXMucmVuZGVyR2VuZXJhdGlvbikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuY29kZVdpZGdldC52YWx1ZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRDb2RlRWRpdG9yV2lkZ2V0LFxuXHRcdFx0dGhpcy5lZGl0b3JDb250YWluZXIsXG5cdFx0XHRyZWFkT25seUVkaXRvck9wdGlvbnMsXG5cdFx0XHR7IGlzU2ltcGxlV2lkZ2V0OiB0cnVlIH0sXG5cdFx0KTtcblx0XHR3aWRnZXQuc2V0TW9kZWwobW9kaWZpZWRSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbCk7XG5cblx0XHRpZiAodGhpcy5kaW1lbnNpb24pIHtcblx0XHRcdGNvbnN0IGhlYWRlckhlaWdodCA9IHRoaXMuaGVhZGVyRWxlbWVudD8ub2Zmc2V0SGVpZ2h0ID8/IDA7XG5cdFx0XHRjb25zdCBub3RpY2VIZWlnaHQgPSB0aGlzLm5ld0ZpbGVOb3RpY2VFbGVtZW50Py5vZmZzZXRIZWlnaHQgPz8gMDtcblx0XHRcdHdpZGdldC5sYXlvdXQobmV3IGRvbS5EaW1lbnNpb24odGhpcy5kaW1lbnNpb24ud2lkdGgsIE1hdGgubWF4KDAsIHRoaXMuZGltZW5zaW9uLmhlaWdodCAtIGhlYWRlckhlaWdodCAtIG5vdGljZUhlaWdodCkpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyRWRpdG9ycygpOiB2b2lkIHtcblx0XHR0aGlzLmFjY2VwdEN1cnNvciA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLm1vZGVsLmNsZWFyKCk7XG5cdFx0dGhpcy5tb2RpZmllZE1vZGVsUmVmLmNsZWFyKCk7XG5cdFx0dGhpcy5kaWZmV2lkZ2V0LmNsZWFyKCk7XG5cdFx0dGhpcy5jb2RlV2lkZ2V0LmNsZWFyKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFlBQVksU0FBUztBQUNyQixTQUFTLGlCQUE2Qix5QkFBeUI7QUFDL0QsU0FBUyxnQkFBZ0I7QUFHekIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyx3QkFBd0I7QUFHakMsU0FBbUMseUJBQXlCO0FBQzVELFNBQVMsaUJBQWlCLHlCQUF5QjtBQUNuRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGtCQUFrQix1QkFBdUI7QUFDbEQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxnQkFBa0M7QUFDM0MsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxtQ0FBbUMsdUNBQXVDO0FBQ25GLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQXVCLG1CQUFtQjtBQUMxQyxTQUE0QixtQ0FBbUM7QUFDL0Q7QUFBQSxFQUNDO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxPQUNNO0FBQ1AsU0FBUyxpQ0FBaUM7QUFDMUM7QUFBQSxFQUNDO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BQ007QUFDUDtBQUFBLEVBQ0M7QUFBQSxFQUVBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFB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
