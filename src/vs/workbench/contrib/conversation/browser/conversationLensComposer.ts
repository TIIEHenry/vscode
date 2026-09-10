/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import type { ConversationWriteMessage, IConversationSessionViewLease, PostOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { COMPOSER_AGENT_OPTIONS, composerAgentSelectOptions, composerModelIds, composerModelSelectOptions, composerToolNames } from './conversationComposerCatalog.js';
import {
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
		host.agentSelectBox.setOptions([{ text: conversationLensDockNoAgent }], 0);
		host.modelSelectBox.setOptions([{ text: conversationLensDockNoModel }], 0);
		host.modelSelectedIndex = 0;
		host.catalogModelIds = [''];
		host.catalogToolNames = [];
		host.updateSendEnabled();
		host.updateGateRow();
		void loadConnectedComposerCatalogs(host, generation);
	
}

export async function loadConnectedComposerCatalogs(host: IConversationLensComposerHost, generation: number): Promise<void> {

		const caps = ensureCapabilitySnapshot(host.uaConnection.getCapabilitySnapshot());
		if (caps.agentProfiles.support === 'SUPPORTED') {
			try {
				const result = await host.uaConnection.listAgentProfiles();
				if (generation !== host.composerCatalogGeneration) {
					return;
				}
				const options = composerAgentSelectOptions(result.profiles);
				const { agentIndex } = host.getSessionConfig(host.getBoundSessionId());
				host.agentSelectBox.setOptions(options, Math.min(agentIndex, options.length - 1));
			} catch {
				host.agentSelectBox.setOptions([{ text: conversationLensDockNoAgent }], 0);
			}
		}
		if (caps.models.support === 'SUPPORTED') {
			try {
				const result = await host.uaConnection.listModels();
				if (generation !== host.composerCatalogGeneration) {
					return;
				}
				host.modelSelectBox.setOptions(composerModelSelectOptions(result.models), 0);
				host.modelSelectedIndex = 0;
				host.catalogModelIds = composerModelIds(result.models);
			} catch {
				host.modelSelectBox.setOptions([{ text: conversationLensDockNoModel }], 0);
				host.modelSelectedIndex = 0;
				host.catalogModelIds = [''];
			}
		}
		if (caps.tools.support === 'SUPPORTED') {
			try {
				const result = await host.uaConnection.listTools();
				if (generation !== host.composerCatalogGeneration) {
					return;
				}
				host.catalogToolNames = composerToolNames(result.tools);
			} catch {
				host.catalogToolNames = [];
			}
		}
	
}

export function postBound(host: IConversationLensComposerHost, msg: ConversationWriteMessage): Promise<PostOutcome> {

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
