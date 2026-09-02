/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { timeout } from '../../../base/common/async.js';
import { GrpcStatusCode, UniverseAgentTransportError } from './grpc/grpcTransport.js';
import type { UniverseAgentAgentTreeNode } from '../common/universeAgentTypes.js';
import type { AgentTreeNodeBound } from './sessionCore/local-fact.js';

const TREE_DEBOUNCE_MS = 250;

export type AgentTreeFetchTransport = {
	fetchAgentTree(sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined>;
};

type AgentTreeBoundFact = { readonly kind: 'agentTreeBound' } & AgentTreeNodeBound;

export type { AgentTreeBoundFact };

export function mapAgentTreeToBound(node: UniverseAgentAgentTreeNode): AgentTreeBoundFact {
	const base = mapAgentTreeNode(node);
	return { kind: 'agentTreeBound', ...base };
}

function mapAgentTreeNode(node: UniverseAgentAgentTreeNode): Omit<AgentTreeNodeBound, 'kind'> {
	return {
		agentId: node.agentId,
		name: node.name,
		type: node.type,
		status: node.status,
		model: node.model,
		turnCount: node.turnCount,
		createdAt: node.createdAt,
		children: node.children.map(mapAgentTreeNode),
	};
}

/**
 * Debounced AgentService.Tree pull with in-flight dedup (m6 §11 A2).
 */
export class AgentTreeCoordinator {

	private treeFetchCount = 0;
	private agentTreeUnsupported = false;
	private debounceHandle: ReturnType<typeof setTimeout> | undefined;
	private inFlight: Promise<AgentTreeBoundFact | undefined> | undefined;

	constructor(
		private readonly sessionId: string,
		private readonly transport: AgentTreeFetchTransport,
	) {
	}

	get fetchCount(): number {
		return this.treeFetchCount;
	}

	isUnsupported(): boolean {
		return this.agentTreeUnsupported;
	}

	scheduleRefresh(onBound: (fact: AgentTreeBoundFact) => void): void {
		if (this.agentTreeUnsupported) {
			return;
		}
		if (this.debounceHandle) {
			clearTimeout(this.debounceHandle);
		}
		this.debounceHandle = setTimeout(() => {
			this.debounceHandle = undefined;
			void this.pullNow(onBound);
		}, TREE_DEBOUNCE_MS);
	}

	async pullNow(onBound: (fact: AgentTreeBoundFact) => void): Promise<AgentTreeBoundFact | undefined> {
		if (this.agentTreeUnsupported) {
			return undefined;
		}
		if (this.inFlight) {
			return this.inFlight;
		}
		this.treeFetchCount += 1;
		this.inFlight = this.doFetch(onBound).finally(() => {
			this.inFlight = undefined;
		});
		return this.inFlight;
	}

	private async doFetch(onBound: (fact: AgentTreeBoundFact) => void): Promise<AgentTreeBoundFact | undefined> {
		try {
			const root = await this.transport.fetchAgentTree(this.sessionId);
			if (!root) {
				return undefined;
			}
			const fact = mapAgentTreeToBound(root);
			onBound(fact);
			return fact;
		} catch (error) {
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this.agentTreeUnsupported = true;
			}
			return undefined;
		}
	}

	dispose(): void {
		if (this.debounceHandle) {
			clearTimeout(this.debounceHandle);
			this.debounceHandle = undefined;
		}
	}
}

/** Test helper: flush debounce without waiting real time. */
export async function flushAgentTreeCoordinator(_coordinator: AgentTreeCoordinator): Promise<void> {
	await timeout(0);
	await timeout(TREE_DEBOUNCE_MS + 10);
}
