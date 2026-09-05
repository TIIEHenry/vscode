/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { GrpcStatusCode, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import { createSessionRecoveringAlreadyExists } from '../../node/sessionCreateRecover.js';

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
