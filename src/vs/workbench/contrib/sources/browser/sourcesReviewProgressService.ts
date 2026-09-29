/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Schemas } from '../../../../base/common/network.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IFileMutationRecord } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ISCMService } from '../../scm/common/scm.js';
import { normalizeReviewPath, resolveMutationAbsolutePath } from '../common/sourcesReviewAttribution.js';
import {
	buildSourcesReviewProgressKey,
	ISourcesReviewProgressBucket,
	ISourcesReviewProgressKey,
	ISourcesReviewProgressService,
	ISourcesReviewProgressTarget,
	SourcesReviewProgressOrigin,
} from '../common/sourcesReviewProgress.js';

interface IStoredReview {
	readonly reviewedAt: number;
	readonly origin: SourcesReviewProgressOrigin;
	readonly sessionId: string;
	readonly scopeKeyId: string;
	readonly path: string;
	readonly gitPath?: string;
	readonly contentHash: string;
}

interface ILatestMutation {
	readonly record: IFileMutationRecord;
	readonly seen: number;
}

function isProgressAbsolute(path: string): boolean {
	return path.startsWith('/') || /^[a-zA-Z]:\//.test(path);
}

function addProgressForms(forms: Set<string>, value: string | undefined, workDir: string | undefined): void {
	if (!value) {
		return;
	}
	const normalized = normalizeReviewPath(value);
	if (!normalized) {
		return;
	}
	forms.add(normalized);
	if (workDir && !isProgressAbsolute(normalized)) {
		forms.add(normalizeReviewPath(resolveMutationAbsolutePath(workDir, normalized)));
	}
}

/** Exact path, or the same path joined with the engine work directory. No attribution scan. */
function mutationMatchesEntry(recordPath: string, gitPath: string | undefined, resource: URI, workDir: string | undefined): boolean {
	const recordForms = new Set<string>();
	addProgressForms(recordForms, recordPath, workDir);
	if (recordForms.size === 0) {
		return false;
	}
	const entryForms = new Set<string>();
	addProgressForms(entryForms, gitPath, workDir);
	if (resource.scheme === Schemas.file) {
		addProgressForms(entryForms, resource.fsPath, workDir);
	}
	for (const form of recordForms) {
		if (entryForms.has(form)) {
			return true;
		}
	}
	return false;
}

export class SourcesReviewProgressService extends Disposable implements ISourcesReviewProgressService {

	declare readonly _serviceBrand: undefined;

