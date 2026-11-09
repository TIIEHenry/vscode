/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, reset } from '../../../../base/browser/dom.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { DisposableStore, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { getContextViewEventTarget, isContextViewClick, registerComposerPopupEscape } from './conversationContextViewEvent.js';
import { conversationLensDockAddEmpty, conversationLensDockAddTitle } from './conversationLensDockStrings.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConversationSessionChatService } from '../common/conversationSessionChat.js';
import { disambiguateSwitcherLabels, sessionSwitcherRows } from './conversationLensSessionBar.js';
import { appendConversationRefAnchor, conversationSessionPillHoverLines } from './conversationSessionPill.js';
import { handleConversationOverlayTab } from './conversationConfirmationSeat.js';
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
import type { ConversationComposerModel } from './conversationComposerModel.js';

const conversationComposerAtEmpty = localize('conversation.composerAtEmpty', "No matching sessions");
const conversationComposerAtList = localize('conversation.composerAtList', "Matching sessions");
const conversationComposerRefRemove = localize('conversation.composerRefRemove', "Remove");

/** Listbox ids must be unique: more than one composer can be mounted. */
let composerAtListSeq = 0;

export interface IComposerAtHost extends IComposerSurfaceHost {
	composerRefRow: HTMLElement;
	composerAtSuggest: HTMLElement;
	composerRefResources: string[];
	readonly composerModel: Pick<ConversationComposerModel, 'policy'>;
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
	readonly chipDisposables: DisposableStore;
	readonly suggestDisposables: DisposableStore;
	readonly hovers: DisposableStore;
	activeIndex: number;
	query: string;
	candidates: IComposerAtCandidate[];
	/** Escape / outside click dismissed this @ token; keyup must not reopen the list. */
	atMentionSuppressed?: { start: number; query: string };
}

const bindings = new WeakMap<IComposerAtHost, IComposerAtBinding>();

export interface IComposerAddHost extends IComposerAtHost {
	addContextView: IOpenContextView | undefined;
	readonly contextViewService: IContextViewService;
	addButton: { readonly element: HTMLElement };
	engineHistoryList?: { close(options?: { readonly restoreFocus?: boolean }): void };
	engineSnapshotsList?: { close(options?: { readonly restoreFocus?: boolean }): void };
}

