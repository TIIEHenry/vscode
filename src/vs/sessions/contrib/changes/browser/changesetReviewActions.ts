/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../workbench/services/editor/common/editorService.js';
import { IChangesViewService } from '../common/changesViewService.js';
import { ISessionsManagementService } from '../../../services/sessions/common/sessionsManagement.js';
import { findSessionFileChange, getSessionChangeReviewResource } from './changesEditorLabels.js';
import { SessionChangesFileResourceContext } from './changesMultiDiffSourceResolver.js';
import { ChangesetReviewedFilesContext, ChangesetReviewSupportContext } from './changesViewService.js';
import { CHANGESET_REVIEW_ACTION_ID, SessionChangesEditor } from './sessionChangesEditor.js';
import { ISessionChangesService } from './sessionChangesService.js';

export class ChangesetReviewAction extends Action2 {
	constructor() {
		super({
			id: CHANGESET_REVIEW_ACTION_ID,
			title: localize('changeset.viewed', "Viewed"),
			f1: false,
			toggled: {
				condition: ContextKeyExpr.in(
					SessionChangesFileResourceContext.key,
					ChangesetReviewedFilesContext.key)
			},
			menu: {
				id: MenuId.MultiDiffEditorFileToolbar,
				when: ContextKeyExpr.and(
					ChangesetReviewSupportContext.isEqualTo(true),
					ContextKeyExpr.equals('resourceScheme', 'changes-multi-diff-source')
				),
				group: 'navigation',
				order: 100
			}
		});
	}

	override run(accessor: ServicesAccessor, ...args: unknown[]): void {
		const resource = args[0];
		if (!(resource instanceof URI)) {
			return;
		}

		const changesViewService = accessor.get(IChangesViewService);
		const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
		const editorSession = activeEditorPane?.input
			? accessor.get(ISessionChangesService).getSessionResource(activeEditorPane.input.resource)
			: undefined;
		const editorChanges = editorSession
			? accessor.get(ISessionsManagementService).getSession(editorSession)?.changes.get()
			: changesViewService.activeSessionChangesObs.get();

		// The editor owns the session whose rows are on screen. When it is not
		// the globally active session, the active session's changeset is not a
		// valid write target even if both sessions share the same workspace file.
		const change = findSessionFileChange(resource, editorChanges ?? []);
		if (!change) {
			return;
		}

		const changeset = editorSession
			? accessor.get(ISessionsManagementService).getSession(editorSession)?.changesets.get()?.find(candidate => findSessionFileChange(resource, candidate.changes.get()) !== undefined)
			: changesViewService.activeSessionChangesetObs.get();
		if (changeset?.capabilities?.review !== true) {
			return;
		}

		const review = change.reviewed !== true;
		const reviewResource = getSessionChangeReviewResource(change) ?? resource;

		// Toggle multi-file diff editor item
		if (activeEditorPane instanceof SessionChangesEditor) {
			if (review) {
				activeEditorPane.collapse(reviewResource);
			} else {
				activeEditorPane.expand(reviewResource);
			}
		}

		// Set the review state
		if (editorSession) {
			changesViewService.setSessionChangesetFilesReviewState(editorSession, [reviewResource], review);
		} else {
			changesViewService.setChangesetFilesReviewState([reviewResource], review);
		}
	}
}

registerAction2(ChangesetReviewAction);
