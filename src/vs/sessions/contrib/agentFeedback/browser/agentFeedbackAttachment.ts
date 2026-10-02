/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { isEqual } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { AgentFeedbackState, IAgentFeedbackService } from './agentFeedbackService.js';
import { ATTACHMENT_ID_PREFIX, createAgentFeedbackVariableEntry } from './agentFeedbackAttachmentEntry.js';
import { IChatWidget, IChatWidgetService } from '../../../../workbench/contrib/chat/browser/chat.js';
import { ISessionsManagementService } from '../../../services/sessions/common/sessionsManagement.js';
import { isAgentHostProviderId } from '../../../common/agentHostSessionsProvider.js';

/**
 * Keeps the "N feedback items" attachment in the chat input in sync with the
 * AgentFeedbackService. Each chat widget showing a session gets that session's
 * attachment. Clears feedback after that widget sends.
 */
export class AgentFeedbackAttachmentContribution extends Disposable {

	static readonly ID = 'workbench.contrib.agentFeedbackAttachment';

	/** View-model and submit listeners. Keyed by widget: a session can move between widgets. */
	private readonly _observedWidgets = this._store.add(new DisposableMap<IChatWidget, DisposableStore>());

	constructor(
		@IAgentFeedbackService private readonly _agentFeedbackService: IAgentFeedbackService,
		@IChatWidgetService private readonly _chatWidgetService: IChatWidgetService,
		@ISessionsManagementService private readonly _sessionsManagementService: ISessionsManagementService,
	) {
		super();

		this._store.add(this._agentFeedbackService.onDidChangeFeedback(e => {
			this._syncSession(e.sessionResource);
		}));

		// Comments can be added while the session chat has no model yet. The
		// reactive pill is what gets queued into the conversation; without a
		// later sync, Add and Submit waits forever for an attachment that never arrives.
		for (const widget of this._chatWidgetService.getAllWidgets()) {
			this._observeWidget(widget);
		}
		this._store.add(this._chatWidgetService.onDidAddWidget(widget => this._observeWidget(widget)));
		this._store.add(this._chatWidgetService.onDidRemoveWidget(widget => this._observedWidgets.deleteAndDispose(widget)));
	}

	private _syncSession(sessionResource: URI): void {
		if (this._isAgentHostSession(sessionResource)) {
			return;
		}
		for (const widget of this._chatWidgetService.getAllWidgets()) {
			if (isEqual(widget.viewModel?.sessionResource, sessionResource)) {
				this._syncAttachment(sessionResource, widget);
			}
		}
	}

	private _observeWidget(widget: IChatWidget): void {
		if (this._observedWidgets.has(widget)) {
			return;
		}
		const listeners = new DisposableStore();
		listeners.add(widget.onDidChangeViewModel(e => {
			const current = widget.viewModel?.sessionResource;
			if (e.previousSessionResource && !isEqual(e.previousSessionResource, current)) {
				// The next send on this widget belongs to the session it shows now.
				// Leave the previous comments on whichever widget still shows them.
				this._removeAttachment(widget, e.previousSessionResource);
			}
			if (current) {
				this._syncAttachment(current, widget);
			}
		}));
		listeners.add(widget.onDidSubmitAgent(() => this._onWidgetSubmitted(widget)));
		this._observedWidgets.set(widget, listeners);

		const sessionResource = widget.viewModel?.sessionResource;
		if (sessionResource) {
			this._syncAttachment(sessionResource, widget);
		}
	}

	private _onWidgetSubmitted(widget: IChatWidget): void {
		const sessionResource = widget.viewModel?.sessionResource;
		if (!sessionResource || this._isAgentHostSession(sessionResource)) {
			return;
		}
		const hasAccepted = this._agentFeedbackService.getFeedback(sessionResource).some(item => item.state === AgentFeedbackState.Accepted);
		if (!hasAccepted) {
			return;
		}
		this._agentFeedbackService.markFeedbackSubmitted(sessionResource);
	}

	private _isAgentHostSession(sessionResource: URI): boolean {
		const session = this._sessionsManagementService.getSession(sessionResource);
		return session ? isAgentHostProviderId(session.providerId) : false;
	}

	private _removeAttachment(widget: IChatWidget, sessionResource: URI): void {
		widget.attachmentModel.delete(ATTACHMENT_ID_PREFIX + sessionResource.toString());
	}

	private _syncAttachment(sessionResource: URI, widget: IChatWidget): void {
		if (!isEqual(widget.viewModel?.sessionResource, sessionResource) || this._isAgentHostSession(sessionResource)) {
			return;
		}

		const feedbackItems = this._agentFeedbackService.getFeedback(sessionResource).filter(item => item.state === AgentFeedbackState.Accepted);
		const attachmentId = ATTACHMENT_ID_PREFIX + sessionResource.toString();
		if (feedbackItems.length === 0) {
			widget.attachmentModel.delete(attachmentId);
			return;
		}

		const entry = createAgentFeedbackVariableEntry(sessionResource, feedbackItems);
		widget.attachmentModel.delete(attachmentId);
		widget.attachmentModel.addContext(entry);
	}
}
