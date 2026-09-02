/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ISourcesPartService } from '../../../browser/parts/sources/sourcesPart.js';
import './conversationDiffReview.contribution.js';
import { SourcesTabsHost } from './sourcesTabsHost.js';

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
