/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, type IDisposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { ConversationSessionChatService, IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { conversationSubAgentOverlayClass } from './conversationSubAgentOverlay.js';

registerSingleton(IConversationSessionChatService, ConversationSessionChatService, InstantiationType.Eager);

function findTimelineHost(sessionWindow: HTMLElement): HTMLElement {
	const candidates = sessionWindow.querySelectorAll<HTMLElement>('.conversation-timeline');
	for (const candidate of candidates) {
		if (!candidate.closest(`.${conversationSubAgentOverlayClass}`)) {
			return candidate;
		}
	}
	return sessionWindow;
}

export class ConversationSessionChatContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionChat';

	private readonly mountedOverlays = new Set<string>();
	private readonly mountedOverlayHosts = new Map<string, HTMLElement>();
	private readonly partListenersBySessionKey = new Map<string, IDisposable>();
	private readonly partsBySessionKey = new Map<string, IConversationEditorPart>();
	private readonly windowObserversBySessionKey = new Map<string, { observer: MutationObserver; window: HTMLElement }>();

	constructor(
		@IConversationPartService conversationPartService: IConversationPartService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
		@IConversationSessionWindowService sessionWindowService: IConversationSessionWindowService,
	) {
		super();
		this.sessionChatService.seedStubTimelinePills();

		const mountAll = () => {
			const leafKeys = sessionWindowService.getAllLeafSessionKeys();
			const leafKeySet = new Set(leafKeys);

			for (const sessionKey of [...this.mountedOverlays]) {
				if (!leafKeySet.has(sessionKey)) {
					this.sessionChatService.unmountSubAgentOverlay(sessionKey);
					this.mountedOverlays.delete(sessionKey);
					this.mountedOverlayHosts.delete(sessionKey);
					const tracked = this.windowObserversBySessionKey.get(sessionKey);
					if (tracked) {
						tracked.observer.disconnect();
						this.windowObserversBySessionKey.delete(sessionKey);
					}
				}
			}

			for (const sessionKey of [...this.partListenersBySessionKey.keys()]) {
				if (!leafKeySet.has(sessionKey)) {
					this.partListenersBySessionKey.get(sessionKey)?.dispose();
					this.partListenersBySessionKey.delete(sessionKey);
					this.partsBySessionKey.delete(sessionKey);
				}
			}

			const syncOverlay = (sessionKey: string) => {
				const leaf = sessionWindowService.getLeafSlots(sessionKey);
				if (!leaf) {
					return;
				}

				const host = findTimelineHost(leaf.sessionWindow);
				const previousHost = this.mountedOverlayHosts.get(sessionKey);
				if (!this.mountedOverlays.has(sessionKey)) {
					this.sessionChatService.mountSubAgentOverlay(sessionKey, host);
					this.mountedOverlays.add(sessionKey);
					this.mountedOverlayHosts.set(sessionKey, host);
				} else if (previousHost !== host) {
					this.sessionChatService.reparentSubAgentOverlay(sessionKey, host);
					this.mountedOverlayHosts.set(sessionKey, host);
				}

				if (typeof MutationObserver !== 'undefined') {
					const existing = this.windowObserversBySessionKey.get(sessionKey);
					if (!existing || existing.window !== leaf.sessionWindow) {
						existing?.observer.disconnect();
						const observer = new MutationObserver(() => {
							syncOverlay(sessionKey);
						});
						observer.observe(leaf.sessionWindow, { childList: true, subtree: true });
						this.windowObserversBySessionKey.set(sessionKey, { observer, window: leaf.sessionWindow });
					}
				}
			};

			for (const sessionKey of leafKeys) {
				syncOverlay(sessionKey);

				const part = this.sessionChatService.getConversationPart(sessionKey);
				if (part && this.partsBySessionKey.get(sessionKey) !== part) {
					this.partListenersBySessionKey.get(sessionKey)?.dispose();
					this.partListenersBySessionKey.set(sessionKey, this.sessionChatService.registerPartListeners(part));
					this.partsBySessionKey.set(sessionKey, part);
				}
			}
		};

		const existing = conversationPartService.getSlots();
		if (existing) {
			mountAll();
		}
		this._register(conversationPartService.onDidCreateSlots(() => mountAll()));
		this._register(sessionWindowService.onDidChangeVisibleWindows(() => mountAll()));
	}

	override dispose(): void {
		for (const sessionKey of this.mountedOverlays) {
			this.sessionChatService.unmountSubAgentOverlay(sessionKey);
		}
		this.mountedOverlays.clear();
		this.mountedOverlayHosts.clear();
		for (const tracked of this.windowObserversBySessionKey.values()) {
			tracked.observer.disconnect();
		}
		this.windowObserversBySessionKey.clear();
		for (const disposable of this.partListenersBySessionKey.values()) {
			disposable.dispose();
		}
		this.partListenersBySessionKey.clear();
		this.partsBySessionKey.clear();
		super.dispose();
	}
}

registerWorkbenchContribution2(ConversationSessionChatContribution.ID, ConversationSessionChatContribution, WorkbenchPhase.AfterRestored);
