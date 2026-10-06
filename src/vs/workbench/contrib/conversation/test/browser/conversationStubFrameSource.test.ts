/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ConversationViewFrameApplied } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationStubFrameSource } from '../../browser/conversationStubFrameSource.js';
import { ConversationStubModel } from '../../browser/conversationStubModel.js';

suite('ConversationStubFrameSource', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('dispose before submit timeout does not land turns or emit late frames', async () => {
		const sessionId = 'stub-dispose-session';
		const model = new ConversationStubModel([{ id: sessionId, title: 'Dispose test', source: 'local', turns: [] }]);
		const source = store.add(new ConversationStubFrameSource(model, () => { }));
		const lease = store.add(source.acquire(sessionId));
		const applied: ConversationViewFrameApplied[] = [];
		store.add(lease.onDidApplyFrame(e => applied.push(e)));

		const turnsBefore = model.getTurns(sessionId).length;
		const outcome = await lease.post({ kind: 'submitInput', text: 'late should drop' });
		assert.strictEqual(outcome.accepted, true);
		assert.strictEqual(lease.snapshot.localPendingSends.length, 1);

		const appliedAfterPending = applied.length;
		source.dispose();

		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(model.getTurns(sessionId).length, turnsBefore);
		assert.strictEqual(applied.length, appliedAfterPending);
		assert.strictEqual(lease.snapshot.localPendingSends.length, 1);
	});
});
