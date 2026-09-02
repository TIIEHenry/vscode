/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { IFileMutationRecord } from '../common/universeAgentTypes.js';

type ToolCallBinding = {
	readonly turnId: string;
	readonly agentId: string;
};

type PendingMutation = {
	readonly toolCallId: string;
	readonly path: string;
	readonly operation: string;
	readonly diffStats?: IFileMutationRecord['diffStats'];
};

type EmittedKey = string;

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key);
	if (desc === undefined || !Object.hasOwn(desc, 'value')) {
		return undefined;
	}
	return desc.value;
}

function snakeToCamelKey(key: string): string {
	return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function readField(record: object, ...keys: string[]): unknown {
	for (const key of keys) {
		const value = readOwnDataValue(record, key);
		if (value !== undefined) {
			return value;
		}
		const camel = snakeToCamelKey(key);
		if (camel !== key) {
			const camelValue = readOwnDataValue(record, camel);
			if (camelValue !== undefined) {
				return camelValue;
			}
		}
	}
	return undefined;
}

function emitKey(record: Pick<IFileMutationRecord, 'toolCallId' | 'path' | 'operation' | 'turnId'>): EmittedKey {
	return `${record.toolCallId}:${record.path}:${record.operation}:${record.turnId}`;
}

/**
 * Session-scoped tool_call_id join table (m6 §11 / sources-review §8).
 * Produces IFileMutationRecord only after lifecycle binding; never raw L3 snapshots.
 */
export class FileMutationJoin {

	private readonly bindings = new Map<string, ToolCallBinding>();
	private readonly pending = new Map<string, PendingMutation[]>();
	private readonly emitted = new Set<EmittedKey>();
	private readonly records: IFileMutationRecord[] = [];

	constructor(private readonly sessionId: string) {
	}

	getRecords(): readonly IFileMutationRecord[] {
		return this.records;
	}

	handleStreamPayload(
		payload: unknown,
		onRecord: (record: IFileMutationRecord) => void,
		onTurnSettle?: (signal: { readonly runtimeTurnId: string; readonly assistantTurnId: string }) => void,
	): void {
		if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
			return;
		}
		const record = payload as Record<string, unknown>;

		const lifecycle = record.tool_call_lifecycle ?? record.toolCallLifecycle;
		if (lifecycle && typeof lifecycle === 'object') {
			this.onToolCallLifecycle(lifecycle as object, onRecord);
		}

		const snapshot = record.tool_runtime_snapshot ?? record.toolRuntimeSnapshot;
		if (snapshot && typeof snapshot === 'object') {
			this.onToolRuntimeSnapshot(snapshot as object, onRecord);
		}

		const overlay = record.runtime_overlay_snapshot ?? record.runtimeOverlaySnapshot;
		if (overlay && typeof overlay === 'object') {
			this.onRuntimeOverlaySnapshot(overlay as object, onRecord);
		}

		const turnCompleted = record.turn_completed ?? record.turnCompleted;
		if (turnCompleted && typeof turnCompleted === 'object') {
			this.onTurnCompleted(turnCompleted as object, onRecord, onTurnSettle);
		}
	}

	private onToolCallLifecycle(body: object, onRecord: (record: IFileMutationRecord) => void): void {
		const toolCallId = readField(body, 'tool_call_id', 'toolCallId');
		const turnId = readField(body, 'turn_id', 'turnId');
		const agentId = readField(body, 'agent_id', 'agentId');
		if (typeof toolCallId !== 'string' || !toolCallId
			|| typeof turnId !== 'string' || !turnId
			|| typeof agentId !== 'string' || !agentId) {
			return;
		}
		this.bindings.set(toolCallId, { turnId, agentId });
		const queued = this.pending.get(toolCallId);
		if (queued) {
			for (const pending of queued) {
				this.emitRecord({
					toolCallId,
					turnId,
					agentId,
					path: pending.path,
					operation: pending.operation,
					diffStats: pending.diffStats,
				}, onRecord);
			}
			this.pending.delete(toolCallId);
		}
	}

	private onToolRuntimeSnapshot(body: object, onRecord: (record: IFileMutationRecord) => void): void {
		const toolCallId = readField(body, 'tool_call_id', 'toolCallId');
		if (typeof toolCallId !== 'string' || !toolCallId) {
			return;
		}
		const payload = readField(body, 'payload');
		if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
			return;
		}
		const mutation = readField(payload as object, 'file_mutation_payload', 'fileMutationPayload');
		if (mutation === null || typeof mutation !== 'object' || Array.isArray(mutation)) {
			return;
		}
		const path = readField(mutation as object, 'path');
		const operation = readField(mutation as object, 'operation');
		if (typeof path !== 'string' || typeof operation !== 'string') {
			return;
		}
		const diffStatsRaw = readField(mutation as object, 'diff_stats', 'diffStats');
		let diffStats: IFileMutationRecord['diffStats'];
		if (diffStatsRaw && typeof diffStatsRaw === 'object' && !Array.isArray(diffStatsRaw)) {
			const added = readField(diffStatsRaw as object, 'added_lines', 'addedLines');
			const removed = readField(diffStatsRaw as object, 'removed_lines', 'removedLines');
			const changed = readField(diffStatsRaw as object, 'changed_files', 'changedFiles');
			diffStats = {
				addedLines: typeof added === 'number' ? added : 0,
				removedLines: typeof removed === 'number' ? removed : 0,
				changedFiles: typeof changed === 'number' ? changed : 0,
			};
		}
		const binding = this.bindings.get(toolCallId);
		if (!binding) {
			const list = this.pending.get(toolCallId) ?? [];
			list.push({ toolCallId, path, operation, diffStats });
			this.pending.set(toolCallId, list);
			return;
		}
		this.emitRecord({
			toolCallId,
			turnId: binding.turnId,
			agentId: binding.agentId,
			path,
			operation,
			diffStats,
		}, onRecord);
	}

	private onRuntimeOverlaySnapshot(body: object, onRecord: (record: IFileMutationRecord) => void): void {
		const snapshots = readField(body, 'tool_runtime_snapshots', 'toolRuntimeSnapshots');
		if (!Array.isArray(snapshots)) {
			return;
		}
		for (const snap of snapshots) {
			if (snap && typeof snap === 'object') {
				this.onToolRuntimeSnapshot(snap as object, onRecord);
			}
		}
	}

	private onTurnCompleted(
		body: object,
		onRecord: (record: IFileMutationRecord) => void,
		onTurnSettle?: (signal: { readonly runtimeTurnId: string; readonly assistantTurnId: string }) => void,
	): void {
		const assistantTurnId = readField(body, 'assistant_turn_id', 'assistantTurnId');
		if (typeof assistantTurnId !== 'string' || !assistantTurnId) {
			return;
		}
		const runtimeTurnId = readField(body, 'turn_id', 'turnId');
		if (typeof runtimeTurnId === 'string' && runtimeTurnId && onTurnSettle) {
			onTurnSettle({ runtimeTurnId, assistantTurnId });
		}
		for (const rec of [...this.records]) {
			if (typeof runtimeTurnId === 'string' && rec.turnId === runtimeTurnId) {
				this.reemitWithTurnId(rec, assistantTurnId, onRecord);
			}
		}
	}

	private reemitWithTurnId(
		rec: IFileMutationRecord,
		newTurnId: string,
		onRecord: (record: IFileMutationRecord) => void,
	): void {
		if (rec.turnId === newTurnId) {
			return;
		}
		const updated: IFileMutationRecord = { ...rec, turnId: newTurnId };
		const oldKey = emitKey(rec);
		const newKey = emitKey(updated);
		this.emitted.delete(oldKey);
		const idx = this.records.indexOf(rec);
		if (idx >= 0) {
			this.records[idx] = updated;
		}
		this.emitted.add(newKey);
		onRecord(updated);
	}

	private emitRecord(
		partial: Omit<IFileMutationRecord, 'sessionId'>,
		onRecord: (record: IFileMutationRecord) => void,
	): void {
		const record: IFileMutationRecord = { sessionId: this.sessionId, ...partial };
		const key = emitKey(record);
		if (this.emitted.has(key)) {
			return;
		}
		this.emitted.add(key);
		this.records.push(record);
		onRecord(record);
	}
}

