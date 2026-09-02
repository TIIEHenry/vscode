/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import {
	buildAttributionChips,
	filterRecordsForResource,
	getWorkspaceFolderRoots,
	IFileMutationRecord,
	IReviewAttributionChipDisplay,
	IReviewItemAttribution,
	isWorkDirCompatible,
	ISourcesReviewAttributionService,
} from '../common/sourcesReviewAttribution.js';

function subscribeFileMutations(
	connection: IUniverseAgentConnection,
	listener: (record: IFileMutationRecord) => void,
): IDisposable {
	// A1 declares `Event<void>` until typed; R3 consumes the A2 contract (sources-review-progress §8).
	const event = connection.onDidFileMutation as unknown as import('../../../../base/common/event.js').Event<IFileMutationRecord>;
	return event(listener);
}

export class SourcesReviewAttributionService extends Disposable implements ISourcesReviewAttributionService {

	declare readonly _serviceBrand: undefined;

	private readonly buckets = new Map<string, IFileMutationRecord[]>();
	private activeSessionId = '';
	private connectionSnapshot: UniverseAgentConnectionSnapshot;
	private everConnected = false;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IUniverseAgentConnection connection: IUniverseAgentConnection,
		@IConversationRosterService private readonly roster: IConversationRosterService,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
	) {
		super();

		this.activeSessionId = roster.getActiveSessionId();
		this.connectionSnapshot = connection.getConnectionSnapshot();
		if (connection.isEngineConnected()) {
			this.everConnected = true;
		}

		this._register(subscribeFileMutations(connection, record => {
			this.everConnected = true;
			const bucket = this.buckets.get(record.sessionId) ?? [];
			bucket.push(record);
			this.buckets.set(record.sessionId, bucket);
			this._onDidChange.fire();
		}));

		this._register(roster.onDidChangeActiveSession(sessionId => {
			this.activeSessionId = sessionId;
			this._onDidChange.fire();
		}));

		this._register(connection.onDidChangeConnection(snapshot => {
			this.connectionSnapshot = snapshot;
			if (snapshot.sessionToken) {
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
		return this.getActiveRecords().length > 0;
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
		return localize(
			'sourcesReviewAttribution.headerSuffix',
			"Attribution from the connected engine.",
		);
	}

	buildChipMapForEntries(entries: readonly { readonly resource: URI }[]): ReadonlyMap<string, readonly IReviewAttributionChipDisplay[]> {
		const result = new Map<string, readonly IReviewAttributionChipDisplay[]>();
		const workDir = this.connectionSnapshot.workDir;
		const workspaceRoots = this.getWorkspaceRoots();
		if (!isWorkDirCompatible(workDir, workspaceRoots)) {
			return result;
		}

		const records = this.getActiveRecords();
		if (records.length === 0) {
			return result;
		}

		const lease = this.roster.acquireSessionView(this.activeSessionId);
		try {
			const snapshot = lease.snapshot;
			const attribution = lease.attribution as ReadonlyMap<string, IReviewItemAttribution>;
			for (const entry of entries) {
				const matching = filterRecordsForResource(records, entry.resource, workDir!, workspaceRoots);
				if (matching.length === 0) {
					continue;
				}
				result.set(entry.resource.toString(), buildAttributionChips(matching, snapshot, attribution));
			}
		} finally {
			lease.dispose();
		}

		return result;
	}

	private getActiveRecords(): readonly IFileMutationRecord[] {
		return this.buckets.get(this.activeSessionId) ?? [];
	}

	private getWorkspaceRoots(): URI[] {
		return getWorkspaceFolderRoots(this.workspaceContext.getWorkspace().folders);
	}
}

registerSingleton(ISourcesReviewAttributionService, SourcesReviewAttributionService, InstantiationType.Delayed);
