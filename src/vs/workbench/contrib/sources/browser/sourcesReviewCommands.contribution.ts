/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IModelService } from '../../../../editor/common/services/model.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { sourcesGitDiffOpenFailureMessage, tryReadSourcesGitFileDiff } from '../common/sourcesChangesGitRead.js';
import { ISourcesChangesModel, isSourcesChangesReadFailed, sourcesChangesWriteSessionId } from '../common/sourcesChangesModel.js';
import { ISourcesReviewHostService } from '../common/sourcesReviewHostService.js';
import { markReviewedAfterSuccessfulOpen } from '../common/sourcesReviewListModel.js';
import { ISourcesReviewProgressService, sourcesReviewProgressTarget } from '../common/sourcesReviewProgress.js';
import { openSourcesChangeEntry } from './sourcesChangesList.js';

export const SOURCES_REVIEW_OPEN_SELECTED_COMMAND = 'sources.review.openSelected';
export const SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND = 'sources.review.toggleReviewedSelected';
export const SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND = 'sources.review.markAllReviewed';

registerAction2(class SourcesReviewOpenSelectedAction extends Action2 {
	constructor() {
		super({
			id: SOURCES_REVIEW_OPEN_SELECTED_COMMAND,
			title: localize2('sourcesReviewOpenSelected', "Open Selected Review Change"),
			category: localize2('sources', "Sources"),
			f1: true,
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		const host = accessor.get(ISourcesReviewHostService).getReviewListHost();
		const entry = host?.getSelectedEntry();
		if (!host || !entry) {
			return;
		}
		const changesModel = accessor.get(ISourcesChangesModel);
		// Same FileDiff leftover / pairing-hold KEEP gate as Review list onDidOpen (D446).
		if (changesModel.isFileDiffOpenSkipped()) {
			return;
		}

		const reviewProgressService = accessor.get(ISourcesReviewProgressService);
		const uaConnection = accessor.get(IUniverseAgentConnection);
		const session = accessor.get(IAgentSessionContext);
		const modelService = accessor.get(IModelService);
		const snapshot = changesModel.getSnapshot();
		try {
			await markReviewedAfterSuccessfulOpen(
				() => openSourcesChangeEntry(entry, {
					editorService: accessor.get(IEditorService),
					quickDiffService: accessor.get(IQuickDiffService),
					configurationService: accessor.get(IConfigurationService),
					instantiationService: accessor.get(IInstantiationService),
					sourcesDiffPanelService: accessor.get(ISourcesDiffPanelService),
					modelService,
					readGitFileDiff: gitEntry => {
						const hook = uaConnection.readGitFileDiff;
						return tryReadSourcesGitFileDiff(
							uaConnection.isEngineConnected(),
							hook ? request => hook.call(uaConnection, request) : undefined,
							sourcesChangesWriteSessionId(snapshot, [gitEntry], session.getActiveSessionId()),
							gitEntry.gitPath ?? '',
							gitEntry.indexState ?? '',
							session.isPairingHold(),
							isSourcesChangesReadFailed(snapshot.state),
						);
					},
				}, {
					preserveFocus: false,
					pinned: false,
				}),
				async () => reviewProgressService.resolveKey(sourcesReviewProgressTarget(entry)),
				key => {
					// KEEP leftover list-fail is not a live Mark surface (D459).
					// FileDiff open stays read-failed / pairing-hold only (D444 / D446).
					if (changesModel.isWriteClosed()) {
						return;
					}
					reviewProgressService.markReviewed(key);
				},
				entry.resource,
			);
		} catch (error) {
			host?.setStatusMessage(sourcesGitDiffOpenFailureMessage(error), true);
		}
	}
});

registerAction2(class SourcesReviewToggleReviewedSelectedAction extends Action2 {
	constructor() {
		super({
			id: SOURCES_REVIEW_TOGGLE_REVIEWED_SELECTED_COMMAND,
			title: localize2('sourcesReviewToggleReviewedSelected', "Toggle Reviewed for Selected"),
			category: localize2('sources', "Sources"),
			f1: true,
		});
	}

	override run(accessor: ServicesAccessor): void {
		accessor.get(ISourcesReviewHostService).getReviewListHost()?.toggleReviewedSelected();
	}
});

registerAction2(class SourcesReviewMarkAllReviewedAction extends Action2 {
	constructor() {
		super({
			id: SOURCES_REVIEW_MARK_ALL_REVIEWED_COMMAND,
			title: localize2('sourcesReviewMarkAllReviewed', "Mark All as Reviewed"),
			category: localize2('sources', "Sources"),
			f1: true,
		});
	}

	override run(accessor: ServicesAccessor): void {
		accessor.get(ISourcesReviewHostService).getReviewListHost()?.markAllReviewed();
	}
});
