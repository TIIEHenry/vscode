/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { AgentInspectLiveAgentIdSource, AgentInspectTarget, IAgentInspectService } from '../common/agentInspect.js';

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

	private readonly _onDidChangeTarget = this._register(new Emitter<AgentInspectTarget | undefined>());
	readonly onDidChangeTarget = this._onDidChangeTarget.event;

	private readonly _onDidChangeLiveAgentIds = this._register(new Emitter<void>());
	readonly onDidChangeLiveAgentIds = this._onDidChangeLiveAgentIds.event;

	getTarget(): AgentInspectTarget | undefined {
		return this.target;
	}

	setTarget(target: AgentInspectTarget | undefined): void {
		if (this.target === target) {
			return;
		}
		this.target = target;
		this._onDidChangeTarget.fire(this.target);
	}

	setLiveAgentIds(source: AgentInspectLiveAgentIdSource, ids: ReadonlySet<string> | undefined, sessionId?: string): void {
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

	setLiveActivityIds(ids: ReadonlySet<string> | undefined, sessionId?: string): void {
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

	setLiveTaskIds(ids: ReadonlySet<string> | undefined, sessionId?: string): void {
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

registerSingleton(IAgentInspectService, AgentInspectService, InstantiationType.Delayed);
