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
      await waitForEnginePane(primaryPart);
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
  async function waitForEnginePane(part) {
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
    const pane = await waitForEnginePane(partFor(harness.parts, harness.primaryId));
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi90ZXN0L2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1JldmVhbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGltZW5zaW9uLCBnZXRBY3RpdmVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHJhY2VUaW1lb3V0LCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZXJyb3JIYW5kbGVyLCBnZXRFcnJvck1lc3NhZ2UsIHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25QYXJ0LCBJQ29udmVyc2F0aW9uUGFydFNlcnZpY2UsIElDb252ZXJzYXRpb25QYXJ0V2luZG93U2xvdHMgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3BhcnRzL2NvbnZlcnNhdGlvbi9jb252ZXJzYXRpb25QYXJ0LmpzJztcbmltcG9ydCB7IElDb252ZXJzYXRpb25FZGl0b3JQYXJ0LCBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2Jyb3dzZXIvZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zLCBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVFZGl0b3JQYXJ0cywgcmVnaXN0ZXJUZXN0RWRpdG9yLCBUZXN0RmlsZUVkaXRvcklucHV0LCB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9zaWRlQnlTaWRlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0ICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkVkaXRvci5jb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uRWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25TZXNzaW9uQ2hhdENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvbkNoYXQuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbk5hdmlnYXRpb25Db250cmlidXRpb24gfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbk5hdmlnYXRpb24uY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbk5hdmlnYXRpb25TZXJ2aWNlLCBJQ29udmVyc2F0aW9uTmF2aWdhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbk5hdmlnYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvblNlc3Npb25DaGF0U2VydmljZSwgSUNvbnZlcnNhdGlvblNlc3Npb25DaGF0U2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvbkNoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHN3aXRjaFRvU2Vzc2lvbiBhcyBzd2l0Y2hUb1Nlc3Npb25IZWxwZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvblNlc3Npb25XaW5kb3dTZXJ2aWNlLCBJQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25XaW5kb3dTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlLCBJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU3R1YlNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnZlcnNhdGlvblRpbWVsaW5lUmV2ZWFsU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uVGltZWxpbmVSZXZlYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb252ZXJzYXRpb25SZXZpZXdOYXZTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25SZXZpZXdFbnRyeS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25FbmdpbmVSb3N0ZXJTZXJ2aWNlLCBFTkdJTkVfQklORF9GQUlMRURfU0VTU0lPTl9JRCwgaXNFbmdpbmVSb3N0ZXJQbGFjZWhvbGRlclNlc3Npb25JZCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uRW5naW5lUm9zdGVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRDb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25TZXNzaW9uQXZhaWxhYmlsaXR5LmpzJztcbmltcG9ydCB7IGlzQ29udmVyc2F0aW9uRW5naW5lTGl2ZSwgaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvblN0YXR1cy5qcyc7XG5pbXBvcnQgeyBzdHViVHVybnNUb1NuYXBzaG90IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25TZXNzaW9uVmlldy5qcyc7XG5pbXBvcnQgdHlwZSB7IENvbnZlcnNhdGlvbkxlbnMgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnMuanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uRWRpdG9yUGFuZUlkLCBjb252ZXJzYXRpb25TZXNzaW9uTGVhZkhpZGRlbkNsYXNzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbnZlcnNhdGlvblNlc3Npb25XaW5kb3cuanMnO1xuaW1wb3J0IHsgVUFfQ0xJRU5UX0NIQVRfSU5QVVRfQVVUT19GT0NVUyB9IGZyb20gJy4uLy4uL2NvbW1vbi91YUNsaWVudFNldHRpbmdzS2V5cy5qcyc7XG5pbXBvcnQgeyBJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi91bml2ZXJzZUFnZW50Q29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJVW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3LCB0eXBlIElVbml2ZXJzZUFnZW50U2Vzc2lvblZpZXdGcmFtZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3LmpzJztcbmltcG9ydCB0eXBlIHsgVmlld0xlYXNlSWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi9zZXNzaW9uVmlldy90eXBlcy5qcyc7XG5pbXBvcnQgdHlwZSB7IENvbm5lY3Rpb25QaGFzZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuaXZlcnNlQWdlbnQvY29tbW9uL2Nvbm5lY3Rpb25IdWJUeXBlcy5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25DaGF0SW5wdXQsIGdldENvbnZlcnNhdGlvbkNoYXRSZXNvdXJjZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb252ZXJzYXRpb25DaGF0SW5wdXQuanMnO1xuaW1wb3J0IHsgY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViIH0gZnJvbSAnLi4vY29tbW9uL2NvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yi5qcyc7XG5pbXBvcnQgeyBzdHViQ29udmVyc2F0aW9uVGltZWxpbmVMaW5rU2VydmljZXMgfSBmcm9tICcuL2NvbnZlcnNhdGlvblRpbWVsaW5lTGlua1Rlc3RTdHVicy5qcyc7XG5pbXBvcnQgeyBpbnN0YWxsQ29udmVyc2F0aW9uTGVuc1Jlc2l6ZU9ic2VydmVySGFybmVzcyB9IGZyb20gJy4vY29udmVyc2F0aW9uTGVuc0xheW91dEhhcm5lc3MuanMnO1xuaW1wb3J0IHsgSUV4cGxvcmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2ZpbGVzL2Jyb3dzZXIvZmlsZXMuanMnO1xuaW1wb3J0IHsgSVNDTVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zY20vY29tbW9uL3NjbS5qcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gX19yZWFkRmlsZUluVGVzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+O1xuXG5jbGFzcyBRdWlldFJvc3RlclNlcnZpY2UgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdHNlZWRTZXNzaW9uUXVpZXRseSgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHByZXZpb3VzID0gdGhpcy5tb2RlbC5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSB0aGlzLm1vZGVsLmNyZWF0ZVNlc3Npb24oKTtcblx0XHR0aGlzLm1vZGVsLnN3aXRjaFNlc3Npb24ocHJldmlvdXMpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdFx0cmV0dXJuIHNlc3Npb25JZDtcblx0fVxuXG5cdGZpcmVBY3RpdmVTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uLmZpcmUoc2Vzc2lvbklkKTtcblx0fVxuXG5cdGZpcmVEZWxldGVkU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkRGVsZXRlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdH1cbn1cblxuLyoqIFB1YmxpYyBTZXNzaW9uVmlldyBib3VuZGFyeTsgcHJvZHVjdGlvbiBGcmFtZVNvdXJjZSBzdGlsbCBvd25zIHJlcGxpY2FzIGFuZCBmYW5vdXQuICovXG5jbGFzcyBSZXZlYWxFbmdpbmVTZXNzaW9uVmlldyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3IHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGFjcXVpcmVkOiB7IGxlYXNlSWQ6IHN0cmluZzsgc2Vzc2lvbklkOiBzdHJpbmcgfVtdID0gW107XG5cdHJlYWRvbmx5IHJlbGVhc2VkID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZW1pdHRlcnMgPSBuZXcgTWFwPHN0cmluZywgRW1pdHRlcjxJVW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3RnJhbWVFdmVudD4+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgdmVyc2lvbnMgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGxpc3RlbmluZyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpZExpc3RlbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkTGlzdGVuID0gdGhpcy5kaWRMaXN0ZW4uZXZlbnQ7XG5cblx0b25EeW5hbWljRGlkQXBwbHlGcmFtZShsZWFzZUlkOiBzdHJpbmcpOiBFdmVudDxJVW5pdmVyc2VBZ2VudFNlc3Npb25WaWV3RnJhbWVFdmVudD4ge1xuXHRcdGxldCBlbWl0dGVyID0gdGhpcy5lbWl0dGVycy5nZXQobGVhc2VJZCk7XG5cdFx0aWYgKCFlbWl0dGVyKSB7XG5cdFx0XHRlbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVVuaXZlcnNlQWdlbnRTZXNzaW9uVmlld0ZyYW1lRXZlbnQ+KHtcblx0XHRcdFx0b25EaWRBZGRGaXJzdExpc3RlbmVyOiAoKSA9PiBxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5lbWl0TGVhc2UobGVhc2VJZCk7XG5cdFx0XHRcdFx0dGhpcy5saXN0ZW5pbmcuYWRkKGxlYXNlSWQpO1xuXHRcdFx0XHRcdHRoaXMuZGlkTGlzdGVuLmZpcmUobGVhc2VJZCk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5lbWl0dGVycy5zZXQobGVhc2VJZCwgZW1pdHRlcik7XG5cdFx0fVxuXHRcdHJldHVybiBlbWl0dGVyLmV2ZW50O1xuXHR9XG5cblx0YXN5bmMgYWNxdWlyZUxlYXNlKHNlc3Npb25JZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBsZWFzZUlkID0gYHJldmVhbDoke3Nlc3Npb25JZH06JHt0aGlzLmFjcXVpcmVkLmxlbmd0aCArIDF9YDtcblx0XHR0aGlzLmFjcXVpcmVkLnB1c2goeyBsZWFzZUlkLCBzZXNzaW9uSWQgfSk7XG5cdFx0cmV0dXJuIGxlYXNlSWQ7XG5cdH1cblx0YXN5bmMgd2hlbkVuZ2luZVNlc3Npb25SZWFkeShzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7IHJldHVybiBzZXNzaW9uSWQ7IH1cblx0YXN5bmMgcmVsZWFzZUxlYXNlKGxlYXNlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4geyB0aGlzLnJlbGVhc2VkLmFkZChsZWFzZUlkKTsgfVxuXHRhc3luYyBwb3N0KCk6IFByb21pc2U8bmV2ZXI+IHsgdGhyb3cgbmV3IEVycm9yKCdsZWFzZSByZWNvdmVyeSBtdXN0IG5vdCB3cml0ZScpOyB9XG5cdGFzeW5jIHJlcXVlc3RSZXN5bmMoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgYWNrbm93bGVkZ2UoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgcmVxdWVzdERldGFpbCgpIHsgcmV0dXJuIHsgb2s6IGZhbHNlIGFzIGNvbnN0LCByZWFzb246ICd1bmF2YWlsYWJsZScgYXMgY29uc3QgfTsgfVxuXG5cdGhhc1Nlc3Npb25MaXN0ZW5lcihzZXNzaW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmFjcXVpcmVkLnNvbWUobGVhc2UgPT4gbGVhc2Uuc2Vzc2lvbklkID09PSBzZXNzaW9uSWQgJiYgdGhpcy5saXN0ZW5pbmcuaGFzKGxlYXNlLmxlYXNlSWQpICYmICF0aGlzLnJlbGVhc2VkLmhhcyhsZWFzZS5sZWFzZUlkKSk7XG5cdH1cblxuXHRlbWl0U2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZywgdGV4dDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBsZWFzZSBvZiB0aGlzLmFjcXVpcmVkKSB7XG5cdFx0XHRpZiAobGVhc2Uuc2Vzc2lvbklkID09PSBzZXNzaW9uSWQpIHtcblx0XHRcdFx0dGhpcy5lbWl0TGVhc2UobGVhc2UubGVhc2VJZCwgdGV4dCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBlbWl0TGVhc2UobGVhc2VJZDogc3RyaW5nLCB0ZXh0Pzogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgbGVhc2UgPSB0aGlzLmFjcXVpcmVkLmZpbmQoY2FuZGlkYXRlID0+IGNhbmRpZGF0ZS5sZWFzZUlkID09PSBsZWFzZUlkKTtcblx0XHRpZiAoIWxlYXNlIHx8IHRoaXMucmVsZWFzZWQuaGFzKGxlYXNlSWQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHByb2plY3Rpb24gPSBzdHViVHVybnNUb1NuYXBzaG90KGxlYXNlLnNlc3Npb25JZCwgdGV4dCA9PT0gdW5kZWZpbmVkID8gW10gOiBbXG5cdFx0XHR7IGlkOiBgJHtsZWFzZS5zZXNzaW9uSWR9LWJvZHlgLCBraW5kOiAndXNlcicsIHRleHQgfSxcblx0XHRcdHsgaWQ6IGAke2xlYXNlLnNlc3Npb25JZH0tcGVybWlzc2lvbmAsIGtpbmQ6ICdjb25maXJtYXRpb24nLCB0ZXh0OiBgUGVybWlzc2lvbiBmb3IgJHtsZWFzZS5zZXNzaW9uSWR9YCwgc3RhdHVzOiAncGVuZGluZycgfSxcblx0XHRdKTtcblx0XHRjb25zdCB2ZXJzaW9uID0gKHRoaXMudmVyc2lvbnMuZ2V0KGxlYXNlSWQpID8/IDApICsgMTtcblx0XHR0aGlzLnZlcnNpb25zLnNldChsZWFzZUlkLCB2ZXJzaW9uKTtcblx0XHR0aGlzLmVtaXR0ZXJzLmdldChsZWFzZUlkKT8uZmlyZSh7XG5cdFx0XHRsZWFzZUlkLCBzZXNzaW9uSWQ6IGxlYXNlLnNlc3Npb25JZCwgYXBwbGllZDogeyBraW5kOiAnYmFzZWxpbmUnIH0sXG5cdFx0XHRmcmFtZToge1xuXHRcdFx0XHRmcmFtZTogeyBsZWFzZUlkOiBsZWFzZUlkIGFzIFZpZXdMZWFzZUlkLCBnZW5lcmF0aW9uOiAxLCBmcmFtZUlkOiB2ZXJzaW9uLCB2ZXJzaW9uLCBib2R5OiB7IGtpbmQ6ICdiYXNlbGluZScsIHNuYXBzaG90OiB7IC4uLnByb2plY3Rpb24uc25hcHNob3QsIHN5bmM6IHsga2luZDogJ2xpdmUnIH0gfSB9IH0sXG5cdFx0XHRcdGF0dHJpYnV0aW9uOiBbLi4ucHJvamVjdGlvbi5hdHRyaWJ1dGlvbl0ubWFwKChbaXRlbUlkLCBhdHRyaWJ1dGlvbl0pID0+ICh7IG9wOiAndXBzZXJ0QXR0cmlidXRpb24nLCBpdGVtSWQsIGF0dHJpYnV0aW9uIH0pKSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cbn1cblxuc3VpdGUoJ0NvbnZlcnNhdGlvbiBzZXNzaW9uIHdpbmRvdyByZXZlYWwgKyBsZWFmIFNlc3Npb25CYXIgKEMpJywgKCkgPT4ge1xuXG5cdGNvbnN0IFRFU1RfRURJVE9SX0lEID0gJ015RmlsZUVkaXRvckZvckNvbnZlcnNhdGlvblJldmVhbCc7XG5cdGNvbnN0IFRFU1RfRURJVE9SX0lOUFVUX0lEID0gJ3Rlc3RFZGl0b3JJbnB1dEZvckNvbnZlcnNhdGlvblJldmVhbCc7XG5cblx0aW5zdGFsbENvbnZlcnNhdGlvbkxlbnNSZXNpemVPYnNlcnZlckhhcm5lc3MoKTtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IHN0b3JlIGFzIHVua25vd24gYXMgRGlzcG9zYWJsZVN0b3JlO1xuXG5cdHRlYXJkb3duKGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IG1haW5XaW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IG1haW5XaW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHJlc29sdmUoKSkpKTtcblx0fSk7XG5cblx0c2V0dXAoZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgyMF8wMDApO1xuXHRcdHN0b3JlLmFkZChyZWdpc3RlclRlc3RFZGl0b3IoVEVTVF9FRElUT1JfSUQsIFtuZXcgU3luY0Rlc2NyaXB0b3IoVGVzdEZpbGVFZGl0b3JJbnB1dCksIG5ldyBTeW5jRGVzY3JpcHRvcihTaWRlQnlTaWRlRWRpdG9ySW5wdXQpXSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gbGF5b3V0UGFydHMocGFydHM6IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlRWRpdG9yUGFydHM+Pik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cy5jb252ZXJzYXRpb25QYXJ0cykge1xuXHRcdFx0cGFydC5sYXlvdXQoODAwLCA2MDAsIDAsIDApO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHRyYWNrRWRpdG9ycyhwYXJ0czogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVFZGl0b3JQYXJ0cz4+KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzLmNvbnZlcnNhdGlvblBhcnRzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBwYXJ0LmFjdGl2ZUdyb3VwLmVkaXRvcnMpIHtcblx0XHRcdFx0c3RvcmUuYWRkKGVkaXRvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gd2FpdEZvclBhbmUocGFydDogSUNvbnZlcnNhdGlvbkVkaXRvclBhcnQsIG9wZW5FcnJvcnM6IHVua25vd25bXSA9IFtdLCBwYXJ0cz86IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlRWRpdG9yUGFydHM+Pik6IFByb21pc2U8Q29udmVyc2F0aW9uRWRpdG9yUGFuZT4ge1xuXHRcdGF3YWl0IHBhcnQud2hlblJlYWR5O1xuXHRcdGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIDMwMDA7XG5cdFx0d2hpbGUgKERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuXHRcdFx0Y29uc3QgcGFuZSA9IHBhcnQuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGlmIChwYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSkge1xuXHRcdFx0XHRpZiAocGFydHMpIHtcblx0XHRcdFx0XHR0cmFja0VkaXRvcnMocGFydHMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBwYW5lO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0fVxuXHRcdGNvbnN0IGRldGFpbCA9IG9wZW5FcnJvcnMubWFwKGVycm9yID0+IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA/PyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSkuam9pbignXFxuJyk7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDb252ZXJzYXRpb25FZGl0b3JQYW5lIG5vdCByZWFkeSBmb3IgJHtwYXJ0LnNlc3Npb25LZXl9OyBnb3QgJHtwYXJ0LmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvclBhbmU/LmdldElkKCl9JHtkZXRhaWwgPyBgXFxuJHtkZXRhaWx9YCA6ICcnfWApO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFydEZvcihwYXJ0czogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVFZGl0b3JQYXJ0cz4+LCBzZXNzaW9uS2V5OiBzdHJpbmcpOiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCB7XG5cdFx0Y29uc3QgcGFydCA9IHBhcnRzLmNvbnZlcnNhdGlvblBhcnRzLmZpbmQoY2FuZGlkYXRlID0+IGNhbmRpZGF0ZS5zZXNzaW9uS2V5ID09PSBzZXNzaW9uS2V5KTtcblx0XHRhc3NlcnQub2socGFydCwgYG1pc3NpbmcgcGFydCAke3Nlc3Npb25LZXl9YCk7XG5cdFx0cmV0dXJuIHBhcnQ7XG5cdH1cblxuXHRmdW5jdGlvbiB2aXNpYmxlTGVhZktleXMod2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIFsuLi53aW5kb3dTZXJ2aWNlLmdldFZpc2libGVTZXNzaW9uS2V5cygpXTtcblx0fVxuXG5cdGZ1bmN0aW9uIGhpZGVCdXR0b24od2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UsIHNlc3Npb25LZXk6IHN0cmluZyk6IEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCB7XG5cdFx0cmV0dXJuIHdpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHNlc3Npb25LZXkpPy5zZXNzaW9uQmFyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tc2Vzc2lvbi1sZWFmLWhpZGUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb206IEVycm9yLCBydW46ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gQSBsb25lIGAuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpYCBzdGlsbCBsZWFrcyB3aGVuIHRoZSBoYW5kbGVyIHdhcm4tdGhlbi1yZXRocm93cy5cblx0XHRjb25zdCB1bmV4cGVjdGVkV2FybnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IHVuaGFuZGxlZFJlamVjdGlvbnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IG9uVW5oYW5kbGVkUmVqZWN0aW9uID0gKHJlYXNvbjogdW5rbm93bikgPT4gdW5oYW5kbGVkUmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7XG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWRSZWplY3Rpb24pO1xuXHRcdGNvbnN0IG9yaWdpbmFsRXJyb3JIYW5kbGVyID0gZXJyb3JIYW5kbGVyLmdldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKTtcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKGVycm9yID0+IHtcblx0XHRcdHVuZXhwZWN0ZWRXYXJucy5wdXNoKGVycm9yKTtcblx0XHRcdGlmICh1bmV4cGVjdGVkV2FybnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBydW4oKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgdW5oYW5kbGVkUmVqZWN0aW9ucywgdW5leHBlY3RlZFdhcm5zIH0sIHtcblx0XHRcdFx0dW5oYW5kbGVkUmVqZWN0aW9uczogW10sXG5cdFx0XHRcdHVuZXhwZWN0ZWRXYXJuczogW3BhaW50Qm9vbSwgcGFpbnRCb29tXSxcblx0XHRcdH0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKG9yaWdpbmFsRXJyb3JIYW5kbGVyKTtcblx0XHRcdHByb2Nlc3Mub2ZmKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZFJlamVjdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlTGlnaHR3ZWlnaHRXaW5kb3dIYXJuZXNzKG9wdGlvbnM/OiB7IGRlbGF5U2xvdHM/OiBib29sZWFuIH0pIHtcblx0XHRjb25zdCByb3N0ZXJTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBRdWlldFJvc3RlclNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgZ3JpZEhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGdyaWRIb3N0KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBncmlkSG9zdC5yZW1vdmUoKSB9KTtcblxuXHRcdGNvbnN0IG9uRGlkQ3JlYXRlU2xvdHMgPSBuZXcgRW1pdHRlcjxJQ29udmVyc2F0aW9uUGFydFdpbmRvd1Nsb3RzPigpO1xuXHRcdHN0b3JlLmFkZChvbkRpZENyZWF0ZVNsb3RzKTtcblxuXHRcdGxldCB0aHJvd09uQ3JlYXRlID0gZmFsc2U7XG5cdFx0bGV0IHJlamVjdFdoZW5SZWFkeSA9IGZhbHNlO1xuXHRcdGNvbnN0IGNvbnZlcnNhdGlvblBhcnRzOiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydFtdID0gW107XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IHtcblx0XHRcdGNyZWF0ZUNvbnZlcnNhdGlvbkVkaXRvclBhcnQ6IChfcGFyZW50OiB1bmtub3duLCBzZXNzaW9uS2V5OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0aWYgKHRocm93T25DcmVhdGUpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3JldmVhbCBib29tJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGV0IHdoZW5SZWFkeTogUHJvbWlzZTx2b2lkPiA9IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0XHRpZiAocmVqZWN0V2hlblJlYWR5KSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVqZWN0ZWQgPSBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ3doZW5SZWFkeSBib29tJykpO1xuXHRcdFx0XHRcdC8vIEtlZXAgdGhlIHJlamVjdGlvbiBvYnNlcnZlZC4gQXdhaXRlcnMgc3RpbGwgcmVqZWN0LlxuXHRcdFx0XHRcdHZvaWQgcmVqZWN0ZWQuY2F0Y2goKCkgPT4geyB9KTtcblx0XHRcdFx0XHR3aGVuUmVhZHkgPSByZWplY3RlZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBwYXJ0ID0geyBzZXNzaW9uS2V5LCB3aGVuUmVhZHksIGFjdGl2ZUdyb3VwOiB7IGZvY3VzOiAoKSA9PiB7IH0sIGFjdGl2ZUVkaXRvclBhbmU6IHsgZ2V0SWQ6ICgpID0+IENvbnZlcnNhdGlvbkVkaXRvclBhbmVJZCB9IH0gfSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25FZGl0b3JQYXJ0O1xuXHRcdFx0XHRjb252ZXJzYXRpb25QYXJ0cy5wdXNoKHBhcnQpO1xuXHRcdFx0XHRyZXR1cm4gcGFydDtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlQ29udmVyc2F0aW9uRWRpdG9yUGFydDogKHNlc3Npb25LZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IGNvbnZlcnNhdGlvblBhcnRzLmZpbmRJbmRleChwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vzc2lvbktleSk7XG5cdFx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0Y29udmVyc2F0aW9uUGFydHMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNldEZvY3VzZWRDb252ZXJzYXRpb25MZWFmOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRGb2N1c2VkQ29udmVyc2F0aW9uTGVhZjogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IGNvbnZlcnNhdGlvblBhcnRzKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udmVyc2F0aW9uUGFydHM7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yR3JvdXBzU2VydmljZTtcblxuXHRcdGxldCBvbk5vdGlmeUVycm9yOiAoKG1lc3NhZ2U6IHN0cmluZyB8IEVycm9yKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzZXNzaW9uV2luZG93U2VydmljZSA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UoXG5cdFx0XHR7XG5cdFx0XHRcdG9uRGlkQ3JlYXRlU2xvdHM6IG9uRGlkQ3JlYXRlU2xvdHMuZXZlbnQsXG5cdFx0XHRcdG9uRGlkRm9jdXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGdldFNsb3RzOiAoKSA9PiBvcHRpb25zPy5kZWxheVNsb3RzXG5cdFx0XHRcdFx0PyB1bmRlZmluZWRcblx0XHRcdFx0XHQ6IHsgc2Vzc2lvbkJhcjogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksIHNlc3Npb25XaW5kb3dHcmlkOiBncmlkSG9zdCwgZWRpdG9yUGFydEhvc3Q6IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHRzZXRGb2N1c2VkTGVhZkNvbnRhaW5lcjogKCkgPT4geyB9LFxuXHRcdFx0XHRmb2N1czogKCkgPT4geyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25QYXJ0U2VydmljZSxcblx0XHRcdGVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0XHRyb3N0ZXJTZXJ2aWNlLFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKCksXG5cdFx0XHR7XG5cdFx0XHRcdGVycm9yOiAobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IpID0+IHtcblx0XHRcdFx0XHRvbk5vdGlmeUVycm9yPy4obWVzc2FnZSk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdCkpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlc3Npb25XaW5kb3dTZXJ2aWNlLFxuXHRcdFx0cm9zdGVyU2VydmljZSxcblx0XHRcdGNvbnZlcnNhdGlvblBhcnRzLFxuXHRcdFx0c2V0VGhyb3dPbkNyZWF0ZSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdFx0XHR0aHJvd09uQ3JlYXRlID0gdmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0c2V0UmVqZWN0V2hlblJlYWR5KHZhbHVlOiBib29sZWFuKSB7XG5cdFx0XHRcdHJlamVjdFdoZW5SZWFkeSA9IHZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHNldE5vdGlmeUVycm9yKGhhbmRsZXI6IChtZXNzYWdlOiBzdHJpbmcgfCBFcnJvcikgPT4gdm9pZCkge1xuXHRcdFx0XHRvbk5vdGlmeUVycm9yID0gaGFuZGxlcjtcblx0XHRcdH0sXG5cdFx0XHRhdHRhY2hTbG90cygpIHtcblx0XHRcdFx0b25EaWRDcmVhdGVTbG90cy5maXJlKHtcblx0XHRcdFx0XHRzZXNzaW9uQmFyOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcblx0XHRcdFx0XHRzZXNzaW9uV2luZG93R3JpZDogZ3JpZEhvc3QsXG5cdFx0XHRcdFx0ZWRpdG9yUGFydEhvc3Q6IHVuZGVmaW5lZCxcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBjb2xsZWN0TGVhZkNvbnZlcnNhdGlvbkxlbnNlcyhwYXJ0OiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCk6IFByb21pc2U8Q29udmVyc2F0aW9uTGVuc1tdPiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXHRcdGNvbnN0IGxlbnNlczogQ29udmVyc2F0aW9uTGVuc1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZ3JvdXAuZWRpdG9ycykge1xuXHRcdFx0YXdhaXQgZ3JvdXAub3BlbkVkaXRvcihlZGl0b3IpO1xuXHRcdFx0Y29uc3QgcGFuZSA9IGdyb3VwLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRhc3NlcnQub2socGFuZSBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkVkaXRvclBhbmUsIGBtaXNzaW5nIENvbnZlcnNhdGlvbkVkaXRvclBhbmUgZm9yICR7ZWRpdG9yLnJlc291cmNlfWApO1xuXHRcdFx0Y29uc3QgbGVucyA9IHBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucztcblx0XHRcdGFzc2VydC5vayhsZW5zLCBgZWFjaCBjb252ZXJzYXRpb24gdGFiIG11c3QgZXhwb3NlIGEgQ29udmVyc2F0aW9uTGVucyAoJHtlZGl0b3IucmVzb3VyY2V9KWApO1xuXHRcdFx0bGVuc2VzLnB1c2gobGVucyk7XG5cdFx0fVxuXHRcdHJldHVybiBsZW5zZXM7XG5cdH1cblxuXHRmdW5jdGlvbiBjb3VudExlYWZDaHJvbWUod2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnQ6IENvbnZlcnNhdGlvblBhcnQpOiB7IGJhcnM6IG51bWJlcjsgbmF2czogbnVtYmVyOyBwYXJ0U2xvdEJhcnM6IG51bWJlciB9IHtcblx0XHRsZXQgYmFycyA9IDA7XG5cdFx0bGV0IG5hdnMgPSAwO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIHdpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVNlc3Npb25LZXlzKCkpIHtcblx0XHRcdGNvbnN0IGxlYWYgPSB3aW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhrZXkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGxlYWYpO1xuXHRcdFx0YmFycyArPSBsZWFmLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1iYXInKS5sZW5ndGg7XG5cdFx0XHRuYXZzICs9IGxlYWYuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24td2luZG93LW5hdicpLmxlbmd0aDtcblx0XHR9XG5cdFx0Y29uc3QgcGFydFNsb3RCYXJzID0gY29udmVyc2F0aW9uUGFydC5nZXRTbG90cygpPy5zZXNzaW9uQmFyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLWJhcicpLmxlbmd0aCA/PyAwO1xuXHRcdHJldHVybiB7IGJhcnMsIG5hdnMsIHBhcnRTbG90QmFycyB9O1xuXHR9XG5cblx0ZnVuY3Rpb24gc3R1YkxlbnNSdW50aW1lU2VydmljZXMoaW5zdGFudGlhdGlvblNlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlPik6IHZvaWQge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblRpbWVsaW5lUmV2ZWFsU2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0cmVnaXN0ZXJMZW5zOiAoKSA9PiAoeyBkaXNwb3NlOiAoKSA9PiB7IH0gfSksXG5cdFx0XHRyZXZlYWxJdGVtOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRBY2Nlc3NpYmxlVHVybkNvbnRlbnQ6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdGZvY3VzQWNjZXNzaWJsZVR1cm46ICgpID0+IHsgfSxcblx0XHRcdHNjcm9sbFRvRmlyc3RQZW5kaW5nQ29uZmlybWF0aW9uOiAoKSA9PiB7IH0sXG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uUmV2aWV3TmF2U2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRnZXRSZXZpZXdOYXZGb3JTZXNzaW9uOiAoKSA9PiBbXSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFeHBsb3JlclNlcnZpY2UsIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdHNlbGVjdDogYXN5bmMgKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXQgcmVwb3NpdG9yaWVzKCkgeyByZXR1cm4gW107IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMDsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2UpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gY3JlYXRlUmV2ZWFsSGFybmVzcygpIHtcblx0XHRyZXR1cm4gY3JlYXRlUmV2ZWFsSGFybmVzc1dpdGhSb3N0ZXIoc3RvcmUuYWRkKG5ldyBRdWlldFJvc3RlclNlcnZpY2UoKSksIGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1YigpKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVJldmVhbEhhcm5lc3NXaXRoUm9zdGVyPFIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZT4ocm9zdGVyU2VydmljZTogUiwgY29ubmVjdGlvbjogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uLCBlbmdpbmUgPSBmYWxzZSkge1xuXHRcdGNvbnN0IG9wZW5FcnJvcnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2Uoe1xuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2U6ICgpID0+IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2Uoe1xuXHRcdFx0XHR3b3JrYmVuY2g6IHsgZWRpdG9yOiB7IGVuYWJsZVByZXZpZXc6IGZhbHNlIH0gfSxcblx0XHRcdFx0W1VBX0NMSUVOVF9DSEFUX0lOUFVUX0FVVE9fRk9DVVNdOiBmYWxzZSxcblx0XHRcdH0pLFxuXHRcdH0sIHN0b3JlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMb2dTZXJ2aWNlLCB7XG5cdFx0XHRlcnJvcjogKGVycm9yOiB1bmtub3duKSA9PiB7IG9wZW5FcnJvcnMucHVzaChlcnJvcik7IH0sXG5cdFx0XHR3YXJuOiAoKSA9PiB7IH0sXG5cdFx0XHRpbmZvOiAoKSA9PiB7IH0sXG5cdFx0XHR0cmFjZTogKCkgPT4geyB9LFxuXHRcdFx0ZGVidWc6ICgpID0+IHsgfSxcblx0XHRcdGZsdXNoOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRMZXZlbDogKCkgPT4gMCxcblx0XHRcdHNldExldmVsOiAoKSA9PiB7IH0sXG5cdFx0XHRvbkRpZENoYW5nZUxvZ0xldmVsOiBFdmVudC5Ob25lLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJTG9nU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZSwgcm9zdGVyU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb24sIGNvbm5lY3Rpb24pO1xuXHRcdHN0dWJMZW5zUnVudGltZVNlcnZpY2VzKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRzdHViQ29udmVyc2F0aW9uVGltZWxpbmVMaW5rU2VydmljZXMoaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkuc3RhcnQoYWNjZXNzb3IpKTtcblxuXHRcdGNvbnN0IHBhcnRzID0gYXdhaXQgY3JlYXRlRWRpdG9yUGFydHMoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRzdG9yZS5hZGQocGFydHMpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIHBhcnRzKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvclNlcnZpY2UsIHVuZGVmaW5lZCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclNlcnZpY2UsIGVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29udmVyc2F0aW9uUGFydCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25QYXJ0KSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRjb252ZXJzYXRpb25QYXJ0LmNyZWF0ZShwYXJlbnQpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblBhcnRTZXJ2aWNlLCBjb252ZXJzYXRpb25QYXJ0KTtcblxuXHRcdGNvbnN0IHNlc3Npb25DaGF0U2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25TZXNzaW9uQ2hhdFNlcnZpY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25TZXNzaW9uQ2hhdFNlcnZpY2UsIHNlc3Npb25DaGF0U2VydmljZSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbldpbmRvd1NlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25TZXNzaW9uV2luZG93U2VydmljZSwgc2Vzc2lvbldpbmRvd1NlcnZpY2UpO1xuXHRcdGNvbnN0IG5hdmlnYXRpb25TZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbk5hdmlnYXRpb25TZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uTmF2aWdhdGlvblNlcnZpY2UsIG5hdmlnYXRpb25TZXJ2aWNlKTtcblxuXHRcdHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25TZXNzaW9uQ2hhdENvbnRyaWJ1dGlvbikpO1xuXHRcdHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25OYXZpZ2F0aW9uQ29udHJpYnV0aW9uKSk7XG5cblx0XHRjb25zdCBwcmltYXJ5SWQgPSByb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmVuc3VyZVByaW1hcnlXaW5kb3cocHJpbWFyeUlkKTtcblx0XHRjb25zdCBwcmltYXJ5UGFydCA9IHBhcnRGb3IocGFydHMsIHByaW1hcnlJZCk7XG5cdFx0aWYgKGVuZ2luZSkge1xuXHRcdFx0YXdhaXQgd2FpdEZvckVuZ2luZVBhbmUocHJpbWFyeVBhcnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB3YWl0Rm9yUGFuZShwcmltYXJ5UGFydCwgb3BlbkVycm9ycywgcGFydHMpO1xuXHRcdH1cblx0XHRsYXlvdXRQYXJ0cyhwYXJ0cyk7XG5cdFx0dHJhY2tFZGl0b3JzKHBhcnRzKTtcblxuXHRcdHJldHVybiB7IGluc3RhbnRpYXRpb25TZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlLCBwYXJ0cywgY29udmVyc2F0aW9uUGFydCwgcm9zdGVyU2VydmljZSwgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHNlc3Npb25DaGF0U2VydmljZSwgcHJpbWFyeUlkLCBvcGVuRXJyb3JzIH07XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBib3VuZGVkPFQ+KHByb21pc2U6IFByb21pc2U8VD4sIG1lc3NhZ2U6IHN0cmluZyk6IFByb21pc2U8VD4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHJhY2VUaW1lb3V0KHByb21pc2UudGhlbih2YWx1ZSA9PiAoeyB2YWx1ZSB9KSksIDMwMDApO1xuXHRcdGFzc2VydC5vayhyZXN1bHQsIG1lc3NhZ2UpO1xuXHRcdHJldHVybiByZXN1bHQudmFsdWU7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiB3YWl0Rm9yRW5naW5lUGFuZShwYXJ0OiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCk6IFByb21pc2U8Q29udmVyc2F0aW9uRWRpdG9yUGFuZT4ge1xuXHRcdGF3YWl0IGJvdW5kZWQocGFydC53aGVuUmVhZHksICdlbmdpbmUgbGVhZiBwYXJ0IG11c3QgYmVjb21lIHJlYWR5Jyk7XG5cdFx0aWYgKCEocGFydC5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3JQYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSkpIHtcblx0XHRcdGNvbnN0IHJlYWR5ID0gRXZlbnQudG9Qcm9taXNlKEV2ZW50LmZpbHRlcihwYXJ0LmFjdGl2ZUdyb3VwLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlLFxuXHRcdFx0XHQoKSA9PiBwYXJ0LmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25FZGl0b3JQYW5lKSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBib3VuZGVkKHJlYWR5LCAncmVhbCBlbmdpbmUgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSBtdXN0IG9wZW4nKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHJlYWR5LmNhbmNlbCgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBwYW5lID0gcGFydC5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGFzc2VydC5vayhwYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSk7XG5cdFx0cmV0dXJuIHBhbmU7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBjcmVhdGVFbmdpbmVSZXZlYWxIYXJuZXNzKGJlZm9yZVBhbmU/OiAocm9zdGVyOiBDb252ZXJzYXRpb25FbmdpbmVSb3N0ZXJTZXJ2aWNlKSA9PiB2b2lkKSB7XG5cdFx0dHlwZSBDYXRhbG9nID0gQXdhaXRlZDxSZXR1cm5UeXBlPElVbml2ZXJzZUFnZW50Q29ubmVjdGlvblsnbGlzdFNlc3Npb25zJ10+Pjtcblx0XHRjb25zdCByZXF1ZXN0czogeyBzdGFydGVkOiBEZWZlcnJlZFByb21pc2U8dm9pZD47IHJlc3VsdDogRGVmZXJyZWRQcm9taXNlPENhdGFsb2c+IH1bXSA9IFtdO1xuXHRcdGNvbnN0IGFsbFJlcXVlc3RzOiB0eXBlb2YgcmVxdWVzdHMgPSBbXTtcblx0XHRsZXQgcGhhc2U6IENvbm5lY3Rpb25QaGFzZSA9IHsga2luZDogJ2Rpc2Nvbm5lY3RlZCcgfTtcblx0XHRsZXQgcGFpcmluZ1BlbmRpbmcgPSBmYWxzZTtcblx0XHRjb25zdCBjb25uZWN0aW9uRW1pdHRlciA9IHN0b3JlLmFkZChuZXcgRW1pdHRlcjxSZXR1cm5UeXBlPElVbml2ZXJzZUFnZW50Q29ubmVjdGlvblsnZ2V0Q29ubmVjdGlvblNuYXBzaG90J10+PigpKTtcblx0XHRjb25zdCBiYXNlID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKCk7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yih7XG5cdFx0XHRpc0VuZ2luZUNvbm5lY3RlZDogKCkgPT4gaXNDb252ZXJzYXRpb25FbmdpbmVMaXZlKHBoYXNlLCBwYWlyaW5nUGVuZGluZyksXG5cdFx0XHRnZXRDb25uZWN0aW9uUGhhc2U6ICgpID0+IHBoYXNlLFxuXHRcdFx0Z2V0VHJhbnNwb3J0U3RhdGU6ICgpID0+ICdvaycsXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7IC4uLmJhc2UuZ2V0Q29ubmVjdGlvblNuYXBzaG90KCksIHRyYW5zcG9ydDogJ29rJywgY2hhbm5lbEFsaXZlOiBwaGFzZS5raW5kICE9PSAnZGlzY29ubmVjdGVkJywgcGFpcmluZ1BlbmRpbmcsIGVuZ2luZUlkZW50aXR5SWQ6ICdyZXZlYWwtZW5naW5lJywgbGlua0lkOiAxIH0pLFxuXHRcdFx0b25EaWRDaGFuZ2VDb25uZWN0aW9uOiBjb25uZWN0aW9uRW1pdHRlci5ldmVudCxcblx0XHRcdGxpc3RTZXNzaW9uczogKCkgPT4ge1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0ID0gcmVxdWVzdHMuc2hpZnQoKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHJlcXVlc3QsICdldmVyeSByZWFsIGNhdGFsb2cgcmVxdWVzdCBtdXN0IGhhdmUgYW4gZXhwbGljaXQgRGVmZXJyZWQnKTtcblx0XHRcdFx0dm9pZCByZXF1ZXN0LnN0YXJ0ZWQuY29tcGxldGUoKTtcblx0XHRcdFx0cmV0dXJuIHJlcXVlc3QucmVzdWx0LnA7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGNvbnN0IHNlc3Npb25WaWV3ID0gc3RvcmUuYWRkKG5ldyBSZXZlYWxFbmdpbmVTZXNzaW9uVmlldygpKTtcblx0XHRjb25zdCByb3N0ZXJTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25FbmdpbmVSb3N0ZXJTZXJ2aWNlKGNvbm5lY3Rpb24sIHNlc3Npb25WaWV3LCB7IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCwgc2hvdWxkQWR2ZXJ0aXNlOiAoKSA9PiB0cnVlIH0pKTtcblx0XHQvLyBFdmVyeSBwZW5kaW5nIGxpc3Qgc2V0dGxlcyBiZWZvcmUgc2VydmljZSB0ZWFyZG93biwgaW5jbHVkaW5nIGZhaWxlZCBzZXR1cCBwYXRocy5cblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiBhbGxSZXF1ZXN0cykge1xuXHRcdFx0XHRpZiAoIXJlcXVlc3QucmVzdWx0LmlzU2V0dGxlZCkge1xuXHRcdFx0XHRcdHZvaWQgcmVxdWVzdC5yZXN1bHQuY29tcGxldGUoeyBzZXNzaW9uczogW10gfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0Y29uc3QgZGVmZXJDYXRhbG9nID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVxdWVzdCA9IHsgc3RhcnRlZDogbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpLCByZXN1bHQ6IG5ldyBEZWZlcnJlZFByb21pc2U8Q2F0YWxvZz4oKSB9O1xuXHRcdFx0cmVxdWVzdHMucHVzaChyZXF1ZXN0KTtcblx0XHRcdGFsbFJlcXVlc3RzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRyZXR1cm4gcmVxdWVzdDtcblx0XHR9O1xuXHRcdGNvbnN0IG5vdGlmeSA9IChraW5kOiAnbGl2ZScgfCAnZGlzY29ubmVjdGVkJyB8ICdjb25uZWN0ZWQgcGFpcmluZycgfCAnY29ubmVjdGluZyBwYWlyaW5nJykgPT4ge1xuXHRcdFx0cGFpcmluZ1BlbmRpbmcgPSBraW5kID09PSAnY29ubmVjdGVkIHBhaXJpbmcnIHx8IGtpbmQgPT09ICdjb25uZWN0aW5nIHBhaXJpbmcnO1xuXHRcdFx0cGhhc2UgPSBraW5kID09PSAnZGlzY29ubmVjdGVkJyA/IHsga2luZDogJ2Rpc2Nvbm5lY3RlZCcgfVxuXHRcdFx0XHQ6IGtpbmQgPT09ICdjb25uZWN0aW5nIHBhaXJpbmcnID8geyBraW5kOiAnY29ubmVjdGluZycsIHJlYXNvbjogJ2luaXRpYWwnIH1cblx0XHRcdFx0XHQ6IHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfTtcblx0XHRcdGNvbm5lY3Rpb25FbWl0dGVyLmZpcmUoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKSk7XG5cdFx0fTtcblx0XHRjb25zdCBjYXRhbG9nOiBDYXRhbG9nID0geyBzZXNzaW9uczogW3sgc2Vzc2lvbklkOiAnbGVhc2UtczEnLCB0aXRsZTogJ0xlYXNlIHMxJyB9LCB7IHNlc3Npb25JZDogJ2xlYXNlLXMyJywgdGl0bGU6ICdMZWFzZSBzMicgfV0gfTtcblx0XHRjb25zdCBpbml0aWFsID0gZGVmZXJDYXRhbG9nKCk7XG5cdFx0bm90aWZ5KCdsaXZlJyk7XG5cdFx0YXdhaXQgYm91bmRlZChpbml0aWFsLnN0YXJ0ZWQucCwgJ2luaXRpYWwgcmVhbCBjYXRhbG9nIG11c3Qgc3RhcnQnKTtcblx0XHRhd2FpdCBpbml0aWFsLnJlc3VsdC5jb21wbGV0ZShjYXRhbG9nKTtcblx0XHRhd2FpdCBib3VuZGVkKHJvc3RlclNlcnZpY2Uud2hlbkVuZ2luZUNhdGFsb2dSZWZyZXNoQ29tcGxldGUoKSwgJ2luaXRpYWwgcmVhbCBjYXRhbG9nIG11c3QgZmluaXNoJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3Mocm9zdGVyU2VydmljZSksICdyZWFkeScpO1xuXHRcdGJlZm9yZVBhbmU/Lihyb3N0ZXJTZXJ2aWNlKTtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzc1dpdGhSb3N0ZXIocm9zdGVyU2VydmljZSwgY29ubmVjdGlvbiwgdHJ1ZSk7XG5cdFx0Y29uc3QgcGFuZSA9IGF3YWl0IHdhaXRGb3JFbmdpbmVQYW5lKHBhcnRGb3IoaGFybmVzcy5wYXJ0cywgaGFybmVzcy5wcmltYXJ5SWQpKTtcblx0XHRjb25zdCBsZW5zID0gcGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zO1xuXHRcdGFzc2VydC5vayhsZW5zKTtcblx0XHRhc3NlcnQub2sobGVucy5zZXNzaW9uVmlld0xlYXNlLCAnaW5pdGlhbCByZWFsIHZpc2libGUgb3duZXIgbXVzdCBoYXZlIGEgbGVhc2UnKTtcblx0XHRpZiAobGVucy5zZXNzaW9uVmlld0xlYXNlLnNuYXBzaG90LnNlc3Npb25JZCAhPT0gaGFybmVzcy5wcmltYXJ5SWQpIHtcblx0XHRcdGNvbnN0IGJhc2VsaW5lID0gRXZlbnQudG9Qcm9taXNlKGxlbnMuc2Vzc2lvblZpZXdMZWFzZS5vbkRpZEFwcGx5RnJhbWUpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgYm91bmRlZChiYXNlbGluZSwgJ2luaXRpYWwgaG9zdCBiYXNlbGluZSBtdXN0IHJlYWNoIHRoZSBQYW5lIGxlYXNlJyk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRiYXNlbGluZS5jYW5jZWwoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZS5zbmFwc2hvdC5zZXNzaW9uSWQsIGhhcm5lc3MucHJpbWFyeUlkKTtcblx0XHRyZXR1cm4geyAuLi5oYXJuZXNzLCBwYW5lLCBsZW5zLCBjb25uZWN0aW9uLCBzZXNzaW9uVmlldywgZGVmZXJDYXRhbG9nLCBub3RpZnksIGNhdGFsb2cgfTtcblx0fVxuXG5cdHR5cGUgRW5naW5lUmV2ZWFsSGFybmVzcyA9IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlRW5naW5lUmV2ZWFsSGFybmVzcz4+O1xuXG5cdGZ1bmN0aW9uIGFzc2VydFZpc2libGVNaXNzaW5nKGhhcm5lc3M6IEVuZ2luZVJldmVhbEhhcm5lc3MsIHBhbmUgPSBoYXJuZXNzLnBhbmUsIGtleSA9IGhhcm5lc3MucHJpbWFyeUlkKTogQ29udmVyc2F0aW9uTGVucyB7XG5cdFx0Y29uc3QgbGVucyA9IHBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucztcblx0XHRhc3NlcnQub2sobGVucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuYm91bmRTZXNzaW9uSWQsIGtleSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuaXNEaXNwb3NlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoa2V5KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdCaW5kaW5nU3VzcGVuZGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkLCAncmVhbCBjb25uZWN0aW9uL0JpbmRpbmcgbXVzdCBuYXR1cmFsbHkgcmVtb3ZlIHRoZSBlbXB0eSBvd25lciBsZWFzZScpO1xuXHRcdHJldHVybiBsZW5zO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gc3RhcnRFbXB0eUNhdGFsb2dSZWZyZXNoKGhhcm5lc3M6IEVuZ2luZVJldmVhbEhhcm5lc3MsIHJlY29ubmVjdCA9IGZhbHNlKSB7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IGhhcm5lc3MuZGVmZXJDYXRhbG9nKCk7XG5cdFx0aWYgKHJlY29ubmVjdCkge1xuXHRcdFx0aGFybmVzcy5ub3RpZnkoJ2Rpc2Nvbm5lY3RlZCcpO1xuXHRcdH1cblx0XHRoYXJuZXNzLm5vdGlmeSgnbGl2ZScpO1xuXHRcdGF3YWl0IGJvdW5kZWQocmVxdWVzdC5zdGFydGVkLnAsICdyZWFsIHJlcGxhY2VtZW50IGxpc3RTZXNzaW9ucyBtdXN0IHN0YXJ0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlKSwgJ2xvYWRpbmcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5wYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnMsIGhhcm5lc3MubGVucyk7XG5cdFx0YXNzZXJ0VmlzaWJsZU1pc3NpbmcoaGFybmVzcyk7XG5cdFx0cmV0dXJuIHJlcXVlc3Q7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBjb21wbGV0ZUNhdGFsb2coaGFybmVzczogRW5naW5lUmV2ZWFsSGFybmVzcywgcmVxdWVzdDogUmV0dXJuVHlwZTxFbmdpbmVSZXZlYWxIYXJuZXNzWydkZWZlckNhdGFsb2cnXT4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCByZXF1ZXN0LnJlc3VsdC5jb21wbGV0ZShoYXJuZXNzLmNhdGFsb2cpO1xuXHRcdGF3YWl0IGJvdW5kZWQoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLndoZW5FbmdpbmVDYXRhbG9nUmVmcmVzaENvbXBsZXRlKCksICdyZWFsIGNhdGFsb2cgbXVzdCBzZXR0bGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0Q29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzcyhoYXJuZXNzLnJvc3RlclNlcnZpY2UpLCAncmVhZHknKTtcblx0fVxuXG5cdGZ1bmN0aW9uIG9ic2VydmVQYW5lQmluZHMobGVuczogQ29udmVyc2F0aW9uTGVucyk6ICgpID0+IG51bWJlciB7XG5cdFx0bGV0IGNhbGxzID0gMDtcblx0XHRjb25zdCBvcmlnaW5hbCA9IGxlbnMuYmluZFNlc3Npb25WaWV3O1xuXHRcdGxlbnMuYmluZFNlc3Npb25WaWV3ID0gc2Vzc2lvbklkID0+IHtcblx0XHRcdGNhbGxzKys7XG5cdFx0XHRvcmlnaW5hbC5jYWxsKGxlbnMsIHNlc3Npb25JZCk7XG5cdFx0fTtcblx0XHRzdG9yZS5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHsgbGVucy5iaW5kU2Vzc2lvblZpZXcgPSBvcmlnaW5hbDsgfSkpO1xuXHRcdHJldHVybiAoKSA9PiBjYWxscztcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGFzc2VydEVuZ2luZUZyYW1lUGFpbnRzKGhhcm5lc3M6IEVuZ2luZVJldmVhbEhhcm5lc3MsIHBhbmU6IENvbnZlcnNhdGlvbkVkaXRvclBhbmUsIHNlc3Npb25JZDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBsZW5zID0gcGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zO1xuXHRcdGFzc2VydC5vayhsZW5zKTtcblx0XHRjb25zdCBsZWFzZSA9IGxlbnMuc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRhc3NlcnQub2sobGVhc2UsICd0aGlzIGFjdHVhbCBQYW5lIG11c3Qgb3duIHRoZSByZWNvdmVyZWQgbGVhc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVhc2Uuc2Vzc2lvbklkLCBzZXNzaW9uSWQpO1xuXHRcdGlmICghaGFybmVzcy5zZXNzaW9uVmlldy5oYXNTZXNzaW9uTGlzdGVuZXIoc2Vzc2lvbklkKSkge1xuXHRcdFx0Y29uc3QgbGlzdGVuaW5nID0gRXZlbnQudG9Qcm9taXNlKEV2ZW50LmZpbHRlcihoYXJuZXNzLnNlc3Npb25WaWV3Lm9uRGlkTGlzdGVuLCAoKSA9PiBoYXJuZXNzLnNlc3Npb25WaWV3Lmhhc1Nlc3Npb25MaXN0ZW5lcihzZXNzaW9uSWQpKSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBib3VuZGVkKGxpc3RlbmluZywgJ2FjdHVhbCBob3N0IGxlYXNlIGFjcXVpcmUgYW5kIGZyYW1lIGxpc3RlbmVyIG11c3QgY29tcGxldGUnKTtcblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdGxpc3RlbmluZy5jYW5jZWwoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgY29sdW1uID0gcGFuZS5nZXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXNzZXJ0Lm9rKGNvbHVtbik7XG5cdFx0Y29uc3QgcGFpbnRlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRjb25zdCBjaGVjayA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGJvZHkgPSBjb2x1bW4ucXVlcnlTZWxlY3RvcihgLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm5bZGF0YS10dXJuLWlkPVwiJHtzZXNzaW9uSWR9LWJvZHlcIl0gLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYm9keWApO1xuXHRcdFx0Y29uc3QgcGVuZGluZyA9IGNvbHVtbi5xdWVyeVNlbGVjdG9yKGAuY29udmVyc2F0aW9uLWxlbnMtY29uZmlybWF0aW9uLXNlYXRbZGF0YS10dXJuLWlkPVwiJHtzZXNzaW9uSWR9LXBlcm1pc3Npb25cIl1gKTtcblx0XHRcdGlmIChib2R5Py50ZXh0Q29udGVudCA9PT0gdGV4dCAmJiBwZW5kaW5nPy50ZXh0Q29udGVudD8uaW5jbHVkZXMoYFBlcm1pc3Npb24gZm9yICR7c2Vzc2lvbklkfWApKSB7XG5cdFx0XHRcdHZvaWQgcGFpbnRlZC5jb21wbGV0ZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3Qgb2JzZXJ2ZXIgPSBuZXcgTXV0YXRpb25PYnNlcnZlcihjaGVjayk7XG5cdFx0b2JzZXJ2ZXIub2JzZXJ2ZShjb2x1bW4sIHsgY2hpbGRMaXN0OiB0cnVlLCBjaGFyYWN0ZXJEYXRhOiB0cnVlLCBzdWJ0cmVlOiB0cnVlIH0pO1xuXHRcdGNvbnN0IGFkbWl0dGVkID0gRXZlbnQudG9Qcm9taXNlKGxlYXNlLm9uRGlkQXBwbHlGcmFtZSk7XG5cdFx0dHJ5IHtcblx0XHRcdGhhcm5lc3Muc2Vzc2lvblZpZXcuZW1pdFNlc3Npb24oc2Vzc2lvbklkLCB0ZXh0KTtcblx0XHRcdGF3YWl0IGJvdW5kZWQoYWRtaXR0ZWQsICdmcmFtZSBtdXN0IGJlIGFkbWl0dGVkIGJ5IHRoZSBhY3R1YWwgUGFuZSBsZWFzZScpO1xuXHRcdFx0cGFuZS5sYXlvdXQoeyB3aWR0aDogODAwLCBoZWlnaHQ6IDYwMCB9KTtcblx0XHRcdGNoZWNrKCk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKHBhaW50ZWQucCwgJ2FjdHVhbCBQYW5lIHR1cm4gYW5kIHBlbmRpbmcgc2VhdCBtdXN0IHBhaW50IHRocm91Z2ggVGltZWxpbmVIb3N0Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0xlYXNlLCBsZWFzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVhc2Uuc25hcHNob3QudGltZWxpbmUubGVuZ3RoLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZWFzZS5zbmFwc2hvdC5wZW5kaW5nQWN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRvYnNlcnZlci5kaXNjb25uZWN0KCk7XG5cdFx0XHRhZG1pdHRlZC5jYW5jZWwoKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiB3YWl0Rm9yU2Vzc2lvblBhbmUoXG5cdFx0aGFybmVzczogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVSZXZlYWxIYXJuZXNzPj4sXG5cdFx0c2Vzc2lvbktleTogc3RyaW5nLFxuXHQpOiBQcm9taXNlPENvbnZlcnNhdGlvbkVkaXRvclBhbmU+IHtcblx0XHRyZXR1cm4gd2FpdEZvclBhbmUocGFydEZvcihoYXJuZXNzLnBhcnRzLCBzZXNzaW9uS2V5KSwgaGFybmVzcy5vcGVuRXJyb3JzLCBoYXJuZXNzLnBhcnRzKTtcblx0fVxuXG5cdHN1aXRlKCd2aXNpYmxlIGVuZ2luZSBsZWFzZSByZWNvdmVyeScsICgpID0+IHtcblx0XHR0ZXN0KCdMMSBzYW1lIHZpc2libGUgZW1wdHkgb3duZXIgcmVjb3ZlcnMgaXRzIG93biBsZWFzZSBhZnRlciBzYW1lLXNlc3Npb24gY2F0YWxvZyByZWFkeSB3aXRob3V0IHJldmVhbCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVFbmdpbmVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0XHRjb25zdCB7IHBhbmUsIGxlbnMsIHByaW1hcnlJZCwgcm9zdGVyU2VydmljZSB9ID0gaGFybmVzcztcblx0XHRcdGNvbnN0IGlucHV0ID0gcGFuZS5pbnB1dDtcblx0XHRcdGFzc2VydC5vayhpbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5sYXN0QXR0YWNoZWRFbnRyaWVzLmxlbmd0aCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0xlYXNlPy5zbmFwc2hvdC50aW1lbGluZS5sZW5ndGgsIDApO1xuXHRcdFx0Y29uc3QgcGVuZGluZyA9IGF3YWl0IHN0YXJ0RW1wdHlDYXRhbG9nUmVmcmVzaChoYXJuZXNzLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LCBpbnB1dCk7XG5cdFx0XHRsZXQgYWN0aXZlQ2hhbmdlcyA9IDA7XG5cdFx0XHRjb25zdCBhY3RpdmVMaXN0ZW5lciA9IHN0b3JlLmFkZChyb3N0ZXJTZXJ2aWNlLm9uRGlkQ2hhbmdlQWN0aXZlU2Vzc2lvbigoKSA9PiB7IGFjdGl2ZUNoYW5nZXMrKzsgfSkpO1xuXHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGhhcm5lc3MsIHBlbmRpbmcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIHByaW1hcnlJZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aXZlQ2hhbmdlcywgMCwgJ3NhbWUtc2Vzc2lvbiByZWNvdmVyeSBtdXN0IG5vdCByZWx5IG9uIGFuIGFjdGl2ZS1pZCBldmVudCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuaW5wdXQsIGlucHV0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnMsIGxlbnMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuYm91bmRTZXNzaW9uSWQsIHByaW1hcnlJZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5pc0Rpc3Bvc2VkLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25FbmdpbmVMaXZlKGhhcm5lc3MuY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UoKSwgaGFybmVzcy5jb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChoYXJuZXNzLmNvbm5lY3Rpb24pLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQub2sobGVucy5zZXNzaW9uVmlld0xlYXNlLCAnY2F0YWxvZyByZWFkeSBtdXN0IHJlc3RvcmUgdGhpcyB2aXNpYmxlIFBhbmUgbGVhc2Ugd2l0aG91dCBoaWRlL3JldmVhbCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZS5zZXNzaW9uSWQsIHByaW1hcnlJZCk7XG5cdFx0XHRhY3RpdmVMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRhd2FpdCBhc3NlcnRFbmdpbmVGcmFtZVBhaW50cyhoYXJuZXNzLCBwYW5lLCBwcmltYXJ5SWQsICdMMSByZWNvdmVyZWQgUGFuZSBib2R5Jyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdMMiBjb250aW51b3VzbHkgbGl2ZSBub25lbXB0eSBvd25lciBrZWVwcyBsZWFzZSBzbmFwc2hvdCBlbnRyaWVzIGFuZCB0ZXh0IHRocm91Z2ggY2F0YWxvZyBwZW5kaW5nIGZhaWx1cmUgYW5kIHJlYWR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZUVuZ2luZVJldmVhbEhhcm5lc3MoKTtcblx0XHRcdGF3YWl0IGFzc2VydEVuZ2luZUZyYW1lUGFpbnRzKGhhcm5lc3MsIGhhcm5lc3MucGFuZSwgaGFybmVzcy5wcmltYXJ5SWQsICdMMiBrZWVwIHRoaXMgYm9keScpO1xuXHRcdFx0Y29uc3QgbGVhc2UgPSBoYXJuZXNzLmxlbnMuc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRcdGFzc2VydC5vayhsZWFzZSk7XG5cdFx0XHRjb25zdCBzbmFwc2hvdCA9IGxlYXNlLnNuYXBzaG90O1xuXHRcdFx0Y29uc3QgZW50cmllcyA9IGhhcm5lc3MubGVucy5sYXN0QXR0YWNoZWRFbnRyaWVzO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSBoYXJuZXNzLnBhbmUuaW5wdXQ7XG5cdFx0XHRjb25zdCBhc3NlcnRLZXB0ID0gKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5wYW5lLmlucHV0LCBpbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucywgaGFybmVzcy5sZW5zKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MuY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5lbmdpbmVJZGVudGl0eUlkLCAncmV2ZWFsLWVuZ2luZScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDb252ZXJzYXRpb25FbmdpbmVMaXZlKGhhcm5lc3MuY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UoKSwgaGFybmVzcy5jb25uZWN0aW9uLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLnBhaXJpbmdQZW5kaW5nKSwgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NvbnZlcnNhdGlvblBhaXJpbmdIb2xkKGhhcm5lc3MuY29ubmVjdGlvbiksIGZhbHNlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Mucm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5sZW5zLmJvdW5kU2Vzc2lvbklkLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLmxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgbGVhc2UpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVhc2Uuc25hcHNob3QsIHNuYXBzaG90KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MubGVucy5sYXN0QXR0YWNoZWRFbnRyaWVzLCBlbnRyaWVzKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucGFuZS5nZXRSZWFkaW5nQ29sdW1uKCk/LnF1ZXJ5U2VsZWN0b3IoYC5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEtdHVybi1pZD1cIiR7aGFybmVzcy5wcmltYXJ5SWR9LWJvZHlcIl0gLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYm9keWApPy50ZXh0Q29udGVudCwgJ0wyIGtlZXAgdGhpcyBib2R5Jyk7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgZmFpbGVkID0gaGFybmVzcy5kZWZlckNhdGFsb2coKTtcblx0XHRcdGhhcm5lc3Mubm90aWZ5KCdsaXZlJyk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGZhaWxlZC5zdGFydGVkLnAsICdzYW1lLWxpdmUgY2F0YWxvZyByZWZyZXNoIG11c3Qgc3RhcnQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRDb252ZXJzYXRpb25TZXNzaW9uUmVhZGluZXNzKGhhcm5lc3Mucm9zdGVyU2VydmljZSksICdsb2FkaW5nJyk7XG5cdFx0XHRhc3NlcnRLZXB0KCk7XG5cdFx0XHRhd2FpdCBmYWlsZWQucmVzdWx0LmVycm9yKG5ldyBFcnJvcignY2F0YWxvZyB1bmF2YWlsYWJsZScpKTtcblx0XHRcdGF3YWl0IGJvdW5kZWQoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLndoZW5FbmdpbmVDYXRhbG9nUmVmcmVzaENvbXBsZXRlKCksICdmYWlsZWQgcmVhbCBsaXN0IG11c3Qgc2V0dGxlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0Q29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzcyhoYXJuZXNzLnJvc3RlclNlcnZpY2UpLCAndW5hdmFpbGFibGUnKTtcblx0XHRcdGFzc2VydEtlcHQoKTtcblx0XHRcdGNvbnN0IHJlY292ZXJlZCA9IGhhcm5lc3MuZGVmZXJDYXRhbG9nKCk7XG5cdFx0XHRoYXJuZXNzLm5vdGlmeSgnbGl2ZScpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChyZWNvdmVyZWQuc3RhcnRlZC5wLCAnc2FtZS1saXZlIHJlY292ZXJ5IGxpc3QgbXVzdCBzdGFydCcpO1xuXHRcdFx0YXNzZXJ0S2VwdCgpO1xuXHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGhhcm5lc3MsIHJlY292ZXJlZCk7XG5cdFx0XHRhc3NlcnRLZXB0KCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdMMyBsb2FkaW5nIGFuZCByZWFsIGxpc3QgcmVqZWN0aW9uIGxlYXZlIGEgdmlzaWJsZSBlbXB0eSBvd25lciBtaXNzaW5nIHVudGlsIHN1Y2Nlc3NmdWwgcmVhZHknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlRW5naW5lUmV2ZWFsSGFybmVzcygpO1xuXHRcdFx0Y29uc3QgZmFpbGVkID0gYXdhaXQgc3RhcnRFbXB0eUNhdGFsb2dSZWZyZXNoKGhhcm5lc3MpO1xuXHRcdFx0Y29uc3QgYmluZHMgPSBvYnNlcnZlUGFuZUJpbmRzKGhhcm5lc3MubGVucyk7XG5cdFx0XHRhc3NlcnRWaXNpYmxlTWlzc2luZyhoYXJuZXNzKTtcblx0XHRcdGF3YWl0IGZhaWxlZC5yZXN1bHQuZXJyb3IobmV3IEVycm9yKCdsaXN0U2Vzc2lvbnMgcmVqZWN0ZWQnKSk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGhhcm5lc3Mucm9zdGVyU2VydmljZS53aGVuRW5naW5lQ2F0YWxvZ1JlZnJlc2hDb21wbGV0ZSgpLCAncmVhbCByZWplY3RlZCBsaXN0IG11c3Qgc2V0dGxlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0Q29udmVyc2F0aW9uU2Vzc2lvblJlYWRpbmVzcyhoYXJuZXNzLnJvc3RlclNlcnZpY2UpLCAndW5hdmFpbGFibGUnKTtcblx0XHRcdGFzc2VydFZpc2libGVNaXNzaW5nKGhhcm5lc3MpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJpbmRzKCksIDApO1xuXHRcdFx0Y29uc3QgcmVjb3ZlcnkgPSBhd2FpdCBzdGFydEVtcHR5Q2F0YWxvZ1JlZnJlc2goaGFybmVzcyk7XG5cdFx0XHRjb25zdCBiZWZvcmVSZWFkeSA9IGJpbmRzKCk7XG5cdFx0XHRhd2FpdCBjb21wbGV0ZUNhdGFsb2coaGFybmVzcywgcmVjb3ZlcnkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJpbmRzKCkgLSBiZWZvcmVSZWFkeSwgMSwgJ3RoZSBzZXNzaW9uLXJlYWR5IGxpc3RlbmVyIG11c3QgY2FsbCB0aGUgcmVhbCBQYW5lIGJpbmQgb25jZScpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoaGFybmVzcywgaGFybmVzcy5wYW5lLCBoYXJuZXNzLnByaW1hcnlJZCwgJ0wzIGNhdGFsb2cgcmVjb3ZlcnknKTtcblx0XHR9KTtcblxuXHRcdGZvciAoY29uc3Qgc3RhdGUgb2YgWydkaXNjb25uZWN0ZWQnLCAnY29ubmVjdGVkIHBhaXJpbmcnLCAnY29ubmVjdGluZyBwYWlyaW5nJ10gYXMgY29uc3QpIHtcblx0XHRcdHRlc3QoYEwzICR7c3RhdGV9IFF1ZXVlUmVhZGVyIHNlc3Npb24gd2luZG93IGtlZXBzIGEgbmF0dXJhbGx5IG1pc3NpbmcgdmlzaWJsZSBvd25lciB1bmJvdW5kYCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsZXQgaGFybmVzczogRW5naW5lUmV2ZWFsSGFybmVzcyB8IHVuZGVmaW5lZDtcblx0XHRcdFx0bGV0IGFybWVkID0gZmFsc2U7XG5cdFx0XHRcdGxldCBiaW5kczogKCgpID0+IG51bWJlcikgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IG9yZGVyOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBjYXB0dXJlID0gKHBvc2l0aW9uOiAnYmVmb3JlJyB8ICdhZnRlcicpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQub2soaGFybmVzcyk7XG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKGJpbmRzKTtcblx0XHRcdFx0XHRjb25zdCBsZW5zID0gaGFybmVzcy5wYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnM7XG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKGxlbnMpO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRwb3NpdGlvbiwgcGFuZTogaGFybmVzcy5wYW5lLCBpbnB1dDogaGFybmVzcy5wYW5lLmlucHV0LCBsZW5zLFxuXHRcdFx0XHRcdFx0Ym91bmQ6IGxlbnMuYm91bmRTZXNzaW9uSWQsIHZpc2libGU6IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShoYXJuZXNzLnByaW1hcnlJZCksXG5cdFx0XHRcdFx0XHRzdXNwZW5kZWQ6IGxlbnMuc2Vzc2lvblZpZXdCaW5kaW5nU3VzcGVuZGVkLCBkaXNwb3NlZDogbGVucy5pc0Rpc3Bvc2VkLCBsZWFzZTogbGVucy5zZXNzaW9uVmlld0xlYXNlLFxuXHRcdFx0XHRcdFx0cGhhc2U6IGhhcm5lc3MuY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uUGhhc2UoKS5raW5kLCBwYWlyaW5nOiBoYXJuZXNzLmNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkucGFpcmluZ1BlbmRpbmcsXG5cdFx0XHRcdFx0XHRjb25uZWN0ZWQ6IGhhcm5lc3Mucm9zdGVyU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpLCByZWFkaW5lc3M6IGdldENvbnZlcnNhdGlvblNlc3Npb25SZWFkaW5lc3MoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlKSxcblx0XHRcdFx0XHRcdHF1ZXVlOiBoYXJuZXNzLnJvc3RlclNlcnZpY2UuZ2V0TWVzc2FnZVF1ZXVlU3RhdGUoaGFybmVzcy5wcmltYXJ5SWQpLnJlYWRTdGF0ZSwgYmluZENhbGxzOiBiaW5kcygpLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IHNhbXBsZXM6IFJldHVyblR5cGU8dHlwZW9mIGNhcHR1cmU+W10gPSBbXTtcblx0XHRcdFx0aGFybmVzcyA9IGF3YWl0IGNyZWF0ZUVuZ2luZVJldmVhbEhhcm5lc3Mocm9zdGVyID0+IHtcblx0XHRcdFx0XHRzdG9yZS5hZGQocm9zdGVyLm9uRGlkQ2hhbmdlU2Vzc2lvbihpZCA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoYXJtZWQgJiYgaWQgPT09ICdsZWFzZS1zMScgJiYgc2FtcGxlcy5sZW5ndGggPT09IDAgJiYgcm9zdGVyLmdldE1lc3NhZ2VRdWV1ZVN0YXRlKGlkKS5yZWFkU3RhdGUgPT09ICdzdGFsZScpIHtcblx0XHRcdFx0XHRcdFx0b3JkZXIucHVzaCgnc2Vzc2lvbiBiZWZvcmUnKTtcblx0XHRcdFx0XHRcdFx0c2FtcGxlcy5wdXNoKGNhcHR1cmUoJ2JlZm9yZScpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRjb25zdCBjdXJyZW50ID0gaGFybmVzcztcblx0XHRcdFx0YmluZHMgPSBvYnNlcnZlUGFuZUJpbmRzKGN1cnJlbnQubGVucyk7XG5cdFx0XHRcdHN0b3JlLmFkZChjdXJyZW50LnJvc3RlclNlcnZpY2Uub25EaWRDaGFuZ2VTZXNzaW9uKGlkID0+IHtcblx0XHRcdFx0XHRpZiAoYXJtZWQgJiYgaWQgPT09IGN1cnJlbnQucHJpbWFyeUlkICYmIHNhbXBsZXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0XHRvcmRlci5wdXNoKCdzZXNzaW9uIGFmdGVyJyk7XG5cdFx0XHRcdFx0XHRzYW1wbGVzLnB1c2goY2FwdHVyZSgnYWZ0ZXInKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdGNvbnN0IHBlbmRpbmcgPSBhd2FpdCBzdGFydEVtcHR5Q2F0YWxvZ1JlZnJlc2goY3VycmVudCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXJyZW50LnJvc3RlclNlcnZpY2UuZ2V0TWVzc2FnZVF1ZXVlU3RhdGUoY3VycmVudC5wcmltYXJ5SWQpLnJlYWRTdGF0ZSwgJ3Vuc3VwcG9ydGVkJyk7XG5cdFx0XHRcdGNvbnN0IGJlZm9yZUNhbGxzID0gYmluZHMoKTtcblx0XHRcdFx0Y29uc3QgaW5wdXQgPSBjdXJyZW50LnBhbmUuaW5wdXQ7XG5cdFx0XHRcdGFybWVkID0gdHJ1ZTtcblx0XHRcdFx0b3JkZXIucHVzaCgnVUEgc3RhcnQnKTtcblx0XHRcdFx0Y3VycmVudC5ub3RpZnkoc3RhdGUpO1xuXHRcdFx0XHRvcmRlci5wdXNoKCdVQSByZXR1cm4nKTtcblx0XHRcdFx0YXJtZWQgPSBmYWxzZTtcblx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcmRlciwgWydVQSBzdGFydCcsICdzZXNzaW9uIGJlZm9yZScsICdzZXNzaW9uIGFmdGVyJywgJ1VBIHJldHVybiddLCAnUXVldWVSZWFkZXIgbXVzdCBleHBvc2UgdGhlIGFjdHVhbCBpbmRlcGVuZGVudCBjYWxsYmFjayB3aW5kb3cnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbXBsZXMubGVuZ3RoLCAyKTtcblx0XHRcdFx0Zm9yIChjb25zdCBzYW1wbGUgb2Ygc2FtcGxlcykge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUucGFuZSwgY3VycmVudC5wYW5lKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLmlucHV0LCBpbnB1dCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbXBsZS5sZW5zLCBjdXJyZW50LmxlbnMpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUuYm91bmQsIGN1cnJlbnQucHJpbWFyeUlkKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtcGxlLnZpc2libGUsIHRydWUpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUuc3VzcGVuZGVkLCBmYWxzZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbXBsZS5kaXNwb3NlZCwgZmFsc2UpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUubGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbXBsZS5waGFzZSwgc3RhdGUgPT09ICdkaXNjb25uZWN0ZWQnID8gJ2Rpc2Nvbm5lY3RlZCcgOiBzdGF0ZSA9PT0gJ2Nvbm5lY3RpbmcgcGFpcmluZycgPyAnY29ubmVjdGluZycgOiAnY29ubmVjdGVkJyk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbXBsZS5wYWlyaW5nLCBzdGF0ZSAhPT0gJ2Rpc2Nvbm5lY3RlZCcpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUuY29ubmVjdGVkLCBmYWxzZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbXBsZS5yZWFkaW5lc3MsICdyZWFkeScpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUucXVldWUsICdzdGFsZScpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1wbGUuYmluZENhbGxzLCBiZWZvcmVDYWxscywgJ25ldyByZWNvbmNpbGUgbXVzdCBub3QgYmluZCB3aXRoaW4gdGhlIG5vbi1saXZlIGNhbGxiYWNrIHdpbmRvdycpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIExhdGVyIGV4aXN0aW5nIGNvbm5lY3Rpb24gY2FsbGJhY2tzIG1heSBsZWdpdGltYXRlbHkgYmluZCBhIGNhY2hlOyBkcmFpbiB0aGF0IHNjb3BlIHNlcGFyYXRlbHkuXG5cdFx0XHRcdGF3YWl0IHBlbmRpbmcucmVzdWx0LmNvbXBsZXRlKGN1cnJlbnQuY2F0YWxvZyk7XG5cdFx0XHRcdGF3YWl0IGJvdW5kZWQoY3VycmVudC5yb3N0ZXJTZXJ2aWNlLndoZW5FbmdpbmVDYXRhbG9nUmVmcmVzaENvbXBsZXRlKCksICdzdGFsZSBwZW5kaW5nIGNhdGFsb2cgbXVzdCBkcmFpbicpO1xuXHRcdFx0XHRjb25zdCByZWNvdmVyeSA9IGF3YWl0IHN0YXJ0RW1wdHlDYXRhbG9nUmVmcmVzaChjdXJyZW50KTtcblx0XHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGN1cnJlbnQsIHJlY292ZXJ5KTtcblx0XHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoY3VycmVudCwgY3VycmVudC5wYW5lLCBjdXJyZW50LnByaW1hcnlJZCwgYEwzICR7c3RhdGV9IHJlc3RvcmVkYCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0ZXN0KCdMNCBoaWRkZW4gc3VzcGVuZGVkIG93bmVyIHN0YXlzIHVuYm91bmQgdGhyb3VnaCBmYWlsZWQgYW5kIHJlYWR5IGNhdGFsb2dzIHVudGlsIHB1YmxpYyByZXN0b3JlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZUVuZ2luZVJldmVhbEhhcm5lc3MoKTtcblx0XHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoJ2xlYXNlLXMyJyk7XG5cdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgd2FpdEZvckVuZ2luZVBhbmUocGFydEZvcihoYXJuZXNzLnBhcnRzLCAnbGVhc2UtczInKSk7XG5cdFx0XHR0cmFja0VkaXRvcnMoaGFybmVzcy5wYXJ0cyk7XG5cdFx0XHRjb25zdCBsZW5zID0gcGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zO1xuXHRcdFx0YXNzZXJ0Lm9rKGxlbnM/LnNlc3Npb25WaWV3TGVhc2UpO1xuXHRcdFx0aGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5oaWRlU2Vzc2lvbldpbmRvdygnbGVhc2UtczInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3QmluZGluZ1N1c3BlbmRlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3QgYmluZHMgPSBvYnNlcnZlUGFuZUJpbmRzKGxlbnMpO1xuXHRcdFx0Y29uc3QgZmFpbGVkID0gaGFybmVzcy5kZWZlckNhdGFsb2coKTtcblx0XHRcdGhhcm5lc3Mubm90aWZ5KCdsaXZlJyk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGZhaWxlZC5zdGFydGVkLnAsICdoaWRkZW4gY29udHJvbCByZWFsIGxpc3QgbXVzdCBzdGFydCcpO1xuXHRcdFx0YXdhaXQgZmFpbGVkLnJlc3VsdC5lcnJvcihuZXcgRXJyb3IoJ2hpZGRlbiBjYXRhbG9nIGZhaWx1cmUnKSk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGhhcm5lc3Mucm9zdGVyU2VydmljZS53aGVuRW5naW5lQ2F0YWxvZ1JlZnJlc2hDb21wbGV0ZSgpLCAnaGlkZGVuIGZhaWx1cmUgbXVzdCBzZXR0bGUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmluZHMoKSwgMCk7XG5cdFx0XHRjb25zdCByZWFkeSA9IGhhcm5lc3MuZGVmZXJDYXRhbG9nKCk7XG5cdFx0XHRoYXJuZXNzLm5vdGlmeSgnbGl2ZScpO1xuXHRcdFx0YXdhaXQgYm91bmRlZChyZWFkeS5zdGFydGVkLnAsICdoaWRkZW4gcmVjb3ZlcnkgbGlzdCBtdXN0IHN0YXJ0Jyk7XG5cdFx0XHRhd2FpdCBjb21wbGV0ZUNhdGFsb2coaGFybmVzcywgcmVhZHkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZSgnbGVhc2UtczInKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdCaW5kaW5nU3VzcGVuZGVkLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmluZHMoKSwgMCk7XG5cdFx0XHRoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLnJlc3RvcmVTZXNzaW9uV2luZG93KCdsZWFzZS1zMicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdCaW5kaW5nU3VzcGVuZGVkLCBmYWxzZSk7XG5cdFx0XHRjb25zdCByZXN0b3JlZExlbnMgPSBwYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnM7XG5cdFx0XHRhc3NlcnQub2socmVzdG9yZWRMZW5zKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlZExlbnMsIGxlbnMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3RvcmVkTGVucy5zZXNzaW9uVmlld0xlYXNlPy5zZXNzaW9uSWQsICdsZWFzZS1zMicpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoaGFybmVzcywgcGFuZSwgJ2xlYXNlLXMyJywgJ0w0IHB1YmxpYyByZXN0b3JlJyk7XG5cdFx0XHRjb25zdCByZXRpcmVkTGVhc2UgPSByZXN0b3JlZExlbnMuc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRcdGFzc2VydC5vayhyZXRpcmVkTGVhc2UpO1xuXHRcdFx0Y29uc3QgcmV0YWluZWRPYnNlcnZlciA9IHN0b3JlLmFkZChoYXJuZXNzLnJvc3RlclNlcnZpY2UuYWNxdWlyZVNlc3Npb25WaWV3KCdsZWFzZS1zMicpKTtcblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChyZXRhaW5lZE9ic2VydmVyLCByZXRpcmVkTGVhc2UpO1xuXHRcdFx0Y29uc3QgaG9zdExlYXNlID0gaGFybmVzcy5zZXNzaW9uVmlldy5hY3F1aXJlZC5maW5kKGxlYXNlID0+IGxlYXNlLnNlc3Npb25JZCA9PT0gJ2xlYXNlLXMyJyAmJiAhaGFybmVzcy5zZXNzaW9uVmlldy5yZWxlYXNlZC5oYXMobGVhc2UubGVhc2VJZCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGhvc3RMZWFzZSwgJ3RoZSByZXN0b3JlZCBQYW5lIGFuZCBvYnNlcnZlciBtdXN0IHNoYXJlIGFuIGFjcXVpcmVkIHMyIGhvc3QgbGVhc2UnKTtcblx0XHRcdGxldCByZXRpcmVkRnJhbWVzID0gMDtcblx0XHRcdHN0b3JlLmFkZChyZXRpcmVkTGVhc2Uub25EaWRBcHBseUZyYW1lKCgpID0+IHsgcmV0aXJlZEZyYW1lcysrOyB9KSk7XG5cdFx0XHRjb25zdCByZW1vdmVkID0gaGFybmVzcy5kZWZlckNhdGFsb2coKTtcblx0XHRcdGhhcm5lc3Mubm90aWZ5KCdsaXZlJyk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKHJlbW92ZWQuc3RhcnRlZC5wLCAncHVibGljIHJlbW92YWwgY2F0YWxvZyBtdXN0IHN0YXJ0Jyk7XG5cdFx0XHRjb25zdCBzdXJ2aXZpbmdDYXRhbG9nID0geyBzZXNzaW9uczogaGFybmVzcy5jYXRhbG9nLnNlc3Npb25zLmZpbHRlcihzZXNzaW9uID0+IHNlc3Npb24uc2Vzc2lvbklkICE9PSAnbGVhc2UtczInKSB9O1xuXHRcdFx0YXdhaXQgcmVtb3ZlZC5yZXN1bHQuY29tcGxldGUoc3Vydml2aW5nQ2F0YWxvZyk7XG5cdFx0XHRhd2FpdCBib3VuZGVkKGhhcm5lc3Mucm9zdGVyU2VydmljZS53aGVuRW5naW5lQ2F0YWxvZ1JlZnJlc2hDb21wbGV0ZSgpLCAncHVibGljIHBydW5lIG11c3Qgc2V0dGxlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMoJ2xlYXNlLXMyJyksIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4oJ2xlYXNlLXMyJyksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoJ2xlYXNlLXMyJyksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmlzRGlzcG9zZWQsIHRydWUpO1xuXHRcdFx0Y29uc3QgcmV0aXJlZFNuYXBzaG90ID0gcmV0aXJlZExlYXNlLnNuYXBzaG90O1xuXHRcdFx0Y29uc3QgZnJhbWVzQWZ0ZXJSZW1vdmFsID0gcmV0aXJlZEZyYW1lcztcblx0XHRcdGNvbnN0IG9ic2VydmVkID0gRXZlbnQudG9Qcm9taXNlKHJldGFpbmVkT2JzZXJ2ZXIub25EaWRBcHBseUZyYW1lKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGhhcm5lc3Muc2Vzc2lvblZpZXcuZW1pdFNlc3Npb24oJ2xlYXNlLXMyJywgJ0w0IHJldGFpbmVkIG9ic2VydmVyIG9ubHknKTtcblx0XHRcdFx0YXdhaXQgYm91bmRlZChvYnNlcnZlZCwgJ3RoZSBsaXZlIHJldGFpbmVkIG9ic2VydmVyIG11c3QgYWRtaXQgdGhlIHBvc3QtcHJ1bmUgaG9zdCBmcmFtZScpO1xuXHRcdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocmV0YWluZWRPYnNlcnZlci5zbmFwc2hvdCwgcmV0aXJlZFNuYXBzaG90KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldGlyZWRMZWFzZS5zbmFwc2hvdCwgcmV0aXJlZFNuYXBzaG90LCAndGhlIGRpc3Bvc2VkIFBhbmUgbGVhc2UgbXVzdCBubyBsb25nZXIgcmVjZWl2ZSBzaGFyZWQgaG9zdCBzbmFwc2hvdHMnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldGlyZWRGcmFtZXMsIGZyYW1lc0FmdGVyUmVtb3ZhbCk7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHRvYnNlcnZlZC5jYW5jZWwoKTtcblx0XHRcdFx0cmV0YWluZWRPYnNlcnZlci5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uVmlldy5yZWxlYXNlZC5oYXMoaG9zdExlYXNlLmxlYXNlSWQpLCB0cnVlLCAndGhlIHJldGlyZWQgUGFuZSBhbmQgcm9zdGVyIG11c3QgcmVsZWFzZSB0aGVpciBvd25lcnNoaXAgYmVmb3JlIHRoZSBmaW5hbCBvYnNlcnZlciByZWxlYXNlcyB0aGUgaG9zdCcpO1xuXHRcdFx0Y29uc3QgYWZ0ZXJSZW1vdmFsID0gYmluZHMoKTtcblx0XHRcdGNvbnN0IGxhdGUgPSBoYXJuZXNzLmRlZmVyQ2F0YWxvZygpO1xuXHRcdFx0aGFybmVzcy5ub3RpZnkoJ2xpdmUnKTtcblx0XHRcdGF3YWl0IGJvdW5kZWQobGF0ZS5zdGFydGVkLnAsICdwb3N0LXJlbW92YWwgY2F0YWxvZyBtdXN0IHN0YXJ0Jyk7XG5cdFx0XHRhd2FpdCBsYXRlLnJlc3VsdC5jb21wbGV0ZShzdXJ2aXZpbmdDYXRhbG9nKTtcblx0XHRcdGF3YWl0IGJvdW5kZWQoaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLndoZW5FbmdpbmVDYXRhbG9nUmVmcmVzaENvbXBsZXRlKCksICdwb3N0LXJlbW92YWwgY2F0YWxvZyBtdXN0IHNldHRsZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJpbmRzKCksIGFmdGVyUmVtb3ZhbCwgJ2xhdGVyIHJlYWR5IG5vdGljZXMgY2Fubm90IHJldml2ZSB0aGUgcmVtb3ZlZCBub24taGlkZGVuIGxlYWYnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXRpcmVkTGVhc2Uuc25hcHNob3QsIHJldGlyZWRTbmFwc2hvdCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV0aXJlZEZyYW1lcywgZnJhbWVzQWZ0ZXJSZW1vdmFsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25WaWV3LnJlbGVhc2VkLmhhcyhob3N0TGVhc2UubGVhc2VJZCksIHRydWUpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoaGFybmVzcywgaGFybmVzcy5wYW5lLCBoYXJuZXNzLnByaW1hcnlJZCwgJ0w0IHN1cnZpdmluZyBvd25lcicpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnTDQgYW4gdW5tb3VudGVkIG5vbi1oaWRkZW4gYm91bmQga2V5IGNhbm5vdCByZWNvbmNpbGUgYmVmb3JlIGl0cyBwdWJsaWMgbGVhZiBleGlzdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlRW5naW5lUmV2ZWFsSGFybmVzcygpO1xuXHRcdFx0Y29uc3QgcGVuZGluZyA9IGF3YWl0IHN0YXJ0RW1wdHlDYXRhbG9nUmVmcmVzaChoYXJuZXNzKTtcblx0XHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25DaGF0SW5wdXQoZ2V0Q29udmVyc2F0aW9uQ2hhdFJlc291cmNlKCdsZWFzZS1zMicsICd1bm1vdW50ZWQnKSkpO1xuXHRcdFx0Y29uc3QgcGFydCA9IHBhcnRGb3IoaGFybmVzcy5wYXJ0cywgaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdFx0YXdhaXQgaGFybmVzcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHVuZGVmaW5lZCwgcGFydC5hY3RpdmVHcm91cCk7XG5cdFx0XHRjb25zdCBwYW5lID0gcGFydC5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0YXNzZXJ0Lm9rKHBhbmUgaW5zdGFuY2VvZiBDb252ZXJzYXRpb25FZGl0b3JQYW5lKTtcblx0XHRcdGNvbnN0IGxlbnMgPSBwYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnM7XG5cdFx0XHRhc3NlcnQub2sobGVucyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5pbnB1dCwgaW5wdXQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuYm91bmRTZXNzaW9uSWQsICdsZWFzZS1zMicpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3QmluZGluZ1N1c3BlbmRlZCwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKCdsZWFzZS1zMicpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKCdsZWFzZS1zMicpLCBmYWxzZSk7XG5cdFx0XHRjb25zdCBiaW5kcyA9IG9ic2VydmVQYW5lQmluZHMobGVucyk7XG5cdFx0XHRhd2FpdCBjb21wbGV0ZUNhdGFsb2coaGFybmVzcywgcGVuZGluZyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJpbmRzKCksIDAsICdub3QtaGlkZGVuIGlzIG5vdCBldmlkZW5jZSBvZiBhIHZpc2libGUgbGVhZicpO1xuXHRcdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZSgnbGVhc2UtczInKTtcblx0XHRcdGNvbnN0IG1vdW50ZWQgPSBhd2FpdCB3YWl0Rm9yRW5naW5lUGFuZShwYXJ0Rm9yKGhhcm5lc3MucGFydHMsICdsZWFzZS1zMicpKTtcblx0XHRcdHRyYWNrRWRpdG9ycyhoYXJuZXNzLnBhcnRzKTtcblx0XHRcdGF3YWl0IGFzc2VydEVuZ2luZUZyYW1lUGFpbnRzKGhhcm5lc3MsIG1vdW50ZWQsICdsZWFzZS1zMicsICdMNCBtb3VudGVkIHN1Y2Nlc3NvcicpO1xuXHRcdH0pO1xuXG5cdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgWydjbGVhcklucHV0JywgJ2Rpc3Bvc2UnLCAnc3dpdGNoIGlucHV0J10gYXMgY29uc3QpIHtcblx0XHRcdHRlc3QoYEw1ICR7YWN0aW9ufSBkdXJpbmcgcmVhbCBjYXRhbG9nIHBlbmRpbmcgY2Fubm90IHJldml2ZSB0aGUgY2FwdHVyZWQgb3duZXJgLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVFbmdpbmVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0XHRcdGNvbnN0IHBlbmRpbmcgPSBhd2FpdCBzdGFydEVtcHR5Q2F0YWxvZ1JlZnJlc2goaGFybmVzcyk7XG5cdFx0XHRcdGNvbnN0IG9sZElucHV0ID0gaGFybmVzcy5wYW5lLmlucHV0O1xuXHRcdFx0XHRjb25zdCBvbGRMZW5zID0gaGFybmVzcy5sZW5zO1xuXHRcdFx0XHRjb25zdCBvbGRCaW5kcyA9IG9ic2VydmVQYW5lQmluZHMob2xkTGVucyk7XG5cdFx0XHRcdGlmIChhY3Rpb24gPT09ICdjbGVhcklucHV0Jykge1xuXHRcdFx0XHRcdGhhcm5lc3MucGFuZS5jbGVhcklucHV0KCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoYWN0aW9uID09PSAnZGlzcG9zZScpIHtcblx0XHRcdFx0XHRoYXJuZXNzLnBhbmUuZGlzcG9zZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGlucHV0ID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25DaGF0SW5wdXQoZ2V0Q29udmVyc2F0aW9uQ2hhdFJlc291cmNlKGhhcm5lc3MucHJpbWFyeUlkLCAnc3VjY2Vzc29yJykpKTtcblx0XHRcdFx0XHRhd2FpdCBoYXJuZXNzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgdW5kZWZpbmVkLCBwYXJ0Rm9yKGhhcm5lc3MucGFydHMsIGhhcm5lc3MucHJpbWFyeUlkKS5hY3RpdmVHcm91cCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucGFuZS5pbnB1dCwgaW5wdXQpO1xuXHRcdFx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChoYXJuZXNzLnBhbmUuaW5wdXQsIG9sZElucHV0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBiZWZvcmVSZWFkeSA9IG9sZEJpbmRzKCk7XG5cdFx0XHRcdGF3YWl0IGNvbXBsZXRlQ2F0YWxvZyhoYXJuZXNzLCBwZW5kaW5nKTtcblx0XHRcdFx0aWYgKGFjdGlvbiA9PT0gJ3N3aXRjaCBpbnB1dCcpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5wYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnM/LmJvdW5kU2Vzc2lvbklkLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9sZEJpbmRzKCkgLSBiZWZvcmVSZWFkeSwgMSwgJ29ubHkgdGhlIGN1cnJlbnQgaW5wdXQgbGlzdGVuZXIgbWF5IHJlY29uY2lsZScpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucz8uc2Vzc2lvblZpZXdMZWFzZT8uc2Vzc2lvbklkLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3MucGFuZS5hY3RpdmVDb252ZXJzYXRpb25MZW5zLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbGRMZW5zLmlzRGlzcG9zZWQsIHRydWUpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbGRCaW5kcygpLCBiZWZvcmVSZWFkeSwgJ2xhdGUgY2F0YWxvZy9zZXNzaW9uIG5vdGljZXMgY2Fubm90IGJpbmQgdGhlIHJldGlyZWQgb3duZXInKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGVzdCgnTDYgcmVwZWF0ZWQgcmVhbCBzZXNzaW9uIG5vdGljZXMga2VlcCB0aGUgcmVjb3ZlcmVkIGxlYXNlIGFuZCBjb250aW51ZSBkZWxpdmVyaW5nIGZyYW1lcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVFbmdpbmVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0XHRjb25zdCBwZW5kaW5nID0gYXdhaXQgc3RhcnRFbXB0eUNhdGFsb2dSZWZyZXNoKGhhcm5lc3MpO1xuXHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGhhcm5lc3MsIHBlbmRpbmcpO1xuXHRcdFx0YXdhaXQgYXNzZXJ0RW5naW5lRnJhbWVQYWludHMoaGFybmVzcywgaGFybmVzcy5wYW5lLCBoYXJuZXNzLnByaW1hcnlJZCwgJ0w2IGZpcnN0IGZyYW1lJyk7XG5cdFx0XHRjb25zdCBsZWFzZSA9IGhhcm5lc3MubGVucy5zZXNzaW9uVmlld0xlYXNlO1xuXHRcdFx0YXNzZXJ0Lm9rKGxlYXNlKTtcblx0XHRcdGNvbnN0IGNvdW50ID0gaGFybmVzcy5zZXNzaW9uVmlldy5hY3F1aXJlZC5sZW5ndGg7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDI7IGkrKykge1xuXHRcdFx0XHRjb25zdCByZWZyZXNoID0gaGFybmVzcy5kZWZlckNhdGFsb2coKTtcblx0XHRcdFx0aGFybmVzcy5ub3RpZnkoJ2xpdmUnKTtcblx0XHRcdFx0YXdhaXQgYm91bmRlZChyZWZyZXNoLnN0YXJ0ZWQucCwgJ2R1cGxpY2F0ZSByZWFsIHJlZnJlc2ggbXVzdCBzdGFydCcpO1xuXHRcdFx0XHRhd2FpdCBjb21wbGV0ZUNhdGFsb2coaGFybmVzcywgcmVmcmVzaCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLmxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgbGVhc2UpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uVmlldy5hY3F1aXJlZC5sZW5ndGgsIGNvdW50LCAnb2JzZXJ2YXRpb24gb3duZXJzIG11c3Qgbm90IGltcGx5IGEgbmV3IHBoeXNpY2FsIGFjcXVpc2l0aW9uJyk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCBhc3NlcnRFbmdpbmVGcmFtZVBhaW50cyhoYXJuZXNzLCBoYXJuZXNzLnBhbmUsIGhhcm5lc3MucHJpbWFyeUlkLCAnTDYgbGF0ZXIgZnJhbWUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLmxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgbGVhc2UpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnTDcgdHdvIHBpbm5lZCB2aXNpYmxlIG93bmVycyByZWNvdmVyIHRoZWlyIG93biBib3VuZHMgZnJvbSBvbmUgYWN0aXZlLXNlc3Npb24gY2F0YWxvZyBub3RpY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlRW5naW5lUmV2ZWFsSGFybmVzcygpO1xuXHRcdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZSgnbGVhc2UtczInKTtcblx0XHRcdGNvbnN0IHNlY29uZCA9IGF3YWl0IHdhaXRGb3JFbmdpbmVQYW5lKHBhcnRGb3IoaGFybmVzcy5wYXJ0cywgJ2xlYXNlLXMyJykpO1xuXHRcdFx0dHJhY2tFZGl0b3JzKGhhcm5lc3MucGFydHMpO1xuXHRcdFx0Y29uc3QgbGVuczIgPSBzZWNvbmQuYWN0aXZlQ29udmVyc2F0aW9uTGVucztcblx0XHRcdGFzc2VydC5vayhsZW5zMj8uc2Vzc2lvblZpZXdMZWFzZSk7XG5cdFx0XHRhd2FpdCBoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3coaGFybmVzcy5wcmltYXJ5SWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShoYXJuZXNzLnByaW1hcnlJZCksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZSgnbGVhc2UtczInKSwgdHJ1ZSk7XG5cdFx0XHRjb25zdCBwZW5kaW5nID0gYXdhaXQgc3RhcnRFbXB0eUNhdGFsb2dSZWZyZXNoKGhhcm5lc3MpO1xuXHRcdFx0YXNzZXJ0VmlzaWJsZU1pc3NpbmcoaGFybmVzcywgc2Vjb25kLCAnbGVhc2UtczInKTtcblx0XHRcdGNvbnN0IGFjdGl2ZSA9IGhhcm5lc3Mucm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRcdGNvbnN0IG5vdGlmaWVkOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0c3RvcmUuYWRkKGhhcm5lc3Mucm9zdGVyU2VydmljZS5vbkRpZENoYW5nZVNlc3Npb24oaWQgPT4geyBub3RpZmllZC5wdXNoKGlkKTsgfSkpO1xuXHRcdFx0YXdhaXQgY29tcGxldGVDYXRhbG9nKGhhcm5lc3MsIHBlbmRpbmcpO1xuXHRcdFx0YXNzZXJ0Lm9rKG5vdGlmaWVkLmluY2x1ZGVzKGFjdGl2ZSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFub3RpZmllZC5pbmNsdWRlcygnbGVhc2UtczInKSwgJ3RoZSBpbmFjdGl2ZSBwaW5uZWQgbGVhZiBjYW5ub3QgcmVseSBvbiBpdHMgb3duIGV2ZW50IGlkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5wYW5lLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnMsIGhhcm5lc3MubGVucyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLmFjdGl2ZUNvbnZlcnNhdGlvbkxlbnMsIGxlbnMyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLmxlbnMuc2Vzc2lvblZpZXdMZWFzZT8uc2Vzc2lvbklkLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVuczIuc2Vzc2lvblZpZXdMZWFzZT8uc2Vzc2lvbklkLCAnbGVhc2UtczInKTtcblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChoYXJuZXNzLmxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgbGVuczIuc2Vzc2lvblZpZXdMZWFzZSk7XG5cdFx0XHRhd2FpdCBhc3NlcnRFbmdpbmVGcmFtZVBhaW50cyhoYXJuZXNzLCBoYXJuZXNzLnBhbmUsIGhhcm5lc3MucHJpbWFyeUlkLCAnTDcgZmlyc3QgbGVhZiBvbmx5Jyk7XG5cdFx0XHRhd2FpdCBhc3NlcnRFbmdpbmVGcmFtZVBhaW50cyhoYXJuZXNzLCBzZWNvbmQsICdsZWFzZS1zMicsICdMNyBzZWNvbmQgbGVhZiBvbmx5Jyk7XG5cdFx0XHRhc3NlcnQub2soIWhhcm5lc3MucGFuZS5nZXRSZWFkaW5nQ29sdW1uKCk/LnRleHRDb250ZW50Py5pbmNsdWRlcygnTDcgc2Vjb25kIGxlYWYgb25seScpKTtcblx0XHRcdGFzc2VydC5vayghc2Vjb25kLmdldFJlYWRpbmdDb2x1bW4oKT8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdMNyBmaXJzdCBsZWFmIG9ubHknKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJzggc2luZ2xlLWxlYWYgcmV2ZWFsIEFcdTIxOTJCXHUyMTkyQSBrZWVwcyBvbmUgdmlzaWJsZSBwcmltYXJ5IHdpdGhvdXQgaGlkZSBidXR0b24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHBhcnRzLCBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRjb25zdCBwYXJ0QiA9IHBhcnRGb3IocGFydHMsIGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGVMZWFmS2V5cyhzZXNzaW9uV2luZG93U2VydmljZSksIFtiXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Qi5zZXNzaW9uS2V5LCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydHMuZ2V0QWN0aXZlQ29udmVyc2F0aW9uRWRpdG9yUGFydCgpPy5zZXNzaW9uS2V5LCBiKTtcblx0XHRhc3NlcnQub2soc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHByaW1hcnlJZCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpLnNlc3Npb25LZXksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhpZGVCdXR0b24oc2Vzc2lvbldpbmRvd1NlcnZpY2UsIGIpPy5oaWRkZW4sIHRydWUpO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKHNlc3Npb25XaW5kb3dTZXJ2aWNlKSwgW3ByaW1hcnlJZF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoaWRlQnV0dG9uKHNlc3Npb25XaW5kb3dTZXJ2aWNlLCBwcmltYXJ5SWQpPy5oaWRkZW4sIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdoaWRlIGZvY3VzZWQgc2Vjb25kYXJ5IGxlYWYgbW92ZXMgZm9jdXMgdG8gcHJpbWFyeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gY3JlYXRlTGlnaHR3ZWlnaHRXaW5kb3dIYXJuZXNzKCk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRjb25zdCBwcmltYXJ5SWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5lbnN1cmVQcmltYXJ5V2luZG93KHByaW1hcnlJZCk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5SWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZShzZWNvbmRhcnlJZCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KHNlY29uZGFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgc2Vjb25kYXJ5SWQpO1xuXG5cdFx0aGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5oaWRlU2Vzc2lvbldpbmRvdyhzZWNvbmRhcnlJZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4oc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgcHJpbWFyeUlkKTtcblx0XHRjb25zdCBwcmltYXJ5TGVhZiA9IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHByaW1hcnlJZCkhO1xuXHRcdGNvbnN0IGFjdGl2ZSA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRhc3NlcnQub2soXG5cdFx0XHRwcmltYXJ5TGVhZi5jb250YWluZXIgPT09IGFjdGl2ZSB8fCBwcmltYXJ5TGVhZi5jb250YWluZXIuY29udGFpbnMoYWN0aXZlKSxcblx0XHRcdCdmb2N1cyBtdXN0IGxlYXZlIHRoZSBoaWRkZW4gbGVhZiBhbmQgbGFuZCBvbiB0aGUgdmlzaWJsZSBwcmltYXJ5Jyxcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCc4IHR3byB2aXNpYmxlIGxlYXZlczogcmV2ZWFsIGFscmVhZHktdmlzaWJsZSBsZWFmIGZvY3VzZXMgaXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHBhcnRzLCBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkLCBjb252ZXJzYXRpb25QYXJ0IH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLm9wZW5TZXNzaW9uQmVzaWRlKGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0cy5nZXRBY3RpdmVDb252ZXJzYXRpb25FZGl0b3JQYXJ0KCk/LnNlc3Npb25LZXksIGIpO1xuXHRcdGNvbnN0IGxlYWZCID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKGIpO1xuXHRcdGFzc2VydC5vayhsZWFmQik7XG5cdFx0Y29uc3QgYWN0aXZlID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdGFzc2VydC5vayhcblx0XHRcdGxlYWZCLmNvbnRhaW5lciA9PT0gYWN0aXZlIHx8IGxlYWZCLmNvbnRhaW5lci5jb250YWlucyhhY3RpdmUpLFxuXHRcdFx0J2ZvY3VzIG11c3Qgc3RheSBpbiB0aGUgcmV2ZWFsZWQgbGVhZiwgbm90IHNuYXAgYmFjayB0byBwcmltYXJ5Jyxcblx0XHQpO1xuXHRcdGNvbnN0IGNocm9tZSA9IGNvdW50TGVhZkNocm9tZShzZXNzaW9uV2luZG93U2VydmljZSwgY29udmVyc2F0aW9uUGFydCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZS5iYXJzLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydEZvcihwYXJ0cywgcHJpbWFyeUlkKS5zZXNzaW9uS2V5LCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Rm9yKHBhcnRzLCBiKS5zZXNzaW9uS2V5LCBiKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuY2VsbGVkIGFscmVhZHktdmlzaWJsZSByZXZlYWwgZG9lcyBub3Qgc3dpdGNoIHRoZSBhY3RpdmUgc2Vzc2lvbiBiYWNrJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBwYXJ0cywgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZShiKTtcblx0XHRjb25zdCBwYW5lQSA9IGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHBhbmVCID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGFzc2VydC5vayhwYW5lQS5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdGFzc2VydC5vayhwYW5lQi5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cblx0XHRsZXQgcmVsZWFzZUEgPSAoKSA9PiB7IH07XG5cdFx0Y29uc3QgZ2F0ZSA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyByZWxlYXNlQSA9IHJlc29sdmU7IH0pO1xuXHRcdChwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpIGFzIHsgd2hlblJlYWR5OiBQcm9taXNlPHZvaWQ+IH0pLndoZW5SZWFkeSA9IGdhdGU7XG5cblx0XHRjb25zdCBzd2l0Y2hlZDogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBvcmlnaW5hbFN3aXRjaCA9IHJvc3RlclNlcnZpY2Uuc3dpdGNoU2Vzc2lvbi5iaW5kKHJvc3RlclNlcnZpY2UpO1xuXHRcdHJvc3RlclNlcnZpY2Uuc3dpdGNoU2Vzc2lvbiA9IChzZXNzaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0c3dpdGNoZWQucHVzaChzZXNzaW9uSWQpO1xuXHRcdFx0b3JpZ2luYWxTd2l0Y2goc2Vzc2lvbklkKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgZmlyc3QgPSBwYW5lQS5sZWFmU2Vzc2lvbkJhckhvc3Quc3dpdGNoTGVhZlNlc3Npb24ocHJpbWFyeUlkKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRcdGF3YWl0IHBhbmVCLmxlYWZTZXNzaW9uQmFySG9zdC5zd2l0Y2hMZWFmU2Vzc2lvbihiKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgYik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgYik7XG5cdFx0XHRzd2l0Y2hlZC5sZW5ndGggPSAwO1xuXHRcdFx0cmVsZWFzZUEoKTtcblx0XHRcdGF3YWl0IGZpcnN0O1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzd2l0Y2hlZCwgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEZvY3VzZWRMZWFmU2Vzc2lvbktleSgpLCBiKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBiKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cmVsZWFzZUEoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2hpZGUgZHVyaW5nIHBhbmUtbGVzcyByZXZlYWwgd2FpdCBkb2VzIG5vdCBzdGVhbCBmb2N1cyBvciB0aGUgYWN0aXZlIHNlc3Npb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy50aW1lb3V0KDE1XzAwMCk7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZUxpZ2h0d2VpZ2h0V2luZG93SGFybmVzcygpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgY29udmVyc2F0aW9uUGFydHMgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgcHJpbWFyeUlkID0gcm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5lbnN1cmVQcmltYXJ5V2luZG93KHByaW1hcnlJZCk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5SWQgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLm9wZW5TZXNzaW9uQmVzaWRlKHNlY29uZGFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShwcmltYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cblx0XHRjb25zdCBzZWNvbmRhcnlQYXJ0ID0gY29udmVyc2F0aW9uUGFydHMuZmluZChwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vjb25kYXJ5SWQpO1xuXHRcdGFzc2VydC5vayhzZWNvbmRhcnlQYXJ0KTtcblx0XHRjb25zdCBncm91cCA9IHNlY29uZGFyeVBhcnQuYWN0aXZlR3JvdXAgYXMgeyBhY3RpdmVFZGl0b3JQYW5lPzogeyBnZXRJZCgpOiBzdHJpbmcgfTsgb25EaWRBY3RpdmVFZGl0b3JDaGFuZ2U/OiBFdmVudDx1bmtub3duPiB9O1xuXHRcdGdyb3VwLmFjdGl2ZUVkaXRvclBhbmUgPSB1bmRlZmluZWQ7XG5cdFx0Z3JvdXAub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UgPSBFdmVudC5Ob25lO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgcHJpbWFyeUlkKTtcblx0XHRjb25zdCBwcmltYXJ5TGVhZiA9IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhwcmltYXJ5SWQpITtcblx0XHRjb25zdCBhY3RpdmVCZWZvcmUgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0YXNzZXJ0Lm9rKFxuXHRcdFx0cHJpbWFyeUxlYWYuY29udGFpbmVyID09PSBhY3RpdmVCZWZvcmUgfHwgcHJpbWFyeUxlYWYuY29udGFpbmVyLmNvbnRhaW5zKGFjdGl2ZUJlZm9yZSksXG5cdFx0XHQncHJpbWFyeSBtdXN0IG93biBmb2N1cyBiZWZvcmUgdGhlIHN0YWxsZWQgcmV2ZWFsJyxcblx0XHQpO1xuXG5cdFx0Y29uc3Qgc3dpdGNoZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgb3JpZ2luYWxTd2l0Y2ggPSByb3N0ZXJTZXJ2aWNlLnN3aXRjaFNlc3Npb24uYmluZChyb3N0ZXJTZXJ2aWNlKTtcblx0XHRyb3N0ZXJTZXJ2aWNlLnN3aXRjaFNlc3Npb24gPSAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHtcblx0XHRcdHN3aXRjaGVkLnB1c2goc2Vzc2lvbklkKTtcblx0XHRcdG9yaWdpbmFsU3dpdGNoKHNlc3Npb25JZCk7XG5cdFx0fTtcblxuXHRcdGxldCBzZXR0bGVkID0gZmFsc2U7XG5cdFx0Y29uc3QgcmV2ZWFsID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhzZWNvbmRhcnlJZCkuZmluYWxseSgoKSA9PiB7IHNldHRsZWQgPSB0cnVlOyB9KTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXR0bGVkLCBmYWxzZSwgJ3JldmVhbCBtdXN0IHN0aWxsIGJlIHdhaXRpbmcgZm9yIGFuIGVkaXRvciBwYW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblxuXHRcdHNlc3Npb25XaW5kb3dTZXJ2aWNlLmhpZGVTZXNzaW9uV2luZG93KHNlY29uZGFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHNlY29uZGFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEZvY3VzZWRMZWFmU2Vzc2lvbktleSgpLCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IGFjdGl2ZUR1cmluZyA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRhc3NlcnQub2soXG5cdFx0XHRwcmltYXJ5TGVhZi5jb250YWluZXIgPT09IGFjdGl2ZUR1cmluZyB8fCBwcmltYXJ5TGVhZi5jb250YWluZXIuY29udGFpbnMoYWN0aXZlRHVyaW5nKSxcblx0XHRcdCdmb2N1cyBtdXN0IHN0YXkgb24gdGhlIHByaW1hcnkgd2hpbGUgdGhlIGhpZGRlbiBsZWFmIGlzIHN0aWxsIHdhaXRpbmcnLFxuXHRcdCk7XG5cblx0XHRhd2FpdCByZXZlYWw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNldHRsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4oc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0Rm9jdXNlZExlYWZTZXNzaW9uS2V5KCksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgYWN0aXZlQWZ0ZXIgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0YXNzZXJ0Lm9rKFxuXHRcdFx0cHJpbWFyeUxlYWYuY29udGFpbmVyID09PSBhY3RpdmVBZnRlciB8fCBwcmltYXJ5TGVhZi5jb250YWluZXIuY29udGFpbnMoYWN0aXZlQWZ0ZXIpLFxuXHRcdFx0J2ZvY3VzIG11c3Qgc3RheSBvbiB0aGUgcHJpbWFyeSBhZnRlciB0aGUgcGFuZSB3YWl0IGVuZHMnLFxuXHRcdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzd2l0Y2hlZCwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCcxMCBTZWxlY3RCb3ggcGF0aCBvbiByZWFsIHBhbmUgY2hhbmdlcyB0aGUgbGVhZiAoUFJELTAwMiAjMSknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHBhcnRzLCBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQub2socGFuZS5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdGF3YWl0IHBhbmUubGVhZlNlc3Npb25CYXJIb3N0IS5zd2l0Y2hMZWFmU2Vzc2lvbihiKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHBhcnRGb3IocGFydHMsIGIpLmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvcik7XG5cdH0pO1xuXG5cdHRlc3QoJzEwIHR3byB2aXNpYmxlIGxlYXZlczogU2VsZWN0Qm94IG9uIG9uZSBsZWFmIHJlcGxhY2VzIHRoYXQgbGVhZiB3aXRoIGEgdGhpcmQgc2Vzc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgcGFydHMsIHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBwcmltYXJ5SWQgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgYiA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0Y29uc3QgYyA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoYik7XG5cdFx0Y29uc3QgcGFuZUIgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXNzZXJ0Lm9rKHBhbmVCLmxlYWZTZXNzaW9uQmFySG9zdCk7XG5cdFx0YXdhaXQgcGFuZUIubGVhZlNlc3Npb25CYXJIb3N0IS5zd2l0Y2hMZWFmU2Vzc2lvbihjKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYyk7XG5cdFx0Y29uc3QgdmlzaWJsZSA9IHZpc2libGVMZWFmS2V5cyhzZXNzaW9uV2luZG93U2VydmljZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpc2libGUubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQub2sodmlzaWJsZS5pbmNsdWRlcyhwcmltYXJ5SWQpLCAndGhlIG90aGVyIGxlYWYgbXVzdCBzdGF5Jyk7XG5cdFx0YXNzZXJ0Lm9rKHZpc2libGUuaW5jbHVkZXMoYyksICd0aGUgb3BlcmF0ZWQgbGVhZiBtdXN0IGJlY29tZSB0aGUgdGhpcmQgc2Vzc2lvbicpO1xuXHRcdGFzc2VydC5vayghdmlzaWJsZS5pbmNsdWRlcyhiKSwgJ3RoZSBvcGVyYXRlZCBsZWFmIG11c3Qgbm90IHJlbWFpbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpLnNlc3Npb25LZXksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRGb3IocGFydHMsIGMpLnNlc3Npb25LZXksIGMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4oYiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBzd2l0Y2hUb1Nlc3Npb24gc3dpdGNoTGVhZlNlc3Npb24gcmVqZWN0cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgcGFuZSA9IGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0Lm9rKHBhbmUubGVhZlNlc3Npb25CYXJIb3N0KTtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3N3aXRjaCBib29tJyk7XG5cdFx0cGFuZS5sZWFmU2Vzc2lvbkJhckhvc3Quc3dpdGNoTGVhZlNlc3Npb24gPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0fTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdHBhbmUubGVhZlNlc3Npb25CYXJIb3N0IS5zd2l0Y2hUb1Nlc3Npb24oJ290aGVyLXNlc3Npb24nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gU2VsZWN0Qm94IGhlbHBlciBzd2l0Y2hUb1Nlc3Npb24gc3dpdGNoTGVhZlNlc3Npb24gcmVqZWN0cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgcGFuZSA9IGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0Lm9rKHBhbmUubGVhZlNlc3Npb25CYXJIb3N0KTtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3N3aXRjaCBib29tJyk7XG5cdFx0cGFuZS5sZWFmU2Vzc2lvbkJhckhvc3Quc3dpdGNoTGVhZlNlc3Npb24gPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0fTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdHN3aXRjaFRvU2Vzc2lvbkhlbHBlcihwYW5lLmxlYWZTZXNzaW9uQmFySG9zdCEsICdvdGhlci1zZXNzaW9uJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NlbGVjdEJveCBoZWxwZXIgc3dpdGNoVG9TZXNzaW9uIGZpcmUtYW5kLWZvcmdldCB2b2lkcyBkb3VibGUtY2F0Y2ggb25VbmV4cGVjdGVkRXJyb3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgX19yZWFkRmlsZUluVGVzdHMoYCR7cHJvY2Vzcy5jd2QoKX0vc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyLnRzYCk7XG5cdFx0Y29uc3QgZG91YmxlQ2F0Y2ggPSAnLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvciknO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoYHZvaWQgaG9zdC5zd2l0Y2hMZWFmU2Vzc2lvbihzZXNzaW9uSWQpJHtkb3VibGVDYXRjaH1gKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzb3VyY2UuaW5jbHVkZXMoJ3ZvaWQgaG9zdC5zd2l0Y2hMZWFmU2Vzc2lvbihzZXNzaW9uSWQpOycpKTtcblx0fSk7XG5cblx0dGVzdCgnMTAgTmV3IFNlc3Npb24gaW4gc3R1YiBwYXRoIGJlY29tZXMgdGhlIG9ubHkgdmlzaWJsZSBsZWFmJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQub2socGFuZS5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdHBhbmUubGVhZlNlc3Npb25CYXJIb3N0IS5jcmVhdGVOZXdTZXNzaW9uKCk7XG5cdFx0Y29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgMzAwMDtcblx0XHRsZXQgbmV3SWQgPSByb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdHdoaWxlIChuZXdJZCA9PT0gcHJpbWFyeUlkICYmIERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRuZXdJZCA9IHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0fVxuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChuZXdJZCwgcHJpbWFyeUlkKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgbmV3SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIG5ld0lkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGlkZUJ1dHRvbihzZXNzaW9uV2luZG93U2VydmljZSwgbmV3SWQpPy5oaWRkZW4sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4ocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJzEzIGVhY2ggdmlzaWJsZSBsZWFmIGhhcyBleGFjdGx5IG9uZSBTZXNzaW9uQmFyIGFuZCB3aW5kb3ctbmF2OyBQYXJ0IHNsb3QgaGFzIG5vbmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBjb252ZXJzYXRpb25QYXJ0LCBwcmltYXJ5SWQgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgYiA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0Y29uc3QgYyA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGMpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBjKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KHByaW1hcnlJZCk7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIHByaW1hcnlJZCk7XG5cdFx0bGV0IGNocm9tZSA9IGNvdW50TGVhZkNocm9tZShzZXNzaW9uV2luZG93U2VydmljZSwgY29udmVyc2F0aW9uUGFydCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFZpc2libGVXaW5kb3dDb3VudCgpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lLmJhcnMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWUubmF2cywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZS5wYXJ0U2xvdEJhcnMsIDApO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoYik7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGNocm9tZSA9IGNvdW50TGVhZkNocm9tZShzZXNzaW9uV2luZG93U2VydmljZSwgY29udmVyc2F0aW9uUGFydCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFZpc2libGVXaW5kb3dDb3VudCgpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lLmJhcnMsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWUubmF2cywgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZS5wYXJ0U2xvdEJhcnMsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCcxM2IgbGVhZiBTZXNzaW9uQmFyIGFuZCBjb250YWluZXIgcmVjZWl2ZSBpcy1uYXJyb3cgd2hlbiBwYW5lIHdpZHRoIGlzIHVuZGVyIDQ1MHB4JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRjb25zdCBsZWFmID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHByaW1hcnlJZCkhO1xuXG5cdFx0cGFuZS5sYXlvdXQobmV3IERpbWVuc2lvbig1MDAsIDYwMCkpO1xuXHRcdGFzc2VydC5vayhsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1tZWRpdW0nKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cblx0XHRwYW5lLmxheW91dChuZXcgRGltZW5zaW9uKDQwMCwgNjAwKSk7XG5cdFx0YXNzZXJ0Lm9rKGxlYWYuc2Vzc2lvbkJhci5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLW5hcnJvdycpKTtcblx0XHRhc3NlcnQub2sobGVhZi5jb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1jb21wYWN0JykpO1xuXG5cdFx0cGFuZS5sYXlvdXQobmV3IERpbWVuc2lvbigyNTAsIDYwMCkpO1xuXHRcdGFzc2VydC5vayhsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKGxlYWYuc2Vzc2lvbkJhci5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLWNvbXBhY3QnKSk7XG5cblx0XHRwYW5lLmxheW91dChuZXcgRGltZW5zaW9uKDk1MCwgNjAwKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLmNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLW5hcnJvdycpKTtcblx0XHRhc3NlcnQub2soIWxlYWYuc2Vzc2lvbkJhci5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLWNvbXBhY3QnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJzE0IHJldmVhbCBtb3VudHMgb3ZlcmxheSBzbyBvcGVuU3ViQWdlbnQgZG9lcyBub3QgdGhyb3cnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCBzZXNzaW9uQ2hhdFNlcnZpY2UsIHJvc3RlclNlcnZpY2UgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgYiA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXdhaXQgc2Vzc2lvbkNoYXRTZXJ2aWNlLm9wZW5TdWJBZ2VudChiLCAndG9vbC1mcm9tLXJldmVhbCcsICdSZXZlYWwgdG9vbCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uQ2hhdFNlcnZpY2UuaXNTdWJBZ2VudERpYWxvZ09wZW4oYiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCcxNSBsYXRlc3Qtd2lucyByZXZlYWwgZW5kcyBvbiBCOyBiaW5kLWZhaWxlZCBzZW50aW5lbCBkb2VzIG5vdCBjcmVhdGUgYSBsZWFmJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IGEgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGNvbnN0IGZpcnN0ID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhhKTtcblx0XHRjb25zdCBzZWNvbmQgPSBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGIpO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtmaXJzdCwgc2Vjb25kXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aXNpYmxlTGVhZktleXMoc2Vzc2lvbldpbmRvd1NlcnZpY2UpLCBbYl0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCBiKTtcblxuXHRcdGNvbnN0IGtleXNCZWZvcmUgPSBbLi4uc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0QWxsTGVhZlNlc3Npb25LZXlzKCldO1xuXHRcdHJvc3RlclNlcnZpY2UuZmlyZUFjdGl2ZVNlc3Npb24oRU5HSU5FX0JJTkRfRkFJTEVEX1NFU1NJT05fSUQpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoWy4uLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpXSwga2V5c0JlZm9yZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhFTkdJTkVfQklORF9GQUlMRURfU0VTU0lPTl9JRCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhwcmltYXJ5SWQpIHx8IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhiKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRGlkRGVsZXRlU2Vzc2lvbiBkaXNwb3NlcyB2aXNpYmxlIGxlYWYgd2hlbiBiaW5kLWZhaWxlZCBza2lwcyByZXZlYWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZUxpZ2h0d2VpZ2h0V2luZG93SGFybmVzcygpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhzZXNzaW9uSWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UpLCBbc2Vzc2lvbklkXSk7XG5cdFx0YXNzZXJ0Lm9rKGhhcm5lc3MuY29udmVyc2F0aW9uUGFydHMuc29tZShwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vzc2lvbklkKSk7XG5cblx0XHRoYXJuZXNzLnJvc3RlclNlcnZpY2UuZmlyZUFjdGl2ZVNlc3Npb24oRU5HSU5FX0JJTkRfRkFJTEVEX1NFU1NJT05fSUQpO1xuXHRcdGhhcm5lc3Mucm9zdGVyU2VydmljZS5maXJlRGVsZXRlZFNlc3Npb24oc2Vzc2lvbklkKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UpLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0UHJpbWFyeVNlc3Npb25LZXkoKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIWhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0QWxsTGVhZlNlc3Npb25LZXlzKCkuaW5jbHVkZXMoc2Vzc2lvbklkKSk7XG5cdFx0YXNzZXJ0Lm9rKCFoYXJuZXNzLmNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHNlc3Npb25JZCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkRpZERlbGV0ZVNlc3Npb24gZGlzcG9zZXMgYSBoaWRkZW4gbGVhZiBhbmQgaXRzIGVkaXRvciBwYXJ0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBwYXJ0cywgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBzZWNvbmRhcnlJZCA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoc2Vjb25kYXJ5SWQpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBzZWNvbmRhcnlJZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5vayhzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMocHJpbWFyeUlkKSk7XG5cdFx0YXNzZXJ0Lm9rKHBhcnRzLmNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHByaW1hcnlJZCkpO1xuXG5cdFx0cm9zdGVyU2VydmljZS5maXJlRGVsZXRlZFNlc3Npb24ocHJpbWFyeUlkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMocHJpbWFyeUlkKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIXBhcnRzLmNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHByaW1hcnlJZCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKHNlc3Npb25XaW5kb3dTZXJ2aWNlKSwgW3NlY29uZGFyeUlkXSk7XG5cdH0pO1xuXG5cdHRlc3QoJzE1IHN0dWItc2VlZCB1bnRpdGxlZCBvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb24gc3RpbGwgcmV2ZWFscycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UgfSA9IGhhcm5lc3M7XG5cdFx0YXNzZXJ0Lm9rKGlzRW5naW5lUm9zdGVyUGxhY2Vob2xkZXJTZXNzaW9uSWQoJ3VudGl0bGVkJykpO1xuXHRcdGFzc2VydC5vayhyb3N0ZXJTZXJ2aWNlLmdldFNlc3Npb25zKCkuc29tZShzZXNzaW9uID0+IHNlc3Npb24uaWQgPT09ICd1bnRpdGxlZCcpKTtcblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKCd1bnRpdGxlZCcpLCB0cnVlKTtcblxuXHRcdHJvc3RlclNlcnZpY2UuZmlyZUFjdGl2ZVNlc3Npb24oJ3VudGl0bGVkJyk7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsICd1bnRpdGxlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKCd1bnRpdGxlZCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGVMZWFmS2V5cyhzZXNzaW9uV2luZG93U2VydmljZSksIFsndW50aXRsZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksICd1bnRpdGxlZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCcxNSByZXZlYWwgY3JlYXRlIGZhaWx1cmUgcm9sbHMgYmFjayBwYXJ0ICsgbGVhZiBhbmQgcmVidWlsZHMgdGhlIHNhbWUga2V5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJvc3RlclNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IFF1aWV0Um9zdGVyU2VydmljZSgpKTtcblx0XHRjb25zdCBncmlkSG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZ3JpZEhvc3QpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IGdyaWRIb3N0LnJlbW92ZSgpIH0pO1xuXG5cdFx0Y29uc3QgY29udmVyc2F0aW9uUGFydHM6IElDb252ZXJzYXRpb25FZGl0b3JQYXJ0W10gPSBbXTtcblx0XHRsZXQgdGhyb3dPbkNyZWF0ZSA9IGZhbHNlO1xuXHRcdGNvbnN0IGVkaXRvckdyb3Vwc1NlcnZpY2UgPSB7XG5cdFx0XHRjcmVhdGVDb252ZXJzYXRpb25FZGl0b3JQYXJ0OiAoX3BhcmVudDogdW5rbm93biwgc2Vzc2lvbktleTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGlmICh0aHJvd09uQ3JlYXRlKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdyZXZlYWwgYm9vbScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHBhcnQgPSB7IHNlc3Npb25LZXksIHdoZW5SZWFkeTogUHJvbWlzZS5yZXNvbHZlKCksIGFjdGl2ZUdyb3VwOiB7IGZvY3VzOiAoKSA9PiB7IH0sIGFjdGl2ZUVkaXRvclBhbmU6IHsgZ2V0SWQ6ICgpID0+IENvbnZlcnNhdGlvbkVkaXRvclBhbmVJZCB9IH0gfSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25FZGl0b3JQYXJ0O1xuXHRcdFx0XHRjb252ZXJzYXRpb25QYXJ0cy5wdXNoKHBhcnQpO1xuXHRcdFx0XHRyZXR1cm4gcGFydDtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlQ29udmVyc2F0aW9uRWRpdG9yUGFydDogKHNlc3Npb25LZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IGNvbnZlcnNhdGlvblBhcnRzLmZpbmRJbmRleChwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vzc2lvbktleSk7XG5cdFx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0Y29udmVyc2F0aW9uUGFydHMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNldEZvY3VzZWRDb252ZXJzYXRpb25MZWFmOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRGb2N1c2VkQ29udmVyc2F0aW9uTGVhZjogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IGNvbnZlcnNhdGlvblBhcnRzKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udmVyc2F0aW9uUGFydHM7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yR3JvdXBzU2VydmljZTtcblxuXHRcdGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBzZXNzaW9uV2luZG93U2VydmljZSA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UoXG5cdFx0XHR7XG5cdFx0XHRcdG9uRGlkQ3JlYXRlU2xvdHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkRm9jdXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGdldFNsb3RzOiAoKSA9PiAoeyBzZXNzaW9uQmFyOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSwgc2Vzc2lvbldpbmRvd0dyaWQ6IGdyaWRIb3N0LCBlZGl0b3JQYXJ0SG9zdDogdW5kZWZpbmVkIH0pLFxuXHRcdFx0XHRzZXRGb2N1c2VkTGVhZkNvbnRhaW5lcjogKCkgPT4geyB9LFxuXHRcdFx0XHRmb2N1czogKCkgPT4geyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25QYXJ0U2VydmljZSxcblx0XHRcdGVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0XHRyb3N0ZXJTZXJ2aWNlLFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKCksXG5cdFx0XHR7XG5cdFx0XHRcdGVycm9yOiAobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IpID0+IHtcblx0XHRcdFx0XHRlcnJvcnMucHVzaCh0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycgPyBtZXNzYWdlIDogZ2V0RXJyb3JNZXNzYWdlKG1lc3NhZ2UpKTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0KSk7XG5cblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGNvbnN0IHByaW1hcnlJZCA9IHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHRhcmdldCA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0dGhyb3dPbkNyZWF0ZSA9IHRydWU7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyh0YXJnZXQpO1xuXG5cdFx0YXNzZXJ0Lm9rKGVycm9ycy5zb21lKGVycm9yID0+IGVycm9yLmluY2x1ZGVzKCdyZXZlYWwgYm9vbScpKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyh0YXJnZXQpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5vayghc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0QWxsTGVhZlNlc3Npb25LZXlzKCkuaW5jbHVkZXModGFyZ2V0KSk7XG5cdFx0YXNzZXJ0Lm9rKCFjb252ZXJzYXRpb25QYXJ0cy5zb21lKHBhcnQgPT4gcGFydC5zZXNzaW9uS2V5ID09PSB0YXJnZXQpKTtcblxuXHRcdHRocm93T25DcmVhdGUgPSBmYWxzZTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KHRhcmdldCk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyh0YXJnZXQpKTtcblx0XHRhc3NlcnQub2soY29udmVyc2F0aW9uUGFydHMuc29tZShwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gdGFyZ2V0KSk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyh0YXJnZXQpPy5jb250YWluZXIuaXNDb25uZWN0ZWQpO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiBvcGVuVHdvTGlnaHR3ZWlnaHRMZWF2ZXMoKSB7XG5cdFx0Y29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVMaWdodHdlaWdodFdpbmRvd0hhcm5lc3MoKTtcblx0XHRoYXJuZXNzLnNldE5vdGlmeUVycm9yKG1lc3NhZ2UgPT4ge1xuXHRcdFx0ZXJyb3JzLnB1c2godHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnID8gbWVzc2FnZSA6IGdldEVycm9yTWVzc2FnZShtZXNzYWdlKSk7XG5cdFx0fSk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRjb25zdCBwcmltYXJ5SWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5lbnN1cmVQcmltYXJ5V2luZG93KHByaW1hcnlJZCk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5SWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZShzZWNvbmRhcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGNvbnN0IGluY29taW5nSWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0cmV0dXJuIHsgaGFybmVzcywgZXJyb3JzLCBwcmltYXJ5SWQsIHNlY29uZGFyeUlkLCBpbmNvbWluZ0lkIH07XG5cdH1cblxuXHR0ZXN0KCdzZWNvbmRhcnkgcmVwbGFjZSBjcmVhdGUgZmFpbHVyZSByZXN0b3JlcyB0aGUgb3V0Z29pbmcgbGVhZiBhbmQgbm90aWZpZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBoYXJuZXNzLCBlcnJvcnMsIHByaW1hcnlJZCwgc2Vjb25kYXJ5SWQsIGluY29taW5nSWQgfSA9IGF3YWl0IG9wZW5Ud29MaWdodHdlaWdodExlYXZlcygpO1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnRzIH0gPSBoYXJuZXNzO1xuXHRcdGhhcm5lc3Muc2V0VGhyb3dPbkNyZWF0ZSh0cnVlKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGluY29taW5nSWQsIHsgcmVwbGFjZTogc2Vjb25kYXJ5SWQgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhpbmNvbWluZ0lkKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIXNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpLmluY2x1ZGVzKGluY29taW5nSWQpKTtcblx0XHRhc3NlcnQub2soIWNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IGluY29taW5nSWQpKTtcblx0XHRhc3NlcnQub2soZXJyb3JzLnNvbWUoZXJyb3IgPT4gZXJyb3IuaW5jbHVkZXMoJ3JldmVhbCBib29tJykpKTtcblx0fSk7XG5cblx0dGVzdCgnc2Vjb25kYXJ5IHJlcGxhY2Ugd2hlblJlYWR5IGZhaWx1cmUgcmVzdG9yZXMgdGhlIG91dGdvaW5nIGxlYWYgYW5kIG5vdGlmaWVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgaGFybmVzcywgZXJyb3JzLCBwcmltYXJ5SWQsIHNlY29uZGFyeUlkLCBpbmNvbWluZ0lkIH0gPSBhd2FpdCBvcGVuVHdvTGlnaHR3ZWlnaHRMZWF2ZXMoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCBjb252ZXJzYXRpb25QYXJ0cyB9ID0gaGFybmVzcztcblx0XHRoYXJuZXNzLnNldFJlamVjdFdoZW5SZWFkeSh0cnVlKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGluY29taW5nSWQsIHsgcmVwbGFjZTogc2Vjb25kYXJ5SWQgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhpbmNvbWluZ0lkKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIXNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpLmluY2x1ZGVzKGluY29taW5nSWQpKTtcblx0XHRhc3NlcnQub2soIWNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IGluY29taW5nSWQpKTtcblx0XHRhc3NlcnQub2soZXJyb3JzLnNvbWUoZXJyb3IgPT4gZXJyb3IuaW5jbHVkZXMoJ3doZW5SZWFkeSBib29tJykpKTtcblx0fSk7XG5cblx0dGVzdCgncHJpbWFyeSByZXBsYWNlIGNyZWF0ZSBmYWlsdXJlIGRvZXMgbm90IGhpZGUgdGhlIG9sZCBwcmltYXJ5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgaGFybmVzcywgZXJyb3JzLCBwcmltYXJ5SWQsIHNlY29uZGFyeUlkLCBpbmNvbWluZ0lkIH0gPSBhd2FpdCBvcGVuVHdvTGlnaHR3ZWlnaHRMZWF2ZXMoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlIH0gPSBoYXJuZXNzO1xuXHRcdGhhcm5lc3Muc2V0VGhyb3dPbkNyZWF0ZSh0cnVlKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGluY29taW5nSWQsIHsgcmVwbGFjZTogcHJpbWFyeUlkIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd0hpZGRlbihwcmltYXJ5SWQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0UHJpbWFyeVNlc3Npb25LZXkoKSwgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMoaW5jb21pbmdJZCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKCFzZXNzaW9uV2luZG93U2VydmljZS5nZXRBbGxMZWFmU2Vzc2lvbktleXMoKS5pbmNsdWRlcyhpbmNvbWluZ0lkKSk7XG5cdFx0YXNzZXJ0Lm9rKGVycm9ycy5zb21lKGVycm9yID0+IGVycm9yLmluY2x1ZGVzKCdyZXZlYWwgYm9vbScpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJzE3IGhpZGluZyBhIGxlYWYgcmVsZWFzZXMgaXRzIGxlbnMgbGVhc2UgYW5kIHJlc3RvcmUgcmVhY3F1aXJlcyBpdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgcGFydHMsIHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBwcmltYXJ5SWQsIHNlc3Npb25DaGF0U2VydmljZSB9ID0gaGFybmVzcztcblx0XHRhd2FpdCBzZXNzaW9uQ2hhdFNlcnZpY2Uub3BlbkV4dGVuc2lvblRhYihwcmltYXJ5SWQsICdmb3JrLWxlYXNlJywgeyB0aXRsZTogJ0ZvcmsgbGVhc2UnIH0pO1xuXHRcdGNvbnN0IHBhbmVBID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgcGFydEEgPSBwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHRhYkNvdW50ID0gcGFydEEuYWN0aXZlR3JvdXAuY291bnQ7XG5cdFx0YXNzZXJ0Lm9rKHRhYkNvdW50ID49IDIpO1xuXHRcdGFzc2VydC5vayhwYW5lQS5hY3RpdmVDb252ZXJzYXRpb25MZW5zKTtcblxuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3coYik7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4ocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRBLmFjdGl2ZUdyb3VwLmNvdW50LCB0YWJDb3VudCk7XG5cdFx0Y29uc3QgaGlkZGVuTGVuc2VzID0gYXdhaXQgY29sbGVjdExlYWZDb252ZXJzYXRpb25MZW5zZXMocGFydEEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoaWRkZW5MZW5zZXMubGVuZ3RoLCB0YWJDb3VudCk7XG5cdFx0Zm9yIChjb25zdCBsZW5zIG9mIGhpZGRlbkxlbnNlcykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRBLnNlc3Npb25LZXksIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgaGlkZGVuTGVhZiA9IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhwcmltYXJ5SWQpPy5jb250YWluZXI7XG5cdFx0YXNzZXJ0Lm9rKGhpZGRlbkxlYWY/LmNsYXNzTGlzdC5jb250YWlucyhjb252ZXJzYXRpb25TZXNzaW9uTGVhZkhpZGRlbkNsYXNzKSk7XG5cdFx0Y29uc3Qgc3RhbGVCYW5uZXIgPSBoaWRkZW5MZWFmPy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc3RhbGUtc25hcHNob3QnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKCFzdGFsZUJhbm5lciB8fCBzdGFsZUJhbm5lci5oaWRkZW4gfHwgIXN0YWxlQmFubmVyLnRleHRDb250ZW50KTtcblxuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3cocHJpbWFyeUlkKTtcblx0XHRjb25zdCBwYW5lQTIgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRjb25zdCByZXN0b3JlZExlbnNlcyA9IGF3YWl0IGNvbGxlY3RMZWFmQ29udmVyc2F0aW9uTGVuc2VzKHBhcnRGb3IocGFydHMsIHByaW1hcnlJZCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlZExlbnNlcy5sZW5ndGgsIHRhYkNvdW50KTtcblx0XHRmb3IgKGNvbnN0IGxlbnMgb2YgcmVzdG9yZWRMZW5zZXMpIHtcblx0XHRcdGFzc2VydC5vayhsZW5zLnNlc3Npb25WaWV3TGVhc2UsICdyZXN0b3JlIG11c3QgcmVhY3F1aXJlIHNlc3Npb25WaWV3TGVhc2Ugb24gZXZlcnkgbGVhZiBsZW5zJyk7XG5cdFx0fVxuXHRcdGFzc2VydC5vayhwYW5lQTIuYWN0aXZlQ29udmVyc2F0aW9uTGVucz8uc2Vzc2lvblZpZXdMZWFzZSwgJ3Jlc3RvcmUgbXVzdCByZWFjcXVpcmUgc2Vzc2lvblZpZXdMZWFzZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb24gcmV2ZWFsIGNhdGNoLXBhdGggbm90aWNlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdC8vIHJldmVhbFNlc3Npb25XaW5kb3cgYWxyZWFkeSBjYXRjaGVzIGNyZWF0ZSB0aHJvdzsgYSBsb25lIGlubmVyIHJlamVjdCBkb2VzIG5vdCBsZWFrLlxuXHRcdC8vIFRoZSB2b2lkIG9uRGlkQ2hhbmdlQWN0aXZlU2Vzc2lvbiBjYWxsIHNpdGUgc3RpbGwgbmVlZHMgYC5jYXRjaGAgd2hlbiB0aGUgY2F0Y2gtcGF0aCBub3RpY2UgdGhyb3dzLlxuXHRcdC8vIEEgbG9uZSBgLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKWAgc3RpbGwgbGVha3Mgd2hlbiB0aGUgaGFuZGxlciB3YXJuLXRoZW4tcmV0aHJvd3MuXG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZUxpZ2h0d2VpZ2h0V2luZG93SGFybmVzcygpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0Y29uc3QgcHJpbWFyeUlkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGhhcm5lc3Mucm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRoYXJuZXNzLnNldFRocm93T25DcmVhdGUodHJ1ZSk7XG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRoYXJuZXNzLnNldE5vdGlmeUVycm9yKCgpID0+IHtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fSk7XG5cdFx0XHRoYXJuZXNzLnJvc3RlclNlcnZpY2UuZmlyZUFjdGl2ZVNlc3Npb24odGFyZ2V0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gYXR0YWNoR3JpZCBwZW5kaW5nIHJldmVhbCBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHQvLyByZXZlYWxTZXNzaW9uV2luZG93IGFscmVhZHkgY2F0Y2hlcyBjcmVhdGUgdGhyb3c7IGEgbG9uZSBpbm5lciByZWplY3QgZG9lcyBub3QgbGVhay5cblx0XHQvLyBUaGUgdm9pZCBhdHRhY2hHcmlkIHBlbmRpbmcgY2FsbCBzaXRlIHN0aWxsIG5lZWRzIGAuY2F0Y2hgIHdoZW4gdGhlIGNhdGNoLXBhdGggbm90aWNlIHRocm93cy5cblx0XHQvLyBBIGxvbmUgYC5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcilgIHN0aWxsIGxlYWtzIHdoZW4gdGhlIGhhbmRsZXIgd2Fybi10aGVuLXJldGhyb3dzLlxuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVMaWdodHdlaWdodFdpbmRvd0hhcm5lc3MoeyBkZWxheVNsb3RzOiB0cnVlIH0pO1xuXHRcdGNvbnN0IHRhcmdldCA9IGhhcm5lc3Mucm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRoYXJuZXNzLnNldFRocm93T25DcmVhdGUodHJ1ZSk7XG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRoYXJuZXNzLnNldE5vdGlmeUVycm9yKCgpID0+IHtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fSk7XG5cdFx0XHR2b2lkIGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyh0YXJnZXQsIHsgcmVwbGFjZTogaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpIH0pO1xuXHRcdFx0aGFybmVzcy5hdHRhY2hTbG90cygpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXNzaW9uIHdpbmRvdyBmaXJlLWFuZC1mb3JnZXQgdm9pZHMgZG91YmxlLWNhdGNoIG9uVW5leHBlY3RlZEVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25TZXNzaW9uV2luZG93U2VydmljZS50c2ApO1xuXHRcdGNvbnN0IGRvdWJsZUNhdGNoID0gJy5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpJztcblx0XHRhc3NlcnQub2soc291cmNlLmluY2x1ZGVzKGB2b2lkIHRoaXMucmV2ZWFsU2Vzc2lvbldpbmRvdyhzZXNzaW9uS2V5KSR7ZG91YmxlQ2F0Y2h9YCkpO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoYHZvaWQgdGhpcy5yZXZlYWxTZXNzaW9uV2luZG93KHBlbmRpbmcuc2Vzc2lvbktleSwgcGVuZGluZy5vcHRpb25zKSR7ZG91YmxlQ2F0Y2h9YCkpO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoYHZvaWQgdGhpcy5lbnN1cmVQcmltYXJ5V2luZG93KHRoaXMucm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSkke2RvdWJsZUNhdGNofWApKTtcblx0XHRhc3NlcnQub2soIXNvdXJjZS5pbmNsdWRlcygndm9pZCB0aGlzLnJldmVhbFNlc3Npb25XaW5kb3coc2Vzc2lvbktleSk7JykpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIHRoaXMucmV2ZWFsU2Vzc2lvbldpbmRvdyhwZW5kaW5nLnNlc3Npb25LZXksIHBlbmRpbmcub3B0aW9ucyk7JykpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIHRoaXMuZW5zdXJlUHJpbWFyeVdpbmRvdyh0aGlzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCkpOycpKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVcsd0JBQXdCO0FBQzVDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCLGFBQWEsZUFBZTtBQUN0RCxTQUFTLGNBQWMsaUJBQWlCLGlDQUFpQztBQUN6RSxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQTZCLG9CQUFvQjtBQUMxRCxTQUFTLCtDQUErQztBQUN4RCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGFBQWEsc0JBQXNCO0FBRTVDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCLGdDQUE4RDtBQUN6RixTQUFrQyw0QkFBNEI7QUFDOUQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBZ0Q7QUFDekQsU0FBUyxtQkFBbUIsb0JBQW9CLHFCQUFxQixxQ0FBcUM7QUFDMUcsU0FBUyw2QkFBNkI7QUFDdEMsT0FBTztBQUNQLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsMkNBQTJDO0FBQ3BELFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsK0JBQStCLHNDQUFzQztBQUM5RSxTQUFTLGdDQUFnQyx1Q0FBdUM7QUFDaEYsU0FBUyxtQkFBbUIsNkJBQTZCO0FBQ3pELFNBQVMsa0NBQWtDLHlDQUF5QztBQUNwRixTQUFTLHlCQUF5QixrQ0FBa0M7QUFDcEUsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxpQ0FBaUMsK0JBQStCLDBDQUEwQztBQUNuSCxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLDBCQUEwQixpQ0FBaUM7QUFDcEUsU0FBUywyQkFBMkI7QUFFcEMsU0FBUywwQkFBMEIsMENBQTBDO0FBQzdFLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsZ0NBQWdDO0FBSXpDLFNBQVMs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
