/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { IQuickDiffService, QuickDiff } from '../../scm/common/quickDiff.js';
import { ISCMResource, ISCMService } from '../../scm/common/scm.js';
import { ISourcesChangeEntry, SourcesChangesOrigin } from './sourcesChangesModel.js';

/** Identity copied off a Changes entry. The model URI stays separate (open-identity S3). */
export interface ISourcesChangeIdentity {
	readonly origin?: SourcesChangesOrigin;
	readonly sessionId?: string;
	readonly gitPath?: string;
	readonly indexState?: string;
	readonly kind?: string;
}

export interface ISourcesChangeRef extends ISourcesChangeIdentity {
	readonly modified: URI;
	readonly original: URI | undefined;
	readonly groupId: string;
	readonly scmResource?: ISCMResource;
}

export function sourcesChangeIdentity(source: ISourcesChangeIdentity): ISourcesChangeIdentity {
	return {
		origin: source.origin,
		sessionId: source.sessionId,
		gitPath: source.gitPath,
		indexState: source.indexState,
		kind: source.kind,
	};
}

export function sourcesChangeRefWithEntryIdentity(
	entry: ISourcesChangeIdentity,
	base: { readonly modified: URI; readonly original: URI | undefined; readonly groupId: string; readonly scmResource?: ISCMResource },
): ISourcesChangeRef {
	return {
		modified: base.modified,
		original: base.original,
		groupId: base.groupId,
		scmResource: base.scmResource,
		...sourcesChangeIdentity(entry),
	};
}

/**
 * Carried apply patches stay empty. Accept slices one hunk at click time from a fresh
 * ReadGitFileDiff and does not read this list.
 */
export function sourcesGitApplyHunksPatches(_source?: object): readonly string[] {
	return [];
}

export function pickQuickDiffOriginalResource(quickDiffs: readonly QuickDiff[]): URI | undefined {
	if (quickDiffs.length === 0) {
		return undefined;
	}

	const gitDiff = quickDiffs.find(diff => diff.id === 'git');
	return (gitDiff ?? quickDiffs[0]).originalResource;
}

export async function resolveSourcesChangeRef(
	entry: ISourcesChangeEntry,
	quickDiffService: IQuickDiffService,
): Promise<ISourcesChangeRef> {
	const quickDiffs = await quickDiffService.getQuickDiffs(entry.resource);
	const original = pickQuickDiffOriginalResource(quickDiffs);

	return sourcesChangeRefWithEntryIdentity(entry, {
		modified: entry.resource,
		original,
		groupId: entry.groupId,
		scmResource: entry.scmResource,
	});
}

/**
 * Engine rows write `gitPath`. Local SCM rows write `scmResource`.
 * A virtual `sources-git-diff:` URI never becomes an argv path.
 * `gitPath === ''` is not a path (`??` would keep the empty string).
 */
export function sourcesDiffLocalWritePath(ref: {
	modified: URI;
	scmResource?: ISCMResource;
	origin?: SourcesChangesOrigin;
	gitPath?: string;
}): string {
	if (ref.origin === 'engine') {
		return ref.gitPath ? ref.gitPath : '';
	}
	if (ref.scmResource) {
		return ref.scmResource.sourceUri.fsPath;
	}
	if (ref.modified.scheme === Schemas.file) {
		return ref.modified.fsPath;
	}
	return ref.gitPath ? ref.gitPath : '';
}

/**
 * SCM resource for `uri` inside `groupId` only.
 * Git registers index before workingTree. A URI hit in another group must not
 * replace the group the row was opened with.
 */
export function findScmResourceForUri(scmService: ISCMService, uri: URI, groupId: string): { resource: ISCMResource; groupId: string } | undefined {
	const key = uri.toString();
	for (const repo of scmService.repositories) {
		for (const group of repo.provider.groups) {
			if (group.id !== groupId) {
				continue;
			}
			for (const resource of group.resources) {
				if (resource.sourceUri.toString() === key) {
					return { resource, groupId: group.id };
				}
			}
		}
	}
	return undefined;
}

/**
 * Prefer the groupId and the scmResource / gitPath carried when the row was opened.
 * Conversation write chrome (`updateReviewActions` / `runGitAction`), Move from
 * `ConversationDiffReviewInput`, and Panel `getWriteContext` all use this.
 * An engine FileDiff row with no scmResource keeps that S3 identity and does not scan SCM by URI.
 */
export function resolveSourcesDiffWriteGate(
	scmService: ISCMService,
	opened: {
		readonly modified: URI;
		readonly groupId: string;
		readonly scmResource?: ISCMResource;
		readonly origin?: SourcesChangesOrigin;
		readonly gitPath?: string;
	},
): { readonly groupId: string; readonly scmResource: ISCMResource | undefined; readonly path: string } {
	const skipScmUriScan = opened.origin === 'engine' && !opened.scmResource;
	const live = skipScmUriScan ? undefined : findScmResourceForUri(scmService, opened.modified, opened.groupId);
	const scmResource = live?.resource ?? opened.scmResource;
	return {
		groupId: opened.groupId,
		scmResource,
		path: sourcesDiffLocalWritePath({
			modified: opened.modified,
			scmResource,
			origin: opened.origin,
			gitPath: opened.gitPath,
		}),
	};
}
