/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { emptySessionViewSnapshot, type SessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { attachReviewEntries, type IReviewNavRecord } from './conversationReviewEntry.js';
import type { ConversationTimelineEntry } from './conversationSessionView.js';

suite('conversationReviewEntry attach (browser)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const WORKSPACE_ROOT = URI.file('/home/test/project');

	function makeSnapshot(timeline: SessionViewSnapshot['timeline']): SessionViewSnapshot {
		return {
			...emptySessionViewSnapshot('session-1' as SessionViewSnapshot['sessionId']),
			sync: { kind: 'live' },
			timeline,
		};
	}

	test('reviewNav inserts after derived multi-tool rows, not only snapshot timeline ids', () => {
		const turnId = 'turn-1' as SessionViewSnapshot['timeline'][number]['turnId'];
		const snapshot = makeSnapshot([
			{ id: 'u1' as SessionViewSnapshot['timeline'][number]['id'], orderKey: '0000000000000001', turnId, summary: { kind: 'text', title: 'You', preview: 'hi' } },
			{ id: 'tool-1' as SessionViewSnapshot['timeline'][number]['id'], orderKey: '0000000000000002', turnId, summary: { kind: 'tool', title: 'write', toolName: 'write', status: 'completed' } },
		]);
		const entries: ConversationTimelineEntry[] = [
			{ id: 'u1', kind: 'user', text: 'hi', turnId: 'turn-1' },
			{ id: 'tool-1', kind: 'tool', text: 'write-a', toolName: 'write', turnId: 'turn-1' },
			{ id: 'tool-1:tool:1', kind: 'tool', text: 'write-b', toolName: 'write', turnId: 'turn-1' },
		];
		const nav: IReviewNavRecord = {
			sessionId: 'session-1',
			turnId: 'turn-1',
			paths: [URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()],
		};
		const attached = attachReviewEntries(entries, snapshot, [nav]);
		const navIndex = attached.findIndex(entry => entry.kind === 'reviewNav');
		const lastToolIndex = attached.findIndex(entry => entry.id === 'tool-1:tool:1');
		assert.ok(navIndex > lastToolIndex, 'reviewNav must follow the last projected row for the turn');
	});
});
