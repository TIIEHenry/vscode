import assert from "assert";
import { Dimension, getActiveElement } from "../../../../../base/browser/dom.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { DeferredPromise, raceTimeout, timeout } from "../../../../../base/common/async.js";
import { errorHandler, getErrorMessage, setUnexpectedErrorHandler } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { ConversationPart, IConversationPartService } from "../../../../browser/parts/conversation/conversationPart.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { EditorService } from "../../../../services/editor/browser/editorService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { EditorExtensions } from "../../../../common/editor.js";
import { createEditorParts, registerTestEditor, TestFileEditorInput, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { SideBySideEditorInput } from "../../../../common/editor/sideBySideEditorInput.js";
import "../../browser/conversationEditor.contribution.js";
import { ConversationEditorPane } from "../../browser/conversationEditorPane.js";
import { ConversationSessionChatContribution } from "../../browser/conversationSessionChat.contribution.js";
import { ConversationNavigationContribution } from "../../browser/conversationNavigation.contribution.js";
import { ConversationNavigationService, IConversationNavigationService } from "../../browser/conversationNavigationService.js";
import { ConversationSessionChatService, IConversationSessionChatService } from "../../browser/conversationSessionChatService.js";
import { switchToSession as switchToSessionHelper } from "../../browser/conversationLensSessionBar.js";
import { ConversationSessionWindowService, IConversationSessionWindowService } from "../../browser/conversationSessionWindowService.js";
import { ConversationStubService, IConversationRosterService } from "../../browser/conversationStubService.js";
import { IConversationTimelineRevealService } from "../../browser/conversationTimelineRevealService.js";
import { IConversationReviewNavService } from "../../browser/conversationReviewEntry.js";
import { ConversationEngineRosterService, ENGINE_BIND_FAILED_SESSION_ID, isEngineRosterPlaceholderSessionId } from "../../browser/conversationEngineRosterService.js";
import { getConversationSessionReadiness } from "../../browser/conversationSessionAvailability.js";
import { isConversationEngineLive, isConversationPairingHold } from "../../browser/conversationSessionStatus.js";
import { stubTurnsToSnapshot } from "../../browser/conversationSessionView.js";
import { ConversationEditorPaneId, conversationSessionLeafHiddenClass } from "../../common/conversationSessionWindow.js";
import { UA_CLIENT_CHAT_INPUT_AUTO_FOCUS } from "../../common/uaClientSettingsKeys.js";
import { IUniverseAgentConnection } from "../../../../../platform/universeAgent/common/universeAgentConnection.js";
import { ConversationChatInput, getConversationChatResource } from "../../common/conversationChatInput.js";
import { createConversationConnectionTestStub } from "../common/conversationConnectionTestStub.js";
import { stubConversationTimelineLinkServices } from "./conversationTimelineLinkTestStubs.js";
import { installConversationLensResizeObserverHarness } from "./conversationLensLayoutHarness.js";
import { IExplorerService } from "../../../files/browser/files.js";
import { ISCMService } from "../../../scm/common/scm.js";
class QuietRosterService extends ConversationStubService {
  seedSessionQuietly() {
    const previous = this.model.getActiveSessionId();
    const sessionId = this.model.createSession();
    this.model.switchSession(previous);
    this._onDidChangeSession.fire(sessionId);
    return sessionId;
  }
  fireActiveSession(sessionId) {
    this._onDidChangeActiveSession.fire(sessionId);
  }
  fireDeletedSession(sessionId) {
    this._onDidDeleteSession.fire(sessionId);
  }
}
class RevealEngineSessionView extends Disposable {
  constructor() {
    super(...arguments);
    this.acquired = [];
    this.released = /* @__PURE__ */ new Set();
    this.emitters = /* @__PURE__ */ new Map();
    this.versions = /* @__PURE__ */ new Map();
    this.listening = /* @__PURE__ */ new Set();
    this.didListen = this._register(new Emitter());
    this.onDidListen = this.didListen.event;
  }
  onDynamicDidApplyFrame(leaseId) {
    let emitter = this.emitters.get(leaseId);
    if (!emitter) {
      emitter = this._register(new Emitter({
        onDidAddFirstListener: () => queueMicrotask(() => {
          this.emitLease(leaseId);
          this.listening.add(leaseId);
          this.didListen.fire(leaseId);
        })
      }));
      this.emitters.set(leaseId, emitter);
    }
    return emitter.event;
  }
  async acquireLease(sessionId) {
    const leaseId = `reveal:${sessionId}:${this.acquired.length + 1}`;
    this.acquired.push({ leaseId, sessionId });
    return leaseId;
  }
  async whenEngineSessionReady(sessionId) {
    return sessionId;
  }
  async releaseLease(leaseId) {
    this.released.add(leaseId);
  }
  async post() {
    throw new Error("lease recovery must not write");
  }
  async requestResync() {
  }
  async acknowledge() {
  }
  async requestDetail() {
    return { ok: false, reason: "unavailable" };
  }
  hasSessionListener(sessionId) {
    return this.acquired.some((lease) => lease.sessionId === sessionId && this.listening.has(lease.leaseId) && !this.released.has(lease.leaseId));
  }
  emitSession(sessionId, text) {
    for (const lease of this.acquired) {
      if (lease.sessionId === sessionId) {
        this.emitLease(lease.leaseId, text);
      }
    }
  }
  emitLease(leaseId, text) {
    const lease = this.acquired.find((candidate) => candidate.leaseId === leaseId);
    if (!lease || this.released.has(leaseId)) {
      return;
    }
    const projection = stubTurnsToSnapshot(lease.sessionId, text === void 0 ? [] : [
      { id: `${lease.sessionId}-body`, kind: "user", text },
      { id: `${lease.sessionId}-permission`, kind: "confirmation", text: `Permission for ${lease.sessionId}`, status: "pending" }
    ]);
    const version = (this.versions.get(leaseId) ?? 0) + 1;
    this.versions.set(leaseId, version);
    this.emitters.get(leaseId)?.fire({
      leaseId,
      sessionId: lease.sessionId,
      applied: { kind: "baseline" },
      frame: {
        frame: { leaseId, generation: 1, frameId: version, version, body: { kind: "baseline", snapshot: { ...projection.snapshot, sync: { kind: "live" } } } },
        attribution: [...projection.attribution].map(([itemId, attribution]) => ({ op: "upsertAttribution", itemId, attribution }))
      }
    });
  }
}
suite("Conversation session window reveal + leaf SessionBar (C)", () => {
  const TEST_EDITOR_ID = "MyFileEditorForConversationReveal";
  const TEST_EDITOR_INPUT_ID = "testEditorInputForConversationReveal";
  installConversationLensResizeObserverHarness();
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  const disposables = store;
  teardown(async () => {
    await new Promise((resolve) => mainWindow.requestAnimationFrame(() => mainWindow.requestAnimationFrame(() => resolve())));
  });
  setup(function() {
    this.timeout(2e4);
    store.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(SideBySideEditorInput)], TEST_EDITOR_INPUT_ID));
  });
  function layoutParts(parts) {
    for (const part of parts.conversationParts) {
      part.layout(800, 600, 0, 0);
    }
  }
  function trackEditors(parts) {
    for (const part of parts.conversationParts) {
      for (const editor of part.activeGroup.editors) {
        store.add(editor);
      }
    }
  }
  async function waitForPane(part, openErrors = [], parts) {
    await part.whenReady;
    const deadline = Date.now() + 3e3;
    while (Date.now() < deadline) {
      const pane = part.activeGroup.activeEditorPane;
      if (pane instanceof ConversationEditorPane) {
        if (parts) {
          trackEditors(parts);
        }
        return pane;
      }
      await timeout(20);
    }
    const detail = openErrors.map((error) => error instanceof Error ? error.stack ?? error.message : String(error)).join("\n");
    throw new Error(`ConversationEditorPane not ready for ${part.sessionKey}; got ${part.activeGroup.activeEditorPane?.getId()}${detail ? `
${detail}` : ""}`);
  }
  function partFor(parts, sessionKey) {
    const part = parts.conversationParts.find((candidate) => candidate.sessionKey === sessionKey);
    assert.ok(part, `missing part ${sessionKey}`);
    return part;
  }
  function visibleLeafKeys(windowService) {
    return [...windowService.getVisibleSessionKeys()];
  }
  function hideButton(windowService, sessionKey) {
    return windowService.getLeafSlots(sessionKey)?.sessionBar.querySelector(".conversation-session-leaf-hide");
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
  function createLightweightWindowHarness(options) {
    const rosterService = store.add(new QuietRosterService());
    const gridHost = document.createElement("div");
    document.body.appendChild(gridHost);
    store.add({ dispose: () => gridHost.remove() });
    const onDidCreateSlots = new Emitter();
    store.add(onDidCreateSlots);
    let throwOnCreate = false;
    let rejectWhenReady = false;
    const conversationParts = [];
    const editorGroupsService = {
      createConversationEditorPart: (_parent, sessionKey) => {
        if (throwOnCreate) {
          throw new Error("reveal boom");
        }
        let whenReady = Promise.resolve();
        if (rejectWhenReady) {
          const rejected = Promise.reject(new Error("whenReady boom"));
          void rejected.catch(() => {
          });
          whenReady = rejected;
        }
        const part = { sessionKey, whenReady, activeGroup: { focus: () => {
        }, activeEditorPane: { getId: () => ConversationEditorPaneId } } };
        conversationParts.push(part);
        return part;
      },
      disposeConversationEditorPart: (sessionKey) => {
        const index = conversationParts.findIndex((part) => part.sessionKey === sessionKey);
        if (index >= 0) {
          conversationParts.splice(index, 1);
        }
      },
      setFocusedConversationLeaf: () => {
      },
      getFocusedConversationLeaf: () => void 0,
      get conversationParts() {
        return conversationParts;
      }
    };
    let onNotifyError;
    const sessionWindowService = store.add(new ConversationSessionWindowService(
      {
        onDidCreateSlots: onDidCreateSlots.event,
        onDidFocus: Event.None,
        getSlots: () => options?.delaySlots ? void 0 : { sessionBar: document.createElement("div"), sessionWindowGrid: gridHost, editorPartHost: void 0 },
        setFocusedLeafContainer: () => {
        },
        focus: () => {
        }
      },
      editorGroupsService,
      rosterService,
      new NullLogService(),
      {
        error: (message) => {
          onNotifyError?.(message);
        }
      }
    ));
    return {
      sessionWindowService,
      rosterService,
      conversationParts,
      setThrowOnCreate(value) {
        throwOnCreate = value;
      },
      setRejectWhenReady(value) {
        rejectWhenReady = value;
      },
      setNotifyError(handler) {
        onNotifyError = handler;
      },
      attachSlots() {
        onDidCreateSlots.fire({
          sessionBar: document.createElement("div"),
          sessionWindowGrid: gridHost,
          editorPartHost: void 0
        });
      }
    };
  }
  async function collectLeafConversationLenses(part) {
    const group = part.activeGroup;
    const lenses = [];
    for (const editor of group.editors) {
      await group.openEditor(editor);
      const pane = group.activeEditorPane;
      assert.ok(pane instanceof ConversationEditorPane, `missing ConversationEditorPane for ${editor.resource}`);
      const lens = pane.activeConversationLens;
      assert.ok(lens, `each conversation tab must expose a ConversationLens (${editor.resource})`);
      lenses.push(lens);
    }
    return lenses;
  }
  function countLeafChrome(windowService, conversationPart) {
    let bars = 0;
    let navs = 0;
    for (const key of windowService.getVisibleSessionKeys()) {
      const leaf = windowService.getLeafSlots(key);
      assert.ok(leaf);
      bars += leaf.container.querySelectorAll(".conversation-lens-session-bar").length;
      navs += leaf.container.querySelectorAll(".conversation-window-nav").length;
    }
    const partSlotBars = conversationPart.getSlots()?.sessionBar.querySelectorAll(".conversation-lens-session-bar").length ?? 0;
    return { bars, navs, partSlotBars };
  }
  function stubLensRuntimeServices(instantiationService) {
    instantiationService.stub(IConversationTimelineRevealService, {
      _serviceBrand: void 0,
      registerLens: () => ({ dispose: () => {
      } }),
      revealItem: () => {
      },
      getAccessibleTurnContent: () => void 0,
      focusAccessibleTurn: () => {
      },
      scrollToFirstPendingConfirmation: () => {
      }
    });
    instantiationService.stub(IConversationReviewNavService, {
      _serviceBrand: void 0,
      onDidChange: Event.None,
      getReviewNavForSession: () => []
    });
    instantiationService.stub(IExplorerService, {
      _serviceBrand: void 0,
      select: async () => {
      }
    });
    instantiationService.stub(ISCMService, {
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
    });
  }
  async function createRevealHarness() {
    return createRevealHarnessWithRoster(store.add(new QuietRosterService()), createConversationConnectionTestStub());
  }
  async function createRevealHarnessWithRoster(rosterService, connection, engine = false) {
    const openErrors = [];
    const instantiationService = workbenchInstantiationService({
      configurationService: () => new TestConfigurationService({
        workbench: { editor: { enablePreview: false } },
        [UA_CLIENT_CHAT_INPUT_AUTO_FOCUS]: false
      })
    }, store);
    instantiationService.stub(ILogService, {
      error: (error) => {
        openErrors.push(error);
      },
      warn: () => {
      },
      info: () => {
      },
      trace: () => {
      },
      debug: () => {
      },
      flush: () => {
      },
      getLevel: () => 0,
      setLevel: () => {
      },
      onDidChangeLogLevel: Event.None
    });
    instantiationService.stub(IConversationRosterService, rosterService);
    instantiationService.stub(IUniverseAgentConnection, connection);
    stubLensRuntimeServices(instantiationService);
    stubConversationTimelineLinkServices(instantiationService);
    instantiationService.invokeFunction((accessor) => Registry.as(EditorExtensions.EditorFactory).start(accessor));
    const parts = await createEditorParts(instantiationService, disposables);
    store.add(parts);
    instantiationService.stub(IEditorGroupsService, parts);
    const editorService = disposables.add(instantiationService.createInstance(EditorService, void 0));
    instantiationService.stub(IEditorService, editorService);
    const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add({ dispose: () => parent.remove() });
    conversationPart.create(parent);
    instantiationService.stub(IConversationPartService, conversationPart);
    const sessionChatService = disposables.add(instantiationService.createInstance(ConversationSessionChatService));
    instantiationService.stub(IConversationSessionChatService, sessionChatService);
    const sessionWindowService = disposables.add(instantiationService.createInstance(ConversationSessionWindowService));
    instantiationService.stub(IConversationSessionWindowService, sessionWindowService);
    const navigationService = disposables.add(instantiationService.createInstance(ConversationNavigationService));
    instantiationService.stub(IConversationNavigationService, navigationService);
    store.add(instantiationService.createInstance(ConversationSessionChatContribution));
    store.add(instantiationService.createInstance(ConversationNavigationContribution));
    const primaryId = rosterService.getActiveSessionId();
    await sessionWindowService.ensurePrimaryWindow(primaryId);
    const primaryPart = partFor(parts, primaryId);
    if (engine) {
      await waitForEnginePane(primaryPart, openErrors);
    } else {
      await waitForPane(primaryPart, openErrors, parts);
    }
    layoutParts(parts);
    trackEditors(parts);
    return { instantiationService, editorService, parts, conversationPart, rosterService, sessionWindowService, sessionChatService, primaryId, openErrors };
  }
  async function bounded(promise, message) {
    const result = await raceTimeout(promise.then((value) => ({ value })), 3e3);
    assert.ok(result, message);
    return result.value;
  }
  async function waitForEnginePane(part, openErrors = []) {
    try {
      await bounded(part.whenReady, "engine leaf part must become ready");
      if (!(part.activeGroup.activeEditorPane instanceof ConversationEditorPane)) {
        const ready = Event.toPromise(Event.filter(
          part.activeGroup.onDidActiveEditorChange,
          () => part.activeGroup.activeEditorPane instanceof ConversationEditorPane
        ));
        try {
          await bounded(ready, "real engine ConversationEditorPane must open");
        } finally {
          ready.cancel();
        }
      }
      const pane = part.activeGroup.activeEditorPane;
      assert.ok(pane instanceof ConversationEditorPane);
      return pane;
    } catch (error) {
      try {
        if (error instanceof Error) {
          const originalStack = error.stack;
          const group = part.activeGroup;
          const activeEditor = group.activeEditor;
          const activePane = group.activeEditorPane;
          const diagnostics = JSON.stringify({
            part: { windowId: part.windowId, sessionKey: part.sessionKey },
            groupId: group.id,
            activeEditorResource: activeEditor?.resource?.toString() ?? null,
            activePaneId: activePane?.getId() ?? null,
            activePaneIsConversationEditorPane: activePane instanceof ConversationEditorPane,
            openErrors: openErrors.map((openError) => openError instanceof Error ? { type: openError.name, message: openError.message, stack: openError.stack ?? null } : { type: typeof openError, message: String(openError), stack: null })
          }, null, 2);
          Object.defineProperty(error, "stack", {
            value: `${originalStack ?? `${error.name}: ${error.message}`}
Engine Pane setup diagnostics: ${diagnostics}`
          });
        }
      } catch {
      }
      throw error;
    }
  }
  async function createEngineRevealHarness(beforePane) {
    const requests = [];
    const allRequests = [];
    let phase = { kind: "disconnected" };
    let pairingPending = false;
    const connectionEmitter = store.add(new Emitter());
    const base = createConversationConnectionTestStub();
    const connection = createConversationConnectionTestStub({
      isEngineConnected: () => isConversationEngineLive(phase, pairingPending),
      getConnectionPhase: () => phase,
      getTransportState: () => "ok",
      getConnectionSnapshot: () => ({ ...base.getConnectionSnapshot(), transport: "ok", channelAlive: phase.kind !== "disconnected", pairingPending, engineIdentityId: "reveal-engine", linkId: 1 }),
      onDidChangeConnection: connectionEmitter.event,
      listSessions: () => {
        const request = requests.shift();
        assert.ok(request, "every real catalog request must have an explicit Deferred");
        void request.started.complete();
        return request.result.p;
      }
    });
    const sessionView = store.add(new RevealEngineSessionView());
    const rosterService = store.add(new ConversationEngineRosterService(connection, sessionView, { _serviceBrand: void 0, shouldAdvertise: () => true }));
    store.add(toDisposable(() => {
      for (const request of allRequests) {
        if (!request.result.isSettled) {
          void request.result.complete({ sessions: [] });
        }
      }
    }));
    const deferCatalog = () => {
      const request = { started: new DeferredPromise(), result: new DeferredPromise() };
      requests.push(request);
      allRequests.push(request);
      return request;
    };
    const notify = (kind) => {
      pairingPending = kind === "connected pairing" || kind === "connecting pairing";
      phase = kind === "disconnected" ? { kind: "disconnected" } : kind === "connecting pairing" ? { kind: "connecting", reason: "initial" } : { kind: "connected", path: "loopback" };
      connectionEmitter.fire(connection.getConnectionSnapshot());
    };
    const catalog = { sessions: [{ sessionId: "lease-s1", title: "Lease s1" }, { sessionId: "lease-s2", title: "Lease s2" }] };
    const initial = deferCatalog();
    notify("live");
    await bounded(initial.started.p, "initial real catalog must start");
    await initial.result.complete(catalog);
    await bounded(rosterService.whenEngineCatalogRefreshComplete(), "initial real catalog must finish");
    assert.strictEqual(getConversationSessionReadiness(rosterService), "ready");
    beforePane?.(rosterService);
    const harness = await createRevealHarnessWithRoster(rosterService, connection, true);
    const pane = await waitForEnginePane(partFor(harness.parts, harness.primaryId), harness.openErrors);
    const lens = pane.activeConversationLens;
    assert.ok(lens);
    assert.ok(lens.sessionViewLease, "initial real visible owner must have a lease");
    if (lens.sessionViewLease.snapshot.sessionId !== harness.primaryId) {
      const baseline = Event.toPromise(lens.sessionViewLease.onDidApplyFrame);
      try {
        await bounded(baseline, "initial host baseline must reach the Pane lease");
      } finally {
        baseline.cancel();
      }
    }
    assert.strictEqual(lens.sessionViewLease.snapshot.sessionId, harness.primaryId);
    return { ...harness, pane, lens, connection, sessionView, deferCatalog, notify, catalog };
  }
  function assertVisibleMissing(harness, pane = harness.pane, key = harness.primaryId) {
    const lens = pane.activeConversationLens;
    assert.ok(lens);
    assert.strictEqual(lens.boundSessionId, key);
    assert.strictEqual(lens.isDisposed, false);
    assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(key), true);
    assert.strictEqual(lens.sessionViewBindingSuspended, false);
    assert.strictEqual(lens.sessionViewLease, void 0, "real connection/Binding must naturally remove the empty owner lease");
    return lens;
  }
  async function startEmptyCatalogRefresh(harness, reconnect = false) {
    const request = harness.deferCatalog();
    if (reconnect) {
      harness.notify("disconnected");
    }
    harness.notify("live");
    await bounded(request.started.p, "real replacement listSessions must start");
    assert.strictEqual(getConversationSessionReadiness(harness.rosterService), "loading");
    assert.strictEqual(harness.pane.activeConversationLens, harness.lens);
    assertVisibleMissing(harness);
    return request;
  }
  async function completeCatalog(harness, request) {
    await request.result.complete(harness.catalog);
    await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), "real catalog must settle");
    assert.strictEqual(getConversationSessionReadiness(harness.rosterService), "ready");
  }
  function observePaneBinds(lens) {
    let calls = 0;
    const original = lens.bindSessionView;
    lens.bindSessionView = (sessionId) => {
      calls++;
      original.call(lens, sessionId);
    };
    store.add(toDisposable(() => {
      lens.bindSessionView = original;
    }));
    return () => calls;
  }
  async function assertEngineFramePaints(harness, pane, sessionId, text) {
    const lens = pane.activeConversationLens;
    assert.ok(lens);
    const lease = lens.sessionViewLease;
    assert.ok(lease, "this actual Pane must own the recovered lease");
    assert.strictEqual(lease.sessionId, sessionId);
    if (!harness.sessionView.hasSessionListener(sessionId)) {
      const listening = Event.toPromise(Event.filter(harness.sessionView.onDidListen, () => harness.sessionView.hasSessionListener(sessionId)));
      try {
        await bounded(listening, "actual host lease acquire and frame listener must complete");
      } finally {
        listening.cancel();
      }
    }
    const column = pane.getReadingColumn();
    assert.ok(column);
    const painted = new DeferredPromise();
    const check = () => {
      const body = column.querySelector(`.conversation-lens-turn[data-turn-id="${sessionId}-body"] .conversation-lens-turn-body`);
      const pending = column.querySelector(`.conversation-lens-confirmation-seat[data-turn-id="${sessionId}-permission"]`);
      if (body?.textContent === text && pending?.textContent?.includes(`Permission for ${sessionId}`)) {
        void painted.complete();
      }
    };
    const observer = new MutationObserver(check);
    observer.observe(column, { childList: true, characterData: true, subtree: true });
    const admitted = Event.toPromise(lease.onDidApplyFrame);
    try {
      harness.sessionView.emitSession(sessionId, text);
      await bounded(admitted, "frame must be admitted by the actual Pane lease");
      pane.layout({ width: 800, height: 600 });
      check();
      await bounded(painted.p, "actual Pane turn and pending seat must paint through TimelineHost");
      assert.strictEqual(lens.sessionViewLease, lease);
      assert.strictEqual(lease.snapshot.timeline.length, 2);
      assert.strictEqual(lease.snapshot.pendingActions.length, 1);
    } finally {
      observer.disconnect();
      admitted.cancel();
    }
  }
  async function waitForSessionPane(harness, sessionKey) {
    return waitForPane(partFor(harness.parts, sessionKey), harness.openErrors, harness.parts);
  }
  suite("visible engine lease recovery", () => {
    test("L1 same visible empty owner recovers its own lease after same-session catalog ready without reveal", async () => {
      const harness = await createEngineRevealHarness();
      const { pane, lens, primaryId, rosterService } = harness;
      const input = pane.input;
      assert.ok(input);
      assert.strictEqual(lens.lastAttachedEntries.length, 0);
      assert.strictEqual(lens.sessionViewLease?.snapshot.timeline.length, 0);
      const pending = await startEmptyCatalogRefresh(harness, true);
      assert.strictEqual(pane.input, input);
      let activeChanges = 0;
      const activeListener = store.add(rosterService.onDidChangeActiveSession(() => {
        activeChanges++;
      }));
      await completeCatalog(harness, pending);
      assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
      assert.strictEqual(activeChanges, 0, "same-session recovery must not rely on an active-id event");
      assert.strictEqual(pane.input, input);
      assert.strictEqual(pane.activeConversationLens, lens);
      assert.strictEqual(lens.boundSessionId, primaryId);
      assert.strictEqual(lens.isDisposed, false);
      assert.strictEqual(isConversationEngineLive(harness.connection.getConnectionPhase(), harness.connection.getConnectionSnapshot().pairingPending), true);
      assert.strictEqual(isConversationPairingHold(harness.connection), false);
      assert.ok(lens.sessionViewLease, "catalog ready must restore this visible Pane lease without hide/reveal");
      assert.strictEqual(lens.sessionViewLease.sessionId, primaryId);
      activeListener.dispose();
      await assertEngineFramePaints(harness, pane, primaryId, "L1 recovered Pane body");
    });
    test("L2 continuously live nonempty owner keeps lease snapshot entries and text through catalog pending failure and ready", async () => {
      const harness = await createEngineRevealHarness();
      await assertEngineFramePaints(harness, harness.pane, harness.primaryId, "L2 keep this body");
      const lease = harness.lens.sessionViewLease;
      assert.ok(lease);
      const snapshot = lease.snapshot;
      const entries = harness.lens.lastAttachedEntries;
      const input = harness.pane.input;
      const assertKept = () => {
        assert.strictEqual(harness.pane.input, input);
        assert.strictEqual(harness.pane.activeConversationLens, harness.lens);
        assert.strictEqual(harness.connection.getConnectionSnapshot().engineIdentityId, "reveal-engine");
        assert.strictEqual(isConversationEngineLive(harness.connection.getConnectionPhase(), harness.connection.getConnectionSnapshot().pairingPending), true);
        assert.strictEqual(isConversationPairingHold(harness.connection), false);
        assert.strictEqual(harness.rosterService.getActiveSessionId(), harness.primaryId);
        assert.strictEqual(harness.lens.boundSessionId, harness.primaryId);
        assert.strictEqual(harness.lens.sessionViewLease, lease);
        assert.strictEqual(lease.snapshot, snapshot);
        assert.strictEqual(harness.lens.lastAttachedEntries, entries);
        assert.strictEqual(harness.pane.getReadingColumn()?.querySelector(`.conversation-lens-turn[data-turn-id="${harness.primaryId}-body"] .conversation-lens-turn-body`)?.textContent, "L2 keep this body");
      };
      const failed = harness.deferCatalog();
      harness.notify("live");
      await bounded(failed.started.p, "same-live catalog refresh must start");
      assert.strictEqual(getConversationSessionReadiness(harness.rosterService), "loading");
      assertKept();
      await failed.result.error(new Error("catalog unavailable"));
      await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), "failed real list must settle");
      assert.strictEqual(getConversationSessionReadiness(harness.rosterService), "unavailable");
      assertKept();
      const recovered = harness.deferCatalog();
      harness.notify("live");
      await bounded(recovered.started.p, "same-live recovery list must start");
      assertKept();
      await completeCatalog(harness, recovered);
      assertKept();
    });
    test("L3 loading and real list rejection leave a visible empty owner missing until successful ready", async () => {
      const harness = await createEngineRevealHarness();
      const failed = await startEmptyCatalogRefresh(harness);
      const binds = observePaneBinds(harness.lens);
      assertVisibleMissing(harness);
      await failed.result.error(new Error("listSessions rejected"));
      await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), "real rejected list must settle");
      assert.strictEqual(getConversationSessionReadiness(harness.rosterService), "unavailable");
      assertVisibleMissing(harness);
      assert.strictEqual(binds(), 0);
      const recovery = await startEmptyCatalogRefresh(harness);
      const beforeReady = binds();
      await completeCatalog(harness, recovery);
      assert.strictEqual(binds() - beforeReady, 1, "the session-ready listener must call the real Pane bind once");
      await assertEngineFramePaints(harness, harness.pane, harness.primaryId, "L3 catalog recovery");
    });
    for (const state of ["disconnected", "connected pairing", "connecting pairing"]) {
      test(`L3 ${state} QueueReader session window keeps a naturally missing visible owner unbound`, async () => {
        let harness;
        let armed = false;
        let binds;
        const order = [];
        const capture = (position) => {
          assert.ok(harness);
          assert.ok(binds);
          const lens = harness.pane.activeConversationLens;
          assert.ok(lens);
          return {
            position,
            pane: harness.pane,
            input: harness.pane.input,
            lens,
            bound: lens.boundSessionId,
            visible: harness.sessionWindowService.isSessionWindowVisible(harness.primaryId),
            suspended: lens.sessionViewBindingSuspended,
            disposed: lens.isDisposed,
            lease: lens.sessionViewLease,
            phase: harness.connection.getConnectionPhase().kind,
            pairing: harness.connection.getConnectionSnapshot().pairingPending,
            connected: harness.rosterService.isEngineConnected(),
            readiness: getConversationSessionReadiness(harness.rosterService),
            queue: harness.rosterService.getMessageQueueState(harness.primaryId).readState,
            bindCalls: binds()
          };
        };
        const samples = [];
        harness = await createEngineRevealHarness((roster) => {
          store.add(roster.onDidChangeSession((id) => {
            if (armed && id === "lease-s1" && samples.length === 0 && roster.getMessageQueueState(id).readState === "stale") {
              order.push("session before");
              samples.push(capture("before"));
            }
          }));
        });
        const current = harness;
        binds = observePaneBinds(current.lens);
        store.add(current.rosterService.onDidChangeSession((id) => {
          if (armed && id === current.primaryId && samples.length === 1) {
            order.push("session after");
            samples.push(capture("after"));
          }
        }));
        const pending = await startEmptyCatalogRefresh(current);
        assert.strictEqual(current.rosterService.getMessageQueueState(current.primaryId).readState, "unsupported");
        const beforeCalls = binds();
        const input = current.pane.input;
        armed = true;
        order.push("UA start");
        current.notify(state);
        order.push("UA return");
        armed = false;
        assert.deepStrictEqual(order, ["UA start", "session before", "session after", "UA return"], "QueueReader must expose the actual independent callback window");
        assert.strictEqual(samples.length, 2);
        for (const sample of samples) {
          assert.strictEqual(sample.pane, current.pane);
          assert.strictEqual(sample.input, input);
          assert.strictEqual(sample.lens, current.lens);
          assert.strictEqual(sample.bound, current.primaryId);
          assert.strictEqual(sample.visible, true);
          assert.strictEqual(sample.suspended, false);
          assert.strictEqual(sample.disposed, false);
          assert.strictEqual(sample.lease, void 0);
          assert.strictEqual(sample.phase, state === "disconnected" ? "disconnected" : state === "connecting pairing" ? "connecting" : "connected");
          assert.strictEqual(sample.pairing, state !== "disconnected");
          assert.strictEqual(sample.connected, false);
          assert.strictEqual(sample.readiness, "ready");
          assert.strictEqual(sample.queue, "stale");
          assert.strictEqual(sample.bindCalls, beforeCalls, "new reconcile must not bind within the non-live callback window");
        }
        await pending.result.complete(current.catalog);
        await bounded(current.rosterService.whenEngineCatalogRefreshComplete(), "stale pending catalog must drain");
        const recovery = await startEmptyCatalogRefresh(current);
        await completeCatalog(current, recovery);
        await assertEngineFramePaints(current, current.pane, current.primaryId, `L3 ${state} restored`);
      });
    }
    test("L4 hidden suspended owner stays unbound through failed and ready catalogs until public restore", async () => {
      const harness = await createEngineRevealHarness();
      await harness.sessionWindowService.openSessionBeside("lease-s2");
      const pane = await waitForEnginePane(partFor(harness.parts, "lease-s2"));
      trackEditors(harness.parts);
      const lens = pane.activeConversationLens;
      assert.ok(lens?.sessionViewLease);
      harness.sessionWindowService.hideSessionWindow("lease-s2");
      assert.strictEqual(lens.sessionViewBindingSuspended, true);
      assert.strictEqual(lens.sessionViewLease, void 0);
      const binds = observePaneBinds(lens);
      const failed = harness.deferCatalog();
      harness.notify("live");
      await bounded(failed.started.p, "hidden control real list must start");
      await failed.result.error(new Error("hidden catalog failure"));
      await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), "hidden failure must settle");
      assert.strictEqual(lens.sessionViewLease, void 0);
      assert.strictEqual(binds(), 0);
      const ready = harness.deferCatalog();
      harness.notify("live");
      await bounded(ready.started.p, "hidden recovery list must start");
      await completeCatalog(harness, ready);
      assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible("lease-s2"), false);
      assert.strictEqual(lens.sessionViewBindingSuspended, true);
      assert.strictEqual(lens.sessionViewLease, void 0);
      assert.strictEqual(binds(), 0);
      harness.sessionWindowService.restoreSessionWindow("lease-s2");
      assert.strictEqual(lens.sessionViewBindingSuspended, false);
      const restoredLens = pane.activeConversationLens;
      assert.ok(restoredLens);
      assert.strictEqual(restoredLens, lens);
      assert.strictEqual(restoredLens.sessionViewLease?.sessionId, "lease-s2");
      await assertEngineFramePaints(harness, pane, "lease-s2", "L4 public restore");
      const retiredLease = restoredLens.sessionViewLease;
      assert.ok(retiredLease);
      const retainedObserver = store.add(harness.rosterService.acquireSessionView("lease-s2"));
      assert.notStrictEqual(retainedObserver, retiredLease);
      const hostLease = harness.sessionView.acquired.find((lease) => lease.sessionId === "lease-s2" && !harness.sessionView.released.has(lease.leaseId));
      assert.ok(hostLease, "the restored Pane and observer must share an acquired s2 host lease");
      let retiredFrames = 0;
      store.add(retiredLease.onDidApplyFrame(() => {
        retiredFrames++;
      }));
      const removed = harness.deferCatalog();
      harness.notify("live");
      await bounded(removed.started.p, "public removal catalog must start");
      const survivingCatalog = { sessions: harness.catalog.sessions.filter((session) => session.sessionId !== "lease-s2") };
      await removed.result.complete(survivingCatalog);
      await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), "public prune must settle");
      assert.strictEqual(harness.sessionWindowService.getLeafSlots("lease-s2"), void 0);
      assert.strictEqual(harness.sessionWindowService.isSessionWindowHidden("lease-s2"), false);
      assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible("lease-s2"), false);
      assert.strictEqual(lens.isDisposed, true);
      const retiredSnapshot = retiredLease.snapshot;
      const framesAfterRemoval = retiredFrames;
      const observed = Event.toPromise(retainedObserver.onDidApplyFrame);
      try {
        harness.sessionView.emitSession("lease-s2", "L4 retained observer only");
        await bounded(observed, "the live retained observer must admit the post-prune host frame");
        assert.notStrictEqual(retainedObserver.snapshot, retiredSnapshot);
        assert.strictEqual(retiredLease.snapshot, retiredSnapshot, "the disposed Pane lease must no longer receive shared host snapshots");
        assert.strictEqual(retiredFrames, framesAfterRemoval);
      } finally {
        observed.cancel();
        retainedObserver.dispose();
      }
      assert.strictEqual(harness.sessionView.released.has(hostLease.leaseId), true, "the retired Pane and roster must release their ownership before the final observer releases the host");
      const afterRemoval = binds();
      const late = harness.deferCatalog();
      harness.notify("live");
      await bounded(late.started.p, "post-removal catalog must start");
      await late.result.complete(survivingCatalog);
      await bounded(harness.rosterService.whenEngineCatalogRefreshComplete(), "post-removal catalog must settle");
      assert.strictEqual(binds(), afterRemoval, "later ready notices cannot revive the removed non-hidden leaf");
      assert.strictEqual(retiredLease.snapshot, retiredSnapshot);
      assert.strictEqual(retiredFrames, framesAfterRemoval);
      assert.strictEqual(harness.sessionView.released.has(hostLease.leaseId), true);
      await assertEngineFramePaints(harness, harness.pane, harness.primaryId, "L4 surviving owner");
    });
    test("L4 an unmounted non-hidden bound key cannot reconcile before its public leaf exists", async () => {
      const harness = await createEngineRevealHarness();
      const pending = await startEmptyCatalogRefresh(harness);
      const input = store.add(new ConversationChatInput(getConversationChatResource("lease-s2", "unmounted")));
      const part = partFor(harness.parts, harness.primaryId);
      await harness.editorService.openEditor(input, void 0, part.activeGroup);
      const pane = part.activeGroup.activeEditorPane;
      assert.ok(pane instanceof ConversationEditorPane);
      const lens = pane.activeConversationLens;
      assert.ok(lens);
      assert.strictEqual(pane.input, input);
      assert.strictEqual(lens.boundSessionId, "lease-s2");
      assert.strictEqual(lens.sessionViewLease, void 0);
      assert.strictEqual(lens.sessionViewBindingSuspended, false);
      assert.strictEqual(harness.sessionWindowService.isSessionWindowHidden("lease-s2"), false);
      assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible("lease-s2"), false);
      const binds = observePaneBinds(lens);
      await completeCatalog(harness, pending);
      assert.strictEqual(lens.sessionViewLease, void 0);
      assert.strictEqual(binds(), 0, "not-hidden is not evidence of a visible leaf");
      await harness.sessionWindowService.openSessionBeside("lease-s2");
      const mounted = await waitForEnginePane(partFor(harness.parts, "lease-s2"));
      trackEditors(harness.parts);
      await assertEngineFramePaints(harness, mounted, "lease-s2", "L4 mounted successor");
    });
    for (const action of ["clearInput", "dispose", "switch input"]) {
      test(`L5 ${action} during real catalog pending cannot revive the captured owner`, async () => {
        const harness = await createEngineRevealHarness();
        const pending = await startEmptyCatalogRefresh(harness);
        const oldInput = harness.pane.input;
        const oldLens = harness.lens;
        const oldBinds = observePaneBinds(oldLens);
        if (action === "clearInput") {
          harness.pane.clearInput();
        } else if (action === "dispose") {
          harness.pane.dispose();
        } else {
          const input = store.add(new ConversationChatInput(getConversationChatResource(harness.primaryId, "successor")));
          await harness.editorService.openEditor(input, void 0, partFor(harness.parts, harness.primaryId).activeGroup);
          assert.strictEqual(harness.pane.input, input);
          assert.notStrictEqual(harness.pane.input, oldInput);
        }
        const beforeReady = oldBinds();
        await completeCatalog(harness, pending);
        if (action === "switch input") {
          assert.strictEqual(harness.pane.activeConversationLens?.boundSessionId, harness.primaryId);
          assert.strictEqual(oldBinds() - beforeReady, 1, "only the current input listener may reconcile");
          assert.strictEqual(harness.pane.activeConversationLens?.sessionViewLease?.sessionId, harness.primaryId);
        } else {
          assert.strictEqual(harness.pane.activeConversationLens, void 0);
          assert.strictEqual(oldLens.isDisposed, true);
          assert.strictEqual(oldBinds(), beforeReady, "late catalog/session notices cannot bind the retired owner");
        }
      });
    }
    test("L6 repeated real session notices keep the recovered lease and continue delivering frames", async () => {
      const harness = await createEngineRevealHarness();
      const pending = await startEmptyCatalogRefresh(harness);
      await completeCatalog(harness, pending);
      await assertEngineFramePaints(harness, harness.pane, harness.primaryId, "L6 first frame");
      const lease = harness.lens.sessionViewLease;
      assert.ok(lease);
      const count = harness.sessionView.acquired.length;
      for (let i = 0; i < 2; i++) {
        const refresh = harness.deferCatalog();
        harness.notify("live");
        await bounded(refresh.started.p, "duplicate real refresh must start");
        await completeCatalog(harness, refresh);
        assert.strictEqual(harness.lens.sessionViewLease, lease);
        assert.strictEqual(harness.sessionView.acquired.length, count, "observation owners must not imply a new physical acquisition");
      }
      await assertEngineFramePaints(harness, harness.pane, harness.primaryId, "L6 later frame");
      assert.strictEqual(harness.lens.sessionViewLease, lease);
    });
    test("L7 two pinned visible owners recover their own bounds from one active-session catalog notice", async () => {
      const harness = await createEngineRevealHarness();
      await harness.sessionWindowService.openSessionBeside("lease-s2");
      const second = await waitForEnginePane(partFor(harness.parts, "lease-s2"));
      trackEditors(harness.parts);
      const lens2 = second.activeConversationLens;
      assert.ok(lens2?.sessionViewLease);
      await harness.sessionWindowService.revealSessionWindow(harness.primaryId);
      assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(harness.primaryId), true);
      assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible("lease-s2"), true);
      const pending = await startEmptyCatalogRefresh(harness);
      assertVisibleMissing(harness, second, "lease-s2");
      const active = harness.rosterService.getActiveSessionId();
      const notified = [];
      store.add(harness.rosterService.onDidChangeSession((id) => {
        notified.push(id);
      }));
      await completeCatalog(harness, pending);
      assert.ok(notified.includes(active));
      assert.ok(!notified.includes("lease-s2"), "the inactive pinned leaf cannot rely on its own event id");
      assert.strictEqual(harness.pane.activeConversationLens, harness.lens);
      assert.strictEqual(second.activeConversationLens, lens2);
      assert.strictEqual(harness.lens.sessionViewLease?.sessionId, harness.primaryId);
      assert.strictEqual(lens2.sessionViewLease?.sessionId, "lease-s2");
      assert.notStrictEqual(harness.lens.sessionViewLease, lens2.sessionViewLease);
      await assertEngineFramePaints(harness, harness.pane, harness.primaryId, "L7 first leaf only");
      await assertEngineFramePaints(harness, second, "lease-s2", "L7 second leaf only");
      assert.ok(!harness.pane.getReadingColumn()?.textContent?.includes("L7 second leaf only"));
      assert.ok(!second.getReadingColumn()?.textContent?.includes("L7 first leaf only"));
    });
  });
  test("8 single-leaf reveal A\u2192B\u2192A keeps one visible primary without hide button", async () => {
    const harness = await createRevealHarness();
    const { parts, sessionWindowService, rosterService, primaryId } = harness;
    const b = rosterService.seedSessionQuietly();
    await sessionWindowService.revealSessionWindow(b);
    const partB = partFor(parts, b);
    await waitForSessionPane(harness, b);
    assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [b]);
    assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);
    assert.strictEqual(partB.sessionKey, b);
    assert.strictEqual(parts.getActiveConversationEditorPart()?.sessionKey, b);
    assert.ok(sessionWindowService.isSessionWindowHidden(primaryId));
    assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
    assert.strictEqual(hideButton(sessionWindowService, b)?.hidden, true);
    await sessionWindowService.revealSessionWindow(primaryId);
    await waitForSessionPane(harness, primaryId);
    assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [primaryId]);
    assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
    assert.strictEqual(hideButton(sessionWindowService, primaryId)?.hidden, true);
  });
  test("hide focused secondary leaf moves focus to primary", async () => {
    const harness = createLightweightWindowHarness();
    await timeout(0);
    const primaryId = harness.rosterService.getActiveSessionId();
    await harness.sessionWindowService.ensurePrimaryWindow(primaryId);
    const secondaryId = harness.rosterService.seedSessionQuietly();
    await harness.sessionWindowService.openSessionBeside(secondaryId);
    await harness.sessionWindowService.revealSessionWindow(secondaryId);
    assert.strictEqual(harness.sessionWindowService.getFocusedLeafSessionKey(), secondaryId);
    harness.sessionWindowService.hideSessionWindow(secondaryId);
    assert.strictEqual(harness.sessionWindowService.isSessionWindowHidden(secondaryId), true);
    assert.strictEqual(harness.sessionWindowService.getFocusedLeafSessionKey(), primaryId);
    const primaryLeaf = harness.sessionWindowService.getLeafSlots(primaryId);
    const active = getActiveElement();
    assert.ok(
      primaryLeaf.container === active || primaryLeaf.container.contains(active),
      "focus must leave the hidden leaf and land on the visible primary"
    );
  });
  test("8 two visible leaves: reveal already-visible leaf focuses it", async () => {
    const harness = await createRevealHarness();
    const { parts, sessionWindowService, rosterService, primaryId, conversationPart } = harness;
    const b = rosterService.seedSessionQuietly();
    await sessionWindowService.openSessionBeside(b);
    await waitForSessionPane(harness, b);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
    await sessionWindowService.revealSessionWindow(b);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
    assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
    assert.strictEqual(rosterService.getActiveSessionId(), b);
    assert.strictEqual(parts.getActiveConversationEditorPart()?.sessionKey, b);
    const leafB = sessionWindowService.getLeafSlots(b);
    assert.ok(leafB);
    const active = getActiveElement();
    assert.ok(
      leafB.container === active || leafB.container.contains(active),
      "focus must stay in the revealed leaf, not snap back to primary"
    );
    const chrome = countLeafChrome(sessionWindowService, conversationPart);
    assert.strictEqual(chrome.bars, 2);
    assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
    assert.strictEqual(partFor(parts, b).sessionKey, b);
  });
  test("cancelled already-visible reveal does not switch the active session back", async () => {
    const harness = await createRevealHarness();
    const { parts, sessionWindowService, rosterService, primaryId } = harness;
    const b = rosterService.seedSessionQuietly();
    await sessionWindowService.openSessionBeside(b);
    const paneA = await waitForSessionPane(harness, primaryId);
    const paneB = await waitForSessionPane(harness, b);
    assert.ok(paneA.leafSessionBarHost);
    assert.ok(paneB.leafSessionBarHost);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
    let releaseA = () => {
    };
    const gate = new Promise((resolve) => {
      releaseA = resolve;
    });
    partFor(parts, primaryId).whenReady = gate;
    const switched = [];
    const originalSwitch = rosterService.switchSession.bind(rosterService);
    rosterService.switchSession = (sessionId) => {
      switched.push(sessionId);
      originalSwitch(sessionId);
    };
    const first = paneA.leafSessionBarHost.switchLeafSession(primaryId);
    try {
      await timeout(0);
      await paneB.leafSessionBarHost.switchLeafSession(b);
      assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
      assert.strictEqual(rosterService.getActiveSessionId(), b);
      switched.length = 0;
      releaseA();
      await first;
      assert.deepStrictEqual(switched, []);
      assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), b);
      assert.strictEqual(rosterService.getActiveSessionId(), b);
    } finally {
      releaseA();
    }
  });
  test("hide during pane-less reveal wait does not steal focus or the active session", async function() {
    this.timeout(15e3);
    const harness = createLightweightWindowHarness();
    await timeout(0);
    const { sessionWindowService, rosterService, conversationParts } = harness;
    const primaryId = rosterService.getActiveSessionId();
    await sessionWindowService.ensurePrimaryWindow(primaryId);
    const secondaryId = rosterService.seedSessionQuietly();
    await sessionWindowService.openSessionBeside(secondaryId);
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
    const secondaryPart = conversationParts.find((part) => part.sessionKey === secondaryId);
    assert.ok(secondaryPart);
    const group = secondaryPart.activeGroup;
    group.activeEditorPane = void 0;
    group.onDidActiveEditorChange = Event.None;
    await sessionWindowService.revealSessionWindow(primaryId);
    assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
    assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
    const primaryLeaf = sessionWindowService.getLeafSlots(primaryId);
    const activeBefore = getActiveElement();
    assert.ok(
      primaryLeaf.container === activeBefore || primaryLeaf.container.contains(activeBefore),
      "primary must own focus before the stalled reveal"
    );
    const switched = [];
    const originalSwitch = rosterService.switchSession.bind(rosterService);
    rosterService.switchSession = (sessionId) => {
      switched.push(sessionId);
      originalSwitch(sessionId);
    };
    let settled = false;
    const reveal = sessionWindowService.revealSessionWindow(secondaryId).finally(() => {
      settled = true;
    });
    await timeout(0);
    assert.strictEqual(settled, false, "reveal must still be waiting for an editor pane");
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
    sessionWindowService.hideSessionWindow(secondaryId);
    assert.strictEqual(sessionWindowService.isSessionWindowHidden(secondaryId), true);
    assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
    assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
    const activeDuring = getActiveElement();
    assert.ok(
      primaryLeaf.container === activeDuring || primaryLeaf.container.contains(activeDuring),
      "focus must stay on the primary while the hidden leaf is still waiting"
    );
    await reveal;
    assert.strictEqual(settled, true);
    assert.strictEqual(sessionWindowService.isSessionWindowHidden(secondaryId), true);
    assert.strictEqual(sessionWindowService.getFocusedLeafSessionKey(), primaryId);
    assert.strictEqual(rosterService.getActiveSessionId(), primaryId);
    const activeAfter = getActiveElement();
    assert.ok(
      primaryLeaf.container === activeAfter || primaryLeaf.container.contains(activeAfter),
      "focus must stay on the primary after the pane wait ends"
    );
    assert.deepStrictEqual(switched, []);
  });
  test("10 SelectBox path on real pane changes the leaf (PRD-002 #1)", async () => {
    const harness = await createRevealHarness();
    const { parts, sessionWindowService, rosterService, primaryId } = harness;
    const b = rosterService.seedSessionQuietly();
    const pane = await waitForSessionPane(harness, primaryId);
    assert.ok(pane.leafSessionBarHost);
    await pane.leafSessionBarHost.switchLeafSession(b);
    await waitForSessionPane(harness, b);
    assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
    assert.ok(partFor(parts, b).activeGroup.activeEditor);
  });
  test("10 two visible leaves: SelectBox on one leaf replaces that leaf with a third session", async () => {
    const harness = await createRevealHarness();
    const { parts, sessionWindowService, rosterService, primaryId } = harness;
    const b = rosterService.seedSessionQuietly();
    const c = rosterService.seedSessionQuietly();
    await sessionWindowService.openSessionBeside(b);
    const paneB = await waitForSessionPane(harness, b);
    assert.ok(paneB.leafSessionBarHost);
    await paneB.leafSessionBarHost.switchLeafSession(c);
    await waitForSessionPane(harness, c);
    const visible = visibleLeafKeys(sessionWindowService);
    assert.strictEqual(visible.length, 2);
    assert.ok(visible.includes(primaryId), "the other leaf must stay");
    assert.ok(visible.includes(c), "the operated leaf must become the third session");
    assert.ok(!visible.includes(b), "the operated leaf must not remain");
    assert.strictEqual(partFor(parts, primaryId).sessionKey, primaryId);
    assert.strictEqual(partFor(parts, c).sessionKey, c);
    assert.strictEqual(sessionWindowService.isSessionWindowHidden(b), true);
  });
  test("does not leak unhandled rejection when switchToSession switchLeafSession rejects and onUnexpectedError warn-then-rethrows", async () => {
    const harness = await createRevealHarness();
    const pane = await waitForSessionPane(harness, harness.primaryId);
    assert.ok(pane.leafSessionBarHost);
    const paintBoom = new Error("switch boom");
    pane.leafSessionBarHost.switchLeafSession = async () => {
      throw paintBoom;
    };
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      pane.leafSessionBarHost.switchToSession("other-session");
    });
  });
  test("does not leak unhandled rejection when SelectBox helper switchToSession switchLeafSession rejects and onUnexpectedError warn-then-rethrows", async () => {
    const harness = await createRevealHarness();
    const pane = await waitForSessionPane(harness, harness.primaryId);
    assert.ok(pane.leafSessionBarHost);
    const paintBoom = new Error("switch boom");
    pane.leafSessionBarHost.switchLeafSession = async () => {
      throw paintBoom;
    };
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      switchToSessionHelper(pane.leafSessionBarHost, "other-session");
    });
  });
  test("SelectBox helper switchToSession fire-and-forget voids double-catch onUnexpectedError", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts`);
    const doubleCatch = ".catch(onUnexpectedError).catch(onUnexpectedError)";
    assert.ok(source.includes(`void host.switchLeafSession(sessionId)${doubleCatch}`));
    assert.ok(!source.includes("void host.switchLeafSession(sessionId);"));
  });
  test("10 New Session in stub path becomes the only visible leaf", async () => {
    const harness = await createRevealHarness();
    const { sessionWindowService, rosterService, primaryId } = harness;
    const pane = await waitForSessionPane(harness, primaryId);
    assert.ok(pane.leafSessionBarHost);
    pane.leafSessionBarHost.createNewSession();
    const deadline = Date.now() + 3e3;
    let newId = rosterService.getActiveSessionId();
    while (newId === primaryId && Date.now() < deadline) {
      await timeout(20);
      newId = rosterService.getActiveSessionId();
    }
    assert.notStrictEqual(newId, primaryId);
    await waitForSessionPane(harness, newId);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
    assert.strictEqual(sessionWindowService.getPrimarySessionKey(), newId);
    assert.strictEqual(hideButton(sessionWindowService, newId)?.hidden, true);
    assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
  });
  test("13 each visible leaf has exactly one SessionBar and window-nav; Part slot has none", async () => {
    const harness = await createRevealHarness();
    const { sessionWindowService, rosterService, conversationPart, primaryId } = harness;
    const b = rosterService.seedSessionQuietly();
    const c = rosterService.seedSessionQuietly();
    await sessionWindowService.revealSessionWindow(b);
    await waitForSessionPane(harness, b);
    await sessionWindowService.revealSessionWindow(c);
    await waitForSessionPane(harness, c);
    await sessionWindowService.revealSessionWindow(primaryId);
    await waitForSessionPane(harness, primaryId);
    let chrome = countLeafChrome(sessionWindowService, conversationPart);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 1);
    assert.strictEqual(chrome.bars, 1);
    assert.strictEqual(chrome.navs, 1);
    assert.strictEqual(chrome.partSlotBars, 0);
    await sessionWindowService.openSessionBeside(b);
    await waitForSessionPane(harness, b);
    chrome = countLeafChrome(sessionWindowService, conversationPart);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
    assert.strictEqual(chrome.bars, 2);
    assert.strictEqual(chrome.navs, 2);
    assert.strictEqual(chrome.partSlotBars, 0);
  });
  test("13b leaf SessionBar and container receive is-narrow when pane width is under 450px", async () => {
    const harness = await createRevealHarness();
    const { sessionWindowService, primaryId } = harness;
    const pane = await waitForSessionPane(harness, primaryId);
    const leaf = sessionWindowService.getLeafSlots(primaryId);
    pane.layout(new Dimension(500, 600));
    assert.ok(leaf.sessionBar.classList.contains("is-medium"));
    assert.ok(!leaf.sessionBar.classList.contains("is-narrow"));
    pane.layout(new Dimension(400, 600));
    assert.ok(leaf.sessionBar.classList.contains("is-narrow"));
    assert.ok(leaf.container.classList.contains("is-narrow"));
    assert.ok(!leaf.sessionBar.classList.contains("is-compact"));
    pane.layout(new Dimension(250, 600));
    assert.ok(leaf.sessionBar.classList.contains("is-narrow"));
    assert.ok(leaf.sessionBar.classList.contains("is-compact"));
    pane.layout(new Dimension(950, 600));
    assert.ok(!leaf.sessionBar.classList.contains("is-narrow"));
    assert.ok(!leaf.container.classList.contains("is-narrow"));
    assert.ok(!leaf.sessionBar.classList.contains("is-compact"));
  });
  test("14 reveal mounts overlay so openSubAgent does not throw", async () => {
    const harness = await createRevealHarness();
    const { sessionWindowService, sessionChatService, rosterService } = harness;
    const b = rosterService.seedSessionQuietly();
    await sessionWindowService.revealSessionWindow(b);
    await waitForSessionPane(harness, b);
    await sessionChatService.openSubAgent(b, "tool-from-reveal", "Reveal tool");
    assert.strictEqual(sessionChatService.isSubAgentDialogOpen(b), true);
  });
  test("15 latest-wins reveal ends on B; bind-failed sentinel does not create a leaf", async () => {
    const { sessionWindowService, rosterService, primaryId } = await createRevealHarness();
    const a = rosterService.seedSessionQuietly();
    const b = rosterService.seedSessionQuietly();
    const first = sessionWindowService.revealSessionWindow(a);
    const second = sessionWindowService.revealSessionWindow(b);
    await Promise.all([first, second]);
    assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [b]);
    assert.strictEqual(sessionWindowService.getPrimarySessionKey(), b);
    const keysBefore = [...sessionWindowService.getAllLeafSessionKeys()];
    rosterService.fireActiveSession(ENGINE_BIND_FAILED_SESSION_ID);
    await timeout(20);
    assert.deepStrictEqual([...sessionWindowService.getAllLeafSessionKeys()], keysBefore);
    assert.strictEqual(sessionWindowService.getLeafSlots(ENGINE_BIND_FAILED_SESSION_ID), void 0);
    assert.ok(sessionWindowService.getLeafSlots(primaryId) || sessionWindowService.getLeafSlots(b));
  });
  test("onDidDeleteSession disposes visible leaf when bind-failed skips reveal", async () => {
    const harness = createLightweightWindowHarness();
    await timeout(0);
    const sessionId = harness.rosterService.getActiveSessionId();
    await harness.sessionWindowService.ensurePrimaryWindow(sessionId);
    assert.deepStrictEqual(visibleLeafKeys(harness.sessionWindowService), [sessionId]);
    assert.ok(harness.conversationParts.some((part) => part.sessionKey === sessionId));
    harness.rosterService.fireActiveSession(ENGINE_BIND_FAILED_SESSION_ID);
    harness.rosterService.fireDeletedSession(sessionId);
    assert.deepStrictEqual(visibleLeafKeys(harness.sessionWindowService), []);
    assert.strictEqual(harness.sessionWindowService.getPrimarySessionKey(), void 0);
    assert.ok(!harness.sessionWindowService.getAllLeafSessionKeys().includes(sessionId));
    assert.ok(!harness.conversationParts.some((part) => part.sessionKey === sessionId));
  });
  test("onDidDeleteSession disposes a hidden leaf and its editor part", async () => {
    const harness = await createRevealHarness();
    const { parts, sessionWindowService, rosterService, primaryId } = harness;
    const secondaryId = rosterService.seedSessionQuietly();
    await sessionWindowService.openSessionBeside(secondaryId);
    await waitForSessionPane(harness, secondaryId);
    assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
    assert.ok(sessionWindowService.getLeafSlots(primaryId));
    assert.ok(parts.conversationParts.some((part) => part.sessionKey === primaryId));
    rosterService.fireDeletedSession(primaryId);
    assert.strictEqual(sessionWindowService.getLeafSlots(primaryId), void 0);
    assert.ok(!parts.conversationParts.some((part) => part.sessionKey === primaryId));
    assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), [secondaryId]);
  });
  test("15 stub-seed untitled onDidChangeActiveSession still reveals", async () => {
    const harness = await createRevealHarness();
    const { sessionWindowService, rosterService } = harness;
    assert.ok(isEngineRosterPlaceholderSessionId("untitled"));
    assert.ok(rosterService.getSessions().some((session) => session.id === "untitled"));
    const b = rosterService.seedSessionQuietly();
    await sessionWindowService.revealSessionWindow(b);
    await waitForSessionPane(harness, b);
    assert.strictEqual(sessionWindowService.isSessionWindowHidden("untitled"), true);
    rosterService.fireActiveSession("untitled");
    await waitForSessionPane(harness, "untitled");
    assert.strictEqual(sessionWindowService.isSessionWindowVisible("untitled"), true);
    assert.deepStrictEqual(visibleLeafKeys(sessionWindowService), ["untitled"]);
    assert.strictEqual(sessionWindowService.getPrimarySessionKey(), "untitled");
  });
  test("15 reveal create failure rolls back part + leaf and rebuilds the same key", async () => {
    const rosterService = store.add(new QuietRosterService());
    const gridHost = document.createElement("div");
    document.body.appendChild(gridHost);
    store.add({ dispose: () => gridHost.remove() });
    const conversationParts = [];
    let throwOnCreate = false;
    const editorGroupsService = {
      createConversationEditorPart: (_parent, sessionKey) => {
        if (throwOnCreate) {
          throw new Error("reveal boom");
        }
        const part = { sessionKey, whenReady: Promise.resolve(), activeGroup: { focus: () => {
        }, activeEditorPane: { getId: () => ConversationEditorPaneId } } };
        conversationParts.push(part);
        return part;
      },
      disposeConversationEditorPart: (sessionKey) => {
        const index = conversationParts.findIndex((part) => part.sessionKey === sessionKey);
        if (index >= 0) {
          conversationParts.splice(index, 1);
        }
      },
      setFocusedConversationLeaf: () => {
      },
      getFocusedConversationLeaf: () => void 0,
      get conversationParts() {
        return conversationParts;
      }
    };
    const errors = [];
    const sessionWindowService = store.add(new ConversationSessionWindowService(
      {
        onDidCreateSlots: Event.None,
        onDidFocus: Event.None,
        getSlots: () => ({ sessionBar: document.createElement("div"), sessionWindowGrid: gridHost, editorPartHost: void 0 }),
        setFocusedLeafContainer: () => {
        },
        focus: () => {
        }
      },
      editorGroupsService,
      rosterService,
      new NullLogService(),
      {
        error: (message) => {
          errors.push(typeof message === "string" ? message : getErrorMessage(message));
        }
      }
    ));
    await timeout(0);
    const primaryId = rosterService.getActiveSessionId();
    await sessionWindowService.ensurePrimaryWindow(primaryId);
    const target = rosterService.seedSessionQuietly();
    throwOnCreate = true;
    await sessionWindowService.revealSessionWindow(target);
    assert.ok(errors.some((error) => error.includes("reveal boom")));
    assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
    assert.strictEqual(sessionWindowService.getLeafSlots(target), void 0);
    assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(target));
    assert.ok(!conversationParts.some((part) => part.sessionKey === target));
    throwOnCreate = false;
    await sessionWindowService.revealSessionWindow(target);
    assert.ok(sessionWindowService.getLeafSlots(target));
    assert.ok(conversationParts.some((part) => part.sessionKey === target));
    assert.ok(sessionWindowService.getLeafSlots(target)?.container.isConnected);
  });
  async function openTwoLightweightLeaves() {
    const errors = [];
    const harness = createLightweightWindowHarness();
    harness.setNotifyError((message) => {
      errors.push(typeof message === "string" ? message : getErrorMessage(message));
    });
    await timeout(0);
    const primaryId = harness.rosterService.getActiveSessionId();
    await harness.sessionWindowService.ensurePrimaryWindow(primaryId);
    const secondaryId = harness.rosterService.seedSessionQuietly();
    await harness.sessionWindowService.openSessionBeside(secondaryId);
    assert.strictEqual(harness.sessionWindowService.getVisibleWindowCount(), 2);
    assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(primaryId), true);
    assert.strictEqual(harness.sessionWindowService.isSessionWindowVisible(secondaryId), true);
    const incomingId = harness.rosterService.seedSessionQuietly();
    return { harness, errors, primaryId, secondaryId, incomingId };
  }
  test("secondary replace create failure restores the outgoing leaf and notifies", async () => {
    const { harness, errors, primaryId, secondaryId, incomingId } = await openTwoLightweightLeaves();
    const { sessionWindowService, conversationParts } = harness;
    harness.setThrowOnCreate(true);
    await sessionWindowService.revealSessionWindow(incomingId, { replace: secondaryId });
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
    assert.strictEqual(sessionWindowService.getLeafSlots(incomingId), void 0);
    assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(incomingId));
    assert.ok(!conversationParts.some((part) => part.sessionKey === incomingId));
    assert.ok(errors.some((error) => error.includes("reveal boom")));
  });
  test("secondary replace whenReady failure restores the outgoing leaf and notifies", async () => {
    const { harness, errors, primaryId, secondaryId, incomingId } = await openTwoLightweightLeaves();
    const { sessionWindowService, conversationParts } = harness;
    harness.setRejectWhenReady(true);
    await sessionWindowService.revealSessionWindow(incomingId, { replace: secondaryId });
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
    assert.strictEqual(sessionWindowService.getLeafSlots(incomingId), void 0);
    assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(incomingId));
    assert.ok(!conversationParts.some((part) => part.sessionKey === incomingId));
    assert.ok(errors.some((error) => error.includes("whenReady boom")));
  });
  test("primary replace create failure does not hide the old primary", async () => {
    const { harness, errors, primaryId, secondaryId, incomingId } = await openTwoLightweightLeaves();
    const { sessionWindowService } = harness;
    harness.setThrowOnCreate(true);
    await sessionWindowService.revealSessionWindow(incomingId, { replace: primaryId });
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(primaryId), true);
    assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), false);
    assert.strictEqual(sessionWindowService.isSessionWindowVisible(secondaryId), true);
    assert.strictEqual(sessionWindowService.getPrimarySessionKey(), primaryId);
    assert.strictEqual(sessionWindowService.getVisibleWindowCount(), 2);
    assert.strictEqual(sessionWindowService.getLeafSlots(incomingId), void 0);
    assert.ok(!sessionWindowService.getAllLeafSessionKeys().includes(incomingId));
    assert.ok(errors.some((error) => error.includes("reveal boom")));
  });
  test("17 hiding a leaf releases its lens lease and restore reacquires it", async () => {
    const harness = await createRevealHarness();
    const { parts, sessionWindowService, rosterService, primaryId, sessionChatService } = harness;
    await sessionChatService.openExtensionTab(primaryId, "fork-lease", { title: "Fork lease" });
    const paneA = await waitForSessionPane(harness, primaryId);
    const partA = partFor(parts, primaryId);
    const tabCount = partA.activeGroup.count;
    assert.ok(tabCount >= 2);
    assert.ok(paneA.activeConversationLens);
    const b = rosterService.seedSessionQuietly();
    await sessionWindowService.revealSessionWindow(b);
    await waitForSessionPane(harness, b);
    assert.strictEqual(sessionWindowService.isSessionWindowHidden(primaryId), true);
    assert.strictEqual(partA.activeGroup.count, tabCount);
    const hiddenLenses = await collectLeafConversationLenses(partA);
    assert.strictEqual(hiddenLenses.length, tabCount);
    for (const lens of hiddenLenses) {
      assert.strictEqual(lens.sessionViewLease, void 0);
    }
    assert.strictEqual(partA.sessionKey, primaryId);
    const hiddenLeaf = sessionWindowService.getLeafSlots(primaryId)?.container;
    assert.ok(hiddenLeaf?.classList.contains(conversationSessionLeafHiddenClass));
    const staleBanner = hiddenLeaf?.querySelector(".conversation-lens-stale-snapshot");
    assert.ok(!staleBanner || staleBanner.hidden || !staleBanner.textContent);
    await sessionWindowService.revealSessionWindow(primaryId);
    const paneA2 = await waitForSessionPane(harness, primaryId);
    const restoredLenses = await collectLeafConversationLenses(partFor(parts, primaryId));
    assert.strictEqual(restoredLenses.length, tabCount);
    for (const lens of restoredLenses) {
      assert.ok(lens.sessionViewLease, "restore must reacquire sessionViewLease on every leaf lens");
    }
    assert.ok(paneA2.activeConversationLens?.sessionViewLease, "restore must reacquire sessionViewLease");
  });
  test("does not leak unhandled rejection when onDidChangeActiveSession reveal catch-path notice throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const harness = createLightweightWindowHarness();
    await timeout(0);
    const primaryId = harness.rosterService.getActiveSessionId();
    await harness.sessionWindowService.ensurePrimaryWindow(primaryId);
    const target = harness.rosterService.seedSessionQuietly();
    harness.setThrowOnCreate(true);
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      harness.setNotifyError(() => {
        throw paintBoom;
      });
      harness.rosterService.fireActiveSession(target);
    });
  });
  test("does not leak unhandled rejection when attachGrid pending reveal catch-path notice throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const harness = createLightweightWindowHarness({ delaySlots: true });
    const target = harness.rosterService.seedSessionQuietly();
    harness.setThrowOnCreate(true);
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      harness.setNotifyError(() => {
        throw paintBoom;
      });
      void harness.sessionWindowService.revealSessionWindow(target, { replace: harness.rosterService.getActiveSessionId() });
      harness.attachSlots();
    });
  });
  test("session window fire-and-forget voids double-catch onUnexpectedError", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationSessionWindowService.ts`);
    const doubleCatch = ".catch(onUnexpectedError).catch(onUnexpectedError)";
    assert.ok(source.includes(`void this.revealSessionWindow(sessionKey)${doubleCatch}`));
    assert.ok(source.includes(`void this.revealSessionWindow(pending.sessionKey, pending.options)${doubleCatch}`));
    assert.ok(source.includes(`void this.ensurePrimaryWindow(this.rosterService.getActiveSessionId())${doubleCatch}`));
    assert.ok(!source.includes("void this.revealSessionWindow(sessionKey);"));
    assert.ok(!source.includes("void this.revealSessionWindow(pending.sessionKey, pending.options);"));
    assert.ok(!source.includes("void this.ensurePrimaryWindow(this.rosterService.getActiveSessionId());"));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi90ZXN0L2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1JldmVhbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGltZW5zaW9uLCBnZXRBY3RpdmVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHJhY2VUaW1lb3V0LCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZXJyb3JIYW5kbGVyLCBnZXRFcnJvck1lc3NhZ2UsIHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25QYXJ0LCBJQ29udmVyc2F0aW9uUGFydFNlcnZpY2UsIElDb252ZXJzYXRpb25QYXJ0V2luZG93U2xvdHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3BhcnRzL2NvbnZlcnNhdGlvbi9jb252ZXJzYXRpb25QYXJ0LmpzJztcbmltcG9ydCB7IElDb252ZXJzYXRpb25FZGl0b3JQYXJ0LCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2Jyb3dzZXIvZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zLCBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVFZGl0b3JQYXJ0cywgcmVnaXN0ZXJUZXN0RWRpdG9yLCBUZXN0RmlsZUVkaXRvcklucHV0LCB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0ICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkVkaXRvci5jb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uRWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25TZXNzaW9uQ2hhdENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvbkNoYXQuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbk5hdmlnYXRpb25Db250cmlidXRpb24gfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbk5hdmlnYXRpb24uY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbk5hdmlnYXRpb25TZXJ2aWNlLCBJQ29udmVyc2F0aW9uTmF2aWdhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbk5hdmlnYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvblNlc3Npb25DaGF0U2VydmljZSwgSUNvbnZlcnNhdGlvblNlc3Npb25DaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvbkNoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHN3aXRjaFRvU2Vzc2lvbiBhcyBzd2l0Y2hUb1Nlc3Npb25IZWxwZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvblNlc3Npb25XaW5kb3dTZXJ2aWNlLCBJQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25XaW5kb3dTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlLCBJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU3R1YlNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnZlcnNhdGlvblRpbWVsaW5lUmV2ZWFsU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uVGltZWxpbmVSZXZlYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb252ZXJzYXRpb25SZXZpZXdOYXZTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25SZXZpZXdFbnRyeS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25FbmdpbmVSb3N0ZXJTZXJ2aWNlLCBFTkdJTkVfQklORF9GQUlMRURfU0VTU0lPTl9JRCwgaXNFbmdpbmVSb3N0ZXJQbGFjZWhvbGRlclNlc3Npb25JZCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uRW5naW5lUm9zdGVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRDb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25TZXNzaW9uQXZhaWxhYmlsaXR5LmpzJztcbmltcG9ydCB7IGlzQ29udmVyc2F0aW9uRW5naW5lTGl2ZSwgaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvblN0YXR1cy5qcyc7XG5pbXBvcnQgeyBzdHViVHVybnNUb1NuYXBzaG90IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25TZXNzaW9uVmlldy5qcyc7XG5pbXBvcnQgdHlwZSB7IENvbnZlcnNhdGlvbkxlbnMgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnMuanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRWRpdG9yUGFuZUlkLCBjb252ZXJzYXRpb25TZXNzaW9uTGVhZkhpZGRlbkNsYXNzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnZlcnNhdGlvblNlc3Npb25XaW5kb3cuanMnO1xuaW1wb3J0IHsgVUFfQ0xJRU5UX0NIQVRfSU5QVVRfQVVUT19GT0NVUyB9IGZyb20gJy4uLy4uL2NvbW1vbi91YUNsaWVudFNldHRpbmdzS2V5cy5qcyc7XG5pbXBvcnQgeyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi91bml2ZXJzZUFnZW50Q29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJVW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3LCB0eXBlIElVbml2ZXJzZUFnZW50U2Vzc2lvblZpZXdGcmFtZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3LmpzJztcbmltcG9ydCB0eXBlIHsgVmlld0xlYXNlSWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi9zZXNzaW9uVmlldy90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7IENvbm5lY3Rpb25QaGFzZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL2Nvbm5lY3Rpb25IdWJUeXBlcy5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25DaGF0SW5wdXQsIGdldENvbnZlcnNhdGlvbkNoYXRSZXNvdXJjZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb252ZXJzYXRpb25DaGF0SW5wdXQuanMnO1xuaW1wb3J0IHsgY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViIH0gZnJvbSAnLi4vY29tbW9uL2NvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yi5qcyc7XG5pbXBvcnQgeyBzdHViQ29udmVyc2F0aW9uVGltZWxpbmVMaW5rU2VydmljZXMgfSBmcm9tICcuL2NvbnZlcnNhdGlvblRpbWVsaW5lTGlua1Rlc3RTdHVicy5qcyc7XG5pbXBvcnQgeyBpbnN0YWxsQ29udmVyc2F0aW9uTGVuc1Jlc2l6ZU9ic2VydmVySGFybmVzcyB9IGZyb20gJy4vY29udmVyc2F0aW9uTGVuc0xheW91dEhhcm5lc3MuanMnO1xuaW1wb3J0IHsgSUV4cGxvcmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2ZpbGVzL2Jyb3dzZXIvZmlsZXMuanMnO1xuaW1wb3J0IHsgSVNDTVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zY20vY29tbW9uL3NjbS5qcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gX19yZWFkRmlsZUluVGVzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+O1xuXG5jbGFzcyBRdWlldFJvc3RlclNlcnZpY2UgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdHNlZWRTZXNzaW9uUXVpZXRseSgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHByZXZpb3VzID0gdGhpcy5tb2RlbC5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSB0aGlzLm1vZGVsLmNyZWF0ZVNlc3Npb24oKTtcblx0XHR0aGlzLm1vZGVsLnN3aXRjaFNlc3Npb24ocHJldmlvdXMpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdFx0cmV0dXJuIHNlc3Npb25JZDtcblx0fVxuXG5cdGZpcmVBY3RpdmVTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uLmZpcmUoc2Vzc2lvbklkKTtcblx0fVxuXG5cdGZpcmVEZWxldGVkU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkRGVsZXRlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdH1cbn1cblxuLyoqIFB1YmxpYyBTZXNzaW9uVmlldyBib3VuZGFyeTsgcHJvZHVjdGlvbiBGcmFtZVNvdXJjZSBzdGlsbCBvd25zIHJlcGxpY2FzIGFuZCBmYW5vdXQuICovXG5jbGFzcyBSZXZlYWxFbmdpbmVTZXNzaW9uVmlldyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3IHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGFjcXVpcmVkOiB7IGxlYXNlSWQ6IHN0cmluZzsgc2Vzc2lvbklkOiBzdHJpbmcgfVtdID0gW107XG5cdHJlYWRvbmx5IHJlbGVhc2VkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZW1pdHRlcnMgPSBuZXcgTWFwPHN0cmluZywgRW1pdHRlcjxJVW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3RnJhbWVFdmVudD4+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdmVyc2lvbnMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGxpc3RlbmluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpZExpc3RlbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTGlzdGVuID0gdGhpcy5kaWRMaXN0ZW4uZXZlbnQ7XG5cblx0b25EeW5hbWljRGlkQXBwbHlGcmFtZShsZWFzZUlkOiBzdHJpbmcpOiBFdmVudDxJVW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3RnJhbWVFdmVudD4ge1xuXHRcdGxldCBlbWl0dGVyID0gdGhpcy5lbWl0dGVycy5nZXQobGVhc2VJZCk7XG5cdFx0aWYgKCFlbWl0dGVyKSB7XG5cdFx0XHRlbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVVuaXZlcnNlQWdlbnRTZXNzaW9uVmlld0ZyYW1lRXZlbnQ+KHtcblx0XHRcdFx0b25EaWRBZGRGaXJzdExpc3RlbmVyOiAoKSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5lbWl0TGVhc2UobGVhc2VJZCk7XG5cdFx0XHRcdFx0dGhpcy5saXN0ZW5pbmcuYWRkKGxlYXNlSWQpO1xuXHRcdFx0XHRcdHRoaXMuZGlkTGlzdGVuLmZpcmUobGVhc2VJZCk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5lbWl0dGVycy5zZXQobGVhc2VJZCwgZW1pdHRlcik7XG5cdFx0fVxuXHRcdHJldHVybiBlbWl0dGVyLmV2ZW50O1xuXHR9XG5cblx0YXN5bmMgYWNxdWlyZUxlYXNlKHNlc3Npb25JZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBsZWFzZUlkID0gYHJldmVhbDoke3Nlc3Npb25JZH06JHt0aGlzLmFjcXVpcmVkLmxlbmd0aCArIDF9YDtcblx0XHR0aGlzLmFjcXVpcmVkLnB1c2goeyBsZWFzZUlkLCBzZXNzaW9uSWQgfSk7XG5cdFx0cmV0dXJuIGxlYXNlSWQ7XG5cdH1cblx0YXN5bmMgd2hlbkVuZ2luZVNlc3Npb25SZWFkeShzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7IHJldHVybiBzZXNzaW9uSWQ7IH1cblx0YXN5bmMgcmVsZWFzZUxlYXNlKGxlYXNlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4geyB0aGlzLnJlbGVhc2VkLmFkZChsZWFzZUlkKTsgfVxuXHRhc3luYyBwb3N0KCk6IFByb21pc2U8bmV2ZXI+IHsgdGhyb3cgbmV3IEVycm9yKCdsZWFzZSByZWNvdmVyeSBtdXN0IG5vdCB3cml0ZScpOyB9XG5cdGFzeW5jIHJlcXVlc3RSZXN5bmMoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgYWNrbm93bGVkZ2UoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgcmVxdWVzdERldGFpbCgpIHsgcmV0dXJuIHsgb2s6IGZhbHNlIGFzIGNvbnN0LCByZWFzb246ICd1bmF2YWlsYWJsZScgYXMgY29uc3QgfTsgfVxuXG5cdGhhc1Nlc3Npb25MaXN0ZW5lcihzZXNzaW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmFjcXVpcmVkLnNvbWUobGVhc2UgPT4gbGVhc2Uuc2Vzc2lvbklkID09PSBzZXNzaW9uSWQgJiYgdGhpcy5saXN0ZW5pbmcuaGFzKGxlYXNlLmxlYXNlSWQpICYmICF0aGlzLnJlbGVhc2VkLmhhcyhsZWFzZS5sZWFzZUlkKSk7XG5cdH1cblxuXHRlbWl0U2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZywgdGV4dDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBsZWFzZSBvZiB0aGlzLmFjcXVpcmVkKSB7XG5cdFx0XHRpZiAobGVhc2Uuc2Vzc2lvbklkID09PSBzZXNzaW9uSWQpIHtcblx0XHRcdFx0dGhpcy5lbWl0TGVhc2UobGVhc2UubGVhc2VJZCwgdGV4dCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBlbWl0TGVhc2UobGVhc2VJZDogc3RyaW5nLCB0ZXh0Pzogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgbGVhc2UgPSB0aGlzLmFjcXVpcmVkLmZpbmQoY2FuZGlkYXRlID0+IGNhbmRpZGF0ZS5sZWFzZUlkID09PSBsZWFzZUlkKTtcblx0XHRpZiAoIWxlYXNlIHx8IHRoaXMucmVsZWFzZWQuaGFzKGxlYXNlSWQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHByb2plY3Rpb24gPSBzdHViVHVybnNUb1NuYXBzaG90KGxlYXNlLnNlc3Npb25JZCwgdGV4dCA9PT0gdW5kZWZpbmVkID8gW10gOiBbXG5cdFx0XHR7IGlkOiBgJHtsZWFzZS5zZXNzaW9uSWR9LWJvZHlgLCBraW5kOiAndXNlcicsIHRleHQgfSxcblx0XHRcdHsgaWQ6IGAke2xlYXNlLnNlc3Npb25JZH0tcGVybWlzc2lvbmAsIGtpbmQ6ICdjb25maXJtYXRpb24nLCB0ZXh0OiBgUGVybWlzc2lvbiBmb3IgJHtsZWFzZS5zZXNzaW9uSWR9YCwgc3RhdHVzOiAncGVuZGluZycgfSxcblx0XHRdKTtcblx0XHRjb25zdCB2ZXJzaW9uID0gKHRoaXMudmVyc2lvbnMuZ2V0KGxlYXNlSWQpID8/IDApICsgMTtcblx0XHR0aGlzLnZlcnNpb25zLnNldChsZWFzZUlkLCB2ZXJzaW9uKTtcblx0XHR0aGlzLmVtaXR0ZXJzLmdldChsZWFzZUlkKT8uZmlyZSh7XG5cdFx0XHRsZWFzZUlkLCBzZXNzaW9uSWQ6IGxlYXNlLnNlc3Npb25JZCwgYXBwbGllZDogeyBraW5kOiAnYmFzZWxpbmUnIH0sXG5cdFx0XHRmcmFtZToge1xuXHRcdFx0XHRmcmFtZTogeyBsZWFzZUlkOiBsZWFzZUlkIGFzIFZpZXdMZWFzZUlkLCBnZW5lcmF0aW9uOiAxLCBmcmFtZUlkOiB2ZXJzaW9uLCB2ZXJzaW9uLCBib2R5OiB7IGtpbmQ6ICdiYXNlbGluZScsIHNuYXBzaG90OiB7IC4uLnByb2plY3Rpb24uc25hcHNob3QsIHN5bmM6IHsga2luZDogJ2xpdmUnIH0gfSB9IH0sXG5cdFx0XHRcdGF0dHJpYnV0aW9uOiBbLi4ucHJvamVjdGlvbi5hdHRyaWJ1dGlvbl0ubWFwKChbaXRlbUlkLCBhdHRyaWJ1dGlvbl0pID0+ICh7IG9wOiAndXBzZXJ0QXR0cmlidXRpb24nLCBpdGVtSWQsIGF0dHJpYnV0aW9uIH0pKSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cbn1cblxuc3VpdGUoJ0NvbnZlcnNhdGlvbiBzZXNzaW9uIHdpbmRvdyByZXZlYWwgKyBsZWFmIFNlc3Npb25CYXIgKEMpJywgKCkgPT4ge1xuXG5cdGNvbnN0IFRFU1RfRURJVE9SX0lEID0gJ015RmlsZUVkaXRvckZvckNvbnZlcnNhdGlvblJldmVhbCc7XG5cdGNvbnN0IFRFU1RfRURJVE9SX0lOUFVUX0lEID0gJ3Rlc3RFZGl0b3JJbnB1dEZvckNvbnZlcnNhdGlvblJldmVhbCc7XG5cblx0aW5zdGFsbENvbnZlcnNhdGlvbkxlbnNSZXNpemVPYnNlcnZlckhhcm5lc3MoKTtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IHN0b3JlIGFzIHVua25vd24gYXMgRGlzcG9zYWJsZVN0b3JlO1xuXG5cdHRlYXJkb3duKGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IG1haW5XaW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IG1haW5XaW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHJlc29sdmUoKSkpKTtcblx0fSk7XG5cblx0c2V0dXAoZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgyMF8wMDApO1xuXHRcdHN0b3JlLmFkZChyZWdpc3RlclRlc3RFZGl0b3IoVEVTVF9FRElUT1JfSUQsIFtuZXcgU3luY0Rlc2NyaXB0b3IoVGVzdEZpbGVFZGl0b3JJbnB1dCksIG5ldyBTeW5jRGVzY3JpcHRvcihTaWRlQnlTaWRlRWRpdG9ySW5wdXQpXSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gbGF5b3V0UGFydHMocGFydHM6IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlRWRpdG9yUGFydHM+Pik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cy5jb252ZXJzYXRpb25QYXJ0cykge1xuXHRcdFx0cGFydC5sYXlvdXQoODAwLCA2MDAsIDAsIDApO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHRyYWNrRWRpdG9ycyhwYXJ0czogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVFZGl0b3JQYXJ0cz4+KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzLmNvbnZlcnNhdGlvblBhcnRzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBwYXJ0LmFjdGl2ZUdyb3VwLmVkaXRvcnMpIHtcblx0XHRcdFx0c3RvcmUuYWRkKGVkaXRvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gd2FpdEZvclBhbmUocGFydDogSUNvbnZlcnNhdGlvbkVkaXRvclBhcnQsIG9wZW5FcnJvcnM6IHVua25vd25bXSA9IFtdLCBwYXJ0cz86IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlRWRpdG9yUGFydHM+Pik6IFByb21pc2U8Q29udmVyc2F0aW9uRWRpdG9yUGFuZT4ge1xuXHRcdGF3YWl0IHBhcnQud2hlblJlYWR5O1xuXHRcdGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIDMwMDA7XG5cdFx0d2hpbGUgKERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuXHRcdFx0Y29uc3QgcGFuZSA9IHBhcnQuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGlmIChwYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSkge1xuXHRcdFx0XHRpZiAocGFydHMpIHtcblx0XHRcdFx0XHR0cmFja0VkaXRvcnMocGFydHMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBwYW5lO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0fVxuXHRcdGNvbnN0IGRldGFpbCA9IG9wZW5FcnJvcnMubWFwKGVycm9yID0+IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA/PyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSkuam9pbignXFxuJyk7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDb252ZXJzYXRpb25FZGl0b3JQYW5lIG5vdCByZWFkeSBmb3IgJHtwYXJ0LnNlc3Npb25LZXl9OyBnb3QgJHtwYXJ0LmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvclBhbmU/LmdldElkKCl9JHtkZXRhaWwgPyBgXFxuJHtkZXRhaWx9YCA6ICcnfWApO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFydEZvcihwYXJ0czogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVFZGl0b3JQYXJ0cz4+LCBzZXNzaW9uS2V5OiBzdHJpbmcpOiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCB7XG5cdFx0Y29uc3QgcGFydCA9IHBhcnRzLmNvbnZlcnNhdGlvblBhcnRzLmZpbmQoY2FuZGlkYXRlID0+IGNhbmRpZGF0ZS5zZXNzaW9uS2V5ID09PSBzZXNzaW9uS2V5KTtcblx0XHRhc3NlcnQub2socGFydCwgYG1pc3NpbmcgcGFydCAke3Nlc3Npb25LZXl9YCk7XG5cdFx0cmV0dXJuIHBhcnQ7XG5cdH1cblxuXHRmdW5jdGlvbiB2aXNpYmxlTGVhZktleXMod2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIFsuLi53aW5kb3dTZXJ2aWNlLmdldFZpc2libGVTZXNzaW9uS2V5cygpXTtcblx0fVxuXG5cdGZ1bmN0aW9uIGhpZGVCdXR0b24od2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UsIHNlc3Npb25LZXk6IHN0cmluZyk6IEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCB7XG5cdFx0cmV0dXJuIHdpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHNlc3Npb25LZXkpPy5zZXNzaW9uQmFyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tc2Vzc2lvbi1sZWFmLWhpZGUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb206IEVycm9yLCBydW46ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gQSBsb25lIGAuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpYCBzdGlsbCBsZWFrcyB3aGVuIHRoZSBoYW5kbGVyIHdhcm4tdGhlbi1yZXRocm93cy5cblx0XHRjb25zdCB1bmV4cGVjdGVkV2FybnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IHVuaGFuZGxlZFJlamVjdGlvbnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IG9uVW5oYW5kbGVkUmVqZWN0aW9uID0gKHJlYXNvbjogdW5rbm93bikgPT4gdW5oYW5kbGVkUmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7XG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWRSZWplY3Rpb24pO1xuXHRcdGNvbnN0IG9yaWdpbmFsRXJyb3JIYW5kbGVyID0gZXJyb3JIYW5kbGVyLmdldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKTtcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKGVycm9yID0+IHtcblx0XHRcdHVuZXhwZWN0ZWRXYXJucy5wdXNoKGVycm9yKTtcblx0XHRcdGlmICh1bmV4cGVjdGVkV2FybnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBydW4oKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgdW5oYW5kbGVkUmVqZWN0aW9ucywgdW5leHBlY3RlZFdhcm5zIH0sIHtcblx0XHRcdFx0dW5oYW5kbGVkUmVqZWN0aW9uczogW10sXG5cdFx0XHRcdHVuZXhwZWN0ZWRXYXJuczogW3BhaW50Qm9vbSwgcGFpbnRCb29tXSxcblx0XHRcdH0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKG9yaWdpbmFsRXJyb3JIYW5kbGVyKTtcblx0XHRcdHByb2Nlc3Mub2ZmKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZFJlamVjdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlTGlnaHR3ZWlnaHRXaW5kb3dIYXJuZXNzKG9wdGlvbnM/OiB7IGRlbGF5U2xvdHM/OiBib29sZWFuIH0pIHtcblx0XHRjb25zdCByb3N0ZXJTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBRdWlldFJvc3RlclNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgZ3JpZEhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGdyaWRIb3N0KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBncmlkSG9zdC5yZW1vdmUoKSB9KTtcblxuXHRcdGNvbnN0IG9uRGlkQ3JlYXRlU2xvdHMgPSBuZXcgRW1pdHRlcjxJQ29udmVyc2F0aW9uUGFydFdpbmRvd1Nsb3RzPigpO1xuXHRcdHN0b3JlLmFkZChvbkRpZENyZWF0ZVNsb3RzKTtcblxuXHRcdGxldCB0aHJvd09uQ3JlYXRlID0gZmFsc2U7XG5cdFx0bGV0IHJlamVjdFdoZW5SZWFkeSA9IGZhbHNlO1xuXHRcdGNvbnN0IGNvbnZlcnNhdGlvblBhcnRzOiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydFtdID0gW107XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IHtcblx0XHRcdGNyZWF0ZUNvbnZlcnNhdGlvbkVkaXRvclBhcnQ6IChfcGFyZW50OiB1bmtub3duLCBzZXNzaW9uS2V5OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0aWYgKHRocm93T25DcmVhdGUpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3JldmVhbCBib29tJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGV0IHdoZW5SZWFkeTogUHJvbWlzZTx2b2lkPiA9IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0XHRpZiAocmVqZWN0V2hlblJlYWR5KSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVqZWN0ZWQgPSBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ3doZW5SZWFkeSBib29tJykpO1xuXHRcdFx0XHRcdC8vIEtlZXAgdGhlIHJlamVjdGlvbiBvYnNlcnZlZC4gQXdhaXRlcnMgc3RpbGwgcmVqZWN0LlxuXHRcdFx0XHRcdHZvaWQgcmVqZWN0ZWQuY2F0Y2goKCkgPT4geyB9KTtcblx0XHRcdFx0XHR3aGVuUmVhZHkgPSByZWplY3RlZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBwYXJ0ID0geyBzZXNzaW9uS2V5LCB3aGVuUmVhZHksIGFjdGl2ZUdyb3VwOiB7IGZvY3VzOiAoKSA9PiB7IH0sIGFjdGl2ZUVkaXRvclBhbmU6IHsgZ2V0SWQ6ICgpID0+IENvbnZlcnNhdGlvbkVkaXRvclBhbmVJZCB9IH0gfSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25FZGl0b3JQYXJ0O1xuXHRcdFx0XHRjb252ZXJzYXRpb25QYXJ0cy5wdXNoKHBhcnQpO1xuXHRcdFx0XHRyZXR1cm4gcGFydDtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlQ29udmVyc2F0aW9uRWRpdG9yUGFydDogKHNlc3Npb25LZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IGNvbnZlcnNhdGlvblBhcnRzLmZpbmRJbmRleChwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vzc2lvbktleSk7XG5cdFx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0Y29udmVyc2F0aW9uUGFydHMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNldEZvY3VzZWRDb252ZXJzYXRpb25MZWFmOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRGb2N1c2VkQ29udmVyc2F0aW9uTGVhZjogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IGNvbnZlcnNhdGlvblBhcnRzKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udmVyc2F0aW9uUGFydHM7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yR3JvdXBzU2VydmljZTtcblxuXHRcdGxldCBvbk5vdGlmeUVycm9yOiAoKG1lc3NhZ2U6IHN0cmluZyB8IEVycm9yKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzZXNzaW9uV2luZG93U2VydmljZSA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UoXG5cdFx0XHR7XG5cdFx0XHRcdG9uRGlkQ3JlYXRlU2xvdHM6IG9uRGlkQ3JlYXRlU2xvdHMuZXZlbnQsXG5cdFx0XHRcdG9uRGlkRm9jdXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGdldFNsb3RzOiAoKSA9PiBvcHRpb25zPy5kZWxheVNsb3RzXG5cdFx0XHRcdFx0PyB1bmRlZmluZWRcblx0XHRcdFx0XHQ6IHsgc2Vzc2lvbkJhcjogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksIHNlc3Npb25XaW5kb3dHcmlkOiBncmlkSG9zdCwgZWRpdG9yUGFydEhvc3Q6IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHRzZXRGb2N1c2VkTGVhZkNvbnRhaW5lcjogKCkgPT4geyB9LFxuXHRcdFx0XHRmb2N1czogKCkgPT4geyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25QYXJ0U2VydmljZSxcblx0XHRcdGVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0XHRyb3N0ZXJTZXJ2aWNlLFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKCksXG5cdFx0XHR7XG5cdFx0XHRcdGVycm9yOiAobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IpID0+IHtcblx0XHRcdFx0XHRvbk5vdGlmeUVycm9yPy4obWVzc2FnZSk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdCkpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlc3Npb25XaW5kb3dTZXJ2aWNlLFxuXHRcdFx0cm9zdGVyU2VydmljZSxcblx0XHRcdGNvbnZlcnNhdGlvblBhcnRzLFxuXHRcdFx0c2V0VGhyb3dPbkNyZWF0ZSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdFx0XHR0aHJvd09uQ3JlYXRlID0gdmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0c2V0UmVqZWN0V2hlblJlYWR5KHZhbHVlOiBib29sZWFuKSB7XG5cdFx0XHRcdHJlamVjdFdoZW5SZWFkeSA9IHZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHNldE5vdGlmeUVycm9yKGhhbmRsZXI6IChtZXNzYWdlOiBzdHJpbmcgfCBFcnJvcikgPT4gdm9pZCkge1xuXHRcdFx0XHRvbk5vdGlmeUVycm9yID0gaGFuZGxlcjtcblx0XHRcdH0sXG5cdFx0XHRhdHRhY2hTbG90cygpIHtcblx0XHRcdFx0b25EaWRDcmVhdGVTbG90cy5maXJlKHtcblx0XHRcdFx0XHRzZXNzaW9uQmFyOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcblx0XHRcdFx0XHRzZXNzaW9uV2luZG93R3JpZDogZ3JpZEhvc3QsXG5cdFx0XHRcdFx0ZWRpdG9yUGFydEhvc3Q6IHVuZGVmaW5lZCxcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBjb2xsZWN0TGVhZkNvbnZlcnNhdGlvbkxlbnNlcyhwYXJ0OiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCk6IFByb21pc2U8Q29udmVyc2F0aW9uTGVuc1tdPiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXHRcdGNvbnN0IGxlbnNlczogQ29udmVyc2F0aW9uTGVuc1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZ3JvdXAuZWRpdG9ycykge1xuXHRcdFx0YXdhaXQgZ3JvdXAub3BlbkVkaXRvcihlZGl0b3IpO1xuXHRcdFx0Y29uc3QgcGFuZSA9IGdyb3VwLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRhc3NlcnQub2socGFuZSBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkVkaXRvclBhbmUsIGBtaXNzaW5nIENvbnZlcnNhdGlvbkVkaXRvclBhbmUgZm9yICR7ZWRpdG9yLnJlc291cmNlfWApO1xuXHRcdFx0Y29uc3QgbGVucyA9IHBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucztcblx0XHRcdGFzc2VydC5vayhsZW5zLCBgZWFjaCBjb252ZXJzYXRpb24gdGFiIG11c3QgZXhwb3NlIGEgQ29udmVyc2F0aW9uTGVucyAoJHtlZGl0b3IucmVzb3VyY2V9KWApO1xuXHRcdFx0bGVuc2VzLnB1c2gobGVucyk7XG5cdFx0fVxuXHRcdHJldHVybiBsZW5zZXM7XG5cdH1cblxuXHRmdW5jdGlvbiBjb3VudExlYWZDaHJvbWUod2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnQ6IENvbnZlcnNhdGlvblBhcnQpOiB7IGJhcnM6IG51bWJlcjsgbmF2czogbnVtYmVyOyBwYXJ0U2xvdEJhcnM6IG51bWJlciB9IHtcblx0XHRsZXQgYmFycyA9IDA7XG5cdFx0bGV0IG5hdnMgPSAwO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIHdpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVNlc3Npb25LZXlzKCkpIHtcblx0XHRcdGNvbnN0IGxlYWYgPSB3aW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhrZXkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGxlYWYpO1xuXHRcdFx0YmFycyArPSBsZWFmLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1iYXInKS5sZW5ndGg7XG5cdFx0XHRuYXZzICs9IGxlYWYuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24td2luZG93LW5hdicpLmxlbmd0aDtcblx0XHR9XG5cdFx0Y29uc3QgcGFydFNsb3RCYXJzID0gY29udmVyc2F0aW9uUGFydC5nZXRTbG90cygpPy5zZXNzaW9uQmFyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLWJhcicpLmxlbmd0aCA/PyAwO1xuXHRcdHJldHVybiB7IGJhcnMsIG5hdnMsIHBhcnRTbG90QmFycyB9O1xuXHR9XG5cblx0ZnVuY3Rpb24gc3R1YkxlbnNSdW50aW1lU2VydmljZXMoaW5zdGFudGlhdGlvblNlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlPik6IHZvaWQge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblRpbWVsaW5lUmV2ZWFsU2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0cmVnaXN0ZXJMZW5zOiAoKSA9PiAoeyBkaXNwb3NlOiAoKSA9PiB7IH0gfSksXG5cdFx0XHRyZXZlYWxJdGVtOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRBY2Nlc3NpYmxlVHVybkNvbnRlbnQ6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdGZvY3VzQWNjZXNzaWJsZVR1cm46ICgpID0+IHsgfSxcblx0XHRcdHNjcm9sbFRvRmlyc3RQZW5kaW5nQ29uZmlybWF0aW9uOiAoKSA9PiB7IH0sXG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uUmV2aWV3TmF2U2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRnZXRSZXZpZXdOYXZGb3JTZXNzaW9uOiAoKSA9PiBbXSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFeHBsb3JlclNlcnZpY2UsIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdHNlbGVjdDogYXN5bmMgKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXQgcmVwb3NpdG9yaWVzKCkgeyByZXR1cm4gW107IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMDsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2UpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gY3JlYXRlUmV2ZWFsSGFybmVzcygpIHtcblx0XHRyZXR1cm4gY3JlYXRlUmV2ZWFsSGFybmVzc1dpdGhSb3N0ZXIoc3RvcmUuYWRkKG5ldyBRdWlldFJvc3RlclNlcnZpY2UoKSksIGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1YigpKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVJldmVhbEhhcm5lc3NXaXRoUm9zdGVyPFIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZT4ocm9zdGVyU2VydmljZTogUiwgY29ubmVjdGlvbjogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uLCBlbmdpbmUgPSBmYWxzZSkge1xuXHRcdGNvbnN0IG9wZW5FcnJvcnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2Uoe1xuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6ICgpID0+IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0XHR3b3JrYmVuY2g6IHsgZWRpdG9yOiB7IGVuYWJsZVByZXZpZXc6IGZhbHNlIH0gfSxcblx0XHRcdFx0W1VBX0NMSUVOVF9DSEFUX0lOUFVUX0FVVE9fRk9DVVNdOiBmYWxzZSxcblx0XHRcdH0pLFxuXHRcdH0sIHN0b3JlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMb2dTZXJ2aWNlLCB7XG5cdFx0XHRlcnJvcjogKGVycm9yOiB1bmtub3duKSA9PiB7IG9wZW5FcnJvcnMucHVzaChlcnJvcik7IH0sXG5cdFx0XHR3YXJuOiAoKSA9PiB7IH0sXG5cdFx0XHRpbmZvOiAoKSA9PiB7IH0sXG5cdFx0XHR0cmFjZTogKCkgPT4geyB9LFxuXHRcdFx0ZGVidWc6ICgpID0+IHsgfSxcblx0XHRcdGZsdXNoOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRMZXZlbDogKCkgPT4gMCxcblx0XHRcdHNldExldmVsOiAoKSA9PiB7IH0sXG5cdFx0XHRvbkRpZENoYW5nZUxvZ0xldmVsOiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJTG9nU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZSwgcm9zdGVyU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIGNvbm5lY3Rpb24pO1xuXHRcdHN0dWJMZW5zUnVudGltZVNlcnZpY2VzKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRzdHViQ29udmVyc2F0aW9uVGltZWxpbmVMaW5rU2VydmljZXMoaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkuc3RhcnQoYWNjZXNzb3IpKTtcblxuXHRcdGNvbnN0IHBhcnRzID0gYXdhaXQgY3JlYXRlRWRpdG9yUGFydHMoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRzdG9yZS5hZGQocGFydHMpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIHBhcnRzKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvclNlcnZpY2UsIHVuZGVmaW5lZCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclNlcnZpY2UsIGVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29udmVyc2F0aW9uUGFydCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25QYXJ0KSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRjb252ZXJzYXRpb25QYXJ0LmNyZWF0ZShwYXJlbnQpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblBhcnRTZXJ2aWNlLCBjb252ZXJzYXRpb25QYXJ0KTtcblxuXHRcdGNvbnN0IHNlc3Npb25DaGF0U2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25TZXNzaW9uQ2hhdFNlcnZpY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25TZXNzaW9uQ2hhdFNlcnZpY2UsIHNlc3Npb25DaGF0U2VydmljZSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbldpbmRvd1NlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25TZXNzaW9uV2luZG93U2VydmljZSwgc2Vzc2lvbldpbmRvd1NlcnZpY2UpO1xuXHRcdGNvbnN0IG5hdmlnYXRpb25TZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbk5hdmlnYXRpb25TZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uTmF2aWdhdGlvblNlcnZpY2UsIG5hdmlnYXRpb25TZXJ2aWNlKTtcblxuXHRcdHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25TZXNzaW9uQ2hhdENvbnRyaWJ1dGlvbikpO1xuXHRcdHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25OYXZpZ2F0aW9uQ29udHJpYnV0aW9uKSk7XG5cblx0XHRjb25zdCBwcmltYXJ5SWQgPSByb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmVuc3VyZVByaW1hcnlXaW5kb3cocHJpbWFyeUlkKTtcblx0XHRjb25zdCBwcmltYXJ5UGFydCA9IHBhcnRGb3IocGFydHMsIHByaW1hcnlJZCk7XG5cdFx0aWYgKGVuZ2luZSkge1xuXHRcdFx0YXdhaXQgd2FpdEZvckVuZ2luZVBhbmUocHJpbWFyeVBhcnQsIG9wZW5FcnJvcnMpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB3YWl0Rm9yUGFuZShwcmltYXJ5UGFydCwgb3BlbkVycm9ycywgcGFydHMpO1xuXHRcdH1cblx0XHRsYXlvdXRQYXJ0cyhwYXJ0cyk7XG5cdFx0dHJhY2tFZGl0b3JzKHBhcnRzKTtcblxuXHRcdHJldHVybiB7IGluc3RhbnRpYXRpb25TZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlLCBwYXJ0cywgY29udmVyc2F0aW9uUGFydCwgcm9zdGVyU2VydmljZSwgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHNlc3Npb25DaGF0U2VydmljZSwgcHJpbWFyeUlkLCBvcGVuRXJyb3JzIH07XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBib3VuZGVkPFQ+KHByb21pc2U6IFByb21pc2U8VD4sIG1lc3NhZ2U6IHN0cmluZyk6IFByb21pc2U8VD4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJhY2VUaW1lb3V0KHByb21pc2UudGhlbih2YWx1ZSA9PiAoeyB2YWx1ZSB9KSksIDMwMDApO1xuXHRcdGFzc2VydC5vayhyZXN1bHQsIG1lc3NhZ2UpO1xuXHRcdHJldHVybiByZXN1bHQudmFsdWU7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiB3YWl0Rm9yRW5naW5lUGFuZShwYXJ0OiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCwgb3BlbkVycm9yczogcmVhZG9ubHkgdW5rbm93bltdID0gW10pOiBQcm9taXNlPENvbnZlcnNhdGlvbkVkaXRvclBhbmU+IHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgYm91bmRlZChwYXJ0LndoZW5SZWFkeSwgJ2VuZ2luZSBsZWFmIHBhcnQgbXVzdCBiZWNvbWUgcmVhZHknKTtcblx0XHRcdGlmICghKHBhcnQuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yUGFuZSBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkVkaXRvclBhbmUpKSB7XG5cdFx0XHRcdGNvbnN0IHJlYWR5ID0gRXZlbnQudG9Qcm9taXNlKEV2ZW50LmZpbHRlcihwYXJ0LmFjdGl2ZUdyb3VwLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlLFxuXHRcdFx0XHRcdCgpID0+IHBhcnQuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yUGFuZSBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkVkaXRvclBhbmUpKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBib3VuZGVkKHJlYWR5LCAncmVhbCBlbmdpbmUgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSBtdXN0IG9wZW4nKTtcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRyZWFkeS5jYW5jZWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcGFuZSA9IHBhcnQuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGFzc2VydC5vayhwYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSk7XG5cdFx0XHRyZXR1cm4gcGFuZTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKGVycm9yIGluc3RhbmNlb2YgRXJyb3IpIHtcblx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbFN0YWNrID0gZXJyb3Iuc3RhY2s7XG5cdFx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXHRcdFx0XHRcdGNvbnN0IGFjdGl2ZUVkaXRvciA9IGdyb3VwLmFjdGl2ZUVkaXRvcjtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmVQYW5lID0gZ3JvdXAuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdFx0XHRjb25zdCBkaWFnbm9zdGljcyA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0XHRcdHBhcnQ6IHsgd2luZG93SWQ6IHBhcnQud2luZG93SWQsIHNlc3Npb25LZXk6IHBhcnQuc2Vzc2lvbktleSB9LFxuXHRcdFx0XHRcdFx0Z3JvdXBJZDogZ3JvdXAuaWQsXG5cdFx0XHRcdFx0XHRhY3RpdmVFZGl0b3JSZXNvdXJjZTogYWN0aXZlRWRpdG9yPy5yZXNvdXJjZT8udG9TdHJpbmcoKSA/PyBudWxsLFxuXHRcdFx0XHRcdFx0YWN0aXZlUGFuZUlkOiBhY3RpdmVQYW5lPy5nZXRJZCgpID8/IG51bGwsXG5cdFx0XHRcdFx0XHRhY3RpdmVQYW5lSXNDb252ZXJzYXRpb25FZGl0b3JQYW5lOiBhY3RpdmVQYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSxcblx0XHRcdFx0XHRcdG9wZW5FcnJvcnM6IG9wZW5FcnJvcnMubWFwKG9wZW5FcnJvciA9PiBvcGVuRXJyb3IgaW5zdGFuY2VvZiBFcnJvclxuXHRcdFx0XHRcdFx0XHQ/IHsgdHlwZTogb3BlbkVycm9yLm5hbWUsIG1lc3NhZ2U6IG9wZW5FcnJvci5tZXNzYWdlLCBzdGFjazogb3BlbkVycm9yLnN0YWNrID8/IG51bGwgfVxuXHRcdFx0XHRcdFx0XHQ6IHsgdHlwZTogdHlwZW9mIG9wZW5FcnJvciwgbWVzc2FnZTogU3RyaW5nKG9wZW5FcnJvciksIHN0YWNrOiBudWxsIH0pXG5cdFx0XHRcdFx0fSwgbnVsbCwgMik7XG5cdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGVycm9yLCAnc3RhY2snLCB7XG5cdFx0XHRcdFx0XHR2YWx1ZTogYCR7b3JpZ2luYWxTdGFjayA/PyBgJHtlcnJvci5uYW1lfTogJHtlcnJvci5tZXNzYWdlfWB9XFxuRW5naW5lIFBhbmUgc2V0dXAgZGlhZ25vc3RpY3M6ICR7ZGlhZ25vc3RpY3N9YFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0Ly8gS2VlcCB0aGUgb3JpZ2luYWwgZmFpbHVyZSBpZiBkaWFnbm9zdGljcyBjYW5ub3QgYmUgcmVhZCwgZm9ybWF0dGVkLCBvciBhcHBlbmRlZC5cblx0XHRcdH1cblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZUVuZ2luZVJldmVhbEhhcm5lc3MoYmVmb3JlUGFuZT86IChyb3N0ZXI6IENvbnZlcnNhdGlvbkVuZ2luZVJvc3RlclNlcnZpY2UpID0+IHZvaWQpIHtcblx0XHR0eXBlIENhdGFsb2cgPSBBd2FpdGVkPFJldHVyblR5cGU8SVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uWydsaXN0U2Vzc2lvbnMnXT4+O1xuXHRcdGNvbnN0IHJlcXVlc3RzOiB7IHN0YXJ0ZWQ6IERlZmVycmVkUHJvbWlzZTx2b2lkPjsgcmVzdWx0OiBEZWZlcnJlZFByb21pc2U8Q2F0YWxvZz4gfVtdID0gW107XG5cdFx0Y29uc3QgYWxsUmVxdWVzdHM6IHR5cGVvZiByZXF1ZXN0cyA9IFtdO1xuXHRcdGxldCBwaGFzZTogQ29ubmVjdGlvblBoYXNlID0geyBraW5kOiAnZGlzY29ubmVjdGVkJyB9O1xuXHRcdGxldCBwYWlyaW5nUGVuZGluZyA9IGZhbHNlO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb25FbWl0dGVyID0gc3RvcmUuYWRkKG5ldyBFbWl0dGVyPFJldHVyblR5cGU8SVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uWydnZXRDb25uZWN0aW9uU25hcHNob3QnXT4+KCkpO1xuXHRcdGNvbnN0IGJhc2UgPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBpc0NvbnZlcnNhdGlvbkVuZ2luZUxpdmUocGhhc2UsIHBhaXJpbmdQZW5kaW5nKSxcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gcGhhc2UsXG5cdFx0XHRnZXRUcmFuc3BvcnRTdGF0ZTogKCkgPT4gJ29rJyxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHsgLi4uYmFzZS5nZXRDb25uZWN0aW9uU25hcHNob3QoKSwgdHJhbnNwb3J0OiAnb2snLCBjaGFubmVsQWxpdmU6IHBoYXNlLmtpbmQgIT09ICdkaXNjb25uZWN0ZWQnLCBwYWlyaW5nUGVuZGluZywgZW5naW5lSWRlbnRpdHlJZDogJ3JldmVhbC1lbmdpbmUnLCBsaW5rSWQ6IDEgfSksXG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IGNvbm5lY3Rpb25FbWl0dGVyLmV2ZW50LFxuXHRcdFx0bGlzdFNlc3Npb25zOiAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlcXVlc3QgPSByZXF1ZXN0cy5zaGlmdCgpO1xuXHRcdFx0XHRhc3NlcnQub2socmVxdWVzdCwgJ2V2ZXJ5IHJlYWwgY2F0YWxvZyByZXF1ZXN0IG11c3QgaGF2ZSBhbiBleHBsaWNpdCBEZWZlcnJlZCcpO1xuXHRcdFx0XHR2b2lkIHJlcXVlc3Quc3RhcnRlZC5jb21wbGV0ZSgpO1xuXHRcdFx0XHRyZXR1cm4gcmVxdWVzdC5yZXN1bHQucDtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0Y29uc3Qgc2Vzc2lvblZpZXcgPSBzdG9yZS5hZGQobmV3IFJldmVhbEVuZ2luZVNlc3Npb25WaWV3KCkpO1xuXHRcdGNvbnN0IHJvc3RlclNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvbkVuZ2luZVJvc3RlclNlcnZpY2UoY29ubmVjdGlvbiwgc2Vzc2lvblZpZXcsIHsgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLCBzaG91bGRBZHZlcnRpc2U6ICgpID0+IHRydWUgfSkpO1xuXHRcdC8vIEV2ZXJ5IHBlbmRpbmcgbGlzdCBzZXR0bGVzIGJlZm9yZSBzZXJ2aWNlIHRlYXJkb3duLCBpbmNsdWRpbmcgZmFpbGVkIHNldHVwIHBhdGhzLlxuXHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCByZXF1ZXN0IG9mIGFsbFJlcXVlc3RzKSB7XG5cdFx0XHRcdGlmICghcmVxdWVzdC5yZXN1bHQuaXNTZXR0bGVkKSB7XG5cdFx0XHRcdFx0dm9pZCByZXF1ZXN0LnJlc3VsdC5jb21wbGV0ZSh7IHNlc3Npb25zOiBbXSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRjb25zdCBkZWZlckNhdGFsb2cgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXF1ZXN0ID0geyBzdGFydGVkOiBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCksIHJlc3VsdDogbmV3IERlZmVycmVkUHJvbWlzZTxDYXRhbG9nPigpIH07XG5cdFx0XHRyZXF1ZXN0cy5wdXNoKHJlcXVlc3QpO1xuXHRcdFx0YWxsUmVxdWVzdHMucHVzaChyZXF1ZXN0KTtcblx0XHRcdHJldHVybiByZXF1ZXN0O1xuXHRcdH07XG5cdFx0Y29uc3Qgbm90aWZ5ID0gKGtpbmQ6ICdsaXZlJyB8ICdkaXNjb25uZWN0ZWQnIHwgJ2Nvbm5lY3RlZCBwYWlyaW5nJyB8ICdjb25uZWN0aW5nIHBhaXJpbmcnKSA9PiB7XG5cdFx0XHRwYWlyaW5nUGVuZGluZyA9IGtpbmQgPT09ICdjb25uZWN0ZWQgcGFpcmluZycgfHwga2luZCA9PT0gJ2Nvbm5lY3RpbmcgcGFpcmluZyc7XG5cdFx0XHRwaGFzZSA9IGtpbmQgPT09ICdkaXNjb25uZWN0ZWQnID8geyBraW5kOiAnZGlzY29ubmVjdGVkJyB9XG5cdFx0XHRcdDoga2luZCA9PT0gJ2Nvbm5lY3RpbmcgcGFpcmluZycgPyB7IGtpbmQ6ICdjb25uZWN0aW5nJywgcmVhc29uOiAnaW5pdGlhbCcgfVxuXHRcdFx0XHRcdDogeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9O1xuXHRcdFx0Y29ubmVjdGlvbkVtaXR0ZXIuZmlyZShjb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpKTtcblx0XHR9O1xuXHRcdGNvbnN0IGNhdGFsb2c6IENhdGFsb2cgPSB7IHNlc3Npb25zOiBbeyBzZXNzaW9uSWQ6ICdsZWFzZS1zMScsIHRpdGxlOiAnTGVhc2UgczEnIH0sIHsgc2Vzc2lvbklkOiAnbGVhc2UtczInLCB0aXRsZTogJ0xlYXNlIHMyJyB9XSB9O1xuXHRcdGNvbnN0IGluaXRpYWwgPSBkZWZlckNhdGFsb2coKTtcblx0XHRub3RpZnkoJ2xpdmUnKTtcblx0XHRhd2FpdCBib3VuZGVkKGluaXRpYWwuc3RhcnRlZC5wLCAnaW5pdGlhbCByZWFsIGNhdGFsb2cgbXVzdCBzdGFydCcpO1xuXHRcdGF3YWl0IGluaXRpYWwucmVzdWx0LmNvbXBsZXRlKGNhdGFsb2cpO1xuXHRcdGF3YWl0IGJvdW5kZWQocm9zdGVyU2VydmljZS53aGVuRW5naW5lQ2F0YWxvZ1JlZnJlc2hDb21wbGV0ZSgpLCAnaW5pdGlhbCByZWFsIGNhdGFsb2cgbXVzdCBmaW5pc2gnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0Q29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzcyhyb3N0ZXJTZXJ2aWNlKSwgJ3JlYWR5Jyk7XG5cdFx0YmVmb3JlUGFuZT8uKHJvc3RlclNlcnZpY2UpO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzV2l0aFJvc3Rlcihyb3N0ZXJTZXJ2aWNlLCBjb25uZWN0aW9uLCB0cnVlKTtcblx0XHRjb25zdCBwYW5lID0gYXdhaXQgd2FpdEZvckVuZ2luZVBhbmUocGFydEZvcihoYXJuZXNzLnBhcnRzLCBoYXJuZXNzLnByaW1hcnlJZCksIGhhcm5lc3Mub3BlbkVycm9ycyk7XG5cdFx0Y29uc3QgbGVucyA9IHBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucztcblx0XHRhc3NlcnQub2sobGVucyk7XG5cdFx0YXNzZXJ0Lm9rKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgJ2luaXRpYWwgcmVhbCB2aXNpYmxlIG93bmVyIG11c3QgaGF2ZSBhIGxlYXNlJyk7XG5cdFx0aWYgKGxlbnMuc2Vzc2lvblZpZXdMZWFzZS5zbmFwc2hvdC5zZXNzaW9uSWQgIT09IGhhcm5lc3MucHJpbWFyeUlkKSB7XG5cdFx0XHRjb25zdCBiYXNlbGluZSA9IEV2ZW50LnRvUHJvbWlzZShsZW5zLnNlc3Npb25WaWV3TGVhc2Uub25EaWRBcHBseUZyYW1lKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IGJvdW5kZWQoYmFzZWxpbmUsICdpbml0aWFsIGhvc3QgYmFzZWxpbmUgbXVzdCByZWFjaCB0aGUgUGFuZSBsZWFzZScpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0YmFzZWxpbmUuY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2Uuc25hcHNob3Quc2Vzc2lvbklkLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0cmV0dXJuIHsgLi4uaGFybmVzcywgcGFuZSwgbGVucywgY29ubmVjdGlvbiwgc2Vzc2lvblZpZXcsIGRlZmVyQ2F0YWxvZywgbm90aWZ5LCBjYXRhbG9nIH07XG5cdH1cblxuXHR0eXBlIEVuZ2luZVJldmVhbEhhcm5lc3MgPSBBd2FpdGVkPFJldHVyblR5cGU8dHlwZW9mIGNyZWF0ZUVuZ2luZVJldmVhbEhhcm5lc3M+PjtcblxuXHRmdW5jdGlvbiBhc3NlcnRWaXNpYmxlTWlzc2luZyhoYXJuZXNzOiBFbmdpbmVSZXZlYWxIYXJuZXNzLCBwYW5lID0gaGFybmVzcy5wYW5lLCBrZXkgPSBoYXJuZXNzLnByaW1hcnlJZCk6IENvbnZlcnNhdGlvbkxlbnMge1xuXHRcdGNvbnN0IGxlbnMgPSBwYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnM7XG5cdFx0YXNzZXJ0Lm9rKGxlbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmJvdW5kU2Vzc2lvbklkLCBrZXkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmlzRGlzcG9zZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKGtleSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3QmluZGluZ1N1c3BlbmRlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCwgJ3JlYWwgY29ubmVjdGlvbi9CaW5kaW5nIG11c3QgbmF0dXJhbGx5IHJlbW92ZSB0aGUgZW1wdHkgb3duZXIgbGVhc2UnKTtcblx0XHRyZXR1cm4gbGVucztcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHN0YXJ0RW1wdHlDYXRhbG9nUmVmcmVzaChoYXJuZXNzOiBFbmdpbmVSZXZlYWxIYXJuZXNzLCByZWNvbm5lY3QgPSBmYWxzZSkge1xuXHRcdGNvbnN0IHJlcXVlc3QgPSBoYXJuZXNzLmRlZmVyQ2F0YWxvZygpO1xuXHRcdGlmIChyZWNvbm5lY3QpIHtcblx0XHRcdGhhcm5lc3Mubm90aWZ5KCdkaXNjb25uZWN0ZWQnKTtcblx0XHR9XG5cdFx0aGFybmVzcy5ub3RpZnkoJ2xpdmUnKTtcblx0XHRhd2FpdCBib3VuZGVkKHJlcXVlc3Quc3RhcnRlZC5wLCAncmVhbCByZXBsYWNlbWVudCBsaXN0U2Vzc2lvbnMgbXVzdCBzdGFydCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRDb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzKGhhcm5lc3Mucm9zdGVyU2VydmljZSksICdsb2FkaW5nJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zLCBoYXJuZXNzLmxlbnMpO1xuXHRcdGFzc2VydFZpc2libGVNaXNzaW5nKGhhcm5lc3MpO1xuXHRcdHJldHVybiByZXF1ZXN0O1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gY29tcGxldGVDYXRhbG9nKGhhcm5lc3M6IEVuZ2luZVJldmVhbEhhcm5lc3MsIHJlcXVlc3Q6IFJldHVyblR5cGU8RW5naW5lUmV2ZWFsSGFybmVzc1snZGVmZXJDYXRhbG9nJ10+KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgcmVxdWVzdC5yZXN1bHQuY29tcGxldGUoaGFybmVzcy5jYXRhbG9nKTtcblx0XHRhd2FpdCBib3VuZGVkKGhhcm5lc3Mucm9zdGVyU2VydmljZS53aGVuRW5naW5lQ2F0YWxvZ1JlZnJlc2hDb21wbGV0ZSgpLCAncmVhbCBjYXRhbG9nIG11c3Qgc2V0dGxlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlKSwgJ3JlYWR5Jyk7XG5cdH1cblxuXHRmdW5jdGlvbiBvYnNlcnZlUGFuZUJpbmRzKGxlbnM6IENvbnZlcnNhdGlvbkxlbnMpOiAoKSA9PiBudW1iZXIge1xuXHRcdGxldCBjYWxscyA9IDA7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBsZW5zLmJpbmRTZXNzaW9uVmlldztcblx0XHRsZW5zLmJpbmRTZXNzaW9uVmlldyA9IHNlc3Npb25JZCA9PiB7XG5cdFx0XHRjYWxscysrO1xuXHRcdFx0b3JpZ2luYWwuY2FsbChsZW5zLCBzZXNzaW9uSWQpO1xuXHRcdH07XG5cdFx0c3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7IGxlbnMuYmluZFNlc3Npb25WaWV3ID0gb3JpZ2luYWw7IH0pKTtcblx0XHRyZXR1cm4gKCkgPT4gY2FsbHM7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhc3NlcnRFbmdpbmVGcmFtZVBhaW50cyhoYXJuZXNzOiBFbmdpbmVSZXZlYWxIYXJuZXNzLCBwYW5lOiBDb252ZXJzYXRpb25FZGl0b3JQYW5lLCBzZXNzaW9uSWQ6IHN0cmluZywgdGV4dDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbGVucyA9IHBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucztcblx0XHRhc3NlcnQub2sobGVucyk7XG5cdFx0Y29uc3QgbGVhc2UgPSBsZW5zLnNlc3Npb25WaWV3TGVhc2U7XG5cdFx0YXNzZXJ0Lm9rKGxlYXNlLCAndGhpcyBhY3R1YWwgUGFuZSBtdXN0IG93biB0aGUgcmVjb3ZlcmVkIGxlYXNlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlYXNlLnNlc3Npb25JZCwgc2Vzc2lvbklkKTtcblx0XHRpZiAoIWhhcm5lc3Muc2Vzc2lvblZpZXcuaGFzU2Vzc2lvbkxpc3RlbmVyKHNlc3Npb25JZCkpIHtcblx0XHRcdGNvbnN0IGxpc3RlbmluZyA9IEV2ZW50LnRvUHJvbWlzZShFdmVudC5maWx0ZXIoaGFybmVzcy5zZXNzaW9uVmlldy5vbkRpZExpc3RlbiwgKCkgPT4gaGFybmVzcy5zZXNzaW9uVmlldy5oYXNTZXNzaW9uTGlzdGVuZXIoc2Vzc2lvbklkKSkpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgYm91bmRlZChsaXN0ZW5pbmcsICdhY3R1YWwgaG9zdCBsZWFzZSBhY3F1aXJlIGFuZCBmcmFtZSBsaXN0ZW5lciBtdXN0IGNvbXBsZXRlJyk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRsaXN0ZW5pbmcuY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IGNvbHVtbiA9IHBhbmUuZ2V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGFzc2VydC5vayhjb2x1bW4pO1xuXHRcdGNvbnN0IHBhaW50ZWQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdFx0Y29uc3QgY2hlY2sgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBib2R5ID0gY29sdW1uLnF1ZXJ5U2VsZWN0b3IoYC5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEtdHVybi1pZD1cIiR7c2Vzc2lvbklkfS1ib2R5XCJdIC5jb252ZXJzYXRpb24tbGVucy10dXJuLWJvZHlgKTtcblx0XHRcdGNvbnN0IHBlbmRpbmcgPSBjb2x1bW4ucXVlcnlTZWxlY3RvcihgLmNvbnZlcnNhdGlvbi1sZW5zLWNvbmZpcm1hdGlvbi1zZWF0W2RhdGEtdHVybi1pZD1cIiR7c2Vzc2lvbklkfS1wZXJtaXNzaW9uXCJdYCk7XG5cdFx0XHRpZiAoYm9keT8udGV4dENvbnRlbnQgPT09IHRleHQgJiYgcGVuZGluZz8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKGBQZXJtaXNzaW9uIGZvciAke3Nlc3Npb25JZH1gKSkge1xuXHRcdFx0XHR2b2lkIHBhaW50ZWQuY29tcGxldGUoKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoY2hlY2spO1xuXHRcdG9ic2VydmVyLm9ic2VydmUoY29sdW1uLCB7IGNoaWxkTGlzdDogdHJ1ZSwgY2hhcmFjdGVyRGF0YTogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcblx0XHRjb25zdCBhZG1pdHRlZCA9IEV2ZW50LnRvUHJvbWlzZShsZWFzZS5vbkRpZEFwcGx5RnJhbWUpO1xuXHRcdHRyeSB7XG5cdFx0XHRoYXJuZXNzLnNlc3Npb25WaWV3LmVtaXRTZXNzaW9uKHNlc3Npb25JZCwgdGV4dCk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGFkbWl0dGVkLCAnZnJhbWUgbXVzdCBiZSBhZG1pdHRlZCBieSB0aGUgYWN0dWFsIFBhbmUgbGVhc2UnKTtcblx0XHRcdHBhbmUubGF5b3V0KHsgd2lkdGg6IDgwMCwgaGVpZ2h0OiA2MDAgfSk7XG5cdFx0XHRjaGVjaygpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChwYWludGVkLnAsICdhY3R1YWwgUGFuZSB0dXJuIGFuZCBwZW5kaW5nIHNlYXQgbXVzdCBwYWludCB0aHJvdWdoIFRpbWVsaW5lSG9zdCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgbGVhc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlYXNlLnNuYXBzaG90LnRpbWVsaW5lLmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVhc2Uuc25hcHNob3QucGVuZGluZ0FjdGlvbnMubGVuZ3RoLCAxKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0b2JzZXJ2ZXIuZGlzY29ubmVjdCgpO1xuXHRcdFx0YWRtaXR0ZWQuY2FuY2VsKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gd2FpdEZvclNlc3Npb25QYW5lKFxuXHRcdGhhcm5lc3M6IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlUmV2ZWFsSGFybmVzcz4+LFxuXHRcdHNlc3Npb25LZXk6IHN0cmluZyxcblx0KTogUHJvbWlzZTxDb252ZXJzYXRpb25FZGl0b3JQYW5lPiB7XG5cdFx0cmV0dXJuIHdhaXRGb3JQYW5lKHBhcnRGb3IoaGFybmVzcy5wYXJ0cywgc2Vzc2lvbktleSksIGhhcm5lc3Mub3BlbkVycm9ycywgaGFybmVzcy5wYXJ0cyk7XG5cdH1cblxuXHRzdWl0ZSgndmlzaWJsZSBlbmdpbmUgbGVhc2UgcmVjb3ZlcnknLCAoKSA9PiB7XG5cdFx0dGVzdCgnTDEgc2FtZSB2aXNpYmxlIGVtcHR5IG93bmVyIHJlY292ZXJzIGl0cyBvd24gbGVhc2UgYWZ0ZXIgc2FtZS1zZXNzaW9uIGNhdGFsb2cgcmVhZHkgd2l0aG91dCByZXZlYWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlRW5naW5lUmV2ZWFsSGFybmVzcygpO1xuXHRcdFx0Y29uc3QgeyBwYW5lLCBsZW5zLCBwcmltYXJ5SWQsIHJvc3RlclNlcnZpY2UgfSA9IGhhcm5lc3M7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHBhbmUuaW5wdXQ7XG5cdFx0XHRhc3NlcnQub2soaW5wdXQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMubGFzdEF0dGFjaGVkRW50cmllcy5sZW5ndGgsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZT8uc25hcHNob3QudGltZWxpbmUubGVuZ3RoLCAwKTtcblx0XHRcdGNvbnN0IHBlbmRpbmcgPSBhd2FpdCBzdGFydEVtcHR5Q2F0YWxvZ1JlZnJlc2goaGFybmVzcywgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5pbnB1dCwgaW5wdXQpO1xuXHRcdFx0bGV0IGFjdGl2ZUNoYW5nZXMgPSAwO1xuXHRcdFx0Y29uc3QgYWN0aXZlTGlzdGVuZXIgPSBzdG9yZS5hZGQocm9zdGVyU2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZVNlc3Npb24oKCkgPT4geyBhY3RpdmVDaGFuZ2VzKys7IH0pKTtcblx0XHRcdGF3YWl0IGNvbXBsZXRlQ2F0YWxvZyhoYXJuZXNzLCBwZW5kaW5nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBwcmltYXJ5SWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZUNoYW5nZXMsIDAsICdzYW1lLXNlc3Npb24gcmVjb3ZlcnkgbXVzdCBub3QgcmVseSBvbiBhbiBhY3RpdmUtaWQgZXZlbnQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LCBpbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zLCBsZW5zKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmJvdW5kU2Vzc2lvbklkLCBwcmltYXJ5SWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuaXNEaXNwb3NlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uRW5naW5lTGl2ZShoYXJuZXNzLmNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblBoYXNlKCksIGhhcm5lc3MuY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZyksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaGFybmVzcy5jb25uZWN0aW9uKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Lm9rKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgJ2NhdGFsb2cgcmVhZHkgbXVzdCByZXN0b3JlIHRoaXMgdmlzaWJsZSBQYW5lIGxlYXNlIHdpdGhvdXQgaGlkZS9yZXZlYWwnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2Uuc2Vzc2lvbklkLCBwcmltYXJ5SWQpO1xuXHRcdFx0YWN0aXZlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoaGFybmVzcywgcGFuZSwgcHJpbWFyeUlkLCAnTDEgcmVjb3ZlcmVkIFBhbmUgYm9keScpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnTDIgY29udGludW91c2x5IGxpdmUgbm9uZW1wdHkgb3duZXIga2VlcHMgbGVhc2Ugc25hcHNob3QgZW50cmllcyBhbmQgdGV4dCB0aHJvdWdoIGNhdGFsb2cgcGVuZGluZyBmYWlsdXJlIGFuZCByZWFkeScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVFbmdpbmVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRFbmdpbmVGcmFtZVBhaW50cyhoYXJuZXNzLCBoYXJuZXNzLnBhbmUsIGhhcm5lc3MucHJpbWFyeUlkLCAnTDIga2VlcCB0aGlzIGJvZHknKTtcblx0XHRcdGNvbnN0IGxlYXNlID0gaGFybmVzcy5sZW5zLnNlc3Npb25WaWV3TGVhc2U7XG5cdFx0XHRhc3NlcnQub2sobGVhc2UpO1xuXHRcdFx0Y29uc3Qgc25hcHNob3QgPSBsZWFzZS5zbmFwc2hvdDtcblx0XHRcdGNvbnN0IGVudHJpZXMgPSBoYXJuZXNzLmxlbnMubGFzdEF0dGFjaGVkRW50cmllcztcblx0XHRcdGNvbnN0IGlucHV0ID0gaGFybmVzcy5wYW5lLmlucHV0O1xuXHRcdFx0Y29uc3QgYXNzZXJ0S2VwdCA9ICgpID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucGFuZS5pbnB1dCwgaW5wdXQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5wYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnMsIGhhcm5lc3MubGVucyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLmNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkuZW5naW5lSWRlbnRpdHlJZCwgJ3JldmVhbC1lbmdpbmUnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ29udmVyc2F0aW9uRW5naW5lTGl2ZShoYXJuZXNzLmNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblBoYXNlKCksIGhhcm5lc3MuY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZyksIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChoYXJuZXNzLmNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIGhhcm5lc3MucHJpbWFyeUlkKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MubGVucy5ib3VuZFNlc3Npb25JZCwgaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5sZW5zLnNlc3Npb25WaWV3TGVhc2UsIGxlYXNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlYXNlLnNuYXBzaG90LCBzbmFwc2hvdCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLmxlbnMubGFzdEF0dGFjaGVkRW50cmllcywgZW50cmllcyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnBhbmUuZ2V0UmVhZGluZ0NvbHVtbigpPy5xdWVyeVNlbGVjdG9yKGAuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLXR1cm4taWQ9XCIke2hhcm5lc3MucHJpbWFyeUlkfS1ib2R5XCJdIC5jb252ZXJzYXRpb24tbGVucy10dXJuLWJvZHlgKT8udGV4dENvbnRlbnQsICdMMiBrZWVwIHRoaXMgYm9keScpO1xuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGZhaWxlZCA9IGhhcm5lc3MuZGVmZXJDYXRhbG9nKCk7XG5cdFx0XHRoYXJuZXNzLm5vdGlmeSgnbGl2ZScpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChmYWlsZWQuc3RhcnRlZC5wLCAnc2FtZS1saXZlIGNhdGFsb2cgcmVmcmVzaCBtdXN0IHN0YXJ0Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0Q29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzcyhoYXJuZXNzLnJvc3RlclNlcnZpY2UpLCAnbG9hZGluZycpO1xuXHRcdFx0YXNzZXJ0S2VwdCgpO1xuXHRcdFx0YXdhaXQgZmFpbGVkLnJlc3VsdC5lcnJvcihuZXcgRXJyb3IoJ2NhdGFsb2cgdW5hdmFpbGFibGUnKSk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGhhcm5lc3Mucm9zdGVyU2VydmljZS53aGVuRW5naW5lQ2F0YWxvZ1JlZnJlc2hDb21wbGV0ZSgpLCAnZmFpbGVkIHJlYWwgbGlzdCBtdXN0IHNldHRsZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlKSwgJ3VuYXZhaWxhYmxlJyk7XG5cdFx0XHRhc3NlcnRLZXB0KCk7XG5cdFx0XHRjb25zdCByZWNvdmVyZWQgPSBoYXJuZXNzLmRlZmVyQ2F0YWxvZygpO1xuXHRcdFx0aGFybmVzcy5ub3RpZnkoJ2xpdmUnKTtcblx0XHRcdGF3YWl0IGJvdW5kZWQocmVjb3ZlcmVkLnN0YXJ0ZWQucCwgJ3NhbWUtbGl2ZSByZWNvdmVyeSBsaXN0IG11c3Qgc3RhcnQnKTtcblx0XHRcdGFzc2VydEtlcHQoKTtcblx0XHRcdGF3YWl0IGNvbXBsZXRlQ2F0YWxvZyhoYXJuZXNzLCByZWNvdmVyZWQpO1xuXHRcdFx0YXNzZXJ0S2VwdCgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnTDMgbG9hZGluZyBhbmQgcmVhbCBsaXN0IHJlamVjdGlvbiBsZWF2ZSBhIHZpc2libGUgZW1wdHkgb3duZXIgbWlzc2luZyB1bnRpbCBzdWNjZXNzZnVsIHJlYWR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZUVuZ2luZVJldmVhbEhhcm5lc3MoKTtcblx0XHRcdGNvbnN0IGZhaWxlZCA9IGF3YWl0IHN0YXJ0RW1wdHlDYXRhbG9nUmVmcmVzaChoYXJuZXNzKTtcblx0XHRcdGNvbnN0IGJpbmRzID0gb2JzZXJ2ZVBhbmVCaW5kcyhoYXJuZXNzLmxlbnMpO1xuXHRcdFx0YXNzZXJ0VmlzaWJsZU1pc3NpbmcoaGFybmVzcyk7XG5cdFx0XHRhd2FpdCBmYWlsZWQucmVzdWx0LmVycm9yKG5ldyBFcnJvcignbGlzdFNlc3Npb25zIHJlamVjdGVkJykpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChoYXJuZXNzLnJvc3RlclNlcnZpY2Uud2hlbkVuZ2luZUNhdGFsb2dSZWZyZXNoQ29tcGxldGUoKSwgJ3JlYWwgcmVqZWN0ZWQgbGlzdCBtdXN0IHNldHRsZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlKSwgJ3VuYXZhaWxhYmxlJyk7XG5cdFx0XHRhc3NlcnRWaXNpYmxlTWlzc2luZyhoYXJuZXNzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiaW5kcygpLCAwKTtcblx0XHRcdGNvbnN0IHJlY292ZXJ5ID0gYXdhaXQgc3RhcnRFbXB0eUNhdGFsb2dSZWZyZXNoKGhhcm5lc3MpO1xuXHRcdFx0Y29uc3QgYmVmb3JlUmVhZHkgPSBiaW5kcygpO1xuXHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGhhcm5lc3MsIHJlY292ZXJ5KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiaW5kcygpIC0gYmVmb3JlUmVhZHksIDEsICd0aGUgc2Vzc2lvbi1yZWFkeSBsaXN0ZW5lciBtdXN0IGNhbGwgdGhlIHJlYWwgUGFuZSBiaW5kIG9uY2UnKTtcblx0XHRcdGF3YWl0IGFzc2VydEVuZ2luZUZyYW1lUGFpbnRzKGhhcm5lc3MsIGhhcm5lc3MucGFuZSwgaGFybmVzcy5wcmltYXJ5SWQsICdMMyBjYXRhbG9nIHJlY292ZXJ5Jyk7XG5cdFx0fSk7XG5cblx0XHRmb3IgKGNvbnN0IHN0YXRlIG9mIFsnZGlzY29ubmVjdGVkJywgJ2Nvbm5lY3RlZCBwYWlyaW5nJywgJ2Nvbm5lY3RpbmcgcGFpcmluZyddIGFzIGNvbnN0KSB7XG5cdFx0XHR0ZXN0KGBMMyAke3N0YXRlfSBRdWV1ZVJlYWRlciBzZXNzaW9uIHdpbmRvdyBrZWVwcyBhIG5hdHVyYWxseSBtaXNzaW5nIHZpc2libGUgb3duZXIgdW5ib3VuZGAsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0bGV0IGhhcm5lc3M6IEVuZ2luZVJldmVhbEhhcm5lc3MgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGxldCBhcm1lZCA9IGZhbHNlO1xuXHRcdFx0XHRsZXQgYmluZHM6ICgoKSA9PiBudW1iZXIpIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBvcmRlcjogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0Y29uc3QgY2FwdHVyZSA9IChwb3NpdGlvbjogJ2JlZm9yZScgfCAnYWZ0ZXInKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKGhhcm5lc3MpO1xuXHRcdFx0XHRcdGFzc2VydC5vayhiaW5kcyk7XG5cdFx0XHRcdFx0Y29uc3QgbGVucyA9IGhhcm5lc3MucGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zO1xuXHRcdFx0XHRcdGFzc2VydC5vayhsZW5zKTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0cG9zaXRpb24sIHBhbmU6IGhhcm5lc3MucGFuZSwgaW5wdXQ6IGhhcm5lc3MucGFuZS5pbnB1dCwgbGVucyxcblx0XHRcdFx0XHRcdGJvdW5kOiBsZW5zLmJvdW5kU2Vzc2lvbklkLCB2aXNpYmxlOiBoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoaGFybmVzcy5wcmltYXJ5SWQpLFxuXHRcdFx0XHRcdFx0c3VzcGVuZGVkOiBsZW5zLnNlc3Npb25WaWV3QmluZGluZ1N1c3BlbmRlZCwgZGlzcG9zZWQ6IGxlbnMuaXNEaXNwb3NlZCwgbGVhc2U6IGxlbnMuc2Vzc2lvblZpZXdMZWFzZSxcblx0XHRcdFx0XHRcdHBoYXNlOiBoYXJuZXNzLmNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblBoYXNlKCkua2luZCwgcGFpcmluZzogaGFybmVzcy5jb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nLFxuXHRcdFx0XHRcdFx0Y29ubmVjdGVkOiBoYXJuZXNzLnJvc3RlclNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSwgcmVhZGluZXNzOiBnZXRDb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzKGhhcm5lc3Mucm9zdGVyU2VydmljZSksXG5cdFx0XHRcdFx0XHRxdWV1ZTogaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldE1lc3NhZ2VRdWV1ZVN0YXRlKGhhcm5lc3MucHJpbWFyeUlkKS5yZWFkU3RhdGUsIGJpbmRDYWxsczogYmluZHMoKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRjb25zdCBzYW1wbGVzOiBSZXR1cm5UeXBlPHR5cGVvZiBjYXB0dXJlPltdID0gW107XG5cdFx0XHRcdGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVFbmdpbmVSZXZlYWxIYXJuZXNzKHJvc3RlciA9PiB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKHJvc3Rlci5vbkRpZENoYW5nZVNlc3Npb24oaWQgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGFybWVkICYmIGlkID09PSAnbGVhc2UtczEnICYmIHNhbXBsZXMubGVuZ3RoID09PSAwICYmIHJvc3Rlci5nZXRNZXNzYWdlUXVldWVTdGF0ZShpZCkucmVhZFN0YXRlID09PSAnc3RhbGUnKSB7XG5cdFx0XHRcdFx0XHRcdG9yZGVyLnB1c2goJ3Nlc3Npb24gYmVmb3JlJyk7XG5cdFx0XHRcdFx0XHRcdHNhbXBsZXMucHVzaChjYXB0dXJlKCdiZWZvcmUnKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29uc3QgY3VycmVudCA9IGhhcm5lc3M7XG5cdFx0XHRcdGJpbmRzID0gb2JzZXJ2ZVBhbmVCaW5kcyhjdXJyZW50LmxlbnMpO1xuXHRcdFx0XHRzdG9yZS5hZGQoY3VycmVudC5yb3N0ZXJTZXJ2aWNlLm9uRGlkQ2hhbmdlU2Vzc2lvbihpZCA9PiB7XG5cdFx0XHRcdFx0aWYgKGFybWVkICYmIGlkID09PSBjdXJyZW50LnByaW1hcnlJZCAmJiBzYW1wbGVzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdFx0b3JkZXIucHVzaCgnc2Vzc2lvbiBhZnRlcicpO1xuXHRcdFx0XHRcdFx0c2FtcGxlcy5wdXNoKGNhcHR1cmUoJ2FmdGVyJykpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0XHRjb25zdCBwZW5kaW5nID0gYXdhaXQgc3RhcnRFbXB0eUNhdGFsb2dSZWZyZXNoKGN1cnJlbnQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3VycmVudC5yb3N0ZXJTZXJ2aWNlLmdldE1lc3NhZ2VRdWV1ZVN0YXRlKGN1cnJlbnQucHJpbWFyeUlkKS5yZWFkU3RhdGUsICd1bnN1cHBvcnRlZCcpO1xuXHRcdFx0XHRjb25zdCBiZWZvcmVDYWxscyA9IGJpbmRzKCk7XG5cdFx0XHRcdGNvbnN0IGlucHV0ID0gY3VycmVudC5wYW5lLmlucHV0O1xuXHRcdFx0XHRhcm1lZCA9IHRydWU7XG5cdFx0XHRcdG9yZGVyLnB1c2goJ1VBIHN0YXJ0Jyk7XG5cdFx0XHRcdGN1cnJlbnQubm90aWZ5KHN0YXRlKTtcblx0XHRcdFx0b3JkZXIucHVzaCgnVUEgcmV0dXJuJyk7XG5cdFx0XHRcdGFybWVkID0gZmFsc2U7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3JkZXIsIFsnVUEgc3RhcnQnLCAnc2Vzc2lvbiBiZWZvcmUnLCAnc2Vzc2lvbiBhZnRlcicsICdVQSByZXR1cm4nXSwgJ1F1ZXVlUmVhZGVyIG11c3QgZXhwb3NlIHRoZSBhY3R1YWwgaW5kZXBlbmRlbnQgY2FsbGJhY2sgd2luZG93Jyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGVzLmxlbmd0aCwgMik7XG5cdFx0XHRcdGZvciAoY29uc3Qgc2FtcGxlIG9mIHNhbXBsZXMpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLnBhbmUsIGN1cnJlbnQucGFuZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbXBsZS5pbnB1dCwgaW5wdXQpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUubGVucywgY3VycmVudC5sZW5zKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLmJvdW5kLCBjdXJyZW50LnByaW1hcnlJZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbXBsZS52aXNpYmxlLCB0cnVlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLnN1c3BlbmRlZCwgZmFsc2UpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUuZGlzcG9zZWQsIGZhbHNlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLmxlYXNlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUucGhhc2UsIHN0YXRlID09PSAnZGlzY29ubmVjdGVkJyA/ICdkaXNjb25uZWN0ZWQnIDogc3RhdGUgPT09ICdjb25uZWN0aW5nIHBhaXJpbmcnID8gJ2Nvbm5lY3RpbmcnIDogJ2Nvbm5lY3RlZCcpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUucGFpcmluZywgc3RhdGUgIT09ICdkaXNjb25uZWN0ZWQnKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLmNvbm5lY3RlZCwgZmFsc2UpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUucmVhZGluZXNzLCAncmVhZHknKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLnF1ZXVlLCAnc3RhbGUnKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLmJpbmRDYWxscywgYmVmb3JlQ2FsbHMsICduZXcgcmVjb25jaWxlIG11c3Qgbm90IGJpbmQgd2l0aGluIHRoZSBub24tbGl2ZSBjYWxsYmFjayB3aW5kb3cnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBMYXRlciBleGlzdGluZyBjb25uZWN0aW9uIGNhbGxiYWNrcyBtYXkgbGVnaXRpbWF0ZWx5IGJpbmQgYSBjYWNoZTsgZHJhaW4gdGhhdCBzY29wZSBzZXBhcmF0ZWx5LlxuXHRcdFx0XHRhd2FpdCBwZW5kaW5nLnJlc3VsdC5jb21wbGV0ZShjdXJyZW50LmNhdGFsb2cpO1xuXHRcdFx0XHRhd2FpdCBib3VuZGVkKGN1cnJlbnQucm9zdGVyU2VydmljZS53aGVuRW5naW5lQ2F0YWxvZ1JlZnJlc2hDb21wbGV0ZSgpLCAnc3RhbGUgcGVuZGluZyBjYXRhbG9nIG11c3QgZHJhaW4nKTtcblx0XHRcdFx0Y29uc3QgcmVjb3ZlcnkgPSBhd2FpdCBzdGFydEVtcHR5Q2F0YWxvZ1JlZnJlc2goY3VycmVudCk7XG5cdFx0XHRcdGF3YWl0IGNvbXBsZXRlQ2F0YWxvZyhjdXJyZW50LCByZWNvdmVyeSk7XG5cdFx0XHRcdGF3YWl0IGFzc2VydEVuZ2luZUZyYW1lUGFpbnRzKGN1cnJlbnQsIGN1cnJlbnQucGFuZSwgY3VycmVudC5wcmltYXJ5SWQsIGBMMyAke3N0YXRlfSByZXN0b3JlZGApO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGVzdCgnTDQgaGlkZGVuIHN1c3BlbmRlZCBvd25lciBzdGF5cyB1bmJvdW5kIHRocm91Z2ggZmFpbGVkIGFuZCByZWFkeSBjYXRhbG9ncyB1bnRpbCBwdWJsaWMgcmVzdG9yZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVFbmdpbmVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0XHRhd2FpdCBoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLm9wZW5TZXNzaW9uQmVzaWRlKCdsZWFzZS1zMicpO1xuXHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IHdhaXRGb3JFbmdpbmVQYW5lKHBhcnRGb3IoaGFybmVzcy5wYXJ0cywgJ2xlYXNlLXMyJykpO1xuXHRcdFx0dHJhY2tFZGl0b3JzKGhhcm5lc3MucGFydHMpO1xuXHRcdFx0Y29uc3QgbGVucyA9IHBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucztcblx0XHRcdGFzc2VydC5vayhsZW5zPy5zZXNzaW9uVmlld0xlYXNlKTtcblx0XHRcdGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaGlkZVNlc3Npb25XaW5kb3coJ2xlYXNlLXMyJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0JpbmRpbmdTdXNwZW5kZWQsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHRcdGNvbnN0IGJpbmRzID0gb2JzZXJ2ZVBhbmVCaW5kcyhsZW5zKTtcblx0XHRcdGNvbnN0IGZhaWxlZCA9IGhhcm5lc3MuZGVmZXJDYXRhbG9nKCk7XG5cdFx0XHRoYXJuZXNzLm5vdGlmeSgnbGl2ZScpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChmYWlsZWQuc3RhcnRlZC5wLCAnaGlkZGVuIGNvbnRyb2wgcmVhbCBsaXN0IG11c3Qgc3RhcnQnKTtcblx0XHRcdGF3YWl0IGZhaWxlZC5yZXN1bHQuZXJyb3IobmV3IEVycm9yKCdoaWRkZW4gY2F0YWxvZyBmYWlsdXJlJykpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChoYXJuZXNzLnJvc3RlclNlcnZpY2Uud2hlbkVuZ2luZUNhdGFsb2dSZWZyZXNoQ29tcGxldGUoKSwgJ2hpZGRlbiBmYWlsdXJlIG11c3Qgc2V0dGxlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJpbmRzKCksIDApO1xuXHRcdFx0Y29uc3QgcmVhZHkgPSBoYXJuZXNzLmRlZmVyQ2F0YWxvZygpO1xuXHRcdFx0aGFybmVzcy5ub3RpZnkoJ2xpdmUnKTtcblx0XHRcdGF3YWl0IGJvdW5kZWQocmVhZHkuc3RhcnRlZC5wLCAnaGlkZGVuIHJlY292ZXJ5IGxpc3QgbXVzdCBzdGFydCcpO1xuXHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGhhcm5lc3MsIHJlYWR5KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoJ2xlYXNlLXMyJyksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3QmluZGluZ1N1c3BlbmRlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJpbmRzKCksIDApO1xuXHRcdFx0aGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5yZXN0b3JlU2Vzc2lvbldpbmRvdygnbGVhc2UtczInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3QmluZGluZ1N1c3BlbmRlZCwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgcmVzdG9yZWRMZW5zID0gcGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zO1xuXHRcdFx0YXNzZXJ0Lm9rKHJlc3RvcmVkTGVucyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdG9yZWRMZW5zLCBsZW5zKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlZExlbnMuc2Vzc2lvblZpZXdMZWFzZT8uc2Vzc2lvbklkLCAnbGVhc2UtczInKTtcblx0XHRcdGF3YWl0IGFzc2VydEVuZ2luZUZyYW1lUGFpbnRzKGhhcm5lc3MsIHBhbmUsICdsZWFzZS1zMicsICdMNCBwdWJsaWMgcmVzdG9yZScpO1xuXHRcdFx0Y29uc3QgcmV0aXJlZExlYXNlID0gcmVzdG9yZWRMZW5zLnNlc3Npb25WaWV3TGVhc2U7XG5cdFx0XHRhc3NlcnQub2socmV0aXJlZExlYXNlKTtcblx0XHRcdGNvbnN0IHJldGFpbmVkT2JzZXJ2ZXIgPSBzdG9yZS5hZGQoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmFjcXVpcmVTZXNzaW9uVmlldygnbGVhc2UtczInKSk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocmV0YWluZWRPYnNlcnZlciwgcmV0aXJlZExlYXNlKTtcblx0XHRcdGNvbnN0IGhvc3RMZWFzZSA9IGhhcm5lc3Muc2Vzc2lvblZpZXcuYWNxdWlyZWQuZmluZChsZWFzZSA9PiBsZWFzZS5zZXNzaW9uSWQgPT09ICdsZWFzZS1zMicgJiYgIWhhcm5lc3Muc2Vzc2lvblZpZXcucmVsZWFzZWQuaGFzKGxlYXNlLmxlYXNlSWQpKTtcblx0XHRcdGFzc2VydC5vayhob3N0TGVhc2UsICd0aGUgcmVzdG9yZWQgUGFuZSBhbmQgb2JzZXJ2ZXIgbXVzdCBzaGFyZSBhbiBhY3F1aXJlZCBzMiBob3N0IGxlYXNlJyk7XG5cdFx0XHRsZXQgcmV0aXJlZEZyYW1lcyA9IDA7XG5cdFx0XHRzdG9yZS5hZGQocmV0aXJlZExlYXNlLm9uRGlkQXBwbHlGcmFtZSgoKSA9PiB7IHJldGlyZWRGcmFtZXMrKzsgfSkpO1xuXHRcdFx0Y29uc3QgcmVtb3ZlZCA9IGhhcm5lc3MuZGVmZXJDYXRhbG9nKCk7XG5cdFx0XHRoYXJuZXNzLm5vdGlmeSgnbGl2ZScpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChyZW1vdmVkLnN0YXJ0ZWQucCwgJ3B1YmxpYyByZW1vdmFsIGNhdGFsb2cgbXVzdCBzdGFydCcpO1xuXHRcdFx0Y29uc3Qgc3Vydml2aW5nQ2F0YWxvZyA9IHsgc2Vzc2lvbnM6IGhhcm5lc3MuY2F0YWxvZy5zZXNzaW9ucy5maWx0ZXIoc2Vzc2lvbiA9PiBzZXNzaW9uLnNlc3Npb25JZCAhPT0gJ2xlYXNlLXMyJykgfTtcblx0XHRcdGF3YWl0IHJlbW92ZWQucmVzdWx0LmNvbXBsZXRlKHN1cnZpdmluZ0NhdGFsb2cpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChoYXJuZXNzLnJvc3RlclNlcnZpY2Uud2hlbkVuZ2luZUNhdGFsb2dSZWZyZXNoQ29tcGxldGUoKSwgJ3B1YmxpYyBwcnVuZSBtdXN0IHNldHRsZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKCdsZWFzZS1zMicpLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKCdsZWFzZS1zMicpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKCdsZWFzZS1zMicpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5pc0Rpc3Bvc2VkLCB0cnVlKTtcblx0XHRcdGNvbnN0IHJldGlyZWRTbmFwc2hvdCA9IHJldGlyZWRMZWFzZS5zbmFwc2hvdDtcblx0XHRcdGNvbnN0IGZyYW1lc0FmdGVyUmVtb3ZhbCA9IHJldGlyZWRGcmFtZXM7XG5cdFx0XHRjb25zdCBvYnNlcnZlZCA9IEV2ZW50LnRvUHJvbWlzZShyZXRhaW5lZE9ic2VydmVyLm9uRGlkQXBwbHlGcmFtZSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRoYXJuZXNzLnNlc3Npb25WaWV3LmVtaXRTZXNzaW9uKCdsZWFzZS1zMicsICdMNCByZXRhaW5lZCBvYnNlcnZlciBvbmx5Jyk7XG5cdFx0XHRcdGF3YWl0IGJvdW5kZWQob2JzZXJ2ZWQsICd0aGUgbGl2ZSByZXRhaW5lZCBvYnNlcnZlciBtdXN0IGFkbWl0IHRoZSBwb3N0LXBydW5lIGhvc3QgZnJhbWUnKTtcblx0XHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHJldGFpbmVkT2JzZXJ2ZXIuc25hcHNob3QsIHJldGlyZWRTbmFwc2hvdCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXRpcmVkTGVhc2Uuc25hcHNob3QsIHJldGlyZWRTbmFwc2hvdCwgJ3RoZSBkaXNwb3NlZCBQYW5lIGxlYXNlIG11c3Qgbm8gbG9uZ2VyIHJlY2VpdmUgc2hhcmVkIGhvc3Qgc25hcHNob3RzJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXRpcmVkRnJhbWVzLCBmcmFtZXNBZnRlclJlbW92YWwpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0b2JzZXJ2ZWQuY2FuY2VsKCk7XG5cdFx0XHRcdHJldGFpbmVkT2JzZXJ2ZXIuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvblZpZXcucmVsZWFzZWQuaGFzKGhvc3RMZWFzZS5sZWFzZUlkKSwgdHJ1ZSwgJ3RoZSByZXRpcmVkIFBhbmUgYW5kIHJvc3RlciBtdXN0IHJlbGVhc2UgdGhlaXIgb3duZXJzaGlwIGJlZm9yZSB0aGUgZmluYWwgb2JzZXJ2ZXIgcmVsZWFzZXMgdGhlIGhvc3QnKTtcblx0XHRcdGNvbnN0IGFmdGVyUmVtb3ZhbCA9IGJpbmRzKCk7XG5cdFx0XHRjb25zdCBsYXRlID0gaGFybmVzcy5kZWZlckNhdGFsb2coKTtcblx0XHRcdGhhcm5lc3Mubm90aWZ5KCdsaXZlJyk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGxhdGUuc3RhcnRlZC5wLCAncG9zdC1yZW1vdmFsIGNhdGFsb2cgbXVzdCBzdGFydCcpO1xuXHRcdFx0YXdhaXQgbGF0ZS5yZXN1bHQuY29tcGxldGUoc3Vydml2aW5nQ2F0YWxvZyk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGhhcm5lc3Mucm9zdGVyU2VydmljZS53aGVuRW5naW5lQ2F0YWxvZ1JlZnJlc2hDb21wbGV0ZSgpLCAncG9zdC1yZW1vdmFsIGNhdGFsb2cgbXVzdCBzZXR0bGUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiaW5kcygpLCBhZnRlclJlbW92YWwsICdsYXRlciByZWFkeSBub3RpY2VzIGNhbm5vdCByZXZpdmUgdGhlIHJlbW92ZWQgbm9uLWhpZGRlbiBsZWFmJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV0aXJlZExlYXNlLnNuYXBzaG90LCByZXRpcmVkU25hcHNob3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldGlyZWRGcmFtZXMsIGZyYW1lc0FmdGVyUmVtb3ZhbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uVmlldy5yZWxlYXNlZC5oYXMoaG9zdExlYXNlLmxlYXNlSWQpLCB0cnVlKTtcblx0XHRcdGF3YWl0IGFzc2VydEVuZ2luZUZyYW1lUGFpbnRzKGhhcm5lc3MsIGhhcm5lc3MucGFuZSwgaGFybmVzcy5wcmltYXJ5SWQsICdMNCBzdXJ2aXZpbmcgb3duZXInKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ0w0IGFuIHVubW91bnRlZCBub24taGlkZGVuIGJvdW5kIGtleSBjYW5ub3QgcmVjb25jaWxlIGJlZm9yZSBpdHMgcHVibGljIGxlYWYgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZUVuZ2luZVJldmVhbEhhcm5lc3MoKTtcblx0XHRcdGNvbnN0IHBlbmRpbmcgPSBhd2FpdCBzdGFydEVtcHR5Q2F0YWxvZ1JlZnJlc2goaGFybmVzcyk7XG5cdFx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uQ2hhdElucHV0KGdldENvbnZlcnNhdGlvbkNoYXRSZXNvdXJjZSgnbGVhc2UtczInLCAndW5tb3VudGVkJykpKTtcblx0XHRcdGNvbnN0IHBhcnQgPSBwYXJ0Rm9yKGhhcm5lc3MucGFydHMsIGhhcm5lc3MucHJpbWFyeUlkKTtcblx0XHRcdGF3YWl0IGhhcm5lc3MuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKGlucHV0LCB1bmRlZmluZWQsIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdFx0Y29uc3QgcGFuZSA9IHBhcnQuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGFzc2VydC5vayhwYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSk7XG5cdFx0XHRjb25zdCBsZW5zID0gcGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zO1xuXHRcdFx0YXNzZXJ0Lm9rKGxlbnMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuaW5wdXQsIGlucHV0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmJvdW5kU2Vzc2lvbklkLCAnbGVhc2UtczInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0JpbmRpbmdTdXNwZW5kZWQsIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd0hpZGRlbignbGVhc2UtczInKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZSgnbGVhc2UtczInKSwgZmFsc2UpO1xuXHRcdFx0Y29uc3QgYmluZHMgPSBvYnNlcnZlUGFuZUJpbmRzKGxlbnMpO1xuXHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGhhcm5lc3MsIHBlbmRpbmcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiaW5kcygpLCAwLCAnbm90LWhpZGRlbiBpcyBub3QgZXZpZGVuY2Ugb2YgYSB2aXNpYmxlIGxlYWYnKTtcblx0XHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoJ2xlYXNlLXMyJyk7XG5cdFx0XHRjb25zdCBtb3VudGVkID0gYXdhaXQgd2FpdEZvckVuZ2luZVBhbmUocGFydEZvcihoYXJuZXNzLnBhcnRzLCAnbGVhc2UtczInKSk7XG5cdFx0XHR0cmFja0VkaXRvcnMoaGFybmVzcy5wYXJ0cyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRFbmdpbmVGcmFtZVBhaW50cyhoYXJuZXNzLCBtb3VudGVkLCAnbGVhc2UtczInLCAnTDQgbW91bnRlZCBzdWNjZXNzb3InKTtcblx0XHR9KTtcblxuXHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIFsnY2xlYXJJbnB1dCcsICdkaXNwb3NlJywgJ3N3aXRjaCBpbnB1dCddIGFzIGNvbnN0KSB7XG5cdFx0XHR0ZXN0KGBMNSAke2FjdGlvbn0gZHVyaW5nIHJlYWwgY2F0YWxvZyBwZW5kaW5nIGNhbm5vdCByZXZpdmUgdGhlIGNhcHR1cmVkIG93bmVyYCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlRW5naW5lUmV2ZWFsSGFybmVzcygpO1xuXHRcdFx0XHRjb25zdCBwZW5kaW5nID0gYXdhaXQgc3RhcnRFbXB0eUNhdGFsb2dSZWZyZXNoKGhhcm5lc3MpO1xuXHRcdFx0XHRjb25zdCBvbGRJbnB1dCA9IGhhcm5lc3MucGFuZS5pbnB1dDtcblx0XHRcdFx0Y29uc3Qgb2xkTGVucyA9IGhhcm5lc3MubGVucztcblx0XHRcdFx0Y29uc3Qgb2xkQmluZHMgPSBvYnNlcnZlUGFuZUJpbmRzKG9sZExlbnMpO1xuXHRcdFx0XHRpZiAoYWN0aW9uID09PSAnY2xlYXJJbnB1dCcpIHtcblx0XHRcdFx0XHRoYXJuZXNzLnBhbmUuY2xlYXJJbnB1dCgpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2Rpc3Bvc2UnKSB7XG5cdFx0XHRcdFx0aGFybmVzcy5wYW5lLmRpc3Bvc2UoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBpbnB1dCA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uQ2hhdElucHV0KGdldENvbnZlcnNhdGlvbkNoYXRSZXNvdXJjZShoYXJuZXNzLnByaW1hcnlJZCwgJ3N1Y2Nlc3NvcicpKSk7XG5cdFx0XHRcdFx0YXdhaXQgaGFybmVzcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHVuZGVmaW5lZCwgcGFydEZvcihoYXJuZXNzLnBhcnRzLCBoYXJuZXNzLnByaW1hcnlJZCkuYWN0aXZlR3JvdXApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnBhbmUuaW5wdXQsIGlucHV0KTtcblx0XHRcdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoaGFybmVzcy5wYW5lLmlucHV0LCBvbGRJbnB1dCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgYmVmb3JlUmVhZHkgPSBvbGRCaW5kcygpO1xuXHRcdFx0XHRhd2FpdCBjb21wbGV0ZUNhdGFsb2coaGFybmVzcywgcGVuZGluZyk7XG5cdFx0XHRcdGlmIChhY3Rpb24gPT09ICdzd2l0Y2ggaW5wdXQnKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zPy5ib3VuZFNlc3Npb25JZCwgaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbGRCaW5kcygpIC0gYmVmb3JlUmVhZHksIDEsICdvbmx5IHRoZSBjdXJyZW50IGlucHV0IGxpc3RlbmVyIG1heSByZWNvbmNpbGUnKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5wYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnM/LnNlc3Npb25WaWV3TGVhc2U/LnNlc3Npb25JZCwgaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucywgdW5kZWZpbmVkKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob2xkTGVucy5pc0Rpc3Bvc2VkLCB0cnVlKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob2xkQmluZHMoKSwgYmVmb3JlUmVhZHksICdsYXRlIGNhdGFsb2cvc2Vzc2lvbiBub3RpY2VzIGNhbm5vdCBiaW5kIHRoZSByZXRpcmVkIG93bmVyJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRlc3QoJ0w2IHJlcGVhdGVkIHJlYWwgc2Vzc2lvbiBub3RpY2VzIGtlZXAgdGhlIHJlY292ZXJlZCBsZWFzZSBhbmQgY29udGludWUgZGVsaXZlcmluZyBmcmFtZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlRW5naW5lUmV2ZWFsSGFybmVzcygpO1xuXHRcdFx0Y29uc3QgcGVuZGluZyA9IGF3YWl0IHN0YXJ0RW1wdHlDYXRhbG9nUmVmcmVzaChoYXJuZXNzKTtcblx0XHRcdGF3YWl0IGNvbXBsZXRlQ2F0YWxvZyhoYXJuZXNzLCBwZW5kaW5nKTtcblx0XHRcdGF3YWl0IGFzc2VydEVuZ2luZUZyYW1lUGFpbnRzKGhhcm5lc3MsIGhhcm5lc3MucGFuZSwgaGFybmVzcy5wcmltYXJ5SWQsICdMNiBmaXJzdCBmcmFtZScpO1xuXHRcdFx0Y29uc3QgbGVhc2UgPSBoYXJuZXNzLmxlbnMuc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRcdGFzc2VydC5vayhsZWFzZSk7XG5cdFx0XHRjb25zdCBjb3VudCA9IGhhcm5lc3Muc2Vzc2lvblZpZXcuYWNxdWlyZWQubGVuZ3RoO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAyOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgcmVmcmVzaCA9IGhhcm5lc3MuZGVmZXJDYXRhbG9nKCk7XG5cdFx0XHRcdGhhcm5lc3Mubm90aWZ5KCdsaXZlJyk7XG5cdFx0XHRcdGF3YWl0IGJvdW5kZWQocmVmcmVzaC5zdGFydGVkLnAsICdkdXBsaWNhdGUgcmVhbCByZWZyZXNoIG11c3Qgc3RhcnQnKTtcblx0XHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGhhcm5lc3MsIHJlZnJlc2gpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5sZW5zLnNlc3Npb25WaWV3TGVhc2UsIGxlYXNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvblZpZXcuYWNxdWlyZWQubGVuZ3RoLCBjb3VudCwgJ29ic2VydmF0aW9uIG93bmVycyBtdXN0IG5vdCBpbXBseSBhIG5ldyBwaHlzaWNhbCBhY3F1aXNpdGlvbicpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoaGFybmVzcywgaGFybmVzcy5wYW5lLCBoYXJuZXNzLnByaW1hcnlJZCwgJ0w2IGxhdGVyIGZyYW1lJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5sZW5zLnNlc3Npb25WaWV3TGVhc2UsIGxlYXNlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ0w3IHR3byBwaW5uZWQgdmlzaWJsZSBvd25lcnMgcmVjb3ZlciB0aGVpciBvd24gYm91bmRzIGZyb20gb25lIGFjdGl2ZS1zZXNzaW9uIGNhdGFsb2cgbm90aWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZUVuZ2luZVJldmVhbEhhcm5lc3MoKTtcblx0XHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoJ2xlYXNlLXMyJyk7XG5cdFx0XHRjb25zdCBzZWNvbmQgPSBhd2FpdCB3YWl0Rm9yRW5naW5lUGFuZShwYXJ0Rm9yKGhhcm5lc3MucGFydHMsICdsZWFzZS1zMicpKTtcblx0XHRcdHRyYWNrRWRpdG9ycyhoYXJuZXNzLnBhcnRzKTtcblx0XHRcdGNvbnN0IGxlbnMyID0gc2Vjb25kLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnM7XG5cdFx0XHRhc3NlcnQub2sobGVuczI/LnNlc3Npb25WaWV3TGVhc2UpO1xuXHRcdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGhhcm5lc3MucHJpbWFyeUlkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoaGFybmVzcy5wcmltYXJ5SWQpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoJ2xlYXNlLXMyJyksIHRydWUpO1xuXHRcdFx0Y29uc3QgcGVuZGluZyA9IGF3YWl0IHN0YXJ0RW1wdHlDYXRhbG9nUmVmcmVzaChoYXJuZXNzKTtcblx0XHRcdGFzc2VydFZpc2libGVNaXNzaW5nKGhhcm5lc3MsIHNlY29uZCwgJ2xlYXNlLXMyJyk7XG5cdFx0XHRjb25zdCBhY3RpdmUgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0XHRjb25zdCBub3RpZmllZDogc3RyaW5nW10gPSBbXTtcblx0XHRcdHN0b3JlLmFkZChoYXJuZXNzLnJvc3RlclNlcnZpY2Uub25EaWRDaGFuZ2VTZXNzaW9uKGlkID0+IHsgbm90aWZpZWQucHVzaChpZCk7IH0pKTtcblx0XHRcdGF3YWl0IGNvbXBsZXRlQ2F0YWxvZyhoYXJuZXNzLCBwZW5kaW5nKTtcblx0XHRcdGFzc2VydC5vayhub3RpZmllZC5pbmNsdWRlcyhhY3RpdmUpKTtcblx0XHRcdGFzc2VydC5vayghbm90aWZpZWQuaW5jbHVkZXMoJ2xlYXNlLXMyJyksICd0aGUgaW5hY3RpdmUgcGlubmVkIGxlYWYgY2Fubm90IHJlbHkgb24gaXRzIG93biBldmVudCBpZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zLCBoYXJuZXNzLmxlbnMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC5hY3RpdmVDb252ZXJzYXRpb25MZW5zLCBsZW5zMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5sZW5zLnNlc3Npb25WaWV3TGVhc2U/LnNlc3Npb25JZCwgaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMyLnNlc3Npb25WaWV3TGVhc2U/LnNlc3Npb25JZCwgJ2xlYXNlLXMyJyk7XG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoaGFybmVzcy5sZW5zLnNlc3Npb25WaWV3TGVhc2UsIGxlbnMyLnNlc3Npb25WaWV3TGVhc2UpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoaGFybmVzcywgaGFybmVzcy5wYW5lLCBoYXJuZXNzLnByaW1hcnlJZCwgJ0w3IGZpcnN0IGxlYWYgb25seScpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoaGFybmVzcywgc2Vjb25kLCAnbGVhc2UtczInLCAnTDcgc2Vjb25kIGxlYWYgb25seScpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFoYXJuZXNzLnBhbmUuZ2V0UmVhZGluZ0NvbHVtbigpPy50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0w3IHNlY29uZCBsZWFmIG9ubHknKSk7XG5cdFx0XHRhc3NlcnQub2soIXNlY29uZC5nZXRSZWFkaW5nQ29sdW1uKCk/LnRleHRDb250ZW50Py5pbmNsdWRlcygnTDcgZmlyc3QgbGVhZiBvbmx5JykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCc4IHNpbmdsZS1sZWFmIHJldmVhbCBBXHUyMTkyQlx1MjE5MkEga2VlcHMgb25lIHZpc2libGUgcHJpbWFyeSB3aXRob3V0IGhpZGUgYnV0dG9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBwYXJ0cywgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblxuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3coYik7XG5cdFx0Y29uc3QgcGFydEIgPSBwYXJ0Rm9yKHBhcnRzLCBiKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aXNpYmxlTGVhZktleXMoc2Vzc2lvbldpbmRvd1NlcnZpY2UpLCBbYl0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydEIuc2Vzc2lvbktleSwgYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRzLmdldEFjdGl2ZUNvbnZlcnNhdGlvbkVkaXRvclBhcnQoKT8uc2Vzc2lvbktleSwgYik7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd0hpZGRlbihwcmltYXJ5SWQpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydEZvcihwYXJ0cywgcHJpbWFyeUlkKS5zZXNzaW9uS2V5LCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoaWRlQnV0dG9uKHNlc3Npb25XaW5kb3dTZXJ2aWNlLCBiKT8uaGlkZGVuLCB0cnVlKTtcblxuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3cocHJpbWFyeUlkKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGVMZWFmS2V5cyhzZXNzaW9uV2luZG93U2VydmljZSksIFtwcmltYXJ5SWRdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0UHJpbWFyeVNlc3Npb25LZXkoKSwgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGlkZUJ1dHRvbihzZXNzaW9uV2luZG93U2VydmljZSwgcHJpbWFyeUlkKT8uaGlkZGVuLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnaGlkZSBmb2N1c2VkIHNlY29uZGFyeSBsZWFmIG1vdmVzIGZvY3VzIHRvIHByaW1hcnknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZUxpZ2h0d2VpZ2h0V2luZG93SGFybmVzcygpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0Y29uc3QgcHJpbWFyeUlkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHNlY29uZGFyeUlkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoc2Vjb25kYXJ5SWQpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhzZWNvbmRhcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0Rm9jdXNlZExlYWZTZXNzaW9uS2V5KCksIHNlY29uZGFyeUlkKTtcblxuXHRcdGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaGlkZVNlc3Npb25XaW5kb3coc2Vjb25kYXJ5SWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHNlY29uZGFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0Rm9jdXNlZExlYWZTZXNzaW9uS2V5KCksIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgcHJpbWFyeUxlYWYgPSBoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhwcmltYXJ5SWQpITtcblx0XHRjb25zdCBhY3RpdmUgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0YXNzZXJ0Lm9rKFxuXHRcdFx0cHJpbWFyeUxlYWYuY29udGFpbmVyID09PSBhY3RpdmUgfHwgcHJpbWFyeUxlYWYuY29udGFpbmVyLmNvbnRhaW5zKGFjdGl2ZSksXG5cdFx0XHQnZm9jdXMgbXVzdCBsZWF2ZSB0aGUgaGlkZGVuIGxlYWYgYW5kIGxhbmQgb24gdGhlIHZpc2libGUgcHJpbWFyeScsXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnOCB0d28gdmlzaWJsZSBsZWF2ZXM6IHJldmVhbCBhbHJlYWR5LXZpc2libGUgbGVhZiBmb2N1c2VzIGl0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBwYXJ0cywgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCwgY29udmVyc2F0aW9uUGFydCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZShiKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFZpc2libGVXaW5kb3dDb3VudCgpLCAyKTtcblxuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3coYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFZpc2libGVXaW5kb3dDb3VudCgpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0Rm9jdXNlZExlYWZTZXNzaW9uS2V5KCksIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydHMuZ2V0QWN0aXZlQ29udmVyc2F0aW9uRWRpdG9yUGFydCgpPy5zZXNzaW9uS2V5LCBiKTtcblx0XHRjb25zdCBsZWFmQiA9IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhiKTtcblx0XHRhc3NlcnQub2sobGVhZkIpO1xuXHRcdGNvbnN0IGFjdGl2ZSA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRhc3NlcnQub2soXG5cdFx0XHRsZWFmQi5jb250YWluZXIgPT09IGFjdGl2ZSB8fCBsZWFmQi5jb250YWluZXIuY29udGFpbnMoYWN0aXZlKSxcblx0XHRcdCdmb2N1cyBtdXN0IHN0YXkgaW4gdGhlIHJldmVhbGVkIGxlYWYsIG5vdCBzbmFwIGJhY2sgdG8gcHJpbWFyeScsXG5cdFx0KTtcblx0XHRjb25zdCBjaHJvbWUgPSBjb3VudExlYWZDaHJvbWUoc2Vzc2lvbldpbmRvd1NlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWUuYmFycywgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRGb3IocGFydHMsIHByaW1hcnlJZCkuc2Vzc2lvbktleSwgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydEZvcihwYXJ0cywgYikuc2Vzc2lvbktleSwgYik7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbmNlbGxlZCBhbHJlYWR5LXZpc2libGUgcmV2ZWFsIGRvZXMgbm90IHN3aXRjaCB0aGUgYWN0aXZlIHNlc3Npb24gYmFjaycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgcGFydHMsIHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBwcmltYXJ5SWQgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgYiA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoYik7XG5cdFx0Y29uc3QgcGFuZUEgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRjb25zdCBwYW5lQiA9IGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhc3NlcnQub2socGFuZUEubGVhZlNlc3Npb25CYXJIb3N0KTtcblx0XHRhc3NlcnQub2socGFuZUIubGVhZlNlc3Npb25CYXJIb3N0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXG5cdFx0bGV0IHJlbGVhc2VBID0gKCkgPT4geyB9O1xuXHRcdGNvbnN0IGdhdGUgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHsgcmVsZWFzZUEgPSByZXNvbHZlOyB9KTtcblx0XHQocGFydEZvcihwYXJ0cywgcHJpbWFyeUlkKSBhcyB7IHdoZW5SZWFkeTogUHJvbWlzZTx2b2lkPiB9KS53aGVuUmVhZHkgPSBnYXRlO1xuXG5cdFx0Y29uc3Qgc3dpdGNoZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgb3JpZ2luYWxTd2l0Y2ggPSByb3N0ZXJTZXJ2aWNlLnN3aXRjaFNlc3Npb24uYmluZChyb3N0ZXJTZXJ2aWNlKTtcblx0XHRyb3N0ZXJTZXJ2aWNlLnN3aXRjaFNlc3Npb24gPSAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHtcblx0XHRcdHN3aXRjaGVkLnB1c2goc2Vzc2lvbklkKTtcblx0XHRcdG9yaWdpbmFsU3dpdGNoKHNlc3Npb25JZCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGZpcnN0ID0gcGFuZUEubGVhZlNlc3Npb25CYXJIb3N0LnN3aXRjaExlYWZTZXNzaW9uKHByaW1hcnlJZCk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRhd2FpdCBwYW5lQi5sZWFmU2Vzc2lvbkJhckhvc3Quc3dpdGNoTGVhZlNlc3Npb24oYik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0Rm9jdXNlZExlYWZTZXNzaW9uS2V5KCksIGIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIGIpO1xuXHRcdFx0c3dpdGNoZWQubGVuZ3RoID0gMDtcblx0XHRcdHJlbGVhc2VBKCk7XG5cdFx0XHRhd2FpdCBmaXJzdDtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3dpdGNoZWQsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgYik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgYik7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHJlbGVhc2VBKCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdoaWRlIGR1cmluZyBwYW5lLWxlc3MgcmV2ZWFsIHdhaXQgZG9lcyBub3Qgc3RlYWwgZm9jdXMgb3IgdGhlIGFjdGl2ZSBzZXNzaW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgxNV8wMDApO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVMaWdodHdlaWdodFdpbmRvd0hhcm5lc3MoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnRzIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IHByaW1hcnlJZCA9IHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHNlY29uZGFyeUlkID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZShzZWNvbmRhcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXG5cdFx0Y29uc3Qgc2Vjb25kYXJ5UGFydCA9IGNvbnZlcnNhdGlvblBhcnRzLmZpbmQocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHNlY29uZGFyeUlkKTtcblx0XHRhc3NlcnQub2soc2Vjb25kYXJ5UGFydCk7XG5cdFx0Y29uc3QgZ3JvdXAgPSBzZWNvbmRhcnlQYXJ0LmFjdGl2ZUdyb3VwIGFzIHsgYWN0aXZlRWRpdG9yUGFuZT86IHsgZ2V0SWQoKTogc3RyaW5nIH07IG9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlPzogRXZlbnQ8dW5rbm93bj4gfTtcblx0XHRncm91cC5hY3RpdmVFZGl0b3JQYW5lID0gdW5kZWZpbmVkO1xuXHRcdGdyb3VwLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlID0gRXZlbnQuTm9uZTtcblxuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3cocHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0Rm9jdXNlZExlYWZTZXNzaW9uS2V5KCksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgcHJpbWFyeUxlYWYgPSBzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMocHJpbWFyeUlkKSE7XG5cdFx0Y29uc3QgYWN0aXZlQmVmb3JlID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdGFzc2VydC5vayhcblx0XHRcdHByaW1hcnlMZWFmLmNvbnRhaW5lciA9PT0gYWN0aXZlQmVmb3JlIHx8IHByaW1hcnlMZWFmLmNvbnRhaW5lci5jb250YWlucyhhY3RpdmVCZWZvcmUpLFxuXHRcdFx0J3ByaW1hcnkgbXVzdCBvd24gZm9jdXMgYmVmb3JlIHRoZSBzdGFsbGVkIHJldmVhbCcsXG5cdFx0KTtcblxuXHRcdGNvbnN0IHN3aXRjaGVkOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IG9yaWdpbmFsU3dpdGNoID0gcm9zdGVyU2VydmljZS5zd2l0Y2hTZXNzaW9uLmJpbmQocm9zdGVyU2VydmljZSk7XG5cdFx0cm9zdGVyU2VydmljZS5zd2l0Y2hTZXNzaW9uID0gKHNlc3Npb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRzd2l0Y2hlZC5wdXNoKHNlc3Npb25JZCk7XG5cdFx0XHRvcmlnaW5hbFN3aXRjaChzZXNzaW9uSWQpO1xuXHRcdH07XG5cblx0XHRsZXQgc2V0dGxlZCA9IGZhbHNlO1xuXHRcdGNvbnN0IHJldmVhbCA9IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3coc2Vjb25kYXJ5SWQpLmZpbmFsbHkoKCkgPT4geyBzZXR0bGVkID0gdHJ1ZTsgfSk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2V0dGxlZCwgZmFsc2UsICdyZXZlYWwgbXVzdCBzdGlsbCBiZSB3YWl0aW5nIGZvciBhbiBlZGl0b3IgcGFuZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKHNlY29uZGFyeUlkKSwgdHJ1ZSk7XG5cblx0XHRzZXNzaW9uV2luZG93U2VydmljZS5oaWRlU2Vzc2lvbldpbmRvdyhzZWNvbmRhcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd0hpZGRlbihzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgcHJpbWFyeUlkKTtcblx0XHRjb25zdCBhY3RpdmVEdXJpbmcgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0YXNzZXJ0Lm9rKFxuXHRcdFx0cHJpbWFyeUxlYWYuY29udGFpbmVyID09PSBhY3RpdmVEdXJpbmcgfHwgcHJpbWFyeUxlYWYuY29udGFpbmVyLmNvbnRhaW5zKGFjdGl2ZUR1cmluZyksXG5cdFx0XHQnZm9jdXMgbXVzdCBzdGF5IG9uIHRoZSBwcmltYXJ5IHdoaWxlIHRoZSBoaWRkZW4gbGVhZiBpcyBzdGlsbCB3YWl0aW5nJyxcblx0XHQpO1xuXG5cdFx0YXdhaXQgcmV2ZWFsO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXR0bGVkLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHNlY29uZGFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEZvY3VzZWRMZWFmU2Vzc2lvbktleSgpLCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IGFjdGl2ZUFmdGVyID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdGFzc2VydC5vayhcblx0XHRcdHByaW1hcnlMZWFmLmNvbnRhaW5lciA9PT0gYWN0aXZlQWZ0ZXIgfHwgcHJpbWFyeUxlYWYuY29udGFpbmVyLmNvbnRhaW5zKGFjdGl2ZUFmdGVyKSxcblx0XHRcdCdmb2N1cyBtdXN0IHN0YXkgb24gdGhlIHByaW1hcnkgYWZ0ZXIgdGhlIHBhbmUgd2FpdCBlbmRzJyxcblx0XHQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3dpdGNoZWQsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnMTAgU2VsZWN0Qm94IHBhdGggb24gcmVhbCBwYW5lIGNoYW5nZXMgdGhlIGxlYWYgKFBSRC0wMDIgIzEpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBwYXJ0cywgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRjb25zdCBwYW5lID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0Lm9rKHBhbmUubGVhZlNlc3Npb25CYXJIb3N0KTtcblx0XHRhd2FpdCBwYW5lLmxlYWZTZXNzaW9uQmFySG9zdCEuc3dpdGNoTGVhZlNlc3Npb24oYik7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDEpO1xuXHRcdGFzc2VydC5vayhwYXJ0Rm9yKHBhcnRzLCBiKS5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3IpO1xuXHR9KTtcblxuXHR0ZXN0KCcxMCB0d28gdmlzaWJsZSBsZWF2ZXM6IFNlbGVjdEJveCBvbiBvbmUgbGVhZiByZXBsYWNlcyB0aGF0IGxlYWYgd2l0aCBhIHRoaXJkIHNlc3Npb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHBhcnRzLCBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGNvbnN0IGMgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLm9wZW5TZXNzaW9uQmVzaWRlKGIpO1xuXHRcdGNvbnN0IHBhbmVCID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGFzc2VydC5vayhwYW5lQi5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdGF3YWl0IHBhbmVCLmxlYWZTZXNzaW9uQmFySG9zdCEuc3dpdGNoTGVhZlNlc3Npb24oYyk7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGMpO1xuXHRcdGNvbnN0IHZpc2libGUgPSB2aXNpYmxlTGVhZktleXMoc2Vzc2lvbldpbmRvd1NlcnZpY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aXNpYmxlLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0Lm9rKHZpc2libGUuaW5jbHVkZXMocHJpbWFyeUlkKSwgJ3RoZSBvdGhlciBsZWFmIG11c3Qgc3RheScpO1xuXHRcdGFzc2VydC5vayh2aXNpYmxlLmluY2x1ZGVzKGMpLCAndGhlIG9wZXJhdGVkIGxlYWYgbXVzdCBiZWNvbWUgdGhlIHRoaXJkIHNlc3Npb24nKTtcblx0XHRhc3NlcnQub2soIXZpc2libGUuaW5jbHVkZXMoYiksICd0aGUgb3BlcmF0ZWQgbGVhZiBtdXN0IG5vdCByZW1haW4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydEZvcihwYXJ0cywgcHJpbWFyeUlkKS5zZXNzaW9uS2V5LCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Rm9yKHBhcnRzLCBjKS5zZXNzaW9uS2V5LCBjKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKGIpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gc3dpdGNoVG9TZXNzaW9uIHN3aXRjaExlYWZTZXNzaW9uIHJlamVjdHMgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5vayhwYW5lLmxlYWZTZXNzaW9uQmFySG9zdCk7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdzd2l0Y2ggYm9vbScpO1xuXHRcdHBhbmUubGVhZlNlc3Npb25CYXJIb3N0LnN3aXRjaExlYWZTZXNzaW9uID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdH07XG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRwYW5lLmxlYWZTZXNzaW9uQmFySG9zdCEuc3dpdGNoVG9TZXNzaW9uKCdvdGhlci1zZXNzaW9uJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIFNlbGVjdEJveCBoZWxwZXIgc3dpdGNoVG9TZXNzaW9uIHN3aXRjaExlYWZTZXNzaW9uIHJlamVjdHMgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5vayhwYW5lLmxlYWZTZXNzaW9uQmFySG9zdCk7XG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdzd2l0Y2ggYm9vbScpO1xuXHRcdHBhbmUubGVhZlNlc3Npb25CYXJIb3N0LnN3aXRjaExlYWZTZXNzaW9uID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdH07XG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRzd2l0Y2hUb1Nlc3Npb25IZWxwZXIocGFuZS5sZWFmU2Vzc2lvbkJhckhvc3QhLCAnb3RoZXItc2Vzc2lvbicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTZWxlY3RCb3ggaGVscGVyIHN3aXRjaFRvU2Vzc2lvbiBmaXJlLWFuZC1mb3JnZXQgdm9pZHMgZG91YmxlLWNhdGNoIG9uVW5leHBlY3RlZEVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhci50c2ApO1xuXHRcdGNvbnN0IGRvdWJsZUNhdGNoID0gJy5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpJztcblx0XHRhc3NlcnQub2soc291cmNlLmluY2x1ZGVzKGB2b2lkIGhvc3Quc3dpdGNoTGVhZlNlc3Npb24oc2Vzc2lvbklkKSR7ZG91YmxlQ2F0Y2h9YCkpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIGhvc3Quc3dpdGNoTGVhZlNlc3Npb24oc2Vzc2lvbklkKTsnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJzEwIE5ldyBTZXNzaW9uIGluIHN0dWIgcGF0aCBiZWNvbWVzIHRoZSBvbmx5IHZpc2libGUgbGVhZicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBwYW5lID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0Lm9rKHBhbmUubGVhZlNlc3Npb25CYXJIb3N0KTtcblx0XHRwYW5lLmxlYWZTZXNzaW9uQmFySG9zdCEuY3JlYXRlTmV3U2Vzc2lvbigpO1xuXHRcdGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIDMwMDA7XG5cdFx0bGV0IG5ld0lkID0gcm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHR3aGlsZSAobmV3SWQgPT09IHByaW1hcnlJZCAmJiBEYXRlLm5vdygpIDwgZGVhZGxpbmUpIHtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdFx0bmV3SWQgPSByb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdH1cblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwobmV3SWQsIHByaW1hcnlJZCk7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIG5ld0lkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCBuZXdJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhpZGVCdXR0b24oc2Vzc2lvbldpbmRvd1NlcnZpY2UsIG5ld0lkKT8uaGlkZGVuLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHByaW1hcnlJZCksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCcxMyBlYWNoIHZpc2libGUgbGVhZiBoYXMgZXhhY3RseSBvbmUgU2Vzc2lvbkJhciBhbmQgd2luZG93LW5hdjsgUGFydCBzbG90IGhhcyBub25lJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgY29udmVyc2F0aW9uUGFydCwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGNvbnN0IGMgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhjKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYyk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBwcmltYXJ5SWQpO1xuXHRcdGxldCBjaHJvbWUgPSBjb3VudExlYWZDaHJvbWUoc2Vzc2lvbldpbmRvd1NlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZS5iYXJzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lLm5hdnMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWUucGFydFNsb3RCYXJzLCAwKTtcblxuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLm9wZW5TZXNzaW9uQmVzaWRlKGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRjaHJvbWUgPSBjb3VudExlYWZDaHJvbWUoc2Vzc2lvbldpbmRvd1NlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZS5iYXJzLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lLm5hdnMsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWUucGFydFNsb3RCYXJzLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnMTNiIGxlYWYgU2Vzc2lvbkJhciBhbmQgY29udGFpbmVyIHJlY2VpdmUgaXMtbmFycm93IHdoZW4gcGFuZSB3aWR0aCBpcyB1bmRlciA0NTBweCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHByaW1hcnlJZCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBwYW5lID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgbGVhZiA9IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhwcmltYXJ5SWQpITtcblxuXHRcdHBhbmUubGF5b3V0KG5ldyBEaW1lbnNpb24oNTAwLCA2MDApKTtcblx0XHRhc3NlcnQub2sobGVhZi5zZXNzaW9uQmFyLmNsYXNzTGlzdC5jb250YWlucygnaXMtbWVkaXVtJykpO1xuXHRcdGFzc2VydC5vayghbGVhZi5zZXNzaW9uQmFyLmNsYXNzTGlzdC5jb250YWlucygnaXMtbmFycm93JykpO1xuXG5cdFx0cGFuZS5sYXlvdXQobmV3IERpbWVuc2lvbig0MDAsIDYwMCkpO1xuXHRcdGFzc2VydC5vayhsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKGxlYWYuY29udGFpbmVyLmNsYXNzTGlzdC5jb250YWlucygnaXMtbmFycm93JykpO1xuXHRcdGFzc2VydC5vayghbGVhZi5zZXNzaW9uQmFyLmNsYXNzTGlzdC5jb250YWlucygnaXMtY29tcGFjdCcpKTtcblxuXHRcdHBhbmUubGF5b3V0KG5ldyBEaW1lbnNpb24oMjUwLCA2MDApKTtcblx0XHRhc3NlcnQub2sobGVhZi5zZXNzaW9uQmFyLmNsYXNzTGlzdC5jb250YWlucygnaXMtbmFycm93JykpO1xuXHRcdGFzc2VydC5vayhsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1jb21wYWN0JykpO1xuXG5cdFx0cGFuZS5sYXlvdXQobmV3IERpbWVuc2lvbig5NTAsIDYwMCkpO1xuXHRcdGFzc2VydC5vayghbGVhZi5zZXNzaW9uQmFyLmNsYXNzTGlzdC5jb250YWlucygnaXMtbmFycm93JykpO1xuXHRcdGFzc2VydC5vayghbGVhZi5jb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1jb21wYWN0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCcxNCByZXZlYWwgbW91bnRzIG92ZXJsYXkgc28gb3BlblN1YkFnZW50IGRvZXMgbm90IHRocm93JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgc2Vzc2lvbkNoYXRTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3coYik7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGF3YWl0IHNlc3Npb25DaGF0U2VydmljZS5vcGVuU3ViQWdlbnQoYiwgJ3Rvb2wtZnJvbS1yZXZlYWwnLCAnUmV2ZWFsIHRvb2wnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbkNoYXRTZXJ2aWNlLmlzU3ViQWdlbnREaWFsb2dPcGVuKGIpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnMTUgbGF0ZXN0LXdpbnMgcmV2ZWFsIGVuZHMgb24gQjsgYmluZC1mYWlsZWQgc2VudGluZWwgZG9lcyBub3QgY3JlYXRlIGEgbGVhZicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBwcmltYXJ5SWQgfSA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCBhID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRjb25zdCBmaXJzdCA9IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3coYSk7XG5cdFx0Y29uc3Qgc2Vjb25kID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChbZmlyc3QsIHNlY29uZF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKHNlc3Npb25XaW5kb3dTZXJ2aWNlKSwgW2JdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0UHJpbWFyeVNlc3Npb25LZXkoKSwgYik7XG5cblx0XHRjb25zdCBrZXlzQmVmb3JlID0gWy4uLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpXTtcblx0XHRyb3N0ZXJTZXJ2aWNlLmZpcmVBY3RpdmVTZXNzaW9uKEVOR0lORV9CSU5EX0ZBSUxFRF9TRVNTSU9OX0lEKTtcblx0XHRhd2FpdCB0aW1lb3V0KDIwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFsuLi5zZXNzaW9uV2luZG93U2VydmljZS5nZXRBbGxMZWFmU2Vzc2lvbktleXMoKV0sIGtleXNCZWZvcmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMoRU5HSU5FX0JJTkRfRkFJTEVEX1NFU1NJT05fSUQpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5vayhzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMocHJpbWFyeUlkKSB8fCBzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMoYikpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkRpZERlbGV0ZVNlc3Npb24gZGlzcG9zZXMgdmlzaWJsZSBsZWFmIHdoZW4gYmluZC1mYWlsZWQgc2tpcHMgcmV2ZWFsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVMaWdodHdlaWdodFdpbmRvd0hhcm5lc3MoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IGhhcm5lc3Mucm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRhd2FpdCBoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmVuc3VyZVByaW1hcnlXaW5kb3coc2Vzc2lvbklkKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGVMZWFmS2V5cyhoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlKSwgW3Nlc3Npb25JZF0pO1xuXHRcdGFzc2VydC5vayhoYXJuZXNzLmNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHNlc3Npb25JZCkpO1xuXG5cdFx0aGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmZpcmVBY3RpdmVTZXNzaW9uKEVOR0lORV9CSU5EX0ZBSUxFRF9TRVNTSU9OX0lEKTtcblx0XHRoYXJuZXNzLnJvc3RlclNlcnZpY2UuZmlyZURlbGV0ZWRTZXNzaW9uKHNlc3Npb25JZCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGVMZWFmS2V5cyhoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlKSwgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKCFoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpLmluY2x1ZGVzKHNlc3Npb25JZCkpO1xuXHRcdGFzc2VydC5vayghaGFybmVzcy5jb252ZXJzYXRpb25QYXJ0cy5zb21lKHBhcnQgPT4gcGFydC5zZXNzaW9uS2V5ID09PSBzZXNzaW9uSWQpKTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWREZWxldGVTZXNzaW9uIGRpc3Bvc2VzIGEgaGlkZGVuIGxlYWYgYW5kIGl0cyBlZGl0b3IgcGFydCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgcGFydHMsIHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBwcmltYXJ5SWQgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5SWQgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLm9wZW5TZXNzaW9uQmVzaWRlKHNlY29uZGFyeUlkKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgc2Vjb25kYXJ5SWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd0hpZGRlbihwcmltYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQub2soc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHByaW1hcnlJZCkpO1xuXHRcdGFzc2VydC5vayhwYXJ0cy5jb252ZXJzYXRpb25QYXJ0cy5zb21lKHBhcnQgPT4gcGFydC5zZXNzaW9uS2V5ID09PSBwcmltYXJ5SWQpKTtcblxuXHRcdHJvc3RlclNlcnZpY2UuZmlyZURlbGV0ZWRTZXNzaW9uKHByaW1hcnlJZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHByaW1hcnlJZCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKCFwYXJ0cy5jb252ZXJzYXRpb25QYXJ0cy5zb21lKHBhcnQgPT4gcGFydC5zZXNzaW9uS2V5ID09PSBwcmltYXJ5SWQpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGVMZWFmS2V5cyhzZXNzaW9uV2luZG93U2VydmljZSksIFtzZWNvbmRhcnlJZF0pO1xuXHR9KTtcblxuXHR0ZXN0KCcxNSBzdHViLXNlZWQgdW50aXRsZWQgb25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uIHN0aWxsIHJldmVhbHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlIH0gPSBoYXJuZXNzO1xuXHRcdGFzc2VydC5vayhpc0VuZ2luZVJvc3RlclBsYWNlaG9sZGVyU2Vzc2lvbklkKCd1bnRpdGxlZCcpKTtcblx0XHRhc3NlcnQub2socm9zdGVyU2VydmljZS5nZXRTZXNzaW9ucygpLnNvbWUoc2Vzc2lvbiA9PiBzZXNzaW9uLmlkID09PSAndW50aXRsZWQnKSk7XG5cdFx0Y29uc3QgYiA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd0hpZGRlbigndW50aXRsZWQnKSwgdHJ1ZSk7XG5cblx0XHRyb3N0ZXJTZXJ2aWNlLmZpcmVBY3RpdmVTZXNzaW9uKCd1bnRpdGxlZCcpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCAndW50aXRsZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZSgndW50aXRsZWQnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aXNpYmxlTGVhZktleXMoc2Vzc2lvbldpbmRvd1NlcnZpY2UpLCBbJ3VudGl0bGVkJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCAndW50aXRsZWQnKTtcblx0fSk7XG5cblx0dGVzdCgnMTUgcmV2ZWFsIGNyZWF0ZSBmYWlsdXJlIHJvbGxzIGJhY2sgcGFydCArIGxlYWYgYW5kIHJlYnVpbGRzIHRoZSBzYW1lIGtleScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByb3N0ZXJTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBRdWlldFJvc3RlclNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgZ3JpZEhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGdyaWRIb3N0KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBncmlkSG9zdC5yZW1vdmUoKSB9KTtcblxuXHRcdGNvbnN0IGNvbnZlcnNhdGlvblBhcnRzOiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydFtdID0gW107XG5cdFx0bGV0IHRocm93T25DcmVhdGUgPSBmYWxzZTtcblx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0ge1xuXHRcdFx0Y3JlYXRlQ29udmVyc2F0aW9uRWRpdG9yUGFydDogKF9wYXJlbnQ6IHVua25vd24sIHNlc3Npb25LZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRpZiAodGhyb3dPbkNyZWF0ZSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcigncmV2ZWFsIGJvb20nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBwYXJ0ID0geyBzZXNzaW9uS2V5LCB3aGVuUmVhZHk6IFByb21pc2UucmVzb2x2ZSgpLCBhY3RpdmVHcm91cDogeyBmb2N1czogKCkgPT4geyB9LCBhY3RpdmVFZGl0b3JQYW5lOiB7IGdldElkOiAoKSA9PiBDb252ZXJzYXRpb25FZGl0b3JQYW5lSWQgfSB9IH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uRWRpdG9yUGFydDtcblx0XHRcdFx0Y29udmVyc2F0aW9uUGFydHMucHVzaChwYXJ0KTtcblx0XHRcdFx0cmV0dXJuIHBhcnQ7XG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZUNvbnZlcnNhdGlvbkVkaXRvclBhcnQ6IChzZXNzaW9uS2V5OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5kZXggPSBjb252ZXJzYXRpb25QYXJ0cy5maW5kSW5kZXgocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHNlc3Npb25LZXkpO1xuXHRcdFx0XHRpZiAoaW5kZXggPj0gMCkge1xuXHRcdFx0XHRcdGNvbnZlcnNhdGlvblBhcnRzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRzZXRGb2N1c2VkQ29udmVyc2F0aW9uTGVhZjogKCkgPT4geyB9LFxuXHRcdFx0Z2V0Rm9jdXNlZENvbnZlcnNhdGlvbkxlYWY6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdGdldCBjb252ZXJzYXRpb25QYXJ0cygpIHtcblx0XHRcdFx0cmV0dXJuIGNvbnZlcnNhdGlvblBhcnRzO1xuXHRcdFx0fSxcblx0XHR9IGFzIHVua25vd24gYXMgSUVkaXRvckdyb3Vwc1NlcnZpY2U7XG5cblx0XHRjb25zdCBlcnJvcnM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgc2Vzc2lvbldpbmRvd1NlcnZpY2UgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvblNlc3Npb25XaW5kb3dTZXJ2aWNlKFxuXHRcdFx0e1xuXHRcdFx0XHRvbkRpZENyZWF0ZVNsb3RzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRvbkRpZEZvY3VzOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRnZXRTbG90czogKCkgPT4gKHsgc2Vzc2lvbkJhcjogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksIHNlc3Npb25XaW5kb3dHcmlkOiBncmlkSG9zdCwgZWRpdG9yUGFydEhvc3Q6IHVuZGVmaW5lZCB9KSxcblx0XHRcdFx0c2V0Rm9jdXNlZExlYWZDb250YWluZXI6ICgpID0+IHsgfSxcblx0XHRcdFx0Zm9jdXM6ICgpID0+IHsgfSxcblx0XHRcdH0gYXMgdW5rbm93biBhcyBJQ29udmVyc2F0aW9uUGFydFNlcnZpY2UsXG5cdFx0XHRlZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdFx0cm9zdGVyU2VydmljZSxcblx0XHRcdG5ldyBOdWxsTG9nU2VydmljZSgpLFxuXHRcdFx0e1xuXHRcdFx0XHRlcnJvcjogKG1lc3NhZ2U6IHN0cmluZyB8IEVycm9yKSA9PiB7XG5cdFx0XHRcdFx0ZXJyb3JzLnB1c2godHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnID8gbWVzc2FnZSA6IGdldEVycm9yTWVzc2FnZShtZXNzYWdlKSk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdCkpO1xuXG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRjb25zdCBwcmltYXJ5SWQgPSByb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmVuc3VyZVByaW1hcnlXaW5kb3cocHJpbWFyeUlkKTtcblx0XHRjb25zdCB0YXJnZXQgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdHRocm93T25DcmVhdGUgPSB0cnVlO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3codGFyZ2V0KTtcblxuXHRcdGFzc2VydC5vayhlcnJvcnMuc29tZShlcnJvciA9PiBlcnJvci5pbmNsdWRlcygncmV2ZWFsIGJvb20nKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHModGFyZ2V0KSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIXNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpLmluY2x1ZGVzKHRhcmdldCkpO1xuXHRcdGFzc2VydC5vayghY29udmVyc2F0aW9uUGFydHMuc29tZShwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gdGFyZ2V0KSk7XG5cblx0XHR0aHJvd09uQ3JlYXRlID0gZmFsc2U7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyh0YXJnZXQpO1xuXHRcdGFzc2VydC5vayhzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHModGFyZ2V0KSk7XG5cdFx0YXNzZXJ0Lm9rKGNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHRhcmdldCkpO1xuXHRcdGFzc2VydC5vayhzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHModGFyZ2V0KT8uY29udGFpbmVyLmlzQ29ubmVjdGVkKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gb3BlblR3b0xpZ2h0d2VpZ2h0TGVhdmVzKCkge1xuXHRcdGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBoYXJuZXNzID0gY3JlYXRlTGlnaHR3ZWlnaHRXaW5kb3dIYXJuZXNzKCk7XG5cdFx0aGFybmVzcy5zZXROb3RpZnlFcnJvcihtZXNzYWdlID0+IHtcblx0XHRcdGVycm9ycy5wdXNoKHR5cGVvZiBtZXNzYWdlID09PSAnc3RyaW5nJyA/IG1lc3NhZ2UgOiBnZXRFcnJvck1lc3NhZ2UobWVzc2FnZSkpO1xuXHRcdH0pO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0Y29uc3QgcHJpbWFyeUlkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHNlY29uZGFyeUlkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoc2Vjb25kYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFZpc2libGVXaW5kb3dDb3VudCgpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRjb25zdCBpbmNvbWluZ0lkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdHJldHVybiB7IGhhcm5lc3MsIGVycm9ycywgcHJpbWFyeUlkLCBzZWNvbmRhcnlJZCwgaW5jb21pbmdJZCB9O1xuXHR9XG5cblx0dGVzdCgnc2Vjb25kYXJ5IHJlcGxhY2UgY3JlYXRlIGZhaWx1cmUgcmVzdG9yZXMgdGhlIG91dGdvaW5nIGxlYWYgYW5kIG5vdGlmaWVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgaGFybmVzcywgZXJyb3JzLCBwcmltYXJ5SWQsIHNlY29uZGFyeUlkLCBpbmNvbWluZ0lkIH0gPSBhd2FpdCBvcGVuVHdvTGlnaHR3ZWlnaHRMZWF2ZXMoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCBjb252ZXJzYXRpb25QYXJ0cyB9ID0gaGFybmVzcztcblx0XHRoYXJuZXNzLnNldFRocm93T25DcmVhdGUodHJ1ZSk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhpbmNvbWluZ0lkLCB7IHJlcGxhY2U6IHNlY29uZGFyeUlkIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShwcmltYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMoaW5jb21pbmdJZCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKCFzZXNzaW9uV2luZG93U2VydmljZS5nZXRBbGxMZWFmU2Vzc2lvbktleXMoKS5pbmNsdWRlcyhpbmNvbWluZ0lkKSk7XG5cdFx0YXNzZXJ0Lm9rKCFjb252ZXJzYXRpb25QYXJ0cy5zb21lKHBhcnQgPT4gcGFydC5zZXNzaW9uS2V5ID09PSBpbmNvbWluZ0lkKSk7XG5cdFx0YXNzZXJ0Lm9rKGVycm9ycy5zb21lKGVycm9yID0+IGVycm9yLmluY2x1ZGVzKCdyZXZlYWwgYm9vbScpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NlY29uZGFyeSByZXBsYWNlIHdoZW5SZWFkeSBmYWlsdXJlIHJlc3RvcmVzIHRoZSBvdXRnb2luZyBsZWFmIGFuZCBub3RpZmllcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IGhhcm5lc3MsIGVycm9ycywgcHJpbWFyeUlkLCBzZWNvbmRhcnlJZCwgaW5jb21pbmdJZCB9ID0gYXdhaXQgb3BlblR3b0xpZ2h0d2VpZ2h0TGVhdmVzKCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgY29udmVyc2F0aW9uUGFydHMgfSA9IGhhcm5lc3M7XG5cdFx0aGFybmVzcy5zZXRSZWplY3RXaGVuUmVhZHkodHJ1ZSk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhpbmNvbWluZ0lkLCB7IHJlcGxhY2U6IHNlY29uZGFyeUlkIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShwcmltYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMoaW5jb21pbmdJZCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKCFzZXNzaW9uV2luZG93U2VydmljZS5nZXRBbGxMZWFmU2Vzc2lvbktleXMoKS5pbmNsdWRlcyhpbmNvbWluZ0lkKSk7XG5cdFx0YXNzZXJ0Lm9rKCFjb252ZXJzYXRpb25QYXJ0cy5zb21lKHBhcnQgPT4gcGFydC5zZXNzaW9uS2V5ID09PSBpbmNvbWluZ0lkKSk7XG5cdFx0YXNzZXJ0Lm9rKGVycm9ycy5zb21lKGVycm9yID0+IGVycm9yLmluY2x1ZGVzKCd3aGVuUmVhZHkgYm9vbScpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByaW1hcnkgcmVwbGFjZSBjcmVhdGUgZmFpbHVyZSBkb2VzIG5vdCBoaWRlIHRoZSBvbGQgcHJpbWFyeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IGhhcm5lc3MsIGVycm9ycywgcHJpbWFyeUlkLCBzZWNvbmRhcnlJZCwgaW5jb21pbmdJZCB9ID0gYXdhaXQgb3BlblR3b0xpZ2h0d2VpZ2h0TGVhdmVzKCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSB9ID0gaGFybmVzcztcblx0XHRoYXJuZXNzLnNldFRocm93T25DcmVhdGUodHJ1ZSk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhpbmNvbWluZ0lkLCB7IHJlcGxhY2U6IHByaW1hcnlJZCB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4ocHJpbWFyeUlkKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKHNlY29uZGFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFZpc2libGVXaW5kb3dDb3VudCgpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKGluY29taW5nSWQpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5vayghc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0QWxsTGVhZlNlc3Npb25LZXlzKCkuaW5jbHVkZXMoaW5jb21pbmdJZCkpO1xuXHRcdGFzc2VydC5vayhlcnJvcnMuc29tZShlcnJvciA9PiBlcnJvci5pbmNsdWRlcygncmV2ZWFsIGJvb20nKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCcxNyBoaWRpbmcgYSBsZWFmIHJlbGVhc2VzIGl0cyBsZW5zIGxlYXNlIGFuZCByZXN0b3JlIHJlYWNxdWlyZXMgaXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHBhcnRzLCBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkLCBzZXNzaW9uQ2hhdFNlcnZpY2UgfSA9IGhhcm5lc3M7XG5cdFx0YXdhaXQgc2Vzc2lvbkNoYXRTZXJ2aWNlLm9wZW5FeHRlbnNpb25UYWIocHJpbWFyeUlkLCAnZm9yay1sZWFzZScsIHsgdGl0bGU6ICdGb3JrIGxlYXNlJyB9KTtcblx0XHRjb25zdCBwYW5lQSA9IGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHBhcnRBID0gcGFydEZvcihwYXJ0cywgcHJpbWFyeUlkKTtcblx0XHRjb25zdCB0YWJDb3VudCA9IHBhcnRBLmFjdGl2ZUdyb3VwLmNvdW50O1xuXHRcdGFzc2VydC5vayh0YWJDb3VudCA+PSAyKTtcblx0XHRhc3NlcnQub2socGFuZUEuYWN0aXZlQ29udmVyc2F0aW9uTGVucyk7XG5cblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0QS5hY3RpdmVHcm91cC5jb3VudCwgdGFiQ291bnQpO1xuXHRcdGNvbnN0IGhpZGRlbkxlbnNlcyA9IGF3YWl0IGNvbGxlY3RMZWFmQ29udmVyc2F0aW9uTGVuc2VzKHBhcnRBKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGlkZGVuTGVuc2VzLmxlbmd0aCwgdGFiQ291bnQpO1xuXHRcdGZvciAoY29uc3QgbGVucyBvZiBoaWRkZW5MZW5zZXMpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0QS5zZXNzaW9uS2V5LCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IGhpZGRlbkxlYWYgPSBzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMocHJpbWFyeUlkKT8uY29udGFpbmVyO1xuXHRcdGFzc2VydC5vayhoaWRkZW5MZWFmPy5jbGFzc0xpc3QuY29udGFpbnMoY29udmVyc2F0aW9uU2Vzc2lvbkxlYWZIaWRkZW5DbGFzcykpO1xuXHRcdGNvbnN0IHN0YWxlQmFubmVyID0gaGlkZGVuTGVhZj8ucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXN0YWxlLXNuYXBzaG90JykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayghc3RhbGVCYW5uZXIgfHwgc3RhbGVCYW5uZXIuaGlkZGVuIHx8ICFzdGFsZUJhbm5lci50ZXh0Q29udGVudCk7XG5cblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgcGFuZUEyID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgcmVzdG9yZWRMZW5zZXMgPSBhd2FpdCBjb2xsZWN0TGVhZkNvbnZlcnNhdGlvbkxlbnNlcyhwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdG9yZWRMZW5zZXMubGVuZ3RoLCB0YWJDb3VudCk7XG5cdFx0Zm9yIChjb25zdCBsZW5zIG9mIHJlc3RvcmVkTGVuc2VzKSB7XG5cdFx0XHRhc3NlcnQub2sobGVucy5zZXNzaW9uVmlld0xlYXNlLCAncmVzdG9yZSBtdXN0IHJlYWNxdWlyZSBzZXNzaW9uVmlld0xlYXNlIG9uIGV2ZXJ5IGxlYWYgbGVucycpO1xuXHRcdH1cblx0XHRhc3NlcnQub2socGFuZUEyLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnM/LnNlc3Npb25WaWV3TGVhc2UsICdyZXN0b3JlIG11c3QgcmVhY3F1aXJlIHNlc3Npb25WaWV3TGVhc2UnKTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gb25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uIHJldmVhbCBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHQvLyByZXZlYWxTZXNzaW9uV2luZG93IGFscmVhZHkgY2F0Y2hlcyBjcmVhdGUgdGhyb3c7IGEgbG9uZSBpbm5lciByZWplY3QgZG9lcyBub3QgbGVhay5cblx0XHQvLyBUaGUgdm9pZCBvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb24gY2FsbCBzaXRlIHN0aWxsIG5lZWRzIGAuY2F0Y2hgIHdoZW4gdGhlIGNhdGNoLXBhdGggbm90aWNlIHRocm93cy5cblx0XHQvLyBBIGxvbmUgYC5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcilgIHN0aWxsIGxlYWtzIHdoZW4gdGhlIGhhbmRsZXIgd2Fybi10aGVuLXJldGhyb3dzLlxuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVMaWdodHdlaWdodFdpbmRvd0hhcm5lc3MoKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGNvbnN0IHByaW1hcnlJZCA9IGhhcm5lc3Mucm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRhd2FpdCBoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmVuc3VyZVByaW1hcnlXaW5kb3cocHJpbWFyeUlkKTtcblx0XHRjb25zdCB0YXJnZXQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0aGFybmVzcy5zZXRUaHJvd09uQ3JlYXRlKHRydWUpO1xuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4ge1xuXHRcdFx0aGFybmVzcy5zZXROb3RpZnlFcnJvcigoKSA9PiB7XG5cdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdH0pO1xuXHRcdFx0aGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmZpcmVBY3RpdmVTZXNzaW9uKHRhcmdldCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGxlYWsgdW5oYW5kbGVkIHJlamVjdGlvbiB3aGVuIGF0dGFjaEdyaWQgcGVuZGluZyByZXZlYWwgY2F0Y2gtcGF0aCBub3RpY2UgdGhyb3dzIGFuZCBvblVuZXhwZWN0ZWRFcnJvciB3YXJuLXRoZW4tcmV0aHJvd3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Ly8gcmV2ZWFsU2Vzc2lvbldpbmRvdyBhbHJlYWR5IGNhdGNoZXMgY3JlYXRlIHRocm93OyBhIGxvbmUgaW5uZXIgcmVqZWN0IGRvZXMgbm90IGxlYWsuXG5cdFx0Ly8gVGhlIHZvaWQgYXR0YWNoR3JpZCBwZW5kaW5nIGNhbGwgc2l0ZSBzdGlsbCBuZWVkcyBgLmNhdGNoYCB3aGVuIHRoZSBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MuXG5cdFx0Ly8gQSBsb25lIGAuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpYCBzdGlsbCBsZWFrcyB3aGVuIHRoZSBoYW5kbGVyIHdhcm4tdGhlbi1yZXRocm93cy5cblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3BhaW50IGJvb20nKTtcblx0XHRjb25zdCBoYXJuZXNzID0gY3JlYXRlTGlnaHR3ZWlnaHRXaW5kb3dIYXJuZXNzKHsgZGVsYXlTbG90czogdHJ1ZSB9KTtcblx0XHRjb25zdCB0YXJnZXQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0aGFybmVzcy5zZXRUaHJvd09uQ3JlYXRlKHRydWUpO1xuXHRcdGF3YWl0IGFzc2VydFdhcm5UaGVuUmV0aHJvd0RvZXNOb3RMZWFrKHBhaW50Qm9vbSwgKCkgPT4ge1xuXHRcdFx0aGFybmVzcy5zZXROb3RpZnlFcnJvcigoKSA9PiB7XG5cdFx0XHRcdHRocm93IHBhaW50Qm9vbTtcblx0XHRcdH0pO1xuXHRcdFx0dm9pZCBoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3codGFyZ2V0LCB7IHJlcGxhY2U6IGhhcm5lc3Mucm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSB9KTtcblx0XHRcdGhhcm5lc3MuYXR0YWNoU2xvdHMoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc2Vzc2lvbiB3aW5kb3cgZmlyZS1hbmQtZm9yZ2V0IHZvaWRzIGRvdWJsZS1jYXRjaCBvblVuZXhwZWN0ZWRFcnJvcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzb3VyY2UgPSBhd2FpdCBfX3JlYWRGaWxlSW5UZXN0cyhgJHtwcm9jZXNzLmN3ZCgpfS9zcmMvdnMvd29ya2JlbmNoL2NvbnRyaWIvY29udmVyc2F0aW9uL2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UudHNgKTtcblx0XHRjb25zdCBkb3VibGVDYXRjaCA9ICcuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKSc7XG5cdFx0YXNzZXJ0Lm9rKHNvdXJjZS5pbmNsdWRlcyhgdm9pZCB0aGlzLnJldmVhbFNlc3Npb25XaW5kb3coc2Vzc2lvbktleSkke2RvdWJsZUNhdGNofWApKTtcblx0XHRhc3NlcnQub2soc291cmNlLmluY2x1ZGVzKGB2b2lkIHRoaXMucmV2ZWFsU2Vzc2lvbldpbmRvdyhwZW5kaW5nLnNlc3Npb25LZXksIHBlbmRpbmcub3B0aW9ucykke2RvdWJsZUNhdGNofWApKTtcblx0XHRhc3NlcnQub2soc291cmNlLmluY2x1ZGVzKGB2b2lkIHRoaXMuZW5zdXJlUHJpbWFyeVdpbmRvdyh0aGlzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCkpJHtkb3VibGVDYXRjaH1gKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzb3VyY2UuaW5jbHVkZXMoJ3ZvaWQgdGhpcy5yZXZlYWxTZXNzaW9uV2luZG93KHNlc3Npb25LZXkpOycpKTtcblx0XHRhc3NlcnQub2soIXNvdXJjZS5pbmNsdWRlcygndm9pZCB0aGlzLnJldmVhbFNlc3Npb25XaW5kb3cocGVuZGluZy5zZXNzaW9uS2V5LCBwZW5kaW5nLm9wdGlvbnMpOycpKTtcblx0XHRhc3NlcnQub2soIXNvdXJjZS5pbmNsdWRlcygndm9pZCB0aGlzLmVuc3VyZVByaW1hcnlXaW5kb3codGhpcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpKTsnKSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxXQUFXLHdCQUF3QjtBQUM1QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQixhQUFhLGVBQWU7QUFDdEQsU0FBUyxjQUFjLGlCQUFpQixpQ0FBaUM7QUFDekUsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUE2QixvQkFBb0I7QUFDMUQsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxhQUFhLHNCQUFzQjtBQUU1QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGtCQUFrQixnQ0FBOEQ7QUFDekYsU0FBa0MsNEJBQTRC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T0FBSyw0SUFBNEksWUFBWTtBQUk1SixVQUFNLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFDeEMsVUFBTSxVQUFVLCtCQUErQjtBQUMvQyxVQUFNLFFBQVEsQ0FBQztBQUNmLFVBQU0sWUFBWSxRQUFRLGNBQWMsbUJBQW1CO0FBQzNELFVBQU0sUUFBUSxxQkFBcUIsb0JBQW9CLFNBQVM7QUFDaEUsVUFBTSxTQUFTLFFBQVEsY0FBYyxtQkFBbUI7QUFDeEQsWUFBUSxpQkFBaUIsSUFBSTtBQUM3QixVQUFNLGlDQUFpQyxXQUFXLE1BQU07QUFDdkQsY0FBUSxlQUFlLE1BQU07QUFDNUIsY0FBTTtBQUFBLE1BQ1AsQ0FBQztBQUNELGNBQVEsY0FBYyxrQkFBa0IsTUFBTTtBQUFBLElBQy9DLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHNJQUFzSSxZQUFZO0FBSXRKLFVBQU0sWUFBWSxJQUFJLE1BQU0sWUFBWTtBQUN4QyxVQUFNLFVBQVUsK0JBQStCLEVBQUUsWUFBWSxLQUFLLENBQUM7QUFDbkUsVUFBTSxTQUFTLFFBQVEsY0FBYyxtQkFBbUI7QUFDeEQsWUFBUSxpQkFBaUIsSUFBSTtBQUM3QixVQUFNLGlDQUFpQyxXQUFXLE1BQU07QUFDdkQsY0FBUSxlQUFlLE1BQU07QUFDNUIsY0FBTTtBQUFBLE1BQ1AsQ0FBQztBQUNELFdBQUssUUFBUSxxQkFBcUIsb0JBQW9CLFFBQVEsRUFBRSxTQUFTLFFBQVEsY0FBYyxtQkFBbUIsRUFBRSxDQUFDO0FBQ3JILGNBQVEsWUFBWTtBQUFBLElBQ3JCLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLHVFQUF1RSxZQUFZO0FBQ3ZGLFVBQU0sU0FBUyxNQUFNLGtCQUFrQixHQUFHLFFBQVEsSUFBSSxDQUFDLG9GQUFvRjtBQUMzSSxVQUFNLGNBQWM7QUFDcEIsV0FBTyxHQUFHLE9BQU8sU0FBUyw0Q0FBNEMsV0FBVyxFQUFFLENBQUM7QUFDcEYsV0FBTyxHQUFHLE9BQU8sU0FBUyxxRUFBcUUsV0FBVyxFQUFFLENBQUM7QUFDN0csV0FBTyxHQUFHLE9BQU8sU0FBUyx5RUFBeUUsV0FBVyxFQUFFLENBQUM7QUFDakgsV0FBTyxHQUFHLENBQUMsT0FBTyxTQUFTLDRDQUE0QyxDQUFDO0FBQ3hFLFdBQU8sR0FBRyxDQUFDLE9BQU8sU0FBUyxxRUFBcUUsQ0FBQztBQUNqRyxXQUFPLEdBQUcsQ0FBQyxPQUFPLFNBQVMseUVBQXlFLENBQUM7QUFBQSxFQUN0RyxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
