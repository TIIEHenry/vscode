/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isHTMLElement } from '../../../../base/browser/dom.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { autorun, IObservable, observableSignalFromEvent } from '../../../../base/common/observable.js';
import { URI } from '../../../../base/common/uri.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { EditorContributionInstantiation, registerEditorContribution } from '../../../../editor/browser/editorExtensions.js';
import { Range } from '../../../../editor/common/core/range.js';
import { IEditorContribution, ScrollType } from '../../../../editor/common/editorCommon.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ISessionFileChange } from '../../../services/sessions/common/session.js';
import { ISessionsManagementService } from '../../../services/sessions/common/sessionsManagement.js';
import { ICodeReviewService, IPRReviewState, PRReviewStateKind } from '../../codeReview/browser/codeReviewService.js';
import { changeMatchesResourceByPath, sessionChangeCommentVisibleOnEditor, sessionChangeFeedbackKey } from './agentFeedbackEditorUtils.js';
import { AgentFeedbackEditorWidget, IComposerDraft, IComposerDraftState } from './agentFeedbackEditorWidget.js';
import { IAgentFeedbackService } from './agentFeedbackService.js';
import { getSessionEditorComments, groupNearbySessionEditorComments, ISessionEditorComment } from './sessionEditorComments.js';

/**
 * Editor contribution that manages agent feedback widgets.
 * Groups feedback items and creates combined widgets for nearby items.
 * Widgets start collapsed and expand when navigated to.
 */
export class AgentFeedbackEditorWidgetContribution extends Disposable implements IEditorContribution {

	static readonly ID = 'agentFeedback.editorWidgetContribution';

	private readonly _widgets: AgentFeedbackEditorWidget[] = [];
	private readonly _widgetListeners = this._register(new DisposableStore());
	private _sessionResource: URI | undefined;
	/**
	 * The session object's changes observable, kept so a later edit does not
	 * call `getSession` again. That lookup rebuilds every provider catalog.
	 */
	private _sessionChanges: IObservable<readonly ISessionFileChange[]> | undefined;
	/** Change currently matched to the open model. Line-stat republishes keep the same URIs. */
	private _matchingChange: ISessionFileChange | undefined;
	/** Skips tearing down widgets when an unrelated file's stats are republished. */
	private _renderKey: string | undefined;

	/**
	 * Composer state shared across widget rebuilds. Without this, any unrelated
	 * feedback / review state change would dispose the active widget and discard
	 * the textarea the user was typing in.
	 */
	private readonly _composerDraftState: IComposerDraftState = {
		drafts: new Map<string, IComposerDraft>(),
		focusedCommentId: undefined,
	};

	constructor(
		private readonly _editor: ICodeEditor,
		@IAgentFeedbackService private readonly _agentFeedbackService: IAgentFeedbackService,
		@ISessionsManagementService private readonly _sessionsManagementService: ISessionsManagementService,
		@ICodeReviewService private readonly _codeReviewService: ICodeReviewService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
	) {
		super();

		this._store.add(this._agentFeedbackService.onDidChangeNavigation(sessionResource => {
			if (this._sessionResource && sessionResource.toString() === this._sessionResource.toString()) {
				this._handleNavigation();
			}
		}));

		const rebuildSignal = observableSignalFromEvent(this, Event.any(
			this._agentFeedbackService.onDidChangeFeedback,
			this._agentFeedbackService.onDidChangeFeedbackVisibility,
			this._agentFeedbackService.onDidChangeFeedbackScope,
			this._editor.onDidChangeModel,
		));

		this._store.add(Event.any(this._editor.onDidScrollChange, this._editor.onDidLayoutChange)(() => {
			for (const widget of this._widgets) {
				widget.relayout();
			}
		}));

		this._store.add(autorun(reader => {
			rebuildSignal.read(reader);
			this._resolveSession();
			if (!this._sessionResource) {
				this._renderKey = undefined;
				this._matchingChange = undefined;
				this._clearWidgets();
				return;
			}

			// Read the changes observable, not a one-shot `.get()`, so a file that
			// becomes a deletion while this editor stays open moves its comments.
			const changes = this._sessionChanges?.read(reader);
			const prReviewState = this._codeReviewService.getPRReviewState(this._sessionResource).read(reader);
			const model = this._editor.getModel();
			if (!model) {
				this._renderKey = undefined;
				this._matchingChange = undefined;
				this._clearWidgets();
				return;
			}

			const change = changes?.find(candidate => changeMatchesResourceByPath(candidate, model.uri));
			this._matchingChange = change;
			const renderKey = this._widgetRenderKey(model.uri, change, prReviewState);
			if (renderKey === this._renderKey) {
				return;
			}
			this._renderKey = renderKey;

			this._rebuildWidgets(prReviewState);
			this._handleNavigation();
		}));
	}

