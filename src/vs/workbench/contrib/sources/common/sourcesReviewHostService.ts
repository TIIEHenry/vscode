/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { UniverseAgentReadGitFileDiffResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ISourcesReviewEntry } from './sourcesReviewModel.js';

export const ISourcesReviewHostService = createDecorator<ISourcesReviewHostService>('sourcesReviewHostService');

export interface ISourcesReviewListHost {
	selectReviewTab(): void;
	setPathFilter(paths: URI[] | undefined): void;
	getSelectedEntry(): ISourcesReviewEntry | undefined;
	toggleReviewedSelected(): void;
	markAllReviewed(): void;
	setStatusMessage(message: string | undefined): void;
	/** Same FileDiff leftover / pairing-hold KEEP gate as Review list onDidOpen (D446). */
	isSourcesGitFileDiffOpenSkipped(): boolean;
	readGitFileDiff(entry: ISourcesReviewEntry): Promise<UniverseAgentReadGitFileDiffResult | undefined>;
}

export interface ISourcesReviewHostService {
	readonly _serviceBrand: undefined;

	registerReviewListHost(host: ISourcesReviewListHost | undefined): void;
	showForPaths(paths: URI[]): void;
	getReviewListHost(): ISourcesReviewListHost | undefined;
}
