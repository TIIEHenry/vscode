/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { GrpcStatusCode, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import { createSessionRecoveringAlreadyExists } from '../../node/sessionCreateRecover.js';
import { UniverseAgentConnectionService } from '../../node/universeAgentConnectionService.js';
import type { IUniverseAgentGrpcTransport } from '../../node/grpc/grpcTransport.js';
import type {
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentListSessionsResult,
	UniverseAgentResumeSessionRequest,
} from '../../common/universeAgentTypes.js';

suite('createSession ALREADY_EXISTS recover', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('List+Resume returns existing session and does not rethrow 6', async () => {
		const resumeCalls: string[] = [];
		const result = await createSessionRecoveringAlreadyExists(
			async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, '6 ALREADY_EXISTS: Session already exists');
			},
			async () => ({ sessions: [{ sessionId: 'eng-listed', title: 'New session' }] }),
			async sessionId => { resumeCalls.push(sessionId); },
			'New session',
		);
		assert.strictEqual(result.sessionId, 'eng-listed');
		assert.deepStrictEqual(resumeCalls, ['eng-listed']);
	});

	test('prefers List title match over first row', async () => {
		const result = await createSessionRecoveringAlreadyExists(
			async () => {
				throw new UniverseAgentTransportError(6, 'Session already exists');
			},
			async () => ({
				sessions: [
					{ sessionId: 'eng-first', title: 'Other' },
					{ sessionId: 'eng-match', title: 'local-exists' },
				],
			}),
			async () => { },
			'local-exists',
		);
		assert.strictEqual(result.sessionId, 'eng-match');
	});

	test('empty List does not throw status 6', async () => {
		await assert.rejects(
			() => createSessionRecoveringAlreadyExists(
				async () => {
					throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
				},
				async () => ({ sessions: [] }),
				async () => { },
				'untitled',
			),
			(error: unknown) => error instanceof Error
				&& /List returned no session_id/.test(error.message)
				&& !(error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.ALREADY_EXISTS),
		);
	});

	test('non-ALREADY_EXISTS still throws without List', async () => {
		let listCalled = false;
		await assert.rejects(
			() => createSessionRecoveringAlreadyExists(
				async () => {
					throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'engine down');
				},
				async () => {
					listCalled = true;
					return { sessions: [{ sessionId: 'should-not-use' }] };
				},
				async () => { },
				undefined,
			),
			(error: unknown) => error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNAVAILABLE,
		);
		assert.strictEqual(listCalled, false);
	});

	test('successful Create is returned as-is', async () => {
		const result = await createSessionRecoveringAlreadyExists(
			async () => ({ sessionId: 'eng-new' }),
			async () => ({ sessions: [{ sessionId: 'should-not-use' }] }),
			async () => { },
			undefined,
		);
		assert.strictEqual(result.sessionId, 'eng-new');
	});

	test('connection service createSession recovers ALREADY_EXISTS for roster callers', async () => {
		const resumeCalls: UniverseAgentResumeSessionRequest[] = [];
		const transport = createRecoverTransport({
			createSession: async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, '6 ALREADY_EXISTS: Session already exists');
			},
			listSessions: async () => ({ sessions: [{ sessionId: 'eng-roster', title: 'New session' }] }),
			resumeSession: async request => {
				resumeCalls.push(request);
				return { ok: true };
			},
		});
		const service = store.add(new UniverseAgentConnectionService({
			createTransport: () => transport,
		}));
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });
		const result = await service.createSession({ title: 'New session' });
		assert.strictEqual(result.sessionId, 'eng-roster');
		assert.deepStrictEqual(resumeCalls, [{ sessionId: 'eng-roster' }]);
	});

	test('connection service listSessions after connect returns engine rows', async () => {
		const transport = createRecoverTransport({
			listSessions: async () => ({
				sessions: [{ sessionId: 'eng-1', title: 'Hello' }],
				totalCount: 1,
			}),
		});
		const service = store.add(new UniverseAgentConnectionService({
			createTransport: () => transport,
		}));
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });
		const listed = await service.listSessions({});
		assert.strictEqual(listed.sessions.length, 1);
		assert.strictEqual(listed.sessions[0]?.sessionId, 'eng-1');
		assert.strictEqual(listed.sessions[0]?.title, 'Hello');
	});
});

function createRecoverTransport(handlers: {
	createSession?: (request: UniverseAgentCreateSessionRequest) => Promise<UniverseAgentCreateSessionResult>;
	listSessions?: () => Promise<UniverseAgentListSessionsResult>;
	resumeSession?: (request: UniverseAgentResumeSessionRequest) => Promise<{ ok: boolean }>;
}): IUniverseAgentGrpcTransport {
	const base = {
		isChannelAlive: true,
		async connect() {
			return { sessionToken: 'token-1', methods: [], events: [] };
		},
		close() { },
		async probeRpc() {
			return GrpcStatusCode.UNIMPLEMENTED;
		},
		async createSession(request: UniverseAgentCreateSessionRequest) {
			if (handlers.createSession) {
				return handlers.createSession(request);
			}
			return { sessionId: 'new-session' };
		},
		async listSessions() {
			if (handlers.listSessions) {
				return handlers.listSessions();
			}
			return { sessions: [], totalCount: 0 };
		},
		async resumeSession(request: UniverseAgentResumeSessionRequest) {
			if (handlers.resumeSession) {
				return handlers.resumeSession(request);
			}
			return { ok: true };
		},
	};
	return new Proxy(base as IUniverseAgentGrpcTransport, {
		get(target, prop, receiver) {
			if (Reflect.has(target, prop)) {
				return Reflect.get(target, prop, receiver);
			}
			return async () => {
				throw new Error(`unexpected transport call: ${String(prop)}`);
			};
		},
	});
}
