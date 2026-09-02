/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ReviewListEmptyReason } from '../common/sourcesReviewListModel.js';

/** Compact Review tab chrome — read-only SCM list; window-local review progress. */
export const sourcesReviewListHeaderHint = localize(
	'sourcesReviewList.headerHint',
	"Read-only. Review progress is kept for this window only.",
);

export const sourcesReviewRevealMissHint = localize(
	'sourcesReviewList.revealMiss',
	"对话里找不到这一步",
);

export function sourcesReviewListEmptyMessage(reason: ReviewListEmptyReason): string {
	switch (reason) {
		case 'noRepository':
			return localize('sourcesReviewList.noRepository', "No source control repository.");
		case 'noChanges':
			return localize('sourcesReviewList.noChanges', "No changes to review.");
		case 'unreviewedDone':
			return localize('sourcesReviewList.unreviewedDone', "All matching changes have been reviewed.");
		case 'pathNoIntersection':
			return localize('sourcesReviewList.pathNoIntersection', "No current changes overlap the selected paths.");
		case 'textFilterEmpty':
			return localize('sourcesReviewList.textFilterEmpty', "No changes match the filter.");
	}
}
