/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { join } from '../../../../base/common/path.js';
import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { SessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { localize } from '../../../../nls.js';

/** Normalized file mutation record consumed from `IUniverseAgentConnection.onDidFileMutation` (PRD-023 §2.3). */
export interface IFileMutationRecord {
	readonly sessionId: string;
	readonly toolCallId: string;
	readonly turnId: string;
	readonly agentId: string;
	readonly path: string;
	readonly operation: string;
	readonly diffStats?: {
		readonly addedLines?: number;
		readonly removedLines?: number;
		readonly changedFiles?: number;
	};
}

/** Attribution fields needed for Turn n; superset of `ItemAttribution` once M6-A2 adds `toolCallId`. */
export interface IReviewItemAttribution {
	readonly role: 'user' | 'assistant' | 'system' | 'tool';
	readonly agentId?: string;
	readonly agentPath?: readonly string[];
	readonly toolCallId?: string;
}

export interface IReviewAttributionChip {
	readonly label: string;
	readonly toolCallId: string;
	readonly turnId: string;
	readonly overflow?: false;
}

export interface IReviewAttributionOverflowChip {
	readonly label: string;
	readonly overflow: true;
}

export type IReviewAttributionChipDisplay = IReviewAttributionChip | IReviewAttributionOverflowChip;

export const CONVERSATION_REVEAL_ITEM_COMMAND = 'conversation.revealItem';

export const ISourcesReviewAttributionService = createDecorator<ISourcesReviewAttributionService>('sourcesReviewAttributionService');

export interface ISourcesReviewAttributionService {
	readonly _serviceBrand: undefined;

	readonly onDidChange: Event<void>;

	/** False when never connected, work_dir mismatches, or active bucket is empty. */
	isAttributionEnabled(): boolean;

	/** §2.5 note when engine work_dir ≠ workspace; undefined when compatible or not connected. */
	getWorkDirMismatchNote(): string | undefined;

	/** Header suffix when engine is connected and attribution data exists for the active session. */
	getAttributionHeaderSuffix(): string | undefined;

	/** Lease attribution lookup for chip reveal; undefined when this file cannot find the step. */
	resolveRevealItemId(toolCallId: string): string | undefined;

	buildChipMapForEntries(entries: readonly { readonly resource: URI }[]): ReadonlyMap<string, readonly IReviewAttributionChipDisplay[]>;
}

export function normalizeReviewPath(path: string): string {
	return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

export function resolveMutationAbsolutePath(workDir: string, relativePath: string): string {
	return normalizeReviewPath(join(workDir, relativePath));
}

export function getWorkspaceFolderRoots(folders: readonly { readonly uri: URI }[]): URI[] {
	return folders.map(folder => folder.uri);
}

/** §2.5: engine work_dir must equal a workspace folder root. */
export function isWorkDirCompatible(workDir: string | undefined, workspaceRoots: readonly URI[]): boolean {
	if (!workDir) {
		return false;
	}
	const normalizedWorkDir = normalizeReviewPath(workDir);
	return workspaceRoots.some(root => root.scheme === 'file' && normalizeReviewPath(root.fsPath) === normalizedWorkDir);
}

export function resolveMutationResource(
	workDir: string,
	relativePath: string,
	workspaceRoots: readonly URI[],
): URI | undefined {
	const absolutePath = resolveMutationAbsolutePath(workDir, relativePath);
	const normalizedAbsolute = normalizeReviewPath(absolutePath);
	for (const root of workspaceRoots) {
		if (root.scheme !== 'file') {
			continue;
		}
		const rootPath = normalizeReviewPath(root.fsPath);
		if (normalizedAbsolute === rootPath || normalizedAbsolute.startsWith(`${rootPath}/`)) {
			return URI.file(absolutePath);
		}
	}
	return undefined;
}

export function findItemIdByToolCallId(
	attribution: ReadonlyMap<string, IReviewItemAttribution>,
	toolCallId: string,
): string | undefined {
	for (const [itemId, itemAttribution] of attribution) {
		if (itemAttribution.toolCallId === toolCallId) {
			return itemId;
		}
	}
	return undefined;
}

/** Turn n = user-role timeline items with orderKey ≤ tool item (PRD-023 §2.3). */
export function computeTurnNumber(
	snapshot: SessionViewSnapshot,
	attribution: ReadonlyMap<string, IReviewItemAttribution>,
	toolCallId: string,
): number | undefined {
	const itemId = findItemIdByToolCallId(attribution, toolCallId);
	if (!itemId) {
		return undefined;
	}

	const toolItem = snapshot.timeline.find(item => item.id === itemId);
	if (!toolItem) {
		return undefined;
	}

	let count = 0;
	for (const item of snapshot.timeline) {
		const itemAttribution = attribution.get(item.id);
		if (itemAttribution?.role === 'user' && item.orderKey <= toolItem.orderKey) {
			count++;
		}
	}
	return count > 0 ? count : undefined;
}

export function formatAgentDisplayName(record: IFileMutationRecord, attribution: ReadonlyMap<string, IReviewItemAttribution>): string {
	const itemId = findItemIdByToolCallId(attribution, record.toolCallId);
	const itemAttribution = itemId ? attribution.get(itemId) : undefined;
	const agentPath = itemAttribution?.agentPath;
	if (agentPath && agentPath.length > 0) {
		return agentPath[agentPath.length - 1]!;
	}
	return record.agentId;
}

export function formatAttributionChipLabel(
	turnNumber: number | undefined,
	agentName: string,
): string {
	if (turnNumber !== undefined) {
		return localize('sourcesReviewAttribution.chipTurnAgent', "Turn {0} · {1}", turnNumber, agentName);
	}
	return agentName;
}

export function filterRecordsForResource(
	records: readonly IFileMutationRecord[],
	resource: URI,
	workDir: string,
	workspaceRoots: readonly URI[],
): IFileMutationRecord[] {
	const normalizedResource = normalizeReviewPath(resource.fsPath);
	return records.filter(record => {
		const resolved = resolveMutationResource(workDir, record.path, workspaceRoots);
		return !!resolved && normalizeReviewPath(resolved.fsPath) === normalizedResource;
	});
}

/** Same path: dedupe by turnId, at most two chips plus optional +n overflow. */
export function buildAttributionChips(
	records: readonly IFileMutationRecord[],
	snapshot: SessionViewSnapshot,
	attribution: ReadonlyMap<string, IReviewItemAttribution>,
): readonly IReviewAttributionChipDisplay[] {
	const seenTurnIds = new Set<string>();
	const unique: IFileMutationRecord[] = [];
	for (const record of records) {
		if (seenTurnIds.has(record.turnId)) {
			continue;
		}
		seenTurnIds.add(record.turnId);
		unique.push(record);
	}

	const maxVisible = 2;
	const visible = unique.slice(0, maxVisible);
	const overflow = unique.length - visible.length;

	const chips: IReviewAttributionChipDisplay[] = visible.map(record => {
		const turnNumber = computeTurnNumber(snapshot, attribution, record.toolCallId);
		const agentName = formatAgentDisplayName(record, attribution);
		return {
			label: formatAttributionChipLabel(turnNumber, agentName),
			toolCallId: record.toolCallId,
			turnId: record.turnId,
			overflow: false as const,
		};
	});

	if (overflow > 0) {
		chips.push({
			label: localize('sourcesReviewAttribution.chipOverflow', "+{0}", overflow),
			overflow: true,
		});
	}

	return chips;
}

export function resolveRevealItemId(
	attribution: ReadonlyMap<string, IReviewItemAttribution>,
	toolCallId: string,
): string | undefined {
	return findItemIdByToolCallId(attribution, toolCallId);
}
