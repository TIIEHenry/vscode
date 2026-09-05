/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ConversationWriteMessage, DetailFetchOutcome, PostOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { IUniverseAgentSessionView } from '../../../../../platform/universeAgent/common/universeAgentSessionView.js';
import { ConversationEngineFrameSource } from '../../browser/conversationEngineFrameSource.js';

class MockUniverseAgentSessionView implements IUniverseAgentSessionView {
	declare readonly _serviceBrand: undefined;
	readonly onDidApplyFrame = Event.None;
	acquireLeaseFn: (sessionId: string) => Promise<string> = async sessionId => `lease:${sessionId}`;
	postFn: (leaseId: string, msg: ConversationWriteMessage) => Promise<PostOutcome> = async () => ({
		accepted: true,
		correlation: { id: 'host-corr' },
	});
	lastPost: { readonly leaseId: string; readonly msg: ConversationWriteMessage } | undefined;

	async acquireLease(sessionId: string): Promise<string> {
		return this.acquireLeaseFn(sessionId);
	}

	async releaseLease(_leaseId: string): Promise<void> { }

	async post(leaseId: string, msg: ConversationWriteMessage): Promise<PostOutcome> {
		this.lastPost = { leaseId, msg };
		return this.postFn(leaseId, msg);
	}

	async requestResync(_leaseId: string): Promise<void> { }

	async acknowledge(_leaseId: string, _ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }): Promise<void> { }

	async requestDetail(_leaseId: string, _ref: string): Promise<DetailFetchOutcome> {
		return { ok: false, reason: 'unavailable' };
	}
}

suite('ConversationEngineFrameSource post outcome', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('returns the host PostOutcome instead of inventing accepted', async () => {
		const sessionView = new MockUniverseAgentSessionView();
		sessionView.postFn = async () => ({ accepted: false, reason: 'mailbox_full' });
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-a'));

		const outcome = await lease.post({ kind: 'submitInput', text: 'hello' });
		assert.deepStrictEqual(outcome, { accepted: false, reason: 'mailbox_full' });
		assert.strictEqual(sessionView.lastPost?.leaseId, 'lease:sess-a');
		assert.deepStrictEqual(sessionView.lastPost?.msg, { kind: 'submitInput', text: 'hello' });
	});

	test('surfaces not_authenticated from the host', async () => {
		const sessionView = new MockUniverseAgentSessionView();
		sessionView.postFn = async () => ({ accepted: false, reason: 'not_authenticated' });
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-b'));

		assert.deepStrictEqual(await lease.post({ kind: 'submitInput', text: 'x' }), {
			accepted: false,
			reason: 'not_authenticated',
		});
	});

	test('returns host correlation when accepted', async () => {
		const sessionView = new MockUniverseAgentSessionView();
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-c'));

		assert.deepStrictEqual(await lease.post({ kind: 'submitInput', text: 'ok' }), {
			accepted: true,
			correlation: { id: 'host-corr' },
		});
	});

	test('waits for acquireLease then still returns the host rejection', async () => {
		const sessionView = new MockUniverseAgentSessionView();
		let resolveAcquire!: (id: string) => void;
		sessionView.acquireLeaseFn = () => new Promise<string>(resolve => {
			resolveAcquire = resolve;
		});
		sessionView.postFn = async () => ({ accepted: false, reason: 'no_such_session' });
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-d'));

		const pending = lease.post({ kind: 'submitInput', text: 'queued' });
		assert.strictEqual(sessionView.lastPost, undefined);
		resolveAcquire('lease:sess-d');

		assert.deepStrictEqual(await pending, { accepted: false, reason: 'no_such_session' });
		assert.strictEqual(sessionView.lastPost?.leaseId, 'lease:sess-d');
	});

	test('acquireLease failure is no_such_session, not silent accepted', async () => {
		const sessionView = new MockUniverseAgentSessionView();
		sessionView.acquireLeaseFn = async () => {
			throw new Error('acquire failed');
		};
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-e'));

		assert.deepStrictEqual(await lease.post({ kind: 'submitInput', text: 'nope' }), {
			accepted: false,
			reason: 'no_such_session',
		});
		assert.strictEqual(sessionView.lastPost, undefined);
	});
});
