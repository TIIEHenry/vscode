/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { UniverseAgentQueueState } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ConversationEngineQueueReader, type ConversationQueueReadScope } from '../../browser/conversationEngineQueueReader.js';

suite('Conversation engine queue reader', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	let clock: sinon.SinonFakeTimers;
	setup(() => { clock = sinon.useFakeTimers(); });
	teardown(() => clock.restore());
	const scope: ConversationQueueReadScope = { engineIdentityId: 'engine', linkId: 1, leaseGeneration: 1, localSessionId: 'local', engineSessionId: 'actual', live: true, support: 'SUPPORTED' };
	const state = (version = '0'): UniverseAgentQueueState => ({ items: [], isPaused: false, isProcessing: false, pauseReason: 'NONE', version });
	const flush = async () => { for (let i = 0; i < 8; i++) { await Promise.resolve(); } };

	test('bind gates reads, uses actual engine id and polls after completion', async () => {
		const ids: string[] = [];
		const reader = store.add(new ConversationEngineQueueReader(async id => { ids.push(id); return state('9007199254740993'); }, () => {}));
		reader.update({ ...scope, engineSessionId: undefined }); await flush();
		assert.deepStrictEqual(ids, []); assert.strictEqual(reader.getState('local').readState, 'loading');
		reader.update(scope); await flush();
		assert.deepStrictEqual(ids, ['actual']); assert.strictEqual(reader.readyEngineSessionId('local'), 'actual');
		clock.tick(1000); await flush(); assert.deepStrictEqual(ids, ['actual', 'actual']);
		assert.strictEqual(reader.getState('local').version, '9007199254740993');
	});
	test('old link, engine and session results cannot paint new scope', async () => {
		const gates: DeferredPromise<UniverseAgentQueueState>[] = [];
		const reader = store.add(new ConversationEngineQueueReader(() => { const gate = new DeferredPromise<UniverseAgentQueueState>(); gates.push(gate); return gate.p; }, () => {}));
		reader.update(scope); reader.update({ ...scope, linkId: 2, engineSessionId: 'new' });
		await gates[0].complete(state('90')); await flush(); assert.strictEqual(reader.getState('local').readState, 'loading');
		await gates[1].complete(state('1')); await flush(); assert.strictEqual(reader.getState('local').version, '1');
		reader.update({ ...scope, engineIdentityId: 'other', localSessionId: 'other-local', engineSessionId: 'other' });
		assert.strictEqual(reader.getState('local').version, undefined);
		await gates[2].complete(state('2')); await flush(); assert.strictEqual(reader.getState('other-local').version, '2');
	});
	test('failure and version regression preserve snapshot and recover; disconnect and unsupported revoke writes', async () => {
		let result: UniverseAgentQueueState | Error = state('5');
		const reader = store.add(new ConversationEngineQueueReader(async () => { if (result instanceof Error) { throw result; } return result; }, () => {}));
		reader.update(scope); await flush();
		result = new Error('offline'); reader.refresh('local'); await flush();
		assert.strictEqual(reader.getState('local').readState, 'error'); assert.strictEqual(reader.getState('local').version, '5'); assert.strictEqual(reader.readyEngineSessionId('local'), undefined);
		result = state('4'); reader.refresh('local'); await flush(); assert.match(reader.getState('local').readError!, /backwards/);
		result = state('6'); reader.refresh('local'); await flush(); assert.strictEqual(reader.getState('local').readState, 'ready');
		reader.update({ ...scope, live: false, engineIdentityId: undefined, linkId: undefined });
		assert.strictEqual(reader.getState('local').readState, 'stale'); assert.strictEqual(reader.getState('local').version, '6');
		reader.update({ ...scope, support: 'UNSUPPORTED' }); assert.strictEqual(reader.getState('local').readState, 'unsupported'); assert.strictEqual(reader.readyEngineSessionId('local'), undefined);
	});
	test('mutation refresh during poll is not dropped and dispose discards late results', async () => {
		const gates: DeferredPromise<UniverseAgentQueueState>[] = [];
		const reader = store.add(new ConversationEngineQueueReader(() => { const gate = new DeferredPromise<UniverseAgentQueueState>(); gates.push(gate); return gate.p; }, () => {}));
		reader.update(scope); reader.refresh('local');
		await gates[0].complete(state('1')); await flush(); assert.strictEqual(gates.length, 2); assert.strictEqual(reader.getState('local').readState, 'loading');
		await gates[1].complete(state('2')); await flush(); assert.strictEqual(reader.getState('local').readState, 'ready');
		clock.tick(1000); assert.strictEqual(gates.length, 3); reader.dispose();
		await gates[2].complete(state('3')); await flush(); assert.strictEqual(reader.getState('local').version, '2');
	});
});
