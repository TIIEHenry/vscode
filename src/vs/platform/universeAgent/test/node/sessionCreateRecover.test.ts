/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { GrpcStatusCode, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import {
	callResumeSession,
	createSessionRecoveringAlreadyExists,
	runCreateSessionSingleFlight,
} from '../../node/sessionCreateRecover.js';

suite('createSession ALREADY_EXISTS recover', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

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

	test('empty List with clientSessionId Resumes that id', async () => {
		const resumeCalls: string[] = [];
		const result = await createSessionRecoveringAlreadyExists(
			async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
			},
			async () => ({ sessions: [] }),
			async sessionId => { resumeCalls.push(sessionId); },
			'untitled',
			'session-100',
		);
		assert.strictEqual(result.sessionId, 'session-100');
		assert.deepStrictEqual(resumeCalls, ['session-100']);
	});

	test('empty List without clientSessionId still fails observably', async () => {
		const resumeCalls: string[] = [];
		await assert.rejects(
			() => createSessionRecoveringAlreadyExists(
				async () => {
					throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
				},
				async () => ({ sessions: [] }),
				async sessionId => { resumeCalls.push(sessionId); },
				'untitled',
			),
			(error: unknown) => error instanceof Error
				&& /List returned no session_id/.test(error.message)
				&& !(error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.ALREADY_EXISTS),
		);
		assert.deepStrictEqual(resumeCalls, []);
	});

	test('List failure with clientSessionId Resumes that id', async () => {
		const resumeCalls: string[] = [];
		const result = await createSessionRecoveringAlreadyExists(
			async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
			},
			async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'Query does not return results');
			},
			async sessionId => { resumeCalls.push(sessionId); },
			'untitled',
			'session-100',
		);
		assert.strictEqual(result.sessionId, 'session-100');
		assert.deepStrictEqual(resumeCalls, ['session-100']);
	});

	test('List transport/query failure is not treated as empty list or Resume', async () => {
		const resumeCalls: string[] = [];
		await assert.rejects(
			() => createSessionRecoveringAlreadyExists(
				async () => {
					throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
				},
				async () => {
					throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'Query does not return results');
				},
				async sessionId => { resumeCalls.push(sessionId); },
				'untitled',
			),
			(error: unknown) => error instanceof Error
				&& /List failed/.test(error.message)
				&& /Query does not return results/.test(error.message)
				&& !/List returned no session_id/.test(error.message)
				&& !(error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.ALREADY_EXISTS),
		);
		assert.deepStrictEqual(resumeCalls, []);
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

	test('empty List with Resume ok=false is not treated as Create success', async () => {
		await assert.rejects(
			() => createSessionRecoveringAlreadyExists(
				async () => {
					throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
				},
				async () => ({ sessions: [] }),
				async () => ({ ok: false, message: 'dead shell' }),
				'untitled',
				'session-100',
			),
			(error: unknown) => error instanceof Error
				&& /Resume\(session-100\) failed: dead shell/.test(error.message),
		);
	});

	test('List match with Resume ok=false is not treated as Create success', async () => {
		await assert.rejects(
			() => createSessionRecoveringAlreadyExists(
				async () => {
					throw new UniverseAgentTransportError(GrpcStatusCode.ALREADY_EXISTS, 'Session already exists');
				},
				async () => ({ sessions: [{ sessionId: 'eng-listed', title: 'untitled' }] }),
				async () => ({ ok: false, message: 'tree unavailable' }),
				'untitled',
				'session-100',
			),
			(error: unknown) => error instanceof Error
				&& /Resume\(eng-listed\) failed: tree unavailable/.test(error.message),
		);
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
});

suite('callResumeSession', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('uses transport when connection.resumeSession is missing', async () => {
		const resumeCalls: string[] = [];
		const host = {
			resumeSession: undefined as undefined,
			transport: {
				async resumeSession(request: { sessionId: string }) {
					resumeCalls.push(request.sessionId);
					return { ok: true as const };
				},
			},
		};
		const result = await callResumeSession(host, 'session-100');
		assert.deepStrictEqual(result, { ok: true });
		assert.deepStrictEqual(resumeCalls, ['session-100']);
	});

	test('throws instead of skipping when Resume is absent', async () => {
		try {
			await callResumeSession({}, 'session-100');
			assert.fail('expected Resume to be required');
		} catch (error) {
			assert.ok(error instanceof Error);
			assert.ok(error.message.includes('SessionService.Resume is required'));
		}
	});
});

suite('createSession single-flight', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('same clientSessionId concurrent callers share one create', async () => {
		const inflight = new Map<string, Promise<{ sessionId: string }>>();
		let createCalls = 0;
		let overlapping = 0;
		const create = async () => {
			createCalls += 1;
			overlapping += 1;
			assert.strictEqual(overlapping, 1);
			await new Promise<void>(resolve => setTimeout(resolve, 15));
			overlapping -= 1;
			return { sessionId: 'session-100' };
		};
		const [first, second] = await Promise.all([
			runCreateSessionSingleFlight(inflight, 'session-100', create),
			runCreateSessionSingleFlight(inflight, 'session-100', create),
		]);
		assert.strictEqual(createCalls, 1);
		assert.strictEqual(first.sessionId, 'session-100');
		assert.strictEqual(second.sessionId, 'session-100');
		assert.strictEqual(inflight.size, 0);
	});

	test('different clientSessionId are not joined', async () => {
		const inflight = new Map<string, Promise<{ sessionId: string }>>();
		let createCalls = 0;
		const create = async () => {
			createCalls += 1;
			await new Promise<void>(resolve => setTimeout(resolve, 10));
			return { sessionId: `n-${createCalls}` };
		};
		await Promise.all([
			runCreateSessionSingleFlight(inflight, 'session-100', create),
			runCreateSessionSingleFlight(inflight, 'session-101', create),
		]);
		assert.strictEqual(createCalls, 2);
	});

	test('missing clientSessionId is not coalesced', async () => {
		const inflight = new Map<string, Promise<{ sessionId: string }>>();
		let createCalls = 0;
		const create = async () => {
			createCalls += 1;
			await new Promise<void>(resolve => setTimeout(resolve, 10));
			return { sessionId: `n-${createCalls}` };
		};
		await Promise.all([
			runCreateSessionSingleFlight(inflight, undefined, create),
			runCreateSessionSingleFlight(inflight, '  ', create),
		]);
		assert.strictEqual(createCalls, 2);
	});

	test('sequential same id after settle is a new create', async () => {
		const inflight = new Map<string, Promise<{ sessionId: string }>>();
		let createCalls = 0;
		const create = async () => {
			createCalls += 1;
			return { sessionId: `n-${createCalls}` };
		};
		await runCreateSessionSingleFlight(inflight, 'session-100', create);
		await runCreateSessionSingleFlight(inflight, 'session-100', create);
		assert.strictEqual(createCalls, 2);
	});
});