	private _resolveSession(): void {
		const model = this._editor.getModel();
		const next = model ? this._agentFeedbackService.getFeedbackSessionResource(model.uri) : undefined;
		if (!next) {
			this._sessionResource = undefined;
			this._sessionChanges = undefined;
			return;
		}
		if (!this._sessionResource || this._sessionResource.toString() !== next.toString() || !this._sessionChanges) {
			this._sessionResource = next;
			this._sessionChanges = this._sessionsManagementService.getSession(next)?.changes;
			return;
		}
		this._sessionResource = next;
	}

	private _widgetRenderKey(modelUri: URI, change: ISessionFileChange | undefined, prReviewState: IPRReviewState): string {
		const feedback = this._agentFeedbackService.getFeedback(this._sessionResource!);
		const visibleResolved = this._agentFeedbackService.getVisibleResolvedFeedbackIds(this._sessionResource!);
		const feedbackKey = feedback.map(item => [
			item.id,
			item.state,
			item.kind,
			item.text,
			item.resourceUri.toString(),
			item.range.startLineNumber,
			item.range.startColumn,
			item.range.endLineNumber,
			item.range.endColumn,
			visibleResolved.has(item.id) ? '1' : '0',
			item.replies?.map(reply => `${reply.author}:${reply.text}`).join('\u0001') ?? '',
			item.suggestion?.edits.map(edit => `${edit.newText}\u0001${edit.oldText}`).join('\u0001') ?? '',
		].join('\u0002')).join('\u0003');

		let reviewKey: string = prReviewState.kind;
		if (prReviewState.kind === PRReviewStateKind.Loaded) {
			reviewKey += prReviewState.comments.map(comment => [
				comment.id,
				comment.uri.toString(),
				comment.body,
				comment.range.startLineNumber,
				comment.range.startColumn,
				comment.range.endLineNumber,
				comment.range.endColumn,
			].join('\u0002')).join('\u0003');
		}

		return `${this._sessionResource!.toString()}\0${modelUri.toString()}\0${sessionChangeFeedbackKey(change)}\0${feedbackKey}\0${reviewKey}`;
	}

	private _rebuildWidgets(
		prReviewState: IPRReviewState | undefined = this._sessionResource ? this._codeReviewService.getPRReviewState(this._sessionResource).get() : undefined,
	): void {
		this._clearWidgets();

		if (!this._sessionResource) {
			return;
		}

		const model = this._editor.getModel();
		if (!model) {
			return;
		}

		const comments = getSessionEditorComments(
			this._sessionResource,
			this._agentFeedbackService.getFeedback(this._sessionResource),
			prReviewState,
			this._agentFeedbackService.getVisibleResolvedFeedbackIds(this._sessionResource),
		);
		const fileComments = this._getCommentsForModel(model.uri, comments);
		if (fileComments.length === 0) {
			return;
		}

		const groups = groupNearbySessionEditorComments(fileComments, 5);

		// Create widgets in reverse file order so that widgets further up in the
		// file are added to the DOM last and therefore render on top of widgets
		// further down.
		for (let i = groups.length - 1; i >= 0; i--) {
			const group = groups[i];
			const widget = this._instantiationService.createInstance(AgentFeedbackEditorWidget, this._editor, group, this._sessionResource, this._composerDraftState);
			this._widgets.push(widget);

			// Ensure only one widget is expanded per file at a time: when a
			// widget expands, collapse all others.
			this._widgetListeners.add(widget.onDidExpand(() => {
				for (const other of this._widgets) {
					if (other !== widget && other.isExpanded) {
						other.collapse();
					}
				}
			}));

			widget.layout(group[0].range.startLineNumber);
			widget.restoreComposerFocus();
		}

		this._pruneOrphanedComposerDrafts();
	}

