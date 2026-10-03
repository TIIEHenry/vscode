/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableMap, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { IWorkbenchContribution } from '../../../../workbench/common/contributions.js';
import { IBrowserViewWorkbenchService } from '../../../../workbench/contrib/browserView/common/browserView.js';
import { BrowserEditorInput } from '../../../../workbench/contrib/browserView/common/browserEditorInput.js';
import { IEditorService } from '../../../../workbench/services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../../workbench/services/editor/common/editorGroupsService.js';
import { ISessionsManagementService } from '../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { ISession } from '../../../services/sessions/common/session.js';
import { runOnChange } from '../../../../base/common/observable.js';

/**
 * Browser tracked against the session that was active when its editor opened.
 * That object may be the provider session or the visible wrapper that proxies
 * its id, resource, and archive flag.
 */
interface ITrackedBrowser {
	session: ISession;
	retarget(session: ISession): void;
	dispose(): void;
}

export class SessionBrowserViewController extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.sessionBrowserViewController';

	/**
	 * Tracks browser view inputs with their owning session. The
	 * DisposableMap cleans up lifecycle listeners on deletion/disposal.
	 */
	private readonly _trackedInputs = this._register(new DisposableMap<string, ITrackedBrowser>());

	/** Draft ids/resources from a graduation, so the follow-up removal does not destroy those browsers. */
	private readonly _replacedSessionKeys = new Set<string>();

	private readonly _onDidChangeSessionBinding = this._register(new Emitter<void>());

	constructor(
		@ISessionsManagementService private readonly _sessionManagementService: ISessionsManagementService,
		@ISessionsService private readonly _sessionsService: ISessionsService,
		@IBrowserViewWorkbenchService private readonly _browserViewService: IBrowserViewWorkbenchService,
		@IEditorService private readonly _editorService: IEditorService,
		@IEditorGroupsService private readonly _editorGroupsService: IEditorGroupsService,
	) {
		super();

		// Catch editors opened via normal user/tool actions.
		this._register(this._editorService.onWillOpenEditor(e => {
			if (e.editor instanceof BrowserEditorInput) {
				this._attachLifecycle(e.editor);
			}
		}));

		// Catch editors restored from a working set swap — onWillOpenEditor
		// does not fire for deserialized editors, but onDidAddGroup fires
		// after the group (with its editors) has been created.
		this._register(this._editorGroupsService.onDidAddGroup(group => {
			for (const editor of group.editors) {
				if (editor instanceof BrowserEditorInput) {
					this._attachLifecycle(editor);
				}
			}
		}));

		// Restrict the window's contextual browser views to those owned by the
		// active session (or those with no known owning session).
		this._register(runOnChange(this._sessionsService.activeSession, () => this._onDidChangeSessionBinding.fire()));
		this._register(this._browserViewService.registerContextualFilter({
			include: (input, context) => {
				const tracked = this._trackedInputs.get(input.id);
				const ownerId = input.model?.owner.type === 'agent' ? input.model.owner.sessionId : tracked?.session.resource.toString();
				if (!ownerId) {
					return true; // no owning session known
				}
				const owningSession = this._resolveOwningSession(ownerId) ?? tracked?.session;
				if (!owningSession) {
					return true; // owning chat/session no longer known; don't hide it
				}
				const activeSession = context.activeSessionId ? this._resolveOwningSession(context.activeSessionId) : this._sessionsService.activeSession.read(undefined);
				return activeSession?.sessionId === owningSession.sessionId;
			},
			onDidChange: this._onDidChangeSessionBinding.event,
		}));

		// Only open a browser tab automatically when its owning session is the active session.
		this._register(this._browserViewService.registerOpenHandler({
			shouldOpenEditor: (_input, owner) => {
				if (owner.type !== 'agent') {
					return true; // no owning session known; open in the active session
				}
				const owningSession = this._resolveOwningSession(owner.sessionId);
				if (!owningSession) {
					return true; // owning chat/session no longer known; open in the active session
				}
				const activeSession = this._sessionsService.activeSession.read(undefined);
				return owningSession.sessionId === activeSession?.sessionId;
			},
		}));

		// Draft graduation removes the draft after this event. Move browsers onto
		// the committed session first, or the removal below destroys them.
		this._register(this._sessionManagementService.onDidReplaceSession(({ from, to }) => {
			this._rebindBrowsers(from, to);
		}));

		// Force-destroy browser views when sessions are removed.
		this._register(this._sessionManagementService.onDidChangeSessions(e => {
			const replaced = this._replacedSessionKeys.size > 0;
			try {
				if (e.removed.length === 0 || this._trackedInputs.size === 0) {
					return;
				}

				const known = this._browserViewService.getKnownBrowserViews();
				for (const [id, tracked] of [...this._trackedInputs]) {
					const removed = e.removed.find(session => this._tracksSession(tracked, session));
					if (!removed || this._isReplacedRemoval(removed)) {
						continue;
					}
					const existingInput = known.get(id);
					if (existingInput instanceof BrowserEditorInput) {
						existingInput.dispose(true);
					}
				}
			} finally {
				if (replaced) {
					this._replacedSessionKeys.clear();
					this._onDidChangeSessionBinding.fire();
				}
			}
		}));
	}

	/**
	 * Point browsers opened for `from` at `to`. Graduation reports `from` as
	 * removed; the visible wrapper proxies `from`'s id and resource, so match
	 * either rather than object identity.
	 */
	private _rebindBrowsers(from: ISession, to: ISession): void {
		let rebound = false;
		for (const tracked of [...this._trackedInputs.values()]) {
			if (tracked.session.sessionId !== from.sessionId && !isEqual(tracked.session.resource, from.resource)) {
				continue;
			}
			tracked.retarget(to);
			rebound = true;
		}
		this._replacedSessionKeys.add(`id:${from.sessionId}`);
		this._replacedSessionKeys.add(`resource:${from.resource.toString()}`);
		if (rebound) {
			this._onDidChangeSessionBinding.fire();
		}
	}

	private _tracksSession(tracked: ITrackedBrowser, session: ISession): boolean {
		return tracked.session.sessionId === session.sessionId || isEqual(tracked.session.resource, session.resource);
	}

	private _isReplacedRemoval(session: ISession): boolean {
		return this._replacedSessionKeys.has(`id:${session.sessionId}`) || this._replacedSessionKeys.has(`resource:${session.resource.toString()}`);
	}

	/**
	 * Resolves a browser view owner id (the *chat* resource string the
	 * browser tools stamp onto `IBrowserViewOwner.sessionId`) to the
	 * `ISession` that owns it. A session's browsers can be opened from any
	 * of its chats (main, peer, or subagent), so this looks up the owning
	 * session across all chats rather than comparing against the session's
	 * own resource directly.
	 */
	private _resolveOwningSession(ownerId: string): ISession | undefined {
		let resource: URI;
		try {
			resource = URI.parse(ownerId);
		} catch {
			return undefined;
		}
		return this._sessionManagementService.getSessionForChatResource(resource)?.session ?? this._sessionManagementService.getSession(resource);
	}

	private _attachLifecycle(input: BrowserEditorInput): void {
		if (this._trackedInputs.has(input.id)) {
			return;
		}

		const session = this._sessionsService.activeSession.read(undefined);
		if (!session) {
			return; // no session, no lifecycle management needed
		}

		const store = new DisposableStore();
		const archiveListener = store.add(new MutableDisposable());
		const watchArchived = (owner: ISession, disposeIfAlreadyArchived: boolean) => {
			archiveListener.value = runOnChange(owner.isArchived, isArchived => {
				if (isArchived) {
					input.dispose(true);
				}
			});
			if (disposeIfAlreadyArchived && owner.isArchived.read(undefined)) {
				input.dispose(true);
			}
		};
		const tracked: ITrackedBrowser = {
			session,
			retarget: (next: ISession) => {
				tracked.session = next;
				watchArchived(next, true);
			},
			dispose: () => store.dispose(),
		};
		this._trackedInputs.set(input.id, tracked);
		watchArchived(session, false);

		store.add(input.onBeforeDispose(e => {
			const activeSession = this._sessionsService.activeSession.read(undefined);

			// If the input is being disposed, but we are not currently in the owning session,
			// assume a session swap is happening and do not actually dispose the browser yet.
			if (tracked.session.sessionId !== activeSession?.sessionId) {
				e.veto();
			}
		}));

		store.add(input.onWillDispose(() => {
			store.dispose();
			this._trackedInputs.deleteAndDispose(input.id);
		}));
	}
}
