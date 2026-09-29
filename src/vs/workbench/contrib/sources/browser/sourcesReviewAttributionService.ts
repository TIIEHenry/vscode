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
		@IUniverseAgentConnection connection: IUniverseAgentConnection,
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
			// sessionToken. Pairing-hold-first; KEEP prior leftover records.
			if (!this.session.isPairingHold() && snapshot.sessionToken) {
				this.everConnected = true;
			}
			this._onDidChange.fire();
		}));
	}

	isAttributionEnabled(): boolean {
		if (!this.everConnected) {
			return false;
		}
		const workDir = this.connectionSnapshot.workDir;
		if (!isWorkDirCompatible(workDir, this.getWorkspaceRoots())) {
			return false;
		}
		return this.activeRecordCount() > 0;
	}

	getWorkDirMismatchNote(): string | undefined {
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

	buildChipMapForEntries(entries: readonly { readonly resource: URI }[]): ReadonlyMap<string, readonly IReviewAttributionChipDisplay[]> {
		const result = new Map<string, readonly IReviewAttributionChipDisplay[]>();
		const workDir = this.connectionSnapshot.workDir;
		const workspaceRoots = this.getWorkspaceRoots();
		if (!isWorkDirCompatible(workDir, workspaceRoots)) {
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
				const matching = bucket.byPath.get(normalizeReviewPath(entry.resource.fsPath));
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
		this.ensurePathIndex();
		let bucket = this.buckets.get(record.sessionId);
		if (!bucket) {
			bucket = { order: [], byPath: new Map() };
			this.buckets.set(record.sessionId, bucket);
		}
		bucket.order.push(record);
		const workDir = this.connectionSnapshot.workDir ?? '';
		const workspaceRoots = this.getWorkspaceRoots();
		this.addToPathIndex(bucket, record, workDir, workspaceRoots);
		while (bucket.order.length > SOURCES_REVIEW_SESSION_MUTATION_LIMIT) {
			const oldest = bucket.order.shift();
			if (oldest) {
				this.removeFromPathIndex(bucket, oldest, workDir, workspaceRoots);
			}
		}
	}

	private ensurePathIndex(): void {
		const workDir = this.connectionSnapshot.workDir ?? '';
		const workspaceRoots = this.getWorkspaceRoots();
		const signature = `${workDir}\n${workspaceRoots.map(root => root.toString()).join('\n')}`;
		if (signature === this.pathIndexSignature) {
			return;
		}
		for (const bucket of this.buckets.values()) {
			bucket.byPath.clear();
			for (const record of bucket.order) {
				this.addToPathIndex(bucket, record, workDir, workspaceRoots);
			}
		}
		this.pathIndexSignature = signature;
	}

	private addToPathIndex(bucket: ISessionMutationBucket, record: IFileMutationRecord, workDir: string, workspaceRoots: readonly URI[]): void {
		if (!workDir) {
			return;
		}
		const key = reviewMutationPathKey(workDir, record.path, workspaceRoots);
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

	private removeFromPathIndex(bucket: ISessionMutationBucket, record: IFileMutationRecord, workDir: string, workspaceRoots: readonly URI[]): void {
		if (!workDir) {
			return;
		}
		const key = reviewMutationPathKey(workDir, record.path, workspaceRoots);
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
