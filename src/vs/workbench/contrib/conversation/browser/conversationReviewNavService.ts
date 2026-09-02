/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ISCMService } from '../../scm/common/scm.js';
import {
	getWorkspaceFolderRoots,
	IFileMutationRecord,
} from '../../sources/common/sourcesReviewAttribution.js';
import { IConversationRosterService } from '../browser/conversationStubService.js';
import {
	IConversationReviewNavService,
	IReviewNavRecord,
	ITurnSettleSignal,
	materializeReviewNavRecords,
} from '../common/conversationReviewEntry.js';

interface IMutableFileMutationRecord extends IFileMutationRecord {
	turnId: string;
}


export class ConversationReviewNavService extends Disposable implements IConversationReviewNavService {

	declare readonly _serviceBrand: undefined;

	private readonly mutationBuckets = new Map<string, IMutableFileMutationRecord[]>();
	private readonly settledTurnIds = new Map<string, Set<string>>();
	private connectionSnapshot: UniverseAgentConnectionSnapshot;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IUniverseAgentConnection connection: IUniverseAgentConnection,
		@IConversationRosterService roster: IConversationRosterService,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
		@ISCMService private readonly scmService: ISCMService,
	) {
		super();

		this.connectionSnapshot = connection.getConnectionSnapshot();

		this._register(connection.onDidFileMutation(record => {
			this.ingestMutation(record);
		}));

		this._register(connection.onDidTurnSettle(signal => {
			this.applyTurnSettle(signal);
		}));

		this._register(roster.onDidChangeActiveSession(() => {
			this._onDidChange.fire();
		}));

		this._register(connection.onDidChangeConnection(snapshot => {
			this.connectionSnapshot = snapshot;
			this._onDidChange.fire();
		}));
	}

	getReviewNavForSession(sessionId: string): readonly IReviewNavRecord[] {
		return this.materializeBucket(sessionId);
	}

	private ingestMutation(record: IFileMutationRecord): void {
		const bucket = this.mutationBuckets.get(record.sessionId) ?? [];
		bucket.push({ ...record });
		this.mutationBuckets.set(record.sessionId, bucket);
		this._onDidChange.fire();
	}

	private applyTurnSettle(signal: ITurnSettleSignal): void {
		const settled = this.settledTurnIds.get(signal.sessionId) ?? new Set<string>();
		settled.add(signal.assistantTurnId);
		this.settledTurnIds.set(signal.sessionId, settled);

		const bucket = this.mutationBuckets.get(signal.sessionId);
		if (bucket) {
			for (const record of bucket) {
				if (record.turnId === signal.runtimeTurnId) {
					record.turnId = signal.assistantTurnId;
				}
			}
		}

		this._onDidChange.fire();
	}

	private materializeBucket(sessionId: string): readonly IReviewNavRecord[] {
		const mutations = this.mutationBuckets.get(sessionId) ?? [];
		const settled = this.settledTurnIds.get(sessionId) ?? new Set<string>();
		return materializeReviewNavRecords({
			sessionId,
			mutations,
			settledTurnIds: settled,
			workDir: this.connectionSnapshot.workDir,
			workspaceRoots: getWorkspaceFolderRoots(this.workspaceContext.getWorkspace().folders),
			hasScmProvider: !Iterable.isEmpty(this.scmService.repositories),
		});
	}
}
