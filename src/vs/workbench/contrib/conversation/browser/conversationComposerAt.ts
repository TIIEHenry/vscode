/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, reset } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConversationSessionChatService } from '../common/conversationSessionChat.js';
import { appendConversationRefAnchor, conversationSessionPillHoverLines } from './conversationSessionPill.js';
import {
	acceptComposerAtMention,
	composerDraftText,
	findComposerAtQuery,
	IComposerAtCandidate,
	IComposerSurfaceHost,
	listComposerAtCandidates,
	peekConversationRefSessionKey,
} from './conversationComposerRefs.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationTimelineLinkHit, resolveConversationTimelineLink } from './resolveConversationTimelineLink.js';

const conversationComposerAtEmpty = localize('conversation.composerAtEmpty', "No matching sessions");
const conversationComposerRefRemove = localize('conversation.composerRefRemove', "Remove");

export interface IComposerAtHost extends IComposerSurfaceHost {
	composerRefRow: HTMLElement;
	composerAtSuggest: HTMLElement;
	composerRefResources: string[];
	composerPolicy: 'compose' | 'turnEdit' | 'queueEdit';
	dockTextarea: HTMLTextAreaElement;
	readonly stubService: IConversationRosterService;
	readonly instantiationService: IInstantiationService;
	getBoundSessionId(): string;
	register<T extends IDisposable>(disposable: T): T;
	writeComposerDraft(sessionId: string, text: string): void;
	updateSendEnabled(): void;
	activateConversationLink(hit: IConversationTimelineLinkHit): Promise<void>;
}

interface IComposerAtBinding {
	readonly hoverService: IHoverService;
	readonly sessionChatService: IConversationSessionChatService;
	readonly hovers: DisposableStore;
	activeIndex: number;
	query: string;
	candidates: IComposerAtCandidate[];
}

const bindings = new WeakMap<IComposerAtHost, IComposerAtBinding>();

export function wireComposerAt(host: IComposerAtHost): void {
	if (typeof host.instantiationService.invokeFunction !== 'function') {
		return;
	}
	const hoverService = host.instantiationService.invokeFunction(accessor => accessor.get(IHoverService));
	const sessionChatService = host.instantiationService.invokeFunction(accessor => accessor.get(IConversationSessionChatService));
	const binding: IComposerAtBinding = {
		hoverService,
		sessionChatService,
		hovers: new DisposableStore(),
		activeIndex: 0,
		query: '',
		candidates: [],
	};
	host.register(binding.hovers);
	bindings.set(host, binding);
	host.syncComposerRefs = () => {
		renderComposerRefChipRow(host, binding);
		refreshComposerAtSuggest(host, binding);
		host.updateSendEnabled();
	};
	host.register(host.stubService.onDidChangeSession(() => host.syncComposerRefs?.()));
	host.register(sessionChatService.onDidChangeCatalog(() => host.syncComposerRefs?.()));
	host.register(addDisposableListener(host.dockTextarea, 'keyup', () => refreshComposerAtSuggest(host, binding)));
	host.register(addDisposableListener(host.dockTextarea, 'click', () => refreshComposerAtSuggest(host, binding)));
	host.register(addDisposableListener(host.dockTextarea.ownerDocument, 'pointerdown', event => {
		if (host.composerAtSuggest.hidden) {
			return;
		}
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}
		if (host.composerAtSuggest.contains(target) || host.dockTextarea.contains(target) || host.composerRefRow.contains(target)) {
			return;
		}
		closeComposerAtSuggest(host, binding);
	}, true));
	renderComposerRefChipRow(host, binding);
}

export function noteComposerAtInput(host: IComposerAtHost): void {
	const binding = bindings.get(host);
	if (!binding) {
		return;
	}
	refreshComposerAtSuggest(host, binding);
}

export function onComposerAtKeyDown(host: IComposerAtHost, event: { keyCode: number; shiftKey?: boolean; preventDefault(): void }): boolean {
	const binding = bindings.get(host);
	if (!binding || host.composerAtSuggest.hidden) {
		return false;
	}
	if (event.keyCode === KeyCode.Escape) {
		event.preventDefault();
		closeComposerAtSuggest(host, binding);
		return true;
	}
	if (event.keyCode === KeyCode.DownArrow) {
		if (binding.candidates.length === 0) {
			return false;
		}
		event.preventDefault();
		binding.activeIndex = Math.min(binding.candidates.length - 1, binding.activeIndex + 1);
		refreshComposerAtSuggest(host, binding);
		return true;
	}
	if (event.keyCode === KeyCode.UpArrow) {
		if (binding.candidates.length === 0) {
			return false;
		}
		event.preventDefault();
		binding.activeIndex = Math.max(0, binding.activeIndex - 1);
		refreshComposerAtSuggest(host, binding);
		return true;
	}
	if (event.keyCode === KeyCode.Enter && !event.shiftKey) {
		event.preventDefault();
		const candidate = binding.candidates[binding.activeIndex];
		if (candidate) {
			selectComposerAtCandidate(host, binding, candidate);
		}
		return true;
	}
	return false;
}

