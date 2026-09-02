/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ISourcesReviewHostService, ISourcesReviewListHost } from '../common/sourcesReviewHostService.js';

export class SourcesReviewHostService extends Disposable implements ISourcesReviewHostService {

	declare readonly _serviceBrand: undefined;

	private reviewListHost: ISourcesReviewListHost | undefined;

	registerReviewListHost(host: ISourcesReviewListHost | undefined): void {
		this.reviewListHost = host;
	}

	showForPaths(paths: URI[]): void {
		this.reviewListHost?.selectReviewTab();
		this.reviewListHost?.setPathFilter(paths.length > 0 ? paths : undefined);
	}

	getReviewListHost(): ISourcesReviewListHost | undefined {
		return this.reviewListHost;
	}
}

registerSingleton(ISourcesReviewHostService, SourcesReviewHostService, InstantiationType.Delayed);