/** Plus button. Adds a session the composer already sends as a context chip. Not a file upload. */
export function toggleComposerAddContext(host: IComposerAddHost, anchor?: HTMLElement): void {
	if (host.addContextView) {
		host.addContextView.close();
		return;
	}
	host.engineHistoryList?.close({ restoreFocus: false });
	host.engineSnapshotsList?.close({ restoreFocus: false });
	const binding = bindings.get(host);
	const owner = anchor ?? host.addButton.element;
	host.addContextView = host.contextViewService.showContextView({
		getAnchor: () => owner,
		anchorAlignment: anchor ? AnchorAlignment.RIGHT : AnchorAlignment.LEFT,
		anchorPosition: AnchorPosition.ABOVE,
		render: container => {
			const popup = append(container, $('.conversation-lens-dock-add-popup'));
			popup.setAttribute('role', 'menu');
			popup.setAttribute('aria-label', conversationLensDockAddTitle);
			const store = new DisposableStore();
			store.add(registerComposerPopupEscape(container, owner, host, () => host.addContextView?.close()));
			const sessions = host.stubService.getSessions();
			const catalogFor = (sessionKey: string) => binding ? binding.sessionChatService.getCatalog(sessionKey) : [];
			const candidates = listComposerAtCandidates(sessions, catalogFor, '');
			if (candidates.length === 0) {
				popup.textContent = conversationLensDockAddEmpty;
			} else {
				const list = append(popup, $('.conversation-lens-dock-add-list'));
				const empty = append(popup, $('.conversation-lens-dock-add-empty'));
				empty.hidden = true;
				const painted = new DisposableStore();
				store.add(painted);
				const items: HTMLButtonElement[] = [];
				const detailBySession = new Map(sessionSwitcherRows(sessions).map(row => [row.id, row.detail]));
				const optionRows = disambiguateSwitcherLabels(candidates.map(candidate => ({
					candidate,
					title: conversationSessionPillHoverLines(candidate.hit)[0] ?? candidate.sessionTitle,
					detail: detailBySession.get(candidate.sessionKey) ?? '',
				})));
				const paint = (query: string) => {
					painted.clear();
					items.length = 0;
					const needle = query.trim().toLowerCase();
					reset(list);
					const shown = needle
						? optionRows.filter(row => `${row.label} ${row.detail} ${row.candidate.sessionTitle} ${row.candidate.catalogTitle ?? ''}`.toLowerCase().includes(needle))
						: optionRows;
					empty.hidden = shown.length > 0;
					empty.textContent = shown.length === 0 ? conversationComposerAtEmpty : '';
					for (const row of shown) {
						const item = append(list, $('button.conversation-lens-dock-add-option')) as HTMLButtonElement;
						item.type = 'button';
						item.setAttribute('role', 'menuitem');
						const title = append(item, $('span.conversation-lens-dock-add-option-title'));
						title.textContent = row.label;
						if (row.detail) {
							const meta = append(item, $('span.conversation-lens-dock-add-option-meta'));
							meta.textContent = row.detail;
						}
						item.title = row.detail ? `${row.label} — ${row.detail}` : row.label;
						items.push(item);
						painted.add(addDisposableListener(item, 'click', event => {
							event.preventDefault();
							event.stopPropagation();
							host.addContextView?.close();
							addComposerContextRef(host, row.candidate.resource);
						}));
					}
				};
				let filter: HTMLInputElement | undefined;
				if (candidates.length > 8) {
					filter = append(popup, $('input.conversation-lens-dock-add-filter')) as HTMLInputElement;
					filter.type = 'text';
					filter.placeholder = localize('conversation.composerAddFilter', "Search sessions");
					filter.setAttribute('aria-label', filter.placeholder);
					popup.insertBefore(filter, list);
					store.add(addDisposableListener(filter, 'input', () => paint(filter!.value)));
					store.add(addDisposableListener(filter, 'keydown', event => {
						const isNav = event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End'
							|| event.keyCode === 40 || event.keyCode === 38 || event.keyCode === 36 || event.keyCode === 35
							|| event.keyCode === KeyCode.DownArrow || event.keyCode === KeyCode.UpArrow || event.keyCode === KeyCode.Home || event.keyCode === KeyCode.End;
						if (event.keyCode !== KeyCode.Escape && event.key !== 'Escape' && !isNav) {
							event.stopPropagation();
						}
					}));
				}
				store.add(addDisposableListener(popup, 'keydown', event => {
					if (handleConversationOverlayTab(popup, event)) {
						return;
					}
					const isDown = event.key === 'ArrowDown' || event.keyCode === 40 || event.keyCode === KeyCode.DownArrow;
					const isUp = event.key === 'ArrowUp' || event.keyCode === 38 || event.keyCode === KeyCode.UpArrow;
					const isHome = event.key === 'Home' || event.keyCode === 36 || event.keyCode === KeyCode.Home;
					const isEnd = event.key === 'End' || event.keyCode === 35 || event.keyCode === KeyCode.End;
					if (!isDown && !isUp && !isHome && !isEnd) {
						return;
					}
					if (items.length === 0) {
						return;
					}
					event.preventDefault();
					event.stopPropagation();
					const active = popup.ownerDocument.activeElement;
					const current = items.indexOf(active as HTMLButtonElement);
					if (isHome) {
						items[0]?.focus?.();
						return;
					}
					if (isEnd) {
						items[items.length - 1]?.focus?.();
						return;
					}
					const next = isDown
						? (current < 0 ? 0 : (current + 1) % items.length)
						: (current <= 0 ? items.length - 1 : current - 1);
					items[next]?.focus?.();
				}));
				paint('');
				if (filter && !filter.hidden) {
					filter.focus?.();
				} else {
					items[0]?.focus?.();
				}
			}
			return toDisposable(() => {
				popup.remove();
				store.dispose();
				host.addContextView = undefined;
			});
		},
		onDOMEvent: event => {
			if (!isContextViewClick(event)) {
				return;
			}
			const target = getContextViewEventTarget(event);
			if (target && !owner.contains(target) && !target.closest('.conversation-lens-dock-add-popup')) {
				host.addContextView?.close();
			}
		},
		onHide: () => {
			host.addContextView = undefined;
		},
	});
}

export function addComposerContextRef(host: IComposerAtHost, resource: string): void {
	if (!resource || host.composerRefResources.indexOf(resource) >= 0) {
		return;
	}
	host.composerRefResources.push(resource);
	renderComposerRefChipRow(host);
	if (host.composerModel.policy === 'compose') {
		host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
	}
	host.updateSendEnabled();
}

