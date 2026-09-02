/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const ISourcesReviewProgressService = createDecorator<ISourcesReviewProgressService>('sourcesReviewProgressService');

export interface ISourcesReviewProgressKey {
	readonly scopeKeyId: string;
	readonly path: string;
	readonly contentHash: string;
}

export function buildSourcesReviewProgressKey(key: ISourcesReviewProgressKey): string {
	return `${key.scopeKeyId}\0${key.path}\0${key.contentHash}`;
}

export interface ISourcesReviewProgressService {
	readonly _serviceBrand: undefined;

	readonly onDidChange: Event<void>;

	isReviewed(key: ISourcesReviewProgressKey): boolean;
	markReviewed(key: ISourcesReviewProgressKey): void;
	markUnreviewed(key: ISourcesReviewProgressKey): void;
	markAllReviewed(keys: readonly ISourcesReviewProgressKey[]): void;

	resolveKey(resource: URI): Promise<ISourcesReviewProgressKey>;
	pruneMissingKeys(activeKeys: ReadonlySet<string>): void;
}
