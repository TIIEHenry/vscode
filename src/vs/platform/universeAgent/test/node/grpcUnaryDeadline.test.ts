/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { applyDefaultUnaryDeadline, type UnaryDeadlineCallProperties } from '../../node/grpc/grpcClientCalls.js';

suite('applyDefaultUnaryDeadline', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('writes deadline for unary when unset', () => {
		const next = applyDefaultUnaryDeadline<UnaryDeadlineCallProperties>({
			methodDefinition: { requestStream: false, responseStream: false },
			callOptions: {},
		}, 30_000, 1_000);
		assert.strictEqual(next.callOptions.deadline, 31_000);
	});

	test('does not write deadline for streaming methods', () => {
		const server = applyDefaultUnaryDeadline<UnaryDeadlineCallProperties>({
			methodDefinition: { requestStream: false, responseStream: true },
			callOptions: {},
		}, 30_000, 1_000);
		assert.strictEqual(server.callOptions.deadline, undefined);
		const bidi = applyDefaultUnaryDeadline<UnaryDeadlineCallProperties>({
			methodDefinition: { requestStream: true, responseStream: true },
			callOptions: {},
		}, 30_000, 1_000);
		assert.strictEqual(bidi.callOptions.deadline, undefined);
	});

	test('does not override an existing deadline', () => {
		const next = applyDefaultUnaryDeadline<UnaryDeadlineCallProperties>({
			methodDefinition: { requestStream: false, responseStream: false },
			callOptions: { deadline: 9 },
		}, 30_000, 1_000);
		assert.strictEqual(next.callOptions.deadline, 9);
	});

	test('0 disables the default', () => {
		const next = applyDefaultUnaryDeadline<UnaryDeadlineCallProperties>({
			methodDefinition: { requestStream: false, responseStream: false },
			callOptions: {},
		}, 0, 1_000);
		assert.strictEqual(next.callOptions.deadline, undefined);
	});
});