	/**
	 * Remove draft entries for comments that no longer exist in any widget.
	 * Without this, deleted comments would leave drafts in the map forever.
	 */
	private _pruneOrphanedComposerDrafts(): void {
		if (this._composerDraftState.drafts.size === 0 && this._composerDraftState.focusedCommentId === undefined) {
			return;
		}
		const knownCommentIds = new Set<string>();
		for (const widget of this._widgets) {
			for (const commentId of widget.getCommentIds()) {
				knownCommentIds.add(commentId);
			}
		}
		for (const commentId of [...this._composerDraftState.drafts.keys()]) {
			if (!knownCommentIds.has(commentId)) {
				this._composerDraftState.drafts.delete(commentId);
			}
		}
		if (this._composerDraftState.focusedCommentId !== undefined && !knownCommentIds.has(this._composerDraftState.focusedCommentId)) {
			this._composerDraftState.focusedCommentId = undefined;
		}
	}

	private _getCommentsForModel(resourceUri: URI, comments: readonly ISessionEditorComment[]): readonly ISessionEditorComment[] {
		return comments.filter(comment => sessionChangeCommentVisibleOnEditor(this._matchingChange, resourceUri, comment.resourceUri));
	}

	private _handleNavigation(): void {
		if (!this._sessionResource) {
			return;
		}

		const model = this._editor.getModel();
		if (!model) {
			return;
		}

		const comments = getSessionEditorComments(
			this._sessionResource,
			this._agentFeedbackService.getFeedback(this._sessionResource),
			this._codeReviewService.getPRReviewState(this._sessionResource).get(),
			this._agentFeedbackService.getVisibleResolvedFeedbackIds(this._sessionResource),
		);
		const bearing = this._agentFeedbackService.getNavigationBearing(this._sessionResource, comments);
		if (bearing.activeIdx < 0) {
			return;
		}

		const activeFeedback = comments[bearing.activeIdx];
		if (!activeFeedback) {
			return;
		}

		if (this._getCommentsForModel(model.uri, [activeFeedback]).length === 0) {
			for (const widget of this._widgets) {
				widget.collapse();
			}
			return;
		}

		// Expand the widget containing the active feedback, collapse all others
		for (const widget of this._widgets) {
			if (widget.containsFeedback(activeFeedback.id)) {
				widget.expand();
				widget.focusFeedback(activeFeedback.id);
			} else {
				widget.collapse();
			}
		}

		// Reveal the feedback range in the editor
		const range = new Range(
			activeFeedback.range.startLineNumber, 1,
			activeFeedback.range.endLineNumber, 1
		);
		this._editor.revealRangeInCenterIfOutsideViewport(range, ScrollType.Smooth);
	}

	private _clearWidgets(): void {
		// Capture focus before teardown: the textarea's blur would clear it.
		this._captureFocusedComposerCommentId();

		this._widgetListeners.clear();
		for (const widget of this._widgets) {
			widget.dispose();
		}
		this._widgets.length = 0;
	}

	private _captureFocusedComposerCommentId(): void {
		// Always recompute — the previous value may be stale (e.g. the user clicked elsewhere after typing).
		this._composerDraftState.focusedCommentId = undefined;
		if (this._widgets.length === 0) {
			return;
		}
		const activeElement = this._editor.getDomNode()?.ownerDocument.activeElement;
		if (!isHTMLElement(activeElement)) {
			return;
		}
		for (const widget of this._widgets) {
			const commentId = widget.findComposerCommentIdForElement(activeElement);
			if (commentId !== undefined) {
				this._composerDraftState.focusedCommentId = commentId;
				return;
			}
		}
	}

	override dispose(): void {
		this._clearWidgets();
		super.dispose();
	}
}

registerEditorContribution(AgentFeedbackEditorWidgetContribution.ID, AgentFeedbackEditorWidgetContribution, EditorContributionInstantiation.Eventually);
