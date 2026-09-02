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
	if ('title' in summary) {
		return summary.title;
	}
	return '';
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
	};
}

export function collectNavigatorActivityItems(
	snapshot: SessionViewSnapshot,
	attribution: ReadonlyMap<string, ItemAttribution>,
): INavigatorAgentsActivityItem[] {
	const byId = new Map<string, INavigatorAgentsActivityItem>();

	for (const item of snapshot.timeline) {
		const id = String(item.id);
		const activity = buildActivityItem(id, item.summary, attribution);
		if (activity) {
			byId.set(id, activity);
		}
	}

	for (const block of snapshot.overlay.blocks) {
		const id = overlayAttributionKey(String(block.blockId));
		const activity = buildActivityItem(id, block.summary, attribution);
		if (activity) {
			byId.set(id, { ...activity, id, itemId: id });
		}
	}

	const sorted = [...byId.values()].sort((a, b) => {
		if (a.id < b.id) {
			return 1;
		}
		if (a.id > b.id) {
			return -1;
		}
		return 0;
	});

	return sorted.slice(0, NAVIGATOR_ACTIVITY_MAX_ITEMS);
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
