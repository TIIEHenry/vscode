/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isUniverseAgentPublishedLinkOwner } from '../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
import { readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { AgentInspectLiveAgentIdSource, AgentInspectTarget, IAgentInspectService, IUniverseAgentConnectionOwner } from '../common/agentInspect.js';

export class AgentInspectService extends Disposable implements IAgentInspectService {

	declare readonly _serviceBrand: undefined;

	private target: AgentInspectTarget | undefined;
	private agentsLiveAgentIds: ReadonlySet<string> | undefined;
	private teamLiveAgentIds: ReadonlySet<string> | undefined;
	private agentsLiveAgentSessionId: string | undefined;
	private teamLiveAgentSessionId: string | undefined;
	private liveActivityIds: ReadonlySet<string> | undefined;
	private liveActivitySessionId: string | undefined;
	private liveTaskIds: ReadonlySet<string> | undefined;
	private liveTaskSessionId: string | undefined;

	private activeOwner: IUniverseAgentConnectionOwner | undefined;

	private readonly _onDidChangeTarget = this._register(new Emitter<AgentInspectTarget | undefined>());
	readonly onDidChangeTarget = this._onDidChangeTarget.event;

	private readonly _onDidChangeLiveAgentIds = this._register(new Emitter<void>());
	readonly onDidChangeLiveAgentIds = this._onDidChangeLiveAgentIds.event;

	constructor(
		@IUniverseAgentConnection private readonly uaConnection?: IUniverseAgentConnection,
	) {
		super();
		if (this.uaConnection) {
			this.activeOwner = this.captureCurrentOwner();
			this._register(this.uaConnection.onDidChangeConnection(() => this.handleConnectionChange()));
		}
	}

	getActiveOwner(): IUniverseAgentConnectionOwner | undefined {
		return this.activeOwner;
	}

	private captureCurrentOwner(): IUniverseAgentConnectionOwner | undefined {
		if (!this.uaConnection) {
			return undefined;
		}
		const snapshot = this.uaConnection.getConnectionSnapshot?.();
		const owner = {
			engineIdentityId: readPublishedEngineIdentityId(snapshot),
			linkId: readPublishedLinkId(snapshot),
		};
		return isUniverseAgentPublishedLinkOwner(owner) ? owner : undefined;
	}

	private areOwnersEqual(a: IUniverseAgentConnectionOwner | undefined, b: IUniverseAgentConnectionOwner | undefined): boolean {
		if (a === b) {
			return true;
		}
		if (!a || !b) {
			return false;
		}
		return a.linkId === b.linkId && a.engineIdentityId === b.engineIdentityId;
	}

	private matchesCurrentOwner(owner: IUniverseAgentConnectionOwner): boolean {
		const current = this.activeOwner ?? this.captureCurrentOwner();
		if (!current) {
			return false;
		}
		return current.linkId === owner.linkId && current.engineIdentityId === owner.engineIdentityId;
	}

	private isConnectingPhase(): boolean {
		if (!this.uaConnection) {
			return false;
		}
		const snapshot = this.uaConnection.getConnectionSnapshot?.();
		if (snapshot?.phase?.kind === 'connecting') {
			return true;
		}
		const phase = this.uaConnection.getConnectionPhase?.();
		return phase?.kind === 'connecting';
	}

	private handleConnectionChange(): void {
		const newOwner = this.captureCurrentOwner();
		if (this.activeOwner === undefined) {
			if (newOwner !== undefined) {
				this.activeOwner = newOwner;
				if (this.target && this.target.expectedOwner === undefined) {
					this.target = { ...this.target, expectedOwner: newOwner };
					this._onDidChangeTarget.fire(this.target);
				} else if (this.target && this.target.expectedOwner !== undefined && !this.areOwnersEqual(this.target.expectedOwner, newOwner)) {
					this.target = undefined;
					this._onDidChangeTarget.fire(undefined);
				}
			}
			return;
		}

		if (newOwner === undefined && this.isConnectingPhase()) {
			return;
		}

		if (!this.areOwnersEqual(this.activeOwner, newOwner)) {
			this.activeOwner = newOwner;
			this.invalidateAll();
		}
	}

	private invalidateAll(): void {
		if (this.target !== undefined) {
			this.target = undefined;
			this._onDidChangeTarget.fire(undefined);
		}
		let liveIdsChanged = false;
		if (this.agentsLiveAgentIds !== undefined || this.agentsLiveAgentSessionId !== undefined) {
			this.agentsLiveAgentIds = undefined;
			this.agentsLiveAgentSessionId = undefined;
			liveIdsChanged = true;
		}
		if (this.teamLiveAgentIds !== undefined || this.teamLiveAgentSessionId !== undefined) {
			this.teamLiveAgentIds = undefined;
			this.teamLiveAgentSessionId = undefined;
			liveIdsChanged = true;
		}
		if (this.liveActivityIds !== undefined || this.liveActivitySessionId !== undefined) {
			this.liveActivityIds = undefined;
			this.liveActivitySessionId = undefined;
			liveIdsChanged = true;
		}
		if (this.liveTaskIds !== undefined || this.liveTaskSessionId !== undefined) {
			this.liveTaskIds = undefined;
			this.liveTaskSessionId = undefined;
			liveIdsChanged = true;
		}
		if (liveIdsChanged) {
			this._onDidChangeLiveAgentIds.fire();
		}
	}

	private isSameTarget(a: AgentInspectTarget | undefined, b: AgentInspectTarget | undefined): boolean {
		if (a === b) {
			return true;
		}
		if (!a || !b) {
			return false;
		}
		if (a.kind !== b.kind || a.sessionId !== b.sessionId) {
			return false;
		}
		if (!this.areOwnersEqual(a.expectedOwner, b.expectedOwner)) {
			return false;
		}
		switch (a.kind) {
			case 'agent':
				return b.kind === 'agent' && a.node === b.node;
			case 'member':
				return b.kind === 'member' && a.info === b.info;
			case 'task':
				return b.kind === 'task' && a.task === b.task;
			case 'activity':
				return b.kind === 'activity' && a.item === b.item;
		}
	}

	getTarget(): AgentInspectTarget | undefined {
		return this.target;
	}

	setTarget(target: AgentInspectTarget | undefined): void {
		if (target && target.expectedOwner !== undefined) {
			if (!this.matchesCurrentOwner(target.expectedOwner)) {
				return;
			}
		}
		const boundTarget = target && target.expectedOwner === undefined && this.activeOwner !== undefined
			? { ...target, expectedOwner: this.activeOwner }
			: target;
		if (this.isSameTarget(this.target, boundTarget)) {
			return;
		}
		this.target = boundTarget;
		this._onDidChangeTarget.fire(this.target);
	}

	setLiveAgentIds(source: AgentInspectLiveAgentIdSource, ids: ReadonlySet<string> | undefined, sessionId?: string, owner?: IUniverseAgentConnectionOwner): void {
		if (owner !== undefined && !this.matchesCurrentOwner(owner)) {
			return;
		}
		if (this.isConnectingPhase()) {
			return;
		}
		if (source === 'agents') {
			if (this.agentsLiveAgentIds === ids && this.agentsLiveAgentSessionId === sessionId) {
				return;
			}
			this.agentsLiveAgentIds = ids;
			this.agentsLiveAgentSessionId = sessionId;
		} else {
			if (this.teamLiveAgentIds === ids && this.teamLiveAgentSessionId === sessionId) {
				return;
			}
			this.teamLiveAgentIds = ids;
			this.teamLiveAgentSessionId = sessionId;
		}
		this._onDidChangeLiveAgentIds.fire();
	}

	getLiveAgentIds(): ReadonlySet<string> | undefined {
		if (this.agentsLiveAgentIds === undefined && this.teamLiveAgentIds === undefined) {
			return undefined;
		}
		const union = new Set<string>();
		if (this.agentsLiveAgentIds) {
			for (const id of this.agentsLiveAgentIds) {
				union.add(id);
			}
		}
		if (this.teamLiveAgentIds) {
			for (const id of this.teamLiveAgentIds) {
				union.add(id);
			}
		}
		return union;
	}

	getLiveAgentIdsFor(source: AgentInspectLiveAgentIdSource): ReadonlySet<string> | undefined {
		return source === 'agents' ? this.agentsLiveAgentIds : this.teamLiveAgentIds;
	}

	getLiveAgentIdsSession(source: AgentInspectLiveAgentIdSource): string | undefined {
		return source === 'agents' ? this.agentsLiveAgentSessionId : this.teamLiveAgentSessionId;
	}

	setLiveActivityIds(ids: ReadonlySet<string> | undefined, sessionId?: string, owner?: IUniverseAgentConnectionOwner): void {
		if (owner !== undefined && !this.matchesCurrentOwner(owner)) {
			return;
		}
		if (this.isConnectingPhase()) {
			return;
		}
		if (this.liveActivityIds === ids && this.liveActivitySessionId === sessionId) {
			return;
		}
		this.liveActivityIds = ids;
		this.liveActivitySessionId = sessionId;
		this._onDidChangeLiveAgentIds.fire();
	}

	getLiveActivityIds(): ReadonlySet<string> | undefined {
		return this.liveActivityIds;
	}

	getLiveActivityIdsSession(): string | undefined {
		return this.liveActivitySessionId;
	}

	setLiveTaskIds(ids: ReadonlySet<string> | undefined, sessionId?: string, owner?: IUniverseAgentConnectionOwner): void {
		if (owner !== undefined && !this.matchesCurrentOwner(owner)) {
			return;
		}
		if (this.isConnectingPhase()) {
			return;
		}
		if (this.liveTaskIds === ids && this.liveTaskSessionId === sessionId) {
			return;
		}
		this.liveTaskIds = ids;
		this.liveTaskSessionId = sessionId;
		this._onDidChangeLiveAgentIds.fire();
	}

	getLiveTaskIds(): ReadonlySet<string> | undefined {
		return this.liveTaskIds;
	}

	getLiveTaskIdsSession(): string | undefined {
		return this.liveTaskSessionId;
	}
}

registerSingleton(IAgentInspectService, AgentInspectService as any, InstantiationType.Delayed);
