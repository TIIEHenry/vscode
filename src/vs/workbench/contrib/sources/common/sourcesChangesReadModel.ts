/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RunOnceScheduler } from '../../../../base/common/async.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { isAdvertisedEngineRpc } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import { sourcesRepositoryRootUris } from './sourcesChangesGit.js';
import {
	hasSourcesGitReadEntries,
	resolveSourcesGitResourceRoot,
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
	private refreshRunning = false;
	private refreshAgain = false;
	private readonly repositoryListeners = this._register(new DisposableMap<ISCMRepository>());
	private readonly refreshScheduler = this._register(new RunOnceScheduler(() => {
		void this.runScheduledRefresh().catch(onUnexpectedError).catch(onUnexpectedError);
	}, 250));

	constructor(
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ISCMService private readonly scmService: ISCMService,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
	) {
		super();

		this._register(this.connection.onDidChangeConnection(() => this.scheduleRefresh()));
		this._register(this.session.onDidChangeActiveSession(() => this.scheduleRefresh()));
		this._register(this.session.onDidChangeSession(() => this.scheduleRefresh()));
		this._register(this.scmService.onDidAddRepository(repo => {
			this.trackRepository(repo);
			this.scheduleRefresh();
		}));
		this._register(this.scmService.onDidRemoveRepository(repo => {
			this.repositoryListeners.deleteAndDispose(repo);
			this.scheduleRefresh();
		}));
		for (const repo of this.scmService.repositories ?? []) {
			this.trackRepository(repo);
		}
		this.scheduleRefresh();
	}

	scheduleRefresh(): void {
		if (this._store.isDisposed) {
			return;
		}
		if (this.refreshRunning) {
			this.refreshAgain = true;
			return;
		}
		if (!this.refreshScheduler.isScheduled()) {
			this.refreshScheduler.schedule();
		}
	}

	flushScheduledRefresh(): void {
		this.refreshScheduler.flush();
	}

	private async runScheduledRefresh(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		this.refreshRunning = true;
		this.refreshAgain = false;
		try {
			await this.refresh();
		} finally {
			this.refreshRunning = false;
			if (this.refreshAgain && !this._store.isDisposed) {
				this.refreshAgain = false;
				this.scheduleRefresh();
			}
		}
	}

	private trackRepository(repo: ISCMRepository): void {
		if (this.repositoryListeners.has(repo)) {
			return;
		}
		const store = new DisposableStore();
		const onResources = repo.provider?.onDidChangeResources;
		if (onResources) {
			store.add(onResources(() => this.scheduleRefresh()));
		}
		const onGroups = repo.provider?.onDidChangeResourceGroups;
		if (onGroups) {
			store.add(onGroups(() => this.scheduleRefresh()));
		}
		this.repositoryListeners.set(repo, store);
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
			const failedFacts = this.readFacts();
			if (shouldKeepSourcesGitReadPairingHoldLeftover(failedFacts.phaseConnected, failedFacts.pairingPending, sourcesChangesEngineRowCount(previous))) {
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

	private gitReadCapabilitySnapshot(): UniverseAgentCapabilitySnapshot | undefined {
		const read = this.connection.getCapabilitySnapshot;
		return typeof read === 'function' ? read.call(this.connection) : undefined;
	}

	private hasReadChangesHook(): boolean {
		return isAdvertisedEngineRpc(this.gitReadCapabilitySnapshot(), 'readGitChanges', this.connection.readGitChanges);
	}

	private readChangesHook() {
		const hook = this.connection.readGitChanges;
		if (!this.hasReadChangesHook() || typeof hook !== 'function') {
			return undefined;
		}
		return (request: Parameters<NonNullable<IUniverseAgentConnection['readGitChanges']>>[0]) => hook.call(this.connection, request);
	}

	private readSummaryHook() {
		const hook = this.connection.readGitSummary;
		return typeof hook === 'function'
			? (request: Parameters<NonNullable<IUniverseAgentConnection['readGitSummary']>>[0]) => hook.call(this.connection, request)
			: undefined;
	}

	private getRootUri(): URI | undefined {
		return resolveSourcesGitResourceRoot({
			workDir: this.session.getSessionWorkDir?.(this.session.getActiveSessionId()),
			repositoryRoots: sourcesRepositoryRootUris(this.scmService.repositories ?? []),
			workspaceFolders: this.workspaceContext.getWorkspace().folders.map(folder => folder.uri),
		});
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
