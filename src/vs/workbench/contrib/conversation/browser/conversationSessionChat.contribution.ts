/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isHTMLElement } from '../../../../base/browser/dom.js';
import { Disposable, type IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { ConversationSessionChatService, IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { conversationSubAgentOverlayClass } from './conversationSubAgentOverlay.js';

registerSingleton(IConversationSessionChatService, ConversationSessionChatService, InstantiationType.Eager);

export class ConversationSessionChatContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionChat';

	private readonly mountedOverlays = new Set<string>();
	private readonly mountedOverlayHosts = new Map<string, HTMLElement>();
	private readonly partListenersBySessionKey = new Map<string, IDisposable>();
	private readonly partsBySessionKey = new Map<string, IConversationEditorPart>();
	private readonly overlayHostWatchers = new Map<string, { readonly sessionWindow: HTMLElement; readonly disposable: IDisposable }>();

	constructor(
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
		@IConversationSessionWindowService private readonly sessionWindowService: IConversationSessionWindowService,
	) {
		super();
		this.sessionChatService.seedStubTimelinePills();

		const existing = this.conversationPartService.getSlots();
		if (existing) {
			this.mountAll();
		}
		this._register(this.conversationPartService.onDidCreateSlots(() => this.mountAll()));
		this._register(this.sessionWindowService.onDidChangeVisibleWindows(() => this.mountAll()));
	}

	private mountAll(): void {
		if (this._store.isDisposed) {
			return;
		}
		const leafKeys = this.sessionWindowService.getAllLeafSessionKeys();
		const leafKeySet = new Set(leafKeys);

		for (const sessionKey of [...this.mountedOverlays]) {
			if (!leafKeySet.has(sessionKey)) {
				// Disconnect before unmount so removing the overlay does not schedule another mount.
				this.stopOverlayHostWatcher(sessionKey);
				this.sessionChatService.unmountSubAgentOverlay(sessionKey);
				this.mountedOverlays.delete(sessionKey);
				this.mountedOverlayHosts.delete(sessionKey);
			}
		}

		for (const sessionKey of [...this.partListenersBySessionKey.keys()]) {
			if (!leafKeySet.has(sessionKey)) {
				this.partListenersBySessionKey.get(sessionKey)?.dispose();
				this.partListenersBySessionKey.delete(sessionKey);
				this.partsBySessionKey.delete(sessionKey);
			}
		}

		for (const sessionKey of leafKeys) {
			const leaf = this.sessionWindowService.getLeafSlots(sessionKey);
			if (!leaf) {
				continue;
			}

			const host = selectSubAgentOverlayHost(leaf.sessionWindow);
			const previousHost = this.mountedOverlayHosts.get(sessionKey);
			if (!this.mountedOverlays.has(sessionKey)) {
				this.sessionChatService.mountSubAgentOverlay(sessionKey, host);
				this.mountedOverlays.add(sessionKey);
				this.mountedOverlayHosts.set(sessionKey, host);
			} else if (previousHost !== host) {
				// Same instance. Reparent moves the element; unmount would drop isOpen, state, and the lens.
				this.sessionChatService.reparentSubAgentOverlay(sessionKey, host);
				this.mountedOverlayHosts.set(sessionKey, host);
			}

			this.watchOverlayHost(sessionKey, leaf.sessionWindow);

			const part = this.sessionChatService.getConversationPart(sessionKey);
			if (part && this.partsBySessionKey.get(sessionKey) !== part) {
				this.partListenersBySessionKey.get(sessionKey)?.dispose();
				this.partListenersBySessionKey.set(sessionKey, this.sessionChatService.registerPartListeners(part));
				this.partsBySessionKey.set(sessionKey, part);
			}
		}
	}

	private watchOverlayHost(sessionKey: string, sessionWindow: HTMLElement): void {
		const existing = this.overlayHostWatchers.get(sessionKey);
		if (existing?.sessionWindow === sessionWindow) {
			return;
		}
		existing?.disposable.dispose();
		const observer = new MutationObserver(records => {
			if (this._store.isDisposed || !subAgentOverlayHostMutationMatters(records)) {
				return;
			}
			this.mountAll();
		});
		observer.observe(sessionWindow, { childList: true, subtree: true });
		const disposable = this._register(toDisposable(() => observer.disconnect()));
		this.overlayHostWatchers.set(sessionKey, { sessionWindow, disposable });
	}

	private stopOverlayHostWatcher(sessionKey: string): void {
		const watcher = this.overlayHostWatchers.get(sessionKey);
		if (!watcher) {
			return;
		}
		this.overlayHostWatchers.delete(sessionKey);
		watcher.disposable.dispose();
	}

	override dispose(): void {
		for (const watcher of this.overlayHostWatchers.values()) {
			watcher.disposable.dispose();
		}
		this.overlayHostWatchers.clear();
		for (const sessionKey of this.mountedOverlays) {
			this.sessionChatService.unmountSubAgentOverlay(sessionKey);
		}
		this.mountedOverlays.clear();
		this.mountedOverlayHosts.clear();
		for (const disposable of this.partListenersBySessionKey.values()) {
			disposable.dispose();
		}
		this.partListenersBySessionKey.clear();
		this.partsBySessionKey.clear();
		super.dispose();
	}
}

/** Editor timeline only. The overlay's own open() timeline is not a host. */
function selectSubAgentOverlayHost(sessionWindow: HTMLElement): HTMLElement {
	// eslint-disable-next-line no-restricted-syntax -- the editor timeline is created outside this contribution
	const probed = sessionWindow.querySelector('.conversation-timeline');
	if (isHTMLElement(probed) && !probed.closest(`.${conversationSubAgentOverlayClass}`)) {
		return probed;
	}
	return findEditorTimeline(sessionWindow) ?? sessionWindow;
}

function findEditorTimeline(root: HTMLElement): HTMLElement | undefined {
	for (let i = 0; i < root.children.length; i++) {
		const child = root.children[i];
		if (!isHTMLElement(child) || child.classList.contains(conversationSubAgentOverlayClass)) {
			continue;
		}
		if (child.classList.contains('conversation-timeline')) {
			return child;
		}
		const nested = findEditorTimeline(child);
		if (nested) {
			return nested;
		}
	}
	return undefined;
}

function subAgentOverlayHostMutationMatters(records: MutationRecord[]): boolean {
	for (const record of records) {
		const target = record.target;
		if (isHTMLElement(target) && target.closest(`.${conversationSubAgentOverlayClass}`)) {
			continue;
		}
		if (overlayHostNodesMatter(record.addedNodes) || overlayHostNodesMatter(record.removedNodes)) {
			return true;
		}
	}
	return false;
}

function overlayHostNodesMatter(nodes: NodeList): boolean {
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (!isHTMLElement(node) || node.classList.contains(conversationSubAgentOverlayClass)) {
			continue;
		}
		if (node.closest(`.${conversationSubAgentOverlayClass}`)) {
			continue;
		}
		if (node.classList.contains('conversation-timeline') || findEditorTimeline(node)) {
			return true;
		}
	}
	return false;
}

registerWorkbenchContribution2(ConversationSessionChatContribution.ID, ConversationSessionChatContribution, WorkbenchPhase.AfterRestored);
