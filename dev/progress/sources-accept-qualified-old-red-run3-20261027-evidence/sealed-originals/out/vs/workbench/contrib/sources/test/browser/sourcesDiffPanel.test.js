import assert from "assert";
import { NullCommandService } from "../../../../../platform/commands/test/common/nullCommandService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { timeout } from "../../../../../base/common/async.js";
import { errorHandler, setUnexpectedErrorHandler } from "../../../../../base/common/errors.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { localize } from "../../../../../nls.js";
import { isIMenuItem, MenuId, MenuRegistry } from "../../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { IUniverseAgentConnection } from "../../../../../platform/universeAgent/common/universeAgentConnection.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { ITextFileService } from "../../../../services/textfile/common/textfiles.js";
import { IDiffProviderFactoryService } from "../../../../../editor/browser/widget/diffEditor/diffProviderFactoryService.js";
import { TestDiffProviderFactoryService } from "../../../../../editor/test/browser/diff/testDiffProviderFactoryService.js";
import { IUserInteractionService, MockUserInteractionService } from "../../../../../platform/userInteraction/browser/userInteractionService.js";
import { isConversationPairingHold } from "../../../conversation/browser/conversationSessionStatus.js";
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewDescriptorService, ViewContainerLocation } from "../../../../common/views.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
import { workbenchInstantiationService, TestEditorGroupView, TestEditorInput, TestViewsService } from "../../../../test/browser/workbenchTestServices.js";
import { IConversationRosterService } from "../../../conversation/browser/conversationStubService.js";
import { IAgentSessionContext } from "../../../../services/agentSession/common/agentSessionContext.js";
import { ISCMService } from "../../../scm/common/scm.js";
import { ConversationDiffReviewEditorId } from "../../../../common/editor/conversationDiffReviewInput.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ConversationDiffReviewInput } from "../../browser/conversationDiffReviewInput.js";
import { ConversationDiffReviewPane } from "../../browser/conversationDiffReviewPane.js";
import { openSourcesChangeEntry } from "../../browser/sourcesChangeEntryOpen.js";
import { createSourcesConversationOpenHarness } from "./sourcesConversationOpenHarness.js";
import { SOURCES_DIFF_MOVE_TO_CONVERSATION_VIEW_COMMAND, SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND, SOURCES_DIFF_MOVE_TO_PREVIEW_VIEW_COMMAND } from "../../browser/sourcesDiffActions.js";
import { moveActiveDiffToConversation, resolveSourcesChangeRefFromEditor } from "../../browser/sourcesDiffRefHelpers.js";
import { SOURCES_DIFF_PANEL_VIEW_CONTAINER } from "../../browser/sourcesDiffPanel.contribution.js";
import { SOURCES_DIFF_PANEL_CONTAINER_ID, SOURCES_DIFF_PANEL_VIEW_ID } from "../../browser/sourcesDiffPanelIds.js";
import { SourcesDiffPanelService } from "../../browser/sourcesDiffPanelService.js";
import { SourcesDiffPanelView } from "../../browser/sourcesDiffPanelView.js";
import { DiffEditorWidget } from "../../../../../editor/browser/widget/diffEditor/diffEditorWidget.js";
import { sourcesGitApplyHunksPatches } from "../../common/sourcesChangeRef.js";
import { SOURCES_GIT_APPLY_CACHED_ARGV, sourcesGitHunkPatchAtCursor } from "../../common/sourcesGitHunkPatch.js";
import { ISourcesChangesModel } from "../../common/sourcesChangesModel.js";
import { SourcesChangesModel } from "../../common/sourcesChangesReadModel.js";
import { ISourcesDiffPanelService } from "../../common/sourcesDiffPanelService.js";
import { sourcesDiffAcceptUnavailableMessage } from "../../common/sourcesDiffWriteController.js";
import { canSendSourcesGitApplyHunks, canSendSourcesGitStagePaths, canShowSourcesReviewAccept, resolveSourcesDiffWriteActions, sourcesGitEmptyStagePathMessage, sourcesGitSessionChangedMessage } from "../../common/sourcesChangesGitWrite.js";
function evalWhen(when, values) {
  if (!when) {
    return true;
  }
  return when.evaluate({ getValue: (key) => values[key] });
}
suite("Sources diff panel", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  const viewContainersRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
  const viewsRegistry = Registry.as(ViewExtensions.ViewsRegistry);
  test("Diff panel container and view register on Panel with hideIfEmpty", () => {
    const container = viewContainersRegistry.get(SOURCES_DIFF_PANEL_CONTAINER_ID);
    assert.ok(container, "Sources diff panel container should be registered");
    assert.strictEqual(container, SOURCES_DIFF_PANEL_VIEW_CONTAINER);
    assert.strictEqual(container.hideIfEmpty, true);
    assert.strictEqual(
      viewContainersRegistry.getViewContainerLocation(container),
      ViewContainerLocation.Panel,
      "Sources diff panel must live on PANEL_PART"
    );
    const viewDescriptor = viewsRegistry.getView(SOURCES_DIFF_PANEL_VIEW_ID);
    assert.ok(viewDescriptor, "Sources diff panel view should be registered");
    assert.strictEqual(viewsRegistry.getViewContainer(SOURCES_DIFF_PANEL_VIEW_ID), container);
    assert.strictEqual(viewDescriptor.when, SourcesDiffPanelService.ctxHasChange);
  });
  test("show enables view context and clear disables it for hideIfEmpty", async function() {
    const resource = toResource.call(this, "/project/src/a.ts");
    const ref = {
      modified: resource,
      original: toResource.call(this, "/project/src/a.ts.git"),
      groupId: "workingTree"
    };
    const openViewCalls = [];
    class TrackingViewsService extends TestViewsService {
      openView(id, focus) {
        openViewCalls.push({ id, focus });
        return Promise.resolve(null);
      }
      dispose() {
      }
    }
    const instantiationService = workbenchInstantiationService(void 0, store);
    const viewsService = store.add(new TrackingViewsService());
    instantiationService.stub(IViewsService, viewsService);
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    const contextKeyService = instantiationService.get(IContextKeyService);
    const ctxValues = () => ({
      [SourcesDiffPanelService.ctxHasChange.key]: contextKeyService.getContextKeyValue(SourcesDiffPanelService.ctxHasChange.key) ?? false,
      view: SOURCES_DIFF_PANEL_VIEW_ID
    });
    assert.strictEqual(
      evalWhen(SourcesDiffPanelService.ctxHasChange, ctxValues()),
      false,
      "hideIfEmpty container must start inactive"
    );
    assert.strictEqual(await panelService.show(ref), false);
    assert.strictEqual(panelService.getCurrentRef(), ref);
    assert.strictEqual(
      evalWhen(SourcesDiffPanelService.ctxHasChange, ctxValues()),
      true,
      "show must activate the diff panel view"
    );
    assert.deepStrictEqual(openViewCalls, [{ id: SOURCES_DIFF_PANEL_VIEW_ID, focus: true }]);
    panelService.clear();
    assert.strictEqual(panelService.getCurrentRef(), void 0);
    assert.strictEqual(
      evalWhen(SourcesDiffPanelService.ctxHasChange, ctxValues()),
      false,
      "clear must deactivate the diff panel view"
    );
  });
  test("show replaces the current change ref", async function() {
    const resourceA = toResource.call(this, "/project/src/a.ts");
    const resourceB = toResource.call(this, "/project/src/b.ts");
    const refA = { modified: resourceA, original: void 0, groupId: "workingTree" };
    const refB = { modified: resourceB, original: void 0, groupId: "workingTree" };
    const changes = [];
    const instantiationService = workbenchInstantiationService(void 0, store);
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    store.add(panelService.onDidChangeRef((ref) => changes.push(ref?.modified)));
    await panelService.show(refA);
    await panelService.show(refB);
    assert.strictEqual(panelService.getCurrentRef()?.modified.toString(), resourceB.toString());
    assert.deepStrictEqual(changes.map((uri) => uri?.toString()), [resourceA.toString(), resourceB.toString()]);
  });
  test("panel ViewTitle exposes move to conversation and preview actions", () => {
    const viewTitleItems = MenuRegistry.getMenuItems(MenuId.ViewTitle).filter(isIMenuItem);
    const moveToConversation = viewTitleItems.find((item) => item.command.id === SOURCES_DIFF_MOVE_TO_CONVERSATION_VIEW_COMMAND);
    const moveToPreview = viewTitleItems.find((item) => item.command.id === SOURCES_DIFF_MOVE_TO_PREVIEW_VIEW_COMMAND);
    assert.ok(moveToConversation, "Panel view title must expose move to conversation");
    assert.ok(moveToPreview, "Panel view title must expose move to preview");
    assert.ok(moveToConversation.when, "Panel move to conversation must be gated");
    assert.ok(moveToPreview.when, "Panel move to preview must be gated");
    assert.strictEqual(
      evalWhen(moveToConversation.when, { view: SOURCES_DIFF_PANEL_VIEW_ID, [SourcesDiffPanelService.ctxHasChange.key]: true }),
      true
    );
    assert.strictEqual(
      evalWhen(moveToPreview.when, { view: SOURCES_DIFF_PANEL_VIEW_ID, [SourcesDiffPanelService.ctxHasChange.key]: false }),
      false
    );
  });
  test("EditorTitle exposes move to preview when Conversation Diff is active", () => {
    const editorTitleItems = MenuRegistry.getMenuItems(MenuId.EditorTitle).filter(isIMenuItem);
    const moveToPreview = editorTitleItems.find((item) => item.command.id === SOURCES_DIFF_MOVE_TO_PREVIEW_COMMAND);
    assert.ok(moveToPreview, "Conversation Diff editor title must expose move to preview");
    assert.ok(moveToPreview.when, "Conversation Diff move to preview must be gated");
    assert.strictEqual(
      evalWhen(moveToPreview.when, { activeEditor: ConversationDiffReviewEditorId }),
      true
    );
    assert.strictEqual(
      evalWhen(moveToPreview.when, { activeEditor: "workbench.editor.files.textFileEditor" }),
      false
    );
  });
  function createViewDescriptorServiceStub() {
    return {
      getViewLocationById: () => ViewContainerLocation.Panel,
      onDidChangeLocation: Event.None,
      getViewDescriptorById: () => null,
      getViewContainerByViewId: () => ({
        id: SOURCES_DIFF_PANEL_CONTAINER_ID,
        title: { value: "Diff", original: "Diff" },
        ctorDescriptor: {}
      }),
      getViewContainerModel: () => ({
        onDidChangeContainerInfo: Event.None
      }),
      getDefaultContainerById: () => null
    };
  }
  function createLiveScmService(resource, liveGroupId) {
    const group = {
      id: liveGroupId,
      label: liveGroupId === "index" ? "Staged Changes" : "Changes",
      resources: []
    };
    const scmResource = {
      sourceUri: resource,
      resourceGroup: group,
      decorations: {},
      open: async () => {
      }
    };
    group.resources.push(scmResource);
    const repository = {
      provider: {
        groups: [group],
        rootUri: resource,
        onDidChangeResources: Event.None,
        onDidChangeResourceGroups: Event.None
      }
    };
    return {
      _serviceBrand: void 0,
      get repositories() {
        return [repository];
      },
      get repositoryCount() {
        return 1;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
  }
  function createLeftoverScmService(resource, groupId = "workingTree") {
    const group = {
      id: groupId,
      label: groupId === "index" ? "Staged Changes" : "Changes",
      resources: []
    };
    const scmResource = {
      sourceUri: resource,
      resourceGroup: group,
      decorations: {},
      open: async () => {
      }
    };
    group.resources.push(scmResource);
    const repository = {
      provider: {
        groups: [group],
        rootUri: resource,
        onDidChangeResources: Event.None,
        onDidChangeResourceGroups: Event.None
      }
    };
    return {
      _serviceBrand: void 0,
      get repositories() {
        return [repository];
      },
      get repositoryCount() {
        return 1;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
  }
  function emptyDiffScmService() {
    return {
      _serviceBrand: void 0,
      get repositories() {
        return [];
      },
      get repositoryCount() {
        return 0;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
  }
  function stubSessionAndChangesModel(instantiationService, connection, engineSessionReady) {
    instantiationService.stub(IAgentSessionContext, {
      _serviceBrand: void 0,
      getActiveSessionId: () => "session-1",
      isEngineSessionReady: () => engineSessionReady,
      isPairingHold: () => {
        const phase = typeof connection.getConnectionPhase === "function" ? connection.getConnectionPhase() : void 0;
        const snapshot = typeof connection.getConnectionSnapshot === "function" ? connection.getConnectionSnapshot() : void 0;
        return phase?.kind === "connected" && !!snapshot?.pairingPending;
      },
      onDidChangeActiveSession: Event.None,
      onDidChangeSession: Event.None,
      acquireSessionView: () => {
        throw new Error("not used");
      }
    });
    instantiationService.stub(ISourcesChangesModel, store.add(instantiationService.createInstance(SourcesChangesModel)));
  }
  function stubDiffHonestyServices(options = {}) {
    const instantiationService = workbenchInstantiationService(void 0, store);
    instantiationService.stub(IDiffProviderFactoryService, new TestDiffProviderFactoryService());
    instantiationService.stub(IUserInteractionService, new MockUserInteractionService());
    instantiationService.stub(IViewDescriptorService, createViewDescriptorServiceStub());
    const connection = options.connection ?? {
      isEngineConnected: () => false,
      onDidChangeConnection: Event.None
    };
    instantiationService.stub(IUniverseAgentConnection, connection);
    instantiationService.stub(IConversationRosterService, {
      getActiveSessionId: () => "session-1",
      onDidChangeActiveSession: Event.None,
      onDidChangeSession: Event.None,
      isEngineSessionReady: () => options.engineSessionReady ?? true
    });
    instantiationService.stub(ISCMService, options.resource ? createLeftoverScmService(options.resource, options.groupId) : emptyDiffScmService());
    stubSessionAndChangesModel(instantiationService, connection, options.engineSessionReady ?? true);
    instantiationService.stub(ICommandService, {
      onWillExecuteCommand: Event.None,
      onDidExecuteCommand: Event.None,
      executeCommand: options.executeCommand ?? (async () => void 0)
    });
    if (options.throwOnLoad) {
      instantiationService.stub(ITextModelService, {
        createModelReference: async () => {
          throw new Error("boom");
        }
      });
    }
    return instantiationService;
  }
  test("Panel Accept is hidden without ApplyHunks payload; SCM local action is Stage", () => {
    assert.strictEqual(canShowSourcesReviewAccept(true, false), false);
    const scmOnly = resolveSourcesDiffWriteActions({
      groupId: "workingTree",
      hasScmResource: true,
      canWriteStage: false,
      canWriteAccept: true,
      hasApplyHunksPayload: false,
      hasGitStageCommand: true,
      hasGitUnstageCommand: false,
      hasGitCleanCommand: false
    });
    assert.strictEqual(scmOnly.showStage, true);
    assert.strictEqual(scmOnly.showAccept, false);
  });
  test("Diff panel load fail hides title authority and write chrome", async function() {
    const resource = toResource.call(this, "/project/src/a.ts");
    const original = toResource.call(this, "/project/src/a.ts.git");
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({ throwOnLoad: true, resource });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      assert.strictEqual(await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      }), false);
      await timeout(50);
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-title")?.textContent ?? "", "");
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-stage")?.style.display, "none");
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-accept")?.style.display, "none");
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-revert")?.style.display, "none");
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-unstage")?.style.display, "none");
      assert.strictEqual(
        view.element.querySelector(".sources-diff-panel-new-file-notice")?.textContent ?? "",
        localize("sourcesDiffPanel.loadFailed", "Unable to load this comparison.")
      );
      assert.ok(view.element.querySelector(".sources-diff-panel-new-file-notice")?.classList.contains("is-error"));
      assert.ok(!(view.element.querySelector(".sources-diff-panel-new-file-notice")?.textContent ?? "").includes("New file"));
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-header")?.style.display, "none");
    } finally {
      stageCommand.dispose();
    }
  });
  test("superseded async render cannot paint an older file diff", async function() {
    const resourceA = toResource.call(this, "/project/src/stale-panel-a.ts");
    const resourceB = toResource.call(this, "/project/src/stale-panel-b.ts");
    const originalA = toResource.call(this, "/project/src/stale-panel-a.ts.git");
    const originalB = toResource.call(this, "/project/src/stale-panel-b.ts.git");
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    let textFileService;
    let view;
    try {
      let releaseStale;
      const staleGate = new Promise((resolve) => {
        releaseStale = resolve;
      });
      const instantiationService = stubDiffHonestyServices({ resource: resourceA });
      textFileService = instantiationService.get(ITextFileService);
      const fakeWidget = {
        setModel: () => {
        },
        getModifiedEditor: () => ({ onDidChangeCursorPosition: Event.None, onDidFocusEditorText: Event.None, hasTextFocus: () => false, getPosition: () => void 0 }),
        getOriginalEditor: () => ({ onDidChangeCursorPosition: Event.None, onDidFocusEditorText: Event.None, hasTextFocus: () => false, getPosition: () => void 0 }),
        layout: () => {
        },
        dispose: () => {
        }
      };
      instantiationService.stubInstance(DiffEditorWidget, fakeWidget);
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      const renderHost = view;
      const renderDiff = renderHost.renderDiff.bind(view);
      let renderCalls = 0;
      renderHost.renderDiff = async (original, modified, generation) => {
        renderCalls++;
        if (renderCalls === 1) {
          await staleGate;
        }
        return renderDiff(original, modified, generation);
      };
      const shownA = panelService.show({
        modified: resourceA,
        original: originalA,
        groupId: "workingTree"
      });
      await timeout(0);
      const shownB = panelService.show({
        modified: resourceB,
        original: originalB,
        groupId: "workingTree"
      });
      await timeout(50);
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-title")?.textContent, "stale-panel-b.ts");
      releaseStale();
      await timeout(50);
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-title")?.textContent, "stale-panel-b.ts");
      assert.strictEqual(await shownA, false);
      assert.strictEqual(await shownB, true);
    } finally {
      for (const model of textFileService?.files.models ?? []) {
        model.dispose();
      }
      view?.dispose();
      await timeout(0);
      stageCommand.dispose();
    }
  });
  test("connection change during renderRef keeps write chrome hidden until comparison loads", async function() {
    const resource = toResource.call(this, "/project/src/render-pending-write.ts");
    const original = toResource.call(this, "/project/src/render-pending-write.ts.git");
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      let releaseLoad;
      const loadGate = new Promise((resolve) => {
        releaseLoad = resolve;
      });
      const onDidChangeConnection = new Emitter();
      const connection = {
        isEngineConnected: () => false,
        getConnectionSnapshot: () => ({ pairingPending: false }),
        onDidChangeConnection: onDidChangeConnection.event
      };
      const instantiationService = stubDiffHonestyServices({ resource, connection });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      const renderHost = view;
      renderHost.renderDiff = async () => {
        await loadGate;
        return true;
      };
      const shown = panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(0);
      paintPanelWriteChrome(view);
      onDidChangeConnection.fire();
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-stage")?.style.display, "none");
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-accept")?.style.display, "none");
      releaseLoad();
      await timeout(50);
      assert.strictEqual(await shown, true);
      assert.strictEqual(view.element.querySelector(".sources-diff-panel-stage")?.style.display, "");
      onDidChangeConnection.dispose();
    } finally {
      stageCommand.dispose();
    }
  });
  test("Conversation Diff load fail hides write chrome and only keeps loadFailed", async function() {
    const resource = toResource.call(this, "/project/src/a.ts");
    const original = toResource.call(this, "/project/src/a.ts.git");
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({ throwOnLoad: true, resource });
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      assert.strictEqual(parent.querySelector(".conversation-diff-review-stage")?.style.display, "none");
      assert.strictEqual(parent.querySelector(".conversation-diff-review-accept")?.style.display, "none");
      assert.strictEqual(parent.querySelector(".conversation-diff-review-revert")?.style.display, "none");
      assert.strictEqual(parent.querySelector(".conversation-diff-review-unstage")?.style.display, "none");
      assert.strictEqual(
        parent.querySelector(".conversation-diff-review-notice")?.textContent ?? "",
        localize("conversationDiffReviewPane.loadFailed", "Unable to load this comparison.")
      );
      assert.ok(parent.querySelector(".conversation-diff-review-notice")?.classList.contains("is-error"));
      assert.ok(!(parent.querySelector(".conversation-diff-review-notice")?.textContent ?? "").includes("New file"));
      assert.strictEqual(parent.querySelector(".conversation-diff-review-toolbar")?.style.display, "none");
      assert.strictEqual(parent.querySelector(".conversation-diff-review-open-preview")?.style.display, "none");
    } finally {
      stageCommand.dispose();
    }
  });
  test("Conversation runGitAction success clears notice and failure keeps it", async function() {
    const resource = toResource.call(this, "/project/src/a.ts");
    const original = toResource.call(this, "/project/src/a.ts.git");
    let shouldFail = false;
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      resource,
      executeCommand: async () => {
        if (shouldFail) {
          throw new Error("boom");
        }
      }
    });
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    const runner = pane;
    await runner.runGitAction("git.stage");
    assert.strictEqual(parent.querySelector(".conversation-diff-review-notice")?.style.display, "none");
    shouldFail = true;
    await runner.runGitAction("git.stage");
    assert.strictEqual(parent.querySelector(".conversation-diff-review-notice")?.textContent ?? "", "boom");
    assert.notStrictEqual(parent.querySelector(".conversation-diff-review-notice")?.style.display, "none");
  });
  function forceClick(button) {
    if (!button) {
      return;
    }
    button.style.display = "";
    button.removeAttribute("disabled");
    button.setAttribute("aria-disabled", "false");
    if ("disabled" in button) {
      button.disabled = false;
    }
    button.click();
  }
  async function assertWarnThenRethrowDoesNotLeak(paintBoom, run) {
    const unexpectedWarns = [];
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
    setUnexpectedErrorHandler((error) => {
      unexpectedWarns.push(error);
      if (unexpectedWarns.length === 1) {
        throw error;
      }
    });
    try {
      await run();
      await timeout(0);
      assert.deepStrictEqual({ unhandledRejections, unexpectedWarns }, {
        unhandledRejections: [],
        unexpectedWarns: [paintBoom, paintBoom]
      });
    } finally {
      setUnexpectedErrorHandler(originalErrorHandler);
      process.off("unhandledRejection", onUnhandledRejection);
    }
  }
  function leftoverLooksLiveApplyConnection(applyCalls, stageCalls = [], pairingPending = true) {
    const acceptedWrite = {
      supported: true,
      reason: "",
      success: true,
      errorMessage: "",
      exitCode: 0,
      stdout: ""
    };
    return {
      isEngineConnected: () => true,
      getConnectionPhase: () => ({ kind: "connected" }),
      getConnectionSnapshot: () => ({ pairingPending }),
      onDidChangeConnection: Event.None,
      writeGitApplyHunks: async (request) => {
        applyCalls.push(request);
        return acceptedWrite;
      },
      writeGitStagePaths: async (request) => {
        stageCalls.push(request);
        return acceptedWrite;
      }
    };
  }
  const carriedUnifiedDiff = "@@ -1 +1 @@\n-old\n+new\n";
  test("leftover-looks-live pairing-hold Accept chrome stays hidden and 0 unary", async function() {
    const resource = toResource.call(this, "/project/src/leftover.ts");
    const original = toResource.call(this, "/project/src/leftover.ts.git");
    const applyCalls = [];
    const connection = leftoverLooksLiveApplyConnection(applyCalls);
    assert.strictEqual(connection.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(canSendSourcesGitApplyHunks(true, true, isConversationPairingHold(connection)), false);
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      resource,
      connection
    });
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    await panelService.show({
      modified: resource,
      original,
      groupId: "workingTree"
    });
    await timeout(50);
    paintPanelWriteChrome(view);
    const panelAccept = view.element.querySelector(".sources-diff-panel-accept");
    assert.strictEqual(panelAccept?.style.display, "none");
    forceClick(panelAccept);
    await view.runAccept();
    await timeout(20);
    assert.deepStrictEqual(applyCalls, []);
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    await timeout(20);
    paintReviewWriteChrome(pane);
    const reviewAccept = parent.querySelector(".conversation-diff-review-accept");
    assert.strictEqual(reviewAccept?.style.display, "none");
    forceClick(reviewAccept);
    await pane.runAccept();
    await timeout(20);
    assert.deepStrictEqual(applyCalls, []);
  });
  test("leftover-looks-live pairing-hold Stage chrome stays hidden and 0 unary / 0 git.stage", async function() {
    const resource = toResource.call(this, "/project/src/leftover-stage.ts");
    const original = toResource.call(this, "/project/src/leftover-stage.ts.git");
    const applyCalls = [];
    const stageCalls = [];
    const gitStageCommands = [];
    const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls);
    assert.strictEqual(connection.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(canSendSourcesGitStagePaths(true, true, "session-1", isConversationPairingHold(connection)), false);
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      resource,
      connection,
      executeCommand: async (commandId) => {
        if (commandId === "git.stage") {
          gitStageCommands.push(commandId);
        }
      }
    });
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    await panelService.show({
      modified: resource,
      original,
      groupId: "workingTree"
    });
    await timeout(50);
    const panelStage = view.element.querySelector(".sources-diff-panel-stage");
    assert.strictEqual(panelStage?.style.display, "none");
    forceClick(panelStage);
    await view.runStage();
    await timeout(20);
    assert.deepStrictEqual(stageCalls, []);
    assert.deepStrictEqual(gitStageCommands, []);
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    await timeout(20);
    const reviewStage = parent.querySelector(".conversation-diff-review-stage");
    assert.strictEqual(reviewStage?.style.display, "none");
    forceClick(reviewStage);
    await pane.runStage();
    await timeout(20);
    assert.deepStrictEqual(stageCalls, []);
    assert.deepStrictEqual(gitStageCommands, []);
    assert.deepStrictEqual(applyCalls, []);
  });
  function leftoverConnectedConnection(pairingPending) {
    return leftoverLooksLiveApplyConnection([], [], pairingPending);
  }
  function paintPanelWriteChrome(view) {
    const host = view;
    host.comparisonLoadFailed = false;
    host.updateWriteActions();
  }
  test("Diff panel keeps stored index when live SCM is only workingTree", async function() {
    const resource = toResource.call(this, "/project/src/engine-stage-stale-ref-index.ts");
    const original = toResource.call(this, "/project/src/engine-stage-stale-ref-index.ts.git");
    const stageCalls = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = workbenchInstantiationService(void 0, store);
      instantiationService.stub(IViewDescriptorService, createViewDescriptorServiceStub());
      instantiationService.stub(IUniverseAgentConnection, connection);
      instantiationService.stub(IConversationRosterService, {
        getActiveSessionId: () => "session-1",
        onDidChangeActiveSession: Event.None,
        onDidChangeSession: Event.None,
        isEngineSessionReady: () => true
      });
      instantiationService.stub(ISCMService, createLiveScmService(resource, "workingTree"));
      stubSessionAndChangesModel(instantiationService, connection, true);
      instantiationService.stub(ICommandService, {
        onWillExecuteCommand: Event.None,
        onDidExecuteCommand: Event.None,
        executeCommand: async () => void 0
      });
      instantiationService.stub(ITextModelService, {
        createModelReference: async () => {
          throw new Error("boom");
        }
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "index"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const context = view.getWriteContext();
      assert.strictEqual(context?.groupId, "index");
      const panelStage = view.element.querySelector(".sources-diff-panel-stage");
      assert.strictEqual(panelStage?.style.display, "none");
      await view.runStage();
      await timeout(20);
      assert.strictEqual(stageCalls.length, 1);
      assert.strictEqual(panelStage?.style.display, "none");
    } finally {
      stageCommand.dispose();
    }
  });
  test("Diff panel does not record engine stage hide mask when ref and live SCM are index", async function() {
    const resource = toResource.call(this, "/project/src/engine-stage-index-only.ts");
    const original = toResource.call(this, "/project/src/engine-stage-index-only.ts.git");
    const stageCalls = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "index",
        connection
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "index"
      });
      await timeout(50);
      await view.runStage();
      await timeout(20);
      assert.strictEqual(stageCalls.length, 1);
      const host = view;
      assert.strictEqual(host.writeCollapse, void 0);
    } finally {
      stageCommand.dispose();
    }
  });
  test("Diff panel hides Stage after engine WriteGitStagePaths accepted until ref changes", async function() {
    const resource = toResource.call(this, "/project/src/engine-stage-accepted.ts");
    const original = toResource.call(this, "/project/src/engine-stage-accepted.ts.git");
    const stageCalls = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelStage = view.element.querySelector(".sources-diff-panel-stage");
      assert.strictEqual(panelStage?.style.display, "");
      await view.runStage();
      await timeout(20);
      assert.strictEqual(stageCalls.length, 1);
      assert.strictEqual(panelStage?.style.display, "none");
      const other = toResource.call(this, "/project/src/engine-stage-other.ts");
      await panelService.show({
        modified: other,
        original: toResource.call(this, "/project/src/engine-stage-other.ts.git"),
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      assert.strictEqual(panelStage?.style.display, "");
    } finally {
      stageCommand.dispose();
    }
  });
  test("Diff panel hides Revert after git.clean succeeds until ref changes", async function() {
    const resource = toResource.call(this, "/project/src/git-clean-revert-hide.ts");
    const original = toResource.call(this, "/project/src/git-clean-revert-hide.ts.git");
    const group = {
      id: "workingTree",
      label: "Changes",
      resources: []
    };
    const cachedScmResource = {
      sourceUri: resource,
      resourceGroup: group,
      decorations: {},
      open: async () => {
      }
    };
    group.resources.push(cachedScmResource);
    const scmService = {
      _serviceBrand: void 0,
      get repositories() {
        return [{
          provider: {
            groups: [group],
            rootUri: resource,
            onDidChangeResources: Event.None,
            onDidChangeResourceGroups: Event.None
          }
        }];
      },
      get repositoryCount() {
        return 1;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
    const cleanCommand = CommandsRegistry.registerCommand("git.clean", () => {
      group.resources.length = 0;
    });
    const disconnectedConnection = {
      isEngineConnected: () => false,
      getConnectionSnapshot: () => ({}),
      onDidChangeConnection: Event.None
    };
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection: disconnectedConnection
      });
      instantiationService.stub(ISCMService, scmService);
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree",
        scmResource: cachedScmResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelRevert = view.element.querySelector(".sources-diff-panel-revert");
      assert.strictEqual(panelRevert?.style.display, "");
      await view.runGitAction("git.clean");
      await timeout(20);
      assert.strictEqual(panelRevert?.style.display, "none");
      const other = toResource.call(this, "/project/src/git-clean-revert-other.ts");
      const otherOriginal = toResource.call(this, "/project/src/git-clean-revert-other.ts.git");
      const otherScmResource = {
        sourceUri: other,
        resourceGroup: group,
        decorations: {},
        open: async () => {
        }
      };
      group.resources.push(otherScmResource);
      await panelService.show({
        modified: other,
        original: otherOriginal,
        groupId: "workingTree",
        scmResource: otherScmResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      assert.strictEqual(panelRevert?.style.display, "");
    } finally {
      cleanCommand.dispose();
    }
  });
  test("Conversation hides Revert after git.clean succeeds", async function() {
    const resource = toResource.call(this, "/project/src/conversation-revert-hide.ts");
    const original = toResource.call(this, "/project/src/conversation-revert-hide.ts.git");
    const cleanCommand = CommandsRegistry.registerCommand("git.clean", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree"
      });
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const reviewRevert = parent.querySelector(".conversation-diff-review-revert");
      assert.strictEqual(reviewRevert?.style.display, "");
      await pane.runGitAction("git.clean");
      await timeout(20);
      assert.strictEqual(reviewRevert?.style.display, "none");
    } finally {
      cleanCommand.dispose();
    }
  });
  test("Diff panel hides Unstage after git.unstage succeeds until ref changes", async function() {
    const resource = toResource.call(this, "/project/src/git-unstage-hide.ts");
    const original = toResource.call(this, "/project/src/git-unstage-hide.ts.git");
    const group = {
      id: "index",
      label: "Staged Changes",
      resources: []
    };
    const cachedScmResource = {
      sourceUri: resource,
      resourceGroup: group,
      decorations: {},
      open: async () => {
      }
    };
    group.resources.push(cachedScmResource);
    const scmService = {
      _serviceBrand: void 0,
      get repositories() {
        return [{
          provider: {
            groups: [group],
            rootUri: resource,
            onDidChangeResources: Event.None,
            onDidChangeResourceGroups: Event.None
          }
        }];
      },
      get repositoryCount() {
        return 1;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
    const unstageCommand = CommandsRegistry.registerCommand("git.unstage", () => {
    });
    const disconnectedConnection = {
      isEngineConnected: () => false,
      getConnectionSnapshot: () => ({}),
      onDidChangeConnection: Event.None
    };
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "index",
        connection: disconnectedConnection
      });
      instantiationService.stub(ISCMService, scmService);
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "index",
        scmResource: cachedScmResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelUnstage = view.element.querySelector(".sources-diff-panel-unstage");
      assert.strictEqual(panelUnstage?.style.display, "");
      await view.runGitAction("git.unstage");
      await timeout(20);
      assert.strictEqual(panelUnstage?.style.display, "none");
      const other = toResource.call(this, "/project/src/git-unstage-other.ts");
      const otherOriginal = toResource.call(this, "/project/src/git-unstage-other.ts.git");
      const otherScmResource = {
        sourceUri: other,
        resourceGroup: group,
        decorations: {},
        open: async () => {
        }
      };
      group.resources.push(otherScmResource);
      await panelService.show({
        modified: other,
        original: otherOriginal,
        groupId: "index",
        scmResource: otherScmResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      assert.strictEqual(panelUnstage?.style.display, "");
    } finally {
      unstageCommand.dispose();
    }
  });
  test("Diff panel keeps cached index group when that URI now lives only in workingTree", async function() {
    const resource = toResource.call(this, "/project/src/live-scm-after-unstage.ts");
    const original = toResource.call(this, "/project/src/live-scm-after-unstage.ts.git");
    const indexGroup = {
      id: "index",
      label: "Staged Changes",
      resources: []
    };
    const cachedScmResource = {
      sourceUri: resource,
      resourceGroup: indexGroup,
      decorations: {},
      open: async () => {
      }
    };
    const workingTreeGroup = {
      id: "workingTree",
      label: "Changes",
      resources: []
    };
    const liveScmResource = {
      sourceUri: resource,
      resourceGroup: workingTreeGroup,
      decorations: {},
      open: async () => {
      }
    };
    workingTreeGroup.resources.push(liveScmResource);
    const scmService = {
      _serviceBrand: void 0,
      get repositories() {
        return [{
          provider: {
            groups: [indexGroup, workingTreeGroup],
            rootUri: resource,
            onDidChangeResources: Event.None,
            onDidChangeResourceGroups: Event.None
          }
        }];
      },
      get repositoryCount() {
        return 1;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    const disconnectedConnection = {
      isEngineConnected: () => false,
      getConnectionSnapshot: () => ({}),
      onDidChangeConnection: Event.None
    };
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection: disconnectedConnection
      });
      instantiationService.stub(ISCMService, scmService);
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "index",
        scmResource: cachedScmResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const context = view.getWriteContext();
      assert.strictEqual(context?.groupId, "index");
      assert.strictEqual(context?.scmResource, cachedScmResource);
      const panelStage = view.element.querySelector(".sources-diff-panel-stage");
      const panelUnstage = view.element.querySelector(".sources-diff-panel-unstage");
      assert.strictEqual(panelStage?.style.display, "none");
      assert.strictEqual(panelUnstage?.style.display, "none");
    } finally {
      stageCommand.dispose();
    }
  });
  test("Diff panel write chrome falls back to ref scmResource when URI is absent from SCM", async function() {
    const resource = toResource.call(this, "/project/src/ref-scm-fallback.ts");
    const original = toResource.call(this, "/project/src/ref-scm-fallback.ts.git");
    const indexGroup = {
      id: "index",
      label: "Staged Changes",
      resources: []
    };
    const cachedScmResource = {
      sourceUri: resource,
      resourceGroup: indexGroup,
      decorations: {},
      open: async () => {
      }
    };
    const scmService = {
      _serviceBrand: void 0,
      get repositories() {
        return [{
          provider: {
            groups: [indexGroup],
            rootUri: resource,
            onDidChangeResources: Event.None,
            onDidChangeResourceGroups: Event.None
          }
        }];
      },
      get repositoryCount() {
        return 1;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
    const unstageCommand = CommandsRegistry.registerCommand("git.unstage", () => {
    });
    const disconnectedConnection = {
      isEngineConnected: () => false,
      getConnectionSnapshot: () => ({}),
      onDidChangeConnection: Event.None
    };
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "index",
        connection: disconnectedConnection
      });
      instantiationService.stub(ISCMService, scmService);
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "index",
        scmResource: cachedScmResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const context = view.getWriteContext();
      assert.strictEqual(context?.groupId, "index");
      const panelStage = view.element.querySelector(".sources-diff-panel-stage");
      const panelUnstage = view.element.querySelector(".sources-diff-panel-unstage");
      assert.strictEqual(panelStage?.style.display, "none");
      assert.strictEqual(panelUnstage?.style.display, "");
    } finally {
      unstageCommand.dispose();
    }
  });
  test("opened workingTree shows Revert and engine FileDiff without scmResource does not take index", async function() {
    const resource = toResource.call(this, "/project/src/both-groups.ts");
    const original = toResource.call(this, "/project/src/both-groups.ts.git");
    const indexGroup = {
      id: "index",
      label: "Staged Changes",
      resources: []
    };
    const workingTreeGroup = {
      id: "workingTree",
      label: "Changes",
      resources: []
    };
    const indexResource = {
      sourceUri: resource,
      resourceGroup: indexGroup,
      decorations: {},
      open: async () => {
      }
    };
    const workingTreeResource = {
      sourceUri: resource,
      resourceGroup: workingTreeGroup,
      decorations: {},
      open: async () => {
      }
    };
    indexGroup.resources.push(indexResource);
    workingTreeGroup.resources.push(workingTreeResource);
    const scmService = {
      _serviceBrand: void 0,
      get repositories() {
        return [{
          provider: {
            groups: [indexGroup, workingTreeGroup],
            rootUri: resource,
            onDidChangeResources: Event.None,
            onDidChangeResourceGroups: Event.None
          }
        }];
      },
      get repositoryCount() {
        return 1;
      },
      onDidAddRepository: Event.None,
      onDidRemoveRepository: Event.None,
      registerSCMProvider: () => {
        throw new Error("not implemented");
      },
      getRepository: () => void 0
    };
    const cleanCommand = CommandsRegistry.registerCommand("git.clean", () => {
    });
    const unstageCommand = CommandsRegistry.registerCommand("git.unstage", () => {
    });
    const disconnectedConnection = {
      isEngineConnected: () => false,
      getConnectionSnapshot: () => ({}),
      onDidChangeConnection: Event.None
    };
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection: disconnectedConnection
      });
      instantiationService.stub(ISCMService, scmService);
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree",
        scmResource: workingTreeResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelContext = view.getWriteContext();
      assert.strictEqual(panelContext?.groupId, "workingTree");
      assert.strictEqual(panelContext?.scmResource, workingTreeResource);
      assert.notStrictEqual(panelContext?.scmResource, indexResource);
      const panelRevert = view.element.querySelector(".sources-diff-panel-revert");
      const panelUnstage = view.element.querySelector(".sources-diff-panel-unstage");
      assert.strictEqual(panelRevert?.style.display, "");
      assert.strictEqual(panelUnstage?.style.display, "none");
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const facts = pane.currentWriteFacts();
      assert.strictEqual(facts?.groupId, "workingTree");
      assert.strictEqual(facts?.scmResource, workingTreeResource);
      const reviewRevert = parent.querySelector(".conversation-diff-review-revert");
      const reviewUnstage = parent.querySelector(".conversation-diff-review-unstage");
      assert.strictEqual(reviewRevert?.style.display, "");
      assert.strictEqual(reviewUnstage?.style.display, "none");
      const moved = resolveSourcesChangeRefFromEditor(input, scmService);
      assert.strictEqual(moved?.groupId, "workingTree");
      assert.strictEqual(moved?.scmResource, workingTreeResource);
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree",
        origin: "engine",
        sessionId: "session-1",
        gitPath: "src/both-groups.ts",
        indexState: "WORKTREE",
        kind: "MODIFIED"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const engineContext = view.getWriteContext();
      assert.strictEqual(engineContext?.groupId, "workingTree");
      assert.strictEqual(engineContext?.scmResource, void 0);
      assert.strictEqual(engineContext?.path, "src/both-groups.ts");
      assert.strictEqual(panelRevert?.style.display, "none");
      assert.strictEqual(panelUnstage?.style.display, "none");
      const engineInput = store.add(new ConversationDiffReviewInput(resource, original, "workingTree", {
        origin: "engine",
        sessionId: "session-1",
        gitPath: "src/both-groups.ts",
        indexState: "WORKTREE",
        kind: "MODIFIED"
      }));
      await pane.setInput(engineInput, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const engineFacts = pane.currentWriteFacts();
      assert.strictEqual(engineFacts?.groupId, "workingTree");
      assert.strictEqual(engineFacts?.scmResource, void 0);
      assert.strictEqual(engineFacts?.path, "src/both-groups.ts");
      assert.strictEqual(reviewRevert?.style.display, "none");
      assert.strictEqual(reviewUnstage?.style.display, "none");
      const engineMoved = resolveSourcesChangeRefFromEditor(engineInput, scmService);
      assert.strictEqual(engineMoved?.groupId, "workingTree");
      assert.strictEqual(engineMoved?.scmResource, void 0);
      assert.strictEqual(engineMoved?.gitPath, "src/both-groups.ts");
    } finally {
      cleanCommand.dispose();
      unstageCommand.dispose();
    }
  });
  test("Diff panel keeps Unstage visible when git.unstage fails", async function() {
    const resource = toResource.call(this, "/project/src/git-unstage-fail.ts");
    const original = toResource.call(this, "/project/src/git-unstage-fail.ts.git");
    const cachedScmResource = {
      sourceUri: resource,
      resourceGroup: { id: "index", label: "Staged Changes", resources: [] },
      decorations: {},
      open: async () => {
      }
    };
    const unstageCommand = CommandsRegistry.registerCommand("git.unstage", () => {
      throw new Error("unstage failed");
    });
    const disconnectedConnection = {
      isEngineConnected: () => false,
      getConnectionSnapshot: () => ({}),
      onDidChangeConnection: Event.None
    };
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "index",
        connection: disconnectedConnection,
        executeCommand: async (commandId, ...args) => {
          if (commandId === "git.unstage") {
            await CommandsRegistry.getCommand("git.unstage")?.handler(void 0, ...args);
          }
        }
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "index",
        scmResource: cachedScmResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelUnstage = view.element.querySelector(".sources-diff-panel-unstage");
      assert.strictEqual(panelUnstage?.style.display, "");
      await view.runGitAction("git.unstage");
      await timeout(20);
      assert.strictEqual(panelUnstage?.style.display, "");
    } finally {
      unstageCommand.dispose();
    }
  });
  test("Diff panel keeps Revert visible when git.clean fails", async function() {
    const resource = toResource.call(this, "/project/src/git-clean-revert-fail.ts");
    const original = toResource.call(this, "/project/src/git-clean-revert-fail.ts.git");
    const group = {
      id: "workingTree",
      label: "Changes",
      resources: []
    };
    const cachedScmResource = {
      sourceUri: resource,
      resourceGroup: group,
      decorations: {},
      open: async () => {
      }
    };
    group.resources.push(cachedScmResource);
    const cleanCommand = CommandsRegistry.registerCommand("git.clean", () => {
      throw new Error("clean failed");
    });
    const disconnectedConnection = {
      isEngineConnected: () => false,
      getConnectionSnapshot: () => ({}),
      onDidChangeConnection: Event.None
    };
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection: disconnectedConnection,
        executeCommand: async (commandId, ...args) => {
          if (commandId === "git.clean") {
            await CommandsRegistry.getCommand("git.clean")?.handler(void 0, ...args);
          }
        }
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree",
        scmResource: cachedScmResource
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelRevert = view.element.querySelector(".sources-diff-panel-revert");
      assert.strictEqual(panelRevert?.style.display, "");
      await view.runGitAction("git.clean");
      await timeout(20);
      assert.strictEqual(panelRevert?.style.display, "");
    } finally {
      cleanCommand.dispose();
    }
  });
  test("Diff panel keeps Stage visible when WriteGitStagePaths fails", async function() {
    const resource = toResource.call(this, "/project/src/engine-stage-fail.ts");
    const original = toResource.call(this, "/project/src/engine-stage-fail.ts.git");
    const stageCalls = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const failedWrite = {
      supported: true,
      reason: "",
      success: false,
      errorMessage: "stage failed",
      exitCode: 1,
      stdout: ""
    };
    connection.writeGitStagePaths = async (request) => {
      stageCalls.push(request);
      return failedWrite;
    };
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelStage = view.element.querySelector(".sources-diff-panel-stage");
      assert.strictEqual(panelStage?.style.display, "");
      await view.runStage();
      await timeout(20);
      assert.strictEqual(stageCalls.length, 1);
      assert.strictEqual(panelStage?.style.display, "");
    } finally {
      stageCommand.dispose();
    }
  });
  test("Review pane hides Stage after engine WriteGitStagePaths accepted until modified changes", async function() {
    const resource = toResource.call(this, "/project/src/review-engine-stage-accepted.ts");
    const original = toResource.call(this, "/project/src/review-engine-stage-accepted.ts.git");
    const stageCalls = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection
      });
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const reviewStage = parent.querySelector(".conversation-diff-review-stage");
      const reviewUnstage = parent.querySelector(".conversation-diff-review-unstage");
      assert.strictEqual(reviewStage?.style.display, "");
      await pane.runStage();
      await timeout(20);
      assert.strictEqual(stageCalls.length, 1);
      assert.strictEqual(reviewStage?.style.display, "none");
      assert.ok(!reviewUnstage || reviewUnstage.style.display === "none");
      const otherResource = toResource.call(this, "/project/src/review-engine-stage-other.ts");
      const otherOriginal = toResource.call(this, "/project/src/review-engine-stage-other.ts.git");
      const otherInput = store.add(new ConversationDiffReviewInput(otherResource, otherOriginal, "workingTree"));
      await pane.setInput(otherInput, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      assert.strictEqual(reviewStage?.style.display, "");
    } finally {
      stageCommand.dispose();
    }
  });
  test("Review pane keeps Stage visible when WriteGitStagePaths fails", async function() {
    const resource = toResource.call(this, "/project/src/review-engine-stage-fail.ts");
    const original = toResource.call(this, "/project/src/review-engine-stage-fail.ts.git");
    const stageCalls = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const failedWrite = {
      supported: true,
      reason: "",
      success: false,
      errorMessage: "stage failed",
      exitCode: 1,
      stdout: ""
    };
    connection.writeGitStagePaths = async (request) => {
      stageCalls.push(request);
      return failedWrite;
    };
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection
      });
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const reviewStage = parent.querySelector(".conversation-diff-review-stage");
      assert.strictEqual(reviewStage?.style.display, "");
      await pane.runStage();
      await timeout(20);
      assert.strictEqual(stageCalls.length, 1);
      assert.strictEqual(reviewStage?.style.display, "");
    } finally {
      stageCommand.dispose();
    }
  });
  function paintReviewWriteChrome(pane) {
    const host = pane;
    host.comparisonLoadFailed = false;
    host.updateReviewActions();
  }
  function stubEngineLiveChangesModel(instantiationService, sessionId = "session-1") {
    instantiationService.stub(ISourcesChangesModel, {
      onDidChange: Event.None,
      getSnapshot: () => ({
        generation: 1,
        settled: true,
        state: { kind: "engine-live", sessionId },
        entries: []
      }),
      isWriteClosed: () => false,
      isFileDiffOpenSkipped: () => false,
      refresh: async () => void 0,
      scheduleRefresh: () => void 0,
      flushScheduledRefresh: () => void 0
    });
  }
  test("leftover-looks-live pairing-hold Stage with local SCM stays hidden and 0 git.stage", async function() {
    const resource = toResource.call(this, "/project/src/leftover-scm-stage.ts");
    const original = toResource.call(this, "/project/src/leftover-scm-stage.ts.git");
    const applyCalls = [];
    const stageCalls = [];
    const gitStageCommands = [];
    const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls);
    assert.strictEqual(connection.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection,
        executeCommand: async (commandId) => {
          if (commandId === "git.stage") {
            gitStageCommands.push(commandId);
          }
        }
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelStage = view.element.querySelector(".sources-diff-panel-stage");
      assert.strictEqual(panelStage?.style.display, "none");
      forceClick(panelStage);
      await view.runStage();
      await timeout(20);
      assert.deepStrictEqual(stageCalls, []);
      assert.deepStrictEqual(gitStageCommands, []);
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const reviewStage = parent.querySelector(".conversation-diff-review-stage");
      assert.strictEqual(reviewStage?.style.display, "none");
      forceClick(reviewStage);
      await pane.runStage();
      await timeout(20);
      assert.deepStrictEqual(stageCalls, []);
      assert.deepStrictEqual(gitStageCommands, []);
      assert.deepStrictEqual(applyCalls, []);
    } finally {
      stageCommand.dispose();
    }
  });
  test("leftover-looks-live pairing-hold Unstage / Revert chrome stays hidden and 0 git.unstage / git.clean", async function() {
    const resource = toResource.call(this, "/project/src/leftover-unstage.ts");
    const original = toResource.call(this, "/project/src/leftover-unstage.ts.git");
    const gitMutateCommands = [];
    const connection = leftoverConnectedConnection(true);
    assert.strictEqual(connection.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    const unstageCommand = CommandsRegistry.registerCommand("git.unstage", () => {
    });
    const cleanCommand = CommandsRegistry.registerCommand("git.clean", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection,
        executeCommand: async (commandId) => {
          if (commandId === "git.unstage" || commandId === "git.clean") {
            gitMutateCommands.push(String(commandId));
          }
        }
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelRevert = view.element.querySelector(".sources-diff-panel-revert");
      const panelUnstage = view.element.querySelector(".sources-diff-panel-unstage");
      assert.strictEqual(panelRevert?.style.display, "none");
      assert.strictEqual(panelUnstage?.style.display, "none");
      forceClick(panelRevert);
      forceClick(panelUnstage);
      await view.runGitAction("git.clean");
      await view.runGitAction("git.unstage");
      await timeout(20);
      assert.strictEqual(gitMutateCommands.length, 0);
      const indexInstantiation = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "index",
        connection,
        executeCommand: async (commandId) => {
          if (commandId === "git.unstage" || commandId === "git.clean") {
            gitMutateCommands.push(String(commandId));
          }
        }
      });
      indexInstantiation.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const indexPanelService = store.add(indexInstantiation.createInstance(SourcesDiffPanelService));
      indexInstantiation.stub(ISourcesDiffPanelService, indexPanelService);
      const indexView = store.add(indexInstantiation.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      indexView.render();
      await indexPanelService.show({
        modified: resource,
        original,
        groupId: "index"
      });
      await timeout(50);
      paintPanelWriteChrome(indexView);
      const indexUnstage = indexView.element.querySelector(".sources-diff-panel-unstage");
      assert.strictEqual(indexUnstage?.style.display, "none");
      forceClick(indexUnstage);
      await indexView.runGitAction("git.unstage");
      await timeout(20);
      assert.deepStrictEqual(gitMutateCommands, []);
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const reviewRevert = parent.querySelector(".conversation-diff-review-revert");
      const reviewUnstage = parent.querySelector(".conversation-diff-review-unstage");
      assert.strictEqual(reviewRevert?.style.display, "none");
      assert.strictEqual(reviewUnstage?.style.display, "none");
      forceClick(reviewRevert);
      forceClick(reviewUnstage);
      await pane.runGitAction("git.clean");
      await pane.runGitAction("git.unstage");
      await timeout(20);
      assert.deepStrictEqual(gitMutateCommands, []);
    } finally {
      unstageCommand.dispose();
      cleanCommand.dispose();
    }
  });
  test("KEEP leftover list-fail hides Diff Stage / Revert / Unstage chrome and stays 0 writes", async function() {
    const resource = toResource.call(this, "/project/src/leftover-keep.ts");
    const original = toResource.call(this, "/project/src/leftover-keep.ts.git");
    const applyCalls = [];
    const stageCalls = [];
    const gitMutateCommands = [];
    const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls, false);
    assert.strictEqual(connection.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(connection), false);
    const unstageCommand = CommandsRegistry.registerCommand("git.unstage", () => {
    });
    const cleanCommand = CommandsRegistry.registerCommand("git.clean", () => {
    });
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection,
        engineSessionReady: false,
        executeCommand: async (commandId) => {
          if (commandId === "git.unstage" || commandId === "git.clean" || commandId === "git.stage") {
            gitMutateCommands.push(String(commandId));
          }
        }
      });
      instantiationService.invokeFunction((accessor) => {
        assert.strictEqual(accessor.get(IConversationRosterService).isEngineSessionReady(), false);
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelStage = view.element.querySelector(".sources-diff-panel-stage");
      const panelRevert = view.element.querySelector(".sources-diff-panel-revert");
      const panelUnstage = view.element.querySelector(".sources-diff-panel-unstage");
      assert.strictEqual(panelStage?.style.display, "none");
      assert.strictEqual(panelRevert?.style.display, "none");
      assert.ok(!panelUnstage || panelUnstage.style.display === "none");
      forceClick(panelStage);
      forceClick(panelRevert);
      await view.runStage();
      await view.runGitAction("git.clean");
      await timeout(20);
      assert.deepStrictEqual(applyCalls, []);
      assert.deepStrictEqual(stageCalls, []);
      assert.deepStrictEqual(gitMutateCommands, []);
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const reviewStage = parent.querySelector(".conversation-diff-review-stage");
      const reviewRevert = parent.querySelector(".conversation-diff-review-revert");
      assert.strictEqual(reviewStage?.style.display, "none");
      assert.strictEqual(reviewRevert?.style.display, "none");
      forceClick(reviewStage);
      forceClick(reviewRevert);
      await pane.runStage();
      await pane.runGitAction("git.unstage");
      await timeout(20);
      assert.deepStrictEqual(applyCalls, []);
      assert.deepStrictEqual(stageCalls, []);
      assert.deepStrictEqual(gitMutateCommands, []);
    } finally {
      unstageCommand.dispose();
      cleanCommand.dispose();
      stageCommand.dispose();
    }
  });
  test("connected leftover without pairing Unstage / Revert still run git.unstage / git.clean", async function() {
    const resource = toResource.call(this, "/project/src/leftover-live-unstage.ts");
    const original = toResource.call(this, "/project/src/leftover-live-unstage.ts.git");
    const gitMutateCommands = [];
    const connection = leftoverConnectedConnection(false);
    assert.strictEqual(connection.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(connection), false);
    const unstageCommand = CommandsRegistry.registerCommand("git.unstage", () => {
    });
    const cleanCommand = CommandsRegistry.registerCommand("git.clean", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "workingTree",
        connection,
        executeCommand: async (commandId) => {
          if (commandId === "git.unstage" || commandId === "git.clean") {
            gitMutateCommands.push(String(commandId));
          }
        }
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelRevert = view.element.querySelector(".sources-diff-panel-revert");
      assert.strictEqual(panelRevert?.style.display, "");
      await view.runGitAction("git.clean");
      await timeout(20);
      assert.deepStrictEqual(gitMutateCommands, ["git.clean"]);
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const reviewRevert = parent.querySelector(".conversation-diff-review-revert");
      assert.strictEqual(reviewRevert?.style.display, "");
      await pane.runGitAction("git.unstage");
      await timeout(20);
      assert.deepStrictEqual(gitMutateCommands, ["git.clean", "git.unstage"]);
    } finally {
      unstageCommand.dispose();
      cleanCommand.dispose();
    }
  });
  test("read-failed sends 0 git.unstage from both diff hosts", async function() {
    const resource = toResource.call(this, "/project/src/read-failed-unstage.ts");
    const original = toResource.call(this, "/project/src/read-failed-unstage.ts.git");
    let unstageCalls = 0;
    const unstageCommand = CommandsRegistry.registerCommand("git.unstage", () => {
      unstageCalls++;
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        groupId: "index",
        executeCommand: async (commandId) => {
          if (commandId === "git.unstage") {
            unstageCalls++;
          }
        }
      });
      instantiationService.stub(ISourcesChangesModel, {
        onDidChange: Event.None,
        getSnapshot: () => ({
          generation: 1,
          settled: true,
          state: { kind: "engine-leftover", sessionId: "session-1", reason: "read-failed" },
          entries: []
        }),
        isWriteClosed: () => true,
        isFileDiffOpenSkipped: () => true,
        refresh: async () => void 0,
        scheduleRefresh: () => void 0,
        flushScheduledRefresh: () => void 0
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "index"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      await view.runGitAction("git.unstage");
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "index"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      await pane.runGitAction("git.unstage");
      await timeout(20);
      assert.strictEqual(unstageCalls, 0);
    } finally {
      unstageCommand.dispose();
    }
  });
  function disconnectedHoldSafeConnection() {
    return {
      isEngineConnected: () => false,
      getConnectionPhase: () => ({ kind: "disconnected" }),
      getConnectionSnapshot: () => ({}),
      onDidChangeConnection: Event.None
    };
  }
  async function mountConversationDiffReviewPane(test2, options = {}) {
    const resource = toResource.call(test2, "/project/src/d526-review.ts");
    const original = toResource.call(test2, "/project/src/d526-review.ts.git");
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      resource,
      groupId: options.groupId,
      executeCommand: options.executeCommand,
      connection: options.connection ?? disconnectedHoldSafeConnection()
    });
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const input = store.add(new ConversationDiffReviewInput(resource, original, options.groupId ?? "workingTree", options.identity));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    return { pane, parent };
  }
  function stubShowNoticeThrow(pane, paintBoom) {
    pane.showNotice = () => {
      throw paintBoom;
    };
  }
  test("does not leak unhandled rejection when Revert click catch-path notice throws and onUnexpectedError warn-then-rethrows", async function() {
    const paintBoom = new Error("paint boom");
    await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
      const { pane, parent } = await mountConversationDiffReviewPane(this, {
        executeCommand: async () => {
          throw new Error("git boom");
        }
      });
      stubShowNoticeThrow(pane, paintBoom);
      forceClick(parent.querySelector(".conversation-diff-review-revert"));
    });
  });
  test("does not leak unhandled rejection when Unstage click catch-path notice throws and onUnexpectedError warn-then-rethrows", async function() {
    const paintBoom = new Error("paint boom");
    await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
      const { pane, parent } = await mountConversationDiffReviewPane(this, {
        groupId: "index",
        executeCommand: async () => {
          throw new Error("git boom");
        }
      });
      stubShowNoticeThrow(pane, paintBoom);
      forceClick(parent.querySelector(".conversation-diff-review-unstage"));
    });
  });
  test("does not leak unhandled rejection when Stage click catch-path notice throws and onUnexpectedError warn-then-rethrows", async function() {
    const paintBoom = new Error("paint boom");
    await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
      const { pane, parent } = await mountConversationDiffReviewPane(this, {
        executeCommand: async () => {
          throw new Error("git boom");
        }
      });
      stubShowNoticeThrow(pane, paintBoom);
      forceClick(parent.querySelector(".conversation-diff-review-stage"));
    });
  });
  test("does not leak unhandled rejection when Accept click catch-path notice throws and onUnexpectedError warn-then-rethrows", async function() {
    const paintBoom = new Error("paint boom");
    await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
      const connection = leftoverConnectedConnection(false);
      connection.readGitFileDiff = async () => {
        throw new Error("read boom");
      };
      const { pane, parent } = await mountConversationDiffReviewPane(this, {
        connection,
        identity: {
          origin: "engine",
          sessionId: "session-1",
          gitPath: "src/d526-review.ts",
          indexState: "Unstaged",
          kind: "Modified"
        }
      });
      pane.acceptCursor = { side: "new", line: 1 };
      stubShowNoticeThrow(pane, paintBoom);
      forceClick(parent.querySelector(".conversation-diff-review-accept"));
      await timeout(20);
    });
  });
  test("does not leak unhandled rejection when Preview failure notice throws and onUnexpectedError warn-then-rethrows", async function() {
    const commandBoom = new Error("preview boom");
    await assertWarnThenRethrowDoesNotLeak(commandBoom, async () => {
      const { parent } = await mountConversationDiffReviewPane(this, {
        executeCommand: async () => {
          throw commandBoom;
        }
      });
      const notice = parent.querySelector(".conversation-diff-review-move-notice");
      assert.ok(notice);
      Object.defineProperty(notice, "textContent", { configurable: true, set: () => {
        throw commandBoom;
      } });
      try {
        forceClick(parent.querySelector(".conversation-diff-review-open-preview"));
        await timeout(0);
      } finally {
        Reflect.deleteProperty(notice, "textContent");
      }
    });
  });
  test("does not leak unhandled rejection when Stage catch-path notice throws and onUnexpectedError warn-then-rethrows", async function() {
    const paintBoom = new Error("paint boom");
    const resource = toResource.call(this, "/project/src/d524-stage.ts");
    const original = toResource.call(this, "/project/src/d524-stage.ts.git");
    const applyCalls = [];
    const stageCalls = [];
    const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls, false);
    connection.writeGitStagePaths = async (request) => {
      stageCalls.push(request);
      throw new Error("stage boom");
    };
    await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        connection
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      view.showActionNotice = () => {
        throw paintBoom;
      };
      forceClick(view.element.querySelector(".sources-diff-panel-stage"));
      await timeout(20);
    });
    assert.strictEqual(stageCalls.length, 1);
    assert.deepStrictEqual(applyCalls, []);
  });
  test("does not leak unhandled rejection when renderRef catch-path notice throws and onUnexpectedError warn-then-rethrows", async function() {
    const paintBoom = new Error("paint boom");
    const resource = toResource.call(this, "/project/src/d524-render.ts");
    const original = toResource.call(this, "/project/src/d524-render.ts.git");
    await assertWarnThenRethrowDoesNotLeak(paintBoom, async () => {
      const instantiationService = stubDiffHonestyServices({ throwOnLoad: true, resource });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      view.showLoadNotice = () => {
        throw paintBoom;
      };
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
    });
  });
  test("sourcesGitApplyHunksPatches stays empty after S0 drops the carried payload", () => {
    assert.deepStrictEqual(sourcesGitApplyHunksPatches(void 0), []);
    assert.deepStrictEqual(sourcesGitApplyHunksPatches({}), []);
    assert.deepStrictEqual(sourcesGitApplyHunksPatches({ unifiedDiff: carriedUnifiedDiff }), []);
  });
  test("openSourcesChangeEntry carries fetched unifiedDiff onto the panel change ref", async function() {
    const resource = toResource.call(this, "/project/src/carry-panel.ts");
    const entry = {
      resource,
      name: "carry-panel.ts",
      description: "Unstaged Changes",
      groupId: "workingTree",
      gitPath: "src/carry-panel.ts",
      indexState: "WORKTREE"
    };
    let shown;
    const models = /* @__PURE__ */ new Map();
    await openSourcesChangeEntry(entry, {
      commandService: NullCommandService,
      editorService: { openEditor: async () => void 0 },
      quickDiffService: { getQuickDiffs: async () => [] },
      configurationService: new TestConfigurationService({ "sources.diff.defaultOwner": "panel" }),
      instantiationService: {
        createInstance: () => {
          throw new Error("panel open must not create ConversationDiffReviewInput");
        }
      },
      sourcesDiffPanelService: {
        show: async (ref) => {
          shown = ref;
        }
      },
      modelService: {
        getModel: (uri) => models.has(uri.toString()) ? { uri } : null,
        updateModel: (model, value) => {
          models.set(model.uri.toString(), value);
        },
        createModel: (value, _language, uri) => {
          if (uri) {
            models.set(uri.toString(), value);
          }
          return { uri };
        }
      },
      readGitFileDiff: async () => ({
        supported: true,
        reason: "",
        path: "src/carry-panel.ts",
        unifiedDiff: carriedUnifiedDiff
      })
    }, { preserveFocus: false });
    assert.deepStrictEqual(sourcesGitApplyHunksPatches(shown), []);
  });
  test("openSourcesChangeEntry attaches fetched unifiedDiff for Conversation Accept", async function() {
    const resource = toResource.call(this, "/project/src/carry-review.ts");
    const entry = {
      resource,
      name: "carry-review.ts",
      description: "Unstaged Changes",
      groupId: "workingTree",
      gitPath: "src/carry-review.ts",
      indexState: "WORKTREE"
    };
    let opened;
    const models = /* @__PURE__ */ new Map();
    const harness = createSourcesConversationOpenHarness(store, {
      openEditor: async (input) => {
        if (input instanceof ConversationDiffReviewInput) {
          opened = input;
        }
        return void 0;
      }
    });
    await openSourcesChangeEntry(entry, {
      commandService: NullCommandService,
      editorService: {
        openEditor: async () => {
          throw new Error("conversation open must not use editorService.openEditor");
        }
      },
      quickDiffService: { getQuickDiffs: async () => [] },
      configurationService: new TestConfigurationService({ "sources.diff.defaultOwner": "conversation" }),
      instantiationService: {
        createInstance: (ctor, modified, original, groupId) => store.add(new ctor(modified, original, groupId))
      },
      sourcesDiffPanelService: {
        show: async () => {
          throw new Error("conversation open must not show the panel");
        }
      },
      editorGroupsService: harness.editorGroupsService,
      session: harness.session,
      modelService: {
        getModel: (uri) => models.has(uri.toString()) ? { uri } : null,
        updateModel: (model, value) => {
          models.set(model.uri.toString(), value);
        },
        createModel: (value, _language, uri) => {
          if (uri) {
            models.set(uri.toString(), value);
          }
          return { uri };
        }
      },
      readGitFileDiff: async () => ({
        supported: true,
        reason: "",
        path: "src/carry-review.ts",
        unifiedDiff: carriedUnifiedDiff
      })
    }, { preserveFocus: false });
    assert.ok(opened);
    assert.deepStrictEqual(sourcesGitApplyHunksPatches(opened), []);
  });
  test("openSourcesChangeEntry attaches fetched unifiedDiff for Preview then Conversation Accept", async function() {
    const resource = toResource.call(this, "/project/src/carry-preview.ts");
    const entry = {
      resource,
      name: "carry-preview.ts",
      description: "Unstaged Changes",
      groupId: "workingTree",
      gitPath: "src/carry-preview.ts",
      indexState: "WORKTREE"
    };
    const instantiationService = workbenchInstantiationService(void 0, store);
    const models = /* @__PURE__ */ new Map();
    const editorState = {
      activeEditor: void 0,
      closed: []
    };
    let editorOpens = 0;
    const harness = createSourcesConversationOpenHarness(store, {
      openEditor: async (input) => {
        if (input instanceof ConversationDiffReviewInput) {
          store.add(input);
          editorState.activeEditor = input;
        }
        return void 0;
      }
    });
    const editorService = {
      get activeEditor() {
        return editorState.activeEditor;
      },
      activeEditorPane: { group: { id: 1 } },
      closeEditor: async (ident) => {
        editorState.closed.push(ident.editor);
        if (editorState.activeEditor === ident.editor) {
          editorState.activeEditor = void 0;
        }
      },
      openEditor: async (input) => {
        editorOpens++;
        const untyped = input;
        if (untyped.original?.resource && untyped.modified?.resource) {
          const originalInput = store.add(new TestEditorInput(untyped.original.resource, "test.original"));
          const modifiedInput = store.add(new TestEditorInput(untyped.modified.resource, "test.modified"));
          const diffInput = store.add(instantiationService.createInstance(DiffEditorInput, void 0, void 0, originalInput, modifiedInput, void 0));
          editorState.activeEditor = diffInput;
          return { input: diffInput };
        }
        return void 0;
      }
    };
    await openSourcesChangeEntry(entry, {
      commandService: NullCommandService,
      editorService,
      quickDiffService: { getQuickDiffs: async () => [] },
      configurationService: new TestConfigurationService({ "sources.diff.defaultOwner": "preview" }),
      instantiationService,
      sourcesDiffPanelService: {
        show: async () => {
          throw new Error("preview open must not show the panel");
        }
      },
      modelService: {
        getModel: (uri) => models.has(uri.toString()) ? { uri } : null,
        updateModel: (model, value) => {
          models.set(model.uri.toString(), value);
        },
        createModel: (value, _language, uri) => {
          if (uri) {
            models.set(uri.toString(), value);
          }
          return { uri };
        }
      },
      readGitFileDiff: async () => ({
        supported: true,
        reason: "",
        path: "src/carry-preview.ts",
        unifiedDiff: carriedUnifiedDiff
      })
    }, { preserveFocus: false });
    const previewHost = editorState.activeEditor;
    assert.ok(previewHost instanceof DiffEditorInput);
    assert.deepStrictEqual(sourcesGitApplyHunksPatches(previewHost), []);
    const opensBeforeMove = editorOpens;
    await moveActiveDiffToConversation("editorTitle", {
      commandService: NullCommandService,
      editorService,
      quickDiffService: { getQuickDiffs: async () => [] },
      configurationService: new TestConfigurationService(),
      instantiationService,
      sourcesDiffPanelService: {
        show: async () => {
          throw new Error("move to conversation must not show the panel");
        },
        getCurrentRef: () => void 0,
        clear: () => {
        },
        onDidChangeRef: Event.None
      },
      editorGroupsService: harness.editorGroupsService,
      session: harness.session
    }, { repositories: [] });
    assert.strictEqual(editorOpens, opensBeforeMove);
    const conversationHost = editorState.activeEditor;
    assert.ok(conversationHost instanceof ConversationDiffReviewInput);
    assert.notStrictEqual(conversationHost, previewHost);
    assert.deepStrictEqual(sourcesGitApplyHunksPatches(conversationHost), []);
  });
  test("openSourcesChangeEntry preview first-open leaves whitespace unifiedDiff absent", async function() {
    const resource = toResource.call(this, "/project/src/preview-whitespace.ts");
    const entry = {
      resource,
      name: "preview-whitespace.ts",
      description: "Unstaged Changes",
      groupId: "workingTree",
      gitPath: "src/preview-whitespace.ts",
      indexState: "WORKTREE"
    };
    const instantiationService = workbenchInstantiationService(void 0, store);
    const models = /* @__PURE__ */ new Map();
    let previewHost;
    await openSourcesChangeEntry(entry, {
      commandService: NullCommandService,
      editorService: {
        get activeEditor() {
          return previewHost;
        },
        openEditor: async (input) => {
          if (input.original?.resource && input.modified?.resource) {
            const originalInput = store.add(new TestEditorInput(input.original.resource, "test.original"));
            const modifiedInput = store.add(new TestEditorInput(input.modified.resource, "test.modified"));
            previewHost = store.add(instantiationService.createInstance(DiffEditorInput, void 0, void 0, originalInput, modifiedInput, void 0));
            return { input: previewHost };
          }
          return void 0;
        }
      },
      quickDiffService: { getQuickDiffs: async () => [] },
      configurationService: new TestConfigurationService({ "sources.diff.defaultOwner": "preview" }),
      instantiationService,
      sourcesDiffPanelService: {
        show: async () => {
          throw new Error("preview open must not show the panel");
        }
      },
      modelService: {
        getModel: (uri) => models.has(uri.toString()) ? { uri } : null,
        updateModel: (model, value) => {
          models.set(model.uri.toString(), value);
        },
        createModel: (value, _language, uri) => {
          if (uri) {
            models.set(uri.toString(), value);
          }
          return { uri };
        }
      },
      readGitFileDiff: async () => ({
        supported: true,
        reason: "",
        path: "src/preview-whitespace.ts",
        unifiedDiff: "   "
      })
    }, { preserveFocus: false });
    assert.ok(previewHost);
    assert.deepStrictEqual(sourcesGitApplyHunksPatches(previewHost), []);
  });
  test("S0 keeps Accept hidden and sends 0 ApplyHunks even when a diff was fetched", async function() {
    const resource = toResource.call(this, "/project/src/accept-carry.ts");
    const original = toResource.call(this, "/project/src/accept-carry.ts.git");
    const applyCalls = [];
    const gitStageCommands = [];
    const connection = leftoverLooksLiveApplyConnection(applyCalls, [], false);
    assert.strictEqual(connection.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(connection), false);
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      const instantiationService = stubDiffHonestyServices({
        throwOnLoad: true,
        resource,
        connection,
        executeCommand: async (commandId) => {
          if (commandId === "git.stage") {
            gitStageCommands.push(commandId);
          }
        }
      });
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: resource,
        original,
        groupId: "workingTree"
      });
      await timeout(50);
      paintPanelWriteChrome(view);
      const panelAccept = view.element.querySelector(".sources-diff-panel-accept");
      assert.strictEqual(panelAccept?.style.display, "none");
      await view.runAccept();
      await timeout(20);
      assert.deepStrictEqual(applyCalls, []);
      assert.deepStrictEqual(gitStageCommands, []);
      const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      pane.create(parent);
      const input = store.add(new ConversationDiffReviewInput(resource, original, "workingTree"));
      await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
      await timeout(20);
      paintReviewWriteChrome(pane);
      const reviewAccept = parent.querySelector(".conversation-diff-review-accept");
      assert.strictEqual(reviewAccept?.style.display, "none");
      await pane.runAccept();
      await timeout(20);
      assert.deepStrictEqual(applyCalls, []);
      assert.deepStrictEqual(gitStageCommands, []);
    } finally {
      stageCommand.dispose();
    }
  });
  test("empty unifiedDiff keeps Accept hidden and sends 0 ApplyHunks", async function() {
    const resource = toResource.call(this, "/project/src/accept-empty.ts");
    const original = toResource.call(this, "/project/src/accept-empty.ts.git");
    const applyCalls = [];
    const connection = leftoverLooksLiveApplyConnection(applyCalls, [], false);
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      resource,
      connection
    });
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    await panelService.show({
      modified: resource,
      original,
      groupId: "workingTree"
    });
    await timeout(50);
    paintPanelWriteChrome(view);
    const panelAccept = view.element.querySelector(".sources-diff-panel-accept");
    assert.strictEqual(panelAccept?.style.display, "none");
    forceClick(panelAccept);
    await view.runAccept();
    await timeout(20);
    assert.deepStrictEqual(applyCalls, []);
  });
  test("openSourcesChangeEntry copies entry identity onto the sources-git-diff ref", async function() {
    const resource = toResource.call(this, "/project/src/identity.ts");
    const entry = {
      resource,
      name: "identity.ts",
      description: "Unstaged Changes",
      groupId: "workingTree",
      origin: "engine",
      sessionId: "session-old",
      gitPath: "src/identity.ts",
      indexState: "WORKTREE",
      kind: "MODIFIED"
    };
    let shown;
    const models = /* @__PURE__ */ new Map();
    await openSourcesChangeEntry(entry, {
      commandService: NullCommandService,
      editorService: { openEditor: async () => void 0 },
      quickDiffService: { getQuickDiffs: async () => [] },
      configurationService: new TestConfigurationService({ "sources.diff.defaultOwner": "panel" }),
      instantiationService: {
        createInstance: () => {
          throw new Error("panel open must not create ConversationDiffReviewInput");
        }
      },
      sourcesDiffPanelService: {
        show: async (ref) => {
          shown = ref;
        }
      },
      modelService: {
        getModel: (uri) => models.has(uri.toString()) ? { uri } : null,
        updateModel: (model, value) => {
          models.set(model.uri.toString(), value);
        },
        createModel: (value, _language, uri) => {
          if (uri) {
            models.set(uri.toString(), value);
          }
          return { uri };
        }
      },
      readGitFileDiff: async () => ({
        supported: true,
        reason: "",
        path: "src/identity.ts",
        unifiedDiff: carriedUnifiedDiff
      })
    }, { preserveFocus: false });
    assert.strictEqual(shown?.origin, "engine");
    assert.strictEqual(shown?.sessionId, "session-old");
    assert.strictEqual(shown?.gitPath, "src/identity.ts");
    assert.strictEqual(shown?.indexState, "WORKTREE");
    assert.strictEqual(shown?.kind, "MODIFIED");
    assert.strictEqual(shown?.modified.scheme, "sources-git-diff");
  });
  test("openSourcesChangeEntry copies entry identity onto the conversation input", async function() {
    const resource = toResource.call(this, "/project/src/identity-input.ts");
    const entry = {
      resource,
      name: "identity-input.ts",
      description: "Unstaged Changes",
      groupId: "workingTree",
      origin: "engine",
      sessionId: "session-old",
      gitPath: "src/identity-input.ts",
      indexState: "WORKTREE",
      kind: "MODIFIED"
    };
    let opened;
    const models = /* @__PURE__ */ new Map();
    const harness = createSourcesConversationOpenHarness(store, {
      openEditor: async (input) => {
        if (input instanceof ConversationDiffReviewInput) {
          opened = input;
        }
        return void 0;
      }
    });
    await openSourcesChangeEntry(entry, {
      commandService: NullCommandService,
      editorService: {
        openEditor: async () => {
          throw new Error("conversation open must not use editorService.openEditor");
        }
      },
      quickDiffService: { getQuickDiffs: async () => [] },
      configurationService: new TestConfigurationService({ "sources.diff.defaultOwner": "conversation" }),
      instantiationService: {
        createInstance: (ctor, modified, original, groupId, identity) => store.add(new ctor(modified, original, groupId, identity))
      },
      sourcesDiffPanelService: {
        show: async () => {
          throw new Error("conversation open must not show the panel");
        }
      },
      editorGroupsService: harness.editorGroupsService,
      session: harness.session,
      modelService: {
        getModel: (uri) => models.has(uri.toString()) ? { uri } : null,
        updateModel: (model, value) => {
          models.set(model.uri.toString(), value);
        },
        createModel: (value, _language, uri) => {
          if (uri) {
            models.set(uri.toString(), value);
          }
          return { uri };
        }
      },
      readGitFileDiff: async () => ({
        supported: true,
        reason: "",
        path: "src/identity-input.ts",
        unifiedDiff: carriedUnifiedDiff
      })
    }, { preserveFocus: false });
    assert.ok(opened);
    assert.strictEqual(opened.sessionId, "session-old");
    assert.strictEqual(opened.gitPath, "src/identity-input.ts");
    assert.strictEqual(opened.origin, "engine");
    assert.strictEqual(opened.modified.scheme, "sources-git-diff");
  });
  test("engine diff stage sends gitPath and the pinned session", async function() {
    const stageCalls = [];
    const gitCommands = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      connection,
      executeCommand: async (commandId) => {
        gitCommands.push(String(commandId));
      }
    });
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    const modified = URI.from({ scheme: "sources-git-diff", path: "/modified/a.ts" });
    await panelService.show({
      modified,
      original: URI.from({ scheme: "sources-git-diff", path: "/original/a.ts" }),
      groupId: "workingTree",
      origin: "engine",
      sessionId: "session-1",
      gitPath: "src/a.ts",
      indexState: "WORKTREE",
      kind: "MODIFIED",
      scmResource: { sourceUri: URI.file("/work/repo/src/a.ts") }
    });
    await view.runStage();
    assert.strictEqual(stageCalls.length, 1);
    assert.strictEqual(stageCalls[0]?.sessionId, "session-1");
    assert.deepStrictEqual(stageCalls[0]?.commands?.[0]?.argv, ["src/a.ts"]);
    assert.ok(!JSON.stringify(stageCalls[0]).includes("sources-git-diff"));
    assert.deepStrictEqual(gitCommands, []);
  });
  test("engine diff stage and accept refuse a mismatched pinned session", async function() {
    const stageCalls = [];
    const applyCalls = [];
    const gitCommands = [];
    const connection = leftoverLooksLiveApplyConnection(applyCalls, stageCalls, false);
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      connection,
      executeCommand: async (commandId) => {
        gitCommands.push(String(commandId));
      }
    });
    stubEngineLiveChangesModel(instantiationService);
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    const modified = URI.from({ scheme: "sources-git-diff", path: "/modified/mismatch.ts" });
    await panelService.show({
      modified,
      original: URI.from({ scheme: "sources-git-diff", path: "/original/mismatch.ts" }),
      groupId: "workingTree",
      origin: "engine",
      sessionId: "session-old",
      gitPath: "src/mismatch.ts",
      scmResource: { sourceUri: URI.file("/work/repo/src/mismatch.ts") }
    });
    await timeout(20);
    paintPanelWriteChrome(view);
    const panelStage = view.element.querySelector(".sources-diff-panel-stage");
    assert.strictEqual(panelStage?.style.display, "none");
    forceClick(panelStage);
    await view.runStage();
    await view.runAccept();
    assert.strictEqual(stageCalls.length, 0);
    assert.strictEqual(applyCalls.length, 0);
    assert.deepStrictEqual(gitCommands, []);
    assert.strictEqual(view.element.querySelector(".sources-diff-panel-action-notice")?.textContent, sourcesGitSessionChangedMessage());
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const input = store.add(new ConversationDiffReviewInput(modified, URI.from({ scheme: "sources-git-diff", path: "/original/mismatch.ts" }), "workingTree", {
      origin: "engine",
      sessionId: "session-old",
      gitPath: "src/mismatch.ts"
    }));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    paintReviewWriteChrome(pane);
    const reviewStage = parent.querySelector(".conversation-diff-review-stage");
    assert.strictEqual(reviewStage?.style.display, "none");
    forceClick(reviewStage);
    await pane.runStage();
    await pane.runAccept();
    assert.strictEqual(stageCalls.length, 0);
    assert.strictEqual(applyCalls.length, 0);
    assert.strictEqual(parent.querySelector(".conversation-diff-review-notice")?.textContent, sourcesGitSessionChangedMessage());
  });
  test("scm snapshot engine diff with session mismatch still git.stage locally", async function() {
    const stageCalls = [];
    const gitCommands = [];
    const resource = toResource.call(this, "/project/src/scm-mismatch-stage.ts");
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      resource,
      connection,
      executeCommand: async (commandId) => {
        gitCommands.push(String(commandId));
      }
    });
    instantiationService.stub(ISourcesChangesModel, {
      onDidChange: Event.None,
      getSnapshot: () => ({
        generation: 1,
        settled: true,
        state: { kind: "scm" },
        entries: []
      }),
      isWriteClosed: () => false,
      isFileDiffOpenSkipped: () => false,
      refresh: async () => void 0,
      scheduleRefresh: () => void 0,
      flushScheduledRefresh: () => void 0
    });
    const scmResource = instantiationService.invokeFunction((accessor) => {
      const scm = accessor.get(ISCMService);
      return [...scm.repositories][0]?.provider.groups[0]?.resources[0];
    });
    if (!scmResource) {
      throw new Error("SCM fixture missing");
    }
    const stageCommand = CommandsRegistry.registerCommand("git.stage", () => {
    });
    try {
      instantiationService.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
      instantiationService.stub(ISourcesDiffPanelService, panelService);
      const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
        id: SOURCES_DIFF_PANEL_VIEW_ID,
        title: "Diff"
      }));
      view.render();
      await panelService.show({
        modified: URI.from({ scheme: "sources-git-diff", path: "/modified/scm-mismatch.ts" }),
        original: URI.from({ scheme: "sources-git-diff", path: "/original/scm-mismatch.ts" }),
        groupId: "workingTree",
        origin: "engine",
        sessionId: "session-old",
        gitPath: "src/scm-mismatch-stage.ts",
        scmResource
      });
      await timeout(20);
      paintPanelWriteChrome(view);
      const panelStage = view.element.querySelector(".sources-diff-panel-stage");
      assert.strictEqual(panelStage?.style.display, "");
      await view.runStage();
      assert.strictEqual(stageCalls.length, 0);
      assert.deepStrictEqual(gitCommands, ["git.stage"]);
    } finally {
      stageCommand.dispose();
    }
  });
  test("engine diff stage with an empty gitPath does not send", async function() {
    const stageCalls = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const instantiationService = stubDiffHonestyServices({ throwOnLoad: true, connection });
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    await panelService.show({
      modified: URI.from({ scheme: "sources-git-diff", path: "/modified/empty.ts" }),
      original: URI.from({ scheme: "sources-git-diff", path: "/original/empty.ts" }),
      groupId: "workingTree",
      origin: "engine",
      sessionId: "session-1",
      gitPath: ""
    });
    await view.runStage();
    assert.strictEqual(stageCalls.length, 0);
    assert.strictEqual(view.element.querySelector(".sources-diff-panel-action-notice")?.textContent, sourcesGitEmptyStagePathMessage());
  });
  test("FileDiff stage uses copied gitPath and matches still includes groupId", async function() {
    const resource = toResource.call(this, "/project/src/filediff-stage.ts");
    const entry = {
      resource,
      name: "filediff-stage.ts",
      description: "Unstaged Changes",
      groupId: "workingTree",
      origin: "engine",
      sessionId: "session-1",
      gitPath: "src/filediff-stage.ts",
      indexState: "WORKTREE",
      kind: "MODIFIED"
    };
    let shown;
    const models = /* @__PURE__ */ new Map();
    const opened = await openSourcesChangeEntry(entry, {
      commandService: NullCommandService,
      editorService: { openEditor: async () => void 0 },
      quickDiffService: { getQuickDiffs: async () => [] },
      configurationService: new TestConfigurationService({ "sources.diff.defaultOwner": "panel" }),
      instantiationService: {
        createInstance: () => {
          throw new Error("panel open must not create ConversationDiffReviewInput");
        }
      },
      sourcesDiffPanelService: {
        show: async (ref) => {
          shown = ref;
          return true;
        }
      },
      modelService: {
        getModel: (uri) => models.has(uri.toString()) ? { uri } : null,
        updateModel: (model, value) => {
          models.set(model.uri.toString(), value);
        },
        createModel: (value, _language, uri) => {
          if (uri) {
            models.set(uri.toString(), value);
          }
          return { uri };
        }
      },
      readGitFileDiff: async () => ({
        supported: true,
        reason: "",
        path: "src/filediff-stage.ts",
        unifiedDiff: carriedUnifiedDiff
      })
    }, { preserveFocus: false });
    assert.strictEqual(opened, true);
    if (!shown) {
      throw new Error("FileDiff ref missing");
    }
    assert.strictEqual(shown.gitPath, "src/filediff-stage.ts");
    assert.strictEqual(shown.origin, "engine");
    assert.strictEqual(shown.sessionId, "session-1");
    assert.strictEqual(shown.indexState, "WORKTREE");
    assert.strictEqual(shown.kind, "MODIFIED");
    assert.strictEqual(shown.modified.scheme, "sources-git-diff");
    assert.strictEqual(shown.original?.scheme, "sources-git-diff");
    const identity = {
      origin: shown.origin,
      sessionId: shown.sessionId,
      gitPath: shown.gitPath,
      indexState: shown.indexState,
      kind: shown.kind
    };
    const input = store.add(new ConversationDiffReviewInput(shown.modified, shown.original, shown.groupId, identity));
    const otherGroup = store.add(new ConversationDiffReviewInput(shown.modified, shown.original, "index", identity));
    const otherPath = store.add(new ConversationDiffReviewInput(shown.modified, shown.original, shown.groupId, { ...identity, gitPath: "src/other.ts" }));
    const same = store.add(new ConversationDiffReviewInput(shown.modified, shown.original, shown.groupId, identity));
    assert.strictEqual(input.matches(otherGroup), false);
    assert.strictEqual(input.matches(otherPath), false);
    assert.strictEqual(input.matches(same), true);
    const stageCalls = [];
    const gitCommands = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      connection,
      executeCommand: async (commandId) => {
        gitCommands.push(String(commandId));
      }
    });
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    await panelService.show(shown);
    await timeout(20);
    paintPanelWriteChrome(view);
    const panelStage = view.element.querySelector(".sources-diff-panel-stage");
    assert.strictEqual(panelStage.style.display, "");
    assert.strictEqual(panelStage.disabled, false);
    await view.runStage();
    assert.strictEqual(stageCalls.length, 1);
    assert.strictEqual(stageCalls[0]?.sessionId, "session-1");
    assert.deepStrictEqual(stageCalls[0]?.commands?.[0]?.argv, ["src/filediff-stage.ts"]);
    assert.ok(!JSON.stringify(stageCalls[0]).includes("sources-git-diff"));
    assert.deepStrictEqual(gitCommands, []);
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    await pane.runStage();
    assert.strictEqual(stageCalls.length, 2);
    assert.strictEqual(stageCalls[1]?.sessionId, "session-1");
    assert.deepStrictEqual(stageCalls[1]?.commands?.[0]?.argv, ["src/filediff-stage.ts"]);
    assert.ok(!JSON.stringify(stageCalls[1]).includes("sources-git-diff"));
    assert.deepStrictEqual(gitCommands, []);
  });
  test("empty gitPath disables Stage, shows status, and does not send", async function() {
    const stageCalls = [];
    const gitCommands = [];
    const connection = leftoverLooksLiveApplyConnection([], stageCalls, false);
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      connection,
      executeCommand: async (commandId) => {
        gitCommands.push(String(commandId));
      }
    });
    stubEngineLiveChangesModel(instantiationService);
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    const modified = URI.from({ scheme: "sources-git-diff", path: "/modified/empty-stage.ts" });
    const original = URI.from({ scheme: "sources-git-diff", path: "/original/empty-stage.ts" });
    await panelService.show({
      modified,
      original,
      groupId: "workingTree",
      origin: "engine",
      sessionId: "session-1",
      gitPath: ""
    });
    await timeout(20);
    paintPanelWriteChrome(view);
    const panelStage = view.element.querySelector(".sources-diff-panel-stage");
    assert.strictEqual(panelStage.style.display, "none");
    forceClick(panelStage);
    await view.runStage();
    assert.strictEqual(stageCalls.length, 0);
    assert.deepStrictEqual(gitCommands, []);
    assert.strictEqual(view.element.querySelector(".sources-diff-panel-action-notice")?.textContent, sourcesGitEmptyStagePathMessage());
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const input = store.add(new ConversationDiffReviewInput(modified, original, "workingTree", {
      origin: "engine",
      sessionId: "session-1",
      gitPath: ""
    }));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    paintReviewWriteChrome(pane);
    const reviewStage = parent.querySelector(".conversation-diff-review-stage");
    assert.strictEqual(reviewStage.style.display, "none");
    forceClick(reviewStage);
    await pane.runStage();
    assert.strictEqual(stageCalls.length, 0);
    assert.deepStrictEqual(gitCommands, []);
    assert.strictEqual(parent.querySelector(".conversation-diff-review-notice")?.textContent, sourcesGitEmptyStagePathMessage());
  });
  const acceptCursorUnifiedDiff = [
    "diff --git a/src/a.ts b/src/b.ts",
    "rename from src/a.ts",
    "rename to src/b.ts",
    "old mode 100644",
    "new mode 100755",
    "--- a/src/a.ts",
    "+++ b/src/b.ts",
    "@@ -1,3 +1,4 @@",
    " line1",
    "-old",
    "+new",
    "+extra",
    "@@ -10,2 +11,3 @@",
    " keep",
    "-gone",
    "+added",
    "+more",
    "\\ No newline at end of file"
  ].join("\n");
  function engineAcceptRef(name, overrides = {}) {
    return {
      modified: URI.from({ scheme: "sources-git-diff", path: `/modified/${name}` }),
      original: URI.from({ scheme: "sources-git-diff", path: `/original/${name}` }),
      groupId: "workingTree",
      origin: "engine",
      sessionId: "session-1",
      gitPath: "src/a.ts",
      indexState: "Unstaged",
      kind: "Modified",
      ...overrides
    };
  }
  async function mountAcceptHunkHosts(test2, options) {
    const applyCalls = [];
    const readCalls = [];
    const gitCommands = [];
    const refreshCount = { n: 0 };
    const unifiedDiff = options.unifiedDiff ?? acceptCursorUnifiedDiff;
    const connected = options.connected ?? true;
    const applyResult = {
      supported: true,
      reason: "",
      success: options.applySuccess ?? true,
      errorMessage: options.applyErrorMessage ?? "",
      exitCode: options.applySuccess === false ? 1 : 0,
      stdout: ""
    };
    const connection = {
      isEngineConnected: () => connected,
      getConnectionPhase: () => ({ kind: connected ? "connected" : "disconnected" }),
      getConnectionSnapshot: () => ({ pairingPending: false }),
      onDidChangeConnection: Event.None,
      readGitFileDiff: async (request) => {
        readCalls.push(request);
        return { supported: true, reason: "", path: request.path, unifiedDiff };
      },
      writeGitApplyHunks: async (request) => {
        applyCalls.push(request);
        return applyResult;
      },
      writeGitStagePaths: async () => applyResult
    };
    const scmUri = options.matchScm ? options.ref.modified : toResource.call(test2, "/project/src/scm-unrelated.ts");
    const instantiationService = stubDiffHonestyServices({
      throwOnLoad: true,
      resource: scmUri,
      groupId: options.scmGroupId ?? "workingTree",
      connection,
      engineSessionReady: options.engineSessionReady ?? true,
      executeCommand: async (commandId) => {
        gitCommands.push(String(commandId));
      }
    });
    if (options.writeClosed || options.countRefresh) {
      instantiationService.stub(ISourcesChangesModel, {
        onDidChange: Event.None,
        getSnapshot: () => ({
          generation: 1,
          settled: true,
          state: options.writeClosed ? { kind: "engine-leftover", sessionId: "session-1", reason: "read-failed" } : { kind: "scm" },
          entries: []
        }),
        isWriteClosed: () => !!options.writeClosed,
        isFileDiffOpenSkipped: () => !!options.writeClosed,
        refresh: async () => void 0,
        scheduleRefresh: () => {
          refreshCount.n++;
        },
        flushScheduledRefresh: () => void 0
      });
    }
    instantiationService.stub(IViewsService, {
      openView: async () => null,
      onDidChangeViewVisibility: Event.None,
      onDidChangeViewContainerVisibility: Event.None
    });
    const panelService = store.add(instantiationService.createInstance(SourcesDiffPanelService));
    instantiationService.stub(ISourcesDiffPanelService, panelService);
    const view = store.add(instantiationService.createInstance(SourcesDiffPanelView, {
      id: SOURCES_DIFF_PANEL_VIEW_ID,
      title: "Diff"
    }));
    view.render();
    await panelService.show(options.ref);
    await timeout(50);
    paintPanelWriteChrome(view);
    const pane = store.add(instantiationService.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    pane.create(parent);
    const input = store.add(new ConversationDiffReviewInput(options.ref.modified, options.ref.original, options.ref.groupId, {
      origin: options.ref.origin,
      sessionId: options.ref.sessionId,
      gitPath: options.ref.gitPath,
      indexState: options.ref.indexState,
      kind: options.ref.kind
    }));
    await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    await timeout(20);
    paintReviewWriteChrome(pane);
    return { view, pane, parent, applyCalls, readCalls, gitCommands, refreshCount };
  }
  function pinAcceptCursor(host, line, side = "new") {
    host.acceptCursor = { side, line };
  }
  function acceptButtonDisplay(root, selector) {
    return root.querySelector(selector)?.style.display ?? "missing";
  }
  function writeGroupId(host) {
    return host.currentWriteFacts()?.groupId ?? "";
  }
  async function runBothAccept(harness) {
    await harness.view.runAccept();
    await harness.pane.runAccept();
  }
  function assertAcceptHidden(harness) {
    assert.strictEqual(acceptButtonDisplay(harness.view.element, ".sources-diff-panel-accept"), "none");
    assert.strictEqual(acceptButtonDisplay(harness.parent, ".conversation-diff-review-accept"), "none");
  }
  function assertAcceptShown(harness) {
    assert.strictEqual(acceptButtonDisplay(harness.view.element, ".sources-diff-panel-accept"), "");
    assert.strictEqual(acceptButtonDisplay(harness.parent, ".conversation-diff-review-accept"), "");
  }
  test("eligible Modified WORKTREE row shows Accept on both diff hosts", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-worktree", { indexState: "WORKTREE", kind: "Modified" })
    });
    assertAcceptShown(harness);
  });
  test("StagedAndUnstaged still shows Accept", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-both", { indexState: "StagedAndUnstaged", kind: "Modified" })
    });
    assertAcceptShown(harness);
  });
  test("conflict labeled workingTree hides Accept", async function() {
    const resource = toResource.call(this, "/project/src/accept-conflict.ts");
    const harness = await mountAcceptHunkHosts(this, {
      ref: {
        modified: resource,
        original: toResource.call(this, "/project/src/accept-conflict.ts.git"),
        groupId: "workingTree",
        origin: "engine",
        sessionId: "session-1",
        gitPath: "src/a.ts",
        indexState: "Unstaged",
        kind: "Conflict"
      },
      matchScm: true,
      scmGroupId: "workingTree"
    });
    assert.strictEqual(writeGroupId(harness.view), "workingTree");
    assert.strictEqual(writeGroupId(harness.pane), "workingTree");
    assertAcceptHidden(harness);
    pinAcceptCursor(harness.view, 5);
    pinAcceptCursor(harness.pane, 5);
    await runBothAccept(harness);
    assert.deepStrictEqual(harness.readCalls, []);
    assert.deepStrictEqual(harness.applyCalls, []);
  });
  test("untracked row hides Accept", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-untracked", { kind: "Untracked", indexState: "Unstaged" })
    });
    assertAcceptHidden(harness);
  });
  test("fully staged row labeled workingTree hides Accept", async function() {
    const resource = toResource.call(this, "/project/src/accept-staged.ts");
    const harness = await mountAcceptHunkHosts(this, {
      ref: {
        modified: resource,
        original: toResource.call(this, "/project/src/accept-staged.ts.git"),
        groupId: "workingTree",
        origin: "engine",
        sessionId: "session-1",
        gitPath: "src/a.ts",
        indexState: "Staged",
        kind: "Modified"
      },
      matchScm: true,
      scmGroupId: "workingTree"
    });
    assert.strictEqual(writeGroupId(harness.view), "workingTree");
    assertAcceptHidden(harness);
  });
  test("groupId index with Modified Unstaged still shows Accept", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-index", { groupId: "index", kind: "Modified", indexState: "Unstaged" })
    });
    assert.strictEqual(writeGroupId(harness.view), "index");
    assert.strictEqual(writeGroupId(harness.pane), "index");
    assertAcceptShown(harness);
  });
  test("disconnected engine hides Accept on an eligible row", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-offline"),
      connected: false
    });
    assertAcceptHidden(harness);
  });
  test("empty engine path hides Accept and does not read", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-empty-path", { gitPath: "" })
    });
    assertAcceptHidden(harness);
    pinAcceptCursor(harness.view, 5);
    pinAcceptCursor(harness.pane, 5);
    await runBothAccept(harness);
    assert.deepStrictEqual(harness.readCalls, []);
    assert.deepStrictEqual(harness.applyCalls, []);
  });
  test("empty pinned session hides Accept and does not read", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-empty-session", { sessionId: "" })
    });
    assertAcceptHidden(harness);
    pinAcceptCursor(harness.view, 5);
    pinAcceptCursor(harness.pane, 5);
    await runBothAccept(harness);
    assert.deepStrictEqual(harness.readCalls, []);
    assert.deepStrictEqual(harness.applyCalls, []);
  });
  test("Accept click reads Unstaged diff and applies only the cursor hunk", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-click", { indexState: "WORKTREE", kind: "Modified" }),
      countRefresh: true
    });
    pinAcceptCursor(harness.view, 5);
    pinAcceptCursor(harness.pane, 5);
    await runBothAccept(harness);
    assert.strictEqual(harness.readCalls.length, 2);
    for (const request of harness.readCalls) {
      assert.strictEqual(request.sessionId, "session-1");
      assert.strictEqual(request.path, "src/a.ts");
      assert.strictEqual(request.indexState, "Unstaged");
    }
    const expected = sourcesGitHunkPatchAtCursor(acceptCursorUnifiedDiff, 5, "new");
    assert.ok(expected);
    assert.strictEqual(harness.applyCalls.length, 2);
    for (const request of harness.applyCalls) {
      assert.deepStrictEqual([...request.argv], ["git", "apply", "--cached", "--whitespace=nowarn"]);
      assert.deepStrictEqual([...request.argv], [...SOURCES_GIT_APPLY_CACHED_ARGV]);
      assert.strictEqual(request.patches.length, 1);
      assert.strictEqual(request.patches[0], expected);
      assert.ok(request.patches[0]?.includes("rename from src/a.ts"));
      assert.ok(request.patches[0]?.includes("old mode 100644"));
      assert.ok(request.patches[0]?.includes("new mode 100755"));
      assert.ok(request.patches[0]?.includes("@@ -10,2 +11,3 @@"));
      assert.ok(request.patches[0]?.includes("\\ No newline at end of file"));
      assert.ok(!request.patches[0]?.includes("@@ -1,3 +1,4 @@"));
    }
    assert.deepStrictEqual(harness.gitCommands, []);
    assert.strictEqual(harness.refreshCount.n, 2);
  });
  test("cursor outside every hunk reads once per host and does not apply", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-miss"),
      countRefresh: true
    });
    pinAcceptCursor(harness.view, 99);
    pinAcceptCursor(harness.pane, 99);
    await runBothAccept(harness);
    assert.strictEqual(harness.readCalls.length, 2);
    assert.deepStrictEqual(harness.applyCalls, []);
    assert.strictEqual(harness.refreshCount.n, 0);
    assert.strictEqual(harness.view.element.querySelector(".sources-diff-panel-action-notice")?.textContent, sourcesDiffAcceptUnavailableMessage());
    assert.strictEqual(harness.parent.querySelector(".conversation-diff-review-notice")?.textContent, sourcesDiffAcceptUnavailableMessage());
  });
  test("binary diff does not apply", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-binary"),
      unifiedDiff: "diff --git a/a.bin b/a.bin\nBinary files a/a.bin and b/a.bin differ\n"
    });
    pinAcceptCursor(harness.view, 1);
    pinAcceptCursor(harness.pane, 1);
    await runBothAccept(harness);
    assert.strictEqual(harness.readCalls.length, 2);
    assert.deepStrictEqual(harness.applyCalls, []);
  });
  test("missing cursor does not read or apply", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-no-cursor"),
      countRefresh: true
    });
    await runBothAccept(harness);
    assert.deepStrictEqual(harness.readCalls, []);
    assert.deepStrictEqual(harness.applyCalls, []);
    assert.strictEqual(harness.refreshCount.n, 0);
  });
  test("write closed Accept sends no ReadGitFileDiff and no Apply", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-closed"),
      writeClosed: true,
      countRefresh: true
    });
    pinAcceptCursor(harness.view, 5);
    pinAcceptCursor(harness.pane, 5);
    await runBothAccept(harness);
    assert.deepStrictEqual(harness.readCalls, []);
    assert.deepStrictEqual(harness.applyCalls, []);
    assert.strictEqual(harness.refreshCount.n, 0);
    assert.deepStrictEqual(harness.gitCommands, []);
  });
  test("engine session not ready sends no ReadGitFileDiff and no Apply", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-not-ready"),
      engineSessionReady: false
    });
    pinAcceptCursor(harness.view, 5);
    pinAcceptCursor(harness.pane, 5);
    await runBothAccept(harness);
    assert.deepStrictEqual(harness.readCalls, []);
    assert.deepStrictEqual(harness.applyCalls, []);
    assert.deepStrictEqual(harness.gitCommands, []);
  });
  test("engine success false shows error_message and does not refresh", async function() {
    const harness = await mountAcceptHunkHosts(this, {
      ref: engineAcceptRef("accept-denied", { indexState: "WORKTREE" }),
      countRefresh: true,
      applySuccess: false,
      applyErrorMessage: "apply denied"
    });
    pinAcceptCursor(harness.view, 5);
    pinAcceptCursor(harness.pane, 5);
    await runBothAccept(harness);
    assert.strictEqual(harness.applyCalls.length, 2);
    assert.strictEqual(harness.view.element.querySelector(".sources-diff-panel-action-notice")?.textContent, "apply denied");
    assert.strictEqual(harness.parent.querySelector(".conversation-diff-review-notice")?.textContent, "apply denied");
    assert.strictEqual(harness.refreshCount.n, 0);
    assert.deepStrictEqual(harness.gitCommands, []);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL3NvdXJjZXMvdGVzdC9icm93c2VyL3NvdXJjZXNEaWZmUGFuZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IE51bGxDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL3Rlc3QvY29tbW9uL251bGxDb21tYW5kU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBlcnJvckhhbmRsZXIsIHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSwgdG9SZXNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgaXNJTWVudUl0ZW0sIE1lbnVJZCwgTWVudVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgdHlwZSBDb250ZXh0S2V5RXhwcmVzc2lvbiwgdHlwZSBDb250ZXh0S2V5VmFsdWUsIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi91bml2ZXJzZUFnZW50Q29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgdHlwZSB7IFVuaXZlcnNlQWdlbnRSZWFkR2l0RmlsZURpZmZSZXF1ZXN0LCBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdCwgVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3QsIFVuaXZlcnNlQWdlbnRXcml0ZUdpdFdyaXRlUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudFR5cGVzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSURpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdERpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci9kaWZmL3Rlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXNlckludGVyYWN0aW9uU2VydmljZSwgTW9ja1VzZXJJbnRlcmFjdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VySW50ZXJhY3Rpb24vYnJvd3Nlci91c2VySW50ZXJhY3Rpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQgfSBmcm9tICcuLi8uLi8uLi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25TZXNzaW9uU3RhdHVzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgVmlld0NvbnRhaW5lckV4dGVuc2lvbnMsIEV4dGVuc2lvbnMgYXMgVmlld0V4dGVuc2lvbnMsIElWaWV3Q29udGFpbmVyTW9kZWwsIElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5LCBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBJVmlld1BhbmVDb250YWluZXIsIElWaWV3c1JlZ2lzdHJ5LCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9kaWZmRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UsIFRlc3RFZGl0b3JHcm91cFZpZXcsIFRlc3RFZGl0b3JJbnB1dCwgVGVzdFZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25TdHViU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQWdlbnRTZXNzaW9uQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2FnZW50U2Vzc2lvbi9jb21tb24vYWdlbnRTZXNzaW9uQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBJU0NNUmVzb3VyY2UsIElTQ01TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2NtL2NvbW1vbi9zY20uanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRGlmZlJldmlld0VkaXRvcklkIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9jb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgSVF1aWNrRGlmZlNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zY20vY29tbW9uL3F1aWNrRGlmZi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dC5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVNvdXJjZXNDaGFuZ2VFbnRyeU9wZW5EZXBzLCBvcGVuU291cmNlc0NoYW5nZUVudHJ5IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zb3VyY2VzQ2hhbmdlRW50cnlPcGVuLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNvdXJjZXNDb252ZXJzYXRpb25PcGVuSGFybmVzcyB9IGZyb20gJy4vc291cmNlc0NvbnZlcnNhdGlvbk9wZW5IYXJuZXNzLmpzJztcbmltcG9ydCB7IFNPVVJDRVNfRElGRl9NT1ZFX1RPX0NPTlZFUlNBVElPTl9WSUVXX0NPTU1BTkQsIFNPVVJDRVNfRElGRl9NT1ZFX1RPX1BSRVZJRVdfQ09NTUFORCwgU09VUkNFU19ESUZGX01PVkVfVE9fUFJFVklFV19WSUVXX0NPTU1BTkQgfSBmcm9tICcuLi8uLi9icm93c2VyL3NvdXJjZXNEaWZmQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBtb3ZlQWN0aXZlRGlmZlRvQ29udmVyc2F0aW9uLCByZXNvbHZlU291cmNlc0NoYW5nZVJlZkZyb21FZGl0b3IgfSBmcm9tICcuLi8uLi9icm93c2VyL3NvdXJjZXNEaWZmUmVmSGVscGVycy5qcyc7XG5pbXBvcnQgeyBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19DT05UQUlORVIgfSBmcm9tICcuLi8uLi9icm93c2VyL3NvdXJjZXNEaWZmUGFuZWwuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IFNPVVJDRVNfRElGRl9QQU5FTF9DT05UQUlORVJfSUQsIFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lEIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zb3VyY2VzRGlmZlBhbmVsSWRzLmpzJztcbmltcG9ydCB7IFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zb3VyY2VzRGlmZlBhbmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTb3VyY2VzRGlmZlBhbmVsVmlldyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc291cmNlc0RpZmZQYW5lbFZpZXcuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2RpZmZFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVNvdXJjZXNDaGFuZ2VSZWYsIHNvdXJjZXNHaXRBcHBseUh1bmtzUGF0Y2hlcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9zb3VyY2VzQ2hhbmdlUmVmLmpzJztcbmltcG9ydCB7IFNPVVJDRVNfR0lUX0FQUExZX0NBQ0hFRF9BUkdWLCBzb3VyY2VzR2l0SHVua1BhdGNoQXRDdXJzb3IgfSBmcm9tICcuLi8uLi9jb21tb24vc291cmNlc0dpdEh1bmtQYXRjaC5qcyc7XG5pbXBvcnQgeyBJU291cmNlc0NoYW5nZUVudHJ5LCBJU291cmNlc0NoYW5nZXNNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9zb3VyY2VzQ2hhbmdlc01vZGVsLmpzJztcbmltcG9ydCB7IFNvdXJjZXNDaGFuZ2VzTW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vc291cmNlc0NoYW5nZXNSZWFkTW9kZWwuanMnO1xuaW1wb3J0IHsgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHNvdXJjZXNEaWZmQWNjZXB0VW5hdmFpbGFibGVNZXNzYWdlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NvdXJjZXNEaWZmV3JpdGVDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IGNhblNlbmRTb3VyY2VzR2l0QXBwbHlIdW5rcywgY2FuU2VuZFNvdXJjZXNHaXRTdGFnZVBhdGhzLCBjYW5TaG93U291cmNlc1Jldmlld0FjY2VwdCwgcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVBY3Rpb25zLCBzb3VyY2VzR2l0RW1wdHlTdGFnZVBhdGhNZXNzYWdlLCBzb3VyY2VzR2l0U2Vzc2lvbkNoYW5nZWRNZXNzYWdlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzR2l0V3JpdGUuanMnO1xuXG5mdW5jdGlvbiBldmFsV2hlbih3aGVuOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCwgdmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBDb250ZXh0S2V5VmFsdWU+KTogYm9vbGVhbiB7XG5cdGlmICghd2hlbikge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHJldHVybiB3aGVuLmV2YWx1YXRlKHsgZ2V0VmFsdWU6IDxUIGV4dGVuZHMgQ29udGV4dEtleVZhbHVlID0gQ29udGV4dEtleVZhbHVlPihrZXk6IHN0cmluZykgPT4gdmFsdWVzW2tleV0gYXMgVCB9KTtcbn1cblxuc3VpdGUoJ1NvdXJjZXMgZGlmZiBwYW5lbCcsICgpID0+IHtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IHZpZXdDb250YWluZXJzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oVmlld0NvbnRhaW5lckV4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSk7XG5cdGNvbnN0IHZpZXdzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oVmlld0V4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSk7XG5cblx0dGVzdCgnRGlmZiBwYW5lbCBjb250YWluZXIgYW5kIHZpZXcgcmVnaXN0ZXIgb24gUGFuZWwgd2l0aCBoaWRlSWZFbXB0eScsICgpID0+IHtcblx0XHRjb25zdCBjb250YWluZXIgPSB2aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmdldChTT1VSQ0VTX0RJRkZfUEFORUxfQ09OVEFJTkVSX0lEKTtcblx0XHRhc3NlcnQub2soY29udGFpbmVyLCAnU291cmNlcyBkaWZmIHBhbmVsIGNvbnRhaW5lciBzaG91bGQgYmUgcmVnaXN0ZXJlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250YWluZXIsIFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0NPTlRBSU5FUik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRhaW5lci5oaWRlSWZFbXB0eSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0dmlld0NvbnRhaW5lcnNSZWdpc3RyeS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24oY29udGFpbmVyKSxcblx0XHRcdFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCxcblx0XHRcdCdTb3VyY2VzIGRpZmYgcGFuZWwgbXVzdCBsaXZlIG9uIFBBTkVMX1BBUlQnXG5cdFx0KTtcblxuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yID0gdmlld3NSZWdpc3RyeS5nZXRWaWV3KFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lEKTtcblx0XHRhc3NlcnQub2sodmlld0Rlc2NyaXB0b3IsICdTb3VyY2VzIGRpZmYgcGFuZWwgdmlldyBzaG91bGQgYmUgcmVnaXN0ZXJlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3c1JlZ2lzdHJ5LmdldFZpZXdDb250YWluZXIoU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQpLCBjb250YWluZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3RGVzY3JpcHRvci53aGVuLCBTb3VyY2VzRGlmZlBhbmVsU2VydmljZS5jdHhIYXNDaGFuZ2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG93IGVuYWJsZXMgdmlldyBjb250ZXh0IGFuZCBjbGVhciBkaXNhYmxlcyBpdCBmb3IgaGlkZUlmRW1wdHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hLnRzJyk7XG5cdFx0Y29uc3QgcmVmID0ge1xuXHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0b3JpZ2luYWw6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2EudHMuZ2l0JyksXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdH07XG5cblx0XHRjb25zdCBvcGVuVmlld0NhbGxzOiBBcnJheTx7IGlkOiBzdHJpbmc7IGZvY3VzOiBib29sZWFuIHwgdW5kZWZpbmVkIH0+ID0gW107XG5cdFx0Y2xhc3MgVHJhY2tpbmdWaWV3c1NlcnZpY2UgZXh0ZW5kcyBUZXN0Vmlld3NTZXJ2aWNlIHtcblx0XHRcdG92ZXJyaWRlIG9wZW5WaWV3PFQ+KGlkOiBzdHJpbmcsIGZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8VCB8IG51bGw+IHtcblx0XHRcdFx0b3BlblZpZXdDYWxscy5wdXNoKHsgaWQsIGZvY3VzIH0pO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdFx0fVxuXHRcdFx0ZGlzcG9zZSgpOiB2b2lkIHsgfVxuXHRcdH1cblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUcmFja2luZ1ZpZXdzU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHZpZXdzU2VydmljZSk7XG5cblx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGN0eFZhbHVlcyA9ICgpID0+ICh7XG5cdFx0XHRbU291cmNlc0RpZmZQYW5lbFNlcnZpY2UuY3R4SGFzQ2hhbmdlLmtleV06IGNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxib29sZWFuPihTb3VyY2VzRGlmZlBhbmVsU2VydmljZS5jdHhIYXNDaGFuZ2Uua2V5KSA/PyBmYWxzZSxcblx0XHRcdHZpZXc6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXZhbFdoZW4oU291cmNlc0RpZmZQYW5lbFNlcnZpY2UuY3R4SGFzQ2hhbmdlLCBjdHhWYWx1ZXMoKSksXG5cdFx0XHRmYWxzZSxcblx0XHRcdCdoaWRlSWZFbXB0eSBjb250YWluZXIgbXVzdCBzdGFydCBpbmFjdGl2ZSdcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHJlZiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTZXJ2aWNlLmdldEN1cnJlbnRSZWYoKSwgcmVmKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRldmFsV2hlbihTb3VyY2VzRGlmZlBhbmVsU2VydmljZS5jdHhIYXNDaGFuZ2UsIGN0eFZhbHVlcygpKSxcblx0XHRcdHRydWUsXG5cdFx0XHQnc2hvdyBtdXN0IGFjdGl2YXRlIHRoZSBkaWZmIHBhbmVsIHZpZXcnXG5cdFx0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wZW5WaWV3Q2FsbHMsIFt7IGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCwgZm9jdXM6IHRydWUgfV0pO1xuXG5cdFx0cGFuZWxTZXJ2aWNlLmNsZWFyKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU2VydmljZS5nZXRDdXJyZW50UmVmKCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXZhbFdoZW4oU291cmNlc0RpZmZQYW5lbFNlcnZpY2UuY3R4SGFzQ2hhbmdlLCBjdHhWYWx1ZXMoKSksXG5cdFx0XHRmYWxzZSxcblx0XHRcdCdjbGVhciBtdXN0IGRlYWN0aXZhdGUgdGhlIGRpZmYgcGFuZWwgdmlldydcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG93IHJlcGxhY2VzIHRoZSBjdXJyZW50IGNoYW5nZSByZWYnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2VBID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYS50cycpO1xuXHRcdGNvbnN0IHJlc291cmNlQiA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2IudHMnKTtcblx0XHRjb25zdCByZWZBID0geyBtb2RpZmllZDogcmVzb3VyY2VBLCBvcmlnaW5hbDogdW5kZWZpbmVkLCBncm91cElkOiAnd29ya2luZ1RyZWUnIH07XG5cdFx0Y29uc3QgcmVmQiA9IHsgbW9kaWZpZWQ6IHJlc291cmNlQiwgb3JpZ2luYWw6IHVuZGVmaW5lZCwgZ3JvdXBJZDogJ3dvcmtpbmdUcmVlJyB9O1xuXG5cdFx0Y29uc3QgY2hhbmdlczogQXJyYXk8VVJJIHwgdW5kZWZpbmVkPiA9IFtdO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdHN0b3JlLmFkZChwYW5lbFNlcnZpY2Uub25EaWRDaGFuZ2VSZWYocmVmID0+IGNoYW5nZXMucHVzaChyZWY/Lm1vZGlmaWVkKSkpO1xuXG5cdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3cocmVmQSk7XG5cdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3cocmVmQik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTZXJ2aWNlLmdldEN1cnJlbnRSZWYoKT8ubW9kaWZpZWQudG9TdHJpbmcoKSwgcmVzb3VyY2VCLnRvU3RyaW5nKCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2hhbmdlcy5tYXAodXJpID0+IHVyaT8udG9TdHJpbmcoKSksIFtyZXNvdXJjZUEudG9TdHJpbmcoKSwgcmVzb3VyY2VCLnRvU3RyaW5nKCldKTtcblx0fSk7XG5cblx0dGVzdCgncGFuZWwgVmlld1RpdGxlIGV4cG9zZXMgbW92ZSB0byBjb252ZXJzYXRpb24gYW5kIHByZXZpZXcgYWN0aW9ucycsICgpID0+IHtcblx0XHRjb25zdCB2aWV3VGl0bGVJdGVtcyA9IE1lbnVSZWdpc3RyeS5nZXRNZW51SXRlbXMoTWVudUlkLlZpZXdUaXRsZSkuZmlsdGVyKGlzSU1lbnVJdGVtKTtcblx0XHRjb25zdCBtb3ZlVG9Db252ZXJzYXRpb24gPSB2aWV3VGl0bGVJdGVtcy5maW5kKGl0ZW0gPT4gaXRlbS5jb21tYW5kLmlkID09PSBTT1VSQ0VTX0RJRkZfTU9WRV9UT19DT05WRVJTQVRJT05fVklFV19DT01NQU5EKTtcblx0XHRjb25zdCBtb3ZlVG9QcmV2aWV3ID0gdmlld1RpdGxlSXRlbXMuZmluZChpdGVtID0+IGl0ZW0uY29tbWFuZC5pZCA9PT0gU09VUkNFU19ESUZGX01PVkVfVE9fUFJFVklFV19WSUVXX0NPTU1BTkQpO1xuXG5cdFx0YXNzZXJ0Lm9rKG1vdmVUb0NvbnZlcnNhdGlvbiwgJ1BhbmVsIHZpZXcgdGl0bGUgbXVzdCBleHBvc2UgbW92ZSB0byBjb252ZXJzYXRpb24nKTtcblx0XHRhc3NlcnQub2sobW92ZVRvUHJldmlldywgJ1BhbmVsIHZpZXcgdGl0bGUgbXVzdCBleHBvc2UgbW92ZSB0byBwcmV2aWV3Jyk7XG5cdFx0YXNzZXJ0Lm9rKG1vdmVUb0NvbnZlcnNhdGlvbi53aGVuLCAnUGFuZWwgbW92ZSB0byBjb252ZXJzYXRpb24gbXVzdCBiZSBnYXRlZCcpO1xuXHRcdGFzc2VydC5vayhtb3ZlVG9QcmV2aWV3LndoZW4sICdQYW5lbCBtb3ZlIHRvIHByZXZpZXcgbXVzdCBiZSBnYXRlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdGV2YWxXaGVuKG1vdmVUb0NvbnZlcnNhdGlvbi53aGVuLCB7IHZpZXc6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELCBbU291cmNlc0RpZmZQYW5lbFNlcnZpY2UuY3R4SGFzQ2hhbmdlLmtleV06IHRydWUgfSksXG5cdFx0XHR0cnVlXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRldmFsV2hlbihtb3ZlVG9QcmV2aWV3LndoZW4sIHsgdmlldzogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsIFtTb3VyY2VzRGlmZlBhbmVsU2VydmljZS5jdHhIYXNDaGFuZ2Uua2V5XTogZmFsc2UgfSksXG5cdFx0XHRmYWxzZVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VkaXRvclRpdGxlIGV4cG9zZXMgbW92ZSB0byBwcmV2aWV3IHdoZW4gQ29udmVyc2F0aW9uIERpZmYgaXMgYWN0aXZlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGVkaXRvclRpdGxlSXRlbXMgPSBNZW51UmVnaXN0cnkuZ2V0TWVudUl0ZW1zKE1lbnVJZC5FZGl0b3JUaXRsZSkuZmlsdGVyKGlzSU1lbnVJdGVtKTtcblx0XHRjb25zdCBtb3ZlVG9QcmV2aWV3ID0gZWRpdG9yVGl0bGVJdGVtcy5maW5kKGl0ZW0gPT4gaXRlbS5jb21tYW5kLmlkID09PSBTT1VSQ0VTX0RJRkZfTU9WRV9UT19QUkVWSUVXX0NPTU1BTkQpO1xuXG5cdFx0YXNzZXJ0Lm9rKG1vdmVUb1ByZXZpZXcsICdDb252ZXJzYXRpb24gRGlmZiBlZGl0b3IgdGl0bGUgbXVzdCBleHBvc2UgbW92ZSB0byBwcmV2aWV3Jyk7XG5cdFx0YXNzZXJ0Lm9rKG1vdmVUb1ByZXZpZXcud2hlbiwgJ0NvbnZlcnNhdGlvbiBEaWZmIG1vdmUgdG8gcHJldmlldyBtdXN0IGJlIGdhdGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXZhbFdoZW4obW92ZVRvUHJldmlldy53aGVuLCB7IGFjdGl2ZUVkaXRvcjogQ29udmVyc2F0aW9uRGlmZlJldmlld0VkaXRvcklkIH0pLFxuXHRcdFx0dHJ1ZVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXZhbFdoZW4obW92ZVRvUHJldmlldy53aGVuLCB7IGFjdGl2ZUVkaXRvcjogJ3dvcmtiZW5jaC5lZGl0b3IuZmlsZXMudGV4dEZpbGVFZGl0b3InIH0pLFxuXHRcdFx0ZmFsc2Vcblx0XHQpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBjcmVhdGVWaWV3RGVzY3JpcHRvclNlcnZpY2VTdHViKCk6IElWaWV3RGVzY3JpcHRvclNlcnZpY2Uge1xuXHRcdHJldHVybiB7XG5cdFx0XHRnZXRWaWV3TG9jYXRpb25CeUlkOiAoKSA9PiBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsXG5cdFx0XHRvbkRpZENoYW5nZUxvY2F0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0Z2V0Vmlld0Rlc2NyaXB0b3JCeUlkOiAoKSA9PiBudWxsLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkOiAoKSA9PiAoe1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX0NPTlRBSU5FUl9JRCxcblx0XHRcdFx0dGl0bGU6IHsgdmFsdWU6ICdEaWZmJywgb3JpZ2luYWw6ICdEaWZmJyB9LFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjoge30gYXMgU3luY0Rlc2NyaXB0b3I8SVZpZXdQYW5lQ29udGFpbmVyPixcblx0XHRcdH0pLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lck1vZGVsOiAoKSA9PiAoe1xuXHRcdFx0XHRvbkRpZENoYW5nZUNvbnRhaW5lckluZm86IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIElWaWV3Q29udGFpbmVyTW9kZWwpLFxuXHRcdFx0Z2V0RGVmYXVsdENvbnRhaW5lckJ5SWQ6ICgpID0+IG51bGwsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3RGVzY3JpcHRvclNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVMaXZlU2NtU2VydmljZShyZXNvdXJjZTogVVJJLCBsaXZlR3JvdXBJZDogc3RyaW5nKTogSVNDTVNlcnZpY2Uge1xuXHRcdGNvbnN0IGdyb3VwID0ge1xuXHRcdFx0aWQ6IGxpdmVHcm91cElkLFxuXHRcdFx0bGFiZWw6IGxpdmVHcm91cElkID09PSAnaW5kZXgnID8gJ1N0YWdlZCBDaGFuZ2VzJyA6ICdDaGFuZ2VzJyxcblx0XHRcdHJlc291cmNlczogW10gYXMgSVNDTVJlc291cmNlW10sXG5cdFx0fTtcblx0XHRjb25zdCBzY21SZXNvdXJjZSA9IHtcblx0XHRcdHNvdXJjZVVyaTogcmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZUdyb3VwOiBncm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGdyb3VwLnJlc291cmNlcy5wdXNoKHNjbVJlc291cmNlKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0ge1xuXHRcdFx0cHJvdmlkZXI6IHtcblx0XHRcdFx0Z3JvdXBzOiBbZ3JvdXBdLFxuXHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7IHJldHVybiBbcmVwb3NpdG9yeV07IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVMZWZ0b3ZlclNjbVNlcnZpY2UocmVzb3VyY2U6IFVSSSwgZ3JvdXBJZCA9ICd3b3JraW5nVHJlZScpOiBJU0NNU2VydmljZSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSB7XG5cdFx0XHRpZDogZ3JvdXBJZCxcblx0XHRcdGxhYmVsOiBncm91cElkID09PSAnaW5kZXgnID8gJ1N0YWdlZCBDaGFuZ2VzJyA6ICdDaGFuZ2VzJyxcblx0XHRcdHJlc291cmNlczogW10gYXMgSVNDTVJlc291cmNlW10sXG5cdFx0fTtcblx0XHRjb25zdCBzY21SZXNvdXJjZSA9IHtcblx0XHRcdHNvdXJjZVVyaTogcmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZUdyb3VwOiBncm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGdyb3VwLnJlc291cmNlcy5wdXNoKHNjbVJlc291cmNlKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0ge1xuXHRcdFx0cHJvdmlkZXI6IHtcblx0XHRcdFx0Z3JvdXBzOiBbZ3JvdXBdLFxuXHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7IHJldHVybiBbcmVwb3NpdG9yeV07IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBlbXB0eURpZmZTY21TZXJ2aWNlKCk6IElTQ01TZXJ2aWNlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IHJlcG9zaXRvcmllcygpIHsgcmV0dXJuIFtdOyB9LFxuXHRcdFx0Z2V0IHJlcG9zaXRvcnlDb3VudCgpIHsgcmV0dXJuIDA7IH0sXG5cdFx0XHRvbkRpZEFkZFJlcG9zaXRvcnk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZFJlbW92ZVJlcG9zaXRvcnk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRyZWdpc3RlclNDTVByb3ZpZGVyOiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH0sXG5cdFx0XHRnZXRSZXBvc2l0b3J5OiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01TZXJ2aWNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3R1YlNlc3Npb25BbmRDaGFuZ2VzTW9kZWwoXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlPixcblx0XHRjb25uZWN0aW9uOiBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sXG5cdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBib29sZWFuLFxuXHQpOiB2b2lkIHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElBZ2VudFNlc3Npb25Db250ZXh0LCB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzaW9uLTEnLFxuXHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGVuZ2luZVNlc3Npb25SZWFkeSxcblx0XHRcdGlzUGFpcmluZ0hvbGQ6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcGhhc2UgPSB0eXBlb2YgY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UgPT09ICdmdW5jdGlvbicgPyBjb25uZWN0aW9uLmdldENvbm5lY3Rpb25QaGFzZSgpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBzbmFwc2hvdCA9IHR5cGVvZiBjb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCA9PT0gJ2Z1bmN0aW9uJyA/IGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdHJldHVybiBwaGFzZT8ua2luZCA9PT0gJ2Nvbm5lY3RlZCcgJiYgISFzbmFwc2hvdD8ucGFpcmluZ1BlbmRpbmc7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VTZXNzaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IHVzZWQnKTsgfSxcblx0XHR9IHNhdGlzZmllcyBJQWdlbnRTZXNzaW9uQ29udGV4dCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0NoYW5nZXNNb2RlbCwgc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNDaGFuZ2VzTW9kZWwpKSk7XG5cdH1cblxuXHRmdW5jdGlvbiBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyhvcHRpb25zOiB7XG5cdFx0dGhyb3dPbkxvYWQ/OiBib29sZWFuO1xuXHRcdGV4ZWN1dGVDb21tYW5kPzogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gUHJvbWlzZTx1bmtub3duPjtcblx0XHRyZXNvdXJjZT86IFVSSTtcblx0XHRncm91cElkPzogc3RyaW5nO1xuXHRcdGNvbm5lY3Rpb24/OiBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0ZW5naW5lU2Vzc2lvblJlYWR5PzogYm9vbGVhbjtcblx0fSA9IHt9KSB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIHN0b3JlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElEaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSwgbmV3IFRlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VySW50ZXJhY3Rpb25TZXJ2aWNlLCBuZXcgTW9ja1VzZXJJbnRlcmFjdGlvblNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBjcmVhdGVWaWV3RGVzY3JpcHRvclNlcnZpY2VTdHViKCkpO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBvcHRpb25zLmNvbm5lY3Rpb24gPz8ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIGNvbm5lY3Rpb24pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UsIHtcblx0XHRcdGdldEFjdGl2ZVNlc3Npb25JZDogKCkgPT4gJ3Nlc3Npb24tMScsXG5cdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gb3B0aW9ucy5lbmdpbmVTZXNzaW9uUmVhZHkgPz8gdHJ1ZSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNDTVNlcnZpY2UsIG9wdGlvbnMucmVzb3VyY2Vcblx0XHRcdD8gY3JlYXRlTGVmdG92ZXJTY21TZXJ2aWNlKG9wdGlvbnMucmVzb3VyY2UsIG9wdGlvbnMuZ3JvdXBJZClcblx0XHRcdDogZW1wdHlEaWZmU2NtU2VydmljZSgpKTtcblx0XHRzdHViU2Vzc2lvbkFuZENoYW5nZXNNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgY29ubmVjdGlvbiwgb3B0aW9ucy5lbmdpbmVTZXNzaW9uUmVhZHkgPz8gdHJ1ZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29tbWFuZFNlcnZpY2UsIHtcblx0XHRcdG9uV2lsbEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRFeGVjdXRlQ29tbWFuZDogRXZlbnQuTm9uZSxcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBvcHRpb25zLmV4ZWN1dGVDb21tYW5kID8/IChhc3luYyAoKSA9PiB1bmRlZmluZWQpLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdGlmIChvcHRpb25zLnRocm93T25Mb2FkKSB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0TW9kZWxTZXJ2aWNlLCB7XG5cdFx0XHRcdGNyZWF0ZU1vZGVsUmVmZXJlbmNlOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdH1cblxuXHR0ZXN0KCdQYW5lbCBBY2NlcHQgaXMgaGlkZGVuIHdpdGhvdXQgQXBwbHlIdW5rcyBwYXlsb2FkOyBTQ00gbG9jYWwgYWN0aW9uIGlzIFN0YWdlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5TaG93U291cmNlc1Jldmlld0FjY2VwdCh0cnVlLCBmYWxzZSksIGZhbHNlKTtcblx0XHRjb25zdCBzY21Pbmx5ID0gcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVBY3Rpb25zKHtcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRoYXNTY21SZXNvdXJjZTogdHJ1ZSxcblx0XHRcdGNhbldyaXRlU3RhZ2U6IGZhbHNlLFxuXHRcdFx0Y2FuV3JpdGVBY2NlcHQ6IHRydWUsXG5cdFx0XHRoYXNBcHBseUh1bmtzUGF5bG9hZDogZmFsc2UsXG5cdFx0XHRoYXNHaXRTdGFnZUNvbW1hbmQ6IHRydWUsXG5cdFx0XHRoYXNHaXRVbnN0YWdlQ29tbWFuZDogZmFsc2UsXG5cdFx0XHRoYXNHaXRDbGVhbkNvbW1hbmQ6IGZhbHNlLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY21Pbmx5LnNob3dTdGFnZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjbU9ubHkuc2hvd0FjY2VwdCwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdEaWZmIHBhbmVsIGxvYWQgZmFpbCBoaWRlcyB0aXRsZSBhdXRob3JpdHkgYW5kIHdyaXRlIGNocm9tZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2EudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2EudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoeyB0aHJvd09uTG9hZDogdHJ1ZSwgcmVzb3VyY2UgfSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSksIGZhbHNlKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdGl0bGUnKT8udGV4dENvbnRlbnQgPz8gJycsICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1yZXZlcnQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC11bnN0YWdlJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0dmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtbmV3LWZpbGUtbm90aWNlJyk/LnRleHRDb250ZW50ID8/ICcnLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc291cmNlc0RpZmZQYW5lbC5sb2FkRmFpbGVkJywgXCJVbmFibGUgdG8gbG9hZCB0aGlzIGNvbXBhcmlzb24uXCIpLFxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5vayh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1uZXctZmlsZS1ub3RpY2UnKT8uY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1lcnJvcicpKTtcblx0XHRcdGFzc2VydC5vayghKHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLW5ldy1maWxlLW5vdGljZScpPy50ZXh0Q29udGVudCA/PyAnJykuaW5jbHVkZXMoJ05ldyBmaWxlJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1oZWFkZXInKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnc3VwZXJzZWRlZCBhc3luYyByZW5kZXIgY2Fubm90IHBhaW50IGFuIG9sZGVyIGZpbGUgZGlmZicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZUEgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9zdGFsZS1wYW5lbC1hLnRzJyk7XG5cdFx0Y29uc3QgcmVzb3VyY2VCID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvc3RhbGUtcGFuZWwtYi50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsQSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3N0YWxlLXBhbmVsLWEudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWxCID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvc3RhbGUtcGFuZWwtYi50cy5naXQnKTtcblx0XHRjb25zdCBzdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHRsZXQgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlIHwgdW5kZWZpbmVkO1xuXHRcdGxldCB2aWV3OiBTb3VyY2VzRGlmZlBhbmVsVmlldyB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlbGVhc2VTdGFsZTogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgc3RhbGVHYXRlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHJlbGVhc2VTdGFsZSA9IHJlc29sdmU7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoeyByZXNvdXJjZTogcmVzb3VyY2VBIH0pO1xuXHRcdFx0dGV4dEZpbGVTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElUZXh0RmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZmFrZVdpZGdldCA9IHtcblx0XHRcdFx0c2V0TW9kZWw6ICgpID0+IHsgfSxcblx0XHRcdFx0Z2V0TW9kaWZpZWRFZGl0b3I6ICgpID0+ICh7IG9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb246IEV2ZW50Lk5vbmUsIG9uRGlkRm9jdXNFZGl0b3JUZXh0OiBFdmVudC5Ob25lLCBoYXNUZXh0Rm9jdXM6ICgpID0+IGZhbHNlLCBnZXRQb3NpdGlvbjogKCkgPT4gdW5kZWZpbmVkIH0pLFxuXHRcdFx0XHRnZXRPcmlnaW5hbEVkaXRvcjogKCkgPT4gKHsgb25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbjogRXZlbnQuTm9uZSwgb25EaWRGb2N1c0VkaXRvclRleHQ6IEV2ZW50Lk5vbmUsIGhhc1RleHRGb2N1czogKCkgPT4gZmFsc2UsIGdldFBvc2l0aW9uOiAoKSA9PiB1bmRlZmluZWQgfSksXG5cdFx0XHRcdGxheW91dDogKCkgPT4geyB9LFxuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH0sXG5cdFx0XHR9O1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1Ykluc3RhbmNlKERpZmZFZGl0b3JXaWRnZXQsIGZha2VXaWRnZXQgYXMgdW5rbm93biBhcyBEaWZmRWRpdG9yV2lkZ2V0KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGNvbnN0IHJlbmRlckhvc3QgPSB2aWV3IGFzIHVua25vd24gYXMge1xuXHRcdFx0XHRyZW5kZXJEaWZmOiAob3JpZ2luYWw6IFVSSSwgbW9kaWZpZWQ6IFVSSSwgZ2VuZXJhdGlvbjogbnVtYmVyKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHJlbmRlckRpZmYgPSByZW5kZXJIb3N0LnJlbmRlckRpZmYuYmluZCh2aWV3KTtcblx0XHRcdGxldCByZW5kZXJDYWxscyA9IDA7XG5cdFx0XHRyZW5kZXJIb3N0LnJlbmRlckRpZmYgPSBhc3luYyAob3JpZ2luYWwsIG1vZGlmaWVkLCBnZW5lcmF0aW9uKSA9PiB7XG5cdFx0XHRcdHJlbmRlckNhbGxzKys7XG5cdFx0XHRcdGlmIChyZW5kZXJDYWxscyA9PT0gMSkge1xuXHRcdFx0XHRcdGF3YWl0IHN0YWxlR2F0ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVuZGVyRGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGdlbmVyYXRpb24pO1xuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3Qgc2hvd25BID0gcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2VBLFxuXHRcdFx0XHRvcmlnaW5hbDogb3JpZ2luYWxBLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXG5cdFx0XHRjb25zdCBzaG93bkIgPSBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZUIsXG5cdFx0XHRcdG9yaWdpbmFsOiBvcmlnaW5hbEIsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdGl0bGUnKT8udGV4dENvbnRlbnQsICdzdGFsZS1wYW5lbC1iLnRzJyk7XG5cblx0XHRcdHJlbGVhc2VTdGFsZSEoKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdGl0bGUnKT8udGV4dENvbnRlbnQsICdzdGFsZS1wYW5lbC1iLnRzJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2hvd25BLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2hvd25CLCB0cnVlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zm9yIChjb25zdCBtb2RlbCBvZiB0ZXh0RmlsZVNlcnZpY2U/LmZpbGVzLm1vZGVscyA/PyBbXSkge1xuXHRcdFx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0XHR2aWV3Py5kaXNwb3NlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3Rpb24gY2hhbmdlIGR1cmluZyByZW5kZXJSZWYga2VlcHMgd3JpdGUgY2hyb21lIGhpZGRlbiB1bnRpbCBjb21wYXJpc29uIGxvYWRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvcmVuZGVyLXBlbmRpbmctd3JpdGUudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlbmRlci1wZW5kaW5nLXdyaXRlLnRzLmdpdCcpO1xuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgcmVsZWFzZUxvYWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGxvYWRHYXRlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHJlbGVhc2VMb2FkID0gcmVzb2x2ZTtcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3Qgb25EaWRDaGFuZ2VDb25uZWN0aW9uID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24gPSB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogb25EaWRDaGFuZ2VDb25uZWN0aW9uLmV2ZW50LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbjtcblxuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7IHJlc291cmNlLCBjb25uZWN0aW9uIH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0Y29uc3QgcmVuZGVySG9zdCA9IHZpZXcgYXMgdW5rbm93biBhcyB7XG5cdFx0XHRcdHJlbmRlckRpZmY6IChvcmlnaW5hbDogVVJJLCBtb2RpZmllZDogVVJJLCBnZW5lcmF0aW9uOiBudW1iZXIpID0+IFByb21pc2U8Ym9vbGVhbj47XG5cdFx0XHR9O1xuXHRcdFx0cmVuZGVySG9zdC5yZW5kZXJEaWZmID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCBsb2FkR2F0ZTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBzaG93biA9IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblxuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uLmZpcmUoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXG5cdFx0XHRyZWxlYXNlTG9hZCEoKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2hvd24sIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbi5kaXNwb3NlKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdDb252ZXJzYXRpb24gRGlmZiBsb2FkIGZhaWwgaGlkZXMgd3JpdGUgY2hyb21lIGFuZCBvbmx5IGtlZXBzIGxvYWRGYWlsZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hLnRzLmdpdCcpO1xuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHsgdGhyb3dPbkxvYWQ6IHRydWUsIHJlc291cmNlIH0pO1xuXHRcdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblxuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1zdGFnZScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LWFjY2VwdCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXVuc3RhZ2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8udGV4dENvbnRlbnQgPz8gJycsXG5cdFx0XHRcdGxvY2FsaXplKCdjb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZS5sb2FkRmFpbGVkJywgXCJVbmFibGUgdG8gbG9hZCB0aGlzIGNvbXBhcmlzb24uXCIpLFxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5vayhwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8uY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1lcnJvcicpKTtcblx0XHRcdGFzc2VydC5vayghKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW5vdGljZScpPy50ZXh0Q29udGVudCA/PyAnJykuaW5jbHVkZXMoJ05ldyBmaWxlJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy10b29sYmFyJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgocGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctb3Blbi1wcmV2aWV3JykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0NvbnZlcnNhdGlvbiBydW5HaXRBY3Rpb24gc3VjY2VzcyBjbGVhcnMgbm90aWNlIGFuZCBmYWlsdXJlIGtlZXBzIGl0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYS50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYS50cy5naXQnKTtcblx0XHRsZXQgc2hvdWxkRmFpbCA9IGZhbHNlO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGlmIChzaG91bGRGYWlsKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cblx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJykpO1xuXHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRjb25zdCBydW5uZXIgPSBwYW5lIGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9O1xuXHRcdGF3YWl0IHJ1bm5lci5ydW5HaXRBY3Rpb24oJ2dpdC5zdGFnZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgocGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctbm90aWNlJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblxuXHRcdHNob3VsZEZhaWwgPSB0cnVlO1xuXHRcdGF3YWl0IHJ1bm5lci5ydW5HaXRBY3Rpb24oJ2dpdC5zdGFnZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8udGV4dENvbnRlbnQgPz8gJycsICdib29tJyk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBmb3JjZUNsaWNrKGJ1dHRvbjogSFRNTEVsZW1lbnQgfCBudWxsKTogdm9pZCB7XG5cdFx0aWYgKCFidXR0b24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHRidXR0b24ucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuXHRcdGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnKTtcblx0XHRpZiAoJ2Rpc2FibGVkJyBpbiBidXR0b24pIHtcblx0XHRcdChidXR0b24gYXMgSFRNTEJ1dHRvbkVsZW1lbnQpLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0fVxuXHRcdGJ1dHRvbi5jbGljaygpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tOiBFcnJvciwgcnVuOiAoKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIEEgbG9uZSBgLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKWAgc3RpbGwgbGVha3Mgd2hlbiB0aGUgaGFuZGxlciB3YXJuLXRoZW4tcmV0aHJvd3MuXG5cdFx0Y29uc3QgdW5leHBlY3RlZFdhcm5zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCB1bmhhbmRsZWRSZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZFJlamVjdGlvbiA9IChyZWFzb246IHVua25vd24pID0+IHVuaGFuZGxlZFJlamVjdGlvbnMucHVzaChyZWFzb24pO1xuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkUmVqZWN0aW9uKTtcblx0XHRjb25zdCBvcmlnaW5hbEVycm9ySGFuZGxlciA9IGVycm9ySGFuZGxlci5nZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCk7XG5cdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihlcnJvciA9PiB7XG5cdFx0XHR1bmV4cGVjdGVkV2FybnMucHVzaChlcnJvcik7XG5cdFx0XHRpZiAodW5leHBlY3RlZFdhcm5zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgcnVuKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IHVuaGFuZGxlZFJlamVjdGlvbnMsIHVuZXhwZWN0ZWRXYXJucyB9LCB7XG5cdFx0XHRcdHVuaGFuZGxlZFJlamVjdGlvbnM6IFtdLFxuXHRcdFx0XHR1bmV4cGVjdGVkV2FybnM6IFtwYWludEJvb20sIHBhaW50Qm9vbV0sXG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihvcmlnaW5hbEVycm9ySGFuZGxlcik7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWRSZWplY3Rpb24pO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFxuXHRcdGFwcGx5Q2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W10sXG5cdFx0c3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdLFxuXHRcdHBhaXJpbmdQZW5kaW5nID0gdHJ1ZSxcblx0KTogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIHtcblx0XHRjb25zdCBhY2NlcHRlZFdyaXRlOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCA9IHtcblx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRzdWNjZXNzOiB0cnVlLFxuXHRcdFx0ZXJyb3JNZXNzYWdlOiAnJyxcblx0XHRcdGV4aXRDb2RlOiAwLFxuXHRcdFx0c3Rkb3V0OiAnJyxcblx0XHR9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcgYXMgY29uc3QgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0d3JpdGVHaXRBcHBseUh1bmtzOiBhc3luYyAocmVxdWVzdDogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QpID0+IHtcblx0XHRcdFx0YXBwbHlDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRyZXR1cm4gYWNjZXB0ZWRXcml0ZTtcblx0XHRcdH0sXG5cdFx0XHR3cml0ZUdpdFN0YWdlUGF0aHM6IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdCkgPT4ge1xuXHRcdFx0XHRzdGFnZUNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHJldHVybiBhY2NlcHRlZFdyaXRlO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHR9XG5cblx0Y29uc3QgY2FycmllZFVuaWZpZWREaWZmID0gJ0BAIC0xICsxIEBAXFxuLW9sZFxcbituZXdcXG4nO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcGFpcmluZy1ob2xkIEFjY2VwdCBjaHJvbWUgc3RheXMgaGlkZGVuIGFuZCAwIHVuYXJ5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvbGVmdG92ZXIudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGFwcGx5Q2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gbGVmdG92ZXJMb29rc0xpdmVBcHBseUNvbm5lY3Rpb24oYXBwbHlDYWxscyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGNvbm5lY3Rpb24pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FuU2VuZFNvdXJjZXNHaXRBcHBseUh1bmtzKHRydWUsIHRydWUsIGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbikpLCBmYWxzZSk7XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdH0pKTtcblx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHR9KTtcblx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRjb25zdCBwYW5lbEFjY2VwdCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLWFjY2VwdCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxBY2NlcHQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0Zm9yY2VDbGljayhwYW5lbEFjY2VwdCk7XG5cdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblxuXHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnKSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmUpO1xuXG5cdFx0Y29uc3QgcmV2aWV3QWNjZXB0ID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctYWNjZXB0JykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdBY2NlcHQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0Zm9yY2VDbGljayhyZXZpZXdBY2NlcHQpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQ6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuQWNjZXB0KCk7XG5cdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhcHBseUNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcGFpcmluZy1ob2xkIFN0YWdlIGNocm9tZSBzdGF5cyBoaWRkZW4gYW5kIDAgdW5hcnkgLyAwIGdpdC5zdGFnZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLXN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9sZWZ0b3Zlci1zdGFnZS50cy5naXQnKTtcblx0XHRjb25zdCBhcHBseUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdFN0YWdlQ29tbWFuZHM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihhcHBseUNhbGxzLCBzdGFnZUNhbGxzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5TZW5kU291cmNlc0dpdFN0YWdlUGF0aHModHJ1ZSwgdHJ1ZSwgJ3Nlc3Npb24tMScsIGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbikpLCBmYWxzZSk7XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2dpdC5zdGFnZScpIHtcblx0XHRcdFx0XHRnaXRTdGFnZUNvbW1hbmRzLnB1c2goY29tbWFuZElkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHR9KSk7XG5cdFx0dmlldy5yZW5kZXIoKTtcblx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRvcmlnaW5hbCxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0fSk7XG5cdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cblx0XHRjb25zdCBwYW5lbFN0YWdlID0gdmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0Zm9yY2VDbGljayhwYW5lbFN0YWdlKTtcblx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuU3RhZ2U6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuU3RhZ2UoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YWdlQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdFN0YWdlQ29tbWFuZHMsIFtdKTtcblxuXHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnKSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblxuXHRcdGNvbnN0IHJldmlld1N0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGZvcmNlQ2xpY2socmV2aWV3U3RhZ2UpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxscywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0U3RhZ2VDb21tYW5kcywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXBwbHlDYWxscywgW10pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBsZWZ0b3ZlckNvbm5lY3RlZENvbm5lY3Rpb24oXG5cdFx0cGFpcmluZ1BlbmRpbmc6IGJvb2xlYW4sXG5cdCk6IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiB7XG5cdFx0cmV0dXJuIGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBbXSwgcGFpcmluZ1BlbmRpbmcpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXc6IFNvdXJjZXNEaWZmUGFuZWxWaWV3KTogdm9pZCB7XG5cdFx0Y29uc3QgaG9zdCA9IHZpZXcgYXMgdW5rbm93biBhcyB7IGNvbXBhcmlzb25Mb2FkRmFpbGVkOiBib29sZWFuOyB1cGRhdGVXcml0ZUFjdGlvbnM6ICgpID0+IHZvaWQgfTtcblx0XHRob3N0LmNvbXBhcmlzb25Mb2FkRmFpbGVkID0gZmFsc2U7XG5cdFx0aG9zdC51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0fVxuXG5cdHRlc3QoJ0RpZmYgcGFuZWwga2VlcHMgc3RvcmVkIGluZGV4IHdoZW4gbGl2ZSBTQ00gaXMgb25seSB3b3JraW5nVHJlZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1zdGFsZS1yZWYtaW5kZXgudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1zdGFsZS1yZWYtaW5kZXgudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgc3RvcmUpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBjcmVhdGVWaWV3RGVzY3JpcHRvclNlcnZpY2VTdHViKCkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIGNvbm5lY3Rpb24pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZSwge1xuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzaW9uLTEnLFxuXHRcdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlU2Vzc2lvbjogRXZlbnQuTm9uZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU0NNU2VydmljZSwgY3JlYXRlTGl2ZVNjbVNlcnZpY2UocmVzb3VyY2UsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdHN0dWJTZXNzaW9uQW5kQ2hhbmdlc01vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb25uZWN0aW9uLCB0cnVlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbW1hbmRTZXJ2aWNlLCB7XG5cdFx0XHRcdG9uV2lsbEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0TW9kZWxTZXJ2aWNlLCB7XG5cdFx0XHRcdGNyZWF0ZU1vZGVsUmVmZXJlbmNlOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgY29udGV4dCA9ICh2aWV3IGFzIHVua25vd24gYXMgeyBnZXRXcml0ZUNvbnRleHQ6ICgpID0+IHsgZ3JvdXBJZDogc3RyaW5nIH0gfCB1bmRlZmluZWQgfSkuZ2V0V3JpdGVDb250ZXh0KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dD8uZ3JvdXBJZCwgJ2luZGV4Jyk7XG5cdFx0XHRjb25zdCBwYW5lbFN0YWdlID0gdmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblxuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0RpZmYgcGFuZWwgZG9lcyBub3QgcmVjb3JkIGVuZ2luZSBzdGFnZSBoaWRlIG1hc2sgd2hlbiByZWYgYW5kIGxpdmUgU0NNIGFyZSBpbmRleCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1pbmRleC1vbmx5LnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9lbmdpbmUtc3RhZ2UtaW5kZXgtb25seS50cy5naXQnKTtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICdpbmRleCcsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0Y29uc3QgaG9zdCA9IHZpZXcgYXMgdW5rbm93biBhcyB7IHdyaXRlQ29sbGFwc2U6IHsgbW9kaWZpZWQ6IHN0cmluZzsga2luZDogc3RyaW5nIH0gfCB1bmRlZmluZWQgfTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LndyaXRlQ29sbGFwc2UsIHVuZGVmaW5lZCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdEaWZmIHBhbmVsIGhpZGVzIFN0YWdlIGFmdGVyIGVuZ2luZSBXcml0ZUdpdFN0YWdlUGF0aHMgYWNjZXB0ZWQgdW50aWwgcmVmIGNoYW5nZXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9lbmdpbmUtc3RhZ2UtYWNjZXB0ZWQudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1hY2NlcHRlZC50cy5naXQnKTtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRcdGNvbnN0IHBhbmVsU3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cblx0XHRcdGNvbnN0IG90aGVyID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZW5naW5lLXN0YWdlLW90aGVyLnRzJyk7XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiBvdGhlcixcblx0XHRcdFx0b3JpZ2luYWw6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1vdGhlci50cy5naXQnKSxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZT8uc3R5bGUuZGlzcGxheSwgJycpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRGlmZiBwYW5lbCBoaWRlcyBSZXZlcnQgYWZ0ZXIgZ2l0LmNsZWFuIHN1Y2NlZWRzIHVudGlsIHJlZiBjaGFuZ2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LWNsZWFuLXJldmVydC1oaWRlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtY2xlYW4tcmV2ZXJ0LWhpZGUudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgZ3JvdXAgPSB7XG5cdFx0XHRpZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdGxhYmVsOiAnQ2hhbmdlcycsXG5cdFx0XHRyZXNvdXJjZXM6IFtdIGFzIElTQ01SZXNvdXJjZVtdLFxuXHRcdH07XG5cdFx0Y29uc3QgY2FjaGVkU2NtUmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogZ3JvdXAsXG5cdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRvcGVuOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblx0XHRncm91cC5yZXNvdXJjZXMucHVzaChjYWNoZWRTY21SZXNvdXJjZSk7XG5cdFx0Y29uc3Qgc2NtU2VydmljZSA9IHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdHByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0XHRncm91cHM6IFtncm91cF0sXG5cdFx0XHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cblx0XHRjb25zdCBjbGVhbkNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LmNsZWFuJywgKCkgPT4ge1xuXHRcdFx0Z3JvdXAucmVzb3VyY2VzLmxlbmd0aCA9IDA7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZGlzY29ubmVjdGVkQ29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHt9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uOiBkaXNjb25uZWN0ZWRDb25uZWN0aW9uLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBzY21TZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IGNhY2hlZFNjbVJlc291cmNlLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxSZXZlcnQgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1yZXZlcnQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblxuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LmNsZWFuJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFJldmVydD8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblxuXHRcdFx0Y29uc3Qgb3RoZXIgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtY2xlYW4tcmV2ZXJ0LW90aGVyLnRzJyk7XG5cdFx0XHRjb25zdCBvdGhlck9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LWNsZWFuLXJldmVydC1vdGhlci50cy5naXQnKTtcblx0XHRcdGNvbnN0IG90aGVyU2NtUmVzb3VyY2UgPSB7XG5cdFx0XHRcdHNvdXJjZVVyaTogb3RoZXIsXG5cdFx0XHRcdHJlc291cmNlR3JvdXA6IGdyb3VwLFxuXHRcdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJU0NNUmVzb3VyY2U7XG5cdFx0XHRncm91cC5yZXNvdXJjZXMucHVzaChvdGhlclNjbVJlc291cmNlKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IG90aGVyLFxuXHRcdFx0XHRvcmlnaW5hbDogb3RoZXJPcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IG90aGVyU2NtUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsUmV2ZXJ0Py5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGNsZWFuQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdDb252ZXJzYXRpb24gaGlkZXMgUmV2ZXJ0IGFmdGVyIGdpdC5jbGVhbiBzdWNjZWVkcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2NvbnZlcnNhdGlvbi1yZXZlcnQtaGlkZS50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvY29udmVyc2F0aW9uLXJldmVydC1oaWRlLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGNsZWFuQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuY2xlYW4nLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld1JldmVydCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC5jbGVhbicpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV2aWV3UmV2ZXJ0Py5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRjbGVhbkNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRGlmZiBwYW5lbCBoaWRlcyBVbnN0YWdlIGFmdGVyIGdpdC51bnN0YWdlIHN1Y2NlZWRzIHVudGlsIHJlZiBjaGFuZ2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LXVuc3RhZ2UtaGlkZS50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LXVuc3RhZ2UtaGlkZS50cy5naXQnKTtcblx0XHRjb25zdCBncm91cCA9IHtcblx0XHRcdGlkOiAnaW5kZXgnLFxuXHRcdFx0bGFiZWw6ICdTdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRyZXNvdXJjZXM6IFtdIGFzIElTQ01SZXNvdXJjZVtdLFxuXHRcdH07XG5cdFx0Y29uc3QgY2FjaGVkU2NtUmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogZ3JvdXAsXG5cdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRvcGVuOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblx0XHRncm91cC5yZXNvdXJjZXMucHVzaChjYWNoZWRTY21SZXNvdXJjZSk7XG5cdFx0Y29uc3Qgc2NtU2VydmljZSA9IHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdHByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0XHRncm91cHM6IFtncm91cF0sXG5cdFx0XHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cblx0XHRjb25zdCB1bnN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQudW5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0Y29uc3QgZGlzY29ubmVjdGVkQ29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHt9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRjb25uZWN0aW9uOiBkaXNjb25uZWN0ZWRDb25uZWN0aW9uLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBzY21TZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IGNhY2hlZFNjbVJlc291cmNlLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxVbnN0YWdlID0gdmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdW5zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblxuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LnVuc3RhZ2UnKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsVW5zdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblxuXHRcdFx0Y29uc3Qgb3RoZXIgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtdW5zdGFnZS1vdGhlci50cycpO1xuXHRcdFx0Y29uc3Qgb3RoZXJPcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2dpdC11bnN0YWdlLW90aGVyLnRzLmdpdCcpO1xuXHRcdFx0Y29uc3Qgb3RoZXJTY21SZXNvdXJjZSA9IHtcblx0XHRcdFx0c291cmNlVXJpOiBvdGhlcixcblx0XHRcdFx0cmVzb3VyY2VHcm91cDogZ3JvdXAsXG5cdFx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdFx0b3BlbjogYXN5bmMgKCkgPT4geyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblx0XHRcdGdyb3VwLnJlc291cmNlcy5wdXNoKG90aGVyU2NtUmVzb3VyY2UpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogb3RoZXIsXG5cdFx0XHRcdG9yaWdpbmFsOiBvdGhlck9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRzY21SZXNvdXJjZTogb3RoZXJTY21SZXNvdXJjZSxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHVuc3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0RpZmYgcGFuZWwga2VlcHMgY2FjaGVkIGluZGV4IGdyb3VwIHdoZW4gdGhhdCBVUkkgbm93IGxpdmVzIG9ubHkgaW4gd29ya2luZ1RyZWUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9saXZlLXNjbS1hZnRlci11bnN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9saXZlLXNjbS1hZnRlci11bnN0YWdlLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGluZGV4R3JvdXAgPSB7XG5cdFx0XHRpZDogJ2luZGV4Jyxcblx0XHRcdGxhYmVsOiAnU3RhZ2VkIENoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGNhY2hlZFNjbVJlc291cmNlID0ge1xuXHRcdFx0c291cmNlVXJpOiByZXNvdXJjZSxcblx0XHRcdHJlc291cmNlR3JvdXA6IGluZGV4R3JvdXAsXG5cdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRvcGVuOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblx0XHRjb25zdCB3b3JraW5nVHJlZUdyb3VwID0ge1xuXHRcdFx0aWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRsYWJlbDogJ0NoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGxpdmVTY21SZXNvdXJjZSA9IHtcblx0XHRcdHNvdXJjZVVyaTogcmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZUdyb3VwOiB3b3JraW5nVHJlZUdyb3VwLFxuXHRcdFx0ZGVjb3JhdGlvbnM6IHt9LFxuXHRcdFx0b3BlbjogYXN5bmMgKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU0NNUmVzb3VyY2U7XG5cdFx0d29ya2luZ1RyZWVHcm91cC5yZXNvdXJjZXMucHVzaChsaXZlU2NtUmVzb3VyY2UpO1xuXHRcdGNvbnN0IHNjbVNlcnZpY2UgPSB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXQgcmVwb3NpdG9yaWVzKCkge1xuXHRcdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0XHRwcm92aWRlcjoge1xuXHRcdFx0XHRcdFx0Z3JvdXBzOiBbaW5kZXhHcm91cCwgd29ya2luZ1RyZWVHcm91cF0sXG5cdFx0XHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cblx0XHRjb25zdCBzdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHRjb25zdCBkaXNjb25uZWN0ZWRDb25uZWN0aW9uID0ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoe30pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb246IGRpc2Nvbm5lY3RlZENvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNDTVNlcnZpY2UsIHNjbVNlcnZpY2UpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRzY21SZXNvdXJjZTogY2FjaGVkU2NtUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBjb250ZXh0ID0gKHZpZXcgYXMgdW5rbm93biBhcyB7IGdldFdyaXRlQ29udGV4dDogKCkgPT4geyBncm91cElkOiBzdHJpbmc7IHNjbVJlc291cmNlPzogSVNDTVJlc291cmNlIH0gfCB1bmRlZmluZWQgfSkuZ2V0V3JpdGVDb250ZXh0KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dD8uZ3JvdXBJZCwgJ2luZGV4Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dD8uc2NtUmVzb3VyY2UsIGNhY2hlZFNjbVJlc291cmNlKTtcblxuXHRcdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0Y29uc3QgcGFuZWxVbnN0YWdlID0gdmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdW5zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsVW5zdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0RpZmYgcGFuZWwgd3JpdGUgY2hyb21lIGZhbGxzIGJhY2sgdG8gcmVmIHNjbVJlc291cmNlIHdoZW4gVVJJIGlzIGFic2VudCBmcm9tIFNDTScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlZi1zY20tZmFsbGJhY2sudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlZi1zY20tZmFsbGJhY2sudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgaW5kZXhHcm91cCA9IHtcblx0XHRcdGlkOiAnaW5kZXgnLFxuXHRcdFx0bGFiZWw6ICdTdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRyZXNvdXJjZXM6IFtdIGFzIElTQ01SZXNvdXJjZVtdLFxuXHRcdH07XG5cdFx0Y29uc3QgY2FjaGVkU2NtUmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogaW5kZXhHcm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGNvbnN0IHNjbVNlcnZpY2UgPSB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXQgcmVwb3NpdG9yaWVzKCkge1xuXHRcdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0XHRwcm92aWRlcjoge1xuXHRcdFx0XHRcdFx0Z3JvdXBzOiBbaW5kZXhHcm91cF0sXG5cdFx0XHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cblx0XHRjb25zdCB1bnN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQudW5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0Y29uc3QgZGlzY29ubmVjdGVkQ29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHt9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRjb25uZWN0aW9uOiBkaXNjb25uZWN0ZWRDb25uZWN0aW9uLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBzY21TZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IGNhY2hlZFNjbVJlc291cmNlLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgY29udGV4dCA9ICh2aWV3IGFzIHVua25vd24gYXMgeyBnZXRXcml0ZUNvbnRleHQ6ICgpID0+IHsgZ3JvdXBJZDogc3RyaW5nIH0gfCB1bmRlZmluZWQgfSkuZ2V0V3JpdGVDb250ZXh0KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dD8uZ3JvdXBJZCwgJ2luZGV4Jyk7XG5cblx0XHRcdGNvbnN0IHBhbmVsU3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHBhbmVsVW5zdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dW5zdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnb3BlbmVkIHdvcmtpbmdUcmVlIHNob3dzIFJldmVydCBhbmQgZW5naW5lIEZpbGVEaWZmIHdpdGhvdXQgc2NtUmVzb3VyY2UgZG9lcyBub3QgdGFrZSBpbmRleCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2JvdGgtZ3JvdXBzLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9ib3RoLWdyb3Vwcy50cy5naXQnKTtcblx0XHRjb25zdCBpbmRleEdyb3VwID0ge1xuXHRcdFx0aWQ6ICdpbmRleCcsXG5cdFx0XHRsYWJlbDogJ1N0YWdlZCBDaGFuZ2VzJyxcblx0XHRcdHJlc291cmNlczogW10gYXMgSVNDTVJlc291cmNlW10sXG5cdFx0fTtcblx0XHRjb25zdCB3b3JraW5nVHJlZUdyb3VwID0ge1xuXHRcdFx0aWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRsYWJlbDogJ0NoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGluZGV4UmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogaW5kZXhHcm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGNvbnN0IHdvcmtpbmdUcmVlUmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogd29ya2luZ1RyZWVHcm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGluZGV4R3JvdXAucmVzb3VyY2VzLnB1c2goaW5kZXhSZXNvdXJjZSk7XG5cdFx0d29ya2luZ1RyZWVHcm91cC5yZXNvdXJjZXMucHVzaCh3b3JraW5nVHJlZVJlc291cmNlKTtcblx0XHRjb25zdCBzY21TZXJ2aWNlID0ge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IHJlcG9zaXRvcmllcygpIHtcblx0XHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdFx0cHJvdmlkZXI6IHtcblx0XHRcdFx0XHRcdGdyb3VwczogW2luZGV4R3JvdXAsIHdvcmtpbmdUcmVlR3JvdXBdLFxuXHRcdFx0XHRcdFx0cm9vdFVyaTogcmVzb3VyY2UsXG5cdFx0XHRcdFx0XHRvbkRpZENoYW5nZVJlc291cmNlczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fV07XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHJlcG9zaXRvcnlDb3VudCgpIHsgcmV0dXJuIDE7IH0sXG5cdFx0XHRvbkRpZEFkZFJlcG9zaXRvcnk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZFJlbW92ZVJlcG9zaXRvcnk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRyZWdpc3RlclNDTVByb3ZpZGVyOiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH0sXG5cdFx0XHRnZXRSZXBvc2l0b3J5OiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01TZXJ2aWNlO1xuXHRcdGNvbnN0IGNsZWFuQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuY2xlYW4nLCAoKSA9PiB7IH0pO1xuXHRcdGNvbnN0IHVuc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC51bnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHRjb25zdCBkaXNjb25uZWN0ZWRDb25uZWN0aW9uID0ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoe30pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb246IGRpc2Nvbm5lY3RlZENvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNDTVNlcnZpY2UsIHNjbVNlcnZpY2UpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IHdvcmtpbmdUcmVlUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbENvbnRleHQgPSAodmlldyBhcyB1bmtub3duIGFzIHsgZ2V0V3JpdGVDb250ZXh0OiAoKSA9PiB7IGdyb3VwSWQ6IHN0cmluZzsgc2NtUmVzb3VyY2U/OiBJU0NNUmVzb3VyY2U7IHBhdGg6IHN0cmluZyB9IHwgdW5kZWZpbmVkIH0pLmdldFdyaXRlQ29udGV4dCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsQ29udGV4dD8uZ3JvdXBJZCwgJ3dvcmtpbmdUcmVlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxDb250ZXh0Py5zY21SZXNvdXJjZSwgd29ya2luZ1RyZWVSZXNvdXJjZSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocGFuZWxDb250ZXh0Py5zY21SZXNvdXJjZSwgaW5kZXhSZXNvdXJjZSk7XG5cdFx0XHRjb25zdCBwYW5lbFJldmVydCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHBhbmVsVW5zdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cblx0XHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJykpO1xuXHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblx0XHRcdGNvbnN0IGZhY3RzID0gKHBhbmUgYXMgdW5rbm93biBhcyB7IGN1cnJlbnRXcml0ZUZhY3RzOiAoKSA9PiB7IGdyb3VwSWQ6IHN0cmluZzsgc2NtUmVzb3VyY2U/OiBJU0NNUmVzb3VyY2U7IHBhdGg6IHN0cmluZyB9IHwgdW5kZWZpbmVkIH0pLmN1cnJlbnRXcml0ZUZhY3RzKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmFjdHM/Lmdyb3VwSWQsICd3b3JraW5nVHJlZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZhY3RzPy5zY21SZXNvdXJjZSwgd29ya2luZ1RyZWVSZXNvdXJjZSk7XG5cdFx0XHRjb25zdCByZXZpZXdSZXZlcnQgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1yZXZlcnQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRjb25zdCByZXZpZXdVbnN0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctdW5zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0Y29uc3QgbW92ZWQgPSByZXNvbHZlU291cmNlc0NoYW5nZVJlZkZyb21FZGl0b3IoaW5wdXQsIHNjbVNlcnZpY2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vdmVkPy5ncm91cElkLCAnd29ya2luZ1RyZWUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb3ZlZD8uc2NtUmVzb3VyY2UsIHdvcmtpbmdUcmVlUmVzb3VyY2UpO1xuXG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRcdGdpdFBhdGg6ICdzcmMvYm90aC1ncm91cHMudHMnLFxuXHRcdFx0XHRpbmRleFN0YXRlOiAnV09SS1RSRUUnLFxuXHRcdFx0XHRraW5kOiAnTU9ESUZJRUQnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblx0XHRcdGNvbnN0IGVuZ2luZUNvbnRleHQgPSAodmlldyBhcyB1bmtub3duIGFzIHsgZ2V0V3JpdGVDb250ZXh0OiAoKSA9PiB7IGdyb3VwSWQ6IHN0cmluZzsgc2NtUmVzb3VyY2U/OiBJU0NNUmVzb3VyY2U7IHBhdGg6IHN0cmluZyB9IHwgdW5kZWZpbmVkIH0pLmdldFdyaXRlQ29udGV4dCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUNvbnRleHQ/Lmdyb3VwSWQsICd3b3JraW5nVHJlZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUNvbnRleHQ/LnNjbVJlc291cmNlLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUNvbnRleHQ/LnBhdGgsICdzcmMvYm90aC1ncm91cHMudHMnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFJldmVydD8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cblx0XHRcdGNvbnN0IGVuZ2luZUlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnLCB7XG5cdFx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRcdGdpdFBhdGg6ICdzcmMvYm90aC1ncm91cHMudHMnLFxuXHRcdFx0XHRpbmRleFN0YXRlOiAnV09SS1RSRUUnLFxuXHRcdFx0XHRraW5kOiAnTU9ESUZJRUQnLFxuXHRcdFx0fSkpO1xuXHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChlbmdpbmVJbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblx0XHRcdGNvbnN0IGVuZ2luZUZhY3RzID0gKHBhbmUgYXMgdW5rbm93biBhcyB7IGN1cnJlbnRXcml0ZUZhY3RzOiAoKSA9PiB7IGdyb3VwSWQ6IHN0cmluZzsgc2NtUmVzb3VyY2U/OiBJU0NNUmVzb3VyY2U7IHBhdGg6IHN0cmluZyB9IHwgdW5kZWZpbmVkIH0pLmN1cnJlbnRXcml0ZUZhY3RzKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5naW5lRmFjdHM/Lmdyb3VwSWQsICd3b3JraW5nVHJlZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUZhY3RzPy5zY21SZXNvdXJjZSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbmdpbmVGYWN0cz8ucGF0aCwgJ3NyYy9ib3RoLWdyb3Vwcy50cycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1JldmVydD8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0Y29uc3QgZW5naW5lTW92ZWQgPSByZXNvbHZlU291cmNlc0NoYW5nZVJlZkZyb21FZGl0b3IoZW5naW5lSW5wdXQsIHNjbVNlcnZpY2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZU1vdmVkPy5ncm91cElkLCAnd29ya2luZ1RyZWUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbmdpbmVNb3ZlZD8uc2NtUmVzb3VyY2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5naW5lTW92ZWQ/LmdpdFBhdGgsICdzcmMvYm90aC1ncm91cHMudHMnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Y2xlYW5Db21tYW5kLmRpc3Bvc2UoKTtcblx0XHRcdHVuc3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0RpZmYgcGFuZWwga2VlcHMgVW5zdGFnZSB2aXNpYmxlIHdoZW4gZ2l0LnVuc3RhZ2UgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtdW5zdGFnZS1mYWlsLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtdW5zdGFnZS1mYWlsLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGNhY2hlZFNjbVJlc291cmNlID0ge1xuXHRcdFx0c291cmNlVXJpOiByZXNvdXJjZSxcblx0XHRcdHJlc291cmNlR3JvdXA6IHsgaWQ6ICdpbmRleCcsIGxhYmVsOiAnU3RhZ2VkIENoYW5nZXMnLCByZXNvdXJjZXM6IFtdIGFzIElTQ01SZXNvdXJjZVtdIH0sXG5cdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRvcGVuOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblxuXHRcdGNvbnN0IHVuc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC51bnN0YWdlJywgKCkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCd1bnN0YWdlIGZhaWxlZCcpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGRpc2Nvbm5lY3RlZENvbm5lY3Rpb24gPSB7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7fSksXG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbjtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0Y29ubmVjdGlvbjogZGlzY29ubmVjdGVkQ29ubmVjdGlvbixcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24sIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0XHRcdGlmIChjb21tYW5kSWQgPT09ICdnaXQudW5zdGFnZScpIHtcblx0XHRcdFx0XHRcdGF3YWl0IENvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZCgnZ2l0LnVuc3RhZ2UnKT8uaGFuZGxlciEodW5kZWZpbmVkIGFzIHVua25vd24gYXMgU2VydmljZXNBY2Nlc3NvciwgLi4uYXJncyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICdpbmRleCcsXG5cdFx0XHRcdHNjbVJlc291cmNlOiBjYWNoZWRTY21SZXNvdXJjZSxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRcdGNvbnN0IHBhbmVsVW5zdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC51bnN0YWdlJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dW5zdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRGlmZiBwYW5lbCBrZWVwcyBSZXZlcnQgdmlzaWJsZSB3aGVuIGdpdC5jbGVhbiBmYWlscycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2dpdC1jbGVhbi1yZXZlcnQtZmFpbC50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LWNsZWFuLXJldmVydC1mYWlsLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGdyb3VwID0ge1xuXHRcdFx0aWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRsYWJlbDogJ0NoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGNhY2hlZFNjbVJlc291cmNlID0ge1xuXHRcdFx0c291cmNlVXJpOiByZXNvdXJjZSxcblx0XHRcdHJlc291cmNlR3JvdXA6IGdyb3VwLFxuXHRcdFx0ZGVjb3JhdGlvbnM6IHt9LFxuXHRcdFx0b3BlbjogYXN5bmMgKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU0NNUmVzb3VyY2U7XG5cdFx0Z3JvdXAucmVzb3VyY2VzLnB1c2goY2FjaGVkU2NtUmVzb3VyY2UpO1xuXG5cdFx0Y29uc3QgY2xlYW5Db21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5jbGVhbicsICgpID0+IHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignY2xlYW4gZmFpbGVkJyk7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZGlzY29ubmVjdGVkQ29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHt9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uOiBkaXNjb25uZWN0ZWRDb25uZWN0aW9uLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKGNvbW1hbmRJZDogdW5rbm93biwgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2dpdC5jbGVhbicpIHtcblx0XHRcdFx0XHRcdGF3YWl0IENvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZCgnZ2l0LmNsZWFuJyk/LmhhbmRsZXIhKHVuZGVmaW5lZCBhcyB1bmtub3duIGFzIFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3MpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRzY21SZXNvdXJjZTogY2FjaGVkU2NtUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbFJldmVydCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFJldmVydD8uc3R5bGUuZGlzcGxheSwgJycpO1xuXG5cdFx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuR2l0QWN0aW9uOiAoY29tbWFuZElkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfSkucnVuR2l0QWN0aW9uKCdnaXQuY2xlYW4nKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsUmV2ZXJ0Py5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGNsZWFuQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdEaWZmIHBhbmVsIGtlZXBzIFN0YWdlIHZpc2libGUgd2hlbiBXcml0ZUdpdFN0YWdlUGF0aHMgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9lbmdpbmUtc3RhZ2UtZmFpbC50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZW5naW5lLXN0YWdlLWZhaWwudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IGZhaWxlZFdyaXRlOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCA9IHtcblx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdGVycm9yTWVzc2FnZTogJ3N0YWdlIGZhaWxlZCcsXG5cdFx0XHRleGl0Q29kZTogMSxcblx0XHRcdHN0ZG91dDogJycsXG5cdFx0fTtcblx0XHRjb25uZWN0aW9uLndyaXRlR2l0U3RhZ2VQYXRocyA9IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdCkgPT4ge1xuXHRcdFx0c3RhZ2VDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0cmV0dXJuIGZhaWxlZFdyaXRlO1xuXHRcdH07XG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRcdGNvbnN0IHBhbmVsU3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1JldmlldyBwYW5lIGhpZGVzIFN0YWdlIGFmdGVyIGVuZ2luZSBXcml0ZUdpdFN0YWdlUGF0aHMgYWNjZXB0ZWQgdW50aWwgbW9kaWZpZWQgY2hhbmdlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3Jldmlldy1lbmdpbmUtc3RhZ2UtYWNjZXB0ZWQudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3Jldmlldy1lbmdpbmUtc3RhZ2UtYWNjZXB0ZWQudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld1N0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRjb25zdCByZXZpZXdVbnN0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctdW5zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdTdGFnZT8uc3R5bGUuZGlzcGxheSwgJycpO1xuXG5cdFx0XHRhd2FpdCAocGFuZSBhcyB1bmtub3duIGFzIHsgcnVuU3RhZ2U6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuU3RhZ2UoKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5vayghcmV2aWV3VW5zdGFnZSB8fCByZXZpZXdVbnN0YWdlLnN0eWxlLmRpc3BsYXkgPT09ICdub25lJyk7XG5cblx0XHRcdGNvbnN0IG90aGVyUmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9yZXZpZXctZW5naW5lLXN0YWdlLW90aGVyLnRzJyk7XG5cdFx0XHRjb25zdCBvdGhlck9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvcmV2aWV3LWVuZ2luZS1zdGFnZS1vdGhlci50cy5naXQnKTtcblx0XHRcdGNvbnN0IG90aGVySW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChvdGhlclJlc291cmNlLCBvdGhlck9yaWdpbmFsLCAnd29ya2luZ1RyZWUnKSk7XG5cdFx0XHRhd2FpdCBwYW5lLnNldElucHV0KG90aGVySW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV2aWV3U3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1JldmlldyBwYW5lIGtlZXBzIFN0YWdlIHZpc2libGUgd2hlbiBXcml0ZUdpdFN0YWdlUGF0aHMgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9yZXZpZXctZW5naW5lLXN0YWdlLWZhaWwudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3Jldmlldy1lbmdpbmUtc3RhZ2UtZmFpbC50cy5naXQnKTtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3QgZmFpbGVkV3JpdGU6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFdyaXRlUmVzdWx0ID0ge1xuXHRcdFx0c3VwcG9ydGVkOiB0cnVlLFxuXHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0ZXJyb3JNZXNzYWdlOiAnc3RhZ2UgZmFpbGVkJyxcblx0XHRcdGV4aXRDb2RlOiAxLFxuXHRcdFx0c3Rkb3V0OiAnJyxcblx0XHR9O1xuXHRcdGNvbm5lY3Rpb24ud3JpdGVHaXRTdGFnZVBhdGhzID0gYXN5bmMgKHJlcXVlc3Q6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0KSA9PiB7XG5cdFx0XHRzdGFnZUNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRyZXR1cm4gZmFpbGVkV3JpdGU7XG5cdFx0fTtcblx0XHRjb25zdCBzdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblx0XHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnKSk7XG5cdFx0XHRhd2FpdCBwYW5lLnNldElucHV0KGlucHV0LCB1bmRlZmluZWQsIE9iamVjdC5jcmVhdGUobnVsbCksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmUpO1xuXG5cdFx0XHRjb25zdCByZXZpZXdTdGFnZSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRmdW5jdGlvbiBwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmU6IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lKTogdm9pZCB7XG5cdFx0Y29uc3QgaG9zdCA9IHBhbmUgYXMgdW5rbm93biBhcyB7IGNvbXBhcmlzb25Mb2FkRmFpbGVkOiBib29sZWFuOyB1cGRhdGVSZXZpZXdBY3Rpb25zOiAoKSA9PiB2b2lkIH07XG5cdFx0aG9zdC5jb21wYXJpc29uTG9hZEZhaWxlZCA9IGZhbHNlO1xuXHRcdGhvc3QudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3R1YkVuZ2luZUxpdmVDaGFuZ2VzTW9kZWwoXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlPixcblx0XHRzZXNzaW9uSWQgPSAnc2Vzc2lvbi0xJyxcblx0KTogdm9pZCB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0NoYW5nZXNNb2RlbCwge1xuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRnZXRTbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Z2VuZXJhdGlvbjogMSxcblx0XHRcdFx0c2V0dGxlZDogdHJ1ZSxcblx0XHRcdFx0c3RhdGU6IHsga2luZDogJ2VuZ2luZS1saXZlJywgc2Vzc2lvbklkIH0sXG5cdFx0XHRcdGVudHJpZXM6IFtdLFxuXHRcdFx0fSksXG5cdFx0XHRpc1dyaXRlQ2xvc2VkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGlzRmlsZURpZmZPcGVuU2tpcHBlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRyZWZyZXNoOiBhc3luYyAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRzY2hlZHVsZVJlZnJlc2g6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdGZsdXNoU2NoZWR1bGVkUmVmcmVzaDogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU291cmNlc0NoYW5nZXNNb2RlbCk7XG5cdH1cblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIHBhaXJpbmctaG9sZCBTdGFnZSB3aXRoIGxvY2FsIFNDTSBzdGF5cyBoaWRkZW4gYW5kIDAgZ2l0LnN0YWdlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvbGVmdG92ZXItc2NtLXN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9sZWZ0b3Zlci1zY20tc3RhZ2UudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IHN0YWdlQ2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBnaXRTdGFnZUNvbW1hbmRzOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gbGVmdG92ZXJMb29rc0xpdmVBcHBseUNvbm5lY3Rpb24oYXBwbHlDYWxscywgc3RhZ2VDYWxscyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSwgJ2xlZnRvdmVyLWxvb2tzLWxpdmUgZml4dHVyZSBtdXN0IGtlZXAgaXNFbmdpbmVDb25uZWN0ZWQoKT09PXRydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbiksIHRydWUpO1xuXG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2dpdC5zdGFnZScpIHtcblx0XHRcdFx0XHRcdGdpdFN0YWdlQ29tbWFuZHMucHVzaChjb21tYW5kSWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRmb3JjZUNsaWNrKHBhbmVsU3RhZ2UpO1xuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRTdGFnZUNvbW1hbmRzLCBbXSk7XG5cblx0XHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJykpO1xuXHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblxuXHRcdFx0Y29uc3QgcmV2aWV3U3RhZ2UgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGZvcmNlQ2xpY2socmV2aWV3U3RhZ2UpO1xuXHRcdFx0YXdhaXQgKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRTdGFnZUNvbW1hbmRzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcGFpcmluZy1ob2xkIFVuc3RhZ2UgLyBSZXZlcnQgY2hyb21lIHN0YXlzIGhpZGRlbiBhbmQgMCBnaXQudW5zdGFnZSAvIGdpdC5jbGVhbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLXVuc3RhZ2UudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLXVuc3RhZ2UudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgZ2l0TXV0YXRlQ29tbWFuZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyQ29ubmVjdGVkQ29ubmVjdGlvbih0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbiksIHRydWUpO1xuXG5cdFx0Y29uc3QgdW5zdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnVuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdGNvbnN0IGNsZWFuQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuY2xlYW4nLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKGNvbW1hbmRJZDogdW5rbm93bikgPT4ge1xuXHRcdFx0XHRcdGlmIChjb21tYW5kSWQgPT09ICdnaXQudW5zdGFnZScgfHwgY29tbWFuZElkID09PSAnZ2l0LmNsZWFuJykge1xuXHRcdFx0XHRcdFx0Z2l0TXV0YXRlQ29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbFJldmVydCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHBhbmVsVW5zdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0Zm9yY2VDbGljayhwYW5lbFJldmVydCk7XG5cdFx0XHRmb3JjZUNsaWNrKHBhbmVsVW5zdGFnZSk7XG5cdFx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuR2l0QWN0aW9uOiAoY29tbWFuZElkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfSkucnVuR2l0QWN0aW9uKCdnaXQuY2xlYW4nKTtcblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC51bnN0YWdlJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnaXRNdXRhdGVDb21tYW5kcy5sZW5ndGgsIDApO1xuXG5cdFx0XHRjb25zdCBpbmRleEluc3RhbnRpYXRpb24gPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0XHRpZiAoY29tbWFuZElkID09PSAnZ2l0LnVuc3RhZ2UnIHx8IGNvbW1hbmRJZCA9PT0gJ2dpdC5jbGVhbicpIHtcblx0XHRcdFx0XHRcdGdpdE11dGF0ZUNvbW1hbmRzLnB1c2goU3RyaW5nKGNvbW1hbmRJZCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aW5kZXhJbnN0YW50aWF0aW9uLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGluZGV4UGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluZGV4SW5zdGFudGlhdGlvbi5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5kZXhJbnN0YW50aWF0aW9uLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBpbmRleFBhbmVsU2VydmljZSk7XG5cdFx0XHRjb25zdCBpbmRleFZpZXcgPSBzdG9yZS5hZGQoaW5kZXhJbnN0YW50aWF0aW9uLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdGluZGV4Vmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IGluZGV4UGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZShpbmRleFZpZXcpO1xuXHRcdFx0Y29uc3QgaW5kZXhVbnN0YWdlID0gaW5kZXhWaWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC11bnN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluZGV4VW5zdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGZvcmNlQ2xpY2soaW5kZXhVbnN0YWdlKTtcblx0XHRcdGF3YWl0IChpbmRleFZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LnVuc3RhZ2UnKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRNdXRhdGVDb21tYW5kcywgW10pO1xuXG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld1JldmVydCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHJldmlld1Vuc3RhZ2UgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy11bnN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1JldmVydD8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0Zm9yY2VDbGljayhyZXZpZXdSZXZlcnQpO1xuXHRcdFx0Zm9yY2VDbGljayhyZXZpZXdVbnN0YWdlKTtcblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC5jbGVhbicpO1xuXHRcdFx0YXdhaXQgKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LnVuc3RhZ2UnKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRNdXRhdGVDb21tYW5kcywgW10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR1bnN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0XHRjbGVhbkNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgaGlkZXMgRGlmZiBTdGFnZSAvIFJldmVydCAvIFVuc3RhZ2UgY2hyb21lIGFuZCBzdGF5cyAwIHdyaXRlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLWtlZXAudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLWtlZXAudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IHN0YWdlQ2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBnaXRNdXRhdGVDb21tYW5kczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gbGVmdG92ZXJMb29rc0xpdmVBcHBseUNvbm5lY3Rpb24oYXBwbHlDYWxscywgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25uZWN0aW9uLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbiksIGZhbHNlKTtcblxuXHRcdGNvbnN0IHVuc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC51bnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHRjb25zdCBjbGVhbkNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LmNsZWFuJywgKCkgPT4geyB9KTtcblx0XHRjb25zdCBzdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBmYWxzZSxcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0XHRpZiAoY29tbWFuZElkID09PSAnZ2l0LnVuc3RhZ2UnIHx8IGNvbW1hbmRJZCA9PT0gJ2dpdC5jbGVhbicgfHwgY29tbWFuZElkID09PSAnZ2l0LnN0YWdlJykge1xuXHRcdFx0XHRcdFx0Z2l0TXV0YXRlQ29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci5nZXQoSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UpLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0Y29uc3QgcGFuZWxSZXZlcnQgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1yZXZlcnQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRjb25zdCBwYW5lbFVuc3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC11bnN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQub2soIXBhbmVsVW5zdGFnZSB8fCBwYW5lbFVuc3RhZ2Uuc3R5bGUuZGlzcGxheSA9PT0gJ25vbmUnKTtcblx0XHRcdGZvcmNlQ2xpY2socGFuZWxTdGFnZSk7XG5cdFx0XHRmb3JjZUNsaWNrKHBhbmVsUmV2ZXJ0KTtcblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LmNsZWFuJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXBwbHlDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdGFnZUNhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdE11dGF0ZUNvbW1hbmRzLCBbXSk7XG5cblx0XHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJykpO1xuXHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblxuXHRcdFx0Y29uc3QgcmV2aWV3U3RhZ2UgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHJldmlld1JldmVydCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRmb3JjZUNsaWNrKHJldmlld1N0YWdlKTtcblx0XHRcdGZvcmNlQ2xpY2socmV2aWV3UmV2ZXJ0KTtcblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LnVuc3RhZ2UnKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhcHBseUNhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YWdlQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0TXV0YXRlQ29tbWFuZHMsIFtdKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dW5zdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdFx0Y2xlYW5Db21tYW5kLmRpc3Bvc2UoKTtcblx0XHRcdHN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgbGVmdG92ZXIgd2l0aG91dCBwYWlyaW5nIFVuc3RhZ2UgLyBSZXZlcnQgc3RpbGwgcnVuIGdpdC51bnN0YWdlIC8gZ2l0LmNsZWFuJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvbGVmdG92ZXItbGl2ZS11bnN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9sZWZ0b3Zlci1saXZlLXVuc3RhZ2UudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgZ2l0TXV0YXRlQ29tbWFuZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyQ29ubmVjdGVkQ29ubmVjdGlvbihmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChjb25uZWN0aW9uKSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgdW5zdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnVuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdGNvbnN0IGNsZWFuQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuY2xlYW4nLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKGNvbW1hbmRJZDogdW5rbm93bikgPT4ge1xuXHRcdFx0XHRcdGlmIChjb21tYW5kSWQgPT09ICdnaXQudW5zdGFnZScgfHwgY29tbWFuZElkID09PSAnZ2l0LmNsZWFuJykge1xuXHRcdFx0XHRcdFx0Z2l0TXV0YXRlQ29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbFJldmVydCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFJldmVydD8uc3R5bGUuZGlzcGxheSwgJycpO1xuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LmNsZWFuJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0TXV0YXRlQ29tbWFuZHMsIFsnZ2l0LmNsZWFuJ10pO1xuXG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld1JldmVydCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC51bnN0YWdlJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0TXV0YXRlQ29tbWFuZHMsIFsnZ2l0LmNsZWFuJywgJ2dpdC51bnN0YWdlJ10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR1bnN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0XHRjbGVhbkNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVhZC1mYWlsZWQgc2VuZHMgMCBnaXQudW5zdGFnZSBmcm9tIGJvdGggZGlmZiBob3N0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlYWQtZmFpbGVkLXVuc3RhZ2UudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlYWQtZmFpbGVkLXVuc3RhZ2UudHMuZ2l0Jyk7XG5cdFx0bGV0IHVuc3RhZ2VDYWxscyA9IDA7XG5cdFx0Y29uc3QgdW5zdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnVuc3RhZ2UnLCAoKSA9PiB7IHVuc3RhZ2VDYWxscysrOyB9KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0XHRpZiAoY29tbWFuZElkID09PSAnZ2l0LnVuc3RhZ2UnKSB7XG5cdFx0XHRcdFx0XHR1bnN0YWdlQ2FsbHMrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNDaGFuZ2VzTW9kZWwsIHtcblx0XHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGdldFNuYXBzaG90OiAoKSA9PiAoe1xuXHRcdFx0XHRcdGdlbmVyYXRpb246IDEsXG5cdFx0XHRcdFx0c2V0dGxlZDogdHJ1ZSxcblx0XHRcdFx0XHRzdGF0ZTogeyBraW5kOiAnZW5naW5lLWxlZnRvdmVyJywgc2Vzc2lvbklkOiAnc2Vzc2lvbi0xJywgcmVhc29uOiAncmVhZC1mYWlsZWQnIH0sXG5cdFx0XHRcdFx0ZW50cmllczogW10sXG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRpc1dyaXRlQ2xvc2VkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0ZpbGVEaWZmT3BlblNraXBwZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJlZnJlc2g6IGFzeW5jICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdFx0c2NoZWR1bGVSZWZyZXNoOiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRcdGZsdXNoU2NoZWR1bGVkUmVmcmVzaDogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlc01vZGVsKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuR2l0QWN0aW9uOiAoY29tbWFuZElkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfSkucnVuR2l0QWN0aW9uKCdnaXQudW5zdGFnZScpO1xuXG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICdpbmRleCcpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cdFx0XHRhd2FpdCAocGFuZSBhcyB1bmtub3duIGFzIHsgcnVuR2l0QWN0aW9uOiAoY29tbWFuZElkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfSkucnVuR2l0QWN0aW9uKCdnaXQudW5zdGFnZScpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGFnZUNhbGxzLCAwKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dW5zdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0ZnVuY3Rpb24gZGlzY29ubmVjdGVkSG9sZFNhZmVDb25uZWN0aW9uKCk6IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Rpc2Nvbm5lY3RlZCcgYXMgY29uc3QgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7fSksXG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbjtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIG1vdW50Q29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUodGVzdDogTW9jaGEuQ29udGV4dCwgb3B0aW9uczoge1xuXHRcdGV4ZWN1dGVDb21tYW5kPzogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gUHJvbWlzZTx1bmtub3duPjtcblx0XHRjb25uZWN0aW9uPzogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdGdyb3VwSWQ/OiBzdHJpbmc7XG5cdFx0aWRlbnRpdHk/OiB7XG5cdFx0XHRvcmlnaW4/OiAnZW5naW5lJyB8ICdzY20nO1xuXHRcdFx0c2Vzc2lvbklkPzogc3RyaW5nO1xuXHRcdFx0Z2l0UGF0aD86IHN0cmluZztcblx0XHRcdGluZGV4U3RhdGU/OiBzdHJpbmc7XG5cdFx0XHRraW5kPzogc3RyaW5nO1xuXHRcdH07XG5cdH0gPSB7fSk6IFByb21pc2U8eyBwYW5lOiBDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZTsgcGFyZW50OiBIVE1MRWxlbWVudCB9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGVzdCwgJy9wcm9qZWN0L3NyYy9kNTI2LXJldmlldy50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRlc3QsICcvcHJvamVjdC9zcmMvZDUyNi1yZXZpZXcudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0Z3JvdXBJZDogb3B0aW9ucy5ncm91cElkLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IG9wdGlvbnMuZXhlY3V0ZUNvbW1hbmQsXG5cdFx0XHRjb25uZWN0aW9uOiBvcHRpb25zLmNvbm5lY3Rpb24gPz8gZGlzY29ubmVjdGVkSG9sZFNhZmVDb25uZWN0aW9uKCksXG5cdFx0fSk7XG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsIG9wdGlvbnMuZ3JvdXBJZCA/PyAnd29ya2luZ1RyZWUnLCBvcHRpb25zLmlkZW50aXR5KSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRyZXR1cm4geyBwYW5lLCBwYXJlbnQgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0dWJTaG93Tm90aWNlVGhyb3cocGFuZTogQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIHBhaW50Qm9vbTogRXJyb3IpOiB2b2lkIHtcblx0XHQocGFuZSBhcyB1bmtub3duIGFzIHsgc2hvd05vdGljZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIH0pLnNob3dOb3RpY2UgPSAoKSA9PiB7XG5cdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIFJldmVydCBjbGljayBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHsgcGFuZSwgcGFyZW50IH0gPSBhd2FpdCBtb3VudENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lKHRoaXMsIHtcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2dpdCBib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdHN0dWJTaG93Tm90aWNlVGhyb3cocGFuZSwgcGFpbnRCb29tKTtcblx0XHRcdGZvcmNlQ2xpY2socGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctcmV2ZXJ0JykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBVbnN0YWdlIGNsaWNrIGNhdGNoLXBhdGggbm90aWNlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgeyBwYW5lLCBwYXJlbnQgfSA9IGF3YWl0IG1vdW50Q29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUodGhpcywge1xuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignZ2l0IGJvb20nKTtcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0c3R1YlNob3dOb3RpY2VUaHJvdyhwYW5lLCBwYWludEJvb20pO1xuXHRcdFx0Zm9yY2VDbGljayhwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy11bnN0YWdlJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBTdGFnZSBjbGljayBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHsgcGFuZSwgcGFyZW50IH0gPSBhd2FpdCBtb3VudENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lKHRoaXMsIHtcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2dpdCBib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdHN0dWJTaG93Tm90aWNlVGhyb3cocGFuZSwgcGFpbnRCb29tKTtcblx0XHRcdGZvcmNlQ2xpY2socGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctc3RhZ2UnKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIEFjY2VwdCBjbGljayBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3ZlckNvbm5lY3RlZENvbm5lY3Rpb24oZmFsc2UpO1xuXHRcdFx0KGNvbm5lY3Rpb24gYXMgeyByZWFkR2l0RmlsZURpZmY/OiAoKSA9PiBQcm9taXNlPG5ldmVyPiB9KS5yZWFkR2l0RmlsZURpZmYgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigncmVhZCBib29tJyk7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgeyBwYW5lLCBwYXJlbnQgfSA9IGF3YWl0IG1vdW50Q29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUodGhpcywge1xuXHRcdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0XHRpZGVudGl0eToge1xuXHRcdFx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRcdFx0c2Vzc2lvbklkOiAnc2Vzc2lvbi0xJyxcblx0XHRcdFx0XHRnaXRQYXRoOiAnc3JjL2Q1MjYtcmV2aWV3LnRzJyxcblx0XHRcdFx0XHRpbmRleFN0YXRlOiAnVW5zdGFnZWQnLFxuXHRcdFx0XHRcdGtpbmQ6ICdNb2RpZmllZCcsXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdChwYW5lIGFzIHVua25vd24gYXMgeyBhY2NlcHRDdXJzb3I6IHsgc2lkZTogJ25ldyc7IGxpbmU6IG51bWJlciB9IH0pLmFjY2VwdEN1cnNvciA9IHsgc2lkZTogJ25ldycsIGxpbmU6IDEgfTtcblx0XHRcdHN0dWJTaG93Tm90aWNlVGhyb3cocGFuZSwgcGFpbnRCb29tKTtcblx0XHRcdGZvcmNlQ2xpY2socGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctYWNjZXB0JykpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIFByZXZpZXcgZmFpbHVyZSBub3RpY2UgdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29tbWFuZEJvb20gPSBuZXcgRXJyb3IoJ3ByZXZpZXcgYm9vbScpO1xuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKGNvbW1hbmRCb29tLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB7IHBhcmVudCB9ID0gYXdhaXQgbW91bnRDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSh0aGlzLCB7XG5cdFx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgY29tbWFuZEJvb207XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IG5vdGljZSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW1vdmUtbm90aWNlJyk7XG5cdFx0XHRhc3NlcnQub2sobm90aWNlKTtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShub3RpY2UsICd0ZXh0Q29udGVudCcsIHsgY29uZmlndXJhYmxlOiB0cnVlLCBzZXQ6ICgpID0+IHsgdGhyb3cgY29tbWFuZEJvb207IH0gfSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmb3JjZUNsaWNrKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW9wZW4tcHJldmlldycpKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFJlZmxlY3QuZGVsZXRlUHJvcGVydHkobm90aWNlLCAndGV4dENvbnRlbnQnKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gU3RhZ2UgY2F0Y2gtcGF0aCBub3RpY2UgdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9kNTI0LXN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9kNTI0LXN0YWdlLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGFwcGx5Q2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKGFwcGx5Q2FsbHMsIHN0YWdlQ2FsbHMsIGZhbHNlKTtcblx0XHRjb25uZWN0aW9uLndyaXRlR2l0U3RhZ2VQYXRocyA9IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdCkgPT4ge1xuXHRcdFx0c3RhZ2VDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdzdGFnZSBib29tJyk7XG5cdFx0fTtcblxuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblx0XHRcdCh2aWV3IGFzIHVua25vd24gYXMgeyBzaG93QWN0aW9uTm90aWNlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQgfSkuc2hvd0FjdGlvbk5vdGljZSA9ICgpID0+IHtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fTtcblx0XHRcdGZvcmNlQ2xpY2sodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gcmVuZGVyUmVmIGNhdGNoLXBhdGggbm90aWNlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZDUyNC1yZW5kZXIudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2Q1MjQtcmVuZGVyLnRzLmdpdCcpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHsgdGhyb3dPbkxvYWQ6IHRydWUsIHJlc291cmNlIH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0KHZpZXcgYXMgdW5rbm93biBhcyB7IHNob3dMb2FkTm90aWNlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQgfSkuc2hvd0xvYWROb3RpY2UgPSAoKSA9PiB7XG5cdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdH07XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMgc3RheXMgZW1wdHkgYWZ0ZXIgUzAgZHJvcHMgdGhlIGNhcnJpZWQgcGF5bG9hZCcsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNvdXJjZXNHaXRBcHBseUh1bmtzUGF0Y2hlcyh1bmRlZmluZWQpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMoe30pLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMoeyB1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmIH0gYXMgb2JqZWN0KSwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdvcGVuU291cmNlc0NoYW5nZUVudHJ5IGNhcnJpZXMgZmV0Y2hlZCB1bmlmaWVkRGlmZiBvbnRvIHRoZSBwYW5lbCBjaGFuZ2UgcmVmJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvY2FycnktcGFuZWwudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2NhcnJ5LXBhbmVsLnRzJyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnVW5zdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0Z2l0UGF0aDogJ3NyYy9jYXJyeS1wYW5lbC50cycsXG5cdFx0XHRpbmRleFN0YXRlOiAnV09SS1RSRUUnLFxuXHRcdH07XG5cdFx0bGV0IHNob3duOiBJU291cmNlc0NoYW5nZVJlZiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RlbHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG5cdFx0YXdhaXQgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeShlbnRyeSwge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IE51bGxDb21tYW5kU2VydmljZSxcblx0XHRcdGVkaXRvclNlcnZpY2U6IHsgb3BlbkVkaXRvcjogYXN5bmMgKCkgPT4gdW5kZWZpbmVkIH0gYXMgdW5rbm93biBhcyBJRWRpdG9yU2VydmljZSxcblx0XHRcdHF1aWNrRGlmZlNlcnZpY2U6IHsgZ2V0UXVpY2tEaWZmczogYXN5bmMgKCkgPT4gW10gfSBhcyB1bmtub3duIGFzIElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyAnc291cmNlcy5kaWZmLmRlZmF1bHRPd25lcic6ICdwYW5lbCcgfSksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZToge1xuXHRcdFx0XHRjcmVhdGVJbnN0YW5jZTogKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ3BhbmVsIG9wZW4gbXVzdCBub3QgY3JlYXRlIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCcpOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlRW50cnlPcGVuRGVwc1snaW5zdGFudGlhdGlvblNlcnZpY2UnXSxcblx0XHRcdHNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdHNob3c6IGFzeW5jIChyZWY6IElTb3VyY2VzQ2hhbmdlUmVmKSA9PiB7IHNob3duID0gcmVmOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRcdG1vZGVsU2VydmljZToge1xuXHRcdFx0XHRnZXRNb2RlbDogKHVyaTogVVJJKSA9PiBtb2RlbHMuaGFzKHVyaS50b1N0cmluZygpKSA/IHsgdXJpIH0gOiBudWxsLFxuXHRcdFx0XHR1cGRhdGVNb2RlbDogKG1vZGVsOiB7IHVyaTogVVJJIH0sIHZhbHVlOiBzdHJpbmcpID0+IHsgbW9kZWxzLnNldChtb2RlbC51cmkudG9TdHJpbmcoKSwgdmFsdWUpOyB9LFxuXHRcdFx0XHRjcmVhdGVNb2RlbDogKHZhbHVlOiBzdHJpbmcsIF9sYW5ndWFnZTogdW5rbm93biwgdXJpPzogVVJJKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnNldCh1cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4geyB1cmkgfTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJTW9kZWxTZXJ2aWNlLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRcdHBhdGg6ICdzcmMvY2FycnktcGFuZWwudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc291cmNlc0dpdEFwcGx5SHVua3NQYXRjaGVzKHNob3duKSwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdvcGVuU291cmNlc0NoYW5nZUVudHJ5IGF0dGFjaGVzIGZldGNoZWQgdW5pZmllZERpZmYgZm9yIENvbnZlcnNhdGlvbiBBY2NlcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9jYXJyeS1yZXZpZXcudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2NhcnJ5LXJldmlldy50cycsXG5cdFx0XHRkZXNjcmlwdGlvbjogJ1Vuc3RhZ2VkIENoYW5nZXMnLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdGdpdFBhdGg6ICdzcmMvY2FycnktcmV2aWV3LnRzJyxcblx0XHRcdGluZGV4U3RhdGU6ICdXT1JLVFJFRScsXG5cdFx0fTtcblx0XHRsZXQgb3BlbmVkOiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgbW9kZWxzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRjb25zdCBoYXJuZXNzID0gY3JlYXRlU291cmNlc0NvbnZlcnNhdGlvbk9wZW5IYXJuZXNzKHN0b3JlLCB7XG5cdFx0XHRvcGVuRWRpdG9yOiBhc3luYyBpbnB1dCA9PiB7XG5cdFx0XHRcdGlmIChpbnB1dCBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCkge1xuXHRcdFx0XHRcdG9wZW5lZCA9IGlucHV0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0YXdhaXQgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeShlbnRyeSwge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IE51bGxDb21tYW5kU2VydmljZSxcblx0XHRcdGVkaXRvclNlcnZpY2U6IHtcblx0XHRcdFx0b3BlbkVkaXRvcjogYXN5bmMgKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ2NvbnZlcnNhdGlvbiBvcGVuIG11c3Qgbm90IHVzZSBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3InKTsgfSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yU2VydmljZSxcblx0XHRcdHF1aWNrRGlmZlNlcnZpY2U6IHsgZ2V0UXVpY2tEaWZmczogYXN5bmMgKCkgPT4gW10gfSBhcyB1bmtub3duIGFzIElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyAnc291cmNlcy5kaWZmLmRlZmF1bHRPd25lcic6ICdjb252ZXJzYXRpb24nIH0pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IHtcblx0XHRcdFx0Y3JlYXRlSW5zdGFuY2U6IChjdG9yOiB0eXBlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0LCBtb2RpZmllZDogVVJJLCBvcmlnaW5hbD86IFVSSSwgZ3JvdXBJZD86IHN0cmluZykgPT5cblx0XHRcdFx0XHRzdG9yZS5hZGQobmV3IGN0b3IobW9kaWZpZWQsIG9yaWdpbmFsLCBncm91cElkKSksXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNDaGFuZ2VFbnRyeU9wZW5EZXBzWydpbnN0YW50aWF0aW9uU2VydmljZSddLFxuXHRcdFx0c291cmNlc0RpZmZQYW5lbFNlcnZpY2U6IHtcblx0XHRcdFx0c2hvdzogYXN5bmMgKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ2NvbnZlcnNhdGlvbiBvcGVuIG11c3Qgbm90IHNob3cgdGhlIHBhbmVsJyk7IH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLFxuXHRcdFx0ZWRpdG9yR3JvdXBzU2VydmljZTogaGFybmVzcy5lZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdFx0c2Vzc2lvbjogaGFybmVzcy5zZXNzaW9uLFxuXHRcdFx0bW9kZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldE1vZGVsOiAodXJpOiBVUkkpID0+IG1vZGVscy5oYXModXJpLnRvU3RyaW5nKCkpID8geyB1cmkgfSA6IG51bGwsXG5cdFx0XHRcdHVwZGF0ZU1vZGVsOiAobW9kZWw6IHsgdXJpOiBVUkkgfSwgdmFsdWU6IHN0cmluZykgPT4geyBtb2RlbHMuc2V0KG1vZGVsLnVyaS50b1N0cmluZygpLCB2YWx1ZSk7IH0sXG5cdFx0XHRcdGNyZWF0ZU1vZGVsOiAodmFsdWU6IHN0cmluZywgX2xhbmd1YWdlOiB1bmtub3duLCB1cmk/OiBVUkkpID0+IHtcblx0XHRcdFx0XHRpZiAodXJpKSB7XG5cdFx0XHRcdFx0XHRtb2RlbHMuc2V0KHVyaS50b1N0cmluZygpLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB7IHVyaSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElNb2RlbFNlcnZpY2UsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jICgpID0+ICh7XG5cdFx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdFx0cGF0aDogJ3NyYy9jYXJyeS1yZXZpZXcudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblxuXHRcdGFzc2VydC5vayhvcGVuZWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc291cmNlc0dpdEFwcGx5SHVua3NQYXRjaGVzKG9wZW5lZCksIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnb3BlblNvdXJjZXNDaGFuZ2VFbnRyeSBhdHRhY2hlcyBmZXRjaGVkIHVuaWZpZWREaWZmIGZvciBQcmV2aWV3IHRoZW4gQ29udmVyc2F0aW9uIEFjY2VwdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2NhcnJ5LXByZXZpZXcudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2NhcnJ5LXByZXZpZXcudHMnLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdVbnN0YWdlZCBDaGFuZ2VzJyxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2NhcnJ5LXByZXZpZXcudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1dPUktUUkVFJyxcblx0XHR9O1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0Y29uc3QgbW9kZWxzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRjb25zdCBlZGl0b3JTdGF0ZSA9IHtcblx0XHRcdGFjdGl2ZUVkaXRvcjogdW5kZWZpbmVkIGFzIERpZmZFZGl0b3JJbnB1dCB8IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCB8IHVuZGVmaW5lZCxcblx0XHRcdGNsb3NlZDogW10gYXMgb2JqZWN0W10sXG5cdFx0fTtcblx0XHRsZXQgZWRpdG9yT3BlbnMgPSAwO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVTb3VyY2VzQ29udmVyc2F0aW9uT3Blbkhhcm5lc3Moc3RvcmUsIHtcblx0XHRcdG9wZW5FZGl0b3I6IGFzeW5jIGlucHV0ID0+IHtcblx0XHRcdFx0aWYgKGlucHV0IGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KSB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGlucHV0KTtcblx0XHRcdFx0XHRlZGl0b3JTdGF0ZS5hY3RpdmVFZGl0b3IgPSBpbnB1dDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSB7XG5cdFx0XHRnZXQgYWN0aXZlRWRpdG9yKCkgeyByZXR1cm4gZWRpdG9yU3RhdGUuYWN0aXZlRWRpdG9yOyB9LFxuXHRcdFx0YWN0aXZlRWRpdG9yUGFuZTogeyBncm91cDogeyBpZDogMSB9IH0sXG5cdFx0XHRjbG9zZUVkaXRvcjogYXN5bmMgKGlkZW50OiB7IGVkaXRvcjogb2JqZWN0IH0pID0+IHtcblx0XHRcdFx0ZWRpdG9yU3RhdGUuY2xvc2VkLnB1c2goaWRlbnQuZWRpdG9yKTtcblx0XHRcdFx0aWYgKGVkaXRvclN0YXRlLmFjdGl2ZUVkaXRvciA9PT0gaWRlbnQuZWRpdG9yKSB7XG5cdFx0XHRcdFx0ZWRpdG9yU3RhdGUuYWN0aXZlRWRpdG9yID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0b3BlbkVkaXRvcjogYXN5bmMgKGlucHV0OiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdGVkaXRvck9wZW5zKys7XG5cdFx0XHRcdGNvbnN0IHVudHlwZWQgPSBpbnB1dCBhcyB7IG9yaWdpbmFsPzogeyByZXNvdXJjZT86IFVSSSB9OyBtb2RpZmllZD86IHsgcmVzb3VyY2U/OiBVUkkgfSB9O1xuXHRcdFx0XHRpZiAodW50eXBlZC5vcmlnaW5hbD8ucmVzb3VyY2UgJiYgdW50eXBlZC5tb2RpZmllZD8ucmVzb3VyY2UpIHtcblx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbElucHV0ID0gc3RvcmUuYWRkKG5ldyBUZXN0RWRpdG9ySW5wdXQodW50eXBlZC5vcmlnaW5hbC5yZXNvdXJjZSwgJ3Rlc3Qub3JpZ2luYWwnKSk7XG5cdFx0XHRcdFx0Y29uc3QgbW9kaWZpZWRJbnB1dCA9IHN0b3JlLmFkZChuZXcgVGVzdEVkaXRvcklucHV0KHVudHlwZWQubW9kaWZpZWQucmVzb3VyY2UsICd0ZXN0Lm1vZGlmaWVkJykpO1xuXHRcdFx0XHRcdGNvbnN0IGRpZmZJbnB1dCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9ySW5wdXQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBvcmlnaW5hbElucHV0LCBtb2RpZmllZElucHV0LCB1bmRlZmluZWQpKTtcblx0XHRcdFx0XHRlZGl0b3JTdGF0ZS5hY3RpdmVFZGl0b3IgPSBkaWZmSW5wdXQ7XG5cdFx0XHRcdFx0cmV0dXJuIHsgaW5wdXQ6IGRpZmZJbnB1dCB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yU2VydmljZTtcblxuXHRcdGF3YWl0IG9wZW5Tb3VyY2VzQ2hhbmdlRW50cnkoZW50cnksIHtcblx0XHRcdGNvbW1hbmRTZXJ2aWNlOiBOdWxsQ29tbWFuZFNlcnZpY2UsXG5cdFx0XHRlZGl0b3JTZXJ2aWNlLFxuXHRcdFx0cXVpY2tEaWZmU2VydmljZTogeyBnZXRRdWlja0RpZmZzOiBhc3luYyAoKSA9PiBbXSB9IGFzIHVua25vd24gYXMgSVF1aWNrRGlmZlNlcnZpY2UsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7ICdzb3VyY2VzLmRpZmYuZGVmYXVsdE93bmVyJzogJ3ByZXZpZXcnIH0pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRzb3VyY2VzRGlmZlBhbmVsU2VydmljZToge1xuXHRcdFx0XHRzaG93OiBhc3luYyAoKSA9PiB7IHRocm93IG5ldyBFcnJvcigncHJldmlldyBvcGVuIG11c3Qgbm90IHNob3cgdGhlIHBhbmVsJyk7IH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLFxuXHRcdFx0bW9kZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldE1vZGVsOiAodXJpOiBVUkkpID0+IG1vZGVscy5oYXModXJpLnRvU3RyaW5nKCkpID8geyB1cmkgfSA6IG51bGwsXG5cdFx0XHRcdHVwZGF0ZU1vZGVsOiAobW9kZWw6IHsgdXJpOiBVUkkgfSwgdmFsdWU6IHN0cmluZykgPT4geyBtb2RlbHMuc2V0KG1vZGVsLnVyaS50b1N0cmluZygpLCB2YWx1ZSk7IH0sXG5cdFx0XHRcdGNyZWF0ZU1vZGVsOiAodmFsdWU6IHN0cmluZywgX2xhbmd1YWdlOiB1bmtub3duLCB1cmk/OiBVUkkpID0+IHtcblx0XHRcdFx0XHRpZiAodXJpKSB7XG5cdFx0XHRcdFx0XHRtb2RlbHMuc2V0KHVyaS50b1N0cmluZygpLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB7IHVyaSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElNb2RlbFNlcnZpY2UsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jICgpID0+ICh7XG5cdFx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdFx0cGF0aDogJ3NyYy9jYXJyeS1wcmV2aWV3LnRzJyxcblx0XHRcdFx0dW5pZmllZERpZmY6IGNhcnJpZWRVbmlmaWVkRGlmZixcblx0XHRcdH0pLFxuXHRcdH0sIHsgcHJlc2VydmVGb2N1czogZmFsc2UgfSk7XG5cblx0XHRjb25zdCBwcmV2aWV3SG9zdCA9IGVkaXRvclN0YXRlLmFjdGl2ZUVkaXRvcjtcblx0XHRhc3NlcnQub2socHJldmlld0hvc3QgaW5zdGFuY2VvZiBEaWZmRWRpdG9ySW5wdXQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc291cmNlc0dpdEFwcGx5SHVua3NQYXRjaGVzKHByZXZpZXdIb3N0KSwgW10pO1xuXG5cdFx0Y29uc3Qgb3BlbnNCZWZvcmVNb3ZlID0gZWRpdG9yT3BlbnM7XG5cdFx0YXdhaXQgbW92ZUFjdGl2ZURpZmZUb0NvbnZlcnNhdGlvbignZWRpdG9yVGl0bGUnLCB7XG5cdFx0XHRjb21tYW5kU2VydmljZTogTnVsbENvbW1hbmRTZXJ2aWNlLFxuXHRcdFx0ZWRpdG9yU2VydmljZSxcblx0XHRcdHF1aWNrRGlmZlNlcnZpY2U6IHsgZ2V0UXVpY2tEaWZmczogYXN5bmMgKCkgPT4gW10gfSBhcyB1bmtub3duIGFzIElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSxcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdFx0c291cmNlc0RpZmZQYW5lbFNlcnZpY2U6IHtcblx0XHRcdFx0c2hvdzogYXN5bmMgKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ21vdmUgdG8gY29udmVyc2F0aW9uIG11c3Qgbm90IHNob3cgdGhlIHBhbmVsJyk7IH0sXG5cdFx0XHRcdGdldEN1cnJlbnRSZWY6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdFx0Y2xlYXI6ICgpID0+IHsgfSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZWY6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLFxuXHRcdFx0ZWRpdG9yR3JvdXBzU2VydmljZTogaGFybmVzcy5lZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdFx0c2Vzc2lvbjogaGFybmVzcy5zZXNzaW9uLFxuXHRcdH0sIHsgcmVwb3NpdG9yaWVzOiBbXSB9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JPcGVucywgb3BlbnNCZWZvcmVNb3ZlKTtcblxuXHRcdGNvbnN0IGNvbnZlcnNhdGlvbkhvc3QgPSBlZGl0b3JTdGF0ZS5hY3RpdmVFZGl0b3I7XG5cdFx0YXNzZXJ0Lm9rKGNvbnZlcnNhdGlvbkhvc3QgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChjb252ZXJzYXRpb25Ib3N0LCBwcmV2aWV3SG9zdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMoY29udmVyc2F0aW9uSG9zdCksIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnb3BlblNvdXJjZXNDaGFuZ2VFbnRyeSBwcmV2aWV3IGZpcnN0LW9wZW4gbGVhdmVzIHdoaXRlc3BhY2UgdW5pZmllZERpZmYgYWJzZW50JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvcHJldmlldy13aGl0ZXNwYWNlLnRzJyk7XG5cdFx0Y29uc3QgZW50cnk6IElTb3VyY2VzQ2hhbmdlRW50cnkgPSB7XG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdG5hbWU6ICdwcmV2aWV3LXdoaXRlc3BhY2UudHMnLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdVbnN0YWdlZCBDaGFuZ2VzJyxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL3ByZXZpZXctd2hpdGVzcGFjZS50cycsXG5cdFx0XHRpbmRleFN0YXRlOiAnV09SS1RSRUUnLFxuXHRcdH07XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIHN0b3JlKTtcblx0XHRjb25zdCBtb2RlbHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHRcdGxldCBwcmV2aWV3SG9zdDogRGlmZkVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXG5cdFx0YXdhaXQgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeShlbnRyeSwge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IE51bGxDb21tYW5kU2VydmljZSxcblx0XHRcdGVkaXRvclNlcnZpY2U6IHtcblx0XHRcdFx0Z2V0IGFjdGl2ZUVkaXRvcigpIHsgcmV0dXJuIHByZXZpZXdIb3N0OyB9LFxuXHRcdFx0XHRvcGVuRWRpdG9yOiBhc3luYyAoaW5wdXQ6IHsgb3JpZ2luYWw/OiB7IHJlc291cmNlPzogVVJJIH07IG1vZGlmaWVkPzogeyByZXNvdXJjZT86IFVSSSB9IH0pID0+IHtcblx0XHRcdFx0XHRpZiAoaW5wdXQub3JpZ2luYWw/LnJlc291cmNlICYmIGlucHV0Lm1vZGlmaWVkPy5yZXNvdXJjZSkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxJbnB1dCA9IHN0b3JlLmFkZChuZXcgVGVzdEVkaXRvcklucHV0KGlucHV0Lm9yaWdpbmFsLnJlc291cmNlLCAndGVzdC5vcmlnaW5hbCcpKTtcblx0XHRcdFx0XHRcdGNvbnN0IG1vZGlmaWVkSW5wdXQgPSBzdG9yZS5hZGQobmV3IFRlc3RFZGl0b3JJbnB1dChpbnB1dC5tb2RpZmllZC5yZXNvdXJjZSwgJ3Rlc3QubW9kaWZpZWQnKSk7XG5cdFx0XHRcdFx0XHRwcmV2aWV3SG9zdCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9ySW5wdXQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBvcmlnaW5hbElucHV0LCBtb2RpZmllZElucHV0LCB1bmRlZmluZWQpKTtcblx0XHRcdFx0XHRcdHJldHVybiB7IGlucHV0OiBwcmV2aWV3SG9zdCB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElFZGl0b3JTZXJ2aWNlLFxuXHRcdFx0cXVpY2tEaWZmU2VydmljZTogeyBnZXRRdWlja0RpZmZzOiBhc3luYyAoKSA9PiBbXSB9IGFzIHVua25vd24gYXMgSVF1aWNrRGlmZlNlcnZpY2UsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7ICdzb3VyY2VzLmRpZmYuZGVmYXVsdE93bmVyJzogJ3ByZXZpZXcnIH0pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRzb3VyY2VzRGlmZlBhbmVsU2VydmljZToge1xuXHRcdFx0XHRzaG93OiBhc3luYyAoKSA9PiB7IHRocm93IG5ldyBFcnJvcigncHJldmlldyBvcGVuIG11c3Qgbm90IHNob3cgdGhlIHBhbmVsJyk7IH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLFxuXHRcdFx0bW9kZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldE1vZGVsOiAodXJpOiBVUkkpID0+IG1vZGVscy5oYXModXJpLnRvU3RyaW5nKCkpID8geyB1cmkgfSA6IG51bGwsXG5cdFx0XHRcdHVwZGF0ZU1vZGVsOiAobW9kZWw6IHsgdXJpOiBVUkkgfSwgdmFsdWU6IHN0cmluZykgPT4geyBtb2RlbHMuc2V0KG1vZGVsLnVyaS50b1N0cmluZygpLCB2YWx1ZSk7IH0sXG5cdFx0XHRcdGNyZWF0ZU1vZGVsOiAodmFsdWU6IHN0cmluZywgX2xhbmd1YWdlOiB1bmtub3duLCB1cmk/OiBVUkkpID0+IHtcblx0XHRcdFx0XHRpZiAodXJpKSB7XG5cdFx0XHRcdFx0XHRtb2RlbHMuc2V0KHVyaS50b1N0cmluZygpLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB7IHVyaSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElNb2RlbFNlcnZpY2UsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jICgpID0+ICh7XG5cdFx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdFx0cGF0aDogJ3NyYy9wcmV2aWV3LXdoaXRlc3BhY2UudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogJyAgICcsXG5cdFx0XHR9KSxcblx0XHR9LCB7IHByZXNlcnZlRm9jdXM6IGZhbHNlIH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKHByZXZpZXdIb3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNvdXJjZXNHaXRBcHBseUh1bmtzUGF0Y2hlcyhwcmV2aWV3SG9zdCksIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnUzAga2VlcHMgQWNjZXB0IGhpZGRlbiBhbmQgc2VuZHMgMCBBcHBseUh1bmtzIGV2ZW4gd2hlbiBhIGRpZmYgd2FzIGZldGNoZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hY2NlcHQtY2FycnkudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2FjY2VwdC1jYXJyeS50cy5naXQnKTtcblx0XHRjb25zdCBhcHBseUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgZ2l0U3RhZ2VDb21tYW5kczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKGFwcGx5Q2FsbHMsIFtdLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChjb25uZWN0aW9uKSwgZmFsc2UpO1xuXG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2dpdC5zdGFnZScpIHtcblx0XHRcdFx0XHRcdGdpdFN0YWdlQ29tbWFuZHMucHVzaChjb21tYW5kSWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxBY2NlcHQgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxBY2NlcHQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuQWNjZXB0OiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkFjY2VwdCgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0U3RhZ2VDb21tYW5kcywgW10pO1xuXG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld0FjY2VwdCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LWFjY2VwdCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdBY2NlcHQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhd2FpdCAocGFuZSBhcyB1bmtub3duIGFzIHsgcnVuQWNjZXB0OiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkFjY2VwdCgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0U3RhZ2VDb21tYW5kcywgW10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgdW5pZmllZERpZmYga2VlcHMgQWNjZXB0IGhpZGRlbiBhbmQgc2VuZHMgMCBBcHBseUh1bmtzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYWNjZXB0LWVtcHR5LnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hY2NlcHQtZW1wdHkudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihhcHBseUNhbGxzLCBbXSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0Y29ubmVjdGlvbixcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHR9KSk7XG5cdFx0dmlldy5yZW5kZXIoKTtcblx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRvcmlnaW5hbCxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0fSk7XG5cdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0Y29uc3QgcGFuZWxBY2NlcHQgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsQWNjZXB0Py5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGZvcmNlQ2xpY2socGFuZWxBY2NlcHQpO1xuXHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQ6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuQWNjZXB0KCk7XG5cdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhcHBseUNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5Tb3VyY2VzQ2hhbmdlRW50cnkgY29waWVzIGVudHJ5IGlkZW50aXR5IG9udG8gdGhlIHNvdXJjZXMtZ2l0LWRpZmYgcmVmJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvaWRlbnRpdHkudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2lkZW50aXR5LnRzJyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnVW5zdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tb2xkJyxcblx0XHRcdGdpdFBhdGg6ICdzcmMvaWRlbnRpdHkudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1dPUktUUkVFJyxcblx0XHRcdGtpbmQ6ICdNT0RJRklFRCcsXG5cdFx0fTtcblx0XHRsZXQgc2hvd246IElTb3VyY2VzQ2hhbmdlUmVmIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVscyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0YXdhaXQgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeShlbnRyeSwge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IE51bGxDb21tYW5kU2VydmljZSxcblx0XHRcdGVkaXRvclNlcnZpY2U6IHsgb3BlbkVkaXRvcjogYXN5bmMgKCkgPT4gdW5kZWZpbmVkIH0gYXMgdW5rbm93biBhcyBJRWRpdG9yU2VydmljZSxcblx0XHRcdHF1aWNrRGlmZlNlcnZpY2U6IHsgZ2V0UXVpY2tEaWZmczogYXN5bmMgKCkgPT4gW10gfSBhcyB1bmtub3duIGFzIElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyAnc291cmNlcy5kaWZmLmRlZmF1bHRPd25lcic6ICdwYW5lbCcgfSksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZToge1xuXHRcdFx0XHRjcmVhdGVJbnN0YW5jZTogKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ3BhbmVsIG9wZW4gbXVzdCBub3QgY3JlYXRlIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCcpOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlRW50cnlPcGVuRGVwc1snaW5zdGFudGlhdGlvblNlcnZpY2UnXSxcblx0XHRcdHNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdHNob3c6IGFzeW5jIChyZWY6IElTb3VyY2VzQ2hhbmdlUmVmKSA9PiB7IHNob3duID0gcmVmOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRcdG1vZGVsU2VydmljZToge1xuXHRcdFx0XHRnZXRNb2RlbDogKHVyaTogVVJJKSA9PiBtb2RlbHMuaGFzKHVyaS50b1N0cmluZygpKSA/IHsgdXJpIH0gOiBudWxsLFxuXHRcdFx0XHR1cGRhdGVNb2RlbDogKG1vZGVsOiB7IHVyaTogVVJJIH0sIHZhbHVlOiBzdHJpbmcpID0+IHsgbW9kZWxzLnNldChtb2RlbC51cmkudG9TdHJpbmcoKSwgdmFsdWUpOyB9LFxuXHRcdFx0XHRjcmVhdGVNb2RlbDogKHZhbHVlOiBzdHJpbmcsIF9sYW5ndWFnZTogdW5rbm93biwgdXJpPzogVVJJKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnNldCh1cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4geyB1cmkgfTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJTW9kZWxTZXJ2aWNlLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRcdHBhdGg6ICdzcmMvaWRlbnRpdHkudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvd24/Lm9yaWdpbiwgJ2VuZ2luZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bj8uc2Vzc2lvbklkLCAnc2Vzc2lvbi1vbGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvd24/LmdpdFBhdGgsICdzcmMvaWRlbnRpdHkudHMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvd24/LmluZGV4U3RhdGUsICdXT1JLVFJFRScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bj8ua2luZCwgJ01PRElGSUVEJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3duPy5tb2RpZmllZC5zY2hlbWUsICdzb3VyY2VzLWdpdC1kaWZmJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5Tb3VyY2VzQ2hhbmdlRW50cnkgY29waWVzIGVudHJ5IGlkZW50aXR5IG9udG8gdGhlIGNvbnZlcnNhdGlvbiBpbnB1dCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2lkZW50aXR5LWlucHV0LnRzJyk7XG5cdFx0Y29uc3QgZW50cnk6IElTb3VyY2VzQ2hhbmdlRW50cnkgPSB7XG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdG5hbWU6ICdpZGVudGl0eS1pbnB1dC50cycsXG5cdFx0XHRkZXNjcmlwdGlvbjogJ1Vuc3RhZ2VkIENoYW5nZXMnLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLW9sZCcsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2lkZW50aXR5LWlucHV0LnRzJyxcblx0XHRcdGluZGV4U3RhdGU6ICdXT1JLVFJFRScsXG5cdFx0XHRraW5kOiAnTU9ESUZJRUQnLFxuXHRcdH07XG5cdFx0bGV0IG9wZW5lZDogQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0IHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVscyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZVNvdXJjZXNDb252ZXJzYXRpb25PcGVuSGFybmVzcyhzdG9yZSwge1xuXHRcdFx0b3BlbkVkaXRvcjogYXN5bmMgaW5wdXQgPT4ge1xuXHRcdFx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQpIHtcblx0XHRcdFx0XHRvcGVuZWQgPSBpbnB1dDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRhd2FpdCBvcGVuU291cmNlc0NoYW5nZUVudHJ5KGVudHJ5LCB7XG5cdFx0XHRjb21tYW5kU2VydmljZTogTnVsbENvbW1hbmRTZXJ2aWNlLFxuXHRcdFx0ZWRpdG9yU2VydmljZToge1xuXHRcdFx0XHRvcGVuRWRpdG9yOiBhc3luYyAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignY29udmVyc2F0aW9uIG9wZW4gbXVzdCBub3QgdXNlIGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcicpOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElFZGl0b3JTZXJ2aWNlLFxuXHRcdFx0cXVpY2tEaWZmU2VydmljZTogeyBnZXRRdWlja0RpZmZzOiBhc3luYyAoKSA9PiBbXSB9IGFzIHVua25vd24gYXMgSVF1aWNrRGlmZlNlcnZpY2UsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7ICdzb3VyY2VzLmRpZmYuZGVmYXVsdE93bmVyJzogJ2NvbnZlcnNhdGlvbicgfSksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZToge1xuXHRcdFx0XHRjcmVhdGVJbnN0YW5jZTogKGN0b3I6IHR5cGVvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQsIG1vZGlmaWVkOiBVUkksIG9yaWdpbmFsPzogVVJJLCBncm91cElkPzogc3RyaW5nLCBpZGVudGl0eT86IENvbnN0cnVjdG9yUGFyYW1ldGVyczx0eXBlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0PlszXSkgPT5cblx0XHRcdFx0XHRzdG9yZS5hZGQobmV3IGN0b3IobW9kaWZpZWQsIG9yaWdpbmFsLCBncm91cElkLCBpZGVudGl0eSkpLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlRW50cnlPcGVuRGVwc1snaW5zdGFudGlhdGlvblNlcnZpY2UnXSxcblx0XHRcdHNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdHNob3c6IGFzeW5jICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdjb252ZXJzYXRpb24gb3BlbiBtdXN0IG5vdCBzaG93IHRoZSBwYW5lbCcpOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRcdGVkaXRvckdyb3Vwc1NlcnZpY2U6IGhhcm5lc3MuZWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRcdHNlc3Npb246IGhhcm5lc3Muc2Vzc2lvbixcblx0XHRcdG1vZGVsU2VydmljZToge1xuXHRcdFx0XHRnZXRNb2RlbDogKHVyaTogVVJJKSA9PiBtb2RlbHMuaGFzKHVyaS50b1N0cmluZygpKSA/IHsgdXJpIH0gOiBudWxsLFxuXHRcdFx0XHR1cGRhdGVNb2RlbDogKG1vZGVsOiB7IHVyaTogVVJJIH0sIHZhbHVlOiBzdHJpbmcpID0+IHsgbW9kZWxzLnNldChtb2RlbC51cmkudG9TdHJpbmcoKSwgdmFsdWUpOyB9LFxuXHRcdFx0XHRjcmVhdGVNb2RlbDogKHZhbHVlOiBzdHJpbmcsIF9sYW5ndWFnZTogdW5rbm93biwgdXJpPzogVVJJKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnNldCh1cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4geyB1cmkgfTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJTW9kZWxTZXJ2aWNlLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRcdHBhdGg6ICdzcmMvaWRlbnRpdHktaW5wdXQudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQub2sob3BlbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlbmVkLnNlc3Npb25JZCwgJ3Nlc3Npb24tb2xkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5lZC5naXRQYXRoLCAnc3JjL2lkZW50aXR5LWlucHV0LnRzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5lZC5vcmlnaW4sICdlbmdpbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlbmVkLm1vZGlmaWVkLnNjaGVtZSwgJ3NvdXJjZXMtZ2l0LWRpZmYnKTtcblx0fSk7XG5cblx0dGVzdCgnZW5naW5lIGRpZmYgc3RhZ2Ugc2VuZHMgZ2l0UGF0aCBhbmQgdGhlIHBpbm5lZCBzZXNzaW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHN0YWdlQ2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBnaXRDb21tYW5kczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gbGVmdG92ZXJMb29rc0xpdmVBcHBseUNvbm5lY3Rpb24oW10sIHN0YWdlQ2FsbHMsIGZhbHNlKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdGdpdENvbW1hbmRzLnB1c2goU3RyaW5nKGNvbW1hbmRJZCkpO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0fSkpO1xuXHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBVUkkuZnJvbSh7IHNjaGVtZTogJ3NvdXJjZXMtZ2l0LWRpZmYnLCBwYXRoOiAnL21vZGlmaWVkL2EudHMnIH0pO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdG1vZGlmaWVkLFxuXHRcdFx0b3JpZ2luYWw6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvb3JpZ2luYWwvYS50cycgfSksXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2EudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1dPUktUUkVFJyxcblx0XHRcdGtpbmQ6ICdNT0RJRklFRCcsXG5cdFx0XHRzY21SZXNvdXJjZTogeyBzb3VyY2VVcmk6IFVSSS5maWxlKCcvd29yay9yZXBvL3NyYy9hLnRzJykgfSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZSxcblx0XHR9KTtcblx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuU3RhZ2U6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuU3RhZ2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzWzBdPy5zZXNzaW9uSWQsICdzZXNzaW9uLTEnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YWdlQ2FsbHNbMF0/LmNvbW1hbmRzPy5bMF0/LmFyZ3YsIFsnc3JjL2EudHMnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFKU09OLnN0cmluZ2lmeShzdGFnZUNhbGxzWzBdKS5pbmNsdWRlcygnc291cmNlcy1naXQtZGlmZicpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdENvbW1hbmRzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VuZ2luZSBkaWZmIHN0YWdlIGFuZCBhY2NlcHQgcmVmdXNlIGEgbWlzbWF0Y2hlZCBwaW5uZWQgc2Vzc2lvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihhcHBseUNhbGxzLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKGNvbW1hbmRJZDogdW5rbm93bikgPT4ge1xuXHRcdFx0XHRnaXRDb21tYW5kcy5wdXNoKFN0cmluZyhjb21tYW5kSWQpKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0c3R1YkVuZ2luZUxpdmVDaGFuZ2VzTW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHR9KSk7XG5cdFx0dmlldy5yZW5kZXIoKTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvbW9kaWZpZWQvbWlzbWF0Y2gudHMnIH0pO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdG1vZGlmaWVkLFxuXHRcdFx0b3JpZ2luYWw6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvb3JpZ2luYWwvbWlzbWF0Y2gudHMnIH0pLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLW9sZCcsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL21pc21hdGNoLnRzJyxcblx0XHRcdHNjbVJlc291cmNlOiB7IHNvdXJjZVVyaTogVVJJLmZpbGUoJy93b3JrL3JlcG8vc3JjL21pc21hdGNoLnRzJykgfSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZSxcblx0XHR9KTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGZvcmNlQ2xpY2socGFuZWxTdGFnZSk7XG5cdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUNhbGxzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRDb21tYW5kcywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY3Rpb24tbm90aWNlJyk/LnRleHRDb250ZW50LCBzb3VyY2VzR2l0U2Vzc2lvbkNoYW5nZWRNZXNzYWdlKCkpO1xuXG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChtb2RpZmllZCwgVVJJLmZyb20oeyBzY2hlbWU6ICdzb3VyY2VzLWdpdC1kaWZmJywgcGF0aDogJy9vcmlnaW5hbC9taXNtYXRjaC50cycgfSksICd3b3JraW5nVHJlZScsIHtcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLW9sZCcsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL21pc21hdGNoLnRzJyxcblx0XHR9KSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmUpO1xuXHRcdGNvbnN0IHJldmlld1N0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGZvcmNlQ2xpY2socmV2aWV3U3RhZ2UpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQ6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuQWNjZXB0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlDYWxscy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8udGV4dENvbnRlbnQsIHNvdXJjZXNHaXRTZXNzaW9uQ2hhbmdlZE1lc3NhZ2UoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NjbSBzbmFwc2hvdCBlbmdpbmUgZGlmZiB3aXRoIHNlc3Npb24gbWlzbWF0Y2ggc3RpbGwgZ2l0LnN0YWdlIGxvY2FsbHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvc2NtLW1pc21hdGNoLXN0YWdlLnRzJyk7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdGdpdENvbW1hbmRzLnB1c2goU3RyaW5nKGNvbW1hbmRJZCkpO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzQ2hhbmdlc01vZGVsLCB7XG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdGdldFNuYXBzaG90OiAoKSA9PiAoe1xuXHRcdFx0XHRnZW5lcmF0aW9uOiAxLFxuXHRcdFx0XHRzZXR0bGVkOiB0cnVlLFxuXHRcdFx0XHRzdGF0ZTogeyBraW5kOiAnc2NtJyB9LFxuXHRcdFx0XHRlbnRyaWVzOiBbXSxcblx0XHRcdH0pLFxuXHRcdFx0aXNXcml0ZUNsb3NlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRpc0ZpbGVEaWZmT3BlblNraXBwZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0cmVmcmVzaDogYXN5bmMgKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0c2NoZWR1bGVSZWZyZXNoOiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRmbHVzaFNjaGVkdWxlZFJlZnJlc2g6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNDaGFuZ2VzTW9kZWwpO1xuXHRcdGNvbnN0IHNjbVJlc291cmNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCBzY20gPSBhY2Nlc3Nvci5nZXQoSVNDTVNlcnZpY2UpO1xuXHRcdFx0cmV0dXJuIFsuLi5zY20ucmVwb3NpdG9yaWVzXVswXT8ucHJvdmlkZXIuZ3JvdXBzWzBdPy5yZXNvdXJjZXNbMF07XG5cdFx0fSk7XG5cdFx0aWYgKCFzY21SZXNvdXJjZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdTQ00gZml4dHVyZSBtaXNzaW5nJyk7XG5cdFx0fVxuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogVVJJLmZyb20oeyBzY2hlbWU6ICdzb3VyY2VzLWdpdC1kaWZmJywgcGF0aDogJy9tb2RpZmllZC9zY20tbWlzbWF0Y2gudHMnIH0pLFxuXHRcdFx0XHRvcmlnaW5hbDogVVJJLmZyb20oeyBzY2hlbWU6ICdzb3VyY2VzLWdpdC1kaWZmJywgcGF0aDogJy9vcmlnaW5hbC9zY20tbWlzbWF0Y2gudHMnIH0pLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRvcmlnaW46ICdlbmdpbmUnLFxuXHRcdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLW9sZCcsXG5cdFx0XHRcdGdpdFBhdGg6ICdzcmMvc2NtLW1pc21hdGNoLXN0YWdlLnRzJyxcblx0XHRcdFx0c2NtUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXHRcdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0Q29tbWFuZHMsIFsnZ2l0LnN0YWdlJ10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZW5naW5lIGRpZmYgc3RhZ2Ugd2l0aCBhbiBlbXB0eSBnaXRQYXRoIGRvZXMgbm90IHNlbmQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoeyB0aHJvd09uTG9hZDogdHJ1ZSwgY29ubmVjdGlvbiB9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0fSkpO1xuXHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0bW9kaWZpZWQ6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvbW9kaWZpZWQvZW1wdHkudHMnIH0pLFxuXHRcdFx0b3JpZ2luYWw6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvb3JpZ2luYWwvZW1wdHkudHMnIH0pLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLFxuXHRcdFx0Z2l0UGF0aDogJycsXG5cdFx0fSk7XG5cdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWN0aW9uLW5vdGljZScpPy50ZXh0Q29udGVudCwgc291cmNlc0dpdEVtcHR5U3RhZ2VQYXRoTWVzc2FnZSgpKTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZURpZmYgc3RhZ2UgdXNlcyBjb3BpZWQgZ2l0UGF0aCBhbmQgbWF0Y2hlcyBzdGlsbCBpbmNsdWRlcyBncm91cElkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZmlsZWRpZmYtc3RhZ2UudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2ZpbGVkaWZmLXN0YWdlLnRzJyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnVW5zdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2ZpbGVkaWZmLXN0YWdlLnRzJyxcblx0XHRcdGluZGV4U3RhdGU6ICdXT1JLVFJFRScsXG5cdFx0XHRraW5kOiAnTU9ESUZJRUQnLFxuXHRcdH07XG5cdFx0bGV0IHNob3duOiBJU291cmNlc0NoYW5nZVJlZiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RlbHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHRcdGNvbnN0IG9wZW5lZCA9IGF3YWl0IG9wZW5Tb3VyY2VzQ2hhbmdlRW50cnkoZW50cnksIHtcblx0XHRcdGNvbW1hbmRTZXJ2aWNlOiBOdWxsQ29tbWFuZFNlcnZpY2UsXG5cdFx0XHRlZGl0b3JTZXJ2aWNlOiB7IG9wZW5FZGl0b3I6IGFzeW5jICgpID0+IHVuZGVmaW5lZCB9IGFzIHVua25vd24gYXMgSUVkaXRvclNlcnZpY2UsXG5cdFx0XHRxdWlja0RpZmZTZXJ2aWNlOiB7IGdldFF1aWNrRGlmZnM6IGFzeW5jICgpID0+IFtdIH0gYXMgdW5rbm93biBhcyBJUXVpY2tEaWZmU2VydmljZSxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKHsgJ3NvdXJjZXMuZGlmZi5kZWZhdWx0T3duZXInOiAncGFuZWwnIH0pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IHtcblx0XHRcdFx0Y3JlYXRlSW5zdGFuY2U6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdwYW5lbCBvcGVuIG11c3Qgbm90IGNyZWF0ZSBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQnKTsgfSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJU291cmNlc0NoYW5nZUVudHJ5T3BlbkRlcHNbJ2luc3RhbnRpYXRpb25TZXJ2aWNlJ10sXG5cdFx0XHRzb3VyY2VzRGlmZlBhbmVsU2VydmljZToge1xuXHRcdFx0XHRzaG93OiBhc3luYyAocmVmOiBJU291cmNlc0NoYW5nZVJlZikgPT4ge1xuXHRcdFx0XHRcdHNob3duID0gcmVmO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRcdG1vZGVsU2VydmljZToge1xuXHRcdFx0XHRnZXRNb2RlbDogKHVyaTogVVJJKSA9PiBtb2RlbHMuaGFzKHVyaS50b1N0cmluZygpKSA/IHsgdXJpIH0gOiBudWxsLFxuXHRcdFx0XHR1cGRhdGVNb2RlbDogKG1vZGVsOiB7IHVyaTogVVJJIH0sIHZhbHVlOiBzdHJpbmcpID0+IHsgbW9kZWxzLnNldChtb2RlbC51cmkudG9TdHJpbmcoKSwgdmFsdWUpOyB9LFxuXHRcdFx0XHRjcmVhdGVNb2RlbDogKHZhbHVlOiBzdHJpbmcsIF9sYW5ndWFnZTogdW5rbm93biwgdXJpPzogVVJJKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnNldCh1cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4geyB1cmkgfTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJTW9kZWxTZXJ2aWNlLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRcdHBhdGg6ICdzcmMvZmlsZWRpZmYtc3RhZ2UudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlbmVkLCB0cnVlKTtcblx0XHRpZiAoIXNob3duKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ZpbGVEaWZmIHJlZiBtaXNzaW5nJyk7XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bi5naXRQYXRoLCAnc3JjL2ZpbGVkaWZmLXN0YWdlLnRzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3duLm9yaWdpbiwgJ2VuZ2luZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bi5zZXNzaW9uSWQsICdzZXNzaW9uLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvd24uaW5kZXhTdGF0ZSwgJ1dPUktUUkVFJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3duLmtpbmQsICdNT0RJRklFRCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bi5tb2RpZmllZC5zY2hlbWUsICdzb3VyY2VzLWdpdC1kaWZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3duLm9yaWdpbmFsPy5zY2hlbWUsICdzb3VyY2VzLWdpdC1kaWZmJyk7XG5cblx0XHRjb25zdCBpZGVudGl0eSA9IHtcblx0XHRcdG9yaWdpbjogc2hvd24ub3JpZ2luLFxuXHRcdFx0c2Vzc2lvbklkOiBzaG93bi5zZXNzaW9uSWQsXG5cdFx0XHRnaXRQYXRoOiBzaG93bi5naXRQYXRoLFxuXHRcdFx0aW5kZXhTdGF0ZTogc2hvd24uaW5kZXhTdGF0ZSxcblx0XHRcdGtpbmQ6IHNob3duLmtpbmQsXG5cdFx0fTtcblx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHNob3duLm1vZGlmaWVkLCBzaG93bi5vcmlnaW5hbCwgc2hvd24uZ3JvdXBJZCwgaWRlbnRpdHkpKTtcblx0XHRjb25zdCBvdGhlckdyb3VwID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQoc2hvd24ubW9kaWZpZWQsIHNob3duLm9yaWdpbmFsLCAnaW5kZXgnLCBpZGVudGl0eSkpO1xuXHRcdGNvbnN0IG90aGVyUGF0aCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHNob3duLm1vZGlmaWVkLCBzaG93bi5vcmlnaW5hbCwgc2hvd24uZ3JvdXBJZCwgeyAuLi5pZGVudGl0eSwgZ2l0UGF0aDogJ3NyYy9vdGhlci50cycgfSkpO1xuXHRcdGNvbnN0IHNhbWUgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChzaG93bi5tb2RpZmllZCwgc2hvd24ub3JpZ2luYWwsIHNob3duLmdyb3VwSWQsIGlkZW50aXR5KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0Lm1hdGNoZXMob3RoZXJHcm91cCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQubWF0Y2hlcyhvdGhlclBhdGgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0Lm1hdGNoZXMoc2FtZSksIHRydWUpO1xuXG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0Z2l0Q29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHR9KSk7XG5cdFx0dmlldy5yZW5kZXIoKTtcblx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyhzaG93bik7XG5cdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXHRcdGNvbnN0IHBhbmVsU3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlLnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZS5kaXNhYmxlZCwgZmFsc2UpO1xuXHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHNbMF0/LnNlc3Npb25JZCwgJ3Nlc3Npb24tMScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxsc1swXT8uY29tbWFuZHM/LlswXT8uYXJndiwgWydzcmMvZmlsZWRpZmYtc3RhZ2UudHMnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFKU09OLnN0cmluZ2lmeShzdGFnZUNhbGxzWzBdKS5pbmNsdWRlcygnc291cmNlcy1naXQtZGlmZicpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdENvbW1hbmRzLCBbXSk7XG5cblx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblx0XHRhd2FpdCBwYW5lLnNldElucHV0KGlucHV0LCB1bmRlZmluZWQsIE9iamVjdC5jcmVhdGUobnVsbCksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHNbMV0/LnNlc3Npb25JZCwgJ3Nlc3Npb24tMScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxsc1sxXT8uY29tbWFuZHM/LlswXT8uYXJndiwgWydzcmMvZmlsZWRpZmYtc3RhZ2UudHMnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFKU09OLnN0cmluZ2lmeShzdGFnZUNhbGxzWzFdKS5pbmNsdWRlcygnc291cmNlcy1naXQtZGlmZicpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdENvbW1hbmRzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5IGdpdFBhdGggZGlzYWJsZXMgU3RhZ2UsIHNob3dzIHN0YXR1cywgYW5kIGRvZXMgbm90IHNlbmQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0Z2l0Q29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdHN0dWJFbmdpbmVMaXZlQ2hhbmdlc01vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0fSkpO1xuXHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBVUkkuZnJvbSh7IHNjaGVtZTogJ3NvdXJjZXMtZ2l0LWRpZmYnLCBwYXRoOiAnL21vZGlmaWVkL2VtcHR5LXN0YWdlLnRzJyB9KTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvb3JpZ2luYWwvZW1wdHktc3RhZ2UudHMnIH0pO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdG1vZGlmaWVkLFxuXHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnJyxcblx0XHR9KTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2Uuc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRmb3JjZUNsaWNrKHBhbmVsU3RhZ2UpO1xuXHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRDb21tYW5kcywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY3Rpb24tbm90aWNlJyk/LnRleHRDb250ZW50LCBzb3VyY2VzR2l0RW1wdHlTdGFnZVBhdGhNZXNzYWdlKCkpO1xuXG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChtb2RpZmllZCwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScsIHtcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLFxuXHRcdFx0Z2l0UGF0aDogJycsXG5cdFx0fSkpO1xuXHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblx0XHRjb25zdCByZXZpZXdTdGFnZSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlLnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0Zm9yY2VDbGljayhyZXZpZXdTdGFnZSk7XG5cdFx0YXdhaXQgKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdENvbW1hbmRzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW5vdGljZScpPy50ZXh0Q29udGVudCwgc291cmNlc0dpdEVtcHR5U3RhZ2VQYXRoTWVzc2FnZSgpKTtcblx0fSk7XG5cblx0Y29uc3QgYWNjZXB0Q3Vyc29yVW5pZmllZERpZmYgPSBbXG5cdFx0J2RpZmYgLS1naXQgYS9zcmMvYS50cyBiL3NyYy9iLnRzJyxcblx0XHQncmVuYW1lIGZyb20gc3JjL2EudHMnLFxuXHRcdCdyZW5hbWUgdG8gc3JjL2IudHMnLFxuXHRcdCdvbGQgbW9kZSAxMDA2NDQnLFxuXHRcdCduZXcgbW9kZSAxMDA3NTUnLFxuXHRcdCctLS0gYS9zcmMvYS50cycsXG5cdFx0JysrKyBiL3NyYy9iLnRzJyxcblx0XHQnQEAgLTEsMyArMSw0IEBAJyxcblx0XHQnIGxpbmUxJyxcblx0XHQnLW9sZCcsXG5cdFx0JytuZXcnLFxuXHRcdCcrZXh0cmEnLFxuXHRcdCdAQCAtMTAsMiArMTEsMyBAQCcsXG5cdFx0JyBrZWVwJyxcblx0XHQnLWdvbmUnLFxuXHRcdCcrYWRkZWQnLFxuXHRcdCcrbW9yZScsXG5cdFx0J1xcXFwgTm8gbmV3bGluZSBhdCBlbmQgb2YgZmlsZScsXG5cdF0uam9pbignXFxuJyk7XG5cblx0aW50ZXJmYWNlIElBY2NlcHRIdW5rTW91bnQge1xuXHRcdHJlYWRvbmx5IHZpZXc6IFNvdXJjZXNEaWZmUGFuZWxWaWV3O1xuXHRcdHJlYWRvbmx5IHBhbmU6IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lO1xuXHRcdHJlYWRvbmx5IHBhcmVudDogSFRNTEVsZW1lbnQ7XG5cdFx0cmVhZG9ubHkgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXTtcblx0XHRyZWFkb25seSByZWFkQ2FsbHM6IFVuaXZlcnNlQWdlbnRSZWFkR2l0RmlsZURpZmZSZXF1ZXN0W107XG5cdFx0cmVhZG9ubHkgZ2l0Q29tbWFuZHM6IHN0cmluZ1tdO1xuXHRcdHJlYWRvbmx5IHJlZnJlc2hDb3VudDogeyBuOiBudW1iZXIgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIGVuZ2luZUFjY2VwdFJlZihuYW1lOiBzdHJpbmcsIG92ZXJyaWRlczogUGFydGlhbDxJU291cmNlc0NoYW5nZVJlZj4gPSB7fSk6IElTb3VyY2VzQ2hhbmdlUmVmIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bW9kaWZpZWQ6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6IGAvbW9kaWZpZWQvJHtuYW1lfWAgfSksXG5cdFx0XHRvcmlnaW5hbDogVVJJLmZyb20oeyBzY2hlbWU6ICdzb3VyY2VzLWdpdC1kaWZmJywgcGF0aDogYC9vcmlnaW5hbC8ke25hbWV9YCB9KSxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRvcmlnaW46ICdlbmdpbmUnLFxuXHRcdFx0c2Vzc2lvbklkOiAnc2Vzc2lvbi0xJyxcblx0XHRcdGdpdFBhdGg6ICdzcmMvYS50cycsXG5cdFx0XHRpbmRleFN0YXRlOiAnVW5zdGFnZWQnLFxuXHRcdFx0a2luZDogJ01vZGlmaWVkJyxcblx0XHRcdC4uLm92ZXJyaWRlcyxcblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gbW91bnRBY2NlcHRIdW5rSG9zdHModGVzdDogTW9jaGEuQ29udGV4dCwgb3B0aW9uczoge1xuXHRcdHJlZjogSVNvdXJjZXNDaGFuZ2VSZWY7XG5cdFx0bWF0Y2hTY20/OiBib29sZWFuO1xuXHRcdHNjbUdyb3VwSWQ/OiBzdHJpbmc7XG5cdFx0Y29ubmVjdGVkPzogYm9vbGVhbjtcblx0XHRlbmdpbmVTZXNzaW9uUmVhZHk/OiBib29sZWFuO1xuXHRcdHdyaXRlQ2xvc2VkPzogYm9vbGVhbjtcblx0XHRjb3VudFJlZnJlc2g/OiBib29sZWFuO1xuXHRcdHVuaWZpZWREaWZmPzogc3RyaW5nO1xuXHRcdGFwcGx5U3VjY2Vzcz86IGJvb2xlYW47XG5cdFx0YXBwbHlFcnJvck1lc3NhZ2U/OiBzdHJpbmc7XG5cdH0pOiBQcm9taXNlPElBY2NlcHRIdW5rTW91bnQ+IHtcblx0XHRjb25zdCBhcHBseUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgcmVhZENhbGxzOiBVbml2ZXJzZUFnZW50UmVhZEdpdEZpbGVEaWZmUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgZ2l0Q29tbWFuZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgcmVmcmVzaENvdW50ID0geyBuOiAwIH07XG5cdFx0Y29uc3QgdW5pZmllZERpZmYgPSBvcHRpb25zLnVuaWZpZWREaWZmID8/IGFjY2VwdEN1cnNvclVuaWZpZWREaWZmO1xuXHRcdGNvbnN0IGNvbm5lY3RlZCA9IG9wdGlvbnMuY29ubmVjdGVkID8/IHRydWU7XG5cdFx0Y29uc3QgYXBwbHlSZXN1bHQ6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFdyaXRlUmVzdWx0ID0ge1xuXHRcdFx0c3VwcG9ydGVkOiB0cnVlLFxuXHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdHN1Y2Nlc3M6IG9wdGlvbnMuYXBwbHlTdWNjZXNzID8/IHRydWUsXG5cdFx0XHRlcnJvck1lc3NhZ2U6IG9wdGlvbnMuYXBwbHlFcnJvck1lc3NhZ2UgPz8gJycsXG5cdFx0XHRleGl0Q29kZTogb3B0aW9ucy5hcHBseVN1Y2Nlc3MgPT09IGZhbHNlID8gMSA6IDAsXG5cdFx0XHRzdGRvdXQ6ICcnLFxuXHRcdH07XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBjb25uZWN0ZWQsXG5cdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6IGNvbm5lY3RlZCA/ICdjb25uZWN0ZWQnIGFzIGNvbnN0IDogJ2Rpc2Nvbm5lY3RlZCcgYXMgY29uc3QgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHRcdHJlYWRHaXRGaWxlRGlmZjogYXN5bmMgKHJlcXVlc3Q6IFVuaXZlcnNlQWdlbnRSZWFkR2l0RmlsZURpZmZSZXF1ZXN0KSA9PiB7XG5cdFx0XHRcdHJlYWRDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRyZXR1cm4geyBzdXBwb3J0ZWQ6IHRydWUsIHJlYXNvbjogJycsIHBhdGg6IHJlcXVlc3QucGF0aCwgdW5pZmllZERpZmYgfTtcblx0XHRcdH0sXG5cdFx0XHR3cml0ZUdpdEFwcGx5SHVua3M6IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdCkgPT4ge1xuXHRcdFx0XHRhcHBseUNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHJldHVybiBhcHBseVJlc3VsdDtcblx0XHRcdH0sXG5cdFx0XHR3cml0ZUdpdFN0YWdlUGF0aHM6IGFzeW5jICgpID0+IGFwcGx5UmVzdWx0LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0Y29uc3Qgc2NtVXJpID0gb3B0aW9ucy5tYXRjaFNjbSA/IG9wdGlvbnMucmVmLm1vZGlmaWVkIDogdG9SZXNvdXJjZS5jYWxsKHRlc3QsICcvcHJvamVjdC9zcmMvc2NtLXVucmVsYXRlZC50cycpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRyZXNvdXJjZTogc2NtVXJpLFxuXHRcdFx0Z3JvdXBJZDogb3B0aW9ucy5zY21Hcm91cElkID8/ICd3b3JraW5nVHJlZScsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBvcHRpb25zLmVuZ2luZVNlc3Npb25SZWFkeSA/PyB0cnVlLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0Z2l0Q29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGlmIChvcHRpb25zLndyaXRlQ2xvc2VkIHx8IG9wdGlvbnMuY291bnRSZWZyZXNoKSB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzQ2hhbmdlc01vZGVsLCB7XG5cdFx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRnZXRTbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0XHRnZW5lcmF0aW9uOiAxLFxuXHRcdFx0XHRcdHNldHRsZWQ6IHRydWUsXG5cdFx0XHRcdFx0c3RhdGU6IG9wdGlvbnMud3JpdGVDbG9zZWRcblx0XHRcdFx0XHRcdD8geyBraW5kOiAnZW5naW5lLWxlZnRvdmVyJywgc2Vzc2lvbklkOiAnc2Vzc2lvbi0xJywgcmVhc29uOiAncmVhZC1mYWlsZWQnIH1cblx0XHRcdFx0XHRcdDogeyBraW5kOiAnc2NtJyB9LFxuXHRcdFx0XHRcdGVudHJpZXM6IFtdLFxuXHRcdFx0XHR9KSxcblx0XHRcdFx0aXNXcml0ZUNsb3NlZDogKCkgPT4gISFvcHRpb25zLndyaXRlQ2xvc2VkLFxuXHRcdFx0XHRpc0ZpbGVEaWZmT3BlblNraXBwZWQ6ICgpID0+ICEhb3B0aW9ucy53cml0ZUNsb3NlZCxcblx0XHRcdFx0cmVmcmVzaDogYXN5bmMgKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0XHRzY2hlZHVsZVJlZnJlc2g6ICgpID0+IHsgcmVmcmVzaENvdW50Lm4rKzsgfSxcblx0XHRcdFx0Zmx1c2hTY2hlZHVsZWRSZWZyZXNoOiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNDaGFuZ2VzTW9kZWwpO1xuXHRcdH1cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0fSkpO1xuXHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3cob3B0aW9ucy5yZWYpO1xuXHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQob3B0aW9ucy5yZWYubW9kaWZpZWQsIG9wdGlvbnMucmVmLm9yaWdpbmFsLCBvcHRpb25zLnJlZi5ncm91cElkLCB7XG5cdFx0XHRvcmlnaW46IG9wdGlvbnMucmVmLm9yaWdpbixcblx0XHRcdHNlc3Npb25JZDogb3B0aW9ucy5yZWYuc2Vzc2lvbklkLFxuXHRcdFx0Z2l0UGF0aDogb3B0aW9ucy5yZWYuZ2l0UGF0aCxcblx0XHRcdGluZGV4U3RhdGU6IG9wdGlvbnMucmVmLmluZGV4U3RhdGUsXG5cdFx0XHRraW5kOiBvcHRpb25zLnJlZi5raW5kLFxuXHRcdH0pKTtcblx0XHRhd2FpdCBwYW5lLnNldElucHV0KGlucHV0LCB1bmRlZmluZWQsIE9iamVjdC5jcmVhdGUobnVsbCksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cdFx0cmV0dXJuIHsgdmlldywgcGFuZSwgcGFyZW50LCBhcHBseUNhbGxzLCByZWFkQ2FsbHMsIGdpdENvbW1hbmRzLCByZWZyZXNoQ291bnQgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIHBpbkFjY2VwdEN1cnNvcihob3N0OiBvYmplY3QsIGxpbmU6IG51bWJlciwgc2lkZTogJ25ldycgfCAnb2xkJyA9ICduZXcnKTogdm9pZCB7XG5cdFx0KGhvc3QgYXMgeyBhY2NlcHRDdXJzb3I6IHsgc2lkZTogJ25ldycgfCAnb2xkJzsgbGluZTogbnVtYmVyIH0gfSkuYWNjZXB0Q3Vyc29yID0geyBzaWRlLCBsaW5lIH07XG5cdH1cblxuXHRmdW5jdGlvbiBhY2NlcHRCdXR0b25EaXNwbGF5KHJvb3Q6IHsgcXVlcnlTZWxlY3RvcihzZWxlY3Rvcjogc3RyaW5nKTogRWxlbWVudCB8IG51bGwgfSwgc2VsZWN0b3I6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIChyb290LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXkgPz8gJ21pc3NpbmcnO1xuXHR9XG5cblx0ZnVuY3Rpb24gd3JpdGVHcm91cElkKGhvc3Q6IG9iamVjdCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIChob3N0IGFzIHsgY3VycmVudFdyaXRlRmFjdHMoKTogeyBncm91cElkOiBzdHJpbmcgfSB8IHVuZGVmaW5lZCB9KS5jdXJyZW50V3JpdGVGYWN0cygpPy5ncm91cElkID8/ICcnO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gcnVuQm90aEFjY2VwdChoYXJuZXNzOiBJQWNjZXB0SHVua01vdW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgKGhhcm5lc3MudmlldyBhcyB1bmtub3duIGFzIHsgcnVuQWNjZXB0OiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkFjY2VwdCgpO1xuXHRcdGF3YWl0IChoYXJuZXNzLnBhbmUgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydEFjY2VwdEhpZGRlbihoYXJuZXNzOiBJQWNjZXB0SHVua01vdW50KTogdm9pZCB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2VwdEJ1dHRvbkRpc3BsYXkoaGFybmVzcy52aWV3LmVsZW1lbnQsICcuc291cmNlcy1kaWZmLXBhbmVsLWFjY2VwdCcpLCAnbm9uZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2NlcHRCdXR0b25EaXNwbGF5KGhhcm5lc3MucGFyZW50LCAnLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1hY2NlcHQnKSwgJ25vbmUnKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydEFjY2VwdFNob3duKGhhcm5lc3M6IElBY2NlcHRIdW5rTW91bnQpOiB2b2lkIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXB0QnV0dG9uRGlzcGxheShoYXJuZXNzLnZpZXcuZWxlbWVudCwgJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWNjZXB0JyksICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXB0QnV0dG9uRGlzcGxheShoYXJuZXNzLnBhcmVudCwgJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctYWNjZXB0JyksICcnKTtcblx0fVxuXG5cdHRlc3QoJ2VsaWdpYmxlIE1vZGlmaWVkIFdPUktUUkVFIHJvdyBzaG93cyBBY2NlcHQgb24gYm90aCBkaWZmIGhvc3RzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LXdvcmt0cmVlJywgeyBpbmRleFN0YXRlOiAnV09SS1RSRUUnLCBraW5kOiAnTW9kaWZpZWQnIH0pLFxuXHRcdH0pO1xuXHRcdGFzc2VydEFjY2VwdFNob3duKGhhcm5lc3MpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdGFnZWRBbmRVbnN0YWdlZCBzdGlsbCBzaG93cyBBY2NlcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtYm90aCcsIHsgaW5kZXhTdGF0ZTogJ1N0YWdlZEFuZFVuc3RhZ2VkJywga2luZDogJ01vZGlmaWVkJyB9KSxcblx0XHR9KTtcblx0XHRhc3NlcnRBY2NlcHRTaG93bihoYXJuZXNzKTtcblx0fSk7XG5cblx0dGVzdCgnY29uZmxpY3QgbGFiZWxlZCB3b3JraW5nVHJlZSBoaWRlcyBBY2NlcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hY2NlcHQtY29uZmxpY3QudHMnKTtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiB7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWw6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2FjY2VwdC1jb25mbGljdC50cy5naXQnKSxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdFx0c2Vzc2lvbklkOiAnc2Vzc2lvbi0xJyxcblx0XHRcdFx0Z2l0UGF0aDogJ3NyYy9hLnRzJyxcblx0XHRcdFx0aW5kZXhTdGF0ZTogJ1Vuc3RhZ2VkJyxcblx0XHRcdFx0a2luZDogJ0NvbmZsaWN0Jyxcblx0XHRcdH0sXG5cdFx0XHRtYXRjaFNjbTogdHJ1ZSxcblx0XHRcdHNjbUdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdyaXRlR3JvdXBJZChoYXJuZXNzLnZpZXcpLCAnd29ya2luZ1RyZWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod3JpdGVHcm91cElkKGhhcm5lc3MucGFuZSksICd3b3JraW5nVHJlZScpO1xuXHRcdGFzc2VydEFjY2VwdEhpZGRlbihoYXJuZXNzKTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy52aWV3LCA1KTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy5wYW5lLCA1KTtcblx0XHRhd2FpdCBydW5Cb3RoQWNjZXB0KGhhcm5lc3MpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5yZWFkQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuYXBwbHlDYWxscywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCd1bnRyYWNrZWQgcm93IGhpZGVzIEFjY2VwdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC11bnRyYWNrZWQnLCB7IGtpbmQ6ICdVbnRyYWNrZWQnLCBpbmRleFN0YXRlOiAnVW5zdGFnZWQnIH0pLFxuXHRcdH0pO1xuXHRcdGFzc2VydEFjY2VwdEhpZGRlbihoYXJuZXNzKTtcblx0fSk7XG5cblx0dGVzdCgnZnVsbHkgc3RhZ2VkIHJvdyBsYWJlbGVkIHdvcmtpbmdUcmVlIGhpZGVzIEFjY2VwdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2FjY2VwdC1zdGFnZWQudHMnKTtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiB7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWw6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2FjY2VwdC1zdGFnZWQudHMuZ2l0JyksXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRcdGdpdFBhdGg6ICdzcmMvYS50cycsXG5cdFx0XHRcdGluZGV4U3RhdGU6ICdTdGFnZWQnLFxuXHRcdFx0XHRraW5kOiAnTW9kaWZpZWQnLFxuXHRcdFx0fSxcblx0XHRcdG1hdGNoU2NtOiB0cnVlLFxuXHRcdFx0c2NtR3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod3JpdGVHcm91cElkKGhhcm5lc3MudmlldyksICd3b3JraW5nVHJlZScpO1xuXHRcdGFzc2VydEFjY2VwdEhpZGRlbihoYXJuZXNzKTtcblx0fSk7XG5cblx0dGVzdCgnZ3JvdXBJZCBpbmRleCB3aXRoIE1vZGlmaWVkIFVuc3RhZ2VkIHN0aWxsIHNob3dzIEFjY2VwdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC1pbmRleCcsIHsgZ3JvdXBJZDogJ2luZGV4Jywga2luZDogJ01vZGlmaWVkJywgaW5kZXhTdGF0ZTogJ1Vuc3RhZ2VkJyB9KSxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod3JpdGVHcm91cElkKGhhcm5lc3MudmlldyksICdpbmRleCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3cml0ZUdyb3VwSWQoaGFybmVzcy5wYW5lKSwgJ2luZGV4Jyk7XG5cdFx0YXNzZXJ0QWNjZXB0U2hvd24oaGFybmVzcyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Rpc2Nvbm5lY3RlZCBlbmdpbmUgaGlkZXMgQWNjZXB0IG9uIGFuIGVsaWdpYmxlIHJvdycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC1vZmZsaW5lJyksXG5cdFx0XHRjb25uZWN0ZWQ6IGZhbHNlLFxuXHRcdH0pO1xuXHRcdGFzc2VydEFjY2VwdEhpZGRlbihoYXJuZXNzKTtcblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgZW5naW5lIHBhdGggaGlkZXMgQWNjZXB0IGFuZCBkb2VzIG5vdCByZWFkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LWVtcHR5LXBhdGgnLCB7IGdpdFBhdGg6ICcnIH0pLFxuXHRcdH0pO1xuXHRcdGFzc2VydEFjY2VwdEhpZGRlbihoYXJuZXNzKTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy52aWV3LCA1KTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy5wYW5lLCA1KTtcblx0XHRhd2FpdCBydW5Cb3RoQWNjZXB0KGhhcm5lc3MpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5yZWFkQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuYXBwbHlDYWxscywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdlbXB0eSBwaW5uZWQgc2Vzc2lvbiBoaWRlcyBBY2NlcHQgYW5kIGRvZXMgbm90IHJlYWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtZW1wdHktc2Vzc2lvbicsIHsgc2Vzc2lvbklkOiAnJyB9KSxcblx0XHR9KTtcblx0XHRhc3NlcnRBY2NlcHRIaWRkZW4oaGFybmVzcyk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MudmlldywgNSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MucGFuZSwgNSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MucmVhZENhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnQWNjZXB0IGNsaWNrIHJlYWRzIFVuc3RhZ2VkIGRpZmYgYW5kIGFwcGxpZXMgb25seSB0aGUgY3Vyc29yIGh1bmsnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtY2xpY2snLCB7IGluZGV4U3RhdGU6ICdXT1JLVFJFRScsIGtpbmQ6ICdNb2RpZmllZCcgfSksXG5cdFx0XHRjb3VudFJlZnJlc2g6IHRydWUsXG5cdFx0fSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MudmlldywgNSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MucGFuZSwgNSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnJlYWRDYWxscy5sZW5ndGgsIDIpO1xuXHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiBoYXJuZXNzLnJlYWRDYWxscykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcXVlc3Quc2Vzc2lvbklkLCAnc2Vzc2lvbi0xJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVxdWVzdC5wYXRoLCAnc3JjL2EudHMnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXF1ZXN0LmluZGV4U3RhdGUsICdVbnN0YWdlZCcpO1xuXHRcdH1cblx0XHRjb25zdCBleHBlY3RlZCA9IHNvdXJjZXNHaXRIdW5rUGF0Y2hBdEN1cnNvcihhY2NlcHRDdXJzb3JVbmlmaWVkRGlmZiwgNSwgJ25ldycpO1xuXHRcdGFzc2VydC5vayhleHBlY3RlZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MuYXBwbHlDYWxscy5sZW5ndGgsIDIpO1xuXHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiBoYXJuZXNzLmFwcGx5Q2FsbHMpIHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoWy4uLnJlcXVlc3QuYXJndl0sIFsnZ2l0JywgJ2FwcGx5JywgJy0tY2FjaGVkJywgJy0td2hpdGVzcGFjZT1ub3dhcm4nXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFsuLi5yZXF1ZXN0LmFyZ3ZdLCBbLi4uU09VUkNFU19HSVRfQVBQTFlfQ0FDSEVEX0FSR1ZdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXF1ZXN0LnBhdGNoZXMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXF1ZXN0LnBhdGNoZXNbMF0sIGV4cGVjdGVkKTtcblx0XHRcdGFzc2VydC5vayhyZXF1ZXN0LnBhdGNoZXNbMF0/LmluY2x1ZGVzKCdyZW5hbWUgZnJvbSBzcmMvYS50cycpKTtcblx0XHRcdGFzc2VydC5vayhyZXF1ZXN0LnBhdGNoZXNbMF0/LmluY2x1ZGVzKCdvbGQgbW9kZSAxMDA2NDQnKSk7XG5cdFx0XHRhc3NlcnQub2socmVxdWVzdC5wYXRjaGVzWzBdPy5pbmNsdWRlcygnbmV3IG1vZGUgMTAwNzU1JykpO1xuXHRcdFx0YXNzZXJ0Lm9rKHJlcXVlc3QucGF0Y2hlc1swXT8uaW5jbHVkZXMoJ0BAIC0xMCwyICsxMSwzIEBAJykpO1xuXHRcdFx0YXNzZXJ0Lm9rKHJlcXVlc3QucGF0Y2hlc1swXT8uaW5jbHVkZXMoJ1xcXFwgTm8gbmV3bGluZSBhdCBlbmQgb2YgZmlsZScpKTtcblx0XHRcdGFzc2VydC5vayghcmVxdWVzdC5wYXRjaGVzWzBdPy5pbmNsdWRlcygnQEAgLTEsMyArMSw0IEBAJykpO1xuXHRcdH1cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuZ2l0Q29tbWFuZHMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5yZWZyZXNoQ291bnQubiwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvciBvdXRzaWRlIGV2ZXJ5IGh1bmsgcmVhZHMgb25jZSBwZXIgaG9zdCBhbmQgZG9lcyBub3QgYXBwbHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtbWlzcycpLFxuXHRcdFx0Y291bnRSZWZyZXNoOiB0cnVlLFxuXHRcdH0pO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnZpZXcsIDk5KTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy5wYW5lLCA5OSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5yZWFkQ2FsbHMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuYXBwbHlDYWxscywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnJlZnJlc2hDb3VudC5uLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy52aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY3Rpb24tbm90aWNlJyk/LnRleHRDb250ZW50LCBzb3VyY2VzRGlmZkFjY2VwdFVuYXZhaWxhYmxlTWVzc2FnZSgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5wYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8udGV4dENvbnRlbnQsIHNvdXJjZXNEaWZmQWNjZXB0VW5hdmFpbGFibGVNZXNzYWdlKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdiaW5hcnkgZGlmZiBkb2VzIG5vdCBhcHBseScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC1iaW5hcnknKSxcblx0XHRcdHVuaWZpZWREaWZmOiAnZGlmZiAtLWdpdCBhL2EuYmluIGIvYS5iaW5cXG5CaW5hcnkgZmlsZXMgYS9hLmJpbiBhbmQgYi9hLmJpbiBkaWZmZXJcXG4nLFxuXHRcdH0pO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnZpZXcsIDEpO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnBhbmUsIDEpO1xuXHRcdGF3YWl0IHJ1bkJvdGhBY2NlcHQoaGFybmVzcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucmVhZENhbGxzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnbWlzc2luZyBjdXJzb3IgZG9lcyBub3QgcmVhZCBvciBhcHBseScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC1uby1jdXJzb3InKSxcblx0XHRcdGNvdW50UmVmcmVzaDogdHJ1ZSxcblx0XHR9KTtcblx0XHRhd2FpdCBydW5Cb3RoQWNjZXB0KGhhcm5lc3MpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5yZWFkQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuYXBwbHlDYWxscywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnJlZnJlc2hDb3VudC5uLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnd3JpdGUgY2xvc2VkIEFjY2VwdCBzZW5kcyBubyBSZWFkR2l0RmlsZURpZmYgYW5kIG5vIEFwcGx5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LWNsb3NlZCcpLFxuXHRcdFx0d3JpdGVDbG9zZWQ6IHRydWUsXG5cdFx0XHRjb3VudFJlZnJlc2g6IHRydWUsXG5cdFx0fSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MudmlldywgNSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MucGFuZSwgNSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MucmVhZENhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5yZWZyZXNoQ291bnQubiwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmdpdENvbW1hbmRzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VuZ2luZSBzZXNzaW9uIG5vdCByZWFkeSBzZW5kcyBubyBSZWFkR2l0RmlsZURpZmYgYW5kIG5vIEFwcGx5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LW5vdC1yZWFkeScpLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBmYWxzZSxcblx0XHR9KTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy52aWV3LCA1KTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy5wYW5lLCA1KTtcblx0XHRhd2FpdCBydW5Cb3RoQWNjZXB0KGhhcm5lc3MpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5yZWFkQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuYXBwbHlDYWxscywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5naXRDb21tYW5kcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdlbmdpbmUgc3VjY2VzcyBmYWxzZSBzaG93cyBlcnJvcl9tZXNzYWdlIGFuZCBkb2VzIG5vdCByZWZyZXNoJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LWRlbmllZCcsIHsgaW5kZXhTdGF0ZTogJ1dPUktUUkVFJyB9KSxcblx0XHRcdGNvdW50UmVmcmVzaDogdHJ1ZSxcblx0XHRcdGFwcGx5U3VjY2VzczogZmFsc2UsXG5cdFx0XHRhcHBseUVycm9yTWVzc2FnZTogJ2FwcGx5IGRlbmllZCcsXG5cdFx0fSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MudmlldywgNSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MucGFuZSwgNSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5hcHBseUNhbGxzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Mudmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWN0aW9uLW5vdGljZScpPy50ZXh0Q29udGVudCwgJ2FwcGx5IGRlbmllZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW5vdGljZScpPy50ZXh0Q29udGVudCwgJ2FwcGx5IGRlbmllZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnJlZnJlc2hDb3VudC5uLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuZ2l0Q29tbWFuZHMsIFtdKTtcblx0fSk7XG59KTtcblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsZUFBZTtBQUN4QixTQUFTLGNBQWMsaUNBQWlDO0FBQ3hELFNBQVMsV0FBVztBQUNwQixTQUFTLHlDQUF5QyxrQkFBa0I7QUFDcEUsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhLFFBQVEsb0JBQW9CO0FBQ2xELFNBQVMsa0JBQWtCLHVCQUF1QjtBQUNsRCxTQUEwRCwwQkFBMEI7QUFHcEYsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyx5QkFBeUIsa0NBQWtDO0FBQ3BFLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsY0FBYyx5QkFBeUIsY0FBYyxnQkFBOEQsd0JBQTRELDZCQUE2QjtBQUNyTixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLCtCQUErQixxQkFBcUIsaUJBQWlCLHdCQUF3QjtBQUN0RyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUF1QixtQkFBbUI7QUFDMUMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxnQ0FBZ0M7QUFJekMsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBc0MsOEJBQThCO0FBQ3BFLFNBQVMsNENBQTRDO0FBQ3JELFNBQVMsZ0RBQWdELHNDQUFzQyxpREFB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
