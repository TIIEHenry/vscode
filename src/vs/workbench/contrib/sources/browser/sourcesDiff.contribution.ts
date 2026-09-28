/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../base/common/lifecycle.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { registerSourcesDiffConfiguration } from '../common/sourcesDiffConfiguration.js';
import { provideSourcesGitDiffTextContent, SOURCES_GIT_DIFF_SCHEME } from './sourcesGitDiffContent.js';
import './sourcesDiffPanelService.js';
import './sourcesDiffPanel.contribution.js';
import './sourcesDiffActions.js';

registerSourcesDiffConfiguration();

class SourcesGitDiffContentContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.sources.gitDiffContent';

	private readonly registration: IDisposable;

	constructor(
		@ITextModelService textModelService: ITextModelService,
		@IModelService modelService: IModelService,
	) {
		this.registration = textModelService.registerTextModelContentProvider(SOURCES_GIT_DIFF_SCHEME, {
			provideTextContent: resource => Promise.resolve(provideSourcesGitDiffTextContent(resource, modelService)),
		});
	}

	dispose(): void {
		this.registration.dispose();
	}
}

registerWorkbenchContribution2(SourcesGitDiffContentContribution.ID, SourcesGitDiffContentContribution, WorkbenchPhase.BlockRestore);
