/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ILocalizedString, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ISourcesPartService } from '../../../browser/parts/sources/sourcesPart.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import '../common/sourcesChangesReadModel.js';
import { ISourcesReviewHostService } from '../common/sourcesReviewHostService.js';
import { SourcesTabId } from '../common/sourcesTabs.js';
import './conversationDiffReview.contribution.js';
import './sourcesDiff.contribution.js';
import './sourcesReviewCommands.contribution.js';
import { SourcesTabsHost } from './sourcesTabsHost.js';

export const SOURCES_SHOW_FILES_COMMAND = 'sources.showFiles';
export const SOURCES_SHOW_CHANGES_COMMAND = 'sources.showChanges';
export const SOURCES_SHOW_REVIEW_COMMAND = 'sources.showReview';

class SourcesTabsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.sourcesTabs';

	private mounted = false;

	constructor(
		@ISourcesPartService private readonly sourcesPartService: ISourcesPartService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		const tryMount = () => this.tryMountTabsHost();
		this._register(this.sourcesPartService.onDidRegisterTabHost(() => tryMount()));
		this._register(this.sourcesPartService.onDidRegisterContentHost(() => tryMount()));
		tryMount();
	}

	private tryMountTabsHost(): void {
		if (this.mounted) {
			return;
		}

		const tabHost = this.sourcesPartService.tabHost;
		const contentHost = this.sourcesPartService.contentHost;
		if (!tabHost || !contentHost) {
			return;
		}

		this.mounted = true;
		this._register(this.instantiationService.createInstance(SourcesTabsHost, tabHost, contentHost));
	}
}

registerWorkbenchContribution2(SourcesTabsContribution.ID, SourcesTabsContribution, WorkbenchPhase.AfterRestored);

const SOURCES_TAB_COMMANDS: readonly { readonly id: string; readonly tab: SourcesTabId; readonly title: ILocalizedString }[] = [
	{ id: SOURCES_SHOW_FILES_COMMAND, tab: SourcesTabId.Files, title: localize2('sourcesShowFiles', "Show Files") },
	{ id: SOURCES_SHOW_CHANGES_COMMAND, tab: SourcesTabId.Changes, title: localize2('sourcesShowChanges', "Show Changes") },
	{ id: SOURCES_SHOW_REVIEW_COMMAND, tab: SourcesTabId.Review, title: localize2('sourcesShowReview', "Show Review") },
];

for (const { id, tab, title } of SOURCES_TAB_COMMANDS) {
	registerAction2(class extends Action2 {
		constructor() {
			super({
				id,
				title,
				category: localize2('sources', "Sources"),
				f1: true,
			});
		}

		override run(accessor: ServicesAccessor): void {
			const layoutService = accessor.get(IWorkbenchLayoutService);
			if (!layoutService.isVisible(Parts.SOURCES_PART)) {
				layoutService.setPartHidden(false, Parts.SOURCES_PART);
			}
			const host = accessor.get(ISourcesReviewHostService).getReviewListHost();
			if (host instanceof SourcesTabsHost) {
				host.selectTab(tab, true);
			}
		}
	});
}