export function wireComposerAt(host: IComposerAtHost): void {
	if (typeof host.instantiationService.invokeFunction !== 'function') {
		return;
	}
	const hoverService = host.instantiationService.invokeFunction(accessor => accessor.get(IHoverService));
	const sessionChatService = host.instantiationService.invokeFunction(accessor => accessor.get(IConversationSessionChatService));
	const chipDisposables = new DisposableStore();
	const suggestDisposables = new DisposableStore();
	const binding: IComposerAtBinding = {
		hoverService,
		sessionChatService,
		chipDisposables,
		suggestDisposables,
		hovers: chipDisposables,
		activeIndex: 0,
		query: '',
		candidates: [],
	};
	host.register(chipDisposables);
	host.register(suggestDisposables);
	bindings.set(host, binding);
	host.syncComposerRefs = () => {
		renderComposerRefChipRow(host, binding);
		refreshComposerAtSuggest(host, binding);
		host.updateSendEnabled();
	};
	host.register(host.stubService.onDidChangeSession(() => host.syncComposerRefs?.()));
	host.register(sessionChatService.onDidChangeCatalog(() => host.syncComposerRefs?.()));
	host.register(addDisposableListener(host.dockTextarea, 'keyup', e => {
		if (e.keyCode === KeyCode.Tab) {
			return;
		}
		refreshComposerAtSuggest(host, binding);
	}));
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
		suppressComposerAtSuggest(host, binding);
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

export function onComposerAtKeyDown(host: IComposerAtHost, event: { keyCode: number; shiftKey?: boolean; preventDefault(): void; stopPropagation?(): void }): boolean {
	const binding = bindings.get(host);
	if (!binding || host.composerAtSuggest.hidden) {
		return false;
	}
	if (event.keyCode === KeyCode.Escape) {
		event.preventDefault();
		event.stopPropagation?.();
		suppressComposerAtSuggest(host, binding);
		return true;
	}
	if (event.keyCode === KeyCode.Tab) {
		closeComposerAtSuggest(host, binding);
		return false;
	}
	if (event.keyCode === KeyCode.DownArrow || event.keyCode === KeyCode.UpArrow) {
		// The popup is open, including the empty state. Vertical keys belong to it,
		// not to input-history browse.
		event.preventDefault();
		if (binding.candidates.length > 0) {
			binding.activeIndex = event.keyCode === KeyCode.DownArrow
				? Math.min(binding.candidates.length - 1, binding.activeIndex + 1)
				: Math.max(0, binding.activeIndex - 1);
			refreshComposerAtSuggest(host, binding);
		}
		return true;
	}
	if (event.keyCode === KeyCode.Enter && !event.shiftKey) {
		const candidate = binding.candidates[binding.activeIndex];
		// No highlighted session: Enter is send or newline, not a dead key.
		if (!candidate) {
			return false;
		}
		event.preventDefault();
		selectComposerAtCandidate(host, binding, candidate);
		return true;
	}
	return false;
}

export function renderComposerRefChipRow(host: IComposerAtHost, binding = bindings.get(host)): void {
	if (!binding) {
		host.composerRefRow.hidden = host.composerRefResources.length === 0;
		return;
	}
	binding.chipDisposables.clear();
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
		const { disposable } = appendConversationRefAnchor(chip, resource, resolved, binding.hoverService, hit => {
			host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
			void host.activateConversationLink(hit).catch(onUnexpectedError);
		});
		binding.chipDisposables.add(disposable);
		const remove = append(chip, $('button.conversation-composer-ref-remove')) as HTMLButtonElement;
		remove.type = 'button';
		remove.title = conversationComposerRefRemove;
		remove.setAttribute('aria-label', conversationComposerRefRemove);
		remove.classList.add(...ThemeIcon.asClassNameArray(Codicon.close));
		binding.chipDisposables.add(addDisposableListener(remove, 'click', event => {
			event.preventDefault();
			event.stopPropagation();
			const index = host.composerRefResources.indexOf(resource);
			if (index >= 0) {
				host.composerRefResources.splice(index, 1);
			}
			renderComposerRefChipRow(host, binding);
			if (host.composerModel.policy === 'compose') {
				host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
			}
			host.updateSendEnabled();
		}));
	}
}