export function renderComposerRefChipRow(host: IComposerAtHost, binding = bindings.get(host)): void {
	if (!binding) {
		host.composerRefRow.hidden = host.composerRefResources.length === 0;
		return;
	}
	binding.hovers.clear();
	reset(host.composerRefRow);
	const resources = host.composerRefResources;
	host.composerRefRow.hidden = resources.length === 0;
	if (resources.length === 0) {
		return;
	}
	const sessions = host.stubService.getSessions();
	for (const resource of [...resources]) {
		const chip = append(host.composerRefRow, $('span.conversation-composer-ref-chip'));
		const sessionKey = peekConversationRefSessionKey(resource);
		const resolved = resolveConversationTimelineLink(
			resource,
			sessions,
			sessionKey ? binding.sessionChatService.getCatalog(sessionKey) : [],
		);
		const { hover } = appendConversationRefAnchor(chip, resource, resolved, binding.hoverService, hit => {
			host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
			void host.activateConversationLink(hit).catch(onUnexpectedError).catch(onUnexpectedError);
		});
		if (hover) {
			binding.hovers.add(hover);
		}
		const remove = append(chip, $('button.conversation-composer-ref-remove')) as HTMLButtonElement;
		remove.type = 'button';
		remove.title = conversationComposerRefRemove;
		remove.setAttribute('aria-label', conversationComposerRefRemove);
		remove.classList.add(...ThemeIcon.asClassNameArray(Codicon.close));
		remove.addEventListener('click', event => {
			event.preventDefault();
			event.stopPropagation();
			const index = host.composerRefResources.indexOf(resource);
			if (index >= 0) {
				host.composerRefResources.splice(index, 1);
			}
			renderComposerRefChipRow(host, binding);
			if (host.composerPolicy === 'compose') {
				host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
			}
			host.updateSendEnabled();
		});
	}
}

function refreshComposerAtSuggest(host: IComposerAtHost, binding: IComposerAtBinding): void {
	const textarea = host.dockTextarea;
	const found = findComposerAtQuery(textarea.value, textarea.selectionStart ?? 0, textarea.selectionEnd ?? textarea.selectionStart ?? 0);
	if (!found) {
		closeComposerAtSuggest(host, binding);
		return;
	}
	const candidates = listComposerAtCandidates(
		host.stubService.getSessions(),
		sessionKey => binding.sessionChatService.getCatalog(sessionKey),
		found.query,
	);
	if (binding.query !== found.query) {
		binding.query = found.query;
		binding.activeIndex = 0;
	}
	if (binding.activeIndex >= candidates.length) {
		binding.activeIndex = 0;
	}
	binding.candidates = candidates;
	reset(host.composerAtSuggest);
	host.composerAtSuggest.hidden = false;
	if (candidates.length === 0) {
		const empty = append(host.composerAtSuggest, $('div.conversation-composer-at-suggest-empty'));
		empty.textContent = conversationComposerAtEmpty;
		return;
	}
	for (let index = 0; index < candidates.length; index++) {
		const candidate = candidates[index];
		const option = append(host.composerAtSuggest, $('button.conversation-composer-at-option')) as HTMLButtonElement;
		option.type = 'button';
		option.setAttribute('role', 'option');
		option.textContent = conversationSessionPillHoverLines(candidate.hit)[0] ?? candidate.sessionTitle;
		const active = index === binding.activeIndex;
		option.setAttribute('aria-selected', String(active));
		option.classList.toggle('is-active', active);
		option.addEventListener('mousedown', event => event.preventDefault());
		option.addEventListener('click', event => {
			event.preventDefault();
			event.stopPropagation();
			selectComposerAtCandidate(host, binding, candidate);
		});
	}
}

function selectComposerAtCandidate(host: IComposerAtHost, binding: IComposerAtBinding, candidate: IComposerAtCandidate): void {
	const textarea = host.dockTextarea;
	const next = acceptComposerAtMention(
		textarea.value,
		textarea.selectionStart ?? 0,
		candidate.resource,
		host.composerRefResources,
	);
	if (!next) {
		closeComposerAtSuggest(host, binding);
		return;
	}
	textarea.value = next.value;
	textarea.selectionStart = next.selection;
	textarea.selectionEnd = next.selection;
	host.composerRefResources.splice(0, host.composerRefResources.length, ...next.refs);
	closeComposerAtSuggest(host, binding);
	renderComposerRefChipRow(host, binding);
	if (host.composerPolicy === 'compose') {
		host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
	}
	host.updateSendEnabled();
	textarea.focus();
}

function closeComposerAtSuggest(host: IComposerAtHost, binding: IComposerAtBinding): void {
	binding.candidates = [];
	binding.query = '';
	binding.activeIndex = 0;
	host.composerAtSuggest.hidden = true;
	reset(host.composerAtSuggest);
}