/** Returns true when payload should trigger an Agent tree re-fetch (m6 §11). */
export function shouldRefreshAgentTree(payload: unknown): boolean {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return false;
	}
	const record = payload as Record<string, unknown>;
	return !!(
		record.sub_agent_activity
		|| record.subAgentActivity
		|| record.sub_agent_completed
		|| record.subAgentCompleted
		|| record.detached_child_phase
		|| record.detachedChildPhase
		|| record.multi_agent_status
		|| record.multiAgentStatus
		|| record.turn_lifecycle
		|| record.turnLifecycle
		|| record.branch_topology_notified
		|| record.branchTopologyNotified
	);
}

export function readTeamCreatedTeamId(payload: unknown): number | undefined {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return undefined;
	}
	const record = payload as Record<string, unknown>;
	const status = record.multi_agent_status ?? record.multiAgentStatus;
	if (status === null || typeof status !== 'object' || Array.isArray(status)) {
		return undefined;
	}
	const created = readField(status as object, 'team_created', 'teamCreated');
	if (created === null || typeof created !== 'object' || Array.isArray(created)) {
		return undefined;
	}
	const teamId = readField(created as object, 'team_id', 'teamId');
	return typeof teamId === 'number' && Number.isSafeInteger(teamId) ? teamId : undefined;
}

export function isMultiAgentStatusPayload(payload: unknown): boolean {
	if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
		return false;
	}
	const record = payload as Record<string, unknown>;
	return !!(record.multi_agent_status ?? record.multiAgentStatus);
}
