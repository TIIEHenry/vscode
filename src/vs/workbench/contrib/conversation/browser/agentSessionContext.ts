/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IAgentSessionContext, IAgentSessionViewLease } from '../../../services/agentSession/common/agentSessionContext.js';
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

	private readonly liveLeases = new Set<AgentSessionViewLease>();

	constructor(
		@IConversationRosterService private readonly roster: IConversationRosterService,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
	) {
		super();
		this._register(this.roster.onDidChangeActiveSession(sessionId => this._onDidChangeActiveSession.fire(sessionId)));
		this._register(this.roster.onDidChangeSession(sessionId => this._onDidChangeSession.fire(sessionId)));
	}

	getActiveSessionId(): string {
		return this.roster.getActiveSessionId();
	}

	isEngineSessionReady(): boolean {
		return this.roster.isEngineSessionReady();
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
		const leases = [...this.liveLeases];
		this.liveLeases.clear();
		for (const lease of leases) {
			lease.dispose();
		}
		super.dispose();
	}
}
