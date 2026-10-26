import { onUnexpectedError } from "../../../../base/common/errors.js";
import { IAgentSessionContext } from "../../../services/agentSession/common/agentSessionContext.js";
import { ensureCapabilitySnapshot } from "../../../../platform/universeAgent/common/universeAgentRendererSync.js";
import { COMPOSER_AGENT_OPTIONS, composerAgentSelectOptions, composerEnabledModelIds, composerModelIds, composerModelSelectionIndex, composerModelSelectOptions, composerToolNames } from "./conversationComposerCatalog.js";
import { isConversationSessionNotReady } from "./conversationSessionAvailability.js";
import { isConversationPairingHold } from "./conversationSessionStatus.js";
import { rejectKeepLeftoverListFailWrite, rejectPairingHoldWrite } from "./conversationLensSessionBinding.js";
import {
  conversationLensDockCatalogProbing,
  conversationLensDockNoAgent,
  conversationLensDockNoModel
} from "./conversationLensDockStrings.js";
import {
  loadUaClientComposerDraft,
  removeUaClientComposerDraftsForSession,
  sessionIdFromUaClientComposerDraftEntryKey,
  storeUaClientComposerDraft,
  uaClientComposerDraftEntryKey
} from "./uaClientComposerDrafts.js";
import { shouldRestoreComposerDrafts } from "../common/uaClientSettingsHelpers.js";
import { ensureSessionModelProfileIds, isComposerStreaming, isSessionSwitchAgentAvailable } from "./conversationLensComposerChrome.js";
import { applyComposerSurfaceText, composerDraftText, composerSubmitText, turnEditLoadedPayload } from "./conversationComposerRefs.js";
function refreshComposerCatalogs(host) {
  const generation = ++host.composerCatalogGeneration;
  if (isConversationPairingHold(host.uaConnection) || !host.stubService.isEngineConnected()) {
    if (keepComposerCatalogForPairingHold(host)) {
      restoreComposerCatalogLeftoverOrKeepPainted(host);
      host.updateSendEnabled();
      host.updateGateRow();
      return;
    }
    const sessionId = host.getBoundSessionId();
    const { agentIndex } = host.getSessionConfig(sessionId);
    if (isSessionSwitchAgentAvailable(host)) {
      const clampedAgentIndex = Math.min(agentIndex, COMPOSER_AGENT_OPTIONS.length - 1);
      host.agentSelectBox.setOptions(COMPOSER_AGENT_OPTIONS.map((text) => ({ text })), clampedAgentIndex);
    } else {
      host.agentSelectBox.setOptions([{ text: conversationLensDockNoAgent }], 0);
    }
    host.modelSelectBox.setOptions([{ text: conversationLensDockNoModel }], 0);
    host.modelSelectedIndex = 0;
    host.catalogModelIds = [""];
    host.enabledModelIds = [];
    host.catalogToolNames = [];
    host.updateSendEnabled();
    host.updateGateRow();
    return;
  }
  keepLastGoodComposerCatalogOrEmpty(host);
  host.updateSendEnabled();
  host.updateGateRow();
  void loadConnectedComposerCatalogs(host, generation).catch(onUnexpectedError).catch(onUnexpectedError);
}
const lastGoodComposerCatalogs = /* @__PURE__ */ new WeakMap();
function rememberLastGoodComposerCatalog(host, patch) {
  const prev = lastGoodComposerCatalogs.get(host) ?? {};
  lastGoodComposerCatalogs.set(host, { ...prev, ...patch });
}
function applyUnknownComposerCatalogHonesty(host, caps) {
  const last = lastGoodComposerCatalogs.get(host);
  if (caps.agentProfiles.support === "UNKNOWN" && isSessionSwitchAgentAvailable(host)) {
    if (last?.agent) {
      const { agentIndex } = host.getSessionConfig(host.getBoundSessionId());
      host.agentSelectBox.setOptions(last.agent.options, Math.min(agentIndex, last.agent.options.length - 1));
    } else {
      host.agentSelectBox.setOptions([{ text: conversationLensDockCatalogProbing }], 0);
    }
  }
  if (caps.models.support === "UNKNOWN") {
    if (last?.model) {
      host.modelSelectBox.setOptions(last.model.options, last.model.selectedIndex);
      host.modelSelectedIndex = last.model.selectedIndex;
      host.catalogModelIds = last.model.ids;
      host.enabledModelIds = last.model.enabledIds;
    } else {
      host.modelSelectBox.setOptions([{ text: conversationLensDockCatalogProbing }], 0);
      host.modelSelectedIndex = 0;
      host.catalogModelIds = [""];
      host.enabledModelIds = [];
    }
  }
  if (caps.tools.support === "UNKNOWN") {
    if (last?.tools) {
      host.catalogToolNames = last.tools.names;
    }
  }
}
function restoreLastGoodComposerCatalogOnSupportedThrow(host, facet) {
  const last = lastGoodComposerCatalogs.get(host);
  if (facet === "agent") {
    if (!isSessionSwitchAgentAvailable(host)) {
      return;
    }
    if (last?.agent) {
      const { agentIndex } = host.getSessionConfig(host.getBoundSessionId());
      host.agentSelectBox.setOptions(last.agent.options, Math.min(agentIndex, last.agent.options.length - 1));
      return;
    }
    host.agentSelectBox.setOptions([{ text: conversationLensDockNoAgent }], 0);
    return;
  }
  if (facet === "model") {
    if (last?.model) {
      host.modelSelectBox.setOptions(last.model.options, last.model.selectedIndex);
      host.modelSelectedIndex = last.model.selectedIndex;
      host.catalogModelIds = last.model.ids;
      host.enabledModelIds = last.model.enabledIds;
      return;
    }
    host.modelSelectBox.setOptions([{ text: conversationLensDockNoModel }], 0);
    host.modelSelectedIndex = 0;
    host.catalogModelIds = [""];
    host.enabledModelIds = [];
    return;
  }
  host.catalogToolNames = last?.tools ? last.tools.names : [];
}
function keepLastGoodComposerCatalogOrEmpty(host) {
  restoreLastGoodComposerCatalogOnSupportedThrow(host, "agent");
  restoreLastGoodComposerCatalogOnSupportedThrow(host, "model");
  restoreLastGoodComposerCatalogOnSupportedThrow(host, "tools");
}
function hasComposerCatalogLeftover(host) {
  const last = lastGoodComposerCatalogs.get(host);
  if (last?.agent || last?.model || last?.tools) {
    return true;
  }
  if (host.catalogToolNames.length > 0) {
    return true;
  }
  return host.catalogModelIds.some((id) => id.length > 0);
}
function keepComposerCatalogForPairingHold(host) {
  return isConversationPairingHold(host.uaConnection) && hasComposerCatalogLeftover(host);
}
function restoreComposerCatalogLeftoverOrKeepPainted(host) {
  if (lastGoodComposerCatalogs.get(host)) {
    keepLastGoodComposerCatalogOrEmpty(host);
  }
}
function activeComposerProjectPath(host) {
  const instantiationService = host.instantiationService;
  if (!instantiationService) {
    return void 0;
  }
  let session;
  try {
    session = instantiationService.invokeFunction((accessor) => accessor.get(IAgentSessionContext));
  } catch {
    return void 0;
  }
  const boundSessionId = host.getBoundSessionId?.();
  if (boundSessionId && session?.getWorkRoot) {
    const boundWorkDir = session.getWorkRoot(boundSessionId)?.workDir?.trim();
    if (boundWorkDir) {
      return boundWorkDir;
    }
  }
  const projectPath = session?.getActiveWorkRoot?.().workDir?.trim();
  return projectPath || void 0;
}
async function loadConnectedComposerCatalogs(host, generation) {
  const caps = ensureCapabilitySnapshot(host.uaConnection.getCapabilitySnapshot());
  if (generation !== host.composerCatalogGeneration) {
    return;
  }
  applyUnknownComposerCatalogHonesty(host, caps);
  if (caps.agentProfiles.support === "SUPPORTED" && isSessionSwitchAgentAvailable(host)) {
    try {
      const projectPath = activeComposerProjectPath(host);
      const result = await (projectPath ? host.uaConnection.listAgentProfiles({ projectPath }) : host.uaConnection.listAgentProfiles());
      if (generation !== host.composerCatalogGeneration) {
        return;
      }
      const options = composerAgentSelectOptions(result.profiles);
      const { agentIndex } = host.getSessionConfig(host.getBoundSessionId());
      host.agentSelectBox.setOptions(options, Math.min(agentIndex, options.length - 1));
      rememberLastGoodComposerCatalog(host, { agent: { options } });
    } catch {
      if (generation !== host.composerCatalogGeneration) {
        return;
      }
      restoreLastGoodComposerCatalogOnSupportedThrow(host, "agent");
    }
  }
  if (caps.models.support === "SUPPORTED") {
    try {
      const result = await host.uaConnection.listModels();
      if (generation !== host.composerCatalogGeneration) {
        return;
      }
      const sessionId = host.getBoundSessionId();
      const map = ensureSessionModelProfileIds(host);
      const hasRecord = map.has(sessionId);
      const recordedRaw = hasRecord ? map.get(sessionId) ?? "" : "";
      const explicitEmpty = hasRecord && recordedRaw.trim() === "";
      const recordedId = explicitEmpty ? "" : recordedRaw.trim();
      const snapshotIndex = host.modelSelectedIndex;
      const snapshotIds = host.catalogModelIds;
      const placeholderOnly = snapshotIds.length === 1 && (snapshotIds[0] ?? "").trim() === "";
      const snapshotId = !hasRecord && !placeholderOnly && snapshotIndex >= 0 ? (snapshotIds[snapshotIndex] ?? "").trim() : "";
      const previousId = recordedId || snapshotId;
      const options = composerModelSelectOptions(result.models);
      const ids = composerModelIds(result.models);
      const enabledIds = composerEnabledModelIds(result.models);
      const selectedIndex = composerModelSelectionIndex(ids, result.models, previousId, explicitEmpty);
      host.modelSelectBox.setOptions(options, selectedIndex);
      host.modelSelectedIndex = selectedIndex;
      host.catalogModelIds = ids;
      host.enabledModelIds = enabledIds;
      const chosen = (ids[selectedIndex] ?? "").trim();
      if (chosen) {
        map.set(sessionId, chosen);
      } else {
        map.set(sessionId, "");
      }
      rememberLastGoodComposerCatalog(host, { model: { options, ids, selectedIndex, enabledIds } });
    } catch {
      if (generation !== host.composerCatalogGeneration) {
        return;
      }
      restoreLastGoodComposerCatalogOnSupportedThrow(host, "model");
    }
  }
  if (caps.tools.support === "SUPPORTED") {
    try {
      const result = await host.uaConnection.listTools();
      if (generation !== host.composerCatalogGeneration) {
        return;
      }
      const names = composerToolNames(result.tools);
      host.catalogToolNames = names;
      rememberLastGoodComposerCatalog(host, { tools: { names } });
    } catch {
      if (generation !== host.composerCatalogGeneration) {
        return;
      }
      restoreLastGoodComposerCatalogOnSupportedThrow(host, "tools");
    }
  }
}
function postBound(host, msg, sessionViewLease) {
  if (isConversationPairingHold(host.uaConnection)) {
    return Promise.resolve({ accepted: false, reason: "no_such_session" });
  }
  if (msg.kind === "clientToolRespond" && host.stubService.isEngineConnected()) {
    const forwarded = host.stubService.respondClientTool(
      host.getBoundSessionId(),
      msg.requestId,
      { content: msg.resultJson }
    );
    return Promise.resolve(forwarded ? { accepted: true, correlation: { id: `clientTool:${msg.requestId}` } } : { accepted: false, reason: "no_such_session" });
  }
  if (isConversationSessionNotReady(host.stubService)) {
    return Promise.resolve({ accepted: false, reason: "no_such_session" });
  }
  const lease = sessionViewLease ?? host.sessionViewLease;
  if (!lease) {
    return Promise.resolve({ accepted: false, reason: "no_such_session" });
  }
  return lease.post(msg);
}
async function submitDraft(host) {
  if (host.submitInFlight || isComposerStreaming(host)) {
    return;
  }
  if (host.composerPolicy === "turnEdit") {
    saveTurnEdit(host);
    return;
  }
  if (host.composerPolicy === "queueEdit") {
    saveQueueEdit(host);
    return;
  }
  const text = composerSubmitText(host);
  if (!text) {
    return;
  }
  if (rejectPairingHoldWrite(host)) {
    return;
  }
  if (rejectKeepLeftoverListFailWrite(host)) {
    return;
  }
  const sessionId = host.getBoundSessionId();
  const connected = host.stubService.isEngineConnected();
  if (!connected && host.stubService.hasEngineConnectionHistory()) {
    if (host.stubService.enqueueMessageQueueItem(sessionId, text)) {
      writeComposerDraft(host, sessionId, "");
      applyComposerSurfaceText(host, "");
      host.resetInputHistoryBrowse();
      host.updateSendEnabled();
      host.updateConversationPhase();
      return;
    }
    writeComposerDraft(host, sessionId, composerDraftText(host));
    host.updateSendEnabled();
    host.showPostFailure("engine_disconnected");
    return;
  }
  host.submitInFlight = true;
  const sessionViewLease = host.sessionViewLease;
  try {
    const modelProfileId = host.catalogModelIds?.[host.modelSelectedIndex] ?? "";
    const outcome = await postBound(host, {
      kind: "submitInput",
      text,
      ...modelProfileId ? { modelProfileId } : {},
      ...host.filterAgentId ? { agentId: host.filterAgentId } : {}
    }, sessionViewLease);
    const stillOnSubmitSession = host.getBoundSessionId() === sessionId;
    if (!outcome.accepted) {
      if (stillOnSubmitSession) {
        host.showPostFailure(outcome.reason);
      }
      return;
    }
    if (readComposerDraft(host, sessionId).trim() === text) {
      writeComposerDraft(host, sessionId, "");
    }
    if (stillOnSubmitSession) {
      if (composerSubmitText(host) === text) {
        applyComposerSurfaceText(host, "");
        host.resetInputHistoryBrowse();
      }
      host.updateSendEnabled();
      host.updateConversationPhase();
    }
  } catch {
    if (host.getBoundSessionId() === sessionId) {
      host.showPostFailure("failed");
    }
  } finally {
    host.submitInFlight = false;
  }
}
function saveTurnEdit(host) {
  const text = composerSubmitText(host);
  if (!text || !host.editingTurnId) {
    return;
  }
  if (rejectPairingHoldWrite(host)) {
    return;
  }
  if (rejectKeepLeftoverListFailWrite(host)) {
    return;
  }
  const sessionId = host.getBoundSessionId();
  const editingTurnId = host.editingTurnId;
  const turn = host.stubService.getTurns(sessionId).find((t) => t.id === editingTurnId && t.kind === "user");
  const loaded = turn ? turnEditLoadedPayload(turn.text) : void 0;
  if (loaded !== void 0 && text === loaded) {
    host.exitComposerEdit();
    return;
  }
  const turnId = turn?.turnId?.trim() || editingTurnId;
  const saved = host.stubService.updateUserTurnText(sessionId, turnId, text, turn?.agentId);
  if (!saved) {
    host.showPostFailure(
      !host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory() ? "engine_disconnected" : "failed"
    );
    return;
  }
  host.exitComposerEdit();
}
function saveQueueEdit(host) {
  const text = composerSubmitText(host);
  const item = host.getEditingQueueItem();
  if (!text || !item) {
    return;
  }
  if (rejectPairingHoldWrite(host)) {
    return;
  }
  if (rejectKeepLeftoverListFailWrite(host)) {
    return;
  }
  const loaded = turnEditLoadedPayload(item.content);
  if (loaded !== void 0 && text === loaded) {
    host.exitComposerEdit();
    return;
  }
  const sessionId = host.getBoundSessionId();
  const itemId = item.id;
  const saved = host.stubService.updateMessageQueueItemContent(sessionId, itemId, text);
  if (!saved) {
    host.showPostFailure(
      !host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory() ? "engine_disconnected" : "failed"
    );
    return;
  }
  host.exitComposerEdit(true, false);
  host.stubService.releaseMessageQueueItemHold(sessionId, itemId);
  host.renderInboxStatus();
}
function composerChatId(host) {
  return host.filterAgentId ?? "default";
}
function draftMapKey(host, sessionId) {
  return uaClientComposerDraftEntryKey(sessionId, composerChatId(host));
}
function readComposerDraft(host, sessionId) {
  const key = draftMapKey(host, sessionId);
  if (host.drafts.has(key)) {
    return host.drafts.get(key) ?? "";
  }
  if (!shouldRestoreComposerDrafts(host.configurationService)) {
    return "";
  }
  const stored = loadUaClientComposerDraft(host.storageService, sessionId, composerChatId(host));
  host.drafts.set(key, stored);
  return stored;
}
function writeComposerDraft(host, sessionId, text) {
  host.drafts.set(draftMapKey(host, sessionId), text);
  if (shouldRestoreComposerDrafts(host.configurationService)) {
    storeUaClientComposerDraft(host.storageService, sessionId, composerChatId(host), text);
  }
}
function restoreComposerDraftToInput(host) {
  if (!host.dockTextarea || host.composerPolicy !== "compose") {
    return;
  }
  applyComposerSurfaceText(host, readComposerDraft(host, host.getBoundSessionId()));
  host.updateSendEnabled();
}
function deleteComposerDraftsForSession(host, sessionId) {
  for (const key of [...host.drafts.keys()]) {
    if (sessionIdFromUaClientComposerDraftEntryKey(key) === sessionId) {
      host.drafts.delete(key);
    }
  }
  removeUaClientComposerDraftsForSession(host.storageService, sessionId);
}
function pruneOrphanComposerDrafts(_host) {
}
export {
  composerChatId,
  deleteComposerDraftsForSession,
  draftMapKey,
  loadConnectedComposerCatalogs,
  postBound,
  pruneOrphanComposerDrafts,
  readComposerDraft,
  refreshComposerCatalogs,
  restoreComposerDraftToInput,
  saveQueueEdit,
  saveTurnEdit,
  submitDraft,
  writeComposerDraft
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL2hvbWUvY2xhcmVuY2UvUHJvamVjdHMvQWdlbnRzL3ZzY29kZS1Xb3JrVHJlZXMvbWVyZ2Uvc3JjL3ZzL3dvcmtiZW5jaC9jb250cmliL2NvbnZlcnNhdGlvbi9icm93c2VyL2NvbnZlcnNhdGlvbkxlbnNDb21wb3Nlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElBZ2VudFNlc3Npb25Db250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYWdlbnRTZXNzaW9uL2NvbW1vbi9hZ2VudFNlc3Npb25Db250ZXh0LmpzJztcbmltcG9ydCB0eXBlIHsgQ29udmVyc2F0aW9uV3JpdGVNZXNzYWdlLCBJQ29udmVyc2F0aW9uU2Vzc2lvblZpZXdMZWFzZSwgUG9zdE91dGNvbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi9jb252ZXJzYXRpb25WaWV3RnJhbWUuanMnO1xuaW1wb3J0IHsgSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHsgZW5zdXJlQ2FwYWJpbGl0eVNuYXBzaG90IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdW5pdmVyc2VBZ2VudC9jb21tb24vdW5pdmVyc2VBZ2VudFJlbmRlcmVyU3luYy5qcyc7XG5pbXBvcnQgdHlwZSB7IFVuaXZlcnNlQWdlbnRDYXBhYmlsaXR5U25hcHNob3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91bml2ZXJzZUFnZW50L2NvbW1vbi91bml2ZXJzZUFnZW50VHlwZXMuanMnO1xuaW1wb3J0IHsgQ09NUE9TRVJfQUdFTlRfT1BUSU9OUywgY29tcG9zZXJBZ2VudFNlbGVjdE9wdGlvbnMsIGNvbXBvc2VyRW5hYmxlZE1vZGVsSWRzLCBjb21wb3Nlck1vZGVsSWRzLCBjb21wb3Nlck1vZGVsU2VsZWN0aW9uSW5kZXgsIGNvbXBvc2VyTW9kZWxTZWxlY3RPcHRpb25zLCBjb21wb3NlclRvb2xOYW1lcyB9IGZyb20gJy4vY29udmVyc2F0aW9uQ29tcG9zZXJDYXRhbG9nLmpzJztcbmltcG9ydCB7IGlzQ29udmVyc2F0aW9uU2Vzc2lvbk5vdFJlYWR5IH0gZnJvbSAnLi9jb252ZXJzYXRpb25TZXNzaW9uQXZhaWxhYmlsaXR5LmpzJztcbmltcG9ydCB7IGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQgfSBmcm9tICcuL2NvbnZlcnNhdGlvblNlc3Npb25TdGF0dXMuanMnO1xuaW1wb3J0IHsgcmVqZWN0S2VlcExlZnRvdmVyTGlzdEZhaWxXcml0ZSwgcmVqZWN0UGFpcmluZ0hvbGRXcml0ZSB9IGZyb20gJy4vY29udmVyc2F0aW9uTGVuc1Nlc3Npb25CaW5kaW5nLmpzJztcbmltcG9ydCB7XG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrQ2F0YWxvZ1Byb2JpbmcsXG5cdGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9BZ2VudCxcblx0Y29udmVyc2F0aW9uTGVuc0RvY2tOb01vZGVsLFxuXHR0eXBlIENvbnZlcnNhdGlvbkNvbXBvc2VyUG9zdEZhaWx1cmVSZWFzb24sXG59IGZyb20gJy4vY29udmVyc2F0aW9uTGVuc0RvY2tTdHJpbmdzLmpzJztcbmltcG9ydCB7IElDb252ZXJzYXRpb25Sb3N0ZXJTZXJ2aWNlIH0gZnJvbSAnLi9jb252ZXJzYXRpb25TdHViU2VydmljZS5qcyc7XG5pbXBvcnQge1xuXHRsb2FkVWFDbGllbnRDb21wb3NlckRyYWZ0LFxuXHRyZW1vdmVVYUNsaWVudENvbXBvc2VyRHJhZnRzRm9yU2Vzc2lvbixcblx0c2Vzc2lvbklkRnJvbVVhQ2xpZW50Q29tcG9zZXJEcmFmdEVudHJ5S2V5LFxuXHRzdG9yZVVhQ2xpZW50Q29tcG9zZXJEcmFmdCxcblx0dWFDbGllbnRDb21wb3NlckRyYWZ0RW50cnlLZXksXG59IGZyb20gJy4vdWFDbGllbnRDb21wb3NlckRyYWZ0cy5qcyc7XG5pbXBvcnQgeyBzaG91bGRSZXN0b3JlQ29tcG9zZXJEcmFmdHMgfSBmcm9tICcuLi9jb21tb24vdWFDbGllbnRTZXR0aW5nc0hlbHBlcnMuanMnO1xuaW1wb3J0IHsgQnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2J1dHRvbi9idXR0b24uanMnO1xuaW1wb3J0IHsgU2VsZWN0Qm94IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NlbGVjdEJveC9zZWxlY3RCb3guanMnO1xuaW1wb3J0IHsgZW5zdXJlU2Vzc2lvbk1vZGVsUHJvZmlsZUlkcywgaXNDb21wb3NlclN0cmVhbWluZywgaXNTZXNzaW9uU3dpdGNoQWdlbnRBdmFpbGFibGUsIHR5cGUgQ29udmVyc2F0aW9uU2Vzc2lvbkNvbmZpZ1NlbGVjdGlvbiB9IGZyb20gJy4vY29udmVyc2F0aW9uTGVuc0NvbXBvc2VyQ2hyb21lLmpzJztcbmltcG9ydCB7IGFwcGx5Q29tcG9zZXJTdXJmYWNlVGV4dCwgY29tcG9zZXJEcmFmdFRleHQsIGNvbXBvc2VyU3VibWl0VGV4dCwgdHVybkVkaXRMb2FkZWRQYXlsb2FkIH0gZnJvbSAnLi9jb252ZXJzYXRpb25Db21wb3NlclJlZnMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0IHtcblx0ZmlsdGVyQWdlbnRJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRjb21wb3NlclBvbGljeTogJ2NvbXBvc2UnIHwgJ3R1cm5FZGl0JyB8ICdxdWV1ZUVkaXQnO1xuXHRzdWJtaXRJbkZsaWdodDogYm9vbGVhbjtcblx0bGFzdEF0dGFjaGVkRW50cmllcz86IHJlYWRvbmx5IHsgcmVhZG9ubHkgc3RyZWFtaW5nPzogYm9vbGVhbjsgcmVhZG9ubHkgdG9vbFN0YXR1cz86IHN0cmluZyB9W107XG5cdGhhc1N0cmVhbWluZ0VudHJ5PzogKCkgPT4gYm9vbGVhbjtcblx0bW9kZWxTZWxlY3RlZEluZGV4OiBudW1iZXI7XG5cdC8qKiBTZXNzaW9uIGlkIFx1MjE5MiBtb2RlbCBwcm9maWxlIGlkLiBOb3QgcGFydCBvZiBDb252ZXJzYXRpb25TZXNzaW9uQ29uZmlnU2VsZWN0aW9uLiAqL1xuXHRtb2RlbFByb2ZpbGVJZEJ5U2Vzc2lvbklkPzogTWFwPHN0cmluZywgc3RyaW5nPjtcblx0Y29tcG9zZXJDYXRhbG9nR2VuZXJhdGlvbjogbnVtYmVyO1xuXHRjYXRhbG9nVG9vbE5hbWVzOiByZWFkb25seSBzdHJpbmdbXTtcblx0Y2F0YWxvZ01vZGVsSWRzOiByZWFkb25seSBzdHJpbmdbXTtcblx0LyoqIEVuYWJsZWQgcmVnaXN0cnkgaWRzIGZyb20gdGhlIGxhc3Qgc3VjY2Vzc2Z1bCBtb2RlbCBsaXN0LiAqL1xuXHRlbmFibGVkTW9kZWxJZHM/OiByZWFkb25seSBzdHJpbmdbXTtcblx0ZHJhZnRzOiBNYXA8c3RyaW5nLCBzdHJpbmc+O1xuXHRlZGl0aW5nVHVybklkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGVkaXRpbmdRdWV1ZUl0ZW1JZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRzZXNzaW9uVmlld0xlYXNlOiBJQ29udmVyc2F0aW9uU2Vzc2lvblZpZXdMZWFzZSB8IHVuZGVmaW5lZDtcblx0ZG9ja1RleHRhcmVhOiBIVE1MVGV4dEFyZWFFbGVtZW50O1xuXHRzZW5kQnV0dG9uOiBCdXR0b247XG5cdGFnZW50U2VsZWN0Qm94OiBTZWxlY3RCb3g7XG5cdG1vZGVsU2VsZWN0Qm94OiBTZWxlY3RCb3g7XG5cdHJlYWRvbmx5IHN0dWJTZXJ2aWNlOiBJQ29udmVyc2F0aW9uUm9zdGVyU2VydmljZTtcblx0cmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U/OiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2U7XG5cdHJlYWRvbmx5IHVhQ29ubmVjdGlvbjogSVVuaXZlcnNlQWdlbnRDb25uZWN0aW9uO1xuXHRnZXRCb3VuZFNlc3Npb25JZCgpOiBzdHJpbmc7XG5cdGdldFNlc3Npb25Db25maWcoc2Vzc2lvbklkOiBzdHJpbmcpOiBDb252ZXJzYXRpb25TZXNzaW9uQ29uZmlnU2VsZWN0aW9uO1xuXHR1cGRhdGVTZW5kRW5hYmxlZCgpOiB2b2lkO1xuXHR1cGRhdGVHYXRlUm93KCk6IHZvaWQ7XG5cdGV4aXRDb21wb3NlckVkaXQocmVzdG9yZUNvbXBvc2VEcmFmdD86IGJvb2xlYW4sIHJlbGVhc2VRdWV1ZUhvbGQ/OiBib29sZWFuKTogdm9pZDtcblx0Z2V0RWRpdGluZ1F1ZXVlSXRlbSgpOiB7IGlkOiBzdHJpbmc7IGNvbnRlbnQ6IHN0cmluZyB9IHwgdW5kZWZpbmVkO1xuXHRzaG93UG9zdEZhaWx1cmUocmVhc29uOiBDb252ZXJzYXRpb25Db21wb3NlclBvc3RGYWlsdXJlUmVhc29uKTogdm9pZDtcblx0cmVzZXRJbnB1dEhpc3RvcnlCcm93c2UoKTogdm9pZDtcblx0cmVuZGVySW5ib3hTdGF0dXMoKTogdm9pZDtcblx0cmVhZENvbXBvc2VyRHJhZnQoc2Vzc2lvbklkOiBzdHJpbmcpOiBzdHJpbmc7XG5cdHVwZGF0ZUNvbnZlcnNhdGlvblBoYXNlKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWZyZXNoQ29tcG9zZXJDYXRhbG9ncyhob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCk6IHZvaWQge1xuXG5cdFx0Y29uc3QgZ2VuZXJhdGlvbiA9ICsraG9zdC5jb21wb3NlckNhdGFsb2dHZW5lcmF0aW9uO1xuXHRcdC8vIEQzMzkgbGVmdG92ZXItbG9va3MtbGl2ZTogcGFpcmluZy1ob2xkIGZpcnN0LiBLRUVQIGlzIG5vdCBvbmx5IGAhY29ubmVjdGVkYC5cblx0XHRpZiAoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChob3N0LnVhQ29ubmVjdGlvbikgfHwgIWhvc3Quc3R1YlNlcnZpY2UuaXNFbmdpbmVDb25uZWN0ZWQoKSkge1xuXHRcdFx0aWYgKGtlZXBDb21wb3NlckNhdGFsb2dGb3JQYWlyaW5nSG9sZChob3N0KSkge1xuXHRcdFx0XHRyZXN0b3JlQ29tcG9zZXJDYXRhbG9nTGVmdG92ZXJPcktlZXBQYWludGVkKGhvc3QpO1xuXHRcdFx0XHRob3N0LnVwZGF0ZVNlbmRFbmFibGVkKCk7XG5cdFx0XHRcdGhvc3QudXBkYXRlR2F0ZVJvdygpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzZXNzaW9uSWQgPSBob3N0LmdldEJvdW5kU2Vzc2lvbklkKCk7XG5cdFx0XHRjb25zdCB7IGFnZW50SW5kZXggfSA9IGhvc3QuZ2V0U2Vzc2lvbkNvbmZpZyhzZXNzaW9uSWQpO1xuXHRcdFx0aWYgKGlzU2Vzc2lvblN3aXRjaEFnZW50QXZhaWxhYmxlKGhvc3QpKSB7XG5cdFx0XHRcdGNvbnN0IGNsYW1wZWRBZ2VudEluZGV4ID0gTWF0aC5taW4oYWdlbnRJbmRleCwgQ09NUE9TRVJfQUdFTlRfT1BUSU9OUy5sZW5ndGggLSAxKTtcblx0XHRcdFx0aG9zdC5hZ2VudFNlbGVjdEJveC5zZXRPcHRpb25zKENPTVBPU0VSX0FHRU5UX09QVElPTlMubWFwKHRleHQgPT4gKHsgdGV4dCB9KSksIGNsYW1wZWRBZ2VudEluZGV4KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIFRoZSBjb250cm9sIGlzIHJlYWQtb25seSB3aGlsZSBTd2l0Y2hBZ2VudCBpcyB1bmF2YWlsYWJsZSwgYnV0IHRoZVxuXHRcdFx0XHQvLyBiYWNraW5nIG9wdGlvbnMgbXVzdCBub3Qga2VlcCBhIHN0YWxlIHByb2ZpbGUgbGlzdCBmcm9tIHRoZSBsYXN0IGNvbm5lY3Rpb24uXG5cdFx0XHRcdGhvc3QuYWdlbnRTZWxlY3RCb3guc2V0T3B0aW9ucyhbeyB0ZXh0OiBjb252ZXJzYXRpb25MZW5zRG9ja05vQWdlbnQgfV0sIDApO1xuXHRcdFx0fVxuXHRcdFx0aG9zdC5tb2RlbFNlbGVjdEJveC5zZXRPcHRpb25zKFt7IHRleHQ6IGNvbnZlcnNhdGlvbkxlbnNEb2NrTm9Nb2RlbCB9XSwgMCk7XG5cdFx0XHRob3N0Lm1vZGVsU2VsZWN0ZWRJbmRleCA9IDA7XG5cdFx0XHRob3N0LmNhdGFsb2dNb2RlbElkcyA9IFsnJ107XG5cdFx0XHRob3N0LmVuYWJsZWRNb2RlbElkcyA9IFtdO1xuXHRcdFx0aG9zdC5jYXRhbG9nVG9vbE5hbWVzID0gW107XG5cdFx0XHRob3N0LnVwZGF0ZVNlbmRFbmFibGVkKCk7XG5cdFx0XHRob3N0LnVwZGF0ZUdhdGVSb3coKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0a2VlcExhc3RHb29kQ29tcG9zZXJDYXRhbG9nT3JFbXB0eShob3N0KTtcblx0XHRob3N0LnVwZGF0ZVNlbmRFbmFibGVkKCk7XG5cdFx0aG9zdC51cGRhdGVHYXRlUm93KCk7XG5cdFx0dm9pZCBsb2FkQ29ubmVjdGVkQ29tcG9zZXJDYXRhbG9ncyhob3N0LCBnZW5lcmF0aW9uKS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcikuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcbn1cblxudHlwZSBMYXN0R29vZENvbXBvc2VyQ2F0YWxvZyA9IHtcblx0YWdlbnQ/OiB7IG9wdGlvbnM6IHsgdGV4dDogc3RyaW5nIH1bXSB9O1xuXHRtb2RlbD86IHsgb3B0aW9uczogeyB0ZXh0OiBzdHJpbmcgfVtdOyBpZHM6IHJlYWRvbmx5IHN0cmluZ1tdOyBzZWxlY3RlZEluZGV4OiBudW1iZXI7IGVuYWJsZWRJZHM6IHJlYWRvbmx5IHN0cmluZ1tdIH07XG5cdHRvb2xzPzogeyBuYW1lczogcmVhZG9ubHkgc3RyaW5nW10gfTtcbn07XG5cbmNvbnN0IGxhc3RHb29kQ29tcG9zZXJDYXRhbG9ncyA9IG5ldyBXZWFrTWFwPElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0LCBMYXN0R29vZENvbXBvc2VyQ2F0YWxvZz4oKTtcblxuZnVuY3Rpb24gcmVtZW1iZXJMYXN0R29vZENvbXBvc2VyQ2F0YWxvZyhob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCwgcGF0Y2g6IExhc3RHb29kQ29tcG9zZXJDYXRhbG9nKTogdm9pZCB7XG5cdGNvbnN0IHByZXYgPSBsYXN0R29vZENvbXBvc2VyQ2F0YWxvZ3MuZ2V0KGhvc3QpID8/IHt9O1xuXHRsYXN0R29vZENvbXBvc2VyQ2F0YWxvZ3Muc2V0KGhvc3QsIHsgLi4ucHJldiwgLi4ucGF0Y2ggfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5VW5rbm93bkNvbXBvc2VyQ2F0YWxvZ0hvbmVzdHkoaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsIGNhcHM6IFVuaXZlcnNlQWdlbnRDYXBhYmlsaXR5U25hcHNob3QpOiB2b2lkIHtcblx0Y29uc3QgbGFzdCA9IGxhc3RHb29kQ29tcG9zZXJDYXRhbG9ncy5nZXQoaG9zdCk7XG5cdGlmIChjYXBzLmFnZW50UHJvZmlsZXMuc3VwcG9ydCA9PT0gJ1VOS05PV04nICYmIGlzU2Vzc2lvblN3aXRjaEFnZW50QXZhaWxhYmxlKGhvc3QpKSB7XG5cdFx0aWYgKGxhc3Q/LmFnZW50KSB7XG5cdFx0XHRjb25zdCB7IGFnZW50SW5kZXggfSA9IGhvc3QuZ2V0U2Vzc2lvbkNvbmZpZyhob3N0LmdldEJvdW5kU2Vzc2lvbklkKCkpO1xuXHRcdFx0aG9zdC5hZ2VudFNlbGVjdEJveC5zZXRPcHRpb25zKGxhc3QuYWdlbnQub3B0aW9ucywgTWF0aC5taW4oYWdlbnRJbmRleCwgbGFzdC5hZ2VudC5vcHRpb25zLmxlbmd0aCAtIDEpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aG9zdC5hZ2VudFNlbGVjdEJveC5zZXRPcHRpb25zKFt7IHRleHQ6IGNvbnZlcnNhdGlvbkxlbnNEb2NrQ2F0YWxvZ1Byb2JpbmcgfV0sIDApO1xuXHRcdH1cblx0fVxuXHRpZiAoY2Fwcy5tb2RlbHMuc3VwcG9ydCA9PT0gJ1VOS05PV04nKSB7XG5cdFx0aWYgKGxhc3Q/Lm1vZGVsKSB7XG5cdFx0XHRob3N0Lm1vZGVsU2VsZWN0Qm94LnNldE9wdGlvbnMobGFzdC5tb2RlbC5vcHRpb25zLCBsYXN0Lm1vZGVsLnNlbGVjdGVkSW5kZXgpO1xuXHRcdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSBsYXN0Lm1vZGVsLnNlbGVjdGVkSW5kZXg7XG5cdFx0XHRob3N0LmNhdGFsb2dNb2RlbElkcyA9IGxhc3QubW9kZWwuaWRzO1xuXHRcdFx0aG9zdC5lbmFibGVkTW9kZWxJZHMgPSBsYXN0Lm1vZGVsLmVuYWJsZWRJZHM7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGhvc3QubW9kZWxTZWxlY3RCb3guc2V0T3B0aW9ucyhbeyB0ZXh0OiBjb252ZXJzYXRpb25MZW5zRG9ja0NhdGFsb2dQcm9iaW5nIH1dLCAwKTtcblx0XHRcdGhvc3QubW9kZWxTZWxlY3RlZEluZGV4ID0gMDtcblx0XHRcdGhvc3QuY2F0YWxvZ01vZGVsSWRzID0gWycnXTtcblx0XHRcdGhvc3QuZW5hYmxlZE1vZGVsSWRzID0gW107XG5cdFx0fVxuXHR9XG5cdGlmIChjYXBzLnRvb2xzLnN1cHBvcnQgPT09ICdVTktOT1dOJykge1xuXHRcdGlmIChsYXN0Py50b29scykge1xuXHRcdFx0aG9zdC5jYXRhbG9nVG9vbE5hbWVzID0gbGFzdC50b29scy5uYW1lcztcblx0XHR9XG5cdH1cbn1cblxuZnVuY3Rpb24gcmVzdG9yZUxhc3RHb29kQ29tcG9zZXJDYXRhbG9nT25TdXBwb3J0ZWRUaHJvdyhob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCwgZmFjZXQ6ICdhZ2VudCcgfCAnbW9kZWwnIHwgJ3Rvb2xzJyk6IHZvaWQge1xuXHRjb25zdCBsYXN0ID0gbGFzdEdvb2RDb21wb3NlckNhdGFsb2dzLmdldChob3N0KTtcblx0aWYgKGZhY2V0ID09PSAnYWdlbnQnKSB7XG5cdFx0aWYgKCFpc1Nlc3Npb25Td2l0Y2hBZ2VudEF2YWlsYWJsZShob3N0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAobGFzdD8uYWdlbnQpIHtcblx0XHRcdGNvbnN0IHsgYWdlbnRJbmRleCB9ID0gaG9zdC5nZXRTZXNzaW9uQ29uZmlnKGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKSk7XG5cdFx0XHRob3N0LmFnZW50U2VsZWN0Qm94LnNldE9wdGlvbnMobGFzdC5hZ2VudC5vcHRpb25zLCBNYXRoLm1pbihhZ2VudEluZGV4LCBsYXN0LmFnZW50Lm9wdGlvbnMubGVuZ3RoIC0gMSkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRob3N0LmFnZW50U2VsZWN0Qm94LnNldE9wdGlvbnMoW3sgdGV4dDogY29udmVyc2F0aW9uTGVuc0RvY2tOb0FnZW50IH1dLCAwKTtcblx0XHRyZXR1cm47XG5cdH1cblx0aWYgKGZhY2V0ID09PSAnbW9kZWwnKSB7XG5cdFx0aWYgKGxhc3Q/Lm1vZGVsKSB7XG5cdFx0XHRob3N0Lm1vZGVsU2VsZWN0Qm94LnNldE9wdGlvbnMobGFzdC5tb2RlbC5vcHRpb25zLCBsYXN0Lm1vZGVsLnNlbGVjdGVkSW5kZXgpO1xuXHRcdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSBsYXN0Lm1vZGVsLnNlbGVjdGVkSW5kZXg7XG5cdFx0XHRob3N0LmNhdGFsb2dNb2RlbElkcyA9IGxhc3QubW9kZWwuaWRzO1xuXHRcdFx0aG9zdC5lbmFibGVkTW9kZWxJZHMgPSBsYXN0Lm1vZGVsLmVuYWJsZWRJZHM7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGhvc3QubW9kZWxTZWxlY3RCb3guc2V0T3B0aW9ucyhbeyB0ZXh0OiBjb252ZXJzYXRpb25MZW5zRG9ja05vTW9kZWwgfV0sIDApO1xuXHRcdGhvc3QubW9kZWxTZWxlY3RlZEluZGV4ID0gMDtcblx0XHRob3N0LmNhdGFsb2dNb2RlbElkcyA9IFsnJ107XG5cdFx0aG9zdC5lbmFibGVkTW9kZWxJZHMgPSBbXTtcblx0XHRyZXR1cm47XG5cdH1cblx0aG9zdC5jYXRhbG9nVG9vbE5hbWVzID0gbGFzdD8udG9vbHMgPyBsYXN0LnRvb2xzLm5hbWVzIDogW107XG59XG5cbmZ1bmN0aW9uIGtlZXBMYXN0R29vZENvbXBvc2VyQ2F0YWxvZ09yRW1wdHkoaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QpOiB2b2lkIHtcblx0cmVzdG9yZUxhc3RHb29kQ29tcG9zZXJDYXRhbG9nT25TdXBwb3J0ZWRUaHJvdyhob3N0LCAnYWdlbnQnKTtcblx0cmVzdG9yZUxhc3RHb29kQ29tcG9zZXJDYXRhbG9nT25TdXBwb3J0ZWRUaHJvdyhob3N0LCAnbW9kZWwnKTtcblx0cmVzdG9yZUxhc3RHb29kQ29tcG9zZXJDYXRhbG9nT25TdXBwb3J0ZWRUaHJvdyhob3N0LCAndG9vbHMnKTtcbn1cblxuZnVuY3Rpb24gaGFzQ29tcG9zZXJDYXRhbG9nTGVmdG92ZXIoaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QpOiBib29sZWFuIHtcblx0Y29uc3QgbGFzdCA9IGxhc3RHb29kQ29tcG9zZXJDYXRhbG9ncy5nZXQoaG9zdCk7XG5cdGlmIChsYXN0Py5hZ2VudCB8fCBsYXN0Py5tb2RlbCB8fCBsYXN0Py50b29scykge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGlmIChob3N0LmNhdGFsb2dUb29sTmFtZXMubGVuZ3RoID4gMCkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdHJldHVybiBob3N0LmNhdGFsb2dNb2RlbElkcy5zb21lKGlkID0+IGlkLmxlbmd0aCA+IDApO1xufVxuXG5mdW5jdGlvbiBrZWVwQ29tcG9zZXJDYXRhbG9nRm9yUGFpcmluZ0hvbGQoaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QpOiBib29sZWFuIHtcblx0cmV0dXJuIGlzQ29udmVyc2F0aW9uUGFpcmluZ0hvbGQoaG9zdC51YUNvbm5lY3Rpb24pICYmIGhhc0NvbXBvc2VyQ2F0YWxvZ0xlZnRvdmVyKGhvc3QpO1xufVxuXG5mdW5jdGlvbiByZXN0b3JlQ29tcG9zZXJDYXRhbG9nTGVmdG92ZXJPcktlZXBQYWludGVkKGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0KTogdm9pZCB7XG5cdGlmIChsYXN0R29vZENvbXBvc2VyQ2F0YWxvZ3MuZ2V0KGhvc3QpKSB7XG5cdFx0a2VlcExhc3RHb29kQ29tcG9zZXJDYXRhbG9nT3JFbXB0eShob3N0KTtcblx0fVxufVxuXG4vKiogQWN0aXZlIHNlc3Npb24gd29yayByb290LiBNaXNzaW5nIEFQSSBrZWVwcyB0aGUgY29ubmVjdGlvbiB3b3JrRGlyIGZhbGxiYWNrLiAqL1xuZnVuY3Rpb24gYWN0aXZlQ29tcG9zZXJQcm9qZWN0UGF0aChob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gaG9zdC5pbnN0YW50aWF0aW9uU2VydmljZTtcblx0aWYgKCFpbnN0YW50aWF0aW9uU2VydmljZSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0bGV0IHNlc3Npb246IElBZ2VudFNlc3Npb25Db250ZXh0IHwgdW5kZWZpbmVkO1xuXHR0cnkge1xuXHRcdHNlc3Npb24gPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBhY2Nlc3Nvci5nZXQoSUFnZW50U2Vzc2lvbkNvbnRleHQpKTtcblx0fSBjYXRjaCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRjb25zdCBib3VuZFNlc3Npb25JZCA9IGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQ/LigpO1xuXHRpZiAoYm91bmRTZXNzaW9uSWQgJiYgc2Vzc2lvbj8uZ2V0V29ya1Jvb3QpIHtcblx0XHRjb25zdCBib3VuZFdvcmtEaXIgPSBzZXNzaW9uLmdldFdvcmtSb290KGJvdW5kU2Vzc2lvbklkKT8ud29ya0Rpcj8udHJpbSgpO1xuXHRcdGlmIChib3VuZFdvcmtEaXIpIHtcblx0XHRcdHJldHVybiBib3VuZFdvcmtEaXI7XG5cdFx0fVxuXHR9XG5cdGNvbnN0IHByb2plY3RQYXRoID0gc2Vzc2lvbj8uZ2V0QWN0aXZlV29ya1Jvb3Q/LigpLndvcmtEaXI/LnRyaW0oKTtcblx0cmV0dXJuIHByb2plY3RQYXRoIHx8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRDb25uZWN0ZWRDb21wb3NlckNhdGFsb2dzKGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0LCBnZW5lcmF0aW9uOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGNvbnN0IGNhcHMgPSBlbnN1cmVDYXBhYmlsaXR5U25hcHNob3QoaG9zdC51YUNvbm5lY3Rpb24uZ2V0Q2FwYWJpbGl0eVNuYXBzaG90KCkpO1xuXHRcdGlmIChnZW5lcmF0aW9uICE9PSBob3N0LmNvbXBvc2VyQ2F0YWxvZ0dlbmVyYXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YXBwbHlVbmtub3duQ29tcG9zZXJDYXRhbG9nSG9uZXN0eShob3N0LCBjYXBzKTtcblx0XHRpZiAoY2Fwcy5hZ2VudFByb2ZpbGVzLnN1cHBvcnQgPT09ICdTVVBQT1JURUQnICYmIGlzU2Vzc2lvblN3aXRjaEFnZW50QXZhaWxhYmxlKGhvc3QpKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBwcm9qZWN0UGF0aCA9IGFjdGl2ZUNvbXBvc2VyUHJvamVjdFBhdGgoaG9zdCk7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IChwcm9qZWN0UGF0aFxuXHRcdFx0XHRcdD8gaG9zdC51YUNvbm5lY3Rpb24ubGlzdEFnZW50UHJvZmlsZXMoeyBwcm9qZWN0UGF0aCB9KVxuXHRcdFx0XHRcdDogaG9zdC51YUNvbm5lY3Rpb24ubGlzdEFnZW50UHJvZmlsZXMoKSk7XG5cdFx0XHRcdGlmIChnZW5lcmF0aW9uICE9PSBob3N0LmNvbXBvc2VyQ2F0YWxvZ0dlbmVyYXRpb24pIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3Qgb3B0aW9ucyA9IGNvbXBvc2VyQWdlbnRTZWxlY3RPcHRpb25zKHJlc3VsdC5wcm9maWxlcyk7XG5cdFx0XHRcdGNvbnN0IHsgYWdlbnRJbmRleCB9ID0gaG9zdC5nZXRTZXNzaW9uQ29uZmlnKGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKSk7XG5cdFx0XHRcdGhvc3QuYWdlbnRTZWxlY3RCb3guc2V0T3B0aW9ucyhvcHRpb25zLCBNYXRoLm1pbihhZ2VudEluZGV4LCBvcHRpb25zLmxlbmd0aCAtIDEpKTtcblx0XHRcdFx0cmVtZW1iZXJMYXN0R29vZENvbXBvc2VyQ2F0YWxvZyhob3N0LCB7IGFnZW50OiB7IG9wdGlvbnMgfSB9KTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gaG9zdC5jb21wb3NlckNhdGFsb2dHZW5lcmF0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3RvcmVMYXN0R29vZENvbXBvc2VyQ2F0YWxvZ09uU3VwcG9ydGVkVGhyb3coaG9zdCwgJ2FnZW50Jyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjYXBzLm1vZGVscy5zdXBwb3J0ID09PSAnU1VQUE9SVEVEJykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgaG9zdC51YUNvbm5lY3Rpb24ubGlzdE1vZGVscygpO1xuXHRcdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gaG9zdC5jb21wb3NlckNhdGFsb2dHZW5lcmF0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHNlc3Npb25JZCA9IGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKTtcblx0XHRcdFx0Y29uc3QgbWFwID0gZW5zdXJlU2Vzc2lvbk1vZGVsUHJvZmlsZUlkcyhob3N0KTtcblx0XHRcdFx0Y29uc3QgaGFzUmVjb3JkID0gbWFwLmhhcyhzZXNzaW9uSWQpO1xuXHRcdFx0XHRjb25zdCByZWNvcmRlZFJhdyA9IGhhc1JlY29yZCA/IChtYXAuZ2V0KHNlc3Npb25JZCkgPz8gJycpIDogJyc7XG5cdFx0XHRcdGNvbnN0IGV4cGxpY2l0RW1wdHkgPSBoYXNSZWNvcmQgJiYgcmVjb3JkZWRSYXcudHJpbSgpID09PSAnJztcblx0XHRcdFx0Y29uc3QgcmVjb3JkZWRJZCA9IGV4cGxpY2l0RW1wdHkgPyAnJyA6IHJlY29yZGVkUmF3LnRyaW0oKTtcblx0XHRcdFx0Ly8gSW5kZXggMCBhbmQgYSBwbGFjZWhvbGRlci1vbmx5IFsnJ10gY2F0YWxvZyBhcmUgbm90IGFuIGFwcGxpZWQgbW9kZWwuXG5cdFx0XHRcdC8vIEEgbm9uLWVtcHR5IGlkIHN0dWZmZWQgYXQgaW5kZXggMCBpcyBub3QgYSByZWNvcmRlZCBjaG9pY2UgZWl0aGVyLlxuXHRcdFx0XHRjb25zdCBzbmFwc2hvdEluZGV4ID0gaG9zdC5tb2RlbFNlbGVjdGVkSW5kZXg7XG5cdFx0XHRcdGNvbnN0IHNuYXBzaG90SWRzID0gaG9zdC5jYXRhbG9nTW9kZWxJZHM7XG5cdFx0XHRcdGNvbnN0IHBsYWNlaG9sZGVyT25seSA9IHNuYXBzaG90SWRzLmxlbmd0aCA9PT0gMSAmJiAoc25hcHNob3RJZHNbMF0gPz8gJycpLnRyaW0oKSA9PT0gJyc7XG5cdFx0XHRcdGNvbnN0IHNuYXBzaG90SWQgPSAhaGFzUmVjb3JkICYmICFwbGFjZWhvbGRlck9ubHkgJiYgc25hcHNob3RJbmRleCA+PSAwXG5cdFx0XHRcdFx0PyAoc25hcHNob3RJZHNbc25hcHNob3RJbmRleF0gPz8gJycpLnRyaW0oKVxuXHRcdFx0XHRcdDogJyc7XG5cdFx0XHRcdGNvbnN0IHByZXZpb3VzSWQgPSByZWNvcmRlZElkIHx8IHNuYXBzaG90SWQ7XG5cdFx0XHRcdGNvbnN0IG9wdGlvbnMgPSBjb21wb3Nlck1vZGVsU2VsZWN0T3B0aW9ucyhyZXN1bHQubW9kZWxzKTtcblx0XHRcdFx0Y29uc3QgaWRzID0gY29tcG9zZXJNb2RlbElkcyhyZXN1bHQubW9kZWxzKTtcblx0XHRcdFx0Y29uc3QgZW5hYmxlZElkcyA9IGNvbXBvc2VyRW5hYmxlZE1vZGVsSWRzKHJlc3VsdC5tb2RlbHMpO1xuXHRcdFx0XHRjb25zdCBzZWxlY3RlZEluZGV4ID0gY29tcG9zZXJNb2RlbFNlbGVjdGlvbkluZGV4KGlkcywgcmVzdWx0Lm1vZGVscywgcHJldmlvdXNJZCwgZXhwbGljaXRFbXB0eSk7XG5cdFx0XHRcdGhvc3QubW9kZWxTZWxlY3RCb3guc2V0T3B0aW9ucyhvcHRpb25zLCBzZWxlY3RlZEluZGV4KTtcblx0XHRcdFx0aG9zdC5tb2RlbFNlbGVjdGVkSW5kZXggPSBzZWxlY3RlZEluZGV4O1xuXHRcdFx0XHRob3N0LmNhdGFsb2dNb2RlbElkcyA9IGlkcztcblx0XHRcdFx0aG9zdC5lbmFibGVkTW9kZWxJZHMgPSBlbmFibGVkSWRzO1xuXHRcdFx0XHRjb25zdCBjaG9zZW4gPSAoaWRzW3NlbGVjdGVkSW5kZXhdID8/ICcnKS50cmltKCk7XG5cdFx0XHRcdGlmIChjaG9zZW4pIHtcblx0XHRcdFx0XHRtYXAuc2V0KHNlc3Npb25JZCwgY2hvc2VuKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtYXAuc2V0KHNlc3Npb25JZCwgJycpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlbWVtYmVyTGFzdEdvb2RDb21wb3NlckNhdGFsb2coaG9zdCwgeyBtb2RlbDogeyBvcHRpb25zLCBpZHMsIHNlbGVjdGVkSW5kZXgsIGVuYWJsZWRJZHMgfSB9KTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gaG9zdC5jb21wb3NlckNhdGFsb2dHZW5lcmF0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3RvcmVMYXN0R29vZENvbXBvc2VyQ2F0YWxvZ09uU3VwcG9ydGVkVGhyb3coaG9zdCwgJ21vZGVsJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjYXBzLnRvb2xzLnN1cHBvcnQgPT09ICdTVVBQT1JURUQnKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBob3N0LnVhQ29ubmVjdGlvbi5saXN0VG9vbHMoKTtcblx0XHRcdFx0aWYgKGdlbmVyYXRpb24gIT09IGhvc3QuY29tcG9zZXJDYXRhbG9nR2VuZXJhdGlvbikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBuYW1lcyA9IGNvbXBvc2VyVG9vbE5hbWVzKHJlc3VsdC50b29scyk7XG5cdFx0XHRcdGhvc3QuY2F0YWxvZ1Rvb2xOYW1lcyA9IG5hbWVzO1xuXHRcdFx0XHRyZW1lbWJlckxhc3RHb29kQ29tcG9zZXJDYXRhbG9nKGhvc3QsIHsgdG9vbHM6IHsgbmFtZXMgfSB9KTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRpZiAoZ2VuZXJhdGlvbiAhPT0gaG9zdC5jb21wb3NlckNhdGFsb2dHZW5lcmF0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJlc3RvcmVMYXN0R29vZENvbXBvc2VyQ2F0YWxvZ09uU3VwcG9ydGVkVGhyb3coaG9zdCwgJ3Rvb2xzJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBvc3RCb3VuZChcblx0aG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsXG5cdG1zZzogQ29udmVyc2F0aW9uV3JpdGVNZXNzYWdlLFxuXHRzZXNzaW9uVmlld0xlYXNlPzogSUNvbnZlcnNhdGlvblNlc3Npb25WaWV3TGVhc2UsXG4pOiBQcm9taXNlPFBvc3RPdXRjb21lPiB7XG5cblx0XHQvLyBEMjk0OiBwYWlyaW5nLWhvbGQga2VlcHMgdGhlIGxlZnRvdmVyIGVuZ2luZSBsZWFzZSBmb3IgcmVhZHMgKEQyODkpLlxuXHRcdC8vIFdyaXRlcyBtdXN0IG5vdCBmYWxsIHRocm91Z2ggdG8gbGVhc2UucG9zdCBcdTIwMTQgc2FtZSBjbG9zZWQgb3V0Y29tZSBhcyBhIG1pc3Npbmcgc2Vzc2lvbi5cblx0XHRpZiAoaXNDb252ZXJzYXRpb25QYWlyaW5nSG9sZChob3N0LnVhQ29ubmVjdGlvbikpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoeyBhY2NlcHRlZDogZmFsc2UsIHJlYXNvbjogJ25vX3N1Y2hfc2Vzc2lvbicgfSk7XG5cdFx0fVxuXHRcdGlmIChtc2cua2luZCA9PT0gJ2NsaWVudFRvb2xSZXNwb25kJyAmJiBob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCkpIHtcblx0XHRcdGNvbnN0IGZvcndhcmRlZCA9IGhvc3Quc3R1YlNlcnZpY2UucmVzcG9uZENsaWVudFRvb2woXG5cdFx0XHRcdGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKSxcblx0XHRcdFx0bXNnLnJlcXVlc3RJZCxcblx0XHRcdFx0eyBjb250ZW50OiBtc2cucmVzdWx0SnNvbiB9KTtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZm9yd2FyZGVkXG5cdFx0XHRcdD8geyBhY2NlcHRlZDogdHJ1ZSwgY29ycmVsYXRpb246IHsgaWQ6IGBjbGllbnRUb29sOiR7bXNnLnJlcXVlc3RJZH1gIH0gfVxuXHRcdFx0XHQ6IHsgYWNjZXB0ZWQ6IGZhbHNlLCByZWFzb246ICdub19zdWNoX3Nlc3Npb24nIH0pO1xuXHRcdH1cblx0XHRpZiAoaXNDb252ZXJzYXRpb25TZXNzaW9uTm90UmVhZHkoaG9zdC5zdHViU2VydmljZSkpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoeyBhY2NlcHRlZDogZmFsc2UsIHJlYXNvbjogJ25vX3N1Y2hfc2Vzc2lvbicgfSk7XG5cdFx0fVxuXHRcdGNvbnN0IGxlYXNlID0gc2Vzc2lvblZpZXdMZWFzZSA/PyBob3N0LnNlc3Npb25WaWV3TGVhc2U7XG5cdFx0aWYgKCFsZWFzZSkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IGFjY2VwdGVkOiBmYWxzZSwgcmVhc29uOiAnbm9fc3VjaF9zZXNzaW9uJyB9KTtcblx0XHR9XG5cdFx0cmV0dXJuIGxlYXNlLnBvc3QobXNnKTtcblx0XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdWJtaXREcmFmdChob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0aWYgKGhvc3Quc3VibWl0SW5GbGlnaHQgfHwgaXNDb21wb3NlclN0cmVhbWluZyhob3N0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoaG9zdC5jb21wb3NlclBvbGljeSA9PT0gJ3R1cm5FZGl0Jykge1xuXHRcdFx0c2F2ZVR1cm5FZGl0KGhvc3QpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoaG9zdC5jb21wb3NlclBvbGljeSA9PT0gJ3F1ZXVlRWRpdCcpIHtcblx0XHRcdHNhdmVRdWV1ZUVkaXQoaG9zdCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHRleHQgPSBjb21wb3NlclN1Ym1pdFRleHQoaG9zdCk7XG5cdFx0aWYgKCF0ZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChyZWplY3RQYWlyaW5nSG9sZFdyaXRlKGhvc3QpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChyZWplY3RLZWVwTGVmdG92ZXJMaXN0RmFpbFdyaXRlKGhvc3QpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHNlc3Npb25JZCA9IGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBjb25uZWN0ZWQgPSBob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCk7XG5cdFx0aWYgKCFjb25uZWN0ZWQgJiYgaG9zdC5zdHViU2VydmljZS5oYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeSgpKSB7XG5cdFx0XHQvLyBFbmdpbmUtYXdhcmUgZGlzY29ubmVjdDogZG8gbm90IHN0dWItZWNobyBvciBjbGFpbSBkZWxpdmVyZWQvc3luY2VkLlxuXHRcdFx0Ly8gVHJ5IHRoZSBleGlzdGluZyBxdWV1ZSBBUEk7IGRpc2Nvbm5lY3RlZCBjYWNoZSBjdXJyZW50bHkgcmVqZWN0cy5cblx0XHRcdGlmIChob3N0LnN0dWJTZXJ2aWNlLmVucXVldWVNZXNzYWdlUXVldWVJdGVtKHNlc3Npb25JZCwgdGV4dCkpIHtcblx0XHRcdFx0d3JpdGVDb21wb3NlckRyYWZ0KGhvc3QsIHNlc3Npb25JZCwgJycpO1xuXHRcdFx0XHRhcHBseUNvbXBvc2VyU3VyZmFjZVRleHQoaG9zdCwgJycpO1xuXHRcdFx0XHRob3N0LnJlc2V0SW5wdXRIaXN0b3J5QnJvd3NlKCk7XG5cdFx0XHRcdGhvc3QudXBkYXRlU2VuZEVuYWJsZWQoKTtcblx0XHRcdFx0aG9zdC51cGRhdGVDb252ZXJzYXRpb25QaGFzZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR3cml0ZUNvbXBvc2VyRHJhZnQoaG9zdCwgc2Vzc2lvbklkLCBjb21wb3NlckRyYWZ0VGV4dChob3N0KSk7XG5cdFx0XHRob3N0LnVwZGF0ZVNlbmRFbmFibGVkKCk7XG5cdFx0XHRob3N0LnNob3dQb3N0RmFpbHVyZSgnZW5naW5lX2Rpc2Nvbm5lY3RlZCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRob3N0LnN1Ym1pdEluRmxpZ2h0ID0gdHJ1ZTtcblx0XHRjb25zdCBzZXNzaW9uVmlld0xlYXNlID0gaG9zdC5zZXNzaW9uVmlld0xlYXNlO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBtb2RlbFByb2ZpbGVJZCA9IGhvc3QuY2F0YWxvZ01vZGVsSWRzPy5baG9zdC5tb2RlbFNlbGVjdGVkSW5kZXhdID8/ICcnO1xuXHRcdFx0Y29uc3Qgb3V0Y29tZSA9IGF3YWl0IHBvc3RCb3VuZChob3N0LCB7XG5cdFx0XHRcdGtpbmQ6ICdzdWJtaXRJbnB1dCcsXG5cdFx0XHRcdHRleHQsXG5cdFx0XHRcdC4uLihtb2RlbFByb2ZpbGVJZCA/IHsgbW9kZWxQcm9maWxlSWQgfSA6IHt9KSxcblx0XHRcdFx0Li4uKGhvc3QuZmlsdGVyQWdlbnRJZCA/IHsgYWdlbnRJZDogaG9zdC5maWx0ZXJBZ2VudElkIH0gOiB7fSksXG5cdFx0XHR9LCBzZXNzaW9uVmlld0xlYXNlKTtcblx0XHRcdGNvbnN0IHN0aWxsT25TdWJtaXRTZXNzaW9uID0gaG9zdC5nZXRCb3VuZFNlc3Npb25JZCgpID09PSBzZXNzaW9uSWQ7XG5cdFx0XHRpZiAoIW91dGNvbWUuYWNjZXB0ZWQpIHtcblx0XHRcdFx0aWYgKHN0aWxsT25TdWJtaXRTZXNzaW9uKSB7XG5cdFx0XHRcdFx0aG9zdC5zaG93UG9zdEZhaWx1cmUob3V0Y29tZS5yZWFzb24pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChyZWFkQ29tcG9zZXJEcmFmdChob3N0LCBzZXNzaW9uSWQpLnRyaW0oKSA9PT0gdGV4dCkge1xuXHRcdFx0XHR3cml0ZUNvbXBvc2VyRHJhZnQoaG9zdCwgc2Vzc2lvbklkLCAnJyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoc3RpbGxPblN1Ym1pdFNlc3Npb24pIHtcblx0XHRcdFx0Ly8gVGhlIHRleHRhcmVhIGlzIG9ubHkgdGhlIGJvZHkuIFJlZnMgc2l0IGJlc2lkZSBpdCwgc28gbWF0Y2ggdGhlIHBheWxvYWQgdGhhdCB3b3VsZCBiZSBzZW50IG5vdy5cblx0XHRcdFx0aWYgKGNvbXBvc2VyU3VibWl0VGV4dChob3N0KSA9PT0gdGV4dCkge1xuXHRcdFx0XHRcdGFwcGx5Q29tcG9zZXJTdXJmYWNlVGV4dChob3N0LCAnJyk7XG5cdFx0XHRcdFx0aG9zdC5yZXNldElucHV0SGlzdG9yeUJyb3dzZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGhvc3QudXBkYXRlU2VuZEVuYWJsZWQoKTtcblx0XHRcdFx0aG9zdC51cGRhdGVDb252ZXJzYXRpb25QaGFzZSgpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2gge1xuXHRcdFx0aWYgKGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKSA9PT0gc2Vzc2lvbklkKSB7XG5cdFx0XHRcdGhvc3Quc2hvd1Bvc3RGYWlsdXJlKCdmYWlsZWQnKTtcblx0XHRcdH1cblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0aG9zdC5zdWJtaXRJbkZsaWdodCA9IGZhbHNlO1xuXHRcdH1cblx0XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzYXZlVHVybkVkaXQoaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QpOiB2b2lkIHtcblxuXHRcdGNvbnN0IHRleHQgPSBjb21wb3NlclN1Ym1pdFRleHQoaG9zdCk7XG5cdFx0aWYgKCF0ZXh0IHx8ICFob3N0LmVkaXRpbmdUdXJuSWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHJlamVjdFBhaXJpbmdIb2xkV3JpdGUoaG9zdCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHJlamVjdEtlZXBMZWZ0b3Zlckxpc3RGYWlsV3JpdGUoaG9zdCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gaG9zdC5nZXRCb3VuZFNlc3Npb25JZCgpO1xuXHRcdGNvbnN0IGVkaXRpbmdUdXJuSWQgPSBob3N0LmVkaXRpbmdUdXJuSWQ7XG5cdFx0Y29uc3QgdHVybiA9IGhvc3Quc3R1YlNlcnZpY2UuZ2V0VHVybnMoc2Vzc2lvbklkKS5maW5kKHQgPT4gdC5pZCA9PT0gZWRpdGluZ1R1cm5JZCAmJiB0LmtpbmQgPT09ICd1c2VyJyk7XG5cdFx0Y29uc3QgbG9hZGVkID0gdHVybiA/IHR1cm5FZGl0TG9hZGVkUGF5bG9hZCh0dXJuLnRleHQpIDogdW5kZWZpbmVkO1xuXHRcdC8vIFNhbWUgcGF5bG9hZCB0aGUgY2FyZCBsb2FkZWQgaXMgbm90IGFuIGVkaXQuIEVkaXRNZXNzYWdlIHdvdWxkIHJlcnVuIHRoZSB0dXJuLlxuXHRcdGlmIChsb2FkZWQgIT09IHVuZGVmaW5lZCAmJiB0ZXh0ID09PSBsb2FkZWQpIHtcblx0XHRcdGhvc3QuZXhpdENvbXBvc2VyRWRpdCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB0dXJuSWQgPSB0dXJuPy50dXJuSWQ/LnRyaW0oKSB8fCBlZGl0aW5nVHVybklkO1xuXHRcdGNvbnN0IHNhdmVkID0gaG9zdC5zdHViU2VydmljZS51cGRhdGVVc2VyVHVyblRleHQoc2Vzc2lvbklkLCB0dXJuSWQsIHRleHQsIHR1cm4/LmFnZW50SWQpO1xuXHRcdGlmICghc2F2ZWQpIHtcblx0XHRcdGhvc3Quc2hvd1Bvc3RGYWlsdXJlKFxuXHRcdFx0XHQhaG9zdC5zdHViU2VydmljZS5pc0VuZ2luZUNvbm5lY3RlZCgpICYmIGhvc3Quc3R1YlNlcnZpY2UuaGFzRW5naW5lQ29ubmVjdGlvbkhpc3RvcnkoKVxuXHRcdFx0XHRcdD8gJ2VuZ2luZV9kaXNjb25uZWN0ZWQnXG5cdFx0XHRcdFx0OiAnZmFpbGVkJ1xuXHRcdFx0KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aG9zdC5leGl0Q29tcG9zZXJFZGl0KCk7XG5cdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2F2ZVF1ZXVlRWRpdChob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCk6IHZvaWQge1xuXG5cdFx0Y29uc3QgdGV4dCA9IGNvbXBvc2VyU3VibWl0VGV4dChob3N0KTtcblx0XHRjb25zdCBpdGVtID0gaG9zdC5nZXRFZGl0aW5nUXVldWVJdGVtKCk7XG5cdFx0aWYgKCF0ZXh0IHx8ICFpdGVtKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChyZWplY3RQYWlyaW5nSG9sZFdyaXRlKGhvc3QpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChyZWplY3RLZWVwTGVmdG92ZXJMaXN0RmFpbFdyaXRlKGhvc3QpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGxvYWRlZCA9IHR1cm5FZGl0TG9hZGVkUGF5bG9hZChpdGVtLmNvbnRlbnQpO1xuXHRcdC8vIFNhbWUgcGF5bG9hZCB0aGUgY29tcG9zZXIgbG9hZGVkIGlzIG5vdCBhbiBlZGl0LiBFZGl0UXVldWVJdGVtIHdvdWxkIHJld3JpdGUgaXQuXG5cdFx0aWYgKGxvYWRlZCAhPT0gdW5kZWZpbmVkICYmIHRleHQgPT09IGxvYWRlZCkge1xuXHRcdFx0aG9zdC5leGl0Q29tcG9zZXJFZGl0KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHNlc3Npb25JZCA9IGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKTtcblx0XHRjb25zdCBpdGVtSWQgPSBpdGVtLmlkO1xuXHRcdGNvbnN0IHNhdmVkID0gaG9zdC5zdHViU2VydmljZS51cGRhdGVNZXNzYWdlUXVldWVJdGVtQ29udGVudChzZXNzaW9uSWQsIGl0ZW1JZCwgdGV4dCk7XG5cdFx0aWYgKCFzYXZlZCkge1xuXHRcdFx0aG9zdC5zaG93UG9zdEZhaWx1cmUoXG5cdFx0XHRcdCFob3N0LnN0dWJTZXJ2aWNlLmlzRW5naW5lQ29ubmVjdGVkKCkgJiYgaG9zdC5zdHViU2VydmljZS5oYXNFbmdpbmVDb25uZWN0aW9uSGlzdG9yeSgpXG5cdFx0XHRcdFx0PyAnZW5naW5lX2Rpc2Nvbm5lY3RlZCdcblx0XHRcdFx0XHQ6ICdmYWlsZWQnXG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRob3N0LmV4aXRDb21wb3NlckVkaXQodHJ1ZSwgZmFsc2UpO1xuXHRcdGhvc3Quc3R1YlNlcnZpY2UucmVsZWFzZU1lc3NhZ2VRdWV1ZUl0ZW1Ib2xkKHNlc3Npb25JZCwgaXRlbUlkKTtcblx0XHRob3N0LnJlbmRlckluYm94U3RhdHVzKCk7XG5cdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9zZXJDaGF0SWQoaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QpOiBzdHJpbmcge1xuXG5cdFx0cmV0dXJuIGhvc3QuZmlsdGVyQWdlbnRJZCA/PyAnZGVmYXVsdCc7XG5cdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gZHJhZnRNYXBLZXkoaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsIHNlc3Npb25JZDogc3RyaW5nKTogc3RyaW5nIHtcblxuXHRcdHJldHVybiB1YUNsaWVudENvbXBvc2VyRHJhZnRFbnRyeUtleShzZXNzaW9uSWQsIGNvbXBvc2VyQ2hhdElkKGhvc3QpKTtcblx0XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWFkQ29tcG9zZXJEcmFmdChob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCwgc2Vzc2lvbklkOiBzdHJpbmcpOiBzdHJpbmcge1xuXG5cdFx0Y29uc3Qga2V5ID0gZHJhZnRNYXBLZXkoaG9zdCwgc2Vzc2lvbklkKTtcblx0XHRpZiAoaG9zdC5kcmFmdHMuaGFzKGtleSkpIHtcblx0XHRcdHJldHVybiBob3N0LmRyYWZ0cy5nZXQoa2V5KSA/PyAnJztcblx0XHR9XG5cdFx0aWYgKCFzaG91bGRSZXN0b3JlQ29tcG9zZXJEcmFmdHMoaG9zdC5jb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdFx0Y29uc3Qgc3RvcmVkID0gbG9hZFVhQ2xpZW50Q29tcG9zZXJEcmFmdChob3N0LnN0b3JhZ2VTZXJ2aWNlLCBzZXNzaW9uSWQsIGNvbXBvc2VyQ2hhdElkKGhvc3QpKTtcblx0XHRob3N0LmRyYWZ0cy5zZXQoa2V5LCBzdG9yZWQpO1xuXHRcdHJldHVybiBzdG9yZWQ7XG5cdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gd3JpdGVDb21wb3NlckRyYWZ0KGhvc3Q6IElDb252ZXJzYXRpb25MZW5zQ29tcG9zZXJIb3N0LCBzZXNzaW9uSWQ6IHN0cmluZywgdGV4dDogc3RyaW5nKTogdm9pZCB7XG5cblx0XHRob3N0LmRyYWZ0cy5zZXQoZHJhZnRNYXBLZXkoaG9zdCwgc2Vzc2lvbklkKSwgdGV4dCk7XG5cdFx0aWYgKHNob3VsZFJlc3RvcmVDb21wb3NlckRyYWZ0cyhob3N0LmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSkge1xuXHRcdFx0c3RvcmVVYUNsaWVudENvbXBvc2VyRHJhZnQoaG9zdC5zdG9yYWdlU2VydmljZSwgc2Vzc2lvbklkLCBjb21wb3NlckNoYXRJZChob3N0KSwgdGV4dCk7XG5cdFx0fVxuXHRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlc3RvcmVDb21wb3NlckRyYWZ0VG9JbnB1dChob3N0OiBJQ29udmVyc2F0aW9uTGVuc0NvbXBvc2VySG9zdCk6IHZvaWQge1xuXG5cdFx0aWYgKCFob3N0LmRvY2tUZXh0YXJlYSB8fCBob3N0LmNvbXBvc2VyUG9saWN5ICE9PSAnY29tcG9zZScpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0YXBwbHlDb21wb3NlclN1cmZhY2VUZXh0KGhvc3QsIHJlYWRDb21wb3NlckRyYWZ0KGhvc3QsIGhvc3QuZ2V0Qm91bmRTZXNzaW9uSWQoKSkpO1xuXHRcdGhvc3QudXBkYXRlU2VuZEVuYWJsZWQoKTtcblx0XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWxldGVDb21wb3NlckRyYWZ0c0ZvclNlc3Npb24oaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QsIHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cblx0XHRmb3IgKGNvbnN0IGtleSBvZiBbLi4uaG9zdC5kcmFmdHMua2V5cygpXSkge1xuXHRcdFx0aWYgKHNlc3Npb25JZEZyb21VYUNsaWVudENvbXBvc2VyRHJhZnRFbnRyeUtleShrZXkpID09PSBzZXNzaW9uSWQpIHtcblx0XHRcdFx0aG9zdC5kcmFmdHMuZGVsZXRlKGtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJlbW92ZVVhQ2xpZW50Q29tcG9zZXJEcmFmdHNGb3JTZXNzaW9uKGhvc3Quc3RvcmFnZVNlcnZpY2UsIHNlc3Npb25JZCk7XG5cdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJ1bmVPcnBoYW5Db21wb3NlckRyYWZ0cyhfaG9zdDogSUNvbnZlcnNhdGlvbkxlbnNDb21wb3Nlckhvc3QpOiB2b2lkIHtcblxuXHRcdC8vIFZpc2libGUgcm9zdGVyIGNodXJuIChlbmdpbmUgYnVja2V0IHN3YXAsIGxpc3QtZmFpbCBwbGFjZWhvbGRlcikgbXVzdCBub3QgZHJvcFxuXHRcdC8vIGRyYWZ0cyBmb3Igc2Vzc2lvbnMgdGhhdCBhcmUgbWVyZWx5IGFic2VudCBmcm9tIGdldFNlc3Npb25zKCkuIERlbGV0ZXMgdXNlXG5cdFx0Ly8gZGVsZXRlQ29tcG9zZXJEcmFmdHNGb3JTZXNzaW9uLlxuXHRcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMseUJBQXlCO0FBSWxDLFNBQVMsNEJBQTRCO0FBR3JDLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsd0JBQXdCLDRCQUE0Qix5QkFBeUIsa0JBQWtCLDZCQUE2Qiw0QkFBNEIseUJBQXlCO0FBQzFMLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsaUNBQWlDLDhCQUE4QjtBQUN4RTtBQUFBLEVBQ0M7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLE9BRU07QUFFUDtBQUFBLEVBQ0M7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsT0FDTTtBQUNQLFNBQVMsbUNBQW1DO0FBRzVDLFNBQVMsOEJBQThCLHFCQUFxQixxQ0FBOEU7QUFDMUksU0FBUywwQkFBMEIsbUJBQW1CLG9CQUFvQiw2QkFBNkI7QUEwQ2hHLFNBQVMsd0JBQXdCLE1BQTJDO0FBRWpGLFFBQU0sYUFBYSxFQUFFLEtBQUs7QUFFMUIsTUFBSSwwQkFBMEIsS0FBSyxZQUFZLEtBQUssQ0FBQyxLQUFLLFlBQVksa0JBQWtCLEdBQUc7QUFDMUYsUUFBSSxrQ0FBa0MsSUFBSSxHQUFHO0FBQzVDLGtEQUE0QyxJQUFJO0FBQ2hELFdBQUssa0JBQWtCO0FBQ3ZCLFdBQUssY0FBYztBQUNuQjtBQUFBLElBQ0Q7QUFDQSxVQUFNLFlBQVksS0FBSyxrQkFBa0I7QUFDekMsVUFBTSxFQUFFLFdBQVcsSUFBSSxLQUFLLGlCQUFpQixTQUFTO0FBQ3RELFFBQUksOEJBQThCLElBQUksR0FBRztBQUN4QyxZQUFNLG9CQUFvQixLQUFLLElBQUksWUFBWSx1QkFBdUIsU0FBUyxDQUFDO0FBQ2hGLFdBQUssZUFBZSxXQUFXLHVCQUF1QixJQUFJLFdBQVMsRUFBRSxLQUFLLEVBQUUsR0FBRyxpQkFBaUI7QUFBQSxJQUNqRyxPQUFPO0FBR04sV0FBSyxlQUFlLFdBQVcsQ0FBQyxFQUFFLE1BQU0sNEJBQTRCLENBQUMsR0FBRyxDQUFDO0FBQUEsSUFDMUU7QUFDQSxTQUFLLGVBQWUsV0FBVyxDQUFDLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQyxHQUFHLENBQUM7QUFDekUsU0FBSyxxQkFBcUI7QUFDMUIsU0FBSyxrQkFBa0IsQ0FBQyxFQUFFO0FBQzFCLFNBQUssa0JBQWtCLENBQUM7QUFDeEIsU0FBSyxtQkFBbUIsQ0FBQztBQUN6QixTQUFLLGtCQUFrQjtBQUN2QixTQUFLLGNBQWM7QUFDbkI7QUFBQSxFQUNEO0FBQ0EscUNBQW1DLElBQUk7QUFDdkMsT0FBSyxrQkFBa0I7QUFDdkIsT0FBSyxjQUFjO0FBQ25CLE9BQUssOEJBQThCLE1BQU0sVUFBVSxFQUFFLE1BQU0saUJBQWlCLEVBQUUsTUFBTSxpQkFBaUI7QUFFdkc7QUFRQSxNQUFNLDJCQUEyQixvQkFBSSxRQUFnRTtBQUVyRyxTQUFTLGdDQUFnQyxNQUFxQyxPQUFzQztBQUNuSCxRQUFNLE9BQU8seUJBQXlCLElBQUksSUFBSSxLQUFLLENBQUM7QUFDcEQsMkJBQXlCLElBQUksTUFBTSxFQUFFLEdBQUcsTUFBTSxHQUFHLE1BQU0sQ0FBQztBQUN6RDtBQUVBLFNBQVMsbUNBQW1DLE1BQXFDLE1BQTZDO0FBQzdILFFBQU0sT0FBTyx5QkFBeUIsSUFBSSxJQUFJO0FBQzlDLE1BQUksS0FBSyxjQUFjLFlBQVksYUFBYSw4QkFBOEIsSUFBSSxHQUFHO0FBQ3BGLFFBQUksTUFBTSxPQUFPO0FBQ2hCLFlBQU0sRUFBRSxXQUFXLElBQUksS0FBSyxpQkFBaUIsS0FBSyxrQkFBa0IsQ0FBQztBQUNyRSxXQUFLLGVBQWUsV0FBVyxLQUFLLE1BQU0sU0FBUyxLQUFLLElBQUksWUFBWSxLQUFLLE1BQU0sUUFBUSxTQUFTLENBQUMsQ0FBQztBQUFBLElBQ3ZHLE9BQU87QUFDTixXQUFLLGVBQWUsV0FBVyxDQUFDLEVBQUUsTUFBTSxtQ0FBbUMsQ0FBQyxHQUFHLENBQUM7QUFBQSxJQUNqRjtBQUFBLEVBQ0Q7QUFDQSxNQUFJLEtBQUssT0FBTyxZQUFZLFdBQVc7QUFDdEMsUUFBSSxNQUFNLE9BQU87QUFDaEIsV0FBSyxlQUFlLFdBQVcsS0FBSyxNQUFNLFNBQVMsS0FBSyxNQUFNLGFBQWE7QUFDM0UsV0FBSyxxQkFBcUIsS0FBSyxNQUFNO0FBQ3JDLFdBQUssa0JBQWtCLEtBQUssTUFBTTtBQUNsQyxXQUFLLGtCQUFrQixLQUFLLE1BQU07QUFBQSxJQUNuQyxPQUFPO0FBQ04sV0FBSyxlQUFlLFdBQVcsQ0FBQyxFQUFFLE1BQU0sbUNBQW1DLENBQUMsR0FBRyxDQUFDO0FBQ2hGLFdBQUsscUJBQXFCO0FBQzFCLFdBQUssa0JBQWtCLENBQUMsRUFBRTtBQUMxQixXQUFLLGtCQUFrQixDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNEO0FBQ0EsTUFBSSxLQUFLLE1BQU0sWUFBWSxXQUFXO0FBQ3JDLFFBQUksTUFBTSxPQUFPO0FBQ2hCLFdBQUssbUJBQW1CLEtBQUssTUFBTTtBQUFBLElBQ3BDO0FBQUEsRUFDRDtBQUNEO0FBRUEsU0FBUywrQ0FBK0MsTUFBcUMsT0FBMEM7QUFDdEksUUFBTSxPQUFPLHlCQUF5QixJQUFJLElBQUk7QUFDOUMsTUFBSSxVQUFVLFNBQVM7QUFDdEIsUUFBSSxDQUFDLDhCQUE4QixJQUFJLEdBQUc7QUFDekM7QUFBQSxJQUNEO0FBQ0EsUUFBSSxNQUFNLE9BQU87QUFDaEIsWUFBTSxFQUFFLFdBQVcsSUFBSSxLQUFLLGlCQUFpQixLQUFLLGtCQUFrQixDQUFDO0FBQ3JFLFdBQUssZUFBZSxXQUFXLEtBQUssTUFBTSxTQUFTLEtBQUssSUFBSSxZQUFZLEtBQUssTUFBTSxRQUFRLFNBQVMsQ0FBQyxDQUFDO0FBQ3RHO0FBQUEsSUFDRDtBQUNBLFNBQUssZUFBZSxXQUFXLENBQUMsRUFBRSxNQUFNLDRCQUE0QixDQUFDLEdBQUcsQ0FBQztBQUN6RTtBQUFBLEVBQ0Q7QUFDQSxNQUFJLFVBQVUsU0FBUztBQUN0QixRQUFJLE1BQU0sT0FBTztBQUNoQixXQUFLLGVBQWUsV0FBVyxLQUFLLE1BQU0sU0FBUyxLQUFLLE1BQU0sYUFBYTtBQUMzRSxXQUFLLHFCQUFxQixLQUFLLE1BQU07QUFDckMsV0FBSyxrQkFBa0IsS0FBSyxNQUFNO0FBQ2xDLFdBQUssa0JBQWtCLEtBQUssTUFBTTtBQUNsQztBQUFBLElBQ0Q7QUFDQSxTQUFLLGVBQWUsV0FBVyxDQUFDLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQyxHQUFHLENBQUM7QUFDekUsU0FBSyxxQkFBcUI7QUFDMUIsU0FBSyxrQkFBa0IsQ0FBQyxFQUFFO0FBQzFCLFNBQUssa0JBQWtCLENBQUM7QUFDeEI7QUFBQSxFQUNEO0FBQ0EsT0FBSyxtQkFBbUIsTUFBTSxRQUFRLEtBQUssTUFBTSxRQUFRLENBQUM7QUFDM0Q7QUFFQSxTQUFTLG1DQUFtQyxNQUEyQztBQUN0RixpREFBK0MsTUFBTSxPQUFPO0FBQzVELGlEQUErQyxNQUFNLE9BQU87QUFDNUQsaURBQStDLE1BQU0sT0FBTztBQUM3RDtBQUVBLFNBQVMsMkJBQTJCLE1BQThDO0FBQ2pGLFFBQU0sT0FBTyx5QkFBeUIsSUFBSSxJQUFJO0FBQzlDLE1BQUksTUFBTSxTQUFTLE1BQU0sU0FBUyxNQUFNLE9BQU87QUFDOUMsV0FBTztBQUFBLEVBQ1I7QUFDQSxNQUFJLEtBQUssaUJBQWlCLFNBQVMsR0FBRztBQUNyQyxXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU8sS0FBSyxnQkFBZ0IsS0FBSyxRQUFNLEdBQUcsU0FBUyxDQUFDO0FBQ3JEO0FBRUEsU0FBUyxrQ0FBa0MsTUFBOEM7QUFDeEYsU0FBTywwQkFBMEIsS0FBSyxZQUFZLEtBQUssMkJBQTJCLElBQUk7QUFDdkY7QUFFQSxTQUFTLDRDQUE0QyxNQUEyQztBQUMvRixNQUFJLHlCQUF5QixJQUFJLElBQUksR0FBRztBQUN2Qyx1Q0FBbUMsSUFBSTtBQUFBLEVBQ3hDO0FBQ0Q7QUFHQSxTQUFTLDBCQUEwQixNQUF5RDtBQUMzRixRQUFNLHVCQUF1QixLQUFLO0FBQ2xDLE1BQUksQ0FBQyxzQkFBc0I7QUFDMUIsV0FBTztBQUFBLEVBQ1I7QUFDQSxNQUFJO0FBQ0osTUFBSTtBQUNILGNBQVUscUJBQXFCLGVBQWUsY0FBWSxTQUFTLElBQUksb0JBQW9CLENBQUM7QUFBQSxFQUM3RixRQUFRO0FBQ1AsV0FBTztBQUFBLEVBQ1I7QUFDQSxRQUFNLGlCQUFpQixLQUFLLG9CQUFvQjtBQUNoRCxNQUFJLGtCQUFrQixTQUFTLGFBQWE7QUFDM0MsVUFBTSxlQUFlLFFBQVEsWUFBWSxjQUFjLEdBQUcsU0FBUyxLQUFLO0FBQ3hFLFFBQUksY0FBYztBQUNqQixhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFDQSxRQUFNLGNBQWMsU0FBUyxvQkFBb0IsRUFBRSxTQUFTLEtBQUs7QUFDakUsU0FBTyxlQUFlO0FBQ3ZCO0FBRUEsZUFBc0IsOEJBQThCLE1BQXFDLFlBQW1DO0FBRTFILFFBQU0sT0FBTyx5QkFBeUIsS0FBSyxhQUFhLHNCQUFzQixDQUFDO0FBQy9FLE1BQUksZUFBZSxLQUFLLDJCQUEyQjtBQUNsRDtBQUFBLEVBQ0Q7QUFDQSxxQ0FBbUMsTUFBTSxJQUFJO0FBQzdDLE1BQUksS0FBSyxjQUFjLFlBQVksZUFBZSw4QkFBOEIsSUFBSSxHQUFHO0FBQ3RGLFFBQUk7QUFDSCxZQUFNLGNBQWMsMEJBQTBCLElBQUk7QUFDbEQsWUFBTSxTQUFTLE9BQU8sY0FDbkIsS0FBSyxhQUFhLGtCQUFrQixFQUFFLFlBQVksQ0FBQyxJQUNuRCxLQUFLLGFBQWEsa0JBQWtCO0FBQ3ZDLFVBQUksZUFBZSxLQUFLLDJCQUEyQjtBQUNsRDtBQUFBLE1BQ0Q7QUFDQSxZQUFNLFVBQVUsMkJBQTJCLE9BQU8sUUFBUTtBQUMxRCxZQUFNLEVBQUUsV0FBVyxJQUFJLEtBQUssaUJBQWlCLEtBQUssa0JBQWtCLENBQUM7QUFDckUsV0FBSyxlQUFlLFdBQVcsU0FBUyxLQUFLLElBQUksWUFBWSxRQUFRLFNBQVMsQ0FBQyxDQUFDO0FBQ2hGLHNDQUFnQyxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDO0FBQUEsSUFDN0QsUUFBUTtBQUNQLFVBQUksZUFBZSxLQUFLLDJCQUEyQjtBQUNsRDtBQUFBLE1BQ0Q7QUFDQSxxREFBK0MsTUFBTSxPQUFPO0FBQUEsSUFDN0Q7QUFBQSxFQUNEO0FBQ0EsTUFBSSxLQUFLLE9BQU8sWUFBWSxhQUFhO0FBQ3hDLFFBQUk7QUFDSCxZQUFNLFNBQVMsTUFBTSxLQUFLLGFBQWEsV0FBVztBQUNsRCxVQUFJLGVBQWUsS0FBSywyQkFBMkI7QUFDbEQ7QUFBQSxNQUNEO0FBQ0EsWUFBTSxZQUFZLEtBQUssa0JBQWtCO0FBQ3pDLFlBQU0sTUFBTSw2QkFBNkIsSUFBSTtBQUM3QyxZQUFNLFlBQVksSUFBSSxJQUFJLFNBQVM7QUFDbkMsWUFBTSxjQUFjLFlBQWEsSUFBSSxJQUFJLFNBQVMsS0FBSyxLQUFNO0FBQzdELFlBQU0sZ0JBQWdCLGFBQWEsWUFBWSxLQUFLLE1BQU07QUFDMUQsWUFBTSxhQUFhLGdCQUFnQixLQUFLLFlBQVksS0FBSztBQUd6RCxZQUFNLGdCQUFnQixLQUFLO0FBQzNCLFlBQU0sY0FBYyxLQUFLO0FBQ3pCLFlBQU0sa0JBQWtCLFlBQVksV0FBVyxNQUFNLFlBQVksQ0FBQyxLQUFLLElBQUksS0FBSyxNQUFNO0FBQ3RGLFlBQU0sYUFBYSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsaUJBQWlCLEtBQ2xFLFlBQVksYUFBYSxLQUFLLElBQUksS0FBSyxJQUN4QztBQUNILFlBQU0sYUFBYSxjQUFjO0FBQ2pDLFlBQU0sVUFBVSwyQkFBMkIsT0FBTyxNQUFNO0FBQ3hELFlBQU0sTUFBTSxpQkFBaUIsT0FBTyxNQUFNO0FBQzFDLFlBQU0sYUFBYSx3QkFBd0IsT0FBTyxNQUFNO0FBQ3hELFlBQU0sZ0JBQWdCLDRCQUE0QixLQUFLLE9BQU8sUUFBUSxZQUFZLGFBQWE7QUFDL0YsV0FBSyxlQUFlLFdBQVcsU0FBUyxhQUFhO0FBQ3JELFdBQUsscUJBQXFCO0FBQzFCLFdBQUssa0JBQWtCO0FBQ3ZCLFdBQUssa0JBQWtCO0FBQ3ZCLFlBQU0sVUFBVSxJQUFJLGFBQWEsS0FBSyxJQUFJLEtBQUs7QUFDL0MsVUFBSSxRQUFRO0FBQ1gsWUFBSSxJQUFJLFdBQVcsTUFBTTtBQUFBLE1BQzFCLE9BQU87QUFDTixZQUFJLElBQUksV0FBVyxFQUFFO0FBQUEsTUFDdEI7QUFDQSxzQ0FBZ0MsTUFBTSxFQUFFLE9BQU8sRUFBRSxTQUFTLEtBQUssZUFBZSxXQUFXLEVBQUUsQ0FBQztBQUFBLElBQzdGLFFBQVE7QUFDUCxVQUFJLGVBQWUsS0FBSywyQkFBMkI7QUFDbEQ7QUFBQSxNQUNEO0FBQ0EscURBQStDLE1BQU0sT0FBTztBQUFBLElBQzdEO0FBQUEsRUFDRDtBQUNBLE1BQUksS0FBSyxNQUFNLFlBQVksYUFBYTtBQUN2QyxRQUFJO0FBQ0gsWUFBTSxTQUFTLE1BQU0sS0FBSyxhQUFhLFVBQVU7QUFDakQsVUFBSSxlQUFlLEtBQUssMkJBQTJCO0FBQ2xEO0FBQUEsTUFDRDtBQUNBLFlBQU0sUUFBUSxrQkFBa0IsT0FBTyxLQUFLO0FBQzVDLFdBQUssbUJBQW1CO0FBQ3hCLHNDQUFnQyxNQUFNLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxDQUFDO0FBQUEsSUFDM0QsUUFBUTtBQUNQLFVBQUksZUFBZSxLQUFLLDJCQUEyQjtBQUNsRDtBQUFBLE1BQ0Q7QUFDQSxxREFBK0MsTUFBTSxPQUFPO0FBQUEsSUFDN0Q7QUFBQSxFQUNEO0FBRUY7QUFFTyxTQUFTLFVBQ2YsTUFDQSxLQUNBLGtCQUN1QjtBQUl0QixNQUFJLDBCQUEwQixLQUFLLFlBQVksR0FBRztBQUNqRCxXQUFPLFFBQVEsUUFBUSxFQUFFLFVBQVUsT0FBTyxRQUFRLGtCQUFrQixDQUFDO0FBQUEsRUFDdEU7QUFDQSxNQUFJLElBQUksU0FBUyx1QkFBdUIsS0FBSyxZQUFZLGtCQUFrQixHQUFHO0FBQzdFLFVBQU0sWUFBWSxLQUFLLFlBQVk7QUFBQSxNQUNsQyxLQUFLLGtCQUFrQjtBQUFBLE1BQ3ZCLElBQUk7QUFBQSxNQUNKLEVBQUUsU0FBUyxJQUFJLFdBQVc7QUFBQSxJQUFDO0FBQzVCLFdBQU8sUUFBUSxRQUFRLFlBQ3BCLEVBQUUsVUFBVSxNQUFNLGFBQWEsRUFBRSxJQUFJLGNBQWMsSUFBSSxTQUFTLEdBQUcsRUFBRSxJQUNyRSxFQUFFLFVBQVUsT0FBTyxRQUFRLGtCQUFrQixDQUFDO0FBQUEsRUFDbEQ7QUFDQSxNQUFJLDhCQUE4QixLQUFLLFdBQVcsR0FBRztBQUNwRCxXQUFPLFFBQVEsUUFBUSxFQUFFLFVBQVUsT0FBTyxRQUFRLGtCQUFrQixDQUFDO0FBQUEsRUFDdEU7QUFDQSxRQUFNLFFBQVEsb0JBQW9CLEtBQUs7QUFDdkMsTUFBSSxDQUFDLE9BQU87QUFDWCxXQUFPLFFBQVEsUUFBUSxFQUFFLFVBQVUsT0FBTyxRQUFRLGtCQUFrQixDQUFDO0FBQUEsRUFDdEU7QUFDQSxTQUFPLE1BQU0sS0FBSyxHQUFHO0FBRXZCO0FBRUEsZUFBc0IsWUFBWSxNQUFvRDtBQUVwRixNQUFJLEtBQUssa0JBQWtCLG9CQUFvQixJQUFJLEdBQUc7QUFDckQ7QUFBQSxFQUNEO0FBQ0EsTUFBSSxLQUFLLG1CQUFtQixZQUFZO0FBQ3ZDLGlCQUFhLElBQUk7QUFDakI7QUFBQSxFQUNEO0FBQ0EsTUFBSSxLQUFLLG1CQUFtQixhQUFhO0FBQ3hDLGtCQUFjLElBQUk7QUFDbEI7QUFBQSxFQUNEO0FBQ0EsUUFBTSxPQUFPLG1CQUFtQixJQUFJO0FBQ3BDLE1BQUksQ0FBQyxNQUFNO0FBQ1Y7QUFBQSxFQUNEO0FBQ0EsTUFBSSx1QkFBdUIsSUFBSSxHQUFHO0FBQ2pDO0FBQUEsRUFDRDtBQUNBLE1BQUksZ0NBQWdDLElBQUksR0FBRztBQUMxQztBQUFBLEVBQ0Q7QUFDQSxRQUFNLFlBQVksS0FBSyxrQkFBa0I7QUFDekMsUUFBTSxZQUFZLEtBQUssWUFBWSxrQkFBa0I7QUFDckQsTUFBSSxDQUFDLGFBQWEsS0FBSyxZQUFZLDJCQUEyQixHQUFHO0FBR2hFLFFBQUksS0FBSyxZQUFZLHdCQUF3QixXQUFXLElBQUksR0FBRztBQUM5RCx5QkFBbUIsTUFBTSxXQUFXLEVBQUU7QUFDdEMsK0JBQXlCLE1BQU0sRUFBRTtBQUNqQyxXQUFLLHdCQUF3QjtBQUM3QixXQUFLLGtCQUFrQjtBQUN2QixXQUFLLHdCQUF3QjtBQUM3QjtBQUFBLElBQ0Q7QUFDQSx1QkFBbUIsTUFBTSxXQUFXLGtCQUFrQixJQUFJLENBQUM7QUFDM0QsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxnQkFBZ0IscUJBQXFCO0FBQzFDO0FBQUEsRUFDRDtBQUNBLE9BQUssaUJBQWlCO0FBQ3RCLFFBQU0sbUJBQW1CLEtBQUs7QUFDOUIsTUFBSTtBQUNILFVBQU0saUJBQWlCLEtBQUssa0JBQWtCLEtBQUssa0JBQWtCLEtBQUs7QUFDMUUsVUFBTSxVQUFVLE1BQU0sVUFBVSxNQUFNO0FBQUEsTUFDckMsTUFBTTtBQUFBLE1BQ047QUFBQSxNQUNBLEdBQUksaUJBQWlCLEVBQUUsZUFBZSxJQUFJLENBQUM7QUFBQSxNQUMzQyxHQUFJLEtBQUssZ0JBQWdCLEVBQUUsU0FBUyxLQUFLLGNBQWMsSUFBSSxDQUFDO0FBQUEsSUFDN0QsR0FBRyxnQkFBZ0I7QUFDbkIsVUFBTSx1QkFBdUIsS0FBSyxrQkFBa0IsTUFBTTtBQUMxRCxRQUFJLENBQUMsUUFBUSxVQUFVO0FBQ3RCLFVBQUksc0JBQXNCO0FBQ3pCLGFBQUssZ0JBQWdCLFFBQVEsTUFBTTtBQUFBLE1BQ3BDO0FBQ0E7QUFBQSxJQUNEO0FBQ0EsUUFBSSxrQkFBa0IsTUFBTSxTQUFTLEVBQUUsS0FBSyxNQUFNLE1BQU07QUFDdkQseUJBQW1CLE1BQU0sV0FBVyxFQUFFO0FBQUEsSUFDdkM7QUFDQSxRQUFJLHNCQUFzQjtBQUV6QixVQUFJLG1CQUFtQixJQUFJLE1BQU0sTUFBTTtBQUN0QyxpQ0FBeUIsTUFBTSxFQUFFO0FBQ2pDLGFBQUssd0JBQXdCO0FBQUEsTUFDOUI7QUFDQSxXQUFLLGtCQUFrQjtBQUN2QixXQUFLLHdCQUF3QjtBQUFBLElBQzlCO0FBQUEsRUFDRCxRQUFRO0FBQ1AsUUFBSSxLQUFLLGtCQUFrQixNQUFNLFdBQVc7QUFDM0MsV0FBSyxnQkFBZ0IsUUFBUTtBQUFBLElBQzlCO0FBQUEsRUFDRCxVQUFFO0FBQ0QsU0FBSyxpQkFBaUI7QUFBQSxFQUN2QjtBQUVGO0FBRU8sU0FBUyxhQUFhLE1BQTJDO0FBRXRFLFFBQU0sT0FBTyxtQkFBbUIsSUFBSTtBQUNwQyxNQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssZUFBZTtBQUNqQztBQUFBLEVBQ0Q7QUFDQSxNQUFJLHVCQUF1QixJQUFJLEdBQUc7QUFDakM7QUFBQSxFQUNEO0FBQ0EsTUFBSSxnQ0FBZ0MsSUFBSSxHQUFHO0FBQzFDO0FBQUEsRUFDRDtBQUNBLFFBQU0sWUFBWSxLQUFLLGtCQUFrQjtBQUN6QyxRQUFNLGdCQUFnQixLQUFLO0FBQzNCLFFBQU0sT0FBTyxLQUFLLFlBQVksU0FBUyxTQUFTLEVBQUUsS0FBSyxPQUFLLEVBQUUsT0FBTyxpQkFBaUIsRUFBRSxTQUFTLE1BQU07QUFDdkcsUUFBTSxTQUFTLE9BQU8sc0JBQXNCLEtBQUssSUFBSSxJQUFJO0FBRXpELE1BQUksV0FBVyxVQUFhLFNBQVMsUUFBUTtBQUM1QyxTQUFLLGlCQUFpQjtBQUN0QjtBQUFBLEVBQ0Q7QUFDQSxRQUFNLFNBQVMsTUFBTSxRQUFRLEtBQUssS0FBSztBQUN2QyxRQUFNLFFBQVEsS0FBSyxZQUFZLG1CQUFtQixXQUFXLFFBQVEsTUFBTSxNQUFNLE9BQU87QUFDeEYsTUFBSSxDQUFDLE9BQU87QUFDWCxTQUFLO0FBQUEsTUFDSixDQUFDLEtBQUssWUFBWSxrQkFBa0IsS0FBSyxLQUFLLFlBQVksMkJBQTJCLElBQ2xGLHdCQUNBO0FBQUEsSUFDSjtBQUNBO0FBQUEsRUFDRDtBQUNBLE9BQUssaUJBQWlCO0FBRXhCO0FBRU8sU0FBUyxjQUFjLE1BQTJDO0FBRXZFLFFBQU0sT0FBTyxtQkFBbUIsSUFBSTtBQUNwQyxRQUFNLE9BQU8sS0FBSyxvQkFBb0I7QUFDdEMsTUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNO0FBQ25CO0FBQUEsRUFDRDtBQUNBLE1BQUksdUJBQXVCLElBQUksR0FBRztBQUNqQztBQUFBLEVBQ0Q7QUFDQSxNQUFJLGdDQUFnQyxJQUFJLEdBQUc7QUFDMUM7QUFBQSxFQUNEO0FBQ0EsUUFBTSxTQUFTLHNCQUFzQixLQUFLLE9BQU87QUFFakQsTUFBSSxXQUFXLFVBQWEsU0FBUyxRQUFRO0FBQzVDLFNBQUssaUJBQWlCO0FBQ3RCO0FBQUEsRUFDRDtBQUNBLFFBQU0sWUFBWSxLQUFLLGtCQUFrQjtBQUN6QyxRQUFNLFNBQVMsS0FBSztBQUNwQixRQUFNLFFBQVEsS0FBSyxZQUFZLDhCQUE4QixXQUFXLFFBQVEsSUFBSTtBQUNwRixNQUFJLENBQUMsT0FBTztBQUNYLFNBQUs7QUFBQSxNQUNKLENBQUMsS0FBSyxZQUFZLGtCQUFrQixLQUFLLEtBQUssWUFBWSwyQkFBMkIsSUFDbEYsd0JBQ0E7QUFBQSxJQUNKO0FBQ0E7QUFBQSxFQUNEO0FBQ0EsT0FBSyxpQkFBaUIsTUFBTSxLQUFLO0FBQ2pDLE9BQUssWUFBWSw0QkFBNEIsV0FBVyxNQUFNO0FBQzlELE9BQUssa0JBQWtCO0FBRXpCO0FBRU8sU0FBUyxlQUFlLE1BQTZDO0FBRTFFLFNBQU8sS0FBSyxpQkFBaUI7QUFFL0I7QUFFTyxTQUFTLFlBQVksTUFBcUMsV0FBMkI7QUFFMUYsU0FBTyw4QkFBOEIsV0FBVyxlQUFlLElBQUksQ0FBQztBQUV0RTtBQUVPLFNBQVMsa0JBQWtCLE1BQXFDLFdBQTJCO0FBRWhHLFFBQU0sTUFBTSxZQUFZLE1BQU0sU0FBUztBQUN2QyxNQUFJLEtBQUssT0FBTyxJQUFJLEdBQUcsR0FBRztBQUN6QixXQUFPLEtBQUssT0FBTyxJQUFJLEdBQUcsS0FBSztBQUFBLEVBQ2hDO0FBQ0EsTUFBSSxDQUFDLDRCQUE0QixLQUFLLG9CQUFvQixHQUFHO0FBQzVELFdBQU87QUFBQSxFQUNSO0FBQ0EsUUFBTSxTQUFTLDBCQUEwQixLQUFLLGdCQUFnQixXQUFXLGVBQWUsSUFBSSxDQUFDO0FBQzdGLE9BQUssT0FBTyxJQUFJLEtBQUssTUFBTTtBQUMzQixTQUFPO0FBRVQ7QUFFTyxTQUFTLG1CQUFtQixNQUFxQyxXQUFtQixNQUFvQjtBQUU3RyxPQUFLLE9BQU8sSUFBSSxZQUFZLE1BQU0sU0FBUyxHQUFHLElBQUk7QUFDbEQsTUFBSSw0QkFBNEIsS0FBSyxvQkFBb0IsR0FBRztBQUMzRCwrQkFBMkIsS0FBSyxnQkFBZ0IsV0FBVyxlQUFlLElBQUksR0FBRyxJQUFJO0FBQUEsRUFDdEY7QUFFRjtBQUVPLFNBQVMsNEJBQTRCLE1BQTJDO0FBRXJGLE1BQUksQ0FBQyxLQUFLLGdCQUFnQixLQUFLLG1CQUFtQixXQUFXO0FBQzVEO0FBQUEsRUFDRDtBQUNBLDJCQUF5QixNQUFNLGtCQUFrQixNQUFNLEtBQUssa0JBQWtCLENBQUMsQ0FBQztBQUNoRixPQUFLLGtCQUFrQjtBQUV6QjtBQUVPLFNBQVMsK0JBQStCLE1BQXFDLFdBQXlCO0FBRTNHLGFBQVcsT0FBTyxDQUFDLEdBQUcsS0FBSyxPQUFPLEtBQUssQ0FBQyxHQUFHO0FBQzFDLFFBQUksMkNBQTJDLEdBQUcsTUFBTSxXQUFXO0FBQ2xFLFdBQUssT0FBTyxPQUFPLEdBQUc7QUFBQSxJQUN2QjtBQUFBLEVBQ0Q7QUFDQSx5Q0FBdUMsS0FBSyxnQkFBZ0IsU0FBUztBQUV2RTtBQUVPLFNBQVMsMEJBQTBCLE9BQTRDO0FBTXRGOyIsCiAgIm5hbWVzIjogW10KfQo=
