/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSessionStreamCloseCause } from '../../common/universeAgentTypes.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

/** No `openChatStream` hook: every ack has to take the one-shot `chat()` fallback. */
class OneShotChatConnection extends TestConnection {
	readonly chatCalls: { readonly sessionId: string; readonly payload: unknown }[] = [];

	override async chat(request?: { readonly sessionId: string; readonly payload: unknown }): Promise<void> {
		if (request !== undefined) {
			this.chatCalls.push(request);
		}
	}
}

/** Resident Chat bidi; writes are tagged with the open they landed on. */
class ResidentChatConnection extends OneShotChatConnection {
	readonly opens: string[] = [];
	readonly residentWrites: { readonly openIndex: number; readonly payload: unknown }[] = [];
	private chatClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void;

	openChatStream(
		sessionId: string,
		_onResponse: (response: { payload: unknown }) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { write(payload: unknown): void; dispose(): void } {
		const openIndex = this.opens.length;
		this.opens.push(sessionId);
		this.chatClosed = onClosed;
		return {
			write: (payload: unknown) => {
				this.residentWrites.push({ openIndex, payload });
			},
			dispose: () => { },
		};
	}

	fireChatClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this.chatClosed?.(cause);
	}
}

async function leaseAndSettle(viewHost: SessionViewHost, sessionId: string): Promise<void> {
	viewHost.onEngineConnectionChanged();
	viewHost.acquireLease(sessionId);
	await viewHost.whenEngineSessionReady(sessionId);
	await new Promise<void>(resolve => queueMicrotask(() => resolve()));
}

suite('SessionViewHost heartbeat_ack', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHost(connection: TestConnection): SessionViewHost {
		return store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
	}

	test('resident bidi carries every heartbeat_ack and no extra stream is opened', async () => {
		const connection = new ResidentChatConnection();
		const viewHost = createHost(connection);
		await leaseAndSettle(viewHost, 'sess-hb-resident');
		assert.strictEqual(connection.opens.length, 1);

		connection.pushStreamEvent('sess-hb-resident', { heartbeat: {} });
		connection.pushStreamEvent('sess-hb-resident', { heartbeat: {} });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.deepStrictEqual(connection.residentWrites, [
			{ openIndex: 0, payload: { heartbeat_ack: {} } },
			{ openIndex: 0, payload: { heartbeat_ack: {} } },
		]);
		assert.deepStrictEqual(connection.chatCalls, [], 'resident handle must not fall back to one-shot chat()');
		assert.strictEqual(connection.opens.length, 1, 'heartbeats must not open a second Chat stream');
	});

	test('remote Chat close re-ensures the stream and the next ack rides the new handle', async () => {
		const connection = new ResidentChatConnection();
		const viewHost = createHost(connection);
		await leaseAndSettle(viewHost, 'sess-hb-reopen');

		connection.fireChatClosed({ kind: 'remote' });
		assert.strictEqual(connection.opens.length, 2);

		connection.pushStreamEvent('sess-hb-reopen', { heartbeat: {} });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.deepStrictEqual(connection.residentWrites, [{ openIndex: 1, payload: { heartbeat_ack: {} } }]);
		assert.deepStrictEqual(connection.chatCalls, []);
	});

	test('without a resident hook each heartbeat acks over a one-shot chat()', async () => {
		const connection = new OneShotChatConnection();
		const viewHost = createHost(connection);
		await leaseAndSettle(viewHost, 'sess-hb-oneshot');

		connection.pushStreamEvent('sess-hb-oneshot', { heartbeat: {} });
		connection.pushStreamEvent('sess-hb-oneshot', { heartbeat: {} });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.deepStrictEqual(connection.chatCalls, [
			{ sessionId: 'sess-hb-oneshot', payload: { heartbeat_ack: {} } },
			{ sessionId: 'sess-hb-oneshot', payload: { heartbeat_ack: {} } },
		]);
	});

	test('engine already disconnected acks nothing on either path', async () => {
		const connection = new ResidentChatConnection();
		const viewHost = createHost(connection);
		await leaseAndSettle(viewHost, 'sess-hb-down');

		await connection.disconnect();
		connection.pushStreamEvent('sess-hb-down', { heartbeat: {} });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.deepStrictEqual(connection.residentWrites, []);
		assert.deepStrictEqual(connection.chatCalls, []);
	});
});