	private readonly reviewed = new Map<string, IStoredReview>();
	private readonly latestMutation = new Map<string, ILatestMutation>();
	private mutationClock = 0;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@ISCMService private readonly scmService: ISCMService,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
	) {
		super();

		this._register(this.fileService.onDidFilesChange(e => {
			for (const resource of e.rawUpdated) {
				void this.invalidateResource(resource).catch(onUnexpectedError).catch(onUnexpectedError);
			}
			for (const resource of e.rawAdded) {
				void this.invalidateResource(resource).catch(onUnexpectedError).catch(onUnexpectedError);
			}
		}));

		this._register(this.connection.onDidFileMutation(record => {
			this.rememberMutation(record);
			this.invalidateEngineMutation(record);
		}));
	}

	hasReviewed(): boolean {
		return this.reviewed.size > 0;
	}

	isReviewed(key: ISourcesReviewProgressKey): boolean {
		return this.reviewed.has(buildSourcesReviewProgressKey(key));
	}

	isEntryReviewed(target: ISourcesReviewProgressTarget): boolean {
		return !!this.getReviewedKey(target);
	}

	getReviewedKey(target: ISourcesReviewProgressTarget): ISourcesReviewProgressKey | undefined {
		const origin = this.normalizeOrigin(target);
		const sessionId = this.normalizeSessionId(target, origin);
		const scopeKeyId = this.getScopeKeyId(target.resource);
		const path = target.resource.toString();
		for (const stored of this.reviewed.values()) {
			if (stored.origin === origin && stored.sessionId === sessionId && stored.scopeKeyId === scopeKeyId && stored.path === path) {
				return this.toKey(stored);
			}
		}
		return undefined;
	}

	markReviewed(key: ISourcesReviewProgressKey): void {
		if (this.remember(key)) {
			this._onDidChange.fire();
		}
	}

	markUnreviewed(key: ISourcesReviewProgressKey): void {
		if (this.reviewed.delete(buildSourcesReviewProgressKey(key))) {
			this._onDidChange.fire();
		}
	}

	markAllReviewed(keys: readonly ISourcesReviewProgressKey[]): void {
		let changed = false;
		for (const key of keys) {
			if (this.remember(key)) {
				changed = true;
			}
		}
		if (changed) {
			this._onDidChange.fire();
		}
	}

	noteRefreshedKey(key: ISourcesReviewProgressKey): void {
		const built = buildSourcesReviewProgressKey(key);
		const keep = this.reviewed.has(built);
		let changed = false;
		for (const mapKey of [...this.reviewed.keys()]) {
			const stored = this.reviewed.get(mapKey);
			if (!stored || !this.sameIdentity(stored, key)) {
				continue;
			}
			if (keep && mapKey === built) {
				continue;
			}
			this.reviewed.delete(mapKey);
			changed = true;
		}
		if (changed) {
			this._onDidChange.fire();
		}
	}

	async resolveKey(target: ISourcesReviewProgressTarget): Promise<ISourcesReviewProgressKey> {
		const origin = this.normalizeOrigin(target);
		const sessionId = this.normalizeSessionId(target, origin);
		const contentHash = origin === 'engine'
			? this.engineContentHash(sessionId, target)
			: await this.resolveScmHash(target.resource);
		return {
			origin,
			sessionId,
			scopeKeyId: this.getScopeKeyId(target.resource),
			path: target.resource.toString(),
			contentHash,
			gitPath: target.gitPath,
		};
	}

	pruneMissingKeys(bucket: ISourcesReviewProgressBucket, activeKeys: ReadonlySet<string>): void {
		let changed = false;
		for (const [key, stored] of this.reviewed) {
			if (stored.origin !== bucket.origin || stored.sessionId !== bucket.sessionId) {
				continue;
			}
			if (!activeKeys.has(key)) {
				this.reviewed.delete(key);
				changed = true;
			}
		}
		if (changed) {
			this._onDidChange.fire();
		}
	}

	private remember(key: ISourcesReviewProgressKey): boolean {
		const mapKey = buildSourcesReviewProgressKey(key);
		if (this.reviewed.has(mapKey)) {
			return false;
		}
		this.reviewed.set(mapKey, {
			reviewedAt: Date.now(),
			origin: key.origin,
			sessionId: key.sessionId,
			scopeKeyId: key.scopeKeyId,
			path: key.path,
			gitPath: key.gitPath,
			contentHash: key.contentHash,
		});
		return true;
	}

	private toKey(stored: IStoredReview): ISourcesReviewProgressKey {
		return {
			origin: stored.origin,
			sessionId: stored.sessionId,
			scopeKeyId: stored.scopeKeyId,
			path: stored.path,
			contentHash: stored.contentHash,
			gitPath: stored.gitPath,
		};
	}

	private sameIdentity(stored: IStoredReview, key: ISourcesReviewProgressKey): boolean {
		return stored.origin === key.origin
			&& stored.sessionId === key.sessionId
			&& stored.scopeKeyId === key.scopeKeyId
			&& stored.path === key.path;
	}

	private normalizeOrigin(target: ISourcesReviewProgressTarget): SourcesReviewProgressOrigin {
		return target.origin === 'engine' ? 'engine' : 'scm';
	}

	private normalizeSessionId(target: ISourcesReviewProgressTarget, origin: SourcesReviewProgressOrigin): string {
		return origin === 'engine' ? (target.sessionId ?? '') : '';
	}

	private getScopeKeyId(resource: URI): string {
		const repository = this.scmService.getRepository(resource);
		return repository?.provider.rootUri?.toString() ?? '';
	}

	private async resolveScmHash(resource: URI): Promise<string> {
		if (resource.scheme !== Schemas.file) {
			return '';
		}

		try {
			const stat = await this.fileService.stat(resource);
			return stat.etag ?? '';
		} catch {
			return '';
		}
	}

	private workDir(): string | undefined {
		const workDir = this.connection.getConnectionSnapshot()?.workDir;
		return workDir ? workDir : undefined;
	}

	private rememberMutation(record: IFileMutationRecord): void {
		const seen = ++this.mutationClock;
		const path = normalizeReviewPath(record.path);
		this.latestMutation.set(`${record.sessionId}\0${path}`, { record, seen });
	}

	private engineContentHash(sessionId: string, target: ISourcesReviewProgressTarget): string {
		const workDir = this.workDir();
		const prefix = `${sessionId}\0`;
		let best: ILatestMutation | undefined;
		for (const [key, value] of this.latestMutation) {
			if (!key.startsWith(prefix)) {
				continue;
			}
			if (!mutationMatchesEntry(value.record.path, target.gitPath, target.resource, workDir)) {
				continue;
			}
			if (!best || value.seen > best.seen) {
				best = value;
			}
		}
		if (!best) {
			return '';
		}
		return `${best.record.turnId}\0${best.record.toolCallId}`;
	}

	private invalidateEngineMutation(record: IFileMutationRecord): void {
		if (this.reviewed.size === 0) {
			return;
		}
		const workDir = this.workDir();
		let changed = false;
		for (const [key, stored] of [...this.reviewed]) {
			if (stored.origin !== 'engine' || stored.sessionId !== record.sessionId) {
				continue;
			}
			if (!mutationMatchesEntry(record.path, stored.gitPath, URI.parse(stored.path), workDir)) {
				continue;
			}
			this.reviewed.delete(key);
			changed = true;
		}
		if (changed) {
			this._onDidChange.fire();
		}
	}

	private async invalidateResource(resource: URI): Promise<void> {
		const path = resource.toString();
		const scopeKeyId = this.getScopeKeyId(resource);
		const affected: string[] = [];
		for (const [mapKey, stored] of this.reviewed) {
			// Engine rows follow onDidFileMutation, not a local stat.
			if (stored.origin === 'engine' || stored.path !== path || stored.scopeKeyId !== scopeKeyId) {
				continue;
			}
			affected.push(mapKey);
		}
		if (affected.length === 0) {
			return;
		}

		const newHash = await this.resolveScmHash(resource);
		let changed = false;
		for (const mapKey of affected) {
			const stored = this.reviewed.get(mapKey);
			if (!stored) {
				continue;
			}
			if (stored.contentHash !== newHash) {
				this.reviewed.delete(mapKey);
				changed = true;
			}
		}

		if (changed) {
			this._onDidChange.fire();
		}
	}
}

registerSingleton(ISourcesReviewProgressService, SourcesReviewProgressService, InstantiationType.Delayed);
