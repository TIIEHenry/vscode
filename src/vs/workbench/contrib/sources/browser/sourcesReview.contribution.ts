/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { ISourcesReviewHostService } from '../common/sourcesReviewHostService.js';
import './sourcesReviewHostService.js';
import './sourcesReviewProgressService.js';

export const SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND = 'sources.review.showForPaths';

registerAction2(class SourcesReviewShowForPathsAction extends Action2 {
	constructor() {
		super({
			id: SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND,
			title: localize2('sourcesReviewShowForPaths', "Show Review for Paths"),
			f1: false,
		});
	}

	override async run(accessor: ServicesAccessor, paths: URI[] = []): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		if (!layoutService.isVisible(Parts.SOURCES_PART)) {
			layoutService.setPartHidden(false, Parts.SOURCES_PART);
		}

		accessor.get(ISourcesReviewHostService).showForPaths(paths);
	}
});
