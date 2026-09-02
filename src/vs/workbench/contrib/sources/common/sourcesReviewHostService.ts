/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const ISourcesReviewHostService = createDecorator<ISourcesReviewHostService>('sourcesReviewHostService');

export interface ISourcesReviewListHost {
	selectReviewTab(): void;
	setPathFilter(paths: URI[] | undefined): void;
}

export interface ISourcesReviewHostService {
	readonly _serviceBrand: undefined;

	registerReviewListHost(host: ISourcesReviewListHost | undefined): void;
	showForPaths(paths: URI[]): void;
}
