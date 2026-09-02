/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ISourcesReviewEntry } from './sourcesReviewModel.js';

export const ISourcesReviewHostService = createDecorator<ISourcesReviewHostService>('sourcesReviewHostService');

export interface ISourcesReviewListHost {
	selectReviewTab(): void;
	setPathFilter(paths: URI[] | undefined): void;
	getSelectedEntry(): ISourcesReviewEntry | undefined;
	toggleReviewedSelected(): void;
	markAllReviewed(): void;
}

export interface ISourcesReviewHostService {
	readonly _serviceBrand: undefined;

	registerReviewListHost(host: ISourcesReviewListHost | undefined): void;
	showForPaths(paths: URI[]): void;
	getReviewListHost(): ISourcesReviewListHost | undefined;
}
