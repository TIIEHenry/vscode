/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { GrpcStatusCode, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

class BindConnection extends TestConnection {
	readonly chatSessionIds: string[] = [];
	readonly streamSessionIds: string[] = [];
	createdEngineId = 'eng-real';

	override async createSession() {
		this.createSessionCalls.push({});
		return { sessionId: this.createdEngineId };
	}

	override subscribeSessionEventStream(sessionId: string, listener: (event: { payload: unknown }) => void) {
		this.streamSessionIds.push(sessionId);
		return super.subscribeSessionEventStream(sessionId, listener);
	}

	override openChatStream(sessionId: string) {
		this.chatSessionIds.push(sessionId);
		return {
			write: () => { },
			dispose: () => { },
		};
	}

	override async chat(request: { sessionId: string }) {
		this.chatSessionIds.push(request.sessionId);
	}
}

suite('SessionViewHost engine session bind', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('Create before stream/chat; engine id is used, not local stub', async () => {
		const connection = new BindConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('local-untitled');
		const engineId = await viewHost.whenEngineSessionReady('local-untitled');

		assert.strictEqual(engineId, 'eng-real');
		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.deepStrictEqual(connection.streamSessionIds, ['eng-real']);
		assert.deepStrictEqual(connection.chatSessionIds, ['eng-real']);
		assert.ok(!connection.streamSessionIds.includes('local-untitled'));
		assert.ok(!connection.chatSessionIds.includes('local-untitled'));

		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: 'hello engine' });
		assert.strictEqual(outcome.accepted, true);
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		assert.ok(connection.chatSessionIds.every(id => id === 'eng-real'));
	});

	test('Chat is not sent until Create returns a session_id', async () => {
		let resolveCreate: (value: { sessionId: string }) => void = () => { };
		const connection = new class extends BindConnection {
			override async createSession() {
				this.createSessionCalls.push({});
				return new Promise<{ sessionId: string }>(resolve => {
					resolveCreate = resolve;
				});
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-wait');
		assert.strictEqual(connection.streamSessionIds.length, 0);
		assert.strictEqual(connection.chatSessionIds.length, 0);

		resolveCreate({ sessionId: 'eng-late' });
		await viewHost.whenEngineSessionReady('local-wait');
		assert.deepStrictEqual(connection.streamSessionIds, ['eng-late']);
		assert.deepStrictEqual(connection.chatSessionIds, ['eng-late']);
	});

	test('reconnect Resumes the bound engine id and does not Create again', async () => {
		const connection = new BindConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-resume');
		await viewHost.whenEngineSessionReady('local-resume');
		assert.strictEqual(connection.createSessionCalls.length, 1);

		await connection.disconnect();
		viewHost.onEngineConnectionChanged();
		connection['connected'] = true;
		viewHost.onEngineConnectionChanged();
		await viewHost.whenEngineSessionReady('local-resume');

		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.deepStrictEqual(connection.resumeSessionCalls, [{ sessionId: 'eng-real' }]);
	});

	test('Create ALREADY_EXISTS Resumes listed session_id and does not Create again', async () => {
		const connection = new class extends BindConnection {
			override async createSession() {
				this.createSessionCalls.push({});
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, '6 ALREADY_EXISTS: Session already exists');
			}
			override async listSessions() {
				return { sessions: [{ sessionId: 'eng-listed', title: 'Hello' }] };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-exists');
		const engineId = await viewHost.whenEngineSessionReady('local-exists');

		assert.strictEqual(engineId, 'eng-listed');
		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.deepStrictEqual(connection.resumeSessionCalls, [{ sessionId: 'eng-listed' }]);
		assert.deepStrictEqual(connection.streamSessionIds, ['eng-listed']);
		assert.deepStrictEqual(connection.chatSessionIds, ['eng-listed']);
	});

	test('Create ALREADY_EXISTS prefers List title match over first row', async () => {
		const connection = new class extends BindConnection {
			override async createSession() {
				this.createSessionCalls.push({});
				throw new UniverseAgentTransportError(6, 'Session already exists');
			}
			override async listSessions() {
				return {
					sessions: [
						{ sessionId: 'eng-first', title: 'Other' },
						{ sessionId: 'eng-match', title: 'local-exists' },
					],
				};
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		viewHost.acquireLease('local-exists');
		const engineId = await viewHost.whenEngineSessionReady('local-exists');
		assert.strictEqual(engineId, 'eng-match');
		assert.deepStrictEqual(connection.resumeSessionCalls, [{ sessionId: 'eng-match' }]);
	});

	test('Create ALREADY_EXISTS with empty List does not retry Create', async () => {
		const connection = new class extends BindConnection {
			override async createSession() {
				this.createSessionCalls.push({});
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		await assert.rejects(
			() => viewHost.whenEngineSessionReady('local-empty'),
			/List returned no session_id/,
		);
		assert.strictEqual(connection.createSessionCalls.length, 1);
		assert.deepStrictEqual(connection.resumeSessionCalls, []);
	});

	test('Create non-ALREADY_EXISTS errors still throw without List recover', async () => {
		const connection = new class extends BindConnection {
			listCalled = false;
			override async createSession() {
				this.createSessionCalls.push({});
				throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'engine down');
			}
			override async listSessions() {
				this.listCalled = true;
				return { sessions: [{ sessionId: 'should-not-use' }] };
			}
		}();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		await assert.rejects(
			() => viewHost.whenEngineSessionReady('local-fail'),
			(error: unknown) => error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNAVAILABLE,
		);
		assert.strictEqual(connection.listCalled, false);
	});
});
