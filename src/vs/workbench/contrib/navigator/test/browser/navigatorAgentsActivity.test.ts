/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { overlayAttributionKey } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import {
	collectNavigatorActivityItems,
	NAVIGATOR_ACTIVITY_MAX_ITEMS,
	navigatorActivityTruncated,
} from '../../common/navigatorAgentsActivity.js';

suite('NavigatorAgentsActivity (N3)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function toolSnapshot(overlayOnly = false): SessionViewSnapshot {
		const timeline = overlayOnly ? [] : [{
			id: 'tool-1' as SessionViewSnapshot['timeline'][number]['id'],
			orderKey: '1',
			summary: { kind: 'tool' as const, title: 'Run', toolName: 'grep', status: 'completed' as const },
		}];
		const overlay = {
			blocks: [{
				blockId: 'blk-1' as SessionViewSnapshot['overlay']['blocks'][number]['blockId'],
				orderKey: '2',
				summary: { kind: 'tool' as const, title: 'Run', toolName: 'write', status: 'running' as const },
				chunks: [],
			}],
		};
		return {
			sessionId: 's1' as SessionViewSnapshot['sessionId'],
			sync: { kind: 'idle' },
			timeline,
			overlay,
			pendingActions: [],
			localPendingSends: [],
		};
	}

	test('overlay-only tool rows appear in activity list', () => {
		const snapshot = toolSnapshot(true);
		const attribution = new Map<string, { role: 'tool'; agentId: string }>([
			[overlayAttributionKey('blk-1'), { role: 'tool', agentId: 'sub:a' }],
		]);
		const items = collectNavigatorActivityItems(snapshot, attribution);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0]?.toolName, 'write');
	});

	test('dedupes timeline and overlay by item id', () => {
		const snapshot = toolSnapshot(false);
		const attribution = new Map([
			['tool-1', { role: 'tool' as const, agentId: 'root' }],
			[overlayAttributionKey('blk-1'), { role: 'tool' as const, agentId: 'root' }],
		]);
		const items = collectNavigatorActivityItems(snapshot, attribution);
		assert.strictEqual(items.length, 2);
	});

	test('truncates beyond 200 items', () => {
		const timeline = Array.from({ length: NAVIGATOR_ACTIVITY_MAX_ITEMS + 5 }, (_, i) => ({
			id: `t-${i}` as SessionViewSnapshot['timeline'][number]['id'],
			orderKey: String(i),
			summary: { kind: 'tool' as const, title: 'x', toolName: 'x', status: 'completed' as const },
		}));
		const snapshot: SessionViewSnapshot = {
			...toolSnapshot(false),
			timeline,
		};
		assert.strictEqual(navigatorActivityTruncated(snapshot), true);
		const items = collectNavigatorActivityItems(snapshot, new Map());
		assert.strictEqual(items.length, NAVIGATOR_ACTIVITY_MAX_ITEMS);
	});
});
