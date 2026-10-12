/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { DataBreakpointSetType } from '../../common/debug.js';
import { RawDebugSession } from '../../browser/rawDebugSession.js';
import { createMockDebugModel } from './mockDebugModel.js';
import { createTestSession } from './callStack.test.js';

suite('DebugSession - sendDataBreakpoints toDAP failure', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	teardown(() => {
		sinon.restore();
	});

	async function sendRejected(rejectWith: unknown): Promise<{ message: string | undefined; verified: boolean; stored: DebugProtocol.Breakpoint | undefined }> {
		const model = createMockDebugModel(disposables);
		const session = disposables.add(createTestSession(model));
		model.addDataBreakpoint({
			description: 'value',
			src: { type: DataBreakpointSetType.Variable, dataId: 'id' },
			canPersist: true,
			accessTypes: ['read'],
			accessType: 'read',
		}, 'dbp-1');
		const bp = model.getDataBreakpoints()[0];
		sinon.stub(bp, 'toDAP').callsFake(() => Promise.reject(rejectWith));
		let stored: DebugProtocol.Breakpoint | undefined;
		const original = model.setBreakpointSessionData.bind(model);
		sinon.stub(model, 'setBreakpointSessionData').callsFake((sessionId, capabilities, data) => {
			stored = data?.get(bp.getId());
			original(sessionId, capabilities, data);
		});
		session.raw = upcastPartial<RawDebugSession>({
			readyForBreakpoints: true,
			capabilities: { supportsDataBreakpoints: true },
			setDataBreakpoints: async () => ({ body: { breakpoints: [] } }),
		});
		await session.sendDataBreakpoints([bp]);
		return { message: bp.message, verified: bp.verified, stored };
	}

	test('toDAP rejection stores an unverified breakpoint object', async () => {
		const result = await sendRejected(new Error('adapter failed'));
		assert.ok(result.stored);
		assert.strictEqual(typeof result.stored, 'object');
		assert.strictEqual(result.stored!.verified, false);
		assert.strictEqual(result.stored!.message, 'adapter failed');
		assert.notStrictEqual(typeof result.stored, 'string');
		assert.strictEqual(result.message, 'adapter failed');
		assert.strictEqual(result.verified, false);
	});

	test('toDAP rejection of a non-Error uses String(error)', async () => {
		const result = await sendRejected('plain failure');
		assert.ok(result.stored);
		assert.strictEqual(result.stored!.verified, false);
		assert.strictEqual(result.stored!.message, 'plain failure');
		assert.strictEqual(result.message, 'plain failure');
		assert.strictEqual(result.verified, false);
	});
});
