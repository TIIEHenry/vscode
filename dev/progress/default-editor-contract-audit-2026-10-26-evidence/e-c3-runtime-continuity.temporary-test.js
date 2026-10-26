import assert from "assert";
import { DeferredPromise, timeout } from "../../../../../base/common/async.js";
import { errorHandler, setUnexpectedErrorHandler } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { createUnknownConversationEntryCapability } from "../../../../../platform/universeAgent/common/universeAgentCapabilities.js";
import { TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { ConversationEngineRosterService, ENGINE_BIND_FAILED_SESSION_ID, isEngineRosterPlaceholderSessionId } from "../../browser/conversationEngineRosterService.js";
import { setConversationStubNextTurnId } from "../../browser/conversationStubModel.js";
import { postBound } from "../../browser/conversationLensComposer.js";
import { resolveConfirmation, resolveQuestion, respondClientTool } from "../../browser/conversationLensSessionBinding.js";
import { isReadingColumnWritesEnabled } from "../../browser/conversationLensReadingColumn.js";
import { CONVERSATION_ROSTER_STORAGE_KEY } from "../../browser/conversationRosterStorage.js";
import { createConversationProjectionCache, projectSnapshotToEntries, stubTurnsToSnapshot } from "../../browser/conversationSessionView.js";
import { isConversationEngineLive, isConversationPairingHold } from "../../browser/conversationSessionStatus.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { IWebviewService } from "../../../webview/browser/webview.js";
import { ConversationTimelineHost } from "../../browser/conversationTimelineHost.js";
class MockUniverseAgentConnection extends Disposable {
  constructor() {
    super(...arguments);
    this.onDidFileMutation = Event.None;
    this.onDidTurnSettle = Event.None;
    this.onDidChangeTeamRuntime = Event.None;
    this.team = {
      memberStatus: async () => [],
      taskList: async () => [],
      teamInfo: async () => void 0
    };
    this.connected = false;
    this.pairingPending = false;
    this.sessions = [];
    this._onDidChangeConnection = new Emitter();
    this.onDidChangeConnection = this._onDidChangeConnection.event;
    this.getQueueCalls = [];
    this.listSessionsCalls = [];
    this.renameCalls = [];
    this.createCalls = [];
    this.createSessionResult = { sessionId: "ua-new" };
    this.treeRefreshCalls = [];
    this.deleteCalls = [];
    this.renameResult = { ok: true };
    this.cancelCalls = [];
    this.writeResult = { ok: true };
    this.setGoalCalls = [];
    this.setGoalResult = { ok: true };
    this.cancelGoalCalls = [];
    this.cancelGoalResult = { ok: true };
    this.forkCalls = [];
    this.killCalls = [];
    this.createSnapshotCalls = [];
    this.editMessageCalls = [];
    this.cancelToolCallCalls = [];
    this.continuationOpens = [];
    this.deleteMessageCalls = [];
    this.respondPermissionCalls = [];
    this.sendClientToolResponseCalls = [];
    this.respondQuestionCalls = [];
    this.enqueueCalls = [];
    this.queueResult = { ok: true };
    this.pauseQueueCalls = [];
    this.resumeQueueCalls = [];
    this.clearQueueCalls = [];
    this.holdQueueCalls = [];
    this.releaseQueueCalls = [];
    this.editQueueCalls = [];
    this.retryQueueItemCalls = [];
    this.retryQueueItemUploadCalls = [];
  }
  enableQueueReadback(fetch) {
    this.publishedEngineIdentityId = "queue-engine";
    this.publishedLinkId = 1;
    this.getQueue = async (request) => {
      this.getQueueCalls.push(request.sessionId);
      return fetch ? fetch(request.sessionId) : { items: [], isPaused: false, isProcessing: false, pauseReason: "NONE", version: "0" };
    };
  }
  setConnected(value) {
    this.connected = value;
    if (value) {
      this.explicitPhase = void 0;
    }
    this._onDidChangeConnection.fire(this.getConnectionSnapshot());
  }
  /** One snapshot: identity, link id, and connected flag change together. */
  setPublishedLink(engineIdentityId, linkId, connected) {
    this.publishedEngineIdentityId = engineIdentityId && engineIdentityId.length > 0 ? engineIdentityId : void 0;
    this.publishedLinkId = typeof linkId === "number" && linkId > 0 ? linkId : void 0;
    this.connected = connected;
    this._onDidChangeConnection.fire(this.getConnectionSnapshot());
  }
  setPairingPending(value) {
    this.pairingPending = value;
    if (!value) {
      this.explicitPhase = void 0;
    }
    this._onDidChangeConnection.fire(this.getConnectionSnapshot());
  }
  /** Production pairing snapshot: connecting phase + pairingPending, not engine-connected. */
  setPairingConnectingPhase(reason = "initial") {
    this.pairingPending = true;
    this.connected = false;
    this.explicitPhase = { kind: "connecting", reason };
    this._onDidChangeConnection.fire(this.getConnectionSnapshot());
  }
  setListSessions(sessions) {
    this.sessions = sessions;
  }
  isEngineConnected() {
    return this.connected && !this.pairingPending;
  }
  getTransportState() {
    return "ok";
  }
  getConnectionPhase() {
    if (this.explicitPhase) {
      return this.explicitPhase;
    }
    return this.connected ? { kind: "connected", path: "loopback" } : { kind: "disconnected" };
  }
  getConnectionSnapshot() {
    return {
      transport: "ok",
      authenticated: this.connected,
      pairingPending: this.pairingPending,
      channelAlive: this.connected,
      sharedFsRootSent: false,
      capabilities: {},
      ...this.getQueue ? { conversationEntryCapability: { ...createUnknownConversationEntryCapability(), getQueue: "SUPPORTED" } } : {},
      ...this.publishedEngineIdentityId ? { engineIdentityId: this.publishedEngineIdentityId } : {},
      ...this.publishedLinkId !== void 0 ? { linkId: this.publishedLinkId } : {}
    };
  }
  getCapabilitySnapshot() {
    return this.getConnectionSnapshot().capabilities;
  }
  requestAgentTreeRefresh(sessionId) {
    this.treeRefreshCalls.push(sessionId ?? "");
  }
  getNavigatorCapability() {
    return "UNKNOWN";
  }
  isAgentTreeFetchFailed() {
    return false;
  }
  async connect() {
    return { methods: [], events: [], sessionToken: "tok" };
  }
  async connectProfile() {
    return { ok: false, code: "transport_failed", reason: "stub" };
  }
  async confirmPairing() {
    return { ok: false, code: "transport_failed", reason: "stub" };
  }
  async cancelPairing() {
  }
  async probeConnectionProfile() {
    return { ok: false, code: "transport_failed", reason: "stub" };
  }
  async disconnect() {
    this.setConnected(false);
  }
  async listSessions() {
    this.listSessionsCalls.push({});
    if (this.listSessionsError) {
      throw this.listSessionsError;
    }
    return {
      sessions: this.sessions.map((s) => ({
        sessionId: s.sessionId,
        title: s.title,
        ...s.workDir ? { workDir: s.workDir } : {}
      }))
    };
  }
  async createSession(request) {
    this.createCalls.push({ title: request.title, clientSessionId: request.clientSessionId });
    if (this.createSessionError) {
      throw this.createSessionError;
    }
    return this.createSessionResult;
  }
  async deleteSession(request) {
    this.deleteCalls.push({ sessionId: request.sessionId });
    if (this.deleteSessionGate) {
      await this.deleteSessionGate;
    }
    if (this.deleteError) {
      throw this.deleteError;
    }
  }
  async renameSession(request) {
    this.renameCalls.push({ sessionId: request.sessionId, title: request.title });
    if (this.renameError) {
      throw this.renameError;
    }
    return this.renameResult;
  }
  async resolveWriteResult(success) {
    if (this.writePending) {
      return this.writePending;
    }
    if (this.writeError) {
      throw this.writeError;
    }
    if (this.writeResult.ok === false) {
      return this.writeResult;
    }
    return success;
  }
  async cancelGeneration(request) {
    this.cancelCalls.push({ sessionId: request.sessionId, agentId: request.agentId });
    return this.resolveWriteResult({ ok: true });
  }
  async setSessionGoal(request) {
    this.setGoalCalls.push({ sessionId: request.sessionId, goal: request.goal });
    if (this.setGoalError) {
      throw this.setGoalError;
    }
    return this.setGoalResult;
  }
  async cancelSessionGoal(request) {
    this.cancelGoalCalls.push({ sessionId: request.sessionId });
    if (this.cancelGoalError) {
      throw this.cancelGoalError;
    }
    return this.cancelGoalResult;
  }
  async forkAgent(request) {
    this.forkCalls.push({
      sessionId: request.sessionId,
      parentAgentId: request.parentAgentId,
      name: request.name,
      task: request.task
    });
    return this.resolveWriteResult({ ok: true, agentId: "sub:reviewer" });
  }
  async createSnapshot(request) {
    this.createSnapshotCalls.push({
      sessionId: request.sessionId,
      title: request.title,
      description: request.description
    });
    return this.resolveWriteResult({ ok: true });
  }
  async killAgent(request) {
    this.killCalls.push({
      sessionId: request.sessionId,
      agentId: request.agentId,
      force: request.force
    });
    return this.resolveWriteResult({ ok: true });
  }
  async editMessage(request) {
    this.editMessageCalls.push({
      sessionId: request.sessionId,
      turnId: request.turnId,
      newContent: request.newContent,
      agentId: request.agentId
    });
    return this.resolveWriteResult({ ok: true });
  }
  async cancelToolCall(request) {
    this.cancelToolCallCalls.push({
      sessionId: request.sessionId,
      agentId: request.agentId,
      toolCallId: request.toolCallId
    });
    return this.resolveWriteResult({ ok: true });
  }
  openContinuationStream(request) {
    this.continuationOpens.push({
      sessionId: request.sessionId,
      agentId: request.agentId,
      turnId: request.turnId,
      messageId: request.messageId
    });
    return { dispose: () => {
    } };
  }
  async deleteMessage(request) {
    this.deleteMessageCalls.push({
      sessionId: request.sessionId,
      turnId: request.turnId,
      agentId: request.agentId
    });
    return this.resolveWriteResult({ ok: true });
  }
  async respondPermission(request) {
    this.respondPermissionCalls.push({
      sessionId: request.sessionId,
      requestId: request.requestId,
      granted: request.granted
    });
    return this.resolveWriteResult({ ok: true });
  }
  async sendClientToolResponse(request) {
    this.sendClientToolResponseCalls.push({
      sessionId: request.sessionId,
      callId: request.callId,
      content: request.content,
      isError: request.isError,
      metadataJson: request.metadataJson
    });
    return this.resolveWriteResult({ ok: true });
  }
  async respondQuestion(request) {
    this.respondQuestionCalls.push({
      sessionId: request.sessionId,
      questionId: request.questionId,
      answers: request.answers,
      customText: request.customText
    });
    return this.resolveWriteResult({ ok: true });
  }
  async resolveQueueMutation() {
    if (this.queueError) {
      throw this.queueError;
    }
    return this.queueResult;
  }
  async enqueueQueueItem(request) {
    this.enqueueCalls.push({
      sessionId: request.sessionId,
      text: request.text,
      priority: request.priority,
      opId: request.opId
    });
    return this.resolveQueueMutation();
  }
  async pauseQueue(request) {
    this.pauseQueueCalls.push({ sessionId: request.sessionId });
    return this.resolveQueueMutation();
  }
  async resumeQueue(request) {
    this.resumeQueueCalls.push({ sessionId: request.sessionId });
    return this.resolveQueueMutation();
  }
  async clearQueue(request) {
    this.clearQueueCalls.push({ sessionId: request.sessionId });
    return this.resolveQueueMutation();
  }
  async holdQueueItem(request) {
    this.holdQueueCalls.push({ sessionId: request.sessionId, itemId: request.itemId, reason: request.reason });
    return this.resolveQueueMutation();
  }
  async releaseQueueItemHold(request) {
    this.releaseQueueCalls.push({ sessionId: request.sessionId, itemId: request.itemId });
    return this.resolveQueueMutation();
  }
  async editQueueItem(request) {
    this.editQueueCalls.push({ sessionId: request.sessionId, itemId: request.itemId, text: request.text });
    return this.resolveQueueMutation();
  }
  async retryQueueItem(request) {
    this.retryQueueItemCalls.push({ sessionId: request.sessionId, itemId: request.itemId });
    return this.resolveQueueMutation();
  }
  async retryQueueItemUpload(request) {
    this.retryQueueItemUploadCalls.push({ sessionId: request.sessionId, itemId: request.itemId });
    return this.resolveQueueMutation();
  }
  async getHistory() {
    return { envelopes: [] };
  }
  subscribeSessionEventStream(_sessionId, _listener, _onClosed) {
    return { dispose: () => {
    } };
  }
  async chat() {
  }
  async listSkills() {
    return { skills: [] };
  }
  async setSkillEnabled() {
    return { ok: true };
  }
  async getSkillInfo() {
    return { name: "", content: "", source: "unknown", enabled: false };
  }
  async listAgentProfiles() {
    return { profiles: [] };
  }
  async saveAgentProfile(request) {
    return { profile: request.profile };
  }
  async deleteAgentProfile() {
    return { ok: true };
  }
  async resetAgentProfile() {
    return { ok: true };
  }
  async listMcpServers() {
    return { servers: [] };
  }
  async getMcpServerStatuses() {
    return { statuses: [] };
  }
  async getMcpServerTools() {
    return { tools: [] };
  }
  async listPlugins() {
    return { plugins: [] };
  }
  async getPluginInfo() {
    return { summary: { id: "", displayName: "", version: "", source: "", hookCount: 0, status: "unknown" }, hooks: [] };
  }
  async enablePlugin() {
    return { plugin: { id: "", displayName: "", version: "", source: "", hookCount: 0, status: "unknown" } };
  }
  async reloadPlugin() {
    return { plugin: { id: "", displayName: "", version: "", source: "", hookCount: 0, status: "unknown" } };
  }
  async unloadPlugin() {
    return { removedHookCount: 0 };
  }
  async scanNewPlugins() {
    return { newPlugins: [], skippedCount: 0 };
  }
  async toggleMcpServer() {
    return { ok: true };
  }
  async addMcpServer() {
    return { ok: true };
  }
  async updateMcpServer() {
    return { ok: true };
  }
  async removeMcpServer() {
    return { ok: true };
  }
  async listTools() {
    return { tools: [] };
  }
  async listModels() {
    return { models: [] };
  }
  async probeEngine() {
    return { ok: false, reason: "stub" };
  }
}
class MockUniverseAgentSessionView {
  constructor() {
    this.postCalls = [];
  }
  onDynamicDidApplyFrame(_leaseId) {
    return Event.None;
  }
  async acquireLease(sessionId) {
    return `lease:${sessionId}`;
  }
  async whenEngineSessionReady(sessionId) {
    return sessionId;
  }
  async releaseLease() {
  }
  async post(leaseId, msg) {
    this.postCalls.push({ leaseId, msg });
    return { accepted: true, correlation: { id: "mock" } };
  }
  async requestResync() {
  }
  async acknowledge() {
  }
  async requestDetail() {
    return { ok: false, reason: "unavailable" };
  }
}
const LEFTOVER_CACHE_TURN_TEXT = "leftover-cached-turn";
const LEFTOVER_PENDING_REQUEST_ID = "p-leftover";
const LEFTOVER_ENGINE_SYNC = { kind: "closed", reason: "leftover-engine-sync" };
class LeftoverProjectionSessionView extends Disposable {
  constructor(leftoverSync = { kind: "idle" }) {
    super();
    this.leftoverSync = leftoverSync;
    this.postCalls = [];
    this.leaseSeq = 0;
    this.leaseSessions = /* @__PURE__ */ new Map();
    this.emitters = /* @__PURE__ */ new Map();
  }
  onDynamicDidApplyFrame(leaseId) {
    let emitter = this.emitters.get(leaseId);
    if (!emitter) {
      emitter = this._register(new Emitter({
        onDidAddFirstListener: () => {
          queueMicrotask(() => this.emitLeftover(leaseId));
        }
      }));
      this.emitters.set(leaseId, emitter);
    }
    return emitter.event;
  }
  async acquireLease(sessionId) {
    const leaseId = `lease:${sessionId}:${++this.leaseSeq}`;
    this.leaseSessions.set(leaseId, sessionId);
    return leaseId;
  }
  async whenEngineSessionReady(sessionId) {
    return sessionId;
  }
  async releaseLease() {
  }
  async post(leaseId, msg) {
    this.postCalls.push({ leaseId, msg });
    return { accepted: true, correlation: { id: "mock" } };
  }
  async requestResync() {
  }
  async acknowledge() {
  }
  async requestDetail() {
    return { ok: false, reason: "unavailable" };
  }
  emitLeftover(leaseId) {
    const emitter = this.emitters.get(leaseId);
    if (!emitter) {
      return;
    }
    const sessionId = this.leaseSessions.get(leaseId) ?? (leaseId.startsWith("lease:") ? leaseId.slice("lease:".length) : leaseId);
    const projection = stubTurnsToSnapshot(sessionId, [
      { id: "u-leftover", kind: "user", text: LEFTOVER_CACHE_TURN_TEXT },
      { id: LEFTOVER_PENDING_REQUEST_ID, kind: "confirmation", text: "leftover-pending", status: "pending" }
    ]);
    emitter.fire({
      leaseId,
      sessionId,
      applied: { kind: "baseline" },
      frame: {
        frame: {
          leaseId,
          generation: 1,
          frameId: 1,
          version: 1,
          body: { kind: "baseline", snapshot: { ...projection.snapshot, sync: this.leftoverSync } }
        },
        attribution: [...projection.attribution.entries()].map(([itemId, attribution]) => ({
          op: "upsertAttribution",
          itemId,
          attribution
        }))
      }
    });
  }
}
class BaselineProjectionSessionView extends Disposable {
  constructor(snapshotFor) {
    super();
    this.snapshotFor = snapshotFor;
    this.postCalls = [];
    this.acknowledgeCalls = [];
    this.frameCursors = /* @__PURE__ */ new Map();
    this.leaseSeq = 0;
    this.leaseSessions = /* @__PURE__ */ new Map();
    this.emitters = /* @__PURE__ */ new Map();
  }
  onDynamicDidApplyFrame(leaseId) {
    let emitter = this.emitters.get(leaseId);
    if (!emitter) {
      emitter = this._register(new Emitter({
        onDidAddFirstListener: () => {
          queueMicrotask(() => this.emitBaseline(leaseId));
        }
      }));
      this.emitters.set(leaseId, emitter);
    }
    return emitter.event;
  }
  async acquireLease(sessionId) {
    const leaseId = `lease:${sessionId}:${++this.leaseSeq}`;
    this.leaseSessions.set(leaseId, sessionId);
    return leaseId;
  }
  async whenEngineSessionReady(sessionId) {
    return sessionId;
  }
  async releaseLease() {
  }
  async post(leaseId, msg) {
    this.postCalls.push({ leaseId, msg });
    return { accepted: true, correlation: { id: "mock" } };
  }
  async requestResync() {
  }
  async acknowledge(_leaseId, ack) {
    this.acknowledgeCalls.push(ack);
  }
  async requestDetail() {
    return { ok: false, reason: "unavailable" };
  }
  emitPatches(sessionId, patches) {
    for (const [leaseId, heldSessionId] of this.leaseSessions) {
      const cursor = this.frameCursors.get(leaseId);
      if (heldSessionId !== sessionId || !cursor) {
        continue;
      }
      cursor.frameId++;
      cursor.version++;
      this.emitters.get(leaseId)?.fire({
        leaseId,
        sessionId,
        applied: { kind: "patches", changedIds: /* @__PURE__ */ new Set(["sync"]) },
        frame: { frame: { leaseId, ...cursor, body: { kind: "patches", patches } } }
      });
    }
  }
  emitGeneration(snapshot, generation) {
    for (const [leaseId, sessionId] of this.leaseSessions) {
      if (sessionId !== String(snapshot.sessionId)) {
        continue;
      }
      const previous = this.frameCursors.get(leaseId);
      const cursor = { generation, frameId: previous?.generation === generation ? previous.frameId + 1 : 1, version: previous?.generation === generation ? previous.version + 1 : 1 };
      this.frameCursors.set(leaseId, cursor);
      this.emitters.get(leaseId)?.fire({
        leaseId,
        sessionId,
        applied: { kind: "baseline" },
        frame: { frame: { leaseId, ...cursor, body: { kind: "baseline", snapshot } } }
      });
    }
  }
  emitBaseline(leaseId) {
    const emitter = this.emitters.get(leaseId);
    if (!emitter) {
      return;
    }
    const sessionId = this.leaseSessions.get(leaseId) ?? "ua-only";
    this.frameCursors.set(leaseId, { generation: 1, frameId: 1, version: 1 });
    emitter.fire({
      leaseId,
      sessionId,
      applied: { kind: "baseline" },
      frame: {
        frame: {
          leaseId,
          generation: 1,
          frameId: 1,
          version: 1,
          body: { kind: "baseline", snapshot: this.snapshotFor(sessionId) }
        }
      }
    });
  }
}
function permissionAwaitingDecision(id, title) {
  const requestId = id;
  const summary = { kind: "permission", title, permissionKind: "shell" };
  return {
    item: {
      id: requestId,
      orderKey: id,
      summary
    },
    pending: { requestId, summary }
  };
}
function enginePermissionSnapshot(sessionId) {
  const allow = permissionAwaitingDecision("req-allow", "Run tests?");
  const deny = permissionAwaitingDecision("req-deny", "Delete build?");
  return {
    sessionId,
    sync: { kind: "idle" },
    timeline: [allow.item, deny.item],
    overlay: { blocks: [] },
    pendingActions: [allow.pending, deny.pending],
    localPendingSends: []
  };
}
function engineQuestionSnapshot(sessionId) {
  const requestId = "q-ask";
  return {
    sessionId,
    sync: { kind: "idle" },
    timeline: [],
    overlay: { blocks: [] },
    pendingActions: [{
      requestId,
      summary: {
        kind: "question",
        title: "Pick one",
        items: [{ id: "itemA", title: "A", optionsPreview: ["yes", "no"] }],
        answerKeysValid: true,
        optionsPreview: ["yes", "no"]
      }
    }],
    localPendingSends: []
  };
}
async function acquireEngineBaseline(store, snapshotFor, setConnectedOverride = true, storage) {
  const connection = store.add(new MockUniverseAgentConnection());
  const sessionView = store.add(new BaselineProjectionSessionView(snapshotFor));
  connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
  const service = store.add(createService(connection, storage, sessionView));
  connection.setConnected(true);
  if (setConnectedOverride) {
    service.setEngineConnected(true);
  }
  await awaitEngineCatalogRefresh(service);
  const lease = store.add(service.acquireSessionView("ua-only"));
  assert.ok(await lease.whenBindReady?.());
  await timeout(0);
  return { service, connection, sessionView, lease };
}
function responseRecoverySnapshot(sessionId) {
  const permission = enginePermissionSnapshot(sessionId);
  const question = {
    requestId: "q-ask",
    summary: { kind: "question", title: "Pick answers", answerKeysValid: true, items: [
      { id: "radio", title: "Choice", optionsPreview: ["first", "second"] },
      { id: "checks", title: "Several", optionsPreview: ["x", "y"], multiSelect: true },
      { id: "custom", title: "Details", optionsPreview: [], allowCustom: true }
    ] }
  };
  const tool = {
    requestId: "call-ask",
    summary: { kind: "tool", title: "Client response", toolName: "client-answer", status: "pending", respondable: true, argPreview: "{}" }
  };
  return {
    ...permission,
    timeline: [
      ...permission.timeline,
      { id: "q-ask:row", orderKey: "q", summary: question.summary },
      { id: "call-ask", orderKey: "z", summary: tool.summary }
    ],
    pendingActions: [...permission.pendingActions, question, tool]
  };
}
function responseRecoveryHost(store, service, lease) {
  const instantiation = workbenchInstantiationService(void 0, store);
  instantiation.stub(IWebviewService, {
    _serviceBrand: void 0,
    activeWebview: void 0,
    webviews: [],
    onDidChangeActiveWebview: Event.None,
    createWebviewOverlay: () => {
      throw new Error("No webview in response recovery");
    },
    createWebviewElement: () => {
      throw new Error("No webview in response recovery");
    }
  });
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  store.add(toDisposable(() => parent.remove()));
  const host = store.add(instantiation.createInstance(ConversationTimelineHost, parent, {
    getResponseProjection: () => lease.responseProjection,
    onResolveConfirmation: (id, status) => service.resolveConfirmation(lease.sessionId, id, status),
    onQuestionRespond: (_id, requestId, answers, customText) => service.respondQuestion(lease.sessionId, requestId, answers, customText),
    onRespondClientTool: (turn) => service.respondClientTool(lease.sessionId, turn.id, { content: "client result" }),
    contentAdapter: { renderTurnBody: (turn, container) => {
      container.textContent = turn.text;
      return Disposable.None;
    } },
    showLiveChrome: () => true
  }));
  const cache = createConversationProjectionCache();
  const apply = (event) => host.applyEntries(projectSnapshotToEntries(
    lease.snapshot,
    lease.attribution,
    lease.details,
    void 0,
    cache,
    lease.respondFailures,
    { responseProjection: lease.responseProjection }
  ), event);
  store.add(lease.onDidApplyFrame(apply));
  apply({ kind: "baseline" });
  host.revealTurn("call-ask");
  return host;
}
function recoveryAction(host, kind) {
  const selector = kind === "permission" ? '[data-turn-id="req-allow"] .conversation-lens-confirmation-actions .monaco-button' : kind === "question" ? '[data-turn-id="q-ask:row"] .conversation-lens-question-actions .monaco-button' : ".conversation-process-fold-tool-respond";
  const action = host.domNode.querySelector(selector);
  assert.ok(action, `${kind} response control must exist`);
  return action;
}
function responseSeatRoute(store, service, connection, initialLease) {
  const failures = [];
  const posted = [];
  const focused = [];
  const route = {
    isDisposed: false,
    stubService: service,
    uaConnection: connection,
    sessionViewLease: initialLease,
    getBoundSessionId: () => initialLease.sessionId,
    showPostFailure: (reason) => failures.push(reason),
    focusTimelineRecord: (id) => focused.push(id),
    postBound: (message) => {
      posted.push(message);
      return postBound(route, message);
    }
  };
  const binding = route;
  let settled = Promise.resolve();
  const instantiation = workbenchInstantiationService(void 0, store);
  instantiation.stub(IWebviewService, {
    _serviceBrand: void 0,
    activeWebview: void 0,
    webviews: [],
    onDidChangeActiveWebview: Event.None,
    createWebviewOverlay: () => {
      throw new Error("No webview in response seat route");
    },
    createWebviewElement: () => {
      throw new Error("No webview in response seat route");
    }
  });
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  store.add(toDisposable(() => parent.remove()));
  const timeline = store.add(instantiation.createInstance(ConversationTimelineHost, parent, {
    getResponseProjection: () => route.sessionViewLease.responseProjection,
    writesEnabled: () => isReadingColumnWritesEnabled(route),
    showLiveChrome: () => service.isEngineConnected(),
    onResolveConfirmation: (id, status) => {
      settled = resolveConfirmation(binding, id, status);
    },
    onQuestionRespond: (id, requestId, answers, customText) => {
      settled = resolveQuestion(binding, id, requestId, answers, customText);
    },
    onRespondClientTool: (turn) => respondClientTool(binding, turn),
    contentAdapter: { renderTurnBody: (turn, container) => {
      container.textContent = turn.text;
      return Disposable.None;
    } }
  }));
  const lifetime = store.add(new DisposableStore());
  const apply = (event) => {
    const lease = route.sessionViewLease;
    timeline.applyEntries(projectSnapshotToEntries(
      lease.snapshot,
      lease.attribution,
      lease.details,
      void 0,
      void 0,
      lease.respondFailures,
      { responseProjection: lease.responseProjection }
    ), event);
  };
  const rebind = (lease, paint = true) => {
    lifetime.clear();
    route.sessionViewLease = lease;
    lifetime.add(lease.onDidApplyFrame(apply));
    if (paint) {
      apply({ kind: "baseline" });
      timeline.refreshPresentation();
    }
  };
  rebind(initialLease);
  return { timeline, route, binding, failures, posted, focused, rebind, whenSettled: () => settled };
}
async function disconnectedResponseSeat(store) {
  const live = await acquireEngineBaseline(store, responseRecoverySnapshot, false, store.add(new TestStorageService()));
  live.connection.setConnected(false);
  assert.strictEqual(live.service.isEngineConnected(), false);
  assert.strictEqual(live.service.hasEngineConnectionHistory(), true);
  assert.strictEqual(live.service.getSessionSource("ua-only"), "engine-cache");
  const cachedLease = store.add(live.service.acquireSessionView("ua-only"));
  assert.ok(cachedLease.snapshot.pendingActions.some((action) => action.requestId === "req-allow"));
  assert.strictEqual(live.service.getTurns("ua-only").find((turn) => turn.id === "req-allow")?.status, "pending");
  return { ...live, cachedLease };
}
function chooseRecoveryAnswers(host) {
  host.domNode.querySelectorAll('[data-turn-id="q-ask:row"] [role="radio"]')[1].click();
  host.domNode.querySelectorAll('[data-turn-id="q-ask:row"] [role="checkbox"]')[1].click();
  const input = host.domNode.querySelector(".conversation-lens-question-custom");
  assert.ok(input);
  input.value = "keep this answer";
  input.dispatchEvent(new UIEvent("input", { bubbles: true }));
}
function createSessionViewMock(overrides = {}) {
  return {
    _serviceBrand: void 0,
    onDynamicDidApplyFrame: () => Event.None,
    acquireLease: async (sessionId) => `lease:${sessionId}`,
    whenEngineSessionReady: async (sessionId) => sessionId,
    releaseLease: async () => {
    },
    post: async () => ({ accepted: true, correlation: { id: "mock" } }),
    requestResync: async () => {
    },
    acknowledge: async () => {
    },
    requestDetail: async () => ({ ok: false, reason: "unavailable" }),
    ...overrides
  };
}
function createService(connection, storage, sessionView = new MockUniverseAgentSessionView()) {
  const workspaceToolsGate = {
    _serviceBrand: void 0,
    shouldAdvertise: () => true
  };
  return new ConversationEngineRosterService(
    connection,
    sessionView,
    workspaceToolsGate,
    storage
  );
}
async function awaitEngineCatalogRefresh(service) {
  await service.whenEngineCatalogRefreshComplete();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
function stubCachedProjection(service, sessionId, projection) {
  const frameSource = service.engineFrameSource;
  const original = frameSource.getCachedProjection.bind(frameSource);
  frameSource.getCachedProjection = (id) => id === sessionId ? projection : original(id);
}
function projectionWithStreamingAgent(sessionId, agentId) {
  const base = stubTurnsToSnapshot(sessionId, [
    { id: "u1", kind: "user", text: "hi" },
    { id: "a-old", kind: "assistant", text: "old stream" },
    { id: "a-live", kind: "assistant", text: "live stream" }
  ]);
  return {
    snapshot: {
      ...base.snapshot,
      timeline: base.snapshot.timeline.map((item) => {
        if (item.summary.kind !== "text" || String(item.id) !== "a-old" && String(item.id) !== "a-live") {
          return item;
        }
        return { ...item, summary: { ...item.summary, streaming: true } };
      })
    },
    attribution: /* @__PURE__ */ new Map([
      ["u1", { role: "user" }],
      ["a-old", { role: "assistant", agentId: "sub:old" }],
      ["a-live", { role: "assistant", agentId }]
    ]),
    details: base.details
  };
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
suite("ConversationEngineRosterService (M6-A2)", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("appendStubEchoAssistant is rejected while engine connected", () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    assert.throws(
      () => service.appendStubEchoAssistant("ua-1", "nope"),
      /appendStubEchoAssistant is forbidden/
    );
  });
  test("unconnected path still uses stub frame source with stub echo", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const service = store.add(createService(connection));
    const sessionId = service.getActiveSessionId();
    const lease = store.add(service.acquireSessionView(sessionId));
    assert.strictEqual(service.isEngineConnected(), false);
    assert.ok(service.getTurns(sessionId).length > 0, "never-connected seed turns stay readable");
    const before = service.getTurns(sessionId).length;
    const outcome = await lease.post({ kind: "submitInput", text: "hello stub" });
    assert.strictEqual(outcome.accepted, true);
    assert.ok(service.getSessions().some((s) => s.id === "untitled"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(service.getTurns(sessionId).length > before);
    assert.ok(service.getTurns(sessionId).some((turn) => turn.text === "hello stub"));
  });
  test("connected deleteSession last entry does not refill stub seeds", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0].id, "ua-only");
    assert.strictEqual(service.deleteSession("ua-only"), true);
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0].id, ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(!service.getSessions().some((s) => s.id === "untitled" || s.id === "visualize"));
    assert.strictEqual(service.isEngineSessionReady(), false);
  });
  test("disconnected after engine deleteSession still avoids stub seed refill", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    service.switchSession("ua-a");
    assert.strictEqual(service.deleteSession("ua-a"), true);
    assert.strictEqual(service.deleteSession("ua-b"), true);
    assert.strictEqual(service.getSessions().length, 0);
    assert.ok(!service.getSessions().some((s) => s.id === "untitled"));
  });
  test("connected deleteSession last entry remote throw rolls back roster and bind-failed empty-state", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.setSessionGoal("ua-only", "Keep this goal"), true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getSessionGoal("ua-only"), "Keep this goal");
      assert.strictEqual(service.getActiveSessionId(), "ua-only");
      connection.deleteError = new Error("boom");
      assert.strictEqual(service.deleteSession("ua-only"), true);
      assert.strictEqual(service.getSessions()[0].id, ENGINE_BIND_FAILED_SESSION_ID);
      assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
      assert.strictEqual(service.getSessionGoal("ua-only"), void 0);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getSessions().length, 1);
      assert.strictEqual(service.getSessions()[0].id, "ua-only");
      assert.strictEqual(service.getSessions()[0].title, "Only UA");
      assert.strictEqual(service.getActiveSessionId(), "ua-only");
      assert.strictEqual(service.getSessionGoal("ua-only"), "Keep this goal");
      assert.strictEqual(service.isEngineSessionReady(), true);
      const stored = JSON.parse(storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "{}");
      assert.ok(stored.engineCache?.sessions.some((session) => session.id === "ua-only"));
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected deleteSession last entry persists an empty engine bucket after the unary resolves", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    connection.setPublishedLink("engine-gone", 7, true);
    const service = store.add(createService(connection, storage, sessionView));
    await awaitEngineCatalogRefresh(service);
    const lease = store.add(service.acquireSessionView("ua-only"));
    assert.ok(await lease.whenBindReady?.());
    await timeout(0);
    assert.ok(service.getTurns("ua-only").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    service.switchSession("ua-only");
    const readBucket = () => {
      const stored = JSON.parse(storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "{}");
      return stored.engineCaches?.["engine-gone"];
    };
    const before = readBucket();
    assert.strictEqual(before?.sessions[0]?.id, "ua-only");
    assert.ok(JSON.stringify(before).includes(LEFTOVER_CACHE_TURN_TEXT));
    let releaseDelete;
    connection.deleteSessionGate = new Promise((resolve) => {
      releaseDelete = resolve;
    });
    assert.strictEqual(service.deleteSession("ua-only"), true);
    assert.strictEqual(service.getSessions()[0]?.id, ENGINE_BIND_FAILED_SESSION_ID);
    assert.strictEqual(readBucket()?.sessions[0]?.id, "ua-only");
    releaseDelete();
    await timeout(0);
    assert.deepStrictEqual(readBucket()?.sessions, []);
    const coldConnection = store.add(new MockUniverseAgentConnection());
    const cold = store.add(createService(coldConnection, storage));
    assert.ok(!cold.getSessions().some((session) => session.id === "ua-only"));
    assert.ok(!cold.getTurns("ua-only").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    coldConnection.setPublishedLink("engine-other", 8, false);
    assert.ok(!cold.getSessions().some((session) => session.id === "ua-only"));
    assert.ok(!cold.getTurns("ua-only").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    coldConnection.setPublishedLink("engine-gone", 7, false);
    assert.ok(!cold.getSessions().some((session) => session.id === "ua-only"));
    assert.ok(!cold.getTurns("ua-only").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    assert.deepStrictEqual(readBucket()?.sessions, []);
  });
  test("connected deleteSession mid-list remote throw restores row index and active", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([
        { sessionId: "ua-a", title: "A" },
        { sessionId: "ua-b", title: "B" },
        { sessionId: "ua-c", title: "C" }
      ]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      service.switchSession("ua-b");
      assert.strictEqual(service.setSessionGoal("ua-b", "Mid goal"), true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getActiveSessionId(), "ua-b");
      assert.strictEqual(service.getSessionGoal("ua-b"), "Mid goal");
      connection.deleteError = new Error("boom");
      assert.strictEqual(service.deleteSession("ua-b"), true);
      assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-c"]);
      assert.strictEqual(service.getActiveSessionId(), "ua-c");
      assert.strictEqual(service.getSessionGoal("ua-b"), void 0);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b", "ua-c"]);
      assert.strictEqual(service.getSessions()[1].title, "B");
      assert.strictEqual(service.getActiveSessionId(), "ua-b");
      assert.strictEqual(service.getSessionGoal("ua-b"), "Mid goal");
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected deleteSession fires onDidDeleteSession only after that unary resolves", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    let releaseDelete;
    connection.deleteSessionGate = new Promise((resolve) => {
      releaseDelete = resolve;
    });
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" },
      { sessionId: "ua-c", title: "C" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await timeout(0);
    const deleted = [];
    store.add(service.onDidDeleteSession((id) => deleted.push(id)));
    service.switchSession("ua-b");
    let stealActiveChange = false;
    store.add(service.onDidChangeActiveSession(() => {
      if (!stealActiveChange) {
        return;
      }
      stealActiveChange = false;
      service.renameSession("ua-a", "Steal");
    }));
    stealActiveChange = true;
    assert.strictEqual(service.deleteSession("ua-b"), true);
    assert.deepStrictEqual(deleted, []);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-c"]);
    assert.strictEqual(service.getSessions().find((session) => session.id === "ua-a")?.title, "Steal");
    assert.strictEqual(connection.deleteCalls.length, 1);
    assert.strictEqual(connection.renameCalls.length, 1);
    await timeout(0);
    assert.deepStrictEqual(deleted, []);
    releaseDelete();
    await timeout(0);
    assert.deepStrictEqual(deleted, ["ua-b"]);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-c"]);
  });
  test("connected deleteSession remote throw does not fire onDidDeleteSession and rolls the row back", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([
        { sessionId: "ua-a", title: "A" },
        { sessionId: "ua-b", title: "B" },
        { sessionId: "ua-c", title: "C" }
      ]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await timeout(0);
      const deleted = [];
      store.add(service.onDidDeleteSession((id) => deleted.push(id)));
      service.switchSession("ua-b");
      assert.strictEqual(service.setSessionGoal("ua-b", "Mid goal"), true);
      await timeout(0);
      connection.deleteError = new Error("boom");
      assert.strictEqual(service.deleteSession("ua-b"), true);
      assert.deepStrictEqual(deleted, []);
      assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-c"]);
      assert.strictEqual(service.getActiveSessionId(), "ua-c");
      assert.strictEqual(await service.whenDispatchedEngineActionSettles(), false);
      assert.deepStrictEqual(deleted, []);
      assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b", "ua-c"]);
      assert.strictEqual(service.getSessions()[1].title, "B");
      assert.strictEqual(service.getActiveSessionId(), "ua-b");
      assert.strictEqual(service.getSessionGoal("ua-b"), "Mid goal");
      await timeout(0);
      assert.deepStrictEqual(deleted, []);
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("disconnected engine-cache deleteSession still fires onDidDeleteSession synchronously", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await timeout(0);
    connection.setConnected(false);
    service.setEngineConnected(false);
    const deleted = [];
    store.add(service.onDidDeleteSession((id) => deleted.push(id)));
    assert.strictEqual(service.deleteSession("ua-a"), true);
    assert.deepStrictEqual(deleted, ["ua-a"]);
    assert.deepStrictEqual(connection.deleteCalls, []);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-b"]);
  });
  test("isEngineConnected follows connected phase when platform isEngineConnected is false", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const service = store.add(createService(connection));
    connection.setConnected(false);
    connection.getConnectionPhase = () => ({ kind: "connected", path: "direct" });
    const snapshot = connection.getConnectionSnapshot();
    connection.getConnectionSnapshot = () => ({
      ...snapshot,
      pairingPending: false,
      channelAlive: true,
      authenticated: true
    });
    connection._onDidChangeConnection.fire(connection.getConnectionSnapshot());
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.isEngineConnected(), true);
  });
  test("list incomplete hides stub seed rows while connected", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.getSessions().length, 0);
    assert.ok(!service.getSessions().some((s) => s.id === "untitled"));
    assert.strictEqual(service.getActiveSessionId(), "");
    assert.strictEqual(service.isEngineSessionReady(), false);
  });
  test("engine session readiness splits loading from unavailable", () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const service = store.add(createService(connection));
    const internals = service;
    assert.strictEqual(service.getEngineSessionReadiness(), "ready");
    assert.strictEqual(service.isEngineSessionReady(), true);
    internals.testEngineConnected = true;
    internals.engineSessionBindFailed = true;
    internals.listCompleted = false;
    assert.strictEqual(service.getEngineSessionReadiness(), "unavailable");
    internals.engineSessionBindFailed = false;
    assert.strictEqual(service.getEngineSessionReadiness(), "loading");
    assert.strictEqual(service.isEngineSessionReady(), false);
    internals.listCompleted = true;
    internals.pendingEngineBindSessionId = "pending";
    assert.strictEqual(service.getEngineSessionReadiness(), "loading");
    internals.pendingEngineBindSessionId = void 0;
    internals.activeEngineSessionId = void 0;
    internals.engineSessions = [];
    assert.strictEqual(service.getEngineSessionReadiness(), "unavailable");
    internals.activeEngineSessionId = "missing";
    assert.strictEqual(service.getEngineSessionReadiness(), "unavailable");
    internals.engineSessions = [{ id: "missing", title: "There", turns: [] }];
    assert.strictEqual(service.getEngineSessionReadiness(), "ready");
    assert.strictEqual(service.isEngineSessionReady(), true);
  });
  test("roster constructed while the engine is already connected lists sessions without a later connection event", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "session-101", title: "Already there" }]);
    connection.setConnected(true);
    const service = store.add(createService(connection));
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(service.isEngineSessionReady(), false);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(connection.listSessionsCalls.length, 1);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["session-101"]);
    assert.strictEqual(service.getActiveSessionId(), "session-101");
    assert.strictEqual(service.isEngineSessionReady(), true);
  });
  test("successful list then refresh keeps leftover while listCompleted is briefly false", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b"]);
    let releaseSecondList;
    const secondListHeld = new Promise((resolve) => {
      releaseSecondList = resolve;
    });
    connection.listSessions = async () => secondListHeld;
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b"]);
    assert.deepStrictEqual(service.getSessions().map((session) => session.title), ["A", "B"]);
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
    releaseSecondList({
      sessions: [
        { sessionId: "ua-a", title: "A" },
        { sessionId: "ua-b", title: "B" }
      ]
    });
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b"]);
  });
  test("first catalog refresh without leftover still returns empty getSessions", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    let releaseFirstList;
    const firstListHeld = new Promise((resolve) => {
      releaseFirstList = resolve;
    });
    connection.listSessions = async () => firstListHeld;
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getSessions().length, 0);
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
    assert.strictEqual(service.isEngineSessionReady(), false);
    releaseFirstList({ sessions: [] });
    await awaitEngineCatalogRefresh(service);
  });
  test("connected empty list with default mock acquires host lease without roster create", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(connection.createCalls.length, 0);
    assert.ok(service.getSessions().length > 0);
    assert.strictEqual(service.isEngineSessionReady(), true);
  });
  test("connected empty list defers Create to host lease and adopts clientSessionId on bind", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const acquireLeaseCalls = [];
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        return `lease:${sessionId}`;
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: true, correlation: { id: "mock" } }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(connection.createCalls.length, 0, "roster must not call SessionService.Create");
    assert.ok(acquireLeaseCalls.length >= 1, "host lease must be acquired exactly once");
    const boundSessionId = acquireLeaseCalls[acquireLeaseCalls.length - 1];
    assert.ok(boundSessionId.startsWith("session-"));
    assert.strictEqual(service.getActiveSessionId(), boundSessionId);
    assert.ok(service.getSessions().some((session) => session.id === boundSessionId));
    assert.strictEqual(service.isEngineSessionReady(), true);
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
  });
  test("connected listed session switches to engine id without untitled fallback", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-listed", title: "Listed UA" }]);
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getActiveSessionId(), "ua-listed");
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(service.isEngineSessionReady(), true);
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
  });
  test("empty list allocates stable clientSessionId for host lease without roster Create", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    let listCalls = 0;
    connection.listSessions = async () => {
      listCalls++;
      return { sessions: [] };
    };
    const acquireLeaseCalls = [];
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        return `lease:${sessionId}`;
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: true, correlation: { id: "mock" } }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(listCalls, 1);
    assert.strictEqual(acquireLeaseCalls.length, 1);
    const clientSessionId = acquireLeaseCalls[0];
    assert.ok(clientSessionId?.startsWith("session-"));
    assert.notStrictEqual(clientSessionId, ENGINE_BIND_FAILED_SESSION_ID);
    assert.strictEqual(service.getActiveSessionId(), clientSessionId);
  });
  test("empty list host lease bind failure shows bind-failed roster row", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async () => {
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(service.isEngineSessionReady(), false);
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0]?.id, ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(service.getSessions()[0]?.title.includes("bind failed"));
    assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(!service.getSessions().some((session) => session.title === "New session"));
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
    assert.strictEqual(service.getTurns("untitled").length, 0);
    assert.strictEqual(service.getTurns(ENGINE_BIND_FAILED_SESSION_ID).length, 0);
  });
  test("listed ghost sessions with lease bind failure shows bind-failed roster row", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "session-100", title: "Ghost 100" },
      { sessionId: "session-101", title: "Ghost 101" }
    ]);
    const acquireLeaseCalls = [];
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(connection.createCalls.length, 0);
    assert.ok(acquireLeaseCalls.includes("session-100"));
    assert.strictEqual(acquireLeaseCalls.filter((id) => id === "session-100").length, acquireLeaseCalls.length);
    assert.strictEqual(service.isEngineSessionReady(), false);
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0]?.id, ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(service.getSessions()[0]?.title.includes("bind failed"));
    assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(!service.getSessions().some((session) => session.title === "New session"));
    assert.ok(!service.getSessions().some((session) => session.id === "session-100"));
    assert.ok(!service.getSessions().some((session) => session.id === "session-101"));
  });
  test("bind-failed getActiveSession does not fall back to untitled stub title", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async () => {
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(!service.getActiveSession().title.includes("Untitled session"));
    assert.ok(service.getActiveSession().title.includes("bind failed"));
  });
  test("listSessions throw shows bind-failed and does not mint New session", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.listSessionsError = new Error("Query does not return results");
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async () => {
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(service.isEngineSessionReady(), false);
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0]?.id, ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(service.getSessions()[0]?.title.includes("bind failed"));
    assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(service.getActiveSession().title.includes("bind failed"));
    assert.ok(!service.getActiveSession().title.includes("Untitled session"));
    assert.ok(!service.getSessions().some((session) => session.title === "New session"));
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
  });
  test("successful list then listSessions throw keeps leftover and does not mint New session", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b"]);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    const treeRefreshAfterLive = connection.treeRefreshCalls.length;
    const createAfterLive = connection.createCalls.length;
    connection.listSessionsError = new Error("Query does not return results");
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b"]);
    assert.deepStrictEqual(service.getSessions().map((session) => session.title), ["A", "B"]);
    assert.ok(!service.getSessions().some((session) => session.id === ENGINE_BIND_FAILED_SESSION_ID));
    assert.ok(!service.getSessions().some((session) => session.title === "New session"));
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    assert.strictEqual(service.getActiveSession().id, "ua-a");
    assert.strictEqual(service.isEngineSessionReady(), false);
    assert.strictEqual(service.createSession(), "");
    service.switchSession("ua-b");
    assert.strictEqual(service.getActiveSessionId(), "ua-b");
    assert.strictEqual(connection.createCalls.length, createAfterLive);
    assert.strictEqual(connection.treeRefreshCalls.length, treeRefreshAfterLive);
  });
  test("KEEP leftover list-fail renameSession deleteSession and mutators reject and skip unary", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b"]);
    assert.strictEqual(isConversationPairingHold(connection), false);
    const renameAfterLive = connection.renameCalls.length;
    const deleteAfterLive = connection.deleteCalls.length;
    const cancelAfterLive = connection.cancelCalls.length;
    const setGoalAfterLive = connection.setGoalCalls.length;
    const cancelGoalAfterLive = connection.cancelGoalCalls.length;
    const forkAfterLive = connection.forkCalls.length;
    const killAfterLive = connection.killCalls.length;
    const snapshotAfterLive = connection.createSnapshotCalls.length;
    const cancelToolAfterLive = connection.cancelToolCallCalls.length;
    const enqueueAfterLive = connection.enqueueCalls.length;
    const retryQueueAfterLive = connection.retryQueueItemCalls.length;
    const pauseAfterLive = connection.pauseQueueCalls.length;
    const resumeAfterLive = connection.resumeQueueCalls.length;
    const clearAfterLive = connection.clearQueueCalls.length;
    const holdAfterLive = connection.holdQueueCalls.length;
    const releaseAfterLive = connection.releaseQueueCalls.length;
    const editQueueAfterLive = connection.editQueueCalls.length;
    const deleteMessageAfterLive = connection.deleteMessageCalls.length;
    const editMessageAfterLive = connection.editMessageCalls.length;
    const permissionAfterLive = connection.respondPermissionCalls.length;
    const clientToolAfterLive = connection.sendClientToolResponseCalls.length;
    const questionAfterLive = connection.respondQuestionCalls.length;
    const createAfterLive = connection.createCalls.length;
    connection.listSessionsError = new Error("Query does not return results");
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineSessionReady(), false);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b"]);
    const titlesBefore = service.getSessions().map((session) => session.title);
    const idsBefore = service.getSessions().map((session) => session.id);
    assert.strictEqual(service.renameSession("ua-a", "Leftover title"), false);
    assert.strictEqual(service.deleteSession("ua-a"), false);
    assert.strictEqual(service.cancelGeneration("ua-a"), false);
    assert.strictEqual(service.setSessionGoal("ua-a", "Leftover goal"), false);
    assert.strictEqual(service.cancelSessionGoal("ua-a"), false);
    assert.strictEqual(service.forkSubAgent("ua-a", { name: "leftover-fork" }), false);
    assert.strictEqual(service.killSubAgent("ua-a", { agentId: "sub:leftover" }), false);
    assert.strictEqual(service.createSnapshot("ua-a", { title: "Leftover snapshot" }), false);
    assert.strictEqual(service.cancelToolCall("ua-a", { toolCallId: "tc-leftover" }), false);
    assert.strictEqual(service.retryError("ua-a", { messageId: "msg-leftover" }), false);
    assert.strictEqual(service.deleteTurn("ua-a", "turn-leftover"), false);
    assert.strictEqual(service.updateUserTurnText("ua-a", "turn-leftover", "leftover edit"), false);
    assert.strictEqual(service.enqueueMessageQueueItem("ua-a", "leftover item"), false);
    assert.strictEqual(service.retryMessageQueueItem("ua-a", "q-leftover"), false);
    service.pauseMessageQueue("ua-a");
    service.resumeMessageQueue("ua-a");
    service.clearMessageQueue("ua-a");
    service.holdMessageQueueItem("ua-a", "q-leftover", "EDITING");
    service.releaseMessageQueueItemHold("ua-a", "q-leftover");
    assert.strictEqual(service.updateMessageQueueItemContent("ua-a", "q-leftover", "leftover edit"), false);
    assert.strictEqual(service.resolveConfirmation("ua-a", "req-leftover", "allowed"), false);
    assert.strictEqual(service.respondClientTool("ua-a", "call-leftover", { content: "{}" }), false);
    assert.strictEqual(service.respondQuestion("ua-a", "q-leftover"), false);
    assert.strictEqual(service.createSession(), "");
    assert.strictEqual(connection.renameCalls.length, renameAfterLive);
    assert.strictEqual(connection.deleteCalls.length, deleteAfterLive);
    assert.strictEqual(connection.cancelCalls.length, cancelAfterLive);
    assert.strictEqual(connection.setGoalCalls.length, setGoalAfterLive);
    assert.strictEqual(connection.cancelGoalCalls.length, cancelGoalAfterLive);
    assert.strictEqual(connection.forkCalls.length, forkAfterLive);
    assert.strictEqual(connection.killCalls.length, killAfterLive);
    assert.strictEqual(connection.createSnapshotCalls.length, snapshotAfterLive);
    assert.strictEqual(connection.cancelToolCallCalls.length, cancelToolAfterLive);
    assert.strictEqual(connection.enqueueCalls.length, enqueueAfterLive);
    assert.strictEqual(connection.retryQueueItemCalls.length, retryQueueAfterLive);
    assert.strictEqual(connection.pauseQueueCalls.length, pauseAfterLive);
    assert.strictEqual(connection.resumeQueueCalls.length, resumeAfterLive);
    assert.strictEqual(connection.clearQueueCalls.length, clearAfterLive);
    assert.strictEqual(connection.holdQueueCalls.length, holdAfterLive);
    assert.strictEqual(connection.releaseQueueCalls.length, releaseAfterLive);
    assert.strictEqual(connection.editQueueCalls.length, editQueueAfterLive);
    assert.strictEqual(connection.deleteMessageCalls.length, deleteMessageAfterLive);
    assert.strictEqual(connection.editMessageCalls.length, editMessageAfterLive);
    assert.strictEqual(connection.respondPermissionCalls.length, permissionAfterLive);
    assert.strictEqual(connection.sendClientToolResponseCalls.length, clientToolAfterLive);
    assert.strictEqual(connection.respondQuestionCalls.length, questionAfterLive);
    assert.strictEqual(connection.createCalls.length, createAfterLive);
    assert.deepStrictEqual(service.getSessions().map((session) => session.title), titlesBefore);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), idsBefore);
  });
  test("listed ghost titled New session with lease bind failure shows bind-failed", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "session-ghost", title: "New session" }]);
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async () => {
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0]?.id, ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(service.getSessions()[0]?.title.includes("bind failed"));
    assert.ok(service.getActiveSession().title.includes("bind failed"));
    assert.ok(!service.getSessions().some((session) => session.title === "New session"));
    assert.ok(!service.getSessions().some((session) => session.id === "session-ghost"));
  });
  test("connected listed session on first refresh skips create when catalog is non-empty", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-existing", title: "New session" }]);
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getActiveSessionId(), "ua-existing");
    assert.strictEqual(service.isEngineSessionReady(), true);
    assert.strictEqual(connection.createCalls.length, 0);
  });
  test("D13 storage persists engine cache across engine roster restart", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-persist", title: "Persisted UA" }]);
    const first = store.add(createService(connection, storage));
    connection.setConnected(true);
    first.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(first.getSessions()[0]?.id, "ua-persist");
    first.switchSession("ua-persist");
    const second = store.add(createService(store.add(new MockUniverseAgentConnection()), storage));
    assert.ok(storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE)?.includes("ua-persist"));
    assert.strictEqual(second.getActiveSessionId(), "ua-persist");
  });
  test("getTrajectoryRecords on UA session never merges stub fixture extras", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    service.switchSession("ua-only");
    const records = service.getTrajectoryRecords("ua-only");
    assert.ok(!records.some((record) => record.text.includes("Stub")));
    assert.ok(!records.some((record) => record.kind === "system"));
  });
  test("disconnected UA session getTrajectoryRecords stays fixture-free", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    const records = service.getTrajectoryRecords("ua-only");
    assert.ok(!records.some((record) => record.kind === "system" && record.text.includes("Stub")));
  });
  test("connected renameSession forwards AgentService.Rename and updates title", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    let fired = "";
    store.add(service.onDidChangeSession((id) => {
      fired = id;
    }));
    assert.strictEqual(service.renameSession("ua-only", "  Renamed UA  "), true);
    assert.strictEqual(service.getSessions()[0]?.title, "Renamed UA");
    assert.strictEqual(fired, "ua-only");
    assert.deepStrictEqual(connection.renameCalls, [{ sessionId: "ua-only", title: "Renamed UA" }]);
    assert.strictEqual(service.renameSession("ua-only", "Renamed UA"), false);
    assert.strictEqual(service.renameSession("ua-only", "   "), false);
    assert.strictEqual(service.renameSession("missing", "Nope"), false);
    assert.strictEqual(connection.renameCalls.length, 1);
  });
  test("engine rejection of respondPermission is reported, not swallowed", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const refused = new Error("engine refused");
    connection.respondPermission = async () => {
      throw refused;
    };
    const failures = [];
    store.add(service.onDidFailEngineAction((failure) => failures.push(failure)));
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-1", "allowed"), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepStrictEqual(failures, [{ sessionId: "ua-only", action: "respondPermission", error: refused }]);
  });
  test("engine rejection of renameSession restores the local title", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.renameSession = async () => {
      throw new Error("engine refused");
    };
    const actions = [];
    store.add(service.onDidFailEngineAction((failure) => actions.push(failure.action)));
    assert.strictEqual(service.renameSession("ua-only", "Renamed UA"), true);
    assert.strictEqual(service.getSessions()[0]?.title, "Renamed UA");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepStrictEqual(actions, ["renameSession"]);
    assert.strictEqual(service.getSessions()[0]?.title, "Only UA");
  });
  test("engine rejection of setSessionGoal restores the previous goal", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.setSessionGoal("ua-only", "first goal"), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getSessionGoal("ua-only"), "first goal");
    connection.setSessionGoal = async () => {
      throw new Error("engine refused");
    };
    assert.strictEqual(service.setSessionGoal("ua-only", "second goal"), true);
    assert.strictEqual(service.getSessionGoal("ua-only"), "second goal");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getSessionGoal("ua-only"), "first goal");
  });
  test("engine rejection of deleteSession re-lists the catalog instead of keeping the row gone", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.deleteSession = async () => {
      throw new Error("engine refused");
    };
    const actions = [];
    store.add(service.onDidFailEngineAction((failure) => actions.push(failure.action)));
    assert.strictEqual(service.deleteSession("ua-a"), true);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-b"]);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(actions, ["deleteSession"]);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
  });
  test("leftover renameSession and deleteSession reject while pairingPending and leave roster unchanged", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.renameSession("ua-a", "Connected A"), true);
    assert.strictEqual(service.getSessions().find((s) => s.id === "ua-a")?.title, "Connected A");
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setPairingPending(true);
    assert.strictEqual(connection.isEngineConnected(), false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(isConversationPairingHold(connection), true);
    const titlesBefore = service.getSessions().map((s) => s.title);
    const idsBefore = service.getSessions().map((s) => s.id);
    assert.strictEqual(service.renameSession("ua-a", "Pairing title"), false);
    assert.strictEqual(service.deleteSession("ua-a"), false);
    assert.deepStrictEqual(service.getSessions().map((s) => s.title), titlesBefore);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), idsBefore);
    assert.strictEqual(connection.renameCalls.filter((call) => call.title === "Pairing title").length, 0);
    connection.setPairingPending(false);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.renameSession("ua-a", "Live again"), true);
    assert.strictEqual(service.getSessions().find((s) => s.id === "ua-a")?.title, "Live again");
  });
  test("leftover renameSession and deleteSession reject on production connecting pairing snapshot", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.renameSession("ua-a", "Connected A"), true);
    connection.setPairingConnectingPhase("initial");
    assert.strictEqual(connection.getConnectionPhase().kind, "connecting");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(isConversationEngineLive(connection.getConnectionPhase(), connection.getConnectionSnapshot().pairingPending), false);
    assert.strictEqual(connection.isEngineConnected(), false);
    assert.strictEqual(service.isEngineConnected(), false);
    const titlesBefore = service.getSessions().map((s) => s.title);
    const idsBefore = service.getSessions().map((s) => s.id);
    assert.strictEqual(service.renameSession("ua-a", "Pairing title"), false);
    assert.strictEqual(service.deleteSession("ua-a"), false);
    assert.deepStrictEqual(service.getSessions().map((s) => s.title), titlesBefore);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), idsBefore);
  });
  test("leftover-looks-live renameSession and deleteSession reject while pairingPending and skip unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.renameSession("ua-only", "Live title"), true);
    assert.strictEqual(connection.renameCalls.length, 1);
    assert.strictEqual(connection.deleteCalls.length, 0);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    const titlesBefore = service.getSessions().map((s) => s.title);
    const idsBefore = service.getSessions().map((s) => s.id);
    assert.strictEqual(service.renameSession("ua-only", "Looks-live title"), false);
    assert.strictEqual(service.deleteSession("ua-only"), false);
    assert.strictEqual(connection.renameCalls.length, 1);
    assert.strictEqual(connection.deleteCalls.length, 0);
    assert.deepStrictEqual(service.getSessions().map((s) => s.title), titlesBefore);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), idsBefore);
  });
  test("leftover-looks-live cancelGeneration, setSessionGoal and cancelSessionGoal reject while pairingPending and skip unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.setSessionGoal("ua-only", "Live goal"), true);
    assert.strictEqual(service.cancelGeneration("ua-only"), true);
    assert.strictEqual(connection.setGoalCalls.length, 1);
    assert.strictEqual(connection.cancelCalls.length, 1);
    assert.strictEqual(connection.cancelGoalCalls.length, 0);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.cancelGeneration("ua-only"), false);
    assert.strictEqual(service.setSessionGoal("ua-only", "Looks-live goal"), false);
    assert.strictEqual(service.cancelSessionGoal("ua-only"), false);
    assert.strictEqual(connection.cancelCalls.length, 1);
    assert.strictEqual(connection.setGoalCalls.length, 1);
    assert.strictEqual(connection.cancelGoalCalls.length, 0);
    assert.strictEqual(service.getSessionGoal("ua-only"), "Live goal");
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.setSessionGoal("ua-only", "Live again"), true);
    assert.strictEqual(service.cancelGeneration("ua-only"), true);
    assert.strictEqual(service.cancelSessionGoal("ua-only"), true);
    assert.strictEqual(connection.setGoalCalls.length, 2);
    assert.strictEqual(connection.cancelCalls.length, 2);
    assert.strictEqual(connection.cancelGoalCalls.length, 1);
    assert.strictEqual(service.getSessionGoal("ua-only"), void 0);
  });
  test("leftover-looks-live forkSubAgent and killSubAgent reject while pairingPending and skip unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.forkSubAgent("ua-only", { name: "reviewer" }), true);
    assert.strictEqual(service.killSubAgent("ua-only", { agentId: "sub:reviewer" }), true);
    assert.strictEqual(connection.forkCalls.length, 1);
    assert.strictEqual(connection.killCalls.length, 1);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.forkSubAgent("ua-only", { name: "Looks-live fork" }), false);
    assert.strictEqual(service.killSubAgent("ua-only", { agentId: "sub:looks-live" }), false);
    assert.strictEqual(connection.forkCalls.length, 1);
    assert.strictEqual(connection.killCalls.length, 1);
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.forkSubAgent("ua-only", { name: "Live again" }), true);
    assert.strictEqual(service.killSubAgent("ua-only", { agentId: "sub:again" }), true);
    assert.strictEqual(connection.forkCalls.length, 2);
    assert.strictEqual(connection.killCalls.length, 2);
  });
  test("leftover-looks-live cancelToolCall rejects while pairingPending and skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "tc-live" }), true);
    assert.strictEqual(connection.cancelToolCallCalls.length, 1);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "tc-looks-live" }), false);
    assert.strictEqual(connection.cancelToolCallCalls.length, 1);
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "tc-again" }), true);
    assert.strictEqual(connection.cancelToolCallCalls.length, 2);
  });
  test("leftover-looks-live queue mutates reject while pairingPending and skip unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.enableQueueReadback();
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.enqueueMessageQueueItem("ua-only", "live item"), false);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q-live"), true);
    service.pauseMessageQueue("ua-only");
    service.resumeMessageQueue("ua-only");
    service.clearMessageQueue("ua-only");
    service.holdMessageQueueItem("ua-only", "q-live", "EDITING");
    service.releaseMessageQueueItemHold("ua-only", "q-live");
    assert.strictEqual(service.updateMessageQueueItemContent("ua-only", "q-live", "live edit"), true);
    assert.strictEqual(connection.enqueueCalls.length, 0);
    assert.strictEqual(connection.retryQueueItemCalls.length, 1);
    assert.strictEqual(connection.pauseQueueCalls.length, 1);
    assert.strictEqual(connection.resumeQueueCalls.length, 1);
    assert.strictEqual(connection.clearQueueCalls.length, 1);
    assert.strictEqual(connection.holdQueueCalls.length, 1);
    assert.strictEqual(connection.releaseQueueCalls.length, 1);
    assert.strictEqual(connection.editQueueCalls.length, 1);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.enqueueMessageQueueItem("ua-only", "looks-live item"), false);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q-looks-live"), false);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q-looks-live", { upload: true }), false);
    service.pauseMessageQueue("ua-only");
    service.resumeMessageQueue("ua-only");
    service.clearMessageQueue("ua-only");
    service.holdMessageQueueItem("ua-only", "q-looks-live", "EDITING");
    service.releaseMessageQueueItemHold("ua-only", "q-looks-live");
    assert.strictEqual(service.updateMessageQueueItemContent("ua-only", "q-looks-live", "looks-live edit"), false);
    assert.strictEqual(connection.enqueueCalls.length, 0);
    assert.strictEqual(connection.retryQueueItemCalls.length, 1);
    assert.strictEqual(connection.retryQueueItemUploadCalls.length, 0);
    assert.strictEqual(connection.pauseQueueCalls.length, 1);
    assert.strictEqual(connection.resumeQueueCalls.length, 1);
    assert.strictEqual(connection.clearQueueCalls.length, 1);
    assert.strictEqual(connection.holdQueueCalls.length, 1);
    assert.strictEqual(connection.releaseQueueCalls.length, 1);
    assert.strictEqual(connection.editQueueCalls.length, 1);
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.enqueueMessageQueueItem("ua-only", "live again"), false);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q-again"), true);
    service.pauseMessageQueue("ua-only");
    service.resumeMessageQueue("ua-only");
    service.clearMessageQueue("ua-only");
    service.holdMessageQueueItem("ua-only", "q-again", "EDITING");
    service.releaseMessageQueueItemHold("ua-only", "q-again");
    assert.strictEqual(service.updateMessageQueueItemContent("ua-only", "q-again", "live again"), true);
    assert.strictEqual(connection.enqueueCalls.length, 0);
    assert.strictEqual(connection.retryQueueItemCalls.length, 2);
    assert.strictEqual(connection.retryQueueItemUploadCalls.length, 0);
    assert.strictEqual(connection.pauseQueueCalls.length, 2);
    assert.strictEqual(connection.resumeQueueCalls.length, 2);
    assert.strictEqual(connection.clearQueueCalls.length, 2);
    assert.strictEqual(connection.holdQueueCalls.length, 2);
    assert.strictEqual(connection.releaseQueueCalls.length, 2);
    assert.strictEqual(connection.editQueueCalls.length, 2);
  });
  test("leftover-looks-live retryError, deleteTurn and updateUserTurnText reject while pairingPending and skip unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = new MockUniverseAgentSessionView();
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage, sessionView));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    const viewLease = store.add(service.acquireSessionView("ua-only"));
    assert.ok(await viewLease.whenBindReady?.());
    assert.strictEqual(service.retryError("ua-only", { messageId: "msg-live" }), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.deleteTurn("ua-only", "turn-live"), true);
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-live", "live edit"), true);
    assert.strictEqual(sessionView.postCalls.length, 1);
    assert.strictEqual(connection.continuationOpens.length, 0);
    assert.strictEqual(connection.deleteMessageCalls.length, 1);
    assert.strictEqual(connection.editMessageCalls.length, 1);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.retryError("ua-only", { messageId: "msg-looks-live" }), false);
    assert.strictEqual(service.deleteTurn("ua-only", "turn-looks-live"), false);
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-looks-live", "looks-live edit"), false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(sessionView.postCalls.length, 1);
    assert.strictEqual(connection.continuationOpens.length, 0);
    assert.strictEqual(connection.deleteMessageCalls.length, 1);
    assert.strictEqual(connection.editMessageCalls.length, 1);
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.retryError("ua-only", { messageId: "msg-again" }), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.deleteTurn("ua-only", "turn-again"), true);
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-again", "live again"), true);
    assert.strictEqual(sessionView.postCalls.length, 2);
    assert.strictEqual(connection.continuationOpens.length, 0);
    assert.strictEqual(connection.deleteMessageCalls.length, 2);
    assert.strictEqual(connection.editMessageCalls.length, 2);
  });
  test("leftover-looks-live resolveConfirmation, respondClientTool and respondQuestion reject while pairingPending and skip unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-live", "allowed"), true);
    assert.strictEqual(service.respondClientTool("ua-only", "call-live", { content: "{}" }), true);
    assert.strictEqual(service.respondQuestion("ua-only", "q-live"), true);
    assert.strictEqual(connection.respondPermissionCalls.length, 1);
    assert.strictEqual(connection.sendClientToolResponseCalls.length, 1);
    assert.strictEqual(connection.respondQuestionCalls.length, 1);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-looks-live", "allowed"), false);
    assert.strictEqual(service.respondClientTool("ua-only", "call-looks-live", { content: "{}" }), false);
    assert.strictEqual(service.respondQuestion("ua-only", "q-looks-live"), false);
    assert.strictEqual(connection.respondPermissionCalls.length, 1);
    assert.strictEqual(connection.sendClientToolResponseCalls.length, 1);
    assert.strictEqual(connection.respondQuestionCalls.length, 1);
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-again", "skipped"), true);
    assert.strictEqual(service.respondClientTool("ua-only", "call-again", { content: "{}" }), true);
    assert.strictEqual(service.respondQuestion("ua-only", "q-again"), true);
    assert.strictEqual(connection.respondPermissionCalls.length, 2);
    assert.strictEqual(connection.sendClientToolResponseCalls.length, 2);
    assert.strictEqual(connection.respondQuestionCalls.length, 2);
  });
  test("leftover-looks-live createSession and switchSession skip engine write while pairingPending", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    const acquireLeaseCalls = [];
    const sessionView = createSessionViewMock({
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        return `lease:${sessionId}`;
      }
    });
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    service.switchSession("ua-b");
    assert.strictEqual(service.getActiveSessionId(), "ua-b");
    assert.ok(connection.treeRefreshCalls.includes("ua-b"));
    const treeRefreshBeforePairing = connection.treeRefreshCalls.length;
    const createCallsBefore = connection.createCalls.length;
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.createSession(), "");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(connection.createCalls.length, createCallsBefore);
    assert.strictEqual(acquireLeaseCalls.filter((id) => id.startsWith("session-")).length, 0);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
    assert.ok(!service.getSessions().some((s) => s.title === "New session"));
    assert.strictEqual(service.getActiveSessionId(), "ua-b");
    const treeRefreshAtPairing = connection.treeRefreshCalls.length;
    service.switchSession("ua-a");
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    assert.strictEqual(connection.treeRefreshCalls.length, treeRefreshAtPairing);
    assert.ok(treeRefreshAtPairing >= treeRefreshBeforePairing);
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    service.switchSession("ua-b");
    assert.strictEqual(service.getActiveSessionId(), "ua-b");
    assert.strictEqual(connection.treeRefreshCalls.length, treeRefreshAtPairing + 1);
    assert.strictEqual(connection.treeRefreshCalls.at(-1), "ua-b");
    assert.strictEqual(service.createSession(), "");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(acquireLeaseCalls.filter((id) => id.startsWith("session-")).length, 1);
  });
  test("leftover-looks-live activateEngineSession skips tree refresh while pairingPending", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    const treeRefreshBeforePairing = connection.treeRefreshCalls.length;
    assert.ok(treeRefreshBeforePairing > 0);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
    assert.strictEqual(connection.treeRefreshCalls.length, treeRefreshBeforePairing);
    connection.setListSessions([{ sessionId: "ua-b", title: "B" }]);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
    assert.strictEqual(connection.treeRefreshCalls.length, treeRefreshBeforePairing);
  });
  test("leftover-looks-live catalog refresh keeps leftover roster and skips listSessions", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    const listsAfterLoad = connection.listSessionsCalls.length;
    const createCallsAfterLoad = connection.createCalls.length;
    assert.ok(listsAfterLoad > 0);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(connection.listSessionsCalls.length, listsAfterLoad, "leftover-looks-live must not extra listSessions");
    assert.strictEqual(connection.createCalls.length, createCallsAfterLoad, "leftover-looks-live must not ensureEngineSession");
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    connection.setListSessions([{ sessionId: "ua-live", title: "Live" }]);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(connection.listSessionsCalls.length, listsAfterLoad, "leftover-looks-live must not re-list leftover as live");
    assert.strictEqual(connection.createCalls.length, createCallsAfterLoad);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
    assert.ok(!service.getSessions().some((s) => s.id === "ua-live"));
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    await awaitEngineCatalogRefresh(service);
    assert.ok(connection.listSessionsCalls.length > listsAfterLoad, "connected leftover must still refresh");
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-live"]);
    assert.strictEqual(service.getActiveSessionId(), "ua-live");
  });
  test("in-flight listSessions leftover-looks-live keeps leftover roster and skips Create", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    const acquireLeaseCalls = [];
    const sessionView = createSessionViewMock({
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        return `lease:${sessionId}`;
      }
    });
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    const createCallsAfterLoad = connection.createCalls.length;
    const acquireAfterLoad = acquireLeaseCalls.length;
    assert.strictEqual(acquireLeaseCalls.filter((id) => id.startsWith("session-")).length, 0);
    let releaseSecondList;
    let secondStarted;
    const secondEntered = new Promise((resolve) => {
      secondStarted = resolve;
    });
    const secondListHeld = new Promise((resolve) => {
      releaseSecondList = resolve;
    });
    connection.listSessions = async () => {
      connection.listSessionsCalls.push({});
      secondStarted?.();
      return secondListHeld;
    };
    service.setEngineConnected(true);
    await secondEntered;
    assert.strictEqual(isConversationPairingHold(connection), false);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    releaseSecondList({ sessions: [] });
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(connection.createCalls.length, createCallsAfterLoad, "in-flight leftover-looks-live must not Create");
    assert.strictEqual(acquireLeaseCalls.filter((id) => id.startsWith("session-")).length, 0, "in-flight leftover-looks-live must not ensureEngineSession");
    assert.strictEqual(acquireLeaseCalls.length, acquireAfterLoad);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), ["ua-a", "ua-b"]);
    assert.ok(!service.getSessions().some((s) => s.id === "ua-live" || s.title === "New session"));
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
  });
  test("disconnected after engine renameSession stays local and skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.renameSession("ua-only", "Cached title"), true);
    assert.strictEqual(service.getSessions()[0]?.title, "Cached title");
    assert.strictEqual(connection.renameCalls.length, 0);
  });
  test("connected renameSession remote throw rolls back title", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      connection.renameError = new Error("boom");
      assert.strictEqual(service.renameSession("ua-only", "Renamed UA"), true);
      assert.strictEqual(service.getSessions()[0]?.title, "Renamed UA");
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getSessions()[0]?.title, "Only UA");
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected renameSession ok:false rolls back title", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      connection.renameResult = { ok: false, message: "denied" };
      assert.strictEqual(service.renameSession("ua-only", "Renamed UA"), true);
      assert.strictEqual(service.getSessions()[0]?.title, "Renamed UA");
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getSessions()[0]?.title, "Only UA");
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected cancelGeneration forwards AgentService.Cancel", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.cancelGeneration("ua-only", "  sub:a  "), true);
    assert.deepStrictEqual(connection.cancelCalls, [{ sessionId: "ua-only", agentId: "sub:a" }]);
    assert.strictEqual(service.cancelGeneration("ua-only", "sub:a"), true);
    assert.deepStrictEqual(connection.cancelCalls[1], { sessionId: "ua-only", agentId: "sub:a" });
    assert.strictEqual(service.cancelGeneration("ua-only"), true);
    assert.deepStrictEqual(connection.cancelCalls[2], { sessionId: "ua-only", agentId: "root" });
    assert.strictEqual(service.cancelGeneration("missing"), false);
    assert.strictEqual(service.cancelGeneration("missing", "root"), false);
    assert.strictEqual(connection.cancelCalls.length, 3);
  });
  test("cancelGeneration uses last cached-projection streaming agentId instead of root", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    stubCachedProjection(service, "ua-only", projectionWithStreamingAgent("ua-only", "sub:live"));
    assert.ok(!service.getTurns("ua-only").some((turn) => turn.streaming));
    assert.strictEqual(service.cancelGeneration("ua-only"), true);
    assert.deepStrictEqual(connection.cancelCalls, [{ sessionId: "ua-only", agentId: "sub:live" }]);
  });
  test("cancelGeneration stays root when cached projection has no streaming agent", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    stubCachedProjection(service, "ua-only", stubTurnsToSnapshot("ua-only", [
      { id: "u1", kind: "user", text: "hi" },
      { id: "a1", kind: "assistant", text: "settled" }
    ]));
    assert.strictEqual(service.cancelGeneration("ua-only"), true);
    assert.deepStrictEqual(connection.cancelCalls, [{ sessionId: "ua-only", agentId: "root" }]);
  });
  test("connected createSession catalogs New session only after host Create/Resume, not acquireLease", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const acquireLeaseCalls = [];
    let resolveReady;
    const sessionView = createSessionViewMock({
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        return `lease:${sessionId}`;
      },
      whenEngineSessionReady: (sessionId) => {
        if (sessionId === "ua-only") {
          return Promise.resolve(sessionId);
        }
        return new Promise((resolve) => {
          resolveReady = () => resolve(sessionId);
        });
      }
    });
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    const previous = service.getActiveSessionId();
    let fired = "";
    store.add(service.onDidChangeActiveSession((id) => {
      fired = id;
    }));
    assert.strictEqual(service.createSession(), "");
    assert.strictEqual(service.getActiveSessionId(), previous);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(connection.createCalls.length, 0);
    const newSessionCalls = acquireLeaseCalls.filter((id) => id.startsWith("session-"));
    assert.strictEqual(newSessionCalls.length, 1);
    const newSessionId = newSessionCalls[0];
    assert.ok(newSessionId.startsWith("session-"));
    assert.notStrictEqual(newSessionId, "ua-only");
    assert.ok(!service.getSessions().some((session) => session.id === newSessionId));
    assert.ok(!service.getSessions().some((session) => session.title === "New session"));
    assert.strictEqual(service.getActiveSessionId(), previous);
    assert.strictEqual(fired, "");
    resolveReady?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(service.getSessions().some((session) => session.id === newSessionId));
    assert.strictEqual(service.getSessions().find((session) => session.id === newSessionId)?.title, "New session");
    assert.strictEqual(service.getActiveSessionId(), newSessionId);
    assert.strictEqual(fired, newSessionId);
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
  });
  test("connected createSession skips engine ids the restarted allocator would reuse", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "session-100", title: "Existing 100" },
      { sessionId: "session-101", title: "Existing 101" }
    ]);
    const acquireLeaseCalls = [];
    let resolveReady;
    const sessionView = createSessionViewMock({
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        return `lease:${sessionId}`;
      },
      whenEngineSessionReady: (sessionId) => {
        if (sessionId === "session-100" || sessionId === "session-101") {
          return Promise.resolve(sessionId);
        }
        return new Promise((resolve) => {
          resolveReady = () => resolve(sessionId);
        });
      }
    });
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    setConversationStubNextTurnId(100);
    const previous = service.getActiveSessionId();
    assert.strictEqual(service.createSession(), "");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(connection.createCalls.length, 0);
    const fresh = acquireLeaseCalls.filter((id) => id !== "session-100" && id !== "session-101");
    assert.deepStrictEqual(fresh, ["session-102"]);
    assert.ok(!service.getSessions().some((session) => session.id === "session-102"));
    assert.strictEqual(service.getActiveSessionId(), previous);
    assert.ok(service.getSessions().some((session) => session.id === "session-100"));
    assert.ok(service.getSessions().some((session) => session.id === "session-101"));
    resolveReady?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getSessions().find((session) => session.id === "session-102")?.title, "New session");
    assert.strictEqual(service.getActiveSessionId(), "session-102");
    assert.strictEqual(service.getSessions().length, 3);
  });
  test("connected createSession acquireLease ok but Create fail keeps catalog and does not mint New session", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const sessionView = createSessionViewMock({
      whenEngineSessionReady: async (sessionId) => {
        if (sessionId === "ua-only") {
          return sessionId;
        }
        throw new Error("CreateSession returned empty session_id");
      }
    });
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.createSession(), "");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0]?.id, "ua-only");
    assert.strictEqual(service.getSessions()[0]?.title, "Only UA");
    assert.ok(!service.getSessions().some((session) => session.title === "New session"));
    assert.strictEqual(service.getActiveSessionId(), "ua-only");
  });
  test("connected createSession acquireLease ok but empty engine session_id does not mint New session", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const sessionView = createSessionViewMock({
      whenEngineSessionReady: async (sessionId) => {
        if (sessionId === "ua-only") {
          return sessionId;
        }
        return "";
      }
    });
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.createSession(), "");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0]?.id, "ua-only");
    assert.ok(!service.getSessions().some((session) => session.title === "New session"));
  });
  test("bindLiveTreeObservationLease acquireSessionView throw warns without unhandled rejection or half-applied lease", async () => {
    const boom = new Error("acquireSessionView: session pending is not engine-bound");
    class AcquireThrowsRoster extends ConversationEngineRosterService {
      acquireSessionView(_sessionId) {
        throw boom;
      }
    }
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const failures = [];
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const service = store.add(new AcquireThrowsRoster(
        connection,
        createSessionViewMock(),
        workspaceToolsGate,
        storage
      ));
      store.add(service.onDidFailEngineAction((failure) => {
        failures.push({ sessionId: failure.sessionId, action: failure.action });
      }));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await awaitEngineCatalogRefresh(service);
      assert.strictEqual(service.createSession(), "");
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.ok(failures.some((failure) => failure.action === "acquireSessionView"));
      assert.strictEqual(service.getSessions().length, 1);
      assert.strictEqual(service.getSessions()[0]?.id, "ua-only");
      assert.ok(!service.getSessions().some((session) => session.title === "New session"));
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected createSession bind failure keeps existing catalog session", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async (sessionId) => {
        if (sessionId === "ua-only") {
          return `lease:${sessionId}`;
        }
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: true, correlation: { id: "mock" } }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.createSession(), "");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0]?.id, "ua-only");
  });
  test("disconnected after engine createSession skips unary and does not seed stub", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.createSession(), "");
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(service.getSessions().length, 1);
    assert.strictEqual(service.getSessions()[0]?.id, "ua-only");
    assert.ok(!service.getSessions().some((session) => session.id === "untitled"));
  });
  test("connected setSessionGoal forwards PermissionService.SetSessionGoal", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    let fired = "";
    store.add(service.onDidChangeSession((id) => {
      fired = id;
    }));
    assert.strictEqual(service.setSessionGoal("ua-only", "  Ship the slice  "), true);
    assert.strictEqual(service.getSessionGoal("ua-only"), "Ship the slice");
    assert.strictEqual(fired, "ua-only");
    assert.deepStrictEqual(connection.setGoalCalls, [{ sessionId: "ua-only", goal: "Ship the slice" }]);
    assert.strictEqual(service.setSessionGoal("ua-only", "Ship the slice"), false);
    assert.strictEqual(service.setSessionGoal("ua-only", "   "), false);
    assert.strictEqual(service.setSessionGoal("missing", "Nope"), false);
    assert.strictEqual(connection.setGoalCalls.length, 1);
    assert.strictEqual(service.cancelSessionGoal("ua-only"), true);
    assert.strictEqual(service.getSessionGoal("ua-only"), void 0);
    assert.deepStrictEqual(connection.cancelGoalCalls, [{ sessionId: "ua-only" }]);
    assert.strictEqual(service.cancelSessionGoal("missing"), false);
    assert.strictEqual(connection.cancelGoalCalls.length, 1);
  });
  test("connected setSessionGoal remote throw rolls back getSessionGoal", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      connection.setGoalError = new Error("boom");
      assert.strictEqual(service.setSessionGoal("ua-only", "Ship the slice"), true);
      assert.strictEqual(service.getSessionGoal("ua-only"), "Ship the slice");
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getSessionGoal("ua-only"), void 0);
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected setSessionGoal ok:false rolls back prior getSessionGoal", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.setSessionGoal("ua-only", "Prior goal"), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getSessionGoal("ua-only"), "Prior goal");
    connection.setGoalResult = { ok: false, message: "denied" };
    assert.strictEqual(service.setSessionGoal("ua-only", "Next goal"), true);
    assert.strictEqual(service.getSessionGoal("ua-only"), "Next goal");
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getSessionGoal("ua-only"), "Prior goal");
  });
  test("connected cancelSessionGoal remote throw or ok:false restores prior goal", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.setSessionGoal("ua-only", "Prior goal"), true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getSessionGoal("ua-only"), "Prior goal");
      connection.cancelGoalError = new Error("boom");
      assert.strictEqual(service.cancelSessionGoal("ua-only"), true);
      assert.strictEqual(service.getSessionGoal("ua-only"), void 0);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getSessionGoal("ua-only"), "Prior goal");
      assert.deepStrictEqual(unhandledRejections, []);
      connection.cancelGoalError = void 0;
      connection.cancelGoalResult = { ok: false, message: "denied" };
      assert.strictEqual(service.cancelSessionGoal("ua-only"), true);
      assert.strictEqual(service.getSessionGoal("ua-only"), void 0);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.getSessionGoal("ua-only"), "Prior goal");
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected forkSubAgent forwards AgentService.Fork", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.forkSubAgent("ua-only", { name: "  reviewer  ", task: "  Review the diff  " }), true);
    assert.deepStrictEqual(connection.forkCalls, [{
      sessionId: "ua-only",
      parentAgentId: "root",
      name: "reviewer",
      task: "Review the diff"
    }]);
    assert.strictEqual(service.forkSubAgent("ua-only", { parentAgentId: "  sub:a  " }), true);
    assert.strictEqual(connection.forkCalls[1]?.parentAgentId, "sub:a");
    assert.strictEqual(service.forkSubAgent("missing", { name: "Nope" }), false);
    assert.strictEqual(connection.forkCalls.length, 2);
  });
  test("connected forkSubAgent uses last streaming agent as parent", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const originalGetTurns = service.getTurns.bind(service);
    service.getTurns = (sessionId) => {
      if (sessionId === "ua-only") {
        return [{ id: "a1", kind: "assistant", text: "live", streaming: true, agentId: "sub:live" }];
      }
      return originalGetTurns(sessionId);
    };
    assert.strictEqual(service.forkSubAgent("ua-only"), true);
    assert.strictEqual(connection.forkCalls[0]?.parentAgentId, "sub:live");
  });
  test("disconnected after engine forkSubAgent skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.forkSubAgent("ua-only", { name: "reviewer" }), false);
    assert.strictEqual(connection.forkCalls.length, 0);
  });
  test("connected killSubAgent forwards AgentService.Kill", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.killSubAgent("ua-only", { agentId: "  sub:reviewer  ", force: true }), true);
    assert.deepStrictEqual(connection.killCalls, [{
      sessionId: "ua-only",
      agentId: "sub:reviewer",
      force: true
    }]);
    assert.strictEqual(service.killSubAgent("ua-only"), true);
    assert.notStrictEqual(connection.killCalls[1]?.agentId, "root");
    assert.strictEqual(connection.killCalls[1]?.agentId, "");
    assert.strictEqual(connection.killCalls[1]?.force, void 0);
    assert.strictEqual(service.killSubAgent("ua-only", { agentId: "   " }), true);
    assert.notStrictEqual(connection.killCalls[2]?.agentId, "root");
    assert.strictEqual(connection.killCalls[2]?.agentId, "");
    assert.strictEqual(service.killSubAgent("missing", { agentId: "sub:a" }), false);
    assert.strictEqual(connection.killCalls.length, 3);
  });
  test("connected killSubAgent does not default empty agent to root", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.killSubAgent("ua-only"), true);
    assert.notStrictEqual(connection.killCalls[0]?.agentId, "root");
    assert.strictEqual(connection.killCalls[0]?.agentId, "");
  });
  test("connected killSubAgent uses last streaming agent when omitted and never defaults to root", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.killSubAgent("ua-only"), true);
    assert.notStrictEqual(connection.killCalls[0]?.agentId, "root");
    assert.strictEqual(connection.killCalls[0]?.agentId, "");
    const originalGetTurns = service.getTurns.bind(service);
    service.getTurns = (sessionId) => {
      if (sessionId === "ua-only") {
        return [{ id: "a1", kind: "assistant", text: "live", streaming: true, agentId: "sub:live" }];
      }
      return originalGetTurns(sessionId);
    };
    assert.strictEqual(service.killSubAgent("ua-only"), true);
    assert.strictEqual(connection.killCalls[1]?.agentId, "sub:live");
  });
  test("connected updateUserTurnText forwards AgentService.EditMessage", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.updateUserTurnText("ua-only", "  turn-1  ", "  later  "), true);
    assert.deepStrictEqual(connection.editMessageCalls, [{
      sessionId: "ua-only",
      turnId: "turn-1",
      newContent: "later",
      agentId: "root"
    }]);
    assert.strictEqual(service.updateUserTurnText("ua-only", "   ", "Nope"), false);
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-2", "   "), false);
    assert.strictEqual(service.updateUserTurnText("missing", "turn-2", "Nope"), false);
    assert.strictEqual(connection.editMessageCalls.length, 1);
    connection.editMessage = void 0;
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-3", "Nope"), false);
    assert.strictEqual(connection.editMessageCalls.length, 1);
  });
  test("connected updateUserTurnText uses root when agentId is omitted even if another agent is streaming", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    stubCachedProjection(service, "ua-only", projectionWithStreamingAgent("ua-only", "sub:live"));
    const originalGetTurns = service.getTurns.bind(service);
    service.getTurns = (sessionId) => {
      if (sessionId === "ua-only") {
        return [{ id: "a1", kind: "assistant", text: "live", streaming: true, agentId: "sub:live" }];
      }
      return originalGetTurns(sessionId);
    };
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-live", "revised"), true);
    assert.strictEqual(connection.editMessageCalls[0]?.agentId, "root");
    assert.strictEqual(connection.editMessageCalls[0]?.turnId, "turn-live");
    assert.strictEqual(connection.editMessageCalls[0]?.newContent, "revised");
  });
  test("connected updateUserTurnText forwards the caller agentId instead of the streaming agent", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    stubCachedProjection(service, "ua-only", projectionWithStreamingAgent("ua-only", "sub:live"));
    const originalGetTurns = service.getTurns.bind(service);
    service.getTurns = (sessionId) => {
      if (sessionId === "ua-only") {
        return [{ id: "a1", kind: "assistant", text: "live", streaming: true, agentId: "sub:live" }];
      }
      return originalGetTurns(sessionId);
    };
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-live", "revised", "coder"), true);
    assert.strictEqual(connection.editMessageCalls[0]?.agentId, "coder");
    assert.strictEqual(connection.editMessageCalls[0]?.turnId, "turn-live");
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-live", "again", "   "), true);
    assert.strictEqual(connection.editMessageCalls[1]?.agentId, "root");
  });
  test("disconnected after engine updateUserTurnText skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.updateUserTurnText("ua-only", "turn-1", "later"), false);
    assert.strictEqual(connection.editMessageCalls.length, 0);
  });
  test("connected cancelToolCall forwards AgentService.CancelToolCall", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "  tc-1  ", agentId: "  sub:a  " }), true);
    assert.deepStrictEqual(connection.cancelToolCallCalls, [{
      sessionId: "ua-only",
      agentId: "sub:a",
      toolCallId: "tc-1"
    }]);
    assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "tc-2" }), true);
    assert.deepStrictEqual(connection.cancelToolCallCalls[1], {
      sessionId: "ua-only",
      agentId: "root",
      toolCallId: "tc-2"
    });
    assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "   " }), false);
    assert.strictEqual(service.cancelToolCall("missing", { toolCallId: "tc-3" }), false);
    assert.strictEqual(connection.cancelToolCallCalls.length, 2);
  });
  test("connected cancelToolCall uses last streaming agent when omitted", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const originalGetTurns = service.getTurns.bind(service);
    service.getTurns = (sessionId) => {
      if (sessionId === "ua-only") {
        return [{ id: "a1", kind: "assistant", text: "live", streaming: true, agentId: "sub:live" }];
      }
      return originalGetTurns(sessionId);
    };
    assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "tc-live" }), true);
    assert.strictEqual(connection.cancelToolCallCalls[0]?.agentId, "sub:live");
    assert.strictEqual(connection.cancelToolCallCalls[0]?.toolCallId, "tc-live");
  });
  test("connected retryError posts continueGeneration on the held lease and does not open a UI stream", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = new MockUniverseAgentSessionView();
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage, sessionView));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    const viewLease = store.add(service.acquireSessionView("ua-only"));
    assert.ok(await viewLease.whenBindReady?.());
    assert.strictEqual(service.retryError("ua-only", { messageId: "  msg-1  ", turnId: "  turn-1  ", agentId: "  sub:a  " }), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepStrictEqual(sessionView.postCalls.map((call) => call.msg), [{
      kind: "continueGeneration",
      agentId: "sub:a",
      turnId: "turn-1",
      messageId: "msg-1"
    }]);
    assert.deepStrictEqual(connection.continuationOpens, []);
    assert.strictEqual(service.retryError("ua-only", { messageId: "msg-2" }), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepStrictEqual(sessionView.postCalls[1]?.msg, {
      kind: "continueGeneration",
      agentId: "root",
      turnId: "msg-2",
      messageId: "msg-2"
    });
    assert.strictEqual(service.retryError("ua-only", { messageId: "   " }), false);
    assert.strictEqual(service.retryError("missing", { messageId: "msg-3" }), false);
    assert.strictEqual(sessionView.postCalls.length, 2);
    connection.openContinuationStream = void 0;
    assert.strictEqual(service.retryError("ua-only", { messageId: "msg-4" }), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(sessionView.postCalls.length, 3);
    assert.deepStrictEqual(connection.continuationOpens, []);
  });
  test("connected retryError uses last streaming agent when omitted", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = new MockUniverseAgentSessionView();
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage, sessionView));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    const viewLease = store.add(service.acquireSessionView("ua-only"));
    assert.ok(await viewLease.whenBindReady?.());
    const originalGetTurns = service.getTurns.bind(service);
    service.getTurns = (sessionId) => {
      if (sessionId === "ua-only") {
        return [{ id: "a1", kind: "assistant", text: "live", streaming: true, agentId: "sub:live" }];
      }
      return originalGetTurns(sessionId);
    };
    assert.strictEqual(service.retryError("ua-only", { messageId: "msg-live", turnId: "turn-live" }), true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepStrictEqual(sessionView.postCalls[0]?.msg, {
      kind: "continueGeneration",
      agentId: "sub:live",
      turnId: "turn-live",
      messageId: "msg-live"
    });
    assert.deepStrictEqual(connection.continuationOpens, []);
  });
  test("disconnected after engine retryError skips ContinueGeneration", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = new MockUniverseAgentSessionView();
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage, sessionView));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.retryError("ua-only", { messageId: "msg-1" }), false);
    assert.strictEqual(connection.continuationOpens.length, 0);
    assert.deepStrictEqual(sessionView.postCalls, []);
  });
  test("connected resolveConfirmation forwards PermissionService.Respond", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.resolveConfirmation("ua-only", "  req-1  ", "allowed"), true);
    assert.deepStrictEqual(connection.respondPermissionCalls, [{
      sessionId: "ua-only",
      requestId: "req-1",
      granted: true
    }]);
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-2", "skipped"), true);
    assert.deepStrictEqual(connection.respondPermissionCalls[1], {
      sessionId: "ua-only",
      requestId: "req-2",
      granted: false
    });
    assert.strictEqual(service.resolveConfirmation("ua-only", "   ", "allowed"), false);
    assert.strictEqual(service.resolveConfirmation("missing", "req-3", "allowed"), false);
    assert.strictEqual(connection.respondPermissionCalls.length, 2);
    connection.respondPermission = void 0;
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-4", "allowed"), false);
    assert.strictEqual(connection.respondPermissionCalls.length, 2);
  });
  test("connected respondClientTool forwards AgentService.SendClientToolResponse", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.respondClientTool("ua-only", "  call-1  ", { content: '{"ok":true}', isError: false }), true);
    assert.deepStrictEqual(connection.sendClientToolResponseCalls, [{
      sessionId: "ua-only",
      callId: "call-1",
      content: '{"ok":true}',
      isError: void 0,
      metadataJson: void 0
    }]);
    assert.strictEqual(service.respondClientTool("ua-only", "call-2", { content: "boom", isError: true, metadataJson: '{"src":"ide"}' }), true);
    assert.deepStrictEqual(connection.sendClientToolResponseCalls[1], {
      sessionId: "ua-only",
      callId: "call-2",
      content: "boom",
      isError: true,
      metadataJson: '{"src":"ide"}'
    });
    assert.strictEqual(service.respondClientTool("ua-only", "   ", { content: "Nope" }), false);
    assert.strictEqual(service.respondClientTool("missing", "call-3", { content: "Nope" }), false);
    assert.strictEqual(connection.sendClientToolResponseCalls.length, 2);
    connection.sendClientToolResponse = void 0;
    assert.strictEqual(service.respondClientTool("ua-only", "call-4", { content: "Nope" }), false);
    assert.strictEqual(connection.sendClientToolResponseCalls.length, 2);
  });
  test("disconnected after engine respondClientTool skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.respondClientTool("ua-only", "call-1", { content: "{}" }), false);
    assert.strictEqual(connection.sendClientToolResponseCalls.length, 0);
  });
  test("client-tool accepted cleanup requires an explicit ok:true result", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.sendClientToolResponse = async () => void 0;
    assert.strictEqual(service.respondClientTool("ua-only", "call-malformed", { content: "late" }), true);
    assert.strictEqual(await service.whenDispatchedEngineActionSettles(), false);
    connection.sendClientToolResponse = async () => ({ ok: 1 });
    assert.strictEqual(service.respondClientTool("ua-only", "call-malformed-2", { content: "late" }), true);
    assert.strictEqual(await service.whenDispatchedEngineActionSettles(), false);
  });
  test("connected respondQuestion forwards AgentService.RespondQuestion", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.respondQuestion("ua-only", "  q-1  ", { itemA: { selectedLabels: ["yes"] } }, "other"), true);
    assert.deepStrictEqual(connection.respondQuestionCalls, [{
      sessionId: "ua-only",
      questionId: "q-1",
      answers: { itemA: { selectedLabels: ["yes"] } },
      customText: "other"
    }]);
    assert.strictEqual(service.respondQuestion("ua-only", "q-2"), true);
    assert.deepStrictEqual(connection.respondQuestionCalls[1], {
      sessionId: "ua-only",
      questionId: "q-2",
      answers: void 0,
      customText: void 0
    });
    assert.strictEqual(service.respondQuestion("ua-only", "   ", { itemA: { selectedLabels: ["yes"] } }), false);
    assert.strictEqual(service.respondQuestion("missing", "q-3"), false);
    assert.strictEqual(connection.respondQuestionCalls.length, 2);
    connection.respondQuestion = void 0;
    assert.strictEqual(service.respondQuestion("ua-only", "q-4"), false);
    assert.strictEqual(connection.respondQuestionCalls.length, 2);
  });
  test("disconnected after engine respondQuestion skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.respondQuestion("ua-only", "q-1", { itemA: { selectedLabels: ["yes"] } }), false);
    assert.strictEqual(connection.respondQuestionCalls.length, 0);
  });
  test("disconnected after engine resolveConfirmation skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-1", "allowed"), false);
    assert.strictEqual(connection.respondPermissionCalls.length, 0);
  });
  test("response recovery disconnected seat normal permission clicks keep both cached panes pending and the model unchanged", async () => {
    const { service, connection, sessionView, cachedLease } = await disconnectedResponseSeat(store);
    const otherLease = store.add(service.acquireSessionView("ua-only"));
    const first = responseSeatRoute(store, service, connection, cachedLease);
    const second = responseSeatRoute(store, service, connection, otherLease);
    const modelBefore = JSON.stringify(service.getTurns("ua-only"));
    const pendingBefore = JSON.stringify(cachedLease.snapshot.pendingActions);
    second.timeline.hide();
    recoveryAction(first.timeline, "permission").click();
    await first.whenSettled();
    assert.strictEqual(JSON.stringify(service.getTurns("ua-only")), modelBefore, "a disconnected click must not authorize the cached model");
    assert.strictEqual(JSON.stringify(cachedLease.snapshot.pendingActions), pendingBefore, "the real cached lease must retain its pending requests");
    second.timeline.show();
    recoveryAction(second.timeline, "permission").click();
    await second.whenSettled();
    for (const pane of [first, second]) {
      assert.strictEqual(pane.timeline.getTimelineRowElement("req-allow")?.textContent?.includes("Allowed"), false);
      assert.strictEqual(recoveryAction(pane.timeline, "permission").getAttribute("aria-disabled"), "true");
      assert.deepStrictEqual(pane.posted, []);
      assert.deepStrictEqual(pane.focused, []);
    }
    assert.strictEqual(JSON.stringify(otherLease.snapshot.pendingActions), pendingBefore);
    assert.strictEqual(connection.respondPermissionCalls.length, 0);
    assert.strictEqual(sessionView.postCalls.length, 0);
  });
  for (const kind of ["permission", "question", "clientTool"]) {
    test(`response recovery disconnected seat ${kind} callback rejects before the cached stub route`, async () => {
      const { service, connection, sessionView, cachedLease } = await disconnectedResponseSeat(store);
      const pane = responseSeatRoute(store, service, connection, cachedLease);
      const before = JSON.stringify([service.getTurns("ua-only"), cachedLease.snapshot]);
      if (kind === "permission") {
        await resolveConfirmation(pane.binding, "req-allow", "allowed");
      } else if (kind === "question") {
        await resolveQuestion(pane.binding, "q-ask:row", "q-ask", { radio: { selectedLabels: ["first"] } });
      } else {
        respondClientTool(pane.binding, { id: "call-ask" });
      }
      assert.strictEqual(JSON.stringify([service.getTurns("ua-only"), cachedLease.snapshot]), before, "a late response callback must leave the actual cached model and pending requests untouched");
      assert.deepStrictEqual(pane.failures, ["engine_disconnected"]);
      assert.deepStrictEqual(pane.posted, []);
      assert.deepStrictEqual(pane.focused, []);
      assert.strictEqual(connection.respondPermissionCalls.length + connection.respondQuestionCalls.length + connection.sendClientToolResponseCalls.length, 0);
      assert.strictEqual(sessionView.postCalls.length, 0);
    });
    test(`response recovery disconnected seat ${kind} postBound rejects implicit and captured cached leases`, async () => {
      const { service, connection, sessionView, cachedLease } = await disconnectedResponseSeat(store);
      const pane = responseSeatRoute(store, service, connection, cachedLease);
      const message = kind === "permission" ? { kind: "permissionRespond", requestId: "req-allow", decision: "allow" } : kind === "question" ? { kind: "questionRespond", requestId: "q-ask", answers: { radio: { selectedLabels: ["first"] } } } : { kind: "clientToolRespond", requestId: "call-ask", resultJson: "{}" };
      const before = JSON.stringify([service.getTurns("ua-only"), cachedLease.snapshot]);
      for (const captured of [void 0, cachedLease]) {
        const outcome = await postBound(pane.route, message, captured);
        assert.strictEqual(JSON.stringify([service.getTurns("ua-only"), cachedLease.snapshot]), before, "the final post door must not mutate or clear a cached request");
        assert.deepStrictEqual(outcome, { accepted: false, reason: "no_such_session" });
      }
      assert.deepStrictEqual(pane.failures, [], "the final transport door leaves UI notices to the response callback");
      assert.strictEqual(connection.respondPermissionCalls.length + connection.respondQuestionCalls.length + connection.sendClientToolResponseCalls.length, 0);
      assert.strictEqual(sessionView.postCalls.length, 0);
    });
  }
  test("response recovery disconnected seat reconnect restores the real permission route in both panes", async () => {
    const { service, connection, sessionView, cachedLease } = await disconnectedResponseSeat(store);
    const first = responseSeatRoute(store, service, connection, cachedLease);
    const second = responseSeatRoute(store, service, connection, store.add(service.acquireSessionView("ua-only")));
    assert.strictEqual(recoveryAction(first.timeline, "permission").getAttribute("aria-disabled"), "true");
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    const firstLive = store.add(service.acquireSessionView("ua-only"));
    const secondLive = store.add(service.acquireSessionView("ua-only"));
    sessionView.emitGeneration(responseRecoverySnapshot("ua-only"), 2);
    await timeout(0);
    first.rebind(firstLive);
    second.rebind(secondLive);
    assert.strictEqual(recoveryAction(first.timeline, "permission").getAttribute("aria-disabled"), "false");
    assert.strictEqual(recoveryAction(second.timeline, "permission").getAttribute("aria-disabled"), "false");
    recoveryAction(first.timeline, "permission").click();
    await first.whenSettled();
    assert.strictEqual(await service.whenDispatchedEngineActionSettles(), true);
    assert.deepStrictEqual(connection.respondPermissionCalls, [{ sessionId: "ua-only", requestId: "req-allow", granted: true }]);
    for (const pane of [first, second]) {
      assert.ok(pane.timeline.getTimelineRowElement("req-allow")?.textContent?.includes("Allowed"));
      assert.deepStrictEqual(pane.posted, []);
      assert.deepStrictEqual(pane.failures, []);
      assert.ok(!pane.route.sessionViewLease.snapshot.pendingActions.some((action) => action.requestId === "req-allow"));
    }
    assert.strictEqual(sessionView.postCalls.length, 0);
  });
  test("response recovery disconnected seat never-connected local stub still authorizes through the real callback and captured lease", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const service = store.add(createService(connection));
    const sessionId = service.getActiveSessionId();
    const request = service.appendConfirmationTurn(sessionId, "Local permission");
    assert.ok(request);
    const lease = store.add(service.acquireSessionView(sessionId));
    const pane = responseSeatRoute(store, service, connection, lease);
    pane.timeline.revealTurn(request.id);
    assert.strictEqual(service.hasEngineConnectionHistory(), false);
    assert.strictEqual(service.getSessionSource(sessionId), "local");
    const allow = pane.timeline.getTimelineRowElement(request.id)?.querySelector(".conversation-lens-confirmation-actions .monaco-button");
    assert.ok(allow);
    assert.strictEqual(allow.getAttribute("aria-disabled"), "false");
    allow.click();
    await pane.whenSettled();
    assert.strictEqual(service.getTurns(sessionId).find((turn) => turn.id === request.id)?.status, "allowed");
    assert.ok(!lease.snapshot.pendingActions.some((action) => action.requestId === request.id));
    assert.deepStrictEqual(pane.failures, []);
    const next = service.appendConfirmationTurn(sessionId, "Local captured permission");
    assert.ok(next);
    const outcome = await postBound(pane.route, { kind: "permissionRespond", requestId: next.id, decision: "deny" }, lease);
    assert.strictEqual(outcome.accepted, true);
    assert.strictEqual(service.getTurns(sessionId).find((turn) => turn.id === next.id)?.status, "skipped");
    assert.strictEqual(connection.respondPermissionCalls.length, 0);
  });
  test("response recovery disconnected seat keeps pairing and connected-not-ready response gates", async () => {
    const { service, connection, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot, false);
    const pane = responseSeatRoute(store, service, connection, lease);
    connection.setPairingPending(true);
    await resolveConfirmation(pane.binding, "req-allow", "allowed");
    assert.strictEqual(isReadingColumnWritesEnabled(pane.route), false);
    assert.deepStrictEqual(pane.failures, ["engine_disconnected"]);
    assert.deepStrictEqual(await postBound(pane.route, { kind: "permissionRespond", requestId: "req-allow", decision: "allow" }, lease), { accepted: false, reason: "no_such_session" });
    connection.listSessionsError = new Error("list unavailable");
    connection.setPairingPending(false);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(service.isEngineSessionReady(), false);
    await resolveConfirmation(pane.binding, "req-allow", "allowed");
    assert.strictEqual(isReadingColumnWritesEnabled(pane.route), false);
    assert.deepStrictEqual(pane.failures, ["engine_disconnected", "session_not_ready"]);
    assert.deepStrictEqual(await postBound(pane.route, { kind: "permissionRespond", requestId: "req-allow", decision: "allow" }, lease), { accepted: false, reason: "no_such_session" });
    assert.deepStrictEqual(pane.posted, []);
    assert.strictEqual(connection.respondPermissionCalls.length, 0);
    assert.ok(lease.snapshot.pendingActions.some((action) => action.requestId === "req-allow"));
  });
  for (const kind of ["permission", "question", "clientTool"]) {
    for (const outcome of ["false", "reject"]) {
      test(`response recovery business ${kind} unary ${outcome} restores the actual seat and retries once`, async () => {
        const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot);
        const host = responseRecoveryHost(store, service, lease);
        const pending = new DeferredPromise();
        connection.writePending = pending.p;
        const original = JSON.stringify([lease.snapshot.timeline, lease.snapshot.pendingActions]);
        const acknowledgements = sessionView.acknowledgeCalls.length;
        if (kind === "question") {
          chooseRecoveryAnswers(host);
          host.domNode.querySelector(".conversation-lens-question-custom").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        } else {
          recoveryAction(host, kind).click();
        }
        assert.strictEqual(recoveryAction(host, kind).getAttribute("aria-disabled"), "true", "all real response paths must show the shared busy hold");
        if (outcome === "false") {
          await pending.complete({ ok: false, message: "wire refused" });
        } else {
          await pending.error(new Error("wire rejected"));
        }
        assert.strictEqual(await service.whenDispatchedEngineActionSettles(), false);
        assert.ok(host.domNode.textContent?.includes(outcome === "false" ? "wire refused" : "wire rejected"), "unary failure must reach the actual seat without a stream failure");
        assert.strictEqual(recoveryAction(host, kind).getAttribute("aria-disabled"), "false");
        assert.strictEqual(JSON.stringify([lease.snapshot.timeline, lease.snapshot.pendingActions]), original, "failure is a sidecar-only change");
        assert.strictEqual(sessionView.acknowledgeCalls.length, acknowledgements, "local busy/failure must not acknowledge the host");
        if (kind === "question") {
          assert.deepStrictEqual({
            radio: host.domNode.querySelectorAll('[role="radio"]')[1].getAttribute("aria-checked"),
            check: host.domNode.querySelectorAll('[role="checkbox"]')[1].getAttribute("aria-checked"),
            custom: host.domNode.querySelector(".conversation-lens-question-custom")?.value
          }, { radio: "true", check: "true", custom: "keep this answer" });
        }
        const retry = new DeferredPromise();
        connection.writePending = retry.p;
        recoveryAction(host, kind).click();
        sessionView.emitPatches("ua-only", [{ op: "setSyncChrome", sync: { kind: "live" } }]);
        assert.strictEqual(recoveryAction(host, kind).getAttribute("aria-disabled"), "true", "unrelated redraw cannot release the retry hold");
        recoveryAction(host, kind).click();
        const calls = kind === "permission" ? connection.respondPermissionCalls : kind === "question" ? connection.respondQuestionCalls : connection.sendClientToolResponseCalls;
        assert.strictEqual(calls.length, 2, "one original and one retry unary");
        if (kind === "question") {
          assert.deepStrictEqual(connection.respondQuestionCalls.map((call) => ({ answers: call.answers, customText: call.customText })), [0, 1].map(() => ({
            answers: { radio: { selectedLabels: ["second"] }, checks: { selectedLabels: ["y"] }, custom: { selectedLabels: [] } },
            customText: "keep this answer"
          })));
        }
        await retry.complete({ ok: true });
        assert.strictEqual(await service.whenDispatchedEngineActionSettles(), true);
        const repeated = kind === "permission" ? service.resolveConfirmation("ua-only", "req-allow", "allowed") : kind === "question" ? service.respondQuestion("ua-only", "q-ask", {}) : service.respondClientTool("ua-only", "call-ask", { content: "again" });
        assert.strictEqual(repeated, false, "an accepted terminal request is blocked, never untracked forwarding");
        assert.strictEqual(calls.length, 2);
        assert.deepStrictEqual(sessionView.postCalls, [], "unary response never adds a Chat/post write");
        assert.ok(lease.snapshot.pendingActions.some((action) => String(action.requestId) === "req-deny"), "another request stays pending");
      });
    }
  }
  test("response recovery shared begin blocks a second leaf and synchronous notification reentry", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot);
    const second = store.add(service.acquireSessionView("ua-only"));
    await timeout(0);
    const firstHost = responseRecoveryHost(store, service, lease);
    const secondHost = responseRecoveryHost(store, service, second);
    const pending = new DeferredPromise();
    connection.writePending = pending.p;
    const failures = [];
    store.add(service.onDidFailEngineAction((event) => failures.push(event.action)));
    let reentered = false;
    store.add(lease.onDidApplyFrame(() => {
      if (!reentered) {
        reentered = true;
        assert.strictEqual(lease.responseProjection, second.responseProjection, "all consumers install the same state before the first listener");
        secondHost.domNode.querySelector('[data-turn-id="req-allow"] .monaco-button').click();
        assert.strictEqual(service.resolveConfirmation("ua-only", "req-allow", "skipped"), true);
      }
    }));
    recoveryAction(firstHost, "permission").click();
    assert.deepStrictEqual({ calls: connection.respondPermissionCalls.length, reentered, failures }, { calls: 1, reentered: true, failures: [] });
    assert.strictEqual(recoveryAction(secondHost, "permission").getAttribute("aria-disabled"), "true");
    await pending.complete({ ok: false, message: "shared refusal" });
    await service.whenDispatchedEngineActionSettles();
    assert.ok(firstHost.domNode.textContent?.includes("shared refusal"));
    assert.ok(secondHost.domNode.textContent?.includes("shared refusal"));
    const late = store.add(service.acquireSessionView("ua-only"));
    await timeout(0);
    const lateHost = responseRecoveryHost(store, service, late);
    assert.ok(lateHost.domNode.textContent?.includes("shared refusal"));
    assert.deepStrictEqual(sessionView.postCalls, []);
  });
  for (const removed of ["pending", "timeline"]) {
    for (const oldOutcome of ["false", "reject", "accepted"]) {
      test(`response recovery same-frame ${removed} ${oldOutcome} remove/re-add clears draft and busy despite an equal final snapshot`, async () => {
        const questionOnly = (sessionId) => {
          const base = responseRecoverySnapshot(sessionId);
          return { ...base, timeline: base.timeline.filter((row) => row.summary.kind === "question"), pendingActions: base.pendingActions.filter((action) => action.summary.kind === "question") };
        };
        const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, questionOnly);
        const host = responseRecoveryHost(store, service, lease);
        chooseRecoveryAnswers(host);
        const pending = new DeferredPromise();
        connection.writePending = pending.p;
        recoveryAction(host, "question").click();
        const original = JSON.stringify(lease.snapshot);
        const notifications = [];
        store.add(lease.onDidApplyFrame((event) => {
          if (event.kind === "patches") {
            notifications.push([...event.changedIds]);
          }
        }));
        const patches = removed === "pending" ? [{ op: "removePendingAction", requestId: lease.snapshot.pendingActions[0].requestId }, { op: "upsertPendingAction", action: lease.snapshot.pendingActions[0] }] : [{ op: "removeTimelineItem", itemId: lease.snapshot.timeline[0].id }, { op: "upsertTimelineItem", item: lease.snapshot.timeline[0] }];
        sessionView.emitPatches("ua-only", patches);
        assert.strictEqual(JSON.stringify(lease.snapshot), original);
        assert.ok(notifications.some((ids) => ids.includes("q-ask:row") && ids.includes("pending:q-ask")));
        assert.deepStrictEqual({
          custom: host.domNode.querySelector(".conversation-lens-question-custom")?.value,
          checked: host.domNode.querySelectorAll('[role="checkbox"][aria-checked="true"]').length,
          busy: recoveryAction(host, "question").getAttribute("aria-disabled")
        }, { custom: "", checked: 0, busy: "false" });
        if (oldOutcome === "reject") {
          await pending.error(new Error("stale transport"));
        } else {
          await pending.complete({ ok: oldOutcome === "accepted" });
        }
        await service.whenDispatchedEngineActionSettles();
        assert.ok(lease.snapshot.pendingActions.some((action) => String(action.requestId) === "q-ask"));
        assert.ok(!host.domNode.textContent?.includes("Couldn't send this response"), "old incarnation outcome cannot alter the replacement");
        assert.strictEqual(connection.respondQuestionCalls.length, 1);
      });
    }
  }
  test("response recovery authoritative and connection generation changes clear drafts and reject late outcomes", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot);
    const host = responseRecoveryHost(store, service, lease);
    chooseRecoveryAnswers(host);
    const pending = new DeferredPromise();
    connection.writePending = pending.p;
    recoveryAction(host, "question").click();
    sessionView.emitPatches("ua-only", [{ op: "setSyncChrome", sync: { kind: "live" } }]);
    sessionView.emitGeneration(lease.snapshot, 1);
    assert.strictEqual(host.domNode.querySelector(".conversation-lens-question-custom")?.value, "keep this answer");
    assert.strictEqual(recoveryAction(host, "question").getAttribute("aria-disabled"), "true", "same-generation same-request baseline preserves busy and draft");
    sessionView.emitGeneration(lease.snapshot, 2);
    assert.strictEqual(host.domNode.querySelector(".conversation-lens-question-custom")?.value, "");
    assert.strictEqual(recoveryAction(host, "question").getAttribute("aria-disabled"), "false");
    await pending.complete({ ok: true });
    await service.whenDispatchedEngineActionSettles();
    assert.ok(lease.snapshot.pendingActions.some((action) => String(action.requestId) === "q-ask"), "old accepted response cannot settle a new generation");
    chooseRecoveryAnswers(host);
    service.setEngineConnected(false);
    assert.strictEqual(host.domNode.querySelector(".conversation-lens-question-custom")?.value, "");
    assert.strictEqual(service.respondQuestion("ua-only", "q-ask", {}), false);
    assert.strictEqual(connection.respondQuestionCalls.length, 1);
  });
  test("response recovery untracked forwarding never cleans a request that appears before the callback", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot);
    const pending = new DeferredPromise();
    connection.writePending = pending.p;
    assert.strictEqual(service.respondQuestion("ua-only", "new-q", { item: { selectedLabels: ["yes"] } }), true);
    const question = { requestId: "new-q", summary: {
      kind: "question",
      title: "New incarnation",
      answerKeysValid: true,
      items: [{ id: "item", title: "Pick", optionsPreview: ["yes", "no"] }]
    } };
    sessionView.emitPatches("ua-only", [{ op: "upsertPendingAction", action: question }]);
    await pending.complete({ ok: true });
    await service.whenDispatchedEngineActionSettles();
    assert.ok(lease.snapshot.pendingActions.some((action) => String(action.requestId) === "new-q"));
    assert.ok([...lease.responseProjection.byRequest.values()].filter((state) => state.identity.requestId === "new-q").every((state) => !state.inFlight && !state.failure));
    assert.deepStrictEqual(sessionView.postCalls, []);
  });
  test("response recovery review I1 timeline-only clientTool accepted remains blocked after respondable is removed", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, (sessionId) => {
      const snapshot = responseRecoverySnapshot(sessionId);
      return {
        ...snapshot,
        timeline: snapshot.timeline.map((row2) => String(row2.id) === "call-ask" && row2.summary.kind === "tool" ? { ...row2, summary: { ...row2.summary, toolCallId: "call-ask", toolCallIds: ["call-ask"] } } : row2),
        pendingActions: snapshot.pendingActions.filter((action) => String(action.requestId) !== "call-ask")
      };
    });
    const host = responseRecoveryHost(store, service, lease);
    const pending = new DeferredPromise();
    connection.writePending = pending.p;
    recoveryAction(host, "clientTool").click();
    assert.strictEqual(recoveryAction(host, "clientTool").getAttribute("aria-disabled"), "true");
    await pending.complete({ ok: true });
    assert.strictEqual(await service.whenDispatchedEngineActionSettles(), true);
    const row = lease.snapshot.timeline.find((item) => String(item.id) === "call-ask");
    assert.ok(row?.summary.kind === "tool" && row.summary.status === "completed" && row.summary.respondable !== true);
    assert.strictEqual(service.respondClientTool("ua-only", "call-ask", { content: "duplicate" }), false, "known accepted timeline-only identity must be blocked instead of forwarded");
    assert.strictEqual(connection.sendClientToolResponseCalls.length, 1, "accepted cleanup cannot reopen unary forwarding");
    assert.deepStrictEqual(sessionView.postCalls, []);
  });
  for (const oldOutcome of ["false", "reject", "accepted"]) {
    test(`response recovery review I1 timeline-only clientTool authoritative terminal supersedes late ${oldOutcome}`, async () => {
      const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, (sessionId) => {
        const snapshot = responseRecoverySnapshot(sessionId);
        return { ...snapshot, pendingActions: snapshot.pendingActions.filter((action) => String(action.requestId) !== "call-ask") };
      });
      const host = responseRecoveryHost(store, service, lease);
      const pending = new DeferredPromise();
      connection.writePending = pending.p;
      recoveryAction(host, "clientTool").click();
      const row = lease.snapshot.timeline.find((item) => String(item.id) === "call-ask");
      if (row.summary.kind !== "tool") {
        assert.fail("client tool row required");
      }
      const { respondable: _respondable, ...terminalSummary } = row.summary;
      sessionView.emitPatches("ua-only", [{ op: "upsertTimelineItem", item: { ...row, summary: { ...terminalSummary, status: "failed", resultPreview: "authoritative result" } } }]);
      const terminal = JSON.stringify(lease.snapshot);
      assert.strictEqual(service.respondClientTool("ua-only", "call-ask", { content: "duplicate" }), false, "authoritative terminal must close a previously known timeline-only client response");
      if (oldOutcome === "reject") {
        await pending.error(new Error("stale client transport"));
      } else {
        await pending.complete({ ok: oldOutcome === "accepted", message: "stale client transport" });
      }
      await service.whenDispatchedEngineActionSettles();
      assert.strictEqual(JSON.stringify(lease.snapshot), terminal, "late unary cannot overwrite the authoritative terminal result");
      assert.strictEqual(service.respondClientTool("ua-only", "call-ask", { content: "duplicate after late result" }), false);
      assert.strictEqual(connection.sendClientToolResponseCalls.length, 1);
      assert.ok(!host.domNode.textContent?.includes("stale client transport"));
      assert.deepStrictEqual(sessionView.postCalls, []);
    });
  }
  test("response recovery review I1 ordinary terminal tool stays untracked on the public response boundary", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, (sessionId) => {
      const snapshot = responseRecoverySnapshot(sessionId);
      return { ...snapshot, timeline: [...snapshot.timeline, { id: "server-tool", orderKey: "ordinary", summary: { kind: "tool", title: "Server result", toolName: "server", status: "completed" } }] };
    });
    const before = JSON.stringify(lease.snapshot);
    assert.strictEqual(service.respondClientTool("ua-only", "server-tool", { content: "compatibility forwarding" }), true, "an ordinary terminal tool is not a known closed client response");
    await service.whenDispatchedEngineActionSettles();
    assert.strictEqual(connection.sendClientToolResponseCalls.length, 1);
    assert.strictEqual(JSON.stringify(lease.snapshot), before, "untracked forwarding owns no local cleanup");
    assert.ok(!lease.responseProjection?.byRow.has("server-tool"));
    assert.deepStrictEqual(sessionView.postCalls, []);
  });
  for (const transition of ["public disconnect", "connection disconnect"]) {
    test(`response recovery review I2 ${transition} closes writes before synchronous scope notice`, async () => {
      const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot, transition === "public disconnect");
      const scope = lease.responseProjection.scope;
      let attempts;
      store.add(lease.onDidApplyFrame(() => {
        if (attempts || lease.responseProjection.scope === scope) {
          return;
        }
        attempts = [];
        attempts.push(service.resolveConfirmation("ua-only", "req-allow", "allowed"));
        attempts.push(service.respondQuestion("ua-only", "q-ask", { radio: { selectedLabels: ["second"] } }));
        attempts.push(service.respondClientTool("ua-only", "call-ask", { content: "scope reentry" }));
      }));
      if (transition === "public disconnect") {
        service.setEngineConnected(false);
      } else {
        connection.setConnected(false);
      }
      assert.deepStrictEqual(attempts, [false, false, false], "all public response APIs must reject reentry during the real scope notification");
      assert.deepStrictEqual([connection.respondPermissionCalls.length, connection.respondQuestionCalls.length, connection.sendClientToolResponseCalls.length], [0, 0, 0], "scope reentry must not start any unary");
      assert.ok([...lease.responseProjection.byRequest.values()].every((state) => !state.inFlight));
      assert.deepStrictEqual(sessionView.postCalls, []);
    });
  }
  test("response recovery review I2 published identity switch closes writes before synchronous scope notice and preserves cache owners", async () => {
    const storage = store.add(new TestStorageService());
    const cached = (title) => ({ activeSessionId: "ua-only", sessions: [{ id: "ua-only", title, turns: [], source: "engine-cache" }] });
    storage.store(CONVERSATION_ROSTER_STORAGE_KEY, JSON.stringify({ version: 1, wasEverConnected: true, activeSessionId: "ua-only", nextTurnId: 1, localSessions: [], engineCaches: { "engine-a": cached("Cached A"), "engine-b": cached("Cached B") } }), StorageScope.WORKSPACE, StorageTarget.USER);
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Live A" }]);
    connection.setPublishedLink("engine-a", 1, true);
    const sessionView = store.add(new BaselineProjectionSessionView(responseRecoverySnapshot));
    const service = store.add(createService(connection, storage, sessionView));
    await awaitEngineCatalogRefresh(service);
    const lease = store.add(service.acquireSessionView("ua-only"));
    assert.ok(await lease.whenBindReady?.());
    await timeout(0);
    const scope = lease.responseProjection.scope;
    let attempts;
    store.add(lease.onDidApplyFrame(() => {
      if (attempts || lease.responseProjection.scope === scope) {
        return;
      }
      attempts = [];
      attempts.push(service.resolveConfirmation("ua-only", "req-allow", "allowed"));
      attempts.push(service.respondQuestion("ua-only", "q-ask", { radio: { selectedLabels: ["second"] } }));
      attempts.push(service.respondClientTool("ua-only", "call-ask", { content: "identity reentry" }));
    }));
    connection.setListSessions([{ sessionId: "ua-only", title: "Live B" }]);
    connection.setPublishedLink("engine-b", 2, true);
    assert.deepStrictEqual(attempts, [false, false, false], "even a same-id cached session under the new owner cannot start a response during adoption");
    assert.deepStrictEqual([connection.respondPermissionCalls.length, connection.respondQuestionCalls.length, connection.sendClientToolResponseCalls.length], [0, 0, 0]);
    const saved = JSON.parse(storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "{}");
    assert.deepStrictEqual([saved.engineCaches?.["engine-a"]?.sessions[0]?.title, saved.engineCaches?.["engine-b"]?.sessions[0]?.title], ["Live A", "Cached B"], "capture must persist the old catalog under its old identity");
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(sessionView.postCalls, []);
  });
  for (const changed of ["question options", "question items", "clientTool args"]) {
    for (const oldOutcome of ["false", "reject", "accepted"]) {
      test(`response recovery review I3 same-generation baseline ${changed} retires old ${oldOutcome} while pending stays unchanged`, async () => {
        const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot);
        const host = responseRecoveryHost(store, service, lease);
        const kind = changed === "clientTool args" ? "clientTool" : "question";
        const old = new DeferredPromise();
        connection.writePending = old.p;
        if (kind === "question") {
          chooseRecoveryAnswers(host);
        }
        recoveryAction(host, kind).click();
        const oldSettles = service.whenDispatchedEngineActionSettles();
        const pendingActions = lease.snapshot.pendingActions;
        sessionView.emitGeneration(lease.snapshot, 1);
        assert.strictEqual(recoveryAction(host, kind).getAttribute("aria-disabled"), "true", "same semantic baseline replay preserves the live attempt");
        const timeline = lease.snapshot.timeline.map((row) => {
          if (kind === "clientTool" && String(row.id) === "call-ask" && row.summary.kind === "tool") {
            return { ...row, summary: { ...row.summary, argPreview: '{"replacement":true}' } };
          }
          if (kind === "question" && String(row.id) === "q-ask:row" && row.summary.kind === "question") {
            const items = row.summary.items?.map((item, index) => index !== 0 ? item : changed === "question options" ? { ...item, optionsPreview: ["new first", "new second"] } : { ...item, id: "replacement-radio", title: "Replacement choice" });
            return { ...row, summary: { ...row.summary, items } };
          }
          return row;
        });
        sessionView.emitGeneration({ ...lease.snapshot, timeline }, 1);
        assert.strictEqual(lease.snapshot.pendingActions, pendingActions, "only the existing timeline interaction changed");
        assert.strictEqual(recoveryAction(host, kind).getAttribute("aria-disabled"), "false", "a changed materialized row must retire the previous attempt despite the unchanged pending summary");
        if (kind === "question") {
          assert.strictEqual(host.domNode.querySelector(".conversation-lens-question-custom")?.value, "", "replacement question discards the old draft");
          chooseRecoveryAnswers(host);
        }
        const retry = new DeferredPromise();
        connection.writePending = retry.p;
        recoveryAction(host, kind).click();
        assert.strictEqual(recoveryAction(host, kind).getAttribute("aria-disabled"), "true");
        const replacement = JSON.stringify(lease.snapshot);
        if (oldOutcome === "reject") {
          await old.error(new Error("stale baseline response"));
        } else {
          await old.complete({ ok: oldOutcome === "accepted", message: "stale baseline response" });
        }
        await oldSettles;
        assert.strictEqual(JSON.stringify(lease.snapshot), replacement, "old accepted callback cannot clean the replacement interaction");
        assert.strictEqual(recoveryAction(host, kind).getAttribute("aria-disabled"), "true", "old failure cannot end the replacement attempt");
        assert.ok(!host.domNode.textContent?.includes("stale baseline response"));
        assert.strictEqual((kind === "question" ? connection.respondQuestionCalls : connection.sendClientToolResponseCalls).length, 2);
        await retry.complete({ ok: false, message: "replacement response refusal" });
        await service.whenDispatchedEngineActionSettles();
        assert.ok(host.domNode.textContent?.includes("replacement response refusal"), "the current incarnation still receives its own completion");
        assert.deepStrictEqual(sessionView.postCalls, []);
      });
    }
  }
  test("response recovery review I3 pending-only first baseline materialization preserves the live attempt", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, (sessionId) => {
      const snapshot = responseRecoverySnapshot(sessionId);
      return { ...snapshot, timeline: snapshot.timeline.filter((row) => String(row.id) !== "q-ask:row") };
    });
    const host = responseRecoveryHost(store, service, lease);
    const pending = new DeferredPromise();
    connection.writePending = pending.p;
    assert.strictEqual(service.respondQuestion("ua-only", "q-ask", { radio: { selectedLabels: ["second"] } }), true);
    const question = lease.snapshot.pendingActions.find((action) => String(action.requestId) === "q-ask");
    sessionView.emitGeneration({ ...lease.snapshot, timeline: [...lease.snapshot.timeline, { id: "q-ask:row", orderKey: "q", summary: question.summary }] }, 1);
    assert.strictEqual(recoveryAction(host, "question").getAttribute("aria-disabled"), "true", "first materialization is the same pending request");
    assert.strictEqual(service.respondQuestion("ua-only", "q-ask", {}), true);
    assert.strictEqual(connection.respondQuestionCalls.length, 1, "materialization cannot create a second attempt");
    await pending.complete({ ok: false, message: "materialized response refusal" });
    await service.whenDispatchedEngineActionSettles();
    assert.ok(host.domNode.textContent?.includes("materialized response refusal"));
    assert.strictEqual(recoveryAction(host, "question").getAttribute("aria-disabled"), "false");
    assert.deepStrictEqual(sessionView.postCalls, []);
  });
  for (const authoritative of ["retryable", "nonretryable", "terminal"]) {
    for (const oldOutcome of ["false", "reject", "accepted"]) {
      test(`response recovery authoritative ${authoritative} supersedes a late unary ${oldOutcome}`, async () => {
        const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot);
        const host = responseRecoveryHost(store, service, lease);
        const old = new DeferredPromise();
        connection.writePending = old.p;
        recoveryAction(host, "permission").click();
        const oldSettles = service.whenDispatchedEngineActionSettles();
        const original = JSON.stringify(lease.snapshot);
        if (authoritative === "terminal") {
          const row = lease.snapshot.timeline.find((item) => String(item.id) === "req-allow");
          if (row.summary.kind !== "permission") {
            assert.fail("permission row required");
          }
          sessionView.emitPatches("ua-only", [{ op: "upsertTimelineItem", item: { ...row, summary: { ...row.summary, decision: "deny" } } }, { op: "removePendingAction", requestId: "req-allow" }]);
        } else {
          sessionView.emitPatches("ua-only", [{ op: "pendingRespondFailed", requestId: "req-allow", cause: "hostWriteFailed", retryable: authoritative === "retryable", error: "authoritative refusal" }]);
          assert.strictEqual(JSON.stringify(lease.snapshot), original, "failure-only host patch must still revoke the old attempt");
          assert.ok(host.domNode.textContent?.includes("authoritative refusal"));
        }
        const retry = new DeferredPromise();
        if (authoritative === "retryable") {
          connection.writePending = retry.p;
          recoveryAction(host, "permission").click();
        } else {
          assert.strictEqual(service.resolveConfirmation("ua-only", "req-allow", "allowed"), false);
        }
        if (oldOutcome === "reject") {
          await old.error(new Error("stale unary rejection"));
        } else {
          await old.complete({ ok: oldOutcome === "accepted", message: "stale unary refusal" });
        }
        await oldSettles;
        if (authoritative === "retryable") {
          assert.strictEqual(recoveryAction(host, "permission").getAttribute("aria-disabled"), "true", "old callback cannot end a newer retry");
          await retry.complete({ ok: false, message: "current retry refusal" });
          await service.whenDispatchedEngineActionSettles();
          assert.ok(host.domNode.textContent?.includes("current retry refusal"));
          assert.strictEqual(connection.respondPermissionCalls.length, 2);
        } else if (authoritative === "nonretryable") {
          assert.ok(host.domNode.textContent?.includes("authoritative refusal"));
          assert.strictEqual(service.resolveConfirmation("ua-only", "req-allow", "allowed"), false);
          assert.strictEqual(connection.respondPermissionCalls.length, 1);
        } else {
          const row = lease.snapshot.timeline.find((item) => String(item.id) === "req-allow");
          assert.ok(row?.summary.kind === "permission" && row.summary.decision === "deny", "the actual terminal decision must win over any unary outcome");
          assert.strictEqual(connection.respondPermissionCalls.length, 1);
        }
        assert.ok(!host.domNode.textContent?.includes("stale unary"));
        assert.deepStrictEqual(sessionView.postCalls, []);
      });
    }
  }
  test("response recovery implicit multi-group activation survives failure without auto-submitting on rebuild", async () => {
    const snapshotFor = (sessionId) => {
      const base = engineQuestionSnapshot(sessionId);
      return { ...base, pendingActions: [{ ...base.pendingActions[0], summary: {
        kind: "question",
        title: "Choose both",
        answerKeysValid: true,
        items: [{ id: "one", title: "First", optionsPreview: ["a", "b"] }, { id: "two", title: "Second", optionsPreview: ["c", "d"] }]
      } }] };
    };
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, snapshotFor);
    const host = responseRecoveryHost(store, service, lease);
    const pending = new DeferredPromise();
    connection.writePending = pending.p;
    const radios = host.domNode.querySelectorAll('[role="radio"]');
    radios[1].click();
    assert.strictEqual(connection.respondQuestionCalls.length, 0, "a roving default in another group is not an activated answer");
    radios[3].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", keyCode: 13, bubbles: true }));
    assert.strictEqual(connection.respondQuestionCalls.length, 1);
    await pending.complete({ ok: false });
    await service.whenDispatchedEngineActionSettles();
    assert.strictEqual(connection.respondQuestionCalls.length, 1, "draft restore cannot submit on its own");
    assert.deepStrictEqual([...host.domNode.querySelectorAll('[role="radio"]')].map((radio) => radio.getAttribute("aria-checked")), ["false", "true", "false", "true"]);
    connection.writePending = void 0;
    host.domNode.querySelectorAll('[role="radio"]')[2].click();
    await service.whenDispatchedEngineActionSettles();
    assert.deepStrictEqual(connection.respondQuestionCalls[1].answers, { one: { selectedLabels: ["b"] }, two: { selectedLabels: ["c"] } });
    assert.deepStrictEqual(sessionView.postCalls, []);
  });
  test("response recovery non-retryable stream failure is blocked instead of taking unary forwarding", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, responseRecoverySnapshot);
    const host = responseRecoveryHost(store, service, lease);
    sessionView.emitPatches("ua-only", [{ op: "pendingRespondFailed", requestId: "req-allow", cause: "hostWriteFailed", retryable: false, error: "request expired" }]);
    assert.ok(host.domNode.textContent?.includes("request expired"));
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-allow", "allowed"), false);
    assert.strictEqual(connection.respondPermissionCalls.length, 0);
    service.setEngineConnected(false);
    service.setEngineConnected(true);
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-allow", "allowed"), false, "reconnection cannot erase an authoritative non-retryable failure");
    const row = lease.snapshot.timeline.find((item) => String(item.id) === "req-deny");
    assert.strictEqual(row.summary.kind, "permission");
    if (row.summary.kind !== "permission") {
      return;
    }
    sessionView.emitPatches("ua-only", [{ op: "upsertTimelineItem", item: { ...row, summary: { ...row.summary, decision: "deny" } } }, { op: "removePendingAction", requestId: "req-deny" }]);
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-deny", "allowed"), false);
    assert.strictEqual(connection.respondPermissionCalls.length, 0);
  });
  test("accepted engine allow and deny leave the permission decided and not pending", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, enginePermissionSnapshot);
    assert.strictEqual(service.countPendingConfirmations("ua-only"), 2);
    const applied = [];
    store.add(lease.onDidApplyFrame((event) => {
      if (event.kind === "patches") {
        applied.push([...event.changedIds]);
      }
    }));
    assert.strictEqual(service.resolveConfirmation("ua-only", "  req-allow  ", "allowed"), true);
    await timeout(0);
    assert.deepStrictEqual(connection.respondPermissionCalls, [{
      sessionId: "ua-only",
      requestId: "req-allow",
      granted: true
    }]);
    assert.deepStrictEqual(sessionView.postCalls, []);
    const allowItem = lease.snapshot.timeline.find((item) => String(item.id) === "req-allow");
    assert.ok(allowItem && allowItem.summary.kind === "permission");
    if (allowItem?.summary.kind === "permission") {
      assert.strictEqual(allowItem.summary.decision, "allow");
    }
    assert.ok(!lease.snapshot.pendingActions.some((action) => String(action.requestId) === "req-allow"));
    assert.ok(lease.snapshot.pendingActions.some((action) => String(action.requestId) === "req-deny"));
    const denyBefore = lease.snapshot.timeline.find((item) => String(item.id) === "req-deny");
    assert.ok(denyBefore && denyBefore.summary.kind === "permission" && denyBefore.summary.decision === void 0);
    assert.strictEqual(service.countPendingConfirmations("ua-only"), 1);
    const allowEntry = projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details).find((entry) => entry.id === "req-allow");
    assert.strictEqual(allowEntry?.kind, "confirmation");
    assert.strictEqual(allowEntry?.status, "allowed");
    assert.strictEqual(allowEntry?.text, "Run tests?");
    assert.ok(applied.some((ids) => ids.includes("req-allow") && ids.includes("pending:req-allow")));
    assert.strictEqual(service.resolveConfirmation("ua-only", "req-deny", "skipped"), true);
    await timeout(0);
    assert.deepStrictEqual(connection.respondPermissionCalls[1], {
      sessionId: "ua-only",
      requestId: "req-deny",
      granted: false
    });
    assert.deepStrictEqual(sessionView.postCalls, []);
    const denyItem = lease.snapshot.timeline.find((item) => String(item.id) === "req-deny");
    assert.ok(denyItem && denyItem.summary.kind === "permission");
    if (denyItem?.summary.kind === "permission") {
      assert.strictEqual(denyItem.summary.decision, "deny");
    }
    assert.strictEqual(lease.snapshot.pendingActions.length, 0);
    assert.strictEqual(service.countPendingConfirmations("ua-only"), 0);
    const denyEntry = projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details).find((entry) => entry.id === "req-deny");
    assert.strictEqual(denyEntry?.kind, "confirmation");
    assert.strictEqual(denyEntry?.status, "skipped");
    assert.strictEqual(denyEntry?.text, "Delete build?");
  });
  test("accepted engine question respond leaves an answered row", async () => {
    const { service, connection, sessionView, lease } = await acquireEngineBaseline(store, engineQuestionSnapshot);
    const before = projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details).filter((entry) => entry.kind === "question");
    assert.strictEqual(before.length, 1);
    assert.strictEqual(before[0]?.status, "pending");
    assert.strictEqual(before[0]?.text, "Pick one");
    assert.strictEqual(service.hasPendingAttentionSeat("ua-only"), true);
    assert.strictEqual(service.respondQuestion("ua-only", "  q-ask  ", { itemA: { selectedLabels: ["yes"] } }, "other"), true);
    await timeout(0);
    assert.deepStrictEqual(connection.respondQuestionCalls, [{
      sessionId: "ua-only",
      questionId: "q-ask",
      answers: { itemA: { selectedLabels: ["yes"] } },
      customText: "other"
    }]);
    assert.deepStrictEqual(sessionView.postCalls, []);
    assert.strictEqual(lease.snapshot.pendingActions.length, 0);
    const item = lease.snapshot.timeline.find((row) => String(row.id) === "q-ask");
    assert.ok(item && item.summary.kind === "question");
    if (item?.summary.kind === "question") {
      assert.strictEqual(item.summary.answered, true);
      assert.strictEqual(item.summary.title, "Pick one");
      assert.deepStrictEqual(item.summary.items.map((question) => question.id), ["itemA"]);
    }
    const after = projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details).filter((entry) => entry.kind === "question");
    assert.strictEqual(after.length, 1);
    assert.strictEqual(after[0]?.id, "q-ask");
    assert.strictEqual(after[0]?.status, "allowed");
    assert.strictEqual(after[0]?.text, "Pick one");
    assert.strictEqual(service.hasPendingAttentionSeat("ua-only"), false);
  });
  test("engine refusal of permission and question leaves the view pending", async () => {
    const allowed = await acquireEngineBaseline(store, enginePermissionSnapshot);
    allowed.connection.writeResult = { ok: false, message: "denied" };
    const failures = [];
    store.add(allowed.service.onDidFailEngineAction((failure) => failures.push(failure.action)));
    assert.strictEqual(allowed.service.resolveConfirmation("ua-only", "req-allow", "allowed"), true);
    await timeout(0);
    assert.deepStrictEqual(failures, ["respondPermission"]);
    assert.strictEqual(allowed.connection.respondPermissionCalls.length, 1);
    assert.deepStrictEqual(allowed.sessionView.postCalls, []);
    const allowItem = allowed.lease.snapshot.timeline.find((item) => String(item.id) === "req-allow");
    assert.ok(allowItem && allowItem.summary.kind === "permission" && allowItem.summary.decision === void 0);
    assert.ok(allowed.lease.snapshot.pendingActions.some((action) => String(action.requestId) === "req-allow"));
    assert.strictEqual(allowed.service.countPendingConfirmations("ua-only"), 2);
    const asked = await acquireEngineBaseline(store, engineQuestionSnapshot);
    asked.connection.writeResult = { ok: false, message: "denied" };
    assert.strictEqual(asked.service.respondQuestion("ua-only", "q-ask", { itemA: { selectedLabels: ["yes"] } }), true);
    await timeout(0);
    assert.strictEqual(asked.connection.respondQuestionCalls.length, 1);
    assert.deepStrictEqual(asked.sessionView.postCalls, []);
    assert.strictEqual(asked.lease.snapshot.timeline.length, 0);
    assert.strictEqual(asked.lease.snapshot.pendingActions.length, 1);
    const stillPending = projectSnapshotToEntries(asked.lease.snapshot, asked.lease.attribution, asked.lease.details).filter((entry) => entry.kind === "question");
    assert.strictEqual(stillPending.length, 1);
    assert.strictEqual(stillPending[0]?.status, "pending");
  });
  test("disconnected after engine cancelToolCall skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "tc-1" }), false);
    assert.strictEqual(connection.cancelToolCallCalls.length, 0);
  });
  test("connected deleteTurn forwards AgentService.DeleteMessage", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.deleteTurn("ua-only", "  turn-1  "), true);
    assert.deepStrictEqual(connection.deleteMessageCalls, [{
      sessionId: "ua-only",
      turnId: "turn-1",
      agentId: "root"
    }]);
    assert.strictEqual(service.deleteTurn("ua-only", "   "), false);
    assert.strictEqual(service.deleteTurn("missing", "turn-2"), false);
    assert.strictEqual(connection.deleteMessageCalls.length, 1);
    connection.deleteMessage = void 0;
    assert.strictEqual(service.deleteTurn("ua-only", "turn-3"), false);
    assert.strictEqual(connection.deleteMessageCalls.length, 1);
  });
  test("connected deleteTurn uses last streaming agent when omitted", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const originalGetTurns = service.getTurns.bind(service);
    service.getTurns = (sessionId) => {
      if (sessionId === "ua-only") {
        return [{ id: "a1", kind: "assistant", text: "live", streaming: true, agentId: "sub:live" }];
      }
      return originalGetTurns(sessionId);
    };
    assert.strictEqual(service.deleteTurn("ua-only", "turn-live"), true);
    assert.strictEqual(connection.deleteMessageCalls[0]?.agentId, "sub:live");
    assert.strictEqual(connection.deleteMessageCalls[0]?.turnId, "turn-live");
  });
  test("connected deleteTurn uses passed agentId without streaming projection", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.deleteTurn("ua-only", "turn-sub", "sub:a"), true);
    assert.strictEqual(connection.deleteMessageCalls[0]?.agentId, "sub:a");
    assert.strictEqual(connection.deleteMessageCalls[0]?.turnId, "turn-sub");
    assert.strictEqual(service.deleteTurn("ua-only", "turn-blank", "   "), true);
    assert.strictEqual(connection.deleteMessageCalls[1]?.agentId, "root");
    assert.strictEqual(connection.deleteMessageCalls[1]?.turnId, "turn-blank");
  });
  test("disconnected after engine deleteTurn skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.deleteTurn("ua-only", "turn-1"), false);
    assert.strictEqual(connection.deleteMessageCalls.length, 0);
  });
  test("disconnected after engine killSubAgent skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.killSubAgent("ua-only", { agentId: "sub:reviewer" }), false);
    assert.strictEqual(connection.killCalls.length, 0);
  });
  test("connected createSnapshot forwards AgentService.CreateSnapshot", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.createSnapshot("ua-only", { title: "Before refactor", description: "checkpoint" }), true);
    assert.deepStrictEqual(connection.createSnapshotCalls, [{
      sessionId: "ua-only",
      title: "Before refactor",
      description: "checkpoint"
    }]);
    assert.strictEqual(service.createSnapshot("ua-only"), true);
    assert.strictEqual(connection.createSnapshotCalls[1]?.title, "Snapshot");
    assert.strictEqual(connection.createSnapshotCalls[1]?.description, void 0);
    assert.strictEqual(service.createSnapshot("ua-only", { title: "" }), true);
    assert.strictEqual(connection.createSnapshotCalls[2]?.title, "");
    assert.strictEqual(service.createSnapshot("   ", { title: "Nope" }), false);
    assert.strictEqual(service.createSnapshot("", { title: "Nope" }), false);
    assert.strictEqual(service.createSnapshot("missing", { title: "Nope" }), false);
    assert.strictEqual(connection.createSnapshotCalls.length, 3);
    connection.createSnapshot = void 0;
    assert.strictEqual(service.createSnapshot("ua-only", { title: "Nope" }), false);
    assert.strictEqual(connection.createSnapshotCalls.length, 3);
  });
  test("disconnected after engine createSnapshot skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.createSnapshot("ua-only", { title: "Before refactor" }), false);
    assert.strictEqual(connection.createSnapshotCalls.length, 0);
  });
  test("leftover createSnapshot rejects while pairingPending and leaves roster unchanged", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.createSnapshot("ua-a", { title: "Live checkpoint" }), true);
    assert.strictEqual(connection.createSnapshotCalls.length, 1);
    connection.setPairingPending(true);
    assert.strictEqual(connection.isEngineConnected(), false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(isConversationPairingHold(connection), true);
    const titlesBefore = service.getSessions().map((s) => s.title);
    const idsBefore = service.getSessions().map((s) => s.id);
    assert.strictEqual(service.createSnapshot("ua-a", { title: "Pairing checkpoint" }), false);
    assert.strictEqual(connection.createSnapshotCalls.length, 1);
    assert.deepStrictEqual(service.getSessions().map((s) => s.title), titlesBefore);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), idsBefore);
    connection.setPairingPending(false);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.createSnapshot("ua-a", { title: "Live again" }), true);
    assert.strictEqual(connection.createSnapshotCalls.length, 2);
    assert.strictEqual(connection.createSnapshotCalls[1]?.title, "Live again");
  });
  test("leftover-looks-live createSnapshot rejects while pairingPending and skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.createSnapshot("ua-only", { title: "Live checkpoint" }), true);
    assert.strictEqual(connection.createSnapshotCalls.length, 1);
    connection.setPairingPending(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    const titlesBefore = service.getSessions().map((s) => s.title);
    const idsBefore = service.getSessions().map((s) => s.id);
    assert.strictEqual(service.createSnapshot("ua-only", { title: "Looks-live checkpoint" }), false);
    assert.strictEqual(connection.createSnapshotCalls.length, 1);
    assert.deepStrictEqual(service.getSessions().map((s) => s.title), titlesBefore);
    assert.deepStrictEqual(service.getSessions().map((s) => s.id), idsBefore);
  });
  test("disconnected after engine setSessionGoal skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.setSessionGoal("ua-only", "Cached goal"), false);
    assert.strictEqual(service.cancelSessionGoal("ua-only"), false);
    assert.strictEqual(service.getSessionGoal("ua-only"), void 0);
    assert.strictEqual(connection.setGoalCalls.length, 0);
    assert.strictEqual(connection.cancelGoalCalls.length, 0);
  });
  test("disconnected after engine cancelGeneration skips unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.cancelGeneration("ua-only"), false);
    assert.strictEqual(service.cancelGeneration("ua-only", "root"), false);
    assert.strictEqual(connection.cancelCalls.length, 0);
  });
  test("GetQueue wakes after bind and mutations use actual engine session id", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const binding = new DeferredPromise();
    connection.enableQueueReadback();
    connection.setListSessions([{ sessionId: "ua-only", title: "Local roster id" }]);
    const service = store.add(createService(connection, void 0, createSessionViewMock({ whenEngineSessionReady: () => binding.p })));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(connection.getQueueCalls, []);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q"), false);
    await binding.complete("engine-real");
    await timeout(0);
    assert.deepStrictEqual(connection.getQueueCalls, ["engine-real"]);
    assert.strictEqual(service.getMessageQueueState("ua-only").readState, "ready");
    service.pauseMessageQueue("ua-only");
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q"), true);
    assert.deepStrictEqual(connection.pauseQueueCalls, [{ sessionId: "engine-real" }]);
    assert.deepStrictEqual(connection.retryQueueItemCalls, [{ sessionId: "engine-real", itemId: "q" }]);
    await timeout(0);
    assert.ok(connection.getQueueCalls.length > 1);
  });
  test("connected MessageQueue mutations forward AgentService queue unaries", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.enableQueueReadback();
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const failures = [];
    store.add(service.onDidFailEngineAction((failure) => failures.push(failure.action)));
    service.setMessageQueueFixture("ua-only", {
      items: [{
        id: "q1",
        content: "fixture",
        status: "PENDING",
        hold: void 0,
        uploadProgress: void 0,
        retryCount: 0,
        lastError: void 0,
        locked: false,
        pinned: false
      }],
      isPaused: false,
      isProcessing: false
    });
    assert.deepStrictEqual(service.getMessageQueueState("ua-only"), {
      items: [],
      isPaused: false,
      isProcessing: false,
      readState: "ready",
      version: "0"
    });
    assert.strictEqual(service.enqueueMessageQueueItem("ua-only", "  later  ", { priority: "HIGH", opId: "  op-1  " }), false);
    service.pauseMessageQueue("ua-only");
    service.resumeMessageQueue("ua-only");
    service.clearMessageQueue("ua-only");
    service.holdMessageQueueItem("ua-only", "  q1  ", "EDITING");
    service.releaseMessageQueueItemHold("ua-only", "  q1  ");
    assert.strictEqual(service.updateMessageQueueItemContent("ua-only", "  q1  ", "  later  "), true);
    assert.deepStrictEqual(connection.enqueueCalls, []);
    assert.deepStrictEqual(connection.pauseQueueCalls, [{ sessionId: "ua-only" }]);
    assert.deepStrictEqual(connection.resumeQueueCalls, [{ sessionId: "ua-only" }]);
    assert.deepStrictEqual(connection.clearQueueCalls, [{ sessionId: "ua-only" }]);
    assert.deepStrictEqual(connection.holdQueueCalls, [{ sessionId: "ua-only", itemId: "q1", reason: "EDITING" }]);
    assert.deepStrictEqual(connection.releaseQueueCalls, [{ sessionId: "ua-only", itemId: "q1" }]);
    assert.deepStrictEqual(connection.editQueueCalls, [{ sessionId: "ua-only", itemId: "q1", text: "later" }]);
    assert.strictEqual(service.enqueueMessageQueueItem("ua-only", "   "), false);
    assert.strictEqual(service.enqueueMessageQueueItem("missing", "Nope"), false);
    service.pauseMessageQueue("missing");
    service.holdMessageQueueItem("ua-only", "   ", "EDITING");
    service.releaseMessageQueueItemHold("missing", "q1");
    assert.strictEqual(service.updateMessageQueueItemContent("ua-only", "q1", "   "), false);
    assert.strictEqual(service.updateMessageQueueItemContent("missing", "q1", "Nope"), false);
    assert.strictEqual(connection.enqueueCalls.length, 0);
    assert.strictEqual(connection.pauseQueueCalls.length, 1);
    assert.strictEqual(connection.holdQueueCalls.length, 1);
    assert.strictEqual(connection.releaseQueueCalls.length, 1);
    assert.strictEqual(connection.editQueueCalls.length, 1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepStrictEqual(failures, []);
  });
  test("connected MessageQueue fixture failed rows stay invisible without GetQueue", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    service.setMessageQueueFixture("ua-only", {
      items: [{
        id: "q-fail",
        content: "fixture failed",
        status: "FAILED",
        hold: void 0,
        uploadProgress: void 0,
        retryCount: 1,
        lastError: "send rejected",
        locked: false,
        pinned: false
      }],
      isPaused: false,
      isProcessing: false
    });
    assert.deepStrictEqual(service.getMessageQueueState("ua-only"), {
      items: [],
      isPaused: false,
      isProcessing: false,
      readState: "unsupported",
      readError: void 0
    });
    assert.strictEqual(connection.getQueue, void 0);
    assert.strictEqual(connection.listQueue, void 0);
    assert.strictEqual(connection.GetQueue, void 0);
    assert.strictEqual(connection.ListQueue, void 0);
  });
  test("connected MessageQueue ok:false reports onDidFailEngineAction even when itemId is set", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.enableQueueReadback();
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const failures = [];
      store.add(service.onDidFailEngineAction((failure) => failures.push({
        action: failure.action,
        message: failure.error instanceof Error ? failure.error.message : String(failure.error)
      })));
      connection.queueResult = { ok: false, error: "denied", itemId: "q-new" };
      assert.strictEqual(service.enqueueMessageQueueItem("ua-only", "later"), false);
      service.pauseMessageQueue("ua-only");
      service.resumeMessageQueue("ua-only");
      service.clearMessageQueue("ua-only");
      service.holdMessageQueueItem("ua-only", "q1", "EDITING");
      service.releaseMessageQueueItemHold("ua-only", "q1");
      assert.strictEqual(service.updateMessageQueueItemContent("ua-only", "q1", "later"), true);
      assert.strictEqual(service.retryMessageQueueItem("ua-only", "q1"), true);
      assert.strictEqual(service.retryMessageQueueItem("ua-only", "q1", { upload: true }), true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepStrictEqual(failures, [
        { action: "pauseQueue", message: "denied" },
        { action: "resumeQueue", message: "denied" },
        { action: "clearQueue", message: "denied" },
        { action: "holdQueueItem", message: "denied" },
        { action: "releaseQueueItemHold", message: "denied" },
        { action: "editQueueItem", message: "denied" },
        { action: "retryQueueItem", message: "denied" },
        { action: "retryQueueItemUpload", message: "denied" }
      ]);
      assert.deepStrictEqual(service.getMessageQueueState("ua-only").items, []);
      assert.ok(connection.getQueueCalls.length > 0);
      assert.strictEqual(connection.listQueue, void 0);
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected MessageQueue remote throw reports failure without unhandled rejection", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.enableQueueReadback();
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const boom = new Error("boom");
      connection.queueError = boom;
      const failures = [];
      store.add(service.onDidFailEngineAction((failure) => failures.push({
        action: failure.action,
        error: failure.error
      })));
      assert.strictEqual(service.enqueueMessageQueueItem("ua-only", "later"), false);
      service.pauseMessageQueue("ua-only");
      assert.strictEqual(service.retryMessageQueueItem("ua-only", "q1"), true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepStrictEqual(failures, [
        { action: "pauseQueue", error: boom },
        { action: "retryQueueItem", error: boom }
      ]);
      assert.deepStrictEqual(service.getMessageQueueState("ua-only").items, []);
      assert.ok(connection.getQueueCalls.length > 0);
      assert.strictEqual(connection.listQueue, void 0);
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected remaining writes ok:false reports onDidFailEngineAction", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const failures = [];
      store.add(service.onDidFailEngineAction((failure) => failures.push({
        action: failure.action,
        message: failure.error instanceof Error ? failure.error.message : String(failure.error)
      })));
      connection.writeResult = { ok: false, message: "denied" };
      assert.strictEqual(service.forkSubAgent("ua-only", { name: "reviewer" }), true);
      assert.strictEqual(service.killSubAgent("ua-only", { agentId: "sub:reviewer" }), true);
      assert.strictEqual(service.createSnapshot("ua-only", { title: "checkpoint" }), true);
      assert.strictEqual(service.cancelGeneration("ua-only"), true);
      assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "tc-1" }), true);
      assert.strictEqual(service.deleteTurn("ua-only", "turn-1"), true);
      assert.strictEqual(service.updateUserTurnText("ua-only", "turn-1", "later"), true);
      assert.strictEqual(service.resolveConfirmation("ua-only", "req-1", "allowed"), true);
      assert.strictEqual(service.respondQuestion("ua-only", "q-1"), true);
      assert.strictEqual(service.respondClientTool("ua-only", "call-1", { content: "{}" }), true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepStrictEqual(failures, [
        { action: "forkAgent", message: "denied" },
        { action: "killAgent", message: "denied" },
        { action: "createSnapshot", message: "denied" },
        { action: "cancelGeneration", message: "denied" },
        { action: "cancelToolCall", message: "denied" },
        { action: "deleteMessage", message: "denied" },
        { action: "editMessage", message: "denied" },
        { action: "respondPermission", message: "denied" },
        { action: "respondQuestion", message: "denied" },
        { action: "sendClientToolResponse", message: "denied" }
      ]);
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("connected remaining writes remote throw reports failure without unhandled rejection", async () => {
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    try {
      const storage = store.add(new TestStorageService());
      const connection = store.add(new MockUniverseAgentConnection());
      connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
      const service = store.add(createService(connection, storage));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      const boom = new Error("boom");
      connection.writeError = boom;
      const failures = [];
      store.add(service.onDidFailEngineAction((failure) => failures.push({
        action: failure.action,
        error: failure.error
      })));
      assert.strictEqual(service.forkSubAgent("ua-only", { name: "reviewer" }), true);
      assert.strictEqual(service.killSubAgent("ua-only", { agentId: "sub:reviewer" }), true);
      assert.strictEqual(service.createSnapshot("ua-only", { title: "checkpoint" }), true);
      assert.strictEqual(service.cancelGeneration("ua-only"), true);
      assert.strictEqual(service.cancelToolCall("ua-only", { toolCallId: "tc-1" }), true);
      assert.strictEqual(service.deleteTurn("ua-only", "turn-1"), true);
      assert.strictEqual(service.updateUserTurnText("ua-only", "turn-1", "later"), true);
      assert.strictEqual(service.resolveConfirmation("ua-only", "req-1", "allowed"), true);
      assert.strictEqual(service.respondQuestion("ua-only", "q-1"), true);
      assert.strictEqual(service.respondClientTool("ua-only", "call-1", { content: "{}" }), true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.deepStrictEqual(failures, [
        { action: "forkAgent", error: boom },
        { action: "killAgent", error: boom },
        { action: "createSnapshot", error: boom },
        { action: "cancelGeneration", error: boom },
        { action: "cancelToolCall", error: boom },
        { action: "deleteMessage", error: boom },
        { action: "editMessage", error: boom },
        { action: "respondPermission", error: boom },
        { action: "respondQuestion", error: boom },
        { action: "sendClientToolResponse", error: boom }
      ]);
      assert.deepStrictEqual(unhandledRejections, []);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }
  });
  test("whenDispatchedEngineActionSettles waits for connected fork and kill unary", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.forkSubAgent("ua-only", { name: "reviewer" }), true);
    assert.strictEqual(await service.whenDispatchedEngineActionSettles(), true);
    connection.writeResult = { ok: false, message: "denied" };
    assert.strictEqual(service.forkSubAgent("ua-only", { name: "reviewer" }), true);
    assert.strictEqual(await service.whenDispatchedEngineActionSettles(), false);
    assert.strictEqual(service.killSubAgent("ua-only", { agentId: "sub:reviewer" }), true);
    assert.strictEqual(await service.whenDispatchedEngineActionSettles(), false);
    connection.writeResult = { ok: true };
    connection.writeError = new Error("boom");
    assert.strictEqual(service.forkSubAgent("ua-only", { name: "reviewer" }), true);
    assert.strictEqual(await service.whenDispatchedEngineActionSettles(), false);
  });
  test("disconnected after engine MessageQueue skips unary and stays empty", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    assert.strictEqual(service.hasEngineConnectionHistory(), false);
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    assert.strictEqual(service.hasEngineConnectionHistory(), true);
    assert.strictEqual(service.enqueueMessageQueueItem("ua-only", "later"), false);
    service.pauseMessageQueue("ua-only");
    service.resumeMessageQueue("ua-only");
    service.clearMessageQueue("ua-only");
    service.holdMessageQueueItem("ua-only", "q1", "EDITING");
    service.releaseMessageQueueItemHold("ua-only", "q1");
    assert.strictEqual(service.updateMessageQueueItemContent("ua-only", "q1", "later"), false);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q1"), false);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q1", { upload: true }), false);
    assert.deepStrictEqual(service.getMessageQueueState("ua-only").items, []);
    assert.strictEqual(connection.enqueueCalls.length, 0);
    assert.strictEqual(connection.pauseQueueCalls.length, 0);
    assert.strictEqual(connection.resumeQueueCalls.length, 0);
    assert.strictEqual(connection.clearQueueCalls.length, 0);
    assert.strictEqual(connection.holdQueueCalls.length, 0);
    assert.strictEqual(connection.releaseQueueCalls.length, 0);
    assert.strictEqual(connection.editQueueCalls.length, 0);
    assert.strictEqual(connection.retryQueueItemCalls.length, 0);
    assert.strictEqual(connection.retryQueueItemUploadCalls.length, 0);
    assert.strictEqual(connection.continuationOpens.length, 0);
  });
  test("connected retryMessageQueueItem forwards RetryQueueItem / RetryQueueItemUpload", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.enableQueueReadback();
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "  q-fail  "), true);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "  q-upload  ", { upload: false }), true);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "  q-up  ", { upload: true }), true);
    assert.deepStrictEqual(connection.retryQueueItemCalls, [
      { sessionId: "ua-only", itemId: "q-fail" },
      { sessionId: "ua-only", itemId: "q-upload" }
    ]);
    assert.deepStrictEqual(connection.retryQueueItemUploadCalls, [
      { sessionId: "ua-only", itemId: "q-up" }
    ]);
    assert.strictEqual(connection.continuationOpens.length, 0);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "   "), false);
    assert.strictEqual(service.retryMessageQueueItem("missing", "q-fail"), false);
    assert.strictEqual(connection.retryQueueItemCalls.length, 2);
    assert.strictEqual(connection.retryQueueItemUploadCalls.length, 1);
    connection.retryQueueItem = void 0;
    connection.retryQueueItemUpload = void 0;
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q-fail"), false);
    assert.strictEqual(service.retryMessageQueueItem("ua-only", "q-up", { upload: true }), false);
    assert.strictEqual(connection.retryQueueItemCalls.length, 2);
    assert.strictEqual(connection.retryQueueItemUploadCalls.length, 1);
    assert.strictEqual(connection.continuationOpens.length, 0);
  });
  test("never-connected retryMessageQueueItem fails honestly and does not send", () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const service = store.add(createService(connection));
    const sessionId = service.getActiveSessionId();
    assert.strictEqual(service.retryMessageQueueItem(sessionId, "q-fail"), false);
    assert.strictEqual(service.retryMessageQueueItem(sessionId, "q-fail", { upload: true }), false);
    assert.strictEqual(connection.retryQueueItemCalls.length, 0);
    assert.strictEqual(connection.retryQueueItemUploadCalls.length, 0);
    assert.strictEqual(connection.continuationOpens.length, 0);
  });
  test("connected AutoDrive ignores fixture and stays empty", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    service.setAutoDriveTaskFixture("ua-only", ["Fix lint", "Ship"]);
    assert.deepStrictEqual(service.getAutoDriveTasks("ua-only"), []);
    assert.strictEqual(service.getAutoDriveTaskCount("ua-only"), 0);
  });
  test("disconnected after engine AutoDrive stays empty and ignores fixture", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    connection.setConnected(false);
    service.setEngineConnected(false);
    service.setAutoDriveTaskFixture("ua-only", ["Fix lint"]);
    assert.deepStrictEqual(service.getAutoDriveTasks("ua-only"), []);
    assert.strictEqual(service.getAutoDriveTaskCount("ua-only"), 0);
  });
  test("bind-failed roster keeps composer post rejected as no_such_session", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async () => {
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const outcome = await postBound(
      { stubService: service, sessionViewLease: void 0 },
      { kind: "submitInput", text: "hello" }
    );
    assert.strictEqual(outcome.accepted, false);
    if (!outcome.accepted) {
      assert.strictEqual(outcome.reason, "no_such_session");
    }
  });
  test("bind-failed never sends placeholder id to engine createSession, acquireLease, or tree refresh", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const acquireLeaseCalls = [];
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: true, correlation: { id: "mock" } }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
    assert.ok(isEngineRosterPlaceholderSessionId(ENGINE_BIND_FAILED_SESSION_ID));
    assert.strictEqual(connection.createCalls.length, 0);
    for (const call of acquireLeaseCalls) {
      assert.notStrictEqual(call, ENGINE_BIND_FAILED_SESSION_ID);
    }
    assert.ok(!connection.treeRefreshCalls.includes(ENGINE_BIND_FAILED_SESSION_ID));
    assert.throws(
      () => service.acquireSessionView(ENGINE_BIND_FAILED_SESSION_ID),
      /not engine-bound/
    );
    assert.strictEqual(acquireLeaseCalls.length, 1);
    assert.ok(acquireLeaseCalls[0]?.startsWith("session-"));
  });
  test("empty list with pending bind stays incomplete until lease resolves", async () => {
    let resolveLease;
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async (sessionId) => new Promise((resolve) => {
        resolveLease = () => resolve(`lease:${sessionId}`);
      }),
      releaseLease: async () => {
      },
      post: async () => ({ accepted: true, correlation: { id: "mock" } }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate
    ));
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.getSessions().length, 0);
    assert.strictEqual(service.isEngineSessionReady(), false);
    assert.notStrictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
    assert.strictEqual(service.getActiveSession().title, "");
    assert.ok(!service.getActiveSession().title.includes("Untitled session"));
    assert.ok(service.getActiveSession().title !== "New session");
    resolveLease?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.isEngineSessionReady(), true);
    assert.ok(service.getSessions().length > 0);
  });
  test("restored engine cache with empty List defers Create to host lease with fresh clientSessionId", async () => {
    const cachedUuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const storage = store.add(new TestStorageService());
    storage.store(
      CONVERSATION_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        wasEverConnected: true,
        activeSessionId: cachedUuid,
        nextTurnId: 100,
        localSessions: [],
        engineCache: {
          activeSessionId: cachedUuid,
          sessions: [{
            id: cachedUuid,
            title: "Cached UA",
            turns: [],
            source: "engine-cache"
          }]
        }
      }),
      StorageScope.WORKSPACE,
      StorageTarget.USER
    );
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const acquireLeaseCalls = [];
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async (sessionId) => {
        acquireLeaseCalls.push(sessionId);
        return `lease:${sessionId}`;
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: true, correlation: { id: "mock" } }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    assert.strictEqual(service.getActiveSessionId(), cachedUuid);
    assert.strictEqual(service.getSessions()[0]?.id, cachedUuid);
    assert.strictEqual(service.isEngineSessionReady(), true);
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(connection.createCalls.length, 0);
    assert.strictEqual(acquireLeaseCalls.length, 1);
    const clientSessionId = acquireLeaseCalls[0];
    assert.ok(clientSessionId?.startsWith("session-"));
    assert.notStrictEqual(clientSessionId, cachedUuid);
    assert.notStrictEqual(clientSessionId, ENGINE_BIND_FAILED_SESSION_ID);
    assert.strictEqual(service.getActiveSessionId(), clientSessionId);
    assert.ok(service.getSessions().some((session) => session.id === clientSessionId));
    assert.ok(!service.getSessions().some((session) => session.id === cachedUuid));
  });
  test("bind-failed persist omits placeholder activeSessionId from roster storage", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([]);
    const sessionView = {
      _serviceBrand: void 0,
      onDynamicDidApplyFrame: () => Event.None,
      acquireLease: async () => {
        throw new Error("session not found");
      },
      releaseLease: async () => {
      },
      post: async () => ({ accepted: false, reason: "no_such_session" }),
      requestResync: async () => {
      },
      acknowledge: async () => {
      },
      requestDetail: async () => ({ ok: false, reason: "unavailable" }),
      whenEngineSessionReady: async (sessionId) => sessionId
    };
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new ConversationEngineRosterService(
      connection,
      sessionView,
      workspaceToolsGate,
      storage
    ));
    service.setEngineConnected(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.getActiveSessionId(), ENGINE_BIND_FAILED_SESSION_ID);
    const raw = storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "";
    assert.ok(!raw.includes(ENGINE_BIND_FAILED_SESSION_ID));
  });
  test("getTurns and getTrajectoryRecords keep leftover cache while pairingPending then true disconnect falls back", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView());
    connection.setListSessions([{ sessionId: "ua-cache", title: "Cached UA" }]);
    const service = store.add(createService(connection, void 0, sessionView));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    const lease = store.add(service.acquireSessionView("ua-cache"));
    assert.ok(await lease.whenBindReady?.());
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(lease.snapshot.timeline.some((item) => item.summary.kind === "text" && item.summary.preview === LEFTOVER_CACHE_TURN_TEXT));
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.ok(service.getTurns("ua-cache").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    assert.ok(service.getTrajectoryRecords("ua-cache").some((record) => record.text.includes(LEFTOVER_CACHE_TURN_TEXT)));
    connection.setPairingPending(true);
    assert.strictEqual(connection.isEngineConnected(), false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.ok(service.getTurns("ua-cache").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    assert.ok(service.getTrajectoryRecords("ua-cache").some((record) => record.text.includes(LEFTOVER_CACHE_TURN_TEXT)));
    connection.setPairingPending(false);
    connection.setConnected(false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "disconnected");
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.ok(!service.getTurns("ua-cache").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    assert.ok(!service.getTrajectoryRecords("ua-cache").some((record) => record.text.includes(LEFTOVER_CACHE_TURN_TEXT)));
  });
  test("pairingPending first-pull without leftover cache stays empty fallback", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-empty", title: "Empty UA" }]);
    const service = store.add(createService(connection));
    connection.setPairingPending(true);
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.getTurns("ua-empty").length, 0);
    assert.ok(!service.getTrajectoryRecords("ua-empty").some((record) => record.text.includes(LEFTOVER_CACHE_TURN_TEXT)));
  });
  test("getSessionSync keeps leftover engine sync while pairingPending then true disconnect uses stub", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView(LEFTOVER_ENGINE_SYNC));
    connection.setListSessions([{ sessionId: "ua-cache", title: "Cached UA" }]);
    const service = store.add(createService(connection, void 0, sessionView));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    const lease = store.add(service.acquireSessionView("ua-cache"));
    assert.ok(await lease.whenBindReady?.());
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.deepStrictEqual(service.getSessionSync("ua-cache"), LEFTOVER_ENGINE_SYNC);
    connection.setPairingPending(true);
    assert.strictEqual(connection.isEngineConnected(), false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.deepStrictEqual(service.getSessionSync("ua-cache"), LEFTOVER_ENGINE_SYNC);
    connection.setPairingPending(false);
    connection.setConnected(false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "disconnected");
    assert.strictEqual(isConversationPairingHold(connection), false);
    const disconnected = service.getSessionSync("ua-cache");
    assert.notDeepStrictEqual(disconnected, LEFTOVER_ENGINE_SYNC);
    assert.deepStrictEqual(disconnected, { kind: "idle" });
  });
  test("getSessionSync demotes leftover live and syncing chrome while pairingPending then true disconnect uses stub", async () => {
    for (const leftover of [{ kind: "live" }, { kind: "syncing" }]) {
      const connection = store.add(new MockUniverseAgentConnection());
      const sessionView = store.add(new LeftoverProjectionSessionView(leftover));
      connection.setListSessions([{ sessionId: "ua-cache", title: "Cached UA" }]);
      const service = store.add(createService(connection, void 0, sessionView));
      connection.setConnected(true);
      await awaitEngineCatalogRefresh(service);
      const lease = store.add(service.acquireSessionView("ua-cache"));
      assert.ok(await lease.whenBindReady?.());
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.isEngineConnected(), true);
      assert.strictEqual(isConversationPairingHold(connection), false);
      assert.deepStrictEqual(service.getSessionSync("ua-cache"), leftover);
      connection.setPairingPending(true);
      assert.strictEqual(connection.isEngineConnected(), false);
      assert.strictEqual(service.isEngineConnected(), false);
      assert.strictEqual(connection.getConnectionPhase().kind, "connected");
      assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
      assert.strictEqual(isConversationPairingHold(connection), true);
      const pairing = service.getSessionSync("ua-cache");
      assert.notStrictEqual(pairing.kind, "live");
      assert.notStrictEqual(pairing.kind, "syncing");
      assert.strictEqual(pairing.kind, "closed");
      connection.setPairingPending(false);
      connection.setConnected(false);
      assert.strictEqual(service.isEngineConnected(), false);
      assert.strictEqual(connection.getConnectionPhase().kind, "disconnected");
      assert.strictEqual(isConversationPairingHold(connection), false);
      assert.deepStrictEqual(service.getSessionSync("ua-cache"), { kind: "idle" });
    }
  });
  test("pairingPending first-pull without leftover cache getSessionSync stays stub idle", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-empty", title: "Empty UA" }]);
    const service = store.add(createService(connection));
    connection.setPairingPending(true);
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.deepStrictEqual(service.getSessionSync("ua-empty"), { kind: "idle" });
  });
  test("leftover-looks-live getSessionSync demotes leftover live and syncing chrome", async () => {
    for (const leftover of [{ kind: "live" }, { kind: "syncing" }]) {
      const connection = store.add(new MockUniverseAgentConnection());
      const sessionView = store.add(new LeftoverProjectionSessionView(leftover));
      connection.setListSessions([{ sessionId: "ua-cache", title: "Cached UA" }]);
      const service = store.add(createService(connection, void 0, sessionView));
      connection.setConnected(true);
      service.setEngineConnected(true);
      await awaitEngineCatalogRefresh(service);
      const lease = store.add(service.acquireSessionView("ua-cache"));
      assert.ok(await lease.whenBindReady?.());
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.strictEqual(service.isEngineConnected(), true);
      assert.strictEqual(isConversationPairingHold(connection), false);
      assert.deepStrictEqual(service.getSessionSync("ua-cache"), leftover);
      assert.strictEqual(service.shouldAdvertiseClientWorkspaceTools(), true);
      assert.strictEqual(service.hasEngineConnectionHistory(), true);
      connection.setPairingPending(true);
      service.setEngineConnected(true);
      assert.strictEqual(service.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
      assert.strictEqual(connection.getConnectionPhase().kind, "connected");
      assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
      assert.strictEqual(isConversationPairingHold(connection), true);
      const pairing = service.getSessionSync("ua-cache");
      assert.notStrictEqual(pairing.kind, "live");
      assert.notStrictEqual(pairing.kind, "syncing");
      assert.strictEqual(pairing.kind, "closed");
      assert.strictEqual(service.shouldAdvertiseClientWorkspaceTools(), false, "leftover-looks-live must not advertise workspace tools");
      assert.strictEqual(service.hasEngineConnectionHistory(), true, "leftover-looks-live after live connect keeps wasEverConnected");
    }
  });
  test("leftover-looks-live first-pull does not flip wasEverConnected or advertise workspace tools", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-empty", title: "Empty UA" }]);
    const service = store.add(createService(connection));
    assert.strictEqual(service.hasEngineConnectionHistory(), false);
    assert.strictEqual(service.shouldAdvertiseClientWorkspaceTools(), false);
    connection.setPairingPending(true);
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.hasEngineConnectionHistory(), false, "leftover-looks-live first-pull must not flip wasEverConnected");
    assert.strictEqual(service.shouldAdvertiseClientWorkspaceTools(), false, "leftover-looks-live must not advertise workspace tools");
    assert.deepStrictEqual(service.getSessionSync("ua-empty"), { kind: "idle" });
    connection.setConnected(true);
    service.setEngineConnected(true);
    assert.strictEqual(service.isEngineConnected(), true, "leftover-looks-live fixture must keep isEngineConnected()===true");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.hasEngineConnectionHistory(), false, "leftover-looks-live first-pull onUaConnectionChanged must not flip wasEverConnected");
    assert.strictEqual(service.shouldAdvertiseClientWorkspaceTools(), false);
    connection.setPairingPending(false);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.hasEngineConnectionHistory(), true, "true connect no pairing still flips wasEverConnected");
    assert.strictEqual(service.shouldAdvertiseClientWorkspaceTools(), true);
  });
  test("acquireSessionView keeps leftover engine snapshot while pairingPending then true disconnect uses stub", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView());
    connection.setListSessions([{ sessionId: "ua-cache", title: "Cached UA" }]);
    const service = store.add(createService(connection, void 0, sessionView));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    const seed = service.acquireSessionView("ua-cache");
    assert.ok(await seed.whenBindReady?.());
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(seed.snapshot.timeline.some((item) => item.summary.kind === "text" && item.summary.preview === LEFTOVER_CACHE_TURN_TEXT));
    assert.ok(seed.snapshot.pendingActions.some((action) => String(action.requestId) === LEFTOVER_PENDING_REQUEST_ID));
    seed.dispose();
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    connection.setPairingPending(true);
    assert.strictEqual(connection.isEngineConnected(), false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    const pairingLease = store.add(service.acquireSessionView("ua-cache"));
    assert.ok(await pairingLease.whenBindReady?.());
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(pairingLease.snapshot.timeline.some((item) => item.summary.kind === "text" && item.summary.preview === LEFTOVER_CACHE_TURN_TEXT));
    assert.ok(pairingLease.snapshot.pendingActions.some((action) => String(action.requestId) === LEFTOVER_PENDING_REQUEST_ID));
    const placeholderLease = store.add(service.acquireSessionView(ENGINE_BIND_FAILED_SESSION_ID));
    assert.ok(!placeholderLease.snapshot.timeline.some((item) => item.summary.kind === "text" && item.summary.preview === LEFTOVER_CACHE_TURN_TEXT));
    const unboundLease = store.add(service.acquireSessionView("not-engine-bound"));
    assert.ok(!unboundLease.snapshot.timeline.some((item) => item.summary.kind === "text" && item.summary.preview === LEFTOVER_CACHE_TURN_TEXT));
    connection.setPairingPending(false);
    connection.setConnected(false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "disconnected");
    assert.strictEqual(isConversationPairingHold(connection), false);
    const disconnectedLease = store.add(service.acquireSessionView("ua-cache"));
    assert.ok(!disconnectedLease.snapshot.timeline.some((item) => item.summary.kind === "text" && item.summary.preview === LEFTOVER_CACHE_TURN_TEXT));
    assert.strictEqual(disconnectedLease.snapshot.pendingActions.length, 0);
  });
  test("pairingPending first-pull without leftover acquireSessionView stays stub empty", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView());
    connection.setListSessions([{ sessionId: "ua-empty", title: "Empty UA" }]);
    const service = store.add(createService(connection, void 0, sessionView));
    connection.setPairingPending(true);
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(isConversationPairingHold(connection), true);
    const lease = store.add(service.acquireSessionView("ua-empty"));
    assert.ok(!lease.snapshot.timeline.some((item) => item.summary.kind === "text" && item.summary.preview === LEFTOVER_CACHE_TURN_TEXT));
    assert.strictEqual(lease.snapshot.pendingActions.length, 0);
  });
  test("projected engine turns notify roster detail without writing session.turns", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView());
    connection.setListSessions([{ sessionId: "ua-cache", title: "Cached UA" }]);
    const service = store.add(createService(connection, void 0, sessionView));
    const detailIds = [];
    store.add(service.onDidChangeSessionRosterDetail((id) => detailIds.push(id)));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    const session = service.getSessions().find((item) => item.id === "ua-cache");
    assert.ok(session);
    assert.strictEqual(session.turns.length, 0, "roster object stays empty while the projection is live");
    assert.ok(service.getTurns("ua-cache").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    assert.ok(detailIds.includes("ua-cache"), `roster detail listeners: ${detailIds.join(",")}`);
  });
  test("catalog refresh prunes sessions the list dropped without firing onDidDeleteSession", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-a", "ua-b"]);
    assert.strictEqual(service.getActiveSessionId(), "ua-a");
    const deleted = [];
    const pruned = [];
    store.add(service.onDidDeleteSession((id) => deleted.push(id)));
    store.add(service.onDidPruneEngineSessions((ids) => pruned.push([...ids])));
    connection.setListSessions([{ sessionId: "ua-b", title: "B" }]);
    await service.refreshEngineCatalog();
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["ua-b"]);
    assert.strictEqual(service.getActiveSessionId(), "ua-b");
    assert.deepStrictEqual(pruned, [["ua-a"]]);
    assert.deepStrictEqual(deleted, []);
    await service.refreshEngineCatalog();
    await awaitEngineCatalogRefresh(service);
    assert.deepStrictEqual(pruned, [["ua-a"]]);
    assert.deepStrictEqual(deleted, []);
  });
  test("listSessions refresh keeps remembered turns on sessions without a live lease", async () => {
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, storage, sessionView));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.ok(service.getTurns("ua-a").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    service.switchSession("ua-b");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const remembered = service.getSessions().find((session) => session.id === "ua-a");
    assert.ok(remembered);
    assert.ok(remembered.turns.some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    assert.strictEqual(service.getSessions().find((session) => session.id === "ua-b").turns.length, 0);
    await service.refreshEngineCatalog();
    await awaitEngineCatalogRefresh(service);
    const rowAfterRefresh = service.getSessions().find((session) => session.id === "ua-a");
    assert.ok(rowAfterRefresh);
    assert.ok(rowAfterRefresh.turns.some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    assert.ok(service.getTurns("ua-b").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    const raw = storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "";
    assert.ok(raw.includes(LEFTOVER_CACHE_TURN_TEXT), `persisted roster should keep ua-a turns: ${raw}`);
  });
  test("switching sessions keeps the previous session projected turn count", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView());
    connection.setListSessions([
      { sessionId: "ua-a", title: "A" },
      { sessionId: "ua-b", title: "B" }
    ]);
    const service = store.add(createService(connection, void 0, sessionView));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.ok(service.getTurns("ua-a").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
    assert.strictEqual(service.getSessions().find((item) => item.id === "ua-a").turns.length, 0);
    service.switchSession("ua-b");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const kept = service.getTurns("ua-a");
    assert.ok(kept.some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT), "leaving the session must not wipe its message count");
    assert.ok(service.getTurns("ua-b").some((turn) => turn.text === LEFTOVER_CACHE_TURN_TEXT));
  });
  test("countPendingConfirmations keeps leftover pending while pairingPending then true disconnect uses stub", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    const sessionView = store.add(new LeftoverProjectionSessionView());
    connection.setListSessions([{ sessionId: "ua-cache", title: "Cached UA" }]);
    const service = store.add(createService(connection, void 0, sessionView));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    const lease = store.add(service.acquireSessionView("ua-cache"));
    assert.ok(await lease.whenBindReady?.());
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(service.isEngineConnected(), true);
    assert.strictEqual(isConversationPairingHold(connection), false);
    const leftoverPending = service.countPendingConfirmations("ua-cache");
    assert.ok(leftoverPending > 0);
    connection.setPairingPending(true);
    assert.strictEqual(connection.isEngineConnected(), false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.countPendingConfirmations("ua-cache"), leftoverPending);
    connection.setPairingPending(false);
    connection.setConnected(false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "disconnected");
    assert.strictEqual(isConversationPairingHold(connection), false);
    assert.strictEqual(service.countPendingConfirmations("ua-cache"), 0);
  });
  test("pairingPending first-pull without leftover cache countPendingConfirmations stays 0", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-empty", title: "Empty UA" }]);
    const service = store.add(createService(connection));
    connection.setPairingPending(true);
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(service);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.strictEqual(connection.getConnectionPhase().kind, "connected");
    assert.strictEqual(isConversationPairingHold(connection), true);
    assert.strictEqual(service.countPendingConfirmations("ua-empty"), 0);
  });
  test("countPendingConfirmations counts permission pending actions and skips question", async () => {
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    const question = {
      requestId: "q-1",
      summary: {
        kind: "question",
        title: "Pick",
        items: [{ id: "q", title: "Q", optionsPreview: ["a"] }],
        answerKeysValid: true
      }
    };
    const permission = {
      requestId: "p-1",
      summary: { kind: "permission", title: "Allow", permissionKind: "shell" }
    };
    const withPending = (pendingActions) => {
      const base = stubTurnsToSnapshot("ua-only", []);
      return { ...base, snapshot: { ...base.snapshot, pendingActions } };
    };
    stubCachedProjection(service, "ua-only", withPending([question]));
    assert.strictEqual(service.countPendingConfirmations("ua-only"), 0);
    assert.strictEqual(service.hasPendingAttentionSeat("ua-only"), true);
    stubCachedProjection(service, "ua-only", withPending([permission, question]));
    assert.strictEqual(service.countPendingConfirmations("ua-only"), 1);
    assert.strictEqual(service.hasPendingAttentionSeat("ua-only"), true);
    const tool = {
      requestId: "t-1",
      summary: { kind: "tool", title: "Run", toolName: "shell", status: "running", respondable: true }
    };
    stubCachedProjection(service, "ua-only", withPending([tool]));
    assert.strictEqual(service.countPendingConfirmations("ua-only"), 0);
    assert.strictEqual(service.hasPendingAttentionSeat("ua-only"), false);
    stubCachedProjection(service, "ua-only", withPending([]));
    assert.strictEqual(service.countPendingConfirmations("ua-only"), 0);
    assert.strictEqual(service.hasPendingAttentionSeat("ua-only"), false);
  });
  test("does not leak unhandled rejection when setEngineConnected refreshEngineCatalog catch-path persist throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    class CatchPathSaveRoster extends ConversationEngineRosterService {
      saveRosterStorage(_state) {
        throw paintBoom;
      }
    }
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.listSessionsError = new Error("Query does not return results");
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new CatchPathSaveRoster(
      connection,
      new MockUniverseAgentSessionView(),
      workspaceToolsGate,
      storage
    ));
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      service.setEngineConnected(true);
    });
  });
  test("does not leak unhandled rejection when onUaConnectionChanged refreshEngineCatalog catch-path persist throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    class CatchPathSaveRoster extends ConversationEngineRosterService {
      saveRosterStorage(_state) {
        throw paintBoom;
      }
    }
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.listSessionsError = new Error("Query does not return results");
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    store.add(new CatchPathSaveRoster(
      connection,
      new MockUniverseAgentSessionView(),
      workspaceToolsGate,
      storage
    ));
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      connection.setConnected(true);
    });
  });
  test("does not leak unhandled rejection when createSession catch-path fire throws and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    class CreateSessionCatchRoster extends ConversationEngineRosterService {
      constructor() {
        super(...arguments);
        this.throwOnAcquire = false;
      }
      acquireSessionView(sessionId) {
        if (this.throwOnAcquire) {
          throw new Error("acquire boom");
        }
        return super.acquireSessionView(sessionId);
      }
    }
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const workspaceToolsGate = { _serviceBrand: void 0, shouldAdvertise: () => true };
    const service = store.add(new CreateSessionCatchRoster(
      connection,
      createSessionViewMock(),
      workspaceToolsGate,
      storage
    ));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    service._onDidFailEngineAction.fire = () => {
      throw paintBoom;
    };
    service.throwOnAcquire = true;
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      assert.strictEqual(service.createSession(), "");
    });
  });
  test("does not leak unhandled rejection when retryError continueGeneration postIfHeld rejects and onUnexpectedError warn-then-rethrows", async () => {
    const paintBoom = new Error("paint boom");
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-only", title: "Only UA" }]);
    const service = store.add(createService(connection, storage));
    connection.setConnected(true);
    service.setEngineConnected(true);
    await awaitEngineCatalogRefresh(service);
    const frameSource = service.engineFrameSource;
    frameSource.postIfHeld = () => Promise.reject(paintBoom);
    await assertWarnThenRethrowDoesNotLeak(paintBoom, () => {
      assert.strictEqual(service.retryError("ua-only", { messageId: "msg-1" }), true);
    });
  });
  test("engine roster fire-and-forget voids double-catch onUnexpectedError", async () => {
    const source = await __readFileInTests(`${process.cwd()}/src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts`);
    const doubleCatch = ".catch(onUnexpectedError).catch(onUnexpectedError)";
    assert.ok(source.includes(`void this.refreshEngineCatalog()${doubleCatch}`));
    assert.ok(source.includes(`void this.ensureEngineSession().then(() => {`));
    assert.ok(source.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
    assert.ok(/void this\.ensureEngineSession\(\)\.then\(\(\) => \{\s*this\.bindLiveTreeObservationLease\(\);\s*\}\)\.catch\(error => \{[\s\S]*?\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/.test(source));
    assert.ok(source.includes(`void this.monitorPendingEngineSessionBind(sessionId, lease)${doubleCatch}`));
    assert.ok(source.includes(`void this.monitorListedEngineSessionBind(sessionId, lease, this.listedBindMonitorGeneration)${doubleCatch}`));
    assert.ok(source.includes(`void pending${doubleCatch}`));
    assert.ok(!source.includes("void this.refreshEngineCatalog();"));
    assert.ok(!source.includes("void this.monitorPendingEngineSessionBind(sessionId, lease);"));
    assert.ok(!source.includes("void this.monitorListedEngineSessionBind(sessionId, lease, this.listedBindMonitorGeneration);"));
    assert.ok(!source.includes("void pending;"));
    assert.ok(source.includes("void this.engineSessionEnsure.finally(() => {"));
    assert.strictEqual((source.match(/void this\.refreshEngineCatalog\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
  });
  test("persisted engine cache keeps session workDir across list refresh and roster restart", async () => {
    const workDir = "/tmp/r08-session-workdir";
    const storage = store.add(new TestStorageService());
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setListSessions([{ sessionId: "ua-wd", title: "Workdir UA", workDir }]);
    const first = store.add(createService(connection, storage));
    connection.setConnected(true);
    await awaitEngineCatalogRefresh(first);
    assert.strictEqual(first.getSessions().find((session) => session.id === "ua-wd")?.workDir, workDir);
    first.switchSession("ua-wd");
    const rawAfterSwitch = storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "";
    assert.ok(rawAfterSwitch.includes(workDir));
    connection.setListSessions([{ sessionId: "ua-wd", title: "Workdir UA refreshed", workDir }]);
    await first.refreshEngineCatalog();
    await awaitEngineCatalogRefresh(first);
    const rawAfterList = storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "";
    assert.ok(rawAfterList.includes(workDir));
    const second = store.add(createService(store.add(new MockUniverseAgentConnection()), storage));
    assert.strictEqual(second.getSessions().find((session) => session.id === "ua-wd")?.workDir, workDir);
  });
  test("engine cache buckets by engine identity and does not apply another engine or the legacy cache", async () => {
    const cached = (id, title) => ({
      id,
      title,
      turns: [],
      source: "engine-cache"
    });
    const storage = store.add(new TestStorageService());
    storage.store(
      CONVERSATION_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        wasEverConnected: true,
        activeSessionId: "session-legacy",
        nextTurnId: 100,
        localSessions: [],
        engineCache: {
          activeSessionId: "session-legacy",
          sessions: [cached("session-legacy", "Legacy")]
        },
        engineCaches: {
          "engine-a": {
            activeSessionId: "session-a",
            sessions: [cached("session-a", "Engine A")]
          },
          "engine-b": {
            activeSessionId: "session-b",
            sessions: [cached("session-b", "Engine B")]
          }
        }
      }),
      StorageScope.WORKSPACE,
      StorageTarget.USER
    );
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setPublishedLink("engine-a", 1, true);
    const service = store.add(new ConversationEngineRosterService(
      connection,
      createSessionViewMock(),
      { _serviceBrand: void 0, shouldAdvertise: () => true },
      storage
    ));
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["session-a"]);
    connection.listSessionsError = new Error("list down");
    connection.setPublishedLink("engine-b", 2, true);
    await service.whenEngineCatalogRefreshComplete();
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["session-b"]);
    const afterSwitch = JSON.parse(storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "{}");
    assert.deepStrictEqual(afterSwitch.engineCache?.sessions?.map((session) => session.id), ["session-legacy"]);
    assert.deepStrictEqual(afterSwitch.engineCaches?.["engine-a"]?.sessions?.map((session) => session.id), ["session-a"]);
    assert.deepStrictEqual(afterSwitch.engineCaches?.["engine-b"]?.sessions?.map((session) => session.id), ["session-b"]);
    connection.listSessionsError = void 0;
    connection.setPublishedLink(void 0, void 0, false);
    assert.strictEqual(service.isEngineConnected(), false);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["session-b"]);
    const afterClear = JSON.parse(storage.get(CONVERSATION_ROSTER_STORAGE_KEY, StorageScope.WORKSPACE) ?? "{}");
    assert.deepStrictEqual(afterClear.engineCache?.sessions?.map((session) => session.id), ["session-legacy"]);
    assert.deepStrictEqual(afterClear.engineCaches?.["engine-a"]?.sessions?.map((session) => session.id), ["session-a"]);
    assert.deepStrictEqual(afterClear.engineCaches?.["engine-b"]?.sessions?.map((session) => session.id), ["session-b"]);
  });
  test("cold start after disconnect restores keyed roster bucket from lastDisplayedEngineIdentityId", () => {
    const cached = (id, title) => ({
      id,
      title,
      turns: [],
      source: "engine-cache"
    });
    const storage = store.add(new TestStorageService());
    storage.store(
      CONVERSATION_ROSTER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        wasEverConnected: true,
        activeSessionId: "session-keyed",
        nextTurnId: 100,
        localSessions: [],
        lastDisplayedEngineIdentityId: "engine-keyed",
        engineCache: {
          activeSessionId: "session-legacy",
          sessions: [cached("session-legacy", "Legacy")]
        },
        engineCaches: {
          "engine-keyed": {
            activeSessionId: "session-keyed",
            sessions: [cached("session-keyed", "Keyed cold start")]
          }
        }
      }),
      StorageScope.WORKSPACE,
      StorageTarget.USER
    );
    const connection = store.add(new MockUniverseAgentConnection());
    connection.setPublishedLink(void 0, void 0, false);
    assert.strictEqual(connection.getConnectionSnapshot().engineIdentityId, void 0);
    const service = store.add(new ConversationEngineRosterService(
      connection,
      createSessionViewMock(),
      { _serviceBrand: void 0, shouldAdvertise: () => true },
      storage
    ));
    assert.strictEqual(service.isEngineConnected(), false);
    assert.deepStrictEqual(service.getSessions().map((session) => session.id), ["session-keyed"]);
    assert.ok(!service.getSessions().some((session) => session.id === "session-legacy"));
  });
});
export {
  MockUniverseAgentConnection
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi90ZXN0L2Jyb3dzZXIvY29udmVyc2F0aW9uRW5naW5lUm9zdGVyU2VydmljZS50ZXN0LnRzIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsaUJBQWlCLGVBQWU7QUFDekMsU0FBUyxjQUFjLGlDQUFpQztBQUN4RCxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVksaUJBQWlCLG9CQUFvQjtBQUMxRCxTQUFTLCtDQUErQztBQUN4RCxTQUFTLGNBQWMscUJBQXFCO0FBQzVDLFNBQVMsZ0RBQWdEO0FBV3pELFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsaUNBQWlDLCtCQUErQiwwQ0FBMEM7QUFDbkgsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxpQkFBaUQ7QUFDMUQsU0FBUyxxQkFBcUIsaUJBQWlCLHlCQUE2RDtBQUM1RyxTQUFTLG9DQUFvQztBQUU3QyxTQUFTLHVDQUF5RTtBQUNsRixTQUFTLG1DQUFtQywwQkFBMEIsMkJBQTJCO0FBQ2pHLFNBQVMsMEJBQTBCLGlDQUFpQztBQUNwRSxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdDQUFnQztBQUdsQyxNQUFNLG9DQUFvQyxXQUErQztBQUFBLEVBQXpGO0FBQUE7QUFFTixTQUFTLG9CQUFvQixNQUFNO0FBQ25DLFNBQVMsa0JBQWtCLE1BQU07QUFDakMsU0FBUyx5QkFBeUIsTUFBTTtBQUN4QyxTQUFTLE9BQU87QUFBQSxNQUNmLGNBQWMsWUFBWSxDQUFDO0FBQUEsTUFDM0IsVUFBVSxZQUFZLENBQUM7QUFBQSxNQUN2QixVQUFVLFlBQVk7QUFBQSxJQUN2QjtBQUNBLFNBQVEsWUFBWTtBQUNwQixTQUFRLGlCQUFpQjtBQUV6QixTQUFRLFdBQXNFLENBQUM7QUFDL0UsU0FBaUIseUJBQXlCLElBQUksUUFBeUM7QUFDdkYsU0FBUyx3QkFBd0IsS0FBSyx1QkFBdUI7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
