/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { IFileMutationRecord, UniverseAgentConnectionSnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import {
	buildAttributionChips,
	engineReviewPathKey,
	getWorkspaceFolderRoots,
	IReviewAttributionChipDisplay,
	IReviewItemAttribution,
	isWorkDirCompatible,
	ISourcesReviewAttributionService,
	normalizeReviewPath,
	resolveRevealItemId,
	reviewMutationPathKey,
} from '../common/sourcesReviewAttribution.js';

/** Per session. The oldest record is dropped, and its path index entry goes with it. */
const SOURCES_REVIEW_SESSION_MUTATION_LIMIT = 500;

interface ISessionMutationBucket {
	/** Oldest first. */
	readonly order: IFileMutationRecord[];
	readonly byPath: Map<string, IFileMutationRecord[]>;
	/** Work-root signature this bucket's path index was built with. */
	indexSignature: string;
}

interface IAttributionIndexFacts {
	readonly mode: 'legacy' | 'root';
	readonly access: 'local' | 'engine' | 'none';
	readonly workDir: string;
	readonly roots: readonly URI[];
	readonly signature: string;
}

export class SourcesReviewAttributionService extends Disposable implements ISourcesReviewAttributionService {

	declare readonly _serviceBrand: undefined;

	private readonly buckets = new Map<string, ISessionMutationBucket>();
	private pathIndexSignature = '';
	private activeSessionId = '';
	private connectionSnapshot: UniverseAgentConnectionSnapshot;
	private everConnected = false;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();

		this.activeSessionId = session.getActiveSessionId();
		this.connectionSnapshot = connection.getConnectionSnapshot();
		// leftover-looks-live first-pull (`isEngineConnected()===true` + pairing
		// hold) must not invent everConnected. Prior live / mutations KEEP.
		if (!session.isPairingHold() && connection.isEngineConnected()) {
			this.everConnected = true;
		}

		this._register(connection.onDidFileMutation(record => {
			// leftover-looks-live: do not invent everConnected or ingest live
			// mutations. Prior leftover records KEEP.
			if (this.session.isPairingHold()) {
				return;
			}
			this.everConnected = true;
			this.remember(record);
			this._onDidChange.fire();
		}));

		this._register(session.onDidChangeActiveSession(sessionId => {
			this.activeSessionId = sessionId;
			this._onDidChange.fire();
		}));

		this._register(connection.onDidChangeConnection(snapshot => {
			this.connectionSnapshot = snapshot;
			// leftover-looks-live first-pull must not invent everConnected from
			// authenticated. Pairing-hold-first; KEEP prior leftover records.
			if (!this.session.isPairingHold() && snapshot.authenticated) {
				this.everConnected = true;
			}
			this._onDidChange.fire();
		}));

		const workRootEvent = session.onDidChangeActiveWorkRoot;
		if (workRootEvent) {
			this._register(workRootEvent(() => this._onDidChange.fire()));
		}
	}

	isAttributionEnabled(): boolean {
		if (!this.everConnected) {
			return false;
		}
		if (!this.canAttribute(this.indexFacts(this.activeSessionId))) {
			return false;
		}
		return this.activeRecordCount() > 0;
	}

	getWorkDirMismatchNote(): string | undefined {
		// Session work root attributes engine rows; the legacy omission note does not apply.
		if (this.session.getWorkRoot) {
			return undefined;
		}
		const workDir = this.connectionSnapshot.workDir;
		if (!workDir || !this.everConnected) {
			return undefined;
		}
		if (isWorkDirCompatible(workDir, this.getWorkspaceRoots())) {
			return undefined;
		}
		return localize(
			'sourcesReviewAttribution.workDirMismatch',
			"Engine workspace `{0}` differs from this workspace; attribution is omitted.",
			workDir,
		);
	}

	getAttributionHeaderSuffix(): string | undefined {
		if (!this.isAttributionEnabled()) {
			return undefined;
		}
		// leftover-looks-live KEEP chips stay; suffix is disconnected KEEP-chrome,
		// not “Attribution from the connected engine.”
		if (this.session.isPairingHold()) {
			return undefined;
		}
		if (!this.connection.isEngineConnected()) {
			return undefined;
		}
		return localize(
			'sourcesReviewAttribution.headerSuffix',
			"Attribution from the connected engine.",
		);
	}

	resolveRevealItemId(toolCallId: string): string | undefined {
		let lease: ReturnType<IAgentSessionContext['acquireSessionView']> | undefined;
		try {
			lease = this.session.acquireSessionView(this.activeSessionId);
			return resolveRevealItemId(lease.attribution as ReadonlyMap<string, IReviewItemAttribution>, toolCallId);
		} catch (error) {
			this.notificationService.error(getErrorMessage(error));
			return undefined;
		} finally {
			lease?.dispose();
		}
	}

	buildChipMapForEntries(entries: readonly { readonly resource: URI; readonly gitPath?: string }[]): ReadonlyMap<string, readonly IReviewAttributionChipDisplay[]> {
		const result = new Map<string, readonly IReviewAttributionChipDisplay[]>();
		const facts = this.indexFacts(this.activeSessionId);
		if (!this.canAttribute(facts)) {
			return result;
		}

		const bucket = this.buckets.get(this.activeSessionId);
		if (!bucket || bucket.order.length === 0) {
			return result;
		}

		this.ensurePathIndex();
		let lease: ReturnType<IAgentSessionContext['acquireSessionView']> | undefined;
		try {
			lease = this.session.acquireSessionView(this.activeSessionId);
			const snapshot = lease.snapshot;
			const attribution = lease.attribution as ReadonlyMap<string, IReviewItemAttribution>;
			for (const entry of entries) {
				const key = this.entryPathKey(entry, facts);
				if (!key) {
					continue;
				}
				const matching = bucket.byPath.get(key);
				if (!matching || matching.length === 0) {
					continue;
				}
				result.set(entry.resource.toString(), buildAttributionChips(matching, snapshot, attribution));
			}
			return result;
		} catch (error) {
			this.notificationService.error(getErrorMessage(error));
			return new Map();
		} finally {
			lease?.dispose();
		}
	}

	private activeRecordCount(): number {
		return this.buckets.get(this.activeSessionId)?.order.length ?? 0;
	}

	private remember(record: IFileMutationRecord): void {
		if (!this.session.getWorkRoot) {
			this.ensurePathIndex();
		}
		let bucket = this.buckets.get(record.sessionId);
		if (!bucket) {
			bucket = { order: [], byPath: new Map(), indexSignature: '' };
			this.buckets.set(record.sessionId, bucket);
		}
		bucket.order.push(record);
		const facts = this.indexFacts(record.sessionId);
		if (this.session.getWorkRoot && facts.signature !== bucket.indexSignature) {
			this.rebuildBucket(bucket, facts);
		} else {
			this.addToPathIndex(bucket, record, facts);
		}
		while (bucket.order.length > SOURCES_REVIEW_SESSION_MUTATION_LIMIT) {
			const oldest = bucket.order.shift();
			if (oldest) {
				this.removeFromPathIndex(bucket, oldest, facts);
			}
		}
	}

	private ensurePathIndex(): void {
		if (this.session.getWorkRoot) {
			for (const [sessionId, bucket] of this.buckets) {
				const facts = this.indexFacts(sessionId);
				if (facts.signature === bucket.indexSignature) {
					continue;
				}
				this.rebuildBucket(bucket, facts);
			}
			return;
		}
		const facts = this.indexFacts(this.activeSessionId);
		if (facts.signature === this.pathIndexSignature) {
			return;
		}
		for (const bucket of this.buckets.values()) {
			this.rebuildBucket(bucket, facts);
		}
		this.pathIndexSignature = facts.signature;
	}

	private rebuildBucket(bucket: ISessionMutationBucket, facts: IAttributionIndexFacts): void {
		bucket.byPath.clear();
		for (const record of bucket.order) {
			this.addToPathIndex(bucket, record, facts);
		}
		bucket.indexSignature = facts.signature;
	}

	private indexFacts(sessionId: string): IAttributionIndexFacts {
		const roots = this.getWorkspaceRoots();
		if (!this.session.getWorkRoot) {
			const workDir = this.connectionSnapshot.workDir ?? '';
			return {
				mode: 'legacy',
				access: 'local',
				workDir,
				roots,
				signature: `${workDir}\n${roots.map(root => root.toString()).join('\n')}`,
			};
		}
		const root = this.session.getWorkRoot(sessionId);
		const workDir = root.workDir ?? '';
		return {
			mode: 'root',
			access: root.access,
			workDir,
			roots,
			signature: `${root.access}\n${normalizeReviewPath(workDir)}\n${root.localRoot?.toString() ?? ''}`,
		};
	}

	private canAttribute(facts: IAttributionIndexFacts): boolean {
		if (facts.mode === 'legacy') {
			return isWorkDirCompatible(facts.workDir, facts.roots);
		}
		return facts.access !== 'none' && !!facts.workDir;
	}

	private mutationPathKey(recordPath: string, facts: IAttributionIndexFacts): string | undefined {
		if (facts.mode === 'root' && facts.access === 'engine') {
			return engineReviewPathKey(recordPath, facts.workDir);
		}
		if (facts.mode === 'root' && facts.access !== 'local') {
			return undefined;
		}
		if (!facts.workDir) {
			return undefined;
		}
		return reviewMutationPathKey(facts.workDir, recordPath, facts.roots);
	}

	private entryPathKey(entry: { readonly resource: URI; readonly gitPath?: string }, facts: IAttributionIndexFacts): string | undefined {
		if (facts.mode === 'root' && facts.access === 'engine') {
			return entry.gitPath ? engineReviewPathKey(entry.gitPath, facts.workDir) : undefined;
		}
		return normalizeReviewPath(entry.resource.fsPath);
	}

	private addToPathIndex(bucket: ISessionMutationBucket, record: IFileMutationRecord, facts: IAttributionIndexFacts): void {
		const key = this.mutationPathKey(record.path, facts);
		if (!key) {
			return;
		}
		const existing = bucket.byPath.get(key);
		if (existing) {
			existing.push(record);
		} else {
			bucket.byPath.set(key, [record]);
		}
	}

	private removeFromPathIndex(bucket: ISessionMutationBucket, record: IFileMutationRecord, facts: IAttributionIndexFacts): void {
		const key = this.mutationPathKey(record.path, facts);
		if (!key) {
			return;
		}
		const existing = bucket.byPath.get(key);
		if (!existing) {
			return;
		}
		const index = existing.indexOf(record);
		if (index >= 0) {
			existing.splice(index, 1);
		}
		if (existing.length === 0) {
			bucket.byPath.delete(key);
		}
	}

	private getWorkspaceRoots(): URI[] {
		return getWorkspaceFolderRoots(this.workspaceContext.getWorkspace().folders);
	}
}

registerSingleton(ISourcesReviewAttributionService, SourcesReviewAttributionService, InstantiationType.Delayed);
