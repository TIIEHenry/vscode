/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { autorun, IObservable, observableSignalFromEvent } from '../../../../base/common/observable.js';
import { ICodeEditor } from '../../../../editor/browser/editorBrowser.js';
import { IEditorContribution, IEditorDecorationsCollection } from '../../../../editor/common/editorCommon.js';
import { EditorContributionInstantiation, registerEditorContribution } from '../../../../editor/browser/editorExtensions.js';
import { overviewRulerInfo } from '../../../../editor/common/core/editorColorRegistry.js';
import { OverviewRulerLane } from '../../../../editor/common/model.js';
import { themeColorFromId } from '../../../../platform/theme/common/themeService.js';
import { registerColor } from '../../../../platform/theme/common/colorRegistry.js';
import { localize } from '../../../../nls.js';
import { URI } from '../../../../base/common/uri.js';
import { ISessionFileChange } from '../../../services/sessions/common/session.js';
import { ISessionsManagementService } from '../../../services/sessions/common/sessionsManagement.js';
import { changeMatchesResourceByPath, sessionChangeCommentVisibleOnEditor, sessionChangeFeedbackKey } from './agentFeedbackEditorUtils.js';
import { AgentFeedbackState, IAgentFeedbackService } from './agentFeedbackService.js';

const overviewRulerAgentFeedbackForeground = registerColor(
	'editorOverviewRuler.agentFeedbackForeground',
	overviewRulerInfo,
	localize('editorOverviewRuler.agentFeedbackForeground', 'Editor overview ruler decoration color for agent feedback. This color should be opaque.')
);

export class AgentFeedbackOverviewRulerContribution extends Disposable implements IEditorContribution {

	static readonly ID = 'agentFeedback.overviewRulerContribution';

	private readonly _decorations: IEditorDecorationsCollection;
	private _sessionResource: URI | undefined;
	/** See the widget contribution: reuse the session changes observable across edits. */
	private _sessionChanges: IObservable<readonly ISessionFileChange[]> | undefined;
	/** Avoids resetting ruler decorations when only another file's stats change. */
	private _decorationKey: string | undefined;

	constructor(
		private readonly _editor: ICodeEditor,
		@IAgentFeedbackService private readonly _agentFeedbackService: IAgentFeedbackService,
		@ISessionsManagementService private readonly _sessionsManagementService: ISessionsManagementService,
	) {
		super();

		this._decorations = this._editor.createDecorationsCollection();

		const refreshSignal = observableSignalFromEvent(this, Event.any(
			this._agentFeedbackService.onDidChangeFeedback,
			this._agentFeedbackService.onDidChangeFeedbackVisibility,
			this._agentFeedbackService.onDidChangeFeedbackScope,
			this._editor.onDidChangeModel,
		));

		this._store.add(autorun(reader => {
			refreshSignal.read(reader);
			this._resolveSession();
			const changes = this._sessionChanges?.read(reader);
			this._updateDecorations(changes);
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

	private _updateDecorations(changes: readonly ISessionFileChange[] | undefined): void {
		if (!this._sessionResource) {
			this._clearDecorations();
			return;
		}

		const model = this._editor.getModel();
		if (!model) {
			this._clearDecorations();
			return;
		}

		const feedbackItems = this._agentFeedbackService.getFeedback(this._sessionResource);
		const visibleResolvedFeedbackIds = this._agentFeedbackService.getVisibleResolvedFeedbackIds(this._sessionResource);
		const change = changes?.find(candidate => changeMatchesResourceByPath(candidate, model.uri));
		const visibleItems = feedbackItems.filter(item => sessionChangeCommentVisibleOnEditor(change, model.uri, item.resourceUri) && (item.state !== AgentFeedbackState.Resolved || visibleResolvedFeedbackIds.has(item.id)));
		const decorationKey = `${model.uri.toString()}\0${sessionChangeFeedbackKey(change)}\0${visibleItems.map(item => `${item.id}:${item.resourceUri.toString()}:${item.range.startLineNumber}:${item.range.endLineNumber}`).join('\0')}`;
		if (decorationKey === this._decorationKey) {
			return;
		}
		this._decorationKey = decorationKey;

		this._decorations.set(visibleItems.map(item => ({
			range: item.range,
			options: {
				description: 'agent-feedback-overview-ruler',
				overviewRuler: {
					color: themeColorFromId(overviewRulerAgentFeedbackForeground),
					position: OverviewRulerLane.Center,
				}
			}
		})));
	}

	private _clearDecorations(): void {
		if (this._decorationKey === undefined && this._decorations.length === 0) {
			return;
		}
		this._decorationKey = undefined;
		this._decorations.clear();
	}

	override dispose(): void {
		this._decorations.clear();
		super.dispose();
	}
}

registerEditorContribution(AgentFeedbackOverviewRulerContribution.ID, AgentFeedbackOverviewRulerContribution, EditorContributionInstantiation.Eventually);
