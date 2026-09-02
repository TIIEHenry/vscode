/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { ISourcesReviewHostService } from '../common/sourcesReviewHostService.js';
import { markReviewedAfterSuccessfulOpen } from '../common/sourcesReviewListModel.js';
import { ISourcesReviewProgressService } from '../common/sourcesReviewProgress.js';
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
		const entry = accessor.get(ISourcesReviewHostService).getReviewListHost()?.getSelectedEntry();
		if (!entry) {
			return;
		}

		const reviewProgressService = accessor.get(ISourcesReviewProgressService);
		try {
			await markReviewedAfterSuccessfulOpen(
				() => openSourcesChangeEntry(entry, {
					editorService: accessor.get(IEditorService),
					quickDiffService: accessor.get(IQuickDiffService),
					configurationService: accessor.get(IConfigurationService),
					instantiationService: accessor.get(IInstantiationService),
					sourcesDiffPanelService: accessor.get(ISourcesDiffPanelService),
				}, {
					preserveFocus: false,
					pinned: false,
				}),
				resource => reviewProgressService.resolveKey(resource),
				key => reviewProgressService.markReviewed(key),
				entry.resource,
			);
		} catch {
			// open failed — do not mark reviewed
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
