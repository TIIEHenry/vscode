import assert from "assert";
import { timeout } from "../../../../../base/common/async.js";
import { errorHandler, setUnexpectedErrorHandler } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { StandardMouseEvent } from "../../../../../base/browser/mouseEvent.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { scheduleConversationMermaidExtensionResolve } from "../../browser/conversationLens.js";
import { applySessionViewTimeline, refreshTrajectoryRecords, updateConversationPhase, updateSyncChrome } from "../../browser/conversationLensProjection.js";
import { conversationLensStaleSnapshotClass, executeReadingColumnSourcesReview, isReadingColumnWritesEnabled, refreshStaleSnapshotBanner, requestReadingColumnDetail, shouldShowReadingColumnLiveChrome } from "../../browser/conversationLensReadingColumn.js";
import { SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND } from "../../../sources/common/sourcesReviewCommands.js";
import { formatSyncChromeLabel } from "../../browser/conversationSessionView.js";
import { postBound, saveQueueEdit, saveTurnEdit, submitDraft } from "../../browser/conversationLensComposer.js";
import {
  applySessionModelIndex,
  syncSessionConfigSelects,
  applySessionPermissionIndex,
  beginQueueEdit,
  beginTurnEdit,
  isSessionPermissionModeAvailable,
  isSessionSwitchAgentAvailable,
  isSessionSwitchModelAvailable,
  showPostFailure,
  toggleMoreContextView,
  toggleTuneContextView,
  updateComposerSessionSelectsEnabled,
  updateGateRow,
  updateSendEnabled
} from "../../browser/conversationLensComposerChrome.js";
import { beginSessionTitleEdit, commitSessionTitleEdit, createNewSession, deleteActiveSession, updateSessionBarWriteChrome } from "../../browser/conversationLensSessionBar.js";
import { mountDock } from "../../browser/conversationLensDock.js";
import {
  conversationLensDockAgentLabel,
  conversationLensDockEngineNotConnected,
  conversationLensDockSessionUnavailable,
  conversationLensDockSessionUnavailableReason,
  conversationLensDockNoEngineTools,
  conversationLensDockNoTools,
  conversationLensDockPermissionLabel,
  conversationLensPostFailed,
  conversationLensPostFailedDisconnected,
  conversationLensPostFailedNoSession
} from "../../browser/conversationLensDockStrings.js";
import { conversationLensSessionBarTitleEmpty } from "../../browser/conversationLensSessionBarStrings.js";
import { ENGINE_TOOLS_ZONE, OPEN_ENGINE_PREFERENCES_COMMAND_ID } from "../../common/uaPreferencesPanes.js";
import { applyActiveSession, bindSessionView, cancelToolCall, copyTurn, deleteTurn, resolveConfirmation, resolveQuestion, respondClientTool, retryError } from "../../browser/conversationLensSessionBinding.js";
import { isConversationEngineLive, isConversationPairingHold } from "../../browser/conversationSessionStatus.js";
import { ConversationStubService } from "../../browser/conversationStubService.js";
import { createConversationConnectionTestStub } from "../common/conversationConnectionTestStub.js";
suite("conversation lens dispose gate", () => {
  const suiteStore = ensureNoDisposablesAreLeakedInTestSuite();
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
      run();
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
  function mountDockWithSubmit(submitDraft2) {
    const store = new DisposableStore();
    const dockHost = document.createElement("div");
    document.body.appendChild(dockHost);
    store.add({ dispose: () => dockHost.remove() });
    const dummySelectBox = () => ({
      render() {
      },
      onDidSelect: Event.None,
      select() {
      },
      setEnabled() {
      },
      setAriaLabel() {
      },
      dispose() {
      }
    });
    const host = {
      composerPolicy: "compose",
      inputHistoryBrowse: { browseIndex: -1, savedDraft: "" },
      modelSelectedIndex: 0,
      catalogToolNames: [],
      catalogModelIds: [""],
      sessionConfigBySessionId: /* @__PURE__ */ new Map(),
      postFailureVisible: false,
      sendFailureTimeout: void 0,
      lastReadingWidth: 800,
      inputMaximized: false,
      composeDraftSnapshot: "",
      editingTurnId: void 0,
      editingQueueItemId: void 0,
      tuneContextView: void 0,
      moreContextView: void 0,
      configurationService: { getValue: () => void 0 },
      instantiationService: {
        createInstance: () => ({ dispose() {
        } })
      },
      stubService: {
        onDidChangeEngineConnection: Event.None,
        isEngineConnected: () => false,
        isEngineSessionReady: () => false
      },
      uaConnection: {
        onDidChangeConnection: Event.None
      },
      register: (disposable) => store.add(disposable),
      createComposerSelectBox: () => dummySelectBox(),
      getSessionConfig: () => ({ agentIndex: 0, permissionIndex: 0 }),
      setSessionConfig: () => {
      },
      getBoundSessionId: () => "sess-1",
      toggleTuneContextView: () => {
      },
      toggleMoreContextView: () => {
      },
      toggleInputMaximized: () => {
      },
      updateMaximizeInputButton: () => {
      },
      updateSendEnabled: () => {
      },
      beginQueueEdit: () => {
      },
      exitComposerEdit: () => {
      },
      navigateInputHistory: () => false,
      exitInputHistoryBrowse: () => {
      },
      submitDraft: submitDraft2,
      writeComposerDraft: () => {
      },
      updateConversationPhase: () => {
      },
      scrollToFirstPendingConfirmation: () => {
      },
      setInputMaximized: () => {
      },
      renderInboxStatus: () => {
      },
      readComposerDraft: () => "",
      isPreFirst: () => false,
      syncComposerPlacement: () => {
      },
      updateComposerEditChrome: () => {
      },
      ensureComposerInCluster: () => {
      },
      slotHosts: {}
    };
    mountDock(host, dockHost);
    return { host, dispose: () => store.dispose() };
  }
  function mountDockWithRejectingSubmitDraft(paintBoom) {
    return mountDockWithSubmit(async () => {
      throw paintBoom;
    });
  }
  function mountDockWithRejectingSessionSelectApply(paintBoom) {
    const store = new DisposableStore();
    const dockHost = document.createElement("div");
    document.body.appendChild(dockHost);
    store.add({ dispose: () => dockHost.remove() });
    const permissionDidSelect = store.add(new Emitter());
    const modelDidSelect = store.add(new Emitter());
    const dummySelectBox = (onDidSelect) => ({
      render() {
      },
      onDidSelect,
      select() {
      },
      setEnabled() {
      },
      setAriaLabel() {
      },
      dispose() {
      }
    });
    const host = {
      composerPolicy: "compose",
      inputHistoryBrowse: { browseIndex: -1, savedDraft: "" },
      modelSelectedIndex: 0,
      catalogToolNames: [],
      catalogModelIds: ["", "gpt-test"],
      sessionConfigBySessionId: /* @__PURE__ */ new Map([["sess-1", { agentIndex: 0, permissionIndex: 0 }]]),
      postFailureVisible: false,
      sendFailureTimeout: void 0,
      lastReadingWidth: 800,
      inputMaximized: false,
      composeDraftSnapshot: "",
      editingTurnId: void 0,
      editingQueueItemId: void 0,
      tuneContextView: void 0,
      moreContextView: void 0,
      configurationService: { getValue: () => void 0 },
      instantiationService: {
        createInstance: () => ({ dispose() {
        } })
      },
      stubService: {
        onDidChangeEngineConnection: Event.None,
        isEngineConnected: () => true,
        isEngineSessionReady: () => true
      },
      uaConnection: {
        onDidChangeConnection: Event.None,
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false }),
        setPermissionMode: async () => {
          throw new Error("setPermissionMode boom");
        },
        switchModel: async () => {
          throw new Error("switchModel boom");
        }
      },
      register: (disposable) => store.add(disposable),
      createComposerSelectBox: (_options, _selectedIndex, ariaLabel) => {
        if (ariaLabel === conversationLensDockPermissionLabel) {
          return dummySelectBox(permissionDidSelect.event);
        }
        if (ariaLabel === conversationLensDockAgentLabel) {
          return dummySelectBox(Event.None);
        }
        return dummySelectBox(modelDidSelect.event);
      },
      getSessionConfig: () => ({ agentIndex: 0, permissionIndex: 0 }),
      setSessionConfig: () => {
      },
      getBoundSessionId: () => "sess-1",
      toggleTuneContextView: () => {
      },
      toggleMoreContextView: () => {
      },
      toggleInputMaximized: () => {
      },
      updateMaximizeInputButton: () => {
      },
      updateSendEnabled: () => {
      },
      beginQueueEdit: () => {
      },
      exitComposerEdit: () => {
      },
      navigateInputHistory: () => false,
      exitInputHistoryBrowse: () => {
      },
      submitDraft: async () => {
      },
      writeComposerDraft: () => {
      },
      updateConversationPhase: () => {
      },
      scrollToFirstPendingConfirmation: () => {
      },
      setInputMaximized: () => {
      },
      renderInboxStatus: () => {
      },
      readComposerDraft: () => "",
      isPreFirst: () => false,
      syncComposerPlacement: () => {
      },
      updateComposerEditChrome: () => {
      },
      ensureComposerInCluster: () => {
      },
      slotHosts: {}
    };
    mountDock(host, dockHost);
    host.gateLabel = {
      set textContent(_value) {
        throw paintBoom;
      },
      get textContent() {
        return "";
      }
    };
    return {
      firePermissionSelect(index) {
        permissionDidSelect.fire({ index });
      },
      fireModelSelect(index) {
        modelDidSelect.fire({ index });
      },
      dispose: () => store.dispose()
    };
  }
  test("applySessionViewTimeline skips applyEntries after dispose", () => {
    let applyEntries = 0;
    const host = {
      isDisposed: true,
      sessionViewLease: { sessionId: "s1" },
      timelineTree: { applyEntries: () => {
        applyEntries++;
      } }
    };
    applySessionViewTimeline(host, { kind: "baseline" });
    assert.strictEqual(applyEntries, 0);
  });
  test("refreshTrajectoryRecords skips setRecords after dispose", () => {
    let setRecords = 0;
    let readRecords = 0;
    const host = {
      isDisposed: true,
      filterAgentId: void 0,
      sessionViewLease: void 0,
      stubService: {
        getTrajectoryRecords: () => {
          readRecords++;
          return [];
        }
      },
      trajectoryView: { setRecords: () => {
        setRecords++;
      } }
    };
    refreshTrajectoryRecords(host, "s1");
    assert.strictEqual(readRecords, 0);
    assert.strictEqual(setRecords, 0);
  });
  test("refreshTrajectoryRecords still setRecords while live", () => {
    let setRecords = 0;
    const host = {
      isDisposed: false,
      filterAgentId: void 0,
      sessionViewLease: void 0,
      stubService: {
        getTrajectoryRecords: () => [],
        isEngineConnected: () => false,
        getTurns: () => []
      },
      trajectoryView: { setRecords: () => {
        setRecords++;
      } }
    };
    refreshTrajectoryRecords(host, "s1");
    assert.strictEqual(setRecords, 1);
  });
  test("refreshTrajectoryRecords keeps leftover lease turn ids while pairingPending then true disconnect uses stub ids", () => {
    let connected = true;
    let pairingPending = false;
    let setRecords = 0;
    let lastTurnIds;
    const leftoverRecords = [{ id: "rec-1" }];
    const host = {
      isDisposed: false,
      filterAgentId: void 0,
      sessionViewLease: {
        sessionId: "sess-leftover",
        snapshot: {
          timeline: [
            { id: "turn-lease-1", summary: { kind: "user" } },
            { id: "turn-lease-2", summary: { kind: "assistant" } }
          ]
        }
      },
      stubService: {
        getTrajectoryRecords: () => leftoverRecords,
        isEngineConnected: () => connected && !pairingPending,
        getTurns: () => []
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: connected ? "connected" : "disconnected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending })
      },
      trajectoryView: {
        getPaintedRecordCount: () => leftoverRecords.length,
        setRecords: (_records, turnIds) => {
          setRecords++;
          lastTurnIds = turnIds;
        }
      }
    };
    pairingPending = true;
    assert.strictEqual(host.stubService.isEngineConnected(), false);
    assert.strictEqual(host.uaConnection.getConnectionPhase().kind, "connected");
    assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);
    refreshTrajectoryRecords(host, "sess-leftover");
    assert.strictEqual(setRecords, 1);
    assert.ok(lastTurnIds?.has("turn-lease-1"));
    assert.ok(lastTurnIds?.has("turn-lease-2"));
    pairingPending = false;
    connected = false;
    refreshTrajectoryRecords(host, "sess-leftover");
    assert.strictEqual(setRecords, 2);
    assert.strictEqual(lastTurnIds?.size, 0);
  });
  test("refreshTrajectoryRecords keeps leftover painted records when pairingPending has no lease", () => {
    let setRecords = 0;
    const leftoverRecords = [{ id: "rec-leftover" }];
    const host = {
      isDisposed: false,
      filterAgentId: void 0,
      sessionViewLease: void 0,
      stubService: {
        getTrajectoryRecords: () => [],
        isEngineConnected: () => false,
        getTurns: () => []
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      },
      trajectoryView: {
        getPaintedRecordCount: () => leftoverRecords.length,
        setRecords: () => {
          setRecords++;
        }
      }
    };
    refreshTrajectoryRecords(host, "sess-leftover");
    assert.strictEqual(setRecords, 0);
  });
  test("refreshTrajectoryRecords first-pull pairingPending without leftover still setRecords", () => {
    let setRecords = 0;
    const host = {
      isDisposed: false,
      filterAgentId: void 0,
      sessionViewLease: void 0,
      stubService: {
        getTrajectoryRecords: () => [],
        isEngineConnected: () => false,
        getTurns: () => []
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      },
      trajectoryView: {
        getPaintedRecordCount: () => 0,
        setRecords: () => {
          setRecords++;
        }
      }
    };
    refreshTrajectoryRecords(host, "sess-first");
    assert.strictEqual(setRecords, 1);
  });
  test("shouldShowReadingColumnLiveChrome keeps leftover lease while pairingPending then true disconnect hides", () => {
    let connected = true;
    let pairingPending = false;
    const host = {
      sessionViewLease: leftoverLeaseSnapshot({ kind: "live" }),
      getBoundSessionId: () => "ua-cache",
      stubService: {
        isEngineConnected: () => connected && !pairingPending,
        getActiveSessionId: () => "ua-cache",
        getTurns: () => []
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: connected ? "connected" : "disconnected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending })
      }
    };
    assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), true);
    pairingPending = true;
    assert.strictEqual(host.stubService.isEngineConnected(), false);
    assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), true);
    pairingPending = false;
    connected = false;
    assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), false);
  });
  test("shouldShowReadingColumnLiveChrome keeps leftover cached turns without lease while pairingPending", () => {
    const host = {
      sessionViewLease: void 0,
      getBoundSessionId: () => "ua-cache",
      stubService: {
        isEngineConnected: () => false,
        getActiveSessionId: () => "ua-cache",
        getTurns: (sessionId) => sessionId === "ua-cache" ? [{ id: "t-leftover", kind: "thinking", text: "leftover think", streaming: true }] : []
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      }
    };
    assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), true);
  });
  test("shouldShowReadingColumnLiveChrome first-pull pairingPending without leftover stays false", () => {
    const host = {
      sessionViewLease: void 0,
      getBoundSessionId: () => "sess-first",
      stubService: {
        isEngineConnected: () => false,
        getActiveSessionId: () => "sess-first",
        getTurns: () => []
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      }
    };
    assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), false);
  });
  function leftoverLooksLiveChromeHost(options) {
    const connected = options.connected ?? true;
    const pairingPending = options.pairingPending;
    const looksLive = options.looksLive ?? false;
    const hasLease = options.hasLease === true;
    const boundSessionId = hasLease ? "ua-cache" : "sess-first";
    return {
      sessionViewLease: hasLease ? leftoverLeaseSnapshot({ kind: "live" }) : void 0,
      getBoundSessionId: () => boundSessionId,
      stubService: {
        isEngineConnected: () => connected && (looksLive || !pairingPending),
        getActiveSessionId: () => boundSessionId,
        getTurns: (sessionId) => sessionId === boundSessionId ? options.turns ?? [] : []
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: connected ? "connected" : "disconnected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending })
      }
    };
  }
  test("leftover-looks-live first-pull shouldShowReadingColumnLiveChrome stays false", () => {
    const host = leftoverLooksLiveChromeHost({ pairingPending: true, looksLive: true });
    assert.strictEqual(host.stubService.isEngineConnected(), true);
    assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(shouldShowReadingColumnLiveChrome(host), false);
  });
  test("leftover-looks-live keeps leftover lease shouldShowReadingColumnLiveChrome", () => {
    const host = leftoverLooksLiveChromeHost({ pairingPending: true, looksLive: true, hasLease: true });
    assert.strictEqual(host.stubService.isEngineConnected(), true);
    assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(shouldShowReadingColumnLiveChrome(host), true);
  });
  test("leftover-looks-live keeps leftover cached turns shouldShowReadingColumnLiveChrome", () => {
    const host = leftoverLooksLiveChromeHost({
      pairingPending: true,
      looksLive: true,
      turns: [{ id: "t-leftover", kind: "thinking", text: "leftover think", streaming: true }]
    });
    assert.strictEqual(host.stubService.isEngineConnected(), true);
    assert.strictEqual(shouldShowReadingColumnLiveChrome(host), true);
  });
  test("reading column live chrome and stale banner follow bound session without lease not global active", () => {
    const boundClosed = { kind: "closed", reason: "Bound leaf snapshot" };
    const activeLive = { kind: "live" };
    const banner = document.createElement("div");
    banner.className = conversationLensStaleSnapshotClass;
    banner.hidden = true;
    const readingColumn = document.createElement("div");
    readingColumn.appendChild(banner);
    const getSessionSyncCalls = [];
    const host = {
      sessionViewLease: void 0,
      getBoundSessionId: () => "sess-A",
      readingColumn,
      stubService: {
        isEngineConnected: () => false,
        getActiveSessionId: () => "sess-B",
        getTurns: (sessionId) => sessionId === "sess-A" ? [{ id: "t-bound", kind: "thinking", text: "bound leftover", streaming: true }] : [],
        getSessionSync: (sessionId) => {
          getSessionSyncCalls.push(sessionId);
          return sessionId === "sess-A" ? boundClosed : activeLive;
        }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      }
    };
    assert.strictEqual(shouldShowReadingColumnLiveChrome(asLiveChromeHost(host)), true);
    refreshStaleSnapshotBanner(host);
    assert.deepStrictEqual(getSessionSyncCalls, ["sess-A"]);
    assert.strictEqual(banner.hidden, false);
    assert.ok(banner.textContent?.includes("Bound leaf snapshot"));
  });
  function leftoverLooksLiveDetailHost(options) {
    const state = { requestDetailCalls: 0 };
    const details = /* @__PURE__ */ new Map();
    if (options.cachedBody !== void 0) {
      details.set("detail:leftover", options.cachedBody);
    }
    const hasLease = options.hasLease !== false;
    const host = {
      stubService: {
        isEngineConnected: () => true
      },
      sessionViewLease: hasLease ? {
        details,
        requestDetail: async (_ref) => {
          state.requestDetailCalls++;
          return { ok: true, truncated: false, content: "live-fetched" };
        }
      } : void 0,
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: options.pairingPending })
      }
    };
    return {
      host,
      get requestDetailCalls() {
        return state.requestDetailCalls;
      }
    };
  }
  test("leftover-looks-live leftover lease requestDetail stays 0 unary", async () => {
    const fixture = leftoverLooksLiveDetailHost({ pairingPending: true });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, true);
    const outcome = await requestReadingColumnDetail(fixture.host, "detail:leftover");
    assert.deepStrictEqual(outcome, { ok: false, reason: "unavailable" });
    assert.strictEqual(fixture.requestDetailCalls, 0);
  });
  test("leftover-looks-live leftover lease serves cached leftover body without requestDetail", async () => {
    const fixture = leftoverLooksLiveDetailHost({ pairingPending: true, cachedBody: "cached leftover" });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    const outcome = await requestReadingColumnDetail(fixture.host, "detail:leftover");
    assert.deepStrictEqual(outcome, { ok: true, truncated: false, content: "cached leftover" });
    assert.strictEqual(fixture.requestDetailCalls, 0);
  });
  test("connected leftover still requestDetail", async () => {
    const fixture = leftoverLooksLiveDetailHost({ pairingPending: false });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    const outcome = await requestReadingColumnDetail(fixture.host, "detail:leftover");
    assert.deepStrictEqual(outcome, { ok: true, truncated: false, content: "live-fetched" });
    assert.strictEqual(fixture.requestDetailCalls, 1);
  });
  test("first-pull pairing without lease requestDetail stays unavailable", async () => {
    const fixture = leftoverLooksLiveDetailHost({ pairingPending: true, hasLease: false });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    const outcome = await requestReadingColumnDetail(fixture.host, "detail:leftover");
    assert.deepStrictEqual(outcome, { ok: false, reason: "unavailable" });
    assert.strictEqual(fixture.requestDetailCalls, 0);
  });
  test("does not leak unhandled rejection when reading-column sources review executeCommand rejects and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("review boom");
    const calls = [];
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      executeReadingColumnSourcesReview({
        executeCommand: async (id, ...args) => {
          calls.push({ id, args });
          throw paintBoom;
        }
      }, ["file:///tmp/readme.md"]);
    });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].id, SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND);
    const uris = calls[0].args[0];
    assert.strictEqual(uris.length, 1);
    assert.strictEqual(uris[0].toString(true), "file:///tmp/readme.md");
  });
  test("reading column sources review fire-and-forget voids double-catch onUnexpectedError", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationLensReadingColumn.ts`);
    const doubleCatch = ".catch(onUnexpectedError).catch(onUnexpectedError)";
    assert.ok(source.includes("onReviewNavClick: paths => executeReadingColumnSourcesReview(host.commandService, paths)"));
    assert.ok(source.includes(doubleCatch));
    assert.ok(!source.includes("void host.commandService.executeCommand("));
  });
  function mermaidExtensionInfo(path = "/tmp/mermaid") {
    return {
      extensionLocation: URI.file(path),
      extensionId: new ExtensionIdentifier("vscode.mermaid-markdown-features")
    };
  }
  function mermaidResolveHost(options) {
    return {
      extensionService: {
        getExtension: options.getExtension
      },
      isDisposed: options.isDisposed ?? false,
      mermaidExtensionInfo: options.mermaidExtensionInfo,
      timelineTree: {
        setMermaidExtensionInfo(info) {
          options.onSetMermaid?.(info);
        }
      },
      applySessionViewTimeline() {
        options.onApplyBaseline?.();
      }
    };
  }
  test("does not leak unhandled rejection when mermaid resolve then-callback throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const host = mermaidResolveHost({
      getExtension: async () => ({
        extensionLocation: URI.file("/tmp/mermaid"),
        identifier: new ExtensionIdentifier("vscode.mermaid-markdown-features")
      }),
      onSetMermaid: () => {
        throw paintBoom;
      }
    });
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => scheduleConversationMermaidExtensionResolve(host));
  });
  test("does not leak unhandled rejection when mermaid getExtension rejects, then-callback throws, and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const host = mermaidResolveHost({
      getExtension: () => Promise.reject(new Error("getExtension boom")),
      mermaidExtensionInfo: mermaidExtensionInfo("/tmp/stale"),
      onSetMermaid: () => {
        throw paintBoom;
      }
    });
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => scheduleConversationMermaidExtensionResolve(host));
  });
  test("conversation lens mermaid resolve fire-and-forget voids double-catch onUnexpectedError", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationLens.ts`);
    const doubleCatch = ".catch(onUnexpectedError).catch(onUnexpectedError)";
    assert.ok(source.includes("scheduleConversationMermaidExtensionResolve(this);"));
    assert.ok(source.includes("void resolveConversationMermaidExtension(host.extensionService).then("));
    assert.ok(source.includes(doubleCatch));
    assert.ok(!source.includes("void resolveConversationMermaidExtension(this.extensionService).then("));
  });
  function asLiveChromeHost(host) {
    return host;
  }
  function leftoverLeaseSnapshot(sync) {
    return {
      sessionId: "ua-cache",
      snapshot: {
        sessionId: "ua-cache",
        sync,
        timeline: [],
        overlay: { blocks: [] },
        pendingActions: [],
        localPendingSends: []
      },
      attribution: /* @__PURE__ */ new Map(),
      details: /* @__PURE__ */ new Map()
    };
  }
  function pairingSyncChromeHost(options) {
    const leftover = options.leftover;
    const rosterSync = options.rosterSync;
    const calls = { count: 0 };
    const badge = document.createElement("span");
    const banner = document.createElement("div");
    banner.className = conversationLensStaleSnapshotClass;
    banner.hidden = true;
    const readingColumn = document.createElement("div");
    readingColumn.appendChild(banner);
    const dock = document.createElement("div");
    const prefirstHero = document.createElement("div");
    const dockRoot = document.createElement("div");
    const gateRow = document.createElement("div");
    const identityStripElement = document.createElement("div");
    const inboxOverlayElement = document.createElement("div");
    inboxOverlayElement.hidden = true;
    prefirstHero.append(identityStripElement, gateRow);
    dockRoot.appendChild(inboxOverlayElement);
    const host = {
      isDisposed: false,
      lensId: "conversation",
      filterAgentId: void 0,
      composerPolicy: "compose",
      conversationPhase: "prefirst",
      lastAttachedEntries: [],
      sessionViewLease: leftoverLeaseSnapshot(leftover),
      sessionSyncBadge: badge,
      readingColumn,
      staleBanner: banner,
      get getSessionSyncCalls() {
        return calls.count;
      },
      stubService: {
        getSessionSync: (sessionId) => {
          calls.count++;
          assert.strictEqual(sessionId, "ua-cache");
          return options.getSessionSync?.(sessionId) ?? rosterSync;
        },
        getTurns: () => [],
        getActiveSessionId: () => "ua-cache"
      },
      getBoundSessionId: () => "ua-cache",
      reviewNavService: { getReviewNavForSession: () => [] },
      timelineTree: { applyEntries: () => {
      } },
      trajectoryView: {},
      renderInboxStatus: () => {
      },
      syncComposerPlacement: () => {
      },
      applyConversationDensity: () => {
      },
      updateSessionConfigVisibility: () => {
      },
      exitComposerEdit: () => {
      },
      updateGateRow: () => {
      },
      relayoutReadingSurfaces: () => {
      },
      slotHosts: { dock },
      prefirstHero,
      dockRoot,
      gateRow,
      identityStrip: { element: identityStripElement },
      inboxOverlay: { element: inboxOverlayElement }
    };
    return host;
  }
  test("applySessionViewTimeline pairing leftover live/syncing lease paints roster demoted sync not Session live", () => {
    const demoted = { kind: "closed", reason: "Cached snapshot (read-only)" };
    for (const leftover of [{ kind: "live" }, { kind: "syncing" }]) {
      const host = pairingSyncChromeHost({ leftover, rosterSync: demoted });
      applySessionViewTimeline(host, { kind: "baseline" });
      assert.ok(host.getSessionSyncCalls > 0);
      assert.deepStrictEqual(host.stubService.getSessionSync("ua-cache"), demoted);
      assert.notStrictEqual(host.sessionSyncBadge.textContent, "Session live");
      assert.notStrictEqual(host.sessionSyncBadge.textContent, "Session syncing");
      assert.strictEqual(host.sessionSyncBadge.textContent, formatSyncChromeLabel(demoted));
      assert.strictEqual(host.sessionSyncBadge.getAttribute("aria-label"), formatSyncChromeLabel(demoted));
      assert.strictEqual(host.sessionSyncBadge.title, formatSyncChromeLabel(demoted));
      assert.strictEqual(host.staleBanner.hidden, true);
      assert.strictEqual(host.staleBanner.textContent, "");
    }
  });
  test("applySessionViewTimeline connected leftover live still paints Session live", () => {
    const live = { kind: "live" };
    const host = pairingSyncChromeHost({ leftover: live, rosterSync: live });
    applySessionViewTimeline(host, { kind: "baseline" });
    assert.ok(host.getSessionSyncCalls > 0);
    assert.strictEqual(host.sessionSyncBadge.textContent, "Session live");
    assert.strictEqual(host.sessionSyncBadge.title, "Session live");
    assert.strictEqual(host.staleBanner.hidden, true);
  });
  test("updateSyncChrome and stale banner ignore leftover live lease and follow getSessionSync", () => {
    const demoted = { kind: "closed", reason: "Cached snapshot (read-only)" };
    const host = pairingSyncChromeHost({ leftover: { kind: "live" }, rosterSync: demoted });
    updateSyncChrome(host, { kind: "live" });
    assert.notStrictEqual(host.sessionSyncBadge.textContent, "Session live");
    assert.strictEqual(host.sessionSyncBadge.textContent, formatSyncChromeLabel(demoted));
    assert.strictEqual(host.sessionSyncBadge.title, formatSyncChromeLabel(demoted));
    refreshStaleSnapshotBanner(host, { kind: "live" });
    assert.strictEqual(host.staleBanner.hidden, true);
    assert.strictEqual(host.staleBanner.textContent, "");
  });
  test("pairing-hold same-session KEEP connection change paints getSessionSync closed chrome not Session live", () => {
    const demoted = { kind: "closed", reason: "Cached snapshot (read-only)" };
    const leftover = [
      { id: "t1", kind: "user", text: "" },
      { id: "t2", kind: "user", text: "" }
    ];
    const lifetime = new DisposableStore();
    const host = pairingSyncChromeHost({ leftover: { kind: "live" }, rosterSync: demoted });
    host.lastAttachedEntries = leftover;
    host.sessionSyncBadge.textContent = "Session live";
    host.sessionSyncBadge.title = "Session live";
    Object.assign(host, {
      sessionViewLifetime: lifetime,
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      },
      stubService: {
        ...host.stubService,
        isEngineConnected: () => false,
        isEngineSessionReady: () => false,
        acquireSessionView: () => {
          throw new Error("pairing-hold same-session KEEP must not acquire");
        }
      },
      timelineTree: {
        applyEntries: () => {
          throw new Error("pairing-hold same-session KEEP must not applyEntries");
        },
        refreshPresentation: () => {
        }
      }
    });
    const priorLease = host.sessionViewLease;
    bindSessionView(host, "ua-cache");
    assert.strictEqual(host.sessionViewLease, priorLease);
    assert.strictEqual(host.lastAttachedEntries, leftover);
    assert.strictEqual(host.sessionSyncBadge.textContent, "Session live");
    updateConversationPhase(host);
    updateSyncChrome(host);
    assert.strictEqual(host.sessionViewLease, priorLease);
    assert.strictEqual(host.lastAttachedEntries, leftover);
    assert.notStrictEqual(host.sessionSyncBadge.textContent, "Session live");
    assert.strictEqual(host.sessionSyncBadge.textContent, formatSyncChromeLabel(demoted));
    assert.strictEqual(host.sessionSyncBadge.title, formatSyncChromeLabel(demoted));
    assert.strictEqual(host.sessionSyncBadge.getAttribute("aria-label"), formatSyncChromeLabel(demoted));
    lifetime.dispose();
  });
  test("bindSessionView skips applyEntries after dispose", () => {
    const lifetime = new DisposableStore();
    lifetime.dispose();
    let applyEntries = 0;
    let acquire = 0;
    const host = {
      isDisposed: true,
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "s1" },
      lastAttachedEntries: [],
      stubService: {
        isEngineConnected: () => false,
        acquireSessionView: () => {
          acquire++;
          return { sessionId: "s1", snapshot: { sessionId: "s1" } };
        }
      },
      timelineTree: { applyEntries: () => {
        applyEntries++;
      } }
    };
    bindSessionView(host, "");
    assert.strictEqual(applyEntries, 0);
    assert.strictEqual(acquire, 0);
  });
  test("bindSessionView still applyEntries empty tree while live", () => {
    const lifetime = new DisposableStore();
    let applyEntries = 0;
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "s1" },
      lastAttachedEntries: [{ id: "t1" }],
      stubService: {
        isEngineConnected: () => false
      },
      timelineTree: { applyEntries: () => {
        applyEntries++;
      } }
    };
    bindSessionView(host, "");
    assert.strictEqual(applyEntries, 1);
    assert.strictEqual(host.sessionViewLease, void 0);
    assert.deepStrictEqual(host.lastAttachedEntries, []);
    lifetime.dispose();
  });
  test("bindSessionView empty sessionId still clears leftover while engine roster is in-flight", () => {
    const lifetime = new DisposableStore();
    let applyEntries = 0;
    let acquire = 0;
    let appliedEmpty = 0;
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "sess-leftover" },
      lastAttachedEntries: [{ id: "t1" }, { id: "t2" }],
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => false,
        acquireSessionView: () => {
          acquire++;
          return { sessionId: "sess-leftover", snapshot: { sessionId: "sess-leftover" } };
        }
      },
      timelineTree: {
        applyEntries: (entries) => {
          applyEntries++;
          if (entries.length === 0) {
            appliedEmpty++;
          }
        }
      }
    };
    bindSessionView(host, "");
    assert.strictEqual(applyEntries, 1);
    assert.strictEqual(appliedEmpty, 1);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, void 0);
    assert.strictEqual(host.lastAttachedEntries.length, 0);
    lifetime.dispose();
  });
  test("bindSessionView keeps leftover timeline while engine roster is in-flight", () => {
    const lifetime = new DisposableStore();
    const priorLease = { sessionId: "sess-leftover" };
    const leftover = [{ id: "t1" }, { id: "t2" }];
    let applyEntries = 0;
    let acquire = 0;
    const lifetimeMarker = {
      disposed: false,
      dispose() {
        this.disposed = true;
      }
    };
    lifetime.add(lifetimeMarker);
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: priorLease,
      lastAttachedEntries: leftover,
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => false,
        acquireSessionView: () => {
          acquire++;
          return { sessionId: "sess-leftover", snapshot: { sessionId: "sess-leftover" } };
        }
      },
      timelineTree: { applyEntries: () => {
        applyEntries++;
      } }
    };
    bindSessionView(host, "sess-leftover");
    assert.strictEqual(applyEntries, 0);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, priorLease);
    assert.strictEqual(host.lastAttachedEntries.length, 2);
    assert.strictEqual(host.lastAttachedEntries, leftover);
    assert.strictEqual(lifetimeMarker.disposed, false);
    lifetime.dispose();
  });
  test("bindSessionView KEEP leftover roster in-flight does not keep other session leftover", () => {
    const lifetime = new DisposableStore();
    const leftoverA = [{ id: "t1" }, { id: "t2" }];
    let applyEntries = 0;
    let acquire = 0;
    let appliedEmpty = 0;
    const lifetimeMarker = {
      disposed: false,
      dispose() {
        this.disposed = true;
      }
    };
    lifetime.add(lifetimeMarker);
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "sess-A" },
      lastAttachedEntries: leftoverA,
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => false,
        acquireSessionView: () => {
          acquire++;
          return { sessionId: "sess-B", snapshot: { sessionId: "sess-B" } };
        }
      },
      timelineTree: {
        applyEntries: (entries) => {
          applyEntries++;
          if (entries.length === 0) {
            appliedEmpty++;
          }
        }
      }
    };
    bindSessionView(host, "sess-B");
    assert.strictEqual(applyEntries, 1);
    assert.strictEqual(appliedEmpty, 1);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, void 0);
    assert.strictEqual(host.lastAttachedEntries.length, 0);
    assert.strictEqual(lifetimeMarker.disposed, true);
    const sameSessionLeftover = [
      { id: "t1", kind: "user", text: "" },
      { id: "t2", kind: "user", text: "" }
    ];
    const sameSessionLease = {
      sessionId: "sess-A",
      snapshot: leftoverLeaseSnapshot({ kind: "idle" }).snapshot,
      attribution: /* @__PURE__ */ new Map(),
      details: /* @__PURE__ */ new Map(),
      onDidApplyFrame: Event.None,
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync() {
      },
      dispose() {
      }
    };
    const keepMarker = {
      disposed: false,
      dispose() {
        this.disposed = true;
      }
    };
    applyEntries = 0;
    appliedEmpty = 0;
    acquire = 0;
    host.sessionViewLease = sameSessionLease;
    host.lastAttachedEntries = sameSessionLeftover;
    lifetime.add(keepMarker);
    bindSessionView(host, "sess-A");
    assert.strictEqual(applyEntries, 0);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, sameSessionLease);
    assert.strictEqual(host.lastAttachedEntries, sameSessionLeftover);
    assert.strictEqual(keepMarker.disposed, false);
    lifetime.dispose();
  });
  test("bindSessionView still clears empty timeline on first pull while engine roster is in-flight", () => {
    const lifetime = new DisposableStore();
    let applyEntries = 0;
    let acquire = 0;
    let appliedEmpty = 0;
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "sess-first" },
      lastAttachedEntries: [],
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => false,
        acquireSessionView: () => {
          acquire++;
          return { sessionId: "sess-first", snapshot: { sessionId: "sess-first" } };
        }
      },
      timelineTree: {
        applyEntries: (entries) => {
          applyEntries++;
          if (entries.length === 0) {
            appliedEmpty++;
          }
        }
      }
    };
    bindSessionView(host, "sess-first");
    assert.strictEqual(applyEntries, 1);
    assert.strictEqual(appliedEmpty, 1);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, void 0);
    assert.strictEqual(host.lastAttachedEntries.length, 0);
    lifetime.dispose();
  });
  test("bindSessionView keeps leftover timeline while pairingPending then true disconnect rebinds", () => {
    const lifetime = new DisposableStore();
    const priorLease = { sessionId: "sess-leftover" };
    const leftover = [{ id: "t1" }, { id: "t2" }];
    let connected = true;
    let pairingPending = false;
    let applyEntries = 0;
    let appliedEmpty = 0;
    let applyBaseline = 0;
    let acquire = 0;
    const lifetimeMarker = {
      disposed: false,
      dispose() {
        this.disposed = true;
      }
    };
    lifetime.add(lifetimeMarker);
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: priorLease,
      lastAttachedEntries: leftover,
      stubService: {
        isEngineConnected: () => connected && !pairingPending,
        isEngineSessionReady: () => connected && !pairingPending,
        acquireSessionView: () => {
          acquire++;
          return {
            sessionId: "sess-leftover",
            snapshot: { sessionId: "sess-leftover" },
            dispose() {
            },
            onDidApplyFrame: () => ({ dispose() {
            } })
          };
        }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: connected ? "connected" : "disconnected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending })
      },
      timelineTree: {
        applyEntries: (entries) => {
          applyEntries++;
          if (entries.length === 0) {
            appliedEmpty++;
          }
        }
      },
      applySessionViewTimeline: (applied) => {
        if (applied.kind === "baseline") {
          applyBaseline++;
        }
      }
    };
    pairingPending = true;
    assert.strictEqual(host.stubService.isEngineConnected(), false);
    assert.strictEqual(host.uaConnection.getConnectionPhase().kind, "connected");
    assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);
    bindSessionView(host, "sess-leftover");
    assert.strictEqual(applyEntries, 0);
    assert.strictEqual(appliedEmpty, 0);
    assert.strictEqual(applyBaseline, 0);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, priorLease);
    assert.strictEqual(host.lastAttachedEntries.length, 2);
    assert.strictEqual(host.lastAttachedEntries, leftover);
    assert.strictEqual(lifetimeMarker.disposed, false);
    pairingPending = false;
    connected = false;
    bindSessionView(host, "sess-leftover");
    assert.ok(acquire > 0);
    assert.ok(applyBaseline > 0);
    assert.strictEqual(appliedEmpty, 0);
    assert.strictEqual(lifetimeMarker.disposed, true);
    lifetime.dispose();
  });
  test("bindSessionView keeps leftover timeline on production connecting pairing snapshot", () => {
    const lifetime = new DisposableStore();
    const priorLease = { sessionId: "sess-leftover" };
    const leftover = [{ id: "t1" }, { id: "t2" }];
    let pairingPending = false;
    let phase = { kind: "connected", path: "loopback" };
    let applyEntries = 0;
    let appliedEmpty = 0;
    let applyBaseline = 0;
    let acquire = 0;
    const lifetimeMarker = {
      disposed: false,
      dispose() {
        this.disposed = true;
      }
    };
    lifetime.add(lifetimeMarker);
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: priorLease,
      lastAttachedEntries: leftover,
      stubService: {
        isEngineConnected: () => !pairingPending && phase.kind === "connected",
        isEngineSessionReady: () => !pairingPending && phase.kind === "connected",
        acquireSessionView: () => {
          acquire++;
          return {
            sessionId: "sess-leftover",
            snapshot: { sessionId: "sess-leftover" },
            dispose() {
            },
            onDidApplyFrame: () => ({ dispose() {
            } })
          };
        }
      },
      uaConnection: {
        getConnectionPhase: () => phase,
        getConnectionSnapshot: () => ({ pairingPending })
      },
      timelineTree: {
        applyEntries: (entries) => {
          applyEntries++;
          if (entries.length === 0) {
            appliedEmpty++;
          }
        }
      },
      applySessionViewTimeline: (applied) => {
        if (applied.kind === "baseline") {
          applyBaseline++;
        }
      }
    };
    pairingPending = true;
    phase = { kind: "connecting", reason: "initial" };
    assert.strictEqual(host.stubService.isEngineConnected(), false);
    assert.deepStrictEqual(host.uaConnection.getConnectionPhase(), { kind: "connecting", reason: "initial" });
    assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(host.uaConnection), true);
    assert.strictEqual(isConversationEngineLive(host.uaConnection.getConnectionPhase(), host.uaConnection.getConnectionSnapshot().pairingPending), false);
    bindSessionView(host, "sess-leftover");
    assert.strictEqual(applyEntries, 0);
    assert.strictEqual(appliedEmpty, 0);
    assert.strictEqual(applyBaseline, 0);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, priorLease);
    assert.strictEqual(host.lastAttachedEntries.length, 2);
    assert.strictEqual(host.lastAttachedEntries, leftover);
    assert.strictEqual(lifetimeMarker.disposed, false);
    lifetime.dispose();
  });
  test("bindSessionView cross-session pending lease blanks the previous timeline and trajectory", () => {
    const lifetime = new DisposableStore();
    const leftover = [
      { id: "t1", kind: "user", text: "" },
      { id: "t2", kind: "user", text: "" }
    ];
    let cleared = 0;
    let trajectoryCleared = 0;
    const applied = [];
    const trajectoryRecords = [];
    let baselines = 0;
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "sess-A" },
      lastAttachedEntries: leftover,
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        acquireSessionView: () => ({
          sessionId: "sess-B",
          snapshot: { sessionId: "pending" },
          dispose() {
          },
          onDidApplyFrame: () => ({ dispose() {
          } })
        })
      },
      timelineTree: {
        applyEntries: (entries, appliedFrame) => {
          applied.push({ kind: appliedFrame.kind, count: entries.length });
        },
        clearProcessFoldExpanded: () => {
          cleared++;
        }
      },
      trajectoryView: {
        clearSessionState: () => {
          trajectoryCleared++;
        },
        setRecords: (records) => {
          trajectoryRecords.push([...records]);
        }
      },
      applySessionViewTimeline: () => {
        baselines++;
      }
    };
    const bound = host;
    bindSessionView(bound, "sess-B");
    assert.strictEqual(cleared, 1);
    assert.strictEqual(trajectoryCleared, 1);
    assert.deepStrictEqual(applied, [{ kind: "baseline", count: 0 }]);
    assert.deepStrictEqual(trajectoryRecords, [[]]);
    assert.strictEqual(baselines, 0);
    assert.strictEqual(host.lastAttachedEntries.length, 0);
    assert.strictEqual(host.sessionViewLease?.sessionId, "sess-B");
    cleared = 0;
    trajectoryCleared = 0;
    applied.length = 0;
    trajectoryRecords.length = 0;
    host.sessionViewLease = { sessionId: "sess-B" };
    host.lastAttachedEntries = leftover;
    bindSessionView(bound, "sess-B");
    assert.strictEqual(cleared, 0);
    assert.strictEqual(trajectoryCleared, 0);
    assert.deepStrictEqual(applied, []);
    assert.deepStrictEqual(trajectoryRecords, []);
    assert.strictEqual(baselines, 0);
    assert.strictEqual(host.lastAttachedEntries, leftover);
    lifetime.dispose();
  });
  test("bindSessionView cross-session roster and pairing clears fold expand and trajectory rows", () => {
    const lifetime = new DisposableStore();
    const leftover = [
      { id: "t1", kind: "user", text: "" },
      { id: "t2", kind: "user", text: "" }
    ];
    let cleared = 0;
    let trajectoryCleared = 0;
    const trajectoryRecords = [];
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "sess-A" },
      lastAttachedEntries: leftover,
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => false
      },
      timelineTree: {
        applyEntries: () => {
        },
        clearProcessFoldExpanded: () => {
          cleared++;
        }
      },
      trajectoryView: {
        clearSessionState: () => {
          trajectoryCleared++;
        },
        setRecords: (records) => {
          trajectoryRecords.push([...records]);
        }
      },
      uaConnection: void 0
    };
    const bound = host;
    bindSessionView(bound, "sess-B");
    assert.strictEqual(cleared, 1);
    assert.strictEqual(trajectoryCleared, 1);
    assert.deepStrictEqual(trajectoryRecords, [[]]);
    assert.strictEqual(bound.lastAttachedEntries.length, 0);
    cleared = 0;
    trajectoryCleared = 0;
    trajectoryRecords.length = 0;
    host.sessionViewLease = { sessionId: "sess-B" };
    host.lastAttachedEntries = leftover;
    bindSessionView(bound, "sess-B");
    assert.strictEqual(cleared, 0);
    assert.strictEqual(trajectoryCleared, 0);
    assert.deepStrictEqual(trajectoryRecords, []);
    assert.strictEqual(bound.lastAttachedEntries, leftover);
    host.stubService = {
      isEngineConnected: () => false,
      isEngineSessionReady: () => false
    };
    host.uaConnection = {
      getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
      getConnectionSnapshot: () => ({ pairingPending: true })
    };
    host.sessionViewLease = { sessionId: "sess-B" };
    bindSessionView(bound, "sess-C");
    assert.strictEqual(cleared, 1);
    assert.strictEqual(trajectoryCleared, 1);
    assert.deepStrictEqual(trajectoryRecords, [[]]);
    assert.strictEqual(bound.lastAttachedEntries.length, 0);
    lifetime.dispose();
  });
  test("bindSessionView pairing-hold leftover does not keep other session leftover", () => {
    const lifetime = new DisposableStore();
    const leftoverA = [{ id: "t1" }, { id: "t2" }];
    let applyEntries = 0;
    let appliedEmpty = 0;
    let acquire = 0;
    const lifetimeMarker = {
      disposed: false,
      dispose() {
        this.disposed = true;
      }
    };
    lifetime.add(lifetimeMarker);
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "sess-A" },
      lastAttachedEntries: leftoverA,
      stubService: {
        isEngineConnected: () => false,
        isEngineSessionReady: () => false,
        acquireSessionView: () => {
          acquire++;
          return {
            sessionId: "sess-B",
            snapshot: { sessionId: "sess-B" },
            dispose() {
            },
            onDidApplyFrame: () => ({ dispose() {
            } })
          };
        }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      },
      timelineTree: {
        applyEntries: (entries) => {
          applyEntries++;
          if (entries.length === 0) {
            appliedEmpty++;
          }
        }
      },
      applySessionViewTimeline: () => {
      }
    };
    bindSessionView(host, "sess-B");
    assert.strictEqual(applyEntries, 1);
    assert.strictEqual(appliedEmpty, 1);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, void 0);
    assert.strictEqual(host.lastAttachedEntries.length, 0);
    assert.strictEqual(lifetimeMarker.disposed, true);
    const sameSessionLeftover = [
      { id: "t1", kind: "user", text: "" },
      { id: "t2", kind: "user", text: "" }
    ];
    const sameSessionLease = {
      sessionId: "sess-A",
      snapshot: leftoverLeaseSnapshot({ kind: "idle" }).snapshot,
      attribution: /* @__PURE__ */ new Map(),
      details: /* @__PURE__ */ new Map(),
      onDidApplyFrame: Event.None,
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync() {
      },
      dispose() {
      }
    };
    const keepMarker = {
      disposed: false,
      dispose() {
        this.disposed = true;
      }
    };
    applyEntries = 0;
    appliedEmpty = 0;
    acquire = 0;
    host.sessionViewLease = sameSessionLease;
    host.lastAttachedEntries = sameSessionLeftover;
    lifetime.add(keepMarker);
    bindSessionView(host, "sess-A");
    assert.strictEqual(applyEntries, 0);
    assert.strictEqual(acquire, 0);
    assert.strictEqual(host.sessionViewLease, sameSessionLease);
    assert.strictEqual(host.lastAttachedEntries, sameSessionLeftover);
    assert.strictEqual(keepMarker.disposed, false);
    lifetime.dispose();
  });
  function applyActiveLeftoverHost(options) {
    const lifetime = new DisposableStore();
    const leftover = options.leftover;
    const priorLease = { sessionId: options.leaseSessionId };
    const state = {
      acquire: 0,
      applyEntries: 0,
      appliedEmpty: 0,
      phaseCalls: [],
      syncCalls: []
    };
    const lifetimeMarker = {
      disposed: false,
      dispose() {
        this.disposed = true;
      }
    };
    lifetime.add(lifetimeMarker);
    const host = {
      isDisposed: false,
      sessionViewLifetime: lifetime,
      sessionViewLease: priorLease,
      lastAttachedEntries: leftover,
      visualizeOverlay: { close() {
      } },
      engineHistoryList: void 0,
      engineSnapshotsList: void 0,
      inboxOverlay: { closeListPanel() {
      }, render() {
      } },
      trajectoryView: { clearSessionState() {
      } },
      dockTextarea: { value: "" },
      exitComposerEdit() {
      },
      resetInputHistoryBrowse() {
      },
      refreshSessionSelectOptions() {
      },
      syncSessionConfigSelects() {
      },
      updateSessionTitle() {
      },
      readComposerDraft: () => "",
      renderInboxStatus() {
      },
      updateConversationPhase() {
        state.phaseCalls.push(options.targetSessionId);
      },
      updateSyncChrome() {
        state.syncCalls.push(options.targetSessionId);
      },
      getBoundSessionId: () => options.targetSessionId,
      bindSessionView: (sessionId) => {
        bindSessionView(host, sessionId);
      },
      stubService: {
        isEngineConnected: () => options.mode === "roster-in-flight",
        isEngineSessionReady: () => false,
        acquireSessionView: () => {
          state.acquire++;
          return { sessionId: options.targetSessionId, snapshot: { sessionId: options.targetSessionId } };
        }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: options.mode === "pairing-hold" })
      },
      timelineTree: {
        applyEntries: (entries) => {
          state.applyEntries++;
          if (entries.length === 0) {
            state.appliedEmpty++;
          }
        }
      },
      applySessionViewTimeline() {
      }
    };
    return {
      host,
      lifetime,
      get acquire() {
        return state.acquire;
      },
      get applyEntries() {
        return state.applyEntries;
      },
      get appliedEmpty() {
        return state.appliedEmpty;
      },
      get phaseCalls() {
        return state.phaseCalls;
      },
      get syncCalls() {
        return state.syncCalls;
      },
      get lifetimeDisposed() {
        return lifetimeMarker.disposed;
      }
    };
  }
  test("applyActiveSession first-pull to other session refreshes phase and sync chrome without acquire", () => {
    const leftover = [
      { id: "t1", kind: "user", text: "" },
      { id: "t2", kind: "user", text: "" }
    ];
    for (const mode of ["pairing-hold", "roster-in-flight"]) {
      const fixture = applyActiveLeftoverHost({
        targetSessionId: "sess-B",
        leaseSessionId: "sess-A",
        leftover,
        mode
      });
      applyActiveSession(fixture.host, "sess-B");
      assert.strictEqual(fixture.applyEntries, 1);
      assert.strictEqual(fixture.appliedEmpty, 1);
      assert.strictEqual(fixture.acquire, 0);
      assert.strictEqual(fixture.host.sessionViewLease, void 0);
      assert.strictEqual(fixture.host.lastAttachedEntries.length, 0);
      assert.strictEqual(fixture.lifetimeDisposed, true);
      assert.deepStrictEqual(fixture.phaseCalls, ["sess-B"]);
      assert.deepStrictEqual(fixture.syncCalls, ["sess-B"]);
      fixture.lifetime.dispose();
    }
  });
  test("applyActiveSession same-session KEEP leftover does not clear leftover", () => {
    const leftover = [
      { id: "t1", kind: "user", text: "" },
      { id: "t2", kind: "user", text: "" }
    ];
    for (const mode of ["pairing-hold", "roster-in-flight"]) {
      const fixture = applyActiveLeftoverHost({
        targetSessionId: "sess-A",
        leaseSessionId: "sess-A",
        leftover,
        mode
      });
      const priorLease = fixture.host.sessionViewLease;
      applyActiveSession(fixture.host, "sess-A");
      assert.strictEqual(fixture.applyEntries, 0);
      assert.strictEqual(fixture.acquire, 0);
      assert.strictEqual(fixture.host.sessionViewLease, priorLease);
      assert.strictEqual(fixture.host.lastAttachedEntries, leftover);
      assert.strictEqual(fixture.lifetimeDisposed, false);
      assert.deepStrictEqual(fixture.phaseCalls, ["sess-A"]);
      assert.deepStrictEqual(fixture.syncCalls, ["sess-A"]);
      fixture.lifetime.dispose();
    }
  });
  test("bindSessionView acquireSessionView throw shows failed and does not leave an unhandled rejection", async () => {
    const lifetime = new DisposableStore();
    const failures = [];
    const rejections = [];
    const onUnhandled = (reason) => {
      rejections.push(reason);
    };
    let applyEntries = 0;
    const host = {
      _store: { isDisposed: false },
      sessionViewLifetime: lifetime,
      sessionViewLease: { sessionId: "prior" },
      lastAttachedEntries: [],
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        acquireSessionView: () => {
          throw new Error("acquire boom");
        }
      },
      timelineTree: { applyEntries: () => {
        applyEntries++;
      } },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      applySessionViewTimeline: () => {
      }
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      bindSessionView(host, "sess-leftover");
      await new Promise((resolve) => queueMicrotask(() => resolve()));
      await new Promise((resolve) => setImmediate(() => resolve()));
      assert.deepStrictEqual(failures, ["failed"]);
      assert.strictEqual(host.sessionViewLease, void 0);
      assert.strictEqual(applyEntries, 0);
      assert.deepStrictEqual(rejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
      lifetime.dispose();
    }
  });
  test("retryError posts continueGeneration on the bound lease and does not call roster.retryError", async () => {
    const posted = [];
    let rosterRetry = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async (msg) => {
        posted.push(msg);
        return { accepted: true, correlation: { id: "x" } };
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        retryError: () => {
          rosterRetry++;
          return true;
        }
      },
      showPostFailure: () => {
      }
    };
    retryError(host, { id: "  msg-1  ", turnId: "  turn-1  ", agentId: "  sub:a  " });
    await new Promise((resolve) => queueMicrotask(() => resolve()));
    assert.deepStrictEqual(posted, [{
      kind: "continueGeneration",
      agentId: "sub:a",
      turnId: "turn-1",
      messageId: "msg-1"
    }]);
    assert.strictEqual(rosterRetry, 0);
  });
  test("retryError omitted turnId and agentId fall back to messageId and root", async () => {
    const posted = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async (msg) => {
        posted.push(msg);
        return { accepted: true, correlation: { id: "x" } };
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        retryError: () => true
      },
      showPostFailure: () => {
      }
    };
    retryError(host, { id: "msg-only" });
    await new Promise((resolve) => queueMicrotask(() => resolve()));
    assert.deepStrictEqual(posted, [{
      kind: "continueGeneration",
      agentId: "root",
      turnId: "msg-only",
      messageId: "msg-only"
    }]);
  });
  test("retryError blank messageId posts nothing", async () => {
    let postBound2 = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        postBound2++;
        return { accepted: true, correlation: { id: "x" } };
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        retryError: () => true
      },
      showPostFailure: () => {
      }
    };
    retryError(host, { id: "   " });
    assert.strictEqual(postBound2, 0);
  });
  test("retryError postBound reject shows failed and does not leave an unhandled rejection", async () => {
    const failures = [];
    const rejections = [];
    const onUnhandled = (reason) => {
      rejections.push(reason);
    };
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        throw new Error("postBound boom");
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        retryError: () => true
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      retryError(host, { id: "msg-1" });
      await new Promise((resolve) => queueMicrotask(() => resolve()));
      await new Promise((resolve) => setImmediate(() => resolve()));
      assert.deepStrictEqual(failures, ["failed"]);
      assert.deepStrictEqual(rejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
  test("retryError postBound reject still shows failed and does not leak when showPostFailure throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const failures = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        throw new Error("postBound boom");
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        retryError: () => true
      },
      showPostFailure: (reason) => {
        failures.push(reason);
        throw paintBoom;
      }
    };
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => retryError(host, { id: "msg-1" }));
    assert.deepStrictEqual(failures, ["failed"]);
  });
  test("resolveConfirmation postBound reject shows failed and does not leave an unhandled rejection", async () => {
    const failures = [];
    const rejections = [];
    const onUnhandled = (reason) => {
      rejections.push(reason);
    };
    let focused = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        throw new Error("postBound boom");
      },
      stubService: { isEngineConnected: () => false },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      focusTimelineRecord: () => {
        focused++;
      }
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      void resolveConfirmation(host, "turn-1", "allowed");
      await new Promise((resolve) => queueMicrotask(() => resolve()));
      await new Promise((resolve) => setImmediate(() => resolve()));
      assert.deepStrictEqual(failures, ["failed"]);
      assert.deepStrictEqual(rejections, []);
      assert.strictEqual(focused, 0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
  test("resolveQuestion postBound reject shows failed and does not leave an unhandled rejection", async () => {
    const failures = [];
    const rejections = [];
    const onUnhandled = (reason) => {
      rejections.push(reason);
    };
    let focused = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        throw new Error("postBound boom");
      },
      stubService: { isEngineConnected: () => false },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      focusTimelineRecord: () => {
        focused++;
      }
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      void resolveQuestion(host, "turn-1", "req-1", { q1: { selectedLabels: ["a"] } });
      await new Promise((resolve) => queueMicrotask(() => resolve()));
      await new Promise((resolve) => setImmediate(() => resolve()));
      assert.deepStrictEqual(failures, ["failed"]);
      assert.deepStrictEqual(rejections, []);
      assert.strictEqual(focused, 0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
  test("resolveConfirmation connected roster false shows failed and does not leave an unhandled rejection", async () => {
    const failures = [];
    const rejections = [];
    const onUnhandled = (reason) => {
      rejections.push(reason);
    };
    let focused = 0;
    let forwarded = 0;
    let postBound2 = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        postBound2++;
        return { accepted: true, correlation: { id: "x" } };
      },
      stubService: {
        isEngineConnected: () => true,
        hasEngineConnectionHistory: () => false,
        resolveConfirmation: () => {
          forwarded++;
          return false;
        }
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      focusTimelineRecord: () => {
        focused++;
      }
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      void resolveConfirmation(host, "turn-1", "allowed");
      await new Promise((resolve) => queueMicrotask(() => resolve()));
      await new Promise((resolve) => setImmediate(() => resolve()));
      assert.strictEqual(forwarded, 1);
      assert.strictEqual(postBound2, 0);
      assert.deepStrictEqual(failures, ["failed"]);
      assert.deepStrictEqual(rejections, []);
      assert.strictEqual(focused, 0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
  test("resolveConfirmation connected roster false then disconnect shows engine_disconnected", async () => {
    const failures = [];
    let connected = true;
    let focused = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        return { accepted: true, correlation: { id: "x" } };
      },
      stubService: {
        isEngineConnected: () => connected,
        hasEngineConnectionHistory: () => true,
        resolveConfirmation: () => {
          connected = false;
          return false;
        }
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      focusTimelineRecord: () => {
        focused++;
      }
    };
    await resolveConfirmation(host, "turn-1", "skipped");
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
    assert.strictEqual(focused, 0);
  });
  test("resolveQuestion connected roster false shows failed and does not leave an unhandled rejection", async () => {
    const failures = [];
    const rejections = [];
    const onUnhandled = (reason) => {
      rejections.push(reason);
    };
    let focused = 0;
    let forwarded = 0;
    let postBound2 = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        postBound2++;
        return { accepted: true, correlation: { id: "x" } };
      },
      stubService: {
        isEngineConnected: () => true,
        hasEngineConnectionHistory: () => false,
        respondQuestion: () => {
          forwarded++;
          return false;
        }
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      focusTimelineRecord: () => {
        focused++;
      }
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      void resolveQuestion(host, "turn-1", "req-1", { q1: { selectedLabels: ["a"] } });
      await new Promise((resolve) => queueMicrotask(() => resolve()));
      await new Promise((resolve) => setImmediate(() => resolve()));
      assert.strictEqual(forwarded, 1);
      assert.strictEqual(postBound2, 0);
      assert.deepStrictEqual(failures, ["failed"]);
      assert.deepStrictEqual(rejections, []);
      assert.strictEqual(focused, 0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
  test("resolveQuestion connected roster false then disconnect shows engine_disconnected", async () => {
    const failures = [];
    let connected = true;
    let focused = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      postBound: async () => {
        return { accepted: true, correlation: { id: "x" } };
      },
      stubService: {
        isEngineConnected: () => connected,
        hasEngineConnectionHistory: () => true,
        respondQuestion: () => {
          connected = false;
          return false;
        }
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      focusTimelineRecord: () => {
        focused++;
      }
    };
    await resolveQuestion(host, "turn-1", "req-1", { q1: { selectedLabels: ["a"] } });
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
    assert.strictEqual(focused, 0);
  });
  function pairingHoldLeftoverWriteHost(failures) {
    const state = { posted: 0 };
    const host = {
      getBoundSessionId: () => "sess-leftover",
      sessionViewLease: {
        post: async () => {
          state.posted++;
          return { accepted: true, correlation: { id: "x" } };
        }
      },
      postBound: async (msg) => {
        return postBound(host, msg);
      },
      stubService: {
        isEngineConnected: () => false,
        isEngineSessionReady: () => false,
        hasEngineConnectionHistory: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      focusTimelineRecord: () => {
      }
    };
    return { host, get posted() {
      return state.posted;
    } };
  }
  test("postBound pairing-hold leftover lease rejects without lease.post", async () => {
    const failures = [];
    const { host, posted } = pairingHoldLeftoverWriteHost(failures);
    const outcome = await postBound(host, {
      kind: "continueGeneration",
      agentId: "root",
      turnId: "turn-1",
      messageId: "msg-1"
    });
    assert.strictEqual(posted, 0);
    assert.strictEqual(outcome.accepted, false);
    if (!outcome.accepted) {
      assert.strictEqual(outcome.reason, "no_such_session");
    }
    assert.deepStrictEqual(failures, []);
  });
  test("resolveConfirmation pairing-hold leftover lease does not post and shows engine_disconnected", async () => {
    const failures = [];
    const { host, posted } = pairingHoldLeftoverWriteHost(failures);
    await resolveConfirmation(host, "turn-1", "allowed");
    assert.strictEqual(posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("resolveQuestion pairing-hold leftover lease does not post and shows engine_disconnected", async () => {
    const failures = [];
    const { host, posted } = pairingHoldLeftoverWriteHost(failures);
    await resolveQuestion(host, "turn-1", "req-1", { q1: { selectedLabels: ["a"] } });
    assert.strictEqual(posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  function leftoverLooksLiveConfirmQuestionHost(failures, pairingPending, engineSessionReady = true) {
    const state = { resolveConfirmationCalls: 0, respondQuestionCalls: 0, deleteTurnCalls: 0, cancelToolCallCalls: 0, posted: 0, focused: 0 };
    const host = {
      getBoundSessionId: () => "sess-leftover",
      postBound: async () => {
        state.posted++;
        return { accepted: true, correlation: { id: "x" } };
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => engineSessionReady,
        hasEngineConnectionHistory: () => true,
        resolveConfirmation: () => {
          state.resolveConfirmationCalls++;
          return true;
        },
        respondQuestion: () => {
          state.respondQuestionCalls++;
          return true;
        },
        deleteTurn: () => {
          state.deleteTurnCalls++;
          return true;
        },
        cancelToolCall: () => {
          state.cancelToolCallCalls++;
          return true;
        }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending })
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      focusTimelineRecord: () => {
        state.focused++;
      }
    };
    return {
      host,
      get resolveConfirmationCalls() {
        return state.resolveConfirmationCalls;
      },
      get respondQuestionCalls() {
        return state.respondQuestionCalls;
      },
      get deleteTurnCalls() {
        return state.deleteTurnCalls;
      },
      get cancelToolCallCalls() {
        return state.cancelToolCallCalls;
      },
      get posted() {
        return state.posted;
      },
      get focused() {
        return state.focused;
      }
    };
  }
  test("leftover-looks-live resolveConfirmation skips unary and shows engine_disconnected", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, true);
    await resolveConfirmation(fixture.host, "turn-1", "allowed");
    assert.strictEqual(fixture.resolveConfirmationCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.strictEqual(fixture.focused, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("leftover-looks-live resolveQuestion skips unary and shows engine_disconnected", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, true);
    await resolveQuestion(fixture.host, "turn-1", "req-1", { q1: { selectedLabels: ["a"] } });
    assert.strictEqual(fixture.respondQuestionCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.strictEqual(fixture.focused, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("leftover-looks-live deleteTurn skips unary and shows engine_disconnected", () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, true);
    deleteTurn(fixture.host, "turn-1");
    assert.strictEqual(fixture.deleteTurnCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("leftover-looks-live cancelToolCall skips unary and shows engine_disconnected", () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, true);
    cancelToolCall(fixture.host, { id: "e-run", toolCallId: "tc-1", agentId: "sub:a" });
    assert.strictEqual(fixture.cancelToolCallCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("leftover-looks-live retryError skips postBound and shows engine_disconnected", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, true);
    retryError(fixture.host, { id: "msg-1", turnId: "turn-1", agentId: "root" });
    await new Promise((resolve) => queueMicrotask(() => resolve()));
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("connected without pairing resolveConfirmation still forwards", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false);
    await resolveConfirmation(fixture.host, "turn-1", "allowed");
    assert.strictEqual(fixture.resolveConfirmationCalls, 1);
    assert.strictEqual(fixture.posted, 0);
    assert.strictEqual(fixture.focused, 1);
    assert.deepStrictEqual(failures, []);
  });
  test("connected without pairing resolveQuestion still forwards", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false);
    await resolveQuestion(fixture.host, "turn-1", "req-1", { q1: { selectedLabels: ["a"] } });
    assert.strictEqual(fixture.respondQuestionCalls, 1);
    assert.strictEqual(fixture.posted, 0);
    assert.strictEqual(fixture.focused, 1);
    assert.deepStrictEqual(failures, []);
  });
  test("connected without pairing deleteTurn still forwards", () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
    deleteTurn(fixture.host, "turn-1");
    assert.strictEqual(fixture.deleteTurnCalls, 1);
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, []);
  });
  test("connected without pairing cancelToolCall still forwards", () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
    cancelToolCall(fixture.host, { id: "e-run", toolCallId: "tc-1", agentId: "sub:a" });
    assert.strictEqual(fixture.cancelToolCallCalls, 1);
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, []);
  });
  test("connected without pairing retryError still posts continueGeneration", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
    retryError(fixture.host, { id: "msg-1", turnId: "turn-1", agentId: "root" });
    await new Promise((resolve) => queueMicrotask(() => resolve()));
    assert.strictEqual(fixture.posted, 1);
    assert.deepStrictEqual(failures, []);
  });
  test("KEEP leftover list-fail resolveConfirmation skips unary and shows session_not_ready", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false, false);
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    await resolveConfirmation(fixture.host, "turn-1", "allowed");
    assert.strictEqual(fixture.resolveConfirmationCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.strictEqual(fixture.focused, 0);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
  });
  test("KEEP leftover list-fail resolveQuestion skips unary and shows session_not_ready", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false, false);
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    await resolveQuestion(fixture.host, "turn-1", "req-1", { q1: { selectedLabels: ["a"] } });
    assert.strictEqual(fixture.respondQuestionCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.strictEqual(fixture.focused, 0);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
  });
  test("KEEP leftover list-fail deleteTurn skips unary and shows session_not_ready", () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false, false);
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    deleteTurn(fixture.host, "turn-1");
    assert.strictEqual(fixture.deleteTurnCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
  });
  test("KEEP leftover list-fail cancelToolCall skips unary and shows session_not_ready", () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false, false);
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    cancelToolCall(fixture.host, { id: "e-run", toolCallId: "tc-1", agentId: "sub:a" });
    assert.strictEqual(fixture.cancelToolCallCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
  });
  test("KEEP leftover list-fail retryError skips postBound and shows session_not_ready", async () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false, false);
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    retryError(fixture.host, { id: "msg-1", turnId: "turn-1", agentId: "root" });
    await new Promise((resolve) => queueMicrotask(() => resolve()));
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
  });
  test("retryError pairing-hold leftover lease does not post and shows engine_disconnected", async () => {
    const failures = [];
    const { host, posted } = pairingHoldLeftoverWriteHost(failures);
    retryError(host, { id: "msg-1", turnId: "turn-1", agentId: "root" });
    await new Promise((resolve) => queueMicrotask(() => resolve()));
    assert.strictEqual(posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  function pairingHoldComposerWriteHost(failures) {
    const state = { posted: 0, enqueueCalls: 0, turnWrites: 0, queueWrites: 0 };
    const host = {
      composerPolicy: "compose",
      submitInFlight: false,
      editingTurnId: "turn-1",
      editingQueueItemId: "q1",
      dockTextarea: { value: "leftover draft" },
      sendButton: { enabled: true },
      getBoundSessionId: () => "sess-leftover",
      getEditingQueueItem: () => ({ id: "q1", content: "queued" }),
      sessionViewLease: {
        post: async () => {
          state.posted++;
          return { accepted: true, correlation: { id: "x" } };
        }
      },
      stubService: {
        isEngineConnected: () => false,
        isEngineSessionReady: () => false,
        hasEngineConnectionHistory: () => true,
        enqueueMessageQueueItem: () => {
          state.enqueueCalls++;
          return true;
        },
        updateUserTurnText: () => {
          state.turnWrites++;
          return true;
        },
        updateMessageQueueItemContent: () => {
          state.queueWrites++;
          return true;
        }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      },
      exitComposerEdit: () => {
      },
      renderInboxStatus: () => {
      },
      updateSendEnabled: () => {
      },
      updateConversationPhase: () => {
      },
      resetInputHistoryBrowse: () => {
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    return {
      host,
      get posted() {
        return state.posted;
      },
      get enqueueCalls() {
        return state.enqueueCalls;
      },
      get turnWrites() {
        return state.turnWrites;
      },
      get queueWrites() {
        return state.queueWrites;
      }
    };
  }
  test("updateSendEnabled pairing-hold leftover draft disables Send", () => {
    const failures = [];
    const { host } = pairingHoldComposerWriteHost(failures);
    const chromeHost = host;
    updateSendEnabled(chromeHost);
    assert.strictEqual(chromeHost.sendButton.enabled, false);
    assert.deepStrictEqual(failures, []);
  });
  test("submitDraft pairing-hold leftover draft does not enqueue or post", async () => {
    const failures = [];
    const { host, posted, enqueueCalls } = pairingHoldComposerWriteHost(failures);
    await submitDraft(host);
    assert.strictEqual(posted, 0);
    assert.strictEqual(enqueueCalls, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
    assert.strictEqual(host.dockTextarea.value, "leftover draft");
  });
  test("saveTurnEdit pairing-hold leftover does not write and stays in edit", () => {
    const failures = [];
    const { host, turnWrites } = pairingHoldComposerWriteHost(failures);
    host.composerPolicy = "turnEdit";
    saveTurnEdit(host);
    assert.strictEqual(turnWrites, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
    assert.strictEqual(host.editingTurnId, "turn-1");
    assert.strictEqual(host.composerPolicy, "turnEdit");
    assert.strictEqual(host.dockTextarea.value, "leftover draft");
  });
  test("saveQueueEdit pairing-hold leftover does not write and stays in edit", () => {
    const failures = [];
    const { host, queueWrites } = pairingHoldComposerWriteHost(failures);
    host.composerPolicy = "queueEdit";
    saveQueueEdit(host);
    assert.strictEqual(queueWrites, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
    assert.strictEqual(host.editingQueueItemId, "q1");
    assert.strictEqual(host.composerPolicy, "queueEdit");
    assert.strictEqual(host.dockTextarea.value, "leftover draft");
  });
  function leftoverComposerHandlerHost(options) {
    const state = { posted: 0, enqueueCalls: 0, turnWrites: 0, queueWrites: 0, exited: 0 };
    const host = {
      composerPolicy: "compose",
      submitInFlight: false,
      filterAgentId: void 0,
      catalogModelIds: [""],
      modelSelectedIndex: 0,
      drafts: /* @__PURE__ */ new Map(),
      configurationService: { getValue: () => false },
      editingTurnId: "turn-1",
      editingQueueItemId: "q1",
      dockTextarea: { value: "leftover draft" },
      sendButton: { enabled: true },
      getBoundSessionId: () => "sess-leftover",
      getEditingQueueItem: () => ({ id: "q1", content: "queued" }),
      sessionViewLease: {
        post: async () => {
          state.posted++;
          return { accepted: true, correlation: { id: "x" } };
        }
      },
      stubService: {
        isEngineConnected: () => options.engineConnected,
        ...options.engineSessionReady === void 0 ? {} : { isEngineSessionReady: () => options.engineSessionReady },
        hasEngineConnectionHistory: () => true,
        enqueueMessageQueueItem: () => {
          state.enqueueCalls++;
          return true;
        },
        updateUserTurnText: () => {
          state.turnWrites++;
          return true;
        },
        updateMessageQueueItemContent: () => {
          state.queueWrites++;
          return true;
        },
        getTurns: () => [],
        releaseMessageQueueItemHold: () => {
        }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: options.pairingPending })
      },
      exitComposerEdit: () => {
        state.exited++;
      },
      renderInboxStatus: () => {
      },
      updateSendEnabled: () => {
      },
      updateConversationPhase: () => {
      },
      resetInputHistoryBrowse: () => {
      },
      showPostFailure: (reason) => {
        options.failures.push(reason);
      }
    };
    return {
      host,
      get posted() {
        return state.posted;
      },
      get enqueueCalls() {
        return state.enqueueCalls;
      },
      get turnWrites() {
        return state.turnWrites;
      },
      get queueWrites() {
        return state.queueWrites;
      },
      get exited() {
        return state.exited;
      }
    };
  }
  test("KEEP leftover list-fail submitDraft skips postBound and shows session_not_ready", async () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: false,
      engineConnected: true,
      engineSessionReady: false,
      failures
    });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    await submitDraft(fixture.host);
    assert.strictEqual(fixture.posted, 0);
    assert.strictEqual(fixture.enqueueCalls, 0);
    assert.strictEqual(fixture.host.submitInFlight, false);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
    assert.strictEqual(fixture.host.dockTextarea.value, "leftover draft");
  });
  test("KEEP leftover list-fail saveTurnEdit skips updateUserTurnText and stays in edit", () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: false,
      engineConnected: true,
      engineSessionReady: false,
      failures
    });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    fixture.host.composerPolicy = "turnEdit";
    saveTurnEdit(fixture.host);
    assert.strictEqual(fixture.turnWrites, 0);
    assert.strictEqual(fixture.exited, 0);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
    assert.strictEqual(fixture.host.editingTurnId, "turn-1");
    assert.strictEqual(fixture.host.composerPolicy, "turnEdit");
    assert.strictEqual(fixture.host.dockTextarea.value, "leftover draft");
  });
  test("KEEP leftover list-fail saveQueueEdit skips queue write and stays in edit", () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: false,
      engineConnected: true,
      engineSessionReady: false,
      failures
    });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    fixture.host.composerPolicy = "queueEdit";
    saveQueueEdit(fixture.host);
    assert.strictEqual(fixture.queueWrites, 0);
    assert.strictEqual(fixture.exited, 0);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
    assert.strictEqual(fixture.host.editingQueueItemId, "q1");
    assert.strictEqual(fixture.host.composerPolicy, "queueEdit");
    assert.strictEqual(fixture.host.dockTextarea.value, "leftover draft");
  });
  test("leftover-looks-live submitDraft skips postBound and shows engine_disconnected", async () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: true,
      engineConnected: true,
      engineSessionReady: true,
      failures
    });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), true);
    await submitDraft(fixture.host);
    assert.strictEqual(fixture.posted, 0);
    assert.strictEqual(fixture.enqueueCalls, 0);
    assert.strictEqual(fixture.host.submitInFlight, false);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("leftover-looks-live saveTurnEdit skips updateUserTurnText", () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: true,
      engineConnected: true,
      engineSessionReady: true,
      failures
    });
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), true);
    fixture.host.composerPolicy = "turnEdit";
    saveTurnEdit(fixture.host);
    assert.strictEqual(fixture.turnWrites, 0);
    assert.strictEqual(fixture.exited, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("leftover-looks-live saveQueueEdit skips queue write", () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: true,
      engineConnected: true,
      engineSessionReady: true,
      failures
    });
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), true);
    fixture.host.composerPolicy = "queueEdit";
    saveQueueEdit(fixture.host);
    assert.strictEqual(fixture.queueWrites, 0);
    assert.strictEqual(fixture.exited, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("connected live submitDraft still posts when engine session is ready", async () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: false,
      engineConnected: true,
      engineSessionReady: true,
      failures
    });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    await submitDraft(fixture.host);
    assert.strictEqual(fixture.posted, 1);
    assert.strictEqual(fixture.enqueueCalls, 0);
    assert.deepStrictEqual(failures, []);
    assert.strictEqual(fixture.host.dockTextarea.value, "");
  });
  test("connected live saveTurnEdit still writes when engine session is ready", () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: false,
      engineConnected: true,
      engineSessionReady: true,
      failures
    });
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    fixture.host.composerPolicy = "turnEdit";
    saveTurnEdit(fixture.host);
    assert.strictEqual(fixture.turnWrites, 1);
    assert.strictEqual(fixture.exited, 1);
    assert.deepStrictEqual(failures, []);
  });
  test("connected live saveQueueEdit still writes when engine session is ready", () => {
    const failures = [];
    const fixture = leftoverComposerHandlerHost({
      pairingPending: false,
      engineConnected: true,
      engineSessionReady: true,
      failures
    });
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    fixture.host.composerPolicy = "queueEdit";
    saveQueueEdit(fixture.host);
    assert.strictEqual(fixture.queueWrites, 1);
    assert.strictEqual(fixture.exited, 1);
    assert.deepStrictEqual(failures, []);
  });
  test("deleteTurn pairing-hold leftover does not write and shows engine_disconnected", () => {
    const failures = [];
    const { host, posted } = pairingHoldLeftoverWriteHost(failures);
    let deleteCalls = 0;
    host.stubService.deleteTurn = () => {
      deleteCalls++;
      return true;
    };
    deleteTurn(host, "turn-1");
    assert.strictEqual(deleteCalls, 0);
    assert.strictEqual(posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("beginTurnEdit pairing-hold leftover does not enter edit", () => {
    const failures = [];
    const { host } = pairingHoldComposerWriteHost(failures);
    const chromeHost = host;
    chromeHost.composerPolicy = "compose";
    chromeHost.editingTurnId = void 0;
    beginTurnEdit(chromeHost, "turn-1");
    assert.strictEqual(chromeHost.composerPolicy, "compose");
    assert.strictEqual(chromeHost.editingTurnId, void 0);
    assert.deepStrictEqual(failures, []);
  });
  function keepLeftoverListFailWriteHost(failures) {
    const host = {
      composerPolicy: "compose",
      submitInFlight: false,
      editingTurnId: void 0,
      editingQueueItemId: void 0,
      dockTextarea: { value: "leftover draft" },
      sendButton: { enabled: true },
      getBoundSessionId: () => "sess-leftover",
      isPreFirst: () => false,
      inboxOverlay: { closeListPanel: () => {
      } },
      composer: document.createElement("div"),
      timelineTree: { setEditingTurnId: () => {
      } },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => false,
        hasEngineConnectionHistory: () => true,
        getTurns: () => [{ id: "turn-1", kind: "user", text: "leftover user" }]
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false })
      },
      exitComposerEdit: () => {
      },
      renderInboxStatus: () => {
      },
      updateSendEnabled: () => {
      },
      updateConversationPhase: () => {
      },
      resetInputHistoryBrowse: () => {
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    return { host };
  }
  test("KEEP leftover list-fail writesEnabled is false and beginTurnEdit does not enter edit", () => {
    const failures = [];
    const { host } = keepLeftoverListFailWriteHost(failures);
    const chromeHost = host;
    assert.strictEqual(host.stubService.isEngineConnected(), true);
    assert.strictEqual(host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(isConversationPairingHold(host.uaConnection), false);
    assert.strictEqual(isReadingColumnWritesEnabled(chromeHost), false);
    chromeHost.composerPolicy = "compose";
    chromeHost.editingTurnId = void 0;
    beginTurnEdit(chromeHost, "turn-1");
    assert.strictEqual(chromeHost.composerPolicy, "compose");
    assert.strictEqual(chromeHost.editingTurnId, void 0);
    assert.deepStrictEqual(failures, []);
  });
  test("pairing-hold writesEnabled stays false", () => {
    const failures = [];
    const { host } = pairingHoldComposerWriteHost(failures);
    assert.strictEqual(isConversationPairingHold(host.uaConnection), true);
    assert.strictEqual(isReadingColumnWritesEnabled(host), false);
  });
  test("connected live writesEnabled stays true when engine session is ready", () => {
    const host = {
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false })
      }
    };
    assert.strictEqual(isConversationPairingHold(host.uaConnection), false);
    assert.strictEqual(host.stubService.isEngineSessionReady(), true);
    assert.strictEqual(isReadingColumnWritesEnabled(host), true);
  });
  test("beginQueueEdit pairing-hold leftover does not enter edit", () => {
    const failures = [];
    const { host } = pairingHoldComposerWriteHost(failures);
    const chromeHost = host;
    chromeHost.composerPolicy = "compose";
    chromeHost.editingQueueItemId = void 0;
    beginQueueEdit(chromeHost, "q1");
    assert.strictEqual(chromeHost.composerPolicy, "compose");
    assert.strictEqual(chromeHost.editingQueueItemId, void 0);
    assert.deepStrictEqual(failures, []);
  });
  test("updateSessionBarWriteChrome pairing-hold disables title delete and new", () => {
    const title = document.createElement("button");
    const newButton = { enabled: true };
    const deleteButton = { enabled: true };
    const host = {
      sessionTitleButton: title,
      newSessionButton: newButton,
      deleteSessionButton: deleteButton,
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      }
    };
    updateSessionBarWriteChrome(host);
    assert.strictEqual(title.disabled, true);
    assert.strictEqual(title.getAttribute("aria-disabled"), "true");
    assert.strictEqual(newButton.enabled, false);
    assert.strictEqual(deleteButton.enabled, false);
  });
  test("updateSessionBarWriteChrome leftover-looks-live keeps title delete and new disabled", () => {
    const title = document.createElement("button");
    const newButton = { enabled: true };
    const deleteButton = { enabled: true };
    const host = {
      sessionTitleButton: title,
      newSessionButton: newButton,
      deleteSessionButton: deleteButton,
      stubService: {
        isEngineConnected: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: true })
      }
    };
    assert.strictEqual(host.stubService.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
    assert.strictEqual(isConversationPairingHold(host.uaConnection), true);
    updateSessionBarWriteChrome(host);
    assert.strictEqual(title.disabled, true);
    assert.strictEqual(title.getAttribute("aria-disabled"), "true");
    assert.strictEqual(newButton.enabled, false);
    assert.strictEqual(deleteButton.enabled, false);
  });
  test("updateSessionBarWriteChrome KEEP leftover disables title delete and new", () => {
    const title = document.createElement("button");
    const newButton = { enabled: true };
    const deleteButton = { enabled: true };
    const host = {
      sessionTitleButton: title,
      newSessionButton: newButton,
      deleteSessionButton: deleteButton,
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => false,
        getSessions: () => [{ id: "ua-a", title: "A" }]
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false })
      }
    };
    assert.strictEqual(host.stubService.isEngineConnected(), true);
    assert.strictEqual(host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(isConversationPairingHold(host.uaConnection), false);
    updateSessionBarWriteChrome(host);
    assert.strictEqual(title.disabled, true);
    assert.strictEqual(title.getAttribute("aria-disabled"), "true");
    assert.strictEqual(newButton.enabled, false);
    assert.strictEqual(deleteButton.enabled, false);
  });
  test("updateSessionBarWriteChrome connected live keeps title delete and new enabled", () => {
    const title = document.createElement("button");
    const newButton = { enabled: true };
    const deleteButton = { enabled: true };
    const host = {
      sessionTitleButton: title,
      newSessionButton: newButton,
      deleteSessionButton: deleteButton,
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false })
      }
    };
    assert.strictEqual(host.stubService.isEngineConnected(), true);
    assert.strictEqual(host.stubService.isEngineSessionReady(), true);
    assert.strictEqual(isConversationPairingHold(host.uaConnection), false);
    updateSessionBarWriteChrome(host);
    assert.strictEqual(title.disabled, false);
    assert.strictEqual(title.getAttribute("aria-disabled"), "false");
    assert.strictEqual(newButton.enabled, true);
    assert.strictEqual(deleteButton.enabled, true);
  });
  function sessionBarHandlerHost(options) {
    const failures = [];
    const createCalls = [];
    const deleteCalls = [];
    const renameCalls = [];
    const draftWrites = [];
    const sessions = [{ id: "ua-a", title: "A" }];
    const titleButton = document.createElement("button");
    titleButton.textContent = "A";
    const titleInput = document.createElement("input");
    titleInput.hidden = true;
    const titleLive = document.createElement("span");
    titleLive.textContent = "A";
    const host = {
      sessionTitleButton: titleButton,
      sessionTitleInput: titleInput,
      sessionTitleLive: titleLive,
      sessionTitleEditing: false,
      sessionTitleEditSnapshot: "A",
      dialogService: { confirm: () => Promise.resolve({ confirmed: true }) },
      composerPolicy: "compose",
      composeDraftSnapshot: "Saved compose snapshot must not replace the live draft",
      dockTextarea: { value: "leftover draft" },
      getBoundSessionId: () => "ua-a",
      writeComposerDraft: (_sessionId, text) => {
        draftWrites.push(text);
      },
      deleteComposerDraftsForSession: () => {
      },
      refreshSessionSelectOptions: () => {
      },
      updateSessionTitle: () => {
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      },
      stubService: {
        isEngineConnected: () => options.engineConnected ?? true,
        isEngineSessionReady: () => options.engineSessionReady,
        hasEngineConnectionHistory: () => options.hasEngineConnectionHistory ?? true,
        getActiveSessionId: () => "ua-a",
        getActiveSession: () => sessions[0],
        getSessions: () => sessions,
        createSession: () => {
          createCalls.push(1);
          sessions.push({ id: `ua-new-${createCalls.length}`, title: "New session" });
          return sessions[sessions.length - 1].id;
        },
        deleteSession: (sessionId) => {
          deleteCalls.push(1);
          const index = sessions.findIndex((session) => session.id === sessionId);
          if (index < 0) {
            return false;
          }
          sessions.splice(index, 1);
          return true;
        },
        renameSession: (sessionId, title) => {
          renameCalls.push(1);
          const session = sessions.find((entry) => entry.id === sessionId);
          if (!session) {
            return false;
          }
          session.title = title;
          return true;
        }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: options.pairingPending })
      }
    };
    return {
      host,
      failures,
      createCalls,
      deleteCalls,
      renameCalls,
      draftWrites
    };
  }
  test("KEEP leftover SessionBar handlers refuse title edit create delete rename", () => {
    const fixture = sessionBarHandlerHost({ pairingPending: false, engineSessionReady: false });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
    assert.strictEqual(fixture.host.uaConnection.getConnectionSnapshot().pairingPending, false);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    beginSessionTitleEdit(fixture.host);
    assert.strictEqual(fixture.host.sessionTitleEditing, false);
    assert.strictEqual(fixture.host.sessionTitleButton.hidden, false);
    assert.strictEqual(fixture.host.sessionTitleInput.hidden, true);
    assert.deepStrictEqual(fixture.failures, []);
    assert.deepStrictEqual(fixture.renameCalls, []);
    createNewSession(fixture.host);
    deleteActiveSession(fixture.host);
    assert.deepStrictEqual(fixture.createCalls, []);
    assert.deepStrictEqual(fixture.deleteCalls, []);
    assert.deepStrictEqual(fixture.draftWrites, []);
    assert.deepStrictEqual(fixture.host.stubService.getSessions().map((session) => session.title), ["A"]);
    assert.deepStrictEqual(fixture.failures, ["session_not_ready", "session_not_ready"]);
    fixture.host.sessionTitleEditing = true;
    fixture.host.sessionTitleButton.hidden = true;
    fixture.host.sessionTitleInput.hidden = false;
    fixture.host.sessionTitleInput.value = "Hacked leftover title";
    commitSessionTitleEdit(fixture.host);
    assert.strictEqual(fixture.host.sessionTitleEditing, false);
    assert.strictEqual(fixture.host.sessionTitleButton.hidden, false);
    assert.strictEqual(fixture.host.sessionTitleInput.hidden, true);
    assert.deepStrictEqual(fixture.renameCalls, []);
    assert.deepStrictEqual(fixture.createCalls, []);
    assert.deepStrictEqual(fixture.deleteCalls, []);
    assert.deepStrictEqual(fixture.host.stubService.getSessions().map((session) => session.title), ["A"]);
    assert.deepStrictEqual(fixture.failures, ["session_not_ready", "session_not_ready", "session_not_ready"]);
  });
  test("pairing-hold SessionBar handlers still refuse title edit create delete", () => {
    const fixture = sessionBarHandlerHost({ pairingPending: true, engineSessionReady: true });
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), true);
    beginSessionTitleEdit(fixture.host);
    assert.strictEqual(fixture.host.sessionTitleEditing, false);
    assert.deepStrictEqual(fixture.failures, []);
    createNewSession(fixture.host);
    deleteActiveSession(fixture.host);
    assert.deepStrictEqual(fixture.createCalls, []);
    assert.deepStrictEqual(fixture.deleteCalls, []);
    assert.deepStrictEqual(fixture.renameCalls, []);
    assert.deepStrictEqual(fixture.draftWrites, []);
    assert.deepStrictEqual(fixture.host.stubService.getSessions().map((session) => session.title), ["A"]);
    assert.deepStrictEqual(fixture.failures, ["engine_disconnected", "engine_disconnected"]);
  });
  test("engine-cache disconnect SessionBar handlers refuse create without capturing a draft", () => {
    const fixture = sessionBarHandlerHost({ pairingPending: false, engineSessionReady: true, engineConnected: false });
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    createNewSession(fixture.host);
    deleteActiveSession(fixture.host);
    assert.deepStrictEqual(fixture.createCalls, []);
    assert.deepStrictEqual(fixture.deleteCalls, []);
    assert.deepStrictEqual(fixture.draftWrites, []);
    assert.deepStrictEqual(fixture.failures, ["engine_disconnected", "engine_disconnected"]);
  });
  test("connected live SessionBar handlers still write when engine session is ready", async () => {
    const fixture = sessionBarHandlerHost({ pairingPending: false, engineSessionReady: true });
    assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
    assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
    assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
    beginSessionTitleEdit(fixture.host);
    assert.strictEqual(fixture.host.sessionTitleEditing, true);
    fixture.host.sessionTitleInput.value = "Renamed live";
    commitSessionTitleEdit(fixture.host);
    assert.strictEqual(fixture.host.sessionTitleEditing, false);
    assert.deepStrictEqual(fixture.renameCalls, [1]);
    assert.strictEqual(fixture.host.stubService.getSessions()[0].title, "Renamed live");
    createNewSession(fixture.host);
    assert.deepStrictEqual(fixture.createCalls, [1]);
    assert.deepStrictEqual(fixture.draftWrites, ["leftover draft"]);
    assert.strictEqual(fixture.host.stubService.getSessions().length, 2);
    await deleteActiveSession(fixture.host);
    assert.deepStrictEqual(fixture.deleteCalls, [1]);
    assert.deepStrictEqual(fixture.failures, []);
  });
  test("unchanged or blank session title commit does not look like a failed send", () => {
    const unchanged = sessionBarHandlerHost({ pairingPending: false, engineSessionReady: true });
    beginSessionTitleEdit(unchanged.host);
    unchanged.host.sessionTitleInput.value = "  A  ";
    commitSessionTitleEdit(unchanged.host);
    assert.strictEqual(unchanged.host.sessionTitleEditing, false);
    assert.strictEqual(unchanged.host.sessionTitleButton.hidden, false);
    assert.strictEqual(unchanged.host.sessionTitleInput.hidden, true);
    assert.strictEqual(unchanged.host.sessionTitleButton.textContent, "A");
    assert.deepStrictEqual(unchanged.renameCalls, []);
    assert.deepStrictEqual(unchanged.failures, []);
    assert.strictEqual(unchanged.host.stubService.getSessions()[0].title, "A");
    const blank = sessionBarHandlerHost({ pairingPending: false, engineSessionReady: true });
    beginSessionTitleEdit(blank.host);
    blank.host.sessionTitleInput.value = "   ";
    commitSessionTitleEdit(blank.host);
    assert.strictEqual(blank.host.sessionTitleEditing, false);
    assert.strictEqual(blank.host.sessionTitleButton.textContent, "A");
    assert.deepStrictEqual(blank.renameCalls, []);
    assert.deepStrictEqual(blank.failures, ["empty_session_title"]);
    assert.strictEqual(blank.host.stubService.getSessions()[0].title, "A");
  });
  test("session title commit during pairing hold does not rename", () => {
    const fixture = sessionBarHandlerHost({ pairingPending: true, engineSessionReady: true });
    fixture.host.sessionTitleEditing = true;
    fixture.host.sessionTitleButton.hidden = true;
    fixture.host.sessionTitleInput.hidden = false;
    fixture.host.sessionTitleInput.value = "Renamed while pairing";
    commitSessionTitleEdit(fixture.host);
    assert.strictEqual(fixture.host.sessionTitleEditing, false);
    assert.strictEqual(fixture.host.sessionTitleButton.hidden, false);
    assert.strictEqual(fixture.host.sessionTitleInput.hidden, true);
    assert.strictEqual(fixture.host.sessionTitleButton.textContent, "A");
    assert.deepStrictEqual(fixture.renameCalls, []);
    assert.deepStrictEqual(fixture.failures, ["engine_disconnected"]);
    assert.strictEqual(fixture.host.stubService.getSessions()[0].title, "A");
  });
  function leftoverLooksLiveSessionSelectsHost(options) {
    const store = new DisposableStore();
    const executedCommands = [];
    const permissionCalls = [];
    const modelCalls = [];
    const dockRoot = document.createElement("div");
    document.body.appendChild(dockRoot);
    store.add({ dispose: () => dockRoot.remove() });
    const permissionContainer = document.createElement("div");
    permissionContainer.className = "conversation-lens-dock-permission";
    const permissionSelect = document.createElement("select");
    permissionSelect.add(new Option("Ask", "0"));
    permissionSelect.add(new Option("Agent", "1"));
    permissionSelect.add(new Option("Permit", "2"));
    permissionContainer.appendChild(permissionSelect);
    dockRoot.appendChild(permissionContainer);
    const modelContainer = document.createElement("div");
    modelContainer.className = "conversation-lens-dock-model";
    const modelSelect = document.createElement("select");
    for (const id of options?.catalogModelIds ?? ["", "gpt-test"]) {
      modelSelect.add(new Option(id || "No model", id));
    }
    modelContainer.appendChild(modelSelect);
    dockRoot.appendChild(modelContainer);
    const moreButton = document.createElement("button");
    let pairingPending = options?.pairingPending ?? true;
    const engineSessionReady = options?.engineSessionReady;
    const sessionConfigBySessionId = /* @__PURE__ */ new Map([
      ["sess-leftover", { agentIndex: 0, permissionIndex: options?.permissionIndex ?? 0 }]
    ]);
    permissionSelect.selectedIndex = options?.permissionIndex ?? 0;
    modelSelect.selectedIndex = options?.modelSelectedIndex ?? 0;
    const agentContainer = document.createElement("div");
    const agentSelect = document.createElement("select");
    agentSelect.add(new Option("No agent", ""));
    agentSelect.add(new Option("Coder", "coder"));
    agentContainer.appendChild(agentSelect);
    const gateRow = document.createElement("div");
    const gateLabel = document.createElement("span");
    gateRow.appendChild(gateLabel);
    const host = {
      catalogToolNames: options?.catalogToolNames ?? ["bash"],
      catalogModelIds: options?.catalogModelIds ?? ["", "gpt-test"],
      modelSelectedIndex: options?.modelSelectedIndex ?? 0,
      sessionConfigBySessionId,
      lastReadingWidth: options?.lastReadingWidth ?? 300,
      postFailureVisible: false,
      tuneContextView: void 0,
      moreContextView: void 0,
      dockRoot,
      dockTextarea: { value: "leftover draft" },
      sendButton: { enabled: true },
      gateRow,
      gateLabel,
      composerPolicy: "compose",
      permissionSelectBox: {
        setEnabled(enabled) {
          permissionSelect.disabled = !enabled;
        },
        setAriaLabel() {
        },
        select(index) {
          permissionSelect.selectedIndex = index;
        }
      },
      agentSelectBox: {
        setEnabled(enabled) {
          agentSelect.disabled = !enabled;
          agentSelect.setAttribute("aria-disabled", String(!enabled));
        },
        setAriaLabel() {
        },
        select(index) {
          agentSelect.selectedIndex = index;
        }
      },
      modelSelectBox: {
        setEnabled(enabled) {
          modelSelect.disabled = !enabled;
        },
        setAriaLabel() {
        },
        select(index) {
          modelSelect.selectedIndex = index;
          host.modelSelectedIndex = index;
        }
      },
      agentContainer,
      moreButton: { element: moreButton },
      tuneButton: { element: document.createElement("button") },
      stubService: {
        isEngineConnected: () => true,
        ...engineSessionReady === void 0 ? {} : { isEngineSessionReady: () => engineSessionReady }
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending }),
        setPermissionMode: async (request) => {
          permissionCalls.push(request);
          return { ok: true };
        },
        switchAgent: async () => ({ ok: true }),
        switchModel: async (request) => {
          modelCalls.push({ sessionId: request.sessionId, modelId: request.modelId });
          return { resolvedModelId: request.modelId, provider: "", level: 0, cost: "", speed: "" };
        }
      },
      contextViewService: {
        showContextView(delegate) {
          const container = document.createElement("div");
          document.body.appendChild(container);
          const rendered = delegate.render(container);
          store.add({ dispose: () => container.remove() });
          return {
            close() {
              rendered.dispose();
              container.remove();
            }
          };
        }
      },
      commandService: {
        executeCommand(id, ...args) {
          executedCommands.push({ id, args });
          return Promise.resolve(void 0);
        }
      },
      getBoundSessionId: () => "sess-leftover"
    };
    const typedHost = host;
    assert.strictEqual(typedHost.stubService.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
    assert.strictEqual(isConversationPairingHold(typedHost.uaConnection), pairingPending);
    if (engineSessionReady !== void 0) {
      assert.strictEqual(typedHost.stubService.isEngineSessionReady(), engineSessionReady);
    }
    return {
      host: typedHost,
      executedCommands,
      permissionCalls,
      modelCalls,
      permissionSelect,
      modelSelect,
      agentSelect,
      setPairingPending(pending) {
        pairingPending = pending;
      },
      dispose: () => {
        host.tuneContextView?.close();
        host.moreContextView?.close();
        store.dispose();
      }
    };
  }
  test("leftover-looks-live pairing-hold session selects stay disabled and do not write", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost();
    try {
      assert.strictEqual(isSessionPermissionModeAvailable(fixture.host), false);
      assert.strictEqual(isSessionSwitchModelAvailable(fixture.host), false);
      updateComposerSessionSelectsEnabled(fixture.host);
      assert.strictEqual(fixture.permissionSelect.disabled, true);
      assert.strictEqual(fixture.permissionSelect.getAttribute("aria-disabled"), "true");
      assert.strictEqual(fixture.modelSelect.disabled, true);
      assert.strictEqual(fixture.modelSelect.getAttribute("aria-disabled"), "true");
      await applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await applySessionModelIndex(fixture.host, "sess-leftover", 1);
      assert.deepStrictEqual(fixture.permissionCalls, []);
      assert.deepStrictEqual(fixture.modelCalls, []);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.modelSelectedIndex, 0);
      fixture.permissionSelect.disabled = false;
      fixture.permissionSelect.removeAttribute("disabled");
      fixture.permissionSelect.setAttribute("aria-disabled", "false");
      fixture.modelSelect.disabled = false;
      fixture.modelSelect.removeAttribute("disabled");
      fixture.modelSelect.setAttribute("aria-disabled", "false");
      fixture.permissionSelect.selectedIndex = 2;
      fixture.modelSelect.selectedIndex = 1;
      await applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await applySessionModelIndex(fixture.host, "sess-leftover", 1);
      assert.deepStrictEqual(fixture.permissionCalls, []);
      assert.deepStrictEqual(fixture.modelCalls, []);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.modelSelectedIndex, 0);
    } finally {
      fixture.dispose();
    }
  });
  test("leftover-looks-live pairing-hold More radios stay disabled and forced click does not write", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost();
    try {
      toggleMoreContextView(fixture.host);
      const agentNote = document.querySelector(".conversation-lens-dock-more-agent");
      assert.ok(agentNote);
      assert.strictEqual(agentNote.getAttribute("role"), "note");
      assert.strictEqual(agentNote.textContent, "No agent");
      const radios = [...document.querySelectorAll('.conversation-lens-dock-more-permission [role="menuitemradio"]')];
      assert.strictEqual(radios.length, 3);
      for (const radio of radios) {
        assert.strictEqual(radio.disabled, true);
        assert.strictEqual(radio.getAttribute("aria-disabled"), "true");
      }
      const permit = radios[2];
      permit.disabled = false;
      permit.removeAttribute("disabled");
      permit.setAttribute("aria-disabled", "false");
      permit.click();
      await Promise.resolve();
      assert.deepStrictEqual(fixture.permissionCalls, []);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
    } finally {
      fixture.dispose();
    }
  });
  test("More popup closes on Escape", () => {
    const fixture = leftoverLooksLiveSessionSelectsHost();
    try {
      toggleMoreContextView(fixture.host);
      assert.ok(document.querySelector(".conversation-lens-dock-more-popup"));
      document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 27, bubbles: true, cancelable: true }));
      assert.strictEqual(document.querySelector(".conversation-lens-dock-more-popup"), null);
    } finally {
      fixture.dispose();
    }
  });
  test("Tune popup closes on Escape", () => {
    const fixture = leftoverLooksLiveSessionSelectsHost();
    try {
      toggleTuneContextView(fixture.host);
      assert.ok(document.querySelector(".conversation-lens-dock-tune-popup"));
      document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 27, bubbles: true, cancelable: true }));
      assert.strictEqual(document.querySelector(".conversation-lens-dock-tune-popup"), null);
    } finally {
      fixture.dispose();
    }
  });
  test("does not leak unhandled rejection when More permission click applySessionPermissionIndex catch-path notice throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      const uaConnection = fixture.host.uaConnection;
      uaConnection.setPermissionMode = async () => {
        throw new Error("setPermissionMode boom");
      };
      Object.defineProperty(fixture.host.gateLabel, "textContent", {
        configurable: true,
        get() {
          return "";
        },
        set() {
          throw paintBoom;
        }
      });
      toggleMoreContextView(fixture.host);
      const radios = [...document.querySelectorAll('.conversation-lens-dock-more-permission [role="menuitemradio"]')];
      assert.strictEqual(radios.length, 3);
      assert.strictEqual(radios[2].disabled, false);
      await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
        radios[2].click();
      });
    } finally {
      fixture.dispose();
    }
  });
  test("composer chrome applySession fire-and-forget voids double-catch onUnexpectedError", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts`);
    const doubleCatch = ".catch(onUnexpectedError).catch(onUnexpectedError)";
    const applySessionVoids = source.match(/void applySession\w+\([^;]+;/g) ?? [];
    assert.deepStrictEqual(applySessionVoids, [
      `void applySessionPermissionIndex(host, sessionId, index)${doubleCatch};`
    ]);
    assert.ok(!source.includes("void applySessionPermissionIndex(host, sessionId, index);"));
  });
  test("in-flight leftover-looks-live permission and model apply keep the accepted value and stay read-only", async () => {
    const store = new DisposableStore();
    const permissionCalls = [];
    const modelCalls = [];
    const dockRoot = document.createElement("div");
    document.body.appendChild(dockRoot);
    store.add({ dispose: () => dockRoot.remove() });
    const permissionSelect = document.createElement("select");
    permissionSelect.add(new Option("Ask", "0"));
    permissionSelect.add(new Option("Agent", "1"));
    permissionSelect.add(new Option("Permit", "2"));
    const permissionContainer = document.createElement("div");
    permissionContainer.className = "conversation-lens-dock-permission";
    permissionContainer.appendChild(permissionSelect);
    dockRoot.appendChild(permissionContainer);
    const modelSelect = document.createElement("select");
    modelSelect.add(new Option("No model", ""));
    modelSelect.add(new Option("gpt-test", "gpt-test"));
    const modelContainer = document.createElement("div");
    modelContainer.className = "conversation-lens-dock-model";
    modelContainer.appendChild(modelSelect);
    dockRoot.appendChild(modelContainer);
    const gateRow = document.createElement("div");
    gateRow.hidden = true;
    const gateLabel = document.createElement("span");
    gateRow.appendChild(gateLabel);
    dockRoot.appendChild(gateRow);
    const sessionConfigBySessionId = /* @__PURE__ */ new Map([
      ["sess-leftover", { agentIndex: 0, permissionIndex: 0 }]
    ]);
    let pairingPending = false;
    let releasePermission;
    let permissionStarted;
    const permissionEntered = new Promise((resolve) => {
      permissionStarted = resolve;
    });
    const permissionHold = new Promise((resolve) => {
      releasePermission = resolve;
    });
    let releaseModel;
    let modelStarted;
    const modelEntered = new Promise((resolve) => {
      modelStarted = resolve;
    });
    const modelHold = new Promise((resolve) => {
      releaseModel = resolve;
    });
    const host = {
      catalogToolNames: ["bash"],
      catalogModelIds: ["", "gpt-test"],
      modelSelectedIndex: 0,
      sessionConfigBySessionId,
      lastReadingWidth: 300,
      tuneContextView: void 0,
      moreContextView: void 0,
      dockRoot,
      sendButton: { enabled: true },
      gateRow,
      gateLabel,
      composerPolicy: "compose",
      dockTextarea: { value: "" },
      permissionSelectBox: {
        setEnabled(enabled) {
          permissionSelect.disabled = !enabled;
        },
        setAriaLabel() {
        },
        select(index) {
          permissionSelect.selectedIndex = index;
        }
      },
      agentSelectBox: {
        setEnabled() {
        },
        setAriaLabel() {
        },
        select() {
        }
      },
      modelSelectBox: {
        setEnabled(enabled) {
          modelSelect.disabled = !enabled;
        },
        setAriaLabel() {
        },
        select(index) {
          modelSelect.selectedIndex = index;
          host.modelSelectedIndex = index;
        }
      },
      agentContainer: document.createElement("div"),
      moreButton: { element: document.createElement("button") },
      tuneButton: { element: document.createElement("button") },
      stubService: {
        isEngineConnected: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending }),
        setPermissionMode: async (request) => {
          permissionCalls.push(request);
          permissionStarted?.();
          return permissionHold;
        },
        switchModel: async (request) => {
          modelCalls.push({ sessionId: request.sessionId, modelId: request.modelId });
          modelStarted?.();
          return modelHold;
        }
      },
      getBoundSessionId: () => "sess-leftover"
    };
    const typedHost = host;
    try {
      assert.strictEqual(typedHost.stubService.isEngineConnected(), true);
      assert.strictEqual(isConversationPairingHold(typedHost.uaConnection), false);
      assert.strictEqual(isSessionPermissionModeAvailable(typedHost), true);
      assert.strictEqual(isSessionSwitchModelAvailable(typedHost), true);
      const permissionApply = applySessionPermissionIndex(typedHost, "sess-leftover", 2);
      const modelApply = applySessionModelIndex(typedHost, "sess-leftover", 1);
      await permissionEntered;
      await modelEntered;
      assert.strictEqual(permissionCalls.length, 1);
      assert.strictEqual(modelCalls.length, 1);
      assert.strictEqual(permissionSelect.selectedIndex, 2);
      assert.strictEqual(modelSelect.selectedIndex, 1);
      assert.strictEqual(typedHost.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 2);
      assert.strictEqual(typedHost.modelSelectedIndex, 1);
      pairingPending = true;
      assert.strictEqual(typedHost.stubService.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
      assert.strictEqual(isConversationPairingHold(typedHost.uaConnection), true);
      releasePermission({ ok: true });
      releaseModel({ resolvedModelId: "gpt-test", provider: "", level: 0, cost: "", speed: "" });
      await permissionApply;
      await modelApply;
      assert.strictEqual(typedHost.stubService.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
      assert.strictEqual(isConversationPairingHold(typedHost.uaConnection), true);
      assert.strictEqual(permissionSelect.selectedIndex, 2);
      assert.strictEqual(modelSelect.selectedIndex, 1);
      assert.strictEqual(typedHost.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 2);
      assert.strictEqual(typedHost.modelSelectedIndex, 1);
      assert.strictEqual(typedHost.modelProfileIdBySessionId?.get("sess-leftover"), "gpt-test");
      updateComposerSessionSelectsEnabled(typedHost);
      updateGateRow(typedHost);
      assert.strictEqual(permissionSelect.disabled, true);
      assert.strictEqual(modelSelect.disabled, true);
      assert.strictEqual(typedHost.gateRow.hidden, false);
      assert.strictEqual(typedHost.gateLabel.textContent, conversationLensDockEngineNotConnected);
      pairingPending = false;
      updateComposerSessionSelectsEnabled(typedHost);
      updateGateRow(typedHost);
      assert.strictEqual(permissionSelect.disabled, false);
      assert.strictEqual(modelSelect.disabled, false);
      assert.strictEqual(permissionSelect.selectedIndex, 2);
      assert.strictEqual(modelSelect.selectedIndex, 1);
      assert.strictEqual(typedHost.gateRow.hidden, true);
    } finally {
      store.dispose();
    }
  });
  test("leftover permission keeps the accepted value and does not show an unsent newer target", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let releasePermit;
      let permitStarted;
      const permitEntered = new Promise((resolve) => {
        permitStarted = resolve;
      });
      const permitHold = new Promise((resolve) => {
        releasePermit = resolve;
      });
      const uaConnection = fixture.host.uaConnection;
      uaConnection.setPermissionMode = async (request) => {
        fixture.permissionCalls.push(request);
        permitStarted?.();
        return permitHold;
      };
      const permit = applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await permitEntered;
      const ask = applySessionPermissionIndex(fixture.host, "sess-leftover", 0);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      fixture.setPairingPending(true);
      releasePermit({ ok: true });
      await permit;
      await ask;
      assert.deepStrictEqual(fixture.permissionCalls.map((call) => call.mode), ["SESSION_TOOL_PERMISSION_MODE_PERMIT"]);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 2);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 2);
      updateComposerSessionSelectsEnabled(fixture.host);
      assert.strictEqual(fixture.permissionSelect.disabled, true);
    } finally {
      fixture.dispose();
    }
  });
  test("leftover permission failure rolls back and does not paint a failure notice", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let releasePermit;
      let permitStarted;
      const permitEntered = new Promise((resolve) => {
        permitStarted = resolve;
      });
      const permitHold = new Promise((resolve) => {
        releasePermit = resolve;
      });
      const uaConnection = fixture.host.uaConnection;
      uaConnection.setPermissionMode = async (request) => {
        fixture.permissionCalls.push(request);
        permitStarted?.();
        return permitHold;
      };
      const apply = applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await permitEntered;
      fixture.setPairingPending(true);
      releasePermit({ ok: false, message: "engine rejected permit" });
      await apply;
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.postFailureVisible, false);
      assert.strictEqual(fixture.host.gateLabel.textContent, "");
    } finally {
      fixture.dispose();
    }
  });
  test("leftover model keeps the accepted value and does not show an unsent newer target", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      catalogModelIds: ["", "gpt-a", "gpt-b"],
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let releaseFirst;
      let firstStarted;
      const firstEntered = new Promise((resolve) => {
        firstStarted = resolve;
      });
      const firstHold = new Promise((resolve) => {
        releaseFirst = resolve;
      });
      const uaConnection = fixture.host.uaConnection;
      uaConnection.switchModel = async (request) => {
        fixture.modelCalls.push({ sessionId: request.sessionId, modelId: request.modelId });
        firstStarted?.();
        return firstHold;
      };
      const first = applySessionModelIndex(fixture.host, "sess-leftover", 1);
      await firstEntered;
      const second = applySessionModelIndex(fixture.host, "sess-leftover", 2);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 2);
      fixture.setPairingPending(true);
      releaseFirst({ resolvedModelId: "gpt-a", provider: "", level: 0, cost: "", speed: "" });
      await first;
      await second;
      assert.deepStrictEqual(fixture.modelCalls.map((call) => call.modelId), ["gpt-a"]);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 1);
      assert.strictEqual(fixture.host.modelSelectedIndex, 1);
      assert.strictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-leftover"), "gpt-a");
      updateComposerSessionSelectsEnabled(fixture.host);
      assert.strictEqual(fixture.modelSelect.disabled, true);
    } finally {
      fixture.dispose();
    }
  });
  test("leftover model with an empty resolved id rolls back and does not paint a failure notice", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let releaseModel;
      let modelStarted;
      const modelEntered = new Promise((resolve) => {
        modelStarted = resolve;
      });
      const modelHold = new Promise((resolve) => {
        releaseModel = resolve;
      });
      const uaConnection = fixture.host.uaConnection;
      uaConnection.switchModel = async (request) => {
        fixture.modelCalls.push({ sessionId: request.sessionId, modelId: request.modelId });
        modelStarted?.();
        return modelHold;
      };
      const apply = applySessionModelIndex(fixture.host, "sess-leftover", 1);
      await modelEntered;
      fixture.setPairingPending(true);
      releaseModel({ resolvedModelId: "", provider: "", level: 0, cost: "", speed: "" });
      await apply;
      assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.modelSelectedIndex, 0);
      assert.strictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-leftover"), void 0);
      assert.strictEqual(fixture.host.postFailureVisible, false);
      assert.strictEqual(fixture.host.gateLabel.textContent, "");
    } finally {
      fixture.dispose();
    }
  });
  test("leftover stale model with an empty resolved id restores the last accepted model", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      catalogModelIds: ["", "gpt-a", "gpt-b"],
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let releaseFirst;
      let firstStarted;
      const firstEntered = new Promise((resolve) => {
        firstStarted = resolve;
      });
      const firstHold = new Promise((resolve) => {
        releaseFirst = resolve;
      });
      const uaConnection = fixture.host.uaConnection;
      uaConnection.switchModel = async (request) => {
        fixture.modelCalls.push({ sessionId: request.sessionId, modelId: request.modelId });
        firstStarted?.();
        return firstHold;
      };
      const first = applySessionModelIndex(fixture.host, "sess-leftover", 1);
      await firstEntered;
      const second = applySessionModelIndex(fixture.host, "sess-leftover", 2);
      fixture.setPairingPending(true);
      releaseFirst({ resolvedModelId: "", provider: "", level: 0, cost: "", speed: "" });
      await first;
      await second;
      assert.deepStrictEqual(fixture.modelCalls.map((call) => call.modelId), ["gpt-a"]);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.modelSelectedIndex, 0);
      assert.strictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-leftover"), void 0);
      assert.strictEqual(fixture.host.postFailureVisible, false);
    } finally {
      fixture.dispose();
    }
  });
  test("leftover stale permission throw restores the last accepted value and not the unsent target", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let rejectPermit;
      let permitStarted;
      const permitEntered = new Promise((resolve) => {
        permitStarted = resolve;
      });
      const permitHold = new Promise((_resolve, reject) => {
        rejectPermit = reject;
      });
      const uaConnection = fixture.host.uaConnection;
      uaConnection.setPermissionMode = async (request) => {
        fixture.permissionCalls.push(request);
        permitStarted?.();
        return permitHold;
      };
      const permit = applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await permitEntered;
      const agent = applySessionPermissionIndex(fixture.host, "sess-leftover", 1);
      fixture.setPairingPending(true);
      rejectPermit(new Error("permit failed"));
      await permit;
      await agent;
      assert.deepStrictEqual(fixture.permissionCalls.map((call) => call.mode), ["SESSION_TOOL_PERMISSION_MODE_PERMIT"]);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.postFailureVisible, false);
    } finally {
      fixture.dispose();
    }
  });
  test("leftover stale model throw restores the last accepted model and not the unsent target", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      catalogModelIds: ["", "gpt-a", "gpt-b"],
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let rejectFirst;
      let firstStarted;
      const firstEntered = new Promise((resolve) => {
        firstStarted = resolve;
      });
      const firstHold = new Promise((_resolve, reject) => {
        rejectFirst = reject;
      });
      const uaConnection = fixture.host.uaConnection;
      uaConnection.switchModel = async (request) => {
        fixture.modelCalls.push({ sessionId: request.sessionId, modelId: request.modelId });
        firstStarted?.();
        return firstHold;
      };
      const first = applySessionModelIndex(fixture.host, "sess-leftover", 1);
      await firstEntered;
      const second = applySessionModelIndex(fixture.host, "sess-leftover", 2);
      fixture.setPairingPending(true);
      rejectFirst(new Error("gpt-a failed"));
      await first;
      await second;
      assert.deepStrictEqual(fixture.modelCalls.map((call) => call.modelId), ["gpt-a"]);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.modelSelectedIndex, 0);
      assert.strictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-leftover"), void 0);
      assert.strictEqual(fixture.host.postFailureVisible, false);
    } finally {
      fixture.dispose();
    }
  });
  test("KEEP leftover list-fail session selects stay disabled and do not write", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: false
    });
    try {
      assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
      assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), false);
      assert.strictEqual(isSessionPermissionModeAvailable(fixture.host), false);
      assert.strictEqual(isSessionSwitchAgentAvailable(fixture.host), false);
      assert.strictEqual(isSessionSwitchModelAvailable(fixture.host), false);
      updateComposerSessionSelectsEnabled(fixture.host);
      updateSendEnabled(fixture.host);
      updateGateRow(fixture.host);
      assert.strictEqual(fixture.host.sendButton.enabled, false);
      assert.strictEqual(fixture.host.gateRow.hidden, false, "KEEP leftover gate must not hide as live");
      assert.strictEqual(fixture.host.gateLabel.textContent, `${conversationLensDockSessionUnavailable} \u2014 ${conversationLensDockSessionUnavailableReason}`);
      assert.strictEqual(fixture.permissionSelect.disabled, true);
      assert.strictEqual(fixture.permissionSelect.getAttribute("aria-disabled"), "true");
      assert.strictEqual(fixture.agentSelect.disabled, true);
      assert.strictEqual(fixture.agentSelect.getAttribute("aria-disabled"), "true");
      assert.strictEqual(fixture.modelSelect.disabled, true);
      assert.strictEqual(fixture.modelSelect.getAttribute("aria-disabled"), "true");
      await applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await applySessionModelIndex(fixture.host, "sess-leftover", 1);
      assert.deepStrictEqual(fixture.permissionCalls, []);
      assert.deepStrictEqual(fixture.modelCalls, []);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.modelSelectedIndex, 0);
      fixture.permissionSelect.disabled = false;
      fixture.permissionSelect.removeAttribute("disabled");
      fixture.permissionSelect.setAttribute("aria-disabled", "false");
      fixture.agentSelect.disabled = false;
      fixture.agentSelect.removeAttribute("disabled");
      fixture.agentSelect.setAttribute("aria-disabled", "false");
      fixture.modelSelect.disabled = false;
      fixture.modelSelect.removeAttribute("disabled");
      fixture.modelSelect.setAttribute("aria-disabled", "false");
      fixture.permissionSelect.selectedIndex = 2;
      fixture.modelSelect.selectedIndex = 1;
      await applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await applySessionModelIndex(fixture.host, "sess-leftover", 1);
      assert.deepStrictEqual(fixture.permissionCalls, []);
      assert.deepStrictEqual(fixture.modelCalls, []);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.modelSelectedIndex, 0);
    } finally {
      fixture.dispose();
    }
  });
  test("connected live session selects still write when engine session is ready", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      assert.strictEqual(isConversationPairingHold(fixture.host.uaConnection), false);
      assert.strictEqual(fixture.host.stubService.isEngineSessionReady(), true);
      assert.strictEqual(isSessionPermissionModeAvailable(fixture.host), true);
      assert.strictEqual(isSessionSwitchAgentAvailable(fixture.host), true);
      assert.strictEqual(isSessionSwitchModelAvailable(fixture.host), true);
      updateComposerSessionSelectsEnabled(fixture.host);
      updateSendEnabled(fixture.host);
      updateGateRow(fixture.host);
      assert.strictEqual(fixture.host.sendButton.enabled, true);
      assert.strictEqual(fixture.host.gateRow.hidden, true);
      assert.strictEqual(fixture.permissionSelect.disabled, false);
      assert.strictEqual(fixture.agentSelect.disabled, false);
      assert.strictEqual(fixture.modelSelect.disabled, false);
      await applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await applySessionModelIndex(fixture.host, "sess-leftover", 1);
      assert.deepStrictEqual(fixture.permissionCalls, [{ sessionId: "sess-leftover", mode: "SESSION_TOOL_PERMISSION_MODE_PERMIT" }]);
      assert.deepStrictEqual(fixture.modelCalls, [{ sessionId: "sess-leftover", modelId: "gpt-test" }]);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 2);
      assert.strictEqual(fixture.modelSelect.selectedIndex, 1);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 2);
      assert.strictEqual(fixture.host.modelSelectedIndex, 1);
    } finally {
      fixture.dispose();
    }
  });
  test("applySessionModelIndex failure after rebind restores only the originating session cell", async () => {
    const store = new DisposableStore();
    const catalogModelIds = ["", "gpt-a", "gpt-b", "gpt-c"];
    const modelProfileIdBySessionId = /* @__PURE__ */ new Map([
      ["sess-a", "gpt-a"],
      ["sess-b", "gpt-b"]
    ]);
    let boundSessionId = "sess-a";
    let releaseModel;
    let modelStarted;
    const modelEntered = new Promise((resolve) => {
      modelStarted = resolve;
    });
    const modelSelect = document.createElement("select");
    modelSelect.add(new Option("No model", ""));
    modelSelect.add(new Option("gpt-a", "gpt-a"));
    modelSelect.add(new Option("gpt-b", "gpt-b"));
    modelSelect.add(new Option("gpt-c", "gpt-c"));
    const gateRow = document.createElement("div");
    gateRow.hidden = true;
    const gateLabel = document.createElement("span");
    const host = {
      catalogModelIds,
      modelSelectedIndex: 1,
      modelProfileIdBySessionId,
      sessionConfigBySessionId: /* @__PURE__ */ new Map(),
      postFailureVisible: false,
      gateRow,
      gateLabel,
      sendButton: { enabled: true },
      composerPolicy: "compose",
      dockTextarea: { value: "" },
      permissionSelectBox: { select() {
      } },
      agentSelectBox: { select() {
      } },
      modelSelectBox: {
        select(index) {
          modelSelect.selectedIndex = index;
          host.modelSelectedIndex = index;
        }
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false }),
        switchModel: () => new Promise((_resolve, reject) => {
          modelStarted?.();
          releaseModel = reject;
        })
      },
      getBoundSessionId: () => boundSessionId,
      updateSendEnabled() {
      }
    };
    const typedHost = host;
    try {
      const modelApply = applySessionModelIndex(typedHost, "sess-a", 3);
      await modelEntered;
      assert.strictEqual(typedHost.modelSelectedIndex, 3);
      boundSessionId = "sess-b";
      typedHost.modelSelectedIndex = 2;
      modelSelect.selectedIndex = 2;
      releaseModel(new Error("engine rejected model"));
      await modelApply;
      assert.strictEqual(boundSessionId, "sess-b");
      assert.strictEqual(modelSelect.selectedIndex, 2);
      assert.strictEqual(typedHost.modelSelectedIndex, 2);
      assert.strictEqual(modelProfileIdBySessionId.get("sess-a"), "gpt-a");
      assert.strictEqual(modelProfileIdBySessionId.get("sess-b"), "gpt-b");
      assert.strictEqual(typedHost.postFailureVisible, false);
      assert.strictEqual(gateRow.hidden, true);
      syncSessionConfigSelects(typedHost, "sess-b");
      assert.strictEqual(typedHost.modelSelectedIndex, 2);
      assert.strictEqual(modelSelect.selectedIndex, 2);
      assert.strictEqual(typedHost.catalogModelIds[typedHost.modelSelectedIndex] ?? "", "gpt-b");
      assert.strictEqual(modelProfileIdBySessionId.get("sess-a"), "gpt-a");
    } finally {
      store.dispose();
    }
  });
  function overlappingModelHost() {
    const catalogModelIds = ["", "gpt-a", "gpt-b"];
    const modelProfileIdBySessionId = /* @__PURE__ */ new Map();
    const modelCalls = [];
    const posted = [];
    const modelSelect = document.createElement("select");
    modelSelect.add(new Option("No model", ""));
    modelSelect.add(new Option("gpt-a", "gpt-a"));
    modelSelect.add(new Option("gpt-b", "gpt-b"));
    const gateRow = document.createElement("div");
    gateRow.hidden = true;
    const gateLabel = document.createElement("span");
    let respond;
    const host = {
      catalogModelIds,
      modelSelectedIndex: 0,
      modelProfileIdBySessionId,
      sessionConfigBySessionId: /* @__PURE__ */ new Map(),
      postFailureVisible: false,
      submitInFlight: false,
      composerPolicy: "compose",
      drafts: /* @__PURE__ */ new Map(),
      dockTextarea: { value: "hello" },
      sendButton: { enabled: true },
      gateRow,
      gateLabel,
      configurationService: { getValue: () => false },
      permissionSelectBox: { select() {
      } },
      agentSelectBox: { select() {
      } },
      modelSelectBox: {
        select(index) {
          modelSelect.selectedIndex = index;
          host.modelSelectedIndex = index;
        }
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false }),
        switchModel: (request) => {
          modelCalls.push({ sessionId: request.sessionId, modelId: request.modelId });
          if (!respond) {
            throw new Error("switchModel responder was not armed");
          }
          return respond(request.modelId, modelCalls.length);
        }
      },
      sessionViewLease: {
        post: async (msg) => {
          posted.push(msg);
          return { accepted: true, correlation: { id: "c1" } };
        }
      },
      getBoundSessionId: () => "sess-model",
      resetInputHistoryBrowse() {
      },
      updateSendEnabled() {
      },
      updateConversationPhase() {
      },
      showPostFailure() {
      }
    };
    return {
      host,
      modelSelect,
      modelCalls,
      posted,
      arm(responder) {
        respond = responder;
      }
    };
  }
  test("overlapping switchModel failure does not restore the dropdown to the earlier index", async () => {
    const fixture = overlappingModelHost();
    let releaseFirst;
    let firstStarted;
    const firstEntered = new Promise((resolve) => {
      firstStarted = resolve;
    });
    const firstHold = new Promise((_resolve, reject) => {
      releaseFirst = reject;
    });
    let releaseSecond;
    let secondStarted;
    const secondEntered = new Promise((resolve) => {
      secondStarted = resolve;
    });
    const secondHold = new Promise((resolve) => {
      releaseSecond = resolve;
    });
    fixture.arm((modelId, call) => {
      if (call === 1) {
        firstStarted?.();
        return firstHold;
      }
      secondStarted?.();
      assert.strictEqual(modelId, "gpt-b");
      return secondHold.then((value) => ({ ...value, provider: "", level: 0, cost: "", speed: "" }));
    });
    const first = applySessionModelIndex(fixture.host, "sess-model", 1);
    await firstEntered;
    const second = applySessionModelIndex(fixture.host, "sess-model", 2);
    assert.strictEqual(fixture.modelSelect.selectedIndex, 2);
    releaseFirst(new Error("stale model failed"));
    await secondEntered;
    assert.strictEqual(fixture.modelSelect.selectedIndex, 2);
    assert.notStrictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-model"), "gpt-a");
    releaseSecond({ resolvedModelId: "gpt-b" });
    await first;
    await second;
    assert.strictEqual(fixture.modelSelect.selectedIndex, 2);
    assert.strictEqual(fixture.host.modelSelectedIndex, 2);
    assert.strictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-model"), "gpt-b");
    assert.deepStrictEqual(fixture.modelCalls.map((call) => call.modelId), ["gpt-a", "gpt-b"]);
    await submitDraft(fixture.host);
    assert.deepStrictEqual(fixture.posted, [{
      kind: "submitInput",
      text: "hello",
      modelProfileId: "gpt-b"
    }]);
  });
  test("overlapping switchModel success does not keep the earlier modelId", async () => {
    const fixture = overlappingModelHost();
    let releaseFirst;
    let firstStarted;
    const firstEntered = new Promise((resolve) => {
      firstStarted = resolve;
    });
    const firstHold = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    fixture.arm((modelId, call) => {
      if (call === 1) {
        firstStarted?.();
        return firstHold.then((value) => ({ ...value, provider: "", level: 0, cost: "", speed: "" }));
      }
      assert.strictEqual(modelId, "gpt-b");
      return Promise.resolve({ resolvedModelId: modelId, provider: "", level: 0, cost: "", speed: "" });
    });
    const first = applySessionModelIndex(fixture.host, "sess-model", 1);
    await firstEntered;
    const second = applySessionModelIndex(fixture.host, "sess-model", 2);
    assert.strictEqual(fixture.modelSelect.selectedIndex, 2);
    releaseFirst({ resolvedModelId: "gpt-a" });
    await first;
    await second;
    assert.strictEqual(fixture.modelSelect.selectedIndex, 2);
    assert.strictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-model"), "gpt-b");
    assert.notStrictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-model"), "gpt-a");
    assert.deepStrictEqual(fixture.modelCalls.map((call) => call.modelId), ["gpt-a", "gpt-b"]);
    await submitDraft(fixture.host);
    assert.deepStrictEqual(fixture.posted, [{
      kind: "submitInput",
      text: "hello",
      modelProfileId: "gpt-b"
    }]);
  });
  test("submitDraft omits modelProfileId when the settled model index is 0", async () => {
    const fixture = overlappingModelHost();
    let releaseModel;
    let modelStarted;
    const modelEntered = new Promise((resolve) => {
      modelStarted = resolve;
    });
    const modelHold = new Promise((_resolve, reject) => {
      releaseModel = reject;
    });
    fixture.arm(() => {
      modelStarted?.();
      return modelHold;
    });
    const apply = applySessionModelIndex(fixture.host, "sess-model", 1);
    await modelEntered;
    releaseModel(new Error("model rejected"));
    await apply;
    assert.strictEqual(fixture.modelSelect.selectedIndex, 0);
    assert.strictEqual(fixture.host.modelSelectedIndex, 0);
    assert.strictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-model"), void 0);
    await submitDraft(fixture.host);
    assert.deepStrictEqual(fixture.posted, [{ kind: "submitInput", text: "hello" }]);
  });
  test("selecting the empty model does not send switchModel and a stale failure does not force index 0", async () => {
    const fixture = overlappingModelHost();
    let releaseModel;
    let modelStarted;
    const modelEntered = new Promise((resolve) => {
      modelStarted = resolve;
    });
    const modelHold = new Promise((_resolve, reject) => {
      releaseModel = reject;
    });
    fixture.arm(() => {
      modelStarted?.();
      return modelHold;
    });
    const first = applySessionModelIndex(fixture.host, "sess-model", 1);
    await modelEntered;
    const second = applySessionModelIndex(fixture.host, "sess-model", 2);
    await applySessionModelIndex(fixture.host, "sess-model", 0);
    assert.deepStrictEqual(fixture.modelCalls.map((call) => call.modelId), ["gpt-a"]);
    assert.strictEqual(fixture.modelSelect.selectedIndex, 2);
    releaseModel(new Error("stale model failed"));
    await first;
    await second;
    assert.deepStrictEqual(fixture.modelCalls.map((call) => call.modelId), ["gpt-a"]);
    assert.strictEqual(fixture.modelSelect.selectedIndex, 2);
    assert.notStrictEqual(fixture.host.modelProfileIdBySessionId?.get("sess-model"), "gpt-a");
  });
  function permissionApplyBoundSessionHost() {
    const store = new DisposableStore();
    const permissionSelect = document.createElement("select");
    permissionSelect.add(new Option("Ask", "0"));
    permissionSelect.add(new Option("Agent", "1"));
    permissionSelect.add(new Option("Permit", "2"));
    permissionSelect.selectedIndex = 0;
    const gateRow = document.createElement("div");
    gateRow.hidden = true;
    const gateLabel = document.createElement("span");
    const sessionConfigBySessionId = /* @__PURE__ */ new Map([
      ["sess-A", { agentIndex: 0, permissionIndex: 0 }],
      ["sess-B", { agentIndex: 0, permissionIndex: 1 }]
    ]);
    let boundSessionId = "sess-A";
    let pairingPending = false;
    let releasePermission;
    let permissionStarted;
    const permissionEntered = new Promise((resolve) => {
      permissionStarted = resolve;
    });
    const permissionHold = new Promise((resolve, reject) => {
      releasePermission = (outcome) => {
        if (outcome instanceof Error) {
          reject(outcome);
          return;
        }
        resolve(outcome);
      };
    });
    const host = {
      sessionConfigBySessionId,
      postFailureVisible: false,
      sendFailureTimeout: void 0,
      permissionSelectBox: {
        setEnabled() {
        },
        setAriaLabel() {
        },
        select(index) {
          permissionSelect.selectedIndex = index;
        }
      },
      gateRow,
      gateLabel,
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending }),
        setPermissionMode: async () => {
          permissionStarted?.();
          return permissionHold;
        }
      },
      getBoundSessionId: () => boundSessionId
    };
    return {
      host,
      permissionSelect,
      permissionEntered,
      setPairingPending(pending) {
        pairingPending = pending;
      },
      releasePermission,
      bindBWithSyncedSelect() {
        boundSessionId = "sess-B";
        permissionSelect.selectedIndex = sessionConfigBySessionId.get("sess-B").permissionIndex;
      },
      dispose: () => store.dispose()
    };
  }
  test("in-flight permission fail after switch to B does not roll back B select or paint B notice", async () => {
    const fixture = permissionApplyBoundSessionHost();
    try {
      const apply = applySessionPermissionIndex(fixture.host, "sess-A", 2);
      await fixture.permissionEntered;
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-A")?.permissionIndex, 2);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 2);
      fixture.bindBWithSyncedSelect();
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 1);
      fixture.releasePermission({ ok: false, message: "engine rejected permit" });
      await apply;
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-A")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-B")?.permissionIndex, 1);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 1);
      assert.strictEqual(fixture.host.gateRow.hidden, true);
      assert.strictEqual(fixture.host.gateLabel.textContent, "");
      assert.strictEqual(fixture.host.postFailureVisible, false);
    } finally {
      fixture.dispose();
    }
  });
  test("in-flight permission throw after switch to B does not roll back B select or paint B notice", async () => {
    const fixture = permissionApplyBoundSessionHost();
    try {
      const apply = applySessionPermissionIndex(fixture.host, "sess-A", 2);
      await fixture.permissionEntered;
      fixture.bindBWithSyncedSelect();
      fixture.releasePermission(new Error("setPermissionMode boom"));
      await apply;
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-A")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-B")?.permissionIndex, 1);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 1);
      assert.strictEqual(fixture.host.gateRow.hidden, true);
      assert.strictEqual(fixture.host.gateLabel.textContent, "");
      assert.strictEqual(fixture.host.postFailureVisible, false);
    } finally {
      fixture.dispose();
    }
  });
  test("in-flight leftover permission after switch to B keeps A accepted value and does not roll back B select", async () => {
    const fixture = permissionApplyBoundSessionHost();
    try {
      const apply = applySessionPermissionIndex(fixture.host, "sess-A", 2);
      await fixture.permissionEntered;
      fixture.bindBWithSyncedSelect();
      fixture.setPairingPending(true);
      fixture.releasePermission({ ok: true });
      await apply;
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-A")?.permissionIndex, 2);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-B")?.permissionIndex, 1);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 1);
      assert.strictEqual(fixture.host.gateRow.hidden, true);
      assert.strictEqual(fixture.host.gateLabel.textContent, "");
    } finally {
      fixture.dispose();
    }
  });
  test("permission apply for A while bound to B writes A config and does not select B box", async () => {
    const fixture = permissionApplyBoundSessionHost();
    try {
      fixture.bindBWithSyncedSelect();
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 1);
      const apply = applySessionPermissionIndex(fixture.host, "sess-A", 2);
      await fixture.permissionEntered;
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-A")?.permissionIndex, 2);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 1);
      fixture.releasePermission({ ok: true });
      await apply;
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-A")?.permissionIndex, 2);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-B")?.permissionIndex, 1);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 1);
      assert.strictEqual(fixture.host.gateRow.hidden, true);
    } finally {
      fixture.dispose();
    }
  });
  test("permission apply fail while still on A still rolls back select and shows gate notice", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      const uaConnection = fixture.host.uaConnection;
      uaConnection.setPermissionMode = async () => ({ ok: false, message: "engine rejected permit" });
      await applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.strictEqual(fixture.host.gateRow.hidden, false);
      assert.ok(fixture.host.gateLabel.textContent?.includes("engine rejected permit"));
      assert.strictEqual(fixture.host.postFailureVisible, true);
    } finally {
      fixture.dispose();
    }
  });
  test("overlapping setPermissionMode keeps Ask when an earlier Permit succeeds", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let releasePermit;
      let permitStarted;
      const permitEntered = new Promise((resolve) => {
        permitStarted = resolve;
      });
      const permitHold = new Promise((resolve) => {
        releasePermit = resolve;
      });
      let calls = 0;
      const uaConnection = fixture.host.uaConnection;
      uaConnection.setPermissionMode = async (request) => {
        fixture.permissionCalls.push(request);
        calls++;
        if (calls === 1) {
          permitStarted?.();
          return permitHold;
        }
        return { ok: true };
      };
      const permit = applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await permitEntered;
      const ask = applySessionPermissionIndex(fixture.host, "sess-leftover", 0);
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.permissionCalls.length, 1);
      releasePermit({ ok: true });
      await permit;
      await ask;
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.deepStrictEqual(fixture.permissionCalls.map((call) => call.mode), [
        "SESSION_TOOL_PERMISSION_MODE_PERMIT",
        "SESSION_TOOL_PERMISSION_MODE_ASK"
      ]);
    } finally {
      fixture.dispose();
    }
  });
  test("overlapping setPermissionMode failure does not restore the newer choice to the earlier previous", async () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({
      pairingPending: false,
      engineSessionReady: true
    });
    try {
      let releaseFirst;
      let firstStarted;
      const firstEntered = new Promise((resolve) => {
        firstStarted = resolve;
      });
      const firstHold = new Promise((resolve) => {
        releaseFirst = resolve;
      });
      let releaseSecond;
      let secondStarted;
      const secondEntered = new Promise((resolve) => {
        secondStarted = resolve;
      });
      const secondHold = new Promise((resolve) => {
        releaseSecond = resolve;
      });
      let calls = 0;
      const uaConnection = fixture.host.uaConnection;
      uaConnection.setPermissionMode = async (request) => {
        fixture.permissionCalls.push(request);
        calls++;
        if (calls === 1) {
          firstStarted?.();
          return firstHold;
        }
        secondStarted?.();
        return secondHold;
      };
      const permit = applySessionPermissionIndex(fixture.host, "sess-leftover", 2);
      await firstEntered;
      const agent = applySessionPermissionIndex(fixture.host, "sess-leftover", 1);
      releaseFirst({ ok: false, message: "stale permit failed" });
      await secondEntered;
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 1);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 1);
      assert.strictEqual(fixture.host.postFailureVisible, false);
      assert.strictEqual(fixture.host.gateLabel.textContent, "");
      releaseSecond({ ok: false, message: "agent failed" });
      await permit;
      await agent;
      assert.strictEqual(fixture.permissionSelect.selectedIndex, 0);
      assert.strictEqual(fixture.host.sessionConfigBySessionId.get("sess-leftover")?.permissionIndex, 0);
      assert.deepStrictEqual(fixture.permissionCalls.map((call) => call.mode), [
        "SESSION_TOOL_PERMISSION_MODE_PERMIT",
        "SESSION_TOOL_PERMISSION_MODE_AGENT"
      ]);
      assert.strictEqual(fixture.host.gateRow.hidden, false);
      assert.strictEqual(fixture.host.postFailureVisible, true);
      assert.ok(fixture.host.gateLabel.textContent?.includes("agent failed"));
    } finally {
      fixture.dispose();
    }
  });
  test("leftover-looks-live pairing-hold Tune overlay still paints leftover catalog", () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({ catalogToolNames: ["bash", "read"] });
    try {
      assert.strictEqual(fixture.host.stubService.isEngineConnected(), true);
      toggleTuneContextView(fixture.host);
      const popup = document.querySelector(".conversation-lens-dock-tune-popup");
      assert.ok(popup);
      assert.ok(popup.textContent?.includes("bash"));
      assert.ok(popup.textContent?.includes("read"));
      assert.ok(popup.querySelector(".conversation-lens-dock-tune-list"));
      assert.strictEqual(popup.querySelector(".conversation-lens-dock-tune-filter"), null);
      assert.ok(!popup.textContent?.includes(conversationLensDockNoTools));
      assert.ok(!popup.textContent?.includes(conversationLensDockNoEngineTools));
    } finally {
      fixture.dispose();
    }
  });
  test("Tune overlay dismisses on an outside click delivered as a StandardMouseEvent", () => {
    const fixture = leftoverLooksLiveSessionSelectsHost({ catalogToolNames: ["bash", "read"] });
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    try {
      const mutableHost = fixture.host;
      const original = mutableHost.contextViewService;
      let delegate;
      mutableHost.contextViewService = {
        showContextView(d) {
          delegate = d;
          return original.showContextView(d);
        }
      };
      toggleTuneContextView(fixture.host);
      assert.ok(document.querySelector(".conversation-lens-dock-tune-popup"));
      assert.ok(delegate?.onDOMEvent);
      outside.addEventListener("click", (e) => delegate.onDOMEvent(new StandardMouseEvent(mainWindow, e)));
      outside.click();
      assert.strictEqual(document.querySelector(".conversation-lens-dock-tune-popup"), null);
    } finally {
      outside.remove();
      fixture.dispose();
    }
  });
  test("Tune overlay scrolls a long catalog and Engine tools opens the Tools section", () => {
    const names = [...Array.from({ length: 12 }, (_, index) => `tool_${index}`), "file_delete"];
    const fixture = leftoverLooksLiveSessionSelectsHost({ catalogToolNames: names });
    try {
      toggleTuneContextView(fixture.host);
      const popup = document.querySelector(".conversation-lens-dock-tune-popup");
      assert.ok(popup);
      const list = popup.querySelector(".conversation-lens-dock-tune-list");
      const note = popup.querySelector(".conversation-lens-dock-tune-note");
      assert.ok(list);
      assert.ok(note);
      assert.ok(note.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING);
      assert.strictEqual(popup.querySelectorAll(".conversation-lens-dock-tune-tool").length, names.length);
      const filter = popup.querySelector(".conversation-lens-dock-tune-filter");
      assert.ok(filter);
      filter.value = "file_del";
      filter.dispatchEvent(new filter.ownerDocument.defaultView.Event("input", { bubbles: true }));
      const visible = [...popup.querySelectorAll(".conversation-lens-dock-tune-tool")].filter((row) => !row.hidden);
      assert.deepStrictEqual(visible.map((row) => row.textContent), ["file_delete"]);
      const open = popup.querySelector(".conversation-lens-dock-tune-open");
      open.click();
      assert.deepStrictEqual(fixture.executedCommands, [{
        id: OPEN_ENGINE_PREFERENCES_COMMAND_ID,
        args: [ENGINE_TOOLS_ZONE]
      }]);
      assert.strictEqual(document.querySelector(".conversation-lens-dock-tune-popup"), null);
    } finally {
      fixture.dispose();
    }
  });
  test("cancelToolCall pairing-hold leftover does not write and shows engine_disconnected", () => {
    const failures = [];
    const { host, posted } = pairingHoldLeftoverWriteHost(failures);
    let cancelCalls = 0;
    host.stubService.cancelToolCall = () => {
      cancelCalls++;
      return true;
    };
    cancelToolCall(host, { id: "e-run", toolCallId: "tc-1", agentId: "sub:a" });
    assert.strictEqual(cancelCalls, 0);
    assert.strictEqual(posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("submitDraft postBound reject shows failed and does not leave an unhandled rejection", async () => {
    const failures = [];
    const rejections = [];
    const onUnhandled = (reason) => {
      rejections.push(reason);
    };
    const host = {
      composerPolicy: "compose",
      submitInFlight: false,
      modelSelectedIndex: 0,
      dockTextarea: { value: "hello" },
      getBoundSessionId: () => "sess-1",
      stubService: {
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false
      },
      sessionViewLease: {
        post: async () => {
          throw new Error("postBound boom");
        }
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      void submitDraft(host);
      await new Promise((resolve) => queueMicrotask(() => resolve()));
      await new Promise((resolve) => setImmediate(() => resolve()));
      assert.deepStrictEqual(failures, ["failed"]);
      assert.deepStrictEqual(rejections, []);
      assert.strictEqual(host.submitInFlight, false);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
  test("does not leak unhandled rejection when dock send click submitDraft rejects and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const fixture = mountDockWithRejectingSubmitDraft(paintBoom);
    try {
      fixture.host.dockTextarea.value = "";
      fixture.host.sendButton.enabled = true;
      await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
        fixture.host.sendButton.element.click();
      });
    } finally {
      fixture.dispose();
    }
  });
  test("enabled send click submits once and a disabled send click does not", async () => {
    let calls = 0;
    const fixture = mountDockWithSubmit(async () => {
      calls++;
    });
    try {
      fixture.host.dockTextarea.value = "hello";
      fixture.host.sendButton.enabled = true;
      fixture.host.sendButton.element.click();
      assert.strictEqual(calls, 1, "one press on Send must not submit twice");
      calls = 0;
      fixture.host.sendButton.enabled = false;
      fixture.host.sendButton.element.click();
      assert.strictEqual(calls, 0, "a disabled Send must not submit");
    } finally {
      fixture.dispose();
    }
  });
  test("saving a turn edit from Send does not also post the restored compose draft", async () => {
    const posted = [];
    const updates = [];
    const fixture = mountDockWithSubmit(async () => {
    });
    const host = fixture.host;
    host.composerPolicy = "turnEdit";
    host.editingTurnId = "t1";
    host.composeDraftSnapshot = "still drafting";
    host.modelSelectedIndex = 0;
    host.catalogModelIds = [""];
    host.submitInFlight = false;
    host.stubService = {
      isEngineConnected: () => true,
      isEngineSessionReady: () => true,
      hasEngineConnectionHistory: () => false,
      getTurns: () => [{ id: "t1", kind: "user", text: "original", turnId: "t1" }],
      updateUserTurnText: (_sessionId, _turnId, text) => {
        updates.push(text);
        return true;
      }
    };
    host.uaConnection = {
      getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
      getConnectionSnapshot: () => ({ pairingPending: false })
    };
    host.sessionViewLease = {
      post: async (msg) => {
        posted.push(msg.kind === "submitInput" ? msg.text : "");
        return { accepted: true, correlation: { id: "posted" } };
      }
    };
    host.exitComposerEdit = () => {
      host.composerPolicy = "compose";
      host.editingTurnId = void 0;
      host.dockTextarea.value = host.composeDraftSnapshot;
    };
    host.resetInputHistoryBrowse = () => {
    };
    host.readComposerDraft = () => host.composeDraftSnapshot;
    host.showPostFailure = () => {
    };
    host.submitDraft = () => submitDraft(host);
    try {
      host.dockTextarea.value = "edited";
      host.sendButton.enabled = true;
      host.sendButton.element.click();
      await Promise.resolve();
      await Promise.resolve();
      assert.deepStrictEqual(updates, ["edited"]);
      assert.deepStrictEqual(posted, []);
      assert.strictEqual(host.dockTextarea.value, "still drafting");
    } finally {
      fixture.dispose();
    }
  });
  test("send wrapper click submits once only when Send is enabled", async () => {
    let calls = 0;
    const fixture = mountDockWithSubmit(async () => {
      calls++;
    });
    try {
      const host = fixture.host;
      host.dockTextarea.value = "hello";
      const sendContainer = host.sendButton.element.parentElement;
      assert.ok(sendContainer);
      host.sendButton.enabled = false;
      sendContainer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      assert.strictEqual(calls, 0, "a disabled Send wrapper must not submit");
      host.sendButton.enabled = true;
      sendContainer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      assert.strictEqual(calls, 1, "one click on the send wrapper must not submit twice");
      calls = 0;
      host.maximizeInputButton.element.click();
      host.tuneButton.element.click();
      host.moreButton.element.click();
      host.composerExitButton.element.click();
      host.dockTextarea.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const bottomBar = host.dockRoot.querySelector(".conversation-lens-dock-bottom-bar");
      assert.ok(bottomBar);
      bottomBar.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      const model = host.dockRoot.querySelector(".conversation-lens-dock-model");
      assert.ok(model);
      model.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      assert.strictEqual(calls, 0, "other dock bar clicks must not submit");
    } finally {
      fixture.dispose();
    }
  });
  test("saving a turn edit from the send wrapper does not post the restored draft", async () => {
    const posted = [];
    const updates = [];
    const fixture = mountDockWithSubmit(async () => {
    });
    const host = fixture.host;
    host.modelSelectedIndex = 0;
    host.catalogModelIds = [""];
    host.submitInFlight = false;
    host.stubService = {
      isEngineConnected: () => true,
      isEngineSessionReady: () => true,
      hasEngineConnectionHistory: () => false,
      getTurns: () => [{ id: "t1", kind: "user", text: "original", turnId: "t1" }],
      updateUserTurnText: (_sessionId, _turnId, text) => {
        updates.push(text);
        return true;
      }
    };
    host.uaConnection = {
      getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
      getConnectionSnapshot: () => ({ pairingPending: false })
    };
    host.sessionViewLease = {
      post: async (msg) => {
        posted.push(msg.kind === "submitInput" ? msg.text : "");
        return { accepted: true, correlation: { id: "posted" } };
      }
    };
    host.exitComposerEdit = () => {
      host.composerPolicy = "compose";
      host.editingTurnId = void 0;
      host.dockTextarea.value = host.composeDraftSnapshot;
    };
    host.resetInputHistoryBrowse = () => {
    };
    host.readComposerDraft = () => host.composeDraftSnapshot;
    host.showPostFailure = () => {
    };
    host.submitDraft = () => submitDraft(host);
    const sendContainer = host.sendButton.element.parentElement;
    assert.ok(sendContainer);
    const armTurnEdit = () => {
      host.composerPolicy = "turnEdit";
      host.editingTurnId = "t1";
      host.composeDraftSnapshot = "still drafting";
      host.dockTextarea.value = "edited";
    };
    try {
      armTurnEdit();
      host.sendButton.enabled = true;
      sendContainer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      assert.deepStrictEqual(updates, ["edited"]);
      assert.deepStrictEqual(posted, []);
      assert.strictEqual(host.dockTextarea.value, "still drafting");
      updates.length = 0;
      posted.length = 0;
      armTurnEdit();
      host.sendButton.enabled = false;
      sendContainer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      assert.deepStrictEqual(updates, []);
      assert.deepStrictEqual(posted, []);
      assert.strictEqual(host.composerPolicy, "turnEdit");
      assert.strictEqual(host.dockTextarea.value, "edited");
    } finally {
      fixture.dispose();
    }
  });
  test("does not leak unhandled rejection when dock capture click submitDraft rejects and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const fixture = mountDockWithRejectingSubmitDraft(paintBoom);
    try {
      fixture.host.dockTextarea.value = "hello";
      fixture.host.sendButton.enabled = true;
      const sendContainer = fixture.host.sendButton.element.parentElement;
      assert.ok(sendContainer);
      await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
        sendContainer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    } finally {
      fixture.dispose();
    }
  });
  test("does not leak unhandled rejection when dock Enter submitDraft rejects and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const fixture = mountDockWithRejectingSubmitDraft(paintBoom);
    try {
      await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
        fixture.host.dockTextarea.dispatchEvent(new KeyboardEvent("keydown", {
          keyCode: 13,
          bubbles: true,
          cancelable: true
        }));
      });
    } finally {
      fixture.dispose();
    }
  });
  test("dock submitDraft fire-and-forget voids double-catch onUnexpectedError", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationLensDock.ts`);
    const doubleCatch = ".catch(onUnexpectedError).catch(onUnexpectedError)";
    const submitDraftVoid = `void host.submitDraft()${doubleCatch}`;
    assert.strictEqual(source.split(submitDraftVoid).length - 1, 3);
    assert.ok(!source.includes("void host.submitDraft();"));
    assert.ok(!source.includes("() => void host.submitDraft())"));
  });
  test("does not leak unhandled rejection when dock permission select applySessionPermissionIndex catch-path throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const fixture = mountDockWithRejectingSessionSelectApply(paintBoom);
    try {
      await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
        fixture.firePermissionSelect(2);
      });
    } finally {
      fixture.dispose();
    }
  });
  test("does not leak unhandled rejection when dock model select applySessionModelIndex catch-path throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const fixture = mountDockWithRejectingSessionSelectApply(paintBoom);
    try {
      await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
        fixture.fireModelSelect(1);
      });
    } finally {
      fixture.dispose();
    }
  });
  test("dock applySession fire-and-forget voids double-catch onUnexpectedError", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationLensDock.ts`);
    const doubleCatch = ".catch(onUnexpectedError).catch(onUnexpectedError)";
    assert.ok(source.includes(`void applySessionPermissionIndex(host, host.getBoundSessionId(), e.index)${doubleCatch}`));
    assert.ok(source.includes(`void applySessionModelIndex(host, host.getBoundSessionId(), e.index)${doubleCatch}`));
    assert.ok(!source.includes("void applySessionPermissionIndex(host, host.getBoundSessionId(), e.index);"));
    assert.ok(!source.includes("void applySessionModelIndex(host, host.getBoundSessionId(), e.index);"));
  });
  test("saveTurnEdit roster false after disconnect stays in edit and shows engine_disconnected", () => {
    const failures = [];
    let exited = 0;
    const host = {
      composerPolicy: "turnEdit",
      editingTurnId: "turn-1",
      dockTextarea: { value: "revised later" },
      getBoundSessionId: () => "sess-1",
      stubService: {
        updateUserTurnText: () => false,
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => true,
        getTurns: () => []
      },
      exitComposerEdit: () => {
        exited++;
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    saveTurnEdit(host);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
    assert.strictEqual(exited, 0);
    assert.strictEqual(host.editingTurnId, "turn-1");
    assert.strictEqual(host.composerPolicy, "turnEdit");
    assert.strictEqual(host.dockTextarea.value, "revised later");
  });
  test("saveTurnEdit roster false without connection history stays in edit and shows failed", () => {
    const failures = [];
    let exited = 0;
    const host = {
      composerPolicy: "turnEdit",
      editingTurnId: "turn-1",
      dockTextarea: { value: "revised later" },
      getBoundSessionId: () => "sess-1",
      stubService: {
        updateUserTurnText: () => false,
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false,
        getTurns: () => []
      },
      exitComposerEdit: () => {
        exited++;
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    saveTurnEdit(host);
    assert.deepStrictEqual(failures, ["failed"]);
    assert.strictEqual(exited, 0);
    assert.strictEqual(host.editingTurnId, "turn-1");
    assert.strictEqual(host.composerPolicy, "turnEdit");
  });
  test("saveTurnEdit roster true exits edit and does not show post failure", () => {
    const failures = [];
    let exited = 0;
    const host = {
      composerPolicy: "turnEdit",
      editingTurnId: "turn-1",
      dockTextarea: { value: "revised later" },
      getBoundSessionId: () => "sess-1",
      stubService: {
        updateUserTurnText: () => true,
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false,
        getTurns: () => []
      },
      exitComposerEdit: () => {
        exited++;
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    saveTurnEdit(host);
    assert.deepStrictEqual(failures, []);
    assert.strictEqual(exited, 1);
  });
  function saveTurnEditWriteHost(options) {
    const written = [];
    const host = {
      composerPolicy: "turnEdit",
      editingTurnId: options.editingTurnId,
      dockTextarea: { value: "revised later" },
      getBoundSessionId: () => "sess-1",
      stubService: {
        getTurns: () => options.turns,
        updateUserTurnText: (sessionId, turnId, text) => {
          written.push({ sessionId, turnId, text });
          return true;
        },
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        hasEngineConnectionHistory: () => true
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false })
      },
      exitComposerEdit: () => {
      },
      showPostFailure: () => {
      }
    };
    return { host, written };
  }
  test("saveTurnEdit with display id e1 and turnId t1 writes t1", () => {
    const { host, written } = saveTurnEditWriteHost({
      editingTurnId: "e1",
      turns: [{ id: "e1", kind: "user", text: "hello", turnId: "t1" }]
    });
    saveTurnEdit(host);
    assert.strictEqual(host.editingTurnId, "e1");
    assert.deepStrictEqual(written, [{ sessionId: "sess-1", turnId: "t1", text: "revised later" }]);
  });
  test("saveTurnEdit without turnId writes display id", () => {
    const { host, written } = saveTurnEditWriteHost({
      editingTurnId: "e1",
      turns: [{ id: "e1", kind: "user", text: "hello" }]
    });
    saveTurnEdit(host);
    assert.strictEqual(host.editingTurnId, "e1");
    assert.deepStrictEqual(written, [{ sessionId: "sess-1", turnId: "e1", text: "revised later" }]);
  });
  test("saveTurnEdit blank turnId and missing row still write display id", () => {
    const blank = saveTurnEditWriteHost({
      editingTurnId: "e1",
      turns: [{ id: "e1", kind: "user", text: "hello", turnId: "   " }]
    });
    saveTurnEdit(blank.host);
    assert.deepStrictEqual(blank.written, [{ sessionId: "sess-1", turnId: "e1", text: "revised later" }]);
    const missing = saveTurnEditWriteHost({
      editingTurnId: "e1",
      turns: []
    });
    saveTurnEdit(missing.host);
    assert.deepStrictEqual(missing.written, [{ sessionId: "sess-1", turnId: "e1", text: "revised later" }]);
  });
  test("beginTurnEdit highlight stays on display id when L1 turnId differs", () => {
    const highlighted = [];
    const composer = document.createElement("div");
    const composerCluster = document.createElement("div");
    const composerEditHeader = document.createElement("div");
    const composerEditTitle = document.createElement("div");
    const editHost = document.createElement("div");
    const dockRoot = document.createElement("div");
    const prefirstHero = document.createElement("div");
    composerCluster.appendChild(composer);
    const dockTextarea = document.createElement("textarea");
    dockTextarea.value = "draft";
    const chromeHost = {
      composerPolicy: "compose",
      editingTurnId: void 0,
      editingQueueItemId: void 0,
      composeDraftSnapshot: "",
      dockTextarea,
      sendButton: { enabled: true, setTitle() {
      }, setAriaLabel() {
      } },
      composer,
      composerCluster,
      composerEditHeader,
      composerEditTitle,
      dockRoot,
      prefirstHero,
      isPreFirst: () => false,
      getBoundSessionId: () => "sess-1",
      inboxOverlay: { closeListPanel() {
      } },
      timelineTree: {
        setEditingTurnId: (id) => {
          highlighted.push(id);
        },
        getTurnEditHost: () => editHost
      },
      stubService: {
        isEngineConnected: () => true,
        isEngineSessionReady: () => true,
        getTurns: () => [{ id: "e1", kind: "user", text: "hello", turnId: "t1" }]
      },
      uaConnection: {
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ pairingPending: false })
      }
    };
    beginTurnEdit(chromeHost, "e1");
    assert.strictEqual(chromeHost.editingTurnId, "e1");
    assert.deepStrictEqual(highlighted, ["e1"]);
    assert.strictEqual(chromeHost.composerPolicy, "turnEdit");
  });
  test("saveQueueEdit roster false after disconnect stays in edit and shows engine_disconnected", () => {
    const failures = [];
    let exited = 0;
    let released = 0;
    let renderedInbox = 0;
    const host = {
      composerPolicy: "queueEdit",
      editingQueueItemId: "q1",
      dockTextarea: { value: "revised later" },
      getBoundSessionId: () => "sess-1",
      getEditingQueueItem: () => ({ id: "q1", content: "queued" }),
      stubService: {
        updateMessageQueueItemContent: () => false,
        releaseMessageQueueItemHold: () => {
          released++;
        },
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => true
      },
      exitComposerEdit: () => {
        exited++;
      },
      renderInboxStatus: () => {
        renderedInbox++;
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    saveQueueEdit(host);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
    assert.strictEqual(exited, 0);
    assert.strictEqual(released, 0);
    assert.strictEqual(renderedInbox, 0);
    assert.strictEqual(host.editingQueueItemId, "q1");
    assert.strictEqual(host.composerPolicy, "queueEdit");
    assert.strictEqual(host.dockTextarea.value, "revised later");
  });
  test("saveQueueEdit roster false without connection history stays in edit and shows failed", () => {
    const failures = [];
    let exited = 0;
    let released = 0;
    const host = {
      composerPolicy: "queueEdit",
      editingQueueItemId: "q1",
      dockTextarea: { value: "revised later" },
      getBoundSessionId: () => "sess-1",
      getEditingQueueItem: () => ({ id: "q1", content: "queued" }),
      stubService: {
        updateMessageQueueItemContent: () => false,
        releaseMessageQueueItemHold: () => {
          released++;
        },
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false
      },
      exitComposerEdit: () => {
        exited++;
      },
      renderInboxStatus: () => {
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    saveQueueEdit(host);
    assert.deepStrictEqual(failures, ["failed"]);
    assert.strictEqual(exited, 0);
    assert.strictEqual(released, 0);
    assert.strictEqual(host.editingQueueItemId, "q1");
    assert.strictEqual(host.composerPolicy, "queueEdit");
  });
  test("saveQueueEdit roster true exits edit and does not show post failure", () => {
    const failures = [];
    let exited = 0;
    let released = 0;
    let renderedInbox = 0;
    const host = {
      composerPolicy: "queueEdit",
      editingQueueItemId: "q1",
      dockTextarea: { value: "revised later" },
      getBoundSessionId: () => "sess-1",
      getEditingQueueItem: () => ({ id: "q1", content: "queued" }),
      stubService: {
        updateMessageQueueItemContent: () => true,
        releaseMessageQueueItemHold: () => {
          released++;
        },
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false
      },
      exitComposerEdit: () => {
        exited++;
      },
      renderInboxStatus: () => {
        renderedInbox++;
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    saveQueueEdit(host);
    assert.deepStrictEqual(failures, []);
    assert.strictEqual(exited, 1);
    assert.strictEqual(released, 1);
    assert.strictEqual(renderedInbox, 1);
  });
  test("copyTurn writeText reject shows failed and does not leave an unhandled rejection", async () => {
    const failures = [];
    const rejections = [];
    const onUnhandled = (reason) => {
      rejections.push(reason);
    };
    const host = {
      clipboardService: {
        writeText: async () => {
          throw new Error("writeText boom");
        }
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      copyTurn(host, "copied");
      await new Promise((resolve) => queueMicrotask(() => resolve()));
      await new Promise((resolve) => setImmediate(() => resolve()));
      assert.deepStrictEqual(failures, ["failed"]);
      assert.deepStrictEqual(rejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
  test("copyTurn writeText reject still shows failed and does not leak when showPostFailure throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const failures = [];
    const host = {
      clipboardService: {
        writeText: async () => {
          throw new Error("writeText boom");
        }
      },
      showPostFailure: (reason) => {
        failures.push(reason);
        throw paintBoom;
      }
    };
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => copyTurn(host, "copied"));
    assert.deepStrictEqual(failures, ["failed"]);
  });
  test("copyTurn writeText resolve stays silent", async () => {
    const failures = [];
    const written = [];
    const host = {
      clipboardService: {
        writeText: async (text) => {
          written.push(text);
        }
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    copyTurn(host, "copied");
    await new Promise((resolve) => queueMicrotask(() => resolve()));
    await new Promise((resolve) => setImmediate(() => resolve()));
    assert.deepStrictEqual(written, ["copied"]);
    assert.deepStrictEqual(failures, []);
  });
  test("deleteTurn roster false after disconnect shows engine_disconnected", () => {
    const failures = [];
    let deleteCalls = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        deleteTurn: () => {
          deleteCalls++;
          return false;
        },
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => true
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    deleteTurn(host, "turn-1");
    assert.strictEqual(deleteCalls, 1);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("deleteTurn roster false without connection history shows failed", () => {
    const failures = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        deleteTurn: () => false,
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    deleteTurn(host, "turn-1");
    assert.deepStrictEqual(failures, ["failed"]);
  });
  test("deleteTurn roster true stays silent", () => {
    const failures = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        deleteTurn: () => true,
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    deleteTurn(host, "turn-1");
    assert.deepStrictEqual(failures, []);
  });
  test("cancelToolCall roster false after disconnect shows engine_disconnected", () => {
    const failures = [];
    let cancelCalls = 0;
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        cancelToolCall: () => {
          cancelCalls++;
          return false;
        },
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => true
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    cancelToolCall(host, { id: "e-run", toolCallId: "tc-1", agentId: "sub:a" });
    assert.strictEqual(cancelCalls, 1);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("cancelToolCall roster false without connection history shows failed", () => {
    const failures = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        cancelToolCall: () => false,
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    cancelToolCall(host, { id: "e-run", toolCallId: "tc-1" });
    assert.deepStrictEqual(failures, ["failed"]);
  });
  test("cancelToolCall roster true stays silent", () => {
    const failures = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        cancelToolCall: () => true,
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    cancelToolCall(host, { id: "e-run", toolCallId: "tc-1" });
    assert.deepStrictEqual(failures, []);
  });
  test("respondClientTool pairing-hold leftover does not write and shows engine_disconnected", () => {
    const failures = [];
    const { host, posted } = pairingHoldLeftoverWriteHost(failures);
    let respondCalls = 0;
    host.stubService.respondClientTool = () => {
      respondCalls++;
      return true;
    };
    respondClientTool(host, { id: "call-1" });
    assert.strictEqual(respondCalls, 0);
    assert.strictEqual(posted, 0);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
  });
  test("KEEP leftover list-fail respondClientTool skips unary and shows session_not_ready", () => {
    const failures = [];
    const fixture = leftoverLooksLiveConfirmQuestionHost(failures, false, false);
    let respondCalls = 0;
    fixture.host.stubService.respondClientTool = () => {
      respondCalls++;
      return true;
    };
    respondClientTool(fixture.host, { id: "call-1" });
    assert.strictEqual(respondCalls, 0);
    assert.strictEqual(fixture.posted, 0);
    assert.deepStrictEqual(failures, ["session_not_ready"]);
  });
  function clientToolDisconnectHost(connectedAtEntry) {
    const failures = [];
    const calls = [];
    const state = { posted: 0, focused: 0 };
    const service = suiteStore.add(new class extends ConversationStubService {
      hasEngineConnectionHistory() {
        return true;
      }
      respondClientTool(sessionId, callId, options) {
        calls.push({ sessionId, callId, options });
        this.setEngineConnected(false);
        return false;
      }
    }());
    service.setEngineConnected(connectedAtEntry);
    service.createTestFrameSourceCallback().model.upsertCachedSession({
      id: "sess-1",
      title: "Cached response",
      source: "engine-cache",
      turns: [
        { id: "call-1", kind: "tool", text: "Pending client response", toolName: "client-response", toolStatus: "pending", respondable: true },
        { id: "permission-1", kind: "confirmation", text: "Pending permission", status: "pending" }
      ]
    });
    const lease = suiteStore.add(service.acquireSessionView("sess-1"));
    const host = {
      isDisposed: false,
      getBoundSessionId: () => "sess-1",
      stubService: service,
      uaConnection: createConversationConnectionTestStub(),
      postBound: async () => {
        state.posted++;
        return { accepted: true, correlation: { id: "unexpected-post" } };
      },
      focusTimelineRecord: () => {
        state.focused++;
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    return { host, service, lease, state, calls, failures };
  }
  test("respondClientTool already disconnected rejects before roster and preserves cached model and pending", () => {
    const fixture = clientToolDisconnectHost(false);
    assert.strictEqual(fixture.service.isEngineConnected(), false);
    assert.strictEqual(fixture.service.getSessionSource("sess-1"), "engine-cache");
    assert.ok(fixture.lease.snapshot.pendingActions.some((action) => action.requestId === "permission-1"));
    const modelBefore = JSON.stringify(fixture.service.getTurns("sess-1"));
    const pendingBefore = JSON.stringify(fixture.lease.snapshot.pendingActions);
    respondClientTool(fixture.host, { id: "call-1" });
    assert.deepStrictEqual(fixture.calls, []);
    assert.deepStrictEqual(fixture.failures, ["engine_disconnected"]);
    assert.strictEqual(JSON.stringify(fixture.service.getTurns("sess-1")), modelBefore);
    assert.strictEqual(JSON.stringify(fixture.lease.snapshot.pendingActions), pendingBefore);
    assert.deepStrictEqual(fixture.state, { posted: 0, focused: 0 });
  });
  test("respondClientTool roster false after disconnect shows engine_disconnected", () => {
    const fixture = clientToolDisconnectHost(true);
    assert.strictEqual(fixture.service.isEngineConnected(), true, "the response must enter the live roster before its synchronous disconnect");
    const modelBefore = JSON.stringify(fixture.service.getTurns("sess-1"));
    const pendingBefore = JSON.stringify(fixture.lease.snapshot.pendingActions);
    respondClientTool(fixture.host, { id: "call-1" });
    assert.deepStrictEqual(fixture.calls, [{ sessionId: "sess-1", callId: "call-1", options: { content: "" } }]);
    assert.strictEqual(fixture.service.isEngineConnected(), false);
    assert.deepStrictEqual(fixture.failures, ["engine_disconnected"]);
    assert.strictEqual(JSON.stringify(fixture.service.getTurns("sess-1")), modelBefore);
    assert.strictEqual(JSON.stringify(fixture.lease.snapshot.pendingActions), pendingBefore);
    assert.deepStrictEqual(fixture.state, { posted: 0, focused: 0 });
  });
  test("respondClientTool roster false without connection history shows failed", () => {
    const failures = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        respondClientTool: () => false,
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => false
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    respondClientTool(host, { id: "call-1" });
    assert.deepStrictEqual(failures, ["failed"]);
  });
  test("respondClientTool roster true stays silent and sends empty content", () => {
    const failures = [];
    const calls = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        respondClientTool: (sessionId, callId, options) => {
          calls.push({ sessionId, callId, options });
          return true;
        },
        isEngineConnected: () => true,
        hasEngineConnectionHistory: () => true
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    respondClientTool(host, { id: "call-1" });
    assert.deepStrictEqual(calls, [{ sessionId: "sess-1", callId: "call-1", options: { content: "" } }]);
    assert.deepStrictEqual(failures, []);
  });
  test("showPostFailure failed uses retry copy not disconnected", () => {
    const gateRow = document.createElement("div");
    gateRow.hidden = true;
    const gateLabel = document.createElement("span");
    gateRow.appendChild(gateLabel);
    const host = {
      postFailureVisible: false,
      sendFailureTimeout: void 0,
      gateRow,
      gateLabel
    };
    showPostFailure(host, "failed");
    assert.strictEqual(host.postFailureVisible, true);
    assert.strictEqual(gateRow.hidden, false);
    assert.strictEqual(gateLabel.textContent, conversationLensPostFailed);
    assert.notStrictEqual(gateLabel.textContent, conversationLensPostFailedDisconnected);
    assert.notStrictEqual(gateLabel.textContent, conversationLensPostFailedNoSession);
    assert.notStrictEqual(gateLabel.textContent, conversationLensSessionBarTitleEmpty);
    showPostFailure(host, "empty_session_title");
    assert.strictEqual(gateLabel.textContent, conversationLensSessionBarTitleEmpty);
    assert.notStrictEqual(gateLabel.textContent, conversationLensPostFailed);
    assert.ok(!/disconnected/i.test(gateLabel.textContent ?? ""));
    if (host.sendFailureTimeout) {
      clearTimeout(host.sendFailureTimeout);
      host.sendFailureTimeout = void 0;
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi90ZXN0L2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0Rpc3Bvc2VHYXRlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVbml2ZXJzZUFnZW50U3dpdGNoTW9kZWxSZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi91bml2ZXJzZUFnZW50VHlwZXMuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGVycm9ySGFuZGxlciwgc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgc2NoZWR1bGVDb252ZXJzYXRpb25NZXJtYWlkRXh0ZW5zaW9uUmVzb2x2ZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVucy5qcyc7XG5pbXBvcnQgdHlwZSB7IENvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb25JbmZvIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25NZXJtYWlkSG9zdC5qcyc7XG5pbXBvcnQgeyBhcHBseVNlc3Npb25WaWV3VGltZWxpbmUsIHJlZnJlc2hUcmFqZWN0b3J5UmVjb3JkcywgdXBkYXRlQ29udmVyc2F0aW9uUGhhc2UsIHVwZGF0ZVN5bmNDaHJvbWUsIHR5cGUgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc1Byb2plY3Rpb24uanMnO1xuaW1wb3J0IHsgY29udmVyc2F0aW9uTGVuc1N0YWxlU25hcHNob3RDbGFzcywgZXhlY3V0ZVJlYWRpbmdDb2x1bW5Tb3VyY2VzUmV2aWV3LCBpc1JlYWRpbmdDb2x1bW5Xcml0ZXNFbmFibGVkLCByZWZyZXNoU3RhbGVTbmFwc2hvdEJhbm5lciwgcmVxdWVzdFJlYWRpbmdDb2x1bW5EZXRhaWwsIHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZSwgdHlwZSBJUmVhZGluZ0NvbHVtbkRldGFpbEhvc3QgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNSZWFkaW5nQ29sdW1uLmpzJztcbmltcG9ydCB7IFNPVVJDRVNfUkVWSUVXX1NIT1dfRk9SX1BBVEhTX0NPTU1BTkQgfSBmcm9tICcuLi8uLi8uLi9zb3VyY2VzL2NvbW1vbi9zb3VyY2VzUmV2aWV3Q29tbWFuZHMuanMnO1xuaW1wb3J0IHR5cGUgeyBDb25uZWN0aW9uUGhhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi9jb25uZWN0aW9uSHViVHlwZXMuanMnO1xuaW1wb3J0IHsgZm9ybWF0U3luY0Nocm9tZUxhYmVsLCB0eXBlIENvbnZlcnNhdGlvblRpbWVsaW5lRW50cnkgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25WaWV3LmpzJztcbmltcG9ydCB0eXBlIHsgU3luY0Nocm9tZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL3Nlc3Npb25WaWV3L2luZGV4LmpzJztcbmltcG9ydCB7IHBvc3RCb3VuZCwgc2F2ZVF1ZXVlRWRpdCwgc2F2ZVR1cm5FZGl0LCBzdWJtaXREcmFmdCwgdHlwZSBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0NvbXBvc2VyLmpzJztcbmltcG9ydCB7XG5cdGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgsXG5cdHN5bmNTZXNzaW9uQ29uZmlnU2VsZWN0cyxcblx0YXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4LFxuXHRiZWdpblF1ZXVlRWRpdCxcblx0YmVnaW5UdXJuRWRpdCxcblx0aXNTZXNzaW9uUGVybWlzc2lvbk1vZGVBdmFpbGFibGUsXG5cdGlzU2Vzc2lvblN3aXRjaEFnZW50QXZhaWxhYmxlLFxuXHRpc1Nlc3Npb25Td2l0Y2hNb2RlbEF2YWlsYWJsZSxcblx0c2hvd1Bvc3RGYWlsdXJlLFxuXHR0b2dnbGVNb3JlQ29udGV4dFZpZXcsXG5cdHRvZ2dsZVR1bmVDb250ZXh0Vmlldyxcblx0dXBkYXRlQ29tcG9zZXJTZXNzaW9uU2VsZWN0c0VuYWJsZWQsXG5cdHVwZGF0ZUdhdGVSb3csXG5cdHVwZGF0ZVNlbmRFbmFibGVkLFxuXHR0eXBlIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0LFxufSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZS5qcyc7XG5pbXBvcnQgeyBiZWdpblNlc3Npb25UaXRsZUVkaXQsIGNvbW1pdFNlc3Npb25UaXRsZUVkaXQsIGNyZWF0ZU5ld1Nlc3Npb24sIGRlbGV0ZUFjdGl2ZVNlc3Npb24sIHVwZGF0ZVNlc3Npb25CYXJXcml0ZUNocm9tZSwgdHlwZSBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJIb3N0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhci5qcyc7XG5pbXBvcnQgeyBtb3VudERvY2ssIHR5cGUgSUNvbnZlcnNhdGlvbkxlbnNEb2NrSG9zdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0RvY2suanMnO1xuaW1wb3J0IHtcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tBZ2VudExhYmVsLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja0VuZ2luZU5vdENvbm5lY3RlZCxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tTZXNzaW9uVW5hdmFpbGFibGUsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrU2Vzc2lvblVuYXZhaWxhYmxlUmVhc29uLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja05vRW5naW5lVG9vbHMsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9Ub29scyxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tQZXJtaXNzaW9uTGFiZWwsXG5cdGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkLFxuXHRjb252ZXJzYXRpb25MZW5zUG9zdEZhaWxlZERpc2Nvbm5lY3RlZCxcblx0Y29udmVyc2F0aW9uTGVuc1Bvc3RGYWlsZWROb1Nlc3Npb24sXG5cdHR5cGUgQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbixcbn0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zRG9ja1N0cmluZ3MuanMnO1xuaW1wb3J0IHsgY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJUaXRsZUVtcHR5IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhclN0cmluZ3MuanMnO1xuaW1wb3J0IHsgRU5HSU5FX1RPT0xTX1pPTkUsIE9QRU5fRU5HSU5FX1BSRUZFUkVOQ0VTX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi9jb21tb24vdWFQcmVmZXJlbmNlc1BhbmVzLmpzJztcbmltcG9ydCB7IGFwcGx5QWN0aXZlU2Vzc2lvbiwgYmluZFNlc3Npb25WaWV3LCBjYW5jZWxUb29sQ2FsbCwgY29weVR1cm4sIGRlbGV0ZVR1cm4sIHJlc29sdmVDb25maXJtYXRpb24sIHJlc29sdmVRdWVzdGlvbiwgcmVzcG9uZENsaWVudFRvb2wsIHJldHJ5RXJyb3IsIHR5cGUgSUNvbnZlcnNhdGlvbkxlbnNSZXNwb25zZUhvc3QsIHR5cGUgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3QgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZy5qcyc7XG5pbXBvcnQgeyBpc0NvbnZlcnNhdGlvbkVuZ2luZUxpdmUsIGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25TdGF0dXMuanMnO1xuaW1wb3J0IHR5cGUgeyBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2UsIElDb252ZXJzYXRpb25TZXNzaW9uVmlld0xlYXNlLCBQb3N0T3V0Y29tZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL2NvbnZlcnNhdGlvblZpZXdGcmFtZS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25TdHViU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU3R1YlNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViIH0gZnJvbSAnLi4vY29tbW9uL2NvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yi5qcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gX19yZWFkRmlsZUluVGVzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+O1xuXG5zdWl0ZSgnY29udmVyc2F0aW9uIGxlbnMgZGlzcG9zZSBnYXRlJywgKCkgPT4ge1xuXG5cdGNvbnN0IHN1aXRlU3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRhc3luYyBmdW5jdGlvbiBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb206IEVycm9yLCBydW46ICgpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBBIGxvbmUgYC5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcilgIHN0aWxsIGxlYWtzIHdoZW4gdGhlIGhhbmRsZXIgd2Fybi10aGVuLXJldGhyb3dzLlxuXHRcdGNvbnN0IHVuZXhwZWN0ZWRXYXJuczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3QgdW5oYW5kbGVkUmVqZWN0aW9uczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWRSZWplY3Rpb24gPSAocmVhc29uOiB1bmtub3duKSA9PiB1bmhhbmRsZWRSZWplY3Rpb25zLnB1c2gocmVhc29uKTtcblx0XHRwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZFJlamVjdGlvbik7XG5cdFx0Y29uc3Qgb3JpZ2luYWxFcnJvckhhbmRsZXIgPSBlcnJvckhhbmRsZXIuZ2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcigpO1xuXHRcdHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoZXJyb3IgPT4ge1xuXHRcdFx0dW5leHBlY3RlZFdhcm5zLnB1c2goZXJyb3IpO1xuXHRcdFx0aWYgKHVuZXhwZWN0ZWRXYXJucy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdHJ1bigpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoeyB1bmhhbmRsZWRSZWplY3Rpb25zLCB1bmV4cGVjdGVkV2FybnMgfSwge1xuXHRcdFx0XHR1bmhhbmRsZWRSZWplY3Rpb25zOiBbXSxcblx0XHRcdFx0dW5leHBlY3RlZFdhcm5zOiBbcGFpbnRCb29tLCBwYWludEJvb21dLFxuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIob3JpZ2luYWxFcnJvckhhbmRsZXIpO1xuXHRcdFx0cHJvY2Vzcy5vZmYoJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkUmVqZWN0aW9uKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBtb3VudERvY2tXaXRoU3VibWl0KHN1Ym1pdERyYWZ0OiAoKSA9PiBQcm9taXNlPHZvaWQ+KTogeyBob3N0OiBJQ29udmVyc2F0aW9uTGVuc0RvY2tIb3N0OyBkaXNwb3NlKCk6IHZvaWQgfSB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZG9ja0hvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRvY2tIb3N0KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBkb2NrSG9zdC5yZW1vdmUoKSB9KTtcblx0XHRjb25zdCBkdW1teVNlbGVjdEJveCA9ICgpID0+ICh7XG5cdFx0XHRyZW5kZXIoKSB7IH0sXG5cdFx0XHRvbkRpZFNlbGVjdDogRXZlbnQuTm9uZSxcblx0XHRcdHNlbGVjdCgpIHsgfSxcblx0XHRcdHNldEVuYWJsZWQoKSB7IH0sXG5cdFx0XHRzZXRBcmlhTGFiZWwoKSB7IH0sXG5cdFx0XHRkaXNwb3NlKCkgeyB9LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0aW5wdXRIaXN0b3J5QnJvd3NlOiB7IGJyb3dzZUluZGV4OiAtMSwgc2F2ZWREcmFmdDogJycgfSxcblx0XHRcdG1vZGVsU2VsZWN0ZWRJbmRleDogMCxcblx0XHRcdGNhdGFsb2dUb29sTmFtZXM6IFtdLFxuXHRcdFx0Y2F0YWxvZ01vZGVsSWRzOiBbJyddLFxuXHRcdFx0c2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkOiBuZXcgTWFwKCksXG5cdFx0XHRwb3N0RmFpbHVyZVZpc2libGU6IGZhbHNlLFxuXHRcdFx0c2VuZEZhaWx1cmVUaW1lb3V0OiB1bmRlZmluZWQsXG5cdFx0XHRsYXN0UmVhZGluZ1dpZHRoOiA4MDAsXG5cdFx0XHRpbnB1dE1heGltaXplZDogZmFsc2UsXG5cdFx0XHRjb21wb3NlRHJhZnRTbmFwc2hvdDogJycsXG5cdFx0XHRlZGl0aW5nVHVybklkOiB1bmRlZmluZWQsXG5cdFx0XHRlZGl0aW5nUXVldWVJdGVtSWQ6IHVuZGVmaW5lZCxcblx0XHRcdHR1bmVDb250ZXh0VmlldzogdW5kZWZpbmVkLFxuXHRcdFx0bW9yZUNvbnRleHRWaWV3OiB1bmRlZmluZWQsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogeyBnZXRWYWx1ZTogKCkgPT4gdW5kZWZpbmVkIH0sXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZToge1xuXHRcdFx0XHRjcmVhdGVJbnN0YW5jZTogKCkgPT4gKHsgZGlzcG9zZSgpIHsgfSB9KSxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRvbkRpZENoYW5nZUVuZ2luZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXI6IDxUIGV4dGVuZHMgeyBkaXNwb3NlKCk6IHZvaWQgfT4oZGlzcG9zYWJsZTogVCkgPT4gc3RvcmUuYWRkKGRpc3Bvc2FibGUpLFxuXHRcdFx0Y3JlYXRlQ29tcG9zZXJTZWxlY3RCb3g6ICgpID0+IGR1bW15U2VsZWN0Qm94KCksXG5cdFx0XHRnZXRTZXNzaW9uQ29uZmlnOiAoKSA9PiAoeyBhZ2VudEluZGV4OiAwLCBwZXJtaXNzaW9uSW5kZXg6IDAgfSksXG5cdFx0XHRzZXRTZXNzaW9uQ29uZmlnOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHR0b2dnbGVUdW5lQ29udGV4dFZpZXc6ICgpID0+IHsgfSxcblx0XHRcdHRvZ2dsZU1vcmVDb250ZXh0VmlldzogKCkgPT4geyB9LFxuXHRcdFx0dG9nZ2xlSW5wdXRNYXhpbWl6ZWQ6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZU1heGltaXplSW5wdXRCdXR0b246ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZVNlbmRFbmFibGVkOiAoKSA9PiB7IH0sXG5cdFx0XHRiZWdpblF1ZXVlRWRpdDogKCkgPT4geyB9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyB9LFxuXHRcdFx0bmF2aWdhdGVJbnB1dEhpc3Rvcnk6ICgpID0+IGZhbHNlLFxuXHRcdFx0ZXhpdElucHV0SGlzdG9yeUJyb3dzZTogKCkgPT4geyB9LFxuXHRcdFx0c3VibWl0RHJhZnQsXG5cdFx0XHR3cml0ZUNvbXBvc2VyRHJhZnQ6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlOiAoKSA9PiB7IH0sXG5cdFx0XHRzY3JvbGxUb0ZpcnN0UGVuZGluZ0NvbmZpcm1hdGlvbjogKCkgPT4geyB9LFxuXHRcdFx0c2V0SW5wdXRNYXhpbWl6ZWQ6ICgpID0+IHsgfSxcblx0XHRcdHJlbmRlckluYm94U3RhdHVzOiAoKSA9PiB7IH0sXG5cdFx0XHRyZWFkQ29tcG9zZXJEcmFmdDogKCkgPT4gJycsXG5cdFx0XHRpc1ByZUZpcnN0OiAoKSA9PiBmYWxzZSxcblx0XHRcdHN5bmNDb21wb3NlclBsYWNlbWVudDogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlQ29tcG9zZXJFZGl0Q2hyb21lOiAoKSA9PiB7IH0sXG5cdFx0XHRlbnN1cmVDb21wb3NlckluQ2x1c3RlcjogKCkgPT4geyB9LFxuXHRcdFx0c2xvdEhvc3RzOiB7fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNEb2NrSG9zdCAmIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdG1vdW50RG9jayhob3N0LCBkb2NrSG9zdCk7XG5cdFx0cmV0dXJuIHsgaG9zdCwgZGlzcG9zZTogKCkgPT4gc3RvcmUuZGlzcG9zZSgpIH07XG5cdH1cblxuXHRmdW5jdGlvbiBtb3VudERvY2tXaXRoUmVqZWN0aW5nU3VibWl0RHJhZnQocGFpbnRCb29tOiBFcnJvcik6IHsgaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNEb2NrSG9zdDsgZGlzcG9zZSgpOiB2b2lkIH0ge1xuXHRcdHJldHVybiBtb3VudERvY2tXaXRoU3VibWl0KGFzeW5jICgpID0+IHtcblx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHR9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIG1vdW50RG9ja1dpdGhSZWplY3RpbmdTZXNzaW9uU2VsZWN0QXBwbHkocGFpbnRCb29tOiBFcnJvcik6IHtcblx0XHRmaXJlUGVybWlzc2lvblNlbGVjdChpbmRleDogbnVtYmVyKTogdm9pZDtcblx0XHRmaXJlTW9kZWxTZWxlY3QoaW5kZXg6IG51bWJlcik6IHZvaWQ7XG5cdFx0ZGlzcG9zZSgpOiB2b2lkO1xuXHR9IHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBkb2NrSG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZG9ja0hvc3QpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IGRvY2tIb3N0LnJlbW92ZSgpIH0pO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25EaWRTZWxlY3QgPSBzdG9yZS5hZGQobmV3IEVtaXR0ZXI8eyBpbmRleDogbnVtYmVyIH0+KCkpO1xuXHRcdGNvbnN0IG1vZGVsRGlkU2VsZWN0ID0gc3RvcmUuYWRkKG5ldyBFbWl0dGVyPHsgaW5kZXg6IG51bWJlciB9PigpKTtcblx0XHRjb25zdCBkdW1teVNlbGVjdEJveCA9IChvbkRpZFNlbGVjdDogdHlwZW9mIEV2ZW50Lk5vbmUpID0+ICh7XG5cdFx0XHRyZW5kZXIoKSB7IH0sXG5cdFx0XHRvbkRpZFNlbGVjdCxcblx0XHRcdHNlbGVjdCgpIHsgfSxcblx0XHRcdHNldEVuYWJsZWQoKSB7IH0sXG5cdFx0XHRzZXRBcmlhTGFiZWwoKSB7IH0sXG5cdFx0XHRkaXNwb3NlKCkgeyB9LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0aW5wdXRIaXN0b3J5QnJvd3NlOiB7IGJyb3dzZUluZGV4OiAtMSwgc2F2ZWREcmFmdDogJycgfSxcblx0XHRcdG1vZGVsU2VsZWN0ZWRJbmRleDogMCxcblx0XHRcdGNhdGFsb2dUb29sTmFtZXM6IFtdLFxuXHRcdFx0Y2F0YWxvZ01vZGVsSWRzOiBbJycsICdncHQtdGVzdCddLFxuXHRcdFx0c2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkOiBuZXcgTWFwKFtbJ3Nlc3MtMScsIHsgYWdlbnRJbmRleDogMCwgcGVybWlzc2lvbkluZGV4OiAwIH1dXSksXG5cdFx0XHRwb3N0RmFpbHVyZVZpc2libGU6IGZhbHNlLFxuXHRcdFx0c2VuZEZhaWx1cmVUaW1lb3V0OiB1bmRlZmluZWQsXG5cdFx0XHRsYXN0UmVhZGluZ1dpZHRoOiA4MDAsXG5cdFx0XHRpbnB1dE1heGltaXplZDogZmFsc2UsXG5cdFx0XHRjb21wb3NlRHJhZnRTbmFwc2hvdDogJycsXG5cdFx0XHRlZGl0aW5nVHVybklkOiB1bmRlZmluZWQsXG5cdFx0XHRlZGl0aW5nUXVldWVJdGVtSWQ6IHVuZGVmaW5lZCxcblx0XHRcdHR1bmVDb250ZXh0VmlldzogdW5kZWZpbmVkLFxuXHRcdFx0bW9yZUNvbnRleHRWaWV3OiB1bmRlZmluZWQsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogeyBnZXRWYWx1ZTogKCkgPT4gdW5kZWZpbmVkIH0sXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZToge1xuXHRcdFx0XHRjcmVhdGVJbnN0YW5jZTogKCkgPT4gKHsgZGlzcG9zZSgpIHsgfSB9KSxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRvbkRpZENoYW5nZUVuZ2luZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3NldFBlcm1pc3Npb25Nb2RlIGJvb20nKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0c3dpdGNoTW9kZWw6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3N3aXRjaE1vZGVsIGJvb20nKTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlcjogPFQgZXh0ZW5kcyB7IGRpc3Bvc2UoKTogdm9pZCB9PihkaXNwb3NhYmxlOiBUKSA9PiBzdG9yZS5hZGQoZGlzcG9zYWJsZSksXG5cdFx0XHRjcmVhdGVDb21wb3NlclNlbGVjdEJveDogKF9vcHRpb25zOiB7IHRleHQ6IHN0cmluZyB9W10sIF9zZWxlY3RlZEluZGV4OiBudW1iZXIsIGFyaWFMYWJlbDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGlmIChhcmlhTGFiZWwgPT09IGNvbnZlcnNhdGlvbkxlbnNEb2NrUGVybWlzc2lvbkxhYmVsKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGR1bW15U2VsZWN0Qm94KHBlcm1pc3Npb25EaWRTZWxlY3QuZXZlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChhcmlhTGFiZWwgPT09IGNvbnZlcnNhdGlvbkxlbnNEb2NrQWdlbnRMYWJlbCkge1xuXHRcdFx0XHRcdHJldHVybiBkdW1teVNlbGVjdEJveChFdmVudC5Ob25lKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZHVtbXlTZWxlY3RCb3gobW9kZWxEaWRTZWxlY3QuZXZlbnQpO1xuXHRcdFx0fSxcblx0XHRcdGdldFNlc3Npb25Db25maWc6ICgpID0+ICh7IGFnZW50SW5kZXg6IDAsIHBlcm1pc3Npb25JbmRleDogMCB9KSxcblx0XHRcdHNldFNlc3Npb25Db25maWc6ICgpID0+IHsgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHRvZ2dsZVR1bmVDb250ZXh0VmlldzogKCkgPT4geyB9LFxuXHRcdFx0dG9nZ2xlTW9yZUNvbnRleHRWaWV3OiAoKSA9PiB7IH0sXG5cdFx0XHR0b2dnbGVJbnB1dE1heGltaXplZDogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlTWF4aW1pemVJbnB1dEJ1dHRvbjogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlU2VuZEVuYWJsZWQ6ICgpID0+IHsgfSxcblx0XHRcdGJlZ2luUXVldWVFZGl0OiAoKSA9PiB7IH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0OiAoKSA9PiB7IH0sXG5cdFx0XHRuYXZpZ2F0ZUlucHV0SGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRleGl0SW5wdXRIaXN0b3J5QnJvd3NlOiAoKSA9PiB7IH0sXG5cdFx0XHRzdWJtaXREcmFmdDogYXN5bmMgKCkgPT4geyB9LFxuXHRcdFx0d3JpdGVDb21wb3NlckRyYWZ0OiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVDb252ZXJzYXRpb25QaGFzZTogKCkgPT4geyB9LFxuXHRcdFx0c2Nyb2xsVG9GaXJzdFBlbmRpbmdDb25maXJtYXRpb246ICgpID0+IHsgfSxcblx0XHRcdHNldElucHV0TWF4aW1pemVkOiAoKSA9PiB7IH0sXG5cdFx0XHRyZW5kZXJJbmJveFN0YXR1czogKCkgPT4geyB9LFxuXHRcdFx0cmVhZENvbXBvc2VyRHJhZnQ6ICgpID0+ICcnLFxuXHRcdFx0aXNQcmVGaXJzdDogKCkgPT4gZmFsc2UsXG5cdFx0XHRzeW5jQ29tcG9zZXJQbGFjZW1lbnQ6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZUNvbXBvc2VyRWRpdENocm9tZTogKCkgPT4geyB9LFxuXHRcdFx0ZW5zdXJlQ29tcG9zZXJJbkNsdXN0ZXI6ICgpID0+IHsgfSxcblx0XHRcdHNsb3RIb3N0czoge30sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zRG9ja0hvc3QgJiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdDtcblx0XHRtb3VudERvY2soaG9zdCwgZG9ja0hvc3QpO1xuXHRcdGhvc3QuZ2F0ZUxhYmVsID0ge1xuXHRcdFx0c2V0IHRleHRDb250ZW50KF92YWx1ZTogc3RyaW5nKSB7XG5cdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgdGV4dENvbnRlbnQoKSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH0sXG5cdFx0fSBhcyBIVE1MRWxlbWVudDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZmlyZVBlcm1pc3Npb25TZWxlY3QoaW5kZXg6IG51bWJlcikge1xuXHRcdFx0XHRwZXJtaXNzaW9uRGlkU2VsZWN0LmZpcmUoeyBpbmRleCB9KTtcblx0XHRcdH0sXG5cdFx0XHRmaXJlTW9kZWxTZWxlY3QoaW5kZXg6IG51bWJlcikge1xuXHRcdFx0XHRtb2RlbERpZFNlbGVjdC5maXJlKHsgaW5kZXggfSk7XG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4gc3RvcmUuZGlzcG9zZSgpLFxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdhcHBseVNlc3Npb25WaWV3VGltZWxpbmUgc2tpcHMgYXBwbHlFbnRyaWVzIGFmdGVyIGRpc3Bvc2UnLCAoKSA9PiB7XG5cdFx0bGV0IGFwcGx5RW50cmllcyA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IHRydWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7IHNlc3Npb25JZDogJ3MxJyB9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7IGFwcGx5RW50cmllczogKCkgPT4geyBhcHBseUVudHJpZXMrKzsgfSB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Byb2plY3Rpb25Ib3N0O1xuXHRcdGFwcGx5U2Vzc2lvblZpZXdUaW1lbGluZShob3N0LCB7IGtpbmQ6ICdiYXNlbGluZScgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZnJlc2hUcmFqZWN0b3J5UmVjb3JkcyBza2lwcyBzZXRSZWNvcmRzIGFmdGVyIGRpc3Bvc2UnLCAoKSA9PiB7XG5cdFx0bGV0IHNldFJlY29yZHMgPSAwO1xuXHRcdGxldCByZWFkUmVjb3JkcyA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IHRydWUsXG5cdFx0XHRmaWx0ZXJBZ2VudElkOiB1bmRlZmluZWQsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB1bmRlZmluZWQsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRnZXRUcmFqZWN0b3J5UmVjb3JkczogKCkgPT4ge1xuXHRcdFx0XHRcdHJlYWRSZWNvcmRzKys7XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7IHNldFJlY29yZHM6ICgpID0+IHsgc2V0UmVjb3JkcysrOyB9IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zUHJvamVjdGlvbkhvc3Q7XG5cdFx0cmVmcmVzaFRyYWplY3RvcnlSZWNvcmRzKGhvc3QsICdzMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWFkUmVjb3JkcywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNldFJlY29yZHMsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWZyZXNoVHJhamVjdG9yeVJlY29yZHMgc3RpbGwgc2V0UmVjb3JkcyB3aGlsZSBsaXZlJywgKCkgPT4ge1xuXHRcdGxldCBzZXRSZWNvcmRzID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRmaWx0ZXJBZ2VudElkOiB1bmRlZmluZWQsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB1bmRlZmluZWQsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRnZXRUcmFqZWN0b3J5UmVjb3JkczogKCkgPT4gW10sXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0fSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7IHNldFJlY29yZHM6ICgpID0+IHsgc2V0UmVjb3JkcysrOyB9IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zUHJvamVjdGlvbkhvc3Q7XG5cdFx0cmVmcmVzaFRyYWplY3RvcnlSZWNvcmRzKGhvc3QsICdzMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXRSZWNvcmRzLCAxKTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaFRyYWplY3RvcnlSZWNvcmRzIGtlZXBzIGxlZnRvdmVyIGxlYXNlIHR1cm4gaWRzIHdoaWxlIHBhaXJpbmdQZW5kaW5nIHRoZW4gdHJ1ZSBkaXNjb25uZWN0IHVzZXMgc3R1YiBpZHMnLCAoKSA9PiB7XG5cdFx0bGV0IGNvbm5lY3RlZCA9IHRydWU7XG5cdFx0bGV0IHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0bGV0IHNldFJlY29yZHMgPSAwO1xuXHRcdGxldCBsYXN0VHVybklkczogUmVhZG9ubHlTZXQ8c3RyaW5nPiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBsZWZ0b3ZlclJlY29yZHMgPSBbeyBpZDogJ3JlYy0xJyB9XTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRmaWx0ZXJBZ2VudElkOiB1bmRlZmluZWQsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7XG5cdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3MtbGVmdG92ZXInLFxuXHRcdFx0XHRzbmFwc2hvdDoge1xuXHRcdFx0XHRcdHRpbWVsaW5lOiBbXG5cdFx0XHRcdFx0XHR7IGlkOiAndHVybi1sZWFzZS0xJywgc3VtbWFyeTogeyBraW5kOiAndXNlcicgfSB9LFxuXHRcdFx0XHRcdFx0eyBpZDogJ3R1cm4tbGVhc2UtMicsIHN1bW1hcnk6IHsga2luZDogJ2Fzc2lzdGFudCcgfSB9LFxuXHRcdFx0XHRcdF0sXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0Z2V0VHJhamVjdG9yeVJlY29yZHM6ICgpID0+IGxlZnRvdmVyUmVjb3Jkcyxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGNvbm5lY3RlZCAmJiAhcGFpcmluZ1BlbmRpbmcsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbXSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiBjb25uZWN0ZWQgPyAnY29ubmVjdGVkJyA6ICdkaXNjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0fSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7XG5cdFx0XHRcdGdldFBhaW50ZWRSZWNvcmRDb3VudDogKCkgPT4gbGVmdG92ZXJSZWNvcmRzLmxlbmd0aCxcblx0XHRcdFx0c2V0UmVjb3JkczogKF9yZWNvcmRzOiByZWFkb25seSB1bmtub3duW10sIHR1cm5JZHM/OiBSZWFkb25seVNldDxzdHJpbmc+KSA9PiB7XG5cdFx0XHRcdFx0c2V0UmVjb3JkcysrO1xuXHRcdFx0XHRcdGxhc3RUdXJuSWRzID0gdHVybklkcztcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zUHJvamVjdGlvbkhvc3Q7XG5cblx0XHRwYWlyaW5nUGVuZGluZyA9IHRydWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UoKS5raW5kLCAnY29ubmVjdGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCB0cnVlKTtcblxuXHRcdHJlZnJlc2hUcmFqZWN0b3J5UmVjb3Jkcyhob3N0LCAnc2Vzcy1sZWZ0b3ZlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXRSZWNvcmRzLCAxKTtcblx0XHRhc3NlcnQub2sobGFzdFR1cm5JZHM/LmhhcygndHVybi1sZWFzZS0xJykpO1xuXHRcdGFzc2VydC5vayhsYXN0VHVybklkcz8uaGFzKCd0dXJuLWxlYXNlLTInKSk7XG5cblx0XHRwYWlyaW5nUGVuZGluZyA9IGZhbHNlO1xuXHRcdGNvbm5lY3RlZCA9IGZhbHNlO1xuXHRcdHJlZnJlc2hUcmFqZWN0b3J5UmVjb3Jkcyhob3N0LCAnc2Vzcy1sZWZ0b3ZlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXRSZWNvcmRzLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFR1cm5JZHM/LnNpemUsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWZyZXNoVHJhamVjdG9yeVJlY29yZHMga2VlcHMgbGVmdG92ZXIgcGFpbnRlZCByZWNvcmRzIHdoZW4gcGFpcmluZ1BlbmRpbmcgaGFzIG5vIGxlYXNlJywgKCkgPT4ge1xuXHRcdGxldCBzZXRSZWNvcmRzID0gMDtcblx0XHRjb25zdCBsZWZ0b3ZlclJlY29yZHMgPSBbeyBpZDogJ3JlYy1sZWZ0b3ZlcicgfV07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0ZmlsdGVyQWdlbnRJZDogdW5kZWZpbmVkLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogdW5kZWZpbmVkLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0Z2V0VHJhamVjdG9yeVJlY29yZHM6ICgpID0+IFtdLFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbXSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSB9KSxcblx0XHRcdH0sXG5cdFx0XHR0cmFqZWN0b3J5Vmlldzoge1xuXHRcdFx0XHRnZXRQYWludGVkUmVjb3JkQ291bnQ6ICgpID0+IGxlZnRvdmVyUmVjb3Jkcy5sZW5ndGgsXG5cdFx0XHRcdHNldFJlY29yZHM6ICgpID0+IHsgc2V0UmVjb3JkcysrOyB9LFxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdDtcblx0XHRyZWZyZXNoVHJhamVjdG9yeVJlY29yZHMoaG9zdCwgJ3Nlc3MtbGVmdG92ZXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UmVjb3JkcywgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZnJlc2hUcmFqZWN0b3J5UmVjb3JkcyBmaXJzdC1wdWxsIHBhaXJpbmdQZW5kaW5nIHdpdGhvdXQgbGVmdG92ZXIgc3RpbGwgc2V0UmVjb3JkcycsICgpID0+IHtcblx0XHRsZXQgc2V0UmVjb3JkcyA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0ZmlsdGVyQWdlbnRJZDogdW5kZWZpbmVkLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogdW5kZWZpbmVkLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0Z2V0VHJhamVjdG9yeVJlY29yZHM6ICgpID0+IFtdLFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbXSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSB9KSxcblx0XHRcdH0sXG5cdFx0XHR0cmFqZWN0b3J5Vmlldzoge1xuXHRcdFx0XHRnZXRQYWludGVkUmVjb3JkQ291bnQ6ICgpID0+IDAsXG5cdFx0XHRcdHNldFJlY29yZHM6ICgpID0+IHsgc2V0UmVjb3JkcysrOyB9LFxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdDtcblx0XHRyZWZyZXNoVHJhamVjdG9yeVJlY29yZHMoaG9zdCwgJ3Nlc3MtZmlyc3QnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UmVjb3JkcywgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZSBrZWVwcyBsZWZ0b3ZlciBsZWFzZSB3aGlsZSBwYWlyaW5nUGVuZGluZyB0aGVuIHRydWUgZGlzY29ubmVjdCBoaWRlcycsICgpID0+IHtcblx0XHRsZXQgY29ubmVjdGVkID0gdHJ1ZTtcblx0XHRsZXQgcGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogbGVmdG92ZXJMZWFzZVNuYXBzaG90KHsga2luZDogJ2xpdmUnIH0pLFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICd1YS1jYWNoZScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gY29ubmVjdGVkICYmICFwYWlyaW5nUGVuZGluZyxcblx0XHRcdFx0Z2V0QWN0aXZlU2Vzc2lvbklkOiAoKSA9PiAndWEtY2FjaGUnLFxuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gW10sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogY29ubmVjdGVkID8gJ2Nvbm5lY3RlZCcgOiAnZGlzY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdH0sXG5cdFx0fTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUoYXNMaXZlQ2hyb21lSG9zdChob3N0KSksIHRydWUpO1xuXG5cdFx0cGFpcmluZ1BlbmRpbmcgPSB0cnVlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lKGFzTGl2ZUNocm9tZUhvc3QoaG9zdCkpLCB0cnVlKTtcblxuXHRcdHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0Y29ubmVjdGVkID0gZmFsc2U7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZShhc0xpdmVDaHJvbWVIb3N0KGhvc3QpKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUga2VlcHMgbGVmdG92ZXIgY2FjaGVkIHR1cm5zIHdpdGhvdXQgbGVhc2Ugd2hpbGUgcGFpcmluZ1BlbmRpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHVuZGVmaW5lZCxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAndWEtY2FjaGUnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICd1YS1jYWNoZScsXG5cdFx0XHRcdGdldFR1cm5zOiAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHNlc3Npb25JZCA9PT0gJ3VhLWNhY2hlJ1xuXHRcdFx0XHRcdD8gW3sgaWQ6ICd0LWxlZnRvdmVyJywga2luZDogJ3RoaW5raW5nJywgdGV4dDogJ2xlZnRvdmVyIHRoaW5rJywgc3RyZWFtaW5nOiB0cnVlIH1dXG5cdFx0XHRcdFx0OiBbXSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJyBhcyBjb25zdCwgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSB9KSxcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lKGFzTGl2ZUNocm9tZUhvc3QoaG9zdCkpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lIGZpcnN0LXB1bGwgcGFpcmluZ1BlbmRpbmcgd2l0aG91dCBsZWZ0b3ZlciBzdGF5cyBmYWxzZScsICgpID0+IHtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLWZpcnN0Jyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0QWN0aXZlU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy1maXJzdCcsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbXSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJyBhcyBjb25zdCwgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSB9KSxcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lKGFzTGl2ZUNocm9tZUhvc3QoaG9zdCkpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGxlZnRvdmVyTG9va3NMaXZlQ2hyb21lSG9zdChvcHRpb25zOiB7XG5cdFx0cmVhZG9ubHkgcGFpcmluZ1BlbmRpbmc6IGJvb2xlYW47XG5cdFx0cmVhZG9ubHkgbG9va3NMaXZlPzogYm9vbGVhbjtcblx0XHRyZWFkb25seSBjb25uZWN0ZWQ/OiBib29sZWFuO1xuXHRcdHJlYWRvbmx5IGhhc0xlYXNlPzogYm9vbGVhbjtcblx0XHRyZWFkb25seSB0dXJucz86IHJlYWRvbmx5IHVua25vd25bXTtcblx0fSk6IFBhcmFtZXRlcnM8dHlwZW9mIHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZT5bMF0ge1xuXHRcdGNvbnN0IGNvbm5lY3RlZCA9IG9wdGlvbnMuY29ubmVjdGVkID8/IHRydWU7XG5cdFx0Y29uc3QgcGFpcmluZ1BlbmRpbmcgPSBvcHRpb25zLnBhaXJpbmdQZW5kaW5nO1xuXHRcdGNvbnN0IGxvb2tzTGl2ZSA9IG9wdGlvbnMubG9va3NMaXZlID8/IGZhbHNlO1xuXHRcdGNvbnN0IGhhc0xlYXNlID0gb3B0aW9ucy5oYXNMZWFzZSA9PT0gdHJ1ZTtcblx0XHRjb25zdCBib3VuZFNlc3Npb25JZCA9IGhhc0xlYXNlID8gJ3VhLWNhY2hlJyA6ICdzZXNzLWZpcnN0Jztcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogaGFzTGVhc2UgPyBsZWZ0b3ZlckxlYXNlU25hcHNob3QoeyBraW5kOiAnbGl2ZScgfSkgOiB1bmRlZmluZWQsXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gYm91bmRTZXNzaW9uSWQsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gY29ubmVjdGVkICYmIChsb29rc0xpdmUgfHwgIXBhaXJpbmdQZW5kaW5nKSxcblx0XHRcdFx0Z2V0QWN0aXZlU2Vzc2lvbklkOiAoKSA9PiBib3VuZFNlc3Npb25JZCxcblx0XHRcdFx0Z2V0VHVybnM6IChzZXNzaW9uSWQ6IHN0cmluZykgPT4gc2Vzc2lvbklkID09PSBib3VuZFNlc3Npb25JZCA/IChvcHRpb25zLnR1cm5zID8/IFtdKSA6IFtdLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6IGNvbm5lY3RlZCA/ICdjb25uZWN0ZWQnIDogJ2Rpc2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmcgfSksXG5cdFx0XHR9LFxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIGZpcnN0LXB1bGwgc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lIHN0YXlzIGZhbHNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGhvc3QgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNocm9tZUhvc3QoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSwgbG9va3NMaXZlOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZShob3N0KSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIGtlZXBzIGxlZnRvdmVyIGxlYXNlIHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZScsICgpID0+IHtcblx0XHRjb25zdCBob3N0ID0gbGVmdG92ZXJMb29rc0xpdmVDaHJvbWVIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IHRydWUsIGxvb2tzTGl2ZTogdHJ1ZSwgaGFzTGVhc2U6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lKGhvc3QpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBrZWVwcyBsZWZ0b3ZlciBjYWNoZWQgdHVybnMgc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lJywgKCkgPT4ge1xuXHRcdGNvbnN0IGhvc3QgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNocm9tZUhvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IHRydWUsXG5cdFx0XHRsb29rc0xpdmU6IHRydWUsXG5cdFx0XHR0dXJuczogW3sgaWQ6ICd0LWxlZnRvdmVyJywga2luZDogJ3RoaW5raW5nJywgdGV4dDogJ2xlZnRvdmVyIHRoaW5rJywgc3RyZWFtaW5nOiB0cnVlIH1dLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUoaG9zdCksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkaW5nIGNvbHVtbiBsaXZlIGNocm9tZSBhbmQgc3RhbGUgYmFubmVyIGZvbGxvdyBib3VuZCBzZXNzaW9uIHdpdGhvdXQgbGVhc2Ugbm90IGdsb2JhbCBhY3RpdmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYm91bmRDbG9zZWQ6IFN5bmNDaHJvbWUgPSB7IGtpbmQ6ICdjbG9zZWQnLCByZWFzb246ICdCb3VuZCBsZWFmIHNuYXBzaG90JyB9O1xuXHRcdGNvbnN0IGFjdGl2ZUxpdmU6IFN5bmNDaHJvbWUgPSB7IGtpbmQ6ICdsaXZlJyB9O1xuXHRcdGNvbnN0IGJhbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGJhbm5lci5jbGFzc05hbWUgPSBjb252ZXJzYXRpb25MZW5zU3RhbGVTbmFwc2hvdENsYXNzO1xuXHRcdGJhbm5lci5oaWRkZW4gPSB0cnVlO1xuXHRcdGNvbnN0IHJlYWRpbmdDb2x1bW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRyZWFkaW5nQ29sdW1uLmFwcGVuZENoaWxkKGJhbm5lcik7XG5cdFx0Y29uc3QgZ2V0U2Vzc2lvblN5bmNDYWxsczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLUEnLFxuXHRcdFx0cmVhZGluZ0NvbHVtbixcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0QWN0aXZlU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy1CJyxcblx0XHRcdFx0Z2V0VHVybnM6IChzZXNzaW9uSWQ6IHN0cmluZykgPT4gc2Vzc2lvbklkID09PSAnc2Vzcy1BJ1xuXHRcdFx0XHRcdD8gW3sgaWQ6ICd0LWJvdW5kJywga2luZDogJ3RoaW5raW5nJywgdGV4dDogJ2JvdW5kIGxlZnRvdmVyJywgc3RyZWFtaW5nOiB0cnVlIH1dXG5cdFx0XHRcdFx0OiBbXSxcblx0XHRcdFx0Z2V0U2Vzc2lvblN5bmM6IChzZXNzaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdGdldFNlc3Npb25TeW5jQ2FsbHMucHVzaChzZXNzaW9uSWQpO1xuXHRcdFx0XHRcdHJldHVybiBzZXNzaW9uSWQgPT09ICdzZXNzLUEnID8gYm91bmRDbG9zZWQgOiBhY3RpdmVMaXZlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnIGFzIGNvbnN0LCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHR9O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUoYXNMaXZlQ2hyb21lSG9zdChob3N0KSksIHRydWUpO1xuXHRcdHJlZnJlc2hTdGFsZVNuYXBzaG90QmFubmVyKGhvc3QgYXMgdW5rbm93biBhcyBQYXJhbWV0ZXJzPHR5cGVvZiByZWZyZXNoU3RhbGVTbmFwc2hvdEJhbm5lcj5bMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0U2Vzc2lvblN5bmNDYWxscywgWydzZXNzLUEnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhbm5lci5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQub2soYmFubmVyLnRleHRDb250ZW50Py5pbmNsdWRlcygnQm91bmQgbGVhZiBzbmFwc2hvdCcpKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gbGVmdG92ZXJMb29rc0xpdmVEZXRhaWxIb3N0KG9wdGlvbnM6IHtcblx0XHRyZWFkb25seSBwYWlyaW5nUGVuZGluZzogYm9vbGVhbjtcblx0XHRyZWFkb25seSBjYWNoZWRCb2R5Pzogc3RyaW5nO1xuXHRcdHJlYWRvbmx5IGhhc0xlYXNlPzogYm9vbGVhbjtcblx0fSk6IHtcblx0XHRob3N0OiBJUmVhZGluZ0NvbHVtbkRldGFpbEhvc3QgJiB7IHJlYWRvbmx5IHN0dWJTZXJ2aWNlOiB7IGlzRW5naW5lQ29ubmVjdGVkKCk6IGJvb2xlYW4gfSB9O1xuXHRcdHJlcXVlc3REZXRhaWxDYWxsczogbnVtYmVyO1xuXHR9IHtcblx0XHRjb25zdCBzdGF0ZSA9IHsgcmVxdWVzdERldGFpbENhbGxzOiAwIH07XG5cdFx0Y29uc3QgZGV0YWlscyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0aWYgKG9wdGlvbnMuY2FjaGVkQm9keSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRkZXRhaWxzLnNldCgnZGV0YWlsOmxlZnRvdmVyJywgb3B0aW9ucy5jYWNoZWRCb2R5KTtcblx0XHR9XG5cdFx0Y29uc3QgaGFzTGVhc2UgPSBvcHRpb25zLmhhc0xlYXNlICE9PSBmYWxzZTtcblx0XHRjb25zdCBob3N0OiBJUmVhZGluZ0NvbHVtbkRldGFpbEhvc3QgJiB7IHJlYWRvbmx5IHN0dWJTZXJ2aWNlOiB7IGlzRW5naW5lQ29ubmVjdGVkKCk6IGJvb2xlYW4gfSB9ID0ge1xuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogaGFzTGVhc2Vcblx0XHRcdFx0PyB7XG5cdFx0XHRcdFx0ZGV0YWlscyxcblx0XHRcdFx0XHRyZXF1ZXN0RGV0YWlsOiBhc3luYyAoX3JlZjogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0XHRzdGF0ZS5yZXF1ZXN0RGV0YWlsQ2FsbHMrKztcblx0XHRcdFx0XHRcdHJldHVybiB7IG9rOiB0cnVlIGFzIGNvbnN0LCB0cnVuY2F0ZWQ6IGZhbHNlIGFzIGNvbnN0LCBjb250ZW50OiAnbGl2ZS1mZXRjaGVkJyB9O1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH1cblx0XHRcdFx0OiB1bmRlZmluZWQsXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKTogQ29ubmVjdGlvblBoYXNlID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBvcHRpb25zLnBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0fSxcblx0XHR9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRob3N0LFxuXHRcdFx0Z2V0IHJlcXVlc3REZXRhaWxDYWxscygpIHsgcmV0dXJuIHN0YXRlLnJlcXVlc3REZXRhaWxDYWxsczsgfSxcblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBsZWZ0b3ZlciBsZWFzZSByZXF1ZXN0RGV0YWlsIHN0YXlzIDAgdW5hcnknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlRGV0YWlsSG9zdCh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIHRydWUpO1xuXHRcdGNvbnN0IG91dGNvbWUgPSBhd2FpdCByZXF1ZXN0UmVhZGluZ0NvbHVtbkRldGFpbChmaXh0dXJlLmhvc3QsICdkZXRhaWw6bGVmdG92ZXInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG91dGNvbWUsIHsgb2s6IGZhbHNlLCByZWFzb246ICd1bmF2YWlsYWJsZScgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucmVxdWVzdERldGFpbENhbGxzLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBsZWZ0b3ZlciBsZWFzZSBzZXJ2ZXMgY2FjaGVkIGxlZnRvdmVyIGJvZHkgd2l0aG91dCByZXF1ZXN0RGV0YWlsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZURldGFpbEhvc3QoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSwgY2FjaGVkQm9keTogJ2NhY2hlZCBsZWZ0b3ZlcicgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRjb25zdCBvdXRjb21lID0gYXdhaXQgcmVxdWVzdFJlYWRpbmdDb2x1bW5EZXRhaWwoZml4dHVyZS5ob3N0LCAnZGV0YWlsOmxlZnRvdmVyJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvdXRjb21lLCB7IG9rOiB0cnVlLCB0cnVuY2F0ZWQ6IGZhbHNlLCBjb250ZW50OiAnY2FjaGVkIGxlZnRvdmVyJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5yZXF1ZXN0RGV0YWlsQ2FsbHMsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgbGVmdG92ZXIgc3RpbGwgcmVxdWVzdERldGFpbCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVEZXRhaWxIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRjb25zdCBvdXRjb21lID0gYXdhaXQgcmVxdWVzdFJlYWRpbmdDb2x1bW5EZXRhaWwoZml4dHVyZS5ob3N0LCAnZGV0YWlsOmxlZnRvdmVyJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvdXRjb21lLCB7IG9rOiB0cnVlLCB0cnVuY2F0ZWQ6IGZhbHNlLCBjb250ZW50OiAnbGl2ZS1mZXRjaGVkJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5yZXF1ZXN0RGV0YWlsQ2FsbHMsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaXJzdC1wdWxsIHBhaXJpbmcgd2l0aG91dCBsZWFzZSByZXF1ZXN0RGV0YWlsIHN0YXlzIHVuYXZhaWxhYmxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZURldGFpbEhvc3QoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSwgaGFzTGVhc2U6IGZhbHNlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0Y29uc3Qgb3V0Y29tZSA9IGF3YWl0IHJlcXVlc3RSZWFkaW5nQ29sdW1uRGV0YWlsKGZpeHR1cmUuaG9zdCwgJ2RldGFpbDpsZWZ0b3ZlcicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3V0Y29tZSwgeyBvazogZmFsc2UsIHJlYXNvbjogJ3VuYXZhaWxhYmxlJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5yZXF1ZXN0RGV0YWlsQ2FsbHMsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiByZWFkaW5nLWNvbHVtbiBzb3VyY2VzIHJldmlldyBleGVjdXRlQ29tbWFuZCByZWplY3RzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdyZXZpZXcgYm9vbScpO1xuXHRcdGNvbnN0IGNhbGxzOiB7IGlkOiBzdHJpbmc7IGFyZ3M6IHVua25vd25bXSB9W10gPSBbXTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdGV4ZWN1dGVSZWFkaW5nQ29sdW1uU291cmNlc1Jldmlldyh7XG5cdFx0XHRcdGV4ZWN1dGVDb21tYW5kOiBhc3luYyAoaWQ6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKSA9PiB7XG5cdFx0XHRcdFx0Y2FsbHMucHVzaCh7IGlkLCBhcmdzIH0pO1xuXHRcdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdFx0fSxcblx0XHRcdH0sIFsnZmlsZTovLy90bXAvcmVhZG1lLm1kJ10pO1xuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsc1swXSEuaWQsIFNPVVJDRVNfUkVWSUVXX1NIT1dfRk9SX1BBVEhTX0NPTU1BTkQpO1xuXHRcdGNvbnN0IHVyaXMgPSBjYWxsc1swXSEuYXJnc1swXSBhcyBVUklbXTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodXJpcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1cmlzWzBdIS50b1N0cmluZyh0cnVlKSwgJ2ZpbGU6Ly8vdG1wL3JlYWRtZS5tZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkaW5nIGNvbHVtbiBzb3VyY2VzIHJldmlldyBmaXJlLWFuZC1mb3JnZXQgdm9pZHMgZG91YmxlLWNhdGNoIG9uVW5leHBlY3RlZEVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zUmVhZGluZ0NvbHVtbi50c2ApO1xuXHRcdGNvbnN0IGRvdWJsZUNhdGNoID0gJy5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpJztcblx0XHRhc3NlcnQub2soc291cmNlLmluY2x1ZGVzKCdvblJldmlld05hdkNsaWNrOiBwYXRocyA9PiBleGVjdXRlUmVhZGluZ0NvbHVtblNvdXJjZXNSZXZpZXcoaG9zdC5jb21tYW5kU2VydmljZSwgcGF0aHMpJykpO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoZG91YmxlQ2F0Y2gpKTtcblx0XHRhc3NlcnQub2soIXNvdXJjZS5pbmNsdWRlcygndm9pZCBob3N0LmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCcpKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gbWVybWFpZEV4dGVuc2lvbkluZm8ocGF0aCA9ICcvdG1wL21lcm1haWQnKTogQ29udmVyc2F0aW9uTWVybWFpZEV4dGVuc2lvbkluZm8ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRleHRlbnNpb25Mb2NhdGlvbjogVVJJLmZpbGUocGF0aCksXG5cdFx0XHRleHRlbnNpb25JZDogbmV3IEV4dGVuc2lvbklkZW50aWZpZXIoJ3ZzY29kZS5tZXJtYWlkLW1hcmtkb3duLWZlYXR1cmVzJyksXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIG1lcm1haWRSZXNvbHZlSG9zdChvcHRpb25zOiB7XG5cdFx0cmVhZG9ubHkgZ2V0RXh0ZW5zaW9uOiAoKSA9PiBQcm9taXNlPHsgZXh0ZW5zaW9uTG9jYXRpb246IFVSSTsgaWRlbnRpZmllcjogRXh0ZW5zaW9uSWRlbnRpZmllciB9IHwgdW5kZWZpbmVkPjtcblx0XHRtZXJtYWlkRXh0ZW5zaW9uSW5mbz86IENvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb25JbmZvO1xuXHRcdHJlYWRvbmx5IGlzRGlzcG9zZWQ/OiBib29sZWFuO1xuXHRcdHJlYWRvbmx5IG9uU2V0TWVybWFpZD86IChpbmZvOiBDb252ZXJzYXRpb25NZXJtYWlkRXh0ZW5zaW9uSW5mbyB8IHVuZGVmaW5lZCkgPT4gdm9pZDtcblx0XHRyZWFkb25seSBvbkFwcGx5QmFzZWxpbmU/OiAoKSA9PiB2b2lkO1xuXHR9KSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGV4dGVuc2lvblNlcnZpY2U6IHtcblx0XHRcdFx0Z2V0RXh0ZW5zaW9uOiBvcHRpb25zLmdldEV4dGVuc2lvbixcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRcdGlzRGlzcG9zZWQ6IG9wdGlvbnMuaXNEaXNwb3NlZCA/PyBmYWxzZSxcblx0XHRcdG1lcm1haWRFeHRlbnNpb25JbmZvOiBvcHRpb25zLm1lcm1haWRFeHRlbnNpb25JbmZvLFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7XG5cdFx0XHRcdHNldE1lcm1haWRFeHRlbnNpb25JbmZvKGluZm86IENvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb25JbmZvIHwgdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0b3B0aW9ucy5vblNldE1lcm1haWQ/LihpbmZvKTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRhcHBseVNlc3Npb25WaWV3VGltZWxpbmUoKSB7XG5cdFx0XHRcdG9wdGlvbnMub25BcHBseUJhc2VsaW5lPy4oKTtcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIG1lcm1haWQgcmVzb2x2ZSB0aGVuLWNhbGxiYWNrIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGhvc3QgPSBtZXJtYWlkUmVzb2x2ZUhvc3Qoe1xuXHRcdFx0Z2V0RXh0ZW5zaW9uOiBhc3luYyAoKSA9PiAoe1xuXHRcdFx0XHRleHRlbnNpb25Mb2NhdGlvbjogVVJJLmZpbGUoJy90bXAvbWVybWFpZCcpLFxuXHRcdFx0XHRpZGVudGlmaWVyOiBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllcigndnNjb2RlLm1lcm1haWQtbWFya2Rvd24tZmVhdHVyZXMnKSxcblx0XHRcdH0pLFxuXHRcdFx0b25TZXRNZXJtYWlkOiAoKSA9PiB7XG5cdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiBzY2hlZHVsZUNvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb25SZXNvbHZlKGhvc3QpKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gbWVybWFpZCBnZXRFeHRlbnNpb24gcmVqZWN0cywgdGhlbi1jYWxsYmFjayB0aHJvd3MsIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgaG9zdCA9IG1lcm1haWRSZXNvbHZlSG9zdCh7XG5cdFx0XHRnZXRFeHRlbnNpb246ICgpID0+IFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignZ2V0RXh0ZW5zaW9uIGJvb20nKSksXG5cdFx0XHRtZXJtYWlkRXh0ZW5zaW9uSW5mbzogbWVybWFpZEV4dGVuc2lvbkluZm8oJy90bXAvc3RhbGUnKSxcblx0XHRcdG9uU2V0TWVybWFpZDogKCkgPT4ge1xuXHRcdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4gc2NoZWR1bGVDb252ZXJzYXRpb25NZXJtYWlkRXh0ZW5zaW9uUmVzb2x2ZShob3N0KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbnZlcnNhdGlvbiBsZW5zIG1lcm1haWQgcmVzb2x2ZSBmaXJlLWFuZC1mb3JnZXQgdm9pZHMgZG91YmxlLWNhdGNoIG9uVW5leHBlY3RlZEVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zLnRzYCk7XG5cdFx0Y29uc3QgZG91YmxlQ2F0Y2ggPSAnLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvciknO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoJ3NjaGVkdWxlQ29udmVyc2F0aW9uTWVybWFpZEV4dGVuc2lvblJlc29sdmUodGhpcyk7JykpO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoJ3ZvaWQgcmVzb2x2ZUNvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb24oaG9zdC5leHRlbnNpb25TZXJ2aWNlKS50aGVuKCcpKTtcblx0XHRhc3NlcnQub2soc291cmNlLmluY2x1ZGVzKGRvdWJsZUNhdGNoKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzb3VyY2UuaW5jbHVkZXMoJ3ZvaWQgcmVzb2x2ZUNvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb24odGhpcy5leHRlbnNpb25TZXJ2aWNlKS50aGVuKCcpKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gYXNMaXZlQ2hyb21lSG9zdChob3N0OiBvYmplY3QpOiBQYXJhbWV0ZXJzPHR5cGVvZiBzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWU+WzBdIHtcblx0XHRyZXR1cm4gaG9zdCBhcyBQYXJhbWV0ZXJzPHR5cGVvZiBzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWU+WzBdO1xuXHR9XG5cblx0ZnVuY3Rpb24gbGVmdG92ZXJMZWFzZVNuYXBzaG90KHN5bmM6IFN5bmNDaHJvbWUpIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2Vzc2lvbklkOiAndWEtY2FjaGUnLFxuXHRcdFx0c25hcHNob3Q6IHtcblx0XHRcdFx0c2Vzc2lvbklkOiAndWEtY2FjaGUnLFxuXHRcdFx0XHRzeW5jLFxuXHRcdFx0XHR0aW1lbGluZTogW10sXG5cdFx0XHRcdG92ZXJsYXk6IHsgYmxvY2tzOiBbXSB9LFxuXHRcdFx0XHRwZW5kaW5nQWN0aW9uczogW10sXG5cdFx0XHRcdGxvY2FsUGVuZGluZ1NlbmRzOiBbXSxcblx0XHRcdH0sXG5cdFx0XHRhdHRyaWJ1dGlvbjogbmV3IE1hcCgpLFxuXHRcdFx0ZGV0YWlsczogbmV3IE1hcCgpLFxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBwYWlyaW5nU3luY0Nocm9tZUhvc3Qob3B0aW9uczoge1xuXHRcdHJlYWRvbmx5IGxlZnRvdmVyOiBTeW5jQ2hyb21lO1xuXHRcdHJlYWRvbmx5IHJvc3RlclN5bmM6IFN5bmNDaHJvbWU7XG5cdFx0cmVhZG9ubHkgZ2V0U2Vzc2lvblN5bmM/OiAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IFN5bmNDaHJvbWU7XG5cdH0pOiBJQ29udmVyc2F0aW9uTGVuc1Byb2plY3Rpb25Ib3N0ICYgeyByZWFkb25seSBzZXNzaW9uU3luY0JhZGdlOiBIVE1MU3BhbkVsZW1lbnQ7IHJlYWRvbmx5IHN0YWxlQmFubmVyOiBIVE1MRGl2RWxlbWVudDsgZ2V0U2Vzc2lvblN5bmNDYWxsczogbnVtYmVyIH0ge1xuXHRcdGNvbnN0IGxlZnRvdmVyID0gb3B0aW9ucy5sZWZ0b3Zlcjtcblx0XHRjb25zdCByb3N0ZXJTeW5jID0gb3B0aW9ucy5yb3N0ZXJTeW5jO1xuXHRcdGNvbnN0IGNhbGxzID0geyBjb3VudDogMCB9O1xuXHRcdGNvbnN0IGJhZGdlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGNvbnN0IGJhbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGJhbm5lci5jbGFzc05hbWUgPSBjb252ZXJzYXRpb25MZW5zU3RhbGVTbmFwc2hvdENsYXNzO1xuXHRcdGJhbm5lci5oaWRkZW4gPSB0cnVlO1xuXHRcdGNvbnN0IHJlYWRpbmdDb2x1bW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRyZWFkaW5nQ29sdW1uLmFwcGVuZENoaWxkKGJhbm5lcik7XG5cdFx0Y29uc3QgZG9jayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IHByZWZpcnN0SGVybyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IGRvY2tSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IGlkZW50aXR5U3RyaXBFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgaW5ib3hPdmVybGF5RWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGluYm94T3ZlcmxheUVsZW1lbnQuaGlkZGVuID0gdHJ1ZTtcblx0XHRwcmVmaXJzdEhlcm8uYXBwZW5kKGlkZW50aXR5U3RyaXBFbGVtZW50LCBnYXRlUm93KTtcblx0XHRkb2NrUm9vdC5hcHBlbmRDaGlsZChpbmJveE92ZXJsYXlFbGVtZW50KTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRsZW5zSWQ6ICdjb252ZXJzYXRpb24nIGFzIGNvbnN0LFxuXHRcdFx0ZmlsdGVyQWdlbnRJZDogdW5kZWZpbmVkLFxuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdjb21wb3NlJyBhcyBjb25zdCxcblx0XHRcdGNvbnZlcnNhdGlvblBoYXNlOiAncHJlZmlyc3QnIGFzIGNvbnN0LFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogW10sXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiBsZWZ0b3ZlckxlYXNlU25hcHNob3QobGVmdG92ZXIpLFxuXHRcdFx0c2Vzc2lvblN5bmNCYWRnZTogYmFkZ2UsXG5cdFx0XHRyZWFkaW5nQ29sdW1uLFxuXHRcdFx0c3RhbGVCYW5uZXI6IGJhbm5lcixcblx0XHRcdGdldCBnZXRTZXNzaW9uU3luY0NhbGxzKCkgeyByZXR1cm4gY2FsbHMuY291bnQ7IH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRnZXRTZXNzaW9uU3luYzogKHNlc3Npb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0Y2FsbHMuY291bnQrKztcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbklkLCAndWEtY2FjaGUnKTtcblx0XHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5nZXRTZXNzaW9uU3luYz8uKHNlc3Npb25JZCkgPz8gcm9zdGVyU3luYztcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICd1YS1jYWNoZScsXG5cdFx0XHR9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICd1YS1jYWNoZScsXG5cdFx0XHRyZXZpZXdOYXZTZXJ2aWNlOiB7IGdldFJldmlld05hdkZvclNlc3Npb246ICgpID0+IFtdIH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHsgYXBwbHlFbnRyaWVzOiAoKSA9PiB7IH0gfSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7fSxcblx0XHRcdHJlbmRlckluYm94U3RhdHVzOiAoKSA9PiB7IH0sXG5cdFx0XHRzeW5jQ29tcG9zZXJQbGFjZW1lbnQ6ICgpID0+IHsgfSxcblx0XHRcdGFwcGx5Q29udmVyc2F0aW9uRGVuc2l0eTogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlU2Vzc2lvbkNvbmZpZ1Zpc2liaWxpdHk6ICgpID0+IHsgfSxcblx0XHRcdGV4aXRDb21wb3NlckVkaXQ6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZUdhdGVSb3c6ICgpID0+IHsgfSxcblx0XHRcdHJlbGF5b3V0UmVhZGluZ1N1cmZhY2VzOiAoKSA9PiB7IH0sXG5cdFx0XHRzbG90SG9zdHM6IHsgZG9jayB9LFxuXHRcdFx0cHJlZmlyc3RIZXJvLFxuXHRcdFx0ZG9ja1Jvb3QsXG5cdFx0XHRnYXRlUm93LFxuXHRcdFx0aWRlbnRpdHlTdHJpcDogeyBlbGVtZW50OiBpZGVudGl0eVN0cmlwRWxlbWVudCB9LFxuXHRcdFx0aW5ib3hPdmVybGF5OiB7IGVsZW1lbnQ6IGluYm94T3ZlcmxheUVsZW1lbnQgfSxcblx0XHR9O1xuXHRcdHJldHVybiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdCAmIHsgcmVhZG9ubHkgc2Vzc2lvblN5bmNCYWRnZTogSFRNTFNwYW5FbGVtZW50OyByZWFkb25seSBzdGFsZUJhbm5lcjogSFRNTERpdkVsZW1lbnQ7IGdldFNlc3Npb25TeW5jQ2FsbHM6IG51bWJlciB9O1xuXHR9XG5cblx0dGVzdCgnYXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lIHBhaXJpbmcgbGVmdG92ZXIgbGl2ZS9zeW5jaW5nIGxlYXNlIHBhaW50cyByb3N0ZXIgZGVtb3RlZCBzeW5jIG5vdCBTZXNzaW9uIGxpdmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGVtb3RlZDogU3luY0Nocm9tZSA9IHsga2luZDogJ2Nsb3NlZCcsIHJlYXNvbjogJ0NhY2hlZCBzbmFwc2hvdCAocmVhZC1vbmx5KScgfTtcblx0XHRmb3IgKGNvbnN0IGxlZnRvdmVyIG9mIFt7IGtpbmQ6ICdsaXZlJyBhcyBjb25zdCB9LCB7IGtpbmQ6ICdzeW5jaW5nJyBhcyBjb25zdCB9XSkge1xuXHRcdFx0Y29uc3QgaG9zdCA9IHBhaXJpbmdTeW5jQ2hyb21lSG9zdCh7IGxlZnRvdmVyLCByb3N0ZXJTeW5jOiBkZW1vdGVkIH0pO1xuXHRcdFx0YXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lKGhvc3QsIHsga2luZDogJ2Jhc2VsaW5lJyB9KTtcblx0XHRcdGFzc2VydC5vayhob3N0LmdldFNlc3Npb25TeW5jQ2FsbHMgPiAwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5nZXRTZXNzaW9uU3luYygndWEtY2FjaGUnKSwgZGVtb3RlZCk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCAnU2Vzc2lvbiBsaXZlJyk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCAnU2Vzc2lvbiBzeW5jaW5nJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCBmb3JtYXRTeW5jQ2hyb21lTGFiZWwoZGVtb3RlZCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblN5bmNCYWRnZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgZm9ybWF0U3luY0Nocm9tZUxhYmVsKGRlbW90ZWQpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGl0bGUsIGZvcm1hdFN5bmNDaHJvbWVMYWJlbChkZW1vdGVkKSk7XG5cdFx0XHQvLyBFbXB0eSBsZWFzZTogYjBiMTRiMmEzNjAgZG9lcyBub3QgY2xhaW0gYSBkaXNjb25uZWN0IHNuYXBzaG90LlxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3RhbGVCYW5uZXIuaGlkZGVuLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0YWxlQmFubmVyLnRleHRDb250ZW50LCAnJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdhcHBseVNlc3Npb25WaWV3VGltZWxpbmUgY29ubmVjdGVkIGxlZnRvdmVyIGxpdmUgc3RpbGwgcGFpbnRzIFNlc3Npb24gbGl2ZScsICgpID0+IHtcblx0XHRjb25zdCBsaXZlOiBTeW5jQ2hyb21lID0geyBraW5kOiAnbGl2ZScgfTtcblx0XHRjb25zdCBob3N0ID0gcGFpcmluZ1N5bmNDaHJvbWVIb3N0KHsgbGVmdG92ZXI6IGxpdmUsIHJvc3RlclN5bmM6IGxpdmUgfSk7XG5cdFx0YXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lKGhvc3QsIHsga2luZDogJ2Jhc2VsaW5lJyB9KTtcblx0XHRhc3NlcnQub2soaG9zdC5nZXRTZXNzaW9uU3luY0NhbGxzID4gMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblN5bmNCYWRnZS50ZXh0Q29udGVudCwgJ1Nlc3Npb24gbGl2ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGl0bGUsICdTZXNzaW9uIGxpdmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdGFsZUJhbm5lci5oaWRkZW4sIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVTeW5jQ2hyb21lIGFuZCBzdGFsZSBiYW5uZXIgaWdub3JlIGxlZnRvdmVyIGxpdmUgbGVhc2UgYW5kIGZvbGxvdyBnZXRTZXNzaW9uU3luYycsICgpID0+IHtcblx0XHRjb25zdCBkZW1vdGVkOiBTeW5jQ2hyb21lID0geyBraW5kOiAnY2xvc2VkJywgcmVhc29uOiAnQ2FjaGVkIHNuYXBzaG90IChyZWFkLW9ubHkpJyB9O1xuXHRcdGNvbnN0IGhvc3QgPSBwYWlyaW5nU3luY0Nocm9tZUhvc3QoeyBsZWZ0b3ZlcjogeyBraW5kOiAnbGl2ZScgfSwgcm9zdGVyU3luYzogZGVtb3RlZCB9KTtcblx0XHR1cGRhdGVTeW5jQ2hyb21lKGhvc3QsIHsga2luZDogJ2xpdmUnIH0pO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGV4dENvbnRlbnQsICdTZXNzaW9uIGxpdmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCBmb3JtYXRTeW5jQ2hyb21lTGFiZWwoZGVtb3RlZCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGl0bGUsIGZvcm1hdFN5bmNDaHJvbWVMYWJlbChkZW1vdGVkKSk7XG5cdFx0Ly8gTm8gcGFpbnRlZCByb3dzOiB0aGUgY2xvc2VkIHJvc3RlciBzeW5jIHN0aWxsIG11c3Qgbm90IGludmVudCBhIHNuYXBzaG90IGJhbm5lci5cblx0XHRyZWZyZXNoU3RhbGVTbmFwc2hvdEJhbm5lcihob3N0LCB7IGtpbmQ6ICdsaXZlJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdGFsZUJhbm5lci5oaWRkZW4sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0YWxlQmFubmVyLnRleHRDb250ZW50LCAnJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhaXJpbmctaG9sZCBzYW1lLXNlc3Npb24gS0VFUCBjb25uZWN0aW9uIGNoYW5nZSBwYWludHMgZ2V0U2Vzc2lvblN5bmMgY2xvc2VkIGNocm9tZSBub3QgU2Vzc2lvbiBsaXZlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRlbW90ZWQ6IFN5bmNDaHJvbWUgPSB7IGtpbmQ6ICdjbG9zZWQnLCByZWFzb246ICdDYWNoZWQgc25hcHNob3QgKHJlYWQtb25seSknIH07XG5cdFx0Y29uc3QgbGVmdG92ZXI6IENvbnZlcnNhdGlvblRpbWVsaW5lRW50cnlbXSA9IFtcblx0XHRcdHsgaWQ6ICd0MScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJycgfSxcblx0XHRcdHsgaWQ6ICd0MicsIGtpbmQ6ICd1c2VyJywgdGV4dDogJycgfSxcblx0XHRdO1xuXHRcdGNvbnN0IGxpZmV0aW1lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGhvc3QgPSBwYWlyaW5nU3luY0Nocm9tZUhvc3QoeyBsZWZ0b3ZlcjogeyBraW5kOiAnbGl2ZScgfSwgcm9zdGVyU3luYzogZGVtb3RlZCB9KTtcblx0XHRob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMgPSBsZWZ0b3Zlcjtcblx0XHRob3N0LnNlc3Npb25TeW5jQmFkZ2UudGV4dENvbnRlbnQgPSAnU2Vzc2lvbiBsaXZlJztcblx0XHRob3N0LnNlc3Npb25TeW5jQmFkZ2UudGl0bGUgPSAnU2Vzc2lvbiBsaXZlJztcblx0XHRPYmplY3QuYXNzaWduKGhvc3QsIHtcblx0XHRcdHNlc3Npb25WaWV3TGlmZXRpbWU6IGxpZmV0aW1lLFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSksXG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0Li4uaG9zdC5zdHViU2VydmljZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcigncGFpcmluZy1ob2xkIHNhbWUtc2Vzc2lvbiBLRUVQIG11c3Qgbm90IGFjcXVpcmUnKTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHtcblx0XHRcdFx0YXBwbHlFbnRyaWVzOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdwYWlyaW5nLWhvbGQgc2FtZS1zZXNzaW9uIEtFRVAgbXVzdCBub3QgYXBwbHlFbnRyaWVzJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlZnJlc2hQcmVzZW50YXRpb246ICgpID0+IHsgfSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0Y29uc3QgcHJpb3JMZWFzZSA9IGhvc3Quc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0LCAndWEtY2FjaGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCBwcmlvckxlYXNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLCBsZWZ0b3Zlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblN5bmNCYWRnZS50ZXh0Q29udGVudCwgJ1Nlc3Npb24gbGl2ZScpO1xuXHRcdHVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlKGhvc3QpO1xuXHRcdHVwZGF0ZVN5bmNDaHJvbWUoaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgcHJpb3JMZWFzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcywgbGVmdG92ZXIpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGV4dENvbnRlbnQsICdTZXNzaW9uIGxpdmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCBmb3JtYXRTeW5jQ2hyb21lTGFiZWwoZGVtb3RlZCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGl0bGUsIGZvcm1hdFN5bmNDaHJvbWVMYWJlbChkZW1vdGVkKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblN5bmNCYWRnZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgZm9ybWF0U3luY0Nocm9tZUxhYmVsKGRlbW90ZWQpKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBza2lwcyBhcHBseUVudHJpZXMgYWZ0ZXIgZGlzcG9zZScsICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdFx0bGV0IGFwcGx5RW50cmllcyA9IDA7XG5cdFx0bGV0IGFjcXVpcmUgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiB0cnVlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7IHNlc3Npb25JZDogJ3MxJyB9LFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogW10sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdGFjcXVpcmUrKztcblx0XHRcdFx0XHRyZXR1cm4geyBzZXNzaW9uSWQ6ICdzMScsIHNuYXBzaG90OiB7IHNlc3Npb25JZDogJ3MxJyB9IH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7IGFwcGx5RW50cmllczogKCkgPT4geyBhcHBseUVudHJpZXMrKzsgfSB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3F1aXJlLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IHN0aWxsIGFwcGx5RW50cmllcyBlbXB0eSB0cmVlIHdoaWxlIGxpdmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0bGV0IGFwcGx5RW50cmllcyA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7IHNlc3Npb25JZDogJ3MxJyB9LFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogW3sgaWQ6ICd0MScgfV0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7IGFwcGx5RW50cmllczogKCkgPT4geyBhcHBseUVudHJpZXMrKzsgfSB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMsIFtdKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBlbXB0eSBzZXNzaW9uSWQgc3RpbGwgY2xlYXJzIGxlZnRvdmVyIHdoaWxlIGVuZ2luZSByb3N0ZXIgaXMgaW4tZmxpZ2h0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpZmV0aW1lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGxldCBhcHBseUVudHJpZXMgPSAwO1xuXHRcdGxldCBhY3F1aXJlID0gMDtcblx0XHRsZXQgYXBwbGllZEVtcHR5ID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHsgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicgfSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IFt7IGlkOiAndDEnIH0sIHsgaWQ6ICd0MicgfV0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRhY3F1aXJlU2Vzc2lvblZpZXc6ICgpID0+IHtcblx0XHRcdFx0XHRhY3F1aXJlKys7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicsIHNuYXBzaG90OiB7IHNlc3Npb25JZDogJ3Nlc3MtbGVmdG92ZXInIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHtcblx0XHRcdFx0YXBwbHlFbnRyaWVzOiAoZW50cmllczogcmVhZG9ubHkgdW5rbm93bltdKSA9PiB7XG5cdFx0XHRcdFx0YXBwbHlFbnRyaWVzKys7XG5cdFx0XHRcdFx0aWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRhcHBsaWVkRW1wdHkrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBsaWVkRW1wdHksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3F1aXJlLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAwKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBrZWVwcyBsZWZ0b3ZlciB0aW1lbGluZSB3aGlsZSBlbmdpbmUgcm9zdGVyIGlzIGluLWZsaWdodCcsICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBwcmlvckxlYXNlID0geyBzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJyB9O1xuXHRcdGNvbnN0IGxlZnRvdmVyID0gW3sgaWQ6ICd0MScgfSwgeyBpZDogJ3QyJyB9XTtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRsZXQgYWNxdWlyZSA9IDA7XG5cdFx0Y29uc3QgbGlmZXRpbWVNYXJrZXIgPSB7XG5cdFx0XHRkaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRkaXNwb3NlKCkgeyB0aGlzLmRpc3Bvc2VkID0gdHJ1ZTsgfSxcblx0XHR9O1xuXHRcdGxpZmV0aW1lLmFkZChsaWZldGltZU1hcmtlcik7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiBwcmlvckxlYXNlLFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogbGVmdG92ZXIsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRhY3F1aXJlU2Vzc2lvblZpZXc6ICgpID0+IHtcblx0XHRcdFx0XHRhY3F1aXJlKys7XG5cdFx0XHRcdFx0cmV0dXJuIHsgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicsIHNuYXBzaG90OiB7IHNlc3Npb25JZDogJ3Nlc3MtbGVmdG92ZXInIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHsgYXBwbHlFbnRyaWVzOiAoKSA9PiB7IGFwcGx5RW50cmllcysrOyB9IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnc2Vzcy1sZWZ0b3ZlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3F1aXJlLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCBwcmlvckxlYXNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcywgbGVmdG92ZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaWZldGltZU1hcmtlci5kaXNwb3NlZCwgZmFsc2UpO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IEtFRVAgbGVmdG92ZXIgcm9zdGVyIGluLWZsaWdodCBkb2VzIG5vdCBrZWVwIG90aGVyIHNlc3Npb24gbGVmdG92ZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbGVmdG92ZXJBID0gW3sgaWQ6ICd0MScgfSwgeyBpZDogJ3QyJyB9XTtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRsZXQgYWNxdWlyZSA9IDA7XG5cdFx0bGV0IGFwcGxpZWRFbXB0eSA9IDA7XG5cdFx0Y29uc3QgbGlmZXRpbWVNYXJrZXIgPSB7XG5cdFx0XHRkaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRkaXNwb3NlKCkgeyB0aGlzLmRpc3Bvc2VkID0gdHJ1ZTsgfSxcblx0XHR9O1xuXHRcdGxpZmV0aW1lLmFkZChsaWZldGltZU1hcmtlcik7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7IHNlc3Npb25JZDogJ3Nlc3MtQScgfSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IGxlZnRvdmVyQSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdGFjcXVpcmUrKztcblx0XHRcdFx0XHRyZXR1cm4geyBzZXNzaW9uSWQ6ICdzZXNzLUInLCBzbmFwc2hvdDogeyBzZXNzaW9uSWQ6ICdzZXNzLUInIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHtcblx0XHRcdFx0YXBwbHlFbnRyaWVzOiAoZW50cmllczogcmVhZG9ubHkgdW5rbm93bltdKSA9PiB7XG5cdFx0XHRcdFx0YXBwbHlFbnRyaWVzKys7XG5cdFx0XHRcdFx0aWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRhcHBsaWVkRW1wdHkrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJ3Nlc3MtQicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBsaWVkRW1wdHksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3F1aXJlLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlmZXRpbWVNYXJrZXIuZGlzcG9zZWQsIHRydWUpO1xuXG5cdFx0Y29uc3Qgc2FtZVNlc3Npb25MZWZ0b3ZlcjogQ29udmVyc2F0aW9uVGltZWxpbmVFbnRyeVtdID0gW1xuXHRcdFx0eyBpZDogJ3QxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdFx0eyBpZDogJ3QyJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdF07XG5cdFx0Y29uc3Qgc2FtZVNlc3Npb25MZWFzZTogSUNvbnZlcnNhdGlvblNlc3Npb25WaWV3TGVhc2UgPSB7XG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzLUEnLFxuXHRcdFx0c25hcHNob3Q6IGxlZnRvdmVyTGVhc2VTbmFwc2hvdCh7IGtpbmQ6ICdpZGxlJyB9KS5zbmFwc2hvdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25TZXNzaW9uVmlld0xlYXNlWydzbmFwc2hvdCddLFxuXHRcdFx0YXR0cmlidXRpb246IG5ldyBNYXAoKSxcblx0XHRcdGRldGFpbHM6IG5ldyBNYXAoKSxcblx0XHRcdG9uRGlkQXBwbHlGcmFtZTogRXZlbnQuTm9uZSxcblx0XHRcdHBvc3Q6IGFzeW5jICgpID0+ICh7IGFjY2VwdGVkOiBmYWxzZSwgcmVhc29uOiAnbm9fc3VjaF9zZXNzaW9uJyB9KSxcblx0XHRcdHJlcXVlc3RSZXN5bmMoKSB7IH0sXG5cdFx0XHRkaXNwb3NlKCkgeyB9LFxuXHRcdH07XG5cdFx0Y29uc3Qga2VlcE1hcmtlciA9IHtcblx0XHRcdGRpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGRpc3Bvc2UoKSB7IHRoaXMuZGlzcG9zZWQgPSB0cnVlOyB9LFxuXHRcdH07XG5cdFx0YXBwbHlFbnRyaWVzID0gMDtcblx0XHRhcHBsaWVkRW1wdHkgPSAwO1xuXHRcdGFjcXVpcmUgPSAwO1xuXHRcdGhvc3Quc2Vzc2lvblZpZXdMZWFzZSA9IHNhbWVTZXNzaW9uTGVhc2U7XG5cdFx0aG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzID0gc2FtZVNlc3Npb25MZWZ0b3Zlcjtcblx0XHRsaWZldGltZS5hZGQoa2VlcE1hcmtlcik7XG5cdFx0YmluZFNlc3Npb25WaWV3KGhvc3QsICdzZXNzLUEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlFbnRyaWVzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNxdWlyZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgc2FtZVNlc3Npb25MZWFzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcywgc2FtZVNlc3Npb25MZWZ0b3Zlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGtlZXBNYXJrZXIuZGlzcG9zZWQsIGZhbHNlKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBzdGlsbCBjbGVhcnMgZW1wdHkgdGltZWxpbmUgb24gZmlyc3QgcHVsbCB3aGlsZSBlbmdpbmUgcm9zdGVyIGlzIGluLWZsaWdodCcsICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRsZXQgYWNxdWlyZSA9IDA7XG5cdFx0bGV0IGFwcGxpZWRFbXB0eSA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7IHNlc3Npb25JZDogJ3Nlc3MtZmlyc3QnIH0sXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBbXSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdGFjcXVpcmUrKztcblx0XHRcdFx0XHRyZXR1cm4geyBzZXNzaW9uSWQ6ICdzZXNzLWZpcnN0Jywgc25hcHNob3Q6IHsgc2Vzc2lvbklkOiAnc2Vzcy1maXJzdCcgfSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRhcHBseUVudHJpZXM6IChlbnRyaWVzOiByZWFkb25seSB1bmtub3duW10pID0+IHtcblx0XHRcdFx0XHRhcHBseUVudHJpZXMrKztcblx0XHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdGFwcGxpZWRFbXB0eSsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnc2Vzcy1maXJzdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBsaWVkRW1wdHksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3F1aXJlLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAwKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBrZWVwcyBsZWZ0b3ZlciB0aW1lbGluZSB3aGlsZSBwYWlyaW5nUGVuZGluZyB0aGVuIHRydWUgZGlzY29ubmVjdCByZWJpbmRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpZmV0aW1lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHByaW9yTGVhc2UgPSB7IHNlc3Npb25JZDogJ3Nlc3MtbGVmdG92ZXInIH07XG5cdFx0Y29uc3QgbGVmdG92ZXIgPSBbeyBpZDogJ3QxJyB9LCB7IGlkOiAndDInIH1dO1xuXHRcdGxldCBjb25uZWN0ZWQgPSB0cnVlO1xuXHRcdGxldCBwYWlyaW5nUGVuZGluZyA9IGZhbHNlO1xuXHRcdGxldCBhcHBseUVudHJpZXMgPSAwO1xuXHRcdGxldCBhcHBsaWVkRW1wdHkgPSAwO1xuXHRcdGxldCBhcHBseUJhc2VsaW5lID0gMDtcblx0XHRsZXQgYWNxdWlyZSA9IDA7XG5cdFx0Y29uc3QgbGlmZXRpbWVNYXJrZXIgPSB7XG5cdFx0XHRkaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRkaXNwb3NlKCkgeyB0aGlzLmRpc3Bvc2VkID0gdHJ1ZTsgfSxcblx0XHR9O1xuXHRcdGxpZmV0aW1lLmFkZChsaWZldGltZU1hcmtlcik7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiBwcmlvckxlYXNlLFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogbGVmdG92ZXIsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gY29ubmVjdGVkICYmICFwYWlyaW5nUGVuZGluZyxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGNvbm5lY3RlZCAmJiAhcGFpcmluZ1BlbmRpbmcsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdGFjcXVpcmUrKztcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0c2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicsXG5cdFx0XHRcdFx0XHRzbmFwc2hvdDogeyBzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJyB9LFxuXHRcdFx0XHRcdFx0ZGlzcG9zZSgpIHsgfSxcblx0XHRcdFx0XHRcdG9uRGlkQXBwbHlGcmFtZTogKCkgPT4gKHsgZGlzcG9zZSgpIHsgfSB9KSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6IGNvbm5lY3RlZCA/ICdjb25uZWN0ZWQnIDogJ2Rpc2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmcgfSksXG5cdFx0XHR9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7XG5cdFx0XHRcdGFwcGx5RW50cmllczogKGVudHJpZXM6IHJlYWRvbmx5IHVua25vd25bXSkgPT4ge1xuXHRcdFx0XHRcdGFwcGx5RW50cmllcysrO1xuXHRcdFx0XHRcdGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0YXBwbGllZEVtcHR5Kys7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGFwcGx5U2Vzc2lvblZpZXdUaW1lbGluZTogKGFwcGxpZWQ6IHsga2luZDogc3RyaW5nIH0pID0+IHtcblx0XHRcdFx0aWYgKGFwcGxpZWQua2luZCA9PT0gJ2Jhc2VsaW5lJykge1xuXHRcdFx0XHRcdGFwcGx5QmFzZWxpbmUrKztcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRwYWlyaW5nUGVuZGluZyA9IHRydWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UoKS5raW5kLCAnY29ubmVjdGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCB0cnVlKTtcblxuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnc2Vzcy1sZWZ0b3ZlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBsaWVkRW1wdHksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUJhc2VsaW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNxdWlyZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgcHJpb3JMZWFzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcy5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMsIGxlZnRvdmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlmZXRpbWVNYXJrZXIuZGlzcG9zZWQsIGZhbHNlKTtcblxuXHRcdHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0Y29ubmVjdGVkID0gZmFsc2U7XG5cdFx0YmluZFNlc3Npb25WaWV3KGhvc3QsICdzZXNzLWxlZnRvdmVyJyk7XG5cdFx0YXNzZXJ0Lm9rKGFjcXVpcmUgPiAwKTtcblx0XHRhc3NlcnQub2soYXBwbHlCYXNlbGluZSA+IDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBsaWVkRW1wdHksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaWZldGltZU1hcmtlci5kaXNwb3NlZCwgdHJ1ZSk7XG5cdFx0bGlmZXRpbWUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdiaW5kU2Vzc2lvblZpZXcga2VlcHMgbGVmdG92ZXIgdGltZWxpbmUgb24gcHJvZHVjdGlvbiBjb25uZWN0aW5nIHBhaXJpbmcgc25hcHNob3QnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcHJpb3JMZWFzZSA9IHsgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicgfTtcblx0XHRjb25zdCBsZWZ0b3ZlciA9IFt7IGlkOiAndDEnIH0sIHsgaWQ6ICd0MicgfV07XG5cdFx0bGV0IHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0bGV0IHBoYXNlOiBDb25uZWN0aW9uUGhhc2UgPSB7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH07XG5cdFx0bGV0IGFwcGx5RW50cmllcyA9IDA7XG5cdFx0bGV0IGFwcGxpZWRFbXB0eSA9IDA7XG5cdFx0bGV0IGFwcGx5QmFzZWxpbmUgPSAwO1xuXHRcdGxldCBhY3F1aXJlID0gMDtcblx0XHRjb25zdCBsaWZldGltZU1hcmtlciA9IHtcblx0XHRcdGRpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGRpc3Bvc2UoKSB7IHRoaXMuZGlzcG9zZWQgPSB0cnVlOyB9LFxuXHRcdH07XG5cdFx0bGlmZXRpbWUuYWRkKGxpZmV0aW1lTWFya2VyKTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHByaW9yTGVhc2UsXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBsZWZ0b3Zlcixcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiAhcGFpcmluZ1BlbmRpbmcgJiYgcGhhc2Uua2luZCA9PT0gJ2Nvbm5lY3RlZCcsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiAhcGFpcmluZ1BlbmRpbmcgJiYgcGhhc2Uua2luZCA9PT0gJ2Nvbm5lY3RlZCcsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdGFjcXVpcmUrKztcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0c2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicsXG5cdFx0XHRcdFx0XHRzbmFwc2hvdDogeyBzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJyB9LFxuXHRcdFx0XHRcdFx0ZGlzcG9zZSgpIHsgfSxcblx0XHRcdFx0XHRcdG9uRGlkQXBwbHlGcmFtZTogKCkgPT4gKHsgZGlzcG9zZSgpIHsgfSB9KSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+IHBoYXNlLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRhcHBseUVudHJpZXM6IChlbnRyaWVzOiByZWFkb25seSB1bmtub3duW10pID0+IHtcblx0XHRcdFx0XHRhcHBseUVudHJpZXMrKztcblx0XHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdGFwcGxpZWRFbXB0eSsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRhcHBseVNlc3Npb25WaWV3VGltZWxpbmU6IChhcHBsaWVkOiB7IGtpbmQ6IHN0cmluZyB9KSA9PiB7XG5cdFx0XHRcdGlmIChhcHBsaWVkLmtpbmQgPT09ICdiYXNlbGluZScpIHtcblx0XHRcdFx0XHRhcHBseUJhc2VsaW5lKys7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cGFpcmluZ1BlbmRpbmcgPSB0cnVlO1xuXHRcdHBoYXNlID0geyBraW5kOiAnY29ubmVjdGluZycsIHJlYXNvbjogJ2luaXRpYWwnIH07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblBoYXNlKCksIHsga2luZDogJ2Nvbm5lY3RpbmcnLCByZWFzb246ICdpbml0aWFsJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGhvc3QudWFDb25uZWN0aW9uKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uRW5naW5lTGl2ZShob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UoKSwgaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcpLCBmYWxzZSk7XG5cblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJ3Nlc3MtbGVmdG92ZXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlFbnRyaWVzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbGllZEVtcHR5LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlCYXNlbGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjcXVpcmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHByaW9yTGVhc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLCBsZWZ0b3Zlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpZmV0aW1lTWFya2VyLmRpc3Bvc2VkLCBmYWxzZSk7XG5cdFx0bGlmZXRpbWUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdiaW5kU2Vzc2lvblZpZXcgY3Jvc3Mtc2Vzc2lvbiBwZW5kaW5nIGxlYXNlIGJsYW5rcyB0aGUgcHJldmlvdXMgdGltZWxpbmUgYW5kIHRyYWplY3RvcnknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbGVmdG92ZXI6IENvbnZlcnNhdGlvblRpbWVsaW5lRW50cnlbXSA9IFtcblx0XHRcdHsgaWQ6ICd0MScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJycgfSxcblx0XHRcdHsgaWQ6ICd0MicsIGtpbmQ6ICd1c2VyJywgdGV4dDogJycgfSxcblx0XHRdO1xuXHRcdGxldCBjbGVhcmVkID0gMDtcblx0XHRsZXQgdHJhamVjdG9yeUNsZWFyZWQgPSAwO1xuXHRcdGNvbnN0IGFwcGxpZWQ6IHsga2luZDogc3RyaW5nOyBjb3VudDogbnVtYmVyIH1bXSA9IFtdO1xuXHRcdGNvbnN0IHRyYWplY3RvcnlSZWNvcmRzOiB1bmtub3duW11bXSA9IFtdO1xuXHRcdGxldCBiYXNlbGluZXMgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdHNlc3Npb25WaWV3TGlmZXRpbWU6IGxpZmV0aW1lLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogeyBzZXNzaW9uSWQ6ICdzZXNzLUEnIH0sXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBsZWZ0b3Zlcixcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiAoe1xuXHRcdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3MtQicsXG5cdFx0XHRcdFx0c25hcHNob3Q6IHsgc2Vzc2lvbklkOiAncGVuZGluZycgfSxcblx0XHRcdFx0XHRkaXNwb3NlKCkgeyB9LFxuXHRcdFx0XHRcdG9uRGlkQXBwbHlGcmFtZTogKCkgPT4gKHsgZGlzcG9zZSgpIHsgfSB9KSxcblx0XHRcdFx0fSksXG5cdFx0XHR9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7XG5cdFx0XHRcdGFwcGx5RW50cmllczogKGVudHJpZXM6IHJlYWRvbmx5IHVua25vd25bXSwgYXBwbGllZEZyYW1lOiB7IGtpbmQ6IHN0cmluZyB9KSA9PiB7XG5cdFx0XHRcdFx0YXBwbGllZC5wdXNoKHsga2luZDogYXBwbGllZEZyYW1lLmtpbmQsIGNvdW50OiBlbnRyaWVzLmxlbmd0aCB9KTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Y2xlYXJQcm9jZXNzRm9sZEV4cGFuZGVkOiAoKSA9PiB7IGNsZWFyZWQrKzsgfSxcblx0XHRcdH0sXG5cdFx0XHR0cmFqZWN0b3J5Vmlldzoge1xuXHRcdFx0XHRjbGVhclNlc3Npb25TdGF0ZTogKCkgPT4geyB0cmFqZWN0b3J5Q2xlYXJlZCsrOyB9LFxuXHRcdFx0XHRzZXRSZWNvcmRzOiAocmVjb3JkczogcmVhZG9ubHkgdW5rbm93bltdKSA9PiB7IHRyYWplY3RvcnlSZWNvcmRzLnB1c2goWy4uLnJlY29yZHNdKTsgfSxcblx0XHRcdH0sXG5cdFx0XHRhcHBseVNlc3Npb25WaWV3VGltZWxpbmU6ICgpID0+IHsgYmFzZWxpbmVzKys7IH0sXG5cdFx0fTtcblx0XHRjb25zdCBib3VuZCA9IGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblx0XHRiaW5kU2Vzc2lvblZpZXcoYm91bmQsICdzZXNzLUInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2xlYXJlZCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWplY3RvcnlDbGVhcmVkLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGxpZWQsIFt7IGtpbmQ6ICdiYXNlbGluZScsIGNvdW50OiAwIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRyYWplY3RvcnlSZWNvcmRzLCBbW11dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFzZWxpbmVzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZT8uc2Vzc2lvbklkLCAnc2Vzcy1CJyk7XG5cblx0XHRjbGVhcmVkID0gMDtcblx0XHR0cmFqZWN0b3J5Q2xlYXJlZCA9IDA7XG5cdFx0YXBwbGllZC5sZW5ndGggPSAwO1xuXHRcdHRyYWplY3RvcnlSZWNvcmRzLmxlbmd0aCA9IDA7XG5cdFx0aG9zdC5zZXNzaW9uVmlld0xlYXNlID0geyBzZXNzaW9uSWQ6ICdzZXNzLUInIH07XG5cdFx0aG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzID0gbGVmdG92ZXI7XG5cdFx0YmluZFNlc3Npb25WaWV3KGJvdW5kLCAnc2Vzcy1CJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNsZWFyZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFqZWN0b3J5Q2xlYXJlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhcHBsaWVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0cmFqZWN0b3J5UmVjb3JkcywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYXNlbGluZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMsIGxlZnRvdmVyKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBjcm9zcy1zZXNzaW9uIHJvc3RlciBhbmQgcGFpcmluZyBjbGVhcnMgZm9sZCBleHBhbmQgYW5kIHRyYWplY3Rvcnkgcm93cycsICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsZWZ0b3ZlcjogQ29udmVyc2F0aW9uVGltZWxpbmVFbnRyeVtdID0gW1xuXHRcdFx0eyBpZDogJ3QxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdFx0eyBpZDogJ3QyJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdF07XG5cdFx0bGV0IGNsZWFyZWQgPSAwO1xuXHRcdGxldCB0cmFqZWN0b3J5Q2xlYXJlZCA9IDA7XG5cdFx0Y29uc3QgdHJhamVjdG9yeVJlY29yZHM6IHVua25vd25bXVtdID0gW107XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7IHNlc3Npb25JZDogJ3Nlc3MtQScgfSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IGxlZnRvdmVyLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHtcblx0XHRcdFx0YXBwbHlFbnRyaWVzOiAoKSA9PiB7IH0sXG5cdFx0XHRcdGNsZWFyUHJvY2Vzc0ZvbGRFeHBhbmRlZDogKCkgPT4geyBjbGVhcmVkKys7IH0sXG5cdFx0XHR9LFxuXHRcdFx0dHJhamVjdG9yeVZpZXc6IHtcblx0XHRcdFx0Y2xlYXJTZXNzaW9uU3RhdGU6ICgpID0+IHsgdHJhamVjdG9yeUNsZWFyZWQrKzsgfSxcblx0XHRcdFx0c2V0UmVjb3JkczogKHJlY29yZHM6IHJlYWRvbmx5IHVua25vd25bXSkgPT4geyB0cmFqZWN0b3J5UmVjb3Jkcy5wdXNoKFsuLi5yZWNvcmRzXSk7IH0sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB1bmRlZmluZWQgYXMgdW5kZWZpbmVkIHwge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2UoKTogeyBraW5kOiBzdHJpbmc7IHBhdGg6IHN0cmluZyB9O1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3QoKTogeyBwYWlyaW5nUGVuZGluZzogYm9vbGVhbiB9O1xuXHRcdFx0fSxcblx0XHR9O1xuXHRcdGNvbnN0IGJvdW5kID0gaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGJpbmRTZXNzaW9uVmlldyhib3VuZCwgJ3Nlc3MtQicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbGVhcmVkLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeUNsZWFyZWQsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodHJhamVjdG9yeVJlY29yZHMsIFtbXV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChib3VuZC5sYXN0QXR0YWNoZWRFbnRyaWVzLmxlbmd0aCwgMCk7XG5cblx0XHRjbGVhcmVkID0gMDtcblx0XHR0cmFqZWN0b3J5Q2xlYXJlZCA9IDA7XG5cdFx0dHJhamVjdG9yeVJlY29yZHMubGVuZ3RoID0gMDtcblx0XHRob3N0LnNlc3Npb25WaWV3TGVhc2UgPSB7IHNlc3Npb25JZDogJ3Nlc3MtQicgfTtcblx0XHRob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMgPSBsZWZ0b3Zlcjtcblx0XHRiaW5kU2Vzc2lvblZpZXcoYm91bmQsICdzZXNzLUInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2xlYXJlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWplY3RvcnlDbGVhcmVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRyYWplY3RvcnlSZWNvcmRzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvdW5kLmxhc3RBdHRhY2hlZEVudHJpZXMsIGxlZnRvdmVyKTtcblxuXHRcdGhvc3Quc3R1YlNlcnZpY2UgPSB7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0fTtcblx0XHRob3N0LnVhQ29ubmVjdGlvbiA9IHtcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdH07XG5cdFx0aG9zdC5zZXNzaW9uVmlld0xlYXNlID0geyBzZXNzaW9uSWQ6ICdzZXNzLUInIH07XG5cdFx0YmluZFNlc3Npb25WaWV3KGJvdW5kLCAnc2Vzcy1DJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNsZWFyZWQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFqZWN0b3J5Q2xlYXJlZCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0cmFqZWN0b3J5UmVjb3JkcywgW1tdXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvdW5kLmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAwKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZG9lcyBub3Qga2VlcCBvdGhlciBzZXNzaW9uIGxlZnRvdmVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpZmV0aW1lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxlZnRvdmVyQSA9IFt7IGlkOiAndDEnIH0sIHsgaWQ6ICd0MicgfV07XG5cdFx0bGV0IGFwcGx5RW50cmllcyA9IDA7XG5cdFx0bGV0IGFwcGxpZWRFbXB0eSA9IDA7XG5cdFx0bGV0IGFjcXVpcmUgPSAwO1xuXHRcdGNvbnN0IGxpZmV0aW1lTWFya2VyID0ge1xuXHRcdFx0ZGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0ZGlzcG9zZSgpIHsgdGhpcy5kaXNwb3NlZCA9IHRydWU7IH0sXG5cdFx0fTtcblx0XHRsaWZldGltZS5hZGQobGlmZXRpbWVNYXJrZXIpO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdHNlc3Npb25WaWV3TGlmZXRpbWU6IGxpZmV0aW1lLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogeyBzZXNzaW9uSWQ6ICdzZXNzLUEnIH0sXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBsZWZ0b3ZlckEsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0YWNxdWlyZSsrO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRzZXNzaW9uSWQ6ICdzZXNzLUInLFxuXHRcdFx0XHRcdFx0c25hcHNob3Q6IHsgc2Vzc2lvbklkOiAnc2Vzcy1CJyB9LFxuXHRcdFx0XHRcdFx0ZGlzcG9zZSgpIHsgfSxcblx0XHRcdFx0XHRcdG9uRGlkQXBwbHlGcmFtZTogKCkgPT4gKHsgZGlzcG9zZSgpIHsgfSB9KSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRhcHBseUVudHJpZXM6IChlbnRyaWVzOiByZWFkb25seSB1bmtub3duW10pID0+IHtcblx0XHRcdFx0XHRhcHBseUVudHJpZXMrKztcblx0XHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdGFwcGxpZWRFbXB0eSsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRhcHBseVNlc3Npb25WaWV3VGltZWxpbmU6ICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cdFx0YmluZFNlc3Npb25WaWV3KGhvc3QsICdzZXNzLUInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlFbnRyaWVzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbGllZEVtcHR5LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNxdWlyZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpZmV0aW1lTWFya2VyLmRpc3Bvc2VkLCB0cnVlKTtcblxuXHRcdGNvbnN0IHNhbWVTZXNzaW9uTGVmdG92ZXI6IENvbnZlcnNhdGlvblRpbWVsaW5lRW50cnlbXSA9IFtcblx0XHRcdHsgaWQ6ICd0MScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJycgfSxcblx0XHRcdHsgaWQ6ICd0MicsIGtpbmQ6ICd1c2VyJywgdGV4dDogJycgfSxcblx0XHRdO1xuXHRcdGNvbnN0IHNhbWVTZXNzaW9uTGVhc2U6IElDb252ZXJzYXRpb25TZXNzaW9uVmlld0xlYXNlID0ge1xuXHRcdFx0c2Vzc2lvbklkOiAnc2Vzcy1BJyxcblx0XHRcdHNuYXBzaG90OiBsZWZ0b3ZlckxlYXNlU25hcHNob3QoeyBraW5kOiAnaWRsZScgfSkuc25hcHNob3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uU2Vzc2lvblZpZXdMZWFzZVsnc25hcHNob3QnXSxcblx0XHRcdGF0dHJpYnV0aW9uOiBuZXcgTWFwKCksXG5cdFx0XHRkZXRhaWxzOiBuZXcgTWFwKCksXG5cdFx0XHRvbkRpZEFwcGx5RnJhbWU6IEV2ZW50Lk5vbmUsXG5cdFx0XHRwb3N0OiBhc3luYyAoKSA9PiAoeyBhY2NlcHRlZDogZmFsc2UsIHJlYXNvbjogJ25vX3N1Y2hfc2Vzc2lvbicgfSksXG5cdFx0XHRyZXF1ZXN0UmVzeW5jKCkgeyB9LFxuXHRcdFx0ZGlzcG9zZSgpIHsgfSxcblx0XHR9O1xuXHRcdGNvbnN0IGtlZXBNYXJrZXIgPSB7XG5cdFx0XHRkaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRkaXNwb3NlKCkgeyB0aGlzLmRpc3Bvc2VkID0gdHJ1ZTsgfSxcblx0XHR9O1xuXHRcdGFwcGx5RW50cmllcyA9IDA7XG5cdFx0YXBwbGllZEVtcHR5ID0gMDtcblx0XHRhY3F1aXJlID0gMDtcblx0XHRob3N0LnNlc3Npb25WaWV3TGVhc2UgPSBzYW1lU2Vzc2lvbkxlYXNlO1xuXHRcdGhvc3QubGFzdEF0dGFjaGVkRW50cmllcyA9IHNhbWVTZXNzaW9uTGVmdG92ZXI7XG5cdFx0bGlmZXRpbWUuYWRkKGtlZXBNYXJrZXIpO1xuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnc2Vzcy1BJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjcXVpcmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHNhbWVTZXNzaW9uTGVhc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMsIHNhbWVTZXNzaW9uTGVmdG92ZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChrZWVwTWFya2VyLmRpc3Bvc2VkLCBmYWxzZSk7XG5cdFx0bGlmZXRpbWUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBhcHBseUFjdGl2ZUxlZnRvdmVySG9zdChvcHRpb25zOiB7XG5cdFx0cmVhZG9ubHkgdGFyZ2V0U2Vzc2lvbklkOiBzdHJpbmc7XG5cdFx0cmVhZG9ubHkgbGVhc2VTZXNzaW9uSWQ6IHN0cmluZztcblx0XHRyZWFkb25seSBsZWZ0b3ZlcjogQ29udmVyc2F0aW9uVGltZWxpbmVFbnRyeVtdO1xuXHRcdHJlYWRvbmx5IG1vZGU6ICdwYWlyaW5nLWhvbGQnIHwgJ3Jvc3Rlci1pbi1mbGlnaHQnO1xuXHR9KToge1xuXHRcdGhvc3Q6IElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGxpZmV0aW1lOiBEaXNwb3NhYmxlU3RvcmU7XG5cdFx0cmVhZG9ubHkgYWNxdWlyZTogbnVtYmVyO1xuXHRcdHJlYWRvbmx5IGFwcGx5RW50cmllczogbnVtYmVyO1xuXHRcdHJlYWRvbmx5IGFwcGxpZWRFbXB0eTogbnVtYmVyO1xuXHRcdHJlYWRvbmx5IHBoYXNlQ2FsbHM6IHN0cmluZ1tdO1xuXHRcdHJlYWRvbmx5IHN5bmNDYWxsczogc3RyaW5nW107XG5cdFx0cmVhZG9ubHkgbGlmZXRpbWVEaXNwb3NlZDogYm9vbGVhbjtcblx0fSB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbGVmdG92ZXIgPSBvcHRpb25zLmxlZnRvdmVyO1xuXHRcdGNvbnN0IHByaW9yTGVhc2UgPSB7IHNlc3Npb25JZDogb3B0aW9ucy5sZWFzZVNlc3Npb25JZCB9O1xuXHRcdGNvbnN0IHN0YXRlID0ge1xuXHRcdFx0YWNxdWlyZTogMCxcblx0XHRcdGFwcGx5RW50cmllczogMCxcblx0XHRcdGFwcGxpZWRFbXB0eTogMCxcblx0XHRcdHBoYXNlQ2FsbHM6IFtdIGFzIHN0cmluZ1tdLFxuXHRcdFx0c3luY0NhbGxzOiBbXSBhcyBzdHJpbmdbXSxcblx0XHR9O1xuXHRcdGNvbnN0IGxpZmV0aW1lTWFya2VyID0ge1xuXHRcdFx0ZGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0ZGlzcG9zZSgpIHsgdGhpcy5kaXNwb3NlZCA9IHRydWU7IH0sXG5cdFx0fTtcblx0XHRsaWZldGltZS5hZGQobGlmZXRpbWVNYXJrZXIpO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdHNlc3Npb25WaWV3TGlmZXRpbWU6IGxpZmV0aW1lLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogcHJpb3JMZWFzZSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IGxlZnRvdmVyLFxuXHRcdFx0dmlzdWFsaXplT3ZlcmxheTogeyBjbG9zZSgpIHsgfSB9LFxuXHRcdFx0ZW5naW5lSGlzdG9yeUxpc3Q6IHVuZGVmaW5lZCxcblx0XHRcdGVuZ2luZVNuYXBzaG90c0xpc3Q6IHVuZGVmaW5lZCxcblx0XHRcdGluYm94T3ZlcmxheTogeyBjbG9zZUxpc3RQYW5lbCgpIHsgfSwgcmVuZGVyKCkgeyB9IH0sXG5cdFx0XHR0cmFqZWN0b3J5VmlldzogeyBjbGVhclNlc3Npb25TdGF0ZSgpIHsgfSB9LFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAnJyB9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdCgpIHsgfSxcblx0XHRcdHJlc2V0SW5wdXRIaXN0b3J5QnJvd3NlKCkgeyB9LFxuXHRcdFx0cmVmcmVzaFNlc3Npb25TZWxlY3RPcHRpb25zKCkgeyB9LFxuXHRcdFx0c3luY1Nlc3Npb25Db25maWdTZWxlY3RzKCkgeyB9LFxuXHRcdFx0dXBkYXRlU2Vzc2lvblRpdGxlKCkgeyB9LFxuXHRcdFx0cmVhZENvbXBvc2VyRHJhZnQ6ICgpID0+ICcnLFxuXHRcdFx0cmVuZGVySW5ib3hTdGF0dXMoKSB7IH0sXG5cdFx0XHR1cGRhdGVDb252ZXJzYXRpb25QaGFzZSgpIHsgc3RhdGUucGhhc2VDYWxscy5wdXNoKG9wdGlvbnMudGFyZ2V0U2Vzc2lvbklkKTsgfSxcblx0XHRcdHVwZGF0ZVN5bmNDaHJvbWUoKSB7IHN0YXRlLnN5bmNDYWxscy5wdXNoKG9wdGlvbnMudGFyZ2V0U2Vzc2lvbklkKTsgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiBvcHRpb25zLnRhcmdldFNlc3Npb25JZCxcblx0XHRcdGJpbmRTZXNzaW9uVmlldzogKHNlc3Npb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGJpbmRTZXNzaW9uVmlldyhob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3QsIHNlc3Npb25JZCk7XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IG9wdGlvbnMubW9kZSA9PT0gJ3Jvc3Rlci1pbi1mbGlnaHQnLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLmFjcXVpcmUrKztcblx0XHRcdFx0XHRyZXR1cm4geyBzZXNzaW9uSWQ6IG9wdGlvbnMudGFyZ2V0U2Vzc2lvbklkLCBzbmFwc2hvdDogeyBzZXNzaW9uSWQ6IG9wdGlvbnMudGFyZ2V0U2Vzc2lvbklkIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogb3B0aW9ucy5tb2RlID09PSAncGFpcmluZy1ob2xkJyB9KSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHtcblx0XHRcdFx0YXBwbHlFbnRyaWVzOiAoZW50cmllczogcmVhZG9ubHkgdW5rbm93bltdKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUuYXBwbHlFbnRyaWVzKys7XG5cdFx0XHRcdFx0aWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRzdGF0ZS5hcHBsaWVkRW1wdHkrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0YXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lKCkgeyB9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhvc3Q6IGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdCxcblx0XHRcdGxpZmV0aW1lLFxuXHRcdFx0Z2V0IGFjcXVpcmUoKSB7IHJldHVybiBzdGF0ZS5hY3F1aXJlOyB9LFxuXHRcdFx0Z2V0IGFwcGx5RW50cmllcygpIHsgcmV0dXJuIHN0YXRlLmFwcGx5RW50cmllczsgfSxcblx0XHRcdGdldCBhcHBsaWVkRW1wdHkoKSB7IHJldHVybiBzdGF0ZS5hcHBsaWVkRW1wdHk7IH0sXG5cdFx0XHRnZXQgcGhhc2VDYWxscygpIHsgcmV0dXJuIHN0YXRlLnBoYXNlQ2FsbHM7IH0sXG5cdFx0XHRnZXQgc3luY0NhbGxzKCkgeyByZXR1cm4gc3RhdGUuc3luY0NhbGxzOyB9LFxuXHRcdFx0Z2V0IGxpZmV0aW1lRGlzcG9zZWQoKSB7IHJldHVybiBsaWZldGltZU1hcmtlci5kaXNwb3NlZDsgfSxcblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnYXBwbHlBY3RpdmVTZXNzaW9uIGZpcnN0LXB1bGwgdG8gb3RoZXIgc2Vzc2lvbiByZWZyZXNoZXMgcGhhc2UgYW5kIHN5bmMgY2hyb21lIHdpdGhvdXQgYWNxdWlyZScsICgpID0+IHtcblx0XHRjb25zdCBsZWZ0b3ZlcjogQ29udmVyc2F0aW9uVGltZWxpbmVFbnRyeVtdID0gW1xuXHRcdFx0eyBpZDogJ3QxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdFx0eyBpZDogJ3QyJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdF07XG5cdFx0Zm9yIChjb25zdCBtb2RlIG9mIFsncGFpcmluZy1ob2xkJywgJ3Jvc3Rlci1pbi1mbGlnaHQnXSBhcyBjb25zdCkge1xuXHRcdFx0Y29uc3QgZml4dHVyZSA9IGFwcGx5QWN0aXZlTGVmdG92ZXJIb3N0KHtcblx0XHRcdFx0dGFyZ2V0U2Vzc2lvbklkOiAnc2Vzcy1CJyxcblx0XHRcdFx0bGVhc2VTZXNzaW9uSWQ6ICdzZXNzLUEnLFxuXHRcdFx0XHRsZWZ0b3Zlcixcblx0XHRcdFx0bW9kZSxcblx0XHRcdH0pO1xuXHRcdFx0YXBwbHlBY3RpdmVTZXNzaW9uKGZpeHR1cmUuaG9zdCwgJ3Nlc3MtQicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuYXBwbHlFbnRyaWVzLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmFwcGxpZWRFbXB0eSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5hY3F1aXJlLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubGFzdEF0dGFjaGVkRW50cmllcy5sZW5ndGgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubGlmZXRpbWVEaXNwb3NlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucGhhc2VDYWxscywgWydzZXNzLUInXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuc3luY0NhbGxzLCBbJ3Nlc3MtQiddKTtcblx0XHRcdGZpeHR1cmUubGlmZXRpbWUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnYXBwbHlBY3RpdmVTZXNzaW9uIHNhbWUtc2Vzc2lvbiBLRUVQIGxlZnRvdmVyIGRvZXMgbm90IGNsZWFyIGxlZnRvdmVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxlZnRvdmVyOiBDb252ZXJzYXRpb25UaW1lbGluZUVudHJ5W10gPSBbXG5cdFx0XHR7IGlkOiAndDEnLCBraW5kOiAndXNlcicsIHRleHQ6ICcnIH0sXG5cdFx0XHR7IGlkOiAndDInLCBraW5kOiAndXNlcicsIHRleHQ6ICcnIH0sXG5cdFx0XTtcblx0XHRmb3IgKGNvbnN0IG1vZGUgb2YgWydwYWlyaW5nLWhvbGQnLCAncm9zdGVyLWluLWZsaWdodCddIGFzIGNvbnN0KSB7XG5cdFx0XHRjb25zdCBmaXh0dXJlID0gYXBwbHlBY3RpdmVMZWZ0b3Zlckhvc3Qoe1xuXHRcdFx0XHR0YXJnZXRTZXNzaW9uSWQ6ICdzZXNzLUEnLFxuXHRcdFx0XHRsZWFzZVNlc3Npb25JZDogJ3Nlc3MtQScsXG5cdFx0XHRcdGxlZnRvdmVyLFxuXHRcdFx0XHRtb2RlLFxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBwcmlvckxlYXNlID0gZml4dHVyZS5ob3N0LnNlc3Npb25WaWV3TGVhc2U7XG5cdFx0XHRhcHBseUFjdGl2ZVNlc3Npb24oZml4dHVyZS5ob3N0LCAnc2Vzcy1BJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5hcHBseUVudHJpZXMsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuYWNxdWlyZSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25WaWV3TGVhc2UsIHByaW9yTGVhc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLCBsZWZ0b3Zlcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5saWZldGltZURpc3Bvc2VkLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucGhhc2VDYWxscywgWydzZXNzLUEnXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuc3luY0NhbGxzLCBbJ3Nlc3MtQSddKTtcblx0XHRcdGZpeHR1cmUubGlmZXRpbWUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IGFjcXVpcmVTZXNzaW9uVmlldyB0aHJvdyBzaG93cyBmYWlsZWQgYW5kIGRvZXMgbm90IGxlYXZlIGFuIHVuaGFuZGxlZCByZWplY3Rpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHJlamVjdGlvbnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IG9uVW5oYW5kbGVkID0gKHJlYXNvbjogdW5rbm93bikgPT4geyByZWplY3Rpb25zLnB1c2gocmVhc29uKTsgfTtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0X3N0b3JlOiB7IGlzRGlzcG9zZWQ6IGZhbHNlIH0sXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHsgc2Vzc2lvbklkOiAncHJpb3InIH0sXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBbXSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdhY3F1aXJlIGJvb20nKTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHsgYXBwbHlFbnRyaWVzOiAoKSA9PiB7IGFwcGx5RW50cmllcysrOyB9IH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHRcdGFwcGx5U2Vzc2lvblZpZXdUaW1lbGluZTogKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR0cnkge1xuXHRcdFx0YmluZFNlc3Npb25WaWV3KGhvc3QsICdzZXNzLWxlZnRvdmVyJyk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlFbnRyaWVzLCAwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVqZWN0aW9ucywgW10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdFx0bGlmZXRpbWUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmV0cnlFcnJvciBwb3N0cyBjb250aW51ZUdlbmVyYXRpb24gb24gdGhlIGJvdW5kIGxlYXNlIGFuZCBkb2VzIG5vdCBjYWxsIHJvc3Rlci5yZXRyeUVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBvc3RlZDogQ29udmVyc2F0aW9uV3JpdGVNZXNzYWdlW10gPSBbXTtcblx0XHRsZXQgcm9zdGVyUmV0cnkgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRwb3N0Qm91bmQ6IGFzeW5jIChtc2c6IENvbnZlcnNhdGlvbldyaXRlTWVzc2FnZSk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0cG9zdGVkLnB1c2gobXNnKTtcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0cmV0cnlFcnJvcjogKCkgPT4ge1xuXHRcdFx0XHRcdHJvc3RlclJldHJ5Kys7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cmV0cnlFcnJvcihob3N0LCB7IGlkOiAnICBtc2ctMSAgJywgdHVybklkOiAnICB0dXJuLTEgICcsIGFnZW50SWQ6ICcgIHN1YjphICAnIH0pO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBvc3RlZCwgW3tcblx0XHRcdGtpbmQ6ICdjb250aW51ZUdlbmVyYXRpb24nLFxuXHRcdFx0YWdlbnRJZDogJ3N1YjphJyxcblx0XHRcdHR1cm5JZDogJ3R1cm4tMScsXG5cdFx0XHRtZXNzYWdlSWQ6ICdtc2ctMScsXG5cdFx0fV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXJSZXRyeSwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JldHJ5RXJyb3Igb21pdHRlZCB0dXJuSWQgYW5kIGFnZW50SWQgZmFsbCBiYWNrIHRvIG1lc3NhZ2VJZCBhbmQgcm9vdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwb3N0ZWQ6IENvbnZlcnNhdGlvbldyaXRlTWVzc2FnZVtdID0gW107XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKG1zZzogQ29udmVyc2F0aW9uV3JpdGVNZXNzYWdlKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRwb3N0ZWQucHVzaChtc2cpO1xuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHRlZDogdHJ1ZSwgY29ycmVsYXRpb246IHsgaWQ6ICd4JyB9IH07XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRyZXRyeUVycm9yOiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHJldHJ5RXJyb3IoaG9zdCwgeyBpZDogJ21zZy1vbmx5JyB9KTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwb3N0ZWQsIFt7XG5cdFx0XHRraW5kOiAnY29udGludWVHZW5lcmF0aW9uJyxcblx0XHRcdGFnZW50SWQ6ICdyb290Jyxcblx0XHRcdHR1cm5JZDogJ21zZy1vbmx5Jyxcblx0XHRcdG1lc3NhZ2VJZDogJ21zZy1vbmx5Jyxcblx0XHR9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JldHJ5RXJyb3IgYmxhbmsgbWVzc2FnZUlkIHBvc3RzIG5vdGhpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IHBvc3RCb3VuZCA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKCk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0cG9zdEJvdW5kKys7XG5cdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlLCBjb3JyZWxhdGlvbjogeyBpZDogJ3gnIH0gfTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJldHJ5RXJyb3I6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cmV0cnlFcnJvcihob3N0LCB7IGlkOiAnICAgJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdEJvdW5kLCAwKTtcblx0fSk7XG5cblx0dGVzdCgncmV0cnlFcnJvciBwb3N0Qm91bmQgcmVqZWN0IHNob3dzIGZhaWxlZCBhbmQgZG9lcyBub3QgbGVhdmUgYW4gdW5oYW5kbGVkIHJlamVjdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgcmVqZWN0aW9uczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWQgPSAocmVhc29uOiB1bmtub3duKSA9PiB7IHJlamVjdGlvbnMucHVzaChyZWFzb24pOyB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRwb3N0Qm91bmQ6IGFzeW5jICgpOiBQcm9taXNlPFBvc3RPdXRjb21lPiA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigncG9zdEJvdW5kIGJvb20nKTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJldHJ5RXJyb3I6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXRyeUVycm9yKGhvc3QsIHsgaWQ6ICdtc2ctMScgfSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVqZWN0aW9ucywgW10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmV0cnlFcnJvciBwb3N0Qm91bmQgcmVqZWN0IHN0aWxsIHNob3dzIGZhaWxlZCBhbmQgZG9lcyBub3QgbGVhayB3aGVuIHNob3dQb3N0RmFpbHVyZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKCk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdwb3N0Qm91bmQgYm9vbScpO1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0cmV0cnlFcnJvcjogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4gcmV0cnlFcnJvcihob3N0LCB7IGlkOiAnbXNnLTEnIH0pKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUNvbmZpcm1hdGlvbiBwb3N0Qm91bmQgcmVqZWN0IHNob3dzIGZhaWxlZCBhbmQgZG9lcyBub3QgbGVhdmUgYW4gdW5oYW5kbGVkIHJlamVjdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgcmVqZWN0aW9uczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWQgPSAocmVhc29uOiB1bmtub3duKSA9PiB7IHJlamVjdGlvbnMucHVzaChyZWFzb24pOyB9O1xuXHRcdGxldCBmb2N1c2VkID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3Bvc3RCb3VuZCBib29tJyk7XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHsgaXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlIH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzVGltZWxpbmVSZWNvcmQ6ICgpID0+IHsgZm9jdXNlZCsrOyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR0cnkge1xuXHRcdFx0dm9pZCByZXNvbHZlQ29uZmlybWF0aW9uKGhvc3QsICd0dXJuLTEnLCAnYWxsb3dlZCcpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0SW1tZWRpYXRlKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlamVjdGlvbnMsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2N1c2VkLCAwKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cHJvY2Vzcy5vZmYoJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVRdWVzdGlvbiBwb3N0Qm91bmQgcmVqZWN0IHNob3dzIGZhaWxlZCBhbmQgZG9lcyBub3QgbGVhdmUgYW4gdW5oYW5kbGVkIHJlamVjdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgcmVqZWN0aW9uczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWQgPSAocmVhc29uOiB1bmtub3duKSA9PiB7IHJlamVjdGlvbnMucHVzaChyZWFzb24pOyB9O1xuXHRcdGxldCBmb2N1c2VkID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3Bvc3RCb3VuZCBib29tJyk7XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHsgaXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlIH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzVGltZWxpbmVSZWNvcmQ6ICgpID0+IHsgZm9jdXNlZCsrOyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR0cnkge1xuXHRcdFx0dm9pZCByZXNvbHZlUXVlc3Rpb24oaG9zdCwgJ3R1cm4tMScsICdyZXEtMScsIHsgcTE6IHsgc2VsZWN0ZWRMYWJlbHM6IFsnYSddIH0gfSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVqZWN0aW9ucywgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvY3VzZWQsIDApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUNvbmZpcm1hdGlvbiBjb25uZWN0ZWQgcm9zdGVyIGZhbHNlIHNob3dzIGZhaWxlZCBhbmQgZG9lcyBub3QgbGVhdmUgYW4gdW5oYW5kbGVkIHJlamVjdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgcmVqZWN0aW9uczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWQgPSAocmVhc29uOiB1bmtub3duKSA9PiB7IHJlamVjdGlvbnMucHVzaChyZWFzb24pOyB9O1xuXHRcdGxldCBmb2N1c2VkID0gMDtcblx0XHRsZXQgZm9yd2FyZGVkID0gMDtcblx0XHRsZXQgcG9zdEJvdW5kID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRwb3N0Qm91bmQrKztcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdHJlc29sdmVDb25maXJtYXRpb246ICgpID0+IHtcblx0XHRcdFx0XHRmb3J3YXJkZWQrKztcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0XHRmb2N1c1RpbWVsaW5lUmVjb3JkOiAoKSA9PiB7IGZvY3VzZWQrKzsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZCk7XG5cdFx0dHJ5IHtcblx0XHRcdHZvaWQgcmVzb2x2ZUNvbmZpcm1hdGlvbihob3N0LCAndHVybi0xJywgJ2FsbG93ZWQnKTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldEltbWVkaWF0ZSgoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3J3YXJkZWQsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc3RCb3VuZCwgMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVqZWN0aW9ucywgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvY3VzZWQsIDApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUNvbmZpcm1hdGlvbiBjb25uZWN0ZWQgcm9zdGVyIGZhbHNlIHRoZW4gZGlzY29ubmVjdCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRsZXQgY29ubmVjdGVkID0gdHJ1ZTtcblx0XHRsZXQgZm9jdXNlZCA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKCk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBjb25uZWN0ZWQsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRyZXNvbHZlQ29uZmlybWF0aW9uOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29ubmVjdGVkID0gZmFsc2U7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0Zm9jdXNUaW1lbGluZVJlY29yZDogKCkgPT4geyBmb2N1c2VkKys7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0YXdhaXQgcmVzb2x2ZUNvbmZpcm1hdGlvbihob3N0LCAndHVybi0xJywgJ3NraXBwZWQnKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9jdXNlZCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVRdWVzdGlvbiBjb25uZWN0ZWQgcm9zdGVyIGZhbHNlIHNob3dzIGZhaWxlZCBhbmQgZG9lcyBub3QgbGVhdmUgYW4gdW5oYW5kbGVkIHJlamVjdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgcmVqZWN0aW9uczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWQgPSAocmVhc29uOiB1bmtub3duKSA9PiB7IHJlamVjdGlvbnMucHVzaChyZWFzb24pOyB9O1xuXHRcdGxldCBmb2N1c2VkID0gMDtcblx0XHRsZXQgZm9yd2FyZGVkID0gMDtcblx0XHRsZXQgcG9zdEJvdW5kID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRwb3N0Qm91bmQrKztcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdHJlc3BvbmRRdWVzdGlvbjogKCkgPT4ge1xuXHRcdFx0XHRcdGZvcndhcmRlZCsrO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzVGltZWxpbmVSZWNvcmQ6ICgpID0+IHsgZm9jdXNlZCsrOyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR0cnkge1xuXHRcdFx0dm9pZCByZXNvbHZlUXVlc3Rpb24oaG9zdCwgJ3R1cm4tMScsICdyZXEtMScsIHsgcTE6IHsgc2VsZWN0ZWRMYWJlbHM6IFsnYSddIH0gfSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9yd2FyZGVkLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwb3N0Qm91bmQsIDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlamVjdGlvbnMsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2N1c2VkLCAwKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cHJvY2Vzcy5vZmYoJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVRdWVzdGlvbiBjb25uZWN0ZWQgcm9zdGVyIGZhbHNlIHRoZW4gZGlzY29ubmVjdCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRsZXQgY29ubmVjdGVkID0gdHJ1ZTtcblx0XHRsZXQgZm9jdXNlZCA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKCk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBjb25uZWN0ZWQsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRyZXNwb25kUXVlc3Rpb246ICgpID0+IHtcblx0XHRcdFx0XHRjb25uZWN0ZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0XHRmb2N1c1RpbWVsaW5lUmVjb3JkOiAoKSA9PiB7IGZvY3VzZWQrKzsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRhd2FpdCByZXNvbHZlUXVlc3Rpb24oaG9zdCwgJ3R1cm4tMScsICdyZXEtMScsIHsgcTE6IHsgc2VsZWN0ZWRMYWJlbHM6IFsnYSddIH0gfSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvY3VzZWQsIDApO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBwYWlyaW5nSG9sZExlZnRvdmVyV3JpdGVIb3N0KGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10pOiB7XG5cdFx0aG9zdDogSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cdFx0cG9zdGVkOiBudW1iZXI7XG5cdH0ge1xuXHRcdGNvbnN0IHN0YXRlID0geyBwb3N0ZWQ6IDAgfTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLWxlZnRvdmVyJyxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHtcblx0XHRcdFx0cG9zdDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLnBvc3RlZCsrO1xuXHRcdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlLCBjb3JyZWxhdGlvbjogeyBpZDogJ3gnIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRwb3N0Qm91bmQ6IGFzeW5jIChtc2c6IENvbnZlcnNhdGlvbldyaXRlTWVzc2FnZSk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0cmV0dXJuIHBvc3RCb3VuZChob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsIG1zZyk7XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0Zm9jdXNUaW1lbGluZVJlY29yZDogKCkgPT4geyB9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHsgaG9zdDogaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0LCBnZXQgcG9zdGVkKCkgeyByZXR1cm4gc3RhdGUucG9zdGVkOyB9IH07XG5cdH1cblxuXHR0ZXN0KCdwb3N0Qm91bmQgcGFpcmluZy1ob2xkIGxlZnRvdmVyIGxlYXNlIHJlamVjdHMgd2l0aG91dCBsZWFzZS5wb3N0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QsIHBvc3RlZCB9ID0gcGFpcmluZ0hvbGRMZWZ0b3ZlcldyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0Y29uc3Qgb3V0Y29tZSA9IGF3YWl0IHBvc3RCb3VuZChob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsIHtcblx0XHRcdGtpbmQ6ICdjb250aW51ZUdlbmVyYXRpb24nLFxuXHRcdFx0YWdlbnRJZDogJ3Jvb3QnLFxuXHRcdFx0dHVybklkOiAndHVybi0xJyxcblx0XHRcdG1lc3NhZ2VJZDogJ21zZy0xJyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0Y29tZS5hY2NlcHRlZCwgZmFsc2UpO1xuXHRcdGlmICghb3V0Y29tZS5hY2NlcHRlZCkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG91dGNvbWUucmVhc29uLCAnbm9fc3VjaF9zZXNzaW9uJyk7XG5cdFx0fVxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUNvbmZpcm1hdGlvbiBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgbGVhc2UgZG9lcyBub3QgcG9zdCBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0LCBwb3N0ZWQgfSA9IHBhaXJpbmdIb2xkTGVmdG92ZXJXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGF3YWl0IHJlc29sdmVDb25maXJtYXRpb24oaG9zdCwgJ3R1cm4tMScsICdhbGxvd2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlUXVlc3Rpb24gcGFpcmluZy1ob2xkIGxlZnRvdmVyIGxlYXNlIGRvZXMgbm90IHBvc3QgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCwgcG9zdGVkIH0gPSBwYWlyaW5nSG9sZExlZnRvdmVyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRhd2FpdCByZXNvbHZlUXVlc3Rpb24oaG9zdCwgJ3R1cm4tMScsICdyZXEtMScsIHsgcTE6IHsgc2VsZWN0ZWRMYWJlbHM6IFsnYSddIH0gfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSwgcGFpcmluZ1BlbmRpbmc6IGJvb2xlYW4sIGVuZ2luZVNlc3Npb25SZWFkeSA9IHRydWUpOiB7XG5cdFx0aG9zdDogSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cdFx0cmVzb2x2ZUNvbmZpcm1hdGlvbkNhbGxzOiBudW1iZXI7XG5cdFx0cmVzcG9uZFF1ZXN0aW9uQ2FsbHM6IG51bWJlcjtcblx0XHRkZWxldGVUdXJuQ2FsbHM6IG51bWJlcjtcblx0XHRjYW5jZWxUb29sQ2FsbENhbGxzOiBudW1iZXI7XG5cdFx0cG9zdGVkOiBudW1iZXI7XG5cdFx0Zm9jdXNlZDogbnVtYmVyO1xuXHR9IHtcblx0XHRjb25zdCBzdGF0ZSA9IHsgcmVzb2x2ZUNvbmZpcm1hdGlvbkNhbGxzOiAwLCByZXNwb25kUXVlc3Rpb25DYWxsczogMCwgZGVsZXRlVHVybkNhbGxzOiAwLCBjYW5jZWxUb29sQ2FsbENhbGxzOiAwLCBwb3N0ZWQ6IDAsIGZvY3VzZWQ6IDAgfTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLWxlZnRvdmVyJyxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKCk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0c3RhdGUucG9zdGVkKys7XG5cdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlLCBjb3JyZWxhdGlvbjogeyBpZDogJ3gnIH0gfTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGVuZ2luZVNlc3Npb25SZWFkeSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJlc29sdmVDb25maXJtYXRpb246ICgpID0+IHtcblx0XHRcdFx0XHRzdGF0ZS5yZXNvbHZlQ29uZmlybWF0aW9uQ2FsbHMrKztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVzcG9uZFF1ZXN0aW9uOiAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUucmVzcG9uZFF1ZXN0aW9uQ2FsbHMrKztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0ZGVsZXRlVHVybjogKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLmRlbGV0ZVR1cm5DYWxscysrO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjYW5jZWxUb29sQ2FsbDogKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLmNhbmNlbFRvb2xDYWxsQ2FsbHMrKztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzVGltZWxpbmVSZWNvcmQ6ICgpID0+IHsgc3RhdGUuZm9jdXNlZCsrOyB9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhvc3Q6IGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdCxcblx0XHRcdGdldCByZXNvbHZlQ29uZmlybWF0aW9uQ2FsbHMoKSB7IHJldHVybiBzdGF0ZS5yZXNvbHZlQ29uZmlybWF0aW9uQ2FsbHM7IH0sXG5cdFx0XHRnZXQgcmVzcG9uZFF1ZXN0aW9uQ2FsbHMoKSB7IHJldHVybiBzdGF0ZS5yZXNwb25kUXVlc3Rpb25DYWxsczsgfSxcblx0XHRcdGdldCBkZWxldGVUdXJuQ2FsbHMoKSB7IHJldHVybiBzdGF0ZS5kZWxldGVUdXJuQ2FsbHM7IH0sXG5cdFx0XHRnZXQgY2FuY2VsVG9vbENhbGxDYWxscygpIHsgcmV0dXJuIHN0YXRlLmNhbmNlbFRvb2xDYWxsQ2FsbHM7IH0sXG5cdFx0XHRnZXQgcG9zdGVkKCkgeyByZXR1cm4gc3RhdGUucG9zdGVkOyB9LFxuXHRcdFx0Z2V0IGZvY3VzZWQoKSB7IHJldHVybiBzdGF0ZS5mb2N1c2VkOyB9LFxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIHJlc29sdmVDb25maXJtYXRpb24gc2tpcHMgdW5hcnkgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIHRydWUpO1xuXHRcdGF3YWl0IHJlc29sdmVDb25maXJtYXRpb24oZml4dHVyZS5ob3N0LCAndHVybi0xJywgJ2FsbG93ZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5yZXNvbHZlQ29uZmlybWF0aW9uQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZm9jdXNlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIHJlc29sdmVRdWVzdGlvbiBza2lwcyB1bmFyeSBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgdHJ1ZSk7XG5cdFx0YXdhaXQgcmVzb2x2ZVF1ZXN0aW9uKGZpeHR1cmUuaG9zdCwgJ3R1cm4tMScsICdyZXEtMScsIHsgcTE6IHsgc2VsZWN0ZWRMYWJlbHM6IFsnYSddIH0gfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucmVzcG9uZFF1ZXN0aW9uQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZm9jdXNlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIGRlbGV0ZVR1cm4gc2tpcHMgdW5hcnkgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIHRydWUpO1xuXHRcdGRlbGV0ZVR1cm4oZml4dHVyZS5ob3N0LCAndHVybi0xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZGVsZXRlVHVybkNhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBjYW5jZWxUb29sQ2FsbCBza2lwcyB1bmFyeSBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgdHJ1ZSk7XG5cdFx0Y2FuY2VsVG9vbENhbGwoZml4dHVyZS5ob3N0LCB7IGlkOiAnZS1ydW4nLCB0b29sQ2FsbElkOiAndGMtMScsIGFnZW50SWQ6ICdzdWI6YScgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuY2FuY2VsVG9vbENhbGxDYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcmV0cnlFcnJvciBza2lwcyBwb3N0Qm91bmQgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIHRydWUpO1xuXHRcdHJldHJ5RXJyb3IoZml4dHVyZS5ob3N0LCB7IGlkOiAnbXNnLTEnLCB0dXJuSWQ6ICd0dXJuLTEnLCBhZ2VudElkOiAncm9vdCcgfSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIHdpdGhvdXQgcGFpcmluZyByZXNvbHZlQ29uZmlybWF0aW9uIHN0aWxsIGZvcndhcmRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCBmYWxzZSk7XG5cdFx0YXdhaXQgcmVzb2x2ZUNvbmZpcm1hdGlvbihmaXh0dXJlLmhvc3QsICd0dXJuLTEnLCAnYWxsb3dlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnJlc29sdmVDb25maXJtYXRpb25DYWxscywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5mb2N1c2VkLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCB3aXRob3V0IHBhaXJpbmcgcmVzb2x2ZVF1ZXN0aW9uIHN0aWxsIGZvcndhcmRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCBmYWxzZSk7XG5cdFx0YXdhaXQgcmVzb2x2ZVF1ZXN0aW9uKGZpeHR1cmUuaG9zdCwgJ3R1cm4tMScsICdyZXEtMScsIHsgcTE6IHsgc2VsZWN0ZWRMYWJlbHM6IFsnYSddIH0gfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucmVzcG9uZFF1ZXN0aW9uQ2FsbHMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZm9jdXNlZCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgd2l0aG91dCBwYWlyaW5nIGRlbGV0ZVR1cm4gc3RpbGwgZm9yd2FyZHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIHRydWUpO1xuXHRcdGRlbGV0ZVR1cm4oZml4dHVyZS5ob3N0LCAndHVybi0xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZGVsZXRlVHVybkNhbGxzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIHdpdGhvdXQgcGFpcmluZyBjYW5jZWxUb29sQ2FsbCBzdGlsbCBmb3J3YXJkcycsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgdHJ1ZSk7XG5cdFx0Y2FuY2VsVG9vbENhbGwoZml4dHVyZS5ob3N0LCB7IGlkOiAnZS1ydW4nLCB0b29sQ2FsbElkOiAndGMtMScsIGFnZW50SWQ6ICdzdWI6YScgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuY2FuY2VsVG9vbENhbGxDYWxscywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCB3aXRob3V0IHBhaXJpbmcgcmV0cnlFcnJvciBzdGlsbCBwb3N0cyBjb250aW51ZUdlbmVyYXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIHRydWUpO1xuXHRcdHJldHJ5RXJyb3IoZml4dHVyZS5ob3N0LCB7IGlkOiAnbXNnLTEnLCB0dXJuSWQ6ICd0dXJuLTEnLCBhZ2VudElkOiAncm9vdCcgfSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgcmVzb2x2ZUNvbmZpcm1hdGlvbiBza2lwcyB1bmFyeSBhbmQgc2hvd3Mgc2Vzc2lvbl9ub3RfcmVhZHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIGZhbHNlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0YXdhaXQgcmVzb2x2ZUNvbmZpcm1hdGlvbihmaXh0dXJlLmhvc3QsICd0dXJuLTEnLCAnYWxsb3dlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnJlc29sdmVDb25maXJtYXRpb25DYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5mb2N1c2VkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ3Nlc3Npb25fbm90X3JlYWR5J10pO1xuXHR9KTtcblxuXHR0ZXN0KCdLRUVQIGxlZnRvdmVyIGxpc3QtZmFpbCByZXNvbHZlUXVlc3Rpb24gc2tpcHMgdW5hcnkgYW5kIHNob3dzIHNlc3Npb25fbm90X3JlYWR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCBmYWxzZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGF3YWl0IHJlc29sdmVRdWVzdGlvbihmaXh0dXJlLmhvc3QsICd0dXJuLTEnLCAncmVxLTEnLCB7IHExOiB7IHNlbGVjdGVkTGFiZWxzOiBbJ2EnXSB9IH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnJlc3BvbmRRdWVzdGlvbkNhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmZvY3VzZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnc2Vzc2lvbl9ub3RfcmVhZHknXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIGRlbGV0ZVR1cm4gc2tpcHMgdW5hcnkgYW5kIHNob3dzIHNlc3Npb25fbm90X3JlYWR5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCBmYWxzZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGRlbGV0ZVR1cm4oZml4dHVyZS5ob3N0LCAndHVybi0xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZGVsZXRlVHVybkNhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnc2Vzc2lvbl9ub3RfcmVhZHknXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIGNhbmNlbFRvb2xDYWxsIHNraXBzIHVuYXJ5IGFuZCBzaG93cyBzZXNzaW9uX25vdF9yZWFkeScsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgZmFsc2UsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRjYW5jZWxUb29sQ2FsbChmaXh0dXJlLmhvc3QsIHsgaWQ6ICdlLXJ1bicsIHRvb2xDYWxsSWQ6ICd0Yy0xJywgYWdlbnRJZDogJ3N1YjphJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5jYW5jZWxUb29sQ2FsbENhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnc2Vzc2lvbl9ub3RfcmVhZHknXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIHJldHJ5RXJyb3Igc2tpcHMgcG9zdEJvdW5kIGFuZCBzaG93cyBzZXNzaW9uX25vdF9yZWFkeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgZmFsc2UsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRyZXRyeUVycm9yKGZpeHR1cmUuaG9zdCwgeyBpZDogJ21zZy0xJywgdHVybklkOiAndHVybi0xJywgYWdlbnRJZDogJ3Jvb3QnIH0pO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ3Nlc3Npb25fbm90X3JlYWR5J10pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXRyeUVycm9yIHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBsZWFzZSBkb2VzIG5vdCBwb3N0IGFuZCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QsIHBvc3RlZCB9ID0gcGFpcmluZ0hvbGRMZWZ0b3ZlcldyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0cmV0cnlFcnJvcihob3N0LCB7IGlkOiAnbXNnLTEnLCB0dXJuSWQ6ICd0dXJuLTEnLCBhZ2VudElkOiAncm9vdCcgfSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHBhaXJpbmdIb2xkQ29tcG9zZXJXcml0ZUhvc3QoZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSk6IHtcblx0XHRob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdDtcblx0XHRwb3N0ZWQ6IG51bWJlcjtcblx0XHRlbnF1ZXVlQ2FsbHM6IG51bWJlcjtcblx0XHR0dXJuV3JpdGVzOiBudW1iZXI7XG5cdFx0cXVldWVXcml0ZXM6IG51bWJlcjtcblx0fSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB7IHBvc3RlZDogMCwgZW5xdWV1ZUNhbGxzOiAwLCB0dXJuV3JpdGVzOiAwLCBxdWV1ZVdyaXRlczogMCB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0c3VibWl0SW5GbGlnaHQ6IGZhbHNlLFxuXHRcdFx0ZWRpdGluZ1R1cm5JZDogJ3R1cm4tMScsXG5cdFx0XHRlZGl0aW5nUXVldWVJdGVtSWQ6ICdxMScsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdsZWZ0b3ZlciBkcmFmdCcgfSxcblx0XHRcdHNlbmRCdXR0b246IHsgZW5hYmxlZDogdHJ1ZSB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLWxlZnRvdmVyJyxcblx0XHRcdGdldEVkaXRpbmdRdWV1ZUl0ZW06ICgpID0+ICh7IGlkOiAncTEnLCBjb250ZW50OiAncXVldWVkJyB9KSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHtcblx0XHRcdFx0cG9zdDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLnBvc3RlZCsrO1xuXHRcdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlLCBjb3JyZWxhdGlvbjogeyBpZDogJ3gnIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHRcdGVucXVldWVNZXNzYWdlUXVldWVJdGVtOiAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUuZW5xdWV1ZUNhbGxzKys7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHVwZGF0ZVVzZXJUdXJuVGV4dDogKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLnR1cm5Xcml0ZXMrKztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dXBkYXRlTWVzc2FnZVF1ZXVlSXRlbUNvbnRlbnQ6ICgpID0+IHtcblx0XHRcdFx0XHRzdGF0ZS5xdWV1ZVdyaXRlcysrO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHRcdGV4aXRDb21wb3NlckVkaXQ6ICgpID0+IHsgfSxcblx0XHRcdHJlbmRlckluYm94U3RhdHVzOiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVTZW5kRW5hYmxlZDogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlQ29udmVyc2F0aW9uUGhhc2U6ICgpID0+IHsgfSxcblx0XHRcdHJlc2V0SW5wdXRIaXN0b3J5QnJvd3NlOiAoKSA9PiB7IH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRob3N0OiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsXG5cdFx0XHRnZXQgcG9zdGVkKCkgeyByZXR1cm4gc3RhdGUucG9zdGVkOyB9LFxuXHRcdFx0Z2V0IGVucXVldWVDYWxscygpIHsgcmV0dXJuIHN0YXRlLmVucXVldWVDYWxsczsgfSxcblx0XHRcdGdldCB0dXJuV3JpdGVzKCkgeyByZXR1cm4gc3RhdGUudHVybldyaXRlczsgfSxcblx0XHRcdGdldCBxdWV1ZVdyaXRlcygpIHsgcmV0dXJuIHN0YXRlLnF1ZXVlV3JpdGVzOyB9LFxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCd1cGRhdGVTZW5kRW5hYmxlZCBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZHJhZnQgZGlzYWJsZXMgU2VuZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0IH0gPSBwYWlyaW5nSG9sZENvbXBvc2VyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRjb25zdCBjaHJvbWVIb3N0ID0gaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdHVwZGF0ZVNlbmRFbmFibGVkKGNocm9tZUhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWVIb3N0LnNlbmRCdXR0b24uZW5hYmxlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnc3VibWl0RHJhZnQgcGFpcmluZy1ob2xkIGxlZnRvdmVyIGRyYWZ0IGRvZXMgbm90IGVucXVldWUgb3IgcG9zdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0LCBwb3N0ZWQsIGVucXVldWVDYWxscyB9ID0gcGFpcmluZ0hvbGRDb21wb3NlcldyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0YXdhaXQgc3VibWl0RHJhZnQoaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVucXVldWVDYWxscywgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSwgJ2xlZnRvdmVyIGRyYWZ0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVUdXJuRWRpdCBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZG9lcyBub3Qgd3JpdGUgYW5kIHN0YXlzIGluIGVkaXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCwgdHVybldyaXRlcyB9ID0gcGFpcmluZ0hvbGRDb21wb3NlcldyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0aG9zdC5jb21wb3NlclBvbGljeSA9ICd0dXJuRWRpdCc7XG5cdFx0c2F2ZVR1cm5FZGl0KGhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0dXJuV3JpdGVzLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZWRpdGluZ1R1cm5JZCwgJ3R1cm4tMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5kb2NrVGV4dGFyZWEudmFsdWUsICdsZWZ0b3ZlciBkcmFmdCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlUXVldWVFZGl0IHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBkb2VzIG5vdCB3cml0ZSBhbmQgc3RheXMgaW4gZWRpdCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0LCBxdWV1ZVdyaXRlcyB9ID0gcGFpcmluZ0hvbGRDb21wb3NlcldyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0aG9zdC5jb21wb3NlclBvbGljeSA9ICdxdWV1ZUVkaXQnO1xuXHRcdHNhdmVRdWV1ZUVkaXQoaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXVlV3JpdGVzLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZWRpdGluZ1F1ZXVlSXRlbUlkLCAncTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5jb21wb3NlclBvbGljeSwgJ3F1ZXVlRWRpdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSwgJ2xlZnRvdmVyIGRyYWZ0Jyk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdChvcHRpb25zOiB7XG5cdFx0cGFpcmluZ1BlbmRpbmc6IGJvb2xlYW47XG5cdFx0ZW5naW5lQ29ubmVjdGVkOiBib29sZWFuO1xuXHRcdGVuZ2luZVNlc3Npb25SZWFkeT86IGJvb2xlYW47XG5cdFx0ZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXTtcblx0fSk6IHtcblx0XHRob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdDtcblx0XHRwb3N0ZWQ6IG51bWJlcjtcblx0XHRlbnF1ZXVlQ2FsbHM6IG51bWJlcjtcblx0XHR0dXJuV3JpdGVzOiBudW1iZXI7XG5cdFx0cXVldWVXcml0ZXM6IG51bWJlcjtcblx0XHRleGl0ZWQ6IG51bWJlcjtcblx0fSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB7IHBvc3RlZDogMCwgZW5xdWV1ZUNhbGxzOiAwLCB0dXJuV3JpdGVzOiAwLCBxdWV1ZVdyaXRlczogMCwgZXhpdGVkOiAwIH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScgYXMgY29uc3QsXG5cdFx0XHRzdWJtaXRJbkZsaWdodDogZmFsc2UsXG5cdFx0XHRmaWx0ZXJBZ2VudElkOiB1bmRlZmluZWQsXG5cdFx0XHRjYXRhbG9nTW9kZWxJZHM6IFsnJ10sXG5cdFx0XHRtb2RlbFNlbGVjdGVkSW5kZXg6IDAsXG5cdFx0XHRkcmFmdHM6IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCksXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogeyBnZXRWYWx1ZTogKCkgPT4gZmFsc2UgfSxcblx0XHRcdGVkaXRpbmdUdXJuSWQ6ICd0dXJuLTEnLFxuXHRcdFx0ZWRpdGluZ1F1ZXVlSXRlbUlkOiAncTEnLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAnbGVmdG92ZXIgZHJhZnQnIH0sXG5cdFx0XHRzZW5kQnV0dG9uOiB7IGVuYWJsZWQ6IHRydWUgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy1sZWZ0b3ZlcicsXG5cdFx0XHRnZXRFZGl0aW5nUXVldWVJdGVtOiAoKSA9PiAoeyBpZDogJ3ExJywgY29udGVudDogJ3F1ZXVlZCcgfSksXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7XG5cdFx0XHRcdHBvc3Q6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRzdGF0ZS5wb3N0ZWQrKztcblx0XHRcdFx0XHRyZXR1cm4geyBhY2NlcHRlZDogdHJ1ZSwgY29ycmVsYXRpb246IHsgaWQ6ICd4JyB9IH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IG9wdGlvbnMuZW5naW5lQ29ubmVjdGVkLFxuXHRcdFx0XHQuLi4ob3B0aW9ucy5lbmdpbmVTZXNzaW9uUmVhZHkgPT09IHVuZGVmaW5lZCA/IHt9IDogeyBpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gb3B0aW9ucy5lbmdpbmVTZXNzaW9uUmVhZHkgfSksXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRlbnF1ZXVlTWVzc2FnZVF1ZXVlSXRlbTogKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLmVucXVldWVDYWxscysrO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR1cGRhdGVVc2VyVHVyblRleHQ6ICgpID0+IHtcblx0XHRcdFx0XHRzdGF0ZS50dXJuV3JpdGVzKys7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHVwZGF0ZU1lc3NhZ2VRdWV1ZUl0ZW1Db250ZW50OiAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUucXVldWVXcml0ZXMrKztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0XHRyZWxlYXNlTWVzc2FnZVF1ZXVlSXRlbUhvbGQ6ICgpID0+IHsgfSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogb3B0aW9ucy5wYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0OiAoKSA9PiB7IHN0YXRlLmV4aXRlZCsrOyB9LFxuXHRcdFx0cmVuZGVySW5ib3hTdGF0dXM6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZVNlbmRFbmFibGVkOiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVDb252ZXJzYXRpb25QaGFzZTogKCkgPT4geyB9LFxuXHRcdFx0cmVzZXRJbnB1dEhpc3RvcnlCcm93c2U6ICgpID0+IHsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRvcHRpb25zLmZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aG9zdDogaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0LFxuXHRcdFx0Z2V0IHBvc3RlZCgpIHsgcmV0dXJuIHN0YXRlLnBvc3RlZDsgfSxcblx0XHRcdGdldCBlbnF1ZXVlQ2FsbHMoKSB7IHJldHVybiBzdGF0ZS5lbnF1ZXVlQ2FsbHM7IH0sXG5cdFx0XHRnZXQgdHVybldyaXRlcygpIHsgcmV0dXJuIHN0YXRlLnR1cm5Xcml0ZXM7IH0sXG5cdFx0XHRnZXQgcXVldWVXcml0ZXMoKSB7IHJldHVybiBzdGF0ZS5xdWV1ZVdyaXRlczsgfSxcblx0XHRcdGdldCBleGl0ZWQoKSB7IHJldHVybiBzdGF0ZS5leGl0ZWQ7IH0sXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIHN1Ym1pdERyYWZ0IHNraXBzIHBvc3RCb3VuZCBhbmQgc2hvd3Mgc2Vzc2lvbl9ub3RfcmVhZHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3ZlckNvbXBvc2VySGFuZGxlckhvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lQ29ubmVjdGVkOiB0cnVlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBmYWxzZSxcblx0XHRcdGZhaWx1cmVzLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGF3YWl0IHN1Ym1pdERyYWZ0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5lbnF1ZXVlQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3VibWl0SW5GbGlnaHQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ3Nlc3Npb25fbm90X3JlYWR5J10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAnbGVmdG92ZXIgZHJhZnQnKTtcblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgc2F2ZVR1cm5FZGl0IHNraXBzIHVwZGF0ZVVzZXJUdXJuVGV4dCBhbmQgc3RheXMgaW4gZWRpdCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVDb25uZWN0ZWQ6IHRydWUsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IGZhbHNlLFxuXHRcdFx0ZmFpbHVyZXMsXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0Zml4dHVyZS5ob3N0LmNvbXBvc2VyUG9saWN5ID0gJ3R1cm5FZGl0Jztcblx0XHRzYXZlVHVybkVkaXQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS50dXJuV3JpdGVzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5leGl0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnc2Vzc2lvbl9ub3RfcmVhZHknXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5lZGl0aW5nVHVybklkLCAndHVybi0xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5jb21wb3NlclBvbGljeSwgJ3R1cm5FZGl0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5kb2NrVGV4dGFyZWEudmFsdWUsICdsZWZ0b3ZlciBkcmFmdCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdLRUVQIGxlZnRvdmVyIGxpc3QtZmFpbCBzYXZlUXVldWVFZGl0IHNraXBzIHF1ZXVlIHdyaXRlIGFuZCBzdGF5cyBpbiBlZGl0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJDb21wb3NlckhhbmRsZXJIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZUNvbm5lY3RlZDogdHJ1ZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogZmFsc2UsXG5cdFx0XHRmYWlsdXJlcyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRmaXh0dXJlLmhvc3QuY29tcG9zZXJQb2xpY3kgPSAncXVldWVFZGl0Jztcblx0XHRzYXZlUXVldWVFZGl0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucXVldWVXcml0ZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmV4aXRlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydzZXNzaW9uX25vdF9yZWFkeSddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmVkaXRpbmdRdWV1ZUl0ZW1JZCwgJ3ExJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5jb21wb3NlclBvbGljeSwgJ3F1ZXVlRWRpdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAnbGVmdG92ZXIgZHJhZnQnKTtcblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBzdWJtaXREcmFmdCBza2lwcyBwb3N0Qm91bmQgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3ZlckNvbXBvc2VySGFuZGxlckhvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IHRydWUsXG5cdFx0XHRlbmdpbmVDb25uZWN0ZWQ6IHRydWUsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0XHRmYWlsdXJlcyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIHRydWUpO1xuXHRcdGF3YWl0IHN1Ym1pdERyYWZ0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5lbnF1ZXVlQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3VibWl0SW5GbGlnaHQsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgc2F2ZVR1cm5FZGl0IHNraXBzIHVwZGF0ZVVzZXJUdXJuVGV4dCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogdHJ1ZSxcblx0XHRcdGVuZ2luZUNvbm5lY3RlZDogdHJ1ZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHRcdGZhaWx1cmVzLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCB0cnVlKTtcblx0XHRmaXh0dXJlLmhvc3QuY29tcG9zZXJQb2xpY3kgPSAndHVybkVkaXQnO1xuXHRcdHNhdmVUdXJuRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnR1cm5Xcml0ZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmV4aXRlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIHNhdmVRdWV1ZUVkaXQgc2tpcHMgcXVldWUgd3JpdGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3ZlckNvbXBvc2VySGFuZGxlckhvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IHRydWUsXG5cdFx0XHRlbmdpbmVDb25uZWN0ZWQ6IHRydWUsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0XHRmYWlsdXJlcyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgdHJ1ZSk7XG5cdFx0Zml4dHVyZS5ob3N0LmNvbXBvc2VyUG9saWN5ID0gJ3F1ZXVlRWRpdCc7XG5cdFx0c2F2ZVF1ZXVlRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnF1ZXVlV3JpdGVzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5leGl0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIGxpdmUgc3VibWl0RHJhZnQgc3RpbGwgcG9zdHMgd2hlbiBlbmdpbmUgc2Vzc2lvbiBpcyByZWFkeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVDb25uZWN0ZWQ6IHRydWUsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0XHRmYWlsdXJlcyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGF3YWl0IHN1Ym1pdERyYWZ0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5lbnF1ZXVlQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSwgJycpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgbGl2ZSBzYXZlVHVybkVkaXQgc3RpbGwgd3JpdGVzIHdoZW4gZW5naW5lIHNlc3Npb24gaXMgcmVhZHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3ZlckNvbXBvc2VySGFuZGxlckhvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lQ29ubmVjdGVkOiB0cnVlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdFx0ZmFpbHVyZXMsXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGZpeHR1cmUuaG9zdC5jb21wb3NlclBvbGljeSA9ICd0dXJuRWRpdCc7XG5cdFx0c2F2ZVR1cm5FZGl0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUudHVybldyaXRlcywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZXhpdGVkLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCBsaXZlIHNhdmVRdWV1ZUVkaXQgc3RpbGwgd3JpdGVzIHdoZW4gZW5naW5lIHNlc3Npb24gaXMgcmVhZHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3ZlckNvbXBvc2VySGFuZGxlckhvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lQ29ubmVjdGVkOiB0cnVlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdFx0ZmFpbHVyZXMsXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGZpeHR1cmUuaG9zdC5jb21wb3NlclBvbGljeSA9ICdxdWV1ZUVkaXQnO1xuXHRcdHNhdmVRdWV1ZUVkaXQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5xdWV1ZVdyaXRlcywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZXhpdGVkLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVR1cm4gcGFpcmluZy1ob2xkIGxlZnRvdmVyIGRvZXMgbm90IHdyaXRlIGFuZCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QsIHBvc3RlZCB9ID0gcGFpcmluZ0hvbGRMZWZ0b3ZlcldyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0bGV0IGRlbGV0ZUNhbGxzID0gMDtcblx0XHQoaG9zdCBhcyB1bmtub3duIGFzIHsgc3R1YlNlcnZpY2U6IHsgZGVsZXRlVHVybjogKCkgPT4gYm9vbGVhbiB9IH0pLnN0dWJTZXJ2aWNlLmRlbGV0ZVR1cm4gPSAoKSA9PiB7XG5cdFx0XHRkZWxldGVDYWxscysrO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblx0XHRkZWxldGVUdXJuKGhvc3QsICd0dXJuLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVsZXRlQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnYmVnaW5UdXJuRWRpdCBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZG9lcyBub3QgZW50ZXIgZWRpdCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0IH0gPSBwYWlyaW5nSG9sZENvbXBvc2VyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRjb25zdCBjaHJvbWVIb3N0ID0gaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdGNocm9tZUhvc3QuY29tcG9zZXJQb2xpY3kgPSAnY29tcG9zZSc7XG5cdFx0Y2hyb21lSG9zdC5lZGl0aW5nVHVybklkID0gdW5kZWZpbmVkO1xuXHRcdGJlZ2luVHVybkVkaXQoY2hyb21lSG9zdCwgJ3R1cm4tMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWVIb3N0LmNvbXBvc2VyUG9saWN5LCAnY29tcG9zZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWVIb3N0LmVkaXRpbmdUdXJuSWQsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBrZWVwTGVmdG92ZXJMaXN0RmFpbFdyaXRlSG9zdChmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdKToge1xuXHRcdGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXHR9IHtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdjb21wb3NlJyBhcyBjb25zdCxcblx0XHRcdHN1Ym1pdEluRmxpZ2h0OiBmYWxzZSxcblx0XHRcdGVkaXRpbmdUdXJuSWQ6IHVuZGVmaW5lZCBhcyBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0XHRlZGl0aW5nUXVldWVJdGVtSWQ6IHVuZGVmaW5lZCBhcyBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdsZWZ0b3ZlciBkcmFmdCcgfSxcblx0XHRcdHNlbmRCdXR0b246IHsgZW5hYmxlZDogdHJ1ZSB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLWxlZnRvdmVyJyxcblx0XHRcdGlzUHJlRmlyc3Q6ICgpID0+IGZhbHNlLFxuXHRcdFx0aW5ib3hPdmVybGF5OiB7IGNsb3NlTGlzdFBhbmVsOiAoKSA9PiB7IH0gfSxcblx0XHRcdGNvbXBvc2VyOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcblx0XHRcdHRpbWVsaW5lVHJlZTogeyBzZXRFZGl0aW5nVHVybklkOiAoKSA9PiB7IH0gfSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gW3sgaWQ6ICd0dXJuLTEnLCBraW5kOiAndXNlcicsIHRleHQ6ICdsZWZ0b3ZlciB1c2VyJyB9XSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyB9LFxuXHRcdFx0cmVuZGVySW5ib3hTdGF0dXM6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZVNlbmRFbmFibGVkOiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVDb252ZXJzYXRpb25QaGFzZTogKCkgPT4geyB9LFxuXHRcdFx0cmVzZXRJbnB1dEhpc3RvcnlCcm93c2U6ICgpID0+IHsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHsgaG9zdDogaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0IH07XG5cdH1cblxuXHR0ZXN0KCdLRUVQIGxlZnRvdmVyIGxpc3QtZmFpbCB3cml0ZXNFbmFibGVkIGlzIGZhbHNlIGFuZCBiZWdpblR1cm5FZGl0IGRvZXMgbm90IGVudGVyIGVkaXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCB9ID0ga2VlcExlZnRvdmVyTGlzdEZhaWxXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGNvbnN0IGNocm9tZUhvc3QgPSBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1JlYWRpbmdDb2x1bW5Xcml0ZXNFbmFibGVkKGNocm9tZUhvc3QpLCBmYWxzZSk7XG5cdFx0Y2hyb21lSG9zdC5jb21wb3NlclBvbGljeSA9ICdjb21wb3NlJztcblx0XHRjaHJvbWVIb3N0LmVkaXRpbmdUdXJuSWQgPSB1bmRlZmluZWQ7XG5cdFx0YmVnaW5UdXJuRWRpdChjaHJvbWVIb3N0LCAndHVybi0xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZUhvc3QuY29tcG9zZXJQb2xpY3ksICdjb21wb3NlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZUhvc3QuZWRpdGluZ1R1cm5JZCwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhaXJpbmctaG9sZCB3cml0ZXNFbmFibGVkIHN0YXlzIGZhbHNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QgfSA9IHBhaXJpbmdIb2xkQ29tcG9zZXJXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGhvc3QudWFDb25uZWN0aW9uKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzUmVhZGluZ0NvbHVtbldyaXRlc0VuYWJsZWQoaG9zdCksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIGxpdmUgd3JpdGVzRW5hYmxlZCBzdGF5cyB0cnVlIHdoZW4gZW5naW5lIHNlc3Npb24gaXMgcmVhZHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJyBhcyBjb25zdCwgcGF0aDogJ2xvb3BiYWNrJyBhcyBjb25zdCB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzUmVhZGluZ0NvbHVtbldyaXRlc0VuYWJsZWQoaG9zdCksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdiZWdpblF1ZXVlRWRpdCBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZG9lcyBub3QgZW50ZXIgZWRpdCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0IH0gPSBwYWlyaW5nSG9sZENvbXBvc2VyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRjb25zdCBjaHJvbWVIb3N0ID0gaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdGNocm9tZUhvc3QuY29tcG9zZXJQb2xpY3kgPSAnY29tcG9zZSc7XG5cdFx0Y2hyb21lSG9zdC5lZGl0aW5nUXVldWVJdGVtSWQgPSB1bmRlZmluZWQ7XG5cdFx0YmVnaW5RdWV1ZUVkaXQoY2hyb21lSG9zdCwgJ3ExJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZUhvc3QuY29tcG9zZXJQb2xpY3ksICdjb21wb3NlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZUhvc3QuZWRpdGluZ1F1ZXVlSXRlbUlkLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlU2Vzc2lvbkJhcldyaXRlQ2hyb21lIHBhaXJpbmctaG9sZCBkaXNhYmxlcyB0aXRsZSBkZWxldGUgYW5kIG5ldycsICgpID0+IHtcblx0XHRjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRcdGNvbnN0IG5ld0J1dHRvbiA9IHsgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGRlbGV0ZUJ1dHRvbiA9IHsgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRzZXNzaW9uVGl0bGVCdXR0b246IHRpdGxlLFxuXHRcdFx0bmV3U2Vzc2lvbkJ1dHRvbjogbmV3QnV0dG9uLFxuXHRcdFx0ZGVsZXRlU2Vzc2lvbkJ1dHRvbjogZGVsZXRlQnV0dG9uLFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSksXG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJIb3N0O1xuXHRcdHVwZGF0ZVNlc3Npb25CYXJXcml0ZUNocm9tZShob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGUuZGlzYWJsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3QnV0dG9uLmVuYWJsZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVsZXRlQnV0dG9uLmVuYWJsZWQsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlU2Vzc2lvbkJhcldyaXRlQ2hyb21lIGxlZnRvdmVyLWxvb2tzLWxpdmUga2VlcHMgdGl0bGUgZGVsZXRlIGFuZCBuZXcgZGlzYWJsZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0XHRjb25zdCBuZXdCdXR0b24gPSB7IGVuYWJsZWQ6IHRydWUgfTtcblx0XHRjb25zdCBkZWxldGVCdXR0b24gPSB7IGVuYWJsZWQ6IHRydWUgfTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0c2Vzc2lvblRpdGxlQnV0dG9uOiB0aXRsZSxcblx0XHRcdG5ld1Nlc3Npb25CdXR0b246IG5ld0J1dHRvbixcblx0XHRcdGRlbGV0ZVNlc3Npb25CdXR0b246IGRlbGV0ZUJ1dHRvbixcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFySG9zdDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlLCAnbGVmdG92ZXItbG9va3MtbGl2ZSBmaXh0dXJlIG11c3Qga2VlcCBpc0VuZ2luZUNvbm5lY3RlZCgpPT09dHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGhvc3QudWFDb25uZWN0aW9uKSwgdHJ1ZSk7XG5cdFx0dXBkYXRlU2Vzc2lvbkJhcldyaXRlQ2hyb21lKGhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZS5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXdCdXR0b24uZW5hYmxlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVCdXR0b24uZW5hYmxlZCwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVTZXNzaW9uQmFyV3JpdGVDaHJvbWUgS0VFUCBsZWZ0b3ZlciBkaXNhYmxlcyB0aXRsZSBkZWxldGUgYW5kIG5ldycsICgpID0+IHtcblx0XHRjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRcdGNvbnN0IG5ld0J1dHRvbiA9IHsgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGRlbGV0ZUJ1dHRvbiA9IHsgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRzZXNzaW9uVGl0bGVCdXR0b246IHRpdGxlLFxuXHRcdFx0bmV3U2Vzc2lvbkJ1dHRvbjogbmV3QnV0dG9uLFxuXHRcdFx0ZGVsZXRlU2Vzc2lvbkJ1dHRvbjogZGVsZXRlQnV0dG9uLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0U2Vzc2lvbnM6ICgpID0+IFt7IGlkOiAndWEtYScsIHRpdGxlOiAnQScgfV0sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFySG9zdDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0dXBkYXRlU2Vzc2lvbkJhcldyaXRlQ2hyb21lKGhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZS5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXdCdXR0b24uZW5hYmxlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVCdXR0b24uZW5hYmxlZCwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVTZXNzaW9uQmFyV3JpdGVDaHJvbWUgY29ubmVjdGVkIGxpdmUga2VlcHMgdGl0bGUgZGVsZXRlIGFuZCBuZXcgZW5hYmxlZCcsICgpID0+IHtcblx0XHRjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRcdGNvbnN0IG5ld0J1dHRvbiA9IHsgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGRlbGV0ZUJ1dHRvbiA9IHsgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRzZXNzaW9uVGl0bGVCdXR0b246IHRpdGxlLFxuXHRcdFx0bmV3U2Vzc2lvbkJ1dHRvbjogbmV3QnV0dG9uLFxuXHRcdFx0ZGVsZXRlU2Vzc2lvbkJ1dHRvbjogZGVsZXRlQnV0dG9uLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhckhvc3Q7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0dXBkYXRlU2Vzc2lvbkJhcldyaXRlQ2hyb21lKGhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZS5kaXNhYmxlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ2ZhbHNlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0J1dHRvbi5lbmFibGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVsZXRlQnV0dG9uLmVuYWJsZWQsIHRydWUpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBzZXNzaW9uQmFySGFuZGxlckhvc3Qob3B0aW9uczoge1xuXHRcdHBhaXJpbmdQZW5kaW5nOiBib29sZWFuO1xuXHRcdGVuZ2luZVNlc3Npb25SZWFkeTogYm9vbGVhbjtcblx0XHRlbmdpbmVDb25uZWN0ZWQ/OiBib29sZWFuO1xuXHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5PzogYm9vbGVhbjtcblx0fSk6IHtcblx0XHRob3N0OiBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJIb3N0O1xuXHRcdGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW107XG5cdFx0Y3JlYXRlQ2FsbHM6IG51bWJlcltdO1xuXHRcdGRlbGV0ZUNhbGxzOiBudW1iZXJbXTtcblx0XHRyZW5hbWVDYWxsczogbnVtYmVyW107XG5cdFx0ZHJhZnRXcml0ZXM6IHN0cmluZ1tdO1xuXHR9IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgY3JlYXRlQ2FsbHM6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3QgZGVsZXRlQ2FsbHM6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3QgcmVuYW1lQ2FsbHM6IG51bWJlcltdID0gW107XG5cdFx0Y29uc3QgZHJhZnRXcml0ZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgc2Vzc2lvbnMgPSBbeyBpZDogJ3VhLWEnLCB0aXRsZTogJ0EnIH1dO1xuXHRcdGNvbnN0IHRpdGxlQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG5cdFx0dGl0bGVCdXR0b24udGV4dENvbnRlbnQgPSAnQSc7XG5cdFx0Y29uc3QgdGl0bGVJbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2lucHV0Jyk7XG5cdFx0dGl0bGVJbnB1dC5oaWRkZW4gPSB0cnVlO1xuXHRcdGNvbnN0IHRpdGxlTGl2ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHR0aXRsZUxpdmUudGV4dENvbnRlbnQgPSAnQSc7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdHNlc3Npb25UaXRsZUJ1dHRvbjogdGl0bGVCdXR0b24sXG5cdFx0XHRzZXNzaW9uVGl0bGVJbnB1dDogdGl0bGVJbnB1dCxcblx0XHRcdHNlc3Npb25UaXRsZUxpdmU6IHRpdGxlTGl2ZSxcblx0XHRcdHNlc3Npb25UaXRsZUVkaXRpbmc6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblRpdGxlRWRpdFNuYXBzaG90OiAnQScsXG5cdFx0XHRkaWFsb2dTZXJ2aWNlOiB7IGNvbmZpcm06ICgpID0+IFByb21pc2UucmVzb2x2ZSh7IGNvbmZpcm1lZDogdHJ1ZSB9KSB9LFxuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdjb21wb3NlJyxcblx0XHRcdGNvbXBvc2VEcmFmdFNuYXBzaG90OiAnU2F2ZWQgY29tcG9zZSBzbmFwc2hvdCBtdXN0IG5vdCByZXBsYWNlIHRoZSBsaXZlIGRyYWZ0Jyxcblx0XHRcdGRvY2tUZXh0YXJlYTogeyB2YWx1ZTogJ2xlZnRvdmVyIGRyYWZ0JyB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICd1YS1hJyxcblx0XHRcdHdyaXRlQ29tcG9zZXJEcmFmdDogKF9zZXNzaW9uSWQ6IHN0cmluZywgdGV4dDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGRyYWZ0V3JpdGVzLnB1c2godGV4dCk7XG5cdFx0XHR9LFxuXHRcdFx0ZGVsZXRlQ29tcG9zZXJEcmFmdHNGb3JTZXNzaW9uOiAoKSA9PiB7IH0sXG5cdFx0XHRyZWZyZXNoU2Vzc2lvblNlbGVjdE9wdGlvbnM6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZVNlc3Npb25UaXRsZTogKCkgPT4geyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBvcHRpb25zLmVuZ2luZUNvbm5lY3RlZCA/PyB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gb3B0aW9ucy5lbmdpbmVTZXNzaW9uUmVhZHksXG5cdFx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IG9wdGlvbnMuaGFzRW5naW5lQ29ubmVjdGlvbkhpc3RvcnkgPz8gdHJ1ZSxcblx0XHRcdFx0Z2V0QWN0aXZlU2Vzc2lvbklkOiAoKSA9PiAndWEtYScsXG5cdFx0XHRcdGdldEFjdGl2ZVNlc3Npb246ICgpID0+IHNlc3Npb25zWzBdLFxuXHRcdFx0XHRnZXRTZXNzaW9uczogKCkgPT4gc2Vzc2lvbnMsXG5cdFx0XHRcdGNyZWF0ZVNlc3Npb246ICgpID0+IHtcblx0XHRcdFx0XHRjcmVhdGVDYWxscy5wdXNoKDEpO1xuXHRcdFx0XHRcdHNlc3Npb25zLnB1c2goeyBpZDogYHVhLW5ldy0ke2NyZWF0ZUNhbGxzLmxlbmd0aH1gLCB0aXRsZTogJ05ldyBzZXNzaW9uJyB9KTtcblx0XHRcdFx0XHRyZXR1cm4gc2Vzc2lvbnNbc2Vzc2lvbnMubGVuZ3RoIC0gMV0uaWQ7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlbGV0ZVNlc3Npb246IChzZXNzaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdGRlbGV0ZUNhbGxzLnB1c2goMSk7XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSBzZXNzaW9ucy5maW5kSW5kZXgoc2Vzc2lvbiA9PiBzZXNzaW9uLmlkID09PSBzZXNzaW9uSWQpO1xuXHRcdFx0XHRcdGlmIChpbmRleCA8IDApIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2Vzc2lvbnMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVuYW1lU2Vzc2lvbjogKHNlc3Npb25JZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0cmVuYW1lQ2FsbHMucHVzaCgxKTtcblx0XHRcdFx0XHRjb25zdCBzZXNzaW9uID0gc2Vzc2lvbnMuZmluZChlbnRyeSA9PiBlbnRyeS5pZCA9PT0gc2Vzc2lvbklkKTtcblx0XHRcdFx0XHRpZiAoIXNlc3Npb24pIHtcblx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0c2Vzc2lvbi50aXRsZSA9IHRpdGxlO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBvcHRpb25zLnBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0fSxcblx0XHR9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRob3N0OiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFySG9zdCxcblx0XHRcdGZhaWx1cmVzLFxuXHRcdFx0Y3JlYXRlQ2FsbHMsXG5cdFx0XHRkZWxldGVDYWxscyxcblx0XHRcdHJlbmFtZUNhbGxzLFxuXHRcdFx0ZHJhZnRXcml0ZXMsXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgU2Vzc2lvbkJhciBoYW5kbGVycyByZWZ1c2UgdGl0bGUgZWRpdCBjcmVhdGUgZGVsZXRlIHJlbmFtZScsICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gc2Vzc2lvbkJhckhhbmRsZXJIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlLCBlbmdpbmVTZXNzaW9uUmVhZHk6IGZhbHNlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXG5cdFx0YmVnaW5TZXNzaW9uVGl0bGVFZGl0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVFZGl0aW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVCdXR0b24uaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVJbnB1dC5oaWRkZW4sIHRydWUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5mYWlsdXJlcywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5yZW5hbWVDYWxscywgW10pO1xuXG5cdFx0Y3JlYXRlTmV3U2Vzc2lvbihmaXh0dXJlLmhvc3QpO1xuXHRcdGRlbGV0ZUFjdGl2ZVNlc3Npb24oZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuY3JlYXRlQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZGVsZXRlQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZHJhZnRXcml0ZXMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5nZXRTZXNzaW9ucygpLm1hcChzZXNzaW9uID0+IHNlc3Npb24udGl0bGUpLCBbJ0EnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmZhaWx1cmVzLCBbJ3Nlc3Npb25fbm90X3JlYWR5JywgJ3Nlc3Npb25fbm90X3JlYWR5J10pO1xuXG5cdFx0Zml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUVkaXRpbmcgPSB0cnVlO1xuXHRcdGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVCdXR0b24uaGlkZGVuID0gdHJ1ZTtcblx0XHRmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQuaGlkZGVuID0gZmFsc2U7XG5cdFx0Zml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUlucHV0LnZhbHVlID0gJ0hhY2tlZCBsZWZ0b3ZlciB0aXRsZSc7XG5cdFx0Y29tbWl0U2Vzc2lvblRpdGxlRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlRWRpdGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlQnV0dG9uLmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQuaGlkZGVuLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucmVuYW1lQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuY3JlYXRlQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZGVsZXRlQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5nZXRTZXNzaW9ucygpLm1hcChzZXNzaW9uID0+IHNlc3Npb24udGl0bGUpLCBbJ0EnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmZhaWx1cmVzLCBbJ3Nlc3Npb25fbm90X3JlYWR5JywgJ3Nlc3Npb25fbm90X3JlYWR5JywgJ3Nlc3Npb25fbm90X3JlYWR5J10pO1xuXHR9KTtcblxuXHR0ZXN0KCdwYWlyaW5nLWhvbGQgU2Vzc2lvbkJhciBoYW5kbGVycyBzdGlsbCByZWZ1c2UgdGl0bGUgZWRpdCBjcmVhdGUgZGVsZXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBzZXNzaW9uQmFySGFuZGxlckhvc3QoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSwgZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCB0cnVlKTtcblxuXHRcdGJlZ2luU2Vzc2lvblRpdGxlRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlRWRpdGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5mYWlsdXJlcywgW10pO1xuXG5cdFx0Y3JlYXRlTmV3U2Vzc2lvbihmaXh0dXJlLmhvc3QpO1xuXHRcdGRlbGV0ZUFjdGl2ZVNlc3Npb24oZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuY3JlYXRlQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZGVsZXRlQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucmVuYW1lQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZHJhZnRXcml0ZXMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5nZXRTZXNzaW9ucygpLm1hcChzZXNzaW9uID0+IHNlc3Npb24udGl0bGUpLCBbJ0EnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnLCAnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0XHR0ZXN0KCdlbmdpbmUtY2FjaGUgZGlzY29ubmVjdCBTZXNzaW9uQmFyIGhhbmRsZXJzIHJlZnVzZSBjcmVhdGUgd2l0aG91dCBjYXB0dXJpbmcgYSBkcmFmdCcsICgpID0+IHtcblx0XHRcdGNvbnN0IGZpeHR1cmUgPSBzZXNzaW9uQmFySGFuZGxlckhvc3QoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UsIGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSwgZW5naW5lQ29ubmVjdGVkOiBmYWxzZSB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cblx0XHRcdGNyZWF0ZU5ld1Nlc3Npb24oZml4dHVyZS5ob3N0KTtcblx0XHRcdGRlbGV0ZUFjdGl2ZVNlc3Npb24oZml4dHVyZS5ob3N0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5jcmVhdGVDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmRlbGV0ZUNhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZHJhZnRXcml0ZXMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5mYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJywgJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdFx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIGxpdmUgU2Vzc2lvbkJhciBoYW5kbGVycyBzdGlsbCB3cml0ZSB3aGVuIGVuZ2luZSBzZXNzaW9uIGlzIHJlYWR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBzZXNzaW9uQmFySGFuZGxlckhvc3QoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UsIGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblxuXHRcdGJlZ2luU2Vzc2lvblRpdGxlRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlRWRpdGluZywgdHJ1ZSk7XG5cdFx0Zml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUlucHV0LnZhbHVlID0gJ1JlbmFtZWQgbGl2ZSc7XG5cdFx0Y29tbWl0U2Vzc2lvblRpdGxlRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlRWRpdGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5yZW5hbWVDYWxscywgWzFdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKClbMF0udGl0bGUsICdSZW5hbWVkIGxpdmUnKTtcblxuXHRcdGNyZWF0ZU5ld1Nlc3Npb24oZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuY3JlYXRlQ2FsbHMsIFsxXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmRyYWZ0V3JpdGVzLCBbJ2xlZnRvdmVyIGRyYWZ0J10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKS5sZW5ndGgsIDIpO1xuXG5cdFx0YXdhaXQgZGVsZXRlQWN0aXZlU2Vzc2lvbihmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5kZWxldGVDYWxscywgWzFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgndW5jaGFuZ2VkIG9yIGJsYW5rIHNlc3Npb24gdGl0bGUgY29tbWl0IGRvZXMgbm90IGxvb2sgbGlrZSBhIGZhaWxlZCBzZW5kJywgKCkgPT4ge1xuXHRcdGNvbnN0IHVuY2hhbmdlZCA9IHNlc3Npb25CYXJIYW5kbGVySG9zdCh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSwgZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlIH0pO1xuXHRcdGJlZ2luU2Vzc2lvblRpdGxlRWRpdCh1bmNoYW5nZWQuaG9zdCk7XG5cdFx0dW5jaGFuZ2VkLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQudmFsdWUgPSAnICBBICAnO1xuXHRcdGNvbW1pdFNlc3Npb25UaXRsZUVkaXQodW5jaGFuZ2VkLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmNoYW5nZWQuaG9zdC5zZXNzaW9uVGl0bGVFZGl0aW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuY2hhbmdlZC5ob3N0LnNlc3Npb25UaXRsZUJ1dHRvbi5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5jaGFuZ2VkLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQuaGlkZGVuLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5jaGFuZ2VkLmhvc3Quc2Vzc2lvblRpdGxlQnV0dG9uLnRleHRDb250ZW50LCAnQScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodW5jaGFuZ2VkLnJlbmFtZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1bmNoYW5nZWQuZmFpbHVyZXMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5jaGFuZ2VkLmhvc3Quc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKVswXS50aXRsZSwgJ0EnKTtcblxuXHRcdGNvbnN0IGJsYW5rID0gc2Vzc2lvbkJhckhhbmRsZXJIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlLCBlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUgfSk7XG5cdFx0YmVnaW5TZXNzaW9uVGl0bGVFZGl0KGJsYW5rLmhvc3QpO1xuXHRcdGJsYW5rLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQudmFsdWUgPSAnICAgJztcblx0XHRjb21taXRTZXNzaW9uVGl0bGVFZGl0KGJsYW5rLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChibGFuay5ob3N0LnNlc3Npb25UaXRsZUVkaXRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmxhbmsuaG9zdC5zZXNzaW9uVGl0bGVCdXR0b24udGV4dENvbnRlbnQsICdBJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChibGFuay5yZW5hbWVDYWxscywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYmxhbmsuZmFpbHVyZXMsIFsnZW1wdHlfc2Vzc2lvbl90aXRsZSddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmxhbmsuaG9zdC5zdHViU2VydmljZS5nZXRTZXNzaW9ucygpWzBdLnRpdGxlLCAnQScpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXNzaW9uIHRpdGxlIGNvbW1pdCBkdXJpbmcgcGFpcmluZyBob2xkIGRvZXMgbm90IHJlbmFtZScsICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gc2Vzc2lvbkJhckhhbmRsZXJIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IHRydWUsIGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSB9KTtcblx0XHRmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlRWRpdGluZyA9IHRydWU7XG5cdFx0Zml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUJ1dHRvbi5oaWRkZW4gPSB0cnVlO1xuXHRcdGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVJbnB1dC5oaWRkZW4gPSBmYWxzZTtcblx0XHRmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQudmFsdWUgPSAnUmVuYW1lZCB3aGlsZSBwYWlyaW5nJztcblx0XHRjb21taXRTZXNzaW9uVGl0bGVFZGl0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVFZGl0aW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVCdXR0b24uaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVJbnB1dC5oaWRkZW4sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlQnV0dG9uLnRleHRDb250ZW50LCAnQScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5yZW5hbWVDYWxscywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5mYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKVswXS50aXRsZSwgJ0EnKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3Qob3B0aW9ucz86IHtcblx0XHRjYXRhbG9nVG9vbE5hbWVzPzogcmVhZG9ubHkgc3RyaW5nW107XG5cdFx0Y2F0YWxvZ01vZGVsSWRzPzogcmVhZG9ubHkgc3RyaW5nW107XG5cdFx0cGVybWlzc2lvbkluZGV4PzogbnVtYmVyO1xuXHRcdG1vZGVsU2VsZWN0ZWRJbmRleD86IG51bWJlcjtcblx0XHRsYXN0UmVhZGluZ1dpZHRoPzogbnVtYmVyO1xuXHRcdHBhaXJpbmdQZW5kaW5nPzogYm9vbGVhbjtcblx0XHRlbmdpbmVTZXNzaW9uUmVhZHk/OiBib29sZWFuO1xuXHR9KToge1xuXHRcdGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdGV4ZWN1dGVkQ29tbWFuZHM6IHsgaWQ6IHN0cmluZzsgYXJnczogdW5rbm93bltdIH1bXTtcblx0XHRwZXJtaXNzaW9uQ2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9W107XG5cdFx0bW9kZWxDYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZWxJZDogc3RyaW5nIH1bXTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0OiBIVE1MU2VsZWN0RWxlbWVudDtcblx0XHRtb2RlbFNlbGVjdDogSFRNTFNlbGVjdEVsZW1lbnQ7XG5cdFx0YWdlbnRTZWxlY3Q6IEhUTUxTZWxlY3RFbGVtZW50O1xuXHRcdHNldFBhaXJpbmdQZW5kaW5nKHBlbmRpbmc6IGJvb2xlYW4pOiB2b2lkO1xuXHRcdGRpc3Bvc2UoKTogdm9pZDtcblx0fSB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZXhlY3V0ZWRDb21tYW5kczogeyBpZDogc3RyaW5nOyBhcmdzOiB1bmtub3duW10gfVtdID0gW107XG5cdFx0Y29uc3QgcGVybWlzc2lvbkNhbGxzOiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfVtdID0gW107XG5cdFx0Y29uc3QgbW9kZWxDYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZWxJZDogc3RyaW5nIH1bXSA9IFtdO1xuXHRcdGNvbnN0IGRvY2tSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkb2NrUm9vdCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gZG9ja1Jvb3QucmVtb3ZlKCkgfSk7XG5cdFx0Y29uc3QgcGVybWlzc2lvbkNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHBlcm1pc3Npb25Db250YWluZXIuY2xhc3NOYW1lID0gJ2NvbnZlcnNhdGlvbi1sZW5zLWRvY2stcGVybWlzc2lvbic7XG5cdFx0Y29uc3QgcGVybWlzc2lvblNlbGVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuXHRcdHBlcm1pc3Npb25TZWxlY3QuYWRkKG5ldyBPcHRpb24oJ0FzaycsICcwJykpO1xuXHRcdHBlcm1pc3Npb25TZWxlY3QuYWRkKG5ldyBPcHRpb24oJ0FnZW50JywgJzEnKSk7XG5cdFx0cGVybWlzc2lvblNlbGVjdC5hZGQobmV3IE9wdGlvbignUGVybWl0JywgJzInKSk7XG5cdFx0cGVybWlzc2lvbkNvbnRhaW5lci5hcHBlbmRDaGlsZChwZXJtaXNzaW9uU2VsZWN0KTtcblx0XHRkb2NrUm9vdC5hcHBlbmRDaGlsZChwZXJtaXNzaW9uQ29udGFpbmVyKTtcblx0XHRjb25zdCBtb2RlbENvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdG1vZGVsQ29udGFpbmVyLmNsYXNzTmFtZSA9ICdjb252ZXJzYXRpb24tbGVucy1kb2NrLW1vZGVsJztcblx0XHRjb25zdCBtb2RlbFNlbGVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuXHRcdGZvciAoY29uc3QgaWQgb2Ygb3B0aW9ucz8uY2F0YWxvZ01vZGVsSWRzID8/IFsnJywgJ2dwdC10ZXN0J10pIHtcblx0XHRcdG1vZGVsU2VsZWN0LmFkZChuZXcgT3B0aW9uKGlkIHx8ICdObyBtb2RlbCcsIGlkKSk7XG5cdFx0fVxuXHRcdG1vZGVsQ29udGFpbmVyLmFwcGVuZENoaWxkKG1vZGVsU2VsZWN0KTtcblx0XHRkb2NrUm9vdC5hcHBlbmRDaGlsZChtb2RlbENvbnRhaW5lcik7XG5cdFx0Y29uc3QgbW9yZUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRcdGxldCBwYWlyaW5nUGVuZGluZyA9IG9wdGlvbnM/LnBhaXJpbmdQZW5kaW5nID8/IHRydWU7XG5cdFx0Y29uc3QgZW5naW5lU2Vzc2lvblJlYWR5ID0gb3B0aW9ucz8uZW5naW5lU2Vzc2lvblJlYWR5O1xuXHRcdGNvbnN0IHNlc3Npb25Db25maWdCeVNlc3Npb25JZCA9IG5ldyBNYXA8c3RyaW5nLCB7IGFnZW50SW5kZXg6IG51bWJlcjsgcGVybWlzc2lvbkluZGV4OiBudW1iZXIgfT4oW1xuXHRcdFx0WydzZXNzLWxlZnRvdmVyJywgeyBhZ2VudEluZGV4OiAwLCBwZXJtaXNzaW9uSW5kZXg6IG9wdGlvbnM/LnBlcm1pc3Npb25JbmRleCA/PyAwIH1dLFxuXHRcdF0pO1xuXHRcdHBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCA9IG9wdGlvbnM/LnBlcm1pc3Npb25JbmRleCA/PyAwO1xuXHRcdG1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXggPSBvcHRpb25zPy5tb2RlbFNlbGVjdGVkSW5kZXggPz8gMDtcblx0XHRjb25zdCBhZ2VudENvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IGFnZW50U2VsZWN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VsZWN0Jyk7XG5cdFx0YWdlbnRTZWxlY3QuYWRkKG5ldyBPcHRpb24oJ05vIGFnZW50JywgJycpKTtcblx0XHRhZ2VudFNlbGVjdC5hZGQobmV3IE9wdGlvbignQ29kZXInLCAnY29kZXInKSk7XG5cdFx0YWdlbnRDb250YWluZXIuYXBwZW5kQ2hpbGQoYWdlbnRTZWxlY3QpO1xuXHRcdGNvbnN0IGdhdGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb25zdCBnYXRlTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0Z2F0ZVJvdy5hcHBlbmRDaGlsZChnYXRlTGFiZWwpO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjYXRhbG9nVG9vbE5hbWVzOiBvcHRpb25zPy5jYXRhbG9nVG9vbE5hbWVzID8/IFsnYmFzaCddLFxuXHRcdFx0Y2F0YWxvZ01vZGVsSWRzOiBvcHRpb25zPy5jYXRhbG9nTW9kZWxJZHMgPz8gWycnLCAnZ3B0LXRlc3QnXSxcblx0XHRcdG1vZGVsU2VsZWN0ZWRJbmRleDogb3B0aW9ucz8ubW9kZWxTZWxlY3RlZEluZGV4ID8/IDAsXG5cdFx0XHRzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQsXG5cdFx0XHRsYXN0UmVhZGluZ1dpZHRoOiBvcHRpb25zPy5sYXN0UmVhZGluZ1dpZHRoID8/IDMwMCxcblx0XHRcdHBvc3RGYWlsdXJlVmlzaWJsZTogZmFsc2UsXG5cdFx0XHR0dW5lQ29udGV4dFZpZXc6IHVuZGVmaW5lZCBhcyB7IGNsb3NlKCk6IHZvaWQgfSB8IHVuZGVmaW5lZCxcblx0XHRcdG1vcmVDb250ZXh0VmlldzogdW5kZWZpbmVkIGFzIHsgY2xvc2UoKTogdm9pZCB9IHwgdW5kZWZpbmVkLFxuXHRcdFx0ZG9ja1Jvb3QsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdsZWZ0b3ZlciBkcmFmdCcgfSxcblx0XHRcdHNlbmRCdXR0b246IHsgZW5hYmxlZDogdHJ1ZSB9LFxuXHRcdFx0Z2F0ZVJvdyxcblx0XHRcdGdhdGVMYWJlbCxcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScgYXMgY29uc3QsXG5cdFx0XHRwZXJtaXNzaW9uU2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNldEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikgeyBwZXJtaXNzaW9uU2VsZWN0LmRpc2FibGVkID0gIWVuYWJsZWQ7IH0sXG5cdFx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdFx0c2VsZWN0KGluZGV4OiBudW1iZXIpIHsgcGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4ID0gaW5kZXg7IH0sXG5cdFx0XHR9LFxuXHRcdFx0YWdlbnRTZWxlY3RCb3g6IHtcblx0XHRcdFx0c2V0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7XG5cdFx0XHRcdFx0YWdlbnRTZWxlY3QuZGlzYWJsZWQgPSAhZW5hYmxlZDtcblx0XHRcdFx0XHRhZ2VudFNlbGVjdC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCBTdHJpbmcoIWVuYWJsZWQpKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0QXJpYUxhYmVsKCkgeyB9LFxuXHRcdFx0XHRzZWxlY3QoaW5kZXg6IG51bWJlcikgeyBhZ2VudFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gaW5kZXg7IH0sXG5cdFx0XHR9LFxuXHRcdFx0bW9kZWxTZWxlY3RCb3g6IHtcblx0XHRcdFx0c2V0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7IG1vZGVsU2VsZWN0LmRpc2FibGVkID0gIWVuYWJsZWQ7IH0sXG5cdFx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdFx0c2VsZWN0KGluZGV4OiBudW1iZXIpIHtcblx0XHRcdFx0XHRtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSBpbmRleDtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRhZ2VudENvbnRhaW5lcixcblx0XHRcdG1vcmVCdXR0b246IHsgZWxlbWVudDogbW9yZUJ1dHRvbiB9LFxuXHRcdFx0dHVuZUJ1dHRvbjogeyBlbGVtZW50OiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKSB9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdC4uLihlbmdpbmVTZXNzaW9uUmVhZHkgPT09IHVuZGVmaW5lZCA/IHt9IDogeyBpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZW5naW5lU2Vzc2lvblJlYWR5IH0pLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogYXN5bmMgKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9KSA9PiB7XG5cdFx0XHRcdFx0cGVybWlzc2lvbkNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgb2s6IHRydWUgfTtcblx0XHRcdFx0fSxcblx0XHRcdFx0c3dpdGNoQWdlbnQ6IGFzeW5jICgpID0+ICh7IG9rOiB0cnVlIH0pLFxuXHRcdFx0XHRzd2l0Y2hNb2RlbDogYXN5bmMgKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9KSA9PiB7XG5cdFx0XHRcdFx0bW9kZWxDYWxscy5wdXNoKHsgc2Vzc2lvbklkOiByZXF1ZXN0LnNlc3Npb25JZCwgbW9kZWxJZDogcmVxdWVzdC5tb2RlbElkIH0pO1xuXHRcdFx0XHRcdHJldHVybiB7IHJlc29sdmVkTW9kZWxJZDogcmVxdWVzdC5tb2RlbElkLCBwcm92aWRlcjogJycsIGxldmVsOiAwLCBjb3N0OiAnJywgc3BlZWQ6ICcnIH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0Y29udGV4dFZpZXdTZXJ2aWNlOiB7XG5cdFx0XHRcdHNob3dDb250ZXh0VmlldyhkZWxlZ2F0ZTogeyByZW5kZXI6IChjb250YWluZXI6IEhUTUxFbGVtZW50KSA9PiB7IGRpc3Bvc2UoKTogdm9pZCB9IH0pIHtcblx0XHRcdFx0XHRjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRcdFx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG5cdFx0XHRcdFx0Y29uc3QgcmVuZGVyZWQgPSBkZWxlZ2F0ZS5yZW5kZXIoY29udGFpbmVyKTtcblx0XHRcdFx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBjb250YWluZXIucmVtb3ZlKCkgfSk7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGNsb3NlKCkge1xuXHRcdFx0XHRcdFx0XHRyZW5kZXJlZC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdGNvbnRhaW5lci5yZW1vdmUoKTtcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRjb21tYW5kU2VydmljZToge1xuXHRcdFx0XHRleGVjdXRlQ29tbWFuZChpZDogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pIHtcblx0XHRcdFx0XHRleGVjdXRlZENvbW1hbmRzLnB1c2goeyBpZCwgYXJncyB9KTtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLWxlZnRvdmVyJyxcblx0XHR9O1xuXHRcdGNvbnN0IHR5cGVkSG9zdCA9IGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUsICdsZWZ0b3Zlci1sb29rcy1saXZlIGZpeHR1cmUgbXVzdCBrZWVwIGlzRW5naW5lQ29ubmVjdGVkKCk9PT10cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQodHlwZWRIb3N0LnVhQ29ubmVjdGlvbiksIHBhaXJpbmdQZW5kaW5nKTtcblx0XHRpZiAoZW5naW5lU2Vzc2lvblJlYWR5ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZW5naW5lU2Vzc2lvblJlYWR5KTtcblx0XHR9XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhvc3Q6IHR5cGVkSG9zdCxcblx0XHRcdGV4ZWN1dGVkQ29tbWFuZHMsXG5cdFx0XHRwZXJtaXNzaW9uQ2FsbHMsXG5cdFx0XHRtb2RlbENhbGxzLFxuXHRcdFx0cGVybWlzc2lvblNlbGVjdCxcblx0XHRcdG1vZGVsU2VsZWN0LFxuXHRcdFx0YWdlbnRTZWxlY3QsXG5cdFx0XHRzZXRQYWlyaW5nUGVuZGluZyhwZW5kaW5nOiBib29sZWFuKSB7XG5cdFx0XHRcdHBhaXJpbmdQZW5kaW5nID0gcGVuZGluZztcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGhvc3QudHVuZUNvbnRleHRWaWV3Py5jbG9zZSgpO1xuXHRcdFx0XHRob3N0Lm1vcmVDb250ZXh0Vmlldz8uY2xvc2UoKTtcblx0XHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0fSxcblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBwYWlyaW5nLWhvbGQgc2Vzc2lvbiBzZWxlY3RzIHN0YXkgZGlzYWJsZWQgYW5kIGRvIG5vdCB3cml0ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3QoKTtcblx0XHR0cnkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzU2Vzc2lvblBlcm1pc3Npb25Nb2RlQXZhaWxhYmxlKGZpeHR1cmUuaG9zdCksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25Td2l0Y2hNb2RlbEF2YWlsYWJsZShmaXh0dXJlLmhvc3QpLCBmYWxzZSk7XG5cdFx0XHR1cGRhdGVDb21wb3NlclNlc3Npb25TZWxlY3RzRW5hYmxlZChmaXh0dXJlLmhvc3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cblx0XHRcdGF3YWl0IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhd2FpdCBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbENhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAwKTtcblxuXHRcdFx0Zml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3QucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuXHRcdFx0Zml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsICdmYWxzZScpO1xuXHRcdFx0Zml4dHVyZS5tb2RlbFNlbGVjdC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0Zml4dHVyZS5tb2RlbFNlbGVjdC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG5cdFx0XHRmaXh0dXJlLm1vZGVsU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsICdmYWxzZScpO1xuXHRcdFx0Zml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXggPSAyO1xuXHRcdFx0Zml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gMTtcblx0XHRcdGF3YWl0IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhd2FpdCBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbENhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAwKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIHBhaXJpbmctaG9sZCBNb3JlIHJhZGlvcyBzdGF5IGRpc2FibGVkIGFuZCBmb3JjZWQgY2xpY2sgZG9lcyBub3Qgd3JpdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KCk7XG5cdFx0dHJ5IHtcblx0XHRcdHRvZ2dsZU1vcmVDb250ZXh0VmlldyhmaXh0dXJlLmhvc3QpO1xuXHRcdFx0Y29uc3QgYWdlbnROb3RlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9yZS1hZ2VudCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRcdGFzc2VydC5vayhhZ2VudE5vdGUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50Tm90ZS5nZXRBdHRyaWJ1dGUoJ3JvbGUnKSwgJ25vdGUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZ2VudE5vdGUudGV4dENvbnRlbnQsICdObyBhZ2VudCcpO1xuXHRcdFx0Y29uc3QgcmFkaW9zID0gWy4uLmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtcGVybWlzc2lvbiBbcm9sZT1cIm1lbnVpdGVtcmFkaW9cIl0nKV0gYXMgSFRNTEJ1dHRvbkVsZW1lbnRbXTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYWRpb3MubGVuZ3RoLCAzKTtcblx0XHRcdGZvciAoY29uc3QgcmFkaW8gb2YgcmFkaW9zKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYWRpby5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYWRpby5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ3RydWUnKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHBlcm1pdCA9IHJhZGlvc1syXTtcblx0XHRcdHBlcm1pdC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0cGVybWl0LnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcblx0XHRcdHBlcm1pdC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnKTtcblx0XHRcdHBlcm1pdC5jbGljaygpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnTW9yZSBwb3B1cCBjbG9zZXMgb24gRXNjYXBlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCgpO1xuXHRcdHRyeSB7XG5cdFx0XHR0b2dnbGVNb3JlQ29udGV4dFZpZXcoZml4dHVyZS5ob3N0KTtcblx0XHRcdGFzc2VydC5vayhkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLXBvcHVwJykpO1xuXHRcdFx0Ly8gRE9NIEVzY2FwZSBrZXljb2RlOiBFVkVOVF9LRVlfQ09ERV9NQVBbMjddIG5vcm1hbGl6ZXMgdG8gS2V5Q29kZS5Fc2NhcGVcblx0XHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IGtleUNvZGU6IDI3LCBidWJibGVzOiB0cnVlLCBjYW5jZWxhYmxlOiB0cnVlIH0pKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLXBvcHVwJyksIG51bGwpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1R1bmUgcG9wdXAgY2xvc2VzIG9uIEVzY2FwZScsICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3QoKTtcblx0XHR0cnkge1xuXHRcdFx0dG9nZ2xlVHVuZUNvbnRleHRWaWV3KGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRhc3NlcnQub2soZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpKTtcblx0XHRcdGRvY3VtZW50LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IGtleUNvZGU6IDI3LCBidWJibGVzOiB0cnVlLCBjYW5jZWxhYmxlOiB0cnVlIH0pKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLXBvcHVwJyksIG51bGwpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIE1vcmUgcGVybWlzc2lvbiBjbGljayBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXggY2F0Y2gtcGF0aCBub3RpY2UgdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdWFDb25uZWN0aW9uID0gZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiBhcyB7XG5cdFx0XHRcdHNldFBlcm1pc3Npb25Nb2RlOiAocmVxdWVzdDogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZTogc3RyaW5nIH0pID0+IFByb21pc2U8eyBvazogYm9vbGVhbiB9Pjtcblx0XHRcdH07XG5cdFx0XHR1YUNvbm5lY3Rpb24uc2V0UGVybWlzc2lvbk1vZGUgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignc2V0UGVybWlzc2lvbk1vZGUgYm9vbScpO1xuXHRcdFx0fTtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmaXh0dXJlLmhvc3QuZ2F0ZUxhYmVsLCAndGV4dENvbnRlbnQnLCB7XG5cdFx0XHRcdGNvbmZpZ3VyYWJsZTogdHJ1ZSxcblx0XHRcdFx0Z2V0KCkge1xuXHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0KCkge1xuXHRcdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdFx0dG9nZ2xlTW9yZUNvbnRleHRWaWV3KGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRjb25zdCByYWRpb3MgPSBbLi4uZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9yZS1wZXJtaXNzaW9uIFtyb2xlPVwibWVudWl0ZW1yYWRpb1wiXScpXSBhcyBIVE1MQnV0dG9uRWxlbWVudFtdO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhZGlvcy5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhZGlvc1syXSEuZGlzYWJsZWQsIGZhbHNlKTtcblx0XHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4ge1xuXHRcdFx0XHRyYWRpb3NbMl0hLmNsaWNrKCk7XG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdjb21wb3NlciBjaHJvbWUgYXBwbHlTZXNzaW9uIGZpcmUtYW5kLWZvcmdldCB2b2lkcyBkb3VibGUtY2F0Y2ggb25VbmV4cGVjdGVkRXJyb3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgX19yZWFkRmlsZUluVGVzdHMoYCR7cHJvY2Vzcy5jd2QoKX0vc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZS50c2ApO1xuXHRcdGNvbnN0IGRvdWJsZUNhdGNoID0gJy5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpJztcblx0XHRjb25zdCBhcHBseVNlc3Npb25Wb2lkcyA9IHNvdXJjZS5tYXRjaCgvdm9pZCBhcHBseVNlc3Npb25cXHcrXFwoW147XSs7L2cpID8/IFtdO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXBwbHlTZXNzaW9uVm9pZHMsIFtcblx0XHRcdGB2b2lkIGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChob3N0LCBzZXNzaW9uSWQsIGluZGV4KSR7ZG91YmxlQ2F0Y2h9O2AsXG5cdFx0XSk7XG5cdFx0YXNzZXJ0Lm9rKCFzb3VyY2UuaW5jbHVkZXMoJ3ZvaWQgYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGhvc3QsIHNlc3Npb25JZCwgaW5kZXgpOycpKTtcblx0fSk7XG5cblx0dGVzdCgnaW4tZmxpZ2h0IGxlZnRvdmVyLWxvb2tzLWxpdmUgcGVybWlzc2lvbiBhbmQgbW9kZWwgYXBwbHkga2VlcCB0aGUgYWNjZXB0ZWQgdmFsdWUgYW5kIHN0YXkgcmVhZC1vbmx5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25DYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZTogc3RyaW5nIH1bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsQ2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9W10gPSBbXTtcblx0XHRjb25zdCBkb2NrUm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZG9ja1Jvb3QpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IGRvY2tSb290LnJlbW92ZSgpIH0pO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25TZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdBc2snLCAnMCcpKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdBZ2VudCcsICcxJykpO1xuXHRcdHBlcm1pc3Npb25TZWxlY3QuYWRkKG5ldyBPcHRpb24oJ1Blcm1pdCcsICcyJykpO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25Db250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRwZXJtaXNzaW9uQ29udGFpbmVyLmNsYXNzTmFtZSA9ICdjb252ZXJzYXRpb24tbGVucy1kb2NrLXBlcm1pc3Npb24nO1xuXHRcdHBlcm1pc3Npb25Db250YWluZXIuYXBwZW5kQ2hpbGQocGVybWlzc2lvblNlbGVjdCk7XG5cdFx0ZG9ja1Jvb3QuYXBwZW5kQ2hpbGQocGVybWlzc2lvbkNvbnRhaW5lcik7XG5cdFx0Y29uc3QgbW9kZWxTZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcblx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbignTm8gbW9kZWwnLCAnJykpO1xuXHRcdG1vZGVsU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdncHQtdGVzdCcsICdncHQtdGVzdCcpKTtcblx0XHRjb25zdCBtb2RlbENvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdG1vZGVsQ29udGFpbmVyLmNsYXNzTmFtZSA9ICdjb252ZXJzYXRpb24tbGVucy1kb2NrLW1vZGVsJztcblx0XHRtb2RlbENvbnRhaW5lci5hcHBlbmRDaGlsZChtb2RlbFNlbGVjdCk7XG5cdFx0ZG9ja1Jvb3QuYXBwZW5kQ2hpbGQobW9kZWxDb250YWluZXIpO1xuXHRcdGNvbnN0IGdhdGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRnYXRlUm93LmhpZGRlbiA9IHRydWU7XG5cdFx0Y29uc3QgZ2F0ZUxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGdhdGVSb3cuYXBwZW5kQ2hpbGQoZ2F0ZUxhYmVsKTtcblx0XHRkb2NrUm9vdC5hcHBlbmRDaGlsZChnYXRlUm93KTtcblx0XHRjb25zdCBzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQgPSBuZXcgTWFwPHN0cmluZywgeyBhZ2VudEluZGV4OiBudW1iZXI7IHBlcm1pc3Npb25JbmRleDogbnVtYmVyIH0+KFtcblx0XHRcdFsnc2Vzcy1sZWZ0b3ZlcicsIHsgYWdlbnRJbmRleDogMCwgcGVybWlzc2lvbkluZGV4OiAwIH1dLFxuXHRcdF0pO1xuXHRcdGxldCBwYWlyaW5nUGVuZGluZyA9IGZhbHNlO1xuXHRcdGxldCByZWxlYXNlUGVybWlzc2lvbjogKCh2YWx1ZTogeyBvazogdHJ1ZSB9KSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgcGVybWlzc2lvblN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBwZXJtaXNzaW9uRW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBwZXJtaXNzaW9uU3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25Ib2xkID0gbmV3IFByb21pc2U8eyBvazogdHJ1ZSB9PihyZXNvbHZlID0+IHsgcmVsZWFzZVBlcm1pc3Npb24gPSByZXNvbHZlOyB9KTtcblx0XHRsZXQgcmVsZWFzZU1vZGVsOiAoKHZhbHVlOiB7IHJlc29sdmVkTW9kZWxJZDogc3RyaW5nOyBwcm92aWRlcjogc3RyaW5nOyBsZXZlbDogbnVtYmVyOyBjb3N0OiBzdHJpbmc7IHNwZWVkOiBzdHJpbmcgfSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IG1vZGVsU3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVsRW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBtb2RlbFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBtb2RlbEhvbGQgPSBuZXcgUHJvbWlzZTx7IHJlc29sdmVkTW9kZWxJZDogc3RyaW5nOyBwcm92aWRlcjogc3RyaW5nOyBsZXZlbDogbnVtYmVyOyBjb3N0OiBzdHJpbmc7IHNwZWVkOiBzdHJpbmcgfT4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRyZWxlYXNlTW9kZWwgPSByZXNvbHZlO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjYXRhbG9nVG9vbE5hbWVzOiBbJ2Jhc2gnXSxcblx0XHRcdGNhdGFsb2dNb2RlbElkczogWycnLCAnZ3B0LXRlc3QnXSxcblx0XHRcdG1vZGVsU2VsZWN0ZWRJbmRleDogMCxcblx0XHRcdHNlc3Npb25Db25maWdCeVNlc3Npb25JZCxcblx0XHRcdGxhc3RSZWFkaW5nV2lkdGg6IDMwMCxcblx0XHRcdHR1bmVDb250ZXh0VmlldzogdW5kZWZpbmVkIGFzIHsgY2xvc2UoKTogdm9pZCB9IHwgdW5kZWZpbmVkLFxuXHRcdFx0bW9yZUNvbnRleHRWaWV3OiB1bmRlZmluZWQgYXMgeyBjbG9zZSgpOiB2b2lkIH0gfCB1bmRlZmluZWQsXG5cdFx0XHRkb2NrUm9vdCxcblx0XHRcdHNlbmRCdXR0b246IHsgZW5hYmxlZDogdHJ1ZSB9LFxuXHRcdFx0Z2F0ZVJvdyxcblx0XHRcdGdhdGVMYWJlbCxcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScgYXMgY29uc3QsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICcnIH0sXG5cdFx0XHRwZXJtaXNzaW9uU2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNldEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikgeyBwZXJtaXNzaW9uU2VsZWN0LmRpc2FibGVkID0gIWVuYWJsZWQ7IH0sXG5cdFx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdFx0c2VsZWN0KGluZGV4OiBudW1iZXIpIHsgcGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4ID0gaW5kZXg7IH0sXG5cdFx0XHR9LFxuXHRcdFx0YWdlbnRTZWxlY3RCb3g6IHtcblx0XHRcdFx0c2V0RW5hYmxlZCgpIHsgfSxcblx0XHRcdFx0c2V0QXJpYUxhYmVsKCkgeyB9LFxuXHRcdFx0XHRzZWxlY3QoKSB7IH0sXG5cdFx0XHR9LFxuXHRcdFx0bW9kZWxTZWxlY3RCb3g6IHtcblx0XHRcdFx0c2V0RW5hYmxlZChlbmFibGVkOiBib29sZWFuKSB7IG1vZGVsU2VsZWN0LmRpc2FibGVkID0gIWVuYWJsZWQ7IH0sXG5cdFx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdFx0c2VsZWN0KGluZGV4OiBudW1iZXIpIHtcblx0XHRcdFx0XHRtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSBpbmRleDtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRhZ2VudENvbnRhaW5lcjogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXG5cdFx0XHRtb3JlQnV0dG9uOiB7IGVsZW1lbnQ6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpIH0sXG5cdFx0XHR0dW5lQnV0dG9uOiB7IGVsZW1lbnQ6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpIH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IGFzeW5jIChyZXF1ZXN0OiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfSkgPT4ge1xuXHRcdFx0XHRcdHBlcm1pc3Npb25DYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRcdHBlcm1pc3Npb25TdGFydGVkPy4oKTtcblx0XHRcdFx0XHRyZXR1cm4gcGVybWlzc2lvbkhvbGQ7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHN3aXRjaE1vZGVsOiBhc3luYyAocmVxdWVzdDogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZWxJZDogc3RyaW5nIH0pID0+IHtcblx0XHRcdFx0XHRtb2RlbENhbGxzLnB1c2goeyBzZXNzaW9uSWQ6IHJlcXVlc3Quc2Vzc2lvbklkLCBtb2RlbElkOiByZXF1ZXN0Lm1vZGVsSWQgfSk7XG5cdFx0XHRcdFx0bW9kZWxTdGFydGVkPy4oKTtcblx0XHRcdFx0XHRyZXR1cm4gbW9kZWxIb2xkO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy1sZWZ0b3ZlcicsXG5cdFx0fTtcblx0XHRjb25zdCB0eXBlZEhvc3QgPSBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0dHJ5IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZCh0eXBlZEhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzU2Vzc2lvblBlcm1pc3Npb25Nb2RlQXZhaWxhYmxlKHR5cGVkSG9zdCksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzU2Vzc2lvblN3aXRjaE1vZGVsQXZhaWxhYmxlKHR5cGVkSG9zdCksIHRydWUpO1xuXG5cdFx0XHRjb25zdCBwZXJtaXNzaW9uQXBwbHkgPSBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgodHlwZWRIb3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0Y29uc3QgbW9kZWxBcHBseSA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgodHlwZWRIb3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDEpO1xuXHRcdFx0YXdhaXQgcGVybWlzc2lvbkVudGVyZWQ7XG5cdFx0XHRhd2FpdCBtb2RlbEVudGVyZWQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGVybWlzc2lvbkNhbGxzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxDYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAxKTtcblxuXHRcdFx0cGFpcmluZ1BlbmRpbmcgPSB0cnVlO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlLCAnbGVmdG92ZXItbG9va3MtbGl2ZSBmaXh0dXJlIG11c3Qga2VlcCBpc0VuZ2luZUNvbm5lY3RlZCgpPT09dHJ1ZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQodHlwZWRIb3N0LnVhQ29ubmVjdGlvbiksIHRydWUpO1xuXG5cdFx0XHRyZWxlYXNlUGVybWlzc2lvbiEoeyBvazogdHJ1ZSB9KTtcblx0XHRcdHJlbGVhc2VNb2RlbCEoeyByZXNvbHZlZE1vZGVsSWQ6ICdncHQtdGVzdCcsIHByb3ZpZGVyOiAnJywgbGV2ZWw6IDAsIGNvc3Q6ICcnLCBzcGVlZDogJycgfSk7XG5cdFx0XHRhd2FpdCBwZXJtaXNzaW9uQXBwbHk7XG5cdFx0XHRhd2FpdCBtb2RlbEFwcGx5O1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUsICdsZWZ0b3Zlci1sb29rcy1saXZlIGZpeHR1cmUgbXVzdCBrZWVwIGlzRW5naW5lQ29ubmVjdGVkKCk9PT10cnVlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZCh0eXBlZEhvc3QudWFDb25uZWN0aW9uKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbGVmdG92ZXInKSwgJ2dwdC10ZXN0Jyk7XG5cblx0XHRcdHVwZGF0ZUNvbXBvc2VyU2Vzc2lvblNlbGVjdHNFbmFibGVkKHR5cGVkSG9zdCk7XG5cdFx0XHR1cGRhdGVHYXRlUm93KHR5cGVkSG9zdCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGVybWlzc2lvblNlbGVjdC5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5nYXRlUm93LmhpZGRlbiwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5nYXRlTGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrRW5naW5lTm90Q29ubmVjdGVkKTtcblxuXHRcdFx0cGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRcdHVwZGF0ZUNvbXBvc2VyU2Vzc2lvblNlbGVjdHNFbmFibGVkKHR5cGVkSG9zdCk7XG5cdFx0XHR1cGRhdGVHYXRlUm93KHR5cGVkSG9zdCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGVybWlzc2lvblNlbGVjdC5kaXNhYmxlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0LmRpc2FibGVkLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QuZ2F0ZVJvdy5oaWRkZW4sIHRydWUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3ZlciBwZXJtaXNzaW9uIGtlZXBzIHRoZSBhY2NlcHRlZCB2YWx1ZSBhbmQgZG9lcyBub3Qgc2hvdyBhbiB1bnNlbnQgbmV3ZXIgdGFyZ2V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZWxlYXNlUGVybWl0OiAoKHZhbHVlOiB7IG9rOiB0cnVlIH0pID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IHBlcm1pdFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IHBlcm1pdEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgcGVybWl0U3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgcGVybWl0SG9sZCA9IG5ldyBQcm9taXNlPHsgb2s6IHRydWUgfT4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VQZXJtaXQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24gYXMge1xuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9KSA9PiBQcm9taXNlPHsgb2s6IHRydWUgfT47XG5cdFx0XHR9O1xuXHRcdFx0dWFDb25uZWN0aW9uLnNldFBlcm1pc3Npb25Nb2RlID0gYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHBlcm1pdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRyZXR1cm4gcGVybWl0SG9sZDtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBwZXJtaXQgPSBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0YXdhaXQgcGVybWl0RW50ZXJlZDtcblx0XHRcdGNvbnN0IGFzayA9IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0Zml4dHVyZS5zZXRQYWlyaW5nUGVuZGluZyh0cnVlKTtcblx0XHRcdHJlbGVhc2VQZXJtaXQhKHsgb2s6IHRydWUgfSk7XG5cdFx0XHRhd2FpdCBwZXJtaXQ7XG5cdFx0XHRhd2FpdCBhc2s7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLm1hcChjYWxsID0+IGNhbGwubW9kZSksIFsnU0VTU0lPTl9UT09MX1BFUk1JU1NJT05fTU9ERV9QRVJNSVQnXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMik7XG5cdFx0XHR1cGRhdGVDb21wb3NlclNlc3Npb25TZWxlY3RzRW5hYmxlZChmaXh0dXJlLmhvc3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXIgcGVybWlzc2lvbiBmYWlsdXJlIHJvbGxzIGJhY2sgYW5kIGRvZXMgbm90IHBhaW50IGEgZmFpbHVyZSBub3RpY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlbGVhc2VQZXJtaXQ6ICgodmFsdWU6IHsgb2s6IGZhbHNlOyBtZXNzYWdlOiBzdHJpbmcgfSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgcGVybWl0U3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgcGVybWl0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBwZXJtaXRTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCBwZXJtaXRIb2xkID0gbmV3IFByb21pc2U8eyBvazogZmFsc2U7IG1lc3NhZ2U6IHN0cmluZyB9PihyZXNvbHZlID0+IHsgcmVsZWFzZVBlcm1pdCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgdWFDb25uZWN0aW9uID0gZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiBhcyB7XG5cdFx0XHRcdHNldFBlcm1pc3Npb25Nb2RlOiAocmVxdWVzdDogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZTogc3RyaW5nIH0pID0+IFByb21pc2U8eyBvazogZmFsc2U7IG1lc3NhZ2U6IHN0cmluZyB9Pjtcblx0XHRcdH07XG5cdFx0XHR1YUNvbm5lY3Rpb24uc2V0UGVybWlzc2lvbk1vZGUgPSBhc3luYyByZXF1ZXN0ID0+IHtcblx0XHRcdFx0Zml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMucHVzaChyZXF1ZXN0KTtcblx0XHRcdFx0cGVybWl0U3RhcnRlZD8uKCk7XG5cdFx0XHRcdHJldHVybiBwZXJtaXRIb2xkO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGFwcGx5ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGF3YWl0IHBlcm1pdEVudGVyZWQ7XG5cdFx0XHRmaXh0dXJlLnNldFBhaXJpbmdQZW5kaW5nKHRydWUpO1xuXHRcdFx0cmVsZWFzZVBlcm1pdCEoeyBvazogZmFsc2UsIG1lc3NhZ2U6ICdlbmdpbmUgcmVqZWN0ZWQgcGVybWl0JyB9KTtcblx0XHRcdGF3YWl0IGFwcGx5O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZ2F0ZUxhYmVsLnRleHRDb250ZW50LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXIgbW9kZWwga2VlcHMgdGhlIGFjY2VwdGVkIHZhbHVlIGFuZCBkb2VzIG5vdCBzaG93IGFuIHVuc2VudCBuZXdlciB0YXJnZXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHtcblx0XHRcdGNhdGFsb2dNb2RlbElkczogWycnLCAnZ3B0LWEnLCAnZ3B0LWInXSxcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlbGVhc2VGaXJzdDogKCh2YWx1ZTogVW5pdmVyc2VBZ2VudFN3aXRjaE1vZGVsUmVzdWx0KSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBmaXJzdFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGZpcnN0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBmaXJzdFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IGZpcnN0SG9sZCA9IG5ldyBQcm9taXNlPFVuaXZlcnNlQWdlbnRTd2l0Y2hNb2RlbFJlc3VsdD4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VGaXJzdCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgdWFDb25uZWN0aW9uID0gZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbjtcblx0XHRcdHVhQ29ubmVjdGlvbi5zd2l0Y2hNb2RlbCA9IGFzeW5jIHJlcXVlc3QgPT4ge1xuXHRcdFx0XHRmaXh0dXJlLm1vZGVsQ2FsbHMucHVzaCh7IHNlc3Npb25JZDogcmVxdWVzdC5zZXNzaW9uSWQsIG1vZGVsSWQ6IHJlcXVlc3QubW9kZWxJZCB9KTtcblx0XHRcdFx0Zmlyc3RTdGFydGVkPy4oKTtcblx0XHRcdFx0cmV0dXJuIGZpcnN0SG9sZDtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBmaXJzdCA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDEpO1xuXHRcdFx0YXdhaXQgZmlyc3RFbnRlcmVkO1xuXHRcdFx0Y29uc3Qgc2Vjb25kID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGZpeHR1cmUuc2V0UGFpcmluZ1BlbmRpbmcodHJ1ZSk7XG5cdFx0XHRyZWxlYXNlRmlyc3QhKHsgcmVzb2x2ZWRNb2RlbElkOiAnZ3B0LWEnLCBwcm92aWRlcjogJycsIGxldmVsOiAwLCBjb3N0OiAnJywgc3BlZWQ6ICcnIH0pO1xuXHRcdFx0YXdhaXQgZmlyc3Q7XG5cdFx0XHRhd2FpdCBzZWNvbmQ7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxDYWxscy5tYXAoY2FsbCA9PiBjYWxsLm1vZGVsSWQpLCBbJ2dwdC1hJ10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQ/LmdldCgnc2Vzcy1sZWZ0b3ZlcicpLCAnZ3B0LWEnKTtcblx0XHRcdHVwZGF0ZUNvbXBvc2VyU2Vzc2lvblNlbGVjdHNFbmFibGVkKGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXIgbW9kZWwgd2l0aCBhbiBlbXB0eSByZXNvbHZlZCBpZCByb2xscyBiYWNrIGFuZCBkb2VzIG5vdCBwYWludCBhIGZhaWx1cmUgbm90aWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZWxlYXNlTW9kZWw6ICgodmFsdWU6IFVuaXZlcnNlQWdlbnRTd2l0Y2hNb2RlbFJlc3VsdCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgbW9kZWxTdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBtb2RlbEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgbW9kZWxTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCBtb2RlbEhvbGQgPSBuZXcgUHJvbWlzZTxVbml2ZXJzZUFnZW50U3dpdGNoTW9kZWxSZXN1bHQ+KHJlc29sdmUgPT4geyByZWxlYXNlTW9kZWwgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb247XG5cdFx0XHR1YUNvbm5lY3Rpb24uc3dpdGNoTW9kZWwgPSBhc3luYyByZXF1ZXN0ID0+IHtcblx0XHRcdFx0Zml4dHVyZS5tb2RlbENhbGxzLnB1c2goeyBzZXNzaW9uSWQ6IHJlcXVlc3Quc2Vzc2lvbklkLCBtb2RlbElkOiByZXF1ZXN0Lm1vZGVsSWQgfSk7XG5cdFx0XHRcdG1vZGVsU3RhcnRlZD8uKCk7XG5cdFx0XHRcdHJldHVybiBtb2RlbEhvbGQ7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgYXBwbHkgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGF3YWl0IG1vZGVsRW50ZXJlZDtcblx0XHRcdGZpeHR1cmUuc2V0UGFpcmluZ1BlbmRpbmcodHJ1ZSk7XG5cdFx0XHRyZWxlYXNlTW9kZWwhKHsgcmVzb2x2ZWRNb2RlbElkOiAnJywgcHJvdmlkZXI6ICcnLCBsZXZlbDogMCwgY29zdDogJycsIHNwZWVkOiAnJyB9KTtcblx0XHRcdGF3YWl0IGFwcGx5O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQ/LmdldCgnc2Vzcy1sZWZ0b3ZlcicpLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZ2F0ZUxhYmVsLnRleHRDb250ZW50LCAnJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXIgc3RhbGUgbW9kZWwgd2l0aCBhbiBlbXB0eSByZXNvbHZlZCBpZCByZXN0b3JlcyB0aGUgbGFzdCBhY2NlcHRlZCBtb2RlbCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3Qoe1xuXHRcdFx0Y2F0YWxvZ01vZGVsSWRzOiBbJycsICdncHQtYScsICdncHQtYiddLFxuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgcmVsZWFzZUZpcnN0OiAoKHZhbHVlOiBVbml2ZXJzZUFnZW50U3dpdGNoTW9kZWxSZXN1bHQpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGZpcnN0U3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgZmlyc3RFbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IGZpcnN0U3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgZmlyc3RIb2xkID0gbmV3IFByb21pc2U8VW5pdmVyc2VBZ2VudFN3aXRjaE1vZGVsUmVzdWx0PihyZXNvbHZlID0+IHsgcmVsZWFzZUZpcnN0ID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCB1YUNvbm5lY3Rpb24gPSBmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uO1xuXHRcdFx0dWFDb25uZWN0aW9uLnN3aXRjaE1vZGVsID0gYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGZpeHR1cmUubW9kZWxDYWxscy5wdXNoKHsgc2Vzc2lvbklkOiByZXF1ZXN0LnNlc3Npb25JZCwgbW9kZWxJZDogcmVxdWVzdC5tb2RlbElkIH0pO1xuXHRcdFx0XHRmaXJzdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRyZXR1cm4gZmlyc3RIb2xkO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGZpcnN0ID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMSk7XG5cdFx0XHRhd2FpdCBmaXJzdEVudGVyZWQ7XG5cdFx0XHRjb25zdCBzZWNvbmQgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGZpeHR1cmUuc2V0UGFpcmluZ1BlbmRpbmcodHJ1ZSk7XG5cdFx0XHRyZWxlYXNlRmlyc3QhKHsgcmVzb2x2ZWRNb2RlbElkOiAnJywgcHJvdmlkZXI6ICcnLCBsZXZlbDogMCwgY29zdDogJycsIHNwZWVkOiAnJyB9KTtcblx0XHRcdGF3YWl0IGZpcnN0O1xuXHRcdFx0YXdhaXQgc2Vjb25kO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5tb2RlbElkKSwgWydncHQtYSddKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbGVmdG92ZXInKSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QucG9zdEZhaWx1cmVWaXNpYmxlLCBmYWxzZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXIgc3RhbGUgcGVybWlzc2lvbiB0aHJvdyByZXN0b3JlcyB0aGUgbGFzdCBhY2NlcHRlZCB2YWx1ZSBhbmQgbm90IHRoZSB1bnNlbnQgdGFyZ2V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZWplY3RQZXJtaXQ6ICgoZXJyb3I6IEVycm9yKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBwZXJtaXRTdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBwZXJtaXRFbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IHBlcm1pdFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IHBlcm1pdEhvbGQgPSBuZXcgUHJvbWlzZTxuZXZlcj4oKF9yZXNvbHZlLCByZWplY3QpID0+IHsgcmVqZWN0UGVybWl0ID0gcmVqZWN0OyB9KTtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24gYXMge1xuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9KSA9PiBQcm9taXNlPHsgb2s6IHRydWUgfT47XG5cdFx0XHR9O1xuXHRcdFx0dWFDb25uZWN0aW9uLnNldFBlcm1pc3Npb25Nb2RlID0gYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHBlcm1pdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRyZXR1cm4gcGVybWl0SG9sZDtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBwZXJtaXQgPSBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0YXdhaXQgcGVybWl0RW50ZXJlZDtcblx0XHRcdGNvbnN0IGFnZW50ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGZpeHR1cmUuc2V0UGFpcmluZ1BlbmRpbmcodHJ1ZSk7XG5cdFx0XHRyZWplY3RQZXJtaXQhKG5ldyBFcnJvcigncGVybWl0IGZhaWxlZCcpKTtcblx0XHRcdGF3YWl0IHBlcm1pdDtcblx0XHRcdGF3YWl0IGFnZW50O1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25DYWxscy5tYXAoY2FsbCA9PiBjYWxsLm1vZGUpLCBbJ1NFU1NJT05fVE9PTF9QRVJNSVNTSU9OX01PREVfUEVSTUlUJ10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIGZhbHNlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3ZlciBzdGFsZSBtb2RlbCB0aHJvdyByZXN0b3JlcyB0aGUgbGFzdCBhY2NlcHRlZCBtb2RlbCBhbmQgbm90IHRoZSB1bnNlbnQgdGFyZ2V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRjYXRhbG9nTW9kZWxJZHM6IFsnJywgJ2dwdC1hJywgJ2dwdC1iJ10sXG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZWplY3RGaXJzdDogKChlcnJvcjogRXJyb3IpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IGZpcnN0U3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgZmlyc3RFbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IGZpcnN0U3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgZmlyc3RIb2xkID0gbmV3IFByb21pc2U8bmV2ZXI+KChfcmVzb2x2ZSwgcmVqZWN0KSA9PiB7IHJlamVjdEZpcnN0ID0gcmVqZWN0OyB9KTtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb247XG5cdFx0XHR1YUNvbm5lY3Rpb24uc3dpdGNoTW9kZWwgPSBhc3luYyByZXF1ZXN0ID0+IHtcblx0XHRcdFx0Zml4dHVyZS5tb2RlbENhbGxzLnB1c2goeyBzZXNzaW9uSWQ6IHJlcXVlc3Quc2Vzc2lvbklkLCBtb2RlbElkOiByZXF1ZXN0Lm1vZGVsSWQgfSk7XG5cdFx0XHRcdGZpcnN0U3RhcnRlZD8uKCk7XG5cdFx0XHRcdHJldHVybiBmaXJzdEhvbGQ7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgZmlyc3QgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGF3YWl0IGZpcnN0RW50ZXJlZDtcblx0XHRcdGNvbnN0IHNlY29uZCA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0Zml4dHVyZS5zZXRQYWlyaW5nUGVuZGluZyh0cnVlKTtcblx0XHRcdHJlamVjdEZpcnN0IShuZXcgRXJyb3IoJ2dwdC1hIGZhaWxlZCcpKTtcblx0XHRcdGF3YWl0IGZpcnN0O1xuXHRcdFx0YXdhaXQgc2Vjb25kO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5tb2RlbElkKSwgWydncHQtYSddKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbGVmdG92ZXInKSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QucG9zdEZhaWx1cmVWaXNpYmxlLCBmYWxzZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgc2Vzc2lvbiBzZWxlY3RzIHN0YXkgZGlzYWJsZWQgYW5kIGRvIG5vdCB3cml0ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBmYWxzZSxcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzU2Vzc2lvblBlcm1pc3Npb25Nb2RlQXZhaWxhYmxlKGZpeHR1cmUuaG9zdCksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25Td2l0Y2hBZ2VudEF2YWlsYWJsZShmaXh0dXJlLmhvc3QpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNTZXNzaW9uU3dpdGNoTW9kZWxBdmFpbGFibGUoZml4dHVyZS5ob3N0KSwgZmFsc2UpO1xuXHRcdFx0dXBkYXRlQ29tcG9zZXJTZXNzaW9uU2VsZWN0c0VuYWJsZWQoZml4dHVyZS5ob3N0KTtcblx0XHRcdHVwZGF0ZVNlbmRFbmFibGVkKGZpeHR1cmUuaG9zdCk7XG5cdFx0XHR1cGRhdGVHYXRlUm93KGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlbmRCdXR0b24uZW5hYmxlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlUm93LmhpZGRlbiwgZmFsc2UsICdLRUVQIGxlZnRvdmVyIGdhdGUgbXVzdCBub3QgaGlkZSBhcyBsaXZlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVMYWJlbC50ZXh0Q29udGVudCwgYCR7Y29udmVyc2F0aW9uTGVuc0RvY2tTZXNzaW9uVW5hdmFpbGFibGV9IFx1MjAxNCAke2NvbnZlcnNhdGlvbkxlbnNEb2NrU2Vzc2lvblVuYXZhaWxhYmxlUmVhc29ufWApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuYWdlbnRTZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuYWdlbnRTZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ3RydWUnKTtcblxuXHRcdFx0YXdhaXQgYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGF3YWl0IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25DYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDApO1xuXG5cdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3QuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG5cdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyk7XG5cdFx0XHRmaXh0dXJlLmFnZW50U2VsZWN0LmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHRmaXh0dXJlLmFnZW50U2VsZWN0LnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcblx0XHRcdGZpeHR1cmUuYWdlbnRTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyk7XG5cdFx0XHRmaXh0dXJlLm1vZGVsU2VsZWN0LmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHRmaXh0dXJlLm1vZGVsU2VsZWN0LnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcblx0XHRcdGZpeHR1cmUubW9kZWxTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyk7XG5cdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCA9IDI7XG5cdFx0XHRmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXggPSAxO1xuXHRcdFx0YXdhaXQgYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGF3YWl0IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25DYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCBsaXZlIHNlc3Npb24gc2VsZWN0cyBzdGlsbCB3cml0ZSB3aGVuIGVuZ2luZSBzZXNzaW9uIGlzIHJlYWR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzU2Vzc2lvblBlcm1pc3Npb25Nb2RlQXZhaWxhYmxlKGZpeHR1cmUuaG9zdCksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzU2Vzc2lvblN3aXRjaEFnZW50QXZhaWxhYmxlKGZpeHR1cmUuaG9zdCksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzU2Vzc2lvblN3aXRjaE1vZGVsQXZhaWxhYmxlKGZpeHR1cmUuaG9zdCksIHRydWUpO1xuXHRcdFx0dXBkYXRlQ29tcG9zZXJTZXNzaW9uU2VsZWN0c0VuYWJsZWQoZml4dHVyZS5ob3N0KTtcblx0XHRcdHVwZGF0ZVNlbmRFbmFibGVkKGZpeHR1cmUuaG9zdCk7XG5cdFx0XHR1cGRhdGVHYXRlUm93KGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlbmRCdXR0b24uZW5hYmxlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVSb3cuaGlkZGVuLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3QuZGlzYWJsZWQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmFnZW50U2VsZWN0LmRpc2FibGVkLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5kaXNhYmxlZCwgZmFsc2UpO1xuXG5cdFx0XHRhd2FpdCBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0YXdhaXQgYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLCBbeyBzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJywgbW9kZTogJ1NFU1NJT05fVE9PTF9QRVJNSVNTSU9OX01PREVfUEVSTUlUJyB9XSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxDYWxscywgW3sgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicsIG1vZGVsSWQ6ICdncHQtdGVzdCcgfV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnYXBwbHlTZXNzaW9uTW9kZWxJbmRleCBmYWlsdXJlIGFmdGVyIHJlYmluZCByZXN0b3JlcyBvbmx5IHRoZSBvcmlnaW5hdGluZyBzZXNzaW9uIGNlbGwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY2F0YWxvZ01vZGVsSWRzID0gWycnLCAnZ3B0LWEnLCAnZ3B0LWInLCAnZ3B0LWMnXTtcblx0XHRjb25zdCBtb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oW1xuXHRcdFx0WydzZXNzLWEnLCAnZ3B0LWEnXSxcblx0XHRcdFsnc2Vzcy1iJywgJ2dwdC1iJ10sXG5cdFx0XSk7XG5cdFx0bGV0IGJvdW5kU2Vzc2lvbklkID0gJ3Nlc3MtYSc7XG5cdFx0bGV0IHJlbGVhc2VNb2RlbDogKChvdXRjb21lOiBFcnJvcikgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IG1vZGVsU3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVsRW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBtb2RlbFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBtb2RlbFNlbGVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuXHRcdG1vZGVsU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdObyBtb2RlbCcsICcnKSk7XG5cdFx0bW9kZWxTZWxlY3QuYWRkKG5ldyBPcHRpb24oJ2dwdC1hJywgJ2dwdC1hJykpO1xuXHRcdG1vZGVsU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdncHQtYicsICdncHQtYicpKTtcblx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbignZ3B0LWMnLCAnZ3B0LWMnKSk7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGdhdGVSb3cuaGlkZGVuID0gdHJ1ZTtcblx0XHRjb25zdCBnYXRlTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNhdGFsb2dNb2RlbElkcyxcblx0XHRcdG1vZGVsU2VsZWN0ZWRJbmRleDogMSxcblx0XHRcdG1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQsXG5cdFx0XHRzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQ6IG5ldyBNYXA8c3RyaW5nLCB7IGFnZW50SW5kZXg6IG51bWJlcjsgcGVybWlzc2lvbkluZGV4OiBudW1iZXIgfT4oKSxcblx0XHRcdHBvc3RGYWlsdXJlVmlzaWJsZTogZmFsc2UsXG5cdFx0XHRnYXRlUm93LFxuXHRcdFx0Z2F0ZUxhYmVsLFxuXHRcdFx0c2VuZEJ1dHRvbjogeyBlbmFibGVkOiB0cnVlIH0sXG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAnJyB9LFxuXHRcdFx0cGVybWlzc2lvblNlbGVjdEJveDogeyBzZWxlY3QoKSB7IH0gfSxcblx0XHRcdGFnZW50U2VsZWN0Qm94OiB7IHNlbGVjdCgpIHsgfSB9LFxuXHRcdFx0bW9kZWxTZWxlY3RCb3g6IHtcblx0XHRcdFx0c2VsZWN0KGluZGV4OiBudW1iZXIpIHtcblx0XHRcdFx0XHRtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSBpbmRleDtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdFx0XHRzd2l0Y2hNb2RlbDogKCkgPT4gbmV3IFByb21pc2UoKF9yZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0XHRtb2RlbFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRcdHJlbGVhc2VNb2RlbCA9IHJlamVjdDtcblx0XHRcdFx0fSksXG5cdFx0XHR9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+IGJvdW5kU2Vzc2lvbklkLFxuXHRcdFx0dXBkYXRlU2VuZEVuYWJsZWQoKSB7IH0sXG5cdFx0fTtcblx0XHRjb25zdCB0eXBlZEhvc3QgPSBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG1vZGVsQXBwbHkgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KHR5cGVkSG9zdCwgJ3Nlc3MtYScsIDMpO1xuXHRcdFx0YXdhaXQgbW9kZWxFbnRlcmVkO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDMpO1xuXG5cdFx0XHRib3VuZFNlc3Npb25JZCA9ICdzZXNzLWInO1xuXHRcdFx0dHlwZWRIb3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCA9IDI7XG5cdFx0XHRtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gMjtcblx0XHRcdHJlbGVhc2VNb2RlbCEobmV3IEVycm9yKCdlbmdpbmUgcmVqZWN0ZWQgbW9kZWwnKSk7XG5cdFx0XHRhd2FpdCBtb2RlbEFwcGx5O1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYm91bmRTZXNzaW9uSWQsICdzZXNzLWInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkLmdldCgnc2Vzcy1hJyksICdncHQtYScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWInKSwgJ2dwdC1iJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0LnBvc3RGYWlsdXJlVmlzaWJsZSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVSb3cuaGlkZGVuLCB0cnVlKTtcblxuXHRcdFx0c3luY1Nlc3Npb25Db25maWdTZWxlY3RzKHR5cGVkSG9zdCwgJ3Nlc3MtYicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5jYXRhbG9nTW9kZWxJZHNbdHlwZWRIb3N0Lm1vZGVsU2VsZWN0ZWRJbmRleF0gPz8gJycsICdncHQtYicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWEnKSwgJ2dwdC1hJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIG92ZXJsYXBwaW5nTW9kZWxIb3N0KCk6IHtcblx0XHRob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdDtcblx0XHRtb2RlbFNlbGVjdDogSFRNTFNlbGVjdEVsZW1lbnQ7XG5cdFx0bW9kZWxDYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZWxJZDogc3RyaW5nIH1bXTtcblx0XHRwb3N0ZWQ6IENvbnZlcnNhdGlvbldyaXRlTWVzc2FnZVtdO1xuXHRcdGFybShyZXNwb25kZXI6IChtb2RlbElkOiBzdHJpbmcsIGNhbGw6IG51bWJlcikgPT4gUHJvbWlzZTx7IHJlc29sdmVkTW9kZWxJZDogc3RyaW5nOyBwcm92aWRlcjogc3RyaW5nOyBsZXZlbDogbnVtYmVyOyBjb3N0OiBzdHJpbmc7IHNwZWVkOiBzdHJpbmcgfT4pOiB2b2lkO1xuXHR9IHtcblx0XHRjb25zdCBjYXRhbG9nTW9kZWxJZHMgPSBbJycsICdncHQtYScsICdncHQtYiddO1xuXHRcdGNvbnN0IG1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHRcdGNvbnN0IG1vZGVsQ2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9W10gPSBbXTtcblx0XHRjb25zdCBwb3N0ZWQ6IENvbnZlcnNhdGlvbldyaXRlTWVzc2FnZVtdID0gW107XG5cdFx0Y29uc3QgbW9kZWxTZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcblx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbignTm8gbW9kZWwnLCAnJykpO1xuXHRcdG1vZGVsU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdncHQtYScsICdncHQtYScpKTtcblx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbignZ3B0LWInLCAnZ3B0LWInKSk7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGdhdGVSb3cuaGlkZGVuID0gdHJ1ZTtcblx0XHRjb25zdCBnYXRlTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0bGV0IHJlc3BvbmQ6ICgobW9kZWxJZDogc3RyaW5nLCBjYWxsOiBudW1iZXIpID0+IFByb21pc2U8eyByZXNvbHZlZE1vZGVsSWQ6IHN0cmluZzsgcHJvdmlkZXI6IHN0cmluZzsgbGV2ZWw6IG51bWJlcjsgY29zdDogc3RyaW5nOyBzcGVlZDogc3RyaW5nIH0+KSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y2F0YWxvZ01vZGVsSWRzLFxuXHRcdFx0bW9kZWxTZWxlY3RlZEluZGV4OiAwLFxuXHRcdFx0bW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZCxcblx0XHRcdHNlc3Npb25Db25maWdCeVNlc3Npb25JZDogbmV3IE1hcDxzdHJpbmcsIHsgYWdlbnRJbmRleDogbnVtYmVyOyBwZXJtaXNzaW9uSW5kZXg6IG51bWJlciB9PigpLFxuXHRcdFx0cG9zdEZhaWx1cmVWaXNpYmxlOiBmYWxzZSxcblx0XHRcdHN1Ym1pdEluRmxpZ2h0OiBmYWxzZSxcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScgYXMgY29uc3QsXG5cdFx0XHRkcmFmdHM6IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCksXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdoZWxsbycgfSxcblx0XHRcdHNlbmRCdXR0b246IHsgZW5hYmxlZDogdHJ1ZSB9LFxuXHRcdFx0Z2F0ZVJvdyxcblx0XHRcdGdhdGVMYWJlbCxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiB7IGdldFZhbHVlOiAoKSA9PiBmYWxzZSB9LFxuXHRcdFx0cGVybWlzc2lvblNlbGVjdEJveDogeyBzZWxlY3QoKSB7IH0gfSxcblx0XHRcdGFnZW50U2VsZWN0Qm94OiB7IHNlbGVjdCgpIHsgfSB9LFxuXHRcdFx0bW9kZWxTZWxlY3RCb3g6IHtcblx0XHRcdFx0c2VsZWN0KGluZGV4OiBudW1iZXIpIHtcblx0XHRcdFx0XHRtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSBpbmRleDtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdFx0XHRzd2l0Y2hNb2RlbDogKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9KSA9PiB7XG5cdFx0XHRcdFx0bW9kZWxDYWxscy5wdXNoKHsgc2Vzc2lvbklkOiByZXF1ZXN0LnNlc3Npb25JZCwgbW9kZWxJZDogcmVxdWVzdC5tb2RlbElkIH0pO1xuXHRcdFx0XHRcdGlmICghcmVzcG9uZCkge1xuXHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdzd2l0Y2hNb2RlbCByZXNwb25kZXIgd2FzIG5vdCBhcm1lZCcpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcmVzcG9uZChyZXF1ZXN0Lm1vZGVsSWQsIG1vZGVsQ2FsbHMubGVuZ3RoKTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7XG5cdFx0XHRcdHBvc3Q6IGFzeW5jIChtc2c6IENvbnZlcnNhdGlvbldyaXRlTWVzc2FnZSkgPT4ge1xuXHRcdFx0XHRcdHBvc3RlZC5wdXNoKG1zZyk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAnYzEnIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtbW9kZWwnLFxuXHRcdFx0cmVzZXRJbnB1dEhpc3RvcnlCcm93c2UoKSB7IH0sXG5cdFx0XHR1cGRhdGVTZW5kRW5hYmxlZCgpIHsgfSxcblx0XHRcdHVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlKCkgeyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlKCkgeyB9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhvc3Q6IGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdCxcblx0XHRcdG1vZGVsU2VsZWN0LFxuXHRcdFx0bW9kZWxDYWxscyxcblx0XHRcdHBvc3RlZCxcblx0XHRcdGFybShyZXNwb25kZXIpIHtcblx0XHRcdFx0cmVzcG9uZCA9IHJlc3BvbmRlcjtcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ292ZXJsYXBwaW5nIHN3aXRjaE1vZGVsIGZhaWx1cmUgZG9lcyBub3QgcmVzdG9yZSB0aGUgZHJvcGRvd24gdG8gdGhlIGVhcmxpZXIgaW5kZXgnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG92ZXJsYXBwaW5nTW9kZWxIb3N0KCk7XG5cdFx0bGV0IHJlbGVhc2VGaXJzdDogKChvdXRjb21lOiBFcnJvcikgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGZpcnN0U3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGZpcnN0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBmaXJzdFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBmaXJzdEhvbGQgPSBuZXcgUHJvbWlzZTxuZXZlcj4oKF9yZXNvbHZlLCByZWplY3QpID0+IHsgcmVsZWFzZUZpcnN0ID0gcmVqZWN0OyB9KTtcblx0XHRsZXQgcmVsZWFzZVNlY29uZDogKCh2YWx1ZTogeyByZXNvbHZlZE1vZGVsSWQ6IHN0cmluZyB9KSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgc2Vjb25kU3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHNlY29uZEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgc2Vjb25kU3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdGNvbnN0IHNlY29uZEhvbGQgPSBuZXcgUHJvbWlzZTx7IHJlc29sdmVkTW9kZWxJZDogc3RyaW5nIH0+KHJlc29sdmUgPT4geyByZWxlYXNlU2Vjb25kID0gcmVzb2x2ZTsgfSk7XG5cdFx0Zml4dHVyZS5hcm0oKG1vZGVsSWQsIGNhbGwpID0+IHtcblx0XHRcdGlmIChjYWxsID09PSAxKSB7XG5cdFx0XHRcdGZpcnN0U3RhcnRlZD8uKCk7XG5cdFx0XHRcdHJldHVybiBmaXJzdEhvbGQ7XG5cdFx0XHR9XG5cdFx0XHRzZWNvbmRTdGFydGVkPy4oKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbElkLCAnZ3B0LWInKTtcblx0XHRcdHJldHVybiBzZWNvbmRIb2xkLnRoZW4odmFsdWUgPT4gKHsgLi4udmFsdWUsIHByb3ZpZGVyOiAnJywgbGV2ZWw6IDAsIGNvc3Q6ICcnLCBzcGVlZDogJycgfSkpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGZpcnN0ID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLW1vZGVsJywgMSk7XG5cdFx0YXdhaXQgZmlyc3RFbnRlcmVkO1xuXHRcdGNvbnN0IHNlY29uZCA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1tb2RlbCcsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdHJlbGVhc2VGaXJzdCEobmV3IEVycm9yKCdzdGFsZSBtb2RlbCBmYWlsZWQnKSk7XG5cdFx0YXdhaXQgc2Vjb25kRW50ZXJlZDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQ/LmdldCgnc2Vzcy1tb2RlbCcpLCAnZ3B0LWEnKTtcblx0XHRyZWxlYXNlU2Vjb25kISh7IHJlc29sdmVkTW9kZWxJZDogJ2dwdC1iJyB9KTtcblx0XHRhd2FpdCBmaXJzdDtcblx0XHRhd2FpdCBzZWNvbmQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZD8uZ2V0KCdzZXNzLW1vZGVsJyksICdncHQtYicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbENhbGxzLm1hcChjYWxsID0+IGNhbGwubW9kZWxJZCksIFsnZ3B0LWEnLCAnZ3B0LWInXSk7XG5cdFx0YXdhaXQgc3VibWl0RHJhZnQoZml4dHVyZS5ob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIFt7XG5cdFx0XHRraW5kOiAnc3VibWl0SW5wdXQnLFxuXHRcdFx0dGV4dDogJ2hlbGxvJyxcblx0XHRcdG1vZGVsUHJvZmlsZUlkOiAnZ3B0LWInLFxuXHRcdH1dKTtcblx0fSk7XG5cblx0dGVzdCgnb3ZlcmxhcHBpbmcgc3dpdGNoTW9kZWwgc3VjY2VzcyBkb2VzIG5vdCBrZWVwIHRoZSBlYXJsaWVyIG1vZGVsSWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG92ZXJsYXBwaW5nTW9kZWxIb3N0KCk7XG5cdFx0bGV0IHJlbGVhc2VGaXJzdDogKCh2YWx1ZTogeyByZXNvbHZlZE1vZGVsSWQ6IHN0cmluZyB9KSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgZmlyc3RTdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgZmlyc3RFbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IGZpcnN0U3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdGNvbnN0IGZpcnN0SG9sZCA9IG5ldyBQcm9taXNlPHsgcmVzb2x2ZWRNb2RlbElkOiBzdHJpbmcgfT4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VGaXJzdCA9IHJlc29sdmU7IH0pO1xuXHRcdGZpeHR1cmUuYXJtKChtb2RlbElkLCBjYWxsKSA9PiB7XG5cdFx0XHRpZiAoY2FsbCA9PT0gMSkge1xuXHRcdFx0XHRmaXJzdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRyZXR1cm4gZmlyc3RIb2xkLnRoZW4odmFsdWUgPT4gKHsgLi4udmFsdWUsIHByb3ZpZGVyOiAnJywgbGV2ZWw6IDAsIGNvc3Q6ICcnLCBzcGVlZDogJycgfSkpO1xuXHRcdFx0fVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsSWQsICdncHQtYicpO1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IHJlc29sdmVkTW9kZWxJZDogbW9kZWxJZCwgcHJvdmlkZXI6ICcnLCBsZXZlbDogMCwgY29zdDogJycsIHNwZWVkOiAnJyB9KTtcblx0XHR9KTtcblx0XHRjb25zdCBmaXJzdCA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1tb2RlbCcsIDEpO1xuXHRcdGF3YWl0IGZpcnN0RW50ZXJlZDtcblx0XHRjb25zdCBzZWNvbmQgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbW9kZWwnLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRyZWxlYXNlRmlyc3QhKHsgcmVzb2x2ZWRNb2RlbElkOiAnZ3B0LWEnIH0pO1xuXHRcdGF3YWl0IGZpcnN0O1xuXHRcdGF3YWl0IHNlY29uZDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQ/LmdldCgnc2Vzcy1tb2RlbCcpLCAnZ3B0LWInKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQ/LmdldCgnc2Vzcy1tb2RlbCcpLCAnZ3B0LWEnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxDYWxscy5tYXAoY2FsbCA9PiBjYWxsLm1vZGVsSWQpLCBbJ2dwdC1hJywgJ2dwdC1iJ10pO1xuXHRcdGF3YWl0IHN1Ym1pdERyYWZ0KGZpeHR1cmUuaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCBbe1xuXHRcdFx0a2luZDogJ3N1Ym1pdElucHV0Jyxcblx0XHRcdHRleHQ6ICdoZWxsbycsXG5cdFx0XHRtb2RlbFByb2ZpbGVJZDogJ2dwdC1iJyxcblx0XHR9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N1Ym1pdERyYWZ0IG9taXRzIG1vZGVsUHJvZmlsZUlkIHdoZW4gdGhlIHNldHRsZWQgbW9kZWwgaW5kZXggaXMgMCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gb3ZlcmxhcHBpbmdNb2RlbEhvc3QoKTtcblx0XHRsZXQgcmVsZWFzZU1vZGVsOiAoKG91dGNvbWU6IEVycm9yKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgbW9kZWxTdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgbW9kZWxFbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IG1vZGVsU3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdGNvbnN0IG1vZGVsSG9sZCA9IG5ldyBQcm9taXNlPG5ldmVyPigoX3Jlc29sdmUsIHJlamVjdCkgPT4geyByZWxlYXNlTW9kZWwgPSByZWplY3Q7IH0pO1xuXHRcdGZpeHR1cmUuYXJtKCgpID0+IHtcblx0XHRcdG1vZGVsU3RhcnRlZD8uKCk7XG5cdFx0XHRyZXR1cm4gbW9kZWxIb2xkO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGFwcGx5ID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLW1vZGVsJywgMSk7XG5cdFx0YXdhaXQgbW9kZWxFbnRlcmVkO1xuXHRcdHJlbGVhc2VNb2RlbCEobmV3IEVycm9yKCdtb2RlbCByZWplY3RlZCcpKTtcblx0XHRhd2FpdCBhcHBseTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbW9kZWwnKSwgdW5kZWZpbmVkKTtcblx0XHRhd2FpdCBzdWJtaXREcmFmdChmaXh0dXJlLmhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgW3sga2luZDogJ3N1Ym1pdElucHV0JywgdGV4dDogJ2hlbGxvJyB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NlbGVjdGluZyB0aGUgZW1wdHkgbW9kZWwgZG9lcyBub3Qgc2VuZCBzd2l0Y2hNb2RlbCBhbmQgYSBzdGFsZSBmYWlsdXJlIGRvZXMgbm90IGZvcmNlIGluZGV4IDAnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG92ZXJsYXBwaW5nTW9kZWxIb3N0KCk7XG5cdFx0bGV0IHJlbGVhc2VNb2RlbDogKChvdXRjb21lOiBFcnJvcikgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IG1vZGVsU3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVsRW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBtb2RlbFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBtb2RlbEhvbGQgPSBuZXcgUHJvbWlzZTxuZXZlcj4oKF9yZXNvbHZlLCByZWplY3QpID0+IHsgcmVsZWFzZU1vZGVsID0gcmVqZWN0OyB9KTtcblx0XHRmaXh0dXJlLmFybSgoKSA9PiB7XG5cdFx0XHRtb2RlbFN0YXJ0ZWQ/LigpO1xuXHRcdFx0cmV0dXJuIG1vZGVsSG9sZDtcblx0XHR9KTtcblx0XHRjb25zdCBmaXJzdCA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1tb2RlbCcsIDEpO1xuXHRcdGF3YWl0IG1vZGVsRW50ZXJlZDtcblx0XHRjb25zdCBzZWNvbmQgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbW9kZWwnLCAyKTtcblx0XHRhd2FpdCBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbW9kZWwnLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxDYWxscy5tYXAoY2FsbCA9PiBjYWxsLm1vZGVsSWQpLCBbJ2dwdC1hJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdHJlbGVhc2VNb2RlbCEobmV3IEVycm9yKCdzdGFsZSBtb2RlbCBmYWlsZWQnKSk7XG5cdFx0YXdhaXQgZmlyc3Q7XG5cdFx0YXdhaXQgc2Vjb25kO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbENhbGxzLm1hcChjYWxsID0+IGNhbGwubW9kZWxJZCksIFsnZ3B0LWEnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbW9kZWwnKSwgJ2dwdC1hJyk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHBlcm1pc3Npb25BcHBseUJvdW5kU2Vzc2lvbkhvc3QoKToge1xuXHRcdGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdHBlcm1pc3Npb25TZWxlY3Q6IEhUTUxTZWxlY3RFbGVtZW50O1xuXHRcdHBlcm1pc3Npb25FbnRlcmVkOiBQcm9taXNlPHZvaWQ+O1xuXHRcdHNldFBhaXJpbmdQZW5kaW5nKHBlbmRpbmc6IGJvb2xlYW4pOiB2b2lkO1xuXHRcdHJlbGVhc2VQZXJtaXNzaW9uKG91dGNvbWU6IHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfSB8IEVycm9yKTogdm9pZDtcblx0XHRiaW5kQldpdGhTeW5jZWRTZWxlY3QoKTogdm9pZDtcblx0XHRkaXNwb3NlKCk6IHZvaWQ7XG5cdH0ge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25TZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdBc2snLCAnMCcpKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdBZ2VudCcsICcxJykpO1xuXHRcdHBlcm1pc3Npb25TZWxlY3QuYWRkKG5ldyBPcHRpb24oJ1Blcm1pdCcsICcyJykpO1xuXHRcdHBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCA9IDA7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGdhdGVSb3cuaGlkZGVuID0gdHJ1ZTtcblx0XHRjb25zdCBnYXRlTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0Y29uc3Qgc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkID0gbmV3IE1hcDxzdHJpbmcsIHsgYWdlbnRJbmRleDogbnVtYmVyOyBwZXJtaXNzaW9uSW5kZXg6IG51bWJlciB9PihbXG5cdFx0XHRbJ3Nlc3MtQScsIHsgYWdlbnRJbmRleDogMCwgcGVybWlzc2lvbkluZGV4OiAwIH1dLFxuXHRcdFx0WydzZXNzLUInLCB7IGFnZW50SW5kZXg6IDAsIHBlcm1pc3Npb25JbmRleDogMSB9XSxcblx0XHRdKTtcblx0XHRsZXQgYm91bmRTZXNzaW9uSWQgPSAnc2Vzcy1BJztcblx0XHRsZXQgcGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRsZXQgcmVsZWFzZVBlcm1pc3Npb24hOiAob3V0Y29tZTogeyBvazogYm9vbGVhbjsgbWVzc2FnZT86IHN0cmluZyB9IHwgRXJyb3IpID0+IHZvaWQ7XG5cdFx0bGV0IHBlcm1pc3Npb25TdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcGVybWlzc2lvbkVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgcGVybWlzc2lvblN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBwZXJtaXNzaW9uSG9sZCA9IG5ldyBQcm9taXNlPHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0cmVsZWFzZVBlcm1pc3Npb24gPSBvdXRjb21lID0+IHtcblx0XHRcdFx0aWYgKG91dGNvbWUgaW5zdGFuY2VvZiBFcnJvcikge1xuXHRcdFx0XHRcdHJlamVjdChvdXRjb21lKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzb2x2ZShvdXRjb21lKTtcblx0XHRcdH07XG5cdFx0fSk7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdHNlc3Npb25Db25maWdCeVNlc3Npb25JZCxcblx0XHRcdHBvc3RGYWlsdXJlVmlzaWJsZTogZmFsc2UsXG5cdFx0XHRzZW5kRmFpbHVyZVRpbWVvdXQ6IHVuZGVmaW5lZCBhcyBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IHVuZGVmaW5lZCxcblx0XHRcdHBlcm1pc3Npb25TZWxlY3RCb3g6IHtcblx0XHRcdFx0c2V0RW5hYmxlZCgpIHsgfSxcblx0XHRcdFx0c2V0QXJpYUxhYmVsKCkgeyB9LFxuXHRcdFx0XHRzZWxlY3QoaW5kZXg6IG51bWJlcikgeyBwZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXggPSBpbmRleDsgfSxcblx0XHRcdH0sXG5cdFx0XHRnYXRlUm93LFxuXHRcdFx0Z2F0ZUxhYmVsLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHBlcm1pc3Npb25TdGFydGVkPy4oKTtcblx0XHRcdFx0XHRyZXR1cm4gcGVybWlzc2lvbkhvbGQ7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+IGJvdW5kU2Vzc2lvbklkLFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhvc3Q6IGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdCxcblx0XHRcdHBlcm1pc3Npb25TZWxlY3QsXG5cdFx0XHRwZXJtaXNzaW9uRW50ZXJlZCxcblx0XHRcdHNldFBhaXJpbmdQZW5kaW5nKHBlbmRpbmc6IGJvb2xlYW4pIHtcblx0XHRcdFx0cGFpcmluZ1BlbmRpbmcgPSBwZW5kaW5nO1xuXHRcdFx0fSxcblx0XHRcdHJlbGVhc2VQZXJtaXNzaW9uLFxuXHRcdFx0YmluZEJXaXRoU3luY2VkU2VsZWN0KCkge1xuXHRcdFx0XHRib3VuZFNlc3Npb25JZCA9ICdzZXNzLUInO1xuXHRcdFx0XHRwZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXggPSBzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLUInKSEucGVybWlzc2lvbkluZGV4O1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHN0b3JlLmRpc3Bvc2UoKSxcblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnaW4tZmxpZ2h0IHBlcm1pc3Npb24gZmFpbCBhZnRlciBzd2l0Y2ggdG8gQiBkb2VzIG5vdCByb2xsIGJhY2sgQiBzZWxlY3Qgb3IgcGFpbnQgQiBub3RpY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IHBlcm1pc3Npb25BcHBseUJvdW5kU2Vzc2lvbkhvc3QoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYXBwbHkgPSBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1BJywgMik7XG5cdFx0XHRhd2FpdCBmaXh0dXJlLnBlcm1pc3Npb25FbnRlcmVkO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLUEnKT8ucGVybWlzc2lvbkluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0XHRmaXh0dXJlLmJpbmRCV2l0aFN5bmNlZFNlbGVjdCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGZpeHR1cmUucmVsZWFzZVBlcm1pc3Npb24oeyBvazogZmFsc2UsIG1lc3NhZ2U6ICdlbmdpbmUgcmVqZWN0ZWQgcGVybWl0JyB9KTtcblx0XHRcdGF3YWl0IGFwcGx5O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLUEnKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1CJyk/LnBlcm1pc3Npb25JbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlUm93LmhpZGRlbiwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVMYWJlbC50ZXh0Q29udGVudCwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIGZhbHNlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdpbi1mbGlnaHQgcGVybWlzc2lvbiB0aHJvdyBhZnRlciBzd2l0Y2ggdG8gQiBkb2VzIG5vdCByb2xsIGJhY2sgQiBzZWxlY3Qgb3IgcGFpbnQgQiBub3RpY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IHBlcm1pc3Npb25BcHBseUJvdW5kU2Vzc2lvbkhvc3QoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYXBwbHkgPSBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1BJywgMik7XG5cdFx0XHRhd2FpdCBmaXh0dXJlLnBlcm1pc3Npb25FbnRlcmVkO1xuXHRcdFx0Zml4dHVyZS5iaW5kQldpdGhTeW5jZWRTZWxlY3QoKTtcblx0XHRcdGZpeHR1cmUucmVsZWFzZVBlcm1pc3Npb24obmV3IEVycm9yKCdzZXRQZXJtaXNzaW9uTW9kZSBib29tJykpO1xuXHRcdFx0YXdhaXQgYXBwbHk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtQScpPy5wZXJtaXNzaW9uSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLUInKT8ucGVybWlzc2lvbkluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVSb3cuaGlkZGVuLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZ2F0ZUxhYmVsLnRleHRDb250ZW50LCAnJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnBvc3RGYWlsdXJlVmlzaWJsZSwgZmFsc2UpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2luLWZsaWdodCBsZWZ0b3ZlciBwZXJtaXNzaW9uIGFmdGVyIHN3aXRjaCB0byBCIGtlZXBzIEEgYWNjZXB0ZWQgdmFsdWUgYW5kIGRvZXMgbm90IHJvbGwgYmFjayBCIHNlbGVjdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gcGVybWlzc2lvbkFwcGx5Qm91bmRTZXNzaW9uSG9zdCgpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhcHBseSA9IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLUEnLCAyKTtcblx0XHRcdGF3YWl0IGZpeHR1cmUucGVybWlzc2lvbkVudGVyZWQ7XG5cdFx0XHRmaXh0dXJlLmJpbmRCV2l0aFN5bmNlZFNlbGVjdCgpO1xuXHRcdFx0Zml4dHVyZS5zZXRQYWlyaW5nUGVuZGluZyh0cnVlKTtcblx0XHRcdGZpeHR1cmUucmVsZWFzZVBlcm1pc3Npb24oeyBvazogdHJ1ZSB9KTtcblx0XHRcdGF3YWl0IGFwcGx5O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLUEnKT8ucGVybWlzc2lvbkluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1CJyk/LnBlcm1pc3Npb25JbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlUm93LmhpZGRlbiwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVMYWJlbC50ZXh0Q29udGVudCwgJycpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3Blcm1pc3Npb24gYXBwbHkgZm9yIEEgd2hpbGUgYm91bmQgdG8gQiB3cml0ZXMgQSBjb25maWcgYW5kIGRvZXMgbm90IHNlbGVjdCBCIGJveCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gcGVybWlzc2lvbkFwcGx5Qm91bmRTZXNzaW9uSG9zdCgpO1xuXHRcdHRyeSB7XG5cdFx0XHRmaXh0dXJlLmJpbmRCV2l0aFN5bmNlZFNlbGVjdCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGNvbnN0IGFwcGx5ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtQScsIDIpO1xuXHRcdFx0YXdhaXQgZml4dHVyZS5wZXJtaXNzaW9uRW50ZXJlZDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1BJyk/LnBlcm1pc3Npb25JbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0Zml4dHVyZS5yZWxlYXNlUGVybWlzc2lvbih7IG9rOiB0cnVlIH0pO1xuXHRcdFx0YXdhaXQgYXBwbHk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtQScpPy5wZXJtaXNzaW9uSW5kZXgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLUInKT8ucGVybWlzc2lvbkluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVSb3cuaGlkZGVuLCB0cnVlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdwZXJtaXNzaW9uIGFwcGx5IGZhaWwgd2hpbGUgc3RpbGwgb24gQSBzdGlsbCByb2xscyBiYWNrIHNlbGVjdCBhbmQgc2hvd3MgZ2F0ZSBub3RpY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdWFDb25uZWN0aW9uID0gZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiBhcyB7XG5cdFx0XHRcdHNldFBlcm1pc3Npb25Nb2RlOiAocmVxdWVzdDogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZTogc3RyaW5nIH0pID0+IFByb21pc2U8eyBvazogYm9vbGVhbjsgbWVzc2FnZT86IHN0cmluZyB9Pjtcblx0XHRcdH07XG5cdFx0XHR1YUNvbm5lY3Rpb24uc2V0UGVybWlzc2lvbk1vZGUgPSBhc3luYyAoKSA9PiAoeyBvazogZmFsc2UsIG1lc3NhZ2U6ICdlbmdpbmUgcmVqZWN0ZWQgcGVybWl0JyB9KTtcblx0XHRcdGF3YWl0IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVSb3cuaGlkZGVuLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQub2soZml4dHVyZS5ob3N0LmdhdGVMYWJlbC50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ2VuZ2luZSByZWplY3RlZCBwZXJtaXQnKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnBvc3RGYWlsdXJlVmlzaWJsZSwgdHJ1ZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnb3ZlcmxhcHBpbmcgc2V0UGVybWlzc2lvbk1vZGUga2VlcHMgQXNrIHdoZW4gYW4gZWFybGllciBQZXJtaXQgc3VjY2VlZHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlbGVhc2VQZXJtaXQ6ICgodmFsdWU6IHsgb2s6IHRydWUgfSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgcGVybWl0U3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgcGVybWl0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBwZXJtaXRTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCBwZXJtaXRIb2xkID0gbmV3IFByb21pc2U8eyBvazogdHJ1ZSB9PihyZXNvbHZlID0+IHsgcmVsZWFzZVBlcm1pdCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0bGV0IGNhbGxzID0gMDtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24gYXMge1xuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9KSA9PiBQcm9taXNlPHsgb2s6IGJvb2xlYW4gfT47XG5cdFx0XHR9O1xuXHRcdFx0dWFDb25uZWN0aW9uLnNldFBlcm1pc3Npb25Nb2RlID0gYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdGNhbGxzKys7XG5cdFx0XHRcdGlmIChjYWxscyA9PT0gMSkge1xuXHRcdFx0XHRcdHBlcm1pdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRcdHJldHVybiBwZXJtaXRIb2xkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7IG9rOiB0cnVlIH07XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcGVybWl0ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGF3YWl0IHBlcm1pdEVudGVyZWQ7XG5cdFx0XHRjb25zdCBhc2sgPSBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25DYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0cmVsZWFzZVBlcm1pdCEoeyBvazogdHJ1ZSB9KTtcblx0XHRcdGF3YWl0IHBlcm1pdDtcblx0XHRcdGF3YWl0IGFzaztcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5tb2RlKSwgW1xuXHRcdFx0XHQnU0VTU0lPTl9UT09MX1BFUk1JU1NJT05fTU9ERV9QRVJNSVQnLFxuXHRcdFx0XHQnU0VTU0lPTl9UT09MX1BFUk1JU1NJT05fTU9ERV9BU0snLFxuXHRcdFx0XSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnb3ZlcmxhcHBpbmcgc2V0UGVybWlzc2lvbk1vZGUgZmFpbHVyZSBkb2VzIG5vdCByZXN0b3JlIHRoZSBuZXdlciBjaG9pY2UgdG8gdGhlIGVhcmxpZXIgcHJldmlvdXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlbGVhc2VGaXJzdDogKCh2YWx1ZTogeyBvazogYm9vbGVhbjsgbWVzc2FnZT86IHN0cmluZyB9KSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBmaXJzdFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGZpcnN0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBmaXJzdFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IGZpcnN0SG9sZCA9IG5ldyBQcm9taXNlPHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfT4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VGaXJzdCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0bGV0IHJlbGVhc2VTZWNvbmQ6ICgodmFsdWU6IHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgc2Vjb25kU3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3Qgc2Vjb25kRW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBzZWNvbmRTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCBzZWNvbmRIb2xkID0gbmV3IFByb21pc2U8eyBvazogYm9vbGVhbjsgbWVzc2FnZT86IHN0cmluZyB9PihyZXNvbHZlID0+IHsgcmVsZWFzZVNlY29uZCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0bGV0IGNhbGxzID0gMDtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24gYXMge1xuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9KSA9PiBQcm9taXNlPHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfT47XG5cdFx0XHR9O1xuXHRcdFx0dWFDb25uZWN0aW9uLnNldFBlcm1pc3Npb25Nb2RlID0gYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdGNhbGxzKys7XG5cdFx0XHRcdGlmIChjYWxscyA9PT0gMSkge1xuXHRcdFx0XHRcdGZpcnN0U3RhcnRlZD8uKCk7XG5cdFx0XHRcdFx0cmV0dXJuIGZpcnN0SG9sZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWNvbmRTdGFydGVkPy4oKTtcblx0XHRcdFx0cmV0dXJuIHNlY29uZEhvbGQ7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcGVybWl0ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGF3YWl0IGZpcnN0RW50ZXJlZDtcblx0XHRcdGNvbnN0IGFnZW50ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdHJlbGVhc2VGaXJzdCEoeyBvazogZmFsc2UsIG1lc3NhZ2U6ICdzdGFsZSBwZXJtaXQgZmFpbGVkJyB9KTtcblx0XHRcdGF3YWl0IHNlY29uZEVudGVyZWQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMSk7XG5cdFx0XHQvLyBUaGUgc3RhbGUgUGVybWl0IGZhaWx1cmUgbXVzdCBub3QgcGFpbnQgYSBub3RpY2Ugb3Igcm9sbCB0aGUgc2VsZWN0IGJhY2suXG5cdFx0XHQvLyBnYXRlUm93IHN0YXJ0cyB2aXNpYmxlOyB0aGUgZmFpbHVyZSBmbGFnIGFuZCBsYWJlbCBhcmUgdGhlIG5vdGljZSBzaWduYWwuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnBvc3RGYWlsdXJlVmlzaWJsZSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlTGFiZWwudGV4dENvbnRlbnQsICcnKTtcblx0XHRcdHJlbGVhc2VTZWNvbmQhKHsgb2s6IGZhbHNlLCBtZXNzYWdlOiAnYWdlbnQgZmFpbGVkJyB9KTtcblx0XHRcdGF3YWl0IHBlcm1pdDtcblx0XHRcdGF3YWl0IGFnZW50O1xuXHRcdFx0Ly8gTGF0ZXN0IGZhaWx1cmUgcm9sbHMgYmFjayB0byB0aGUgbGFzdCBlbmdpbmUtY29uZmlybWVkIG1vZGUgKEFzayksIG5vdCB0aGVcblx0XHRcdC8vIHVuY29uZmlybWVkIFBlcm1pdCBpbmRleCB0aGlzIHJlcXVlc3Qgc3RhcnRlZCBmcm9tLlxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25DYWxscy5tYXAoY2FsbCA9PiBjYWxsLm1vZGUpLCBbXG5cdFx0XHRcdCdTRVNTSU9OX1RPT0xfUEVSTUlTU0lPTl9NT0RFX1BFUk1JVCcsXG5cdFx0XHRcdCdTRVNTSU9OX1RPT0xfUEVSTUlTU0lPTl9NT0RFX0FHRU5UJyxcblx0XHRcdF0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlUm93LmhpZGRlbiwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIHRydWUpO1xuXHRcdFx0YXNzZXJ0Lm9rKGZpeHR1cmUuaG9zdC5nYXRlTGFiZWwudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdhZ2VudCBmYWlsZWQnKSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBwYWlyaW5nLWhvbGQgVHVuZSBvdmVybGF5IHN0aWxsIHBhaW50cyBsZWZ0b3ZlciBjYXRhbG9nJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7IGNhdGFsb2dUb29sTmFtZXM6IFsnYmFzaCcsICdyZWFkJ10gfSk7XG5cdFx0dHJ5IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0XHR0b2dnbGVUdW5lQ29udGV4dFZpZXcoZml4dHVyZS5ob3N0KTtcblx0XHRcdGNvbnN0IHBvcHVwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpO1xuXHRcdFx0YXNzZXJ0Lm9rKHBvcHVwKTtcblx0XHRcdGFzc2VydC5vayhwb3B1cC50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ2Jhc2gnKSk7XG5cdFx0XHRhc3NlcnQub2socG9wdXAudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdyZWFkJykpO1xuXHRcdFx0YXNzZXJ0Lm9rKHBvcHVwLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUtbGlzdCcpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwb3B1cC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLWZpbHRlcicpLCBudWxsKTtcblx0XHRcdGFzc2VydC5vayghcG9wdXAudGV4dENvbnRlbnQ/LmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9Ub29scykpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFwb3B1cC50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc0RvY2tOb0VuZ2luZVRvb2xzKSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnVHVuZSBvdmVybGF5IGRpc21pc3NlcyBvbiBhbiBvdXRzaWRlIGNsaWNrIGRlbGl2ZXJlZCBhcyBhIFN0YW5kYXJkTW91c2VFdmVudCcsICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3QoeyBjYXRhbG9nVG9vbE5hbWVzOiBbJ2Jhc2gnLCAncmVhZCddIH0pO1xuXHRcdGNvbnN0IG91dHNpZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG91dHNpZGUpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBtdXRhYmxlSG9zdCA9IGZpeHR1cmUuaG9zdCBhcyB1bmtub3duIGFzIHsgY29udGV4dFZpZXdTZXJ2aWNlOiB7IHNob3dDb250ZXh0VmlldyhkZWxlZ2F0ZTogeyBvbkRPTUV2ZW50PyhlOiB1bmtub3duKTogdm9pZCB9KTogdW5rbm93biB9IH07XG5cdFx0XHRjb25zdCBvcmlnaW5hbCA9IG11dGFibGVIb3N0LmNvbnRleHRWaWV3U2VydmljZTtcblx0XHRcdGxldCBkZWxlZ2F0ZTogeyBvbkRPTUV2ZW50PyhlOiB1bmtub3duKTogdm9pZCB9IHwgdW5kZWZpbmVkO1xuXHRcdFx0bXV0YWJsZUhvc3QuY29udGV4dFZpZXdTZXJ2aWNlID0ge1xuXHRcdFx0XHRzaG93Q29udGV4dFZpZXcoZCkge1xuXHRcdFx0XHRcdGRlbGVnYXRlID0gZDtcblx0XHRcdFx0XHRyZXR1cm4gb3JpZ2luYWwuc2hvd0NvbnRleHRWaWV3KGQpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fTtcblx0XHRcdHRvZ2dsZVR1bmVDb250ZXh0VmlldyhmaXh0dXJlLmhvc3QpO1xuXHRcdFx0YXNzZXJ0Lm9rKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUtcG9wdXAnKSk7XG5cdFx0XHRhc3NlcnQub2soZGVsZWdhdGU/Lm9uRE9NRXZlbnQpO1xuXG5cdFx0XHQvLyBDb250ZXh0VmlldyByZWdpc3RlcnMgdGhyb3VnaCBhZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcjogYGNsaWNrYCBhcnJpdmVzIHdyYXBwZWQsIHdpdGggbm8gYHR5cGVgLlxuXHRcdFx0b3V0c2lkZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4gZGVsZWdhdGUhLm9uRE9NRXZlbnQhKG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQobWFpbldpbmRvdywgZSkpKTtcblx0XHRcdG91dHNpZGUuY2xpY2soKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLXBvcHVwJyksIG51bGwpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRvdXRzaWRlLnJlbW92ZSgpO1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdUdW5lIG92ZXJsYXkgc2Nyb2xscyBhIGxvbmcgY2F0YWxvZyBhbmQgRW5naW5lIHRvb2xzIG9wZW5zIHRoZSBUb29scyBzZWN0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IG5hbWVzID0gWy4uLkFycmF5LmZyb20oeyBsZW5ndGg6IDEyIH0sIChfLCBpbmRleCkgPT4gYHRvb2xfJHtpbmRleH1gKSwgJ2ZpbGVfZGVsZXRlJ107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHsgY2F0YWxvZ1Rvb2xOYW1lczogbmFtZXMgfSk7XG5cdFx0dHJ5IHtcblx0XHRcdHRvZ2dsZVR1bmVDb250ZXh0VmlldyhmaXh0dXJlLmhvc3QpO1xuXHRcdFx0Y29uc3QgcG9wdXAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLXBvcHVwJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHRhc3NlcnQub2socG9wdXApO1xuXHRcdFx0Y29uc3QgbGlzdCA9IHBvcHVwLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUtbGlzdCcpIGFzIEhUTUxFbGVtZW50O1xuXHRcdFx0Y29uc3Qgbm90ZSA9IHBvcHVwLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUtbm90ZScpIGFzIEhUTUxFbGVtZW50O1xuXHRcdFx0YXNzZXJ0Lm9rKGxpc3QpO1xuXHRcdFx0YXNzZXJ0Lm9rKG5vdGUpO1xuXHRcdFx0YXNzZXJ0Lm9rKG5vdGUuY29tcGFyZURvY3VtZW50UG9zaXRpb24obGlzdCkgJiBOb2RlLkRPQ1VNRU5UX1BPU0lUSU9OX0ZPTExPV0lORyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9wdXAucXVlcnlTZWxlY3RvckFsbCgnLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS10b29sJykubGVuZ3RoLCBuYW1lcy5sZW5ndGgpO1xuXHRcdFx0Y29uc3QgZmlsdGVyID0gcG9wdXAucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1maWx0ZXInKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuXHRcdFx0YXNzZXJ0Lm9rKGZpbHRlcik7XG5cdFx0XHRmaWx0ZXIudmFsdWUgPSAnZmlsZV9kZWwnO1xuXHRcdFx0ZmlsdGVyLmRpc3BhdGNoRXZlbnQobmV3IGZpbHRlci5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3IS5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdFx0Y29uc3QgdmlzaWJsZSA9IFsuLi5wb3B1cC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLXRvb2wnKV0uZmlsdGVyKHJvdyA9PiAhKHJvdyBhcyBIVE1MRWxlbWVudCkuaGlkZGVuKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZS5tYXAocm93ID0+IHJvdy50ZXh0Q29udGVudCksIFsnZmlsZV9kZWxldGUnXSk7XG5cblx0XHRcdGNvbnN0IG9wZW4gPSBwb3B1cC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLW9wZW4nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRcdG9wZW4uY2xpY2soKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5leGVjdXRlZENvbW1hbmRzLCBbe1xuXHRcdFx0XHRpZDogT1BFTl9FTkdJTkVfUFJFRkVSRU5DRVNfQ09NTUFORF9JRCxcblx0XHRcdFx0YXJnczogW0VOR0lORV9UT09MU19aT05FXSxcblx0XHRcdH1dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLXBvcHVwJyksIG51bGwpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbmNlbFRvb2xDYWxsIHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBkb2VzIG5vdCB3cml0ZSBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0LCBwb3N0ZWQgfSA9IHBhaXJpbmdIb2xkTGVmdG92ZXJXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGxldCBjYW5jZWxDYWxscyA9IDA7XG5cdFx0KGhvc3QgYXMgdW5rbm93biBhcyB7IHN0dWJTZXJ2aWNlOiB7IGNhbmNlbFRvb2xDYWxsOiAoKSA9PiBib29sZWFuIH0gfSkuc3R1YlNlcnZpY2UuY2FuY2VsVG9vbENhbGwgPSAoKSA9PiB7XG5cdFx0XHRjYW5jZWxDYWxscysrO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblx0XHRjYW5jZWxUb29sQ2FsbChob3N0LCB7IGlkOiAnZS1ydW4nLCB0b29sQ2FsbElkOiAndGMtMScsIGFnZW50SWQ6ICdzdWI6YScgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbmNlbENhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N1Ym1pdERyYWZ0IHBvc3RCb3VuZCByZWplY3Qgc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWF2ZSBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCByZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZCA9IChyZWFzb246IHVua25vd24pID0+IHsgcmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7IH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScsXG5cdFx0XHRzdWJtaXRJbkZsaWdodDogZmFsc2UsXG5cdFx0XHRtb2RlbFNlbGVjdGVkSW5kZXg6IDAsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdoZWxsbycgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHtcblx0XHRcdFx0cG9zdDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcigncG9zdEJvdW5kIGJvb20nKTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3Q7XG5cblx0XHRwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZCk7XG5cdFx0dHJ5IHtcblx0XHRcdHZvaWQgc3VibWl0RHJhZnQoaG9zdCk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVqZWN0aW9ucywgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3VibWl0SW5GbGlnaHQsIGZhbHNlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cHJvY2Vzcy5vZmYoJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIGRvY2sgc2VuZCBjbGljayBzdWJtaXREcmFmdCByZWplY3RzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG1vdW50RG9ja1dpdGhSZWplY3RpbmdTdWJtaXREcmFmdChwYWludEJvb20pO1xuXHRcdHRyeSB7XG5cdFx0XHRmaXh0dXJlLmhvc3QuZG9ja1RleHRhcmVhLnZhbHVlID0gJyc7XG5cdFx0XHRmaXh0dXJlLmhvc3Quc2VuZEJ1dHRvbi5lbmFibGVkID0gdHJ1ZTtcblx0XHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4ge1xuXHRcdFx0XHRmaXh0dXJlLmhvc3Quc2VuZEJ1dHRvbi5lbGVtZW50LmNsaWNrKCk7XG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdlbmFibGVkIHNlbmQgY2xpY2sgc3VibWl0cyBvbmNlIGFuZCBhIGRpc2FibGVkIHNlbmQgY2xpY2sgZG9lcyBub3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IGNhbGxzID0gMDtcblx0XHRjb25zdCBmaXh0dXJlID0gbW91bnREb2NrV2l0aFN1Ym1pdChhc3luYyAoKSA9PiB7XG5cdFx0XHRjYWxscysrO1xuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRmaXh0dXJlLmhvc3QuZG9ja1RleHRhcmVhLnZhbHVlID0gJ2hlbGxvJztcblx0XHRcdGZpeHR1cmUuaG9zdC5zZW5kQnV0dG9uLmVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0Zml4dHVyZS5ob3N0LnNlbmRCdXR0b24uZWxlbWVudC5jbGljaygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLCAxLCAnb25lIHByZXNzIG9uIFNlbmQgbXVzdCBub3Qgc3VibWl0IHR3aWNlJyk7XG5cblx0XHRcdGNhbGxzID0gMDtcblx0XHRcdGZpeHR1cmUuaG9zdC5zZW5kQnV0dG9uLmVuYWJsZWQgPSBmYWxzZTtcblx0XHRcdGZpeHR1cmUuaG9zdC5zZW5kQnV0dG9uLmVsZW1lbnQuY2xpY2soKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscywgMCwgJ2EgZGlzYWJsZWQgU2VuZCBtdXN0IG5vdCBzdWJtaXQnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzYXZpbmcgYSB0dXJuIGVkaXQgZnJvbSBTZW5kIGRvZXMgbm90IGFsc28gcG9zdCB0aGUgcmVzdG9yZWQgY29tcG9zZSBkcmFmdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwb3N0ZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgdXBkYXRlczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbW91bnREb2NrV2l0aFN1Ym1pdChhc3luYyAoKSA9PiB7IH0pO1xuXHRcdGNvbnN0IGhvc3QgPSBmaXh0dXJlLmhvc3QgYXMgdW5rbm93biBhcyBPbWl0PElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0LCAnc3R1YlNlcnZpY2UnIHwgJ3VhQ29ubmVjdGlvbic+ICYge1xuXHRcdFx0Y29tcG9zZURyYWZ0U25hcHNob3Q6IHN0cmluZztcblx0XHRcdHN1Ym1pdERyYWZ0KCk6IFByb21pc2U8dm9pZD47XG5cdFx0XHRzdHViU2VydmljZTogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3RbJ3N0dWJTZXJ2aWNlJ107XG5cdFx0XHR1YUNvbm5lY3Rpb246IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0Wyd1YUNvbm5lY3Rpb24nXTtcblx0XHR9O1xuXHRcdGhvc3QuY29tcG9zZXJQb2xpY3kgPSAndHVybkVkaXQnO1xuXHRcdGhvc3QuZWRpdGluZ1R1cm5JZCA9ICd0MSc7XG5cdFx0aG9zdC5jb21wb3NlRHJhZnRTbmFwc2hvdCA9ICdzdGlsbCBkcmFmdGluZyc7XG5cdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSAwO1xuXHRcdGhvc3QuY2F0YWxvZ01vZGVsSWRzID0gWycnXTtcblx0XHRob3N0LnN1Ym1pdEluRmxpZ2h0ID0gZmFsc2U7XG5cdFx0aG9zdC5zdHViU2VydmljZSA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRnZXRUdXJuczogKCkgPT4gW3sgaWQ6ICd0MScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJ29yaWdpbmFsJywgdHVybklkOiAndDEnIH1dLFxuXHRcdFx0dXBkYXRlVXNlclR1cm5UZXh0OiAoX3Nlc3Npb25JZDogc3RyaW5nLCBfdHVybklkOiBzdHJpbmcsIHRleHQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHR1cGRhdGVzLnB1c2godGV4dCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3RbJ3N0dWJTZXJ2aWNlJ107XG5cdFx0aG9zdC51YUNvbm5lY3Rpb24gPSB7XG5cdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0Wyd1YUNvbm5lY3Rpb24nXTtcblx0XHRob3N0LnNlc3Npb25WaWV3TGVhc2UgPSB7XG5cdFx0XHRwb3N0OiBhc3luYyAobXNnOiBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2UpID0+IHtcblx0XHRcdFx0cG9zdGVkLnB1c2gobXNnLmtpbmQgPT09ICdzdWJtaXRJbnB1dCcgPyBtc2cudGV4dCA6ICcnKTtcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUgYXMgY29uc3QsIGNvcnJlbGF0aW9uOiB7IGlkOiAncG9zdGVkJyB9IH07XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdFsnc2Vzc2lvblZpZXdMZWFzZSddO1xuXHRcdGhvc3QuZXhpdENvbXBvc2VyRWRpdCA9ICgpID0+IHtcblx0XHRcdGhvc3QuY29tcG9zZXJQb2xpY3kgPSAnY29tcG9zZSc7XG5cdFx0XHRob3N0LmVkaXRpbmdUdXJuSWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSA9IGhvc3QuY29tcG9zZURyYWZ0U25hcHNob3Q7XG5cdFx0fTtcblx0XHRob3N0LnJlc2V0SW5wdXRIaXN0b3J5QnJvd3NlID0gKCkgPT4geyB9O1xuXHRcdGhvc3QucmVhZENvbXBvc2VyRHJhZnQgPSAoKSA9PiBob3N0LmNvbXBvc2VEcmFmdFNuYXBzaG90O1xuXHRcdGhvc3Quc2hvd1Bvc3RGYWlsdXJlID0gKCkgPT4geyB9O1xuXHRcdGhvc3Quc3VibWl0RHJhZnQgPSAoKSA9PiBzdWJtaXREcmFmdChob3N0KTtcblx0XHR0cnkge1xuXHRcdFx0aG9zdC5kb2NrVGV4dGFyZWEudmFsdWUgPSAnZWRpdGVkJztcblx0XHRcdGhvc3Quc2VuZEJ1dHRvbi5lbmFibGVkID0gdHJ1ZTtcblx0XHRcdGhvc3Quc2VuZEJ1dHRvbi5lbGVtZW50LmNsaWNrKCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1cGRhdGVzLCBbJ2VkaXRlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocG9zdGVkLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5kb2NrVGV4dGFyZWEudmFsdWUsICdzdGlsbCBkcmFmdGluZycpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3NlbmQgd3JhcHBlciBjbGljayBzdWJtaXRzIG9uY2Ugb25seSB3aGVuIFNlbmQgaXMgZW5hYmxlZCcsIGFzeW5jICgpID0+IHtcblx0XHRsZXQgY2FsbHMgPSAwO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBtb3VudERvY2tXaXRoU3VibWl0KGFzeW5jICgpID0+IHtcblx0XHRcdGNhbGxzKys7XG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGhvc3QgPSBmaXh0dXJlLmhvc3Q7XG5cdFx0XHRob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSA9ICdoZWxsbyc7XG5cdFx0XHRjb25zdCBzZW5kQ29udGFpbmVyID0gaG9zdC5zZW5kQnV0dG9uLmVsZW1lbnQucGFyZW50RWxlbWVudDtcblx0XHRcdGFzc2VydC5vayhzZW5kQ29udGFpbmVyKTtcblxuXHRcdFx0aG9zdC5zZW5kQnV0dG9uLmVuYWJsZWQgPSBmYWxzZTtcblx0XHRcdHNlbmRDb250YWluZXIuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLCAwLCAnYSBkaXNhYmxlZCBTZW5kIHdyYXBwZXIgbXVzdCBub3Qgc3VibWl0Jyk7XG5cblx0XHRcdGhvc3Quc2VuZEJ1dHRvbi5lbmFibGVkID0gdHJ1ZTtcblx0XHRcdHNlbmRDb250YWluZXIuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLCAxLCAnb25lIGNsaWNrIG9uIHRoZSBzZW5kIHdyYXBwZXIgbXVzdCBub3Qgc3VibWl0IHR3aWNlJyk7XG5cblx0XHRcdGNhbGxzID0gMDtcblx0XHRcdGhvc3QubWF4aW1pemVJbnB1dEJ1dHRvbi5lbGVtZW50LmNsaWNrKCk7XG5cdFx0XHRob3N0LnR1bmVCdXR0b24uZWxlbWVudC5jbGljaygpO1xuXHRcdFx0aG9zdC5tb3JlQnV0dG9uLmVsZW1lbnQuY2xpY2soKTtcblx0XHRcdGhvc3QuY29tcG9zZXJFeGl0QnV0dG9uLmVsZW1lbnQuY2xpY2soKTtcblx0XHRcdGhvc3QuZG9ja1RleHRhcmVhLmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ2NsaWNrJywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRcdGNvbnN0IGJvdHRvbUJhciA9IGhvc3QuZG9ja1Jvb3QucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stYm90dG9tLWJhcicpO1xuXHRcdFx0YXNzZXJ0Lm9rKGJvdHRvbUJhcik7XG5cdFx0XHRib3R0b21CYXIuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBob3N0LmRvY2tSb290LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vZGVsJyk7XG5cdFx0XHRhc3NlcnQub2sobW9kZWwpO1xuXHRcdFx0bW9kZWwuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLCAwLCAnb3RoZXIgZG9jayBiYXIgY2xpY2tzIG11c3Qgbm90IHN1Ym1pdCcpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmluZyBhIHR1cm4gZWRpdCBmcm9tIHRoZSBzZW5kIHdyYXBwZXIgZG9lcyBub3QgcG9zdCB0aGUgcmVzdG9yZWQgZHJhZnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcG9zdGVkOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IHVwZGF0ZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IG1vdW50RG9ja1dpdGhTdWJtaXQoYXN5bmMgKCkgPT4geyB9KTtcblx0XHRjb25zdCBob3N0ID0gZml4dHVyZS5ob3N0IGFzIHVua25vd24gYXMgT21pdDxJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCwgJ3N0dWJTZXJ2aWNlJyB8ICd1YUNvbm5lY3Rpb24nPiAmIHtcblx0XHRcdGNvbXBvc2VEcmFmdFNuYXBzaG90OiBzdHJpbmc7XG5cdFx0XHRzdWJtaXREcmFmdCgpOiBQcm9taXNlPHZvaWQ+O1xuXHRcdFx0c3R1YlNlcnZpY2U6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0WydzdHViU2VydmljZSddO1xuXHRcdFx0dWFDb25uZWN0aW9uOiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdFsndWFDb25uZWN0aW9uJ107XG5cdFx0fTtcblx0XHRob3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCA9IDA7XG5cdFx0aG9zdC5jYXRhbG9nTW9kZWxJZHMgPSBbJyddO1xuXHRcdGhvc3Quc3VibWl0SW5GbGlnaHQgPSBmYWxzZTtcblx0XHRob3N0LnN0dWJTZXJ2aWNlID0ge1xuXHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldFR1cm5zOiAoKSA9PiBbeyBpZDogJ3QxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnb3JpZ2luYWwnLCB0dXJuSWQ6ICd0MScgfV0sXG5cdFx0XHR1cGRhdGVVc2VyVHVyblRleHQ6IChfc2Vzc2lvbklkOiBzdHJpbmcsIF90dXJuSWQ6IHN0cmluZywgdGV4dDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdHVwZGF0ZXMucHVzaCh0ZXh0KTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdFsnc3R1YlNlcnZpY2UnXTtcblx0XHRob3N0LnVhQ29ubmVjdGlvbiA9IHtcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3RbJ3VhQ29ubmVjdGlvbiddO1xuXHRcdGhvc3Quc2Vzc2lvblZpZXdMZWFzZSA9IHtcblx0XHRcdHBvc3Q6IGFzeW5jIChtc2c6IENvbnZlcnNhdGlvbldyaXRlTWVzc2FnZSkgPT4ge1xuXHRcdFx0XHRwb3N0ZWQucHVzaChtc2cua2luZCA9PT0gJ3N1Ym1pdElucHV0JyA/IG1zZy50ZXh0IDogJycpO1xuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHRlZDogdHJ1ZSBhcyBjb25zdCwgY29ycmVsYXRpb246IHsgaWQ6ICdwb3N0ZWQnIH0gfTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0WydzZXNzaW9uVmlld0xlYXNlJ107XG5cdFx0aG9zdC5leGl0Q29tcG9zZXJFZGl0ID0gKCkgPT4ge1xuXHRcdFx0aG9zdC5jb21wb3NlclBvbGljeSA9ICdjb21wb3NlJztcblx0XHRcdGhvc3QuZWRpdGluZ1R1cm5JZCA9IHVuZGVmaW5lZDtcblx0XHRcdGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlID0gaG9zdC5jb21wb3NlRHJhZnRTbmFwc2hvdDtcblx0XHR9O1xuXHRcdGhvc3QucmVzZXRJbnB1dEhpc3RvcnlCcm93c2UgPSAoKSA9PiB7IH07XG5cdFx0aG9zdC5yZWFkQ29tcG9zZXJEcmFmdCA9ICgpID0+IGhvc3QuY29tcG9zZURyYWZ0U25hcHNob3Q7XG5cdFx0aG9zdC5zaG93UG9zdEZhaWx1cmUgPSAoKSA9PiB7IH07XG5cdFx0aG9zdC5zdWJtaXREcmFmdCA9ICgpID0+IHN1Ym1pdERyYWZ0KGhvc3QpO1xuXHRcdGNvbnN0IHNlbmRDb250YWluZXIgPSBob3N0LnNlbmRCdXR0b24uZWxlbWVudC5wYXJlbnRFbGVtZW50O1xuXHRcdGFzc2VydC5vayhzZW5kQ29udGFpbmVyKTtcblx0XHRjb25zdCBhcm1UdXJuRWRpdCA9ICgpID0+IHtcblx0XHRcdGhvc3QuY29tcG9zZXJQb2xpY3kgPSAndHVybkVkaXQnO1xuXHRcdFx0aG9zdC5lZGl0aW5nVHVybklkID0gJ3QxJztcblx0XHRcdGhvc3QuY29tcG9zZURyYWZ0U25hcHNob3QgPSAnc3RpbGwgZHJhZnRpbmcnO1xuXHRcdFx0aG9zdC5kb2NrVGV4dGFyZWEudmFsdWUgPSAnZWRpdGVkJztcblx0XHR9O1xuXHRcdHRyeSB7XG5cdFx0XHRhcm1UdXJuRWRpdCgpO1xuXHRcdFx0aG9zdC5zZW5kQnV0dG9uLmVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0c2VuZENvbnRhaW5lci5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KCdjbGljaycsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1cGRhdGVzLCBbJ2VkaXRlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocG9zdGVkLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5kb2NrVGV4dGFyZWEudmFsdWUsICdzdGlsbCBkcmFmdGluZycpO1xuXG5cdFx0XHR1cGRhdGVzLmxlbmd0aCA9IDA7XG5cdFx0XHRwb3N0ZWQubGVuZ3RoID0gMDtcblx0XHRcdGFybVR1cm5FZGl0KCk7XG5cdFx0XHRob3N0LnNlbmRCdXR0b24uZW5hYmxlZCA9IGZhbHNlO1xuXHRcdFx0c2VuZENvbnRhaW5lci5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KCdjbGljaycsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh1cGRhdGVzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBvc3RlZCwgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuY29tcG9zZXJQb2xpY3ksICd0dXJuRWRpdCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAnZWRpdGVkJyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gZG9jayBjYXB0dXJlIGNsaWNrIHN1Ym1pdERyYWZ0IHJlamVjdHMgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRjb25zdCBmaXh0dXJlID0gbW91bnREb2NrV2l0aFJlamVjdGluZ1N1Ym1pdERyYWZ0KHBhaW50Qm9vbSk7XG5cdFx0dHJ5IHtcblx0XHRcdGZpeHR1cmUuaG9zdC5kb2NrVGV4dGFyZWEudmFsdWUgPSAnaGVsbG8nO1xuXHRcdFx0Zml4dHVyZS5ob3N0LnNlbmRCdXR0b24uZW5hYmxlZCA9IHRydWU7XG5cdFx0XHRjb25zdCBzZW5kQ29udGFpbmVyID0gZml4dHVyZS5ob3N0LnNlbmRCdXR0b24uZWxlbWVudC5wYXJlbnRFbGVtZW50O1xuXHRcdFx0YXNzZXJ0Lm9rKHNlbmRDb250YWluZXIpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRcdHNlbmRDb250YWluZXIuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gZG9jayBFbnRlciBzdWJtaXREcmFmdCByZWplY3RzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG1vdW50RG9ja1dpdGhSZWplY3RpbmdTdWJtaXREcmFmdChwYWludEJvb20pO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdFx0Zml4dHVyZS5ob3N0LmRvY2tUZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBLZXlib2FyZEV2ZW50KCdrZXlkb3duJywge1xuXHRcdFx0XHRcdGtleUNvZGU6IDEzLFxuXHRcdFx0XHRcdGJ1YmJsZXM6IHRydWUsXG5cdFx0XHRcdFx0Y2FuY2VsYWJsZTogdHJ1ZSxcblx0XHRcdFx0fSkpO1xuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZG9jayBzdWJtaXREcmFmdCBmaXJlLWFuZC1mb3JnZXQgdm9pZHMgZG91YmxlLWNhdGNoIG9uVW5leHBlY3RlZEVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zRG9jay50c2ApO1xuXHRcdGNvbnN0IGRvdWJsZUNhdGNoID0gJy5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpJztcblx0XHRjb25zdCBzdWJtaXREcmFmdFZvaWQgPSBgdm9pZCBob3N0LnN1Ym1pdERyYWZ0KCkke2RvdWJsZUNhdGNofWA7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZS5zcGxpdChzdWJtaXREcmFmdFZvaWQpLmxlbmd0aCAtIDEsIDMpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIGhvc3Quc3VibWl0RHJhZnQoKTsnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzb3VyY2UuaW5jbHVkZXMoJygpID0+IHZvaWQgaG9zdC5zdWJtaXREcmFmdCgpKScpKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gZG9jayBwZXJtaXNzaW9uIHNlbGVjdCBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXggY2F0Y2gtcGF0aCB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRjb25zdCBmaXh0dXJlID0gbW91bnREb2NrV2l0aFJlamVjdGluZ1Nlc3Npb25TZWxlY3RBcHBseShwYWludEJvb20pO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdFx0Zml4dHVyZS5maXJlUGVybWlzc2lvblNlbGVjdCgyKTtcblx0XHRcdH0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIGRvY2sgbW9kZWwgc2VsZWN0IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXggY2F0Y2gtcGF0aCB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRjb25zdCBmaXh0dXJlID0gbW91bnREb2NrV2l0aFJlamVjdGluZ1Nlc3Npb25TZWxlY3RBcHBseShwYWludEJvb20pO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdFx0Zml4dHVyZS5maXJlTW9kZWxTZWxlY3QoMSk7XG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdkb2NrIGFwcGx5U2Vzc2lvbiBmaXJlLWFuZC1mb3JnZXQgdm9pZHMgZG91YmxlLWNhdGNoIG9uVW5leHBlY3RlZEVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zRG9jay50c2ApO1xuXHRcdGNvbnN0IGRvdWJsZUNhdGNoID0gJy5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpJztcblx0XHRhc3NlcnQub2soc291cmNlLmluY2x1ZGVzKGB2b2lkIGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChob3N0LCBob3N0LmdldEJvdW5kU2Vzc2lvbklkKCksIGUuaW5kZXgpJHtkb3VibGVDYXRjaH1gKSk7XG5cdFx0YXNzZXJ0Lm9rKHNvdXJjZS5pbmNsdWRlcyhgdm9pZCBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGhvc3QsIGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKSwgZS5pbmRleCkke2RvdWJsZUNhdGNofWApKTtcblx0XHRhc3NlcnQub2soIXNvdXJjZS5pbmNsdWRlcygndm9pZCBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoaG9zdCwgaG9zdC5nZXRCb3VuZFNlc3Npb25JZCgpLCBlLmluZGV4KTsnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzb3VyY2UuaW5jbHVkZXMoJ3ZvaWQgYXBwbHlTZXNzaW9uTW9kZWxJbmRleChob3N0LCBob3N0LmdldEJvdW5kU2Vzc2lvbklkKCksIGUuaW5kZXgpOycpKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZVR1cm5FZGl0IHJvc3RlciBmYWxzZSBhZnRlciBkaXNjb25uZWN0IHN0YXlzIGluIGVkaXQgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGxldCBleGl0ZWQgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ3R1cm5FZGl0Jyxcblx0XHRcdGVkaXRpbmdUdXJuSWQ6ICd0dXJuLTEnLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAncmV2aXNlZCBsYXRlcicgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdHVwZGF0ZVVzZXJUdXJuVGV4dDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbXSxcblx0XHRcdH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0OiAoKSA9PiB7IGV4aXRlZCsrOyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXG5cdFx0c2F2ZVR1cm5FZGl0KGhvc3QpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGl0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmVkaXRpbmdUdXJuSWQsICd0dXJuLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5jb21wb3NlclBvbGljeSwgJ3R1cm5FZGl0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAncmV2aXNlZCBsYXRlcicpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlVHVybkVkaXQgcm9zdGVyIGZhbHNlIHdpdGhvdXQgY29ubmVjdGlvbiBoaXN0b3J5IHN0YXlzIGluIGVkaXQgYW5kIHNob3dzIGZhaWxlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0bGV0IGV4aXRlZCA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAndHVybkVkaXQnLFxuXHRcdFx0ZWRpdGluZ1R1cm5JZDogJ3R1cm4tMScsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdyZXZpc2VkIGxhdGVyJyB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0dXBkYXRlVXNlclR1cm5UZXh0OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbXSxcblx0XHRcdH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0OiAoKSA9PiB7IGV4aXRlZCsrOyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXG5cdFx0c2F2ZVR1cm5FZGl0KGhvc3QpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4aXRlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZWRpdGluZ1R1cm5JZCwgJ3R1cm4tMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZVR1cm5FZGl0IHJvc3RlciB0cnVlIGV4aXRzIGVkaXQgYW5kIGRvZXMgbm90IHNob3cgcG9zdCBmYWlsdXJlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRsZXQgZXhpdGVkID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICd0dXJuRWRpdCcsXG5cdFx0XHRlZGl0aW5nVHVybklkOiAndHVybi0xJyxcblx0XHRcdGRvY2tUZXh0YXJlYTogeyB2YWx1ZTogJ3JldmlzZWQgbGF0ZXInIH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHR1cGRhdGVVc2VyVHVyblRleHQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gW10sXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyBleGl0ZWQrKzsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdDtcblxuXHRcdHNhdmVUdXJuRWRpdChob3N0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhpdGVkLCAxKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gc2F2ZVR1cm5FZGl0V3JpdGVIb3N0KG9wdGlvbnM6IHtcblx0XHRlZGl0aW5nVHVybklkOiBzdHJpbmc7XG5cdFx0dHVybnM6IHJlYWRvbmx5IHsgaWQ6IHN0cmluZzsga2luZDogc3RyaW5nOyB0ZXh0OiBzdHJpbmc7IHR1cm5JZD86IHN0cmluZyB9W107XG5cdH0pOiB7XG5cdFx0aG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3Q7XG5cdFx0d3JpdHRlbjogeyBzZXNzaW9uSWQ6IHN0cmluZzsgdHVybklkOiBzdHJpbmc7IHRleHQ6IHN0cmluZyB9W107XG5cdH0ge1xuXHRcdGNvbnN0IHdyaXR0ZW46IHsgc2Vzc2lvbklkOiBzdHJpbmc7IHR1cm5JZDogc3RyaW5nOyB0ZXh0OiBzdHJpbmcgfVtdID0gW107XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAndHVybkVkaXQnIGFzIGNvbnN0LFxuXHRcdFx0ZWRpdGluZ1R1cm5JZDogb3B0aW9ucy5lZGl0aW5nVHVybklkLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAncmV2aXNlZCBsYXRlcicgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBvcHRpb25zLnR1cm5zLFxuXHRcdFx0XHR1cGRhdGVVc2VyVHVyblRleHQ6IChzZXNzaW9uSWQ6IHN0cmluZywgdHVybklkOiBzdHJpbmcsIHRleHQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdHdyaXR0ZW4ucHVzaCh7IHNlc3Npb25JZCwgdHVybklkLCB0ZXh0IH0pO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0OiAoKSA9PiB7IH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6ICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3Q7XG5cdFx0cmV0dXJuIHsgaG9zdCwgd3JpdHRlbiB9O1xuXHR9XG5cblx0dGVzdCgnc2F2ZVR1cm5FZGl0IHdpdGggZGlzcGxheSBpZCBlMSBhbmQgdHVybklkIHQxIHdyaXRlcyB0MScsICgpID0+IHtcblx0XHRjb25zdCB7IGhvc3QsIHdyaXR0ZW4gfSA9IHNhdmVUdXJuRWRpdFdyaXRlSG9zdCh7XG5cdFx0XHRlZGl0aW5nVHVybklkOiAnZTEnLFxuXHRcdFx0dHVybnM6IFt7IGlkOiAnZTEnLCBraW5kOiAndXNlcicsIHRleHQ6ICdoZWxsbycsIHR1cm5JZDogJ3QxJyB9XSxcblx0XHR9KTtcblx0XHRzYXZlVHVybkVkaXQoaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZWRpdGluZ1R1cm5JZCwgJ2UxJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh3cml0dGVuLCBbeyBzZXNzaW9uSWQ6ICdzZXNzLTEnLCB0dXJuSWQ6ICd0MScsIHRleHQ6ICdyZXZpc2VkIGxhdGVyJyB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVUdXJuRWRpdCB3aXRob3V0IHR1cm5JZCB3cml0ZXMgZGlzcGxheSBpZCcsICgpID0+IHtcblx0XHRjb25zdCB7IGhvc3QsIHdyaXR0ZW4gfSA9IHNhdmVUdXJuRWRpdFdyaXRlSG9zdCh7XG5cdFx0XHRlZGl0aW5nVHVybklkOiAnZTEnLFxuXHRcdFx0dHVybnM6IFt7IGlkOiAnZTEnLCBraW5kOiAndXNlcicsIHRleHQ6ICdoZWxsbycgfV0sXG5cdFx0fSk7XG5cdFx0c2F2ZVR1cm5FZGl0KGhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmVkaXRpbmdUdXJuSWQsICdlMScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwod3JpdHRlbiwgW3sgc2Vzc2lvbklkOiAnc2Vzcy0xJywgdHVybklkOiAnZTEnLCB0ZXh0OiAncmV2aXNlZCBsYXRlcicgfV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlVHVybkVkaXQgYmxhbmsgdHVybklkIGFuZCBtaXNzaW5nIHJvdyBzdGlsbCB3cml0ZSBkaXNwbGF5IGlkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJsYW5rID0gc2F2ZVR1cm5FZGl0V3JpdGVIb3N0KHtcblx0XHRcdGVkaXRpbmdUdXJuSWQ6ICdlMScsXG5cdFx0XHR0dXJuczogW3sgaWQ6ICdlMScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJ2hlbGxvJywgdHVybklkOiAnICAgJyB9XSxcblx0XHR9KTtcblx0XHRzYXZlVHVybkVkaXQoYmxhbmsuaG9zdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChibGFuay53cml0dGVuLCBbeyBzZXNzaW9uSWQ6ICdzZXNzLTEnLCB0dXJuSWQ6ICdlMScsIHRleHQ6ICdyZXZpc2VkIGxhdGVyJyB9XSk7XG5cdFx0Y29uc3QgbWlzc2luZyA9IHNhdmVUdXJuRWRpdFdyaXRlSG9zdCh7XG5cdFx0XHRlZGl0aW5nVHVybklkOiAnZTEnLFxuXHRcdFx0dHVybnM6IFtdLFxuXHRcdH0pO1xuXHRcdHNhdmVUdXJuRWRpdChtaXNzaW5nLmhvc3QpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobWlzc2luZy53cml0dGVuLCBbeyBzZXNzaW9uSWQ6ICdzZXNzLTEnLCB0dXJuSWQ6ICdlMScsIHRleHQ6ICdyZXZpc2VkIGxhdGVyJyB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JlZ2luVHVybkVkaXQgaGlnaGxpZ2h0IHN0YXlzIG9uIGRpc3BsYXkgaWQgd2hlbiBMMSB0dXJuSWQgZGlmZmVycycsICgpID0+IHtcblx0XHRjb25zdCBoaWdobGlnaHRlZDogKHN0cmluZyB8IHVuZGVmaW5lZClbXSA9IFtdO1xuXHRcdGNvbnN0IGNvbXBvc2VyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgY29tcG9zZXJDbHVzdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgY29tcG9zZXJFZGl0SGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgY29tcG9zZXJFZGl0VGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb25zdCBlZGl0SG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IGRvY2tSb290ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgcHJlZmlyc3RIZXJvID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29tcG9zZXJDbHVzdGVyLmFwcGVuZENoaWxkKGNvbXBvc2VyKTtcblx0XHRjb25zdCBkb2NrVGV4dGFyZWEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xuXHRcdGRvY2tUZXh0YXJlYS52YWx1ZSA9ICdkcmFmdCc7XG5cdFx0Y29uc3QgY2hyb21lSG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScgYXMgY29uc3QsXG5cdFx0XHRlZGl0aW5nVHVybklkOiB1bmRlZmluZWQgYXMgc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdFx0ZWRpdGluZ1F1ZXVlSXRlbUlkOiB1bmRlZmluZWQgYXMgc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdFx0Y29tcG9zZURyYWZ0U25hcHNob3Q6ICcnLFxuXHRcdFx0ZG9ja1RleHRhcmVhLFxuXHRcdFx0c2VuZEJ1dHRvbjogeyBlbmFibGVkOiB0cnVlLCBzZXRUaXRsZSgpIHsgfSwgc2V0QXJpYUxhYmVsKCkgeyB9IH0sXG5cdFx0XHRjb21wb3Nlcixcblx0XHRcdGNvbXBvc2VyQ2x1c3Rlcixcblx0XHRcdGNvbXBvc2VyRWRpdEhlYWRlcixcblx0XHRcdGNvbXBvc2VyRWRpdFRpdGxlLFxuXHRcdFx0ZG9ja1Jvb3QsXG5cdFx0XHRwcmVmaXJzdEhlcm8sXG5cdFx0XHRpc1ByZUZpcnN0OiAoKSA9PiBmYWxzZSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdGluYm94T3ZlcmxheTogeyBjbG9zZUxpc3RQYW5lbCgpIHsgfSB9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7XG5cdFx0XHRcdHNldEVkaXRpbmdUdXJuSWQ6IChpZD86IHN0cmluZykgPT4geyBoaWdobGlnaHRlZC5wdXNoKGlkKTsgfSxcblx0XHRcdFx0Z2V0VHVybkVkaXRIb3N0OiAoKSA9PiBlZGl0SG9zdCxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbeyBpZDogJ2UxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnaGVsbG8nLCB0dXJuSWQ6ICd0MScgfV0sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdFx0fSxcblx0XHR9O1xuXHRcdGJlZ2luVHVybkVkaXQoY2hyb21lSG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0LCAnZTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lSG9zdC5lZGl0aW5nVHVybklkLCAnZTEnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhpZ2hsaWdodGVkLCBbJ2UxJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWVIb3N0LmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZVF1ZXVlRWRpdCByb3N0ZXIgZmFsc2UgYWZ0ZXIgZGlzY29ubmVjdCBzdGF5cyBpbiBlZGl0IGFuZCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRsZXQgZXhpdGVkID0gMDtcblx0XHRsZXQgcmVsZWFzZWQgPSAwO1xuXHRcdGxldCByZW5kZXJlZEluYm94ID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdxdWV1ZUVkaXQnLFxuXHRcdFx0ZWRpdGluZ1F1ZXVlSXRlbUlkOiAncTEnLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAncmV2aXNlZCBsYXRlcicgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdGdldEVkaXRpbmdRdWV1ZUl0ZW06ICgpID0+ICh7IGlkOiAncTEnLCBjb250ZW50OiAncXVldWVkJyB9KSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdHVwZGF0ZU1lc3NhZ2VRdWV1ZUl0ZW1Db250ZW50OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0cmVsZWFzZU1lc3NhZ2VRdWV1ZUl0ZW1Ib2xkOiAoKSA9PiB7IHJlbGVhc2VkKys7IH0sXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyBleGl0ZWQrKzsgfSxcblx0XHRcdHJlbmRlckluYm94U3RhdHVzOiAoKSA9PiB7IHJlbmRlcmVkSW5ib3grKzsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdDtcblxuXHRcdHNhdmVRdWV1ZUVkaXQoaG9zdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4aXRlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlbGVhc2VkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVuZGVyZWRJbmJveCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZWRpdGluZ1F1ZXVlSXRlbUlkLCAncTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5jb21wb3NlclBvbGljeSwgJ3F1ZXVlRWRpdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSwgJ3JldmlzZWQgbGF0ZXInKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZVF1ZXVlRWRpdCByb3N0ZXIgZmFsc2Ugd2l0aG91dCBjb25uZWN0aW9uIGhpc3Rvcnkgc3RheXMgaW4gZWRpdCBhbmQgc2hvd3MgZmFpbGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRsZXQgZXhpdGVkID0gMDtcblx0XHRsZXQgcmVsZWFzZWQgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ3F1ZXVlRWRpdCcsXG5cdFx0XHRlZGl0aW5nUXVldWVJdGVtSWQ6ICdxMScsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdyZXZpc2VkIGxhdGVyJyB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0Z2V0RWRpdGluZ1F1ZXVlSXRlbTogKCkgPT4gKHsgaWQ6ICdxMScsIGNvbnRlbnQ6ICdxdWV1ZWQnIH0pLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0dXBkYXRlTWVzc2FnZVF1ZXVlSXRlbUNvbnRlbnQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRyZWxlYXNlTWVzc2FnZVF1ZXVlSXRlbUhvbGQ6ICgpID0+IHsgcmVsZWFzZWQrKzsgfSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyBleGl0ZWQrKzsgfSxcblx0XHRcdHJlbmRlckluYm94U3RhdHVzOiAoKSA9PiB7IH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3Q7XG5cblx0XHRzYXZlUXVldWVFZGl0KGhvc3QpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4aXRlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlbGVhc2VkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5lZGl0aW5nUXVldWVJdGVtSWQsICdxMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmNvbXBvc2VyUG9saWN5LCAncXVldWVFZGl0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVRdWV1ZUVkaXQgcm9zdGVyIHRydWUgZXhpdHMgZWRpdCBhbmQgZG9lcyBub3Qgc2hvdyBwb3N0IGZhaWx1cmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGxldCBleGl0ZWQgPSAwO1xuXHRcdGxldCByZWxlYXNlZCA9IDA7XG5cdFx0bGV0IHJlbmRlcmVkSW5ib3ggPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ3F1ZXVlRWRpdCcsXG5cdFx0XHRlZGl0aW5nUXVldWVJdGVtSWQ6ICdxMScsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdyZXZpc2VkIGxhdGVyJyB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0Z2V0RWRpdGluZ1F1ZXVlSXRlbTogKCkgPT4gKHsgaWQ6ICdxMScsIGNvbnRlbnQ6ICdxdWV1ZWQnIH0pLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0dXBkYXRlTWVzc2FnZVF1ZXVlSXRlbUNvbnRlbnQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJlbGVhc2VNZXNzYWdlUXVldWVJdGVtSG9sZDogKCkgPT4geyByZWxlYXNlZCsrOyB9LFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0OiAoKSA9PiB7IGV4aXRlZCsrOyB9LFxuXHRcdFx0cmVuZGVySW5ib3hTdGF0dXM6ICgpID0+IHsgcmVuZGVyZWRJbmJveCsrOyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXG5cdFx0c2F2ZVF1ZXVlRWRpdChob3N0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhpdGVkLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVsZWFzZWQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZW5kZXJlZEluYm94LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnY29weVR1cm4gd3JpdGVUZXh0IHJlamVjdCBzaG93cyBmYWlsZWQgYW5kIGRvZXMgbm90IGxlYXZlIGFuIHVuaGFuZGxlZCByZWplY3Rpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHJlamVjdGlvbnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IG9uVW5oYW5kbGVkID0gKHJlYXNvbjogdW5rbm93bikgPT4geyByZWplY3Rpb25zLnB1c2gocmVhc29uKTsgfTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y2xpcGJvYXJkU2VydmljZToge1xuXHRcdFx0XHR3cml0ZVRleHQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3dyaXRlVGV4dCBib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb3B5VHVybihob3N0LCAnY29waWVkJyk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVqZWN0aW9ucywgW10pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnY29weVR1cm4gd3JpdGVUZXh0IHJlamVjdCBzdGlsbCBzaG93cyBmYWlsZWQgYW5kIGRvZXMgbm90IGxlYWsgd2hlbiBzaG93UG9zdEZhaWx1cmUgdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjbGlwYm9hcmRTZXJ2aWNlOiB7XG5cdFx0XHRcdHdyaXRlVGV4dDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignd3JpdGVUZXh0IGJvb20nKTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4gY29weVR1cm4oaG9zdCwgJ2NvcGllZCcpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnY29weVR1cm4gd3JpdGVUZXh0IHJlc29sdmUgc3RheXMgc2lsZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB3cml0dGVuOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjbGlwYm9hcmRTZXJ2aWNlOiB7XG5cdFx0XHRcdHdyaXRlVGV4dDogYXN5bmMgKHRleHQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdHdyaXR0ZW4ucHVzaCh0ZXh0KTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRjb3B5VHVybihob3N0LCAnY29waWVkJyk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldEltbWVkaWF0ZSgoKSA9PiByZXNvbHZlKCkpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwod3JpdHRlbiwgWydjb3BpZWQnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVUdXJuIHJvc3RlciBmYWxzZSBhZnRlciBkaXNjb25uZWN0IHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGxldCBkZWxldGVDYWxscyA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGRlbGV0ZVR1cm46ICgpID0+IHtcblx0XHRcdFx0XHRkZWxldGVDYWxscysrO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRkZWxldGVUdXJuKGhvc3QsICd0dXJuLTEnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVDYWxscywgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVUdXJuIHJvc3RlciBmYWxzZSB3aXRob3V0IGNvbm5lY3Rpb24gaGlzdG9yeSBzaG93cyBmYWlsZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRkZWxldGVUdXJuOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0ZGVsZXRlVHVybihob3N0LCAndHVybi0xJyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlVHVybiByb3N0ZXIgdHJ1ZSBzdGF5cyBzaWxlbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRkZWxldGVUdXJuOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRkZWxldGVUdXJuKGhvc3QsICd0dXJuLTEnKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuY2VsVG9vbENhbGwgcm9zdGVyIGZhbHNlIGFmdGVyIGRpc2Nvbm5lY3Qgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0bGV0IGNhbmNlbENhbGxzID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0Y2FuY2VsVG9vbENhbGw6ICgpID0+IHtcblx0XHRcdFx0XHRjYW5jZWxDYWxscysrO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRjYW5jZWxUb29sQ2FsbChob3N0LCB7IGlkOiAnZS1ydW4nLCB0b29sQ2FsbElkOiAndGMtMScsIGFnZW50SWQ6ICdzdWI6YScgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FuY2VsQ2FsbHMsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuY2VsVG9vbENhbGwgcm9zdGVyIGZhbHNlIHdpdGhvdXQgY29ubmVjdGlvbiBoaXN0b3J5IHNob3dzIGZhaWxlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGNhbmNlbFRvb2xDYWxsOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0Y2FuY2VsVG9vbENhbGwoaG9zdCwgeyBpZDogJ2UtcnVuJywgdG9vbENhbGxJZDogJ3RjLTEnIH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbmNlbFRvb2xDYWxsIHJvc3RlciB0cnVlIHN0YXlzIHNpbGVudCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGNhbmNlbFRvb2xDYWxsOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRjYW5jZWxUb29sQ2FsbChob3N0LCB7IGlkOiAnZS1ydW4nLCB0b29sQ2FsbElkOiAndGMtMScgfSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc3BvbmRDbGllbnRUb29sIHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBkb2VzIG5vdCB3cml0ZSBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0LCBwb3N0ZWQgfSA9IHBhaXJpbmdIb2xkTGVmdG92ZXJXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGxldCByZXNwb25kQ2FsbHMgPSAwO1xuXHRcdChob3N0IGFzIHVua25vd24gYXMgeyBzdHViU2VydmljZTogeyByZXNwb25kQ2xpZW50VG9vbDogKCkgPT4gYm9vbGVhbiB9IH0pLnN0dWJTZXJ2aWNlLnJlc3BvbmRDbGllbnRUb29sID0gKCkgPT4ge1xuXHRcdFx0cmVzcG9uZENhbGxzKys7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdHJlc3BvbmRDbGllbnRUb29sKGhvc3QsIHsgaWQ6ICdjYWxsLTEnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNwb25kQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgcmVzcG9uZENsaWVudFRvb2wgc2tpcHMgdW5hcnkgYW5kIHNob3dzIHNlc3Npb25fbm90X3JlYWR5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCBmYWxzZSwgZmFsc2UpO1xuXHRcdGxldCByZXNwb25kQ2FsbHMgPSAwO1xuXHRcdChmaXh0dXJlLmhvc3QgYXMgdW5rbm93biBhcyB7IHN0dWJTZXJ2aWNlOiB7IHJlc3BvbmRDbGllbnRUb29sOiAoKSA9PiBib29sZWFuIH0gfSkuc3R1YlNlcnZpY2UucmVzcG9uZENsaWVudFRvb2wgPSAoKSA9PiB7XG5cdFx0XHRyZXNwb25kQ2FsbHMrKztcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cdFx0cmVzcG9uZENsaWVudFRvb2woZml4dHVyZS5ob3N0LCB7IGlkOiAnY2FsbC0xJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uZENhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnc2Vzc2lvbl9ub3RfcmVhZHknXSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGNsaWVudFRvb2xEaXNjb25uZWN0SG9zdChjb25uZWN0ZWRBdEVudHJ5OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGNhbGxzOiB7IHNlc3Npb25JZDogc3RyaW5nOyBjYWxsSWQ6IHN0cmluZzsgb3B0aW9ucz86IFBhcmFtZXRlcnM8Q29udmVyc2F0aW9uU3R1YlNlcnZpY2VbJ3Jlc3BvbmRDbGllbnRUb29sJ10+WzJdIH1bXSA9IFtdO1xuXHRcdGNvbnN0IHN0YXRlID0geyBwb3N0ZWQ6IDAsIGZvY3VzZWQ6IDAgfTtcblx0XHRjb25zdCBzZXJ2aWNlID0gc3VpdGVTdG9yZS5hZGQobmV3IGNsYXNzIGV4dGVuZHMgQ29udmVyc2F0aW9uU3R1YlNlcnZpY2Uge1xuXHRcdFx0b3ZlcnJpZGUgaGFzRW5naW5lQ29ubmVjdGlvbkhpc3RvcnkoKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdFx0XHRvdmVycmlkZSByZXNwb25kQ2xpZW50VG9vbChzZXNzaW9uSWQ6IHN0cmluZywgY2FsbElkOiBzdHJpbmcsIG9wdGlvbnM/OiBQYXJhbWV0ZXJzPENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlWydyZXNwb25kQ2xpZW50VG9vbCddPlsyXSk6IGJvb2xlYW4ge1xuXHRcdFx0XHRjYWxscy5wdXNoKHsgc2Vzc2lvbklkLCBjYWxsSWQsIG9wdGlvbnMgfSk7XG5cdFx0XHRcdHRoaXMuc2V0RW5naW5lQ29ubmVjdGVkKGZhbHNlKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0oKSk7XG5cdFx0c2VydmljZS5zZXRFbmdpbmVDb25uZWN0ZWQoY29ubmVjdGVkQXRFbnRyeSk7XG5cdFx0c2VydmljZS5jcmVhdGVUZXN0RnJhbWVTb3VyY2VDYWxsYmFjaygpLm1vZGVsLnVwc2VydENhY2hlZFNlc3Npb24oe1xuXHRcdFx0aWQ6ICdzZXNzLTEnLCB0aXRsZTogJ0NhY2hlZCByZXNwb25zZScsIHNvdXJjZTogJ2VuZ2luZS1jYWNoZScsIHR1cm5zOiBbXG5cdFx0XHRcdHsgaWQ6ICdjYWxsLTEnLCBraW5kOiAndG9vbCcsIHRleHQ6ICdQZW5kaW5nIGNsaWVudCByZXNwb25zZScsIHRvb2xOYW1lOiAnY2xpZW50LXJlc3BvbnNlJywgdG9vbFN0YXR1czogJ3BlbmRpbmcnLCByZXNwb25kYWJsZTogdHJ1ZSB9LFxuXHRcdFx0XHR7IGlkOiAncGVybWlzc2lvbi0xJywga2luZDogJ2NvbmZpcm1hdGlvbicsIHRleHQ6ICdQZW5kaW5nIHBlcm1pc3Npb24nLCBzdGF0dXM6ICdwZW5kaW5nJyB9LFxuXHRcdFx0XSxcblx0XHR9KTtcblx0XHRjb25zdCBsZWFzZSA9IHN1aXRlU3RvcmUuYWRkKHNlcnZpY2UuYWNxdWlyZVNlc3Npb25WaWV3KCdzZXNzLTEnKSk7XG5cdFx0Y29uc3QgaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNSZXNwb25zZUhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiBzZXJ2aWNlLFxuXHRcdFx0dWFDb25uZWN0aW9uOiBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoKSxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKCk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0c3RhdGUucG9zdGVkKys7XG5cdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlLCBjb3JyZWxhdGlvbjogeyBpZDogJ3VuZXhwZWN0ZWQtcG9zdCcgfSB9O1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzVGltZWxpbmVSZWNvcmQ6ICgpID0+IHsgc3RhdGUuZm9jdXNlZCsrOyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRyZXR1cm4geyBob3N0LCBzZXJ2aWNlLCBsZWFzZSwgc3RhdGUsIGNhbGxzLCBmYWlsdXJlcyB9O1xuXHR9XG5cblx0dGVzdCgncmVzcG9uZENsaWVudFRvb2wgYWxyZWFkeSBkaXNjb25uZWN0ZWQgcmVqZWN0cyBiZWZvcmUgcm9zdGVyIGFuZCBwcmVzZXJ2ZXMgY2FjaGVkIG1vZGVsIGFuZCBwZW5kaW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBjbGllbnRUb29sRGlzY29ubmVjdEhvc3QoZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnNlcnZpY2UuZ2V0U2Vzc2lvblNvdXJjZSgnc2Vzcy0xJyksICdlbmdpbmUtY2FjaGUnKTtcblx0XHRhc3NlcnQub2soZml4dHVyZS5sZWFzZS5zbmFwc2hvdC5wZW5kaW5nQWN0aW9ucy5zb21lKGFjdGlvbiA9PiBhY3Rpb24ucmVxdWVzdElkID09PSAncGVybWlzc2lvbi0xJykpO1xuXHRcdGNvbnN0IG1vZGVsQmVmb3JlID0gSlNPTi5zdHJpbmdpZnkoZml4dHVyZS5zZXJ2aWNlLmdldFR1cm5zKCdzZXNzLTEnKSk7XG5cdFx0Y29uc3QgcGVuZGluZ0JlZm9yZSA9IEpTT04uc3RyaW5naWZ5KGZpeHR1cmUubGVhc2Uuc25hcHNob3QucGVuZGluZ0FjdGlvbnMpO1xuXHRcdHJlc3BvbmRDbGllbnRUb29sKGZpeHR1cmUuaG9zdCwgeyBpZDogJ2NhbGwtMScgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKEpTT04uc3RyaW5naWZ5KGZpeHR1cmUuc2VydmljZS5nZXRUdXJucygnc2Vzcy0xJykpLCBtb2RlbEJlZm9yZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKEpTT04uc3RyaW5naWZ5KGZpeHR1cmUubGVhc2Uuc25hcHNob3QucGVuZGluZ0FjdGlvbnMpLCBwZW5kaW5nQmVmb3JlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuc3RhdGUsIHsgcG9zdGVkOiAwLCBmb2N1c2VkOiAwIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNwb25kQ2xpZW50VG9vbCByb3N0ZXIgZmFsc2UgYWZ0ZXIgZGlzY29ubmVjdCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBjbGllbnRUb29sRGlzY29ubmVjdEhvc3QodHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuc2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlLCAndGhlIHJlc3BvbnNlIG11c3QgZW50ZXIgdGhlIGxpdmUgcm9zdGVyIGJlZm9yZSBpdHMgc3luY2hyb25vdXMgZGlzY29ubmVjdCcpO1xuXHRcdGNvbnN0IG1vZGVsQmVmb3JlID0gSlNPTi5zdHJpbmdpZnkoZml4dHVyZS5zZXJ2aWNlLmdldFR1cm5zKCdzZXNzLTEnKSk7XG5cdFx0Y29uc3QgcGVuZGluZ0JlZm9yZSA9IEpTT04uc3RyaW5naWZ5KGZpeHR1cmUubGVhc2Uuc25hcHNob3QucGVuZGluZ0FjdGlvbnMpO1xuXHRcdHJlc3BvbmRDbGllbnRUb29sKGZpeHR1cmUuaG9zdCwgeyBpZDogJ2NhbGwtMScgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmNhbGxzLCBbeyBzZXNzaW9uSWQ6ICdzZXNzLTEnLCBjYWxsSWQ6ICdjYWxsLTEnLCBvcHRpb25zOiB7IGNvbnRlbnQ6ICcnIH0gfV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5mYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeShmaXh0dXJlLnNlcnZpY2UuZ2V0VHVybnMoJ3Nlc3MtMScpKSwgbW9kZWxCZWZvcmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChKU09OLnN0cmluZ2lmeShmaXh0dXJlLmxlYXNlLnNuYXBzaG90LnBlbmRpbmdBY3Rpb25zKSwgcGVuZGluZ0JlZm9yZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnN0YXRlLCB7IHBvc3RlZDogMCwgZm9jdXNlZDogMCB9KTtcblx0fSk7XG5cblx0dGVzdCgncmVzcG9uZENsaWVudFRvb2wgcm9zdGVyIGZhbHNlIHdpdGhvdXQgY29ubmVjdGlvbiBoaXN0b3J5IHNob3dzIGZhaWxlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdHJlc3BvbmRDbGllbnRUb29sOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cmVzcG9uZENsaWVudFRvb2woaG9zdCwgeyBpZDogJ2NhbGwtMScgfSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0fSk7XG5cblx0dGVzdCgncmVzcG9uZENsaWVudFRvb2wgcm9zdGVyIHRydWUgc3RheXMgc2lsZW50IGFuZCBzZW5kcyBlbXB0eSBjb250ZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBjYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgY2FsbElkOiBzdHJpbmc7IG9wdGlvbnM/OiB7IGNvbnRlbnQ/OiBzdHJpbmcgfSB9W10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0cmVzcG9uZENsaWVudFRvb2w6IChzZXNzaW9uSWQ6IHN0cmluZywgY2FsbElkOiBzdHJpbmcsIG9wdGlvbnM/OiB7IGNvbnRlbnQ/OiBzdHJpbmcgfSkgPT4ge1xuXHRcdFx0XHRcdGNhbGxzLnB1c2goeyBzZXNzaW9uSWQsIGNhbGxJZCwgb3B0aW9ucyB9KTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHJlc3BvbmRDbGllbnRUb29sKGhvc3QsIHsgaWQ6ICdjYWxsLTEnIH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW3sgc2Vzc2lvbklkOiAnc2Vzcy0xJywgY2FsbElkOiAnY2FsbC0xJywgb3B0aW9uczogeyBjb250ZW50OiAnJyB9IH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3dQb3N0RmFpbHVyZSBmYWlsZWQgdXNlcyByZXRyeSBjb3B5IG5vdCBkaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGdhdGVSb3cuaGlkZGVuID0gdHJ1ZTtcblx0XHRjb25zdCBnYXRlTGFiZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0Z2F0ZVJvdy5hcHBlbmRDaGlsZChnYXRlTGFiZWwpO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRwb3N0RmFpbHVyZVZpc2libGU6IGZhbHNlLFxuXHRcdFx0c2VuZEZhaWx1cmVUaW1lb3V0OiB1bmRlZmluZWQgYXMgUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCB1bmRlZmluZWQsXG5cdFx0XHRnYXRlUm93LFxuXHRcdFx0Z2F0ZUxhYmVsLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdDtcblxuXHRcdHNob3dQb3N0RmFpbHVyZShob3N0LCAnZmFpbGVkJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnYXRlUm93LmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnYXRlTGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoZ2F0ZUxhYmVsLnRleHRDb250ZW50LCBjb252ZXJzYXRpb25MZW5zUG9zdEZhaWxlZERpc2Nvbm5lY3RlZCk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGdhdGVMYWJlbC50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc1Bvc3RGYWlsZWROb1Nlc3Npb24pO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChnYXRlTGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyVGl0bGVFbXB0eSk7XG5cblx0XHRzaG93UG9zdEZhaWx1cmUoaG9zdCwgJ2VtcHR5X3Nlc3Npb25fdGl0bGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2F0ZUxhYmVsLnRleHRDb250ZW50LCBjb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhclRpdGxlRW1wdHkpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChnYXRlTGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkKTtcblx0XHRhc3NlcnQub2soIS9kaXNjb25uZWN0ZWQvaS50ZXN0KGdhdGVMYWJlbC50ZXh0Q29udGVudCA/PyAnJykpO1xuXHRcdGlmIChob3N0LnNlbmRGYWlsdXJlVGltZW91dCkge1xuXHRcdFx0Y2xlYXJUaW1lb3V0KGhvc3Quc2VuZEZhaWx1cmVUaW1lb3V0KTtcblx0XHRcdGhvc3Quc2VuZEZhaWx1cmVUaW1lb3V0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUVuQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxjQUFjLGlDQUFpQztBQUN4RCxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyxtREFBbUQ7QUFFNUQsU0FBUywwQkFBMEIsMEJBQTBCLHlCQUF5Qix3QkFBOEQ7QUFDcEosU0FBUyxvQ0FBb0MsbUNBQW1DLDhCQUE4Qiw0QkFBNEIsNEJBQTRCLHlDQUF3RTtBQUM5TyxTQUFTLDZDQUE2QztBQUV0RCxTQUFTLDZCQUE2RDtBQUV0RSxTQUFTLFdBQVcsZUFBZSxjQUFjLG1CQUF1RDtBQUN4RztBQUFBLEVB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
