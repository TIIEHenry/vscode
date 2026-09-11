/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import type { ConversationWriteMessage, IConversationSessionViewLease, PostOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type { UniverseAgentCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { COMPOSER_AGENT_OPTIONS, composerAgentSelectOptions, composerModelIds, composerModelSelectOptions, composerToolNames } from './conversationComposerCatalog.js';
import { isConversationEngineLive, isConversationPairingHold } from './conversationSessionStatus.js';
import {
	conversationLensDockCatalogProbing,
	conversationLensDockNoAgent,
	conversationLensDockNoModel,
	type ConversationComposerPostFailureReason,
} from './conversationLensDockStrings.js';
import { IConversationRosterService } from './conversationStubService.js';
import {
	loadUaClientComposerDraft,
	pruneUaClientComposerDrafts,
	removeUaClientComposerDraftsForSession,
	sessionIdFromUaClientComposerDraftEntryKey,
	storeUaClientComposerDraft,
	uaClientComposerDraftEntryKey,
} from './uaClientComposerDrafts.js';
import { shouldRestoreComposerDrafts } from '../common/uaClientSettingsHelpers.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import type { ConversationSessionConfigSelection } from './conversationLensComposerChrome.js';

export interface IConversationLensComposerHost {
	filterAgentId: string | undefined;
	composerPolicy: 'compose' | 'turnEdit' | 'queueEdit';
	submitInFlight: boolean;
	modelSelectedIndex: number;
	composerCatalogGeneration: number;
	catalogToolNames: readonly string[];
	catalogModelIds: readonly string[];
	drafts: Map<string, string>;
	editingTurnId: string | undefined;
	editingQueueItemId: string | undefined;
	sessionViewLease: IConversationSessionViewLease | undefined;
	dockTextarea: HTMLTextAreaElement;
	sendButton: Button;
	agentSelectBox: SelectBox;
	modelSelectBox: SelectBox;
	readonly stubService: IConversationRosterService;
	readonly configurationService: IConfigurationService;
	readonly storageService: IStorageService;
	readonly uaConnection: IUniverseAgentConnection;
	getBoundSessionId(): string;
	getSessionConfig(sessionId: string): ConversationSessionConfigSelection;
	updateSendEnabled(): void;
	updateGateRow(): void;
	exitComposerEdit(restoreComposeDraft?: boolean, releaseQueueHold?: boolean): void;
	getEditingQueueItem(): { id: string; content: string } | undefined;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
	resetInputHistoryBrowse(): void;
	renderInboxStatus(): void;
	readComposerDraft(sessionId: string): string;
	updateConversationPhase(): void;
}

export function refreshComposerCatalogs(host: IConversationLensComposerHost): void {

		const generation = ++host.composerCatalogGeneration;
		if (!host.stubService.isEngineConnected()) {
			if (keepComposerCatalogForPairingHold(host)) {
				restoreComposerCatalogLeftoverOrKeepPainted(host);
				host.updateSendEnabled();
				host.updateGateRow();
				return;
			}
			const sessionId = host.getBoundSessionId();
			const { agentIndex } = host.getSessionConfig(sessionId);
			const clampedAgentIndex = Math.min(agentIndex, COMPOSER_AGENT_OPTIONS.length - 1);
			host.agentSelectBox.setOptions(COMPOSER_AGENT_OPTIONS.map(text => ({ text })), clampedAgentIndex);
			host.modelSelectBox.setOptions([{ text: conversationLensDockNoModel }], 0);
			host.modelSelectedIndex = 0;
			host.catalogModelIds = [''];
			host.catalogToolNames = [];
			host.updateSendEnabled();
			host.updateGateRow();
			return;
		}
		keepLastGoodComposerCatalogOrEmpty(host);
		host.updateSendEnabled();
		host.updateGateRow();
		void loadConnectedComposerCatalogs(host, generation);
	
}

type LastGoodComposerCatalog = {
	agent?: { options: { text: string }[] };
	model?: { options: { text: string }[]; ids: readonly string[]; selectedIndex: number };
	tools?: { names: readonly string[] };
};

const lastGoodComposerCatalogs = new WeakMap<IConversationLensComposerHost, LastGoodComposerCatalog>();

function rememberLastGoodComposerCatalog(host: IConversationLensComposerHost, patch: LastGoodComposerCatalog): void {
	const prev = lastGoodComposerCatalogs.get(host) ?? {};
	lastGoodComposerCatalogs.set(host, { ...prev, ...patch });
}

function applyUnknownComposerCatalogHonesty(host: IConversationLensComposerHost, caps: UniverseAgentCapabilitySnapshot): void {
	const last = lastGoodComposerCatalogs.get(host);
	if (caps.agentProfiles.support === 'UNKNOWN') {
		if (last?.agent) {
			const { agentIndex } = host.getSessionConfig(host.getBoundSessionId());
			host.agentSelectBox.setOptions(last.agent.options, Math.min(agentIndex, last.agent.options.length - 1));
		} else {
			host.agentSelectBox.setOptions([{ text: conversationLensDockCatalogProbing }], 0);
		}
	}
	if (caps.models.support === 'UNKNOWN') {
		if (last?.model) {
			host.modelSelectBox.setOptions(last.model.options, last.model.selectedIndex);
			host.modelSelectedIndex = last.model.selectedIndex;
			host.catalogModelIds = last.model.ids;
		} else {
			host.modelSelectBox.setOptions([{ text: conversationLensDockCatalogProbing }], 0);
			host.modelSelectedIndex = 0;
			host.catalogModelIds = [''];
		}
	}
	if (caps.tools.support === 'UNKNOWN') {
		if (last?.tools) {
			host.catalogToolNames = last.tools.names;
		}
	}
}

function restoreLastGoodComposerCatalogOnSupportedThrow(host: IConversationLensComposerHost, facet: 'agent' | 'model' | 'tools'): void {
	const last = lastGoodComposerCatalogs.get(host);
	if (facet === 'agent') {
		if (last?.agent) {
			const { agentIndex } = host.getSessionConfig(host.getBoundSessionId());
			host.agentSelectBox.setOptions(last.agent.options, Math.min(agentIndex, last.agent.options.length - 1));
			return;
		}
		host.agentSelectBox.setOptions([{ text: conversationLensDockNoAgent }], 0);
		return;
	}
	if (facet === 'model') {
		if (last?.model) {
			host.modelSelectBox.setOptions(last.model.options, last.model.selectedIndex);
			host.modelSelectedIndex = last.model.selectedIndex;
			host.catalogModelIds = last.model.ids;
			return;
		}
		host.modelSelectBox.setOptions([{ text: conversationLensDockNoModel }], 0);
		host.modelSelectedIndex = 0;
		host.catalogModelIds = [''];
		return;
	}
	host.catalogToolNames = last?.tools ? last.tools.names : [];
}

function keepLastGoodComposerCatalogOrEmpty(host: IConversationLensComposerHost): void {
	restoreLastGoodComposerCatalogOnSupportedThrow(host, 'agent');
	restoreLastGoodComposerCatalogOnSupportedThrow(host, 'model');
	restoreLastGoodComposerCatalogOnSupportedThrow(host, 'tools');
}

function hasComposerCatalogLeftover(host: IConversationLensComposerHost): boolean {
	const last = lastGoodComposerCatalogs.get(host);
	if (last?.agent || last?.model || last?.tools) {
		return true;
	}
	if (host.catalogToolNames.length > 0) {
		return true;
	}
	return host.catalogModelIds.some(id => id.length > 0);
}

function keepComposerCatalogForPairingHold(host: IConversationLensComposerHost): boolean {
	const snapshot = host.uaConnection.getConnectionSnapshot();
	if (!snapshot.pairingPending || !isConversationEngineLive(host.uaConnection.getConnectionPhase(), false)) {
		return false;
	}
	return hasComposerCatalogLeftover(host);
}

function restoreComposerCatalogLeftoverOrKeepPainted(host: IConversationLensComposerHost): void {
	if (lastGoodComposerCatalogs.get(host)) {
		keepLastGoodComposerCatalogOrEmpty(host);
	}
}

export async function loadConnectedComposerCatalogs(host: IConversationLensComposerHost, generation: number): Promise<void> {

		const caps = ensureCapabilitySnapshot(host.uaConnection.getCapabilitySnapshot());
		if (generation !== host.composerCatalogGeneration) {
			return;
		}
		applyUnknownComposerCatalogHonesty(host, caps);
		if (caps.agentProfiles.support === 'SUPPORTED') {
			try {
				const result = await host.uaConnection.listAgentProfiles();
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
				restoreLastGoodComposerCatalogOnSupportedThrow(host, 'agent');
			}
		}
		if (caps.models.support === 'SUPPORTED') {
			try {
				const result = await host.uaConnection.listModels();
				if (generation !== host.composerCatalogGeneration) {
					return;
				}
				const options = composerModelSelectOptions(result.models);
				const ids = composerModelIds(result.models);
				host.modelSelectBox.setOptions(options, 0);
				host.modelSelectedIndex = 0;
				host.catalogModelIds = ids;
				rememberLastGoodComposerCatalog(host, { model: { options, ids, selectedIndex: 0 } });
			} catch {
				if (generation !== host.composerCatalogGeneration) {
					return;
				}
				restoreLastGoodComposerCatalogOnSupportedThrow(host, 'model');
			}
		}
		if (caps.tools.support === 'SUPPORTED') {
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
				restoreLastGoodComposerCatalogOnSupportedThrow(host, 'tools');
			}
		}
	
}

export function postBound(host: IConversationLensComposerHost, msg: ConversationWriteMessage): Promise<PostOutcome> {

		// D294: pairing-hold keeps the leftover engine lease for reads (D289).
		// Writes must not fall through to lease.post — same closed outcome as a missing session.
		if (isConversationPairingHold(host.uaConnection)) {
			return Promise.resolve({ accepted: false, reason: 'no_such_session' });
		}
		if (msg.kind === 'clientToolRespond' && host.stubService.isEngineConnected()) {
			const forwarded = host.stubService.respondClientTool(
				host.getBoundSessionId(),
				msg.requestId,
				{ content: msg.resultJson });
			return Promise.resolve(forwarded
				? { accepted: true, correlation: { id: `clientTool:${msg.requestId}` } }
				: { accepted: false, reason: 'no_such_session' });
		}
		if (host.stubService.isEngineConnected() && !host.stubService.isEngineSessionReady()) {
			return Promise.resolve({ accepted: false, reason: 'no_such_session' });
		}
		const lease = host.sessionViewLease;
		if (!lease) {
			return Promise.resolve({ accepted: false, reason: 'no_such_session' });
		}
		return lease.post(msg);
	
}

export async function submitDraft(host: IConversationLensComposerHost): Promise<void> {

		if (host.composerPolicy === 'turnEdit') {
			saveTurnEdit(host);
			return;
		}
		if (host.composerPolicy === 'queueEdit') {
			saveQueueEdit(host);
			return;
		}
		if (host.submitInFlight) {
			return;
		}
		const text = host.dockTextarea.value.trim();
		if (!text) {
			return;
		}
		const sessionId = host.getBoundSessionId();
		const connected = host.stubService.isEngineConnected();
		if (!connected && host.stubService.hasEngineConnectionHistory()) {
			// Engine-aware disconnect: do not stub-echo or claim delivered/synced.
			// Try the existing queue API; disconnected cache currently rejects.
			if (host.stubService.enqueueMessageQueueItem(sessionId, text)) {
				writeComposerDraft(host, sessionId, '');
				host.dockTextarea.value = '';
				host.resetInputHistoryBrowse();
				host.updateSendEnabled();
				host.updateConversationPhase();
				return;
			}
			writeComposerDraft(host, sessionId, host.dockTextarea.value);
			host.updateSendEnabled();
			host.showPostFailure('engine_disconnected');
			return;
		}
		host.submitInFlight = true;
		try {
			const outcome = await postBound(host, { kind: 'submitInput', text });
			if (!outcome.accepted) {
				host.showPostFailure(outcome.reason);
				return;
			}
			writeComposerDraft(host, sessionId, '');
			host.dockTextarea.value = '';
			host.resetInputHistoryBrowse();
			host.updateConversationPhase();
		} catch {
			host.showPostFailure('failed');
		} finally {
			host.submitInFlight = false;
		}
	
}

export function saveTurnEdit(host: IConversationLensComposerHost): void {

		const text = host.dockTextarea.value.trim();
		if (!text || !host.editingTurnId) {
			return;
		}
		const sessionId = host.getBoundSessionId();
		const turnId = host.editingTurnId;
		const saved = host.stubService.updateUserTurnText(sessionId, turnId, text);
		if (!saved) {
			host.showPostFailure(
				!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			return;
		}
		host.exitComposerEdit();
	
}

export function saveQueueEdit(host: IConversationLensComposerHost): void {

		const text = host.dockTextarea.value.trim();
		const item = host.getEditingQueueItem();
		if (!text || !item || text === item.content) {
			return;
		}
		const sessionId = host.getBoundSessionId();
		const itemId = item.id;
		const saved = host.stubService.updateMessageQueueItemContent(sessionId, itemId, text);
		if (!saved) {
			host.showPostFailure(
				!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			return;
		}
		host.exitComposerEdit(true, false);
		host.stubService.releaseMessageQueueItemHold(sessionId, itemId);
		host.renderInboxStatus();
	
}

export function composerChatId(host: IConversationLensComposerHost): string {

		return host.filterAgentId ?? 'default';
	
}

export function draftMapKey(host: IConversationLensComposerHost, sessionId: string): string {

		return uaClientComposerDraftEntryKey(sessionId, composerChatId(host));
	
}

export function readComposerDraft(host: IConversationLensComposerHost, sessionId: string): string {

		const key = draftMapKey(host, sessionId);
		if (host.drafts.has(key)) {
			return host.drafts.get(key) ?? '';
		}
		if (!shouldRestoreComposerDrafts(host.configurationService)) {
			return '';
		}
		const stored = loadUaClientComposerDraft(host.storageService, sessionId, composerChatId(host));
		host.drafts.set(key, stored);
		return stored;
	
}

export function writeComposerDraft(host: IConversationLensComposerHost, sessionId: string, text: string): void {

		host.drafts.set(draftMapKey(host, sessionId), text);
		if (shouldRestoreComposerDrafts(host.configurationService)) {
			storeUaClientComposerDraft(host.storageService, sessionId, composerChatId(host), text);
		}
	
}

export function restoreComposerDraftToInput(host: IConversationLensComposerHost): void {

		if (!host.dockTextarea || host.composerPolicy !== 'compose') {
			return;
		}
		host.dockTextarea.value = readComposerDraft(host, host.getBoundSessionId());
		host.updateSendEnabled();
	
}

export function deleteComposerDraftsForSession(host: IConversationLensComposerHost, sessionId: string): void {

		for (const key of [...host.drafts.keys()]) {
			if (sessionIdFromUaClientComposerDraftEntryKey(key) === sessionId) {
				host.drafts.delete(key);
			}
		}
		removeUaClientComposerDraftsForSession(host.storageService, sessionId);
	
}

export function pruneOrphanComposerDrafts(host: IConversationLensComposerHost): void {

		const liveIds = host.stubService.getSessions().map(session => session.id);
		const live = new Set(liveIds);
		for (const key of [...host.drafts.keys()]) {
			if (!live.has(sessionIdFromUaClientComposerDraftEntryKey(key))) {
				host.drafts.delete(key);
			}
		}
		pruneUaClientComposerDrafts(host.storageService, liveIds);
	
}