function refreshComposerAtSuggest(host: IComposerAtHost, binding: IComposerAtBinding): void {
	const textarea = host.dockTextarea;
	const found = findComposerAtQuery(textarea.value, textarea.selectionStart ?? 0, textarea.selectionEnd ?? textarea.selectionStart ?? 0);
	if (!found) {
		binding.atMentionSuppressed = undefined;
		closeComposerAtSuggest(host, binding);
		return;
	}
	const suppressed = binding.atMentionSuppressed;
	if (suppressed && suppressed.start === found.start && suppressed.query === found.query) {
		keepComposerAtSuggestClosed(host);
		return;
	}
	binding.atMentionSuppressed = undefined;
	const previousActive = binding.candidates[binding.activeIndex];
	const candidates = listComposerAtCandidates(
		host.stubService.getSessions(),
		sessionKey => binding.sessionChatService.getCatalog(sessionKey),
		found.query,
	);
	if (binding.query !== found.query) {
		binding.query = found.query;
		binding.activeIndex = 0;
	} else if (previousActive) {
		const nextIndex = candidates.findIndex(
			candidate => candidate.sessionKey === previousActive.sessionKey && candidate.chatId === previousActive.chatId,
		);
		if (nextIndex >= 0) {
			binding.activeIndex = nextIndex;
		} else {
			binding.activeIndex = 0;
		}
	}
	if (binding.activeIndex >= candidates.length) {
		binding.activeIndex = 0;
	}
	binding.candidates = candidates;
	binding.suggestDisposables.clear();
	const list = host.composerAtSuggest;
	const listId = ensureComposerAtListId(list);
	reset(list);
	list.hidden = false;
	list.setAttribute('role', 'listbox');
	list.setAttribute('aria-label', conversationComposerAtList);
	if (candidates.length === 0) {
		const empty = append(list, $('div.conversation-composer-at-suggest-empty'));
		empty.id = `${listId}-empty`;
		empty.textContent = conversationComposerAtEmpty;
		syncComposerAtPopup(host, listId, undefined, empty.id);
		return;
	}
	let activeId: string | undefined;
	for (let index = 0; index < candidates.length; index++) {
		const candidate = candidates[index];
		const option = append(list, $('button.conversation-composer-at-option')) as HTMLButtonElement;
		option.type = 'button';
		option.id = `${listId}-option-${index}`;
		option.tabIndex = -1;
		option.setAttribute('role', 'option');
		option.textContent = conversationSessionPillHoverLines(candidate.hit)[0] ?? candidate.sessionTitle;
		option.title = option.textContent;
		const active = index === binding.activeIndex;
		option.setAttribute('aria-selected', String(active));
		option.classList.toggle('is-active', active);
		if (active) {
			activeId = option.id;
			option.scrollIntoView?.({ block: 'nearest' });
		}
		binding.suggestDisposables.add(addDisposableListener(option, 'mousedown', event => event.preventDefault()));
		binding.suggestDisposables.add(addDisposableListener(option, 'click', event => {
			event.preventDefault();
			event.stopPropagation();
			selectComposerAtCandidate(host, binding, candidate);
		}));
	}
	// Focus stays in the textarea. aria-activedescendant is only read there.
	syncComposerAtPopup(host, listId, activeId, undefined);
}

function ensureComposerAtListId(list: HTMLElement): string {
	if (!list.id) {
		composerAtListSeq += 1;
		list.id = `conversation-composer-at-${composerAtListSeq}`;
	}
	return list.id;
}

function syncComposerAtPopup(host: IComposerAtHost, listId: string, activeId: string | undefined, describedBy: string | undefined): void {
	const textarea = host.dockTextarea;
	const list = host.composerAtSuggest;
	textarea.setAttribute('role', 'combobox');
	textarea.setAttribute('aria-expanded', 'true');
	textarea.setAttribute('aria-controls', listId);
	textarea.setAttribute('aria-autocomplete', 'list');
	if (activeId) {
		textarea.setAttribute('aria-activedescendant', activeId);
		list.setAttribute('aria-activedescendant', activeId);
	} else {
		textarea.removeAttribute('aria-activedescendant');
		list.removeAttribute('aria-activedescendant');
	}
	if (describedBy) {
		textarea.setAttribute('aria-describedby', describedBy);
	} else {
		textarea.removeAttribute('aria-describedby');
	}
}

function clearComposerAtPopup(host: IComposerAtHost): void {
	const textarea = host.dockTextarea;
	host.composerAtSuggest.removeAttribute('aria-activedescendant');
	if (textarea.getAttribute('role') === 'combobox') {
		textarea.removeAttribute('role');
	}
	textarea.removeAttribute('aria-expanded');
	textarea.removeAttribute('aria-controls');
	textarea.removeAttribute('aria-autocomplete');
	textarea.removeAttribute('aria-activedescendant');
	textarea.removeAttribute('aria-describedby');
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
	if (host.composerModel.policy === 'compose') {
		host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
	}
	host.updateSendEnabled();
	textarea.focus();
}

function keepComposerAtSuggestClosed(host: IComposerAtHost, binding = bindings.get(host)): void {
	binding?.suggestDisposables.clear();
	host.composerAtSuggest.hidden = true;
	reset(host.composerAtSuggest);
	clearComposerAtPopup(host);
}

function suppressComposerAtSuggest(host: IComposerAtHost, binding: IComposerAtBinding): void {
	const textarea = host.dockTextarea;
	const found = findComposerAtQuery(textarea.value, textarea.selectionStart ?? 0, textarea.selectionEnd ?? textarea.selectionStart ?? 0);
	if (found) {
		binding.atMentionSuppressed = { start: found.start, query: found.query };
	}
	binding.candidates = [];
	binding.query = '';
	binding.activeIndex = 0;
	keepComposerAtSuggestClosed(host);
}

function closeComposerAtSuggest(host: IComposerAtHost, binding: IComposerAtBinding): void {
	binding.atMentionSuppressed = undefined;
	binding.candidates = [];
	binding.query = '';
	binding.activeIndex = 0;
	keepComposerAtSuggestClosed(host);
}
