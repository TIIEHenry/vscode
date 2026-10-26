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
suite("conversation lens dispose gate", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
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
      slotHosts: { dock: { classList: { toggle: () => {
      } } } },
      prefirstHero: { hidden: false, appendChild: () => {
      } },
      dockRoot: { insertBefore: () => {
      } },
      gateRow: {},
      identityStrip: { element: {} },
      inboxOverlay: { element: { hidden: true } }
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
  test("pairing-hold same-session KEEP connection change paints getSessionSync closed chrome not Session live", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationLens.ts`);
    const engineStart = source.indexOf("this.stubService.onDidChangeEngineConnection(() => {");
    const uaStart = source.indexOf("this.uaConnection.onDidChangeConnection(() => {");
    assert.ok(engineStart >= 0 && uaStart > engineStart);
    const engineBlock = source.slice(engineStart, source.indexOf("}));", engineStart));
    const uaBlock = source.slice(uaStart, source.indexOf("}));", uaStart));
    assert.ok(engineBlock.includes("this.bindSessionView(this.getBoundSessionId());"));
    assert.ok(engineBlock.includes("this.updateConversationPhase();"));
    assert.ok(engineBlock.includes("this.updateSyncChrome();"));
    assert.ok(engineBlock.indexOf("this.bindSessionView(this.getBoundSessionId());") < engineBlock.indexOf("this.updateConversationPhase();"));
    assert.ok(engineBlock.indexOf("this.updateConversationPhase();") < engineBlock.indexOf("this.updateSyncChrome();"));
    assert.ok(uaBlock.includes("this.bindSessionView(this.getBoundSessionId());"));
    assert.ok(uaBlock.includes("this.updateConversationPhase();"));
    assert.ok(uaBlock.includes("this.updateSyncChrome();"));
    assert.ok(uaBlock.indexOf("this.bindSessionView(this.getBoundSessionId());") < uaBlock.indexOf("this.updateConversationPhase();"));
    assert.ok(uaBlock.indexOf("this.updateConversationPhase();") < uaBlock.indexOf("this.updateSyncChrome();"));
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
  test("respondClientTool roster false after disconnect shows engine_disconnected", () => {
    const failures = [];
    const calls = [];
    const host = {
      getBoundSessionId: () => "sess-1",
      stubService: {
        respondClientTool: (sessionId, callId, options) => {
          calls.push({ sessionId, callId, options });
          return false;
        },
        isEngineConnected: () => false,
        hasEngineConnectionHistory: () => true
      },
      showPostFailure: (reason) => {
        failures.push(reason);
      }
    };
    respondClientTool(host, { id: "call-1" });
    assert.deepStrictEqual(calls, [{ sessionId: "sess-1", callId: "call-1", options: { content: "" } }]);
    assert.deepStrictEqual(failures, ["engine_disconnected"]);
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
    const gateRow = {
      hidden: true,
      classList: {
        add() {
        },
        remove() {
        }
      },
      setAttribute: () => {
      },
      removeAttribute: () => {
      }
    };
    const gateLabel = {
      textContent: "",
      removeAttribute() {
      }
    };
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi90ZXN0L2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0Rpc3Bvc2VHYXRlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVbml2ZXJzZUFnZW50U3dpdGNoTW9kZWxSZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi91bml2ZXJzZUFnZW50VHlwZXMuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGVycm9ySGFuZGxlciwgc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgc2NoZWR1bGVDb252ZXJzYXRpb25NZXJtYWlkRXh0ZW5zaW9uUmVzb2x2ZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVucy5qcyc7XG5pbXBvcnQgdHlwZSB7IENvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb25JbmZvIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25NZXJtYWlkSG9zdC5qcyc7XG5pbXBvcnQgeyBhcHBseVNlc3Npb25WaWV3VGltZWxpbmUsIHJlZnJlc2hUcmFqZWN0b3J5UmVjb3JkcywgdXBkYXRlQ29udmVyc2F0aW9uUGhhc2UsIHVwZGF0ZVN5bmNDaHJvbWUsIHR5cGUgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc1Byb2plY3Rpb24uanMnO1xuaW1wb3J0IHsgY29udmVyc2F0aW9uTGVuc1N0YWxlU25hcHNob3RDbGFzcywgZXhlY3V0ZVJlYWRpbmdDb2x1bW5Tb3VyY2VzUmV2aWV3LCBpc1JlYWRpbmdDb2x1bW5Xcml0ZXNFbmFibGVkLCByZWZyZXNoU3RhbGVTbmFwc2hvdEJhbm5lciwgcmVxdWVzdFJlYWRpbmdDb2x1bW5EZXRhaWwsIHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZSwgdHlwZSBJUmVhZGluZ0NvbHVtbkRldGFpbEhvc3QgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNSZWFkaW5nQ29sdW1uLmpzJztcbmltcG9ydCB7IFNPVVJDRVNfUkVWSUVXX1NIT1dfRk9SX1BBVEhTX0NPTU1BTkQgfSBmcm9tICcuLi8uLi8uLi9zb3VyY2VzL2NvbW1vbi9zb3VyY2VzUmV2aWV3Q29tbWFuZHMuanMnO1xuaW1wb3J0IHR5cGUgeyBDb25uZWN0aW9uUGhhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi9jb25uZWN0aW9uSHViVHlwZXMuanMnO1xuaW1wb3J0IHsgZm9ybWF0U3luY0Nocm9tZUxhYmVsLCB0eXBlIENvbnZlcnNhdGlvblRpbWVsaW5lRW50cnkgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25WaWV3LmpzJztcbmltcG9ydCB0eXBlIHsgU3luY0Nocm9tZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL3Nlc3Npb25WaWV3L2luZGV4LmpzJztcbmltcG9ydCB7IHBvc3RCb3VuZCwgc2F2ZVF1ZXVlRWRpdCwgc2F2ZVR1cm5FZGl0LCBzdWJtaXREcmFmdCwgdHlwZSBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0NvbXBvc2VyLmpzJztcbmltcG9ydCB7XG5cdGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgsXG5cdHN5bmNTZXNzaW9uQ29uZmlnU2VsZWN0cyxcblx0YXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4LFxuXHRiZWdpblF1ZXVlRWRpdCxcblx0YmVnaW5UdXJuRWRpdCxcblx0aXNTZXNzaW9uUGVybWlzc2lvbk1vZGVBdmFpbGFibGUsXG5cdGlzU2Vzc2lvblN3aXRjaEFnZW50QXZhaWxhYmxlLFxuXHRpc1Nlc3Npb25Td2l0Y2hNb2RlbEF2YWlsYWJsZSxcblx0c2hvd1Bvc3RGYWlsdXJlLFxuXHR0b2dnbGVNb3JlQ29udGV4dFZpZXcsXG5cdHRvZ2dsZVR1bmVDb250ZXh0Vmlldyxcblx0dXBkYXRlQ29tcG9zZXJTZXNzaW9uU2VsZWN0c0VuYWJsZWQsXG5cdHVwZGF0ZUdhdGVSb3csXG5cdHVwZGF0ZVNlbmRFbmFibGVkLFxuXHR0eXBlIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0LFxufSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZS5qcyc7XG5pbXBvcnQgeyBiZWdpblNlc3Npb25UaXRsZUVkaXQsIGNvbW1pdFNlc3Npb25UaXRsZUVkaXQsIGNyZWF0ZU5ld1Nlc3Npb24sIGRlbGV0ZUFjdGl2ZVNlc3Npb24sIHVwZGF0ZVNlc3Npb25CYXJXcml0ZUNocm9tZSwgdHlwZSBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJIb3N0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhci5qcyc7XG5pbXBvcnQgeyBtb3VudERvY2ssIHR5cGUgSUNvbnZlcnNhdGlvbkxlbnNEb2NrSG9zdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0RvY2suanMnO1xuaW1wb3J0IHtcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tBZ2VudExhYmVsLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja0VuZ2luZU5vdENvbm5lY3RlZCxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tTZXNzaW9uVW5hdmFpbGFibGUsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrU2Vzc2lvblVuYXZhaWxhYmxlUmVhc29uLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja05vRW5naW5lVG9vbHMsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9Ub29scyxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tQZXJtaXNzaW9uTGFiZWwsXG5cdGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkLFxuXHRjb252ZXJzYXRpb25MZW5zUG9zdEZhaWxlZERpc2Nvbm5lY3RlZCxcblx0Y29udmVyc2F0aW9uTGVuc1Bvc3RGYWlsZWROb1Nlc3Npb24sXG5cdHR5cGUgQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbixcbn0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zRG9ja1N0cmluZ3MuanMnO1xuaW1wb3J0IHsgY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJUaXRsZUVtcHR5IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhclN0cmluZ3MuanMnO1xuaW1wb3J0IHsgRU5HSU5FX1RPT0xTX1pPTkUsIE9QRU5fRU5HSU5FX1BSRUZFUkVOQ0VTX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi9jb21tb24vdWFQcmVmZXJlbmNlc1BhbmVzLmpzJztcbmltcG9ydCB7IGFwcGx5QWN0aXZlU2Vzc2lvbiwgYmluZFNlc3Npb25WaWV3LCBjYW5jZWxUb29sQ2FsbCwgY29weVR1cm4sIGRlbGV0ZVR1cm4sIHJlc29sdmVDb25maXJtYXRpb24sIHJlc29sdmVRdWVzdGlvbiwgcmVzcG9uZENsaWVudFRvb2wsIHJldHJ5RXJyb3IsIHR5cGUgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3QgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZy5qcyc7XG5pbXBvcnQgeyBpc0NvbnZlcnNhdGlvbkVuZ2luZUxpdmUsIGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25TdGF0dXMuanMnO1xuaW1wb3J0IHR5cGUgeyBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2UsIElDb252ZXJzYXRpb25TZXNzaW9uVmlld0xlYXNlLCBQb3N0T3V0Y29tZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL2NvbnZlcnNhdGlvblZpZXdGcmFtZS5qcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gX19yZWFkRmlsZUluVGVzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+O1xuXG5zdWl0ZSgnY29udmVyc2F0aW9uIGxlbnMgZGlzcG9zZSBnYXRlJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbTogRXJyb3IsIHJ1bjogKCkgPT4gdm9pZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIEEgbG9uZSBgLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKWAgc3RpbGwgbGVha3Mgd2hlbiB0aGUgaGFuZGxlciB3YXJuLXRoZW4tcmV0aHJvd3MuXG5cdFx0Y29uc3QgdW5leHBlY3RlZFdhcm5zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCB1bmhhbmRsZWRSZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZFJlamVjdGlvbiA9IChyZWFzb246IHVua25vd24pID0+IHVuaGFuZGxlZFJlamVjdGlvbnMucHVzaChyZWFzb24pO1xuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkUmVqZWN0aW9uKTtcblx0XHRjb25zdCBvcmlnaW5hbEVycm9ySGFuZGxlciA9IGVycm9ySGFuZGxlci5nZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCk7XG5cdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihlcnJvciA9PiB7XG5cdFx0XHR1bmV4cGVjdGVkV2FybnMucHVzaChlcnJvcik7XG5cdFx0XHRpZiAodW5leHBlY3RlZFdhcm5zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0cnVuKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IHVuaGFuZGxlZFJlamVjdGlvbnMsIHVuZXhwZWN0ZWRXYXJucyB9LCB7XG5cdFx0XHRcdHVuaGFuZGxlZFJlamVjdGlvbnM6IFtdLFxuXHRcdFx0XHR1bmV4cGVjdGVkV2FybnM6IFtwYWludEJvb20sIHBhaW50Qm9vbV0sXG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihvcmlnaW5hbEVycm9ySGFuZGxlcik7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWRSZWplY3Rpb24pO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIG1vdW50RG9ja1dpdGhTdWJtaXQoc3VibWl0RHJhZnQ6ICgpID0+IFByb21pc2U8dm9pZD4pOiB7IGhvc3Q6IElDb252ZXJzYXRpb25MZW5zRG9ja0hvc3Q7IGRpc3Bvc2UoKTogdm9pZCB9IHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBkb2NrSG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZG9ja0hvc3QpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IGRvY2tIb3N0LnJlbW92ZSgpIH0pO1xuXHRcdGNvbnN0IGR1bW15U2VsZWN0Qm94ID0gKCkgPT4gKHtcblx0XHRcdHJlbmRlcigpIHsgfSxcblx0XHRcdG9uRGlkU2VsZWN0OiBFdmVudC5Ob25lLFxuXHRcdFx0c2VsZWN0KCkgeyB9LFxuXHRcdFx0c2V0RW5hYmxlZCgpIHsgfSxcblx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdGRpc3Bvc2UoKSB7IH0sXG5cdFx0fSk7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScgYXMgY29uc3QsXG5cdFx0XHRpbnB1dEhpc3RvcnlCcm93c2U6IHsgYnJvd3NlSW5kZXg6IC0xLCBzYXZlZERyYWZ0OiAnJyB9LFxuXHRcdFx0bW9kZWxTZWxlY3RlZEluZGV4OiAwLFxuXHRcdFx0Y2F0YWxvZ1Rvb2xOYW1lczogW10sXG5cdFx0XHRjYXRhbG9nTW9kZWxJZHM6IFsnJ10sXG5cdFx0XHRzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQ6IG5ldyBNYXAoKSxcblx0XHRcdHBvc3RGYWlsdXJlVmlzaWJsZTogZmFsc2UsXG5cdFx0XHRzZW5kRmFpbHVyZVRpbWVvdXQ6IHVuZGVmaW5lZCxcblx0XHRcdGxhc3RSZWFkaW5nV2lkdGg6IDgwMCxcblx0XHRcdGlucHV0TWF4aW1pemVkOiBmYWxzZSxcblx0XHRcdGNvbXBvc2VEcmFmdFNuYXBzaG90OiAnJyxcblx0XHRcdGVkaXRpbmdUdXJuSWQ6IHVuZGVmaW5lZCxcblx0XHRcdGVkaXRpbmdRdWV1ZUl0ZW1JZDogdW5kZWZpbmVkLFxuXHRcdFx0dHVuZUNvbnRleHRWaWV3OiB1bmRlZmluZWQsXG5cdFx0XHRtb3JlQ29udGV4dFZpZXc6IHVuZGVmaW5lZCxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiB7IGdldFZhbHVlOiAoKSA9PiB1bmRlZmluZWQgfSxcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlOiB7XG5cdFx0XHRcdGNyZWF0ZUluc3RhbmNlOiAoKSA9PiAoeyBkaXNwb3NlKCkgeyB9IH0pLFxuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdG9uRGlkQ2hhbmdlRW5naW5lQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlcjogPFQgZXh0ZW5kcyB7IGRpc3Bvc2UoKTogdm9pZCB9PihkaXNwb3NhYmxlOiBUKSA9PiBzdG9yZS5hZGQoZGlzcG9zYWJsZSksXG5cdFx0XHRjcmVhdGVDb21wb3NlclNlbGVjdEJveDogKCkgPT4gZHVtbXlTZWxlY3RCb3goKSxcblx0XHRcdGdldFNlc3Npb25Db25maWc6ICgpID0+ICh7IGFnZW50SW5kZXg6IDAsIHBlcm1pc3Npb25JbmRleDogMCB9KSxcblx0XHRcdHNldFNlc3Npb25Db25maWc6ICgpID0+IHsgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHRvZ2dsZVR1bmVDb250ZXh0VmlldzogKCkgPT4geyB9LFxuXHRcdFx0dG9nZ2xlTW9yZUNvbnRleHRWaWV3OiAoKSA9PiB7IH0sXG5cdFx0XHR0b2dnbGVJbnB1dE1heGltaXplZDogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlTWF4aW1pemVJbnB1dEJ1dHRvbjogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlU2VuZEVuYWJsZWQ6ICgpID0+IHsgfSxcblx0XHRcdGJlZ2luUXVldWVFZGl0OiAoKSA9PiB7IH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0OiAoKSA9PiB7IH0sXG5cdFx0XHRuYXZpZ2F0ZUlucHV0SGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRleGl0SW5wdXRIaXN0b3J5QnJvd3NlOiAoKSA9PiB7IH0sXG5cdFx0XHRzdWJtaXREcmFmdCxcblx0XHRcdHdyaXRlQ29tcG9zZXJEcmFmdDogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlQ29udmVyc2F0aW9uUGhhc2U6ICgpID0+IHsgfSxcblx0XHRcdHNjcm9sbFRvRmlyc3RQZW5kaW5nQ29uZmlybWF0aW9uOiAoKSA9PiB7IH0sXG5cdFx0XHRzZXRJbnB1dE1heGltaXplZDogKCkgPT4geyB9LFxuXHRcdFx0cmVuZGVySW5ib3hTdGF0dXM6ICgpID0+IHsgfSxcblx0XHRcdHJlYWRDb21wb3NlckRyYWZ0OiAoKSA9PiAnJyxcblx0XHRcdGlzUHJlRmlyc3Q6ICgpID0+IGZhbHNlLFxuXHRcdFx0c3luY0NvbXBvc2VyUGxhY2VtZW50OiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVDb21wb3NlckVkaXRDaHJvbWU6ICgpID0+IHsgfSxcblx0XHRcdGVuc3VyZUNvbXBvc2VySW5DbHVzdGVyOiAoKSA9PiB7IH0sXG5cdFx0XHRzbG90SG9zdHM6IHt9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0RvY2tIb3N0ICYgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0bW91bnREb2NrKGhvc3QsIGRvY2tIb3N0KTtcblx0XHRyZXR1cm4geyBob3N0LCBkaXNwb3NlOiAoKSA9PiBzdG9yZS5kaXNwb3NlKCkgfTtcblx0fVxuXG5cdGZ1bmN0aW9uIG1vdW50RG9ja1dpdGhSZWplY3RpbmdTdWJtaXREcmFmdChwYWludEJvb206IEVycm9yKTogeyBob3N0OiBJQ29udmVyc2F0aW9uTGVuc0RvY2tIb3N0OyBkaXNwb3NlKCk6IHZvaWQgfSB7XG5cdFx0cmV0dXJuIG1vdW50RG9ja1dpdGhTdWJtaXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gbW91bnREb2NrV2l0aFJlamVjdGluZ1Nlc3Npb25TZWxlY3RBcHBseShwYWludEJvb206IEVycm9yKToge1xuXHRcdGZpcmVQZXJtaXNzaW9uU2VsZWN0KGluZGV4OiBudW1iZXIpOiB2b2lkO1xuXHRcdGZpcmVNb2RlbFNlbGVjdChpbmRleDogbnVtYmVyKTogdm9pZDtcblx0XHRkaXNwb3NlKCk6IHZvaWQ7XG5cdH0ge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGRvY2tIb3N0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChkb2NrSG9zdCk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gZG9ja0hvc3QucmVtb3ZlKCkgfSk7XG5cdFx0Y29uc3QgcGVybWlzc2lvbkRpZFNlbGVjdCA9IHN0b3JlLmFkZChuZXcgRW1pdHRlcjx7IGluZGV4OiBudW1iZXIgfT4oKSk7XG5cdFx0Y29uc3QgbW9kZWxEaWRTZWxlY3QgPSBzdG9yZS5hZGQobmV3IEVtaXR0ZXI8eyBpbmRleDogbnVtYmVyIH0+KCkpO1xuXHRcdGNvbnN0IGR1bW15U2VsZWN0Qm94ID0gKG9uRGlkU2VsZWN0OiB0eXBlb2YgRXZlbnQuTm9uZSkgPT4gKHtcblx0XHRcdHJlbmRlcigpIHsgfSxcblx0XHRcdG9uRGlkU2VsZWN0LFxuXHRcdFx0c2VsZWN0KCkgeyB9LFxuXHRcdFx0c2V0RW5hYmxlZCgpIHsgfSxcblx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdGRpc3Bvc2UoKSB7IH0sXG5cdFx0fSk7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScgYXMgY29uc3QsXG5cdFx0XHRpbnB1dEhpc3RvcnlCcm93c2U6IHsgYnJvd3NlSW5kZXg6IC0xLCBzYXZlZERyYWZ0OiAnJyB9LFxuXHRcdFx0bW9kZWxTZWxlY3RlZEluZGV4OiAwLFxuXHRcdFx0Y2F0YWxvZ1Rvb2xOYW1lczogW10sXG5cdFx0XHRjYXRhbG9nTW9kZWxJZHM6IFsnJywgJ2dwdC10ZXN0J10sXG5cdFx0XHRzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQ6IG5ldyBNYXAoW1snc2Vzcy0xJywgeyBhZ2VudEluZGV4OiAwLCBwZXJtaXNzaW9uSW5kZXg6IDAgfV1dKSxcblx0XHRcdHBvc3RGYWlsdXJlVmlzaWJsZTogZmFsc2UsXG5cdFx0XHRzZW5kRmFpbHVyZVRpbWVvdXQ6IHVuZGVmaW5lZCxcblx0XHRcdGxhc3RSZWFkaW5nV2lkdGg6IDgwMCxcblx0XHRcdGlucHV0TWF4aW1pemVkOiBmYWxzZSxcblx0XHRcdGNvbXBvc2VEcmFmdFNuYXBzaG90OiAnJyxcblx0XHRcdGVkaXRpbmdUdXJuSWQ6IHVuZGVmaW5lZCxcblx0XHRcdGVkaXRpbmdRdWV1ZUl0ZW1JZDogdW5kZWZpbmVkLFxuXHRcdFx0dHVuZUNvbnRleHRWaWV3OiB1bmRlZmluZWQsXG5cdFx0XHRtb3JlQ29udGV4dFZpZXc6IHVuZGVmaW5lZCxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiB7IGdldFZhbHVlOiAoKSA9PiB1bmRlZmluZWQgfSxcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlOiB7XG5cdFx0XHRcdGNyZWF0ZUluc3RhbmNlOiAoKSA9PiAoeyBkaXNwb3NlKCkgeyB9IH0pLFxuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdG9uRGlkQ2hhbmdlRW5naW5lQ29ubmVjdGlvbjogRXZlbnQuTm9uZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignc2V0UGVybWlzc2lvbk1vZGUgYm9vbScpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzd2l0Y2hNb2RlbDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignc3dpdGNoTW9kZWwgYm9vbScpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyOiA8VCBleHRlbmRzIHsgZGlzcG9zZSgpOiB2b2lkIH0+KGRpc3Bvc2FibGU6IFQpID0+IHN0b3JlLmFkZChkaXNwb3NhYmxlKSxcblx0XHRcdGNyZWF0ZUNvbXBvc2VyU2VsZWN0Qm94OiAoX29wdGlvbnM6IHsgdGV4dDogc3RyaW5nIH1bXSwgX3NlbGVjdGVkSW5kZXg6IG51bWJlciwgYXJpYUxhYmVsOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0aWYgKGFyaWFMYWJlbCA9PT0gY29udmVyc2F0aW9uTGVuc0RvY2tQZXJtaXNzaW9uTGFiZWwpIHtcblx0XHRcdFx0XHRyZXR1cm4gZHVtbXlTZWxlY3RCb3gocGVybWlzc2lvbkRpZFNlbGVjdC5ldmVudCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGFyaWFMYWJlbCA9PT0gY29udmVyc2F0aW9uTGVuc0RvY2tBZ2VudExhYmVsKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGR1bW15U2VsZWN0Qm94KEV2ZW50Lk5vbmUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBkdW1teVNlbGVjdEJveChtb2RlbERpZFNlbGVjdC5ldmVudCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0U2Vzc2lvbkNvbmZpZzogKCkgPT4gKHsgYWdlbnRJbmRleDogMCwgcGVybWlzc2lvbkluZGV4OiAwIH0pLFxuXHRcdFx0c2V0U2Vzc2lvbkNvbmZpZzogKCkgPT4geyB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0dG9nZ2xlVHVuZUNvbnRleHRWaWV3OiAoKSA9PiB7IH0sXG5cdFx0XHR0b2dnbGVNb3JlQ29udGV4dFZpZXc6ICgpID0+IHsgfSxcblx0XHRcdHRvZ2dsZUlucHV0TWF4aW1pemVkOiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVNYXhpbWl6ZUlucHV0QnV0dG9uOiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVTZW5kRW5hYmxlZDogKCkgPT4geyB9LFxuXHRcdFx0YmVnaW5RdWV1ZUVkaXQ6ICgpID0+IHsgfSxcblx0XHRcdGV4aXRDb21wb3NlckVkaXQ6ICgpID0+IHsgfSxcblx0XHRcdG5hdmlnYXRlSW5wdXRIaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdGV4aXRJbnB1dEhpc3RvcnlCcm93c2U6ICgpID0+IHsgfSxcblx0XHRcdHN1Ym1pdERyYWZ0OiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0XHR3cml0ZUNvbXBvc2VyRHJhZnQ6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlOiAoKSA9PiB7IH0sXG5cdFx0XHRzY3JvbGxUb0ZpcnN0UGVuZGluZ0NvbmZpcm1hdGlvbjogKCkgPT4geyB9LFxuXHRcdFx0c2V0SW5wdXRNYXhpbWl6ZWQ6ICgpID0+IHsgfSxcblx0XHRcdHJlbmRlckluYm94U3RhdHVzOiAoKSA9PiB7IH0sXG5cdFx0XHRyZWFkQ29tcG9zZXJEcmFmdDogKCkgPT4gJycsXG5cdFx0XHRpc1ByZUZpcnN0OiAoKSA9PiBmYWxzZSxcblx0XHRcdHN5bmNDb21wb3NlclBsYWNlbWVudDogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlQ29tcG9zZXJFZGl0Q2hyb21lOiAoKSA9PiB7IH0sXG5cdFx0XHRlbnN1cmVDb21wb3NlckluQ2x1c3RlcjogKCkgPT4geyB9LFxuXHRcdFx0c2xvdEhvc3RzOiB7fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNEb2NrSG9zdCAmIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdG1vdW50RG9jayhob3N0LCBkb2NrSG9zdCk7XG5cdFx0aG9zdC5nYXRlTGFiZWwgPSB7XG5cdFx0XHRzZXQgdGV4dENvbnRlbnQoX3ZhbHVlOiBzdHJpbmcpIHtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fSxcblx0XHRcdGdldCB0ZXh0Q29udGVudCgpIHtcblx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0fSxcblx0XHR9IGFzIEhUTUxFbGVtZW50O1xuXHRcdHJldHVybiB7XG5cdFx0XHRmaXJlUGVybWlzc2lvblNlbGVjdChpbmRleDogbnVtYmVyKSB7XG5cdFx0XHRcdHBlcm1pc3Npb25EaWRTZWxlY3QuZmlyZSh7IGluZGV4IH0pO1xuXHRcdFx0fSxcblx0XHRcdGZpcmVNb2RlbFNlbGVjdChpbmRleDogbnVtYmVyKSB7XG5cdFx0XHRcdG1vZGVsRGlkU2VsZWN0LmZpcmUoeyBpbmRleCB9KTtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiBzdG9yZS5kaXNwb3NlKCksXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2FwcGx5U2Vzc2lvblZpZXdUaW1lbGluZSBza2lwcyBhcHBseUVudHJpZXMgYWZ0ZXIgZGlzcG9zZScsICgpID0+IHtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogdHJ1ZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHsgc2Vzc2lvbklkOiAnczEnIH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHsgYXBwbHlFbnRyaWVzOiAoKSA9PiB7IGFwcGx5RW50cmllcysrOyB9IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zUHJvamVjdGlvbkhvc3Q7XG5cdFx0YXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lKGhvc3QsIHsga2luZDogJ2Jhc2VsaW5lJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlFbnRyaWVzLCAwKTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaFRyYWplY3RvcnlSZWNvcmRzIHNraXBzIHNldFJlY29yZHMgYWZ0ZXIgZGlzcG9zZScsICgpID0+IHtcblx0XHRsZXQgc2V0UmVjb3JkcyA9IDA7XG5cdFx0bGV0IHJlYWRSZWNvcmRzID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogdHJ1ZSxcblx0XHRcdGZpbHRlckFnZW50SWQ6IHVuZGVmaW5lZCxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHVuZGVmaW5lZCxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldFRyYWplY3RvcnlSZWNvcmRzOiAoKSA9PiB7XG5cdFx0XHRcdFx0cmVhZFJlY29yZHMrKztcblx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0dHJhamVjdG9yeVZpZXc6IHsgc2V0UmVjb3JkczogKCkgPT4geyBzZXRSZWNvcmRzKys7IH0gfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdDtcblx0XHRyZWZyZXNoVHJhamVjdG9yeVJlY29yZHMoaG9zdCwgJ3MxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlYWRSZWNvcmRzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2V0UmVjb3JkcywgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZnJlc2hUcmFqZWN0b3J5UmVjb3JkcyBzdGlsbCBzZXRSZWNvcmRzIHdoaWxlIGxpdmUnLCAoKSA9PiB7XG5cdFx0bGV0IHNldFJlY29yZHMgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGZpbHRlckFnZW50SWQ6IHVuZGVmaW5lZCxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHVuZGVmaW5lZCxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGdldFRyYWplY3RvcnlSZWNvcmRzOiAoKSA9PiBbXSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gW10sXG5cdFx0XHR9LFxuXHRcdFx0dHJhamVjdG9yeVZpZXc6IHsgc2V0UmVjb3JkczogKCkgPT4geyBzZXRSZWNvcmRzKys7IH0gfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdDtcblx0XHRyZWZyZXNoVHJhamVjdG9yeVJlY29yZHMoaG9zdCwgJ3MxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNldFJlY29yZHMsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWZyZXNoVHJhamVjdG9yeVJlY29yZHMga2VlcHMgbGVmdG92ZXIgbGVhc2UgdHVybiBpZHMgd2hpbGUgcGFpcmluZ1BlbmRpbmcgdGhlbiB0cnVlIGRpc2Nvbm5lY3QgdXNlcyBzdHViIGlkcycsICgpID0+IHtcblx0XHRsZXQgY29ubmVjdGVkID0gdHJ1ZTtcblx0XHRsZXQgcGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRsZXQgc2V0UmVjb3JkcyA9IDA7XG5cdFx0bGV0IGxhc3RUdXJuSWRzOiBSZWFkb25seVNldDxzdHJpbmc+IHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGxlZnRvdmVyUmVjb3JkcyA9IFt7IGlkOiAncmVjLTEnIH1dO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGZpbHRlckFnZW50SWQ6IHVuZGVmaW5lZCxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHtcblx0XHRcdFx0c2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicsXG5cdFx0XHRcdHNuYXBzaG90OiB7XG5cdFx0XHRcdFx0dGltZWxpbmU6IFtcblx0XHRcdFx0XHRcdHsgaWQ6ICd0dXJuLWxlYXNlLTEnLCBzdW1tYXJ5OiB7IGtpbmQ6ICd1c2VyJyB9IH0sXG5cdFx0XHRcdFx0XHR7IGlkOiAndHVybi1sZWFzZS0yJywgc3VtbWFyeTogeyBraW5kOiAnYXNzaXN0YW50JyB9IH0sXG5cdFx0XHRcdFx0XSxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRnZXRUcmFqZWN0b3J5UmVjb3JkczogKCkgPT4gbGVmdG92ZXJSZWNvcmRzLFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gY29ubmVjdGVkICYmICFwYWlyaW5nUGVuZGluZyxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6IGNvbm5lY3RlZCA/ICdjb25uZWN0ZWQnIDogJ2Rpc2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmcgfSksXG5cdFx0XHR9LFxuXHRcdFx0dHJhamVjdG9yeVZpZXc6IHtcblx0XHRcdFx0Z2V0UGFpbnRlZFJlY29yZENvdW50OiAoKSA9PiBsZWZ0b3ZlclJlY29yZHMubGVuZ3RoLFxuXHRcdFx0XHRzZXRSZWNvcmRzOiAoX3JlY29yZHM6IHJlYWRvbmx5IHVua25vd25bXSwgdHVybklkcz86IFJlYWRvbmx5U2V0PHN0cmluZz4pID0+IHtcblx0XHRcdFx0XHRzZXRSZWNvcmRzKys7XG5cdFx0XHRcdFx0bGFzdFR1cm5JZHMgPSB0dXJuSWRzO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdDtcblxuXHRcdHBhaXJpbmdQZW5kaW5nID0gdHJ1ZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25QaGFzZSgpLmtpbmQsICdjb25uZWN0ZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIHRydWUpO1xuXG5cdFx0cmVmcmVzaFRyYWplY3RvcnlSZWNvcmRzKGhvc3QsICdzZXNzLWxlZnRvdmVyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNldFJlY29yZHMsIDEpO1xuXHRcdGFzc2VydC5vayhsYXN0VHVybklkcz8uaGFzKCd0dXJuLWxlYXNlLTEnKSk7XG5cdFx0YXNzZXJ0Lm9rKGxhc3RUdXJuSWRzPy5oYXMoJ3R1cm4tbGVhc2UtMicpKTtcblxuXHRcdHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0Y29ubmVjdGVkID0gZmFsc2U7XG5cdFx0cmVmcmVzaFRyYWplY3RvcnlSZWNvcmRzKGhvc3QsICdzZXNzLWxlZnRvdmVyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNldFJlY29yZHMsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0VHVybklkcz8uc2l6ZSwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZnJlc2hUcmFqZWN0b3J5UmVjb3JkcyBrZWVwcyBsZWZ0b3ZlciBwYWludGVkIHJlY29yZHMgd2hlbiBwYWlyaW5nUGVuZGluZyBoYXMgbm8gbGVhc2UnLCAoKSA9PiB7XG5cdFx0bGV0IHNldFJlY29yZHMgPSAwO1xuXHRcdGNvbnN0IGxlZnRvdmVyUmVjb3JkcyA9IFt7IGlkOiAncmVjLWxlZnRvdmVyJyB9XTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRmaWx0ZXJBZ2VudElkOiB1bmRlZmluZWQsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB1bmRlZmluZWQsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRnZXRUcmFqZWN0b3J5UmVjb3JkczogKCkgPT4gW10sXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7XG5cdFx0XHRcdGdldFBhaW50ZWRSZWNvcmRDb3VudDogKCkgPT4gbGVmdG92ZXJSZWNvcmRzLmxlbmd0aCxcblx0XHRcdFx0c2V0UmVjb3JkczogKCkgPT4geyBzZXRSZWNvcmRzKys7IH0sXG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Byb2plY3Rpb25Ib3N0O1xuXHRcdHJlZnJlc2hUcmFqZWN0b3J5UmVjb3Jkcyhob3N0LCAnc2Vzcy1sZWZ0b3ZlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXRSZWNvcmRzLCAwKTtcblx0fSk7XG5cblx0dGVzdCgncmVmcmVzaFRyYWplY3RvcnlSZWNvcmRzIGZpcnN0LXB1bGwgcGFpcmluZ1BlbmRpbmcgd2l0aG91dCBsZWZ0b3ZlciBzdGlsbCBzZXRSZWNvcmRzJywgKCkgPT4ge1xuXHRcdGxldCBzZXRSZWNvcmRzID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRmaWx0ZXJBZ2VudElkOiB1bmRlZmluZWQsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB1bmRlZmluZWQsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRnZXRUcmFqZWN0b3J5UmVjb3JkczogKCkgPT4gW10sXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7XG5cdFx0XHRcdGdldFBhaW50ZWRSZWNvcmRDb3VudDogKCkgPT4gMCxcblx0XHRcdFx0c2V0UmVjb3JkczogKCkgPT4geyBzZXRSZWNvcmRzKys7IH0sXG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Byb2plY3Rpb25Ib3N0O1xuXHRcdHJlZnJlc2hUcmFqZWN0b3J5UmVjb3Jkcyhob3N0LCAnc2Vzcy1maXJzdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXRSZWNvcmRzLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lIGtlZXBzIGxlZnRvdmVyIGxlYXNlIHdoaWxlIHBhaXJpbmdQZW5kaW5nIHRoZW4gdHJ1ZSBkaXNjb25uZWN0IGhpZGVzJywgKCkgPT4ge1xuXHRcdGxldCBjb25uZWN0ZWQgPSB0cnVlO1xuXHRcdGxldCBwYWlyaW5nUGVuZGluZyA9IGZhbHNlO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiBsZWZ0b3ZlckxlYXNlU25hcHNob3QoeyBraW5kOiAnbGl2ZScgfSksXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3VhLWNhY2hlJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBjb25uZWN0ZWQgJiYgIXBhaXJpbmdQZW5kaW5nLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICd1YS1jYWNoZScsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbXSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiBjb25uZWN0ZWQgPyAnY29ubmVjdGVkJyA6ICdkaXNjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0fSxcblx0XHR9O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZShhc0xpdmVDaHJvbWVIb3N0KGhvc3QpKSwgdHJ1ZSk7XG5cblx0XHRwYWlyaW5nUGVuZGluZyA9IHRydWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUoYXNMaXZlQ2hyb21lSG9zdChob3N0KSksIHRydWUpO1xuXG5cdFx0cGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRjb25uZWN0ZWQgPSBmYWxzZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lKGFzTGl2ZUNocm9tZUhvc3QoaG9zdCkpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZSBrZWVwcyBsZWZ0b3ZlciBjYWNoZWQgdHVybnMgd2l0aG91dCBsZWFzZSB3aGlsZSBwYWlyaW5nUGVuZGluZycsICgpID0+IHtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogdW5kZWZpbmVkLFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICd1YS1jYWNoZScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGdldEFjdGl2ZVNlc3Npb25JZDogKCkgPT4gJ3VhLWNhY2hlJyxcblx0XHRcdFx0Z2V0VHVybnM6IChzZXNzaW9uSWQ6IHN0cmluZykgPT4gc2Vzc2lvbklkID09PSAndWEtY2FjaGUnXG5cdFx0XHRcdFx0PyBbeyBpZDogJ3QtbGVmdG92ZXInLCBraW5kOiAndGhpbmtpbmcnLCB0ZXh0OiAnbGVmdG92ZXIgdGhpbmsnLCBzdHJlYW1pbmc6IHRydWUgfV1cblx0XHRcdFx0XHQ6IFtdLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnIGFzIGNvbnN0LCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHR9O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUoYXNMaXZlQ2hyb21lSG9zdChob3N0KSksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUgZmlyc3QtcHVsbCBwYWlyaW5nUGVuZGluZyB3aXRob3V0IGxlZnRvdmVyIHN0YXlzIGZhbHNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB1bmRlZmluZWQsXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtZmlyc3QnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLWZpcnN0Jyxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnIGFzIGNvbnN0LCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlIH0pLFxuXHRcdFx0fSxcblx0XHR9O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUoYXNMaXZlQ2hyb21lSG9zdChob3N0KSksIGZhbHNlKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gbGVmdG92ZXJMb29rc0xpdmVDaHJvbWVIb3N0KG9wdGlvbnM6IHtcblx0XHRyZWFkb25seSBwYWlyaW5nUGVuZGluZzogYm9vbGVhbjtcblx0XHRyZWFkb25seSBsb29rc0xpdmU/OiBib29sZWFuO1xuXHRcdHJlYWRvbmx5IGNvbm5lY3RlZD86IGJvb2xlYW47XG5cdFx0cmVhZG9ubHkgaGFzTGVhc2U/OiBib29sZWFuO1xuXHRcdHJlYWRvbmx5IHR1cm5zPzogcmVhZG9ubHkgdW5rbm93bltdO1xuXHR9KTogUGFyYW1ldGVyczx0eXBlb2Ygc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lPlswXSB7XG5cdFx0Y29uc3QgY29ubmVjdGVkID0gb3B0aW9ucy5jb25uZWN0ZWQgPz8gdHJ1ZTtcblx0XHRjb25zdCBwYWlyaW5nUGVuZGluZyA9IG9wdGlvbnMucGFpcmluZ1BlbmRpbmc7XG5cdFx0Y29uc3QgbG9va3NMaXZlID0gb3B0aW9ucy5sb29rc0xpdmUgPz8gZmFsc2U7XG5cdFx0Y29uc3QgaGFzTGVhc2UgPSBvcHRpb25zLmhhc0xlYXNlID09PSB0cnVlO1xuXHRcdGNvbnN0IGJvdW5kU2Vzc2lvbklkID0gaGFzTGVhc2UgPyAndWEtY2FjaGUnIDogJ3Nlc3MtZmlyc3QnO1xuXHRcdHJldHVybiB7XG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiBoYXNMZWFzZSA/IGxlZnRvdmVyTGVhc2VTbmFwc2hvdCh7IGtpbmQ6ICdsaXZlJyB9KSA6IHVuZGVmaW5lZCxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiBib3VuZFNlc3Npb25JZCxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBjb25uZWN0ZWQgJiYgKGxvb2tzTGl2ZSB8fCAhcGFpcmluZ1BlbmRpbmcpLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+IGJvdW5kU2Vzc2lvbklkLFxuXHRcdFx0XHRnZXRUdXJuczogKHNlc3Npb25JZDogc3RyaW5nKSA9PiBzZXNzaW9uSWQgPT09IGJvdW5kU2Vzc2lvbklkID8gKG9wdGlvbnMudHVybnMgPz8gW10pIDogW10sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogY29ubmVjdGVkID8gJ2Nvbm5lY3RlZCcgOiAnZGlzY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgZmlyc3QtcHVsbCBzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUgc3RheXMgZmFsc2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaG9zdCA9IGxlZnRvdmVyTG9va3NMaXZlQ2hyb21lSG9zdCh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlLCBsb29rc0xpdmU6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lKGhvc3QpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUga2VlcHMgbGVmdG92ZXIgbGVhc2Ugc2hvdWxkU2hvd1JlYWRpbmdDb2x1bW5MaXZlQ2hyb21lJywgKCkgPT4ge1xuXHRcdGNvbnN0IGhvc3QgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNocm9tZUhvc3QoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSwgbG9va3NMaXZlOiB0cnVlLCBoYXNMZWFzZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUoaG9zdCksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIGtlZXBzIGxlZnRvdmVyIGNhY2hlZCB0dXJucyBzaG91bGRTaG93UmVhZGluZ0NvbHVtbkxpdmVDaHJvbWUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaG9zdCA9IGxlZnRvdmVyTG9va3NMaXZlQ2hyb21lSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogdHJ1ZSxcblx0XHRcdGxvb2tzTGl2ZTogdHJ1ZSxcblx0XHRcdHR1cm5zOiBbeyBpZDogJ3QtbGVmdG92ZXInLCBraW5kOiAndGhpbmtpbmcnLCB0ZXh0OiAnbGVmdG92ZXIgdGhpbmsnLCBzdHJlYW1pbmc6IHRydWUgfV0sXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZShob3N0KSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRpbmcgY29sdW1uIGxpdmUgY2hyb21lIGFuZCBzdGFsZSBiYW5uZXIgZm9sbG93IGJvdW5kIHNlc3Npb24gd2l0aG91dCBsZWFzZSBub3QgZ2xvYmFsIGFjdGl2ZScsICgpID0+IHtcblx0XHRjb25zdCBib3VuZENsb3NlZDogU3luY0Nocm9tZSA9IHsga2luZDogJ2Nsb3NlZCcsIHJlYXNvbjogJ0JvdW5kIGxlYWYgc25hcHNob3QnIH07XG5cdFx0Y29uc3QgYWN0aXZlTGl2ZTogU3luY0Nocm9tZSA9IHsga2luZDogJ2xpdmUnIH07XG5cdFx0Y29uc3QgYmFubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0YmFubmVyLmNsYXNzTmFtZSA9IGNvbnZlcnNhdGlvbkxlbnNTdGFsZVNuYXBzaG90Q2xhc3M7XG5cdFx0YmFubmVyLmhpZGRlbiA9IHRydWU7XG5cdFx0Y29uc3QgcmVhZGluZ0NvbHVtbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHJlYWRpbmdDb2x1bW4uYXBwZW5kQ2hpbGQoYmFubmVyKTtcblx0XHRjb25zdCBnZXRTZXNzaW9uU3luY0NhbGxzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB1bmRlZmluZWQsXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtQScsXG5cdFx0XHRyZWFkaW5nQ29sdW1uLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLUInLFxuXHRcdFx0XHRnZXRUdXJuczogKHNlc3Npb25JZDogc3RyaW5nKSA9PiBzZXNzaW9uSWQgPT09ICdzZXNzLUEnXG5cdFx0XHRcdFx0PyBbeyBpZDogJ3QtYm91bmQnLCBraW5kOiAndGhpbmtpbmcnLCB0ZXh0OiAnYm91bmQgbGVmdG92ZXInLCBzdHJlYW1pbmc6IHRydWUgfV1cblx0XHRcdFx0XHQ6IFtdLFxuXHRcdFx0XHRnZXRTZXNzaW9uU3luYzogKHNlc3Npb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0Z2V0U2Vzc2lvblN5bmNDYWxscy5wdXNoKHNlc3Npb25JZCk7XG5cdFx0XHRcdFx0cmV0dXJuIHNlc3Npb25JZCA9PT0gJ3Nlc3MtQScgPyBib3VuZENsb3NlZCA6IGFjdGl2ZUxpdmU7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcgYXMgY29uc3QsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSksXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZShhc0xpdmVDaHJvbWVIb3N0KGhvc3QpKSwgdHJ1ZSk7XG5cdFx0cmVmcmVzaFN0YWxlU25hcHNob3RCYW5uZXIoaG9zdCBhcyB1bmtub3duIGFzIFBhcmFtZXRlcnM8dHlwZW9mIHJlZnJlc2hTdGFsZVNuYXBzaG90QmFubmVyPlswXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRTZXNzaW9uU3luY0NhbGxzLCBbJ3Nlc3MtQSddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFubmVyLmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhiYW5uZXIudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdCb3VuZCBsZWFmIHNuYXBzaG90JykpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBsZWZ0b3Zlckxvb2tzTGl2ZURldGFpbEhvc3Qob3B0aW9uczoge1xuXHRcdHJlYWRvbmx5IHBhaXJpbmdQZW5kaW5nOiBib29sZWFuO1xuXHRcdHJlYWRvbmx5IGNhY2hlZEJvZHk/OiBzdHJpbmc7XG5cdFx0cmVhZG9ubHkgaGFzTGVhc2U/OiBib29sZWFuO1xuXHR9KToge1xuXHRcdGhvc3Q6IElSZWFkaW5nQ29sdW1uRGV0YWlsSG9zdCAmIHsgcmVhZG9ubHkgc3R1YlNlcnZpY2U6IHsgaXNFbmdpbmVDb25uZWN0ZWQoKTogYm9vbGVhbiB9IH07XG5cdFx0cmVxdWVzdERldGFpbENhbGxzOiBudW1iZXI7XG5cdH0ge1xuXHRcdGNvbnN0IHN0YXRlID0geyByZXF1ZXN0RGV0YWlsQ2FsbHM6IDAgfTtcblx0XHRjb25zdCBkZXRhaWxzID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRpZiAob3B0aW9ucy5jYWNoZWRCb2R5ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGRldGFpbHMuc2V0KCdkZXRhaWw6bGVmdG92ZXInLCBvcHRpb25zLmNhY2hlZEJvZHkpO1xuXHRcdH1cblx0XHRjb25zdCBoYXNMZWFzZSA9IG9wdGlvbnMuaGFzTGVhc2UgIT09IGZhbHNlO1xuXHRcdGNvbnN0IGhvc3Q6IElSZWFkaW5nQ29sdW1uRGV0YWlsSG9zdCAmIHsgcmVhZG9ubHkgc3R1YlNlcnZpY2U6IHsgaXNFbmdpbmVDb25uZWN0ZWQoKTogYm9vbGVhbiB9IH0gPSB7XG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiBoYXNMZWFzZVxuXHRcdFx0XHQ/IHtcblx0XHRcdFx0XHRkZXRhaWxzLFxuXHRcdFx0XHRcdHJlcXVlc3REZXRhaWw6IGFzeW5jIChfcmVmOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHRcdHN0YXRlLnJlcXVlc3REZXRhaWxDYWxscysrO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHsgb2s6IHRydWUgYXMgY29uc3QsIHRydW5jYXRlZDogZmFsc2UgYXMgY29uc3QsIGNvbnRlbnQ6ICdsaXZlLWZldGNoZWQnIH07XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fVxuXHRcdFx0XHQ6IHVuZGVmaW5lZCxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpOiBDb25uZWN0aW9uUGhhc2UgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IG9wdGlvbnMucGFpcmluZ1BlbmRpbmcgfSksXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhvc3QsXG5cdFx0XHRnZXQgcmVxdWVzdERldGFpbENhbGxzKCkgeyByZXR1cm4gc3RhdGUucmVxdWVzdERldGFpbENhbGxzOyB9LFxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIGxlZnRvdmVyIGxlYXNlIHJlcXVlc3REZXRhaWwgc3RheXMgMCB1bmFyeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVEZXRhaWxIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0Y29uc3Qgb3V0Y29tZSA9IGF3YWl0IHJlcXVlc3RSZWFkaW5nQ29sdW1uRGV0YWlsKGZpeHR1cmUuaG9zdCwgJ2RldGFpbDpsZWZ0b3ZlcicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3V0Y29tZSwgeyBvazogZmFsc2UsIHJlYXNvbjogJ3VuYXZhaWxhYmxlJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5yZXF1ZXN0RGV0YWlsQ2FsbHMsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIGxlZnRvdmVyIGxlYXNlIHNlcnZlcyBjYWNoZWQgbGVmdG92ZXIgYm9keSB3aXRob3V0IHJlcXVlc3REZXRhaWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlRGV0YWlsSG9zdCh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlLCBjYWNoZWRCb2R5OiAnY2FjaGVkIGxlZnRvdmVyJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGNvbnN0IG91dGNvbWUgPSBhd2FpdCByZXF1ZXN0UmVhZGluZ0NvbHVtbkRldGFpbChmaXh0dXJlLmhvc3QsICdkZXRhaWw6bGVmdG92ZXInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG91dGNvbWUsIHsgb2s6IHRydWUsIHRydW5jYXRlZDogZmFsc2UsIGNvbnRlbnQ6ICdjYWNoZWQgbGVmdG92ZXInIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnJlcXVlc3REZXRhaWxDYWxscywgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCBsZWZ0b3ZlciBzdGlsbCByZXF1ZXN0RGV0YWlsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZURldGFpbEhvc3QoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgZmFsc2UpO1xuXHRcdGNvbnN0IG91dGNvbWUgPSBhd2FpdCByZXF1ZXN0UmVhZGluZ0NvbHVtbkRldGFpbChmaXh0dXJlLmhvc3QsICdkZXRhaWw6bGVmdG92ZXInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG91dGNvbWUsIHsgb2s6IHRydWUsIHRydW5jYXRlZDogZmFsc2UsIGNvbnRlbnQ6ICdsaXZlLWZldGNoZWQnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnJlcXVlc3REZXRhaWxDYWxscywgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcnN0LXB1bGwgcGFpcmluZyB3aXRob3V0IGxlYXNlIHJlcXVlc3REZXRhaWwgc3RheXMgdW5hdmFpbGFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlRGV0YWlsSG9zdCh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlLCBoYXNMZWFzZTogZmFsc2UgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRjb25zdCBvdXRjb21lID0gYXdhaXQgcmVxdWVzdFJlYWRpbmdDb2x1bW5EZXRhaWwoZml4dHVyZS5ob3N0LCAnZGV0YWlsOmxlZnRvdmVyJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvdXRjb21lLCB7IG9rOiBmYWxzZSwgcmVhc29uOiAndW5hdmFpbGFibGUnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnJlcXVlc3REZXRhaWxDYWxscywgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIHJlYWRpbmctY29sdW1uIHNvdXJjZXMgcmV2aWV3IGV4ZWN1dGVDb21tYW5kIHJlamVjdHMgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3JldmlldyBib29tJyk7XG5cdFx0Y29uc3QgY2FsbHM6IHsgaWQ6IHN0cmluZzsgYXJnczogdW5rbm93bltdIH1bXSA9IFtdO1xuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4ge1xuXHRcdFx0ZXhlY3V0ZVJlYWRpbmdDb2x1bW5Tb3VyY2VzUmV2aWV3KHtcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IGFzeW5jIChpZDogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pID0+IHtcblx0XHRcdFx0XHRjYWxscy5wdXNoKHsgaWQsIGFyZ3MgfSk7XG5cdFx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSwgWydmaWxlOi8vL3RtcC9yZWFkbWUubWQnXSk7XG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzWzBdIS5pZCwgU09VUkNFU19SRVZJRVdfU0hPV19GT1JfUEFUSFNfQ09NTUFORCk7XG5cdFx0Y29uc3QgdXJpcyA9IGNhbGxzWzBdIS5hcmdzWzBdIGFzIFVSSVtdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1cmlzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVyaXNbMF0hLnRvU3RyaW5nKHRydWUpLCAnZmlsZTovLy90bXAvcmVhZG1lLm1kJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRpbmcgY29sdW1uIHNvdXJjZXMgcmV2aWV3IGZpcmUtYW5kLWZvcmdldCB2b2lkcyBkb3VibGUtY2F0Y2ggb25VbmV4cGVjdGVkRXJyb3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgX19yZWFkRmlsZUluVGVzdHMoYCR7cHJvY2Vzcy5jd2QoKX0vc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNSZWFkaW5nQ29sdW1uLnRzYCk7XG5cdFx0Y29uc3QgZG91YmxlQ2F0Y2ggPSAnLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvciknO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoJ29uUmV2aWV3TmF2Q2xpY2s6IHBhdGhzID0+IGV4ZWN1dGVSZWFkaW5nQ29sdW1uU291cmNlc1Jldmlldyhob3N0LmNvbW1hbmRTZXJ2aWNlLCBwYXRocyknKSk7XG5cdFx0YXNzZXJ0Lm9rKHNvdXJjZS5pbmNsdWRlcyhkb3VibGVDYXRjaCkpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIGhvc3QuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJykpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBtZXJtYWlkRXh0ZW5zaW9uSW5mbyhwYXRoID0gJy90bXAvbWVybWFpZCcpOiBDb252ZXJzYXRpb25NZXJtYWlkRXh0ZW5zaW9uSW5mbyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGV4dGVuc2lvbkxvY2F0aW9uOiBVUkkuZmlsZShwYXRoKSxcblx0XHRcdGV4dGVuc2lvbklkOiBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllcigndnNjb2RlLm1lcm1haWQtbWFya2Rvd24tZmVhdHVyZXMnKSxcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gbWVybWFpZFJlc29sdmVIb3N0KG9wdGlvbnM6IHtcblx0XHRyZWFkb25seSBnZXRFeHRlbnNpb246ICgpID0+IFByb21pc2U8eyBleHRlbnNpb25Mb2NhdGlvbjogVVJJOyBpZGVudGlmaWVyOiBFeHRlbnNpb25JZGVudGlmaWVyIH0gfCB1bmRlZmluZWQ+O1xuXHRcdG1lcm1haWRFeHRlbnNpb25JbmZvPzogQ29udmVyc2F0aW9uTWVybWFpZEV4dGVuc2lvbkluZm87XG5cdFx0cmVhZG9ubHkgaXNEaXNwb3NlZD86IGJvb2xlYW47XG5cdFx0cmVhZG9ubHkgb25TZXRNZXJtYWlkPzogKGluZm86IENvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb25JbmZvIHwgdW5kZWZpbmVkKSA9PiB2b2lkO1xuXHRcdHJlYWRvbmx5IG9uQXBwbHlCYXNlbGluZT86ICgpID0+IHZvaWQ7XG5cdH0pIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZXh0ZW5zaW9uU2VydmljZToge1xuXHRcdFx0XHRnZXRFeHRlbnNpb246IG9wdGlvbnMuZ2V0RXh0ZW5zaW9uLFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdFx0aXNEaXNwb3NlZDogb3B0aW9ucy5pc0Rpc3Bvc2VkID8/IGZhbHNlLFxuXHRcdFx0bWVybWFpZEV4dGVuc2lvbkluZm86IG9wdGlvbnMubWVybWFpZEV4dGVuc2lvbkluZm8sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHtcblx0XHRcdFx0c2V0TWVybWFpZEV4dGVuc2lvbkluZm8oaW5mbzogQ29udmVyc2F0aW9uTWVybWFpZEV4dGVuc2lvbkluZm8gfCB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRvcHRpb25zLm9uU2V0TWVybWFpZD8uKGluZm8pO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGFwcGx5U2Vzc2lvblZpZXdUaW1lbGluZSgpIHtcblx0XHRcdFx0b3B0aW9ucy5vbkFwcGx5QmFzZWxpbmU/LigpO1xuXHRcdFx0fSxcblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gbWVybWFpZCByZXNvbHZlIHRoZW4tY2FsbGJhY2sgdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgaG9zdCA9IG1lcm1haWRSZXNvbHZlSG9zdCh7XG5cdFx0XHRnZXRFeHRlbnNpb246IGFzeW5jICgpID0+ICh7XG5cdFx0XHRcdGV4dGVuc2lvbkxvY2F0aW9uOiBVUkkuZmlsZSgnL3RtcC9tZXJtYWlkJyksXG5cdFx0XHRcdGlkZW50aWZpZXI6IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKCd2c2NvZGUubWVybWFpZC1tYXJrZG93bi1mZWF0dXJlcycpLFxuXHRcdFx0fSksXG5cdFx0XHRvblNldE1lcm1haWQ6ICgpID0+IHtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHNjaGVkdWxlQ29udmVyc2F0aW9uTWVybWFpZEV4dGVuc2lvblJlc29sdmUoaG9zdCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBtZXJtYWlkIGdldEV4dGVuc2lvbiByZWplY3RzLCB0aGVuLWNhbGxiYWNrIHRocm93cywgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRjb25zdCBob3N0ID0gbWVybWFpZFJlc29sdmVIb3N0KHtcblx0XHRcdGdldEV4dGVuc2lvbjogKCkgPT4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdnZXRFeHRlbnNpb24gYm9vbScpKSxcblx0XHRcdG1lcm1haWRFeHRlbnNpb25JbmZvOiBtZXJtYWlkRXh0ZW5zaW9uSW5mbygnL3RtcC9zdGFsZScpLFxuXHRcdFx0b25TZXRNZXJtYWlkOiAoKSA9PiB7XG5cdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiBzY2hlZHVsZUNvbnZlcnNhdGlvbk1lcm1haWRFeHRlbnNpb25SZXNvbHZlKGhvc3QpKTtcblx0fSk7XG5cblx0dGVzdCgnY29udmVyc2F0aW9uIGxlbnMgbWVybWFpZCByZXNvbHZlIGZpcmUtYW5kLWZvcmdldCB2b2lkcyBkb3VibGUtY2F0Y2ggb25VbmV4cGVjdGVkRXJyb3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgX19yZWFkRmlsZUluVGVzdHMoYCR7cHJvY2Vzcy5jd2QoKX0vc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnMudHNgKTtcblx0XHRjb25zdCBkb3VibGVDYXRjaCA9ICcuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKSc7XG5cdFx0YXNzZXJ0Lm9rKHNvdXJjZS5pbmNsdWRlcygnc2NoZWR1bGVDb252ZXJzYXRpb25NZXJtYWlkRXh0ZW5zaW9uUmVzb2x2ZSh0aGlzKTsnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNvdXJjZS5pbmNsdWRlcygndm9pZCByZXNvbHZlQ29udmVyc2F0aW9uTWVybWFpZEV4dGVuc2lvbihob3N0LmV4dGVuc2lvblNlcnZpY2UpLnRoZW4oJykpO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoZG91YmxlQ2F0Y2gpKTtcblx0XHRhc3NlcnQub2soIXNvdXJjZS5pbmNsdWRlcygndm9pZCByZXNvbHZlQ29udmVyc2F0aW9uTWVybWFpZEV4dGVuc2lvbih0aGlzLmV4dGVuc2lvblNlcnZpY2UpLnRoZW4oJykpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBhc0xpdmVDaHJvbWVIb3N0KGhvc3Q6IG9iamVjdCk6IFBhcmFtZXRlcnM8dHlwZW9mIHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZT5bMF0ge1xuXHRcdHJldHVybiBob3N0IGFzIFBhcmFtZXRlcnM8dHlwZW9mIHNob3VsZFNob3dSZWFkaW5nQ29sdW1uTGl2ZUNocm9tZT5bMF07XG5cdH1cblxuXHRmdW5jdGlvbiBsZWZ0b3ZlckxlYXNlU25hcHNob3Qoc3luYzogU3luY0Nocm9tZSkge1xuXHRcdHJldHVybiB7XG5cdFx0XHRzZXNzaW9uSWQ6ICd1YS1jYWNoZScsXG5cdFx0XHRzbmFwc2hvdDoge1xuXHRcdFx0XHRzZXNzaW9uSWQ6ICd1YS1jYWNoZScsXG5cdFx0XHRcdHN5bmMsXG5cdFx0XHRcdHRpbWVsaW5lOiBbXSxcblx0XHRcdFx0b3ZlcmxheTogeyBibG9ja3M6IFtdIH0sXG5cdFx0XHRcdHBlbmRpbmdBY3Rpb25zOiBbXSxcblx0XHRcdFx0bG9jYWxQZW5kaW5nU2VuZHM6IFtdLFxuXHRcdFx0fSxcblx0XHRcdGF0dHJpYnV0aW9uOiBuZXcgTWFwKCksXG5cdFx0XHRkZXRhaWxzOiBuZXcgTWFwKCksXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIHBhaXJpbmdTeW5jQ2hyb21lSG9zdChvcHRpb25zOiB7XG5cdFx0cmVhZG9ubHkgbGVmdG92ZXI6IFN5bmNDaHJvbWU7XG5cdFx0cmVhZG9ubHkgcm9zdGVyU3luYzogU3luY0Nocm9tZTtcblx0XHRyZWFkb25seSBnZXRTZXNzaW9uU3luYz86IChzZXNzaW9uSWQ6IHN0cmluZykgPT4gU3luY0Nocm9tZTtcblx0fSk6IElDb252ZXJzYXRpb25MZW5zUHJvamVjdGlvbkhvc3QgJiB7IHJlYWRvbmx5IHNlc3Npb25TeW5jQmFkZ2U6IEhUTUxTcGFuRWxlbWVudDsgcmVhZG9ubHkgc3RhbGVCYW5uZXI6IEhUTUxEaXZFbGVtZW50OyBnZXRTZXNzaW9uU3luY0NhbGxzOiBudW1iZXIgfSB7XG5cdFx0Y29uc3QgbGVmdG92ZXIgPSBvcHRpb25zLmxlZnRvdmVyO1xuXHRcdGNvbnN0IHJvc3RlclN5bmMgPSBvcHRpb25zLnJvc3RlclN5bmM7XG5cdFx0Y29uc3QgY2FsbHMgPSB7IGNvdW50OiAwIH07XG5cdFx0Y29uc3QgYmFkZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG5cdFx0Y29uc3QgYmFubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0YmFubmVyLmNsYXNzTmFtZSA9IGNvbnZlcnNhdGlvbkxlbnNTdGFsZVNuYXBzaG90Q2xhc3M7XG5cdFx0YmFubmVyLmhpZGRlbiA9IHRydWU7XG5cdFx0Y29uc3QgcmVhZGluZ0NvbHVtbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHJlYWRpbmdDb2x1bW4uYXBwZW5kQ2hpbGQoYmFubmVyKTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRsZW5zSWQ6ICdjb252ZXJzYXRpb24nIGFzIGNvbnN0LFxuXHRcdFx0ZmlsdGVyQWdlbnRJZDogdW5kZWZpbmVkLFxuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdjb21wb3NlJyBhcyBjb25zdCxcblx0XHRcdGNvbnZlcnNhdGlvblBoYXNlOiAncHJlZmlyc3QnIGFzIGNvbnN0LFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogW10sXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiBsZWZ0b3ZlckxlYXNlU25hcHNob3QobGVmdG92ZXIpLFxuXHRcdFx0c2Vzc2lvblN5bmNCYWRnZTogYmFkZ2UsXG5cdFx0XHRyZWFkaW5nQ29sdW1uLFxuXHRcdFx0c3RhbGVCYW5uZXI6IGJhbm5lcixcblx0XHRcdGdldCBnZXRTZXNzaW9uU3luY0NhbGxzKCkgeyByZXR1cm4gY2FsbHMuY291bnQ7IH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRnZXRTZXNzaW9uU3luYzogKHNlc3Npb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0Y2FsbHMuY291bnQrKztcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbklkLCAndWEtY2FjaGUnKTtcblx0XHRcdFx0XHRyZXR1cm4gb3B0aW9ucy5nZXRTZXNzaW9uU3luYz8uKHNlc3Npb25JZCkgPz8gcm9zdGVyU3luYztcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uSWQ6ICgpID0+ICd1YS1jYWNoZScsXG5cdFx0XHR9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICd1YS1jYWNoZScsXG5cdFx0XHRyZXZpZXdOYXZTZXJ2aWNlOiB7IGdldFJldmlld05hdkZvclNlc3Npb246ICgpID0+IFtdIH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHsgYXBwbHlFbnRyaWVzOiAoKSA9PiB7IH0gfSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7fSxcblx0XHRcdHJlbmRlckluYm94U3RhdHVzOiAoKSA9PiB7IH0sXG5cdFx0XHRzeW5jQ29tcG9zZXJQbGFjZW1lbnQ6ICgpID0+IHsgfSxcblx0XHRcdGFwcGx5Q29udmVyc2F0aW9uRGVuc2l0eTogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlU2Vzc2lvbkNvbmZpZ1Zpc2liaWxpdHk6ICgpID0+IHsgfSxcblx0XHRcdGV4aXRDb21wb3NlckVkaXQ6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZUdhdGVSb3c6ICgpID0+IHsgfSxcblx0XHRcdHJlbGF5b3V0UmVhZGluZ1N1cmZhY2VzOiAoKSA9PiB7IH0sXG5cdFx0XHRzbG90SG9zdHM6IHsgZG9jazogeyBjbGFzc0xpc3Q6IHsgdG9nZ2xlOiAoKSA9PiB7IH0gfSB9IH0sXG5cdFx0XHRwcmVmaXJzdEhlcm86IHsgaGlkZGVuOiBmYWxzZSwgYXBwZW5kQ2hpbGQ6ICgpID0+IHsgfSB9LFxuXHRcdFx0ZG9ja1Jvb3Q6IHsgaW5zZXJ0QmVmb3JlOiAoKSA9PiB7IH0gfSxcblx0XHRcdGdhdGVSb3c6IHt9LFxuXHRcdFx0aWRlbnRpdHlTdHJpcDogeyBlbGVtZW50OiB7fSB9LFxuXHRcdFx0aW5ib3hPdmVybGF5OiB7IGVsZW1lbnQ6IHsgaGlkZGVuOiB0cnVlIH0gfSxcblx0XHR9O1xuXHRcdHJldHVybiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNQcm9qZWN0aW9uSG9zdCAmIHsgcmVhZG9ubHkgc2Vzc2lvblN5bmNCYWRnZTogSFRNTFNwYW5FbGVtZW50OyByZWFkb25seSBzdGFsZUJhbm5lcjogSFRNTERpdkVsZW1lbnQ7IGdldFNlc3Npb25TeW5jQ2FsbHM6IG51bWJlciB9O1xuXHR9XG5cblx0dGVzdCgnYXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lIHBhaXJpbmcgbGVmdG92ZXIgbGl2ZS9zeW5jaW5nIGxlYXNlIHBhaW50cyByb3N0ZXIgZGVtb3RlZCBzeW5jIG5vdCBTZXNzaW9uIGxpdmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGVtb3RlZDogU3luY0Nocm9tZSA9IHsga2luZDogJ2Nsb3NlZCcsIHJlYXNvbjogJ0NhY2hlZCBzbmFwc2hvdCAocmVhZC1vbmx5KScgfTtcblx0XHRmb3IgKGNvbnN0IGxlZnRvdmVyIG9mIFt7IGtpbmQ6ICdsaXZlJyBhcyBjb25zdCB9LCB7IGtpbmQ6ICdzeW5jaW5nJyBhcyBjb25zdCB9XSkge1xuXHRcdFx0Y29uc3QgaG9zdCA9IHBhaXJpbmdTeW5jQ2hyb21lSG9zdCh7IGxlZnRvdmVyLCByb3N0ZXJTeW5jOiBkZW1vdGVkIH0pO1xuXHRcdFx0YXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lKGhvc3QsIHsga2luZDogJ2Jhc2VsaW5lJyB9KTtcblx0XHRcdGFzc2VydC5vayhob3N0LmdldFNlc3Npb25TeW5jQ2FsbHMgPiAwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5nZXRTZXNzaW9uU3luYygndWEtY2FjaGUnKSwgZGVtb3RlZCk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCAnU2Vzc2lvbiBsaXZlJyk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCAnU2Vzc2lvbiBzeW5jaW5nJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCBmb3JtYXRTeW5jQ2hyb21lTGFiZWwoZGVtb3RlZCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblN5bmNCYWRnZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgZm9ybWF0U3luY0Nocm9tZUxhYmVsKGRlbW90ZWQpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGl0bGUsIGZvcm1hdFN5bmNDaHJvbWVMYWJlbChkZW1vdGVkKSk7XG5cdFx0XHQvLyBFbXB0eSBsZWFzZTogYjBiMTRiMmEzNjAgZG9lcyBub3QgY2xhaW0gYSBkaXNjb25uZWN0IHNuYXBzaG90LlxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc3RhbGVCYW5uZXIuaGlkZGVuLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0YWxlQmFubmVyLnRleHRDb250ZW50LCAnJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdhcHBseVNlc3Npb25WaWV3VGltZWxpbmUgY29ubmVjdGVkIGxlZnRvdmVyIGxpdmUgc3RpbGwgcGFpbnRzIFNlc3Npb24gbGl2ZScsICgpID0+IHtcblx0XHRjb25zdCBsaXZlOiBTeW5jQ2hyb21lID0geyBraW5kOiAnbGl2ZScgfTtcblx0XHRjb25zdCBob3N0ID0gcGFpcmluZ1N5bmNDaHJvbWVIb3N0KHsgbGVmdG92ZXI6IGxpdmUsIHJvc3RlclN5bmM6IGxpdmUgfSk7XG5cdFx0YXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lKGhvc3QsIHsga2luZDogJ2Jhc2VsaW5lJyB9KTtcblx0XHRhc3NlcnQub2soaG9zdC5nZXRTZXNzaW9uU3luY0NhbGxzID4gMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblN5bmNCYWRnZS50ZXh0Q29udGVudCwgJ1Nlc3Npb24gbGl2ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGl0bGUsICdTZXNzaW9uIGxpdmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdGFsZUJhbm5lci5oaWRkZW4sIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVTeW5jQ2hyb21lIGFuZCBzdGFsZSBiYW5uZXIgaWdub3JlIGxlZnRvdmVyIGxpdmUgbGVhc2UgYW5kIGZvbGxvdyBnZXRTZXNzaW9uU3luYycsICgpID0+IHtcblx0XHRjb25zdCBkZW1vdGVkOiBTeW5jQ2hyb21lID0geyBraW5kOiAnY2xvc2VkJywgcmVhc29uOiAnQ2FjaGVkIHNuYXBzaG90IChyZWFkLW9ubHkpJyB9O1xuXHRcdGNvbnN0IGhvc3QgPSBwYWlyaW5nU3luY0Nocm9tZUhvc3QoeyBsZWZ0b3ZlcjogeyBraW5kOiAnbGl2ZScgfSwgcm9zdGVyU3luYzogZGVtb3RlZCB9KTtcblx0XHR1cGRhdGVTeW5jQ2hyb21lKGhvc3QsIHsga2luZDogJ2xpdmUnIH0pO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGV4dENvbnRlbnQsICdTZXNzaW9uIGxpdmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCBmb3JtYXRTeW5jQ2hyb21lTGFiZWwoZGVtb3RlZCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGl0bGUsIGZvcm1hdFN5bmNDaHJvbWVMYWJlbChkZW1vdGVkKSk7XG5cdFx0Ly8gTm8gcGFpbnRlZCByb3dzOiB0aGUgY2xvc2VkIHJvc3RlciBzeW5jIHN0aWxsIG11c3Qgbm90IGludmVudCBhIHNuYXBzaG90IGJhbm5lci5cblx0XHRyZWZyZXNoU3RhbGVTbmFwc2hvdEJhbm5lcihob3N0LCB7IGtpbmQ6ICdsaXZlJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdGFsZUJhbm5lci5oaWRkZW4sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0YWxlQmFubmVyLnRleHRDb250ZW50LCAnJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhaXJpbmctaG9sZCBzYW1lLXNlc3Npb24gS0VFUCBjb25uZWN0aW9uIGNoYW5nZSBwYWludHMgZ2V0U2Vzc2lvblN5bmMgY2xvc2VkIGNocm9tZSBub3QgU2Vzc2lvbiBsaXZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zLnRzYCk7XG5cdFx0Y29uc3QgZW5naW5lU3RhcnQgPSBzb3VyY2UuaW5kZXhPZigndGhpcy5zdHViU2VydmljZS5vbkRpZENoYW5nZUVuZ2luZUNvbm5lY3Rpb24oKCkgPT4geycpO1xuXHRcdGNvbnN0IHVhU3RhcnQgPSBzb3VyY2UuaW5kZXhPZigndGhpcy51YUNvbm5lY3Rpb24ub25EaWRDaGFuZ2VDb25uZWN0aW9uKCgpID0+IHsnKTtcblx0XHRhc3NlcnQub2soZW5naW5lU3RhcnQgPj0gMCAmJiB1YVN0YXJ0ID4gZW5naW5lU3RhcnQpO1xuXHRcdGNvbnN0IGVuZ2luZUJsb2NrID0gc291cmNlLnNsaWNlKGVuZ2luZVN0YXJ0LCBzb3VyY2UuaW5kZXhPZignfSkpOycsIGVuZ2luZVN0YXJ0KSk7XG5cdFx0Y29uc3QgdWFCbG9jayA9IHNvdXJjZS5zbGljZSh1YVN0YXJ0LCBzb3VyY2UuaW5kZXhPZignfSkpOycsIHVhU3RhcnQpKTtcblx0XHRhc3NlcnQub2soZW5naW5lQmxvY2suaW5jbHVkZXMoJ3RoaXMuYmluZFNlc3Npb25WaWV3KHRoaXMuZ2V0Qm91bmRTZXNzaW9uSWQoKSk7JykpO1xuXHRcdGFzc2VydC5vayhlbmdpbmVCbG9jay5pbmNsdWRlcygndGhpcy51cGRhdGVDb252ZXJzYXRpb25QaGFzZSgpOycpKTtcblx0XHRhc3NlcnQub2soZW5naW5lQmxvY2suaW5jbHVkZXMoJ3RoaXMudXBkYXRlU3luY0Nocm9tZSgpOycpKTtcblx0XHRhc3NlcnQub2soZW5naW5lQmxvY2suaW5kZXhPZigndGhpcy5iaW5kU2Vzc2lvblZpZXcodGhpcy5nZXRCb3VuZFNlc3Npb25JZCgpKTsnKSA8IGVuZ2luZUJsb2NrLmluZGV4T2YoJ3RoaXMudXBkYXRlQ29udmVyc2F0aW9uUGhhc2UoKTsnKSk7XG5cdFx0YXNzZXJ0Lm9rKGVuZ2luZUJsb2NrLmluZGV4T2YoJ3RoaXMudXBkYXRlQ29udmVyc2F0aW9uUGhhc2UoKTsnKSA8IGVuZ2luZUJsb2NrLmluZGV4T2YoJ3RoaXMudXBkYXRlU3luY0Nocm9tZSgpOycpKTtcblx0XHRhc3NlcnQub2sodWFCbG9jay5pbmNsdWRlcygndGhpcy5iaW5kU2Vzc2lvblZpZXcodGhpcy5nZXRCb3VuZFNlc3Npb25JZCgpKTsnKSk7XG5cdFx0YXNzZXJ0Lm9rKHVhQmxvY2suaW5jbHVkZXMoJ3RoaXMudXBkYXRlQ29udmVyc2F0aW9uUGhhc2UoKTsnKSk7XG5cdFx0YXNzZXJ0Lm9rKHVhQmxvY2suaW5jbHVkZXMoJ3RoaXMudXBkYXRlU3luY0Nocm9tZSgpOycpKTtcblx0XHRhc3NlcnQub2sodWFCbG9jay5pbmRleE9mKCd0aGlzLmJpbmRTZXNzaW9uVmlldyh0aGlzLmdldEJvdW5kU2Vzc2lvbklkKCkpOycpIDwgdWFCbG9jay5pbmRleE9mKCd0aGlzLnVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlKCk7JykpO1xuXHRcdGFzc2VydC5vayh1YUJsb2NrLmluZGV4T2YoJ3RoaXMudXBkYXRlQ29udmVyc2F0aW9uUGhhc2UoKTsnKSA8IHVhQmxvY2suaW5kZXhPZigndGhpcy51cGRhdGVTeW5jQ2hyb21lKCk7JykpO1xuXG5cdFx0Y29uc3QgZGVtb3RlZDogU3luY0Nocm9tZSA9IHsga2luZDogJ2Nsb3NlZCcsIHJlYXNvbjogJ0NhY2hlZCBzbmFwc2hvdCAocmVhZC1vbmx5KScgfTtcblx0XHRjb25zdCBsZWZ0b3ZlcjogQ29udmVyc2F0aW9uVGltZWxpbmVFbnRyeVtdID0gW1xuXHRcdFx0eyBpZDogJ3QxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdFx0eyBpZDogJ3QyJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdF07XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaG9zdCA9IHBhaXJpbmdTeW5jQ2hyb21lSG9zdCh7IGxlZnRvdmVyOiB7IGtpbmQ6ICdsaXZlJyB9LCByb3N0ZXJTeW5jOiBkZW1vdGVkIH0pO1xuXHRcdGhvc3QubGFzdEF0dGFjaGVkRW50cmllcyA9IGxlZnRvdmVyO1xuXHRcdGhvc3Quc2Vzc2lvblN5bmNCYWRnZS50ZXh0Q29udGVudCA9ICdTZXNzaW9uIGxpdmUnO1xuXHRcdGhvc3Quc2Vzc2lvblN5bmNCYWRnZS50aXRsZSA9ICdTZXNzaW9uIGxpdmUnO1xuXHRcdE9iamVjdC5hc3NpZ24oaG9zdCwge1xuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSB9KSxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHQuLi5ob3N0LnN0dWJTZXJ2aWNlLFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdwYWlyaW5nLWhvbGQgc2FtZS1zZXNzaW9uIEtFRVAgbXVzdCBub3QgYWNxdWlyZScpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRhcHBseUVudHJpZXM6ICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3BhaXJpbmctaG9sZCBzYW1lLXNlc3Npb24gS0VFUCBtdXN0IG5vdCBhcHBseUVudHJpZXMnKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVmcmVzaFByZXNlbnRhdGlvbjogKCkgPT4geyB9LFxuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRjb25zdCBwcmlvckxlYXNlID0gaG9zdC5zZXNzaW9uVmlld0xlYXNlO1xuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3QsICd1YS1jYWNoZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHByaW9yTGVhc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMsIGxlZnRvdmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLnRleHRDb250ZW50LCAnU2Vzc2lvbiBsaXZlJyk7XG5cdFx0dXBkYXRlQ29udmVyc2F0aW9uUGhhc2UoaG9zdCk7XG5cdFx0dXBkYXRlU3luY0Nocm9tZShob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCBwcmlvckxlYXNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLCBsZWZ0b3Zlcik7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblN5bmNCYWRnZS50ZXh0Q29udGVudCwgJ1Nlc3Npb24gbGl2ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25TeW5jQmFkZ2UudGV4dENvbnRlbnQsIGZvcm1hdFN5bmNDaHJvbWVMYWJlbChkZW1vdGVkKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblN5bmNCYWRnZS50aXRsZSwgZm9ybWF0U3luY0Nocm9tZUxhYmVsKGRlbW90ZWQpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uU3luY0JhZGdlLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCBmb3JtYXRTeW5jQ2hyb21lTGFiZWwoZGVtb3RlZCkpO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IHNraXBzIGFwcGx5RW50cmllcyBhZnRlciBkaXNwb3NlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpZmV0aW1lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRsZXQgYWNxdWlyZSA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IHRydWUsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHsgc2Vzc2lvbklkOiAnczEnIH0sXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBbXSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0YWNxdWlyZSsrO1xuXHRcdFx0XHRcdHJldHVybiB7IHNlc3Npb25JZDogJ3MxJywgc25hcHNob3Q6IHsgc2Vzc2lvbklkOiAnczEnIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHsgYXBwbHlFbnRyaWVzOiAoKSA9PiB7IGFwcGx5RW50cmllcysrOyB9IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjcXVpcmUsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdiaW5kU2Vzc2lvblZpZXcgc3RpbGwgYXBwbHlFbnRyaWVzIGVtcHR5IHRyZWUgd2hpbGUgbGl2ZScsICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHsgc2Vzc2lvbklkOiAnczEnIH0sXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBbeyBpZDogJ3QxJyB9XSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHsgYXBwbHlFbnRyaWVzOiAoKSA9PiB7IGFwcGx5RW50cmllcysrOyB9IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcywgW10pO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IGVtcHR5IHNlc3Npb25JZCBzdGlsbCBjbGVhcnMgbGVmdG92ZXIgd2hpbGUgZW5naW5lIHJvc3RlciBpcyBpbi1mbGlnaHQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0bGV0IGFwcGx5RW50cmllcyA9IDA7XG5cdFx0bGV0IGFjcXVpcmUgPSAwO1xuXHRcdGxldCBhcHBsaWVkRW1wdHkgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdHNlc3Npb25WaWV3TGlmZXRpbWU6IGxpZmV0aW1lLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogeyBzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJyB9LFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogW3sgaWQ6ICd0MScgfSwgeyBpZDogJ3QyJyB9XSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdGFjcXVpcmUrKztcblx0XHRcdFx0XHRyZXR1cm4geyBzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJywgc25hcHNob3Q6IHsgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicgfSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRhcHBseUVudHJpZXM6IChlbnRyaWVzOiByZWFkb25seSB1bmtub3duW10pID0+IHtcblx0XHRcdFx0XHRhcHBseUVudHJpZXMrKztcblx0XHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdGFwcGxpZWRFbXB0eSsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGxpZWRFbXB0eSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjcXVpcmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcy5sZW5ndGgsIDApO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IGtlZXBzIGxlZnRvdmVyIHRpbWVsaW5lIHdoaWxlIGVuZ2luZSByb3N0ZXIgaXMgaW4tZmxpZ2h0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpZmV0aW1lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHByaW9yTGVhc2UgPSB7IHNlc3Npb25JZDogJ3Nlc3MtbGVmdG92ZXInIH07XG5cdFx0Y29uc3QgbGVmdG92ZXIgPSBbeyBpZDogJ3QxJyB9LCB7IGlkOiAndDInIH1dO1xuXHRcdGxldCBhcHBseUVudHJpZXMgPSAwO1xuXHRcdGxldCBhY3F1aXJlID0gMDtcblx0XHRjb25zdCBsaWZldGltZU1hcmtlciA9IHtcblx0XHRcdGRpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGRpc3Bvc2UoKSB7IHRoaXMuZGlzcG9zZWQgPSB0cnVlOyB9LFxuXHRcdH07XG5cdFx0bGlmZXRpbWUuYWRkKGxpZmV0aW1lTWFya2VyKTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHByaW9yTGVhc2UsXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBsZWZ0b3Zlcixcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGFjcXVpcmVTZXNzaW9uVmlldzogKCkgPT4ge1xuXHRcdFx0XHRcdGFjcXVpcmUrKztcblx0XHRcdFx0XHRyZXR1cm4geyBzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJywgc25hcHNob3Q6IHsgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicgfSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZTogeyBhcHBseUVudHJpZXM6ICgpID0+IHsgYXBwbHlFbnRyaWVzKys7IH0gfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cdFx0YmluZFNlc3Npb25WaWV3KGhvc3QsICdzZXNzLWxlZnRvdmVyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjcXVpcmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHByaW9yTGVhc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLCBsZWZ0b3Zlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpZmV0aW1lTWFya2VyLmRpc3Bvc2VkLCBmYWxzZSk7XG5cdFx0bGlmZXRpbWUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdiaW5kU2Vzc2lvblZpZXcgS0VFUCBsZWZ0b3ZlciByb3N0ZXIgaW4tZmxpZ2h0IGRvZXMgbm90IGtlZXAgb3RoZXIgc2Vzc2lvbiBsZWZ0b3ZlcicsICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsZWZ0b3ZlckEgPSBbeyBpZDogJ3QxJyB9LCB7IGlkOiAndDInIH1dO1xuXHRcdGxldCBhcHBseUVudHJpZXMgPSAwO1xuXHRcdGxldCBhY3F1aXJlID0gMDtcblx0XHRsZXQgYXBwbGllZEVtcHR5ID0gMDtcblx0XHRjb25zdCBsaWZldGltZU1hcmtlciA9IHtcblx0XHRcdGRpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGRpc3Bvc2UoKSB7IHRoaXMuZGlzcG9zZWQgPSB0cnVlOyB9LFxuXHRcdH07XG5cdFx0bGlmZXRpbWUuYWRkKGxpZmV0aW1lTWFya2VyKTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHsgc2Vzc2lvbklkOiAnc2Vzcy1BJyB9LFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogbGVmdG92ZXJBLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0YWNxdWlyZSsrO1xuXHRcdFx0XHRcdHJldHVybiB7IHNlc3Npb25JZDogJ3Nlc3MtQicsIHNuYXBzaG90OiB7IHNlc3Npb25JZDogJ3Nlc3MtQicgfSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRhcHBseUVudHJpZXM6IChlbnRyaWVzOiByZWFkb25seSB1bmtub3duW10pID0+IHtcblx0XHRcdFx0XHRhcHBseUVudHJpZXMrKztcblx0XHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdGFwcGxpZWRFbXB0eSsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnc2Vzcy1CJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGxpZWRFbXB0eSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjcXVpcmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaWZldGltZU1hcmtlci5kaXNwb3NlZCwgdHJ1ZSk7XG5cblx0XHRjb25zdCBzYW1lU2Vzc2lvbkxlZnRvdmVyOiBDb252ZXJzYXRpb25UaW1lbGluZUVudHJ5W10gPSBbXG5cdFx0XHR7IGlkOiAndDEnLCBraW5kOiAndXNlcicsIHRleHQ6ICcnIH0sXG5cdFx0XHR7IGlkOiAndDInLCBraW5kOiAndXNlcicsIHRleHQ6ICcnIH0sXG5cdFx0XTtcblx0XHRjb25zdCBzYW1lU2Vzc2lvbkxlYXNlOiBJQ29udmVyc2F0aW9uU2Vzc2lvblZpZXdMZWFzZSA9IHtcblx0XHRcdHNlc3Npb25JZDogJ3Nlc3MtQScsXG5cdFx0XHRzbmFwc2hvdDogbGVmdG92ZXJMZWFzZVNuYXBzaG90KHsga2luZDogJ2lkbGUnIH0pLnNuYXBzaG90IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvblNlc3Npb25WaWV3TGVhc2VbJ3NuYXBzaG90J10sXG5cdFx0XHRhdHRyaWJ1dGlvbjogbmV3IE1hcCgpLFxuXHRcdFx0ZGV0YWlsczogbmV3IE1hcCgpLFxuXHRcdFx0b25EaWRBcHBseUZyYW1lOiBFdmVudC5Ob25lLFxuXHRcdFx0cG9zdDogYXN5bmMgKCkgPT4gKHsgYWNjZXB0ZWQ6IGZhbHNlLCByZWFzb246ICdub19zdWNoX3Nlc3Npb24nIH0pLFxuXHRcdFx0cmVxdWVzdFJlc3luYygpIHsgfSxcblx0XHRcdGRpc3Bvc2UoKSB7IH0sXG5cdFx0fTtcblx0XHRjb25zdCBrZWVwTWFya2VyID0ge1xuXHRcdFx0ZGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0ZGlzcG9zZSgpIHsgdGhpcy5kaXNwb3NlZCA9IHRydWU7IH0sXG5cdFx0fTtcblx0XHRhcHBseUVudHJpZXMgPSAwO1xuXHRcdGFwcGxpZWRFbXB0eSA9IDA7XG5cdFx0YWNxdWlyZSA9IDA7XG5cdFx0aG9zdC5zZXNzaW9uVmlld0xlYXNlID0gc2FtZVNlc3Npb25MZWFzZTtcblx0XHRob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMgPSBzYW1lU2Vzc2lvbkxlZnRvdmVyO1xuXHRcdGxpZmV0aW1lLmFkZChrZWVwTWFya2VyKTtcblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJ3Nlc3MtQScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3F1aXJlLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCBzYW1lU2Vzc2lvbkxlYXNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLCBzYW1lU2Vzc2lvbkxlZnRvdmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoa2VlcE1hcmtlci5kaXNwb3NlZCwgZmFsc2UpO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IHN0aWxsIGNsZWFycyBlbXB0eSB0aW1lbGluZSBvbiBmaXJzdCBwdWxsIHdoaWxlIGVuZ2luZSByb3N0ZXIgaXMgaW4tZmxpZ2h0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpZmV0aW1lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGxldCBhcHBseUVudHJpZXMgPSAwO1xuXHRcdGxldCBhY3F1aXJlID0gMDtcblx0XHRsZXQgYXBwbGllZEVtcHR5ID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHsgc2Vzc2lvbklkOiAnc2Vzcy1maXJzdCcgfSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IFtdLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0YWNxdWlyZSsrO1xuXHRcdFx0XHRcdHJldHVybiB7IHNlc3Npb25JZDogJ3Nlc3MtZmlyc3QnLCBzbmFwc2hvdDogeyBzZXNzaW9uSWQ6ICdzZXNzLWZpcnN0JyB9IH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7XG5cdFx0XHRcdGFwcGx5RW50cmllczogKGVudHJpZXM6IHJlYWRvbmx5IHVua25vd25bXSkgPT4ge1xuXHRcdFx0XHRcdGFwcGx5RW50cmllcysrO1xuXHRcdFx0XHRcdGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0YXBwbGllZEVtcHR5Kys7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cdFx0YmluZFNlc3Npb25WaWV3KGhvc3QsICdzZXNzLWZpcnN0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGxpZWRFbXB0eSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjcXVpcmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcy5sZW5ndGgsIDApO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IGtlZXBzIGxlZnRvdmVyIHRpbWVsaW5lIHdoaWxlIHBhaXJpbmdQZW5kaW5nIHRoZW4gdHJ1ZSBkaXNjb25uZWN0IHJlYmluZHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcHJpb3JMZWFzZSA9IHsgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicgfTtcblx0XHRjb25zdCBsZWZ0b3ZlciA9IFt7IGlkOiAndDEnIH0sIHsgaWQ6ICd0MicgfV07XG5cdFx0bGV0IGNvbm5lY3RlZCA9IHRydWU7XG5cdFx0bGV0IHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0bGV0IGFwcGx5RW50cmllcyA9IDA7XG5cdFx0bGV0IGFwcGxpZWRFbXB0eSA9IDA7XG5cdFx0bGV0IGFwcGx5QmFzZWxpbmUgPSAwO1xuXHRcdGxldCBhY3F1aXJlID0gMDtcblx0XHRjb25zdCBsaWZldGltZU1hcmtlciA9IHtcblx0XHRcdGRpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGRpc3Bvc2UoKSB7IHRoaXMuZGlzcG9zZWQgPSB0cnVlOyB9LFxuXHRcdH07XG5cdFx0bGlmZXRpbWUuYWRkKGxpZmV0aW1lTWFya2VyKTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHByaW9yTGVhc2UsXG5cdFx0XHRsYXN0QXR0YWNoZWRFbnRyaWVzOiBsZWZ0b3Zlcixcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBjb25uZWN0ZWQgJiYgIXBhaXJpbmdQZW5kaW5nLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gY29ubmVjdGVkICYmICFwYWlyaW5nUGVuZGluZyxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0YWNxdWlyZSsrO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJyxcblx0XHRcdFx0XHRcdHNuYXBzaG90OiB7IHNlc3Npb25JZDogJ3Nlc3MtbGVmdG92ZXInIH0sXG5cdFx0XHRcdFx0XHRkaXNwb3NlKCkgeyB9LFxuXHRcdFx0XHRcdFx0b25EaWRBcHBseUZyYW1lOiAoKSA9PiAoeyBkaXNwb3NlKCkgeyB9IH0pLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogY29ubmVjdGVkID8gJ2Nvbm5lY3RlZCcgOiAnZGlzY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHtcblx0XHRcdFx0YXBwbHlFbnRyaWVzOiAoZW50cmllczogcmVhZG9ubHkgdW5rbm93bltdKSA9PiB7XG5cdFx0XHRcdFx0YXBwbHlFbnRyaWVzKys7XG5cdFx0XHRcdFx0aWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRhcHBsaWVkRW1wdHkrKztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0YXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lOiAoYXBwbGllZDogeyBraW5kOiBzdHJpbmcgfSkgPT4ge1xuXHRcdFx0XHRpZiAoYXBwbGllZC5raW5kID09PSAnYmFzZWxpbmUnKSB7XG5cdFx0XHRcdFx0YXBwbHlCYXNlbGluZSsrO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHBhaXJpbmdQZW5kaW5nID0gdHJ1ZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25QaGFzZSgpLmtpbmQsICdjb25uZWN0ZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIHRydWUpO1xuXG5cdFx0YmluZFNlc3Npb25WaWV3KGhvc3QsICdzZXNzLWxlZnRvdmVyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5RW50cmllcywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGxpZWRFbXB0eSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGx5QmFzZWxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3F1aXJlLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCBwcmlvckxlYXNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcywgbGVmdG92ZXIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaWZldGltZU1hcmtlci5kaXNwb3NlZCwgZmFsc2UpO1xuXG5cdFx0cGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRjb25uZWN0ZWQgPSBmYWxzZTtcblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJ3Nlc3MtbGVmdG92ZXInKTtcblx0XHRhc3NlcnQub2soYWNxdWlyZSA+IDApO1xuXHRcdGFzc2VydC5vayhhcHBseUJhc2VsaW5lID4gMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFwcGxpZWRFbXB0eSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpZmV0aW1lTWFya2VyLmRpc3Bvc2VkLCB0cnVlKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBrZWVwcyBsZWZ0b3ZlciB0aW1lbGluZSBvbiBwcm9kdWN0aW9uIGNvbm5lY3RpbmcgcGFpcmluZyBzbmFwc2hvdCcsICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBwcmlvckxlYXNlID0geyBzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJyB9O1xuXHRcdGNvbnN0IGxlZnRvdmVyID0gW3sgaWQ6ICd0MScgfSwgeyBpZDogJ3QyJyB9XTtcblx0XHRsZXQgcGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRsZXQgcGhhc2U6IENvbm5lY3Rpb25QaGFzZSA9IHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfTtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRsZXQgYXBwbGllZEVtcHR5ID0gMDtcblx0XHRsZXQgYXBwbHlCYXNlbGluZSA9IDA7XG5cdFx0bGV0IGFjcXVpcmUgPSAwO1xuXHRcdGNvbnN0IGxpZmV0aW1lTWFya2VyID0ge1xuXHRcdFx0ZGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0ZGlzcG9zZSgpIHsgdGhpcy5kaXNwb3NlZCA9IHRydWU7IH0sXG5cdFx0fTtcblx0XHRsaWZldGltZS5hZGQobGlmZXRpbWVNYXJrZXIpO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRpc0Rpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdHNlc3Npb25WaWV3TGlmZXRpbWU6IGxpZmV0aW1lLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogcHJpb3JMZWFzZSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IGxlZnRvdmVyLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+ICFwYWlyaW5nUGVuZGluZyAmJiBwaGFzZS5raW5kID09PSAnY29ubmVjdGVkJyxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+ICFwYWlyaW5nUGVuZGluZyAmJiBwaGFzZS5raW5kID09PSAnY29ubmVjdGVkJyxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0YWNxdWlyZSsrO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRzZXNzaW9uSWQ6ICdzZXNzLWxlZnRvdmVyJyxcblx0XHRcdFx0XHRcdHNuYXBzaG90OiB7IHNlc3Npb25JZDogJ3Nlc3MtbGVmdG92ZXInIH0sXG5cdFx0XHRcdFx0XHRkaXNwb3NlKCkgeyB9LFxuXHRcdFx0XHRcdFx0b25EaWRBcHBseUZyYW1lOiAoKSA9PiAoeyBkaXNwb3NlKCkgeyB9IH0pLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gcGhhc2UsXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmcgfSksXG5cdFx0XHR9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7XG5cdFx0XHRcdGFwcGx5RW50cmllczogKGVudHJpZXM6IHJlYWRvbmx5IHVua25vd25bXSkgPT4ge1xuXHRcdFx0XHRcdGFwcGx5RW50cmllcysrO1xuXHRcdFx0XHRcdGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0YXBwbGllZEVtcHR5Kys7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGFwcGx5U2Vzc2lvblZpZXdUaW1lbGluZTogKGFwcGxpZWQ6IHsga2luZDogc3RyaW5nIH0pID0+IHtcblx0XHRcdFx0aWYgKGFwcGxpZWQua2luZCA9PT0gJ2Jhc2VsaW5lJykge1xuXHRcdFx0XHRcdGFwcGx5QmFzZWxpbmUrKztcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRwYWlyaW5nUGVuZGluZyA9IHRydWU7XG5cdFx0cGhhc2UgPSB7IGtpbmQ6ICdjb25uZWN0aW5nJywgcmVhc29uOiAnaW5pdGlhbCcgfTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UoKSwgeyBraW5kOiAnY29ubmVjdGluZycsIHJlYXNvbjogJ2luaXRpYWwnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaG9zdC51YUNvbm5lY3Rpb24pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25FbmdpbmVMaXZlKGhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25QaGFzZSgpLCBob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZyksIGZhbHNlKTtcblxuXHRcdGJpbmRTZXNzaW9uVmlldyhob3N0LCAnc2Vzcy1sZWZ0b3ZlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBsaWVkRW1wdHksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUJhc2VsaW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNxdWlyZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgcHJpb3JMZWFzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcy5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMsIGxlZnRvdmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlmZXRpbWVNYXJrZXIuZGlzcG9zZWQsIGZhbHNlKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JpbmRTZXNzaW9uVmlldyBjcm9zcy1zZXNzaW9uIHBlbmRpbmcgbGVhc2UgYmxhbmtzIHRoZSBwcmV2aW91cyB0aW1lbGluZSBhbmQgdHJhamVjdG9yeScsICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsZWZ0b3ZlcjogQ29udmVyc2F0aW9uVGltZWxpbmVFbnRyeVtdID0gW1xuXHRcdFx0eyBpZDogJ3QxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdFx0eyBpZDogJ3QyJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdF07XG5cdFx0bGV0IGNsZWFyZWQgPSAwO1xuXHRcdGxldCB0cmFqZWN0b3J5Q2xlYXJlZCA9IDA7XG5cdFx0Y29uc3QgYXBwbGllZDogeyBraW5kOiBzdHJpbmc7IGNvdW50OiBudW1iZXIgfVtdID0gW107XG5cdFx0Y29uc3QgdHJhamVjdG9yeVJlY29yZHM6IHVua25vd25bXVtdID0gW107XG5cdFx0bGV0IGJhc2VsaW5lcyA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7IHNlc3Npb25JZDogJ3Nlc3MtQScgfSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IGxlZnRvdmVyLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRhY3F1aXJlU2Vzc2lvblZpZXc6ICgpID0+ICh7XG5cdFx0XHRcdFx0c2Vzc2lvbklkOiAnc2Vzcy1CJyxcblx0XHRcdFx0XHRzbmFwc2hvdDogeyBzZXNzaW9uSWQ6ICdwZW5kaW5nJyB9LFxuXHRcdFx0XHRcdGRpc3Bvc2UoKSB7IH0sXG5cdFx0XHRcdFx0b25EaWRBcHBseUZyYW1lOiAoKSA9PiAoeyBkaXNwb3NlKCkgeyB9IH0pLFxuXHRcdFx0XHR9KSxcblx0XHRcdH0sXG5cdFx0XHR0aW1lbGluZVRyZWU6IHtcblx0XHRcdFx0YXBwbHlFbnRyaWVzOiAoZW50cmllczogcmVhZG9ubHkgdW5rbm93bltdLCBhcHBsaWVkRnJhbWU6IHsga2luZDogc3RyaW5nIH0pID0+IHtcblx0XHRcdFx0XHRhcHBsaWVkLnB1c2goeyBraW5kOiBhcHBsaWVkRnJhbWUua2luZCwgY291bnQ6IGVudHJpZXMubGVuZ3RoIH0pO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjbGVhclByb2Nlc3NGb2xkRXhwYW5kZWQ6ICgpID0+IHsgY2xlYXJlZCsrOyB9LFxuXHRcdFx0fSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7XG5cdFx0XHRcdGNsZWFyU2Vzc2lvblN0YXRlOiAoKSA9PiB7IHRyYWplY3RvcnlDbGVhcmVkKys7IH0sXG5cdFx0XHRcdHNldFJlY29yZHM6IChyZWNvcmRzOiByZWFkb25seSB1bmtub3duW10pID0+IHsgdHJhamVjdG9yeVJlY29yZHMucHVzaChbLi4ucmVjb3Jkc10pOyB9LFxuXHRcdFx0fSxcblx0XHRcdGFwcGx5U2Vzc2lvblZpZXdUaW1lbGluZTogKCkgPT4geyBiYXNlbGluZXMrKzsgfSxcblx0XHR9O1xuXHRcdGNvbnN0IGJvdW5kID0gaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXHRcdGJpbmRTZXNzaW9uVmlldyhib3VuZCwgJ3Nlc3MtQicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbGVhcmVkLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeUNsZWFyZWQsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXBwbGllZCwgW3sga2luZDogJ2Jhc2VsaW5lJywgY291bnQ6IDAgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodHJhamVjdG9yeVJlY29yZHMsIFtbXV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYXNlbGluZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlPy5zZXNzaW9uSWQsICdzZXNzLUInKTtcblxuXHRcdGNsZWFyZWQgPSAwO1xuXHRcdHRyYWplY3RvcnlDbGVhcmVkID0gMDtcblx0XHRhcHBsaWVkLmxlbmd0aCA9IDA7XG5cdFx0dHJhamVjdG9yeVJlY29yZHMubGVuZ3RoID0gMDtcblx0XHRob3N0LnNlc3Npb25WaWV3TGVhc2UgPSB7IHNlc3Npb25JZDogJ3Nlc3MtQicgfTtcblx0XHRob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMgPSBsZWZ0b3Zlcjtcblx0XHRiaW5kU2Vzc2lvblZpZXcoYm91bmQsICdzZXNzLUInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2xlYXJlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWplY3RvcnlDbGVhcmVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGxpZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRyYWplY3RvcnlSZWNvcmRzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhc2VsaW5lcywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcywgbGVmdG92ZXIpO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IGNyb3NzLXNlc3Npb24gcm9zdGVyIGFuZCBwYWlyaW5nIGNsZWFycyBmb2xkIGV4cGFuZCBhbmQgdHJhamVjdG9yeSByb3dzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpZmV0aW1lID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxlZnRvdmVyOiBDb252ZXJzYXRpb25UaW1lbGluZUVudHJ5W10gPSBbXG5cdFx0XHR7IGlkOiAndDEnLCBraW5kOiAndXNlcicsIHRleHQ6ICcnIH0sXG5cdFx0XHR7IGlkOiAndDInLCBraW5kOiAndXNlcicsIHRleHQ6ICcnIH0sXG5cdFx0XTtcblx0XHRsZXQgY2xlYXJlZCA9IDA7XG5cdFx0bGV0IHRyYWplY3RvcnlDbGVhcmVkID0gMDtcblx0XHRjb25zdCB0cmFqZWN0b3J5UmVjb3JkczogdW5rbm93bltdW10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0aXNEaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVmlld0xpZmV0aW1lOiBsaWZldGltZSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHsgc2Vzc2lvbklkOiAnc2Vzcy1BJyB9LFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogbGVmdG92ZXIsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRhcHBseUVudHJpZXM6ICgpID0+IHsgfSxcblx0XHRcdFx0Y2xlYXJQcm9jZXNzRm9sZEV4cGFuZGVkOiAoKSA9PiB7IGNsZWFyZWQrKzsgfSxcblx0XHRcdH0sXG5cdFx0XHR0cmFqZWN0b3J5Vmlldzoge1xuXHRcdFx0XHRjbGVhclNlc3Npb25TdGF0ZTogKCkgPT4geyB0cmFqZWN0b3J5Q2xlYXJlZCsrOyB9LFxuXHRcdFx0XHRzZXRSZWNvcmRzOiAocmVjb3JkczogcmVhZG9ubHkgdW5rbm93bltdKSA9PiB7IHRyYWplY3RvcnlSZWNvcmRzLnB1c2goWy4uLnJlY29yZHNdKTsgfSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHVuZGVmaW5lZCBhcyB1bmRlZmluZWQgfCB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZSgpOiB7IGtpbmQ6IHN0cmluZzsgcGF0aDogc3RyaW5nIH07XG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdCgpOiB7IHBhaXJpbmdQZW5kaW5nOiBib29sZWFuIH07XG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0Y29uc3QgYm91bmQgPSBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cdFx0YmluZFNlc3Npb25WaWV3KGJvdW5kLCAnc2Vzcy1CJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNsZWFyZWQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFqZWN0b3J5Q2xlYXJlZCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0cmFqZWN0b3J5UmVjb3JkcywgW1tdXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvdW5kLmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAwKTtcblxuXHRcdGNsZWFyZWQgPSAwO1xuXHRcdHRyYWplY3RvcnlDbGVhcmVkID0gMDtcblx0XHR0cmFqZWN0b3J5UmVjb3Jkcy5sZW5ndGggPSAwO1xuXHRcdGhvc3Quc2Vzc2lvblZpZXdMZWFzZSA9IHsgc2Vzc2lvbklkOiAnc2Vzcy1CJyB9O1xuXHRcdGhvc3QubGFzdEF0dGFjaGVkRW50cmllcyA9IGxlZnRvdmVyO1xuXHRcdGJpbmRTZXNzaW9uVmlldyhib3VuZCwgJ3Nlc3MtQicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbGVhcmVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeUNsZWFyZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodHJhamVjdG9yeVJlY29yZHMsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYm91bmQubGFzdEF0dGFjaGVkRW50cmllcywgbGVmdG92ZXIpO1xuXG5cdFx0aG9zdC5zdHViU2VydmljZSA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHR9O1xuXHRcdGhvc3QudWFDb25uZWN0aW9uID0ge1xuXHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSksXG5cdFx0fTtcblx0XHRob3N0LnNlc3Npb25WaWV3TGVhc2UgPSB7IHNlc3Npb25JZDogJ3Nlc3MtQicgfTtcblx0XHRiaW5kU2Vzc2lvblZpZXcoYm91bmQsICdzZXNzLUMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2xlYXJlZCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWplY3RvcnlDbGVhcmVkLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRyYWplY3RvcnlSZWNvcmRzLCBbW11dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYm91bmQubGFzdEF0dGFjaGVkRW50cmllcy5sZW5ndGgsIDApO1xuXHRcdGxpZmV0aW1lLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYmluZFNlc3Npb25WaWV3IHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBkb2VzIG5vdCBrZWVwIG90aGVyIHNlc3Npb24gbGVmdG92ZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGlmZXRpbWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbGVmdG92ZXJBID0gW3sgaWQ6ICd0MScgfSwgeyBpZDogJ3QyJyB9XTtcblx0XHRsZXQgYXBwbHlFbnRyaWVzID0gMDtcblx0XHRsZXQgYXBwbGllZEVtcHR5ID0gMDtcblx0XHRsZXQgYWNxdWlyZSA9IDA7XG5cdFx0Y29uc3QgbGlmZXRpbWVNYXJrZXIgPSB7XG5cdFx0XHRkaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRkaXNwb3NlKCkgeyB0aGlzLmRpc3Bvc2VkID0gdHJ1ZTsgfSxcblx0XHR9O1xuXHRcdGxpZmV0aW1lLmFkZChsaWZldGltZU1hcmtlcik7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7IHNlc3Npb25JZDogJ3Nlc3MtQScgfSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IGxlZnRvdmVyQSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRhY3F1aXJlU2Vzc2lvblZpZXc6ICgpID0+IHtcblx0XHRcdFx0XHRhY3F1aXJlKys7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHNlc3Npb25JZDogJ3Nlc3MtQicsXG5cdFx0XHRcdFx0XHRzbmFwc2hvdDogeyBzZXNzaW9uSWQ6ICdzZXNzLUInIH0sXG5cdFx0XHRcdFx0XHRkaXNwb3NlKCkgeyB9LFxuXHRcdFx0XHRcdFx0b25EaWRBcHBseUZyYW1lOiAoKSA9PiAoeyBkaXNwb3NlKCkgeyB9IH0pLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSksXG5cdFx0XHR9LFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7XG5cdFx0XHRcdGFwcGx5RW50cmllczogKGVudHJpZXM6IHJlYWRvbmx5IHVua25vd25bXSkgPT4ge1xuXHRcdFx0XHRcdGFwcGx5RW50cmllcysrO1xuXHRcdFx0XHRcdGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0YXBwbGllZEVtcHR5Kys7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGFwcGx5U2Vzc2lvblZpZXdUaW1lbGluZTogKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJ3Nlc3MtQicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBsaWVkRW1wdHksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3F1aXJlLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlmZXRpbWVNYXJrZXIuZGlzcG9zZWQsIHRydWUpO1xuXG5cdFx0Y29uc3Qgc2FtZVNlc3Npb25MZWZ0b3ZlcjogQ29udmVyc2F0aW9uVGltZWxpbmVFbnRyeVtdID0gW1xuXHRcdFx0eyBpZDogJ3QxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdFx0eyBpZDogJ3QyJywga2luZDogJ3VzZXInLCB0ZXh0OiAnJyB9LFxuXHRcdF07XG5cdFx0Y29uc3Qgc2FtZVNlc3Npb25MZWFzZTogSUNvbnZlcnNhdGlvblNlc3Npb25WaWV3TGVhc2UgPSB7XG5cdFx0XHRzZXNzaW9uSWQ6ICdzZXNzLUEnLFxuXHRcdFx0c25hcHNob3Q6IGxlZnRvdmVyTGVhc2VTbmFwc2hvdCh7IGtpbmQ6ICdpZGxlJyB9KS5zbmFwc2hvdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25TZXNzaW9uVmlld0xlYXNlWydzbmFwc2hvdCddLFxuXHRcdFx0YXR0cmlidXRpb246IG5ldyBNYXAoKSxcblx0XHRcdGRldGFpbHM6IG5ldyBNYXAoKSxcblx0XHRcdG9uRGlkQXBwbHlGcmFtZTogRXZlbnQuTm9uZSxcblx0XHRcdHBvc3Q6IGFzeW5jICgpID0+ICh7IGFjY2VwdGVkOiBmYWxzZSwgcmVhc29uOiAnbm9fc3VjaF9zZXNzaW9uJyB9KSxcblx0XHRcdHJlcXVlc3RSZXN5bmMoKSB7IH0sXG5cdFx0XHRkaXNwb3NlKCkgeyB9LFxuXHRcdH07XG5cdFx0Y29uc3Qga2VlcE1hcmtlciA9IHtcblx0XHRcdGRpc3Bvc2VkOiBmYWxzZSxcblx0XHRcdGRpc3Bvc2UoKSB7IHRoaXMuZGlzcG9zZWQgPSB0cnVlOyB9LFxuXHRcdH07XG5cdFx0YXBwbHlFbnRyaWVzID0gMDtcblx0XHRhcHBsaWVkRW1wdHkgPSAwO1xuXHRcdGFjcXVpcmUgPSAwO1xuXHRcdGhvc3Quc2Vzc2lvblZpZXdMZWFzZSA9IHNhbWVTZXNzaW9uTGVhc2U7XG5cdFx0aG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzID0gc2FtZVNlc3Npb25MZWZ0b3Zlcjtcblx0XHRsaWZldGltZS5hZGQoa2VlcE1hcmtlcik7XG5cdFx0YmluZFNlc3Npb25WaWV3KGhvc3QsICdzZXNzLUEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXBwbHlFbnRyaWVzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNxdWlyZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgc2FtZVNlc3Npb25MZWFzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QubGFzdEF0dGFjaGVkRW50cmllcywgc2FtZVNlc3Npb25MZWZ0b3Zlcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGtlZXBNYXJrZXIuZGlzcG9zZWQsIGZhbHNlKTtcblx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFwcGx5QWN0aXZlTGVmdG92ZXJIb3N0KG9wdGlvbnM6IHtcblx0XHRyZWFkb25seSB0YXJnZXRTZXNzaW9uSWQ6IHN0cmluZztcblx0XHRyZWFkb25seSBsZWFzZVNlc3Npb25JZDogc3RyaW5nO1xuXHRcdHJlYWRvbmx5IGxlZnRvdmVyOiBDb252ZXJzYXRpb25UaW1lbGluZUVudHJ5W107XG5cdFx0cmVhZG9ubHkgbW9kZTogJ3BhaXJpbmctaG9sZCcgfCAncm9zdGVyLWluLWZsaWdodCc7XG5cdH0pOiB7XG5cdFx0aG9zdDogSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cdFx0bGlmZXRpbWU6IERpc3Bvc2FibGVTdG9yZTtcblx0XHRyZWFkb25seSBhY3F1aXJlOiBudW1iZXI7XG5cdFx0cmVhZG9ubHkgYXBwbHlFbnRyaWVzOiBudW1iZXI7XG5cdFx0cmVhZG9ubHkgYXBwbGllZEVtcHR5OiBudW1iZXI7XG5cdFx0cmVhZG9ubHkgcGhhc2VDYWxsczogc3RyaW5nW107XG5cdFx0cmVhZG9ubHkgc3luY0NhbGxzOiBzdHJpbmdbXTtcblx0XHRyZWFkb25seSBsaWZldGltZURpc3Bvc2VkOiBib29sZWFuO1xuXHR9IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsZWZ0b3ZlciA9IG9wdGlvbnMubGVmdG92ZXI7XG5cdFx0Y29uc3QgcHJpb3JMZWFzZSA9IHsgc2Vzc2lvbklkOiBvcHRpb25zLmxlYXNlU2Vzc2lvbklkIH07XG5cdFx0Y29uc3Qgc3RhdGUgPSB7XG5cdFx0XHRhY3F1aXJlOiAwLFxuXHRcdFx0YXBwbHlFbnRyaWVzOiAwLFxuXHRcdFx0YXBwbGllZEVtcHR5OiAwLFxuXHRcdFx0cGhhc2VDYWxsczogW10gYXMgc3RyaW5nW10sXG5cdFx0XHRzeW5jQ2FsbHM6IFtdIGFzIHN0cmluZ1tdLFxuXHRcdH07XG5cdFx0Y29uc3QgbGlmZXRpbWVNYXJrZXIgPSB7XG5cdFx0XHRkaXNwb3NlZDogZmFsc2UsXG5cdFx0XHRkaXNwb3NlKCkgeyB0aGlzLmRpc3Bvc2VkID0gdHJ1ZTsgfSxcblx0XHR9O1xuXHRcdGxpZmV0aW1lLmFkZChsaWZldGltZU1hcmtlcik7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGlzRGlzcG9zZWQ6IGZhbHNlLFxuXHRcdFx0c2Vzc2lvblZpZXdMaWZldGltZTogbGlmZXRpbWUsXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiBwcmlvckxlYXNlLFxuXHRcdFx0bGFzdEF0dGFjaGVkRW50cmllczogbGVmdG92ZXIsXG5cdFx0XHR2aXN1YWxpemVPdmVybGF5OiB7IGNsb3NlKCkgeyB9IH0sXG5cdFx0XHRlbmdpbmVIaXN0b3J5TGlzdDogdW5kZWZpbmVkLFxuXHRcdFx0ZW5naW5lU25hcHNob3RzTGlzdDogdW5kZWZpbmVkLFxuXHRcdFx0aW5ib3hPdmVybGF5OiB7IGNsb3NlTGlzdFBhbmVsKCkgeyB9LCByZW5kZXIoKSB7IH0gfSxcblx0XHRcdHRyYWplY3RvcnlWaWV3OiB7IGNsZWFyU2Vzc2lvblN0YXRlKCkgeyB9IH0sXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICcnIH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0KCkgeyB9LFxuXHRcdFx0cmVzZXRJbnB1dEhpc3RvcnlCcm93c2UoKSB7IH0sXG5cdFx0XHRyZWZyZXNoU2Vzc2lvblNlbGVjdE9wdGlvbnMoKSB7IH0sXG5cdFx0XHRzeW5jU2Vzc2lvbkNvbmZpZ1NlbGVjdHMoKSB7IH0sXG5cdFx0XHR1cGRhdGVTZXNzaW9uVGl0bGUoKSB7IH0sXG5cdFx0XHRyZWFkQ29tcG9zZXJEcmFmdDogKCkgPT4gJycsXG5cdFx0XHRyZW5kZXJJbmJveFN0YXR1cygpIHsgfSxcblx0XHRcdHVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlKCkgeyBzdGF0ZS5waGFzZUNhbGxzLnB1c2gob3B0aW9ucy50YXJnZXRTZXNzaW9uSWQpOyB9LFxuXHRcdFx0dXBkYXRlU3luY0Nocm9tZSgpIHsgc3RhdGUuc3luY0NhbGxzLnB1c2gob3B0aW9ucy50YXJnZXRTZXNzaW9uSWQpOyB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+IG9wdGlvbnMudGFyZ2V0U2Vzc2lvbklkLFxuXHRcdFx0YmluZFNlc3Npb25WaWV3OiAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0YmluZFNlc3Npb25WaWV3KGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdCwgc2Vzc2lvbklkKTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gb3B0aW9ucy5tb2RlID09PSAncm9zdGVyLWluLWZsaWdodCcsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0YWNxdWlyZVNlc3Npb25WaWV3OiAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUuYWNxdWlyZSsrO1xuXHRcdFx0XHRcdHJldHVybiB7IHNlc3Npb25JZDogb3B0aW9ucy50YXJnZXRTZXNzaW9uSWQsIHNuYXBzaG90OiB7IHNlc3Npb25JZDogb3B0aW9ucy50YXJnZXRTZXNzaW9uSWQgfSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBvcHRpb25zLm1vZGUgPT09ICdwYWlyaW5nLWhvbGQnIH0pLFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRhcHBseUVudHJpZXM6IChlbnRyaWVzOiByZWFkb25seSB1bmtub3duW10pID0+IHtcblx0XHRcdFx0XHRzdGF0ZS5hcHBseUVudHJpZXMrKztcblx0XHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdHN0YXRlLmFwcGxpZWRFbXB0eSsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRhcHBseVNlc3Npb25WaWV3VGltZWxpbmUoKSB7IH0sXG5cdFx0fTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aG9zdDogaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0LFxuXHRcdFx0bGlmZXRpbWUsXG5cdFx0XHRnZXQgYWNxdWlyZSgpIHsgcmV0dXJuIHN0YXRlLmFjcXVpcmU7IH0sXG5cdFx0XHRnZXQgYXBwbHlFbnRyaWVzKCkgeyByZXR1cm4gc3RhdGUuYXBwbHlFbnRyaWVzOyB9LFxuXHRcdFx0Z2V0IGFwcGxpZWRFbXB0eSgpIHsgcmV0dXJuIHN0YXRlLmFwcGxpZWRFbXB0eTsgfSxcblx0XHRcdGdldCBwaGFzZUNhbGxzKCkgeyByZXR1cm4gc3RhdGUucGhhc2VDYWxsczsgfSxcblx0XHRcdGdldCBzeW5jQ2FsbHMoKSB7IHJldHVybiBzdGF0ZS5zeW5jQ2FsbHM7IH0sXG5cdFx0XHRnZXQgbGlmZXRpbWVEaXNwb3NlZCgpIHsgcmV0dXJuIGxpZmV0aW1lTWFya2VyLmRpc3Bvc2VkOyB9LFxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdhcHBseUFjdGl2ZVNlc3Npb24gZmlyc3QtcHVsbCB0byBvdGhlciBzZXNzaW9uIHJlZnJlc2hlcyBwaGFzZSBhbmQgc3luYyBjaHJvbWUgd2l0aG91dCBhY3F1aXJlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxlZnRvdmVyOiBDb252ZXJzYXRpb25UaW1lbGluZUVudHJ5W10gPSBbXG5cdFx0XHR7IGlkOiAndDEnLCBraW5kOiAndXNlcicsIHRleHQ6ICcnIH0sXG5cdFx0XHR7IGlkOiAndDInLCBraW5kOiAndXNlcicsIHRleHQ6ICcnIH0sXG5cdFx0XTtcblx0XHRmb3IgKGNvbnN0IG1vZGUgb2YgWydwYWlyaW5nLWhvbGQnLCAncm9zdGVyLWluLWZsaWdodCddIGFzIGNvbnN0KSB7XG5cdFx0XHRjb25zdCBmaXh0dXJlID0gYXBwbHlBY3RpdmVMZWZ0b3Zlckhvc3Qoe1xuXHRcdFx0XHR0YXJnZXRTZXNzaW9uSWQ6ICdzZXNzLUInLFxuXHRcdFx0XHRsZWFzZVNlc3Npb25JZDogJ3Nlc3MtQScsXG5cdFx0XHRcdGxlZnRvdmVyLFxuXHRcdFx0XHRtb2RlLFxuXHRcdFx0fSk7XG5cdFx0XHRhcHBseUFjdGl2ZVNlc3Npb24oZml4dHVyZS5ob3N0LCAnc2Vzcy1CJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5hcHBseUVudHJpZXMsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuYXBwbGllZEVtcHR5LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmFjcXVpcmUsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5sYXN0QXR0YWNoZWRFbnRyaWVzLmxlbmd0aCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5saWZldGltZURpc3Bvc2VkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5waGFzZUNhbGxzLCBbJ3Nlc3MtQiddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5zeW5jQ2FsbHMsIFsnc2Vzcy1CJ10pO1xuXHRcdFx0Zml4dHVyZS5saWZldGltZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdhcHBseUFjdGl2ZVNlc3Npb24gc2FtZS1zZXNzaW9uIEtFRVAgbGVmdG92ZXIgZG9lcyBub3QgY2xlYXIgbGVmdG92ZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGVmdG92ZXI6IENvbnZlcnNhdGlvblRpbWVsaW5lRW50cnlbXSA9IFtcblx0XHRcdHsgaWQ6ICd0MScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJycgfSxcblx0XHRcdHsgaWQ6ICd0MicsIGtpbmQ6ICd1c2VyJywgdGV4dDogJycgfSxcblx0XHRdO1xuXHRcdGZvciAoY29uc3QgbW9kZSBvZiBbJ3BhaXJpbmctaG9sZCcsICdyb3N0ZXItaW4tZmxpZ2h0J10gYXMgY29uc3QpIHtcblx0XHRcdGNvbnN0IGZpeHR1cmUgPSBhcHBseUFjdGl2ZUxlZnRvdmVySG9zdCh7XG5cdFx0XHRcdHRhcmdldFNlc3Npb25JZDogJ3Nlc3MtQScsXG5cdFx0XHRcdGxlYXNlU2Vzc2lvbklkOiAnc2Vzcy1BJyxcblx0XHRcdFx0bGVmdG92ZXIsXG5cdFx0XHRcdG1vZGUsXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IHByaW9yTGVhc2UgPSBmaXh0dXJlLmhvc3Quc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRcdGFwcGx5QWN0aXZlU2Vzc2lvbihmaXh0dXJlLmhvc3QsICdzZXNzLUEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmFwcGx5RW50cmllcywgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5hY3F1aXJlLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgcHJpb3JMZWFzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lmxhc3RBdHRhY2hlZEVudHJpZXMsIGxlZnRvdmVyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmxpZmV0aW1lRGlzcG9zZWQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5waGFzZUNhbGxzLCBbJ3Nlc3MtQSddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5zeW5jQ2FsbHMsIFsnc2Vzcy1BJ10pO1xuXHRcdFx0Zml4dHVyZS5saWZldGltZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdiaW5kU2Vzc2lvblZpZXcgYWNxdWlyZVNlc3Npb25WaWV3IHRocm93IHNob3dzIGZhaWxlZCBhbmQgZG9lcyBub3QgbGVhdmUgYW4gdW5oYW5kbGVkIHJlamVjdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsaWZldGltZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgcmVqZWN0aW9uczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWQgPSAocmVhc29uOiB1bmtub3duKSA9PiB7IHJlamVjdGlvbnMucHVzaChyZWFzb24pOyB9O1xuXHRcdGxldCBhcHBseUVudHJpZXMgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRfc3RvcmU6IHsgaXNEaXNwb3NlZDogZmFsc2UgfSxcblx0XHRcdHNlc3Npb25WaWV3TGlmZXRpbWU6IGxpZmV0aW1lLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZTogeyBzZXNzaW9uSWQ6ICdwcmlvcicgfSxcblx0XHRcdGxhc3RBdHRhY2hlZEVudHJpZXM6IFtdLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRhY3F1aXJlU2Vzc2lvblZpZXc6ICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2FjcXVpcmUgYm9vbScpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHRpbWVsaW5lVHJlZTogeyBhcHBseUVudHJpZXM6ICgpID0+IHsgYXBwbHlFbnRyaWVzKys7IH0gfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0YXBwbHlTZXNzaW9uVmlld1RpbWVsaW5lOiAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdHRyeSB7XG5cdFx0XHRiaW5kU2Vzc2lvblZpZXcoaG9zdCwgJ3Nlc3MtbGVmdG92ZXInKTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldEltbWVkaWF0ZSgoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZmFpbGVkJ10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3Quc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcHBseUVudHJpZXMsIDApO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWplY3Rpb25zLCBbXSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHByb2Nlc3Mub2ZmKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZCk7XG5cdFx0XHRsaWZldGltZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdyZXRyeUVycm9yIHBvc3RzIGNvbnRpbnVlR2VuZXJhdGlvbiBvbiB0aGUgYm91bmQgbGVhc2UgYW5kIGRvZXMgbm90IGNhbGwgcm9zdGVyLnJldHJ5RXJyb3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcG9zdGVkOiBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2VbXSA9IFtdO1xuXHRcdGxldCByb3N0ZXJSZXRyeSA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKG1zZzogQ29udmVyc2F0aW9uV3JpdGVNZXNzYWdlKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRwb3N0ZWQucHVzaChtc2cpO1xuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHRlZDogdHJ1ZSwgY29ycmVsYXRpb246IHsgaWQ6ICd4JyB9IH07XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRyZXRyeUVycm9yOiAoKSA9PiB7XG5cdFx0XHRcdFx0cm9zdGVyUmV0cnkrKztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6ICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRyZXRyeUVycm9yKGhvc3QsIHsgaWQ6ICcgIG1zZy0xICAnLCB0dXJuSWQ6ICcgIHR1cm4tMSAgJywgYWdlbnRJZDogJyAgc3ViOmEgICcgfSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocG9zdGVkLCBbe1xuXHRcdFx0a2luZDogJ2NvbnRpbnVlR2VuZXJhdGlvbicsXG5cdFx0XHRhZ2VudElkOiAnc3ViOmEnLFxuXHRcdFx0dHVybklkOiAndHVybi0xJyxcblx0XHRcdG1lc3NhZ2VJZDogJ21zZy0xJyxcblx0XHR9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3RlclJldHJ5LCAwKTtcblx0fSk7XG5cblx0dGVzdCgncmV0cnlFcnJvciBvbWl0dGVkIHR1cm5JZCBhbmQgYWdlbnRJZCBmYWxsIGJhY2sgdG8gbWVzc2FnZUlkIGFuZCByb290JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBvc3RlZDogQ29udmVyc2F0aW9uV3JpdGVNZXNzYWdlW10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAobXNnOiBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2UpOiBQcm9taXNlPFBvc3RPdXRjb21lPiA9PiB7XG5cdFx0XHRcdHBvc3RlZC5wdXNoKG1zZyk7XG5cdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlLCBjb3JyZWxhdGlvbjogeyBpZDogJ3gnIH0gfTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJldHJ5RXJyb3I6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cmV0cnlFcnJvcihob3N0LCB7IGlkOiAnbXNnLW9ubHknIH0pO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBvc3RlZCwgW3tcblx0XHRcdGtpbmQ6ICdjb250aW51ZUdlbmVyYXRpb24nLFxuXHRcdFx0YWdlbnRJZDogJ3Jvb3QnLFxuXHRcdFx0dHVybklkOiAnbXNnLW9ubHknLFxuXHRcdFx0bWVzc2FnZUlkOiAnbXNnLW9ubHknLFxuXHRcdH1dKTtcblx0fSk7XG5cblx0dGVzdCgncmV0cnlFcnJvciBibGFuayBtZXNzYWdlSWQgcG9zdHMgbm90aGluZycsIGFzeW5jICgpID0+IHtcblx0XHRsZXQgcG9zdEJvdW5kID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRwb3N0Qm91bmQrKztcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0cmV0cnlFcnJvcjogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6ICgpID0+IHsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRyZXRyeUVycm9yKGhvc3QsIHsgaWQ6ICcgICAnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwb3N0Qm91bmQsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXRyeUVycm9yIHBvc3RCb3VuZCByZWplY3Qgc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWF2ZSBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCByZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZCA9IChyZWFzb246IHVua25vd24pID0+IHsgcmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7IH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKCk6IFByb21pc2U8UG9zdE91dGNvbWU+ID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdwb3N0Qm91bmQgYm9vbScpO1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0cmV0cnlFcnJvcjogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRwcm9jZXNzLm9uKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZCk7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHJ5RXJyb3IoaG9zdCwgeyBpZDogJ21zZy0xJyB9KTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldEltbWVkaWF0ZSgoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZmFpbGVkJ10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWplY3Rpb25zLCBbXSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHByb2Nlc3Mub2ZmKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdyZXRyeUVycm9yIHBvc3RCb3VuZCByZWplY3Qgc3RpbGwgc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWFrIHdoZW4gc2hvd1Bvc3RGYWlsdXJlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3Bvc3RCb3VuZCBib29tJyk7XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRyZXRyeUVycm9yOiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiByZXRyeUVycm9yKGhvc3QsIHsgaWQ6ICdtc2ctMScgfSkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZmFpbGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlQ29uZmlybWF0aW9uIHBvc3RCb3VuZCByZWplY3Qgc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWF2ZSBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCByZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZCA9IChyZWFzb246IHVua25vd24pID0+IHsgcmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7IH07XG5cdFx0bGV0IGZvY3VzZWQgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRwb3N0Qm91bmQ6IGFzeW5jICgpOiBQcm9taXNlPFBvc3RPdXRjb21lPiA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigncG9zdEJvdW5kIGJvb20nKTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZTogeyBpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0Zm9jdXNUaW1lbGluZVJlY29yZDogKCkgPT4geyBmb2N1c2VkKys7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdHRyeSB7XG5cdFx0XHR2b2lkIHJlc29sdmVDb25maXJtYXRpb24oaG9zdCwgJ3R1cm4tMScsICdhbGxvd2VkJyk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVqZWN0aW9ucywgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvY3VzZWQsIDApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZVF1ZXN0aW9uIHBvc3RCb3VuZCByZWplY3Qgc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWF2ZSBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCByZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZCA9IChyZWFzb246IHVua25vd24pID0+IHsgcmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7IH07XG5cdFx0bGV0IGZvY3VzZWQgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRwb3N0Qm91bmQ6IGFzeW5jICgpOiBQcm9taXNlPFBvc3RPdXRjb21lPiA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigncG9zdEJvdW5kIGJvb20nKTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZTogeyBpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0Zm9jdXNUaW1lbGluZVJlY29yZDogKCkgPT4geyBmb2N1c2VkKys7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdHRyeSB7XG5cdFx0XHR2b2lkIHJlc29sdmVRdWVzdGlvbihob3N0LCAndHVybi0xJywgJ3JlcS0xJywgeyBxMTogeyBzZWxlY3RlZExhYmVsczogWydhJ10gfSB9KTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldEltbWVkaWF0ZSgoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZmFpbGVkJ10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWplY3Rpb25zLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9jdXNlZCwgMCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHByb2Nlc3Mub2ZmKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlQ29uZmlybWF0aW9uIGNvbm5lY3RlZCByb3N0ZXIgZmFsc2Ugc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWF2ZSBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCByZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZCA9IChyZWFzb246IHVua25vd24pID0+IHsgcmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7IH07XG5cdFx0bGV0IGZvY3VzZWQgPSAwO1xuXHRcdGxldCBmb3J3YXJkZWQgPSAwO1xuXHRcdGxldCBwb3N0Qm91bmQgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRwb3N0Qm91bmQ6IGFzeW5jICgpOiBQcm9taXNlPFBvc3RPdXRjb21lPiA9PiB7XG5cdFx0XHRcdHBvc3RCb3VuZCsrO1xuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHRlZDogdHJ1ZSwgY29ycmVsYXRpb246IHsgaWQ6ICd4JyB9IH07XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0cmVzb2x2ZUNvbmZpcm1hdGlvbjogKCkgPT4ge1xuXHRcdFx0XHRcdGZvcndhcmRlZCsrO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzVGltZWxpbmVSZWNvcmQ6ICgpID0+IHsgZm9jdXNlZCsrOyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR0cnkge1xuXHRcdFx0dm9pZCByZXNvbHZlQ29uZmlybWF0aW9uKGhvc3QsICd0dXJuLTEnLCAnYWxsb3dlZCcpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0SW1tZWRpYXRlKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvcndhcmRlZCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdEJvdW5kLCAwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZmFpbGVkJ10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWplY3Rpb25zLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9jdXNlZCwgMCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHByb2Nlc3Mub2ZmKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlQ29uZmlybWF0aW9uIGNvbm5lY3RlZCByb3N0ZXIgZmFsc2UgdGhlbiBkaXNjb25uZWN0IHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGxldCBjb25uZWN0ZWQgPSB0cnVlO1xuXHRcdGxldCBmb2N1c2VkID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHRlZDogdHJ1ZSwgY29ycmVsYXRpb246IHsgaWQ6ICd4JyB9IH07XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGNvbm5lY3RlZCxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJlc29sdmVDb25maXJtYXRpb246ICgpID0+IHtcblx0XHRcdFx0XHRjb25uZWN0ZWQgPSBmYWxzZTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0XHRmb2N1c1RpbWVsaW5lUmVjb3JkOiAoKSA9PiB7IGZvY3VzZWQrKzsgfSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRhd2FpdCByZXNvbHZlQ29uZmlybWF0aW9uKGhvc3QsICd0dXJuLTEnLCAnc2tpcHBlZCcpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2N1c2VkLCAwKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZVF1ZXN0aW9uIGNvbm5lY3RlZCByb3N0ZXIgZmFsc2Ugc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWF2ZSBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCByZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZCA9IChyZWFzb246IHVua25vd24pID0+IHsgcmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7IH07XG5cdFx0bGV0IGZvY3VzZWQgPSAwO1xuXHRcdGxldCBmb3J3YXJkZWQgPSAwO1xuXHRcdGxldCBwb3N0Qm91bmQgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRwb3N0Qm91bmQ6IGFzeW5jICgpOiBQcm9taXNlPFBvc3RPdXRjb21lPiA9PiB7XG5cdFx0XHRcdHBvc3RCb3VuZCsrO1xuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHRlZDogdHJ1ZSwgY29ycmVsYXRpb246IHsgaWQ6ICd4JyB9IH07XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0cmVzcG9uZFF1ZXN0aW9uOiAoKSA9PiB7XG5cdFx0XHRcdFx0Zm9yd2FyZGVkKys7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0Zm9jdXNUaW1lbGluZVJlY29yZDogKCkgPT4geyBmb2N1c2VkKys7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdHRyeSB7XG5cdFx0XHR2b2lkIHJlc29sdmVRdWVzdGlvbihob3N0LCAndHVybi0xJywgJ3JlcS0xJywgeyBxMTogeyBzZWxlY3RlZExhYmVsczogWydhJ10gfSB9KTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldEltbWVkaWF0ZSgoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3J3YXJkZWQsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc3RCb3VuZCwgMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVqZWN0aW9ucywgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvY3VzZWQsIDApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRwcm9jZXNzLm9mZigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZVF1ZXN0aW9uIGNvbm5lY3RlZCByb3N0ZXIgZmFsc2UgdGhlbiBkaXNjb25uZWN0IHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGxldCBjb25uZWN0ZWQgPSB0cnVlO1xuXHRcdGxldCBmb2N1c2VkID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRyZXR1cm4geyBhY2NlcHRlZDogdHJ1ZSwgY29ycmVsYXRpb246IHsgaWQ6ICd4JyB9IH07XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGNvbm5lY3RlZCxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHRcdHJlc3BvbmRRdWVzdGlvbjogKCkgPT4ge1xuXHRcdFx0XHRcdGNvbm5lY3RlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzVGltZWxpbmVSZWNvcmQ6ICgpID0+IHsgZm9jdXNlZCsrOyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdGF3YWl0IHJlc29sdmVRdWVzdGlvbihob3N0LCAndHVybi0xJywgJ3JlcS0xJywgeyBxMTogeyBzZWxlY3RlZExhYmVsczogWydhJ10gfSB9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9jdXNlZCwgMCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHBhaXJpbmdIb2xkTGVmdG92ZXJXcml0ZUhvc3QoZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSk6IHtcblx0XHRob3N0OiBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblx0XHRwb3N0ZWQ6IG51bWJlcjtcblx0fSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB7IHBvc3RlZDogMCB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtbGVmdG92ZXInLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZToge1xuXHRcdFx0XHRwb3N0OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUucG9zdGVkKys7XG5cdFx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHBvc3RCb3VuZDogYXN5bmMgKG1zZzogQ29udmVyc2F0aW9uV3JpdGVNZXNzYWdlKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gcG9zdEJvdW5kKGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCwgbXNnKTtcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSksXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0XHRmb2N1c1RpbWVsaW5lUmVjb3JkOiAoKSA9PiB7IH0sXG5cdFx0fTtcblx0XHRyZXR1cm4geyBob3N0OiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3QsIGdldCBwb3N0ZWQoKSB7IHJldHVybiBzdGF0ZS5wb3N0ZWQ7IH0gfTtcblx0fVxuXG5cdHRlc3QoJ3Bvc3RCb3VuZCBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgbGVhc2UgcmVqZWN0cyB3aXRob3V0IGxlYXNlLnBvc3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCwgcG9zdGVkIH0gPSBwYWlyaW5nSG9sZExlZnRvdmVyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRjb25zdCBvdXRjb21lID0gYXdhaXQgcG9zdEJvdW5kKGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCwge1xuXHRcdFx0a2luZDogJ2NvbnRpbnVlR2VuZXJhdGlvbicsXG5cdFx0XHRhZ2VudElkOiAncm9vdCcsXG5cdFx0XHR0dXJuSWQ6ICd0dXJuLTEnLFxuXHRcdFx0bWVzc2FnZUlkOiAnbXNnLTEnLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRjb21lLmFjY2VwdGVkLCBmYWxzZSk7XG5cdFx0aWYgKCFvdXRjb21lLmFjY2VwdGVkKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0Y29tZS5yZWFzb24sICdub19zdWNoX3Nlc3Npb24nKTtcblx0XHR9XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlQ29uZmlybWF0aW9uIHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBsZWFzZSBkb2VzIG5vdCBwb3N0IGFuZCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QsIHBvc3RlZCB9ID0gcGFpcmluZ0hvbGRMZWZ0b3ZlcldyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0YXdhaXQgcmVzb2x2ZUNvbmZpcm1hdGlvbihob3N0LCAndHVybi0xJywgJ2FsbG93ZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmVRdWVzdGlvbiBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgbGVhc2UgZG9lcyBub3QgcG9zdCBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0LCBwb3N0ZWQgfSA9IHBhaXJpbmdIb2xkTGVmdG92ZXJXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGF3YWl0IHJlc29sdmVRdWVzdGlvbihob3N0LCAndHVybi0xJywgJ3JlcS0xJywgeyBxMTogeyBzZWxlY3RlZExhYmVsczogWydhJ10gfSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdLCBwYWlyaW5nUGVuZGluZzogYm9vbGVhbiwgZW5naW5lU2Vzc2lvblJlYWR5ID0gdHJ1ZSk6IHtcblx0XHRob3N0OiBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblx0XHRyZXNvbHZlQ29uZmlybWF0aW9uQ2FsbHM6IG51bWJlcjtcblx0XHRyZXNwb25kUXVlc3Rpb25DYWxsczogbnVtYmVyO1xuXHRcdGRlbGV0ZVR1cm5DYWxsczogbnVtYmVyO1xuXHRcdGNhbmNlbFRvb2xDYWxsQ2FsbHM6IG51bWJlcjtcblx0XHRwb3N0ZWQ6IG51bWJlcjtcblx0XHRmb2N1c2VkOiBudW1iZXI7XG5cdH0ge1xuXHRcdGNvbnN0IHN0YXRlID0geyByZXNvbHZlQ29uZmlybWF0aW9uQ2FsbHM6IDAsIHJlc3BvbmRRdWVzdGlvbkNhbGxzOiAwLCBkZWxldGVUdXJuQ2FsbHM6IDAsIGNhbmNlbFRvb2xDYWxsQ2FsbHM6IDAsIHBvc3RlZDogMCwgZm9jdXNlZDogMCB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtbGVmdG92ZXInLFxuXHRcdFx0cG9zdEJvdW5kOiBhc3luYyAoKTogUHJvbWlzZTxQb3N0T3V0Y29tZT4gPT4ge1xuXHRcdFx0XHRzdGF0ZS5wb3N0ZWQrKztcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gZW5naW5lU2Vzc2lvblJlYWR5LFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0cmVzb2x2ZUNvbmZpcm1hdGlvbjogKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLnJlc29sdmVDb25maXJtYXRpb25DYWxscysrO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZXNwb25kUXVlc3Rpb246ICgpID0+IHtcblx0XHRcdFx0XHRzdGF0ZS5yZXNwb25kUXVlc3Rpb25DYWxscysrO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRkZWxldGVUdXJuOiAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUuZGVsZXRlVHVybkNhbGxzKys7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNhbmNlbFRvb2xDYWxsOiAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUuY2FuY2VsVG9vbENhbGxDYWxscysrO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0Zm9jdXNUaW1lbGluZVJlY29yZDogKCkgPT4geyBzdGF0ZS5mb2N1c2VkKys7IH0sXG5cdFx0fTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aG9zdDogaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0LFxuXHRcdFx0Z2V0IHJlc29sdmVDb25maXJtYXRpb25DYWxscygpIHsgcmV0dXJuIHN0YXRlLnJlc29sdmVDb25maXJtYXRpb25DYWxsczsgfSxcblx0XHRcdGdldCByZXNwb25kUXVlc3Rpb25DYWxscygpIHsgcmV0dXJuIHN0YXRlLnJlc3BvbmRRdWVzdGlvbkNhbGxzOyB9LFxuXHRcdFx0Z2V0IGRlbGV0ZVR1cm5DYWxscygpIHsgcmV0dXJuIHN0YXRlLmRlbGV0ZVR1cm5DYWxsczsgfSxcblx0XHRcdGdldCBjYW5jZWxUb29sQ2FsbENhbGxzKCkgeyByZXR1cm4gc3RhdGUuY2FuY2VsVG9vbENhbGxDYWxsczsgfSxcblx0XHRcdGdldCBwb3N0ZWQoKSB7IHJldHVybiBzdGF0ZS5wb3N0ZWQ7IH0sXG5cdFx0XHRnZXQgZm9jdXNlZCgpIHsgcmV0dXJuIHN0YXRlLmZvY3VzZWQ7IH0sXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcmVzb2x2ZUNvbmZpcm1hdGlvbiBza2lwcyB1bmFyeSBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgdHJ1ZSk7XG5cdFx0YXdhaXQgcmVzb2x2ZUNvbmZpcm1hdGlvbihmaXh0dXJlLmhvc3QsICd0dXJuLTEnLCAnYWxsb3dlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnJlc29sdmVDb25maXJtYXRpb25DYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5mb2N1c2VkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcmVzb2x2ZVF1ZXN0aW9uIHNraXBzIHVuYXJ5IGFuZCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCB0cnVlKTtcblx0XHRhd2FpdCByZXNvbHZlUXVlc3Rpb24oZml4dHVyZS5ob3N0LCAndHVybi0xJywgJ3JlcS0xJywgeyBxMTogeyBzZWxlY3RlZExhYmVsczogWydhJ10gfSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5yZXNwb25kUXVlc3Rpb25DYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5mb2N1c2VkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgZGVsZXRlVHVybiBza2lwcyB1bmFyeSBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgdHJ1ZSk7XG5cdFx0ZGVsZXRlVHVybihmaXh0dXJlLmhvc3QsICd0dXJuLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5kZWxldGVUdXJuQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIGNhbmNlbFRvb2xDYWxsIHNraXBzIHVuYXJ5IGFuZCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCB0cnVlKTtcblx0XHRjYW5jZWxUb29sQ2FsbChmaXh0dXJlLmhvc3QsIHsgaWQ6ICdlLXJ1bicsIHRvb2xDYWxsSWQ6ICd0Yy0xJywgYWdlbnRJZDogJ3N1YjphJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5jYW5jZWxUb29sQ2FsbENhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSByZXRyeUVycm9yIHNraXBzIHBvc3RCb3VuZCBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgdHJ1ZSk7XG5cdFx0cmV0cnlFcnJvcihmaXh0dXJlLmhvc3QsIHsgaWQ6ICdtc2ctMScsIHR1cm5JZDogJ3R1cm4tMScsIGFnZW50SWQ6ICdyb290JyB9KTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgd2l0aG91dCBwYWlyaW5nIHJlc29sdmVDb25maXJtYXRpb24gc3RpbGwgZm9yd2FyZHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIGZhbHNlKTtcblx0XHRhd2FpdCByZXNvbHZlQ29uZmlybWF0aW9uKGZpeHR1cmUuaG9zdCwgJ3R1cm4tMScsICdhbGxvd2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucmVzb2x2ZUNvbmZpcm1hdGlvbkNhbGxzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmZvY3VzZWQsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIHdpdGhvdXQgcGFpcmluZyByZXNvbHZlUXVlc3Rpb24gc3RpbGwgZm9yd2FyZHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIGZhbHNlKTtcblx0XHRhd2FpdCByZXNvbHZlUXVlc3Rpb24oZml4dHVyZS5ob3N0LCAndHVybi0xJywgJ3JlcS0xJywgeyBxMTogeyBzZWxlY3RlZExhYmVsczogWydhJ10gfSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5yZXNwb25kUXVlc3Rpb25DYWxscywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5mb2N1c2VkLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCB3aXRob3V0IHBhaXJpbmcgZGVsZXRlVHVybiBzdGlsbCBmb3J3YXJkcycsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgdHJ1ZSk7XG5cdFx0ZGVsZXRlVHVybihmaXh0dXJlLmhvc3QsICd0dXJuLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5kZWxldGVUdXJuQ2FsbHMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgd2l0aG91dCBwYWlyaW5nIGNhbmNlbFRvb2xDYWxsIHN0aWxsIGZvcndhcmRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCB0cnVlKTtcblx0XHRjYW5jZWxUb29sQ2FsbChmaXh0dXJlLmhvc3QsIHsgaWQ6ICdlLXJ1bicsIHRvb2xDYWxsSWQ6ICd0Yy0xJywgYWdlbnRJZDogJ3N1YjphJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5jYW5jZWxUb29sQ2FsbENhbGxzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIHdpdGhvdXQgcGFpcmluZyByZXRyeUVycm9yIHN0aWxsIHBvc3RzIGNvbnRpbnVlR2VuZXJhdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgdHJ1ZSk7XG5cdFx0cmV0cnlFcnJvcihmaXh0dXJlLmhvc3QsIHsgaWQ6ICdtc2ctMScsIHR1cm5JZDogJ3R1cm4tMScsIGFnZW50SWQ6ICdyb290JyB9KTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdLRUVQIGxlZnRvdmVyIGxpc3QtZmFpbCByZXNvbHZlQ29uZmlybWF0aW9uIHNraXBzIHVuYXJ5IGFuZCBzaG93cyBzZXNzaW9uX25vdF9yZWFkeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgZmFsc2UsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRhd2FpdCByZXNvbHZlQ29uZmlybWF0aW9uKGZpeHR1cmUuaG9zdCwgJ3R1cm4tMScsICdhbGxvd2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucmVzb2x2ZUNvbmZpcm1hdGlvbkNhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmZvY3VzZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnc2Vzc2lvbl9ub3RfcmVhZHknXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIHJlc29sdmVRdWVzdGlvbiBza2lwcyB1bmFyeSBhbmQgc2hvd3Mgc2Vzc2lvbl9ub3RfcmVhZHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIGZhbHNlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0YXdhaXQgcmVzb2x2ZVF1ZXN0aW9uKGZpeHR1cmUuaG9zdCwgJ3R1cm4tMScsICdyZXEtMScsIHsgcTE6IHsgc2VsZWN0ZWRMYWJlbHM6IFsnYSddIH0gfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucmVzcG9uZFF1ZXN0aW9uQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZm9jdXNlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydzZXNzaW9uX25vdF9yZWFkeSddKTtcblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgZGVsZXRlVHVybiBza2lwcyB1bmFyeSBhbmQgc2hvd3Mgc2Vzc2lvbl9ub3RfcmVhZHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZUNvbmZpcm1RdWVzdGlvbkhvc3QoZmFpbHVyZXMsIGZhbHNlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0ZGVsZXRlVHVybihmaXh0dXJlLmhvc3QsICd0dXJuLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5kZWxldGVUdXJuQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydzZXNzaW9uX25vdF9yZWFkeSddKTtcblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgY2FuY2VsVG9vbENhbGwgc2tpcHMgdW5hcnkgYW5kIHNob3dzIHNlc3Npb25fbm90X3JlYWR5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCBmYWxzZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGNhbmNlbFRvb2xDYWxsKGZpeHR1cmUuaG9zdCwgeyBpZDogJ2UtcnVuJywgdG9vbENhbGxJZDogJ3RjLTEnLCBhZ2VudElkOiAnc3ViOmEnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmNhbmNlbFRvb2xDYWxsQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydzZXNzaW9uX25vdF9yZWFkeSddKTtcblx0fSk7XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgcmV0cnlFcnJvciBza2lwcyBwb3N0Qm91bmQgYW5kIHNob3dzIHNlc3Npb25fbm90X3JlYWR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVDb25maXJtUXVlc3Rpb25Ib3N0KGZhaWx1cmVzLCBmYWxzZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdHJldHJ5RXJyb3IoZml4dHVyZS5ob3N0LCB7IGlkOiAnbXNnLTEnLCB0dXJuSWQ6ICd0dXJuLTEnLCBhZ2VudElkOiAncm9vdCcgfSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnc2Vzc2lvbl9ub3RfcmVhZHknXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JldHJ5RXJyb3IgcGFpcmluZy1ob2xkIGxlZnRvdmVyIGxlYXNlIGRvZXMgbm90IHBvc3QgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCwgcG9zdGVkIH0gPSBwYWlyaW5nSG9sZExlZnRvdmVyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRyZXRyeUVycm9yKGhvc3QsIHsgaWQ6ICdtc2ctMScsIHR1cm5JZDogJ3R1cm4tMScsIGFnZW50SWQ6ICdyb290JyB9KTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gcGFpcmluZ0hvbGRDb21wb3NlcldyaXRlSG9zdChmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdKToge1xuXHRcdGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXHRcdHBvc3RlZDogbnVtYmVyO1xuXHRcdGVucXVldWVDYWxsczogbnVtYmVyO1xuXHRcdHR1cm5Xcml0ZXM6IG51bWJlcjtcblx0XHRxdWV1ZVdyaXRlczogbnVtYmVyO1xuXHR9IHtcblx0XHRjb25zdCBzdGF0ZSA9IHsgcG9zdGVkOiAwLCBlbnF1ZXVlQ2FsbHM6IDAsIHR1cm5Xcml0ZXM6IDAsIHF1ZXVlV3JpdGVzOiAwIH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAnY29tcG9zZScgYXMgY29uc3QsXG5cdFx0XHRzdWJtaXRJbkZsaWdodDogZmFsc2UsXG5cdFx0XHRlZGl0aW5nVHVybklkOiAndHVybi0xJyxcblx0XHRcdGVkaXRpbmdRdWV1ZUl0ZW1JZDogJ3ExJyxcblx0XHRcdGRvY2tUZXh0YXJlYTogeyB2YWx1ZTogJ2xlZnRvdmVyIGRyYWZ0JyB9LFxuXHRcdFx0c2VuZEJ1dHRvbjogeyBlbmFibGVkOiB0cnVlIH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtbGVmdG92ZXInLFxuXHRcdFx0Z2V0RWRpdGluZ1F1ZXVlSXRlbTogKCkgPT4gKHsgaWQ6ICdxMScsIGNvbnRlbnQ6ICdxdWV1ZWQnIH0pLFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZToge1xuXHRcdFx0XHRwb3N0OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUucG9zdGVkKys7XG5cdFx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUsIGNvcnJlbGF0aW9uOiB7IGlkOiAneCcgfSB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0ZW5xdWV1ZU1lc3NhZ2VRdWV1ZUl0ZW06ICgpID0+IHtcblx0XHRcdFx0XHRzdGF0ZS5lbnF1ZXVlQ2FsbHMrKztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dXBkYXRlVXNlclR1cm5UZXh0OiAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUudHVybldyaXRlcysrO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR1cGRhdGVNZXNzYWdlUXVldWVJdGVtQ29udGVudDogKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLnF1ZXVlV3JpdGVzKys7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSksXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyB9LFxuXHRcdFx0cmVuZGVySW5ib3hTdGF0dXM6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZVNlbmRFbmFibGVkOiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVDb252ZXJzYXRpb25QaGFzZTogKCkgPT4geyB9LFxuXHRcdFx0cmVzZXRJbnB1dEhpc3RvcnlCcm93c2U6ICgpID0+IHsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGhvc3Q6IGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCxcblx0XHRcdGdldCBwb3N0ZWQoKSB7IHJldHVybiBzdGF0ZS5wb3N0ZWQ7IH0sXG5cdFx0XHRnZXQgZW5xdWV1ZUNhbGxzKCkgeyByZXR1cm4gc3RhdGUuZW5xdWV1ZUNhbGxzOyB9LFxuXHRcdFx0Z2V0IHR1cm5Xcml0ZXMoKSB7IHJldHVybiBzdGF0ZS50dXJuV3JpdGVzOyB9LFxuXHRcdFx0Z2V0IHF1ZXVlV3JpdGVzKCkgeyByZXR1cm4gc3RhdGUucXVldWVXcml0ZXM7IH0sXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ3VwZGF0ZVNlbmRFbmFibGVkIHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBkcmFmdCBkaXNhYmxlcyBTZW5kJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QgfSA9IHBhaXJpbmdIb2xkQ29tcG9zZXJXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGNvbnN0IGNocm9tZUhvc3QgPSBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0dXBkYXRlU2VuZEVuYWJsZWQoY2hyb21lSG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZUhvc3Quc2VuZEJ1dHRvbi5lbmFibGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdzdWJtaXREcmFmdCBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZHJhZnQgZG9lcyBub3QgZW5xdWV1ZSBvciBwb3N0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QsIHBvc3RlZCwgZW5xdWV1ZUNhbGxzIH0gPSBwYWlyaW5nSG9sZENvbXBvc2VyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRhd2FpdCBzdWJtaXREcmFmdChob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5xdWV1ZUNhbGxzLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAnbGVmdG92ZXIgZHJhZnQnKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZVR1cm5FZGl0IHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBkb2VzIG5vdCB3cml0ZSBhbmQgc3RheXMgaW4gZWRpdCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0LCB0dXJuV3JpdGVzIH0gPSBwYWlyaW5nSG9sZENvbXBvc2VyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRob3N0LmNvbXBvc2VyUG9saWN5ID0gJ3R1cm5FZGl0Jztcblx0XHRzYXZlVHVybkVkaXQoaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR1cm5Xcml0ZXMsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5lZGl0aW5nVHVybklkLCAndHVybi0xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuY29tcG9zZXJQb2xpY3ksICd0dXJuRWRpdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSwgJ2xlZnRvdmVyIGRyYWZ0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVRdWV1ZUVkaXQgcGFpcmluZy1ob2xkIGxlZnRvdmVyIGRvZXMgbm90IHdyaXRlIGFuZCBzdGF5cyBpbiBlZGl0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QsIHF1ZXVlV3JpdGVzIH0gPSBwYWlyaW5nSG9sZENvbXBvc2VyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRob3N0LmNvbXBvc2VyUG9saWN5ID0gJ3F1ZXVlRWRpdCc7XG5cdFx0c2F2ZVF1ZXVlRWRpdChob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVldWVXcml0ZXMsIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5lZGl0aW5nUXVldWVJdGVtSWQsICdxMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmNvbXBvc2VyUG9saWN5LCAncXVldWVFZGl0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAnbGVmdG92ZXIgZHJhZnQnKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gbGVmdG92ZXJDb21wb3NlckhhbmRsZXJIb3N0KG9wdGlvbnM6IHtcblx0XHRwYWlyaW5nUGVuZGluZzogYm9vbGVhbjtcblx0XHRlbmdpbmVDb25uZWN0ZWQ6IGJvb2xlYW47XG5cdFx0ZW5naW5lU2Vzc2lvblJlYWR5PzogYm9vbGVhbjtcblx0XHRmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdO1xuXHR9KToge1xuXHRcdGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXHRcdHBvc3RlZDogbnVtYmVyO1xuXHRcdGVucXVldWVDYWxsczogbnVtYmVyO1xuXHRcdHR1cm5Xcml0ZXM6IG51bWJlcjtcblx0XHRxdWV1ZVdyaXRlczogbnVtYmVyO1xuXHRcdGV4aXRlZDogbnVtYmVyO1xuXHR9IHtcblx0XHRjb25zdCBzdGF0ZSA9IHsgcG9zdGVkOiAwLCBlbnF1ZXVlQ2FsbHM6IDAsIHR1cm5Xcml0ZXM6IDAsIHF1ZXVlV3JpdGVzOiAwLCBleGl0ZWQ6IDAgfTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdjb21wb3NlJyBhcyBjb25zdCxcblx0XHRcdHN1Ym1pdEluRmxpZ2h0OiBmYWxzZSxcblx0XHRcdGZpbHRlckFnZW50SWQ6IHVuZGVmaW5lZCxcblx0XHRcdGNhdGFsb2dNb2RlbElkczogWycnXSxcblx0XHRcdG1vZGVsU2VsZWN0ZWRJbmRleDogMCxcblx0XHRcdGRyYWZ0czogbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKSxcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiB7IGdldFZhbHVlOiAoKSA9PiBmYWxzZSB9LFxuXHRcdFx0ZWRpdGluZ1R1cm5JZDogJ3R1cm4tMScsXG5cdFx0XHRlZGl0aW5nUXVldWVJdGVtSWQ6ICdxMScsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdsZWZ0b3ZlciBkcmFmdCcgfSxcblx0XHRcdHNlbmRCdXR0b246IHsgZW5hYmxlZDogdHJ1ZSB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLWxlZnRvdmVyJyxcblx0XHRcdGdldEVkaXRpbmdRdWV1ZUl0ZW06ICgpID0+ICh7IGlkOiAncTEnLCBjb250ZW50OiAncXVldWVkJyB9KSxcblx0XHRcdHNlc3Npb25WaWV3TGVhc2U6IHtcblx0XHRcdFx0cG9zdDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLnBvc3RlZCsrO1xuXHRcdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlLCBjb3JyZWxhdGlvbjogeyBpZDogJ3gnIH0gfTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gb3B0aW9ucy5lbmdpbmVDb25uZWN0ZWQsXG5cdFx0XHRcdC4uLihvcHRpb25zLmVuZ2luZVNlc3Npb25SZWFkeSA9PT0gdW5kZWZpbmVkID8ge30gOiB7IGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBvcHRpb25zLmVuZ2luZVNlc3Npb25SZWFkeSB9KSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHRcdGVucXVldWVNZXNzYWdlUXVldWVJdGVtOiAoKSA9PiB7XG5cdFx0XHRcdFx0c3RhdGUuZW5xdWV1ZUNhbGxzKys7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHVwZGF0ZVVzZXJUdXJuVGV4dDogKCkgPT4ge1xuXHRcdFx0XHRcdHN0YXRlLnR1cm5Xcml0ZXMrKztcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dXBkYXRlTWVzc2FnZVF1ZXVlSXRlbUNvbnRlbnQ6ICgpID0+IHtcblx0XHRcdFx0XHRzdGF0ZS5xdWV1ZVdyaXRlcysrO1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gW10sXG5cdFx0XHRcdHJlbGVhc2VNZXNzYWdlUXVldWVJdGVtSG9sZDogKCkgPT4geyB9LFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBvcHRpb25zLnBhaXJpbmdQZW5kaW5nIH0pLFxuXHRcdFx0fSxcblx0XHRcdGV4aXRDb21wb3NlckVkaXQ6ICgpID0+IHsgc3RhdGUuZXhpdGVkKys7IH0sXG5cdFx0XHRyZW5kZXJJbmJveFN0YXR1czogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlU2VuZEVuYWJsZWQ6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlOiAoKSA9PiB7IH0sXG5cdFx0XHRyZXNldElucHV0SGlzdG9yeUJyb3dzZTogKCkgPT4geyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdG9wdGlvbnMuZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRob3N0OiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsXG5cdFx0XHRnZXQgcG9zdGVkKCkgeyByZXR1cm4gc3RhdGUucG9zdGVkOyB9LFxuXHRcdFx0Z2V0IGVucXVldWVDYWxscygpIHsgcmV0dXJuIHN0YXRlLmVucXVldWVDYWxsczsgfSxcblx0XHRcdGdldCB0dXJuV3JpdGVzKCkgeyByZXR1cm4gc3RhdGUudHVybldyaXRlczsgfSxcblx0XHRcdGdldCBxdWV1ZVdyaXRlcygpIHsgcmV0dXJuIHN0YXRlLnF1ZXVlV3JpdGVzOyB9LFxuXHRcdFx0Z2V0IGV4aXRlZCgpIHsgcmV0dXJuIHN0YXRlLmV4aXRlZDsgfSxcblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnS0VFUCBsZWZ0b3ZlciBsaXN0LWZhaWwgc3VibWl0RHJhZnQgc2tpcHMgcG9zdEJvdW5kIGFuZCBzaG93cyBzZXNzaW9uX25vdF9yZWFkeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVDb25uZWN0ZWQ6IHRydWUsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IGZhbHNlLFxuXHRcdFx0ZmFpbHVyZXMsXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0YXdhaXQgc3VibWl0RHJhZnQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmVucXVldWVDYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdWJtaXRJbkZsaWdodCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnc2Vzc2lvbl9ub3RfcmVhZHknXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5kb2NrVGV4dGFyZWEudmFsdWUsICdsZWZ0b3ZlciBkcmFmdCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdLRUVQIGxlZnRvdmVyIGxpc3QtZmFpbCBzYXZlVHVybkVkaXQgc2tpcHMgdXBkYXRlVXNlclR1cm5UZXh0IGFuZCBzdGF5cyBpbiBlZGl0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJDb21wb3NlckhhbmRsZXJIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZUNvbm5lY3RlZDogdHJ1ZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogZmFsc2UsXG5cdFx0XHRmYWlsdXJlcyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRmaXh0dXJlLmhvc3QuY29tcG9zZXJQb2xpY3kgPSAndHVybkVkaXQnO1xuXHRcdHNhdmVUdXJuRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnR1cm5Xcml0ZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmV4aXRlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydzZXNzaW9uX25vdF9yZWFkeSddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmVkaXRpbmdUdXJuSWQsICd0dXJuLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSwgJ2xlZnRvdmVyIGRyYWZ0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIHNhdmVRdWV1ZUVkaXQgc2tpcHMgcXVldWUgd3JpdGUgYW5kIHN0YXlzIGluIGVkaXQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3ZlckNvbXBvc2VySGFuZGxlckhvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lQ29ubmVjdGVkOiB0cnVlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBmYWxzZSxcblx0XHRcdGZhaWx1cmVzLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdGZpeHR1cmUuaG9zdC5jb21wb3NlclBvbGljeSA9ICdxdWV1ZUVkaXQnO1xuXHRcdHNhdmVRdWV1ZUVkaXQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5xdWV1ZVdyaXRlcywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZXhpdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ3Nlc3Npb25fbm90X3JlYWR5J10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZWRpdGluZ1F1ZXVlSXRlbUlkLCAncTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmNvbXBvc2VyUG9saWN5LCAncXVldWVFZGl0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5kb2NrVGV4dGFyZWEudmFsdWUsICdsZWZ0b3ZlciBkcmFmdCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZWZ0b3Zlci1sb29rcy1saXZlIHN1Ym1pdERyYWZ0IHNraXBzIHBvc3RCb3VuZCBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogdHJ1ZSxcblx0XHRcdGVuZ2luZUNvbm5lY3RlZDogdHJ1ZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHRcdGZhaWx1cmVzLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgdHJ1ZSk7XG5cdFx0YXdhaXQgc3VibWl0RHJhZnQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmVucXVldWVDYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdWJtaXRJbkZsaWdodCwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBzYXZlVHVybkVkaXQgc2tpcHMgdXBkYXRlVXNlclR1cm5UZXh0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJDb21wb3NlckhhbmRsZXJIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiB0cnVlLFxuXHRcdFx0ZW5naW5lQ29ubmVjdGVkOiB0cnVlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdFx0ZmFpbHVyZXMsXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIHRydWUpO1xuXHRcdGZpeHR1cmUuaG9zdC5jb21wb3NlclBvbGljeSA9ICd0dXJuRWRpdCc7XG5cdFx0c2F2ZVR1cm5FZGl0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUudHVybldyaXRlcywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuZXhpdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgc2F2ZVF1ZXVlRWRpdCBza2lwcyBxdWV1ZSB3cml0ZScsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogdHJ1ZSxcblx0XHRcdGVuZ2luZUNvbm5lY3RlZDogdHJ1ZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHRcdGZhaWx1cmVzLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCB0cnVlKTtcblx0XHRmaXh0dXJlLmhvc3QuY29tcG9zZXJQb2xpY3kgPSAncXVldWVFZGl0Jztcblx0XHRzYXZlUXVldWVFZGl0KGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucXVldWVXcml0ZXMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmV4aXRlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgbGl2ZSBzdWJtaXREcmFmdCBzdGlsbCBwb3N0cyB3aGVuIGVuZ2luZSBzZXNzaW9uIGlzIHJlYWR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJDb21wb3NlckhhbmRsZXJIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZUNvbm5lY3RlZDogdHJ1ZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHRcdGZhaWx1cmVzLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0YXdhaXQgc3VibWl0RHJhZnQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmVucXVldWVDYWxscywgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAnJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCBsaXZlIHNhdmVUdXJuRWRpdCBzdGlsbCB3cml0ZXMgd2hlbiBlbmdpbmUgc2Vzc2lvbiBpcyByZWFkeScsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVDb25uZWN0ZWQ6IHRydWUsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0XHRmYWlsdXJlcyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0Zml4dHVyZS5ob3N0LmNvbXBvc2VyUG9saWN5ID0gJ3R1cm5FZGl0Jztcblx0XHRzYXZlVHVybkVkaXQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS50dXJuV3JpdGVzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5leGl0ZWQsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIGxpdmUgc2F2ZVF1ZXVlRWRpdCBzdGlsbCB3cml0ZXMgd2hlbiBlbmdpbmUgc2Vzc2lvbiBpcyByZWFkeScsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyQ29tcG9zZXJIYW5kbGVySG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVDb25uZWN0ZWQ6IHRydWUsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0XHRmYWlsdXJlcyxcblx0XHR9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0Zml4dHVyZS5ob3N0LmNvbXBvc2VyUG9saWN5ID0gJ3F1ZXVlRWRpdCc7XG5cdFx0c2F2ZVF1ZXVlRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnF1ZXVlV3JpdGVzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5leGl0ZWQsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlVHVybiBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZG9lcyBub3Qgd3JpdGUgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCwgcG9zdGVkIH0gPSBwYWlyaW5nSG9sZExlZnRvdmVyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRsZXQgZGVsZXRlQ2FsbHMgPSAwO1xuXHRcdChob3N0IGFzIHVua25vd24gYXMgeyBzdHViU2VydmljZTogeyBkZWxldGVUdXJuOiAoKSA9PiBib29sZWFuIH0gfSkuc3R1YlNlcnZpY2UuZGVsZXRlVHVybiA9ICgpID0+IHtcblx0XHRcdGRlbGV0ZUNhbGxzKys7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdGRlbGV0ZVR1cm4oaG9zdCwgJ3R1cm4tMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVDYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdiZWdpblR1cm5FZGl0IHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBkb2VzIG5vdCBlbnRlciBlZGl0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QgfSA9IHBhaXJpbmdIb2xkQ29tcG9zZXJXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGNvbnN0IGNocm9tZUhvc3QgPSBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0Y2hyb21lSG9zdC5jb21wb3NlclBvbGljeSA9ICdjb21wb3NlJztcblx0XHRjaHJvbWVIb3N0LmVkaXRpbmdUdXJuSWQgPSB1bmRlZmluZWQ7XG5cdFx0YmVnaW5UdXJuRWRpdChjaHJvbWVIb3N0LCAndHVybi0xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZUhvc3QuY29tcG9zZXJQb2xpY3ksICdjb21wb3NlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZUhvc3QuZWRpdGluZ1R1cm5JZCwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGtlZXBMZWZ0b3Zlckxpc3RGYWlsV3JpdGVIb3N0KGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10pOiB7XG5cdFx0aG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3Q7XG5cdH0ge1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0c3VibWl0SW5GbGlnaHQ6IGZhbHNlLFxuXHRcdFx0ZWRpdGluZ1R1cm5JZDogdW5kZWZpbmVkIGFzIHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRcdGVkaXRpbmdRdWV1ZUl0ZW1JZDogdW5kZWZpbmVkIGFzIHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRcdGRvY2tUZXh0YXJlYTogeyB2YWx1ZTogJ2xlZnRvdmVyIGRyYWZ0JyB9LFxuXHRcdFx0c2VuZEJ1dHRvbjogeyBlbmFibGVkOiB0cnVlIH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtbGVmdG92ZXInLFxuXHRcdFx0aXNQcmVGaXJzdDogKCkgPT4gZmFsc2UsXG5cdFx0XHRpbmJveE92ZXJsYXk6IHsgY2xvc2VMaXN0UGFuZWw6ICgpID0+IHsgfSB9LFxuXHRcdFx0Y29tcG9zZXI6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuXHRcdFx0dGltZWxpbmVUcmVlOiB7IHNldEVkaXRpbmdUdXJuSWQ6ICgpID0+IHsgfSB9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHRcdGdldFR1cm5zOiAoKSA9PiBbeyBpZDogJ3R1cm4tMScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJ2xlZnRvdmVyIHVzZXInIH1dLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdH0sXG5cdFx0XHRleGl0Q29tcG9zZXJFZGl0OiAoKSA9PiB7IH0sXG5cdFx0XHRyZW5kZXJJbmJveFN0YXR1czogKCkgPT4geyB9LFxuXHRcdFx0dXBkYXRlU2VuZEVuYWJsZWQ6ICgpID0+IHsgfSxcblx0XHRcdHVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlOiAoKSA9PiB7IH0sXG5cdFx0XHRyZXNldElucHV0SGlzdG9yeUJyb3dzZTogKCkgPT4geyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRyZXR1cm4geyBob3N0OiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QgfTtcblx0fVxuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIHdyaXRlc0VuYWJsZWQgaXMgZmFsc2UgYW5kIGJlZ2luVHVybkVkaXQgZG9lcyBub3QgZW50ZXIgZWRpdCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgeyBob3N0IH0gPSBrZWVwTGVmdG92ZXJMaXN0RmFpbFdyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0Y29uc3QgY2hyb21lSG9zdCA9IGhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzUmVhZGluZ0NvbHVtbldyaXRlc0VuYWJsZWQoY2hyb21lSG9zdCksIGZhbHNlKTtcblx0XHRjaHJvbWVIb3N0LmNvbXBvc2VyUG9saWN5ID0gJ2NvbXBvc2UnO1xuXHRcdGNocm9tZUhvc3QuZWRpdGluZ1R1cm5JZCA9IHVuZGVmaW5lZDtcblx0XHRiZWdpblR1cm5FZGl0KGNocm9tZUhvc3QsICd0dXJuLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lSG9zdC5jb21wb3NlclBvbGljeSwgJ2NvbXBvc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lSG9zdC5lZGl0aW5nVHVybklkLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgncGFpcmluZy1ob2xkIHdyaXRlc0VuYWJsZWQgc3RheXMgZmFsc2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCB9ID0gcGFpcmluZ0hvbGRDb21wb3NlcldyaXRlSG9zdChmYWlsdXJlcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaG9zdC51YUNvbm5lY3Rpb24pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNSZWFkaW5nQ29sdW1uV3JpdGVzRW5hYmxlZChob3N0KSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgbGl2ZSB3cml0ZXNFbmFibGVkIHN0YXlzIHRydWUgd2hlbiBlbmdpbmUgc2Vzc2lvbiBpcyByZWFkeScsICgpID0+IHtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnIGFzIGNvbnN0LCBwYXRoOiAnbG9vcGJhY2snIGFzIGNvbnN0IH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNSZWFkaW5nQ29sdW1uV3JpdGVzRW5hYmxlZChob3N0KSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JlZ2luUXVldWVFZGl0IHBhaXJpbmctaG9sZCBsZWZ0b3ZlciBkb2VzIG5vdCBlbnRlciBlZGl0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCB7IGhvc3QgfSA9IHBhaXJpbmdIb2xkQ29tcG9zZXJXcml0ZUhvc3QoZmFpbHVyZXMpO1xuXHRcdGNvbnN0IGNocm9tZUhvc3QgPSBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0Y2hyb21lSG9zdC5jb21wb3NlclBvbGljeSA9ICdjb21wb3NlJztcblx0XHRjaHJvbWVIb3N0LmVkaXRpbmdRdWV1ZUl0ZW1JZCA9IHVuZGVmaW5lZDtcblx0XHRiZWdpblF1ZXVlRWRpdChjaHJvbWVIb3N0LCAncTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lSG9zdC5jb21wb3NlclBvbGljeSwgJ2NvbXBvc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lSG9zdC5lZGl0aW5nUXVldWVJdGVtSWQsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVTZXNzaW9uQmFyV3JpdGVDaHJvbWUgcGFpcmluZy1ob2xkIGRpc2FibGVzIHRpdGxlIGRlbGV0ZSBhbmQgbmV3JywgKCkgPT4ge1xuXHRcdGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG5cdFx0Y29uc3QgbmV3QnV0dG9uID0geyBlbmFibGVkOiB0cnVlIH07XG5cdFx0Y29uc3QgZGVsZXRlQnV0dG9uID0geyBlbmFibGVkOiB0cnVlIH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdHNlc3Npb25UaXRsZUJ1dHRvbjogdGl0bGUsXG5cdFx0XHRuZXdTZXNzaW9uQnV0dG9uOiBuZXdCdXR0b24sXG5cdFx0XHRkZWxldGVTZXNzaW9uQnV0dG9uOiBkZWxldGVCdXR0b24sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogdHJ1ZSB9KSxcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhckhvc3Q7XG5cdFx0dXBkYXRlU2Vzc2lvbkJhcldyaXRlQ2hyb21lKGhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZS5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXdCdXR0b24uZW5hYmxlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVCdXR0b24uZW5hYmxlZCwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVTZXNzaW9uQmFyV3JpdGVDaHJvbWUgbGVmdG92ZXItbG9va3MtbGl2ZSBrZWVwcyB0aXRsZSBkZWxldGUgYW5kIG5ldyBkaXNhYmxlZCcsICgpID0+IHtcblx0XHRjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRcdGNvbnN0IG5ld0J1dHRvbiA9IHsgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGRlbGV0ZUJ1dHRvbiA9IHsgZW5hYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRzZXNzaW9uVGl0bGVCdXR0b246IHRpdGxlLFxuXHRcdFx0bmV3U2Vzc2lvbkJ1dHRvbjogbmV3QnV0dG9uLFxuXHRcdFx0ZGVsZXRlU2Vzc2lvbkJ1dHRvbjogZGVsZXRlQnV0dG9uLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IHRydWUgfSksXG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJIb3N0O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUsICdsZWZ0b3Zlci1sb29rcy1saXZlIGZpeHR1cmUgbXVzdCBrZWVwIGlzRW5naW5lQ29ubmVjdGVkKCk9PT10cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaG9zdC51YUNvbm5lY3Rpb24pLCB0cnVlKTtcblx0XHR1cGRhdGVTZXNzaW9uQmFyV3JpdGVDaHJvbWUoaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLmRpc2FibGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGUuZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0J1dHRvbi5lbmFibGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlbGV0ZUJ1dHRvbi5lbmFibGVkLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVNlc3Npb25CYXJXcml0ZUNocm9tZSBLRUVQIGxlZnRvdmVyIGRpc2FibGVzIHRpdGxlIGRlbGV0ZSBhbmQgbmV3JywgKCkgPT4ge1xuXHRcdGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG5cdFx0Y29uc3QgbmV3QnV0dG9uID0geyBlbmFibGVkOiB0cnVlIH07XG5cdFx0Y29uc3QgZGVsZXRlQnV0dG9uID0geyBlbmFibGVkOiB0cnVlIH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdHNlc3Npb25UaXRsZUJ1dHRvbjogdGl0bGUsXG5cdFx0XHRuZXdTZXNzaW9uQnV0dG9uOiBuZXdCdXR0b24sXG5cdFx0XHRkZWxldGVTZXNzaW9uQnV0dG9uOiBkZWxldGVCdXR0b24sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRnZXRTZXNzaW9uczogKCkgPT4gW3sgaWQ6ICd1YS1hJywgdGl0bGU6ICdBJyB9XSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJIb3N0O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHR1cGRhdGVTZXNzaW9uQmFyV3JpdGVDaHJvbWUoaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLmRpc2FibGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGUuZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0J1dHRvbi5lbmFibGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlbGV0ZUJ1dHRvbi5lbmFibGVkLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZVNlc3Npb25CYXJXcml0ZUNocm9tZSBjb25uZWN0ZWQgbGl2ZSBrZWVwcyB0aXRsZSBkZWxldGUgYW5kIG5ldyBlbmFibGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG5cdFx0Y29uc3QgbmV3QnV0dG9uID0geyBlbmFibGVkOiB0cnVlIH07XG5cdFx0Y29uc3QgZGVsZXRlQnV0dG9uID0geyBlbmFibGVkOiB0cnVlIH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdHNlc3Npb25UaXRsZUJ1dHRvbjogdGl0bGUsXG5cdFx0XHRuZXdTZXNzaW9uQnV0dG9uOiBuZXdCdXR0b24sXG5cdFx0XHRkZWxldGVTZXNzaW9uQnV0dG9uOiBkZWxldGVCdXR0b24sXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFySG9zdDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHR1cGRhdGVTZXNzaW9uQmFyV3JpdGVDaHJvbWUoaG9zdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLmRpc2FibGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3QnV0dG9uLmVuYWJsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVCdXR0b24uZW5hYmxlZCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHNlc3Npb25CYXJIYW5kbGVySG9zdChvcHRpb25zOiB7XG5cdFx0cGFpcmluZ1BlbmRpbmc6IGJvb2xlYW47XG5cdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiBib29sZWFuO1xuXHRcdGVuZ2luZUNvbm5lY3RlZD86IGJvb2xlYW47XG5cdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk/OiBib29sZWFuO1xuXHR9KToge1xuXHRcdGhvc3Q6IElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhckhvc3Q7XG5cdFx0ZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXTtcblx0XHRjcmVhdGVDYWxsczogbnVtYmVyW107XG5cdFx0ZGVsZXRlQ2FsbHM6IG51bWJlcltdO1xuXHRcdHJlbmFtZUNhbGxzOiBudW1iZXJbXTtcblx0XHRkcmFmdFdyaXRlczogc3RyaW5nW107XG5cdH0ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBjcmVhdGVDYWxsczogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCBkZWxldGVDYWxsczogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCByZW5hbWVDYWxsczogbnVtYmVyW10gPSBbXTtcblx0XHRjb25zdCBkcmFmdFdyaXRlczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBzZXNzaW9ucyA9IFt7IGlkOiAndWEtYScsIHRpdGxlOiAnQScgfV07XG5cdFx0Y29uc3QgdGl0bGVCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0XHR0aXRsZUJ1dHRvbi50ZXh0Q29udGVudCA9ICdBJztcblx0XHRjb25zdCB0aXRsZUlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcblx0XHR0aXRsZUlucHV0LmhpZGRlbiA9IHRydWU7XG5cdFx0Y29uc3QgdGl0bGVMaXZlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdHRpdGxlTGl2ZS50ZXh0Q29udGVudCA9ICdBJztcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0c2Vzc2lvblRpdGxlQnV0dG9uOiB0aXRsZUJ1dHRvbixcblx0XHRcdHNlc3Npb25UaXRsZUlucHV0OiB0aXRsZUlucHV0LFxuXHRcdFx0c2Vzc2lvblRpdGxlTGl2ZTogdGl0bGVMaXZlLFxuXHRcdFx0c2Vzc2lvblRpdGxlRWRpdGluZzogZmFsc2UsXG5cdFx0XHRzZXNzaW9uVGl0bGVFZGl0U25hcHNob3Q6ICdBJyxcblx0XHRcdGRpYWxvZ1NlcnZpY2U6IHsgY29uZmlybTogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHsgY29uZmlybWVkOiB0cnVlIH0pIH0sXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdsZWZ0b3ZlciBkcmFmdCcgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAndWEtYScsXG5cdFx0XHR3cml0ZUNvbXBvc2VyRHJhZnQ6IChfc2Vzc2lvbklkOiBzdHJpbmcsIHRleHQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRkcmFmdFdyaXRlcy5wdXNoKHRleHQpO1xuXHRcdFx0fSxcblx0XHRcdGRlbGV0ZUNvbXBvc2VyRHJhZnRzRm9yU2Vzc2lvbjogKCkgPT4geyB9LFxuXHRcdFx0cmVmcmVzaFNlc3Npb25TZWxlY3RPcHRpb25zOiAoKSA9PiB7IH0sXG5cdFx0XHR1cGRhdGVTZXNzaW9uVGl0bGU6ICgpID0+IHsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gb3B0aW9ucy5lbmdpbmVDb25uZWN0ZWQgPz8gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IG9wdGlvbnMuZW5naW5lU2Vzc2lvblJlYWR5LFxuXHRcdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBvcHRpb25zLmhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5ID8/IHRydWUsXG5cdFx0XHRcdGdldEFjdGl2ZVNlc3Npb25JZDogKCkgPT4gJ3VhLWEnLFxuXHRcdFx0XHRnZXRBY3RpdmVTZXNzaW9uOiAoKSA9PiBzZXNzaW9uc1swXSxcblx0XHRcdFx0Z2V0U2Vzc2lvbnM6ICgpID0+IHNlc3Npb25zLFxuXHRcdFx0XHRjcmVhdGVTZXNzaW9uOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y3JlYXRlQ2FsbHMucHVzaCgxKTtcblx0XHRcdFx0XHRzZXNzaW9ucy5wdXNoKHsgaWQ6IGB1YS1uZXctJHtjcmVhdGVDYWxscy5sZW5ndGh9YCwgdGl0bGU6ICdOZXcgc2Vzc2lvbicgfSk7XG5cdFx0XHRcdFx0cmV0dXJuIHNlc3Npb25zW3Nlc3Npb25zLmxlbmd0aCAtIDFdLmlkO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRkZWxldGVTZXNzaW9uOiAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHRkZWxldGVDYWxscy5wdXNoKDEpO1xuXHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gc2Vzc2lvbnMuZmluZEluZGV4KHNlc3Npb24gPT4gc2Vzc2lvbi5pZCA9PT0gc2Vzc2lvbklkKTtcblx0XHRcdFx0XHRpZiAoaW5kZXggPCAwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNlc3Npb25zLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJlbmFtZVNlc3Npb246IChzZXNzaW9uSWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdHJlbmFtZUNhbGxzLnB1c2goMSk7XG5cdFx0XHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHNlc3Npb25zLmZpbmQoZW50cnkgPT4gZW50cnkuaWQgPT09IHNlc3Npb25JZCk7XG5cdFx0XHRcdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHNlc3Npb24udGl0bGUgPSB0aXRsZTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogb3B0aW9ucy5wYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aG9zdDogaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhckhvc3QsXG5cdFx0XHRmYWlsdXJlcyxcblx0XHRcdGNyZWF0ZUNhbGxzLFxuXHRcdFx0ZGVsZXRlQ2FsbHMsXG5cdFx0XHRyZW5hbWVDYWxscyxcblx0XHRcdGRyYWZ0V3JpdGVzLFxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdLRUVQIGxlZnRvdmVyIFNlc3Npb25CYXIgaGFuZGxlcnMgcmVmdXNlIHRpdGxlIGVkaXQgY3JlYXRlIGRlbGV0ZSByZW5hbWUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IHNlc3Npb25CYXJIYW5kbGVySG9zdCh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSwgZW5naW5lU2Vzc2lvblJlYWR5OiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVTZXNzaW9uUmVhZHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblxuXHRcdGJlZ2luU2Vzc2lvblRpdGxlRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlRWRpdGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlQnV0dG9uLmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQuaGlkZGVuLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZmFpbHVyZXMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucmVuYW1lQ2FsbHMsIFtdKTtcblxuXHRcdGNyZWF0ZU5ld1Nlc3Npb24oZml4dHVyZS5ob3N0KTtcblx0XHRkZWxldGVBY3RpdmVTZXNzaW9uKGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmNyZWF0ZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmRlbGV0ZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmRyYWZ0V3JpdGVzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKS5tYXAoc2Vzc2lvbiA9PiBzZXNzaW9uLnRpdGxlKSwgWydBJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5mYWlsdXJlcywgWydzZXNzaW9uX25vdF9yZWFkeScsICdzZXNzaW9uX25vdF9yZWFkeSddKTtcblxuXHRcdGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVFZGl0aW5nID0gdHJ1ZTtcblx0XHRmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlQnV0dG9uLmhpZGRlbiA9IHRydWU7XG5cdFx0Zml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUlucHV0LmhpZGRlbiA9IGZhbHNlO1xuXHRcdGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVJbnB1dC52YWx1ZSA9ICdIYWNrZWQgbGVmdG92ZXIgdGl0bGUnO1xuXHRcdGNvbW1pdFNlc3Npb25UaXRsZUVkaXQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUVkaXRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUJ1dHRvbi5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUlucHV0LmhpZGRlbiwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnJlbmFtZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmNyZWF0ZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmRlbGV0ZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKS5tYXAoc2Vzc2lvbiA9PiBzZXNzaW9uLnRpdGxlKSwgWydBJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5mYWlsdXJlcywgWydzZXNzaW9uX25vdF9yZWFkeScsICdzZXNzaW9uX25vdF9yZWFkeScsICdzZXNzaW9uX25vdF9yZWFkeSddKTtcblx0fSk7XG5cblx0dGVzdCgncGFpcmluZy1ob2xkIFNlc3Npb25CYXIgaGFuZGxlcnMgc3RpbGwgcmVmdXNlIHRpdGxlIGVkaXQgY3JlYXRlIGRlbGV0ZScsICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gc2Vzc2lvbkJhckhhbmRsZXJIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IHRydWUsIGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgdHJ1ZSk7XG5cblx0XHRiZWdpblNlc3Npb25UaXRsZUVkaXQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUVkaXRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZmFpbHVyZXMsIFtdKTtcblxuXHRcdGNyZWF0ZU5ld1Nlc3Npb24oZml4dHVyZS5ob3N0KTtcblx0XHRkZWxldGVBY3RpdmVTZXNzaW9uKGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmNyZWF0ZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmRlbGV0ZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnJlbmFtZUNhbGxzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmRyYWZ0V3JpdGVzLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKS5tYXAoc2Vzc2lvbiA9PiBzZXNzaW9uLnRpdGxlKSwgWydBJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5mYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJywgJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdFx0dGVzdCgnZW5naW5lLWNhY2hlIGRpc2Nvbm5lY3QgU2Vzc2lvbkJhciBoYW5kbGVycyByZWZ1c2UgY3JlYXRlIHdpdGhvdXQgY2FwdHVyaW5nIGEgZHJhZnQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBmaXh0dXJlID0gc2Vzc2lvbkJhckhhbmRsZXJIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlLCBlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsIGVuZ2luZUNvbm5lY3RlZDogZmFsc2UgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXG5cdFx0XHRjcmVhdGVOZXdTZXNzaW9uKGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRkZWxldGVBY3RpdmVTZXNzaW9uKGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuY3JlYXRlQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5kZWxldGVDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmRyYWZ0V3JpdGVzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCcsICdlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHRcdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCBsaXZlIFNlc3Npb25CYXIgaGFuZGxlcnMgc3RpbGwgd3JpdGUgd2hlbiBlbmdpbmUgc2Vzc2lvbiBpcyByZWFkeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gc2Vzc2lvbkJhckhhbmRsZXJIb3N0KHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlLCBlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cblx0XHRiZWdpblNlc3Npb25UaXRsZUVkaXQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUVkaXRpbmcsIHRydWUpO1xuXHRcdGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVJbnB1dC52YWx1ZSA9ICdSZW5hbWVkIGxpdmUnO1xuXHRcdGNvbW1pdFNlc3Npb25UaXRsZUVkaXQoZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUVkaXRpbmcsIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucmVuYW1lQ2FsbHMsIFsxXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5nZXRTZXNzaW9ucygpWzBdLnRpdGxlLCAnUmVuYW1lZCBsaXZlJyk7XG5cblx0XHRjcmVhdGVOZXdTZXNzaW9uKGZpeHR1cmUuaG9zdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmNyZWF0ZUNhbGxzLCBbMV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5kcmFmdFdyaXRlcywgWydsZWZ0b3ZlciBkcmFmdCddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkubGVuZ3RoLCAyKTtcblxuXHRcdGF3YWl0IGRlbGV0ZUFjdGl2ZVNlc3Npb24oZml4dHVyZS5ob3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZGVsZXRlQ2FsbHMsIFsxXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLmZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VuY2hhbmdlZCBvciBibGFuayBzZXNzaW9uIHRpdGxlIGNvbW1pdCBkb2VzIG5vdCBsb29rIGxpa2UgYSBmYWlsZWQgc2VuZCcsICgpID0+IHtcblx0XHRjb25zdCB1bmNoYW5nZWQgPSBzZXNzaW9uQmFySGFuZGxlckhvc3QoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UsIGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSB9KTtcblx0XHRiZWdpblNlc3Npb25UaXRsZUVkaXQodW5jaGFuZ2VkLmhvc3QpO1xuXHRcdHVuY2hhbmdlZC5ob3N0LnNlc3Npb25UaXRsZUlucHV0LnZhbHVlID0gJyAgQSAgJztcblx0XHRjb21taXRTZXNzaW9uVGl0bGVFZGl0KHVuY2hhbmdlZC5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5jaGFuZ2VkLmhvc3Quc2Vzc2lvblRpdGxlRWRpdGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmNoYW5nZWQuaG9zdC5zZXNzaW9uVGl0bGVCdXR0b24uaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuY2hhbmdlZC5ob3N0LnNlc3Npb25UaXRsZUlucHV0LmhpZGRlbiwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuY2hhbmdlZC5ob3N0LnNlc3Npb25UaXRsZUJ1dHRvbi50ZXh0Q29udGVudCwgJ0EnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVuY2hhbmdlZC5yZW5hbWVDYWxscywgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodW5jaGFuZ2VkLmZhaWx1cmVzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuY2hhbmdlZC5ob3N0LnN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKClbMF0udGl0bGUsICdBJyk7XG5cblx0XHRjb25zdCBibGFuayA9IHNlc3Npb25CYXJIYW5kbGVySG9zdCh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSwgZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlIH0pO1xuXHRcdGJlZ2luU2Vzc2lvblRpdGxlRWRpdChibGFuay5ob3N0KTtcblx0XHRibGFuay5ob3N0LnNlc3Npb25UaXRsZUlucHV0LnZhbHVlID0gJyAgICc7XG5cdFx0Y29tbWl0U2Vzc2lvblRpdGxlRWRpdChibGFuay5ob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmxhbmsuaG9zdC5zZXNzaW9uVGl0bGVFZGl0aW5nLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJsYW5rLmhvc3Quc2Vzc2lvblRpdGxlQnV0dG9uLnRleHRDb250ZW50LCAnQScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYmxhbmsucmVuYW1lQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGJsYW5rLmZhaWx1cmVzLCBbJ2VtcHR5X3Nlc3Npb25fdGl0bGUnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJsYW5rLmhvc3Quc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKVswXS50aXRsZSwgJ0EnKTtcblx0fSk7XG5cblx0dGVzdCgnc2Vzc2lvbiB0aXRsZSBjb21taXQgZHVyaW5nIHBhaXJpbmcgaG9sZCBkb2VzIG5vdCByZW5hbWUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IHNlc3Npb25CYXJIYW5kbGVySG9zdCh7IHBhaXJpbmdQZW5kaW5nOiB0cnVlLCBlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUgfSk7XG5cdFx0Zml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUVkaXRpbmcgPSB0cnVlO1xuXHRcdGZpeHR1cmUuaG9zdC5zZXNzaW9uVGl0bGVCdXR0b24uaGlkZGVuID0gdHJ1ZTtcblx0XHRmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQuaGlkZGVuID0gZmFsc2U7XG5cdFx0Zml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUlucHV0LnZhbHVlID0gJ1JlbmFtZWQgd2hpbGUgcGFpcmluZyc7XG5cdFx0Y29tbWl0U2Vzc2lvblRpdGxlRWRpdChmaXh0dXJlLmhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlRWRpdGluZywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlQnV0dG9uLmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvblRpdGxlSW5wdXQuaGlkZGVuLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25UaXRsZUJ1dHRvbi50ZXh0Q29udGVudCwgJ0EnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucmVuYW1lQ2FsbHMsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKClbMF0udGl0bGUsICdBJyk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KG9wdGlvbnM/OiB7XG5cdFx0Y2F0YWxvZ1Rvb2xOYW1lcz86IHJlYWRvbmx5IHN0cmluZ1tdO1xuXHRcdGNhdGFsb2dNb2RlbElkcz86IHJlYWRvbmx5IHN0cmluZ1tdO1xuXHRcdHBlcm1pc3Npb25JbmRleD86IG51bWJlcjtcblx0XHRtb2RlbFNlbGVjdGVkSW5kZXg/OiBudW1iZXI7XG5cdFx0bGFzdFJlYWRpbmdXaWR0aD86IG51bWJlcjtcblx0XHRwYWlyaW5nUGVuZGluZz86IGJvb2xlYW47XG5cdFx0ZW5naW5lU2Vzc2lvblJlYWR5PzogYm9vbGVhbjtcblx0fSk6IHtcblx0XHRob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdDtcblx0XHRleGVjdXRlZENvbW1hbmRzOiB7IGlkOiBzdHJpbmc7IGFyZ3M6IHVua25vd25bXSB9W107XG5cdFx0cGVybWlzc2lvbkNhbGxzOiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfVtdO1xuXHRcdG1vZGVsQ2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9W107XG5cdFx0cGVybWlzc2lvblNlbGVjdDogSFRNTFNlbGVjdEVsZW1lbnQ7XG5cdFx0bW9kZWxTZWxlY3Q6IEhUTUxTZWxlY3RFbGVtZW50O1xuXHRcdGFnZW50U2VsZWN0OiBIVE1MU2VsZWN0RWxlbWVudDtcblx0XHRzZXRQYWlyaW5nUGVuZGluZyhwZW5kaW5nOiBib29sZWFuKTogdm9pZDtcblx0XHRkaXNwb3NlKCk6IHZvaWQ7XG5cdH0ge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGV4ZWN1dGVkQ29tbWFuZHM6IHsgaWQ6IHN0cmluZzsgYXJnczogdW5rbm93bltdIH1bXSA9IFtdO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25DYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZTogc3RyaW5nIH1bXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsQ2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9W10gPSBbXTtcblx0XHRjb25zdCBkb2NrUm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZG9ja1Jvb3QpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IGRvY2tSb290LnJlbW92ZSgpIH0pO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25Db250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRwZXJtaXNzaW9uQ29udGFpbmVyLmNsYXNzTmFtZSA9ICdjb252ZXJzYXRpb24tbGVucy1kb2NrLXBlcm1pc3Npb24nO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25TZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdBc2snLCAnMCcpKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdBZ2VudCcsICcxJykpO1xuXHRcdHBlcm1pc3Npb25TZWxlY3QuYWRkKG5ldyBPcHRpb24oJ1Blcm1pdCcsICcyJykpO1xuXHRcdHBlcm1pc3Npb25Db250YWluZXIuYXBwZW5kQ2hpbGQocGVybWlzc2lvblNlbGVjdCk7XG5cdFx0ZG9ja1Jvb3QuYXBwZW5kQ2hpbGQocGVybWlzc2lvbkNvbnRhaW5lcik7XG5cdFx0Y29uc3QgbW9kZWxDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRtb2RlbENvbnRhaW5lci5jbGFzc05hbWUgPSAnY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb2RlbCc7XG5cdFx0Y29uc3QgbW9kZWxTZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcblx0XHRmb3IgKGNvbnN0IGlkIG9mIG9wdGlvbnM/LmNhdGFsb2dNb2RlbElkcyA/PyBbJycsICdncHQtdGVzdCddKSB7XG5cdFx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbihpZCB8fCAnTm8gbW9kZWwnLCBpZCkpO1xuXHRcdH1cblx0XHRtb2RlbENvbnRhaW5lci5hcHBlbmRDaGlsZChtb2RlbFNlbGVjdCk7XG5cdFx0ZG9ja1Jvb3QuYXBwZW5kQ2hpbGQobW9kZWxDb250YWluZXIpO1xuXHRcdGNvbnN0IG1vcmVCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblx0XHRsZXQgcGFpcmluZ1BlbmRpbmcgPSBvcHRpb25zPy5wYWlyaW5nUGVuZGluZyA/PyB0cnVlO1xuXHRcdGNvbnN0IGVuZ2luZVNlc3Npb25SZWFkeSA9IG9wdGlvbnM/LmVuZ2luZVNlc3Npb25SZWFkeTtcblx0XHRjb25zdCBzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQgPSBuZXcgTWFwPHN0cmluZywgeyBhZ2VudEluZGV4OiBudW1iZXI7IHBlcm1pc3Npb25JbmRleDogbnVtYmVyIH0+KFtcblx0XHRcdFsnc2Vzcy1sZWZ0b3ZlcicsIHsgYWdlbnRJbmRleDogMCwgcGVybWlzc2lvbkluZGV4OiBvcHRpb25zPy5wZXJtaXNzaW9uSW5kZXggPz8gMCB9XSxcblx0XHRdKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXggPSBvcHRpb25zPy5wZXJtaXNzaW9uSW5kZXggPz8gMDtcblx0XHRtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gb3B0aW9ucz8ubW9kZWxTZWxlY3RlZEluZGV4ID8/IDA7XG5cdFx0Y29uc3QgYWdlbnRDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb25zdCBhZ2VudFNlbGVjdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NlbGVjdCcpO1xuXHRcdGFnZW50U2VsZWN0LmFkZChuZXcgT3B0aW9uKCdObyBhZ2VudCcsICcnKSk7XG5cdFx0YWdlbnRTZWxlY3QuYWRkKG5ldyBPcHRpb24oJ0NvZGVyJywgJ2NvZGVyJykpO1xuXHRcdGFnZW50Q29udGFpbmVyLmFwcGVuZENoaWxkKGFnZW50U2VsZWN0KTtcblx0XHRjb25zdCBnYXRlUm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgZ2F0ZUxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGdhdGVSb3cuYXBwZW5kQ2hpbGQoZ2F0ZUxhYmVsKTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y2F0YWxvZ1Rvb2xOYW1lczogb3B0aW9ucz8uY2F0YWxvZ1Rvb2xOYW1lcyA/PyBbJ2Jhc2gnXSxcblx0XHRcdGNhdGFsb2dNb2RlbElkczogb3B0aW9ucz8uY2F0YWxvZ01vZGVsSWRzID8/IFsnJywgJ2dwdC10ZXN0J10sXG5cdFx0XHRtb2RlbFNlbGVjdGVkSW5kZXg6IG9wdGlvbnM/Lm1vZGVsU2VsZWN0ZWRJbmRleCA/PyAwLFxuXHRcdFx0c2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLFxuXHRcdFx0bGFzdFJlYWRpbmdXaWR0aDogb3B0aW9ucz8ubGFzdFJlYWRpbmdXaWR0aCA/PyAzMDAsXG5cdFx0XHRwb3N0RmFpbHVyZVZpc2libGU6IGZhbHNlLFxuXHRcdFx0dHVuZUNvbnRleHRWaWV3OiB1bmRlZmluZWQgYXMgeyBjbG9zZSgpOiB2b2lkIH0gfCB1bmRlZmluZWQsXG5cdFx0XHRtb3JlQ29udGV4dFZpZXc6IHVuZGVmaW5lZCBhcyB7IGNsb3NlKCk6IHZvaWQgfSB8IHVuZGVmaW5lZCxcblx0XHRcdGRvY2tSb290LFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAnbGVmdG92ZXIgZHJhZnQnIH0sXG5cdFx0XHRzZW5kQnV0dG9uOiB7IGVuYWJsZWQ6IHRydWUgfSxcblx0XHRcdGdhdGVSb3csXG5cdFx0XHRnYXRlTGFiZWwsXG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0cGVybWlzc2lvblNlbGVjdEJveDoge1xuXHRcdFx0XHRzZXRFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pIHsgcGVybWlzc2lvblNlbGVjdC5kaXNhYmxlZCA9ICFlbmFibGVkOyB9LFxuXHRcdFx0XHRzZXRBcmlhTGFiZWwoKSB7IH0sXG5cdFx0XHRcdHNlbGVjdChpbmRleDogbnVtYmVyKSB7IHBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCA9IGluZGV4OyB9LFxuXHRcdFx0fSxcblx0XHRcdGFnZW50U2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNldEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikge1xuXHRcdFx0XHRcdGFnZW50U2VsZWN0LmRpc2FibGVkID0gIWVuYWJsZWQ7XG5cdFx0XHRcdFx0YWdlbnRTZWxlY3Quc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgU3RyaW5nKCFlbmFibGVkKSk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdFx0c2VsZWN0KGluZGV4OiBudW1iZXIpIHsgYWdlbnRTZWxlY3Quc2VsZWN0ZWRJbmRleCA9IGluZGV4OyB9LFxuXHRcdFx0fSxcblx0XHRcdG1vZGVsU2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNldEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikgeyBtb2RlbFNlbGVjdC5kaXNhYmxlZCA9ICFlbmFibGVkOyB9LFxuXHRcdFx0XHRzZXRBcmlhTGFiZWwoKSB7IH0sXG5cdFx0XHRcdHNlbGVjdChpbmRleDogbnVtYmVyKSB7XG5cdFx0XHRcdFx0bW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCA9IGluZGV4O1xuXHRcdFx0XHRcdGhvc3QubW9kZWxTZWxlY3RlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0YWdlbnRDb250YWluZXIsXG5cdFx0XHRtb3JlQnV0dG9uOiB7IGVsZW1lbnQ6IG1vcmVCdXR0b24gfSxcblx0XHRcdHR1bmVCdXR0b246IHsgZWxlbWVudDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJykgfSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHQuLi4oZW5naW5lU2Vzc2lvblJlYWR5ID09PSB1bmRlZmluZWQgPyB7fSA6IHsgaXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IGVuZ2luZVNlc3Npb25SZWFkeSB9KSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IGFzeW5jIChyZXF1ZXN0OiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfSkgPT4ge1xuXHRcdFx0XHRcdHBlcm1pc3Npb25DYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRcdHJldHVybiB7IG9rOiB0cnVlIH07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHN3aXRjaEFnZW50OiBhc3luYyAoKSA9PiAoeyBvazogdHJ1ZSB9KSxcblx0XHRcdFx0c3dpdGNoTW9kZWw6IGFzeW5jIChyZXF1ZXN0OiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlbElkOiBzdHJpbmcgfSkgPT4ge1xuXHRcdFx0XHRcdG1vZGVsQ2FsbHMucHVzaCh7IHNlc3Npb25JZDogcmVxdWVzdC5zZXNzaW9uSWQsIG1vZGVsSWQ6IHJlcXVlc3QubW9kZWxJZCB9KTtcblx0XHRcdFx0XHRyZXR1cm4geyByZXNvbHZlZE1vZGVsSWQ6IHJlcXVlc3QubW9kZWxJZCwgcHJvdmlkZXI6ICcnLCBsZXZlbDogMCwgY29zdDogJycsIHNwZWVkOiAnJyB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGNvbnRleHRWaWV3U2VydmljZToge1xuXHRcdFx0XHRzaG93Q29udGV4dFZpZXcoZGVsZWdhdGU6IHsgcmVuZGVyOiAoY29udGFpbmVyOiBIVE1MRWxlbWVudCkgPT4geyBkaXNwb3NlKCk6IHZvaWQgfSB9KSB7XG5cdFx0XHRcdFx0Y29uc3QgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHJlbmRlcmVkID0gZGVsZWdhdGUucmVuZGVyKGNvbnRhaW5lcik7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gY29udGFpbmVyLnJlbW92ZSgpIH0pO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRjbG9zZSgpIHtcblx0XHRcdFx0XHRcdFx0cmVuZGVyZWQuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0XHRjb250YWluZXIucmVtb3ZlKCk7XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0Y29tbWFuZFNlcnZpY2U6IHtcblx0XHRcdFx0ZXhlY3V0ZUNvbW1hbmQoaWQ6IHN0cmluZywgLi4uYXJnczogdW5rbm93bltdKSB7XG5cdFx0XHRcdFx0ZXhlY3V0ZWRDb21tYW5kcy5wdXNoKHsgaWQsIGFyZ3MgfSk7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy1sZWZ0b3ZlcicsXG5cdFx0fTtcblx0XHRjb25zdCB0eXBlZEhvc3QgPSBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlLCAnbGVmdG92ZXItbG9va3MtbGl2ZSBmaXh0dXJlIG11c3Qga2VlcCBpc0VuZ2luZUNvbm5lY3RlZCgpPT09dHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKHR5cGVkSG9zdC51YUNvbm5lY3Rpb24pLCBwYWlyaW5nUGVuZGluZyk7XG5cdFx0aWYgKGVuZ2luZVNlc3Npb25SZWFkeSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGVuZ2luZVNlc3Npb25SZWFkeSk7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRob3N0OiB0eXBlZEhvc3QsXG5cdFx0XHRleGVjdXRlZENvbW1hbmRzLFxuXHRcdFx0cGVybWlzc2lvbkNhbGxzLFxuXHRcdFx0bW9kZWxDYWxscyxcblx0XHRcdHBlcm1pc3Npb25TZWxlY3QsXG5cdFx0XHRtb2RlbFNlbGVjdCxcblx0XHRcdGFnZW50U2VsZWN0LFxuXHRcdFx0c2V0UGFpcmluZ1BlbmRpbmcocGVuZGluZzogYm9vbGVhbikge1xuXHRcdFx0XHRwYWlyaW5nUGVuZGluZyA9IHBlbmRpbmc7XG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRob3N0LnR1bmVDb250ZXh0Vmlldz8uY2xvc2UoKTtcblx0XHRcdFx0aG9zdC5tb3JlQ29udGV4dFZpZXc/LmNsb3NlKCk7XG5cdFx0XHRcdHN0b3JlLmRpc3Bvc2UoKTtcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcGFpcmluZy1ob2xkIHNlc3Npb24gc2VsZWN0cyBzdGF5IGRpc2FibGVkIGFuZCBkbyBub3Qgd3JpdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KCk7XG5cdFx0dHJ5IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25QZXJtaXNzaW9uTW9kZUF2YWlsYWJsZShmaXh0dXJlLmhvc3QpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNTZXNzaW9uU3dpdGNoTW9kZWxBdmFpbGFibGUoZml4dHVyZS5ob3N0KSwgZmFsc2UpO1xuXHRcdFx0dXBkYXRlQ29tcG9zZXJTZXNzaW9uU2VsZWN0c0VuYWJsZWQoZml4dHVyZS5ob3N0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ3RydWUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LmRpc2FibGVkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXG5cdFx0XHRhd2FpdCBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0YXdhaXQgYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCwgMCk7XG5cblx0XHRcdGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0Zml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcblx0XHRcdGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnKTtcblx0XHRcdGZpeHR1cmUubW9kZWxTZWxlY3QuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdGZpeHR1cmUubW9kZWxTZWxlY3QucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuXHRcdFx0Zml4dHVyZS5tb2RlbFNlbGVjdC5zZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnKTtcblx0XHRcdGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4ID0gMjtcblx0XHRcdGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCA9IDE7XG5cdFx0XHRhd2FpdCBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0YXdhaXQgYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxDYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXItbG9va3MtbGl2ZSBwYWlyaW5nLWhvbGQgTW9yZSByYWRpb3Mgc3RheSBkaXNhYmxlZCBhbmQgZm9yY2VkIGNsaWNrIGRvZXMgbm90IHdyaXRlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCgpO1xuXHRcdHRyeSB7XG5cdFx0XHR0b2dnbGVNb3JlQ29udGV4dFZpZXcoZml4dHVyZS5ob3N0KTtcblx0XHRcdGNvbnN0IGFnZW50Tm90ZSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtYWdlbnQnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0XHRhc3NlcnQub2soYWdlbnROb3RlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZ2VudE5vdGUuZ2V0QXR0cmlidXRlKCdyb2xlJyksICdub3RlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWdlbnROb3RlLnRleHRDb250ZW50LCAnTm8gYWdlbnQnKTtcblx0XHRcdGNvbnN0IHJhZGlvcyA9IFsuLi5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLXBlcm1pc3Npb24gW3JvbGU9XCJtZW51aXRlbXJhZGlvXCJdJyldIGFzIEhUTUxCdXR0b25FbGVtZW50W107XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFkaW9zLmxlbmd0aCwgMyk7XG5cdFx0XHRmb3IgKGNvbnN0IHJhZGlvIG9mIHJhZGlvcykge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFkaW8uZGlzYWJsZWQsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFkaW8uZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwZXJtaXQgPSByYWRpb3NbMl07XG5cdFx0XHRwZXJtaXQuZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdHBlcm1pdC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG5cdFx0XHRwZXJtaXQuc2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyk7XG5cdFx0XHRwZXJtaXQuY2xpY2soKTtcblx0XHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25DYWxscywgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ01vcmUgcG9wdXAgY2xvc2VzIG9uIEVzY2FwZScsICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3QoKTtcblx0XHR0cnkge1xuXHRcdFx0dG9nZ2xlTW9yZUNvbnRleHRWaWV3KGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRhc3NlcnQub2soZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9yZS1wb3B1cCcpKTtcblx0XHRcdC8vIERPTSBFc2NhcGUga2V5Y29kZTogRVZFTlRfS0VZX0NPREVfTUFQWzI3XSBub3JtYWxpemVzIHRvIEtleUNvZGUuRXNjYXBlXG5cdFx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KG5ldyBLZXlib2FyZEV2ZW50KCdrZXlkb3duJywgeyBrZXlDb2RlOiAyNywgYnViYmxlczogdHJ1ZSwgY2FuY2VsYWJsZTogdHJ1ZSB9KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9yZS1wb3B1cCcpLCBudWxsKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdUdW5lIHBvcHVwIGNsb3NlcyBvbiBFc2NhcGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KCk7XG5cdFx0dHJ5IHtcblx0XHRcdHRvZ2dsZVR1bmVDb250ZXh0VmlldyhmaXh0dXJlLmhvc3QpO1xuXHRcdFx0YXNzZXJ0Lm9rKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUtcG9wdXAnKSk7XG5cdFx0XHRkb2N1bWVudC5kaXNwYXRjaEV2ZW50KG5ldyBLZXlib2FyZEV2ZW50KCdrZXlkb3duJywgeyBrZXlDb2RlOiAyNywgYnViYmxlczogdHJ1ZSwgY2FuY2VsYWJsZTogdHJ1ZSB9KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpLCBudWxsKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBNb3JlIHBlcm1pc3Npb24gY2xpY2sgYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4IGNhdGNoLXBhdGggbm90aWNlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24gYXMge1xuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9KSA9PiBQcm9taXNlPHsgb2s6IGJvb2xlYW4gfT47XG5cdFx0XHR9O1xuXHRcdFx0dWFDb25uZWN0aW9uLnNldFBlcm1pc3Npb25Nb2RlID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3NldFBlcm1pc3Npb25Nb2RlIGJvb20nKTtcblx0XHRcdH07XG5cdFx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZml4dHVyZS5ob3N0LmdhdGVMYWJlbCwgJ3RleHRDb250ZW50Jywge1xuXHRcdFx0XHRjb25maWd1cmFibGU6IHRydWUsXG5cdFx0XHRcdGdldCgpIHtcblx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNldCgpIHtcblx0XHRcdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdHRvZ2dsZU1vcmVDb250ZXh0VmlldyhmaXh0dXJlLmhvc3QpO1xuXHRcdFx0Y29uc3QgcmFkaW9zID0gWy4uLmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtcGVybWlzc2lvbiBbcm9sZT1cIm1lbnVpdGVtcmFkaW9cIl0nKV0gYXMgSFRNTEJ1dHRvbkVsZW1lbnRbXTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYWRpb3MubGVuZ3RoLCAzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYWRpb3NbMl0hLmRpc2FibGVkLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdFx0cmFkaW9zWzJdIS5jbGljaygpO1xuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnY29tcG9zZXIgY2hyb21lIGFwcGx5U2Vzc2lvbiBmaXJlLWFuZC1mb3JnZXQgdm9pZHMgZG91YmxlLWNhdGNoIG9uVW5leHBlY3RlZEVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWUudHNgKTtcblx0XHRjb25zdCBkb3VibGVDYXRjaCA9ICcuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKSc7XG5cdFx0Y29uc3QgYXBwbHlTZXNzaW9uVm9pZHMgPSBzb3VyY2UubWF0Y2goL3ZvaWQgYXBwbHlTZXNzaW9uXFx3K1xcKFteO10rOy9nKSA/PyBbXTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFwcGx5U2Vzc2lvblZvaWRzLCBbXG5cdFx0XHRgdm9pZCBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoaG9zdCwgc2Vzc2lvbklkLCBpbmRleCkke2RvdWJsZUNhdGNofTtgLFxuXHRcdF0pO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChob3N0LCBzZXNzaW9uSWQsIGluZGV4KTsnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luLWZsaWdodCBsZWZ0b3Zlci1sb29rcy1saXZlIHBlcm1pc3Npb24gYW5kIG1vZGVsIGFwcGx5IGtlZXAgdGhlIGFjY2VwdGVkIHZhbHVlIGFuZCBzdGF5IHJlYWQtb25seScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBwZXJtaXNzaW9uQ2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9W10gPSBbXTtcblx0XHRjb25zdCBtb2RlbENhbGxzOiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlbElkOiBzdHJpbmcgfVtdID0gW107XG5cdFx0Y29uc3QgZG9ja1Jvb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGRvY2tSb290KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBkb2NrUm9vdC5yZW1vdmUoKSB9KTtcblx0XHRjb25zdCBwZXJtaXNzaW9uU2VsZWN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VsZWN0Jyk7XG5cdFx0cGVybWlzc2lvblNlbGVjdC5hZGQobmV3IE9wdGlvbignQXNrJywgJzAnKSk7XG5cdFx0cGVybWlzc2lvblNlbGVjdC5hZGQobmV3IE9wdGlvbignQWdlbnQnLCAnMScpKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdQZXJtaXQnLCAnMicpKTtcblx0XHRjb25zdCBwZXJtaXNzaW9uQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0cGVybWlzc2lvbkNvbnRhaW5lci5jbGFzc05hbWUgPSAnY29udmVyc2F0aW9uLWxlbnMtZG9jay1wZXJtaXNzaW9uJztcblx0XHRwZXJtaXNzaW9uQ29udGFpbmVyLmFwcGVuZENoaWxkKHBlcm1pc3Npb25TZWxlY3QpO1xuXHRcdGRvY2tSb290LmFwcGVuZENoaWxkKHBlcm1pc3Npb25Db250YWluZXIpO1xuXHRcdGNvbnN0IG1vZGVsU2VsZWN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VsZWN0Jyk7XG5cdFx0bW9kZWxTZWxlY3QuYWRkKG5ldyBPcHRpb24oJ05vIG1vZGVsJywgJycpKTtcblx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbignZ3B0LXRlc3QnLCAnZ3B0LXRlc3QnKSk7XG5cdFx0Y29uc3QgbW9kZWxDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRtb2RlbENvbnRhaW5lci5jbGFzc05hbWUgPSAnY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb2RlbCc7XG5cdFx0bW9kZWxDb250YWluZXIuYXBwZW5kQ2hpbGQobW9kZWxTZWxlY3QpO1xuXHRcdGRvY2tSb290LmFwcGVuZENoaWxkKG1vZGVsQ29udGFpbmVyKTtcblx0XHRjb25zdCBnYXRlUm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Z2F0ZVJvdy5oaWRkZW4gPSB0cnVlO1xuXHRcdGNvbnN0IGdhdGVMYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcblx0XHRnYXRlUm93LmFwcGVuZENoaWxkKGdhdGVMYWJlbCk7XG5cdFx0ZG9ja1Jvb3QuYXBwZW5kQ2hpbGQoZ2F0ZVJvdyk7XG5cdFx0Y29uc3Qgc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkID0gbmV3IE1hcDxzdHJpbmcsIHsgYWdlbnRJbmRleDogbnVtYmVyOyBwZXJtaXNzaW9uSW5kZXg6IG51bWJlciB9PihbXG5cdFx0XHRbJ3Nlc3MtbGVmdG92ZXInLCB7IGFnZW50SW5kZXg6IDAsIHBlcm1pc3Npb25JbmRleDogMCB9XSxcblx0XHRdKTtcblx0XHRsZXQgcGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRsZXQgcmVsZWFzZVBlcm1pc3Npb246ICgodmFsdWU6IHsgb2s6IHRydWUgfSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHBlcm1pc3Npb25TdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcGVybWlzc2lvbkVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgcGVybWlzc2lvblN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBwZXJtaXNzaW9uSG9sZCA9IG5ldyBQcm9taXNlPHsgb2s6IHRydWUgfT4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VQZXJtaXNzaW9uID0gcmVzb2x2ZTsgfSk7XG5cdFx0bGV0IHJlbGVhc2VNb2RlbDogKCh2YWx1ZTogeyByZXNvbHZlZE1vZGVsSWQ6IHN0cmluZzsgcHJvdmlkZXI6IHN0cmluZzsgbGV2ZWw6IG51bWJlcjsgY29zdDogc3RyaW5nOyBzcGVlZDogc3RyaW5nIH0pID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBtb2RlbFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RlbEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgbW9kZWxTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0Y29uc3QgbW9kZWxIb2xkID0gbmV3IFByb21pc2U8eyByZXNvbHZlZE1vZGVsSWQ6IHN0cmluZzsgcHJvdmlkZXI6IHN0cmluZzsgbGV2ZWw6IG51bWJlcjsgY29zdDogc3RyaW5nOyBzcGVlZDogc3RyaW5nIH0+KHJlc29sdmUgPT4ge1xuXHRcdFx0cmVsZWFzZU1vZGVsID0gcmVzb2x2ZTtcblx0XHR9KTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y2F0YWxvZ1Rvb2xOYW1lczogWydiYXNoJ10sXG5cdFx0XHRjYXRhbG9nTW9kZWxJZHM6IFsnJywgJ2dwdC10ZXN0J10sXG5cdFx0XHRtb2RlbFNlbGVjdGVkSW5kZXg6IDAsXG5cdFx0XHRzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQsXG5cdFx0XHRsYXN0UmVhZGluZ1dpZHRoOiAzMDAsXG5cdFx0XHR0dW5lQ29udGV4dFZpZXc6IHVuZGVmaW5lZCBhcyB7IGNsb3NlKCk6IHZvaWQgfSB8IHVuZGVmaW5lZCxcblx0XHRcdG1vcmVDb250ZXh0VmlldzogdW5kZWZpbmVkIGFzIHsgY2xvc2UoKTogdm9pZCB9IHwgdW5kZWZpbmVkLFxuXHRcdFx0ZG9ja1Jvb3QsXG5cdFx0XHRzZW5kQnV0dG9uOiB7IGVuYWJsZWQ6IHRydWUgfSxcblx0XHRcdGdhdGVSb3csXG5cdFx0XHRnYXRlTGFiZWwsXG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAnJyB9LFxuXHRcdFx0cGVybWlzc2lvblNlbGVjdEJveDoge1xuXHRcdFx0XHRzZXRFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pIHsgcGVybWlzc2lvblNlbGVjdC5kaXNhYmxlZCA9ICFlbmFibGVkOyB9LFxuXHRcdFx0XHRzZXRBcmlhTGFiZWwoKSB7IH0sXG5cdFx0XHRcdHNlbGVjdChpbmRleDogbnVtYmVyKSB7IHBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCA9IGluZGV4OyB9LFxuXHRcdFx0fSxcblx0XHRcdGFnZW50U2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNldEVuYWJsZWQoKSB7IH0sXG5cdFx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdFx0c2VsZWN0KCkgeyB9LFxuXHRcdFx0fSxcblx0XHRcdG1vZGVsU2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNldEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikgeyBtb2RlbFNlbGVjdC5kaXNhYmxlZCA9ICFlbmFibGVkOyB9LFxuXHRcdFx0XHRzZXRBcmlhTGFiZWwoKSB7IH0sXG5cdFx0XHRcdHNlbGVjdChpbmRleDogbnVtYmVyKSB7XG5cdFx0XHRcdFx0bW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCA9IGluZGV4O1xuXHRcdFx0XHRcdGhvc3QubW9kZWxTZWxlY3RlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0YWdlbnRDb250YWluZXI6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuXHRcdFx0bW9yZUJ1dHRvbjogeyBlbGVtZW50OiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKSB9LFxuXHRcdFx0dHVuZUJ1dHRvbjogeyBlbGVtZW50OiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKSB9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0dWFDb25uZWN0aW9uOiB7XG5cdFx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmcgfSksXG5cdFx0XHRcdHNldFBlcm1pc3Npb25Nb2RlOiBhc3luYyAocmVxdWVzdDogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZTogc3RyaW5nIH0pID0+IHtcblx0XHRcdFx0XHRwZXJtaXNzaW9uQ2FsbHMucHVzaChyZXF1ZXN0KTtcblx0XHRcdFx0XHRwZXJtaXNzaW9uU3RhcnRlZD8uKCk7XG5cdFx0XHRcdFx0cmV0dXJuIHBlcm1pc3Npb25Ib2xkO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzd2l0Y2hNb2RlbDogYXN5bmMgKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9KSA9PiB7XG5cdFx0XHRcdFx0bW9kZWxDYWxscy5wdXNoKHsgc2Vzc2lvbklkOiByZXF1ZXN0LnNlc3Npb25JZCwgbW9kZWxJZDogcmVxdWVzdC5tb2RlbElkIH0pO1xuXHRcdFx0XHRcdG1vZGVsU3RhcnRlZD8uKCk7XG5cdFx0XHRcdFx0cmV0dXJuIG1vZGVsSG9sZDtcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtbGVmdG92ZXInLFxuXHRcdH07XG5cdFx0Y29uc3QgdHlwZWRIb3N0ID0gaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdHRyeSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQodHlwZWRIb3N0LnVhQ29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25QZXJtaXNzaW9uTW9kZUF2YWlsYWJsZSh0eXBlZEhvc3QpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25Td2l0Y2hNb2RlbEF2YWlsYWJsZSh0eXBlZEhvc3QpLCB0cnVlKTtcblxuXHRcdFx0Y29uc3QgcGVybWlzc2lvbkFwcGx5ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KHR5cGVkSG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGNvbnN0IG1vZGVsQXBwbHkgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KHR5cGVkSG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGF3YWl0IHBlcm1pc3Npb25FbnRlcmVkO1xuXHRcdFx0YXdhaXQgbW9kZWxFbnRlcmVkO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25DYWxscy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsQ2FsbHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCwgMSk7XG5cblx0XHRcdHBhaXJpbmdQZW5kaW5nID0gdHJ1ZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgdHJ1ZSwgJ2xlZnRvdmVyLWxvb2tzLWxpdmUgZml4dHVyZSBtdXN0IGtlZXAgaXNFbmdpbmVDb25uZWN0ZWQoKT09PXRydWUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKHR5cGVkSG9zdC51YUNvbm5lY3Rpb24pLCB0cnVlKTtcblxuXHRcdFx0cmVsZWFzZVBlcm1pc3Npb24hKHsgb2s6IHRydWUgfSk7XG5cdFx0XHRyZWxlYXNlTW9kZWwhKHsgcmVzb2x2ZWRNb2RlbElkOiAnZ3B0LXRlc3QnLCBwcm92aWRlcjogJycsIGxldmVsOiAwLCBjb3N0OiAnJywgc3BlZWQ6ICcnIH0pO1xuXHRcdFx0YXdhaXQgcGVybWlzc2lvbkFwcGx5O1xuXHRcdFx0YXdhaXQgbW9kZWxBcHBseTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCB0cnVlLCAnbGVmdG92ZXItbG9va3MtbGl2ZSBmaXh0dXJlIG11c3Qga2VlcCBpc0VuZ2luZUNvbm5lY3RlZCgpPT09dHJ1ZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQodHlwZWRIb3N0LnVhQ29ubmVjdGlvbiksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QubW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZD8uZ2V0KCdzZXNzLWxlZnRvdmVyJyksICdncHQtdGVzdCcpO1xuXG5cdFx0XHR1cGRhdGVDb21wb3NlclNlc3Npb25TZWxlY3RzRW5hYmxlZCh0eXBlZEhvc3QpO1xuXHRcdFx0dXBkYXRlR2F0ZVJvdyh0eXBlZEhvc3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0LmRpc2FibGVkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QuZ2F0ZVJvdy5oaWRkZW4sIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QuZ2F0ZUxhYmVsLnRleHRDb250ZW50LCBjb252ZXJzYXRpb25MZW5zRG9ja0VuZ2luZU5vdENvbm5lY3RlZCk7XG5cblx0XHRcdHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0XHR1cGRhdGVDb21wb3NlclNlc3Npb25TZWxlY3RzRW5hYmxlZCh0eXBlZEhvc3QpO1xuXHRcdFx0dXBkYXRlR2F0ZVJvdyh0eXBlZEhvc3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3QuZGlzYWJsZWQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5kaXNhYmxlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0LmdhdGVSb3cuaGlkZGVuLCB0cnVlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXIgcGVybWlzc2lvbiBrZWVwcyB0aGUgYWNjZXB0ZWQgdmFsdWUgYW5kIGRvZXMgbm90IHNob3cgYW4gdW5zZW50IG5ld2VyIHRhcmdldCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgcmVsZWFzZVBlcm1pdDogKCh2YWx1ZTogeyBvazogdHJ1ZSB9KSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBwZXJtaXRTdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBwZXJtaXRFbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IHBlcm1pdFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IHBlcm1pdEhvbGQgPSBuZXcgUHJvbWlzZTx7IG9rOiB0cnVlIH0+KHJlc29sdmUgPT4geyByZWxlYXNlUGVybWl0ID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCB1YUNvbm5lY3Rpb24gPSBmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uIGFzIHtcblx0XHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IChyZXF1ZXN0OiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfSkgPT4gUHJvbWlzZTx7IG9rOiB0cnVlIH0+O1xuXHRcdFx0fTtcblx0XHRcdHVhQ29ubmVjdGlvbi5zZXRQZXJtaXNzaW9uTW9kZSA9IGFzeW5jIHJlcXVlc3QgPT4ge1xuXHRcdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25DYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRwZXJtaXRTdGFydGVkPy4oKTtcblx0XHRcdFx0cmV0dXJuIHBlcm1pdEhvbGQ7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcGVybWl0ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGF3YWl0IHBlcm1pdEVudGVyZWQ7XG5cdFx0XHRjb25zdCBhc2sgPSBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGZpeHR1cmUuc2V0UGFpcmluZ1BlbmRpbmcodHJ1ZSk7XG5cdFx0XHRyZWxlYXNlUGVybWl0ISh7IG9rOiB0cnVlIH0pO1xuXHRcdFx0YXdhaXQgcGVybWl0O1xuXHRcdFx0YXdhaXQgYXNrO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25DYWxscy5tYXAoY2FsbCA9PiBjYWxsLm1vZGUpLCBbJ1NFU1NJT05fVE9PTF9QRVJNSVNTSU9OX01PREVfUEVSTUlUJ10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDIpO1xuXHRcdFx0dXBkYXRlQ29tcG9zZXJTZXNzaW9uU2VsZWN0c0VuYWJsZWQoZml4dHVyZS5ob3N0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyIHBlcm1pc3Npb24gZmFpbHVyZSByb2xscyBiYWNrIGFuZCBkb2VzIG5vdCBwYWludCBhIGZhaWx1cmUgbm90aWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZWxlYXNlUGVybWl0OiAoKHZhbHVlOiB7IG9rOiBmYWxzZTsgbWVzc2FnZTogc3RyaW5nIH0pID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IHBlcm1pdFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IHBlcm1pdEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgcGVybWl0U3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgcGVybWl0SG9sZCA9IG5ldyBQcm9taXNlPHsgb2s6IGZhbHNlOyBtZXNzYWdlOiBzdHJpbmcgfT4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VQZXJtaXQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24gYXMge1xuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9KSA9PiBQcm9taXNlPHsgb2s6IGZhbHNlOyBtZXNzYWdlOiBzdHJpbmcgfT47XG5cdFx0XHR9O1xuXHRcdFx0dWFDb25uZWN0aW9uLnNldFBlcm1pc3Npb25Nb2RlID0gYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHBlcm1pdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRyZXR1cm4gcGVybWl0SG9sZDtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBhcHBseSA9IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhd2FpdCBwZXJtaXRFbnRlcmVkO1xuXHRcdFx0Zml4dHVyZS5zZXRQYWlyaW5nUGVuZGluZyh0cnVlKTtcblx0XHRcdHJlbGVhc2VQZXJtaXQhKHsgb2s6IGZhbHNlLCBtZXNzYWdlOiAnZW5naW5lIHJlamVjdGVkIHBlcm1pdCcgfSk7XG5cdFx0XHRhd2FpdCBhcHBseTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QucG9zdEZhaWx1cmVWaXNpYmxlLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVMYWJlbC50ZXh0Q29udGVudCwgJycpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyIG1vZGVsIGtlZXBzIHRoZSBhY2NlcHRlZCB2YWx1ZSBhbmQgZG9lcyBub3Qgc2hvdyBhbiB1bnNlbnQgbmV3ZXIgdGFyZ2V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRjYXRhbG9nTW9kZWxJZHM6IFsnJywgJ2dwdC1hJywgJ2dwdC1iJ10sXG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZWxlYXNlRmlyc3Q6ICgodmFsdWU6IFVuaXZlcnNlQWdlbnRTd2l0Y2hNb2RlbFJlc3VsdCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgZmlyc3RTdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBmaXJzdEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgZmlyc3RTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCBmaXJzdEhvbGQgPSBuZXcgUHJvbWlzZTxVbml2ZXJzZUFnZW50U3dpdGNoTW9kZWxSZXN1bHQ+KHJlc29sdmUgPT4geyByZWxlYXNlRmlyc3QgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb247XG5cdFx0XHR1YUNvbm5lY3Rpb24uc3dpdGNoTW9kZWwgPSBhc3luYyByZXF1ZXN0ID0+IHtcblx0XHRcdFx0Zml4dHVyZS5tb2RlbENhbGxzLnB1c2goeyBzZXNzaW9uSWQ6IHJlcXVlc3Quc2Vzc2lvbklkLCBtb2RlbElkOiByZXF1ZXN0Lm1vZGVsSWQgfSk7XG5cdFx0XHRcdGZpcnN0U3RhcnRlZD8uKCk7XG5cdFx0XHRcdHJldHVybiBmaXJzdEhvbGQ7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgZmlyc3QgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGF3YWl0IGZpcnN0RW50ZXJlZDtcblx0XHRcdGNvbnN0IHNlY29uZCA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0XHRmaXh0dXJlLnNldFBhaXJpbmdQZW5kaW5nKHRydWUpO1xuXHRcdFx0cmVsZWFzZUZpcnN0ISh7IHJlc29sdmVkTW9kZWxJZDogJ2dwdC1hJywgcHJvdmlkZXI6ICcnLCBsZXZlbDogMCwgY29zdDogJycsIHNwZWVkOiAnJyB9KTtcblx0XHRcdGF3YWl0IGZpcnN0O1xuXHRcdFx0YXdhaXQgc2Vjb25kO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5tb2RlbElkKSwgWydncHQtYSddKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbGVmdG92ZXInKSwgJ2dwdC1hJyk7XG5cdFx0XHR1cGRhdGVDb21wb3NlclNlc3Npb25TZWxlY3RzRW5hYmxlZChmaXh0dXJlLmhvc3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyIG1vZGVsIHdpdGggYW4gZW1wdHkgcmVzb2x2ZWQgaWQgcm9sbHMgYmFjayBhbmQgZG9lcyBub3QgcGFpbnQgYSBmYWlsdXJlIG5vdGljZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgcmVsZWFzZU1vZGVsOiAoKHZhbHVlOiBVbml2ZXJzZUFnZW50U3dpdGNoTW9kZWxSZXN1bHQpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IG1vZGVsU3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgbW9kZWxFbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IG1vZGVsU3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgbW9kZWxIb2xkID0gbmV3IFByb21pc2U8VW5pdmVyc2VBZ2VudFN3aXRjaE1vZGVsUmVzdWx0PihyZXNvbHZlID0+IHsgcmVsZWFzZU1vZGVsID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCB1YUNvbm5lY3Rpb24gPSBmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uO1xuXHRcdFx0dWFDb25uZWN0aW9uLnN3aXRjaE1vZGVsID0gYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGZpeHR1cmUubW9kZWxDYWxscy5wdXNoKHsgc2Vzc2lvbklkOiByZXF1ZXN0LnNlc3Npb25JZCwgbW9kZWxJZDogcmVxdWVzdC5tb2RlbElkIH0pO1xuXHRcdFx0XHRtb2RlbFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRyZXR1cm4gbW9kZWxIb2xkO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGFwcGx5ID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMSk7XG5cdFx0XHRhd2FpdCBtb2RlbEVudGVyZWQ7XG5cdFx0XHRmaXh0dXJlLnNldFBhaXJpbmdQZW5kaW5nKHRydWUpO1xuXHRcdFx0cmVsZWFzZU1vZGVsISh7IHJlc29sdmVkTW9kZWxJZDogJycsIHByb3ZpZGVyOiAnJywgbGV2ZWw6IDAsIGNvc3Q6ICcnLCBzcGVlZDogJycgfSk7XG5cdFx0XHRhd2FpdCBhcHBseTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbGVmdG92ZXInKSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QucG9zdEZhaWx1cmVWaXNpYmxlLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVMYWJlbC50ZXh0Q29udGVudCwgJycpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyIHN0YWxlIG1vZGVsIHdpdGggYW4gZW1wdHkgcmVzb2x2ZWQgaWQgcmVzdG9yZXMgdGhlIGxhc3QgYWNjZXB0ZWQgbW9kZWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHtcblx0XHRcdGNhdGFsb2dNb2RlbElkczogWycnLCAnZ3B0LWEnLCAnZ3B0LWInXSxcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogdHJ1ZSxcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0bGV0IHJlbGVhc2VGaXJzdDogKCh2YWx1ZTogVW5pdmVyc2VBZ2VudFN3aXRjaE1vZGVsUmVzdWx0KSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBmaXJzdFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGZpcnN0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBmaXJzdFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IGZpcnN0SG9sZCA9IG5ldyBQcm9taXNlPFVuaXZlcnNlQWdlbnRTd2l0Y2hNb2RlbFJlc3VsdD4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VGaXJzdCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgdWFDb25uZWN0aW9uID0gZml4dHVyZS5ob3N0LnVhQ29ubmVjdGlvbjtcblx0XHRcdHVhQ29ubmVjdGlvbi5zd2l0Y2hNb2RlbCA9IGFzeW5jIHJlcXVlc3QgPT4ge1xuXHRcdFx0XHRmaXh0dXJlLm1vZGVsQ2FsbHMucHVzaCh7IHNlc3Npb25JZDogcmVxdWVzdC5zZXNzaW9uSWQsIG1vZGVsSWQ6IHJlcXVlc3QubW9kZWxJZCB9KTtcblx0XHRcdFx0Zmlyc3RTdGFydGVkPy4oKTtcblx0XHRcdFx0cmV0dXJuIGZpcnN0SG9sZDtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBmaXJzdCA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDEpO1xuXHRcdFx0YXdhaXQgZmlyc3RFbnRlcmVkO1xuXHRcdFx0Y29uc3Qgc2Vjb25kID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRmaXh0dXJlLnNldFBhaXJpbmdQZW5kaW5nKHRydWUpO1xuXHRcdFx0cmVsZWFzZUZpcnN0ISh7IHJlc29sdmVkTW9kZWxJZDogJycsIHByb3ZpZGVyOiAnJywgbGV2ZWw6IDAsIGNvc3Q6ICcnLCBzcGVlZDogJycgfSk7XG5cdFx0XHRhd2FpdCBmaXJzdDtcblx0XHRcdGF3YWl0IHNlY29uZDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbENhbGxzLm1hcChjYWxsID0+IGNhbGwubW9kZWxJZCksIFsnZ3B0LWEnXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZD8uZ2V0KCdzZXNzLWxlZnRvdmVyJyksIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnBvc3RGYWlsdXJlVmlzaWJsZSwgZmFsc2UpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyIHN0YWxlIHBlcm1pc3Npb24gdGhyb3cgcmVzdG9yZXMgdGhlIGxhc3QgYWNjZXB0ZWQgdmFsdWUgYW5kIG5vdCB0aGUgdW5zZW50IHRhcmdldCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgcmVqZWN0UGVybWl0OiAoKGVycm9yOiBFcnJvcikgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgcGVybWl0U3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgcGVybWl0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBwZXJtaXRTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCBwZXJtaXRIb2xkID0gbmV3IFByb21pc2U8bmV2ZXI+KChfcmVzb2x2ZSwgcmVqZWN0KSA9PiB7IHJlamVjdFBlcm1pdCA9IHJlamVjdDsgfSk7XG5cdFx0XHRjb25zdCB1YUNvbm5lY3Rpb24gPSBmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uIGFzIHtcblx0XHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IChyZXF1ZXN0OiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfSkgPT4gUHJvbWlzZTx7IG9rOiB0cnVlIH0+O1xuXHRcdFx0fTtcblx0XHRcdHVhQ29ubmVjdGlvbi5zZXRQZXJtaXNzaW9uTW9kZSA9IGFzeW5jIHJlcXVlc3QgPT4ge1xuXHRcdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25DYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRwZXJtaXRTdGFydGVkPy4oKTtcblx0XHRcdFx0cmV0dXJuIHBlcm1pdEhvbGQ7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcGVybWl0ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGF3YWl0IHBlcm1pdEVudGVyZWQ7XG5cdFx0XHRjb25zdCBhZ2VudCA9IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMSk7XG5cdFx0XHRmaXh0dXJlLnNldFBhaXJpbmdQZW5kaW5nKHRydWUpO1xuXHRcdFx0cmVqZWN0UGVybWl0IShuZXcgRXJyb3IoJ3Blcm1pdCBmYWlsZWQnKSk7XG5cdFx0XHRhd2FpdCBwZXJtaXQ7XG5cdFx0XHRhd2FpdCBhZ2VudDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5tb2RlKSwgWydTRVNTSU9OX1RPT0xfUEVSTUlTU0lPTl9NT0RFX1BFUk1JVCddKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QucG9zdEZhaWx1cmVWaXNpYmxlLCBmYWxzZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbGVmdG92ZXIgc3RhbGUgbW9kZWwgdGhyb3cgcmVzdG9yZXMgdGhlIGxhc3QgYWNjZXB0ZWQgbW9kZWwgYW5kIG5vdCB0aGUgdW5zZW50IHRhcmdldCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3Qoe1xuXHRcdFx0Y2F0YWxvZ01vZGVsSWRzOiBbJycsICdncHQtYScsICdncHQtYiddLFxuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRsZXQgcmVqZWN0Rmlyc3Q6ICgoZXJyb3I6IEVycm9yKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBmaXJzdFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGZpcnN0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBmaXJzdFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGNvbnN0IGZpcnN0SG9sZCA9IG5ldyBQcm9taXNlPG5ldmVyPigoX3Jlc29sdmUsIHJlamVjdCkgPT4geyByZWplY3RGaXJzdCA9IHJlamVjdDsgfSk7XG5cdFx0XHRjb25zdCB1YUNvbm5lY3Rpb24gPSBmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uO1xuXHRcdFx0dWFDb25uZWN0aW9uLnN3aXRjaE1vZGVsID0gYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGZpeHR1cmUubW9kZWxDYWxscy5wdXNoKHsgc2Vzc2lvbklkOiByZXF1ZXN0LnNlc3Npb25JZCwgbW9kZWxJZDogcmVxdWVzdC5tb2RlbElkIH0pO1xuXHRcdFx0XHRmaXJzdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRyZXR1cm4gZmlyc3RIb2xkO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGZpcnN0ID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMSk7XG5cdFx0XHRhd2FpdCBmaXJzdEVudGVyZWQ7XG5cdFx0XHRjb25zdCBzZWNvbmQgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGZpeHR1cmUuc2V0UGFpcmluZ1BlbmRpbmcodHJ1ZSk7XG5cdFx0XHRyZWplY3RGaXJzdCEobmV3IEVycm9yKCdncHQtYSBmYWlsZWQnKSk7XG5cdFx0XHRhd2FpdCBmaXJzdDtcblx0XHRcdGF3YWl0IHNlY29uZDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbENhbGxzLm1hcChjYWxsID0+IGNhbGwubW9kZWxJZCksIFsnZ3B0LWEnXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZD8uZ2V0KCdzZXNzLWxlZnRvdmVyJyksIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnBvc3RGYWlsdXJlVmlzaWJsZSwgZmFsc2UpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIHNlc3Npb24gc2VsZWN0cyBzdGF5IGRpc2FibGVkIGFuZCBkbyBub3Qgd3JpdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHtcblx0XHRcdHBhaXJpbmdQZW5kaW5nOiBmYWxzZSxcblx0XHRcdGVuZ2luZVNlc3Npb25SZWFkeTogZmFsc2UsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lU2Vzc2lvblJlYWR5KCksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25QZXJtaXNzaW9uTW9kZUF2YWlsYWJsZShmaXh0dXJlLmhvc3QpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNTZXNzaW9uU3dpdGNoQWdlbnRBdmFpbGFibGUoZml4dHVyZS5ob3N0KSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzU2Vzc2lvblN3aXRjaE1vZGVsQXZhaWxhYmxlKGZpeHR1cmUuaG9zdCksIGZhbHNlKTtcblx0XHRcdHVwZGF0ZUNvbXBvc2VyU2Vzc2lvblNlbGVjdHNFbmFibGVkKGZpeHR1cmUuaG9zdCk7XG5cdFx0XHR1cGRhdGVTZW5kRW5hYmxlZChmaXh0dXJlLmhvc3QpO1xuXHRcdFx0dXBkYXRlR2F0ZVJvdyhmaXh0dXJlLmhvc3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZW5kQnV0dG9uLmVuYWJsZWQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZ2F0ZVJvdy5oaWRkZW4sIGZhbHNlLCAnS0VFUCBsZWZ0b3ZlciBnYXRlIG11c3Qgbm90IGhpZGUgYXMgbGl2ZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlTGFiZWwudGV4dENvbnRlbnQsIGAke2NvbnZlcnNhdGlvbkxlbnNEb2NrU2Vzc2lvblVuYXZhaWxhYmxlfSBcdTIwMTQgJHtjb252ZXJzYXRpb25MZW5zRG9ja1Nlc3Npb25VbmF2YWlsYWJsZVJlYXNvbn1gKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ3RydWUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmFnZW50U2VsZWN0LmRpc2FibGVkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmFnZW50U2VsZWN0LmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cblx0XHRcdGF3YWl0IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhd2FpdCBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbENhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAwKTtcblxuXHRcdFx0Zml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LmRpc2FibGVkID0gZmFsc2U7XG5cdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3QucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuXHRcdFx0Zml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsICdmYWxzZScpO1xuXHRcdFx0Zml4dHVyZS5hZ2VudFNlbGVjdC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0Zml4dHVyZS5hZ2VudFNlbGVjdC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG5cdFx0XHRmaXh0dXJlLmFnZW50U2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsICdmYWxzZScpO1xuXHRcdFx0Zml4dHVyZS5tb2RlbFNlbGVjdC5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0Zml4dHVyZS5tb2RlbFNlbGVjdC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG5cdFx0XHRmaXh0dXJlLm1vZGVsU2VsZWN0LnNldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcsICdmYWxzZScpO1xuXHRcdFx0Zml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXggPSAyO1xuXHRcdFx0Zml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4ID0gMTtcblx0XHRcdGF3YWl0IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhd2FpdCBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbENhbGxzLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAwKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgbGl2ZSBzZXNzaW9uIHNlbGVjdHMgc3RpbGwgd3JpdGUgd2hlbiBlbmdpbmUgc2Vzc2lvbiBpcyByZWFkeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3Qoe1xuXHRcdFx0cGFpcmluZ1BlbmRpbmc6IGZhbHNlLFxuXHRcdFx0ZW5naW5lU2Vzc2lvblJlYWR5OiB0cnVlLFxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZVNlc3Npb25SZWFkeSgpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25QZXJtaXNzaW9uTW9kZUF2YWlsYWJsZShmaXh0dXJlLmhvc3QpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25Td2l0Y2hBZ2VudEF2YWlsYWJsZShmaXh0dXJlLmhvc3QpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1Nlc3Npb25Td2l0Y2hNb2RlbEF2YWlsYWJsZShmaXh0dXJlLmhvc3QpLCB0cnVlKTtcblx0XHRcdHVwZGF0ZUNvbXBvc2VyU2Vzc2lvblNlbGVjdHNFbmFibGVkKGZpeHR1cmUuaG9zdCk7XG5cdFx0XHR1cGRhdGVTZW5kRW5hYmxlZChmaXh0dXJlLmhvc3QpO1xuXHRcdFx0dXBkYXRlR2F0ZVJvdyhmaXh0dXJlLmhvc3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZW5kQnV0dG9uLmVuYWJsZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlUm93LmhpZGRlbiwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LmRpc2FibGVkLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5hZ2VudFNlbGVjdC5kaXNhYmxlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3QuZGlzYWJsZWQsIGZhbHNlKTtcblxuXHRcdFx0YXdhaXQgYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAyKTtcblx0XHRcdGF3YWl0IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDEpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25DYWxscywgW3sgc2Vzc2lvbklkOiAnc2Vzcy1sZWZ0b3ZlcicsIG1vZGU6ICdTRVNTSU9OX1RPT0xfUEVSTUlTU0lPTl9NT0RFX1BFUk1JVCcgfV0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsQ2FsbHMsIFt7IHNlc3Npb25JZDogJ3Nlc3MtbGVmdG92ZXInLCBtb2RlbElkOiAnZ3B0LXRlc3QnIH1dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2FwcGx5U2Vzc2lvbk1vZGVsSW5kZXggZmFpbHVyZSBhZnRlciByZWJpbmQgcmVzdG9yZXMgb25seSB0aGUgb3JpZ2luYXRpbmcgc2Vzc2lvbiBjZWxsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGNhdGFsb2dNb2RlbElkcyA9IFsnJywgJ2dwdC1hJywgJ2dwdC1iJywgJ2dwdC1jJ107XG5cdFx0Y29uc3QgbW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KFtcblx0XHRcdFsnc2Vzcy1hJywgJ2dwdC1hJ10sXG5cdFx0XHRbJ3Nlc3MtYicsICdncHQtYiddLFxuXHRcdF0pO1xuXHRcdGxldCBib3VuZFNlc3Npb25JZCA9ICdzZXNzLWEnO1xuXHRcdGxldCByZWxlYXNlTW9kZWw6ICgob3V0Y29tZTogRXJyb3IpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBtb2RlbFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RlbEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgbW9kZWxTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0Y29uc3QgbW9kZWxTZWxlY3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzZWxlY3QnKTtcblx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbignTm8gbW9kZWwnLCAnJykpO1xuXHRcdG1vZGVsU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdncHQtYScsICdncHQtYScpKTtcblx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbignZ3B0LWInLCAnZ3B0LWInKSk7XG5cdFx0bW9kZWxTZWxlY3QuYWRkKG5ldyBPcHRpb24oJ2dwdC1jJywgJ2dwdC1jJykpO1xuXHRcdGNvbnN0IGdhdGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRnYXRlUm93LmhpZGRlbiA9IHRydWU7XG5cdFx0Y29uc3QgZ2F0ZUxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjYXRhbG9nTW9kZWxJZHMsXG5cdFx0XHRtb2RlbFNlbGVjdGVkSW5kZXg6IDEsXG5cdFx0XHRtb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkLFxuXHRcdFx0c2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkOiBuZXcgTWFwPHN0cmluZywgeyBhZ2VudEluZGV4OiBudW1iZXI7IHBlcm1pc3Npb25JbmRleDogbnVtYmVyIH0+KCksXG5cdFx0XHRwb3N0RmFpbHVyZVZpc2libGU6IGZhbHNlLFxuXHRcdFx0Z2F0ZVJvdyxcblx0XHRcdGdhdGVMYWJlbCxcblx0XHRcdHNlbmRCdXR0b246IHsgZW5hYmxlZDogdHJ1ZSB9LFxuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdjb21wb3NlJyBhcyBjb25zdCxcblx0XHRcdGRvY2tUZXh0YXJlYTogeyB2YWx1ZTogJycgfSxcblx0XHRcdHBlcm1pc3Npb25TZWxlY3RCb3g6IHsgc2VsZWN0KCkgeyB9IH0sXG5cdFx0XHRhZ2VudFNlbGVjdEJveDogeyBzZWxlY3QoKSB7IH0gfSxcblx0XHRcdG1vZGVsU2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNlbGVjdChpbmRleDogbnVtYmVyKSB7XG5cdFx0XHRcdFx0bW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCA9IGluZGV4O1xuXHRcdFx0XHRcdGhvc3QubW9kZWxTZWxlY3RlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdFx0c3dpdGNoTW9kZWw6ICgpID0+IG5ldyBQcm9taXNlKChfcmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRcdFx0bW9kZWxTdGFydGVkPy4oKTtcblx0XHRcdFx0XHRyZWxlYXNlTW9kZWwgPSByZWplY3Q7XG5cdFx0XHRcdH0pLFxuXHRcdFx0fSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiBib3VuZFNlc3Npb25JZCxcblx0XHRcdHVwZGF0ZVNlbmRFbmFibGVkKCkgeyB9LFxuXHRcdH07XG5cdFx0Y29uc3QgdHlwZWRIb3N0ID0gaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBtb2RlbEFwcGx5ID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleCh0eXBlZEhvc3QsICdzZXNzLWEnLCAzKTtcblx0XHRcdGF3YWl0IG1vZGVsRW50ZXJlZDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAzKTtcblxuXHRcdFx0Ym91bmRTZXNzaW9uSWQgPSAnc2Vzcy1iJztcblx0XHRcdHR5cGVkSG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSAyO1xuXHRcdFx0bW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCA9IDI7XG5cdFx0XHRyZWxlYXNlTW9kZWwhKG5ldyBFcnJvcignZW5naW5lIHJlamVjdGVkIG1vZGVsJykpO1xuXHRcdFx0YXdhaXQgbW9kZWxBcHBseTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvdW5kU2Vzc2lvbklkLCAnc2Vzcy1iJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRIb3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtYScpLCAnZ3B0LWEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkLmdldCgnc2Vzcy1iJyksICdncHQtYicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnYXRlUm93LmhpZGRlbiwgdHJ1ZSk7XG5cblx0XHRcdHN5bmNTZXNzaW9uQ29uZmlnU2VsZWN0cyh0eXBlZEhvc3QsICdzZXNzLWInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEhvc3QuY2F0YWxvZ01vZGVsSWRzW3R5cGVkSG9zdC5tb2RlbFNlbGVjdGVkSW5kZXhdID8/ICcnLCAnZ3B0LWInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkLmdldCgnc2Vzcy1hJyksICdncHQtYScpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzdG9yZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRmdW5jdGlvbiBvdmVybGFwcGluZ01vZGVsSG9zdCgpOiB7XG5cdFx0aG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3Q7XG5cdFx0bW9kZWxTZWxlY3Q6IEhUTUxTZWxlY3RFbGVtZW50O1xuXHRcdG1vZGVsQ2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9W107XG5cdFx0cG9zdGVkOiBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2VbXTtcblx0XHRhcm0ocmVzcG9uZGVyOiAobW9kZWxJZDogc3RyaW5nLCBjYWxsOiBudW1iZXIpID0+IFByb21pc2U8eyByZXNvbHZlZE1vZGVsSWQ6IHN0cmluZzsgcHJvdmlkZXI6IHN0cmluZzsgbGV2ZWw6IG51bWJlcjsgY29zdDogc3RyaW5nOyBzcGVlZDogc3RyaW5nIH0+KTogdm9pZDtcblx0fSB7XG5cdFx0Y29uc3QgY2F0YWxvZ01vZGVsSWRzID0gWycnLCAnZ3B0LWEnLCAnZ3B0LWInXTtcblx0XHRjb25zdCBtb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRjb25zdCBtb2RlbENhbGxzOiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlbElkOiBzdHJpbmcgfVtdID0gW107XG5cdFx0Y29uc3QgcG9zdGVkOiBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2VbXSA9IFtdO1xuXHRcdGNvbnN0IG1vZGVsU2VsZWN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VsZWN0Jyk7XG5cdFx0bW9kZWxTZWxlY3QuYWRkKG5ldyBPcHRpb24oJ05vIG1vZGVsJywgJycpKTtcblx0XHRtb2RlbFNlbGVjdC5hZGQobmV3IE9wdGlvbignZ3B0LWEnLCAnZ3B0LWEnKSk7XG5cdFx0bW9kZWxTZWxlY3QuYWRkKG5ldyBPcHRpb24oJ2dwdC1iJywgJ2dwdC1iJykpO1xuXHRcdGNvbnN0IGdhdGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRnYXRlUm93LmhpZGRlbiA9IHRydWU7XG5cdFx0Y29uc3QgZ2F0ZUxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGxldCByZXNwb25kOiAoKG1vZGVsSWQ6IHN0cmluZywgY2FsbDogbnVtYmVyKSA9PiBQcm9taXNlPHsgcmVzb2x2ZWRNb2RlbElkOiBzdHJpbmc7IHByb3ZpZGVyOiBzdHJpbmc7IGxldmVsOiBudW1iZXI7IGNvc3Q6IHN0cmluZzsgc3BlZWQ6IHN0cmluZyB9PikgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNhdGFsb2dNb2RlbElkcyxcblx0XHRcdG1vZGVsU2VsZWN0ZWRJbmRleDogMCxcblx0XHRcdG1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQsXG5cdFx0XHRzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQ6IG5ldyBNYXA8c3RyaW5nLCB7IGFnZW50SW5kZXg6IG51bWJlcjsgcGVybWlzc2lvbkluZGV4OiBudW1iZXIgfT4oKSxcblx0XHRcdHBvc3RGYWlsdXJlVmlzaWJsZTogZmFsc2UsXG5cdFx0XHRzdWJtaXRJbkZsaWdodDogZmFsc2UsXG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0ZHJhZnRzOiBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAnaGVsbG8nIH0sXG5cdFx0XHRzZW5kQnV0dG9uOiB7IGVuYWJsZWQ6IHRydWUgfSxcblx0XHRcdGdhdGVSb3csXG5cdFx0XHRnYXRlTGFiZWwsXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogeyBnZXRWYWx1ZTogKCkgPT4gZmFsc2UgfSxcblx0XHRcdHBlcm1pc3Npb25TZWxlY3RCb3g6IHsgc2VsZWN0KCkgeyB9IH0sXG5cdFx0XHRhZ2VudFNlbGVjdEJveDogeyBzZWxlY3QoKSB7IH0gfSxcblx0XHRcdG1vZGVsU2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNlbGVjdChpbmRleDogbnVtYmVyKSB7XG5cdFx0XHRcdFx0bW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCA9IGluZGV4O1xuXHRcdFx0XHRcdGhvc3QubW9kZWxTZWxlY3RlZEluZGV4ID0gaW5kZXg7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdFx0c3dpdGNoTW9kZWw6IChyZXF1ZXN0OiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlbElkOiBzdHJpbmcgfSkgPT4ge1xuXHRcdFx0XHRcdG1vZGVsQ2FsbHMucHVzaCh7IHNlc3Npb25JZDogcmVxdWVzdC5zZXNzaW9uSWQsIG1vZGVsSWQ6IHJlcXVlc3QubW9kZWxJZCB9KTtcblx0XHRcdFx0XHRpZiAoIXJlc3BvbmQpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignc3dpdGNoTW9kZWwgcmVzcG9uZGVyIHdhcyBub3QgYXJtZWQnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3BvbmQocmVxdWVzdC5tb2RlbElkLCBtb2RlbENhbGxzLmxlbmd0aCk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2Vzc2lvblZpZXdMZWFzZToge1xuXHRcdFx0XHRwb3N0OiBhc3luYyAobXNnOiBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2UpID0+IHtcblx0XHRcdFx0XHRwb3N0ZWQucHVzaChtc2cpO1xuXHRcdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlLCBjb3JyZWxhdGlvbjogeyBpZDogJ2MxJyB9IH07XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLW1vZGVsJyxcblx0XHRcdHJlc2V0SW5wdXRIaXN0b3J5QnJvd3NlKCkgeyB9LFxuXHRcdFx0dXBkYXRlU2VuZEVuYWJsZWQoKSB7IH0sXG5cdFx0XHR1cGRhdGVDb252ZXJzYXRpb25QaGFzZSgpIHsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZSgpIHsgfSxcblx0XHR9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRob3N0OiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3QsXG5cdFx0XHRtb2RlbFNlbGVjdCxcblx0XHRcdG1vZGVsQ2FsbHMsXG5cdFx0XHRwb3N0ZWQsXG5cdFx0XHRhcm0ocmVzcG9uZGVyKSB7XG5cdFx0XHRcdHJlc3BvbmQgPSByZXNwb25kZXI7XG5cdFx0XHR9LFxuXHRcdH07XG5cdH1cblxuXHR0ZXN0KCdvdmVybGFwcGluZyBzd2l0Y2hNb2RlbCBmYWlsdXJlIGRvZXMgbm90IHJlc3RvcmUgdGhlIGRyb3Bkb3duIHRvIHRoZSBlYXJsaWVyIGluZGV4JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBvdmVybGFwcGluZ01vZGVsSG9zdCgpO1xuXHRcdGxldCByZWxlYXNlRmlyc3Q6ICgob3V0Y29tZTogRXJyb3IpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBmaXJzdFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBmaXJzdEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgZmlyc3RTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0Y29uc3QgZmlyc3RIb2xkID0gbmV3IFByb21pc2U8bmV2ZXI+KChfcmVzb2x2ZSwgcmVqZWN0KSA9PiB7IHJlbGVhc2VGaXJzdCA9IHJlamVjdDsgfSk7XG5cdFx0bGV0IHJlbGVhc2VTZWNvbmQ6ICgodmFsdWU6IHsgcmVzb2x2ZWRNb2RlbElkOiBzdHJpbmcgfSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHNlY29uZFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzZWNvbmRFbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IHNlY29uZFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBzZWNvbmRIb2xkID0gbmV3IFByb21pc2U8eyByZXNvbHZlZE1vZGVsSWQ6IHN0cmluZyB9PihyZXNvbHZlID0+IHsgcmVsZWFzZVNlY29uZCA9IHJlc29sdmU7IH0pO1xuXHRcdGZpeHR1cmUuYXJtKChtb2RlbElkLCBjYWxsKSA9PiB7XG5cdFx0XHRpZiAoY2FsbCA9PT0gMSkge1xuXHRcdFx0XHRmaXJzdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRyZXR1cm4gZmlyc3RIb2xkO1xuXHRcdFx0fVxuXHRcdFx0c2Vjb25kU3RhcnRlZD8uKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxJZCwgJ2dwdC1iJyk7XG5cdFx0XHRyZXR1cm4gc2Vjb25kSG9sZC50aGVuKHZhbHVlID0+ICh7IC4uLnZhbHVlLCBwcm92aWRlcjogJycsIGxldmVsOiAwLCBjb3N0OiAnJywgc3BlZWQ6ICcnIH0pKTtcblx0XHR9KTtcblx0XHRjb25zdCBmaXJzdCA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1tb2RlbCcsIDEpO1xuXHRcdGF3YWl0IGZpcnN0RW50ZXJlZDtcblx0XHRjb25zdCBzZWNvbmQgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbW9kZWwnLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRyZWxlYXNlRmlyc3QhKG5ldyBFcnJvcignc3RhbGUgbW9kZWwgZmFpbGVkJykpO1xuXHRcdGF3YWl0IHNlY29uZEVudGVyZWQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbW9kZWwnKSwgJ2dwdC1hJyk7XG5cdFx0cmVsZWFzZVNlY29uZCEoeyByZXNvbHZlZE1vZGVsSWQ6ICdncHQtYicgfSk7XG5cdFx0YXdhaXQgZmlyc3Q7XG5cdFx0YXdhaXQgc2Vjb25kO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxTZWxlY3RlZEluZGV4LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0Lm1vZGVsUHJvZmlsZUlkQnlTZXNzaW9uSWQ/LmdldCgnc2Vzcy1tb2RlbCcpLCAnZ3B0LWInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxDYWxscy5tYXAoY2FsbCA9PiBjYWxsLm1vZGVsSWQpLCBbJ2dwdC1hJywgJ2dwdC1iJ10pO1xuXHRcdGF3YWl0IHN1Ym1pdERyYWZ0KGZpeHR1cmUuaG9zdCBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCBbe1xuXHRcdFx0a2luZDogJ3N1Ym1pdElucHV0Jyxcblx0XHRcdHRleHQ6ICdoZWxsbycsXG5cdFx0XHRtb2RlbFByb2ZpbGVJZDogJ2dwdC1iJyxcblx0XHR9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ292ZXJsYXBwaW5nIHN3aXRjaE1vZGVsIHN1Y2Nlc3MgZG9lcyBub3Qga2VlcCB0aGUgZWFybGllciBtb2RlbElkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBvdmVybGFwcGluZ01vZGVsSG9zdCgpO1xuXHRcdGxldCByZWxlYXNlRmlyc3Q6ICgodmFsdWU6IHsgcmVzb2x2ZWRNb2RlbElkOiBzdHJpbmcgfSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGZpcnN0U3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGZpcnN0RW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBmaXJzdFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBmaXJzdEhvbGQgPSBuZXcgUHJvbWlzZTx7IHJlc29sdmVkTW9kZWxJZDogc3RyaW5nIH0+KHJlc29sdmUgPT4geyByZWxlYXNlRmlyc3QgPSByZXNvbHZlOyB9KTtcblx0XHRmaXh0dXJlLmFybSgobW9kZWxJZCwgY2FsbCkgPT4ge1xuXHRcdFx0aWYgKGNhbGwgPT09IDEpIHtcblx0XHRcdFx0Zmlyc3RTdGFydGVkPy4oKTtcblx0XHRcdFx0cmV0dXJuIGZpcnN0SG9sZC50aGVuKHZhbHVlID0+ICh7IC4uLnZhbHVlLCBwcm92aWRlcjogJycsIGxldmVsOiAwLCBjb3N0OiAnJywgc3BlZWQ6ICcnIH0pKTtcblx0XHRcdH1cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbElkLCAnZ3B0LWInKTtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoeyByZXNvbHZlZE1vZGVsSWQ6IG1vZGVsSWQsIHByb3ZpZGVyOiAnJywgbGV2ZWw6IDAsIGNvc3Q6ICcnLCBzcGVlZDogJycgfSk7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZmlyc3QgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbW9kZWwnLCAxKTtcblx0XHRhd2FpdCBmaXJzdEVudGVyZWQ7XG5cdFx0Y29uc3Qgc2Vjb25kID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLW1vZGVsJywgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0cmVsZWFzZUZpcnN0ISh7IHJlc29sdmVkTW9kZWxJZDogJ2dwdC1hJyB9KTtcblx0XHRhd2FpdCBmaXJzdDtcblx0XHRhd2FpdCBzZWNvbmQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbW9kZWwnKSwgJ2dwdC1iJyk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPy5nZXQoJ3Nlc3MtbW9kZWwnKSwgJ2dwdC1hJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5tb2RlbElkKSwgWydncHQtYScsICdncHQtYiddKTtcblx0XHRhd2FpdCBzdWJtaXREcmFmdChmaXh0dXJlLmhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLnBvc3RlZCwgW3tcblx0XHRcdGtpbmQ6ICdzdWJtaXRJbnB1dCcsXG5cdFx0XHR0ZXh0OiAnaGVsbG8nLFxuXHRcdFx0bW9kZWxQcm9maWxlSWQ6ICdncHQtYicsXG5cdFx0fV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzdWJtaXREcmFmdCBvbWl0cyBtb2RlbFByb2ZpbGVJZCB3aGVuIHRoZSBzZXR0bGVkIG1vZGVsIGluZGV4IGlzIDAnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG92ZXJsYXBwaW5nTW9kZWxIb3N0KCk7XG5cdFx0bGV0IHJlbGVhc2VNb2RlbDogKChvdXRjb21lOiBFcnJvcikgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IG1vZGVsU3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IG1vZGVsRW50ZXJlZCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyBtb2RlbFN0YXJ0ZWQgPSByZXNvbHZlOyB9KTtcblx0XHRjb25zdCBtb2RlbEhvbGQgPSBuZXcgUHJvbWlzZTxuZXZlcj4oKF9yZXNvbHZlLCByZWplY3QpID0+IHsgcmVsZWFzZU1vZGVsID0gcmVqZWN0OyB9KTtcblx0XHRmaXh0dXJlLmFybSgoKSA9PiB7XG5cdFx0XHRtb2RlbFN0YXJ0ZWQ/LigpO1xuXHRcdFx0cmV0dXJuIG1vZGVsSG9sZDtcblx0XHR9KTtcblx0XHRjb25zdCBhcHBseSA9IGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1tb2RlbCcsIDEpO1xuXHRcdGF3YWl0IG1vZGVsRW50ZXJlZDtcblx0XHRyZWxlYXNlTW9kZWwhKG5ldyBFcnJvcignbW9kZWwgcmVqZWN0ZWQnKSk7XG5cdFx0YXdhaXQgYXBwbHk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZD8uZ2V0KCdzZXNzLW1vZGVsJyksIHVuZGVmaW5lZCk7XG5cdFx0YXdhaXQgc3VibWl0RHJhZnQoZml4dHVyZS5ob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wb3N0ZWQsIFt7IGtpbmQ6ICdzdWJtaXRJbnB1dCcsIHRleHQ6ICdoZWxsbycgfV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzZWxlY3RpbmcgdGhlIGVtcHR5IG1vZGVsIGRvZXMgbm90IHNlbmQgc3dpdGNoTW9kZWwgYW5kIGEgc3RhbGUgZmFpbHVyZSBkb2VzIG5vdCBmb3JjZSBpbmRleCAwJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBvdmVybGFwcGluZ01vZGVsSG9zdCgpO1xuXHRcdGxldCByZWxlYXNlTW9kZWw6ICgob3V0Y29tZTogRXJyb3IpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBtb2RlbFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RlbEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgbW9kZWxTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0Y29uc3QgbW9kZWxIb2xkID0gbmV3IFByb21pc2U8bmV2ZXI+KChfcmVzb2x2ZSwgcmVqZWN0KSA9PiB7IHJlbGVhc2VNb2RlbCA9IHJlamVjdDsgfSk7XG5cdFx0Zml4dHVyZS5hcm0oKCkgPT4ge1xuXHRcdFx0bW9kZWxTdGFydGVkPy4oKTtcblx0XHRcdHJldHVybiBtb2RlbEhvbGQ7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZmlyc3QgPSBhcHBseVNlc3Npb25Nb2RlbEluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbW9kZWwnLCAxKTtcblx0XHRhd2FpdCBtb2RlbEVudGVyZWQ7XG5cdFx0Y29uc3Qgc2Vjb25kID0gYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLW1vZGVsJywgMik7XG5cdFx0YXdhaXQgYXBwbHlTZXNzaW9uTW9kZWxJbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLW1vZGVsJywgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5tb2RlbElkKSwgWydncHQtYSddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5tb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAyKTtcblx0XHRyZWxlYXNlTW9kZWwhKG5ldyBFcnJvcignc3RhbGUgbW9kZWwgZmFpbGVkJykpO1xuXHRcdGF3YWl0IGZpcnN0O1xuXHRcdGF3YWl0IHNlY29uZDtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUubW9kZWxDYWxscy5tYXAoY2FsbCA9PiBjYWxsLm1vZGVsSWQpLCBbJ2dwdC1hJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLm1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QubW9kZWxQcm9maWxlSWRCeVNlc3Npb25JZD8uZ2V0KCdzZXNzLW1vZGVsJyksICdncHQtYScpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBwZXJtaXNzaW9uQXBwbHlCb3VuZFNlc3Npb25Ib3N0KCk6IHtcblx0XHRob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdDtcblx0XHRwZXJtaXNzaW9uU2VsZWN0OiBIVE1MU2VsZWN0RWxlbWVudDtcblx0XHRwZXJtaXNzaW9uRW50ZXJlZDogUHJvbWlzZTx2b2lkPjtcblx0XHRzZXRQYWlyaW5nUGVuZGluZyhwZW5kaW5nOiBib29sZWFuKTogdm9pZDtcblx0XHRyZWxlYXNlUGVybWlzc2lvbihvdXRjb21lOiB7IG9rOiBib29sZWFuOyBtZXNzYWdlPzogc3RyaW5nIH0gfCBFcnJvcik6IHZvaWQ7XG5cdFx0YmluZEJXaXRoU3luY2VkU2VsZWN0KCk6IHZvaWQ7XG5cdFx0ZGlzcG9zZSgpOiB2b2lkO1xuXHR9IHtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBwZXJtaXNzaW9uU2VsZWN0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2VsZWN0Jyk7XG5cdFx0cGVybWlzc2lvblNlbGVjdC5hZGQobmV3IE9wdGlvbignQXNrJywgJzAnKSk7XG5cdFx0cGVybWlzc2lvblNlbGVjdC5hZGQobmV3IE9wdGlvbignQWdlbnQnLCAnMScpKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmFkZChuZXcgT3B0aW9uKCdQZXJtaXQnLCAnMicpKTtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXggPSAwO1xuXHRcdGNvbnN0IGdhdGVSb3cgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRnYXRlUm93LmhpZGRlbiA9IHRydWU7XG5cdFx0Y29uc3QgZ2F0ZUxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuXHRcdGNvbnN0IHNlc3Npb25Db25maWdCeVNlc3Npb25JZCA9IG5ldyBNYXA8c3RyaW5nLCB7IGFnZW50SW5kZXg6IG51bWJlcjsgcGVybWlzc2lvbkluZGV4OiBudW1iZXIgfT4oW1xuXHRcdFx0WydzZXNzLUEnLCB7IGFnZW50SW5kZXg6IDAsIHBlcm1pc3Npb25JbmRleDogMCB9XSxcblx0XHRcdFsnc2Vzcy1CJywgeyBhZ2VudEluZGV4OiAwLCBwZXJtaXNzaW9uSW5kZXg6IDEgfV0sXG5cdFx0XSk7XG5cdFx0bGV0IGJvdW5kU2Vzc2lvbklkID0gJ3Nlc3MtQSc7XG5cdFx0bGV0IHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0bGV0IHJlbGVhc2VQZXJtaXNzaW9uITogKG91dGNvbWU6IHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfSB8IEVycm9yKSA9PiB2b2lkO1xuXHRcdGxldCBwZXJtaXNzaW9uU3RhcnRlZDogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25FbnRlcmVkID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7IHBlcm1pc3Npb25TdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0Y29uc3QgcGVybWlzc2lvbkhvbGQgPSBuZXcgUHJvbWlzZTx7IG9rOiBib29sZWFuOyBtZXNzYWdlPzogc3RyaW5nIH0+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHJlbGVhc2VQZXJtaXNzaW9uID0gb3V0Y29tZSA9PiB7XG5cdFx0XHRcdGlmIChvdXRjb21lIGluc3RhbmNlb2YgRXJyb3IpIHtcblx0XHRcdFx0XHRyZWplY3Qob3V0Y29tZSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc29sdmUob3V0Y29tZSk7XG5cdFx0XHR9O1xuXHRcdH0pO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRzZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQsXG5cdFx0XHRwb3N0RmFpbHVyZVZpc2libGU6IGZhbHNlLFxuXHRcdFx0c2VuZEZhaWx1cmVUaW1lb3V0OiB1bmRlZmluZWQgYXMgUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCB1bmRlZmluZWQsXG5cdFx0XHRwZXJtaXNzaW9uU2VsZWN0Qm94OiB7XG5cdFx0XHRcdHNldEVuYWJsZWQoKSB7IH0sXG5cdFx0XHRcdHNldEFyaWFMYWJlbCgpIHsgfSxcblx0XHRcdFx0c2VsZWN0KGluZGV4OiBudW1iZXIpIHsgcGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4ID0gaW5kZXg7IH0sXG5cdFx0XHR9LFxuXHRcdFx0Z2F0ZVJvdyxcblx0XHRcdGdhdGVMYWJlbCxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZVNlc3Npb25SZWFkeTogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZyB9KSxcblx0XHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRwZXJtaXNzaW9uU3RhcnRlZD8uKCk7XG5cdFx0XHRcdFx0cmV0dXJuIHBlcm1pc3Npb25Ib2xkO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiBib3VuZFNlc3Npb25JZCxcblx0XHR9O1xuXHRcdHJldHVybiB7XG5cdFx0XHRob3N0OiBob3N0IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZUhvc3QsXG5cdFx0XHRwZXJtaXNzaW9uU2VsZWN0LFxuXHRcdFx0cGVybWlzc2lvbkVudGVyZWQsXG5cdFx0XHRzZXRQYWlyaW5nUGVuZGluZyhwZW5kaW5nOiBib29sZWFuKSB7XG5cdFx0XHRcdHBhaXJpbmdQZW5kaW5nID0gcGVuZGluZztcblx0XHRcdH0sXG5cdFx0XHRyZWxlYXNlUGVybWlzc2lvbixcblx0XHRcdGJpbmRCV2l0aFN5bmNlZFNlbGVjdCgpIHtcblx0XHRcdFx0Ym91bmRTZXNzaW9uSWQgPSAnc2Vzcy1CJztcblx0XHRcdFx0cGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4ID0gc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1CJykhLnBlcm1pc3Npb25JbmRleDtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiBzdG9yZS5kaXNwb3NlKCksXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2luLWZsaWdodCBwZXJtaXNzaW9uIGZhaWwgYWZ0ZXIgc3dpdGNoIHRvIEIgZG9lcyBub3Qgcm9sbCBiYWNrIEIgc2VsZWN0IG9yIHBhaW50IEIgbm90aWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBwZXJtaXNzaW9uQXBwbHlCb3VuZFNlc3Npb25Ib3N0KCk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGFwcGx5ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtQScsIDIpO1xuXHRcdFx0YXdhaXQgZml4dHVyZS5wZXJtaXNzaW9uRW50ZXJlZDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1BJyk/LnBlcm1pc3Npb25JbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDIpO1xuXHRcdFx0Zml4dHVyZS5iaW5kQldpdGhTeW5jZWRTZWxlY3QoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRmaXh0dXJlLnJlbGVhc2VQZXJtaXNzaW9uKHsgb2s6IGZhbHNlLCBtZXNzYWdlOiAnZW5naW5lIHJlamVjdGVkIHBlcm1pdCcgfSk7XG5cdFx0XHRhd2FpdCBhcHBseTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1BJyk/LnBlcm1pc3Npb25JbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtQicpPy5wZXJtaXNzaW9uSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZ2F0ZVJvdy5oaWRkZW4sIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlTGFiZWwudGV4dENvbnRlbnQsICcnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QucG9zdEZhaWx1cmVWaXNpYmxlLCBmYWxzZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnaW4tZmxpZ2h0IHBlcm1pc3Npb24gdGhyb3cgYWZ0ZXIgc3dpdGNoIHRvIEIgZG9lcyBub3Qgcm9sbCBiYWNrIEIgc2VsZWN0IG9yIHBhaW50IEIgbm90aWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBwZXJtaXNzaW9uQXBwbHlCb3VuZFNlc3Npb25Ib3N0KCk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGFwcGx5ID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtQScsIDIpO1xuXHRcdFx0YXdhaXQgZml4dHVyZS5wZXJtaXNzaW9uRW50ZXJlZDtcblx0XHRcdGZpeHR1cmUuYmluZEJXaXRoU3luY2VkU2VsZWN0KCk7XG5cdFx0XHRmaXh0dXJlLnJlbGVhc2VQZXJtaXNzaW9uKG5ldyBFcnJvcignc2V0UGVybWlzc2lvbk1vZGUgYm9vbScpKTtcblx0XHRcdGF3YWl0IGFwcGx5O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLUEnKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1CJyk/LnBlcm1pc3Npb25JbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlUm93LmhpZGRlbiwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LmdhdGVMYWJlbC50ZXh0Q29udGVudCwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIGZhbHNlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdpbi1mbGlnaHQgbGVmdG92ZXIgcGVybWlzc2lvbiBhZnRlciBzd2l0Y2ggdG8gQiBrZWVwcyBBIGFjY2VwdGVkIHZhbHVlIGFuZCBkb2VzIG5vdCByb2xsIGJhY2sgQiBzZWxlY3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IHBlcm1pc3Npb25BcHBseUJvdW5kU2Vzc2lvbkhvc3QoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYXBwbHkgPSBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1BJywgMik7XG5cdFx0XHRhd2FpdCBmaXh0dXJlLnBlcm1pc3Npb25FbnRlcmVkO1xuXHRcdFx0Zml4dHVyZS5iaW5kQldpdGhTeW5jZWRTZWxlY3QoKTtcblx0XHRcdGZpeHR1cmUuc2V0UGFpcmluZ1BlbmRpbmcodHJ1ZSk7XG5cdFx0XHRmaXh0dXJlLnJlbGVhc2VQZXJtaXNzaW9uKHsgb2s6IHRydWUgfSk7XG5cdFx0XHRhd2FpdCBhcHBseTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1BJyk/LnBlcm1pc3Npb25JbmRleCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtQicpPy5wZXJtaXNzaW9uSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZ2F0ZVJvdy5oaWRkZW4sIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlTGFiZWwudGV4dENvbnRlbnQsICcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdwZXJtaXNzaW9uIGFwcGx5IGZvciBBIHdoaWxlIGJvdW5kIHRvIEIgd3JpdGVzIEEgY29uZmlnIGFuZCBkb2VzIG5vdCBzZWxlY3QgQiBib3gnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IHBlcm1pc3Npb25BcHBseUJvdW5kU2Vzc2lvbkhvc3QoKTtcblx0XHR0cnkge1xuXHRcdFx0Zml4dHVyZS5iaW5kQldpdGhTeW5jZWRTZWxlY3QoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMSk7XG5cdFx0XHRjb25zdCBhcHBseSA9IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLUEnLCAyKTtcblx0XHRcdGF3YWl0IGZpeHR1cmUucGVybWlzc2lvbkVudGVyZWQ7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtQScpPy5wZXJtaXNzaW9uSW5kZXgsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGZpeHR1cmUucmVsZWFzZVBlcm1pc3Npb24oeyBvazogdHJ1ZSB9KTtcblx0XHRcdGF3YWl0IGFwcGx5O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLUEnKT8ucGVybWlzc2lvbkluZGV4LCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1CJyk/LnBlcm1pc3Npb25JbmRleCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlUm93LmhpZGRlbiwgdHJ1ZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncGVybWlzc2lvbiBhcHBseSBmYWlsIHdoaWxlIHN0aWxsIG9uIEEgc3RpbGwgcm9sbHMgYmFjayBzZWxlY3QgYW5kIHNob3dzIGdhdGUgbm90aWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHVhQ29ubmVjdGlvbiA9IGZpeHR1cmUuaG9zdC51YUNvbm5lY3Rpb24gYXMge1xuXHRcdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogKHJlcXVlc3Q6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGU6IHN0cmluZyB9KSA9PiBQcm9taXNlPHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfT47XG5cdFx0XHR9O1xuXHRcdFx0dWFDb25uZWN0aW9uLnNldFBlcm1pc3Npb25Nb2RlID0gYXN5bmMgKCkgPT4gKHsgb2s6IGZhbHNlLCBtZXNzYWdlOiAnZW5naW5lIHJlamVjdGVkIHBlcm1pdCcgfSk7XG5cdFx0XHRhd2FpdCBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoZml4dHVyZS5ob3N0LCAnc2Vzcy1sZWZ0b3ZlcicsIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5nYXRlUm93LmhpZGRlbiwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Lm9rKGZpeHR1cmUuaG9zdC5nYXRlTGFiZWwudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdlbmdpbmUgcmVqZWN0ZWQgcGVybWl0JykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIHRydWUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ292ZXJsYXBwaW5nIHNldFBlcm1pc3Npb25Nb2RlIGtlZXBzIEFzayB3aGVuIGFuIGVhcmxpZXIgUGVybWl0IHN1Y2NlZWRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZWxlYXNlUGVybWl0OiAoKHZhbHVlOiB7IG9rOiB0cnVlIH0pID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IHBlcm1pdFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IHBlcm1pdEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgcGVybWl0U3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3QgcGVybWl0SG9sZCA9IG5ldyBQcm9taXNlPHsgb2s6IHRydWUgfT4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VQZXJtaXQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGxldCBjYWxscyA9IDA7XG5cdFx0XHRjb25zdCB1YUNvbm5lY3Rpb24gPSBmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uIGFzIHtcblx0XHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IChyZXF1ZXN0OiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfSkgPT4gUHJvbWlzZTx7IG9rOiBib29sZWFuIH0+O1xuXHRcdFx0fTtcblx0XHRcdHVhQ29ubmVjdGlvbi5zZXRQZXJtaXNzaW9uTW9kZSA9IGFzeW5jIHJlcXVlc3QgPT4ge1xuXHRcdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25DYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRjYWxscysrO1xuXHRcdFx0XHRpZiAoY2FsbHMgPT09IDEpIHtcblx0XHRcdFx0XHRwZXJtaXRTdGFydGVkPy4oKTtcblx0XHRcdFx0XHRyZXR1cm4gcGVybWl0SG9sZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4geyBvazogdHJ1ZSB9O1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHBlcm1pdCA9IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhd2FpdCBwZXJtaXRFbnRlcmVkO1xuXHRcdFx0Y29uc3QgYXNrID0gYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGZpeHR1cmUuaG9zdCwgJ3Nlc3MtbGVmdG92ZXInLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMubGVuZ3RoLCAxKTtcblx0XHRcdHJlbGVhc2VQZXJtaXQhKHsgb2s6IHRydWUgfSk7XG5cdFx0XHRhd2FpdCBwZXJtaXQ7XG5cdFx0XHRhd2FpdCBhc2s7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5zZXNzaW9uQ29uZmlnQnlTZXNzaW9uSWQuZ2V0KCdzZXNzLWxlZnRvdmVyJyk/LnBlcm1pc3Npb25JbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvbkNhbGxzLm1hcChjYWxsID0+IGNhbGwubW9kZSksIFtcblx0XHRcdFx0J1NFU1NJT05fVE9PTF9QRVJNSVNTSU9OX01PREVfUEVSTUlUJyxcblx0XHRcdFx0J1NFU1NJT05fVE9PTF9QRVJNSVNTSU9OX01PREVfQVNLJyxcblx0XHRcdF0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ292ZXJsYXBwaW5nIHNldFBlcm1pc3Npb25Nb2RlIGZhaWx1cmUgZG9lcyBub3QgcmVzdG9yZSB0aGUgbmV3ZXIgY2hvaWNlIHRvIHRoZSBlYXJsaWVyIHByZXZpb3VzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7XG5cdFx0XHRwYWlyaW5nUGVuZGluZzogZmFsc2UsXG5cdFx0XHRlbmdpbmVTZXNzaW9uUmVhZHk6IHRydWUsXG5cdFx0fSk7XG5cdFx0dHJ5IHtcblx0XHRcdGxldCByZWxlYXNlRmlyc3Q6ICgodmFsdWU6IHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfSkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgZmlyc3RTdGFydGVkOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBmaXJzdEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgZmlyc3RTdGFydGVkID0gcmVzb2x2ZTsgfSk7XG5cdFx0XHRjb25zdCBmaXJzdEhvbGQgPSBuZXcgUHJvbWlzZTx7IG9rOiBib29sZWFuOyBtZXNzYWdlPzogc3RyaW5nIH0+KHJlc29sdmUgPT4geyByZWxlYXNlRmlyc3QgPSByZXNvbHZlOyB9KTtcblx0XHRcdGxldCByZWxlYXNlU2Vjb25kOiAoKHZhbHVlOiB7IG9rOiBib29sZWFuOyBtZXNzYWdlPzogc3RyaW5nIH0pID0+IHZvaWQpIHwgdW5kZWZpbmVkO1xuXHRcdFx0bGV0IHNlY29uZFN0YXJ0ZWQ6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IHNlY29uZEVudGVyZWQgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgc2Vjb25kU3RhcnRlZCA9IHJlc29sdmU7IH0pO1xuXHRcdFx0Y29uc3Qgc2Vjb25kSG9sZCA9IG5ldyBQcm9taXNlPHsgb2s6IGJvb2xlYW47IG1lc3NhZ2U/OiBzdHJpbmcgfT4ocmVzb2x2ZSA9PiB7IHJlbGVhc2VTZWNvbmQgPSByZXNvbHZlOyB9KTtcblx0XHRcdGxldCBjYWxscyA9IDA7XG5cdFx0XHRjb25zdCB1YUNvbm5lY3Rpb24gPSBmaXh0dXJlLmhvc3QudWFDb25uZWN0aW9uIGFzIHtcblx0XHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IChyZXF1ZXN0OiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfSkgPT4gUHJvbWlzZTx7IG9rOiBib29sZWFuOyBtZXNzYWdlPzogc3RyaW5nIH0+O1xuXHRcdFx0fTtcblx0XHRcdHVhQ29ubmVjdGlvbi5zZXRQZXJtaXNzaW9uTW9kZSA9IGFzeW5jIHJlcXVlc3QgPT4ge1xuXHRcdFx0XHRmaXh0dXJlLnBlcm1pc3Npb25DYWxscy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0XHRjYWxscysrO1xuXHRcdFx0XHRpZiAoY2FsbHMgPT09IDEpIHtcblx0XHRcdFx0XHRmaXJzdFN0YXJ0ZWQ/LigpO1xuXHRcdFx0XHRcdHJldHVybiBmaXJzdEhvbGQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0c2Vjb25kU3RhcnRlZD8uKCk7XG5cdFx0XHRcdHJldHVybiBzZWNvbmRIb2xkO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IHBlcm1pdCA9IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMik7XG5cdFx0XHRhd2FpdCBmaXJzdEVudGVyZWQ7XG5cdFx0XHRjb25zdCBhZ2VudCA9IGFwcGx5U2Vzc2lvblBlcm1pc3Npb25JbmRleChmaXh0dXJlLmhvc3QsICdzZXNzLWxlZnRvdmVyJywgMSk7XG5cdFx0XHRyZWxlYXNlRmlyc3QhKHsgb2s6IGZhbHNlLCBtZXNzYWdlOiAnc3RhbGUgcGVybWl0IGZhaWxlZCcgfSk7XG5cdFx0XHRhd2FpdCBzZWNvbmRFbnRlcmVkO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3Quc2Vzc2lvbkNvbmZpZ0J5U2Vzc2lvbklkLmdldCgnc2Vzcy1sZWZ0b3ZlcicpPy5wZXJtaXNzaW9uSW5kZXgsIDEpO1xuXHRcdFx0Ly8gVGhlIHN0YWxlIFBlcm1pdCBmYWlsdXJlIG11c3Qgbm90IHBhaW50IGEgbm90aWNlIG9yIHJvbGwgdGhlIHNlbGVjdCBiYWNrLlxuXHRcdFx0Ly8gZ2F0ZVJvdyBzdGFydHMgdmlzaWJsZTsgdGhlIGZhaWx1cmUgZmxhZyBhbmQgbGFiZWwgYXJlIHRoZSBub3RpY2Ugc2lnbmFsLlxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUuaG9zdC5wb3N0RmFpbHVyZVZpc2libGUsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZ2F0ZUxhYmVsLnRleHRDb250ZW50LCAnJyk7XG5cdFx0XHRyZWxlYXNlU2Vjb25kISh7IG9rOiBmYWxzZSwgbWVzc2FnZTogJ2FnZW50IGZhaWxlZCcgfSk7XG5cdFx0XHRhd2FpdCBwZXJtaXQ7XG5cdFx0XHRhd2FpdCBhZ2VudDtcblx0XHRcdC8vIExhdGVzdCBmYWlsdXJlIHJvbGxzIGJhY2sgdG8gdGhlIGxhc3QgZW5naW5lLWNvbmZpcm1lZCBtb2RlIChBc2spLCBub3QgdGhlXG5cdFx0XHQvLyB1bmNvbmZpcm1lZCBQZXJtaXQgaW5kZXggdGhpcyByZXF1ZXN0IHN0YXJ0ZWQgZnJvbS5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLnBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnNlc3Npb25Db25maWdCeVNlc3Npb25JZC5nZXQoJ3Nlc3MtbGVmdG92ZXInKT8ucGVybWlzc2lvbkluZGV4LCAwKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZml4dHVyZS5wZXJtaXNzaW9uQ2FsbHMubWFwKGNhbGwgPT4gY2FsbC5tb2RlKSwgW1xuXHRcdFx0XHQnU0VTU0lPTl9UT09MX1BFUk1JU1NJT05fTU9ERV9QRVJNSVQnLFxuXHRcdFx0XHQnU0VTU0lPTl9UT09MX1BFUk1JU1NJT05fTU9ERV9BR0VOVCcsXG5cdFx0XHRdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QuZ2F0ZVJvdy5oaWRkZW4sIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXh0dXJlLmhvc3QucG9zdEZhaWx1cmVWaXNpYmxlLCB0cnVlKTtcblx0XHRcdGFzc2VydC5vayhmaXh0dXJlLmhvc3QuZ2F0ZUxhYmVsLnRleHRDb250ZW50Py5pbmNsdWRlcygnYWdlbnQgZmFpbGVkJykpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2xlZnRvdmVyLWxvb2tzLWxpdmUgcGFpcmluZy1ob2xkIFR1bmUgb3ZlcmxheSBzdGlsbCBwYWludHMgbGVmdG92ZXIgY2F0YWxvZycsICgpID0+IHtcblx0XHRjb25zdCBmaXh0dXJlID0gbGVmdG92ZXJMb29rc0xpdmVTZXNzaW9uU2VsZWN0c0hvc3QoeyBjYXRhbG9nVG9vbE5hbWVzOiBbJ2Jhc2gnLCAncmVhZCddIH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZml4dHVyZS5ob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIHRydWUpO1xuXHRcdFx0dG9nZ2xlVHVuZUNvbnRleHRWaWV3KGZpeHR1cmUuaG9zdCk7XG5cdFx0XHRjb25zdCBwb3B1cCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUtcG9wdXAnKTtcblx0XHRcdGFzc2VydC5vayhwb3B1cCk7XG5cdFx0XHRhc3NlcnQub2socG9wdXAudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdiYXNoJykpO1xuXHRcdFx0YXNzZXJ0Lm9rKHBvcHVwLnRleHRDb250ZW50Py5pbmNsdWRlcygncmVhZCcpKTtcblx0XHRcdGFzc2VydC5vayhwb3B1cC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLWxpc3QnKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9wdXAucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1maWx0ZXInKSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQub2soIXBvcHVwLnRleHRDb250ZW50Py5pbmNsdWRlcyhjb252ZXJzYXRpb25MZW5zRG9ja05vVG9vbHMpKTtcblx0XHRcdGFzc2VydC5vayghcG9wdXAudGV4dENvbnRlbnQ/LmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9FbmdpbmVUb29scykpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1R1bmUgb3ZlcmxheSBkaXNtaXNzZXMgb24gYW4gb3V0c2lkZSBjbGljayBkZWxpdmVyZWQgYXMgYSBTdGFuZGFyZE1vdXNlRXZlbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlU2Vzc2lvblNlbGVjdHNIb3N0KHsgY2F0YWxvZ1Rvb2xOYW1lczogWydiYXNoJywgJ3JlYWQnXSB9KTtcblx0XHRjb25zdCBvdXRzaWRlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdXRzaWRlKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgbXV0YWJsZUhvc3QgPSBmaXh0dXJlLmhvc3QgYXMgdW5rbm93biBhcyB7IGNvbnRleHRWaWV3U2VydmljZTogeyBzaG93Q29udGV4dFZpZXcoZGVsZWdhdGU6IHsgb25ET01FdmVudD8oZTogdW5rbm93bik6IHZvaWQgfSk6IHVua25vd24gfSB9O1xuXHRcdFx0Y29uc3Qgb3JpZ2luYWwgPSBtdXRhYmxlSG9zdC5jb250ZXh0Vmlld1NlcnZpY2U7XG5cdFx0XHRsZXQgZGVsZWdhdGU6IHsgb25ET01FdmVudD8oZTogdW5rbm93bik6IHZvaWQgfSB8IHVuZGVmaW5lZDtcblx0XHRcdG11dGFibGVIb3N0LmNvbnRleHRWaWV3U2VydmljZSA9IHtcblx0XHRcdFx0c2hvd0NvbnRleHRWaWV3KGQpIHtcblx0XHRcdFx0XHRkZWxlZ2F0ZSA9IGQ7XG5cdFx0XHRcdFx0cmV0dXJuIG9yaWdpbmFsLnNob3dDb250ZXh0VmlldyhkKTtcblx0XHRcdFx0fSxcblx0XHRcdH07XG5cdFx0XHR0b2dnbGVUdW5lQ29udGV4dFZpZXcoZml4dHVyZS5ob3N0KTtcblx0XHRcdGFzc2VydC5vayhkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLXBvcHVwJykpO1xuXHRcdFx0YXNzZXJ0Lm9rKGRlbGVnYXRlPy5vbkRPTUV2ZW50KTtcblxuXHRcdFx0Ly8gQ29udGV4dFZpZXcgcmVnaXN0ZXJzIHRocm91Z2ggYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXI6IGBjbGlja2AgYXJyaXZlcyB3cmFwcGVkLCB3aXRoIG5vIGB0eXBlYC5cblx0XHRcdG91dHNpZGUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IGRlbGVnYXRlIS5vbkRPTUV2ZW50IShuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KG1haW5XaW5kb3csIGUpKSk7XG5cdFx0XHRvdXRzaWRlLmNsaWNrKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpLCBudWxsKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0b3V0c2lkZS5yZW1vdmUoKTtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnVHVuZSBvdmVybGF5IHNjcm9sbHMgYSBsb25nIGNhdGFsb2cgYW5kIEVuZ2luZSB0b29scyBvcGVucyB0aGUgVG9vbHMgc2VjdGlvbicsICgpID0+IHtcblx0XHRjb25zdCBuYW1lcyA9IFsuLi5BcnJheS5mcm9tKHsgbGVuZ3RoOiAxMiB9LCAoXywgaW5kZXgpID0+IGB0b29sXyR7aW5kZXh9YCksICdmaWxlX2RlbGV0ZSddO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBsZWZ0b3Zlckxvb2tzTGl2ZVNlc3Npb25TZWxlY3RzSG9zdCh7IGNhdGFsb2dUb29sTmFtZXM6IG5hbWVzIH0pO1xuXHRcdHRyeSB7XG5cdFx0XHR0b2dnbGVUdW5lQ29udGV4dFZpZXcoZml4dHVyZS5ob3N0KTtcblx0XHRcdGNvbnN0IHBvcHVwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpIGFzIEhUTUxFbGVtZW50O1xuXHRcdFx0YXNzZXJ0Lm9rKHBvcHVwKTtcblx0XHRcdGNvbnN0IGxpc3QgPSBwb3B1cC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLWxpc3QnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGNvbnN0IG5vdGUgPSBwb3B1cC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lLW5vdGUnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGFzc2VydC5vayhsaXN0KTtcblx0XHRcdGFzc2VydC5vayhub3RlKTtcblx0XHRcdGFzc2VydC5vayhub3RlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKGxpc3QpICYgTm9kZS5ET0NVTUVOVF9QT1NJVElPTl9GT0xMT1dJTkcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvcHVwLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUtdG9vbCcpLmxlbmd0aCwgbmFtZXMubGVuZ3RoKTtcblx0XHRcdGNvbnN0IGZpbHRlciA9IHBvcHVwLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUtZmlsdGVyJykgYXMgSFRNTElucHV0RWxlbWVudDtcblx0XHRcdGFzc2VydC5vayhmaWx0ZXIpO1xuXHRcdFx0ZmlsdGVyLnZhbHVlID0gJ2ZpbGVfZGVsJztcblx0XHRcdGZpbHRlci5kaXNwYXRjaEV2ZW50KG5ldyBmaWx0ZXIub3duZXJEb2N1bWVudC5kZWZhdWx0VmlldyEuRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRcdGNvbnN0IHZpc2libGUgPSBbLi4ucG9wdXAucXVlcnlTZWxlY3RvckFsbCgnLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS10b29sJyldLmZpbHRlcihyb3cgPT4gIShyb3cgYXMgSFRNTEVsZW1lbnQpLmhpZGRlbik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGUubWFwKHJvdyA9PiByb3cudGV4dENvbnRlbnQpLCBbJ2ZpbGVfZGVsZXRlJ10pO1xuXG5cdFx0XHRjb25zdCBvcGVuID0gcG9wdXAucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1vcGVuJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0XHRvcGVuLmNsaWNrKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpeHR1cmUuZXhlY3V0ZWRDb21tYW5kcywgW3tcblx0XHRcdFx0aWQ6IE9QRU5fRU5HSU5FX1BSRUZFUkVOQ0VTX0NPTU1BTkRfSUQsXG5cdFx0XHRcdGFyZ3M6IFtFTkdJTkVfVE9PTFNfWk9ORV0sXG5cdFx0XHR9XSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpLCBudWxsKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdjYW5jZWxUb29sQ2FsbCBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZG9lcyBub3Qgd3JpdGUgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCwgcG9zdGVkIH0gPSBwYWlyaW5nSG9sZExlZnRvdmVyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRsZXQgY2FuY2VsQ2FsbHMgPSAwO1xuXHRcdChob3N0IGFzIHVua25vd24gYXMgeyBzdHViU2VydmljZTogeyBjYW5jZWxUb29sQ2FsbDogKCkgPT4gYm9vbGVhbiB9IH0pLnN0dWJTZXJ2aWNlLmNhbmNlbFRvb2xDYWxsID0gKCkgPT4ge1xuXHRcdFx0Y2FuY2VsQ2FsbHMrKztcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cdFx0Y2FuY2VsVG9vbENhbGwoaG9zdCwgeyBpZDogJ2UtcnVuJywgdG9vbENhbGxJZDogJ3RjLTEnLCBhZ2VudElkOiAnc3ViOmEnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5jZWxDYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBvc3RlZCwgMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdzdWJtaXREcmFmdCBwb3N0Qm91bmQgcmVqZWN0IHNob3dzIGZhaWxlZCBhbmQgZG9lcyBub3QgbGVhdmUgYW4gdW5oYW5kbGVkIHJlamVjdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgcmVqZWN0aW9uczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3Qgb25VbmhhbmRsZWQgPSAocmVhc29uOiB1bmtub3duKSA9PiB7IHJlamVjdGlvbnMucHVzaChyZWFzb24pOyB9O1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnLFxuXHRcdFx0c3VibWl0SW5GbGlnaHQ6IGZhbHNlLFxuXHRcdFx0bW9kZWxTZWxlY3RlZEluZGV4OiAwLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAnaGVsbG8nIH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdH0sXG5cdFx0XHRzZXNzaW9uVmlld0xlYXNlOiB7XG5cdFx0XHRcdHBvc3Q6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3Bvc3RCb3VuZCBib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWQpO1xuXHRcdHRyeSB7XG5cdFx0XHR2b2lkIHN1Ym1pdERyYWZ0KGhvc3QpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0SW1tZWRpYXRlKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlamVjdGlvbnMsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnN1Ym1pdEluRmxpZ2h0LCBmYWxzZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHByb2Nlc3Mub2ZmKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBkb2NrIHNlbmQgY2xpY2sgc3VibWl0RHJhZnQgcmVqZWN0cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBtb3VudERvY2tXaXRoUmVqZWN0aW5nU3VibWl0RHJhZnQocGFpbnRCb29tKTtcblx0XHR0cnkge1xuXHRcdFx0Zml4dHVyZS5ob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSA9ICcnO1xuXHRcdFx0Zml4dHVyZS5ob3N0LnNlbmRCdXR0b24uZW5hYmxlZCA9IHRydWU7XG5cdFx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdFx0Zml4dHVyZS5ob3N0LnNlbmRCdXR0b24uZWxlbWVudC5jbGljaygpO1xuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZW5hYmxlZCBzZW5kIGNsaWNrIHN1Ym1pdHMgb25jZSBhbmQgYSBkaXNhYmxlZCBzZW5kIGNsaWNrIGRvZXMgbm90JywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBjYWxscyA9IDA7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG1vdW50RG9ja1dpdGhTdWJtaXQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y2FsbHMrKztcblx0XHR9KTtcblx0XHR0cnkge1xuXHRcdFx0Zml4dHVyZS5ob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSA9ICdoZWxsbyc7XG5cdFx0XHRmaXh0dXJlLmhvc3Quc2VuZEJ1dHRvbi5lbmFibGVkID0gdHJ1ZTtcblx0XHRcdGZpeHR1cmUuaG9zdC5zZW5kQnV0dG9uLmVsZW1lbnQuY2xpY2soKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscywgMSwgJ29uZSBwcmVzcyBvbiBTZW5kIG11c3Qgbm90IHN1Ym1pdCB0d2ljZScpO1xuXG5cdFx0XHRjYWxscyA9IDA7XG5cdFx0XHRmaXh0dXJlLmhvc3Quc2VuZEJ1dHRvbi5lbmFibGVkID0gZmFsc2U7XG5cdFx0XHRmaXh0dXJlLmhvc3Quc2VuZEJ1dHRvbi5lbGVtZW50LmNsaWNrKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHMsIDAsICdhIGRpc2FibGVkIFNlbmQgbXVzdCBub3Qgc3VibWl0Jyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnc2F2aW5nIGEgdHVybiBlZGl0IGZyb20gU2VuZCBkb2VzIG5vdCBhbHNvIHBvc3QgdGhlIHJlc3RvcmVkIGNvbXBvc2UgZHJhZnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcG9zdGVkOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IHVwZGF0ZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IG1vdW50RG9ja1dpdGhTdWJtaXQoYXN5bmMgKCkgPT4geyB9KTtcblx0XHRjb25zdCBob3N0ID0gZml4dHVyZS5ob3N0IGFzIHVua25vd24gYXMgT21pdDxJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCwgJ3N0dWJTZXJ2aWNlJyB8ICd1YUNvbm5lY3Rpb24nPiAmIHtcblx0XHRcdGNvbXBvc2VEcmFmdFNuYXBzaG90OiBzdHJpbmc7XG5cdFx0XHRzdWJtaXREcmFmdCgpOiBQcm9taXNlPHZvaWQ+O1xuXHRcdFx0c3R1YlNlcnZpY2U6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0WydzdHViU2VydmljZSddO1xuXHRcdFx0dWFDb25uZWN0aW9uOiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdFsndWFDb25uZWN0aW9uJ107XG5cdFx0fTtcblx0XHRob3N0LmNvbXBvc2VyUG9saWN5ID0gJ3R1cm5FZGl0Jztcblx0XHRob3N0LmVkaXRpbmdUdXJuSWQgPSAndDEnO1xuXHRcdGhvc3QuY29tcG9zZURyYWZ0U25hcHNob3QgPSAnc3RpbGwgZHJhZnRpbmcnO1xuXHRcdGhvc3QubW9kZWxTZWxlY3RlZEluZGV4ID0gMDtcblx0XHRob3N0LmNhdGFsb2dNb2RlbElkcyA9IFsnJ107XG5cdFx0aG9zdC5zdWJtaXRJbkZsaWdodCA9IGZhbHNlO1xuXHRcdGhvc3Quc3R1YlNlcnZpY2UgPSB7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gdHJ1ZSxcblx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IGZhbHNlLFxuXHRcdFx0Z2V0VHVybnM6ICgpID0+IFt7IGlkOiAndDEnLCBraW5kOiAndXNlcicsIHRleHQ6ICdvcmlnaW5hbCcsIHR1cm5JZDogJ3QxJyB9XSxcblx0XHRcdHVwZGF0ZVVzZXJUdXJuVGV4dDogKF9zZXNzaW9uSWQ6IHN0cmluZywgX3R1cm5JZDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0dXBkYXRlcy5wdXNoKHRleHQpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0WydzdHViU2VydmljZSddO1xuXHRcdGhvc3QudWFDb25uZWN0aW9uID0ge1xuXHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgcGFpcmluZ1BlbmRpbmc6IGZhbHNlIH0pLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdFsndWFDb25uZWN0aW9uJ107XG5cdFx0aG9zdC5zZXNzaW9uVmlld0xlYXNlID0ge1xuXHRcdFx0cG9zdDogYXN5bmMgKG1zZzogQ29udmVyc2F0aW9uV3JpdGVNZXNzYWdlKSA9PiB7XG5cdFx0XHRcdHBvc3RlZC5wdXNoKG1zZy5raW5kID09PSAnc3VibWl0SW5wdXQnID8gbXNnLnRleHQgOiAnJyk7XG5cdFx0XHRcdHJldHVybiB7IGFjY2VwdGVkOiB0cnVlIGFzIGNvbnN0LCBjb3JyZWxhdGlvbjogeyBpZDogJ3Bvc3RlZCcgfSB9O1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3RbJ3Nlc3Npb25WaWV3TGVhc2UnXTtcblx0XHRob3N0LmV4aXRDb21wb3NlckVkaXQgPSAoKSA9PiB7XG5cdFx0XHRob3N0LmNvbXBvc2VyUG9saWN5ID0gJ2NvbXBvc2UnO1xuXHRcdFx0aG9zdC5lZGl0aW5nVHVybklkID0gdW5kZWZpbmVkO1xuXHRcdFx0aG9zdC5kb2NrVGV4dGFyZWEudmFsdWUgPSBob3N0LmNvbXBvc2VEcmFmdFNuYXBzaG90O1xuXHRcdH07XG5cdFx0aG9zdC5yZXNldElucHV0SGlzdG9yeUJyb3dzZSA9ICgpID0+IHsgfTtcblx0XHRob3N0LnJlYWRDb21wb3NlckRyYWZ0ID0gKCkgPT4gaG9zdC5jb21wb3NlRHJhZnRTbmFwc2hvdDtcblx0XHRob3N0LnNob3dQb3N0RmFpbHVyZSA9ICgpID0+IHsgfTtcblx0XHRob3N0LnN1Ym1pdERyYWZ0ID0gKCkgPT4gc3VibWl0RHJhZnQoaG9zdCk7XG5cdFx0dHJ5IHtcblx0XHRcdGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlID0gJ2VkaXRlZCc7XG5cdFx0XHRob3N0LnNlbmRCdXR0b24uZW5hYmxlZCA9IHRydWU7XG5cdFx0XHRob3N0LnNlbmRCdXR0b24uZWxlbWVudC5jbGljaygpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlcywgWydlZGl0ZWQnXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBvc3RlZCwgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAnc3RpbGwgZHJhZnRpbmcnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzZW5kIHdyYXBwZXIgY2xpY2sgc3VibWl0cyBvbmNlIG9ubHkgd2hlbiBTZW5kIGlzIGVuYWJsZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IGNhbGxzID0gMDtcblx0XHRjb25zdCBmaXh0dXJlID0gbW91bnREb2NrV2l0aFN1Ym1pdChhc3luYyAoKSA9PiB7XG5cdFx0XHRjYWxscysrO1xuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBob3N0ID0gZml4dHVyZS5ob3N0O1xuXHRcdFx0aG9zdC5kb2NrVGV4dGFyZWEudmFsdWUgPSAnaGVsbG8nO1xuXHRcdFx0Y29uc3Qgc2VuZENvbnRhaW5lciA9IGhvc3Quc2VuZEJ1dHRvbi5lbGVtZW50LnBhcmVudEVsZW1lbnQ7XG5cdFx0XHRhc3NlcnQub2soc2VuZENvbnRhaW5lcik7XG5cblx0XHRcdGhvc3Quc2VuZEJ1dHRvbi5lbmFibGVkID0gZmFsc2U7XG5cdFx0XHRzZW5kQ29udGFpbmVyLmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ2NsaWNrJywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscywgMCwgJ2EgZGlzYWJsZWQgU2VuZCB3cmFwcGVyIG11c3Qgbm90IHN1Ym1pdCcpO1xuXG5cdFx0XHRob3N0LnNlbmRCdXR0b24uZW5hYmxlZCA9IHRydWU7XG5cdFx0XHRzZW5kQ29udGFpbmVyLmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ2NsaWNrJywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscywgMSwgJ29uZSBjbGljayBvbiB0aGUgc2VuZCB3cmFwcGVyIG11c3Qgbm90IHN1Ym1pdCB0d2ljZScpO1xuXG5cdFx0XHRjYWxscyA9IDA7XG5cdFx0XHRob3N0Lm1heGltaXplSW5wdXRCdXR0b24uZWxlbWVudC5jbGljaygpO1xuXHRcdFx0aG9zdC50dW5lQnV0dG9uLmVsZW1lbnQuY2xpY2soKTtcblx0XHRcdGhvc3QubW9yZUJ1dHRvbi5lbGVtZW50LmNsaWNrKCk7XG5cdFx0XHRob3N0LmNvbXBvc2VyRXhpdEJ1dHRvbi5lbGVtZW50LmNsaWNrKCk7XG5cdFx0XHRob3N0LmRvY2tUZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KCdjbGljaycsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0XHRjb25zdCBib3R0b21CYXIgPSBob3N0LmRvY2tSb290LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWJvdHRvbS1iYXInKTtcblx0XHRcdGFzc2VydC5vayhib3R0b21CYXIpO1xuXHRcdFx0Ym90dG9tQmFyLmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ2NsaWNrJywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gaG9zdC5kb2NrUm9vdC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb2RlbCcpO1xuXHRcdFx0YXNzZXJ0Lm9rKG1vZGVsKTtcblx0XHRcdG1vZGVsLmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ2NsaWNrJywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscywgMCwgJ290aGVyIGRvY2sgYmFyIGNsaWNrcyBtdXN0IG5vdCBzdWJtaXQnKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzYXZpbmcgYSB0dXJuIGVkaXQgZnJvbSB0aGUgc2VuZCB3cmFwcGVyIGRvZXMgbm90IHBvc3QgdGhlIHJlc3RvcmVkIGRyYWZ0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBvc3RlZDogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCB1cGRhdGVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBtb3VudERvY2tXaXRoU3VibWl0KGFzeW5jICgpID0+IHsgfSk7XG5cdFx0Y29uc3QgaG9zdCA9IGZpeHR1cmUuaG9zdCBhcyB1bmtub3duIGFzIE9taXQ8SUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsICdzdHViU2VydmljZScgfCAndWFDb25uZWN0aW9uJz4gJiB7XG5cdFx0XHRjb21wb3NlRHJhZnRTbmFwc2hvdDogc3RyaW5nO1xuXHRcdFx0c3VibWl0RHJhZnQoKTogUHJvbWlzZTx2b2lkPjtcblx0XHRcdHN0dWJTZXJ2aWNlOiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdFsnc3R1YlNlcnZpY2UnXTtcblx0XHRcdHVhQ29ubmVjdGlvbjogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3RbJ3VhQ29ubmVjdGlvbiddO1xuXHRcdH07XG5cdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSAwO1xuXHRcdGhvc3QuY2F0YWxvZ01vZGVsSWRzID0gWycnXTtcblx0XHRob3N0LnN1Ym1pdEluRmxpZ2h0ID0gZmFsc2U7XG5cdFx0aG9zdC5zdHViU2VydmljZSA9IHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiB0cnVlLFxuXHRcdFx0aXNFbmdpbmVTZXNzaW9uUmVhZHk6ICgpID0+IHRydWUsXG5cdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHRnZXRUdXJuczogKCkgPT4gW3sgaWQ6ICd0MScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJ29yaWdpbmFsJywgdHVybklkOiAndDEnIH1dLFxuXHRcdFx0dXBkYXRlVXNlclR1cm5UZXh0OiAoX3Nlc3Npb25JZDogc3RyaW5nLCBfdHVybklkOiBzdHJpbmcsIHRleHQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHR1cGRhdGVzLnB1c2godGV4dCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3RbJ3N0dWJTZXJ2aWNlJ107XG5cdFx0aG9zdC51YUNvbm5lY3Rpb24gPSB7XG5cdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0Wyd1YUNvbm5lY3Rpb24nXTtcblx0XHRob3N0LnNlc3Npb25WaWV3TGVhc2UgPSB7XG5cdFx0XHRwb3N0OiBhc3luYyAobXNnOiBDb252ZXJzYXRpb25Xcml0ZU1lc3NhZ2UpID0+IHtcblx0XHRcdFx0cG9zdGVkLnB1c2gobXNnLmtpbmQgPT09ICdzdWJtaXRJbnB1dCcgPyBtc2cudGV4dCA6ICcnKTtcblx0XHRcdFx0cmV0dXJuIHsgYWNjZXB0ZWQ6IHRydWUgYXMgY29uc3QsIGNvcnJlbGF0aW9uOiB7IGlkOiAncG9zdGVkJyB9IH07XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdFsnc2Vzc2lvblZpZXdMZWFzZSddO1xuXHRcdGhvc3QuZXhpdENvbXBvc2VyRWRpdCA9ICgpID0+IHtcblx0XHRcdGhvc3QuY29tcG9zZXJQb2xpY3kgPSAnY29tcG9zZSc7XG5cdFx0XHRob3N0LmVkaXRpbmdUdXJuSWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSA9IGhvc3QuY29tcG9zZURyYWZ0U25hcHNob3Q7XG5cdFx0fTtcblx0XHRob3N0LnJlc2V0SW5wdXRIaXN0b3J5QnJvd3NlID0gKCkgPT4geyB9O1xuXHRcdGhvc3QucmVhZENvbXBvc2VyRHJhZnQgPSAoKSA9PiBob3N0LmNvbXBvc2VEcmFmdFNuYXBzaG90O1xuXHRcdGhvc3Quc2hvd1Bvc3RGYWlsdXJlID0gKCkgPT4geyB9O1xuXHRcdGhvc3Quc3VibWl0RHJhZnQgPSAoKSA9PiBzdWJtaXREcmFmdChob3N0KTtcblx0XHRjb25zdCBzZW5kQ29udGFpbmVyID0gaG9zdC5zZW5kQnV0dG9uLmVsZW1lbnQucGFyZW50RWxlbWVudDtcblx0XHRhc3NlcnQub2soc2VuZENvbnRhaW5lcik7XG5cdFx0Y29uc3QgYXJtVHVybkVkaXQgPSAoKSA9PiB7XG5cdFx0XHRob3N0LmNvbXBvc2VyUG9saWN5ID0gJ3R1cm5FZGl0Jztcblx0XHRcdGhvc3QuZWRpdGluZ1R1cm5JZCA9ICd0MSc7XG5cdFx0XHRob3N0LmNvbXBvc2VEcmFmdFNuYXBzaG90ID0gJ3N0aWxsIGRyYWZ0aW5nJztcblx0XHRcdGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlID0gJ2VkaXRlZCc7XG5cdFx0fTtcblx0XHR0cnkge1xuXHRcdFx0YXJtVHVybkVkaXQoKTtcblx0XHRcdGhvc3Quc2VuZEJ1dHRvbi5lbmFibGVkID0gdHJ1ZTtcblx0XHRcdHNlbmRDb250YWluZXIuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlcywgWydlZGl0ZWQnXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBvc3RlZCwgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZG9ja1RleHRhcmVhLnZhbHVlLCAnc3RpbGwgZHJhZnRpbmcnKTtcblxuXHRcdFx0dXBkYXRlcy5sZW5ndGggPSAwO1xuXHRcdFx0cG9zdGVkLmxlbmd0aCA9IDA7XG5cdFx0XHRhcm1UdXJuRWRpdCgpO1xuXHRcdFx0aG9zdC5zZW5kQnV0dG9uLmVuYWJsZWQgPSBmYWxzZTtcblx0XHRcdHNlbmRDb250YWluZXIuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnY2xpY2snLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXBkYXRlcywgW10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwb3N0ZWQsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSwgJ2VkaXRlZCcpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIGRvY2sgY2FwdHVyZSBjbGljayBzdWJtaXREcmFmdCByZWplY3RzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG1vdW50RG9ja1dpdGhSZWplY3RpbmdTdWJtaXREcmFmdChwYWludEJvb20pO1xuXHRcdHRyeSB7XG5cdFx0XHRmaXh0dXJlLmhvc3QuZG9ja1RleHRhcmVhLnZhbHVlID0gJ2hlbGxvJztcblx0XHRcdGZpeHR1cmUuaG9zdC5zZW5kQnV0dG9uLmVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0Y29uc3Qgc2VuZENvbnRhaW5lciA9IGZpeHR1cmUuaG9zdC5zZW5kQnV0dG9uLmVsZW1lbnQucGFyZW50RWxlbWVudDtcblx0XHRcdGFzc2VydC5vayhzZW5kQ29udGFpbmVyKTtcblx0XHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4ge1xuXHRcdFx0XHRzZW5kQ29udGFpbmVyLmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ2NsaWNrJywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRcdH0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIGRvY2sgRW50ZXIgc3VibWl0RHJhZnQgcmVqZWN0cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGZpeHR1cmUgPSBtb3VudERvY2tXaXRoUmVqZWN0aW5nU3VibWl0RHJhZnQocGFpbnRCb29tKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRcdGZpeHR1cmUuaG9zdC5kb2NrVGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicsIHtcblx0XHRcdFx0XHRrZXlDb2RlOiAxMyxcblx0XHRcdFx0XHRidWJibGVzOiB0cnVlLFxuXHRcdFx0XHRcdGNhbmNlbGFibGU6IHRydWUsXG5cdFx0XHRcdH0pKTtcblx0XHRcdH0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRmaXh0dXJlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2RvY2sgc3VibWl0RHJhZnQgZmlyZS1hbmQtZm9yZ2V0IHZvaWRzIGRvdWJsZS1jYXRjaCBvblVuZXhwZWN0ZWRFcnJvcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzb3VyY2UgPSBhd2FpdCBfX3JlYWRGaWxlSW5UZXN0cyhgJHtwcm9jZXNzLmN3ZCgpfS9zcmMvdnMvd29ya2JlbmNoL2NvbnRyaWIvY29udmVyc2F0aW9uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0RvY2sudHNgKTtcblx0XHRjb25zdCBkb3VibGVDYXRjaCA9ICcuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKSc7XG5cdFx0Y29uc3Qgc3VibWl0RHJhZnRWb2lkID0gYHZvaWQgaG9zdC5zdWJtaXREcmFmdCgpJHtkb3VibGVDYXRjaH1gO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzb3VyY2Uuc3BsaXQoc3VibWl0RHJhZnRWb2lkKS5sZW5ndGggLSAxLCAzKTtcblx0XHRhc3NlcnQub2soIXNvdXJjZS5pbmNsdWRlcygndm9pZCBob3N0LnN1Ym1pdERyYWZ0KCk7JykpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCcoKSA9PiB2b2lkIGhvc3Quc3VibWl0RHJhZnQoKSknKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIGRvY2sgcGVybWlzc2lvbiBzZWxlY3QgYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4IGNhdGNoLXBhdGggdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG1vdW50RG9ja1dpdGhSZWplY3RpbmdTZXNzaW9uU2VsZWN0QXBwbHkocGFpbnRCb29tKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRcdGZpeHR1cmUuZmlyZVBlcm1pc3Npb25TZWxlY3QoMik7XG5cdFx0XHR9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Zml4dHVyZS5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBkb2NrIG1vZGVsIHNlbGVjdCBhcHBseVNlc3Npb25Nb2RlbEluZGV4IGNhdGNoLXBhdGggdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgZml4dHVyZSA9IG1vdW50RG9ja1dpdGhSZWplY3RpbmdTZXNzaW9uU2VsZWN0QXBwbHkocGFpbnRCb29tKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRcdGZpeHR1cmUuZmlyZU1vZGVsU2VsZWN0KDEpO1xuXHRcdFx0fSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGZpeHR1cmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZG9jayBhcHBseVNlc3Npb24gZmlyZS1hbmQtZm9yZ2V0IHZvaWRzIGRvdWJsZS1jYXRjaCBvblVuZXhwZWN0ZWRFcnJvcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzb3VyY2UgPSBhd2FpdCBfX3JlYWRGaWxlSW5UZXN0cyhgJHtwcm9jZXNzLmN3ZCgpfS9zcmMvdnMvd29ya2JlbmNoL2NvbnRyaWIvY29udmVyc2F0aW9uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0RvY2sudHNgKTtcblx0XHRjb25zdCBkb3VibGVDYXRjaCA9ICcuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKSc7XG5cdFx0YXNzZXJ0Lm9rKHNvdXJjZS5pbmNsdWRlcyhgdm9pZCBhcHBseVNlc3Npb25QZXJtaXNzaW9uSW5kZXgoaG9zdCwgaG9zdC5nZXRCb3VuZFNlc3Npb25JZCgpLCBlLmluZGV4KSR7ZG91YmxlQ2F0Y2h9YCkpO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoYHZvaWQgYXBwbHlTZXNzaW9uTW9kZWxJbmRleChob3N0LCBob3N0LmdldEJvdW5kU2Vzc2lvbklkKCksIGUuaW5kZXgpJHtkb3VibGVDYXRjaH1gKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzb3VyY2UuaW5jbHVkZXMoJ3ZvaWQgYXBwbHlTZXNzaW9uUGVybWlzc2lvbkluZGV4KGhvc3QsIGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKSwgZS5pbmRleCk7JykpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIGFwcGx5U2Vzc2lvbk1vZGVsSW5kZXgoaG9zdCwgaG9zdC5nZXRCb3VuZFNlc3Npb25JZCgpLCBlLmluZGV4KTsnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVUdXJuRWRpdCByb3N0ZXIgZmFsc2UgYWZ0ZXIgZGlzY29ubmVjdCBzdGF5cyBpbiBlZGl0IGFuZCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRsZXQgZXhpdGVkID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICd0dXJuRWRpdCcsXG5cdFx0XHRlZGl0aW5nVHVybklkOiAndHVybi0xJyxcblx0XHRcdGRvY2tUZXh0YXJlYTogeyB2YWx1ZTogJ3JldmlzZWQgbGF0ZXInIH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHR1cGRhdGVVc2VyVHVyblRleHQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gW10sXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyBleGl0ZWQrKzsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdDtcblxuXHRcdHNhdmVUdXJuRWRpdChob3N0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhpdGVkLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5lZGl0aW5nVHVybklkLCAndHVybi0xJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuY29tcG9zZXJQb2xpY3ksICd0dXJuRWRpdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmRvY2tUZXh0YXJlYS52YWx1ZSwgJ3JldmlzZWQgbGF0ZXInKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZVR1cm5FZGl0IHJvc3RlciBmYWxzZSB3aXRob3V0IGNvbm5lY3Rpb24gaGlzdG9yeSBzdGF5cyBpbiBlZGl0IGFuZCBzaG93cyBmYWlsZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGxldCBleGl0ZWQgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ3R1cm5FZGl0Jyxcblx0XHRcdGVkaXRpbmdUdXJuSWQ6ICd0dXJuLTEnLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAncmV2aXNlZCBsYXRlcicgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdHVwZGF0ZVVzZXJUdXJuVGV4dDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gW10sXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyBleGl0ZWQrKzsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdDtcblxuXHRcdHNhdmVUdXJuRWRpdChob3N0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZmFpbGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGl0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmVkaXRpbmdUdXJuSWQsICd0dXJuLTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5jb21wb3NlclBvbGljeSwgJ3R1cm5FZGl0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVUdXJuRWRpdCByb3N0ZXIgdHJ1ZSBleGl0cyBlZGl0IGFuZCBkb2VzIG5vdCBzaG93IHBvc3QgZmFpbHVyZScsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0bGV0IGV4aXRlZCA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAndHVybkVkaXQnLFxuXHRcdFx0ZWRpdGluZ1R1cm5JZDogJ3R1cm4tMScsXG5cdFx0XHRkb2NrVGV4dGFyZWE6IHsgdmFsdWU6ICdyZXZpc2VkIGxhdGVyJyB9LFxuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0dXBkYXRlVXNlclR1cm5UZXh0OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0Z2V0VHVybnM6ICgpID0+IFtdLFxuXHRcdFx0fSxcblx0XHRcdGV4aXRDb21wb3NlckVkaXQ6ICgpID0+IHsgZXhpdGVkKys7IH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3Q7XG5cblx0XHRzYXZlVHVybkVkaXQoaG9zdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4aXRlZCwgMSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHNhdmVUdXJuRWRpdFdyaXRlSG9zdChvcHRpb25zOiB7XG5cdFx0ZWRpdGluZ1R1cm5JZDogc3RyaW5nO1xuXHRcdHR1cm5zOiByZWFkb25seSB7IGlkOiBzdHJpbmc7IGtpbmQ6IHN0cmluZzsgdGV4dDogc3RyaW5nOyB0dXJuSWQ/OiBzdHJpbmcgfVtdO1xuXHR9KToge1xuXHRcdGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXHRcdHdyaXR0ZW46IHsgc2Vzc2lvbklkOiBzdHJpbmc7IHR1cm5JZDogc3RyaW5nOyB0ZXh0OiBzdHJpbmcgfVtdO1xuXHR9IHtcblx0XHRjb25zdCB3cml0dGVuOiB7IHNlc3Npb25JZDogc3RyaW5nOyB0dXJuSWQ6IHN0cmluZzsgdGV4dDogc3RyaW5nIH1bXSA9IFtdO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ3R1cm5FZGl0JyBhcyBjb25zdCxcblx0XHRcdGVkaXRpbmdUdXJuSWQ6IG9wdGlvbnMuZWRpdGluZ1R1cm5JZCxcblx0XHRcdGRvY2tUZXh0YXJlYTogeyB2YWx1ZTogJ3JldmlzZWQgbGF0ZXInIH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gb3B0aW9ucy50dXJucyxcblx0XHRcdFx0dXBkYXRlVXNlclR1cm5UZXh0OiAoc2Vzc2lvbklkOiBzdHJpbmcsIHR1cm5JZDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHR3cml0dGVuLnB1c2goeyBzZXNzaW9uSWQsIHR1cm5JZCwgdGV4dCB9KTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHR1YUNvbm5lY3Rpb246IHtcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyBwYWlyaW5nUGVuZGluZzogZmFsc2UgfSksXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXHRcdHJldHVybiB7IGhvc3QsIHdyaXR0ZW4gfTtcblx0fVxuXG5cdHRlc3QoJ3NhdmVUdXJuRWRpdCB3aXRoIGRpc3BsYXkgaWQgZTEgYW5kIHR1cm5JZCB0MSB3cml0ZXMgdDEnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBob3N0LCB3cml0dGVuIH0gPSBzYXZlVHVybkVkaXRXcml0ZUhvc3Qoe1xuXHRcdFx0ZWRpdGluZ1R1cm5JZDogJ2UxJyxcblx0XHRcdHR1cm5zOiBbeyBpZDogJ2UxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnaGVsbG8nLCB0dXJuSWQ6ICd0MScgfV0sXG5cdFx0fSk7XG5cdFx0c2F2ZVR1cm5FZGl0KGhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmVkaXRpbmdUdXJuSWQsICdlMScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwod3JpdHRlbiwgW3sgc2Vzc2lvbklkOiAnc2Vzcy0xJywgdHVybklkOiAndDEnLCB0ZXh0OiAncmV2aXNlZCBsYXRlcicgfV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlVHVybkVkaXQgd2l0aG91dCB0dXJuSWQgd3JpdGVzIGRpc3BsYXkgaWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBob3N0LCB3cml0dGVuIH0gPSBzYXZlVHVybkVkaXRXcml0ZUhvc3Qoe1xuXHRcdFx0ZWRpdGluZ1R1cm5JZDogJ2UxJyxcblx0XHRcdHR1cm5zOiBbeyBpZDogJ2UxJywga2luZDogJ3VzZXInLCB0ZXh0OiAnaGVsbG8nIH1dLFxuXHRcdH0pO1xuXHRcdHNhdmVUdXJuRWRpdChob3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5lZGl0aW5nVHVybklkLCAnZTEnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHdyaXR0ZW4sIFt7IHNlc3Npb25JZDogJ3Nlc3MtMScsIHR1cm5JZDogJ2UxJywgdGV4dDogJ3JldmlzZWQgbGF0ZXInIH1dKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZVR1cm5FZGl0IGJsYW5rIHR1cm5JZCBhbmQgbWlzc2luZyByb3cgc3RpbGwgd3JpdGUgZGlzcGxheSBpZCcsICgpID0+IHtcblx0XHRjb25zdCBibGFuayA9IHNhdmVUdXJuRWRpdFdyaXRlSG9zdCh7XG5cdFx0XHRlZGl0aW5nVHVybklkOiAnZTEnLFxuXHRcdFx0dHVybnM6IFt7IGlkOiAnZTEnLCBraW5kOiAndXNlcicsIHRleHQ6ICdoZWxsbycsIHR1cm5JZDogJyAgICcgfV0sXG5cdFx0fSk7XG5cdFx0c2F2ZVR1cm5FZGl0KGJsYW5rLmhvc3QpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYmxhbmsud3JpdHRlbiwgW3sgc2Vzc2lvbklkOiAnc2Vzcy0xJywgdHVybklkOiAnZTEnLCB0ZXh0OiAncmV2aXNlZCBsYXRlcicgfV0pO1xuXHRcdGNvbnN0IG1pc3NpbmcgPSBzYXZlVHVybkVkaXRXcml0ZUhvc3Qoe1xuXHRcdFx0ZWRpdGluZ1R1cm5JZDogJ2UxJyxcblx0XHRcdHR1cm5zOiBbXSxcblx0XHR9KTtcblx0XHRzYXZlVHVybkVkaXQobWlzc2luZy5ob3N0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1pc3Npbmcud3JpdHRlbiwgW3sgc2Vzc2lvbklkOiAnc2Vzcy0xJywgdHVybklkOiAnZTEnLCB0ZXh0OiAncmV2aXNlZCBsYXRlcicgfV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdiZWdpblR1cm5FZGl0IGhpZ2hsaWdodCBzdGF5cyBvbiBkaXNwbGF5IGlkIHdoZW4gTDEgdHVybklkIGRpZmZlcnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgaGlnaGxpZ2h0ZWQ6IChzdHJpbmcgfCB1bmRlZmluZWQpW10gPSBbXTtcblx0XHRjb25zdCBjb21wb3NlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IGNvbXBvc2VyQ2x1c3RlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IGNvbXBvc2VyRWRpdEhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IGNvbXBvc2VyRWRpdFRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0Y29uc3QgZWRpdEhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb25zdCBkb2NrUm9vdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnN0IHByZWZpcnN0SGVybyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbXBvc2VyQ2x1c3Rlci5hcHBlbmRDaGlsZChjb21wb3Nlcik7XG5cdFx0Y29uc3QgZG9ja1RleHRhcmVhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcblx0XHRkb2NrVGV4dGFyZWEudmFsdWUgPSAnZHJhZnQnO1xuXHRcdGNvbnN0IGNocm9tZUhvc3QgPSB7XG5cdFx0XHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIGFzIGNvbnN0LFxuXHRcdFx0ZWRpdGluZ1R1cm5JZDogdW5kZWZpbmVkIGFzIHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRcdGVkaXRpbmdRdWV1ZUl0ZW1JZDogdW5kZWZpbmVkIGFzIHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRcdGNvbXBvc2VEcmFmdFNuYXBzaG90OiAnJyxcblx0XHRcdGRvY2tUZXh0YXJlYSxcblx0XHRcdHNlbmRCdXR0b246IHsgZW5hYmxlZDogdHJ1ZSwgc2V0VGl0bGUoKSB7IH0sIHNldEFyaWFMYWJlbCgpIHsgfSB9LFxuXHRcdFx0Y29tcG9zZXIsXG5cdFx0XHRjb21wb3NlckNsdXN0ZXIsXG5cdFx0XHRjb21wb3NlckVkaXRIZWFkZXIsXG5cdFx0XHRjb21wb3NlckVkaXRUaXRsZSxcblx0XHRcdGRvY2tSb290LFxuXHRcdFx0cHJlZmlyc3RIZXJvLFxuXHRcdFx0aXNQcmVGaXJzdDogKCkgPT4gZmFsc2UsXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRpbmJveE92ZXJsYXk6IHsgY2xvc2VMaXN0UGFuZWwoKSB7IH0gfSxcblx0XHRcdHRpbWVsaW5lVHJlZToge1xuXHRcdFx0XHRzZXRFZGl0aW5nVHVybklkOiAoaWQ/OiBzdHJpbmcpID0+IHsgaGlnaGxpZ2h0ZWQucHVzaChpZCk7IH0sXG5cdFx0XHRcdGdldFR1cm5FZGl0SG9zdDogKCkgPT4gZWRpdEhvc3QsXG5cdFx0XHR9LFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGlzRW5naW5lU2Vzc2lvblJlYWR5OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRnZXRUdXJuczogKCkgPT4gW3sgaWQ6ICdlMScsIGtpbmQ6ICd1c2VyJywgdGV4dDogJ2hlbGxvJywgdHVybklkOiAndDEnIH1dLFxuXHRcdFx0fSxcblx0XHRcdHVhQ29ubmVjdGlvbjoge1xuXHRcdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+ICh7IGtpbmQ6ICdjb25uZWN0ZWQnLCBwYXRoOiAnbG9vcGJhY2snIH0pLFxuXHRcdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IHBhaXJpbmdQZW5kaW5nOiBmYWxzZSB9KSxcblx0XHRcdH0sXG5cdFx0fTtcblx0XHRiZWdpblR1cm5FZGl0KGNocm9tZUhvc3QgYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lSG9zdCwgJ2UxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZUhvc3QuZWRpdGluZ1R1cm5JZCwgJ2UxJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChoaWdobGlnaHRlZCwgWydlMSddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lSG9zdC5jb21wb3NlclBvbGljeSwgJ3R1cm5FZGl0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVRdWV1ZUVkaXQgcm9zdGVyIGZhbHNlIGFmdGVyIGRpc2Nvbm5lY3Qgc3RheXMgaW4gZWRpdCBhbmQgc2hvd3MgZW5naW5lX2Rpc2Nvbm5lY3RlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0bGV0IGV4aXRlZCA9IDA7XG5cdFx0bGV0IHJlbGVhc2VkID0gMDtcblx0XHRsZXQgcmVuZGVyZWRJbmJveCA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNvbXBvc2VyUG9saWN5OiAncXVldWVFZGl0Jyxcblx0XHRcdGVkaXRpbmdRdWV1ZUl0ZW1JZDogJ3ExJyxcblx0XHRcdGRvY2tUZXh0YXJlYTogeyB2YWx1ZTogJ3JldmlzZWQgbGF0ZXInIH0sXG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRnZXRFZGl0aW5nUXVldWVJdGVtOiAoKSA9PiAoeyBpZDogJ3ExJywgY29udGVudDogJ3F1ZXVlZCcgfSksXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHR1cGRhdGVNZXNzYWdlUXVldWVJdGVtQ29udGVudDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdHJlbGVhc2VNZXNzYWdlUXVldWVJdGVtSG9sZDogKCkgPT4geyByZWxlYXNlZCsrOyB9LFxuXHRcdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdGV4aXRDb21wb3NlckVkaXQ6ICgpID0+IHsgZXhpdGVkKys7IH0sXG5cdFx0XHRyZW5kZXJJbmJveFN0YXR1czogKCkgPT4geyByZW5kZXJlZEluYm94Kys7IH0sXG5cdFx0XHRzaG93UG9zdEZhaWx1cmU6IChyZWFzb246IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24pID0+IHtcblx0XHRcdFx0ZmFpbHVyZXMucHVzaChyZWFzb24pO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3Q7XG5cblx0XHRzYXZlUXVldWVFZGl0KGhvc3QpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydlbmdpbmVfZGlzY29ubmVjdGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGl0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWxlYXNlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlbmRlcmVkSW5ib3gsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LmVkaXRpbmdRdWV1ZUl0ZW1JZCwgJ3ExJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuY29tcG9zZXJQb2xpY3ksICdxdWV1ZUVkaXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5kb2NrVGV4dGFyZWEudmFsdWUsICdyZXZpc2VkIGxhdGVyJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVRdWV1ZUVkaXQgcm9zdGVyIGZhbHNlIHdpdGhvdXQgY29ubmVjdGlvbiBoaXN0b3J5IHN0YXlzIGluIGVkaXQgYW5kIHNob3dzIGZhaWxlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0bGV0IGV4aXRlZCA9IDA7XG5cdFx0bGV0IHJlbGVhc2VkID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdxdWV1ZUVkaXQnLFxuXHRcdFx0ZWRpdGluZ1F1ZXVlSXRlbUlkOiAncTEnLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAncmV2aXNlZCBsYXRlcicgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdGdldEVkaXRpbmdRdWV1ZUl0ZW06ICgpID0+ICh7IGlkOiAncTEnLCBjb250ZW50OiAncXVldWVkJyB9KSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdHVwZGF0ZU1lc3NhZ2VRdWV1ZUl0ZW1Db250ZW50OiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0cmVsZWFzZU1lc3NhZ2VRdWV1ZUl0ZW1Ib2xkOiAoKSA9PiB7IHJlbGVhc2VkKys7IH0sXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdGV4aXRDb21wb3NlckVkaXQ6ICgpID0+IHsgZXhpdGVkKys7IH0sXG5cdFx0XHRyZW5kZXJJbmJveFN0YXR1czogKCkgPT4geyB9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0O1xuXG5cdFx0c2F2ZVF1ZXVlRWRpdChob3N0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZmFpbGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGl0ZWQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWxlYXNlZCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvc3QuZWRpdGluZ1F1ZXVlSXRlbUlkLCAncTEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaG9zdC5jb21wb3NlclBvbGljeSwgJ3F1ZXVlRWRpdCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlUXVldWVFZGl0IHJvc3RlciB0cnVlIGV4aXRzIGVkaXQgYW5kIGRvZXMgbm90IHNob3cgcG9zdCBmYWlsdXJlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRsZXQgZXhpdGVkID0gMDtcblx0XHRsZXQgcmVsZWFzZWQgPSAwO1xuXHRcdGxldCByZW5kZXJlZEluYm94ID0gMDtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y29tcG9zZXJQb2xpY3k6ICdxdWV1ZUVkaXQnLFxuXHRcdFx0ZWRpdGluZ1F1ZXVlSXRlbUlkOiAncTEnLFxuXHRcdFx0ZG9ja1RleHRhcmVhOiB7IHZhbHVlOiAncmV2aXNlZCBsYXRlcicgfSxcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdGdldEVkaXRpbmdRdWV1ZUl0ZW06ICgpID0+ICh7IGlkOiAncTEnLCBjb250ZW50OiAncXVldWVkJyB9KSxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdHVwZGF0ZU1lc3NhZ2VRdWV1ZUl0ZW1Db250ZW50OiAoKSA9PiB0cnVlLFxuXHRcdFx0XHRyZWxlYXNlTWVzc2FnZVF1ZXVlSXRlbUhvbGQ6ICgpID0+IHsgcmVsZWFzZWQrKzsgfSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0ZXhpdENvbXBvc2VyRWRpdDogKCkgPT4geyBleGl0ZWQrKzsgfSxcblx0XHRcdHJlbmRlckluYm94U3RhdHVzOiAoKSA9PiB7IHJlbmRlcmVkSW5ib3grKzsgfSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdDtcblxuXHRcdHNhdmVRdWV1ZUVkaXQoaG9zdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4aXRlZCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlbGVhc2VkLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVuZGVyZWRJbmJveCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHlUdXJuIHdyaXRlVGV4dCByZWplY3Qgc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWF2ZSBhbiB1bmhhbmRsZWQgcmVqZWN0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCByZWplY3Rpb25zOiB1bmtub3duW10gPSBbXTtcblx0XHRjb25zdCBvblVuaGFuZGxlZCA9IChyZWFzb246IHVua25vd24pID0+IHsgcmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7IH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGNsaXBib2FyZFNlcnZpY2U6IHtcblx0XHRcdFx0d3JpdGVUZXh0OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCd3cml0ZVRleHQgYm9vbScpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR0cnkge1xuXHRcdFx0Y29weVR1cm4oaG9zdCwgJ2NvcGllZCcpO1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiByZXNvbHZlKCkpKTtcblx0XHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0SW1tZWRpYXRlKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlamVjdGlvbnMsIFtdKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cHJvY2Vzcy5vZmYoJ3VuaGFuZGxlZFJlamVjdGlvbicsIG9uVW5oYW5kbGVkKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHlUdXJuIHdyaXRlVGV4dCByZWplY3Qgc3RpbGwgc2hvd3MgZmFpbGVkIGFuZCBkb2VzIG5vdCBsZWFrIHdoZW4gc2hvd1Bvc3RGYWlsdXJlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y2xpcGJvYXJkU2VydmljZToge1xuXHRcdFx0XHR3cml0ZVRleHQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3dyaXRlVGV4dCBib29tJyk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmluZGluZ0hvc3Q7XG5cblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IGNvcHlUdXJuKGhvc3QsICdjb3BpZWQnKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHlUdXJuIHdyaXRlVGV4dCByZXNvbHZlIHN0YXlzIHNpbGVudCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3Qgd3JpdHRlbjogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Y2xpcGJvYXJkU2VydmljZToge1xuXHRcdFx0XHR3cml0ZVRleHQ6IGFzeW5jICh0ZXh0OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHR3cml0dGVuLnB1c2godGV4dCk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0Y29weVR1cm4oaG9zdCwgJ2NvcGllZCcpO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gcXVldWVNaWNyb3Rhc2soKCkgPT4gcmVzb2x2ZSgpKSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRJbW1lZGlhdGUoKCkgPT4gcmVzb2x2ZSgpKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHdyaXR0ZW4sIFsnY29waWVkJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlVHVybiByb3N0ZXIgZmFsc2UgYWZ0ZXIgZGlzY29ubmVjdCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRsZXQgZGVsZXRlQ2FsbHMgPSAwO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRkZWxldGVUdXJuOiAoKSA9PiB7XG5cdFx0XHRcdFx0ZGVsZXRlQ2FsbHMrKztcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0ZGVsZXRlVHVybihob3N0LCAndHVybi0xJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVsZXRlQ2FsbHMsIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlVHVybiByb3N0ZXIgZmFsc2Ugd2l0aG91dCBjb25uZWN0aW9uIGhpc3Rvcnkgc2hvd3MgZmFpbGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0ZGVsZXRlVHVybjogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdGRlbGV0ZVR1cm4oaG9zdCwgJ3R1cm4tMScpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgWydmYWlsZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVR1cm4gcm9zdGVyIHRydWUgc3RheXMgc2lsZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0ZGVsZXRlVHVybjogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0ZGVsZXRlVHVybihob3N0LCAndHVybi0xJyk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbmNlbFRvb2xDYWxsIHJvc3RlciBmYWxzZSBhZnRlciBkaXNjb25uZWN0IHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGxldCBjYW5jZWxDYWxscyA9IDA7XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdGNhbmNlbFRvb2xDYWxsOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y2FuY2VsQ2FsbHMrKztcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0Y2FuY2VsVG9vbENhbGwoaG9zdCwgeyBpZDogJ2UtcnVuJywgdG9vbENhbGxJZDogJ3RjLTEnLCBhZ2VudElkOiAnc3ViOmEnIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbmNlbENhbGxzLCAxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbmNlbFRvb2xDYWxsIHJvc3RlciBmYWxzZSB3aXRob3V0IGNvbm5lY3Rpb24gaGlzdG9yeSBzaG93cyBmYWlsZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRjYW5jZWxUb29sQ2FsbDogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IGZhbHNlLFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdGNhbmNlbFRvb2xDYWxsKGhvc3QsIHsgaWQ6ICdlLXJ1bicsIHRvb2xDYWxsSWQ6ICd0Yy0xJyB9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZmFpbGVkJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW5jZWxUb29sQ2FsbCByb3N0ZXIgdHJ1ZSBzdGF5cyBzaWxlbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IGhvc3QgPSB7XG5cdFx0XHRnZXRCb3VuZFNlc3Npb25JZDogKCkgPT4gJ3Nlc3MtMScsXG5cdFx0XHRzdHViU2VydmljZToge1xuXHRcdFx0XHRjYW5jZWxUb29sQ2FsbDogKCkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0Y2FuY2VsVG9vbENhbGwoaG9zdCwgeyBpZDogJ2UtcnVuJywgdG9vbENhbGxJZDogJ3RjLTEnIH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmYWlsdXJlcywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNwb25kQ2xpZW50VG9vbCBwYWlyaW5nLWhvbGQgbGVmdG92ZXIgZG9lcyBub3Qgd3JpdGUgYW5kIHNob3dzIGVuZ2luZV9kaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZmFpbHVyZXM6IENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb25bXSA9IFtdO1xuXHRcdGNvbnN0IHsgaG9zdCwgcG9zdGVkIH0gPSBwYWlyaW5nSG9sZExlZnRvdmVyV3JpdGVIb3N0KGZhaWx1cmVzKTtcblx0XHRsZXQgcmVzcG9uZENhbGxzID0gMDtcblx0XHQoaG9zdCBhcyB1bmtub3duIGFzIHsgc3R1YlNlcnZpY2U6IHsgcmVzcG9uZENsaWVudFRvb2w6ICgpID0+IGJvb2xlYW4gfSB9KS5zdHViU2VydmljZS5yZXNwb25kQ2xpZW50VG9vbCA9ICgpID0+IHtcblx0XHRcdHJlc3BvbmRDYWxscysrO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fTtcblx0XHRyZXNwb25kQ2xpZW50VG9vbChob3N0LCB7IGlkOiAnY2FsbC0xJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzcG9uZENhbGxzLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0tFRVAgbGVmdG92ZXIgbGlzdC1mYWlsIHJlc3BvbmRDbGllbnRUb29sIHNraXBzIHVuYXJ5IGFuZCBzaG93cyBzZXNzaW9uX25vdF9yZWFkeScsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgZml4dHVyZSA9IGxlZnRvdmVyTG9va3NMaXZlQ29uZmlybVF1ZXN0aW9uSG9zdChmYWlsdXJlcywgZmFsc2UsIGZhbHNlKTtcblx0XHRsZXQgcmVzcG9uZENhbGxzID0gMDtcblx0XHQoZml4dHVyZS5ob3N0IGFzIHVua25vd24gYXMgeyBzdHViU2VydmljZTogeyByZXNwb25kQ2xpZW50VG9vbDogKCkgPT4gYm9vbGVhbiB9IH0pLnN0dWJTZXJ2aWNlLnJlc3BvbmRDbGllbnRUb29sID0gKCkgPT4ge1xuXHRcdFx0cmVzcG9uZENhbGxzKys7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdHJlc3BvbmRDbGllbnRUb29sKGZpeHR1cmUuaG9zdCwgeyBpZDogJ2NhbGwtMScgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3BvbmRDYWxscywgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpeHR1cmUucG9zdGVkLCAwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ3Nlc3Npb25fbm90X3JlYWR5J10pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNwb25kQ2xpZW50VG9vbCByb3N0ZXIgZmFsc2UgYWZ0ZXIgZGlzY29ubmVjdCBzaG93cyBlbmdpbmVfZGlzY29ubmVjdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBjYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgY2FsbElkOiBzdHJpbmc7IG9wdGlvbnM/OiB7IGNvbnRlbnQ/OiBzdHJpbmcgfSB9W10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0cmVzcG9uZENsaWVudFRvb2w6IChzZXNzaW9uSWQ6IHN0cmluZywgY2FsbElkOiBzdHJpbmcsIG9wdGlvbnM/OiB7IGNvbnRlbnQ/OiBzdHJpbmcgfSkgPT4ge1xuXHRcdFx0XHRcdGNhbGxzLnB1c2goeyBzZXNzaW9uSWQsIGNhbGxJZCwgb3B0aW9ucyB9KTtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aGFzRW5naW5lQ29ubmVjdGlvbkhpc3Rvcnk6ICgpID0+IHRydWUsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cmVzcG9uZENsaWVudFRvb2woaG9zdCwgeyBpZDogJ2NhbGwtMScgfSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNhbGxzLCBbeyBzZXNzaW9uSWQ6ICdzZXNzLTEnLCBjYWxsSWQ6ICdjYWxsLTEnLCBvcHRpb25zOiB7IGNvbnRlbnQ6ICcnIH0gfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmFpbHVyZXMsIFsnZW5naW5lX2Rpc2Nvbm5lY3RlZCddKTtcblx0fSk7XG5cblx0dGVzdCgncmVzcG9uZENsaWVudFRvb2wgcm9zdGVyIGZhbHNlIHdpdGhvdXQgY29ubmVjdGlvbiBoaXN0b3J5IHNob3dzIGZhaWxlZCcsICgpID0+IHtcblx0XHRjb25zdCBmYWlsdXJlczogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbltdID0gW107XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdGdldEJvdW5kU2Vzc2lvbklkOiAoKSA9PiAnc2Vzcy0xJyxcblx0XHRcdHN0dWJTZXJ2aWNlOiB7XG5cdFx0XHRcdHJlc3BvbmRDbGllbnRUb29sOiAoKSA9PiBmYWxzZSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IGZhbHNlLFxuXHRcdFx0XHRoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeTogKCkgPT4gZmFsc2UsXG5cdFx0XHR9LFxuXHRcdFx0c2hvd1Bvc3RGYWlsdXJlOiAocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKSA9PiB7XG5cdFx0XHRcdGZhaWx1cmVzLnB1c2gocmVhc29uKTtcblx0XHRcdH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJpbmRpbmdIb3N0O1xuXG5cdFx0cmVzcG9uZENsaWVudFRvb2woaG9zdCwgeyBpZDogJ2NhbGwtMScgfSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbJ2ZhaWxlZCddKTtcblx0fSk7XG5cblx0dGVzdCgncmVzcG9uZENsaWVudFRvb2wgcm9zdGVyIHRydWUgc3RheXMgc2lsZW50IGFuZCBzZW5kcyBlbXB0eSBjb250ZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGZhaWx1cmVzOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uW10gPSBbXTtcblx0XHRjb25zdCBjYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgY2FsbElkOiBzdHJpbmc7IG9wdGlvbnM/OiB7IGNvbnRlbnQ/OiBzdHJpbmcgfSB9W10gPSBbXTtcblx0XHRjb25zdCBob3N0ID0ge1xuXHRcdFx0Z2V0Qm91bmRTZXNzaW9uSWQ6ICgpID0+ICdzZXNzLTEnLFxuXHRcdFx0c3R1YlNlcnZpY2U6IHtcblx0XHRcdFx0cmVzcG9uZENsaWVudFRvb2w6IChzZXNzaW9uSWQ6IHN0cmluZywgY2FsbElkOiBzdHJpbmcsIG9wdGlvbnM/OiB7IGNvbnRlbnQ/OiBzdHJpbmcgfSkgPT4ge1xuXHRcdFx0XHRcdGNhbGxzLnB1c2goeyBzZXNzaW9uSWQsIGNhbGxJZCwgb3B0aW9ucyB9KTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+IHRydWUsXG5cdFx0XHRcdGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5OiAoKSA9PiB0cnVlLFxuXHRcdFx0fSxcblx0XHRcdHNob3dQb3N0RmFpbHVyZTogKHJlYXNvbjogQ29udmVyc2F0aW9uQ29tcG9zZXJQb3N0RmFpbHVyZVJlYXNvbikgPT4ge1xuXHRcdFx0XHRmYWlsdXJlcy5wdXNoKHJlYXNvbik7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nSG9zdDtcblxuXHRcdHJlc3BvbmRDbGllbnRUb29sKGhvc3QsIHsgaWQ6ICdjYWxsLTEnIH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxscywgW3sgc2Vzc2lvbklkOiAnc2Vzcy0xJywgY2FsbElkOiAnY2FsbC0xJywgb3B0aW9uczogeyBjb250ZW50OiAnJyB9IH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZhaWx1cmVzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3dQb3N0RmFpbHVyZSBmYWlsZWQgdXNlcyByZXRyeSBjb3B5IG5vdCBkaXNjb25uZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IHtcblx0XHRcdGhpZGRlbjogdHJ1ZSxcblx0XHRcdGNsYXNzTGlzdDoge1xuXHRcdFx0XHRhZGQoKSB7IH0sXG5cdFx0XHRcdHJlbW92ZSgpIHsgfSxcblx0XHRcdH0sXG5cdFx0XHRzZXRBdHRyaWJ1dGU6ICgpID0+IHsgfSxcblx0XHRcdHJlbW92ZUF0dHJpYnV0ZTogKCkgPT4geyB9LFxuXHRcdH07XG5cdFx0Y29uc3QgZ2F0ZUxhYmVsID0ge1xuXHRcdFx0dGV4dENvbnRlbnQ6ICcnLFxuXHRcdFx0cmVtb3ZlQXR0cmlidXRlKCkgeyB9LFxuXHRcdH07XG5cdFx0Y29uc3QgaG9zdCA9IHtcblx0XHRcdHBvc3RGYWlsdXJlVmlzaWJsZTogZmFsc2UsXG5cdFx0XHRzZW5kRmFpbHVyZVRpbWVvdXQ6IHVuZGVmaW5lZCBhcyBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IHVuZGVmaW5lZCxcblx0XHRcdGdhdGVSb3csXG5cdFx0XHRnYXRlTGFiZWwsXG5cdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJDaHJvbWVIb3N0O1xuXG5cdFx0c2hvd1Bvc3RGYWlsdXJlKGhvc3QsICdmYWlsZWQnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3N0LnBvc3RGYWlsdXJlVmlzaWJsZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVSb3cuaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVMYWJlbC50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc1Bvc3RGYWlsZWQpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChnYXRlTGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkRGlzY29ubmVjdGVkKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoZ2F0ZUxhYmVsLnRleHRDb250ZW50LCBjb252ZXJzYXRpb25MZW5zUG9zdEZhaWxlZE5vU2Vzc2lvbik7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGdhdGVMYWJlbC50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJUaXRsZUVtcHR5KTtcblxuXHRcdHNob3dQb3N0RmFpbHVyZShob3N0LCAnZW1wdHlfc2Vzc2lvbl90aXRsZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnYXRlTGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyVGl0bGVFbXB0eSk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGdhdGVMYWJlbC50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc1Bvc3RGYWlsZWQpO1xuXHRcdGFzc2VydC5vayghL2Rpc2Nvbm5lY3RlZC9pLnRlc3QoZ2F0ZUxhYmVsLnRleHRDb250ZW50ID8/ICcnKSk7XG5cdFx0aWYgKGhvc3Quc2VuZEZhaWx1cmVUaW1lb3V0KSB7XG5cdFx0XHRjbGVhclRpbWVvdXQoaG9zdC5zZW5kRmFpbHVyZVRpbWVvdXQpO1xuXHRcdFx0aG9zdC5zZW5kRmFpbHVyZVRpbWVvdXQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBRW5CLFNBQVMsZUFBZTtBQUN4QixTQUFTLGNBQWMsaUNBQWlDO0FBQ3hELFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsV0FBVztBQUNwQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLG1EQUFtRDtBQUU1RCxTQUFTLDBCQUEwQiwwQkFBMEIseUJBQXlCLHdCQUE4RDtBQUNwSixTQUFTLG9DQUFvQyxtQ0FBbUMsOEJBQThCLDRCQUE0Qiw0QkFBNEIseUNBQXdFO0FBQzlPLFNBQVMsNkNBQTZDO0FBRXRELFNBQVMsNkJBQTZEO0FBRXRFLFNBQVMsV0FBVyxlQUFlLGNBQWMsbUJBQXVEO0FBQ3hHO0FBQUEsRUFDQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxPQUVNO0FBQ1AsU0FBUyx1QkFBdUIsd0JBQXdCLGtCQUFrQixxQkFBcUIsbUNBQXlFO0FBQ3hLLFNBQVMsaUJBQWlEO0FBQzFEO0FBQUEsRUFDQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BRU07QUFDUCxTQUFTLDRDQUE0QztBQUNyRCxTQUFTLG1CQUFtQiwwQ0FBMEM7QUFDdEUsU0FBUyxvQkFBb0IsaUJBQWlCLGdCQUFnQixVQUFVLFlBQVkscUJBQXFCLGlCQUFpQixtQkFBbUIsa0JBQTREO0FBQ3pNLFNBQVMsMEJBQTBCLGlDQUFpQztBQUtwRSxNQUFNLGtDQUFrQyxNQUFNO0FBRTdDLDBDQUF3QztBQUV4QyxpQkFBZSxpQ0FBaUMsV0FBa0IsS0FBZ0M7QUFFakcsVUFBTSxrQkFBNkIsQ0FBQztBQUNwQyxVQUFNLHNCQUFpQyxDQUFDO0FBQ3hDLFVBQU0sdUJBQXVCLENBQUMsV0FBb0Isb0JBQW9CLEtBQUssTUFBTTtBQUNqRixZQUFRLEdBQUcsc0JBQXNCLG9CQUFvQjtBQUNyRCxVQUFNLHVCQUF1QixhQUFhLDBCQUEwQjtBQUNwRSw4QkFBMEIsV0FBUztBQUNsQyxzQkFBZ0IsS0FBSyxLQUFLO0FBQzFCLFVBQUksZ0JBQWdCLFdBQVcsR0FBRztBQUNqQyxjQUFNO0FBQUEsTUFDUDtBQUFBLElBQ0QsQ0FBQztBQUNELFFBQUk7QUFDSCxVQUFJO0FBQ0osWUFBTSxRQUFRLENBQUM7QUFDZixhQUFPLGdCQUFnQixFQUFFLHFCQUFxQixnQkFBZ0IsR0FBRztBQUFBLFFBQ2hFLHFCQUFxQixDQUFDO0FBQUEsUUFDdEIsaUJBQWlCLENBQUMsV0FBVyxTQUFTO0FBQUEsTUFDdkMsQ0FBQztBQUFBLElBQ0YsVUFBRTtBQUNELGdDQUEwQixvQkFBb0I7QUFDOUMsY0FBUSxJQUFJLHNCQUFzQixvQkFBb0I7QUFBQSxJQUN2RDtBQUFBLEVBQ0Q7QUFFQSxXQUFTLG9CQUFvQkEsY0FBd0Y7QUFDcEgsVUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBQ2xDLFVBQU0sV0FBVyxTQUFTLGNBQWMsS0FBSztBQUM3QyxhQUFTLEtBQUssWUFBWSxRQUFRO0FBQ2xDLFVBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxTQUFTLE9BQU8sRUFBRSxDQUFDO0FBQzlDLFVBQU0saUJBQWlCLE9BQU87QUFBQSxNQUM3QixTQUFTO0FBQUEsTUFBRTtBQUFBLE1BQ1gsYUFBYSxNQUFNO0FBQUEsTUFDbkIsU0FBUztBQUFBLE1BQUU7QUFBQSxNQUNYLGFBQWE7QUFBQSxNQUFFO0FBQUEsTUFDZixlQUFlO0FBQUEsTUFBRTtBQUFBLE1BQ2pCLFVBQVU7QUFBQSxNQUFFO0FBQUEsSUFDYjtBQUNBLFVBQU0sT0FBTztBQUFBLE1BQ1osZ0JBQWdCO0FBQUEsTUFDaEIsb0JBQW9CLEVBQUUsYUFBYSxJQUFJLFlBQVksR0FBRztBQUFBLE1BQ3RELG9CQUFvQjtBQUFBLE1BQ3BCLGtCQUFrQixDQUFDO0FBQUEsTUFDbkIsaUJBQWlCLENBQUMsRUFBRTtBQUFBLE1BQ3BCLDBCQUEwQixvQkFBSSxJQUFJO0FBQUEsTUFDbEMsb0JBQW9CO0FBQUEsTUFDcEIsb0JBQW9CO0FBQUEsTUFDcEIsa0JBQWtCO0FBQUEsTUFDbEIsZ0JBQWdCO0FBQUEsTUFDaEIsc0JBQXNCO0FBQUEsTUFDdEIsZUFBZTtBQUFBLE1BQ2Ysb0JBQW9CO0FBQUEsTUFDcEIsaUJBQWlCO0FBQUEsTUFDakIsaUJBQWlCO0FBQUEsTUFDakIsc0JBQXNCLEVBQUUsVUFBVSxNQUFNLE9BQVU7QUFBQSxNQUNsRCxzQkFBc0I7QUFBQSxRQUNyQixnQkFBZ0IsT0FBTyxFQUFFLFVBQVU7QUFBQSxRQUFFLEVBQUU7QUFBQSxNQUN4QztBQUFBLE1BQ0EsYUFBYTtBQUFBLFFBQ1osNkJBQTZCLE1BQU07QUFBQSxRQUNuQyxtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLHNCQUFzQixNQUFNO0FBQUEsTUFDN0I7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLHVCQUF1QixNQUFNO0FBQUEsTUFDOUI7QUFBQSxNQUNBLFVBQVUsQ0FBZ0MsZUFBa0IsTUFBTSxJQUFJLFVBQVU7QUFBQSxNQUNoRix5QkFBeUIsTUFBTSxlQUFlO0FBQUEsTUFDOUMsa0JBQWtCLE9BQU8sRUFBRSxZQUFZLEdBQUcsaUJBQWlCLEVBQUU7QUFBQSxNQUM3RCxrQkFBa0IsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUMxQixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLHVCQUF1QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQy9CLHVCQUF1QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQy9CLHNCQUFzQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzlCLDJCQUEyQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ25DLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLGdCQUFnQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ3hCLGtCQUFrQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzFCLHNCQUFzQixNQUFNO0FBQUEsTUFDNUIsd0JBQXdCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDaEMsYUFBQUE7QUFBQSxNQUNBLG9CQUFvQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzVCLHlCQUF5QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ2pDLGtDQUFrQyxNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzFDLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsWUFBWSxNQUFNO0FBQUEsTUFDbEIsdUJBQXVCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDL0IsMEJBQTBCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDbEMseUJBQXlCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDakMsV0FBVyxDQUFDO0FBQUEsSUFDYjtBQUNBLGNBQVUsTUFBTSxRQUFRO0FBQ3hCLFdBQU8sRUFBRSxNQUFNLFNBQVMsTUFBTSxNQUFNLFFBQVEsRUFBRTtBQUFBLEVBQy9DO0FBRUEsV0FBUyxrQ0FBa0MsV0FBd0U7QUFDbEgsV0FBTyxvQkFBb0IsWUFBWTtBQUN0QyxZQUFNO0FBQUEsSUFDUCxDQUFDO0FBQUEsRUFDRjtBQUVBLFdBQVMseUNBQXlDLFdBSWhEO0FBQ0QsVUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBQ2xDLFVBQU0sV0FBVyxTQUFTLGNBQWMsS0FBSztBQUM3QyxhQUFTLEtBQUssWUFBWSxRQUFRO0FBQ2xDLFVBQU0sSUFBSSxFQUFFLFNBQVMsTUFBTSxTQUFTLE9BQU8sRUFBRSxDQUFDO0FBQzlDLFVBQU0sc0JBQXNCLE1BQU0sSUFBSSxJQUFJLFFBQTJCLENBQUM7QUFDdEUsVUFBTSxpQkFBaUIsTUFBTSxJQUFJLElBQUksUUFBMkIsQ0FBQztBQUNqRSxVQUFNLGlCQUFpQixDQUFDLGlCQUFvQztBQUFBLE1BQzNELFNBQVM7QUFBQSxNQUFFO0FBQUEsTUFDWDtBQUFBLE1BQ0EsU0FBUztBQUFBLE1BQUU7QUFBQSxNQUNYLGFBQWE7QUFBQSxNQUFFO0FBQUEsTUFDZixlQUFlO0FBQUEsTUFBRTtBQUFBLE1BQ2pCLFVBQVU7QUFBQSxNQUFFO0FBQUEsSUFDYjtBQUNBLFVBQU0sT0FBTztBQUFBLE1BQ1osZ0JBQWdCO0FBQUEsTUFDaEIsb0JBQW9CLEVBQUUsYUFBYSxJQUFJLFlBQVksR0FBRztBQUFBLE1BQ3RELG9CQUFvQjtBQUFBLE1BQ3BCLGtCQUFrQixDQUFDO0FBQUEsTUFDbkIsaUJBQWlCLENBQUMsSUFBSSxVQUFVO0FBQUEsTUFDaEMsMEJBQTBCLG9CQUFJLElBQUksQ0FBQyxDQUFDLFVBQVUsRUFBRSxZQUFZLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFBQSxNQUNyRixvQkFBb0I7QUFBQSxNQUNwQixvQkFBb0I7QUFBQSxNQUNwQixrQkFBa0I7QUFBQSxNQUNsQixnQkFBZ0I7QUFBQSxNQUNoQixzQkFBc0I7QUFBQSxNQUN0QixlQUFlO0FBQUEsTUFDZixvQkFBb0I7QUFBQSxNQUNwQixpQkFBaUI7QUFBQSxNQUNqQixpQkFBaUI7QUFBQSxNQUNqQixzQkFBc0IsRUFBRSxVQUFVLE1BQU0sT0FBVTtBQUFBLE1BQ2xELHNCQUFzQjtBQUFBLFFBQ3JCLGdCQUFnQixPQUFPLEVBQUUsVUFBVTtBQUFBLFFBQUUsRUFBRTtBQUFBLE1BQ3hDO0FBQUEsTUFDQSxhQUFhO0FBQUEsUUFDWiw2QkFBNkIsTUFBTTtBQUFBLFFBQ25DLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxNQUM3QjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2IsdUJBQXVCLE1BQU07QUFBQSxRQUM3QixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixNQUFNO0FBQUEsUUFDdEQsbUJBQW1CLFlBQVk7QUFDOUIsZ0JBQU0sSUFBSSxNQUFNLHdCQUF3QjtBQUFBLFFBQ3pDO0FBQUEsUUFDQSxhQUFhLFlBQVk7QUFDeEIsZ0JBQU0sSUFBSSxNQUFNLGtCQUFrQjtBQUFBLFFBQ25DO0FBQUEsTUFDRDtBQUFBLE1BQ0EsVUFBVSxDQUFnQyxlQUFrQixNQUFNLElBQUksVUFBVTtBQUFBLE1BQ2hGLHlCQUF5QixDQUFDLFVBQThCLGdCQUF3QixjQUFzQjtBQUNyRyxZQUFJLGNBQWMscUNBQXFDO0FBQ3RELGlCQUFPLGVBQWUsb0JBQW9CLEtBQUs7QUFBQSxRQUNoRDtBQUNBLFlBQUksY0FBYyxnQ0FBZ0M7QUFDakQsaUJBQU8sZUFBZSxNQUFNLElBQUk7QUFBQSxRQUNqQztBQUNBLGVBQU8sZUFBZSxlQUFlLEtBQUs7QUFBQSxNQUMzQztBQUFBLE1BQ0Esa0JBQWtCLE9BQU8sRUFBRSxZQUFZLEdBQUcsaUJBQWlCLEVBQUU7QUFBQSxNQUM3RCxrQkFBa0IsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUMxQixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLHVCQUF1QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQy9CLHVCQUF1QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQy9CLHNCQUFzQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzlCLDJCQUEyQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ25DLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLGdCQUFnQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ3hCLGtCQUFrQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzFCLHNCQUFzQixNQUFNO0FBQUEsTUFDNUIsd0JBQXdCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDaEMsYUFBYSxZQUFZO0FBQUEsTUFBRTtBQUFBLE1BQzNCLG9CQUFvQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzVCLHlCQUF5QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ2pDLGtDQUFrQyxNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzFDLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsWUFBWSxNQUFNO0FBQUEsTUFDbEIsdUJBQXVCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDL0IsMEJBQTBCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDbEMseUJBQXlCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDakMsV0FBVyxDQUFDO0FBQUEsSUFDYjtBQUNBLGNBQVUsTUFBTSxRQUFRO0FBQ3hCLFNBQUssWUFBWTtBQUFBLE1BQ2hCLElBQUksWUFBWSxRQUFnQjtBQUMvQixjQUFNO0FBQUEsTUFDUDtBQUFBLE1BQ0EsSUFBSSxjQUFjO0FBQ2pCLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxNQUNOLHFCQUFxQixPQUFlO0FBQ25DLDRCQUFvQixLQUFLLEVBQUUsTUFBTSxDQUFDO0FBQUEsTUFDbkM7QUFBQSxNQUNBLGdCQUFnQixPQUFlO0FBQzlCLHVCQUFlLEtBQUssRUFBRSxNQUFNLENBQUM7QUFBQSxNQUM5QjtBQUFBLE1BQ0EsU0FBUyxNQUFNLE1BQU0sUUFBUTtBQUFBLElBQzlCO0FBQUEsRUFDRDtBQUVBLE9BQUssNkRBQTZELE1BQU07QUFDdkUsUUFBSSxlQUFlO0FBQ25CLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEVBQUUsV0FBVyxLQUFLO0FBQUEsTUFDcEMsY0FBYyxFQUFFLGNBQWMsTUFBTTtBQUFFO0FBQUEsTUFBZ0IsRUFBRTtBQUFBLElBQ3pEO0FBQ0EsNkJBQXlCLE1BQU0sRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNuRCxXQUFPLFlBQVksY0FBYyxDQUFDO0FBQUEsRUFDbkMsQ0FBQztBQUVELE9BQUssMkRBQTJELE1BQU07QUFDckUsUUFBSSxhQUFhO0FBQ2pCLFFBQUksY0FBYztBQUNsQixVQUFNLE9BQU87QUFBQSxNQUNaLFlBQVk7QUFBQSxNQUNaLGVBQWU7QUFBQSxNQUNmLGtCQUFrQjtBQUFBLE1BQ2xCLGFBQWE7QUFBQSxRQUNaLHNCQUFzQixNQUFNO0FBQzNCO0FBQ0EsaUJBQU8sQ0FBQztBQUFBLFFBQ1Q7QUFBQSxNQUNEO0FBQUEsTUFDQSxnQkFBZ0IsRUFBRSxZQUFZLE1BQU07QUFBRTtBQUFBLE1BQWMsRUFBRTtBQUFBLElBQ3ZEO0FBQ0EsNkJBQXlCLE1BQU0sSUFBSTtBQUNuQyxXQUFPLFlBQVksYUFBYSxDQUFDO0FBQ2pDLFdBQU8sWUFBWSxZQUFZLENBQUM7QUFBQSxFQUNqQyxDQUFDO0FBRUQsT0FBSyx3REFBd0QsTUFBTTtBQUNsRSxRQUFJLGFBQWE7QUFDakIsVUFBTSxPQUFPO0FBQUEsTUFDWixZQUFZO0FBQUEsTUFDWixlQUFlO0FBQUEsTUFDZixrQkFBa0I7QUFBQSxNQUNsQixhQUFhO0FBQUEsUUFDWixzQkFBc0IsTUFBTSxDQUFDO0FBQUEsUUFDN0IsbUJBQW1CLE1BQU07QUFBQSxRQUN6QixVQUFVLE1BQU0sQ0FBQztBQUFBLE1BQ2xCO0FBQUEsTUFDQSxnQkFBZ0IsRUFBRSxZQUFZLE1BQU07QUFBRTtBQUFBLE1BQWMsRUFBRTtBQUFBLElBQ3ZEO0FBQ0EsNkJBQXlCLE1BQU0sSUFBSTtBQUNuQyxXQUFPLFlBQVksWUFBWSxDQUFDO0FBQUEsRUFDakMsQ0FBQztBQUVELE9BQUssa0hBQWtILE1BQU07QUFDNUgsUUFBSSxZQUFZO0FBQ2hCLFFBQUksaUJBQWlCO0FBQ3JCLFFBQUksYUFBYTtBQUNqQixRQUFJO0FBQ0osVUFBTSxrQkFBa0IsQ0FBQyxFQUFFLElBQUksUUFBUSxDQUFDO0FBQ3hDLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1osZUFBZTtBQUFBLE1BQ2Ysa0JBQWtCO0FBQUEsUUFDakIsV0FBVztBQUFBLFFBQ1gsVUFBVTtBQUFBLFVBQ1QsVUFBVTtBQUFBLFlBQ1QsRUFBRSxJQUFJLGdCQUFnQixTQUFTLEVBQUUsTUFBTSxPQUFPLEVBQUU7QUFBQSxZQUNoRCxFQUFFLElBQUksZ0JBQWdCLFNBQVMsRUFBRSxNQUFNLFlBQVksRUFBRTtBQUFBLFVBQ3REO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLHNCQUFzQixNQUFNO0FBQUEsUUFDNUIsbUJBQW1CLE1BQU0sYUFBYSxDQUFDO0FBQUEsUUFDdkMsVUFBVSxNQUFNLENBQUM7QUFBQSxNQUNsQjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2Isb0JBQW9CLE9BQU8sRUFBRSxNQUFNLFlBQVksY0FBYyxnQkFBZ0IsTUFBTSxXQUFXO0FBQUEsUUFDOUYsdUJBQXVCLE9BQU8sRUFBRSxlQUFlO0FBQUEsTUFDaEQ7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLFFBQ2YsdUJBQXVCLE1BQU0sZ0JBQWdCO0FBQUEsUUFDN0MsWUFBWSxDQUFDLFVBQThCLFlBQWtDO0FBQzVFO0FBQ0Esd0JBQWM7QUFBQSxRQUNmO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxxQkFBaUI7QUFDakIsV0FBTyxZQUFZLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxLQUFLO0FBQzlELFdBQU8sWUFBWSxLQUFLLGFBQWEsbUJBQW1CLEVBQUUsTUFBTSxXQUFXO0FBQzNFLFdBQU8sWUFBWSxLQUFLLGFBQWEsc0JBQXNCLEVBQUUsZ0JBQWdCLElBQUk7QUFFakYsNkJBQXlCLE1BQU0sZUFBZTtBQUM5QyxXQUFPLFlBQVksWUFBWSxDQUFDO0FBQ2hDLFdBQU8sR0FBRyxhQUFhLElBQUksY0FBYyxDQUFDO0FBQzFDLFdBQU8sR0FBRyxhQUFhLElBQUksY0FBYyxDQUFDO0FBRTFDLHFCQUFpQjtBQUNqQixnQkFBWTtBQUNaLDZCQUF5QixNQUFNLGVBQWU7QUFDOUMsV0FBTyxZQUFZLFlBQVksQ0FBQztBQUNoQyxXQUFPLFlBQVksYUFBYSxNQUFNLENBQUM7QUFBQSxFQUN4QyxDQUFDO0FBRUQsT0FBSyw0RkFBNEYsTUFBTTtBQUN0RyxRQUFJLGFBQWE7QUFDakIsVUFBTSxrQkFBa0IsQ0FBQyxFQUFFLElBQUksZUFBZSxDQUFDO0FBQy9DLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1osZUFBZTtBQUFBLE1BQ2Ysa0JBQWtCO0FBQUEsTUFDbEIsYUFBYTtBQUFBLFFBQ1osc0JBQXNCLE1BQU0sQ0FBQztBQUFBLFFBQzdCLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsVUFBVSxNQUFNLENBQUM7QUFBQSxNQUNsQjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2Isb0JBQW9CLE9BQU8sRUFBRSxNQUFNLGFBQWEsTUFBTSxXQUFXO0FBQUEsUUFDakUsdUJBQXVCLE9BQU8sRUFBRSxnQkFBZ0IsS0FBSztBQUFBLE1BQ3REO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxRQUNmLHVCQUF1QixNQUFNLGdCQUFnQjtBQUFBLFFBQzdDLFlBQVksTUFBTTtBQUFFO0FBQUEsUUFBYztBQUFBLE1BQ25DO0FBQUEsSUFDRDtBQUNBLDZCQUF5QixNQUFNLGVBQWU7QUFDOUMsV0FBTyxZQUFZLFlBQVksQ0FBQztBQUFBLEVBQ2pDLENBQUM7QUFFRCxPQUFLLHdGQUF3RixNQUFNO0FBQ2xHLFFBQUksYUFBYTtBQUNqQixVQUFNLE9BQU87QUFBQSxNQUNaLFlBQVk7QUFBQSxNQUNaLGVBQWU7QUFBQSxNQUNmLGtCQUFrQjtBQUFBLE1BQ2xCLGFBQWE7QUFBQSxRQUNaLHNCQUFzQixNQUFNLENBQUM7QUFBQSxRQUM3QixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLFVBQVUsTUFBTSxDQUFDO0FBQUEsTUFDbEI7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2pFLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLEtBQUs7QUFBQSxNQUN0RDtBQUFBLE1BQ0EsZ0JBQWdCO0FBQUEsUUFDZix1QkFBdUIsTUFBTTtBQUFBLFFBQzdCLFlBQVksTUFBTTtBQUFFO0FBQUEsUUFBYztBQUFBLE1BQ25DO0FBQUEsSUFDRDtBQUNBLDZCQUF5QixNQUFNLFlBQVk7QUFDM0MsV0FBTyxZQUFZLFlBQVksQ0FBQztBQUFBLEVBQ2pDLENBQUM7QUFFRCxPQUFLLDBHQUEwRyxNQUFNO0FBQ3BILFFBQUksWUFBWTtBQUNoQixRQUFJLGlCQUFpQjtBQUNyQixVQUFNLE9BQU87QUFBQSxNQUNaLGtCQUFrQixzQkFBc0IsRUFBRSxNQUFNLE9BQU8sQ0FBQztBQUFBLE1BQ3hELG1CQUFtQixNQUFNO0FBQUEsTUFDekIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU0sYUFBYSxDQUFDO0FBQUEsUUFDdkMsb0JBQW9CLE1BQU07QUFBQSxRQUMxQixVQUFVLE1BQU0sQ0FBQztBQUFBLE1BQ2xCO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sWUFBWSxjQUFjLGdCQUFnQixNQUFNLFdBQVc7QUFBQSxRQUM5Rix1QkFBdUIsT0FBTyxFQUFFLGVBQWU7QUFBQSxNQUNoRDtBQUFBLElBQ0Q7QUFFQSxXQUFPLFlBQVksa0NBQWtDLGlCQUFpQixJQUFJLENBQUMsR0FBRyxJQUFJO0FBRWxGLHFCQUFpQjtBQUNqQixXQUFPLFlBQVksS0FBSyxZQUFZLGtCQUFrQixHQUFHLEtBQUs7QUFDOUQsV0FBTyxZQUFZLGtDQUFrQyxpQkFBaUIsSUFBSSxDQUFDLEdBQUcsSUFBSTtBQUVsRixxQkFBaUI7QUFDakIsZ0JBQVk7QUFDWixXQUFPLFlBQVksa0NBQWtDLGlCQUFpQixJQUFJLENBQUMsR0FBRyxLQUFLO0FBQUEsRUFDcEYsQ0FBQztBQUVELE9BQUssb0dBQW9HLE1BQU07QUFDOUcsVUFBTSxPQUFPO0FBQUEsTUFDWixrQkFBa0I7QUFBQSxNQUNsQixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsb0JBQW9CLE1BQU07QUFBQSxRQUMxQixVQUFVLENBQUMsY0FBc0IsY0FBYyxhQUM1QyxDQUFDLEVBQUUsSUFBSSxjQUFjLE1BQU0sWUFBWSxNQUFNLGtCQUFrQixXQUFXLEtBQUssQ0FBQyxJQUNoRixDQUFDO0FBQUEsTUFDTDtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2Isb0JBQW9CLE9BQU8sRUFBRSxNQUFNLGFBQXNCLE1BQU0sV0FBVztBQUFBLFFBQzFFLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLEtBQUs7QUFBQSxNQUN0RDtBQUFBLElBQ0Q7QUFDQSxXQUFPLFlBQVksa0NBQWtDLGlCQUFpQixJQUFJLENBQUMsR0FBRyxJQUFJO0FBQUEsRUFDbkYsQ0FBQztBQUVELE9BQUssNEZBQTRGLE1BQU07QUFDdEcsVUFBTSxPQUFPO0FBQUEsTUFDWixrQkFBa0I7QUFBQSxNQUNsQixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsb0JBQW9CLE1BQU07QUFBQSxRQUMxQixVQUFVLE1BQU0sQ0FBQztBQUFBLE1BQ2xCO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBc0IsTUFBTSxXQUFXO0FBQUEsUUFDMUUsdUJBQXVCLE9BQU8sRUFBRSxnQkFBZ0IsS0FBSztBQUFBLE1BQ3REO0FBQUEsSUFDRDtBQUNBLFdBQU8sWUFBWSxrQ0FBa0MsaUJBQWlCLElBQUksQ0FBQyxHQUFHLEtBQUs7QUFBQSxFQUNwRixDQUFDO0FBRUQsV0FBUyw0QkFBNEIsU0FNdUI7QUFDM0QsVUFBTSxZQUFZLFFBQVEsYUFBYTtBQUN2QyxVQUFNLGlCQUFpQixRQUFRO0FBQy9CLFVBQU0sWUFBWSxRQUFRLGFBQWE7QUFDdkMsVUFBTSxXQUFXLFFBQVEsYUFBYTtBQUN0QyxVQUFNLGlCQUFpQixXQUFXLGFBQWE7QUFDL0MsV0FBTztBQUFBLE1BQ04sa0JBQWtCLFdBQVcsc0JBQXNCLEVBQUUsTUFBTSxPQUFPLENBQUMsSUFBSTtBQUFBLE1BQ3ZFLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU0sY0FBYyxhQUFhLENBQUM7QUFBQSxRQUNyRCxvQkFBb0IsTUFBTTtBQUFBLFFBQzFCLFVBQVUsQ0FBQyxjQUFzQixjQUFjLGlCQUFrQixRQUFRLFNBQVMsQ0FBQyxJQUFLLENBQUM7QUFBQSxNQUMxRjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2Isb0JBQW9CLE9BQU8sRUFBRSxNQUFNLFlBQVksY0FBYyxnQkFBZ0IsTUFBTSxXQUFXO0FBQUEsUUFDOUYsdUJBQXVCLE9BQU8sRUFBRSxlQUFlO0FBQUEsTUFDaEQ7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLE9BQUssZ0ZBQWdGLE1BQU07QUFDMUYsVUFBTSxPQUFPLDRCQUE0QixFQUFFLGdCQUFnQixNQUFNLFdBQVcsS0FBSyxDQUFDO0FBQ2xGLFdBQU8sWUFBWSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUM3RCxXQUFPLFlBQVksS0FBSyxhQUFhLHNCQUFzQixFQUFFLGdCQUFnQixJQUFJO0FBQ2pGLFdBQU8sWUFBWSxrQ0FBa0MsSUFBSSxHQUFHLEtBQUs7QUFBQSxFQUNsRSxDQUFDO0FBRUQsT0FBSyw4RUFBOEUsTUFBTTtBQUN4RixVQUFNLE9BQU8sNEJBQTRCLEVBQUUsZ0JBQWdCLE1BQU0sV0FBVyxNQUFNLFVBQVUsS0FBSyxDQUFDO0FBQ2xHLFdBQU8sWUFBWSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUM3RCxXQUFPLFlBQVksS0FBSyxhQUFhLHNCQUFzQixFQUFFLGdCQUFnQixJQUFJO0FBQ2pGLFdBQU8sWUFBWSxrQ0FBa0MsSUFBSSxHQUFHLElBQUk7QUFBQSxFQUNqRSxDQUFDO0FBRUQsT0FBSyxxRkFBcUYsTUFBTTtBQUMvRixVQUFNLE9BQU8sNEJBQTRCO0FBQUEsTUFDeEMsZ0JBQWdCO0FBQUEsTUFDaEIsV0FBVztBQUFBLE1BQ1gsT0FBTyxDQUFDLEVBQUUsSUFBSSxjQUFjLE1BQU0sWUFBWSxNQUFNLGtCQUFrQixXQUFXLEtBQUssQ0FBQztBQUFBLElBQ3hGLENBQUM7QUFDRCxXQUFPLFlBQVksS0FBSyxZQUFZLGtCQUFrQixHQUFHLElBQUk7QUFDN0QsV0FBTyxZQUFZLGtDQUFrQyxJQUFJLEdBQUcsSUFBSTtBQUFBLEVBQ2pFLENBQUM7QUFFRCxPQUFLLG9HQUFvRyxNQUFNO0FBQzlHLFVBQU0sY0FBMEIsRUFBRSxNQUFNLFVBQVUsUUFBUSxzQkFBc0I7QUFDaEYsVUFBTSxhQUF5QixFQUFFLE1BQU0sT0FBTztBQUM5QyxVQUFNLFNBQVMsU0FBUyxjQUFjLEtBQUs7QUFDM0MsV0FBTyxZQUFZO0FBQ25CLFdBQU8sU0FBUztBQUNoQixVQUFNLGdCQUFnQixTQUFTLGNBQWMsS0FBSztBQUNsRCxrQkFBYyxZQUFZLE1BQU07QUFDaEMsVUFBTSxzQkFBZ0MsQ0FBQztBQUN2QyxVQUFNLE9BQU87QUFBQSxNQUNaLGtCQUFrQjtBQUFBLE1BQ2xCLG1CQUFtQixNQUFNO0FBQUEsTUFDekI7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsb0JBQW9CLE1BQU07QUFBQSxRQUMxQixVQUFVLENBQUMsY0FBc0IsY0FBYyxXQUM1QyxDQUFDLEVBQUUsSUFBSSxXQUFXLE1BQU0sWUFBWSxNQUFNLGtCQUFrQixXQUFXLEtBQUssQ0FBQyxJQUM3RSxDQUFDO0FBQUEsUUFDSixnQkFBZ0IsQ0FBQyxjQUFzQjtBQUN0Qyw4QkFBb0IsS0FBSyxTQUFTO0FBQ2xDLGlCQUFPLGNBQWMsV0FBVyxjQUFjO0FBQUEsUUFDL0M7QUFBQSxNQUNEO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBc0IsTUFBTSxXQUFXO0FBQUEsUUFDMUUsdUJBQXVCLE9BQU8sRUFBRSxnQkFBZ0IsS0FBSztBQUFBLE1BQ3REO0FBQUEsSUFDRDtBQUNBLFdBQU8sWUFBWSxrQ0FBa0MsaUJBQWlCLElBQUksQ0FBQyxHQUFHLElBQUk7QUFDbEYsK0JBQTJCLElBQW1FO0FBQzlGLFdBQU8sZ0JBQWdCLHFCQUFxQixDQUFDLFFBQVEsQ0FBQztBQUN0RCxXQUFPLFlBQVksT0FBTyxRQUFRLEtBQUs7QUFDdkMsV0FBTyxHQUFHLE9BQU8sYUFBYSxTQUFTLHFCQUFxQixDQUFDO0FBQUEsRUFDOUQsQ0FBQztBQUVELFdBQVMsNEJBQTRCLFNBT25DO0FBQ0QsVUFBTSxRQUFRLEVBQUUsb0JBQW9CLEVBQUU7QUFDdEMsVUFBTSxVQUFVLG9CQUFJLElBQW9CO0FBQ3hDLFFBQUksUUFBUSxlQUFlLFFBQVc7QUFDckMsY0FBUSxJQUFJLG1CQUFtQixRQUFRLFVBQVU7QUFBQSxJQUNsRDtBQUNBLFVBQU0sV0FBVyxRQUFRLGFBQWE7QUFDdEMsVUFBTSxPQUE4RjtBQUFBLE1BQ25HLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDMUI7QUFBQSxNQUNBLGtCQUFrQixXQUNmO0FBQUEsUUFDRDtBQUFBLFFBQ0EsZUFBZSxPQUFPLFNBQWlCO0FBQ3RDLGdCQUFNO0FBQ04saUJBQU8sRUFBRSxJQUFJLE1BQWUsV0FBVyxPQUFnQixTQUFTLGVBQWU7QUFBQSxRQUNoRjtBQUFBLE1BQ0QsSUFDRTtBQUFBLE1BQ0gsY0FBYztBQUFBLFFBQ2Isb0JBQW9CLE9BQXdCLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2xGLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLFFBQVEsZUFBZTtBQUFBLE1BQ3hFO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQSxJQUFJLHFCQUFxQjtBQUFFLGVBQU8sTUFBTTtBQUFBLE1BQW9CO0FBQUEsSUFDN0Q7QUFBQSxFQUNEO0FBRUEsT0FBSyxrRUFBa0UsWUFBWTtBQUNsRixVQUFNLFVBQVUsNEJBQTRCLEVBQUUsZ0JBQWdCLEtBQUssQ0FBQztBQUNwRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUNyRSxXQUFPLFlBQVksUUFBUSxLQUFLLGFBQWEsc0JBQXNCLEVBQUUsZ0JBQWdCLElBQUk7QUFDekYsVUFBTSxVQUFVLE1BQU0sMkJBQTJCLFFBQVEsTUFBTSxpQkFBaUI7QUFDaEYsV0FBTyxnQkFBZ0IsU0FBUyxFQUFFLElBQUksT0FBTyxRQUFRLGNBQWMsQ0FBQztBQUNwRSxXQUFPLFlBQVksUUFBUSxvQkFBb0IsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLHdGQUF3RixZQUFZO0FBQ3hHLFVBQU0sVUFBVSw0QkFBNEIsRUFBRSxnQkFBZ0IsTUFBTSxZQUFZLGtCQUFrQixDQUFDO0FBQ25HLFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxJQUFJO0FBQ3JFLFVBQU0sVUFBVSxNQUFNLDJCQUEyQixRQUFRLE1BQU0saUJBQWlCO0FBQ2hGLFdBQU8sZ0JBQWdCLFNBQVMsRUFBRSxJQUFJLE1BQU0sV0FBVyxPQUFPLFNBQVMsa0JBQWtCLENBQUM7QUFDMUYsV0FBTyxZQUFZLFFBQVEsb0JBQW9CLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSywwQ0FBMEMsWUFBWTtBQUMxRCxVQUFNLFVBQVUsNEJBQTRCLEVBQUUsZ0JBQWdCLE1BQU0sQ0FBQztBQUNyRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUNyRSxXQUFPLFlBQVksUUFBUSxLQUFLLGFBQWEsc0JBQXNCLEVBQUUsZ0JBQWdCLEtBQUs7QUFDMUYsVUFBTSxVQUFVLE1BQU0sMkJBQTJCLFFBQVEsTUFBTSxpQkFBaUI7QUFDaEYsV0FBTyxnQkFBZ0IsU0FBUyxFQUFFLElBQUksTUFBTSxXQUFXLE9BQU8sU0FBUyxlQUFlLENBQUM7QUFDdkYsV0FBTyxZQUFZLFFBQVEsb0JBQW9CLENBQUM7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyxvRUFBb0UsWUFBWTtBQUNwRixVQUFNLFVBQVUsNEJBQTRCLEVBQUUsZ0JBQWdCLE1BQU0sVUFBVSxNQUFNLENBQUM7QUFDckYsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLGtCQUFrQixHQUFHLElBQUk7QUFDckUsVUFBTSxVQUFVLE1BQU0sMkJBQTJCLFFBQVEsTUFBTSxpQkFBaUI7QUFDaEYsV0FBTyxnQkFBZ0IsU0FBUyxFQUFFLElBQUksT0FBTyxRQUFRLGNBQWMsQ0FBQztBQUNwRSxXQUFPLFlBQVksUUFBUSxvQkFBb0IsQ0FBQztBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLHdJQUF3SSxZQUFZO0FBQ3hKLFVBQU0sWUFBWSxJQUFJLE1BQU0sYUFBYTtBQUN6QyxVQUFNLFFBQTJDLENBQUM7QUFDbEQsVUFBTSxpQ0FBaUMsV0FBVyxNQUFNO0FBQ3ZELHdDQUFrQztBQUFBLFFBQ2pDLGdCQUFnQixPQUFPLE9BQWUsU0FBb0I7QUFDekQsZ0JBQU0sS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDO0FBQ3ZCLGdCQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0QsR0FBRyxDQUFDLHVCQUF1QixDQUFDO0FBQUEsSUFDN0IsQ0FBQztBQUNELFdBQU8sWUFBWSxNQUFNLFFBQVEsQ0FBQztBQUNsQyxXQUFPLFlBQVksTUFBTSxDQUFDLEVBQUcsSUFBSSxxQ0FBcUM7QUFDdEUsVUFBTSxPQUFPLE1BQU0sQ0FBQyxFQUFHLEtBQUssQ0FBQztBQUM3QixXQUFPLFlBQVksS0FBSyxRQUFRLENBQUM7QUFDakMsV0FBTyxZQUFZLEtBQUssQ0FBQyxFQUFHLFNBQVMsSUFBSSxHQUFHLHVCQUF1QjtBQUFBLEVBQ3BFLENBQUM7QUFFRCxPQUFLLHNGQUFzRixZQUFZO0FBQ3RHLFVBQU0sU0FBUyxNQUFNLGtCQUFrQixHQUFHLFFBQVEsSUFBSSxDQUFDLGlGQUFpRjtBQUN4SSxVQUFNLGNBQWM7QUFDcEIsV0FBTyxHQUFHLE9BQU8sU0FBUywwRkFBMEYsQ0FBQztBQUNySCxXQUFPLEdBQUcsT0FBTyxTQUFTLFdBQVcsQ0FBQztBQUN0QyxXQUFPLEdBQUcsQ0FBQyxPQUFPLFNBQVMsMENBQTBDLENBQUM7QUFBQSxFQUN2RSxDQUFDO0FBRUQsV0FBUyxxQkFBcUIsT0FBTyxnQkFBa0Q7QUFDdEYsV0FBTztBQUFBLE1BQ04sbUJBQW1CLElBQUksS0FBSyxJQUFJO0FBQUEsTUFDaEMsYUFBYSxJQUFJLG9CQUFvQixrQ0FBa0M7QUFBQSxJQUN4RTtBQUFBLEVBQ0Q7QUFFQSxXQUFTLG1CQUFtQixTQU16QjtBQUNGLFdBQU87QUFBQSxNQUNOLGtCQUFrQjtBQUFBLFFBQ2pCLGNBQWMsUUFBUTtBQUFBLE1BQ3ZCO0FBQUEsTUFDQSxZQUFZLFFBQVEsY0FBYztBQUFBLE1BQ2xDLHNCQUFzQixRQUFRO0FBQUEsTUFDOUIsY0FBYztBQUFBLFFBQ2Isd0JBQXdCLE1BQW9EO0FBQzNFLGtCQUFRLGVBQWUsSUFBSTtBQUFBLFFBQzVCO0FBQUEsTUFDRDtBQUFBLE1BQ0EsMkJBQTJCO0FBQzFCLGdCQUFRLGtCQUFrQjtBQUFBLE1BQzNCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFFQSxPQUFLLHdIQUF3SCxZQUFZO0FBQ3hJLFVBQU0sWUFBWSxJQUFJLE1BQU0sWUFBWTtBQUN4QyxVQUFNLE9BQU8sbUJBQW1CO0FBQUEsTUFDL0IsY0FBYyxhQUFhO0FBQUEsUUFDMUIsbUJBQW1CLElBQUksS0FBSyxjQUFjO0FBQUEsUUFDMUMsWUFBWSxJQUFJLG9CQUFvQixrQ0FBa0M7QUFBQSxNQUN2RTtBQUFBLE1BQ0EsY0FBYyxNQUFNO0FBQ25CLGNBQU07QUFBQSxNQUNQO0FBQUEsSUFDRCxDQUFDO0FBQ0QsVUFBTSxpQ0FBaUMsV0FBVyxNQUFNLDRDQUE0QyxJQUFJLENBQUM7QUFBQSxFQUMxRyxDQUFDO0FBRUQsT0FBSyx1SUFBdUksWUFBWTtBQUN2SixVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxPQUFPLG1CQUFtQjtBQUFBLE1BQy9CLGNBQWMsTUFBTSxRQUFRLE9BQU8sSUFBSSxNQUFNLG1CQUFtQixDQUFDO0FBQUEsTUFDakUsc0JBQXNCLHFCQUFxQixZQUFZO0FBQUEsTUFDdkQsY0FBYyxNQUFNO0FBQ25CLGNBQU07QUFBQSxNQUNQO0FBQUEsSUFDRCxDQUFDO0FBQ0QsVUFBTSxpQ0FBaUMsV0FBVyxNQUFNLDRDQUE0QyxJQUFJLENBQUM7QUFBQSxFQUMxRyxDQUFDO0FBRUQsT0FBSywwRkFBMEYsWUFBWTtBQUMxRyxVQUFNLFNBQVMsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLElBQUksQ0FBQyxvRUFBb0U7QUFDM0gsVUFBTSxjQUFjO0FBQ3BCLFdBQU8sR0FBRyxPQUFPLFNBQVMsb0RBQW9ELENBQUM7QUFDL0UsV0FBTyxHQUFHLE9BQU8sU0FBUyx1RUFBdUUsQ0FBQztBQUNsRyxXQUFPLEdBQUcsT0FBTyxTQUFTLFdBQVcsQ0FBQztBQUN0QyxXQUFPLEdBQUcsQ0FBQyxPQUFPLFNBQVMsdUVBQXVFLENBQUM7QUFBQSxFQUNwRyxDQUFDO0FBRUQsV0FBUyxpQkFBaUIsTUFBdUU7QUFDaEcsV0FBTztBQUFBLEVBQ1I7QUFFQSxXQUFTLHNCQUFzQixNQUFrQjtBQUNoRCxXQUFPO0FBQUEsTUFDTixXQUFXO0FBQUEsTUFDWCxVQUFVO0FBQUEsUUFDVCxXQUFXO0FBQUEsUUFDWDtBQUFBLFFBQ0EsVUFBVSxDQUFDO0FBQUEsUUFDWCxTQUFTLEVBQUUsUUFBUSxDQUFDLEVBQUU7QUFBQSxRQUN0QixnQkFBZ0IsQ0FBQztBQUFBLFFBQ2pCLG1CQUFtQixDQUFDO0FBQUEsTUFDckI7QUFBQSxNQUNBLGFBQWEsb0JBQUksSUFBSTtBQUFBLE1BQ3JCLFNBQVMsb0JBQUksSUFBSTtBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUVBLFdBQVMsc0JBQXNCLFNBSXlIO0FBQ3ZKLFVBQU0sV0FBVyxRQUFRO0FBQ3pCLFVBQU0sYUFBYSxRQUFRO0FBQzNCLFVBQU0sUUFBUSxFQUFFLE9BQU8sRUFBRTtBQUN6QixVQUFNLFFBQVEsU0FBUyxjQUFjLE1BQU07QUFDM0MsVUFBTSxTQUFTLFNBQVMsY0FBYyxLQUFLO0FBQzNDLFdBQU8sWUFBWTtBQUNuQixXQUFPLFNBQVM7QUFDaEIsVUFBTSxnQkFBZ0IsU0FBUyxjQUFjLEtBQUs7QUFDbEQsa0JBQWMsWUFBWSxNQUFNO0FBQ2hDLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1osUUFBUTtBQUFBLE1BQ1IsZUFBZTtBQUFBLE1BQ2YsZ0JBQWdCO0FBQUEsTUFDaEIsbUJBQW1CO0FBQUEsTUFDbkIscUJBQXFCLENBQUM7QUFBQSxNQUN0QixrQkFBa0Isc0JBQXNCLFFBQVE7QUFBQSxNQUNoRCxrQkFBa0I7QUFBQSxNQUNsQjtBQUFBLE1BQ0EsYUFBYTtBQUFBLE1BQ2IsSUFBSSxzQkFBc0I7QUFBRSxlQUFPLE1BQU07QUFBQSxNQUFPO0FBQUEsTUFDaEQsYUFBYTtBQUFBLFFBQ1osZ0JBQWdCLENBQUMsY0FBc0I7QUFDdEMsZ0JBQU07QUFDTixpQkFBTyxZQUFZLFdBQVcsVUFBVTtBQUN4QyxpQkFBTyxRQUFRLGlCQUFpQixTQUFTLEtBQUs7QUFBQSxRQUMvQztBQUFBLFFBQ0EsVUFBVSxNQUFNLENBQUM7QUFBQSxRQUNqQixvQkFBb0IsTUFBTTtBQUFBLE1BQzNCO0FBQUEsTUFDQSxtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLGtCQUFrQixFQUFFLHdCQUF3QixNQUFNLENBQUMsRUFBRTtBQUFBLE1BQ3JELGNBQWMsRUFBRSxjQUFjLE1BQU07QUFBQSxNQUFFLEVBQUU7QUFBQSxNQUN4QyxnQkFBZ0IsQ0FBQztBQUFBLE1BQ2pCLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLHVCQUF1QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQy9CLDBCQUEwQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ2xDLCtCQUErQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ3ZDLGtCQUFrQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzFCLGVBQWUsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUN2Qix5QkFBeUIsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUNqQyxXQUFXLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxRQUFRLE1BQU07QUFBQSxNQUFFLEVBQUUsRUFBRSxFQUFFO0FBQUEsTUFDeEQsY0FBYyxFQUFFLFFBQVEsT0FBTyxhQUFhLE1BQU07QUFBQSxNQUFFLEVBQUU7QUFBQSxNQUN0RCxVQUFVLEVBQUUsY0FBYyxNQUFNO0FBQUEsTUFBRSxFQUFFO0FBQUEsTUFDcEMsU0FBUyxDQUFDO0FBQUEsTUFDVixlQUFlLEVBQUUsU0FBUyxDQUFDLEVBQUU7QUFBQSxNQUM3QixjQUFjLEVBQUUsU0FBUyxFQUFFLFFBQVEsS0FBSyxFQUFFO0FBQUEsSUFDM0M7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUVBLE9BQUssNEdBQTRHLE1BQU07QUFDdEgsVUFBTSxVQUFzQixFQUFFLE1BQU0sVUFBVSxRQUFRLDhCQUE4QjtBQUNwRixlQUFXLFlBQVksQ0FBQyxFQUFFLE1BQU0sT0FBZ0IsR0FBRyxFQUFFLE1BQU0sVUFBbUIsQ0FBQyxHQUFHO0FBQ2pGLFlBQU0sT0FBTyxzQkFBc0IsRUFBRSxVQUFVLFlBQVksUUFBUSxDQUFDO0FBQ3BFLCtCQUF5QixNQUFNLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDbkQsYUFBTyxHQUFHLEtBQUssc0JBQXNCLENBQUM7QUFDdEMsYUFBTyxnQkFBZ0IsS0FBSyxZQUFZLGVBQWUsVUFBVSxHQUFHLE9BQU87QUFDM0UsYUFBTyxlQUFlLEtBQUssaUJBQWlCLGFBQWEsY0FBYztBQUN2RSxhQUFPLGVBQWUsS0FBSyxpQkFBaUIsYUFBYSxpQkFBaUI7QUFDMUUsYUFBTyxZQUFZLEtBQUssaUJBQWlCLGFBQWEsc0JBQXNCLE9BQU8sQ0FBQztBQUNwRixhQUFPLFlBQVksS0FBSyxpQkFBaUIsYUFBYSxZQUFZLEdBQUcsc0JBQXNCLE9BQU8sQ0FBQztBQUNuRyxhQUFPLFlBQVksS0FBSyxpQkFBaUIsT0FBTyxzQkFBc0IsT0FBTyxDQUFDO0FBRTlFLGFBQU8sWUFBWSxLQUFLLFlBQVksUUFBUSxJQUFJO0FBQ2hELGFBQU8sWUFBWSxLQUFLLFlBQVksYUFBYSxFQUFFO0FBQUEsSUFDcEQ7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDhFQUE4RSxNQUFNO0FBQ3hGLFVBQU0sT0FBbUIsRUFBRSxNQUFNLE9BQU87QUFDeEMsVUFBTSxPQUFPLHNCQUFzQixFQUFFLFVBQVUsTUFBTSxZQUFZLEtBQUssQ0FBQztBQUN2RSw2QkFBeUIsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ25ELFdBQU8sR0FBRyxLQUFLLHNCQUFzQixDQUFDO0FBQ3RDLFdBQU8sWUFBWSxLQUFLLGlCQUFpQixhQUFhLGNBQWM7QUFDcEUsV0FBTyxZQUFZLEtBQUssaUJBQWlCLE9BQU8sY0FBYztBQUM5RCxXQUFPLFlBQVksS0FBSyxZQUFZLFFBQVEsSUFBSTtBQUFBLEVBQ2pELENBQUM7QUFFRCxPQUFLLDBGQUEwRixNQUFNO0FBQ3BHLFVBQU0sVUFBc0IsRUFBRSxNQUFNLFVBQVUsUUFBUSw4QkFBOEI7QUFDcEYsVUFBTSxPQUFPLHNCQUFzQixFQUFFLFVBQVUsRUFBRSxNQUFNLE9BQU8sR0FBRyxZQUFZLFFBQVEsQ0FBQztBQUN0RixxQkFBaUIsTUFBTSxFQUFFLE1BQU0sT0FBTyxDQUFDO0FBQ3ZDLFdBQU8sZUFBZSxLQUFLLGlCQUFpQixhQUFhLGNBQWM7QUFDdkUsV0FBTyxZQUFZLEtBQUssaUJBQWlCLGFBQWEsc0JBQXNCLE9BQU8sQ0FBQztBQUNwRixXQUFPLFlBQVksS0FBSyxpQkFBaUIsT0FBTyxzQkFBc0IsT0FBTyxDQUFDO0FBRTlFLCtCQUEyQixNQUFNLEVBQUUsTUFBTSxPQUFPLENBQUM7QUFDakQsV0FBTyxZQUFZLEtBQUssWUFBWSxRQUFRLElBQUk7QUFDaEQsV0FBTyxZQUFZLEtBQUssWUFBWSxhQUFhLEVBQUU7QUFBQSxFQUNwRCxDQUFDO0FBRUQsT0FBSyx5R0FBeUcsWUFBWTtBQUN6SCxVQUFNLFNBQVMsTUFBTSxrQkFBa0IsR0FBRyxRQUFRLElBQUksQ0FBQyxvRUFBb0U7QUFDM0gsVUFBTSxjQUFjLE9BQU8sUUFBUSxzREFBc0Q7QUFDekYsVUFBTSxVQUFVLE9BQU8sUUFBUSxpREFBaUQ7QUFDaEYsV0FBTyxHQUFHLGVBQWUsS0FBSyxVQUFVLFdBQVc7QUFDbkQsVUFBTSxjQUFjLE9BQU8sTUFBTSxhQUFhLE9BQU8sUUFBUSxRQUFRLFdBQVcsQ0FBQztBQUNqRixVQUFNLFVBQVUsT0FBTyxNQUFNLFNBQVMsT0FBTyxRQUFRLFFBQVEsT0FBTyxDQUFDO0FBQ3JFLFdBQU8sR0FBRyxZQUFZLFNBQVMsaURBQWlELENBQUM7QUFDakYsV0FBTyxHQUFHLFlBQVksU0FBUyxpQ0FBaUMsQ0FBQztBQUNqRSxXQUFPLEdBQUcsWUFBWSxTQUFTLDBCQUEwQixDQUFDO0FBQzFELFdBQU8sR0FBRyxZQUFZLFFBQVEsaURBQWlELElBQUksWUFBWSxRQUFRLGlDQUFpQyxDQUFDO0FBQ3pJLFdBQU8sR0FBRyxZQUFZLFFBQVEsaUNBQWlDLElBQUksWUFBWSxRQUFRLDBCQUEwQixDQUFDO0FBQ2xILFdBQU8sR0FBRyxRQUFRLFNBQVMsaURBQWlELENBQUM7QUFDN0UsV0FBTyxHQUFHLFFBQVEsU0FBUyxpQ0FBaUMsQ0FBQztBQUM3RCxXQUFPLEdBQUcsUUFBUSxTQUFTLDBCQUEwQixDQUFDO0FBQ3RELFdBQU8sR0FBRyxRQUFRLFFBQVEsaURBQWlELElBQUksUUFBUSxRQUFRLGlDQUFpQyxDQUFDO0FBQ2pJLFdBQU8sR0FBRyxRQUFRLFFBQVEsaUNBQWlDLElBQUksUUFBUSxRQUFRLDBCQUEwQixDQUFDO0FBRTFHLFVBQU0sVUFBc0IsRUFBRSxNQUFNLFVBQVUsUUFBUSw4QkFBOEI7QUFDcEYsVUFBTSxXQUF3QztBQUFBLE1BQzdDLEVBQUUsSUFBSSxNQUFNLE1BQU0sUUFBUSxNQUFNLEdBQUc7QUFBQSxNQUNuQyxFQUFFLElBQUksTUFBTSxNQUFNLFFBQVEsTUFBTSxHQUFHO0FBQUEsSUFDcEM7QUFDQSxVQUFNLFdBQVcsSUFBSSxnQkFBZ0I7QUFDckMsVUFBTSxPQUFPLHNCQUFzQixFQUFFLFVBQVUsRUFBRSxNQUFNLE9BQU8sR0FBRyxZQUFZLFFBQVEsQ0FBQztBQUN0RixTQUFLLHNCQUFzQjtBQUMzQixTQUFLLGlCQUFpQixjQUFjO0FBQ3BDLFNBQUssaUJBQWlCLFFBQVE7QUFDOUIsV0FBTyxPQUFPLE1BQU07QUFBQSxNQUNuQixxQkFBcUI7QUFBQSxNQUNyQixjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixLQUFLO0FBQUEsTUFDdEQ7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLEdBQUcsS0FBSztBQUFBLFFBQ1IsbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLG9CQUFvQixNQUFNO0FBQ3pCLGdCQUFNLElBQUksTUFBTSxpREFBaUQ7QUFBQSxRQUNsRTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLGNBQWMsTUFBTTtBQUNuQixnQkFBTSxJQUFJLE1BQU0sc0RBQXNEO0FBQUEsUUFDdkU7QUFBQSxRQUNBLHFCQUFxQixNQUFNO0FBQUEsUUFBRTtBQUFBLE1BQzlCO0FBQUEsSUFDRCxDQUFDO0FBQ0QsVUFBTSxhQUFhLEtBQUs7QUFDeEIsb0JBQWdCLE1BQXdELFVBQVU7QUFDbEYsV0FBTyxZQUFZLEtBQUssa0JBQWtCLFVBQVU7QUFDcEQsV0FBTyxZQUFZLEtBQUsscUJBQXFCLFFBQVE7QUFDckQsV0FBTyxZQUFZLEtBQUssaUJBQWlCLGFBQWEsY0FBYztBQUNwRSw0QkFBd0IsSUFBSTtBQUM1QixxQkFBaUIsSUFBSTtBQUNyQixXQUFPLFlBQVksS0FBSyxrQkFBa0IsVUFBVTtBQUNwRCxXQUFPLFlBQVksS0FBSyxxQkFBcUIsUUFBUTtBQUNyRCxXQUFPLGVBQWUsS0FBSyxpQkFBaUIsYUFBYSxjQUFjO0FBQ3ZFLFdBQU8sWUFBWSxLQUFLLGlCQUFpQixhQUFhLHNCQUFzQixPQUFPLENBQUM7QUFDcEYsV0FBTyxZQUFZLEtBQUssaUJBQWlCLE9BQU8sc0JBQXNCLE9BQU8sQ0FBQztBQUM5RSxXQUFPLFlBQVksS0FBSyxpQkFBaUIsYUFBYSxZQUFZLEdBQUcsc0JBQXNCLE9BQU8sQ0FBQztBQUNuRyxhQUFTLFFBQVE7QUFBQSxFQUNsQixDQUFDO0FBRUQsT0FBSyxvREFBb0QsTUFBTTtBQUM5RCxVQUFNLFdBQVcsSUFBSSxnQkFBZ0I7QUFDckMsYUFBUyxRQUFRO0FBQ2pCLFFBQUksZUFBZTtBQUNuQixRQUFJLFVBQVU7QUFDZCxVQUFNLE9BQU87QUFBQSxNQUNaLFlBQVk7QUFBQSxNQUNaLHFCQUFxQjtBQUFBLE1BQ3JCLGtCQUFrQixFQUFFLFdBQVcsS0FBSztBQUFBLE1BQ3BDLHFCQUFxQixDQUFDO0FBQUEsTUFDdEIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixvQkFBb0IsTUFBTTtBQUN6QjtBQUNBLGlCQUFPLEVBQUUsV0FBVyxNQUFNLFVBQVUsRUFBRSxXQUFXLEtBQUssRUFBRTtBQUFBLFFBQ3pEO0FBQUEsTUFDRDtBQUFBLE1BQ0EsY0FBYyxFQUFFLGNBQWMsTUFBTTtBQUFFO0FBQUEsTUFBZ0IsRUFBRTtBQUFBLElBQ3pEO0FBQ0Esb0JBQWdCLE1BQU0sRUFBRTtBQUN4QixXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxTQUFTLENBQUM7QUFBQSxFQUM5QixDQUFDO0FBRUQsT0FBSyw0REFBNEQsTUFBTTtBQUN0RSxVQUFNLFdBQVcsSUFBSSxnQkFBZ0I7QUFDckMsUUFBSSxlQUFlO0FBQ25CLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1oscUJBQXFCO0FBQUEsTUFDckIsa0JBQWtCLEVBQUUsV0FBVyxLQUFLO0FBQUEsTUFDcEMscUJBQXFCLENBQUMsRUFBRSxJQUFJLEtBQUssQ0FBQztBQUFBLE1BQ2xDLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDMUI7QUFBQSxNQUNBLGNBQWMsRUFBRSxjQUFjLE1BQU07QUFBRTtBQUFBLE1BQWdCLEVBQUU7QUFBQSxJQUN6RDtBQUNBLG9CQUFnQixNQUFNLEVBQUU7QUFDeEIsV0FBTyxZQUFZLGNBQWMsQ0FBQztBQUNsQyxXQUFPLFlBQVksS0FBSyxrQkFBa0IsTUFBUztBQUNuRCxXQUFPLGdCQUFnQixLQUFLLHFCQUFxQixDQUFDLENBQUM7QUFDbkQsYUFBUyxRQUFRO0FBQUEsRUFDbEIsQ0FBQztBQUVELE9BQUssMEZBQTBGLE1BQU07QUFDcEcsVUFBTSxXQUFXLElBQUksZ0JBQWdCO0FBQ3JDLFFBQUksZUFBZTtBQUNuQixRQUFJLFVBQVU7QUFDZCxRQUFJLGVBQWU7QUFDbkIsVUFBTSxPQUFPO0FBQUEsTUFDWixZQUFZO0FBQUEsTUFDWixxQkFBcUI7QUFBQSxNQUNyQixrQkFBa0IsRUFBRSxXQUFXLGdCQUFnQjtBQUFBLE1BQy9DLHFCQUFxQixDQUFDLEVBQUUsSUFBSSxLQUFLLEdBQUcsRUFBRSxJQUFJLEtBQUssQ0FBQztBQUFBLE1BQ2hELGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1QixvQkFBb0IsTUFBTTtBQUN6QjtBQUNBLGlCQUFPLEVBQUUsV0FBVyxpQkFBaUIsVUFBVSxFQUFFLFdBQVcsZ0JBQWdCLEVBQUU7QUFBQSxRQUMvRTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLGNBQWMsQ0FBQyxZQUFnQztBQUM5QztBQUNBLGNBQUksUUFBUSxXQUFXLEdBQUc7QUFDekI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0Esb0JBQWdCLE1BQU0sRUFBRTtBQUN4QixXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxjQUFjLENBQUM7QUFDbEMsV0FBTyxZQUFZLFNBQVMsQ0FBQztBQUM3QixXQUFPLFlBQVksS0FBSyxrQkFBa0IsTUFBUztBQUNuRCxXQUFPLFlBQVksS0FBSyxvQkFBb0IsUUFBUSxDQUFDO0FBQ3JELGFBQVMsUUFBUTtBQUFBLEVBQ2xCLENBQUM7QUFFRCxPQUFLLDRFQUE0RSxNQUFNO0FBQ3RGLFVBQU0sV0FBVyxJQUFJLGdCQUFnQjtBQUNyQyxVQUFNLGFBQWEsRUFBRSxXQUFXLGdCQUFnQjtBQUNoRCxVQUFNLFdBQVcsQ0FBQyxFQUFFLElBQUksS0FBSyxHQUFHLEVBQUUsSUFBSSxLQUFLLENBQUM7QUFDNUMsUUFBSSxlQUFlO0FBQ25CLFFBQUksVUFBVTtBQUNkLFVBQU0saUJBQWlCO0FBQUEsTUFDdEIsVUFBVTtBQUFBLE1BQ1YsVUFBVTtBQUFFLGFBQUssV0FBVztBQUFBLE1BQU07QUFBQSxJQUNuQztBQUNBLGFBQVMsSUFBSSxjQUFjO0FBQzNCLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1oscUJBQXFCO0FBQUEsTUFDckIsa0JBQWtCO0FBQUEsTUFDbEIscUJBQXFCO0FBQUEsTUFDckIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLG9CQUFvQixNQUFNO0FBQ3pCO0FBQ0EsaUJBQU8sRUFBRSxXQUFXLGlCQUFpQixVQUFVLEVBQUUsV0FBVyxnQkFBZ0IsRUFBRTtBQUFBLFFBQy9FO0FBQUEsTUFDRDtBQUFBLE1BQ0EsY0FBYyxFQUFFLGNBQWMsTUFBTTtBQUFFO0FBQUEsTUFBZ0IsRUFBRTtBQUFBLElBQ3pEO0FBQ0Esb0JBQWdCLE1BQU0sZUFBZTtBQUNyQyxXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxTQUFTLENBQUM7QUFDN0IsV0FBTyxZQUFZLEtBQUssa0JBQWtCLFVBQVU7QUFDcEQsV0FBTyxZQUFZLEtBQUssb0JBQW9CLFFBQVEsQ0FBQztBQUNyRCxXQUFPLFlBQVksS0FBSyxxQkFBcUIsUUFBUTtBQUNyRCxXQUFPLFlBQVksZUFBZSxVQUFVLEtBQUs7QUFDakQsYUFBUyxRQUFRO0FBQUEsRUFDbEIsQ0FBQztBQUVELE9BQUssdUZBQXVGLE1BQU07QUFDakcsVUFBTSxXQUFXLElBQUksZ0JBQWdCO0FBQ3JDLFVBQU0sWUFBWSxDQUFDLEVBQUUsSUFBSSxLQUFLLEdBQUcsRUFBRSxJQUFJLEtBQUssQ0FBQztBQUM3QyxRQUFJLGVBQWU7QUFDbkIsUUFBSSxVQUFVO0FBQ2QsUUFBSSxlQUFlO0FBQ25CLFVBQU0saUJBQWlCO0FBQUEsTUFDdEIsVUFBVTtBQUFBLE1BQ1YsVUFBVTtBQUFFLGFBQUssV0FBVztBQUFBLE1BQU07QUFBQSxJQUNuQztBQUNBLGFBQVMsSUFBSSxjQUFjO0FBQzNCLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1oscUJBQXFCO0FBQUEsTUFDckIsa0JBQWtCLEVBQUUsV0FBVyxTQUFTO0FBQUEsTUFDeEMscUJBQXFCO0FBQUEsTUFDckIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLG9CQUFvQixNQUFNO0FBQ3pCO0FBQ0EsaUJBQU8sRUFBRSxXQUFXLFVBQVUsVUFBVSxFQUFFLFdBQVcsU0FBUyxFQUFFO0FBQUEsUUFDakU7QUFBQSxNQUNEO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixjQUFjLENBQUMsWUFBZ0M7QUFDOUM7QUFDQSxjQUFJLFFBQVEsV0FBVyxHQUFHO0FBQ3pCO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLG9CQUFnQixNQUFNLFFBQVE7QUFDOUIsV0FBTyxZQUFZLGNBQWMsQ0FBQztBQUNsQyxXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxTQUFTLENBQUM7QUFDN0IsV0FBTyxZQUFZLEtBQUssa0JBQWtCLE1BQVM7QUFDbkQsV0FBTyxZQUFZLEtBQUssb0JBQW9CLFFBQVEsQ0FBQztBQUNyRCxXQUFPLFlBQVksZUFBZSxVQUFVLElBQUk7QUFFaEQsVUFBTSxzQkFBbUQ7QUFBQSxNQUN4RCxFQUFFLElBQUksTUFBTSxNQUFNLFFBQVEsTUFBTSxHQUFHO0FBQUEsTUFDbkMsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sR0FBRztBQUFBLElBQ3BDO0FBQ0EsVUFBTSxtQkFBa0Q7QUFBQSxNQUN2RCxXQUFXO0FBQUEsTUFDWCxVQUFVLHNCQUFzQixFQUFFLE1BQU0sT0FBTyxDQUFDLEVBQUU7QUFBQSxNQUNsRCxhQUFhLG9CQUFJLElBQUk7QUFBQSxNQUNyQixTQUFTLG9CQUFJLElBQUk7QUFBQSxNQUNqQixpQkFBaUIsTUFBTTtBQUFBLE1BQ3ZCLE1BQU0sYUFBYSxFQUFFLFVBQVUsT0FBTyxRQUFRLGtCQUFrQjtBQUFBLE1BQ2hFLGdCQUFnQjtBQUFBLE1BQUU7QUFBQSxNQUNsQixVQUFVO0FBQUEsTUFBRTtBQUFBLElBQ2I7QUFDQSxVQUFNLGFBQWE7QUFBQSxNQUNsQixVQUFVO0FBQUEsTUFDVixVQUFVO0FBQUUsYUFBSyxXQUFXO0FBQUEsTUFBTTtBQUFBLElBQ25DO0FBQ0EsbUJBQWU7QUFDZixtQkFBZTtBQUNmLGNBQVU7QUFDVixTQUFLLG1CQUFtQjtBQUN4QixTQUFLLHNCQUFzQjtBQUMzQixhQUFTLElBQUksVUFBVTtBQUN2QixvQkFBZ0IsTUFBTSxRQUFRO0FBQzlCLFdBQU8sWUFBWSxjQUFjLENBQUM7QUFDbEMsV0FBTyxZQUFZLFNBQVMsQ0FBQztBQUM3QixXQUFPLFlBQVksS0FBSyxrQkFBa0IsZ0JBQWdCO0FBQzFELFdBQU8sWUFBWSxLQUFLLHFCQUFxQixtQkFBbUI7QUFDaEUsV0FBTyxZQUFZLFdBQVcsVUFBVSxLQUFLO0FBQzdDLGFBQVMsUUFBUTtBQUFBLEVBQ2xCLENBQUM7QUFFRCxPQUFLLDhGQUE4RixNQUFNO0FBQ3hHLFVBQU0sV0FBVyxJQUFJLGdCQUFnQjtBQUNyQyxRQUFJLGVBQWU7QUFDbkIsUUFBSSxVQUFVO0FBQ2QsUUFBSSxlQUFlO0FBQ25CLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1oscUJBQXFCO0FBQUEsTUFDckIsa0JBQWtCLEVBQUUsV0FBVyxhQUFhO0FBQUEsTUFDNUMscUJBQXFCLENBQUM7QUFBQSxNQUN0QixhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLHNCQUFzQixNQUFNO0FBQUEsUUFDNUIsb0JBQW9CLE1BQU07QUFDekI7QUFDQSxpQkFBTyxFQUFFLFdBQVcsY0FBYyxVQUFVLEVBQUUsV0FBVyxhQUFhLEVBQUU7QUFBQSxRQUN6RTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLGNBQWMsQ0FBQyxZQUFnQztBQUM5QztBQUNBLGNBQUksUUFBUSxXQUFXLEdBQUc7QUFDekI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0Esb0JBQWdCLE1BQU0sWUFBWTtBQUNsQyxXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxjQUFjLENBQUM7QUFDbEMsV0FBTyxZQUFZLFNBQVMsQ0FBQztBQUM3QixXQUFPLFlBQVksS0FBSyxrQkFBa0IsTUFBUztBQUNuRCxXQUFPLFlBQVksS0FBSyxvQkFBb0IsUUFBUSxDQUFDO0FBQ3JELGFBQVMsUUFBUTtBQUFBLEVBQ2xCLENBQUM7QUFFRCxPQUFLLDZGQUE2RixNQUFNO0FBQ3ZHLFVBQU0sV0FBVyxJQUFJLGdCQUFnQjtBQUNyQyxVQUFNLGFBQWEsRUFBRSxXQUFXLGdCQUFnQjtBQUNoRCxVQUFNLFdBQVcsQ0FBQyxFQUFFLElBQUksS0FBSyxHQUFHLEVBQUUsSUFBSSxLQUFLLENBQUM7QUFDNUMsUUFBSSxZQUFZO0FBQ2hCLFFBQUksaUJBQWlCO0FBQ3JCLFFBQUksZUFBZTtBQUNuQixRQUFJLGVBQWU7QUFDbkIsUUFBSSxnQkFBZ0I7QUFDcEIsUUFBSSxVQUFVO0FBQ2QsVUFBTSxpQkFBaUI7QUFBQSxNQUN0QixVQUFVO0FBQUEsTUFDVixVQUFVO0FBQUUsYUFBSyxXQUFXO0FBQUEsTUFBTTtBQUFBLElBQ25DO0FBQ0EsYUFBUyxJQUFJLGNBQWM7QUFDM0IsVUFBTSxPQUFPO0FBQUEsTUFDWixZQUFZO0FBQUEsTUFDWixxQkFBcUI7QUFBQSxNQUNyQixrQkFBa0I7QUFBQSxNQUNsQixxQkFBcUI7QUFBQSxNQUNyQixhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTSxhQUFhLENBQUM7QUFBQSxRQUN2QyxzQkFBc0IsTUFBTSxhQUFhLENBQUM7QUFBQSxRQUMxQyxvQkFBb0IsTUFBTTtBQUN6QjtBQUNBLGlCQUFPO0FBQUEsWUFDTixXQUFXO0FBQUEsWUFDWCxVQUFVLEVBQUUsV0FBVyxnQkFBZ0I7QUFBQSxZQUN2QyxVQUFVO0FBQUEsWUFBRTtBQUFBLFlBQ1osaUJBQWlCLE9BQU8sRUFBRSxVQUFVO0FBQUEsWUFBRSxFQUFFO0FBQUEsVUFDekM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2Isb0JBQW9CLE9BQU8sRUFBRSxNQUFNLFlBQVksY0FBYyxnQkFBZ0IsTUFBTSxXQUFXO0FBQUEsUUFDOUYsdUJBQXVCLE9BQU8sRUFBRSxlQUFlO0FBQUEsTUFDaEQ7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLGNBQWMsQ0FBQyxZQUFnQztBQUM5QztBQUNBLGNBQUksUUFBUSxXQUFXLEdBQUc7QUFDekI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLDBCQUEwQixDQUFDLFlBQThCO0FBQ3hELFlBQUksUUFBUSxTQUFTLFlBQVk7QUFDaEM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxxQkFBaUI7QUFDakIsV0FBTyxZQUFZLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxLQUFLO0FBQzlELFdBQU8sWUFBWSxLQUFLLGFBQWEsbUJBQW1CLEVBQUUsTUFBTSxXQUFXO0FBQzNFLFdBQU8sWUFBWSxLQUFLLGFBQWEsc0JBQXNCLEVBQUUsZ0JBQWdCLElBQUk7QUFFakYsb0JBQWdCLE1BQU0sZUFBZTtBQUNyQyxXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxjQUFjLENBQUM7QUFDbEMsV0FBTyxZQUFZLGVBQWUsQ0FBQztBQUNuQyxXQUFPLFlBQVksU0FBUyxDQUFDO0FBQzdCLFdBQU8sWUFBWSxLQUFLLGtCQUFrQixVQUFVO0FBQ3BELFdBQU8sWUFBWSxLQUFLLG9CQUFvQixRQUFRLENBQUM7QUFDckQsV0FBTyxZQUFZLEtBQUsscUJBQXFCLFFBQVE7QUFDckQsV0FBTyxZQUFZLGVBQWUsVUFBVSxLQUFLO0FBRWpELHFCQUFpQjtBQUNqQixnQkFBWTtBQUNaLG9CQUFnQixNQUFNLGVBQWU7QUFDckMsV0FBTyxHQUFHLFVBQVUsQ0FBQztBQUNyQixXQUFPLEdBQUcsZ0JBQWdCLENBQUM7QUFDM0IsV0FBTyxZQUFZLGNBQWMsQ0FBQztBQUNsQyxXQUFPLFlBQVksZUFBZSxVQUFVLElBQUk7QUFDaEQsYUFBUyxRQUFRO0FBQUEsRUFDbEIsQ0FBQztBQUVELE9BQUsscUZBQXFGLE1BQU07QUFDL0YsVUFBTSxXQUFXLElBQUksZ0JBQWdCO0FBQ3JDLFVBQU0sYUFBYSxFQUFFLFdBQVcsZ0JBQWdCO0FBQ2hELFVBQU0sV0FBVyxDQUFDLEVBQUUsSUFBSSxLQUFLLEdBQUcsRUFBRSxJQUFJLEtBQUssQ0FBQztBQUM1QyxRQUFJLGlCQUFpQjtBQUNyQixRQUFJLFFBQXlCLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUNuRSxRQUFJLGVBQWU7QUFDbkIsUUFBSSxlQUFlO0FBQ25CLFFBQUksZ0JBQWdCO0FBQ3BCLFFBQUksVUFBVTtBQUNkLFVBQU0saUJBQWlCO0FBQUEsTUFDdEIsVUFBVTtBQUFBLE1BQ1YsVUFBVTtBQUFFLGFBQUssV0FBVztBQUFBLE1BQU07QUFBQSxJQUNuQztBQUNBLGFBQVMsSUFBSSxjQUFjO0FBQzNCLFVBQU0sT0FBTztBQUFBLE1BQ1osWUFBWTtBQUFBLE1BQ1oscUJBQXFCO0FBQUEsTUFDckIsa0JBQWtCO0FBQUEsTUFDbEIscUJBQXFCO0FBQUEsTUFDckIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU0sQ0FBQyxrQkFBa0IsTUFBTSxTQUFTO0FBQUEsUUFDM0Qsc0JBQXNCLE1BQU0sQ0FBQyxrQkFBa0IsTUFBTSxTQUFTO0FBQUEsUUFDOUQsb0JBQW9CLE1BQU07QUFDekI7QUFDQSxpQkFBTztBQUFBLFlBQ04sV0FBVztBQUFBLFlBQ1gsVUFBVSxFQUFFLFdBQVcsZ0JBQWdCO0FBQUEsWUFDdkMsVUFBVTtBQUFBLFlBQUU7QUFBQSxZQUNaLGlCQUFpQixPQUFPLEVBQUUsVUFBVTtBQUFBLFlBQUUsRUFBRTtBQUFBLFVBQ3pDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixNQUFNO0FBQUEsUUFDMUIsdUJBQXVCLE9BQU8sRUFBRSxlQUFlO0FBQUEsTUFDaEQ7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLGNBQWMsQ0FBQyxZQUFnQztBQUM5QztBQUNBLGNBQUksUUFBUSxXQUFXLEdBQUc7QUFDekI7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLDBCQUEwQixDQUFDLFlBQThCO0FBQ3hELFlBQUksUUFBUSxTQUFTLFlBQVk7QUFDaEM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxxQkFBaUI7QUFDakIsWUFBUSxFQUFFLE1BQU0sY0FBYyxRQUFRLFVBQVU7QUFDaEQsV0FBTyxZQUFZLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxLQUFLO0FBQzlELFdBQU8sZ0JBQWdCLEtBQUssYUFBYSxtQkFBbUIsR0FBRyxFQUFFLE1BQU0sY0FBYyxRQUFRLFVBQVUsQ0FBQztBQUN4RyxXQUFPLFlBQVksS0FBSyxhQUFhLHNCQUFzQixFQUFFLGdCQUFnQixJQUFJO0FBQ2pGLFdBQU8sWUFBWSwwQkFBMEIsS0FBSyxZQUFZLEdBQUcsSUFBSTtBQUNyRSxXQUFPLFlBQVkseUJBQXlCLEtBQUssYUFBYSxtQkFBbUIsR0FBRyxLQUFLLGFBQWEsc0JBQXNCLEVBQUUsY0FBYyxHQUFHLEtBQUs7QUFFcEosb0JBQWdCLE1BQU0sZUFBZTtBQUNyQyxXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxjQUFjLENBQUM7QUFDbEMsV0FBTyxZQUFZLGVBQWUsQ0FBQztBQUNuQyxXQUFPLFlBQVksU0FBUyxDQUFDO0FBQzdCLFdBQU8sWUFBWSxLQUFLLGtCQUFrQixVQUFVO0FBQ3BELFdBQU8sWUFBWSxLQUFLLG9CQUFvQixRQUFRLENBQUM7QUFDckQsV0FBTyxZQUFZLEtBQUsscUJBQXFCLFFBQVE7QUFDckQsV0FBTyxZQUFZLGVBQWUsVUFBVSxLQUFLO0FBQ2pELGFBQVMsUUFBUTtBQUFBLEVBQ2xCLENBQUM7QUFFRCxPQUFLLDJGQUEyRixNQUFNO0FBQ3JHLFVBQU0sV0FBVyxJQUFJLGdCQUFnQjtBQUNyQyxVQUFNLFdBQXdDO0FBQUEsTUFDN0MsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sR0FBRztBQUFBLE1BQ25DLEVBQUUsSUFBSSxNQUFNLE1BQU0sUUFBUSxNQUFNLEdBQUc7QUFBQSxJQUNwQztBQUNBLFFBQUksVUFBVTtBQUNkLFFBQUksb0JBQW9CO0FBQ3hCLFVBQU0sVUFBNkMsQ0FBQztBQUNwRCxVQUFNLG9CQUFpQyxDQUFDO0FBQ3hDLFFBQUksWUFBWTtBQUNoQixVQUFNLE9BQU87QUFBQSxNQUNaLFlBQVk7QUFBQSxNQUNaLHFCQUFxQjtBQUFBLE1BQ3JCLGtCQUFrQixFQUFFLFdBQVcsU0FBUztBQUFBLE1BQ3hDLHFCQUFxQjtBQUFBLE1BQ3JCLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1QixvQkFBb0IsT0FBTztBQUFBLFVBQzFCLFdBQVc7QUFBQSxVQUNYLFVBQVUsRUFBRSxXQUFXLFVBQVU7QUFBQSxVQUNqQyxVQUFVO0FBQUEsVUFBRTtBQUFBLFVBQ1osaUJBQWlCLE9BQU8sRUFBRSxVQUFVO0FBQUEsVUFBRSxFQUFFO0FBQUEsUUFDekM7QUFBQSxNQUNEO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixjQUFjLENBQUMsU0FBNkIsaUJBQW1DO0FBQzlFLGtCQUFRLEtBQUssRUFBRSxNQUFNLGFBQWEsTUFBTSxPQUFPLFFBQVEsT0FBTyxDQUFDO0FBQUEsUUFDaEU7QUFBQSxRQUNBLDBCQUEwQixNQUFNO0FBQUU7QUFBQSxRQUFXO0FBQUEsTUFDOUM7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLFFBQ2YsbUJBQW1CLE1BQU07QUFBRTtBQUFBLFFBQXFCO0FBQUEsUUFDaEQsWUFBWSxDQUFDLFlBQWdDO0FBQUUsNEJBQWtCLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQztBQUFBLFFBQUc7QUFBQSxNQUN0RjtBQUFBLE1BQ0EsMEJBQTBCLE1BQU07QUFBRTtBQUFBLE1BQWE7QUFBQSxJQUNoRDtBQUNBLFVBQU0sUUFBUTtBQUNkLG9CQUFnQixPQUFPLFFBQVE7QUFDL0IsV0FBTyxZQUFZLFNBQVMsQ0FBQztBQUM3QixXQUFPLFlBQVksbUJBQW1CLENBQUM7QUFDdkMsV0FBTyxnQkFBZ0IsU0FBUyxDQUFDLEVBQUUsTUFBTSxZQUFZLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDaEUsV0FBTyxnQkFBZ0IsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDOUMsV0FBTyxZQUFZLFdBQVcsQ0FBQztBQUMvQixXQUFPLFlBQVksS0FBSyxvQkFBb0IsUUFBUSxDQUFDO0FBQ3JELFdBQU8sWUFBWSxLQUFLLGtCQUFrQixXQUFXLFFBQVE7QUFFN0QsY0FBVTtBQUNWLHdCQUFvQjtBQUNwQixZQUFRLFNBQVM7QUFDakIsc0JBQWtCLFNBQVM7QUFDM0IsU0FBSyxtQkFBbUIsRUFBRSxXQUFXLFNBQVM7QUFDOUMsU0FBSyxzQkFBc0I7QUFDM0Isb0JBQWdCLE9BQU8sUUFBUTtBQUMvQixXQUFPLFlBQVksU0FBUyxDQUFDO0FBQzdCLFdBQU8sWUFBWSxtQkFBbUIsQ0FBQztBQUN2QyxXQUFPLGdCQUFnQixTQUFTLENBQUMsQ0FBQztBQUNsQyxXQUFPLGdCQUFnQixtQkFBbUIsQ0FBQyxDQUFDO0FBQzVDLFdBQU8sWUFBWSxXQUFXLENBQUM7QUFDL0IsV0FBTyxZQUFZLEtBQUsscUJBQXFCLFFBQVE7QUFDckQsYUFBUyxRQUFRO0FBQUEsRUFDbEIsQ0FBQztBQUVELE9BQUssMkZBQTJGLE1BQU07QUFDckcsVUFBTSxXQUFXLElBQUksZ0JBQWdCO0FBQ3JDLFVBQU0sV0FBd0M7QUFBQSxNQUM3QyxFQUFFLElBQUksTUFBTSxNQUFNLFFBQVEsTUFBTSxHQUFHO0FBQUEsTUFDbkMsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sR0FBRztBQUFBLElBQ3BDO0FBQ0EsUUFBSSxVQUFVO0FBQ2QsUUFBSSxvQkFBb0I7QUFDeEIsVUFBTSxvQkFBaUMsQ0FBQztBQUN4QyxVQUFNLE9BQU87QUFBQSxNQUNaLFlBQVk7QUFBQSxNQUNaLHFCQUFxQjtBQUFBLE1BQ3JCLGtCQUFrQixFQUFFLFdBQVcsU0FBUztBQUFBLE1BQ3hDLHFCQUFxQjtBQUFBLE1BQ3JCLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxNQUM3QjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2IsY0FBYyxNQUFNO0FBQUEsUUFBRTtBQUFBLFFBQ3RCLDBCQUEwQixNQUFNO0FBQUU7QUFBQSxRQUFXO0FBQUEsTUFDOUM7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLFFBQ2YsbUJBQW1CLE1BQU07QUFBRTtBQUFBLFFBQXFCO0FBQUEsUUFDaEQsWUFBWSxDQUFDLFlBQWdDO0FBQUUsNEJBQWtCLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQztBQUFBLFFBQUc7QUFBQSxNQUN0RjtBQUFBLE1BQ0EsY0FBYztBQUFBLElBSWY7QUFDQSxVQUFNLFFBQVE7QUFDZCxvQkFBZ0IsT0FBTyxRQUFRO0FBQy9CLFdBQU8sWUFBWSxTQUFTLENBQUM7QUFDN0IsV0FBTyxZQUFZLG1CQUFtQixDQUFDO0FBQ3ZDLFdBQU8sZ0JBQWdCLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlDLFdBQU8sWUFBWSxNQUFNLG9CQUFvQixRQUFRLENBQUM7QUFFdEQsY0FBVTtBQUNWLHdCQUFvQjtBQUNwQixzQkFBa0IsU0FBUztBQUMzQixTQUFLLG1CQUFtQixFQUFFLFdBQVcsU0FBUztBQUM5QyxTQUFLLHNCQUFzQjtBQUMzQixvQkFBZ0IsT0FBTyxRQUFRO0FBQy9CLFdBQU8sWUFBWSxTQUFTLENBQUM7QUFDN0IsV0FBTyxZQUFZLG1CQUFtQixDQUFDO0FBQ3ZDLFdBQU8sZ0JBQWdCLG1CQUFtQixDQUFDLENBQUM7QUFDNUMsV0FBTyxZQUFZLE1BQU0scUJBQXFCLFFBQVE7QUFFdEQsU0FBSyxjQUFjO0FBQUEsTUFDbEIsbUJBQW1CLE1BQU07QUFBQSxNQUN6QixzQkFBc0IsTUFBTTtBQUFBLElBQzdCO0FBQ0EsU0FBSyxlQUFlO0FBQUEsTUFDbkIsb0JBQW9CLE9BQU8sRUFBRSxNQUFNLGFBQWEsTUFBTSxXQUFXO0FBQUEsTUFDakUsdUJBQXVCLE9BQU8sRUFBRSxnQkFBZ0IsS0FBSztBQUFBLElBQ3REO0FBQ0EsU0FBSyxtQkFBbUIsRUFBRSxXQUFXLFNBQVM7QUFDOUMsb0JBQWdCLE9BQU8sUUFBUTtBQUMvQixXQUFPLFlBQVksU0FBUyxDQUFDO0FBQzdCLFdBQU8sWUFBWSxtQkFBbUIsQ0FBQztBQUN2QyxXQUFPLGdCQUFnQixtQkFBbUIsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QyxXQUFPLFlBQVksTUFBTSxvQkFBb0IsUUFBUSxDQUFDO0FBQ3RELGFBQVMsUUFBUTtBQUFBLEVBQ2xCLENBQUM7QUFFRCxPQUFLLDhFQUE4RSxNQUFNO0FBQ3hGLFVBQU0sV0FBVyxJQUFJLGdCQUFnQjtBQUNyQyxVQUFNLFlBQVksQ0FBQyxFQUFFLElBQUksS0FBSyxHQUFHLEVBQUUsSUFBSSxLQUFLLENBQUM7QUFDN0MsUUFBSSxlQUFlO0FBQ25CLFFBQUksZUFBZTtBQUNuQixRQUFJLFVBQVU7QUFDZCxVQUFNLGlCQUFpQjtBQUFBLE1BQ3RCLFVBQVU7QUFBQSxNQUNWLFVBQVU7QUFBRSxhQUFLLFdBQVc7QUFBQSxNQUFNO0FBQUEsSUFDbkM7QUFDQSxhQUFTLElBQUksY0FBYztBQUMzQixVQUFNLE9BQU87QUFBQSxNQUNaLFlBQVk7QUFBQSxNQUNaLHFCQUFxQjtBQUFBLE1BQ3JCLGtCQUFrQixFQUFFLFdBQVcsU0FBUztBQUFBLE1BQ3hDLHFCQUFxQjtBQUFBLE1BQ3JCLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1QixvQkFBb0IsTUFBTTtBQUN6QjtBQUNBLGlCQUFPO0FBQUEsWUFDTixXQUFXO0FBQUEsWUFDWCxVQUFVLEVBQUUsV0FBVyxTQUFTO0FBQUEsWUFDaEMsVUFBVTtBQUFBLFlBQUU7QUFBQSxZQUNaLGlCQUFpQixPQUFPLEVBQUUsVUFBVTtBQUFBLFlBQUUsRUFBRTtBQUFBLFVBQ3pDO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2pFLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLEtBQUs7QUFBQSxNQUN0RDtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2IsY0FBYyxDQUFDLFlBQWdDO0FBQzlDO0FBQ0EsY0FBSSxRQUFRLFdBQVcsR0FBRztBQUN6QjtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLE1BQ0EsMEJBQTBCLE1BQU07QUFBQSxNQUFFO0FBQUEsSUFDbkM7QUFDQSxvQkFBZ0IsTUFBTSxRQUFRO0FBQzlCLFdBQU8sWUFBWSxjQUFjLENBQUM7QUFDbEMsV0FBTyxZQUFZLGNBQWMsQ0FBQztBQUNsQyxXQUFPLFlBQVksU0FBUyxDQUFDO0FBQzdCLFdBQU8sWUFBWSxLQUFLLGtCQUFrQixNQUFTO0FBQ25ELFdBQU8sWUFBWSxLQUFLLG9CQUFvQixRQUFRLENBQUM7QUFDckQsV0FBTyxZQUFZLGVBQWUsVUFBVSxJQUFJO0FBRWhELFVBQU0sc0JBQW1EO0FBQUEsTUFDeEQsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sR0FBRztBQUFBLE1BQ25DLEVBQUUsSUFBSSxNQUFNLE1BQU0sUUFBUSxNQUFNLEdBQUc7QUFBQSxJQUNwQztBQUNBLFVBQU0sbUJBQWtEO0FBQUEsTUFDdkQsV0FBVztBQUFBLE1BQ1gsVUFBVSxzQkFBc0IsRUFBRSxNQUFNLE9BQU8sQ0FBQyxFQUFFO0FBQUEsTUFDbEQsYUFBYSxvQkFBSSxJQUFJO0FBQUEsTUFDckIsU0FBUyxvQkFBSSxJQUFJO0FBQUEsTUFDakIsaUJBQWlCLE1BQU07QUFBQSxNQUN2QixNQUFNLGFBQWEsRUFBRSxVQUFVLE9BQU8sUUFBUSxrQkFBa0I7QUFBQSxNQUNoRSxnQkFBZ0I7QUFBQSxNQUFFO0FBQUEsTUFDbEIsVUFBVTtBQUFBLE1BQUU7QUFBQSxJQUNiO0FBQ0EsVUFBTSxhQUFhO0FBQUEsTUFDbEIsVUFBVTtBQUFBLE1BQ1YsVUFBVTtBQUFFLGFBQUssV0FBVztBQUFBLE1BQU07QUFBQSxJQUNuQztBQUNBLG1CQUFlO0FBQ2YsbUJBQWU7QUFDZixjQUFVO0FBQ1YsU0FBSyxtQkFBbUI7QUFDeEIsU0FBSyxzQkFBc0I7QUFDM0IsYUFBUyxJQUFJLFVBQVU7QUFDdkIsb0JBQWdCLE1BQU0sUUFBUTtBQUM5QixXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxTQUFTLENBQUM7QUFDN0IsV0FBTyxZQUFZLEtBQUssa0JBQWtCLGdCQUFnQjtBQUMxRCxXQUFPLFlBQVksS0FBSyxxQkFBcUIsbUJBQW1CO0FBQ2hFLFdBQU8sWUFBWSxXQUFXLFVBQVUsS0FBSztBQUM3QyxhQUFTLFFBQVE7QUFBQSxFQUNsQixDQUFDO0FBRUQsV0FBUyx3QkFBd0IsU0FjL0I7QUFDRCxVQUFNLFdBQVcsSUFBSSxnQkFBZ0I7QUFDckMsVUFBTSxXQUFXLFFBQVE7QUFDekIsVUFBTSxhQUFhLEVBQUUsV0FBVyxRQUFRLGVBQWU7QUFDdkQsVUFBTSxRQUFRO0FBQUEsTUFDYixTQUFTO0FBQUEsTUFDVCxjQUFjO0FBQUEsTUFDZCxjQUFjO0FBQUEsTUFDZCxZQUFZLENBQUM7QUFBQSxNQUNiLFdBQVcsQ0FBQztBQUFBLElBQ2I7QUFDQSxVQUFNLGlCQUFpQjtBQUFBLE1BQ3RCLFVBQVU7QUFBQSxNQUNWLFVBQVU7QUFBRSxhQUFLLFdBQVc7QUFBQSxNQUFNO0FBQUEsSUFDbkM7QUFDQSxhQUFTLElBQUksY0FBYztBQUMzQixVQUFNLE9BQU87QUFBQSxNQUNaLFlBQVk7QUFBQSxNQUNaLHFCQUFxQjtBQUFBLE1BQ3JCLGtCQUFrQjtBQUFBLE1BQ2xCLHFCQUFxQjtBQUFBLE1BQ3JCLGtCQUFrQixFQUFFLFFBQVE7QUFBQSxNQUFFLEVBQUU7QUFBQSxNQUNoQyxtQkFBbUI7QUFBQSxNQUNuQixxQkFBcUI7QUFBQSxNQUNyQixjQUFjLEVBQUUsaUJBQWlCO0FBQUEsTUFBRSxHQUFHLFNBQVM7QUFBQSxNQUFFLEVBQUU7QUFBQSxNQUNuRCxnQkFBZ0IsRUFBRSxvQkFBb0I7QUFBQSxNQUFFLEVBQUU7QUFBQSxNQUMxQyxjQUFjLEVBQUUsT0FBTyxHQUFHO0FBQUEsTUFDMUIsbUJBQW1CO0FBQUEsTUFBRTtBQUFBLE1BQ3JCLDBCQUEwQjtBQUFBLE1BQUU7QUFBQSxNQUM1Qiw4QkFBOEI7QUFBQSxNQUFFO0FBQUEsTUFDaEMsMkJBQTJCO0FBQUEsTUFBRTtBQUFBLE1BQzdCLHFCQUFxQjtBQUFBLE1BQUU7QUFBQSxNQUN2QixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLG9CQUFvQjtBQUFBLE1BQUU7QUFBQSxNQUN0QiwwQkFBMEI7QUFBRSxjQUFNLFdBQVcsS0FBSyxRQUFRLGVBQWU7QUFBQSxNQUFHO0FBQUEsTUFDNUUsbUJBQW1CO0FBQUUsY0FBTSxVQUFVLEtBQUssUUFBUSxlQUFlO0FBQUEsTUFBRztBQUFBLE1BQ3BFLG1CQUFtQixNQUFNLFFBQVE7QUFBQSxNQUNqQyxpQkFBaUIsQ0FBQyxjQUFzQjtBQUN2Qyx3QkFBZ0IsTUFBd0QsU0FBUztBQUFBLE1BQ2xGO0FBQUEsTUFDQSxhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTSxRQUFRLFNBQVM7QUFBQSxRQUMxQyxzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLG9CQUFvQixNQUFNO0FBQ3pCLGdCQUFNO0FBQ04saUJBQU8sRUFBRSxXQUFXLFFBQVEsaUJBQWlCLFVBQVUsRUFBRSxXQUFXLFFBQVEsZ0JBQWdCLEVBQUU7QUFBQSxRQUMvRjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2pFLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLFFBQVEsU0FBUyxlQUFlO0FBQUEsTUFDakY7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLGNBQWMsQ0FBQyxZQUFnQztBQUM5QyxnQkFBTTtBQUNOLGNBQUksUUFBUSxXQUFXLEdBQUc7QUFDekIsa0JBQU07QUFBQSxVQUNQO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLDJCQUEyQjtBQUFBLE1BQUU7QUFBQSxJQUM5QjtBQUNBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0EsSUFBSSxVQUFVO0FBQUUsZUFBTyxNQUFNO0FBQUEsTUFBUztBQUFBLE1BQ3RDLElBQUksZUFBZTtBQUFFLGVBQU8sTUFBTTtBQUFBLE1BQWM7QUFBQSxNQUNoRCxJQUFJLGVBQWU7QUFBRSxlQUFPLE1BQU07QUFBQSxNQUFjO0FBQUEsTUFDaEQsSUFBSSxhQUFhO0FBQUUsZUFBTyxNQUFNO0FBQUEsTUFBWTtBQUFBLE1BQzVDLElBQUksWUFBWTtBQUFFLGVBQU8sTUFBTTtBQUFBLE1BQVc7QUFBQSxNQUMxQyxJQUFJLG1CQUFtQjtBQUFFLGVBQU8sZUFBZTtBQUFBLE1BQVU7QUFBQSxJQUMxRDtBQUFBLEVBQ0Q7QUFFQSxPQUFLLGtHQUFrRyxNQUFNO0FBQzVHLFVBQU0sV0FBd0M7QUFBQSxNQUM3QyxFQUFFLElBQUksTUFBTSxNQUFNLFFBQVEsTUFBTSxHQUFHO0FBQUEsTUFDbkMsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sR0FBRztBQUFBLElBQ3BDO0FBQ0EsZUFBVyxRQUFRLENBQUMsZ0JBQWdCLGtCQUFrQixHQUFZO0FBQ2pFLFlBQU0sVUFBVSx3QkFBd0I7QUFBQSxRQUN2QyxpQkFBaUI7QUFBQSxRQUNqQixnQkFBZ0I7QUFBQSxRQUNoQjtBQUFBLFFBQ0E7QUFBQSxNQUNELENBQUM7QUFDRCx5QkFBbUIsUUFBUSxNQUFNLFFBQVE7QUFDekMsYUFBTyxZQUFZLFFBQVEsY0FBYyxDQUFDO0FBQzFDLGFBQU8sWUFBWSxRQUFRLGNBQWMsQ0FBQztBQUMxQyxhQUFPLFlBQVksUUFBUSxTQUFTLENBQUM7QUFDckMsYUFBTyxZQUFZLFFBQVEsS0FBSyxrQkFBa0IsTUFBUztBQUMzRCxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixRQUFRLENBQUM7QUFDN0QsYUFBTyxZQUFZLFFBQVEsa0JBQWtCLElBQUk7QUFDakQsYUFBTyxnQkFBZ0IsUUFBUSxZQUFZLENBQUMsUUFBUSxDQUFDO0FBQ3JELGFBQU8sZ0JBQWdCLFFBQVEsV0FBVyxDQUFDLFFBQVEsQ0FBQztBQUNwRCxjQUFRLFNBQVMsUUFBUTtBQUFBLElBQzFCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx5RUFBeUUsTUFBTTtBQUNuRixVQUFNLFdBQXdDO0FBQUEsTUFDN0MsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sR0FBRztBQUFBLE1BQ25DLEVBQUUsSUFBSSxNQUFNLE1BQU0sUUFBUSxNQUFNLEdBQUc7QUFBQSxJQUNwQztBQUNBLGVBQVcsUUFBUSxDQUFDLGdCQUFnQixrQkFBa0IsR0FBWTtBQUNqRSxZQUFNLFVBQVUsd0JBQXdCO0FBQUEsUUFDdkMsaUJBQWlCO0FBQUEsUUFDakIsZ0JBQWdCO0FBQUEsUUFDaEI7QUFBQSxRQUNBO0FBQUEsTUFDRCxDQUFDO0FBQ0QsWUFBTSxhQUFhLFFBQVEsS0FBSztBQUNoQyx5QkFBbUIsUUFBUSxNQUFNLFFBQVE7QUFDekMsYUFBTyxZQUFZLFFBQVEsY0FBYyxDQUFDO0FBQzFDLGFBQU8sWUFBWSxRQUFRLFNBQVMsQ0FBQztBQUNyQyxhQUFPLFlBQVksUUFBUSxLQUFLLGtCQUFrQixVQUFVO0FBQzVELGFBQU8sWUFBWSxRQUFRLEtBQUsscUJBQXFCLFFBQVE7QUFDN0QsYUFBTyxZQUFZLFFBQVEsa0JBQWtCLEtBQUs7QUFDbEQsYUFBTyxnQkFBZ0IsUUFBUSxZQUFZLENBQUMsUUFBUSxDQUFDO0FBQ3JELGFBQU8sZ0JBQWdCLFFBQVEsV0FBVyxDQUFDLFFBQVEsQ0FBQztBQUNwRCxjQUFRLFNBQVMsUUFBUTtBQUFBLElBQzFCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxtR0FBbUcsWUFBWTtBQUNuSCxVQUFNLFdBQVcsSUFBSSxnQkFBZ0I7QUFDckMsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sYUFBd0IsQ0FBQztBQUMvQixVQUFNLGNBQWMsQ0FBQyxXQUFvQjtBQUFFLGlCQUFXLEtBQUssTUFBTTtBQUFBLElBQUc7QUFDcEUsUUFBSSxlQUFlO0FBQ25CLFVBQU0sT0FBTztBQUFBLE1BQ1osUUFBUSxFQUFFLFlBQVksTUFBTTtBQUFBLE1BQzVCLHFCQUFxQjtBQUFBLE1BQ3JCLGtCQUFrQixFQUFFLFdBQVcsUUFBUTtBQUFBLE1BQ3ZDLHFCQUFxQixDQUFDO0FBQUEsTUFDdEIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLG9CQUFvQixNQUFNO0FBQ3pCLGdCQUFNLElBQUksTUFBTSxjQUFjO0FBQUEsUUFDL0I7QUFBQSxNQUNEO0FBQUEsTUFDQSxjQUFjLEVBQUUsY0FBYyxNQUFNO0FBQUU7QUFBQSxNQUFnQixFQUFFO0FBQUEsTUFDeEQsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxNQUNBLDBCQUEwQixNQUFNO0FBQUEsTUFBRTtBQUFBLElBQ25DO0FBRUEsWUFBUSxHQUFHLHNCQUFzQixXQUFXO0FBQzVDLFFBQUk7QUFDSCxzQkFBZ0IsTUFBTSxlQUFlO0FBQ3JDLFlBQU0sSUFBSSxRQUFjLGFBQVcsZUFBZSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2xFLFlBQU0sSUFBSSxRQUFjLGFBQVcsYUFBYSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2hFLGFBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFDM0MsYUFBTyxZQUFZLEtBQUssa0JBQWtCLE1BQVM7QUFDbkQsYUFBTyxZQUFZLGNBQWMsQ0FBQztBQUNsQyxhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUFBLElBQ3RDLFVBQUU7QUFDRCxjQUFRLElBQUksc0JBQXNCLFdBQVc7QUFDN0MsZUFBUyxRQUFRO0FBQUEsSUFDbEI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDhGQUE4RixZQUFZO0FBQzlHLFVBQU0sU0FBcUMsQ0FBQztBQUM1QyxRQUFJLGNBQWM7QUFDbEIsVUFBTSxPQUFPO0FBQUEsTUFDWixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLFdBQVcsT0FBTyxRQUF3RDtBQUN6RSxlQUFPLEtBQUssR0FBRztBQUNmLGVBQU8sRUFBRSxVQUFVLE1BQU0sYUFBYSxFQUFFLElBQUksSUFBSSxFQUFFO0FBQUEsTUFDbkQ7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1QixZQUFZLE1BQU07QUFDakI7QUFDQSxpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQSxpQkFBaUIsTUFBTTtBQUFBLE1BQUU7QUFBQSxJQUMxQjtBQUVBLGVBQVcsTUFBTSxFQUFFLElBQUksYUFBYSxRQUFRLGNBQWMsU0FBUyxZQUFZLENBQUM7QUFDaEYsVUFBTSxJQUFJLFFBQWMsYUFBVyxlQUFlLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFFbEUsV0FBTyxnQkFBZ0IsUUFBUSxDQUFDO0FBQUEsTUFDL0IsTUFBTTtBQUFBLE1BQ04sU0FBUztBQUFBLE1BQ1QsUUFBUTtBQUFBLE1BQ1IsV0FBVztBQUFBLElBQ1osQ0FBQyxDQUFDO0FBQ0YsV0FBTyxZQUFZLGFBQWEsQ0FBQztBQUFBLEVBQ2xDLENBQUM7QUFFRCxPQUFLLHlFQUF5RSxZQUFZO0FBQ3pGLFVBQU0sU0FBcUMsQ0FBQztBQUM1QyxVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsV0FBVyxPQUFPLFFBQXdEO0FBQ3pFLGVBQU8sS0FBSyxHQUFHO0FBQ2YsZUFBTyxFQUFFLFVBQVUsTUFBTSxhQUFhLEVBQUUsSUFBSSxJQUFJLEVBQUU7QUFBQSxNQUNuRDtBQUFBLE1BQ0EsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLFlBQVksTUFBTTtBQUFBLE1BQ25CO0FBQUEsTUFDQSxpQkFBaUIsTUFBTTtBQUFBLE1BQUU7QUFBQSxJQUMxQjtBQUVBLGVBQVcsTUFBTSxFQUFFLElBQUksV0FBVyxDQUFDO0FBQ25DLFVBQU0sSUFBSSxRQUFjLGFBQVcsZUFBZSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBRWxFLFdBQU8sZ0JBQWdCLFFBQVEsQ0FBQztBQUFBLE1BQy9CLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULFFBQVE7QUFBQSxNQUNSLFdBQVc7QUFBQSxJQUNaLENBQUMsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUVELE9BQUssNENBQTRDLFlBQVk7QUFDNUQsUUFBSUMsYUFBWTtBQUNoQixVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsV0FBVyxZQUFrQztBQUM1QyxRQUFBQTtBQUNBLGVBQU8sRUFBRSxVQUFVLE1BQU0sYUFBYSxFQUFFLElBQUksSUFBSSxFQUFFO0FBQUEsTUFDbkQ7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1QixZQUFZLE1BQU07QUFBQSxNQUNuQjtBQUFBLE1BQ0EsaUJBQWlCLE1BQU07QUFBQSxNQUFFO0FBQUEsSUFDMUI7QUFFQSxlQUFXLE1BQU0sRUFBRSxJQUFJLE1BQU0sQ0FBQztBQUM5QixXQUFPLFlBQVlBLFlBQVcsQ0FBQztBQUFBLEVBQ2hDLENBQUM7QUFFRCxPQUFLLHNGQUFzRixZQUFZO0FBQ3RHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLGFBQXdCLENBQUM7QUFDL0IsVUFBTSxjQUFjLENBQUMsV0FBb0I7QUFBRSxpQkFBVyxLQUFLLE1BQU07QUFBQSxJQUFHO0FBQ3BFLFVBQU0sT0FBTztBQUFBLE1BQ1osbUJBQW1CLE1BQU07QUFBQSxNQUN6QixXQUFXLFlBQWtDO0FBQzVDLGNBQU0sSUFBSSxNQUFNLGdCQUFnQjtBQUFBLE1BQ2pDO0FBQUEsTUFDQSxhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLHNCQUFzQixNQUFNO0FBQUEsUUFDNUIsWUFBWSxNQUFNO0FBQUEsTUFDbkI7QUFBQSxNQUNBLGlCQUFpQixDQUFDLFdBQWtEO0FBQ25FLGlCQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3JCO0FBQUEsSUFDRDtBQUVBLFlBQVEsR0FBRyxzQkFBc0IsV0FBVztBQUM1QyxRQUFJO0FBQ0gsaUJBQVcsTUFBTSxFQUFFLElBQUksUUFBUSxDQUFDO0FBQ2hDLFlBQU0sSUFBSSxRQUFjLGFBQVcsZUFBZSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2xFLFlBQU0sSUFBSSxRQUFjLGFBQVcsYUFBYSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2hFLGFBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFDM0MsYUFBTyxnQkFBZ0IsWUFBWSxDQUFDLENBQUM7QUFBQSxJQUN0QyxVQUFFO0FBQ0QsY0FBUSxJQUFJLHNCQUFzQixXQUFXO0FBQUEsSUFDOUM7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHlJQUF5SSxZQUFZO0FBQ3pKLFVBQU0sWUFBWSxJQUFJLE1BQU0sWUFBWTtBQUN4QyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxPQUFPO0FBQUEsTUFDWixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLFdBQVcsWUFBa0M7QUFDNUMsY0FBTSxJQUFJLE1BQU0sZ0JBQWdCO0FBQUEsTUFDakM7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1QixZQUFZLE1BQU07QUFBQSxNQUNuQjtBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQ3BCLGNBQU07QUFBQSxNQUNQO0FBQUEsSUFDRDtBQUVBLFVBQU0saUNBQWlDLFdBQVcsTUFBTSxXQUFXLE1BQU0sRUFBRSxJQUFJLFFBQVEsQ0FBQyxDQUFDO0FBQ3pGLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFBQSxFQUM1QyxDQUFDO0FBRUQsT0FBSywrRkFBK0YsWUFBWTtBQUMvRyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxhQUF3QixDQUFDO0FBQy9CLFVBQU0sY0FBYyxDQUFDLFdBQW9CO0FBQUUsaUJBQVcsS0FBSyxNQUFNO0FBQUEsSUFBRztBQUNwRSxRQUFJLFVBQVU7QUFDZCxVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsV0FBVyxZQUFrQztBQUM1QyxjQUFNLElBQUksTUFBTSxnQkFBZ0I7QUFBQSxNQUNqQztBQUFBLE1BQ0EsYUFBYSxFQUFFLG1CQUFtQixNQUFNLE1BQU07QUFBQSxNQUM5QyxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLE1BQ0EscUJBQXFCLE1BQU07QUFBRTtBQUFBLE1BQVc7QUFBQSxJQUN6QztBQUVBLFlBQVEsR0FBRyxzQkFBc0IsV0FBVztBQUM1QyxRQUFJO0FBQ0gsV0FBSyxvQkFBb0IsTUFBTSxVQUFVLFNBQVM7QUFDbEQsWUFBTSxJQUFJLFFBQWMsYUFBVyxlQUFlLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFDbEUsWUFBTSxJQUFJLFFBQWMsYUFBVyxhQUFhLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFDaEUsYUFBTyxnQkFBZ0IsVUFBVSxDQUFDLFFBQVEsQ0FBQztBQUMzQyxhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLFlBQVksU0FBUyxDQUFDO0FBQUEsSUFDOUIsVUFBRTtBQUNELGNBQVEsSUFBSSxzQkFBc0IsV0FBVztBQUFBLElBQzlDO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSywyRkFBMkYsWUFBWTtBQUMzRyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxhQUF3QixDQUFDO0FBQy9CLFVBQU0sY0FBYyxDQUFDLFdBQW9CO0FBQUUsaUJBQVcsS0FBSyxNQUFNO0FBQUEsSUFBRztBQUNwRSxRQUFJLFVBQVU7QUFDZCxVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsV0FBVyxZQUFrQztBQUM1QyxjQUFNLElBQUksTUFBTSxnQkFBZ0I7QUFBQSxNQUNqQztBQUFBLE1BQ0EsYUFBYSxFQUFFLG1CQUFtQixNQUFNLE1BQU07QUFBQSxNQUM5QyxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLE1BQ0EscUJBQXFCLE1BQU07QUFBRTtBQUFBLE1BQVc7QUFBQSxJQUN6QztBQUVBLFlBQVEsR0FBRyxzQkFBc0IsV0FBVztBQUM1QyxRQUFJO0FBQ0gsV0FBSyxnQkFBZ0IsTUFBTSxVQUFVLFNBQVMsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztBQUMvRSxZQUFNLElBQUksUUFBYyxhQUFXLGVBQWUsTUFBTSxRQUFRLENBQUMsQ0FBQztBQUNsRSxZQUFNLElBQUksUUFBYyxhQUFXLGFBQWEsTUFBTSxRQUFRLENBQUMsQ0FBQztBQUNoRSxhQUFPLGdCQUFnQixVQUFVLENBQUMsUUFBUSxDQUFDO0FBQzNDLGFBQU8sZ0JBQWdCLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLGFBQU8sWUFBWSxTQUFTLENBQUM7QUFBQSxJQUM5QixVQUFFO0FBQ0QsY0FBUSxJQUFJLHNCQUFzQixXQUFXO0FBQUEsSUFDOUM7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHFHQUFxRyxZQUFZO0FBQ3JILFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLGFBQXdCLENBQUM7QUFDL0IsVUFBTSxjQUFjLENBQUMsV0FBb0I7QUFBRSxpQkFBVyxLQUFLLE1BQU07QUFBQSxJQUFHO0FBQ3BFLFFBQUksVUFBVTtBQUNkLFFBQUksWUFBWTtBQUNoQixRQUFJQSxhQUFZO0FBQ2hCLFVBQU0sT0FBTztBQUFBLE1BQ1osbUJBQW1CLE1BQU07QUFBQSxNQUN6QixXQUFXLFlBQWtDO0FBQzVDLFFBQUFBO0FBQ0EsZUFBTyxFQUFFLFVBQVUsTUFBTSxhQUFhLEVBQUUsSUFBSSxJQUFJLEVBQUU7QUFBQSxNQUNuRDtBQUFBLE1BQ0EsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6Qiw0QkFBNEIsTUFBTTtBQUFBLFFBQ2xDLHFCQUFxQixNQUFNO0FBQzFCO0FBQ0EsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxNQUNBLHFCQUFxQixNQUFNO0FBQUU7QUFBQSxNQUFXO0FBQUEsSUFDekM7QUFFQSxZQUFRLEdBQUcsc0JBQXNCLFdBQVc7QUFDNUMsUUFBSTtBQUNILFdBQUssb0JBQW9CLE1BQU0sVUFBVSxTQUFTO0FBQ2xELFlBQU0sSUFBSSxRQUFjLGFBQVcsZUFBZSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2xFLFlBQU0sSUFBSSxRQUFjLGFBQVcsYUFBYSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2hFLGFBQU8sWUFBWSxXQUFXLENBQUM7QUFDL0IsYUFBTyxZQUFZQSxZQUFXLENBQUM7QUFDL0IsYUFBTyxnQkFBZ0IsVUFBVSxDQUFDLFFBQVEsQ0FBQztBQUMzQyxhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLFlBQVksU0FBUyxDQUFDO0FBQUEsSUFDOUIsVUFBRTtBQUNELGNBQVEsSUFBSSxzQkFBc0IsV0FBVztBQUFBLElBQzlDO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx3RkFBd0YsWUFBWTtBQUN4RyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsUUFBSSxZQUFZO0FBQ2hCLFFBQUksVUFBVTtBQUNkLFVBQU0sT0FBTztBQUFBLE1BQ1osbUJBQW1CLE1BQU07QUFBQSxNQUN6QixXQUFXLFlBQWtDO0FBQzVDLGVBQU8sRUFBRSxVQUFVLE1BQU0sYUFBYSxFQUFFLElBQUksSUFBSSxFQUFFO0FBQUEsTUFDbkQ7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsNEJBQTRCLE1BQU07QUFBQSxRQUNsQyxxQkFBcUIsTUFBTTtBQUMxQixzQkFBWTtBQUNaLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGlCQUFpQixDQUFDLFdBQWtEO0FBQ25FLGlCQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3JCO0FBQUEsTUFDQSxxQkFBcUIsTUFBTTtBQUFFO0FBQUEsTUFBVztBQUFBLElBQ3pDO0FBRUEsVUFBTSxvQkFBb0IsTUFBTSxVQUFVLFNBQVM7QUFFbkQsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQ3hELFdBQU8sWUFBWSxTQUFTLENBQUM7QUFBQSxFQUM5QixDQUFDO0FBRUQsT0FBSyxpR0FBaUcsWUFBWTtBQUNqSCxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxhQUF3QixDQUFDO0FBQy9CLFVBQU0sY0FBYyxDQUFDLFdBQW9CO0FBQUUsaUJBQVcsS0FBSyxNQUFNO0FBQUEsSUFBRztBQUNwRSxRQUFJLFVBQVU7QUFDZCxRQUFJLFlBQVk7QUFDaEIsUUFBSUEsYUFBWTtBQUNoQixVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsV0FBVyxZQUFrQztBQUM1QyxRQUFBQTtBQUNBLGVBQU8sRUFBRSxVQUFVLE1BQU0sYUFBYSxFQUFFLElBQUksSUFBSSxFQUFFO0FBQUEsTUFDbkQ7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsNEJBQTRCLE1BQU07QUFBQSxRQUNsQyxpQkFBaUIsTUFBTTtBQUN0QjtBQUNBLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGlCQUFpQixDQUFDLFdBQWtEO0FBQ25FLGlCQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3JCO0FBQUEsTUFDQSxxQkFBcUIsTUFBTTtBQUFFO0FBQUEsTUFBVztBQUFBLElBQ3pDO0FBRUEsWUFBUSxHQUFHLHNCQUFzQixXQUFXO0FBQzVDLFFBQUk7QUFDSCxXQUFLLGdCQUFnQixNQUFNLFVBQVUsU0FBUyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDO0FBQy9FLFlBQU0sSUFBSSxRQUFjLGFBQVcsZUFBZSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2xFLFlBQU0sSUFBSSxRQUFjLGFBQVcsYUFBYSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2hFLGFBQU8sWUFBWSxXQUFXLENBQUM7QUFDL0IsYUFBTyxZQUFZQSxZQUFXLENBQUM7QUFDL0IsYUFBTyxnQkFBZ0IsVUFBVSxDQUFDLFFBQVEsQ0FBQztBQUMzQyxhQUFPLGdCQUFnQixZQUFZLENBQUMsQ0FBQztBQUNyQyxhQUFPLFlBQVksU0FBUyxDQUFDO0FBQUEsSUFDOUIsVUFBRTtBQUNELGNBQVEsSUFBSSxzQkFBc0IsV0FBVztBQUFBLElBQzlDO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxvRkFBb0YsWUFBWTtBQUNwRyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsUUFBSSxZQUFZO0FBQ2hCLFFBQUksVUFBVTtBQUNkLFVBQU0sT0FBTztBQUFBLE1BQ1osbUJBQW1CLE1BQU07QUFBQSxNQUN6QixXQUFXLFlBQWtDO0FBQzVDLGVBQU8sRUFBRSxVQUFVLE1BQU0sYUFBYSxFQUFFLElBQUksSUFBSSxFQUFFO0FBQUEsTUFDbkQ7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsNEJBQTRCLE1BQU07QUFBQSxRQUNsQyxpQkFBaUIsTUFBTTtBQUN0QixzQkFBWTtBQUNaLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGlCQUFpQixDQUFDLFdBQWtEO0FBQ25FLGlCQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3JCO0FBQUEsTUFDQSxxQkFBcUIsTUFBTTtBQUFFO0FBQUEsTUFBVztBQUFBLElBQ3pDO0FBRUEsVUFBTSxnQkFBZ0IsTUFBTSxVQUFVLFNBQVMsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztBQUVoRixXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFDeEQsV0FBTyxZQUFZLFNBQVMsQ0FBQztBQUFBLEVBQzlCLENBQUM7QUFFRCxXQUFTLDZCQUE2QixVQUdwQztBQUNELFVBQU0sUUFBUSxFQUFFLFFBQVEsRUFBRTtBQUMxQixVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsa0JBQWtCO0FBQUEsUUFDakIsTUFBTSxZQUFZO0FBQ2pCLGdCQUFNO0FBQ04saUJBQU8sRUFBRSxVQUFVLE1BQU0sYUFBYSxFQUFFLElBQUksSUFBSSxFQUFFO0FBQUEsUUFDbkQ7QUFBQSxNQUNEO0FBQUEsTUFDQSxXQUFXLE9BQU8sUUFBd0Q7QUFDekUsZUFBTyxVQUFVLE1BQWtELEdBQUc7QUFBQSxNQUN2RTtBQUFBLE1BQ0EsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLDRCQUE0QixNQUFNO0FBQUEsTUFDbkM7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2pFLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLEtBQUs7QUFBQSxNQUN0RDtBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxNQUNBLHFCQUFxQixNQUFNO0FBQUEsTUFBRTtBQUFBLElBQzlCO0FBQ0EsV0FBTyxFQUFFLE1BQThELElBQUksU0FBUztBQUFFLGFBQU8sTUFBTTtBQUFBLElBQVEsRUFBRTtBQUFBLEVBQzlHO0FBRUEsT0FBSyxvRUFBb0UsWUFBWTtBQUNwRixVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxFQUFFLE1BQU0sT0FBTyxJQUFJLDZCQUE2QixRQUFRO0FBQzlELFVBQU0sVUFBVSxNQUFNLFVBQVUsTUFBa0Q7QUFBQSxNQUNqRixNQUFNO0FBQUEsTUFDTixTQUFTO0FBQUEsTUFDVCxRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUEsSUFDWixDQUFDO0FBQ0QsV0FBTyxZQUFZLFFBQVEsQ0FBQztBQUM1QixXQUFPLFlBQVksUUFBUSxVQUFVLEtBQUs7QUFDMUMsUUFBSSxDQUFDLFFBQVEsVUFBVTtBQUN0QixhQUFPLFlBQVksUUFBUSxRQUFRLGlCQUFpQjtBQUFBLElBQ3JEO0FBQ0EsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLENBQUM7QUFBQSxFQUNwQyxDQUFDO0FBRUQsT0FBSywrRkFBK0YsWUFBWTtBQUMvRyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxFQUFFLE1BQU0sT0FBTyxJQUFJLDZCQUE2QixRQUFRO0FBQzlELFVBQU0sb0JBQW9CLE1BQU0sVUFBVSxTQUFTO0FBQ25ELFdBQU8sWUFBWSxRQUFRLENBQUM7QUFDNUIsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQUEsRUFDekQsQ0FBQztBQUVELE9BQUssMkZBQTJGLFlBQVk7QUFDM0csVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sRUFBRSxNQUFNLE9BQU8sSUFBSSw2QkFBNkIsUUFBUTtBQUM5RCxVQUFNLGdCQUFnQixNQUFNLFVBQVUsU0FBUyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDO0FBQ2hGLFdBQU8sWUFBWSxRQUFRLENBQUM7QUFDNUIsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQUEsRUFDekQsQ0FBQztBQUVELFdBQVMscUNBQXFDLFVBQW1ELGdCQUF5QixxQkFBcUIsTUFRN0k7QUFDRCxVQUFNLFFBQVEsRUFBRSwwQkFBMEIsR0FBRyxzQkFBc0IsR0FBRyxpQkFBaUIsR0FBRyxxQkFBcUIsR0FBRyxRQUFRLEdBQUcsU0FBUyxFQUFFO0FBQ3hJLFVBQU0sT0FBTztBQUFBLE1BQ1osbUJBQW1CLE1BQU07QUFBQSxNQUN6QixXQUFXLFlBQWtDO0FBQzVDLGNBQU07QUFDTixlQUFPLEVBQUUsVUFBVSxNQUFNLGFBQWEsRUFBRSxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ25EO0FBQUEsTUFDQSxhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLHNCQUFzQixNQUFNO0FBQUEsUUFDNUIsNEJBQTRCLE1BQU07QUFBQSxRQUNsQyxxQkFBcUIsTUFBTTtBQUMxQixnQkFBTTtBQUNOLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBQ0EsaUJBQWlCLE1BQU07QUFDdEIsZ0JBQU07QUFDTixpQkFBTztBQUFBLFFBQ1I7QUFBQSxRQUNBLFlBQVksTUFBTTtBQUNqQixnQkFBTTtBQUNOLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBQ0EsZ0JBQWdCLE1BQU07QUFDckIsZ0JBQU07QUFDTixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGVBQWU7QUFBQSxNQUNoRDtBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxNQUNBLHFCQUFxQixNQUFNO0FBQUUsY0FBTTtBQUFBLE1BQVc7QUFBQSxJQUMvQztBQUNBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQSxJQUFJLDJCQUEyQjtBQUFFLGVBQU8sTUFBTTtBQUFBLE1BQTBCO0FBQUEsTUFDeEUsSUFBSSx1QkFBdUI7QUFBRSxlQUFPLE1BQU07QUFBQSxNQUFzQjtBQUFBLE1BQ2hFLElBQUksa0JBQWtCO0FBQUUsZUFBTyxNQUFNO0FBQUEsTUFBaUI7QUFBQSxNQUN0RCxJQUFJLHNCQUFzQjtBQUFFLGVBQU8sTUFBTTtBQUFBLE1BQXFCO0FBQUEsTUFDOUQsSUFBSSxTQUFTO0FBQUUsZUFBTyxNQUFNO0FBQUEsTUFBUTtBQUFBLE1BQ3BDLElBQUksVUFBVTtBQUFFLGVBQU8sTUFBTTtBQUFBLE1BQVM7QUFBQSxJQUN2QztBQUFBLEVBQ0Q7QUFFQSxPQUFLLHFGQUFxRixZQUFZO0FBQ3JHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUscUNBQXFDLFVBQVUsSUFBSTtBQUNuRSxVQUFNLG9CQUFvQixRQUFRLE1BQU0sVUFBVSxTQUFTO0FBQzNELFdBQU8sWUFBWSxRQUFRLDBCQUEwQixDQUFDO0FBQ3RELFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLFlBQVksUUFBUSxTQUFTLENBQUM7QUFDckMsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQUEsRUFDekQsQ0FBQztBQUVELE9BQUssaUZBQWlGLFlBQVk7QUFDakcsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sVUFBVSxxQ0FBcUMsVUFBVSxJQUFJO0FBQ25FLFVBQU0sZ0JBQWdCLFFBQVEsTUFBTSxVQUFVLFNBQVMsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztBQUN4RixXQUFPLFlBQVksUUFBUSxzQkFBc0IsQ0FBQztBQUNsRCxXQUFPLFlBQVksUUFBUSxRQUFRLENBQUM7QUFDcEMsV0FBTyxZQUFZLFFBQVEsU0FBUyxDQUFDO0FBQ3JDLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQztBQUFBLEVBQ3pELENBQUM7QUFFRCxPQUFLLDRFQUE0RSxNQUFNO0FBQ3RGLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUscUNBQXFDLFVBQVUsSUFBSTtBQUNuRSxlQUFXLFFBQVEsTUFBTSxRQUFRO0FBQ2pDLFdBQU8sWUFBWSxRQUFRLGlCQUFpQixDQUFDO0FBQzdDLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFBQSxFQUN6RCxDQUFDO0FBRUQsT0FBSyxnRkFBZ0YsTUFBTTtBQUMxRixVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFVLHFDQUFxQyxVQUFVLElBQUk7QUFDbkUsbUJBQWUsUUFBUSxNQUFNLEVBQUUsSUFBSSxTQUFTLFlBQVksUUFBUSxTQUFTLFFBQVEsQ0FBQztBQUNsRixXQUFPLFlBQVksUUFBUSxxQkFBcUIsQ0FBQztBQUNqRCxXQUFPLFlBQVksUUFBUSxRQUFRLENBQUM7QUFDcEMsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQUEsRUFDekQsQ0FBQztBQUVELE9BQUssZ0ZBQWdGLFlBQVk7QUFDaEcsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sVUFBVSxxQ0FBcUMsVUFBVSxJQUFJO0FBQ25FLGVBQVcsUUFBUSxNQUFNLEVBQUUsSUFBSSxTQUFTLFFBQVEsVUFBVSxTQUFTLE9BQU8sQ0FBQztBQUMzRSxVQUFNLElBQUksUUFBYyxhQUFXLGVBQWUsTUFBTSxRQUFRLENBQUMsQ0FBQztBQUNsRSxXQUFPLFlBQVksUUFBUSxRQUFRLENBQUM7QUFDcEMsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQUEsRUFDekQsQ0FBQztBQUVELE9BQUssZ0VBQWdFLFlBQVk7QUFDaEYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sVUFBVSxxQ0FBcUMsVUFBVSxLQUFLO0FBQ3BFLFVBQU0sb0JBQW9CLFFBQVEsTUFBTSxVQUFVLFNBQVM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsMEJBQTBCLENBQUM7QUFDdEQsV0FBTyxZQUFZLFFBQVEsUUFBUSxDQUFDO0FBQ3BDLFdBQU8sWUFBWSxRQUFRLFNBQVMsQ0FBQztBQUNyQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUFBLEVBQ3BDLENBQUM7QUFFRCxPQUFLLDREQUE0RCxZQUFZO0FBQzVFLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUscUNBQXFDLFVBQVUsS0FBSztBQUNwRSxVQUFNLGdCQUFnQixRQUFRLE1BQU0sVUFBVSxTQUFTLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUM7QUFDeEYsV0FBTyxZQUFZLFFBQVEsc0JBQXNCLENBQUM7QUFDbEQsV0FBTyxZQUFZLFFBQVEsUUFBUSxDQUFDO0FBQ3BDLFdBQU8sWUFBWSxRQUFRLFNBQVMsQ0FBQztBQUNyQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUFBLEVBQ3BDLENBQUM7QUFFRCxPQUFLLHVEQUF1RCxNQUFNO0FBQ2pFLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUscUNBQXFDLFVBQVUsS0FBSztBQUNwRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsSUFBSTtBQUN4RSxlQUFXLFFBQVEsTUFBTSxRQUFRO0FBQ2pDLFdBQU8sWUFBWSxRQUFRLGlCQUFpQixDQUFDO0FBQzdDLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUFBLEVBQ3BDLENBQUM7QUFFRCxPQUFLLDJEQUEyRCxNQUFNO0FBQ3JFLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUscUNBQXFDLFVBQVUsS0FBSztBQUNwRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsSUFBSTtBQUN4RSxtQkFBZSxRQUFRLE1BQU0sRUFBRSxJQUFJLFNBQVMsWUFBWSxRQUFRLFNBQVMsUUFBUSxDQUFDO0FBQ2xGLFdBQU8sWUFBWSxRQUFRLHFCQUFxQixDQUFDO0FBQ2pELFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUFBLEVBQ3BDLENBQUM7QUFFRCxPQUFLLHVFQUF1RSxZQUFZO0FBQ3ZGLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUscUNBQXFDLFVBQVUsS0FBSztBQUNwRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsSUFBSTtBQUN4RSxlQUFXLFFBQVEsTUFBTSxFQUFFLElBQUksU0FBUyxRQUFRLFVBQVUsU0FBUyxPQUFPLENBQUM7QUFDM0UsVUFBTSxJQUFJLFFBQWMsYUFBVyxlQUFlLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFDbEUsV0FBTyxZQUFZLFFBQVEsUUFBUSxDQUFDO0FBQ3BDLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDO0FBQUEsRUFDcEMsQ0FBQztBQUVELE9BQUssdUZBQXVGLFlBQVk7QUFDdkcsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sVUFBVSxxQ0FBcUMsVUFBVSxPQUFPLEtBQUs7QUFDM0UsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLGtCQUFrQixHQUFHLElBQUk7QUFDckUsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLHFCQUFxQixHQUFHLEtBQUs7QUFDekUsV0FBTyxZQUFZLFFBQVEsS0FBSyxhQUFhLHNCQUFzQixFQUFFLGdCQUFnQixLQUFLO0FBQzFGLFdBQU8sWUFBWSwwQkFBMEIsUUFBUSxLQUFLLFlBQVksR0FBRyxLQUFLO0FBQzlFLFVBQU0sb0JBQW9CLFFBQVEsTUFBTSxVQUFVLFNBQVM7QUFDM0QsV0FBTyxZQUFZLFFBQVEsMEJBQTBCLENBQUM7QUFDdEQsV0FBTyxZQUFZLFFBQVEsUUFBUSxDQUFDO0FBQ3BDLFdBQU8sWUFBWSxRQUFRLFNBQVMsQ0FBQztBQUNyQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsbUJBQW1CLENBQUM7QUFBQSxFQUN2RCxDQUFDO0FBRUQsT0FBSyxtRkFBbUYsWUFBWTtBQUNuRyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFVLHFDQUFxQyxVQUFVLE9BQU8sS0FBSztBQUMzRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUNyRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsS0FBSztBQUN6RSxXQUFPLFlBQVksUUFBUSxLQUFLLGFBQWEsc0JBQXNCLEVBQUUsZ0JBQWdCLEtBQUs7QUFDMUYsV0FBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFDOUUsVUFBTSxnQkFBZ0IsUUFBUSxNQUFNLFVBQVUsU0FBUyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDO0FBQ3hGLFdBQU8sWUFBWSxRQUFRLHNCQUFzQixDQUFDO0FBQ2xELFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLFlBQVksUUFBUSxTQUFTLENBQUM7QUFDckMsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLG1CQUFtQixDQUFDO0FBQUEsRUFDdkQsQ0FBQztBQUVELE9BQUssOEVBQThFLE1BQU07QUFDeEYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sVUFBVSxxQ0FBcUMsVUFBVSxPQUFPLEtBQUs7QUFDM0UsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLGtCQUFrQixHQUFHLElBQUk7QUFDckUsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLHFCQUFxQixHQUFHLEtBQUs7QUFDekUsV0FBTyxZQUFZLFFBQVEsS0FBSyxhQUFhLHNCQUFzQixFQUFFLGdCQUFnQixLQUFLO0FBQzFGLFdBQU8sWUFBWSwwQkFBMEIsUUFBUSxLQUFLLFlBQVksR0FBRyxLQUFLO0FBQzlFLGVBQVcsUUFBUSxNQUFNLFFBQVE7QUFDakMsV0FBTyxZQUFZLFFBQVEsaUJBQWlCLENBQUM7QUFDN0MsV0FBTyxZQUFZLFFBQVEsUUFBUSxDQUFDO0FBQ3BDLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQztBQUFBLEVBQ3ZELENBQUM7QUFFRCxPQUFLLGtGQUFrRixNQUFNO0FBQzVGLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUscUNBQXFDLFVBQVUsT0FBTyxLQUFLO0FBQzNFLFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxJQUFJO0FBQ3JFLFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxxQkFBcUIsR0FBRyxLQUFLO0FBQ3pFLFdBQU8sWUFBWSxRQUFRLEtBQUssYUFBYSxzQkFBc0IsRUFBRSxnQkFBZ0IsS0FBSztBQUMxRixXQUFPLFlBQVksMEJBQTBCLFFBQVEsS0FBSyxZQUFZLEdBQUcsS0FBSztBQUM5RSxtQkFBZSxRQUFRLE1BQU0sRUFBRSxJQUFJLFNBQVMsWUFBWSxRQUFRLFNBQVMsUUFBUSxDQUFDO0FBQ2xGLFdBQU8sWUFBWSxRQUFRLHFCQUFxQixDQUFDO0FBQ2pELFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsbUJBQW1CLENBQUM7QUFBQSxFQUN2RCxDQUFDO0FBRUQsT0FBSyxrRkFBa0YsWUFBWTtBQUNsRyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFVLHFDQUFxQyxVQUFVLE9BQU8sS0FBSztBQUMzRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUNyRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsS0FBSztBQUN6RSxXQUFPLFlBQVksUUFBUSxLQUFLLGFBQWEsc0JBQXNCLEVBQUUsZ0JBQWdCLEtBQUs7QUFDMUYsV0FBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFDOUUsZUFBVyxRQUFRLE1BQU0sRUFBRSxJQUFJLFNBQVMsUUFBUSxVQUFVLFNBQVMsT0FBTyxDQUFDO0FBQzNFLFVBQU0sSUFBSSxRQUFjLGFBQVcsZUFBZSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2xFLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsbUJBQW1CLENBQUM7QUFBQSxFQUN2RCxDQUFDO0FBRUQsT0FBSyxzRkFBc0YsWUFBWTtBQUN0RyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxFQUFFLE1BQU0sT0FBTyxJQUFJLDZCQUE2QixRQUFRO0FBQzlELGVBQVcsTUFBTSxFQUFFLElBQUksU0FBUyxRQUFRLFVBQVUsU0FBUyxPQUFPLENBQUM7QUFDbkUsVUFBTSxJQUFJLFFBQWMsYUFBVyxlQUFlLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFDbEUsV0FBTyxZQUFZLFFBQVEsQ0FBQztBQUM1QixXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFBQSxFQUN6RCxDQUFDO0FBRUQsV0FBUyw2QkFBNkIsVUFNcEM7QUFDRCxVQUFNLFFBQVEsRUFBRSxRQUFRLEdBQUcsY0FBYyxHQUFHLFlBQVksR0FBRyxhQUFhLEVBQUU7QUFDMUUsVUFBTSxPQUFPO0FBQUEsTUFDWixnQkFBZ0I7QUFBQSxNQUNoQixnQkFBZ0I7QUFBQSxNQUNoQixlQUFlO0FBQUEsTUFDZixvQkFBb0I7QUFBQSxNQUNwQixjQUFjLEVBQUUsT0FBTyxpQkFBaUI7QUFBQSxNQUN4QyxZQUFZLEVBQUUsU0FBUyxLQUFLO0FBQUEsTUFDNUIsbUJBQW1CLE1BQU07QUFBQSxNQUN6QixxQkFBcUIsT0FBTyxFQUFFLElBQUksTUFBTSxTQUFTLFNBQVM7QUFBQSxNQUMxRCxrQkFBa0I7QUFBQSxRQUNqQixNQUFNLFlBQVk7QUFDakIsZ0JBQU07QUFDTixpQkFBTyxFQUFFLFVBQVUsTUFBTSxhQUFhLEVBQUUsSUFBSSxJQUFJLEVBQUU7QUFBQSxRQUNuRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1Qiw0QkFBNEIsTUFBTTtBQUFBLFFBQ2xDLHlCQUF5QixNQUFNO0FBQzlCLGdCQUFNO0FBQ04saUJBQU87QUFBQSxRQUNSO0FBQUEsUUFDQSxvQkFBb0IsTUFBTTtBQUN6QixnQkFBTTtBQUNOLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBQ0EsK0JBQStCLE1BQU07QUFDcEMsZ0JBQU07QUFDTixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixLQUFLO0FBQUEsTUFDdEQ7QUFBQSxNQUNBLGtCQUFrQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzFCLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLG1CQUFtQixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQzNCLHlCQUF5QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ2pDLHlCQUF5QixNQUFNO0FBQUEsTUFBRTtBQUFBLE1BQ2pDLGlCQUFpQixDQUFDLFdBQWtEO0FBQ25FLGlCQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3JCO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQSxJQUFJLFNBQVM7QUFBRSxlQUFPLE1BQU07QUFBQSxNQUFRO0FBQUEsTUFDcEMsSUFBSSxlQUFlO0FBQUUsZUFBTyxNQUFNO0FBQUEsTUFBYztBQUFBLE1BQ2hELElBQUksYUFBYTtBQUFFLGVBQU8sTUFBTTtBQUFBLE1BQVk7QUFBQSxNQUM1QyxJQUFJLGNBQWM7QUFBRSxlQUFPLE1BQU07QUFBQSxNQUFhO0FBQUEsSUFDL0M7QUFBQSxFQUNEO0FBRUEsT0FBSywrREFBK0QsTUFBTTtBQUN6RSxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxFQUFFLEtBQUssSUFBSSw2QkFBNkIsUUFBUTtBQUN0RCxVQUFNLGFBQWE7QUFDbkIsc0JBQWtCLFVBQVU7QUFDNUIsV0FBTyxZQUFZLFdBQVcsV0FBVyxTQUFTLEtBQUs7QUFDdkQsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLENBQUM7QUFBQSxFQUNwQyxDQUFDO0FBRUQsT0FBSyxvRUFBb0UsWUFBWTtBQUNwRixVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxFQUFFLE1BQU0sUUFBUSxhQUFhLElBQUksNkJBQTZCLFFBQVE7QUFDNUUsVUFBTSxZQUFZLElBQUk7QUFDdEIsV0FBTyxZQUFZLFFBQVEsQ0FBQztBQUM1QixXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQztBQUN4RCxXQUFPLFlBQVksS0FBSyxhQUFhLE9BQU8sZ0JBQWdCO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUssdUVBQXVFLE1BQU07QUFDakYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sRUFBRSxNQUFNLFdBQVcsSUFBSSw2QkFBNkIsUUFBUTtBQUNsRSxTQUFLLGlCQUFpQjtBQUN0QixpQkFBYSxJQUFJO0FBQ2pCLFdBQU8sWUFBWSxZQUFZLENBQUM7QUFDaEMsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQ3hELFdBQU8sWUFBWSxLQUFLLGVBQWUsUUFBUTtBQUMvQyxXQUFPLFlBQVksS0FBSyxnQkFBZ0IsVUFBVTtBQUNsRCxXQUFPLFlBQVksS0FBSyxhQUFhLE9BQU8sZ0JBQWdCO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUssd0VBQXdFLE1BQU07QUFDbEYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sRUFBRSxNQUFNLFlBQVksSUFBSSw2QkFBNkIsUUFBUTtBQUNuRSxTQUFLLGlCQUFpQjtBQUN0QixrQkFBYyxJQUFJO0FBQ2xCLFdBQU8sWUFBWSxhQUFhLENBQUM7QUFDakMsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQ3hELFdBQU8sWUFBWSxLQUFLLG9CQUFvQixJQUFJO0FBQ2hELFdBQU8sWUFBWSxLQUFLLGdCQUFnQixXQUFXO0FBQ25ELFdBQU8sWUFBWSxLQUFLLGFBQWEsT0FBTyxnQkFBZ0I7QUFBQSxFQUM3RCxDQUFDO0FBRUQsV0FBUyw0QkFBNEIsU0FZbkM7QUFDRCxVQUFNLFFBQVEsRUFBRSxRQUFRLEdBQUcsY0FBYyxHQUFHLFlBQVksR0FBRyxhQUFhLEdBQUcsUUFBUSxFQUFFO0FBQ3JGLFVBQU0sT0FBTztBQUFBLE1BQ1osZ0JBQWdCO0FBQUEsTUFDaEIsZ0JBQWdCO0FBQUEsTUFDaEIsZUFBZTtBQUFBLE1BQ2YsaUJBQWlCLENBQUMsRUFBRTtBQUFBLE1BQ3BCLG9CQUFvQjtBQUFBLE1BQ3BCLFFBQVEsb0JBQUksSUFBb0I7QUFBQSxNQUNoQyxzQkFBc0IsRUFBRSxVQUFVLE1BQU0sTUFBTTtBQUFBLE1BQzlDLGVBQWU7QUFBQSxNQUNmLG9CQUFvQjtBQUFBLE1BQ3BCLGNBQWMsRUFBRSxPQUFPLGlCQUFpQjtBQUFBLE1BQ3hDLFlBQVksRUFBRSxTQUFTLEtBQUs7QUFBQSxNQUM1QixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLHFCQUFxQixPQUFPLEVBQUUsSUFBSSxNQUFNLFNBQVMsU0FBUztBQUFBLE1BQzFELGtCQUFrQjtBQUFBLFFBQ2pCLE1BQU0sWUFBWTtBQUNqQixnQkFBTTtBQUNOLGlCQUFPLEVBQUUsVUFBVSxNQUFNLGFBQWEsRUFBRSxJQUFJLElBQUksRUFBRTtBQUFBLFFBQ25EO0FBQUEsTUFDRDtBQUFBLE1BQ0EsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU0sUUFBUTtBQUFBLFFBQ2pDLEdBQUksUUFBUSx1QkFBdUIsU0FBWSxDQUFDLElBQUksRUFBRSxzQkFBc0IsTUFBTSxRQUFRLG1CQUFtQjtBQUFBLFFBQzdHLDRCQUE0QixNQUFNO0FBQUEsUUFDbEMseUJBQXlCLE1BQU07QUFDOUIsZ0JBQU07QUFDTixpQkFBTztBQUFBLFFBQ1I7QUFBQSxRQUNBLG9CQUFvQixNQUFNO0FBQ3pCLGdCQUFNO0FBQ04saUJBQU87QUFBQSxRQUNSO0FBQUEsUUFDQSwrQkFBK0IsTUFBTTtBQUNwQyxnQkFBTTtBQUNOLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBQ0EsVUFBVSxNQUFNLENBQUM7QUFBQSxRQUNqQiw2QkFBNkIsTUFBTTtBQUFBLFFBQUU7QUFBQSxNQUN0QztBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2Isb0JBQW9CLE9BQU8sRUFBRSxNQUFNLGFBQWEsTUFBTSxXQUFXO0FBQUEsUUFDakUsdUJBQXVCLE9BQU8sRUFBRSxnQkFBZ0IsUUFBUSxlQUFlO0FBQUEsTUFDeEU7QUFBQSxNQUNBLGtCQUFrQixNQUFNO0FBQUUsY0FBTTtBQUFBLE1BQVU7QUFBQSxNQUMxQyxtQkFBbUIsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUMzQixtQkFBbUIsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUMzQix5QkFBeUIsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUNqQyx5QkFBeUIsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUNqQyxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxnQkFBUSxTQUFTLEtBQUssTUFBTTtBQUFBLE1BQzdCO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQSxJQUFJLFNBQVM7QUFBRSxlQUFPLE1BQU07QUFBQSxNQUFRO0FBQUEsTUFDcEMsSUFBSSxlQUFlO0FBQUUsZUFBTyxNQUFNO0FBQUEsTUFBYztBQUFBLE1BQ2hELElBQUksYUFBYTtBQUFFLGVBQU8sTUFBTTtBQUFBLE1BQVk7QUFBQSxNQUM1QyxJQUFJLGNBQWM7QUFBRSxlQUFPLE1BQU07QUFBQSxNQUFhO0FBQUEsTUFDOUMsSUFBSSxTQUFTO0FBQUUsZUFBTyxNQUFNO0FBQUEsTUFBUTtBQUFBLElBQ3JDO0FBQUEsRUFDRDtBQUVBLE9BQUssbUZBQW1GLFlBQVk7QUFDbkcsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sVUFBVSw0QkFBNEI7QUFBQSxNQUMzQyxnQkFBZ0I7QUFBQSxNQUNoQixpQkFBaUI7QUFBQSxNQUNqQixvQkFBb0I7QUFBQSxNQUNwQjtBQUFBLElBQ0QsQ0FBQztBQUNELFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxJQUFJO0FBQ3JFLFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxxQkFBcUIsR0FBRyxLQUFLO0FBQ3pFLFdBQU8sWUFBWSxRQUFRLEtBQUssYUFBYSxzQkFBc0IsRUFBRSxnQkFBZ0IsS0FBSztBQUMxRixXQUFPLFlBQVksMEJBQTBCLFFBQVEsS0FBSyxZQUFZLEdBQUcsS0FBSztBQUM5RSxVQUFNLFlBQVksUUFBUSxJQUFJO0FBQzlCLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLFlBQVksUUFBUSxjQUFjLENBQUM7QUFDMUMsV0FBTyxZQUFZLFFBQVEsS0FBSyxnQkFBZ0IsS0FBSztBQUNyRCxXQUFPLGdCQUFnQixVQUFVLENBQUMsbUJBQW1CLENBQUM7QUFDdEQsV0FBTyxZQUFZLFFBQVEsS0FBSyxhQUFhLE9BQU8sZ0JBQWdCO0FBQUEsRUFDckUsQ0FBQztBQUVELE9BQUssbUZBQW1GLE1BQU07QUFDN0YsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sVUFBVSw0QkFBNEI7QUFBQSxNQUMzQyxnQkFBZ0I7QUFBQSxNQUNoQixpQkFBaUI7QUFBQSxNQUNqQixvQkFBb0I7QUFBQSxNQUNwQjtBQUFBLElBQ0QsQ0FBQztBQUNELFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxJQUFJO0FBQ3JFLFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxxQkFBcUIsR0FBRyxLQUFLO0FBQ3pFLFdBQU8sWUFBWSxRQUFRLEtBQUssYUFBYSxzQkFBc0IsRUFBRSxnQkFBZ0IsS0FBSztBQUMxRixXQUFPLFlBQVksMEJBQTBCLFFBQVEsS0FBSyxZQUFZLEdBQUcsS0FBSztBQUM5RSxZQUFRLEtBQUssaUJBQWlCO0FBQzlCLGlCQUFhLFFBQVEsSUFBSTtBQUN6QixXQUFPLFlBQVksUUFBUSxZQUFZLENBQUM7QUFDeEMsV0FBTyxZQUFZLFFBQVEsUUFBUSxDQUFDO0FBQ3BDLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQztBQUN0RCxXQUFPLFlBQVksUUFBUSxLQUFLLGVBQWUsUUFBUTtBQUN2RCxXQUFPLFlBQVksUUFBUSxLQUFLLGdCQUFnQixVQUFVO0FBQzFELFdBQU8sWUFBWSxRQUFRLEtBQUssYUFBYSxPQUFPLGdCQUFnQjtBQUFBLEVBQ3JFLENBQUM7QUFFRCxPQUFLLDZFQUE2RSxNQUFNO0FBQ3ZGLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUsNEJBQTRCO0FBQUEsTUFDM0MsZ0JBQWdCO0FBQUEsTUFDaEIsaUJBQWlCO0FBQUEsTUFDakIsb0JBQW9CO0FBQUEsTUFDcEI7QUFBQSxJQUNELENBQUM7QUFDRCxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUNyRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsS0FBSztBQUN6RSxXQUFPLFlBQVksUUFBUSxLQUFLLGFBQWEsc0JBQXNCLEVBQUUsZ0JBQWdCLEtBQUs7QUFDMUYsV0FBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFDOUUsWUFBUSxLQUFLLGlCQUFpQjtBQUM5QixrQkFBYyxRQUFRLElBQUk7QUFDMUIsV0FBTyxZQUFZLFFBQVEsYUFBYSxDQUFDO0FBQ3pDLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsbUJBQW1CLENBQUM7QUFDdEQsV0FBTyxZQUFZLFFBQVEsS0FBSyxvQkFBb0IsSUFBSTtBQUN4RCxXQUFPLFlBQVksUUFBUSxLQUFLLGdCQUFnQixXQUFXO0FBQzNELFdBQU8sWUFBWSxRQUFRLEtBQUssYUFBYSxPQUFPLGdCQUFnQjtBQUFBLEVBQ3JFLENBQUM7QUFFRCxPQUFLLGlGQUFpRixZQUFZO0FBQ2pHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLFVBQVUsNEJBQTRCO0FBQUEsTUFDM0MsZ0JBQWdCO0FBQUEsTUFDaEIsaUJBQWlCO0FBQUEsTUFDakIsb0JBQW9CO0FBQUEsTUFDcEI7QUFBQSxJQUNELENBQUM7QUFDRCxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUNyRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsSUFBSTtBQUN4RSxXQUFPLFlBQVksMEJBQTBCLFFBQVEsS0FBSyxZQUFZLEdBQUcsSUFBSTtBQUM3RSxVQUFNLFlBQVksUUFBUSxJQUFJO0FBQzlCLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLFlBQVksUUFBUSxjQUFjLENBQUM7QUFDMUMsV0FBTyxZQUFZLFFBQVEsS0FBSyxnQkFBZ0IsS0FBSztBQUNyRCxXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFBQSxFQUN6RCxDQUFDO0FBRUQsT0FBSyw2REFBNkQsTUFBTTtBQUN2RSxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFVLDRCQUE0QjtBQUFBLE1BQzNDLGdCQUFnQjtBQUFBLE1BQ2hCLGlCQUFpQjtBQUFBLE1BQ2pCLG9CQUFvQjtBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDO0FBQ0QsV0FBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLElBQUk7QUFDN0UsWUFBUSxLQUFLLGlCQUFpQjtBQUM5QixpQkFBYSxRQUFRLElBQUk7QUFDekIsV0FBTyxZQUFZLFFBQVEsWUFBWSxDQUFDO0FBQ3hDLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFBQSxFQUN6RCxDQUFDO0FBRUQsT0FBSyx1REFBdUQsTUFBTTtBQUNqRSxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFVLDRCQUE0QjtBQUFBLE1BQzNDLGdCQUFnQjtBQUFBLE1BQ2hCLGlCQUFpQjtBQUFBLE1BQ2pCLG9CQUFvQjtBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDO0FBQ0QsV0FBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLElBQUk7QUFDN0UsWUFBUSxLQUFLLGlCQUFpQjtBQUM5QixrQkFBYyxRQUFRLElBQUk7QUFDMUIsV0FBTyxZQUFZLFFBQVEsYUFBYSxDQUFDO0FBQ3pDLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFBQSxFQUN6RCxDQUFDO0FBRUQsT0FBSyx1RUFBdUUsWUFBWTtBQUN2RixVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFVLDRCQUE0QjtBQUFBLE1BQzNDLGdCQUFnQjtBQUFBLE1BQ2hCLGlCQUFpQjtBQUFBLE1BQ2pCLG9CQUFvQjtBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDO0FBQ0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLGtCQUFrQixHQUFHLElBQUk7QUFDckUsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLHFCQUFxQixHQUFHLElBQUk7QUFDeEUsV0FBTyxZQUFZLFFBQVEsS0FBSyxhQUFhLHNCQUFzQixFQUFFLGdCQUFnQixLQUFLO0FBQzFGLFdBQU8sWUFBWSwwQkFBMEIsUUFBUSxLQUFLLFlBQVksR0FBRyxLQUFLO0FBQzlFLFVBQU0sWUFBWSxRQUFRLElBQUk7QUFDOUIsV0FBTyxZQUFZLFFBQVEsUUFBUSxDQUFDO0FBQ3BDLFdBQU8sWUFBWSxRQUFRLGNBQWMsQ0FBQztBQUMxQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUNuQyxXQUFPLFlBQVksUUFBUSxLQUFLLGFBQWEsT0FBTyxFQUFFO0FBQUEsRUFDdkQsQ0FBQztBQUVELE9BQUsseUVBQXlFLE1BQU07QUFDbkYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sVUFBVSw0QkFBNEI7QUFBQSxNQUMzQyxnQkFBZ0I7QUFBQSxNQUNoQixpQkFBaUI7QUFBQSxNQUNqQixvQkFBb0I7QUFBQSxNQUNwQjtBQUFBLElBQ0QsQ0FBQztBQUNELFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxxQkFBcUIsR0FBRyxJQUFJO0FBQ3hFLFdBQU8sWUFBWSwwQkFBMEIsUUFBUSxLQUFLLFlBQVksR0FBRyxLQUFLO0FBQzlFLFlBQVEsS0FBSyxpQkFBaUI7QUFDOUIsaUJBQWEsUUFBUSxJQUFJO0FBQ3pCLFdBQU8sWUFBWSxRQUFRLFlBQVksQ0FBQztBQUN4QyxXQUFPLFlBQVksUUFBUSxRQUFRLENBQUM7QUFDcEMsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLENBQUM7QUFBQSxFQUNwQyxDQUFDO0FBRUQsT0FBSywwRUFBMEUsTUFBTTtBQUNwRixVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFVLDRCQUE0QjtBQUFBLE1BQzNDLGdCQUFnQjtBQUFBLE1BQ2hCLGlCQUFpQjtBQUFBLE1BQ2pCLG9CQUFvQjtBQUFBLE1BQ3BCO0FBQUEsSUFDRCxDQUFDO0FBQ0QsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLHFCQUFxQixHQUFHLElBQUk7QUFDeEUsV0FBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFDOUUsWUFBUSxLQUFLLGlCQUFpQjtBQUM5QixrQkFBYyxRQUFRLElBQUk7QUFDMUIsV0FBTyxZQUFZLFFBQVEsYUFBYSxDQUFDO0FBQ3pDLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUFBLEVBQ3BDLENBQUM7QUFFRCxPQUFLLGlGQUFpRixNQUFNO0FBQzNGLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLEVBQUUsTUFBTSxPQUFPLElBQUksNkJBQTZCLFFBQVE7QUFDOUQsUUFBSSxjQUFjO0FBQ2xCLElBQUMsS0FBbUUsWUFBWSxhQUFhLE1BQU07QUFDbEc7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUNBLGVBQVcsTUFBTSxRQUFRO0FBQ3pCLFdBQU8sWUFBWSxhQUFhLENBQUM7QUFDakMsV0FBTyxZQUFZLFFBQVEsQ0FBQztBQUM1QixXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFBQSxFQUN6RCxDQUFDO0FBRUQsT0FBSywyREFBMkQsTUFBTTtBQUNyRSxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxFQUFFLEtBQUssSUFBSSw2QkFBNkIsUUFBUTtBQUN0RCxVQUFNLGFBQWE7QUFDbkIsZUFBVyxpQkFBaUI7QUFDNUIsZUFBVyxnQkFBZ0I7QUFDM0Isa0JBQWMsWUFBWSxRQUFRO0FBQ2xDLFdBQU8sWUFBWSxXQUFXLGdCQUFnQixTQUFTO0FBQ3ZELFdBQU8sWUFBWSxXQUFXLGVBQWUsTUFBUztBQUN0RCxXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUFBLEVBQ3BDLENBQUM7QUFFRCxXQUFTLDhCQUE4QixVQUVyQztBQUNELFVBQU0sT0FBTztBQUFBLE1BQ1osZ0JBQWdCO0FBQUEsTUFDaEIsZ0JBQWdCO0FBQUEsTUFDaEIsZUFBZTtBQUFBLE1BQ2Ysb0JBQW9CO0FBQUEsTUFDcEIsY0FBYyxFQUFFLE9BQU8saUJBQWlCO0FBQUEsTUFDeEMsWUFBWSxFQUFFLFNBQVMsS0FBSztBQUFBLE1BQzVCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsWUFBWSxNQUFNO0FBQUEsTUFDbEIsY0FBYyxFQUFFLGdCQUFnQixNQUFNO0FBQUEsTUFBRSxFQUFFO0FBQUEsTUFDMUMsVUFBVSxTQUFTLGNBQWMsS0FBSztBQUFBLE1BQ3RDLGNBQWMsRUFBRSxrQkFBa0IsTUFBTTtBQUFBLE1BQUUsRUFBRTtBQUFBLE1BQzVDLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1Qiw0QkFBNEIsTUFBTTtBQUFBLFFBQ2xDLFVBQVUsTUFBTSxDQUFDLEVBQUUsSUFBSSxVQUFVLE1BQU0sUUFBUSxNQUFNLGdCQUFnQixDQUFDO0FBQUEsTUFDdkU7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2pFLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLE1BQU07QUFBQSxNQUN2RDtBQUFBLE1BQ0Esa0JBQWtCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDMUIsbUJBQW1CLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDM0IsbUJBQW1CLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDM0IseUJBQXlCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDakMseUJBQXlCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDakMsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBQ0EsV0FBTyxFQUFFLEtBQXVEO0FBQUEsRUFDakU7QUFFQSxPQUFLLHdGQUF3RixNQUFNO0FBQ2xHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLEVBQUUsS0FBSyxJQUFJLDhCQUE4QixRQUFRO0FBQ3ZELFVBQU0sYUFBYTtBQUNuQixXQUFPLFlBQVksS0FBSyxZQUFZLGtCQUFrQixHQUFHLElBQUk7QUFDN0QsV0FBTyxZQUFZLEtBQUssWUFBWSxxQkFBcUIsR0FBRyxLQUFLO0FBQ2pFLFdBQU8sWUFBWSwwQkFBMEIsS0FBSyxZQUFZLEdBQUcsS0FBSztBQUN0RSxXQUFPLFlBQVksNkJBQTZCLFVBQVUsR0FBRyxLQUFLO0FBQ2xFLGVBQVcsaUJBQWlCO0FBQzVCLGVBQVcsZ0JBQWdCO0FBQzNCLGtCQUFjLFlBQVksUUFBUTtBQUNsQyxXQUFPLFlBQVksV0FBVyxnQkFBZ0IsU0FBUztBQUN2RCxXQUFPLFlBQVksV0FBVyxlQUFlLE1BQVM7QUFDdEQsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLENBQUM7QUFBQSxFQUNwQyxDQUFDO0FBRUQsT0FBSywwQ0FBMEMsTUFBTTtBQUNwRCxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxFQUFFLEtBQUssSUFBSSw2QkFBNkIsUUFBUTtBQUN0RCxXQUFPLFlBQVksMEJBQTBCLEtBQUssWUFBWSxHQUFHLElBQUk7QUFDckUsV0FBTyxZQUFZLDZCQUE2QixJQUFJLEdBQUcsS0FBSztBQUFBLEVBQzdELENBQUM7QUFFRCxPQUFLLHdFQUF3RSxNQUFNO0FBQ2xGLFVBQU0sT0FBTztBQUFBLE1BQ1osYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLE1BQzdCO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBc0IsTUFBTSxXQUFvQjtBQUFBLFFBQ25GLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLE1BQU07QUFBQSxNQUN2RDtBQUFBLElBQ0Q7QUFDQSxXQUFPLFlBQVksMEJBQTBCLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFDdEUsV0FBTyxZQUFZLEtBQUssWUFBWSxxQkFBcUIsR0FBRyxJQUFJO0FBQ2hFLFdBQU8sWUFBWSw2QkFBNkIsSUFBSSxHQUFHLElBQUk7QUFBQSxFQUM1RCxDQUFDO0FBRUQsT0FBSyw0REFBNEQsTUFBTTtBQUN0RSxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxFQUFFLEtBQUssSUFBSSw2QkFBNkIsUUFBUTtBQUN0RCxVQUFNLGFBQWE7QUFDbkIsZUFBVyxpQkFBaUI7QUFDNUIsZUFBVyxxQkFBcUI7QUFDaEMsbUJBQWUsWUFBWSxJQUFJO0FBQy9CLFdBQU8sWUFBWSxXQUFXLGdCQUFnQixTQUFTO0FBQ3ZELFdBQU8sWUFBWSxXQUFXLG9CQUFvQixNQUFTO0FBQzNELFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDO0FBQUEsRUFDcEMsQ0FBQztBQUVELE9BQUssMEVBQTBFLE1BQU07QUFDcEYsVUFBTSxRQUFRLFNBQVMsY0FBYyxRQUFRO0FBQzdDLFVBQU0sWUFBWSxFQUFFLFNBQVMsS0FBSztBQUNsQyxVQUFNLGVBQWUsRUFBRSxTQUFTLEtBQUs7QUFDckMsVUFBTSxPQUFPO0FBQUEsTUFDWixvQkFBb0I7QUFBQSxNQUNwQixrQkFBa0I7QUFBQSxNQUNsQixxQkFBcUI7QUFBQSxNQUNyQixjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixLQUFLO0FBQUEsTUFDdEQ7QUFBQSxJQUNEO0FBQ0EsZ0NBQTRCLElBQUk7QUFDaEMsV0FBTyxZQUFZLE1BQU0sVUFBVSxJQUFJO0FBQ3ZDLFdBQU8sWUFBWSxNQUFNLGFBQWEsZUFBZSxHQUFHLE1BQU07QUFDOUQsV0FBTyxZQUFZLFVBQVUsU0FBUyxLQUFLO0FBQzNDLFdBQU8sWUFBWSxhQUFhLFNBQVMsS0FBSztBQUFBLEVBQy9DLENBQUM7QUFFRCxPQUFLLHVGQUF1RixNQUFNO0FBQ2pHLFVBQU0sUUFBUSxTQUFTLGNBQWMsUUFBUTtBQUM3QyxVQUFNLFlBQVksRUFBRSxTQUFTLEtBQUs7QUFDbEMsVUFBTSxlQUFlLEVBQUUsU0FBUyxLQUFLO0FBQ3JDLFVBQU0sT0FBTztBQUFBLE1BQ1osb0JBQW9CO0FBQUEsTUFDcEIsa0JBQWtCO0FBQUEsTUFDbEIscUJBQXFCO0FBQUEsTUFDckIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxNQUMxQjtBQUFBLE1BQ0EsY0FBYztBQUFBLFFBQ2Isb0JBQW9CLE9BQU8sRUFBRSxNQUFNLGFBQWEsTUFBTSxXQUFXO0FBQUEsUUFDakUsdUJBQXVCLE9BQU8sRUFBRSxnQkFBZ0IsS0FBSztBQUFBLE1BQ3REO0FBQUEsSUFDRDtBQUNBLFdBQU8sWUFBWSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsTUFBTSxrRUFBa0U7QUFDakksV0FBTyxZQUFZLDBCQUEwQixLQUFLLFlBQVksR0FBRyxJQUFJO0FBQ3JFLGdDQUE0QixJQUFJO0FBQ2hDLFdBQU8sWUFBWSxNQUFNLFVBQVUsSUFBSTtBQUN2QyxXQUFPLFlBQVksTUFBTSxhQUFhLGVBQWUsR0FBRyxNQUFNO0FBQzlELFdBQU8sWUFBWSxVQUFVLFNBQVMsS0FBSztBQUMzQyxXQUFPLFlBQVksYUFBYSxTQUFTLEtBQUs7QUFBQSxFQUMvQyxDQUFDO0FBRUQsT0FBSywyRUFBMkUsTUFBTTtBQUNyRixVQUFNLFFBQVEsU0FBUyxjQUFjLFFBQVE7QUFDN0MsVUFBTSxZQUFZLEVBQUUsU0FBUyxLQUFLO0FBQ2xDLFVBQU0sZUFBZSxFQUFFLFNBQVMsS0FBSztBQUNyQyxVQUFNLE9BQU87QUFBQSxNQUNaLG9CQUFvQjtBQUFBLE1BQ3BCLGtCQUFrQjtBQUFBLE1BQ2xCLHFCQUFxQjtBQUFBLE1BQ3JCLGFBQWE7QUFBQSxRQUNaLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsc0JBQXNCLE1BQU07QUFBQSxRQUM1QixhQUFhLE1BQU0sQ0FBQyxFQUFFLElBQUksUUFBUSxPQUFPLElBQUksQ0FBQztBQUFBLE1BQy9DO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixNQUFNO0FBQUEsTUFDdkQ7QUFBQSxJQUNEO0FBQ0EsV0FBTyxZQUFZLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxJQUFJO0FBQzdELFdBQU8sWUFBWSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsS0FBSztBQUNqRSxXQUFPLFlBQVksMEJBQTBCLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFDdEUsZ0NBQTRCLElBQUk7QUFDaEMsV0FBTyxZQUFZLE1BQU0sVUFBVSxJQUFJO0FBQ3ZDLFdBQU8sWUFBWSxNQUFNLGFBQWEsZUFBZSxHQUFHLE1BQU07QUFDOUQsV0FBTyxZQUFZLFVBQVUsU0FBUyxLQUFLO0FBQzNDLFdBQU8sWUFBWSxhQUFhLFNBQVMsS0FBSztBQUFBLEVBQy9DLENBQUM7QUFFRCxPQUFLLGlGQUFpRixNQUFNO0FBQzNGLFVBQU0sUUFBUSxTQUFTLGNBQWMsUUFBUTtBQUM3QyxVQUFNLFlBQVksRUFBRSxTQUFTLEtBQUs7QUFDbEMsVUFBTSxlQUFlLEVBQUUsU0FBUyxLQUFLO0FBQ3JDLFVBQU0sT0FBTztBQUFBLE1BQ1osb0JBQW9CO0FBQUEsTUFDcEIsa0JBQWtCO0FBQUEsTUFDbEIscUJBQXFCO0FBQUEsTUFDckIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLE1BQzdCO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixNQUFNO0FBQUEsTUFDdkQ7QUFBQSxJQUNEO0FBQ0EsV0FBTyxZQUFZLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxJQUFJO0FBQzdELFdBQU8sWUFBWSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsSUFBSTtBQUNoRSxXQUFPLFlBQVksMEJBQTBCLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFDdEUsZ0NBQTRCLElBQUk7QUFDaEMsV0FBTyxZQUFZLE1BQU0sVUFBVSxLQUFLO0FBQ3hDLFdBQU8sWUFBWSxNQUFNLGFBQWEsZUFBZSxHQUFHLE9BQU87QUFDL0QsV0FBTyxZQUFZLFVBQVUsU0FBUyxJQUFJO0FBQzFDLFdBQU8sWUFBWSxhQUFhLFNBQVMsSUFBSTtBQUFBLEVBQzlDLENBQUM7QUFFRCxXQUFTLHNCQUFzQixTQVk3QjtBQUNELFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLGNBQXdCLENBQUM7QUFDL0IsVUFBTSxjQUF3QixDQUFDO0FBQy9CLFVBQU0sY0FBd0IsQ0FBQztBQUMvQixVQUFNLGNBQXdCLENBQUM7QUFDL0IsVUFBTSxXQUFXLENBQUMsRUFBRSxJQUFJLFFBQVEsT0FBTyxJQUFJLENBQUM7QUFDNUMsVUFBTSxjQUFjLFNBQVMsY0FBYyxRQUFRO0FBQ25ELGdCQUFZLGNBQWM7QUFDMUIsVUFBTSxhQUFhLFNBQVMsY0FBYyxPQUFPO0FBQ2pELGVBQVcsU0FBUztBQUNwQixVQUFNLFlBQVksU0FBUyxjQUFjLE1BQU07QUFDL0MsY0FBVSxjQUFjO0FBQ3hCLFVBQU0sT0FBTztBQUFBLE1BQ1osb0JBQW9CO0FBQUEsTUFDcEIsbUJBQW1CO0FBQUEsTUFDbkIsa0JBQWtCO0FBQUEsTUFDbEIscUJBQXFCO0FBQUEsTUFDckIsMEJBQTBCO0FBQUEsTUFDMUIsZUFBZSxFQUFFLFNBQVMsTUFBTSxRQUFRLFFBQVEsRUFBRSxXQUFXLEtBQUssQ0FBQyxFQUFFO0FBQUEsTUFDckUsY0FBYyxFQUFFLE9BQU8saUJBQWlCO0FBQUEsTUFDeEMsbUJBQW1CLE1BQU07QUFBQSxNQUN6QixvQkFBb0IsQ0FBQyxZQUFvQixTQUFpQjtBQUN6RCxvQkFBWSxLQUFLLElBQUk7QUFBQSxNQUN0QjtBQUFBLE1BQ0EsZ0NBQWdDLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDeEMsNkJBQTZCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDckMsb0JBQW9CLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDNUIsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxNQUNBLGFBQWE7QUFBQSxRQUNYLG1CQUFtQixNQUFNLFFBQVEsbUJBQW1CO0FBQUEsUUFDckQsc0JBQXNCLE1BQU0sUUFBUTtBQUFBLFFBQ25DLDRCQUE0QixNQUFNLFFBQVEsOEJBQThCO0FBQUEsUUFDekUsb0JBQW9CLE1BQU07QUFBQSxRQUMxQixrQkFBa0IsTUFBTSxTQUFTLENBQUM7QUFBQSxRQUNsQyxhQUFhLE1BQU07QUFBQSxRQUNuQixlQUFlLE1BQU07QUFDcEIsc0JBQVksS0FBSyxDQUFDO0FBQ2xCLG1CQUFTLEtBQUssRUFBRSxJQUFJLFVBQVUsWUFBWSxNQUFNLElBQUksT0FBTyxjQUFjLENBQUM7QUFDMUUsaUJBQU8sU0FBUyxTQUFTLFNBQVMsQ0FBQyxFQUFFO0FBQUEsUUFDdEM7QUFBQSxRQUNBLGVBQWUsQ0FBQyxjQUFzQjtBQUNyQyxzQkFBWSxLQUFLLENBQUM7QUFDbEIsZ0JBQU0sUUFBUSxTQUFTLFVBQVUsYUFBVyxRQUFRLE9BQU8sU0FBUztBQUNwRSxjQUFJLFFBQVEsR0FBRztBQUNkLG1CQUFPO0FBQUEsVUFDUjtBQUNBLG1CQUFTLE9BQU8sT0FBTyxDQUFDO0FBQ3hCLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBQ0EsZUFBZSxDQUFDLFdBQW1CLFVBQWtCO0FBQ3BELHNCQUFZLEtBQUssQ0FBQztBQUNsQixnQkFBTSxVQUFVLFNBQVMsS0FBSyxXQUFTLE1BQU0sT0FBTyxTQUFTO0FBQzdELGNBQUksQ0FBQyxTQUFTO0FBQ2IsbUJBQU87QUFBQSxVQUNSO0FBQ0Esa0JBQVEsUUFBUTtBQUNoQixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixRQUFRLGVBQWU7QUFBQSxNQUN4RTtBQUFBLElBQ0Q7QUFDQSxXQUFPO0FBQUEsTUFDTjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFFQSxPQUFLLDRFQUE0RSxNQUFNO0FBQ3RGLFVBQU0sVUFBVSxzQkFBc0IsRUFBRSxnQkFBZ0IsT0FBTyxvQkFBb0IsTUFBTSxDQUFDO0FBQzFGLFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxrQkFBa0IsR0FBRyxJQUFJO0FBQ3JFLFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxxQkFBcUIsR0FBRyxLQUFLO0FBQ3pFLFdBQU8sWUFBWSxRQUFRLEtBQUssYUFBYSxzQkFBc0IsRUFBRSxnQkFBZ0IsS0FBSztBQUMxRixXQUFPLFlBQVksMEJBQTBCLFFBQVEsS0FBSyxZQUFZLEdBQUcsS0FBSztBQUU5RSwwQkFBc0IsUUFBUSxJQUFJO0FBQ2xDLFdBQU8sWUFBWSxRQUFRLEtBQUsscUJBQXFCLEtBQUs7QUFDMUQsV0FBTyxZQUFZLFFBQVEsS0FBSyxtQkFBbUIsUUFBUSxLQUFLO0FBQ2hFLFdBQU8sWUFBWSxRQUFRLEtBQUssa0JBQWtCLFFBQVEsSUFBSTtBQUM5RCxXQUFPLGdCQUFnQixRQUFRLFVBQVUsQ0FBQyxDQUFDO0FBQzNDLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUM7QUFFOUMscUJBQWlCLFFBQVEsSUFBSTtBQUM3Qix3QkFBb0IsUUFBUSxJQUFJO0FBQ2hDLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQztBQUM5QyxXQUFPLGdCQUFnQixRQUFRLGFBQWEsQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLFFBQVEsS0FBSyxZQUFZLFlBQVksRUFBRSxJQUFJLGFBQVcsUUFBUSxLQUFLLEdBQUcsQ0FBQyxHQUFHLENBQUM7QUFDbEcsV0FBTyxnQkFBZ0IsUUFBUSxVQUFVLENBQUMscUJBQXFCLG1CQUFtQixDQUFDO0FBRW5GLFlBQVEsS0FBSyxzQkFBc0I7QUFDbkMsWUFBUSxLQUFLLG1CQUFtQixTQUFTO0FBQ3pDLFlBQVEsS0FBSyxrQkFBa0IsU0FBUztBQUN4QyxZQUFRLEtBQUssa0JBQWtCLFFBQVE7QUFDdkMsMkJBQXVCLFFBQVEsSUFBSTtBQUNuQyxXQUFPLFlBQVksUUFBUSxLQUFLLHFCQUFxQixLQUFLO0FBQzFELFdBQU8sWUFBWSxRQUFRLEtBQUssbUJBQW1CLFFBQVEsS0FBSztBQUNoRSxXQUFPLFlBQVksUUFBUSxLQUFLLGtCQUFrQixRQUFRLElBQUk7QUFDOUQsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQztBQUM5QyxXQUFPLGdCQUFnQixRQUFRLGFBQWEsQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsUUFBUSxLQUFLLFlBQVksWUFBWSxFQUFFLElBQUksYUFBVyxRQUFRLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQztBQUNsRyxXQUFPLGdCQUFnQixRQUFRLFVBQVUsQ0FBQyxxQkFBcUIscUJBQXFCLG1CQUFtQixDQUFDO0FBQUEsRUFDekcsQ0FBQztBQUVELE9BQUssMEVBQTBFLE1BQU07QUFDcEYsVUFBTSxVQUFVLHNCQUFzQixFQUFFLGdCQUFnQixNQUFNLG9CQUFvQixLQUFLLENBQUM7QUFDeEYsV0FBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLElBQUk7QUFFN0UsMEJBQXNCLFFBQVEsSUFBSTtBQUNsQyxXQUFPLFlBQVksUUFBUSxLQUFLLHFCQUFxQixLQUFLO0FBQzFELFdBQU8sZ0JBQWdCLFFBQVEsVUFBVSxDQUFDLENBQUM7QUFFM0MscUJBQWlCLFFBQVEsSUFBSTtBQUM3Qix3QkFBb0IsUUFBUSxJQUFJO0FBQ2hDLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQztBQUM5QyxXQUFPLGdCQUFnQixRQUFRLGFBQWEsQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsUUFBUSxLQUFLLFlBQVksWUFBWSxFQUFFLElBQUksYUFBVyxRQUFRLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQztBQUNsRyxXQUFPLGdCQUFnQixRQUFRLFVBQVUsQ0FBQyx1QkFBdUIscUJBQXFCLENBQUM7QUFBQSxFQUN4RixDQUFDO0FBRUEsT0FBSyx1RkFBdUYsTUFBTTtBQUNqRyxVQUFNLFVBQVUsc0JBQXNCLEVBQUUsZ0JBQWdCLE9BQU8sb0JBQW9CLE1BQU0saUJBQWlCLE1BQU0sQ0FBQztBQUNqSCxXQUFPLFlBQVksMEJBQTBCLFFBQVEsS0FBSyxZQUFZLEdBQUcsS0FBSztBQUU5RSxxQkFBaUIsUUFBUSxJQUFJO0FBQzdCLHdCQUFvQixRQUFRLElBQUk7QUFDaEMsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQztBQUM5QyxXQUFPLGdCQUFnQixRQUFRLGFBQWEsQ0FBQyxDQUFDO0FBQzlDLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUM7QUFDOUMsV0FBTyxnQkFBZ0IsUUFBUSxVQUFVLENBQUMsdUJBQXVCLHFCQUFxQixDQUFDO0FBQUEsRUFDeEYsQ0FBQztBQUVGLE9BQUssK0VBQStFLFlBQVk7QUFDL0YsVUFBTSxVQUFVLHNCQUFzQixFQUFFLGdCQUFnQixPQUFPLG9CQUFvQixLQUFLLENBQUM7QUFDekYsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLGtCQUFrQixHQUFHLElBQUk7QUFDckUsV0FBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLHFCQUFxQixHQUFHLElBQUk7QUFDeEUsV0FBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFFOUUsMEJBQXNCLFFBQVEsSUFBSTtBQUNsQyxXQUFPLFlBQVksUUFBUSxLQUFLLHFCQUFxQixJQUFJO0FBQ3pELFlBQVEsS0FBSyxrQkFBa0IsUUFBUTtBQUN2QywyQkFBdUIsUUFBUSxJQUFJO0FBQ25DLFdBQU8sWUFBWSxRQUFRLEtBQUsscUJBQXFCLEtBQUs7QUFDMUQsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sWUFBWSxRQUFRLEtBQUssWUFBWSxZQUFZLEVBQUUsQ0FBQyxFQUFFLE9BQU8sY0FBYztBQUVsRixxQkFBaUIsUUFBUSxJQUFJO0FBQzdCLFdBQU8sZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLENBQUMsQ0FBQztBQUMvQyxXQUFPLGdCQUFnQixRQUFRLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQztBQUM5RCxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksWUFBWSxFQUFFLFFBQVEsQ0FBQztBQUVuRSxVQUFNLG9CQUFvQixRQUFRLElBQUk7QUFDdEMsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLFFBQVEsVUFBVSxDQUFDLENBQUM7QUFBQSxFQUM1QyxDQUFDO0FBRUQsT0FBSyw0RUFBNEUsTUFBTTtBQUN0RixVQUFNLFlBQVksc0JBQXNCLEVBQUUsZ0JBQWdCLE9BQU8sb0JBQW9CLEtBQUssQ0FBQztBQUMzRiwwQkFBc0IsVUFBVSxJQUFJO0FBQ3BDLGNBQVUsS0FBSyxrQkFBa0IsUUFBUTtBQUN6QywyQkFBdUIsVUFBVSxJQUFJO0FBQ3JDLFdBQU8sWUFBWSxVQUFVLEtBQUsscUJBQXFCLEtBQUs7QUFDNUQsV0FBTyxZQUFZLFVBQVUsS0FBSyxtQkFBbUIsUUFBUSxLQUFLO0FBQ2xFLFdBQU8sWUFBWSxVQUFVLEtBQUssa0JBQWtCLFFBQVEsSUFBSTtBQUNoRSxXQUFPLFlBQVksVUFBVSxLQUFLLG1CQUFtQixhQUFhLEdBQUc7QUFDckUsV0FBTyxnQkFBZ0IsVUFBVSxhQUFhLENBQUMsQ0FBQztBQUNoRCxXQUFPLGdCQUFnQixVQUFVLFVBQVUsQ0FBQyxDQUFDO0FBQzdDLFdBQU8sWUFBWSxVQUFVLEtBQUssWUFBWSxZQUFZLEVBQUUsQ0FBQyxFQUFFLE9BQU8sR0FBRztBQUV6RSxVQUFNLFFBQVEsc0JBQXNCLEVBQUUsZ0JBQWdCLE9BQU8sb0JBQW9CLEtBQUssQ0FBQztBQUN2RiwwQkFBc0IsTUFBTSxJQUFJO0FBQ2hDLFVBQU0sS0FBSyxrQkFBa0IsUUFBUTtBQUNyQywyQkFBdUIsTUFBTSxJQUFJO0FBQ2pDLFdBQU8sWUFBWSxNQUFNLEtBQUsscUJBQXFCLEtBQUs7QUFDeEQsV0FBTyxZQUFZLE1BQU0sS0FBSyxtQkFBbUIsYUFBYSxHQUFHO0FBQ2pFLFdBQU8sZ0JBQWdCLE1BQU0sYUFBYSxDQUFDLENBQUM7QUFDNUMsV0FBTyxnQkFBZ0IsTUFBTSxVQUFVLENBQUMscUJBQXFCLENBQUM7QUFDOUQsV0FBTyxZQUFZLE1BQU0sS0FBSyxZQUFZLFlBQVksRUFBRSxDQUFDLEVBQUUsT0FBTyxHQUFHO0FBQUEsRUFDdEUsQ0FBQztBQUVELE9BQUssNERBQTRELE1BQU07QUFDdEUsVUFBTSxVQUFVLHNCQUFzQixFQUFFLGdCQUFnQixNQUFNLG9CQUFvQixLQUFLLENBQUM7QUFDeEYsWUFBUSxLQUFLLHNCQUFzQjtBQUNuQyxZQUFRLEtBQUssbUJBQW1CLFNBQVM7QUFDekMsWUFBUSxLQUFLLGtCQUFrQixTQUFTO0FBQ3hDLFlBQVEsS0FBSyxrQkFBa0IsUUFBUTtBQUN2QywyQkFBdUIsUUFBUSxJQUFJO0FBQ25DLFdBQU8sWUFBWSxRQUFRLEtBQUsscUJBQXFCLEtBQUs7QUFDMUQsV0FBTyxZQUFZLFFBQVEsS0FBSyxtQkFBbUIsUUFBUSxLQUFLO0FBQ2hFLFdBQU8sWUFBWSxRQUFRLEtBQUssa0JBQWtCLFFBQVEsSUFBSTtBQUM5RCxXQUFPLFlBQVksUUFBUSxLQUFLLG1CQUFtQixhQUFhLEdBQUc7QUFDbkUsV0FBTyxnQkFBZ0IsUUFBUSxhQUFhLENBQUMsQ0FBQztBQUM5QyxXQUFPLGdCQUFnQixRQUFRLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQztBQUNoRSxXQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksWUFBWSxFQUFFLENBQUMsRUFBRSxPQUFPLEdBQUc7QUFBQSxFQUN4RSxDQUFDO0FBRUQsV0FBUyxvQ0FBb0MsU0FrQjNDO0FBQ0QsVUFBTSxRQUFRLElBQUksZ0JBQWdCO0FBQ2xDLFVBQU0sbUJBQXNELENBQUM7QUFDN0QsVUFBTSxrQkFBeUQsQ0FBQztBQUNoRSxVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxXQUFXLFNBQVMsY0FBYyxLQUFLO0FBQzdDLGFBQVMsS0FBSyxZQUFZLFFBQVE7QUFDbEMsVUFBTSxJQUFJLEVBQUUsU0FBUyxNQUFNLFNBQVMsT0FBTyxFQUFFLENBQUM7QUFDOUMsVUFBTSxzQkFBc0IsU0FBUyxjQUFjLEtBQUs7QUFDeEQsd0JBQW9CLFlBQVk7QUFDaEMsVUFBTSxtQkFBbUIsU0FBUyxjQUFjLFFBQVE7QUFDeEQscUJBQWlCLElBQUksSUFBSSxPQUFPLE9BQU8sR0FBRyxDQUFDO0FBQzNDLHFCQUFpQixJQUFJLElBQUksT0FBTyxTQUFTLEdBQUcsQ0FBQztBQUM3QyxxQkFBaUIsSUFBSSxJQUFJLE9BQU8sVUFBVSxHQUFHLENBQUM7QUFDOUMsd0JBQW9CLFlBQVksZ0JBQWdCO0FBQ2hELGFBQVMsWUFBWSxtQkFBbUI7QUFDeEMsVUFBTSxpQkFBaUIsU0FBUyxjQUFjLEtBQUs7QUFDbkQsbUJBQWUsWUFBWTtBQUMzQixVQUFNLGNBQWMsU0FBUyxjQUFjLFFBQVE7QUFDbkQsZUFBVyxNQUFNLFNBQVMsbUJBQW1CLENBQUMsSUFBSSxVQUFVLEdBQUc7QUFDOUQsa0JBQVksSUFBSSxJQUFJLE9BQU8sTUFBTSxZQUFZLEVBQUUsQ0FBQztBQUFBLElBQ2pEO0FBQ0EsbUJBQWUsWUFBWSxXQUFXO0FBQ3RDLGFBQVMsWUFBWSxjQUFjO0FBQ25DLFVBQU0sYUFBYSxTQUFTLGNBQWMsUUFBUTtBQUNsRCxRQUFJLGlCQUFpQixTQUFTLGtCQUFrQjtBQUNoRCxVQUFNLHFCQUFxQixTQUFTO0FBQ3BDLFVBQU0sMkJBQTJCLG9CQUFJLElBQTZEO0FBQUEsTUFDakcsQ0FBQyxpQkFBaUIsRUFBRSxZQUFZLEdBQUcsaUJBQWlCLFNBQVMsbUJBQW1CLEVBQUUsQ0FBQztBQUFBLElBQ3BGLENBQUM7QUFDRCxxQkFBaUIsZ0JBQWdCLFNBQVMsbUJBQW1CO0FBQzdELGdCQUFZLGdCQUFnQixTQUFTLHNCQUFzQjtBQUMzRCxVQUFNLGlCQUFpQixTQUFTLGNBQWMsS0FBSztBQUNuRCxVQUFNLGNBQWMsU0FBUyxjQUFjLFFBQVE7QUFDbkQsZ0JBQVksSUFBSSxJQUFJLE9BQU8sWUFBWSxFQUFFLENBQUM7QUFDMUMsZ0JBQVksSUFBSSxJQUFJLE9BQU8sU0FBUyxPQUFPLENBQUM7QUFDNUMsbUJBQWUsWUFBWSxXQUFXO0FBQ3RDLFVBQU0sVUFBVSxTQUFTLGNBQWMsS0FBSztBQUM1QyxVQUFNLFlBQVksU0FBUyxjQUFjLE1BQU07QUFDL0MsWUFBUSxZQUFZLFNBQVM7QUFDN0IsVUFBTSxPQUFPO0FBQUEsTUFDWixrQkFBa0IsU0FBUyxvQkFBb0IsQ0FBQyxNQUFNO0FBQUEsTUFDdEQsaUJBQWlCLFNBQVMsbUJBQW1CLENBQUMsSUFBSSxVQUFVO0FBQUEsTUFDNUQsb0JBQW9CLFNBQVMsc0JBQXNCO0FBQUEsTUFDbkQ7QUFBQSxNQUNBLGtCQUFrQixTQUFTLG9CQUFvQjtBQUFBLE1BQy9DLG9CQUFvQjtBQUFBLE1BQ3BCLGlCQUFpQjtBQUFBLE1BQ2pCLGlCQUFpQjtBQUFBLE1BQ2pCO0FBQUEsTUFDQSxjQUFjLEVBQUUsT0FBTyxpQkFBaUI7QUFBQSxNQUN4QyxZQUFZLEVBQUUsU0FBUyxLQUFLO0FBQUEsTUFDNUI7QUFBQSxNQUNBO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxNQUNoQixxQkFBcUI7QUFBQSxRQUNwQixXQUFXLFNBQWtCO0FBQUUsMkJBQWlCLFdBQVcsQ0FBQztBQUFBLFFBQVM7QUFBQSxRQUNyRSxlQUFlO0FBQUEsUUFBRTtBQUFBLFFBQ2pCLE9BQU8sT0FBZTtBQUFFLDJCQUFpQixnQkFBZ0I7QUFBQSxRQUFPO0FBQUEsTUFDakU7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLFFBQ2YsV0FBVyxTQUFrQjtBQUM1QixzQkFBWSxXQUFXLENBQUM7QUFDeEIsc0JBQVksYUFBYSxpQkFBaUIsT0FBTyxDQUFDLE9BQU8sQ0FBQztBQUFBLFFBQzNEO0FBQUEsUUFDQSxlQUFlO0FBQUEsUUFBRTtBQUFBLFFBQ2pCLE9BQU8sT0FBZTtBQUFFLHNCQUFZLGdCQUFnQjtBQUFBLFFBQU87QUFBQSxNQUM1RDtBQUFBLE1BQ0EsZ0JBQWdCO0FBQUEsUUFDZixXQUFXLFNBQWtCO0FBQUUsc0JBQVksV0FBVyxDQUFDO0FBQUEsUUFBUztBQUFBLFFBQ2hFLGVBQWU7QUFBQSxRQUFFO0FBQUEsUUFDakIsT0FBTyxPQUFlO0FBQ3JCLHNCQUFZLGdCQUFnQjtBQUM1QixlQUFLLHFCQUFxQjtBQUFBLFFBQzNCO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxNQUNBLFlBQVksRUFBRSxTQUFTLFdBQVc7QUFBQSxNQUNsQyxZQUFZLEVBQUUsU0FBUyxTQUFTLGNBQWMsUUFBUSxFQUFFO0FBQUEsTUFDeEQsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixHQUFJLHVCQUF1QixTQUFZLENBQUMsSUFBSSxFQUFFLHNCQUFzQixNQUFNLG1CQUFtQjtBQUFBLE1BQzlGO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGVBQWU7QUFBQSxRQUMvQyxtQkFBbUIsT0FBTyxZQUFpRDtBQUMxRSwwQkFBZ0IsS0FBSyxPQUFPO0FBQzVCLGlCQUFPLEVBQUUsSUFBSSxLQUFLO0FBQUEsUUFDbkI7QUFBQSxRQUNBLGFBQWEsYUFBYSxFQUFFLElBQUksS0FBSztBQUFBLFFBQ3JDLGFBQWEsT0FBTyxZQUFvRDtBQUN2RSxxQkFBVyxLQUFLLEVBQUUsV0FBVyxRQUFRLFdBQVcsU0FBUyxRQUFRLFFBQVEsQ0FBQztBQUMxRSxpQkFBTyxFQUFFLGlCQUFpQixRQUFRLFNBQVMsVUFBVSxJQUFJLE9BQU8sR0FBRyxNQUFNLElBQUksT0FBTyxHQUFHO0FBQUEsUUFDeEY7QUFBQSxNQUNEO0FBQUEsTUFDQSxvQkFBb0I7QUFBQSxRQUNuQixnQkFBZ0IsVUFBdUU7QUFDdEYsZ0JBQU0sWUFBWSxTQUFTLGNBQWMsS0FBSztBQUM5QyxtQkFBUyxLQUFLLFlBQVksU0FBUztBQUNuQyxnQkFBTSxXQUFXLFNBQVMsT0FBTyxTQUFTO0FBQzFDLGdCQUFNLElBQUksRUFBRSxTQUFTLE1BQU0sVUFBVSxPQUFPLEVBQUUsQ0FBQztBQUMvQyxpQkFBTztBQUFBLFlBQ04sUUFBUTtBQUNQLHVCQUFTLFFBQVE7QUFDakIsd0JBQVUsT0FBTztBQUFBLFlBQ2xCO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxRQUNmLGVBQWUsT0FBZSxNQUFpQjtBQUM5QywyQkFBaUIsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDO0FBQ2xDLGlCQUFPLFFBQVEsUUFBUSxNQUFTO0FBQUEsUUFDakM7QUFBQSxNQUNEO0FBQUEsTUFDQSxtQkFBbUIsTUFBTTtBQUFBLElBQzFCO0FBQ0EsVUFBTSxZQUFZO0FBQ2xCLFdBQU8sWUFBWSxVQUFVLFlBQVksa0JBQWtCLEdBQUcsTUFBTSxrRUFBa0U7QUFDdEksV0FBTyxZQUFZLDBCQUEwQixVQUFVLFlBQVksR0FBRyxjQUFjO0FBQ3BGLFFBQUksdUJBQXVCLFFBQVc7QUFDckMsYUFBTyxZQUFZLFVBQVUsWUFBWSxxQkFBcUIsR0FBRyxrQkFBa0I7QUFBQSxJQUNwRjtBQUNBLFdBQU87QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLGtCQUFrQixTQUFrQjtBQUNuQyx5QkFBaUI7QUFBQSxNQUNsQjtBQUFBLE1BQ0EsU0FBUyxNQUFNO0FBQ2QsYUFBSyxpQkFBaUIsTUFBTTtBQUM1QixhQUFLLGlCQUFpQixNQUFNO0FBQzVCLGNBQU0sUUFBUTtBQUFBLE1BQ2Y7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLE9BQUssbUZBQW1GLFlBQVk7QUFDbkcsVUFBTSxVQUFVLG9DQUFvQztBQUNwRCxRQUFJO0FBQ0gsYUFBTyxZQUFZLGlDQUFpQyxRQUFRLElBQUksR0FBRyxLQUFLO0FBQ3hFLGFBQU8sWUFBWSw4QkFBOEIsUUFBUSxJQUFJLEdBQUcsS0FBSztBQUNyRSwwQ0FBb0MsUUFBUSxJQUFJO0FBQ2hELGFBQU8sWUFBWSxRQUFRLGlCQUFpQixVQUFVLElBQUk7QUFDMUQsYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGFBQWEsZUFBZSxHQUFHLE1BQU07QUFDakYsYUFBTyxZQUFZLFFBQVEsWUFBWSxVQUFVLElBQUk7QUFDckQsYUFBTyxZQUFZLFFBQVEsWUFBWSxhQUFhLGVBQWUsR0FBRyxNQUFNO0FBRTVFLFlBQU0sNEJBQTRCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUNsRSxZQUFNLHVCQUF1QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDN0QsYUFBTyxnQkFBZ0IsUUFBUSxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2xELGFBQU8sZ0JBQWdCLFFBQVEsWUFBWSxDQUFDLENBQUM7QUFDN0MsYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxhQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUNqRyxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBRXJELGNBQVEsaUJBQWlCLFdBQVc7QUFDcEMsY0FBUSxpQkFBaUIsZ0JBQWdCLFVBQVU7QUFDbkQsY0FBUSxpQkFBaUIsYUFBYSxpQkFBaUIsT0FBTztBQUM5RCxjQUFRLFlBQVksV0FBVztBQUMvQixjQUFRLFlBQVksZ0JBQWdCLFVBQVU7QUFDOUMsY0FBUSxZQUFZLGFBQWEsaUJBQWlCLE9BQU87QUFDekQsY0FBUSxpQkFBaUIsZ0JBQWdCO0FBQ3pDLGNBQVEsWUFBWSxnQkFBZ0I7QUFDcEMsWUFBTSw0QkFBNEIsUUFBUSxNQUFNLGlCQUFpQixDQUFDO0FBQ2xFLFlBQU0sdUJBQXVCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUM3RCxhQUFPLGdCQUFnQixRQUFRLGlCQUFpQixDQUFDLENBQUM7QUFDbEQsYUFBTyxnQkFBZ0IsUUFBUSxZQUFZLENBQUMsQ0FBQztBQUM3QyxhQUFPLFlBQVksUUFBUSxpQkFBaUIsZUFBZSxDQUFDO0FBQzVELGFBQU8sWUFBWSxRQUFRLFlBQVksZUFBZSxDQUFDO0FBQ3ZELGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksZUFBZSxHQUFHLGlCQUFpQixDQUFDO0FBQ2pHLGFBQU8sWUFBWSxRQUFRLEtBQUssb0JBQW9CLENBQUM7QUFBQSxJQUN0RCxVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDhGQUE4RixZQUFZO0FBQzlHLFVBQU0sVUFBVSxvQ0FBb0M7QUFDcEQsUUFBSTtBQUNILDRCQUFzQixRQUFRLElBQUk7QUFDbEMsWUFBTSxZQUFZLFNBQVMsY0FBYyxvQ0FBb0M7QUFDN0UsYUFBTyxHQUFHLFNBQVM7QUFDbkIsYUFBTyxZQUFZLFVBQVUsYUFBYSxNQUFNLEdBQUcsTUFBTTtBQUN6RCxhQUFPLFlBQVksVUFBVSxhQUFhLFVBQVU7QUFDcEQsWUFBTSxTQUFTLENBQUMsR0FBRyxTQUFTLGlCQUFpQixnRUFBZ0UsQ0FBQztBQUM5RyxhQUFPLFlBQVksT0FBTyxRQUFRLENBQUM7QUFDbkMsaUJBQVcsU0FBUyxRQUFRO0FBQzNCLGVBQU8sWUFBWSxNQUFNLFVBQVUsSUFBSTtBQUN2QyxlQUFPLFlBQVksTUFBTSxhQUFhLGVBQWUsR0FBRyxNQUFNO0FBQUEsTUFDL0Q7QUFDQSxZQUFNLFNBQVMsT0FBTyxDQUFDO0FBQ3ZCLGFBQU8sV0FBVztBQUNsQixhQUFPLGdCQUFnQixVQUFVO0FBQ2pDLGFBQU8sYUFBYSxpQkFBaUIsT0FBTztBQUM1QyxhQUFPLE1BQU07QUFDYixZQUFNLFFBQVEsUUFBUTtBQUN0QixhQUFPLGdCQUFnQixRQUFRLGlCQUFpQixDQUFDLENBQUM7QUFDbEQsYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUFBLElBQ2xHLFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssK0JBQStCLE1BQU07QUFDekMsVUFBTSxVQUFVLG9DQUFvQztBQUNwRCxRQUFJO0FBQ0gsNEJBQXNCLFFBQVEsSUFBSTtBQUNsQyxhQUFPLEdBQUcsU0FBUyxjQUFjLG9DQUFvQyxDQUFDO0FBRXRFLGVBQVMsY0FBYyxJQUFJLGNBQWMsV0FBVyxFQUFFLFNBQVMsSUFBSSxTQUFTLE1BQU0sWUFBWSxLQUFLLENBQUMsQ0FBQztBQUNyRyxhQUFPLFlBQVksU0FBUyxjQUFjLG9DQUFvQyxHQUFHLElBQUk7QUFBQSxJQUN0RixVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLCtCQUErQixNQUFNO0FBQ3pDLFVBQU0sVUFBVSxvQ0FBb0M7QUFDcEQsUUFBSTtBQUNILDRCQUFzQixRQUFRLElBQUk7QUFDbEMsYUFBTyxHQUFHLFNBQVMsY0FBYyxvQ0FBb0MsQ0FBQztBQUN0RSxlQUFTLGNBQWMsSUFBSSxjQUFjLFdBQVcsRUFBRSxTQUFTLElBQUksU0FBUyxNQUFNLFlBQVksS0FBSyxDQUFDLENBQUM7QUFDckcsYUFBTyxZQUFZLFNBQVMsY0FBYyxvQ0FBb0MsR0FBRyxJQUFJO0FBQUEsSUFDdEYsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw4SkFBOEosWUFBWTtBQUM5SyxVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxVQUFVLG9DQUFvQztBQUFBLE1BQ25ELGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxRQUFJO0FBQ0gsWUFBTSxlQUFlLFFBQVEsS0FBSztBQUdsQyxtQkFBYSxvQkFBb0IsWUFBWTtBQUM1QyxjQUFNLElBQUksTUFBTSx3QkFBd0I7QUFBQSxNQUN6QztBQUNBLGFBQU8sZUFBZSxRQUFRLEtBQUssV0FBVyxlQUFlO0FBQUEsUUFDNUQsY0FBYztBQUFBLFFBQ2QsTUFBTTtBQUNMLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBQ0EsTUFBTTtBQUNMLGdCQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0QsQ0FBQztBQUNELDRCQUFzQixRQUFRLElBQUk7QUFDbEMsWUFBTSxTQUFTLENBQUMsR0FBRyxTQUFTLGlCQUFpQixnRUFBZ0UsQ0FBQztBQUM5RyxhQUFPLFlBQVksT0FBTyxRQUFRLENBQUM7QUFDbkMsYUFBTyxZQUFZLE9BQU8sQ0FBQyxFQUFHLFVBQVUsS0FBSztBQUM3QyxZQUFNLGlDQUFpQyxXQUFXLE1BQU07QUFDdkQsZUFBTyxDQUFDLEVBQUcsTUFBTTtBQUFBLE1BQ2xCLENBQUM7QUFBQSxJQUNGLFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsscUZBQXFGLFlBQVk7QUFDckcsVUFBTSxTQUFTLE1BQU0sa0JBQWtCLEdBQUcsUUFBUSxJQUFJLENBQUMsa0ZBQWtGO0FBQ3pJLFVBQU0sY0FBYztBQUNwQixVQUFNLG9CQUFvQixPQUFPLE1BQU0sK0JBQStCLEtBQUssQ0FBQztBQUM1RSxXQUFPLGdCQUFnQixtQkFBbUI7QUFBQSxNQUN6QywyREFBMkQsV0FBVztBQUFBLElBQ3ZFLENBQUM7QUFDRCxXQUFPLEdBQUcsQ0FBQyxPQUFPLFNBQVMsMkRBQTJELENBQUM7QUFBQSxFQUN4RixDQUFDO0FBRUQsT0FBSyx1R0FBdUcsWUFBWTtBQUN2SCxVQUFNLFFBQVEsSUFBSSxnQkFBZ0I7QUFDbEMsVUFBTSxrQkFBeUQsQ0FBQztBQUNoRSxVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxXQUFXLFNBQVMsY0FBYyxLQUFLO0FBQzdDLGFBQVMsS0FBSyxZQUFZLFFBQVE7QUFDbEMsVUFBTSxJQUFJLEVBQUUsU0FBUyxNQUFNLFNBQVMsT0FBTyxFQUFFLENBQUM7QUFDOUMsVUFBTSxtQkFBbUIsU0FBUyxjQUFjLFFBQVE7QUFDeEQscUJBQWlCLElBQUksSUFBSSxPQUFPLE9BQU8sR0FBRyxDQUFDO0FBQzNDLHFCQUFpQixJQUFJLElBQUksT0FBTyxTQUFTLEdBQUcsQ0FBQztBQUM3QyxxQkFBaUIsSUFBSSxJQUFJLE9BQU8sVUFBVSxHQUFHLENBQUM7QUFDOUMsVUFBTSxzQkFBc0IsU0FBUyxjQUFjLEtBQUs7QUFDeEQsd0JBQW9CLFlBQVk7QUFDaEMsd0JBQW9CLFlBQVksZ0JBQWdCO0FBQ2hELGFBQVMsWUFBWSxtQkFBbUI7QUFDeEMsVUFBTSxjQUFjLFNBQVMsY0FBYyxRQUFRO0FBQ25ELGdCQUFZLElBQUksSUFBSSxPQUFPLFlBQVksRUFBRSxDQUFDO0FBQzFDLGdCQUFZLElBQUksSUFBSSxPQUFPLFlBQVksVUFBVSxDQUFDO0FBQ2xELFVBQU0saUJBQWlCLFNBQVMsY0FBYyxLQUFLO0FBQ25ELG1CQUFlLFlBQVk7QUFDM0IsbUJBQWUsWUFBWSxXQUFXO0FBQ3RDLGFBQVMsWUFBWSxjQUFjO0FBQ25DLFVBQU0sVUFBVSxTQUFTLGNBQWMsS0FBSztBQUM1QyxZQUFRLFNBQVM7QUFDakIsVUFBTSxZQUFZLFNBQVMsY0FBYyxNQUFNO0FBQy9DLFlBQVEsWUFBWSxTQUFTO0FBQzdCLGFBQVMsWUFBWSxPQUFPO0FBQzVCLFVBQU0sMkJBQTJCLG9CQUFJLElBQTZEO0FBQUEsTUFDakcsQ0FBQyxpQkFBaUIsRUFBRSxZQUFZLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztBQUFBLElBQ3hELENBQUM7QUFDRCxRQUFJLGlCQUFpQjtBQUNyQixRQUFJO0FBQ0osUUFBSTtBQUNKLFVBQU0sb0JBQW9CLElBQUksUUFBYyxhQUFXO0FBQUUsMEJBQW9CO0FBQUEsSUFBUyxDQUFDO0FBQ3ZGLFVBQU0saUJBQWlCLElBQUksUUFBc0IsYUFBVztBQUFFLDBCQUFvQjtBQUFBLElBQVMsQ0FBQztBQUM1RixRQUFJO0FBQ0osUUFBSTtBQUNKLFVBQU0sZUFBZSxJQUFJLFFBQWMsYUFBVztBQUFFLHFCQUFlO0FBQUEsSUFBUyxDQUFDO0FBQzdFLFVBQU0sWUFBWSxJQUFJLFFBQW1HLGFBQVc7QUFDbkkscUJBQWU7QUFBQSxJQUNoQixDQUFDO0FBQ0QsVUFBTSxPQUFPO0FBQUEsTUFDWixrQkFBa0IsQ0FBQyxNQUFNO0FBQUEsTUFDekIsaUJBQWlCLENBQUMsSUFBSSxVQUFVO0FBQUEsTUFDaEMsb0JBQW9CO0FBQUEsTUFDcEI7QUFBQSxNQUNBLGtCQUFrQjtBQUFBLE1BQ2xCLGlCQUFpQjtBQUFBLE1BQ2pCLGlCQUFpQjtBQUFBLE1BQ2pCO0FBQUEsTUFDQSxZQUFZLEVBQUUsU0FBUyxLQUFLO0FBQUEsTUFDNUI7QUFBQSxNQUNBO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxNQUNoQixjQUFjLEVBQUUsT0FBTyxHQUFHO0FBQUEsTUFDMUIscUJBQXFCO0FBQUEsUUFDcEIsV0FBVyxTQUFrQjtBQUFFLDJCQUFpQixXQUFXLENBQUM7QUFBQSxRQUFTO0FBQUEsUUFDckUsZUFBZTtBQUFBLFFBQUU7QUFBQSxRQUNqQixPQUFPLE9BQWU7QUFBRSwyQkFBaUIsZ0JBQWdCO0FBQUEsUUFBTztBQUFBLE1BQ2pFO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxRQUNmLGFBQWE7QUFBQSxRQUFFO0FBQUEsUUFDZixlQUFlO0FBQUEsUUFBRTtBQUFBLFFBQ2pCLFNBQVM7QUFBQSxRQUFFO0FBQUEsTUFDWjtBQUFBLE1BQ0EsZ0JBQWdCO0FBQUEsUUFDZixXQUFXLFNBQWtCO0FBQUUsc0JBQVksV0FBVyxDQUFDO0FBQUEsUUFBUztBQUFBLFFBQ2hFLGVBQWU7QUFBQSxRQUFFO0FBQUEsUUFDakIsT0FBTyxPQUFlO0FBQ3JCLHNCQUFZLGdCQUFnQjtBQUM1QixlQUFLLHFCQUFxQjtBQUFBLFFBQzNCO0FBQUEsTUFDRDtBQUFBLE1BQ0EsZ0JBQWdCLFNBQVMsY0FBYyxLQUFLO0FBQUEsTUFDNUMsWUFBWSxFQUFFLFNBQVMsU0FBUyxjQUFjLFFBQVEsRUFBRTtBQUFBLE1BQ3hELFlBQVksRUFBRSxTQUFTLFNBQVMsY0FBYyxRQUFRLEVBQUU7QUFBQSxNQUN4RCxhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTTtBQUFBLE1BQzFCO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGVBQWU7QUFBQSxRQUMvQyxtQkFBbUIsT0FBTyxZQUFpRDtBQUMxRSwwQkFBZ0IsS0FBSyxPQUFPO0FBQzVCLDhCQUFvQjtBQUNwQixpQkFBTztBQUFBLFFBQ1I7QUFBQSxRQUNBLGFBQWEsT0FBTyxZQUFvRDtBQUN2RSxxQkFBVyxLQUFLLEVBQUUsV0FBVyxRQUFRLFdBQVcsU0FBUyxRQUFRLFFBQVEsQ0FBQztBQUMxRSx5QkFBZTtBQUNmLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxNQUNBLG1CQUFtQixNQUFNO0FBQUEsSUFDMUI7QUFDQSxVQUFNLFlBQVk7QUFDbEIsUUFBSTtBQUNILGFBQU8sWUFBWSxVQUFVLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUNsRSxhQUFPLFlBQVksMEJBQTBCLFVBQVUsWUFBWSxHQUFHLEtBQUs7QUFDM0UsYUFBTyxZQUFZLGlDQUFpQyxTQUFTLEdBQUcsSUFBSTtBQUNwRSxhQUFPLFlBQVksOEJBQThCLFNBQVMsR0FBRyxJQUFJO0FBRWpFLFlBQU0sa0JBQWtCLDRCQUE0QixXQUFXLGlCQUFpQixDQUFDO0FBQ2pGLFlBQU0sYUFBYSx1QkFBdUIsV0FBVyxpQkFBaUIsQ0FBQztBQUN2RSxZQUFNO0FBQ04sWUFBTTtBQUNOLGFBQU8sWUFBWSxnQkFBZ0IsUUFBUSxDQUFDO0FBQzVDLGFBQU8sWUFBWSxXQUFXLFFBQVEsQ0FBQztBQUN2QyxhQUFPLFlBQVksaUJBQWlCLGVBQWUsQ0FBQztBQUNwRCxhQUFPLFlBQVksWUFBWSxlQUFlLENBQUM7QUFDL0MsYUFBTyxZQUFZLFVBQVUseUJBQXlCLElBQUksZUFBZSxHQUFHLGlCQUFpQixDQUFDO0FBQzlGLGFBQU8sWUFBWSxVQUFVLG9CQUFvQixDQUFDO0FBRWxELHVCQUFpQjtBQUNqQixhQUFPLFlBQVksVUFBVSxZQUFZLGtCQUFrQixHQUFHLE1BQU0sa0VBQWtFO0FBQ3RJLGFBQU8sWUFBWSwwQkFBMEIsVUFBVSxZQUFZLEdBQUcsSUFBSTtBQUUxRSx3QkFBbUIsRUFBRSxJQUFJLEtBQUssQ0FBQztBQUMvQixtQkFBYyxFQUFFLGlCQUFpQixZQUFZLFVBQVUsSUFBSSxPQUFPLEdBQUcsTUFBTSxJQUFJLE9BQU8sR0FBRyxDQUFDO0FBQzFGLFlBQU07QUFDTixZQUFNO0FBRU4sYUFBTyxZQUFZLFVBQVUsWUFBWSxrQkFBa0IsR0FBRyxNQUFNLGtFQUFrRTtBQUN0SSxhQUFPLFlBQVksMEJBQTBCLFVBQVUsWUFBWSxHQUFHLElBQUk7QUFDMUUsYUFBTyxZQUFZLGlCQUFpQixlQUFlLENBQUM7QUFDcEQsYUFBTyxZQUFZLFlBQVksZUFBZSxDQUFDO0FBQy9DLGFBQU8sWUFBWSxVQUFVLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUM5RixhQUFPLFlBQVksVUFBVSxvQkFBb0IsQ0FBQztBQUNsRCxhQUFPLFlBQVksVUFBVSwyQkFBMkIsSUFBSSxlQUFlLEdBQUcsVUFBVTtBQUV4RiwwQ0FBb0MsU0FBUztBQUM3QyxvQkFBYyxTQUFTO0FBQ3ZCLGFBQU8sWUFBWSxpQkFBaUIsVUFBVSxJQUFJO0FBQ2xELGFBQU8sWUFBWSxZQUFZLFVBQVUsSUFBSTtBQUM3QyxhQUFPLFlBQVksVUFBVSxRQUFRLFFBQVEsS0FBSztBQUNsRCxhQUFPLFlBQVksVUFBVSxVQUFVLGFBQWEsc0NBQXNDO0FBRTFGLHVCQUFpQjtBQUNqQiwwQ0FBb0MsU0FBUztBQUM3QyxvQkFBYyxTQUFTO0FBQ3ZCLGFBQU8sWUFBWSxpQkFBaUIsVUFBVSxLQUFLO0FBQ25ELGFBQU8sWUFBWSxZQUFZLFVBQVUsS0FBSztBQUM5QyxhQUFPLFlBQVksaUJBQWlCLGVBQWUsQ0FBQztBQUNwRCxhQUFPLFlBQVksWUFBWSxlQUFlLENBQUM7QUFDL0MsYUFBTyxZQUFZLFVBQVUsUUFBUSxRQUFRLElBQUk7QUFBQSxJQUNsRCxVQUFFO0FBQ0QsWUFBTSxRQUFRO0FBQUEsSUFDZjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsseUZBQXlGLFlBQVk7QUFDekcsVUFBTSxVQUFVLG9DQUFvQztBQUFBLE1BQ25ELGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxRQUFJO0FBQ0gsVUFBSTtBQUNKLFVBQUk7QUFDSixZQUFNLGdCQUFnQixJQUFJLFFBQWMsYUFBVztBQUFFLHdCQUFnQjtBQUFBLE1BQVMsQ0FBQztBQUMvRSxZQUFNLGFBQWEsSUFBSSxRQUFzQixhQUFXO0FBQUUsd0JBQWdCO0FBQUEsTUFBUyxDQUFDO0FBQ3BGLFlBQU0sZUFBZSxRQUFRLEtBQUs7QUFHbEMsbUJBQWEsb0JBQW9CLE9BQU0sWUFBVztBQUNqRCxnQkFBUSxnQkFBZ0IsS0FBSyxPQUFPO0FBQ3BDLHdCQUFnQjtBQUNoQixlQUFPO0FBQUEsTUFDUjtBQUNBLFlBQU0sU0FBUyw0QkFBNEIsUUFBUSxNQUFNLGlCQUFpQixDQUFDO0FBQzNFLFlBQU07QUFDTixZQUFNLE1BQU0sNEJBQTRCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUN4RSxhQUFPLFlBQVksUUFBUSxpQkFBaUIsZUFBZSxDQUFDO0FBQzVELGNBQVEsa0JBQWtCLElBQUk7QUFDOUIsb0JBQWUsRUFBRSxJQUFJLEtBQUssQ0FBQztBQUMzQixZQUFNO0FBQ04sWUFBTTtBQUNOLGFBQU8sZ0JBQWdCLFFBQVEsZ0JBQWdCLElBQUksVUFBUSxLQUFLLElBQUksR0FBRyxDQUFDLHFDQUFxQyxDQUFDO0FBQzlHLGFBQU8sWUFBWSxRQUFRLGlCQUFpQixlQUFlLENBQUM7QUFDNUQsYUFBTyxZQUFZLFFBQVEsS0FBSyx5QkFBeUIsSUFBSSxlQUFlLEdBQUcsaUJBQWlCLENBQUM7QUFDakcsMENBQW9DLFFBQVEsSUFBSTtBQUNoRCxhQUFPLFlBQVksUUFBUSxpQkFBaUIsVUFBVSxJQUFJO0FBQUEsSUFDM0QsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw4RUFBOEUsWUFBWTtBQUM5RixVQUFNLFVBQVUsb0NBQW9DO0FBQUEsTUFDbkQsZ0JBQWdCO0FBQUEsTUFDaEIsb0JBQW9CO0FBQUEsSUFDckIsQ0FBQztBQUNELFFBQUk7QUFDSCxVQUFJO0FBQ0osVUFBSTtBQUNKLFlBQU0sZ0JBQWdCLElBQUksUUFBYyxhQUFXO0FBQUUsd0JBQWdCO0FBQUEsTUFBUyxDQUFDO0FBQy9FLFlBQU0sYUFBYSxJQUFJLFFBQXdDLGFBQVc7QUFBRSx3QkFBZ0I7QUFBQSxNQUFTLENBQUM7QUFDdEcsWUFBTSxlQUFlLFFBQVEsS0FBSztBQUdsQyxtQkFBYSxvQkFBb0IsT0FBTSxZQUFXO0FBQ2pELGdCQUFRLGdCQUFnQixLQUFLLE9BQU87QUFDcEMsd0JBQWdCO0FBQ2hCLGVBQU87QUFBQSxNQUNSO0FBQ0EsWUFBTSxRQUFRLDRCQUE0QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDMUUsWUFBTTtBQUNOLGNBQVEsa0JBQWtCLElBQUk7QUFDOUIsb0JBQWUsRUFBRSxJQUFJLE9BQU8sU0FBUyx5QkFBeUIsQ0FBQztBQUMvRCxZQUFNO0FBQ04sYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUNqRyxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixLQUFLO0FBQ3pELGFBQU8sWUFBWSxRQUFRLEtBQUssVUFBVSxhQUFhLEVBQUU7QUFBQSxJQUMxRCxVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG9GQUFvRixZQUFZO0FBQ3BHLFVBQU0sVUFBVSxvQ0FBb0M7QUFBQSxNQUNuRCxpQkFBaUIsQ0FBQyxJQUFJLFNBQVMsT0FBTztBQUFBLE1BQ3RDLGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxRQUFJO0FBQ0gsVUFBSTtBQUNKLFVBQUk7QUFDSixZQUFNLGVBQWUsSUFBSSxRQUFjLGFBQVc7QUFBRSx1QkFBZTtBQUFBLE1BQVMsQ0FBQztBQUM3RSxZQUFNLFlBQVksSUFBSSxRQUF3QyxhQUFXO0FBQUUsdUJBQWU7QUFBQSxNQUFTLENBQUM7QUFDcEcsWUFBTSxlQUFlLFFBQVEsS0FBSztBQUNsQyxtQkFBYSxjQUFjLE9BQU0sWUFBVztBQUMzQyxnQkFBUSxXQUFXLEtBQUssRUFBRSxXQUFXLFFBQVEsV0FBVyxTQUFTLFFBQVEsUUFBUSxDQUFDO0FBQ2xGLHVCQUFlO0FBQ2YsZUFBTztBQUFBLE1BQ1I7QUFDQSxZQUFNLFFBQVEsdUJBQXVCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRSxZQUFNO0FBQ04sWUFBTSxTQUFTLHVCQUF1QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDdEUsYUFBTyxZQUFZLFFBQVEsWUFBWSxlQUFlLENBQUM7QUFDdkQsY0FBUSxrQkFBa0IsSUFBSTtBQUM5QixtQkFBYyxFQUFFLGlCQUFpQixTQUFTLFVBQVUsSUFBSSxPQUFPLEdBQUcsTUFBTSxJQUFJLE9BQU8sR0FBRyxDQUFDO0FBQ3ZGLFlBQU07QUFDTixZQUFNO0FBQ04sYUFBTyxnQkFBZ0IsUUFBUSxXQUFXLElBQUksVUFBUSxLQUFLLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUM5RSxhQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBQ3JELGFBQU8sWUFBWSxRQUFRLEtBQUssMkJBQTJCLElBQUksZUFBZSxHQUFHLE9BQU87QUFDeEYsMENBQW9DLFFBQVEsSUFBSTtBQUNoRCxhQUFPLFlBQVksUUFBUSxZQUFZLFVBQVUsSUFBSTtBQUFBLElBQ3RELFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMkZBQTJGLFlBQVk7QUFDM0csVUFBTSxVQUFVLG9DQUFvQztBQUFBLE1BQ25ELGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxRQUFJO0FBQ0gsVUFBSTtBQUNKLFVBQUk7QUFDSixZQUFNLGVBQWUsSUFBSSxRQUFjLGFBQVc7QUFBRSx1QkFBZTtBQUFBLE1BQVMsQ0FBQztBQUM3RSxZQUFNLFlBQVksSUFBSSxRQUF3QyxhQUFXO0FBQUUsdUJBQWU7QUFBQSxNQUFTLENBQUM7QUFDcEcsWUFBTSxlQUFlLFFBQVEsS0FBSztBQUNsQyxtQkFBYSxjQUFjLE9BQU0sWUFBVztBQUMzQyxnQkFBUSxXQUFXLEtBQUssRUFBRSxXQUFXLFFBQVEsV0FBVyxTQUFTLFFBQVEsUUFBUSxDQUFDO0FBQ2xGLHVCQUFlO0FBQ2YsZUFBTztBQUFBLE1BQ1I7QUFDQSxZQUFNLFFBQVEsdUJBQXVCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRSxZQUFNO0FBQ04sY0FBUSxrQkFBa0IsSUFBSTtBQUM5QixtQkFBYyxFQUFFLGlCQUFpQixJQUFJLFVBQVUsSUFBSSxPQUFPLEdBQUcsTUFBTSxJQUFJLE9BQU8sR0FBRyxDQUFDO0FBQ2xGLFlBQU07QUFDTixhQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBQ3JELGFBQU8sWUFBWSxRQUFRLEtBQUssMkJBQTJCLElBQUksZUFBZSxHQUFHLE1BQVM7QUFDMUYsYUFBTyxZQUFZLFFBQVEsS0FBSyxvQkFBb0IsS0FBSztBQUN6RCxhQUFPLFlBQVksUUFBUSxLQUFLLFVBQVUsYUFBYSxFQUFFO0FBQUEsSUFDMUQsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxtRkFBbUYsWUFBWTtBQUNuRyxVQUFNLFVBQVUsb0NBQW9DO0FBQUEsTUFDbkQsaUJBQWlCLENBQUMsSUFBSSxTQUFTLE9BQU87QUFBQSxNQUN0QyxnQkFBZ0I7QUFBQSxNQUNoQixvQkFBb0I7QUFBQSxJQUNyQixDQUFDO0FBQ0QsUUFBSTtBQUNILFVBQUk7QUFDSixVQUFJO0FBQ0osWUFBTSxlQUFlLElBQUksUUFBYyxhQUFXO0FBQUUsdUJBQWU7QUFBQSxNQUFTLENBQUM7QUFDN0UsWUFBTSxZQUFZLElBQUksUUFBd0MsYUFBVztBQUFFLHVCQUFlO0FBQUEsTUFBUyxDQUFDO0FBQ3BHLFlBQU0sZUFBZSxRQUFRLEtBQUs7QUFDbEMsbUJBQWEsY0FBYyxPQUFNLFlBQVc7QUFDM0MsZ0JBQVEsV0FBVyxLQUFLLEVBQUUsV0FBVyxRQUFRLFdBQVcsU0FBUyxRQUFRLFFBQVEsQ0FBQztBQUNsRix1QkFBZTtBQUNmLGVBQU87QUFBQSxNQUNSO0FBQ0EsWUFBTSxRQUFRLHVCQUF1QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDckUsWUFBTTtBQUNOLFlBQU0sU0FBUyx1QkFBdUIsUUFBUSxNQUFNLGlCQUFpQixDQUFDO0FBQ3RFLGNBQVEsa0JBQWtCLElBQUk7QUFDOUIsbUJBQWMsRUFBRSxpQkFBaUIsSUFBSSxVQUFVLElBQUksT0FBTyxHQUFHLE1BQU0sSUFBSSxPQUFPLEdBQUcsQ0FBQztBQUNsRixZQUFNO0FBQ04sWUFBTTtBQUNOLGFBQU8sZ0JBQWdCLFFBQVEsV0FBVyxJQUFJLFVBQVEsS0FBSyxPQUFPLEdBQUcsQ0FBQyxPQUFPLENBQUM7QUFDOUUsYUFBTyxZQUFZLFFBQVEsWUFBWSxlQUFlLENBQUM7QUFDdkQsYUFBTyxZQUFZLFFBQVEsS0FBSyxvQkFBb0IsQ0FBQztBQUNyRCxhQUFPLFlBQVksUUFBUSxLQUFLLDJCQUEyQixJQUFJLGVBQWUsR0FBRyxNQUFTO0FBQzFGLGFBQU8sWUFBWSxRQUFRLEtBQUssb0JBQW9CLEtBQUs7QUFBQSxJQUMxRCxVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDhGQUE4RixZQUFZO0FBQzlHLFVBQU0sVUFBVSxvQ0FBb0M7QUFBQSxNQUNuRCxnQkFBZ0I7QUFBQSxNQUNoQixvQkFBb0I7QUFBQSxJQUNyQixDQUFDO0FBQ0QsUUFBSTtBQUNILFVBQUk7QUFDSixVQUFJO0FBQ0osWUFBTSxnQkFBZ0IsSUFBSSxRQUFjLGFBQVc7QUFBRSx3QkFBZ0I7QUFBQSxNQUFTLENBQUM7QUFDL0UsWUFBTSxhQUFhLElBQUksUUFBZSxDQUFDLFVBQVUsV0FBVztBQUFFLHVCQUFlO0FBQUEsTUFBUSxDQUFDO0FBQ3RGLFlBQU0sZUFBZSxRQUFRLEtBQUs7QUFHbEMsbUJBQWEsb0JBQW9CLE9BQU0sWUFBVztBQUNqRCxnQkFBUSxnQkFBZ0IsS0FBSyxPQUFPO0FBQ3BDLHdCQUFnQjtBQUNoQixlQUFPO0FBQUEsTUFDUjtBQUNBLFlBQU0sU0FBUyw0QkFBNEIsUUFBUSxNQUFNLGlCQUFpQixDQUFDO0FBQzNFLFlBQU07QUFDTixZQUFNLFFBQVEsNEJBQTRCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUMxRSxjQUFRLGtCQUFrQixJQUFJO0FBQzlCLG1CQUFjLElBQUksTUFBTSxlQUFlLENBQUM7QUFDeEMsWUFBTTtBQUNOLFlBQU07QUFDTixhQUFPLGdCQUFnQixRQUFRLGdCQUFnQixJQUFJLFVBQVEsS0FBSyxJQUFJLEdBQUcsQ0FBQyxxQ0FBcUMsQ0FBQztBQUM5RyxhQUFPLFlBQVksUUFBUSxpQkFBaUIsZUFBZSxDQUFDO0FBQzVELGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksZUFBZSxHQUFHLGlCQUFpQixDQUFDO0FBQ2pHLGFBQU8sWUFBWSxRQUFRLEtBQUssb0JBQW9CLEtBQUs7QUFBQSxJQUMxRCxVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHlGQUF5RixZQUFZO0FBQ3pHLFVBQU0sVUFBVSxvQ0FBb0M7QUFBQSxNQUNuRCxpQkFBaUIsQ0FBQyxJQUFJLFNBQVMsT0FBTztBQUFBLE1BQ3RDLGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxRQUFJO0FBQ0gsVUFBSTtBQUNKLFVBQUk7QUFDSixZQUFNLGVBQWUsSUFBSSxRQUFjLGFBQVc7QUFBRSx1QkFBZTtBQUFBLE1BQVMsQ0FBQztBQUM3RSxZQUFNLFlBQVksSUFBSSxRQUFlLENBQUMsVUFBVSxXQUFXO0FBQUUsc0JBQWM7QUFBQSxNQUFRLENBQUM7QUFDcEYsWUFBTSxlQUFlLFFBQVEsS0FBSztBQUNsQyxtQkFBYSxjQUFjLE9BQU0sWUFBVztBQUMzQyxnQkFBUSxXQUFXLEtBQUssRUFBRSxXQUFXLFFBQVEsV0FBVyxTQUFTLFFBQVEsUUFBUSxDQUFDO0FBQ2xGLHVCQUFlO0FBQ2YsZUFBTztBQUFBLE1BQ1I7QUFDQSxZQUFNLFFBQVEsdUJBQXVCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUNyRSxZQUFNO0FBQ04sWUFBTSxTQUFTLHVCQUF1QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDdEUsY0FBUSxrQkFBa0IsSUFBSTtBQUM5QixrQkFBYSxJQUFJLE1BQU0sY0FBYyxDQUFDO0FBQ3RDLFlBQU07QUFDTixZQUFNO0FBQ04sYUFBTyxnQkFBZ0IsUUFBUSxXQUFXLElBQUksVUFBUSxLQUFLLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUM5RSxhQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBQ3JELGFBQU8sWUFBWSxRQUFRLEtBQUssMkJBQTJCLElBQUksZUFBZSxHQUFHLE1BQVM7QUFDMUYsYUFBTyxZQUFZLFFBQVEsS0FBSyxvQkFBb0IsS0FBSztBQUFBLElBQzFELFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMEVBQTBFLFlBQVk7QUFDMUYsVUFBTSxVQUFVLG9DQUFvQztBQUFBLE1BQ25ELGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxRQUFJO0FBQ0gsYUFBTyxZQUFZLDBCQUEwQixRQUFRLEtBQUssWUFBWSxHQUFHLEtBQUs7QUFDOUUsYUFBTyxZQUFZLFFBQVEsS0FBSyxZQUFZLHFCQUFxQixHQUFHLEtBQUs7QUFDekUsYUFBTyxZQUFZLGlDQUFpQyxRQUFRLElBQUksR0FBRyxLQUFLO0FBQ3hFLGFBQU8sWUFBWSw4QkFBOEIsUUFBUSxJQUFJLEdBQUcsS0FBSztBQUNyRSxhQUFPLFlBQVksOEJBQThCLFFBQVEsSUFBSSxHQUFHLEtBQUs7QUFDckUsMENBQW9DLFFBQVEsSUFBSTtBQUNoRCx3QkFBa0IsUUFBUSxJQUFJO0FBQzlCLG9CQUFjLFFBQVEsSUFBSTtBQUMxQixhQUFPLFlBQVksUUFBUSxLQUFLLFdBQVcsU0FBUyxLQUFLO0FBQ3pELGFBQU8sWUFBWSxRQUFRLEtBQUssUUFBUSxRQUFRLE9BQU8sMENBQTBDO0FBQ2pHLGFBQU8sWUFBWSxRQUFRLEtBQUssVUFBVSxhQUFhLEdBQUcsc0NBQXNDLFdBQU0sNENBQTRDLEVBQUU7QUFDcEosYUFBTyxZQUFZLFFBQVEsaUJBQWlCLFVBQVUsSUFBSTtBQUMxRCxhQUFPLFlBQVksUUFBUSxpQkFBaUIsYUFBYSxlQUFlLEdBQUcsTUFBTTtBQUNqRixhQUFPLFlBQVksUUFBUSxZQUFZLFVBQVUsSUFBSTtBQUNyRCxhQUFPLFlBQVksUUFBUSxZQUFZLGFBQWEsZUFBZSxHQUFHLE1BQU07QUFDNUUsYUFBTyxZQUFZLFFBQVEsWUFBWSxVQUFVLElBQUk7QUFDckQsYUFBTyxZQUFZLFFBQVEsWUFBWSxhQUFhLGVBQWUsR0FBRyxNQUFNO0FBRTVFLFlBQU0sNEJBQTRCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUNsRSxZQUFNLHVCQUF1QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDN0QsYUFBTyxnQkFBZ0IsUUFBUSxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2xELGFBQU8sZ0JBQWdCLFFBQVEsWUFBWSxDQUFDLENBQUM7QUFDN0MsYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxhQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUNqRyxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBRXJELGNBQVEsaUJBQWlCLFdBQVc7QUFDcEMsY0FBUSxpQkFBaUIsZ0JBQWdCLFVBQVU7QUFDbkQsY0FBUSxpQkFBaUIsYUFBYSxpQkFBaUIsT0FBTztBQUM5RCxjQUFRLFlBQVksV0FBVztBQUMvQixjQUFRLFlBQVksZ0JBQWdCLFVBQVU7QUFDOUMsY0FBUSxZQUFZLGFBQWEsaUJBQWlCLE9BQU87QUFDekQsY0FBUSxZQUFZLFdBQVc7QUFDL0IsY0FBUSxZQUFZLGdCQUFnQixVQUFVO0FBQzlDLGNBQVEsWUFBWSxhQUFhLGlCQUFpQixPQUFPO0FBQ3pELGNBQVEsaUJBQWlCLGdCQUFnQjtBQUN6QyxjQUFRLFlBQVksZ0JBQWdCO0FBQ3BDLFlBQU0sNEJBQTRCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUNsRSxZQUFNLHVCQUF1QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDN0QsYUFBTyxnQkFBZ0IsUUFBUSxpQkFBaUIsQ0FBQyxDQUFDO0FBQ2xELGFBQU8sZ0JBQWdCLFFBQVEsWUFBWSxDQUFDLENBQUM7QUFDN0MsYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxhQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUNqRyxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBQUEsSUFDdEQsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSywyRUFBMkUsWUFBWTtBQUMzRixVQUFNLFVBQVUsb0NBQW9DO0FBQUEsTUFDbkQsZ0JBQWdCO0FBQUEsTUFDaEIsb0JBQW9CO0FBQUEsSUFDckIsQ0FBQztBQUNELFFBQUk7QUFDSCxhQUFPLFlBQVksMEJBQTBCLFFBQVEsS0FBSyxZQUFZLEdBQUcsS0FBSztBQUM5RSxhQUFPLFlBQVksUUFBUSxLQUFLLFlBQVkscUJBQXFCLEdBQUcsSUFBSTtBQUN4RSxhQUFPLFlBQVksaUNBQWlDLFFBQVEsSUFBSSxHQUFHLElBQUk7QUFDdkUsYUFBTyxZQUFZLDhCQUE4QixRQUFRLElBQUksR0FBRyxJQUFJO0FBQ3BFLGFBQU8sWUFBWSw4QkFBOEIsUUFBUSxJQUFJLEdBQUcsSUFBSTtBQUNwRSwwQ0FBb0MsUUFBUSxJQUFJO0FBQ2hELHdCQUFrQixRQUFRLElBQUk7QUFDOUIsb0JBQWMsUUFBUSxJQUFJO0FBQzFCLGFBQU8sWUFBWSxRQUFRLEtBQUssV0FBVyxTQUFTLElBQUk7QUFDeEQsYUFBTyxZQUFZLFFBQVEsS0FBSyxRQUFRLFFBQVEsSUFBSTtBQUNwRCxhQUFPLFlBQVksUUFBUSxpQkFBaUIsVUFBVSxLQUFLO0FBQzNELGFBQU8sWUFBWSxRQUFRLFlBQVksVUFBVSxLQUFLO0FBQ3RELGFBQU8sWUFBWSxRQUFRLFlBQVksVUFBVSxLQUFLO0FBRXRELFlBQU0sNEJBQTRCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUNsRSxZQUFNLHVCQUF1QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDN0QsYUFBTyxnQkFBZ0IsUUFBUSxpQkFBaUIsQ0FBQyxFQUFFLFdBQVcsaUJBQWlCLE1BQU0sc0NBQXNDLENBQUMsQ0FBQztBQUM3SCxhQUFPLGdCQUFnQixRQUFRLFlBQVksQ0FBQyxFQUFFLFdBQVcsaUJBQWlCLFNBQVMsV0FBVyxDQUFDLENBQUM7QUFDaEcsYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxhQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUNqRyxhQUFPLFlBQVksUUFBUSxLQUFLLG9CQUFvQixDQUFDO0FBQUEsSUFDdEQsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSywwRkFBMEYsWUFBWTtBQUMxRyxVQUFNLFFBQVEsSUFBSSxnQkFBZ0I7QUFDbEMsVUFBTSxrQkFBa0IsQ0FBQyxJQUFJLFNBQVMsU0FBUyxPQUFPO0FBQ3RELFVBQU0sNEJBQTRCLG9CQUFJLElBQW9CO0FBQUEsTUFDekQsQ0FBQyxVQUFVLE9BQU87QUFBQSxNQUNsQixDQUFDLFVBQVUsT0FBTztBQUFBLElBQ25CLENBQUM7QUFDRCxRQUFJLGlCQUFpQjtBQUNyQixRQUFJO0FBQ0osUUFBSTtBQUNKLFVBQU0sZUFBZSxJQUFJLFFBQWMsYUFBVztBQUFFLHFCQUFlO0FBQUEsSUFBUyxDQUFDO0FBQzdFLFVBQU0sY0FBYyxTQUFTLGNBQWMsUUFBUTtBQUNuRCxnQkFBWSxJQUFJLElBQUksT0FBTyxZQUFZLEVBQUUsQ0FBQztBQUMxQyxnQkFBWSxJQUFJLElBQUksT0FBTyxTQUFTLE9BQU8sQ0FBQztBQUM1QyxnQkFBWSxJQUFJLElBQUksT0FBTyxTQUFTLE9BQU8sQ0FBQztBQUM1QyxnQkFBWSxJQUFJLElBQUksT0FBTyxTQUFTLE9BQU8sQ0FBQztBQUM1QyxVQUFNLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDNUMsWUFBUSxTQUFTO0FBQ2pCLFVBQU0sWUFBWSxTQUFTLGNBQWMsTUFBTTtBQUMvQyxVQUFNLE9BQU87QUFBQSxNQUNaO0FBQUEsTUFDQSxvQkFBb0I7QUFBQSxNQUNwQjtBQUFBLE1BQ0EsMEJBQTBCLG9CQUFJLElBQTZEO0FBQUEsTUFDM0Ysb0JBQW9CO0FBQUEsTUFDcEI7QUFBQSxNQUNBO0FBQUEsTUFDQSxZQUFZLEVBQUUsU0FBUyxLQUFLO0FBQUEsTUFDNUIsZ0JBQWdCO0FBQUEsTUFDaEIsY0FBYyxFQUFFLE9BQU8sR0FBRztBQUFBLE1BQzFCLHFCQUFxQixFQUFFLFNBQVM7QUFBQSxNQUFFLEVBQUU7QUFBQSxNQUNwQyxnQkFBZ0IsRUFBRSxTQUFTO0FBQUEsTUFBRSxFQUFFO0FBQUEsTUFDL0IsZ0JBQWdCO0FBQUEsUUFDZixPQUFPLE9BQWU7QUFDckIsc0JBQVksZ0JBQWdCO0FBQzVCLGVBQUsscUJBQXFCO0FBQUEsUUFDM0I7QUFBQSxNQUNEO0FBQUEsTUFDQSxhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLHNCQUFzQixNQUFNO0FBQUEsTUFDN0I7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2pFLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLE1BQU07QUFBQSxRQUN0RCxhQUFhLE1BQU0sSUFBSSxRQUFRLENBQUMsVUFBVSxXQUFXO0FBQ3BELHlCQUFlO0FBQ2YseUJBQWU7QUFBQSxRQUNoQixDQUFDO0FBQUEsTUFDRjtBQUFBLE1BQ0EsbUJBQW1CLE1BQU07QUFBQSxNQUN6QixvQkFBb0I7QUFBQSxNQUFFO0FBQUEsSUFDdkI7QUFDQSxVQUFNLFlBQVk7QUFDbEIsUUFBSTtBQUNILFlBQU0sYUFBYSx1QkFBdUIsV0FBVyxVQUFVLENBQUM7QUFDaEUsWUFBTTtBQUNOLGFBQU8sWUFBWSxVQUFVLG9CQUFvQixDQUFDO0FBRWxELHVCQUFpQjtBQUNqQixnQkFBVSxxQkFBcUI7QUFDL0Isa0JBQVksZ0JBQWdCO0FBQzVCLG1CQUFjLElBQUksTUFBTSx1QkFBdUIsQ0FBQztBQUNoRCxZQUFNO0FBRU4sYUFBTyxZQUFZLGdCQUFnQixRQUFRO0FBQzNDLGFBQU8sWUFBWSxZQUFZLGVBQWUsQ0FBQztBQUMvQyxhQUFPLFlBQVksVUFBVSxvQkFBb0IsQ0FBQztBQUNsRCxhQUFPLFlBQVksMEJBQTBCLElBQUksUUFBUSxHQUFHLE9BQU87QUFDbkUsYUFBTyxZQUFZLDBCQUEwQixJQUFJLFFBQVEsR0FBRyxPQUFPO0FBQ25FLGFBQU8sWUFBWSxVQUFVLG9CQUFvQixLQUFLO0FBQ3RELGFBQU8sWUFBWSxRQUFRLFFBQVEsSUFBSTtBQUV2QywrQkFBeUIsV0FBVyxRQUFRO0FBQzVDLGFBQU8sWUFBWSxVQUFVLG9CQUFvQixDQUFDO0FBQ2xELGFBQU8sWUFBWSxZQUFZLGVBQWUsQ0FBQztBQUMvQyxhQUFPLFlBQVksVUFBVSxnQkFBZ0IsVUFBVSxrQkFBa0IsS0FBSyxJQUFJLE9BQU87QUFDekYsYUFBTyxZQUFZLDBCQUEwQixJQUFJLFFBQVEsR0FBRyxPQUFPO0FBQUEsSUFDcEUsVUFBRTtBQUNELFlBQU0sUUFBUTtBQUFBLElBQ2Y7QUFBQSxFQUNELENBQUM7QUFFRCxXQUFTLHVCQU1QO0FBQ0QsVUFBTSxrQkFBa0IsQ0FBQyxJQUFJLFNBQVMsT0FBTztBQUM3QyxVQUFNLDRCQUE0QixvQkFBSSxJQUFvQjtBQUMxRCxVQUFNLGFBQXVELENBQUM7QUFDOUQsVUFBTSxTQUFxQyxDQUFDO0FBQzVDLFVBQU0sY0FBYyxTQUFTLGNBQWMsUUFBUTtBQUNuRCxnQkFBWSxJQUFJLElBQUksT0FBTyxZQUFZLEVBQUUsQ0FBQztBQUMxQyxnQkFBWSxJQUFJLElBQUksT0FBTyxTQUFTLE9BQU8sQ0FBQztBQUM1QyxnQkFBWSxJQUFJLElBQUksT0FBTyxTQUFTLE9BQU8sQ0FBQztBQUM1QyxVQUFNLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDNUMsWUFBUSxTQUFTO0FBQ2pCLFVBQU0sWUFBWSxTQUFTLGNBQWMsTUFBTTtBQUMvQyxRQUFJO0FBQ0osVUFBTSxPQUFPO0FBQUEsTUFDWjtBQUFBLE1BQ0Esb0JBQW9CO0FBQUEsTUFDcEI7QUFBQSxNQUNBLDBCQUEwQixvQkFBSSxJQUE2RDtBQUFBLE1BQzNGLG9CQUFvQjtBQUFBLE1BQ3BCLGdCQUFnQjtBQUFBLE1BQ2hCLGdCQUFnQjtBQUFBLE1BQ2hCLFFBQVEsb0JBQUksSUFBb0I7QUFBQSxNQUNoQyxjQUFjLEVBQUUsT0FBTyxRQUFRO0FBQUEsTUFDL0IsWUFBWSxFQUFFLFNBQVMsS0FBSztBQUFBLE1BQzVCO0FBQUEsTUFDQTtBQUFBLE1BQ0Esc0JBQXNCLEVBQUUsVUFBVSxNQUFNLE1BQU07QUFBQSxNQUM5QyxxQkFBcUIsRUFBRSxTQUFTO0FBQUEsTUFBRSxFQUFFO0FBQUEsTUFDcEMsZ0JBQWdCLEVBQUUsU0FBUztBQUFBLE1BQUUsRUFBRTtBQUFBLE1BQy9CLGdCQUFnQjtBQUFBLFFBQ2YsT0FBTyxPQUFlO0FBQ3JCLHNCQUFZLGdCQUFnQjtBQUM1QixlQUFLLHFCQUFxQjtBQUFBLFFBQzNCO0FBQUEsTUFDRDtBQUFBLE1BQ0EsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLE1BQzdCO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixNQUFNO0FBQUEsUUFDdEQsYUFBYSxDQUFDLFlBQW9EO0FBQ2pFLHFCQUFXLEtBQUssRUFBRSxXQUFXLFFBQVEsV0FBVyxTQUFTLFFBQVEsUUFBUSxDQUFDO0FBQzFFLGNBQUksQ0FBQyxTQUFTO0FBQ2Isa0JBQU0sSUFBSSxNQUFNLHFDQUFxQztBQUFBLFVBQ3REO0FBQ0EsaUJBQU8sUUFBUSxRQUFRLFNBQVMsV0FBVyxNQUFNO0FBQUEsUUFDbEQ7QUFBQSxNQUNEO0FBQUEsTUFDQSxrQkFBa0I7QUFBQSxRQUNqQixNQUFNLE9BQU8sUUFBa0M7QUFDOUMsaUJBQU8sS0FBSyxHQUFHO0FBQ2YsaUJBQU8sRUFBRSxVQUFVLE1BQU0sYUFBYSxFQUFFLElBQUksS0FBSyxFQUFFO0FBQUEsUUFDcEQ7QUFBQSxNQUNEO0FBQUEsTUFDQSxtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLDBCQUEwQjtBQUFBLE1BQUU7QUFBQSxNQUM1QixvQkFBb0I7QUFBQSxNQUFFO0FBQUEsTUFDdEIsMEJBQTBCO0FBQUEsTUFBRTtBQUFBLE1BQzVCLGtCQUFrQjtBQUFBLE1BQUU7QUFBQSxJQUNyQjtBQUNBLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxJQUFJLFdBQVc7QUFDZCxrQkFBVTtBQUFBLE1BQ1g7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLE9BQUssc0ZBQXNGLFlBQVk7QUFDdEcsVUFBTSxVQUFVLHFCQUFxQjtBQUNyQyxRQUFJO0FBQ0osUUFBSTtBQUNKLFVBQU0sZUFBZSxJQUFJLFFBQWMsYUFBVztBQUFFLHFCQUFlO0FBQUEsSUFBUyxDQUFDO0FBQzdFLFVBQU0sWUFBWSxJQUFJLFFBQWUsQ0FBQyxVQUFVLFdBQVc7QUFBRSxxQkFBZTtBQUFBLElBQVEsQ0FBQztBQUNyRixRQUFJO0FBQ0osUUFBSTtBQUNKLFVBQU0sZ0JBQWdCLElBQUksUUFBYyxhQUFXO0FBQUUsc0JBQWdCO0FBQUEsSUFBUyxDQUFDO0FBQy9FLFVBQU0sYUFBYSxJQUFJLFFBQXFDLGFBQVc7QUFBRSxzQkFBZ0I7QUFBQSxJQUFTLENBQUM7QUFDbkcsWUFBUSxJQUFJLENBQUMsU0FBUyxTQUFTO0FBQzlCLFVBQUksU0FBUyxHQUFHO0FBQ2YsdUJBQWU7QUFDZixlQUFPO0FBQUEsTUFDUjtBQUNBLHNCQUFnQjtBQUNoQixhQUFPLFlBQVksU0FBUyxPQUFPO0FBQ25DLGFBQU8sV0FBVyxLQUFLLFlBQVUsRUFBRSxHQUFHLE9BQU8sVUFBVSxJQUFJLE9BQU8sR0FBRyxNQUFNLElBQUksT0FBTyxHQUFHLEVBQUU7QUFBQSxJQUM1RixDQUFDO0FBQ0QsVUFBTSxRQUFRLHVCQUF1QixRQUFRLE1BQU0sY0FBYyxDQUFDO0FBQ2xFLFVBQU07QUFDTixVQUFNLFNBQVMsdUJBQXVCLFFBQVEsTUFBTSxjQUFjLENBQUM7QUFDbkUsV0FBTyxZQUFZLFFBQVEsWUFBWSxlQUFlLENBQUM7QUFDdkQsaUJBQWMsSUFBSSxNQUFNLG9CQUFvQixDQUFDO0FBQzdDLFVBQU07QUFDTixXQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxXQUFPLGVBQWUsUUFBUSxLQUFLLDJCQUEyQixJQUFJLFlBQVksR0FBRyxPQUFPO0FBQ3hGLGtCQUFlLEVBQUUsaUJBQWlCLFFBQVEsQ0FBQztBQUMzQyxVQUFNO0FBQ04sVUFBTTtBQUNOLFdBQU8sWUFBWSxRQUFRLFlBQVksZUFBZSxDQUFDO0FBQ3ZELFdBQU8sWUFBWSxRQUFRLEtBQUssb0JBQW9CLENBQUM7QUFDckQsV0FBTyxZQUFZLFFBQVEsS0FBSywyQkFBMkIsSUFBSSxZQUFZLEdBQUcsT0FBTztBQUNyRixXQUFPLGdCQUFnQixRQUFRLFdBQVcsSUFBSSxVQUFRLEtBQUssT0FBTyxHQUFHLENBQUMsU0FBUyxPQUFPLENBQUM7QUFDdkYsVUFBTSxZQUFZLFFBQVEsSUFBZ0Q7QUFDMUUsV0FBTyxnQkFBZ0IsUUFBUSxRQUFRLENBQUM7QUFBQSxNQUN2QyxNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixnQkFBZ0I7QUFBQSxJQUNqQixDQUFDLENBQUM7QUFBQSxFQUNILENBQUM7QUFFRCxPQUFLLHFFQUFxRSxZQUFZO0FBQ3JGLFVBQU0sVUFBVSxxQkFBcUI7QUFDckMsUUFBSTtBQUNKLFFBQUk7QUFDSixVQUFNLGVBQWUsSUFBSSxRQUFjLGFBQVc7QUFBRSxxQkFBZTtBQUFBLElBQVMsQ0FBQztBQUM3RSxVQUFNLFlBQVksSUFBSSxRQUFxQyxhQUFXO0FBQUUscUJBQWU7QUFBQSxJQUFTLENBQUM7QUFDakcsWUFBUSxJQUFJLENBQUMsU0FBUyxTQUFTO0FBQzlCLFVBQUksU0FBUyxHQUFHO0FBQ2YsdUJBQWU7QUFDZixlQUFPLFVBQVUsS0FBSyxZQUFVLEVBQUUsR0FBRyxPQUFPLFVBQVUsSUFBSSxPQUFPLEdBQUcsTUFBTSxJQUFJLE9BQU8sR0FBRyxFQUFFO0FBQUEsTUFDM0Y7QUFDQSxhQUFPLFlBQVksU0FBUyxPQUFPO0FBQ25DLGFBQU8sUUFBUSxRQUFRLEVBQUUsaUJBQWlCLFNBQVMsVUFBVSxJQUFJLE9BQU8sR0FBRyxNQUFNLElBQUksT0FBTyxHQUFHLENBQUM7QUFBQSxJQUNqRyxDQUFDO0FBQ0QsVUFBTSxRQUFRLHVCQUF1QixRQUFRLE1BQU0sY0FBYyxDQUFDO0FBQ2xFLFVBQU07QUFDTixVQUFNLFNBQVMsdUJBQXVCLFFBQVEsTUFBTSxjQUFjLENBQUM7QUFDbkUsV0FBTyxZQUFZLFFBQVEsWUFBWSxlQUFlLENBQUM7QUFDdkQsaUJBQWMsRUFBRSxpQkFBaUIsUUFBUSxDQUFDO0FBQzFDLFVBQU07QUFDTixVQUFNO0FBQ04sV0FBTyxZQUFZLFFBQVEsWUFBWSxlQUFlLENBQUM7QUFDdkQsV0FBTyxZQUFZLFFBQVEsS0FBSywyQkFBMkIsSUFBSSxZQUFZLEdBQUcsT0FBTztBQUNyRixXQUFPLGVBQWUsUUFBUSxLQUFLLDJCQUEyQixJQUFJLFlBQVksR0FBRyxPQUFPO0FBQ3hGLFdBQU8sZ0JBQWdCLFFBQVEsV0FBVyxJQUFJLFVBQVEsS0FBSyxPQUFPLEdBQUcsQ0FBQyxTQUFTLE9BQU8sQ0FBQztBQUN2RixVQUFNLFlBQVksUUFBUSxJQUFnRDtBQUMxRSxXQUFPLGdCQUFnQixRQUFRLFFBQVEsQ0FBQztBQUFBLE1BQ3ZDLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxNQUNOLGdCQUFnQjtBQUFBLElBQ2pCLENBQUMsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUVELE9BQUssc0VBQXNFLFlBQVk7QUFDdEYsVUFBTSxVQUFVLHFCQUFxQjtBQUNyQyxRQUFJO0FBQ0osUUFBSTtBQUNKLFVBQU0sZUFBZSxJQUFJLFFBQWMsYUFBVztBQUFFLHFCQUFlO0FBQUEsSUFBUyxDQUFDO0FBQzdFLFVBQU0sWUFBWSxJQUFJLFFBQWUsQ0FBQyxVQUFVLFdBQVc7QUFBRSxxQkFBZTtBQUFBLElBQVEsQ0FBQztBQUNyRixZQUFRLElBQUksTUFBTTtBQUNqQixxQkFBZTtBQUNmLGFBQU87QUFBQSxJQUNSLENBQUM7QUFDRCxVQUFNLFFBQVEsdUJBQXVCLFFBQVEsTUFBTSxjQUFjLENBQUM7QUFDbEUsVUFBTTtBQUNOLGlCQUFjLElBQUksTUFBTSxnQkFBZ0IsQ0FBQztBQUN6QyxVQUFNO0FBQ04sV0FBTyxZQUFZLFFBQVEsWUFBWSxlQUFlLENBQUM7QUFDdkQsV0FBTyxZQUFZLFFBQVEsS0FBSyxvQkFBb0IsQ0FBQztBQUNyRCxXQUFPLFlBQVksUUFBUSxLQUFLLDJCQUEyQixJQUFJLFlBQVksR0FBRyxNQUFTO0FBQ3ZGLFVBQU0sWUFBWSxRQUFRLElBQWdEO0FBQzFFLFdBQU8sZ0JBQWdCLFFBQVEsUUFBUSxDQUFDLEVBQUUsTUFBTSxlQUFlLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFBQSxFQUNoRixDQUFDO0FBRUQsT0FBSyxrR0FBa0csWUFBWTtBQUNsSCxVQUFNLFVBQVUscUJBQXFCO0FBQ3JDLFFBQUk7QUFDSixRQUFJO0FBQ0osVUFBTSxlQUFlLElBQUksUUFBYyxhQUFXO0FBQUUscUJBQWU7QUFBQSxJQUFTLENBQUM7QUFDN0UsVUFBTSxZQUFZLElBQUksUUFBZSxDQUFDLFVBQVUsV0FBVztBQUFFLHFCQUFlO0FBQUEsSUFBUSxDQUFDO0FBQ3JGLFlBQVEsSUFBSSxNQUFNO0FBQ2pCLHFCQUFlO0FBQ2YsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUNELFVBQU0sUUFBUSx1QkFBdUIsUUFBUSxNQUFNLGNBQWMsQ0FBQztBQUNsRSxVQUFNO0FBQ04sVUFBTSxTQUFTLHVCQUF1QixRQUFRLE1BQU0sY0FBYyxDQUFDO0FBQ25FLFVBQU0sdUJBQXVCLFFBQVEsTUFBTSxjQUFjLENBQUM7QUFDMUQsV0FBTyxnQkFBZ0IsUUFBUSxXQUFXLElBQUksVUFBUSxLQUFLLE9BQU8sR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUM5RSxXQUFPLFlBQVksUUFBUSxZQUFZLGVBQWUsQ0FBQztBQUN2RCxpQkFBYyxJQUFJLE1BQU0sb0JBQW9CLENBQUM7QUFDN0MsVUFBTTtBQUNOLFVBQU07QUFDTixXQUFPLGdCQUFnQixRQUFRLFdBQVcsSUFBSSxVQUFRLEtBQUssT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDO0FBQzlFLFdBQU8sWUFBWSxRQUFRLFlBQVksZUFBZSxDQUFDO0FBQ3ZELFdBQU8sZUFBZSxRQUFRLEtBQUssMkJBQTJCLElBQUksWUFBWSxHQUFHLE9BQU87QUFBQSxFQUN6RixDQUFDO0FBRUQsV0FBUyxrQ0FRUDtBQUNELFVBQU0sUUFBUSxJQUFJLGdCQUFnQjtBQUNsQyxVQUFNLG1CQUFtQixTQUFTLGNBQWMsUUFBUTtBQUN4RCxxQkFBaUIsSUFBSSxJQUFJLE9BQU8sT0FBTyxHQUFHLENBQUM7QUFDM0MscUJBQWlCLElBQUksSUFBSSxPQUFPLFNBQVMsR0FBRyxDQUFDO0FBQzdDLHFCQUFpQixJQUFJLElBQUksT0FBTyxVQUFVLEdBQUcsQ0FBQztBQUM5QyxxQkFBaUIsZ0JBQWdCO0FBQ2pDLFVBQU0sVUFBVSxTQUFTLGNBQWMsS0FBSztBQUM1QyxZQUFRLFNBQVM7QUFDakIsVUFBTSxZQUFZLFNBQVMsY0FBYyxNQUFNO0FBQy9DLFVBQU0sMkJBQTJCLG9CQUFJLElBQTZEO0FBQUEsTUFDakcsQ0FBQyxVQUFVLEVBQUUsWUFBWSxHQUFHLGlCQUFpQixFQUFFLENBQUM7QUFBQSxNQUNoRCxDQUFDLFVBQVUsRUFBRSxZQUFZLEdBQUcsaUJBQWlCLEVBQUUsQ0FBQztBQUFBLElBQ2pELENBQUM7QUFDRCxRQUFJLGlCQUFpQjtBQUNyQixRQUFJLGlCQUFpQjtBQUNyQixRQUFJO0FBQ0osUUFBSTtBQUNKLFVBQU0sb0JBQW9CLElBQUksUUFBYyxhQUFXO0FBQUUsMEJBQW9CO0FBQUEsSUFBUyxDQUFDO0FBQ3ZGLFVBQU0saUJBQWlCLElBQUksUUFBMkMsQ0FBQyxTQUFTLFdBQVc7QUFDMUYsMEJBQW9CLGFBQVc7QUFDOUIsWUFBSSxtQkFBbUIsT0FBTztBQUM3QixpQkFBTyxPQUFPO0FBQ2Q7QUFBQSxRQUNEO0FBQ0EsZ0JBQVEsT0FBTztBQUFBLE1BQ2hCO0FBQUEsSUFDRCxDQUFDO0FBQ0QsVUFBTSxPQUFPO0FBQUEsTUFDWjtBQUFBLE1BQ0Esb0JBQW9CO0FBQUEsTUFDcEIsb0JBQW9CO0FBQUEsTUFDcEIscUJBQXFCO0FBQUEsUUFDcEIsYUFBYTtBQUFBLFFBQUU7QUFBQSxRQUNmLGVBQWU7QUFBQSxRQUFFO0FBQUEsUUFDakIsT0FBTyxPQUFlO0FBQUUsMkJBQWlCLGdCQUFnQjtBQUFBLFFBQU87QUFBQSxNQUNqRTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLHNCQUFzQixNQUFNO0FBQUEsTUFDN0I7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2pFLHVCQUF1QixPQUFPLEVBQUUsZUFBZTtBQUFBLFFBQy9DLG1CQUFtQixZQUFZO0FBQzlCLDhCQUFvQjtBQUNwQixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQSxtQkFBbUIsTUFBTTtBQUFBLElBQzFCO0FBQ0EsV0FBTztBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0Esa0JBQWtCLFNBQWtCO0FBQ25DLHlCQUFpQjtBQUFBLE1BQ2xCO0FBQUEsTUFDQTtBQUFBLE1BQ0Esd0JBQXdCO0FBQ3ZCLHlCQUFpQjtBQUNqQix5QkFBaUIsZ0JBQWdCLHlCQUF5QixJQUFJLFFBQVEsRUFBRztBQUFBLE1BQzFFO0FBQUEsTUFDQSxTQUFTLE1BQU0sTUFBTSxRQUFRO0FBQUEsSUFDOUI7QUFBQSxFQUNEO0FBRUEsT0FBSyw2RkFBNkYsWUFBWTtBQUM3RyxVQUFNLFVBQVUsZ0NBQWdDO0FBQ2hELFFBQUk7QUFDSCxZQUFNLFFBQVEsNEJBQTRCLFFBQVEsTUFBTSxVQUFVLENBQUM7QUFDbkUsWUFBTSxRQUFRO0FBQ2QsYUFBTyxZQUFZLFFBQVEsS0FBSyx5QkFBeUIsSUFBSSxRQUFRLEdBQUcsaUJBQWlCLENBQUM7QUFDMUYsYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxjQUFRLHNCQUFzQjtBQUM5QixhQUFPLFlBQVksUUFBUSxpQkFBaUIsZUFBZSxDQUFDO0FBQzVELGNBQVEsa0JBQWtCLEVBQUUsSUFBSSxPQUFPLFNBQVMseUJBQXlCLENBQUM7QUFDMUUsWUFBTTtBQUNOLGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBQzFGLGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBQzFGLGFBQU8sWUFBWSxRQUFRLGlCQUFpQixlQUFlLENBQUM7QUFDNUQsYUFBTyxZQUFZLFFBQVEsS0FBSyxRQUFRLFFBQVEsSUFBSTtBQUNwRCxhQUFPLFlBQVksUUFBUSxLQUFLLFVBQVUsYUFBYSxFQUFFO0FBQ3pELGFBQU8sWUFBWSxRQUFRLEtBQUssb0JBQW9CLEtBQUs7QUFBQSxJQUMxRCxVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDhGQUE4RixZQUFZO0FBQzlHLFVBQU0sVUFBVSxnQ0FBZ0M7QUFDaEQsUUFBSTtBQUNILFlBQU0sUUFBUSw0QkFBNEIsUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUNuRSxZQUFNLFFBQVE7QUFDZCxjQUFRLHNCQUFzQjtBQUM5QixjQUFRLGtCQUFrQixJQUFJLE1BQU0sd0JBQXdCLENBQUM7QUFDN0QsWUFBTTtBQUNOLGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBQzFGLGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBQzFGLGFBQU8sWUFBWSxRQUFRLGlCQUFpQixlQUFlLENBQUM7QUFDNUQsYUFBTyxZQUFZLFFBQVEsS0FBSyxRQUFRLFFBQVEsSUFBSTtBQUNwRCxhQUFPLFlBQVksUUFBUSxLQUFLLFVBQVUsYUFBYSxFQUFFO0FBQ3pELGFBQU8sWUFBWSxRQUFRLEtBQUssb0JBQW9CLEtBQUs7QUFBQSxJQUMxRCxVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDBHQUEwRyxZQUFZO0FBQzFILFVBQU0sVUFBVSxnQ0FBZ0M7QUFDaEQsUUFBSTtBQUNILFlBQU0sUUFBUSw0QkFBNEIsUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUNuRSxZQUFNLFFBQVE7QUFDZCxjQUFRLHNCQUFzQjtBQUM5QixjQUFRLGtCQUFrQixJQUFJO0FBQzlCLGNBQVEsa0JBQWtCLEVBQUUsSUFBSSxLQUFLLENBQUM7QUFDdEMsWUFBTTtBQUNOLGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBQzFGLGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBQzFGLGFBQU8sWUFBWSxRQUFRLGlCQUFpQixlQUFlLENBQUM7QUFDNUQsYUFBTyxZQUFZLFFBQVEsS0FBSyxRQUFRLFFBQVEsSUFBSTtBQUNwRCxhQUFPLFlBQVksUUFBUSxLQUFLLFVBQVUsYUFBYSxFQUFFO0FBQUEsSUFDMUQsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxxRkFBcUYsWUFBWTtBQUNyRyxVQUFNLFVBQVUsZ0NBQWdDO0FBQ2hELFFBQUk7QUFDSCxjQUFRLHNCQUFzQjtBQUM5QixhQUFPLFlBQVksUUFBUSxpQkFBaUIsZUFBZSxDQUFDO0FBQzVELFlBQU0sUUFBUSw0QkFBNEIsUUFBUSxNQUFNLFVBQVUsQ0FBQztBQUNuRSxZQUFNLFFBQVE7QUFDZCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLFFBQVEsR0FBRyxpQkFBaUIsQ0FBQztBQUMxRixhQUFPLFlBQVksUUFBUSxpQkFBaUIsZUFBZSxDQUFDO0FBQzVELGNBQVEsa0JBQWtCLEVBQUUsSUFBSSxLQUFLLENBQUM7QUFDdEMsWUFBTTtBQUNOLGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBQzFGLGFBQU8sWUFBWSxRQUFRLEtBQUsseUJBQXlCLElBQUksUUFBUSxHQUFHLGlCQUFpQixDQUFDO0FBQzFGLGFBQU8sWUFBWSxRQUFRLGlCQUFpQixlQUFlLENBQUM7QUFDNUQsYUFBTyxZQUFZLFFBQVEsS0FBSyxRQUFRLFFBQVEsSUFBSTtBQUFBLElBQ3JELFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssd0ZBQXdGLFlBQVk7QUFDeEcsVUFBTSxVQUFVLG9DQUFvQztBQUFBLE1BQ25ELGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxRQUFJO0FBQ0gsWUFBTSxlQUFlLFFBQVEsS0FBSztBQUdsQyxtQkFBYSxvQkFBb0IsYUFBYSxFQUFFLElBQUksT0FBTyxTQUFTLHlCQUF5QjtBQUM3RixZQUFNLDRCQUE0QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDbEUsYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUNqRyxhQUFPLFlBQVksUUFBUSxLQUFLLFFBQVEsUUFBUSxLQUFLO0FBQ3JELGFBQU8sR0FBRyxRQUFRLEtBQUssVUFBVSxhQUFhLFNBQVMsd0JBQXdCLENBQUM7QUFDaEYsYUFBTyxZQUFZLFFBQVEsS0FBSyxvQkFBb0IsSUFBSTtBQUFBLElBQ3pELFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMkVBQTJFLFlBQVk7QUFDM0YsVUFBTSxVQUFVLG9DQUFvQztBQUFBLE1BQ25ELGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFDRCxRQUFJO0FBQ0gsVUFBSTtBQUNKLFVBQUk7QUFDSixZQUFNLGdCQUFnQixJQUFJLFFBQWMsYUFBVztBQUFFLHdCQUFnQjtBQUFBLE1BQVMsQ0FBQztBQUMvRSxZQUFNLGFBQWEsSUFBSSxRQUFzQixhQUFXO0FBQUUsd0JBQWdCO0FBQUEsTUFBUyxDQUFDO0FBQ3BGLFVBQUksUUFBUTtBQUNaLFlBQU0sZUFBZSxRQUFRLEtBQUs7QUFHbEMsbUJBQWEsb0JBQW9CLE9BQU0sWUFBVztBQUNqRCxnQkFBUSxnQkFBZ0IsS0FBSyxPQUFPO0FBQ3BDO0FBQ0EsWUFBSSxVQUFVLEdBQUc7QUFDaEIsMEJBQWdCO0FBQ2hCLGlCQUFPO0FBQUEsUUFDUjtBQUNBLGVBQU8sRUFBRSxJQUFJLEtBQUs7QUFBQSxNQUNuQjtBQUNBLFlBQU0sU0FBUyw0QkFBNEIsUUFBUSxNQUFNLGlCQUFpQixDQUFDO0FBQzNFLFlBQU07QUFDTixZQUFNLE1BQU0sNEJBQTRCLFFBQVEsTUFBTSxpQkFBaUIsQ0FBQztBQUN4RSxhQUFPLFlBQVksUUFBUSxpQkFBaUIsZUFBZSxDQUFDO0FBQzVELGFBQU8sWUFBWSxRQUFRLGdCQUFnQixRQUFRLENBQUM7QUFDcEQsb0JBQWUsRUFBRSxJQUFJLEtBQUssQ0FBQztBQUMzQixZQUFNO0FBQ04sWUFBTTtBQUNOLGFBQU8sWUFBWSxRQUFRLGlCQUFpQixlQUFlLENBQUM7QUFDNUQsYUFBTyxZQUFZLFFBQVEsS0FBSyx5QkFBeUIsSUFBSSxlQUFlLEdBQUcsaUJBQWlCLENBQUM7QUFDakcsYUFBTyxnQkFBZ0IsUUFBUSxnQkFBZ0IsSUFBSSxVQUFRLEtBQUssSUFBSSxHQUFHO0FBQUEsUUFDdEU7QUFBQSxRQUNBO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG1HQUFtRyxZQUFZO0FBQ25ILFVBQU0sVUFBVSxvQ0FBb0M7QUFBQSxNQUNuRCxnQkFBZ0I7QUFBQSxNQUNoQixvQkFBb0I7QUFBQSxJQUNyQixDQUFDO0FBQ0QsUUFBSTtBQUNILFVBQUk7QUFDSixVQUFJO0FBQ0osWUFBTSxlQUFlLElBQUksUUFBYyxhQUFXO0FBQUUsdUJBQWU7QUFBQSxNQUFTLENBQUM7QUFDN0UsWUFBTSxZQUFZLElBQUksUUFBMkMsYUFBVztBQUFFLHVCQUFlO0FBQUEsTUFBUyxDQUFDO0FBQ3ZHLFVBQUk7QUFDSixVQUFJO0FBQ0osWUFBTSxnQkFBZ0IsSUFBSSxRQUFjLGFBQVc7QUFBRSx3QkFBZ0I7QUFBQSxNQUFTLENBQUM7QUFDL0UsWUFBTSxhQUFhLElBQUksUUFBMkMsYUFBVztBQUFFLHdCQUFnQjtBQUFBLE1BQVMsQ0FBQztBQUN6RyxVQUFJLFFBQVE7QUFDWixZQUFNLGVBQWUsUUFBUSxLQUFLO0FBR2xDLG1CQUFhLG9CQUFvQixPQUFNLFlBQVc7QUFDakQsZ0JBQVEsZ0JBQWdCLEtBQUssT0FBTztBQUNwQztBQUNBLFlBQUksVUFBVSxHQUFHO0FBQ2hCLHlCQUFlO0FBQ2YsaUJBQU87QUFBQSxRQUNSO0FBQ0Esd0JBQWdCO0FBQ2hCLGVBQU87QUFBQSxNQUNSO0FBQ0EsWUFBTSxTQUFTLDRCQUE0QixRQUFRLE1BQU0saUJBQWlCLENBQUM7QUFDM0UsWUFBTTtBQUNOLFlBQU0sUUFBUSw0QkFBNEIsUUFBUSxNQUFNLGlCQUFpQixDQUFDO0FBQzFFLG1CQUFjLEVBQUUsSUFBSSxPQUFPLFNBQVMsc0JBQXNCLENBQUM7QUFDM0QsWUFBTTtBQUNOLGFBQU8sWUFBWSxRQUFRLGlCQUFpQixlQUFlLENBQUM7QUFDNUQsYUFBTyxZQUFZLFFBQVEsS0FBSyx5QkFBeUIsSUFBSSxlQUFlLEdBQUcsaUJBQWlCLENBQUM7QUFHakcsYUFBTyxZQUFZLFFBQVEsS0FBSyxvQkFBb0IsS0FBSztBQUN6RCxhQUFPLFlBQVksUUFBUSxLQUFLLFVBQVUsYUFBYSxFQUFFO0FBQ3pELG9CQUFlLEVBQUUsSUFBSSxPQUFPLFNBQVMsZUFBZSxDQUFDO0FBQ3JELFlBQU07QUFDTixZQUFNO0FBR04sYUFBTyxZQUFZLFFBQVEsaUJBQWlCLGVBQWUsQ0FBQztBQUM1RCxhQUFPLFlBQVksUUFBUSxLQUFLLHlCQUF5QixJQUFJLGVBQWUsR0FBRyxpQkFBaUIsQ0FBQztBQUNqRyxhQUFPLGdCQUFnQixRQUFRLGdCQUFnQixJQUFJLFVBQVEsS0FBSyxJQUFJLEdBQUc7QUFBQSxRQUN0RTtBQUFBLFFBQ0E7QUFBQSxNQUNELENBQUM7QUFDRCxhQUFPLFlBQVksUUFBUSxLQUFLLFFBQVEsUUFBUSxLQUFLO0FBQ3JELGFBQU8sWUFBWSxRQUFRLEtBQUssb0JBQW9CLElBQUk7QUFDeEQsYUFBTyxHQUFHLFFBQVEsS0FBSyxVQUFVLGFBQWEsU0FBUyxjQUFjLENBQUM7QUFBQSxJQUN2RSxVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLCtFQUErRSxNQUFNO0FBQ3pGLFVBQU0sVUFBVSxvQ0FBb0MsRUFBRSxrQkFBa0IsQ0FBQyxRQUFRLE1BQU0sRUFBRSxDQUFDO0FBQzFGLFFBQUk7QUFDSCxhQUFPLFlBQVksUUFBUSxLQUFLLFlBQVksa0JBQWtCLEdBQUcsSUFBSTtBQUNyRSw0QkFBc0IsUUFBUSxJQUFJO0FBQ2xDLFlBQU0sUUFBUSxTQUFTLGNBQWMsb0NBQW9DO0FBQ3pFLGFBQU8sR0FBRyxLQUFLO0FBQ2YsYUFBTyxHQUFHLE1BQU0sYUFBYSxTQUFTLE1BQU0sQ0FBQztBQUM3QyxhQUFPLEdBQUcsTUFBTSxhQUFhLFNBQVMsTUFBTSxDQUFDO0FBQzdDLGFBQU8sR0FBRyxNQUFNLGNBQWMsbUNBQW1DLENBQUM7QUFDbEUsYUFBTyxZQUFZLE1BQU0sY0FBYyxxQ0FBcUMsR0FBRyxJQUFJO0FBQ25GLGFBQU8sR0FBRyxDQUFDLE1BQU0sYUFBYSxTQUFTLDJCQUEyQixDQUFDO0FBQ25FLGFBQU8sR0FBRyxDQUFDLE1BQU0sYUFBYSxTQUFTLGlDQUFpQyxDQUFDO0FBQUEsSUFDMUUsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxnRkFBZ0YsTUFBTTtBQUMxRixVQUFNLFVBQVUsb0NBQW9DLEVBQUUsa0JBQWtCLENBQUMsUUFBUSxNQUFNLEVBQUUsQ0FBQztBQUMxRixVQUFNLFVBQVUsU0FBUyxjQUFjLEtBQUs7QUFDNUMsYUFBUyxLQUFLLFlBQVksT0FBTztBQUNqQyxRQUFJO0FBQ0gsWUFBTSxjQUFjLFFBQVE7QUFDNUIsWUFBTSxXQUFXLFlBQVk7QUFDN0IsVUFBSTtBQUNKLGtCQUFZLHFCQUFxQjtBQUFBLFFBQ2hDLGdCQUFnQixHQUFHO0FBQ2xCLHFCQUFXO0FBQ1gsaUJBQU8sU0FBUyxnQkFBZ0IsQ0FBQztBQUFBLFFBQ2xDO0FBQUEsTUFDRDtBQUNBLDRCQUFzQixRQUFRLElBQUk7QUFDbEMsYUFBTyxHQUFHLFNBQVMsY0FBYyxvQ0FBb0MsQ0FBQztBQUN0RSxhQUFPLEdBQUcsVUFBVSxVQUFVO0FBRzlCLGNBQVEsaUJBQWlCLFNBQVMsT0FBSyxTQUFVLFdBQVksSUFBSSxtQkFBbUIsWUFBWSxDQUFDLENBQUMsQ0FBQztBQUNuRyxjQUFRLE1BQU07QUFDZCxhQUFPLFlBQVksU0FBUyxjQUFjLG9DQUFvQyxHQUFHLElBQUk7QUFBQSxJQUN0RixVQUFFO0FBQ0QsY0FBUSxPQUFPO0FBQ2YsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGdGQUFnRixNQUFNO0FBQzFGLFVBQU0sUUFBUSxDQUFDLEdBQUcsTUFBTSxLQUFLLEVBQUUsUUFBUSxHQUFHLEdBQUcsQ0FBQyxHQUFHLFVBQVUsUUFBUSxLQUFLLEVBQUUsR0FBRyxhQUFhO0FBQzFGLFVBQU0sVUFBVSxvQ0FBb0MsRUFBRSxrQkFBa0IsTUFBTSxDQUFDO0FBQy9FLFFBQUk7QUFDSCw0QkFBc0IsUUFBUSxJQUFJO0FBQ2xDLFlBQU0sUUFBUSxTQUFTLGNBQWMsb0NBQW9DO0FBQ3pFLGFBQU8sR0FBRyxLQUFLO0FBQ2YsWUFBTSxPQUFPLE1BQU0sY0FBYyxtQ0FBbUM7QUFDcEUsWUFBTSxPQUFPLE1BQU0sY0FBYyxtQ0FBbUM7QUFDcEUsYUFBTyxHQUFHLElBQUk7QUFDZCxhQUFPLEdBQUcsSUFBSTtBQUNkLGFBQU8sR0FBRyxLQUFLLHdCQUF3QixJQUFJLElBQUksS0FBSywyQkFBMkI7QUFDL0UsYUFBTyxZQUFZLE1BQU0saUJBQWlCLG1DQUFtQyxFQUFFLFFBQVEsTUFBTSxNQUFNO0FBQ25HLFlBQU0sU0FBUyxNQUFNLGNBQWMscUNBQXFDO0FBQ3hFLGFBQU8sR0FBRyxNQUFNO0FBQ2hCLGFBQU8sUUFBUTtBQUNmLGFBQU8sY0FBYyxJQUFJLE9BQU8sY0FBYyxZQUFhLE1BQU0sU0FBUyxFQUFFLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFDNUYsWUFBTSxVQUFVLENBQUMsR0FBRyxNQUFNLGlCQUFpQixtQ0FBbUMsQ0FBQyxFQUFFLE9BQU8sU0FBTyxDQUFFLElBQW9CLE1BQU07QUFDM0gsYUFBTyxnQkFBZ0IsUUFBUSxJQUFJLFNBQU8sSUFBSSxXQUFXLEdBQUcsQ0FBQyxhQUFhLENBQUM7QUFFM0UsWUFBTSxPQUFPLE1BQU0sY0FBYyxtQ0FBbUM7QUFDcEUsV0FBSyxNQUFNO0FBQ1gsYUFBTyxnQkFBZ0IsUUFBUSxrQkFBa0IsQ0FBQztBQUFBLFFBQ2pELElBQUk7QUFBQSxRQUNKLE1BQU0sQ0FBQyxpQkFBaUI7QUFBQSxNQUN6QixDQUFDLENBQUM7QUFDRixhQUFPLFlBQVksU0FBUyxjQUFjLG9DQUFvQyxHQUFHLElBQUk7QUFBQSxJQUN0RixVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHFGQUFxRixNQUFNO0FBQy9GLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLEVBQUUsTUFBTSxPQUFPLElBQUksNkJBQTZCLFFBQVE7QUFDOUQsUUFBSSxjQUFjO0FBQ2xCLElBQUMsS0FBdUUsWUFBWSxpQkFBaUIsTUFBTTtBQUMxRztBQUNBLGFBQU87QUFBQSxJQUNSO0FBQ0EsbUJBQWUsTUFBTSxFQUFFLElBQUksU0FBUyxZQUFZLFFBQVEsU0FBUyxRQUFRLENBQUM7QUFDMUUsV0FBTyxZQUFZLGFBQWEsQ0FBQztBQUNqQyxXQUFPLFlBQVksUUFBUSxDQUFDO0FBQzVCLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQztBQUFBLEVBQ3pELENBQUM7QUFFRCxPQUFLLHVGQUF1RixZQUFZO0FBQ3ZHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLGFBQXdCLENBQUM7QUFDL0IsVUFBTSxjQUFjLENBQUMsV0FBb0I7QUFBRSxpQkFBVyxLQUFLLE1BQU07QUFBQSxJQUFHO0FBQ3BFLFVBQU0sT0FBTztBQUFBLE1BQ1osZ0JBQWdCO0FBQUEsTUFDaEIsZ0JBQWdCO0FBQUEsTUFDaEIsb0JBQW9CO0FBQUEsTUFDcEIsY0FBYyxFQUFFLE9BQU8sUUFBUTtBQUFBLE1BQy9CLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLE1BQU07QUFBQSxRQUN6Qiw0QkFBNEIsTUFBTTtBQUFBLE1BQ25DO0FBQUEsTUFDQSxrQkFBa0I7QUFBQSxRQUNqQixNQUFNLFlBQVk7QUFDakIsZ0JBQU0sSUFBSSxNQUFNLGdCQUFnQjtBQUFBLFFBQ2pDO0FBQUEsTUFDRDtBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBRUEsWUFBUSxHQUFHLHNCQUFzQixXQUFXO0FBQzVDLFFBQUk7QUFDSCxXQUFLLFlBQVksSUFBSTtBQUNyQixZQUFNLElBQUksUUFBYyxhQUFXLGVBQWUsTUFBTSxRQUFRLENBQUMsQ0FBQztBQUNsRSxZQUFNLElBQUksUUFBYyxhQUFXLGFBQWEsTUFBTSxRQUFRLENBQUMsQ0FBQztBQUNoRSxhQUFPLGdCQUFnQixVQUFVLENBQUMsUUFBUSxDQUFDO0FBQzNDLGFBQU8sZ0JBQWdCLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLGFBQU8sWUFBWSxLQUFLLGdCQUFnQixLQUFLO0FBQUEsSUFDOUMsVUFBRTtBQUNELGNBQVEsSUFBSSxzQkFBc0IsV0FBVztBQUFBLElBQzlDO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx1SEFBdUgsWUFBWTtBQUN2SSxVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxVQUFVLGtDQUFrQyxTQUFTO0FBQzNELFFBQUk7QUFDSCxjQUFRLEtBQUssYUFBYSxRQUFRO0FBQ2xDLGNBQVEsS0FBSyxXQUFXLFVBQVU7QUFDbEMsWUFBTSxpQ0FBaUMsV0FBVyxNQUFNO0FBQ3ZELGdCQUFRLEtBQUssV0FBVyxRQUFRLE1BQU07QUFBQSxNQUN2QyxDQUFDO0FBQUEsSUFDRixVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHNFQUFzRSxZQUFZO0FBQ3RGLFFBQUksUUFBUTtBQUNaLFVBQU0sVUFBVSxvQkFBb0IsWUFBWTtBQUMvQztBQUFBLElBQ0QsQ0FBQztBQUNELFFBQUk7QUFDSCxjQUFRLEtBQUssYUFBYSxRQUFRO0FBQ2xDLGNBQVEsS0FBSyxXQUFXLFVBQVU7QUFDbEMsY0FBUSxLQUFLLFdBQVcsUUFBUSxNQUFNO0FBQ3RDLGFBQU8sWUFBWSxPQUFPLEdBQUcseUNBQXlDO0FBRXRFLGNBQVE7QUFDUixjQUFRLEtBQUssV0FBVyxVQUFVO0FBQ2xDLGNBQVEsS0FBSyxXQUFXLFFBQVEsTUFBTTtBQUN0QyxhQUFPLFlBQVksT0FBTyxHQUFHLGlDQUFpQztBQUFBLElBQy9ELFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssOEVBQThFLFlBQVk7QUFDOUYsVUFBTSxTQUFtQixDQUFDO0FBQzFCLFVBQU0sVUFBb0IsQ0FBQztBQUMzQixVQUFNLFVBQVUsb0JBQW9CLFlBQVk7QUFBQSxJQUFFLENBQUM7QUFDbkQsVUFBTSxPQUFPLFFBQVE7QUFNckIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxnQkFBZ0I7QUFDckIsU0FBSyx1QkFBdUI7QUFDNUIsU0FBSyxxQkFBcUI7QUFDMUIsU0FBSyxrQkFBa0IsQ0FBQyxFQUFFO0FBQzFCLFNBQUssaUJBQWlCO0FBQ3RCLFNBQUssY0FBYztBQUFBLE1BQ2xCLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsc0JBQXNCLE1BQU07QUFBQSxNQUM1Qiw0QkFBNEIsTUFBTTtBQUFBLE1BQ2xDLFVBQVUsTUFBTSxDQUFDLEVBQUUsSUFBSSxNQUFNLE1BQU0sUUFBUSxNQUFNLFlBQVksUUFBUSxLQUFLLENBQUM7QUFBQSxNQUMzRSxvQkFBb0IsQ0FBQyxZQUFvQixTQUFpQixTQUFpQjtBQUMxRSxnQkFBUSxLQUFLLElBQUk7QUFDakIsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQ0EsU0FBSyxlQUFlO0FBQUEsTUFDbkIsb0JBQW9CLE9BQU8sRUFBRSxNQUFNLGFBQWEsTUFBTSxXQUFXO0FBQUEsTUFDakUsdUJBQXVCLE9BQU8sRUFBRSxnQkFBZ0IsTUFBTTtBQUFBLElBQ3ZEO0FBQ0EsU0FBSyxtQkFBbUI7QUFBQSxNQUN2QixNQUFNLE9BQU8sUUFBa0M7QUFDOUMsZUFBTyxLQUFLLElBQUksU0FBUyxnQkFBZ0IsSUFBSSxPQUFPLEVBQUU7QUFDdEQsZUFBTyxFQUFFLFVBQVUsTUFBZSxhQUFhLEVBQUUsSUFBSSxTQUFTLEVBQUU7QUFBQSxNQUNqRTtBQUFBLElBQ0Q7QUFDQSxTQUFLLG1CQUFtQixNQUFNO0FBQzdCLFdBQUssaUJBQWlCO0FBQ3RCLFdBQUssZ0JBQWdCO0FBQ3JCLFdBQUssYUFBYSxRQUFRLEtBQUs7QUFBQSxJQUNoQztBQUNBLFNBQUssMEJBQTBCLE1BQU07QUFBQSxJQUFFO0FBQ3ZDLFNBQUssb0JBQW9CLE1BQU0sS0FBSztBQUNwQyxTQUFLLGtCQUFrQixNQUFNO0FBQUEsSUFBRTtBQUMvQixTQUFLLGNBQWMsTUFBTSxZQUFZLElBQUk7QUFDekMsUUFBSTtBQUNILFdBQUssYUFBYSxRQUFRO0FBQzFCLFdBQUssV0FBVyxVQUFVO0FBQzFCLFdBQUssV0FBVyxRQUFRLE1BQU07QUFDOUIsWUFBTSxRQUFRLFFBQVE7QUFDdEIsWUFBTSxRQUFRLFFBQVE7QUFDdEIsYUFBTyxnQkFBZ0IsU0FBUyxDQUFDLFFBQVEsQ0FBQztBQUMxQyxhQUFPLGdCQUFnQixRQUFRLENBQUMsQ0FBQztBQUNqQyxhQUFPLFlBQVksS0FBSyxhQUFhLE9BQU8sZ0JBQWdCO0FBQUEsSUFDN0QsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw2REFBNkQsWUFBWTtBQUM3RSxRQUFJLFFBQVE7QUFDWixVQUFNLFVBQVUsb0JBQW9CLFlBQVk7QUFDL0M7QUFBQSxJQUNELENBQUM7QUFDRCxRQUFJO0FBQ0gsWUFBTSxPQUFPLFFBQVE7QUFDckIsV0FBSyxhQUFhLFFBQVE7QUFDMUIsWUFBTSxnQkFBZ0IsS0FBSyxXQUFXLFFBQVE7QUFDOUMsYUFBTyxHQUFHLGFBQWE7QUFFdkIsV0FBSyxXQUFXLFVBQVU7QUFDMUIsb0JBQWMsY0FBYyxJQUFJLFdBQVcsU0FBUyxFQUFFLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFDdEUsYUFBTyxZQUFZLE9BQU8sR0FBRyx5Q0FBeUM7QUFFdEUsV0FBSyxXQUFXLFVBQVU7QUFDMUIsb0JBQWMsY0FBYyxJQUFJLFdBQVcsU0FBUyxFQUFFLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFDdEUsYUFBTyxZQUFZLE9BQU8sR0FBRyxxREFBcUQ7QUFFbEYsY0FBUTtBQUNSLFdBQUssb0JBQW9CLFFBQVEsTUFBTTtBQUN2QyxXQUFLLFdBQVcsUUFBUSxNQUFNO0FBQzlCLFdBQUssV0FBVyxRQUFRLE1BQU07QUFDOUIsV0FBSyxtQkFBbUIsUUFBUSxNQUFNO0FBQ3RDLFdBQUssYUFBYSxjQUFjLElBQUksV0FBVyxTQUFTLEVBQUUsU0FBUyxLQUFLLENBQUMsQ0FBQztBQUMxRSxZQUFNLFlBQVksS0FBSyxTQUFTLGNBQWMsb0NBQW9DO0FBQ2xGLGFBQU8sR0FBRyxTQUFTO0FBQ25CLGdCQUFVLGNBQWMsSUFBSSxXQUFXLFNBQVMsRUFBRSxTQUFTLEtBQUssQ0FBQyxDQUFDO0FBQ2xFLFlBQU0sUUFBUSxLQUFLLFNBQVMsY0FBYywrQkFBK0I7QUFDekUsYUFBTyxHQUFHLEtBQUs7QUFDZixZQUFNLGNBQWMsSUFBSSxXQUFXLFNBQVMsRUFBRSxTQUFTLEtBQUssQ0FBQyxDQUFDO0FBQzlELGFBQU8sWUFBWSxPQUFPLEdBQUcsdUNBQXVDO0FBQUEsSUFDckUsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw2RUFBNkUsWUFBWTtBQUM3RixVQUFNLFNBQW1CLENBQUM7QUFDMUIsVUFBTSxVQUFvQixDQUFDO0FBQzNCLFVBQU0sVUFBVSxvQkFBb0IsWUFBWTtBQUFBLElBQUUsQ0FBQztBQUNuRCxVQUFNLE9BQU8sUUFBUTtBQU1yQixTQUFLLHFCQUFxQjtBQUMxQixTQUFLLGtCQUFrQixDQUFDLEVBQUU7QUFDMUIsU0FBSyxpQkFBaUI7QUFDdEIsU0FBSyxjQUFjO0FBQUEsTUFDbEIsbUJBQW1CLE1BQU07QUFBQSxNQUN6QixzQkFBc0IsTUFBTTtBQUFBLE1BQzVCLDRCQUE0QixNQUFNO0FBQUEsTUFDbEMsVUFBVSxNQUFNLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sWUFBWSxRQUFRLEtBQUssQ0FBQztBQUFBLE1BQzNFLG9CQUFvQixDQUFDLFlBQW9CLFNBQWlCLFNBQWlCO0FBQzFFLGdCQUFRLEtBQUssSUFBSTtBQUNqQixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFDQSxTQUFLLGVBQWU7QUFBQSxNQUNuQixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxNQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixNQUFNO0FBQUEsSUFDdkQ7QUFDQSxTQUFLLG1CQUFtQjtBQUFBLE1BQ3ZCLE1BQU0sT0FBTyxRQUFrQztBQUM5QyxlQUFPLEtBQUssSUFBSSxTQUFTLGdCQUFnQixJQUFJLE9BQU8sRUFBRTtBQUN0RCxlQUFPLEVBQUUsVUFBVSxNQUFlLGFBQWEsRUFBRSxJQUFJLFNBQVMsRUFBRTtBQUFBLE1BQ2pFO0FBQUEsSUFDRDtBQUNBLFNBQUssbUJBQW1CLE1BQU07QUFDN0IsV0FBSyxpQkFBaUI7QUFDdEIsV0FBSyxnQkFBZ0I7QUFDckIsV0FBSyxhQUFhLFFBQVEsS0FBSztBQUFBLElBQ2hDO0FBQ0EsU0FBSywwQkFBMEIsTUFBTTtBQUFBLElBQUU7QUFDdkMsU0FBSyxvQkFBb0IsTUFBTSxLQUFLO0FBQ3BDLFNBQUssa0JBQWtCLE1BQU07QUFBQSxJQUFFO0FBQy9CLFNBQUssY0FBYyxNQUFNLFlBQVksSUFBSTtBQUN6QyxVQUFNLGdCQUFnQixLQUFLLFdBQVcsUUFBUTtBQUM5QyxXQUFPLEdBQUcsYUFBYTtBQUN2QixVQUFNLGNBQWMsTUFBTTtBQUN6QixXQUFLLGlCQUFpQjtBQUN0QixXQUFLLGdCQUFnQjtBQUNyQixXQUFLLHVCQUF1QjtBQUM1QixXQUFLLGFBQWEsUUFBUTtBQUFBLElBQzNCO0FBQ0EsUUFBSTtBQUNILGtCQUFZO0FBQ1osV0FBSyxXQUFXLFVBQVU7QUFDMUIsb0JBQWMsY0FBYyxJQUFJLFdBQVcsU0FBUyxFQUFFLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFDdEUsWUFBTSxRQUFRLFFBQVE7QUFDdEIsWUFBTSxRQUFRLFFBQVE7QUFDdEIsYUFBTyxnQkFBZ0IsU0FBUyxDQUFDLFFBQVEsQ0FBQztBQUMxQyxhQUFPLGdCQUFnQixRQUFRLENBQUMsQ0FBQztBQUNqQyxhQUFPLFlBQVksS0FBSyxhQUFhLE9BQU8sZ0JBQWdCO0FBRTVELGNBQVEsU0FBUztBQUNqQixhQUFPLFNBQVM7QUFDaEIsa0JBQVk7QUFDWixXQUFLLFdBQVcsVUFBVTtBQUMxQixvQkFBYyxjQUFjLElBQUksV0FBVyxTQUFTLEVBQUUsU0FBUyxLQUFLLENBQUMsQ0FBQztBQUN0RSxZQUFNLFFBQVEsUUFBUTtBQUN0QixZQUFNLFFBQVEsUUFBUTtBQUN0QixhQUFPLGdCQUFnQixTQUFTLENBQUMsQ0FBQztBQUNsQyxhQUFPLGdCQUFnQixRQUFRLENBQUMsQ0FBQztBQUNqQyxhQUFPLFlBQVksS0FBSyxnQkFBZ0IsVUFBVTtBQUNsRCxhQUFPLFlBQVksS0FBSyxhQUFhLE9BQU8sUUFBUTtBQUFBLElBQ3JELFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMEhBQTBILFlBQVk7QUFDMUksVUFBTSxZQUFZLElBQUksTUFBTSxZQUFZO0FBQ3hDLFVBQU0sVUFBVSxrQ0FBa0MsU0FBUztBQUMzRCxRQUFJO0FBQ0gsY0FBUSxLQUFLLGFBQWEsUUFBUTtBQUNsQyxjQUFRLEtBQUssV0FBVyxVQUFVO0FBQ2xDLFlBQU0sZ0JBQWdCLFFBQVEsS0FBSyxXQUFXLFFBQVE7QUFDdEQsYUFBTyxHQUFHLGFBQWE7QUFDdkIsWUFBTSxpQ0FBaUMsV0FBVyxNQUFNO0FBQ3ZELHNCQUFjLGNBQWMsSUFBSSxXQUFXLFNBQVMsRUFBRSxTQUFTLEtBQUssQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0YsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxrSEFBa0gsWUFBWTtBQUNsSSxVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxVQUFVLGtDQUFrQyxTQUFTO0FBQzNELFFBQUk7QUFDSCxZQUFNLGlDQUFpQyxXQUFXLE1BQU07QUFDdkQsZ0JBQVEsS0FBSyxhQUFhLGNBQWMsSUFBSSxjQUFjLFdBQVc7QUFBQSxVQUNwRSxTQUFTO0FBQUEsVUFDVCxTQUFTO0FBQUEsVUFDVCxZQUFZO0FBQUEsUUFDYixDQUFDLENBQUM7QUFBQSxNQUNILENBQUM7QUFBQSxJQUNGLFVBQUU7QUFDRCxjQUFRLFFBQVE7QUFBQSxJQUNqQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsseUVBQXlFLFlBQVk7QUFDekYsVUFBTSxTQUFTLE1BQU0sa0JBQWtCLEdBQUcsUUFBUSxJQUFJLENBQUMsd0VBQXdFO0FBQy9ILFVBQU0sY0FBYztBQUNwQixVQUFNLGtCQUFrQiwwQkFBMEIsV0FBVztBQUM3RCxXQUFPLFlBQVksT0FBTyxNQUFNLGVBQWUsRUFBRSxTQUFTLEdBQUcsQ0FBQztBQUM5RCxXQUFPLEdBQUcsQ0FBQyxPQUFPLFNBQVMsMEJBQTBCLENBQUM7QUFDdEQsV0FBTyxHQUFHLENBQUMsT0FBTyxTQUFTLGdDQUFnQyxDQUFDO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUssd0pBQXdKLFlBQVk7QUFDeEssVUFBTSxZQUFZLElBQUksTUFBTSxZQUFZO0FBQ3hDLFVBQU0sVUFBVSx5Q0FBeUMsU0FBUztBQUNsRSxRQUFJO0FBQ0gsWUFBTSxpQ0FBaUMsV0FBVyxNQUFNO0FBQ3ZELGdCQUFRLHFCQUFxQixDQUFDO0FBQUEsTUFDL0IsQ0FBQztBQUFBLElBQ0YsVUFBRTtBQUNELGNBQVEsUUFBUTtBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyw4SUFBOEksWUFBWTtBQUM5SixVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxVQUFVLHlDQUF5QyxTQUFTO0FBQ2xFLFFBQUk7QUFDSCxZQUFNLGlDQUFpQyxXQUFXLE1BQU07QUFDdkQsZ0JBQVEsZ0JBQWdCLENBQUM7QUFBQSxNQUMxQixDQUFDO0FBQUEsSUFDRixVQUFFO0FBQ0QsY0FBUSxRQUFRO0FBQUEsSUFDakI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDBFQUEwRSxZQUFZO0FBQzFGLFVBQU0sU0FBUyxNQUFNLGtCQUFrQixHQUFHLFFBQVEsSUFBSSxDQUFDLHdFQUF3RTtBQUMvSCxVQUFNLGNBQWM7QUFDcEIsV0FBTyxHQUFHLE9BQU8sU0FBUyw0RUFBNEUsV0FBVyxFQUFFLENBQUM7QUFDcEgsV0FBTyxHQUFHLE9BQU8sU0FBUyx1RUFBdUUsV0FBVyxFQUFFLENBQUM7QUFDL0csV0FBTyxHQUFHLENBQUMsT0FBTyxTQUFTLDRFQUE0RSxDQUFDO0FBQ3hHLFdBQU8sR0FBRyxDQUFDLE9BQU8sU0FBUyx1RUFBdUUsQ0FBQztBQUFBLEVBQ3BHLENBQUM7QUFFRCxPQUFLLDBGQUEwRixNQUFNO0FBQ3BHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxRQUFJLFNBQVM7QUFDYixVQUFNLE9BQU87QUFBQSxNQUNaLGdCQUFnQjtBQUFBLE1BQ2hCLGVBQWU7QUFBQSxNQUNmLGNBQWMsRUFBRSxPQUFPLGdCQUFnQjtBQUFBLE1BQ3ZDLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsYUFBYTtBQUFBLFFBQ1osb0JBQW9CLE1BQU07QUFBQSxRQUMxQixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLDRCQUE0QixNQUFNO0FBQUEsUUFDbEMsVUFBVSxNQUFNLENBQUM7QUFBQSxNQUNsQjtBQUFBLE1BQ0Esa0JBQWtCLE1BQU07QUFBRTtBQUFBLE1BQVU7QUFBQSxNQUNwQyxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxpQkFBYSxJQUFJO0FBRWpCLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQztBQUN4RCxXQUFPLFlBQVksUUFBUSxDQUFDO0FBQzVCLFdBQU8sWUFBWSxLQUFLLGVBQWUsUUFBUTtBQUMvQyxXQUFPLFlBQVksS0FBSyxnQkFBZ0IsVUFBVTtBQUNsRCxXQUFPLFlBQVksS0FBSyxhQUFhLE9BQU8sZUFBZTtBQUFBLEVBQzVELENBQUM7QUFFRCxPQUFLLHVGQUF1RixNQUFNO0FBQ2pHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxRQUFJLFNBQVM7QUFDYixVQUFNLE9BQU87QUFBQSxNQUNaLGdCQUFnQjtBQUFBLE1BQ2hCLGVBQWU7QUFBQSxNQUNmLGNBQWMsRUFBRSxPQUFPLGdCQUFnQjtBQUFBLE1BQ3ZDLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsYUFBYTtBQUFBLFFBQ1osb0JBQW9CLE1BQU07QUFBQSxRQUMxQixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLDRCQUE0QixNQUFNO0FBQUEsUUFDbEMsVUFBVSxNQUFNLENBQUM7QUFBQSxNQUNsQjtBQUFBLE1BQ0Esa0JBQWtCLE1BQU07QUFBRTtBQUFBLE1BQVU7QUFBQSxNQUNwQyxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxpQkFBYSxJQUFJO0FBRWpCLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFDM0MsV0FBTyxZQUFZLFFBQVEsQ0FBQztBQUM1QixXQUFPLFlBQVksS0FBSyxlQUFlLFFBQVE7QUFDL0MsV0FBTyxZQUFZLEtBQUssZ0JBQWdCLFVBQVU7QUFBQSxFQUNuRCxDQUFDO0FBRUQsT0FBSyxzRUFBc0UsTUFBTTtBQUNoRixVQUFNLFdBQW9ELENBQUM7QUFDM0QsUUFBSSxTQUFTO0FBQ2IsVUFBTSxPQUFPO0FBQUEsTUFDWixnQkFBZ0I7QUFBQSxNQUNoQixlQUFlO0FBQUEsTUFDZixjQUFjLEVBQUUsT0FBTyxnQkFBZ0I7QUFBQSxNQUN2QyxtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLGFBQWE7QUFBQSxRQUNaLG9CQUFvQixNQUFNO0FBQUEsUUFDMUIsbUJBQW1CLE1BQU07QUFBQSxRQUN6Qiw0QkFBNEIsTUFBTTtBQUFBLFFBQ2xDLFVBQVUsTUFBTSxDQUFDO0FBQUEsTUFDbEI7QUFBQSxNQUNBLGtCQUFrQixNQUFNO0FBQUU7QUFBQSxNQUFVO0FBQUEsTUFDcEMsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBRUEsaUJBQWEsSUFBSTtBQUVqQixXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUNuQyxXQUFPLFlBQVksUUFBUSxDQUFDO0FBQUEsRUFDN0IsQ0FBQztBQUVELFdBQVMsc0JBQXNCLFNBTTdCO0FBQ0QsVUFBTSxVQUFpRSxDQUFDO0FBQ3hFLFVBQU0sT0FBTztBQUFBLE1BQ1osZ0JBQWdCO0FBQUEsTUFDaEIsZUFBZSxRQUFRO0FBQUEsTUFDdkIsY0FBYyxFQUFFLE9BQU8sZ0JBQWdCO0FBQUEsTUFDdkMsbUJBQW1CLE1BQU07QUFBQSxNQUN6QixhQUFhO0FBQUEsUUFDWixVQUFVLE1BQU0sUUFBUTtBQUFBLFFBQ3hCLG9CQUFvQixDQUFDLFdBQW1CLFFBQWdCLFNBQWlCO0FBQ3hFLGtCQUFRLEtBQUssRUFBRSxXQUFXLFFBQVEsS0FBSyxDQUFDO0FBQ3hDLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBQ0EsbUJBQW1CLE1BQU07QUFBQSxRQUN6QixzQkFBc0IsTUFBTTtBQUFBLFFBQzVCLDRCQUE0QixNQUFNO0FBQUEsTUFDbkM7QUFBQSxNQUNBLGNBQWM7QUFBQSxRQUNiLG9CQUFvQixPQUFPLEVBQUUsTUFBTSxhQUFhLE1BQU0sV0FBVztBQUFBLFFBQ2pFLHVCQUF1QixPQUFPLEVBQUUsZ0JBQWdCLE1BQU07QUFBQSxNQUN2RDtBQUFBLE1BQ0Esa0JBQWtCLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDMUIsaUJBQWlCLE1BQU07QUFBQSxNQUFFO0FBQUEsSUFDMUI7QUFDQSxXQUFPLEVBQUUsTUFBTSxRQUFRO0FBQUEsRUFDeEI7QUFFQSxPQUFLLDJEQUEyRCxNQUFNO0FBQ3JFLFVBQU0sRUFBRSxNQUFNLFFBQVEsSUFBSSxzQkFBc0I7QUFBQSxNQUMvQyxlQUFlO0FBQUEsTUFDZixPQUFPLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sU0FBUyxRQUFRLEtBQUssQ0FBQztBQUFBLElBQ2hFLENBQUM7QUFDRCxpQkFBYSxJQUFJO0FBQ2pCLFdBQU8sWUFBWSxLQUFLLGVBQWUsSUFBSTtBQUMzQyxXQUFPLGdCQUFnQixTQUFTLENBQUMsRUFBRSxXQUFXLFVBQVUsUUFBUSxNQUFNLE1BQU0sZ0JBQWdCLENBQUMsQ0FBQztBQUFBLEVBQy9GLENBQUM7QUFFRCxPQUFLLGlEQUFpRCxNQUFNO0FBQzNELFVBQU0sRUFBRSxNQUFNLFFBQVEsSUFBSSxzQkFBc0I7QUFBQSxNQUMvQyxlQUFlO0FBQUEsTUFDZixPQUFPLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sUUFBUSxDQUFDO0FBQUEsSUFDbEQsQ0FBQztBQUNELGlCQUFhLElBQUk7QUFDakIsV0FBTyxZQUFZLEtBQUssZUFBZSxJQUFJO0FBQzNDLFdBQU8sZ0JBQWdCLFNBQVMsQ0FBQyxFQUFFLFdBQVcsVUFBVSxRQUFRLE1BQU0sTUFBTSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQUEsRUFDL0YsQ0FBQztBQUVELE9BQUssb0VBQW9FLE1BQU07QUFDOUUsVUFBTSxRQUFRLHNCQUFzQjtBQUFBLE1BQ25DLGVBQWU7QUFBQSxNQUNmLE9BQU8sQ0FBQyxFQUFFLElBQUksTUFBTSxNQUFNLFFBQVEsTUFBTSxTQUFTLFFBQVEsTUFBTSxDQUFDO0FBQUEsSUFDakUsQ0FBQztBQUNELGlCQUFhLE1BQU0sSUFBSTtBQUN2QixXQUFPLGdCQUFnQixNQUFNLFNBQVMsQ0FBQyxFQUFFLFdBQVcsVUFBVSxRQUFRLE1BQU0sTUFBTSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQ3BHLFVBQU0sVUFBVSxzQkFBc0I7QUFBQSxNQUNyQyxlQUFlO0FBQUEsTUFDZixPQUFPLENBQUM7QUFBQSxJQUNULENBQUM7QUFDRCxpQkFBYSxRQUFRLElBQUk7QUFDekIsV0FBTyxnQkFBZ0IsUUFBUSxTQUFTLENBQUMsRUFBRSxXQUFXLFVBQVUsUUFBUSxNQUFNLE1BQU0sZ0JBQWdCLENBQUMsQ0FBQztBQUFBLEVBQ3ZHLENBQUM7QUFFRCxPQUFLLHNFQUFzRSxNQUFNO0FBQ2hGLFVBQU0sY0FBc0MsQ0FBQztBQUM3QyxVQUFNLFdBQVcsU0FBUyxjQUFjLEtBQUs7QUFDN0MsVUFBTSxrQkFBa0IsU0FBUyxjQUFjLEtBQUs7QUFDcEQsVUFBTSxxQkFBcUIsU0FBUyxjQUFjLEtBQUs7QUFDdkQsVUFBTSxvQkFBb0IsU0FBUyxjQUFjLEtBQUs7QUFDdEQsVUFBTSxXQUFXLFNBQVMsY0FBYyxLQUFLO0FBQzdDLFVBQU0sV0FBVyxTQUFTLGNBQWMsS0FBSztBQUM3QyxVQUFNLGVBQWUsU0FBUyxjQUFjLEtBQUs7QUFDakQsb0JBQWdCLFlBQVksUUFBUTtBQUNwQyxVQUFNLGVBQWUsU0FBUyxjQUFjLFVBQVU7QUFDdEQsaUJBQWEsUUFBUTtBQUNyQixVQUFNLGFBQWE7QUFBQSxNQUNsQixnQkFBZ0I7QUFBQSxNQUNoQixlQUFlO0FBQUEsTUFDZixvQkFBb0I7QUFBQSxNQUNwQixzQkFBc0I7QUFBQSxNQUN0QjtBQUFBLE1BQ0EsWUFBWSxFQUFFLFNBQVMsTUFBTSxXQUFXO0FBQUEsTUFBRSxHQUFHLGVBQWU7QUFBQSxNQUFFLEVBQUU7QUFBQSxNQUNoRTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxZQUFZLE1BQU07QUFBQSxNQUNsQixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLGNBQWMsRUFBRSxpQkFBaUI7QUFBQSxNQUFFLEVBQUU7QUFBQSxNQUNyQyxjQUFjO0FBQUEsUUFDYixrQkFBa0IsQ0FBQyxPQUFnQjtBQUFFLHNCQUFZLEtBQUssRUFBRTtBQUFBLFFBQUc7QUFBQSxRQUMzRCxpQkFBaUIsTUFBTTtBQUFBLE1BQ3hCO0FBQUEsTUFDQSxhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLHNCQUFzQixNQUFNO0FBQUEsUUFDNUIsVUFBVSxNQUFNLENBQUMsRUFBRSxJQUFJLE1BQU0sTUFBTSxRQUFRLE1BQU0sU0FBUyxRQUFRLEtBQUssQ0FBQztBQUFBLE1BQ3pFO0FBQUEsTUFDQSxjQUFjO0FBQUEsUUFDYixvQkFBb0IsT0FBTyxFQUFFLE1BQU0sYUFBYSxNQUFNLFdBQVc7QUFBQSxRQUNqRSx1QkFBdUIsT0FBTyxFQUFFLGdCQUFnQixNQUFNO0FBQUEsTUFDdkQ7QUFBQSxJQUNEO0FBQ0Esa0JBQWMsWUFBOEQsSUFBSTtBQUNoRixXQUFPLFlBQVksV0FBVyxlQUFlLElBQUk7QUFDakQsV0FBTyxnQkFBZ0IsYUFBYSxDQUFDLElBQUksQ0FBQztBQUMxQyxXQUFPLFlBQVksV0FBVyxnQkFBZ0IsVUFBVTtBQUFBLEVBQ3pELENBQUM7QUFFRCxPQUFLLDJGQUEyRixNQUFNO0FBQ3JHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxRQUFJLFNBQVM7QUFDYixRQUFJLFdBQVc7QUFDZixRQUFJLGdCQUFnQjtBQUNwQixVQUFNLE9BQU87QUFBQSxNQUNaLGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLE1BQ3BCLGNBQWMsRUFBRSxPQUFPLGdCQUFnQjtBQUFBLE1BQ3ZDLG1CQUFtQixNQUFNO0FBQUEsTUFDekIscUJBQXFCLE9BQU8sRUFBRSxJQUFJLE1BQU0sU0FBUyxTQUFTO0FBQUEsTUFDMUQsYUFBYTtBQUFBLFFBQ1osK0JBQStCLE1BQU07QUFBQSxRQUNyQyw2QkFBNkIsTUFBTTtBQUFFO0FBQUEsUUFBWTtBQUFBLFFBQ2pELG1CQUFtQixNQUFNO0FBQUEsUUFDekIsNEJBQTRCLE1BQU07QUFBQSxNQUNuQztBQUFBLE1BQ0Esa0JBQWtCLE1BQU07QUFBRTtBQUFBLE1BQVU7QUFBQSxNQUNwQyxtQkFBbUIsTUFBTTtBQUFFO0FBQUEsTUFBaUI7QUFBQSxNQUM1QyxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxrQkFBYyxJQUFJO0FBRWxCLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQztBQUN4RCxXQUFPLFlBQVksUUFBUSxDQUFDO0FBQzVCLFdBQU8sWUFBWSxVQUFVLENBQUM7QUFDOUIsV0FBTyxZQUFZLGVBQWUsQ0FBQztBQUNuQyxXQUFPLFlBQVksS0FBSyxvQkFBb0IsSUFBSTtBQUNoRCxXQUFPLFlBQVksS0FBSyxnQkFBZ0IsV0FBVztBQUNuRCxXQUFPLFlBQVksS0FBSyxhQUFhLE9BQU8sZUFBZTtBQUFBLEVBQzVELENBQUM7QUFFRCxPQUFLLHdGQUF3RixNQUFNO0FBQ2xHLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxRQUFJLFNBQVM7QUFDYixRQUFJLFdBQVc7QUFDZixVQUFNLE9BQU87QUFBQSxNQUNaLGdCQUFnQjtBQUFBLE1BQ2hCLG9CQUFvQjtBQUFBLE1BQ3BCLGNBQWMsRUFBRSxPQUFPLGdCQUFnQjtBQUFBLE1BQ3ZDLG1CQUFtQixNQUFNO0FBQUEsTUFDekIscUJBQXFCLE9BQU8sRUFBRSxJQUFJLE1BQU0sU0FBUyxTQUFTO0FBQUEsTUFDMUQsYUFBYTtBQUFBLFFBQ1osK0JBQStCLE1BQU07QUFBQSxRQUNyQyw2QkFBNkIsTUFBTTtBQUFFO0FBQUEsUUFBWTtBQUFBLFFBQ2pELG1CQUFtQixNQUFNO0FBQUEsUUFDekIsNEJBQTRCLE1BQU07QUFBQSxNQUNuQztBQUFBLE1BQ0Esa0JBQWtCLE1BQU07QUFBRTtBQUFBLE1BQVU7QUFBQSxNQUNwQyxtQkFBbUIsTUFBTTtBQUFBLE1BQUU7QUFBQSxNQUMzQixpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxrQkFBYyxJQUFJO0FBRWxCLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFDM0MsV0FBTyxZQUFZLFFBQVEsQ0FBQztBQUM1QixXQUFPLFlBQVksVUFBVSxDQUFDO0FBQzlCLFdBQU8sWUFBWSxLQUFLLG9CQUFvQixJQUFJO0FBQ2hELFdBQU8sWUFBWSxLQUFLLGdCQUFnQixXQUFXO0FBQUEsRUFDcEQsQ0FBQztBQUVELE9BQUssdUVBQXVFLE1BQU07QUFDakYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFFBQUksU0FBUztBQUNiLFFBQUksV0FBVztBQUNmLFFBQUksZ0JBQWdCO0FBQ3BCLFVBQU0sT0FBTztBQUFBLE1BQ1osZ0JBQWdCO0FBQUEsTUFDaEIsb0JBQW9CO0FBQUEsTUFDcEIsY0FBYyxFQUFFLE9BQU8sZ0JBQWdCO0FBQUEsTUFDdkMsbUJBQW1CLE1BQU07QUFBQSxNQUN6QixxQkFBcUIsT0FBTyxFQUFFLElBQUksTUFBTSxTQUFTLFNBQVM7QUFBQSxNQUMxRCxhQUFhO0FBQUEsUUFDWiwrQkFBK0IsTUFBTTtBQUFBLFFBQ3JDLDZCQUE2QixNQUFNO0FBQUU7QUFBQSxRQUFZO0FBQUEsUUFDakQsbUJBQW1CLE1BQU07QUFBQSxRQUN6Qiw0QkFBNEIsTUFBTTtBQUFBLE1BQ25DO0FBQUEsTUFDQSxrQkFBa0IsTUFBTTtBQUFFO0FBQUEsTUFBVTtBQUFBLE1BQ3BDLG1CQUFtQixNQUFNO0FBQUU7QUFBQSxNQUFpQjtBQUFBLE1BQzVDLGlCQUFpQixDQUFDLFdBQWtEO0FBQ25FLGlCQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3JCO0FBQUEsSUFDRDtBQUVBLGtCQUFjLElBQUk7QUFFbEIsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLENBQUM7QUFDbkMsV0FBTyxZQUFZLFFBQVEsQ0FBQztBQUM1QixXQUFPLFlBQVksVUFBVSxDQUFDO0FBQzlCLFdBQU8sWUFBWSxlQUFlLENBQUM7QUFBQSxFQUNwQyxDQUFDO0FBRUQsT0FBSyxvRkFBb0YsWUFBWTtBQUNwRyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxhQUF3QixDQUFDO0FBQy9CLFVBQU0sY0FBYyxDQUFDLFdBQW9CO0FBQUUsaUJBQVcsS0FBSyxNQUFNO0FBQUEsSUFBRztBQUNwRSxVQUFNLE9BQU87QUFBQSxNQUNaLGtCQUFrQjtBQUFBLFFBQ2pCLFdBQVcsWUFBWTtBQUN0QixnQkFBTSxJQUFJLE1BQU0sZ0JBQWdCO0FBQUEsUUFDakM7QUFBQSxNQUNEO0FBQUEsTUFDQSxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxZQUFRLEdBQUcsc0JBQXNCLFdBQVc7QUFDNUMsUUFBSTtBQUNILGVBQVMsTUFBTSxRQUFRO0FBQ3ZCLFlBQU0sSUFBSSxRQUFjLGFBQVcsZUFBZSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2xFLFlBQU0sSUFBSSxRQUFjLGFBQVcsYUFBYSxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQ2hFLGFBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFDM0MsYUFBTyxnQkFBZ0IsWUFBWSxDQUFDLENBQUM7QUFBQSxJQUN0QyxVQUFFO0FBQ0QsY0FBUSxJQUFJLHNCQUFzQixXQUFXO0FBQUEsSUFDOUM7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHVJQUF1SSxZQUFZO0FBQ3ZKLFVBQU0sWUFBWSxJQUFJLE1BQU0sWUFBWTtBQUN4QyxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxPQUFPO0FBQUEsTUFDWixrQkFBa0I7QUFBQSxRQUNqQixXQUFXLFlBQVk7QUFDdEIsZ0JBQU0sSUFBSSxNQUFNLGdCQUFnQjtBQUFBLFFBQ2pDO0FBQUEsTUFDRDtBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQ3BCLGNBQU07QUFBQSxNQUNQO0FBQUEsSUFDRDtBQUVBLFVBQU0saUNBQWlDLFdBQVcsTUFBTSxTQUFTLE1BQU0sUUFBUSxDQUFDO0FBQ2hGLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFBQSxFQUM1QyxDQUFDO0FBRUQsT0FBSywyQ0FBMkMsWUFBWTtBQUMzRCxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFvQixDQUFDO0FBQzNCLFVBQU0sT0FBTztBQUFBLE1BQ1osa0JBQWtCO0FBQUEsUUFDakIsV0FBVyxPQUFPLFNBQWlCO0FBQ2xDLGtCQUFRLEtBQUssSUFBSTtBQUFBLFFBQ2xCO0FBQUEsTUFDRDtBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBRUEsYUFBUyxNQUFNLFFBQVE7QUFDdkIsVUFBTSxJQUFJLFFBQWMsYUFBVyxlQUFlLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFDbEUsVUFBTSxJQUFJLFFBQWMsYUFBVyxhQUFhLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFFaEUsV0FBTyxnQkFBZ0IsU0FBUyxDQUFDLFFBQVEsQ0FBQztBQUMxQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsQ0FBQztBQUFBLEVBQ3BDLENBQUM7QUFFRCxPQUFLLHNFQUFzRSxNQUFNO0FBQ2hGLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxRQUFJLGNBQWM7QUFDbEIsVUFBTSxPQUFPO0FBQUEsTUFDWixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLGFBQWE7QUFBQSxRQUNaLFlBQVksTUFBTTtBQUNqQjtBQUNBLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBQ0EsbUJBQW1CLE1BQU07QUFBQSxRQUN6Qiw0QkFBNEIsTUFBTTtBQUFBLE1BQ25DO0FBQUEsTUFDQSxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxlQUFXLE1BQU0sUUFBUTtBQUV6QixXQUFPLFlBQVksYUFBYSxDQUFDO0FBQ2pDLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQztBQUFBLEVBQ3pELENBQUM7QUFFRCxPQUFLLG1FQUFtRSxNQUFNO0FBQzdFLFVBQU0sV0FBb0QsQ0FBQztBQUMzRCxVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsYUFBYTtBQUFBLFFBQ1osWUFBWSxNQUFNO0FBQUEsUUFDbEIsbUJBQW1CLE1BQU07QUFBQSxRQUN6Qiw0QkFBNEIsTUFBTTtBQUFBLE1BQ25DO0FBQUEsTUFDQSxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxlQUFXLE1BQU0sUUFBUTtBQUV6QixXQUFPLGdCQUFnQixVQUFVLENBQUMsUUFBUSxDQUFDO0FBQUEsRUFDNUMsQ0FBQztBQUVELE9BQUssdUNBQXVDLE1BQU07QUFDakQsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sT0FBTztBQUFBLE1BQ1osbUJBQW1CLE1BQU07QUFBQSxNQUN6QixhQUFhO0FBQUEsUUFDWixZQUFZLE1BQU07QUFBQSxRQUNsQixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLDRCQUE0QixNQUFNO0FBQUEsTUFDbkM7QUFBQSxNQUNBLGlCQUFpQixDQUFDLFdBQWtEO0FBQ25FLGlCQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3JCO0FBQUEsSUFDRDtBQUVBLGVBQVcsTUFBTSxRQUFRO0FBRXpCLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDO0FBQUEsRUFDcEMsQ0FBQztBQUVELE9BQUssMEVBQTBFLE1BQU07QUFDcEYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFFBQUksY0FBYztBQUNsQixVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsYUFBYTtBQUFBLFFBQ1osZ0JBQWdCLE1BQU07QUFDckI7QUFDQSxpQkFBTztBQUFBLFFBQ1I7QUFBQSxRQUNBLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsNEJBQTRCLE1BQU07QUFBQSxNQUNuQztBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBRUEsbUJBQWUsTUFBTSxFQUFFLElBQUksU0FBUyxZQUFZLFFBQVEsU0FBUyxRQUFRLENBQUM7QUFFMUUsV0FBTyxZQUFZLGFBQWEsQ0FBQztBQUNqQyxXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFBQSxFQUN6RCxDQUFDO0FBRUQsT0FBSyx1RUFBdUUsTUFBTTtBQUNqRixVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxPQUFPO0FBQUEsTUFDWixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLGFBQWE7QUFBQSxRQUNaLGdCQUFnQixNQUFNO0FBQUEsUUFDdEIsbUJBQW1CLE1BQU07QUFBQSxRQUN6Qiw0QkFBNEIsTUFBTTtBQUFBLE1BQ25DO0FBQUEsTUFDQSxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxtQkFBZSxNQUFNLEVBQUUsSUFBSSxTQUFTLFlBQVksT0FBTyxDQUFDO0FBRXhELFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxRQUFRLENBQUM7QUFBQSxFQUM1QyxDQUFDO0FBRUQsT0FBSywyQ0FBMkMsTUFBTTtBQUNyRCxVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxPQUFPO0FBQUEsTUFDWixtQkFBbUIsTUFBTTtBQUFBLE1BQ3pCLGFBQWE7QUFBQSxRQUNaLGdCQUFnQixNQUFNO0FBQUEsUUFDdEIsbUJBQW1CLE1BQU07QUFBQSxRQUN6Qiw0QkFBNEIsTUFBTTtBQUFBLE1BQ25DO0FBQUEsTUFDQSxpQkFBaUIsQ0FBQyxXQUFrRDtBQUNuRSxpQkFBUyxLQUFLLE1BQU07QUFBQSxNQUNyQjtBQUFBLElBQ0Q7QUFFQSxtQkFBZSxNQUFNLEVBQUUsSUFBSSxTQUFTLFlBQVksT0FBTyxDQUFDO0FBRXhELFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDO0FBQUEsRUFDcEMsQ0FBQztBQUVELE9BQUssd0ZBQXdGLE1BQU07QUFDbEcsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sRUFBRSxNQUFNLE9BQU8sSUFBSSw2QkFBNkIsUUFBUTtBQUM5RCxRQUFJLGVBQWU7QUFDbkIsSUFBQyxLQUEwRSxZQUFZLG9CQUFvQixNQUFNO0FBQ2hIO0FBQ0EsYUFBTztBQUFBLElBQ1I7QUFDQSxzQkFBa0IsTUFBTSxFQUFFLElBQUksU0FBUyxDQUFDO0FBQ3hDLFdBQU8sWUFBWSxjQUFjLENBQUM7QUFDbEMsV0FBTyxZQUFZLFFBQVEsQ0FBQztBQUM1QixXQUFPLGdCQUFnQixVQUFVLENBQUMscUJBQXFCLENBQUM7QUFBQSxFQUN6RCxDQUFDO0FBRUQsT0FBSyxxRkFBcUYsTUFBTTtBQUMvRixVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxVQUFVLHFDQUFxQyxVQUFVLE9BQU8sS0FBSztBQUMzRSxRQUFJLGVBQWU7QUFDbkIsSUFBQyxRQUFRLEtBQTBFLFlBQVksb0JBQW9CLE1BQU07QUFDeEg7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUNBLHNCQUFrQixRQUFRLE1BQU0sRUFBRSxJQUFJLFNBQVMsQ0FBQztBQUNoRCxXQUFPLFlBQVksY0FBYyxDQUFDO0FBQ2xDLFdBQU8sWUFBWSxRQUFRLFFBQVEsQ0FBQztBQUNwQyxXQUFPLGdCQUFnQixVQUFVLENBQUMsbUJBQW1CLENBQUM7QUFBQSxFQUN2RCxDQUFDO0FBRUQsT0FBSyw2RUFBNkUsTUFBTTtBQUN2RixVQUFNLFdBQW9ELENBQUM7QUFDM0QsVUFBTSxRQUFpRixDQUFDO0FBQ3hGLFVBQU0sT0FBTztBQUFBLE1BQ1osbUJBQW1CLE1BQU07QUFBQSxNQUN6QixhQUFhO0FBQUEsUUFDWixtQkFBbUIsQ0FBQyxXQUFtQixRQUFnQixZQUFtQztBQUN6RixnQkFBTSxLQUFLLEVBQUUsV0FBVyxRQUFRLFFBQVEsQ0FBQztBQUN6QyxpQkFBTztBQUFBLFFBQ1I7QUFBQSxRQUNBLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsNEJBQTRCLE1BQU07QUFBQSxNQUNuQztBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBRUEsc0JBQWtCLE1BQU0sRUFBRSxJQUFJLFNBQVMsQ0FBQztBQUV4QyxXQUFPLGdCQUFnQixPQUFPLENBQUMsRUFBRSxXQUFXLFVBQVUsUUFBUSxVQUFVLFNBQVMsRUFBRSxTQUFTLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFDbkcsV0FBTyxnQkFBZ0IsVUFBVSxDQUFDLHFCQUFxQixDQUFDO0FBQUEsRUFDekQsQ0FBQztBQUVELE9BQUssMEVBQTBFLE1BQU07QUFDcEYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sT0FBTztBQUFBLE1BQ1osbUJBQW1CLE1BQU07QUFBQSxNQUN6QixhQUFhO0FBQUEsUUFDWixtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLG1CQUFtQixNQUFNO0FBQUEsUUFDekIsNEJBQTRCLE1BQU07QUFBQSxNQUNuQztBQUFBLE1BQ0EsaUJBQWlCLENBQUMsV0FBa0Q7QUFDbkUsaUJBQVMsS0FBSyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBRUEsc0JBQWtCLE1BQU0sRUFBRSxJQUFJLFNBQVMsQ0FBQztBQUV4QyxXQUFPLGdCQUFnQixVQUFVLENBQUMsUUFBUSxDQUFDO0FBQUEsRUFDNUMsQ0FBQztBQUVELE9BQUssc0VBQXNFLE1BQU07QUFDaEYsVUFBTSxXQUFvRCxDQUFDO0FBQzNELFVBQU0sUUFBaUYsQ0FBQztBQUN4RixVQUFNLE9BQU87QUFBQSxNQUNaLG1CQUFtQixNQUFNO0FBQUEsTUFDekIsYUFBYTtBQUFBLFFBQ1osbUJBQW1CLENBQUMsV0FBbUIsUUFBZ0IsWUFBbUM7QUFDekYsZ0JBQU0sS0FBSyxFQUFFLFdBQVcsUUFBUSxRQUFRLENBQUM7QUFDekMsaUJBQU87QUFBQSxRQUNSO0FBQUEsUUFDQSxtQkFBbUIsTUFBTTtBQUFBLFFBQ3pCLDRCQUE0QixNQUFNO0FBQUEsTUFDbkM7QUFBQSxNQUNBLGlCQUFpQixDQUFDLFdBQWtEO0FBQ25FLGlCQUFTLEtBQUssTUFBTTtBQUFBLE1BQ3JCO0FBQUEsSUFDRDtBQUVBLHNCQUFrQixNQUFNLEVBQUUsSUFBSSxTQUFTLENBQUM7QUFFeEMsV0FBTyxnQkFBZ0IsT0FBTyxDQUFDLEVBQUUsV0FBVyxVQUFVLFFBQVEsVUFBVSxTQUFTLEVBQUUsU0FBUyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQ25HLFdBQU8sZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDO0FBQUEsRUFDcEMsQ0FBQztBQUVELE9BQUssMkRBQTJELE1BQU07QUFDckUsVUFBTSxVQUFVO0FBQUEsTUFDZixRQUFRO0FBQUEsTUFDUixXQUFXO0FBQUEsUUFDVixNQUFNO0FBQUEsUUFBRTtBQUFBLFFBQ1IsU0FBUztBQUFBLFFBQUU7QUFBQSxNQUNaO0FBQUEsTUFDQSxjQUFjLE1BQU07QUFBQSxNQUFFO0FBQUEsTUFDdEIsaUJBQWlCLE1BQU07QUFBQSxNQUFFO0FBQUEsSUFDMUI7QUFDQSxVQUFNLFlBQVk7QUFBQSxNQUNqQixhQUFhO0FBQUEsTUFDYixrQkFBa0I7QUFBQSxNQUFFO0FBQUEsSUFDckI7QUFDQSxVQUFNLE9BQU87QUFBQSxNQUNaLG9CQUFvQjtBQUFBLE1BQ3BCLG9CQUFvQjtBQUFBLE1BQ3BCO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxvQkFBZ0IsTUFBTSxRQUFRO0FBRTlCLFdBQU8sWUFBWSxLQUFLLG9CQUFvQixJQUFJO0FBQ2hELFdBQU8sWUFBWSxRQUFRLFFBQVEsS0FBSztBQUN4QyxXQUFPLFlBQVksVUFBVSxhQUFhLDBCQUEwQjtBQUNwRSxXQUFPLGVBQWUsVUFBVSxhQUFhLHNDQUFzQztBQUNuRixXQUFPLGVBQWUsVUFBVSxhQUFhLG1DQUFtQztBQUNoRixXQUFPLGVBQWUsVUFBVSxhQUFhLG9DQUFvQztBQUVqRixvQkFBZ0IsTUFBTSxxQkFBcUI7QUFDM0MsV0FBTyxZQUFZLFVBQVUsYUFBYSxvQ0FBb0M7QUFDOUUsV0FBTyxlQUFlLFVBQVUsYUFBYSwwQkFBMEI7QUFDdkUsV0FBTyxHQUFHLENBQUMsZ0JBQWdCLEtBQUssVUFBVSxlQUFlLEVBQUUsQ0FBQztBQUM1RCxRQUFJLEtBQUssb0JBQW9CO0FBQzVCLG1CQUFhLEtBQUssa0JBQWtCO0FBQ3BDLFdBQUsscUJBQXFCO0FBQUEsSUFDM0I7QUFBQSxFQUNELENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJzdWJtaXREcmFmdCIsICJwb3N0Qm91bmQiXQp9Cg==
