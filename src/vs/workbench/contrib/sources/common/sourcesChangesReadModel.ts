/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { ISCMService } from '../../scm/common/scm.js';
import {
	hasSourcesGitReadEntries,
	shouldKeepSourcesGitReadNoHookLeftover,
	shouldKeepSourcesGitReadPairingHoldLeftover,
	sourcesGitReadFailureMessage,
	tryLoadSourcesGitChangeEntries,
} from './sourcesChangesGitRead.js';
import { isSourcesChangesWriteClosed } from './sourcesChangesGitWrite.js';
import {
	collectSourcesChangeEntries,
	initialSourcesChangesSnapshot,
	ISourcesChangesModel,
	ISourcesChangesSnapshot,
	isSourcesFileDiffOpenSkipped,
	sourcesChangesEngineRowCount,
	stampSourcesEngineEntries,
	stampSourcesScmEntries,
} from './sourcesChangesModel.js';

export class SourcesChangesModel extends Disposable implements ISourcesChangesModel {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	private snapshot: ISourcesChangesSnapshot = initialSourcesChangesSnapshot();
	private readGeneration = 0;

	constructor(
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ISCMService private readonly scmService: ISCMService,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
	) {
		super();
	}

	getSnapshot(): ISourcesChangesSnapshot {
		return this.snapshot;
	}

	isWriteClosed(): boolean {
		const facts = this.readFacts();
		return isSourcesChangesWriteClosed(this.snapshot.state, {
			phaseConnected: facts.phaseConnected,
			pairingPending: facts.pairingPending,
			engineConnected: facts.engineConnected,
			engineSessionReady: this.session.isEngineSessionReady(),
		});
	}

	isFileDiffOpenSkipped(): boolean {
		return isSourcesFileDiffOpenSkipped(this.snapshot.state);
	}

	async refresh(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		const generation = ++this.readGeneration;
		const previous = this.snapshot;
		const sessionId = this.session.getActiveSessionId();
		const started = this.readFacts();

		// Pairing-hold before the RPC. An in-flight result must not paint as live.
		if (this.holdPairing(generation, previous)) {
			return;
		}

		try {
			const loaded = await tryLoadSourcesGitChangeEntries(
				started.engineConnected,
				this.readChangesHook(),
				this.readSummaryHook(),
				this.getRootUri(),
				sessionId,
				this.session.isPairingHold(),
			);
			if (generation !== this.readGeneration || this._store.isDisposed) {
				return;
			}
			if (this.holdPairing(generation, previous)) {
				return;
			}
			const loadedEntries = loaded?.entries;
			if (hasSourcesGitReadEntries(loadedEntries)) {
				this.land(generation, { kind: 'engine-live', sessionId }, stampSourcesEngineEntries(loadedEntries, sessionId));
				return;
			}
			const after = this.readFacts();
			if (shouldKeepSourcesGitReadNoHookLeftover(after.engineConnected, this.hasReadChangesHook(), sourcesChangesEngineRowCount(previous))) {
				this.landLeftover(generation, previous, 'no-hook');
				return;
			}
			this.land(generation, { kind: 'scm' }, stampSourcesScmEntries(this.collectScmEntries()));
		} catch (error) {
			if (generation !== this.readGeneration || this._store.isDisposed) {
				return;
			}
			if (shouldKeepSourcesGitReadPairingHoldLeftover(this.session.isPairingHold(), this.session.isPairingHold(), sourcesChangesEngineRowCount(previous))) {
				this.landLeftover(generation, previous, 'pairing-hold');
				return;
			}
			const failureMessage = sourcesGitReadFailureMessage(error);
			if (previous.state.kind !== 'scm' && previous.entries.length > 0) {
				this.land(
					generation,
					{ kind: 'engine-leftover', sessionId: previous.state.sessionId, reason: 'read-failed' },
					previous.entries,
					failureMessage,
				);
				return;
			}
			this.land(
				generation,
				{ kind: 'scm' },
				previous.state.kind === 'scm' ? previous.entries : [],
				failureMessage,
			);
		}
	}

	/** Pairing with engine rows keeps them. Pairing with none falls back to SCM and skips the RPC. */
	private holdPairing(generation: number, previous: ISourcesChangesSnapshot): boolean {
		if (!this.session.isPairingHold()) {
			return false;
		}
		if (shouldKeepSourcesGitReadPairingHoldLeftover(true, true, sourcesChangesEngineRowCount(previous))) {
			this.landLeftover(generation, previous, 'pairing-hold');
			return true;
		}
		this.land(generation, { kind: 'scm' }, stampSourcesScmEntries(this.collectScmEntries()));
		return true;
	}

	private readFacts(): { phaseConnected: boolean; pairingPending: boolean; engineConnected: boolean } {
		const phase = this.connection.getConnectionPhase?.();
		const snapshot = this.connection.getConnectionSnapshot?.();
		return {
			phaseConnected: phase?.kind === 'connected',
			pairingPending: !!snapshot?.pairingPending,
			engineConnected: typeof this.connection.isEngineConnected === 'function' ? this.connection.isEngineConnected() : false,
		};
	}

	private hasReadChangesHook(): boolean {
		return typeof this.connection.readGitChanges === 'function';
	}

	private readChangesHook() {
		const hook = this.connection.readGitChanges;
		return typeof hook === 'function'
			? (request: Parameters<NonNullable<IUniverseAgentConnection['readGitChanges']>>[0]) => hook.call(this.connection, request)
			: undefined;
	}

	private readSummaryHook() {
		const hook = this.connection.readGitSummary;
		return typeof hook === 'function'
			? (request: Parameters<NonNullable<IUniverseAgentConnection['readGitSummary']>>[0]) => hook.call(this.connection, request)
			: undefined;
	}

	private getRootUri(): URI | undefined {
		for (const repo of this.scmService.repositories ?? []) {
			return repo.provider?.rootUri ?? this.workspaceContext.getWorkspace().folders[0]?.uri;
		}
		return this.workspaceContext.getWorkspace().folders[0]?.uri;
	}

	private collectScmEntries() {
		return collectSourcesChangeEntries(this.scmService.repositories ?? []);
	}

	private landLeftover(generation: number, previous: ISourcesChangesSnapshot, reason: 'pairing-hold' | 'no-hook'): void {
		const sessionId = previous.state.kind === 'scm' ? '' : previous.state.sessionId;
		this.land(generation, { kind: 'engine-leftover', sessionId, reason }, previous.entries);
	}

	private land(
		generation: number,
		state: ISourcesChangesSnapshot['state'],
		entries: readonly ISourcesChangesSnapshot['entries'][number][],
		failureMessage?: string,
	): void {
		if (generation !== this.readGeneration || this._store.isDisposed) {
			return;
		}
		this.snapshot = {
			generation,
			settled: true,
			state,
			entries,
			failureMessage,
		};
		this._onDidChange.fire();
	}
}

registerSingleton(ISourcesChangesModel, SourcesChangesModel, InstantiationType.Delayed);
