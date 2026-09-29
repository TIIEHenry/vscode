/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { overlayAttributionKey, type ItemAttribution } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SessionViewSnapshot, TimelineItemSummary } from '../../../../platform/universeAgent/common/sessionView/index.js';

export const NAVIGATOR_ACTIVITY_MAX_ITEMS = 200;

export interface INavigatorAgentsActivityItem {
	readonly id: string;
	readonly label: string;
	readonly toolName: string;
	readonly agentId?: string;
	readonly status: string;
	readonly itemId: string;
	readonly argPreview?: string;
	readonly resultPreview?: string;
}

function toolStatusFromSummary(summary: TimelineItemSummary): string {
	if (summary.kind !== 'tool') {
		return '';
	}
	return summary.status ?? summary.title;
}

function toolNameFromSummary(summary: TimelineItemSummary): string {
	if (summary.kind === 'tool') {
		return summary.toolName ?? summary.title;
	}
	if (summary.kind === 'unknown') {
		return '';
	}
	return summary.title;
}

function buildActivityItem(
	itemId: string,
	summary: TimelineItemSummary,
	attribution: ReadonlyMap<string, ItemAttribution>,
): INavigatorAgentsActivityItem | undefined {
	if (summary.kind !== 'tool') {
		return undefined;
	}
	const attr = attribution.get(itemId);
	const toolName = toolNameFromSummary(summary);
	const status = toolStatusFromSummary(summary);
	const agentId = attr?.agentId;
	const labelParts = [toolName];
	if (agentId) {
		labelParts.push(agentId);
	}
	if (status) {
		labelParts.push(status);
	}
	return {
		id: itemId,
		itemId,
		toolName,
		agentId,
		status,
		label: labelParts.join(' · '),
		argPreview: summary.argPreview,
		resultPreview: summary.resultPreview,
	};
}

export function collectNavigatorActivityItems(
	snapshot: SessionViewSnapshot,
	attribution: ReadonlyMap<string, ItemAttribution>,
): INavigatorAgentsActivityItem[] {
	// Timeline order, then overlay ids not already seen. Do not sort by id or orderKey.
	// Keep the tail and reverse so the newest row is first.
	const seen = new Set<string>();
	const ordered: INavigatorAgentsActivityItem[] = [];
	const pushTool = (id: string, summary: TimelineItemSummary): void => {
		if (seen.has(id)) {
			return;
		}
		const activity = buildActivityItem(id, summary, attribution);
		if (!activity) {
			return;
		}
		seen.add(id);
		ordered.push(activity);
	};

	for (const item of snapshot.timeline) {
		pushTool(String(item.id), item.summary);
	}
	for (const block of snapshot.overlay.blocks) {
		pushTool(overlayAttributionKey(String(block.blockId)), block.summary);
	}

	return ordered.slice(-NAVIGATOR_ACTIVITY_MAX_ITEMS).reverse();
}

export function navigatorActivityTruncated(
	snapshot: SessionViewSnapshot,
): boolean {
	let count = 0;
	for (const item of snapshot.timeline) {
		if (item.summary.kind === 'tool') {
			count++;
		}
	}
	for (const block of snapshot.overlay.blocks) {
		if (block.summary.kind === 'tool') {
			count++;
		}
	}
	return count > NAVIGATOR_ACTIVITY_MAX_ITEMS;
}
