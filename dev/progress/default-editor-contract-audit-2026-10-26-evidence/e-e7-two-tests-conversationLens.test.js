import assert from "assert";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { toDisposable } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ConversationPart } from "../../../../browser/parts/conversation/conversationPart.js";
import { Parts } from "../../../../services/layout/browser/layoutService.js";
import { ChatEditorInput } from "../../../chat/browser/widgetHosts/editor/chatEditorInput.js";
import { TestLayoutService, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { ConversationChatInput } from "../../common/conversationChatInput.js";
import { ConversationEditorPane } from "../../browser/conversationEditorPane.js";
import { ConversationLens, latestAdmittedInboxContextUsage } from "../../browser/conversationLens.js";
import { stubConversationTimelineLinkServices } from "./conversationTimelineLinkTestStubs.js";
import { conversationLensStaleSnapshotClass } from "../../browser/conversationLensReadingColumn.js";
import { formatSyncChromeLabel } from "../../browser/conversationSessionView.js";
import { conversationLensUserBubbleShowLess, conversationLensUserBubbleShowMore, conversationLensTurnRegenerate } from "../../browser/conversationTimelineRenderer.js";
import {
  conversationLensDockControlHeightPx,
  conversationLensDockEditExit,
  conversationLensDockEditingMessage,
  conversationLensDockEngineNotConnected,
  conversationLensDockGoal,
  conversationLensDockInboxNoQueue,
  conversationLensDockInboxQueueLabel,
  conversationLensDockMaximizeInput,
  conversationLensDockGoalUnavailable,
  conversationLensDockNoGoal,
  conversationLensDockNoModel,
  conversationLensDockNoTools,
  conversationLensDockNoEngineTools,
  conversationLensDockPermissionAsk,
  conversationLensDockPermissionLabel,
  conversationLensDockPermissionPermit,
  conversationLensDockPlaceholder,
  conversationLensPostFailed,
  conversationLensPostFailedDisconnected,
  conversationLensDockRestoreTimeline,
  conversationLensDockStop,
  conversationLensDockStopNotGenerating,
  conversationLensDockAddTitle,
  conversationLensDockTuneTitle,
  conversationLensInputMaximizedClass,
  conversationLensPhasePreFirstClass,
  conversationLensPhasePreFirstDockHiddenClass,
  conversationLensPrefirstHeroClass,
  conversationLensInboxQueueEditingTag,
  conversationLensInboxQueuePause
} from "../../browser/conversationLensDockStrings.js";
import { conversationLensDockAgentUnavailable, conversationLensDockEngineCapabilityUnsupported, conversationLensDockModelFailed, conversationLensDockModelUnavailable, conversationLensDockPermissionUnavailable } from "../../browser/conversationLensComposerChrome.js";
import {
  conversationLensSessionBarConversationTab,
  conversationLensSessionBarCloseExtensionTabs,
  conversationLensSessionBarDeleteSession,
  conversationLensSessionBarGoBack,
  conversationLensSessionBarGoForward,
  conversationLensSessionBarHistory,
  conversationLensSessionBarMore,
  conversationLensSessionBarNewSession,
  conversationLensSessionBarSnapshots,
  conversationLensSessionBarNoTrajectory,
  conversationLensSessionBarTrajectoryTab,
  conversationLensPinnedUserPromptAria,
  conversationLensPinnedUserPromptCopyAria,
  conversationLensTurnCopy,
  conversationLensTurnDelete
} from "../../browser/conversationLensSessionBarStrings.js";
import { ConversationStubService, IConversationRosterService } from "../../browser/conversationStubService.js";
import { ENGINE_BIND_FAILED_SESSION_ID } from "../../browser/conversationEngineRosterService.js";
import { loadUaClientComposerDraft, storeUaClientComposerDraft } from "../../browser/uaClientComposerDrafts.js";
import { IUniverseAgentConnection } from "../../../../../platform/universeAgent/common/universeAgentConnection.js";
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from "../common/conversationConnectionTestStub.js";
import { entriesToLegacyTurns, projectSnapshotToEntries } from "../../browser/conversationSessionView.js";
import { CONVERSATION_LENS_ID_STORAGE_KEY, conversationLensIdStorageKey } from "../../browser/conversationLensProjection.js";
import { TestConversationFrameSource } from "./testConversationFrameSource.js";
import { conversationIdentityStripClass } from "../../browser/conversationIdentityStrip.js";
import { ConversationWorkRootMountModel, IConversationWorkRootMount } from "../../browser/conversationWorkRootMount.js";
import { getConversationSessionStatusText } from "../../browser/conversationSessionStatus.js";
import { shouldRenderTurnAsMarkdown } from "../../browser/conversationTurnMarkdown.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { TestClipboardService } from "../../../../../platform/clipboard/test/common/testClipboardService.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IExplorerService } from "../../../files/browser/files.js";
import { ISCMService } from "../../../scm/common/scm.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { ILayoutService } from "../../../../../platform/layout/browser/layoutService.js";
import { IWebviewService } from "../../../webview/browser/webview.js";
import { IConversationTimelineRevealService } from "../../browser/conversationTimelineRevealService.js";
import { IConversationReviewNavService } from "../../browser/conversationReviewEntry.js";
import { flushConversationLensLayout, installConversationLensResizeObserverHarness, yieldConversationLensPaint } from "./conversationLensLayoutHarness.js";
import { getWindow } from "../../../../../base/browser/dom.js";
suite("ConversationLens", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  const lensSlotsByPart = /* @__PURE__ */ new WeakMap();
  installConversationLensResizeObserverHarness();
  function getLensSlots(part) {
    const slots = lensSlotsByPart.get(part);
    assert.ok(slots);
    return slots;
  }
  async function flushTimelineHeightUpdates() {
    await flushConversationLensLayout();
  }
  async function flushAnimationFrames() {
    await flushConversationLensLayout();
  }
  async function inflateTimelineRowHeights(lens, layout, rowHeight = 400) {
    const timelineTree = getTimelineTree(lens);
    for (const el of Array.from(timelineTree.domNode.querySelectorAll(".conversation-timeline-item, .conversation-lens-turn"))) {
      el.style.minHeight = `${rowHeight}px`;
    }
    layout();
    await flushAnimationFrames();
    await flushTimelineHeightUpdates();
  }
  teardown(async () => {
    await flushConversationLensLayout();
  });
  const LENS_LAYOUT_WIDTH = 640;
  const LENS_LAYOUT_HEIGHT = 480;
  const LENS_MIN_WIDTH = 300;
  function getLensTab(slots, lensId) {
    const tabHost = slots.sessionBar ?? slots.lensTablist;
    assert.ok(tabHost);
    const tab = tabHost.querySelector(`button.conversation-lens-lens-tab[data-lens-id="${lensId}"]`);
    assert.ok(tab);
    return tab;
  }
  function clickLensTab(slots, lensId) {
    getLensTab(slots, lensId).click();
  }
  function getReadingColumn(slots) {
    const column = slots.timeline.querySelector(".conversation-lens-reading-column");
    assert.ok(column);
    return column;
  }
  function getTimelineScroll(slots) {
    const scroll = slots.timeline.querySelector(".conversation-lens-timeline-scroll");
    assert.ok(scroll);
    return scroll;
  }
  function getTimelineEmpty(slots) {
    const empty = getTimelineScroll(slots).querySelector(".conversation-lens-timeline-empty");
    if (!empty || empty.style.display === "none") {
      return null;
    }
    return empty;
  }
  async function flushProjectedTimeline(layoutReadingColumn2) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    layoutReadingColumn2?.();
  }
  async function showVisualizeSeed(stubService, layoutReadingColumn2) {
    stubService.switchSession("visualize");
    await flushProjectedTimeline(layoutReadingColumn2);
    await flushTimelineHeightUpdates();
  }
  function isRevealedTurnPainted(lens, turnId) {
    const tree = getTimelineTree(lens);
    return !!tree.getTimelineRowElement(turnId) || !!tree.domNode.querySelector(`[data-turn-id="${turnId}"]`) || !!tree.domNode.querySelector(`[data-fold-id="${turnId}"]`);
  }
  function restoreDelegateRowHeights(lens) {
    const timelineTree = getTimelineTree(lens);
    for (const el of Array.from(timelineTree.domNode.querySelectorAll(".conversation-timeline-item, .conversation-lens-turn"))) {
      el.style.minHeight = "";
    }
  }
  async function revealVisualizeTurn(lens, layoutReadingColumn2, turnId) {
    const tree = getTimelineTree(lens);
    await new Promise((resolve) => setTimeout(resolve, 16));
    layoutReadingColumn2();
    tree.revealTurn(turnId, 0);
    layoutReadingColumn2();
    if (isRevealedTurnPainted(lens, turnId)) {
      return;
    }
    restoreDelegateRowHeights(lens);
    layoutReadingColumn2();
    tree.revealTurn(turnId, 0);
    layoutReadingColumn2();
    for (let attempt = 0; attempt < 4; attempt++) {
      if (isRevealedTurnPainted(lens, turnId)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 16));
      restoreDelegateRowHeights(lens);
      layoutReadingColumn2();
      tree.revealTurn(turnId, 0);
      layoutReadingColumn2();
    }
  }
  async function revealUntitledProcessFold(lens, layoutReadingColumn2) {
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
  }
  async function revealLatestTurn(lens, stubService, layoutReadingColumn2, match) {
    const turn = [...stubService.getTurns(stubService.getActiveSessionId())].reverse().find(match);
    assert.ok(turn);
    await revealVisualizeTurn(lens, layoutReadingColumn2, turn.id);
    return turn.id;
  }
  function scrollTimelineToEndWithoutClobber(lens) {
    getTimelineTree(lens).scrollToEnd();
  }
  function queryTimeline(slots, selector) {
    return slots.timeline.querySelector(selector);
  }
  function queryAllTimeline(slots, selector) {
    return slots.timeline.querySelectorAll(selector);
  }
  function getTimelineTree(lens) {
    return lens.timelineTree;
  }
  function getTrajectoryView(lens) {
    return lens.trajectoryView;
  }
  function countTrajectoryRecordRows(slots) {
    return slots.timeline.querySelectorAll(".conversation-lens-trajectory-record-row").length;
  }
  function isPinnedUserPromptPainted(slots, expectedPreview) {
    const host = getPinnedUserPrompt(slots);
    if (!host?.classList.contains("conversation-timeline-pinned-user--visible")) {
      return false;
    }
    const preview = host.querySelector(".conversation-timeline-pinned-user-text")?.textContent ?? "";
    return expectedPreview === void 0 ? preview.length > 0 : preview === expectedPreview;
  }
  async function paintTrajectoryRows(lens, slots, stubService, layout, expectedCount) {
    const view = getTrajectoryView(lens);
    const recordIds = stubService.getTurns(stubService.getActiveSessionId()).map((turn) => turn.id);
    await yieldConversationLensPaint();
    layout();
    for (const recordId of recordIds) {
      view.revealRecord(recordId);
    }
    layout();
    if (countTrajectoryRecordRows(slots) === expectedCount) {
      return;
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      if (countTrajectoryRecordRows(slots) === expectedCount) {
        return;
      }
      await yieldConversationLensPaint();
      layout();
      for (const recordId of recordIds) {
        view.revealRecord(recordId);
      }
      layout();
    }
  }
  async function scrollTimelineAwayFromPinnedRead(lens, slots, layout, rowHeight = 400) {
    const timelineTree = getTimelineTree(lens);
    const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
    assert.ok(assistantTurn);
    const turnId = assistantTurn.getAttribute("data-turn-id");
    assert.ok(turnId);
    for (let attempt = 0; attempt < 4; attempt++) {
      await yieldConversationLensPaint();
      layout();
      await inflateTimelineRowHeights(lens, layout, rowHeight + attempt * 40);
      timelineTree.setScrollLock(false);
      layout();
      timelineTree.revealTurn(turnId, 0);
      layout();
      const atBottom = timelineTree.isScrolledToBottom();
      const pinnedPainted = isPinnedUserPromptPainted(slots);
      if (!atBottom && pinnedPainted) {
        return;
      }
    }
    assert.fail("could not scroll timeline away from bottom");
  }
  function getPinnedUserPrompt(slots) {
    return queryTimeline(slots, ".conversation-timeline-pinned-user");
  }
  function getPinnedUserPromptBubble(slots) {
    return queryTimeline(slots, ".conversation-timeline-pinned-user-bubble");
  }
  function layoutReadingColumn(lens, slots, layoutWidth = LENS_LAYOUT_WIDTH, layoutHeight = LENS_LAYOUT_HEIGHT) {
    const readingColumn = slots.timeline.querySelector(".conversation-lens-reading-column");
    const timelineScroll = slots.timeline.querySelector(".conversation-lens-timeline-scroll");
    const contentHost = slots.timeline.querySelector(".conversation-lens-timeline-content");
    const treeContainer = slots.timeline.querySelector(".conversation-timeline-tree");
    if (readingColumn) {
      readingColumn.style.width = `${layoutWidth}px`;
      readingColumn.style.height = `${layoutHeight}px`;
    }
    if (timelineScroll) {
      timelineScroll.style.height = `${layoutHeight - 120}px`;
      timelineScroll.style.minHeight = `${layoutHeight - 120}px`;
    }
    if (contentHost) {
      contentHost.style.display = "";
      contentHost.style.minHeight = `${layoutHeight - 120}px`;
    }
    if (treeContainer) {
      treeContainer.style.height = `${layoutHeight - 120}px`;
    }
    const trajectoryHost = slots.timeline.querySelector(".conversation-lens-trajectory");
    const trajectoryScroll = slots.timeline.querySelector(".conversation-lens-trajectory-table-scroll");
    if (trajectoryHost) {
      trajectoryHost.style.height = `${LENS_LAYOUT_HEIGHT - 120}px`;
      trajectoryHost.style.minHeight = `${LENS_LAYOUT_HEIGHT - 120}px`;
    }
    if (trajectoryScroll) {
      trajectoryScroll.style.height = `${LENS_LAYOUT_HEIGHT - 200}px`;
      trajectoryScroll.style.minHeight = `${LENS_LAYOUT_HEIGHT - 200}px`;
    }
    if (slots.sessionBar) {
      slots.sessionBar.style.width = `${layoutWidth}px`;
      slots.sessionBar.style.minWidth = `${layoutWidth}px`;
    }
    const timelineHeight = layoutHeight - 120;
    lens.layout(timelineHeight, layoutWidth);
  }
  function getPrefirstHero(slots) {
    return getReadingColumn(slots).querySelector(`.${conversationLensPrefirstHeroClass}`);
  }
  function countComposers(slots) {
    return slots.timeline.querySelectorAll(".conversation-lens-composer").length + slots.dock.querySelectorAll(".conversation-lens-composer").length;
  }
  function getInboxOverlay(slots) {
    const overlay = slots.dock.querySelector(".conversation-lens-inbox-overlay");
    assert.ok(overlay);
    return overlay;
  }
  function getInboxQueueChip(slots) {
    const chip = getInboxOverlay(slots).querySelector(".conversation-lens-inbox-queue");
    assert.ok(chip);
    return chip;
  }
  function getVisibleInboxListPanel() {
    for (const panel of document.querySelectorAll(".conversation-lens-inbox-list-panel")) {
      const host = panel.closest(".context-view");
      if (!host || host.style.display !== "none") {
        return panel;
      }
    }
    return null;
  }
  function getInboxGoalButton(slots) {
    const button = slots.dock.querySelector(".conversation-lens-inbox-goal .conversation-lens-inbox-goal-button");
    assert.ok(button);
    return button;
  }
  function getInboxStopButton(slots) {
    const button = slots.dock.querySelector(".conversation-lens-inbox-stop .conversation-lens-inbox-stop-button");
    assert.ok(button);
    return button;
  }
  function getComposerBottomBar(slots) {
    const bottomBar = slots.dock.querySelector(".conversation-lens-dock-bottom-bar") ?? getReadingColumn(slots).querySelector(".conversation-lens-dock-bottom-bar");
    assert.ok(bottomBar);
    return bottomBar;
  }
  function getPermissionSelect(slots) {
    const select = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-permission select.monaco-select-box");
    assert.ok(select);
    return select;
  }
  function getModelSelect(slots) {
    const select = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-model select.monaco-select-box");
    assert.ok(select);
    return select;
  }
  function getAgentSelect(slots) {
    const select = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-agent select.monaco-select-box");
    assert.ok(select);
    return select;
  }
  function getAgentReadonlyLabel(slots) {
    const label = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-agent .conversation-lens-dock-agent-readonly");
    assert.ok(label);
    return label;
  }
  function assertDisconnectedComposerCatalogsHonest(slots) {
    const agentContainer = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-agent");
    const modelSelect = getModelSelect(slots);
    assert.strictEqual(agentContainer.querySelector("select"), null);
    const agentLabel = getAgentReadonlyLabel(slots);
    assert.strictEqual(agentLabel.textContent, conversationLensDockAgentUnavailable);
    assert.strictEqual(agentLabel.getAttribute("aria-label"), conversationLensDockAgentUnavailable);
    assert.strictEqual(modelSelect.options.length, 1);
    assert.strictEqual(modelSelect.options[0]?.text, conversationLensDockNoModel);
    assert.ok(![...modelSelect.options].some((option) => option.text === "Stub model"));
  }
  async function waitForModelOption(slots, text) {
    for (let i = 0; i < 16; i++) {
      if ([...getModelSelect(slots).options].some((option) => option.text === text)) {
        return;
      }
      await Promise.resolve();
    }
    assert.fail(`model option "${text}" did not load`);
  }
  function getDockSendButton(slots) {
    const button = slots.dock.querySelector(".conversation-lens-dock-send .monaco-button") ?? getReadingColumn(slots).querySelector(".conversation-lens-dock-send .monaco-button");
    assert.ok(button);
    return button;
  }
  function selectDockModel(slots, optionIndex) {
    const bottomBar = getComposerBottomBar(slots);
    const modelSelect = bottomBar.querySelector(".conversation-lens-dock-model select.monaco-select-box");
    assert.ok(modelSelect);
    modelSelect.selectedIndex = optionIndex;
    modelSelect.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
  }
  function getDockTextarea(slots) {
    const textarea = slots.dock.querySelector("textarea.conversation-lens-dock-input") ?? getReadingColumn(slots).querySelector("textarea.conversation-lens-dock-input");
    assert.ok(textarea);
    return textarea;
  }
  async function sendDockDraft(slots, message) {
    const textarea = getDockTextarea(slots);
    const sendButton = getDockSendButton(slots);
    textarea.value = message;
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    sendButton.click();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  async function sendDockDraftAndFlush(slots, message, layoutReadingColumn2) {
    await sendDockDraft(slots, message);
    await new Promise((resolve) => setTimeout(resolve, 0));
    layoutReadingColumn2?.();
    await flushTimelineHeightUpdates();
  }
  function dispatchDockKeydown(textarea, keyCode) {
    const domKeyCodeByVsCode = {
      [KeyCode.Enter]: 13,
      [KeyCode.Escape]: 27,
      [KeyCode.UpArrow]: 38,
      [KeyCode.DownArrow]: 40,
      [KeyCode.Space]: 32
    };
    const domKeyCode = domKeyCodeByVsCode[keyCode];
    assert.ok(domKeyCode !== void 0, `missing DOM keyCode mapping for ${keyCode}`);
    textarea.dispatchEvent(new KeyboardEvent("keydown", { keyCode: domKeyCode, bubbles: true, cancelable: true }));
  }
  function getSessionSelectLabel(slots) {
    const select = slots.sessionBar.querySelector(".conversation-lens-session-select select.monaco-select-box");
    if (!select || select.options.length === 0) {
      return void 0;
    }
    return select.options[select.selectedIndex]?.text;
  }
  function mountLens(options) {
    const instantiationService = workbenchInstantiationService(void 0, store);
    const storageService = options?.storageService ?? store.add(new TestStorageService());
    instantiationService.stub(IStorageService, storageService);
    if (options?.configurationService) {
      instantiationService.stub(IConfigurationService, options.configurationService);
    }
    const stubService = options?.stubService ?? store.add(new ConversationStubService());
    const clipboardService = new TestClipboardService();
    const openInEditorCalls = { count: 0 };
    instantiationService.stub(IConversationRosterService, stubService);
    stubConversationTimelineLinkServices(instantiationService);
    instantiationService.stub(IUniverseAgentConnection, options?.connection ?? createConversationConnectionTestStub());
    instantiationService.stub(IConversationWorkRootMount, store.add(new ConversationWorkRootMountModel()));
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
    instantiationService.stub(IClipboardService, clipboardService);
    instantiationService.stub(ICommandService, new class {
      constructor() {
        this.onWillExecuteCommand = Event.None;
        this.onDidExecuteCommand = Event.None;
      }
      executeCommand(id) {
        if (id === "_mermaid-markdown.openInEditor") {
          openInEditorCalls.count++;
        }
        return Promise.resolve(void 0);
      }
    }());
    instantiationService.stub(IExtensionService, {
      _serviceBrand: void 0,
      getExtension: () => Promise.resolve(void 0)
    });
    instantiationService.stub(IWebviewService, {
      _serviceBrand: void 0,
      activeWebview: void 0,
      webviews: [],
      onDidChangeActiveWebview: Event.None,
      createWebviewOverlay: () => {
        throw new Error("not used");
      },
      createWebviewElement: () => ({
        mountTo(parent2) {
          const el = document.createElement("div");
          el.setAttribute("data-mermaid-host", "stub");
          parent2.appendChild(el);
        },
        setHtml() {
        },
        postMessage: () => Promise.resolve(true),
        onDidWheel: Event.None,
        onFatalError: Event.None,
        intrinsicContentSize: observableValue("intrinsicContentSize", void 0),
        dispose() {
        }
      })
    });
    const layoutContainer = document.createElement("div");
    layoutContainer.classList.add("monaco-workbench");
    const parent = document.createElement("div");
    parent.classList.add("part", "conversation");
    const layoutWidth = options?.layoutWidth ?? LENS_LAYOUT_WIDTH;
    const layoutHeight = options?.layoutHeight ?? LENS_LAYOUT_HEIGHT;
    parent.style.width = `${layoutWidth}px`;
    parent.style.height = `${layoutHeight}px`;
    layoutContainer.appendChild(parent);
    document.body.appendChild(layoutContainer);
    store.add(toDisposable(() => layoutContainer.remove()));
    const layoutService = new TestLayoutService();
    layoutService.getContainer = () => layoutContainer;
    instantiationService.stub(ILayoutService, layoutService);
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
    const part = store.add(instantiationService.createInstance(ConversationPart));
    part.create(parent);
    const partSlots = part.getSlots();
    assert.ok(partSlots);
    const lensTablist = document.createElement("div");
    const slots = {
      sessionBar: options?.tablistOnly ? void 0 : partSlots.sessionBar,
      lensTablist: options?.tablistOnly ? lensTablist : void 0,
      timeline: document.createElement("div"),
      dock: document.createElement("div"),
      sessionKey: options?.sessionKey,
      pinConversationLens: options?.pinConversationLens,
      filterAgentId: options?.filterAgentId
    };
    slots.timeline.classList.add("conversation-timeline", "part", "conversation");
    slots.dock.classList.add("conversation-dock");
    if (slots.lensTablist) {
      parent.appendChild(slots.lensTablist);
    }
    parent.appendChild(slots.timeline);
    parent.appendChild(slots.dock);
    part.layout(layoutWidth, layoutHeight, 0, 0);
    const layoutCallbacks = [];
    const runLayouts = () => {
      for (const layout2 of layoutCallbacks) {
        layout2();
      }
    };
    store.add(stubService.onDidChangeSession(() => runLayouts()));
    store.add(stubService.onDidChangeActiveSession(() => runLayouts()));
    const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
    lensSlotsByPart.set(part, slots);
    const layout = () => layoutReadingColumn(lens, slots, layoutWidth, layoutHeight);
    layoutCallbacks.push(layout);
    layout();
    const contentHost = slots.timeline.querySelector(".conversation-lens-timeline-content");
    if (contentHost) {
      contentHost.style.display = "";
    }
    layout();
    return { part, lens, stubService, clipboardService, storageService, layoutReadingColumn: layout, openInEditorCalls, layoutContainer };
  }
  async function seedPendingConfirmation(stubService, layoutReadingColumn2, message = "Write README.md?") {
    const sessionId = stubService.createSession();
    stubService.appendUserTurn(sessionId, "Help me scaffold the project README.");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    stubService.appendConfirmationTurn(sessionId, message);
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    return sessionId;
  }
  function userMessageLines(lineCount) {
    return Array.from({ length: lineCount }, (_, index) => `User line ${index + 1}`).join("\n");
  }
  function getUserTurnBody(slots) {
    const body = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body');
    assert.ok(body);
    return body;
  }
  function getUserFoldButton(slots) {
    return queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-fold-button');
  }
  test("short user turn does not show Show more control", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendUserTurn(sessionId, userMessageLines(2));
    await flushProjectedTimeline(layoutReadingColumn2);
    assert.strictEqual(getUserFoldButton(slots), null);
    assert.strictEqual(getUserTurnBody(slots).classList.contains("conversation-lens-turn-body--collapsed"), false);
  });
  test("long user turn collapses with Show more and full-text title", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const message = userMessageLines(8);
    stubService.appendUserTurn(sessionId, message);
    await flushProjectedTimeline(layoutReadingColumn2);
    const body = getUserTurnBody(slots);
    const foldButton = getUserFoldButton(slots);
    assert.ok(body.classList.contains("conversation-lens-turn-body--collapsed"));
    assert.ok(foldButton);
    assert.strictEqual(foldButton.textContent, conversationLensUserBubbleShowMore);
    assert.strictEqual(body.getAttribute("title"), message);
    const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]');
    const fold = userTurn.querySelector(".conversation-lens-turn-fold");
    assert.ok(fold);
    assert.strictEqual(userTurn.querySelector(".conversation-lens-turn-actions"), null);
  });
  test("Show more expands user bubble and Show less collapses it again", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendUserTurn(sessionId, userMessageLines(8));
    await flushProjectedTimeline(layoutReadingColumn2);
    const body = getUserTurnBody(slots);
    const foldButton = getUserFoldButton(slots);
    foldButton.click();
    await flushProjectedTimeline(layoutReadingColumn2);
    assert.strictEqual(body.classList.contains("conversation-lens-turn-body--collapsed"), false);
    assert.strictEqual(foldButton.textContent, conversationLensUserBubbleShowLess);
    assert.strictEqual(foldButton.getAttribute("aria-expanded"), "true");
    assert.strictEqual(body.getAttribute("title"), null);
    foldButton.click();
    await flushProjectedTimeline(layoutReadingColumn2);
    assert.ok(body.classList.contains("conversation-lens-turn-body--collapsed"));
    assert.strictEqual(foldButton.textContent, conversationLensUserBubbleShowMore);
    assert.strictEqual(foldButton.getAttribute("aria-expanded"), "false");
    assert.strictEqual(body.getAttribute("title"), userMessageLines(8));
  });
  test("long assistant stub echo does not get user bubble collapse chrome", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendStubEchoAssistant(sessionId, userMessageLines(8));
    await flushProjectedTimeline(layoutReadingColumn2);
    const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
    assert.ok(assistantTurn);
    assert.strictEqual(assistantTurn.querySelector(".conversation-lens-turn-fold"), null);
    assert.strictEqual(assistantTurn.querySelector(".conversation-lens-turn-body--collapsed"), null);
  });
  test("default session shows seeded untitled fixture without fake engine history", async () => {
    const { part, stubService, lens, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const pendingButton = slots.dock.querySelector(".conversation-lens-inbox-pending");
    assert.strictEqual(stubService.getSessions().length, 2);
    assert.strictEqual(stubService.getTurns(stubService.getActiveSessionId()).length, 7);
    assert.strictEqual(getTimelineEmpty(slots), null);
    await revealUntitledProcessFold(lens, layoutReadingColumn2);
    assert.ok(queryTimeline(slots, "[data-process-fold]"));
    await revealVisualizeTurn(lens, layoutReadingColumn2, "untitled-u1");
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
    await revealVisualizeTurn(lens, layoutReadingColumn2, "untitled-c1");
    assert.ok(queryTimeline(slots, ".conversation-lens-confirmation-seat"));
    assert.ok(pendingButton);
    assert.ok(!pendingButton.hidden);
  });
  test("fills SessionBar, stub timeline, and stub dock slots", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-bar"));
    assert.ok(slots.timeline.querySelector(".conversation-lens-timeline"));
    assert.ok(slots.dock.querySelector(".conversation-lens-dock"));
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-select"));
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-history"));
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-snapshots"));
    assert.ok(getReadingColumn(slots).classList.contains("is-medium"));
    assert.ok(!getReadingColumn(slots).classList.contains("is-narrow"));
    assert.ok(slots.sessionBar.querySelector('.conversation-lens-lens-tab[data-lens-id="trajectory"]'));
    assert.ok(slots.timeline.querySelector(".conversation-lens-trajectory"));
    assert.ok(slots.dock.querySelector(".conversation-lens-dock-gate-row"));
    assert.ok(slots.dock.querySelector(".conversation-lens-inbox-overlay"));
    assert.ok(slots.dock.querySelector("textarea.conversation-lens-dock-input"));
  });
  test("exposes Agent IDE chrome landmarks", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-icon"));
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-title"));
    assert.ok(slots.sessionBar.querySelector('.conversation-lens-lens-tabs[role="tablist"]'));
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-switcher-label"));
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-history"));
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-snapshots"));
    assert.ok(getReadingColumn(slots));
    assert.ok(slots.timeline.querySelector(".conversation-lens-timeline-scroll"));
    assert.ok(slots.timeline.querySelector(".conversation-lens-timeline-content"));
    assert.ok(slots.dock.querySelector(".conversation-lens-composer"));
    assert.ok(slots.dock.querySelector(".conversation-lens-dock-input-row"));
    assert.ok(slots.dock.querySelector(".conversation-lens-dock-bottom-bar"));
    assert.ok(slots.dock.querySelector(".conversation-lens-dock-send"));
    assert.ok(slots.dock.querySelector(".conversation-lens-dock-gate-row"));
    assert.ok(slots.dock.querySelector(".conversation-lens-dock-model"));
    assert.strictEqual(slots.dock.querySelector(".conversation-lens-inbox-task"), null);
    assert.ok(slots.dock.querySelector(".conversation-lens-inbox-queue"));
  });
  test("compact chrome: scroll region is timeline inner scroll only", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const timelineSlot = slots.timeline;
    assert.ok(timelineSlot.querySelector(".conversation-lens-timeline-scroll"));
    assert.strictEqual(timelineSlot.classList.contains("conversation-timeline"), true);
    assert.ok(!timelineSlot.querySelector(".conversation-lens-dock"));
  });
  test("compact chrome: dock composer textarea with bottom bar send", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const textarea = slots.dock.querySelector("textarea.conversation-lens-dock-input");
    const inputRow = slots.dock.querySelector(".conversation-lens-dock-input-row");
    const bottomBar = slots.dock.querySelector(".conversation-lens-dock-bottom-bar");
    const sendButton = bottomBar.querySelector(".conversation-lens-dock-send .monaco-button");
    assert.strictEqual(textarea.rows, 1);
    assert.strictEqual(textarea.placeholder, conversationLensDockPlaceholder);
    assert.ok(inputRow.contains(textarea));
    assert.ok(sendButton);
    assert.ok(bottomBar.contains(sendButton.parentElement));
    assert.ok(!inputRow.querySelector(".conversation-lens-dock-send"));
  });
  test("T2 composer chrome: 32px bottom bar with tune permission model more send codicons", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const bottomBar = getComposerBottomBar(slots);
    const bottomBarMinHeight = parseInt(getWindow(bottomBar).getComputedStyle(bottomBar).minHeight, 10);
    if (bottomBarMinHeight > 0) {
      assert.strictEqual(bottomBarMinHeight, 28);
    }
    const leading = bottomBar.querySelector(".conversation-lens-dock-bottom-leading");
    const trailing = bottomBar.querySelector(".conversation-lens-dock-bottom-trailing");
    assert.ok(leading.querySelector(".conversation-lens-dock-add .codicon-add"));
    assert.ok(leading.querySelector(".conversation-lens-dock-tune .codicon-tools"));
    assert.ok(leading.querySelector(".conversation-lens-dock-permission .monaco-select-box"));
    assert.ok(leading.querySelector(".conversation-lens-dock-more .codicon-ellipsis"));
    assert.ok(trailing.querySelector(".conversation-lens-dock-model .monaco-select-box"));
    assert.strictEqual(trailing.querySelector(".conversation-lens-dock-templates"), null);
    assert.strictEqual(trailing.querySelector(".conversation-lens-dock-maximize-input"), null);
    assert.ok(bottomBar.parentElement.querySelector(".conversation-lens-dock-input-row .conversation-lens-dock-maximize-input .codicon-screen-full"));
    assert.strictEqual(trailing.querySelector(".conversation-lens-dock-mic"), null);
    assert.ok(trailing.querySelector(".conversation-lens-dock-send .codicon-arrow-up"));
    const ghostTune = leading.querySelector(".conversation-lens-dock-tune .monaco-button");
    const filledSend = trailing.querySelector(".conversation-lens-dock-send .monaco-button");
    assert.ok(ghostTune.classList.contains("conversation-lens-dock-control--ghost"));
    assert.ok(filledSend.classList.contains("conversation-lens-dock-control--filled"));
    for (const control of bottomBar.querySelectorAll(".conversation-lens-dock-control")) {
      const controlElement = control;
      if (controlElement.classList.contains("conversation-lens-dock-send-button")) {
        const sendHeight = parseInt(getWindow(controlElement).getComputedStyle(controlElement).height, 10);
        if (sendHeight > 0) {
          assert.strictEqual(sendHeight, 24);
        }
        continue;
      }
      const height = parseInt(getWindow(controlElement).getComputedStyle(controlElement).height, 10);
      if (height > 0) {
        assert.strictEqual(height, conversationLensDockControlHeightPx);
      }
    }
    const tuneButton = leading.querySelector(".conversation-lens-dock-tune .monaco-button");
    assert.strictEqual(tuneButton.getAttribute("aria-label"), conversationLensDockTuneTitle);
    assert.strictEqual(leading.querySelector(".conversation-lens-dock-route"), null);
    const permissionSelect = leading.querySelector(".conversation-lens-dock-permission select.monaco-select-box");
    const modelSelect = trailing.querySelector(".conversation-lens-dock-model select.monaco-select-box");
    assert.strictEqual(permissionSelect.options[permissionSelect.selectedIndex]?.text, conversationLensDockPermissionAsk);
    assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, conversationLensDockNoModel);
    assertDisconnectedComposerCatalogsHonest(slots);
    const sendButton = getDockSendButton(slots);
    assert.strictEqual(sendButton.classList.contains("disabled"), true);
    const textarea = getDockTextarea(slots);
    textarea.value = "hello";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(sendButton.classList.contains("disabled"), false);
  });
  test("permission select is disabled until the engine can setPermissionMode", () => {
    const connection = createConversationConnectionTestStub({
      setPermissionMode: async () => ({ ok: true })
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    const permissionSelect = getPermissionSelect(slots);
    const permissionContainer = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-permission");
    assert.strictEqual(permissionSelect.disabled, true);
    assert.strictEqual(permissionSelect.getAttribute("aria-label"), `${conversationLensDockPermissionLabel} \u2014 ${conversationLensDockPermissionUnavailable}`);
    assert.strictEqual(permissionContainer.title, conversationLensDockPermissionUnavailable);
    stubService.setEngineConnected(true);
    assert.strictEqual(permissionSelect.disabled, false);
    assert.strictEqual(permissionSelect.getAttribute("aria-label"), conversationLensDockPermissionLabel);
    assert.strictEqual(permissionContainer.title, conversationLensDockPermissionLabel);
  });
  test("agent slot is read-only without SwitchAgent and does not load profiles", async () => {
    const capabilities = createEmptyTestCapabilitySnapshot();
    let listAgentProfilesCalls = 0;
    const connection = createConversationConnectionTestStub({
      getCapabilitySnapshot: () => ({
        ...capabilities,
        agentProfiles: { support: "SUPPORTED" }
      }),
      listAgentProfiles: async () => {
        listAgentProfilesCalls++;
        return { profiles: [{ id: "coder", name: "Coder", source: "user" }] };
      }
    });
    const { part, stubService, lens } = mountLens({ connection });
    const slots = getLensSlots(part);
    const sessionId = stubService.getActiveSessionId();
    const agentContainer = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-agent");
    assert.strictEqual(agentContainer.querySelector("select"), null);
    const label = getAgentReadonlyLabel(slots);
    assert.strictEqual(label.textContent, conversationLensDockAgentUnavailable);
    assert.strictEqual(label.getAttribute("aria-label"), conversationLensDockAgentUnavailable);
    assert.strictEqual(label.title, conversationLensDockAgentUnavailable);
    assert.strictEqual(lens.getSessionConfig(sessionId).agentIndex, 0);
    assert.strictEqual(listAgentProfilesCalls, 0);
    stubService.setEngineConnected(true);
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
    assert.strictEqual(agentContainer.querySelector("select"), null);
    assert.strictEqual(getAgentReadonlyLabel(slots).textContent, conversationLensDockEngineCapabilityUnsupported);
    assert.strictEqual(lens.getSessionConfig(sessionId).agentIndex, 0);
    assert.strictEqual(listAgentProfilesCalls, 0);
  });
  test("agent select rolls back to agentIndex when SwitchAgent is available", async () => {
    const capabilities = createEmptyTestCapabilitySnapshot();
    const connection = createConversationConnectionTestStub({
      getCapabilitySnapshot: () => ({
        ...capabilities,
        agentProfiles: { support: "SUPPORTED" }
      }),
      listAgentProfiles: async () => ({ profiles: [{ id: "coder", name: "Coder", source: "user" }] })
    });
    connection.switchAgent = async () => ({ ok: true });
    const { part, stubService, lens } = mountLens({ connection });
    const slots = getLensSlots(part);
    const sessionId = stubService.getActiveSessionId();
    stubService.setEngineConnected(true);
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
    const agentSelect = getAgentSelect(slots);
    const coderIndex = [...agentSelect.options].findIndex((option) => option.text === "Coder");
    assert.ok(coderIndex >= 0);
    agentSelect.selectedIndex = coderIndex;
    agentSelect.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
    assert.strictEqual(lens.getSessionConfig(sessionId).agentIndex, 0);
    assert.strictEqual(agentSelect.selectedIndex, 0);
  });
  test("model select is disabled until the engine can switchModel", () => {
    const connection = createConversationConnectionTestStub({
      switchModel: async () => ({ resolvedModelId: "gpt-test", provider: "", level: 0, cost: "", speed: "" })
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    const modelSelect = getModelSelect(slots);
    const modelContainer = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-model");
    assert.strictEqual(modelSelect.disabled, true);
    assert.strictEqual(modelSelect.getAttribute("aria-label"), `Model \u2014 ${conversationLensDockModelUnavailable}`);
    assert.strictEqual(modelContainer.title, conversationLensDockModelUnavailable);
    stubService.setEngineConnected(true);
    assert.strictEqual(modelSelect.disabled, false);
    assert.strictEqual(modelSelect.getAttribute("aria-label"), "Model");
    assert.strictEqual(modelContainer.title, "Model");
  });
  test("model select keeps the first enabled model without switchModel and rolls a later pick back", async () => {
    const capabilities = createEmptyTestCapabilitySnapshot();
    const connection = createConversationConnectionTestStub({
      getCapabilitySnapshot: () => ({
        ...capabilities,
        models: { support: "SUPPORTED" }
      }),
      listModels: async () => ({
        models: [
          { id: "1", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-a" },
          { id: "2", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-b" }
        ]
      })
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    stubService.setEngineConnected(true);
    await waitForModelOption(slots, "gpt-b");
    const modelSelect = getModelSelect(slots);
    assert.strictEqual(modelSelect.selectedIndex, 0);
    assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, "gpt-a");
    selectDockModel(slots, 1);
    await Promise.resolve();
    assert.strictEqual(modelSelect.selectedIndex, 0);
    assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, "gpt-a");
  });
  test("permission select rolls back and shows the gate when setPermissionMode fails", async () => {
    const calls = [];
    const connection = createConversationConnectionTestStub({
      setPermissionMode: async (request) => {
        calls.push(request);
        return { ok: false, message: "engine rejected permit" };
      }
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    stubService.setEngineConnected(true);
    const permissionSelect = getPermissionSelect(slots);
    assert.strictEqual(permissionSelect.disabled, false);
    assert.strictEqual(permissionSelect.options[permissionSelect.selectedIndex]?.text, conversationLensDockPermissionAsk);
    permissionSelect.selectedIndex = 2;
    permissionSelect.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
    await Promise.resolve();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].mode, "SESSION_TOOL_PERMISSION_MODE_PERMIT");
    assert.strictEqual(permissionSelect.selectedIndex, 0);
    assert.strictEqual(permissionSelect.options[permissionSelect.selectedIndex]?.text, conversationLensDockPermissionAsk);
    const gateRow = slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes("engine rejected permit"));
  });
  test("model select does not call switchModel until the engine is connected", async () => {
    const calls = [];
    const connection = createConversationConnectionTestStub({
      switchModel: async (request) => {
        calls.push({ sessionId: request.sessionId, modelId: request.modelId });
        return { resolvedModelId: request.modelId, provider: "", level: 0, cost: "", speed: "" };
      }
    });
    const { part } = mountLens({ connection });
    const slots = getLensSlots(part);
    assertDisconnectedComposerCatalogsHonest(slots);
    selectDockModel(slots, 0);
    await Promise.resolve();
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(getModelSelect(slots).selectedIndex, 0);
    assert.strictEqual(getModelSelect(slots).options.length, 1);
  });
  test("model select writes sessionId and modelId when switchModel is available", async () => {
    const calls = [];
    const capabilities = createEmptyTestCapabilitySnapshot();
    const connection = createConversationConnectionTestStub({
      getCapabilitySnapshot: () => ({
        ...capabilities,
        models: { support: "SUPPORTED" }
      }),
      listModels: async () => ({
        models: [
          { id: "1", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-a" },
          { id: "2", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-b" }
        ]
      }),
      switchModel: async (request) => {
        calls.push({ sessionId: request.sessionId, modelId: request.modelId });
        return { resolvedModelId: request.modelId, provider: "p", level: 1, cost: "", speed: "" };
      }
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    stubService.setEngineConnected(true);
    await waitForModelOption(slots, "gpt-b");
    assert.strictEqual(calls.length, 0);
    assert.strictEqual(getModelSelect(slots).selectedIndex, 0);
    selectDockModel(slots, 1);
    await Promise.resolve();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].sessionId, stubService.getActiveSessionId());
    assert.strictEqual(calls[0].modelId, "gpt-b");
    assert.strictEqual(getModelSelect(slots).selectedIndex, 1);
  });
  test("model select rolls back and shows the gate when switchModel fails", async () => {
    const calls = [];
    const capabilities = createEmptyTestCapabilitySnapshot();
    const connection = createConversationConnectionTestStub({
      getCapabilitySnapshot: () => ({
        ...capabilities,
        models: { support: "SUPPORTED" }
      }),
      listModels: async () => ({
        models: [
          { id: "1", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-a" },
          { id: "2", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-b" }
        ]
      }),
      switchModel: async (request) => {
        calls.push({ sessionId: request.sessionId, modelId: request.modelId });
        throw new Error("engine rejected model");
      }
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    stubService.setEngineConnected(true);
    await waitForModelOption(slots, "gpt-b");
    const modelSelect = getModelSelect(slots);
    assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, "gpt-a");
    selectDockModel(slots, 1);
    await Promise.resolve();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].modelId, "gpt-b");
    assert.strictEqual(modelSelect.selectedIndex, 0);
    assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, "gpt-a");
    const gateRow = slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes("engine rejected model"));
  });
  test("model select rolls back and shows the gate when switchModel resolves with an empty resolvedModelId", async () => {
    const calls = [];
    const capabilities = createEmptyTestCapabilitySnapshot();
    const connection = createConversationConnectionTestStub({
      getCapabilitySnapshot: () => ({
        ...capabilities,
        models: { support: "SUPPORTED" }
      }),
      listModels: async () => ({
        models: [
          { id: "1", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-a" },
          { id: "2", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-b" }
        ]
      }),
      switchModel: async (request) => {
        calls.push({ sessionId: request.sessionId, modelId: request.modelId });
        return { resolvedModelId: "", provider: "", level: 0, cost: "", speed: "" };
      }
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    stubService.setEngineConnected(true);
    await waitForModelOption(slots, "gpt-b");
    const modelSelect = getModelSelect(slots);
    assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, "gpt-a");
    selectDockModel(slots, 1);
    await Promise.resolve();
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].modelId, "gpt-b");
    assert.strictEqual(modelSelect.selectedIndex, 0);
    assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, "gpt-a");
    const gateRow = slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes(conversationLensDockModelFailed));
  });
  test("narrow More permission radios stay disabled without setPermissionMode", () => {
    const { part } = mountLens({ layoutWidth: LENS_MIN_WIDTH });
    const slots = getLensSlots(part);
    const moreButton = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-more .monaco-button");
    moreButton.click();
    const radios = [...document.querySelectorAll('.conversation-lens-dock-more-permission [role="menuitemradio"]')];
    assert.strictEqual(radios.length, 3);
    assert.ok(radios.some((radio) => radio.textContent === conversationLensDockPermissionPermit));
    for (const radio of radios) {
      assert.strictEqual(radio.disabled, true);
      assert.strictEqual(radio.getAttribute("aria-disabled"), "true");
      assert.strictEqual(radio.title, conversationLensDockPermissionUnavailable);
    }
  });
  test("narrow More menu lists Add context before Tool options", () => {
    const { part } = mountLens({ layoutWidth: LENS_MIN_WIDTH });
    const slots = getLensSlots(part);
    const moreButton = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-more .monaco-button");
    moreButton.click();
    const popup = document.querySelector(".conversation-lens-dock-more-popup");
    assert.ok(popup);
    const add = [...popup.querySelectorAll(".conversation-lens-dock-more-item")].find((item) => item.textContent === conversationLensDockAddTitle);
    const tune = [...popup.querySelectorAll(".conversation-lens-dock-more-item")].find((item) => item.textContent === conversationLensDockTuneTitle);
    assert.ok(add);
    assert.ok(tune);
    assert.ok(add.compareDocumentPosition(tune) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  test("narrow More menu shows current agent before Tool options", () => {
    const { part } = mountLens({ layoutWidth: LENS_MIN_WIDTH });
    const slots = getLensSlots(part);
    const moreButton = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-more .monaco-button");
    moreButton.click();
    const popup = document.querySelector(".conversation-lens-dock-more-popup");
    assert.ok(popup);
    const agentNote = popup.querySelector(".conversation-lens-dock-more-agent");
    assert.ok(agentNote);
    assert.strictEqual(agentNote.getAttribute("role"), "note");
    assert.strictEqual(agentNote.textContent, conversationLensDockAgentUnavailable);
    const tune = [...popup.querySelectorAll(".conversation-lens-dock-more-item")].find((item) => item.textContent === conversationLensDockTuneTitle);
    assert.ok(tune);
    assert.ok(agentNote.compareDocumentPosition(tune) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  test("disconnected compose enables send from draft without Stub model", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const sendButton = getDockSendButton(slots);
    assert.strictEqual(sendButton.classList.contains("disabled"), true);
    assert.strictEqual(stubService.hasEngineConnectionHistory(), false);
    assertDisconnectedComposerCatalogsHonest(slots);
    const textarea = getDockTextarea(slots);
    textarea.value = "hello";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(sendButton.classList.contains("disabled"), false);
    sendButton.click();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const readingColumn = getReadingColumn(slots);
    assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), false, "first pending must leave PreFirst");
    assert.ok(!/已同步|synced/i.test(slots.dock.textContent ?? ""));
    assert.ok(!/已同步|synced/i.test(slots.sessionBar?.textContent ?? ""));
    assert.ok(!/已同步|synced/i.test(readingColumn.textContent ?? ""));
    assert.ok(stubService.getTurns(sessionId).some((turn) => turn.kind === "user" && turn.text === "hello"));
    assert.ok(stubService.getTurns(sessionId).some((turn) => turn.kind === "assistant" && /Stub echo/i.test(turn.text)));
    assert.strictEqual(textarea.value, "");
  });
  test("engine-cache disconnect keeps Send enabled and does not pretend delivered", async () => {
    class EngineCacheRoster extends ConversationStubService {
      hasEngineConnectionHistory() {
        return true;
      }
    }
    const roster = store.add(new EngineCacheRoster());
    const { part } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const sessionId = roster.createSession();
    const sendButton = getDockSendButton(slots);
    const textarea = getDockTextarea(slots);
    textarea.value = "keep this draft";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(sendButton.classList.contains("disabled"), false);
    sendButton.click();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(textarea.value, "keep this draft");
    assert.strictEqual(roster.getTurns(sessionId).length, 0);
    assert.strictEqual(roster.enqueueMessageQueueItem(sessionId, "keep this draft"), false);
    const gateRow = getReadingColumn(slots).querySelector(".conversation-lens-dock-gate-row") ?? slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.ok(gateRow);
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes(conversationLensPostFailedDisconnected));
    assert.ok(!/已同步|已发送|synced|delivered/i.test(gateRow.textContent ?? ""));
    assert.ok(!/已同步|synced/i.test(slots.sessionBar?.textContent ?? ""));
    assert.strictEqual(getReadingColumn(slots).classList.contains(conversationLensPhasePreFirstClass), true);
    assert.strictEqual(sendButton.classList.contains("disabled"), false);
  });
  test("engine-cache disconnect Send uses enqueue when the roster API accepts", async () => {
    class QueuingEngineCacheRoster extends ConversationStubService {
      constructor() {
        super(...arguments);
        this.queued = [];
      }
      hasEngineConnectionHistory() {
        return true;
      }
      enqueueMessageQueueItem(sessionId2, text) {
        const trimmed = text.trim();
        if (!trimmed) {
          return false;
        }
        this.queued.push(`${sessionId2}:${trimmed}`);
        return true;
      }
    }
    const roster = store.add(new QueuingEngineCacheRoster());
    const { part } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const sessionId = roster.createSession();
    const textarea = getDockTextarea(slots);
    textarea.value = "queued later";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    getDockSendButton(slots).click();
    await Promise.resolve();
    assert.deepStrictEqual(roster.queued, [`${sessionId}:queued later`]);
    assert.strictEqual(textarea.value, "");
    assert.strictEqual(roster.getTurns(sessionId).length, 0);
    assert.ok(!/已同步|已发送|synced/i.test(slots.dock.textContent ?? ""));
    assert.ok(!/已同步|已发送|synced/i.test(getReadingColumn(slots).textContent ?? ""));
  });
  test("PreFirst: centered composer cluster hides dock inbox and moves identity above composer", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const emptySessionId = stubService.createSession();
    assert.strictEqual(stubService.getActiveSessionId(), emptySessionId);
    const readingColumn = getReadingColumn(slots);
    const prefirstHero = getPrefirstHero(slots);
    assert.ok(prefirstHero);
    assert.ok(!prefirstHero.hidden);
    assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), true);
    assert.strictEqual(slots.dock.classList.contains(conversationLensPhasePreFirstDockHiddenClass), true);
    const dockInbox = slots.dock.querySelector(".conversation-lens-inbox-overlay");
    assert.ok(dockInbox);
    assert.ok(dockInbox.hidden);
    assert.strictEqual(slots.dock.querySelector(".conversation-lens-composer"), null);
    assert.strictEqual(readingColumn.querySelector(`.${conversationIdentityStripClass}`), prefirstHero.querySelector(`.${conversationIdentityStripClass}`));
    assert.ok(prefirstHero.querySelector(".conversation-lens-composer"));
    assert.ok(prefirstHero.querySelector(".conversation-lens-dock-gate-row"));
    assert.strictEqual(readingColumn.firstElementChild?.classList.contains(conversationIdentityStripClass), false);
  });
  test("Active: first message restores dock inbox row and identity at reading column top", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    await sendDockDraft(slots, "Hello PreFirst");
    const readingColumn = getReadingColumn(slots);
    assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), false);
    assert.strictEqual(slots.dock.classList.contains(conversationLensPhasePreFirstDockHiddenClass), false);
    assert.ok(slots.dock.querySelector(".conversation-lens-inbox-overlay"));
    assert.ok(slots.dock.querySelector(".conversation-lens-composer"));
    assert.strictEqual(readingColumn.firstElementChild?.classList.contains(conversationIdentityStripClass), true);
    assert.strictEqual(getPrefirstHero(slots)?.hidden, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(stubService.getTurns(sessionId).length, 2);
  });
  test("T3 SessionConfig XOR: agent only in PreFirst composer; no Route SelectBox; clearing turns returns PreFirst", async () => {
    const { part, stubService, lens } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const readingColumn = getReadingColumn(slots);
    const getLeading = () => getComposerBottomBar(slots).querySelector(".conversation-lens-dock-bottom-leading");
    const agentSlot = () => getLeading().querySelector(".conversation-lens-dock-agent");
    const queryRoute = (root) => root.querySelector(".conversation-lens-dock-route, .conversation-lens-session-route");
    assert.ok(agentSlot());
    assert.strictEqual(agentSlot().hidden, false);
    assert.strictEqual(queryRoute(getLeading()), null);
    assert.strictEqual(queryRoute(slots.sessionBar), null);
    assert.deepStrictEqual(Object.keys(lens.getSessionConfig(sessionId)).sort(), ["agentIndex", "permissionIndex"]);
    assert.strictEqual(agentSlot().querySelector("select"), null);
    const agentLabel = agentSlot().querySelector(".conversation-lens-dock-agent-readonly");
    assert.ok(agentLabel);
    assert.strictEqual(agentLabel.textContent, conversationLensDockAgentUnavailable);
    assertDisconnectedComposerCatalogsHonest(slots);
    await sendDockDraft(slots, "Hello Active");
    assert.strictEqual(agentSlot().hidden, true);
    assert.strictEqual(queryRoute(getComposerBottomBar(slots)), null);
    assert.strictEqual(queryRoute(slots.sessionBar), null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const turn of [...stubService.getTurns(sessionId)]) {
      stubService.deleteTurn(sessionId, turn.id);
    }
    assert.strictEqual(readingColumn.classList.contains(conversationLensPhasePreFirstClass), true);
    assert.strictEqual(agentSlot().hidden, false);
    assert.strictEqual(queryRoute(getLeading()), null);
    assert.strictEqual(queryRoute(slots.sessionBar), null);
  });
  test("T3 SessionConfig XOR: SessionBar has no Route SelectBox in PreFirst", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    stubService.createSession();
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-session-route"), null);
    stubService.createSession();
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-session-route"), null);
  });
  test("PreFirst layout does not give the empty timeline the full reading height", () => {
    const { lens, stubService, part } = mountLens();
    const slots = getLensSlots(part);
    stubService.createSession();
    lens.layout(600, 800);
    const readingColumn = getReadingColumn(slots);
    assert.ok(readingColumn.classList.contains(conversationLensPhasePreFirstClass));
    const prefirstHero = getPrefirstHero(slots);
    assert.ok(prefirstHero);
    assert.ok(!prefirstHero.hidden);
    assert.ok(prefirstHero.querySelector(".conversation-lens-composer"));
    assert.ok(readingColumn.querySelector(".conversation-lens-timeline"));
  });
  test("T3 SessionConfig: Route SelectBox is gone from composer and SessionBar", async () => {
    const { part, stubService, lens } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    assert.strictEqual(getComposerBottomBar(slots).querySelector(".conversation-lens-dock-route"), null);
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-session-route"), null);
    assert.deepStrictEqual(Object.keys(lens.getSessionConfig(sessionId)).sort(), ["agentIndex", "permissionIndex"]);
    await sendDockDraft(slots, "No pretend route setting");
    assert.strictEqual(getComposerBottomBar(slots).querySelector(".conversation-lens-dock-route"), null);
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-session-route"), null);
    assert.deepStrictEqual(Object.keys(lens.getSessionConfig(sessionId)).sort(), ["agentIndex", "permissionIndex"]);
  });
  test("Active inbox: left/right clusters with MessageQueue and no Task chip", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    stubService.createSession();
    await sendDockDraft(slots, "Activate inbox overlay");
    const overlay = getInboxOverlay(slots);
    const left = overlay.querySelector(".conversation-lens-inbox-left");
    const right = overlay.querySelector(".conversation-lens-inbox-right");
    assert.strictEqual(left.querySelector(".conversation-lens-inbox-task"), null);
    assert.ok(left.querySelector(".conversation-lens-inbox-queue"));
    assert.ok(left.querySelector(".conversation-lens-inbox-goal"));
    assert.ok(right.querySelector(".conversation-lens-inbox-stop"));
    assert.strictEqual(right.querySelector(".conversation-lens-inbox-context-ring"), null);
    assert.strictEqual(left.querySelector(".conversation-lens-inbox-label"), null);
    const queueChip = getInboxQueueChip(slots);
    assert.ok(queueChip.querySelector(".codicon-list-ordered"));
    assert.ok(queueChip.textContent?.includes(conversationLensDockInboxNoQueue));
    assert.ok(!queueChip.textContent?.includes(conversationLensDockInboxQueueLabel));
    assert.strictEqual(queueChip.getAttribute("aria-label"), `${conversationLensDockInboxQueueLabel}, ${conversationLensDockInboxNoQueue}`);
    assert.strictEqual(queueChip.title, `${conversationLensDockInboxQueueLabel}, ${conversationLensDockInboxNoQueue}`);
    assert.strictEqual(queueChip.getAttribute("aria-disabled"), "true");
    const goalButton = getInboxGoalButton(slots);
    assert.ok(goalButton.querySelector(".codicon-target"));
    assert.strictEqual(goalButton.getAttribute("data-goal-empty"), "true");
    assert.ok(!goalButton.textContent?.includes(conversationLensDockNoGoal));
  });
  function usageSnapshot(items) {
    return {
      sessionId: "ua-live",
      sync: { kind: "live" },
      timeline: items,
      overlay: { blocks: [] },
      pendingActions: [],
      localPendingSends: []
    };
  }
  function usageItem(id, orderKey, summary) {
    return {
      id,
      orderKey,
      summary
    };
  }
  test("latest admitted usage keeps contextPct only from the latest usage row", () => {
    assert.strictEqual(latestAdmittedInboxContextUsage(void 0), void 0);
    assert.strictEqual(latestAdmittedInboxContextUsage(usageSnapshot([])), void 0);
    assert.strictEqual(latestAdmittedInboxContextUsage(usageSnapshot([
      usageItem("usage-tokens", "0001", { kind: "usage", title: "tokens only", inputTokens: 9, outputTokens: 1 })
    ])), void 0);
    assert.deepStrictEqual(latestAdmittedInboxContextUsage(usageSnapshot([
      usageItem("usage-later-key", "0002", { kind: "usage", title: "later", contextPct: 20, inputTokens: 3 }),
      usageItem("usage-earlier-key", "0001", { kind: "usage", title: "earlier", contextPct: 90, outputTokens: 8 })
    ])), { contextPct: 20, inputTokens: 3 });
    assert.strictEqual(latestAdmittedInboxContextUsage(usageSnapshot([
      usageItem("usage-old", "0001", { kind: "usage", title: "old", contextPct: 90 }),
      usageItem("usage-new", "0002", { kind: "usage", title: "new", outputTokens: 1 })
    ])), void 0);
    assert.deepStrictEqual(latestAdmittedInboxContextUsage(usageSnapshot([
      usageItem("usage-zero", "0001", { kind: "usage", title: "zero", contextPct: 0, outputTokens: 0, inputTokens: Number.POSITIVE_INFINITY })
    ])), { contextPct: 0, outputTokens: 0 });
    const getterSummary = { kind: "usage", title: "getter" };
    Object.defineProperty(getterSummary, "contextPct", { get: () => 40, enumerable: true });
    assert.strictEqual(latestAdmittedInboxContextUsage(usageSnapshot([
      usageItem("usage-owned", "0001", { kind: "usage", title: "owned", contextPct: 10 }),
      { id: "usage-getter", orderKey: "0002", summary: getterSummary }
    ])), void 0);
    const inherited = Object.assign(/* @__PURE__ */ Object.create({ contextPct: 40 }), { kind: "usage", title: "inherited" });
    assert.strictEqual(latestAdmittedInboxContextUsage(usageSnapshot([
      { id: "usage-inherited", orderKey: "0001", summary: inherited }
    ])), void 0);
  });
  test("inbox context ring follows the lease snapshot and stays off the conversation timeline", async () => {
    const { part, lens, stubService } = mountLens();
    const slots = getLensSlots(part);
    stubService.createSession();
    await sendDockDraft(slots, "Activate inbox for context ring");
    const right = () => {
      const cluster = getInboxOverlay(slots).querySelector(".conversation-lens-inbox-right");
      assert.ok(cluster);
      return cluster;
    };
    assert.strictEqual(right().querySelector(".conversation-lens-inbox-context-ring"), null);
    const admitted = usageSnapshot([
      usageItem("usage-old", "0001", { kind: "usage", title: "old", contextPct: 10 }),
      usageItem("usage-latest", "0002", { kind: "usage", title: "latest", contextPct: 50, inputTokens: 12, outputTokens: 34 })
    ]);
    const previous = lens.sessionViewLease;
    lens.sessionViewLease = { snapshot: admitted };
    lens.renderInboxStatus();
    const ring = right().querySelector(".conversation-lens-inbox-context-ring");
    assert.ok(ring);
    assert.strictEqual(ring.getAttribute("data-context-pct"), "50");
    assert.strictEqual(ring.style.getPropertyValue("--conversation-inbox-context-pct"), "50");
    assert.strictEqual(ring.title, "Context: 50 \xB7 Input tokens: 12 \xB7 Output tokens: 34");
    assert.ok(right().querySelector(".conversation-lens-inbox-stop"));
    assert.ok(!projectSnapshotToEntries(admitted, /* @__PURE__ */ new Map(), /* @__PURE__ */ new Map()).some((entry) => entry.id === "usage-latest" || entry.id === "usage-old"));
    assert.strictEqual(slots.timeline.querySelector('[data-kind="usage"]'), null);
    lens.sessionViewLease = { snapshot: usageSnapshot([
      usageItem("usage-stale", "0001", { kind: "usage", title: "stale", contextPct: 80 }),
      usageItem("usage-bare", "0002", { kind: "usage", title: "bare" })
    ]) };
    lens.renderInboxStatus();
    assert.strictEqual(right().querySelector(".conversation-lens-inbox-context-ring"), null);
    lens.sessionViewLease = previous;
    lens.renderInboxStatus();
    assert.strictEqual(right().querySelector(".conversation-lens-inbox-context-ring"), null);
    lens.sessionViewLease = { snapshot: admitted };
    lens.renderInboxStatus();
    assert.ok(right().querySelector(".conversation-lens-inbox-context-ring"));
    lens.releaseSessionViewLeaseForHiddenLeaf();
    assert.strictEqual(lens.sessionViewLease, void 0);
    assert.strictEqual(right().querySelector(".conversation-lens-inbox-context-ring"), null);
  });
  test("inbox queue list opens without a Task chip or task list", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    await sendDockDraft(slots, "Open inbox lists");
    await flushProjectedTimeline(layoutReadingColumn2);
    assert.strictEqual(getInboxOverlay(slots).querySelector(".conversation-lens-inbox-task"), null);
    getInboxQueueChip(slots).click();
    assert.strictEqual(getVisibleInboxListPanel(), null);
    assert.strictEqual(getInboxQueueChip(slots).getAttribute("aria-pressed"), "false");
    stubService.setMessageQueueFixture(sessionId, {
      isPaused: false,
      isProcessing: false,
      items: [{
        id: "q-open",
        content: "Queued follow-up",
        status: "PENDING",
        hold: void 0,
        uploadProgress: void 0,
        retryCount: 0,
        lastError: void 0,
        locked: false,
        pinned: false
      }]
    });
    getInboxQueueChip(slots).click();
    const queuePanel = getVisibleInboxListPanel();
    assert.ok(queuePanel?.querySelector(".conversation-lens-message-queue-list"));
    assert.strictEqual(queuePanel?.querySelector(".conversation-lens-inbox-task-list"), null);
    assert.strictEqual(getInboxQueueChip(slots).getAttribute("aria-pressed"), "true");
  });
  test("message queue fixture renders Singularity queue rows with hold tag", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    await sendDockDraft(slots, "Queue fixture");
    await flushProjectedTimeline(layoutReadingColumn2);
    stubService.setMessageQueueFixture(sessionId, {
      isPaused: false,
      isProcessing: false,
      items: [{
        id: "q1",
        content: "Follow up after deploy",
        status: "PENDING",
        hold: void 0,
        uploadProgress: void 0,
        retryCount: 0,
        lastError: void 0,
        locked: false,
        pinned: false
      }]
    });
    getInboxQueueChip(slots).click();
    const panel = getVisibleInboxListPanel();
    const row = panel.querySelector('.queue-item[data-item-id="q1"]');
    assert.ok(row);
    assert.ok(panel.querySelector(".queue-bar-summary")?.textContent?.includes("1"));
    assert.ok(panel.querySelector(".queue-bar-action")?.textContent?.includes(conversationLensInboxQueuePause));
    row.click();
    assert.strictEqual(stubService.getMessageQueueState(sessionId).items[0]?.hold, "EDITING");
    assert.strictEqual(getVisibleInboxListPanel(), null);
    getInboxQueueChip(slots).click();
    const heldRow = getVisibleInboxListPanel()?.querySelector('.queue-item.hold-editing[data-item-id="q1"]');
    assert.ok(heldRow);
    assert.ok(heldRow?.querySelector(".queue-item-meta .tag.hold")?.textContent?.includes(conversationLensInboxQueueEditingTag));
  });
  test("inbox goal is honest: disabled without engine, no goal field", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const goalButton = getInboxGoalButton(slots);
    assert.ok(goalButton.classList.contains("disabled"));
    assert.strictEqual(goalButton.getAttribute("aria-disabled"), "true");
    assert.strictEqual(goalButton.getAttribute("aria-label"), `${conversationLensDockGoal} \u2014 ${conversationLensDockGoalUnavailable}`);
    assert.ok(goalButton.querySelector(".codicon-target"));
    assert.strictEqual(goalButton.getAttribute("data-goal-empty"), "true");
    assert.ok(!goalButton.textContent?.includes(conversationLensDockNoGoal));
    goalButton.click();
    assert.ok(goalButton.classList.contains("disabled"));
  });
  test("inbox stop is honest: disabled without engine, no stopLoop side effects", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    await sendDockDraft(slots, "Activate inbox chrome");
    const overlay = getInboxOverlay(slots);
    const stopButton = getInboxStopButton(slots);
    const turnCountBefore = queryAllTimeline(slots, ".conversation-lens-turn").length;
    const pendingButton = overlay.querySelector(".conversation-lens-inbox-pending");
    assert.ok(stopButton.classList.contains("disabled"));
    assert.strictEqual(stopButton.getAttribute("aria-disabled"), "true");
    assert.strictEqual(stopButton.getAttribute("aria-label"), `${conversationLensDockStop}, ${conversationLensDockStopNotGenerating}`);
    assert.strictEqual(stopButton.textContent?.trim(), conversationLensDockStop);
    stopButton.click();
    assert.strictEqual(queryAllTimeline(slots, ".conversation-lens-turn").length, turnCountBefore);
    assert.ok(getInboxQueueChip(slots).textContent?.includes(conversationLensDockInboxNoQueue));
    assert.strictEqual(pendingButton.hidden, true);
    assert.strictEqual(stubService.getTurns(sessionId).length, 2);
  });
  test("honest dock gate and model labels without Copilot CTAs", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const gateRow = slots.dock.querySelector(".conversation-lens-dock-gate-row");
    const identityEngine = getReadingColumn(slots).querySelector(".conversation-identity-chip-engine");
    const modelSelect = slots.dock.querySelector(".conversation-lens-dock-model select.monaco-select-box");
    const sendButton = getDockSendButton(slots);
    assert.ok(gateRow.hidden);
    assert.ok(identityEngine?.textContent?.includes(conversationLensDockEngineNotConnected));
    assert.strictEqual(modelSelect.options[modelSelect.selectedIndex]?.text, conversationLensDockNoModel);
    assertDisconnectedComposerCatalogsHonest(slots);
    assert.strictEqual(sendButton.getAttribute("aria-label"), "Send");
    assert.ok(sendButton.classList.contains("codicon-arrow-up"));
    assert.strictEqual(slots.dock.querySelector(".chat-setup"), null);
    assert.strictEqual(slots.dock.querySelector('.monaco-button[aria-label*="Sign in"]'), null);
  });
  test("connected dock hides gate, sends without stub model, and fills catalog labels", async () => {
    const capabilities = createEmptyTestCapabilitySnapshot();
    const connection = createConversationConnectionTestStub({
      getCapabilitySnapshot: () => ({
        ...capabilities,
        agentProfiles: { support: "SUPPORTED" },
        tools: { support: "SUPPORTED" },
        models: { support: "SUPPORTED" }
      }),
      listAgentProfiles: async () => ({ profiles: [{ id: "coder", name: "Coder", source: "user" }] }),
      listTools: async () => ({ tools: [{ name: "bash" }] }),
      listModels: async () => ({ models: [{ id: "1", type: "chat", enabled: true, level: 1, provider: "p", modelId: "gpt-test" }] })
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    stubService.setEngineConnected(true);
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
    const gateRow = slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.strictEqual(gateRow.hidden, true);
    assert.strictEqual(gateRow.textContent, "");
    assert.strictEqual(gateRow.getAttribute("aria-label"), null);
    assert.strictEqual(getPermissionSelect(slots).disabled, true);
    const textarea = getDockTextarea(slots);
    textarea.value = "hello engine";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    const sendButton = getDockSendButton(slots);
    assert.ok(!sendButton.classList.contains("disabled"), "connected send must not require Stub model");
    const agentContainer = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-agent");
    assert.strictEqual(agentContainer.querySelector("select"), null);
    assert.strictEqual(getAgentReadonlyLabel(slots).textContent, conversationLensDockEngineCapabilityUnsupported);
    const tuneButton = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-tune .monaco-button");
    tuneButton.click();
    const popup = document.querySelector(".conversation-lens-dock-tune-popup");
    assert.ok(popup?.textContent?.includes("bash"));
    assert.ok(!popup?.textContent?.includes(conversationLensDockNoTools));
  });
  test("connected catalog RPC throws keep No agent / No model / empty tools", async () => {
    const capabilities = createEmptyTestCapabilitySnapshot();
    const connection = createConversationConnectionTestStub({
      getCapabilitySnapshot: () => ({
        ...capabilities,
        agentProfiles: { support: "SUPPORTED" },
        tools: { support: "SUPPORTED" },
        models: { support: "SUPPORTED" }
      }),
      listAgentProfiles: async () => {
        throw new Error("listAgentProfiles exploded");
      },
      listTools: async () => {
        throw new Error("listTools exploded");
      },
      listModels: async () => {
        throw new Error("listModels exploded");
      }
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    stubService.setEngineConnected(true);
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
    const agentContainer = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-agent");
    assert.strictEqual(agentContainer.querySelector("select"), null);
    assert.strictEqual(getAgentReadonlyLabel(slots).textContent, conversationLensDockEngineCapabilityUnsupported);
    assert.strictEqual(getModelSelect(slots).options[getModelSelect(slots).selectedIndex]?.text, conversationLensDockNoModel);
    assert.ok(![...getModelSelect(slots).options].some((option) => option.text === "gpt-test"));
    assert.ok(![...getModelSelect(slots).options].some((option) => option.text === "Stub model"));
    const tuneButton = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-tune .monaco-button");
    tuneButton.click();
    const popup = document.querySelector(".conversation-lens-dock-tune-popup");
    assert.strictEqual(popup?.textContent, conversationLensDockNoEngineTools);
    assert.ok(!popup?.textContent?.includes("bash"));
  });
  test("connected Enter submits draft through lease.post(submitInput)", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.setEngineConnected(true);
    const textarea = getDockTextarea(slots);
    textarea.value = "hello engine";
    dispatchDockKeydown(textarea, KeyCode.Enter);
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(textarea.value, "");
    const userTurn = stubService.getTurns(sessionId).find((turn) => turn.kind === "user" && turn.text === "hello engine");
    assert.ok(userTurn, "submitInput must reach the session view lease when connected");
  });
  test("dock input exposes stable automation test ids", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    assert.strictEqual(getDockTextarea(slots).getAttribute("data-testid"), "conversation-composer-input");
    assert.strictEqual(getDockSendButton(slots).getAttribute("data-testid"), "conversation-composer-send");
  });
  test("dock input placeholder is product Message copy, not Ask anything", () => {
    assert.strictEqual(conversationLensDockPlaceholder, "Message");
    assert.ok(!conversationLensDockPlaceholder.toLowerCase().includes("ask anything"));
    assert.ok(!conversationLensDockPlaceholder.toLowerCase().includes("copilot"));
    const { part } = mountLens();
    const textarea = getLensSlots(part).dock.querySelector("textarea.conversation-lens-dock-input");
    assert.strictEqual(textarea.placeholder, conversationLensDockPlaceholder);
    assert.strictEqual(textarea.getAttribute("aria-label"), "Message");
  });
  test("add context lists the session and tools stays a separate button", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const session = stubService.getSessions().find((item) => item.id === sessionId);
    assert.ok(session);
    const bottomBar = getComposerBottomBar(slots);
    const addButton = bottomBar.querySelector(".conversation-lens-dock-add .monaco-button");
    assert.strictEqual(addButton.getAttribute("aria-label"), conversationLensDockAddTitle);
    assert.ok(bottomBar.querySelector(".conversation-lens-dock-tune .codicon-tools"));
    addButton.click();
    const popup = document.querySelector(".conversation-lens-dock-add-popup");
    assert.ok(popup);
    const option = [...popup.querySelectorAll(".conversation-lens-dock-add-option")].find((item) => item.textContent === session.title);
    assert.ok(option);
    option.click();
    assert.ok(bottomBar.parentElement.querySelector(".conversation-composer-ref-chip"));
    assert.strictEqual(document.querySelector(".conversation-lens-dock-attachment-list"), null);
    assert.strictEqual(document.querySelector(".chat-attachments-container"), null);
  });
  test("dock tune popup is honest and Templates chrome is gone", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const tuneButton = slots.dock.querySelector(".conversation-lens-dock-tune .monaco-button");
    assert.strictEqual(tuneButton.getAttribute("aria-label"), conversationLensDockTuneTitle);
    assert.strictEqual(slots.dock.querySelector(".conversation-lens-dock-templates"), null);
    tuneButton.click();
    const tunePopup = document.querySelector(".conversation-lens-dock-tune-popup");
    assert.ok(tunePopup);
    assert.strictEqual(tunePopup.textContent, conversationLensDockNoTools);
    tuneButton.click();
    assert.strictEqual(document.querySelector(".conversation-lens-dock-templates-popup"), null);
  });
  test("empty session shows timeline empty state without send-below hint", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const emptySessionId = stubService.createSession();
    assert.strictEqual(stubService.getActiveSessionId(), emptySessionId);
    const empty = getTimelineEmpty(slots);
    assert.ok(empty);
    assert.ok(empty.textContent?.includes("No messages yet"));
    assert.strictEqual(empty.querySelector(".conversation-lens-timeline-empty-hint"), null);
    assert.ok(!empty.textContent?.toLowerCase().includes("send a message below"));
    assert.strictEqual(stubService.getTurns(emptySessionId).length, 0);
  });
  test("renders confirmation as a timeline list item with Allow and Skip", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens({ layoutHeight: 1200 });
    const slots = getLensSlots(part);
    await seedPendingConfirmation(stubService, layoutReadingColumn2);
    const seat = queryTimeline(slots, ".conversation-lens-confirmation-seat");
    assert.ok(seat);
    assert.ok(seat.textContent?.includes("confirmation pending"));
    assert.ok(seat.textContent?.includes("Input needed"));
    assert.ok(seat.textContent?.includes("Write README.md?"));
    const buttons = [...seat.querySelectorAll("button, .monaco-button")].map((el) => el.textContent?.trim());
    assert.ok(buttons.some((label) => label === "Allow"));
    assert.ok(buttons.some((label) => label === "Skip"));
    assert.strictEqual(queryAllTimeline(slots, ".conversation-lens-turn").length >= 2, true);
  });
  test("renders user and assistant turns without visible You or Agent labels", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendUserTurn(sessionId, "What lives in the center lens?");
    stubService.appendStubEchoAssistant(sessionId, "SessionBar, timeline, and dock \u2014 not ChatEditor.");
    await flushProjectedTimeline(layoutReadingColumn2);
    const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]');
    const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
    assert.strictEqual(userTurn?.classList.contains("conversation-lens-turn--user-align-end"), false);
    const userBody = userTurn?.querySelector(".conversation-lens-turn-body");
    assert.ok(userBody?.classList.contains("conversation-lens-turn-body--user-bubble"));
    assert.strictEqual(userBody?.classList.contains("conversation-lens-turn-body--reading-text"), false);
    assert.ok(!userTurn?.textContent?.includes("You"));
    assert.ok(userTurn?.closest("article")?.getAttribute("aria-label")?.includes("You"));
    assert.ok(userBody);
    assert.strictEqual(assistantTurn?.classList.contains("conversation-lens-turn--user-align-end"), false);
    const assistantBody = assistantTurn?.querySelector(".conversation-lens-turn-body");
    assert.ok(assistantBody?.classList.contains("conversation-lens-turn-body--reading-text"));
    assert.strictEqual(assistantBody?.classList.contains("conversation-lens-turn-body--user-bubble"), false);
    assert.strictEqual(assistantTurn?.querySelector(".conversation-lens-turn-header"), null);
    assert.ok(!assistantTurn?.textContent?.includes("Agent"));
    assert.ok(assistantTurn?.closest("article")?.getAttribute("aria-label")?.includes("Agent"));
    assert.ok(assistantBody);
    assert.strictEqual(shouldRenderTurnAsMarkdown("assistant"), true);
    assert.strictEqual(shouldRenderTurnAsMarkdown("user"), false);
    assert.strictEqual(userBody?.classList.contains("rendered-markdown"), false);
    assert.ok(assistantBody?.classList.contains("rendered-markdown"));
  });
  test("renders assistant turns as markdown, user turns as plain text", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const markdownEcho = "**bold** stub echo";
    stubService.appendStubEchoAssistant(sessionId, markdownEcho);
    await flushProjectedTimeline(layoutReadingColumn2);
    const assistantBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"] .conversation-lens-turn-body');
    const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body');
    assert.ok(assistantBody.classList.contains("rendered-markdown"));
    assert.ok(assistantBody.querySelector("strong"));
    assert.strictEqual(assistantBody.textContent, "bold stub echo");
    assert.notStrictEqual(assistantBody.textContent, markdownEcho);
    assert.strictEqual(userBody, null);
  });
  test("keeps user turn body as plain text without markdown rendering", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const userMessage = "plain **not bold** text";
    stubService.appendUserTurn(sessionId, userMessage);
    await flushProjectedTimeline(layoutReadingColumn2);
    const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body');
    assert.strictEqual(userBody.textContent, userMessage);
    assert.strictEqual(userBody.classList.contains("rendered-markdown"), false);
    assert.strictEqual(userBody.querySelector("strong"), null);
  });
  test("does not host the lens as ChatEditorInput", () => {
    const { part } = mountLens();
    assert.notStrictEqual(ConversationChatInput.TypeID, ChatEditorInput.TypeID);
    assert.notStrictEqual(ConversationEditorPane.ID, ChatEditorInput.EditorID);
    assert.deepStrictEqual(part.toJSON(), { type: Parts.CONVERSATION_PART });
    const lensHost = document.createElement("div");
    const timeline = document.createElement("div");
    timeline.className = "conversation-timeline";
    lensHost.appendChild(timeline);
    assert.strictEqual(timeline.querySelector(".chat-setup"), null);
  });
  test("session switcher changes visible title and timeline turns", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const title = slots.sessionBar.querySelector(".conversation-lens-session-title");
    const first = stubService.getActiveSession();
    const secondId = stubService.createSession();
    stubService.switchSession(first.id);
    stubService.appendUserTurn(first.id, "First session message");
    await flushProjectedTimeline(layoutReadingColumn2);
    const second = stubService.getSessions().find((s) => s.id === secondId);
    stubService.appendUserTurn(secondId, "Second session message");
    await flushProjectedTimeline(layoutReadingColumn2);
    assert.strictEqual(title.textContent, first.title);
    assert.ok(slots.timeline.textContent?.includes("First session message"));
    stubService.switchSession(second.id);
    await flushProjectedTimeline(layoutReadingColumn2);
    assert.strictEqual(title.textContent, second.title);
    assert.ok(slots.timeline.textContent?.includes("Second session message"));
    assert.ok(!slots.timeline.textContent?.includes("First session message"));
  });
  test("session switcher select connects attachComposerPicker and marks current session checked", () => {
    let lastContextMenuDelegate;
    const stubService = store.add(new ConversationStubService());
    const firstId = stubService.getActiveSessionId();
    const secondId = stubService.createSession();
    stubService.switchSession(firstId);
    const { part, lens } = mountLens({ stubService });
    const origShowContextMenu = lens.contextMenuService.showContextMenu.bind(lens.contextMenuService);
    lens.contextMenuService.showContextMenu = (delegate) => {
      lastContextMenuDelegate = delegate;
      origShowContextMenu(delegate);
    };
    const slots = getLensSlots(part);
    const select = slots.sessionBar.querySelector(".conversation-lens-session-select select.monaco-select-box");
    assert.ok(select);
    assert.strictEqual(select.getAttribute("aria-haspopup"), "menu");
    assert.strictEqual(select.getAttribute("aria-expanded"), "false");
    select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    assert.ok(lastContextMenuDelegate);
    assert.strictEqual(select.getAttribute("aria-expanded"), "true");
    const actions = lastContextMenuDelegate.getActions();
    const sessions = stubService.getSessions();
    assert.strictEqual(actions.length, sessions.length);
    for (let i = 0; i < sessions.length; i++) {
      assert.strictEqual(actions[i].label, sessions[i].title);
      assert.strictEqual(actions[i].checked, sessions[i].id === firstId);
    }
    assert.deepStrictEqual(Array.from(select.options, (o) => o.text), sessions.map((s) => s.title));
    const targetIndex = sessions.findIndex((s) => s.id === secondId);
    assert.ok(targetIndex >= 0);
    void actions[targetIndex].run();
    assert.strictEqual(stubService.getActiveSessionId(), secondId);
  });
  test("session switcher menu renders metadata prioritizing turnCount over lastAccessedAt", () => {
    let lastContextMenuDelegate;
    const stubService = store.add(new ConversationStubService());
    const now = Date.now();
    const s1Id = stubService.createSession();
    const s2Id = stubService.createSession();
    const s3Id = stubService.createSession();
    const s4Id = stubService.createSession();
    const sessions = stubService.getSessions();
    const s1 = sessions.find((s) => s.id === s1Id);
    s1.turnCount = 3;
    s1.lastAccessedAt = now - 6e4;
    const s2 = sessions.find((s) => s.id === s2Id);
    s2.turnCount = 1;
    const s3 = sessions.find((s) => s.id === s3Id);
    s3.turnCount = 0;
    s3.lastAccessedAt = now - 12e4;
    const s4 = sessions.find((s) => s.id === s4Id);
    s4.turnCount = 0;
    s4.lastAccessedAt = 0;
    const { part, lens } = mountLens({ stubService });
    const origShowContextMenu = lens.contextMenuService.showContextMenu.bind(lens.contextMenuService);
    lens.contextMenuService.showContextMenu = (delegate) => {
      lastContextMenuDelegate = delegate;
      origShowContextMenu(delegate);
    };
    const slots = getLensSlots(part);
    const select = slots.sessionBar.querySelector(".conversation-lens-session-select select.monaco-select-box");
    assert.ok(select);
    select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    assert.ok(lastContextMenuDelegate);
    const actions = lastContextMenuDelegate.getActions();
    assert.strictEqual(actions.length, sessions.length);
    const a1 = actions[sessions.indexOf(s1)];
    assert.strictEqual(a1.label, s1.title);
    assert.strictEqual(a1.detail, "3 messages");
    assert.strictEqual(lastContextMenuDelegate.getKeyBinding?.(a1)?.getLabel(), "3 messages");
    const a2 = actions[sessions.indexOf(s2)];
    assert.strictEqual(a2.label, s2.title);
    assert.strictEqual(a2.detail, "1 message");
    assert.strictEqual(lastContextMenuDelegate.getKeyBinding?.(a2)?.getLabel(), "1 message");
    const a3 = actions[sessions.indexOf(s3)];
    assert.strictEqual(a3.label, s3.title);
    assert.strictEqual(a3.detail, "2 mins ago");
    assert.strictEqual(lastContextMenuDelegate.getKeyBinding?.(a3)?.getLabel(), "2 mins ago");
    const a4 = actions[sessions.indexOf(s4)];
    assert.strictEqual(a4.label, s4.title);
    assert.strictEqual(a4.detail, void 0);
    assert.strictEqual(lastContextMenuDelegate.getKeyBinding?.(a4), void 0);
    assert.deepStrictEqual(Array.from(select.options, (o) => o.text), sessions.map((s) => s.title));
  });
  test("session switcher leaves native select alone when hasNativeContextMenu is true", () => {
    const testConfigService = new TestConfigurationService({
      window: {
        menuStyle: "native",
        titleBarStyle: "native"
      }
    });
    let contextMenuOpened = false;
    const { part, lens } = mountLens({ configurationService: testConfigService });
    lens.contextMenuService.showContextMenu = () => {
      contextMenuOpened = true;
    };
    const slots = getLensSlots(part);
    const select = slots.sessionBar.querySelector(".conversation-lens-session-select select.monaco-select-box");
    assert.ok(select);
    assert.strictEqual(select.getAttribute("aria-haspopup"), null);
    select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    assert.strictEqual(contextMenuOpened, false);
  });
  test("two leaves bound to different sessionKeys render their own sessions", async () => {
    const stubService = store.add(new ConversationStubService());
    const sessionA = stubService.getActiveSessionId();
    stubService.appendUserTurn(sessionA, "Alpha leaf only");
    const sessionB = stubService.createSession();
    stubService.appendUserTurn(sessionB, "Beta leaf only");
    stubService.switchSession(sessionB);
    const leafA = mountLens({ stubService, sessionKey: sessionA });
    const leafB = mountLens({ stubService, sessionKey: sessionB });
    const slotsA = getLensSlots(leafA.part);
    const slotsB = getLensSlots(leafB.part);
    const alphaTurn = stubService.getTurns(sessionA).find((turn) => turn.text === "Alpha leaf only");
    const betaTurn = stubService.getTurns(sessionB).find((turn) => turn.text === "Beta leaf only");
    assert.ok(alphaTurn);
    assert.ok(betaTurn);
    await revealVisualizeTurn(leafA.lens, leafA.layoutReadingColumn, alphaTurn.id);
    await revealVisualizeTurn(leafB.lens, leafB.layoutReadingColumn, betaTurn.id);
    assert.ok(slotsA.timeline.textContent?.includes("Alpha leaf only"));
    assert.ok(!slotsA.timeline.textContent?.includes("Beta leaf only"));
    assert.ok(slotsB.timeline.textContent?.includes("Beta leaf only"));
    assert.ok(!slotsB.timeline.textContent?.includes("Alpha leaf only"));
    stubService.switchSession(sessionA);
    await revealVisualizeTurn(leafA.lens, leafA.layoutReadingColumn, alphaTurn.id);
    await revealVisualizeTurn(leafB.lens, leafB.layoutReadingColumn, betaTurn.id);
    assert.ok(slotsB.timeline.textContent?.includes("Beta leaf only"));
    assert.ok(!slotsB.timeline.textContent?.includes("Alpha leaf only"));
  });
  test("connection change rebinds the bound leaf and not the roster active session", async () => {
    const stubService = store.add(new ConversationStubService());
    const sessionA = stubService.getActiveSessionId();
    stubService.appendUserTurn(sessionA, "Alpha stays on the bound leaf");
    const sessionB = stubService.createSession();
    stubService.appendUserTurn(sessionB, "Beta must not replace the bound leaf");
    stubService.switchSession(sessionA);
    const connectionEmitter = store.add(new Emitter());
    const connection = createConversationConnectionTestStub({
      isEngineConnected: () => false,
      onDidChangeConnection: connectionEmitter.event
    });
    const mounted = mountLens({ stubService, sessionKey: sessionA, connection });
    const alphaTurn = stubService.getTurns(sessionA).find((turn) => turn.text === "Alpha stays on the bound leaf");
    assert.ok(alphaTurn);
    await revealVisualizeTurn(mounted.lens, mounted.layoutReadingColumn, alphaTurn.id);
    assert.strictEqual(mounted.lens.sessionViewLease?.sessionId, sessionA);
    stubService.switchSession(sessionB);
    const beforeEngineEvent = mounted.lens.sessionViewLease;
    assert.ok(beforeEngineEvent);
    stubService.setEngineConnected(true);
    const afterEngineEvent = mounted.lens.sessionViewLease;
    assert.ok(afterEngineEvent);
    assert.notStrictEqual(afterEngineEvent, beforeEngineEvent, "the roster connection event must acquire a new lease");
    assert.strictEqual(afterEngineEvent.sessionId, sessionA);
    await revealVisualizeTurn(mounted.lens, mounted.layoutReadingColumn, alphaTurn.id);
    assert.strictEqual(stubService.getActiveSessionId(), sessionB);
    const timeline = getLensSlots(mounted.part).timeline;
    assert.ok(timeline.textContent?.includes("Alpha stays on the bound leaf"));
    assert.ok(!timeline.textContent?.includes("Beta must not replace the bound leaf"));
    connectionEmitter.fire(connection.getConnectionSnapshot());
    const afterUaEvent = mounted.lens.sessionViewLease;
    assert.ok(afterUaEvent);
    assert.notStrictEqual(afterUaEvent, afterEngineEvent, "the UA connection event must independently acquire a new lease");
    await revealVisualizeTurn(mounted.lens, mounted.layoutReadingColumn, alphaTurn.id);
    assert.strictEqual(stubService.getActiveSessionId(), sessionB);
    assert.strictEqual(afterUaEvent.sessionId, sessionA);
    assert.ok(timeline.textContent?.includes("Alpha stays on the bound leaf"));
    assert.ok(!timeline.textContent?.includes("Beta must not replace the bound leaf"));
  });
  for (const eventSource of ["roster", "UA"]) {
    test(`pairing-hold ${eventSource} connection event demotes the live badge while keeping the same lease and content`, async () => {
      let pairingPending = false;
      const stubService = store.add(new class extends ConversationStubService {
        isEngineConnected() {
          return !pairingPending && super.isEngineConnected();
        }
        getSessionSync(sessionId2) {
          return pairingPending ? { kind: "closed", reason: "Pairing required" } : super.getSessionSync(sessionId2);
        }
      }());
      stubService.setEngineConnected(true);
      const sessionId = stubService.getActiveSessionId();
      const turn = stubService.appendUserTurn(sessionId, "Keep live content during pairing");
      assert.ok(turn);
      const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
      const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
      stubService.wireTestFrameSource(testSource);
      testSource.setSessionSync(sessionId, { kind: "live" });
      const connectionEmitter = store.add(new Emitter());
      const base = createConversationConnectionTestStub();
      const connection = createConversationConnectionTestStub({
        isEngineConnected: () => !pairingPending,
        getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
        getConnectionSnapshot: () => ({ ...base.getConnectionSnapshot(), transport: "ok", channelAlive: true, pairingPending }),
        onDidChangeConnection: connectionEmitter.event
      });
      const connectionEvents = { roster: 0, UA: 0 };
      store.add(stubService.onDidChangeEngineConnection(() => {
        connectionEvents.roster++;
      }));
      store.add(connection.onDidChangeConnection(() => {
        connectionEvents.UA++;
      }));
      const { part, lens, layoutReadingColumn: layoutReadingColumn2 } = mountLens({ stubService, sessionKey: sessionId, connection });
      await flushProjectedTimeline(layoutReadingColumn2);
      const slots = getLensSlots(part);
      const badge = slots.sessionBar.querySelector(".conversation-lens-session-sync-badge");
      assert.ok(badge);
      assert.strictEqual(badge.hidden, false);
      assert.strictEqual(badge.textContent, "Session live");
      assert.strictEqual(badge.title, "Session live");
      assert.strictEqual(badge.getAttribute("aria-label"), "Session live");
      const lease = lens.sessionViewLease;
      assert.ok(lease);
      assert.strictEqual(lease.sessionId, sessionId);
      const snapshot = lease.snapshot;
      assert.strictEqual(snapshot.sync.kind, "live");
      const entries = lens.lastAttachedEntries;
      assert.ok(entries.length > 0);
      const turnSelector = `.conversation-lens-turn[data-kind="user"][data-turn-id="${turn.id}"]`;
      const paintedTurn = queryTimeline(slots, turnSelector);
      assert.ok(paintedTurn);
      assert.strictEqual(paintedTurn.getAttribute("data-turn-id"), turn.id);
      const paintedBody = paintedTurn.querySelector(".conversation-lens-turn-body");
      assert.ok(paintedBody);
      const paintedContent = paintedBody.textContent;
      assert.strictEqual(paintedContent, "Keep live content during pairing");
      pairingPending = true;
      assert.strictEqual(stubService.isEngineConnected(), false);
      assert.strictEqual(stubService.getSessionSync(sessionId).kind, "closed");
      assert.strictEqual(connection.getConnectionPhase()?.kind, "connected");
      assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
      assert.deepStrictEqual(connectionEvents, { roster: 0, UA: 0 });
      assert.strictEqual(badge.textContent, "Session live", "the silent fixture transition must not repaint chrome");
      assert.strictEqual(badge.title, "Session live");
      assert.strictEqual(badge.getAttribute("aria-label"), "Session live");
      if (eventSource === "roster") {
        stubService.setEngineConnected(false);
      } else {
        connectionEmitter.fire(connection.getConnectionSnapshot());
      }
      assert.deepStrictEqual(connectionEvents, { roster: eventSource === "roster" ? 1 : 0, UA: eventSource === "UA" ? 1 : 0 });
      assert.strictEqual(lens.sessionViewLease, lease);
      assert.strictEqual(lease.snapshot, snapshot);
      assert.strictEqual(lease.snapshot.sync.kind, "live");
      assert.strictEqual(lens.lastAttachedEntries, entries);
      const retainedTurn = queryTimeline(slots, turnSelector);
      assert.ok(retainedTurn);
      assert.strictEqual(retainedTurn.getAttribute("data-turn-id"), turn.id);
      const retainedBody = retainedTurn.querySelector(".conversation-lens-turn-body");
      assert.ok(retainedBody);
      assert.strictEqual(retainedBody.textContent, paintedContent);
      assert.strictEqual(badge.hidden, false);
      assert.strictEqual(badge.textContent, "Session disconnected: Pairing required");
      assert.strictEqual(badge.title, "Session disconnected: Pairing required");
      assert.strictEqual(badge.getAttribute("aria-label"), "Session disconnected: Pairing required");
      assert.ok(!slots.sessionBar.textContent?.includes("Session live"));
    });
  }
  test("bound leaf closes inner overlays when the roster active session leaves", () => {
    const stubService = store.add(new ConversationStubService());
    const sessionA = stubService.getActiveSessionId();
    stubService.setMessageQueueFixture(sessionA, {
      isPaused: false,
      isProcessing: false,
      items: [{
        id: "q-bound",
        content: "Bound queue",
        status: "PENDING",
        hold: void 0,
        uploadProgress: void 0,
        retryCount: 0,
        lastError: void 0,
        locked: false,
        pinned: false
      }]
    });
    const sessionB = stubService.createSession();
    stubService.switchSession(sessionA);
    const { lens } = mountLens({ stubService, sessionKey: sessionA });
    const history = lens.engineHistoryList;
    const snapshots = lens.engineSnapshotsList;
    assert.ok(history);
    assert.ok(snapshots);
    lens.openVisualizeOverlay("graph TD; A-->B", "Bound diagram");
    history.show();
    snapshots.show();
    const chip = lens.inboxOverlay.element.querySelector(".conversation-lens-inbox-queue");
    assert.ok(chip);
    chip.click();
    assert.strictEqual(lens.visualizeOverlay.isOpen(), true);
    assert.strictEqual(history.isOpen(), true);
    assert.strictEqual(snapshots.isOpen(), true);
    assert.strictEqual(chip.getAttribute("aria-pressed"), "true");
    stubService.switchSession(sessionB);
    assert.strictEqual(lens.visualizeOverlay.isOpen(), false);
    assert.strictEqual(history.isOpen(), false);
    assert.strictEqual(snapshots.isOpen(), false);
    assert.strictEqual(chip.getAttribute("aria-pressed"), "false");
  });
  test("hidden leaf release ignores connection churn until bindSessionView restores", () => {
    const stubService = store.add(new ConversationStubService());
    const sessionA = stubService.getActiveSessionId();
    const sessionB = stubService.createSession();
    stubService.switchSession(sessionA);
    const connectionEmitter = store.add(new Emitter());
    const connection = createConversationConnectionTestStub({
      onDidChangeConnection: connectionEmitter.event
    });
    const { lens } = mountLens({ stubService, sessionKey: sessionA, connection });
    const readSessionViewLease = () => lens.sessionViewLease;
    const beforeRelease = readSessionViewLease();
    assert.ok(beforeRelease);
    stubService.switchSession(sessionB);
    lens.releaseSessionViewLeaseForHiddenLeaf();
    assert.strictEqual(lens.sessionViewLease, void 0);
    stubService.setEngineConnected(true);
    assert.strictEqual(lens.sessionViewLease, void 0, "the roster event cannot re-acquire a hidden leaf lease");
    connectionEmitter.fire(connection.getConnectionSnapshot());
    assert.strictEqual(lens.sessionViewLease, void 0, "the UA event cannot re-acquire a hidden leaf lease");
    lens.bindSessionView(sessionA);
    const restored = readSessionViewLease();
    assert.ok(restored);
    assert.notStrictEqual(restored, beforeRelease);
    assert.strictEqual(restored.sessionId, sessionA);
    assert.strictEqual(stubService.getActiveSessionId(), sessionB);
    connectionEmitter.fire(connection.getConnectionSnapshot());
    const rebound = readSessionViewLease();
    assert.ok(rebound);
    assert.notStrictEqual(rebound, restored, "public bind must restore subsequent connection-event binding");
    assert.strictEqual(rebound.sessionId, sessionA);
  });
  test("pinned lens does not write the shared lens id", () => {
    const storage = store.add(new TestStorageService());
    storage.store(CONVERSATION_LENS_ID_STORAGE_KEY, "conversation", StorageScope.WORKSPACE, StorageTarget.MACHINE);
    const pinned = mountLens({ storageService: storage, pinConversationLens: true, sessionKey: "sess-pin" });
    assert.strictEqual(pinned.lens.lensId, "conversation");
    pinned.lens.setLensId("trajectory");
    assert.strictEqual(storage.get(CONVERSATION_LENS_ID_STORAGE_KEY, StorageScope.WORKSPACE), "conversation");
    const filteredStorage = store.add(new TestStorageService());
    filteredStorage.store(CONVERSATION_LENS_ID_STORAGE_KEY, "conversation", StorageScope.WORKSPACE, StorageTarget.MACHINE);
    const filtered = mountLens({ storageService: filteredStorage, filterAgentId: "sub:1", sessionKey: "sess-filter" });
    assert.strictEqual(filtered.lens.lensId, "conversation");
    filtered.lens.setLensId("trajectory");
    assert.strictEqual(filteredStorage.get(CONVERSATION_LENS_ID_STORAGE_KEY, StorageScope.WORKSPACE), "conversation");
  });
  test("tablist-only slot still hosts Conversation and Trajectory tabs", async () => {
    const { part, layoutReadingColumn: layoutReadingColumn2 } = mountLens({ tablistOnly: true });
    const slots = getLensSlots(part);
    assert.ok(slots.lensTablist);
    assert.strictEqual(slots.sessionBar, void 0);
    assert.ok(slots.lensTablist.querySelector('.conversation-lens-lens-tabs[role="tablist"]'));
    assert.strictEqual(getLensTab(slots, "conversation").getAttribute("aria-selected"), "true");
    await flushTimelineHeightUpdates();
    clickLensTab(slots, "trajectory");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    assert.strictEqual(getLensTab(slots, "trajectory").getAttribute("aria-selected"), "true");
    assert.ok(!slots.timeline.querySelector(".conversation-lens-trajectory").hasAttribute("hidden"));
  });
  test("SessionBar new session button creates an empty stub session", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const newButton = slots.sessionBar.querySelector(".conversation-lens-session-new .monaco-button");
    const title = slots.sessionBar.querySelector(".conversation-lens-session-title");
    const initialCount = stubService.getSessions().length;
    assert.ok(newButton);
    assert.strictEqual(newButton.getAttribute("aria-label"), conversationLensSessionBarNewSession);
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-session-maximize"), null);
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-session-drawer"), null);
    newButton.click();
    assert.strictEqual(stubService.getSessions().length, initialCount + 1);
    assert.strictEqual(stubService.getTurns(stubService.getActiveSessionId()).length, 0);
    assert.ok(title.textContent?.includes("New session"));
    assert.ok(getTimelineEmpty(slots));
    assert.ok(getTimelineScroll(slots).textContent?.includes("No messages yet"));
    assert.ok(!getTimelineScroll(slots).textContent?.toLowerCase().includes("send a message below"));
  });
  test("SessionBar delete button removes active stub session", async () => {
    const { part, stubService, lens } = mountLens();
    const slots = getLensSlots(part);
    const deleteButton = slots.sessionBar.querySelector(".conversation-lens-session-delete .monaco-button");
    const initialCount = stubService.getSessions().length;
    const deletedId = stubService.getActiveSessionId();
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    assert.ok(deleteButton);
    assert.strictEqual(deleteButton.getAttribute("aria-label"), conversationLensSessionBarDeleteSession);
    assert.strictEqual(deleteButton.getAttribute("aria-label"), "Delete session");
    deleteButton.click();
    await Promise.resolve();
    await Promise.resolve();
    await flushTimelineHeightUpdates();
    assert.strictEqual(stubService.getSessions().length, initialCount - 1);
    assert.notStrictEqual(stubService.getActiveSessionId(), deletedId);
    assert.strictEqual(stubService.getSessions().some((s) => s.id === deletedId), false);
  });
  test("SessionBar delete on last session creates fresh untitled stub", async () => {
    const { part, stubService, lens } = mountLens();
    const slots = getLensSlots(part);
    const sessions = [...stubService.getSessions()];
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    for (const session of sessions) {
      if (stubService.getActiveSessionId() !== session.id) {
        stubService.switchSession(session.id);
      }
      const deleteButton = slots.sessionBar.querySelector(".conversation-lens-session-delete .monaco-button");
      deleteButton.click();
      await Promise.resolve();
      await Promise.resolve();
    }
    const title = slots.sessionBar.querySelector(".conversation-lens-session-title");
    assert.strictEqual(stubService.getSessions().length, 1);
    assert.ok(title.textContent?.includes("Untitled"));
    assert.ok(getTimelineEmpty(slots));
  });
  test("SessionBar lens tablist defaults to Conversation and switches to Trajectory", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const conversationTab = getLensTab(slots, "conversation");
    const trajectoryTab = getLensTab(slots, "trajectory");
    assert.strictEqual(conversationTab.textContent, conversationLensSessionBarConversationTab);
    assert.strictEqual(trajectoryTab.textContent, conversationLensSessionBarTrajectoryTab);
    assert.strictEqual(conversationTab.getAttribute("aria-selected"), "true");
    assert.strictEqual(trajectoryTab.getAttribute("aria-selected"), "false");
    assert.ok(slots.timeline.querySelector(".conversation-lens-timeline:not([hidden])"));
    assert.strictEqual(slots.timeline.querySelector(".conversation-lens-trajectory").hasAttribute("hidden"), true);
    stubService.appendUserTurn(sessionId, "First turn in trajectory");
    stubService.appendStubEchoAssistant(sessionId, "Stub reply");
    await flushProjectedTimeline(layoutReadingColumn2);
    clickLensTab(slots, "trajectory");
    layoutReadingColumn2();
    await flushProjectedTimeline(layoutReadingColumn2);
    assert.strictEqual(conversationTab.getAttribute("aria-selected"), "false");
    assert.strictEqual(trajectoryTab.getAttribute("aria-selected"), "true");
    const trajectory = slots.timeline.querySelector(".conversation-lens-trajectory");
    assert.ok(!trajectory.hasAttribute("hidden"));
    assert.strictEqual(slots.timeline.querySelector(".conversation-lens-timeline").hasAttribute("hidden"), true);
    assert.strictEqual(trajectory.querySelectorAll(".conversation-lens-trajectory-record-row").length, 2);
    assert.ok(trajectory.textContent?.includes("First turn in trajectory"));
    clickLensTab(slots, "conversation");
    await flushTimelineHeightUpdates();
    assert.strictEqual(conversationTab.getAttribute("aria-selected"), "true");
    assert.strictEqual(trajectoryTab.getAttribute("aria-selected"), "false");
    assert.ok(slots.timeline.querySelector(".conversation-lens-timeline:not([hidden])"));
    assert.strictEqual(slots.timeline.querySelector(".conversation-lens-trajectory").hasAttribute("hidden"), true);
  });
  test("SessionBar exposes lens tablist, session title, confirmation, and process fold aria", async function() {
    this.timeout(15e3);
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = await seedPendingConfirmation(stubService, layoutReadingColumn2);
    stubService.appendThinkingTurn(sessionId, "Weighing options");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    const tablist = slots.sessionBar.querySelector('.conversation-lens-lens-tabs[role="tablist"]');
    assert.ok(tablist.getAttribute("aria-label")?.includes("Conversation lens"));
    const conversationTab = getLensTab(slots, "conversation");
    const trajectoryTab = getLensTab(slots, "trajectory");
    assert.strictEqual(conversationTab.getAttribute("aria-controls"), "conversation-lens-panel-conversation");
    assert.strictEqual(trajectoryTab.getAttribute("aria-controls"), "conversation-lens-panel-trajectory");
    assert.strictEqual(conversationTab.tabIndex, 0);
    assert.strictEqual(trajectoryTab.tabIndex, -1);
    const titleButton = slots.sessionBar.querySelector(".conversation-lens-session-title");
    assert.ok(titleButton.getAttribute("aria-label")?.includes("Session title:"));
    conversationTab.focus();
    conversationTab.dispatchEvent(new KeyboardEvent("keydown", { keyCode: KeyCode.RightArrow, bubbles: true, cancelable: true }));
    assert.strictEqual(trajectoryTab.getAttribute("aria-selected"), "true");
    assert.strictEqual(document.activeElement, trajectoryTab);
    const seat = queryTimeline(slots, ".conversation-lens-confirmation-seat");
    const seatAria = seat.getAttribute("aria-label") ?? "";
    assert.ok(seat.textContent?.includes("confirmation pending"));
    assert.ok(seatAria.includes("Permission"));
    assert.ok(seatAria.includes("Input needed"));
    assert.ok(seatAria.includes("Write README.md?"));
    const foldHeader = queryTimeline(slots, ".conversation-process-fold-header");
    assert.ok(foldHeader.getAttribute("aria-label")?.includes("Process steps"));
  });
  test("SessionBar lens tabs stay visible at 300px minimum width with 22px bar height", () => {
    const { part } = mountLens({ layoutWidth: LENS_MIN_WIDTH });
    const slots = getLensSlots(part);
    const bar = slots.sessionBar.querySelector(".conversation-lens-session-bar");
    const conversationTab = getLensTab(slots, "conversation");
    const trajectoryTab = getLensTab(slots, "trajectory");
    const switcherLabel = slots.sessionBar.querySelector(".conversation-lens-session-switcher-label");
    assert.ok(bar);
    assert.ok(conversationTab);
    assert.ok(trajectoryTab);
    assert.ok(slots.sessionBar.classList.contains("is-narrow"));
    assert.ok(!slots.sessionBar.classList.contains("is-compact"));
    assert.ok(switcherLabel);
    assert.ok(slots.sessionBar.querySelector(".conversation-lens-session-more"));
    const moreButton = slots.sessionBar.querySelector(".conversation-lens-session-more .monaco-button");
    assert.ok(moreButton);
    assert.strictEqual(moreButton.getAttribute("aria-label"), conversationLensSessionBarMore);
    moreButton.click();
    const popup = document.querySelector(".conversation-lens-dock-more-popup");
    assert.ok(popup);
    const labels = [...popup.querySelectorAll(".conversation-lens-dock-more-item")].map((item) => item.textContent);
    assert.ok(labels.includes(conversationLensSessionBarHistory));
    assert.ok(labels.includes(conversationLensSessionBarSnapshots));
    assert.ok(!labels.includes(conversationLensSessionBarGoBack));
    assert.ok(!labels.includes(conversationLensSessionBarGoForward));
    assert.ok(!labels.includes(conversationLensSessionBarCloseExtensionTabs));
    assert.ok(labels.includes(conversationLensSessionBarNewSession));
    assert.ok(labels.includes(conversationLensSessionBarDeleteSession));
    const newItem = [...popup.querySelectorAll(".conversation-lens-dock-more-item")].find((item) => item.textContent === conversationLensSessionBarNewSession);
    const deleteItem = [...popup.querySelectorAll(".conversation-lens-dock-more-item")].find((item) => item.textContent === conversationLensSessionBarDeleteSession);
    assert.strictEqual(newItem.disabled, false);
    assert.strictEqual(deleteItem.disabled, false);
  });
  test("SessionBar More menu closes on Escape when focus is outside the popup", () => {
    const { part, lens } = mountLens({ layoutWidth: LENS_MIN_WIDTH });
    const slots = getLensSlots(part);
    const moreButton = slots.sessionBar.querySelector(".conversation-lens-session-more .monaco-button");
    assert.ok(moreButton);
    moreButton.click();
    const popup = document.querySelector(".conversation-lens-dock-more-popup");
    assert.ok(popup);
    const contextView = popup.closest(".context-view");
    assert.ok(contextView);
    assert.notStrictEqual(contextView.style.display, "none");
    assert.ok(lens.sessionMoreContextView);
    const outside = document.createElement("button");
    document.body.appendChild(outside);
    store.add({ dispose: () => outside.remove() });
    outside.focus();
    assert.strictEqual(document.activeElement, outside);
    assert.ok(!popup.contains(document.activeElement));
    const dispatchEscape = () => {
      const event2 = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      Object.defineProperty(event2, "keyCode", { get: () => 27 });
      outside.dispatchEvent(event2);
      return event2;
    };
    const event = dispatchEscape();
    assert.strictEqual(contextView.style.display, "none");
    assert.strictEqual(lens.sessionMoreContextView, void 0);
    assert.strictEqual(event.defaultPrevented, true);
    const afterClose = dispatchEscape();
    assert.strictEqual(afterClose.defaultPrevented, false);
  });
  test("SessionBar medium width keeps History and Snapshots as bar icons", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    assert.ok(slots.sessionBar.classList.contains("is-medium"));
    assert.ok(!slots.sessionBar.classList.contains("is-narrow"));
    const history = slots.sessionBar.querySelector(".conversation-lens-session-history .monaco-button");
    const snapshots = slots.sessionBar.querySelector(".conversation-lens-session-snapshots .monaco-button");
    assert.strictEqual(history.getAttribute("aria-label"), conversationLensSessionBarHistory);
    assert.ok(history.classList.contains("codicon-history"));
    assert.strictEqual(snapshots.getAttribute("aria-label"), conversationLensSessionBarSnapshots);
    assert.ok(snapshots.classList.contains("codicon-layers"));
  });
  test("maximize input closes History and Snapshots overlays", () => {
    const { lens } = mountLens();
    assert.ok(lens.engineHistoryList);
    assert.ok(lens.engineSnapshotsList);
    lens.engineHistoryList.show();
    lens.engineSnapshotsList.show();
    assert.strictEqual(lens.engineHistoryList.isOpen(), true);
    assert.strictEqual(lens.engineSnapshotsList.isOpen(), true);
    lens.setInputMaximized(true);
    assert.strictEqual(lens.isInputMaximized(), true);
    assert.strictEqual(lens.engineHistoryList.isOpen(), false);
    assert.strictEqual(lens.engineSnapshotsList.isOpen(), false);
  });
  test("switching session closes History, Snapshots, and Visualize overlays", () => {
    const { lens, stubService } = mountLens();
    assert.ok(lens.engineHistoryList);
    assert.ok(lens.engineSnapshotsList);
    lens.engineHistoryList.show();
    lens.engineSnapshotsList.show();
    assert.strictEqual(lens.engineHistoryList.isOpen(), true);
    assert.strictEqual(lens.engineSnapshotsList.isOpen(), true);
    stubService.createSession();
    assert.strictEqual(lens.engineHistoryList.isOpen(), false);
    assert.strictEqual(lens.engineSnapshotsList.isOpen(), false);
  });
  test("lensId persists across remount via workspace storage", async () => {
    const storageService = store.add(new TestStorageService());
    const first = mountLens({ storageService });
    const slots = getLensSlots(first.part);
    const sessionId = first.stubService.getActiveSessionId();
    clickLensTab(slots, "trajectory");
    assert.strictEqual(storageService.get(conversationLensIdStorageKey(sessionId), StorageScope.WORKSPACE), "trajectory");
    first.lens.dispose();
    const second = mountLens({ storageService, stubService: first.stubService });
    const remountedSlots = getLensSlots(second.part);
    assert.strictEqual(getLensTab(remountedSlots, "trajectory").getAttribute("aria-selected"), "true");
    assert.ok(!remountedSlots.timeline.querySelector(".conversation-lens-trajectory").hasAttribute("hidden"));
  });
  test("switching sessions keeps the active lens tab", async function() {
    this.timeout(15e3);
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const firstId = stubService.getActiveSessionId();
    const secondId = stubService.createSession();
    stubService.appendUserTurn(firstId, "First session message");
    await flushTimelineHeightUpdates();
    clickLensTab(slots, "trajectory");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    stubService.switchSession(secondId);
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    assert.strictEqual(getLensTab(slots, "trajectory").getAttribute("aria-selected"), "true");
    assert.ok(!slots.timeline.querySelector(".conversation-lens-trajectory").hasAttribute("hidden"));
    assert.ok(slots.timeline.querySelector(".conversation-lens-trajectory").textContent?.includes(conversationLensSessionBarNoTrajectory));
  });
  test("empty trajectory shows honest copy for any zero-turn session", () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const emptySessionId = stubService.createSession();
    stubService.switchSession(emptySessionId);
    clickLensTab(slots, "trajectory");
    layoutReadingColumn2();
    const trajectory = slots.timeline.querySelector(".conversation-lens-trajectory");
    assert.ok(trajectory.textContent?.includes(conversationLensSessionBarNoTrajectory));
    assert.strictEqual(trajectory.querySelector(".conversation-lens-trajectory-record-row"), null);
  });
  test("inbox pending click from Trajectory lens switches back to Conversation", async function() {
    this.timeout(15e3);
    const { part, lens, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    await seedPendingConfirmation(stubService, layoutReadingColumn2);
    clickLensTab(slots, "trajectory");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    const pendingButton = slots.dock.querySelector(".conversation-lens-inbox-pending");
    assert.ok(!pendingButton.hidden);
    pendingButton.click();
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    const confirmationTurn = stubService.getTurns(stubService.getActiveSessionId()).find((turn) => turn.kind === "confirmation");
    assert.ok(confirmationTurn);
    await revealVisualizeTurn(lens, layoutReadingColumn2, confirmationTurn.id);
    assert.strictEqual(getLensTab(slots, "conversation").getAttribute("aria-selected"), "true");
    assert.strictEqual(lens.isInputMaximized(), false);
    assert.ok(queryTimeline(slots, ".conversation-lens-confirmation-seat"));
  });
  test("thinking and tool turns render inside a collapsed process fold by default", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendThinkingTurn(sessionId, "Weighing options");
    stubService.appendToolTurn(sessionId, "grep src");
    await flushProjectedTimeline(layoutReadingColumn2);
    const fold = queryTimeline(slots, "[data-process-fold]");
    assert.ok(fold);
    const header = fold.querySelector(".conversation-process-fold-header");
    assert.strictEqual(header.getAttribute("aria-expanded"), "false");
    const children = fold.querySelector(".conversation-process-fold-children");
    assert.strictEqual(children.hidden, false);
    assert.strictEqual(children.classList.contains("conversation-process-fold--collapsed"), true);
    assert.ok(header.textContent?.includes("Stub"));
    header.click();
    assert.strictEqual(header.getAttribute("aria-expanded"), "true");
    assert.strictEqual(children.hidden, false);
    assert.strictEqual(children.classList.contains("conversation-process-fold--collapsed"), false);
    const thinking = fold.querySelector('.conversation-process-fold-thinking[data-kind="thinking"]');
    const tool = fold.querySelector('.conversation-process-fold-tool[data-kind="tool"]');
    assert.ok(thinking?.textContent?.includes("Weighing options"));
    assert.ok(tool?.textContent?.includes("grep src"));
  });
  test("ConversationPart.focus lands on dock textarea when lens is mounted", () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const textarea = slots.dock.querySelector("textarea.conversation-lens-dock-input");
    part.focus();
    assert.strictEqual(document.activeElement, textarea);
  });
  test("ConversationPart.focus falls back to part element without lens", () => {
    const instantiationService = workbenchInstantiationService(void 0, store);
    const part = store.add(instantiationService.createInstance(ConversationPart));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    store.add(toDisposable(() => parent.remove()));
    part.create(parent);
    part.focus();
    assert.strictEqual(document.activeElement, parent);
  });
  test("inbox overlay is honest: no inline queue rows until opened, pending hidden without confirmations", async () => {
    const { part, stubService } = mountLens();
    const emptySlots = getLensSlots(part);
    stubService.createSession();
    const prefirstInbox = emptySlots.dock.querySelector(".conversation-lens-inbox-overlay");
    assert.ok(prefirstInbox);
    assert.ok(prefirstInbox.hidden);
    await sendDockDraft(emptySlots, "Activate inbox overlay");
    const slots = getLensSlots(part);
    const overlay = getInboxOverlay(slots);
    const pendingButton = overlay.querySelector(".conversation-lens-inbox-pending");
    assert.ok(getInboxQueueChip(slots).textContent?.includes(conversationLensDockInboxNoQueue));
    assert.strictEqual(overlay.querySelector(".conversation-lens-message-queue-list"), null);
    assert.strictEqual(overlay.querySelector(".queue-item"), null);
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-inbox-badge"), null);
    assert.strictEqual(pendingButton.hidden, true);
  });
  test("pairing-hold leftover pending confirmation stays disabled and does not resolve", async () => {
    const base = createConversationConnectionTestStub();
    const connection = createConversationConnectionTestStub({
      getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
      getConnectionSnapshot: () => ({
        ...base.getConnectionSnapshot(),
        pairingPending: true
      })
    });
    const stubService = store.add(new ConversationStubService());
    const sessionId = stubService.getActiveSessionId();
    stubService.appendUserTurn(sessionId, "Help me scaffold the project README.");
    stubService.appendConfirmationTurn(sessionId, "Write README.md?");
    const { part, layoutReadingColumn: layoutReadingColumn2 } = mountLens({ layoutHeight: 1200, connection, stubService });
    const slots = getLensSlots(part);
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    const seat = queryTimeline(slots, ".conversation-lens-confirmation-seat");
    assert.ok(seat);
    const allowButton = seat.querySelector(".conversation-lens-confirmation-actions .monaco-button");
    assert.ok(allowButton);
    assert.strictEqual(allowButton.getAttribute("aria-disabled"), "true");
    allowButton.click();
    await flushProjectedTimeline(layoutReadingColumn2);
    const seatAfter = queryTimeline(slots, ".conversation-lens-confirmation-seat");
    assert.ok(seatAfter.textContent?.includes("confirmation pending"));
    assert.ok(!seatAfter.textContent?.includes("Allowed"));
    assert.strictEqual(stubService.getTurns(sessionId).find((turn) => turn.kind === "confirmation")?.status, "pending");
  });
  test("pairing-hold leftover assistant delete stays disabled and does not delete", async () => {
    const base = createConversationConnectionTestStub();
    const connection = createConversationConnectionTestStub({
      getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
      getConnectionSnapshot: () => ({
        ...base.getConnectionSnapshot(),
        pairingPending: true
      })
    });
    const stubService = store.add(new ConversationStubService());
    const sessionId = stubService.getActiveSessionId();
    stubService.appendUserTurn(sessionId, "Keep this leftover");
    stubService.appendStubEchoAssistant(sessionId, "Cached assistant");
    const { part, layoutReadingColumn: layoutReadingColumn2 } = mountLens({ connection, stubService });
    const slots = getLensSlots(part);
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    const deleteButton = queryTimeline(slots, ".conversation-lens-turn-action-delete .monaco-button");
    assert.ok(deleteButton);
    assert.strictEqual(deleteButton.getAttribute("aria-disabled"), "true");
    deleteButton.click();
    await flushProjectedTimeline(layoutReadingColumn2);
    assert.ok(stubService.getTurns(sessionId).some((turn) => turn.kind === "assistant" && turn.text === "Cached assistant"));
  });
  test("allow on confirmation hides CTAs and updates inbox pending count", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    await seedPendingConfirmation(stubService, layoutReadingColumn2);
    const seat = queryTimeline(slots, ".conversation-lens-confirmation-seat");
    const allowButton = seat.querySelector(".conversation-lens-confirmation-actions .monaco-button");
    const pendingButton = slots.dock.querySelector(".conversation-lens-inbox-pending");
    assert.ok(allowButton);
    allowButton.click();
    await flushProjectedTimeline(layoutReadingColumn2);
    const seatAfter = queryTimeline(slots, ".conversation-lens-confirmation-seat");
    const buttonsAfter = [...seatAfter.querySelectorAll("button, .monaco-button")].map((el) => el.textContent?.trim());
    assert.ok(!buttonsAfter.includes("Allow"));
    assert.ok(!buttonsAfter.includes("Skip"));
    assert.ok(seatAfter.textContent?.includes("Allowed"));
    assert.ok(seatAfter.textContent?.includes("Write README.md?"));
    assert.strictEqual(pendingButton.hidden, true);
  });
  test("dock appends a local user turn and stub echo to the current session timeline", async function() {
    this.timeout(15e3);
    const { part, lens, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const textarea = getDockTextarea(slots);
    const message = "Local stub message from test";
    assert.ok(!slots.timeline.textContent?.includes(message));
    await sendDockDraftAndFlush(slots, message, layoutReadingColumn2);
    await revealLatestTurn(lens, stubService, layoutReadingColumn2, (turn) => turn.kind === "user" && turn.text === message);
    assert.ok(slots.timeline.textContent?.includes(message));
    await revealLatestTurn(lens, stubService, layoutReadingColumn2, (turn) => turn.kind === "assistant" && turn.stubEcho === true);
    assert.ok(queryTimeline(slots, '[data-stub="true"]'));
    assert.strictEqual(textarea.value, "");
  });
  test("dock maximize input toggles conversation-lens-input-maximized on slot hosts", () => {
    const { part, lens } = mountLens();
    const slots = getLensSlots(part);
    const maximizeButton = slots.dock.querySelector(".conversation-lens-dock-maximize-input .monaco-button");
    assert.ok(maximizeButton);
    assert.ok(maximizeButton.classList.contains("codicon-screen-full"));
    assert.strictEqual(maximizeButton.getAttribute("aria-label"), conversationLensDockMaximizeInput);
    assert.strictEqual(lens.isInputMaximized(), false);
    assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), false);
    assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), false);
    assert.strictEqual(slots.sessionBar.classList.contains(conversationLensInputMaximizedClass), false);
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-session-maximize"), null);
    maximizeButton.click();
    assert.strictEqual(lens.isInputMaximized(), true);
    assert.ok(maximizeButton.classList.contains("codicon-screen-normal"));
    assert.strictEqual(maximizeButton.getAttribute("aria-label"), conversationLensDockRestoreTimeline);
    assert.strictEqual(maximizeButton.getAttribute("aria-pressed"), "true");
    assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), true);
    assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), true);
    maximizeButton.click();
    assert.strictEqual(lens.isInputMaximized(), false);
    assert.ok(maximizeButton.classList.contains("codicon-screen-full"));
    assert.strictEqual(maximizeButton.getAttribute("aria-label"), conversationLensDockMaximizeInput);
    assert.strictEqual(maximizeButton.getAttribute("aria-pressed"), "false");
    assert.strictEqual(slots.timeline.classList.contains(conversationLensInputMaximizedClass), false);
    assert.strictEqual(slots.dock.classList.contains(conversationLensInputMaximizedClass), false);
  });
  test("narrow More menu says Restore timeline when input is maximized", () => {
    const { part, lens } = mountLens({ layoutWidth: LENS_MIN_WIDTH });
    const slots = getLensSlots(part);
    lens.setInputMaximized(true);
    const moreButton = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-more .monaco-button");
    moreButton.click();
    const popup = document.querySelector(".conversation-lens-dock-more-popup");
    assert.ok(popup);
    const restore = [...popup.querySelectorAll(".conversation-lens-dock-more-item")].find((item) => item.textContent === conversationLensDockRestoreTimeline);
    assert.ok(restore);
    assert.ok(![...popup.querySelectorAll(".conversation-lens-dock-more-item")].some((item) => item.textContent === conversationLensDockMaximizeInput));
  });
  test("input maximize keeps pending confirmation reachable via dock inbox row", async () => {
    const { part, lens, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const maximizeButton = slots.dock.querySelector(".conversation-lens-dock-maximize-input .monaco-button");
    const pendingButton = slots.dock.querySelector(".conversation-lens-inbox-pending");
    await seedPendingConfirmation(stubService, layoutReadingColumn2);
    assert.ok(pendingButton);
    assert.ok(!pendingButton.hidden);
    maximizeButton.click();
    assert.strictEqual(lens.isInputMaximized(), true);
    assert.ok(!pendingButton.hidden);
    assert.ok(pendingButton.textContent?.includes("confirmation pending"));
    pendingButton.click();
    assert.strictEqual(lens.isInputMaximized(), false);
    assert.ok(queryTimeline(slots, ".conversation-lens-confirmation-seat"));
  });
  test("SessionBar write chrome disables while pairing-hold leftover", () => {
    const base = createConversationConnectionTestStub();
    const connection = createConversationConnectionTestStub({
      getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
      getConnectionSnapshot: () => ({
        ...base.getConnectionSnapshot(),
        pairingPending: true
      })
    });
    const { part, stubService } = mountLens({ connection });
    const slots = getLensSlots(part);
    const titleButton = slots.sessionBar.querySelector("button.conversation-lens-session-title");
    const newButton = slots.sessionBar.querySelector(".conversation-lens-session-new .monaco-button");
    const deleteButton = slots.sessionBar.querySelector(".conversation-lens-session-delete .monaco-button");
    const previousTitle = stubService.getActiveSession().title;
    const previousCount = stubService.getSessions().length;
    assert.strictEqual(titleButton.disabled, true);
    assert.strictEqual(titleButton.getAttribute("aria-disabled"), "true");
    assert.strictEqual(newButton.getAttribute("aria-disabled"), "true");
    assert.strictEqual(deleteButton.getAttribute("aria-disabled"), "true");
    titleButton.click();
    assert.ok(!titleButton.hidden);
    newButton.click();
    deleteButton.click();
    assert.strictEqual(stubService.getActiveSession().title, previousTitle);
    assert.strictEqual(stubService.getSessions().length, previousCount);
  });
  test("narrow More disables new and delete while pairing-hold leftover", () => {
    const base = createConversationConnectionTestStub();
    const connection = createConversationConnectionTestStub({
      getConnectionPhase: () => ({ kind: "connected", path: "loopback" }),
      getConnectionSnapshot: () => ({
        ...base.getConnectionSnapshot(),
        pairingPending: true
      })
    });
    const { part, stubService } = mountLens({ connection, layoutWidth: LENS_MIN_WIDTH });
    const slots = getLensSlots(part);
    const previousCount = stubService.getSessions().length;
    const moreButton = slots.sessionBar.querySelector(".conversation-lens-session-more .monaco-button");
    moreButton.click();
    const popup = document.querySelector(".conversation-lens-dock-more-popup");
    assert.ok(popup);
    const item = (label) => [...popup.querySelectorAll(".conversation-lens-dock-more-item")].find((el) => el.textContent === label);
    const newItem = item(conversationLensSessionBarNewSession);
    const deleteItem = item(conversationLensSessionBarDeleteSession);
    const historyItem = item(conversationLensSessionBarHistory);
    assert.strictEqual(newItem.disabled, true);
    assert.strictEqual(newItem.getAttribute("aria-disabled"), "true");
    assert.strictEqual(deleteItem.disabled, true);
    assert.strictEqual(deleteItem.getAttribute("aria-disabled"), "true");
    assert.strictEqual(historyItem.disabled, false);
    newItem.click();
    deleteItem.click();
    assert.strictEqual(stubService.getSessions().length, previousCount);
    const gateRow = slots.dock.querySelector(".conversation-lens-dock-gate-row");
    const gateLabel = gateRow.querySelector(".conversation-lens-dock-gate-label");
    assert.strictEqual(gateRow.hidden, false);
    assert.strictEqual(gateRow.getAttribute("role"), "status");
    assert.ok(!gateRow.classList.contains("is-error"));
    assert.strictEqual(gateLabel.textContent, conversationLensDockEngineNotConnected);
    assert.notStrictEqual(gateLabel.textContent, conversationLensPostFailedDisconnected);
  });
  test("SessionBar title button enters rename mode and commits on Enter", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const titleButton = slots.sessionBar.querySelector("button.conversation-lens-session-title");
    const titleInput = slots.sessionBar.querySelector("input.conversation-lens-session-title-input");
    const sessionId = stubService.getActiveSessionId();
    const previousTitle = stubService.getActiveSession().title;
    assert.ok(titleButton);
    assert.strictEqual(titleButton.title, "");
    assert.ok(titleInput.hidden);
    titleButton.click();
    assert.ok(titleButton.hidden);
    assert.ok(!titleInput.hidden);
    assert.strictEqual(titleInput.value, previousTitle);
    titleInput.value = "Renamed from test";
    titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: KeyCode.Enter, bubbles: true }));
    assert.ok(!titleButton.hidden);
    assert.ok(titleInput.hidden);
    assert.strictEqual(titleButton.textContent, "Renamed from test");
    assert.strictEqual(stubService.getActiveSession().title, "Renamed from test");
    assert.strictEqual(stubService.getSessions().find((s) => s.id === sessionId)?.title, "Renamed from test");
    assert.strictEqual(getConversationSessionStatusText(stubService.getActiveSession()), "Renamed from test");
  });
  test("SessionBar rename rejects empty title and Escape cancels edit", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const titleButton = slots.sessionBar.querySelector("button.conversation-lens-session-title");
    const titleInput = slots.sessionBar.querySelector("input.conversation-lens-session-title-input");
    const previousTitle = stubService.getActiveSession().title;
    titleButton.click();
    titleInput.value = "   ";
    titleInput.dispatchEvent(new globalThis.Event("blur", { bubbles: true }));
    assert.strictEqual(stubService.getActiveSession().title, previousTitle);
    assert.strictEqual(titleButton.textContent, previousTitle);
    titleButton.click();
    titleInput.value = "Temporary edit";
    titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", keyCode: KeyCode.Escape, bubbles: true }));
    assert.strictEqual(stubService.getActiveSession().title, previousTitle);
    assert.strictEqual(titleButton.textContent, previousTitle);
    assert.ok(!titleButton.hidden);
    assert.ok(titleInput.hidden);
  });
  test("SessionBar select and aria-live stay in sync after rename", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const titleButton = slots.sessionBar.querySelector("button.conversation-lens-session-title");
    const titleInput = slots.sessionBar.querySelector("input.conversation-lens-session-title-input");
    const titleLive = slots.sessionBar.querySelector(".conversation-lens-session-title-live");
    const sessionId = stubService.getActiveSessionId();
    assert.ok(titleLive);
    assert.strictEqual(titleLive.getAttribute("aria-live"), "polite");
    titleButton.click();
    titleInput.value = "Renamed for select sync";
    titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: KeyCode.Enter, bubbles: true }));
    assert.strictEqual(titleButton.textContent, "Renamed for select sync");
    assert.strictEqual(titleLive.textContent, "Renamed for select sync");
    assert.strictEqual(getSessionSelectLabel(slots), "Renamed for select sync");
    assert.strictEqual(stubService.getSessions().find((s) => s.id === sessionId)?.title, "Renamed for select sync");
  });
  test("SessionBar renameSession false shows failed notice and keeps previous title", () => {
    class RejectingRenameRoster extends ConversationStubService {
      renameSession(_sessionId, _title) {
        return false;
      }
    }
    const roster = store.add(new RejectingRenameRoster());
    const { part } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const titleButton = slots.sessionBar.querySelector("button.conversation-lens-session-title");
    const titleInput = slots.sessionBar.querySelector("input.conversation-lens-session-title-input");
    const titleLive = slots.sessionBar.querySelector(".conversation-lens-session-title-live");
    const sessionId = roster.getActiveSessionId();
    const previousTitle = roster.getActiveSession().title;
    titleButton.click();
    titleInput.value = "Rejected rename";
    titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: KeyCode.Enter, bubbles: true }));
    assert.strictEqual(roster.getActiveSession().title, previousTitle);
    assert.strictEqual(roster.getSessions().find((s) => s.id === sessionId)?.title, previousTitle);
    assert.strictEqual(titleButton.textContent, previousTitle);
    assert.strictEqual(titleLive.textContent, previousTitle);
    assert.strictEqual(getSessionSelectLabel(slots), previousTitle);
    assert.ok(!titleButton.hidden);
    assert.ok(titleInput.hidden);
    const gateRow = getReadingColumn(slots).querySelector(".conversation-lens-dock-gate-row") ?? slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.ok(gateRow);
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes(conversationLensPostFailed));
  });
  test("SessionBar renameSession false after engine-cache disconnect shows disconnected notice", () => {
    class EngineCacheRejectingRenameRoster extends ConversationStubService {
      hasEngineConnectionHistory() {
        return true;
      }
      renameSession(_sessionId, _title) {
        return false;
      }
    }
    const roster = store.add(new EngineCacheRejectingRenameRoster());
    const { part } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const titleButton = slots.sessionBar.querySelector("button.conversation-lens-session-title");
    const titleInput = slots.sessionBar.querySelector("input.conversation-lens-session-title-input");
    const sessionId = roster.getActiveSessionId();
    const previousTitle = roster.getActiveSession().title;
    titleButton.click();
    titleInput.value = "Rejected while disconnected";
    titleInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: KeyCode.Enter, bubbles: true }));
    assert.strictEqual(roster.getActiveSession().title, previousTitle);
    assert.strictEqual(roster.getSessions().find((s) => s.id === sessionId)?.title, previousTitle);
    assert.strictEqual(titleButton.textContent, previousTitle);
    assert.strictEqual(getSessionSelectLabel(slots), previousTitle);
    const gateRow = getReadingColumn(slots).querySelector(".conversation-lens-dock-gate-row") ?? slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.ok(gateRow);
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes(conversationLensPostFailedDisconnected));
  });
  test("SessionBar deleteSession false shows failed notice and keeps the session", async () => {
    class RejectingDeleteRoster extends ConversationStubService {
      deleteSession(_sessionId) {
        return false;
      }
    }
    const roster = store.add(new RejectingDeleteRoster());
    const { part, lens } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const deleteButton = slots.sessionBar.querySelector(".conversation-lens-session-delete .monaco-button");
    const sessionId = roster.getActiveSessionId();
    const initialCount = roster.getSessions().length;
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    assert.ok(deleteButton);
    deleteButton.click();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(roster.getSessions().length, initialCount);
    assert.strictEqual(roster.getActiveSessionId(), sessionId);
    assert.strictEqual(roster.getSessions().some((s) => s.id === sessionId), true);
    const gateRow = getReadingColumn(slots).querySelector(".conversation-lens-dock-gate-row") ?? slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.ok(gateRow);
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes(conversationLensPostFailed));
  });
  test("SessionBar deleteSession false after engine-cache disconnect shows disconnected notice", () => {
    class EngineCacheRejectingDeleteRoster extends ConversationStubService {
      hasEngineConnectionHistory() {
        return true;
      }
      deleteSession(_sessionId) {
        return false;
      }
    }
    const roster = store.add(new EngineCacheRejectingDeleteRoster());
    const { part } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const deleteButton = slots.sessionBar.querySelector(".conversation-lens-session-delete .monaco-button");
    const sessionId = roster.getActiveSessionId();
    const initialCount = roster.getSessions().length;
    assert.ok(deleteButton);
    deleteButton.click();
    assert.strictEqual(roster.getSessions().length, initialCount);
    assert.strictEqual(roster.getActiveSessionId(), sessionId);
    assert.strictEqual(roster.getSessions().some((s) => s.id === sessionId), true);
    const gateRow = getReadingColumn(slots).querySelector(".conversation-lens-dock-gate-row") ?? slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.ok(gateRow);
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes(conversationLensPostFailedDisconnected));
  });
  test("SessionBar deleteSession false keeps composer draft on the original session", async () => {
    class RejectingDeleteRoster extends ConversationStubService {
      deleteSession(_sessionId) {
        return false;
      }
    }
    const roster = store.add(new RejectingDeleteRoster());
    const { part, lens } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const deleteButton = slots.sessionBar.querySelector(".conversation-lens-session-delete .monaco-button");
    const textarea = getDockTextarea(slots);
    const sessionId = roster.getActiveSessionId();
    const draft = "keep this draft after rejected delete";
    textarea.value = draft;
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    assert.ok(deleteButton);
    deleteButton.click();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(roster.getActiveSessionId(), sessionId);
    assert.strictEqual(roster.getSessions().some((s) => s.id === sessionId), true);
    assert.strictEqual(textarea.value, draft);
    assert.strictEqual(lens.readComposerDraft(sessionId), draft);
  });
  test("onDidChangeSession keeps drafts for sessions missing from the visible roster", () => {
    class NarrowVisibleRoster extends ConversationStubService {
      showOnly(sessionId) {
        this.visibleSessionId = sessionId;
      }
      getSessions() {
        const sessions = super.getSessions();
        return this.visibleSessionId ? sessions.filter((session) => session.id === this.visibleSessionId) : sessions;
      }
      getActiveSessionId() {
        return this.visibleSessionId ?? super.getActiveSessionId();
      }
      getActiveSession() {
        const id = this.getActiveSessionId();
        return super.getSessions().find((session) => session.id === id) ?? super.getActiveSession();
      }
      pulseSessionChange(sessionId) {
        this._onDidChangeSession.fire(sessionId);
      }
    }
    const roster = store.add(new NarrowVisibleRoster());
    const sessionA = roster.getActiveSessionId();
    const sessionB = roster.createSession();
    const { lens, storageService } = mountLens({ stubService: roster });
    storeUaClientComposerDraft(storageService, sessionA, "default", "draft on A");
    storeUaClientComposerDraft(storageService, sessionB, "default", "draft on B");
    roster.showOnly(sessionB);
    roster.switchSession(sessionB);
    roster.pulseSessionChange(sessionB);
    assert.strictEqual(loadUaClientComposerDraft(storageService, sessionA, "default"), "draft on A");
    assert.strictEqual(loadUaClientComposerDraft(storageService, sessionB, "default"), "draft on B");
    assert.strictEqual(roster.deleteSession(sessionA), true);
    lens.deleteComposerDraftsForSession(sessionA);
    assert.ok(!loadUaClientComposerDraft(storageService, sessionA, "default"));
    assert.strictEqual(loadUaClientComposerDraft(storageService, sessionB, "default"), "draft on B");
  });
  test("bind-failed roster churn keeps composer drafts for other sessions", () => {
    const sessionA = "sess-bindfail-a";
    class BindFailOnlyRoster extends ConversationStubService {
      pulseSessionChange(sessionId) {
        this._onDidChangeSession.fire(sessionId);
      }
      getSessions() {
        return [{ id: ENGINE_BIND_FAILED_SESSION_ID, title: "bind failed", turns: [], source: "engine-cache" }];
      }
      getActiveSessionId() {
        return ENGINE_BIND_FAILED_SESSION_ID;
      }
      hasEngineConnectionHistory() {
        return true;
      }
      isEngineConnected() {
        return true;
      }
    }
    const roster = store.add(new BindFailOnlyRoster());
    const { storageService } = mountLens({ stubService: roster });
    storeUaClientComposerDraft(storageService, sessionA, "default", "draft before bind fail");
    roster.pulseSessionChange(ENGINE_BIND_FAILED_SESSION_ID);
    assert.strictEqual(loadUaClientComposerDraft(storageService, sessionA, "default"), "draft before bind fail");
  });
  test("SessionBar deleteSession optimistic true then rollback restores composer draft", async () => {
    class OptimisticRollbackDeleteRoster extends ConversationStubService {
      constructor() {
        super(...arguments);
        this._onDidFail = this._register(new Emitter());
        this.onDidFailEngineAction = this._onDidFail.event;
      }
      getSessions() {
        return super.getSessions().filter((session) => session.id !== this.hiddenId);
      }
      getActiveSessionId() {
        const id = super.getActiveSessionId();
        if (id === this.hiddenId) {
          return this.getSessions()[0]?.id ?? id;
        }
        return id;
      }
      getActiveSession() {
        const id = this.getActiveSessionId();
        return this.getSessions().find((session) => session.id === id) ?? super.getActiveSession();
      }
      deleteSession(sessionId2) {
        if (!super.getSessions().some((session) => session.id === sessionId2)) {
          return false;
        }
        this.hiddenId = sessionId2;
        this._onDidChangeActiveSession.fire(this.getActiveSessionId());
        this._onDidChangeSession.fire(sessionId2);
        queueMicrotask(() => {
          this.hiddenId = void 0;
          this._onDidChangeActiveSession.fire(sessionId2);
          this._onDidChangeSession.fire(sessionId2);
          this._onDidFail.fire({ sessionId: sessionId2, action: "deleteSession", error: new Error("engine refused") });
        });
        return true;
      }
    }
    const roster = store.add(new OptimisticRollbackDeleteRoster());
    const sessionId = roster.getActiveSessionId();
    roster.createSession();
    roster.switchSession(sessionId);
    const { part, lens } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const deleteButton = slots.sessionBar.querySelector(".conversation-lens-session-delete .monaco-button");
    const textarea = getDockTextarea(slots);
    const draft = "restore this draft after delete rollback";
    textarea.value = draft;
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.ok(deleteButton);
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    deleteButton.click();
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(roster.getSessions().some((s) => s.id === sessionId), false);
    await new Promise((resolve) => queueMicrotask(resolve));
    assert.strictEqual(roster.getActiveSessionId(), sessionId);
    assert.strictEqual(roster.getSessions().some((s) => s.id === sessionId), true);
    assert.strictEqual(lens.readComposerDraft(sessionId), draft);
    assert.strictEqual(getDockTextarea(slots).value, draft);
  });
  test("SessionBar createNewSession after engine-cache disconnect shows disconnected notice and does not create", () => {
    class EngineCacheCreateRoster extends ConversationStubService {
      constructor() {
        super(...arguments);
        this.createSessionCalls = 0;
      }
      hasEngineConnectionHistory() {
        return true;
      }
      isEngineConnected() {
        return false;
      }
      createSession() {
        this.createSessionCalls += 1;
        return super.createSession();
      }
    }
    const roster = store.add(new EngineCacheCreateRoster());
    const { part } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const newButton = slots.sessionBar.querySelector(".conversation-lens-session-new .monaco-button");
    const sessionId = roster.getActiveSessionId();
    const initialCount = roster.getSessions().length;
    assert.ok(newButton);
    newButton.click();
    assert.strictEqual(roster.createSessionCalls, 0);
    assert.strictEqual(roster.getSessions().length, initialCount);
    assert.strictEqual(roster.getActiveSessionId(), sessionId);
    const gateRow = getReadingColumn(slots).querySelector(".conversation-lens-dock-gate-row") ?? slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.ok(gateRow);
    assert.strictEqual(gateRow.hidden, false);
    assert.ok(gateRow.textContent?.includes(conversationLensPostFailedDisconnected));
  });
  test("SessionBar createNewSession while engine connected still calls createSession", () => {
    class ConnectedCreateRoster extends ConversationStubService {
      constructor() {
        super(...arguments);
        this.createSessionCalls = 0;
      }
      hasEngineConnectionHistory() {
        return true;
      }
      isEngineConnected() {
        return true;
      }
      createSession() {
        this.createSessionCalls += 1;
        return super.createSession();
      }
    }
    const roster = store.add(new ConnectedCreateRoster());
    const { part } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const newButton = slots.sessionBar.querySelector(".conversation-lens-session-new .monaco-button");
    const initialCount = roster.getSessions().length;
    assert.ok(newButton);
    newButton.click();
    assert.strictEqual(roster.createSessionCalls, 1);
    assert.strictEqual(roster.getSessions().length, initialCount + 1);
    const gateRow = getReadingColumn(slots).querySelector(".conversation-lens-dock-gate-row") ?? slots.dock.querySelector(".conversation-lens-dock-gate-row");
    assert.ok(!gateRow || gateRow.hidden);
  });
  test("turnEdit session switch keeps compose draft snapshot not bubble text", async () => {
    const { part, lens, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionA = stubService.getActiveSessionId();
    const userTurn = stubService.appendUserTurn(sessionA, "B");
    assert.ok(userTurn);
    const sessionB = stubService.createSession();
    stubService.switchSession(sessionA);
    const textarea = getDockTextarea(slots);
    textarea.value = "A";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    lens.beginTurnEdit(userTurn.id);
    assert.strictEqual(lens.composerPolicy, "turnEdit");
    assert.strictEqual(lens.dockTextarea.value, "B");
    lens.dockTextarea.value = "B-typed";
    lens.dockTextarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    lens.switchToSession(sessionB);
    lens.switchToSession(sessionA);
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    assert.strictEqual(getDockTextarea(slots).value, "A");
  });
  test("queueEdit session switch keeps compose draft snapshot", async () => {
    const { part, lens, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionA = stubService.getActiveSessionId();
    stubService.appendUserTurn(sessionA, "keep session active");
    const sessionB = stubService.createSession();
    stubService.switchSession(sessionA);
    stubService.setMessageQueueFixture(sessionA, {
      isPaused: false,
      isProcessing: false,
      items: [{
        id: "q-edit",
        content: "B",
        status: "PENDING",
        hold: void 0,
        uploadProgress: void 0,
        retryCount: 0,
        lastError: void 0,
        locked: false,
        pinned: false
      }]
    });
    const textarea = getDockTextarea(slots);
    textarea.value = "A";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    lens.beginQueueEdit("q-edit");
    assert.strictEqual(lens.composerPolicy, "queueEdit");
    assert.strictEqual(lens.dockTextarea.value, "B");
    lens.switchToSession(sessionB);
    lens.switchToSession(sessionA);
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    assert.strictEqual(getDockTextarea(slots).value, "A");
  });
  test("compose session switch still writes textarea into drafts", () => {
    const { part, lens, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionA = stubService.getActiveSessionId();
    const sessionB = stubService.createSession();
    stubService.switchSession(sessionA);
    assert.strictEqual(lens.composerPolicy, "compose");
    getDockTextarea(slots).value = "live compose";
    lens.switchToSession(sessionB);
    assert.strictEqual(lens.readComposerDraft(sessionA), "live compose");
  });
  test("turnEdit createNewSession writes compose draft snapshot not bubble text", () => {
    const { part, lens, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionA = stubService.getActiveSessionId();
    const userTurn = stubService.appendUserTurn(sessionA, "B");
    assert.ok(userTurn);
    const textarea = getDockTextarea(slots);
    textarea.value = "A";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    lens.beginTurnEdit(userTurn.id);
    assert.strictEqual(lens.composerPolicy, "turnEdit");
    assert.strictEqual(lens.dockTextarea.value, "B");
    lens.createNewSession();
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
  });
  test("turnEdit deleteSession false keeps compose draft snapshot not bubble text", async () => {
    class RejectingDeleteRoster extends ConversationStubService {
      deleteSession(_sessionId) {
        return false;
      }
    }
    const roster = store.add(new RejectingDeleteRoster());
    const { part, lens } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const sessionId = roster.getActiveSessionId();
    const userTurn = roster.appendUserTurn(sessionId, "B");
    assert.ok(userTurn);
    const textarea = getDockTextarea(slots);
    textarea.value = "A";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(lens.readComposerDraft(sessionId), "A");
    lens.beginTurnEdit(userTurn.id);
    assert.strictEqual(lens.composerPolicy, "turnEdit");
    assert.strictEqual(lens.dockTextarea.value, "B");
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    await lens.deleteActiveSession();
    assert.strictEqual(roster.getActiveSessionId(), sessionId);
    assert.strictEqual(lens.readComposerDraft(sessionId), "A");
    assert.strictEqual(getDockTextarea(slots).value, "A");
  });
  test("turnEdit deleteSession optimistic rollback restores compose draft snapshot not bubble text", async () => {
    class OptimisticRollbackDeleteRoster extends ConversationStubService {
      constructor() {
        super(...arguments);
        this._onDidFail = this._register(new Emitter());
        this.onDidFailEngineAction = this._onDidFail.event;
      }
      getSessions() {
        return super.getSessions().filter((session) => session.id !== this.hiddenId);
      }
      getActiveSessionId() {
        const id = super.getActiveSessionId();
        if (id === this.hiddenId) {
          return this.getSessions()[0]?.id ?? id;
        }
        return id;
      }
      getActiveSession() {
        const id = this.getActiveSessionId();
        return this.getSessions().find((session) => session.id === id) ?? super.getActiveSession();
      }
      deleteSession(sessionId2) {
        if (!super.getSessions().some((session) => session.id === sessionId2)) {
          return false;
        }
        this.hiddenId = sessionId2;
        this._onDidChangeActiveSession.fire(this.getActiveSessionId());
        this._onDidChangeSession.fire(sessionId2);
        queueMicrotask(() => {
          this.hiddenId = void 0;
          this._onDidChangeActiveSession.fire(sessionId2);
          this._onDidChangeSession.fire(sessionId2);
          this._onDidFail.fire({ sessionId: sessionId2, action: "deleteSession", error: new Error("engine refused") });
        });
        return true;
      }
    }
    const roster = store.add(new OptimisticRollbackDeleteRoster());
    const sessionId = roster.getActiveSessionId();
    roster.createSession();
    roster.switchSession(sessionId);
    const { part, lens } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const userTurn = roster.appendUserTurn(sessionId, "B");
    assert.ok(userTurn);
    const textarea = getDockTextarea(slots);
    textarea.value = "A";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    lens.beginTurnEdit(userTurn.id);
    assert.strictEqual(lens.composerPolicy, "turnEdit");
    assert.strictEqual(lens.dockTextarea.value, "B");
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    await lens.deleteActiveSession();
    await new Promise((resolve) => queueMicrotask(resolve));
    assert.strictEqual(roster.getActiveSessionId(), sessionId);
    assert.strictEqual(lens.readComposerDraft(sessionId), "A");
    assert.strictEqual(getDockTextarea(slots).value, "A");
  });
  test("compose deleteSession false still writes textarea into drafts", async () => {
    class RejectingDeleteRoster extends ConversationStubService {
      deleteSession(_sessionId) {
        return false;
      }
    }
    const roster = store.add(new RejectingDeleteRoster());
    const { part, lens } = mountLens({ stubService: roster });
    const slots = getLensSlots(part);
    const sessionId = roster.getActiveSessionId();
    assert.strictEqual(lens.composerPolicy, "compose");
    getDockTextarea(slots).value = "live compose";
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    await lens.deleteActiveSession();
    assert.strictEqual(lens.readComposerDraft(sessionId), "live compose");
    assert.strictEqual(getDockTextarea(slots).value, "live compose");
  });
  test("turnEdit input history does not write history text into drafts", () => {
    const { part, lens, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionA = stubService.getActiveSessionId();
    const userTurn = stubService.appendUserTurn(sessionA, "B");
    assert.ok(userTurn);
    const textarea = getDockTextarea(slots);
    textarea.value = "A";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    lens.beginTurnEdit(userTurn.id);
    assert.strictEqual(lens.composerPolicy, "turnEdit");
    assert.strictEqual(lens.dockTextarea.value, "B");
    lens.dockTextarea.value = "";
    assert.ok(lens.navigateInputHistory("older"));
    assert.strictEqual(lens.dockTextarea.value, "B");
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    lens.exitInputHistoryBrowse();
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
  });
  test("turn edit Escape leaves input history before it leaves the edit", () => {
    const { part, lens, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionA = stubService.getActiveSessionId();
    const userTurn = stubService.appendUserTurn(sessionA, "B");
    assert.ok(userTurn);
    const textarea = getDockTextarea(slots);
    textarea.value = "A";
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    lens.beginTurnEdit(userTurn.id);
    assert.strictEqual(lens.composerPolicy, "turnEdit");
    assert.strictEqual(lens.dockTextarea.value, "B");
    lens.dockTextarea.value = "";
    lens.dockTextarea.selectionStart = 0;
    lens.dockTextarea.selectionEnd = 0;
    dispatchDockKeydown(lens.dockTextarea, KeyCode.UpArrow);
    assert.strictEqual(lens.dockTextarea.value, "B");
    assert.strictEqual(lens.composerPolicy, "turnEdit");
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    dispatchDockKeydown(lens.dockTextarea, KeyCode.Escape);
    assert.strictEqual(lens.composerPolicy, "turnEdit");
    assert.strictEqual(lens.dockTextarea.value, "");
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
    dispatchDockKeydown(lens.dockTextarea, KeyCode.Escape);
    assert.strictEqual(lens.composerPolicy, "compose");
    assert.strictEqual(lens.dockTextarea.value, "A");
    assert.strictEqual(lens.readComposerDraft(sessionA), "A");
  });
  test("compose input history still writes textarea into drafts", () => {
    const { part, lens, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionA = stubService.getActiveSessionId();
    const userTurn = stubService.appendUserTurn(sessionA, "sent history");
    assert.ok(userTurn);
    assert.strictEqual(lens.composerPolicy, "compose");
    getDockTextarea(slots).value = "";
    assert.ok(lens.navigateInputHistory("older"));
    assert.strictEqual(getDockTextarea(slots).value, "sent history");
    assert.strictEqual(lens.readComposerDraft(sessionA), "sent history");
    lens.exitInputHistoryBrowse();
    assert.strictEqual(getDockTextarea(slots).value, "");
    assert.strictEqual(lens.readComposerDraft(sessionA), "");
  });
  test("SessionBar select refreshes after deleting the last stub session", async () => {
    const { part, stubService, lens } = mountLens();
    const slots = getLensSlots(part);
    const sessions = [...stubService.getSessions()];
    lens.dialogService.confirm = () => Promise.resolve({ confirmed: true });
    for (const session of sessions) {
      if (stubService.getActiveSessionId() !== session.id) {
        stubService.switchSession(session.id);
      }
      const deleteButton = slots.sessionBar.querySelector(".conversation-lens-session-delete .monaco-button");
      deleteButton.click();
      await Promise.resolve();
      await Promise.resolve();
    }
    const titleLive = slots.sessionBar.querySelector(".conversation-lens-session-title-live");
    assert.strictEqual(stubService.getSessions().length, 1);
    assert.ok(stubService.getActiveSession().title.includes("Untitled"));
    assert.strictEqual(getSessionSelectLabel(slots), stubService.getActiveSession().title);
    assert.strictEqual(titleLive.textContent, stubService.getActiveSession().title);
    assert.strictEqual(slots.sessionBar.querySelector(".conversation-lens-session-select select.monaco-select-box option")?.textContent, stubService.getActiveSession().title);
  });
  test("user turns are display-only; assistant turns expose Copy, Regenerate and Delete action bars", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens({ layoutHeight: 1200 });
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendUserTurn(sessionId, "Click me user");
    stubService.appendStubEchoAssistant(sessionId, "Copy me assistant");
    stubService.appendStubEchoAssistant(sessionId, "Later reply");
    stubService.appendThinkingTurn(sessionId, "Thinking summary");
    stubService.appendToolTurn(sessionId, "Tool summary");
    stubService.appendConfirmationTurn(sessionId, "Confirm this?");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    const foldHeader = queryTimeline(slots, ".conversation-process-fold-header");
    assert.ok(foldHeader);
    foldHeader.click();
    const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]');
    const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
    assert.strictEqual(userTurn.classList.contains("conversation-lens-turn--user-align-end"), false);
    assert.strictEqual(assistantTurn.classList.contains("conversation-lens-turn--user-align-end"), false);
    assert.ok(userTurn.querySelector(".conversation-lens-turn-body--clickable"));
    assert.strictEqual(userTurn.querySelector(".conversation-lens-turn-actions"), null);
    const assistantActions = assistantTurn.querySelector(".conversation-lens-turn-actions");
    assert.ok(assistantActions);
    const assistantCopy = assistantActions.querySelector(".conversation-lens-turn-action-copy .monaco-button");
    const assistantRegenerate = assistantActions.querySelector(".conversation-lens-turn-action-regenerate .monaco-button");
    const assistantDelete = assistantActions.querySelector(".conversation-lens-turn-action-delete .monaco-button");
    assert.strictEqual(assistantCopy.getAttribute("aria-label"), conversationLensTurnCopy);
    assert.strictEqual(assistantRegenerate.getAttribute("aria-label"), conversationLensTurnRegenerate);
    assert.strictEqual(assistantDelete.getAttribute("aria-label"), conversationLensTurnDelete);
    const assistantTurns = [...queryAllTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]')];
    assert.strictEqual(assistantTurns.length, 2);
    assert.strictEqual(assistantTurns[0].closest("article")?.classList.contains("conversation-timeline-item--latest-assistant"), false);
    assert.strictEqual(assistantTurns[1].closest("article")?.classList.contains("conversation-timeline-item--latest-assistant"), true);
    const laterBody = assistantTurns[1].querySelector(".conversation-lens-turn-body");
    const laterActions = assistantTurns[1].querySelector(".conversation-lens-turn-actions");
    assert.ok(laterBody.compareDocumentPosition(laterActions) & Node.DOCUMENT_POSITION_FOLLOWING);
    assert.strictEqual(queryTimeline(slots, ".conversation-process-fold-thinking .conversation-lens-turn-actions"), null);
    assert.strictEqual(queryTimeline(slots, ".conversation-process-fold-tool .conversation-lens-turn-actions"), null);
    assert.strictEqual(queryTimeline(slots, ".conversation-lens-confirmation-seat .conversation-lens-turn-actions"), null);
    assert.strictEqual(userTurn.querySelector('[aria-label*="Regenerate"]'), null);
    assert.strictEqual(queryTimeline(slots, '.conversation-process-fold-thinking [aria-label*="Regenerate"]'), null);
    assert.strictEqual(queryTimeline(slots, '.conversation-process-fold-tool [aria-label*="Regenerate"]'), null);
    assert.strictEqual(queryTimeline(slots, '.conversation-lens-confirmation-seat [aria-label*="Regenerate"]'), null);
    assert.strictEqual(queryTimeline(slots, '[aria-label*="Quote"]'), null);
    assert.strictEqual(queryTimeline(slots, '[aria-label*="Edit"]'), null);
  });
  test("Delete turn removes it from timeline and trajectory; Copy writes turn text to clipboard", async function() {
    this.timeout(3e4);
    const { part, lens, stubService, clipboardService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const userText = "Delete and copy user text";
    const assistantText = "Delete and copy assistant text";
    stubService.appendUserTurn(sessionId, userText);
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    stubService.appendStubEchoAssistant(sessionId, assistantText);
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await revealLatestTurn(lens, stubService, layoutReadingColumn2, (turn) => turn.kind === "user" && turn.text === userText);
    await revealLatestTurn(lens, stubService, layoutReadingColumn2, (turn) => turn.kind === "assistant" && turn.text === assistantText);
    const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]');
    const assistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
    assert.ok(userTurn);
    assert.ok(assistantTurn);
    clickLensTab(slots, "trajectory");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await paintTrajectoryRows(lens, slots, stubService, layoutReadingColumn2, 2);
    let trajectory = slots.timeline.querySelector(".conversation-lens-trajectory");
    assert.strictEqual(trajectory.querySelectorAll(".conversation-lens-trajectory-record-row").length, 2);
    clickLensTab(slots, "conversation");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await revealLatestTurn(lens, stubService, layoutReadingColumn2, (turn) => turn.kind === "assistant" && turn.text === assistantText);
    const liveAssistantTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]');
    assert.ok(liveAssistantTurn);
    const assistantCopy = liveAssistantTurn.querySelector(".conversation-lens-turn-action-copy .monaco-button");
    assistantCopy.click();
    assert.strictEqual(await clipboardService.readText(), assistantText);
    const assistantDelete = liveAssistantTurn.querySelector(".conversation-lens-turn-action-delete .monaco-button");
    assistantDelete.click();
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    assert.strictEqual(stubService.getTurns(sessionId).length, 1);
    assert.strictEqual(stubService.getTurns(sessionId)[0].text, userText);
    clickLensTab(slots, "trajectory");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await paintTrajectoryRows(lens, slots, stubService, layoutReadingColumn2, 1);
    trajectory = slots.timeline.querySelector(".conversation-lens-trajectory");
    assert.strictEqual(trajectory.querySelectorAll(".conversation-lens-trajectory-record-row").length, 1);
    assert.ok(trajectory.textContent?.includes(userText));
    assert.ok(!trajectory.textContent?.includes(assistantText));
    clickLensTab(slots, "conversation");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await revealLatestTurn(lens, stubService, layoutReadingColumn2, (turn) => turn.kind === "user" && turn.text === userText);
    await flushAnimationFrames();
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
    assert.strictEqual(queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]'), null);
  });
  test("T5 Edit XOR: entering turn edit keeps the dock composer (no 0px warn)", async function() {
    this.timeout(15e3);
    const { part, lens, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendUserTurn(sessionId, "Edit this user turn");
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await revealLatestTurn(lens, stubService, layoutReadingColumn2, (turn) => turn.kind === "user" && turn.text === "Edit this user turn");
    const listViewZeroPx = [];
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args.map(String).join(" ");
      if (message.includes("Measured item node at 0px")) {
        listViewZeroPx.push(message);
      }
      originalWarn.apply(console, args);
    };
    try {
      const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body--clickable');
      assert.ok(userBody);
      userBody.click();
      layoutReadingColumn2();
      await flushTimelineHeightUpdates();
      await flushAnimationFrames();
    } finally {
      console.warn = originalWarn;
    }
    assert.deepStrictEqual(listViewZeroPx, []);
    assert.strictEqual(countComposers(slots), 1);
    assert.ok(slots.dock.querySelector(".conversation-lens-composer"));
    assert.strictEqual(queryTimeline(slots, ".conversation-lens-composer"), null);
  });
  test("T5 Edit XOR: user card click edits in the dock composer and keeps the bottom bar", async function() {
    this.timeout(15e3);
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const userText = "Edit this user turn";
    stubService.appendUserTurn(sessionId, userText);
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    assert.ok(slots.dock.querySelector(".conversation-lens-composer"));
    assert.strictEqual(countComposers(slots), 1);
    const userBody = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body--clickable');
    assert.ok(userBody);
    userBody.click();
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await flushAnimationFrames();
    assert.strictEqual(countComposers(slots), 1);
    const dockComposer = slots.dock.querySelector(".conversation-lens-composer");
    assert.ok(dockComposer);
    assert.ok(dockComposer.classList.contains("conversation-lens-composer--edit"));
    assert.ok(dockComposer.querySelector(".conversation-lens-composer-edit-header"));
    assert.strictEqual(dockComposer.querySelector(".conversation-lens-composer-edit-title")?.textContent, conversationLensDockEditingMessage);
    assert.ok(dockComposer.querySelector(".conversation-lens-dock-bottom-bar"));
    assert.strictEqual(queryTimeline(slots, ".conversation-lens-composer"), null);
    assert.ok(queryTimeline(slots, ".conversation-lens-turn--editing"));
    const textarea = dockComposer.querySelector("textarea.conversation-lens-dock-input");
    assert.strictEqual(textarea.value, userText);
    const exitButton = dockComposer.querySelector(".conversation-lens-composer-edit-exit .monaco-button");
    assert.strictEqual(exitButton.getAttribute("title"), null);
    assert.strictEqual(exitButton.getAttribute("aria-label"), conversationLensDockEditExit);
    exitButton.click();
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    assert.strictEqual(countComposers(slots), 1);
    assert.ok(slots.dock.querySelector(".conversation-lens-composer"));
    assert.strictEqual(slots.dock.querySelector(".conversation-lens-composer--edit"), null);
    assert.strictEqual(queryTimeline(slots, ".conversation-lens-composer"), null);
  });
  test("T5 Edit XOR: queue row edit mounts composer in dock and XORs compose", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    await sendDockDraft(slots, "Activate queue edit");
    stubService.setMessageQueueFixture(sessionId, {
      isPaused: false,
      isProcessing: false,
      items: [{
        id: "q-edit",
        content: "Queued message body",
        status: "PENDING",
        hold: void 0,
        uploadProgress: void 0,
        retryCount: 0,
        lastError: void 0,
        locked: false,
        pinned: false
      }]
    });
    getInboxQueueChip(slots).click();
    const row = getVisibleInboxListPanel().querySelector('.queue-item[data-item-id="q-edit"]');
    row.click();
    await flushAnimationFrames();
    assert.strictEqual(countComposers(slots), 1);
    const dockComposer = slots.dock.querySelector(".conversation-lens-composer");
    assert.ok(dockComposer.classList.contains("conversation-lens-composer--edit"));
    assert.ok(dockComposer.querySelector(".conversation-lens-composer-edit-title")?.textContent?.includes("Queued message body"));
    const textarea = dockComposer.querySelector("textarea.conversation-lens-dock-input");
    assert.strictEqual(textarea.value, "Queued message body");
    assert.strictEqual(queryTimeline(slots, ".conversation-lens-composer"), null);
    const exitButton = dockComposer.querySelector(".conversation-lens-composer-edit-exit .monaco-button");
    exitButton.click();
    assert.strictEqual(stubService.getMessageQueueState(sessionId).items[0]?.hold, void 0);
    assert.strictEqual(countComposers(slots), 1);
    assert.ok(slots.dock.querySelector(".conversation-lens-composer"));
    assert.strictEqual(slots.dock.querySelector(".conversation-lens-composer--edit"), null);
  });
  test("T6 Voice: no mic, no transcript bar, and no stub phrase written to draft", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    await sendDockDraftAndFlush(slots, "seed active composer");
    const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
    const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
    stubService.wireTestFrameSource(testSource);
    assert.deepStrictEqual(stubService.getSessionSync(sessionId), { kind: "idle" });
    const trailing = getComposerBottomBar(slots).querySelector(".conversation-lens-dock-bottom-trailing");
    assert.strictEqual(trailing.querySelector(".conversation-lens-dock-mic"), null);
    assert.strictEqual(
      slots.dock.querySelector(".conversation-lens-voice-transcript-bar") ?? getReadingColumn(slots).querySelector(".conversation-lens-voice-transcript-bar"),
      null
    );
    stubService.setEngineConnected(true);
    assert.strictEqual(trailing.querySelector(".conversation-lens-dock-mic"), null);
    assert.deepStrictEqual(stubService.getSessionSync(sessionId), { kind: "idle" });
    stubService.setMessageQueueFixture(sessionId, {
      items: [{ id: "q1", content: "Queued item", status: "PENDING", hold: void 0, uploadProgress: void 0, retryCount: 0, lastError: void 0, locked: false, pinned: false }],
      isPaused: false,
      isProcessing: false
    });
    getInboxQueueChip(slots).click();
    const queuePanel = getVisibleInboxListPanel();
    assert.ok(queuePanel);
    assert.strictEqual(queuePanel.querySelector(".conversation-lens-voice-transcript-bar"), null);
    assert.ok(!queuePanel.textContent?.includes("Stub voice segment"));
    const draftBefore = getDockTextarea(slots).value;
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(getDockTextarea(slots).value, draftBefore);
    assert.ok(!getDockTextarea(slots).value.includes("Stub voice segment one"));
    assert.ok(!getDockTextarea(slots).value.includes("Stub voice segment two"));
    assert.ok(!getDockTextarea(slots).value.includes("Stub voice segment three"));
    stubService.setEngineConnected(false);
    assert.strictEqual(trailing.querySelector(".conversation-lens-dock-mic"), null);
  });
  test("T6 Voice: connected engine still has no mic write-to-draft path", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
    const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
    stubService.wireTestFrameSource(testSource);
    assert.deepStrictEqual(stubService.getSessionSync(sessionId), { kind: "idle" });
    stubService.setEngineConnected(true);
    assert.strictEqual(getComposerBottomBar(slots).querySelector(".conversation-lens-dock-mic"), null);
    assert.ok(!getDockTextarea(slots).value.includes("Stub voice segment"));
  });
  test("S3 send: dock post shows pending user row then supersedes to durable turns", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    await sendDockDraft(slots, "pending then durable");
    layoutReadingColumn2();
    await flushAnimationFrames();
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]'));
    assert.strictEqual(stubService.getSessionSync(sessionId).kind, "idle");
    const syncBadge = slots.sessionBar.querySelector(".conversation-lens-session-sync-badge");
    assert.ok(syncBadge);
    assert.strictEqual(syncBadge.hidden, false);
    assert.strictEqual(syncBadge.textContent, "Session not connected");
    assert.strictEqual(syncBadge.title, "Session not connected");
  });
  test("PRD-007: closed session shows column-top stale snapshot and keeps prior turns", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendUserTurn(sessionId, "Keep this turn after disconnect");
    stubService.appendStubEchoAssistant(sessionId, "Echo before disconnect");
    await flushProjectedTimeline(layoutReadingColumn2);
    const banner = getReadingColumn(slots).querySelector(`.${conversationLensStaleSnapshotClass}`);
    assert.ok(banner);
    assert.strictEqual(banner.hidden, true);
    assert.strictEqual(banner.getAttribute("role"), "status");
    assert.strictEqual(banner.getAttribute("aria-live"), "polite");
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')?.textContent?.includes("Keep this turn after disconnect"));
    const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
    const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
    stubService.wireTestFrameSource(testSource);
    testSource.setSessionSync(sessionId, { kind: "live" });
    onSessionChanged(sessionId);
    assert.strictEqual(banner.hidden, true);
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')?.textContent?.includes("Keep this turn after disconnect"));
    testSource.setSessionSync(sessionId, { kind: "closed", reason: "Subscription ended" });
    onSessionChanged(sessionId);
    assert.strictEqual(stubService.getSessionSync(sessionId).kind, "closed");
    assert.strictEqual(banner.hidden, false);
    assert.strictEqual(banner.textContent, "Showing snapshot from before disconnect: Subscription ended");
    assert.ok(!/synced|已同步|session live/i.test(banner.textContent ?? ""));
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')?.textContent?.includes("Keep this turn after disconnect"));
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="assistant"]')?.textContent?.includes("Echo before disconnect"));
    assert.notStrictEqual(document.activeElement, banner);
    testSource.setSessionSync(sessionId, { kind: "live" });
    onSessionChanged(sessionId);
    assert.strictEqual(banner.hidden, true);
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]')?.textContent?.includes("Keep this turn after disconnect"));
    testSource.setSessionSync(sessionId, { kind: "closed", reason: "2" });
    onSessionChanged(sessionId);
    assert.strictEqual(banner.hidden, false);
    assert.strictEqual(banner.textContent, "Showing snapshot from before disconnect");
    assert.strictEqual(formatSyncChromeLabel({ kind: "closed", reason: "2" }), "Session disconnected");
    assert.strictEqual(formatSyncChromeLabel({ kind: "degraded", reason: "3" }), "Session degraded");
  });
  test("PRD-007: empty closed session does not claim a snapshot", () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const banner = getReadingColumn(slots).querySelector(`.${conversationLensStaleSnapshotClass}`);
    const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
    const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
    stubService.wireTestFrameSource(testSource);
    testSource.setSessionSync(sessionId, { kind: "closed", reason: "2" });
    onSessionChanged(sessionId);
    assert.strictEqual(stubService.getTurns(sessionId).length, 0);
    assert.strictEqual(banner.hidden, true);
    assert.strictEqual(banner.textContent, "");
  });
  test("PRD-007: lease apply closed sync shows stale snapshot without onDidChangeSession", async () => {
    const { part, lens, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    stubService.appendUserTurn(sessionId, "Keep this turn after lease-only sync");
    stubService.appendStubEchoAssistant(sessionId, "Echo before lease-only sync");
    await flushProjectedTimeline(layoutReadingColumn2);
    const banner = getReadingColumn(slots).querySelector(`.${conversationLensStaleSnapshotClass}`);
    assert.ok(banner);
    assert.strictEqual(banner.hidden, true);
    const { model, onSessionChanged } = stubService.createTestFrameSourceCallback();
    const testSource = store.add(new TestConversationFrameSource(model, onSessionChanged));
    stubService.wireTestFrameSource(testSource);
    lens.bindSessionView(sessionId);
    let sessionChangedAfterBind = 0;
    store.add(stubService.onDidChangeSession(() => {
      sessionChangedAfterBind++;
    }));
    testSource.setSessionSync(sessionId, { kind: "closed", reason: "Subscription ended" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.strictEqual(sessionChangedAfterBind, 0);
    assert.strictEqual(stubService.getSessionSync(sessionId).kind, "closed");
    assert.strictEqual(banner.hidden, false);
    assert.strictEqual(banner.textContent, "Showing snapshot from before disconnect: Subscription ended");
  });
  test("S3 shim: getTurns matches lease projection after fixture writes", () => {
    const service = store.add(new ConversationStubService());
    const sessionId = service.createSession();
    service.appendUserTurn(sessionId, "shim check");
    const lease = store.add(service.acquireSessionView(sessionId));
    assert.deepStrictEqual(
      service.getTurns(sessionId),
      entriesToLegacyTurns(projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details, service.stubTurnSessionLinkCatalog))
    );
  });
  test("dock input history recalls sent user drafts with ArrowUp and ArrowDown on empty composer", async () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const textarea = getDockTextarea(slots);
    await sendDockDraft(slots, "first message");
    await sendDockDraft(slots, "second message");
    assert.strictEqual(textarea.value, "");
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "second message");
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "first message");
    dispatchDockKeydown(textarea, KeyCode.DownArrow);
    assert.strictEqual(textarea.value, "second message");
  });
  test("dock input history is isolated per session", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const textarea = getDockTextarea(slots);
    await sendDockDraft(slots, "session A only");
    const sessionBId = stubService.createSession();
    assert.strictEqual(stubService.getActiveSessionId(), sessionBId);
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "");
    stubService.switchSession(stubService.getSessions()[0].id);
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "session A only");
  });
  test("dock input history Escape restores unsent draft snapshot", async () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const textarea = getDockTextarea(slots);
    await sendDockDraft(slots, "sent message");
    textarea.value = "  ";
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "sent message");
    dispatchDockKeydown(textarea, KeyCode.Escape);
    assert.strictEqual(textarea.value, "  ");
  });
  test("dock input history typing exits browse and keeps edited text", async () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const textarea = getDockTextarea(slots);
    await sendDockDraft(slots, "sent message");
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "sent message");
    textarea.value = `${textarea.value}a`;
    textarea.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
    assert.strictEqual(textarea.value, "sent messagea");
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "sent messagea");
  });
  test("dock input history ignores deleted user turns", async () => {
    const { part, stubService } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const textarea = getDockTextarea(slots);
    await sendDockDraft(slots, "delete me");
    await sendDockDraft(slots, "keep me");
    const doomed = stubService.getTurns(sessionId).find((turn) => turn.kind === "user" && turn.text === "delete me");
    assert.ok(doomed);
    stubService.deleteTurn(sessionId, doomed.id);
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "keep me");
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "keep me");
  });
  test("dock input history ignores ArrowUp when composer is not trim-empty", async () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const textarea = getDockTextarea(slots);
    await sendDockDraft(slots, "sent message");
    textarea.value = "typing now";
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "typing now");
  });
  test("modified arrows do not recall input history", async () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const textarea = getDockTextarea(slots);
    await sendDockDraft(slots, "sent message");
    assert.strictEqual(textarea.value, "");
    textarea.selectionStart = 0;
    textarea.selectionEnd = 0;
    textarea.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 38, shiftKey: true, bubbles: true, cancelable: true }));
    assert.strictEqual(textarea.value, "");
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "sent message");
  });
  test("arrow inside a recalled multi-line dock draft does not replace it", async () => {
    const { part } = mountLens();
    const slots = getLensSlots(part);
    const textarea = getDockTextarea(slots);
    await sendDockDraft(slots, "older\nstill older");
    await sendDockDraft(slots, "newer\nstill newer");
    assert.strictEqual(textarea.value, "");
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "newer\nstill newer");
    assert.strictEqual(textarea.selectionStart, 0);
    textarea.selectionStart = "newer\n".length;
    textarea.selectionEnd = textarea.selectionStart;
    dispatchDockKeydown(textarea, KeyCode.UpArrow);
    assert.strictEqual(textarea.value, "newer\nstill newer");
    assert.strictEqual(textarea.selectionStart, "newer\n".length);
  });
  test("pinned user prompt is hidden at bottom and on empty session", async function() {
    this.timeout(3e4);
    const { part, lens, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    assert.notStrictEqual(getPinnedUserPrompt(slots)?.classList.contains("conversation-timeline-pinned-user--visible"), true);
    stubService.appendUserTurn(sessionId, "What is pinned?");
    stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    scrollTimelineToEndWithoutClobber(lens);
    await flushAnimationFrames();
    assert.ok(!getPinnedUserPrompt(slots)?.classList.contains("conversation-timeline-pinned-user--visible"));
    await scrollTimelineAwayFromPinnedRead(lens, slots, layoutReadingColumn2);
    assert.ok(getPinnedUserPrompt(slots)?.classList.contains("conversation-timeline-pinned-user--visible"));
    scrollTimelineToEndWithoutClobber(lens);
    await flushTimelineHeightUpdates();
    await flushAnimationFrames();
    assert.ok(!getPinnedUserPrompt(slots)?.classList.contains("conversation-timeline-pinned-user--visible"));
  });
  test("pinned user prompt shows one-line preview and reveals user turn on click", async function() {
    this.timeout(3e4);
    const { part, lens, stubService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const userText = "Scroll target user prompt";
    stubService.appendUserTurn(sessionId, userText);
    stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await scrollTimelineAwayFromPinnedRead(lens, slots, layoutReadingColumn2);
    const bubble = getPinnedUserPromptBubble(slots);
    assert.ok(bubble);
    assert.strictEqual(bubble.getAttribute("aria-label"), conversationLensPinnedUserPromptAria);
    assert.strictEqual(bubble.querySelector(".conversation-timeline-pinned-user-text")?.textContent, userText);
    assert.strictEqual(bubble.textContent?.includes("Pinned prompt"), false);
    bubble.click();
    await flushTimelineHeightUpdates();
    await flushAnimationFrames();
    await revealLatestTurn(lens, stubService, layoutReadingColumn2, (turn) => turn.kind === "user" && turn.text === userText);
    const userTurn = queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]');
    assert.ok(userTurn);
    assert.ok(!getPinnedUserPrompt(slots)?.classList.contains("conversation-timeline-pinned-user--visible"));
  });
  test("untitled fixture renders collapsed process fold header with Stub summary", async () => {
    const { part, lens, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    await revealUntitledProcessFold(lens, layoutReadingColumn2);
    const fold = queryTimeline(slots, "[data-process-fold]");
    assert.ok(fold);
    const header = fold.querySelector(".conversation-process-fold-header");
    assert.strictEqual(header.getAttribute("aria-expanded"), "false");
    assert.ok(header.textContent?.includes("Stub"));
    assert.ok(header.textContent?.includes("4 steps"));
    const children = fold.querySelector(".conversation-process-fold-children");
    assert.strictEqual(children.hidden, false);
    assert.strictEqual(children.classList.contains("conversation-process-fold--collapsed"), true);
  });
  test("expanding untitled process fold reveals nested thinking and tool indent layers", async () => {
    const { part, lens, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    await revealUntitledProcessFold(lens, layoutReadingColumn2);
    const fold = queryTimeline(slots, "[data-process-fold]");
    const header = fold.querySelector(".conversation-process-fold-header");
    header.click();
    const children = fold.querySelector(".conversation-process-fold-children");
    assert.strictEqual(children.hidden, false);
    assert.strictEqual(children.classList.contains("conversation-process-fold--collapsed"), false);
    const thinkingBlocks = fold.querySelectorAll(".conversation-process-fold-thinking");
    assert.strictEqual(thinkingBlocks.length, 2);
    const siblingTools = fold.querySelectorAll(".conversation-process-fold-children > .conversation-process-fold-tool");
    assert.strictEqual(siblingTools.length, 2);
    assert.strictEqual(fold.querySelectorAll(".conversation-process-fold-tool--nested").length, 0);
    assert.strictEqual(fold.querySelector(".conversation-process-fold-thinking .conversation-process-fold-tool"), null);
    const draftHeader = fold.querySelector('.conversation-process-fold-thinking[data-turn-id="untitled-t2"] .conversation-process-fold-thinking-header');
    assert.ok(draftHeader?.textContent?.includes("Stub: draft"));
    assert.ok(!draftHeader?.textContent?.includes("write"));
    assert.ok(draftHeader?.parentElement?.classList.contains("conversation-process-fold-thinking-line"));
    const childrenStyle = getWindow(children).getComputedStyle(children);
    assert.ok(parseFloat(childrenStyle.paddingInlineStart) >= 12);
    const firstThinking = fold.querySelector('.conversation-process-fold-thinking[data-turn-id="untitled-t1"]');
    const thinkingHeader = firstThinking.querySelector(".conversation-process-fold-thinking-header");
    assert.strictEqual(thinkingHeader.getAttribute("aria-expanded"), "false");
    assert.ok(header.querySelector(".conversation-process-fold-chevron"), "outer process fold keeps the disclosure chevron");
    assert.strictEqual(children.querySelector(".conversation-process-fold-chevron, .conversation-process-fold-tool-chevron, .codicon-chevron-right"), null);
    const readTool = fold.querySelector('.conversation-process-fold-tool[data-turn-id="untitled-tool1"]');
    assert.ok(readTool);
    assert.strictEqual(readTool.hidden, false);
    const toolHeader = readTool.querySelector(".conversation-process-fold-tool-header");
    assert.ok(thinkingHeader.getBoundingClientRect().width > 0, "thinking header has no layout width");
    assert.ok(Math.abs(thinkingHeader.getBoundingClientRect().left - toolHeader.getBoundingClientRect().left) <= 2, `tool header left ${toolHeader.getBoundingClientRect().left} vs thinking header left ${thinkingHeader.getBoundingClientRect().left}`);
  });
  test("user and confirmation seats stay outside process fold on untitled fixture", async () => {
    const { part, lens, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    await revealUntitledProcessFold(lens, layoutReadingColumn2);
    const fold = queryTimeline(slots, "[data-process-fold]");
    assert.strictEqual(fold.querySelector('.conversation-lens-turn[data-kind="user"]'), null);
    assert.strictEqual(fold.querySelector(".conversation-lens-confirmation-seat"), null);
    await revealVisualizeTurn(lens, layoutReadingColumn2, "untitled-u1");
    assert.ok(queryTimeline(slots, '.conversation-lens-turn[data-kind="user"]'));
    await revealVisualizeTurn(lens, layoutReadingColumn2, "untitled-c1");
    assert.ok(queryTimeline(slots, ".conversation-lens-confirmation-seat"));
  });
  test("expanding untitled thinking reveals Stub payload body distinct from header summary", async () => {
    const { part, lens, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    await revealUntitledProcessFold(lens, layoutReadingColumn2);
    const fold = queryTimeline(slots, "[data-process-fold]");
    fold.querySelector(".conversation-process-fold-header").click();
    const firstThinking = fold.querySelector('.conversation-process-fold-thinking[data-turn-id="untitled-t1"]');
    const thinkingHeader = firstThinking.querySelector(".conversation-process-fold-thinking-header");
    assert.ok(thinkingHeader.textContent?.includes("Stub: outline sections"));
    thinkingHeader.click();
    const body = firstThinking.querySelector(".conversation-process-fold-thinking-body");
    assert.strictEqual(body.hidden, false);
    assert.strictEqual(body.classList.contains("conversation-process-fold--collapsed"), false);
    assert.ok(body.textContent?.includes("Stub: Consider intro"));
    assert.notStrictEqual(body.textContent, thinkingHeader.textContent);
  });
  test("expanding untitled tool row reveals Stub payload text", async () => {
    const { part, lens, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    await revealUntitledProcessFold(lens, layoutReadingColumn2);
    const fold = queryTimeline(slots, "[data-process-fold]");
    fold.querySelector(".conversation-process-fold-header").click();
    const readTool = fold.querySelector('.conversation-process-fold-tool[data-turn-id="untitled-tool1"]');
    assert.strictEqual(readTool.closest(".conversation-process-fold-thinking"), null);
    const toolHeader = readTool.querySelector(".conversation-process-fold-tool-header");
    assert.ok(toolHeader.textContent?.includes("read"));
    assert.ok(toolHeader.textContent?.includes("Stub: README.md"));
    toolHeader.click();
    const payload = readTool.querySelector(".conversation-process-fold-tool-body");
    assert.strictEqual(payload.hidden, false);
    assert.strictEqual(payload.classList.contains("conversation-process-fold--collapsed"), false);
    assert.ok(payload.textContent?.includes("Stub: # Project"));
  });
  test("pinned user prompt copy writes full text and exposes no Quote Edit or Regenerate", async function() {
    this.timeout(15e3);
    const { part, lens, stubService, clipboardService, layoutReadingColumn: layoutReadingColumn2 } = mountLens();
    const slots = getLensSlots(part);
    const sessionId = stubService.createSession();
    const userText = userMessageLines(8);
    stubService.appendUserTurn(sessionId, userText);
    stubService.appendStubEchoAssistant(sessionId, userMessageLines(40));
    layoutReadingColumn2();
    await flushTimelineHeightUpdates();
    await scrollTimelineAwayFromPinnedRead(lens, slots, layoutReadingColumn2);
    const pinnedHost = getPinnedUserPrompt(slots);
    assert.ok(pinnedHost?.classList.contains("conversation-timeline-pinned-user--visible"));
    const copyButton = pinnedHost.querySelector(".conversation-timeline-pinned-user-copy .monaco-button");
    assert.strictEqual(copyButton.getAttribute("aria-label"), conversationLensPinnedUserPromptCopyAria);
    copyButton.click();
    assert.strictEqual(await clipboardService.readText(), userText.replace(/\n/g, " ").replace(/\s+/g, " ").trim());
    assert.strictEqual(pinnedHost.querySelector('[aria-label*="Quote"]'), null);
    assert.strictEqual(pinnedHost.querySelector('[aria-label*="Edit"]'), null);
    assert.strictEqual(pinnedHost.querySelector('[aria-label*="Regenerate"]'), null);
    assert.strictEqual(pinnedHost.querySelector(".conversation-lens-turn-actions"), null);
  });
  test("visualize seed session renders two visualization cards without Agent header", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2, lens } = mountLens();
    const slots = getLensSlots(part);
    await showVisualizeSeed(stubService, layoutReadingColumn2);
    const projected = lens.lastAttachedEntries.filter((entry) => entry.kind === "visualization");
    assert.strictEqual(projected.length, 2);
    assert.deepStrictEqual(projected.map((entry) => entry.id), ["visualize-v1", "visualize-v2"]);
    await revealVisualizeTurn(lens, layoutReadingColumn2, "visualize-v2");
    const comparison = queryTimeline(slots, '[data-visualize-type="comparison"]');
    assert.ok(comparison);
    assert.strictEqual(comparison.querySelector(".conversation-lens-turn-header"), null);
    assert.ok(comparison.querySelector('.conversation-visualize-option[data-recommended="true"]'));
  });
  test("visualize card header collapses and expands body", async () => {
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2, lens } = mountLens();
    const slots = getLensSlots(part);
    await showVisualizeSeed(stubService, layoutReadingColumn2);
    await revealVisualizeTurn(lens, layoutReadingColumn2, "visualize-v2");
    const header = queryTimeline(slots, '[data-visualize-type="comparison"] .conversation-visualize-header');
    const body = queryTimeline(slots, '[data-visualize-type="comparison"] .conversation-visualize-body');
    assert.ok(header);
    assert.ok(body);
    assert.strictEqual(body.hidden, false);
    header.click();
    assert.strictEqual(body.hidden, true);
  });
  test("visualize diagram expand opens overlay dialog closed by Escape and session switch", async function() {
    this.timeout(15e3);
    const { part, stubService, layoutReadingColumn: layoutReadingColumn2, openInEditorCalls, layoutContainer, lens } = mountLens();
    const slots = getLensSlots(part);
    await showVisualizeSeed(stubService, layoutReadingColumn2);
    await revealVisualizeTurn(lens, layoutReadingColumn2, "visualize-v1");
    const diagram = queryTimeline(slots, '[data-visualize-type="diagram"]');
    assert.ok(diagram);
    assert.strictEqual(diagram.querySelector(".conversation-lens-turn-header"), null);
    const source = queryTimeline(slots, "pre[data-mermaid-source], [data-mermaid-host]");
    assert.ok(source);
    const sourceText = source.textContent ?? "";
    if (source.matches("pre[data-mermaid-source]")) {
      assert.ok(sourceText.includes("\u51BB\u7ED3"));
      assert.ok(sourceText.includes("\u8FDB\u884C\u4E2D"));
      assert.ok(sourceText.includes("\u672A\u7ACB\u9879"));
    }
    const expandButton = queryTimeline(slots, '[data-visualize-type="diagram"] .conversation-visualize-expand');
    assert.ok(expandButton);
    expandButton.click();
    assert.ok(layoutContainer.querySelector('.conversation-visualize-overlay[role="dialog"]'));
    const dialog = layoutContainer.querySelector(".conversation-visualize-overlay");
    assert.ok(slots.timeline.contains(dialog));
    assert.ok(!slots.dock.contains(dialog));
    dialog.dispatchEvent(new KeyboardEvent("keydown", { keyCode: KeyCode.Escape, bubbles: true }));
    assert.strictEqual(layoutContainer.querySelector('.conversation-visualize-overlay[role="dialog"]'), null);
    expandButton.click();
    assert.ok(layoutContainer.querySelector('.conversation-visualize-overlay[role="dialog"]'));
    stubService.switchSession("untitled");
    assert.strictEqual(layoutContainer.querySelector('.conversation-visualize-overlay[role="dialog"]'), null);
    assert.strictEqual(openInEditorCalls.count, 0);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi90ZXN0L2Jyb3dzZXIvY29udmVyc2F0aW9uTGVucy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHR5cGUgeyBJQ29udGV4dE1lbnVEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9jb250ZXh0bWVudS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25QYXJ0LCBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9jb252ZXJzYXRpb24vY29udmVyc2F0aW9uUGFydC5qcyc7XG5pbXBvcnQgeyBQYXJ0cyB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xheW91dC9icm93c2VyL2xheW91dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vY2hhdC9icm93c2VyL3dpZGdldEhvc3RzL2VkaXRvci9jaGF0RWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgVGVzdExheW91dFNlcnZpY2UsIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25DaGF0SW5wdXQgfSBmcm9tICcuLi8uLi9jb21tb24vY29udmVyc2F0aW9uQ2hhdElucHV0LmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbkVkaXRvclBhbmUgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkVkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgQ29udmVyc2F0aW9uTGVucywgbGF0ZXN0QWRtaXR0ZWRJbmJveENvbnRleHRVc2FnZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVucy5qcyc7XG5pbXBvcnQgeyBzdHViQ29udmVyc2F0aW9uVGltZWxpbmVMaW5rU2VydmljZXMgfSBmcm9tICcuL2NvbnZlcnNhdGlvblRpbWVsaW5lTGlua1Rlc3RTdHVicy5qcyc7XG5pbXBvcnQgeyBjb252ZXJzYXRpb25MZW5zU3RhbGVTbmFwc2hvdENsYXNzIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25MZW5zUmVhZGluZ0NvbHVtbi5qcyc7XG5pbXBvcnQgeyBmb3JtYXRTeW5jQ2hyb21lTGFiZWwgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25WaWV3LmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvblRpbWVsaW5lSG9zdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uVGltZWxpbmVIb3N0LmpzJztcbmltcG9ydCB7IGNvbnZlcnNhdGlvbkxlbnNVc2VyQnViYmxlU2hvd0xlc3MsIGNvbnZlcnNhdGlvbkxlbnNVc2VyQnViYmxlU2hvd01vcmUsIGNvbnZlcnNhdGlvbkxlbnNUdXJuUmVnZW5lcmF0ZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uVGltZWxpbmVSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25UcmFqZWN0b3J5IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25UcmFqZWN0b3J5LmpzJztcbmltcG9ydCB7XG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrQ29udHJvbEhlaWdodFB4LFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja0VkaXRFeGl0LFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja0VkaXRpbmdNZXNzYWdlLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja0VuZ2luZU5vdENvbm5lY3RlZCxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tHb2FsLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja0luYm94Tm9RdWV1ZSxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tJbmJveFF1ZXVlTGFiZWwsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrTWF4aW1pemVJbnB1dCxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tHb2FsVW5hdmFpbGFibGUsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9Hb2FsLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja05vTW9kZWwsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9Ub29scyxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tOb0VuZ2luZVRvb2xzLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja1Blcm1pc3Npb25Bc2ssXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrUGVybWlzc2lvbkxhYmVsLFxuXHRjb252ZXJzYXRpb25MZW5zRG9ja1Blcm1pc3Npb25QZXJtaXQsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrUGxhY2Vob2xkZXIsXG5cdGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkLFxuXHRjb252ZXJzYXRpb25MZW5zUG9zdEZhaWxlZERpc2Nvbm5lY3RlZCxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tSZXN0b3JlVGltZWxpbmUsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrU3RvcCxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tTdG9wTm90R2VuZXJhdGluZyxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tBZGRUaXRsZSxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tUdW5lVGl0bGUsXG5cdGNvbnZlcnNhdGlvbkxlbnNJbnB1dE1heGltaXplZENsYXNzLFxuXHRjb252ZXJzYXRpb25MZW5zUGhhc2VQcmVGaXJzdENsYXNzLFxuXHRjb252ZXJzYXRpb25MZW5zUGhhc2VQcmVGaXJzdERvY2tIaWRkZW5DbGFzcyxcblx0Y29udmVyc2F0aW9uTGVuc1ByZWZpcnN0SGVyb0NsYXNzLFxuXHRjb252ZXJzYXRpb25MZW5zSW5ib3hRdWV1ZUVkaXRpbmdUYWcsXG5cdGNvbnZlcnNhdGlvbkxlbnNJbmJveFF1ZXVlUGF1c2UsXG59IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc0RvY2tTdHJpbmdzLmpzJztcbmltcG9ydCB7IGNvbnZlcnNhdGlvbkxlbnNEb2NrQWdlbnRVbmF2YWlsYWJsZSwgY29udmVyc2F0aW9uTGVuc0RvY2tFbmdpbmVDYXBhYmlsaXR5VW5zdXBwb3J0ZWQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrTW9kZWxGYWlsZWQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrTW9kZWxVbmF2YWlsYWJsZSwgY29udmVyc2F0aW9uTGVuc0RvY2tQZXJtaXNzaW9uVW5hdmFpbGFibGUgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNDb21wb3NlckNocm9tZS5qcyc7XG5pbXBvcnQge1xuXHRjb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhckNvbnZlcnNhdGlvblRhYixcblx0Y29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJDbG9zZUV4dGVuc2lvblRhYnMsXG5cdGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyRGVsZXRlU2Vzc2lvbixcblx0Y29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJHb0JhY2ssXG5cdGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyR29Gb3J3YXJkLFxuXHRjb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhckhpc3RvcnksXG5cdGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyTW9yZSxcblx0Y29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJOZXdTZXNzaW9uLFxuXHRjb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhclNuYXBzaG90cyxcblx0Y29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJOb1RyYWplY3RvcnksXG5cdGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyVHJhamVjdG9yeVRhYixcblx0Y29udmVyc2F0aW9uTGVuc1Bpbm5lZFVzZXJQcm9tcHRBcmlhLFxuXHRjb252ZXJzYXRpb25MZW5zUGlubmVkVXNlclByb21wdENvcHlBcmlhLFxuXHRjb252ZXJzYXRpb25MZW5zVHVybkNvcHksXG5cdGNvbnZlcnNhdGlvbkxlbnNUdXJuRGVsZXRlLFxufSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyU3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBDb252ZXJzYXRpb25TdHViU2Vzc2lvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU3R1Yk1vZGVsLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlLCBJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZSwgdHlwZSBJQ29udmVyc2F0aW9uRW5naW5lQWN0aW9uRmFpbHVyZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uU3R1YlNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRU5HSU5FX0JJTkRfRkFJTEVEX1NFU1NJT05fSUQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbkVuZ2luZVJvc3RlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9hZFVhQ2xpZW50Q29tcG9zZXJEcmFmdCwgc3RvcmVVYUNsaWVudENvbXBvc2VyRHJhZnQgfSBmcm9tICcuLi8uLi9icm93c2VyL3VhQ2xpZW50Q29tcG9zZXJEcmFmdHMuanMnO1xuaW1wb3J0IHsgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHsgY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViLCBjcmVhdGVFbXB0eVRlc3RDYXBhYmlsaXR5U25hcHNob3QgfSBmcm9tICcuLi9jb21tb24vY29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViLmpzJztcbmltcG9ydCB7IGVudHJpZXNUb0xlZ2FjeVR1cm5zLCBwcm9qZWN0U25hcHNob3RUb0VudHJpZXMgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25WaWV3LmpzJztcbmltcG9ydCB0eXBlIHsgU2Vzc2lvblZpZXdTbmFwc2hvdCwgVGltZWxpbmVJdGVtSWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi9zZXNzaW9uVmlldy9pbmRleC5qcyc7XG5pbXBvcnQgeyBDT05WRVJTQVRJT05fTEVOU19JRF9TVE9SQUdFX0tFWSwgY29udmVyc2F0aW9uTGVuc0lkU3RvcmFnZUtleSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uTGVuc1Byb2plY3Rpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbnZlcnNhdGlvbkZyYW1lU291cmNlIH0gZnJvbSAnLi90ZXN0Q29udmVyc2F0aW9uRnJhbWVTb3VyY2UuanMnO1xuaW1wb3J0IHsgY29udmVyc2F0aW9uSWRlbnRpdHlTdHJpcENsYXNzIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9jb252ZXJzYXRpb25JZGVudGl0eVN0cmlwLmpzJztcbmltcG9ydCB7IENvbnZlcnNhdGlvbldvcmtSb290TW91bnRNb2RlbCwgSUNvbnZlcnNhdGlvbldvcmtSb290TW91bnQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvbldvcmtSb290TW91bnQuanMnO1xuaW1wb3J0IHsgZ2V0Q29udmVyc2F0aW9uU2Vzc2lvblN0YXR1c1RleHQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblNlc3Npb25TdGF0dXMuanMnO1xuaW1wb3J0IHsgc2hvdWxkUmVuZGVyVHVybkFzTWFya2Rvd24gfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblR1cm5NYXJrZG93bi5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0Q2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC90ZXN0L2NvbW1vbi90ZXN0Q2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElFeHBsb3JlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9icm93c2VyL2ZpbGVzLmpzJztcbmltcG9ydCB7IElTQ01TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2NtL2NvbW1vbi9zY20uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IFRlc3RTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXZWJ2aWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3dlYnZpZXcvYnJvd3Nlci93ZWJ2aWV3LmpzJztcbmltcG9ydCB7IElDb252ZXJzYXRpb25UaW1lbGluZVJldmVhbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvbnZlcnNhdGlvblRpbWVsaW5lUmV2ZWFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udmVyc2F0aW9uUmV2aWV3TmF2U2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvY29udmVyc2F0aW9uUmV2aWV3RW50cnkuanMnO1xuaW1wb3J0IHsgZmx1c2hDb252ZXJzYXRpb25MZW5zTGF5b3V0LCBpbnN0YWxsQ29udmVyc2F0aW9uTGVuc1Jlc2l6ZU9ic2VydmVySGFybmVzcywgeWllbGRDb252ZXJzYXRpb25MZW5zUGFpbnQgfSBmcm9tICcuL2NvbnZlcnNhdGlvbkxlbnNMYXlvdXRIYXJuZXNzLmpzJztcbmltcG9ydCB7IGdldFdpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuXG5zdWl0ZSgnQ29udmVyc2F0aW9uTGVucycsICgpID0+IHtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRjb25zdCBsZW5zU2xvdHNCeVBhcnQgPSBuZXcgV2Vha01hcDxDb252ZXJzYXRpb25QYXJ0LCBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzPigpO1xuXG5cdGluc3RhbGxDb252ZXJzYXRpb25MZW5zUmVzaXplT2JzZXJ2ZXJIYXJuZXNzKCk7XG5cblx0ZnVuY3Rpb24gZ2V0TGVuc1Nsb3RzKHBhcnQ6IENvbnZlcnNhdGlvblBhcnQpOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzIHtcblx0XHRjb25zdCBzbG90cyA9IGxlbnNTbG90c0J5UGFydC5nZXQocGFydCk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzKTtcblx0XHRyZXR1cm4gc2xvdHM7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCBmbHVzaENvbnZlcnNhdGlvbkxlbnNMYXlvdXQoKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGZsdXNoQW5pbWF0aW9uRnJhbWVzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IGZsdXNoQ29udmVyc2F0aW9uTGVuc0xheW91dCgpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gaW5mbGF0ZVRpbWVsaW5lUm93SGVpZ2h0cyhsZW5zOiBDb252ZXJzYXRpb25MZW5zLCBsYXlvdXQ6ICgpID0+IHZvaWQsIHJvd0hlaWdodCA9IDQwMCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRpbWVsaW5lVHJlZSA9IGdldFRpbWVsaW5lVHJlZShsZW5zKTtcblx0XHRmb3IgKGNvbnN0IGVsIG9mIEFycmF5LmZyb20odGltZWxpbmVUcmVlLmRvbU5vZGUucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oJy5jb252ZXJzYXRpb24tdGltZWxpbmUtaXRlbSwgLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4nKSkpIHtcblx0XHRcdGVsLnN0eWxlLm1pbkhlaWdodCA9IGAke3Jvd0hlaWdodH1weGA7XG5cdFx0fVxuXHRcdGxheW91dCgpO1xuXHRcdGF3YWl0IGZsdXNoQW5pbWF0aW9uRnJhbWVzKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0fVxuXG5cdHRlYXJkb3duKGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBmbHVzaENvbnZlcnNhdGlvbkxlbnNMYXlvdXQoKTtcblx0fSk7XG5cblx0Y29uc3QgTEVOU19MQVlPVVRfV0lEVEggPSA2NDA7XG5cdGNvbnN0IExFTlNfTEFZT1VUX0hFSUdIVCA9IDQ4MDtcblx0Y29uc3QgTEVOU19NSU5fV0lEVEggPSAzMDA7XG5cblx0ZnVuY3Rpb24gZ2V0TGVuc1RhYihzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cywgbGVuc0lkOiAnY29udmVyc2F0aW9uJyB8ICd0cmFqZWN0b3J5Jyk6IEhUTUxCdXR0b25FbGVtZW50IHtcblx0XHRjb25zdCB0YWJIb3N0ID0gc2xvdHMuc2Vzc2lvbkJhciA/PyBzbG90cy5sZW5zVGFibGlzdDtcblx0XHRhc3NlcnQub2sodGFiSG9zdCk7XG5cdFx0Y29uc3QgdGFiID0gdGFiSG9zdC5xdWVyeVNlbGVjdG9yKGBidXR0b24uY29udmVyc2F0aW9uLWxlbnMtbGVucy10YWJbZGF0YS1sZW5zLWlkPVwiJHtsZW5zSWR9XCJdYCkgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayh0YWIpO1xuXHRcdHJldHVybiB0YWI7XG5cdH1cblxuXHRmdW5jdGlvbiBjbGlja0xlbnNUYWIoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMsIGxlbnNJZDogJ2NvbnZlcnNhdGlvbicgfCAndHJhamVjdG9yeScpOiB2b2lkIHtcblx0XHRnZXRMZW5zVGFiKHNsb3RzLCBsZW5zSWQpLmNsaWNrKCk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRSZWFkaW5nQ29sdW1uKHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzKTogSFRNTEVsZW1lbnQge1xuXHRcdGNvbnN0IGNvbHVtbiA9IHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1yZWFkaW5nLWNvbHVtbicpO1xuXHRcdGFzc2VydC5vayhjb2x1bW4pO1xuXHRcdHJldHVybiBjb2x1bW4gYXMgSFRNTEVsZW1lbnQ7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRUaW1lbGluZVNjcm9sbChzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBzY3JvbGwgPSBzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdGltZWxpbmUtc2Nyb2xsJyk7XG5cdFx0YXNzZXJ0Lm9rKHNjcm9sbCk7XG5cdFx0cmV0dXJuIHNjcm9sbCBhcyBIVE1MRWxlbWVudDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFRpbWVsaW5lRW1wdHkoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuXHRcdGNvbnN0IGVtcHR5ID0gZ2V0VGltZWxpbmVTY3JvbGwoc2xvdHMpLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY29udmVyc2F0aW9uLWxlbnMtdGltZWxpbmUtZW1wdHknKTtcblx0XHRpZiAoIWVtcHR5IHx8IGVtcHR5LnN0eWxlLmRpc3BsYXkgPT09ICdub25lJykge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBlbXB0eTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbj86ICgpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMjApKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uPy4oKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHNob3dWaXN1YWxpemVTZWVkKHN0dWJTZXJ2aWNlOiBDb252ZXJzYXRpb25TdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbjogKCkgPT4gdm9pZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHN0dWJTZXJ2aWNlLnN3aXRjaFNlc3Npb24oJ3Zpc3VhbGl6ZScpO1xuXHRcdGF3YWl0IGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGlzUmV2ZWFsZWRUdXJuUGFpbnRlZChsZW5zOiBDb252ZXJzYXRpb25MZW5zLCB0dXJuSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IHRyZWUgPSBnZXRUaW1lbGluZVRyZWUobGVucyk7XG5cdFx0cmV0dXJuICEhdHJlZS5nZXRUaW1lbGluZVJvd0VsZW1lbnQodHVybklkKVxuXHRcdFx0fHwgISF0cmVlLmRvbU5vZGUucXVlcnlTZWxlY3RvcihgW2RhdGEtdHVybi1pZD1cIiR7dHVybklkfVwiXWApXG5cdFx0XHR8fCAhIXRyZWUuZG9tTm9kZS5xdWVyeVNlbGVjdG9yKGBbZGF0YS1mb2xkLWlkPVwiJHt0dXJuSWR9XCJdYCk7XG5cdH1cblxuXHRmdW5jdGlvbiByZXN0b3JlRGVsZWdhdGVSb3dIZWlnaHRzKGxlbnM6IENvbnZlcnNhdGlvbkxlbnMpOiB2b2lkIHtcblx0XHRjb25zdCB0aW1lbGluZVRyZWUgPSBnZXRUaW1lbGluZVRyZWUobGVucyk7XG5cdFx0Zm9yIChjb25zdCBlbCBvZiBBcnJheS5mcm9tKHRpbWVsaW5lVHJlZS5kb21Ob2RlLnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KCcuY29udmVyc2F0aW9uLXRpbWVsaW5lLWl0ZW0sIC5jb252ZXJzYXRpb24tbGVucy10dXJuJykpKSB7XG5cdFx0XHRlbC5zdHlsZS5taW5IZWlnaHQgPSAnJztcblx0XHR9XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiByZXZlYWxWaXN1YWxpemVUdXJuKGxlbnM6IENvbnZlcnNhdGlvbkxlbnMsIGxheW91dFJlYWRpbmdDb2x1bW46ICgpID0+IHZvaWQsIHR1cm5JZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gTGF5b3V0IGZpcnN0IHNvIExpc3RWaWV3IGhhcyBhIHJlYWwgdmlld3BvcnQsIHRoZW4gcmV2ZWFsLiBMZWZ0b3ZlclxuXHRcdC8vIHJldmVhbC10aGVuLWF3YWl0LXJBRiBodW5nIG9uIG1lcmdlIHRyYW5zcGlsZTogRWxlY3Ryb24gbW9jaGEgY2FuXG5cdFx0Ly8gc3RhbGwgcmVxdWVzdEFuaW1hdGlvbkZyYW1lIChubyB2c3luYyAvIGhlaWdodC11cGRhdGUgckFGIHN0b3JtKSxcblx0XHQvLyBzbyBtb2NoYSBoaXQgVGltZW91dCBvZiA1MDAwbXMuIEEgc3RhbGxlZCByQUYgY2FuIGFsc28gd3JpdGUgMXB4XG5cdFx0Ly8gZHluYW1pYyBoZWlnaHRzIChvZmZzZXRIZWlnaHQgMCkgYW5kIHVucGFpbnQgZXZlcnkgdmlydHVhbCByb3cuXG5cdFx0Ly8gUmVzdG9yZSBkZWxlZ2F0ZSBkZWZhdWx0cyBhbmQgeWllbGQgd2l0aCBzZXRUaW1lb3V0IFx1MjAxNCBub3QgckFGLlxuXHRcdC8vIFN0b3AgYWZ0ZXIgYSBmZXcgdHJpZXMgc28gYSBtaXNzaW5nIHJvdyBmYWlscyB0aGUgcHJvZHVjdCBhc3NlcnQuXG5cdFx0Y29uc3QgdHJlZSA9IGdldFRpbWVsaW5lVHJlZShsZW5zKTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTYpKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0dHJlZS5yZXZlYWxUdXJuKHR1cm5JZCwgMCk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGlmIChpc1JldmVhbGVkVHVyblBhaW50ZWQobGVucywgdHVybklkKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXN0b3JlRGVsZWdhdGVSb3dIZWlnaHRzKGxlbnMpO1xuXHRcdGxheW91dFJlYWRpbmdDb2x1bW4oKTtcblx0XHR0cmVlLnJldmVhbFR1cm4odHVybklkLCAwKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0Zm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPCA0OyBhdHRlbXB0KyspIHtcblx0XHRcdGlmIChpc1JldmVhbGVkVHVyblBhaW50ZWQobGVucywgdHVybklkKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMTYpKTtcblx0XHRcdHJlc3RvcmVEZWxlZ2F0ZVJvd0hlaWdodHMobGVucyk7XG5cdFx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0XHR0cmVlLnJldmVhbFR1cm4odHVybklkLCAwKTtcblx0XHRcdGxheW91dFJlYWRpbmdDb2x1bW4oKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiByZXZlYWxVbnRpdGxlZFByb2Nlc3NGb2xkKGxlbnM6IENvbnZlcnNhdGlvbkxlbnMsIGxheW91dFJlYWRpbmdDb2x1bW46ICgpID0+IHZvaWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHJldmVhbExhdGVzdFR1cm4oXG5cdFx0bGVuczogQ29udmVyc2F0aW9uTGVucyxcblx0XHRzdHViU2VydmljZTogQ29udmVyc2F0aW9uU3R1YlNlcnZpY2UsXG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbjogKCkgPT4gdm9pZCxcblx0XHRtYXRjaDogKHR1cm46IHsga2luZDogc3RyaW5nOyB0ZXh0OiBzdHJpbmc7IHN0dWJFY2hvPzogYm9vbGVhbiB9KSA9PiBib29sZWFuLFxuXHQpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IHR1cm4gPSBbLi4uc3R1YlNlcnZpY2UuZ2V0VHVybnMoc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCkpXS5yZXZlcnNlKCkuZmluZChtYXRjaCk7XG5cdFx0YXNzZXJ0Lm9rKHR1cm4pO1xuXHRcdGF3YWl0IHJldmVhbFZpc3VhbGl6ZVR1cm4obGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbiwgdHVybi5pZCk7XG5cdFx0cmV0dXJuIHR1cm4uaWQ7XG5cdH1cblxuXHRmdW5jdGlvbiBzY3JvbGxUaW1lbGluZVRvRW5kV2l0aG91dENsb2JiZXIobGVuczogQ29udmVyc2F0aW9uTGVucyk6IHZvaWQge1xuXHRcdGdldFRpbWVsaW5lVHJlZShsZW5zKS5zY3JvbGxUb0VuZCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcXVlcnlUaW1lbGluZShzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cywgc2VsZWN0b3I6IHN0cmluZyk6IEVsZW1lbnQgfCBudWxsIHtcblx0XHRyZXR1cm4gc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG5cdH1cblxuXHRmdW5jdGlvbiBxdWVyeUFsbFRpbWVsaW5lKHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzLCBzZWxlY3Rvcjogc3RyaW5nKTogTm9kZUxpc3RPZjxFbGVtZW50PiB7XG5cdFx0cmV0dXJuIHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0VGltZWxpbmVUcmVlKGxlbnM6IENvbnZlcnNhdGlvbkxlbnMpOiBDb252ZXJzYXRpb25UaW1lbGluZUhvc3Qge1xuXHRcdHJldHVybiAobGVucyBhcyB1bmtub3duIGFzIHsgdGltZWxpbmVUcmVlOiBDb252ZXJzYXRpb25UaW1lbGluZUhvc3QgfSkudGltZWxpbmVUcmVlO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0VHJhamVjdG9yeVZpZXcobGVuczogQ29udmVyc2F0aW9uTGVucyk6IENvbnZlcnNhdGlvblRyYWplY3Rvcnkge1xuXHRcdHJldHVybiAobGVucyBhcyB1bmtub3duIGFzIHsgdHJhamVjdG9yeVZpZXc6IENvbnZlcnNhdGlvblRyYWplY3RvcnkgfSkudHJhamVjdG9yeVZpZXc7XG5cdH1cblxuXHRmdW5jdGlvbiBjb3VudFRyYWplY3RvcnlSZWNvcmRSb3dzKHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvckFsbCgnLmNvbnZlcnNhdGlvbi1sZW5zLXRyYWplY3RvcnktcmVjb3JkLXJvdycpLmxlbmd0aDtcblx0fVxuXG5cdGZ1bmN0aW9uIGlzUGlubmVkVXNlclByb21wdFBhaW50ZWQoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMsIGV4cGVjdGVkUHJldmlldz86IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGhvc3QgPSBnZXRQaW5uZWRVc2VyUHJvbXB0KHNsb3RzKTtcblx0XHRpZiAoIWhvc3Q/LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLXRpbWVsaW5lLXBpbm5lZC11c2VyLS12aXNpYmxlJykpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgcHJldmlldyA9IGhvc3QucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi10aW1lbGluZS1waW5uZWQtdXNlci10ZXh0Jyk/LnRleHRDb250ZW50ID8/ICcnO1xuXHRcdHJldHVybiBleHBlY3RlZFByZXZpZXcgPT09IHVuZGVmaW5lZCA/IHByZXZpZXcubGVuZ3RoID4gMCA6IHByZXZpZXcgPT09IGV4cGVjdGVkUHJldmlldztcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHBhaW50VHJhamVjdG9yeVJvd3MoXG5cdFx0bGVuczogQ29udmVyc2F0aW9uTGVucyxcblx0XHRzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyxcblx0XHRzdHViU2VydmljZTogQ29udmVyc2F0aW9uU3R1YlNlcnZpY2UsXG5cdFx0bGF5b3V0OiAoKSA9PiB2b2lkLFxuXHRcdGV4cGVjdGVkQ291bnQ6IG51bWJlcixcblx0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdmlldyA9IGdldFRyYWplY3RvcnlWaWV3KGxlbnMpO1xuXHRcdGNvbnN0IHJlY29yZElkcyA9IHN0dWJTZXJ2aWNlLmdldFR1cm5zKHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpKS5tYXAodHVybiA9PiB0dXJuLmlkKTtcblx0XHRhd2FpdCB5aWVsZENvbnZlcnNhdGlvbkxlbnNQYWludCgpO1xuXHRcdGxheW91dCgpO1xuXHRcdGZvciAoY29uc3QgcmVjb3JkSWQgb2YgcmVjb3JkSWRzKSB7XG5cdFx0XHR2aWV3LnJldmVhbFJlY29yZChyZWNvcmRJZCk7XG5cdFx0fVxuXHRcdGxheW91dCgpO1xuXHRcdGlmIChjb3VudFRyYWplY3RvcnlSZWNvcmRSb3dzKHNsb3RzKSA9PT0gZXhwZWN0ZWRDb3VudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRmb3IgKGxldCBhdHRlbXB0ID0gMDsgYXR0ZW1wdCA8IDQ7IGF0dGVtcHQrKykge1xuXHRcdFx0aWYgKGNvdW50VHJhamVjdG9yeVJlY29yZFJvd3Moc2xvdHMpID09PSBleHBlY3RlZENvdW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGF3YWl0IHlpZWxkQ29udmVyc2F0aW9uTGVuc1BhaW50KCk7XG5cdFx0XHRsYXlvdXQoKTtcblx0XHRcdGZvciAoY29uc3QgcmVjb3JkSWQgb2YgcmVjb3JkSWRzKSB7XG5cdFx0XHRcdHZpZXcucmV2ZWFsUmVjb3JkKHJlY29yZElkKTtcblx0XHRcdH1cblx0XHRcdGxheW91dCgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHNjcm9sbFRpbWVsaW5lQXdheUZyb21QaW5uZWRSZWFkKGxlbnM6IENvbnZlcnNhdGlvbkxlbnMsIHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzLCBsYXlvdXQ6ICgpID0+IHZvaWQsIHJvd0hlaWdodCA9IDQwMCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRpbWVsaW5lVHJlZSA9IGdldFRpbWVsaW5lVHJlZShsZW5zKTtcblx0XHRjb25zdCBhc3Npc3RhbnRUdXJuID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cImFzc2lzdGFudFwiXScpO1xuXHRcdGFzc2VydC5vayhhc3Npc3RhbnRUdXJuKTtcblx0XHRjb25zdCB0dXJuSWQgPSBhc3Npc3RhbnRUdXJuIS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdHVybi1pZCcpO1xuXHRcdGFzc2VydC5vayh0dXJuSWQpO1xuXG5cdFx0Ly8gTGF5b3V0IGZpcnN0LCB0aGVuIHJldmVhbCB0aGUgYXNzaXN0YW50IHJvdyBzbyB0aGUgdXNlciBwcm9tcHQgbGVhdmVzXG5cdFx0Ly8gdGhlIHZpcnR1YWwgd2luZG93LiBCb3VuZGVkIHNldFRpbWVvdXQgXHUyMDE0IG5vdCByQUYgXHUyMDE0IHNvIEVsZWN0cm9uIG1vY2hhXG5cdFx0Ly8gd2l0aG91dCB2c3luYyBzdGlsbCBwYWludHMgdGhlIHN0aWNreSBwcmV2aWV3IGluc3RlYWQgb2YgaGFuZ2luZy5cblx0XHRmb3IgKGxldCBhdHRlbXB0ID0gMDsgYXR0ZW1wdCA8IDQ7IGF0dGVtcHQrKykge1xuXHRcdFx0YXdhaXQgeWllbGRDb252ZXJzYXRpb25MZW5zUGFpbnQoKTtcblx0XHRcdGxheW91dCgpO1xuXHRcdFx0YXdhaXQgaW5mbGF0ZVRpbWVsaW5lUm93SGVpZ2h0cyhsZW5zLCBsYXlvdXQsIHJvd0hlaWdodCArIGF0dGVtcHQgKiA0MCk7XG5cdFx0XHR0aW1lbGluZVRyZWUuc2V0U2Nyb2xsTG9jayhmYWxzZSk7XG5cdFx0XHRsYXlvdXQoKTtcblx0XHRcdHRpbWVsaW5lVHJlZS5yZXZlYWxUdXJuKHR1cm5JZCEsIDApO1xuXHRcdFx0bGF5b3V0KCk7XG5cdFx0XHRjb25zdCBhdEJvdHRvbSA9IHRpbWVsaW5lVHJlZS5pc1Njcm9sbGVkVG9Cb3R0b20oKTtcblx0XHRcdGNvbnN0IHBpbm5lZFBhaW50ZWQgPSBpc1Bpbm5lZFVzZXJQcm9tcHRQYWludGVkKHNsb3RzKTtcblx0XHRcdFx0XHRcdGlmICghYXRCb3R0b20gJiYgcGlubmVkUGFpbnRlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFzc2VydC5mYWlsKCdjb3VsZCBub3Qgc2Nyb2xsIHRpbWVsaW5lIGF3YXkgZnJvbSBib3R0b20nKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFBpbm5lZFVzZXJQcm9tcHQoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuXHRcdHJldHVybiBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi10aW1lbGluZS1waW5uZWQtdXNlcicpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFBpbm5lZFVzZXJQcm9tcHRCdWJibGUoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGwge1xuXHRcdHJldHVybiBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi10aW1lbGluZS1waW5uZWQtdXNlci1idWJibGUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdH1cblxuXHRmdW5jdGlvbiBsYXlvdXRSZWFkaW5nQ29sdW1uKGxlbnM6IENvbnZlcnNhdGlvbkxlbnMsIHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzLCBsYXlvdXRXaWR0aCA9IExFTlNfTEFZT1VUX1dJRFRILCBsYXlvdXRIZWlnaHQgPSBMRU5TX0xBWU9VVF9IRUlHSFQpOiB2b2lkIHtcblx0XHRjb25zdCByZWFkaW5nQ29sdW1uID0gc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXJlYWRpbmctY29sdW1uJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGNvbnN0IHRpbWVsaW5lU2Nyb2xsID0gc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXRpbWVsaW5lLXNjcm9sbCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRjb25zdCBjb250ZW50SG9zdCA9IHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10aW1lbGluZS1jb250ZW50JykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGNvbnN0IHRyZWVDb250YWluZXIgPSBzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXRpbWVsaW5lLXRyZWUnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0aWYgKHJlYWRpbmdDb2x1bW4pIHtcblx0XHRcdHJlYWRpbmdDb2x1bW4uc3R5bGUud2lkdGggPSBgJHtsYXlvdXRXaWR0aH1weGA7XG5cdFx0XHRyZWFkaW5nQ29sdW1uLnN0eWxlLmhlaWdodCA9IGAke2xheW91dEhlaWdodH1weGA7XG5cdFx0fVxuXHRcdGlmICh0aW1lbGluZVNjcm9sbCkge1xuXHRcdFx0dGltZWxpbmVTY3JvbGwuc3R5bGUuaGVpZ2h0ID0gYCR7bGF5b3V0SGVpZ2h0IC0gMTIwfXB4YDtcblx0XHRcdHRpbWVsaW5lU2Nyb2xsLnN0eWxlLm1pbkhlaWdodCA9IGAke2xheW91dEhlaWdodCAtIDEyMH1weGA7XG5cdFx0fVxuXHRcdGlmIChjb250ZW50SG9zdCkge1xuXHRcdFx0Y29udGVudEhvc3Quc3R5bGUuZGlzcGxheSA9ICcnO1xuXHRcdFx0Y29udGVudEhvc3Quc3R5bGUubWluSGVpZ2h0ID0gYCR7bGF5b3V0SGVpZ2h0IC0gMTIwfXB4YDtcblx0XHR9XG5cdFx0aWYgKHRyZWVDb250YWluZXIpIHtcblx0XHRcdHRyZWVDb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gYCR7bGF5b3V0SGVpZ2h0IC0gMTIwfXB4YDtcblx0XHR9XG5cdFx0Y29uc3QgdHJhamVjdG9yeUhvc3QgPSBzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHJhamVjdG9yeScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRjb25zdCB0cmFqZWN0b3J5U2Nyb2xsID0gc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXRyYWplY3RvcnktdGFibGUtc2Nyb2xsJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGlmICh0cmFqZWN0b3J5SG9zdCkge1xuXHRcdFx0dHJhamVjdG9yeUhvc3Quc3R5bGUuaGVpZ2h0ID0gYCR7TEVOU19MQVlPVVRfSEVJR0hUIC0gMTIwfXB4YDtcblx0XHRcdHRyYWplY3RvcnlIb3N0LnN0eWxlLm1pbkhlaWdodCA9IGAke0xFTlNfTEFZT1VUX0hFSUdIVCAtIDEyMH1weGA7XG5cdFx0fVxuXHRcdGlmICh0cmFqZWN0b3J5U2Nyb2xsKSB7XG5cdFx0XHR0cmFqZWN0b3J5U2Nyb2xsLnN0eWxlLmhlaWdodCA9IGAke0xFTlNfTEFZT1VUX0hFSUdIVCAtIDIwMH1weGA7XG5cdFx0XHR0cmFqZWN0b3J5U2Nyb2xsLnN0eWxlLm1pbkhlaWdodCA9IGAke0xFTlNfTEFZT1VUX0hFSUdIVCAtIDIwMH1weGA7XG5cdFx0fVxuXHRcdC8vIFBhcnQgc2Vzc2lvbkJhciBtZWFzdXJlcyBjbGllbnRXaWR0aCBiZWZvcmUgYXBwbHlpbmcgaXMtbmFycm93IC8gaXMtY29tcGFjdC5cblx0XHRpZiAoc2xvdHMuc2Vzc2lvbkJhcikge1xuXHRcdFx0c2xvdHMuc2Vzc2lvbkJhci5zdHlsZS53aWR0aCA9IGAke2xheW91dFdpZHRofXB4YDtcblx0XHRcdHNsb3RzLnNlc3Npb25CYXIuc3R5bGUubWluV2lkdGggPSBgJHtsYXlvdXRXaWR0aH1weGA7XG5cdFx0fVxuXHRcdGNvbnN0IHRpbWVsaW5lSGVpZ2h0ID0gbGF5b3V0SGVpZ2h0IC0gMTIwO1xuXHRcdGxlbnMubGF5b3V0KHRpbWVsaW5lSGVpZ2h0LCBsYXlvdXRXaWR0aCk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRQcmVmaXJzdEhlcm8oc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MRWxlbWVudCB8IG51bGwge1xuXHRcdHJldHVybiBnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5xdWVyeVNlbGVjdG9yKGAuJHtjb252ZXJzYXRpb25MZW5zUHJlZmlyc3RIZXJvQ2xhc3N9YCkgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHR9XG5cblx0ZnVuY3Rpb24gY291bnRDb21wb3NlcnMoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBudW1iZXIge1xuXHRcdHJldHVybiBzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtY29tcG9zZXInKS5sZW5ndGhcblx0XHRcdCsgc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtY29tcG9zZXInKS5sZW5ndGg7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRJbmJveE92ZXJsYXkoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3Qgb3ZlcmxheSA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LW92ZXJsYXknKTtcblx0XHRhc3NlcnQub2sob3ZlcmxheSk7XG5cdFx0cmV0dXJuIG92ZXJsYXkgYXMgSFRNTEVsZW1lbnQ7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRJbmJveFF1ZXVlQ2hpcChzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyk6IEhUTUxCdXR0b25FbGVtZW50IHtcblx0XHRjb25zdCBjaGlwID0gZ2V0SW5ib3hPdmVybGF5KHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtcXVldWUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKGNoaXApO1xuXHRcdHJldHVybiBjaGlwO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0VmlzaWJsZUluYm94TGlzdFBhbmVsKCk6IEhUTUxFbGVtZW50IHwgbnVsbCB7XG5cdFx0Zm9yIChjb25zdCBwYW5lbCBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxFbGVtZW50PignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LWxpc3QtcGFuZWwnKSkge1xuXHRcdFx0Y29uc3QgaG9zdCA9IHBhbmVsLmNsb3Nlc3QoJy5jb250ZXh0LXZpZXcnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0XHRpZiAoIWhvc3QgfHwgaG9zdC5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZScpIHtcblx0XHRcdFx0cmV0dXJuIHBhbmVsO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldEluYm94R29hbEJ1dHRvbihzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBidXR0b24gPSBzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1nb2FsIC5jb252ZXJzYXRpb24tbGVucy1pbmJveC1nb2FsLWJ1dHRvbicpO1xuXHRcdGFzc2VydC5vayhidXR0b24pO1xuXHRcdHJldHVybiBidXR0b24gYXMgSFRNTEVsZW1lbnQ7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRJbmJveFN0b3BCdXR0b24oc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgYnV0dG9uID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtc3RvcCAuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtc3RvcC1idXR0b24nKTtcblx0XHRhc3NlcnQub2soYnV0dG9uKTtcblx0XHRyZXR1cm4gYnV0dG9uIGFzIEhUTUxFbGVtZW50O1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgYm90dG9tQmFyID0gKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stYm90dG9tLWJhcicpXG5cdFx0XHQ/PyBnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1ib3R0b20tYmFyJykpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soYm90dG9tQmFyKTtcblx0XHRyZXR1cm4gYm90dG9tQmFyO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0UGVybWlzc2lvblNlbGVjdChzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyk6IEhUTUxTZWxlY3RFbGVtZW50IHtcblx0XHRjb25zdCBzZWxlY3QgPSBnZXRDb21wb3NlckJvdHRvbUJhcihzbG90cykucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stcGVybWlzc2lvbiBzZWxlY3QubW9uYWNvLXNlbGVjdC1ib3gnKSBhcyBIVE1MU2VsZWN0RWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHNlbGVjdCk7XG5cdFx0cmV0dXJuIHNlbGVjdDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldE1vZGVsU2VsZWN0KHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzKTogSFRNTFNlbGVjdEVsZW1lbnQge1xuXHRcdGNvbnN0IHNlbGVjdCA9IGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb2RlbCBzZWxlY3QubW9uYWNvLXNlbGVjdC1ib3gnKSBhcyBIVE1MU2VsZWN0RWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHNlbGVjdCk7XG5cdFx0cmV0dXJuIHNlbGVjdDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldEFnZW50U2VsZWN0KHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzKTogSFRNTFNlbGVjdEVsZW1lbnQge1xuXHRcdGNvbnN0IHNlbGVjdCA9IGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1hZ2VudCBzZWxlY3QubW9uYWNvLXNlbGVjdC1ib3gnKSBhcyBIVE1MU2VsZWN0RWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHNlbGVjdCk7XG5cdFx0cmV0dXJuIHNlbGVjdDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldEFnZW50UmVhZG9ubHlMYWJlbChzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBsYWJlbCA9IGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1hZ2VudCAuY29udmVyc2F0aW9uLWxlbnMtZG9jay1hZ2VudC1yZWFkb25seScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2sobGFiZWwpO1xuXHRcdHJldHVybiBsYWJlbDtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydERpc2Nvbm5lY3RlZENvbXBvc2VyQ2F0YWxvZ3NIb25lc3Qoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiB2b2lkIHtcblx0XHRjb25zdCBhZ2VudENvbnRhaW5lciA9IGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1hZ2VudCcpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IG1vZGVsU2VsZWN0ID0gZ2V0TW9kZWxTZWxlY3Qoc2xvdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZ2VudENvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdzZWxlY3QnKSwgbnVsbCk7XG5cdFx0Y29uc3QgYWdlbnRMYWJlbCA9IGdldEFnZW50UmVhZG9ubHlMYWJlbChzbG90cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50TGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrQWdlbnRVbmF2YWlsYWJsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50TGFiZWwuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNEb2NrQWdlbnRVbmF2YWlsYWJsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0Lm9wdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Qub3B0aW9uc1swXT8udGV4dCwgY29udmVyc2F0aW9uTGVuc0RvY2tOb01vZGVsKTtcblx0XHRhc3NlcnQub2soIVsuLi5tb2RlbFNlbGVjdC5vcHRpb25zXS5zb21lKG9wdGlvbiA9PiBvcHRpb24udGV4dCA9PT0gJ1N0dWIgbW9kZWwnKSk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiB3YWl0Rm9yTW9kZWxPcHRpb24oc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMsIHRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgMTY7IGkrKykge1xuXHRcdFx0aWYgKFsuLi5nZXRNb2RlbFNlbGVjdChzbG90cykub3B0aW9uc10uc29tZShvcHRpb24gPT4gb3B0aW9uLnRleHQgPT09IHRleHQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblx0XHRhc3NlcnQuZmFpbChgbW9kZWwgb3B0aW9uIFwiJHt0ZXh0fVwiIGRpZCBub3QgbG9hZGApO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0RG9ja1NlbmRCdXR0b24oc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG5cdFx0Y29uc3QgYnV0dG9uID0gKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stc2VuZCAubW9uYWNvLWJ1dHRvbicpXG5cdFx0XHQ/PyBnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1zZW5kIC5tb25hY28tYnV0dG9uJykpIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soYnV0dG9uKTtcblx0XHRyZXR1cm4gYnV0dG9uO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2VsZWN0RG9ja01vZGVsKHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzLCBvcHRpb25JbmRleDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgYm90dG9tQmFyID0gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpO1xuXHRcdGNvbnN0IG1vZGVsU2VsZWN0ID0gYm90dG9tQmFyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vZGVsIHNlbGVjdC5tb25hY28tc2VsZWN0LWJveCcpIGFzIEhUTUxTZWxlY3RFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2sobW9kZWxTZWxlY3QpO1xuXHRcdG1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXggPSBvcHRpb25JbmRleDtcblx0XHRtb2RlbFNlbGVjdC5kaXNwYXRjaEV2ZW50KG5ldyBnbG9iYWxUaGlzLkV2ZW50KCdjaGFuZ2UnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0RG9ja1RleHRhcmVhKHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzKTogSFRNTFRleHRBcmVhRWxlbWVudCB7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSAoc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCd0ZXh0YXJlYS5jb252ZXJzYXRpb24tbGVucy1kb2NrLWlucHV0Jylcblx0XHRcdD8/IGdldFJlYWRpbmdDb2x1bW4oc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJ3RleHRhcmVhLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2staW5wdXQnKSkgYXMgSFRNTFRleHRBcmVhRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHRleHRhcmVhKTtcblx0XHRyZXR1cm4gdGV4dGFyZWE7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBzZW5kRG9ja0RyYWZ0KHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzLCBtZXNzYWdlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0ZXh0YXJlYSA9IGdldERvY2tUZXh0YXJlYShzbG90cyk7XG5cdFx0Y29uc3Qgc2VuZEJ1dHRvbiA9IGdldERvY2tTZW5kQnV0dG9uKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9IG1lc3NhZ2U7XG5cdFx0dGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdHNlbmRCdXR0b24uY2xpY2soKTtcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHQvLyBTdHViIGVjaG8gaXMgc2NoZWR1bGVkIHdpdGggc2V0VGltZW91dCgwKTsgd2FpdCBzbyBnZXRUdXJucygpIGluY2x1ZGVzIGR1cmFibGUgcm93cy5cblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMCkpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gc2VuZERvY2tEcmFmdEFuZEZsdXNoKHNsb3RzOiBJQ29udmVyc2F0aW9uTGVuc1Nsb3RzLCBtZXNzYWdlOiBzdHJpbmcsIGxheW91dFJlYWRpbmdDb2x1bW4/OiAoKSA9PiB2b2lkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgbWVzc2FnZSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDApKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uPy4oKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZGlzcGF0Y2hEb2NrS2V5ZG93bih0ZXh0YXJlYTogSFRNTFRleHRBcmVhRWxlbWVudCwga2V5Q29kZTogS2V5Q29kZSk6IHZvaWQge1xuXHRcdGNvbnN0IGRvbUtleUNvZGVCeVZzQ29kZTogUGFydGlhbDxSZWNvcmQ8S2V5Q29kZSwgbnVtYmVyPj4gPSB7XG5cdFx0XHRbS2V5Q29kZS5FbnRlcl06IDEzLFxuXHRcdFx0W0tleUNvZGUuRXNjYXBlXTogMjcsXG5cdFx0XHRbS2V5Q29kZS5VcEFycm93XTogMzgsXG5cdFx0XHRbS2V5Q29kZS5Eb3duQXJyb3ddOiA0MCxcblx0XHRcdFtLZXlDb2RlLlNwYWNlXTogMzIsXG5cdFx0fTtcblx0XHRjb25zdCBkb21LZXlDb2RlID0gZG9tS2V5Q29kZUJ5VnNDb2RlW2tleUNvZGVdO1xuXHRcdGFzc2VydC5vayhkb21LZXlDb2RlICE9PSB1bmRlZmluZWQsIGBtaXNzaW5nIERPTSBrZXlDb2RlIG1hcHBpbmcgZm9yICR7a2V5Q29kZX1gKTtcblx0XHR0ZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBLZXlib2FyZEV2ZW50KCdrZXlkb3duJywgeyBrZXlDb2RlOiBkb21LZXlDb2RlLCBidWJibGVzOiB0cnVlLCBjYW5jZWxhYmxlOiB0cnVlIH0pKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFNlc3Npb25TZWxlY3RMYWJlbChzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgc2VsZWN0ID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tc2VsZWN0IHNlbGVjdC5tb25hY28tc2VsZWN0LWJveCcpIGFzIEhUTUxTZWxlY3RFbGVtZW50IHwgbnVsbDtcblx0XHRpZiAoIXNlbGVjdCB8fCBzZWxlY3Qub3B0aW9ucy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBzZWxlY3Qub3B0aW9uc1tzZWxlY3Quc2VsZWN0ZWRJbmRleF0/LnRleHQ7XG5cdH1cblxuXHRmdW5jdGlvbiBtb3VudExlbnMob3B0aW9ucz86IHsgc3RvcmFnZVNlcnZpY2U/OiBUZXN0U3RvcmFnZVNlcnZpY2U7IGNvbmZpZ3VyYXRpb25TZXJ2aWNlPzogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlOyBsYXlvdXRXaWR0aD86IG51bWJlcjsgbGF5b3V0SGVpZ2h0PzogbnVtYmVyOyBjb25uZWN0aW9uPzogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uOyBzdHViU2VydmljZT86IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlOyBzZXNzaW9uS2V5Pzogc3RyaW5nOyB0YWJsaXN0T25seT86IGJvb2xlYW47IHBpbkNvbnZlcnNhdGlvbkxlbnM/OiBib29sZWFuOyBmaWx0ZXJBZ2VudElkPzogc3RyaW5nIH0pOiB7IHBhcnQ6IENvbnZlcnNhdGlvblBhcnQ7IGxlbnM6IENvbnZlcnNhdGlvbkxlbnM7IHN0dWJTZXJ2aWNlOiBDb252ZXJzYXRpb25TdHViU2VydmljZTsgY2xpcGJvYXJkU2VydmljZTogVGVzdENsaXBib2FyZFNlcnZpY2U7IHN0b3JhZ2VTZXJ2aWNlOiBUZXN0U3RvcmFnZVNlcnZpY2U7IGxheW91dFJlYWRpbmdDb2x1bW46ICgpID0+IHZvaWQ7IG9wZW5JbkVkaXRvckNhbGxzOiB7IGNvdW50OiBudW1iZXIgfTsgbGF5b3V0Q29udGFpbmVyOiBIVE1MRWxlbWVudCB9IHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgc3RvcmUpO1xuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gb3B0aW9ucz8uc3RvcmFnZVNlcnZpY2UgPz8gc3RvcmUuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU3RvcmFnZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRpZiAob3B0aW9ucz8uY29uZmlndXJhdGlvblNlcnZpY2UpIHtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBvcHRpb25zLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHR9XG5cdFx0Y29uc3Qgc3R1YlNlcnZpY2UgPSBvcHRpb25zPy5zdHViU2VydmljZSA/PyBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBuZXcgVGVzdENsaXBib2FyZFNlcnZpY2UoKTtcblx0XHRjb25zdCBvcGVuSW5FZGl0b3JDYWxscyA9IHsgY291bnQ6IDAgfTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb252ZXJzYXRpb25Sb3N0ZXJTZXJ2aWNlLCBzdHViU2VydmljZSk7XG5cdFx0c3R1YkNvbnZlcnNhdGlvblRpbWVsaW5lTGlua1NlcnZpY2VzKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVbml2ZXJzZUFnZW50Q29ubmVjdGlvbiwgb3B0aW9ucz8uY29ubmVjdGlvbiA/PyBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uV29ya1Jvb3RNb3VudCwgc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25Xb3JrUm9vdE1vdW50TW9kZWwoKSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnZlcnNhdGlvblRpbWVsaW5lUmV2ZWFsU2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0cmVnaXN0ZXJMZW5zOiAoKSA9PiAoeyBkaXNwb3NlOiAoKSA9PiB7IH0gfSksXG5cdFx0XHRyZXZlYWxJdGVtOiAoKSA9PiB7IH0sXG5cdFx0XHRnZXRBY2Nlc3NpYmxlVHVybkNvbnRlbnQ6ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdGZvY3VzQWNjZXNzaWJsZVR1cm46ICgpID0+IHsgfSxcblx0XHRcdHNjcm9sbFRvRmlyc3RQZW5kaW5nQ29uZmlybWF0aW9uOiAoKSA9PiB7IH0sXG5cdFx0fSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udmVyc2F0aW9uUmV2aWV3TmF2U2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRnZXRSZXZpZXdOYXZGb3JTZXNzaW9uOiAoKSA9PiBbXSxcblx0XHR9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDbGlwYm9hcmRTZXJ2aWNlLCBjbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb21tYW5kU2VydmljZSwgbmV3IGNsYXNzIGltcGxlbWVudHMgSUNvbW1hbmRTZXJ2aWNlIHtcblx0XHRcdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRcdFx0b25XaWxsRXhlY3V0ZUNvbW1hbmQgPSBFdmVudC5Ob25lO1xuXHRcdFx0b25EaWRFeGVjdXRlQ29tbWFuZCA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRleGVjdXRlQ29tbWFuZChpZDogc3RyaW5nKSB7XG5cdFx0XHRcdGlmIChpZCA9PT0gJ19tZXJtYWlkLW1hcmtkb3duLm9wZW5JbkVkaXRvcicpIHtcblx0XHRcdFx0XHRvcGVuSW5FZGl0b3JDYWxscy5jb3VudCsrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9KCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvblNlcnZpY2UsIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldEV4dGVuc2lvbjogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCksXG5cdFx0fSBhcyB1bmtub3duIGFzIElFeHRlbnNpb25TZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXZWJ2aWV3U2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0YWN0aXZlV2VidmlldzogdW5kZWZpbmVkLFxuXHRcdFx0d2Vidmlld3M6IFtdLFxuXHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVXZWJ2aWV3OiBFdmVudC5Ob25lLFxuXHRcdFx0Y3JlYXRlV2Vidmlld092ZXJsYXk6ICgpID0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgdXNlZCcpOyB9LFxuXHRcdFx0Y3JlYXRlV2Vidmlld0VsZW1lbnQ6ICgpID0+ICh7XG5cdFx0XHRcdG1vdW50VG8ocGFyZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdFx0XHRcdGNvbnN0IGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0XHRcdFx0ZWwuc2V0QXR0cmlidXRlKCdkYXRhLW1lcm1haWQtaG9zdCcsICdzdHViJyk7XG5cdFx0XHRcdFx0cGFyZW50LmFwcGVuZENoaWxkKGVsKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0SHRtbCgpIHsgfSxcblx0XHRcdFx0cG9zdE1lc3NhZ2U6ICgpID0+IFByb21pc2UucmVzb2x2ZSh0cnVlKSxcblx0XHRcdFx0b25EaWRXaGVlbDogRXZlbnQuTm9uZSxcblx0XHRcdFx0b25GYXRhbEVycm9yOiBFdmVudC5Ob25lLFxuXHRcdFx0XHRpbnRyaW5zaWNDb250ZW50U2l6ZTogb2JzZXJ2YWJsZVZhbHVlKCdpbnRyaW5zaWNDb250ZW50U2l6ZScsIHVuZGVmaW5lZCksXG5cdFx0XHRcdGRpc3Bvc2UoKSB7IH0sXG5cdFx0XHR9KSxcblx0XHR9IGFzIHVua25vd24gYXMgSVdlYnZpZXdTZXJ2aWNlKTtcblx0XHQvLyBQcm9kdWN0IHNlbGVjdG9ycyBhcmUgYC5tb25hY28td29ya2JlbmNoIC5wYXJ0LmNvbnZlcnNhdGlvbiBcdTIwMjZgIChkZXNjZW5kYW50KS5cblx0XHQvLyBPdmVybGF5IGhvc3QgaXMgYHRpbWVsaW5lLmNsb3Nlc3QoJy5wYXJ0LmNvbnZlcnNhdGlvbicpYC4gU2FtZSBhbmNlc3RvclxuXHRcdC8vIGNoYWluIGFzIGNvbnZlcnNhdGlvbklkZW50aXR5U3RyaXAudGVzdC50cyBcdTIwMTQgZG8gbm90IHN0YWNrIGJvdGggY2xhc3Nlc1xuXHRcdC8vIG9uIG9uZSBub2RlLCBhbmQgZG8gbm90IHBhcmsgbGF5b3V0U2VydmljZS5nZXRDb250YWluZXIgb24gYSBzaWJsaW5nLlxuXHRcdGNvbnN0IGxheW91dENvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGxheW91dENvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdtb25hY28td29ya2JlbmNoJyk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0cGFyZW50LmNsYXNzTGlzdC5hZGQoJ3BhcnQnLCAnY29udmVyc2F0aW9uJyk7XG5cdFx0Y29uc3QgbGF5b3V0V2lkdGggPSBvcHRpb25zPy5sYXlvdXRXaWR0aCA/PyBMRU5TX0xBWU9VVF9XSURUSDtcblx0XHRjb25zdCBsYXlvdXRIZWlnaHQgPSBvcHRpb25zPy5sYXlvdXRIZWlnaHQgPz8gTEVOU19MQVlPVVRfSEVJR0hUO1xuXHRcdHBhcmVudC5zdHlsZS53aWR0aCA9IGAke2xheW91dFdpZHRofXB4YDtcblx0XHRwYXJlbnQuc3R5bGUuaGVpZ2h0ID0gYCR7bGF5b3V0SGVpZ2h0fXB4YDtcblx0XHRsYXlvdXRDb250YWluZXIuYXBwZW5kQ2hpbGQocGFyZW50KTtcblx0XHRkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGxheW91dENvbnRhaW5lcik7XG5cdFx0c3RvcmUuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBsYXlvdXRDb250YWluZXIucmVtb3ZlKCkpKTtcblx0XHQvLyBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBzaGFyZXMgdGhpcyBkZWNvcmF0b3I6IFBhcnQgcmVnaXN0ZXJzIGl0c2VsZiBhbmQgQ29udmVyc2F0aW9uUGFydC5sYXlvdXRcblx0XHQvLyBhc2tzIGlzVmlzaWJsZSgpLCBzbyBhIGJhcmUgeyBnZXRDb250YWluZXIgfSBzdHViIGlzIG5vdCBlbm91Z2guXG5cdFx0Y29uc3QgbGF5b3V0U2VydmljZSA9IG5ldyBUZXN0TGF5b3V0U2VydmljZSgpO1xuXHRcdGxheW91dFNlcnZpY2UuZ2V0Q29udGFpbmVyID0gKCkgPT4gbGF5b3V0Q29udGFpbmVyO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxheW91dFNlcnZpY2UsIGxheW91dFNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4cGxvcmVyU2VydmljZSwge1xuXHRcdFx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLFxuXHRcdFx0c2VsZWN0OiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0fSBhcyB1bmtub3duIGFzIElFeHBsb3JlclNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNDTVNlcnZpY2UsIHtcblx0XHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCxcblx0XHRcdGdldCByZXBvc2l0b3JpZXMoKSB7IHJldHVybiBbXTsgfSxcblx0XHRcdGdldCByZXBvc2l0b3J5Q291bnQoKSB7IHJldHVybiAwOyB9LFxuXHRcdFx0b25EaWRBZGRSZXBvc2l0b3J5OiBFdmVudC5Ob25lLFxuXHRcdFx0b25EaWRSZW1vdmVSZXBvc2l0b3J5OiBFdmVudC5Ob25lLFxuXHRcdFx0cmVnaXN0ZXJTQ01Qcm92aWRlcjogKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9LFxuXHRcdFx0Z2V0UmVwb3NpdG9yeTogKCkgPT4gdW5kZWZpbmVkLFxuXHRcdH0gYXMgdW5rbm93biBhcyBJU0NNU2VydmljZSk7XG5cdFx0Y29uc3QgcGFydCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25QYXJ0KSk7XG5cdFx0cGFydC5jcmVhdGUocGFyZW50KTtcblx0XHRjb25zdCBwYXJ0U2xvdHMgPSBwYXJ0LmdldFNsb3RzKCk7XG5cdFx0YXNzZXJ0Lm9rKHBhcnRTbG90cyk7XG5cdFx0Y29uc3QgbGVuc1RhYmxpc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb25zdCBzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyA9IHtcblx0XHRcdHNlc3Npb25CYXI6IG9wdGlvbnM/LnRhYmxpc3RPbmx5ID8gdW5kZWZpbmVkIDogcGFydFNsb3RzLnNlc3Npb25CYXIsXG5cdFx0XHRsZW5zVGFibGlzdDogb3B0aW9ucz8udGFibGlzdE9ubHkgPyBsZW5zVGFibGlzdCA6IHVuZGVmaW5lZCxcblx0XHRcdHRpbWVsaW5lOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSxcblx0XHRcdGRvY2s6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpLFxuXHRcdFx0c2Vzc2lvbktleTogb3B0aW9ucz8uc2Vzc2lvbktleSxcblx0XHRcdHBpbkNvbnZlcnNhdGlvbkxlbnM6IG9wdGlvbnM/LnBpbkNvbnZlcnNhdGlvbkxlbnMsXG5cdFx0XHRmaWx0ZXJBZ2VudElkOiBvcHRpb25zPy5maWx0ZXJBZ2VudElkLFxuXHRcdH07XG5cdFx0c2xvdHMudGltZWxpbmUuY2xhc3NMaXN0LmFkZCgnY29udmVyc2F0aW9uLXRpbWVsaW5lJywgJ3BhcnQnLCAnY29udmVyc2F0aW9uJyk7XG5cdFx0c2xvdHMuZG9jay5jbGFzc0xpc3QuYWRkKCdjb252ZXJzYXRpb24tZG9jaycpO1xuXHRcdGlmIChzbG90cy5sZW5zVGFibGlzdCkge1xuXHRcdFx0cGFyZW50LmFwcGVuZENoaWxkKHNsb3RzLmxlbnNUYWJsaXN0KTtcblx0XHR9XG5cdFx0cGFyZW50LmFwcGVuZENoaWxkKHNsb3RzLnRpbWVsaW5lKTtcblx0XHRwYXJlbnQuYXBwZW5kQ2hpbGQoc2xvdHMuZG9jayk7XG5cdFx0cGFydC5sYXlvdXQobGF5b3V0V2lkdGgsIGxheW91dEhlaWdodCwgMCwgMCk7XG5cdFx0Y29uc3QgbGF5b3V0Q2FsbGJhY2tzOiBBcnJheTwoKSA9PiB2b2lkPiA9IFtdO1xuXHRcdGNvbnN0IHJ1bkxheW91dHMgPSAoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGxheW91dCBvZiBsYXlvdXRDYWxsYmFja3MpIHtcblx0XHRcdFx0bGF5b3V0KCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRzdG9yZS5hZGQoc3R1YlNlcnZpY2Uub25EaWRDaGFuZ2VTZXNzaW9uKCgpID0+IHJ1bkxheW91dHMoKSkpO1xuXHRcdHN0b3JlLmFkZChzdHViU2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZVNlc3Npb24oKCkgPT4gcnVuTGF5b3V0cygpKSk7XG5cdFx0Y29uc3QgbGVucyA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25MZW5zLCBzbG90cykpO1xuXHRcdGxlbnNTbG90c0J5UGFydC5zZXQocGFydCwgc2xvdHMpO1xuXHRcdGNvbnN0IGxheW91dCA9ICgpID0+IGxheW91dFJlYWRpbmdDb2x1bW4obGVucywgc2xvdHMsIGxheW91dFdpZHRoLCBsYXlvdXRIZWlnaHQpO1xuXHRcdGxheW91dENhbGxiYWNrcy5wdXNoKGxheW91dCk7XG5cdFx0bGF5b3V0KCk7XG5cdFx0Y29uc3QgY29udGVudEhvc3QgPSBzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdGltZWxpbmUtY29udGVudCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRpZiAoY29udGVudEhvc3QpIHtcblx0XHRcdGNvbnRlbnRIb3N0LnN0eWxlLmRpc3BsYXkgPSAnJztcblx0XHR9XG5cdFx0bGF5b3V0KCk7XG5cdFx0cmV0dXJuIHsgcGFydCwgbGVucywgc3R1YlNlcnZpY2UsIGNsaXBib2FyZFNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uOiBsYXlvdXQsIG9wZW5JbkVkaXRvckNhbGxzLCBsYXlvdXRDb250YWluZXIgfTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHNlZWRQZW5kaW5nQ29uZmlybWF0aW9uKHN0dWJTZXJ2aWNlOiBDb252ZXJzYXRpb25TdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbjogKCkgPT4gdm9pZCwgbWVzc2FnZSA9ICdXcml0ZSBSRUFETUUubWQ/Jyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25JZCwgJ0hlbHAgbWUgc2NhZmZvbGQgdGhlIHByb2plY3QgUkVBRE1FLicpO1xuXHRcdGxheW91dFJlYWRpbmdDb2x1bW4oKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZENvbmZpcm1hdGlvblR1cm4oc2Vzc2lvbklkLCBtZXNzYWdlKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRyZXR1cm4gc2Vzc2lvbklkO1xuXHR9XG5cblx0ZnVuY3Rpb24gdXNlck1lc3NhZ2VMaW5lcyhsaW5lQ291bnQ6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20oeyBsZW5ndGg6IGxpbmVDb3VudCB9LCAoXywgaW5kZXgpID0+IGBVc2VyIGxpbmUgJHtpbmRleCArIDF9YCkuam9pbignXFxuJyk7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRVc2VyVHVybkJvZHkoc2xvdHM6IElDb252ZXJzYXRpb25MZW5zU2xvdHMpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgYm9keSA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJ1c2VyXCJdIC5jb252ZXJzYXRpb24tbGVucy10dXJuLWJvZHknKTtcblx0XHRhc3NlcnQub2soYm9keSk7XG5cdFx0cmV0dXJuIGJvZHkgYXMgSFRNTEVsZW1lbnQ7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRVc2VyRm9sZEJ1dHRvbihzbG90czogSUNvbnZlcnNhdGlvbkxlbnNTbG90cyk6IEhUTUxCdXR0b25FbGVtZW50IHwgbnVsbCB7XG5cdFx0cmV0dXJuIHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJ1c2VyXCJdIC5jb252ZXJzYXRpb24tbGVucy10dXJuLWZvbGQtYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQgfCBudWxsO1xuXHR9XG5cblx0dGVzdCgnc2hvcnQgdXNlciB0dXJuIGRvZXMgbm90IHNob3cgU2hvdyBtb3JlIGNvbnRyb2wnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25JZCwgdXNlck1lc3NhZ2VMaW5lcygyKSk7XG5cdFx0YXdhaXQgZmx1c2hQcm9qZWN0ZWRUaW1lbGluZShsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRVc2VyRm9sZEJ1dHRvbihzbG90cyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRVc2VyVHVybkJvZHkoc2xvdHMpLmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5LS1jb2xsYXBzZWQnKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdsb25nIHVzZXIgdHVybiBjb2xsYXBzZXMgd2l0aCBTaG93IG1vcmUgYW5kIGZ1bGwtdGV4dCB0aXRsZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IHVzZXJNZXNzYWdlTGluZXMoOCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbklkLCBtZXNzYWdlKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0Y29uc3QgYm9keSA9IGdldFVzZXJUdXJuQm9keShzbG90cyk7XG5cdFx0Y29uc3QgZm9sZEJ1dHRvbiA9IGdldFVzZXJGb2xkQnV0dG9uKHNsb3RzKTtcblxuXHRcdGFzc2VydC5vayhib2R5LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5LS1jb2xsYXBzZWQnKSk7XG5cdFx0YXNzZXJ0Lm9rKGZvbGRCdXR0b24pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkQnV0dG9uIS50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc1VzZXJCdWJibGVTaG93TW9yZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvZHkuZ2V0QXR0cmlidXRlKCd0aXRsZScpLCBtZXNzYWdlKTtcblxuXHRcdGNvbnN0IHVzZXJUdXJuID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0nKSE7XG5cdFx0Y29uc3QgZm9sZCA9IHVzZXJUdXJuLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWZvbGQnKTtcblx0XHRhc3NlcnQub2soZm9sZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVzZXJUdXJuLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWFjdGlvbnMnKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Nob3cgbW9yZSBleHBhbmRzIHVzZXIgYnViYmxlIGFuZCBTaG93IGxlc3MgY29sbGFwc2VzIGl0IGFnYWluJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRzdHViU2VydmljZS5hcHBlbmRVc2VyVHVybihzZXNzaW9uSWQsIHVzZXJNZXNzYWdlTGluZXMoOCkpO1xuXHRcdGF3YWl0IGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cblx0XHRjb25zdCBib2R5ID0gZ2V0VXNlclR1cm5Cb2R5KHNsb3RzKTtcblx0XHRjb25zdCBmb2xkQnV0dG9uID0gZ2V0VXNlckZvbGRCdXR0b24oc2xvdHMpITtcblxuXHRcdGZvbGRCdXR0b24uY2xpY2soKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb252ZXJzYXRpb24tbGVucy10dXJuLWJvZHktLWNvbGxhcHNlZCcpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRCdXR0b24udGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNVc2VyQnViYmxlU2hvd0xlc3MpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkQnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChib2R5LmdldEF0dHJpYnV0ZSgndGl0bGUnKSwgbnVsbCk7XG5cblx0XHRmb2xkQnV0dG9uLmNsaWNrKCk7XG5cdFx0YXdhaXQgZmx1c2hQcm9qZWN0ZWRUaW1lbGluZShsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblxuXHRcdGFzc2VydC5vayhib2R5LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5LS1jb2xsYXBzZWQnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGRCdXR0b24udGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNVc2VyQnViYmxlU2hvd01vcmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkQnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYm9keS5nZXRBdHRyaWJ1dGUoJ3RpdGxlJyksIHVzZXJNZXNzYWdlTGluZXMoOCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdsb25nIGFzc2lzdGFudCBzdHViIGVjaG8gZG9lcyBub3QgZ2V0IHVzZXIgYnViYmxlIGNvbGxhcHNlIGNocm9tZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kU3R1YkVjaG9Bc3Npc3RhbnQoc2Vzc2lvbklkLCB1c2VyTWVzc2FnZUxpbmVzKDgpKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0Y29uc3QgYXNzaXN0YW50VHVybiA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJhc3Npc3RhbnRcIl0nKTtcblx0XHRhc3NlcnQub2soYXNzaXN0YW50VHVybik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFzc2lzdGFudFR1cm4ucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tZm9sZCcpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXNzaXN0YW50VHVybi5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5LS1jb2xsYXBzZWQnKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlZmF1bHQgc2Vzc2lvbiBzaG93cyBzZWVkZWQgdW50aXRsZWQgZml4dHVyZSB3aXRob3V0IGZha2UgZW5naW5lIGhpc3RvcnknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgcGVuZGluZ0J1dHRvbiA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LXBlbmRpbmcnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRTZXNzaW9ucygpLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldFR1cm5zKHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpKS5sZW5ndGgsIDcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRUaW1lbGluZUVtcHR5KHNsb3RzKSwgbnVsbCk7XG5cdFx0YXdhaXQgcmV2ZWFsVW50aXRsZWRQcm9jZXNzRm9sZChsZW5zLCBsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJ1tkYXRhLXByb2Nlc3MtZm9sZF0nKSk7XG5cdFx0YXdhaXQgcmV2ZWFsVmlzdWFsaXplVHVybihsZW5zLCBsYXlvdXRSZWFkaW5nQ29sdW1uLCAndW50aXRsZWQtdTEnKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0nKSk7XG5cdFx0YXdhaXQgcmV2ZWFsVmlzdWFsaXplVHVybihsZW5zLCBsYXlvdXRSZWFkaW5nQ29sdW1uLCAndW50aXRsZWQtYzEnKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy1jb25maXJtYXRpb24tc2VhdCcpKTtcblx0XHRhc3NlcnQub2socGVuZGluZ0J1dHRvbik7XG5cdFx0YXNzZXJ0Lm9rKCFwZW5kaW5nQnV0dG9uLmhpZGRlbik7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbGxzIFNlc3Npb25CYXIsIHN0dWIgdGltZWxpbmUsIGFuZCBzdHViIGRvY2sgc2xvdHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0IH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRhc3NlcnQub2soc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tYmFyJykpO1xuXHRcdGFzc2VydC5vayhzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdGltZWxpbmUnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2snKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXNlbGVjdCcpKTtcblx0XHRhc3NlcnQub2soc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24taGlzdG9yeScpKTtcblx0XHRhc3NlcnQub2soc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tc25hcHNob3RzJykpO1xuXHRcdGFzc2VydC5vayhnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLW1lZGl1bScpKTtcblx0XHRhc3NlcnQub2soIWdldFJlYWRpbmdDb2x1bW4oc2xvdHMpLmNsYXNzTGlzdC5jb250YWlucygnaXMtbmFycm93JykpO1xuXHRcdGFzc2VydC5vayhzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtbGVucy10YWJbZGF0YS1sZW5zLWlkPVwidHJhamVjdG9yeVwiXScpKTtcblx0XHRhc3NlcnQub2soc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXRyYWplY3RvcnknKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stZ2F0ZS1yb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LW92ZXJsYXknKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcigndGV4dGFyZWEuY29udmVyc2F0aW9uLWxlbnMtZG9jay1pbnB1dCcpKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwb3NlcyBBZ2VudCBJREUgY2hyb21lIGxhbmRtYXJrcycsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLWljb24nKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXRpdGxlJykpO1xuXHRcdGFzc2VydC5vayhzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtbGVucy10YWJzW3JvbGU9XCJ0YWJsaXN0XCJdJykpO1xuXHRcdGFzc2VydC5vayhzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1zd2l0Y2hlci1sYWJlbCcpKTtcblx0XHRhc3NlcnQub2soc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24taGlzdG9yeScpKTtcblx0XHRhc3NlcnQub2soc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tc25hcHNob3RzJykpO1xuXHRcdGFzc2VydC5vayhnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10aW1lbGluZS1zY3JvbGwnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10aW1lbGluZS1jb250ZW50JykpO1xuXHRcdGFzc2VydC5vayhzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1jb21wb3NlcicpKTtcblx0XHRhc3NlcnQub2soc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1pbnB1dC1yb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stYm90dG9tLWJhcicpKTtcblx0XHRhc3NlcnQub2soc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1zZW5kJykpO1xuXHRcdGFzc2VydC5vayhzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93JykpO1xuXHRcdGFzc2VydC5vayhzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vZGVsJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC10YXNrJyksIG51bGwpO1xuXHRcdGFzc2VydC5vayhzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1xdWV1ZScpKTtcblx0fSk7XG5cblx0dGVzdCgnY29tcGFjdCBjaHJvbWU6IHNjcm9sbCByZWdpb24gaXMgdGltZWxpbmUgaW5uZXIgc2Nyb2xsIG9ubHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0IH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCB0aW1lbGluZVNsb3QgPSBzbG90cy50aW1lbGluZTtcblxuXHRcdGFzc2VydC5vayh0aW1lbGluZVNsb3QucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXRpbWVsaW5lLXNjcm9sbCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGltZWxpbmVTbG90LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLXRpbWVsaW5lJyksIHRydWUpO1xuXHRcdGFzc2VydC5vayghdGltZWxpbmVTbG90LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb21wYWN0IGNocm9tZTogZG9jayBjb21wb3NlciB0ZXh0YXJlYSB3aXRoIGJvdHRvbSBiYXIgc2VuZCcsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCd0ZXh0YXJlYS5jb252ZXJzYXRpb24tbGVucy1kb2NrLWlucHV0JykgYXMgSFRNTFRleHRBcmVhRWxlbWVudDtcblx0XHRjb25zdCBpbnB1dFJvdyA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2staW5wdXQtcm93JykhO1xuXHRcdGNvbnN0IGJvdHRvbUJhciA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stYm90dG9tLWJhcicpITtcblx0XHRjb25zdCBzZW5kQnV0dG9uID0gYm90dG9tQmFyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXNlbmQgLm1vbmFjby1idXR0b24nKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS5yb3dzLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEucGxhY2Vob2xkZXIsIGNvbnZlcnNhdGlvbkxlbnNEb2NrUGxhY2Vob2xkZXIpO1xuXHRcdGFzc2VydC5vayhpbnB1dFJvdy5jb250YWlucyh0ZXh0YXJlYSkpO1xuXHRcdGFzc2VydC5vayhzZW5kQnV0dG9uKTtcblx0XHRhc3NlcnQub2soYm90dG9tQmFyLmNvbnRhaW5zKHNlbmRCdXR0b24hLnBhcmVudEVsZW1lbnQhKSk7XG5cdFx0YXNzZXJ0Lm9rKCFpbnB1dFJvdy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1zZW5kJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdUMiBjb21wb3NlciBjaHJvbWU6IDMycHggYm90dG9tIGJhciB3aXRoIHR1bmUgcGVybWlzc2lvbiBtb2RlbCBtb3JlIHNlbmQgY29kaWNvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0IH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBib3R0b21CYXIgPSBnZXRDb21wb3NlckJvdHRvbUJhcihzbG90cyk7XG5cblx0XHRjb25zdCBib3R0b21CYXJNaW5IZWlnaHQgPSBwYXJzZUludChnZXRXaW5kb3coYm90dG9tQmFyKS5nZXRDb21wdXRlZFN0eWxlKGJvdHRvbUJhcikubWluSGVpZ2h0LCAxMCk7XG5cdFx0aWYgKGJvdHRvbUJhck1pbkhlaWdodCA+IDApIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChib3R0b21CYXJNaW5IZWlnaHQsIDI4KTtcblx0XHR9XG5cblx0XHRjb25zdCBsZWFkaW5nID0gYm90dG9tQmFyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWJvdHRvbS1sZWFkaW5nJykhO1xuXHRcdGNvbnN0IHRyYWlsaW5nID0gYm90dG9tQmFyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWJvdHRvbS10cmFpbGluZycpITtcblx0XHRhc3NlcnQub2sobGVhZGluZy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1hZGQgLmNvZGljb24tYWRkJykpO1xuXHRcdGFzc2VydC5vayhsZWFkaW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUgLmNvZGljb24tdG9vbHMnKSk7XG5cdFx0YXNzZXJ0Lm9rKGxlYWRpbmcucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stcGVybWlzc2lvbiAubW9uYWNvLXNlbGVjdC1ib3gnKSk7XG5cdFx0YXNzZXJ0Lm9rKGxlYWRpbmcucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9yZSAuY29kaWNvbi1lbGxpcHNpcycpKTtcblx0XHRhc3NlcnQub2sodHJhaWxpbmcucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9kZWwgLm1vbmFjby1zZWxlY3QtYm94JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFpbGluZy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10ZW1wbGF0ZXMnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWlsaW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1heGltaXplLWlucHV0JyksIG51bGwpO1xuXHRcdGFzc2VydC5vayhib3R0b21CYXIucGFyZW50RWxlbWVudCEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2staW5wdXQtcm93IC5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1heGltaXplLWlucHV0IC5jb2RpY29uLXNjcmVlbi1mdWxsJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFpbGluZy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1taWMnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0Lm9rKHRyYWlsaW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXNlbmQgLmNvZGljb24tYXJyb3ctdXAnKSk7XG5cblx0XHRjb25zdCBnaG9zdFR1bmUgPSBsZWFkaW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXR1bmUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MRWxlbWVudDtcblx0XHRjb25zdCBmaWxsZWRTZW5kID0gdHJhaWxpbmcucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stc2VuZCAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5vayhnaG9zdFR1bmUuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb252ZXJzYXRpb24tbGVucy1kb2NrLWNvbnRyb2wtLWdob3N0JykpO1xuXHRcdGFzc2VydC5vayhmaWxsZWRTZW5kLmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLWxlbnMtZG9jay1jb250cm9sLS1maWxsZWQnKSk7XG5cblx0XHRmb3IgKGNvbnN0IGNvbnRyb2wgb2YgYm90dG9tQmFyLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWNvbnRyb2wnKSkge1xuXHRcdFx0Y29uc3QgY29udHJvbEVsZW1lbnQgPSBjb250cm9sIGFzIEhUTUxFbGVtZW50O1xuXHRcdFx0aWYgKGNvbnRyb2xFbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLWxlbnMtZG9jay1zZW5kLWJ1dHRvbicpKSB7XG5cdFx0XHRcdGNvbnN0IHNlbmRIZWlnaHQgPSBwYXJzZUludChnZXRXaW5kb3coY29udHJvbEVsZW1lbnQpLmdldENvbXB1dGVkU3R5bGUoY29udHJvbEVsZW1lbnQpLmhlaWdodCwgMTApO1xuXHRcdFx0XHRpZiAoc2VuZEhlaWdodCA+IDApIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VuZEhlaWdodCwgMjQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaGVpZ2h0ID0gcGFyc2VJbnQoZ2V0V2luZG93KGNvbnRyb2xFbGVtZW50KS5nZXRDb21wdXRlZFN0eWxlKGNvbnRyb2xFbGVtZW50KS5oZWlnaHQsIDEwKTtcblx0XHRcdGlmIChoZWlnaHQgPiAwKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWlnaHQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrQ29udHJvbEhlaWdodFB4KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB0dW5lQnV0dG9uID0gbGVhZGluZy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR1bmVCdXR0b24uZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNEb2NrVHVuZVRpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVhZGluZy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1yb3V0ZScpLCBudWxsKTtcblxuXHRcdGNvbnN0IHBlcm1pc3Npb25TZWxlY3QgPSBsZWFkaW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXBlcm1pc3Npb24gc2VsZWN0Lm1vbmFjby1zZWxlY3QtYm94JykgYXMgSFRNTFNlbGVjdEVsZW1lbnQ7XG5cdFx0Y29uc3QgbW9kZWxTZWxlY3QgPSB0cmFpbGluZy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb2RlbCBzZWxlY3QubW9uYWNvLXNlbGVjdC1ib3gnKSBhcyBIVE1MU2VsZWN0RWxlbWVudDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGVybWlzc2lvblNlbGVjdC5vcHRpb25zW3Blcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleF0/LnRleHQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrUGVybWlzc2lvbkFzayk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0Lm9wdGlvbnNbbW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleF0/LnRleHQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9Nb2RlbCk7XG5cdFx0YXNzZXJ0RGlzY29ubmVjdGVkQ29tcG9zZXJDYXRhbG9nc0hvbmVzdChzbG90cyk7XG5cblx0XHRjb25zdCBzZW5kQnV0dG9uID0gZ2V0RG9ja1NlbmRCdXR0b24oc2xvdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZW5kQnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnZGlzYWJsZWQnKSwgdHJ1ZSk7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBnZXREb2NrVGV4dGFyZWEoc2xvdHMpO1xuXHRcdHRleHRhcmVhLnZhbHVlID0gJ2hlbGxvJztcblx0XHR0ZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBnbG9iYWxUaGlzLkV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlbmRCdXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdkaXNhYmxlZCcpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Blcm1pc3Npb24gc2VsZWN0IGlzIGRpc2FibGVkIHVudGlsIHRoZSBlbmdpbmUgY2FuIHNldFBlcm1pc3Npb25Nb2RlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoe1xuXHRcdFx0c2V0UGVybWlzc2lvbk1vZGU6IGFzeW5jICgpID0+ICh7IG9rOiB0cnVlIH0pLFxuXHRcdH0pO1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucyh7IGNvbm5lY3Rpb24gfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgcGVybWlzc2lvblNlbGVjdCA9IGdldFBlcm1pc3Npb25TZWxlY3Qoc2xvdHMpO1xuXHRcdGNvbnN0IHBlcm1pc3Npb25Db250YWluZXIgPSBnZXRDb21wb3NlckJvdHRvbUJhcihzbG90cykucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stcGVybWlzc2lvbicpIGFzIEhUTUxFbGVtZW50O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwZXJtaXNzaW9uU2VsZWN0LmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCBgJHtjb252ZXJzYXRpb25MZW5zRG9ja1Blcm1pc3Npb25MYWJlbH0gXHUyMDE0ICR7Y29udmVyc2F0aW9uTGVuc0RvY2tQZXJtaXNzaW9uVW5hdmFpbGFibGV9YCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25Db250YWluZXIudGl0bGUsIGNvbnZlcnNhdGlvbkxlbnNEb2NrUGVybWlzc2lvblVuYXZhaWxhYmxlKTtcblxuXHRcdHN0dWJTZXJ2aWNlLnNldEVuZ2luZUNvbm5lY3RlZCh0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwZXJtaXNzaW9uU2VsZWN0LmRpc2FibGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNEb2NrUGVybWlzc2lvbkxhYmVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGVybWlzc2lvbkNvbnRhaW5lci50aXRsZSwgY29udmVyc2F0aW9uTGVuc0RvY2tQZXJtaXNzaW9uTGFiZWwpO1xuXHR9KTtcblxuXHR0ZXN0KCdhZ2VudCBzbG90IGlzIHJlYWQtb25seSB3aXRob3V0IFN3aXRjaEFnZW50IGFuZCBkb2VzIG5vdCBsb2FkIHByb2ZpbGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNhcGFiaWxpdGllcyA9IGNyZWF0ZUVtcHR5VGVzdENhcGFiaWxpdHlTbmFwc2hvdCgpO1xuXHRcdGxldCBsaXN0QWdlbnRQcm9maWxlc0NhbGxzID0gMDtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGdldENhcGFiaWxpdHlTbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Li4uY2FwYWJpbGl0aWVzLFxuXHRcdFx0XHRhZ2VudFByb2ZpbGVzOiB7IHN1cHBvcnQ6ICdTVVBQT1JURUQnIH0sXG5cdFx0XHR9KSxcblx0XHRcdGxpc3RBZ2VudFByb2ZpbGVzOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGxpc3RBZ2VudFByb2ZpbGVzQ2FsbHMrKztcblx0XHRcdFx0cmV0dXJuIHsgcHJvZmlsZXM6IFt7IGlkOiAnY29kZXInLCBuYW1lOiAnQ29kZXInLCBzb3VyY2U6ICd1c2VyJyB9XSB9O1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsZW5zIH0gPSBtb3VudExlbnMoeyBjb25uZWN0aW9uIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IGFnZW50Q29udGFpbmVyID0gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWFnZW50JykgYXMgSFRNTEVsZW1lbnQ7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWdlbnRDb250YWluZXIucXVlcnlTZWxlY3Rvcignc2VsZWN0JyksIG51bGwpO1xuXHRcdGNvbnN0IGxhYmVsID0gZ2V0QWdlbnRSZWFkb25seUxhYmVsKHNsb3RzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrQWdlbnRVbmF2YWlsYWJsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhYmVsLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCBjb252ZXJzYXRpb25MZW5zRG9ja0FnZW50VW5hdmFpbGFibGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbC50aXRsZSwgY29udmVyc2F0aW9uTGVuc0RvY2tBZ2VudFVuYXZhaWxhYmxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5nZXRTZXNzaW9uQ29uZmlnKHNlc3Npb25JZCkuYWdlbnRJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpc3RBZ2VudFByb2ZpbGVzQ2FsbHMsIDApO1xuXG5cdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKHRydWUpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdCcpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0QWdlbnRSZWFkb25seUxhYmVsKHNsb3RzKS50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc0RvY2tFbmdpbmVDYXBhYmlsaXR5VW5zdXBwb3J0ZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmdldFNlc3Npb25Db25maWcoc2Vzc2lvbklkKS5hZ2VudEluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlzdEFnZW50UHJvZmlsZXNDYWxscywgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FnZW50IHNlbGVjdCByb2xscyBiYWNrIHRvIGFnZW50SW5kZXggd2hlbiBTd2l0Y2hBZ2VudCBpcyBhdmFpbGFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY2FwYWJpbGl0aWVzID0gY3JlYXRlRW1wdHlUZXN0Q2FwYWJpbGl0eVNuYXBzaG90KCk7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yih7XG5cdFx0XHRnZXRDYXBhYmlsaXR5U25hcHNob3Q6ICgpID0+ICh7XG5cdFx0XHRcdC4uLmNhcGFiaWxpdGllcyxcblx0XHRcdFx0YWdlbnRQcm9maWxlczogeyBzdXBwb3J0OiAnU1VQUE9SVEVEJyB9LFxuXHRcdFx0fSksXG5cdFx0XHRsaXN0QWdlbnRQcm9maWxlczogYXN5bmMgKCkgPT4gKHsgcHJvZmlsZXM6IFt7IGlkOiAnY29kZXInLCBuYW1lOiAnQ29kZXInLCBzb3VyY2U6ICd1c2VyJyB9XSB9KSxcblx0XHR9KTtcblx0XHQoY29ubmVjdGlvbiBhcyB7IHN3aXRjaEFnZW50PzogdW5rbm93biB9KS5zd2l0Y2hBZ2VudCA9IGFzeW5jICgpID0+ICh7IG9rOiB0cnVlIH0pO1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxlbnMgfSA9IG1vdW50TGVucyh7IGNvbm5lY3Rpb24gfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKHRydWUpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cblx0XHRjb25zdCBhZ2VudFNlbGVjdCA9IGdldEFnZW50U2VsZWN0KHNsb3RzKTtcblx0XHRjb25zdCBjb2RlckluZGV4ID0gWy4uLmFnZW50U2VsZWN0Lm9wdGlvbnNdLmZpbmRJbmRleChvcHRpb24gPT4gb3B0aW9uLnRleHQgPT09ICdDb2RlcicpO1xuXHRcdGFzc2VydC5vayhjb2RlckluZGV4ID49IDApO1xuXHRcdGFnZW50U2VsZWN0LnNlbGVjdGVkSW5kZXggPSBjb2RlckluZGV4O1xuXHRcdGFnZW50U2VsZWN0LmRpc3BhdGNoRXZlbnQobmV3IGdsb2JhbFRoaXMuRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuZ2V0U2Vzc2lvbkNvbmZpZyhzZXNzaW9uSWQpLmFnZW50SW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZ2VudFNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgc2VsZWN0IGlzIGRpc2FibGVkIHVudGlsIHRoZSBlbmdpbmUgY2FuIHN3aXRjaE1vZGVsJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoe1xuXHRcdFx0c3dpdGNoTW9kZWw6IGFzeW5jICgpID0+ICh7IHJlc29sdmVkTW9kZWxJZDogJ2dwdC10ZXN0JywgcHJvdmlkZXI6ICcnLCBsZXZlbDogMCwgY29zdDogJycsIHNwZWVkOiAnJyB9KSxcblx0XHR9KTtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoeyBjb25uZWN0aW9uIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IG1vZGVsU2VsZWN0ID0gZ2V0TW9kZWxTZWxlY3Qoc2xvdHMpO1xuXHRcdGNvbnN0IG1vZGVsQ29udGFpbmVyID0gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vZGVsJykgYXMgSFRNTEVsZW1lbnQ7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3QuZGlzYWJsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgYE1vZGVsIFx1MjAxNCAke2NvbnZlcnNhdGlvbkxlbnNEb2NrTW9kZWxVbmF2YWlsYWJsZX1gKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxDb250YWluZXIudGl0bGUsIGNvbnZlcnNhdGlvbkxlbnNEb2NrTW9kZWxVbmF2YWlsYWJsZSk7XG5cblx0XHRzdHViU2VydmljZS5zZXRFbmdpbmVDb25uZWN0ZWQodHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3QuZGlzYWJsZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksICdNb2RlbCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbENvbnRhaW5lci50aXRsZSwgJ01vZGVsJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGVsIHNlbGVjdCBrZWVwcyB0aGUgZmlyc3QgZW5hYmxlZCBtb2RlbCB3aXRob3V0IHN3aXRjaE1vZGVsIGFuZCByb2xscyBhIGxhdGVyIHBpY2sgYmFjaycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjYXBhYmlsaXRpZXMgPSBjcmVhdGVFbXB0eVRlc3RDYXBhYmlsaXR5U25hcHNob3QoKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGdldENhcGFiaWxpdHlTbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Li4uY2FwYWJpbGl0aWVzLFxuXHRcdFx0XHRtb2RlbHM6IHsgc3VwcG9ydDogJ1NVUFBPUlRFRCcgfSxcblx0XHRcdH0pLFxuXHRcdFx0bGlzdE1vZGVsczogYXN5bmMgKCkgPT4gKHtcblx0XHRcdFx0bW9kZWxzOiBbXG5cdFx0XHRcdFx0eyBpZDogJzEnLCB0eXBlOiAnY2hhdCcsIGVuYWJsZWQ6IHRydWUsIGxldmVsOiAxLCBwcm92aWRlcjogJ3AnLCBtb2RlbElkOiAnZ3B0LWEnIH0sXG5cdFx0XHRcdFx0eyBpZDogJzInLCB0eXBlOiAnY2hhdCcsIGVuYWJsZWQ6IHRydWUsIGxldmVsOiAxLCBwcm92aWRlcjogJ3AnLCBtb2RlbElkOiAnZ3B0LWInIH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9KSxcblx0XHR9KTtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoeyBjb25uZWN0aW9uIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdHN0dWJTZXJ2aWNlLnNldEVuZ2luZUNvbm5lY3RlZCh0cnVlKTtcblx0XHRhd2FpdCB3YWl0Rm9yTW9kZWxPcHRpb24oc2xvdHMsICdncHQtYicpO1xuXG5cdFx0Y29uc3QgbW9kZWxTZWxlY3QgPSBnZXRNb2RlbFNlbGVjdChzbG90cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5vcHRpb25zW21vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXhdPy50ZXh0LCAnZ3B0LWEnKTtcblxuXHRcdHNlbGVjdERvY2tNb2RlbChzbG90cywgMSk7XG5cdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0Lm9wdGlvbnNbbW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleF0/LnRleHQsICdncHQtYScpO1xuXHR9KTtcblxuXHR0ZXN0KCdwZXJtaXNzaW9uIHNlbGVjdCByb2xscyBiYWNrIGFuZCBzaG93cyB0aGUgZ2F0ZSB3aGVuIHNldFBlcm1pc3Npb25Nb2RlIGZhaWxzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNhbGxzOiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlOiBzdHJpbmcgfVtdID0gW107XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yih7XG5cdFx0XHRzZXRQZXJtaXNzaW9uTW9kZTogYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGNhbGxzLnB1c2gocmVxdWVzdCk7XG5cdFx0XHRcdHJldHVybiB7IG9rOiBmYWxzZSwgbWVzc2FnZTogJ2VuZ2luZSByZWplY3RlZCBwZXJtaXQnIH07XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucyh7IGNvbm5lY3Rpb24gfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKHRydWUpO1xuXG5cdFx0Y29uc3QgcGVybWlzc2lvblNlbGVjdCA9IGdldFBlcm1pc3Npb25TZWxlY3Qoc2xvdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwZXJtaXNzaW9uU2VsZWN0LmRpc2FibGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3Qub3B0aW9uc1twZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXhdPy50ZXh0LCBjb252ZXJzYXRpb25MZW5zRG9ja1Blcm1pc3Npb25Bc2spO1xuXG5cdFx0cGVybWlzc2lvblNlbGVjdC5zZWxlY3RlZEluZGV4ID0gMjtcblx0XHRwZXJtaXNzaW9uU2VsZWN0LmRpc3BhdGNoRXZlbnQobmV3IGdsb2JhbFRoaXMuRXZlbnQoJ2NoYW5nZScsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHNbMF0ubW9kZSwgJ1NFU1NJT05fVE9PTF9QRVJNSVNTSU9OX01PREVfUEVSTUlUJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlcm1pc3Npb25TZWxlY3Qub3B0aW9uc1twZXJtaXNzaW9uU2VsZWN0LnNlbGVjdGVkSW5kZXhdPy50ZXh0LCBjb252ZXJzYXRpb25MZW5zRG9ja1Blcm1pc3Npb25Bc2spO1xuXHRcdGNvbnN0IGdhdGVSb3cgPSBzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93JykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVSb3cuaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKGdhdGVSb3cudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdlbmdpbmUgcmVqZWN0ZWQgcGVybWl0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb2RlbCBzZWxlY3QgZG9lcyBub3QgY2FsbCBzd2l0Y2hNb2RlbCB1bnRpbCB0aGUgZW5naW5lIGlzIGNvbm5lY3RlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjYWxsczogeyBzZXNzaW9uSWQ6IHN0cmluZzsgbW9kZWxJZDogc3RyaW5nIH1bXSA9IFtdO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoe1xuXHRcdFx0c3dpdGNoTW9kZWw6IGFzeW5jIHJlcXVlc3QgPT4ge1xuXHRcdFx0XHRjYWxscy5wdXNoKHsgc2Vzc2lvbklkOiByZXF1ZXN0LnNlc3Npb25JZCwgbW9kZWxJZDogcmVxdWVzdC5tb2RlbElkIH0pO1xuXHRcdFx0XHRyZXR1cm4geyByZXNvbHZlZE1vZGVsSWQ6IHJlcXVlc3QubW9kZWxJZCwgcHJvdmlkZXI6ICcnLCBsZXZlbDogMCwgY29zdDogJycsIHNwZWVkOiAnJyB9O1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucyh7IGNvbm5lY3Rpb24gfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0YXNzZXJ0RGlzY29ubmVjdGVkQ29tcG9zZXJDYXRhbG9nc0hvbmVzdChzbG90cyk7XG5cblx0XHRzZWxlY3REb2NrTW9kZWwoc2xvdHMsIDApO1xuXHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldE1vZGVsU2VsZWN0KHNsb3RzKS5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0TW9kZWxTZWxlY3Qoc2xvdHMpLm9wdGlvbnMubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgc2VsZWN0IHdyaXRlcyBzZXNzaW9uSWQgYW5kIG1vZGVsSWQgd2hlbiBzd2l0Y2hNb2RlbCBpcyBhdmFpbGFibGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9W10gPSBbXTtcblx0XHRjb25zdCBjYXBhYmlsaXRpZXMgPSBjcmVhdGVFbXB0eVRlc3RDYXBhYmlsaXR5U25hcHNob3QoKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGdldENhcGFiaWxpdHlTbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Li4uY2FwYWJpbGl0aWVzLFxuXHRcdFx0XHRtb2RlbHM6IHsgc3VwcG9ydDogJ1NVUFBPUlRFRCcgfSxcblx0XHRcdH0pLFxuXHRcdFx0bGlzdE1vZGVsczogYXN5bmMgKCkgPT4gKHtcblx0XHRcdFx0bW9kZWxzOiBbXG5cdFx0XHRcdFx0eyBpZDogJzEnLCB0eXBlOiAnY2hhdCcsIGVuYWJsZWQ6IHRydWUsIGxldmVsOiAxLCBwcm92aWRlcjogJ3AnLCBtb2RlbElkOiAnZ3B0LWEnIH0sXG5cdFx0XHRcdFx0eyBpZDogJzInLCB0eXBlOiAnY2hhdCcsIGVuYWJsZWQ6IHRydWUsIGxldmVsOiAxLCBwcm92aWRlcjogJ3AnLCBtb2RlbElkOiAnZ3B0LWInIH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9KSxcblx0XHRcdHN3aXRjaE1vZGVsOiBhc3luYyByZXF1ZXN0ID0+IHtcblx0XHRcdFx0Y2FsbHMucHVzaCh7IHNlc3Npb25JZDogcmVxdWVzdC5zZXNzaW9uSWQsIG1vZGVsSWQ6IHJlcXVlc3QubW9kZWxJZCB9KTtcblx0XHRcdFx0cmV0dXJuIHsgcmVzb2x2ZWRNb2RlbElkOiByZXF1ZXN0Lm1vZGVsSWQsIHByb3ZpZGVyOiAncCcsIGxldmVsOiAxLCBjb3N0OiAnJywgc3BlZWQ6ICcnIH07XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucyh7IGNvbm5lY3Rpb24gfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKHRydWUpO1xuXHRcdGF3YWl0IHdhaXRGb3JNb2RlbE9wdGlvbihzbG90cywgJ2dwdC1iJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldE1vZGVsU2VsZWN0KHNsb3RzKS5zZWxlY3RlZEluZGV4LCAwKTtcblxuXHRcdHNlbGVjdERvY2tNb2RlbChzbG90cywgMSk7XG5cdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbHNbMF0uc2Vzc2lvbklkLCBzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzWzBdLm1vZGVsSWQsICdncHQtYicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRNb2RlbFNlbGVjdChzbG90cykuc2VsZWN0ZWRJbmRleCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vZGVsIHNlbGVjdCByb2xscyBiYWNrIGFuZCBzaG93cyB0aGUgZ2F0ZSB3aGVuIHN3aXRjaE1vZGVsIGZhaWxzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNhbGxzOiB7IHNlc3Npb25JZDogc3RyaW5nOyBtb2RlbElkOiBzdHJpbmcgfVtdID0gW107XG5cdFx0Y29uc3QgY2FwYWJpbGl0aWVzID0gY3JlYXRlRW1wdHlUZXN0Q2FwYWJpbGl0eVNuYXBzaG90KCk7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yih7XG5cdFx0XHRnZXRDYXBhYmlsaXR5U25hcHNob3Q6ICgpID0+ICh7XG5cdFx0XHRcdC4uLmNhcGFiaWxpdGllcyxcblx0XHRcdFx0bW9kZWxzOiB7IHN1cHBvcnQ6ICdTVVBQT1JURUQnIH0sXG5cdFx0XHR9KSxcblx0XHRcdGxpc3RNb2RlbHM6IGFzeW5jICgpID0+ICh7XG5cdFx0XHRcdG1vZGVsczogW1xuXHRcdFx0XHRcdHsgaWQ6ICcxJywgdHlwZTogJ2NoYXQnLCBlbmFibGVkOiB0cnVlLCBsZXZlbDogMSwgcHJvdmlkZXI6ICdwJywgbW9kZWxJZDogJ2dwdC1hJyB9LFxuXHRcdFx0XHRcdHsgaWQ6ICcyJywgdHlwZTogJ2NoYXQnLCBlbmFibGVkOiB0cnVlLCBsZXZlbDogMSwgcHJvdmlkZXI6ICdwJywgbW9kZWxJZDogJ2dwdC1iJyB9LFxuXHRcdFx0XHRdLFxuXHRcdFx0fSksXG5cdFx0XHRzd2l0Y2hNb2RlbDogYXN5bmMgcmVxdWVzdCA9PiB7XG5cdFx0XHRcdGNhbGxzLnB1c2goeyBzZXNzaW9uSWQ6IHJlcXVlc3Quc2Vzc2lvbklkLCBtb2RlbElkOiByZXF1ZXN0Lm1vZGVsSWQgfSk7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZW5naW5lIHJlamVjdGVkIG1vZGVsJyk7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucyh7IGNvbm5lY3Rpb24gfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKHRydWUpO1xuXHRcdGF3YWl0IHdhaXRGb3JNb2RlbE9wdGlvbihzbG90cywgJ2dwdC1iJyk7XG5cblx0XHRjb25zdCBtb2RlbFNlbGVjdCA9IGdldE1vZGVsU2VsZWN0KHNsb3RzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Qub3B0aW9uc1ttb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4XT8udGV4dCwgJ2dwdC1hJyk7XG5cblx0XHRzZWxlY3REb2NrTW9kZWwoc2xvdHMsIDEpO1xuXHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxzWzBdLm1vZGVsSWQsICdncHQtYicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Qub3B0aW9uc1ttb2RlbFNlbGVjdC5zZWxlY3RlZEluZGV4XT8udGV4dCwgJ2dwdC1hJyk7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stZ2F0ZS1yb3cnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2F0ZVJvdy5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQub2soZ2F0ZVJvdy50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ2VuZ2luZSByZWplY3RlZCBtb2RlbCcpKTtcblx0fSk7XG5cblx0dGVzdCgnbW9kZWwgc2VsZWN0IHJvbGxzIGJhY2sgYW5kIHNob3dzIHRoZSBnYXRlIHdoZW4gc3dpdGNoTW9kZWwgcmVzb2x2ZXMgd2l0aCBhbiBlbXB0eSByZXNvbHZlZE1vZGVsSWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY2FsbHM6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IG1vZGVsSWQ6IHN0cmluZyB9W10gPSBbXTtcblx0XHRjb25zdCBjYXBhYmlsaXRpZXMgPSBjcmVhdGVFbXB0eVRlc3RDYXBhYmlsaXR5U25hcHNob3QoKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGdldENhcGFiaWxpdHlTbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Li4uY2FwYWJpbGl0aWVzLFxuXHRcdFx0XHRtb2RlbHM6IHsgc3VwcG9ydDogJ1NVUFBPUlRFRCcgfSxcblx0XHRcdH0pLFxuXHRcdFx0bGlzdE1vZGVsczogYXN5bmMgKCkgPT4gKHtcblx0XHRcdFx0bW9kZWxzOiBbXG5cdFx0XHRcdFx0eyBpZDogJzEnLCB0eXBlOiAnY2hhdCcsIGVuYWJsZWQ6IHRydWUsIGxldmVsOiAxLCBwcm92aWRlcjogJ3AnLCBtb2RlbElkOiAnZ3B0LWEnIH0sXG5cdFx0XHRcdFx0eyBpZDogJzInLCB0eXBlOiAnY2hhdCcsIGVuYWJsZWQ6IHRydWUsIGxldmVsOiAxLCBwcm92aWRlcjogJ3AnLCBtb2RlbElkOiAnZ3B0LWInIH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9KSxcblx0XHRcdHN3aXRjaE1vZGVsOiBhc3luYyByZXF1ZXN0ID0+IHtcblx0XHRcdFx0Y2FsbHMucHVzaCh7IHNlc3Npb25JZDogcmVxdWVzdC5zZXNzaW9uSWQsIG1vZGVsSWQ6IHJlcXVlc3QubW9kZWxJZCB9KTtcblx0XHRcdFx0cmV0dXJuIHsgcmVzb2x2ZWRNb2RlbElkOiAnJywgcHJvdmlkZXI6ICcnLCBsZXZlbDogMCwgY29zdDogJycsIHNwZWVkOiAnJyB9O1xuXHRcdFx0fSxcblx0XHR9KTtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoeyBjb25uZWN0aW9uIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdHN0dWJTZXJ2aWNlLnNldEVuZ2luZUNvbm5lY3RlZCh0cnVlKTtcblx0XHRhd2FpdCB3YWl0Rm9yTW9kZWxPcHRpb24oc2xvdHMsICdncHQtYicpO1xuXG5cdFx0Y29uc3QgbW9kZWxTZWxlY3QgPSBnZXRNb2RlbFNlbGVjdChzbG90cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0Lm9wdGlvbnNbbW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleF0/LnRleHQsICdncHQtYScpO1xuXG5cdFx0c2VsZWN0RG9ja01vZGVsKHNsb3RzLCAxKTtcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxscy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsc1swXS5tb2RlbElkLCAnZ3B0LWInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsU2VsZWN0Lm9wdGlvbnNbbW9kZWxTZWxlY3Quc2VsZWN0ZWRJbmRleF0/LnRleHQsICdncHQtYScpO1xuXHRcdGNvbnN0IGdhdGVSb3cgPSBzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93JykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVSb3cuaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKGdhdGVSb3cudGV4dENvbnRlbnQ/LmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNEb2NrTW9kZWxGYWlsZWQpKTtcblx0fSk7XG5cblx0dGVzdCgnbmFycm93IE1vcmUgcGVybWlzc2lvbiByYWRpb3Mgc3RheSBkaXNhYmxlZCB3aXRob3V0IHNldFBlcm1pc3Npb25Nb2RlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKHsgbGF5b3V0V2lkdGg6IExFTlNfTUlOX1dJRFRIIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IG1vcmVCdXR0b24gPSBnZXRDb21wb3NlckJvdHRvbUJhcihzbG90cykucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9yZSAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdG1vcmVCdXR0b24uY2xpY2soKTtcblxuXHRcdGNvbnN0IHJhZGlvcyA9IFsuLi5kb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLXBlcm1pc3Npb24gW3JvbGU9XCJtZW51aXRlbXJhZGlvXCJdJyldIGFzIEhUTUxCdXR0b25FbGVtZW50W107XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhZGlvcy5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5vayhyYWRpb3Muc29tZShyYWRpbyA9PiByYWRpby50ZXh0Q29udGVudCA9PT0gY29udmVyc2F0aW9uTGVuc0RvY2tQZXJtaXNzaW9uUGVybWl0KSk7XG5cdFx0Zm9yIChjb25zdCByYWRpbyBvZiByYWRpb3MpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYWRpby5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFkaW8uZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFkaW8udGl0bGUsIGNvbnZlcnNhdGlvbkxlbnNEb2NrUGVybWlzc2lvblVuYXZhaWxhYmxlKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ25hcnJvdyBNb3JlIG1lbnUgbGlzdHMgQWRkIGNvbnRleHQgYmVmb3JlIFRvb2wgb3B0aW9ucycsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucyh7IGxheW91dFdpZHRoOiBMRU5TX01JTl9XSURUSCB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBtb3JlQnV0dG9uID0gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRtb3JlQnV0dG9uLmNsaWNrKCk7XG5cblx0XHRjb25zdCBwb3B1cCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtcG9wdXAnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHBvcHVwKTtcblx0XHRjb25zdCBhZGQgPSBbLi4ucG9wdXAucXVlcnlTZWxlY3RvckFsbCgnLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9yZS1pdGVtJyldLmZpbmQoaXRlbSA9PiBpdGVtLnRleHRDb250ZW50ID09PSBjb252ZXJzYXRpb25MZW5zRG9ja0FkZFRpdGxlKTtcblx0XHRjb25zdCB0dW5lID0gWy4uLnBvcHVwLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtaXRlbScpXS5maW5kKGl0ZW0gPT4gaXRlbS50ZXh0Q29udGVudCA9PT0gY29udmVyc2F0aW9uTGVuc0RvY2tUdW5lVGl0bGUpO1xuXHRcdGFzc2VydC5vayhhZGQpO1xuXHRcdGFzc2VydC5vayh0dW5lKTtcblx0XHRhc3NlcnQub2soYWRkLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKHR1bmUpICYgTm9kZS5ET0NVTUVOVF9QT1NJVElPTl9GT0xMT1dJTkcpO1xuXHR9KTtcblxuXHR0ZXN0KCduYXJyb3cgTW9yZSBtZW51IHNob3dzIGN1cnJlbnQgYWdlbnQgYmVmb3JlIFRvb2wgb3B0aW9ucycsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucyh7IGxheW91dFdpZHRoOiBMRU5TX01JTl9XSURUSCB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBtb3JlQnV0dG9uID0gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRtb3JlQnV0dG9uLmNsaWNrKCk7XG5cblx0XHRjb25zdCBwb3B1cCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtcG9wdXAnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHBvcHVwKTtcblx0XHRjb25zdCBhZ2VudE5vdGUgPSBwb3B1cC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLWFnZW50JykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayhhZ2VudE5vdGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZ2VudE5vdGUuZ2V0QXR0cmlidXRlKCdyb2xlJyksICdub3RlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50Tm90ZS50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc0RvY2tBZ2VudFVuYXZhaWxhYmxlKTtcblx0XHRjb25zdCB0dW5lID0gWy4uLnBvcHVwLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtaXRlbScpXS5maW5kKGl0ZW0gPT4gaXRlbS50ZXh0Q29udGVudCA9PT0gY29udmVyc2F0aW9uTGVuc0RvY2tUdW5lVGl0bGUpO1xuXHRcdGFzc2VydC5vayh0dW5lKTtcblx0XHRhc3NlcnQub2soYWdlbnROb3RlLmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKHR1bmUpICYgTm9kZS5ET0NVTUVOVF9QT1NJVElPTl9GT0xMT1dJTkcpO1xuXHR9KTtcblxuXHR0ZXN0KCdkaXNjb25uZWN0ZWQgY29tcG9zZSBlbmFibGVzIHNlbmQgZnJvbSBkcmFmdCB3aXRob3V0IFN0dWIgbW9kZWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IHNlbmRCdXR0b24gPSBnZXREb2NrU2VuZEJ1dHRvbihzbG90cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlbmRCdXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdkaXNhYmxlZCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuaGFzRW5naW5lQ29ubmVjdGlvbkhpc3RvcnkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydERpc2Nvbm5lY3RlZENvbXBvc2VyQ2F0YWxvZ3NIb25lc3Qoc2xvdHMpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICdoZWxsbyc7XG5cdFx0dGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZW5kQnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnZGlzYWJsZWQnKSwgZmFsc2UpO1xuXG5cdFx0c2VuZEJ1dHRvbi5jbGljaygpO1xuXHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAwKSk7XG5cblx0XHRjb25zdCByZWFkaW5nQ29sdW1uID0gZ2V0UmVhZGluZ0NvbHVtbihzbG90cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlYWRpbmdDb2x1bW4uY2xhc3NMaXN0LmNvbnRhaW5zKGNvbnZlcnNhdGlvbkxlbnNQaGFzZVByZUZpcnN0Q2xhc3MpLCBmYWxzZSwgJ2ZpcnN0IHBlbmRpbmcgbXVzdCBsZWF2ZSBQcmVGaXJzdCcpO1xuXHRcdGFzc2VydC5vayghL1x1NURGMlx1NTQwQ1x1NkI2NXxzeW5jZWQvaS50ZXN0KHNsb3RzLmRvY2sudGV4dENvbnRlbnQgPz8gJycpKTtcblx0XHRhc3NlcnQub2soIS9cdTVERjJcdTU0MENcdTZCNjV8c3luY2VkL2kudGVzdChzbG90cy5zZXNzaW9uQmFyPy50ZXh0Q29udGVudCA/PyAnJykpO1xuXHRcdGFzc2VydC5vayghL1x1NURGMlx1NTQwQ1x1NkI2NXxzeW5jZWQvaS50ZXN0KHJlYWRpbmdDb2x1bW4udGV4dENvbnRlbnQgPz8gJycpKTtcblx0XHRhc3NlcnQub2soc3R1YlNlcnZpY2UuZ2V0VHVybnMoc2Vzc2lvbklkKS5zb21lKHR1cm4gPT4gdHVybi5raW5kID09PSAndXNlcicgJiYgdHVybi50ZXh0ID09PSAnaGVsbG8nKSk7XG5cdFx0YXNzZXJ0Lm9rKHN0dWJTZXJ2aWNlLmdldFR1cm5zKHNlc3Npb25JZCkuc29tZSh0dXJuID0+IHR1cm4ua2luZCA9PT0gJ2Fzc2lzdGFudCcgJiYgL1N0dWIgZWNoby9pLnRlc3QodHVybi50ZXh0KSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJycpO1xuXHR9KTtcblxuXHR0ZXN0KCdlbmdpbmUtY2FjaGUgZGlzY29ubmVjdCBrZWVwcyBTZW5kIGVuYWJsZWQgYW5kIGRvZXMgbm90IHByZXRlbmQgZGVsaXZlcmVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNsYXNzIEVuZ2luZUNhY2hlUm9zdGVyIGV4dGVuZHMgQ29udmVyc2F0aW9uU3R1YlNlcnZpY2Uge1xuXHRcdFx0b3ZlcnJpZGUgaGFzRW5naW5lQ29ubmVjdGlvbkhpc3RvcnkoKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCByb3N0ZXIgPSBzdG9yZS5hZGQobmV3IEVuZ2luZUNhY2hlUm9zdGVyKCkpO1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSByb3N0ZXIuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IHNlbmRCdXR0b24gPSBnZXREb2NrU2VuZEJ1dHRvbihzbG90cyk7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBnZXREb2NrVGV4dGFyZWEoc2xvdHMpO1xuXHRcdHRleHRhcmVhLnZhbHVlID0gJ2tlZXAgdGhpcyBkcmFmdCc7XG5cdFx0dGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZW5kQnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnZGlzYWJsZWQnKSwgZmFsc2UpO1xuXG5cdFx0c2VuZEJ1dHRvbi5jbGljaygpO1xuXHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAwKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICdrZWVwIHRoaXMgZHJhZnQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmdldFR1cm5zKHNlc3Npb25JZCkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmVucXVldWVNZXNzYWdlUXVldWVJdGVtKHNlc3Npb25JZCwgJ2tlZXAgdGhpcyBkcmFmdCcpLCBmYWxzZSk7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IChnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1nYXRlLXJvdycpXG5cdFx0XHQ/PyBzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93JykpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soZ2F0ZVJvdyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVSb3cuaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKGdhdGVSb3cudGV4dENvbnRlbnQ/LmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkRGlzY29ubmVjdGVkKSk7XG5cdFx0YXNzZXJ0Lm9rKCEvXHU1REYyXHU1NDBDXHU2QjY1fFx1NURGMlx1NTNEMVx1OTAwMXxzeW5jZWR8ZGVsaXZlcmVkL2kudGVzdChnYXRlUm93LnRleHRDb250ZW50ID8/ICcnKSk7XG5cdFx0YXNzZXJ0Lm9rKCEvXHU1REYyXHU1NDBDXHU2QjY1fHN5bmNlZC9pLnRlc3Qoc2xvdHMuc2Vzc2lvbkJhcj8udGV4dENvbnRlbnQgPz8gJycpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0UmVhZGluZ0NvbHVtbihzbG90cykuY2xhc3NMaXN0LmNvbnRhaW5zKGNvbnZlcnNhdGlvbkxlbnNQaGFzZVByZUZpcnN0Q2xhc3MpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VuZEJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2Rpc2FibGVkJyksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnZW5naW5lLWNhY2hlIGRpc2Nvbm5lY3QgU2VuZCB1c2VzIGVucXVldWUgd2hlbiB0aGUgcm9zdGVyIEFQSSBhY2NlcHRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNsYXNzIFF1ZXVpbmdFbmdpbmVDYWNoZVJvc3RlciBleHRlbmRzIENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlIHtcblx0XHRcdHJlYWRvbmx5IHF1ZXVlZDogc3RyaW5nW10gPSBbXTtcblx0XHRcdG92ZXJyaWRlIGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5KCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGVucXVldWVNZXNzYWdlUXVldWVJdGVtKHNlc3Npb25JZDogc3RyaW5nLCB0ZXh0OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRcdFx0Y29uc3QgdHJpbW1lZCA9IHRleHQudHJpbSgpO1xuXHRcdFx0XHRpZiAoIXRyaW1tZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5xdWV1ZWQucHVzaChgJHtzZXNzaW9uSWR9OiR7dHJpbW1lZH1gKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHJvc3RlciA9IHN0b3JlLmFkZChuZXcgUXVldWluZ0VuZ2luZUNhY2hlUm9zdGVyKCkpO1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSByb3N0ZXIuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICdxdWV1ZWQgbGF0ZXInO1xuXHRcdHRleHRhcmVhLmRpc3BhdGNoRXZlbnQobmV3IGdsb2JhbFRoaXMuRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRnZXREb2NrU2VuZEJ1dHRvbihzbG90cykuY2xpY2soKTtcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocm9zdGVyLnF1ZXVlZCwgW2Ake3Nlc3Npb25JZH06cXVldWVkIGxhdGVyYF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0VHVybnMoc2Vzc2lvbklkKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5vayghL1x1NURGMlx1NTQwQ1x1NkI2NXxcdTVERjJcdTUzRDFcdTkwMDF8c3luY2VkL2kudGVzdChzbG90cy5kb2NrLnRleHRDb250ZW50ID8/ICcnKSk7XG5cdFx0YXNzZXJ0Lm9rKCEvXHU1REYyXHU1NDBDXHU2QjY1fFx1NURGMlx1NTNEMVx1OTAwMXxzeW5jZWQvaS50ZXN0KGdldFJlYWRpbmdDb2x1bW4oc2xvdHMpLnRleHRDb250ZW50ID8/ICcnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1ByZUZpcnN0OiBjZW50ZXJlZCBjb21wb3NlciBjbHVzdGVyIGhpZGVzIGRvY2sgaW5ib3ggYW5kIG1vdmVzIGlkZW50aXR5IGFib3ZlIGNvbXBvc2VyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IGVtcHR5U2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgZW1wdHlTZXNzaW9uSWQpO1xuXG5cdFx0Y29uc3QgcmVhZGluZ0NvbHVtbiA9IGdldFJlYWRpbmdDb2x1bW4oc2xvdHMpO1xuXHRcdGNvbnN0IHByZWZpcnN0SGVybyA9IGdldFByZWZpcnN0SGVybyhzbG90cyk7XG5cdFx0YXNzZXJ0Lm9rKHByZWZpcnN0SGVybyk7XG5cdFx0YXNzZXJ0Lm9rKCFwcmVmaXJzdEhlcm8hLmhpZGRlbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlYWRpbmdDb2x1bW4uY2xhc3NMaXN0LmNvbnRhaW5zKGNvbnZlcnNhdGlvbkxlbnNQaGFzZVByZUZpcnN0Q2xhc3MpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuZG9jay5jbGFzc0xpc3QuY29udGFpbnMoY29udmVyc2F0aW9uTGVuc1BoYXNlUHJlRmlyc3REb2NrSGlkZGVuQ2xhc3MpLCB0cnVlKTtcblx0XHRjb25zdCBkb2NrSW5ib3ggPSBzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1vdmVybGF5JykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayhkb2NrSW5ib3gpO1xuXHRcdGFzc2VydC5vayhkb2NrSW5ib3guaGlkZGVuKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtY29tcG9zZXInKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlYWRpbmdDb2x1bW4ucXVlcnlTZWxlY3RvcihgLiR7Y29udmVyc2F0aW9uSWRlbnRpdHlTdHJpcENsYXNzfWApLCBwcmVmaXJzdEhlcm8hLnF1ZXJ5U2VsZWN0b3IoYC4ke2NvbnZlcnNhdGlvbklkZW50aXR5U3RyaXBDbGFzc31gKSk7XG5cdFx0YXNzZXJ0Lm9rKHByZWZpcnN0SGVybyEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyJykpO1xuXHRcdGFzc2VydC5vayhwcmVmaXJzdEhlcm8hLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWFkaW5nQ29sdW1uLmZpcnN0RWxlbWVudENoaWxkPy5jbGFzc0xpc3QuY29udGFpbnMoY29udmVyc2F0aW9uSWRlbnRpdHlTdHJpcENsYXNzKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdBY3RpdmU6IGZpcnN0IG1lc3NhZ2UgcmVzdG9yZXMgZG9jayBpbmJveCByb3cgYW5kIGlkZW50aXR5IGF0IHJlYWRpbmcgY29sdW1uIHRvcCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ0hlbGxvIFByZUZpcnN0Jyk7XG5cblx0XHRjb25zdCByZWFkaW5nQ29sdW1uID0gZ2V0UmVhZGluZ0NvbHVtbihzbG90cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlYWRpbmdDb2x1bW4uY2xhc3NMaXN0LmNvbnRhaW5zKGNvbnZlcnNhdGlvbkxlbnNQaGFzZVByZUZpcnN0Q2xhc3MpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLmRvY2suY2xhc3NMaXN0LmNvbnRhaW5zKGNvbnZlcnNhdGlvbkxlbnNQaGFzZVByZUZpcnN0RG9ja0hpZGRlbkNsYXNzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1vdmVybGF5JykpO1xuXHRcdGFzc2VydC5vayhzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1jb21wb3NlcicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVhZGluZ0NvbHVtbi5maXJzdEVsZW1lbnRDaGlsZD8uY2xhc3NMaXN0LmNvbnRhaW5zKGNvbnZlcnNhdGlvbklkZW50aXR5U3RyaXBDbGFzcyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRQcmVmaXJzdEhlcm8oc2xvdHMpPy5oaWRkZW4sIHRydWUpO1xuXG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDApKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0VHVybnMoc2Vzc2lvbklkKS5sZW5ndGgsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdUMyBTZXNzaW9uQ29uZmlnIFhPUjogYWdlbnQgb25seSBpbiBQcmVGaXJzdCBjb21wb3Nlcjsgbm8gUm91dGUgU2VsZWN0Qm94OyBjbGVhcmluZyB0dXJucyByZXR1cm5zIFByZUZpcnN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxlbnMgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRjb25zdCByZWFkaW5nQ29sdW1uID0gZ2V0UmVhZGluZ0NvbHVtbihzbG90cyk7XG5cblx0XHRjb25zdCBnZXRMZWFkaW5nID0gKCkgPT4gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWJvdHRvbS1sZWFkaW5nJykhO1xuXHRcdGNvbnN0IGFnZW50U2xvdCA9ICgpID0+IGdldExlYWRpbmcoKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1hZ2VudCcpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IHF1ZXJ5Um91dGUgPSAocm9vdDogUGFyZW50Tm9kZSkgPT4gcm9vdC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1yb3V0ZSwgLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tcm91dGUnKTtcblxuXHRcdGFzc2VydC5vayhhZ2VudFNsb3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50U2xvdCgpLmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVJvdXRlKGdldExlYWRpbmcoKSksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVJvdXRlKHNsb3RzLnNlc3Npb25CYXIhKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChPYmplY3Qua2V5cyhsZW5zLmdldFNlc3Npb25Db25maWcoc2Vzc2lvbklkKSkuc29ydCgpLCBbJ2FnZW50SW5kZXgnLCAncGVybWlzc2lvbkluZGV4J10pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50U2xvdCgpLnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdCcpLCBudWxsKTtcblx0XHRjb25zdCBhZ2VudExhYmVsID0gYWdlbnRTbG90KCkucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stYWdlbnQtcmVhZG9ubHknKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQub2soYWdlbnRMYWJlbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50TGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrQWdlbnRVbmF2YWlsYWJsZSk7XG5cdFx0YXNzZXJ0RGlzY29ubmVjdGVkQ29tcG9zZXJDYXRhbG9nc0hvbmVzdChzbG90cyk7XG5cblx0XHRhd2FpdCBzZW5kRG9ja0RyYWZ0KHNsb3RzLCAnSGVsbG8gQWN0aXZlJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWdlbnRTbG90KCkuaGlkZGVuLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlSb3V0ZShnZXRDb21wb3NlckJvdHRvbUJhcihzbG90cykpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlSb3V0ZShzbG90cy5zZXNzaW9uQmFyISksIG51bGwpO1xuXG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDApKTtcblx0XHRmb3IgKGNvbnN0IHR1cm4gb2YgWy4uLnN0dWJTZXJ2aWNlLmdldFR1cm5zKHNlc3Npb25JZCldKSB7XG5cdFx0XHRzdHViU2VydmljZS5kZWxldGVUdXJuKHNlc3Npb25JZCwgdHVybi5pZCk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlYWRpbmdDb2x1bW4uY2xhc3NMaXN0LmNvbnRhaW5zKGNvbnZlcnNhdGlvbkxlbnNQaGFzZVByZUZpcnN0Q2xhc3MpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWdlbnRTbG90KCkuaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5Um91dGUoZ2V0TGVhZGluZygpKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5Um91dGUoc2xvdHMuc2Vzc2lvbkJhciEpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnVDMgU2Vzc2lvbkNvbmZpZyBYT1I6IFNlc3Npb25CYXIgaGFzIG5vIFJvdXRlIFNlbGVjdEJveCBpbiBQcmVGaXJzdCcsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXJvdXRlJyksIG51bGwpO1xuXHRcdHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tcm91dGUnKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1ByZUZpcnN0IGxheW91dCBkb2VzIG5vdCBnaXZlIHRoZSBlbXB0eSB0aW1lbGluZSB0aGUgZnVsbCByZWFkaW5nIGhlaWdodCcsICgpID0+IHtcblx0XHRjb25zdCB7IGxlbnMsIHN0dWJTZXJ2aWNlLCBwYXJ0IH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0bGVucy5sYXlvdXQoNjAwLCA4MDApO1xuXHRcdGNvbnN0IHJlYWRpbmdDb2x1bW4gPSBnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKTtcblx0XHRhc3NlcnQub2socmVhZGluZ0NvbHVtbi5jbGFzc0xpc3QuY29udGFpbnMoY29udmVyc2F0aW9uTGVuc1BoYXNlUHJlRmlyc3RDbGFzcykpO1xuXHRcdGNvbnN0IHByZWZpcnN0SGVybyA9IGdldFByZWZpcnN0SGVybyhzbG90cyk7XG5cdFx0YXNzZXJ0Lm9rKHByZWZpcnN0SGVybyk7XG5cdFx0YXNzZXJ0Lm9rKCFwcmVmaXJzdEhlcm8uaGlkZGVuKTtcblx0XHRhc3NlcnQub2socHJlZmlyc3RIZXJvLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1jb21wb3NlcicpKTtcblx0XHRhc3NlcnQub2socmVhZGluZ0NvbHVtbi5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdGltZWxpbmUnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1QzIFNlc3Npb25Db25maWc6IFJvdXRlIFNlbGVjdEJveCBpcyBnb25lIGZyb20gY29tcG9zZXIgYW5kIFNlc3Npb25CYXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGVucyB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1yb3V0ZScpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tcm91dGUnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChPYmplY3Qua2V5cyhsZW5zLmdldFNlc3Npb25Db25maWcoc2Vzc2lvbklkKSkuc29ydCgpLCBbJ2FnZW50SW5kZXgnLCAncGVybWlzc2lvbkluZGV4J10pO1xuXG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ05vIHByZXRlbmQgcm91dGUgc2V0dGluZycpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1yb3V0ZScpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tcm91dGUnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChPYmplY3Qua2V5cyhsZW5zLmdldFNlc3Npb25Db25maWcoc2Vzc2lvbklkKSkuc29ydCgpLCBbJ2FnZW50SW5kZXgnLCAncGVybWlzc2lvbkluZGV4J10pO1xuXHR9KTtcblxuXHR0ZXN0KCdBY3RpdmUgaW5ib3g6IGxlZnQvcmlnaHQgY2x1c3RlcnMgd2l0aCBNZXNzYWdlUXVldWUgYW5kIG5vIFRhc2sgY2hpcCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ0FjdGl2YXRlIGluYm94IG92ZXJsYXknKTtcblx0XHRjb25zdCBvdmVybGF5ID0gZ2V0SW5ib3hPdmVybGF5KHNsb3RzKTtcblx0XHRjb25zdCBsZWZ0ID0gb3ZlcmxheS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtbGVmdCcpITtcblx0XHRjb25zdCByaWdodCA9IG92ZXJsYXkucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LXJpZ2h0JykhO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlZnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LXRhc2snKSwgbnVsbCk7XG5cdFx0YXNzZXJ0Lm9rKGxlZnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LXF1ZXVlJykpO1xuXHRcdGFzc2VydC5vayhsZWZ0LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1nb2FsJykpO1xuXHRcdGFzc2VydC5vayhyaWdodC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtc3RvcCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmlnaHQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LWNvbnRleHQtcmluZycpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVmdC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtbGFiZWwnKSwgbnVsbCk7XG5cblx0XHRjb25zdCBxdWV1ZUNoaXAgPSBnZXRJbmJveFF1ZXVlQ2hpcChzbG90cyk7XG5cdFx0YXNzZXJ0Lm9rKHF1ZXVlQ2hpcC5xdWVyeVNlbGVjdG9yKCcuY29kaWNvbi1saXN0LW9yZGVyZWQnKSk7XG5cdFx0YXNzZXJ0Lm9rKHF1ZXVlQ2hpcC50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc0RvY2tJbmJveE5vUXVldWUpKTtcblx0XHRhc3NlcnQub2soIXF1ZXVlQ2hpcC50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc0RvY2tJbmJveFF1ZXVlTGFiZWwpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVldWVDaGlwLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCBgJHtjb252ZXJzYXRpb25MZW5zRG9ja0luYm94UXVldWVMYWJlbH0sICR7Y29udmVyc2F0aW9uTGVuc0RvY2tJbmJveE5vUXVldWV9YCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXVlQ2hpcC50aXRsZSwgYCR7Y29udmVyc2F0aW9uTGVuc0RvY2tJbmJveFF1ZXVlTGFiZWx9LCAke2NvbnZlcnNhdGlvbkxlbnNEb2NrSW5ib3hOb1F1ZXVlfWApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWV1ZUNoaXAuZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cdFx0Y29uc3QgZ29hbEJ1dHRvbiA9IGdldEluYm94R29hbEJ1dHRvbihzbG90cyk7XG5cdFx0YXNzZXJ0Lm9rKGdvYWxCdXR0b24ucXVlcnlTZWxlY3RvcignLmNvZGljb24tdGFyZ2V0JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnb2FsQnV0dG9uLmdldEF0dHJpYnV0ZSgnZGF0YS1nb2FsLWVtcHR5JyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0Lm9rKCFnb2FsQnV0dG9uLnRleHRDb250ZW50Py5pbmNsdWRlcyhjb252ZXJzYXRpb25MZW5zRG9ja05vR29hbCkpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiB1c2FnZVNuYXBzaG90KGl0ZW1zOiBTZXNzaW9uVmlld1NuYXBzaG90Wyd0aW1lbGluZSddKTogU2Vzc2lvblZpZXdTbmFwc2hvdCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNlc3Npb25JZDogJ3VhLWxpdmUnIGFzIFNlc3Npb25WaWV3U25hcHNob3RbJ3Nlc3Npb25JZCddLFxuXHRcdFx0c3luYzogeyBraW5kOiAnbGl2ZScgfSxcblx0XHRcdHRpbWVsaW5lOiBpdGVtcyxcblx0XHRcdG92ZXJsYXk6IHsgYmxvY2tzOiBbXSB9LFxuXHRcdFx0cGVuZGluZ0FjdGlvbnM6IFtdLFxuXHRcdFx0bG9jYWxQZW5kaW5nU2VuZHM6IFtdLFxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiB1c2FnZUl0ZW0oaWQ6IHN0cmluZywgb3JkZXJLZXk6IHN0cmluZywgc3VtbWFyeTogeyBraW5kOiAndXNhZ2UnOyB0aXRsZTogc3RyaW5nOyBpbnB1dFRva2Vucz86IG51bWJlcjsgb3V0cHV0VG9rZW5zPzogbnVtYmVyOyBjb250ZXh0UGN0PzogbnVtYmVyIH0pOiBTZXNzaW9uVmlld1NuYXBzaG90Wyd0aW1lbGluZSddW251bWJlcl0ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogaWQgYXMgVGltZWxpbmVJdGVtSWQsXG5cdFx0XHRvcmRlcktleSxcblx0XHRcdHN1bW1hcnksXG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2xhdGVzdCBhZG1pdHRlZCB1c2FnZSBrZWVwcyBjb250ZXh0UGN0IG9ubHkgZnJvbSB0aGUgbGF0ZXN0IHVzYWdlIHJvdycsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGF0ZXN0QWRtaXR0ZWRJbmJveENvbnRleHRVc2FnZSh1bmRlZmluZWQpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXRlc3RBZG1pdHRlZEluYm94Q29udGV4dFVzYWdlKHVzYWdlU25hcHNob3QoW10pKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGF0ZXN0QWRtaXR0ZWRJbmJveENvbnRleHRVc2FnZSh1c2FnZVNuYXBzaG90KFtcblx0XHRcdHVzYWdlSXRlbSgndXNhZ2UtdG9rZW5zJywgJzAwMDEnLCB7IGtpbmQ6ICd1c2FnZScsIHRpdGxlOiAndG9rZW5zIG9ubHknLCBpbnB1dFRva2VuczogOSwgb3V0cHV0VG9rZW5zOiAxIH0pLFxuXHRcdF0pKSwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGF0ZXN0QWRtaXR0ZWRJbmJveENvbnRleHRVc2FnZSh1c2FnZVNuYXBzaG90KFtcblx0XHRcdHVzYWdlSXRlbSgndXNhZ2UtbGF0ZXIta2V5JywgJzAwMDInLCB7IGtpbmQ6ICd1c2FnZScsIHRpdGxlOiAnbGF0ZXInLCBjb250ZXh0UGN0OiAyMCwgaW5wdXRUb2tlbnM6IDMgfSksXG5cdFx0XHR1c2FnZUl0ZW0oJ3VzYWdlLWVhcmxpZXIta2V5JywgJzAwMDEnLCB7IGtpbmQ6ICd1c2FnZScsIHRpdGxlOiAnZWFybGllcicsIGNvbnRleHRQY3Q6IDkwLCBvdXRwdXRUb2tlbnM6IDggfSksXG5cdFx0XSkpLCB7IGNvbnRleHRQY3Q6IDIwLCBpbnB1dFRva2VuczogMyB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXRlc3RBZG1pdHRlZEluYm94Q29udGV4dFVzYWdlKHVzYWdlU25hcHNob3QoW1xuXHRcdFx0dXNhZ2VJdGVtKCd1c2FnZS1vbGQnLCAnMDAwMScsIHsga2luZDogJ3VzYWdlJywgdGl0bGU6ICdvbGQnLCBjb250ZXh0UGN0OiA5MCB9KSxcblx0XHRcdHVzYWdlSXRlbSgndXNhZ2UtbmV3JywgJzAwMDInLCB7IGtpbmQ6ICd1c2FnZScsIHRpdGxlOiAnbmV3Jywgb3V0cHV0VG9rZW5zOiAxIH0pLFxuXHRcdF0pKSwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGF0ZXN0QWRtaXR0ZWRJbmJveENvbnRleHRVc2FnZSh1c2FnZVNuYXBzaG90KFtcblx0XHRcdHVzYWdlSXRlbSgndXNhZ2UtemVybycsICcwMDAxJywgeyBraW5kOiAndXNhZ2UnLCB0aXRsZTogJ3plcm8nLCBjb250ZXh0UGN0OiAwLCBvdXRwdXRUb2tlbnM6IDAsIGlucHV0VG9rZW5zOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkgfSksXG5cdFx0XSkpLCB7IGNvbnRleHRQY3Q6IDAsIG91dHB1dFRva2VuczogMCB9KTtcblxuXHRcdGNvbnN0IGdldHRlclN1bW1hcnkgPSB7IGtpbmQ6ICd1c2FnZScgYXMgY29uc3QsIHRpdGxlOiAnZ2V0dGVyJyB9O1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShnZXR0ZXJTdW1tYXJ5LCAnY29udGV4dFBjdCcsIHsgZ2V0OiAoKSA9PiA0MCwgZW51bWVyYWJsZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGF0ZXN0QWRtaXR0ZWRJbmJveENvbnRleHRVc2FnZSh1c2FnZVNuYXBzaG90KFtcblx0XHRcdHVzYWdlSXRlbSgndXNhZ2Utb3duZWQnLCAnMDAwMScsIHsga2luZDogJ3VzYWdlJywgdGl0bGU6ICdvd25lZCcsIGNvbnRleHRQY3Q6IDEwIH0pLFxuXHRcdFx0eyBpZDogJ3VzYWdlLWdldHRlcicgYXMgVGltZWxpbmVJdGVtSWQsIG9yZGVyS2V5OiAnMDAwMicsIHN1bW1hcnk6IGdldHRlclN1bW1hcnkgfSxcblx0XHRdKSksIHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCBpbmhlcml0ZWQgPSBPYmplY3QuYXNzaWduKE9iamVjdC5jcmVhdGUoeyBjb250ZXh0UGN0OiA0MCB9KSwgeyBraW5kOiAndXNhZ2UnLCB0aXRsZTogJ2luaGVyaXRlZCcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhdGVzdEFkbWl0dGVkSW5ib3hDb250ZXh0VXNhZ2UodXNhZ2VTbmFwc2hvdChbXG5cdFx0XHR7IGlkOiAndXNhZ2UtaW5oZXJpdGVkJyBhcyBUaW1lbGluZUl0ZW1JZCwgb3JkZXJLZXk6ICcwMDAxJywgc3VtbWFyeTogaW5oZXJpdGVkIH0sXG5cdFx0XSkpLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmJveCBjb250ZXh0IHJpbmcgZm9sbG93cyB0aGUgbGVhc2Ugc25hcHNob3QgYW5kIHN0YXlzIG9mZiB0aGUgY29udmVyc2F0aW9uIHRpbWVsaW5lJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucywgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRhd2FpdCBzZW5kRG9ja0RyYWZ0KHNsb3RzLCAnQWN0aXZhdGUgaW5ib3ggZm9yIGNvbnRleHQgcmluZycpO1xuXHRcdGNvbnN0IHJpZ2h0ID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2x1c3RlciA9IGdldEluYm94T3ZlcmxheShzbG90cykucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LXJpZ2h0Jyk7XG5cdFx0XHRhc3NlcnQub2soY2x1c3Rlcik7XG5cdFx0XHRyZXR1cm4gY2x1c3Rlcjtcblx0XHR9O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyaWdodCgpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1jb250ZXh0LXJpbmcnKSwgbnVsbCk7XG5cblx0XHRjb25zdCBhZG1pdHRlZCA9IHVzYWdlU25hcHNob3QoW1xuXHRcdFx0dXNhZ2VJdGVtKCd1c2FnZS1vbGQnLCAnMDAwMScsIHsga2luZDogJ3VzYWdlJywgdGl0bGU6ICdvbGQnLCBjb250ZXh0UGN0OiAxMCB9KSxcblx0XHRcdHVzYWdlSXRlbSgndXNhZ2UtbGF0ZXN0JywgJzAwMDInLCB7IGtpbmQ6ICd1c2FnZScsIHRpdGxlOiAnbGF0ZXN0JywgY29udGV4dFBjdDogNTAsIGlucHV0VG9rZW5zOiAxMiwgb3V0cHV0VG9rZW5zOiAzNCB9KSxcblx0XHRdKTtcblx0XHRjb25zdCBwcmV2aW91cyA9IGxlbnMuc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRsZW5zLnNlc3Npb25WaWV3TGVhc2UgPSB7IHNuYXBzaG90OiBhZG1pdHRlZCB9IGFzIE5vbk51bGxhYmxlPENvbnZlcnNhdGlvbkxlbnNbJ3Nlc3Npb25WaWV3TGVhc2UnXT47XG5cdFx0bGVucy5yZW5kZXJJbmJveFN0YXR1cygpO1xuXHRcdGNvbnN0IHJpbmcgPSByaWdodCgpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1jb250ZXh0LXJpbmcnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHJpbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyaW5nLmdldEF0dHJpYnV0ZSgnZGF0YS1jb250ZXh0LXBjdCcpLCAnNTAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmluZy5zdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCctLWNvbnZlcnNhdGlvbi1pbmJveC1jb250ZXh0LXBjdCcpLCAnNTAnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmluZy50aXRsZSwgJ0NvbnRleHQ6IDUwIFx1MDBCNyBJbnB1dCB0b2tlbnM6IDEyIFx1MDBCNyBPdXRwdXQgdG9rZW5zOiAzNCcpO1xuXHRcdGFzc2VydC5vayhyaWdodCgpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1zdG9wJykpO1xuXHRcdGFzc2VydC5vayghcHJvamVjdFNuYXBzaG90VG9FbnRyaWVzKGFkbWl0dGVkLCBuZXcgTWFwKCksIG5ldyBNYXAoKSkuc29tZShlbnRyeSA9PiBlbnRyeS5pZCA9PT0gJ3VzYWdlLWxhdGVzdCcgfHwgZW50cnkuaWQgPT09ICd1c2FnZS1vbGQnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJ1tkYXRhLWtpbmQ9XCJ1c2FnZVwiXScpLCBudWxsKTtcblxuXHRcdGxlbnMuc2Vzc2lvblZpZXdMZWFzZSA9IHsgc25hcHNob3Q6IHVzYWdlU25hcHNob3QoW1xuXHRcdFx0dXNhZ2VJdGVtKCd1c2FnZS1zdGFsZScsICcwMDAxJywgeyBraW5kOiAndXNhZ2UnLCB0aXRsZTogJ3N0YWxlJywgY29udGV4dFBjdDogODAgfSksXG5cdFx0XHR1c2FnZUl0ZW0oJ3VzYWdlLWJhcmUnLCAnMDAwMicsIHsga2luZDogJ3VzYWdlJywgdGl0bGU6ICdiYXJlJyB9KSxcblx0XHRdKSB9IGFzIE5vbk51bGxhYmxlPENvbnZlcnNhdGlvbkxlbnNbJ3Nlc3Npb25WaWV3TGVhc2UnXT47XG5cdFx0bGVucy5yZW5kZXJJbmJveFN0YXR1cygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyaWdodCgpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1jb250ZXh0LXJpbmcnKSwgbnVsbCk7XG5cblx0XHRsZW5zLnNlc3Npb25WaWV3TGVhc2UgPSBwcmV2aW91cztcblx0XHRsZW5zLnJlbmRlckluYm94U3RhdHVzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJpZ2h0KCkucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LWNvbnRleHQtcmluZycpLCBudWxsKTtcblxuXHRcdGxlbnMuc2Vzc2lvblZpZXdMZWFzZSA9IHsgc25hcHNob3Q6IGFkbWl0dGVkIH0gYXMgTm9uTnVsbGFibGU8Q29udmVyc2F0aW9uTGVuc1snc2Vzc2lvblZpZXdMZWFzZSddPjtcblx0XHRsZW5zLnJlbmRlckluYm94U3RhdHVzKCk7XG5cdFx0YXNzZXJ0Lm9rKHJpZ2h0KCkucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LWNvbnRleHQtcmluZycpKTtcblx0XHRsZW5zLnJlbGVhc2VTZXNzaW9uVmlld0xlYXNlRm9ySGlkZGVuTGVhZigpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJpZ2h0KCkucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LWNvbnRleHQtcmluZycpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnaW5ib3ggcXVldWUgbGlzdCBvcGVucyB3aXRob3V0IGEgVGFzayBjaGlwIG9yIHRhc2sgbGlzdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ09wZW4gaW5ib3ggbGlzdHMnKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldEluYm94T3ZlcmxheShzbG90cykucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LXRhc2snKSwgbnVsbCk7XG5cdFx0Z2V0SW5ib3hRdWV1ZUNoaXAoc2xvdHMpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFZpc2libGVJbmJveExpc3RQYW5lbCgpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0SW5ib3hRdWV1ZUNoaXAoc2xvdHMpLmdldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJyksICdmYWxzZScpO1xuXG5cdFx0c3R1YlNlcnZpY2Uuc2V0TWVzc2FnZVF1ZXVlRml4dHVyZShzZXNzaW9uSWQsIHtcblx0XHRcdGlzUGF1c2VkOiBmYWxzZSxcblx0XHRcdGlzUHJvY2Vzc2luZzogZmFsc2UsXG5cdFx0XHRpdGVtczogW3tcblx0XHRcdFx0aWQ6ICdxLW9wZW4nLFxuXHRcdFx0XHRjb250ZW50OiAnUXVldWVkIGZvbGxvdy11cCcsXG5cdFx0XHRcdHN0YXR1czogJ1BFTkRJTkcnLFxuXHRcdFx0XHRob2xkOiB1bmRlZmluZWQsXG5cdFx0XHRcdHVwbG9hZFByb2dyZXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdHJldHJ5Q291bnQ6IDAsXG5cdFx0XHRcdGxhc3RFcnJvcjogdW5kZWZpbmVkLFxuXHRcdFx0XHRsb2NrZWQ6IGZhbHNlLFxuXHRcdFx0XHRwaW5uZWQ6IGZhbHNlLFxuXHRcdFx0fV0sXG5cdFx0fSk7XG5cdFx0Z2V0SW5ib3hRdWV1ZUNoaXAoc2xvdHMpLmNsaWNrKCk7XG5cdFx0Y29uc3QgcXVldWVQYW5lbCA9IGdldFZpc2libGVJbmJveExpc3RQYW5lbCgpO1xuXHRcdGFzc2VydC5vayhxdWV1ZVBhbmVsPy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtbWVzc2FnZS1xdWV1ZS1saXN0JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWV1ZVBhbmVsPy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtdGFzay1saXN0JyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRJbmJveFF1ZXVlQ2hpcChzbG90cykuZ2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnKSwgJ3RydWUnKTtcblx0fSk7XG5cblx0dGVzdCgnbWVzc2FnZSBxdWV1ZSBmaXh0dXJlIHJlbmRlcnMgU2luZ3VsYXJpdHkgcXVldWUgcm93cyB3aXRoIGhvbGQgdGFnJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRhd2FpdCBzZW5kRG9ja0RyYWZ0KHNsb3RzLCAnUXVldWUgZml4dHVyZScpO1xuXHRcdGF3YWl0IGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cdFx0c3R1YlNlcnZpY2Uuc2V0TWVzc2FnZVF1ZXVlRml4dHVyZShzZXNzaW9uSWQsIHtcblx0XHRcdGlzUGF1c2VkOiBmYWxzZSxcblx0XHRcdGlzUHJvY2Vzc2luZzogZmFsc2UsXG5cdFx0XHRpdGVtczogW3tcblx0XHRcdFx0aWQ6ICdxMScsXG5cdFx0XHRcdGNvbnRlbnQ6ICdGb2xsb3cgdXAgYWZ0ZXIgZGVwbG95Jyxcblx0XHRcdFx0c3RhdHVzOiAnUEVORElORycsXG5cdFx0XHRcdGhvbGQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0dXBsb2FkUHJvZ3Jlc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0cmV0cnlDb3VudDogMCxcblx0XHRcdFx0bGFzdEVycm9yOiB1bmRlZmluZWQsXG5cdFx0XHRcdGxvY2tlZDogZmFsc2UsXG5cdFx0XHRcdHBpbm5lZDogZmFsc2UsXG5cdFx0XHR9XSxcblx0XHR9KTtcblxuXHRcdGdldEluYm94UXVldWVDaGlwKHNsb3RzKS5jbGljaygpO1xuXHRcdGNvbnN0IHBhbmVsID0gZ2V0VmlzaWJsZUluYm94TGlzdFBhbmVsKCkhO1xuXHRcdGNvbnN0IHJvdyA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5xdWV1ZS1pdGVtW2RhdGEtaXRlbS1pZD1cInExXCJdJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0Lm9rKHJvdyk7XG5cdFx0YXNzZXJ0Lm9rKHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5xdWV1ZS1iYXItc3VtbWFyeScpPy50ZXh0Q29udGVudD8uaW5jbHVkZXMoJzEnKSk7XG5cdFx0YXNzZXJ0Lm9rKHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy5xdWV1ZS1iYXItYWN0aW9uJyk/LnRleHRDb250ZW50Py5pbmNsdWRlcyhjb252ZXJzYXRpb25MZW5zSW5ib3hRdWV1ZVBhdXNlKSk7XG5cblx0XHRyb3cuY2xpY2soKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0TWVzc2FnZVF1ZXVlU3RhdGUoc2Vzc2lvbklkKS5pdGVtc1swXT8uaG9sZCwgJ0VESVRJTkcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0VmlzaWJsZUluYm94TGlzdFBhbmVsKCksIG51bGwpO1xuXG5cdFx0Z2V0SW5ib3hRdWV1ZUNoaXAoc2xvdHMpLmNsaWNrKCk7XG5cdFx0Y29uc3QgaGVsZFJvdyA9IGdldFZpc2libGVJbmJveExpc3RQYW5lbCgpPy5xdWVyeVNlbGVjdG9yKCcucXVldWUtaXRlbS5ob2xkLWVkaXRpbmdbZGF0YS1pdGVtLWlkPVwicTFcIl0nKTtcblx0XHRhc3NlcnQub2soaGVsZFJvdyk7XG5cdFx0YXNzZXJ0Lm9rKGhlbGRSb3c/LnF1ZXJ5U2VsZWN0b3IoJy5xdWV1ZS1pdGVtLW1ldGEgLnRhZy5ob2xkJyk/LnRleHRDb250ZW50Py5pbmNsdWRlcyhjb252ZXJzYXRpb25MZW5zSW5ib3hRdWV1ZUVkaXRpbmdUYWcpKTtcblx0fSk7XG5cblx0dGVzdCgnaW5ib3ggZ29hbCBpcyBob25lc3Q6IGRpc2FibGVkIHdpdGhvdXQgZW5naW5lLCBubyBnb2FsIGZpZWxkJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgZ29hbEJ1dHRvbiA9IGdldEluYm94R29hbEJ1dHRvbihzbG90cyk7XG5cblx0XHRhc3NlcnQub2soZ29hbEJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2Rpc2FibGVkJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnb2FsQnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnb2FsQnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCBgJHtjb252ZXJzYXRpb25MZW5zRG9ja0dvYWx9IFx1MjAxNCAke2NvbnZlcnNhdGlvbkxlbnNEb2NrR29hbFVuYXZhaWxhYmxlfWApO1xuXHRcdGFzc2VydC5vayhnb2FsQnV0dG9uLnF1ZXJ5U2VsZWN0b3IoJy5jb2RpY29uLXRhcmdldCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ29hbEJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2RhdGEtZ29hbC1lbXB0eScpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5vayghZ29hbEJ1dHRvbi50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc0RvY2tOb0dvYWwpKTtcblxuXHRcdGdvYWxCdXR0b24uY2xpY2soKTtcblx0XHRhc3NlcnQub2soZ29hbEJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2Rpc2FibGVkJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmJveCBzdG9wIGlzIGhvbmVzdDogZGlzYWJsZWQgd2l0aG91dCBlbmdpbmUsIG5vIHN0b3BMb29wIHNpZGUgZWZmZWN0cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ0FjdGl2YXRlIGluYm94IGNocm9tZScpO1xuXHRcdGNvbnN0IG92ZXJsYXkgPSBnZXRJbmJveE92ZXJsYXkoc2xvdHMpO1xuXHRcdGNvbnN0IHN0b3BCdXR0b24gPSBnZXRJbmJveFN0b3BCdXR0b24oc2xvdHMpO1xuXHRcdGNvbnN0IHR1cm5Db3VudEJlZm9yZSA9IHF1ZXJ5QWxsVGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybicpLmxlbmd0aDtcblx0XHRjb25zdCBwZW5kaW5nQnV0dG9uID0gb3ZlcmxheS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtcGVuZGluZycpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXG5cdFx0YXNzZXJ0Lm9rKHN0b3BCdXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdkaXNhYmxlZCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RvcEJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RvcEJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgYCR7Y29udmVyc2F0aW9uTGVuc0RvY2tTdG9wfSwgJHtjb252ZXJzYXRpb25MZW5zRG9ja1N0b3BOb3RHZW5lcmF0aW5nfWApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdG9wQnV0dG9uLnRleHRDb250ZW50Py50cmltKCksIGNvbnZlcnNhdGlvbkxlbnNEb2NrU3RvcCk7XG5cblx0XHRzdG9wQnV0dG9uLmNsaWNrKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlBbGxUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuJykubGVuZ3RoLCB0dXJuQ291bnRCZWZvcmUpO1xuXHRcdGFzc2VydC5vayhnZXRJbmJveFF1ZXVlQ2hpcChzbG90cykudGV4dENvbnRlbnQ/LmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNEb2NrSW5ib3hOb1F1ZXVlKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlbmRpbmdCdXR0b24uaGlkZGVuLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0VHVybnMoc2Vzc2lvbklkKS5sZW5ndGgsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdob25lc3QgZG9jayBnYXRlIGFuZCBtb2RlbCBsYWJlbHMgd2l0aG91dCBDb3BpbG90IENUQXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0IH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBnYXRlUm93ID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1nYXRlLXJvdycpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IGlkZW50aXR5RW5naW5lID0gZ2V0UmVhZGluZ0NvbHVtbihzbG90cykucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1pZGVudGl0eS1jaGlwLWVuZ2luZScpO1xuXHRcdGNvbnN0IG1vZGVsU2VsZWN0ID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb2RlbCBzZWxlY3QubW9uYWNvLXNlbGVjdC1ib3gnKSBhcyBIVE1MU2VsZWN0RWxlbWVudDtcblx0XHRjb25zdCBzZW5kQnV0dG9uID0gZ2V0RG9ja1NlbmRCdXR0b24oc2xvdHMpO1xuXG5cdFx0YXNzZXJ0Lm9rKGdhdGVSb3cuaGlkZGVuKTtcblx0XHRhc3NlcnQub2soaWRlbnRpdHlFbmdpbmU/LnRleHRDb250ZW50Py5pbmNsdWRlcyhjb252ZXJzYXRpb25MZW5zRG9ja0VuZ2luZU5vdENvbm5lY3RlZCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbFNlbGVjdC5vcHRpb25zW21vZGVsU2VsZWN0LnNlbGVjdGVkSW5kZXhdPy50ZXh0LCBjb252ZXJzYXRpb25MZW5zRG9ja05vTW9kZWwpO1xuXHRcdGFzc2VydERpc2Nvbm5lY3RlZENvbXBvc2VyQ2F0YWxvZ3NIb25lc3Qoc2xvdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZW5kQnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCAnU2VuZCcpO1xuXHRcdGFzc2VydC5vayhzZW5kQnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnY29kaWNvbi1hcnJvdy11cCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY2hhdC1zZXR1cCcpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcubW9uYWNvLWJ1dHRvblthcmlhLWxhYmVsKj1cIlNpZ24gaW5cIl0nKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Nvbm5lY3RlZCBkb2NrIGhpZGVzIGdhdGUsIHNlbmRzIHdpdGhvdXQgc3R1YiBtb2RlbCwgYW5kIGZpbGxzIGNhdGFsb2cgbGFiZWxzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNhcGFiaWxpdGllcyA9IGNyZWF0ZUVtcHR5VGVzdENhcGFiaWxpdHlTbmFwc2hvdCgpO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoe1xuXHRcdFx0Z2V0Q2FwYWJpbGl0eVNuYXBzaG90OiAoKSA9PiAoe1xuXHRcdFx0XHQuLi5jYXBhYmlsaXRpZXMsXG5cdFx0XHRcdGFnZW50UHJvZmlsZXM6IHsgc3VwcG9ydDogJ1NVUFBPUlRFRCcgfSxcblx0XHRcdFx0dG9vbHM6IHsgc3VwcG9ydDogJ1NVUFBPUlRFRCcgfSxcblx0XHRcdFx0bW9kZWxzOiB7IHN1cHBvcnQ6ICdTVVBQT1JURUQnIH0sXG5cdFx0XHR9KSxcblx0XHRcdGxpc3RBZ2VudFByb2ZpbGVzOiBhc3luYyAoKSA9PiAoeyBwcm9maWxlczogW3sgaWQ6ICdjb2RlcicsIG5hbWU6ICdDb2RlcicsIHNvdXJjZTogJ3VzZXInIH1dIH0pLFxuXHRcdFx0bGlzdFRvb2xzOiBhc3luYyAoKSA9PiAoeyB0b29sczogW3sgbmFtZTogJ2Jhc2gnIH1dIH0pLFxuXHRcdFx0bGlzdE1vZGVsczogYXN5bmMgKCkgPT4gKHsgbW9kZWxzOiBbeyBpZDogJzEnLCB0eXBlOiAnY2hhdCcsIGVuYWJsZWQ6IHRydWUsIGxldmVsOiAxLCBwcm92aWRlcjogJ3AnLCBtb2RlbElkOiAnZ3B0LXRlc3QnIH1dIH0pLFxuXHRcdH0pO1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucyh7IGNvbm5lY3Rpb24gfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKHRydWUpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgODsgaSsrKSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cblx0XHRjb25zdCBnYXRlUm93ID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1nYXRlLXJvdycpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnYXRlUm93LmhpZGRlbiwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVSb3cudGV4dENvbnRlbnQsICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2F0ZVJvdy5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFBlcm1pc3Npb25TZWxlY3Qoc2xvdHMpLmRpc2FibGVkLCB0cnVlKTtcblxuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICdoZWxsbyBlbmdpbmUnO1xuXHRcdHRleHRhcmVhLmRpc3BhdGNoRXZlbnQobmV3IGdsb2JhbFRoaXMuRXZlbnQoJ2lucHV0JywgeyBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRjb25zdCBzZW5kQnV0dG9uID0gZ2V0RG9ja1NlbmRCdXR0b24oc2xvdHMpO1xuXHRcdGFzc2VydC5vayghc2VuZEJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2Rpc2FibGVkJyksICdjb25uZWN0ZWQgc2VuZCBtdXN0IG5vdCByZXF1aXJlIFN0dWIgbW9kZWwnKTtcblxuXHRcdGNvbnN0IGFnZW50Q29udGFpbmVyID0gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWFnZW50JykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdCcpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0QWdlbnRSZWFkb25seUxhYmVsKHNsb3RzKS50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc0RvY2tFbmdpbmVDYXBhYmlsaXR5VW5zdXBwb3J0ZWQpO1xuXG5cdFx0Y29uc3QgdHVuZUJ1dHRvbiA9IGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0dHVuZUJ1dHRvbi5jbGljaygpO1xuXHRcdGNvbnN0IHBvcHVwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpO1xuXHRcdGFzc2VydC5vayhwb3B1cD8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdiYXNoJykpO1xuXHRcdGFzc2VydC5vayghcG9wdXA/LnRleHRDb250ZW50Py5pbmNsdWRlcyhjb252ZXJzYXRpb25MZW5zRG9ja05vVG9vbHMpKTtcblx0fSk7XG5cblx0dGVzdCgnY29ubmVjdGVkIGNhdGFsb2cgUlBDIHRocm93cyBrZWVwIE5vIGFnZW50IC8gTm8gbW9kZWwgLyBlbXB0eSB0b29scycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjYXBhYmlsaXRpZXMgPSBjcmVhdGVFbXB0eVRlc3RDYXBhYmlsaXR5U25hcHNob3QoKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGdldENhcGFiaWxpdHlTbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Li4uY2FwYWJpbGl0aWVzLFxuXHRcdFx0XHRhZ2VudFByb2ZpbGVzOiB7IHN1cHBvcnQ6ICdTVVBQT1JURUQnIH0sXG5cdFx0XHRcdHRvb2xzOiB7IHN1cHBvcnQ6ICdTVVBQT1JURUQnIH0sXG5cdFx0XHRcdG1vZGVsczogeyBzdXBwb3J0OiAnU1VQUE9SVEVEJyB9LFxuXHRcdFx0fSksXG5cdFx0XHRsaXN0QWdlbnRQcm9maWxlczogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2xpc3RBZ2VudFByb2ZpbGVzIGV4cGxvZGVkJyk7XG5cdFx0XHR9LFxuXHRcdFx0bGlzdFRvb2xzOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignbGlzdFRvb2xzIGV4cGxvZGVkJyk7XG5cdFx0XHR9LFxuXHRcdFx0bGlzdE1vZGVsczogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2xpc3RNb2RlbHMgZXhwbG9kZWQnKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSB9ID0gbW91bnRMZW5zKHsgY29ubmVjdGlvbiB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRzdHViU2VydmljZS5zZXRFbmdpbmVDb25uZWN0ZWQodHJ1ZSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA4OyBpKyspIHtcblx0XHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFnZW50Q29udGFpbmVyID0gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWFnZW50JykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFnZW50Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdCcpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0QWdlbnRSZWFkb25seUxhYmVsKHNsb3RzKS50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc0RvY2tFbmdpbmVDYXBhYmlsaXR5VW5zdXBwb3J0ZWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldE1vZGVsU2VsZWN0KHNsb3RzKS5vcHRpb25zW2dldE1vZGVsU2VsZWN0KHNsb3RzKS5zZWxlY3RlZEluZGV4XT8udGV4dCwgY29udmVyc2F0aW9uTGVuc0RvY2tOb01vZGVsKTtcblx0XHRhc3NlcnQub2soIVsuLi5nZXRNb2RlbFNlbGVjdChzbG90cykub3B0aW9uc10uc29tZShvcHRpb24gPT4gb3B0aW9uLnRleHQgPT09ICdncHQtdGVzdCcpKTtcblx0XHRhc3NlcnQub2soIVsuLi5nZXRNb2RlbFNlbGVjdChzbG90cykub3B0aW9uc10uc29tZShvcHRpb24gPT4gb3B0aW9uLnRleHQgPT09ICdTdHViIG1vZGVsJykpO1xuXG5cdFx0Y29uc3QgdHVuZUJ1dHRvbiA9IGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0dHVuZUJ1dHRvbi5jbGljaygpO1xuXHRcdGNvbnN0IHBvcHVwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwb3B1cD8udGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9FbmdpbmVUb29scyk7XG5cdFx0YXNzZXJ0Lm9rKCFwb3B1cD8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdiYXNoJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0ZWQgRW50ZXIgc3VibWl0cyBkcmFmdCB0aHJvdWdoIGxlYXNlLnBvc3Qoc3VibWl0SW5wdXQpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRzdHViU2VydmljZS5zZXRFbmdpbmVDb25uZWN0ZWQodHJ1ZSk7XG5cblx0XHRjb25zdCB0ZXh0YXJlYSA9IGdldERvY2tUZXh0YXJlYShzbG90cyk7XG5cdFx0dGV4dGFyZWEudmFsdWUgPSAnaGVsbG8gZW5naW5lJztcblx0XHRkaXNwYXRjaERvY2tLZXlkb3duKHRleHRhcmVhLCBLZXlDb2RlLkVudGVyKTtcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCAnJyk7XG5cdFx0Y29uc3QgdXNlclR1cm4gPSBzdHViU2VydmljZS5nZXRUdXJucyhzZXNzaW9uSWQpLmZpbmQodHVybiA9PiB0dXJuLmtpbmQgPT09ICd1c2VyJyAmJiB0dXJuLnRleHQgPT09ICdoZWxsbyBlbmdpbmUnKTtcblx0XHRhc3NlcnQub2sodXNlclR1cm4sICdzdWJtaXRJbnB1dCBtdXN0IHJlYWNoIHRoZSBzZXNzaW9uIHZpZXcgbGVhc2Ugd2hlbiBjb25uZWN0ZWQnKTtcblx0fSk7XG5cblx0dGVzdCgnZG9jayBpbnB1dCBleHBvc2VzIHN0YWJsZSBhdXRvbWF0aW9uIHRlc3QgaWRzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldERvY2tUZXh0YXJlYShzbG90cykuZ2V0QXR0cmlidXRlKCdkYXRhLXRlc3RpZCcpLCAnY29udmVyc2F0aW9uLWNvbXBvc2VyLWlucHV0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldERvY2tTZW5kQnV0dG9uKHNsb3RzKS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGVzdGlkJyksICdjb252ZXJzYXRpb24tY29tcG9zZXItc2VuZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2NrIGlucHV0IHBsYWNlaG9sZGVyIGlzIHByb2R1Y3QgTWVzc2FnZSBjb3B5LCBub3QgQXNrIGFueXRoaW5nJywgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb252ZXJzYXRpb25MZW5zRG9ja1BsYWNlaG9sZGVyLCAnTWVzc2FnZScpO1xuXHRcdGFzc2VydC5vayghY29udmVyc2F0aW9uTGVuc0RvY2tQbGFjZWhvbGRlci50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdhc2sgYW55dGhpbmcnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFjb252ZXJzYXRpb25MZW5zRG9ja1BsYWNlaG9sZGVyLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ2NvcGlsb3QnKSk7XG5cblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0TGVuc1Nsb3RzKHBhcnQpLmRvY2sucXVlcnlTZWxlY3RvcigndGV4dGFyZWEuY29udmVyc2F0aW9uLWxlbnMtZG9jay1pbnB1dCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnBsYWNlaG9sZGVyLCBjb252ZXJzYXRpb25MZW5zRG9ja1BsYWNlaG9sZGVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksICdNZXNzYWdlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FkZCBjb250ZXh0IGxpc3RzIHRoZSBzZXNzaW9uIGFuZCB0b29scyBzdGF5cyBhIHNlcGFyYXRlIGJ1dHRvbicsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkuZmluZChpdGVtID0+IGl0ZW0uaWQgPT09IHNlc3Npb25JZCk7XG5cdFx0YXNzZXJ0Lm9rKHNlc3Npb24pO1xuXHRcdGNvbnN0IGJvdHRvbUJhciA9IGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKTtcblx0XHRjb25zdCBhZGRCdXR0b24gPSBib3R0b21CYXIucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stYWRkIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFkZEJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgY29udmVyc2F0aW9uTGVuc0RvY2tBZGRUaXRsZSk7XG5cdFx0YXNzZXJ0Lm9rKGJvdHRvbUJhci5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10dW5lIC5jb2RpY29uLXRvb2xzJykpO1xuXHRcdGFkZEJ1dHRvbi5jbGljaygpO1xuXHRcdGNvbnN0IHBvcHVwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stYWRkLXBvcHVwJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayhwb3B1cCk7XG5cdFx0Y29uc3Qgb3B0aW9uID0gWy4uLnBvcHVwLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWFkZC1vcHRpb24nKV0uZmluZChpdGVtID0+IGl0ZW0udGV4dENvbnRlbnQgPT09IHNlc3Npb24udGl0bGUpO1xuXHRcdGFzc2VydC5vayhvcHRpb24pO1xuXHRcdChvcHRpb24gYXMgSFRNTEJ1dHRvbkVsZW1lbnQpLmNsaWNrKCk7XG5cdFx0YXNzZXJ0Lm9rKGJvdHRvbUJhci5wYXJlbnRFbGVtZW50IS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWNvbXBvc2VyLXJlZi1jaGlwJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1hdHRhY2htZW50LWxpc3QnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jaGF0LWF0dGFjaG1lbnRzLWNvbnRhaW5lcicpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnZG9jayB0dW5lIHBvcHVwIGlzIGhvbmVzdCBhbmQgVGVtcGxhdGVzIGNocm9tZSBpcyBnb25lJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgdHVuZUJ1dHRvbiA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZSAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR1bmVCdXR0b24uZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNEb2NrVHVuZVRpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay10ZW1wbGF0ZXMnKSwgbnVsbCk7XG5cblx0XHR0dW5lQnV0dG9uLmNsaWNrKCk7XG5cdFx0Y29uc3QgdHVuZVBvcHVwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stdHVuZS1wb3B1cCcpO1xuXHRcdGFzc2VydC5vayh0dW5lUG9wdXApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0dW5lUG9wdXAudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9Ub29scyk7XG5cdFx0dHVuZUJ1dHRvbi5jbGljaygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLXRlbXBsYXRlcy1wb3B1cCcpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgc2Vzc2lvbiBzaG93cyB0aW1lbGluZSBlbXB0eSBzdGF0ZSB3aXRob3V0IHNlbmQtYmVsb3cgaGludCcsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBlbXB0eVNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIGVtcHR5U2Vzc2lvbklkKTtcblx0XHRjb25zdCBlbXB0eSA9IGdldFRpbWVsaW5lRW1wdHkoc2xvdHMpO1xuXHRcdGFzc2VydC5vayhlbXB0eSk7XG5cdFx0YXNzZXJ0Lm9rKGVtcHR5LnRleHRDb250ZW50Py5pbmNsdWRlcygnTm8gbWVzc2FnZXMgeWV0JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbXB0eS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdGltZWxpbmUtZW1wdHktaGludCcpLCBudWxsKTtcblx0XHRhc3NlcnQub2soIWVtcHR5LnRleHRDb250ZW50Py50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzZW5kIGEgbWVzc2FnZSBiZWxvdycpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0VHVybnMoZW1wdHlTZXNzaW9uSWQpLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbmRlcnMgY29uZmlybWF0aW9uIGFzIGEgdGltZWxpbmUgbGlzdCBpdGVtIHdpdGggQWxsb3cgYW5kIFNraXAnLCBhc3luYyAoKSA9PiB7XG5cdFx0Ly8gVGFsbGVyIHRoYW4gdGhlIHN1aXRlIGRlZmF1bHQ6IHRoaXMgdGVzdCBhc3NlcnRzIG9uIHZpcnR1YWxpemVkIHJvd3MsIGFuZFxuXHRcdC8vIGhvdyBtYW55IGZpdCBkZXBlbmRzIG9uIGZvbnQgbWV0cmljcywgd2hpY2ggZGlmZmVyIGFjcm9zcyBtYWNoaW5lcy5cblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoeyBsYXlvdXRIZWlnaHQ6IDEyMDAgfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0YXdhaXQgc2VlZFBlbmRpbmdDb25maXJtYXRpb24oc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGNvbnN0IHNlYXQgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLWNvbmZpcm1hdGlvbi1zZWF0Jyk7XG5cdFx0YXNzZXJ0Lm9rKHNlYXQpO1xuXHRcdGFzc2VydC5vayhzZWF0LnRleHRDb250ZW50Py5pbmNsdWRlcygnY29uZmlybWF0aW9uIHBlbmRpbmcnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNlYXQudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdJbnB1dCBuZWVkZWQnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNlYXQudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdXcml0ZSBSRUFETUUubWQ/JykpO1xuXHRcdGNvbnN0IGJ1dHRvbnMgPSBbLi4uc2VhdC5xdWVyeVNlbGVjdG9yQWxsKCdidXR0b24sIC5tb25hY28tYnV0dG9uJyldLm1hcChlbCA9PiBlbC50ZXh0Q29udGVudD8udHJpbSgpKTtcblx0XHRhc3NlcnQub2soYnV0dG9ucy5zb21lKGxhYmVsID0+IGxhYmVsID09PSAnQWxsb3cnKSk7XG5cdFx0YXNzZXJ0Lm9rKGJ1dHRvbnMuc29tZShsYWJlbCA9PiBsYWJlbCA9PT0gJ1NraXAnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5QWxsVGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybicpLmxlbmd0aCA+PSAyLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgncmVuZGVycyB1c2VyIGFuZCBhc3Npc3RhbnQgdHVybnMgd2l0aG91dCB2aXNpYmxlIFlvdSBvciBBZ2VudCBsYWJlbHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25JZCwgJ1doYXQgbGl2ZXMgaW4gdGhlIGNlbnRlciBsZW5zPycpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFN0dWJFY2hvQXNzaXN0YW50KHNlc3Npb25JZCwgJ1Nlc3Npb25CYXIsIHRpbWVsaW5lLCBhbmQgZG9jayBcdTIwMTQgbm90IENoYXRFZGl0b3IuJyk7XG5cdFx0YXdhaXQgZmx1c2hQcm9qZWN0ZWRUaW1lbGluZShsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblx0XHRjb25zdCB1c2VyVHVybiA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJ1c2VyXCJdJyk7XG5cdFx0Y29uc3QgYXNzaXN0YW50VHVybiA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJhc3Npc3RhbnRcIl0nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodXNlclR1cm4/LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLWxlbnMtdHVybi0tdXNlci1hbGlnbi1lbmQnKSwgZmFsc2UpO1xuXHRcdGNvbnN0IHVzZXJCb2R5ID0gdXNlclR1cm4/LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWJvZHknKTtcblx0XHRhc3NlcnQub2sodXNlckJvZHk/LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5LS11c2VyLWJ1YmJsZScpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodXNlckJvZHk/LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5LS1yZWFkaW5nLXRleHQnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayghdXNlclR1cm4/LnRleHRDb250ZW50Py5pbmNsdWRlcygnWW91JykpO1xuXHRcdGFzc2VydC5vayh1c2VyVHVybj8uY2xvc2VzdCgnYXJ0aWNsZScpPy5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKT8uaW5jbHVkZXMoJ1lvdScpKTtcblx0XHRhc3NlcnQub2sodXNlckJvZHkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhc3Npc3RhbnRUdXJuPy5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi1sZW5zLXR1cm4tLXVzZXItYWxpZ24tZW5kJyksIGZhbHNlKTtcblx0XHRjb25zdCBhc3Npc3RhbnRCb2R5ID0gYXNzaXN0YW50VHVybj8ucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYm9keScpO1xuXHRcdGFzc2VydC5vayhhc3Npc3RhbnRCb2R5Py5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYm9keS0tcmVhZGluZy10ZXh0JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhc3Npc3RhbnRCb2R5Py5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYm9keS0tdXNlci1idWJibGUnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhc3Npc3RhbnRUdXJuPy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHVybi1oZWFkZXInKSwgbnVsbCk7XG5cdFx0YXNzZXJ0Lm9rKCFhc3Npc3RhbnRUdXJuPy50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0FnZW50JykpO1xuXHRcdGFzc2VydC5vayhhc3Npc3RhbnRUdXJuPy5jbG9zZXN0KCdhcnRpY2xlJyk/LmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpPy5pbmNsdWRlcygnQWdlbnQnKSk7XG5cdFx0YXNzZXJ0Lm9rKGFzc2lzdGFudEJvZHkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRSZW5kZXJUdXJuQXNNYXJrZG93bignYXNzaXN0YW50JyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaG91bGRSZW5kZXJUdXJuQXNNYXJrZG93bigndXNlcicpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVzZXJCb2R5Py5jbGFzc0xpc3QuY29udGFpbnMoJ3JlbmRlcmVkLW1hcmtkb3duJyksIGZhbHNlKTtcblx0XHRhc3NlcnQub2soYXNzaXN0YW50Qm9keT8uY2xhc3NMaXN0LmNvbnRhaW5zKCdyZW5kZXJlZC1tYXJrZG93bicpKTtcblx0fSk7XG5cblx0dGVzdCgncmVuZGVycyBhc3Npc3RhbnQgdHVybnMgYXMgbWFya2Rvd24sIHVzZXIgdHVybnMgYXMgcGxhaW4gdGV4dCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0Y29uc3QgbWFya2Rvd25FY2hvID0gJyoqYm9sZCoqIHN0dWIgZWNobyc7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kU3R1YkVjaG9Bc3Npc3RhbnQoc2Vzc2lvbklkLCBtYXJrZG93bkVjaG8pO1xuXHRcdGF3YWl0IGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cblx0XHRjb25zdCBhc3Npc3RhbnRCb2R5ID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cImFzc2lzdGFudFwiXSAuY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5JykhO1xuXHRcdGNvbnN0IHVzZXJCb2R5ID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0gLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYm9keScpO1xuXG5cdFx0YXNzZXJ0Lm9rKGFzc2lzdGFudEJvZHkuY2xhc3NMaXN0LmNvbnRhaW5zKCdyZW5kZXJlZC1tYXJrZG93bicpKTtcblx0XHRhc3NlcnQub2soYXNzaXN0YW50Qm9keS5xdWVyeVNlbGVjdG9yKCdzdHJvbmcnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFzc2lzdGFudEJvZHkudGV4dENvbnRlbnQsICdib2xkIHN0dWIgZWNobycpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChhc3Npc3RhbnRCb2R5LnRleHRDb250ZW50LCBtYXJrZG93bkVjaG8pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1c2VyQm9keSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2tlZXBzIHVzZXIgdHVybiBib2R5IGFzIHBsYWluIHRleHQgd2l0aG91dCBtYXJrZG93biByZW5kZXJpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IHVzZXJNZXNzYWdlID0gJ3BsYWluICoqbm90IGJvbGQqKiB0ZXh0Jztcblx0XHRzdHViU2VydmljZS5hcHBlbmRVc2VyVHVybihzZXNzaW9uSWQsIHVzZXJNZXNzYWdlKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0Y29uc3QgdXNlckJvZHkgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm5bZGF0YS1raW5kPVwidXNlclwiXSAuY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5JykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1c2VyQm9keS50ZXh0Q29udGVudCwgdXNlck1lc3NhZ2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1c2VyQm9keS5jbGFzc0xpc3QuY29udGFpbnMoJ3JlbmRlcmVkLW1hcmtkb3duJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodXNlckJvZHkucXVlcnlTZWxlY3Rvcignc3Ryb25nJyksIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBob3N0IHRoZSBsZW5zIGFzIENoYXRFZGl0b3JJbnB1dCcsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChDb252ZXJzYXRpb25DaGF0SW5wdXQuVHlwZUlELCBDaGF0RWRpdG9ySW5wdXQuVHlwZUlEKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoQ29udmVyc2F0aW9uRWRpdG9yUGFuZS5JRCwgQ2hhdEVkaXRvcklucHV0LkVkaXRvcklEKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHBhcnQudG9KU09OKCksIHsgdHlwZTogUGFydHMuQ09OVkVSU0FUSU9OX1BBUlQgfSk7XG5cdFx0Y29uc3QgbGVuc0hvc3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRjb25zdCB0aW1lbGluZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRpbWVsaW5lLmNsYXNzTmFtZSA9ICdjb252ZXJzYXRpb24tdGltZWxpbmUnO1xuXHRcdGxlbnNIb3N0LmFwcGVuZENoaWxkKHRpbWVsaW5lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNoYXQtc2V0dXAnKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nlc3Npb24gc3dpdGNoZXIgY2hhbmdlcyB2aXNpYmxlIHRpdGxlIGFuZCB0aW1lbGluZSB0dXJucycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCB0aXRsZSA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXRpdGxlJykhO1xuXG5cdFx0Y29uc3QgZmlyc3QgPSBzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uKCk7XG5cdFx0Y29uc3Qgc2Vjb25kSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbihmaXJzdC5pZCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oZmlyc3QuaWQsICdGaXJzdCBzZXNzaW9uIG1lc3NhZ2UnKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGNvbnN0IHNlY29uZCA9IHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkuZmluZChzID0+IHMuaWQgPT09IHNlY29uZElkKSE7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vjb25kSWQsICdTZWNvbmQgc2Vzc2lvbiBtZXNzYWdlJyk7XG5cdFx0YXdhaXQgZmx1c2hQcm9qZWN0ZWRUaW1lbGluZShsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZS50ZXh0Q29udGVudCwgZmlyc3QudGl0bGUpO1xuXHRcdGFzc2VydC5vayhzbG90cy50aW1lbGluZS50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0ZpcnN0IHNlc3Npb24gbWVzc2FnZScpKTtcblxuXHRcdHN0dWJTZXJ2aWNlLnN3aXRjaFNlc3Npb24oc2Vjb25kLmlkKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlLnRleHRDb250ZW50LCBzZWNvbmQudGl0bGUpO1xuXHRcdGFzc2VydC5vayhzbG90cy50aW1lbGluZS50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ1NlY29uZCBzZXNzaW9uIG1lc3NhZ2UnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFzbG90cy50aW1lbGluZS50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0ZpcnN0IHNlc3Npb24gbWVzc2FnZScpKTtcblx0fSk7XG5cblx0dGVzdCgnc2Vzc2lvbiBzd2l0Y2hlciBzZWxlY3QgY29ubmVjdHMgYXR0YWNoQ29tcG9zZXJQaWNrZXIgYW5kIG1hcmtzIGN1cnJlbnQgc2Vzc2lvbiBjaGVja2VkJywgKCkgPT4ge1xuXHRcdGxldCBsYXN0Q29udGV4dE1lbnVEZWxlZ2F0ZTogSUNvbnRleHRNZW51RGVsZWdhdGUgfCB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgc3R1YlNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGZpcnN0SWQgPSBzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBzZWNvbmRJZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRzdHViU2VydmljZS5zd2l0Y2hTZXNzaW9uKGZpcnN0SWQpO1xuXG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zIH0gPSBtb3VudExlbnMoeyBzdHViU2VydmljZSB9KTtcblx0XHRjb25zdCBvcmlnU2hvd0NvbnRleHRNZW51ID0gbGVucy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51LmJpbmQobGVucy5jb250ZXh0TWVudVNlcnZpY2UpO1xuXHRcdGxlbnMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSA9IChkZWxlZ2F0ZTogSUNvbnRleHRNZW51RGVsZWdhdGUpID0+IHtcblx0XHRcdGxhc3RDb250ZXh0TWVudURlbGVnYXRlID0gZGVsZWdhdGU7XG5cdFx0XHRvcmlnU2hvd0NvbnRleHRNZW51KGRlbGVnYXRlKTtcblx0XHR9O1xuXG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2VsZWN0ID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tc2VsZWN0IHNlbGVjdC5tb25hY28tc2VsZWN0LWJveCcpIGFzIEhUTUxTZWxlY3RFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soc2VsZWN0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VsZWN0LmdldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcpLCAnbWVudScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICdmYWxzZScpO1xuXG5cdFx0c2VsZWN0LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ21vdXNlZG93bicsIHsgYnViYmxlczogdHJ1ZSwgY2FuY2VsYWJsZTogdHJ1ZSwgYnV0dG9uOiAwIH0pKTtcblx0XHRhc3NlcnQub2sobGFzdENvbnRleHRNZW51RGVsZWdhdGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWxlY3QuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICd0cnVlJyk7XG5cblx0XHRjb25zdCBhY3Rpb25zID0gbGFzdENvbnRleHRNZW51RGVsZWdhdGUuZ2V0QWN0aW9ucygpO1xuXHRcdGNvbnN0IHNlc3Npb25zID0gc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIHNlc3Npb25zLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGlvbnNbaV0ubGFiZWwsIHNlc3Npb25zW2ldLnRpdGxlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zW2ldLmNoZWNrZWQsIHNlc3Npb25zW2ldLmlkID09PSBmaXJzdElkKTtcblx0XHR9XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKEFycmF5LmZyb20oc2VsZWN0Lm9wdGlvbnMsIG8gPT4gby50ZXh0KSwgc2Vzc2lvbnMubWFwKHMgPT4gcy50aXRsZSkpO1xuXG5cdFx0Y29uc3QgdGFyZ2V0SW5kZXggPSBzZXNzaW9ucy5maW5kSW5kZXgocyA9PiBzLmlkID09PSBzZWNvbmRJZCk7XG5cdFx0YXNzZXJ0Lm9rKHRhcmdldEluZGV4ID49IDApO1xuXHRcdHZvaWQgYWN0aW9uc1t0YXJnZXRJbmRleF0ucnVuKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBzZWNvbmRJZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nlc3Npb24gc3dpdGNoZXIgbWVudSByZW5kZXJzIG1ldGFkYXRhIHByaW9yaXRpemluZyB0dXJuQ291bnQgb3ZlciBsYXN0QWNjZXNzZWRBdCcsICgpID0+IHtcblx0XHRsZXQgbGFzdENvbnRleHRNZW51RGVsZWdhdGU6IElDb250ZXh0TWVudURlbGVnYXRlIHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHN0dWJTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25TdHViU2VydmljZSgpKTtcblx0XHRjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuXHRcdGNvbnN0IHMxSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0Y29uc3QgczJJZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRjb25zdCBzM0lkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IHM0SWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cblx0XHRjb25zdCBzZXNzaW9ucyA9IHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCk7XG5cdFx0Y29uc3QgczEgPSBzZXNzaW9ucy5maW5kKHMgPT4gcy5pZCA9PT0gczFJZCkhO1xuXHRcdHMxLnR1cm5Db3VudCA9IDM7XG5cdFx0czEubGFzdEFjY2Vzc2VkQXQgPSBub3cgLSA2MF8wMDA7XG5cblx0XHRjb25zdCBzMiA9IHNlc3Npb25zLmZpbmQocyA9PiBzLmlkID09PSBzMklkKSE7XG5cdFx0czIudHVybkNvdW50ID0gMTtcblxuXHRcdGNvbnN0IHMzID0gc2Vzc2lvbnMuZmluZChzID0+IHMuaWQgPT09IHMzSWQpITtcblx0XHRzMy50dXJuQ291bnQgPSAwO1xuXHRcdHMzLmxhc3RBY2Nlc3NlZEF0ID0gbm93IC0gMTIwXzAwMDtcblxuXHRcdGNvbnN0IHM0ID0gc2Vzc2lvbnMuZmluZChzID0+IHMuaWQgPT09IHM0SWQpITtcblx0XHRzNC50dXJuQ291bnQgPSAwO1xuXHRcdHM0Lmxhc3RBY2Nlc3NlZEF0ID0gMDtcblxuXHRcdGNvbnN0IHsgcGFydCwgbGVucyB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2UgfSk7XG5cdFx0Y29uc3Qgb3JpZ1Nob3dDb250ZXh0TWVudSA9IGxlbnMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudS5iaW5kKGxlbnMuY29udGV4dE1lbnVTZXJ2aWNlKTtcblx0XHRsZW5zLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUgPSAoZGVsZWdhdGU6IElDb250ZXh0TWVudURlbGVnYXRlKSA9PiB7XG5cdFx0XHRsYXN0Q29udGV4dE1lbnVEZWxlZ2F0ZSA9IGRlbGVnYXRlO1xuXHRcdFx0b3JpZ1Nob3dDb250ZXh0TWVudShkZWxlZ2F0ZSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlbGVjdCA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXNlbGVjdCBzZWxlY3QubW9uYWNvLXNlbGVjdC1ib3gnKSBhcyBIVE1MU2VsZWN0RWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHNlbGVjdCk7XG5cblx0XHRzZWxlY3QuZGlzcGF0Y2hFdmVudChuZXcgTW91c2VFdmVudCgnbW91c2Vkb3duJywgeyBidWJibGVzOiB0cnVlLCBjYW5jZWxhYmxlOiB0cnVlLCBidXR0b246IDAgfSkpO1xuXHRcdGFzc2VydC5vayhsYXN0Q29udGV4dE1lbnVEZWxlZ2F0ZSk7XG5cdFx0Y29uc3QgYWN0aW9ucyA9IGxhc3RDb250ZXh0TWVudURlbGVnYXRlLmdldEFjdGlvbnMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIHNlc3Npb25zLmxlbmd0aCk7XG5cblx0XHRjb25zdCBhMSA9IGFjdGlvbnNbc2Vzc2lvbnMuaW5kZXhPZihzMSldO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhMS5sYWJlbCwgczEudGl0bGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYTEgYXMgeyBkZXRhaWw/OiBzdHJpbmcgfSkuZGV0YWlsLCAnMyBtZXNzYWdlcycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0Q29udGV4dE1lbnVEZWxlZ2F0ZS5nZXRLZXlCaW5kaW5nPy4oYTEpPy5nZXRMYWJlbCgpLCAnMyBtZXNzYWdlcycpO1xuXG5cdFx0Y29uc3QgYTIgPSBhY3Rpb25zW3Nlc3Npb25zLmluZGV4T2YoczIpXTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYTIubGFiZWwsIHMyLnRpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGEyIGFzIHsgZGV0YWlsPzogc3RyaW5nIH0pLmRldGFpbCwgJzEgbWVzc2FnZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0Q29udGV4dE1lbnVEZWxlZ2F0ZS5nZXRLZXlCaW5kaW5nPy4oYTIpPy5nZXRMYWJlbCgpLCAnMSBtZXNzYWdlJyk7XG5cblx0XHRjb25zdCBhMyA9IGFjdGlvbnNbc2Vzc2lvbnMuaW5kZXhPZihzMyldO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhMy5sYWJlbCwgczMudGl0bGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYTMgYXMgeyBkZXRhaWw/OiBzdHJpbmcgfSkuZGV0YWlsLCAnMiBtaW5zIGFnbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0Q29udGV4dE1lbnVEZWxlZ2F0ZS5nZXRLZXlCaW5kaW5nPy4oYTMpPy5nZXRMYWJlbCgpLCAnMiBtaW5zIGFnbycpO1xuXG5cdFx0Y29uc3QgYTQgPSBhY3Rpb25zW3Nlc3Npb25zLmluZGV4T2YoczQpXTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYTQubGFiZWwsIHM0LnRpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGE0IGFzIHsgZGV0YWlsPzogc3RyaW5nIH0pLmRldGFpbCwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdENvbnRleHRNZW51RGVsZWdhdGUuZ2V0S2V5QmluZGluZz8uKGE0KSwgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoQXJyYXkuZnJvbShzZWxlY3Qub3B0aW9ucywgbyA9PiBvLnRleHQpLCBzZXNzaW9ucy5tYXAocyA9PiBzLnRpdGxlKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nlc3Npb24gc3dpdGNoZXIgbGVhdmVzIG5hdGl2ZSBzZWxlY3QgYWxvbmUgd2hlbiBoYXNOYXRpdmVDb250ZXh0TWVudSBpcyB0cnVlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RDb25maWdTZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7XG5cdFx0XHR3aW5kb3c6IHtcblx0XHRcdFx0bWVudVN0eWxlOiAnbmF0aXZlJyxcblx0XHRcdFx0dGl0bGVCYXJTdHlsZTogJ25hdGl2ZScsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHRcdGxldCBjb250ZXh0TWVudU9wZW5lZCA9IGZhbHNlO1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucyB9ID0gbW91bnRMZW5zKHsgY29uZmlndXJhdGlvblNlcnZpY2U6IHRlc3RDb25maWdTZXJ2aWNlIH0pO1xuXHRcdGxlbnMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSA9ICgpID0+IHtcblx0XHRcdGNvbnRleHRNZW51T3BlbmVkID0gdHJ1ZTtcblx0XHR9O1xuXG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2VsZWN0ID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tc2VsZWN0IHNlbGVjdC5tb25hY28tc2VsZWN0LWJveCcpIGFzIEhUTUxTZWxlY3RFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soc2VsZWN0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VsZWN0LmdldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcpLCBudWxsKTtcblxuXHRcdHNlbGVjdC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KCdtb3VzZWRvd24nLCB7IGJ1YmJsZXM6IHRydWUsIGNhbmNlbGFibGU6IHRydWUsIGJ1dHRvbjogMCB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHRNZW51T3BlbmVkLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R3byBsZWF2ZXMgYm91bmQgdG8gZGlmZmVyZW50IHNlc3Npb25LZXlzIHJlbmRlciB0aGVpciBvd24gc2Vzc2lvbnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc3R1YlNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IHNlc3Npb25BID0gc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbkEsICdBbHBoYSBsZWFmIG9ubHknKTtcblx0XHRjb25zdCBzZXNzaW9uQiA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRzdHViU2VydmljZS5hcHBlbmRVc2VyVHVybihzZXNzaW9uQiwgJ0JldGEgbGVhZiBvbmx5Jyk7XG5cdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbihzZXNzaW9uQik7XG5cblx0XHRjb25zdCBsZWFmQSA9IG1vdW50TGVucyh7IHN0dWJTZXJ2aWNlLCBzZXNzaW9uS2V5OiBzZXNzaW9uQSB9KTtcblx0XHRjb25zdCBsZWFmQiA9IG1vdW50TGVucyh7IHN0dWJTZXJ2aWNlLCBzZXNzaW9uS2V5OiBzZXNzaW9uQiB9KTtcblx0XHRjb25zdCBzbG90c0EgPSBnZXRMZW5zU2xvdHMobGVhZkEucGFydCk7XG5cdFx0Y29uc3Qgc2xvdHNCID0gZ2V0TGVuc1Nsb3RzKGxlYWZCLnBhcnQpO1xuXHRcdGNvbnN0IGFscGhhVHVybiA9IHN0dWJTZXJ2aWNlLmdldFR1cm5zKHNlc3Npb25BKS5maW5kKHR1cm4gPT4gdHVybi50ZXh0ID09PSAnQWxwaGEgbGVhZiBvbmx5Jyk7XG5cdFx0Y29uc3QgYmV0YVR1cm4gPSBzdHViU2VydmljZS5nZXRUdXJucyhzZXNzaW9uQikuZmluZCh0dXJuID0+IHR1cm4udGV4dCA9PT0gJ0JldGEgbGVhZiBvbmx5Jyk7XG5cdFx0YXNzZXJ0Lm9rKGFscGhhVHVybik7XG5cdFx0YXNzZXJ0Lm9rKGJldGFUdXJuKTtcblx0XHRhd2FpdCByZXZlYWxWaXN1YWxpemVUdXJuKGxlYWZBLmxlbnMsIGxlYWZBLmxheW91dFJlYWRpbmdDb2x1bW4sIGFscGhhVHVybi5pZCk7XG5cdFx0YXdhaXQgcmV2ZWFsVmlzdWFsaXplVHVybihsZWFmQi5sZW5zLCBsZWFmQi5sYXlvdXRSZWFkaW5nQ29sdW1uLCBiZXRhVHVybi5pZCk7XG5cblx0XHRhc3NlcnQub2soc2xvdHNBLnRpbWVsaW5lLnRleHRDb250ZW50Py5pbmNsdWRlcygnQWxwaGEgbGVhZiBvbmx5JykpO1xuXHRcdGFzc2VydC5vayghc2xvdHNBLnRpbWVsaW5lLnRleHRDb250ZW50Py5pbmNsdWRlcygnQmV0YSBsZWFmIG9ubHknKSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzQi50aW1lbGluZS50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0JldGEgbGVhZiBvbmx5JykpO1xuXHRcdGFzc2VydC5vayghc2xvdHNCLnRpbWVsaW5lLnRleHRDb250ZW50Py5pbmNsdWRlcygnQWxwaGEgbGVhZiBvbmx5JykpO1xuXG5cdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbihzZXNzaW9uQSk7XG5cdFx0YXdhaXQgcmV2ZWFsVmlzdWFsaXplVHVybihsZWFmQS5sZW5zLCBsZWFmQS5sYXlvdXRSZWFkaW5nQ29sdW1uLCBhbHBoYVR1cm4uaWQpO1xuXHRcdGF3YWl0IHJldmVhbFZpc3VhbGl6ZVR1cm4obGVhZkIubGVucywgbGVhZkIubGF5b3V0UmVhZGluZ0NvbHVtbiwgYmV0YVR1cm4uaWQpO1xuXG5cdFx0YXNzZXJ0Lm9rKHNsb3RzQi50aW1lbGluZS50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0JldGEgbGVhZiBvbmx5JykpO1xuXHRcdGFzc2VydC5vayghc2xvdHNCLnRpbWVsaW5lLnRleHRDb250ZW50Py5pbmNsdWRlcygnQWxwaGEgbGVhZiBvbmx5JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25uZWN0aW9uIGNoYW5nZSByZWJpbmRzIHRoZSBib3VuZCBsZWFmIGFuZCBub3QgdGhlIHJvc3RlciBhY3RpdmUgc2Vzc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzdHViU2VydmljZSA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uU3R1YlNlcnZpY2UoKSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbkEgPSBzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRzdHViU2VydmljZS5hcHBlbmRVc2VyVHVybihzZXNzaW9uQSwgJ0FscGhhIHN0YXlzIG9uIHRoZSBib3VuZCBsZWFmJyk7XG5cdFx0Y29uc3Qgc2Vzc2lvbkIgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbkIsICdCZXRhIG11c3Qgbm90IHJlcGxhY2UgdGhlIGJvdW5kIGxlYWYnKTtcblx0XHRzdHViU2VydmljZS5zd2l0Y2hTZXNzaW9uKHNlc3Npb25BKTtcblx0XHRjb25zdCBjb25uZWN0aW9uRW1pdHRlciA9IHN0b3JlLmFkZChuZXcgRW1pdHRlcjxSZXR1cm5UeXBlPElVbml2ZXJzZUFnZW50Q29ubmVjdGlvblsnZ2V0Q29ubmVjdGlvblNuYXBzaG90J10+PigpKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGlzRW5naW5lQ29ubmVjdGVkOiAoKSA9PiBmYWxzZSxcblx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogY29ubmVjdGlvbkVtaXR0ZXIuZXZlbnQsXG5cdFx0fSk7XG5cdFx0Y29uc3QgbW91bnRlZCA9IG1vdW50TGVucyh7IHN0dWJTZXJ2aWNlLCBzZXNzaW9uS2V5OiBzZXNzaW9uQSwgY29ubmVjdGlvbiB9KTtcblx0XHRjb25zdCBhbHBoYVR1cm4gPSBzdHViU2VydmljZS5nZXRUdXJucyhzZXNzaW9uQSkuZmluZCh0dXJuID0+IHR1cm4udGV4dCA9PT0gJ0FscGhhIHN0YXlzIG9uIHRoZSBib3VuZCBsZWFmJyk7XG5cdFx0YXNzZXJ0Lm9rKGFscGhhVHVybik7XG5cdFx0YXdhaXQgcmV2ZWFsVmlzdWFsaXplVHVybihtb3VudGVkLmxlbnMsIG1vdW50ZWQubGF5b3V0UmVhZGluZ0NvbHVtbiwgYWxwaGFUdXJuLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW91bnRlZC5sZW5zLnNlc3Npb25WaWV3TGVhc2U/LnNlc3Npb25JZCwgc2Vzc2lvbkEpO1xuXG5cdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbihzZXNzaW9uQik7XG5cdFx0Y29uc3QgYmVmb3JlRW5naW5lRXZlbnQgPSBtb3VudGVkLmxlbnMuc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRhc3NlcnQub2soYmVmb3JlRW5naW5lRXZlbnQpO1xuXHRcdHN0dWJTZXJ2aWNlLnNldEVuZ2luZUNvbm5lY3RlZCh0cnVlKTtcblx0XHRjb25zdCBhZnRlckVuZ2luZUV2ZW50ID0gbW91bnRlZC5sZW5zLnNlc3Npb25WaWV3TGVhc2U7XG5cdFx0YXNzZXJ0Lm9rKGFmdGVyRW5naW5lRXZlbnQpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChhZnRlckVuZ2luZUV2ZW50LCBiZWZvcmVFbmdpbmVFdmVudCwgJ3RoZSByb3N0ZXIgY29ubmVjdGlvbiBldmVudCBtdXN0IGFjcXVpcmUgYSBuZXcgbGVhc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWZ0ZXJFbmdpbmVFdmVudC5zZXNzaW9uSWQsIHNlc3Npb25BKTtcblx0XHRhd2FpdCByZXZlYWxWaXN1YWxpemVUdXJuKG1vdW50ZWQubGVucywgbW91bnRlZC5sYXlvdXRSZWFkaW5nQ29sdW1uLCBhbHBoYVR1cm4uaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgc2Vzc2lvbkIpO1xuXHRcdGNvbnN0IHRpbWVsaW5lID0gZ2V0TGVuc1Nsb3RzKG1vdW50ZWQucGFydCkudGltZWxpbmU7XG5cdFx0YXNzZXJ0Lm9rKHRpbWVsaW5lLnRleHRDb250ZW50Py5pbmNsdWRlcygnQWxwaGEgc3RheXMgb24gdGhlIGJvdW5kIGxlYWYnKSk7XG5cdFx0YXNzZXJ0Lm9rKCF0aW1lbGluZS50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0JldGEgbXVzdCBub3QgcmVwbGFjZSB0aGUgYm91bmQgbGVhZicpKTtcblxuXHRcdGNvbm5lY3Rpb25FbWl0dGVyLmZpcmUoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKSk7XG5cdFx0Y29uc3QgYWZ0ZXJVYUV2ZW50ID0gbW91bnRlZC5sZW5zLnNlc3Npb25WaWV3TGVhc2U7XG5cdFx0YXNzZXJ0Lm9rKGFmdGVyVWFFdmVudCk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGFmdGVyVWFFdmVudCwgYWZ0ZXJFbmdpbmVFdmVudCwgJ3RoZSBVQSBjb25uZWN0aW9uIGV2ZW50IG11c3QgaW5kZXBlbmRlbnRseSBhY3F1aXJlIGEgbmV3IGxlYXNlJyk7XG5cdFx0YXdhaXQgcmV2ZWFsVmlzdWFsaXplVHVybihtb3VudGVkLmxlbnMsIG1vdW50ZWQubGF5b3V0UmVhZGluZ0NvbHVtbiwgYWxwaGFUdXJuLmlkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgc2Vzc2lvbkIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZnRlclVhRXZlbnQuc2Vzc2lvbklkLCBzZXNzaW9uQSk7XG5cdFx0YXNzZXJ0Lm9rKHRpbWVsaW5lLnRleHRDb250ZW50Py5pbmNsdWRlcygnQWxwaGEgc3RheXMgb24gdGhlIGJvdW5kIGxlYWYnKSk7XG5cdFx0YXNzZXJ0Lm9rKCF0aW1lbGluZS50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0JldGEgbXVzdCBub3QgcmVwbGFjZSB0aGUgYm91bmQgbGVhZicpKTtcblx0fSk7XG5cblx0Zm9yIChjb25zdCBldmVudFNvdXJjZSBvZiBbJ3Jvc3RlcicsICdVQSddIGFzIGNvbnN0KSB7XG5cdFx0dGVzdChgcGFpcmluZy1ob2xkICR7ZXZlbnRTb3VyY2V9IGNvbm5lY3Rpb24gZXZlbnQgZGVtb3RlcyB0aGUgbGl2ZSBiYWRnZSB3aGlsZSBrZWVwaW5nIHRoZSBzYW1lIGxlYXNlIGFuZCBjb250ZW50YCwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGV0IHBhaXJpbmdQZW5kaW5nID0gZmFsc2U7XG5cdFx0XHRjb25zdCBzdHViU2VydmljZSA9IHN0b3JlLmFkZChuZXcgY2xhc3MgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRcdG92ZXJyaWRlIGlzRW5naW5lQ29ubmVjdGVkKCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRcdHJldHVybiAhcGFpcmluZ1BlbmRpbmcgJiYgc3VwZXIuaXNFbmdpbmVDb25uZWN0ZWQoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRvdmVycmlkZSBnZXRTZXNzaW9uU3luYyhzZXNzaW9uSWQ6IHN0cmluZyk6IFJldHVyblR5cGU8Q29udmVyc2F0aW9uU3R1YlNlcnZpY2VbJ2dldFNlc3Npb25TeW5jJ10+IHtcblx0XHRcdFx0XHRyZXR1cm4gcGFpcmluZ1BlbmRpbmcgPyB7IGtpbmQ6ICdjbG9zZWQnLCByZWFzb246ICdQYWlyaW5nIHJlcXVpcmVkJyB9IDogc3VwZXIuZ2V0U2Vzc2lvblN5bmMoc2Vzc2lvbklkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSgpKTtcblx0XHRcdHN0dWJTZXJ2aWNlLnNldEVuZ2luZUNvbm5lY3RlZCh0cnVlKTtcblx0XHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdFx0Y29uc3QgdHVybiA9IHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25JZCwgJ0tlZXAgbGl2ZSBjb250ZW50IGR1cmluZyBwYWlyaW5nJyk7XG5cdFx0XHRhc3NlcnQub2sodHVybik7XG5cdFx0XHRjb25zdCB7IG1vZGVsLCBvblNlc3Npb25DaGFuZ2VkIH0gPSBzdHViU2VydmljZS5jcmVhdGVUZXN0RnJhbWVTb3VyY2VDYWxsYmFjaygpO1xuXHRcdFx0Y29uc3QgdGVzdFNvdXJjZSA9IHN0b3JlLmFkZChuZXcgVGVzdENvbnZlcnNhdGlvbkZyYW1lU291cmNlKG1vZGVsLCBvblNlc3Npb25DaGFuZ2VkKSk7XG5cdFx0XHRzdHViU2VydmljZS53aXJlVGVzdEZyYW1lU291cmNlKHRlc3RTb3VyY2UpO1xuXHRcdFx0dGVzdFNvdXJjZS5zZXRTZXNzaW9uU3luYyhzZXNzaW9uSWQsIHsga2luZDogJ2xpdmUnIH0pO1xuXHRcdFx0Y29uc3QgY29ubmVjdGlvbkVtaXR0ZXIgPSBzdG9yZS5hZGQobmV3IEVtaXR0ZXI8UmV0dXJuVHlwZTxJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb25bJ2dldENvbm5lY3Rpb25TbmFwc2hvdCddPj4oKSk7XG5cdFx0XHRjb25zdCBiYXNlID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKCk7XG5cdFx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdFx0aXNFbmdpbmVDb25uZWN0ZWQ6ICgpID0+ICFwYWlyaW5nUGVuZGluZyxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdFx0Z2V0Q29ubmVjdGlvblNuYXBzaG90OiAoKSA9PiAoeyAuLi5iYXNlLmdldENvbm5lY3Rpb25TbmFwc2hvdCgpLCB0cmFuc3BvcnQ6ICdvaycsIGNoYW5uZWxBbGl2ZTogdHJ1ZSwgcGFpcmluZ1BlbmRpbmcgfSksXG5cdFx0XHRcdG9uRGlkQ2hhbmdlQ29ubmVjdGlvbjogY29ubmVjdGlvbkVtaXR0ZXIuZXZlbnQsXG5cdFx0XHR9KTtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb25FdmVudHMgPSB7IHJvc3RlcjogMCwgVUE6IDAgfTtcblx0XHRcdHN0b3JlLmFkZChzdHViU2VydmljZS5vbkRpZENoYW5nZUVuZ2luZUNvbm5lY3Rpb24oKCkgPT4geyBjb25uZWN0aW9uRXZlbnRzLnJvc3RlcisrOyB9KSk7XG5cdFx0XHRzdG9yZS5hZGQoY29ubmVjdGlvbi5vbkRpZENoYW5nZUNvbm5lY3Rpb24oKCkgPT4geyBjb25uZWN0aW9uRXZlbnRzLlVBKys7IH0pKTtcblx0XHRcdGNvbnN0IHsgcGFydCwgbGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2UsIHNlc3Npb25LZXk6IHNlc3Npb25JZCwgY29ubmVjdGlvbiB9KTtcblx0XHRcdGF3YWl0IGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cdFx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRcdGNvbnN0IGJhZGdlID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXN5bmMtYmFkZ2UnKTtcblx0XHRcdGFzc2VydC5vayhiYWRnZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFkZ2UuaGlkZGVuLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFkZ2UudGV4dENvbnRlbnQsICdTZXNzaW9uIGxpdmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWRnZS50aXRsZSwgJ1Nlc3Npb24gbGl2ZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhZGdlLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCAnU2Vzc2lvbiBsaXZlJyk7XG5cdFx0XHRjb25zdCBsZWFzZSA9IGxlbnMuc2Vzc2lvblZpZXdMZWFzZTtcblx0XHRcdGFzc2VydC5vayhsZWFzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVhc2Uuc2Vzc2lvbklkLCBzZXNzaW9uSWQpO1xuXHRcdFx0Y29uc3Qgc25hcHNob3QgPSBsZWFzZS5zbmFwc2hvdDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmFwc2hvdC5zeW5jLmtpbmQsICdsaXZlJyk7XG5cdFx0XHRjb25zdCBlbnRyaWVzID0gbGVucy5sYXN0QXR0YWNoZWRFbnRyaWVzO1xuXHRcdFx0YXNzZXJ0Lm9rKGVudHJpZXMubGVuZ3RoID4gMCk7XG5cdFx0XHRjb25zdCB0dXJuU2VsZWN0b3IgPSBgLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm5bZGF0YS1raW5kPVwidXNlclwiXVtkYXRhLXR1cm4taWQ9XCIke3R1cm4uaWR9XCJdYDtcblx0XHRcdGNvbnN0IHBhaW50ZWRUdXJuID0gcXVlcnlUaW1lbGluZShzbG90cywgdHVyblNlbGVjdG9yKTtcblx0XHRcdGFzc2VydC5vayhwYWludGVkVHVybik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFpbnRlZFR1cm4uZ2V0QXR0cmlidXRlKCdkYXRhLXR1cm4taWQnKSwgdHVybi5pZCk7XG5cdFx0XHRjb25zdCBwYWludGVkQm9keSA9IHBhaW50ZWRUdXJuLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWJvZHknKTtcblx0XHRcdGFzc2VydC5vayhwYWludGVkQm9keSk7XG5cdFx0XHRjb25zdCBwYWludGVkQ29udGVudCA9IHBhaW50ZWRCb2R5LnRleHRDb250ZW50O1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhaW50ZWRDb250ZW50LCAnS2VlcCBsaXZlIGNvbnRlbnQgZHVyaW5nIHBhaXJpbmcnKTtcblxuXHRcdFx0cGFpcmluZ1BlbmRpbmcgPSB0cnVlO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRTZXNzaW9uU3luYyhzZXNzaW9uSWQpLmtpbmQsICdjbG9zZWQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25uZWN0aW9uLmdldENvbm5lY3Rpb25QaGFzZSgpPy5raW5kLCAnY29ubmVjdGVkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKS5wYWlyaW5nUGVuZGluZywgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNvbm5lY3Rpb25FdmVudHMsIHsgcm9zdGVyOiAwLCBVQTogMCB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWRnZS50ZXh0Q29udGVudCwgJ1Nlc3Npb24gbGl2ZScsICd0aGUgc2lsZW50IGZpeHR1cmUgdHJhbnNpdGlvbiBtdXN0IG5vdCByZXBhaW50IGNocm9tZScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhZGdlLnRpdGxlLCAnU2Vzc2lvbiBsaXZlJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFkZ2UuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksICdTZXNzaW9uIGxpdmUnKTtcblx0XHRcdGlmIChldmVudFNvdXJjZSA9PT0gJ3Jvc3RlcicpIHtcblx0XHRcdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbm5lY3Rpb25FbWl0dGVyLmZpcmUoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY29ubmVjdGlvbkV2ZW50cywgeyByb3N0ZXI6IGV2ZW50U291cmNlID09PSAncm9zdGVyJyA/IDEgOiAwLCBVQTogZXZlbnRTb3VyY2UgPT09ICdVQScgPyAxIDogMCB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2UsIGxlYXNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZWFzZS5zbmFwc2hvdCwgc25hcHNob3QpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlYXNlLnNuYXBzaG90LnN5bmMua2luZCwgJ2xpdmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmxhc3RBdHRhY2hlZEVudHJpZXMsIGVudHJpZXMpO1xuXHRcdFx0Y29uc3QgcmV0YWluZWRUdXJuID0gcXVlcnlUaW1lbGluZShzbG90cywgdHVyblNlbGVjdG9yKTtcblx0XHRcdGFzc2VydC5vayhyZXRhaW5lZFR1cm4pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldGFpbmVkVHVybi5nZXRBdHRyaWJ1dGUoJ2RhdGEtdHVybi1pZCcpLCB0dXJuLmlkKTtcblx0XHRcdGNvbnN0IHJldGFpbmVkQm9keSA9IHJldGFpbmVkVHVybi5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5Jyk7XG5cdFx0XHRhc3NlcnQub2socmV0YWluZWRCb2R5KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXRhaW5lZEJvZHkudGV4dENvbnRlbnQsIHBhaW50ZWRDb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWRnZS5oaWRkZW4sIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWRnZS50ZXh0Q29udGVudCwgJ1Nlc3Npb24gZGlzY29ubmVjdGVkOiBQYWlyaW5nIHJlcXVpcmVkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFkZ2UudGl0bGUsICdTZXNzaW9uIGRpc2Nvbm5lY3RlZDogUGFpcmluZyByZXF1aXJlZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhZGdlLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCAnU2Vzc2lvbiBkaXNjb25uZWN0ZWQ6IFBhaXJpbmcgcmVxdWlyZWQnKTtcblx0XHRcdGFzc2VydC5vayghc2xvdHMuc2Vzc2lvbkJhciEudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdTZXNzaW9uIGxpdmUnKSk7XG5cdFx0fSk7XG5cdH1cblxuXHR0ZXN0KCdib3VuZCBsZWFmIGNsb3NlcyBpbm5lciBvdmVybGF5cyB3aGVuIHRoZSByb3N0ZXIgYWN0aXZlIHNlc3Npb24gbGVhdmVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHN0dWJTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBDb252ZXJzYXRpb25TdHViU2VydmljZSgpKTtcblx0XHRjb25zdCBzZXNzaW9uQSA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdHN0dWJTZXJ2aWNlLnNldE1lc3NhZ2VRdWV1ZUZpeHR1cmUoc2Vzc2lvbkEsIHtcblx0XHRcdGlzUGF1c2VkOiBmYWxzZSxcblx0XHRcdGlzUHJvY2Vzc2luZzogZmFsc2UsXG5cdFx0XHRpdGVtczogW3tcblx0XHRcdFx0aWQ6ICdxLWJvdW5kJyxcblx0XHRcdFx0Y29udGVudDogJ0JvdW5kIHF1ZXVlJyxcblx0XHRcdFx0c3RhdHVzOiAnUEVORElORycsXG5cdFx0XHRcdGhvbGQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0dXBsb2FkUHJvZ3Jlc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0cmV0cnlDb3VudDogMCxcblx0XHRcdFx0bGFzdEVycm9yOiB1bmRlZmluZWQsXG5cdFx0XHRcdGxvY2tlZDogZmFsc2UsXG5cdFx0XHRcdHBpbm5lZDogZmFsc2UsXG5cdFx0XHR9XSxcblx0XHR9KTtcblx0XHRjb25zdCBzZXNzaW9uQiA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRzdHViU2VydmljZS5zd2l0Y2hTZXNzaW9uKHNlc3Npb25BKTtcblx0XHRjb25zdCB7IGxlbnMgfSA9IG1vdW50TGVucyh7IHN0dWJTZXJ2aWNlLCBzZXNzaW9uS2V5OiBzZXNzaW9uQSB9KTtcblx0XHRjb25zdCBoaXN0b3J5ID0gbGVucy5lbmdpbmVIaXN0b3J5TGlzdDtcblx0XHRjb25zdCBzbmFwc2hvdHMgPSBsZW5zLmVuZ2luZVNuYXBzaG90c0xpc3Q7XG5cdFx0YXNzZXJ0Lm9rKGhpc3RvcnkpO1xuXHRcdGFzc2VydC5vayhzbmFwc2hvdHMpO1xuXHRcdGxlbnMub3BlblZpc3VhbGl6ZU92ZXJsYXkoJ2dyYXBoIFREOyBBLS0+QicsICdCb3VuZCBkaWFncmFtJyk7XG5cdFx0aGlzdG9yeS5zaG93KCk7XG5cdFx0c25hcHNob3RzLnNob3coKTtcblx0XHRjb25zdCBjaGlwID0gbGVucy5pbmJveE92ZXJsYXkuZWxlbWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtcXVldWUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKGNoaXApO1xuXHRcdGNoaXAuY2xpY2soKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy52aXN1YWxpemVPdmVybGF5LmlzT3BlbigpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGlzdG9yeS5pc09wZW4oKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuYXBzaG90cy5pc09wZW4oKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoaXAuZ2V0QXR0cmlidXRlKCdhcmlhLXByZXNzZWQnKSwgJ3RydWUnKTtcblxuXHRcdHN0dWJTZXJ2aWNlLnN3aXRjaFNlc3Npb24oc2Vzc2lvbkIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMudmlzdWFsaXplT3ZlcmxheS5pc09wZW4oKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoaXN0b3J5LmlzT3BlbigpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuYXBzaG90cy5pc09wZW4oKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlwLmdldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJyksICdmYWxzZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdoaWRkZW4gbGVhZiByZWxlYXNlIGlnbm9yZXMgY29ubmVjdGlvbiBjaHVybiB1bnRpbCBiaW5kU2Vzc2lvblZpZXcgcmVzdG9yZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgc3R1YlNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IHNlc3Npb25BID0gc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbkIgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbihzZXNzaW9uQSk7XG5cdFx0Y29uc3QgY29ubmVjdGlvbkVtaXR0ZXIgPSBzdG9yZS5hZGQobmV3IEVtaXR0ZXI8UmV0dXJuVHlwZTxJVW5pdmVyc2VBZ2VudENvbm5lY3Rpb25bJ2dldENvbm5lY3Rpb25TbmFwc2hvdCddPj4oKSk7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1Yih7XG5cdFx0XHRvbkRpZENoYW5nZUNvbm5lY3Rpb246IGNvbm5lY3Rpb25FbWl0dGVyLmV2ZW50LFxuXHRcdH0pO1xuXHRcdGNvbnN0IHsgbGVucyB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2UsIHNlc3Npb25LZXk6IHNlc3Npb25BLCBjb25uZWN0aW9uIH0pO1xuXHRcdGNvbnN0IHJlYWRTZXNzaW9uVmlld0xlYXNlID0gKCk6IENvbnZlcnNhdGlvbkxlbnNbJ3Nlc3Npb25WaWV3TGVhc2UnXSA9PiBsZW5zLnNlc3Npb25WaWV3TGVhc2U7XG5cdFx0Y29uc3QgYmVmb3JlUmVsZWFzZSA9IHJlYWRTZXNzaW9uVmlld0xlYXNlKCk7XG5cdFx0YXNzZXJ0Lm9rKGJlZm9yZVJlbGVhc2UpO1xuXHRcdHN0dWJTZXJ2aWNlLnN3aXRjaFNlc3Npb24oc2Vzc2lvbkIpO1xuXG5cdFx0bGVucy5yZWxlYXNlU2Vzc2lvblZpZXdMZWFzZUZvckhpZGRlbkxlYWYoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uVmlld0xlYXNlLCB1bmRlZmluZWQpO1xuXG5cdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnNlc3Npb25WaWV3TGVhc2UsIHVuZGVmaW5lZCwgJ3RoZSByb3N0ZXIgZXZlbnQgY2Fubm90IHJlLWFjcXVpcmUgYSBoaWRkZW4gbGVhZiBsZWFzZScpO1xuXHRcdGNvbm5lY3Rpb25FbWl0dGVyLmZpcmUoY29ubmVjdGlvbi5nZXRDb25uZWN0aW9uU25hcHNob3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuc2Vzc2lvblZpZXdMZWFzZSwgdW5kZWZpbmVkLCAndGhlIFVBIGV2ZW50IGNhbm5vdCByZS1hY3F1aXJlIGEgaGlkZGVuIGxlYWYgbGVhc2UnKTtcblxuXHRcdGxlbnMuYmluZFNlc3Npb25WaWV3KHNlc3Npb25BKTtcblx0XHRjb25zdCByZXN0b3JlZCA9IHJlYWRTZXNzaW9uVmlld0xlYXNlKCk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3RvcmVkKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocmVzdG9yZWQsIGJlZm9yZVJlbGVhc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN0b3JlZC5zZXNzaW9uSWQsIHNlc3Npb25BKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIHNlc3Npb25CKTtcblx0XHRjb25uZWN0aW9uRW1pdHRlci5maXJlKGNvbm5lY3Rpb24uZ2V0Q29ubmVjdGlvblNuYXBzaG90KCkpO1xuXHRcdGNvbnN0IHJlYm91bmQgPSByZWFkU2Vzc2lvblZpZXdMZWFzZSgpO1xuXHRcdGFzc2VydC5vayhyZWJvdW5kKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocmVib3VuZCwgcmVzdG9yZWQsICdwdWJsaWMgYmluZCBtdXN0IHJlc3RvcmUgc3Vic2VxdWVudCBjb25uZWN0aW9uLWV2ZW50IGJpbmRpbmcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVib3VuZC5zZXNzaW9uSWQsIHNlc3Npb25BKTtcblx0fSk7XG5cblx0dGVzdCgncGlubmVkIGxlbnMgZG9lcyBub3Qgd3JpdGUgdGhlIHNoYXJlZCBsZW5zIGlkJywgKCkgPT4ge1xuXHRcdGNvbnN0IHN0b3JhZ2UgPSBzdG9yZS5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKTtcblx0XHRzdG9yYWdlLnN0b3JlKENPTlZFUlNBVElPTl9MRU5TX0lEX1NUT1JBR0VfS0VZLCAnY29udmVyc2F0aW9uJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRjb25zdCBwaW5uZWQgPSBtb3VudExlbnMoeyBzdG9yYWdlU2VydmljZTogc3RvcmFnZSwgcGluQ29udmVyc2F0aW9uTGVuczogdHJ1ZSwgc2Vzc2lvbktleTogJ3Nlc3MtcGluJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGlubmVkLmxlbnMubGVuc0lkLCAnY29udmVyc2F0aW9uJyk7XG5cdFx0cGlubmVkLmxlbnMuc2V0TGVuc0lkKCd0cmFqZWN0b3J5Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0b3JhZ2UuZ2V0KENPTlZFUlNBVElPTl9MRU5TX0lEX1NUT1JBR0VfS0VZLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKSwgJ2NvbnZlcnNhdGlvbicpO1xuXG5cdFx0Y29uc3QgZmlsdGVyZWRTdG9yYWdlID0gc3RvcmUuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSk7XG5cdFx0ZmlsdGVyZWRTdG9yYWdlLnN0b3JlKENPTlZFUlNBVElPTl9MRU5TX0lEX1NUT1JBR0VfS0VZLCAnY29udmVyc2F0aW9uJywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRjb25zdCBmaWx0ZXJlZCA9IG1vdW50TGVucyh7IHN0b3JhZ2VTZXJ2aWNlOiBmaWx0ZXJlZFN0b3JhZ2UsIGZpbHRlckFnZW50SWQ6ICdzdWI6MScsIHNlc3Npb25LZXk6ICdzZXNzLWZpbHRlcicgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbHRlcmVkLmxlbnMubGVuc0lkLCAnY29udmVyc2F0aW9uJyk7XG5cdFx0ZmlsdGVyZWQubGVucy5zZXRMZW5zSWQoJ3RyYWplY3RvcnknKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlsdGVyZWRTdG9yYWdlLmdldChDT05WRVJTQVRJT05fTEVOU19JRF9TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSksICdjb252ZXJzYXRpb24nKTtcblx0fSk7XG5cblx0dGVzdCgndGFibGlzdC1vbmx5IHNsb3Qgc3RpbGwgaG9zdHMgQ29udmVyc2F0aW9uIGFuZCBUcmFqZWN0b3J5IHRhYnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoeyB0YWJsaXN0T25seTogdHJ1ZSB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRhc3NlcnQub2soc2xvdHMubGVuc1RhYmxpc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy5zZXNzaW9uQmFyLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5vayhzbG90cy5sZW5zVGFibGlzdC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtbGVucy10YWJzW3JvbGU9XCJ0YWJsaXN0XCJdJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRMZW5zVGFiKHNsb3RzLCAnY29udmVyc2F0aW9uJykuZ2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJyksICd0cnVlJyk7XG5cblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXHRcdGNsaWNrTGVuc1RhYihzbG90cywgJ3RyYWplY3RvcnknKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0TGVuc1RhYihzbG90cywgJ3RyYWplY3RvcnknKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQub2soIXNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10cmFqZWN0b3J5JykhLmhhc0F0dHJpYnV0ZSgnaGlkZGVuJykpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXNzaW9uQmFyIG5ldyBzZXNzaW9uIGJ1dHRvbiBjcmVhdGVzIGFuIGVtcHR5IHN0dWIgc2Vzc2lvbicsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBuZXdCdXR0b24gPSBzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1uZXcgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCB0aXRsZSA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXRpdGxlJykhO1xuXHRcdGNvbnN0IGluaXRpYWxDb3VudCA9IHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkubGVuZ3RoO1xuXG5cdFx0YXNzZXJ0Lm9rKG5ld0J1dHRvbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0J1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJOZXdTZXNzaW9uKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tbWF4aW1pemUnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLWRyYXdlcicpLCBudWxsKTtcblxuXHRcdG5ld0J1dHRvbi5jbGljaygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkubGVuZ3RoLCBpbml0aWFsQ291bnQgKyAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0VHVybnMoc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCkpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKHRpdGxlLnRleHRDb250ZW50Py5pbmNsdWRlcygnTmV3IHNlc3Npb24nKSk7XG5cdFx0YXNzZXJ0Lm9rKGdldFRpbWVsaW5lRW1wdHkoc2xvdHMpKTtcblx0XHRhc3NlcnQub2soZ2V0VGltZWxpbmVTY3JvbGwoc2xvdHMpLnRleHRDb250ZW50Py5pbmNsdWRlcygnTm8gbWVzc2FnZXMgeWV0JykpO1xuXHRcdGFzc2VydC5vayghZ2V0VGltZWxpbmVTY3JvbGwoc2xvdHMpLnRleHRDb250ZW50Py50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzZW5kIGEgbWVzc2FnZSBiZWxvdycpKTtcblx0fSk7XG5cblx0dGVzdCgnU2Vzc2lvbkJhciBkZWxldGUgYnV0dG9uIHJlbW92ZXMgYWN0aXZlIHN0dWIgc2Vzc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsZW5zIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBkZWxldGVCdXR0b24gPSBzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1kZWxldGUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCBpbml0aWFsQ291bnQgPSBzdHViU2VydmljZS5nZXRTZXNzaW9ucygpLmxlbmd0aDtcblx0XHRjb25zdCBkZWxldGVkSWQgPSBzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRsZW5zLmRpYWxvZ1NlcnZpY2UuY29uZmlybSA9ICgpID0+IFByb21pc2UucmVzb2x2ZSh7IGNvbmZpcm1lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5vayhkZWxldGVCdXR0b24pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVCdXR0b24uZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyRGVsZXRlU2Vzc2lvbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlbGV0ZUJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgJ0RlbGV0ZSBzZXNzaW9uJyk7XG5cblx0XHRkZWxldGVCdXR0b24uY2xpY2soKTtcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXG5cdFx0Ly8gU2VlZCBpcyB1bnRpdGxlZCArIHZpc3VhbGl6ZTsgZGVsZXRpbmcgdGhlIGFjdGl2ZSBvbmUgbGVhdmVzIHRoZSBvdGhlci5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKS5sZW5ndGgsIGluaXRpYWxDb3VudCAtIDEpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgZGVsZXRlZElkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKS5zb21lKHMgPT4gcy5pZCA9PT0gZGVsZXRlZElkKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXNzaW9uQmFyIGRlbGV0ZSBvbiBsYXN0IHNlc3Npb24gY3JlYXRlcyBmcmVzaCB1bnRpdGxlZCBzdHViJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxlbnMgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25zID0gWy4uLnN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCldO1xuXHRcdGxlbnMuZGlhbG9nU2VydmljZS5jb25maXJtID0gKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHsgY29uZmlybWVkOiB0cnVlIH0pO1xuXG5cdFx0Zm9yIChjb25zdCBzZXNzaW9uIG9mIHNlc3Npb25zKSB7XG5cdFx0XHRpZiAoc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCkgIT09IHNlc3Npb24uaWQpIHtcblx0XHRcdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbihzZXNzaW9uLmlkKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGRlbGV0ZUJ1dHRvbiA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLWRlbGV0ZSAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdFx0ZGVsZXRlQnV0dG9uLmNsaWNrKCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdGF3YWl0IFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRpdGxlID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQub2sodGl0bGUudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdVbnRpdGxlZCcpKTtcblx0XHRhc3NlcnQub2soZ2V0VGltZWxpbmVFbXB0eShzbG90cykpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXNzaW9uQmFyIGxlbnMgdGFibGlzdCBkZWZhdWx0cyB0byBDb252ZXJzYXRpb24gYW5kIHN3aXRjaGVzIHRvIFRyYWplY3RvcnknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IGNvbnZlcnNhdGlvblRhYiA9IGdldExlbnNUYWIoc2xvdHMsICdjb252ZXJzYXRpb24nKTtcblx0XHRjb25zdCB0cmFqZWN0b3J5VGFiID0gZ2V0TGVuc1RhYihzbG90cywgJ3RyYWplY3RvcnknKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb252ZXJzYXRpb25UYWIudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyQ29udmVyc2F0aW9uVGFiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeVRhYi50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJUcmFqZWN0b3J5VGFiKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udmVyc2F0aW9uVGFiLmdldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFqZWN0b3J5VGFiLmdldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQub2soc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXRpbWVsaW5lOm5vdChbaGlkZGVuXSknKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10cmFqZWN0b3J5JykhLmhhc0F0dHJpYnV0ZSgnaGlkZGVuJyksIHRydWUpO1xuXG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbklkLCAnRmlyc3QgdHVybiBpbiB0cmFqZWN0b3J5Jyk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kU3R1YkVjaG9Bc3Npc3RhbnQoc2Vzc2lvbklkLCAnU3R1YiByZXBseScpO1xuXHRcdGF3YWl0IGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cblx0XHRjbGlja0xlbnNUYWIoc2xvdHMsICd0cmFqZWN0b3J5Jyk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udmVyc2F0aW9uVGFiLmdldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeVRhYi5nZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnKSwgJ3RydWUnKTtcblx0XHRjb25zdCB0cmFqZWN0b3J5ID0gc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXRyYWplY3RvcnknKSE7XG5cdFx0YXNzZXJ0Lm9rKCF0cmFqZWN0b3J5Lmhhc0F0dHJpYnV0ZSgnaGlkZGVuJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdGltZWxpbmUnKSEuaGFzQXR0cmlidXRlKCdoaWRkZW4nKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWplY3RvcnkucXVlcnlTZWxlY3RvckFsbCgnLmNvbnZlcnNhdGlvbi1sZW5zLXRyYWplY3RvcnktcmVjb3JkLXJvdycpLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0Lm9rKHRyYWplY3RvcnkudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdGaXJzdCB0dXJuIGluIHRyYWplY3RvcnknKSk7XG5cblx0XHRjbGlja0xlbnNUYWIoc2xvdHMsICdjb252ZXJzYXRpb24nKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnZlcnNhdGlvblRhYi5nZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeVRhYi5nZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnKSwgJ2ZhbHNlJyk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10aW1lbGluZTpub3QoW2hpZGRlbl0pJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHJhamVjdG9yeScpIS5oYXNBdHRyaWJ1dGUoJ2hpZGRlbicpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnU2Vzc2lvbkJhciBleHBvc2VzIGxlbnMgdGFibGlzdCwgc2Vzc2lvbiB0aXRsZSwgY29uZmlybWF0aW9uLCBhbmQgcHJvY2VzcyBmb2xkIGFyaWEnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy50aW1lb3V0KDE1MDAwKTtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHQvLyBzZWVkUGVuZGluZ0NvbmZpcm1hdGlvbiBjcmVhdGVzIGFuZCBhY3RpdmF0ZXMgaXRzIG93biBzZXNzaW9uLCBzbyB0aGVcblx0XHQvLyBwcm9jZXNzIHN0ZXAgaGFzIHRvIGxhbmQgdGhlcmUgdG8gc2hvdyB1cCBpbiB0aGUgcmVuZGVyZWQgdGltZWxpbmUuXG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gYXdhaXQgc2VlZFBlbmRpbmdDb25maXJtYXRpb24oc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFRoaW5raW5nVHVybihzZXNzaW9uSWQsICdXZWlnaGluZyBvcHRpb25zJyk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cblx0XHRjb25zdCB0YWJsaXN0ID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWxlbnMtdGFic1tyb2xlPVwidGFibGlzdFwiXScpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5vayh0YWJsaXN0LmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpPy5pbmNsdWRlcygnQ29udmVyc2F0aW9uIGxlbnMnKSk7XG5cdFx0Y29uc3QgY29udmVyc2F0aW9uVGFiID0gZ2V0TGVuc1RhYihzbG90cywgJ2NvbnZlcnNhdGlvbicpO1xuXHRcdGNvbnN0IHRyYWplY3RvcnlUYWIgPSBnZXRMZW5zVGFiKHNsb3RzLCAndHJhamVjdG9yeScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb252ZXJzYXRpb25UYWIuZ2V0QXR0cmlidXRlKCdhcmlhLWNvbnRyb2xzJyksICdjb252ZXJzYXRpb24tbGVucy1wYW5lbC1jb252ZXJzYXRpb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeVRhYi5nZXRBdHRyaWJ1dGUoJ2FyaWEtY29udHJvbHMnKSwgJ2NvbnZlcnNhdGlvbi1sZW5zLXBhbmVsLXRyYWplY3RvcnknKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udmVyc2F0aW9uVGFiLnRhYkluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeVRhYi50YWJJbmRleCwgLTEpO1xuXG5cdFx0Y29uc3QgdGl0bGVCdXR0b24gPSBzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi10aXRsZScpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGFzc2VydC5vayh0aXRsZUJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKT8uaW5jbHVkZXMoJ1Nlc3Npb24gdGl0bGU6JykpO1xuXG5cdFx0Y29udmVyc2F0aW9uVGFiLmZvY3VzKCk7XG5cdFx0Y29udmVyc2F0aW9uVGFiLmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IGtleUNvZGU6IEtleUNvZGUuUmlnaHRBcnJvdywgYnViYmxlczogdHJ1ZSwgY2FuY2VsYWJsZTogdHJ1ZSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWplY3RvcnlUYWIuZ2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQsIHRyYWplY3RvcnlUYWIpO1xuXG5cdFx0Y29uc3Qgc2VhdCA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtY29uZmlybWF0aW9uLXNlYXQnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRjb25zdCBzZWF0QXJpYSA9IHNlYXQuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgPz8gJyc7XG5cdFx0YXNzZXJ0Lm9rKHNlYXQudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdjb25maXJtYXRpb24gcGVuZGluZycpKTtcblx0XHRhc3NlcnQub2soc2VhdEFyaWEuaW5jbHVkZXMoJ1Blcm1pc3Npb24nKSk7XG5cdFx0YXNzZXJ0Lm9rKHNlYXRBcmlhLmluY2x1ZGVzKCdJbnB1dCBuZWVkZWQnKSk7XG5cdFx0YXNzZXJ0Lm9rKHNlYXRBcmlhLmluY2x1ZGVzKCdXcml0ZSBSRUFETUUubWQ/JykpO1xuXG5cdFx0Y29uc3QgZm9sZEhlYWRlciA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC1oZWFkZXInKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQub2soZm9sZEhlYWRlci5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKT8uaW5jbHVkZXMoJ1Byb2Nlc3Mgc3RlcHMnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Nlc3Npb25CYXIgbGVucyB0YWJzIHN0YXkgdmlzaWJsZSBhdCAzMDBweCBtaW5pbXVtIHdpZHRoIHdpdGggMjJweCBiYXIgaGVpZ2h0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKHsgbGF5b3V0V2lkdGg6IExFTlNfTUlOX1dJRFRIIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IGJhciA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLWJhcicpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IGNvbnZlcnNhdGlvblRhYiA9IGdldExlbnNUYWIoc2xvdHMsICdjb252ZXJzYXRpb24nKTtcblx0XHRjb25zdCB0cmFqZWN0b3J5VGFiID0gZ2V0TGVuc1RhYihzbG90cywgJ3RyYWplY3RvcnknKTtcblx0XHRjb25zdCBzd2l0Y2hlckxhYmVsID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tc3dpdGNoZXItbGFiZWwnKSBhcyBIVE1MRWxlbWVudDtcblxuXHRcdGFzc2VydC5vayhiYXIpO1xuXHRcdGFzc2VydC5vayhjb252ZXJzYXRpb25UYWIpO1xuXHRcdGFzc2VydC5vayh0cmFqZWN0b3J5VGFiKTtcblx0XHQvLyAzMDBweCBpcyB0aGUgbmFycm93IGJ1Y2tldCwgbm90IGNvbXBhY3QgKGB3aWR0aCA8IDMwMGApLiBTd2l0Y2hlciBoaWRlIGlzIENTUyBvbiBgLmlzLW5hcnJvd2AuXG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLnNlc3Npb25CYXIhLmNsYXNzTGlzdC5jb250YWlucygnaXMtbmFycm93JykpO1xuXHRcdGFzc2VydC5vayghc2xvdHMuc2Vzc2lvbkJhciEuY2xhc3NMaXN0LmNvbnRhaW5zKCdpcy1jb21wYWN0JykpO1xuXHRcdGFzc2VydC5vayhzd2l0Y2hlckxhYmVsKTtcblx0XHRhc3NlcnQub2soc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tbW9yZScpKTtcblx0XHRjb25zdCBtb3JlQnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tbW9yZSAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGFzc2VydC5vayhtb3JlQnV0dG9uKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9yZUJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJNb3JlKTtcblx0XHRtb3JlQnV0dG9uLmNsaWNrKCk7XG5cdFx0Y29uc3QgcG9wdXAgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLXBvcHVwJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayhwb3B1cCk7XG5cdFx0Y29uc3QgbGFiZWxzID0gWy4uLnBvcHVwLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtaXRlbScpXS5tYXAoaXRlbSA9PiBpdGVtLnRleHRDb250ZW50KTtcblx0XHRhc3NlcnQub2sobGFiZWxzLmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFySGlzdG9yeSkpO1xuXHRcdGFzc2VydC5vayhsYWJlbHMuaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJTbmFwc2hvdHMpKTtcblx0XHRhc3NlcnQub2soIWxhYmVscy5pbmNsdWRlcyhjb252ZXJzYXRpb25MZW5zU2Vzc2lvbkJhckdvQmFjaykpO1xuXHRcdGFzc2VydC5vayghbGFiZWxzLmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyR29Gb3J3YXJkKSk7XG5cdFx0YXNzZXJ0Lm9rKCFsYWJlbHMuaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJDbG9zZUV4dGVuc2lvblRhYnMpKTtcblx0XHRhc3NlcnQub2sobGFiZWxzLmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyTmV3U2Vzc2lvbikpO1xuXHRcdGFzc2VydC5vayhsYWJlbHMuaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJEZWxldGVTZXNzaW9uKSk7XG5cdFx0Y29uc3QgbmV3SXRlbSA9IFsuLi5wb3B1cC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLWl0ZW0nKV0uZmluZChpdGVtID0+IGl0ZW0udGV4dENvbnRlbnQgPT09IGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyTmV3U2Vzc2lvbikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0Y29uc3QgZGVsZXRlSXRlbSA9IFsuLi5wb3B1cC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLWl0ZW0nKV0uZmluZChpdGVtID0+IGl0ZW0udGV4dENvbnRlbnQgPT09IGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyRGVsZXRlU2Vzc2lvbikgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0l0ZW0uZGlzYWJsZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVsZXRlSXRlbS5kaXNhYmxlZCwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXNzaW9uQmFyIE1vcmUgbWVudSBjbG9zZXMgb24gRXNjYXBlIHdoZW4gZm9jdXMgaXMgb3V0c2lkZSB0aGUgcG9wdXAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zIH0gPSBtb3VudExlbnMoeyBsYXlvdXRXaWR0aDogTEVOU19NSU5fV0lEVEggfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgbW9yZUJ1dHRvbiA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLW1vcmUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRhc3NlcnQub2sobW9yZUJ1dHRvbik7XG5cdFx0bW9yZUJ1dHRvbi5jbGljaygpO1xuXHRcdGNvbnN0IHBvcHVwID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbW9yZS1wb3B1cCcpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2socG9wdXApO1xuXHRcdGNvbnN0IGNvbnRleHRWaWV3ID0gcG9wdXAuY2xvc2VzdCgnLmNvbnRleHQtdmlldycpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soY29udGV4dFZpZXcpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChjb250ZXh0Vmlldy5zdHlsZS5kaXNwbGF5LCAnbm9uZScpO1xuXHRcdGFzc2VydC5vayhsZW5zLnNlc3Npb25Nb3JlQ29udGV4dFZpZXcpO1xuXG5cdFx0Y29uc3Qgb3V0c2lkZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3V0c2lkZSk7XG5cdFx0c3RvcmUuYWRkKHsgZGlzcG9zZTogKCkgPT4gb3V0c2lkZS5yZW1vdmUoKSB9KTtcblx0XHRvdXRzaWRlLmZvY3VzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQsIG91dHNpZGUpO1xuXHRcdGFzc2VydC5vayghcG9wdXAuY29udGFpbnMoZG9jdW1lbnQuYWN0aXZlRWxlbWVudCkpO1xuXG5cdFx0Y29uc3QgZGlzcGF0Y2hFc2NhcGUgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBLZXlib2FyZEV2ZW50KCdrZXlkb3duJywgeyBrZXk6ICdFc2NhcGUnLCBidWJibGVzOiB0cnVlLCBjYW5jZWxhYmxlOiB0cnVlIH0pO1xuXHRcdFx0Ly8gRE9NIEVzY2FwZSBpcyAyNy4gU3RhbmRhcmRLZXlib2FyZEV2ZW50IG1hcHMgdGhhdCB0byBLZXlDb2RlLkVzY2FwZTsgdGhlIGNvbnN0cnVjdG9yIGRvZXMgbm90IHNldCBrZXlDb2RlLlxuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGV2ZW50LCAna2V5Q29kZScsIHsgZ2V0OiAoKSA9PiAyNyB9KTtcblx0XHRcdG91dHNpZGUuZGlzcGF0Y2hFdmVudChldmVudCk7XG5cdFx0XHRyZXR1cm4gZXZlbnQ7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGV2ZW50ID0gZGlzcGF0Y2hFc2NhcGUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dFZpZXcuc3R5bGUuZGlzcGxheSwgJ25vbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5zZXNzaW9uTW9yZUNvbnRleHRWaWV3LCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5kZWZhdWx0UHJldmVudGVkLCB0cnVlKTtcblxuXHRcdGNvbnN0IGFmdGVyQ2xvc2UgPSBkaXNwYXRjaEVzY2FwZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhZnRlckNsb3NlLmRlZmF1bHRQcmV2ZW50ZWQsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnU2Vzc2lvbkJhciBtZWRpdW0gd2lkdGgga2VlcHMgSGlzdG9yeSBhbmQgU25hcHNob3RzIGFzIGJhciBpY29ucycsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGFzc2VydC5vayhzbG90cy5zZXNzaW9uQmFyIS5jbGFzc0xpc3QuY29udGFpbnMoJ2lzLW1lZGl1bScpKTtcblx0XHRhc3NlcnQub2soIXNsb3RzLnNlc3Npb25CYXIhLmNsYXNzTGlzdC5jb250YWlucygnaXMtbmFycm93JykpO1xuXHRcdGNvbnN0IGhpc3RvcnkgPSBzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1oaXN0b3J5IC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0Y29uc3Qgc25hcHNob3RzID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tc25hcHNob3RzIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhpc3RvcnkuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFySGlzdG9yeSk7XG5cdFx0YXNzZXJ0Lm9rKGhpc3RvcnkuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2RpY29uLWhpc3RvcnknKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNuYXBzaG90cy5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJTbmFwc2hvdHMpO1xuXHRcdGFzc2VydC5vayhzbmFwc2hvdHMuY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2RpY29uLWxheWVycycpKTtcblx0fSk7XG5cblx0dGVzdCgnbWF4aW1pemUgaW5wdXQgY2xvc2VzIEhpc3RvcnkgYW5kIFNuYXBzaG90cyBvdmVybGF5cycsICgpID0+IHtcblx0XHRjb25zdCB7IGxlbnMgfSA9IG1vdW50TGVucygpO1xuXHRcdGFzc2VydC5vayhsZW5zLmVuZ2luZUhpc3RvcnlMaXN0KTtcblx0XHRhc3NlcnQub2sobGVucy5lbmdpbmVTbmFwc2hvdHNMaXN0KTtcblx0XHRsZW5zLmVuZ2luZUhpc3RvcnlMaXN0LnNob3coKTtcblx0XHRsZW5zLmVuZ2luZVNuYXBzaG90c0xpc3Quc2hvdygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmVuZ2luZUhpc3RvcnlMaXN0LmlzT3BlbigpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5lbmdpbmVTbmFwc2hvdHNMaXN0LmlzT3BlbigpLCB0cnVlKTtcblxuXHRcdGxlbnMuc2V0SW5wdXRNYXhpbWl6ZWQodHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5pc0lucHV0TWF4aW1pemVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmVuZ2luZUhpc3RvcnlMaXN0LmlzT3BlbigpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuZW5naW5lU25hcHNob3RzTGlzdC5pc09wZW4oKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzd2l0Y2hpbmcgc2Vzc2lvbiBjbG9zZXMgSGlzdG9yeSwgU25hcHNob3RzLCBhbmQgVmlzdWFsaXplIG92ZXJsYXlzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgbGVucywgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGFzc2VydC5vayhsZW5zLmVuZ2luZUhpc3RvcnlMaXN0KTtcblx0XHRhc3NlcnQub2sobGVucy5lbmdpbmVTbmFwc2hvdHNMaXN0KTtcblx0XHRsZW5zLmVuZ2luZUhpc3RvcnlMaXN0LnNob3coKTtcblx0XHRsZW5zLmVuZ2luZVNuYXBzaG90c0xpc3Quc2hvdygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmVuZ2luZUhpc3RvcnlMaXN0LmlzT3BlbigpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5lbmdpbmVTbmFwc2hvdHNMaXN0LmlzT3BlbigpLCB0cnVlKTtcblxuXHRcdHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmVuZ2luZUhpc3RvcnlMaXN0LmlzT3BlbigpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuZW5naW5lU25hcHNob3RzTGlzdC5pc09wZW4oKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdsZW5zSWQgcGVyc2lzdHMgYWNyb3NzIHJlbW91bnQgdmlhIHdvcmtzcGFjZSBzdG9yYWdlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgZmlyc3QgPSBtb3VudExlbnMoeyBzdG9yYWdlU2VydmljZSB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhmaXJzdC5wYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBmaXJzdC5zdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblxuXHRcdGNsaWNrTGVuc1RhYihzbG90cywgJ3RyYWplY3RvcnknKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RvcmFnZVNlcnZpY2UuZ2V0KGNvbnZlcnNhdGlvbkxlbnNJZFN0b3JhZ2VLZXkoc2Vzc2lvbklkKSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSksICd0cmFqZWN0b3J5Jyk7XG5cblx0XHRmaXJzdC5sZW5zLmRpc3Bvc2UoKTtcblx0XHRjb25zdCBzZWNvbmQgPSBtb3VudExlbnMoeyBzdG9yYWdlU2VydmljZSwgc3R1YlNlcnZpY2U6IGZpcnN0LnN0dWJTZXJ2aWNlIH0pO1xuXHRcdGNvbnN0IHJlbW91bnRlZFNsb3RzID0gZ2V0TGVuc1Nsb3RzKHNlY29uZC5wYXJ0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRMZW5zVGFiKHJlbW91bnRlZFNsb3RzLCAndHJhamVjdG9yeScpLmdldEF0dHJpYnV0ZSgnYXJpYS1zZWxlY3RlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5vayghcmVtb3VudGVkU2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXRyYWplY3RvcnknKSEuaGFzQXR0cmlidXRlKCdoaWRkZW4nKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N3aXRjaGluZyBzZXNzaW9ucyBrZWVwcyB0aGUgYWN0aXZlIGxlbnMgdGFiJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgxNTAwMCk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgZmlyc3RJZCA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IHNlY29uZElkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oZmlyc3RJZCwgJ0ZpcnN0IHNlc3Npb24gbWVzc2FnZScpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cdFx0Y2xpY2tMZW5zVGFiKHNsb3RzLCAndHJhamVjdG9yeScpO1xuXHRcdGxheW91dFJlYWRpbmdDb2x1bW4oKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXG5cdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbihzZWNvbmRJZCk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0TGVuc1RhYihzbG90cywgJ3RyYWplY3RvcnknKS5nZXRBdHRyaWJ1dGUoJ2FyaWEtc2VsZWN0ZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQub2soIXNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10cmFqZWN0b3J5JykhLmhhc0F0dHJpYnV0ZSgnaGlkZGVuJykpO1xuXHRcdGFzc2VydC5vayhzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHJhamVjdG9yeScpIS50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJOb1RyYWplY3RvcnkpKTtcblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgdHJhamVjdG9yeSBzaG93cyBob25lc3QgY29weSBmb3IgYW55IHplcm8tdHVybiBzZXNzaW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IGVtcHR5U2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdHN0dWJTZXJ2aWNlLnN3aXRjaFNlc3Npb24oZW1wdHlTZXNzaW9uSWQpO1xuXG5cdFx0Y2xpY2tMZW5zVGFiKHNsb3RzLCAndHJhamVjdG9yeScpO1xuXHRcdGxheW91dFJlYWRpbmdDb2x1bW4oKTtcblxuXHRcdGNvbnN0IHRyYWplY3RvcnkgPSBzbG90cy50aW1lbGluZS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHJhamVjdG9yeScpITtcblx0XHRhc3NlcnQub2sodHJhamVjdG9yeS50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJOb1RyYWplY3RvcnkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhamVjdG9yeS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHJhamVjdG9yeS1yZWNvcmQtcm93JyksIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmJveCBwZW5kaW5nIGNsaWNrIGZyb20gVHJhamVjdG9yeSBsZW5zIHN3aXRjaGVzIGJhY2sgdG8gQ29udmVyc2F0aW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgxNTAwMCk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0YXdhaXQgc2VlZFBlbmRpbmdDb25maXJtYXRpb24oc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0Y2xpY2tMZW5zVGFiKHNsb3RzLCAndHJhamVjdG9yeScpO1xuXHRcdGxheW91dFJlYWRpbmdDb2x1bW4oKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXG5cdFx0Y29uc3QgcGVuZGluZ0J1dHRvbiA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LXBlbmRpbmcnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRhc3NlcnQub2soIXBlbmRpbmdCdXR0b24uaGlkZGVuKTtcblxuXHRcdHBlbmRpbmdCdXR0b24uY2xpY2soKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRjb25zdCBjb25maXJtYXRpb25UdXJuID0gc3R1YlNlcnZpY2UuZ2V0VHVybnMoc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCkpLmZpbmQodHVybiA9PiB0dXJuLmtpbmQgPT09ICdjb25maXJtYXRpb24nKTtcblx0XHRhc3NlcnQub2soY29uZmlybWF0aW9uVHVybik7XG5cdFx0YXdhaXQgcmV2ZWFsVmlzdWFsaXplVHVybihsZW5zLCBsYXlvdXRSZWFkaW5nQ29sdW1uLCBjb25maXJtYXRpb25UdXJuLmlkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRMZW5zVGFiKHNsb3RzLCAnY29udmVyc2F0aW9uJykuZ2V0QXR0cmlidXRlKCdhcmlhLXNlbGVjdGVkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuaXNJbnB1dE1heGltaXplZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtY29uZmlybWF0aW9uLXNlYXQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3RoaW5raW5nIGFuZCB0b29sIHR1cm5zIHJlbmRlciBpbnNpZGUgYSBjb2xsYXBzZWQgcHJvY2VzcyBmb2xkIGJ5IGRlZmF1bHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFRoaW5raW5nVHVybihzZXNzaW9uSWQsICdXZWlnaGluZyBvcHRpb25zJyk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVG9vbFR1cm4oc2Vzc2lvbklkLCAnZ3JlcCBzcmMnKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0Y29uc3QgZm9sZCA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICdbZGF0YS1wcm9jZXNzLWZvbGRdJyk7XG5cdFx0YXNzZXJ0Lm9rKGZvbGQpO1xuXHRcdGNvbnN0IGhlYWRlciA9IGZvbGQhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLWhlYWRlcicpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoZWFkZXIuZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJyksICdmYWxzZScpO1xuXHRcdGNvbnN0IGNoaWxkcmVuID0gZm9sZCEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtY2hpbGRyZW4nKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW4uaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoaWxkcmVuLmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC0tY29sbGFwc2VkJyksIHRydWUpO1xuXHRcdGFzc2VydC5vayhoZWFkZXIudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdTdHViJykpO1xuXG5cdFx0aGVhZGVyLmNsaWNrKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlsZHJlbi5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW4uY2xhc3NMaXN0LmNvbnRhaW5zKCdjb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLS1jb2xsYXBzZWQnKSwgZmFsc2UpO1xuXHRcdGNvbnN0IHRoaW5raW5nID0gZm9sZCEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtdGhpbmtpbmdbZGF0YS1raW5kPVwidGhpbmtpbmdcIl0nKTtcblx0XHRjb25zdCB0b29sID0gZm9sZCEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtdG9vbFtkYXRhLWtpbmQ9XCJ0b29sXCJdJyk7XG5cdFx0YXNzZXJ0Lm9rKHRoaW5raW5nPy50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ1dlaWdoaW5nIG9wdGlvbnMnKSk7XG5cdFx0YXNzZXJ0Lm9rKHRvb2w/LnRleHRDb250ZW50Py5pbmNsdWRlcygnZ3JlcCBzcmMnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NvbnZlcnNhdGlvblBhcnQuZm9jdXMgbGFuZHMgb24gZG9jayB0ZXh0YXJlYSB3aGVuIGxlbnMgaXMgbW91bnRlZCcsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCd0ZXh0YXJlYS5jb252ZXJzYXRpb24tbGVucy1kb2NrLWlucHV0JykgYXMgSFRNTFRleHRBcmVhRWxlbWVudDtcblxuXHRcdHBhcnQuZm9jdXMoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2N1bWVudC5hY3RpdmVFbGVtZW50LCB0ZXh0YXJlYSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NvbnZlcnNhdGlvblBhcnQuZm9jdXMgZmFsbHMgYmFjayB0byBwYXJ0IGVsZW1lbnQgd2l0aG91dCBsZW5zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBzdG9yZSk7XG5cdFx0Y29uc3QgcGFydCA9IHN0b3JlLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb252ZXJzYXRpb25QYXJ0KSk7XG5cdFx0Y29uc3QgcGFyZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChwYXJlbnQpO1xuXHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gcGFyZW50LnJlbW92ZSgpKSk7XG5cdFx0cGFydC5jcmVhdGUocGFyZW50KTtcblxuXHRcdHBhcnQuZm9jdXMoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2N1bWVudC5hY3RpdmVFbGVtZW50LCBwYXJlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmJveCBvdmVybGF5IGlzIGhvbmVzdDogbm8gaW5saW5lIHF1ZXVlIHJvd3MgdW50aWwgb3BlbmVkLCBwZW5kaW5nIGhpZGRlbiB3aXRob3V0IGNvbmZpcm1hdGlvbnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3QgZW1wdHlTbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0Ly8gUHJlRmlyc3Qga2VlcHMgdGhlIG92ZXJsYXkgbW91bnRlZCBhbmQgaGlkZXMgaXQ7IGl0IGRvZXMgbm90IHVubW91bnQuXG5cdFx0Y29uc3QgcHJlZmlyc3RJbmJveCA9IGVtcHR5U2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtb3ZlcmxheScpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2socHJlZmlyc3RJbmJveCk7XG5cdFx0YXNzZXJ0Lm9rKHByZWZpcnN0SW5ib3guaGlkZGVuKTtcblxuXHRcdGF3YWl0IHNlbmREb2NrRHJhZnQoZW1wdHlTbG90cywgJ0FjdGl2YXRlIGluYm94IG92ZXJsYXknKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBvdmVybGF5ID0gZ2V0SW5ib3hPdmVybGF5KHNsb3RzKTtcblx0XHRjb25zdCBwZW5kaW5nQnV0dG9uID0gb3ZlcmxheS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtcGVuZGluZycpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXG5cdFx0YXNzZXJ0Lm9rKGdldEluYm94UXVldWVDaGlwKHNsb3RzKS50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc0RvY2tJbmJveE5vUXVldWUpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3ZlcmxheS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtbWVzc2FnZS1xdWV1ZS1saXN0JyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdmVybGF5LnF1ZXJ5U2VsZWN0b3IoJy5xdWV1ZS1pdGVtJyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtaW5ib3gtYmFkZ2UnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBlbmRpbmdCdXR0b24uaGlkZGVuLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgncGFpcmluZy1ob2xkIGxlZnRvdmVyIHBlbmRpbmcgY29uZmlybWF0aW9uIHN0YXlzIGRpc2FibGVkIGFuZCBkb2VzIG5vdCByZXNvbHZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2UgPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7XG5cdFx0XHRcdC4uLmJhc2UuZ2V0Q29ubmVjdGlvblNuYXBzaG90KCksXG5cdFx0XHRcdHBhaXJpbmdQZW5kaW5nOiB0cnVlLFxuXHRcdFx0fSksXG5cdFx0fSk7XG5cdFx0Y29uc3Qgc3R1YlNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25JZCwgJ0hlbHAgbWUgc2NhZmZvbGQgdGhlIHByb2plY3QgUkVBRE1FLicpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZENvbmZpcm1hdGlvblR1cm4oc2Vzc2lvbklkLCAnV3JpdGUgUkVBRE1FLm1kPycpO1xuXHRcdGNvbnN0IHsgcGFydCwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKHsgbGF5b3V0SGVpZ2h0OiAxMjAwLCBjb25uZWN0aW9uLCBzdHViU2VydmljZSB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRjb25zdCBzZWF0ID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy1jb25maXJtYXRpb24tc2VhdCcpO1xuXHRcdGFzc2VydC5vayhzZWF0KTtcblx0XHRjb25zdCBhbGxvd0J1dHRvbiA9IHNlYXQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbmZpcm1hdGlvbi1hY3Rpb25zIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayhhbGxvd0J1dHRvbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFsbG93QnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdGFsbG93QnV0dG9uLmNsaWNrKCk7XG5cdFx0YXdhaXQgZmx1c2hQcm9qZWN0ZWRUaW1lbGluZShsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblx0XHRjb25zdCBzZWF0QWZ0ZXIgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLWNvbmZpcm1hdGlvbi1zZWF0JykhO1xuXHRcdGFzc2VydC5vayhzZWF0QWZ0ZXIudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdjb25maXJtYXRpb24gcGVuZGluZycpKTtcblx0XHRhc3NlcnQub2soIXNlYXRBZnRlci50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0FsbG93ZWQnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldFR1cm5zKHNlc3Npb25JZCkuZmluZCh0dXJuID0+IHR1cm4ua2luZCA9PT0gJ2NvbmZpcm1hdGlvbicpPy5zdGF0dXMsICdwZW5kaW5nJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhaXJpbmctaG9sZCBsZWZ0b3ZlciBhc3Npc3RhbnQgZGVsZXRlIHN0YXlzIGRpc2FibGVkIGFuZCBkb2VzIG5vdCBkZWxldGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZSA9IGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1YigpO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoe1xuXHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Li4uYmFzZS5nZXRDb25uZWN0aW9uU25hcHNob3QoKSxcblx0XHRcdFx0cGFpcmluZ1BlbmRpbmc6IHRydWUsXG5cdFx0XHR9KSxcblx0XHR9KTtcblx0XHRjb25zdCBzdHViU2VydmljZSA9IHN0b3JlLmFkZChuZXcgQ29udmVyc2F0aW9uU3R1YlNlcnZpY2UoKSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbklkLCAnS2VlcCB0aGlzIGxlZnRvdmVyJyk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kU3R1YkVjaG9Bc3Npc3RhbnQoc2Vzc2lvbklkLCAnQ2FjaGVkIGFzc2lzdGFudCcpO1xuXHRcdGNvbnN0IHsgcGFydCwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKHsgY29ubmVjdGlvbiwgc3R1YlNlcnZpY2UgfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cdFx0Y29uc3QgZGVsZXRlQnV0dG9uID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWFjdGlvbi1kZWxldGUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKGRlbGV0ZUJ1dHRvbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlbGV0ZUJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ3RydWUnKTtcblx0XHRkZWxldGVCdXR0b24uY2xpY2soKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGFzc2VydC5vayhzdHViU2VydmljZS5nZXRUdXJucyhzZXNzaW9uSWQpLnNvbWUodHVybiA9PiB0dXJuLmtpbmQgPT09ICdhc3Npc3RhbnQnICYmIHR1cm4udGV4dCA9PT0gJ0NhY2hlZCBhc3Npc3RhbnQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FsbG93IG9uIGNvbmZpcm1hdGlvbiBoaWRlcyBDVEFzIGFuZCB1cGRhdGVzIGluYm94IHBlbmRpbmcgY291bnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0YXdhaXQgc2VlZFBlbmRpbmdDb25maXJtYXRpb24oc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGNvbnN0IHNlYXQgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLWNvbmZpcm1hdGlvbi1zZWF0JykhO1xuXHRcdGNvbnN0IGFsbG93QnV0dG9uID0gc2VhdC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtY29uZmlybWF0aW9uLWFjdGlvbnMgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0Y29uc3QgcGVuZGluZ0J1dHRvbiA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWluYm94LXBlbmRpbmcnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblxuXHRcdGFzc2VydC5vayhhbGxvd0J1dHRvbik7XG5cdFx0YWxsb3dCdXR0b24uY2xpY2soKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0Y29uc3Qgc2VhdEFmdGVyID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy1jb25maXJtYXRpb24tc2VhdCcpITtcblx0XHRjb25zdCBidXR0b25zQWZ0ZXIgPSBbLi4uc2VhdEFmdGVyLnF1ZXJ5U2VsZWN0b3JBbGwoJ2J1dHRvbiwgLm1vbmFjby1idXR0b24nKV0ubWFwKGVsID0+IGVsLnRleHRDb250ZW50Py50cmltKCkpO1xuXHRcdGFzc2VydC5vayghYnV0dG9uc0FmdGVyLmluY2x1ZGVzKCdBbGxvdycpKTtcblx0XHRhc3NlcnQub2soIWJ1dHRvbnNBZnRlci5pbmNsdWRlcygnU2tpcCcpKTtcblx0XHRhc3NlcnQub2soc2VhdEFmdGVyLnRleHRDb250ZW50Py5pbmNsdWRlcygnQWxsb3dlZCcpKTtcblx0XHRhc3NlcnQub2soc2VhdEFmdGVyLnRleHRDb250ZW50Py5pbmNsdWRlcygnV3JpdGUgUkVBRE1FLm1kPycpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGVuZGluZ0J1dHRvbi5oaWRkZW4sIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2NrIGFwcGVuZHMgYSBsb2NhbCB1c2VyIHR1cm4gYW5kIHN0dWIgZWNobyB0byB0aGUgY3VycmVudCBzZXNzaW9uIHRpbWVsaW5lJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgxNTAwMCk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBnZXREb2NrVGV4dGFyZWEoc2xvdHMpO1xuXG5cdFx0Y29uc3QgbWVzc2FnZSA9ICdMb2NhbCBzdHViIG1lc3NhZ2UgZnJvbSB0ZXN0Jztcblx0XHRhc3NlcnQub2soIXNsb3RzLnRpbWVsaW5lLnRleHRDb250ZW50Py5pbmNsdWRlcyhtZXNzYWdlKSk7XG5cblx0XHRhd2FpdCBzZW5kRG9ja0RyYWZ0QW5kRmx1c2goc2xvdHMsIG1lc3NhZ2UsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGF3YWl0IHJldmVhbExhdGVzdFR1cm4obGVucywgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4sIHR1cm4gPT4gdHVybi5raW5kID09PSAndXNlcicgJiYgdHVybi50ZXh0ID09PSBtZXNzYWdlKTtcblx0XHRhc3NlcnQub2soc2xvdHMudGltZWxpbmUudGV4dENvbnRlbnQ/LmluY2x1ZGVzKG1lc3NhZ2UpKTtcblxuXHRcdGF3YWl0IHJldmVhbExhdGVzdFR1cm4obGVucywgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4sIHR1cm4gPT4gdHVybi5raW5kID09PSAnYXNzaXN0YW50JyAmJiB0dXJuLnN0dWJFY2hvID09PSB0cnVlKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJ1tkYXRhLXN0dWI9XCJ0cnVlXCJdJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJycpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2NrIG1heGltaXplIGlucHV0IHRvZ2dsZXMgY29udmVyc2F0aW9uLWxlbnMtaW5wdXQtbWF4aW1pemVkIG9uIHNsb3QgaG9zdHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBtYXhpbWl6ZUJ1dHRvbiA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stbWF4aW1pemUtaW5wdXQgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblxuXHRcdGFzc2VydC5vayhtYXhpbWl6ZUJ1dHRvbik7XG5cdFx0YXNzZXJ0Lm9rKG1heGltaXplQnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnY29kaWNvbi1zY3JlZW4tZnVsbCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWF4aW1pemVCdXR0b24uZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNEb2NrTWF4aW1pemVJbnB1dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuaXNJbnB1dE1heGltaXplZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLnRpbWVsaW5lLmNsYXNzTGlzdC5jb250YWlucyhjb252ZXJzYXRpb25MZW5zSW5wdXRNYXhpbWl6ZWRDbGFzcyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuZG9jay5jbGFzc0xpc3QuY29udGFpbnMoY29udmVyc2F0aW9uTGVuc0lucHV0TWF4aW1pemVkQ2xhc3MpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLnNlc3Npb25CYXIhLmNsYXNzTGlzdC5jb250YWlucyhjb252ZXJzYXRpb25MZW5zSW5wdXRNYXhpbWl6ZWRDbGFzcyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tbWF4aW1pemUnKSwgbnVsbCk7XG5cblx0XHRtYXhpbWl6ZUJ1dHRvbi5jbGljaygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuaXNJbnB1dE1heGltaXplZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQub2sobWF4aW1pemVCdXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjb2RpY29uLXNjcmVlbi1ub3JtYWwnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1heGltaXplQnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCBjb252ZXJzYXRpb25MZW5zRG9ja1Jlc3RvcmVUaW1lbGluZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1heGltaXplQnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1wcmVzc2VkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLnRpbWVsaW5lLmNsYXNzTGlzdC5jb250YWlucyhjb252ZXJzYXRpb25MZW5zSW5wdXRNYXhpbWl6ZWRDbGFzcyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy5kb2NrLmNsYXNzTGlzdC5jb250YWlucyhjb252ZXJzYXRpb25MZW5zSW5wdXRNYXhpbWl6ZWRDbGFzcyksIHRydWUpO1xuXG5cdFx0bWF4aW1pemVCdXR0b24uY2xpY2soKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmlzSW5wdXRNYXhpbWl6ZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhtYXhpbWl6ZUJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NvZGljb24tc2NyZWVuLWZ1bGwnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1heGltaXplQnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCBjb252ZXJzYXRpb25MZW5zRG9ja01heGltaXplSW5wdXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXhpbWl6ZUJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtcHJlc3NlZCcpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2xvdHMudGltZWxpbmUuY2xhc3NMaXN0LmNvbnRhaW5zKGNvbnZlcnNhdGlvbkxlbnNJbnB1dE1heGltaXplZENsYXNzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy5kb2NrLmNsYXNzTGlzdC5jb250YWlucyhjb252ZXJzYXRpb25MZW5zSW5wdXRNYXhpbWl6ZWRDbGFzcyksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnbmFycm93IE1vcmUgbWVudSBzYXlzIFJlc3RvcmUgdGltZWxpbmUgd2hlbiBpbnB1dCBpcyBtYXhpbWl6ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zIH0gPSBtb3VudExlbnMoeyBsYXlvdXRXaWR0aDogTEVOU19NSU5fV0lEVEggfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0bGVucy5zZXRJbnB1dE1heGltaXplZCh0cnVlKTtcblx0XHRjb25zdCBtb3JlQnV0dG9uID0gZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRtb3JlQnV0dG9uLmNsaWNrKCk7XG5cblx0XHRjb25zdCBwb3B1cCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtcG9wdXAnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHBvcHVwKTtcblx0XHRjb25zdCByZXN0b3JlID0gWy4uLnBvcHVwLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtaXRlbScpXS5maW5kKGl0ZW0gPT4gaXRlbS50ZXh0Q29udGVudCA9PT0gY29udmVyc2F0aW9uTGVuc0RvY2tSZXN0b3JlVGltZWxpbmUpO1xuXHRcdGFzc2VydC5vayhyZXN0b3JlKTtcblx0XHRhc3NlcnQub2soIVsuLi5wb3B1cC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLWl0ZW0nKV0uc29tZShpdGVtID0+IGl0ZW0udGV4dENvbnRlbnQgPT09IGNvbnZlcnNhdGlvbkxlbnNEb2NrTWF4aW1pemVJbnB1dCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnB1dCBtYXhpbWl6ZSBrZWVwcyBwZW5kaW5nIGNvbmZpcm1hdGlvbiByZWFjaGFibGUgdmlhIGRvY2sgaW5ib3ggcm93JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucywgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IG1heGltaXplQnV0dG9uID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tYXhpbWl6ZS1pbnB1dCAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGNvbnN0IHBlbmRpbmdCdXR0b24gPSBzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1pbmJveC1wZW5kaW5nJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cblx0XHRhd2FpdCBzZWVkUGVuZGluZ0NvbmZpcm1hdGlvbihzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cblx0XHRhc3NlcnQub2socGVuZGluZ0J1dHRvbik7XG5cdFx0YXNzZXJ0Lm9rKCFwZW5kaW5nQnV0dG9uLmhpZGRlbik7XG5cblx0XHRtYXhpbWl6ZUJ1dHRvbi5jbGljaygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmlzSW5wdXRNYXhpbWl6ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKCFwZW5kaW5nQnV0dG9uLmhpZGRlbik7XG5cdFx0YXNzZXJ0Lm9rKHBlbmRpbmdCdXR0b24udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdjb25maXJtYXRpb24gcGVuZGluZycpKTtcblxuXHRcdHBlbmRpbmdCdXR0b24uY2xpY2soKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmlzSW5wdXRNYXhpbWl6ZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLWNvbmZpcm1hdGlvbi1zZWF0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXNzaW9uQmFyIHdyaXRlIGNocm9tZSBkaXNhYmxlcyB3aGlsZSBwYWlyaW5nLWhvbGQgbGVmdG92ZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZSA9IGNyZWF0ZUNvbnZlcnNhdGlvbkNvbm5lY3Rpb25UZXN0U3R1YigpO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoe1xuXHRcdFx0Z2V0Q29ubmVjdGlvblBoYXNlOiAoKSA9PiAoeyBraW5kOiAnY29ubmVjdGVkJywgcGF0aDogJ2xvb3BiYWNrJyB9KSxcblx0XHRcdGdldENvbm5lY3Rpb25TbmFwc2hvdDogKCkgPT4gKHtcblx0XHRcdFx0Li4uYmFzZS5nZXRDb25uZWN0aW9uU25hcHNob3QoKSxcblx0XHRcdFx0cGFpcmluZ1BlbmRpbmc6IHRydWUsXG5cdFx0XHR9KSxcblx0XHR9KTtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoeyBjb25uZWN0aW9uIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRpdGxlQnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignYnV0dG9uLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCBuZXdCdXR0b24gPSBzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1uZXcgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCBkZWxldGVCdXR0b24gPSBzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1kZWxldGUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCBwcmV2aW91c1RpdGxlID0gc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbigpLnRpdGxlO1xuXHRcdGNvbnN0IHByZXZpb3VzQ291bnQgPSBzdHViU2VydmljZS5nZXRTZXNzaW9ucygpLmxlbmd0aDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGVCdXR0b24uZGlzYWJsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZUJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ2FyaWEtZGlzYWJsZWQnKSwgJ3RydWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3QnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVCdXR0b24uZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cdFx0dGl0bGVCdXR0b24uY2xpY2soKTtcblx0XHRhc3NlcnQub2soIXRpdGxlQnV0dG9uLmhpZGRlbik7XG5cdFx0bmV3QnV0dG9uLmNsaWNrKCk7XG5cdFx0ZGVsZXRlQnV0dG9uLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb24oKS50aXRsZSwgcHJldmlvdXNUaXRsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkubGVuZ3RoLCBwcmV2aW91c0NvdW50KTtcblx0fSk7XG5cblx0dGVzdCgnbmFycm93IE1vcmUgZGlzYWJsZXMgbmV3IGFuZCBkZWxldGUgd2hpbGUgcGFpcmluZy1ob2xkIGxlZnRvdmVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2UgPSBjcmVhdGVDb252ZXJzYXRpb25Db25uZWN0aW9uVGVzdFN0dWIoKTtcblx0XHRjb25zdCBjb25uZWN0aW9uID0gY3JlYXRlQ29udmVyc2F0aW9uQ29ubmVjdGlvblRlc3RTdHViKHtcblx0XHRcdGdldENvbm5lY3Rpb25QaGFzZTogKCkgPT4gKHsga2luZDogJ2Nvbm5lY3RlZCcsIHBhdGg6ICdsb29wYmFjaycgfSksXG5cdFx0XHRnZXRDb25uZWN0aW9uU25hcHNob3Q6ICgpID0+ICh7XG5cdFx0XHRcdC4uLmJhc2UuZ2V0Q29ubmVjdGlvblNuYXBzaG90KCksXG5cdFx0XHRcdHBhaXJpbmdQZW5kaW5nOiB0cnVlLFxuXHRcdFx0fSksXG5cdFx0fSk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSB9ID0gbW91bnRMZW5zKHsgY29ubmVjdGlvbiwgbGF5b3V0V2lkdGg6IExFTlNfTUlOX1dJRFRIIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHByZXZpb3VzQ291bnQgPSBzdHViU2VydmljZS5nZXRTZXNzaW9ucygpLmxlbmd0aDtcblx0XHRjb25zdCBtb3JlQnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tbW9yZSAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdG1vcmVCdXR0b24uY2xpY2soKTtcblx0XHRjb25zdCBwb3B1cCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1vcmUtcG9wdXAnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHBvcHVwKTtcblx0XHRjb25zdCBpdGVtID0gKGxhYmVsOiBzdHJpbmcpID0+IFsuLi5wb3B1cC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1tb3JlLWl0ZW0nKV0uZmluZChlbCA9PiBlbC50ZXh0Q29udGVudCA9PT0gbGFiZWwpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGNvbnN0IG5ld0l0ZW0gPSBpdGVtKGNvbnZlcnNhdGlvbkxlbnNTZXNzaW9uQmFyTmV3U2Vzc2lvbik7XG5cdFx0Y29uc3QgZGVsZXRlSXRlbSA9IGl0ZW0oY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJEZWxldGVTZXNzaW9uKTtcblx0XHRjb25zdCBoaXN0b3J5SXRlbSA9IGl0ZW0oY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CYXJIaXN0b3J5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3SXRlbS5kaXNhYmxlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0l0ZW0uZ2V0QXR0cmlidXRlKCdhcmlhLWRpc2FibGVkJyksICd0cnVlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlbGV0ZUl0ZW0uZGlzYWJsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWxldGVJdGVtLmdldEF0dHJpYnV0ZSgnYXJpYS1kaXNhYmxlZCcpLCAndHJ1ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoaXN0b3J5SXRlbS5kaXNhYmxlZCwgZmFsc2UpO1xuXHRcdG5ld0l0ZW0uY2xpY2soKTtcblx0XHRkZWxldGVJdGVtLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkubGVuZ3RoLCBwcmV2aW91c0NvdW50KTtcblx0XHRjb25zdCBnYXRlUm93ID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1nYXRlLXJvdycpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IGdhdGVMYWJlbCA9IGdhdGVSb3cucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stZ2F0ZS1sYWJlbCcpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnYXRlUm93LmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnYXRlUm93LmdldEF0dHJpYnV0ZSgncm9sZScpLCAnc3RhdHVzJyk7XG5cdFx0YXNzZXJ0Lm9rKCFnYXRlUm93LmNsYXNzTGlzdC5jb250YWlucygnaXMtZXJyb3InKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVMYWJlbC50ZXh0Q29udGVudCwgY29udmVyc2F0aW9uTGVuc0RvY2tFbmdpbmVOb3RDb25uZWN0ZWQpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChnYXRlTGFiZWwudGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkRGlzY29ubmVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnU2Vzc2lvbkJhciB0aXRsZSBidXR0b24gZW50ZXJzIHJlbmFtZSBtb2RlIGFuZCBjb21taXRzIG9uIEVudGVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRpdGxlQnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignYnV0dG9uLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCB0aXRsZUlucHV0ID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignaW5wdXQuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi10aXRsZS1pbnB1dCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0Y29uc3QgcHJldmlvdXNUaXRsZSA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb24oKS50aXRsZTtcblxuXHRcdGFzc2VydC5vayh0aXRsZUJ1dHRvbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRpdGxlQnV0dG9uLnRpdGxlLCAnJyk7XG5cdFx0YXNzZXJ0Lm9rKHRpdGxlSW5wdXQuaGlkZGVuKTtcblxuXHRcdHRpdGxlQnV0dG9uLmNsaWNrKCk7XG5cblx0XHRhc3NlcnQub2sodGl0bGVCdXR0b24uaGlkZGVuKTtcblx0XHRhc3NlcnQub2soIXRpdGxlSW5wdXQuaGlkZGVuKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGVJbnB1dC52YWx1ZSwgcHJldmlvdXNUaXRsZSk7XG5cblx0XHR0aXRsZUlucHV0LnZhbHVlID0gJ1JlbmFtZWQgZnJvbSB0ZXN0Jztcblx0XHR0aXRsZUlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IGtleTogJ0VudGVyJywga2V5Q29kZTogS2V5Q29kZS5FbnRlciwgYnViYmxlczogdHJ1ZSB9KSk7XG5cblx0XHRhc3NlcnQub2soIXRpdGxlQnV0dG9uLmhpZGRlbik7XG5cdFx0YXNzZXJ0Lm9rKHRpdGxlSW5wdXQuaGlkZGVuKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGVCdXR0b24udGV4dENvbnRlbnQsICdSZW5hbWVkIGZyb20gdGVzdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uKCkudGl0bGUsICdSZW5hbWVkIGZyb20gdGVzdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRTZXNzaW9ucygpLmZpbmQocyA9PiBzLmlkID09PSBzZXNzaW9uSWQpPy50aXRsZSwgJ1JlbmFtZWQgZnJvbSB0ZXN0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldENvbnZlcnNhdGlvblNlc3Npb25TdGF0dXNUZXh0KHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb24oKSksICdSZW5hbWVkIGZyb20gdGVzdCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXNzaW9uQmFyIHJlbmFtZSByZWplY3RzIGVtcHR5IHRpdGxlIGFuZCBFc2NhcGUgY2FuY2VscyBlZGl0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRpdGxlQnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignYnV0dG9uLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCB0aXRsZUlucHV0ID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignaW5wdXQuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi10aXRsZS1pbnB1dCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG5cdFx0Y29uc3QgcHJldmlvdXNUaXRsZSA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb24oKS50aXRsZTtcblxuXHRcdHRpdGxlQnV0dG9uLmNsaWNrKCk7XG5cdFx0dGl0bGVJbnB1dC52YWx1ZSA9ICcgICAnO1xuXHRcdHRpdGxlSW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnYmx1cicsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbigpLnRpdGxlLCBwcmV2aW91c1RpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGVCdXR0b24udGV4dENvbnRlbnQsIHByZXZpb3VzVGl0bGUpO1xuXG5cdFx0dGl0bGVCdXR0b24uY2xpY2soKTtcblx0XHR0aXRsZUlucHV0LnZhbHVlID0gJ1RlbXBvcmFyeSBlZGl0Jztcblx0XHR0aXRsZUlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IGtleTogJ0VzY2FwZScsIGtleUNvZGU6IEtleUNvZGUuRXNjYXBlLCBidWJibGVzOiB0cnVlIH0pKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uKCkudGl0bGUsIHByZXZpb3VzVGl0bGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZUJ1dHRvbi50ZXh0Q29udGVudCwgcHJldmlvdXNUaXRsZSk7XG5cdFx0YXNzZXJ0Lm9rKCF0aXRsZUJ1dHRvbi5oaWRkZW4pO1xuXHRcdGFzc2VydC5vayh0aXRsZUlucHV0LmhpZGRlbik7XG5cdH0pO1xuXG5cdHRlc3QoJ1Nlc3Npb25CYXIgc2VsZWN0IGFuZCBhcmlhLWxpdmUgc3RheSBpbiBzeW5jIGFmdGVyIHJlbmFtZScsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCB0aXRsZUJ1dHRvbiA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbi5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXRpdGxlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0Y29uc3QgdGl0bGVJbnB1dCA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0LmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUtaW5wdXQnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuXHRcdGNvbnN0IHRpdGxlTGl2ZSA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXRpdGxlLWxpdmUnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblxuXHRcdGFzc2VydC5vayh0aXRsZUxpdmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZUxpdmUuZ2V0QXR0cmlidXRlKCdhcmlhLWxpdmUnKSwgJ3BvbGl0ZScpO1xuXG5cdFx0dGl0bGVCdXR0b24uY2xpY2soKTtcblx0XHR0aXRsZUlucHV0LnZhbHVlID0gJ1JlbmFtZWQgZm9yIHNlbGVjdCBzeW5jJztcblx0XHR0aXRsZUlucHV0LmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IGtleTogJ0VudGVyJywga2V5Q29kZTogS2V5Q29kZS5FbnRlciwgYnViYmxlczogdHJ1ZSB9KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGVCdXR0b24udGV4dENvbnRlbnQsICdSZW5hbWVkIGZvciBzZWxlY3Qgc3luYycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZUxpdmUudGV4dENvbnRlbnQsICdSZW5hbWVkIGZvciBzZWxlY3Qgc3luYycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRTZXNzaW9uU2VsZWN0TGFiZWwoc2xvdHMpLCAnUmVuYW1lZCBmb3Igc2VsZWN0IHN5bmMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKS5maW5kKHMgPT4gcy5pZCA9PT0gc2Vzc2lvbklkKT8udGl0bGUsICdSZW5hbWVkIGZvciBzZWxlY3Qgc3luYycpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXNzaW9uQmFyIHJlbmFtZVNlc3Npb24gZmFsc2Ugc2hvd3MgZmFpbGVkIG5vdGljZSBhbmQga2VlcHMgcHJldmlvdXMgdGl0bGUnLCAoKSA9PiB7XG5cdFx0Y2xhc3MgUmVqZWN0aW5nUmVuYW1lUm9zdGVyIGV4dGVuZHMgQ29udmVyc2F0aW9uU3R1YlNlcnZpY2Uge1xuXHRcdFx0b3ZlcnJpZGUgcmVuYW1lU2Vzc2lvbihfc2Vzc2lvbklkOiBzdHJpbmcsIF90aXRsZTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgcm9zdGVyID0gc3RvcmUuYWRkKG5ldyBSZWplY3RpbmdSZW5hbWVSb3N0ZXIoKSk7XG5cdFx0Y29uc3QgeyBwYXJ0IH0gPSBtb3VudExlbnMoeyBzdHViU2VydmljZTogcm9zdGVyIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRpdGxlQnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignYnV0dG9uLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUnKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCB0aXRsZUlucHV0ID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignaW5wdXQuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi10aXRsZS1pbnB1dCcpIGFzIEhUTUxJbnB1dEVsZW1lbnQ7XG5cdFx0Y29uc3QgdGl0bGVMaXZlID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUtbGl2ZScpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHJvc3Rlci5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBwcmV2aW91c1RpdGxlID0gcm9zdGVyLmdldEFjdGl2ZVNlc3Npb24oKS50aXRsZTtcblxuXHRcdHRpdGxlQnV0dG9uLmNsaWNrKCk7XG5cdFx0dGl0bGVJbnB1dC52YWx1ZSA9ICdSZWplY3RlZCByZW5hbWUnO1xuXHRcdHRpdGxlSW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicsIHsga2V5OiAnRW50ZXInLCBrZXlDb2RlOiBLZXlDb2RlLkVudGVyLCBidWJibGVzOiB0cnVlIH0pKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0QWN0aXZlU2Vzc2lvbigpLnRpdGxlLCBwcmV2aW91c1RpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmdldFNlc3Npb25zKCkuZmluZChzID0+IHMuaWQgPT09IHNlc3Npb25JZCk/LnRpdGxlLCBwcmV2aW91c1RpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGVCdXR0b24udGV4dENvbnRlbnQsIHByZXZpb3VzVGl0bGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aXRsZUxpdmUudGV4dENvbnRlbnQsIHByZXZpb3VzVGl0bGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRTZXNzaW9uU2VsZWN0TGFiZWwoc2xvdHMpLCBwcmV2aW91c1RpdGxlKTtcblx0XHRhc3NlcnQub2soIXRpdGxlQnV0dG9uLmhpZGRlbik7XG5cdFx0YXNzZXJ0Lm9rKHRpdGxlSW5wdXQuaGlkZGVuKTtcblx0XHRjb25zdCBnYXRlUm93ID0gKGdldFJlYWRpbmdDb2x1bW4oc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93Jylcblx0XHRcdD8/IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stZ2F0ZS1yb3cnKSkgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayhnYXRlUm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2F0ZVJvdy5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQub2soZ2F0ZVJvdy50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc1Bvc3RGYWlsZWQpKTtcblx0fSk7XG5cblx0dGVzdCgnU2Vzc2lvbkJhciByZW5hbWVTZXNzaW9uIGZhbHNlIGFmdGVyIGVuZ2luZS1jYWNoZSBkaXNjb25uZWN0IHNob3dzIGRpc2Nvbm5lY3RlZCBub3RpY2UnLCAoKSA9PiB7XG5cdFx0Y2xhc3MgRW5naW5lQ2FjaGVSZWplY3RpbmdSZW5hbWVSb3N0ZXIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRvdmVycmlkZSBoYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeSgpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSByZW5hbWVTZXNzaW9uKF9zZXNzaW9uSWQ6IHN0cmluZywgX3RpdGxlOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCByb3N0ZXIgPSBzdG9yZS5hZGQobmV3IEVuZ2luZUNhY2hlUmVqZWN0aW5nUmVuYW1lUm9zdGVyKCkpO1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCB0aXRsZUJ1dHRvbiA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbi5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXRpdGxlJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0Y29uc3QgdGl0bGVJbnB1dCA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0LmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUtaW5wdXQnKSBhcyBIVE1MSW5wdXRFbGVtZW50O1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHJvc3Rlci5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBwcmV2aW91c1RpdGxlID0gcm9zdGVyLmdldEFjdGl2ZVNlc3Npb24oKS50aXRsZTtcblxuXHRcdHRpdGxlQnV0dG9uLmNsaWNrKCk7XG5cdFx0dGl0bGVJbnB1dC52YWx1ZSA9ICdSZWplY3RlZCB3aGlsZSBkaXNjb25uZWN0ZWQnO1xuXHRcdHRpdGxlSW5wdXQuZGlzcGF0Y2hFdmVudChuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicsIHsga2V5OiAnRW50ZXInLCBrZXlDb2RlOiBLZXlDb2RlLkVudGVyLCBidWJibGVzOiB0cnVlIH0pKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0QWN0aXZlU2Vzc2lvbigpLnRpdGxlLCBwcmV2aW91c1RpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmdldFNlc3Npb25zKCkuZmluZChzID0+IHMuaWQgPT09IHNlc3Npb25JZCk/LnRpdGxlLCBwcmV2aW91c1RpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGVCdXR0b24udGV4dENvbnRlbnQsIHByZXZpb3VzVGl0bGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRTZXNzaW9uU2VsZWN0TGFiZWwoc2xvdHMpLCBwcmV2aW91c1RpdGxlKTtcblx0XHRjb25zdCBnYXRlUm93ID0gKGdldFJlYWRpbmdDb2x1bW4oc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93Jylcblx0XHRcdD8/IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stZ2F0ZS1yb3cnKSkgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayhnYXRlUm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2F0ZVJvdy5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQub2soZ2F0ZVJvdy50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc1Bvc3RGYWlsZWREaXNjb25uZWN0ZWQpKTtcblx0fSk7XG5cblx0dGVzdCgnU2Vzc2lvbkJhciBkZWxldGVTZXNzaW9uIGZhbHNlIHNob3dzIGZhaWxlZCBub3RpY2UgYW5kIGtlZXBzIHRoZSBzZXNzaW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNsYXNzIFJlamVjdGluZ0RlbGV0ZVJvc3RlciBleHRlbmRzIENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlIHtcblx0XHRcdG92ZXJyaWRlIGRlbGV0ZVNlc3Npb24oX3Nlc3Npb25JZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgcm9zdGVyID0gc3RvcmUuYWRkKG5ldyBSZWplY3RpbmdEZWxldGVSb3N0ZXIoKSk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zIH0gPSBtb3VudExlbnMoeyBzdHViU2VydmljZTogcm9zdGVyIH0pO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IGRlbGV0ZUJ1dHRvbiA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLWRlbGV0ZSAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHJvc3Rlci5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBpbml0aWFsQ291bnQgPSByb3N0ZXIuZ2V0U2Vzc2lvbnMoKS5sZW5ndGg7XG5cdFx0bGVucy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0gPSAoKSA9PiBQcm9taXNlLnJlc29sdmUoeyBjb25maXJtZWQ6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQub2soZGVsZXRlQnV0dG9uKTtcblx0XHRkZWxldGVCdXR0b24uY2xpY2soKTtcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0U2Vzc2lvbnMoKS5sZW5ndGgsIGluaXRpYWxDb3VudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3Rlci5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgc2Vzc2lvbklkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmdldFNlc3Npb25zKCkuc29tZShzID0+IHMuaWQgPT09IHNlc3Npb25JZCksIHRydWUpO1xuXHRcdGNvbnN0IGdhdGVSb3cgPSAoZ2V0UmVhZGluZ0NvbHVtbihzbG90cykucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stZ2F0ZS1yb3cnKVxuXHRcdFx0Pz8gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1nYXRlLXJvdycpKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKGdhdGVSb3cpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnYXRlUm93LmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5vayhnYXRlUm93LnRleHRDb250ZW50Py5pbmNsdWRlcyhjb252ZXJzYXRpb25MZW5zUG9zdEZhaWxlZCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZXNzaW9uQmFyIGRlbGV0ZVNlc3Npb24gZmFsc2UgYWZ0ZXIgZW5naW5lLWNhY2hlIGRpc2Nvbm5lY3Qgc2hvd3MgZGlzY29ubmVjdGVkIG5vdGljZScsICgpID0+IHtcblx0XHRjbGFzcyBFbmdpbmVDYWNoZVJlamVjdGluZ0RlbGV0ZVJvc3RlciBleHRlbmRzIENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlIHtcblx0XHRcdG92ZXJyaWRlIGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5KCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGRlbGV0ZVNlc3Npb24oX3Nlc3Npb25JZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgcm9zdGVyID0gc3RvcmUuYWRkKG5ldyBFbmdpbmVDYWNoZVJlamVjdGluZ0RlbGV0ZVJvc3RlcigpKTtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucyh7IHN0dWJTZXJ2aWNlOiByb3N0ZXIgfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgZGVsZXRlQnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tZGVsZXRlIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gcm9zdGVyLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IGluaXRpYWxDb3VudCA9IHJvc3Rlci5nZXRTZXNzaW9ucygpLmxlbmd0aDtcblxuXHRcdGFzc2VydC5vayhkZWxldGVCdXR0b24pO1xuXHRcdGRlbGV0ZUJ1dHRvbi5jbGljaygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3Rlci5nZXRTZXNzaW9ucygpLmxlbmd0aCwgaW5pdGlhbENvdW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBzZXNzaW9uSWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0U2Vzc2lvbnMoKS5zb21lKHMgPT4gcy5pZCA9PT0gc2Vzc2lvbklkKSwgdHJ1ZSk7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IChnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1nYXRlLXJvdycpXG5cdFx0XHQ/PyBzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93JykpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soZ2F0ZVJvdyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdhdGVSb3cuaGlkZGVuLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKGdhdGVSb3cudGV4dENvbnRlbnQ/LmluY2x1ZGVzKGNvbnZlcnNhdGlvbkxlbnNQb3N0RmFpbGVkRGlzY29ubmVjdGVkKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Nlc3Npb25CYXIgZGVsZXRlU2Vzc2lvbiBmYWxzZSBrZWVwcyBjb21wb3NlciBkcmFmdCBvbiB0aGUgb3JpZ2luYWwgc2Vzc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRjbGFzcyBSZWplY3RpbmdEZWxldGVSb3N0ZXIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRvdmVycmlkZSBkZWxldGVTZXNzaW9uKF9zZXNzaW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHJvc3RlciA9IHN0b3JlLmFkZChuZXcgUmVqZWN0aW5nRGVsZXRlUm9zdGVyKCkpO1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucyB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBkZWxldGVCdXR0b24gPSBzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1kZWxldGUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCB0ZXh0YXJlYSA9IGdldERvY2tUZXh0YXJlYShzbG90cyk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gcm9zdGVyLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IGRyYWZ0ID0gJ2tlZXAgdGhpcyBkcmFmdCBhZnRlciByZWplY3RlZCBkZWxldGUnO1xuXHRcdHRleHRhcmVhLnZhbHVlID0gZHJhZnQ7XG5cdFx0dGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdGxlbnMuZGlhbG9nU2VydmljZS5jb25maXJtID0gKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHsgY29uZmlybWVkOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKGRlbGV0ZUJ1dHRvbik7XG5cdFx0ZGVsZXRlQnV0dG9uLmNsaWNrKCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBzZXNzaW9uSWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0U2Vzc2lvbnMoKS5zb21lKHMgPT4gcy5pZCA9PT0gc2Vzc2lvbklkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCBkcmFmdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbklkKSwgZHJhZnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkRpZENoYW5nZVNlc3Npb24ga2VlcHMgZHJhZnRzIGZvciBzZXNzaW9ucyBtaXNzaW5nIGZyb20gdGhlIHZpc2libGUgcm9zdGVyJywgKCkgPT4ge1xuXHRcdGNsYXNzIE5hcnJvd1Zpc2libGVSb3N0ZXIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRwcml2YXRlIHZpc2libGVTZXNzaW9uSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdHNob3dPbmx5KHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRcdHRoaXMudmlzaWJsZVNlc3Npb25JZCA9IHNlc3Npb25JZDtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGdldFNlc3Npb25zKCkge1xuXHRcdFx0XHRjb25zdCBzZXNzaW9ucyA9IHN1cGVyLmdldFNlc3Npb25zKCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLnZpc2libGVTZXNzaW9uSWQgPyBzZXNzaW9ucy5maWx0ZXIoc2Vzc2lvbiA9PiBzZXNzaW9uLmlkID09PSB0aGlzLnZpc2libGVTZXNzaW9uSWQpIDogc2Vzc2lvbnM7XG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSBnZXRBY3RpdmVTZXNzaW9uSWQoKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnZpc2libGVTZXNzaW9uSWQgPz8gc3VwZXIuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSBnZXRBY3RpdmVTZXNzaW9uKCkge1xuXHRcdFx0XHRjb25zdCBpZCA9IHRoaXMuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0XHRcdHJldHVybiBzdXBlci5nZXRTZXNzaW9ucygpLmZpbmQoc2Vzc2lvbiA9PiBzZXNzaW9uLmlkID09PSBpZCkgPz8gc3VwZXIuZ2V0QWN0aXZlU2Vzc2lvbigpO1xuXHRcdFx0fVxuXHRcdFx0cHVsc2VTZXNzaW9uQ2hhbmdlKHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHJvc3RlciA9IHN0b3JlLmFkZChuZXcgTmFycm93VmlzaWJsZVJvc3RlcigpKTtcblx0XHRjb25zdCBzZXNzaW9uQSA9IHJvc3Rlci5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBzZXNzaW9uQiA9IHJvc3Rlci5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0Y29uc3QgeyBsZW5zLCBzdG9yYWdlU2VydmljZSB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRzdG9yZVVhQ2xpZW50Q29tcG9zZXJEcmFmdChzdG9yYWdlU2VydmljZSwgc2Vzc2lvbkEsICdkZWZhdWx0JywgJ2RyYWZ0IG9uIEEnKTtcblx0XHRzdG9yZVVhQ2xpZW50Q29tcG9zZXJEcmFmdChzdG9yYWdlU2VydmljZSwgc2Vzc2lvbkIsICdkZWZhdWx0JywgJ2RyYWZ0IG9uIEInKTtcblx0XHRyb3N0ZXIuc2hvd09ubHkoc2Vzc2lvbkIpO1xuXHRcdHJvc3Rlci5zd2l0Y2hTZXNzaW9uKHNlc3Npb25CKTtcblx0XHRyb3N0ZXIucHVsc2VTZXNzaW9uQ2hhbmdlKHNlc3Npb25CKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsb2FkVWFDbGllbnRDb21wb3NlckRyYWZ0KHN0b3JhZ2VTZXJ2aWNlLCBzZXNzaW9uQSwgJ2RlZmF1bHQnKSwgJ2RyYWZ0IG9uIEEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobG9hZFVhQ2xpZW50Q29tcG9zZXJEcmFmdChzdG9yYWdlU2VydmljZSwgc2Vzc2lvbkIsICdkZWZhdWx0JyksICdkcmFmdCBvbiBCJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmRlbGV0ZVNlc3Npb24oc2Vzc2lvbkEpLCB0cnVlKTtcblx0XHRsZW5zLmRlbGV0ZUNvbXBvc2VyRHJhZnRzRm9yU2Vzc2lvbihzZXNzaW9uQSk7XG5cdFx0YXNzZXJ0Lm9rKCFsb2FkVWFDbGllbnRDb21wb3NlckRyYWZ0KHN0b3JhZ2VTZXJ2aWNlLCBzZXNzaW9uQSwgJ2RlZmF1bHQnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxvYWRVYUNsaWVudENvbXBvc2VyRHJhZnQoc3RvcmFnZVNlcnZpY2UsIHNlc3Npb25CLCAnZGVmYXVsdCcpLCAnZHJhZnQgb24gQicpO1xuXHR9KTtcblxuXHR0ZXN0KCdiaW5kLWZhaWxlZCByb3N0ZXIgY2h1cm4ga2VlcHMgY29tcG9zZXIgZHJhZnRzIGZvciBvdGhlciBzZXNzaW9ucycsICgpID0+IHtcblx0XHRjb25zdCBzZXNzaW9uQSA9ICdzZXNzLWJpbmRmYWlsLWEnO1xuXHRcdGNsYXNzIEJpbmRGYWlsT25seVJvc3RlciBleHRlbmRzIENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlIHtcblx0XHRcdHB1bHNlU2Vzc2lvbkNoYW5nZShzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNlc3Npb24uZmlyZShzZXNzaW9uSWQpO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgZ2V0U2Vzc2lvbnMoKTogcmVhZG9ubHkgQ29udmVyc2F0aW9uU3R1YlNlc3Npb25bXSB7XG5cdFx0XHRcdHJldHVybiBbeyBpZDogRU5HSU5FX0JJTkRfRkFJTEVEX1NFU1NJT05fSUQsIHRpdGxlOiAnYmluZCBmYWlsZWQnLCB0dXJuczogW10sIHNvdXJjZTogJ2VuZ2luZS1jYWNoZScgfV07XG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSBnZXRBY3RpdmVTZXNzaW9uSWQoKSB7XG5cdFx0XHRcdHJldHVybiBFTkdJTkVfQklORF9GQUlMRURfU0VTU0lPTl9JRDtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGhhc0VuZ2luZUNvbm5lY3Rpb25IaXN0b3J5KCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGlzRW5naW5lQ29ubmVjdGVkKCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgcm9zdGVyID0gc3RvcmUuYWRkKG5ldyBCaW5kRmFpbE9ubHlSb3N0ZXIoKSk7XG5cdFx0Y29uc3QgeyBzdG9yYWdlU2VydmljZSB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRzdG9yZVVhQ2xpZW50Q29tcG9zZXJEcmFmdChzdG9yYWdlU2VydmljZSwgc2Vzc2lvbkEsICdkZWZhdWx0JywgJ2RyYWZ0IGJlZm9yZSBiaW5kIGZhaWwnKTtcblx0XHRyb3N0ZXIucHVsc2VTZXNzaW9uQ2hhbmdlKEVOR0lORV9CSU5EX0ZBSUxFRF9TRVNTSU9OX0lEKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobG9hZFVhQ2xpZW50Q29tcG9zZXJEcmFmdChzdG9yYWdlU2VydmljZSwgc2Vzc2lvbkEsICdkZWZhdWx0JyksICdkcmFmdCBiZWZvcmUgYmluZCBmYWlsJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Nlc3Npb25CYXIgZGVsZXRlU2Vzc2lvbiBvcHRpbWlzdGljIHRydWUgdGhlbiByb2xsYmFjayByZXN0b3JlcyBjb21wb3NlciBkcmFmdCcsIGFzeW5jICgpID0+IHtcblx0XHRjbGFzcyBPcHRpbWlzdGljUm9sbGJhY2tEZWxldGVSb3N0ZXIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZhaWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ29udmVyc2F0aW9uRW5naW5lQWN0aW9uRmFpbHVyZT4oKSk7XG5cdFx0XHRvdmVycmlkZSByZWFkb25seSBvbkRpZEZhaWxFbmdpbmVBY3Rpb24gPSB0aGlzLl9vbkRpZEZhaWwuZXZlbnQ7XG5cdFx0XHRwcml2YXRlIGhpZGRlbklkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0XHRcdG92ZXJyaWRlIGdldFNlc3Npb25zKCkge1xuXHRcdFx0XHRyZXR1cm4gc3VwZXIuZ2V0U2Vzc2lvbnMoKS5maWx0ZXIoc2Vzc2lvbiA9PiBzZXNzaW9uLmlkICE9PSB0aGlzLmhpZGRlbklkKTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgZ2V0QWN0aXZlU2Vzc2lvbklkKCkge1xuXHRcdFx0XHRjb25zdCBpZCA9IHN1cGVyLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdFx0XHRpZiAoaWQgPT09IHRoaXMuaGlkZGVuSWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRTZXNzaW9ucygpWzBdPy5pZCA/PyBpZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gaWQ7XG5cdFx0XHR9XG5cblx0XHRcdG92ZXJyaWRlIGdldEFjdGl2ZVNlc3Npb24oKSB7XG5cdFx0XHRcdGNvbnN0IGlkID0gdGhpcy5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0U2Vzc2lvbnMoKS5maW5kKHNlc3Npb24gPT4gc2Vzc2lvbi5pZCA9PT0gaWQpID8/IHN1cGVyLmdldEFjdGl2ZVNlc3Npb24oKTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgZGVsZXRlU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdFx0XHRpZiAoIXN1cGVyLmdldFNlc3Npb25zKCkuc29tZShzZXNzaW9uID0+IHNlc3Npb24uaWQgPT09IHNlc3Npb25JZCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5oaWRkZW5JZCA9IHNlc3Npb25JZDtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uLmZpcmUodGhpcy5nZXRBY3RpdmVTZXNzaW9uSWQoKSk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdFx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmhpZGRlbklkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlU2Vzc2lvbi5maXJlKHNlc3Npb25JZCk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZXNzaW9uLmZpcmUoc2Vzc2lvbklkKTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZEZhaWwuZmlyZSh7IHNlc3Npb25JZCwgYWN0aW9uOiAnZGVsZXRlU2Vzc2lvbicsIGVycm9yOiBuZXcgRXJyb3IoJ2VuZ2luZSByZWZ1c2VkJykgfSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgcm9zdGVyID0gc3RvcmUuYWRkKG5ldyBPcHRpbWlzdGljUm9sbGJhY2tEZWxldGVSb3N0ZXIoKSk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gcm9zdGVyLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdHJvc3Rlci5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0cm9zdGVyLnN3aXRjaFNlc3Npb24oc2Vzc2lvbklkKTtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMgfSA9IG1vdW50TGVucyh7IHN0dWJTZXJ2aWNlOiByb3N0ZXIgfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgZGVsZXRlQnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tZGVsZXRlIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBnZXREb2NrVGV4dGFyZWEoc2xvdHMpO1xuXHRcdGNvbnN0IGRyYWZ0ID0gJ3Jlc3RvcmUgdGhpcyBkcmFmdCBhZnRlciBkZWxldGUgcm9sbGJhY2snO1xuXHRcdHRleHRhcmVhLnZhbHVlID0gZHJhZnQ7XG5cdFx0dGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXG5cdFx0YXNzZXJ0Lm9rKGRlbGV0ZUJ1dHRvbik7XG5cdFx0bGVucy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0gPSAoKSA9PiBQcm9taXNlLnJlc29sdmUoeyBjb25maXJtZWQ6IHRydWUgfSk7XG5cdFx0ZGVsZXRlQnV0dG9uLmNsaWNrKCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3Rlci5nZXRTZXNzaW9ucygpLnNvbWUocyA9PiBzLmlkID09PSBzZXNzaW9uSWQpLCBmYWxzZSk7XG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBxdWV1ZU1pY3JvdGFzayhyZXNvbHZlKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmdldEFjdGl2ZVNlc3Npb25JZCgpLCBzZXNzaW9uSWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0U2Vzc2lvbnMoKS5zb21lKHMgPT4gcy5pZCA9PT0gc2Vzc2lvbklkKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbklkKSwgZHJhZnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXREb2NrVGV4dGFyZWEoc2xvdHMpLnZhbHVlLCBkcmFmdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Nlc3Npb25CYXIgY3JlYXRlTmV3U2Vzc2lvbiBhZnRlciBlbmdpbmUtY2FjaGUgZGlzY29ubmVjdCBzaG93cyBkaXNjb25uZWN0ZWQgbm90aWNlIGFuZCBkb2VzIG5vdCBjcmVhdGUnLCAoKSA9PiB7XG5cdFx0Y2xhc3MgRW5naW5lQ2FjaGVDcmVhdGVSb3N0ZXIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRjcmVhdGVTZXNzaW9uQ2FsbHMgPSAwO1xuXHRcdFx0b3ZlcnJpZGUgaGFzRW5naW5lQ29ubmVjdGlvbkhpc3RvcnkoKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgaXNFbmdpbmVDb25uZWN0ZWQoKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGNyZWF0ZVNlc3Npb24oKTogc3RyaW5nIHtcblx0XHRcdFx0dGhpcy5jcmVhdGVTZXNzaW9uQ2FsbHMgKz0gMTtcblx0XHRcdFx0cmV0dXJuIHN1cGVyLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3Qgcm9zdGVyID0gc3RvcmUuYWRkKG5ldyBFbmdpbmVDYWNoZUNyZWF0ZVJvc3RlcigpKTtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucyh7IHN0dWJTZXJ2aWNlOiByb3N0ZXIgfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgbmV3QnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tbmV3IC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gcm9zdGVyLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IGluaXRpYWxDb3VudCA9IHJvc3Rlci5nZXRTZXNzaW9ucygpLmxlbmd0aDtcblxuXHRcdGFzc2VydC5vayhuZXdCdXR0b24pO1xuXHRcdG5ld0J1dHRvbi5jbGljaygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3Rlci5jcmVhdGVTZXNzaW9uQ2FsbHMsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0U2Vzc2lvbnMoKS5sZW5ndGgsIGluaXRpYWxDb3VudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3Rlci5nZXRBY3RpdmVTZXNzaW9uSWQoKSwgc2Vzc2lvbklkKTtcblx0XHRjb25zdCBnYXRlUm93ID0gKGdldFJlYWRpbmdDb2x1bW4oc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93Jylcblx0XHRcdD8/IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stZ2F0ZS1yb3cnKSkgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuXHRcdGFzc2VydC5vayhnYXRlUm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2F0ZVJvdy5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQub2soZ2F0ZVJvdy50ZXh0Q29udGVudD8uaW5jbHVkZXMoY29udmVyc2F0aW9uTGVuc1Bvc3RGYWlsZWREaXNjb25uZWN0ZWQpKTtcblx0fSk7XG5cblx0dGVzdCgnU2Vzc2lvbkJhciBjcmVhdGVOZXdTZXNzaW9uIHdoaWxlIGVuZ2luZSBjb25uZWN0ZWQgc3RpbGwgY2FsbHMgY3JlYXRlU2Vzc2lvbicsICgpID0+IHtcblx0XHRjbGFzcyBDb25uZWN0ZWRDcmVhdGVSb3N0ZXIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRjcmVhdGVTZXNzaW9uQ2FsbHMgPSAwO1xuXHRcdFx0b3ZlcnJpZGUgaGFzRW5naW5lQ29ubmVjdGlvbkhpc3RvcnkoKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgaXNFbmdpbmVDb25uZWN0ZWQoKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgY3JlYXRlU2Vzc2lvbigpOiBzdHJpbmcge1xuXHRcdFx0XHR0aGlzLmNyZWF0ZVNlc3Npb25DYWxscyArPSAxO1xuXHRcdFx0XHRyZXR1cm4gc3VwZXIuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCByb3N0ZXIgPSBzdG9yZS5hZGQobmV3IENvbm5lY3RlZENyZWF0ZVJvc3RlcigpKTtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucyh7IHN0dWJTZXJ2aWNlOiByb3N0ZXIgfSk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgbmV3QnV0dG9uID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tbmV3IC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XG5cdFx0Y29uc3QgaW5pdGlhbENvdW50ID0gcm9zdGVyLmdldFNlc3Npb25zKCkubGVuZ3RoO1xuXG5cdFx0YXNzZXJ0Lm9rKG5ld0J1dHRvbik7XG5cdFx0bmV3QnV0dG9uLmNsaWNrKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9zdGVyLmNyZWF0ZVNlc3Npb25DYWxscywgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvc3Rlci5nZXRTZXNzaW9ucygpLmxlbmd0aCwgaW5pdGlhbENvdW50ICsgMSk7XG5cdFx0Y29uc3QgZ2F0ZVJvdyA9IChnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1nYXRlLXJvdycpXG5cdFx0XHQ/PyBzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLWdhdGUtcm93JykpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soIWdhdGVSb3cgfHwgZ2F0ZVJvdy5oaWRkZW4pO1xuXHR9KTtcblxuXHR0ZXN0KCd0dXJuRWRpdCBzZXNzaW9uIHN3aXRjaCBrZWVwcyBjb21wb3NlIGRyYWZ0IHNuYXBzaG90IG5vdCBidWJibGUgdGV4dCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uQSA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IHVzZXJUdXJuID0gc3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbkEsICdCJyk7XG5cdFx0YXNzZXJ0Lm9rKHVzZXJUdXJuKTtcblx0XHRjb25zdCBzZXNzaW9uQiA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRzdHViU2VydmljZS5zd2l0Y2hTZXNzaW9uKHNlc3Npb25BKTtcblxuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICdBJztcblx0XHR0ZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBnbG9iYWxUaGlzLkV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbkEpLCAnQScpO1xuXG5cdFx0bGVucy5iZWdpblR1cm5FZGl0KHVzZXJUdXJuLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5jb21wb3NlclBvbGljeSwgJ3R1cm5FZGl0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuZG9ja1RleHRhcmVhLnZhbHVlLCAnQicpO1xuXG5cdFx0bGVucy5kb2NrVGV4dGFyZWEudmFsdWUgPSAnQi10eXBlZCc7XG5cdFx0bGVucy5kb2NrVGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnJlYWRDb21wb3NlckRyYWZ0KHNlc3Npb25BKSwgJ0EnKTtcblxuXHRcdGxlbnMuc3dpdGNoVG9TZXNzaW9uKHNlc3Npb25CKTtcblx0XHRsZW5zLnN3aXRjaFRvU2Vzc2lvbihzZXNzaW9uQSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5yZWFkQ29tcG9zZXJEcmFmdChzZXNzaW9uQSksICdBJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldERvY2tUZXh0YXJlYShzbG90cykudmFsdWUsICdBJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3F1ZXVlRWRpdCBzZXNzaW9uIHN3aXRjaCBrZWVwcyBjb21wb3NlIGRyYWZ0IHNuYXBzaG90JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucywgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25BID0gc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbkEsICdrZWVwIHNlc3Npb24gYWN0aXZlJyk7XG5cdFx0Y29uc3Qgc2Vzc2lvbkIgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbihzZXNzaW9uQSk7XG5cdFx0c3R1YlNlcnZpY2Uuc2V0TWVzc2FnZVF1ZXVlRml4dHVyZShzZXNzaW9uQSwge1xuXHRcdFx0aXNQYXVzZWQ6IGZhbHNlLFxuXHRcdFx0aXNQcm9jZXNzaW5nOiBmYWxzZSxcblx0XHRcdGl0ZW1zOiBbe1xuXHRcdFx0XHRpZDogJ3EtZWRpdCcsXG5cdFx0XHRcdGNvbnRlbnQ6ICdCJyxcblx0XHRcdFx0c3RhdHVzOiAnUEVORElORycsXG5cdFx0XHRcdGhvbGQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0dXBsb2FkUHJvZ3Jlc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0cmV0cnlDb3VudDogMCxcblx0XHRcdFx0bGFzdEVycm9yOiB1bmRlZmluZWQsXG5cdFx0XHRcdGxvY2tlZDogZmFsc2UsXG5cdFx0XHRcdHBpbm5lZDogZmFsc2UsXG5cdFx0XHR9XSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICdBJztcblx0XHR0ZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBnbG9iYWxUaGlzLkV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbkEpLCAnQScpO1xuXG5cdFx0bGVucy5iZWdpblF1ZXVlRWRpdCgncS1lZGl0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuY29tcG9zZXJQb2xpY3ksICdxdWV1ZUVkaXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5kb2NrVGV4dGFyZWEudmFsdWUsICdCJyk7XG5cblx0XHRsZW5zLnN3aXRjaFRvU2Vzc2lvbihzZXNzaW9uQik7XG5cdFx0bGVucy5zd2l0Y2hUb1Nlc3Npb24oc2Vzc2lvbkEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbkEpLCAnQScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXREb2NrVGV4dGFyZWEoc2xvdHMpLnZhbHVlLCAnQScpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb21wb3NlIHNlc3Npb24gc3dpdGNoIHN0aWxsIHdyaXRlcyB0ZXh0YXJlYSBpbnRvIGRyYWZ0cycsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uQSA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IHNlc3Npb25CID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdHN0dWJTZXJ2aWNlLnN3aXRjaFNlc3Npb24oc2Vzc2lvbkEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuY29tcG9zZXJQb2xpY3ksICdjb21wb3NlJyk7XG5cdFx0Z2V0RG9ja1RleHRhcmVhKHNsb3RzKS52YWx1ZSA9ICdsaXZlIGNvbXBvc2UnO1xuXHRcdGxlbnMuc3dpdGNoVG9TZXNzaW9uKHNlc3Npb25CKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnJlYWRDb21wb3NlckRyYWZ0KHNlc3Npb25BKSwgJ2xpdmUgY29tcG9zZScpO1xuXHR9KTtcblxuXHR0ZXN0KCd0dXJuRWRpdCBjcmVhdGVOZXdTZXNzaW9uIHdyaXRlcyBjb21wb3NlIGRyYWZ0IHNuYXBzaG90IG5vdCBidWJibGUgdGV4dCcsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uQSA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IHVzZXJUdXJuID0gc3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbkEsICdCJyk7XG5cdFx0YXNzZXJ0Lm9rKHVzZXJUdXJuKTtcblxuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICdBJztcblx0XHR0ZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBnbG9iYWxUaGlzLkV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cblx0XHRsZW5zLmJlZ2luVHVybkVkaXQodXNlclR1cm4uaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5kb2NrVGV4dGFyZWEudmFsdWUsICdCJyk7XG5cblx0XHRsZW5zLmNyZWF0ZU5ld1Nlc3Npb24oKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnJlYWRDb21wb3NlckRyYWZ0KHNlc3Npb25BKSwgJ0EnKTtcblx0fSk7XG5cblx0dGVzdCgndHVybkVkaXQgZGVsZXRlU2Vzc2lvbiBmYWxzZSBrZWVwcyBjb21wb3NlIGRyYWZ0IHNuYXBzaG90IG5vdCBidWJibGUgdGV4dCcsIGFzeW5jICgpID0+IHtcblx0XHRjbGFzcyBSZWplY3RpbmdEZWxldGVSb3N0ZXIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRvdmVycmlkZSBkZWxldGVTZXNzaW9uKF9zZXNzaW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHJvc3RlciA9IHN0b3JlLmFkZChuZXcgUmVqZWN0aW5nRGVsZXRlUm9zdGVyKCkpO1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucyB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSByb3N0ZXIuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0Y29uc3QgdXNlclR1cm4gPSByb3N0ZXIuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbklkLCAnQicpO1xuXHRcdGFzc2VydC5vayh1c2VyVHVybik7XG5cblx0XHRjb25zdCB0ZXh0YXJlYSA9IGdldERvY2tUZXh0YXJlYShzbG90cyk7XG5cdFx0dGV4dGFyZWEudmFsdWUgPSAnQSc7XG5cdFx0dGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnJlYWRDb21wb3NlckRyYWZ0KHNlc3Npb25JZCksICdBJyk7XG5cblx0XHRsZW5zLmJlZ2luVHVybkVkaXQodXNlclR1cm4uaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5kb2NrVGV4dGFyZWEudmFsdWUsICdCJyk7XG5cblx0XHRsZW5zLmRpYWxvZ1NlcnZpY2UuY29uZmlybSA9ICgpID0+IFByb21pc2UucmVzb2x2ZSh7IGNvbmZpcm1lZDogdHJ1ZSB9KTtcblx0XHRhd2FpdCBsZW5zLmRlbGV0ZUFjdGl2ZVNlc3Npb24oKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIHNlc3Npb25JZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbklkKSwgJ0EnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0RG9ja1RleHRhcmVhKHNsb3RzKS52YWx1ZSwgJ0EnKTtcblx0fSk7XG5cblx0dGVzdCgndHVybkVkaXQgZGVsZXRlU2Vzc2lvbiBvcHRpbWlzdGljIHJvbGxiYWNrIHJlc3RvcmVzIGNvbXBvc2UgZHJhZnQgc25hcHNob3Qgbm90IGJ1YmJsZSB0ZXh0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNsYXNzIE9wdGltaXN0aWNSb2xsYmFja0RlbGV0ZVJvc3RlciBleHRlbmRzIENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlIHtcblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRmFpbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDb252ZXJzYXRpb25FbmdpbmVBY3Rpb25GYWlsdXJlPigpKTtcblx0XHRcdG92ZXJyaWRlIHJlYWRvbmx5IG9uRGlkRmFpbEVuZ2luZUFjdGlvbiA9IHRoaXMuX29uRGlkRmFpbC5ldmVudDtcblx0XHRcdHByaXZhdGUgaGlkZGVuSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRcdFx0b3ZlcnJpZGUgZ2V0U2Vzc2lvbnMoKSB7XG5cdFx0XHRcdHJldHVybiBzdXBlci5nZXRTZXNzaW9ucygpLmZpbHRlcihzZXNzaW9uID0+IHNlc3Npb24uaWQgIT09IHRoaXMuaGlkZGVuSWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSBnZXRBY3RpdmVTZXNzaW9uSWQoKSB7XG5cdFx0XHRcdGNvbnN0IGlkID0gc3VwZXIuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0XHRcdGlmIChpZCA9PT0gdGhpcy5oaWRkZW5JZCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmdldFNlc3Npb25zKClbMF0/LmlkID8/IGlkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBpZDtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgZ2V0QWN0aXZlU2Vzc2lvbigpIHtcblx0XHRcdFx0Y29uc3QgaWQgPSB0aGlzLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRTZXNzaW9ucygpLmZpbmQoc2Vzc2lvbiA9PiBzZXNzaW9uLmlkID09PSBpZCkgPz8gc3VwZXIuZ2V0QWN0aXZlU2Vzc2lvbigpO1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSBkZWxldGVTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0XHRcdGlmICghc3VwZXIuZ2V0U2Vzc2lvbnMoKS5zb21lKHNlc3Npb24gPT4gc2Vzc2lvbi5pZCA9PT0gc2Vzc2lvbklkKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmhpZGRlbklkID0gc2Vzc2lvbklkO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZVNlc3Npb24uZmlyZSh0aGlzLmdldEFjdGl2ZVNlc3Npb25JZCgpKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZXNzaW9uLmZpcmUoc2Vzc2lvbklkKTtcblx0XHRcdFx0cXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuaGlkZGVuSWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBY3RpdmVTZXNzaW9uLmZpcmUoc2Vzc2lvbklkKTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVNlc3Npb24uZmlyZShzZXNzaW9uSWQpO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkRmFpbC5maXJlKHsgc2Vzc2lvbklkLCBhY3Rpb246ICdkZWxldGVTZXNzaW9uJywgZXJyb3I6IG5ldyBFcnJvcignZW5naW5lIHJlZnVzZWQnKSB9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCByb3N0ZXIgPSBzdG9yZS5hZGQobmV3IE9wdGltaXN0aWNSb2xsYmFja0RlbGV0ZVJvc3RlcigpKTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSByb3N0ZXIuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0cm9zdGVyLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRyb3N0ZXIuc3dpdGNoU2Vzc2lvbihzZXNzaW9uSWQpO1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucyB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCB1c2VyVHVybiA9IHJvc3Rlci5hcHBlbmRVc2VyVHVybihzZXNzaW9uSWQsICdCJyk7XG5cdFx0YXNzZXJ0Lm9rKHVzZXJUdXJuKTtcblxuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICdBJztcblx0XHR0ZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBnbG9iYWxUaGlzLkV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cblx0XHRsZW5zLmJlZ2luVHVybkVkaXQodXNlclR1cm4uaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5kb2NrVGV4dGFyZWEudmFsdWUsICdCJyk7XG5cblx0XHRsZW5zLmRpYWxvZ1NlcnZpY2UuY29uZmlybSA9ICgpID0+IFByb21pc2UucmVzb2x2ZSh7IGNvbmZpcm1lZDogdHJ1ZSB9KTtcblx0XHRhd2FpdCBsZW5zLmRlbGV0ZUFjdGl2ZVNlc3Npb24oKTtcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHF1ZXVlTWljcm90YXNrKHJlc29sdmUpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb3N0ZXIuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIHNlc3Npb25JZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbklkKSwgJ0EnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0RG9ja1RleHRhcmVhKHNsb3RzKS52YWx1ZSwgJ0EnKTtcblx0fSk7XG5cblx0dGVzdCgnY29tcG9zZSBkZWxldGVTZXNzaW9uIGZhbHNlIHN0aWxsIHdyaXRlcyB0ZXh0YXJlYSBpbnRvIGRyYWZ0cycsIGFzeW5jICgpID0+IHtcblx0XHRjbGFzcyBSZWplY3RpbmdEZWxldGVSb3N0ZXIgZXh0ZW5kcyBDb252ZXJzYXRpb25TdHViU2VydmljZSB7XG5cdFx0XHRvdmVycmlkZSBkZWxldGVTZXNzaW9uKF9zZXNzaW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHJvc3RlciA9IHN0b3JlLmFkZChuZXcgUmVqZWN0aW5nRGVsZXRlUm9zdGVyKCkpO1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucyB9ID0gbW91bnRMZW5zKHsgc3R1YlNlcnZpY2U6IHJvc3RlciB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSByb3N0ZXIuZ2V0QWN0aXZlU2Vzc2lvbklkKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuY29tcG9zZXJQb2xpY3ksICdjb21wb3NlJyk7XG5cdFx0Z2V0RG9ja1RleHRhcmVhKHNsb3RzKS52YWx1ZSA9ICdsaXZlIGNvbXBvc2UnO1xuXG5cdFx0bGVucy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0gPSAoKSA9PiBQcm9taXNlLnJlc29sdmUoeyBjb25maXJtZWQ6IHRydWUgfSk7XG5cdFx0YXdhaXQgbGVucy5kZWxldGVBY3RpdmVTZXNzaW9uKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5yZWFkQ29tcG9zZXJEcmFmdChzZXNzaW9uSWQpLCAnbGl2ZSBjb21wb3NlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldERvY2tUZXh0YXJlYShzbG90cykudmFsdWUsICdsaXZlIGNvbXBvc2UnKTtcblx0fSk7XG5cblx0dGVzdCgndHVybkVkaXQgaW5wdXQgaGlzdG9yeSBkb2VzIG5vdCB3cml0ZSBoaXN0b3J5IHRleHQgaW50byBkcmFmdHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zLCBzdHViU2VydmljZSB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbkEgPSBzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uSWQoKTtcblx0XHRjb25zdCB1c2VyVHVybiA9IHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25BLCAnQicpO1xuXHRcdGFzc2VydC5vayh1c2VyVHVybik7XG5cblx0XHRjb25zdCB0ZXh0YXJlYSA9IGdldERvY2tUZXh0YXJlYShzbG90cyk7XG5cdFx0dGV4dGFyZWEudmFsdWUgPSAnQSc7XG5cdFx0dGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnJlYWRDb21wb3NlckRyYWZ0KHNlc3Npb25BKSwgJ0EnKTtcblxuXHRcdGxlbnMuYmVnaW5UdXJuRWRpdCh1c2VyVHVybi5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuY29tcG9zZXJQb2xpY3ksICd0dXJuRWRpdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmRvY2tUZXh0YXJlYS52YWx1ZSwgJ0InKTtcblxuXHRcdGxlbnMuZG9ja1RleHRhcmVhLnZhbHVlID0gJyc7XG5cdFx0YXNzZXJ0Lm9rKGxlbnMubmF2aWdhdGVJbnB1dEhpc3RvcnkoJ29sZGVyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmRvY2tUZXh0YXJlYS52YWx1ZSwgJ0InKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5yZWFkQ29tcG9zZXJEcmFmdChzZXNzaW9uQSksICdBJyk7XG5cblx0XHRsZW5zLmV4aXRJbnB1dEhpc3RvcnlCcm93c2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5yZWFkQ29tcG9zZXJEcmFmdChzZXNzaW9uQSksICdBJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R1cm4gZWRpdCBFc2NhcGUgbGVhdmVzIGlucHV0IGhpc3RvcnkgYmVmb3JlIGl0IGxlYXZlcyB0aGUgZWRpdCcsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uQSA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IHVzZXJUdXJuID0gc3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbkEsICdCJyk7XG5cdFx0YXNzZXJ0Lm9rKHVzZXJUdXJuKTtcblxuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICdBJztcblx0XHR0ZXh0YXJlYS5kaXNwYXRjaEV2ZW50KG5ldyBnbG9iYWxUaGlzLkV2ZW50KCdpbnB1dCcsIHsgYnViYmxlczogdHJ1ZSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbkEpLCAnQScpO1xuXG5cdFx0bGVucy5iZWdpblR1cm5FZGl0KHVzZXJUdXJuLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5jb21wb3NlclBvbGljeSwgJ3R1cm5FZGl0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuZG9ja1RleHRhcmVhLnZhbHVlLCAnQicpO1xuXG5cdFx0bGVucy5kb2NrVGV4dGFyZWEudmFsdWUgPSAnJztcblx0XHRsZW5zLmRvY2tUZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA9IDA7XG5cdFx0bGVucy5kb2NrVGV4dGFyZWEuc2VsZWN0aW9uRW5kID0gMDtcblx0XHRkaXNwYXRjaERvY2tLZXlkb3duKGxlbnMuZG9ja1RleHRhcmVhLCBLZXlDb2RlLlVwQXJyb3cpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmRvY2tUZXh0YXJlYS52YWx1ZSwgJ0InKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5jb21wb3NlclBvbGljeSwgJ3R1cm5FZGl0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMucmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbkEpLCAnQScpO1xuXG5cdFx0ZGlzcGF0Y2hEb2NrS2V5ZG93bihsZW5zLmRvY2tUZXh0YXJlYSwgS2V5Q29kZS5Fc2NhcGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLmNvbXBvc2VyUG9saWN5LCAndHVybkVkaXQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5kb2NrVGV4dGFyZWEudmFsdWUsICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5yZWFkQ29tcG9zZXJEcmFmdChzZXNzaW9uQSksICdBJyk7XG5cblx0XHRkaXNwYXRjaERvY2tLZXlkb3duKGxlbnMuZG9ja1RleHRhcmVhLCBLZXlDb2RlLkVzY2FwZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuY29tcG9zZXJQb2xpY3ksICdjb21wb3NlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuZG9ja1RleHRhcmVhLnZhbHVlLCAnQScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnJlYWRDb21wb3NlckRyYWZ0KHNlc3Npb25BKSwgJ0EnKTtcblx0fSk7XG5cblx0dGVzdCgnY29tcG9zZSBpbnB1dCBoaXN0b3J5IHN0aWxsIHdyaXRlcyB0ZXh0YXJlYSBpbnRvIGRyYWZ0cycsICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uQSA9IHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IHVzZXJUdXJuID0gc3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbkEsICdzZW50IGhpc3RvcnknKTtcblx0XHRhc3NlcnQub2sodXNlclR1cm4pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxlbnMuY29tcG9zZXJQb2xpY3ksICdjb21wb3NlJyk7XG5cdFx0Z2V0RG9ja1RleHRhcmVhKHNsb3RzKS52YWx1ZSA9ICcnO1xuXHRcdGFzc2VydC5vayhsZW5zLm5hdmlnYXRlSW5wdXRIaXN0b3J5KCdvbGRlcicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0RG9ja1RleHRhcmVhKHNsb3RzKS52YWx1ZSwgJ3NlbnQgaGlzdG9yeScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsZW5zLnJlYWRDb21wb3NlckRyYWZ0KHNlc3Npb25BKSwgJ3NlbnQgaGlzdG9yeScpO1xuXG5cdFx0bGVucy5leGl0SW5wdXRIaXN0b3J5QnJvd3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldERvY2tUZXh0YXJlYShzbG90cykudmFsdWUsICcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGVucy5yZWFkQ29tcG9zZXJEcmFmdChzZXNzaW9uQSksICcnKTtcblx0fSk7XG5cblx0dGVzdCgnU2Vzc2lvbkJhciBzZWxlY3QgcmVmcmVzaGVzIGFmdGVyIGRlbGV0aW5nIHRoZSBsYXN0IHN0dWIgc2Vzc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsZW5zIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9ucyA9IFsuLi5zdHViU2VydmljZS5nZXRTZXNzaW9ucygpXTtcblx0XHRsZW5zLmRpYWxvZ1NlcnZpY2UuY29uZmlybSA9ICgpID0+IFByb21pc2UucmVzb2x2ZSh7IGNvbmZpcm1lZDogdHJ1ZSB9KTtcblxuXHRcdGZvciAoY29uc3Qgc2Vzc2lvbiBvZiBzZXNzaW9ucykge1xuXHRcdFx0aWYgKHN0dWJTZXJ2aWNlLmdldEFjdGl2ZVNlc3Npb25JZCgpICE9PSBzZXNzaW9uLmlkKSB7XG5cdFx0XHRcdHN0dWJTZXJ2aWNlLnN3aXRjaFNlc3Npb24oc2Vzc2lvbi5pZCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBkZWxldGVCdXR0b24gPSBzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1kZWxldGUgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRcdGRlbGV0ZUJ1dHRvbi5jbGljaygpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cdFx0Y29uc3QgdGl0bGVMaXZlID0gc2xvdHMuc2Vzc2lvbkJhciEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXNlc3Npb24tdGl0bGUtbGl2ZScpIGFzIEhUTUxFbGVtZW50O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldFNlc3Npb25zKCkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQub2soc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbigpLnRpdGxlLmluY2x1ZGVzKCdVbnRpdGxlZCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0U2Vzc2lvblNlbGVjdExhYmVsKHNsb3RzKSwgc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbigpLnRpdGxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGl0bGVMaXZlLnRleHRDb250ZW50LCBzdHViU2VydmljZS5nZXRBY3RpdmVTZXNzaW9uKCkudGl0bGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy5zZXNzaW9uQmFyIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtc2Vzc2lvbi1zZWxlY3Qgc2VsZWN0Lm1vbmFjby1zZWxlY3QtYm94IG9wdGlvbicpPy50ZXh0Q29udGVudCwgc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbigpLnRpdGxlKTtcblx0fSk7XG5cblx0dGVzdCgndXNlciB0dXJucyBhcmUgZGlzcGxheS1vbmx5OyBhc3Npc3RhbnQgdHVybnMgZXhwb3NlIENvcHksIFJlZ2VuZXJhdGUgYW5kIERlbGV0ZSBhY3Rpb24gYmFycycsIGFzeW5jICgpID0+IHtcblx0XHQvLyBUYWxsZXIgdGhhbiB0aGUgc3VpdGUgZGVmYXVsdDogdGhpcyB0ZXN0IGFzc2VydHMgb24gdmlydHVhbGl6ZWQgcm93cywgYW5kXG5cdFx0Ly8gaG93IG1hbnkgZml0IGRlcGVuZHMgb24gZm9udCBtZXRyaWNzLCB3aGljaCBkaWZmZXIgYWNyb3NzIG1hY2hpbmVzLlxuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucyh7IGxheW91dEhlaWdodDogMTIwMCB9KTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cblx0XHRzdHViU2VydmljZS5hcHBlbmRVc2VyVHVybihzZXNzaW9uSWQsICdDbGljayBtZSB1c2VyJyk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kU3R1YkVjaG9Bc3Npc3RhbnQoc2Vzc2lvbklkLCAnQ29weSBtZSBhc3Npc3RhbnQnKTtcblx0XHRzdHViU2VydmljZS5hcHBlbmRTdHViRWNob0Fzc2lzdGFudChzZXNzaW9uSWQsICdMYXRlciByZXBseScpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFRoaW5raW5nVHVybihzZXNzaW9uSWQsICdUaGlua2luZyBzdW1tYXJ5Jyk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVG9vbFR1cm4oc2Vzc2lvbklkLCAnVG9vbCBzdW1tYXJ5Jyk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kQ29uZmlybWF0aW9uVHVybihzZXNzaW9uSWQsICdDb25maXJtIHRoaXM/Jyk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cblx0XHRjb25zdCBmb2xkSGVhZGVyID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLWhlYWRlcicpO1xuXHRcdGFzc2VydC5vayhmb2xkSGVhZGVyKTtcblx0XHQoZm9sZEhlYWRlciBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcblxuXHRcdGNvbnN0IHVzZXJUdXJuID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0nKSE7XG5cdFx0Y29uc3QgYXNzaXN0YW50VHVybiA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJhc3Npc3RhbnRcIl0nKSE7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodXNlclR1cm4uY2xhc3NMaXN0LmNvbnRhaW5zKCdjb252ZXJzYXRpb24tbGVucy10dXJuLS11c2VyLWFsaWduLWVuZCcpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFzc2lzdGFudFR1cm4uY2xhc3NMaXN0LmNvbnRhaW5zKCdjb252ZXJzYXRpb24tbGVucy10dXJuLS11c2VyLWFsaWduLWVuZCcpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKHVzZXJUdXJuLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWJvZHktLWNsaWNrYWJsZScpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodXNlclR1cm4ucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYWN0aW9ucycpLCBudWxsKTtcblxuXHRcdGNvbnN0IGFzc2lzdGFudEFjdGlvbnMgPSBhc3Npc3RhbnRUdXJuLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWFjdGlvbnMnKSE7XG5cdFx0YXNzZXJ0Lm9rKGFzc2lzdGFudEFjdGlvbnMpO1xuXG5cdFx0Y29uc3QgYXNzaXN0YW50Q29weSA9IGFzc2lzdGFudEFjdGlvbnMucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYWN0aW9uLWNvcHkgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MRWxlbWVudDtcblx0XHRjb25zdCBhc3Npc3RhbnRSZWdlbmVyYXRlID0gYXNzaXN0YW50QWN0aW9ucy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHVybi1hY3Rpb24tcmVnZW5lcmF0ZSAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IGFzc2lzdGFudERlbGV0ZSA9IGFzc2lzdGFudEFjdGlvbnMucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYWN0aW9uLWRlbGV0ZSAubW9uYWNvLWJ1dHRvbicpIGFzIEhUTUxFbGVtZW50O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFzc2lzdGFudENvcHkuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNUdXJuQ29weSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFzc2lzdGFudFJlZ2VuZXJhdGUuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNUdXJuUmVnZW5lcmF0ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFzc2lzdGFudERlbGV0ZS5nZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKSwgY29udmVyc2F0aW9uTGVuc1R1cm5EZWxldGUpO1xuXG5cdFx0Y29uc3QgYXNzaXN0YW50VHVybnMgPSBbLi4ucXVlcnlBbGxUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cImFzc2lzdGFudFwiXScpXTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXNzaXN0YW50VHVybnMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXNzaXN0YW50VHVybnNbMF0uY2xvc2VzdCgnYXJ0aWNsZScpPy5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi10aW1lbGluZS1pdGVtLS1sYXRlc3QtYXNzaXN0YW50JyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXNzaXN0YW50VHVybnNbMV0uY2xvc2VzdCgnYXJ0aWNsZScpPy5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi10aW1lbGluZS1pdGVtLS1sYXRlc3QtYXNzaXN0YW50JyksIHRydWUpO1xuXHRcdGNvbnN0IGxhdGVyQm9keSA9IGFzc2lzdGFudFR1cm5zWzFdLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWJvZHknKSE7XG5cdFx0Y29uc3QgbGF0ZXJBY3Rpb25zID0gYXNzaXN0YW50VHVybnNbMV0ucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYWN0aW9ucycpITtcblx0XHRhc3NlcnQub2sobGF0ZXJCb2R5LmNvbXBhcmVEb2N1bWVudFBvc2l0aW9uKGxhdGVyQWN0aW9ucykgJiBOb2RlLkRPQ1VNRU5UX1BPU0lUSU9OX0ZPTExPV0lORyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRoaW5raW5nIC5jb252ZXJzYXRpb24tbGVucy10dXJuLWFjdGlvbnMnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10b29sIC5jb252ZXJzYXRpb24tbGVucy10dXJuLWFjdGlvbnMnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtY29uZmlybWF0aW9uLXNlYXQgLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYWN0aW9ucycpLCBudWxsKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1c2VyVHVybi5xdWVyeVNlbGVjdG9yKCdbYXJpYS1sYWJlbCo9XCJSZWdlbmVyYXRlXCJdJyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtdGhpbmtpbmcgW2FyaWEtbGFiZWwqPVwiUmVnZW5lcmF0ZVwiXScpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRvb2wgW2FyaWEtbGFiZWwqPVwiUmVnZW5lcmF0ZVwiXScpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy1jb25maXJtYXRpb24tc2VhdCBbYXJpYS1sYWJlbCo9XCJSZWdlbmVyYXRlXCJdJyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVRpbWVsaW5lKHNsb3RzLCAnW2FyaWEtbGFiZWwqPVwiUXVvdGVcIl0nKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICdbYXJpYS1sYWJlbCo9XCJFZGl0XCJdJyksIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdEZWxldGUgdHVybiByZW1vdmVzIGl0IGZyb20gdGltZWxpbmUgYW5kIHRyYWplY3Rvcnk7IENvcHkgd3JpdGVzIHR1cm4gdGV4dCB0byBjbGlwYm9hcmQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy50aW1lb3V0KDMwMDAwKTtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMsIHN0dWJTZXJ2aWNlLCBjbGlwYm9hcmRTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0Y29uc3QgdXNlclRleHQgPSAnRGVsZXRlIGFuZCBjb3B5IHVzZXIgdGV4dCc7XG5cdFx0Y29uc3QgYXNzaXN0YW50VGV4dCA9ICdEZWxldGUgYW5kIGNvcHkgYXNzaXN0YW50IHRleHQnO1xuXG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbklkLCB1c2VyVGV4dCk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kU3R1YkVjaG9Bc3Npc3RhbnQoc2Vzc2lvbklkLCBhc3Npc3RhbnRUZXh0KTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRhd2FpdCByZXZlYWxMYXRlc3RUdXJuKGxlbnMsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uLCB0dXJuID0+IHR1cm4ua2luZCA9PT0gJ3VzZXInICYmIHR1cm4udGV4dCA9PT0gdXNlclRleHQpO1xuXHRcdGF3YWl0IHJldmVhbExhdGVzdFR1cm4obGVucywgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4sIHR1cm4gPT4gdHVybi5raW5kID09PSAnYXNzaXN0YW50JyAmJiB0dXJuLnRleHQgPT09IGFzc2lzdGFudFRleHQpO1xuXG5cdFx0Y29uc3QgdXNlclR1cm4gPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm5bZGF0YS1raW5kPVwidXNlclwiXScpITtcblx0XHRjb25zdCBhc3Npc3RhbnRUdXJuID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cImFzc2lzdGFudFwiXScpITtcblx0XHRhc3NlcnQub2sodXNlclR1cm4pO1xuXHRcdGFzc2VydC5vayhhc3Npc3RhbnRUdXJuKTtcblxuXHRcdGNsaWNrTGVuc1RhYihzbG90cywgJ3RyYWplY3RvcnknKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRhd2FpdCBwYWludFRyYWplY3RvcnlSb3dzKGxlbnMsIHNsb3RzLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiwgMik7XG5cblx0XHRsZXQgdHJhamVjdG9yeSA9IHNsb3RzLnRpbWVsaW5lLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10cmFqZWN0b3J5JykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFqZWN0b3J5LnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tbGVucy10cmFqZWN0b3J5LXJlY29yZC1yb3cnKS5sZW5ndGgsIDIpO1xuXG5cdFx0Y2xpY2tMZW5zVGFiKHNsb3RzLCAnY29udmVyc2F0aW9uJyk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cdFx0YXdhaXQgcmV2ZWFsTGF0ZXN0VHVybihsZW5zLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiwgdHVybiA9PiB0dXJuLmtpbmQgPT09ICdhc3Npc3RhbnQnICYmIHR1cm4udGV4dCA9PT0gYXNzaXN0YW50VGV4dCk7XG5cdFx0Y29uc3QgbGl2ZUFzc2lzdGFudFR1cm4gPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm5bZGF0YS1raW5kPVwiYXNzaXN0YW50XCJdJykhO1xuXHRcdGFzc2VydC5vayhsaXZlQXNzaXN0YW50VHVybik7XG5cblx0XHRjb25zdCBhc3Npc3RhbnRDb3B5ID0gbGl2ZUFzc2lzdGFudFR1cm4ucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYWN0aW9uLWNvcHkgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3Npc3RhbnRDb3B5LmNsaWNrKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGNsaXBib2FyZFNlcnZpY2UucmVhZFRleHQoKSwgYXNzaXN0YW50VGV4dCk7XG5cblx0XHRjb25zdCBhc3Npc3RhbnREZWxldGUgPSBsaXZlQXNzaXN0YW50VHVybi5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdHVybi1hY3Rpb24tZGVsZXRlIC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzaXN0YW50RGVsZXRlLmNsaWNrKCk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0VHVybnMoc2Vzc2lvbklkKS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRUdXJucyhzZXNzaW9uSWQpWzBdLnRleHQsIHVzZXJUZXh0KTtcblxuXHRcdGNsaWNrTGVuc1RhYihzbG90cywgJ3RyYWplY3RvcnknKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRhd2FpdCBwYWludFRyYWplY3RvcnlSb3dzKGxlbnMsIHNsb3RzLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiwgMSk7XG5cblx0XHR0cmFqZWN0b3J5ID0gc2xvdHMudGltZWxpbmUucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXRyYWplY3RvcnknKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWplY3RvcnkucXVlcnlTZWxlY3RvckFsbCgnLmNvbnZlcnNhdGlvbi1sZW5zLXRyYWplY3RvcnktcmVjb3JkLXJvdycpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHRyYWplY3RvcnkudGV4dENvbnRlbnQ/LmluY2x1ZGVzKHVzZXJUZXh0KSk7XG5cdFx0YXNzZXJ0Lm9rKCF0cmFqZWN0b3J5LnRleHRDb250ZW50Py5pbmNsdWRlcyhhc3Npc3RhbnRUZXh0KSk7XG5cblx0XHRjbGlja0xlbnNUYWIoc2xvdHMsICdjb252ZXJzYXRpb24nKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRhd2FpdCByZXZlYWxMYXRlc3RUdXJuKGxlbnMsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uLCB0dXJuID0+IHR1cm4ua2luZCA9PT0gJ3VzZXInICYmIHR1cm4udGV4dCA9PT0gdXNlclRleHQpO1xuXHRcdGF3YWl0IGZsdXNoQW5pbWF0aW9uRnJhbWVzKCk7XG5cblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJhc3Npc3RhbnRcIl0nKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Q1IEVkaXQgWE9SOiBlbnRlcmluZyB0dXJuIGVkaXQga2VlcHMgdGhlIGRvY2sgY29tcG9zZXIgKG5vIDBweCB3YXJuKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLnRpbWVvdXQoMTUwMDApO1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucywgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRzdHViU2VydmljZS5hcHBlbmRVc2VyVHVybihzZXNzaW9uSWQsICdFZGl0IHRoaXMgdXNlciB0dXJuJyk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cdFx0YXdhaXQgcmV2ZWFsTGF0ZXN0VHVybihsZW5zLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiwgdHVybiA9PiB0dXJuLmtpbmQgPT09ICd1c2VyJyAmJiB0dXJuLnRleHQgPT09ICdFZGl0IHRoaXMgdXNlciB0dXJuJyk7XG5cblx0XHRjb25zdCBsaXN0Vmlld1plcm9QeDogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBvcmlnaW5hbFdhcm4gPSBjb25zb2xlLndhcm47XG5cdFx0Y29uc29sZS53YXJuID0gKC4uLmFyZ3M6IHVua25vd25bXSkgPT4ge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IGFyZ3MubWFwKFN0cmluZykuam9pbignICcpO1xuXHRcdFx0aWYgKG1lc3NhZ2UuaW5jbHVkZXMoJ01lYXN1cmVkIGl0ZW0gbm9kZSBhdCAwcHgnKSkge1xuXHRcdFx0XHRsaXN0Vmlld1plcm9QeC5wdXNoKG1lc3NhZ2UpO1xuXHRcdFx0fVxuXHRcdFx0b3JpZ2luYWxXYXJuLmFwcGx5KGNvbnNvbGUsIGFyZ3MpO1xuXHRcdH07XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdXNlckJvZHkgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm5bZGF0YS1raW5kPVwidXNlclwiXSAuY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5LS1jbGlja2FibGUnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRcdGFzc2VydC5vayh1c2VyQm9keSk7XG5cdFx0XHR1c2VyQm9keS5jbGljaygpO1xuXHRcdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRcdGF3YWl0IGZsdXNoQW5pbWF0aW9uRnJhbWVzKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGNvbnNvbGUud2FybiA9IG9yaWdpbmFsV2Fybjtcblx0XHR9XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpc3RWaWV3WmVyb1B4LCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50Q29tcG9zZXJzKHNsb3RzKSwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyJyksIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdUNSBFZGl0IFhPUjogdXNlciBjYXJkIGNsaWNrIGVkaXRzIGluIHRoZSBkb2NrIGNvbXBvc2VyIGFuZCBrZWVwcyB0aGUgYm90dG9tIGJhcicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLnRpbWVvdXQoMTUwMDApO1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRjb25zdCB1c2VyVGV4dCA9ICdFZGl0IHRoaXMgdXNlciB0dXJuJztcblxuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25JZCwgdXNlclRleHQpO1xuXHRcdGxheW91dFJlYWRpbmdDb2x1bW4oKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudENvbXBvc2VycyhzbG90cyksIDEpO1xuXG5cdFx0Y29uc3QgdXNlckJvZHkgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm5bZGF0YS1raW5kPVwidXNlclwiXSAuY29udmVyc2F0aW9uLWxlbnMtdHVybi1ib2R5LS1jbGlja2FibGUnKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQub2sodXNlckJvZHkpO1xuXHRcdHVzZXJCb2R5LmNsaWNrKCk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cdFx0YXdhaXQgZmx1c2hBbmltYXRpb25GcmFtZXMoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudENvbXBvc2VycyhzbG90cyksIDEpO1xuXHRcdGNvbnN0IGRvY2tDb21wb3NlciA9IHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyJyk7XG5cdFx0YXNzZXJ0Lm9rKGRvY2tDb21wb3Nlcik7XG5cdFx0YXNzZXJ0Lm9rKGRvY2tDb21wb3Nlci5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyLS1lZGl0JykpO1xuXHRcdGFzc2VydC5vayhkb2NrQ29tcG9zZXIucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyLWVkaXQtaGVhZGVyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkb2NrQ29tcG9zZXIucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyLWVkaXQtdGl0bGUnKT8udGV4dENvbnRlbnQsIGNvbnZlcnNhdGlvbkxlbnNEb2NrRWRpdGluZ01lc3NhZ2UpO1xuXHRcdGFzc2VydC5vayhkb2NrQ29tcG9zZXIucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWRvY2stYm90dG9tLWJhcicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy1jb21wb3NlcicpLCBudWxsKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuLS1lZGl0aW5nJykpO1xuXG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBkb2NrQ29tcG9zZXIucXVlcnlTZWxlY3RvcigndGV4dGFyZWEuY29udmVyc2F0aW9uLWxlbnMtZG9jay1pbnB1dCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCB1c2VyVGV4dCk7XG5cblx0XHRjb25zdCBleGl0QnV0dG9uID0gZG9ja0NvbXBvc2VyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1jb21wb3Nlci1lZGl0LWV4aXQgLm1vbmFjby1idXR0b24nKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhpdEJ1dHRvbi5nZXRBdHRyaWJ1dGUoJ3RpdGxlJyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGl0QnV0dG9uLmdldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcpLCBjb252ZXJzYXRpb25MZW5zRG9ja0VkaXRFeGl0KTtcblx0XHRleGl0QnV0dG9uLmNsaWNrKCk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnRDb21wb3NlcnMoc2xvdHMpLCAxKTtcblx0XHRhc3NlcnQub2soc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtY29tcG9zZXInKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyLS1lZGl0JyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyJyksIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdUNSBFZGl0IFhPUjogcXVldWUgcm93IGVkaXQgbW91bnRzIGNvbXBvc2VyIGluIGRvY2sgYW5kIFhPUnMgY29tcG9zZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ0FjdGl2YXRlIHF1ZXVlIGVkaXQnKTtcblx0XHRzdHViU2VydmljZS5zZXRNZXNzYWdlUXVldWVGaXh0dXJlKHNlc3Npb25JZCwge1xuXHRcdFx0aXNQYXVzZWQ6IGZhbHNlLFxuXHRcdFx0aXNQcm9jZXNzaW5nOiBmYWxzZSxcblx0XHRcdGl0ZW1zOiBbe1xuXHRcdFx0XHRpZDogJ3EtZWRpdCcsXG5cdFx0XHRcdGNvbnRlbnQ6ICdRdWV1ZWQgbWVzc2FnZSBib2R5Jyxcblx0XHRcdFx0c3RhdHVzOiAnUEVORElORycsXG5cdFx0XHRcdGhvbGQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0dXBsb2FkUHJvZ3Jlc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0cmV0cnlDb3VudDogMCxcblx0XHRcdFx0bGFzdEVycm9yOiB1bmRlZmluZWQsXG5cdFx0XHRcdGxvY2tlZDogZmFsc2UsXG5cdFx0XHRcdHBpbm5lZDogZmFsc2UsXG5cdFx0XHR9XSxcblx0XHR9KTtcblxuXHRcdGdldEluYm94UXVldWVDaGlwKHNsb3RzKS5jbGljaygpO1xuXHRcdGNvbnN0IHJvdyA9IGdldFZpc2libGVJbmJveExpc3RQYW5lbCgpIS5xdWVyeVNlbGVjdG9yKCcucXVldWUtaXRlbVtkYXRhLWl0ZW0taWQ9XCJxLWVkaXRcIl0nKSBhcyBIVE1MRWxlbWVudDtcblx0XHRyb3cuY2xpY2soKTtcblx0XHRhd2FpdCBmbHVzaEFuaW1hdGlvbkZyYW1lcygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50Q29tcG9zZXJzKHNsb3RzKSwgMSk7XG5cdFx0Y29uc3QgZG9ja0NvbXBvc2VyID0gc2xvdHMuZG9jay5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtY29tcG9zZXInKSE7XG5cdFx0YXNzZXJ0Lm9rKGRvY2tDb21wb3Nlci5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyLS1lZGl0JykpO1xuXHRcdGFzc2VydC5vayhkb2NrQ29tcG9zZXIucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyLWVkaXQtdGl0bGUnKT8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdRdWV1ZWQgbWVzc2FnZSBib2R5JykpO1xuXG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBkb2NrQ29tcG9zZXIucXVlcnlTZWxlY3RvcigndGV4dGFyZWEuY29udmVyc2F0aW9uLWxlbnMtZG9jay1pbnB1dCcpIGFzIEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCAnUXVldWVkIG1lc3NhZ2UgYm9keScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyJyksIG51bGwpO1xuXG5cdFx0Y29uc3QgZXhpdEJ1dHRvbiA9IGRvY2tDb21wb3Nlci5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtY29tcG9zZXItZWRpdC1leGl0IC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0ZXhpdEJ1dHRvbi5jbGljaygpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0dWJTZXJ2aWNlLmdldE1lc3NhZ2VRdWV1ZVN0YXRlKHNlc3Npb25JZCkuaXRlbXNbMF0/LmhvbGQsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50Q29tcG9zZXJzKHNsb3RzKSwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHNsb3RzLmRvY2sucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbXBvc2VyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1jb21wb3Nlci0tZWRpdCcpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnVDYgVm9pY2U6IG5vIG1pYywgbm8gdHJhbnNjcmlwdCBiYXIsIGFuZCBubyBzdHViIHBocmFzZSB3cml0dGVuIHRvIGRyYWZ0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRhd2FpdCBzZW5kRG9ja0RyYWZ0QW5kRmx1c2goc2xvdHMsICdzZWVkIGFjdGl2ZSBjb21wb3NlcicpO1xuXG5cdFx0Y29uc3QgeyBtb2RlbCwgb25TZXNzaW9uQ2hhbmdlZCB9ID0gc3R1YlNlcnZpY2UuY3JlYXRlVGVzdEZyYW1lU291cmNlQ2FsbGJhY2soKTtcblx0XHRjb25zdCB0ZXN0U291cmNlID0gc3RvcmUuYWRkKG5ldyBUZXN0Q29udmVyc2F0aW9uRnJhbWVTb3VyY2UobW9kZWwsIG9uU2Vzc2lvbkNoYW5nZWQpKTtcblx0XHRzdHViU2VydmljZS53aXJlVGVzdEZyYW1lU291cmNlKHRlc3RTb3VyY2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvblN5bmMoc2Vzc2lvbklkKSwgeyBraW5kOiAnaWRsZScgfSk7XG5cblx0XHRjb25zdCB0cmFpbGluZyA9IGdldENvbXBvc2VyQm90dG9tQmFyKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1ib3R0b20tdHJhaWxpbmcnKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWlsaW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1pYycpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRzbG90cy5kb2NrLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy12b2ljZS10cmFuc2NyaXB0LWJhcicpXG5cdFx0XHQ/PyBnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtdm9pY2UtdHJhbnNjcmlwdC1iYXInKSxcblx0XHRcdG51bGwpO1xuXG5cdFx0c3R1YlNlcnZpY2Uuc2V0RW5naW5lQ29ubmVjdGVkKHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFpbGluZy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLWxlbnMtZG9jay1taWMnKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRTZXNzaW9uU3luYyhzZXNzaW9uSWQpLCB7IGtpbmQ6ICdpZGxlJyB9KTtcblxuXHRcdHN0dWJTZXJ2aWNlLnNldE1lc3NhZ2VRdWV1ZUZpeHR1cmUoc2Vzc2lvbklkLCB7XG5cdFx0XHRpdGVtczogW3sgaWQ6ICdxMScsIGNvbnRlbnQ6ICdRdWV1ZWQgaXRlbScsIHN0YXR1czogJ1BFTkRJTkcnLCBob2xkOiB1bmRlZmluZWQsIHVwbG9hZFByb2dyZXNzOiB1bmRlZmluZWQsIHJldHJ5Q291bnQ6IDAsIGxhc3RFcnJvcjogdW5kZWZpbmVkLCBsb2NrZWQ6IGZhbHNlLCBwaW5uZWQ6IGZhbHNlIH1dLFxuXHRcdFx0aXNQYXVzZWQ6IGZhbHNlLFxuXHRcdFx0aXNQcm9jZXNzaW5nOiBmYWxzZSxcblx0XHR9KTtcblxuXHRcdGdldEluYm94UXVldWVDaGlwKHNsb3RzKS5jbGljaygpO1xuXHRcdGNvbnN0IHF1ZXVlUGFuZWwgPSBnZXRWaXNpYmxlSW5ib3hMaXN0UGFuZWwoKTtcblx0XHRhc3NlcnQub2socXVldWVQYW5lbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXVlUGFuZWwhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy12b2ljZS10cmFuc2NyaXB0LWJhcicpLCBudWxsKTtcblx0XHRhc3NlcnQub2soIXF1ZXVlUGFuZWwhLnRleHRDb250ZW50Py5pbmNsdWRlcygnU3R1YiB2b2ljZSBzZWdtZW50JykpO1xuXG5cdFx0Y29uc3QgZHJhZnRCZWZvcmUgPSBnZXREb2NrVGV4dGFyZWEoc2xvdHMpLnZhbHVlO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCA1MCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXREb2NrVGV4dGFyZWEoc2xvdHMpLnZhbHVlLCBkcmFmdEJlZm9yZSk7XG5cdFx0YXNzZXJ0Lm9rKCFnZXREb2NrVGV4dGFyZWEoc2xvdHMpLnZhbHVlLmluY2x1ZGVzKCdTdHViIHZvaWNlIHNlZ21lbnQgb25lJykpO1xuXHRcdGFzc2VydC5vayghZ2V0RG9ja1RleHRhcmVhKHNsb3RzKS52YWx1ZS5pbmNsdWRlcygnU3R1YiB2b2ljZSBzZWdtZW50IHR3bycpKTtcblx0XHRhc3NlcnQub2soIWdldERvY2tUZXh0YXJlYShzbG90cykudmFsdWUuaW5jbHVkZXMoJ1N0dWIgdm9pY2Ugc2VnbWVudCB0aHJlZScpKTtcblxuXHRcdHN0dWJTZXJ2aWNlLnNldEVuZ2luZUNvbm5lY3RlZChmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWlsaW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1pYycpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnVDYgVm9pY2U6IGNvbm5lY3RlZCBlbmdpbmUgc3RpbGwgaGFzIG5vIG1pYyB3cml0ZS10by1kcmFmdCBwYXRoJywgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRjb25zdCB7IG1vZGVsLCBvblNlc3Npb25DaGFuZ2VkIH0gPSBzdHViU2VydmljZS5jcmVhdGVUZXN0RnJhbWVTb3VyY2VDYWxsYmFjaygpO1xuXHRcdGNvbnN0IHRlc3RTb3VyY2UgPSBzdG9yZS5hZGQobmV3IFRlc3RDb252ZXJzYXRpb25GcmFtZVNvdXJjZShtb2RlbCwgb25TZXNzaW9uQ2hhbmdlZCkpO1xuXHRcdHN0dWJTZXJ2aWNlLndpcmVUZXN0RnJhbWVTb3VyY2UodGVzdFNvdXJjZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRTZXNzaW9uU3luYyhzZXNzaW9uSWQpLCB7IGtpbmQ6ICdpZGxlJyB9KTtcblx0XHRzdHViU2VydmljZS5zZXRFbmdpbmVDb25uZWN0ZWQodHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0Q29tcG9zZXJCb3R0b21CYXIoc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1kb2NrLW1pYycpLCBudWxsKTtcblx0XHRhc3NlcnQub2soIWdldERvY2tUZXh0YXJlYShzbG90cykudmFsdWUuaW5jbHVkZXMoJ1N0dWIgdm9pY2Ugc2VnbWVudCcpKTtcblx0fSk7XG5cblx0dGVzdCgnUzMgc2VuZDogZG9jayBwb3N0IHNob3dzIHBlbmRpbmcgdXNlciByb3cgdGhlbiBzdXBlcnNlZGVzIHRvIGR1cmFibGUgdHVybnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ3BlbmRpbmcgdGhlbiBkdXJhYmxlJyk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoQW5pbWF0aW9uRnJhbWVzKCk7XG5cdFx0YXNzZXJ0Lm9rKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJ1c2VyXCJdJykpO1xuXG5cdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDApKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblxuXHRcdGFzc2VydC5vayhxdWVyeVRpbWVsaW5lKHNsb3RzLCAnLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm5bZGF0YS1raW5kPVwidXNlclwiXScpKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cImFzc2lzdGFudFwiXScpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvblN5bmMoc2Vzc2lvbklkKS5raW5kLCAnaWRsZScpO1xuXHRcdGNvbnN0IHN5bmNCYWRnZSA9IHNsb3RzLnNlc3Npb25CYXIhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy1zZXNzaW9uLXN5bmMtYmFkZ2UnKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKHN5bmNCYWRnZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN5bmNCYWRnZS5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3luY0JhZGdlLnRleHRDb250ZW50LCAnU2Vzc2lvbiBub3QgY29ubmVjdGVkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN5bmNCYWRnZS50aXRsZSwgJ1Nlc3Npb24gbm90IGNvbm5lY3RlZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdQUkQtMDA3OiBjbG9zZWQgc2Vzc2lvbiBzaG93cyBjb2x1bW4tdG9wIHN0YWxlIHNuYXBzaG90IGFuZCBrZWVwcyBwcmlvciB0dXJucycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSBzdHViU2VydmljZS5jcmVhdGVTZXNzaW9uKCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbklkLCAnS2VlcCB0aGlzIHR1cm4gYWZ0ZXIgZGlzY29ubmVjdCcpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFN0dWJFY2hvQXNzaXN0YW50KHNlc3Npb25JZCwgJ0VjaG8gYmVmb3JlIGRpc2Nvbm5lY3QnKTtcblx0XHRhd2FpdCBmbHVzaFByb2plY3RlZFRpbWVsaW5lKGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0Y29uc3QgYmFubmVyID0gZ2V0UmVhZGluZ0NvbHVtbihzbG90cykucXVlcnlTZWxlY3RvcihgLiR7Y29udmVyc2F0aW9uTGVuc1N0YWxlU25hcHNob3RDbGFzc31gKSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG5cdFx0YXNzZXJ0Lm9rKGJhbm5lcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhbm5lci5oaWRkZW4sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYW5uZXIuZ2V0QXR0cmlidXRlKCdyb2xlJyksICdzdGF0dXMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFubmVyLmdldEF0dHJpYnV0ZSgnYXJpYS1saXZlJyksICdwb2xpdGUnKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0nKT8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdLZWVwIHRoaXMgdHVybiBhZnRlciBkaXNjb25uZWN0JykpO1xuXG5cdFx0Y29uc3QgeyBtb2RlbCwgb25TZXNzaW9uQ2hhbmdlZCB9ID0gc3R1YlNlcnZpY2UuY3JlYXRlVGVzdEZyYW1lU291cmNlQ2FsbGJhY2soKTtcblx0XHRjb25zdCB0ZXN0U291cmNlID0gc3RvcmUuYWRkKG5ldyBUZXN0Q29udmVyc2F0aW9uRnJhbWVTb3VyY2UobW9kZWwsIG9uU2Vzc2lvbkNoYW5nZWQpKTtcblx0XHRzdHViU2VydmljZS53aXJlVGVzdEZyYW1lU291cmNlKHRlc3RTb3VyY2UpO1xuXG5cdFx0dGVzdFNvdXJjZS5zZXRTZXNzaW9uU3luYyhzZXNzaW9uSWQsIHsga2luZDogJ2xpdmUnIH0pO1xuXHRcdG9uU2Vzc2lvbkNoYW5nZWQoc2Vzc2lvbklkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFubmVyLmhpZGRlbiwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJ1c2VyXCJdJyk/LnRleHRDb250ZW50Py5pbmNsdWRlcygnS2VlcCB0aGlzIHR1cm4gYWZ0ZXIgZGlzY29ubmVjdCcpKTtcblxuXHRcdHRlc3RTb3VyY2Uuc2V0U2Vzc2lvblN5bmMoc2Vzc2lvbklkLCB7IGtpbmQ6ICdjbG9zZWQnLCByZWFzb246ICdTdWJzY3JpcHRpb24gZW5kZWQnIH0pO1xuXHRcdG9uU2Vzc2lvbkNoYW5nZWQoc2Vzc2lvbklkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvblN5bmMoc2Vzc2lvbklkKS5raW5kLCAnY2xvc2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhbm5lci5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFubmVyLnRleHRDb250ZW50LCAnU2hvd2luZyBzbmFwc2hvdCBmcm9tIGJlZm9yZSBkaXNjb25uZWN0OiBTdWJzY3JpcHRpb24gZW5kZWQnKTtcblx0XHRhc3NlcnQub2soIS9zeW5jZWR8XHU1REYyXHU1NDBDXHU2QjY1fHNlc3Npb24gbGl2ZS9pLnRlc3QoYmFubmVyLnRleHRDb250ZW50ID8/ICcnKSk7XG5cdFx0YXNzZXJ0Lm9rKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJ1c2VyXCJdJyk/LnRleHRDb250ZW50Py5pbmNsdWRlcygnS2VlcCB0aGlzIHR1cm4gYWZ0ZXIgZGlzY29ubmVjdCcpKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cImFzc2lzdGFudFwiXScpPy50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ0VjaG8gYmVmb3JlIGRpc2Nvbm5lY3QnKSk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQsIGJhbm5lcik7XG5cblx0XHR0ZXN0U291cmNlLnNldFNlc3Npb25TeW5jKHNlc3Npb25JZCwgeyBraW5kOiAnbGl2ZScgfSk7XG5cdFx0b25TZXNzaW9uQ2hhbmdlZChzZXNzaW9uSWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYW5uZXIuaGlkZGVuLCB0cnVlKTtcblx0XHRhc3NlcnQub2socXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0nKT8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdLZWVwIHRoaXMgdHVybiBhZnRlciBkaXNjb25uZWN0JykpO1xuXG5cdFx0dGVzdFNvdXJjZS5zZXRTZXNzaW9uU3luYyhzZXNzaW9uSWQsIHsga2luZDogJ2Nsb3NlZCcsIHJlYXNvbjogJzInIH0pO1xuXHRcdG9uU2Vzc2lvbkNoYW5nZWQoc2Vzc2lvbklkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFubmVyLmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYW5uZXIudGV4dENvbnRlbnQsICdTaG93aW5nIHNuYXBzaG90IGZyb20gYmVmb3JlIGRpc2Nvbm5lY3QnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9ybWF0U3luY0Nocm9tZUxhYmVsKHsga2luZDogJ2Nsb3NlZCcsIHJlYXNvbjogJzInIH0pLCAnU2Vzc2lvbiBkaXNjb25uZWN0ZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9ybWF0U3luY0Nocm9tZUxhYmVsKHsga2luZDogJ2RlZ3JhZGVkJywgcmVhc29uOiAnMycgfSksICdTZXNzaW9uIGRlZ3JhZGVkJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1BSRC0wMDc6IGVtcHR5IGNsb3NlZCBzZXNzaW9uIGRvZXMgbm90IGNsYWltIGEgc25hcHNob3QnLCAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IGJhbm5lciA9IGdldFJlYWRpbmdDb2x1bW4oc2xvdHMpLnF1ZXJ5U2VsZWN0b3IoYC4ke2NvbnZlcnNhdGlvbkxlbnNTdGFsZVNuYXBzaG90Q2xhc3N9YCkgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0Y29uc3QgeyBtb2RlbCwgb25TZXNzaW9uQ2hhbmdlZCB9ID0gc3R1YlNlcnZpY2UuY3JlYXRlVGVzdEZyYW1lU291cmNlQ2FsbGJhY2soKTtcblx0XHRjb25zdCB0ZXN0U291cmNlID0gc3RvcmUuYWRkKG5ldyBUZXN0Q29udmVyc2F0aW9uRnJhbWVTb3VyY2UobW9kZWwsIG9uU2Vzc2lvbkNoYW5nZWQpKTtcblx0XHRzdHViU2VydmljZS53aXJlVGVzdEZyYW1lU291cmNlKHRlc3RTb3VyY2UpO1xuXG5cdFx0dGVzdFNvdXJjZS5zZXRTZXNzaW9uU3luYyhzZXNzaW9uSWQsIHsga2luZDogJ2Nsb3NlZCcsIHJlYXNvbjogJzInIH0pO1xuXHRcdG9uU2Vzc2lvbkNoYW5nZWQoc2Vzc2lvbklkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHViU2VydmljZS5nZXRUdXJucyhzZXNzaW9uSWQpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhbm5lci5oaWRkZW4sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYW5uZXIudGV4dENvbnRlbnQsICcnKTtcblx0fSk7XG5cblx0dGVzdCgnUFJELTAwNzogbGVhc2UgYXBwbHkgY2xvc2VkIHN5bmMgc2hvd3Mgc3RhbGUgc25hcHNob3Qgd2l0aG91dCBvbkRpZENoYW5nZVNlc3Npb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25JZCwgJ0tlZXAgdGhpcyB0dXJuIGFmdGVyIGxlYXNlLW9ubHkgc3luYycpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFN0dWJFY2hvQXNzaXN0YW50KHNlc3Npb25JZCwgJ0VjaG8gYmVmb3JlIGxlYXNlLW9ubHkgc3luYycpO1xuXHRcdGF3YWl0IGZsdXNoUHJvamVjdGVkVGltZWxpbmUobGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cblx0XHRjb25zdCBiYW5uZXIgPSBnZXRSZWFkaW5nQ29sdW1uKHNsb3RzKS5xdWVyeVNlbGVjdG9yKGAuJHtjb252ZXJzYXRpb25MZW5zU3RhbGVTbmFwc2hvdENsYXNzfWApIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRhc3NlcnQub2soYmFubmVyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFubmVyLmhpZGRlbiwgdHJ1ZSk7XG5cblx0XHRjb25zdCB7IG1vZGVsLCBvblNlc3Npb25DaGFuZ2VkIH0gPSBzdHViU2VydmljZS5jcmVhdGVUZXN0RnJhbWVTb3VyY2VDYWxsYmFjaygpO1xuXHRcdGNvbnN0IHRlc3RTb3VyY2UgPSBzdG9yZS5hZGQobmV3IFRlc3RDb252ZXJzYXRpb25GcmFtZVNvdXJjZShtb2RlbCwgb25TZXNzaW9uQ2hhbmdlZCkpO1xuXHRcdHN0dWJTZXJ2aWNlLndpcmVUZXN0RnJhbWVTb3VyY2UodGVzdFNvdXJjZSk7XG5cdFx0bGVucy5iaW5kU2Vzc2lvblZpZXcoc2Vzc2lvbklkKTtcblxuXHRcdGxldCBzZXNzaW9uQ2hhbmdlZEFmdGVyQmluZCA9IDA7XG5cdFx0c3RvcmUuYWRkKHN0dWJTZXJ2aWNlLm9uRGlkQ2hhbmdlU2Vzc2lvbigoKSA9PiB7IHNlc3Npb25DaGFuZ2VkQWZ0ZXJCaW5kKys7IH0pKTtcblxuXHRcdHRlc3RTb3VyY2Uuc2V0U2Vzc2lvblN5bmMoc2Vzc2lvbklkLCB7IGtpbmQ6ICdjbG9zZWQnLCByZWFzb246ICdTdWJzY3JpcHRpb24gZW5kZWQnIH0pO1xuXHRcdGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gc2V0VGltZW91dChyZXNvbHZlLCAyMCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlc3Npb25DaGFuZ2VkQWZ0ZXJCaW5kLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvblN5bmMoc2Vzc2lvbklkKS5raW5kLCAnY2xvc2VkJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhbm5lci5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFubmVyLnRleHRDb250ZW50LCAnU2hvd2luZyBzbmFwc2hvdCBmcm9tIGJlZm9yZSBkaXNjb25uZWN0OiBTdWJzY3JpcHRpb24gZW5kZWQnKTtcblx0fSk7XG5cblx0dGVzdCgnUzMgc2hpbTogZ2V0VHVybnMgbWF0Y2hlcyBsZWFzZSBwcm9qZWN0aW9uIGFmdGVyIGZpeHR1cmUgd3JpdGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBzdG9yZS5hZGQobmV3IENvbnZlcnNhdGlvblN0dWJTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdHNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbklkLCAnc2hpbSBjaGVjaycpO1xuXHRcdGNvbnN0IGxlYXNlID0gc3RvcmUuYWRkKHNlcnZpY2UuYWNxdWlyZVNlc3Npb25WaWV3KHNlc3Npb25JZCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRzZXJ2aWNlLmdldFR1cm5zKHNlc3Npb25JZCksXG5cdFx0XHRlbnRyaWVzVG9MZWdhY3lUdXJucyhwcm9qZWN0U25hcHNob3RUb0VudHJpZXMobGVhc2Uuc25hcHNob3QsIGxlYXNlLmF0dHJpYnV0aW9uLCBsZWFzZS5kZXRhaWxzLCBzZXJ2aWNlLnN0dWJUdXJuU2Vzc2lvbkxpbmtDYXRhbG9nKSksXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZG9jayBpbnB1dCBoaXN0b3J5IHJlY2FsbHMgc2VudCB1c2VyIGRyYWZ0cyB3aXRoIEFycm93VXAgYW5kIEFycm93RG93biBvbiBlbXB0eSBjb21wb3NlcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblxuXHRcdGF3YWl0IHNlbmREb2NrRHJhZnQoc2xvdHMsICdmaXJzdCBtZXNzYWdlJyk7XG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ3NlY29uZCBtZXNzYWdlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCAnJyk7XG5cblx0XHRkaXNwYXRjaERvY2tLZXlkb3duKHRleHRhcmVhLCBLZXlDb2RlLlVwQXJyb3cpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJ3NlY29uZCBtZXNzYWdlJyk7XG5cblx0XHRkaXNwYXRjaERvY2tLZXlkb3duKHRleHRhcmVhLCBLZXlDb2RlLlVwQXJyb3cpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJ2ZpcnN0IG1lc3NhZ2UnKTtcblxuXHRcdGRpc3BhdGNoRG9ja0tleWRvd24odGV4dGFyZWEsIEtleUNvZGUuRG93bkFycm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICdzZWNvbmQgbWVzc2FnZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2NrIGlucHV0IGhpc3RvcnkgaXMgaXNvbGF0ZWQgcGVyIHNlc3Npb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBnZXREb2NrVGV4dGFyZWEoc2xvdHMpO1xuXG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ3Nlc3Npb24gQSBvbmx5Jyk7XG5cdFx0Y29uc3Qgc2Vzc2lvbkJJZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3R1YlNlcnZpY2UuZ2V0QWN0aXZlU2Vzc2lvbklkKCksIHNlc3Npb25CSWQpO1xuXG5cdFx0ZGlzcGF0Y2hEb2NrS2V5ZG93bih0ZXh0YXJlYSwgS2V5Q29kZS5VcEFycm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICcnKTtcblxuXHRcdHN0dWJTZXJ2aWNlLnN3aXRjaFNlc3Npb24oc3R1YlNlcnZpY2UuZ2V0U2Vzc2lvbnMoKVswXS5pZCk7XG5cdFx0ZGlzcGF0Y2hEb2NrS2V5ZG93bih0ZXh0YXJlYSwgS2V5Q29kZS5VcEFycm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICdzZXNzaW9uIEEgb25seScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2NrIGlucHV0IGhpc3RvcnkgRXNjYXBlIHJlc3RvcmVzIHVuc2VudCBkcmFmdCBzbmFwc2hvdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblxuXHRcdGF3YWl0IHNlbmREb2NrRHJhZnQoc2xvdHMsICdzZW50IG1lc3NhZ2UnKTtcblx0XHR0ZXh0YXJlYS52YWx1ZSA9ICcgICc7XG5cdFx0ZGlzcGF0Y2hEb2NrS2V5ZG93bih0ZXh0YXJlYSwgS2V5Q29kZS5VcEFycm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICdzZW50IG1lc3NhZ2UnKTtcblxuXHRcdGRpc3BhdGNoRG9ja0tleWRvd24odGV4dGFyZWEsIEtleUNvZGUuRXNjYXBlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICcgICcpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2NrIGlucHV0IGhpc3RvcnkgdHlwaW5nIGV4aXRzIGJyb3dzZSBhbmQga2VlcHMgZWRpdGVkIHRleHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0IH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRjb25zdCB0ZXh0YXJlYSA9IGdldERvY2tUZXh0YXJlYShzbG90cyk7XG5cblx0XHRhd2FpdCBzZW5kRG9ja0RyYWZ0KHNsb3RzLCAnc2VudCBtZXNzYWdlJyk7XG5cdFx0ZGlzcGF0Y2hEb2NrS2V5ZG93bih0ZXh0YXJlYSwgS2V5Q29kZS5VcEFycm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICdzZW50IG1lc3NhZ2UnKTtcblxuXHRcdHRleHRhcmVhLnZhbHVlID0gYCR7dGV4dGFyZWEudmFsdWV9YWA7XG5cdFx0dGV4dGFyZWEuZGlzcGF0Y2hFdmVudChuZXcgZ2xvYmFsVGhpcy5FdmVudCgnaW5wdXQnLCB7IGJ1YmJsZXM6IHRydWUgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJ3NlbnQgbWVzc2FnZWEnKTtcblxuXHRcdGRpc3BhdGNoRG9ja0tleWRvd24odGV4dGFyZWEsIEtleUNvZGUuVXBBcnJvdyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCAnc2VudCBtZXNzYWdlYScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2NrIGlucHV0IGhpc3RvcnkgaWdub3JlcyBkZWxldGVkIHVzZXIgdHVybnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblxuXHRcdGF3YWl0IHNlbmREb2NrRHJhZnQoc2xvdHMsICdkZWxldGUgbWUnKTtcblx0XHRhd2FpdCBzZW5kRG9ja0RyYWZ0KHNsb3RzLCAna2VlcCBtZScpO1xuXHRcdGNvbnN0IGRvb21lZCA9IHN0dWJTZXJ2aWNlLmdldFR1cm5zKHNlc3Npb25JZCkuZmluZCh0dXJuID0+IHR1cm4ua2luZCA9PT0gJ3VzZXInICYmIHR1cm4udGV4dCA9PT0gJ2RlbGV0ZSBtZScpO1xuXHRcdGFzc2VydC5vayhkb29tZWQpO1xuXHRcdHN0dWJTZXJ2aWNlLmRlbGV0ZVR1cm4oc2Vzc2lvbklkLCBkb29tZWQuaWQpO1xuXG5cdFx0ZGlzcGF0Y2hEb2NrS2V5ZG93bih0ZXh0YXJlYSwgS2V5Q29kZS5VcEFycm93KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICdrZWVwIG1lJyk7XG5cblx0XHRkaXNwYXRjaERvY2tLZXlkb3duKHRleHRhcmVhLCBLZXlDb2RlLlVwQXJyb3cpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJ2tlZXAgbWUnKTtcblx0fSk7XG5cblx0dGVzdCgnZG9jayBpbnB1dCBoaXN0b3J5IGlnbm9yZXMgQXJyb3dVcCB3aGVuIGNvbXBvc2VyIGlzIG5vdCB0cmltLWVtcHR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBnZXREb2NrVGV4dGFyZWEoc2xvdHMpO1xuXG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ3NlbnQgbWVzc2FnZScpO1xuXHRcdHRleHRhcmVhLnZhbHVlID0gJ3R5cGluZyBub3cnO1xuXHRcdGRpc3BhdGNoRG9ja0tleWRvd24odGV4dGFyZWEsIEtleUNvZGUuVXBBcnJvdyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCAndHlwaW5nIG5vdycpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb2RpZmllZCBhcnJvd3MgZG8gbm90IHJlY2FsbCBpbnB1dCBoaXN0b3J5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3QgdGV4dGFyZWEgPSBnZXREb2NrVGV4dGFyZWEoc2xvdHMpO1xuXG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ3NlbnQgbWVzc2FnZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJycpO1xuXHRcdHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ID0gMDtcblx0XHR0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSAwO1xuXHRcdHRleHRhcmVhLmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IGtleUNvZGU6IDM4LCBzaGlmdEtleTogdHJ1ZSwgYnViYmxlczogdHJ1ZSwgY2FuY2VsYWJsZTogdHJ1ZSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCAnJyk7XG5cblx0XHRkaXNwYXRjaERvY2tLZXlkb3duKHRleHRhcmVhLCBLZXlDb2RlLlVwQXJyb3cpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS52YWx1ZSwgJ3NlbnQgbWVzc2FnZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdhcnJvdyBpbnNpZGUgYSByZWNhbGxlZCBtdWx0aS1saW5lIGRvY2sgZHJhZnQgZG9lcyBub3QgcmVwbGFjZSBpdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHRleHRhcmVhID0gZ2V0RG9ja1RleHRhcmVhKHNsb3RzKTtcblxuXHRcdGF3YWl0IHNlbmREb2NrRHJhZnQoc2xvdHMsICdvbGRlclxcbnN0aWxsIG9sZGVyJyk7XG5cdFx0YXdhaXQgc2VuZERvY2tEcmFmdChzbG90cywgJ25ld2VyXFxuc3RpbGwgbmV3ZXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dGFyZWEudmFsdWUsICcnKTtcblxuXHRcdGRpc3BhdGNoRG9ja0tleWRvd24odGV4dGFyZWEsIEtleUNvZGUuVXBBcnJvdyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCAnbmV3ZXJcXG5zdGlsbCBuZXdlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCwgMCk7XG5cblx0XHR0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA9ICduZXdlclxcbicubGVuZ3RoO1xuXHRcdHRleHRhcmVhLnNlbGVjdGlvbkVuZCA9IHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xuXHRcdGRpc3BhdGNoRG9ja0tleWRvd24odGV4dGFyZWEsIEtleUNvZGUuVXBBcnJvdyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRleHRhcmVhLnZhbHVlLCAnbmV3ZXJcXG5zdGlsbCBuZXdlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCwgJ25ld2VyXFxuJy5sZW5ndGgpO1xuXHR9KTtcblxuXHR0ZXN0KCdwaW5uZWQgdXNlciBwcm9tcHQgaXMgaGlkZGVuIGF0IGJvdHRvbSBhbmQgb24gZW1wdHkgc2Vzc2lvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHR0aGlzLnRpbWVvdXQoMzAwMDApO1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucywgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGNvbnN0IHNlc3Npb25JZCA9IHN0dWJTZXJ2aWNlLmNyZWF0ZVNlc3Npb24oKTtcblxuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChnZXRQaW5uZWRVc2VyUHJvbXB0KHNsb3RzKT8uY2xhc3NMaXN0LmNvbnRhaW5zKCdjb252ZXJzYXRpb24tdGltZWxpbmUtcGlubmVkLXVzZXItLXZpc2libGUnKSwgdHJ1ZSk7XG5cblx0XHRzdHViU2VydmljZS5hcHBlbmRVc2VyVHVybihzZXNzaW9uSWQsICdXaGF0IGlzIHBpbm5lZD8nKTtcblx0XHRzdHViU2VydmljZS5hcHBlbmRTdHViRWNob0Fzc2lzdGFudChzZXNzaW9uSWQsIHVzZXJNZXNzYWdlTGluZXMoNDApKTtcblx0XHRsYXlvdXRSZWFkaW5nQ29sdW1uKCk7XG5cdFx0YXdhaXQgZmx1c2hUaW1lbGluZUhlaWdodFVwZGF0ZXMoKTtcblx0XHRzY3JvbGxUaW1lbGluZVRvRW5kV2l0aG91dENsb2JiZXIobGVucyk7XG5cdFx0YXdhaXQgZmx1c2hBbmltYXRpb25GcmFtZXMoKTtcblxuXHRcdGFzc2VydC5vayghZ2V0UGlubmVkVXNlclByb21wdChzbG90cyk/LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLXRpbWVsaW5lLXBpbm5lZC11c2VyLS12aXNpYmxlJykpO1xuXG5cdFx0YXdhaXQgc2Nyb2xsVGltZWxpbmVBd2F5RnJvbVBpbm5lZFJlYWQobGVucywgc2xvdHMsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0YXNzZXJ0Lm9rKGdldFBpbm5lZFVzZXJQcm9tcHQoc2xvdHMpPy5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi10aW1lbGluZS1waW5uZWQtdXNlci0tdmlzaWJsZScpKTtcblxuXHRcdHNjcm9sbFRpbWVsaW5lVG9FbmRXaXRob3V0Q2xvYmJlcihsZW5zKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXHRcdGF3YWl0IGZsdXNoQW5pbWF0aW9uRnJhbWVzKCk7XG5cblx0XHRhc3NlcnQub2soIWdldFBpbm5lZFVzZXJQcm9tcHQoc2xvdHMpPy5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi10aW1lbGluZS1waW5uZWQtdXNlci0tdmlzaWJsZScpKTtcblx0fSk7XG5cblx0dGVzdCgncGlubmVkIHVzZXIgcHJvbXB0IHNob3dzIG9uZS1saW5lIHByZXZpZXcgYW5kIHJldmVhbHMgdXNlciB0dXJuIG9uIGNsaWNrJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgzMDAwMCk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IHVzZXJUZXh0ID0gJ1Njcm9sbCB0YXJnZXQgdXNlciBwcm9tcHQnO1xuXG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kVXNlclR1cm4oc2Vzc2lvbklkLCB1c2VyVGV4dCk7XG5cdFx0c3R1YlNlcnZpY2UuYXBwZW5kU3R1YkVjaG9Bc3Npc3RhbnQoc2Vzc2lvbklkLCB1c2VyTWVzc2FnZUxpbmVzKDQwKSk7XG5cdFx0bGF5b3V0UmVhZGluZ0NvbHVtbigpO1xuXHRcdGF3YWl0IGZsdXNoVGltZWxpbmVIZWlnaHRVcGRhdGVzKCk7XG5cdFx0YXdhaXQgc2Nyb2xsVGltZWxpbmVBd2F5RnJvbVBpbm5lZFJlYWQobGVucywgc2xvdHMsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXG5cdFx0Y29uc3QgYnViYmxlID0gZ2V0UGlubmVkVXNlclByb21wdEJ1YmJsZShzbG90cyk7XG5cdFx0YXNzZXJ0Lm9rKGJ1YmJsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1YmJsZSEuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNQaW5uZWRVc2VyUHJvbXB0QXJpYSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1YmJsZSEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi10aW1lbGluZS1waW5uZWQtdXNlci10ZXh0Jyk/LnRleHRDb250ZW50LCB1c2VyVGV4dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJ1YmJsZSEudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdQaW5uZWQgcHJvbXB0JyksIGZhbHNlKTtcblxuXHRcdGJ1YmJsZSEuY2xpY2soKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXHRcdGF3YWl0IGZsdXNoQW5pbWF0aW9uRnJhbWVzKCk7XG5cdFx0YXdhaXQgcmV2ZWFsTGF0ZXN0VHVybihsZW5zLCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiwgdHVybiA9PiB0dXJuLmtpbmQgPT09ICd1c2VyJyAmJiB0dXJuLnRleHQgPT09IHVzZXJUZXh0KTtcblxuXHRcdGNvbnN0IHVzZXJUdXJuID0gcXVlcnlUaW1lbGluZShzbG90cywgJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0nKTtcblx0XHRhc3NlcnQub2sodXNlclR1cm4pO1xuXHRcdGFzc2VydC5vayghZ2V0UGlubmVkVXNlclByb21wdChzbG90cyk/LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLXRpbWVsaW5lLXBpbm5lZC11c2VyLS12aXNpYmxlJykpO1xuXHR9KTtcblxuXHR0ZXN0KCd1bnRpdGxlZCBmaXh0dXJlIHJlbmRlcnMgY29sbGFwc2VkIHByb2Nlc3MgZm9sZCBoZWFkZXIgd2l0aCBTdHViIHN1bW1hcnknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRhd2FpdCByZXZlYWxVbnRpdGxlZFByb2Nlc3NGb2xkKGxlbnMsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGNvbnN0IGZvbGQgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnW2RhdGEtcHJvY2Vzcy1mb2xkXScpO1xuXHRcdGFzc2VydC5vayhmb2xkKTtcblx0XHRjb25zdCBoZWFkZXIgPSBmb2xkIS5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC1oZWFkZXInKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaGVhZGVyLmdldEF0dHJpYnV0ZSgnYXJpYS1leHBhbmRlZCcpLCAnZmFsc2UnKTtcblx0XHRhc3NlcnQub2soaGVhZGVyLnRleHRDb250ZW50Py5pbmNsdWRlcygnU3R1YicpKTtcblx0XHRhc3NlcnQub2soaGVhZGVyLnRleHRDb250ZW50Py5pbmNsdWRlcygnNCBzdGVwcycpKTtcblx0XHRjb25zdCBjaGlsZHJlbiA9IGZvbGQhLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLWNoaWxkcmVuJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoaWxkcmVuLmhpZGRlbiwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlsZHJlbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtLWNvbGxhcHNlZCcpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwYW5kaW5nIHVudGl0bGVkIHByb2Nlc3MgZm9sZCByZXZlYWxzIG5lc3RlZCB0aGlua2luZyBhbmQgdG9vbCBpbmRlbnQgbGF5ZXJzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgbGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0YXdhaXQgcmV2ZWFsVW50aXRsZWRQcm9jZXNzRm9sZChsZW5zLCBsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblx0XHRjb25zdCBmb2xkID0gcXVlcnlUaW1lbGluZShzbG90cywgJ1tkYXRhLXByb2Nlc3MtZm9sZF0nKSE7XG5cdFx0Y29uc3QgaGVhZGVyID0gZm9sZC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC1oZWFkZXInKSBhcyBIVE1MRWxlbWVudDtcblx0XHRoZWFkZXIuY2xpY2soKTtcblxuXHRcdGNvbnN0IGNoaWxkcmVuID0gZm9sZC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC1jaGlsZHJlbicpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlsZHJlbi5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW4uY2xhc3NMaXN0LmNvbnRhaW5zKCdjb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLS1jb2xsYXBzZWQnKSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgdGhpbmtpbmdCbG9ja3MgPSBmb2xkLnF1ZXJ5U2VsZWN0b3JBbGwoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRoaW5raW5nJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaW5raW5nQmxvY2tzLmxlbmd0aCwgMik7XG5cdFx0Y29uc3Qgc2libGluZ1Rvb2xzID0gZm9sZC5xdWVyeVNlbGVjdG9yQWxsKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC1jaGlsZHJlbiA+IC5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRvb2wnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2libGluZ1Rvb2xzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGQucXVlcnlTZWxlY3RvckFsbCgnLmNvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtdG9vbC0tbmVzdGVkJykubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm9sZC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10aGlua2luZyAuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10b29sJyksIG51bGwpO1xuXHRcdGNvbnN0IGRyYWZ0SGVhZGVyID0gZm9sZC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10aGlua2luZ1tkYXRhLXR1cm4taWQ9XCJ1bnRpdGxlZC10MlwiXSAuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10aGlua2luZy1oZWFkZXInKTtcblx0XHRhc3NlcnQub2soZHJhZnRIZWFkZXI/LnRleHRDb250ZW50Py5pbmNsdWRlcygnU3R1YjogZHJhZnQnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFkcmFmdEhlYWRlcj8udGV4dENvbnRlbnQ/LmluY2x1ZGVzKCd3cml0ZScpKTtcblx0XHRhc3NlcnQub2soZHJhZnRIZWFkZXI/LnBhcmVudEVsZW1lbnQ/LmNsYXNzTGlzdC5jb250YWlucygnY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10aGlua2luZy1saW5lJykpO1xuXG5cdFx0Y29uc3QgY2hpbGRyZW5TdHlsZSA9IGdldFdpbmRvdyhjaGlsZHJlbikuZ2V0Q29tcHV0ZWRTdHlsZShjaGlsZHJlbik7XG5cdFx0YXNzZXJ0Lm9rKHBhcnNlRmxvYXQoY2hpbGRyZW5TdHlsZS5wYWRkaW5nSW5saW5lU3RhcnQpID49IDEyKTtcblxuXHRcdGNvbnN0IGZpcnN0VGhpbmtpbmcgPSBmb2xkLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRoaW5raW5nW2RhdGEtdHVybi1pZD1cInVudGl0bGVkLXQxXCJdJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0Y29uc3QgdGhpbmtpbmdIZWFkZXIgPSBmaXJzdFRoaW5raW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRoaW5raW5nLWhlYWRlcicpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlua2luZ0hlYWRlci5nZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnKSwgJ2ZhbHNlJyk7XG5cdFx0YXNzZXJ0Lm9rKGhlYWRlci5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC1jaGV2cm9uJyksICdvdXRlciBwcm9jZXNzIGZvbGQga2VlcHMgdGhlIGRpc2Nsb3N1cmUgY2hldnJvbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlsZHJlbi5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC1jaGV2cm9uLCAuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10b29sLWNoZXZyb24sIC5jb2RpY29uLWNoZXZyb24tcmlnaHQnKSwgbnVsbCk7XG5cdFx0Y29uc3QgcmVhZFRvb2wgPSBmb2xkLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRvb2xbZGF0YS10dXJuLWlkPVwidW50aXRsZWQtdG9vbDFcIl0nKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQub2socmVhZFRvb2wpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWFkVG9vbC5oaWRkZW4sIGZhbHNlKTtcblx0XHRjb25zdCB0b29sSGVhZGVyID0gcmVhZFRvb2wucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtdG9vbC1oZWFkZXInKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQub2sodGhpbmtpbmdIZWFkZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkud2lkdGggPiAwLCAndGhpbmtpbmcgaGVhZGVyIGhhcyBubyBsYXlvdXQgd2lkdGgnKTtcblx0XHRhc3NlcnQub2soTWF0aC5hYnModGhpbmtpbmdIZWFkZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdCAtIHRvb2xIZWFkZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdCkgPD0gMiwgYHRvb2wgaGVhZGVyIGxlZnQgJHt0b29sSGVhZGVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmxlZnR9IHZzIHRoaW5raW5nIGhlYWRlciBsZWZ0ICR7dGhpbmtpbmdIZWFkZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkubGVmdH1gKTtcblx0fSk7XG5cblx0dGVzdCgndXNlciBhbmQgY29uZmlybWF0aW9uIHNlYXRzIHN0YXkgb3V0c2lkZSBwcm9jZXNzIGZvbGQgb24gdW50aXRsZWQgZml4dHVyZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGF3YWl0IHJldmVhbFVudGl0bGVkUHJvY2Vzc0ZvbGQobGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cdFx0Y29uc3QgZm9sZCA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICdbZGF0YS1wcm9jZXNzLWZvbGRdJykhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb2xkLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuW2RhdGEta2luZD1cInVzZXJcIl0nKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvbGQucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLWNvbmZpcm1hdGlvbi1zZWF0JyksIG51bGwpO1xuXHRcdGF3YWl0IHJldmVhbFZpc3VhbGl6ZVR1cm4obGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbiwgJ3VudGl0bGVkLXUxJyk7XG5cdFx0YXNzZXJ0Lm9rKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtdHVybltkYXRhLWtpbmQ9XCJ1c2VyXCJdJykpO1xuXHRcdGF3YWl0IHJldmVhbFZpc3VhbGl6ZVR1cm4obGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbiwgJ3VudGl0bGVkLWMxJyk7XG5cdFx0YXNzZXJ0Lm9rKHF1ZXJ5VGltZWxpbmUoc2xvdHMsICcuY29udmVyc2F0aW9uLWxlbnMtY29uZmlybWF0aW9uLXNlYXQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4cGFuZGluZyB1bnRpdGxlZCB0aGlua2luZyByZXZlYWxzIFN0dWIgcGF5bG9hZCBib2R5IGRpc3RpbmN0IGZyb20gaGVhZGVyIHN1bW1hcnknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zLCBsYXlvdXRSZWFkaW5nQ29sdW1uIH0gPSBtb3VudExlbnMoKTtcblx0XHRjb25zdCBzbG90cyA9IGdldExlbnNTbG90cyhwYXJ0KTtcblx0XHRhd2FpdCByZXZlYWxVbnRpdGxlZFByb2Nlc3NGb2xkKGxlbnMsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGNvbnN0IGZvbGQgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnW2RhdGEtcHJvY2Vzcy1mb2xkXScpITtcblx0XHQoZm9sZC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC1oZWFkZXInKSBhcyBIVE1MRWxlbWVudCkuY2xpY2soKTtcblxuXHRcdGNvbnN0IGZpcnN0VGhpbmtpbmcgPSBmb2xkLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRoaW5raW5nW2RhdGEtdHVybi1pZD1cInVudGl0bGVkLXQxXCJdJykhO1xuXHRcdGNvbnN0IHRoaW5raW5nSGVhZGVyID0gZmlyc3RUaGlua2luZy5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10aGlua2luZy1oZWFkZXInKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQub2sodGhpbmtpbmdIZWFkZXIudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdTdHViOiBvdXRsaW5lIHNlY3Rpb25zJykpO1xuXG5cdFx0dGhpbmtpbmdIZWFkZXIuY2xpY2soKTtcblxuXHRcdGNvbnN0IGJvZHkgPSBmaXJzdFRoaW5raW5nLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRoaW5raW5nLWJvZHknKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYm9keS5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYm9keS5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtLWNvbGxhcHNlZCcpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKGJvZHkudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdTdHViOiBDb25zaWRlciBpbnRybycpKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoYm9keS50ZXh0Q29udGVudCwgdGhpbmtpbmdIZWFkZXIudGV4dENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHBhbmRpbmcgdW50aXRsZWQgdG9vbCByb3cgcmV2ZWFscyBTdHViIHBheWxvYWQgdGV4dCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB7IHBhcnQsIGxlbnMsIGxheW91dFJlYWRpbmdDb2x1bW4gfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGF3YWl0IHJldmVhbFVudGl0bGVkUHJvY2Vzc0ZvbGQobGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbik7XG5cdFx0Y29uc3QgZm9sZCA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICdbZGF0YS1wcm9jZXNzLWZvbGRdJykhO1xuXHRcdChmb2xkLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLWhlYWRlcicpIGFzIEhUTUxFbGVtZW50KS5jbGljaygpO1xuXG5cdFx0Y29uc3QgcmVhZFRvb2wgPSBmb2xkLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRvb2xbZGF0YS10dXJuLWlkPVwidW50aXRsZWQtdG9vbDFcIl0nKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlYWRUb29sLmNsb3Nlc3QoJy5jb252ZXJzYXRpb24tcHJvY2Vzcy1mb2xkLXRoaW5raW5nJyksIG51bGwpO1xuXHRcdGNvbnN0IHRvb2xIZWFkZXIgPSByZWFkVG9vbC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10b29sLWhlYWRlcicpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5vayh0b29sSGVhZGVyLnRleHRDb250ZW50Py5pbmNsdWRlcygncmVhZCcpKTtcblx0XHRhc3NlcnQub2sodG9vbEhlYWRlci50ZXh0Q29udGVudD8uaW5jbHVkZXMoJ1N0dWI6IFJFQURNRS5tZCcpKTtcblxuXHRcdHRvb2xIZWFkZXIuY2xpY2soKTtcblxuXHRcdGNvbnN0IHBheWxvYWQgPSByZWFkVG9vbC5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXByb2Nlc3MtZm9sZC10b29sLWJvZHknKSBhcyBIVE1MRWxlbWVudDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGF5bG9hZC5oaWRkZW4sIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGF5bG9hZC5jbGFzc0xpc3QuY29udGFpbnMoJ2NvbnZlcnNhdGlvbi1wcm9jZXNzLWZvbGQtLWNvbGxhcHNlZCcpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Lm9rKHBheWxvYWQudGV4dENvbnRlbnQ/LmluY2x1ZGVzKCdTdHViOiAjIFByb2plY3QnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Bpbm5lZCB1c2VyIHByb21wdCBjb3B5IHdyaXRlcyBmdWxsIHRleHQgYW5kIGV4cG9zZXMgbm8gUXVvdGUgRWRpdCBvciBSZWdlbmVyYXRlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgxNTAwMCk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBsZW5zLCBzdHViU2VydmljZSwgY2xpcGJvYXJkU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gc3R1YlNlcnZpY2UuY3JlYXRlU2Vzc2lvbigpO1xuXHRcdGNvbnN0IHVzZXJUZXh0ID0gdXNlck1lc3NhZ2VMaW5lcyg4KTtcblxuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFVzZXJUdXJuKHNlc3Npb25JZCwgdXNlclRleHQpO1xuXHRcdHN0dWJTZXJ2aWNlLmFwcGVuZFN0dWJFY2hvQXNzaXN0YW50KHNlc3Npb25JZCwgdXNlck1lc3NhZ2VMaW5lcyg0MCkpO1xuXHRcdGxheW91dFJlYWRpbmdDb2x1bW4oKTtcblx0XHRhd2FpdCBmbHVzaFRpbWVsaW5lSGVpZ2h0VXBkYXRlcygpO1xuXHRcdGF3YWl0IHNjcm9sbFRpbWVsaW5lQXdheUZyb21QaW5uZWRSZWFkKGxlbnMsIHNsb3RzLCBsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblxuXHRcdGNvbnN0IHBpbm5lZEhvc3QgPSBnZXRQaW5uZWRVc2VyUHJvbXB0KHNsb3RzKTtcblx0XHRhc3NlcnQub2socGlubmVkSG9zdD8uY2xhc3NMaXN0LmNvbnRhaW5zKCdjb252ZXJzYXRpb24tdGltZWxpbmUtcGlubmVkLXVzZXItLXZpc2libGUnKSk7XG5cblx0XHRjb25zdCBjb3B5QnV0dG9uID0gcGlubmVkSG9zdCEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi10aW1lbGluZS1waW5uZWQtdXNlci1jb3B5IC5tb25hY28tYnV0dG9uJykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvcHlCdXR0b24uZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJyksIGNvbnZlcnNhdGlvbkxlbnNQaW5uZWRVc2VyUHJvbXB0Q29weUFyaWEpO1xuXHRcdGNvcHlCdXR0b24uY2xpY2soKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgY2xpcGJvYXJkU2VydmljZS5yZWFkVGV4dCgpLCB1c2VyVGV4dC5yZXBsYWNlKC9cXG4vZywgJyAnKS5yZXBsYWNlKC9cXHMrL2csICcgJykudHJpbSgpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwaW5uZWRIb3N0IS5xdWVyeVNlbGVjdG9yKCdbYXJpYS1sYWJlbCo9XCJRdW90ZVwiXScpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGlubmVkSG9zdCEucXVlcnlTZWxlY3RvcignW2FyaWEtbGFiZWwqPVwiRWRpdFwiXScpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGlubmVkSG9zdCEucXVlcnlTZWxlY3RvcignW2FyaWEtbGFiZWwqPVwiUmVnZW5lcmF0ZVwiXScpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGlubmVkSG9zdCEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi1sZW5zLXR1cm4tYWN0aW9ucycpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgndmlzdWFsaXplIHNlZWQgc2Vzc2lvbiByZW5kZXJzIHR3byB2aXN1YWxpemF0aW9uIGNhcmRzIHdpdGhvdXQgQWdlbnQgaGVhZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHsgcGFydCwgc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4sIGxlbnMgfSA9IG1vdW50TGVucygpO1xuXHRcdGNvbnN0IHNsb3RzID0gZ2V0TGVuc1Nsb3RzKHBhcnQpO1xuXHRcdGF3YWl0IHNob3dWaXN1YWxpemVTZWVkKHN0dWJTZXJ2aWNlLCBsYXlvdXRSZWFkaW5nQ29sdW1uKTtcblxuXHRcdGNvbnN0IHByb2plY3RlZCA9IGxlbnMubGFzdEF0dGFjaGVkRW50cmllcy5maWx0ZXIoZW50cnkgPT4gZW50cnkua2luZCA9PT0gJ3Zpc3VhbGl6YXRpb24nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJvamVjdGVkLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChwcm9qZWN0ZWQubWFwKGVudHJ5ID0+IGVudHJ5LmlkKSwgWyd2aXN1YWxpemUtdjEnLCAndmlzdWFsaXplLXYyJ10pO1xuXG5cdFx0Ly8gVmlydHVhbCB3aW5kb3cgbWF5IGxlYXZlIGNvbXBhcmlzb24gdW5hdHRhY2hlZCBhdCB0aGUgZGVmYXVsdCAzNjBweFxuXHRcdC8vIGhlaWdodDsgcmV2ZWFsIHNvIHRoZSBjYXJkIGlzIGluIHRoZSBET00gKGRpYWdyYW0gc3RheXMgY292ZXJlZCBieVxuXHRcdC8vIHRoZSBleHBhbmQgdGVzdCkuXG5cdFx0YXdhaXQgcmV2ZWFsVmlzdWFsaXplVHVybihsZW5zLCBsYXlvdXRSZWFkaW5nQ29sdW1uLCAndmlzdWFsaXplLXYyJyk7XG5cdFx0Y29uc3QgY29tcGFyaXNvbiA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICdbZGF0YS12aXN1YWxpemUtdHlwZT1cImNvbXBhcmlzb25cIl0nKTtcblx0XHRhc3NlcnQub2soY29tcGFyaXNvbik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbXBhcmlzb24hLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWhlYWRlcicpLCBudWxsKTtcblx0XHRhc3NlcnQub2soY29tcGFyaXNvbiEucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi12aXN1YWxpemUtb3B0aW9uW2RhdGEtcmVjb21tZW5kZWQ9XCJ0cnVlXCJdJykpO1xuXHR9KTtcblxuXHR0ZXN0KCd2aXN1YWxpemUgY2FyZCBoZWFkZXIgY29sbGFwc2VzIGFuZCBleHBhbmRzIGJvZHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiwgbGVucyB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0YXdhaXQgc2hvd1Zpc3VhbGl6ZVNlZWQoc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGF3YWl0IHJldmVhbFZpc3VhbGl6ZVR1cm4obGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbiwgJ3Zpc3VhbGl6ZS12MicpO1xuXG5cdFx0Y29uc3QgaGVhZGVyID0gcXVlcnlUaW1lbGluZShzbG90cywgJ1tkYXRhLXZpc3VhbGl6ZS10eXBlPVwiY29tcGFyaXNvblwiXSAuY29udmVyc2F0aW9uLXZpc3VhbGl6ZS1oZWFkZXInKSBhcyBIVE1MQnV0dG9uRWxlbWVudDtcblx0XHRjb25zdCBib2R5ID0gcXVlcnlUaW1lbGluZShzbG90cywgJ1tkYXRhLXZpc3VhbGl6ZS10eXBlPVwiY29tcGFyaXNvblwiXSAuY29udmVyc2F0aW9uLXZpc3VhbGl6ZS1ib2R5JykgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0YXNzZXJ0Lm9rKGhlYWRlcik7XG5cdFx0YXNzZXJ0Lm9rKGJvZHkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChib2R5LmhpZGRlbiwgZmFsc2UpO1xuXG5cdFx0aGVhZGVyLmNsaWNrKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJvZHkuaGlkZGVuLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgndmlzdWFsaXplIGRpYWdyYW0gZXhwYW5kIG9wZW5zIG92ZXJsYXkgZGlhbG9nIGNsb3NlZCBieSBFc2NhcGUgYW5kIHNlc3Npb24gc3dpdGNoJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHRoaXMudGltZW91dCgxNTAwMCk7XG5cdFx0Y29uc3QgeyBwYXJ0LCBzdHViU2VydmljZSwgbGF5b3V0UmVhZGluZ0NvbHVtbiwgb3BlbkluRWRpdG9yQ2FsbHMsIGxheW91dENvbnRhaW5lciwgbGVucyB9ID0gbW91bnRMZW5zKCk7XG5cdFx0Y29uc3Qgc2xvdHMgPSBnZXRMZW5zU2xvdHMocGFydCk7XG5cdFx0YXdhaXQgc2hvd1Zpc3VhbGl6ZVNlZWQoc3R1YlNlcnZpY2UsIGxheW91dFJlYWRpbmdDb2x1bW4pO1xuXHRcdGF3YWl0IHJldmVhbFZpc3VhbGl6ZVR1cm4obGVucywgbGF5b3V0UmVhZGluZ0NvbHVtbiwgJ3Zpc3VhbGl6ZS12MScpO1xuXG5cdFx0Y29uc3QgZGlhZ3JhbSA9IHF1ZXJ5VGltZWxpbmUoc2xvdHMsICdbZGF0YS12aXN1YWxpemUtdHlwZT1cImRpYWdyYW1cIl0nKTtcblx0XHRhc3NlcnQub2soZGlhZ3JhbSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpYWdyYW0hLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tbGVucy10dXJuLWhlYWRlcicpLCBudWxsKTtcblx0XHRjb25zdCBzb3VyY2UgPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAncHJlW2RhdGEtbWVybWFpZC1zb3VyY2VdLCBbZGF0YS1tZXJtYWlkLWhvc3RdJyk7XG5cdFx0YXNzZXJ0Lm9rKHNvdXJjZSk7XG5cdFx0Y29uc3Qgc291cmNlVGV4dCA9IHNvdXJjZSEudGV4dENvbnRlbnQgPz8gJyc7XG5cdFx0aWYgKHNvdXJjZSEubWF0Y2hlcygncHJlW2RhdGEtbWVybWFpZC1zb3VyY2VdJykpIHtcblx0XHRcdGFzc2VydC5vayhzb3VyY2VUZXh0LmluY2x1ZGVzKCdcdTUxQkJcdTdFRDMnKSk7XG5cdFx0XHRhc3NlcnQub2soc291cmNlVGV4dC5pbmNsdWRlcygnXHU4RkRCXHU4ODRDXHU0RTJEJykpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNvdXJjZVRleHQuaW5jbHVkZXMoJ1x1NjcyQVx1N0FDQlx1OTg3OScpKTtcblx0XHR9XG5cblx0XHRjb25zdCBleHBhbmRCdXR0b24gPSBxdWVyeVRpbWVsaW5lKHNsb3RzLCAnW2RhdGEtdmlzdWFsaXplLXR5cGU9XCJkaWFncmFtXCJdIC5jb252ZXJzYXRpb24tdmlzdWFsaXplLWV4cGFuZCcpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xuXHRcdGFzc2VydC5vayhleHBhbmRCdXR0b24pO1xuXHRcdGV4cGFuZEJ1dHRvbi5jbGljaygpO1xuXG5cdFx0YXNzZXJ0Lm9rKGxheW91dENvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcuY29udmVyc2F0aW9uLXZpc3VhbGl6ZS1vdmVybGF5W3JvbGU9XCJkaWFsb2dcIl0nKSk7XG5cblx0XHRjb25zdCBkaWFsb2cgPSBsYXlvdXRDb250YWluZXIucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi12aXN1YWxpemUtb3ZlcmxheScpIGFzIEhUTUxFbGVtZW50O1xuXHRcdGFzc2VydC5vayhzbG90cy50aW1lbGluZS5jb250YWlucyhkaWFsb2cpKTtcblx0XHRhc3NlcnQub2soIXNsb3RzLmRvY2suY29udGFpbnMoZGlhbG9nKSk7XG5cdFx0ZGlhbG9nLmRpc3BhdGNoRXZlbnQobmV3IEtleWJvYXJkRXZlbnQoJ2tleWRvd24nLCB7IGtleUNvZGU6IEtleUNvZGUuRXNjYXBlLCBidWJibGVzOiB0cnVlIH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGF5b3V0Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tdmlzdWFsaXplLW92ZXJsYXlbcm9sZT1cImRpYWxvZ1wiXScpLCBudWxsKTtcblxuXHRcdGV4cGFuZEJ1dHRvbi5jbGljaygpO1xuXHRcdGFzc2VydC5vayhsYXlvdXRDb250YWluZXIucXVlcnlTZWxlY3RvcignLmNvbnZlcnNhdGlvbi12aXN1YWxpemUtb3ZlcmxheVtyb2xlPVwiZGlhbG9nXCJdJykpO1xuXG5cdFx0c3R1YlNlcnZpY2Uuc3dpdGNoU2Vzc2lvbigndW50aXRsZWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGF5b3V0Q29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJy5jb252ZXJzYXRpb24tdmlzdWFsaXplLW92ZXJsYXlbcm9sZT1cImRpYWxvZ1wiXScpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlbkluRWRpdG9yQ2FsbHMuY291bnQsIDApO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBRW5CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZUFBZTtBQUN4QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLCtDQUErQztBQUN4RCxTQUFTLHdCQUFnRDtBQUN6RCxTQUFTLGFBQWE7QUFDdEIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxtQkFBbUIscUNBQXFDO0FBQ2pFLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsa0JBQWtCLHVDQUF1QztBQUNsRSxTQUFTLDRDQUE0QztBQUNyRCxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLG9DQUFvQyxvQ0FBb0Msc0NBQXNDO0FBRXZIO0FBQUEsRUFDQztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsT0FDTTtBQUNQLFNBQVMsc0NBQXNDLGlEQUFpRCxpQ0FBaUMsc0NBQXNDLGlEQUFpRDtBQUN4TjtBQUFBLEVBQ0M7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxF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QUFHLE1BQU07QUFDaEIsV0FBTyxHQUFHLElBQUk7QUFDZCxXQUFPLFlBQVksS0FBSyxRQUFRLEtBQUs7QUFFckMsV0FBTyxNQUFNO0FBQ2IsV0FBTyxZQUFZLEtBQUssUUFBUSxJQUFJO0FBQUEsRUFDckMsQ0FBQztBQUVELE9BQUsscUZBQXFGLGlCQUFrQjtBQUMzRyxTQUFLLFFBQVEsSUFBSztBQUNsQixVQUFNLEVBQUUsTUFBTSxhQUFhLHFCQUFBQSxzQkFBcUIsbUJBQW1CLGlCQUFpQixLQUFLLElBQUksVUFBVTtBQUN2RyxVQUFNLFFBQVEsYUFBYSxJQUFJO0FBQy9CLFVBQU0sa0JBQWtCLGFBQWFBLG9CQUFtQjtBQUN4RCxVQUFNLG9CQUFvQixNQUFNQSxzQkFBcUIsY0FBYztBQUVuRSxVQUFNLFVBQVUsY0FBYyxPQUFPLGlDQUFpQztBQUN0RSxXQUFPLEdBQUcsT0FBTztBQUNqQixXQUFPLFlBQVksUUFBUyxjQUFjLGdDQUFnQyxHQUFHLElBQUk7QUFDakYsVUFBTSxTQUFTLGNBQWMsT0FBTywrQ0FBK0M7QUFDbkYsV0FBTyxHQUFHLE1BQU07QUFDaEIsVUFBTSxhQUFhLE9BQVEsZUFBZTtBQUMxQyxRQUFJLE9BQVEsUUFBUSwwQkFBMEIsR0FBRztBQUNoRCxhQUFPLEdBQUcsV0FBVyxTQUFTLGNBQUksQ0FBQztBQUNuQyxhQUFPLEdBQUcsV0FBVyxTQUFTLG9CQUFLLENBQUM7QUFDcEMsYUFBTyxHQUFHLFdBQVcsU0FBUyxvQkFBSyxDQUFDO0FBQUEsSUFDckM7QUFFQSxVQUFNLGVBQWUsY0FBYyxPQUFPLGdFQUFnRTtBQUMxRyxXQUFPLEdBQUcsWUFBWTtBQUN0QixpQkFBYSxNQUFNO0FBRW5CLFdBQU8sR0FBRyxnQkFBZ0IsY0FBYyxnREFBZ0QsQ0FBQztBQUV6RixVQUFNLFNBQVMsZ0JBQWdCLGNBQWMsaUNBQWlDO0FBQzlFLFdBQU8sR0FBRyxNQUFNLFNBQVMsU0FBUyxNQUFNLENBQUM7QUFDekMsV0FBTyxHQUFHLENBQUMsTUFBTSxLQUFLLFNBQVMsTUFBTSxDQUFDO0FBQ3RDLFdBQU8sY0FBYyxJQUFJLGNBQWMsV0FBVyxFQUFFLFNBQVMsUUFBUSxRQUFRLFNBQVMsS0FBSyxDQUFDLENBQUM7QUFDN0YsV0FBTyxZQUFZLGdCQUFnQixjQUFjLGdEQUFnRCxHQUFHLElBQUk7QUFFeEcsaUJBQWEsTUFBTTtBQUNuQixXQUFPLEdBQUcsZ0JBQWdCLGNBQWMsZ0RBQWdELENBQUM7QUFFekYsZ0JBQVksY0FBYyxVQUFVO0FBQ3BDLFdBQU8sWUFBWSxnQkFBZ0IsY0FBYyxnREFBZ0QsR0FBRyxJQUFJO0FBQ3hHLFdBQU8sWUFBWSxrQkFBa0IsT0FBTyxDQUFDO0FBQUEsRUFDOUMsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbImxheW91dFJlYWRpbmdDb2x1bW4iLCAicGFyZW50IiwgImxheW91dCIsICJzZXNzaW9uSWQiLCAiZXZlbnQiXQp9Cg==
