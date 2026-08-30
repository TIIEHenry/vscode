/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ISourcesPartService } from '../../../browser/parts/sources/sourcesPart.js';
import { SourcesFilesList } from './sourcesFilesList.js';

class SourcesFilesContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.sourcesFiles';

	private mountedHost: HTMLElement | undefined;

	constructor(
		@ISourcesPartService private readonly sourcesPartService: ISourcesPartService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this._register(this.sourcesPartService.onDidRegisterContentHost(host => {
			this.mountList(host);
		}));

		if (this.sourcesPartService.contentHost) {
			this.mountList(this.sourcesPartService.contentHost);
		}
	}

	private mountList(host: HTMLElement): void {
		if (this.mountedHost === host) {
			return;
		}
		this.mountedHost = host;
		this._register(this.instantiationService.createInstance(SourcesFilesList, host));
	}
}

registerWorkbenchContribution2(SourcesFilesContribution.ID, SourcesFilesContribution, WorkbenchPhase.AfterRestored);
