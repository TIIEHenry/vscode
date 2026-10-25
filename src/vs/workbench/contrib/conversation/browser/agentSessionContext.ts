/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IAgentSessionContext, IAgentSessionViewLease } from '../../../services/agentSession/common/agentSessionContext.js';
import { agentWorkRootDedupeKey, IAgentWorkRoot, resolveAgentWorkRoot } from '../../../services/agentSession/common/agentWorkRoot.js';
import { ISCMService } from '../../scm/common/scm.js';
import { getConversationSessionReadiness } from './conversationSessionAvailability.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { IConversationRosterService } from './conversationStubService.js';

/**
 * Live view of one roster lease. `snapshot` / `attribution` stay getters so a
 * held lease does not freeze the replica. `dispose` releases the inner lease
 * once; disposing this service releases every lease still held.
 */
class AgentSessionViewLease implements IAgentSessionViewLease {

	private released = false;

	constructor(
		private readonly inner: IConversationSessionViewLease,
		private readonly onReleased: () => void,
	) { }

	get snapshot(): IAgentSessionViewLease['snapshot'] {
		return this.inner.snapshot;
	}

	get attribution(): IAgentSessionViewLease['attribution'] {
		return this.inner.attribution;
	}

	dispose(): void {
		if (this.released) {
			return;
		}
		this.released = true;
		this.onReleased();
		this.inner.dispose();
	}
}

export class AgentSessionContext extends Disposable implements IAgentSessionContext {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeActiveSession = this._register(new Emitter<string>());
	readonly onDidChangeActiveSession = this._onDidChangeActiveSession.event;

	private readonly _onDidChangeSession = this._register(new Emitter<string>());
	readonly onDidChangeSession = this._onDidChangeSession.event;

	private readonly _onDidChangeActiveWorkRoot = this._register(new Emitter<IAgentWorkRoot>());
	readonly onDidChangeActiveWorkRoot = this._onDidChangeActiveWorkRoot.event;

	private readonly liveLeases = new Set<AgentSessionViewLease>();

	/** Last committed link. Cleared snapshots keep these until a new linkId arrives. */
	private committedLinkId: number | undefined;
	private committedEngineIdentityId: string | undefined;
	private committedConnectionWorkDir: string | undefined;
	private activeWorkRootKey: string | undefined;

	constructor(
		@IConversationRosterService private readonly roster: IConversationRosterService,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IWorkspaceContextService private readonly workspace: IWorkspaceContextService,
		@ISCMService private readonly scm: ISCMService,
	) {
		super();
		this.observeSnapshot(this.readSnapshot());
		this.activeWorkRootKey = agentWorkRootDedupeKey(this.getActiveWorkRoot());
		this._register(this.roster.onDidChangeActiveSession(sessionId => {
			this._onDidChangeActiveSession.fire(sessionId);
			this.publishActiveWorkRoot();
		}));
		this._register(this.roster.onDidChangeSession(sessionId => {
			this._onDidChangeSession.fire(sessionId);
			if (sessionId === this.roster.getActiveSessionId()) {
				this.publishActiveWorkRoot();
			}
		}));
		const connectionEvents = this.connection as Partial<IUniverseAgentConnection>;
		if (typeof connectionEvents.onDidChangeConnection === 'function') {
			this._register(this.connection.onDidChangeConnection(snapshot => {
				this.observeSnapshot(snapshot);
				this.publishActiveWorkRoot();
			}));
		}
		this._register(this.workspace.onDidChangeWorkspaceFolders(() => this.publishActiveWorkRoot()));
		this._register(this.scm.onDidAddRepository(() => this.publishActiveWorkRoot()));
		this._register(this.scm.onDidRemoveRepository(() => this.publishActiveWorkRoot()));
	}

	getActiveSessionId(): string {
		return this.roster.getActiveSessionId();
	}

	getSessionWorkDir(sessionId: string): string | undefined {
		const workDir = this.roster.getSessions().find(session => session.id === sessionId)?.workDir?.trim();
		return workDir ? workDir : undefined;
	}

	getWorkRoot(sessionId: string): IAgentWorkRoot {
		return resolveAgentWorkRoot({
			sessionId,
			sessionWorkDir: this.getSessionWorkDir(sessionId),
			connectionWorkDir: this.committedConnectionWorkDir,
			engineIdentityId: this.committedEngineIdentityId,
			repositoryRoots: this.repositoryRoots(),
			workspaceFolders: this.workspaceFolders(),
		});
	}

	getActiveWorkRoot(): IAgentWorkRoot {
		return this.getWorkRoot(this.roster.getActiveSessionId());
	}

	private readSnapshot(): UniverseAgentConnectionSnapshot | undefined {
		const connection = this.connection as Partial<IUniverseAgentConnection>;
		if (typeof connection.getConnectionSnapshot !== 'function') {
			return undefined;
		}
		return this.connection.getConnectionSnapshot();
	}

	/**
	 * Keep the last committed identity and connection workDir while a snapshot
	 * has no published link. A new linkId replaces both. A new link with no
	 * identity does not keep the previous engine's id.
	 */
	private observeSnapshot(snapshot: UniverseAgentConnectionSnapshot | undefined): void {
		if (!snapshot || snapshot.linkId === undefined) {
			return;
		}
		const identity = snapshot.engineIdentityId?.trim() || undefined;
		const workDir = snapshot.workDir?.trim() || undefined;
		if (this.committedLinkId === undefined || snapshot.linkId !== this.committedLinkId) {
			this.committedLinkId = snapshot.linkId;
			this.committedEngineIdentityId = identity;
			this.committedConnectionWorkDir = workDir;
			return;
		}
		if (identity) {
			this.committedEngineIdentityId = identity;
		}
		if (workDir) {
			this.committedConnectionWorkDir = workDir;
		}
	}

	private publishActiveWorkRoot(): void {
		const root = this.getActiveWorkRoot();
		const key = agentWorkRootDedupeKey(root);
		if (key === this.activeWorkRootKey) {
			return;
		}
		this.activeWorkRootKey = key;
		this._onDidChangeActiveWorkRoot.fire(root);
	}

	private workspaceFolders() {
		return this.workspace.getWorkspace().folders.map(folder => folder.uri);
	}

	private repositoryRoots(): URI[] {
		const roots: URI[] = [];
		for (const repository of this.scm.repositories) {
			const rootUri = repository.provider?.rootUri;
			if (rootUri) {
				roots.push(rootUri);
			}
		}
		return roots;
	}

	isEngineSessionReady(): boolean {
		return this.roster.isEngineSessionReady();
	}

	getEngineSessionReadiness(): 'ready' | 'loading' | 'unavailable' {
		return getConversationSessionReadiness(this.roster);
	}

	isPairingHold(): boolean {
		const connection = this.connection as Partial<IUniverseAgentConnection>;
		if (typeof connection.getConnectionPhase !== 'function' || typeof connection.getConnectionSnapshot !== 'function') {
			return false;
		}
		return isConversationPairingHold(this.connection);
	}

	acquireSessionView(sessionId: string): IAgentSessionViewLease {
		const inner = this.roster.acquireSessionView(sessionId);
		let lease!: AgentSessionViewLease;
		lease = new AgentSessionViewLease(inner, () => this.liveLeases.delete(lease));
		if (this._store.isDisposed) {
			lease.dispose();
			return lease;
		}
		this.liveLeases.add(lease);
		return lease;
	}

	override dispose(): void {
		while (this.liveLeases.size > 0) {
			const leases = [...this.liveLeases];
			this.liveLeases.clear();
			for (const lease of leases) {
				lease.dispose();
			}
		}
		super.dispose();
	}
}
