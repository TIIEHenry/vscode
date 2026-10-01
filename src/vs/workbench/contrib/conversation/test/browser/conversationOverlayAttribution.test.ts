/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { overlayAttributionKey, type AttributionPatch } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { OverlayBlockId, ViewPatch } from '../../../../../platform/universeAgent/common/sessionView/types.js';
import type { ConversationTimelineEntry } from '../../browser/conversationSessionView.js';
import { createStreamHarness, type StreamHarness } from './streamHarness.js';

/**
 * Live overlay rows follow the same role rule as timeline text
 * (dev/plans/conversation-stream-timeline.md §3.3). The host writes `assistant`
 * for L3; a text overlay that arrives with no attribution stays neutral.
 */
suite('Conversation overlay attribution', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function entry(h: StreamHarness, id: string): ConversationTimelineEntry {
		const found = h.entries().find(row => row.id === id);
		assert.ok(found, id);
		return found;
	}

	test('assistant attribution on an overlay still renders assistant', async () => {
		const h = createStreamHarness(store);
		h.view.baseline();
		const opened = h.view.openAssistantOverlay('b1', '0000000002');
		h.view.patches([opened.patch], { attribution: [opened.attribution] });
		await h.settle();

		const row = entry(h, 'overlay:b1');
		assert.strictEqual(row.kind, 'assistant');
		assert.strictEqual(row.streaming, true);
		assert.strictEqual(row.readOnlyText, undefined);
		assert.strictEqual(h.rowKind('overlay:b1'), 'assistant');
	});

	test('a text overlay with no attribution renders neutral, not assistant', async () => {
		const h = createStreamHarness(store);
		h.view.baseline();
		const opened = h.view.openAssistantOverlay('b1', '0000000002');
		h.view.patches([opened.patch]);
		await h.settle();

		const row = entry(h, 'overlay:b1');
		assert.strictEqual(row.kind, 'system');
		assert.strictEqual(row.readOnlyText, 'neutral');
		assert.notStrictEqual(row.kind, 'assistant');
		assert.strictEqual(row.streaming, true);
		assert.strictEqual(row.text, 'Assistant');
		assert.strictEqual(h.rowKind('overlay:b1'), 'neutral');
	});

	test('text overlay role user renders user and stays streaming', async () => {
		const h = createStreamHarness(store);
		h.view.baseline();
		const opened = h.view.openAssistantOverlay('b1', '0000000002');
		const attribution: AttributionPatch = {
			op: 'upsertAttribution',
			itemId: overlayAttributionKey('b1'),
			attribution: { role: 'user' },
		};
		h.view.patches([opened.patch], { attribution: [attribution] });
		await h.settle();

		const row = entry(h, 'overlay:b1');
		assert.strictEqual(row.kind, 'user');
		assert.strictEqual(row.readOnlyText, undefined);
		assert.strictEqual(row.streaming, true);
		assert.strictEqual(h.rowKind('overlay:b1'), 'user');
	});

	test('reasoning overlay is thinking and tool overlay is tool, with or without a role', async () => {
		const h = createStreamHarness(store);
		h.view.baseline();
		const patches: ViewPatch[] = [
			{
				op: 'upsertOverlayBlock',
				block: {
					blockId: 'think' as OverlayBlockId,
					orderKey: '0000000002',
					summary: { kind: 'reasoning', title: 'Thinking', streaming: true },
					chunks: [],
				},
			},
			{
				op: 'upsertOverlayBlock',
				block: {
					blockId: 'tool' as OverlayBlockId,
					orderKey: '0000000003',
					summary: { kind: 'tool', title: 'read', toolName: 'read', status: 'running' },
					chunks: [],
				},
			},
		];
		h.view.patches(patches);
		await h.settle();

		const thinking = entry(h, 'overlay:think');
		assert.strictEqual(thinking.kind, 'thinking');
		assert.strictEqual(thinking.streaming, true);
		assert.strictEqual(thinking.readOnlyText, undefined);
		const tool = entry(h, 'overlay:tool');
		assert.strictEqual(tool.kind, 'tool');
		assert.strictEqual(tool.streaming, true);
		assert.strictEqual(tool.toolName, 'read');
		assert.strictEqual(tool.readOnlyText, undefined);
	});
});
