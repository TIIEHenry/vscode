import assert from "assert";
import { Dimension, getActiveElement } from "../../../../../base/browser/dom.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { timeout } from "../../../../../base/common/async.js";
import { errorHandler, getErrorMessage, setUnexpectedErrorHandler } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
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
import { ENGINE_BIND_FAILED_SESSION_ID, isEngineRosterPlaceholderSessionId } from "../../browser/conversationEngineRosterService.js";
import { ConversationEditorPaneId, conversationSessionLeafHiddenClass } from "../../common/conversationSessionWindow.js";
import { UA_CLIENT_CHAT_INPUT_AUTO_FOCUS } from "../../common/uaClientSettingsKeys.js";
import { IUniverseAgentConnection } from "../../../../../platform/universeAgent/common/universeAgentConnection.js";
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
    const rosterService = store.add(new QuietRosterService());
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
    instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
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
    await waitForPane(primaryPart, openErrors, parts);
    layoutParts(parts);
    trackEditors(parts);
    return { instantiationService, parts, conversationPart, rosterService, sessionWindowService, sessionChatService, primaryId, openErrors };
  }
  async function waitForSessionPane(harness, sessionKey) {
    return waitForPane(partFor(harness.parts, sessionKey), harness.openErrors, harness.parts);
  }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi90ZXN0L2Jyb3dzZXIvY29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1JldmVhbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGltZW5zaW9uLCBnZXRBY3RpdmVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgZXJyb3JIYW5kbGVyLCBnZXRFcnJvck1lc3NhZ2UsIHNldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uUGFydCwgSUNvbnZlcnNhdGlvblBhcnRTZXJ2aWNlLCBJQ29udmVyc2F0aW9uUGFydFdpbmRvd1Nsb3RzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9jb252ZXJzYXRpb24vY29udmVyc2F0aW9uUGFydC5qcyc7XG5pbXBvcnQgeyBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCwgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9icm93c2VyL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9ucywgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgY3JlYXRlRWRpdG9yUGFydHMsIHJlZ2lzdGVyVGVzdEVkaXRvciwgVGVzdEZpbGVFZGl0b3JJbnB1dCwgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFNpZGVCeVNpZGVFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3Ivc2lkZUJ5U2lkZUVkaXRvcklucHV0LmpzJztcbmltcG9ydCAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25FZGl0b3IuY29udHJpYnV0aW9uLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbkVkaXRvclBhbmUgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkVkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uU2Vzc2lvbkNoYXRDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25DaGF0LmNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25OYXZpZ2F0aW9uQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25OYXZpZ2F0aW9uLmNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25OYXZpZ2F0aW9uU2VydmljZSwgSUNvbnZlcnNhdGlvbk5hdmlnYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25OYXZpZ2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25TZXNzaW9uQ2hhdFNlcnZpY2UsIElDb252ZXJzYXRpb25TZXNzaW9uQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25DaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBzd2l0Y2hUb1Nlc3Npb24gYXMgc3dpdGNoVG9TZXNzaW9uSGVscGVyIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhci5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25TZXNzaW9uV2luZG93U2VydmljZSwgSUNvbnZlcnNhdGlvblNlc3Npb25XaW5kb3dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25TZXNzaW9uV2luZG93U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25TdHViU2VydmljZSwgSUNvbnZlcnNhdGlvblJvc3RlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblN0dWJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb252ZXJzYXRpb25UaW1lbGluZVJldmVhbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblRpbWVsaW5lUmV2ZWFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udmVyc2F0aW9uUmV2aWV3TmF2U2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uUmV2aWV3RW50cnkuanMnO1xuaW1wb3J0IHsgRU5HSU5FX0JJTkRfRkFJTEVEX1NFU1NJT05fSUQsIGlzRW5naW5lUm9zdGVyUGxhY2Vob2xkZXJTZXNzaW9uSWQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkVuZ2luZVJvc3RlclNlcnZpY2UuanMnO1xuaW1wb3J0IHR5cGUgeyBDb252ZXJzYXRpb25MZW5zIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbkVkaXRvclBhbmVJZCwgY29udmVyc2F0aW9uU2Vzc2lvbkxlYWZIaWRkZW5DbGFzcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb252ZXJzYXRpb25TZXNzaW9uV2luZG93LmpzJztcbmltcG9ydCB7IFVBX0NMSUVOVF9DSEFUX0lOUFVUX0FVVE9fRk9DVVMgfSBmcm9tICcuLi8uLi9jb21tb24vdWFDbGllbnRTZXR0aW5nc0tleXMuanMnO1xuaW1wb3J0IHsgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHsgY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViIH0gZnJvbSAnLi4vY29tbW9uL2NvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yi5qcyc7XG5pbXBvcnQgeyBzdHViQ29udmVyc2F0aW9uVGltZWxpbmVMaW5rU2VydmljZXMgfSBmcm9tICcuL2NvbnZlcnNhdGlvblRpbWVsaW5lTGlua1Rlc3RTdHVicy5qcyc7XG5pbXBvcnQgeyBpbnN0YWxsQ29udmVyc2F0aW9uTGVuc1Jlc2l6ZU9ic2VydmVySGFybmVzcyB9IGZyb20gJy4vY29udmVyc2F0aW9uTGVuc0xheW91dEhhcm5lc3MuanMnO1xuaW1wb3J0IHsgSUV4cGxvcmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2ZpbGVzL2Jyb3dzZXIvZmlsZXMuanMnO1xuaW1wb3J0IHsgSVNDTVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zY20vY29tbW9uL3NjbS5qcyc7XG5cbmRlY2xhcmUgZnVuY3Rpb24gX19yZWFkRmlsZUluVGVzdHMocGF0aDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+O1xuXG5jbGFzcyBRdWlldFJvc3RlclNlcnZpY2UgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdHNlZWRTZXNzaW9uUXVpZXRseSgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHByZXZpb3VzID0gdGhpcy5tb2RlbC5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSB0aGlzLm1vZGVsLmNyZWF0ZVNlc3Npb24oKTtcblx0XHR0aGlzLm1vZGVsLnN3aXRjaFNlc3Npb24ocHJldmlvdXMpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdFx0cmV0dXJuIHNlc3Npb25JZDtcblx0fVxuXG5cdGZpcmVBY3RpdmVTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uLmZpcmUoc2Vzc2lvbklkKTtcblx0fVxuXG5cdGZpcmVEZWxldGVkU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkRGVsZXRlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdH1cbn1cblxuc3VpdGUoJ0NvbnZlcnNhdGlvbiBzZXNzaW9uIHdpbmRvdyByZXZlYWwgKyBsZWFmIFNlc3Npb25CYXIgKEMpJywgKCkgPT4ge1xuXG5cdGNvbnN0IFRFU1RfRURJVE9SX0lEID0gJ015RmlsZUVkaXRvckZvckNvbnZlcnNhdGlvblJldmVhbCc7XG5cdGNvbnN0IFRFU1RfRURJVE9SX0lOUFVUX0lEID0gJ3Rlc3RFZGl0b3JJbnB1dEZvckNvbnZlcnNhdGlvblJldmVhbCc7XG5cblx0aW5zdGFsbENvbnZlcnNhdGlvbkxlbnNSZXNpemVPYnNlcnZlckhhcm5lc3MoKTtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IHN0b3JlIGFzIHVua25vd24gYXMgRGlzcG9zYWJsZVN0b3JlO1xuXG5cdHRlYXJkb3duKGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IG1haW5XaW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IG1haW5XaW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHJlc29sdmUoKSkpKTtcblx0fSk7XG5cblx0c2V0dXAoZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgyMF8wMDApO1xuXHRcdHN0b3JlLmFkZChyZWdpc3RlclRlc3RFZGl0b3IoVEVTVF9FRElUT1JfSUQsIFtuZXcgU3luY0Rlc2NyaXB0b3IoVGVzdEZpbGVFZGl0b3JJbnB1dCksIG5ldyBTeW5jRGVzY3JpcHRvcihTaWRlQnlTaWRlRWRpdG9ySW5wdXQpXSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gbGF5b3V0UGFydHMocGFydHM6IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlRWRpdG9yUGFydHM+Pik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cy5jb252ZXJzYXRpb25QYXJ0cykge1xuXHRcdFx0cGFydC5sYXlvdXQoODAwLCA2MDAsIDAsIDApO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHRyYWNrRWRpdG9ycyhwYXJ0czogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVFZGl0b3JQYXJ0cz4+KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBwYXJ0IG9mIHBhcnRzLmNvbnZlcnNhdGlvblBhcnRzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBwYXJ0LmFjdGl2ZUdyb3VwLmVkaXRvcnMpIHtcblx0XHRcdFx0c3RvcmUuYWRkKGVkaXRvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gd2FpdEZvclBhbmUocGFydDogSUNvbnZlcnNhdGlvbkVkaXRvclBhcnQsIG9wZW5FcnJvcnM6IHVua25vd25bXSA9IFtdLCBwYXJ0cz86IEF3YWl0ZWQ8UmV0dXJuVHlwZTx0eXBlb2YgY3JlYXRlRWRpdG9yUGFydHM+Pik6IFByb21pc2U8Q29udmVyc2F0aW9uRWRpdG9yUGFuZT4ge1xuXHRcdGF3YWl0IHBhcnQud2hlblJlYWR5O1xuXHRcdGNvbnN0IGRlYWRsaW5lID0gRGF0ZS5ub3coKSArIDMwMDA7XG5cdFx0d2hpbGUgKERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuXHRcdFx0Y29uc3QgcGFuZSA9IHBhcnQuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdGlmIChwYW5lIGluc3RhbmNlb2YgQ29udmVyc2F0aW9uRWRpdG9yUGFuZSkge1xuXHRcdFx0XHRpZiAocGFydHMpIHtcblx0XHRcdFx0XHR0cmFja0VkaXRvcnMocGFydHMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBwYW5lO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0fVxuXHRcdGNvbnN0IGRldGFpbCA9IG9wZW5FcnJvcnMubWFwKGVycm9yID0+IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA/PyBlcnJvci5tZXNzYWdlIDogU3RyaW5nKGVycm9yKSkuam9pbignXFxuJyk7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDb252ZXJzYXRpb25FZGl0b3JQYW5lIG5vdCByZWFkeSBmb3IgJHtwYXJ0LnNlc3Npb25LZXl9OyBnb3QgJHtwYXJ0LmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvclBhbmU/LmdldElkKCl9JHtkZXRhaWwgPyBgXFxuJHtkZXRhaWx9YCA6ICcnfWApO1xuXHR9XG5cblx0ZnVuY3Rpb24gcGFydEZvcihwYXJ0czogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVFZGl0b3JQYXJ0cz4+LCBzZXNzaW9uS2V5OiBzdHJpbmcpOiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCB7XG5cdFx0Y29uc3QgcGFydCA9IHBhcnRzLmNvbnZlcnNhdGlvblBhcnRzLmZpbmQoY2FuZGlkYXRlID0+IGNhbmRpZGF0ZS5zZXNzaW9uS2V5ID09PSBzZXNzaW9uS2V5KTtcblx0XHRhc3NlcnQub2socGFydCwgYG1pc3NpbmcgcGFydCAke3Nlc3Npb25LZXl9YCk7XG5cdFx0cmV0dXJuIHBhcnQ7XG5cdH1cblxuXHRmdW5jdGlvbiB2aXNpYmxlTGVhZktleXMod2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIFsuLi53aW5kb3dTZXJ2aWNlLmdldFZpc2libGVTZXNzaW9uS2V5cygpXTtcblx0fVxuXG5cdGZ1bmN0aW9uIGhpZGVCdXR0b24od2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UsIHNlc3Npb25LZXk6IHN0cmluZyk6IEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCB7XG5cdFx0cmV0dXJuIHdpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHNlc3Npb25LZXkpPy5zZXNzaW9uQmFyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tc2Vzc2lvbi1sZWFmLWhpZGUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb206IEVycm9yLCBydW46ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gQSBsb25lIGAuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpYCBzdGlsbCBsZWFrcyB3aGVuIHRoZSBoYW5kbGVyIHdhcm4tdGhlbi1yZXRocm93cy5cblx0XHRjb25zdCB1bmV4cGVjdGVkV2FybnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IHVuaGFuZGxlZFJlamVjdGlvbnM6IHVua25vd25bXSA9IFtdO1xuXHRcdGNvbnN0IG9uVW5oYW5kbGVkUmVqZWN0aW9uID0gKHJlYXNvbjogdW5rbm93bikgPT4gdW5oYW5kbGVkUmVqZWN0aW9ucy5wdXNoKHJlYXNvbik7XG5cdFx0cHJvY2Vzcy5vbigndW5oYW5kbGVkUmVqZWN0aW9uJywgb25VbmhhbmRsZWRSZWplY3Rpb24pO1xuXHRcdGNvbnN0IG9yaWdpbmFsRXJyb3JIYW5kbGVyID0gZXJyb3JIYW5kbGVyLmdldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKTtcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKGVycm9yID0+IHtcblx0XHRcdHVuZXhwZWN0ZWRXYXJucy5wdXNoKGVycm9yKTtcblx0XHRcdGlmICh1bmV4cGVjdGVkV2FybnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBydW4oKTtcblx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHsgdW5oYW5kbGVkUmVqZWN0aW9ucywgdW5leHBlY3RlZFdhcm5zIH0sIHtcblx0XHRcdFx0dW5oYW5kbGVkUmVqZWN0aW9uczogW10sXG5cdFx0XHRcdHVuZXhwZWN0ZWRXYXJuczogW3BhaW50Qm9vbSwgcGFpbnRCb29tXSxcblx0XHRcdH0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKG9yaWdpbmFsRXJyb3JIYW5kbGVyKTtcblx0XHRcdHByb2Nlc3Mub2ZmKCd1bmhhbmRsZWRSZWplY3Rpb24nLCBvblVuaGFuZGxlZFJlamVjdGlvbik7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlTGlnaHR3ZWlnaHRXaW5kb3dIYXJuZXNzKG9wdGlvbnM/OiB7IGRlbGF5U2xvdHM/OiBib29sZWFuIH0pIHtcblx0XHRjb25zdCByb3N0ZXJTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBRdWlldFJvc3RlclNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgZ3JpZEhvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGdyaWRIb3N0KTtcblx0XHRzdG9yZS5hZGQoeyBkaXNwb3NlOiAoKSA9PiBncmlkSG9zdC5yZW1vdmUoKSB9KTtcblxuXHRcdGNvbnN0IG9uRGlkQ3JlYXRlU2xvdHMgPSBuZXcgRW1pdHRlcjxJQ29udmVyc2F0aW9uUGFydFdpbmRvd1Nsb3RzPigpO1xuXHRcdHN0b3JlLmFkZChvbkRpZENyZWF0ZVNsb3RzKTtcblxuXHRcdGxldCB0aHJvd09uQ3JlYXRlID0gZmFsc2U7XG5cdFx0bGV0IHJlamVjdFdoZW5SZWFkeSA9IGZhbHNlO1xuXHRcdGNvbnN0IGNvbnZlcnNhdGlvblBhcnRzOiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydFtdID0gW107XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IHtcblx0XHRcdGNyZWF0ZUNvbnZlcnNhdGlvbkVkaXRvclBhcnQ6IChfcGFyZW50OiB1bmtub3duLCBzZXNzaW9uS2V5OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0aWYgKHRocm93T25DcmVhdGUpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3JldmVhbCBib29tJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGV0IHdoZW5SZWFkeTogUHJvbWlzZTx2b2lkPiA9IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0XHRpZiAocmVqZWN0V2hlblJlYWR5KSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVqZWN0ZWQgPSBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ3doZW5SZWFkeSBib29tJykpO1xuXHRcdFx0XHRcdC8vIEtlZXAgdGhlIHJlamVjdGlvbiBvYnNlcnZlZC4gQXdhaXRlcnMgc3RpbGwgcmVqZWN0LlxuXHRcdFx0XHRcdHZvaWQgcmVqZWN0ZWQuY2F0Y2goKCkgPT4geyB9KTtcblx0XHRcdFx0XHR3aGVuUmVhZHkgPSByZWplY3RlZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBwYXJ0ID0geyBzZXNzaW9uS2V5LCB3aGVuUmVhZHksIGFjdGl2ZUdyb3VwOiB7IGZvY3VzOiAoKSA9PiB7IH0sIGFjdGl2ZUVkaXRvclBhbmU6IHsgZ2V0SWQ6ICgpID0+IENvbnZlcnNhdGlvbkVkaXRvclBhbmVJZCB9IH0gfSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25FZGl0b3JQYXJ0O1xuXHRcdFx0XHRjb252ZXJzYXRpb25QYXJ0cy5wdXNoKHBhcnQpO1xuXHRcdFx0XHRyZXR1cm4gcGFydDtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlQ29udmVyc2F0aW9uRWRpdG9yUGFydDogKHNlc3Npb25LZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IGNvbnZlcnNhdGlvblBhcnRzLmZpbmRJbmRleChwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vzc2lvbktleSk7XG5cdFx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0Y29udmVyc2F0aW9uUGFydHMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNldEZvY3VzZWRDb252ZXJzYXRpb25MZWFmOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRGb2N1c2VkQ29udmVyc2F0aW9uTGVhZjogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IGNvbnZlcnNhdGlvblBhcnRzKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udmVyc2F0aW9uUGFydHM7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yR3JvdXBzU2VydmljZTtcblxuXHRcdGxldCBvbk5vdGlmeUVycm9yOiAoKG1lc3NhZ2U6IHN0cmluZyB8IEVycm9yKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzZXNzaW9uV2luZG93U2VydmljZSA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UoXG5cdFx0XHR7XG5cdFx0XHRcdG9uRGlkQ3JlYXRlU2xvdHM6IG9uRGlkQ3JlYXRlU2xvdHMuZXZlbnQsXG5cdFx0XHRcdG9uRGlkRm9jdXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGdldFNsb3RzOiAoKSA9PiBvcHRpb25zPy5kZWxheVNsb3RzXG5cdFx0XHRcdFx0PyB1bmRlZmluZWRcblx0XHRcdFx0XHQ6IHsgc2Vzc2lvbkJhcjogZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksIHNlc3Npb25XaW5kb3dHcmlkOiBncmlkSG9zdCwgZWRpdG9yUGFydEhvc3Q6IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHRzZXRGb2N1c2VkTGVhZkNvbnRhaW5lcjogKCkgPT4geyB9LFxuXHRcdFx0XHRmb2N1czogKCkgPT4geyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25QYXJ0U2VydmljZSxcblx0XHRcdGVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0XHRyb3N0ZXJTZXJ2aWNlLFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKCksXG5cdFx0XHR7XG5cdFx0XHRcdGVycm9yOiAobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IpID0+IHtcblx0XHRcdFx0XHRvbk5vdGlmeUVycm9yPy4obWVzc2FnZSk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9IGFzIElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdCkpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlc3Npb25XaW5kb3dTZXJ2aWNlLFxuXHRcdFx0cm9zdGVyU2VydmljZSxcblx0XHRcdGNvbnZlcnNhdGlvblBhcnRzLFxuXHRcdFx0c2V0VGhyb3dPbkNyZWF0ZSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdFx0XHR0aHJvd09uQ3JlYXRlID0gdmFsdWU7XG5cdFx0XHR9LFxuXHRcdFx0c2V0UmVqZWN0V2hlblJlYWR5KHZhbHVlOiBib29sZWFuKSB7XG5cdFx0XHRcdHJlamVjdFdoZW5SZWFkeSA9IHZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHNldE5vdGlmeUVycm9yKGhhbmRsZXI6IChtZXNzYWdlOiBzdHJpbmcgfCBFcnJvcikgPT4gdm9pZCkge1xuXHRcdFx0XHRvbk5vdGlmeUVycm9yID0gaGFuZGxlcjtcblx0XHRcdH0sXG5cdFx0XHRhdHRhY2hTbG90cygpIHtcblx0XHRcdFx0b25EaWRDcmVhdGVTbG90cy5maXJlKHtcblx0XHRcdFx0XHRzZXNzaW9uQmFyOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcblx0XHRcdFx0XHRzZXNzaW9uV2luZG93R3JpZDogZ3JpZEhvc3QsXG5cdFx0XHRcdFx0ZWRpdG9yUGFydEhvc3Q6IHVuZGVmaW5lZCxcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBjb2xsZWN0TGVhZkNvbnZlcnNhdGlvbkxlbnNlcyhwYXJ0OiBJQ29udmVyc2F0aW9uRWRpdG9yUGFydCk6IFByb21pc2U8Q29udmVyc2F0aW9uTGVuc1tdPiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXHRcdGNvbnN0IGxlbnNlczogQ29udmVyc2F0aW9uTGVuc1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZ3JvdXAuZWRpdG9ycykge1xuXHRcdFx0YXdhaXQgZ3JvdXAub3BlbkVkaXRvcihlZGl0b3IpO1xuXHRcdFx0Y29uc3QgcGFuZSA9IGdyb3VwLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRhc3NlcnQub2socGFuZSBpbnN0YW5jZW9mIENvbnZlcnNhdGlvbkVkaXRvclBhbmUsIGBtaXNzaW5nIENvbnZlcnNhdGlvbkVkaXRvclBhbmUgZm9yICR7ZWRpdG9yLnJlc291cmNlfWApO1xuXHRcdFx0Y29uc3QgbGVucyA9IHBhbmUuYWN0aXZlQ29udmVyc2F0aW9uTGVucztcblx0XHRcdGFzc2VydC5vayhsZW5zLCBgZWFjaCBjb252ZXJzYXRpb24gdGFiIG11c3QgZXhwb3NlIGEgQ29udmVyc2F0aW9uTGVucyAoJHtlZGl0b3IucmVzb3VyY2V9KWApO1xuXHRcdFx0bGVuc2VzLnB1c2gobGVucyk7XG5cdFx0fVxuXHRcdHJldHVybiBsZW5zZXM7XG5cdH1cblxuXHRmdW5jdGlvbiBjb3VudExlYWZDaHJvbWUod2luZG93U2VydmljZTogQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnQ6IENvbnZlcnNhdGlvblBhcnQpOiB7IGJhcnM6IG51bWJlcjsgbmF2czogbnVtYmVyOyBwYXJ0U2xvdEJhcnM6IG51bWJlciB9IHtcblx0XHRsZXQgYmFycyA9IDA7XG5cdFx0bGV0IG5hdnMgPSAwO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIHdpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVNlc3Npb25LZXlzKCkpIHtcblx0XHRcdGNvbnN0IGxlYWYgPSB3aW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhrZXkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGxlYWYpO1xuXHRcdFx0YmFycyArPSBsZWFmLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1iYXInKS5sZW5ndGg7XG5cdFx0XHRuYXZzICs9IGxlYWYuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24td2luZG93LW5hdicpLmxlbmd0aDtcblx0XHR9XG5cdFx0Y29uc3QgcGFydFNsb3RCYXJzID0gY29udmVyc2F0aW9uUGFydC5nZXRTbG90cygpPy5zZXNzaW9uQmFyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLWJhcicpLmxlbmd0aCA/PyAwO1xuXHRcdHJldHVybiB7IGJhcnMsIG5hdnMsIHBhcnRTbG90QmFycyB9O1xuXHR9XG5cblx0ZnVuY3Rpb24gc3R1YkxlbnNSdW50aW1lU2VydmljZXMoaW5zdGFudGlhdGlvblNlcnZpY2U6IFJldHVyblR5cGU8dHlwZW9mIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlPik6IHZvaWQge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblRpbWVsaW5lUmV2ZWFsU2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0cmVnaXN0ZXJMZW5zOiAoKSA9PiAoeyBkaXNwb3NlOiAoKSA9PiB7IH0gfSksXG5cdFx0XHRyZXZlYWxJdGVtOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRBY2Nlc3NpYmxlVHVybkNvbnRlbnQ6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdGZvY3VzQWNjZXNzaWJsZVR1cm46ICgpID0+IHsgfSxcblx0XHRcdHNjcm9sbFRvRmlyc3RQZW5kaW5nQ29uZmlybWF0aW9uOiAoKSA9PiB7IH0sXG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uUmV2aWV3TmF2U2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRnZXRSZXZpZXdOYXZGb3JTZXNzaW9uOiAoKSA9PiBbXSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFeHBsb3JlclNlcnZpY2UsIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdHNlbGVjdDogYXN5bmMgKCkgPT4geyB9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTQ01TZXJ2aWNlLCB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRnZXQgcmVwb3NpdG9yaWVzKCkgeyByZXR1cm4gW107IH0sXG5cdFx0XHRnZXQgcmVwb3NpdG9yeUNvdW50KCkgeyByZXR1cm4gMDsgfSxcblx0XHRcdG9uRGlkQWRkUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdG9uRGlkUmVtb3ZlUmVwb3NpdG9yeTogRXZlbnQuTm9uZSxcblx0XHRcdHJlZ2lzdGVyU0NNUHJvdmlkZXI6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfSxcblx0XHRcdGdldFJlcG9zaXRvcnk6ICgpID0+IHVuZGVmaW5lZCxcblx0XHR9IGFzIHVua25vd24gYXMgSVNDTVNlcnZpY2UpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gY3JlYXRlUmV2ZWFsSGFybmVzcygpIHtcblx0XHRjb25zdCByb3N0ZXJTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBRdWlldFJvc3RlclNlcnZpY2UoKSk7XG5cdFx0Y29uc3Qgb3BlbkVycm9yczogdW5rbm93bltdID0gW107XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh7XG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZTogKCkgPT4gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7XG5cdFx0XHRcdHdvcmtiZW5jaDogeyBlZGl0b3I6IHsgZW5hYmxlUHJldmlldzogZmFsc2UgfSB9LFxuXHRcdFx0XHRbVUFfQ0xJRU5UX0NIQVRfSU5QVVRfQVVUT19GT0NVU106IGZhbHNlLFxuXHRcdFx0fSksXG5cdFx0fSwgc3RvcmUpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxvZ1NlcnZpY2UsIHtcblx0XHRcdGVycm9yOiAoZXJyb3I6IHVua25vd24pID0+IHsgb3BlbkVycm9ycy5wdXNoKGVycm9yKTsgfSxcblx0XHRcdHdhcm46ICgpID0+IHsgfSxcblx0XHRcdGluZm86ICgpID0+IHsgfSxcblx0XHRcdHRyYWNlOiAoKSA9PiB7IH0sXG5cdFx0XHRkZWJ1ZzogKCkgPT4geyB9LFxuXHRcdFx0Zmx1c2g6ICgpID0+IHsgfSxcblx0XHRcdGdldExldmVsOiAoKSA9PiAwLFxuXHRcdFx0c2V0TGV2ZWw6ICgpID0+IHsgfSxcblx0XHRcdG9uRGlkQ2hhbmdlTG9nTGV2ZWw6IEV2ZW50Lk5vbmUsXG5cdFx0fSBhcyB1bmtub3duIGFzIElMb2dTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25Sb3N0ZXJTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiwgY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKCkpO1xuXHRcdHN0dWJMZW5zUnVudGltZVNlcnZpY2VzKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRzdHViQ29udmVyc2F0aW9uVGltZWxpbmVMaW5rU2VydmljZXMoaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkuc3RhcnQoYWNjZXNzb3IpKTtcblxuXHRcdGNvbnN0IHBhcnRzID0gYXdhaXQgY3JlYXRlRWRpdG9yUGFydHMoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRzdG9yZS5hZGQocGFydHMpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIHBhcnRzKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvclNlcnZpY2UsIHVuZGVmaW5lZCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclNlcnZpY2UsIGVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29udmVyc2F0aW9uUGFydCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25QYXJ0KSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IHBhcmVudC5yZW1vdmUoKSB9KTtcblx0XHRjb252ZXJzYXRpb25QYXJ0LmNyZWF0ZShwYXJlbnQpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblBhcnRTZXJ2aWNlLCBjb252ZXJzYXRpb25QYXJ0KTtcblxuXHRcdGNvbnN0IHNlc3Npb25DaGF0U2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25TZXNzaW9uQ2hhdFNlcnZpY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25TZXNzaW9uQ2hhdFNlcnZpY2UsIHNlc3Npb25DaGF0U2VydmljZSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbldpbmRvd1NlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25TZXNzaW9uV2luZG93U2VydmljZSwgc2Vzc2lvbldpbmRvd1NlcnZpY2UpO1xuXHRcdGNvbnN0IG5hdmlnYXRpb25TZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbnZlcnNhdGlvbk5hdmlnYXRpb25TZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uTmF2aWdhdGlvblNlcnZpY2UsIG5hdmlnYXRpb25TZXJ2aWNlKTtcblxuXHRcdHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25TZXNzaW9uQ2hhdENvbnRyaWJ1dGlvbikpO1xuXHRcdHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25OYXZpZ2F0aW9uQ29udHJpYnV0aW9uKSk7XG5cblx0XHRjb25zdCBwcmltYXJ5SWQgPSByb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmVuc3VyZVByaW1hcnlXaW5kb3cocHJpbWFyeUlkKTtcblx0XHRjb25zdCBwcmltYXJ5UGFydCA9IHBhcnRGb3IocGFydHMsIHByaW1hcnlJZCk7XG5cdFx0YXdhaXQgd2FpdEZvclBhbmUocHJpbWFyeVBhcnQsIG9wZW5FcnJvcnMsIHBhcnRzKTtcblx0XHRsYXlvdXRQYXJ0cyhwYXJ0cyk7XG5cdFx0dHJhY2tFZGl0b3JzKHBhcnRzKTtcblxuXHRcdHJldHVybiB7IGluc3RhbnRpYXRpb25TZXJ2aWNlLCBwYXJ0cywgY29udmVyc2F0aW9uUGFydCwgcm9zdGVyU2VydmljZSwgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHNlc3Npb25DaGF0U2VydmljZSwgcHJpbWFyeUlkLCBvcGVuRXJyb3JzIH07XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiB3YWl0Rm9yU2Vzc2lvblBhbmUoXG5cdFx0aGFybmVzczogQXdhaXRlZDxSZXR1cm5UeXBlPHR5cGVvZiBjcmVhdGVSZXZlYWxIYXJuZXNzPj4sXG5cdFx0c2Vzc2lvbktleTogc3RyaW5nLFxuXHQpOiBQcm9taXNlPENvbnZlcnNhdGlvbkVkaXRvclBhbmU+IHtcblx0XHRyZXR1cm4gd2FpdEZvclBhbmUocGFydEZvcihoYXJuZXNzLnBhcnRzLCBzZXNzaW9uS2V5KSwgaGFybmVzcy5vcGVuRXJyb3JzLCBoYXJuZXNzLnBhcnRzKTtcblx0fVxuXG5cdHRlc3QoJzggc2luZ2xlLWxlYWYgcmV2ZWFsIEFcdTIxOTJCXHUyMTkyQSBrZWVwcyBvbmUgdmlzaWJsZSBwcmltYXJ5IHdpdGhvdXQgaGlkZSBidXR0b24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHBhcnRzLCBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRjb25zdCBwYXJ0QiA9IHBhcnRGb3IocGFydHMsIGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGVMZWFmS2V5cyhzZXNzaW9uV2luZG93U2VydmljZSksIFtiXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Qi5zZXNzaW9uS2V5LCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydHMuZ2V0QWN0aXZlQ29udmVyc2F0aW9uRWRpdG9yUGFydCgpPy5zZXNzaW9uS2V5LCBiKTtcblx0XHRhc3NlcnQub2soc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHByaW1hcnlJZCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpLnNlc3Npb25LZXksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhpZGVCdXR0b24oc2Vzc2lvbldpbmRvd1NlcnZpY2UsIGIpPy5oaWRkZW4sIHRydWUpO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKHNlc3Npb25XaW5kb3dTZXJ2aWNlKSwgW3ByaW1hcnlJZF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoaWRlQnV0dG9uKHNlc3Npb25XaW5kb3dTZXJ2aWNlLCBwcmltYXJ5SWQpPy5oaWRkZW4sIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdoaWRlIGZvY3VzZWQgc2Vjb25kYXJ5IGxlYWYgbW92ZXMgZm9jdXMgdG8gcHJpbWFyeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gY3JlYXRlTGlnaHR3ZWlnaHRXaW5kb3dIYXJuZXNzKCk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRjb25zdCBwcmltYXJ5SWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5lbnN1cmVQcmltYXJ5V2luZG93KHByaW1hcnlJZCk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5SWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZShzZWNvbmRhcnlJZCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KHNlY29uZGFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgc2Vjb25kYXJ5SWQpO1xuXG5cdFx0aGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5oaWRlU2Vzc2lvbldpbmRvdyhzZWNvbmRhcnlJZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4oc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgcHJpbWFyeUlkKTtcblx0XHRjb25zdCBwcmltYXJ5TGVhZiA9IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHByaW1hcnlJZCkhO1xuXHRcdGNvbnN0IGFjdGl2ZSA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRhc3NlcnQub2soXG5cdFx0XHRwcmltYXJ5TGVhZi5jb250YWluZXIgPT09IGFjdGl2ZSB8fCBwcmltYXJ5TGVhZi5jb250YWluZXIuY29udGFpbnMoYWN0aXZlKSxcblx0XHRcdCdmb2N1cyBtdXN0IGxlYXZlIHRoZSBoaWRkZW4gbGVhZiBhbmQgbGFuZCBvbiB0aGUgdmlzaWJsZSBwcmltYXJ5Jyxcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCc4IHR3byB2aXNpYmxlIGxlYXZlczogcmV2ZWFsIGFscmVhZHktdmlzaWJsZSBsZWFmIGZvY3VzZXMgaXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHBhcnRzLCBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkLCBjb252ZXJzYXRpb25QYXJ0IH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLm9wZW5TZXNzaW9uQmVzaWRlKGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0cy5nZXRBY3RpdmVDb252ZXJzYXRpb25FZGl0b3JQYXJ0KCk/LnNlc3Npb25LZXksIGIpO1xuXHRcdGNvbnN0IGxlYWZCID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKGIpO1xuXHRcdGFzc2VydC5vayhsZWFmQik7XG5cdFx0Y29uc3QgYWN0aXZlID0gZ2V0QWN0aXZlRWxlbWVudCgpO1xuXHRcdGFzc2VydC5vayhcblx0XHRcdGxlYWZCLmNvbnRhaW5lciA9PT0gYWN0aXZlIHx8IGxlYWZCLmNvbnRhaW5lci5jb250YWlucyhhY3RpdmUpLFxuXHRcdFx0J2ZvY3VzIG11c3Qgc3RheSBpbiB0aGUgcmV2ZWFsZWQgbGVhZiwgbm90IHNuYXAgYmFjayB0byBwcmltYXJ5Jyxcblx0XHQpO1xuXHRcdGNvbnN0IGNocm9tZSA9IGNvdW50TGVhZkNocm9tZShzZXNzaW9uV2luZG93U2VydmljZSwgY29udmVyc2F0aW9uUGFydCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZS5iYXJzLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydEZvcihwYXJ0cywgcHJpbWFyeUlkKS5zZXNzaW9uS2V5LCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Rm9yKHBhcnRzLCBiKS5zZXNzaW9uS2V5LCBiKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuY2VsbGVkIGFscmVhZHktdmlzaWJsZSByZXZlYWwgZG9lcyBub3Qgc3dpdGNoIHRoZSBhY3RpdmUgc2Vzc2lvbiBiYWNrJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBwYXJ0cywgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZShiKTtcblx0XHRjb25zdCBwYW5lQSA9IGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHBhbmVCID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGFzc2VydC5vayhwYW5lQS5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdGFzc2VydC5vayhwYW5lQi5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cblx0XHRsZXQgcmVsZWFzZUEgPSAoKSA9PiB7IH07XG5cdFx0Y29uc3QgZ2F0ZSA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4geyByZWxlYXNlQSA9IHJlc29sdmU7IH0pO1xuXHRcdChwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpIGFzIHsgd2hlblJlYWR5OiBQcm9taXNlPHZvaWQ+IH0pLndoZW5SZWFkeSA9IGdhdGU7XG5cblx0XHRjb25zdCBzd2l0Y2hlZDogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBvcmlnaW5hbFN3aXRjaCA9IHJvc3RlclNlcnZpY2Uuc3dpdGNoU2Vzc2lvbi5iaW5kKHJvc3RlclNlcnZpY2UpO1xuXHRcdHJvc3RlclNlcnZpY2Uuc3dpdGNoU2Vzc2lvbiA9IChzZXNzaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0c3dpdGNoZWQucHVzaChzZXNzaW9uSWQpO1xuXHRcdFx0b3JpZ2luYWxTd2l0Y2goc2Vzc2lvbklkKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgZmlyc3QgPSBwYW5lQS5sZWFmU2Vzc2lvbkJhckhvc3Quc3dpdGNoTGVhZlNlc3Npb24ocHJpbWFyeUlkKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRcdGF3YWl0IHBhbmVCLmxlYWZTZXNzaW9uQmFySG9zdC5zd2l0Y2hMZWFmU2Vzc2lvbihiKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgYik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgYik7XG5cdFx0XHRzd2l0Y2hlZC5sZW5ndGggPSAwO1xuXHRcdFx0cmVsZWFzZUEoKTtcblx0XHRcdGF3YWl0IGZpcnN0O1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzd2l0Y2hlZCwgW10pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEZvY3VzZWRMZWFmU2Vzc2lvbktleSgpLCBiKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBiKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cmVsZWFzZUEoKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2hpZGUgZHVyaW5nIHBhbmUtbGVzcyByZXZlYWwgd2FpdCBkb2VzIG5vdCBzdGVhbCBmb2N1cyBvciB0aGUgYWN0aXZlIHNlc3Npb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy50aW1lb3V0KDE1XzAwMCk7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZUxpZ2h0d2VpZ2h0V2luZG93SGFybmVzcygpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgY29udmVyc2F0aW9uUGFydHMgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgcHJpbWFyeUlkID0gcm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5lbnN1cmVQcmltYXJ5V2luZG93KHByaW1hcnlJZCk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5SWQgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLm9wZW5TZXNzaW9uQmVzaWRlKHNlY29uZGFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShwcmltYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cblx0XHRjb25zdCBzZWNvbmRhcnlQYXJ0ID0gY29udmVyc2F0aW9uUGFydHMuZmluZChwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vjb25kYXJ5SWQpO1xuXHRcdGFzc2VydC5vayhzZWNvbmRhcnlQYXJ0KTtcblx0XHRjb25zdCBncm91cCA9IHNlY29uZGFyeVBhcnQuYWN0aXZlR3JvdXAgYXMgeyBhY3RpdmVFZGl0b3JQYW5lPzogeyBnZXRJZCgpOiBzdHJpbmcgfTsgb25EaWRBY3RpdmVFZGl0b3JDaGFuZ2U/OiBFdmVudDx1bmtub3duPiB9O1xuXHRcdGdyb3VwLmFjdGl2ZUVkaXRvclBhbmUgPSB1bmRlZmluZWQ7XG5cdFx0Z3JvdXAub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UgPSBFdmVudC5Ob25lO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRGb2N1c2VkTGVhZlNlc3Npb25LZXkoKSwgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgcHJpbWFyeUlkKTtcblx0XHRjb25zdCBwcmltYXJ5TGVhZiA9IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhwcmltYXJ5SWQpITtcblx0XHRjb25zdCBhY3RpdmVCZWZvcmUgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0YXNzZXJ0Lm9rKFxuXHRcdFx0cHJpbWFyeUxlYWYuY29udGFpbmVyID09PSBhY3RpdmVCZWZvcmUgfHwgcHJpbWFyeUxlYWYuY29udGFpbmVyLmNvbnRhaW5zKGFjdGl2ZUJlZm9yZSksXG5cdFx0XHQncHJpbWFyeSBtdXN0IG93biBmb2N1cyBiZWZvcmUgdGhlIHN0YWxsZWQgcmV2ZWFsJyxcblx0XHQpO1xuXG5cdFx0Y29uc3Qgc3dpdGNoZWQ6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3Qgb3JpZ2luYWxTd2l0Y2ggPSByb3N0ZXJTZXJ2aWNlLnN3aXRjaFNlc3Npb24uYmluZChyb3N0ZXJTZXJ2aWNlKTtcblx0XHRyb3N0ZXJTZXJ2aWNlLnN3aXRjaFNlc3Npb24gPSAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHtcblx0XHRcdHN3aXRjaGVkLnB1c2goc2Vzc2lvbklkKTtcblx0XHRcdG9yaWdpbmFsU3dpdGNoKHNlc3Npb25JZCk7XG5cdFx0fTtcblxuXHRcdGxldCBzZXR0bGVkID0gZmFsc2U7XG5cdFx0Y29uc3QgcmV2ZWFsID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhzZWNvbmRhcnlJZCkuZmluYWxseSgoKSA9PiB7IHNldHRsZWQgPSB0cnVlOyB9KTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXR0bGVkLCBmYWxzZSwgJ3JldmVhbCBtdXN0IHN0aWxsIGJlIHdhaXRpbmcgZm9yIGFuIGVkaXRvciBwYW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblxuXHRcdHNlc3Npb25XaW5kb3dTZXJ2aWNlLmhpZGVTZXNzaW9uV2luZG93KHNlY29uZGFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHNlY29uZGFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEZvY3VzZWRMZWFmU2Vzc2lvbktleSgpLCBwcmltYXJ5SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IGFjdGl2ZUR1cmluZyA9IGdldEFjdGl2ZUVsZW1lbnQoKTtcblx0XHRhc3NlcnQub2soXG5cdFx0XHRwcmltYXJ5TGVhZi5jb250YWluZXIgPT09IGFjdGl2ZUR1cmluZyB8fCBwcmltYXJ5TGVhZi5jb250YWluZXIuY29udGFpbnMoYWN0aXZlRHVyaW5nKSxcblx0XHRcdCdmb2N1cyBtdXN0IHN0YXkgb24gdGhlIHByaW1hcnkgd2hpbGUgdGhlIGhpZGRlbiBsZWFmIGlzIHN0aWxsIHdhaXRpbmcnLFxuXHRcdCk7XG5cblx0XHRhd2FpdCByZXZlYWw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNldHRsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4oc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0Rm9jdXNlZExlYWZTZXNzaW9uS2V5KCksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgYWN0aXZlQWZ0ZXIgPSBnZXRBY3RpdmVFbGVtZW50KCk7XG5cdFx0YXNzZXJ0Lm9rKFxuXHRcdFx0cHJpbWFyeUxlYWYuY29udGFpbmVyID09PSBhY3RpdmVBZnRlciB8fCBwcmltYXJ5TGVhZi5jb250YWluZXIuY29udGFpbnMoYWN0aXZlQWZ0ZXIpLFxuXHRcdFx0J2ZvY3VzIG11c3Qgc3RheSBvbiB0aGUgcHJpbWFyeSBhZnRlciB0aGUgcGFuZSB3YWl0IGVuZHMnLFxuXHRcdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzd2l0Y2hlZCwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCcxMCBTZWxlY3RCb3ggcGF0aCBvbiByZWFsIHBhbmUgY2hhbmdlcyB0aGUgbGVhZiAoUFJELTAwMiAjMSknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHBhcnRzLCBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQub2socGFuZS5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdGF3YWl0IHBhbmUubGVhZlNlc3Npb25CYXJIb3N0IS5zd2l0Y2hMZWFmU2Vzc2lvbihiKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHBhcnRGb3IocGFydHMsIGIpLmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvcik7XG5cdH0pO1xuXG5cdHRlc3QoJzEwIHR3byB2aXNpYmxlIGxlYXZlczogU2VsZWN0Qm94IG9uIG9uZSBsZWFmIHJlcGxhY2VzIHRoYXQgbGVhZiB3aXRoIGEgdGhpcmQgc2Vzc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgcGFydHMsIHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBwcmltYXJ5SWQgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgYiA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0Y29uc3QgYyA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoYik7XG5cdFx0Y29uc3QgcGFuZUIgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXNzZXJ0Lm9rKHBhbmVCLmxlYWZTZXNzaW9uQmFySG9zdCk7XG5cdFx0YXdhaXQgcGFuZUIubGVhZlNlc3Npb25CYXJIb3N0IS5zd2l0Y2hMZWFmU2Vzc2lvbihjKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYyk7XG5cdFx0Y29uc3QgdmlzaWJsZSA9IHZpc2libGVMZWFmS2V5cyhzZXNzaW9uV2luZG93U2VydmljZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZpc2libGUubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQub2sodmlzaWJsZS5pbmNsdWRlcyhwcmltYXJ5SWQpLCAndGhlIG90aGVyIGxlYWYgbXVzdCBzdGF5Jyk7XG5cdFx0YXNzZXJ0Lm9rKHZpc2libGUuaW5jbHVkZXMoYyksICd0aGUgb3BlcmF0ZWQgbGVhZiBtdXN0IGJlY29tZSB0aGUgdGhpcmQgc2Vzc2lvbicpO1xuXHRcdGFzc2VydC5vayghdmlzaWJsZS5pbmNsdWRlcyhiKSwgJ3RoZSBvcGVyYXRlZCBsZWFmIG11c3Qgbm90IHJlbWFpbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpLnNlc3Npb25LZXksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRGb3IocGFydHMsIGMpLnNlc3Npb25LZXksIGMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4oYiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBzd2l0Y2hUb1Nlc3Npb24gc3dpdGNoTGVhZlNlc3Npb24gcmVqZWN0cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgcGFuZSA9IGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0Lm9rKHBhbmUubGVhZlNlc3Npb25CYXJIb3N0KTtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3N3aXRjaCBib29tJyk7XG5cdFx0cGFuZS5sZWFmU2Vzc2lvbkJhckhvc3Quc3dpdGNoTGVhZlNlc3Npb24gPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0fTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdHBhbmUubGVhZlNlc3Npb25CYXJIb3N0IS5zd2l0Y2hUb1Nlc3Npb24oJ290aGVyLXNlc3Npb24nKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gU2VsZWN0Qm94IGhlbHBlciBzd2l0Y2hUb1Nlc3Npb24gc3dpdGNoTGVhZlNlc3Npb24gcmVqZWN0cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgcGFuZSA9IGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBoYXJuZXNzLnByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0Lm9rKHBhbmUubGVhZlNlc3Npb25CYXJIb3N0KTtcblx0XHRjb25zdCBwYWludEJvb20gPSBuZXcgRXJyb3IoJ3N3aXRjaCBib29tJyk7XG5cdFx0cGFuZS5sZWFmU2Vzc2lvbkJhckhvc3Quc3dpdGNoTGVhZlNlc3Npb24gPSBhc3luYyAoKSA9PiB7XG5cdFx0XHR0aHJvdyBwYWludEJvb207XG5cdFx0fTtcblx0XHRhd2FpdCBhc3NlcnRXYXJuVGhlblJldGhyb3dEb2VzTm90TGVhayhwYWludEJvb20sICgpID0+IHtcblx0XHRcdHN3aXRjaFRvU2Vzc2lvbkhlbHBlcihwYW5lLmxlYWZTZXNzaW9uQmFySG9zdCEsICdvdGhlci1zZXNzaW9uJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NlbGVjdEJveCBoZWxwZXIgc3dpdGNoVG9TZXNzaW9uIGZpcmUtYW5kLWZvcmdldCB2b2lkcyBkb3VibGUtY2F0Y2ggb25VbmV4cGVjdGVkRXJyb3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgX19yZWFkRmlsZUluVGVzdHMoYCR7cHJvY2Vzcy5jd2QoKX0vc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyLnRzYCk7XG5cdFx0Y29uc3QgZG91YmxlQ2F0Y2ggPSAnLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvciknO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoYHZvaWQgaG9zdC5zd2l0Y2hMZWFmU2Vzc2lvbihzZXNzaW9uSWQpJHtkb3VibGVDYXRjaH1gKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzb3VyY2UuaW5jbHVkZXMoJ3ZvaWQgaG9zdC5zd2l0Y2hMZWFmU2Vzc2lvbihzZXNzaW9uSWQpOycpKTtcblx0fSk7XG5cblx0dGVzdCgnMTAgTmV3IFNlc3Npb24gaW4gc3R1YiBwYXRoIGJlY29tZXMgdGhlIG9ubHkgdmlzaWJsZSBsZWFmJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgcm9zdGVyU2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQub2socGFuZS5sZWFmU2Vzc2lvbkJhckhvc3QpO1xuXHRcdHBhbmUubGVhZlNlc3Npb25CYXJIb3N0IS5jcmVhdGVOZXdTZXNzaW9uKCk7XG5cdFx0Y29uc3QgZGVhZGxpbmUgPSBEYXRlLm5vdygpICsgMzAwMDtcblx0XHRsZXQgbmV3SWQgPSByb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdHdoaWxlIChuZXdJZCA9PT0gcHJpbWFyeUlkICYmIERhdGUubm93KCkgPCBkZWFkbGluZSkge1xuXHRcdFx0YXdhaXQgdGltZW91dCgyMCk7XG5cdFx0XHRuZXdJZCA9IHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0fVxuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChuZXdJZCwgcHJpbWFyeUlkKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgbmV3SWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIG5ld0lkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGlkZUJ1dHRvbihzZXNzaW9uV2luZG93U2VydmljZSwgbmV3SWQpPy5oaWRkZW4sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4ocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJzEzIGVhY2ggdmlzaWJsZSBsZWFmIGhhcyBleGFjdGx5IG9uZSBTZXNzaW9uQmFyIGFuZCB3aW5kb3ctbmF2OyBQYXJ0IHNsb3QgaGFzIG5vbmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBjb252ZXJzYXRpb25QYXJ0LCBwcmltYXJ5SWQgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgYiA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0Y29uc3QgYyA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGMpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBjKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KHByaW1hcnlJZCk7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIHByaW1hcnlJZCk7XG5cdFx0bGV0IGNocm9tZSA9IGNvdW50TGVhZkNocm9tZShzZXNzaW9uV2luZG93U2VydmljZSwgY29udmVyc2F0aW9uUGFydCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFZpc2libGVXaW5kb3dDb3VudCgpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lLmJhcnMsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWUubmF2cywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZS5wYXJ0U2xvdEJhcnMsIDApO1xuXG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoYik7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGNocm9tZSA9IGNvdW50TGVhZkNocm9tZShzZXNzaW9uV2luZG93U2VydmljZSwgY29udmVyc2F0aW9uUGFydCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFZpc2libGVXaW5kb3dDb3VudCgpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hyb21lLmJhcnMsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaHJvbWUubmF2cywgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNocm9tZS5wYXJ0U2xvdEJhcnMsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCcxM2IgbGVhZiBTZXNzaW9uQmFyIGFuZCBjb250YWluZXIgcmVjZWl2ZSBpcy1uYXJyb3cgd2hlbiBwYW5lIHdpZHRoIGlzIHVuZGVyIDQ1MHB4JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBzZXNzaW9uV2luZG93U2VydmljZSwgcHJpbWFyeUlkIH0gPSBoYXJuZXNzO1xuXHRcdGNvbnN0IHBhbmUgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRjb25zdCBsZWFmID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0TGVhZlNsb3RzKHByaW1hcnlJZCkhO1xuXG5cdFx0cGFuZS5sYXlvdXQobmV3IERpbWVuc2lvbig1MDAsIDYwMCkpO1xuXHRcdGFzc2VydC5vayhsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1tZWRpdW0nKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cblx0XHRwYW5lLmxheW91dChuZXcgRGltZW5zaW9uKDQwMCwgNjAwKSk7XG5cdFx0YXNzZXJ0Lm9rKGxlYWYuc2Vzc2lvbkJhci5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLW5hcnJvdycpKTtcblx0XHRhc3NlcnQub2sobGVhZi5jb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1jb21wYWN0JykpO1xuXG5cdFx0cGFuZS5sYXlvdXQobmV3IERpbWVuc2lvbigyNTAsIDYwMCkpO1xuXHRcdGFzc2VydC5vayhsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKGxlYWYuc2Vzc2lvbkJhci5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLWNvbXBhY3QnKSk7XG5cblx0XHRwYW5lLmxheW91dChuZXcgRGltZW5zaW9uKDk1MCwgNjAwKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLnNlc3Npb25CYXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1uYXJyb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsZWFmLmNvbnRhaW5lci5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLW5hcnJvdycpKTtcblx0XHRhc3NlcnQub2soIWxlYWYuc2Vzc2lvbkJhci5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLWNvbXBhY3QnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJzE0IHJldmVhbCBtb3VudHMgb3ZlcmxheSBzbyBvcGVuU3ViQWdlbnQgZG9lcyBub3QgdGhyb3cnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGF3YWl0IGNyZWF0ZVJldmVhbEhhcm5lc3MoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCBzZXNzaW9uQ2hhdFNlcnZpY2UsIHJvc3RlclNlcnZpY2UgfSA9IGhhcm5lc3M7XG5cdFx0Y29uc3QgYiA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhiKTtcblx0XHRhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgYik7XG5cdFx0YXdhaXQgc2Vzc2lvbkNoYXRTZXJ2aWNlLm9wZW5TdWJBZ2VudChiLCAndG9vbC1mcm9tLXJldmVhbCcsICdSZXZlYWwgdG9vbCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uQ2hhdFNlcnZpY2UuaXNTdWJBZ2VudERpYWxvZ09wZW4oYiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCcxNSBsYXRlc3Qtd2lucyByZXZlYWwgZW5kcyBvbiBCOyBiaW5kLWZhaWxlZCBzZW50aW5lbCBkb2VzIG5vdCBjcmVhdGUgYSBsZWFmJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IGEgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGNvbnN0IGZpcnN0ID0gc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyhhKTtcblx0XHRjb25zdCBzZWNvbmQgPSBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGIpO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtmaXJzdCwgc2Vjb25kXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh2aXNpYmxlTGVhZktleXMoc2Vzc2lvbldpbmRvd1NlcnZpY2UpLCBbYl0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRQcmltYXJ5U2Vzc2lvbktleSgpLCBiKTtcblxuXHRcdGNvbnN0IGtleXNCZWZvcmUgPSBbLi4uc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0QWxsTGVhZlNlc3Npb25LZXlzKCldO1xuXHRcdHJvc3RlclNlcnZpY2UuZmlyZUFjdGl2ZVNlc3Npb24oRU5HSU5FX0JJTkRfRkFJTEVEX1NFU1NJT05fSUQpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMjApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoWy4uLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpXSwga2V5c0JlZm9yZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhFTkdJTkVfQklORF9GQUlMRURfU0VTU0lPTl9JRCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhwcmltYXJ5SWQpIHx8IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhiKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRGlkRGVsZXRlU2Vzc2lvbiBkaXNwb3NlcyB2aXNpYmxlIGxlYWYgd2hlbiBiaW5kLWZhaWxlZCBza2lwcyByZXZlYWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZUxpZ2h0d2VpZ2h0V2luZG93SGFybmVzcygpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhzZXNzaW9uSWQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UpLCBbc2Vzc2lvbklkXSk7XG5cdFx0YXNzZXJ0Lm9rKGhhcm5lc3MuY29udmVyc2F0aW9uUGFydHMuc29tZShwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vzc2lvbklkKSk7XG5cblx0XHRoYXJuZXNzLnJvc3RlclNlcnZpY2UuZmlyZUFjdGl2ZVNlc3Npb24oRU5HSU5FX0JJTkRfRkFJTEVEX1NFU1NJT05fSUQpO1xuXHRcdGhhcm5lc3Mucm9zdGVyU2VydmljZS5maXJlRGVsZXRlZFNlc3Npb24oc2Vzc2lvbklkKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UpLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0UHJpbWFyeVNlc3Npb25LZXkoKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIWhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0QWxsTGVhZlNlc3Npb25LZXlzKCkuaW5jbHVkZXMoc2Vzc2lvbklkKSk7XG5cdFx0YXNzZXJ0Lm9rKCFoYXJuZXNzLmNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHNlc3Npb25JZCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkRpZERlbGV0ZVNlc3Npb24gZGlzcG9zZXMgYSBoaWRkZW4gbGVhZiBhbmQgaXRzIGVkaXRvciBwYXJ0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBhd2FpdCBjcmVhdGVSZXZlYWxIYXJuZXNzKCk7XG5cdFx0Y29uc3QgeyBwYXJ0cywgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UsIHByaW1hcnlJZCB9ID0gaGFybmVzcztcblx0XHRjb25zdCBzZWNvbmRhcnlJZCA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2Uub3BlblNlc3Npb25CZXNpZGUoc2Vjb25kYXJ5SWQpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBzZWNvbmRhcnlJZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5vayhzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMocHJpbWFyeUlkKSk7XG5cdFx0YXNzZXJ0Lm9rKHBhcnRzLmNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHByaW1hcnlJZCkpO1xuXG5cdFx0cm9zdGVyU2VydmljZS5maXJlRGVsZXRlZFNlc3Npb24ocHJpbWFyeUlkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMocHJpbWFyeUlkKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIXBhcnRzLmNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IHByaW1hcnlJZCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmlzaWJsZUxlYWZLZXlzKHNlc3Npb25XaW5kb3dTZXJ2aWNlKSwgW3NlY29uZGFyeUlkXSk7XG5cdH0pO1xuXG5cdHRlc3QoJzE1IHN0dWItc2VlZCB1bnRpdGxlZCBvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb24gc3RpbGwgcmV2ZWFscycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIHJvc3RlclNlcnZpY2UgfSA9IGhhcm5lc3M7XG5cdFx0YXNzZXJ0Lm9rKGlzRW5naW5lUm9zdGVyUGxhY2Vob2xkZXJTZXNzaW9uSWQoJ3VudGl0bGVkJykpO1xuXHRcdGFzc2VydC5vayhyb3N0ZXJTZXJ2aWNlLmdldFNlc3Npb25zKCkuc29tZShzZXNzaW9uID0+IHNlc3Npb24uaWQgPT09ICd1bnRpdGxlZCcpKTtcblx0XHRjb25zdCBiID0gcm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGIpO1xuXHRcdGF3YWl0IHdhaXRGb3JTZXNzaW9uUGFuZShoYXJuZXNzLCBiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93SGlkZGVuKCd1bnRpdGxlZCcpLCB0cnVlKTtcblxuXHRcdHJvc3RlclNlcnZpY2UuZmlyZUFjdGl2ZVNlc3Npb24oJ3VudGl0bGVkJyk7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsICd1bnRpdGxlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKCd1bnRpdGxlZCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHZpc2libGVMZWFmS2V5cyhzZXNzaW9uV2luZG93U2VydmljZSksIFsndW50aXRsZWQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksICd1bnRpdGxlZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCcxNSByZXZlYWwgY3JlYXRlIGZhaWx1cmUgcm9sbHMgYmFjayBwYXJ0ICsgbGVhZiBhbmQgcmVidWlsZHMgdGhlIHNhbWUga2V5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJvc3RlclNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IFF1aWV0Um9zdGVyU2VydmljZSgpKTtcblx0XHRjb25zdCBncmlkSG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZ3JpZEhvc3QpO1xuXHRcdHN0b3JlLmFkZCh7IGRpc3Bvc2U6ICgpID0+IGdyaWRIb3N0LnJlbW92ZSgpIH0pO1xuXG5cdFx0Y29uc3QgY29udmVyc2F0aW9uUGFydHM6IElDb252ZXJzYXRpb25FZGl0b3JQYXJ0W10gPSBbXTtcblx0XHRsZXQgdGhyb3dPbkNyZWF0ZSA9IGZhbHNlO1xuXHRcdGNvbnN0IGVkaXRvckdyb3Vwc1NlcnZpY2UgPSB7XG5cdFx0XHRjcmVhdGVDb252ZXJzYXRpb25FZGl0b3JQYXJ0OiAoX3BhcmVudDogdW5rbm93biwgc2Vzc2lvbktleTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGlmICh0aHJvd09uQ3JlYXRlKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdyZXZlYWwgYm9vbScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHBhcnQgPSB7IHNlc3Npb25LZXksIHdoZW5SZWFkeTogUHJvbWlzZS5yZXNvbHZlKCksIGFjdGl2ZUdyb3VwOiB7IGZvY3VzOiAoKSA9PiB7IH0sIGFjdGl2ZUVkaXRvclBhbmU6IHsgZ2V0SWQ6ICgpID0+IENvbnZlcnNhdGlvbkVkaXRvclBhbmVJZCB9IH0gfSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25FZGl0b3JQYXJ0O1xuXHRcdFx0XHRjb252ZXJzYXRpb25QYXJ0cy5wdXNoKHBhcnQpO1xuXHRcdFx0XHRyZXR1cm4gcGFydDtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlQ29udmVyc2F0aW9uRWRpdG9yUGFydDogKHNlc3Npb25LZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IGNvbnZlcnNhdGlvblBhcnRzLmZpbmRJbmRleChwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gc2Vzc2lvbktleSk7XG5cdFx0XHRcdGlmIChpbmRleCA+PSAwKSB7XG5cdFx0XHRcdFx0Y29udmVyc2F0aW9uUGFydHMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNldEZvY3VzZWRDb252ZXJzYXRpb25MZWFmOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRGb2N1c2VkQ29udmVyc2F0aW9uTGVhZjogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0Z2V0IGNvbnZlcnNhdGlvblBhcnRzKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udmVyc2F0aW9uUGFydHM7XG5cdFx0XHR9LFxuXHRcdH0gYXMgdW5rbm93biBhcyBJRWRpdG9yR3JvdXBzU2VydmljZTtcblxuXHRcdGNvbnN0IGVycm9yczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBzZXNzaW9uV2luZG93U2VydmljZSA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uU2Vzc2lvbldpbmRvd1NlcnZpY2UoXG5cdFx0XHR7XG5cdFx0XHRcdG9uRGlkQ3JlYXRlU2xvdHM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdG9uRGlkRm9jdXM6IEV2ZW50Lk5vbmUsXG5cdFx0XHRcdGdldFNsb3RzOiAoKSA9PiAoeyBzZXNzaW9uQmFyOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSwgc2Vzc2lvbldpbmRvd0dyaWQ6IGdyaWRIb3N0LCBlZGl0b3JQYXJ0SG9zdDogdW5kZWZpbmVkIH0pLFxuXHRcdFx0XHRzZXRGb2N1c2VkTGVhZkNvbnRhaW5lcjogKCkgPT4geyB9LFxuXHRcdFx0XHRmb2N1czogKCkgPT4geyB9LFxuXHRcdFx0fSBhcyB1bmtub3duIGFzIElDb252ZXJzYXRpb25QYXJ0U2VydmljZSxcblx0XHRcdGVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0XHRyb3N0ZXJTZXJ2aWNlLFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKCksXG5cdFx0XHR7XG5cdFx0XHRcdGVycm9yOiAobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IpID0+IHtcblx0XHRcdFx0XHRlcnJvcnMucHVzaCh0eXBlb2YgbWVzc2FnZSA9PT0gJ3N0cmluZycgPyBtZXNzYWdlIDogZ2V0RXJyb3JNZXNzYWdlKG1lc3NhZ2UpKTtcblx0XHRcdFx0fSxcblx0XHRcdH0gYXMgSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0KSk7XG5cblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGNvbnN0IHByaW1hcnlJZCA9IHJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHRhcmdldCA9IHJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0dGhyb3dPbkNyZWF0ZSA9IHRydWU7XG5cdFx0YXdhaXQgc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyh0YXJnZXQpO1xuXG5cdFx0YXNzZXJ0Lm9rKGVycm9ycy5zb21lKGVycm9yID0+IGVycm9yLmluY2x1ZGVzKCdyZXZlYWwgYm9vbScpKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldFByaW1hcnlTZXNzaW9uS2V5KCksIHByaW1hcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyh0YXJnZXQpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5vayghc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0QWxsTGVhZlNlc3Npb25LZXlzKCkuaW5jbHVkZXModGFyZ2V0KSk7XG5cdFx0YXNzZXJ0Lm9rKCFjb252ZXJzYXRpb25QYXJ0cy5zb21lKHBhcnQgPT4gcGFydC5zZXNzaW9uS2V5ID09PSB0YXJnZXQpKTtcblxuXHRcdHRocm93T25DcmVhdGUgPSBmYWxzZTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KHRhcmdldCk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyh0YXJnZXQpKTtcblx0XHRhc3NlcnQub2soY29udmVyc2F0aW9uUGFydHMuc29tZShwYXJ0ID0+IHBhcnQuc2Vzc2lvbktleSA9PT0gdGFyZ2V0KSk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyh0YXJnZXQpPy5jb250YWluZXIuaXNDb25uZWN0ZWQpO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiBvcGVuVHdvTGlnaHR3ZWlnaHRMZWF2ZXMoKSB7XG5cdFx0Y29uc3QgZXJyb3JzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVMaWdodHdlaWdodFdpbmRvd0hhcm5lc3MoKTtcblx0XHRoYXJuZXNzLnNldE5vdGlmeUVycm9yKG1lc3NhZ2UgPT4ge1xuXHRcdFx0ZXJyb3JzLnB1c2godHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnID8gbWVzc2FnZSA6IGdldEVycm9yTWVzc2FnZShtZXNzYWdlKSk7XG5cdFx0fSk7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRjb25zdCBwcmltYXJ5SWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5lbnN1cmVQcmltYXJ5V2luZG93KHByaW1hcnlJZCk7XG5cdFx0Y29uc3Qgc2Vjb25kYXJ5SWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0YXdhaXQgaGFybmVzcy5zZXNzaW9uV2luZG93U2VydmljZS5vcGVuU2Vzc2lvbkJlc2lkZShzZWNvbmRhcnlJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYXJuZXNzLnNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGNvbnN0IGluY29taW5nSWQgPSBoYXJuZXNzLnJvc3RlclNlcnZpY2Uuc2VlZFNlc3Npb25RdWlldGx5KCk7XG5cdFx0cmV0dXJuIHsgaGFybmVzcywgZXJyb3JzLCBwcmltYXJ5SWQsIHNlY29uZGFyeUlkLCBpbmNvbWluZ0lkIH07XG5cdH1cblxuXHR0ZXN0KCdzZWNvbmRhcnkgcmVwbGFjZSBjcmVhdGUgZmFpbHVyZSByZXN0b3JlcyB0aGUgb3V0Z29pbmcgbGVhZiBhbmQgbm90aWZpZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBoYXJuZXNzLCBlcnJvcnMsIHByaW1hcnlJZCwgc2Vjb25kYXJ5SWQsIGluY29taW5nSWQgfSA9IGF3YWl0IG9wZW5Ud29MaWdodHdlaWdodExlYXZlcygpO1xuXHRcdGNvbnN0IHsgc2Vzc2lvbldpbmRvd1NlcnZpY2UsIGNvbnZlcnNhdGlvblBhcnRzIH0gPSBoYXJuZXNzO1xuXHRcdGhhcm5lc3Muc2V0VGhyb3dPbkNyZWF0ZSh0cnVlKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGluY29taW5nSWQsIHsgcmVwbGFjZTogc2Vjb25kYXJ5SWQgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhpbmNvbWluZ0lkKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIXNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpLmluY2x1ZGVzKGluY29taW5nSWQpKTtcblx0XHRhc3NlcnQub2soIWNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IGluY29taW5nSWQpKTtcblx0XHRhc3NlcnQub2soZXJyb3JzLnNvbWUoZXJyb3IgPT4gZXJyb3IuaW5jbHVkZXMoJ3JldmVhbCBib29tJykpKTtcblx0fSk7XG5cblx0dGVzdCgnc2Vjb25kYXJ5IHJlcGxhY2Ugd2hlblJlYWR5IGZhaWx1cmUgcmVzdG9yZXMgdGhlIG91dGdvaW5nIGxlYWYgYW5kIG5vdGlmaWVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgaGFybmVzcywgZXJyb3JzLCBwcmltYXJ5SWQsIHNlY29uZGFyeUlkLCBpbmNvbWluZ0lkIH0gPSBhd2FpdCBvcGVuVHdvTGlnaHR3ZWlnaHRMZWF2ZXMoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlLCBjb252ZXJzYXRpb25QYXJ0cyB9ID0gaGFybmVzcztcblx0XHRoYXJuZXNzLnNldFJlamVjdFdoZW5SZWFkeSh0cnVlKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGluY29taW5nSWQsIHsgcmVwbGFjZTogc2Vjb25kYXJ5SWQgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuaXNTZXNzaW9uV2luZG93VmlzaWJsZShzZWNvbmRhcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dWaXNpYmxlKHByaW1hcnlJZCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRWaXNpYmxlV2luZG93Q291bnQoKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhpbmNvbWluZ0lkKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQub2soIXNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldEFsbExlYWZTZXNzaW9uS2V5cygpLmluY2x1ZGVzKGluY29taW5nSWQpKTtcblx0XHRhc3NlcnQub2soIWNvbnZlcnNhdGlvblBhcnRzLnNvbWUocGFydCA9PiBwYXJ0LnNlc3Npb25LZXkgPT09IGluY29taW5nSWQpKTtcblx0XHRhc3NlcnQub2soZXJyb3JzLnNvbWUoZXJyb3IgPT4gZXJyb3IuaW5jbHVkZXMoJ3doZW5SZWFkeSBib29tJykpKTtcblx0fSk7XG5cblx0dGVzdCgncHJpbWFyeSByZXBsYWNlIGNyZWF0ZSBmYWlsdXJlIGRvZXMgbm90IGhpZGUgdGhlIG9sZCBwcmltYXJ5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgaGFybmVzcywgZXJyb3JzLCBwcmltYXJ5SWQsIHNlY29uZGFyeUlkLCBpbmNvbWluZ0lkIH0gPSBhd2FpdCBvcGVuVHdvTGlnaHR3ZWlnaHRMZWF2ZXMoKTtcblx0XHRjb25zdCB7IHNlc3Npb25XaW5kb3dTZXJ2aWNlIH0gPSBoYXJuZXNzO1xuXHRcdGhhcm5lc3Muc2V0VGhyb3dPbkNyZWF0ZSh0cnVlKTtcblx0XHRhd2FpdCBzZXNzaW9uV2luZG93U2VydmljZS5yZXZlYWxTZXNzaW9uV2luZG93KGluY29taW5nSWQsIHsgcmVwbGFjZTogcHJpbWFyeUlkIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd0hpZGRlbihwcmltYXJ5SWQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25XaW5kb3dTZXJ2aWNlLmlzU2Vzc2lvbldpbmRvd1Zpc2libGUoc2Vjb25kYXJ5SWQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0UHJpbWFyeVNlc3Npb25LZXkoKSwgcHJpbWFyeUlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vzc2lvbldpbmRvd1NlcnZpY2UuZ2V0VmlzaWJsZVdpbmRvd0NvdW50KCksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5nZXRMZWFmU2xvdHMoaW5jb21pbmdJZCksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKCFzZXNzaW9uV2luZG93U2VydmljZS5nZXRBbGxMZWFmU2Vzc2lvbktleXMoKS5pbmNsdWRlcyhpbmNvbWluZ0lkKSk7XG5cdFx0YXNzZXJ0Lm9rKGVycm9ycy5zb21lKGVycm9yID0+IGVycm9yLmluY2x1ZGVzKCdyZXZlYWwgYm9vbScpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJzE3IGhpZGluZyBhIGxlYWYgcmVsZWFzZXMgaXRzIGxlbnMgbGVhc2UgYW5kIHJlc3RvcmUgcmVhY3F1aXJlcyBpdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBoYXJuZXNzID0gYXdhaXQgY3JlYXRlUmV2ZWFsSGFybmVzcygpO1xuXHRcdGNvbnN0IHsgcGFydHMsIHNlc3Npb25XaW5kb3dTZXJ2aWNlLCByb3N0ZXJTZXJ2aWNlLCBwcmltYXJ5SWQsIHNlc3Npb25DaGF0U2VydmljZSB9ID0gaGFybmVzcztcblx0XHRhd2FpdCBzZXNzaW9uQ2hhdFNlcnZpY2Uub3BlbkV4dGVuc2lvblRhYihwcmltYXJ5SWQsICdmb3JrLWxlYXNlJywgeyB0aXRsZTogJ0ZvcmsgbGVhc2UnIH0pO1xuXHRcdGNvbnN0IHBhbmVBID0gYXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgcGFydEEgPSBwYXJ0Rm9yKHBhcnRzLCBwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHRhYkNvdW50ID0gcGFydEEuYWN0aXZlR3JvdXAuY291bnQ7XG5cdFx0YXNzZXJ0Lm9rKHRhYkNvdW50ID49IDIpO1xuXHRcdGFzc2VydC5vayhwYW5lQS5hY3RpdmVDb252ZXJzYXRpb25MZW5zKTtcblxuXHRcdGNvbnN0IGIgPSByb3N0ZXJTZXJ2aWNlLnNlZWRTZXNzaW9uUXVpZXRseSgpO1xuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3coYik7XG5cdFx0YXdhaXQgd2FpdEZvclNlc3Npb25QYW5lKGhhcm5lc3MsIGIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXNzaW9uV2luZG93U2VydmljZS5pc1Nlc3Npb25XaW5kb3dIaWRkZW4ocHJpbWFyeUlkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRBLmFjdGl2ZUdyb3VwLmNvdW50LCB0YWJDb3VudCk7XG5cdFx0Y29uc3QgaGlkZGVuTGVuc2VzID0gYXdhaXQgY29sbGVjdExlYWZDb252ZXJzYXRpb25MZW5zZXMocGFydEEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoaWRkZW5MZW5zZXMubGVuZ3RoLCB0YWJDb3VudCk7XG5cdFx0Zm9yIChjb25zdCBsZW5zIG9mIGhpZGRlbkxlbnNlcykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRBLnNlc3Npb25LZXksIHByaW1hcnlJZCk7XG5cdFx0Y29uc3QgaGlkZGVuTGVhZiA9IHNlc3Npb25XaW5kb3dTZXJ2aWNlLmdldExlYWZTbG90cyhwcmltYXJ5SWQpPy5jb250YWluZXI7XG5cdFx0YXNzZXJ0Lm9rKGhpZGRlbkxlYWY/LmNsYXNzTGlzdC5jb250YWlucyhjb252ZXJzYXRpb25TZXNzaW9uTGVhZkhpZGRlbkNsYXNzKSk7XG5cdFx0Y29uc3Qgc3RhbGVCYW5uZXIgPSBoaWRkZW5MZWFmPy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc3RhbGUtc25hcHNob3QnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKCFzdGFsZUJhbm5lciB8fCBzdGFsZUJhbm5lci5oaWRkZW4gfHwgIXN0YWxlQmFubmVyLnRleHRDb250ZW50KTtcblxuXHRcdGF3YWl0IHNlc3Npb25XaW5kb3dTZXJ2aWNlLnJldmVhbFNlc3Npb25XaW5kb3cocHJpbWFyeUlkKTtcblx0XHRjb25zdCBwYW5lQTIgPSBhd2FpdCB3YWl0Rm9yU2Vzc2lvblBhbmUoaGFybmVzcywgcHJpbWFyeUlkKTtcblx0XHRjb25zdCByZXN0b3JlZExlbnNlcyA9IGF3YWl0IGNvbGxlY3RMZWFmQ29udmVyc2F0aW9uTGVuc2VzKHBhcnRGb3IocGFydHMsIHByaW1hcnlJZCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlZExlbnNlcy5sZW5ndGgsIHRhYkNvdW50KTtcblx0XHRmb3IgKGNvbnN0IGxlbnMgb2YgcmVzdG9yZWRMZW5zZXMpIHtcblx0XHRcdGFzc2VydC5vayhsZW5zLnNlc3Npb25WaWV3TGVhc2UsICdyZXN0b3JlIG11c3QgcmVhY3F1aXJlIHNlc3Npb25WaWV3TGVhc2Ugb24gZXZlcnkgbGVhZiBsZW5zJyk7XG5cdFx0fVxuXHRcdGFzc2VydC5vayhwYW5lQTIuYWN0aXZlQ29udmVyc2F0aW9uTGVucz8uc2Vzc2lvblZpZXdMZWFzZSwgJ3Jlc3RvcmUgbXVzdCByZWFjcXVpcmUgc2Vzc2lvblZpZXdMZWFzZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBsZWFrIHVuaGFuZGxlZCByZWplY3Rpb24gd2hlbiBvbkRpZENoYW5nZUFjdGl2ZVNlc3Npb24gcmV2ZWFsIGNhdGNoLXBhdGggbm90aWNlIHRocm93cyBhbmQgb25VbmV4cGVjdGVkRXJyb3Igd2Fybi10aGVuLXJldGhyb3dzJywgYXN5bmMgKCkgPT4ge1xuXHRcdC8vIHJldmVhbFNlc3Npb25XaW5kb3cgYWxyZWFkeSBjYXRjaGVzIGNyZWF0ZSB0aHJvdzsgYSBsb25lIGlubmVyIHJlamVjdCBkb2VzIG5vdCBsZWFrLlxuXHRcdC8vIFRoZSB2b2lkIG9uRGlkQ2hhbmdlQWN0aXZlU2Vzc2lvbiBjYWxsIHNpdGUgc3RpbGwgbmVlZHMgYC5jYXRjaGAgd2hlbiB0aGUgY2F0Y2gtcGF0aCBub3RpY2UgdGhyb3dzLlxuXHRcdC8vIEEgbG9uZSBgLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKWAgc3RpbGwgbGVha3Mgd2hlbiB0aGUgaGFuZGxlciB3YXJuLXRoZW4tcmV0aHJvd3MuXG5cdFx0Y29uc3QgcGFpbnRCb29tID0gbmV3IEVycm9yKCdwYWludCBib29tJyk7XG5cdFx0Y29uc3QgaGFybmVzcyA9IGNyZWF0ZUxpZ2h0d2VpZ2h0V2luZG93SGFybmVzcygpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0Y29uc3QgcHJpbWFyeUlkID0gaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGF3YWl0IGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UuZW5zdXJlUHJpbWFyeVdpbmRvdyhwcmltYXJ5SWQpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGhhcm5lc3Mucm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRoYXJuZXNzLnNldFRocm93T25DcmVhdGUodHJ1ZSk7XG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRoYXJuZXNzLnNldE5vdGlmeUVycm9yKCgpID0+IHtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fSk7XG5cdFx0XHRoYXJuZXNzLnJvc3RlclNlcnZpY2UuZmlyZUFjdGl2ZVNlc3Npb24odGFyZ2V0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBub3QgbGVhayB1bmhhbmRsZWQgcmVqZWN0aW9uIHdoZW4gYXR0YWNoR3JpZCBwZW5kaW5nIHJldmVhbCBjYXRjaC1wYXRoIG5vdGljZSB0aHJvd3MgYW5kIG9uVW5leHBlY3RlZEVycm9yIHdhcm4tdGhlbi1yZXRocm93cycsIGFzeW5jICgpID0+IHtcblx0XHQvLyByZXZlYWxTZXNzaW9uV2luZG93IGFscmVhZHkgY2F0Y2hlcyBjcmVhdGUgdGhyb3c7IGEgbG9uZSBpbm5lciByZWplY3QgZG9lcyBub3QgbGVhay5cblx0XHQvLyBUaGUgdm9pZCBhdHRhY2hHcmlkIHBlbmRpbmcgY2FsbCBzaXRlIHN0aWxsIG5lZWRzIGAuY2F0Y2hgIHdoZW4gdGhlIGNhdGNoLXBhdGggbm90aWNlIHRocm93cy5cblx0XHQvLyBBIGxvbmUgYC5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcilgIHN0aWxsIGxlYWtzIHdoZW4gdGhlIGhhbmRsZXIgd2Fybi10aGVuLXJldGhyb3dzLlxuXHRcdGNvbnN0IHBhaW50Qm9vbSA9IG5ldyBFcnJvcigncGFpbnQgYm9vbScpO1xuXHRcdGNvbnN0IGhhcm5lc3MgPSBjcmVhdGVMaWdodHdlaWdodFdpbmRvd0hhcm5lc3MoeyBkZWxheVNsb3RzOiB0cnVlIH0pO1xuXHRcdGNvbnN0IHRhcmdldCA9IGhhcm5lc3Mucm9zdGVyU2VydmljZS5zZWVkU2Vzc2lvblF1aWV0bHkoKTtcblx0XHRoYXJuZXNzLnNldFRocm93T25DcmVhdGUodHJ1ZSk7XG5cdFx0YXdhaXQgYXNzZXJ0V2FyblRoZW5SZXRocm93RG9lc05vdExlYWsocGFpbnRCb29tLCAoKSA9PiB7XG5cdFx0XHRoYXJuZXNzLnNldE5vdGlmeUVycm9yKCgpID0+IHtcblx0XHRcdFx0dGhyb3cgcGFpbnRCb29tO1xuXHRcdFx0fSk7XG5cdFx0XHR2b2lkIGhhcm5lc3Muc2Vzc2lvbldpbmRvd1NlcnZpY2UucmV2ZWFsU2Vzc2lvbldpbmRvdyh0YXJnZXQsIHsgcmVwbGFjZTogaGFybmVzcy5yb3N0ZXJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpIH0pO1xuXHRcdFx0aGFybmVzcy5hdHRhY2hTbG90cygpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXNzaW9uIHdpbmRvdyBmaXJlLWFuZC1mb3JnZXQgdm9pZHMgZG91YmxlLWNhdGNoIG9uVW5leHBlY3RlZEVycm9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IF9fcmVhZEZpbGVJblRlc3RzKGAke3Byb2Nlc3MuY3dkKCl9L3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb252ZXJzYXRpb24vYnJvd3Nlci9jb252ZXJzYXRpb25TZXNzaW9uV2luZG93U2VydmljZS50c2ApO1xuXHRcdGNvbnN0IGRvdWJsZUNhdGNoID0gJy5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpJztcblx0XHRhc3NlcnQub2soc291cmNlLmluY2x1ZGVzKGB2b2lkIHRoaXMucmV2ZWFsU2Vzc2lvbldpbmRvdyhzZXNzaW9uS2V5KSR7ZG91YmxlQ2F0Y2h9YCkpO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoYHZvaWQgdGhpcy5yZXZlYWxTZXNzaW9uV2luZG93KHBlbmRpbmcuc2Vzc2lvbktleSwgcGVuZGluZy5vcHRpb25zKSR7ZG91YmxlQ2F0Y2h9YCkpO1xuXHRcdGFzc2VydC5vayhzb3VyY2UuaW5jbHVkZXMoYHZvaWQgdGhpcy5lbnN1cmVQcmltYXJ5V2luZG93KHRoaXMucm9zdGVyU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSkke2RvdWJsZUNhdGNofWApKTtcblx0XHRhc3NlcnQub2soIXNvdXJjZS5pbmNsdWRlcygndm9pZCB0aGlzLnJldmVhbFNlc3Npb25XaW5kb3coc2Vzc2lvbktleSk7JykpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIHRoaXMucmV2ZWFsU2Vzc2lvbldpbmRvdyhwZW5kaW5nLnNlc3Npb25LZXksIHBlbmRpbmcub3B0aW9ucyk7JykpO1xuXHRcdGFzc2VydC5vayghc291cmNlLmluY2x1ZGVzKCd2b2lkIHRoaXMuZW5zdXJlUHJpbWFyeVdpbmRvdyh0aGlzLnJvc3RlclNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCkpOycpKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVcsd0JBQXdCO0FBQzVDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGNBQWMsaUJBQWlCLGlDQUFpQztBQUN6RSxTQUFTLFNBQVMsYUFBYTtBQUUvQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGFBQWEsc0JBQXNCO0FBRTVDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCLGdDQUE4RDtBQUN6RixTQUFrQyw0QkFBNEI7QUFDOUQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBZ0Q7QUFDekQsU0FBUyxtQkFBbUIsb0JBQW9CLHFCQUFxQixxQ0FBcUM7QUFDMUcsU0FBUyw2QkFBNkI7QUFDdEMsT0FBTztBQUNQLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsMkNBQTJDO0FBQ3BELFNBQVMsMENBQTBDO0FBQ25ELFNBQVMsK0JBQStCLHNDQUFzQztBQUM5RSxTQUFTLGdDQUFnQyx1Q0FBdUM7QUFDaEYsU0FBUyxtQkFBbUIsNkJBQTZCO0FBQ3pELFNBQVMsa0NBQWtDLHlDQUF5QztBQUNwRixTQUFTLHlCQUF5QixrQ0FBa0M7QUFDcEUsU0FBUywwQ0FBMEM7QUFDbkQsU0FBUyxxQ0FB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
