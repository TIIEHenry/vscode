import assert from "assert";
import { NullCommandService } from "../../../../../platform/commands/test/common/nullCommandService.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { DeferredPromise, timeout } from "../../../../../base/common/async.js";
import { errorHandler, setUnexpectedErrorHandler } from "../../../../../base/common/errors.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { localize } from "../../../../../nls.js";
import { isIMenuItem, MenuId, MenuRegistry } from "../../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { emptyProgressRunner, IEditorProgressService } from "../../../../../platform/progress/common/progress.js";
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
import { IModelService } from "../../../../../editor/common/services/model.js";
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
import { canSendSourcesGitApplyHunks, canSendSourcesGitStagePaths, canShowSourcesReviewAccept, isSourcesChangesWriteClosed, resolveSourcesDiffWriteActions, sourcesGitEmptyStagePathMessage, sourcesGitSessionChangedMessage } from "../../common/sourcesChangesGitWrite.js";
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
  suite("Accept post-read authorization", () => {
    const validDiff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,2 +1,2 @@",
      " line1",
      "-old",
      "+new"
    ].join("\n");
    const accepted = {
      supported: true,
      reason: "",
      success: true,
      errorMessage: "",
      exitCode: 0,
      stdout: ""
    };
    const expectedRead = { sessionId: "session-1", path: "src/a.ts", indexState: "Unstaged" };
    const expectedApply = {
      sessionId: "session-1",
      argv: ["git", "apply", "--cached", "--whitespace=nowarn"],
      patches: [validDiff + "\n"]
    };
    async function mountAuthorizationHost(kind, deferApply = false) {
      const state = {
        activeSessionId: "session-1",
        connected: true,
        pairingHold: false,
        readiness: "ready",
        gitReadFailed: false,
        applySupported: true,
        hasApplyHook: true
      };
      const readStarted = new DeferredPromise();
      const readResult = new DeferredPromise();
      const applyStarted = new DeferredPromise();
      const applyResult = new DeferredPromise();
      store.add({ dispose: () => {
        void readResult.complete();
        void applyResult.complete(accepted);
      } });
      const reads = [];
      const applies = [];
      const commands = [];
      let refreshes = 0;
      const connectionChanged = store.add(new Emitter());
      const sessionChanged = store.add(new Emitter());
      const changesChanged = store.add(new Emitter());
      const apply = async (request) => {
        applies.push(request);
        void applyStarted.complete();
        return deferApply ? applyResult.p : accepted;
      };
      const connection = {
        isEngineConnected: () => state.connected,
        getConnectionPhase: () => ({ kind: state.connected ? "connected" : "disconnected" }),
        getConnectionSnapshot: () => ({
          pairingPending: state.pairingHold,
          gitWriteCapability: {
            writeGitStagePaths: "SUPPORTED",
            writeGitCommit: "SUPPORTED",
            writeGitApplyHunks: state.applySupported ? "SUPPORTED" : "UNSUPPORTED"
          }
        }),
        onDidChangeConnection: connectionChanged.event,
        readGitFileDiff: async (request) => {
          reads.push(request);
          void readStarted.complete();
          await readResult.p;
          return { supported: true, reason: "", path: request.path, unifiedDiff: validDiff };
        },
        get writeGitApplyHunks() {
          return state.hasApplyHook ? apply : void 0;
        }
      };
      const session = {
        _serviceBrand: void 0,
        getActiveSessionId: () => state.activeSessionId,
        isEngineSessionReady: () => state.readiness === "ready",
        getEngineSessionReadiness: () => state.readiness,
        isPairingHold: () => state.pairingHold,
        onDidChangeActiveSession: sessionChanged.event,
        onDidChangeSession: sessionChanged.event,
        acquireSessionView: () => {
          throw new Error("not used");
        }
      };
      const snapshot = () => ({
        generation: 1,
        settled: true,
        state: state.gitReadFailed ? { kind: "engine-leftover", sessionId: "session-1", reason: "read-failed" } : { kind: "engine-live", sessionId: "session-1" },
        entries: []
      });
      const changes = {
        _serviceBrand: void 0,
        onDidChange: changesChanged.event,
        getSnapshot: snapshot,
        isWriteClosed: () => isSourcesChangesWriteClosed(snapshot().state, {
          phaseConnected: state.connected,
          pairingPending: state.pairingHold,
          engineConnected: state.connected,
          engineSessionReady: state.readiness === "ready"
        }),
        isFileDiffOpenSkipped: () => state.pairingHold || state.gitReadFailed,
        refresh: async () => {
        },
        scheduleRefresh: () => {
          refreshes++;
        },
        flushScheduledRefresh: () => {
        }
      };
      const instantiation = workbenchInstantiationService(void 0, store);
      instantiation.stub(IDiffProviderFactoryService, new TestDiffProviderFactoryService());
      instantiation.stub(IUserInteractionService, new MockUserInteractionService());
      instantiation.stub(IViewDescriptorService, createViewDescriptorServiceStub());
      instantiation.stub(IEditorProgressService, {
        _serviceBrand: void 0,
        show: () => emptyProgressRunner,
        showWhile: async (promise) => {
          await promise;
        }
      });
      instantiation.stub(IUniverseAgentConnection, connection);
      instantiation.stub(IAgentSessionContext, session);
      instantiation.stub(ISourcesChangesModel, changes);
      instantiation.stub(ICommandService, {
        ...NullCommandService,
        executeCommand: async (id) => {
          commands.push(id);
          return void 0;
        }
      });
      instantiation.stub(IViewsService, {
        openView: async () => null,
        onDidChangeViewVisibility: Event.None,
        onDidChangeViewContainerVisibility: Event.None
      });
      const ref = {
        modified: URI.parse("inmemory://accept-authorization/modified"),
        original: URI.parse("inmemory://accept-authorization/original"),
        groupId: "workingTree",
        origin: "engine",
        sessionId: "session-1",
        gitPath: "src/a.ts",
        indexState: "Unstaged",
        kind: "Modified"
      };
      instantiation.stub(ISCMService, createLeftoverScmService(ref.modified));
      const models = instantiation.get(IModelService);
      const resolver = instantiation.get(ITextModelService);
      const seed = async (value) => {
        assert.ok(value.original);
        if (!models.getModel(value.original)) {
          store.add(models.createModel("line1\nold", null, value.original));
        }
        if (!models.getModel(value.modified)) {
          store.add(models.createModel("line1\nnew", null, value.modified));
        }
        store.add(await resolver.createModelReference(value.original));
        store.add(await resolver.createModelReference(value.modified));
      };
      const parent = document.createElement("div");
      document.body.appendChild(parent);
      store.add({ dispose: () => parent.remove() });
      const panelService = store.add(instantiation.createInstance(SourcesDiffPanelService));
      instantiation.stub(ISourcesDiffPanelService, panelService);
      let pane;
      let panel;
      const input = store.add(new ConversationDiffReviewInput(ref.modified, ref.original, ref.groupId, ref));
      if (kind === "Pane") {
        pane = store.add(instantiation.createInstance(ConversationDiffReviewPane, new TestEditorGroupView(0)));
        pane.create(parent);
        await seed(ref);
        await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
        assert.strictEqual(pane.didComparisonLoadFail(), false);
      } else {
        panel = store.add(instantiation.createInstance(SourcesDiffPanelView, { id: SOURCES_DIFF_PANEL_VIEW_ID, title: "Diff" }));
        panel.render();
        parent.appendChild(panel.element);
        await seed(ref);
        assert.strictEqual(await panelService.show(ref), true);
      }
      const host = pane ?? panel;
      pinAcceptCursor(host, 2);
      const button = parent.querySelector(kind === "Pane" ? ".conversation-diff-review-accept" : ".sources-diff-panel-accept");
      assert.ok(button instanceof HTMLButtonElement);
      assert.strictEqual(button.style.display, "");
      const notice = parent.querySelector(kind === "Pane" ? ".conversation-diff-review-notice" : ".sources-diff-panel-action-notice");
      assert.ok(notice instanceof HTMLElement);
      const run = () => host.runAccept();
      const waitFor = async (started, operation) => {
        await Promise.race([started.p, operation.then(() => {
          throw new Error("Accept returned before the expected RPC started");
        })]);
      };
      return {
        state,
        reads,
        applies,
        commands,
        notice,
        input,
        readResult,
        applyResult,
        applyStarted,
        run,
        waitForRead: (operation) => waitFor(readStarted, operation),
        waitForApply: (operation) => waitFor(applyStarted, operation),
        notify: () => {
          sessionChanged.fire(state.activeSessionId);
          connectionChanged.fire();
          changesChanged.fire();
        },
        projection: () => ({ reads, applies, commands, refreshes }),
        readGates: () => {
          const current = snapshot().state;
          return { catalog: session.getEngineSessionReadiness(), gitState: current.kind, gitReason: current.kind === "engine-leftover" ? current.reason : void 0 };
        },
        hasRawApplyHook: () => typeof connection.writeGitApplyHunks === "function",
        invalidate: async (action) => {
          if (action === "input-dispose") {
            assert.ok(pane);
            input.dispose();
            assert.strictEqual(pane.input, input);
            return;
          }
          if (action === "dispose") {
            host.dispose();
            return;
          }
          if (action === "clear" || action === "clear-and-restore") {
            if (pane) {
              pane.clearInput();
            } else {
              panelService.clear();
            }
            if (action === "clear") {
              return;
            }
            if (pane) {
              await pane.setInput(input, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
            } else {
              assert.strictEqual(await panelService.show(ref), true);
            }
            return;
          }
          const next = { ...ref, modified: URI.parse("inmemory://accept-authorization/next"), original: URI.parse("inmemory://accept-authorization/next-original") };
          await seed(next);
          if (pane) {
            const nextInput = store.add(new ConversationDiffReviewInput(next.modified, next.original, next.groupId, next));
            await pane.setInput(nextInput, void 0, /* @__PURE__ */ Object.create(null), CancellationToken.None);
          } else {
            assert.strictEqual(await panelService.show(next), true);
          }
        }
      };
    }
    const cases = [
      { name: "A1 active session changes to s2 before write", writes: false, mutate: (state) => {
        state.activeSessionId = "session-2";
      }, sessionNotice: true },
      { name: "A1 active session becomes empty before write", writes: false, mutate: (state) => {
        state.activeSessionId = "";
      }, sessionNotice: true },
      { name: "A2 same-session valid patch reaches ApplyHunks exactly once", writes: true, mutate: () => {
      } },
      { name: "A3 s1 to s2 to s1 uses current authorization", writes: true, mutate: (state, notify) => {
        state.activeSessionId = "session-2";
        notify();
        state.activeSessionId = "session-1";
      } },
      { name: "A5 disconnected before write", writes: false, mutate: (state) => {
        state.connected = false;
      } },
      { name: "A5 pairing hold before write", writes: false, mutate: (state) => {
        state.pairingHold = true;
      } },
      { name: "A5 catalog Session List failure leaves readiness unavailable", writes: false, mutate: (state) => {
        state.readiness = "unavailable";
      }, catalog: "unavailable" },
      { name: "A5 Git Changes failure leaves read-failed snapshot", writes: false, mutate: (state) => {
        state.gitReadFailed = true;
      }, gitFailed: true },
      { name: "A5 ApplyHunks capability becomes unsupported", writes: false, mutate: (state) => {
        state.applySupported = false;
      } },
      { name: "A5 ApplyHunks hook becomes unavailable", writes: false, mutate: (state) => {
        state.hasApplyHook = false;
      } },
      { name: "A6 catalog Session List failure recovers independently", writes: true, mutate: (state, notify) => {
        state.readiness = "unavailable";
        notify();
        state.readiness = "ready";
      } },
      { name: "A6 Git Changes read-failed snapshot recovers independently", writes: true, mutate: (state, notify) => {
        state.gitReadFailed = true;
        notify();
        state.gitReadFailed = false;
      } },
      { name: "A6 same-id disconnect reconnect uses current authorization", writes: true, mutate: (state, notify) => {
        state.connected = false;
        notify();
        state.connected = true;
      } }
    ];
    for (const kind of ["Pane", "Panel"]) {
      for (const scenario of cases) {
        test(`${kind} ${scenario.name}`, async () => {
          const h = await mountAuthorizationHost(kind);
          const operation = h.run();
          try {
            await h.waitForRead(operation);
            assert.deepStrictEqual(h.reads, [expectedRead]);
            scenario.mutate(h.state, h.notify);
            h.notify();
            assert.deepStrictEqual(h.readGates(), { catalog: scenario.catalog ?? "ready", gitState: scenario.gitFailed ? "engine-leftover" : "engine-live", gitReason: scenario.gitFailed ? "read-failed" : void 0 });
            assert.strictEqual(h.hasRawApplyHook(), h.state.hasApplyHook, "capability refusal retains the installed raw method; hook absence is a separate case");
            await h.readResult.complete();
            await operation;
            assert.deepStrictEqual(h.projection(), { reads: [expectedRead], applies: scenario.writes ? [expectedApply] : [], commands: [], refreshes: scenario.writes ? 1 : 0 });
            if (scenario.sessionNotice) {
              assert.strictEqual(h.notice.textContent, sourcesGitSessionChangedMessage());
            }
          } finally {
            await h.readResult.complete();
            await operation;
          }
        });
      }
      for (const action of ["replace", "clear", "dispose", "clear-and-restore"]) {
        test(`${kind} A4 ${action} invalidates the pending read owner`, async () => {
          const h = await mountAuthorizationHost(kind);
          const operation = h.run();
          try {
            await h.waitForRead(operation);
            await h.invalidate(action);
            const notice = h.notice.textContent;
            await h.readResult.complete();
            await operation;
            assert.deepStrictEqual(h.projection(), { reads: [expectedRead], applies: [], commands: [], refreshes: 0 });
            assert.strictEqual(h.notice.textContent, notice);
          } finally {
            await h.readResult.complete();
            await operation;
          }
        });
      }
      const afterWriteActions = kind === "Pane" ? ["replace", "dispose", "input-dispose"] : ["replace", "dispose"];
      for (const action of afterWriteActions) {
        for (const outcome of ["accepted", "failed", "rejected"]) {
          test(`${kind} A7 sent write then ${action} keeps ${outcome} off the invalid owner`, async () => {
            const h = await mountAuthorizationHost(kind, true);
            const operation = h.run();
            try {
              await h.waitForRead(operation);
              await h.readResult.complete();
              await h.waitForApply(operation);
              assert.deepStrictEqual(h.applies, [expectedApply], "the write was sent before invalidation");
              await h.invalidate(action);
              const notice = h.notice.textContent;
              if (outcome === "rejected") {
                await h.applyResult.error(new Error("late ApplyHunks failure"));
              } else {
                await h.applyResult.complete(outcome === "accepted" ? accepted : { ...accepted, success: false, errorMessage: "late ApplyHunks failure", exitCode: 1 });
              }
              await operation;
              assert.deepStrictEqual(h.projection(), { reads: [expectedRead], applies: [expectedApply], commands: [], refreshes: 0 });
              assert.strictEqual(h.notice.textContent, notice);
            } finally {
              await h.readResult.complete();
              await h.applyResult.complete(accepted);
              await operation;
            }
          });
        }
      }
    }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL3NvdXJjZXMvdGVzdC9icm93c2VyL3NvdXJjZXNEaWZmUGFuZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IE51bGxDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL3Rlc3QvY29tbW9uL251bGxDb21tYW5kU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGVycm9ySGFuZGxlciwgc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlLCB0b1Jlc291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBpc0lNZW51SXRlbSwgTWVudUlkLCBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnksIElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyB0eXBlIENvbnRleHRLZXlFeHByZXNzaW9uLCB0eXBlIENvbnRleHRLZXlWYWx1ZSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IGVtcHR5UHJvZ3Jlc3NSdW5uZXIsIElFZGl0b3JQcm9ncmVzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHR5cGUgeyBVbml2ZXJzZUFnZW50UmVhZEdpdEZpbGVEaWZmUmVxdWVzdCwgVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QsIFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0LCBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL3VuaXZlcnNlQWdlbnRUeXBlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElEaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9kaWZmRWRpdG9yL2RpZmZQcm92aWRlckZhY3RvcnlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci90ZXN0L2Jyb3dzZXIvZGlmZi90ZXN0RGlmZlByb3ZpZGVyRmFjdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVzZXJJbnRlcmFjdGlvblNlcnZpY2UsIE1vY2tVc2VySW50ZXJhY3Rpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckludGVyYWN0aW9uL2Jyb3dzZXIvdXNlckludGVyYWN0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkIH0gZnJvbSAnLi4vLi4vLi4vY29udmVyc2F0aW9uL2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvblN0YXR1cy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIFZpZXdDb250YWluZXJFeHRlbnNpb25zLCBFeHRlbnNpb25zIGFzIFZpZXdFeHRlbnNpb25zLCBJVmlld0NvbnRhaW5lck1vZGVsLCBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeSwgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgSVZpZXdQYW5lQ29udGFpbmVyLCBJVmlld3NSZWdpc3RyeSwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZGlmZkVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlLCBUZXN0RWRpdG9yR3JvdXBWaWV3LCBUZXN0RWRpdG9ySW5wdXQsIFRlc3RWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElDb252ZXJzYXRpb25Sb3N0ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29udmVyc2F0aW9uL2Jyb3dzZXIvY29udmVyc2F0aW9uU3R1YlNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUFnZW50U2Vzc2lvbkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9hZ2VudFNlc3Npb24vY29tbW9uL2FnZW50U2Vzc2lvbkNvbnRleHQuanMnO1xuaW1wb3J0IHsgSVNDTVJlc291cmNlLCBJU0NNU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NjbS9jb21tb24vc2NtLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdFZGl0b3JJZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvY29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0LmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElRdWlja0RpZmZTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2NtL2NvbW1vbi9xdWlja0RpZmYuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQuanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLmpzJztcbmltcG9ydCB7IElTb3VyY2VzQ2hhbmdlRW50cnlPcGVuRGVwcywgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc291cmNlc0NoYW5nZUVudHJ5T3Blbi5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTb3VyY2VzQ29udmVyc2F0aW9uT3Blbkhhcm5lc3MgfSBmcm9tICcuL3NvdXJjZXNDb252ZXJzYXRpb25PcGVuSGFybmVzcy5qcyc7XG5pbXBvcnQgeyBTT1VSQ0VTX0RJRkZfTU9WRV9UT19DT05WRVJTQVRJT05fVklFV19DT01NQU5ELCBTT1VSQ0VTX0RJRkZfTU9WRV9UT19QUkVWSUVXX0NPTU1BTkQsIFNPVVJDRVNfRElGRl9NT1ZFX1RPX1BSRVZJRVdfVklFV19DT01NQU5EIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zb3VyY2VzRGlmZkFjdGlvbnMuanMnO1xuaW1wb3J0IHsgbW92ZUFjdGl2ZURpZmZUb0NvbnZlcnNhdGlvbiwgcmVzb2x2ZVNvdXJjZXNDaGFuZ2VSZWZGcm9tRWRpdG9yIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zb3VyY2VzRGlmZlJlZkhlbHBlcnMuanMnO1xuaW1wb3J0IHsgU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfQ09OVEFJTkVSIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zb3VyY2VzRGlmZlBhbmVsLmNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBTT1VSQ0VTX0RJRkZfUEFORUxfQ09OVEFJTkVSX0lELCBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc291cmNlc0RpZmZQYW5lbElkcy5qcyc7XG5pbXBvcnQgeyBTb3VyY2VzRGlmZlBhbmVsU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc291cmNlc0RpZmZQYW5lbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU291cmNlc0RpZmZQYW5lbFZpZXcgfSBmcm9tICcuLi8uLi9icm93c2VyL3NvdXJjZXNEaWZmUGFuZWxWaWV3LmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvZGlmZkVkaXRvci9kaWZmRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElTb3VyY2VzQ2hhbmdlUmVmLCBzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMgfSBmcm9tICcuLi8uLi9jb21tb24vc291cmNlc0NoYW5nZVJlZi5qcyc7XG5pbXBvcnQgeyBTT1VSQ0VTX0dJVF9BUFBMWV9DQUNIRURfQVJHViwgc291cmNlc0dpdEh1bmtQYXRjaEF0Q3Vyc29yIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NvdXJjZXNHaXRIdW5rUGF0Y2guanMnO1xuaW1wb3J0IHsgSVNvdXJjZXNDaGFuZ2VFbnRyeSwgSVNvdXJjZXNDaGFuZ2VzTW9kZWwgfSBmcm9tICcuLi8uLi9jb21tb24vc291cmNlc0NoYW5nZXNNb2RlbC5qcyc7XG5pbXBvcnQgeyBTb3VyY2VzQ2hhbmdlc01vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzUmVhZE1vZGVsLmpzJztcbmltcG9ydCB7IElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zb3VyY2VzRGlmZlBhbmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBzb3VyY2VzRGlmZkFjY2VwdFVuYXZhaWxhYmxlTWVzc2FnZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zb3VyY2VzRGlmZldyaXRlQ29udHJvbGxlci5qcyc7XG5pbXBvcnQgeyBjYW5TZW5kU291cmNlc0dpdEFwcGx5SHVua3MsIGNhblNlbmRTb3VyY2VzR2l0U3RhZ2VQYXRocywgY2FuU2hvd1NvdXJjZXNSZXZpZXdBY2NlcHQsIGlzU291cmNlc0NoYW5nZXNXcml0ZUNsb3NlZCwgcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVBY3Rpb25zLCBzb3VyY2VzR2l0RW1wdHlTdGFnZVBhdGhNZXNzYWdlLCBzb3VyY2VzR2l0U2Vzc2lvbkNoYW5nZWRNZXNzYWdlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NvdXJjZXNDaGFuZ2VzR2l0V3JpdGUuanMnO1xuXG5mdW5jdGlvbiBldmFsV2hlbih3aGVuOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCwgdmFsdWVzOiBSZWNvcmQ8c3RyaW5nLCBDb250ZXh0S2V5VmFsdWU+KTogYm9vbGVhbiB7XG5cdGlmICghd2hlbikge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHJldHVybiB3aGVuLmV2YWx1YXRlKHsgZ2V0VmFsdWU6IDxUIGV4dGVuZHMgQ29udGV4dEtleVZhbHVlID0gQ29udGV4dEtleVZhbHVlPihrZXk6IHN0cmluZykgPT4gdmFsdWVzW2tleV0gYXMgVCB9KTtcbn1cblxuc3VpdGUoJ1NvdXJjZXMgZGlmZiBwYW5lbCcsICgpID0+IHtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IHZpZXdDb250YWluZXJzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oVmlld0NvbnRhaW5lckV4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSk7XG5cdGNvbnN0IHZpZXdzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oVmlld0V4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSk7XG5cblx0dGVzdCgnRGlmZiBwYW5lbCBjb250YWluZXIgYW5kIHZpZXcgcmVnaXN0ZXIgb24gUGFuZWwgd2l0aCBoaWRlSWZFbXB0eScsICgpID0+IHtcblx0XHRjb25zdCBjb250YWluZXIgPSB2aWV3Q29udGFpbmVyc1JlZ2lzdHJ5LmdldChTT1VSQ0VTX0RJRkZfUEFORUxfQ09OVEFJTkVSX0lEKTtcblx0XHRhc3NlcnQub2soY29udGFpbmVyLCAnU291cmNlcyBkaWZmIHBhbmVsIGNvbnRhaW5lciBzaG91bGQgYmUgcmVnaXN0ZXJlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250YWluZXIsIFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0NPTlRBSU5FUik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRhaW5lci5oaWRlSWZFbXB0eSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0dmlld0NvbnRhaW5lcnNSZWdpc3RyeS5nZXRWaWV3Q29udGFpbmVyTG9jYXRpb24oY29udGFpbmVyKSxcblx0XHRcdFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCxcblx0XHRcdCdTb3VyY2VzIGRpZmYgcGFuZWwgbXVzdCBsaXZlIG9uIFBBTkVMX1BBUlQnXG5cdFx0KTtcblxuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yID0gdmlld3NSZWdpc3RyeS5nZXRWaWV3KFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lEKTtcblx0XHRhc3NlcnQub2sodmlld0Rlc2NyaXB0b3IsICdTb3VyY2VzIGRpZmYgcGFuZWwgdmlldyBzaG91bGQgYmUgcmVnaXN0ZXJlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3c1JlZ2lzdHJ5LmdldFZpZXdDb250YWluZXIoU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQpLCBjb250YWluZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3RGVzY3JpcHRvci53aGVuLCBTb3VyY2VzRGlmZlBhbmVsU2VydmljZS5jdHhIYXNDaGFuZ2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG93IGVuYWJsZXMgdmlldyBjb250ZXh0IGFuZCBjbGVhciBkaXNhYmxlcyBpdCBmb3IgaGlkZUlmRW1wdHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hLnRzJyk7XG5cdFx0Y29uc3QgcmVmID0ge1xuXHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0b3JpZ2luYWw6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2EudHMuZ2l0JyksXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdH07XG5cblx0XHRjb25zdCBvcGVuVmlld0NhbGxzOiBBcnJheTx7IGlkOiBzdHJpbmc7IGZvY3VzOiBib29sZWFuIHwgdW5kZWZpbmVkIH0+ID0gW107XG5cdFx0Y2xhc3MgVHJhY2tpbmdWaWV3c1NlcnZpY2UgZXh0ZW5kcyBUZXN0Vmlld3NTZXJ2aWNlIHtcblx0XHRcdG92ZXJyaWRlIG9wZW5WaWV3PFQ+KGlkOiBzdHJpbmcsIGZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8VCB8IG51bGw+IHtcblx0XHRcdFx0b3BlblZpZXdDYWxscy5wdXNoKHsgaWQsIGZvY3VzIH0pO1xuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdFx0fVxuXHRcdFx0ZGlzcG9zZSgpOiB2b2lkIHsgfVxuXHRcdH1cblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0Y29uc3Qgdmlld3NTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUcmFja2luZ1ZpZXdzU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHZpZXdzU2VydmljZSk7XG5cblx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IGN0eFZhbHVlcyA9ICgpID0+ICh7XG5cdFx0XHRbU291cmNlc0RpZmZQYW5lbFNlcnZpY2UuY3R4SGFzQ2hhbmdlLmtleV06IGNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxib29sZWFuPihTb3VyY2VzRGlmZlBhbmVsU2VydmljZS5jdHhIYXNDaGFuZ2Uua2V5KSA/PyBmYWxzZSxcblx0XHRcdHZpZXc6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXZhbFdoZW4oU291cmNlc0RpZmZQYW5lbFNlcnZpY2UuY3R4SGFzQ2hhbmdlLCBjdHhWYWx1ZXMoKSksXG5cdFx0XHRmYWxzZSxcblx0XHRcdCdoaWRlSWZFbXB0eSBjb250YWluZXIgbXVzdCBzdGFydCBpbmFjdGl2ZSdcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHJlZiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTZXJ2aWNlLmdldEN1cnJlbnRSZWYoKSwgcmVmKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRldmFsV2hlbihTb3VyY2VzRGlmZlBhbmVsU2VydmljZS5jdHhIYXNDaGFuZ2UsIGN0eFZhbHVlcygpKSxcblx0XHRcdHRydWUsXG5cdFx0XHQnc2hvdyBtdXN0IGFjdGl2YXRlIHRoZSBkaWZmIHBhbmVsIHZpZXcnXG5cdFx0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wZW5WaWV3Q2FsbHMsIFt7IGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCwgZm9jdXM6IHRydWUgfV0pO1xuXG5cdFx0cGFuZWxTZXJ2aWNlLmNsZWFyKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU2VydmljZS5nZXRDdXJyZW50UmVmKCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXZhbFdoZW4oU291cmNlc0RpZmZQYW5lbFNlcnZpY2UuY3R4SGFzQ2hhbmdlLCBjdHhWYWx1ZXMoKSksXG5cdFx0XHRmYWxzZSxcblx0XHRcdCdjbGVhciBtdXN0IGRlYWN0aXZhdGUgdGhlIGRpZmYgcGFuZWwgdmlldydcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG93IHJlcGxhY2VzIHRoZSBjdXJyZW50IGNoYW5nZSByZWYnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2VBID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYS50cycpO1xuXHRcdGNvbnN0IHJlc291cmNlQiA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2IudHMnKTtcblx0XHRjb25zdCByZWZBID0geyBtb2RpZmllZDogcmVzb3VyY2VBLCBvcmlnaW5hbDogdW5kZWZpbmVkLCBncm91cElkOiAnd29ya2luZ1RyZWUnIH07XG5cdFx0Y29uc3QgcmVmQiA9IHsgbW9kaWZpZWQ6IHJlc291cmNlQiwgb3JpZ2luYWw6IHVuZGVmaW5lZCwgZ3JvdXBJZDogJ3dvcmtpbmdUcmVlJyB9O1xuXG5cdFx0Y29uc3QgY2hhbmdlczogQXJyYXk8VVJJIHwgdW5kZWZpbmVkPiA9IFtdO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdHN0b3JlLmFkZChwYW5lbFNlcnZpY2Uub25EaWRDaGFuZ2VSZWYocmVmID0+IGNoYW5nZXMucHVzaChyZWY/Lm1vZGlmaWVkKSkpO1xuXG5cdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3cocmVmQSk7XG5cdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3cocmVmQik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTZXJ2aWNlLmdldEN1cnJlbnRSZWYoKT8ubW9kaWZpZWQudG9TdHJpbmcoKSwgcmVzb3VyY2VCLnRvU3RyaW5nKCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2hhbmdlcy5tYXAodXJpID0+IHVyaT8udG9TdHJpbmcoKSksIFtyZXNvdXJjZUEudG9TdHJpbmcoKSwgcmVzb3VyY2VCLnRvU3RyaW5nKCldKTtcblx0fSk7XG5cblx0dGVzdCgncGFuZWwgVmlld1RpdGxlIGV4cG9zZXMgbW92ZSB0byBjb252ZXJzYXRpb24gYW5kIHByZXZpZXcgYWN0aW9ucycsICgpID0+IHtcblx0XHRjb25zdCB2aWV3VGl0bGVJdGVtcyA9IE1lbnVSZWdpc3RyeS5nZXRNZW51SXRlbXMoTWVudUlkLlZpZXdUaXRsZSkuZmlsdGVyKGlzSU1lbnVJdGVtKTtcblx0XHRjb25zdCBtb3ZlVG9Db252ZXJzYXRpb24gPSB2aWV3VGl0bGVJdGVtcy5maW5kKGl0ZW0gPT4gaXRlbS5jb21tYW5kLmlkID09PSBTT1VSQ0VTX0RJRkZfTU9WRV9UT19DT05WRVJTQVRJT05fVklFV19DT01NQU5EKTtcblx0XHRjb25zdCBtb3ZlVG9QcmV2aWV3ID0gdmlld1RpdGxlSXRlbXMuZmluZChpdGVtID0+IGl0ZW0uY29tbWFuZC5pZCA9PT0gU09VUkNFU19ESUZGX01PVkVfVE9fUFJFVklFV19WSUVXX0NPTU1BTkQpO1xuXG5cdFx0YXNzZXJ0Lm9rKG1vdmVUb0NvbnZlcnNhdGlvbiwgJ1BhbmVsIHZpZXcgdGl0bGUgbXVzdCBleHBvc2UgbW92ZSB0byBjb252ZXJzYXRpb24nKTtcblx0XHRhc3NlcnQub2sobW92ZVRvUHJldmlldywgJ1BhbmVsIHZpZXcgdGl0bGUgbXVzdCBleHBvc2UgbW92ZSB0byBwcmV2aWV3Jyk7XG5cdFx0YXNzZXJ0Lm9rKG1vdmVUb0NvbnZlcnNhdGlvbi53aGVuLCAnUGFuZWwgbW92ZSB0byBjb252ZXJzYXRpb24gbXVzdCBiZSBnYXRlZCcpO1xuXHRcdGFzc2VydC5vayhtb3ZlVG9QcmV2aWV3LndoZW4sICdQYW5lbCBtb3ZlIHRvIHByZXZpZXcgbXVzdCBiZSBnYXRlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdGV2YWxXaGVuKG1vdmVUb0NvbnZlcnNhdGlvbi53aGVuLCB7IHZpZXc6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELCBbU291cmNlc0RpZmZQYW5lbFNlcnZpY2UuY3R4SGFzQ2hhbmdlLmtleV06IHRydWUgfSksXG5cdFx0XHR0cnVlXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRldmFsV2hlbihtb3ZlVG9QcmV2aWV3LndoZW4sIHsgdmlldzogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsIFtTb3VyY2VzRGlmZlBhbmVsU2VydmljZS5jdHhIYXNDaGFuZ2Uua2V5XTogZmFsc2UgfSksXG5cdFx0XHRmYWxzZVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VkaXRvclRpdGxlIGV4cG9zZXMgbW92ZSB0byBwcmV2aWV3IHdoZW4gQ29udmVyc2F0aW9uIERpZmYgaXMgYWN0aXZlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGVkaXRvclRpdGxlSXRlbXMgPSBNZW51UmVnaXN0cnkuZ2V0TWVudUl0ZW1zKE1lbnVJZC5FZGl0b3JUaXRsZSkuZmlsdGVyKGlzSU1lbnVJdGVtKTtcblx0XHRjb25zdCBtb3ZlVG9QcmV2aWV3ID0gZWRpdG9yVGl0bGVJdGVtcy5maW5kKGl0ZW0gPT4gaXRlbS5jb21tYW5kLmlkID09PSBTT1VSQ0VTX0RJRkZfTU9WRV9UT19QUkVWSUVXX0NPTU1BTkQpO1xuXG5cdFx0YXNzZXJ0Lm9rKG1vdmVUb1ByZXZpZXcsICdDb252ZXJzYXRpb24gRGlmZiBlZGl0b3IgdGl0bGUgbXVzdCBleHBvc2UgbW92ZSB0byBwcmV2aWV3Jyk7XG5cdFx0YXNzZXJ0Lm9rKG1vdmVUb1ByZXZpZXcud2hlbiwgJ0NvbnZlcnNhdGlvbiBEaWZmIG1vdmUgdG8gcHJldmlldyBtdXN0IGJlIGdhdGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXZhbFdoZW4obW92ZVRvUHJldmlldy53aGVuLCB7IGFjdGl2ZUVkaXRvcjogQ29udmVyc2F0aW9uRGlmZlJldmlld0VkaXRvcklkIH0pLFxuXHRcdFx0dHJ1ZVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXZhbFdoZW4obW92ZVRvUHJldmlldy53aGVuLCB7IGFjdGl2ZUVkaXRvcjogJ3dvcmtiZW5jaC5lZGl0b3IuZmlsZXMudGV4dEZpbGVFZGl0b3InIH0pLFxuXHRcdFx0ZmFsc2Vcblx0XHQpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBjcmVhdGVWaWV3RGVzY3JpcHRvclNlcnZpY2VTdHViKCk6IElWaWV3RGVzY3JpcHRvclNlcnZpY2Uge1xuXHRcdHJldHVybiB7XG5cdFx0XHRnZXRWaWV3TG9jYXRpb25CeUlkOiAoKSA9PiBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsXG5cdFx0XHRvbkRpZENoYW5nZUxvY2F0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0Z2V0Vmlld0Rlc2NyaXB0b3JCeUlkOiAoKSA9PiBudWxsLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkOiAoKSA9PiAoe1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX0NPTlRBSU5FUl9JRCxcblx0XHRcdFx0dGl0bGU6IHsgdmFsdWU6ICdEaWZmJywgb3JpZ2luYWw6ICdEaWZmJyB9LFxuXHRcdFx0XHRjdG9yRGVzY3JpcHRvcjoge30gYXMgU3luY0Rlc2NyaXB0b3I8SVZpZXdQYW5lQ29udGFpbmVyPixcblx0XHRcdH0pLFxuXHRcdFx0Z2V0Vmlld0NvbnRhaW5lck1vZGVsOiAoKSA9PiAoe1xuXHRcdFx0XHRvbkRpZENoYW5nZUNvbnRhaW5lckluZm86IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIElWaWV3Q29udGFpbmVyTW9kZWwpLFxuXHRcdFx0Z2V0RGVmYXVsdENvbnRhaW5lckJ5SWQ6ICgpID0+IG51bGwsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3RGVzY3JpcHRvclNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVMaXZlU2NtU2VydmljZShyZXNvdXJjZTogVVJJLCBsaXZlR3JvdXBJZDogc3RyaW5nKTogSVNDTVNlcnZpY2Uge1xuXHRcdGNvbnN0IGdyb3VwID0ge1xuXHRcdFx0aWQ6IGxpdmVHcm91cElkLFxuXHRcdFx0bGFiZWw6IGxpdmVHcm91cElkID09PSAnaW5kZXgnID8gJ1N0YWdlZCBDaGFuZ2VzJyA6ICdDaGFuZ2VzJyxcblx0XHRcdHJlc291cmNlczogW10gYXMgSVNDTVJlc291cmNlW10sXG5cdFx0fTtcblx0XHRjb25zdCBzY21SZXNvdXJjZSA9IHtcblx0XHRcdHNvdXJjZVVyaTogcmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZUdyb3VwOiBncm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGdyb3VwLnJlc291cmNlcy5wdXNoKHNjbVJlc291cmNlKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0ge1xuXHRcdFx0cHJvdmlkZXI6IHtcblx0XHRcdFx0Z3JvdXBzOiBbZ3JvdXBdLFxuXHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7IHJldHVybiBbcmVwb3NpdG9yeV07IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVMZWZ0b3ZlclNjbVNlcnZpY2UocmVzb3VyY2U6IFVSSSwgZ3JvdXBJZCA9ICd3b3JraW5nVHJlZScpOiBJU0NNU2VydmljZSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSB7XG5cdFx0XHRpZDogZ3JvdXBJZCxcblx0XHRcdGxhYmVsOiBncm91cElkID09PSAnaW5kZXgnID8gJ1N0YWdlZCBDaGFuZ2VzJyA6ICdDaGFuZ2VzJyxcblx0XHRcdHJlc291cmNlczogW10gYXMgSVNDTVJlc291cmNlW10sXG5cdFx0fTtcblx0XHRjb25zdCBzY21SZXNvdXJjZSA9IHtcblx0XHRcdHNvdXJjZVVyaTogcmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZUdyb3VwOiBncm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGdyb3VwLnJlc291cmNlcy5wdXNoKHNjbVJlc291cmNlKTtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0ge1xuXHRcdFx0cHJvdmlkZXI6IHtcblx0XHRcdFx0Z3JvdXBzOiBbZ3JvdXBdLFxuXHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7IHJldHVybiBbcmVwb3NpdG9yeV07IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cdH1cblxuXHRmdW5jdGlvbiBlbXB0eURpZmZTY21TZXJ2aWNlKCk6IElTQ01TZXJ2aWNlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IHJlcG9zaXRvcmllcygpIHsgcmV0dXJuIFtdOyB9LFxuXHRcdFx0Z2V0IHJlcG9zaXRvcnlDb3VudCgpIHsgcmV0dXJuIDA7IH0sXG5cdFx0XHRvbkRpZEFkZFJlcG9zaXRvcnk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZFJlbW92ZVJlcG9zaXRvcnk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRyZWdpc3RlclNDTVByb3ZpZGVyOiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH0sXG5cdFx0XHRnZXRSZXBvc2l0b3J5OiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01TZXJ2aWNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3R1YlNlc3Npb25BbmRDaGFuZ2VzTW9kZWwoXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlPixcblx0XHRjb25uZWN0aW9uOiBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sXG5cdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBib29sZWFuLFxuXHQpOiB2b2lkIHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElBZ2VudFNlc3Npb25Db250ZXh0LCB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzaW9uLTEnLFxuXHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGVuZ2luZVNlc3Npb25SZWFkeSxcblx0XHRcdGlzUGFpcmluZ0hvbGQ6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgcGhhc2UgPSB0eXBlb2YgY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UgPT09ICdmdW5jdGlvbicgPyBjb25uZWN0aW9uLmdldENvbm5lY3Rpb25QaGFzZSgpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBzbmFwc2hvdCA9IHR5cGVvZiBjb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCA9PT0gJ2Z1bmN0aW9uJyA/IGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdHJldHVybiBwaGFzZT8ua2luZCA9PT0gJ2Nvbm5lY3RlZCcgJiYgISFzbmFwc2hvdD8ucGFpcmluZ1BlbmRpbmc7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VTZXNzaW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IHVzZWQnKTsgfSxcblx0XHR9IHNhdGlzZmllcyBJQWdlbnRTZXNzaW9uQ29udGV4dCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0NoYW5nZXNNb2RlbCwgc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNDaGFuZ2VzTW9kZWwpKSk7XG5cdH1cblxuXHRmdW5jdGlvbiBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyhvcHRpb25zOiB7XG5cdFx0dGhyb3dPbkxvYWQ/OiBib29sZWFuO1xuXHRcdGV4ZWN1dGVDb21tYW5kPzogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gUHJvbWlzZTx1bmtub3duPjtcblx0XHRyZXNvdXJjZT86IFVSSTtcblx0XHRncm91cElkPzogc3RyaW5nO1xuXHRcdGNvbm5lY3Rpb24/OiBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0ZW5naW5lU2Vzc2lvblJlYWR5PzogYm9vbGVhbjtcblx0fSA9IHt9KSB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIHN0b3JlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElEaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSwgbmV3IFRlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VySW50ZXJhY3Rpb25TZXJ2aWNlLCBuZXcgTW9ja1VzZXJJbnRlcmFjdGlvblNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBjcmVhdGVWaWV3RGVzY3JpcHRvclNlcnZpY2VTdHViKCkpO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBvcHRpb25zLmNvbm5lY3Rpb24gPz8ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIGNvbm5lY3Rpb24pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UsIHtcblx0XHRcdGdldEFjdGl2ZVNlc3Npb25JZDogKCkgPT4gJ3Nlc3Npb24tMScsXG5cdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gb3B0aW9ucy5lbmdpbmVTZXNzaW9uUmVhZHkgPz8gdHJ1ZSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNDTVNlcnZpY2UsIG9wdGlvbnMucmVzb3VyY2Vcblx0XHRcdD8gY3JlYXRlTGVmdG92ZXJTY21TZXJ2aWNlKG9wdGlvbnMucmVzb3VyY2UsIG9wdGlvbnMuZ3JvdXBJZClcblx0XHRcdDogZW1wdHlEaWZmU2NtU2VydmljZSgpKTtcblx0XHRzdHViU2Vzc2lvbkFuZENoYW5nZXNNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgY29ubmVjdGlvbiwgb3B0aW9ucy5lbmdpbmVTZXNzaW9uUmVhZHkgPz8gdHJ1ZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29tbWFuZFNlcnZpY2UsIHtcblx0XHRcdG9uV2lsbEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRFeGVjdXRlQ29tbWFuZDogRXZlbnQuTm9uZSxcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBvcHRpb25zLmV4ZWN1dGVDb21tYW5kID8/IChhc3luYyAoKSA9PiB1bmRlZmluZWQpLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdGlmIChvcHRpb25zLnRocm93T25Mb2FkKSB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0TW9kZWxTZXJ2aWNlLCB7XG5cdFx0XHRcdGNyZWF0ZU1vZGVsUmVmZXJlbmNlOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdH1cblxuXHR0ZXN0KCdQYW5lbCBBY2NlcHQgaXMgaGlkZGVuIHdpdGhvdXQgQXBwbHlIdW5rcyBwYXlsb2FkOyBTQ00gbG9jYWwgYWN0aW9uIGlzIFN0YWdlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5TaG93U291cmNlc1Jldmlld0FjY2VwdCh0cnVlLCBmYWxzZSksIGZhbHNlKTtcblx0XHRjb25zdCBzY21Pbmx5ID0gcmVzb2x2ZVNvdXJjZXNEaWZmV3JpdGVBY3Rpb25zKHtcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRoYXNTY21SZXNvdXJjZTogdHJ1ZSxcblx0XHRcdGNhbldyaXRlU3RhZ2U6IGZhbHNlLFxuXHRcdFx0Y2FuV3JpdGVBY2NlcHQ6IHRydWUsXG5cdFx0XHRoYXNBcHBseUh1bmtzUGF5bG9hZDogZmFsc2UsXG5cdFx0XHRoYXNHaXRTdGFnZUNvbW1hbmQ6IHRydWUsXG5cdFx0XHRoYXNHaXRVbnN0YWdlQ29tbWFuZDogZmFsc2UsXG5cdFx0XHRoYXNHaXRDbGVhbkNvbW1hbmQ6IGZhbHNlLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzY21Pbmx5LnNob3dTdGFnZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjbU9ubHkuc2hvd0FjY2VwdCwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdEaWZmIHBhbmVsIGxvYWQgZmFpbCBoaWRlcyB0aXRsZSBhdXRob3JpdHkgYW5kIHdyaXRlIGNocm9tZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2EudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2EudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoeyB0aHJvd09uTG9hZDogdHJ1ZSwgcmVzb3VyY2UgfSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSksIGZhbHNlKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdGl0bGUnKT8udGV4dENvbnRlbnQgPz8gJycsICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1yZXZlcnQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC11bnN0YWdlJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0dmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtbmV3LWZpbGUtbm90aWNlJyk/LnRleHRDb250ZW50ID8/ICcnLFxuXHRcdFx0XHRsb2NhbGl6ZSgnc291cmNlc0RpZmZQYW5lbC5sb2FkRmFpbGVkJywgXCJVbmFibGUgdG8gbG9hZCB0aGlzIGNvbXBhcmlzb24uXCIpLFxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5vayh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1uZXctZmlsZS1ub3RpY2UnKT8uY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1lcnJvcicpKTtcblx0XHRcdGFzc2VydC5vayghKHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLW5ldy1maWxlLW5vdGljZScpPy50ZXh0Q29udGVudCA/PyAnJykuaW5jbHVkZXMoJ05ldyBmaWxlJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1oZWFkZXInKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnc3VwZXJzZWRlZCBhc3luYyByZW5kZXIgY2Fubm90IHBhaW50IGFuIG9sZGVyIGZpbGUgZGlmZicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZUEgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9zdGFsZS1wYW5lbC1hLnRzJyk7XG5cdFx0Y29uc3QgcmVzb3VyY2VCID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvc3RhbGUtcGFuZWwtYi50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsQSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3N0YWxlLXBhbmVsLWEudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWxCID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvc3RhbGUtcGFuZWwtYi50cy5naXQnKTtcblx0XHRjb25zdCBzdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHRsZXQgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlIHwgdW5kZWZpbmVkO1xuXHRcdGxldCB2aWV3OiBTb3VyY2VzRGlmZlBhbmVsVmlldyB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlbGVhc2VTdGFsZTogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgc3RhbGVHYXRlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHJlbGVhc2VTdGFsZSA9IHJlc29sdmU7XG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoeyByZXNvdXJjZTogcmVzb3VyY2VBIH0pO1xuXHRcdFx0dGV4dEZpbGVTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElUZXh0RmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZmFrZVdpZGdldCA9IHtcblx0XHRcdFx0c2V0TW9kZWw6ICgpID0+IHsgfSxcblx0XHRcdFx0Z2V0TW9kaWZpZWRFZGl0b3I6ICgpID0+ICh7IG9uRGlkQ2hhbmdlQ3Vyc29yUG9zaXRpb246IEV2ZW50Lk5vbmUsIG9uRGlkRm9jdXNFZGl0b3JUZXh0OiBFdmVudC5Ob25lLCBoYXNUZXh0Rm9jdXM6ICgpID0+IGZhbHNlLCBnZXRQb3NpdGlvbjogKCkgPT4gdW5kZWZpbmVkIH0pLFxuXHRcdFx0XHRnZXRPcmlnaW5hbEVkaXRvcjogKCkgPT4gKHsgb25EaWRDaGFuZ2VDdXJzb3JQb3NpdGlvbjogRXZlbnQuTm9uZSwgb25EaWRGb2N1c0VkaXRvclRleHQ6IEV2ZW50Lk5vbmUsIGhhc1RleHRGb2N1czogKCkgPT4gZmFsc2UsIGdldFBvc2l0aW9uOiAoKSA9PiB1bmRlZmluZWQgfSksXG5cdFx0XHRcdGxheW91dDogKCkgPT4geyB9LFxuXHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH0sXG5cdFx0XHR9O1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1Ykluc3RhbmNlKERpZmZFZGl0b3JXaWRnZXQsIGZha2VXaWRnZXQgYXMgdW5rbm93biBhcyBEaWZmRWRpdG9yV2lkZ2V0KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGNvbnN0IHJlbmRlckhvc3QgPSB2aWV3IGFzIHVua25vd24gYXMge1xuXHRcdFx0XHRyZW5kZXJEaWZmOiAob3JpZ2luYWw6IFVSSSwgbW9kaWZpZWQ6IFVSSSwgZ2VuZXJhdGlvbjogbnVtYmVyKSA9PiBQcm9taXNlPGJvb2xlYW4+O1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHJlbmRlckRpZmYgPSByZW5kZXJIb3N0LnJlbmRlckRpZmYuYmluZCh2aWV3KTtcblx0XHRcdGxldCByZW5kZXJDYWxscyA9IDA7XG5cdFx0XHRyZW5kZXJIb3N0LnJlbmRlckRpZmYgPSBhc3luYyAob3JpZ2luYWwsIG1vZGlmaWVkLCBnZW5lcmF0aW9uKSA9PiB7XG5cdFx0XHRcdHJlbmRlckNhbGxzKys7XG5cdFx0XHRcdGlmIChyZW5kZXJDYWxscyA9PT0gMSkge1xuXHRcdFx0XHRcdGF3YWl0IHN0YWxlR2F0ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVuZGVyRGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGdlbmVyYXRpb24pO1xuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3Qgc2hvd25BID0gcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2VBLFxuXHRcdFx0XHRvcmlnaW5hbDogb3JpZ2luYWxBLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXG5cdFx0XHRjb25zdCBzaG93bkIgPSBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZUIsXG5cdFx0XHRcdG9yaWdpbmFsOiBvcmlnaW5hbEIsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdGl0bGUnKT8udGV4dENvbnRlbnQsICdzdGFsZS1wYW5lbC1iLnRzJyk7XG5cblx0XHRcdHJlbGVhc2VTdGFsZSEoKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdGl0bGUnKT8udGV4dENvbnRlbnQsICdzdGFsZS1wYW5lbC1iLnRzJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2hvd25BLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2hvd25CLCB0cnVlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zm9yIChjb25zdCBtb2RlbCBvZiB0ZXh0RmlsZVNlcnZpY2U/LmZpbGVzLm1vZGVscyA/PyBbXSkge1xuXHRcdFx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0XHR2aWV3Py5kaXNwb3NlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3Rpb24gY2hhbmdlIGR1cmluZyByZW5kZXJSZWYga2VlcHMgd3JpdGUgY2hyb21lIGhpZGRlbiB1bnRpbCBjb21wYXJpc29uIGxvYWRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvcmVuZGVyLXBlbmRpbmctd3JpdGUudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlbmRlci1wZW5kaW5nLXdyaXRlLnRzLmdpdCcpO1xuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgcmVsZWFzZUxvYWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGxvYWRHYXRlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdHJlbGVhc2VMb2FkID0gcmVzb2x2ZTtcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3Qgb25EaWRDaGFuZ2VDb25uZWN0aW9uID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24gPSB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogb25EaWRDaGFuZ2VDb25uZWN0aW9uLmV2ZW50LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbjtcblxuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7IHJlc291cmNlLCBjb25uZWN0aW9uIH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0Y29uc3QgcmVuZGVySG9zdCA9IHZpZXcgYXMgdW5rbm93biBhcyB7XG5cdFx0XHRcdHJlbmRlckRpZmY6IChvcmlnaW5hbDogVVJJLCBtb2RpZmllZDogVVJJLCBnZW5lcmF0aW9uOiBudW1iZXIpID0+IFByb21pc2U8Ym9vbGVhbj47XG5cdFx0XHR9O1xuXHRcdFx0cmVuZGVySG9zdC5yZW5kZXJEaWZmID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCBsb2FkR2F0ZTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBzaG93biA9IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblxuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uLmZpcmUoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXG5cdFx0XHRyZWxlYXNlTG9hZCEoKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2hvd24sIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbi5kaXNwb3NlKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdDb252ZXJzYXRpb24gRGlmZiBsb2FkIGZhaWwgaGlkZXMgd3JpdGUgY2hyb21lIGFuZCBvbmx5IGtlZXBzIGxvYWRGYWlsZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hLnRzLmdpdCcpO1xuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHsgdGhyb3dPbkxvYWQ6IHRydWUsIHJlc291cmNlIH0pO1xuXHRcdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblxuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1zdGFnZScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LWFjY2VwdCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbCk/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXVuc3RhZ2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8udGV4dENvbnRlbnQgPz8gJycsXG5cdFx0XHRcdGxvY2FsaXplKCdjb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZS5sb2FkRmFpbGVkJywgXCJVbmFibGUgdG8gbG9hZCB0aGlzIGNvbXBhcmlzb24uXCIpLFxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5vayhwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8uY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1lcnJvcicpKTtcblx0XHRcdGFzc2VydC5vayghKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW5vdGljZScpPy50ZXh0Q29udGVudCA/PyAnJykuaW5jbHVkZXMoJ05ldyBmaWxlJykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy10b29sYmFyJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgocGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctb3Blbi1wcmV2aWV3JykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0NvbnZlcnNhdGlvbiBydW5HaXRBY3Rpb24gc3VjY2VzcyBjbGVhcnMgbm90aWNlIGFuZCBmYWlsdXJlIGtlZXBzIGl0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYS50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYS50cy5naXQnKTtcblx0XHRsZXQgc2hvdWxkRmFpbCA9IGZhbHNlO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGlmIChzaG91bGRGYWlsKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cblx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJykpO1xuXHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRjb25zdCBydW5uZXIgPSBwYW5lIGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9O1xuXHRcdGF3YWl0IHJ1bm5lci5ydW5HaXRBY3Rpb24oJ2dpdC5zdGFnZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgocGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctbm90aWNlJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsKT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblxuXHRcdHNob3VsZEZhaWwgPSB0cnVlO1xuXHRcdGF3YWl0IHJ1bm5lci5ydW5HaXRBY3Rpb24oJ2dpdC5zdGFnZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8udGV4dENvbnRlbnQgPz8gJycsICdib29tJyk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBmb3JjZUNsaWNrKGJ1dHRvbjogSFRNTEVsZW1lbnQgfCBudWxsKTogdm9pZCB7XG5cdFx0aWYgKCFidXR0b24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YnV0dG9uLnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHRidXR0b24ucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuXHRcdGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnKTtcblx0XHRpZiAoJ2Rpc2FibGVkJyBpbiBidXR0b24pIHtcblx0XHRcdChidXR0b24gYXMgSFRNTEJ1dHRvbkVsZW1lbnQpLmRpc2FibGVkID0gZmFsc2U7XG5cdFx0fVxuXHRcdGJ1dHRvbi5jbGljaygpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tOiBFcnJvciwgcnVuOiAoKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIEEgbG9uZSBgLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKWAgc3RpbGwgbGVha3Mgd2hlbiB0aGUgaGFuZGxlciB3YXJuLXRoZW4tcmV0aHJvd3MuXG5cdFx0Y29uc3QgdW5leHBlY3RlZFdhcm5zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCB1bmhhbmRsZWRSZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZFJlamVjdGlvbiA9IChyZWFzb246IHVua25vd24pID0+IHVuaGFuZGxlZFJlamVjdGlvbnMucHVzaChyZWFzb24pO1xuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkUmVqZWN0aW9uKTtcblx0XHRjb25zdCBvcmlnaW5hbEVycm9ySGFuZGxlciA9IGVycm9ySGFuZGxlci5nZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCk7XG5cdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihlcnJvciA9PiB7XG5cdFx0XHR1bmV4cGVjdGVkV2FybnMucHVzaChlcnJvcik7XG5cdFx0XHRpZiAodW5leHBlY3RlZFdhcm5zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgcnVuKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IHVuaGFuZGxlZFJlamVjdGlvbnMsIHVuZXhwZWN0ZWRXYXJucyB9LCB7XG5cdFx0XHRcdHVuaGFuZGxlZFJlamVjdGlvbnM6IFtdLFxuXHRcdFx0XHR1bmV4cGVjdGVkV2FybnM6IFtwYWludEJvb20sIHBhaW50Qm9vbV0sXG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihvcmlnaW5hbEVycm9ySGFuZGxlcik7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWRSZWplY3Rpb24pO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFxuXHRcdGFwcGx5Q2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W10sXG5cdFx0c3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdLFxuXHRcdHBhaXJpbmdQZW5kaW5nID0gdHJ1ZSxcblx0KTogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIHtcblx0XHRjb25zdCBhY2NlcHRlZFdyaXRlOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCA9IHtcblx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRzdWNjZXNzOiB0cnVlLFxuXHRcdFx0ZXJyb3JNZXNzYWdlOiAnJyxcblx0XHRcdGV4aXRDb2RlOiAwLFxuXHRcdFx0c3Rkb3V0OiAnJyxcblx0XHR9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcgYXMgY29uc3QgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0d3JpdGVHaXRBcHBseUh1bmtzOiBhc3luYyAocmVxdWVzdDogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QpID0+IHtcblx0XHRcdFx0YXBwbHlDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRyZXR1cm4gYWNjZXB0ZWRXcml0ZTtcblx0XHRcdH0sXG5cdFx0XHR3cml0ZUdpdFN0YWdlUGF0aHM6IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdCkgPT4ge1xuXHRcdFx0XHRzdGFnZUNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHJldHVybiBhY2NlcHRlZFdyaXRlO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHR9XG5cblx0Y29uc3QgY2FycmllZFVuaWZpZWREaWZmID0gJ0BAIC0xICsxIEBAXFxuLW9sZFxcbituZXdcXG4nO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcGFpcmluZy1ob2xkIEFjY2VwdCBjaHJvbWUgc3RheXMgaGlkZGVuIGFuZCAwIHVuYXJ5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvbGVmdG92ZXIudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGFwcGx5Q2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gbGVmdG92ZXJMb29rc0xpdmVBcHBseUNvbm5lY3Rpb24oYXBwbHlDYWxscyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGNvbm5lY3Rpb24pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FuU2VuZFNvdXJjZXNHaXRBcHBseUh1bmtzKHRydWUsIHRydWUsIGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbikpLCBmYWxzZSk7XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdH0pKTtcblx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHR9KTtcblx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRjb25zdCBwYW5lbEFjY2VwdCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLWFjY2VwdCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxBY2NlcHQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0Zm9yY2VDbGljayhwYW5lbEFjY2VwdCk7XG5cdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblxuXHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnKSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmUpO1xuXG5cdFx0Y29uc3QgcmV2aWV3QWNjZXB0ID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctYWNjZXB0JykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdBY2NlcHQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0Zm9yY2VDbGljayhyZXZpZXdBY2NlcHQpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQ6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuQWNjZXB0KCk7XG5cdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhcHBseUNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcGFpcmluZy1ob2xkIFN0YWdlIGNocm9tZSBzdGF5cyBoaWRkZW4gYW5kIDAgdW5hcnkgLyAwIGdpdC5zdGFnZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLXN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9sZWZ0b3Zlci1zdGFnZS50cy5naXQnKTtcblx0XHRjb25zdCBhcHBseUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdFN0YWdlQ29tbWFuZHM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihhcHBseUNhbGxzLCBzdGFnZUNhbGxzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5TZW5kU291cmNlc0dpdFN0YWdlUGF0aHModHJ1ZSwgdHJ1ZSwgJ3Nlc3Npb24tMScsIGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbikpLCBmYWxzZSk7XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2dpdC5zdGFnZScpIHtcblx0XHRcdFx0XHRnaXRTdGFnZUNvbW1hbmRzLnB1c2goY29tbWFuZElkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHR9KSk7XG5cdFx0dmlldy5yZW5kZXIoKTtcblx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRvcmlnaW5hbCxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0fSk7XG5cdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cblx0XHRjb25zdCBwYW5lbFN0YWdlID0gdmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0Zm9yY2VDbGljayhwYW5lbFN0YWdlKTtcblx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuU3RhZ2U6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuU3RhZ2UoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YWdlQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdFN0YWdlQ29tbWFuZHMsIFtdKTtcblxuXHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnKSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblxuXHRcdGNvbnN0IHJldmlld1N0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGZvcmNlQ2xpY2socmV2aWV3U3RhZ2UpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxscywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0U3RhZ2VDb21tYW5kcywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXBwbHlDYWxscywgW10pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBsZWZ0b3ZlckNvbm5lY3RlZENvbm5lY3Rpb24oXG5cdFx0cGFpcmluZ1BlbmRpbmc6IGJvb2xlYW4sXG5cdCk6IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiB7XG5cdFx0cmV0dXJuIGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBbXSwgcGFpcmluZ1BlbmRpbmcpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXc6IFNvdXJjZXNEaWZmUGFuZWxWaWV3KTogdm9pZCB7XG5cdFx0Y29uc3QgaG9zdCA9IHZpZXcgYXMgdW5rbm93biBhcyB7IGNvbXBhcmlzb25Mb2FkRmFpbGVkOiBib29sZWFuOyB1cGRhdGVXcml0ZUFjdGlvbnM6ICgpID0+IHZvaWQgfTtcblx0XHRob3N0LmNvbXBhcmlzb25Mb2FkRmFpbGVkID0gZmFsc2U7XG5cdFx0aG9zdC51cGRhdGVXcml0ZUFjdGlvbnMoKTtcblx0fVxuXG5cdHRlc3QoJ0RpZmYgcGFuZWwga2VlcHMgc3RvcmVkIGluZGV4IHdoZW4gbGl2ZSBTQ00gaXMgb25seSB3b3JraW5nVHJlZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1zdGFsZS1yZWYtaW5kZXgudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1zdGFsZS1yZWYtaW5kZXgudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgc3RvcmUpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBjcmVhdGVWaWV3RGVzY3JpcHRvclNlcnZpY2VTdHViKCkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIGNvbm5lY3Rpb24pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZSwge1xuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzaW9uLTEnLFxuXHRcdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlU2Vzc2lvbjogRXZlbnQuTm9uZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU0NNU2VydmljZSwgY3JlYXRlTGl2ZVNjbVNlcnZpY2UocmVzb3VyY2UsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdHN0dWJTZXNzaW9uQW5kQ2hhbmdlc01vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb25uZWN0aW9uLCB0cnVlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbW1hbmRTZXJ2aWNlLCB7XG5cdFx0XHRcdG9uV2lsbEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZEV4ZWN1dGVDb21tYW5kOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0TW9kZWxTZXJ2aWNlLCB7XG5cdFx0XHRcdGNyZWF0ZU1vZGVsUmVmZXJlbmNlOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgY29udGV4dCA9ICh2aWV3IGFzIHVua25vd24gYXMgeyBnZXRXcml0ZUNvbnRleHQ6ICgpID0+IHsgZ3JvdXBJZDogc3RyaW5nIH0gfCB1bmRlZmluZWQgfSkuZ2V0V3JpdGVDb250ZXh0KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dD8uZ3JvdXBJZCwgJ2luZGV4Jyk7XG5cdFx0XHRjb25zdCBwYW5lbFN0YWdlID0gdmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblxuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0RpZmYgcGFuZWwgZG9lcyBub3QgcmVjb3JkIGVuZ2luZSBzdGFnZSBoaWRlIG1hc2sgd2hlbiByZWYgYW5kIGxpdmUgU0NNIGFyZSBpbmRleCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1pbmRleC1vbmx5LnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9lbmdpbmUtc3RhZ2UtaW5kZXgtb25seS50cy5naXQnKTtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICdpbmRleCcsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0Y29uc3QgaG9zdCA9IHZpZXcgYXMgdW5rbm93biBhcyB7IHdyaXRlQ29sbGFwc2U6IHsgbW9kaWZpZWQ6IHN0cmluZzsga2luZDogc3RyaW5nIH0gfCB1bmRlZmluZWQgfTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LndyaXRlQ29sbGFwc2UsIHVuZGVmaW5lZCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdEaWZmIHBhbmVsIGhpZGVzIFN0YWdlIGFmdGVyIGVuZ2luZSBXcml0ZUdpdFN0YWdlUGF0aHMgYWNjZXB0ZWQgdW50aWwgcmVmIGNoYW5nZXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9lbmdpbmUtc3RhZ2UtYWNjZXB0ZWQudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1hY2NlcHRlZC50cy5naXQnKTtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRcdGNvbnN0IHBhbmVsU3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cblx0XHRcdGNvbnN0IG90aGVyID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZW5naW5lLXN0YWdlLW90aGVyLnRzJyk7XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiBvdGhlcixcblx0XHRcdFx0b3JpZ2luYWw6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2VuZ2luZS1zdGFnZS1vdGhlci50cy5naXQnKSxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZT8uc3R5bGUuZGlzcGxheSwgJycpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRGlmZiBwYW5lbCBoaWRlcyBSZXZlcnQgYWZ0ZXIgZ2l0LmNsZWFuIHN1Y2NlZWRzIHVudGlsIHJlZiBjaGFuZ2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LWNsZWFuLXJldmVydC1oaWRlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtY2xlYW4tcmV2ZXJ0LWhpZGUudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgZ3JvdXAgPSB7XG5cdFx0XHRpZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdGxhYmVsOiAnQ2hhbmdlcycsXG5cdFx0XHRyZXNvdXJjZXM6IFtdIGFzIElTQ01SZXNvdXJjZVtdLFxuXHRcdH07XG5cdFx0Y29uc3QgY2FjaGVkU2NtUmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogZ3JvdXAsXG5cdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRvcGVuOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblx0XHRncm91cC5yZXNvdXJjZXMucHVzaChjYWNoZWRTY21SZXNvdXJjZSk7XG5cdFx0Y29uc3Qgc2NtU2VydmljZSA9IHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdHByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0XHRncm91cHM6IFtncm91cF0sXG5cdFx0XHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cblx0XHRjb25zdCBjbGVhbkNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LmNsZWFuJywgKCkgPT4ge1xuXHRcdFx0Z3JvdXAucmVzb3VyY2VzLmxlbmd0aCA9IDA7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZGlzY29ubmVjdGVkQ29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHt9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uOiBkaXNjb25uZWN0ZWRDb25uZWN0aW9uLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBzY21TZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IGNhY2hlZFNjbVJlc291cmNlLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxSZXZlcnQgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1yZXZlcnQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblxuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LmNsZWFuJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFJldmVydD8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblxuXHRcdFx0Y29uc3Qgb3RoZXIgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtY2xlYW4tcmV2ZXJ0LW90aGVyLnRzJyk7XG5cdFx0XHRjb25zdCBvdGhlck9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LWNsZWFuLXJldmVydC1vdGhlci50cy5naXQnKTtcblx0XHRcdGNvbnN0IG90aGVyU2NtUmVzb3VyY2UgPSB7XG5cdFx0XHRcdHNvdXJjZVVyaTogb3RoZXIsXG5cdFx0XHRcdHJlc291cmNlR3JvdXA6IGdyb3VwLFxuXHRcdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJU0NNUmVzb3VyY2U7XG5cdFx0XHRncm91cC5yZXNvdXJjZXMucHVzaChvdGhlclNjbVJlc291cmNlKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IG90aGVyLFxuXHRcdFx0XHRvcmlnaW5hbDogb3RoZXJPcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IG90aGVyU2NtUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsUmV2ZXJ0Py5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGNsZWFuQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdDb252ZXJzYXRpb24gaGlkZXMgUmV2ZXJ0IGFmdGVyIGdpdC5jbGVhbiBzdWNjZWVkcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2NvbnZlcnNhdGlvbi1yZXZlcnQtaGlkZS50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvY29udmVyc2F0aW9uLXJldmVydC1oaWRlLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGNsZWFuQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuY2xlYW4nLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld1JldmVydCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC5jbGVhbicpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV2aWV3UmV2ZXJ0Py5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRjbGVhbkNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRGlmZiBwYW5lbCBoaWRlcyBVbnN0YWdlIGFmdGVyIGdpdC51bnN0YWdlIHN1Y2NlZWRzIHVudGlsIHJlZiBjaGFuZ2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LXVuc3RhZ2UtaGlkZS50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LXVuc3RhZ2UtaGlkZS50cy5naXQnKTtcblx0XHRjb25zdCBncm91cCA9IHtcblx0XHRcdGlkOiAnaW5kZXgnLFxuXHRcdFx0bGFiZWw6ICdTdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRyZXNvdXJjZXM6IFtdIGFzIElTQ01SZXNvdXJjZVtdLFxuXHRcdH07XG5cdFx0Y29uc3QgY2FjaGVkU2NtUmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogZ3JvdXAsXG5cdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRvcGVuOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblx0XHRncm91cC5yZXNvdXJjZXMucHVzaChjYWNoZWRTY21SZXNvdXJjZSk7XG5cdFx0Y29uc3Qgc2NtU2VydmljZSA9IHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdHByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0XHRncm91cHM6IFtncm91cF0sXG5cdFx0XHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cblx0XHRjb25zdCB1bnN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQudW5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0Y29uc3QgZGlzY29ubmVjdGVkQ29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHt9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRjb25uZWN0aW9uOiBkaXNjb25uZWN0ZWRDb25uZWN0aW9uLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBzY21TZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IGNhY2hlZFNjbVJlc291cmNlLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxVbnN0YWdlID0gdmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdW5zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblxuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LnVuc3RhZ2UnKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsVW5zdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblxuXHRcdFx0Y29uc3Qgb3RoZXIgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtdW5zdGFnZS1vdGhlci50cycpO1xuXHRcdFx0Y29uc3Qgb3RoZXJPcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2dpdC11bnN0YWdlLW90aGVyLnRzLmdpdCcpO1xuXHRcdFx0Y29uc3Qgb3RoZXJTY21SZXNvdXJjZSA9IHtcblx0XHRcdFx0c291cmNlVXJpOiBvdGhlcixcblx0XHRcdFx0cmVzb3VyY2VHcm91cDogZ3JvdXAsXG5cdFx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdFx0b3BlbjogYXN5bmMgKCkgPT4geyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblx0XHRcdGdyb3VwLnJlc291cmNlcy5wdXNoKG90aGVyU2NtUmVzb3VyY2UpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogb3RoZXIsXG5cdFx0XHRcdG9yaWdpbmFsOiBvdGhlck9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRzY21SZXNvdXJjZTogb3RoZXJTY21SZXNvdXJjZSxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHVuc3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0RpZmYgcGFuZWwga2VlcHMgY2FjaGVkIGluZGV4IGdyb3VwIHdoZW4gdGhhdCBVUkkgbm93IGxpdmVzIG9ubHkgaW4gd29ya2luZ1RyZWUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9saXZlLXNjbS1hZnRlci11bnN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9saXZlLXNjbS1hZnRlci11bnN0YWdlLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGluZGV4R3JvdXAgPSB7XG5cdFx0XHRpZDogJ2luZGV4Jyxcblx0XHRcdGxhYmVsOiAnU3RhZ2VkIENoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGNhY2hlZFNjbVJlc291cmNlID0ge1xuXHRcdFx0c291cmNlVXJpOiByZXNvdXJjZSxcblx0XHRcdHJlc291cmNlR3JvdXA6IGluZGV4R3JvdXAsXG5cdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRvcGVuOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblx0XHRjb25zdCB3b3JraW5nVHJlZUdyb3VwID0ge1xuXHRcdFx0aWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRsYWJlbDogJ0NoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGxpdmVTY21SZXNvdXJjZSA9IHtcblx0XHRcdHNvdXJjZVVyaTogcmVzb3VyY2UsXG5cdFx0XHRyZXNvdXJjZUdyb3VwOiB3b3JraW5nVHJlZUdyb3VwLFxuXHRcdFx0ZGVjb3JhdGlvbnM6IHt9LFxuXHRcdFx0b3BlbjogYXN5bmMgKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU0NNUmVzb3VyY2U7XG5cdFx0d29ya2luZ1RyZWVHcm91cC5yZXNvdXJjZXMucHVzaChsaXZlU2NtUmVzb3VyY2UpO1xuXHRcdGNvbnN0IHNjbVNlcnZpY2UgPSB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXQgcmVwb3NpdG9yaWVzKCkge1xuXHRcdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0XHRwcm92aWRlcjoge1xuXHRcdFx0XHRcdFx0Z3JvdXBzOiBbaW5kZXhHcm91cCwgd29ya2luZ1RyZWVHcm91cF0sXG5cdFx0XHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cblx0XHRjb25zdCBzdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHRjb25zdCBkaXNjb25uZWN0ZWRDb25uZWN0aW9uID0ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoe30pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb246IGRpc2Nvbm5lY3RlZENvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNDTVNlcnZpY2UsIHNjbVNlcnZpY2UpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRzY21SZXNvdXJjZTogY2FjaGVkU2NtUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBjb250ZXh0ID0gKHZpZXcgYXMgdW5rbm93biBhcyB7IGdldFdyaXRlQ29udGV4dDogKCkgPT4geyBncm91cElkOiBzdHJpbmc7IHNjbVJlc291cmNlPzogSVNDTVJlc291cmNlIH0gfCB1bmRlZmluZWQgfSkuZ2V0V3JpdGVDb250ZXh0KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dD8uZ3JvdXBJZCwgJ2luZGV4Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dD8uc2NtUmVzb3VyY2UsIGNhY2hlZFNjbVJlc291cmNlKTtcblxuXHRcdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0Y29uc3QgcGFuZWxVbnN0YWdlID0gdmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtdW5zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsVW5zdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0RpZmYgcGFuZWwgd3JpdGUgY2hyb21lIGZhbGxzIGJhY2sgdG8gcmVmIHNjbVJlc291cmNlIHdoZW4gVVJJIGlzIGFic2VudCBmcm9tIFNDTScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlZi1zY20tZmFsbGJhY2sudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlZi1zY20tZmFsbGJhY2sudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgaW5kZXhHcm91cCA9IHtcblx0XHRcdGlkOiAnaW5kZXgnLFxuXHRcdFx0bGFiZWw6ICdTdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRyZXNvdXJjZXM6IFtdIGFzIElTQ01SZXNvdXJjZVtdLFxuXHRcdH07XG5cdFx0Y29uc3QgY2FjaGVkU2NtUmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogaW5kZXhHcm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGNvbnN0IHNjbVNlcnZpY2UgPSB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXQgcmVwb3NpdG9yaWVzKCkge1xuXHRcdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0XHRwcm92aWRlcjoge1xuXHRcdFx0XHRcdFx0Z3JvdXBzOiBbaW5kZXhHcm91cF0sXG5cdFx0XHRcdFx0XHRyb290VXJpOiByZXNvdXJjZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRcdFx0b25EaWRDaGFuZ2VSZXNvdXJjZUdyb3VwczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMTsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2U7XG5cblx0XHRjb25zdCB1bnN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQudW5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0Y29uc3QgZGlzY29ubmVjdGVkQ29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHt9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRjb25uZWN0aW9uOiBkaXNjb25uZWN0ZWRDb25uZWN0aW9uLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCBzY21TZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IGNhY2hlZFNjbVJlc291cmNlLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgY29udGV4dCA9ICh2aWV3IGFzIHVua25vd24gYXMgeyBnZXRXcml0ZUNvbnRleHQ6ICgpID0+IHsgZ3JvdXBJZDogc3RyaW5nIH0gfCB1bmRlZmluZWQgfSkuZ2V0V3JpdGVDb250ZXh0KCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dD8uZ3JvdXBJZCwgJ2luZGV4Jyk7XG5cblx0XHRcdGNvbnN0IHBhbmVsU3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHBhbmVsVW5zdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dW5zdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnb3BlbmVkIHdvcmtpbmdUcmVlIHNob3dzIFJldmVydCBhbmQgZW5naW5lIEZpbGVEaWZmIHdpdGhvdXQgc2NtUmVzb3VyY2UgZG9lcyBub3QgdGFrZSBpbmRleCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2JvdGgtZ3JvdXBzLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9ib3RoLWdyb3Vwcy50cy5naXQnKTtcblx0XHRjb25zdCBpbmRleEdyb3VwID0ge1xuXHRcdFx0aWQ6ICdpbmRleCcsXG5cdFx0XHRsYWJlbDogJ1N0YWdlZCBDaGFuZ2VzJyxcblx0XHRcdHJlc291cmNlczogW10gYXMgSVNDTVJlc291cmNlW10sXG5cdFx0fTtcblx0XHRjb25zdCB3b3JraW5nVHJlZUdyb3VwID0ge1xuXHRcdFx0aWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRsYWJlbDogJ0NoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGluZGV4UmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogaW5kZXhHcm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGNvbnN0IHdvcmtpbmdUcmVlUmVzb3VyY2UgPSB7XG5cdFx0XHRzb3VyY2VVcmk6IHJlc291cmNlLFxuXHRcdFx0cmVzb3VyY2VHcm91cDogd29ya2luZ1RyZWVHcm91cCxcblx0XHRcdGRlY29yYXRpb25zOiB7fSxcblx0XHRcdG9wZW46IGFzeW5jICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVJlc291cmNlO1xuXHRcdGluZGV4R3JvdXAucmVzb3VyY2VzLnB1c2goaW5kZXhSZXNvdXJjZSk7XG5cdFx0d29ya2luZ1RyZWVHcm91cC5yZXNvdXJjZXMucHVzaCh3b3JraW5nVHJlZVJlc291cmNlKTtcblx0XHRjb25zdCBzY21TZXJ2aWNlID0ge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IHJlcG9zaXRvcmllcygpIHtcblx0XHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdFx0cHJvdmlkZXI6IHtcblx0XHRcdFx0XHRcdGdyb3VwczogW2luZGV4R3JvdXAsIHdvcmtpbmdUcmVlR3JvdXBdLFxuXHRcdFx0XHRcdFx0cm9vdFVyaTogcmVzb3VyY2UsXG5cdFx0XHRcdFx0XHRvbkRpZENoYW5nZVJlc291cmNlczogRXZlbnQuTm9uZSxcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlUmVzb3VyY2VHcm91cHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fV07XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHJlcG9zaXRvcnlDb3VudCgpIHsgcmV0dXJuIDE7IH0sXG5cdFx0XHRvbkRpZEFkZFJlcG9zaXRvcnk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZFJlbW92ZVJlcG9zaXRvcnk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRyZWdpc3RlclNDTVByb3ZpZGVyOiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH0sXG5cdFx0XHRnZXRSZXBvc2l0b3J5OiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01TZXJ2aWNlO1xuXHRcdGNvbnN0IGNsZWFuQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuY2xlYW4nLCAoKSA9PiB7IH0pO1xuXHRcdGNvbnN0IHVuc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC51bnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHRjb25zdCBkaXNjb25uZWN0ZWRDb25uZWN0aW9uID0ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoe30pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb246IGRpc2Nvbm5lY3RlZENvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNDTVNlcnZpY2UsIHNjbVNlcnZpY2UpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0c2NtUmVzb3VyY2U6IHdvcmtpbmdUcmVlUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbENvbnRleHQgPSAodmlldyBhcyB1bmtub3duIGFzIHsgZ2V0V3JpdGVDb250ZXh0OiAoKSA9PiB7IGdyb3VwSWQ6IHN0cmluZzsgc2NtUmVzb3VyY2U/OiBJU0NNUmVzb3VyY2U7IHBhdGg6IHN0cmluZyB9IHwgdW5kZWZpbmVkIH0pLmdldFdyaXRlQ29udGV4dCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsQ29udGV4dD8uZ3JvdXBJZCwgJ3dvcmtpbmdUcmVlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxDb250ZXh0Py5zY21SZXNvdXJjZSwgd29ya2luZ1RyZWVSZXNvdXJjZSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocGFuZWxDb250ZXh0Py5zY21SZXNvdXJjZSwgaW5kZXhSZXNvdXJjZSk7XG5cdFx0XHRjb25zdCBwYW5lbFJldmVydCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHBhbmVsVW5zdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cblx0XHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJykpO1xuXHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblx0XHRcdGNvbnN0IGZhY3RzID0gKHBhbmUgYXMgdW5rbm93biBhcyB7IGN1cnJlbnRXcml0ZUZhY3RzOiAoKSA9PiB7IGdyb3VwSWQ6IHN0cmluZzsgc2NtUmVzb3VyY2U/OiBJU0NNUmVzb3VyY2U7IHBhdGg6IHN0cmluZyB9IHwgdW5kZWZpbmVkIH0pLmN1cnJlbnRXcml0ZUZhY3RzKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmFjdHM/Lmdyb3VwSWQsICd3b3JraW5nVHJlZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZhY3RzPy5zY21SZXNvdXJjZSwgd29ya2luZ1RyZWVSZXNvdXJjZSk7XG5cdFx0XHRjb25zdCByZXZpZXdSZXZlcnQgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1yZXZlcnQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRjb25zdCByZXZpZXdVbnN0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctdW5zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0Y29uc3QgbW92ZWQgPSByZXNvbHZlU291cmNlc0NoYW5nZVJlZkZyb21FZGl0b3IoaW5wdXQsIHNjbVNlcnZpY2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vdmVkPy5ncm91cElkLCAnd29ya2luZ1RyZWUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb3ZlZD8uc2NtUmVzb3VyY2UsIHdvcmtpbmdUcmVlUmVzb3VyY2UpO1xuXG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRcdGdpdFBhdGg6ICdzcmMvYm90aC1ncm91cHMudHMnLFxuXHRcdFx0XHRpbmRleFN0YXRlOiAnV09SS1RSRUUnLFxuXHRcdFx0XHRraW5kOiAnTU9ESUZJRUQnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblx0XHRcdGNvbnN0IGVuZ2luZUNvbnRleHQgPSAodmlldyBhcyB1bmtub3duIGFzIHsgZ2V0V3JpdGVDb250ZXh0OiAoKSA9PiB7IGdyb3VwSWQ6IHN0cmluZzsgc2NtUmVzb3VyY2U/OiBJU0NNUmVzb3VyY2U7IHBhdGg6IHN0cmluZyB9IHwgdW5kZWZpbmVkIH0pLmdldFdyaXRlQ29udGV4dCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUNvbnRleHQ/Lmdyb3VwSWQsICd3b3JraW5nVHJlZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUNvbnRleHQ/LnNjbVJlc291cmNlLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUNvbnRleHQ/LnBhdGgsICdzcmMvYm90aC1ncm91cHMudHMnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFJldmVydD8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cblx0XHRcdGNvbnN0IGVuZ2luZUlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnLCB7XG5cdFx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRcdGdpdFBhdGg6ICdzcmMvYm90aC1ncm91cHMudHMnLFxuXHRcdFx0XHRpbmRleFN0YXRlOiAnV09SS1RSRUUnLFxuXHRcdFx0XHRraW5kOiAnTU9ESUZJRUQnLFxuXHRcdFx0fSkpO1xuXHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChlbmdpbmVJbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblx0XHRcdGNvbnN0IGVuZ2luZUZhY3RzID0gKHBhbmUgYXMgdW5rbm93biBhcyB7IGN1cnJlbnRXcml0ZUZhY3RzOiAoKSA9PiB7IGdyb3VwSWQ6IHN0cmluZzsgc2NtUmVzb3VyY2U/OiBJU0NNUmVzb3VyY2U7IHBhdGg6IHN0cmluZyB9IHwgdW5kZWZpbmVkIH0pLmN1cnJlbnRXcml0ZUZhY3RzKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5naW5lRmFjdHM/Lmdyb3VwSWQsICd3b3JraW5nVHJlZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZUZhY3RzPy5zY21SZXNvdXJjZSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbmdpbmVGYWN0cz8ucGF0aCwgJ3NyYy9ib3RoLWdyb3Vwcy50cycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1JldmVydD8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0Y29uc3QgZW5naW5lTW92ZWQgPSByZXNvbHZlU291cmNlc0NoYW5nZVJlZkZyb21FZGl0b3IoZW5naW5lSW5wdXQsIHNjbVNlcnZpY2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVuZ2luZU1vdmVkPy5ncm91cElkLCAnd29ya2luZ1RyZWUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbmdpbmVNb3ZlZD8uc2NtUmVzb3VyY2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5naW5lTW92ZWQ/LmdpdFBhdGgsICdzcmMvYm90aC1ncm91cHMudHMnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Y2xlYW5Db21tYW5kLmRpc3Bvc2UoKTtcblx0XHRcdHVuc3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0RpZmYgcGFuZWwga2VlcHMgVW5zdGFnZSB2aXNpYmxlIHdoZW4gZ2l0LnVuc3RhZ2UgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtdW5zdGFnZS1mYWlsLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9naXQtdW5zdGFnZS1mYWlsLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGNhY2hlZFNjbVJlc291cmNlID0ge1xuXHRcdFx0c291cmNlVXJpOiByZXNvdXJjZSxcblx0XHRcdHJlc291cmNlR3JvdXA6IHsgaWQ6ICdpbmRleCcsIGxhYmVsOiAnU3RhZ2VkIENoYW5nZXMnLCByZXNvdXJjZXM6IFtdIGFzIElTQ01SZXNvdXJjZVtdIH0sXG5cdFx0XHRkZWNvcmF0aW9uczoge30sXG5cdFx0XHRvcGVuOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZTtcblxuXHRcdGNvbnN0IHVuc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC51bnN0YWdlJywgKCkgPT4ge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCd1bnN0YWdlIGZhaWxlZCcpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGRpc2Nvbm5lY3RlZENvbm5lY3Rpb24gPSB7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7fSksXG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbjtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0Y29ubmVjdGlvbjogZGlzY29ubmVjdGVkQ29ubmVjdGlvbixcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24sIC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0XHRcdGlmIChjb21tYW5kSWQgPT09ICdnaXQudW5zdGFnZScpIHtcblx0XHRcdFx0XHRcdGF3YWl0IENvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZCgnZ2l0LnVuc3RhZ2UnKT8uaGFuZGxlciEodW5kZWZpbmVkIGFzIHVua25vd24gYXMgU2VydmljZXNBY2Nlc3NvciwgLi4uYXJncyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICdpbmRleCcsXG5cdFx0XHRcdHNjbVJlc291cmNlOiBjYWNoZWRTY21SZXNvdXJjZSxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRcdGNvbnN0IHBhbmVsVW5zdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC51bnN0YWdlJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFVuc3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dW5zdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnRGlmZiBwYW5lbCBrZWVwcyBSZXZlcnQgdmlzaWJsZSB3aGVuIGdpdC5jbGVhbiBmYWlscycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2dpdC1jbGVhbi1yZXZlcnQtZmFpbC50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZ2l0LWNsZWFuLXJldmVydC1mYWlsLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGdyb3VwID0ge1xuXHRcdFx0aWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRsYWJlbDogJ0NoYW5nZXMnLFxuXHRcdFx0cmVzb3VyY2VzOiBbXSBhcyBJU0NNUmVzb3VyY2VbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGNhY2hlZFNjbVJlc291cmNlID0ge1xuXHRcdFx0c291cmNlVXJpOiByZXNvdXJjZSxcblx0XHRcdHJlc291cmNlR3JvdXA6IGdyb3VwLFxuXHRcdFx0ZGVjb3JhdGlvbnM6IHt9LFxuXHRcdFx0b3BlbjogYXN5bmMgKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU0NNUmVzb3VyY2U7XG5cdFx0Z3JvdXAucmVzb3VyY2VzLnB1c2goY2FjaGVkU2NtUmVzb3VyY2UpO1xuXG5cdFx0Y29uc3QgY2xlYW5Db21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5jbGVhbicsICgpID0+IHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignY2xlYW4gZmFpbGVkJyk7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZGlzY29ubmVjdGVkQ29ubmVjdGlvbiA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHt9KSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uOiBkaXNjb25uZWN0ZWRDb25uZWN0aW9uLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKGNvbW1hbmRJZDogdW5rbm93biwgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2dpdC5jbGVhbicpIHtcblx0XHRcdFx0XHRcdGF3YWl0IENvbW1hbmRzUmVnaXN0cnkuZ2V0Q29tbWFuZCgnZ2l0LmNsZWFuJyk/LmhhbmRsZXIhKHVuZGVmaW5lZCBhcyB1bmtub3duIGFzIFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3MpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRzY21SZXNvdXJjZTogY2FjaGVkU2NtUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbFJldmVydCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFJldmVydD8uc3R5bGUuZGlzcGxheSwgJycpO1xuXG5cdFx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuR2l0QWN0aW9uOiAoY29tbWFuZElkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfSkucnVuR2l0QWN0aW9uKCdnaXQuY2xlYW4nKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsUmV2ZXJ0Py5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGNsZWFuQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdEaWZmIHBhbmVsIGtlZXBzIFN0YWdlIHZpc2libGUgd2hlbiBXcml0ZUdpdFN0YWdlUGF0aHMgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9lbmdpbmUtc3RhZ2UtZmFpbC50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZW5naW5lLXN0YWdlLWZhaWwudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IGZhaWxlZFdyaXRlOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCA9IHtcblx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRzdWNjZXNzOiBmYWxzZSxcblx0XHRcdGVycm9yTWVzc2FnZTogJ3N0YWdlIGZhaWxlZCcsXG5cdFx0XHRleGl0Q29kZTogMSxcblx0XHRcdHN0ZG91dDogJycsXG5cdFx0fTtcblx0XHRjb25uZWN0aW9uLndyaXRlR2l0U3RhZ2VQYXRocyA9IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdCkgPT4ge1xuXHRcdFx0c3RhZ2VDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0cmV0dXJuIGZhaWxlZFdyaXRlO1xuXHRcdH07XG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRcdGNvbnN0IHBhbmVsU3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1JldmlldyBwYW5lIGhpZGVzIFN0YWdlIGFmdGVyIGVuZ2luZSBXcml0ZUdpdFN0YWdlUGF0aHMgYWNjZXB0ZWQgdW50aWwgbW9kaWZpZWQgY2hhbmdlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3Jldmlldy1lbmdpbmUtc3RhZ2UtYWNjZXB0ZWQudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3Jldmlldy1lbmdpbmUtc3RhZ2UtYWNjZXB0ZWQudHMuZ2l0Jyk7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld1N0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRjb25zdCByZXZpZXdVbnN0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctdW5zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdTdGFnZT8uc3R5bGUuZGlzcGxheSwgJycpO1xuXG5cdFx0XHRhd2FpdCAocGFuZSBhcyB1bmtub3duIGFzIHsgcnVuU3RhZ2U6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuU3RhZ2UoKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5vayghcmV2aWV3VW5zdGFnZSB8fCByZXZpZXdVbnN0YWdlLnN0eWxlLmRpc3BsYXkgPT09ICdub25lJyk7XG5cblx0XHRcdGNvbnN0IG90aGVyUmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9yZXZpZXctZW5naW5lLXN0YWdlLW90aGVyLnRzJyk7XG5cdFx0XHRjb25zdCBvdGhlck9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvcmV2aWV3LWVuZ2luZS1zdGFnZS1vdGhlci50cy5naXQnKTtcblx0XHRcdGNvbnN0IG90aGVySW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChvdGhlclJlc291cmNlLCBvdGhlck9yaWdpbmFsLCAnd29ya2luZ1RyZWUnKSk7XG5cdFx0XHRhd2FpdCBwYW5lLnNldElucHV0KG90aGVySW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV2aWV3U3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1JldmlldyBwYW5lIGtlZXBzIFN0YWdlIHZpc2libGUgd2hlbiBXcml0ZUdpdFN0YWdlUGF0aHMgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9yZXZpZXctZW5naW5lLXN0YWdlLWZhaWwudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3Jldmlldy1lbmdpbmUtc3RhZ2UtZmFpbC50cy5naXQnKTtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3QgZmFpbGVkV3JpdGU6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFdyaXRlUmVzdWx0ID0ge1xuXHRcdFx0c3VwcG9ydGVkOiB0cnVlLFxuXHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdHN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0ZXJyb3JNZXNzYWdlOiAnc3RhZ2UgZmFpbGVkJyxcblx0XHRcdGV4aXRDb2RlOiAxLFxuXHRcdFx0c3Rkb3V0OiAnJyxcblx0XHR9O1xuXHRcdGNvbm5lY3Rpb24ud3JpdGVHaXRTdGFnZVBhdGhzID0gYXN5bmMgKHJlcXVlc3Q6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0KSA9PiB7XG5cdFx0XHRzdGFnZUNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRyZXR1cm4gZmFpbGVkV3JpdGU7XG5cdFx0fTtcblx0XHRjb25zdCBzdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblx0XHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVzb3VyY2UsIG9yaWdpbmFsLCAnd29ya2luZ1RyZWUnKSk7XG5cdFx0XHRhd2FpdCBwYW5lLnNldElucHV0KGlucHV0LCB1bmRlZmluZWQsIE9iamVjdC5jcmVhdGUobnVsbCksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmUpO1xuXG5cdFx0XHRjb25zdCByZXZpZXdTdGFnZSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlPy5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRmdW5jdGlvbiBwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmU6IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lKTogdm9pZCB7XG5cdFx0Y29uc3QgaG9zdCA9IHBhbmUgYXMgdW5rbm93biBhcyB7IGNvbXBhcmlzb25Mb2FkRmFpbGVkOiBib29sZWFuOyB1cGRhdGVSZXZpZXdBY3Rpb25zOiAoKSA9PiB2b2lkIH07XG5cdFx0aG9zdC5jb21wYXJpc29uTG9hZEZhaWxlZCA9IGZhbHNlO1xuXHRcdGhvc3QudXBkYXRlUmV2aWV3QWN0aW9ucygpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3R1YkVuZ2luZUxpdmVDaGFuZ2VzTW9kZWwoXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlPixcblx0XHRzZXNzaW9uSWQgPSAnc2Vzc2lvbi0xJyxcblx0KTogdm9pZCB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0NoYW5nZXNNb2RlbCwge1xuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRnZXRTbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Z2VuZXJhdGlvbjogMSxcblx0XHRcdFx0c2V0dGxlZDogdHJ1ZSxcblx0XHRcdFx0c3RhdGU6IHsga2luZDogJ2VuZ2luZS1saXZlJywgc2Vzc2lvbklkIH0sXG5cdFx0XHRcdGVudHJpZXM6IFtdLFxuXHRcdFx0fSksXG5cdFx0XHRpc1dyaXRlQ2xvc2VkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGlzRmlsZURpZmZPcGVuU2tpcHBlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRyZWZyZXNoOiBhc3luYyAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRzY2hlZHVsZVJlZnJlc2g6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdGZsdXNoU2NoZWR1bGVkUmVmcmVzaDogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU291cmNlc0NoYW5nZXNNb2RlbCk7XG5cdH1cblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIHBhaXJpbmctaG9sZCBTdGFnZSB3aXRoIGxvY2FsIFNDTSBzdGF5cyBoaWRkZW4gYW5kIDAgZ2l0LnN0YWdlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvbGVmdG92ZXItc2NtLXN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9sZWZ0b3Zlci1zY20tc3RhZ2UudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IHN0YWdlQ2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBnaXRTdGFnZUNvbW1hbmRzOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gbGVmdG92ZXJMb29rc0xpdmVBcHBseUNvbm5lY3Rpb24oYXBwbHlDYWxscywgc3RhZ2VDYWxscyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSwgJ2xlZnRvdmVyLWxvb2tzLWxpdmUgZml4dHVyZSBtdXN0IGtlZXAgaXNFbmdpbmVDb25uZWN0ZWQoKT09PXRydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbiksIHRydWUpO1xuXG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2dpdC5zdGFnZScpIHtcblx0XHRcdFx0XHRcdGdpdFN0YWdlQ29tbWFuZHMucHVzaChjb21tYW5kSWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRmb3JjZUNsaWNrKHBhbmVsU3RhZ2UpO1xuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRTdGFnZUNvbW1hbmRzLCBbXSk7XG5cblx0XHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJykpO1xuXHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblxuXHRcdFx0Y29uc3QgcmV2aWV3U3RhZ2UgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGZvcmNlQ2xpY2socmV2aWV3U3RhZ2UpO1xuXHRcdFx0YXdhaXQgKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRTdGFnZUNvbW1hbmRzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RhZ2VDb21tYW5kLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcGFpcmluZy1ob2xkIFVuc3RhZ2UgLyBSZXZlcnQgY2hyb21lIHN0YXlzIGhpZGRlbiBhbmQgMCBnaXQudW5zdGFnZSAvIGdpdC5jbGVhbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLXVuc3RhZ2UudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLXVuc3RhZ2UudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgZ2l0TXV0YXRlQ29tbWFuZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyQ29ubmVjdGVkQ29ubmVjdGlvbih0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbiksIHRydWUpO1xuXG5cdFx0Y29uc3QgdW5zdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnVuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdGNvbnN0IGNsZWFuQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuY2xlYW4nLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKGNvbW1hbmRJZDogdW5rbm93bikgPT4ge1xuXHRcdFx0XHRcdGlmIChjb21tYW5kSWQgPT09ICdnaXQudW5zdGFnZScgfHwgY29tbWFuZElkID09PSAnZ2l0LmNsZWFuJykge1xuXHRcdFx0XHRcdFx0Z2l0TXV0YXRlQ29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbFJldmVydCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHBhbmVsVW5zdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXVuc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0Zm9yY2VDbGljayhwYW5lbFJldmVydCk7XG5cdFx0XHRmb3JjZUNsaWNrKHBhbmVsVW5zdGFnZSk7XG5cdFx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuR2l0QWN0aW9uOiAoY29tbWFuZElkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfSkucnVuR2l0QWN0aW9uKCdnaXQuY2xlYW4nKTtcblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC51bnN0YWdlJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnaXRNdXRhdGVDb21tYW5kcy5sZW5ndGgsIDApO1xuXG5cdFx0XHRjb25zdCBpbmRleEluc3RhbnRpYXRpb24gPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0XHRpZiAoY29tbWFuZElkID09PSAnZ2l0LnVuc3RhZ2UnIHx8IGNvbW1hbmRJZCA9PT0gJ2dpdC5jbGVhbicpIHtcblx0XHRcdFx0XHRcdGdpdE11dGF0ZUNvbW1hbmRzLnB1c2goU3RyaW5nKGNvbW1hbmRJZCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aW5kZXhJbnN0YW50aWF0aW9uLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGluZGV4UGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluZGV4SW5zdGFudGlhdGlvbi5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5kZXhJbnN0YW50aWF0aW9uLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBpbmRleFBhbmVsU2VydmljZSk7XG5cdFx0XHRjb25zdCBpbmRleFZpZXcgPSBzdG9yZS5hZGQoaW5kZXhJbnN0YW50aWF0aW9uLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdGluZGV4Vmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IGluZGV4UGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZShpbmRleFZpZXcpO1xuXHRcdFx0Y29uc3QgaW5kZXhVbnN0YWdlID0gaW5kZXhWaWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC11bnN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluZGV4VW5zdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGZvcmNlQ2xpY2soaW5kZXhVbnN0YWdlKTtcblx0XHRcdGF3YWl0IChpbmRleFZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LnVuc3RhZ2UnKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRNdXRhdGVDb21tYW5kcywgW10pO1xuXG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld1JldmVydCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHJldmlld1Vuc3RhZ2UgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy11bnN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1JldmVydD8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdVbnN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdFx0Zm9yY2VDbGljayhyZXZpZXdSZXZlcnQpO1xuXHRcdFx0Zm9yY2VDbGljayhyZXZpZXdVbnN0YWdlKTtcblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC5jbGVhbicpO1xuXHRcdFx0YXdhaXQgKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LnVuc3RhZ2UnKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRNdXRhdGVDb21tYW5kcywgW10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR1bnN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0XHRjbGVhbkNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgaGlkZXMgRGlmZiBTdGFnZSAvIFJldmVydCAvIFVuc3RhZ2UgY2hyb21lIGFuZCBzdGF5cyAwIHdyaXRlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLWtlZXAudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2xlZnRvdmVyLWtlZXAudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IHN0YWdlQ2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBnaXRNdXRhdGVDb21tYW5kczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gbGVmdG92ZXJMb29rc0xpdmVBcHBseUNvbm5lY3Rpb24oYXBwbHlDYWxscywgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25uZWN0aW9uLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoY29ubmVjdGlvbiksIGZhbHNlKTtcblxuXHRcdGNvbnN0IHVuc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC51bnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHRjb25zdCBjbGVhbkNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LmNsZWFuJywgKCkgPT4geyB9KTtcblx0XHRjb25zdCBzdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnN0YWdlJywgKCkgPT4geyB9KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBmYWxzZSxcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0XHRpZiAoY29tbWFuZElkID09PSAnZ2l0LnVuc3RhZ2UnIHx8IGNvbW1hbmRJZCA9PT0gJ2dpdC5jbGVhbicgfHwgY29tbWFuZElkID09PSAnZ2l0LnN0YWdlJykge1xuXHRcdFx0XHRcdFx0Z2l0TXV0YXRlQ29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci5nZXQoSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UpLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0Y29uc3QgcGFuZWxSZXZlcnQgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1yZXZlcnQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRjb25zdCBwYW5lbFVuc3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC11bnN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhc3NlcnQub2soIXBhbmVsVW5zdGFnZSB8fCBwYW5lbFVuc3RhZ2Uuc3R5bGUuZGlzcGxheSA9PT0gJ25vbmUnKTtcblx0XHRcdGZvcmNlQ2xpY2socGFuZWxTdGFnZSk7XG5cdFx0XHRmb3JjZUNsaWNrKHBhbmVsUmV2ZXJ0KTtcblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LmNsZWFuJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXBwbHlDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdGFnZUNhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdE11dGF0ZUNvbW1hbmRzLCBbXSk7XG5cblx0XHRcdGNvbnN0IHBhbmUgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApKSk7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHJlc291cmNlLCBvcmlnaW5hbCwgJ3dvcmtpbmdUcmVlJykpO1xuXHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblxuXHRcdFx0Y29uc3QgcmV2aWV3U3RhZ2UgPSBwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGNvbnN0IHJldmlld1JldmVydCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdTdGFnZT8uc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRmb3JjZUNsaWNrKHJldmlld1N0YWdlKTtcblx0XHRcdGZvcmNlQ2xpY2socmV2aWV3UmV2ZXJ0KTtcblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXdhaXQgKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LnVuc3RhZ2UnKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhcHBseUNhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YWdlQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0TXV0YXRlQ29tbWFuZHMsIFtdKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dW5zdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdFx0Y2xlYW5Db21tYW5kLmRpc3Bvc2UoKTtcblx0XHRcdHN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgbGVmdG92ZXIgd2l0aG91dCBwYWlyaW5nIFVuc3RhZ2UgLyBSZXZlcnQgc3RpbGwgcnVuIGdpdC51bnN0YWdlIC8gZ2l0LmNsZWFuJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvbGVmdG92ZXItbGl2ZS11bnN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9sZWZ0b3Zlci1saXZlLXVuc3RhZ2UudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgZ2l0TXV0YXRlQ29tbWFuZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyQ29ubmVjdGVkQ29ubmVjdGlvbihmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChjb25uZWN0aW9uKSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgdW5zdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnVuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdGNvbnN0IGNsZWFuQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuY2xlYW4nLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKGNvbW1hbmRJZDogdW5rbm93bikgPT4ge1xuXHRcdFx0XHRcdGlmIChjb21tYW5kSWQgPT09ICdnaXQudW5zdGFnZScgfHwgY29tbWFuZElkID09PSAnZ2l0LmNsZWFuJykge1xuXHRcdFx0XHRcdFx0Z2l0TXV0YXRlQ29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHRcdH0pKTtcblx0XHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0XHRjb25zdCBwYW5lbFJldmVydCA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFJldmVydD8uc3R5bGUuZGlzcGxheSwgJycpO1xuXHRcdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkdpdEFjdGlvbjogKGNvbW1hbmRJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkdpdEFjdGlvbignZ2l0LmNsZWFuJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0TXV0YXRlQ29tbWFuZHMsIFsnZ2l0LmNsZWFuJ10pO1xuXG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld1JldmVydCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXJldmVydCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdSZXZlcnQ/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5HaXRBY3Rpb246IChjb21tYW5kSWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5HaXRBY3Rpb24oJ2dpdC51bnN0YWdlJyk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0TXV0YXRlQ29tbWFuZHMsIFsnZ2l0LmNsZWFuJywgJ2dpdC51bnN0YWdlJ10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR1bnN0YWdlQ29tbWFuZC5kaXNwb3NlKCk7XG5cdFx0XHRjbGVhbkNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVhZC1mYWlsZWQgc2VuZHMgMCBnaXQudW5zdGFnZSBmcm9tIGJvdGggZGlmZiBob3N0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlYWQtZmFpbGVkLXVuc3RhZ2UudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL3JlYWQtZmFpbGVkLXVuc3RhZ2UudHMuZ2l0Jyk7XG5cdFx0bGV0IHVuc3RhZ2VDYWxscyA9IDA7XG5cdFx0Y29uc3QgdW5zdGFnZUNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnZ2l0LnVuc3RhZ2UnLCAoKSA9PiB7IHVuc3RhZ2VDYWxscysrOyB9KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0XHRpZiAoY29tbWFuZElkID09PSAnZ2l0LnVuc3RhZ2UnKSB7XG5cdFx0XHRcdFx0XHR1bnN0YWdlQ2FsbHMrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNDaGFuZ2VzTW9kZWwsIHtcblx0XHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGdldFNuYXBzaG90OiAoKSA9PiAoe1xuXHRcdFx0XHRcdGdlbmVyYXRpb246IDEsXG5cdFx0XHRcdFx0c2V0dGxlZDogdHJ1ZSxcblx0XHRcdFx0XHRzdGF0ZTogeyBraW5kOiAnZW5naW5lLWxlZnRvdmVyJywgc2Vzc2lvbklkOiAnc2Vzc2lvbi0xJywgcmVhc29uOiAncmVhZC1mYWlsZWQnIH0sXG5cdFx0XHRcdFx0ZW50cmllczogW10sXG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRpc1dyaXRlQ2xvc2VkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0ZpbGVEaWZmT3BlblNraXBwZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJlZnJlc2g6IGFzeW5jICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdFx0c2NoZWR1bGVSZWZyZXNoOiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRcdGZsdXNoU2NoZWR1bGVkUmVmcmVzaDogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlc01vZGVsKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cblx0XHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdFx0fSkpO1xuXHRcdFx0dmlldy5yZW5kZXIoKTtcblx0XHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdFx0bW9kaWZpZWQ6IHJlc291cmNlLFxuXHRcdFx0XHRvcmlnaW5hbCxcblx0XHRcdFx0Z3JvdXBJZDogJ2luZGV4Jyxcblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuR2l0QWN0aW9uOiAoY29tbWFuZElkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfSkucnVuR2l0QWN0aW9uKCdnaXQudW5zdGFnZScpO1xuXG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICdpbmRleCcpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cdFx0XHRhd2FpdCAocGFuZSBhcyB1bmtub3duIGFzIHsgcnVuR2l0QWN0aW9uOiAoY29tbWFuZElkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfSkucnVuR2l0QWN0aW9uKCdnaXQudW5zdGFnZScpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGFnZUNhbGxzLCAwKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dW5zdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0ZnVuY3Rpb24gZGlzY29ubmVjdGVkSG9sZFNhZmVDb25uZWN0aW9uKCk6IElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Rpc2Nvbm5lY3RlZCcgYXMgY29uc3QgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7fSksXG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbjtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIG1vdW50Q29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUodGVzdDogTW9jaGEuQ29udGV4dCwgb3B0aW9uczoge1xuXHRcdGV4ZWN1dGVDb21tYW5kPzogKC4uLmFyZ3M6IHVua25vd25bXSkgPT4gUHJvbWlzZTx1bmtub3duPjtcblx0XHRjb25uZWN0aW9uPzogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdGdyb3VwSWQ/OiBzdHJpbmc7XG5cdFx0aWRlbnRpdHk/OiB7XG5cdFx0XHRvcmlnaW4/OiAnZW5naW5lJyB8ICdzY20nO1xuXHRcdFx0c2Vzc2lvbklkPzogc3RyaW5nO1xuXHRcdFx0Z2l0UGF0aD86IHN0cmluZztcblx0XHRcdGluZGV4U3RhdGU/OiBzdHJpbmc7XG5cdFx0XHRraW5kPzogc3RyaW5nO1xuXHRcdH07XG5cdH0gPSB7fSk6IFByb21pc2U8eyBwYW5lOiBDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZTsgcGFyZW50OiBIVE1MRWxlbWVudCB9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGVzdCwgJy9wcm9qZWN0L3NyYy9kNTI2LXJldmlldy50cycpO1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdG9SZXNvdXJjZS5jYWxsKHRlc3QsICcvcHJvamVjdC9zcmMvZDUyNi1yZXZpZXcudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0Z3JvdXBJZDogb3B0aW9ucy5ncm91cElkLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IG9wdGlvbnMuZXhlY3V0ZUNvbW1hbmQsXG5cdFx0XHRjb25uZWN0aW9uOiBvcHRpb25zLmNvbm5lY3Rpb24gPz8gZGlzY29ubmVjdGVkSG9sZFNhZmVDb25uZWN0aW9uKCksXG5cdFx0fSk7XG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsIG9wdGlvbnMuZ3JvdXBJZCA/PyAnd29ya2luZ1RyZWUnLCBvcHRpb25zLmlkZW50aXR5KSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRyZXR1cm4geyBwYW5lLCBwYXJlbnQgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0dWJTaG93Tm90aWNlVGhyb3cocGFuZTogQ29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUsIHBhaW50Qm9vbTogRXJyb3IpOiB2b2lkIHtcblx0XHQocGFuZSBhcyB1bmtub3duIGFzIHsgc2hvd05vdGljZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIH0pLnNob3dOb3RpY2UgPSAoKSA9PiB7XG5cdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIFJldmVydCBjbGljayBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHsgcGFuZSwgcGFyZW50IH0gPSBhd2FpdCBtb3VudENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lKHRoaXMsIHtcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2dpdCBib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdHN0dWJTaG93Tm90aWNlVGhyb3cocGFuZSwgcGFpbnRCb29tKTtcblx0XHRcdGZvcmNlQ2xpY2socGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctcmV2ZXJ0JykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBVbnN0YWdlIGNsaWNrIGNhdGNoLXBhdGggbm90aWNlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgeyBwYW5lLCBwYXJlbnQgfSA9IGF3YWl0IG1vdW50Q29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUodGhpcywge1xuXHRcdFx0XHRncm91cElkOiAnaW5kZXgnLFxuXHRcdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignZ2l0IGJvb20nKTtcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0c3R1YlNob3dOb3RpY2VUaHJvdyhwYW5lLCBwYWludEJvb20pO1xuXHRcdFx0Zm9yY2VDbGljayhwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy11bnN0YWdlJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBTdGFnZSBjbGljayBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHsgcGFuZSwgcGFyZW50IH0gPSBhd2FpdCBtb3VudENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lKHRoaXMsIHtcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2dpdCBib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdHN0dWJTaG93Tm90aWNlVGhyb3cocGFuZSwgcGFpbnRCb29tKTtcblx0XHRcdGZvcmNlQ2xpY2socGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctc3RhZ2UnKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIEFjY2VwdCBjbGljayBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3ZlckNvbm5lY3RlZENvbm5lY3Rpb24oZmFsc2UpO1xuXHRcdFx0KGNvbm5lY3Rpb24gYXMgeyByZWFkR2l0RmlsZURpZmY/OiAoKSA9PiBQcm9taXNlPG5ldmVyPiB9KS5yZWFkR2l0RmlsZURpZmYgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigncmVhZCBib29tJyk7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgeyBwYW5lLCBwYXJlbnQgfSA9IGF3YWl0IG1vdW50Q29udmVyc2F0aW9uRGlmZlJldmlld1BhbmUodGhpcywge1xuXHRcdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0XHRpZGVudGl0eToge1xuXHRcdFx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRcdFx0c2Vzc2lvbklkOiAnc2Vzc2lvbi0xJyxcblx0XHRcdFx0XHRnaXRQYXRoOiAnc3JjL2Q1MjYtcmV2aWV3LnRzJyxcblx0XHRcdFx0XHRpbmRleFN0YXRlOiAnVW5zdGFnZWQnLFxuXHRcdFx0XHRcdGtpbmQ6ICdNb2RpZmllZCcsXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdChwYW5lIGFzIHVua25vd24gYXMgeyBhY2NlcHRDdXJzb3I6IHsgc2lkZTogJ25ldyc7IGxpbmU6IG51bWJlciB9IH0pLmFjY2VwdEN1cnNvciA9IHsgc2lkZTogJ25ldycsIGxpbmU6IDEgfTtcblx0XHRcdHN0dWJTaG93Tm90aWNlVGhyb3cocGFuZSwgcGFpbnRCb29tKTtcblx0XHRcdGZvcmNlQ2xpY2socGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctYWNjZXB0JykpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIFByZXZpZXcgZmFpbHVyZSBub3RpY2UgdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29tbWFuZEJvb20gPSBuZXcgRXJyb3IoJ3ByZXZpZXcgYm9vbScpO1xuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKGNvbW1hbmRCb29tLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB7IHBhcmVudCB9ID0gYXdhaXQgbW91bnRDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSh0aGlzLCB7XG5cdFx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgY29tbWFuZEJvb207XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IG5vdGljZSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW1vdmUtbm90aWNlJyk7XG5cdFx0XHRhc3NlcnQub2sobm90aWNlKTtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShub3RpY2UsICd0ZXh0Q29udGVudCcsIHsgY29uZmlndXJhYmxlOiB0cnVlLCBzZXQ6ICgpID0+IHsgdGhyb3cgY29tbWFuZEJvb207IH0gfSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmb3JjZUNsaWNrKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW9wZW4tcHJldmlldycpKTtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFJlZmxlY3QuZGVsZXRlUHJvcGVydHkobm90aWNlLCAndGV4dENvbnRlbnQnKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gU3RhZ2UgY2F0Y2gtcGF0aCBub3RpY2UgdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9kNTI0LXN0YWdlLnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9kNTI0LXN0YWdlLnRzLmdpdCcpO1xuXHRcdGNvbnN0IGFwcGx5Q2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKGFwcGx5Q2FsbHMsIHN0YWdlQ2FsbHMsIGZhbHNlKTtcblx0XHRjb25uZWN0aW9uLndyaXRlR2l0U3RhZ2VQYXRocyA9IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdCkgPT4ge1xuXHRcdFx0c3RhZ2VDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdzdGFnZSBib29tJyk7XG5cdFx0fTtcblxuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblx0XHRcdCh2aWV3IGFzIHVua25vd24gYXMgeyBzaG93QWN0aW9uTm90aWNlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQgfSkuc2hvd0FjdGlvbk5vdGljZSA9ICgpID0+IHtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fTtcblx0XHRcdGZvcmNlQ2xpY2sodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gcmVuZGVyUmVmIGNhdGNoLXBhdGggbm90aWNlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZDUyNC1yZW5kZXIudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2Q1MjQtcmVuZGVyLnRzLmdpdCcpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHsgdGhyb3dPbkxvYWQ6IHRydWUsIHJlc291cmNlIH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0KHZpZXcgYXMgdW5rbm93biBhcyB7IHNob3dMb2FkTm90aWNlKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQgfSkuc2hvd0xvYWROb3RpY2UgPSAoKSA9PiB7XG5cdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdH07XG5cdFx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRcdG1vZGlmaWVkOiByZXNvdXJjZSxcblx0XHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoNTApO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMgc3RheXMgZW1wdHkgYWZ0ZXIgUzAgZHJvcHMgdGhlIGNhcnJpZWQgcGF5bG9hZCcsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNvdXJjZXNHaXRBcHBseUh1bmtzUGF0Y2hlcyh1bmRlZmluZWQpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMoe30pLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMoeyB1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmIH0gYXMgb2JqZWN0KSwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdvcGVuU291cmNlc0NoYW5nZUVudHJ5IGNhcnJpZXMgZmV0Y2hlZCB1bmlmaWVkRGlmZiBvbnRvIHRoZSBwYW5lbCBjaGFuZ2UgcmVmJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvY2FycnktcGFuZWwudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2NhcnJ5LXBhbmVsLnRzJyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnVW5zdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0Z2l0UGF0aDogJ3NyYy9jYXJyeS1wYW5lbC50cycsXG5cdFx0XHRpbmRleFN0YXRlOiAnV09SS1RSRUUnLFxuXHRcdH07XG5cdFx0bGV0IHNob3duOiBJU291cmNlc0NoYW5nZVJlZiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RlbHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG5cdFx0YXdhaXQgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeShlbnRyeSwge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IE51bGxDb21tYW5kU2VydmljZSxcblx0XHRcdGVkaXRvclNlcnZpY2U6IHsgb3BlbkVkaXRvcjogYXN5bmMgKCkgPT4gdW5kZWZpbmVkIH0gYXMgdW5rbm93biBhcyBJRWRpdG9yU2VydmljZSxcblx0XHRcdHF1aWNrRGlmZlNlcnZpY2U6IHsgZ2V0UXVpY2tEaWZmczogYXN5bmMgKCkgPT4gW10gfSBhcyB1bmtub3duIGFzIElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyAnc291cmNlcy5kaWZmLmRlZmF1bHRPd25lcic6ICdwYW5lbCcgfSksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZToge1xuXHRcdFx0XHRjcmVhdGVJbnN0YW5jZTogKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ3BhbmVsIG9wZW4gbXVzdCBub3QgY3JlYXRlIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCcpOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlRW50cnlPcGVuRGVwc1snaW5zdGFudGlhdGlvblNlcnZpY2UnXSxcblx0XHRcdHNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdHNob3c6IGFzeW5jIChyZWY6IElTb3VyY2VzQ2hhbmdlUmVmKSA9PiB7IHNob3duID0gcmVmOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRcdG1vZGVsU2VydmljZToge1xuXHRcdFx0XHRnZXRNb2RlbDogKHVyaTogVVJJKSA9PiBtb2RlbHMuaGFzKHVyaS50b1N0cmluZygpKSA/IHsgdXJpIH0gOiBudWxsLFxuXHRcdFx0XHR1cGRhdGVNb2RlbDogKG1vZGVsOiB7IHVyaTogVVJJIH0sIHZhbHVlOiBzdHJpbmcpID0+IHsgbW9kZWxzLnNldChtb2RlbC51cmkudG9TdHJpbmcoKSwgdmFsdWUpOyB9LFxuXHRcdFx0XHRjcmVhdGVNb2RlbDogKHZhbHVlOiBzdHJpbmcsIF9sYW5ndWFnZTogdW5rbm93biwgdXJpPzogVVJJKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnNldCh1cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4geyB1cmkgfTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJTW9kZWxTZXJ2aWNlLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRcdHBhdGg6ICdzcmMvY2FycnktcGFuZWwudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc291cmNlc0dpdEFwcGx5SHVua3NQYXRjaGVzKHNob3duKSwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdvcGVuU291cmNlc0NoYW5nZUVudHJ5IGF0dGFjaGVzIGZldGNoZWQgdW5pZmllZERpZmYgZm9yIENvbnZlcnNhdGlvbiBBY2NlcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9jYXJyeS1yZXZpZXcudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2NhcnJ5LXJldmlldy50cycsXG5cdFx0XHRkZXNjcmlwdGlvbjogJ1Vuc3RhZ2VkIENoYW5nZXMnLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdGdpdFBhdGg6ICdzcmMvY2FycnktcmV2aWV3LnRzJyxcblx0XHRcdGluZGV4U3RhdGU6ICdXT1JLVFJFRScsXG5cdFx0fTtcblx0XHRsZXQgb3BlbmVkOiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgbW9kZWxzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRjb25zdCBoYXJuZXNzID0gY3JlYXRlU291cmNlc0NvbnZlcnNhdGlvbk9wZW5IYXJuZXNzKHN0b3JlLCB7XG5cdFx0XHRvcGVuRWRpdG9yOiBhc3luYyBpbnB1dCA9PiB7XG5cdFx0XHRcdGlmIChpbnB1dCBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCkge1xuXHRcdFx0XHRcdG9wZW5lZCA9IGlucHV0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0YXdhaXQgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeShlbnRyeSwge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IE51bGxDb21tYW5kU2VydmljZSxcblx0XHRcdGVkaXRvclNlcnZpY2U6IHtcblx0XHRcdFx0b3BlbkVkaXRvcjogYXN5bmMgKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ2NvbnZlcnNhdGlvbiBvcGVuIG11c3Qgbm90IHVzZSBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3InKTsgfSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yU2VydmljZSxcblx0XHRcdHF1aWNrRGlmZlNlcnZpY2U6IHsgZ2V0UXVpY2tEaWZmczogYXN5bmMgKCkgPT4gW10gfSBhcyB1bmtub3duIGFzIElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyAnc291cmNlcy5kaWZmLmRlZmF1bHRPd25lcic6ICdjb252ZXJzYXRpb24nIH0pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IHtcblx0XHRcdFx0Y3JlYXRlSW5zdGFuY2U6IChjdG9yOiB0eXBlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0LCBtb2RpZmllZDogVVJJLCBvcmlnaW5hbD86IFVSSSwgZ3JvdXBJZD86IHN0cmluZykgPT5cblx0XHRcdFx0XHRzdG9yZS5hZGQobmV3IGN0b3IobW9kaWZpZWQsIG9yaWdpbmFsLCBncm91cElkKSksXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNDaGFuZ2VFbnRyeU9wZW5EZXBzWydpbnN0YW50aWF0aW9uU2VydmljZSddLFxuXHRcdFx0c291cmNlc0RpZmZQYW5lbFNlcnZpY2U6IHtcblx0XHRcdFx0c2hvdzogYXN5bmMgKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ2NvbnZlcnNhdGlvbiBvcGVuIG11c3Qgbm90IHNob3cgdGhlIHBhbmVsJyk7IH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLFxuXHRcdFx0ZWRpdG9yR3JvdXBzU2VydmljZTogaGFybmVzcy5lZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdFx0c2Vzc2lvbjogaGFybmVzcy5zZXNzaW9uLFxuXHRcdFx0bW9kZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldE1vZGVsOiAodXJpOiBVUkkpID0+IG1vZGVscy5oYXModXJpLnRvU3RyaW5nKCkpID8geyB1cmkgfSA6IG51bGwsXG5cdFx0XHRcdHVwZGF0ZU1vZGVsOiAobW9kZWw6IHsgdXJpOiBVUkkgfSwgdmFsdWU6IHN0cmluZykgPT4geyBtb2RlbHMuc2V0KG1vZGVsLnVyaS50b1N0cmluZygpLCB2YWx1ZSk7IH0sXG5cdFx0XHRcdGNyZWF0ZU1vZGVsOiAodmFsdWU6IHN0cmluZywgX2xhbmd1YWdlOiB1bmtub3duLCB1cmk/OiBVUkkpID0+IHtcblx0XHRcdFx0XHRpZiAodXJpKSB7XG5cdFx0XHRcdFx0XHRtb2RlbHMuc2V0KHVyaS50b1N0cmluZygpLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB7IHVyaSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElNb2RlbFNlcnZpY2UsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jICgpID0+ICh7XG5cdFx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdFx0cGF0aDogJ3NyYy9jYXJyeS1yZXZpZXcudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblxuXHRcdGFzc2VydC5vayhvcGVuZWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc291cmNlc0dpdEFwcGx5SHVua3NQYXRjaGVzKG9wZW5lZCksIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnb3BlblNvdXJjZXNDaGFuZ2VFbnRyeSBhdHRhY2hlcyBmZXRjaGVkIHVuaWZpZWREaWZmIGZvciBQcmV2aWV3IHRoZW4gQ29udmVyc2F0aW9uIEFjY2VwdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2NhcnJ5LXByZXZpZXcudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2NhcnJ5LXByZXZpZXcudHMnLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdVbnN0YWdlZCBDaGFuZ2VzJyxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2NhcnJ5LXByZXZpZXcudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1dPUktUUkVFJyxcblx0XHR9O1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0Y29uc3QgbW9kZWxzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRjb25zdCBlZGl0b3JTdGF0ZSA9IHtcblx0XHRcdGFjdGl2ZUVkaXRvcjogdW5kZWZpbmVkIGFzIERpZmZFZGl0b3JJbnB1dCB8IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCB8IHVuZGVmaW5lZCxcblx0XHRcdGNsb3NlZDogW10gYXMgb2JqZWN0W10sXG5cdFx0fTtcblx0XHRsZXQgZWRpdG9yT3BlbnMgPSAwO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVTb3VyY2VzQ29udmVyc2F0aW9uT3Blbkhhcm5lc3Moc3RvcmUsIHtcblx0XHRcdG9wZW5FZGl0b3I6IGFzeW5jIGlucHV0ID0+IHtcblx0XHRcdFx0aWYgKGlucHV0IGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KSB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGlucHV0KTtcblx0XHRcdFx0XHRlZGl0b3JTdGF0ZS5hY3RpdmVFZGl0b3IgPSBpbnB1dDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSB7XG5cdFx0XHRnZXQgYWN0aXZlRWRpdG9yKCkgeyByZXR1cm4gZWRpdG9yU3RhdGUuYWN0aXZlRWRpdG9yOyB9LFxuXHRcdFx0YWN0aXZlRWRpdG9yUGFuZTogeyBncm91cDogeyBpZDogMSB9IH0sXG5cdFx0XHRjbG9zZUVkaXRvcjogYXN5bmMgKGlkZW50OiB7IGVkaXRvcjogb2JqZWN0IH0pID0+IHtcblx0XHRcdFx0ZWRpdG9yU3RhdGUuY2xvc2VkLnB1c2goaWRlbnQuZWRpdG9yKTtcblx0XHRcdFx0aWYgKGVkaXRvclN0YXRlLmFjdGl2ZUVkaXRvciA9PT0gaWRlbnQuZWRpdG9yKSB7XG5cdFx0XHRcdFx0ZWRpdG9yU3RhdGUuYWN0aXZlRWRpdG9yID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0b3BlbkVkaXRvcjogYXN5bmMgKGlucHV0OiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdGVkaXRvck9wZW5zKys7XG5cdFx0XHRcdGNvbnN0IHVudHlwZWQgPSBpbnB1dCBhcyB7IG9yaWdpbmFsPzogeyByZXNvdXJjZT86IFVSSSB9OyBtb2RpZmllZD86IHsgcmVzb3VyY2U/OiBVUkkgfSB9O1xuXHRcdFx0XHRpZiAodW50eXBlZC5vcmlnaW5hbD8ucmVzb3VyY2UgJiYgdW50eXBlZC5tb2RpZmllZD8ucmVzb3VyY2UpIHtcblx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbElucHV0ID0gc3RvcmUuYWRkKG5ldyBUZXN0RWRpdG9ySW5wdXQodW50eXBlZC5vcmlnaW5hbC5yZXNvdXJjZSwgJ3Rlc3Qub3JpZ2luYWwnKSk7XG5cdFx0XHRcdFx0Y29uc3QgbW9kaWZpZWRJbnB1dCA9IHN0b3JlLmFkZChuZXcgVGVzdEVkaXRvcklucHV0KHVudHlwZWQubW9kaWZpZWQucmVzb3VyY2UsICd0ZXN0Lm1vZGlmaWVkJykpO1xuXHRcdFx0XHRcdGNvbnN0IGRpZmZJbnB1dCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9ySW5wdXQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBvcmlnaW5hbElucHV0LCBtb2RpZmllZElucHV0LCB1bmRlZmluZWQpKTtcblx0XHRcdFx0XHRlZGl0b3JTdGF0ZS5hY3RpdmVFZGl0b3IgPSBkaWZmSW5wdXQ7XG5cdFx0XHRcdFx0cmV0dXJuIHsgaW5wdXQ6IGRpZmZJbnB1dCB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yU2VydmljZTtcblxuXHRcdGF3YWl0IG9wZW5Tb3VyY2VzQ2hhbmdlRW50cnkoZW50cnksIHtcblx0XHRcdGNvbW1hbmRTZXJ2aWNlOiBOdWxsQ29tbWFuZFNlcnZpY2UsXG5cdFx0XHRlZGl0b3JTZXJ2aWNlLFxuXHRcdFx0cXVpY2tEaWZmU2VydmljZTogeyBnZXRRdWlja0RpZmZzOiBhc3luYyAoKSA9PiBbXSB9IGFzIHVua25vd24gYXMgSVF1aWNrRGlmZlNlcnZpY2UsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7ICdzb3VyY2VzLmRpZmYuZGVmYXVsdE93bmVyJzogJ3ByZXZpZXcnIH0pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRzb3VyY2VzRGlmZlBhbmVsU2VydmljZToge1xuXHRcdFx0XHRzaG93OiBhc3luYyAoKSA9PiB7IHRocm93IG5ldyBFcnJvcigncHJldmlldyBvcGVuIG11c3Qgbm90IHNob3cgdGhlIHBhbmVsJyk7IH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLFxuXHRcdFx0bW9kZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldE1vZGVsOiAodXJpOiBVUkkpID0+IG1vZGVscy5oYXModXJpLnRvU3RyaW5nKCkpID8geyB1cmkgfSA6IG51bGwsXG5cdFx0XHRcdHVwZGF0ZU1vZGVsOiAobW9kZWw6IHsgdXJpOiBVUkkgfSwgdmFsdWU6IHN0cmluZykgPT4geyBtb2RlbHMuc2V0KG1vZGVsLnVyaS50b1N0cmluZygpLCB2YWx1ZSk7IH0sXG5cdFx0XHRcdGNyZWF0ZU1vZGVsOiAodmFsdWU6IHN0cmluZywgX2xhbmd1YWdlOiB1bmtub3duLCB1cmk/OiBVUkkpID0+IHtcblx0XHRcdFx0XHRpZiAodXJpKSB7XG5cdFx0XHRcdFx0XHRtb2RlbHMuc2V0KHVyaS50b1N0cmluZygpLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB7IHVyaSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElNb2RlbFNlcnZpY2UsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jICgpID0+ICh7XG5cdFx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdFx0cGF0aDogJ3NyYy9jYXJyeS1wcmV2aWV3LnRzJyxcblx0XHRcdFx0dW5pZmllZERpZmY6IGNhcnJpZWRVbmlmaWVkRGlmZixcblx0XHRcdH0pLFxuXHRcdH0sIHsgcHJlc2VydmVGb2N1czogZmFsc2UgfSk7XG5cblx0XHRjb25zdCBwcmV2aWV3SG9zdCA9IGVkaXRvclN0YXRlLmFjdGl2ZUVkaXRvcjtcblx0XHRhc3NlcnQub2socHJldmlld0hvc3QgaW5zdGFuY2VvZiBEaWZmRWRpdG9ySW5wdXQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc291cmNlc0dpdEFwcGx5SHVua3NQYXRjaGVzKHByZXZpZXdIb3N0KSwgW10pO1xuXG5cdFx0Y29uc3Qgb3BlbnNCZWZvcmVNb3ZlID0gZWRpdG9yT3BlbnM7XG5cdFx0YXdhaXQgbW92ZUFjdGl2ZURpZmZUb0NvbnZlcnNhdGlvbignZWRpdG9yVGl0bGUnLCB7XG5cdFx0XHRjb21tYW5kU2VydmljZTogTnVsbENvbW1hbmRTZXJ2aWNlLFxuXHRcdFx0ZWRpdG9yU2VydmljZSxcblx0XHRcdHF1aWNrRGlmZlNlcnZpY2U6IHsgZ2V0UXVpY2tEaWZmczogYXN5bmMgKCkgPT4gW10gfSBhcyB1bmtub3duIGFzIElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSxcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdFx0c291cmNlc0RpZmZQYW5lbFNlcnZpY2U6IHtcblx0XHRcdFx0c2hvdzogYXN5bmMgKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ21vdmUgdG8gY29udmVyc2F0aW9uIG11c3Qgbm90IHNob3cgdGhlIHBhbmVsJyk7IH0sXG5cdFx0XHRcdGdldEN1cnJlbnRSZWY6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdFx0Y2xlYXI6ICgpID0+IHsgfSxcblx0XHRcdFx0b25EaWRDaGFuZ2VSZWY6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLFxuXHRcdFx0ZWRpdG9yR3JvdXBzU2VydmljZTogaGFybmVzcy5lZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdFx0c2Vzc2lvbjogaGFybmVzcy5zZXNzaW9uLFxuXHRcdH0sIHsgcmVwb3NpdG9yaWVzOiBbXSB9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JPcGVucywgb3BlbnNCZWZvcmVNb3ZlKTtcblxuXHRcdGNvbnN0IGNvbnZlcnNhdGlvbkhvc3QgPSBlZGl0b3JTdGF0ZS5hY3RpdmVFZGl0b3I7XG5cdFx0YXNzZXJ0Lm9rKGNvbnZlcnNhdGlvbkhvc3QgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChjb252ZXJzYXRpb25Ib3N0LCBwcmV2aWV3SG9zdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzb3VyY2VzR2l0QXBwbHlIdW5rc1BhdGNoZXMoY29udmVyc2F0aW9uSG9zdCksIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnb3BlblNvdXJjZXNDaGFuZ2VFbnRyeSBwcmV2aWV3IGZpcnN0LW9wZW4gbGVhdmVzIHdoaXRlc3BhY2UgdW5pZmllZERpZmYgYWJzZW50JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvcHJldmlldy13aGl0ZXNwYWNlLnRzJyk7XG5cdFx0Y29uc3QgZW50cnk6IElTb3VyY2VzQ2hhbmdlRW50cnkgPSB7XG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdG5hbWU6ICdwcmV2aWV3LXdoaXRlc3BhY2UudHMnLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdVbnN0YWdlZCBDaGFuZ2VzJyxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL3ByZXZpZXctd2hpdGVzcGFjZS50cycsXG5cdFx0XHRpbmRleFN0YXRlOiAnV09SS1RSRUUnLFxuXHRcdH07XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIHN0b3JlKTtcblx0XHRjb25zdCBtb2RlbHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHRcdGxldCBwcmV2aWV3SG9zdDogRGlmZkVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXG5cdFx0YXdhaXQgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeShlbnRyeSwge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IE51bGxDb21tYW5kU2VydmljZSxcblx0XHRcdGVkaXRvclNlcnZpY2U6IHtcblx0XHRcdFx0Z2V0IGFjdGl2ZUVkaXRvcigpIHsgcmV0dXJuIHByZXZpZXdIb3N0OyB9LFxuXHRcdFx0XHRvcGVuRWRpdG9yOiBhc3luYyAoaW5wdXQ6IHsgb3JpZ2luYWw/OiB7IHJlc291cmNlPzogVVJJIH07IG1vZGlmaWVkPzogeyByZXNvdXJjZT86IFVSSSB9IH0pID0+IHtcblx0XHRcdFx0XHRpZiAoaW5wdXQub3JpZ2luYWw/LnJlc291cmNlICYmIGlucHV0Lm1vZGlmaWVkPy5yZXNvdXJjZSkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb3JpZ2luYWxJbnB1dCA9IHN0b3JlLmFkZChuZXcgVGVzdEVkaXRvcklucHV0KGlucHV0Lm9yaWdpbmFsLnJlc291cmNlLCAndGVzdC5vcmlnaW5hbCcpKTtcblx0XHRcdFx0XHRcdGNvbnN0IG1vZGlmaWVkSW5wdXQgPSBzdG9yZS5hZGQobmV3IFRlc3RFZGl0b3JJbnB1dChpbnB1dC5tb2RpZmllZC5yZXNvdXJjZSwgJ3Rlc3QubW9kaWZpZWQnKSk7XG5cdFx0XHRcdFx0XHRwcmV2aWV3SG9zdCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9ySW5wdXQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBvcmlnaW5hbElucHV0LCBtb2RpZmllZElucHV0LCB1bmRlZmluZWQpKTtcblx0XHRcdFx0XHRcdHJldHVybiB7IGlucHV0OiBwcmV2aWV3SG9zdCB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElFZGl0b3JTZXJ2aWNlLFxuXHRcdFx0cXVpY2tEaWZmU2VydmljZTogeyBnZXRRdWlja0RpZmZzOiBhc3luYyAoKSA9PiBbXSB9IGFzIHVua25vd24gYXMgSVF1aWNrRGlmZlNlcnZpY2UsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7ICdzb3VyY2VzLmRpZmYuZGVmYXVsdE93bmVyJzogJ3ByZXZpZXcnIH0pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRzb3VyY2VzRGlmZlBhbmVsU2VydmljZToge1xuXHRcdFx0XHRzaG93OiBhc3luYyAoKSA9PiB7IHRocm93IG5ldyBFcnJvcigncHJldmlldyBvcGVuIG11c3Qgbm90IHNob3cgdGhlIHBhbmVsJyk7IH0sXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLFxuXHRcdFx0bW9kZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldE1vZGVsOiAodXJpOiBVUkkpID0+IG1vZGVscy5oYXModXJpLnRvU3RyaW5nKCkpID8geyB1cmkgfSA6IG51bGwsXG5cdFx0XHRcdHVwZGF0ZU1vZGVsOiAobW9kZWw6IHsgdXJpOiBVUkkgfSwgdmFsdWU6IHN0cmluZykgPT4geyBtb2RlbHMuc2V0KG1vZGVsLnVyaS50b1N0cmluZygpLCB2YWx1ZSk7IH0sXG5cdFx0XHRcdGNyZWF0ZU1vZGVsOiAodmFsdWU6IHN0cmluZywgX2xhbmd1YWdlOiB1bmtub3duLCB1cmk/OiBVUkkpID0+IHtcblx0XHRcdFx0XHRpZiAodXJpKSB7XG5cdFx0XHRcdFx0XHRtb2RlbHMuc2V0KHVyaS50b1N0cmluZygpLCB2YWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB7IHVyaSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElNb2RlbFNlcnZpY2UsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jICgpID0+ICh7XG5cdFx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdFx0cmVhc29uOiAnJyxcblx0XHRcdFx0cGF0aDogJ3NyYy9wcmV2aWV3LXdoaXRlc3BhY2UudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogJyAgICcsXG5cdFx0XHR9KSxcblx0XHR9LCB7IHByZXNlcnZlRm9jdXM6IGZhbHNlIH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKHByZXZpZXdIb3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNvdXJjZXNHaXRBcHBseUh1bmtzUGF0Y2hlcyhwcmV2aWV3SG9zdCksIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnUzAga2VlcHMgQWNjZXB0IGhpZGRlbiBhbmQgc2VuZHMgMCBBcHBseUh1bmtzIGV2ZW4gd2hlbiBhIGRpZmYgd2FzIGZldGNoZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hY2NlcHQtY2FycnkudHMnKTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2FjY2VwdC1jYXJyeS50cy5naXQnKTtcblx0XHRjb25zdCBhcHBseUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgZ2l0U3RhZ2VDb21tYW5kczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKGFwcGx5Q2FsbHMsIFtdLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChjb25uZWN0aW9uKSwgZmFsc2UpO1xuXG5cdFx0Y29uc3Qgc3RhZ2VDb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2dpdC5zdGFnZScsICgpID0+IHsgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGNvbW1hbmRJZCA9PT0gJ2dpdC5zdGFnZScpIHtcblx0XHRcdFx0XHRcdGdpdFN0YWdlQ29tbWFuZHMucHVzaChjb21tYW5kSWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblxuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRcdHBhaW50UGFuZWxXcml0ZUNocm9tZSh2aWV3KTtcblxuXHRcdFx0Y29uc3QgcGFuZWxBY2NlcHQgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxBY2NlcHQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuQWNjZXB0OiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkFjY2VwdCgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0U3RhZ2VDb21tYW5kcywgW10pO1xuXG5cdFx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChyZXNvdXJjZSwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScpKTtcblx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRcdHBhaW50UmV2aWV3V3JpdGVDaHJvbWUocGFuZSk7XG5cblx0XHRcdGNvbnN0IHJldmlld0FjY2VwdCA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LWFjY2VwdCcpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZpZXdBY2NlcHQ/LnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0XHRhd2FpdCAocGFuZSBhcyB1bmtub3duIGFzIHsgcnVuQWNjZXB0OiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1bkFjY2VwdCgpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5Q2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0U3RhZ2VDb21tYW5kcywgW10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgdW5pZmllZERpZmYga2VlcHMgQWNjZXB0IGhpZGRlbiBhbmQgc2VuZHMgMCBBcHBseUh1bmtzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYWNjZXB0LWVtcHR5LnRzJyk7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hY2NlcHQtZW1wdHkudHMuZ2l0Jyk7XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihhcHBseUNhbGxzLCBbXSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0Y29ubmVjdGlvbixcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHR9KSk7XG5cdFx0dmlldy5yZW5kZXIoKTtcblx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyh7XG5cdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRvcmlnaW5hbCxcblx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0fSk7XG5cdFx0YXdhaXQgdGltZW91dCg1MCk7XG5cdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXG5cdFx0Y29uc3QgcGFuZWxBY2NlcHQgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsQWNjZXB0Py5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGZvcmNlQ2xpY2socGFuZWxBY2NlcHQpO1xuXHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQ6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuQWNjZXB0KCk7XG5cdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhcHBseUNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5Tb3VyY2VzQ2hhbmdlRW50cnkgY29waWVzIGVudHJ5IGlkZW50aXR5IG9udG8gdGhlIHNvdXJjZXMtZ2l0LWRpZmYgcmVmJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvaWRlbnRpdHkudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2lkZW50aXR5LnRzJyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnVW5zdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tb2xkJyxcblx0XHRcdGdpdFBhdGg6ICdzcmMvaWRlbnRpdHkudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1dPUktUUkVFJyxcblx0XHRcdGtpbmQ6ICdNT0RJRklFRCcsXG5cdFx0fTtcblx0XHRsZXQgc2hvd246IElTb3VyY2VzQ2hhbmdlUmVmIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVscyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0YXdhaXQgb3BlblNvdXJjZXNDaGFuZ2VFbnRyeShlbnRyeSwge1xuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IE51bGxDb21tYW5kU2VydmljZSxcblx0XHRcdGVkaXRvclNlcnZpY2U6IHsgb3BlbkVkaXRvcjogYXN5bmMgKCkgPT4gdW5kZWZpbmVkIH0gYXMgdW5rbm93biBhcyBJRWRpdG9yU2VydmljZSxcblx0XHRcdHF1aWNrRGlmZlNlcnZpY2U6IHsgZ2V0UXVpY2tEaWZmczogYXN5bmMgKCkgPT4gW10gfSBhcyB1bmtub3duIGFzIElRdWlja0RpZmZTZXJ2aWNlLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyAnc291cmNlcy5kaWZmLmRlZmF1bHRPd25lcic6ICdwYW5lbCcgfSksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZToge1xuXHRcdFx0XHRjcmVhdGVJbnN0YW5jZTogKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ3BhbmVsIG9wZW4gbXVzdCBub3QgY3JlYXRlIENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dCcpOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlRW50cnlPcGVuRGVwc1snaW5zdGFudGlhdGlvblNlcnZpY2UnXSxcblx0XHRcdHNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdHNob3c6IGFzeW5jIChyZWY6IElTb3VyY2VzQ2hhbmdlUmVmKSA9PiB7IHNob3duID0gcmVmOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRcdG1vZGVsU2VydmljZToge1xuXHRcdFx0XHRnZXRNb2RlbDogKHVyaTogVVJJKSA9PiBtb2RlbHMuaGFzKHVyaS50b1N0cmluZygpKSA/IHsgdXJpIH0gOiBudWxsLFxuXHRcdFx0XHR1cGRhdGVNb2RlbDogKG1vZGVsOiB7IHVyaTogVVJJIH0sIHZhbHVlOiBzdHJpbmcpID0+IHsgbW9kZWxzLnNldChtb2RlbC51cmkudG9TdHJpbmcoKSwgdmFsdWUpOyB9LFxuXHRcdFx0XHRjcmVhdGVNb2RlbDogKHZhbHVlOiBzdHJpbmcsIF9sYW5ndWFnZTogdW5rbm93biwgdXJpPzogVVJJKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnNldCh1cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4geyB1cmkgfTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJTW9kZWxTZXJ2aWNlLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRcdHBhdGg6ICdzcmMvaWRlbnRpdHkudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvd24/Lm9yaWdpbiwgJ2VuZ2luZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bj8uc2Vzc2lvbklkLCAnc2Vzc2lvbi1vbGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvd24/LmdpdFBhdGgsICdzcmMvaWRlbnRpdHkudHMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvd24/LmluZGV4U3RhdGUsICdXT1JLVFJFRScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bj8ua2luZCwgJ01PRElGSUVEJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3duPy5tb2RpZmllZC5zY2hlbWUsICdzb3VyY2VzLWdpdC1kaWZmJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5Tb3VyY2VzQ2hhbmdlRW50cnkgY29waWVzIGVudHJ5IGlkZW50aXR5IG9udG8gdGhlIGNvbnZlcnNhdGlvbiBpbnB1dCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3Byb2plY3Qvc3JjL2lkZW50aXR5LWlucHV0LnRzJyk7XG5cdFx0Y29uc3QgZW50cnk6IElTb3VyY2VzQ2hhbmdlRW50cnkgPSB7XG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdG5hbWU6ICdpZGVudGl0eS1pbnB1dC50cycsXG5cdFx0XHRkZXNjcmlwdGlvbjogJ1Vuc3RhZ2VkIENoYW5nZXMnLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLW9sZCcsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2lkZW50aXR5LWlucHV0LnRzJyxcblx0XHRcdGluZGV4U3RhdGU6ICdXT1JLVFJFRScsXG5cdFx0XHRraW5kOiAnTU9ESUZJRUQnLFxuXHRcdH07XG5cdFx0bGV0IG9wZW5lZDogQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0IHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVscyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZVNvdXJjZXNDb252ZXJzYXRpb25PcGVuSGFybmVzcyhzdG9yZSwge1xuXHRcdFx0b3BlbkVkaXRvcjogYXN5bmMgaW5wdXQgPT4ge1xuXHRcdFx0XHRpZiAoaW5wdXQgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQpIHtcblx0XHRcdFx0XHRvcGVuZWQgPSBpbnB1dDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRhd2FpdCBvcGVuU291cmNlc0NoYW5nZUVudHJ5KGVudHJ5LCB7XG5cdFx0XHRjb21tYW5kU2VydmljZTogTnVsbENvbW1hbmRTZXJ2aWNlLFxuXHRcdFx0ZWRpdG9yU2VydmljZToge1xuXHRcdFx0XHRvcGVuRWRpdG9yOiBhc3luYyAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignY29udmVyc2F0aW9uIG9wZW4gbXVzdCBub3QgdXNlIGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcicpOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElFZGl0b3JTZXJ2aWNlLFxuXHRcdFx0cXVpY2tEaWZmU2VydmljZTogeyBnZXRRdWlja0RpZmZzOiBhc3luYyAoKSA9PiBbXSB9IGFzIHVua25vd24gYXMgSVF1aWNrRGlmZlNlcnZpY2UsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7ICdzb3VyY2VzLmRpZmYuZGVmYXVsdE93bmVyJzogJ2NvbnZlcnNhdGlvbicgfSksXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZToge1xuXHRcdFx0XHRjcmVhdGVJbnN0YW5jZTogKGN0b3I6IHR5cGVvZiBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQsIG1vZGlmaWVkOiBVUkksIG9yaWdpbmFsPzogVVJJLCBncm91cElkPzogc3RyaW5nLCBpZGVudGl0eT86IENvbnN0cnVjdG9yUGFyYW1ldGVyczx0eXBlb2YgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0PlszXSkgPT5cblx0XHRcdFx0XHRzdG9yZS5hZGQobmV3IGN0b3IobW9kaWZpZWQsIG9yaWdpbmFsLCBncm91cElkLCBpZGVudGl0eSkpLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlRW50cnlPcGVuRGVwc1snaW5zdGFudGlhdGlvblNlcnZpY2UnXSxcblx0XHRcdHNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlOiB7XG5cdFx0XHRcdHNob3c6IGFzeW5jICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdjb252ZXJzYXRpb24gb3BlbiBtdXN0IG5vdCBzaG93IHRoZSBwYW5lbCcpOyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRcdGVkaXRvckdyb3Vwc1NlcnZpY2U6IGhhcm5lc3MuZWRpdG9yR3JvdXBzU2VydmljZSxcblx0XHRcdHNlc3Npb246IGhhcm5lc3Muc2Vzc2lvbixcblx0XHRcdG1vZGVsU2VydmljZToge1xuXHRcdFx0XHRnZXRNb2RlbDogKHVyaTogVVJJKSA9PiBtb2RlbHMuaGFzKHVyaS50b1N0cmluZygpKSA/IHsgdXJpIH0gOiBudWxsLFxuXHRcdFx0XHR1cGRhdGVNb2RlbDogKG1vZGVsOiB7IHVyaTogVVJJIH0sIHZhbHVlOiBzdHJpbmcpID0+IHsgbW9kZWxzLnNldChtb2RlbC51cmkudG9TdHJpbmcoKSwgdmFsdWUpOyB9LFxuXHRcdFx0XHRjcmVhdGVNb2RlbDogKHZhbHVlOiBzdHJpbmcsIF9sYW5ndWFnZTogdW5rbm93biwgdXJpPzogVVJJKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnNldCh1cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4geyB1cmkgfTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJTW9kZWxTZXJ2aWNlLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRcdHBhdGg6ICdzcmMvaWRlbnRpdHktaW5wdXQudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQub2sob3BlbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlbmVkLnNlc3Npb25JZCwgJ3Nlc3Npb24tb2xkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5lZC5naXRQYXRoLCAnc3JjL2lkZW50aXR5LWlucHV0LnRzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5lZC5vcmlnaW4sICdlbmdpbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlbmVkLm1vZGlmaWVkLnNjaGVtZSwgJ3NvdXJjZXMtZ2l0LWRpZmYnKTtcblx0fSk7XG5cblx0dGVzdCgnZW5naW5lIGRpZmYgc3RhZ2Ugc2VuZHMgZ2l0UGF0aCBhbmQgdGhlIHBpbm5lZCBzZXNzaW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHN0YWdlQ2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdFN0YWdlUGF0aHNSZXF1ZXN0W10gPSBbXTtcblx0XHRjb25zdCBnaXRDb21tYW5kczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gbGVmdG92ZXJMb29rc0xpdmVBcHBseUNvbm5lY3Rpb24oW10sIHN0YWdlQ2FsbHMsIGZhbHNlKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdGdpdENvbW1hbmRzLnB1c2goU3RyaW5nKGNvbW1hbmRJZCkpO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0fSkpO1xuXHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBVUkkuZnJvbSh7IHNjaGVtZTogJ3NvdXJjZXMtZ2l0LWRpZmYnLCBwYXRoOiAnL21vZGlmaWVkL2EudHMnIH0pO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdG1vZGlmaWVkLFxuXHRcdFx0b3JpZ2luYWw6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvb3JpZ2luYWwvYS50cycgfSksXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2EudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1dPUktUUkVFJyxcblx0XHRcdGtpbmQ6ICdNT0RJRklFRCcsXG5cdFx0XHRzY21SZXNvdXJjZTogeyBzb3VyY2VVcmk6IFVSSS5maWxlKCcvd29yay9yZXBvL3NyYy9hLnRzJykgfSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZSxcblx0XHR9KTtcblx0XHRhd2FpdCAodmlldyBhcyB1bmtub3duIGFzIHsgcnVuU3RhZ2U6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuU3RhZ2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzWzBdPy5zZXNzaW9uSWQsICdzZXNzaW9uLTEnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0YWdlQ2FsbHNbMF0/LmNvbW1hbmRzPy5bMF0/LmFyZ3YsIFsnc3JjL2EudHMnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFKU09OLnN0cmluZ2lmeShzdGFnZUNhbGxzWzBdKS5pbmNsdWRlcygnc291cmNlcy1naXQtZGlmZicpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdENvbW1hbmRzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VuZ2luZSBkaWZmIHN0YWdlIGFuZCBhY2NlcHQgcmVmdXNlIGEgbWlzbWF0Y2hlZCBwaW5uZWQgc2Vzc2lvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzdGFnZUNhbGxzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRTdGFnZVBhdGhzUmVxdWVzdFtdID0gW107XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihhcHBseUNhbGxzLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdGNvbm5lY3Rpb24sXG5cdFx0XHRleGVjdXRlQ29tbWFuZDogYXN5bmMgKGNvbW1hbmRJZDogdW5rbm93bikgPT4ge1xuXHRcdFx0XHRnaXRDb21tYW5kcy5wdXNoKFN0cmluZyhjb21tYW5kSWQpKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0c3R1YkVuZ2luZUxpdmVDaGFuZ2VzTW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHR9KSk7XG5cdFx0dmlldy5yZW5kZXIoKTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvbW9kaWZpZWQvbWlzbWF0Y2gudHMnIH0pO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdG1vZGlmaWVkLFxuXHRcdFx0b3JpZ2luYWw6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvb3JpZ2luYWwvbWlzbWF0Y2gudHMnIH0pLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLW9sZCcsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL21pc21hdGNoLnRzJyxcblx0XHRcdHNjbVJlc291cmNlOiB7IHNvdXJjZVVyaTogVVJJLmZpbGUoJy93b3JrL3JlcG8vc3JjL21pc21hdGNoLnRzJykgfSBhcyB1bmtub3duIGFzIElTQ01SZXNvdXJjZSxcblx0XHR9KTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGZvcmNlQ2xpY2socGFuZWxTdGFnZSk7XG5cdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RhZ2VDYWxscy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUNhbGxzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRDb21tYW5kcywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY3Rpb24tbm90aWNlJyk/LnRleHRDb250ZW50LCBzb3VyY2VzR2l0U2Vzc2lvbkNoYW5nZWRNZXNzYWdlKCkpO1xuXG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChtb2RpZmllZCwgVVJJLmZyb20oeyBzY2hlbWU6ICdzb3VyY2VzLWdpdC1kaWZmJywgcGF0aDogJy9vcmlnaW5hbC9taXNtYXRjaC50cycgfSksICd3b3JraW5nVHJlZScsIHtcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLW9sZCcsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL21pc21hdGNoLnRzJyxcblx0XHR9KSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmUpO1xuXHRcdGNvbnN0IHJldmlld1N0YWdlID0gcGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctc3RhZ2UnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlPy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGZvcmNlQ2xpY2socmV2aWV3U3RhZ2UpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQ6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuQWNjZXB0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlDYWxscy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8udGV4dENvbnRlbnQsIHNvdXJjZXNHaXRTZXNzaW9uQ2hhbmdlZE1lc3NhZ2UoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NjbSBzbmFwc2hvdCBlbmdpbmUgZGlmZiB3aXRoIHNlc3Npb24gbWlzbWF0Y2ggc3RpbGwgZ2l0LnN0YWdlIGxvY2FsbHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvc2NtLW1pc21hdGNoLXN0YWdlLnRzJyk7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGxlZnRvdmVyTG9va3NMaXZlQXBwbHlDb25uZWN0aW9uKFtdLCBzdGFnZUNhbGxzLCBmYWxzZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBzdHViRGlmZkhvbmVzdHlTZXJ2aWNlcyh7XG5cdFx0XHR0aHJvd09uTG9hZDogdHJ1ZSxcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdGdpdENvbW1hbmRzLnB1c2goU3RyaW5nKGNvbW1hbmRJZCkpO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzQ2hhbmdlc01vZGVsLCB7XG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdGdldFNuYXBzaG90OiAoKSA9PiAoe1xuXHRcdFx0XHRnZW5lcmF0aW9uOiAxLFxuXHRcdFx0XHRzZXR0bGVkOiB0cnVlLFxuXHRcdFx0XHRzdGF0ZTogeyBraW5kOiAnc2NtJyB9LFxuXHRcdFx0XHRlbnRyaWVzOiBbXSxcblx0XHRcdH0pLFxuXHRcdFx0aXNXcml0ZUNsb3NlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRpc0ZpbGVEaWZmT3BlblNraXBwZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0cmVmcmVzaDogYXN5bmMgKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0c2NoZWR1bGVSZWZyZXNoOiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRmbHVzaFNjaGVkdWxlZFJlZnJlc2g6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNvdXJjZXNDaGFuZ2VzTW9kZWwpO1xuXHRcdGNvbnN0IHNjbVJlc291cmNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCBzY20gPSBhY2Nlc3Nvci5nZXQoSVNDTVNlcnZpY2UpO1xuXHRcdFx0cmV0dXJuIFsuLi5zY20ucmVwb3NpdG9yaWVzXVswXT8ucHJvdmlkZXIuZ3JvdXBzWzBdPy5yZXNvdXJjZXNbMF07XG5cdFx0fSk7XG5cdFx0aWYgKCFzY21SZXNvdXJjZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdTQ00gZml4dHVyZSBtaXNzaW5nJyk7XG5cdFx0fVxuXHRcdGNvbnN0IHN0YWdlQ29tbWFuZCA9IENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdnaXQuc3RhZ2UnLCAoKSA9PiB7IH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0XHR9KSk7XG5cdFx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0XHRtb2RpZmllZDogVVJJLmZyb20oeyBzY2hlbWU6ICdzb3VyY2VzLWdpdC1kaWZmJywgcGF0aDogJy9tb2RpZmllZC9zY20tbWlzbWF0Y2gudHMnIH0pLFxuXHRcdFx0XHRvcmlnaW5hbDogVVJJLmZyb20oeyBzY2hlbWU6ICdzb3VyY2VzLWdpdC1kaWZmJywgcGF0aDogJy9vcmlnaW5hbC9zY20tbWlzbWF0Y2gudHMnIH0pLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRvcmlnaW46ICdlbmdpbmUnLFxuXHRcdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLW9sZCcsXG5cdFx0XHRcdGdpdFBhdGg6ICdzcmMvc2NtLW1pc21hdGNoLXN0YWdlLnRzJyxcblx0XHRcdFx0c2NtUmVzb3VyY2UsXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXHRcdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2U/LnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2l0Q29tbWFuZHMsIFsnZ2l0LnN0YWdlJ10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdGFnZUNvbW1hbmQuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZW5naW5lIGRpZmYgc3RhZ2Ugd2l0aCBhbiBlbXB0eSBnaXRQYXRoIGRvZXMgbm90IHNlbmQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoeyB0aHJvd09uTG9hZDogdHJ1ZSwgY29ubmVjdGlvbiB9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0fSkpO1xuXHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0YXdhaXQgcGFuZWxTZXJ2aWNlLnNob3coe1xuXHRcdFx0bW9kaWZpZWQ6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvbW9kaWZpZWQvZW1wdHkudHMnIH0pLFxuXHRcdFx0b3JpZ2luYWw6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvb3JpZ2luYWwvZW1wdHkudHMnIH0pLFxuXHRcdFx0Z3JvdXBJZDogJ3dvcmtpbmdUcmVlJyxcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLFxuXHRcdFx0Z2l0UGF0aDogJycsXG5cdFx0fSk7XG5cdFx0YXdhaXQgKHZpZXcgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWN0aW9uLW5vdGljZScpPy50ZXh0Q29udGVudCwgc291cmNlc0dpdEVtcHR5U3RhZ2VQYXRoTWVzc2FnZSgpKTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZURpZmYgc3RhZ2UgdXNlcyBjb3BpZWQgZ2l0UGF0aCBhbmQgbWF0Y2hlcyBzdGlsbCBpbmNsdWRlcyBncm91cElkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvZmlsZWRpZmYtc3RhZ2UudHMnKTtcblx0XHRjb25zdCBlbnRyeTogSVNvdXJjZXNDaGFuZ2VFbnRyeSA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogJ2ZpbGVkaWZmLXN0YWdlLnRzJyxcblx0XHRcdGRlc2NyaXB0aW9uOiAnVW5zdGFnZWQgQ2hhbmdlcycsXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2ZpbGVkaWZmLXN0YWdlLnRzJyxcblx0XHRcdGluZGV4U3RhdGU6ICdXT1JLVFJFRScsXG5cdFx0XHRraW5kOiAnTU9ESUZJRUQnLFxuXHRcdH07XG5cdFx0bGV0IHNob3duOiBJU291cmNlc0NoYW5nZVJlZiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RlbHMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHRcdGNvbnN0IG9wZW5lZCA9IGF3YWl0IG9wZW5Tb3VyY2VzQ2hhbmdlRW50cnkoZW50cnksIHtcblx0XHRcdGNvbW1hbmRTZXJ2aWNlOiBOdWxsQ29tbWFuZFNlcnZpY2UsXG5cdFx0XHRlZGl0b3JTZXJ2aWNlOiB7IG9wZW5FZGl0b3I6IGFzeW5jICgpID0+IHVuZGVmaW5lZCB9IGFzIHVua25vd24gYXMgSUVkaXRvclNlcnZpY2UsXG5cdFx0XHRxdWlja0RpZmZTZXJ2aWNlOiB7IGdldFF1aWNrRGlmZnM6IGFzeW5jICgpID0+IFtdIH0gYXMgdW5rbm93biBhcyBJUXVpY2tEaWZmU2VydmljZSxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKHsgJ3NvdXJjZXMuZGlmZi5kZWZhdWx0T3duZXInOiAncGFuZWwnIH0pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IHtcblx0XHRcdFx0Y3JlYXRlSW5zdGFuY2U6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdwYW5lbCBvcGVuIG11c3Qgbm90IGNyZWF0ZSBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQnKTsgfSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJU291cmNlc0NoYW5nZUVudHJ5T3BlbkRlcHNbJ2luc3RhbnRpYXRpb25TZXJ2aWNlJ10sXG5cdFx0XHRzb3VyY2VzRGlmZlBhbmVsU2VydmljZToge1xuXHRcdFx0XHRzaG93OiBhc3luYyAocmVmOiBJU291cmNlc0NoYW5nZVJlZikgPT4ge1xuXHRcdFx0XHRcdHNob3duID0gcmVmO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSxcblx0XHRcdG1vZGVsU2VydmljZToge1xuXHRcdFx0XHRnZXRNb2RlbDogKHVyaTogVVJJKSA9PiBtb2RlbHMuaGFzKHVyaS50b1N0cmluZygpKSA/IHsgdXJpIH0gOiBudWxsLFxuXHRcdFx0XHR1cGRhdGVNb2RlbDogKG1vZGVsOiB7IHVyaTogVVJJIH0sIHZhbHVlOiBzdHJpbmcpID0+IHsgbW9kZWxzLnNldChtb2RlbC51cmkudG9TdHJpbmcoKSwgdmFsdWUpOyB9LFxuXHRcdFx0XHRjcmVhdGVNb2RlbDogKHZhbHVlOiBzdHJpbmcsIF9sYW5ndWFnZTogdW5rbm93biwgdXJpPzogVVJJKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHRcdFx0bW9kZWxzLnNldCh1cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4geyB1cmkgfTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJTW9kZWxTZXJ2aWNlLFxuXHRcdFx0cmVhZEdpdEZpbGVEaWZmOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRzdXBwb3J0ZWQ6IHRydWUsXG5cdFx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRcdHBhdGg6ICdzcmMvZmlsZWRpZmYtc3RhZ2UudHMnLFxuXHRcdFx0XHR1bmlmaWVkRGlmZjogY2FycmllZFVuaWZpZWREaWZmLFxuXHRcdFx0fSksXG5cdFx0fSwgeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlbmVkLCB0cnVlKTtcblx0XHRpZiAoIXNob3duKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ZpbGVEaWZmIHJlZiBtaXNzaW5nJyk7XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bi5naXRQYXRoLCAnc3JjL2ZpbGVkaWZmLXN0YWdlLnRzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3duLm9yaWdpbiwgJ2VuZ2luZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bi5zZXNzaW9uSWQsICdzZXNzaW9uLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvd24uaW5kZXhTdGF0ZSwgJ1dPUktUUkVFJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3duLmtpbmQsICdNT0RJRklFRCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG93bi5tb2RpZmllZC5zY2hlbWUsICdzb3VyY2VzLWdpdC1kaWZmJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3duLm9yaWdpbmFsPy5zY2hlbWUsICdzb3VyY2VzLWdpdC1kaWZmJyk7XG5cblx0XHRjb25zdCBpZGVudGl0eSA9IHtcblx0XHRcdG9yaWdpbjogc2hvd24ub3JpZ2luLFxuXHRcdFx0c2Vzc2lvbklkOiBzaG93bi5zZXNzaW9uSWQsXG5cdFx0XHRnaXRQYXRoOiBzaG93bi5naXRQYXRoLFxuXHRcdFx0aW5kZXhTdGF0ZTogc2hvd24uaW5kZXhTdGF0ZSxcblx0XHRcdGtpbmQ6IHNob3duLmtpbmQsXG5cdFx0fTtcblx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHNob3duLm1vZGlmaWVkLCBzaG93bi5vcmlnaW5hbCwgc2hvd24uZ3JvdXBJZCwgaWRlbnRpdHkpKTtcblx0XHRjb25zdCBvdGhlckdyb3VwID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQoc2hvd24ubW9kaWZpZWQsIHNob3duLm9yaWdpbmFsLCAnaW5kZXgnLCBpZGVudGl0eSkpO1xuXHRcdGNvbnN0IG90aGVyUGF0aCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KHNob3duLm1vZGlmaWVkLCBzaG93bi5vcmlnaW5hbCwgc2hvd24uZ3JvdXBJZCwgeyAuLi5pZGVudGl0eSwgZ2l0UGF0aDogJ3NyYy9vdGhlci50cycgfSkpO1xuXHRcdGNvbnN0IHNhbWUgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChzaG93bi5tb2RpZmllZCwgc2hvd24ub3JpZ2luYWwsIHNob3duLmdyb3VwSWQsIGlkZW50aXR5KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0Lm1hdGNoZXMob3RoZXJHcm91cCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQubWF0Y2hlcyhvdGhlclBhdGgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0Lm1hdGNoZXMoc2FtZSksIHRydWUpO1xuXG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0Z2l0Q29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVZpZXdzU2VydmljZSwge1xuXHRcdFx0b3BlblZpZXc6IGFzeW5jICgpID0+IG51bGwsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHR9IGFzIHVua25vd24gYXMgSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgcGFuZWxTZXJ2aWNlID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0RpZmZQYW5lbFNlcnZpY2UsIHBhbmVsU2VydmljZSk7XG5cdFx0Y29uc3QgdmlldyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsVmlldywge1xuXHRcdFx0aWQ6IFNPVVJDRVNfRElGRl9QQU5FTF9WSUVXX0lELFxuXHRcdFx0dGl0bGU6ICdEaWZmJyxcblx0XHR9KSk7XG5cdFx0dmlldy5yZW5kZXIoKTtcblx0XHRhd2FpdCBwYW5lbFNlcnZpY2Uuc2hvdyhzaG93bik7XG5cdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0cGFpbnRQYW5lbFdyaXRlQ2hyb21lKHZpZXcpO1xuXHRcdGNvbnN0IHBhbmVsU3RhZ2UgPSB2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1zdGFnZScpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lbFN0YWdlLnN0eWxlLmRpc3BsYXksICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZWxTdGFnZS5kaXNhYmxlZCwgZmFsc2UpO1xuXHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHNbMF0/LnNlc3Npb25JZCwgJ3Nlc3Npb24tMScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxsc1swXT8uY29tbWFuZHM/LlswXT8uYXJndiwgWydzcmMvZmlsZWRpZmYtc3RhZ2UudHMnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFKU09OLnN0cmluZ2lmeShzdGFnZUNhbGxzWzBdKS5pbmNsdWRlcygnc291cmNlcy1naXQtZGlmZicpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdENvbW1hbmRzLCBbXSk7XG5cblx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblx0XHRhd2FpdCBwYW5lLnNldElucHV0KGlucHV0LCB1bmRlZmluZWQsIE9iamVjdC5jcmVhdGUobnVsbCksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGF3YWl0IChwYW5lIGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHNbMV0/LnNlc3Npb25JZCwgJ3Nlc3Npb24tMScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RhZ2VDYWxsc1sxXT8uY29tbWFuZHM/LlswXT8uYXJndiwgWydzcmMvZmlsZWRpZmYtc3RhZ2UudHMnXSk7XG5cdFx0YXNzZXJ0Lm9rKCFKU09OLnN0cmluZ2lmeShzdGFnZUNhbGxzWzFdKS5pbmNsdWRlcygnc291cmNlcy1naXQtZGlmZicpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdENvbW1hbmRzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5IGdpdFBhdGggZGlzYWJsZXMgU3RhZ2UsIHNob3dzIHN0YXR1cywgYW5kIGRvZXMgbm90IHNlbmQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc3RhZ2VDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0U3RhZ2VQYXRoc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBsZWZ0b3Zlckxvb2tzTGl2ZUFwcGx5Q29ubmVjdGlvbihbXSwgc3RhZ2VDYWxscywgZmFsc2UpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc3R1YkRpZmZIb25lc3R5U2VydmljZXMoe1xuXHRcdFx0dGhyb3dPbkxvYWQ6IHRydWUsXG5cdFx0XHRjb25uZWN0aW9uLFxuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChjb21tYW5kSWQ6IHVua25vd24pID0+IHtcblx0XHRcdFx0Z2l0Q29tbWFuZHMucHVzaChTdHJpbmcoY29tbWFuZElkKSk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdHN0dWJFbmdpbmVMaXZlQ2hhbmdlc01vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElWaWV3c1NlcnZpY2UsIHtcblx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLFxuXHRcdFx0b25EaWRDaGFuZ2VWaWV3VmlzaWJpbGl0eTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld0NvbnRhaW5lclZpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTb3VyY2VzRGlmZlBhbmVsU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdGNvbnN0IHZpZXcgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFZpZXcsIHtcblx0XHRcdGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCxcblx0XHRcdHRpdGxlOiAnRGlmZicsXG5cdFx0fSkpO1xuXHRcdHZpZXcucmVuZGVyKCk7XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBVUkkuZnJvbSh7IHNjaGVtZTogJ3NvdXJjZXMtZ2l0LWRpZmYnLCBwYXRoOiAnL21vZGlmaWVkL2VtcHR5LXN0YWdlLnRzJyB9KTtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6ICcvb3JpZ2luYWwvZW1wdHktc3RhZ2UudHMnIH0pO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHtcblx0XHRcdG1vZGlmaWVkLFxuXHRcdFx0b3JpZ2luYWwsXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnJyxcblx0XHR9KTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cdFx0Y29uc3QgcGFuZWxTdGFnZSA9IHZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmVsU3RhZ2Uuc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRmb3JjZUNsaWNrKHBhbmVsU3RhZ2UpO1xuXHRcdGF3YWl0ICh2aWV3IGFzIHVua25vd24gYXMgeyBydW5TdGFnZTogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5TdGFnZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGFnZUNhbGxzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnaXRDb21tYW5kcywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3LmVsZW1lbnQucXVlcnlTZWxlY3RvcignLnNvdXJjZXMtZGlmZi1wYW5lbC1hY3Rpb24tbm90aWNlJyk/LnRleHRDb250ZW50LCBzb3VyY2VzR2l0RW1wdHlTdGFnZVBhdGhNZXNzYWdlKCkpO1xuXG5cdFx0Y29uc3QgcGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZSwgbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCkpKTtcblx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHBhcmVudCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gcGFyZW50LnJlbW92ZSgpIH0pO1xuXHRcdHBhbmUuY3JlYXRlKHBhcmVudCk7XG5cdFx0Y29uc3QgaW5wdXQgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdJbnB1dChtb2RpZmllZCwgb3JpZ2luYWwsICd3b3JraW5nVHJlZScsIHtcblx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLFxuXHRcdFx0Z2l0UGF0aDogJycsXG5cdFx0fSkpO1xuXHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0cGFpbnRSZXZpZXdXcml0ZUNocm9tZShwYW5lKTtcblx0XHRjb25zdCByZXZpZXdTdGFnZSA9IHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LXN0YWdlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmlld1N0YWdlLnN0eWxlLmRpc3BsYXksICdub25lJyk7XG5cdFx0Zm9yY2VDbGljayhyZXZpZXdTdGFnZSk7XG5cdFx0YXdhaXQgKHBhbmUgYXMgdW5rbm93biBhcyB7IHJ1blN0YWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+IH0pLnJ1blN0YWdlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0YWdlQ2FsbHMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdpdENvbW1hbmRzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcmVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LW5vdGljZScpPy50ZXh0Q29udGVudCwgc291cmNlc0dpdEVtcHR5U3RhZ2VQYXRoTWVzc2FnZSgpKTtcblx0fSk7XG5cblx0c3VpdGUoJ0FjY2VwdCBwb3N0LXJlYWQgYXV0aG9yaXphdGlvbicsICgpID0+IHtcblx0XHR0eXBlIEhvc3RLaW5kID0gJ1BhbmUnIHwgJ1BhbmVsJztcblx0XHR0eXBlIEludmFsaWRhdGlvbiA9ICdyZXBsYWNlJyB8ICdjbGVhcicgfCAnZGlzcG9zZScgfCAnY2xlYXItYW5kLXJlc3RvcmUnIHwgJ2lucHV0LWRpc3Bvc2UnO1xuXHRcdGludGVyZmFjZSBNdXRhYmxlQXV0aG9yaXphdGlvbiB7XG5cdFx0XHRhY3RpdmVTZXNzaW9uSWQ6IHN0cmluZztcblx0XHRcdGNvbm5lY3RlZDogYm9vbGVhbjtcblx0XHRcdHBhaXJpbmdIb2xkOiBib29sZWFuO1xuXHRcdFx0cmVhZGluZXNzOiAncmVhZHknIHwgJ3VuYXZhaWxhYmxlJztcblx0XHRcdGdpdFJlYWRGYWlsZWQ6IGJvb2xlYW47XG5cdFx0XHRhcHBseVN1cHBvcnRlZDogYm9vbGVhbjtcblx0XHRcdGhhc0FwcGx5SG9vazogYm9vbGVhbjtcblx0XHR9XG5cdFx0Y29uc3QgdmFsaWREaWZmID0gW1xuXHRcdFx0J2RpZmYgLS1naXQgYS9zcmMvYS50cyBiL3NyYy9hLnRzJyxcblx0XHRcdCctLS0gYS9zcmMvYS50cycsXG5cdFx0XHQnKysrIGIvc3JjL2EudHMnLFxuXHRcdFx0J0BAIC0xLDIgKzEsMiBAQCcsXG5cdFx0XHQnIGxpbmUxJyxcblx0XHRcdCctb2xkJyxcblx0XHRcdCcrbmV3Jyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IGFjY2VwdGVkOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCA9IHtcblx0XHRcdHN1cHBvcnRlZDogdHJ1ZSwgcmVhc29uOiAnJywgc3VjY2VzczogdHJ1ZSwgZXJyb3JNZXNzYWdlOiAnJywgZXhpdENvZGU6IDAsIHN0ZG91dDogJycsXG5cdFx0fTtcblx0XHRjb25zdCBleHBlY3RlZFJlYWQ6IFVuaXZlcnNlQWdlbnRSZWFkR2l0RmlsZURpZmZSZXF1ZXN0ID0geyBzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLCBwYXRoOiAnc3JjL2EudHMnLCBpbmRleFN0YXRlOiAnVW5zdGFnZWQnIH07XG5cdFx0Y29uc3QgZXhwZWN0ZWRBcHBseTogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QgPSB7XG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLCBhcmd2OiBbJ2dpdCcsICdhcHBseScsICctLWNhY2hlZCcsICctLXdoaXRlc3BhY2U9bm93YXJuJ10sIHBhdGNoZXM6IFt2YWxpZERpZmYgKyAnXFxuJ10sXG5cdFx0fTtcblxuXHRcdGFzeW5jIGZ1bmN0aW9uIG1vdW50QXV0aG9yaXphdGlvbkhvc3Qoa2luZDogSG9zdEtpbmQsIGRlZmVyQXBwbHkgPSBmYWxzZSkge1xuXHRcdFx0Y29uc3Qgc3RhdGU6IE11dGFibGVBdXRob3JpemF0aW9uID0ge1xuXHRcdFx0XHRhY3RpdmVTZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLCBjb25uZWN0ZWQ6IHRydWUsIHBhaXJpbmdIb2xkOiBmYWxzZSwgcmVhZGluZXNzOiAncmVhZHknLFxuXHRcdFx0XHRnaXRSZWFkRmFpbGVkOiBmYWxzZSwgYXBwbHlTdXBwb3J0ZWQ6IHRydWUsIGhhc0FwcGx5SG9vazogdHJ1ZSxcblx0XHRcdH07XG5cdFx0XHRjb25zdCByZWFkU3RhcnRlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRcdGNvbnN0IHJlYWRSZXN1bHQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0XHRjb25zdCBhcHBseVN0YXJ0ZWQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0XHRjb25zdCBhcHBseVJlc3VsdCA9IG5ldyBEZWZlcnJlZFByb21pc2U8VW5pdmVyc2VBZ2VudFdyaXRlR2l0V3JpdGVSZXN1bHQ+KCk7XG5cdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiB7IHZvaWQgcmVhZFJlc3VsdC5jb21wbGV0ZSgpOyB2b2lkIGFwcGx5UmVzdWx0LmNvbXBsZXRlKGFjY2VwdGVkKTsgfSB9KTtcblx0XHRcdGNvbnN0IHJlYWRzOiBVbml2ZXJzZUFnZW50UmVhZEdpdEZpbGVEaWZmUmVxdWVzdFtdID0gW107XG5cdFx0XHRjb25zdCBhcHBsaWVzOiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdFtdID0gW107XG5cdFx0XHRjb25zdCBjb21tYW5kczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGxldCByZWZyZXNoZXMgPSAwO1xuXHRcdFx0Y29uc3QgY29ubmVjdGlvbkNoYW5nZWQgPSBzdG9yZS5hZGQobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdFx0XHRjb25zdCBzZXNzaW9uQ2hhbmdlZCA9IHN0b3JlLmFkZChuZXcgRW1pdHRlcjxzdHJpbmc+KCkpO1xuXHRcdFx0Y29uc3QgY2hhbmdlc0NoYW5nZWQgPSBzdG9yZS5hZGQobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdFx0XHRjb25zdCBhcHBseSA9IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRBcHBseUh1bmtzUmVxdWVzdCkgPT4ge1xuXHRcdFx0XHRhcHBsaWVzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHZvaWQgYXBwbHlTdGFydGVkLmNvbXBsZXRlKCk7XG5cdFx0XHRcdHJldHVybiBkZWZlckFwcGx5ID8gYXBwbHlSZXN1bHQucCA6IGFjY2VwdGVkO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24gPSB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBzdGF0ZS5jb25uZWN0ZWQsXG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogc3RhdGUuY29ubmVjdGVkID8gJ2Nvbm5lY3RlZCcgYXMgY29uc3QgOiAnZGlzY29ubmVjdGVkJyBhcyBjb25zdCB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoe1xuXHRcdFx0XHRcdHBhaXJpbmdQZW5kaW5nOiBzdGF0ZS5wYWlyaW5nSG9sZCxcblx0XHRcdFx0XHRnaXRXcml0ZUNhcGFiaWxpdHk6IHtcblx0XHRcdFx0XHRcdHdyaXRlR2l0U3RhZ2VQYXRoczogJ1NVUFBPUlRFRCcgYXMgY29uc3QsIHdyaXRlR2l0Q29tbWl0OiAnU1VQUE9SVEVEJyBhcyBjb25zdCxcblx0XHRcdFx0XHRcdHdyaXRlR2l0QXBwbHlIdW5rczogc3RhdGUuYXBwbHlTdXBwb3J0ZWQgPyAnU1VQUE9SVEVEJyBhcyBjb25zdCA6ICdVTlNVUFBPUlRFRCcgYXMgY29uc3QsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSksXG5cdFx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogY29ubmVjdGlvbkNoYW5nZWQuZXZlbnQsXG5cdFx0XHRcdHJlYWRHaXRGaWxlRGlmZjogYXN5bmMgKHJlcXVlc3Q6IFVuaXZlcnNlQWdlbnRSZWFkR2l0RmlsZURpZmZSZXF1ZXN0KSA9PiB7XG5cdFx0XHRcdFx0cmVhZHMucHVzaChyZXF1ZXN0KTtcblx0XHRcdFx0XHR2b2lkIHJlYWRTdGFydGVkLmNvbXBsZXRlKCk7XG5cdFx0XHRcdFx0YXdhaXQgcmVhZFJlc3VsdC5wO1xuXHRcdFx0XHRcdHJldHVybiB7IHN1cHBvcnRlZDogdHJ1ZSwgcmVhc29uOiAnJywgcGF0aDogcmVxdWVzdC5wYXRoLCB1bmlmaWVkRGlmZjogdmFsaWREaWZmIH07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCB3cml0ZUdpdEFwcGx5SHVua3MoKSB7IHJldHVybiBzdGF0ZS5oYXNBcHBseUhvb2sgPyBhcHBseSA6IHVuZGVmaW5lZDsgfSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb247XG5cdFx0XHRjb25zdCBzZXNzaW9uOiBJQWdlbnRTZXNzaW9uQ29udGV4dCA9IHtcblx0XHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+IHN0YXRlLmFjdGl2ZVNlc3Npb25JZCxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHN0YXRlLnJlYWRpbmVzcyA9PT0gJ3JlYWR5Jyxcblx0XHRcdFx0Z2V0RW5naW5lU2Vzc2lvblJlYWRpbmVzczogKCkgPT4gc3RhdGUucmVhZGluZXNzLFxuXHRcdFx0XHRpc1BhaXJpbmdIb2xkOiAoKSA9PiBzdGF0ZS5wYWlyaW5nSG9sZCxcblx0XHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uOiBzZXNzaW9uQ2hhbmdlZC5ldmVudCxcblx0XHRcdFx0b25EaWRDaGFuZ2VTZXNzaW9uOiBzZXNzaW9uQ2hhbmdlZC5ldmVudCxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IHVzZWQnKTsgfSxcblx0XHRcdH07XG5cdFx0XHRjb25zdCBzbmFwc2hvdCA9ICgpID0+ICh7XG5cdFx0XHRcdGdlbmVyYXRpb246IDEsIHNldHRsZWQ6IHRydWUsXG5cdFx0XHRcdHN0YXRlOiBzdGF0ZS5naXRSZWFkRmFpbGVkXG5cdFx0XHRcdFx0PyB7IGtpbmQ6ICdlbmdpbmUtbGVmdG92ZXInIGFzIGNvbnN0LCBzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLCByZWFzb246ICdyZWFkLWZhaWxlZCcgYXMgY29uc3QgfVxuXHRcdFx0XHRcdDogeyBraW5kOiAnZW5naW5lLWxpdmUnIGFzIGNvbnN0LCBzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnIH0sXG5cdFx0XHRcdGVudHJpZXM6IFtdLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBjaGFuZ2VzOiBJU291cmNlc0NoYW5nZXNNb2RlbCA9IHtcblx0XHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLCBvbkRpZENoYW5nZTogY2hhbmdlc0NoYW5nZWQuZXZlbnQsIGdldFNuYXBzaG90OiBzbmFwc2hvdCxcblx0XHRcdFx0aXNXcml0ZUNsb3NlZDogKCkgPT4gaXNTb3VyY2VzQ2hhbmdlc1dyaXRlQ2xvc2VkKHNuYXBzaG90KCkuc3RhdGUsIHtcblx0XHRcdFx0XHRwaGFzZUNvbm5lY3RlZDogc3RhdGUuY29ubmVjdGVkLCBwYWlyaW5nUGVuZGluZzogc3RhdGUucGFpcmluZ0hvbGQsXG5cdFx0XHRcdFx0ZW5naW5lQ29ubmVjdGVkOiBzdGF0ZS5jb25uZWN0ZWQsIGVuZ2luZVNlc3Npb25SZWFkeTogc3RhdGUucmVhZGluZXNzID09PSAncmVhZHknLFxuXHRcdFx0XHR9KSxcblx0XHRcdFx0aXNGaWxlRGlmZk9wZW5Ta2lwcGVkOiAoKSA9PiBzdGF0ZS5wYWlyaW5nSG9sZCB8fCBzdGF0ZS5naXRSZWFkRmFpbGVkLFxuXHRcdFx0XHRyZWZyZXNoOiBhc3luYyAoKSA9PiB7IH0sIHNjaGVkdWxlUmVmcmVzaDogKCkgPT4geyByZWZyZXNoZXMrKzsgfSwgZmx1c2hTY2hlZHVsZWRSZWZyZXNoOiAoKSA9PiB7IH0sXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvbiA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgc3RvcmUpO1xuXHRcdFx0aW5zdGFudGlhdGlvbi5zdHViKElEaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSwgbmV3IFRlc3REaWZmUHJvdmlkZXJGYWN0b3J5U2VydmljZSgpKTtcblx0XHRcdGluc3RhbnRpYXRpb24uc3R1YihJVXNlckludGVyYWN0aW9uU2VydmljZSwgbmV3IE1vY2tVc2VySW50ZXJhY3Rpb25TZXJ2aWNlKCkpO1xuXHRcdFx0aW5zdGFudGlhdGlvbi5zdHViKElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIGNyZWF0ZVZpZXdEZXNjcmlwdG9yU2VydmljZVN0dWIoKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uLnN0dWIoSUVkaXRvclByb2dyZXNzU2VydmljZSwge1xuXHRcdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsIHNob3c6ICgpID0+IGVtcHR5UHJvZ3Jlc3NSdW5uZXIsXG5cdFx0XHRcdHNob3dXaGlsZTogYXN5bmMgcHJvbWlzZSA9PiB7IGF3YWl0IHByb21pc2U7IH0sXG5cdFx0XHR9IHNhdGlzZmllcyBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb24uc3R1YihJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIGNvbm5lY3Rpb24pO1xuXHRcdFx0aW5zdGFudGlhdGlvbi5zdHViKElBZ2VudFNlc3Npb25Db250ZXh0LCBzZXNzaW9uKTtcblx0XHRcdGluc3RhbnRpYXRpb24uc3R1YihJU291cmNlc0NoYW5nZXNNb2RlbCwgY2hhbmdlcyk7XG5cdFx0XHRpbnN0YW50aWF0aW9uLnN0dWIoSUNvbW1hbmRTZXJ2aWNlLCB7XG5cdFx0XHRcdC4uLk51bGxDb21tYW5kU2VydmljZSwgZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIDxUPihpZDogc3RyaW5nKTogUHJvbWlzZTxUIHwgdW5kZWZpbmVkPiA9PiB7IGNvbW1hbmRzLnB1c2goaWQpOyByZXR1cm4gdW5kZWZpbmVkOyB9LFxuXHRcdFx0fSBzYXRpc2ZpZXMgSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRcdGluc3RhbnRpYXRpb24uc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRcdG9wZW5WaWV3OiBhc3luYyAoKSA9PiBudWxsLCBvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5OiBFdmVudC5Ob25lLCBvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElWaWV3c1NlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcmVmOiBJU291cmNlc0NoYW5nZVJlZiA9IHtcblx0XHRcdFx0bW9kaWZpZWQ6IFVSSS5wYXJzZSgnaW5tZW1vcnk6Ly9hY2NlcHQtYXV0aG9yaXphdGlvbi9tb2RpZmllZCcpLCBvcmlnaW5hbDogVVJJLnBhcnNlKCdpbm1lbW9yeTovL2FjY2VwdC1hdXRob3JpemF0aW9uL29yaWdpbmFsJyksXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsIG9yaWdpbjogJ2VuZ2luZScsIHNlc3Npb25JZDogJ3Nlc3Npb24tMScsIGdpdFBhdGg6ICdzcmMvYS50cycsIGluZGV4U3RhdGU6ICdVbnN0YWdlZCcsIGtpbmQ6ICdNb2RpZmllZCcsXG5cdFx0XHR9O1xuXHRcdFx0aW5zdGFudGlhdGlvbi5zdHViKElTQ01TZXJ2aWNlLCBjcmVhdGVMZWZ0b3ZlclNjbVNlcnZpY2UocmVmLm1vZGlmaWVkKSk7XG5cdFx0XHRjb25zdCBtb2RlbHMgPSBpbnN0YW50aWF0aW9uLmdldChJTW9kZWxTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHJlc29sdmVyID0gaW5zdGFudGlhdGlvbi5nZXQoSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgc2VlZCA9IGFzeW5jICh2YWx1ZTogSVNvdXJjZXNDaGFuZ2VSZWYpID0+IHtcblx0XHRcdFx0YXNzZXJ0Lm9rKHZhbHVlLm9yaWdpbmFsKTtcblx0XHRcdFx0aWYgKCFtb2RlbHMuZ2V0TW9kZWwodmFsdWUub3JpZ2luYWwpKSB7IHN0b3JlLmFkZChtb2RlbHMuY3JlYXRlTW9kZWwoJ2xpbmUxXFxub2xkJywgbnVsbCwgdmFsdWUub3JpZ2luYWwpKTsgfVxuXHRcdFx0XHRpZiAoIW1vZGVscy5nZXRNb2RlbCh2YWx1ZS5tb2RpZmllZCkpIHsgc3RvcmUuYWRkKG1vZGVscy5jcmVhdGVNb2RlbCgnbGluZTFcXG5uZXcnLCBudWxsLCB2YWx1ZS5tb2RpZmllZCkpOyB9XG5cdFx0XHRcdC8vIEhvbGQgcmVhbCByZXNvbHZlciByZWZzIGFjcm9zcyBjbGVhci9zaG93IHNvIHRoZSBzYW1lLXJlZiBBQkEgc3RpbGwgcmVuZGVycyB2YWxpZCBtb2RlbHMuXG5cdFx0XHRcdHN0b3JlLmFkZChhd2FpdCByZXNvbHZlci5jcmVhdGVNb2RlbFJlZmVyZW5jZSh2YWx1ZS5vcmlnaW5hbCkpO1xuXHRcdFx0XHRzdG9yZS5hZGQoYXdhaXQgcmVzb2x2ZXIuY3JlYXRlTW9kZWxSZWZlcmVuY2UodmFsdWUubW9kaWZpZWQpKTtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRcdGNvbnN0IHBhbmVsU2VydmljZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlKSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uLnN0dWIoSVNvdXJjZXNEaWZmUGFuZWxTZXJ2aWNlLCBwYW5lbFNlcnZpY2UpO1xuXHRcdFx0bGV0IHBhbmU6IENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IHBhbmVsOiBTb3VyY2VzRGlmZlBhbmVsVmlldyB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25EaWZmUmV2aWV3SW5wdXQocmVmLm1vZGlmaWVkLCByZWYub3JpZ2luYWwsIHJlZi5ncm91cElkLCByZWYpKTtcblx0XHRcdGlmIChraW5kID09PSAnUGFuZScpIHtcblx0XHRcdFx0cGFuZSA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdFx0XHRwYW5lLmNyZWF0ZShwYXJlbnQpO1xuXHRcdFx0XHRhd2FpdCBzZWVkKHJlZik7XG5cdFx0XHRcdGF3YWl0IHBhbmUuc2V0SW5wdXQoaW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmRpZENvbXBhcmlzb25Mb2FkRmFpbCgpLCBmYWxzZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwYW5lbCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7IGlkOiBTT1VSQ0VTX0RJRkZfUEFORUxfVklFV19JRCwgdGl0bGU6ICdEaWZmJyB9KSk7XG5cdFx0XHRcdHBhbmVsLnJlbmRlcigpO1xuXHRcdFx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQocGFuZWwuZWxlbWVudCk7XG5cdFx0XHRcdGF3YWl0IHNlZWQocmVmKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHJlZiksIHRydWUpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaG9zdCA9IChwYW5lID8/IHBhbmVsKSE7XG5cdFx0XHRwaW5BY2NlcHRDdXJzb3IoaG9zdCwgMik7XG5cdFx0XHRjb25zdCBidXR0b24gPSBwYXJlbnQucXVlcnlTZWxlY3RvcihraW5kID09PSAnUGFuZScgPyAnLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1hY2NlcHQnIDogJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWNjZXB0Jyk7XG5cdFx0XHRhc3NlcnQub2soYnV0dG9uIGluc3RhbmNlb2YgSFRNTEJ1dHRvbkVsZW1lbnQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1dHRvbi5zdHlsZS5kaXNwbGF5LCAnJyk7XG5cdFx0XHRjb25zdCBub3RpY2UgPSBwYXJlbnQucXVlcnlTZWxlY3RvcihraW5kID09PSAnUGFuZScgPyAnLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnIDogJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWN0aW9uLW5vdGljZScpO1xuXHRcdFx0YXNzZXJ0Lm9rKG5vdGljZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KTtcblx0XHRcdGNvbnN0IHJ1biA9ICgpID0+IChob3N0IGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQoKTogUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHRcdGNvbnN0IHdhaXRGb3IgPSBhc3luYyAoc3RhcnRlZDogRGVmZXJyZWRQcm9taXNlPHZvaWQ+LCBvcGVyYXRpb246IFByb21pc2U8dm9pZD4pID0+IHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5yYWNlKFtzdGFydGVkLnAsIG9wZXJhdGlvbi50aGVuKCgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdBY2NlcHQgcmV0dXJuZWQgYmVmb3JlIHRoZSBleHBlY3RlZCBSUEMgc3RhcnRlZCcpOyB9KV0pO1xuXHRcdFx0fTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHN0YXRlLCByZWFkcywgYXBwbGllcywgY29tbWFuZHMsIG5vdGljZSwgaW5wdXQsXG5cdFx0XHRcdHJlYWRSZXN1bHQsIGFwcGx5UmVzdWx0LCBhcHBseVN0YXJ0ZWQsIHJ1bixcblx0XHRcdFx0d2FpdEZvclJlYWQ6IChvcGVyYXRpb246IFByb21pc2U8dm9pZD4pID0+IHdhaXRGb3IocmVhZFN0YXJ0ZWQsIG9wZXJhdGlvbiksXG5cdFx0XHRcdHdhaXRGb3JBcHBseTogKG9wZXJhdGlvbjogUHJvbWlzZTx2b2lkPikgPT4gd2FpdEZvcihhcHBseVN0YXJ0ZWQsIG9wZXJhdGlvbiksXG5cdFx0XHRcdG5vdGlmeTogKCkgPT4geyBzZXNzaW9uQ2hhbmdlZC5maXJlKHN0YXRlLmFjdGl2ZVNlc3Npb25JZCk7IGNvbm5lY3Rpb25DaGFuZ2VkLmZpcmUoKTsgY2hhbmdlc0NoYW5nZWQuZmlyZSgpOyB9LFxuXHRcdFx0XHRwcm9qZWN0aW9uOiAoKSA9PiAoeyByZWFkcywgYXBwbGllcywgY29tbWFuZHMsIHJlZnJlc2hlcyB9KSxcblx0XHRcdFx0cmVhZEdhdGVzOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY3VycmVudCA9IHNuYXBzaG90KCkuc3RhdGU7XG5cdFx0XHRcdFx0cmV0dXJuIHsgY2F0YWxvZzogc2Vzc2lvbi5nZXRFbmdpbmVTZXNzaW9uUmVhZGluZXNzISgpLCBnaXRTdGF0ZTogY3VycmVudC5raW5kLCBnaXRSZWFzb246IGN1cnJlbnQua2luZCA9PT0gJ2VuZ2luZS1sZWZ0b3ZlcicgPyBjdXJyZW50LnJlYXNvbiA6IHVuZGVmaW5lZCB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRoYXNSYXdBcHBseUhvb2s6ICgpID0+IHR5cGVvZiBjb25uZWN0aW9uLndyaXRlR2l0QXBwbHlIdW5rcyA9PT0gJ2Z1bmN0aW9uJyxcblx0XHRcdFx0aW52YWxpZGF0ZTogYXN5bmMgKGFjdGlvbjogSW52YWxpZGF0aW9uKSA9PiB7XG5cdFx0XHRcdFx0aWYgKGFjdGlvbiA9PT0gJ2lucHV0LWRpc3Bvc2UnKSB7IGFzc2VydC5vayhwYW5lKTsgaW5wdXQuZGlzcG9zZSgpOyBhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5pbnB1dCwgaW5wdXQpOyByZXR1cm47IH1cblx0XHRcdFx0XHRpZiAoYWN0aW9uID09PSAnZGlzcG9zZScpIHsgaG9zdC5kaXNwb3NlKCk7IHJldHVybjsgfVxuXHRcdFx0XHRcdGlmIChhY3Rpb24gPT09ICdjbGVhcicgfHwgYWN0aW9uID09PSAnY2xlYXItYW5kLXJlc3RvcmUnKSB7XG5cdFx0XHRcdFx0XHRpZiAocGFuZSkgeyBwYW5lLmNsZWFySW5wdXQoKTsgfSBlbHNlIHsgcGFuZWxTZXJ2aWNlLmNsZWFyKCk7IH1cblx0XHRcdFx0XHRcdGlmIChhY3Rpb24gPT09ICdjbGVhcicpIHsgcmV0dXJuOyB9XG5cdFx0XHRcdFx0XHRpZiAocGFuZSkgeyBhd2FpdCBwYW5lLnNldElucHV0KGlucHV0LCB1bmRlZmluZWQsIE9iamVjdC5jcmVhdGUobnVsbCksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpOyB9XG5cdFx0XHRcdFx0XHRlbHNlIHsgYXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHBhbmVsU2VydmljZS5zaG93KHJlZiksIHRydWUpOyB9XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IG5leHQ6IElTb3VyY2VzQ2hhbmdlUmVmID0geyAuLi5yZWYsIG1vZGlmaWVkOiBVUkkucGFyc2UoJ2lubWVtb3J5Oi8vYWNjZXB0LWF1dGhvcml6YXRpb24vbmV4dCcpLCBvcmlnaW5hbDogVVJJLnBhcnNlKCdpbm1lbW9yeTovL2FjY2VwdC1hdXRob3JpemF0aW9uL25leHQtb3JpZ2luYWwnKSB9O1xuXHRcdFx0XHRcdGF3YWl0IHNlZWQobmV4dCk7XG5cdFx0XHRcdFx0aWYgKHBhbmUpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG5leHRJbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KG5leHQubW9kaWZpZWQsIG5leHQub3JpZ2luYWwsIG5leHQuZ3JvdXBJZCwgbmV4dCkpO1xuXHRcdFx0XHRcdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChuZXh0SW5wdXQsIHVuZGVmaW5lZCwgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHsgYXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHBhbmVsU2VydmljZS5zaG93KG5leHQpLCB0cnVlKTsgfVxuXHRcdFx0XHR9LFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBjYXNlczogcmVhZG9ubHkge1xuXHRcdFx0bmFtZTogc3RyaW5nOyB3cml0ZXM6IGJvb2xlYW47IG11dGF0ZShzdGF0ZTogTXV0YWJsZUF1dGhvcml6YXRpb24sIG5vdGlmeTogKCkgPT4gdm9pZCk6IHZvaWQ7XG5cdFx0XHRjYXRhbG9nPzogJ3VuYXZhaWxhYmxlJzsgZ2l0RmFpbGVkPzogYm9vbGVhbjsgc2Vzc2lvbk5vdGljZT86IGJvb2xlYW47XG5cdFx0fVtdID0gW1xuXHRcdFx0eyBuYW1lOiAnQTEgYWN0aXZlIHNlc3Npb24gY2hhbmdlcyB0byBzMiBiZWZvcmUgd3JpdGUnLCB3cml0ZXM6IGZhbHNlLCBtdXRhdGU6IHN0YXRlID0+IHsgc3RhdGUuYWN0aXZlU2Vzc2lvbklkID0gJ3Nlc3Npb24tMic7IH0sIHNlc3Npb25Ob3RpY2U6IHRydWUgfSxcblx0XHRcdHsgbmFtZTogJ0ExIGFjdGl2ZSBzZXNzaW9uIGJlY29tZXMgZW1wdHkgYmVmb3JlIHdyaXRlJywgd3JpdGVzOiBmYWxzZSwgbXV0YXRlOiBzdGF0ZSA9PiB7IHN0YXRlLmFjdGl2ZVNlc3Npb25JZCA9ICcnOyB9LCBzZXNzaW9uTm90aWNlOiB0cnVlIH0sXG5cdFx0XHR7IG5hbWU6ICdBMiBzYW1lLXNlc3Npb24gdmFsaWQgcGF0Y2ggcmVhY2hlcyBBcHBseUh1bmtzIGV4YWN0bHkgb25jZScsIHdyaXRlczogdHJ1ZSwgbXV0YXRlOiAoKSA9PiB7IH0gfSxcblx0XHRcdHsgbmFtZTogJ0EzIHMxIHRvIHMyIHRvIHMxIHVzZXMgY3VycmVudCBhdXRob3JpemF0aW9uJywgd3JpdGVzOiB0cnVlLCBtdXRhdGU6IChzdGF0ZSwgbm90aWZ5KSA9PiB7IHN0YXRlLmFjdGl2ZVNlc3Npb25JZCA9ICdzZXNzaW9uLTInOyBub3RpZnkoKTsgc3RhdGUuYWN0aXZlU2Vzc2lvbklkID0gJ3Nlc3Npb24tMSc7IH0gfSxcblx0XHRcdHsgbmFtZTogJ0E1IGRpc2Nvbm5lY3RlZCBiZWZvcmUgd3JpdGUnLCB3cml0ZXM6IGZhbHNlLCBtdXRhdGU6IHN0YXRlID0+IHsgc3RhdGUuY29ubmVjdGVkID0gZmFsc2U7IH0gfSxcblx0XHRcdHsgbmFtZTogJ0E1IHBhaXJpbmcgaG9sZCBiZWZvcmUgd3JpdGUnLCB3cml0ZXM6IGZhbHNlLCBtdXRhdGU6IHN0YXRlID0+IHsgc3RhdGUucGFpcmluZ0hvbGQgPSB0cnVlOyB9IH0sXG5cdFx0XHR7IG5hbWU6ICdBNSBjYXRhbG9nIFNlc3Npb24gTGlzdCBmYWlsdXJlIGxlYXZlcyByZWFkaW5lc3MgdW5hdmFpbGFibGUnLCB3cml0ZXM6IGZhbHNlLCBtdXRhdGU6IHN0YXRlID0+IHsgc3RhdGUucmVhZGluZXNzID0gJ3VuYXZhaWxhYmxlJzsgfSwgY2F0YWxvZzogJ3VuYXZhaWxhYmxlJyB9LFxuXHRcdFx0eyBuYW1lOiAnQTUgR2l0IENoYW5nZXMgZmFpbHVyZSBsZWF2ZXMgcmVhZC1mYWlsZWQgc25hcHNob3QnLCB3cml0ZXM6IGZhbHNlLCBtdXRhdGU6IHN0YXRlID0+IHsgc3RhdGUuZ2l0UmVhZEZhaWxlZCA9IHRydWU7IH0sIGdpdEZhaWxlZDogdHJ1ZSB9LFxuXHRcdFx0eyBuYW1lOiAnQTUgQXBwbHlIdW5rcyBjYXBhYmlsaXR5IGJlY29tZXMgdW5zdXBwb3J0ZWQnLCB3cml0ZXM6IGZhbHNlLCBtdXRhdGU6IHN0YXRlID0+IHsgc3RhdGUuYXBwbHlTdXBwb3J0ZWQgPSBmYWxzZTsgfSB9LFxuXHRcdFx0eyBuYW1lOiAnQTUgQXBwbHlIdW5rcyBob29rIGJlY29tZXMgdW5hdmFpbGFibGUnLCB3cml0ZXM6IGZhbHNlLCBtdXRhdGU6IHN0YXRlID0+IHsgc3RhdGUuaGFzQXBwbHlIb29rID0gZmFsc2U7IH0gfSxcblx0XHRcdHsgbmFtZTogJ0E2IGNhdGFsb2cgU2Vzc2lvbiBMaXN0IGZhaWx1cmUgcmVjb3ZlcnMgaW5kZXBlbmRlbnRseScsIHdyaXRlczogdHJ1ZSwgbXV0YXRlOiAoc3RhdGUsIG5vdGlmeSkgPT4geyBzdGF0ZS5yZWFkaW5lc3MgPSAndW5hdmFpbGFibGUnOyBub3RpZnkoKTsgc3RhdGUucmVhZGluZXNzID0gJ3JlYWR5JzsgfSB9LFxuXHRcdFx0eyBuYW1lOiAnQTYgR2l0IENoYW5nZXMgcmVhZC1mYWlsZWQgc25hcHNob3QgcmVjb3ZlcnMgaW5kZXBlbmRlbnRseScsIHdyaXRlczogdHJ1ZSwgbXV0YXRlOiAoc3RhdGUsIG5vdGlmeSkgPT4geyBzdGF0ZS5naXRSZWFkRmFpbGVkID0gdHJ1ZTsgbm90aWZ5KCk7IHN0YXRlLmdpdFJlYWRGYWlsZWQgPSBmYWxzZTsgfSB9LFxuXHRcdFx0eyBuYW1lOiAnQTYgc2FtZS1pZCBkaXNjb25uZWN0IHJlY29ubmVjdCB1c2VzIGN1cnJlbnQgYXV0aG9yaXphdGlvbicsIHdyaXRlczogdHJ1ZSwgbXV0YXRlOiAoc3RhdGUsIG5vdGlmeSkgPT4geyBzdGF0ZS5jb25uZWN0ZWQgPSBmYWxzZTsgbm90aWZ5KCk7IHN0YXRlLmNvbm5lY3RlZCA9IHRydWU7IH0gfSxcblx0XHRdO1xuXHRcdGZvciAoY29uc3Qga2luZCBvZiBbJ1BhbmUnLCAnUGFuZWwnXSBhcyBjb25zdCkge1xuXHRcdFx0Zm9yIChjb25zdCBzY2VuYXJpbyBvZiBjYXNlcykge1xuXHRcdFx0XHR0ZXN0KGAke2tpbmR9ICR7c2NlbmFyaW8ubmFtZX1gLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaCA9IGF3YWl0IG1vdW50QXV0aG9yaXphdGlvbkhvc3Qoa2luZCk7XG5cdFx0XHRcdFx0Y29uc3Qgb3BlcmF0aW9uID0gaC5ydW4oKTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0YXdhaXQgaC53YWl0Rm9yUmVhZChvcGVyYXRpb24pO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoLnJlYWRzLCBbZXhwZWN0ZWRSZWFkXSk7XG5cdFx0XHRcdFx0XHRzY2VuYXJpby5tdXRhdGUoaC5zdGF0ZSwgaC5ub3RpZnkpO1xuXHRcdFx0XHRcdFx0aC5ub3RpZnkoKTtcblx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaC5yZWFkR2F0ZXMoKSwgeyBjYXRhbG9nOiBzY2VuYXJpby5jYXRhbG9nID8/ICdyZWFkeScsIGdpdFN0YXRlOiBzY2VuYXJpby5naXRGYWlsZWQgPyAnZW5naW5lLWxlZnRvdmVyJyA6ICdlbmdpbmUtbGl2ZScsIGdpdFJlYXNvbjogc2NlbmFyaW8uZ2l0RmFpbGVkID8gJ3JlYWQtZmFpbGVkJyA6IHVuZGVmaW5lZCB9KTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoLmhhc1Jhd0FwcGx5SG9vaygpLCBoLnN0YXRlLmhhc0FwcGx5SG9vaywgJ2NhcGFiaWxpdHkgcmVmdXNhbCByZXRhaW5zIHRoZSBpbnN0YWxsZWQgcmF3IG1ldGhvZDsgaG9vayBhYnNlbmNlIGlzIGEgc2VwYXJhdGUgY2FzZScpO1xuXHRcdFx0XHRcdFx0YXdhaXQgaC5yZWFkUmVzdWx0LmNvbXBsZXRlKCk7XG5cdFx0XHRcdFx0XHRhd2FpdCBvcGVyYXRpb247XG5cdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGgucHJvamVjdGlvbigpLCB7IHJlYWRzOiBbZXhwZWN0ZWRSZWFkXSwgYXBwbGllczogc2NlbmFyaW8ud3JpdGVzID8gW2V4cGVjdGVkQXBwbHldIDogW10sIGNvbW1hbmRzOiBbXSwgcmVmcmVzaGVzOiBzY2VuYXJpby53cml0ZXMgPyAxIDogMCB9KTtcblx0XHRcdFx0XHRcdGlmIChzY2VuYXJpby5zZXNzaW9uTm90aWNlKSB7IGFzc2VydC5zdHJpY3RFcXVhbChoLm5vdGljZS50ZXh0Q29udGVudCwgc291cmNlc0dpdFNlc3Npb25DaGFuZ2VkTWVzc2FnZSgpKTsgfVxuXHRcdFx0XHRcdH0gZmluYWxseSB7IGF3YWl0IGgucmVhZFJlc3VsdC5jb21wbGV0ZSgpOyBhd2FpdCBvcGVyYXRpb247IH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBbJ3JlcGxhY2UnLCAnY2xlYXInLCAnZGlzcG9zZScsICdjbGVhci1hbmQtcmVzdG9yZSddIGFzIGNvbnN0KSB7XG5cdFx0XHRcdHRlc3QoYCR7a2luZH0gQTQgJHthY3Rpb259IGludmFsaWRhdGVzIHRoZSBwZW5kaW5nIHJlYWQgb3duZXJgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaCA9IGF3YWl0IG1vdW50QXV0aG9yaXphdGlvbkhvc3Qoa2luZCk7XG5cdFx0XHRcdFx0Y29uc3Qgb3BlcmF0aW9uID0gaC5ydW4oKTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0YXdhaXQgaC53YWl0Rm9yUmVhZChvcGVyYXRpb24pO1xuXHRcdFx0XHRcdFx0YXdhaXQgaC5pbnZhbGlkYXRlKGFjdGlvbik7XG5cdFx0XHRcdFx0XHRjb25zdCBub3RpY2UgPSBoLm5vdGljZS50ZXh0Q29udGVudDtcblx0XHRcdFx0XHRcdGF3YWl0IGgucmVhZFJlc3VsdC5jb21wbGV0ZSgpO1xuXHRcdFx0XHRcdFx0YXdhaXQgb3BlcmF0aW9uO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoLnByb2plY3Rpb24oKSwgeyByZWFkczogW2V4cGVjdGVkUmVhZF0sIGFwcGxpZXM6IFtdLCBjb21tYW5kczogW10sIHJlZnJlc2hlczogMCB9KTtcblx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoLm5vdGljZS50ZXh0Q29udGVudCwgbm90aWNlKTtcblx0XHRcdFx0XHR9IGZpbmFsbHkgeyBhd2FpdCBoLnJlYWRSZXN1bHQuY29tcGxldGUoKTsgYXdhaXQgb3BlcmF0aW9uOyB9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWZ0ZXJXcml0ZUFjdGlvbnM6IHJlYWRvbmx5IEludmFsaWRhdGlvbltdID0ga2luZCA9PT0gJ1BhbmUnID8gWydyZXBsYWNlJywgJ2Rpc3Bvc2UnLCAnaW5wdXQtZGlzcG9zZSddIDogWydyZXBsYWNlJywgJ2Rpc3Bvc2UnXTtcblx0XHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIGFmdGVyV3JpdGVBY3Rpb25zKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qgb3V0Y29tZSBvZiBbJ2FjY2VwdGVkJywgJ2ZhaWxlZCcsICdyZWplY3RlZCddIGFzIGNvbnN0KSB7XG5cdFx0XHRcdFx0dGVzdChgJHtraW5kfSBBNyBzZW50IHdyaXRlIHRoZW4gJHthY3Rpb259IGtlZXBzICR7b3V0Y29tZX0gb2ZmIHRoZSBpbnZhbGlkIG93bmVyYCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaCA9IGF3YWl0IG1vdW50QXV0aG9yaXphdGlvbkhvc3Qoa2luZCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRjb25zdCBvcGVyYXRpb24gPSBoLnJ1bigpO1xuXHRcdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgaC53YWl0Rm9yUmVhZChvcGVyYXRpb24pO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBoLnJlYWRSZXN1bHQuY29tcGxldGUoKTtcblx0XHRcdFx0XHRcdFx0YXdhaXQgaC53YWl0Rm9yQXBwbHkob3BlcmF0aW9uKTtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoLmFwcGxpZXMsIFtleHBlY3RlZEFwcGx5XSwgJ3RoZSB3cml0ZSB3YXMgc2VudCBiZWZvcmUgaW52YWxpZGF0aW9uJyk7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IGguaW52YWxpZGF0ZShhY3Rpb24pO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBub3RpY2UgPSBoLm5vdGljZS50ZXh0Q29udGVudDtcblx0XHRcdFx0XHRcdFx0aWYgKG91dGNvbWUgPT09ICdyZWplY3RlZCcpIHsgYXdhaXQgaC5hcHBseVJlc3VsdC5lcnJvcihuZXcgRXJyb3IoJ2xhdGUgQXBwbHlIdW5rcyBmYWlsdXJlJykpOyB9XG5cdFx0XHRcdFx0XHRcdGVsc2UgeyBhd2FpdCBoLmFwcGx5UmVzdWx0LmNvbXBsZXRlKG91dGNvbWUgPT09ICdhY2NlcHRlZCcgPyBhY2NlcHRlZCA6IHsgLi4uYWNjZXB0ZWQsIHN1Y2Nlc3M6IGZhbHNlLCBlcnJvck1lc3NhZ2U6ICdsYXRlIEFwcGx5SHVua3MgZmFpbHVyZScsIGV4aXRDb2RlOiAxIH0pOyB9XG5cdFx0XHRcdFx0XHRcdGF3YWl0IG9wZXJhdGlvbjtcblx0XHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoLnByb2plY3Rpb24oKSwgeyByZWFkczogW2V4cGVjdGVkUmVhZF0sIGFwcGxpZXM6IFtleHBlY3RlZEFwcGx5XSwgY29tbWFuZHM6IFtdLCByZWZyZXNoZXM6IDAgfSk7XG5cdFx0XHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoLm5vdGljZS50ZXh0Q29udGVudCwgbm90aWNlKTtcblx0XHRcdFx0XHRcdH0gZmluYWxseSB7IGF3YWl0IGgucmVhZFJlc3VsdC5jb21wbGV0ZSgpOyBhd2FpdCBoLmFwcGx5UmVzdWx0LmNvbXBsZXRlKGFjY2VwdGVkKTsgYXdhaXQgb3BlcmF0aW9uOyB9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdGNvbnN0IGFjY2VwdEN1cnNvclVuaWZpZWREaWZmID0gW1xuXHRcdCdkaWZmIC0tZ2l0IGEvc3JjL2EudHMgYi9zcmMvYi50cycsXG5cdFx0J3JlbmFtZSBmcm9tIHNyYy9hLnRzJyxcblx0XHQncmVuYW1lIHRvIHNyYy9iLnRzJyxcblx0XHQnb2xkIG1vZGUgMTAwNjQ0Jyxcblx0XHQnbmV3IG1vZGUgMTAwNzU1Jyxcblx0XHQnLS0tIGEvc3JjL2EudHMnLFxuXHRcdCcrKysgYi9zcmMvYi50cycsXG5cdFx0J0BAIC0xLDMgKzEsNCBAQCcsXG5cdFx0JyBsaW5lMScsXG5cdFx0Jy1vbGQnLFxuXHRcdCcrbmV3Jyxcblx0XHQnK2V4dHJhJyxcblx0XHQnQEAgLTEwLDIgKzExLDMgQEAnLFxuXHRcdCcga2VlcCcsXG5cdFx0Jy1nb25lJyxcblx0XHQnK2FkZGVkJyxcblx0XHQnK21vcmUnLFxuXHRcdCdcXFxcIE5vIG5ld2xpbmUgYXQgZW5kIG9mIGZpbGUnLFxuXHRdLmpvaW4oJ1xcbicpO1xuXG5cdGludGVyZmFjZSBJQWNjZXB0SHVua01vdW50IHtcblx0XHRyZWFkb25seSB2aWV3OiBTb3VyY2VzRGlmZlBhbmVsVmlldztcblx0XHRyZWFkb25seSBwYW5lOiBDb252ZXJzYXRpb25EaWZmUmV2aWV3UGFuZTtcblx0XHRyZWFkb25seSBwYXJlbnQ6IEhUTUxFbGVtZW50O1xuXHRcdHJlYWRvbmx5IGFwcGx5Q2FsbHM6IFVuaXZlcnNlQWdlbnRXcml0ZUdpdEFwcGx5SHVua3NSZXF1ZXN0W107XG5cdFx0cmVhZG9ubHkgcmVhZENhbGxzOiBVbml2ZXJzZUFnZW50UmVhZEdpdEZpbGVEaWZmUmVxdWVzdFtdO1xuXHRcdHJlYWRvbmx5IGdpdENvbW1hbmRzOiBzdHJpbmdbXTtcblx0XHRyZWFkb25seSByZWZyZXNoQ291bnQ6IHsgbjogbnVtYmVyIH07XG5cdH1cblxuXHRmdW5jdGlvbiBlbmdpbmVBY2NlcHRSZWYobmFtZTogc3RyaW5nLCBvdmVycmlkZXM6IFBhcnRpYWw8SVNvdXJjZXNDaGFuZ2VSZWY+ID0ge30pOiBJU291cmNlc0NoYW5nZVJlZiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG1vZGlmaWVkOiBVUkkuZnJvbSh7IHNjaGVtZTogJ3NvdXJjZXMtZ2l0LWRpZmYnLCBwYXRoOiBgL21vZGlmaWVkLyR7bmFtZX1gIH0pLFxuXHRcdFx0b3JpZ2luYWw6IFVSSS5mcm9tKHsgc2NoZW1lOiAnc291cmNlcy1naXQtZGlmZicsIHBhdGg6IGAvb3JpZ2luYWwvJHtuYW1lfWAgfSksXG5cdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0b3JpZ2luOiAnZW5naW5lJyxcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRnaXRQYXRoOiAnc3JjL2EudHMnLFxuXHRcdFx0aW5kZXhTdGF0ZTogJ1Vuc3RhZ2VkJyxcblx0XHRcdGtpbmQ6ICdNb2RpZmllZCcsXG5cdFx0XHQuLi5vdmVycmlkZXMsXG5cdFx0fTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIG1vdW50QWNjZXB0SHVua0hvc3RzKHRlc3Q6IE1vY2hhLkNvbnRleHQsIG9wdGlvbnM6IHtcblx0XHRyZWY6IElTb3VyY2VzQ2hhbmdlUmVmO1xuXHRcdG1hdGNoU2NtPzogYm9vbGVhbjtcblx0XHRzY21Hcm91cElkPzogc3RyaW5nO1xuXHRcdGNvbm5lY3RlZD86IGJvb2xlYW47XG5cdFx0ZW5naW5lU2Vzc2lvblJlYWR5PzogYm9vbGVhbjtcblx0XHR3cml0ZUNsb3NlZD86IGJvb2xlYW47XG5cdFx0Y291bnRSZWZyZXNoPzogYm9vbGVhbjtcblx0XHR1bmlmaWVkRGlmZj86IHN0cmluZztcblx0XHRhcHBseVN1Y2Nlc3M/OiBib29sZWFuO1xuXHRcdGFwcGx5RXJyb3JNZXNzYWdlPzogc3RyaW5nO1xuXHR9KTogUHJvbWlzZTxJQWNjZXB0SHVua01vdW50PiB7XG5cdFx0Y29uc3QgYXBwbHlDYWxsczogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IHJlYWRDYWxsczogVW5pdmVyc2VBZ2VudFJlYWRHaXRGaWxlRGlmZlJlcXVlc3RbXSA9IFtdO1xuXHRcdGNvbnN0IGdpdENvbW1hbmRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IHJlZnJlc2hDb3VudCA9IHsgbjogMCB9O1xuXHRcdGNvbnN0IHVuaWZpZWREaWZmID0gb3B0aW9ucy51bmlmaWVkRGlmZiA/PyBhY2NlcHRDdXJzb3JVbmlmaWVkRGlmZjtcblx0XHRjb25zdCBjb25uZWN0ZWQgPSBvcHRpb25zLmNvbm5lY3RlZCA/PyB0cnVlO1xuXHRcdGNvbnN0IGFwcGx5UmVzdWx0OiBVbml2ZXJzZUFnZW50V3JpdGVHaXRXcml0ZVJlc3VsdCA9IHtcblx0XHRcdHN1cHBvcnRlZDogdHJ1ZSxcblx0XHRcdHJlYXNvbjogJycsXG5cdFx0XHRzdWNjZXNzOiBvcHRpb25zLmFwcGx5U3VjY2VzcyA/PyB0cnVlLFxuXHRcdFx0ZXJyb3JNZXNzYWdlOiBvcHRpb25zLmFwcGx5RXJyb3JNZXNzYWdlID8/ICcnLFxuXHRcdFx0ZXhpdENvZGU6IG9wdGlvbnMuYXBwbHlTdWNjZXNzID09PSBmYWxzZSA/IDEgOiAwLFxuXHRcdFx0c3Rkb3V0OiAnJyxcblx0XHR9O1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSB7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gY29ubmVjdGVkLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiBjb25uZWN0ZWQgPyAnY29ubmVjdGVkJyBhcyBjb25zdCA6ICdkaXNjb25uZWN0ZWQnIGFzIGNvbnN0IH0pLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRyZWFkR2l0RmlsZURpZmY6IGFzeW5jIChyZXF1ZXN0OiBVbml2ZXJzZUFnZW50UmVhZEdpdEZpbGVEaWZmUmVxdWVzdCkgPT4ge1xuXHRcdFx0XHRyZWFkQ2FsbHMucHVzaChyZXF1ZXN0KTtcblx0XHRcdFx0cmV0dXJuIHsgc3VwcG9ydGVkOiB0cnVlLCByZWFzb246ICcnLCBwYXRoOiByZXF1ZXN0LnBhdGgsIHVuaWZpZWREaWZmIH07XG5cdFx0XHR9LFxuXHRcdFx0d3JpdGVHaXRBcHBseUh1bmtzOiBhc3luYyAocmVxdWVzdDogVW5pdmVyc2VBZ2VudFdyaXRlR2l0QXBwbHlIdW5rc1JlcXVlc3QpID0+IHtcblx0XHRcdFx0YXBwbHlDYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRyZXR1cm4gYXBwbHlSZXN1bHQ7XG5cdFx0XHR9LFxuXHRcdFx0d3JpdGVHaXRTdGFnZVBhdGhzOiBhc3luYyAoKSA9PiBhcHBseVJlc3VsdCxcblx0XHR9IGFzIHVua25vd24gYXMgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRcdGNvbnN0IHNjbVVyaSA9IG9wdGlvbnMubWF0Y2hTY20gPyBvcHRpb25zLnJlZi5tb2RpZmllZCA6IHRvUmVzb3VyY2UuY2FsbCh0ZXN0LCAnL3Byb2plY3Qvc3JjL3NjbS11bnJlbGF0ZWQudHMnKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHN0dWJEaWZmSG9uZXN0eVNlcnZpY2VzKHtcblx0XHRcdHRocm93T25Mb2FkOiB0cnVlLFxuXHRcdFx0cmVzb3VyY2U6IHNjbVVyaSxcblx0XHRcdGdyb3VwSWQ6IG9wdGlvbnMuc2NtR3JvdXBJZCA/PyAnd29ya2luZ1RyZWUnLFxuXHRcdFx0Y29ubmVjdGlvbixcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogb3B0aW9ucy5lbmdpbmVTZXNzaW9uUmVhZHkgPz8gdHJ1ZSxcblx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoY29tbWFuZElkOiB1bmtub3duKSA9PiB7XG5cdFx0XHRcdGdpdENvbW1hbmRzLnB1c2goU3RyaW5nKGNvbW1hbmRJZCkpO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRpZiAob3B0aW9ucy53cml0ZUNsb3NlZCB8fCBvcHRpb25zLmNvdW50UmVmcmVzaCkge1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU291cmNlc0NoYW5nZXNNb2RlbCwge1xuXHRcdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdFx0Z2V0U25hcHNob3Q6ICgpID0+ICh7XG5cdFx0XHRcdFx0Z2VuZXJhdGlvbjogMSxcblx0XHRcdFx0XHRzZXR0bGVkOiB0cnVlLFxuXHRcdFx0XHRcdHN0YXRlOiBvcHRpb25zLndyaXRlQ2xvc2VkXG5cdFx0XHRcdFx0XHQ/IHsga2luZDogJ2VuZ2luZS1sZWZ0b3ZlcicsIHNlc3Npb25JZDogJ3Nlc3Npb24tMScsIHJlYXNvbjogJ3JlYWQtZmFpbGVkJyB9XG5cdFx0XHRcdFx0XHQ6IHsga2luZDogJ3NjbScgfSxcblx0XHRcdFx0XHRlbnRyaWVzOiBbXSxcblx0XHRcdFx0fSksXG5cdFx0XHRcdGlzV3JpdGVDbG9zZWQ6ICgpID0+ICEhb3B0aW9ucy53cml0ZUNsb3NlZCxcblx0XHRcdFx0aXNGaWxlRGlmZk9wZW5Ta2lwcGVkOiAoKSA9PiAhIW9wdGlvbnMud3JpdGVDbG9zZWQsXG5cdFx0XHRcdHJlZnJlc2g6IGFzeW5jICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdFx0c2NoZWR1bGVSZWZyZXNoOiAoKSA9PiB7IHJlZnJlc2hDb3VudC5uKys7IH0sXG5cdFx0XHRcdGZsdXNoU2NoZWR1bGVkUmVmcmVzaDogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElTb3VyY2VzQ2hhbmdlc01vZGVsKTtcblx0XHR9XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVmlld3NTZXJ2aWNlLCB7XG5cdFx0XHRvcGVuVmlldzogYXN5bmMgKCkgPT4gbnVsbCxcblx0XHRcdG9uRGlkQ2hhbmdlVmlld1Zpc2liaWxpdHk6IEV2ZW50Lk5vbmUsXG5cdFx0XHRvbkRpZENoYW5nZVZpZXdDb250YWluZXJWaXNpYmlsaXR5OiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJVmlld3NTZXJ2aWNlKTtcblx0XHRjb25zdCBwYW5lbFNlcnZpY2UgPSBzdG9yZS5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU291cmNlc0RpZmZQYW5lbFNlcnZpY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTb3VyY2VzRGlmZlBhbmVsU2VydmljZSwgcGFuZWxTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3ID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNvdXJjZXNEaWZmUGFuZWxWaWV3LCB7XG5cdFx0XHRpZDogU09VUkNFU19ESUZGX1BBTkVMX1ZJRVdfSUQsXG5cdFx0XHR0aXRsZTogJ0RpZmYnLFxuXHRcdH0pKTtcblx0XHR2aWV3LnJlbmRlcigpO1xuXHRcdGF3YWl0IHBhbmVsU2VydmljZS5zaG93KG9wdGlvbnMucmVmKTtcblx0XHRhd2FpdCB0aW1lb3V0KDUwKTtcblx0XHRwYWludFBhbmVsV3JpdGVDaHJvbWUodmlldyk7XG5cblx0XHRjb25zdCBwYW5lID0gc3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbkRpZmZSZXZpZXdQYW5lLCBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKSkpO1xuXHRcdGNvbnN0IHBhcmVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBwYXJlbnQucmVtb3ZlKCkgfSk7XG5cdFx0cGFuZS5jcmVhdGUocGFyZW50KTtcblx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uRGlmZlJldmlld0lucHV0KG9wdGlvbnMucmVmLm1vZGlmaWVkLCBvcHRpb25zLnJlZi5vcmlnaW5hbCwgb3B0aW9ucy5yZWYuZ3JvdXBJZCwge1xuXHRcdFx0b3JpZ2luOiBvcHRpb25zLnJlZi5vcmlnaW4sXG5cdFx0XHRzZXNzaW9uSWQ6IG9wdGlvbnMucmVmLnNlc3Npb25JZCxcblx0XHRcdGdpdFBhdGg6IG9wdGlvbnMucmVmLmdpdFBhdGgsXG5cdFx0XHRpbmRleFN0YXRlOiBvcHRpb25zLnJlZi5pbmRleFN0YXRlLFxuXHRcdFx0a2luZDogb3B0aW9ucy5yZWYua2luZCxcblx0XHR9KSk7XG5cdFx0YXdhaXQgcGFuZS5zZXRJbnB1dChpbnB1dCwgdW5kZWZpbmVkLCBPYmplY3QuY3JlYXRlKG51bGwpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRwYWludFJldmlld1dyaXRlQ2hyb21lKHBhbmUpO1xuXHRcdHJldHVybiB7IHZpZXcsIHBhbmUsIHBhcmVudCwgYXBwbHlDYWxscywgcmVhZENhbGxzLCBnaXRDb21tYW5kcywgcmVmcmVzaENvdW50IH07XG5cdH1cblxuXHRmdW5jdGlvbiBwaW5BY2NlcHRDdXJzb3IoaG9zdDogb2JqZWN0LCBsaW5lOiBudW1iZXIsIHNpZGU6ICduZXcnIHwgJ29sZCcgPSAnbmV3Jyk6IHZvaWQge1xuXHRcdChob3N0IGFzIHsgYWNjZXB0Q3Vyc29yOiB7IHNpZGU6ICduZXcnIHwgJ29sZCc7IGxpbmU6IG51bWJlciB9IH0pLmFjY2VwdEN1cnNvciA9IHsgc2lkZSwgbGluZSB9O1xuXHR9XG5cblx0ZnVuY3Rpb24gYWNjZXB0QnV0dG9uRGlzcGxheShyb290OiB7IHF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3I6IHN0cmluZyk6IEVsZW1lbnQgfCBudWxsIH0sIHNlbGVjdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiAocm9vdC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKSBhcyBIVE1MRWxlbWVudCB8IG51bGwpPy5zdHlsZS5kaXNwbGF5ID8/ICdtaXNzaW5nJztcblx0fVxuXG5cdGZ1bmN0aW9uIHdyaXRlR3JvdXBJZChob3N0OiBvYmplY3QpOiBzdHJpbmcge1xuXHRcdHJldHVybiAoaG9zdCBhcyB7IGN1cnJlbnRXcml0ZUZhY3RzKCk6IHsgZ3JvdXBJZDogc3RyaW5nIH0gfCB1bmRlZmluZWQgfSkuY3VycmVudFdyaXRlRmFjdHMoKT8uZ3JvdXBJZCA/PyAnJztcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHJ1bkJvdGhBY2NlcHQoaGFybmVzczogSUFjY2VwdEh1bmtNb3VudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IChoYXJuZXNzLnZpZXcgYXMgdW5rbm93biBhcyB7IHJ1bkFjY2VwdDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9KS5ydW5BY2NlcHQoKTtcblx0XHRhd2FpdCAoaGFybmVzcy5wYW5lIGFzIHVua25vd24gYXMgeyBydW5BY2NlcHQ6ICgpID0+IFByb21pc2U8dm9pZD4gfSkucnVuQWNjZXB0KCk7XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRBY2NlcHRIaWRkZW4oaGFybmVzczogSUFjY2VwdEh1bmtNb3VudCk6IHZvaWQge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2NlcHRCdXR0b25EaXNwbGF5KGhhcm5lc3Mudmlldy5lbGVtZW50LCAnLnNvdXJjZXMtZGlmZi1wYW5lbC1hY2NlcHQnKSwgJ25vbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXB0QnV0dG9uRGlzcGxheShoYXJuZXNzLnBhcmVudCwgJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctYWNjZXB0JyksICdub25lJyk7XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRBY2NlcHRTaG93bihoYXJuZXNzOiBJQWNjZXB0SHVua01vdW50KTogdm9pZCB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2VwdEJ1dHRvbkRpc3BsYXkoaGFybmVzcy52aWV3LmVsZW1lbnQsICcuc291cmNlcy1kaWZmLXBhbmVsLWFjY2VwdCcpLCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2VwdEJ1dHRvbkRpc3BsYXkoaGFybmVzcy5wYXJlbnQsICcuY29udmVyc2F0aW9uLWRpZmYtcmV2aWV3LWFjY2VwdCcpLCAnJyk7XG5cdH1cblxuXHR0ZXN0KCdlbGlnaWJsZSBNb2RpZmllZCBXT1JLVFJFRSByb3cgc2hvd3MgQWNjZXB0IG9uIGJvdGggZGlmZiBob3N0cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC13b3JrdHJlZScsIHsgaW5kZXhTdGF0ZTogJ1dPUktUUkVFJywga2luZDogJ01vZGlmaWVkJyB9KSxcblx0XHR9KTtcblx0XHRhc3NlcnRBY2NlcHRTaG93bihoYXJuZXNzKTtcblx0fSk7XG5cblx0dGVzdCgnU3RhZ2VkQW5kVW5zdGFnZWQgc3RpbGwgc2hvd3MgQWNjZXB0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LWJvdGgnLCB7IGluZGV4U3RhdGU6ICdTdGFnZWRBbmRVbnN0YWdlZCcsIGtpbmQ6ICdNb2RpZmllZCcgfSksXG5cdFx0fSk7XG5cdFx0YXNzZXJ0QWNjZXB0U2hvd24oaGFybmVzcyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZsaWN0IGxhYmVsZWQgd29ya2luZ1RyZWUgaGlkZXMgQWNjZXB0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcHJvamVjdC9zcmMvYWNjZXB0LWNvbmZsaWN0LnRzJyk7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjoge1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsOiB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hY2NlcHQtY29uZmxpY3QudHMuZ2l0JyksXG5cdFx0XHRcdGdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0XHRcdG9yaWdpbjogJ2VuZ2luZScsXG5cdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3Npb24tMScsXG5cdFx0XHRcdGdpdFBhdGg6ICdzcmMvYS50cycsXG5cdFx0XHRcdGluZGV4U3RhdGU6ICdVbnN0YWdlZCcsXG5cdFx0XHRcdGtpbmQ6ICdDb25mbGljdCcsXG5cdFx0XHR9LFxuXHRcdFx0bWF0Y2hTY206IHRydWUsXG5cdFx0XHRzY21Hcm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3cml0ZUdyb3VwSWQoaGFybmVzcy52aWV3KSwgJ3dvcmtpbmdUcmVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdyaXRlR3JvdXBJZChoYXJuZXNzLnBhbmUpLCAnd29ya2luZ1RyZWUnKTtcblx0XHRhc3NlcnRBY2NlcHRIaWRkZW4oaGFybmVzcyk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MudmlldywgNSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MucGFuZSwgNSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MucmVhZENhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgndW50cmFja2VkIHJvdyBoaWRlcyBBY2NlcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtdW50cmFja2VkJywgeyBraW5kOiAnVW50cmFja2VkJywgaW5kZXhTdGF0ZTogJ1Vuc3RhZ2VkJyB9KSxcblx0XHR9KTtcblx0XHRhc3NlcnRBY2NlcHRIaWRkZW4oaGFybmVzcyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Z1bGx5IHN0YWdlZCByb3cgbGFiZWxlZCB3b3JraW5nVHJlZSBoaWRlcyBBY2NlcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hY2NlcHQtc3RhZ2VkLnRzJyk7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjoge1xuXHRcdFx0XHRtb2RpZmllZDogcmVzb3VyY2UsXG5cdFx0XHRcdG9yaWdpbmFsOiB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wcm9qZWN0L3NyYy9hY2NlcHQtc3RhZ2VkLnRzLmdpdCcpLFxuXHRcdFx0XHRncm91cElkOiAnd29ya2luZ1RyZWUnLFxuXHRcdFx0XHRvcmlnaW46ICdlbmdpbmUnLFxuXHRcdFx0XHRzZXNzaW9uSWQ6ICdzZXNzaW9uLTEnLFxuXHRcdFx0XHRnaXRQYXRoOiAnc3JjL2EudHMnLFxuXHRcdFx0XHRpbmRleFN0YXRlOiAnU3RhZ2VkJyxcblx0XHRcdFx0a2luZDogJ01vZGlmaWVkJyxcblx0XHRcdH0sXG5cdFx0XHRtYXRjaFNjbTogdHJ1ZSxcblx0XHRcdHNjbUdyb3VwSWQ6ICd3b3JraW5nVHJlZScsXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdyaXRlR3JvdXBJZChoYXJuZXNzLnZpZXcpLCAnd29ya2luZ1RyZWUnKTtcblx0XHRhc3NlcnRBY2NlcHRIaWRkZW4oaGFybmVzcyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dyb3VwSWQgaW5kZXggd2l0aCBNb2RpZmllZCBVbnN0YWdlZCBzdGlsbCBzaG93cyBBY2NlcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtaW5kZXgnLCB7IGdyb3VwSWQ6ICdpbmRleCcsIGtpbmQ6ICdNb2RpZmllZCcsIGluZGV4U3RhdGU6ICdVbnN0YWdlZCcgfSksXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdyaXRlR3JvdXBJZChoYXJuZXNzLnZpZXcpLCAnaW5kZXgnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod3JpdGVHcm91cElkKGhhcm5lc3MucGFuZSksICdpbmRleCcpO1xuXHRcdGFzc2VydEFjY2VwdFNob3duKGhhcm5lc3MpO1xuXHR9KTtcblxuXHR0ZXN0KCdkaXNjb25uZWN0ZWQgZW5naW5lIGhpZGVzIEFjY2VwdCBvbiBhbiBlbGlnaWJsZSByb3cnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtb2ZmbGluZScpLFxuXHRcdFx0Y29ubmVjdGVkOiBmYWxzZSxcblx0XHR9KTtcblx0XHRhc3NlcnRBY2NlcHRIaWRkZW4oaGFybmVzcyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5IGVuZ2luZSBwYXRoIGhpZGVzIEFjY2VwdCBhbmQgZG9lcyBub3QgcmVhZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC1lbXB0eS1wYXRoJywgeyBnaXRQYXRoOiAnJyB9KSxcblx0XHR9KTtcblx0XHRhc3NlcnRBY2NlcHRIaWRkZW4oaGFybmVzcyk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MudmlldywgNSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MucGFuZSwgNSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MucmVhZENhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgcGlubmVkIHNlc3Npb24gaGlkZXMgQWNjZXB0IGFuZCBkb2VzIG5vdCByZWFkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LWVtcHR5LXNlc3Npb24nLCB7IHNlc3Npb25JZDogJycgfSksXG5cdFx0fSk7XG5cdFx0YXNzZXJ0QWNjZXB0SGlkZGVuKGhhcm5lc3MpO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnZpZXcsIDUpO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnBhbmUsIDUpO1xuXHRcdGF3YWl0IHJ1bkJvdGhBY2NlcHQoaGFybmVzcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLnJlYWRDYWxscywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5hcHBseUNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0FjY2VwdCBjbGljayByZWFkcyBVbnN0YWdlZCBkaWZmIGFuZCBhcHBsaWVzIG9ubHkgdGhlIGN1cnNvciBodW5rJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LWNsaWNrJywgeyBpbmRleFN0YXRlOiAnV09SS1RSRUUnLCBraW5kOiAnTW9kaWZpZWQnIH0pLFxuXHRcdFx0Y291bnRSZWZyZXNoOiB0cnVlLFxuXHRcdH0pO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnZpZXcsIDUpO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnBhbmUsIDUpO1xuXHRcdGF3YWl0IHJ1bkJvdGhBY2NlcHQoaGFybmVzcyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5yZWFkQ2FsbHMubGVuZ3RoLCAyKTtcblx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2YgaGFybmVzcy5yZWFkQ2FsbHMpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXF1ZXN0LnNlc3Npb25JZCwgJ3Nlc3Npb24tMScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcXVlc3QucGF0aCwgJ3NyYy9hLnRzJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVxdWVzdC5pbmRleFN0YXRlLCAnVW5zdGFnZWQnKTtcblx0XHR9XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBzb3VyY2VzR2l0SHVua1BhdGNoQXRDdXJzb3IoYWNjZXB0Q3Vyc29yVW5pZmllZERpZmYsIDUsICduZXcnKTtcblx0XHRhc3NlcnQub2soZXhwZWN0ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMubGVuZ3RoLCAyKTtcblx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2YgaGFybmVzcy5hcHBseUNhbGxzKSB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFsuLi5yZXF1ZXN0LmFyZ3ZdLCBbJ2dpdCcsICdhcHBseScsICctLWNhY2hlZCcsICctLXdoaXRlc3BhY2U9bm93YXJuJ10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbLi4ucmVxdWVzdC5hcmd2XSwgWy4uLlNPVVJDRVNfR0lUX0FQUExZX0NBQ0hFRF9BUkdWXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVxdWVzdC5wYXRjaGVzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVxdWVzdC5wYXRjaGVzWzBdLCBleHBlY3RlZCk7XG5cdFx0XHRhc3NlcnQub2socmVxdWVzdC5wYXRjaGVzWzBdPy5pbmNsdWRlcygncmVuYW1lIGZyb20gc3JjL2EudHMnKSk7XG5cdFx0XHRhc3NlcnQub2socmVxdWVzdC5wYXRjaGVzWzBdPy5pbmNsdWRlcygnb2xkIG1vZGUgMTAwNjQ0JykpO1xuXHRcdFx0YXNzZXJ0Lm9rKHJlcXVlc3QucGF0Y2hlc1swXT8uaW5jbHVkZXMoJ25ldyBtb2RlIDEwMDc1NScpKTtcblx0XHRcdGFzc2VydC5vayhyZXF1ZXN0LnBhdGNoZXNbMF0/LmluY2x1ZGVzKCdAQCAtMTAsMiArMTEsMyBAQCcpKTtcblx0XHRcdGFzc2VydC5vayhyZXF1ZXN0LnBhdGNoZXNbMF0/LmluY2x1ZGVzKCdcXFxcIE5vIG5ld2xpbmUgYXQgZW5kIG9mIGZpbGUnKSk7XG5cdFx0XHRhc3NlcnQub2soIXJlcXVlc3QucGF0Y2hlc1swXT8uaW5jbHVkZXMoJ0BAIC0xLDMgKzEsNCBAQCcpKTtcblx0XHR9XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmdpdENvbW1hbmRzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucmVmcmVzaENvdW50Lm4sIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXJzb3Igb3V0c2lkZSBldmVyeSBodW5rIHJlYWRzIG9uY2UgcGVyIGhvc3QgYW5kIGRvZXMgbm90IGFwcGx5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBtb3VudEFjY2VwdEh1bmtIb3N0cyh0aGlzLCB7XG5cdFx0XHRyZWY6IGVuZ2luZUFjY2VwdFJlZignYWNjZXB0LW1pc3MnKSxcblx0XHRcdGNvdW50UmVmcmVzaDogdHJ1ZSxcblx0XHR9KTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy52aWV3LCA5OSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MucGFuZSwgOTkpO1xuXHRcdGF3YWl0IHJ1bkJvdGhBY2NlcHQoaGFybmVzcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucmVhZENhbGxzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5yZWZyZXNoQ291bnQubiwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Mudmlldy5lbGVtZW50LnF1ZXJ5U2VsZWN0b3IoJy5zb3VyY2VzLWRpZmYtcGFuZWwtYWN0aW9uLW5vdGljZScpPy50ZXh0Q29udGVudCwgc291cmNlc0RpZmZBY2NlcHRVbmF2YWlsYWJsZU1lc3NhZ2UoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucGFyZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tZGlmZi1yZXZpZXctbm90aWNlJyk/LnRleHRDb250ZW50LCBzb3VyY2VzRGlmZkFjY2VwdFVuYXZhaWxhYmxlTWVzc2FnZSgpKTtcblx0fSk7XG5cblx0dGVzdCgnYmluYXJ5IGRpZmYgZG9lcyBub3QgYXBwbHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtYmluYXJ5JyksXG5cdFx0XHR1bmlmaWVkRGlmZjogJ2RpZmYgLS1naXQgYS9hLmJpbiBiL2EuYmluXFxuQmluYXJ5IGZpbGVzIGEvYS5iaW4gYW5kIGIvYS5iaW4gZGlmZmVyXFxuJyxcblx0XHR9KTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy52aWV3LCAxKTtcblx0XHRwaW5BY2NlcHRDdXJzb3IoaGFybmVzcy5wYW5lLCAxKTtcblx0XHRhd2FpdCBydW5Cb3RoQWNjZXB0KGhhcm5lc3MpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnJlYWRDYWxscy5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5hcHBseUNhbGxzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21pc3NpbmcgY3Vyc29yIGRvZXMgbm90IHJlYWQgb3IgYXBwbHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IG1vdW50QWNjZXB0SHVua0hvc3RzKHRoaXMsIHtcblx0XHRcdHJlZjogZW5naW5lQWNjZXB0UmVmKCdhY2NlcHQtbm8tY3Vyc29yJyksXG5cdFx0XHRjb3VudFJlZnJlc2g6IHRydWUsXG5cdFx0fSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MucmVhZENhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5yZWZyZXNoQ291bnQubiwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIGNsb3NlZCBBY2NlcHQgc2VuZHMgbm8gUmVhZEdpdEZpbGVEaWZmIGFuZCBubyBBcHBseScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC1jbG9zZWQnKSxcblx0XHRcdHdyaXRlQ2xvc2VkOiB0cnVlLFxuXHRcdFx0Y291bnRSZWZyZXNoOiB0cnVlLFxuXHRcdH0pO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnZpZXcsIDUpO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnBhbmUsIDUpO1xuXHRcdGF3YWl0IHJ1bkJvdGhBY2NlcHQoaGFybmVzcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLnJlYWRDYWxscywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5hcHBseUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucmVmcmVzaENvdW50Lm4sIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaGFybmVzcy5naXRDb21tYW5kcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdlbmdpbmUgc2Vzc2lvbiBub3QgcmVhZHkgc2VuZHMgbm8gUmVhZEdpdEZpbGVEaWZmIGFuZCBubyBBcHBseScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC1ub3QtcmVhZHknKSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogZmFsc2UsXG5cdFx0fSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MudmlldywgNSk7XG5cdFx0cGluQWNjZXB0Q3Vyc29yKGhhcm5lc3MucGFuZSwgNSk7XG5cdFx0YXdhaXQgcnVuQm90aEFjY2VwdChoYXJuZXNzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MucmVhZENhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmFwcGx5Q2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhhcm5lc3MuZ2l0Q29tbWFuZHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnZW5naW5lIHN1Y2Nlc3MgZmFsc2Ugc2hvd3MgZXJyb3JfbWVzc2FnZSBhbmQgZG9lcyBub3QgcmVmcmVzaCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgbW91bnRBY2NlcHRIdW5rSG9zdHModGhpcywge1xuXHRcdFx0cmVmOiBlbmdpbmVBY2NlcHRSZWYoJ2FjY2VwdC1kZW5pZWQnLCB7IGluZGV4U3RhdGU6ICdXT1JLVFJFRScgfSksXG5cdFx0XHRjb3VudFJlZnJlc2g6IHRydWUsXG5cdFx0XHRhcHBseVN1Y2Nlc3M6IGZhbHNlLFxuXHRcdFx0YXBwbHlFcnJvck1lc3NhZ2U6ICdhcHBseSBkZW5pZWQnLFxuXHRcdH0pO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnZpZXcsIDUpO1xuXHRcdHBpbkFjY2VwdEN1cnNvcihoYXJuZXNzLnBhbmUsIDUpO1xuXHRcdGF3YWl0IHJ1bkJvdGhBY2NlcHQoaGFybmVzcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MuYXBwbHlDYWxscy5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnZpZXcuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuc291cmNlcy1kaWZmLXBhbmVsLWFjdGlvbi1ub3RpY2UnKT8udGV4dENvbnRlbnQsICdhcHBseSBkZW5pZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5wYXJlbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1kaWZmLXJldmlldy1ub3RpY2UnKT8udGV4dENvbnRlbnQsICdhcHBseSBkZW5pZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5yZWZyZXNoQ291bnQubiwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoYXJuZXNzLmdpdENvbW1hbmRzLCBbXSk7XG5cdH0pO1xufSk7XG5cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGlCQUFpQixlQUFlO0FBQ3pDLFNBQVMsY0FBYyxpQ0FBaUM7QUFDeEQsU0FBUyxXQUFXO0FBQ3BCLFNBQVMseUNBQXlDLGtCQUFrQjtBQUNwRSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWEsUUFBUSxvQkFBb0I7QUFDbEQsU0FBUyxrQkFBa0IsdUJBQXVCO0FBQ2xELFNBQTBELDBCQUEwQjtBQUVwRixTQUFTLHFCQUFxQiw4QkFBOEI7QUFFNUQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxnQ0FBZ0M7QUFFekMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyx5QkFBeUIsa0NBQWtDO0FBQ3BFLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsY0FBYyx5QkFBeUIsY0FBYyxnQkFBOEQsd0JBQTRELDZCQUE2QjtBQUNyTixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLCtCQUErQixxQkFBcUIsaUJBQWlCLHdCQUF3QjtBQUN0RyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUF1QixtQkFBbUI7QUFDMUMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxxQkFBcUI7QUFHOUIsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBc0MsOEJBQThCO0FBQ3BFLFNBQVMsNENBQTRDO0FBQ3JELFNBQVMsZ0RBQWdELHNDQUFzQyxpREFBaUQ7QUFDaEosU0FBUyw4QkFBOEIseUNBQXlDO0FBQ2hGLFNBQVMseUNBQXlDO0FBQ2xELFNBQVMsaUNBQWlDLGtDQUFrQztBQUM1RSxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUE0QixtQ0FBbUM7QUFDL0QsU0FBUywrQkFBK0IsbUNBQW1DO0FBQzNFLFNBQThCLDRCQUE0QjtBQUMxRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDJDQUEyQztBQUNwRCxTQUFTLDZCQUE2Qiw2QkFBNkIsNEJBQTRCLDZCQUE2QixnQ0FBZ0MsaUNBQWlDLHVDQUF1QztBQUVwTyxTQUFTLFNBQVMsTUFBd0MsUUFBa0Q7QUFDM0csTUFBSSxDQUFDLE1BQU07QUFDVixXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU8sS0FBSyxTQUFTLEVBQUUsVUFBVSxDQUE4QyxRQUFnQixPQUFPLEdBQUcsRUFBTyxDQUFDO0FBQ2xIO0FBRUEsTUFBTSxzQkFBc0IsTUFBTTtBQUVqQyxRQUFNLFFBQVEsd0NBQXdDO0FBRXRELFFBQU0seUJBQXlCLFNBQVMsR0FBNEIsd0JBQXdCLHNCQUFzQjtBQUNsSCxRQUFNLGdCQUFnQixTQUFTLEdBQW1CLGVBQWUsYUFBYTtBQUU5RSxPQUFLLG9FQUFvRSxNQUFNO0FBQzlFLFVBQU0sWUFBWSx1QkFBdUIsSUFBSSwrQkFBK0I7QUFDNUUsV0FBTyxHQUFHLFdBQVcsbURBQW1EO0FBQ3hFLFdBQU8sWUFBWSxXQUFXLGlDQUFpQztBQUMvRCxXQUFPLFlBQVksVUFBVSxhQUFhLElBQUk7QUFDOUMsV0FBTztBQUFBLE1BQ04sdUJBQXVCLHlCQUF5QixTQUFTO0FBQUEsTUFDekQsc0JBQXNCO0FBQUEsTUFDdEI7QUFBQSxJQUNEO0FBRUEsVUFBTSxpQkFBaUIsY0FBYyxRQUFRLDBCQUEwQjtBQUN2RSxXQUFPLEdBQUcsZ0JBQWdCLDhDQUE4QztBQUN4RSxXQUFPLFlBQVksY0FBYyxpQkFBaUIsMEJBQTBCLEdBQUcsU0FBUztBQUN4RixXQUFPLFlBQVksZUFBZSxNQUFNLHdCQUF3QixZQUFZO0FBQUEsRUFDN0UsQ0FBQztBQUVELE9BQUssbUVBQW1FLGlCQUFrQjtBQUN6RixVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sbUJBQW1CO0FBQzFELFVBQU0sTUFBTTtBQUFBLE1BQ1gsVUFBVTtBQUFBLE1BQ1YsVUFBVSxXQUFXLEtBQUssTUFBTSx1QkFBdUI7QUFBQSxNQUN2RCxTQUFTO0FBQUEsSUFDVjtBQUVBLFVBQU0sZ0JBQW1FLENBQUM7QUFBQSxJQUMxRSxNQUFNLDZCQUE2QixpQkFBaUI7QUFBQSxNQUMxQyxTQUFZLElBQVksT0FBb0M7QUFDcEUsc0JBQWMsS0FBSyxFQUFFLElBQUksTUFBTSxDQUFDO0FBQ2hDLGVBQU8sUUFBUSxRQUFRLElBQUk7QUFBQSxNQUM1QjtBQUFBLE1BQ0EsVUFBZ0I7QUFBQSxNQUFFO0FBQUEsSUFDbkI7QUFFQSxVQUFNLHVCQUF1Qiw4QkFBOEIsUUFBVyxLQUFLO0FBQzNFLFVBQU0sZUFBZSxNQUFNLElBQUksSUFBSSxxQkFBcUIsQ0FBQztBQUN6RCx5QkFBcUIsS0FBSyxlQUFlLFlBQVk7QUFFckQsVUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRixVQUFNLG9CQUFvQixxQkFBcUIsSUFBSSxrQkFBa0I7QUFDckUsVUFBTSxZQUFZLE9BQU87QUFBQSxNQUN4QixDQUFDLHdCQUF3QixhQUFhLEdBQUcsR0FBRyxrQkFBa0IsbUJBQTRCLHdCQUF3QixhQUFhLEdBQUcsS0FBSztBQUFBLE1BQ3ZJLE1BQU07QUFBQSxJQUNQO0FBRUEsV0FBTztBQUFBLE1BQ04sU0FBUyx3QkFBd0IsY0FBYyxVQUFVLENBQUM7QUFBQSxNQUMxRDtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUEsV0FBTyxZQUFZLE1BQU0sYUFBYSxLQUFLLEdBQUcsR0FBRyxLQUFLO0FBQ3RELFdBQU8sWUFBWSxhQUFhLGNBQWMsR0FBRyxHQUFHO0FBQ3BELFdBQU87QUFBQSxNQUNOLFNBQVMsd0JBQXdCLGNBQWMsVUFBVSxDQUFDO0FBQUEsTUFDMUQ7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFdBQU8sZ0JBQWdCLGVBQWUsQ0FBQyxFQUFFLElBQUksNEJBQTRCLE9BQU8sS0FBSyxDQUFDLENBQUM7QUFFdkYsaUJBQWEsTUFBTTtBQUNuQixXQUFPLFlBQVksYUFBYSxjQUFjLEdBQUcsTUFBUztBQUMxRCxXQUFPO0FBQUEsTUFDTixTQUFTLHdCQUF3QixjQUFjLFVBQVUsQ0FBQztBQUFBLE1BQzFEO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHdDQUF3QyxpQkFBa0I7QUFDOUQsVUFBTSxZQUFZLFdBQVcsS0FBSyxNQUFNLG1CQUFtQjtBQUMzRCxVQUFNLFlBQVksV0FBVyxLQUFLLE1BQU0sbUJBQW1CO0FBQzNELFVBQU0sT0FBTyxFQUFFLFVBQVUsV0FBVyxVQUFVLFFBQVcsU0FBUyxjQUFjO0FBQ2hGLFVBQU0sT0FBTyxFQUFFLFVBQVUsV0FBVyxVQUFVLFFBQVcsU0FBUyxjQUFjO0FBRWhGLFVBQU0sVUFBa0MsQ0FBQztBQUN6QyxVQUFNLHVCQUF1Qiw4QkFBOEIsUUFBVyxLQUFLO0FBQzNFLHlCQUFxQixLQUFLLGVBQWU7QUFBQSxNQUN4QyxVQUFVLFlBQVk7QUFBQSxNQUN0QiwyQkFBMkIsTUFBTTtBQUFBLE1BQ2pDLG9DQUFvQyxNQUFNO0FBQUEsSUFDM0MsQ0FBNkI7QUFFN0IsVUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRixVQUFNLElBQUksYUFBYSxlQUFlLFNBQU8sUUFBUSxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUM7QUFFekUsVUFBTSxhQUFhLEtBQUssSUFBSTtBQUM1QixVQUFNLGFBQWEsS0FBSyxJQUFJO0FBRTVCLFdBQU8sWUFBWSxhQUFhLGNBQWMsR0FBRyxTQUFTLFNBQVMsR0FBRyxVQUFVLFNBQVMsQ0FBQztBQUMxRixXQUFPLGdCQUFnQixRQUFRLElBQUksU0FBTyxLQUFLLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxTQUFTLEdBQUcsVUFBVSxTQUFTLENBQUMsQ0FBQztBQUFBLEVBQ3pHLENBQUM7QUFFRCxPQUFLLG9FQUFvRSxNQUFNO0FBQzlFLFVBQU0saUJBQWlCLGFBQWEsYUFBYSxPQUFPLFNBQVMsRUFBRSxPQUFPLFdBQVc7QUFDckYsVUFBTSxxQkFBcUIsZUFBZSxLQUFLLFVBQVEsS0FBSyxRQUFRLE9BQU8sOENBQThDO0FBQ3pILFVBQU0sZ0JBQWdCLGVBQWUsS0FBSyxVQUFRLEtBQUssUUFBUSxPQUFPLHlDQUF5QztBQUUvRyxXQUFPLEdBQUcsb0JBQW9CLG1EQUFtRDtBQUNqRixXQUFPLEdBQUcsZUFBZSw4Q0FBOEM7QUFDdkUsV0FBTyxHQUFHLG1CQUFtQixNQUFNLDBDQUEwQztBQUM3RSxXQUFPLEdBQUcsY0FBYyxNQUFNLHFDQUFxQztBQUNuRSxXQUFPO0FBQUEsTUFDTixTQUFTLG1CQUFtQixNQUFNLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQyx3QkFBd0IsYUFBYSxHQUFHLEdBQUcsS0FBSyxDQUFDO0FBQUEsTUFDeEg7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLE1BQ04sU0FBUyxjQUFjLE1BQU0sRUFBRSxNQUFNLDRCQUE0QixDQUFDLHdCQUF3QixhQUFhLEdBQUcsR0FBRyxNQUFNLENBQUM7QUFBQSxNQUNwSDtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHdFQUF3RSxNQUFNO0FBQ2xGLFVBQU0sbUJBQW1CLGFBQWEsYUFBYSxPQUFPLFdBQVcsRUFBRSxPQUFPLFdBQVc7QUFDekYsVUFBTSxnQkFBZ0IsaUJBQWlCLEtBQUssVUFBUSxLQUFLLFFBQVEsT0FBTyxvQ0FBb0M7QUFFNUcsV0FBTyxHQUFHLGVBQWUsNERBQTREO0FBQ3JGLFdBQU8sR0FBRyxjQUFjLE1BQU0saURBQWlEO0FBQy9FLFdBQU87QUFBQSxNQUNOLFNBQVMsY0FBYyxNQUFNLEVBQUUsY0FBYywrQkFBK0IsQ0FBQztBQUFBLE1BQzdFO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxNQUNOLFNBQVMsY0FBYyxNQUFNLEVBQUUsY0FBYyx3Q0FBd0MsQ0FBQztBQUFBLE1BQ3RGO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELFdBQVMsa0NBQTBEO0FBQ2xFLFdBQU87QUFBQSxNQUNOLHFCQUFxQixNQUFNLHNCQUFzQjtBQUFBLE1BQ2pELHFCQUFxQixNQUFNO0FBQUEsTUFDM0IsdUJBQXVCLE1BQU07QUFBQSxNQUM3QiwwQkFBMEIsT0FBTztBQUFBLFFBQ2hDLElBQUk7QUFBQSxRQUNKLE9BQU8sRUFBRSxPQUFPLFFBQVEsVUFBVSxPQUFPO0FBQUEsUUFDekMsZ0JBQWdCLENBQUM7QUFBQSxNQUNsQjtBQUFBLE1BQ0EsdUJBQXVCLE9BQU87QUFBQSxRQUM3QiwwQkFBMEIsTUFBTTtBQUFBLE1BQ2pDO0FBQUEsTUFDQSx5QkFBeUIsTUFBTTtBQUFBLElBQ2hDO0FBQUEsRUFDRDtBQUVBLFdBQVMscUJBQXFCLFVBQWUsYUFBa0M7QUFDOUUsVUFBTSxRQUFRO0FBQUEsTUFDYixJQUFJO0FBQUEsTUFDSixPQUFPLGdCQUFnQixVQUFVLG1CQUFtQjtBQUFBLE1BQ3BELFdBQVcsQ0FBQztBQUFBLElBQ2I7QUFDQSxVQUFNLGNBQWM7QUFBQSxNQUNuQixXQUFXO0FBQUEsTUFDWCxlQUFlO0FBQUEsTUFDZixhQUFhLENBQUM7QUFBQSxNQUNkLE1BQU0sWUFBWTtBQUFBLE1BQUU7QUFBQSxJQUNyQjtBQUNBLFVBQU0sVUFBVSxLQUFLLFdBQVc7QUFDaEMsVUFBTSxhQUFhO0FBQUEsTUFDbEIsVUFBVTtBQUFBLFFBQ1QsUUFBUSxDQUFDLEtBQUs7QUFBQSxRQUNkLFNBQVM7QUFBQSxRQUNULHNCQUFzQixNQUFNO0FBQUEsUUFDNUIsMkJBQTJCLE1BQU07QUFBQSxNQUNsQztBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsTUFDTixlQUFlO0FBQUEsTUFDZixJQUFJLGVBQWU7QUFBRSxlQUFPLENBQUMsVUFBVTtBQUFBLE1BQUc7QUFBQSxNQUMxQyxJQUFJLGtCQUFrQjtBQUFFLGVBQU87QUFBQSxNQUFHO0FBQUEsTUFDbEMsb0JBQW9CLE1BQU07QUFBQSxNQUMxQix1QkFBdUIsTUFBTTtBQUFBLE1BQzdCLHFCQUFxQixNQUFNO0FBQUUsY0FBTSxJQUFJLE1BQU0saUJBQWlCO0FBQUEsTUFBRztBQUFBLE1BQ2pFLGVBQWUsTUFBTTtBQUFBLElBQ3RCO0FBQUEsRUFDRDtBQUVBLFdBQVMseUJBQXlCLFVBQWUsVUFBVSxlQUE0QjtBQUN0RixVQUFNLFFBQVE7QUFBQSxNQUNiLElBQUk7QUFBQSxNQUNKLE9BQU8sWUFBWSxVQUFVLG1CQUFtQjtBQUFBLE1BQ2hELFdBQVcsQ0FBQztBQUFBLElBQ2I7QUFDQSxVQUFNLGNBQWM7QUFBQSxNQUNuQixXQUFXO0FBQUEsTUFDWCxlQUFlO0FBQUEsTUFDZixhQUFhLENBQUM7QUFBQSxNQUNkLE1BQU0sWUFBWTtBQUFBLE1BQUU7QUFBQSxJQUNyQjtBQUNBLFVBQU0sVUFBVSxLQUFLLFdBQVc7QUFDaEMsVUFBTSxhQUFhO0FBQUEsTUFDbEIsVUFBVTtBQUFBLFFBQ1QsUUFBUSxDQUFDLEtBQUs7QUFBQSxRQUNkLFNBQVM7QUFBQSxRQUNULHNCQUFzQixNQUFNO0FBQUEsUUFDNUIsMkJBQTJCLE1BQU07QUFBQSxNQUNsQztBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsTUFDTixlQUFlO0FBQUEsTUFDZixJQUFJLGVBQWU7QUFBRSxlQUFPLENBQUMsVUFBVTtBQUFBLE1BQUc7QUFBQSxNQUMxQyxJQUFJLGtCQUFrQjtBQUFFLGVBQU87QUFBQSxNQUFHO0FBQUEsTUFDbEMsb0JBQW9CLE1BQU07QUFBQSxNQUMxQix1QkFBdUIsTUFBTTtBQUFBLE1BQzdCLHFCQUFxQixNQUFNO0FBQUUsY0FBTSxJQUFJLE1BQU0saUJBQWlCO0FBQUEsTUFBRztBQUFBLE1BQ2pFLGVBQWUsTUFBTTtBQUFBLElBQ3RCO0FBQUEsRUFDRDtBQUVBLFdBQVMsc0JBQW1DO0FBQzNDLFdBQU87QUFBQSxNQUNOLGVBQWU7QUFBQSxNQUNmLElBQUksZUFBZTtBQUFFLGVBQU8sQ0FBQztBQUFBLE1BQUc7QUFBQSxNQUNoQyxJQUFJLGtCQUFrQjtBQUFFLGVBQU87QUFBQSxNQUFHO0FBQUEsTUFDbEMsb0JBQW9CLE1BQU07QUFBQSxNQUMxQix1QkFBdUIsTUFBTTtBQUFBLE1BQzdCLHFCQUFxQixNQUFNO0FBQUUsY0FBTSxJQUFJLE1BQU0saUJBQWlCO0FBQUEsTUFBRztBQUFBLE1BQ2pFLGVBQWUsTUFBTTtBQUFBLElBQ3RCO0FBQUEsRUFDRDtBQUVBLFdBQVMsMkJBQ1Isc0JBQ0EsWUFDQSxvQkFDTztBQUNQLHlCQUFxQixLQUFLLHNCQUFzQjtBQUFBLE1BQy9DLGVBQWU7QUFBQSxNQUNmLG9CQUFvQixNQUFNO0FBQUEsTUFDMUIsc0JBQXNCLE1BQU07QUFBQSxNQUM1QixlQUFlLE1BQU07QUFDcEIsY0FBTSxRQUFRLE9BQU8sV0FBVyx1QkFBdUIsYUFBYSxXQUFXLG1CQUFtQixJQUFJO0FBQ3RHLGNBQU0sV0FBVyxPQUFPLFdBQVcsMEJBQTBCLGFBQWEsV0FBVyxzQkFBc0IsSUFBSTtBQUMvRyxlQUFPLE9BQU8sU0FBUyxlQUFlLENBQUMsQ0FBQyxVQUFVO0FBQUEsTUFDbkQ7QUFBQSxNQUNBLDBCQUEwQixNQUFNO0FBQUEsTUFDaEMsb0JBQW9CLE1BQU07QUFBQSxNQUMxQixvQkFBb0IsTUFBTTtBQUFFLGNBQU0sSUFBSSxNQUFNLFVBQVU7QUFBQSxNQUFHO0FBQUEsSUFDMUQsQ0FBZ0M7QUFDaEMseUJBQXFCLEtBQUssc0JBQXNCLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxtQkFBbUIsQ0FBQyxDQUFDO0FBQUEsRUFDcEg7QUFFQSxXQUFTLHdCQUF3QixVQU83QixDQUFDLEdBQUc7QUFDUCxVQUFNLHVCQUF1Qiw4QkFBOEIsUUFBVyxLQUFLO0FBQzNFLHlCQUFxQixLQUFLLDZCQUE2QixJQUFJLCtCQUErQixDQUFDO0FBQzNGLHlCQUFxQixLQUFLLHlCQUF5QixJQUFJLDJCQUEyQixDQUFDO0FBQ25GLHlCQUFxQixLQUFLLHdCQUF3QixnQ0FBZ0MsQ0FBQztBQUNuRixVQUFNLGFBQWEsUUFBUSxjQUFjO0FBQUEsTUFDeEMsbUJBQW1CLE1BQU07QUFBQSxNQUN6Qix1QkFBdUIsTUFBTTtBQUFBLElBQzlCO0FBQ0EseUJBQXFCLEtBQUssMEJBQTBCLFVBQVU7QUFDOUQseUJBQXFCLEtBQUssNEJBQTRCO0FBQUEsTUFDckQsb0JBQW9CLE1BQU07QUFBQSxNQUMxQiwwQkFBMEIsTUFBTTtBQUFBLE1BQ2hDLG9CQUFvQixNQUFNO0FBQUEsTUFDMUIsc0JBQXNCLE1BQU0sUUFBUSxzQkFBc0I7QUFBQSxJQUMzRCxDQUEwQztBQUMxQyx5QkFBcUIsS0FBSyxhQUFhLFFBQVEsV0FDNUMseUJBQXlCLFFBQVEsVUFBVSxRQUFRLE9BQU8sSUFDMUQsb0JBQW9CLENBQUM7QUFDeEIsK0JBQTJCLHNCQUFzQixZQUFZLFFBQVEsc0JBQXNCLElBQUk7QUFDL0YseUJBQXFCLEtBQUssaUJBQWlCO0FBQUEsTUFDMUMsc0JBQXNCLE1BQU07QUFBQSxNQUM1QixxQkFBcUIsTUFBTTtBQUFBLE1BQzNCLGdCQUFnQixRQUFRLG1CQUFtQixZQUFZO0FBQUEsSUFDeEQsQ0FBK0I7QUFDL0IsUUFBSSxRQUFRLGFBQWE7QUFDeEIsMkJBQXFCLEtBQUssbUJBQW1CO0FBQUEsUUFDNUMsc0JBQXNCLFlBQVk7QUFDakMsZ0JBQU0sSUFBSSxNQUFNLE1BQU07QUFBQSxRQUN2QjtBQUFBLE1BQ0QsQ0FBaUM7QUFBQSxJQUNsQztBQUNBLFdBQU87QUFBQSxFQUNSO0FBRUEsT0FBSyxnRkFBZ0YsTUFBTTtBQUMxRixXQUFPLFlBQVksMkJBQTJCLE1BQU0sS0FBSyxHQUFHLEtBQUs7QUFDakUsVUFBTSxVQUFVLCtCQUErQjtBQUFBLE1BQzlDLFNBQVM7QUFBQSxNQUNULGdCQUFnQjtBQUFBLE1BQ2hCLGVBQWU7QUFBQSxNQUNmLGdCQUFnQjtBQUFBLE1BQ2hCLHNCQUFzQjtBQUFBLE1BQ3RCLG9CQUFvQjtBQUFBLE1BQ3BCLHNCQUFzQjtBQUFBLE1BQ3RCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxXQUFPLFlBQVksUUFBUSxXQUFXLElBQUk7QUFDMUMsV0FBTyxZQUFZLFFBQVEsWUFBWSxLQUFLO0FBQUEsRUFDN0MsQ0FBQztBQUVELE9BQUssK0RBQStELGlCQUFrQjtBQUNyRixVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sbUJBQW1CO0FBQzFELFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSx1QkFBdUI7QUFDOUQsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFFBQUk7QUFDSCxZQUFNLHVCQUF1Qix3QkFBd0IsRUFBRSxhQUFhLE1BQU0sU0FBUyxDQUFDO0FBQ3BGLDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLFFBQ2hGLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTztBQUNaLGFBQU8sWUFBWSxNQUFNLGFBQWEsS0FBSztBQUFBLFFBQzFDLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDLEdBQUcsS0FBSztBQUNULFlBQU0sUUFBUSxFQUFFO0FBRWhCLGFBQU8sWUFBWSxLQUFLLFFBQVEsY0FBYywyQkFBMkIsR0FBRyxlQUFlLElBQUksRUFBRTtBQUNqRyxhQUFPLFlBQWEsS0FBSyxRQUFRLGNBQWMsMkJBQTJCLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQ3pILGFBQU8sWUFBYSxLQUFLLFFBQVEsY0FBYyw0QkFBNEIsR0FBMEIsTUFBTSxTQUFTLE1BQU07QUFDMUgsYUFBTyxZQUFhLEtBQUssUUFBUSxjQUFjLDRCQUE0QixHQUEwQixNQUFNLFNBQVMsTUFBTTtBQUMxSCxhQUFPLFlBQWEsS0FBSyxRQUFRLGNBQWMsNkJBQTZCLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQzNILGFBQU87QUFBQSxRQUNOLEtBQUssUUFBUSxjQUFjLHFDQUFxQyxHQUFHLGVBQWU7QUFBQSxRQUNsRixTQUFTLCtCQUErQixpQ0FBaUM7QUFBQSxNQUMxRTtBQUNBLGFBQU8sR0FBRyxLQUFLLFFBQVEsY0FBYyxxQ0FBcUMsR0FBRyxVQUFVLFNBQVMsVUFBVSxDQUFDO0FBQzNHLGFBQU8sR0FBRyxFQUFFLEtBQUssUUFBUSxjQUFjLHFDQUFxQyxHQUFHLGVBQWUsSUFBSSxTQUFTLFVBQVUsQ0FBQztBQUN0SCxhQUFPLFlBQWEsS0FBSyxRQUFRLGNBQWMsNEJBQTRCLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQUEsSUFDM0gsVUFBRTtBQUNELG1CQUFhLFFBQVE7QUFBQSxJQUN0QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMkRBQTJELGlCQUFrQjtBQUNqRixVQUFNLFlBQVksV0FBVyxLQUFLLE1BQU0sK0JBQStCO0FBQ3ZFLFVBQU0sWUFBWSxXQUFXLEtBQUssTUFBTSwrQkFBK0I7QUFDdkUsVUFBTSxZQUFZLFdBQVcsS0FBSyxNQUFNLG1DQUFtQztBQUMzRSxVQUFNLFlBQVksV0FBVyxLQUFLLE1BQU0sbUNBQW1DO0FBQzNFLFVBQU0sZUFBZSxpQkFBaUIsZ0JBQWdCLGFBQWEsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUM1RSxRQUFJO0FBQ0osUUFBSTtBQUNKLFFBQUk7QUFDSCxVQUFJO0FBQ0osWUFBTSxZQUFZLElBQUksUUFBYyxhQUFXO0FBQzlDLHVCQUFlO0FBQUEsTUFDaEIsQ0FBQztBQUNELFlBQU0sdUJBQXVCLHdCQUF3QixFQUFFLFVBQVUsVUFBVSxDQUFDO0FBQzVFLHdCQUFrQixxQkFBcUIsSUFBSSxnQkFBZ0I7QUFDM0QsWUFBTSxhQUFhO0FBQUEsUUFDbEIsVUFBVSxNQUFNO0FBQUEsUUFBRTtBQUFBLFFBQ2xCLG1CQUFtQixPQUFPLEVBQUUsMkJBQTJCLE1BQU0sTUFBTSxzQkFBc0IsTUFBTSxNQUFNLGNBQWMsTUFBTSxPQUFPLGFBQWEsTUFBTSxPQUFVO0FBQUEsUUFDN0osbUJBQW1CLE9BQU8sRUFBRSwyQkFBMkIsTUFBTSxNQUFNLHNCQUFzQixNQUFNLE1BQU0sY0FBYyxNQUFNLE9BQU8sYUFBYSxNQUFNLE9BQVU7QUFBQSxRQUM3SixRQUFRLE1BQU07QUFBQSxRQUFFO0FBQUEsUUFDaEIsU0FBUyxNQUFNO0FBQUEsUUFBRTtBQUFBLE1BQ2xCO0FBQ0EsMkJBQXFCLGFBQWEsa0JBQWtCLFVBQXlDO0FBQzdGLDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxhQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUMxRSxJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWE7QUFHbkIsWUFBTSxhQUFhLFdBQVcsV0FBVyxLQUFLLElBQUk7QUFDbEQsVUFBSSxjQUFjO0FBQ2xCLGlCQUFXLGFBQWEsT0FBTyxVQUFVLFVBQVUsZUFBZTtBQUNqRTtBQUNBLFlBQUksZ0JBQWdCLEdBQUc7QUFDdEIsZ0JBQU07QUFBQSxRQUNQO0FBQ0EsZUFBTyxXQUFXLFVBQVUsVUFBVSxVQUFVO0FBQUEsTUFDakQ7QUFFQSxZQUFNLFNBQVMsYUFBYSxLQUFLO0FBQUEsUUFDaEMsVUFBVTtBQUFBLFFBQ1YsVUFBVTtBQUFBLFFBQ1YsU0FBUztBQUFBLE1BQ1YsQ0FBQztBQUNELFlBQU0sUUFBUSxDQUFDO0FBRWYsWUFBTSxTQUFTLGFBQWEsS0FBSztBQUFBLFFBQ2hDLFVBQVU7QUFBQSxRQUNWLFVBQVU7QUFBQSxRQUNWLFNBQVM7QUFBQSxNQUNWLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUVoQixhQUFPLFlBQVksS0FBSyxRQUFRLGNBQWMsMkJBQTJCLEdBQUcsYUFBYSxrQkFBa0I7QUFFM0csbUJBQWM7QUFDZCxZQUFNLFFBQVEsRUFBRTtBQUVoQixhQUFPLFlBQVksS0FBSyxRQUFRLGNBQWMsMkJBQTJCLEdBQUcsYUFBYSxrQkFBa0I7QUFDM0csYUFBTyxZQUFZLE1BQU0sUUFBUSxLQUFLO0FBQ3RDLGFBQU8sWUFBWSxNQUFNLFFBQVEsSUFBSTtBQUFBLElBQ3RDLFVBQUU7QUFDRCxpQkFBVyxTQUFTLGlCQUFpQixNQUFNLFVBQVUsQ0FBQyxHQUFHO0FBQ3hELGNBQU0sUUFBUTtBQUFBLE1BQ2Y7QUFDQSxZQUFNLFFBQVE7QUFDZCxZQUFNLFFBQVEsQ0FBQztBQUNmLG1CQUFhLFFBQVE7QUFBQSxJQUN0QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssdUZBQXVGLGlCQUFrQjtBQUM3RyxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sc0NBQXNDO0FBQzdFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSwwQ0FBMEM7QUFDakYsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFFBQUk7QUFDSCxVQUFJO0FBQ0osWUFBTSxXQUFXLElBQUksUUFBYyxhQUFXO0FBQzdDLHNCQUFjO0FBQUEsTUFDZixDQUFDO0FBQ0QsWUFBTSx3QkFBd0IsSUFBSSxRQUFjO0FBQ2hELFlBQU0sYUFBYTtBQUFBLFFBQ2xCLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsdUJBQXVCLE9BQU8sRUFBRSxnQkFBZ0IsTUFBTTtBQUFBLFFBQ3RELHVCQUF1QixzQkFBc0I7QUFBQSxNQUM5QztBQUVBLFlBQU0sdUJBQXVCLHdCQUF3QixFQUFFLFVBQVUsV0FBVyxDQUFDO0FBQzdFLDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLFFBQ2hGLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTztBQUNaLFlBQU0sYUFBYTtBQUduQixpQkFBVyxhQUFhLFlBQVk7QUFDbkMsY0FBTTtBQUNOLGVBQU87QUFBQSxNQUNSO0FBRUEsWUFBTSxRQUFRLGFBQWEsS0FBSztBQUFBLFFBQy9CLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxRQUFRLENBQUM7QUFFZiw0QkFBc0IsSUFBSTtBQUMxQiw0QkFBc0IsS0FBSztBQUMzQixhQUFPLFlBQWEsS0FBSyxRQUFRLGNBQWMsMkJBQTJCLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQ3pILGFBQU8sWUFBYSxLQUFLLFFBQVEsY0FBYyw0QkFBNEIsR0FBMEIsTUFBTSxTQUFTLE1BQU07QUFFMUgsa0JBQWE7QUFDYixZQUFNLFFBQVEsRUFBRTtBQUVoQixhQUFPLFlBQVksTUFBTSxPQUFPLElBQUk7QUFDcEMsYUFBTyxZQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQixHQUEwQixNQUFNLFNBQVMsRUFBRTtBQUNySCw0QkFBc0IsUUFBUTtBQUFBLElBQy9CLFVBQUU7QUFDRCxtQkFBYSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDRFQUE0RSxpQkFBa0I7QUFDbEcsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLG1CQUFtQjtBQUMxRCxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sdUJBQXVCO0FBQzlELFVBQU0sZUFBZSxpQkFBaUIsZ0JBQWdCLGFBQWEsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUM1RSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsd0JBQXdCLEVBQUUsYUFBYSxNQUFNLFNBQVMsQ0FBQztBQUNwRixZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLDRCQUE0QixJQUFJLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUNsSCxZQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsZUFBUyxLQUFLLFlBQVksTUFBTTtBQUNoQyxZQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sT0FBTyxPQUFPLEVBQUUsQ0FBQztBQUM1QyxXQUFLLE9BQU8sTUFBTTtBQUVsQixZQUFNLFFBQVEsTUFBTSxJQUFJLElBQUksNEJBQTRCLFVBQVUsVUFBVSxhQUFhLENBQUM7QUFDMUYsWUFBTSxLQUFLLFNBQVMsT0FBTyxRQUFXLHVCQUFPLE9BQU8sSUFBSSxHQUFHLGtCQUFrQixJQUFJO0FBQ2pGLFlBQU0sUUFBUSxFQUFFO0FBRWhCLGFBQU8sWUFBYSxPQUFPLGNBQWMsaUNBQWlDLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQ3pILGFBQU8sWUFBYSxPQUFPLGNBQWMsa0NBQWtDLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQzFILGFBQU8sWUFBYSxPQUFPLGNBQWMsa0NBQWtDLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQzFILGFBQU8sWUFBYSxPQUFPLGNBQWMsbUNBQW1DLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQzNILGFBQU87QUFBQSxRQUNOLE9BQU8sY0FBYyxrQ0FBa0MsR0FBRyxlQUFlO0FBQUEsUUFDekUsU0FBUyx5Q0FBeUMsaUNBQWlDO0FBQUEsTUFDcEY7QUFDQSxhQUFPLEdBQUcsT0FBTyxjQUFjLGtDQUFrQyxHQUFHLFVBQVUsU0FBUyxVQUFVLENBQUM7QUFDbEcsYUFBTyxHQUFHLEVBQUUsT0FBTyxjQUFjLGtDQUFrQyxHQUFHLGVBQWUsSUFBSSxTQUFTLFVBQVUsQ0FBQztBQUM3RyxhQUFPLFlBQWEsT0FBTyxjQUFjLG1DQUFtQyxHQUEwQixNQUFNLFNBQVMsTUFBTTtBQUMzSCxhQUFPLFlBQWEsT0FBTyxjQUFjLHdDQUF3QyxHQUEwQixNQUFNLFNBQVMsTUFBTTtBQUFBLElBQ2pJLFVBQUU7QUFDRCxtQkFBYSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHdFQUF3RSxpQkFBa0I7QUFDOUYsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLG1CQUFtQjtBQUMxRCxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sdUJBQXVCO0FBQzlELFFBQUksYUFBYTtBQUNqQixVQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxNQUNwRCxhQUFhO0FBQUEsTUFDYjtBQUFBLE1BQ0EsZ0JBQWdCLFlBQVk7QUFDM0IsWUFBSSxZQUFZO0FBQ2YsZ0JBQU0sSUFBSSxNQUFNLE1BQU07QUFBQSxRQUN2QjtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFDRCxVQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLDRCQUE0QixJQUFJLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUNsSCxVQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsYUFBUyxLQUFLLFlBQVksTUFBTTtBQUNoQyxVQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sT0FBTyxPQUFPLEVBQUUsQ0FBQztBQUM1QyxTQUFLLE9BQU8sTUFBTTtBQUVsQixVQUFNLFFBQVEsTUFBTSxJQUFJLElBQUksNEJBQTRCLFVBQVUsVUFBVSxhQUFhLENBQUM7QUFDMUYsVUFBTSxLQUFLLFNBQVMsT0FBTyxRQUFXLHVCQUFPLE9BQU8sSUFBSSxHQUFHLGtCQUFrQixJQUFJO0FBRWpGLFVBQU0sU0FBUztBQUNmLFVBQU0sT0FBTyxhQUFhLFdBQVc7QUFDckMsV0FBTyxZQUFhLE9BQU8sY0FBYyxrQ0FBa0MsR0FBMEIsTUFBTSxTQUFTLE1BQU07QUFFMUgsaUJBQWE7QUFDYixVQUFNLE9BQU8sYUFBYSxXQUFXO0FBQ3JDLFdBQU8sWUFBWSxPQUFPLGNBQWMsa0NBQWtDLEdBQUcsZUFBZSxJQUFJLE1BQU07QUFDdEcsV0FBTyxlQUFnQixPQUFPLGNBQWMsa0NBQWtDLEdBQTBCLE1BQU0sU0FBUyxNQUFNO0FBQUEsRUFDOUgsQ0FBQztBQUVELFdBQVMsV0FBVyxRQUFrQztBQUNyRCxRQUFJLENBQUMsUUFBUTtBQUNaO0FBQUEsSUFDRDtBQUNBLFdBQU8sTUFBTSxVQUFVO0FBQ3ZCLFdBQU8sZ0JBQWdCLFVBQVU7QUFDakMsV0FBTyxhQUFhLGlCQUFpQixPQUFPO0FBQzVDLFFBQUksY0FBYyxRQUFRO0FBQ3pCLE1BQUMsT0FBNkIsV0FBVztBQUFBLElBQzFDO0FBQ0EsV0FBTyxNQUFNO0FBQUEsRUFDZDtBQUVBLGlCQUFlLGlDQUFpQyxXQUFrQixLQUFnRDtBQUVqSCxVQUFNLGtCQUE2QixDQUFDO0FBQ3BDLFVBQU0sc0JBQWlDLENBQUM7QUFDeEMsVUFBTSx1QkFBdUIsQ0FBQyxXQUFvQixvQkFBb0IsS0FBSyxNQUFNO0FBQ2pGLFlBQVEsR0FBRyxzQkFBc0Isb0JBQW9CO0FBQ3JELFVBQU0sdUJBQXVCLGFBQWEsMEJBQTBCO0FBQ3BFLDhCQUEwQixXQUFTO0FBQ2xDLHNCQUFnQixLQUFLLEtBQUs7QUFDMUIsVUFBSSxnQkFBZ0IsV0FBVyxHQUFHO0FBQ2pDLGNBQU07QUFBQSxNQUNQO0FBQUEsSUFDRCxDQUFDO0FBQ0QsUUFBSTtBQUNILFlBQU0sSUFBSTtBQUNWLFlBQU0sUUFBUSxDQUFDO0FBQ2YsYUFBTyxnQkFBZ0IsRUFBRSxxQkFBcUIsZ0JBQWdCLEdBQUc7QUFBQSxRQUNoRSxxQkFBcUIsQ0FBQztBQUFBLFFBQ3RCLGlCQUFpQixDQUFDLFdBQVcsU0FBUztBQUFBLE1BQ3ZDLENBQUM7QUFBQSxJQUNGLFVBQUU7QUFDRCxnQ0FBMEIsb0JBQW9CO0FBQzlDLGNBQVEsSUFBSSxzQkFBc0Isb0JBQW9CO0FBQUEsSUFDdkQ7QUFBQSxFQUNEO0FBRUEsV0FBUyxpQ0FDUixZQUNBLGFBQXVELENBQUMsR0FDeEQsaUJBQWlCLE1BQ1U7QUFDM0IsVUFBTSxnQkFBa0Q7QUFBQSxNQUN2RCxXQUFXO0FBQUEsTUFDWCxRQUFRO0FBQUEsTUFDUixTQUFTO0FBQUEsTUFDVCxjQUFjO0FBQUEsTUFDZCxVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFDVDtBQUNBLFdBQU87QUFBQSxNQUNOLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsb0JBQW9CLE9BQU8sRUFBRSxNQUFNLFlBQXFCO0FBQUEsTUFDeEQsdUJBQXVCLE9BQU8sRUFBRSxlQUFlO0FBQUEsTUFDL0MsdUJBQXVCLE1BQU07QUFBQSxNQUM3QixvQkFBb0IsT0FBTyxZQUFvRDtBQUM5RSxtQkFBVyxLQUFLLE9BQU87QUFDdkIsZUFBTztBQUFBLE1BQ1I7QUFBQSxNQUNBLG9CQUFvQixPQUFPLFlBQW9EO0FBQzlFLG1CQUFXLEtBQUssT0FBTztBQUN2QixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBRUEsUUFBTSxxQkFBcUI7QUFFM0IsT0FBSywyRUFBMkUsaUJBQWtCO0FBQ2pHLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSwwQkFBMEI7QUFDakUsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLDhCQUE4QjtBQUNyRSxVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxhQUFhLGlDQUFpQyxVQUFVO0FBQzlELFdBQU8sWUFBWSxXQUFXLGtCQUFrQixHQUFHLElBQUk7QUFDdkQsV0FBTyxZQUFZLFdBQVcsc0JBQXNCLEVBQUUsZ0JBQWdCLElBQUk7QUFDMUUsV0FBTyxZQUFZLDBCQUEwQixVQUFVLEdBQUcsSUFBSTtBQUM5RCxXQUFPLFlBQVksNEJBQTRCLE1BQU0sTUFBTSwwQkFBMEIsVUFBVSxDQUFDLEdBQUcsS0FBSztBQUV4RyxVQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxNQUNwRCxhQUFhO0FBQUEsTUFDYjtBQUFBLE1BQ0E7QUFBQSxJQUNELENBQUM7QUFDRCx5QkFBcUIsS0FBSyxlQUFlO0FBQUEsTUFDeEMsVUFBVSxZQUFZO0FBQUEsTUFDdEIsMkJBQTJCLE1BQU07QUFBQSxNQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLElBQzNDLENBQTZCO0FBQzdCLFVBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YseUJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsVUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxNQUNoRixJQUFJO0FBQUEsTUFDSixPQUFPO0FBQUEsSUFDUixDQUFDLENBQUM7QUFDRixTQUFLLE9BQU87QUFDWixVQUFNLGFBQWEsS0FBSztBQUFBLE1BQ3ZCLFVBQVU7QUFBQSxNQUNWO0FBQUEsTUFDQSxTQUFTO0FBQUEsSUFDVixDQUFDO0FBQ0QsVUFBTSxRQUFRLEVBQUU7QUFDaEIsMEJBQXNCLElBQUk7QUFFMUIsVUFBTSxjQUFjLEtBQUssUUFBUSxjQUFjLDRCQUE0QjtBQUMzRSxXQUFPLFlBQVksYUFBYSxNQUFNLFNBQVMsTUFBTTtBQUNyRCxlQUFXLFdBQVc7QUFDdEIsVUFBTyxLQUF1RCxVQUFVO0FBQ3hFLFVBQU0sUUFBUSxFQUFFO0FBQ2hCLFdBQU8sZ0JBQWdCLFlBQVksQ0FBQyxDQUFDO0FBRXJDLFVBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ2xILFVBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxhQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFVBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFVBQU0sUUFBUSxNQUFNLElBQUksSUFBSSw0QkFBNEIsVUFBVSxVQUFVLGFBQWEsQ0FBQztBQUMxRixVQUFNLEtBQUssU0FBUyxPQUFPLFFBQVcsdUJBQU8sT0FBTyxJQUFJLEdBQUcsa0JBQWtCLElBQUk7QUFDakYsVUFBTSxRQUFRLEVBQUU7QUFDaEIsMkJBQXVCLElBQUk7QUFFM0IsVUFBTSxlQUFlLE9BQU8sY0FBYyxrQ0FBa0M7QUFDNUUsV0FBTyxZQUFZLGNBQWMsTUFBTSxTQUFTLE1BQU07QUFDdEQsZUFBVyxZQUFZO0FBQ3ZCLFVBQU8sS0FBdUQsVUFBVTtBQUN4RSxVQUFNLFFBQVEsRUFBRTtBQUNoQixXQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUFBLEVBQ3RDLENBQUM7QUFFRCxPQUFLLHdGQUF3RixpQkFBa0I7QUFDOUcsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGdDQUFnQztBQUN2RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sb0NBQW9DO0FBQzNFLFVBQU0sYUFBdUQsQ0FBQztBQUM5RCxVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxtQkFBOEIsQ0FBQztBQUNyQyxVQUFNLGFBQWEsaUNBQWlDLFlBQVksVUFBVTtBQUMxRSxXQUFPLFlBQVksV0FBVyxrQkFBa0IsR0FBRyxJQUFJO0FBQ3ZELFdBQU8sWUFBWSxXQUFXLHNCQUFzQixFQUFFLGdCQUFnQixJQUFJO0FBQzFFLFdBQU8sWUFBWSwwQkFBMEIsVUFBVSxHQUFHLElBQUk7QUFDOUQsV0FBTyxZQUFZLDRCQUE0QixNQUFNLE1BQU0sYUFBYSwwQkFBMEIsVUFBVSxDQUFDLEdBQUcsS0FBSztBQUVySCxVQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxNQUNwRCxhQUFhO0FBQUEsTUFDYjtBQUFBLE1BQ0E7QUFBQSxNQUNBLGdCQUFnQixPQUFPLGNBQXVCO0FBQzdDLFlBQUksY0FBYyxhQUFhO0FBQzlCLDJCQUFpQixLQUFLLFNBQVM7QUFBQSxRQUNoQztBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFDRCx5QkFBcUIsS0FBSyxlQUFlO0FBQUEsTUFDeEMsVUFBVSxZQUFZO0FBQUEsTUFDdEIsMkJBQTJCLE1BQU07QUFBQSxNQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLElBQzNDLENBQTZCO0FBQzdCLFVBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YseUJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsVUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxNQUNoRixJQUFJO0FBQUEsTUFDSixPQUFPO0FBQUEsSUFDUixDQUFDLENBQUM7QUFDRixTQUFLLE9BQU87QUFDWixVQUFNLGFBQWEsS0FBSztBQUFBLE1BQ3ZCLFVBQVU7QUFBQSxNQUNWO0FBQUEsTUFDQSxTQUFTO0FBQUEsSUFDVixDQUFDO0FBQ0QsVUFBTSxRQUFRLEVBQUU7QUFFaEIsVUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxXQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsTUFBTTtBQUNwRCxlQUFXLFVBQVU7QUFDckIsVUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFVBQU0sUUFBUSxFQUFFO0FBQ2hCLFdBQU8sZ0JBQWdCLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLFdBQU8sZ0JBQWdCLGtCQUFrQixDQUFDLENBQUM7QUFFM0MsVUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSw0QkFBNEIsSUFBSSxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7QUFDbEgsVUFBTSxTQUFTLFNBQVMsY0FBYyxLQUFLO0FBQzNDLGFBQVMsS0FBSyxZQUFZLE1BQU07QUFDaEMsVUFBTSxJQUFJLEVBQUUsU0FBUyxNQUFNLE9BQU8sT0FBTyxFQUFFLENBQUM7QUFDNUMsU0FBSyxPQUFPLE1BQU07QUFDbEIsVUFBTSxRQUFRLE1BQU0sSUFBSSxJQUFJLDRCQUE0QixVQUFVLFVBQVUsYUFBYSxDQUFDO0FBQzFGLFVBQU0sS0FBSyxTQUFTLE9BQU8sUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUNqRixVQUFNLFFBQVEsRUFBRTtBQUVoQixVQUFNLGNBQWMsT0FBTyxjQUFjLGlDQUFpQztBQUMxRSxXQUFPLFlBQVksYUFBYSxNQUFNLFNBQVMsTUFBTTtBQUNyRCxlQUFXLFdBQVc7QUFDdEIsVUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFVBQU0sUUFBUSxFQUFFO0FBQ2hCLFdBQU8sZ0JBQWdCLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLFdBQU8sZ0JBQWdCLGtCQUFrQixDQUFDLENBQUM7QUFDM0MsV0FBTyxnQkFBZ0IsWUFBWSxDQUFDLENBQUM7QUFBQSxFQUN0QyxDQUFDO0FBRUQsV0FBUyw0QkFDUixnQkFDMkI7QUFDM0IsV0FBTyxpQ0FBaUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxjQUFjO0FBQUEsRUFDL0Q7QUFFQSxXQUFTLHNCQUFzQixNQUFrQztBQUNoRSxVQUFNLE9BQU87QUFDYixTQUFLLHVCQUF1QjtBQUM1QixTQUFLLG1CQUFtQjtBQUFBLEVBQ3pCO0FBRUEsT0FBSyxtRUFBbUUsaUJBQWtCO0FBQ3pGLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSw4Q0FBOEM7QUFDckYsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGtEQUFrRDtBQUN6RixVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxhQUFhLGlDQUFpQyxDQUFDLEdBQUcsWUFBWSxLQUFLO0FBQ3pFLFVBQU0sZUFBZSxpQkFBaUIsZ0JBQWdCLGFBQWEsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUM1RSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsOEJBQThCLFFBQVcsS0FBSztBQUMzRSwyQkFBcUIsS0FBSyx3QkFBd0IsZ0NBQWdDLENBQUM7QUFDbkYsMkJBQXFCLEtBQUssMEJBQTBCLFVBQVU7QUFDOUQsMkJBQXFCLEtBQUssNEJBQTRCO0FBQUEsUUFDckQsb0JBQW9CLE1BQU07QUFBQSxRQUMxQiwwQkFBMEIsTUFBTTtBQUFBLFFBQ2hDLG9CQUFvQixNQUFNO0FBQUEsUUFDMUIsc0JBQXNCLE1BQU07QUFBQSxNQUM3QixDQUEwQztBQUMxQywyQkFBcUIsS0FBSyxhQUFhLHFCQUFxQixVQUFVLGFBQWEsQ0FBQztBQUNwRixpQ0FBMkIsc0JBQXNCLFlBQVksSUFBSTtBQUNqRSwyQkFBcUIsS0FBSyxpQkFBaUI7QUFBQSxRQUMxQyxzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLHFCQUFxQixNQUFNO0FBQUEsUUFDM0IsZ0JBQWdCLFlBQVk7QUFBQSxNQUM3QixDQUErQjtBQUMvQiwyQkFBcUIsS0FBSyxtQkFBbUI7QUFBQSxRQUM1QyxzQkFBc0IsWUFBWTtBQUNqQyxnQkFBTSxJQUFJLE1BQU0sTUFBTTtBQUFBLFFBQ3ZCO0FBQUEsTUFDRCxDQUFpQztBQUNqQywyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFFMUIsWUFBTSxVQUFXLEtBQStFLGdCQUFnQjtBQUNoSCxhQUFPLFlBQVksU0FBUyxTQUFTLE9BQU87QUFDNUMsWUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxhQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsTUFBTTtBQUVwRCxZQUFPLEtBQXNELFNBQVM7QUFDdEUsWUFBTSxRQUFRLEVBQUU7QUFDaEIsYUFBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLGFBQU8sWUFBWSxZQUFZLE1BQU0sU0FBUyxNQUFNO0FBQUEsSUFDckQsVUFBRTtBQUNELG1CQUFhLFFBQVE7QUFBQSxJQUN0QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsscUZBQXFGLGlCQUFrQjtBQUMzRyxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0seUNBQXlDO0FBQ2hGLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSw2Q0FBNkM7QUFDcEYsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sYUFBYSxpQ0FBaUMsQ0FBQyxHQUFHLFlBQVksS0FBSztBQUN6RSxVQUFNLGVBQWUsaUJBQWlCLGdCQUFnQixhQUFhLE1BQU07QUFBQSxJQUFFLENBQUM7QUFDNUUsUUFBSTtBQUNILFlBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLFFBQ3BELGFBQWE7QUFBQSxRQUNiO0FBQUEsUUFDQSxTQUFTO0FBQUEsUUFDVDtBQUFBLE1BQ0QsQ0FBQztBQUNELDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLFFBQ2hGLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTztBQUNaLFlBQU0sYUFBYSxLQUFLO0FBQUEsUUFDdkIsVUFBVTtBQUFBLFFBQ1Y7QUFBQSxRQUNBLFNBQVM7QUFBQSxNQUNWLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUVoQixZQUFPLEtBQXNELFNBQVM7QUFDdEUsWUFBTSxRQUFRLEVBQUU7QUFDaEIsYUFBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLFlBQU0sT0FBTztBQUNiLGFBQU8sWUFBWSxLQUFLLGVBQWUsTUFBUztBQUFBLElBQ2pELFVBQUU7QUFDRCxtQkFBYSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHFGQUFxRixpQkFBa0I7QUFDM0csVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLHVDQUF1QztBQUM5RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sMkNBQTJDO0FBQ2xGLFVBQU0sYUFBdUQsQ0FBQztBQUM5RCxVQUFNLGFBQWEsaUNBQWlDLENBQUMsR0FBRyxZQUFZLEtBQUs7QUFDekUsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFFBQUk7QUFDSCxZQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxRQUNwRCxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1Q7QUFBQSxNQUNELENBQUM7QUFDRCwyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFFMUIsWUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxhQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsRUFBRTtBQUVoRCxZQUFPLEtBQXNELFNBQVM7QUFDdEUsWUFBTSxRQUFRLEVBQUU7QUFDaEIsYUFBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLGFBQU8sWUFBWSxZQUFZLE1BQU0sU0FBUyxNQUFNO0FBRXBELFlBQU0sUUFBUSxXQUFXLEtBQUssTUFBTSxvQ0FBb0M7QUFDeEUsWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVixVQUFVLFdBQVcsS0FBSyxNQUFNLHdDQUF3QztBQUFBLFFBQ3hFLFNBQVM7QUFBQSxNQUNWLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUNoQiw0QkFBc0IsSUFBSTtBQUMxQixhQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsRUFBRTtBQUFBLElBQ2pELFVBQUU7QUFDRCxtQkFBYSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHNFQUFzRSxpQkFBa0I7QUFDNUYsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLHVDQUF1QztBQUM5RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sMkNBQTJDO0FBQ2xGLFVBQU0sUUFBUTtBQUFBLE1BQ2IsSUFBSTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsV0FBVyxDQUFDO0FBQUEsSUFDYjtBQUNBLFVBQU0sb0JBQW9CO0FBQUEsTUFDekIsV0FBVztBQUFBLE1BQ1gsZUFBZTtBQUFBLE1BQ2YsYUFBYSxDQUFDO0FBQUEsTUFDZCxNQUFNLFlBQVk7QUFBQSxNQUFFO0FBQUEsSUFDckI7QUFDQSxVQUFNLFVBQVUsS0FBSyxpQkFBaUI7QUFDdEMsVUFBTSxhQUFhO0FBQUEsTUFDbEIsZUFBZTtBQUFBLE1BQ2YsSUFBSSxlQUFlO0FBQ2xCLGVBQU8sQ0FBQztBQUFBLFVBQ1AsVUFBVTtBQUFBLFlBQ1QsUUFBUSxDQUFDLEtBQUs7QUFBQSxZQUNkLFNBQVM7QUFBQSxZQUNULHNCQUFzQixNQUFNO0FBQUEsWUFDNUIsMkJBQTJCLE1BQU07QUFBQSxVQUNsQztBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLElBQUksa0JBQWtCO0FBQUUsZUFBTztBQUFBLE1BQUc7QUFBQSxNQUNsQyxvQkFBb0IsTUFBTTtBQUFBLE1BQzFCLHVCQUF1QixNQUFNO0FBQUEsTUFDN0IscUJBQXFCLE1BQU07QUFBRSxjQUFNLElBQUksTUFBTSxpQkFBaUI7QUFBQSxNQUFHO0FBQUEsTUFDakUsZUFBZSxNQUFNO0FBQUEsSUFDdEI7QUFFQSxVQUFNLGVBQWUsaUJBQWlCLGdCQUFnQixhQUFhLE1BQU07QUFDeEUsWUFBTSxVQUFVLFNBQVM7QUFBQSxJQUMxQixDQUFDO0FBQ0QsVUFBTSx5QkFBeUI7QUFBQSxNQUM5QixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLHVCQUF1QixPQUFPLENBQUM7QUFBQSxNQUMvQix1QkFBdUIsTUFBTTtBQUFBLElBQzlCO0FBQ0EsUUFBSTtBQUNILFlBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLFFBQ3BELGFBQWE7QUFBQSxRQUNiO0FBQUEsUUFDQSxTQUFTO0FBQUEsUUFDVCxZQUFZO0FBQUEsTUFDYixDQUFDO0FBQ0QsMkJBQXFCLEtBQUssYUFBYSxVQUFVO0FBQ2pELDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLFFBQ2hGLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTztBQUNaLFlBQU0sYUFBYSxLQUFLO0FBQUEsUUFDdkIsVUFBVTtBQUFBLFFBQ1Y7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxNQUNkLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUNoQiw0QkFBc0IsSUFBSTtBQUUxQixZQUFNLGNBQWMsS0FBSyxRQUFRLGNBQWMsNEJBQTRCO0FBQzNFLGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxFQUFFO0FBRWpELFlBQU8sS0FBMkUsYUFBYSxXQUFXO0FBQzFHLFlBQU0sUUFBUSxFQUFFO0FBQ2hCLGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxNQUFNO0FBRXJELFlBQU0sUUFBUSxXQUFXLEtBQUssTUFBTSx3Q0FBd0M7QUFDNUUsWUFBTSxnQkFBZ0IsV0FBVyxLQUFLLE1BQU0sNENBQTRDO0FBQ3hGLFlBQU0sbUJBQW1CO0FBQUEsUUFDeEIsV0FBVztBQUFBLFFBQ1gsZUFBZTtBQUFBLFFBQ2YsYUFBYSxDQUFDO0FBQUEsUUFDZCxNQUFNLFlBQVk7QUFBQSxRQUFFO0FBQUEsTUFDckI7QUFDQSxZQUFNLFVBQVUsS0FBSyxnQkFBZ0I7QUFDckMsWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVixVQUFVO0FBQUEsUUFDVixTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsTUFDZCxDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFDMUIsYUFBTyxZQUFZLGFBQWEsTUFBTSxTQUFTLEVBQUU7QUFBQSxJQUNsRCxVQUFFO0FBQ0QsbUJBQWEsUUFBUTtBQUFBLElBQ3RCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxzREFBc0QsaUJBQWtCO0FBQzVFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSwwQ0FBMEM7QUFDakYsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLDhDQUE4QztBQUNyRixVQUFNLGVBQWUsaUJBQWlCLGdCQUFnQixhQUFhLE1BQU07QUFBQSxJQUFFLENBQUM7QUFDNUUsUUFBSTtBQUNILFlBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLFFBQ3BELGFBQWE7QUFBQSxRQUNiO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSw0QkFBNEIsSUFBSSxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7QUFDbEgsWUFBTSxTQUFTLFNBQVMsY0FBYyxLQUFLO0FBQzNDLGVBQVMsS0FBSyxZQUFZLE1BQU07QUFDaEMsWUFBTSxJQUFJLEVBQUUsU0FBUyxNQUFNLE9BQU8sT0FBTyxFQUFFLENBQUM7QUFDNUMsV0FBSyxPQUFPLE1BQU07QUFDbEIsWUFBTSxRQUFRLE1BQU0sSUFBSSxJQUFJLDRCQUE0QixVQUFVLFVBQVUsYUFBYSxDQUFDO0FBQzFGLFlBQU0sS0FBSyxTQUFTLE9BQU8sUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUNqRixZQUFNLFFBQVEsRUFBRTtBQUNoQiw2QkFBdUIsSUFBSTtBQUUzQixZQUFNLGVBQWUsT0FBTyxjQUFjLGtDQUFrQztBQUM1RSxhQUFPLFlBQVksY0FBYyxNQUFNLFNBQVMsRUFBRTtBQUNsRCxZQUFPLEtBQTJFLGFBQWEsV0FBVztBQUMxRyxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLFlBQVksY0FBYyxNQUFNLFNBQVMsTUFBTTtBQUFBLElBQ3ZELFVBQUU7QUFDRCxtQkFBYSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHlFQUF5RSxpQkFBa0I7QUFDL0YsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGtDQUFrQztBQUN6RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sc0NBQXNDO0FBQzdFLFVBQU0sUUFBUTtBQUFBLE1BQ2IsSUFBSTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsV0FBVyxDQUFDO0FBQUEsSUFDYjtBQUNBLFVBQU0sb0JBQW9CO0FBQUEsTUFDekIsV0FBVztBQUFBLE1BQ1gsZUFBZTtBQUFBLE1BQ2YsYUFBYSxDQUFDO0FBQUEsTUFDZCxNQUFNLFlBQVk7QUFBQSxNQUFFO0FBQUEsSUFDckI7QUFDQSxVQUFNLFVBQVUsS0FBSyxpQkFBaUI7QUFDdEMsVUFBTSxhQUFhO0FBQUEsTUFDbEIsZUFBZTtBQUFBLE1BQ2YsSUFBSSxlQUFlO0FBQ2xCLGVBQU8sQ0FBQztBQUFBLFVBQ1AsVUFBVTtBQUFBLFlBQ1QsUUFBUSxDQUFDLEtBQUs7QUFBQSxZQUNkLFNBQVM7QUFBQSxZQUNULHNCQUFzQixNQUFNO0FBQUEsWUFDNUIsMkJBQTJCLE1BQU07QUFBQSxVQUNsQztBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLElBQUksa0JBQWtCO0FBQUUsZUFBTztBQUFBLE1BQUc7QUFBQSxNQUNsQyxvQkFBb0IsTUFBTTtBQUFBLE1BQzFCLHVCQUF1QixNQUFNO0FBQUEsTUFDN0IscUJBQXFCLE1BQU07QUFBRSxjQUFNLElBQUksTUFBTSxpQkFBaUI7QUFBQSxNQUFHO0FBQUEsTUFDakUsZUFBZSxNQUFNO0FBQUEsSUFDdEI7QUFFQSxVQUFNLGlCQUFpQixpQkFBaUIsZ0JBQWdCLGVBQWUsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUNoRixVQUFNLHlCQUF5QjtBQUFBLE1BQzlCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsdUJBQXVCLE9BQU8sQ0FBQztBQUFBLE1BQy9CLHVCQUF1QixNQUFNO0FBQUEsSUFDOUI7QUFDQSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsd0JBQXdCO0FBQUEsUUFDcEQsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULFlBQVk7QUFBQSxNQUNiLENBQUM7QUFDRCwyQkFBcUIsS0FBSyxhQUFhLFVBQVU7QUFDakQsMkJBQXFCLEtBQUssZUFBZTtBQUFBLFFBQ3hDLFVBQVUsWUFBWTtBQUFBLFFBQ3RCLDJCQUEyQixNQUFNO0FBQUEsUUFDakMsb0NBQW9DLE1BQU07QUFBQSxNQUMzQyxDQUE2QjtBQUM3QixZQUFNLGVBQWUsTUFBTSxJQUFJLHFCQUFxQixlQUFlLHVCQUF1QixDQUFDO0FBQzNGLDJCQUFxQixLQUFLLDBCQUEwQixZQUFZO0FBRWhFLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsc0JBQXNCO0FBQUEsUUFDaEYsSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLE1BQ1IsQ0FBQyxDQUFDO0FBQ0YsV0FBSyxPQUFPO0FBQ1osWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLE1BQ2QsQ0FBQztBQUNELFlBQU0sUUFBUSxFQUFFO0FBQ2hCLDRCQUFzQixJQUFJO0FBRTFCLFlBQU0sZUFBZSxLQUFLLFFBQVEsY0FBYyw2QkFBNkI7QUFDN0UsYUFBTyxZQUFZLGNBQWMsTUFBTSxTQUFTLEVBQUU7QUFFbEQsWUFBTyxLQUEyRSxhQUFhLGFBQWE7QUFDNUcsWUFBTSxRQUFRLEVBQUU7QUFDaEIsYUFBTyxZQUFZLGNBQWMsTUFBTSxTQUFTLE1BQU07QUFFdEQsWUFBTSxRQUFRLFdBQVcsS0FBSyxNQUFNLG1DQUFtQztBQUN2RSxZQUFNLGdCQUFnQixXQUFXLEtBQUssTUFBTSx1Q0FBdUM7QUFDbkYsWUFBTSxtQkFBbUI7QUFBQSxRQUN4QixXQUFXO0FBQUEsUUFDWCxlQUFlO0FBQUEsUUFDZixhQUFhLENBQUM7QUFBQSxRQUNkLE1BQU0sWUFBWTtBQUFBLFFBQUU7QUFBQSxNQUNyQjtBQUNBLFlBQU0sVUFBVSxLQUFLLGdCQUFnQjtBQUNyQyxZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVU7QUFBQSxRQUNWLFVBQVU7QUFBQSxRQUNWLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxNQUNkLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUNoQiw0QkFBc0IsSUFBSTtBQUMxQixhQUFPLFlBQVksY0FBYyxNQUFNLFNBQVMsRUFBRTtBQUFBLElBQ25ELFVBQUU7QUFDRCxxQkFBZSxRQUFRO0FBQUEsSUFDeEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG1GQUFtRixpQkFBa0I7QUFDekcsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLHdDQUF3QztBQUMvRSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sNENBQTRDO0FBQ25GLFVBQU0sYUFBYTtBQUFBLE1BQ2xCLElBQUk7QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFdBQVcsQ0FBQztBQUFBLElBQ2I7QUFDQSxVQUFNLG9CQUFvQjtBQUFBLE1BQ3pCLFdBQVc7QUFBQSxNQUNYLGVBQWU7QUFBQSxNQUNmLGFBQWEsQ0FBQztBQUFBLE1BQ2QsTUFBTSxZQUFZO0FBQUEsTUFBRTtBQUFBLElBQ3JCO0FBQ0EsVUFBTSxtQkFBbUI7QUFBQSxNQUN4QixJQUFJO0FBQUEsTUFDSixPQUFPO0FBQUEsTUFDUCxXQUFXLENBQUM7QUFBQSxJQUNiO0FBQ0EsVUFBTSxrQkFBa0I7QUFBQSxNQUN2QixXQUFXO0FBQUEsTUFDWCxlQUFlO0FBQUEsTUFDZixhQUFhLENBQUM7QUFBQSxNQUNkLE1BQU0sWUFBWTtBQUFBLE1BQUU7QUFBQSxJQUNyQjtBQUNBLHFCQUFpQixVQUFVLEtBQUssZUFBZTtBQUMvQyxVQUFNLGFBQWE7QUFBQSxNQUNsQixlQUFlO0FBQUEsTUFDZixJQUFJLGVBQWU7QUFDbEIsZUFBTyxDQUFDO0FBQUEsVUFDUCxVQUFVO0FBQUEsWUFDVCxRQUFRLENBQUMsWUFBWSxnQkFBZ0I7QUFBQSxZQUNyQyxTQUFTO0FBQUEsWUFDVCxzQkFBc0IsTUFBTTtBQUFBLFlBQzVCLDJCQUEyQixNQUFNO0FBQUEsVUFDbEM7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsTUFDQSxJQUFJLGtCQUFrQjtBQUFFLGVBQU87QUFBQSxNQUFHO0FBQUEsTUFDbEMsb0JBQW9CLE1BQU07QUFBQSxNQUMxQix1QkFBdUIsTUFBTTtBQUFBLE1BQzdCLHFCQUFxQixNQUFNO0FBQUUsY0FBTSxJQUFJLE1BQU0saUJBQWlCO0FBQUEsTUFBRztBQUFBLE1BQ2pFLGVBQWUsTUFBTTtBQUFBLElBQ3RCO0FBRUEsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFVBQU0seUJBQXlCO0FBQUEsTUFDOUIsbUJBQW1CLE1BQU07QUFBQSxNQUN6Qix1QkFBdUIsT0FBTyxDQUFDO0FBQUEsTUFDL0IsdUJBQXVCLE1BQU07QUFBQSxJQUM5QjtBQUNBLFFBQUk7QUFDSCxZQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxRQUNwRCxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1QsWUFBWTtBQUFBLE1BQ2IsQ0FBQztBQUNELDJCQUFxQixLQUFLLGFBQWEsVUFBVTtBQUNqRCwyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsUUFDVCxhQUFhO0FBQUEsTUFDZCxDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFFMUIsWUFBTSxVQUFXLEtBQTJHLGdCQUFnQjtBQUM1SSxhQUFPLFlBQVksU0FBUyxTQUFTLE9BQU87QUFDNUMsYUFBTyxZQUFZLFNBQVMsYUFBYSxpQkFBaUI7QUFFMUQsWUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxZQUFNLGVBQWUsS0FBSyxRQUFRLGNBQWMsNkJBQTZCO0FBQzdFLGFBQU8sWUFBWSxZQUFZLE1BQU0sU0FBUyxNQUFNO0FBQ3BELGFBQU8sWUFBWSxjQUFjLE1BQU0sU0FBUyxNQUFNO0FBQUEsSUFDdkQsVUFBRTtBQUNELG1CQUFhLFFBQVE7QUFBQSxJQUN0QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsscUZBQXFGLGlCQUFrQjtBQUMzRyxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sa0NBQWtDO0FBQ3pFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSxzQ0FBc0M7QUFDN0UsVUFBTSxhQUFhO0FBQUEsTUFDbEIsSUFBSTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsV0FBVyxDQUFDO0FBQUEsSUFDYjtBQUNBLFVBQU0sb0JBQW9CO0FBQUEsTUFDekIsV0FBVztBQUFBLE1BQ1gsZUFBZTtBQUFBLE1BQ2YsYUFBYSxDQUFDO0FBQUEsTUFDZCxNQUFNLFlBQVk7QUFBQSxNQUFFO0FBQUEsSUFDckI7QUFDQSxVQUFNLGFBQWE7QUFBQSxNQUNsQixlQUFlO0FBQUEsTUFDZixJQUFJLGVBQWU7QUFDbEIsZUFBTyxDQUFDO0FBQUEsVUFDUCxVQUFVO0FBQUEsWUFDVCxRQUFRLENBQUMsVUFBVTtBQUFBLFlBQ25CLFNBQVM7QUFBQSxZQUNULHNCQUFzQixNQUFNO0FBQUEsWUFDNUIsMkJBQTJCLE1BQU07QUFBQSxVQUNsQztBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxNQUNBLElBQUksa0JBQWtCO0FBQUUsZUFBTztBQUFBLE1BQUc7QUFBQSxNQUNsQyxvQkFBb0IsTUFBTTtBQUFBLE1BQzFCLHVCQUF1QixNQUFNO0FBQUEsTUFDN0IscUJBQXFCLE1BQU07QUFBRSxjQUFNLElBQUksTUFBTSxpQkFBaUI7QUFBQSxNQUFHO0FBQUEsTUFDakUsZUFBZSxNQUFNO0FBQUEsSUFDdEI7QUFFQSxVQUFNLGlCQUFpQixpQkFBaUIsZ0JBQWdCLGVBQWUsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUNoRixVQUFNLHlCQUF5QjtBQUFBLE1BQzlCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsdUJBQXVCLE9BQU8sQ0FBQztBQUFBLE1BQy9CLHVCQUF1QixNQUFNO0FBQUEsSUFDOUI7QUFDQSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsd0JBQXdCO0FBQUEsUUFDcEQsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULFlBQVk7QUFBQSxNQUNiLENBQUM7QUFDRCwyQkFBcUIsS0FBSyxhQUFhLFVBQVU7QUFDakQsMkJBQXFCLEtBQUssZUFBZTtBQUFBLFFBQ3hDLFVBQVUsWUFBWTtBQUFBLFFBQ3RCLDJCQUEyQixNQUFNO0FBQUEsUUFDakMsb0NBQW9DLE1BQU07QUFBQSxNQUMzQyxDQUE2QjtBQUM3QixZQUFNLGVBQWUsTUFBTSxJQUFJLHFCQUFxQixlQUFlLHVCQUF1QixDQUFDO0FBQzNGLDJCQUFxQixLQUFLLDBCQUEwQixZQUFZO0FBRWhFLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsc0JBQXNCO0FBQUEsUUFDaEYsSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLE1BQ1IsQ0FBQyxDQUFDO0FBQ0YsV0FBSyxPQUFPO0FBQ1osWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLE1BQ2QsQ0FBQztBQUNELFlBQU0sUUFBUSxFQUFFO0FBQ2hCLDRCQUFzQixJQUFJO0FBRTFCLFlBQU0sVUFBVyxLQUErRSxnQkFBZ0I7QUFDaEgsYUFBTyxZQUFZLFNBQVMsU0FBUyxPQUFPO0FBRTVDLFlBQU0sYUFBYSxLQUFLLFFBQVEsY0FBYywyQkFBMkI7QUFDekUsWUFBTSxlQUFlLEtBQUssUUFBUSxjQUFjLDZCQUE2QjtBQUM3RSxhQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsTUFBTTtBQUNwRCxhQUFPLFlBQVksY0FBYyxNQUFNLFNBQVMsRUFBRTtBQUFBLElBQ25ELFVBQUU7QUFDRCxxQkFBZSxRQUFRO0FBQUEsSUFDeEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLCtGQUErRixpQkFBa0I7QUFDckgsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLDZCQUE2QjtBQUNwRSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0saUNBQWlDO0FBQ3hFLFVBQU0sYUFBYTtBQUFBLE1BQ2xCLElBQUk7QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFdBQVcsQ0FBQztBQUFBLElBQ2I7QUFDQSxVQUFNLG1CQUFtQjtBQUFBLE1BQ3hCLElBQUk7QUFBQSxNQUNKLE9BQU87QUFBQSxNQUNQLFdBQVcsQ0FBQztBQUFBLElBQ2I7QUFDQSxVQUFNLGdCQUFnQjtBQUFBLE1BQ3JCLFdBQVc7QUFBQSxNQUNYLGVBQWU7QUFBQSxNQUNmLGFBQWEsQ0FBQztBQUFBLE1BQ2QsTUFBTSxZQUFZO0FBQUEsTUFBRTtBQUFBLElBQ3JCO0FBQ0EsVUFBTSxzQkFBc0I7QUFBQSxNQUMzQixXQUFXO0FBQUEsTUFDWCxlQUFlO0FBQUEsTUFDZixhQUFhLENBQUM7QUFBQSxNQUNkLE1BQU0sWUFBWTtBQUFBLE1BQUU7QUFBQSxJQUNyQjtBQUNBLGVBQVcsVUFBVSxLQUFLLGFBQWE7QUFDdkMscUJBQWlCLFVBQVUsS0FBSyxtQkFBbUI7QUFDbkQsVUFBTSxhQUFhO0FBQUEsTUFDbEIsZUFBZTtBQUFBLE1BQ2YsSUFBSSxlQUFlO0FBQ2xCLGVBQU8sQ0FBQztBQUFBLFVBQ1AsVUFBVTtBQUFBLFlBQ1QsUUFBUSxDQUFDLFlBQVksZ0JBQWdCO0FBQUEsWUFDckMsU0FBUztBQUFBLFlBQ1Qsc0JBQXNCLE1BQU07QUFBQSxZQUM1QiwyQkFBMkIsTUFBTTtBQUFBLFVBQ2xDO0FBQUEsUUFDRCxDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsSUFBSSxrQkFBa0I7QUFBRSxlQUFPO0FBQUEsTUFBRztBQUFBLE1BQ2xDLG9CQUFvQixNQUFNO0FBQUEsTUFDMUIsdUJBQXVCLE1BQU07QUFBQSxNQUM3QixxQkFBcUIsTUFBTTtBQUFFLGNBQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUFBLE1BQUc7QUFBQSxNQUNqRSxlQUFlLE1BQU07QUFBQSxJQUN0QjtBQUNBLFVBQU0sZUFBZSxpQkFBaUIsZ0JBQWdCLGFBQWEsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUM1RSxVQUFNLGlCQUFpQixpQkFBaUIsZ0JBQWdCLGVBQWUsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUNoRixVQUFNLHlCQUF5QjtBQUFBLE1BQzlCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsdUJBQXVCLE9BQU8sQ0FBQztBQUFBLE1BQy9CLHVCQUF1QixNQUFNO0FBQUEsSUFDOUI7QUFDQSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsd0JBQXdCO0FBQUEsUUFDcEQsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULFlBQVk7QUFBQSxNQUNiLENBQUM7QUFDRCwyQkFBcUIsS0FBSyxhQUFhLFVBQVU7QUFDakQsMkJBQXFCLEtBQUssZUFBZTtBQUFBLFFBQ3hDLFVBQVUsWUFBWTtBQUFBLFFBQ3RCLDJCQUEyQixNQUFNO0FBQUEsUUFDakMsb0NBQW9DLE1BQU07QUFBQSxNQUMzQyxDQUE2QjtBQUM3QixZQUFNLGVBQWUsTUFBTSxJQUFJLHFCQUFxQixlQUFlLHVCQUF1QixDQUFDO0FBQzNGLDJCQUFxQixLQUFLLDBCQUEwQixZQUFZO0FBQ2hFLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsc0JBQXNCO0FBQUEsUUFDaEYsSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLE1BQ1IsQ0FBQyxDQUFDO0FBQ0YsV0FBSyxPQUFPO0FBQ1osWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLE1BQ2QsQ0FBQztBQUNELFlBQU0sUUFBUSxFQUFFO0FBQ2hCLDRCQUFzQixJQUFJO0FBRTFCLFlBQU0sZUFBZ0IsS0FBeUgsZ0JBQWdCO0FBQy9KLGFBQU8sWUFBWSxjQUFjLFNBQVMsYUFBYTtBQUN2RCxhQUFPLFlBQVksY0FBYyxhQUFhLG1CQUFtQjtBQUNqRSxhQUFPLGVBQWUsY0FBYyxhQUFhLGFBQWE7QUFDOUQsWUFBTSxjQUFjLEtBQUssUUFBUSxjQUFjLDRCQUE0QjtBQUMzRSxZQUFNLGVBQWUsS0FBSyxRQUFRLGNBQWMsNkJBQTZCO0FBQzdFLGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxFQUFFO0FBQ2pELGFBQU8sWUFBWSxjQUFjLE1BQU0sU0FBUyxNQUFNO0FBRXRELFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ2xILFlBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxlQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFlBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFdBQUssT0FBTyxNQUFNO0FBQ2xCLFlBQU0sUUFBUSxNQUFNLElBQUksSUFBSSw0QkFBNEIsVUFBVSxVQUFVLGFBQWEsQ0FBQztBQUMxRixZQUFNLEtBQUssU0FBUyxPQUFPLFFBQVcsdUJBQU8sT0FBTyxJQUFJLEdBQUcsa0JBQWtCLElBQUk7QUFDakYsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNkJBQXVCLElBQUk7QUFDM0IsWUFBTSxRQUFTLEtBQTJILGtCQUFrQjtBQUM1SixhQUFPLFlBQVksT0FBTyxTQUFTLGFBQWE7QUFDaEQsYUFBTyxZQUFZLE9BQU8sYUFBYSxtQkFBbUI7QUFDMUQsWUFBTSxlQUFlLE9BQU8sY0FBYyxrQ0FBa0M7QUFDNUUsWUFBTSxnQkFBZ0IsT0FBTyxjQUFjLG1DQUFtQztBQUM5RSxhQUFPLFlBQVksY0FBYyxNQUFNLFNBQVMsRUFBRTtBQUNsRCxhQUFPLFlBQVksZUFBZSxNQUFNLFNBQVMsTUFBTTtBQUN2RCxZQUFNLFFBQVEsa0NBQWtDLE9BQU8sVUFBVTtBQUNqRSxhQUFPLFlBQVksT0FBTyxTQUFTLGFBQWE7QUFDaEQsYUFBTyxZQUFZLE9BQU8sYUFBYSxtQkFBbUI7QUFFMUQsWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1QsUUFBUTtBQUFBLFFBQ1IsV0FBVztBQUFBLFFBQ1gsU0FBUztBQUFBLFFBQ1QsWUFBWTtBQUFBLFFBQ1osTUFBTTtBQUFBLE1BQ1AsQ0FBQztBQUNELFlBQU0sUUFBUSxFQUFFO0FBQ2hCLDRCQUFzQixJQUFJO0FBQzFCLFlBQU0sZ0JBQWlCLEtBQXlILGdCQUFnQjtBQUNoSyxhQUFPLFlBQVksZUFBZSxTQUFTLGFBQWE7QUFDeEQsYUFBTyxZQUFZLGVBQWUsYUFBYSxNQUFTO0FBQ3hELGFBQU8sWUFBWSxlQUFlLE1BQU0sb0JBQW9CO0FBQzVELGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxNQUFNO0FBQ3JELGFBQU8sWUFBWSxjQUFjLE1BQU0sU0FBUyxNQUFNO0FBRXRELFlBQU0sY0FBYyxNQUFNLElBQUksSUFBSSw0QkFBNEIsVUFBVSxVQUFVLGVBQWU7QUFBQSxRQUNoRyxRQUFRO0FBQUEsUUFDUixXQUFXO0FBQUEsUUFDWCxTQUFTO0FBQUEsUUFDVCxZQUFZO0FBQUEsUUFDWixNQUFNO0FBQUEsTUFDUCxDQUFDLENBQUM7QUFDRixZQUFNLEtBQUssU0FBUyxhQUFhLFFBQVcsdUJBQU8sT0FBTyxJQUFJLEdBQUcsa0JBQWtCLElBQUk7QUFDdkYsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNkJBQXVCLElBQUk7QUFDM0IsWUFBTSxjQUFlLEtBQTJILGtCQUFrQjtBQUNsSyxhQUFPLFlBQVksYUFBYSxTQUFTLGFBQWE7QUFDdEQsYUFBTyxZQUFZLGFBQWEsYUFBYSxNQUFTO0FBQ3RELGFBQU8sWUFBWSxhQUFhLE1BQU0sb0JBQW9CO0FBQzFELGFBQU8sWUFBWSxjQUFjLE1BQU0sU0FBUyxNQUFNO0FBQ3RELGFBQU8sWUFBWSxlQUFlLE1BQU0sU0FBUyxNQUFNO0FBQ3ZELFlBQU0sY0FBYyxrQ0FBa0MsYUFBYSxVQUFVO0FBQzdFLGFBQU8sWUFBWSxhQUFhLFNBQVMsYUFBYTtBQUN0RCxhQUFPLFlBQVksYUFBYSxhQUFhLE1BQVM7QUFDdEQsYUFBTyxZQUFZLGFBQWEsU0FBUyxvQkFBb0I7QUFBQSxJQUM5RCxVQUFFO0FBQ0QsbUJBQWEsUUFBUTtBQUNyQixxQkFBZSxRQUFRO0FBQUEsSUFDeEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDJEQUEyRCxpQkFBa0I7QUFDakYsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGtDQUFrQztBQUN6RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sc0NBQXNDO0FBQzdFLFVBQU0sb0JBQW9CO0FBQUEsTUFDekIsV0FBVztBQUFBLE1BQ1gsZUFBZSxFQUFFLElBQUksU0FBUyxPQUFPLGtCQUFrQixXQUFXLENBQUMsRUFBb0I7QUFBQSxNQUN2RixhQUFhLENBQUM7QUFBQSxNQUNkLE1BQU0sWUFBWTtBQUFBLE1BQUU7QUFBQSxJQUNyQjtBQUVBLFVBQU0saUJBQWlCLGlCQUFpQixnQkFBZ0IsZUFBZSxNQUFNO0FBQzVFLFlBQU0sSUFBSSxNQUFNLGdCQUFnQjtBQUFBLElBQ2pDLENBQUM7QUFDRCxVQUFNLHlCQUF5QjtBQUFBLE1BQzlCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsdUJBQXVCLE9BQU8sQ0FBQztBQUFBLE1BQy9CLHVCQUF1QixNQUFNO0FBQUEsSUFDOUI7QUFDQSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsd0JBQXdCO0FBQUEsUUFDcEQsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULFlBQVk7QUFBQSxRQUNaLGdCQUFnQixPQUFPLGNBQXVCLFNBQW9CO0FBQ2pFLGNBQUksY0FBYyxlQUFlO0FBQ2hDLGtCQUFNLGlCQUFpQixXQUFXLGFBQWEsR0FBRyxRQUFTLFFBQTBDLEdBQUcsSUFBSTtBQUFBLFVBQzdHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLFFBQ2hGLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTztBQUNaLFlBQU0sYUFBYSxLQUFLO0FBQUEsUUFDdkIsVUFBVTtBQUFBLFFBQ1Y7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxNQUNkLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUNoQiw0QkFBc0IsSUFBSTtBQUUxQixZQUFNLGVBQWUsS0FBSyxRQUFRLGNBQWMsNkJBQTZCO0FBQzdFLGFBQU8sWUFBWSxjQUFjLE1BQU0sU0FBUyxFQUFFO0FBRWxELFlBQU8sS0FBMkUsYUFBYSxhQUFhO0FBQzVHLFlBQU0sUUFBUSxFQUFFO0FBQ2hCLGFBQU8sWUFBWSxjQUFjLE1BQU0sU0FBUyxFQUFFO0FBQUEsSUFDbkQsVUFBRTtBQUNELHFCQUFlLFFBQVE7QUFBQSxJQUN4QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssd0RBQXdELGlCQUFrQjtBQUM5RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sdUNBQXVDO0FBQzlFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSwyQ0FBMkM7QUFDbEYsVUFBTSxRQUFRO0FBQUEsTUFDYixJQUFJO0FBQUEsTUFDSixPQUFPO0FBQUEsTUFDUCxXQUFXLENBQUM7QUFBQSxJQUNiO0FBQ0EsVUFBTSxvQkFBb0I7QUFBQSxNQUN6QixXQUFXO0FBQUEsTUFDWCxlQUFlO0FBQUEsTUFDZixhQUFhLENBQUM7QUFBQSxNQUNkLE1BQU0sWUFBWTtBQUFBLE1BQUU7QUFBQSxJQUNyQjtBQUNBLFVBQU0sVUFBVSxLQUFLLGlCQUFpQjtBQUV0QyxVQUFNLGVBQWUsaUJBQWlCLGdCQUFnQixhQUFhLE1BQU07QUFDeEUsWUFBTSxJQUFJLE1BQU0sY0FBYztBQUFBLElBQy9CLENBQUM7QUFDRCxVQUFNLHlCQUF5QjtBQUFBLE1BQzlCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsdUJBQXVCLE9BQU8sQ0FBQztBQUFBLE1BQy9CLHVCQUF1QixNQUFNO0FBQUEsSUFDOUI7QUFDQSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsd0JBQXdCO0FBQUEsUUFDcEQsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULFlBQVk7QUFBQSxRQUNaLGdCQUFnQixPQUFPLGNBQXVCLFNBQW9CO0FBQ2pFLGNBQUksY0FBYyxhQUFhO0FBQzlCLGtCQUFNLGlCQUFpQixXQUFXLFdBQVcsR0FBRyxRQUFTLFFBQTBDLEdBQUcsSUFBSTtBQUFBLFVBQzNHO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLFFBQ2hGLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTztBQUNaLFlBQU0sYUFBYSxLQUFLO0FBQUEsUUFDdkIsVUFBVTtBQUFBLFFBQ1Y7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNULGFBQWE7QUFBQSxNQUNkLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUNoQiw0QkFBc0IsSUFBSTtBQUUxQixZQUFNLGNBQWMsS0FBSyxRQUFRLGNBQWMsNEJBQTRCO0FBQzNFLGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxFQUFFO0FBRWpELFlBQU8sS0FBMkUsYUFBYSxXQUFXO0FBQzFHLFlBQU0sUUFBUSxFQUFFO0FBQ2hCLGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxFQUFFO0FBQUEsSUFDbEQsVUFBRTtBQUNELG1CQUFhLFFBQVE7QUFBQSxJQUN0QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssZ0VBQWdFLGlCQUFrQjtBQUN0RixVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sbUNBQW1DO0FBQzFFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSx1Q0FBdUM7QUFDOUUsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sYUFBYSxpQ0FBaUMsQ0FBQyxHQUFHLFlBQVksS0FBSztBQUN6RSxVQUFNLGNBQWdEO0FBQUEsTUFDckQsV0FBVztBQUFBLE1BQ1gsUUFBUTtBQUFBLE1BQ1IsU0FBUztBQUFBLE1BQ1QsY0FBYztBQUFBLE1BQ2QsVUFBVTtBQUFBLE1BQ1YsUUFBUTtBQUFBLElBQ1Q7QUFDQSxlQUFXLHFCQUFxQixPQUFPLFlBQW9EO0FBQzFGLGlCQUFXLEtBQUssT0FBTztBQUN2QixhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sZUFBZSxpQkFBaUIsZ0JBQWdCLGFBQWEsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUM1RSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsd0JBQXdCO0FBQUEsUUFDcEQsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNUO0FBQUEsTUFDRCxDQUFDO0FBQ0QsMkJBQXFCLEtBQUssZUFBZTtBQUFBLFFBQ3hDLFVBQVUsWUFBWTtBQUFBLFFBQ3RCLDJCQUEyQixNQUFNO0FBQUEsUUFDakMsb0NBQW9DLE1BQU07QUFBQSxNQUMzQyxDQUE2QjtBQUM3QixZQUFNLGVBQWUsTUFBTSxJQUFJLHFCQUFxQixlQUFlLHVCQUF1QixDQUFDO0FBQzNGLDJCQUFxQixLQUFLLDBCQUEwQixZQUFZO0FBRWhFLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsc0JBQXNCO0FBQUEsUUFDaEYsSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLE1BQ1IsQ0FBQyxDQUFDO0FBQ0YsV0FBSyxPQUFPO0FBQ1osWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVjtBQUFBLFFBQ0EsU0FBUztBQUFBLE1BQ1YsQ0FBQztBQUNELFlBQU0sUUFBUSxFQUFFO0FBQ2hCLDRCQUFzQixJQUFJO0FBRTFCLFlBQU0sYUFBYSxLQUFLLFFBQVEsY0FBYywyQkFBMkI7QUFDekUsYUFBTyxZQUFZLFlBQVksTUFBTSxTQUFTLEVBQUU7QUFFaEQsWUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFlBQU0sUUFBUSxFQUFFO0FBQ2hCLGFBQU8sWUFBWSxXQUFXLFFBQVEsQ0FBQztBQUN2QyxhQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsRUFBRTtBQUFBLElBQ2pELFVBQUU7QUFDRCxtQkFBYSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDJGQUEyRixpQkFBa0I7QUFDakgsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLDhDQUE4QztBQUNyRixVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sa0RBQWtEO0FBQ3pGLFVBQU0sYUFBdUQsQ0FBQztBQUM5RCxVQUFNLGFBQWEsaUNBQWlDLENBQUMsR0FBRyxZQUFZLEtBQUs7QUFDekUsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFFBQUk7QUFDSCxZQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxRQUNwRCxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1Q7QUFBQSxNQUNELENBQUM7QUFDRCxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLDRCQUE0QixJQUFJLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUNsSCxZQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsZUFBUyxLQUFLLFlBQVksTUFBTTtBQUNoQyxZQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sT0FBTyxPQUFPLEVBQUUsQ0FBQztBQUM1QyxXQUFLLE9BQU8sTUFBTTtBQUNsQixZQUFNLFFBQVEsTUFBTSxJQUFJLElBQUksNEJBQTRCLFVBQVUsVUFBVSxhQUFhLENBQUM7QUFDMUYsWUFBTSxLQUFLLFNBQVMsT0FBTyxRQUFXLHVCQUFPLE9BQU8sSUFBSSxHQUFHLGtCQUFrQixJQUFJO0FBQ2pGLFlBQU0sUUFBUSxFQUFFO0FBQ2hCLDZCQUF1QixJQUFJO0FBRTNCLFlBQU0sY0FBYyxPQUFPLGNBQWMsaUNBQWlDO0FBQzFFLFlBQU0sZ0JBQWdCLE9BQU8sY0FBYyxtQ0FBbUM7QUFDOUUsYUFBTyxZQUFZLGFBQWEsTUFBTSxTQUFTLEVBQUU7QUFFakQsWUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFlBQU0sUUFBUSxFQUFFO0FBQ2hCLGFBQU8sWUFBWSxXQUFXLFFBQVEsQ0FBQztBQUN2QyxhQUFPLFlBQVksYUFBYSxNQUFNLFNBQVMsTUFBTTtBQUNyRCxhQUFPLEdBQUcsQ0FBQyxpQkFBaUIsY0FBYyxNQUFNLFlBQVksTUFBTTtBQUVsRSxZQUFNLGdCQUFnQixXQUFXLEtBQUssTUFBTSwyQ0FBMkM7QUFDdkYsWUFBTSxnQkFBZ0IsV0FBVyxLQUFLLE1BQU0sK0NBQStDO0FBQzNGLFlBQU0sYUFBYSxNQUFNLElBQUksSUFBSSw0QkFBNEIsZUFBZSxlQUFlLGFBQWEsQ0FBQztBQUN6RyxZQUFNLEtBQUssU0FBUyxZQUFZLFFBQVcsdUJBQU8sT0FBTyxJQUFJLEdBQUcsa0JBQWtCLElBQUk7QUFDdEYsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNkJBQXVCLElBQUk7QUFDM0IsYUFBTyxZQUFZLGFBQWEsTUFBTSxTQUFTLEVBQUU7QUFBQSxJQUNsRCxVQUFFO0FBQ0QsbUJBQWEsUUFBUTtBQUFBLElBQ3RCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxpRUFBaUUsaUJBQWtCO0FBQ3ZGLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSwwQ0FBMEM7QUFDakYsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLDhDQUE4QztBQUNyRixVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxhQUFhLGlDQUFpQyxDQUFDLEdBQUcsWUFBWSxLQUFLO0FBQ3pFLFVBQU0sY0FBZ0Q7QUFBQSxNQUNyRCxXQUFXO0FBQUEsTUFDWCxRQUFRO0FBQUEsTUFDUixTQUFTO0FBQUEsTUFDVCxjQUFjO0FBQUEsTUFDZCxVQUFVO0FBQUEsTUFDVixRQUFRO0FBQUEsSUFDVDtBQUNBLGVBQVcscUJBQXFCLE9BQU8sWUFBb0Q7QUFDMUYsaUJBQVcsS0FBSyxPQUFPO0FBQ3ZCLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFFBQUk7QUFDSCxZQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxRQUNwRCxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1Q7QUFBQSxNQUNELENBQUM7QUFDRCxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLDRCQUE0QixJQUFJLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUNsSCxZQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsZUFBUyxLQUFLLFlBQVksTUFBTTtBQUNoQyxZQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sT0FBTyxPQUFPLEVBQUUsQ0FBQztBQUM1QyxXQUFLLE9BQU8sTUFBTTtBQUNsQixZQUFNLFFBQVEsTUFBTSxJQUFJLElBQUksNEJBQTRCLFVBQVUsVUFBVSxhQUFhLENBQUM7QUFDMUYsWUFBTSxLQUFLLFNBQVMsT0FBTyxRQUFXLHVCQUFPLE9BQU8sSUFBSSxHQUFHLGtCQUFrQixJQUFJO0FBQ2pGLFlBQU0sUUFBUSxFQUFFO0FBQ2hCLDZCQUF1QixJQUFJO0FBRTNCLFlBQU0sY0FBYyxPQUFPLGNBQWMsaUNBQWlDO0FBQzFFLGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxFQUFFO0FBRWpELFlBQU8sS0FBc0QsU0FBUztBQUN0RSxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLFlBQVksV0FBVyxRQUFRLENBQUM7QUFDdkMsYUFBTyxZQUFZLGFBQWEsTUFBTSxTQUFTLEVBQUU7QUFBQSxJQUNsRCxVQUFFO0FBQ0QsbUJBQWEsUUFBUTtBQUFBLElBQ3RCO0FBQUEsRUFDRCxDQUFDO0FBRUQsV0FBUyx1QkFBdUIsTUFBd0M7QUFDdkUsVUFBTSxPQUFPO0FBQ2IsU0FBSyx1QkFBdUI7QUFDNUIsU0FBSyxvQkFBb0I7QUFBQSxFQUMxQjtBQUVBLFdBQVMsMkJBQ1Isc0JBQ0EsWUFBWSxhQUNMO0FBQ1AseUJBQXFCLEtBQUssc0JBQXNCO0FBQUEsTUFDL0MsYUFBYSxNQUFNO0FBQUEsTUFDbkIsYUFBYSxPQUFPO0FBQUEsUUFDbkIsWUFBWTtBQUFBLFFBQ1osU0FBUztBQUFBLFFBQ1QsT0FBTyxFQUFFLE1BQU0sZUFBZSxVQUFVO0FBQUEsUUFDeEMsU0FBUyxDQUFDO0FBQUEsTUFDWDtBQUFBLE1BQ0EsZUFBZSxNQUFNO0FBQUEsTUFDckIsdUJBQXVCLE1BQU07QUFBQSxNQUM3QixTQUFTLFlBQVk7QUFBQSxNQUNyQixpQkFBaUIsTUFBTTtBQUFBLE1BQ3ZCLHVCQUF1QixNQUFNO0FBQUEsSUFDOUIsQ0FBb0M7QUFBQSxFQUNyQztBQUVBLE9BQUssc0ZBQXNGLGlCQUFrQjtBQUM1RyxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sb0NBQW9DO0FBQzNFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSx3Q0FBd0M7QUFDL0UsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sYUFBdUQsQ0FBQztBQUM5RCxVQUFNLG1CQUE4QixDQUFDO0FBQ3JDLFVBQU0sYUFBYSxpQ0FBaUMsWUFBWSxVQUFVO0FBQzFFLFdBQU8sWUFBWSxXQUFXLGtCQUFrQixHQUFHLE1BQU0sa0VBQWtFO0FBQzNILFdBQU8sWUFBWSxXQUFXLHNCQUFzQixFQUFFLGdCQUFnQixJQUFJO0FBQzFFLFdBQU8sWUFBWSwwQkFBMEIsVUFBVSxHQUFHLElBQUk7QUFFOUQsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFFBQUk7QUFDSCxZQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxRQUNwRCxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1Q7QUFBQSxRQUNBLGdCQUFnQixPQUFPLGNBQXVCO0FBQzdDLGNBQUksY0FBYyxhQUFhO0FBQzlCLDZCQUFpQixLQUFLLFNBQVM7QUFBQSxVQUNoQztBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCwyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFFMUIsWUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxhQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsTUFBTTtBQUNwRCxpQkFBVyxVQUFVO0FBQ3JCLFlBQU8sS0FBc0QsU0FBUztBQUN0RSxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLGdCQUFnQixrQkFBa0IsQ0FBQyxDQUFDO0FBRTNDLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ2xILFlBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxlQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFlBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFdBQUssT0FBTyxNQUFNO0FBQ2xCLFlBQU0sUUFBUSxNQUFNLElBQUksSUFBSSw0QkFBNEIsVUFBVSxVQUFVLGFBQWEsQ0FBQztBQUMxRixZQUFNLEtBQUssU0FBUyxPQUFPLFFBQVcsdUJBQU8sT0FBTyxJQUFJLEdBQUcsa0JBQWtCLElBQUk7QUFDakYsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNkJBQXVCLElBQUk7QUFFM0IsWUFBTSxjQUFjLE9BQU8sY0FBYyxpQ0FBaUM7QUFDMUUsYUFBTyxZQUFZLGFBQWEsTUFBTSxTQUFTLE1BQU07QUFDckQsaUJBQVcsV0FBVztBQUN0QixZQUFPLEtBQXNELFNBQVM7QUFDdEUsWUFBTSxRQUFRLEVBQUU7QUFDaEIsYUFBTyxnQkFBZ0IsWUFBWSxDQUFDLENBQUM7QUFDckMsYUFBTyxnQkFBZ0Isa0JBQWtCLENBQUMsQ0FBQztBQUMzQyxhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUFBLElBQ3RDLFVBQUU7QUFDRCxtQkFBYSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHVHQUF1RyxpQkFBa0I7QUFDN0gsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGtDQUFrQztBQUN6RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sc0NBQXNDO0FBQzdFLFVBQU0sb0JBQThCLENBQUM7QUFDckMsVUFBTSxhQUFhLDRCQUE0QixJQUFJO0FBQ25ELFdBQU8sWUFBWSxXQUFXLGtCQUFrQixHQUFHLElBQUk7QUFDdkQsV0FBTyxZQUFZLFdBQVcsc0JBQXNCLEVBQUUsZ0JBQWdCLElBQUk7QUFDMUUsV0FBTyxZQUFZLDBCQUEwQixVQUFVLEdBQUcsSUFBSTtBQUU5RCxVQUFNLGlCQUFpQixpQkFBaUIsZ0JBQWdCLGVBQWUsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUNoRixVQUFNLGVBQWUsaUJBQWlCLGdCQUFnQixhQUFhLE1BQU07QUFBQSxJQUFFLENBQUM7QUFDNUUsUUFBSTtBQUNILFlBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLFFBQ3BELGFBQWE7QUFBQSxRQUNiO0FBQUEsUUFDQSxTQUFTO0FBQUEsUUFDVDtBQUFBLFFBQ0EsZ0JBQWdCLE9BQU8sY0FBdUI7QUFDN0MsY0FBSSxjQUFjLGlCQUFpQixjQUFjLGFBQWE7QUFDN0QsOEJBQWtCLEtBQUssT0FBTyxTQUFTLENBQUM7QUFBQSxVQUN6QztBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCwyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFFMUIsWUFBTSxjQUFjLEtBQUssUUFBUSxjQUFjLDRCQUE0QjtBQUMzRSxZQUFNLGVBQWUsS0FBSyxRQUFRLGNBQWMsNkJBQTZCO0FBQzdFLGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxNQUFNO0FBQ3JELGFBQU8sWUFBWSxjQUFjLE1BQU0sU0FBUyxNQUFNO0FBQ3RELGlCQUFXLFdBQVc7QUFDdEIsaUJBQVcsWUFBWTtBQUN2QixZQUFPLEtBQTJFLGFBQWEsV0FBVztBQUMxRyxZQUFPLEtBQTJFLGFBQWEsYUFBYTtBQUM1RyxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLFlBQVksa0JBQWtCLFFBQVEsQ0FBQztBQUU5QyxZQUFNLHFCQUFxQix3QkFBd0I7QUFBQSxRQUNsRCxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1Q7QUFBQSxRQUNBLGdCQUFnQixPQUFPLGNBQXVCO0FBQzdDLGNBQUksY0FBYyxpQkFBaUIsY0FBYyxhQUFhO0FBQzdELDhCQUFrQixLQUFLLE9BQU8sU0FBUyxDQUFDO0FBQUEsVUFDekM7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQ0QseUJBQW1CLEtBQUssZUFBZTtBQUFBLFFBQ3RDLFVBQVUsWUFBWTtBQUFBLFFBQ3RCLDJCQUEyQixNQUFNO0FBQUEsUUFDakMsb0NBQW9DLE1BQU07QUFBQSxNQUMzQyxDQUE2QjtBQUM3QixZQUFNLG9CQUFvQixNQUFNLElBQUksbUJBQW1CLGVBQWUsdUJBQXVCLENBQUM7QUFDOUYseUJBQW1CLEtBQUssMEJBQTBCLGlCQUFpQjtBQUNuRSxZQUFNLFlBQVksTUFBTSxJQUFJLG1CQUFtQixlQUFlLHNCQUFzQjtBQUFBLFFBQ25GLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLGdCQUFVLE9BQU87QUFDakIsWUFBTSxrQkFBa0IsS0FBSztBQUFBLFFBQzVCLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLFNBQVM7QUFDL0IsWUFBTSxlQUFlLFVBQVUsUUFBUSxjQUFjLDZCQUE2QjtBQUNsRixhQUFPLFlBQVksY0FBYyxNQUFNLFNBQVMsTUFBTTtBQUN0RCxpQkFBVyxZQUFZO0FBQ3ZCLFlBQU8sVUFBZ0YsYUFBYSxhQUFhO0FBQ2pILFlBQU0sUUFBUSxFQUFFO0FBQ2hCLGFBQU8sZ0JBQWdCLG1CQUFtQixDQUFDLENBQUM7QUFFNUMsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSw0QkFBNEIsSUFBSSxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7QUFDbEgsWUFBTSxTQUFTLFNBQVMsY0FBYyxLQUFLO0FBQzNDLGVBQVMsS0FBSyxZQUFZLE1BQU07QUFDaEMsWUFBTSxJQUFJLEVBQUUsU0FBUyxNQUFNLE9BQU8sT0FBTyxFQUFFLENBQUM7QUFDNUMsV0FBSyxPQUFPLE1BQU07QUFDbEIsWUFBTSxRQUFRLE1BQU0sSUFBSSxJQUFJLDRCQUE0QixVQUFVLFVBQVUsYUFBYSxDQUFDO0FBQzFGLFlBQU0sS0FBSyxTQUFTLE9BQU8sUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUNqRixZQUFNLFFBQVEsRUFBRTtBQUNoQiw2QkFBdUIsSUFBSTtBQUUzQixZQUFNLGVBQWUsT0FBTyxjQUFjLGtDQUFrQztBQUM1RSxZQUFNLGdCQUFnQixPQUFPLGNBQWMsbUNBQW1DO0FBQzlFLGFBQU8sWUFBWSxjQUFjLE1BQU0sU0FBUyxNQUFNO0FBQ3RELGFBQU8sWUFBWSxlQUFlLE1BQU0sU0FBUyxNQUFNO0FBQ3ZELGlCQUFXLFlBQVk7QUFDdkIsaUJBQVcsYUFBYTtBQUN4QixZQUFPLEtBQTJFLGFBQWEsV0FBVztBQUMxRyxZQUFPLEtBQTJFLGFBQWEsYUFBYTtBQUM1RyxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLGdCQUFnQixtQkFBbUIsQ0FBQyxDQUFDO0FBQUEsSUFDN0MsVUFBRTtBQUNELHFCQUFlLFFBQVE7QUFDdkIsbUJBQWEsUUFBUTtBQUFBLElBQ3RCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx5RkFBeUYsaUJBQWtCO0FBQy9HLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSwrQkFBK0I7QUFDdEUsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLG1DQUFtQztBQUMxRSxVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sb0JBQThCLENBQUM7QUFDckMsVUFBTSxhQUFhLGlDQUFpQyxZQUFZLFlBQVksS0FBSztBQUNqRixXQUFPLFlBQVksV0FBVyxrQkFBa0IsR0FBRyxJQUFJO0FBQ3ZELFdBQU8sWUFBWSxXQUFXLHNCQUFzQixFQUFFLGdCQUFnQixLQUFLO0FBQzNFLFdBQU8sWUFBWSwwQkFBMEIsVUFBVSxHQUFHLEtBQUs7QUFFL0QsVUFBTSxpQkFBaUIsaUJBQWlCLGdCQUFnQixlQUFlLE1BQU07QUFBQSxJQUFFLENBQUM7QUFDaEYsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFVBQU0sZUFBZSxpQkFBaUIsZ0JBQWdCLGFBQWEsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUM1RSxRQUFJO0FBQ0gsWUFBTSx1QkFBdUIsd0JBQXdCO0FBQUEsUUFDcEQsYUFBYTtBQUFBLFFBQ2I7QUFBQSxRQUNBLFNBQVM7QUFBQSxRQUNUO0FBQUEsUUFDQSxvQkFBb0I7QUFBQSxRQUNwQixnQkFBZ0IsT0FBTyxjQUF1QjtBQUM3QyxjQUFJLGNBQWMsaUJBQWlCLGNBQWMsZUFBZSxjQUFjLGFBQWE7QUFDMUYsOEJBQWtCLEtBQUssT0FBTyxTQUFTLENBQUM7QUFBQSxVQUN6QztBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCwyQkFBcUIsZUFBZSxjQUFZO0FBQy9DLGVBQU8sWUFBWSxTQUFTLElBQUksMEJBQTBCLEVBQUUscUJBQXFCLEdBQUcsS0FBSztBQUFBLE1BQzFGLENBQUM7QUFDRCwyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFFMUIsWUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxZQUFNLGNBQWMsS0FBSyxRQUFRLGNBQWMsNEJBQTRCO0FBQzNFLFlBQU0sZUFBZSxLQUFLLFFBQVEsY0FBYyw2QkFBNkI7QUFDN0UsYUFBTyxZQUFZLFlBQVksTUFBTSxTQUFTLE1BQU07QUFDcEQsYUFBTyxZQUFZLGFBQWEsTUFBTSxTQUFTLE1BQU07QUFDckQsYUFBTyxHQUFHLENBQUMsZ0JBQWdCLGFBQWEsTUFBTSxZQUFZLE1BQU07QUFDaEUsaUJBQVcsVUFBVTtBQUNyQixpQkFBVyxXQUFXO0FBQ3RCLFlBQU8sS0FBc0QsU0FBUztBQUN0RSxZQUFPLEtBQTJFLGFBQWEsV0FBVztBQUMxRyxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLGdCQUFnQixtQkFBbUIsQ0FBQyxDQUFDO0FBRTVDLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ2xILFlBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxlQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFlBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFdBQUssT0FBTyxNQUFNO0FBQ2xCLFlBQU0sUUFBUSxNQUFNLElBQUksSUFBSSw0QkFBNEIsVUFBVSxVQUFVLGFBQWEsQ0FBQztBQUMxRixZQUFNLEtBQUssU0FBUyxPQUFPLFFBQVcsdUJBQU8sT0FBTyxJQUFJLEdBQUcsa0JBQWtCLElBQUk7QUFDakYsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNkJBQXVCLElBQUk7QUFFM0IsWUFBTSxjQUFjLE9BQU8sY0FBYyxpQ0FBaUM7QUFDMUUsWUFBTSxlQUFlLE9BQU8sY0FBYyxrQ0FBa0M7QUFDNUUsYUFBTyxZQUFZLGFBQWEsTUFBTSxTQUFTLE1BQU07QUFDckQsYUFBTyxZQUFZLGNBQWMsTUFBTSxTQUFTLE1BQU07QUFDdEQsaUJBQVcsV0FBVztBQUN0QixpQkFBVyxZQUFZO0FBQ3ZCLFlBQU8sS0FBc0QsU0FBUztBQUN0RSxZQUFPLEtBQTJFLGFBQWEsYUFBYTtBQUM1RyxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLGdCQUFnQixtQkFBbUIsQ0FBQyxDQUFDO0FBQUEsSUFDN0MsVUFBRTtBQUNELHFCQUFlLFFBQVE7QUFDdkIsbUJBQWEsUUFBUTtBQUNyQixtQkFBYSxRQUFRO0FBQUEsSUFDdEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHlGQUF5RixpQkFBa0I7QUFDL0csVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLHVDQUF1QztBQUM5RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sMkNBQTJDO0FBQ2xGLFVBQU0sb0JBQThCLENBQUM7QUFDckMsVUFBTSxhQUFhLDRCQUE0QixLQUFLO0FBQ3BELFdBQU8sWUFBWSxXQUFXLGtCQUFrQixHQUFHLElBQUk7QUFDdkQsV0FBTyxZQUFZLFdBQVcsc0JBQXNCLEVBQUUsZ0JBQWdCLEtBQUs7QUFDM0UsV0FBTyxZQUFZLDBCQUEwQixVQUFVLEdBQUcsS0FBSztBQUUvRCxVQUFNLGlCQUFpQixpQkFBaUIsZ0JBQWdCLGVBQWUsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUNoRixVQUFNLGVBQWUsaUJBQWlCLGdCQUFnQixhQUFhLE1BQU07QUFBQSxJQUFFLENBQUM7QUFDNUUsUUFBSTtBQUNILFlBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLFFBQ3BELGFBQWE7QUFBQSxRQUNiO0FBQUEsUUFDQSxTQUFTO0FBQUEsUUFDVDtBQUFBLFFBQ0EsZ0JBQWdCLE9BQU8sY0FBdUI7QUFDN0MsY0FBSSxjQUFjLGlCQUFpQixjQUFjLGFBQWE7QUFDN0QsOEJBQWtCLEtBQUssT0FBTyxTQUFTLENBQUM7QUFBQSxVQUN6QztBQUFBLFFBQ0Q7QUFBQSxNQUNELENBQUM7QUFDRCwyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVU7QUFBQSxRQUNWO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVixDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFFMUIsWUFBTSxjQUFjLEtBQUssUUFBUSxjQUFjLDRCQUE0QjtBQUMzRSxhQUFPLFlBQVksYUFBYSxNQUFNLFNBQVMsRUFBRTtBQUNqRCxZQUFPLEtBQTJFLGFBQWEsV0FBVztBQUMxRyxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLGdCQUFnQixtQkFBbUIsQ0FBQyxXQUFXLENBQUM7QUFFdkQsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSw0QkFBNEIsSUFBSSxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7QUFDbEgsWUFBTSxTQUFTLFNBQVMsY0FBYyxLQUFLO0FBQzNDLGVBQVMsS0FBSyxZQUFZLE1BQU07QUFDaEMsWUFBTSxJQUFJLEVBQUUsU0FBUyxNQUFNLE9BQU8sT0FBTyxFQUFFLENBQUM7QUFDNUMsV0FBSyxPQUFPLE1BQU07QUFDbEIsWUFBTSxRQUFRLE1BQU0sSUFBSSxJQUFJLDRCQUE0QixVQUFVLFVBQVUsYUFBYSxDQUFDO0FBQzFGLFlBQU0sS0FBSyxTQUFTLE9BQU8sUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUNqRixZQUFNLFFBQVEsRUFBRTtBQUNoQiw2QkFBdUIsSUFBSTtBQUUzQixZQUFNLGVBQWUsT0FBTyxjQUFjLGtDQUFrQztBQUM1RSxhQUFPLFlBQVksY0FBYyxNQUFNLFNBQVMsRUFBRTtBQUNsRCxZQUFPLEtBQTJFLGFBQWEsYUFBYTtBQUM1RyxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLGdCQUFnQixtQkFBbUIsQ0FBQyxhQUFhLGFBQWEsQ0FBQztBQUFBLElBQ3ZFLFVBQUU7QUFDRCxxQkFBZSxRQUFRO0FBQ3ZCLG1CQUFhLFFBQVE7QUFBQSxJQUN0QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssd0RBQXdELGlCQUFrQjtBQUM5RSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0scUNBQXFDO0FBQzVFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSx5Q0FBeUM7QUFDaEYsUUFBSSxlQUFlO0FBQ25CLFVBQU0saUJBQWlCLGlCQUFpQixnQkFBZ0IsZUFBZSxNQUFNO0FBQUU7QUFBQSxJQUFnQixDQUFDO0FBQ2hHLFFBQUk7QUFDSCxZQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxRQUNwRCxhQUFhO0FBQUEsUUFDYjtBQUFBLFFBQ0EsU0FBUztBQUFBLFFBQ1QsZ0JBQWdCLE9BQU8sY0FBdUI7QUFDN0MsY0FBSSxjQUFjLGVBQWU7QUFDaEM7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELDJCQUFxQixLQUFLLHNCQUFzQjtBQUFBLFFBQy9DLGFBQWEsTUFBTTtBQUFBLFFBQ25CLGFBQWEsT0FBTztBQUFBLFVBQ25CLFlBQVk7QUFBQSxVQUNaLFNBQVM7QUFBQSxVQUNULE9BQU8sRUFBRSxNQUFNLG1CQUFtQixXQUFXLGFBQWEsUUFBUSxjQUFjO0FBQUEsVUFDaEYsU0FBUyxDQUFDO0FBQUEsUUFDWDtBQUFBLFFBQ0EsZUFBZSxNQUFNO0FBQUEsUUFDckIsdUJBQXVCLE1BQU07QUFBQSxRQUM3QixTQUFTLFlBQVk7QUFBQSxRQUNyQixpQkFBaUIsTUFBTTtBQUFBLFFBQ3ZCLHVCQUF1QixNQUFNO0FBQUEsTUFDOUIsQ0FBb0M7QUFDcEMsMkJBQXFCLEtBQUssZUFBZTtBQUFBLFFBQ3hDLFVBQVUsWUFBWTtBQUFBLFFBQ3RCLDJCQUEyQixNQUFNO0FBQUEsUUFDakMsb0NBQW9DLE1BQU07QUFBQSxNQUMzQyxDQUE2QjtBQUM3QixZQUFNLGVBQWUsTUFBTSxJQUFJLHFCQUFxQixlQUFlLHVCQUF1QixDQUFDO0FBQzNGLDJCQUFxQixLQUFLLDBCQUEwQixZQUFZO0FBRWhFLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsc0JBQXNCO0FBQUEsUUFDaEYsSUFBSTtBQUFBLFFBQ0osT0FBTztBQUFBLE1BQ1IsQ0FBQyxDQUFDO0FBQ0YsV0FBSyxPQUFPO0FBQ1osWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVjtBQUFBLFFBQ0EsU0FBUztBQUFBLE1BQ1YsQ0FBQztBQUNELFlBQU0sUUFBUSxFQUFFO0FBQ2hCLDRCQUFzQixJQUFJO0FBQzFCLFlBQU8sS0FBMkUsYUFBYSxhQUFhO0FBRTVHLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ2xILFlBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxlQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFlBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFdBQUssT0FBTyxNQUFNO0FBQ2xCLFlBQU0sUUFBUSxNQUFNLElBQUksSUFBSSw0QkFBNEIsVUFBVSxVQUFVLE9BQU8sQ0FBQztBQUNwRixZQUFNLEtBQUssU0FBUyxPQUFPLFFBQVcsdUJBQU8sT0FBTyxJQUFJLEdBQUcsa0JBQWtCLElBQUk7QUFDakYsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNkJBQXVCLElBQUk7QUFDM0IsWUFBTyxLQUEyRSxhQUFhLGFBQWE7QUFDNUcsWUFBTSxRQUFRLEVBQUU7QUFDaEIsYUFBTyxZQUFZLGNBQWMsQ0FBQztBQUFBLElBQ25DLFVBQUU7QUFDRCxxQkFBZSxRQUFRO0FBQUEsSUFDeEI7QUFBQSxFQUNELENBQUM7QUFFRCxXQUFTLGlDQUEyRDtBQUNuRSxXQUFPO0FBQUEsTUFDTixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxlQUF3QjtBQUFBLE1BQzNELHVCQUF1QixPQUFPLENBQUM7QUFBQSxNQUMvQix1QkFBdUIsTUFBTTtBQUFBLElBQzlCO0FBQUEsRUFDRDtBQUVBLGlCQUFlLGdDQUFnQ0EsT0FBcUIsVUFXaEUsQ0FBQyxHQUF1RTtBQUMzRSxVQUFNLFdBQVcsV0FBVyxLQUFLQSxPQUFNLDZCQUE2QjtBQUNwRSxVQUFNLFdBQVcsV0FBVyxLQUFLQSxPQUFNLGlDQUFpQztBQUN4RSxVQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxNQUNwRCxhQUFhO0FBQUEsTUFDYjtBQUFBLE1BQ0EsU0FBUyxRQUFRO0FBQUEsTUFDakIsZ0JBQWdCLFFBQVE7QUFBQSxNQUN4QixZQUFZLFFBQVEsY0FBYywrQkFBK0I7QUFBQSxJQUNsRSxDQUFDO0FBQ0QsVUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSw0QkFBNEIsSUFBSSxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7QUFDbEgsVUFBTSxTQUFTLFNBQVMsY0FBYyxLQUFLO0FBQzNDLGFBQVMsS0FBSyxZQUFZLE1BQU07QUFDaEMsVUFBTSxJQUFJLEVBQUUsU0FBUyxNQUFNLE9BQU8sT0FBTyxFQUFFLENBQUM7QUFDNUMsU0FBSyxPQUFPLE1BQU07QUFDbEIsVUFBTSxRQUFRLE1BQU0sSUFBSSxJQUFJLDRCQUE0QixVQUFVLFVBQVUsUUFBUSxXQUFXLGVBQWUsUUFBUSxRQUFRLENBQUM7QUFDL0gsVUFBTSxLQUFLLFNBQVMsT0FBTyxRQUFXLHVCQUFPLE9BQU8sSUFBSSxHQUFHLGtCQUFrQixJQUFJO0FBQ2pGLFdBQU8sRUFBRSxNQUFNLE9BQU87QUFBQSxFQUN2QjtBQUVBLFdBQVMsb0JBQW9CLE1BQWtDLFdBQXdCO0FBQ3RGLElBQUMsS0FBMEQsYUFBYSxNQUFNO0FBQzdFLFlBQU07QUFBQSxJQUNQO0FBQUEsRUFDRDtBQUVBLE9BQUsseUhBQXlILGlCQUFrQjtBQUMvSSxVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxpQ0FBaUMsV0FBVyxZQUFZO0FBQzdELFlBQU0sRUFBRSxNQUFNLE9BQU8sSUFBSSxNQUFNLGdDQUFnQyxNQUFNO0FBQUEsUUFDcEUsZ0JBQWdCLFlBQVk7QUFDM0IsZ0JBQU0sSUFBSSxNQUFNLFVBQVU7QUFBQSxRQUMzQjtBQUFBLE1BQ0QsQ0FBQztBQUNELDBCQUFvQixNQUFNLFNBQVM7QUFDbkMsaUJBQVcsT0FBTyxjQUFjLGtDQUFrQyxDQUFDO0FBQUEsSUFDcEUsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssMEhBQTBILGlCQUFrQjtBQUNoSixVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxpQ0FBaUMsV0FBVyxZQUFZO0FBQzdELFlBQU0sRUFBRSxNQUFNLE9BQU8sSUFBSSxNQUFNLGdDQUFnQyxNQUFNO0FBQUEsUUFDcEUsU0FBUztBQUFBLFFBQ1QsZ0JBQWdCLFlBQVk7QUFDM0IsZ0JBQU0sSUFBSSxNQUFNLFVBQVU7QUFBQSxRQUMzQjtBQUFBLE1BQ0QsQ0FBQztBQUNELDBCQUFvQixNQUFNLFNBQVM7QUFDbkMsaUJBQVcsT0FBTyxjQUFjLG1DQUFtQyxDQUFDO0FBQUEsSUFDckUsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssd0hBQXdILGlCQUFrQjtBQUM5SSxVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxpQ0FBaUMsV0FBVyxZQUFZO0FBQzdELFlBQU0sRUFBRSxNQUFNLE9BQU8sSUFBSSxNQUFNLGdDQUFnQyxNQUFNO0FBQUEsUUFDcEUsZ0JBQWdCLFlBQVk7QUFDM0IsZ0JBQU0sSUFBSSxNQUFNLFVBQVU7QUFBQSxRQUMzQjtBQUFBLE1BQ0QsQ0FBQztBQUNELDBCQUFvQixNQUFNLFNBQVM7QUFDbkMsaUJBQVcsT0FBTyxjQUFjLGlDQUFpQyxDQUFDO0FBQUEsSUFDbkUsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUsseUhBQXlILGlCQUFrQjtBQUMvSSxVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxpQ0FBaUMsV0FBVyxZQUFZO0FBQzdELFlBQU0sYUFBYSw0QkFBNEIsS0FBSztBQUNwRCxNQUFDLFdBQTBELGtCQUFrQixZQUFZO0FBQ3hGLGNBQU0sSUFBSSxNQUFNLFdBQVc7QUFBQSxNQUM1QjtBQUNBLFlBQU0sRUFBRSxNQUFNLE9BQU8sSUFBSSxNQUFNLGdDQUFnQyxNQUFNO0FBQUEsUUFDcEU7QUFBQSxRQUNBLFVBQVU7QUFBQSxVQUNULFFBQVE7QUFBQSxVQUNSLFdBQVc7QUFBQSxVQUNYLFNBQVM7QUFBQSxVQUNULFlBQVk7QUFBQSxVQUNaLE1BQU07QUFBQSxRQUNQO0FBQUEsTUFDRCxDQUFDO0FBQ0QsTUFBQyxLQUFvRSxlQUFlLEVBQUUsTUFBTSxPQUFPLE1BQU0sRUFBRTtBQUMzRywwQkFBb0IsTUFBTSxTQUFTO0FBQ25DLGlCQUFXLE9BQU8sY0FBYyxrQ0FBa0MsQ0FBQztBQUNuRSxZQUFNLFFBQVEsRUFBRTtBQUFBLElBQ2pCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGlIQUFpSCxpQkFBa0I7QUFDdkksVUFBTSxjQUFjLElBQUksTUFBTSxjQUFjO0FBQzVDLFVBQU0saUNBQWlDLGFBQWEsWUFBWTtBQUMvRCxZQUFNLEVBQUUsT0FBTyxJQUFJLE1BQU0sZ0NBQWdDLE1BQU07QUFBQSxRQUM5RCxnQkFBZ0IsWUFBWTtBQUMzQixnQkFBTTtBQUFBLFFBQ1A7QUFBQSxNQUNELENBQUM7QUFDRCxZQUFNLFNBQVMsT0FBTyxjQUFjLHVDQUF1QztBQUMzRSxhQUFPLEdBQUcsTUFBTTtBQUNoQixhQUFPLGVBQWUsUUFBUSxlQUFlLEVBQUUsY0FBYyxNQUFNLEtBQUssTUFBTTtBQUFFLGNBQU07QUFBQSxNQUFhLEVBQUUsQ0FBQztBQUN0RyxVQUFJO0FBQ0gsbUJBQVcsT0FBTyxjQUFjLHdDQUF3QyxDQUFDO0FBQ3pFLGNBQU0sUUFBUSxDQUFDO0FBQUEsTUFDaEIsVUFBRTtBQUNELGdCQUFRLGVBQWUsUUFBUSxhQUFhO0FBQUEsTUFDN0M7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGtIQUFrSCxpQkFBa0I7QUFDeEksVUFBTSxZQUFZLElBQUksTUFBTSxZQUFZO0FBQ3hDLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSw0QkFBNEI7QUFDbkUsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGdDQUFnQztBQUN2RSxVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sYUFBYSxpQ0FBaUMsWUFBWSxZQUFZLEtBQUs7QUFDakYsZUFBVyxxQkFBcUIsT0FBTyxZQUFvRDtBQUMxRixpQkFBVyxLQUFLLE9BQU87QUFDdkIsWUFBTSxJQUFJLE1BQU0sWUFBWTtBQUFBLElBQzdCO0FBRUEsVUFBTSxpQ0FBaUMsV0FBVyxZQUFZO0FBQzdELFlBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLFFBQ3BELGFBQWE7QUFBQSxRQUNiO0FBQUEsUUFDQTtBQUFBLE1BQ0QsQ0FBQztBQUNELDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLFFBQ2hGLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTztBQUNaLFlBQU0sYUFBYSxLQUFLO0FBQUEsUUFDdkIsVUFBVTtBQUFBLFFBQ1Y7QUFBQSxRQUNBLFNBQVM7QUFBQSxNQUNWLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUNoQiw0QkFBc0IsSUFBSTtBQUMxQixNQUFDLEtBQWdFLG1CQUFtQixNQUFNO0FBQ3pGLGNBQU07QUFBQSxNQUNQO0FBQ0EsaUJBQVcsS0FBSyxRQUFRLGNBQWMsMkJBQTJCLENBQTZCO0FBQzlGLFlBQU0sUUFBUSxFQUFFO0FBQUEsSUFDakIsQ0FBQztBQUNELFdBQU8sWUFBWSxXQUFXLFFBQVEsQ0FBQztBQUN2QyxXQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUFBLEVBQ3RDLENBQUM7QUFFRCxPQUFLLHNIQUFzSCxpQkFBa0I7QUFDNUksVUFBTSxZQUFZLElBQUksTUFBTSxZQUFZO0FBQ3hDLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSw2QkFBNkI7QUFDcEUsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGlDQUFpQztBQUV4RSxVQUFNLGlDQUFpQyxXQUFXLFlBQVk7QUFDN0QsWUFBTSx1QkFBdUIsd0JBQXdCLEVBQUUsYUFBYSxNQUFNLFNBQVMsQ0FBQztBQUNwRiwyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFFaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixNQUFDLEtBQThELGlCQUFpQixNQUFNO0FBQ3JGLGNBQU07QUFBQSxNQUNQO0FBQ0EsWUFBTSxhQUFhLEtBQUs7QUFBQSxRQUN2QixVQUFVO0FBQUEsUUFDVjtBQUFBLFFBQ0EsU0FBUztBQUFBLE1BQ1YsQ0FBQztBQUNELFlBQU0sUUFBUSxFQUFFO0FBQUEsSUFDakIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssOEVBQThFLE1BQU07QUFDeEYsV0FBTyxnQkFBZ0IsNEJBQTRCLE1BQVMsR0FBRyxDQUFDLENBQUM7QUFDakUsV0FBTyxnQkFBZ0IsNEJBQTRCLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMxRCxXQUFPLGdCQUFnQiw0QkFBNEIsRUFBRSxhQUFhLG1CQUFtQixDQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQUEsRUFDdEcsQ0FBQztBQUVELE9BQUssZ0ZBQWdGLGlCQUFrQjtBQUN0RyxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sNkJBQTZCO0FBQ3BFLFVBQU0sUUFBNkI7QUFBQSxNQUNsQztBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ04sYUFBYTtBQUFBLE1BQ2IsU0FBUztBQUFBLE1BQ1QsU0FBUztBQUFBLE1BQ1QsWUFBWTtBQUFBLElBQ2I7QUFDQSxRQUFJO0FBQ0osVUFBTSxTQUFTLG9CQUFJLElBQW9CO0FBRXZDLFVBQU0sdUJBQXVCLE9BQU87QUFBQSxNQUNuQyxnQkFBZ0I7QUFBQSxNQUNoQixlQUFlLEVBQUUsWUFBWSxZQUFZLE9BQVU7QUFBQSxNQUNuRCxrQkFBa0IsRUFBRSxlQUFlLFlBQVksQ0FBQyxFQUFFO0FBQUEsTUFDbEQsc0JBQXNCLElBQUkseUJBQXlCLEVBQUUsNkJBQTZCLFFBQVEsQ0FBQztBQUFBLE1BQzNGLHNCQUFzQjtBQUFBLFFBQ3JCLGdCQUFnQixNQUFNO0FBQUUsZ0JBQU0sSUFBSSxNQUFNLHdEQUF3RDtBQUFBLFFBQUc7QUFBQSxNQUNwRztBQUFBLE1BQ0EseUJBQXlCO0FBQUEsUUFDeEIsTUFBTSxPQUFPLFFBQTJCO0FBQUUsa0JBQVE7QUFBQSxRQUFLO0FBQUEsTUFDeEQ7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLFVBQVUsQ0FBQyxRQUFhLE9BQU8sSUFBSSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJO0FBQUEsUUFDL0QsYUFBYSxDQUFDLE9BQXFCLFVBQWtCO0FBQUUsaUJBQU8sSUFBSSxNQUFNLElBQUksU0FBUyxHQUFHLEtBQUs7QUFBQSxRQUFHO0FBQUEsUUFDaEcsYUFBYSxDQUFDLE9BQWUsV0FBb0IsUUFBYztBQUM5RCxjQUFJLEtBQUs7QUFDUixtQkFBTyxJQUFJLElBQUksU0FBUyxHQUFHLEtBQUs7QUFBQSxVQUNqQztBQUNBLGlCQUFPLEVBQUUsSUFBSTtBQUFBLFFBQ2Q7QUFBQSxNQUNEO0FBQUEsTUFDQSxpQkFBaUIsYUFBYTtBQUFBLFFBQzdCLFdBQVc7QUFBQSxRQUNYLFFBQVE7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLGFBQWE7QUFBQSxNQUNkO0FBQUEsSUFDRCxHQUFHLEVBQUUsZUFBZSxNQUFNLENBQUM7QUFFM0IsV0FBTyxnQkFBZ0IsNEJBQTRCLEtBQUssR0FBRyxDQUFDLENBQUM7QUFBQSxFQUM5RCxDQUFDO0FBRUQsT0FBSywrRUFBK0UsaUJBQWtCO0FBQ3JHLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSw4QkFBOEI7QUFDckUsVUFBTSxRQUE2QjtBQUFBLE1BQ2xDO0FBQUEsTUFDQSxNQUFNO0FBQUEsTUFDTixhQUFhO0FBQUEsTUFDYixTQUFTO0FBQUEsTUFDVCxTQUFTO0FBQUEsTUFDVCxZQUFZO0FBQUEsSUFDYjtBQUNBLFFBQUk7QUFDSixVQUFNLFNBQVMsb0JBQUksSUFBb0I7QUFDdkMsVUFBTSxVQUFVLHFDQUFxQyxPQUFPO0FBQUEsTUFDM0QsWUFBWSxPQUFNLFVBQVM7QUFDMUIsWUFBSSxpQkFBaUIsNkJBQTZCO0FBQ2pELG1CQUFTO0FBQUEsUUFDVjtBQUNBLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRCxDQUFDO0FBRUQsVUFBTSx1QkFBdUIsT0FBTztBQUFBLE1BQ25DLGdCQUFnQjtBQUFBLE1BQ2hCLGVBQWU7QUFBQSxRQUNkLFlBQVksWUFBWTtBQUFFLGdCQUFNLElBQUksTUFBTSx5REFBeUQ7QUFBQSxRQUFHO0FBQUEsTUFDdkc7QUFBQSxNQUNBLGtCQUFrQixFQUFFLGVBQWUsWUFBWSxDQUFDLEVBQUU7QUFBQSxNQUNsRCxzQkFBc0IsSUFBSSx5QkFBeUIsRUFBRSw2QkFBNkIsZUFBZSxDQUFDO0FBQUEsTUFDbEcsc0JBQXNCO0FBQUEsUUFDckIsZ0JBQWdCLENBQUMsTUFBMEMsVUFBZSxVQUFnQixZQUN6RixNQUFNLElBQUksSUFBSSxLQUFLLFVBQVUsVUFBVSxPQUFPLENBQUM7QUFBQSxNQUNqRDtBQUFBLE1BQ0EseUJBQXlCO0FBQUEsUUFDeEIsTUFBTSxZQUFZO0FBQUUsZ0JBQU0sSUFBSSxNQUFNLDJDQUEyQztBQUFBLFFBQUc7QUFBQSxNQUNuRjtBQUFBLE1BQ0EscUJBQXFCLFFBQVE7QUFBQSxNQUM3QixTQUFTLFFBQVE7QUFBQSxNQUNqQixjQUFjO0FBQUEsUUFDYixVQUFVLENBQUMsUUFBYSxPQUFPLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksSUFBSTtBQUFBLFFBQy9ELGFBQWEsQ0FBQyxPQUFxQixVQUFrQjtBQUFFLGlCQUFPLElBQUksTUFBTSxJQUFJLFNBQVMsR0FBRyxLQUFLO0FBQUEsUUFBRztBQUFBLFFBQ2hHLGFBQWEsQ0FBQyxPQUFlLFdBQW9CLFFBQWM7QUFDOUQsY0FBSSxLQUFLO0FBQ1IsbUJBQU8sSUFBSSxJQUFJLFNBQVMsR0FBRyxLQUFLO0FBQUEsVUFDakM7QUFDQSxpQkFBTyxFQUFFLElBQUk7QUFBQSxRQUNkO0FBQUEsTUFDRDtBQUFBLE1BQ0EsaUJBQWlCLGFBQWE7QUFBQSxRQUM3QixXQUFXO0FBQUEsUUFDWCxRQUFRO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixhQUFhO0FBQUEsTUFDZDtBQUFBLElBQ0QsR0FBRyxFQUFFLGVBQWUsTUFBTSxDQUFDO0FBRTNCLFdBQU8sR0FBRyxNQUFNO0FBQ2hCLFdBQU8sZ0JBQWdCLDRCQUE0QixNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQUEsRUFDL0QsQ0FBQztBQUVELE9BQUssNEZBQTRGLGlCQUFrQjtBQUNsSCxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sK0JBQStCO0FBQ3RFLFVBQU0sUUFBNkI7QUFBQSxNQUNsQztBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ04sYUFBYTtBQUFBLE1BQ2IsU0FBUztBQUFBLE1BQ1QsU0FBUztBQUFBLE1BQ1QsWUFBWTtBQUFBLElBQ2I7QUFDQSxVQUFNLHVCQUF1Qiw4QkFBOEIsUUFBVyxLQUFLO0FBQzNFLFVBQU0sU0FBUyxvQkFBSSxJQUFvQjtBQUN2QyxVQUFNLGNBQWM7QUFBQSxNQUNuQixjQUFjO0FBQUEsTUFDZCxRQUFRLENBQUM7QUFBQSxJQUNWO0FBQ0EsUUFBSSxjQUFjO0FBQ2xCLFVBQU0sVUFBVSxxQ0FBcUMsT0FBTztBQUFBLE1BQzNELFlBQVksT0FBTSxVQUFTO0FBQzFCLFlBQUksaUJBQWlCLDZCQUE2QjtBQUNqRCxnQkFBTSxJQUFJLEtBQUs7QUFDZixzQkFBWSxlQUFlO0FBQUEsUUFDNUI7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsQ0FBQztBQUVELFVBQU0sZ0JBQWdCO0FBQUEsTUFDckIsSUFBSSxlQUFlO0FBQUUsZUFBTyxZQUFZO0FBQUEsTUFBYztBQUFBLE1BQ3RELGtCQUFrQixFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsRUFBRTtBQUFBLE1BQ3JDLGFBQWEsT0FBTyxVQUE4QjtBQUNqRCxvQkFBWSxPQUFPLEtBQUssTUFBTSxNQUFNO0FBQ3BDLFlBQUksWUFBWSxpQkFBaUIsTUFBTSxRQUFRO0FBQzlDLHNCQUFZLGVBQWU7QUFBQSxRQUM1QjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLFlBQVksT0FBTyxVQUFtQjtBQUNyQztBQUNBLGNBQU0sVUFBVTtBQUNoQixZQUFJLFFBQVEsVUFBVSxZQUFZLFFBQVEsVUFBVSxVQUFVO0FBQzdELGdCQUFNLGdCQUFnQixNQUFNLElBQUksSUFBSSxnQkFBZ0IsUUFBUSxTQUFTLFVBQVUsZUFBZSxDQUFDO0FBQy9GLGdCQUFNLGdCQUFnQixNQUFNLElBQUksSUFBSSxnQkFBZ0IsUUFBUSxTQUFTLFVBQVUsZUFBZSxDQUFDO0FBQy9GLGdCQUFNLFlBQVksTUFBTSxJQUFJLHFCQUFxQixlQUFlLGlCQUFpQixRQUFXLFFBQVcsZUFBZSxlQUFlLE1BQVMsQ0FBQztBQUMvSSxzQkFBWSxlQUFlO0FBQzNCLGlCQUFPLEVBQUUsT0FBTyxVQUFVO0FBQUEsUUFDM0I7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFFQSxVQUFNLHVCQUF1QixPQUFPO0FBQUEsTUFDbkMsZ0JBQWdCO0FBQUEsTUFDaEI7QUFBQSxNQUNBLGtCQUFrQixFQUFFLGVBQWUsWUFBWSxDQUFDLEVBQUU7QUFBQSxNQUNsRCxzQkFBc0IsSUFBSSx5QkFBeUIsRUFBRSw2QkFBNkIsVUFBVSxDQUFDO0FBQUEsTUFDN0Y7QUFBQSxNQUNBLHlCQUF5QjtBQUFBLFFBQ3hCLE1BQU0sWUFBWTtBQUFFLGdCQUFNLElBQUksTUFBTSxzQ0FBc0M7QUFBQSxRQUFHO0FBQUEsTUFDOUU7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLFVBQVUsQ0FBQyxRQUFhLE9BQU8sSUFBSSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJO0FBQUEsUUFDL0QsYUFBYSxDQUFDLE9BQXFCLFVBQWtCO0FBQUUsaUJBQU8sSUFBSSxNQUFNLElBQUksU0FBUyxHQUFHLEtBQUs7QUFBQSxRQUFHO0FBQUEsUUFDaEcsYUFBYSxDQUFDLE9BQWUsV0FBb0IsUUFBYztBQUM5RCxjQUFJLEtBQUs7QUFDUixtQkFBTyxJQUFJLElBQUksU0FBUyxHQUFHLEtBQUs7QUFBQSxVQUNqQztBQUNBLGlCQUFPLEVBQUUsSUFBSTtBQUFBLFFBQ2Q7QUFBQSxNQUNEO0FBQUEsTUFDQSxpQkFBaUIsYUFBYTtBQUFBLFFBQzdCLFdBQVc7QUFBQSxRQUNYLFFBQVE7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLGFBQWE7QUFBQSxNQUNkO0FBQUEsSUFDRCxHQUFHLEVBQUUsZUFBZSxNQUFNLENBQUM7QUFFM0IsVUFBTSxjQUFjLFlBQVk7QUFDaEMsV0FBTyxHQUFHLHVCQUF1QixlQUFlO0FBQ2hELFdBQU8sZ0JBQWdCLDRCQUE0QixXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBRW5FLFVBQU0sa0JBQWtCO0FBQ3hCLFVBQU0sNkJBQTZCLGVBQWU7QUFBQSxNQUNqRCxnQkFBZ0I7QUFBQSxNQUNoQjtBQUFBLE1BQ0Esa0JBQWtCLEVBQUUsZUFBZSxZQUFZLENBQUMsRUFBRTtBQUFBLE1BQ2xELHNCQUFzQixJQUFJLHlCQUF5QjtBQUFBLE1BQ25EO0FBQUEsTUFDQSx5QkFBeUI7QUFBQSxRQUN4QixNQUFNLFlBQVk7QUFBRSxnQkFBTSxJQUFJLE1BQU0sOENBQThDO0FBQUEsUUFBRztBQUFBLFFBQ3JGLGVBQWUsTUFBTTtBQUFBLFFBQ3JCLE9BQU8sTUFBTTtBQUFBLFFBQUU7QUFBQSxRQUNmLGdCQUFnQixNQUFNO0FBQUEsTUFDdkI7QUFBQSxNQUNBLHFCQUFxQixRQUFRO0FBQUEsTUFDN0IsU0FBUyxRQUFRO0FBQUEsSUFDbEIsR0FBRyxFQUFFLGNBQWMsQ0FBQyxFQUFFLENBQTJCO0FBQ2pELFdBQU8sWUFBWSxhQUFhLGVBQWU7QUFFL0MsVUFBTSxtQkFBbUIsWUFBWTtBQUNyQyxXQUFPLEdBQUcsNEJBQTRCLDJCQUEyQjtBQUNqRSxXQUFPLGVBQWUsa0JBQWtCLFdBQVc7QUFDbkQsV0FBTyxnQkFBZ0IsNEJBQTRCLGdCQUFnQixHQUFHLENBQUMsQ0FBQztBQUFBLEVBQ3pFLENBQUM7QUFFRCxPQUFLLGtGQUFrRixpQkFBa0I7QUFDeEcsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLG9DQUFvQztBQUMzRSxVQUFNLFFBQTZCO0FBQUEsTUFDbEM7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLGFBQWE7QUFBQSxNQUNiLFNBQVM7QUFBQSxNQUNULFNBQVM7QUFBQSxNQUNULFlBQVk7QUFBQSxJQUNiO0FBQ0EsVUFBTSx1QkFBdUIsOEJBQThCLFFBQVcsS0FBSztBQUMzRSxVQUFNLFNBQVMsb0JBQUksSUFBb0I7QUFDdkMsUUFBSTtBQUVKLFVBQU0sdUJBQXVCLE9BQU87QUFBQSxNQUNuQyxnQkFBZ0I7QUFBQSxNQUNoQixlQUFlO0FBQUEsUUFDZCxJQUFJLGVBQWU7QUFBRSxpQkFBTztBQUFBLFFBQWE7QUFBQSxRQUN6QyxZQUFZLE9BQU8sVUFBNEU7QUFDOUYsY0FBSSxNQUFNLFVBQVUsWUFBWSxNQUFNLFVBQVUsVUFBVTtBQUN6RCxrQkFBTSxnQkFBZ0IsTUFBTSxJQUFJLElBQUksZ0JBQWdCLE1BQU0sU0FBUyxVQUFVLGVBQWUsQ0FBQztBQUM3RixrQkFBTSxnQkFBZ0IsTUFBTSxJQUFJLElBQUksZ0JBQWdCLE1BQU0sU0FBUyxVQUFVLGVBQWUsQ0FBQztBQUM3RiwwQkFBYyxNQUFNLElBQUkscUJBQXFCLGVBQWUsaUJBQWlCLFFBQVcsUUFBVyxlQUFlLGVBQWUsTUFBUyxDQUFDO0FBQzNJLG1CQUFPLEVBQUUsT0FBTyxZQUFZO0FBQUEsVUFDN0I7QUFDQSxpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQSxrQkFBa0IsRUFBRSxlQUFlLFlBQVksQ0FBQyxFQUFFO0FBQUEsTUFDbEQsc0JBQXNCLElBQUkseUJBQXlCLEVBQUUsNkJBQTZCLFVBQVUsQ0FBQztBQUFBLE1BQzdGO0FBQUEsTUFDQSx5QkFBeUI7QUFBQSxRQUN4QixNQUFNLFlBQVk7QUFBRSxnQkFBTSxJQUFJLE1BQU0sc0NBQXNDO0FBQUEsUUFBRztBQUFBLE1BQzlFO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixVQUFVLENBQUMsUUFBYSxPQUFPLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksSUFBSTtBQUFBLFFBQy9ELGFBQWEsQ0FBQyxPQUFxQixVQUFrQjtBQUFFLGlCQUFPLElBQUksTUFBTSxJQUFJLFNBQVMsR0FBRyxLQUFLO0FBQUEsUUFBRztBQUFBLFFBQ2hHLGFBQWEsQ0FBQyxPQUFlLFdBQW9CLFFBQWM7QUFDOUQsY0FBSSxLQUFLO0FBQ1IsbUJBQU8sSUFBSSxJQUFJLFNBQVMsR0FBRyxLQUFLO0FBQUEsVUFDakM7QUFDQSxpQkFBTyxFQUFFLElBQUk7QUFBQSxRQUNkO0FBQUEsTUFDRDtBQUFBLE1BQ0EsaUJBQWlCLGFBQWE7QUFBQSxRQUM3QixXQUFXO0FBQUEsUUFDWCxRQUFRO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixhQUFhO0FBQUEsTUFDZDtBQUFBLElBQ0QsR0FBRyxFQUFFLGVBQWUsTUFBTSxDQUFDO0FBRTNCLFdBQU8sR0FBRyxXQUFXO0FBQ3JCLFdBQU8sZ0JBQWdCLDRCQUE0QixXQUFXLEdBQUcsQ0FBQyxDQUFDO0FBQUEsRUFDcEUsQ0FBQztBQUVELE9BQUssOEVBQThFLGlCQUFrQjtBQUNwRyxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sOEJBQThCO0FBQ3JFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSxrQ0FBa0M7QUFDekUsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sbUJBQThCLENBQUM7QUFDckMsVUFBTSxhQUFhLGlDQUFpQyxZQUFZLENBQUMsR0FBRyxLQUFLO0FBQ3pFLFdBQU8sWUFBWSxXQUFXLGtCQUFrQixHQUFHLElBQUk7QUFDdkQsV0FBTyxZQUFZLFdBQVcsc0JBQXNCLEVBQUUsZ0JBQWdCLEtBQUs7QUFDM0UsV0FBTyxZQUFZLDBCQUEwQixVQUFVLEdBQUcsS0FBSztBQUUvRCxVQUFNLGVBQWUsaUJBQWlCLGdCQUFnQixhQUFhLE1BQU07QUFBQSxJQUFFLENBQUM7QUFDNUUsUUFBSTtBQUNILFlBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLFFBQ3BELGFBQWE7QUFBQSxRQUNiO0FBQUEsUUFDQTtBQUFBLFFBQ0EsZ0JBQWdCLE9BQU8sY0FBdUI7QUFDN0MsY0FBSSxjQUFjLGFBQWE7QUFDOUIsNkJBQWlCLEtBQUssU0FBUztBQUFBLFVBQ2hDO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQztBQUNELDJCQUFxQixLQUFLLGVBQWU7QUFBQSxRQUN4QyxVQUFVLFlBQVk7QUFBQSxRQUN0QiwyQkFBMkIsTUFBTTtBQUFBLFFBQ2pDLG9DQUFvQyxNQUFNO0FBQUEsTUFDM0MsQ0FBNkI7QUFDN0IsWUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRiwyQkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxZQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLFFBQ2hGLElBQUk7QUFBQSxRQUNKLE9BQU87QUFBQSxNQUNSLENBQUMsQ0FBQztBQUNGLFdBQUssT0FBTztBQUNaLFlBQU0sYUFBYSxLQUFLO0FBQUEsUUFDdkIsVUFBVTtBQUFBLFFBQ1Y7QUFBQSxRQUNBLFNBQVM7QUFBQSxNQUNWLENBQUM7QUFDRCxZQUFNLFFBQVEsRUFBRTtBQUNoQiw0QkFBc0IsSUFBSTtBQUUxQixZQUFNLGNBQWMsS0FBSyxRQUFRLGNBQWMsNEJBQTRCO0FBQzNFLGFBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxNQUFNO0FBQ3JELFlBQU8sS0FBdUQsVUFBVTtBQUN4RSxZQUFNLFFBQVEsRUFBRTtBQUNoQixhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLGdCQUFnQixrQkFBa0IsQ0FBQyxDQUFDO0FBRTNDLFlBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ2xILFlBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxlQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFlBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFdBQUssT0FBTyxNQUFNO0FBQ2xCLFlBQU0sUUFBUSxNQUFNLElBQUksSUFBSSw0QkFBNEIsVUFBVSxVQUFVLGFBQWEsQ0FBQztBQUMxRixZQUFNLEtBQUssU0FBUyxPQUFPLFFBQVcsdUJBQU8sT0FBTyxJQUFJLEdBQUcsa0JBQWtCLElBQUk7QUFDakYsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNkJBQXVCLElBQUk7QUFFM0IsWUFBTSxlQUFlLE9BQU8sY0FBYyxrQ0FBa0M7QUFDNUUsYUFBTyxZQUFZLGNBQWMsTUFBTSxTQUFTLE1BQU07QUFDdEQsWUFBTyxLQUF1RCxVQUFVO0FBQ3hFLFlBQU0sUUFBUSxFQUFFO0FBQ2hCLGFBQU8sZ0JBQWdCLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLGFBQU8sZ0JBQWdCLGtCQUFrQixDQUFDLENBQUM7QUFBQSxJQUM1QyxVQUFFO0FBQ0QsbUJBQWEsUUFBUTtBQUFBLElBQ3RCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxnRUFBZ0UsaUJBQWtCO0FBQ3RGLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSw4QkFBOEI7QUFDckUsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGtDQUFrQztBQUN6RSxVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxhQUFhLGlDQUFpQyxZQUFZLENBQUMsR0FBRyxLQUFLO0FBRXpFLFVBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLE1BQ3BELGFBQWE7QUFBQSxNQUNiO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUNELHlCQUFxQixLQUFLLGVBQWU7QUFBQSxNQUN4QyxVQUFVLFlBQVk7QUFBQSxNQUN0QiwyQkFBMkIsTUFBTTtBQUFBLE1BQ2pDLG9DQUFvQyxNQUFNO0FBQUEsSUFDM0MsQ0FBNkI7QUFDN0IsVUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRix5QkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUVoRSxVQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLE1BQ2hGLElBQUk7QUFBQSxNQUNKLE9BQU87QUFBQSxJQUNSLENBQUMsQ0FBQztBQUNGLFNBQUssT0FBTztBQUNaLFVBQU0sYUFBYSxLQUFLO0FBQUEsTUFDdkIsVUFBVTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLFNBQVM7QUFBQSxJQUNWLENBQUM7QUFDRCxVQUFNLFFBQVEsRUFBRTtBQUNoQiwwQkFBc0IsSUFBSTtBQUUxQixVQUFNLGNBQWMsS0FBSyxRQUFRLGNBQWMsNEJBQTRCO0FBQzNFLFdBQU8sWUFBWSxhQUFhLE1BQU0sU0FBUyxNQUFNO0FBQ3JELGVBQVcsV0FBVztBQUN0QixVQUFPLEtBQXVELFVBQVU7QUFDeEUsVUFBTSxRQUFRLEVBQUU7QUFDaEIsV0FBTyxnQkFBZ0IsWUFBWSxDQUFDLENBQUM7QUFBQSxFQUN0QyxDQUFDO0FBRUQsT0FBSyw4RUFBOEUsaUJBQWtCO0FBQ3BHLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSwwQkFBMEI7QUFDakUsVUFBTSxRQUE2QjtBQUFBLE1BQ2xDO0FBQUEsTUFDQSxNQUFNO0FBQUEsTUFDTixhQUFhO0FBQUEsTUFDYixTQUFTO0FBQUEsTUFDVCxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsTUFDVCxZQUFZO0FBQUEsTUFDWixNQUFNO0FBQUEsSUFDUDtBQUNBLFFBQUk7QUFDSixVQUFNLFNBQVMsb0JBQUksSUFBb0I7QUFDdkMsVUFBTSx1QkFBdUIsT0FBTztBQUFBLE1BQ25DLGdCQUFnQjtBQUFBLE1BQ2hCLGVBQWUsRUFBRSxZQUFZLFlBQVksT0FBVTtBQUFBLE1BQ25ELGtCQUFrQixFQUFFLGVBQWUsWUFBWSxDQUFDLEVBQUU7QUFBQSxNQUNsRCxzQkFBc0IsSUFBSSx5QkFBeUIsRUFBRSw2QkFBNkIsUUFBUSxDQUFDO0FBQUEsTUFDM0Ysc0JBQXNCO0FBQUEsUUFDckIsZ0JBQWdCLE1BQU07QUFBRSxnQkFBTSxJQUFJLE1BQU0sd0RBQXdEO0FBQUEsUUFBRztBQUFBLE1BQ3BHO0FBQUEsTUFDQSx5QkFBeUI7QUFBQSxRQUN4QixNQUFNLE9BQU8sUUFBMkI7QUFBRSxrQkFBUTtBQUFBLFFBQUs7QUFBQSxNQUN4RDtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2IsVUFBVSxDQUFDLFFBQWEsT0FBTyxJQUFJLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLElBQUk7QUFBQSxRQUMvRCxhQUFhLENBQUMsT0FBcUIsVUFBa0I7QUFBRSxpQkFBTyxJQUFJLE1BQU0sSUFBSSxTQUFTLEdBQUcsS0FBSztBQUFBLFFBQUc7QUFBQSxRQUNoRyxhQUFhLENBQUMsT0FBZSxXQUFvQixRQUFjO0FBQzlELGNBQUksS0FBSztBQUNSLG1CQUFPLElBQUksSUFBSSxTQUFTLEdBQUcsS0FBSztBQUFBLFVBQ2pDO0FBQ0EsaUJBQU8sRUFBRSxJQUFJO0FBQUEsUUFDZDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGlCQUFpQixhQUFhO0FBQUEsUUFDN0IsV0FBVztBQUFBLFFBQ1gsUUFBUTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sYUFBYTtBQUFBLE1BQ2Q7QUFBQSxJQUNELEdBQUcsRUFBRSxlQUFlLE1BQU0sQ0FBQztBQUMzQixXQUFPLFlBQVksT0FBTyxRQUFRLFFBQVE7QUFDMUMsV0FBTyxZQUFZLE9BQU8sV0FBVyxhQUFhO0FBQ2xELFdBQU8sWUFBWSxPQUFPLFNBQVMsaUJBQWlCO0FBQ3BELFdBQU8sWUFBWSxPQUFPLFlBQVksVUFBVTtBQUNoRCxXQUFPLFlBQVksT0FBTyxNQUFNLFVBQVU7QUFDMUMsV0FBTyxZQUFZLE9BQU8sU0FBUyxRQUFRLGtCQUFrQjtBQUFBLEVBQzlELENBQUM7QUFFRCxPQUFLLDRFQUE0RSxpQkFBa0I7QUFDbEcsVUFBTSxXQUFXLFdBQVcsS0FBSyxNQUFNLGdDQUFnQztBQUN2RSxVQUFNLFFBQTZCO0FBQUEsTUFDbEM7QUFBQSxNQUNBLE1BQU07QUFBQSxNQUNOLGFBQWE7QUFBQSxNQUNiLFNBQVM7QUFBQSxNQUNULFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLFNBQVM7QUFBQSxNQUNULFlBQVk7QUFBQSxNQUNaLE1BQU07QUFBQSxJQUNQO0FBQ0EsUUFBSTtBQUNKLFVBQU0sU0FBUyxvQkFBSSxJQUFvQjtBQUN2QyxVQUFNLFVBQVUscUNBQXFDLE9BQU87QUFBQSxNQUMzRCxZQUFZLE9BQU0sVUFBUztBQUMxQixZQUFJLGlCQUFpQiw2QkFBNkI7QUFDakQsbUJBQVM7QUFBQSxRQUNWO0FBQ0EsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNELENBQUM7QUFDRCxVQUFNLHVCQUF1QixPQUFPO0FBQUEsTUFDbkMsZ0JBQWdCO0FBQUEsTUFDaEIsZUFBZTtBQUFBLFFBQ2QsWUFBWSxZQUFZO0FBQUUsZ0JBQU0sSUFBSSxNQUFNLHlEQUF5RDtBQUFBLFFBQUc7QUFBQSxNQUN2RztBQUFBLE1BQ0Esa0JBQWtCLEVBQUUsZUFBZSxZQUFZLENBQUMsRUFBRTtBQUFBLE1BQ2xELHNCQUFzQixJQUFJLHlCQUF5QixFQUFFLDZCQUE2QixlQUFlLENBQUM7QUFBQSxNQUNsRyxzQkFBc0I7QUFBQSxRQUNyQixnQkFBZ0IsQ0FBQyxNQUEwQyxVQUFlLFVBQWdCLFNBQWtCLGFBQzNHLE1BQU0sSUFBSSxJQUFJLEtBQUssVUFBVSxVQUFVLFNBQVMsUUFBUSxDQUFDO0FBQUEsTUFDM0Q7QUFBQSxNQUNBLHlCQUF5QjtBQUFBLFFBQ3hCLE1BQU0sWUFBWTtBQUFFLGdCQUFNLElBQUksTUFBTSwyQ0FBMkM7QUFBQSxRQUFHO0FBQUEsTUFDbkY7QUFBQSxNQUNBLHFCQUFxQixRQUFRO0FBQUEsTUFDN0IsU0FBUyxRQUFRO0FBQUEsTUFDakIsY0FBYztBQUFBLFFBQ2IsVUFBVSxDQUFDLFFBQWEsT0FBTyxJQUFJLElBQUksU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLElBQUk7QUFBQSxRQUMvRCxhQUFhLENBQUMsT0FBcUIsVUFBa0I7QUFBRSxpQkFBTyxJQUFJLE1BQU0sSUFBSSxTQUFTLEdBQUcsS0FBSztBQUFBLFFBQUc7QUFBQSxRQUNoRyxhQUFhLENBQUMsT0FBZSxXQUFvQixRQUFjO0FBQzlELGNBQUksS0FBSztBQUNSLG1CQUFPLElBQUksSUFBSSxTQUFTLEdBQUcsS0FBSztBQUFBLFVBQ2pDO0FBQ0EsaUJBQU8sRUFBRSxJQUFJO0FBQUEsUUFDZDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGlCQUFpQixhQUFhO0FBQUEsUUFDN0IsV0FBVztBQUFBLFFBQ1gsUUFBUTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sYUFBYTtBQUFBLE1BQ2Q7QUFBQSxJQUNELEdBQUcsRUFBRSxlQUFlLE1BQU0sQ0FBQztBQUMzQixXQUFPLEdBQUcsTUFBTTtBQUNoQixXQUFPLFlBQVksT0FBTyxXQUFXLGFBQWE7QUFDbEQsV0FBTyxZQUFZLE9BQU8sU0FBUyx1QkFBdUI7QUFDMUQsV0FBTyxZQUFZLE9BQU8sUUFBUSxRQUFRO0FBQzFDLFdBQU8sWUFBWSxPQUFPLFNBQVMsUUFBUSxrQkFBa0I7QUFBQSxFQUM5RCxDQUFDO0FBRUQsT0FBSywwREFBMEQsaUJBQWtCO0FBQ2hGLFVBQU0sYUFBdUQsQ0FBQztBQUM5RCxVQUFNLGNBQXdCLENBQUM7QUFDL0IsVUFBTSxhQUFhLGlDQUFpQyxDQUFDLEdBQUcsWUFBWSxLQUFLO0FBQ3pFLFVBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLE1BQ3BELGFBQWE7QUFBQSxNQUNiO0FBQUEsTUFDQSxnQkFBZ0IsT0FBTyxjQUF1QjtBQUM3QyxvQkFBWSxLQUFLLE9BQU8sU0FBUyxDQUFDO0FBQUEsTUFDbkM7QUFBQSxJQUNELENBQUM7QUFDRCx5QkFBcUIsS0FBSyxlQUFlO0FBQUEsTUFDeEMsVUFBVSxZQUFZO0FBQUEsTUFDdEIsMkJBQTJCLE1BQU07QUFBQSxNQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLElBQzNDLENBQTZCO0FBQzdCLFVBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YseUJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFDaEUsVUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxNQUNoRixJQUFJO0FBQUEsTUFDSixPQUFPO0FBQUEsSUFDUixDQUFDLENBQUM7QUFDRixTQUFLLE9BQU87QUFDWixVQUFNLFdBQVcsSUFBSSxLQUFLLEVBQUUsUUFBUSxvQkFBb0IsTUFBTSxpQkFBaUIsQ0FBQztBQUNoRixVQUFNLGFBQWEsS0FBSztBQUFBLE1BQ3ZCO0FBQUEsTUFDQSxVQUFVLElBQUksS0FBSyxFQUFFLFFBQVEsb0JBQW9CLE1BQU0saUJBQWlCLENBQUM7QUFBQSxNQUN6RSxTQUFTO0FBQUEsTUFDVCxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsTUFDVCxZQUFZO0FBQUEsTUFDWixNQUFNO0FBQUEsTUFDTixhQUFhLEVBQUUsV0FBVyxJQUFJLEtBQUsscUJBQXFCLEVBQUU7QUFBQSxJQUMzRCxDQUFDO0FBQ0QsVUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFdBQU8sWUFBWSxXQUFXLFFBQVEsQ0FBQztBQUN2QyxXQUFPLFlBQVksV0FBVyxDQUFDLEdBQUcsV0FBVyxXQUFXO0FBQ3hELFdBQU8sZ0JBQWdCLFdBQVcsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7QUFDdkUsV0FBTyxHQUFHLENBQUMsS0FBSyxVQUFVLFdBQVcsQ0FBQyxDQUFDLEVBQUUsU0FBUyxrQkFBa0IsQ0FBQztBQUNyRSxXQUFPLGdCQUFnQixhQUFhLENBQUMsQ0FBQztBQUFBLEVBQ3ZDLENBQUM7QUFFRCxPQUFLLG1FQUFtRSxpQkFBa0I7QUFDekYsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sYUFBdUQsQ0FBQztBQUM5RCxVQUFNLGNBQXdCLENBQUM7QUFDL0IsVUFBTSxhQUFhLGlDQUFpQyxZQUFZLFlBQVksS0FBSztBQUNqRixVQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxNQUNwRCxhQUFhO0FBQUEsTUFDYjtBQUFBLE1BQ0EsZ0JBQWdCLE9BQU8sY0FBdUI7QUFDN0Msb0JBQVksS0FBSyxPQUFPLFNBQVMsQ0FBQztBQUFBLE1BQ25DO0FBQUEsSUFDRCxDQUFDO0FBQ0QsK0JBQTJCLG9CQUFvQjtBQUMvQyx5QkFBcUIsS0FBSyxlQUFlO0FBQUEsTUFDeEMsVUFBVSxZQUFZO0FBQUEsTUFDdEIsMkJBQTJCLE1BQU07QUFBQSxNQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLElBQzNDLENBQTZCO0FBQzdCLFVBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YseUJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFDaEUsVUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxNQUNoRixJQUFJO0FBQUEsTUFDSixPQUFPO0FBQUEsSUFDUixDQUFDLENBQUM7QUFDRixTQUFLLE9BQU87QUFDWixVQUFNLFdBQVcsSUFBSSxLQUFLLEVBQUUsUUFBUSxvQkFBb0IsTUFBTSx3QkFBd0IsQ0FBQztBQUN2RixVQUFNLGFBQWEsS0FBSztBQUFBLE1BQ3ZCO0FBQUEsTUFDQSxVQUFVLElBQUksS0FBSyxFQUFFLFFBQVEsb0JBQW9CLE1BQU0sd0JBQXdCLENBQUM7QUFBQSxNQUNoRixTQUFTO0FBQUEsTUFDVCxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsTUFDVCxhQUFhLEVBQUUsV0FBVyxJQUFJLEtBQUssNEJBQTRCLEVBQUU7QUFBQSxJQUNsRSxDQUFDO0FBQ0QsVUFBTSxRQUFRLEVBQUU7QUFDaEIsMEJBQXNCLElBQUk7QUFDMUIsVUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxXQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsTUFBTTtBQUNwRCxlQUFXLFVBQVU7QUFDckIsVUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFVBQU8sS0FBdUQsVUFBVTtBQUN4RSxXQUFPLFlBQVksV0FBVyxRQUFRLENBQUM7QUFDdkMsV0FBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLFdBQU8sZ0JBQWdCLGFBQWEsQ0FBQyxDQUFDO0FBQ3RDLFdBQU8sWUFBWSxLQUFLLFFBQVEsY0FBYyxtQ0FBbUMsR0FBRyxhQUFhLGdDQUFnQyxDQUFDO0FBRWxJLFVBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ2xILFVBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxhQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFVBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFVBQU0sUUFBUSxNQUFNLElBQUksSUFBSSw0QkFBNEIsVUFBVSxJQUFJLEtBQUssRUFBRSxRQUFRLG9CQUFvQixNQUFNLHdCQUF3QixDQUFDLEdBQUcsZUFBZTtBQUFBLE1BQ3pKLFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLFNBQVM7QUFBQSxJQUNWLENBQUMsQ0FBQztBQUNGLFVBQU0sS0FBSyxTQUFTLE9BQU8sUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUNqRiwyQkFBdUIsSUFBSTtBQUMzQixVQUFNLGNBQWMsT0FBTyxjQUFjLGlDQUFpQztBQUMxRSxXQUFPLFlBQVksYUFBYSxNQUFNLFNBQVMsTUFBTTtBQUNyRCxlQUFXLFdBQVc7QUFDdEIsVUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFVBQU8sS0FBdUQsVUFBVTtBQUN4RSxXQUFPLFlBQVksV0FBVyxRQUFRLENBQUM7QUFDdkMsV0FBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLFdBQU8sWUFBWSxPQUFPLGNBQWMsa0NBQWtDLEdBQUcsYUFBYSxnQ0FBZ0MsQ0FBQztBQUFBLEVBQzVILENBQUM7QUFFRCxPQUFLLDBFQUEwRSxpQkFBa0I7QUFDaEcsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sY0FBd0IsQ0FBQztBQUMvQixVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sb0NBQW9DO0FBQzNFLFVBQU0sYUFBYSxpQ0FBaUMsQ0FBQyxHQUFHLFlBQVksS0FBSztBQUN6RSxVQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxNQUNwRCxhQUFhO0FBQUEsTUFDYjtBQUFBLE1BQ0E7QUFBQSxNQUNBLGdCQUFnQixPQUFPLGNBQXVCO0FBQzdDLG9CQUFZLEtBQUssT0FBTyxTQUFTLENBQUM7QUFBQSxNQUNuQztBQUFBLElBQ0QsQ0FBQztBQUNELHlCQUFxQixLQUFLLHNCQUFzQjtBQUFBLE1BQy9DLGFBQWEsTUFBTTtBQUFBLE1BQ25CLGFBQWEsT0FBTztBQUFBLFFBQ25CLFlBQVk7QUFBQSxRQUNaLFNBQVM7QUFBQSxRQUNULE9BQU8sRUFBRSxNQUFNLE1BQU07QUFBQSxRQUNyQixTQUFTLENBQUM7QUFBQSxNQUNYO0FBQUEsTUFDQSxlQUFlLE1BQU07QUFBQSxNQUNyQix1QkFBdUIsTUFBTTtBQUFBLE1BQzdCLFNBQVMsWUFBWTtBQUFBLE1BQ3JCLGlCQUFpQixNQUFNO0FBQUEsTUFDdkIsdUJBQXVCLE1BQU07QUFBQSxJQUM5QixDQUFvQztBQUNwQyxVQUFNLGNBQWMscUJBQXFCLGVBQWUsQ0FBQyxhQUErQjtBQUN2RixZQUFNLE1BQU0sU0FBUyxJQUFJLFdBQVc7QUFDcEMsYUFBTyxDQUFDLEdBQUcsSUFBSSxZQUFZLEVBQUUsQ0FBQyxHQUFHLFNBQVMsT0FBTyxDQUFDLEdBQUcsVUFBVSxDQUFDO0FBQUEsSUFDakUsQ0FBQztBQUNELFFBQUksQ0FBQyxhQUFhO0FBQ2pCLFlBQU0sSUFBSSxNQUFNLHFCQUFxQjtBQUFBLElBQ3RDO0FBQ0EsVUFBTSxlQUFlLGlCQUFpQixnQkFBZ0IsYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQzVFLFFBQUk7QUFDSCwyQkFBcUIsS0FBSyxlQUFlO0FBQUEsUUFDeEMsVUFBVSxZQUFZO0FBQUEsUUFDdEIsMkJBQTJCLE1BQU07QUFBQSxRQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLE1BQzNDLENBQTZCO0FBQzdCLFlBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YsMkJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFDaEUsWUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxRQUNoRixJQUFJO0FBQUEsUUFDSixPQUFPO0FBQUEsTUFDUixDQUFDLENBQUM7QUFDRixXQUFLLE9BQU87QUFDWixZQUFNLGFBQWEsS0FBSztBQUFBLFFBQ3ZCLFVBQVUsSUFBSSxLQUFLLEVBQUUsUUFBUSxvQkFBb0IsTUFBTSw0QkFBNEIsQ0FBQztBQUFBLFFBQ3BGLFVBQVUsSUFBSSxLQUFLLEVBQUUsUUFBUSxvQkFBb0IsTUFBTSw0QkFBNEIsQ0FBQztBQUFBLFFBQ3BGLFNBQVM7QUFBQSxRQUNULFFBQVE7QUFBQSxRQUNSLFdBQVc7QUFBQSxRQUNYLFNBQVM7QUFBQSxRQUNUO0FBQUEsTUFDRCxDQUFDO0FBQ0QsWUFBTSxRQUFRLEVBQUU7QUFDaEIsNEJBQXNCLElBQUk7QUFDMUIsWUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxhQUFPLFlBQVksWUFBWSxNQUFNLFNBQVMsRUFBRTtBQUNoRCxZQUFPLEtBQXNELFNBQVM7QUFDdEUsYUFBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLGFBQU8sZ0JBQWdCLGFBQWEsQ0FBQyxXQUFXLENBQUM7QUFBQSxJQUNsRCxVQUFFO0FBQ0QsbUJBQWEsUUFBUTtBQUFBLElBQ3RCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx5REFBeUQsaUJBQWtCO0FBQy9FLFVBQU0sYUFBdUQsQ0FBQztBQUM5RCxVQUFNLGFBQWEsaUNBQWlDLENBQUMsR0FBRyxZQUFZLEtBQUs7QUFDekUsVUFBTSx1QkFBdUIsd0JBQXdCLEVBQUUsYUFBYSxNQUFNLFdBQVcsQ0FBQztBQUN0Rix5QkFBcUIsS0FBSyxlQUFlO0FBQUEsTUFDeEMsVUFBVSxZQUFZO0FBQUEsTUFDdEIsMkJBQTJCLE1BQU07QUFBQSxNQUNqQyxvQ0FBb0MsTUFBTTtBQUFBLElBQzNDLENBQTZCO0FBQzdCLFVBQU0sZUFBZSxNQUFNLElBQUkscUJBQXFCLGVBQWUsdUJBQXVCLENBQUM7QUFDM0YseUJBQXFCLEtBQUssMEJBQTBCLFlBQVk7QUFDaEUsVUFBTSxPQUFPLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSxzQkFBc0I7QUFBQSxNQUNoRixJQUFJO0FBQUEsTUFDSixPQUFPO0FBQUEsSUFDUixDQUFDLENBQUM7QUFDRixTQUFLLE9BQU87QUFDWixVQUFNLGFBQWEsS0FBSztBQUFBLE1BQ3ZCLFVBQVUsSUFBSSxLQUFLLEVBQUUsUUFBUSxvQkFBb0IsTUFBTSxxQkFBcUIsQ0FBQztBQUFBLE1BQzdFLFVBQVUsSUFBSSxLQUFLLEVBQUUsUUFBUSxvQkFBb0IsTUFBTSxxQkFBcUIsQ0FBQztBQUFBLE1BQzdFLFNBQVM7QUFBQSxNQUNULFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLFNBQVM7QUFBQSxJQUNWLENBQUM7QUFDRCxVQUFPLEtBQXNELFNBQVM7QUFDdEUsV0FBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLFdBQU8sWUFBWSxLQUFLLFFBQVEsY0FBYyxtQ0FBbUMsR0FBRyxhQUFhLGdDQUFnQyxDQUFDO0FBQUEsRUFDbkksQ0FBQztBQUVELE9BQUsseUVBQXlFLGlCQUFrQjtBQUMvRixVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0sZ0NBQWdDO0FBQ3ZFLFVBQU0sUUFBNkI7QUFBQSxNQUNsQztBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ04sYUFBYTtBQUFBLE1BQ2IsU0FBUztBQUFBLE1BQ1QsUUFBUTtBQUFBLE1BQ1IsV0FBVztBQUFBLE1BQ1gsU0FBUztBQUFBLE1BQ1QsWUFBWTtBQUFBLE1BQ1osTUFBTTtBQUFBLElBQ1A7QUFDQSxRQUFJO0FBQ0osVUFBTSxTQUFTLG9CQUFJLElBQW9CO0FBQ3ZDLFVBQU0sU0FBUyxNQUFNLHVCQUF1QixPQUFPO0FBQUEsTUFDbEQsZ0JBQWdCO0FBQUEsTUFDaEIsZUFBZSxFQUFFLFlBQVksWUFBWSxPQUFVO0FBQUEsTUFDbkQsa0JBQWtCLEVBQUUsZUFBZSxZQUFZLENBQUMsRUFBRTtBQUFBLE1BQ2xELHNCQUFzQixJQUFJLHlCQUF5QixFQUFFLDZCQUE2QixRQUFRLENBQUM7QUFBQSxNQUMzRixzQkFBc0I7QUFBQSxRQUNyQixnQkFBZ0IsTUFBTTtBQUFFLGdCQUFNLElBQUksTUFBTSx3REFBd0Q7QUFBQSxRQUFHO0FBQUEsTUFDcEc7QUFBQSxNQUNBLHlCQUF5QjtBQUFBLFFBQ3hCLE1BQU0sT0FBTyxRQUEyQjtBQUN2QyxrQkFBUTtBQUNSLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLFVBQVUsQ0FBQyxRQUFhLE9BQU8sSUFBSSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJO0FBQUEsUUFDL0QsYUFBYSxDQUFDLE9BQXFCLFVBQWtCO0FBQUUsaUJBQU8sSUFBSSxNQUFNLElBQUksU0FBUyxHQUFHLEtBQUs7QUFBQSxRQUFHO0FBQUEsUUFDaEcsYUFBYSxDQUFDLE9BQWUsV0FBb0IsUUFBYztBQUM5RCxjQUFJLEtBQUs7QUFDUixtQkFBTyxJQUFJLElBQUksU0FBUyxHQUFHLEtBQUs7QUFBQSxVQUNqQztBQUNBLGlCQUFPLEVBQUUsSUFBSTtBQUFBLFFBQ2Q7QUFBQSxNQUNEO0FBQUEsTUFDQSxpQkFBaUIsYUFBYTtBQUFBLFFBQzdCLFdBQVc7QUFBQSxRQUNYLFFBQVE7QUFBQSxRQUNSLE1BQU07QUFBQSxRQUNOLGFBQWE7QUFBQSxNQUNkO0FBQUEsSUFDRCxHQUFHLEVBQUUsZUFBZSxNQUFNLENBQUM7QUFDM0IsV0FBTyxZQUFZLFFBQVEsSUFBSTtBQUMvQixRQUFJLENBQUMsT0FBTztBQUNYLFlBQU0sSUFBSSxNQUFNLHNCQUFzQjtBQUFBLElBQ3ZDO0FBQ0EsV0FBTyxZQUFZLE1BQU0sU0FBUyx1QkFBdUI7QUFDekQsV0FBTyxZQUFZLE1BQU0sUUFBUSxRQUFRO0FBQ3pDLFdBQU8sWUFBWSxNQUFNLFdBQVcsV0FBVztBQUMvQyxXQUFPLFlBQVksTUFBTSxZQUFZLFVBQVU7QUFDL0MsV0FBTyxZQUFZLE1BQU0sTUFBTSxVQUFVO0FBQ3pDLFdBQU8sWUFBWSxNQUFNLFNBQVMsUUFBUSxrQkFBa0I7QUFDNUQsV0FBTyxZQUFZLE1BQU0sVUFBVSxRQUFRLGtCQUFrQjtBQUU3RCxVQUFNLFdBQVc7QUFBQSxNQUNoQixRQUFRLE1BQU07QUFBQSxNQUNkLFdBQVcsTUFBTTtBQUFBLE1BQ2pCLFNBQVMsTUFBTTtBQUFBLE1BQ2YsWUFBWSxNQUFNO0FBQUEsTUFDbEIsTUFBTSxNQUFNO0FBQUEsSUFDYjtBQUNBLFVBQU0sUUFBUSxNQUFNLElBQUksSUFBSSw0QkFBNEIsTUFBTSxVQUFVLE1BQU0sVUFBVSxNQUFNLFNBQVMsUUFBUSxDQUFDO0FBQ2hILFVBQU0sYUFBYSxNQUFNLElBQUksSUFBSSw0QkFBNEIsTUFBTSxVQUFVLE1BQU0sVUFBVSxTQUFTLFFBQVEsQ0FBQztBQUMvRyxVQUFNLFlBQVksTUFBTSxJQUFJLElBQUksNEJBQTRCLE1BQU0sVUFBVSxNQUFNLFVBQVUsTUFBTSxTQUFTLEVBQUUsR0FBRyxVQUFVLFNBQVMsZUFBZSxDQUFDLENBQUM7QUFDcEosVUFBTSxPQUFPLE1BQU0sSUFBSSxJQUFJLDRCQUE0QixNQUFNLFVBQVUsTUFBTSxVQUFVLE1BQU0sU0FBUyxRQUFRLENBQUM7QUFDL0csV0FBTyxZQUFZLE1BQU0sUUFBUSxVQUFVLEdBQUcsS0FBSztBQUNuRCxXQUFPLFlBQVksTUFBTSxRQUFRLFNBQVMsR0FBRyxLQUFLO0FBQ2xELFdBQU8sWUFBWSxNQUFNLFFBQVEsSUFBSSxHQUFHLElBQUk7QUFFNUMsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sY0FBd0IsQ0FBQztBQUMvQixVQUFNLGFBQWEsaUNBQWlDLENBQUMsR0FBRyxZQUFZLEtBQUs7QUFDekUsVUFBTSx1QkFBdUIsd0JBQXdCO0FBQUEsTUFDcEQsYUFBYTtBQUFBLE1BQ2I7QUFBQSxNQUNBLGdCQUFnQixPQUFPLGNBQXVCO0FBQzdDLG9CQUFZLEtBQUssT0FBTyxTQUFTLENBQUM7QUFBQSxNQUNuQztBQUFBLElBQ0QsQ0FBQztBQUNELHlCQUFxQixLQUFLLGVBQWU7QUFBQSxNQUN4QyxVQUFVLFlBQVk7QUFBQSxNQUN0QiwyQkFBMkIsTUFBTTtBQUFBLE1BQ2pDLG9DQUFvQyxNQUFNO0FBQUEsSUFDM0MsQ0FBNkI7QUFDN0IsVUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRix5QkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUNoRSxVQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLE1BQ2hGLElBQUk7QUFBQSxNQUNKLE9BQU87QUFBQSxJQUNSLENBQUMsQ0FBQztBQUNGLFNBQUssT0FBTztBQUNaLFVBQU0sYUFBYSxLQUFLLEtBQUs7QUFDN0IsVUFBTSxRQUFRLEVBQUU7QUFDaEIsMEJBQXNCLElBQUk7QUFDMUIsVUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxXQUFPLFlBQVksV0FBVyxNQUFNLFNBQVMsRUFBRTtBQUMvQyxXQUFPLFlBQVksV0FBVyxVQUFVLEtBQUs7QUFDN0MsVUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFdBQU8sWUFBWSxXQUFXLFFBQVEsQ0FBQztBQUN2QyxXQUFPLFlBQVksV0FBVyxDQUFDLEdBQUcsV0FBVyxXQUFXO0FBQ3hELFdBQU8sZ0JBQWdCLFdBQVcsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyx1QkFBdUIsQ0FBQztBQUNwRixXQUFPLEdBQUcsQ0FBQyxLQUFLLFVBQVUsV0FBVyxDQUFDLENBQUMsRUFBRSxTQUFTLGtCQUFrQixDQUFDO0FBQ3JFLFdBQU8sZ0JBQWdCLGFBQWEsQ0FBQyxDQUFDO0FBRXRDLFVBQU0sT0FBTyxNQUFNLElBQUkscUJBQXFCLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ2xILFVBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxhQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFVBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFNBQUssT0FBTyxNQUFNO0FBQ2xCLFVBQU0sS0FBSyxTQUFTLE9BQU8sUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUNqRixVQUFPLEtBQXNELFNBQVM7QUFDdEUsV0FBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLFdBQU8sWUFBWSxXQUFXLENBQUMsR0FBRyxXQUFXLFdBQVc7QUFDeEQsV0FBTyxnQkFBZ0IsV0FBVyxDQUFDLEdBQUcsV0FBVyxDQUFDLEdBQUcsTUFBTSxDQUFDLHVCQUF1QixDQUFDO0FBQ3BGLFdBQU8sR0FBRyxDQUFDLEtBQUssVUFBVSxXQUFXLENBQUMsQ0FBQyxFQUFFLFNBQVMsa0JBQWtCLENBQUM7QUFDckUsV0FBTyxnQkFBZ0IsYUFBYSxDQUFDLENBQUM7QUFBQSxFQUN2QyxDQUFDO0FBRUQsT0FBSyxpRUFBaUUsaUJBQWtCO0FBQ3ZGLFVBQU0sYUFBdUQsQ0FBQztBQUM5RCxVQUFNLGNBQXdCLENBQUM7QUFDL0IsVUFBTSxhQUFhLGlDQUFpQyxDQUFDLEdBQUcsWUFBWSxLQUFLO0FBQ3pFLFVBQU0sdUJBQXVCLHdCQUF3QjtBQUFBLE1BQ3BELGFBQWE7QUFBQSxNQUNiO0FBQUEsTUFDQSxnQkFBZ0IsT0FBTyxjQUF1QjtBQUM3QyxvQkFBWSxLQUFLLE9BQU8sU0FBUyxDQUFDO0FBQUEsTUFDbkM7QUFBQSxJQUNELENBQUM7QUFDRCwrQkFBMkIsb0JBQW9CO0FBQy9DLHlCQUFxQixLQUFLLGVBQWU7QUFBQSxNQUN4QyxVQUFVLFlBQVk7QUFBQSxNQUN0QiwyQkFBMkIsTUFBTTtBQUFBLE1BQ2pDLG9DQUFvQyxNQUFNO0FBQUEsSUFDM0MsQ0FBNkI7QUFDN0IsVUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRix5QkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUNoRSxVQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLE1BQ2hGLElBQUk7QUFBQSxNQUNKLE9BQU87QUFBQSxJQUNSLENBQUMsQ0FBQztBQUNGLFNBQUssT0FBTztBQUNaLFVBQU0sV0FBVyxJQUFJLEtBQUssRUFBRSxRQUFRLG9CQUFvQixNQUFNLDJCQUEyQixDQUFDO0FBQzFGLFVBQU0sV0FBVyxJQUFJLEtBQUssRUFBRSxRQUFRLG9CQUFvQixNQUFNLDJCQUEyQixDQUFDO0FBQzFGLFVBQU0sYUFBYSxLQUFLO0FBQUEsTUFDdkI7QUFBQSxNQUNBO0FBQUEsTUFDQSxTQUFTO0FBQUEsTUFDVCxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsSUFDVixDQUFDO0FBQ0QsVUFBTSxRQUFRLEVBQUU7QUFDaEIsMEJBQXNCLElBQUk7QUFDMUIsVUFBTSxhQUFhLEtBQUssUUFBUSxjQUFjLDJCQUEyQjtBQUN6RSxXQUFPLFlBQVksV0FBVyxNQUFNLFNBQVMsTUFBTTtBQUNuRCxlQUFXLFVBQVU7QUFDckIsVUFBTyxLQUFzRCxTQUFTO0FBQ3RFLFdBQU8sWUFBWSxXQUFXLFFBQVEsQ0FBQztBQUN2QyxXQUFPLGdCQUFnQixhQUFhLENBQUMsQ0FBQztBQUN0QyxXQUFPLFlBQVksS0FBSyxRQUFRLGNBQWMsbUNBQW1DLEdBQUcsYUFBYSxnQ0FBZ0MsQ0FBQztBQUVsSSxVQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLDRCQUE0QixJQUFJLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUNsSCxVQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsYUFBUyxLQUFLLFlBQVksTUFBTTtBQUNoQyxVQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sT0FBTyxPQUFPLEVBQUUsQ0FBQztBQUM1QyxTQUFLLE9BQU8sTUFBTTtBQUNsQixVQUFNLFFBQVEsTUFBTSxJQUFJLElBQUksNEJBQTRCLFVBQVUsVUFBVSxlQUFlO0FBQUEsTUFDMUYsUUFBUTtBQUFBLE1BQ1IsV0FBVztBQUFBLE1BQ1gsU0FBUztBQUFBLElBQ1YsQ0FBQyxDQUFDO0FBQ0YsVUFBTSxLQUFLLFNBQVMsT0FBTyxRQUFXLHVCQUFPLE9BQU8sSUFBSSxHQUFHLGtCQUFrQixJQUFJO0FBQ2pGLDJCQUF1QixJQUFJO0FBQzNCLFVBQU0sY0FBYyxPQUFPLGNBQWMsaUNBQWlDO0FBQzFFLFdBQU8sWUFBWSxZQUFZLE1BQU0sU0FBUyxNQUFNO0FBQ3BELGVBQVcsV0FBVztBQUN0QixVQUFPLEtBQXNELFNBQVM7QUFDdEUsV0FBTyxZQUFZLFdBQVcsUUFBUSxDQUFDO0FBQ3ZDLFdBQU8sZ0JBQWdCLGFBQWEsQ0FBQyxDQUFDO0FBQ3RDLFdBQU8sWUFBWSxPQUFPLGNBQWMsa0NBQWtDLEdBQUcsYUFBYSxnQ0FBZ0MsQ0FBQztBQUFBLEVBQzVILENBQUM7QUFFRCxRQUFNLGtDQUFrQyxNQUFNO0FBWTdDLFVBQU0sWUFBWTtBQUFBLE1BQ2pCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxFQUFFLEtBQUssSUFBSTtBQUNYLFVBQU0sV0FBNkM7QUFBQSxNQUNsRCxXQUFXO0FBQUEsTUFBTSxRQUFRO0FBQUEsTUFBSSxTQUFTO0FBQUEsTUFBTSxjQUFjO0FBQUEsTUFBSSxVQUFVO0FBQUEsTUFBRyxRQUFRO0FBQUEsSUFDcEY7QUFDQSxVQUFNLGVBQW9ELEVBQUUsV0FBVyxhQUFhLE1BQU0sWUFBWSxZQUFZLFdBQVc7QUFDN0gsVUFBTSxnQkFBd0Q7QUFBQSxNQUM3RCxXQUFXO0FBQUEsTUFBYSxNQUFNLENBQUMsT0FBTyxTQUFTLFlBQVkscUJBQXFCO0FBQUEsTUFBRyxTQUFTLENBQUMsWUFBWSxJQUFJO0FBQUEsSUFDOUc7QUFFQSxtQkFBZSx1QkFBdUIsTUFBZ0IsYUFBYSxPQUFPO0FBQ3pFLFlBQU0sUUFBOEI7QUFBQSxRQUNuQyxpQkFBaUI7QUFBQSxRQUFhLFdBQVc7QUFBQSxRQUFNLGFBQWE7QUFBQSxRQUFPLFdBQVc7QUFBQSxRQUM5RSxlQUFlO0FBQUEsUUFBTyxnQkFBZ0I7QUFBQSxRQUFNLGNBQWM7QUFBQSxNQUMzRDtBQUNBLFlBQU0sY0FBYyxJQUFJLGdCQUFzQjtBQUM5QyxZQUFNLGFBQWEsSUFBSSxnQkFBc0I7QUFDN0MsWUFBTSxlQUFlLElBQUksZ0JBQXNCO0FBQy9DLFlBQU0sY0FBYyxJQUFJLGdCQUFrRDtBQUMxRSxZQUFNLElBQUksRUFBRSxTQUFTLE1BQU07QUFBRSxhQUFLLFdBQVcsU0FBUztBQUFHLGFBQUssWUFBWSxTQUFTLFFBQVE7QUFBQSxNQUFHLEVBQUUsQ0FBQztBQUNqRyxZQUFNLFFBQStDLENBQUM7QUFDdEQsWUFBTSxVQUFvRCxDQUFDO0FBQzNELFlBQU0sV0FBcUIsQ0FBQztBQUM1QixVQUFJLFlBQVk7QUFDaEIsWUFBTSxvQkFBb0IsTUFBTSxJQUFJLElBQUksUUFBYyxDQUFDO0FBQ3ZELFlBQU0saUJBQWlCLE1BQU0sSUFBSSxJQUFJLFFBQWdCLENBQUM7QUFDdEQsWUFBTSxpQkFBaUIsTUFBTSxJQUFJLElBQUksUUFBYyxDQUFDO0FBQ3BELFlBQU0sUUFBUSxPQUFPLFlBQW9EO0FBQ3hFLGdCQUFRLEtBQUssT0FBTztBQUNwQixhQUFLLGFBQWEsU0FBUztBQUMzQixlQUFPLGFBQWEsWUFBWSxJQUFJO0FBQUEsTUFDckM7QUFDQSxZQUFNLGFBQWE7QUFBQSxRQUNsQixtQkFBbUIsTUFBTSxNQUFNO0FBQUEsUUFDL0Isb0JBQW9CLE9BQU8sRUFBRSxNQUFNLE1BQU0sWUFBWSxjQUF1QixlQUF3QjtBQUFBLFFBQ3BHLHVCQUF1QixPQUFPO0FBQUEsVUFDN0IsZ0JBQWdCLE1BQU07QUFBQSxVQUN0QixvQkFBb0I7QUFBQSxZQUNuQixvQkFBb0I7QUFBQSxZQUFzQixnQkFBZ0I7QUFBQSxZQUMxRCxvQkFBb0IsTUFBTSxpQkFBaUIsY0FBdUI7QUFBQSxVQUNuRTtBQUFBLFFBQ0Q7QUFBQSxRQUNBLHVCQUF1QixrQkFBa0I7QUFBQSxRQUN6QyxpQkFBaUIsT0FBTyxZQUFpRDtBQUN4RSxnQkFBTSxLQUFLLE9BQU87QUFDbEIsZUFBSyxZQUFZLFNBQVM7QUFDMUIsZ0JBQU0sV0FBVztBQUNqQixpQkFBTyxFQUFFLFdBQVcsTUFBTSxRQUFRLElBQUksTUFBTSxRQUFRLE1BQU0sYUFBYSxVQUFVO0FBQUEsUUFDbEY7QUFBQSxRQUNBLElBQUkscUJBQXFCO0FBQUUsaUJBQU8sTUFBTSxlQUFlLFFBQVE7QUFBQSxRQUFXO0FBQUEsTUFDM0U7QUFDQSxZQUFNLFVBQWdDO0FBQUEsUUFDckMsZUFBZTtBQUFBLFFBQ2Ysb0JBQW9CLE1BQU0sTUFBTTtBQUFBLFFBQ2hDLHNCQUFzQixNQUFNLE1BQU0sY0FBYztBQUFBLFFBQ2hELDJCQUEyQixNQUFNLE1BQU07QUFBQSxRQUN2QyxlQUFlLE1BQU0sTUFBTTtBQUFBLFFBQzNCLDBCQUEwQixlQUFlO0FBQUEsUUFDekMsb0JBQW9CLGVBQWU7QUFBQSxRQUNuQyxvQkFBb0IsTUFBTTtBQUFFLGdCQUFNLElBQUksTUFBTSxVQUFVO0FBQUEsUUFBRztBQUFBLE1BQzFEO0FBQ0EsWUFBTSxXQUFXLE9BQU87QUFBQSxRQUN2QixZQUFZO0FBQUEsUUFBRyxTQUFTO0FBQUEsUUFDeEIsT0FBTyxNQUFNLGdCQUNWLEVBQUUsTUFBTSxtQkFBNEIsV0FBVyxhQUFhLFFBQVEsY0FBdUIsSUFDM0YsRUFBRSxNQUFNLGVBQXdCLFdBQVcsWUFBWTtBQUFBLFFBQzFELFNBQVMsQ0FBQztBQUFBLE1BQ1g7QUFDQSxZQUFNLFVBQWdDO0FBQUEsUUFDckMsZUFBZTtBQUFBLFFBQVcsYUFBYSxlQUFlO0FBQUEsUUFBTyxhQUFhO0FBQUEsUUFDMUUsZUFBZSxNQUFNLDRCQUE0QixTQUFTLEVBQUUsT0FBTztBQUFBLFVBQ2xFLGdCQUFnQixNQUFNO0FBQUEsVUFBVyxnQkFBZ0IsTUFBTTtBQUFBLFVBQ3ZELGlCQUFpQixNQUFNO0FBQUEsVUFBVyxvQkFBb0IsTUFBTSxjQUFjO0FBQUEsUUFDM0UsQ0FBQztBQUFBLFFBQ0QsdUJBQXVCLE1BQU0sTUFBTSxlQUFlLE1BQU07QUFBQSxRQUN4RCxTQUFTLFlBQVk7QUFBQSxRQUFFO0FBQUEsUUFBRyxpQkFBaUIsTUFBTTtBQUFFO0FBQUEsUUFBYTtBQUFBLFFBQUcsdUJBQXVCLE1BQU07QUFBQSxRQUFFO0FBQUEsTUFDbkc7QUFDQSxZQUFNLGdCQUFnQiw4QkFBOEIsUUFBVyxLQUFLO0FBQ3BFLG9CQUFjLEtBQUssNkJBQTZCLElBQUksK0JBQStCLENBQUM7QUFDcEYsb0JBQWMsS0FBSyx5QkFBeUIsSUFBSSwyQkFBMkIsQ0FBQztBQUM1RSxvQkFBYyxLQUFLLHdCQUF3QixnQ0FBZ0MsQ0FBQztBQUM1RSxvQkFBYyxLQUFLLHdCQUF3QjtBQUFBLFFBQzFDLGVBQWU7QUFBQSxRQUFXLE1BQU0sTUFBTTtBQUFBLFFBQ3RDLFdBQVcsT0FBTSxZQUFXO0FBQUUsZ0JBQU07QUFBQSxRQUFTO0FBQUEsTUFDOUMsQ0FBa0M7QUFDbEMsb0JBQWMsS0FBSywwQkFBMEIsVUFBVTtBQUN2RCxvQkFBYyxLQUFLLHNCQUFzQixPQUFPO0FBQ2hELG9CQUFjLEtBQUssc0JBQXNCLE9BQU87QUFDaEQsb0JBQWMsS0FBSyxpQkFBaUI7QUFBQSxRQUNuQyxHQUFHO0FBQUEsUUFBb0IsZ0JBQWdCLE9BQVUsT0FBdUM7QUFBRSxtQkFBUyxLQUFLLEVBQUU7QUFBRyxpQkFBTztBQUFBLFFBQVc7QUFBQSxNQUNoSSxDQUEyQjtBQUMzQixvQkFBYyxLQUFLLGVBQWU7QUFBQSxRQUNqQyxVQUFVLFlBQVk7QUFBQSxRQUFNLDJCQUEyQixNQUFNO0FBQUEsUUFBTSxvQ0FBb0MsTUFBTTtBQUFBLE1BQzlHLENBQTZCO0FBQzdCLFlBQU0sTUFBeUI7QUFBQSxRQUM5QixVQUFVLElBQUksTUFBTSwwQ0FBMEM7QUFBQSxRQUFHLFVBQVUsSUFBSSxNQUFNLDBDQUEwQztBQUFBLFFBQy9ILFNBQVM7QUFBQSxRQUFlLFFBQVE7QUFBQSxRQUFVLFdBQVc7QUFBQSxRQUFhLFNBQVM7QUFBQSxRQUFZLFlBQVk7QUFBQSxRQUFZLE1BQU07QUFBQSxNQUN0SDtBQUNBLG9CQUFjLEtBQUssYUFBYSx5QkFBeUIsSUFBSSxRQUFRLENBQUM7QUFDdEUsWUFBTSxTQUFTLGNBQWMsSUFBSSxhQUFhO0FBQzlDLFlBQU0sV0FBVyxjQUFjLElBQUksaUJBQWlCO0FBQ3BELFlBQU0sT0FBTyxPQUFPLFVBQTZCO0FBQ2hELGVBQU8sR0FBRyxNQUFNLFFBQVE7QUFDeEIsWUFBSSxDQUFDLE9BQU8sU0FBUyxNQUFNLFFBQVEsR0FBRztBQUFFLGdCQUFNLElBQUksT0FBTyxZQUFZLGNBQWMsTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUFBLFFBQUc7QUFDM0csWUFBSSxDQUFDLE9BQU8sU0FBUyxNQUFNLFFBQVEsR0FBRztBQUFFLGdCQUFNLElBQUksT0FBTyxZQUFZLGNBQWMsTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUFBLFFBQUc7QUFFM0csY0FBTSxJQUFJLE1BQU0sU0FBUyxxQkFBcUIsTUFBTSxRQUFRLENBQUM7QUFDN0QsY0FBTSxJQUFJLE1BQU0sU0FBUyxxQkFBcUIsTUFBTSxRQUFRLENBQUM7QUFBQSxNQUM5RDtBQUNBLFlBQU0sU0FBUyxTQUFTLGNBQWMsS0FBSztBQUMzQyxlQUFTLEtBQUssWUFBWSxNQUFNO0FBQ2hDLFlBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxPQUFPLE9BQU8sRUFBRSxDQUFDO0FBQzVDLFlBQU0sZUFBZSxNQUFNLElBQUksY0FBYyxlQUFlLHVCQUF1QixDQUFDO0FBQ3BGLG9CQUFjLEtBQUssMEJBQTBCLFlBQVk7QUFDekQsVUFBSTtBQUNKLFVBQUk7QUFDSixZQUFNLFFBQVEsTUFBTSxJQUFJLElBQUksNEJBQTRCLElBQUksVUFBVSxJQUFJLFVBQVUsSUFBSSxTQUFTLEdBQUcsQ0FBQztBQUNyRyxVQUFJLFNBQVMsUUFBUTtBQUNwQixlQUFPLE1BQU0sSUFBSSxjQUFjLGVBQWUsNEJBQTRCLElBQUksb0JBQW9CLENBQUMsQ0FBQyxDQUFDO0FBQ3JHLGFBQUssT0FBTyxNQUFNO0FBQ2xCLGNBQU0sS0FBSyxHQUFHO0FBQ2QsY0FBTSxLQUFLLFNBQVMsT0FBTyxRQUFXLHVCQUFPLE9BQU8sSUFBSSxHQUFHLGtCQUFrQixJQUFJO0FBQ2pGLGVBQU8sWUFBWSxLQUFLLHNCQUFzQixHQUFHLEtBQUs7QUFBQSxNQUN2RCxPQUFPO0FBQ04sZ0JBQVEsTUFBTSxJQUFJLGNBQWMsZUFBZSxzQkFBc0IsRUFBRSxJQUFJLDRCQUE0QixPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQ3ZILGNBQU0sT0FBTztBQUNiLGVBQU8sWUFBWSxNQUFNLE9BQU87QUFDaEMsY0FBTSxLQUFLLEdBQUc7QUFDZCxlQUFPLFlBQVksTUFBTSxhQUFhLEtBQUssR0FBRyxHQUFHLElBQUk7QUFBQSxNQUN0RDtBQUNBLFlBQU0sT0FBUSxRQUFRO0FBQ3RCLHNCQUFnQixNQUFNLENBQUM7QUFDdkIsWUFBTSxTQUFTLE9BQU8sY0FBYyxTQUFTLFNBQVMscUNBQXFDLDRCQUE0QjtBQUN2SCxhQUFPLEdBQUcsa0JBQWtCLGlCQUFpQjtBQUM3QyxhQUFPLFlBQVksT0FBTyxNQUFNLFNBQVMsRUFBRTtBQUMzQyxZQUFNLFNBQVMsT0FBTyxjQUFjLFNBQVMsU0FBUyxxQ0FBcUMsbUNBQW1DO0FBQzlILGFBQU8sR0FBRyxrQkFBa0IsV0FBVztBQUN2QyxZQUFNLE1BQU0sTUFBTyxLQUFtRCxVQUFVO0FBQ2hGLFlBQU0sVUFBVSxPQUFPLFNBQWdDLGNBQTZCO0FBQ25GLGNBQU0sUUFBUSxLQUFLLENBQUMsUUFBUSxHQUFHLFVBQVUsS0FBSyxNQUFNO0FBQUUsZ0JBQU0sSUFBSSxNQUFNLGlEQUFpRDtBQUFBLFFBQUcsQ0FBQyxDQUFDLENBQUM7QUFBQSxNQUM5SDtBQUNBLGFBQU87QUFBQSxRQUNOO0FBQUEsUUFBTztBQUFBLFFBQU87QUFBQSxRQUFTO0FBQUEsUUFBVTtBQUFBLFFBQVE7QUFBQSxRQUN6QztBQUFBLFFBQVk7QUFBQSxRQUFhO0FBQUEsUUFBYztBQUFBLFFBQ3ZDLGFBQWEsQ0FBQyxjQUE2QixRQUFRLGFBQWEsU0FBUztBQUFBLFFBQ3pFLGNBQWMsQ0FBQyxjQUE2QixRQUFRLGNBQWMsU0FBUztBQUFBLFFBQzNFLFFBQVEsTUFBTTtBQUFFLHlCQUFlLEtBQUssTUFBTSxlQUFlO0FBQUcsNEJBQWtCLEtBQUs7QUFBRyx5QkFBZSxLQUFLO0FBQUEsUUFBRztBQUFBLFFBQzdHLFlBQVksT0FBTyxFQUFFLE9BQU8sU0FBUyxVQUFVLFVBQVU7QUFBQSxRQUN6RCxXQUFXLE1BQU07QUFDaEIsZ0JBQU0sVUFBVSxTQUFTLEVBQUU7QUFDM0IsaUJBQU8sRUFBRSxTQUFTLFFBQVEsMEJBQTJCLEdBQUcsVUFBVSxRQUFRLE1BQU0sV0FBVyxRQUFRLFNBQVMsb0JBQW9CLFFBQVEsU0FBUyxPQUFVO0FBQUEsUUFDNUo7QUFBQSxRQUNBLGlCQUFpQixNQUFNLE9BQU8sV0FBVyx1QkFBdUI7QUFBQSxRQUNoRSxZQUFZLE9BQU8sV0FBeUI7QUFDM0MsY0FBSSxXQUFXLGlCQUFpQjtBQUFFLG1CQUFPLEdBQUcsSUFBSTtBQUFHLGtCQUFNLFFBQVE7QUFBRyxtQkFBTyxZQUFZLEtBQUssT0FBTyxLQUFLO0FBQUc7QUFBQSxVQUFRO0FBQ25ILGNBQUksV0FBVyxXQUFXO0FBQUUsaUJBQUssUUFBUTtBQUFHO0FBQUEsVUFBUTtBQUNwRCxjQUFJLFdBQVcsV0FBVyxXQUFXLHFCQUFxQjtBQUN6RCxnQkFBSSxNQUFNO0FBQUUsbUJBQUssV0FBVztBQUFBLFlBQUcsT0FBTztBQUFFLDJCQUFhLE1BQU07QUFBQSxZQUFHO0FBQzlELGdCQUFJLFdBQVcsU0FBUztBQUFFO0FBQUEsWUFBUTtBQUNsQyxnQkFBSSxNQUFNO0FBQUUsb0JBQU0sS0FBSyxTQUFTLE9BQU8sUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUFBLFlBQUcsT0FDM0Y7QUFBRSxxQkFBTyxZQUFZLE1BQU0sYUFBYSxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsWUFBRztBQUMvRDtBQUFBLFVBQ0Q7QUFDQSxnQkFBTSxPQUEwQixFQUFFLEdBQUcsS0FBSyxVQUFVLElBQUksTUFBTSxzQ0FBc0MsR0FBRyxVQUFVLElBQUksTUFBTSwrQ0FBK0MsRUFBRTtBQUM1SyxnQkFBTSxLQUFLLElBQUk7QUFDZixjQUFJLE1BQU07QUFDVCxrQkFBTSxZQUFZLE1BQU0sSUFBSSxJQUFJLDRCQUE0QixLQUFLLFVBQVUsS0FBSyxVQUFVLEtBQUssU0FBUyxJQUFJLENBQUM7QUFDN0csa0JBQU0sS0FBSyxTQUFTLFdBQVcsUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUFBLFVBQ3RGLE9BQU87QUFBRSxtQkFBTyxZQUFZLE1BQU0sYUFBYSxLQUFLLElBQUksR0FBRyxJQUFJO0FBQUEsVUFBRztBQUFBLFFBQ25FO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFFBR0E7QUFBQSxNQUNMLEVBQUUsTUFBTSxnREFBZ0QsUUFBUSxPQUFPLFFBQVEsV0FBUztBQUFFLGNBQU0sa0JBQWtCO0FBQUEsTUFBYSxHQUFHLGVBQWUsS0FBSztBQUFBLE1BQ3RKLEVBQUUsTUFBTSxnREFBZ0QsUUFBUSxPQUFPLFFBQVEsV0FBUztBQUFFLGNBQU0sa0JBQWtCO0FBQUEsTUFBSSxHQUFHLGVBQWUsS0FBSztBQUFBLE1BQzdJLEVBQUUsTUFBTSwrREFBK0QsUUFBUSxNQUFNLFFBQVEsTUFBTTtBQUFBLE1BQUUsRUFBRTtBQUFBLE1BQ3ZHLEVBQUUsTUFBTSxnREFBZ0QsUUFBUSxNQUFNLFFBQVEsQ0FBQyxPQUFPLFdBQVc7QUFBRSxjQUFNLGtCQUFrQjtBQUFhLGVBQU87QUFBRyxjQUFNLGtCQUFrQjtBQUFBLE1BQWEsRUFBRTtBQUFBLE1BQ3pMLEVBQUUsTUFBTSxnQ0FBZ0MsUUFBUSxPQUFPLFFBQVEsV0FBUztBQUFFLGNBQU0sWUFBWTtBQUFBLE1BQU8sRUFBRTtBQUFBLE1BQ3JHLEVBQUUsTUFBTSxnQ0FBZ0MsUUFBUSxPQUFPLFFBQVEsV0FBUztBQUFFLGNBQU0sY0FBYztBQUFBLE1BQU0sRUFBRTtBQUFBLE1BQ3RHLEVBQUUsTUFBTSxnRUFBZ0UsUUFBUSxPQUFPLFFBQVEsV0FBUztBQUFFLGNBQU0sWUFBWTtBQUFBLE1BQWUsR0FBRyxTQUFTLGNBQWM7QUFBQSxNQUNySyxFQUFFLE1BQU0sc0RBQXNELFFBQVEsT0FBTyxRQUFRLFdBQVM7QUFBRSxjQUFNLGdCQUFnQjtBQUFBLE1BQU0sR0FBRyxXQUFXLEtBQUs7QUFBQSxNQUMvSSxFQUFFLE1BQU0sZ0RBQWdELFFBQVEsT0FBTyxRQUFRLFdBQVM7QUFBRSxjQUFNLGlCQUFpQjtBQUFBLE1BQU8sRUFBRTtBQUFBLE1BQzFILEVBQUUsTUFBTSwwQ0FBMEMsUUFBUSxPQUFPLFFBQVEsV0FBUztBQUFFLGNBQU0sZUFBZTtBQUFBLE1BQU8sRUFBRTtBQUFBLE1BQ2xILEVBQUUsTUFBTSwwREFBMEQsUUFBUSxNQUFNLFFBQVEsQ0FBQyxPQUFPLFdBQVc7QUFBRSxjQUFNLFlBQVk7QUFBZSxlQUFPO0FBQUcsY0FBTSxZQUFZO0FBQUEsTUFBUyxFQUFFO0FBQUEsTUFDckwsRUFBRSxNQUFNLDhEQUE4RCxRQUFRLE1BQU0sUUFBUSxDQUFDLE9BQU8sV0FBVztBQUFFLGNBQU0sZ0JBQWdCO0FBQU0sZUFBTztBQUFHLGNBQU0sZ0JBQWdCO0FBQUEsTUFBTyxFQUFFO0FBQUEsTUFDdEwsRUFBRSxNQUFNLDhEQUE4RCxRQUFRLE1BQU0sUUFBUSxDQUFDLE9BQU8sV0FBVztBQUFFLGNBQU0sWUFBWTtBQUFPLGVBQU87QUFBRyxjQUFNLFlBQVk7QUFBQSxNQUFNLEVBQUU7QUFBQSxJQUMvSztBQUNBLGVBQVcsUUFBUSxDQUFDLFFBQVEsT0FBTyxHQUFZO0FBQzlDLGlCQUFXLFlBQVksT0FBTztBQUM3QixhQUFLLEdBQUcsSUFBSSxJQUFJLFNBQVMsSUFBSSxJQUFJLFlBQVk7QUFDNUMsZ0JBQU0sSUFBSSxNQUFNLHVCQUF1QixJQUFJO0FBQzNDLGdCQUFNLFlBQVksRUFBRSxJQUFJO0FBQ3hCLGNBQUk7QUFDSCxrQkFBTSxFQUFFLFlBQVksU0FBUztBQUM3QixtQkFBTyxnQkFBZ0IsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDO0FBQzlDLHFCQUFTLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTTtBQUNqQyxjQUFFLE9BQU87QUFDVCxtQkFBTyxnQkFBZ0IsRUFBRSxVQUFVLEdBQUcsRUFBRSxTQUFTLFNBQVMsV0FBVyxTQUFTLFVBQVUsU0FBUyxZQUFZLG9CQUFvQixlQUFlLFdBQVcsU0FBUyxZQUFZLGdCQUFnQixPQUFVLENBQUM7QUFDM00sbUJBQU8sWUFBWSxFQUFFLGdCQUFnQixHQUFHLEVBQUUsTUFBTSxjQUFjLHNGQUFzRjtBQUNwSixrQkFBTSxFQUFFLFdBQVcsU0FBUztBQUM1QixrQkFBTTtBQUNOLG1CQUFPLGdCQUFnQixFQUFFLFdBQVcsR0FBRyxFQUFFLE9BQU8sQ0FBQyxZQUFZLEdBQUcsU0FBUyxTQUFTLFNBQVMsQ0FBQyxhQUFhLElBQUksQ0FBQyxHQUFHLFVBQVUsQ0FBQyxHQUFHLFdBQVcsU0FBUyxTQUFTLElBQUksRUFBRSxDQUFDO0FBQ25LLGdCQUFJLFNBQVMsZUFBZTtBQUFFLHFCQUFPLFlBQVksRUFBRSxPQUFPLGFBQWEsZ0NBQWdDLENBQUM7QUFBQSxZQUFHO0FBQUEsVUFDNUcsVUFBRTtBQUFVLGtCQUFNLEVBQUUsV0FBVyxTQUFTO0FBQUcsa0JBQU07QUFBQSxVQUFXO0FBQUEsUUFDN0QsQ0FBQztBQUFBLE1BQ0Y7QUFDQSxpQkFBVyxVQUFVLENBQUMsV0FBVyxTQUFTLFdBQVcsbUJBQW1CLEdBQVk7QUFDbkYsYUFBSyxHQUFHLElBQUksT0FBTyxNQUFNLHVDQUF1QyxZQUFZO0FBQzNFLGdCQUFNLElBQUksTUFBTSx1QkFBdUIsSUFBSTtBQUMzQyxnQkFBTSxZQUFZLEVBQUUsSUFBSTtBQUN4QixjQUFJO0FBQ0gsa0JBQU0sRUFBRSxZQUFZLFNBQVM7QUFDN0Isa0JBQU0sRUFBRSxXQUFXLE1BQU07QUFDekIsa0JBQU0sU0FBUyxFQUFFLE9BQU87QUFDeEIsa0JBQU0sRUFBRSxXQUFXLFNBQVM7QUFDNUIsa0JBQU07QUFDTixtQkFBTyxnQkFBZ0IsRUFBRSxXQUFXLEdBQUcsRUFBRSxPQUFPLENBQUMsWUFBWSxHQUFHLFNBQVMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxHQUFHLFdBQVcsRUFBRSxDQUFDO0FBQ3pHLG1CQUFPLFlBQVksRUFBRSxPQUFPLGFBQWEsTUFBTTtBQUFBLFVBQ2hELFVBQUU7QUFBVSxrQkFBTSxFQUFFLFdBQVcsU0FBUztBQUFHLGtCQUFNO0FBQUEsVUFBVztBQUFBLFFBQzdELENBQUM7QUFBQSxNQUNGO0FBQ0EsWUFBTSxvQkFBNkMsU0FBUyxTQUFTLENBQUMsV0FBVyxXQUFXLGVBQWUsSUFBSSxDQUFDLFdBQVcsU0FBUztBQUNwSSxpQkFBVyxVQUFVLG1CQUFtQjtBQUN2QyxtQkFBVyxXQUFXLENBQUMsWUFBWSxVQUFVLFVBQVUsR0FBWTtBQUNsRSxlQUFLLEdBQUcsSUFBSSx1QkFBdUIsTUFBTSxVQUFVLE9BQU8sMEJBQTBCLFlBQVk7QUFDL0Ysa0JBQU0sSUFBSSxNQUFNLHVCQUF1QixNQUFNLElBQUk7QUFDakQsa0JBQU0sWUFBWSxFQUFFLElBQUk7QUFDeEIsZ0JBQUk7QUFDSCxvQkFBTSxFQUFFLFlBQVksU0FBUztBQUM3QixvQkFBTSxFQUFFLFdBQVcsU0FBUztBQUM1QixvQkFBTSxFQUFFLGFBQWEsU0FBUztBQUM5QixxQkFBTyxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsYUFBYSxHQUFHLHdDQUF3QztBQUMzRixvQkFBTSxFQUFFLFdBQVcsTUFBTTtBQUN6QixvQkFBTSxTQUFTLEVBQUUsT0FBTztBQUN4QixrQkFBSSxZQUFZLFlBQVk7QUFBRSxzQkFBTSxFQUFFLFlBQVksTUFBTSxJQUFJLE1BQU0seUJBQXlCLENBQUM7QUFBQSxjQUFHLE9BQzFGO0FBQUUsc0JBQU0sRUFBRSxZQUFZLFNBQVMsWUFBWSxhQUFhLFdBQVcsRUFBRSxHQUFHLFVBQVUsU0FBUyxPQUFPLGNBQWMsMkJBQTJCLFVBQVUsRUFBRSxDQUFDO0FBQUEsY0FBRztBQUNoSyxvQkFBTTtBQUNOLHFCQUFPLGdCQUFnQixFQUFFLFdBQVcsR0FBRyxFQUFFLE9BQU8sQ0FBQyxZQUFZLEdBQUcsU0FBUyxDQUFDLGFBQWEsR0FBRyxVQUFVLENBQUMsR0FBRyxXQUFXLEVBQUUsQ0FBQztBQUN0SCxxQkFBTyxZQUFZLEVBQUUsT0FBTyxhQUFhLE1BQU07QUFBQSxZQUNoRCxVQUFFO0FBQVUsb0JBQU0sRUFBRSxXQUFXLFNBQVM7QUFBRyxvQkFBTSxFQUFFLFlBQVksU0FBUyxRQUFRO0FBQUcsb0JBQU07QUFBQSxZQUFXO0FBQUEsVUFDckcsQ0FBQztBQUFBLFFBQ0Y7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELFFBQU0sMEJBQTBCO0FBQUEsSUFDL0I7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0QsRUFBRSxLQUFLLElBQUk7QUFZWCxXQUFTLGdCQUFnQixNQUFjLFlBQXdDLENBQUMsR0FBc0I7QUFDckcsV0FBTztBQUFBLE1BQ04sVUFBVSxJQUFJLEtBQUssRUFBRSxRQUFRLG9CQUFvQixNQUFNLGFBQWEsSUFBSSxHQUFHLENBQUM7QUFBQSxNQUM1RSxVQUFVLElBQUksS0FBSyxFQUFFLFFBQVEsb0JBQW9CLE1BQU0sYUFBYSxJQUFJLEdBQUcsQ0FBQztBQUFBLE1BQzVFLFNBQVM7QUFBQSxNQUNULFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxNQUNYLFNBQVM7QUFBQSxNQUNULFlBQVk7QUFBQSxNQUNaLE1BQU07QUFBQSxNQUNOLEdBQUc7QUFBQSxJQUNKO0FBQUEsRUFDRDtBQUVBLGlCQUFlLHFCQUFxQkEsT0FBcUIsU0FXM0I7QUFDN0IsVUFBTSxhQUF1RCxDQUFDO0FBQzlELFVBQU0sWUFBbUQsQ0FBQztBQUMxRCxVQUFNLGNBQXdCLENBQUM7QUFDL0IsVUFBTSxlQUFlLEVBQUUsR0FBRyxFQUFFO0FBQzVCLFVBQU0sY0FBYyxRQUFRLGVBQWU7QUFDM0MsVUFBTSxZQUFZLFFBQVEsYUFBYTtBQUN2QyxVQUFNLGNBQWdEO0FBQUEsTUFDckQsV0FBVztBQUFBLE1BQ1gsUUFBUTtBQUFBLE1BQ1IsU0FBUyxRQUFRLGdCQUFnQjtBQUFBLE1BQ2pDLGNBQWMsUUFBUSxxQkFBcUI7QUFBQSxNQUMzQyxVQUFVLFFBQVEsaUJBQWlCLFFBQVEsSUFBSTtBQUFBLE1BQy9DLFFBQVE7QUFBQSxJQUNUO0FBQ0EsVUFBTSxhQUFhO0FBQUEsTUFDbEIsbUJBQW1CLE1BQU07QUFBQSxNQUN6QixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sWUFBWSxjQUF1QixlQUF3QjtBQUFBLE1BQzlGLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLE1BQU07QUFBQSxNQUN0RCx1QkFBdUIsTUFBTTtBQUFBLE1BQzdCLGlCQUFpQixPQUFPLFlBQWlEO0FBQ3hFLGtCQUFVLEtBQUssT0FBTztBQUN0QixlQUFPLEVBQUUsV0FBVyxNQUFNLFFBQVEsSUFBSSxNQUFNLFFBQVEsTUFBTSxZQUFZO0FBQUEsTUFDdkU7QUFBQSxNQUNBLG9CQUFvQixPQUFPLFlBQW9EO0FBQzlFLG1CQUFXLEtBQUssT0FBTztBQUN2QixlQUFPO0FBQUEsTUFDUjtBQUFBLE1BQ0Esb0JBQW9CLFlBQVk7QUFBQSxJQUNqQztBQUNBLFVBQU0sU0FBUyxRQUFRLFdBQVcsUUFBUSxJQUFJLFdBQVcsV0FBVyxLQUFLQSxPQUFNLCtCQUErQjtBQUM5RyxVQUFNLHVCQUF1Qix3QkFBd0I7QUFBQSxNQUNwRCxhQUFhO0FBQUEsTUFDYixVQUFVO0FBQUEsTUFDVixTQUFTLFFBQVEsY0FBYztBQUFBLE1BQy9CO0FBQUEsTUFDQSxvQkFBb0IsUUFBUSxzQkFBc0I7QUFBQSxNQUNsRCxnQkFBZ0IsT0FBTyxjQUF1QjtBQUM3QyxvQkFBWSxLQUFLLE9BQU8sU0FBUyxDQUFDO0FBQUEsTUFDbkM7QUFBQSxJQUNELENBQUM7QUFDRCxRQUFJLFFBQVEsZUFBZSxRQUFRLGNBQWM7QUFDaEQsMkJBQXFCLEtBQUssc0JBQXNCO0FBQUEsUUFDL0MsYUFBYSxNQUFNO0FBQUEsUUFDbkIsYUFBYSxPQUFPO0FBQUEsVUFDbkIsWUFBWTtBQUFBLFVBQ1osU0FBUztBQUFBLFVBQ1QsT0FBTyxRQUFRLGNBQ1osRUFBRSxNQUFNLG1CQUFtQixXQUFXLGFBQWEsUUFBUSxjQUFjLElBQ3pFLEVBQUUsTUFBTSxNQUFNO0FBQUEsVUFDakIsU0FBUyxDQUFDO0FBQUEsUUFDWDtBQUFBLFFBQ0EsZUFBZSxNQUFNLENBQUMsQ0FBQyxRQUFRO0FBQUEsUUFDL0IsdUJBQXVCLE1BQU0sQ0FBQyxDQUFDLFFBQVE7QUFBQSxRQUN2QyxTQUFTLFlBQVk7QUFBQSxRQUNyQixpQkFBaUIsTUFBTTtBQUFFLHVCQUFhO0FBQUEsUUFBSztBQUFBLFFBQzNDLHVCQUF1QixNQUFNO0FBQUEsTUFDOUIsQ0FBb0M7QUFBQSxJQUNyQztBQUNBLHlCQUFxQixLQUFLLGVBQWU7QUFBQSxNQUN4QyxVQUFVLFlBQVk7QUFBQSxNQUN0QiwyQkFBMkIsTUFBTTtBQUFBLE1BQ2pDLG9DQUFvQyxNQUFNO0FBQUEsSUFDM0MsQ0FBNkI7QUFDN0IsVUFBTSxlQUFlLE1BQU0sSUFBSSxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMzRix5QkFBcUIsS0FBSywwQkFBMEIsWUFBWTtBQUNoRSxVQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLHNCQUFzQjtBQUFBLE1BQ2hGLElBQUk7QUFBQSxNQUNKLE9BQU87QUFBQSxJQUNSLENBQUMsQ0FBQztBQUNGLFNBQUssT0FBTztBQUNaLFVBQU0sYUFBYSxLQUFLLFFBQVEsR0FBRztBQUNuQyxVQUFNLFFBQVEsRUFBRTtBQUNoQiwwQkFBc0IsSUFBSTtBQUUxQixVQUFNLE9BQU8sTUFBTSxJQUFJLHFCQUFxQixlQUFlLDRCQUE0QixJQUFJLG9CQUFvQixDQUFDLENBQUMsQ0FBQztBQUNsSCxVQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsYUFBUyxLQUFLLFlBQVksTUFBTTtBQUNoQyxVQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sT0FBTyxPQUFPLEVBQUUsQ0FBQztBQUM1QyxTQUFLLE9BQU8sTUFBTTtBQUNsQixVQUFNLFFBQVEsTUFBTSxJQUFJLElBQUksNEJBQTRCLFFBQVEsSUFBSSxVQUFVLFFBQVEsSUFBSSxVQUFVLFFBQVEsSUFBSSxTQUFTO0FBQUEsTUFDeEgsUUFBUSxRQUFRLElBQUk7QUFBQSxNQUNwQixXQUFXLFFBQVEsSUFBSTtBQUFBLE1BQ3ZCLFNBQVMsUUFBUSxJQUFJO0FBQUEsTUFDckIsWUFBWSxRQUFRLElBQUk7QUFBQSxNQUN4QixNQUFNLFFBQVEsSUFBSTtBQUFBLElBQ25CLENBQUMsQ0FBQztBQUNGLFVBQU0sS0FBSyxTQUFTLE9BQU8sUUFBVyx1QkFBTyxPQUFPLElBQUksR0FBRyxrQkFBa0IsSUFBSTtBQUNqRixVQUFNLFFBQVEsRUFBRTtBQUNoQiwyQkFBdUIsSUFBSTtBQUMzQixXQUFPLEVBQUUsTUFBTSxNQUFNLFFBQVEsWUFBWSxXQUFXLGFBQWEsYUFBYTtBQUFBLEVBQy9FO0FBRUEsV0FBUyxnQkFBZ0IsTUFBYyxNQUFjLE9BQXNCLE9BQWE7QUFDdkYsSUFBQyxLQUFpRSxlQUFlLEVBQUUsTUFBTSxLQUFLO0FBQUEsRUFDL0Y7QUFFQSxXQUFTLG9CQUFvQixNQUEyRCxVQUEwQjtBQUNqSCxXQUFRLEtBQUssY0FBYyxRQUFRLEdBQTBCLE1BQU0sV0FBVztBQUFBLEVBQy9FO0FBRUEsV0FBUyxhQUFhLE1BQXNCO0FBQzNDLFdBQVEsS0FBa0Usa0JBQWtCLEdBQUcsV0FBVztBQUFBLEVBQzNHO0FBRUEsaUJBQWUsY0FBYyxTQUEwQztBQUN0RSxVQUFPLFFBQVEsS0FBdUQsVUFBVTtBQUNoRixVQUFPLFFBQVEsS0FBdUQsVUFBVTtBQUFBLEVBQ2pGO0FBRUEsV0FBUyxtQkFBbUIsU0FBaUM7QUFDNUQsV0FBTyxZQUFZLG9CQUFvQixRQUFRLEtBQUssU0FBUyw0QkFBNEIsR0FBRyxNQUFNO0FBQ2xHLFdBQU8sWUFBWSxvQkFBb0IsUUFBUSxRQUFRLGtDQUFrQyxHQUFHLE1BQU07QUFBQSxFQUNuRztBQUVBLFdBQVMsa0JBQWtCLFNBQWlDO0FBQzNELFdBQU8sWUFBWSxvQkFBb0IsUUFBUSxLQUFLLFNBQVMsNEJBQTRCLEdBQUcsRUFBRTtBQUM5RixXQUFPLFlBQVksb0JBQW9CLFFBQVEsUUFBUSxrQ0FBa0MsR0FBRyxFQUFFO0FBQUEsRUFDL0Y7QUFFQSxPQUFLLGtFQUFrRSxpQkFBa0I7QUFDeEYsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLLGdCQUFnQixtQkFBbUIsRUFBRSxZQUFZLFlBQVksTUFBTSxXQUFXLENBQUM7QUFBQSxJQUNyRixDQUFDO0FBQ0Qsc0JBQWtCLE9BQU87QUFBQSxFQUMxQixDQUFDO0FBRUQsT0FBSyx3Q0FBd0MsaUJBQWtCO0FBQzlELFVBQU0sVUFBVSxNQUFNLHFCQUFxQixNQUFNO0FBQUEsTUFDaEQsS0FBSyxnQkFBZ0IsZUFBZSxFQUFFLFlBQVkscUJBQXFCLE1BQU0sV0FBVyxDQUFDO0FBQUEsSUFDMUYsQ0FBQztBQUNELHNCQUFrQixPQUFPO0FBQUEsRUFDMUIsQ0FBQztBQUVELE9BQUssNkNBQTZDLGlCQUFrQjtBQUNuRSxVQUFNLFdBQVcsV0FBVyxLQUFLLE1BQU0saUNBQWlDO0FBQ3hFLFVBQU0sVUFBVSxNQUFNLHFCQUFxQixNQUFNO0FBQUEsTUFDaEQsS0FBSztBQUFBLFFBQ0osVUFBVTtBQUFBLFFBQ1YsVUFBVSxXQUFXLEtBQUssTUFBTSxxQ0FBcUM7QUFBQSxRQUNyRSxTQUFTO0FBQUEsUUFDVCxRQUFRO0FBQUEsUUFDUixXQUFXO0FBQUEsUUFDWCxTQUFTO0FBQUEsUUFDVCxZQUFZO0FBQUEsUUFDWixNQUFNO0FBQUEsTUFDUDtBQUFBLE1BQ0EsVUFBVTtBQUFBLE1BQ1YsWUFBWTtBQUFBLElBQ2IsQ0FBQztBQUNELFdBQU8sWUFBWSxhQUFhLFFBQVEsSUFBSSxHQUFHLGFBQWE7QUFDNUQsV0FBTyxZQUFZLGFBQWEsUUFBUSxJQUFJLEdBQUcsYUFBYTtBQUM1RCx1QkFBbUIsT0FBTztBQUMxQixvQkFBZ0IsUUFBUSxNQUFNLENBQUM7QUFDL0Isb0JBQWdCLFFBQVEsTUFBTSxDQUFDO0FBQy9CLFVBQU0sY0FBYyxPQUFPO0FBQzNCLFdBQU8sZ0JBQWdCLFFBQVEsV0FBVyxDQUFDLENBQUM7QUFDNUMsV0FBTyxnQkFBZ0IsUUFBUSxZQUFZLENBQUMsQ0FBQztBQUFBLEVBQzlDLENBQUM7QUFFRCxPQUFLLDhCQUE4QixpQkFBa0I7QUFDcEQsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLLGdCQUFnQixvQkFBb0IsRUFBRSxNQUFNLGFBQWEsWUFBWSxXQUFXLENBQUM7QUFBQSxJQUN2RixDQUFDO0FBQ0QsdUJBQW1CLE9BQU87QUFBQSxFQUMzQixDQUFDO0FBRUQsT0FBSyxxREFBcUQsaUJBQWtCO0FBQzNFLFVBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSwrQkFBK0I7QUFDdEUsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLO0FBQUEsUUFDSixVQUFVO0FBQUEsUUFDVixVQUFVLFdBQVcsS0FBSyxNQUFNLG1DQUFtQztBQUFBLFFBQ25FLFNBQVM7QUFBQSxRQUNULFFBQVE7QUFBQSxRQUNSLFdBQVc7QUFBQSxRQUNYLFNBQVM7QUFBQSxRQUNULFlBQVk7QUFBQSxRQUNaLE1BQU07QUFBQSxNQUNQO0FBQUEsTUFDQSxVQUFVO0FBQUEsTUFDVixZQUFZO0FBQUEsSUFDYixDQUFDO0FBQ0QsV0FBTyxZQUFZLGFBQWEsUUFBUSxJQUFJLEdBQUcsYUFBYTtBQUM1RCx1QkFBbUIsT0FBTztBQUFBLEVBQzNCLENBQUM7QUFFRCxPQUFLLDJEQUEyRCxpQkFBa0I7QUFDakYsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLLGdCQUFnQixnQkFBZ0IsRUFBRSxTQUFTLFNBQVMsTUFBTSxZQUFZLFlBQVksV0FBVyxDQUFDO0FBQUEsSUFDcEcsQ0FBQztBQUNELFdBQU8sWUFBWSxhQUFhLFFBQVEsSUFBSSxHQUFHLE9BQU87QUFDdEQsV0FBTyxZQUFZLGFBQWEsUUFBUSxJQUFJLEdBQUcsT0FBTztBQUN0RCxzQkFBa0IsT0FBTztBQUFBLEVBQzFCLENBQUM7QUFFRCxPQUFLLHVEQUF1RCxpQkFBa0I7QUFDN0UsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLLGdCQUFnQixnQkFBZ0I7QUFBQSxNQUNyQyxXQUFXO0FBQUEsSUFDWixDQUFDO0FBQ0QsdUJBQW1CLE9BQU87QUFBQSxFQUMzQixDQUFDO0FBRUQsT0FBSyxvREFBb0QsaUJBQWtCO0FBQzFFLFVBQU0sVUFBVSxNQUFNLHFCQUFxQixNQUFNO0FBQUEsTUFDaEQsS0FBSyxnQkFBZ0IscUJBQXFCLEVBQUUsU0FBUyxHQUFHLENBQUM7QUFBQSxJQUMxRCxDQUFDO0FBQ0QsdUJBQW1CLE9BQU87QUFDMUIsb0JBQWdCLFFBQVEsTUFBTSxDQUFDO0FBQy9CLG9CQUFnQixRQUFRLE1BQU0sQ0FBQztBQUMvQixVQUFNLGNBQWMsT0FBTztBQUMzQixXQUFPLGdCQUFnQixRQUFRLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLFdBQU8sZ0JBQWdCLFFBQVEsWUFBWSxDQUFDLENBQUM7QUFBQSxFQUM5QyxDQUFDO0FBRUQsT0FBSyx1REFBdUQsaUJBQWtCO0FBQzdFLFVBQU0sVUFBVSxNQUFNLHFCQUFxQixNQUFNO0FBQUEsTUFDaEQsS0FBSyxnQkFBZ0Isd0JBQXdCLEVBQUUsV0FBVyxHQUFHLENBQUM7QUFBQSxJQUMvRCxDQUFDO0FBQ0QsdUJBQW1CLE9BQU87QUFDMUIsb0JBQWdCLFFBQVEsTUFBTSxDQUFDO0FBQy9CLG9CQUFnQixRQUFRLE1BQU0sQ0FBQztBQUMvQixVQUFNLGNBQWMsT0FBTztBQUMzQixXQUFPLGdCQUFnQixRQUFRLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLFdBQU8sZ0JBQWdCLFFBQVEsWUFBWSxDQUFDLENBQUM7QUFBQSxFQUM5QyxDQUFDO0FBRUQsT0FBSyxxRUFBcUUsaUJBQWtCO0FBQzNGLFVBQU0sVUFBVSxNQUFNLHFCQUFxQixNQUFNO0FBQUEsTUFDaEQsS0FBSyxnQkFBZ0IsZ0JBQWdCLEVBQUUsWUFBWSxZQUFZLE1BQU0sV0FBVyxDQUFDO0FBQUEsTUFDakYsY0FBYztBQUFBLElBQ2YsQ0FBQztBQUNELG9CQUFnQixRQUFRLE1BQU0sQ0FBQztBQUMvQixvQkFBZ0IsUUFBUSxNQUFNLENBQUM7QUFDL0IsVUFBTSxjQUFjLE9BQU87QUFFM0IsV0FBTyxZQUFZLFFBQVEsVUFBVSxRQUFRLENBQUM7QUFDOUMsZUFBVyxXQUFXLFFBQVEsV0FBVztBQUN4QyxhQUFPLFlBQVksUUFBUSxXQUFXLFdBQVc7QUFDakQsYUFBTyxZQUFZLFFBQVEsTUFBTSxVQUFVO0FBQzNDLGFBQU8sWUFBWSxRQUFRLFlBQVksVUFBVTtBQUFBLElBQ2xEO0FBQ0EsVUFBTSxXQUFXLDRCQUE0Qix5QkFBeUIsR0FBRyxLQUFLO0FBQzlFLFdBQU8sR0FBRyxRQUFRO0FBQ2xCLFdBQU8sWUFBWSxRQUFRLFdBQVcsUUFBUSxDQUFDO0FBQy9DLGVBQVcsV0FBVyxRQUFRLFlBQVk7QUFDekMsYUFBTyxnQkFBZ0IsQ0FBQyxHQUFHLFFBQVEsSUFBSSxHQUFHLENBQUMsT0FBTyxTQUFTLFlBQVkscUJBQXFCLENBQUM7QUFDN0YsYUFBTyxnQkFBZ0IsQ0FBQyxHQUFHLFFBQVEsSUFBSSxHQUFHLENBQUMsR0FBRyw2QkFBNkIsQ0FBQztBQUM1RSxhQUFPLFlBQVksUUFBUSxRQUFRLFFBQVEsQ0FBQztBQUM1QyxhQUFPLFlBQVksUUFBUSxRQUFRLENBQUMsR0FBRyxRQUFRO0FBQy9DLGFBQU8sR0FBRyxRQUFRLFFBQVEsQ0FBQyxHQUFHLFNBQVMsc0JBQXNCLENBQUM7QUFDOUQsYUFBTyxHQUFHLFFBQVEsUUFBUSxDQUFDLEdBQUcsU0FBUyxpQkFBaUIsQ0FBQztBQUN6RCxhQUFPLEdBQUcsUUFBUSxRQUFRLENBQUMsR0FBRyxTQUFTLGlCQUFpQixDQUFDO0FBQ3pELGFBQU8sR0FBRyxRQUFRLFFBQVEsQ0FBQyxHQUFHLFNBQVMsbUJBQW1CLENBQUM7QUFDM0QsYUFBTyxHQUFHLFFBQVEsUUFBUSxDQUFDLEdBQUcsU0FBUyw4QkFBOEIsQ0FBQztBQUN0RSxhQUFPLEdBQUcsQ0FBQyxRQUFRLFFBQVEsQ0FBQyxHQUFHLFNBQVMsaUJBQWlCLENBQUM7QUFBQSxJQUMzRDtBQUNBLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUM7QUFDOUMsV0FBTyxZQUFZLFFBQVEsYUFBYSxHQUFHLENBQUM7QUFBQSxFQUM3QyxDQUFDO0FBRUQsT0FBSyxvRUFBb0UsaUJBQWtCO0FBQzFGLFVBQU0sVUFBVSxNQUFNLHFCQUFxQixNQUFNO0FBQUEsTUFDaEQsS0FBSyxnQkFBZ0IsYUFBYTtBQUFBLE1BQ2xDLGNBQWM7QUFBQSxJQUNmLENBQUM7QUFDRCxvQkFBZ0IsUUFBUSxNQUFNLEVBQUU7QUFDaEMsb0JBQWdCLFFBQVEsTUFBTSxFQUFFO0FBQ2hDLFVBQU0sY0FBYyxPQUFPO0FBQzNCLFdBQU8sWUFBWSxRQUFRLFVBQVUsUUFBUSxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLFFBQVEsWUFBWSxDQUFDLENBQUM7QUFDN0MsV0FBTyxZQUFZLFFBQVEsYUFBYSxHQUFHLENBQUM7QUFDNUMsV0FBTyxZQUFZLFFBQVEsS0FBSyxRQUFRLGNBQWMsbUNBQW1DLEdBQUcsYUFBYSxvQ0FBb0MsQ0FBQztBQUM5SSxXQUFPLFlBQVksUUFBUSxPQUFPLGNBQWMsa0NBQWtDLEdBQUcsYUFBYSxvQ0FBb0MsQ0FBQztBQUFBLEVBQ3hJLENBQUM7QUFFRCxPQUFLLDhCQUE4QixpQkFBa0I7QUFDcEQsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLLGdCQUFnQixlQUFlO0FBQUEsTUFDcEMsYUFBYTtBQUFBLElBQ2QsQ0FBQztBQUNELG9CQUFnQixRQUFRLE1BQU0sQ0FBQztBQUMvQixvQkFBZ0IsUUFBUSxNQUFNLENBQUM7QUFDL0IsVUFBTSxjQUFjLE9BQU87QUFDM0IsV0FBTyxZQUFZLFFBQVEsVUFBVSxRQUFRLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsUUFBUSxZQUFZLENBQUMsQ0FBQztBQUFBLEVBQzlDLENBQUM7QUFFRCxPQUFLLHlDQUF5QyxpQkFBa0I7QUFDL0QsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLLGdCQUFnQixrQkFBa0I7QUFBQSxNQUN2QyxjQUFjO0FBQUEsSUFDZixDQUFDO0FBQ0QsVUFBTSxjQUFjLE9BQU87QUFDM0IsV0FBTyxnQkFBZ0IsUUFBUSxXQUFXLENBQUMsQ0FBQztBQUM1QyxXQUFPLGdCQUFnQixRQUFRLFlBQVksQ0FBQyxDQUFDO0FBQzdDLFdBQU8sWUFBWSxRQUFRLGFBQWEsR0FBRyxDQUFDO0FBQUEsRUFDN0MsQ0FBQztBQUVELE9BQUssNkRBQTZELGlCQUFrQjtBQUNuRixVQUFNLFVBQVUsTUFBTSxxQkFBcUIsTUFBTTtBQUFBLE1BQ2hELEtBQUssZ0JBQWdCLGVBQWU7QUFBQSxNQUNwQyxhQUFhO0FBQUEsTUFDYixjQUFjO0FBQUEsSUFDZixDQUFDO0FBQ0Qsb0JBQWdCLFFBQVEsTUFBTSxDQUFDO0FBQy9CLG9CQUFnQixRQUFRLE1BQU0sQ0FBQztBQUMvQixVQUFNLGNBQWMsT0FBTztBQUMzQixXQUFPLGdCQUFnQixRQUFRLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLFdBQU8sZ0JBQWdCLFFBQVEsWUFBWSxDQUFDLENBQUM7QUFDN0MsV0FBTyxZQUFZLFFBQVEsYUFBYSxHQUFHLENBQUM7QUFDNUMsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQztBQUFBLEVBQy9DLENBQUM7QUFFRCxPQUFLLGtFQUFrRSxpQkFBa0I7QUFDeEYsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLLGdCQUFnQixrQkFBa0I7QUFBQSxNQUN2QyxvQkFBb0I7QUFBQSxJQUNyQixDQUFDO0FBQ0Qsb0JBQWdCLFFBQVEsTUFBTSxDQUFDO0FBQy9CLG9CQUFnQixRQUFRLE1BQU0sQ0FBQztBQUMvQixVQUFNLGNBQWMsT0FBTztBQUMzQixXQUFPLGdCQUFnQixRQUFRLFdBQVcsQ0FBQyxDQUFDO0FBQzVDLFdBQU8sZ0JBQWdCLFFBQVEsWUFBWSxDQUFDLENBQUM7QUFDN0MsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQztBQUFBLEVBQy9DLENBQUM7QUFFRCxPQUFLLGlFQUFpRSxpQkFBa0I7QUFDdkYsVUFBTSxVQUFVLE1BQU0scUJBQXFCLE1BQU07QUFBQSxNQUNoRCxLQUFLLGdCQUFnQixpQkFBaUIsRUFBRSxZQUFZLFdBQVcsQ0FBQztBQUFBLE1BQ2hFLGNBQWM7QUFBQSxNQUNkLGNBQWM7QUFBQSxNQUNkLG1CQUFtQjtBQUFBLElBQ3BCLENBQUM7QUFDRCxvQkFBZ0IsUUFBUSxNQUFNLENBQUM7QUFDL0Isb0JBQWdCLFFBQVEsTUFBTSxDQUFDO0FBQy9CLFVBQU0sY0FBYyxPQUFPO0FBQzNCLFdBQU8sWUFBWSxRQUFRLFdBQVcsUUFBUSxDQUFDO0FBQy9DLFdBQU8sWUFBWSxRQUFRLEtBQUssUUFBUSxjQUFjLG1DQUFtQyxHQUFHLGFBQWEsY0FBYztBQUN2SCxXQUFPLFlBQVksUUFBUSxPQUFPLGNBQWMsa0NBQWtDLEdBQUcsYUFBYSxjQUFjO0FBQ2hILFdBQU8sWUFBWSxRQUFRLGFBQWEsR0FBRyxDQUFDO0FBQzVDLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUM7QUFBQSxFQUMvQyxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsidGVzdCJdCn0K
