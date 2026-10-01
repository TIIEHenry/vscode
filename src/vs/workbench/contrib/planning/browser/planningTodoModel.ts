/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';
import type { SessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/types.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentTodoItem, UniverseAgentTodoRequest, UniverseAgentTodoResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';

/**
 * Root agent id from the session view.
 *
 * `liveAgentTree.agentId` is the admitted FetchAgentTree root (`agentTreeBound`).
 * `rootAgentBound` / `liveRootAgentId` stay on the session actor and are not on
 * the snapshot; connection-up also stamps the conversation chat id `default`,
 * which is not this view. Absent or blank tree root → undefined. Never invent an id.
 */
export function readSessionViewRootAgentId(snapshot: SessionViewSnapshot): string | undefined {
	const agentId = snapshot.liveAgentTree?.agentId;
	if (typeof agentId !== 'string' || agentId.trim().length === 0) {
		return undefined;
	}
	return agentId;
}

export interface IPlanningTodoSessionView {
	readonly snapshot: SessionViewSnapshot;
	dispose(): void;
}

export interface IPlanningTodoLoadDeps {
	isEngineConnected(): boolean;
	getActiveSessionId(): string;
	acquireSessionView(sessionId: string): IPlanningTodoSessionView;
	getTodo?(request: UniverseAgentTodoRequest): Promise<UniverseAgentTodoResult>;
}

/** Fields the Planning editor paints. Other TodoItem fields stay on the wire result. */
export interface IPlanningTodoRow {
	readonly id: string;
	readonly content: string;
	readonly status: string;
	readonly blocked: string;
}

export type PlanningTodoViewState =
	| { readonly kind: 'no-session' }
	| { readonly kind: 'disconnected' }
	| { readonly kind: 'no-getTodo' }
	| { readonly kind: 'no-root-agent' }
	| { readonly kind: 'session-view-unavailable' }
	| { readonly kind: 'empty' }
	| { readonly kind: 'failed'; readonly message: string }
	| { readonly kind: 'items'; readonly items: readonly IPlanningTodoRow[] };

export function planningTodoDeps(connection: IUniverseAgentConnection, session: IAgentSessionContext): IPlanningTodoLoadDeps {
	const getTodo = connection.getTodo;
	return {
		isEngineConnected: () => connection.isEngineConnected(),
		getActiveSessionId: () => session.getActiveSessionId(),
		acquireSessionView: sessionId => session.acquireSessionView(sessionId),
		...(typeof getTodo === 'function' ? { getTodo: request => getTodo.call(connection, request) } : {}),
	};
}

/**
 * Load AgentService.Todo for the active session and the session-view root agent.
 * Not connected, missing `getTodo`, blank session, or no root id → zero calls.
 * An empty `items` array is {@link PlanningTodoViewState} `empty`, not `failed`.
 */
export async function loadPlanningTodos(deps: IPlanningTodoLoadDeps): Promise<PlanningTodoViewState> {
	if (!deps.isEngineConnected()) {
		return { kind: 'disconnected' };
	}

	const getTodo = deps.getTodo;
	if (typeof getTodo !== 'function') {
		return { kind: 'no-getTodo' };
	}

	const sessionId = deps.getActiveSessionId();
	if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
		return { kind: 'no-session' };
	}

	const root = readRootAgentId(deps, sessionId);
	if (!root.ok) {
		return { kind: 'session-view-unavailable' };
	}
	if (!root.agentId) {
		return { kind: 'no-root-agent' };
	}
	const agentId = root.agentId;

	try {
		const result = await getTodo({ sessionId, agentId });
		if (!result || !Array.isArray(result.items)) {
			return { kind: 'failed', message: localize('planningTodo.malformed', "Planning todos response has no item list.") };
		}
		if (result.items.length === 0) {
			return { kind: 'empty' };
		}
		return { kind: 'items', items: result.items.map(toPlanningTodoRow) };
	} catch (error) {
		return { kind: 'failed', message: getErrorMessage(error) };
	}
}

function readRootAgentId(deps: IPlanningTodoLoadDeps, sessionId: string): { readonly ok: true; readonly agentId: string | undefined } | { readonly ok: false } {
	let lease: IPlanningTodoSessionView | undefined;
	try {
		lease = deps.acquireSessionView(sessionId);
		return { ok: true, agentId: readSessionViewRootAgentId(lease.snapshot) };
	} catch {
		return { ok: false };
	} finally {
		lease?.dispose();
	}
}

function toPlanningTodoRow(item: UniverseAgentTodoItem): IPlanningTodoRow {
	return {
		id: readString(item?.id),
		content: readString(item?.content),
		status: readString(item?.status),
		blocked: readString(item?.blocked),
	};
}

function readString(value: unknown): string {
	return typeof value === 'string' ? value : '';
}
