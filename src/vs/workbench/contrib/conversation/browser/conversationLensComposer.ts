/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import type { ConversationWriteMessage, IConversationSessionViewLease, PostOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { COMPOSER_AGENT_OPTIONS, composerAgentSelectOptions, composerModelSelectOptions, composerToolNames } from './conversationComposerCatalog.js';
import {
	conversationLensDockMicNotAvailable,
	conversationLensDockMicStopTitle,
	conversationLensDockMicTitle,
	conversationLensDockNoAgent,
	conversationLensDockNoModel,
	conversationLensVoiceStubPhraseOne,
	conversationLensVoiceStubPhraseThree,
	conversationLensVoiceStubPhraseTwo,
} from './conversationLensDockStrings.js';
import { IConversationRosterService } from './conversationStubService.js';
import { appendVoiceTextToDraft, ConversationVoiceClip } from './conversationVoiceTranscriptModel.js';
import {
	loadUaClientComposerDraft,
	pruneUaClientComposerDrafts,
	removeUaClientComposerDraftsForSession,
	sessionIdFromUaClientComposerDraftEntryKey,
	storeUaClientComposerDraft,
	uaClientComposerDraftEntryKey,
} from './uaClientComposerDrafts.js';
import { shouldRestoreComposerDrafts } from '../common/uaClientSettingsHelpers.js';
import { ConversationVoiceTranscriptBar } from './conversationVoiceTranscriptBar.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';

const STUB_VOICE_TRANSCRIPT_PHRASES = [
	conversationLensVoiceStubPhraseOne,
	conversationLensVoiceStubPhraseTwo,
	conversationLensVoiceStubPhraseThree,
] as const;

export interface IConversationLensComposerHost {
	filterAgentId: string | undefined;
	composerPolicy: 'compose' | 'turnEdit' | 'queueEdit';
	submitInFlight: boolean;
	modelSelectedIndex: number;
	composerCatalogGeneration: number;
	catalogToolNames: readonly string[];
	drafts: Map<string, string>;
	voiceClipsBySessionId: Map<string, ConversationVoiceClip[]>;
	voicePhraseIndexBySessionId: Map<string, number>;
	voiceTranscriptTimeouts: Map<string, ReturnType<typeof setTimeout>>;
	nextVoiceClipId: number;
	editingTurnId: string | undefined;
	editingQueueItemId: string | undefined;
	sessionViewLease: IConversationSessionViewLease | undefined;
	dockTextarea: HTMLTextAreaElement;
	sendButton: Button;
	agentSelectBox: SelectBox;
	modelSelectBox: SelectBox;
	micButton: Button;
	voiceTranscriptBar: ConversationVoiceTranscriptBar;
	readonly stubService: IConversationRosterService;
	readonly configurationService: IConfigurationService;
	readonly storageService: IStorageService;
	readonly uaConnection: IUniverseAgentConnection;
	getSessionConfig(sessionId: string): { agentIndex: number; routeIndex: number };
	updateSendEnabled(): void;
	updateGateRow(): void;
	exitComposerEdit(restoreComposeDraft?: boolean, releaseQueueHold?: boolean): void;
	getEditingQueueItem(): { id: string; content: string } | undefined;
	showPostFailure(reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated'): void;
	resetInputHistoryBrowse(): void;
	renderInboxStatus(): void;
	renderVoiceTranscriptBar(): void;
	updateVoiceMicChrome(): void;
	readComposerDraft(sessionId: string): string;
	updateConversationPhase(): void;
}

export function refreshComposerCatalogs(host: IConversationLensComposerHost): void {

		const generation = ++host.composerCatalogGeneration;
		if (!host.stubService.isEngineConnected()) {
			const sessionId = host.stubService.getActiveSessionId();
			const { agentIndex } = host.getSessionConfig(sessionId);
			host.agentSelectBox.setOptions(COMPOSER_AGENT_OPTIONS.map(text => ({ text })), agentIndex);
			host.modelSelectBox.setOptions(
				[
					{ text: conversationLensDockNoModel },
					{ text: localize('conversationLens.dockStubModel', "Stub model") },
				],
				host.modelSelectedIndex);
			host.catalogToolNames = [];
			host.updateSendEnabled();
			host.updateGateRow();
			return;
		}
		host.agentSelectBox.setOptions([{ text: conversationLensDockNoAgent }], 0);
		host.modelSelectBox.setOptions([{ text: conversationLensDockNoModel }], 0);
		host.modelSelectedIndex = 0;
		host.catalogToolNames = [];
		host.updateSendEnabled();
		host.updateGateRow();
		void loadConnectedComposerCatalogs(host, generation);
	
}

export async function loadConnectedComposerCatalogs(host: IConversationLensComposerHost, generation: number): Promise<void> {

		const caps = host.uaConnection.getCapabilitySnapshot();
		if (caps.agentProfiles.support === 'SUPPORTED') {
			try {
				const result = await host.uaConnection.listAgentProfiles();
				if (generation !== host.composerCatalogGeneration) {
					return;
				}
				const options = composerAgentSelectOptions(result.profiles);
				const { agentIndex } = host.getSessionConfig(host.stubService.getActiveSessionId());
				host.agentSelectBox.setOptions(options, Math.min(agentIndex, options.length - 1));
			} catch {
				// Keep honest empty agent list.
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
			} catch {
				// Keep "No model"; send is not gated when connected.
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
				host.stubService.getActiveSessionId(),
				msg.requestId,
				{ content: msg.resultJson });
			return Promise.resolve(forwarded
				? { accepted: true, correlation: { id: `clientTool:${msg.requestId}` } }
				: { accepted: false, reason: 'no_such_session' });
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
		if (!host.stubService.isEngineConnected() && host.modelSelectedIndex === 0) {
			// "No model" is the engine catalog label, not a send lock. Local stub still posts.
			host.modelSelectedIndex = 1;
			host.modelSelectBox.select(1);
		}
		const sessionId = host.stubService.getActiveSessionId();
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
		} finally {
			host.submitInFlight = false;
		}
	
}

export function saveTurnEdit(host: IConversationLensComposerHost): void {

		const text = host.dockTextarea.value.trim();
		if (!text || !host.editingTurnId) {
			return;
		}
		const sessionId = host.stubService.getActiveSessionId();
		const turnId = host.editingTurnId;
		host.exitComposerEdit();
		host.stubService.updateUserTurnText(sessionId, turnId, text);
	
}

export function saveQueueEdit(host: IConversationLensComposerHost): void {

		const text = host.dockTextarea.value.trim();
		const item = host.getEditingQueueItem();
		if (!text || !item || text === item.content) {
			return;
		}
		const sessionId = host.stubService.getActiveSessionId();
		const itemId = item.id;
		host.exitComposerEdit(true, false);
		host.stubService.updateMessageQueueItemContent(sessionId, itemId, text);
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
		host.dockTextarea.value = readComposerDraft(host, host.stubService.getActiveSessionId());
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

export function getVoiceClips(host: IConversationLensComposerHost, sessionId: string): readonly ConversationVoiceClip[] {

		return host.voiceClipsBySessionId.get(sessionId) ?? [];
	
}

export function setVoiceClips(host: IConversationLensComposerHost, sessionId: string, clips: readonly ConversationVoiceClip[]): void {

		if (clips.length === 0) {
			host.voiceClipsBySessionId.delete(sessionId);
		} else {
			host.voiceClipsBySessionId.set(sessionId, [...clips]);
		}
		renderVoiceTranscriptBar(host);
		updateVoiceMicChrome(host);
	
}

export function renderVoiceTranscriptBar(host: IConversationLensComposerHost): void {

		const composeMode = host.composerPolicy === 'compose';
		host.voiceTranscriptBar.setComposerVisible(composeMode);
		host.voiceTranscriptBar.render(getVoiceClips(host, host.stubService.getActiveSessionId()));
	
}

export function updateVoiceMicChrome(host: IConversationLensComposerHost): void {

		const engineConnected = host.stubService.isEngineConnected();
		const recording = getVoiceClips(host, host.stubService.getActiveSessionId())
			.some(clip => clip.status === 'recording');

		if (!engineConnected || host.composerPolicy !== 'compose') {
			host.micButton.enabled = false;
			host.micButton.element.classList.remove('conversation-lens-dock-control--filled');
			host.micButton.element.classList.add('conversation-lens-dock-control--ghost');
			const title = engineConnected
				? conversationLensDockMicTitle
				: `${conversationLensDockMicTitle} — ${conversationLensDockMicNotAvailable}`;
			host.micButton.setTitle(title);
			host.micButton.setAriaLabel(title);
			return;
		}

		host.micButton.enabled = true;
		if (recording) {
			host.micButton.element.classList.remove('conversation-lens-dock-control--ghost');
			host.micButton.element.classList.add('conversation-lens-dock-control--filled');
			host.micButton.setTitle(conversationLensDockMicStopTitle);
			host.micButton.setAriaLabel(conversationLensDockMicStopTitle);
			return;
		}

		host.micButton.element.classList.remove('conversation-lens-dock-control--filled');
		host.micButton.element.classList.add('conversation-lens-dock-control--ghost');
		host.micButton.setTitle(conversationLensDockMicTitle);
		host.micButton.setAriaLabel(conversationLensDockMicTitle);
	
}

export function toggleVoiceRecording(host: IConversationLensComposerHost): void {

		if (!host.stubService.isEngineConnected() || host.composerPolicy !== 'compose') {
			return;
		}
		const sessionId = host.stubService.getActiveSessionId();
		const clips = [...getVoiceClips(host, sessionId)];
		const recording = clips.find(clip => clip.status === 'recording');
		if (recording) {
			finishVoiceClip(host, sessionId, recording.id);
			return;
		}
		const clip: ConversationVoiceClip = {
			id: `voice-${++host.nextVoiceClipId}`,
			status: 'recording',
			durationLabel: '0:01',
		};
		setVoiceClips(host, sessionId, [...clips, clip]);
	
}

export function finishVoiceClip(host: IConversationLensComposerHost, sessionId: string, clipId: string): void {

		const clips = getVoiceClips(host, sessionId).map(clip =>
			clip.id === clipId ? { ...clip, status: 'transcribing' as const } : clip);
		setVoiceClips(host, sessionId, clips);

		const phraseIndex = host.voicePhraseIndexBySessionId.get(sessionId) ?? 0;
		const phrase = STUB_VOICE_TRANSCRIPT_PHRASES[phraseIndex % STUB_VOICE_TRANSCRIPT_PHRASES.length];
		host.voicePhraseIndexBySessionId.set(sessionId, phraseIndex + 1);

		const existingTimeout = host.voiceTranscriptTimeouts.get(clipId);
		if (existingTimeout !== undefined) {
			clearTimeout(existingTimeout);
		}
		const timeout = setTimeout(() => {
			host.voiceTranscriptTimeouts.delete(clipId);
			const remaining = getVoiceClips(host, sessionId).filter(clip => clip.id !== clipId);
			setVoiceClips(host, sessionId, remaining);
			const draft = host.stubService.getActiveSessionId() === sessionId && host.composerPolicy === 'compose'
				? host.dockTextarea.value
				: readComposerDraft(host, sessionId);
			const nextDraft = appendVoiceTextToDraft(draft, phrase);
			writeComposerDraft(host, sessionId, nextDraft);
			if (host.stubService.getActiveSessionId() === sessionId && host.composerPolicy === 'compose') {
				host.dockTextarea.value = nextDraft;
				host.updateSendEnabled();
			}
		}, 30);
		host.voiceTranscriptTimeouts.set(clipId, timeout);
	
}
