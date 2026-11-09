/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ReviewListEmptyReason } from '../common/sourcesReviewListModel.js';

/** Compact Review tab chrome — shown only when there are changes to review. */
export const sourcesReviewListHeaderHint = localize(
	'sourcesReviewList.headerHint',
	"Review doesn't change files. Progress stays in this window.",
);

export const sourcesReviewRevealMissHint = localize(
	'sourcesReviewList.revealMiss',
	"Couldn't find this step in the conversation.",
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
