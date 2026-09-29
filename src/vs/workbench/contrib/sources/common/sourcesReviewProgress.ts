/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const ISourcesReviewProgressService = createDecorator<ISourcesReviewProgressService>('sourcesReviewProgressService');

export type SourcesReviewProgressOrigin = 'engine' | 'scm';

export interface ISourcesReviewProgressKey {
	readonly origin: SourcesReviewProgressOrigin;
	readonly sessionId: string;
	readonly scopeKeyId: string;
	readonly path: string;
	readonly contentHash: string;
	/** Engine git path. Not part of {@link buildSourcesReviewProgressKey}. */
	readonly gitPath?: string;
}

export interface ISourcesReviewProgressTarget {
	readonly resource: URI;
	readonly origin?: SourcesReviewProgressOrigin;
	readonly sessionId?: string;
	readonly gitPath?: string;
}

/** One successful-read bucket: entry origin plus that entry's session. SCM uses `''`. */
export interface ISourcesReviewProgressBucket {
	readonly origin: SourcesReviewProgressOrigin;
	readonly sessionId: string;
}

export function sourcesReviewProgressTarget(entry: {
	readonly resource: URI;
	readonly origin?: SourcesReviewProgressOrigin;
	readonly sessionId?: string;
	readonly gitPath?: string;
}): ISourcesReviewProgressTarget {
	const origin: SourcesReviewProgressOrigin = entry.origin === 'engine' ? 'engine' : 'scm';
	return {
		resource: entry.resource,
		origin,
		sessionId: origin === 'engine' ? (entry.sessionId ?? '') : '',
		gitPath: entry.gitPath,
	};
}

/**
 * Prune only a settled snapshot with no failure message.
 * `engine-live` prunes that session. `scm` prunes the local bucket. Leftover does not.
 */
export function sourcesReviewProgressBucket(snapshot: {
	readonly settled: boolean;
	readonly failureMessage?: string;
	readonly state:
	| { readonly kind: 'scm' }
	| { readonly kind: 'engine-live'; readonly sessionId: string }
	| { readonly kind: 'engine-leftover' };
}): ISourcesReviewProgressBucket | undefined {
	if (!snapshot.settled || snapshot.failureMessage) {
		return undefined;
	}
	if (snapshot.state.kind === 'engine-live') {
		return { origin: 'engine', sessionId: snapshot.state.sessionId };
	}
	if (snapshot.state.kind === 'scm') {
		return { origin: 'scm', sessionId: '' };
	}
	return undefined;
}

export function buildSourcesReviewProgressKey(key: ISourcesReviewProgressKey): string {
	return `${key.origin}\0${key.sessionId}\0${key.scopeKeyId}\0${key.path}\0${key.contentHash}`;
}

export interface ISourcesReviewProgressService {
	readonly _serviceBrand: undefined;

	readonly onDidChange: Event<void>;

	hasReviewed(): boolean;
	isReviewed(key: ISourcesReviewProgressKey): boolean;
	/** Identity match, ignoring content hash. */
	isEntryReviewed(target: ISourcesReviewProgressTarget): boolean;
	getReviewedKey(target: ISourcesReviewProgressTarget): ISourcesReviewProgressKey | undefined;
	markReviewed(key: ISourcesReviewProgressKey): void;
	markUnreviewed(key: ISourcesReviewProgressKey): void;
	markAllReviewed(keys: readonly ISourcesReviewProgressKey[]): void;
	/**
	 * After a refresh recomputes `key`, drop other hashes for that identity.
	 * If `key` itself is not reviewed, drop the identity.
	 */
	noteRefreshedKey(key: ISourcesReviewProgressKey): void;

	resolveKey(target: ISourcesReviewProgressTarget): Promise<ISourcesReviewProgressKey>;
	pruneMissingKeys(bucket: ISourcesReviewProgressBucket, activeKeys: ReadonlySet<string>): void;
}
