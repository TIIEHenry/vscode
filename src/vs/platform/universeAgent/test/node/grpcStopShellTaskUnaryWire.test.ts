/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentStopShellTaskResult } from '../../common/universeAgentTypes.js';
import {
	decodeStopShellTaskResponse,
	encodeStopShellTaskRequest,
	type StopShellTaskResponseWire,
} from '../../node/grpc/grpcStopShellTaskUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService StopShellTask protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeStopShellTaskRequest writes session_id=1 task_id=2; omits empty; not JSON', () => {
		const encoded = encodeStopShellTaskRequest({
			sessionId: 'sess-1',
			taskId: 'task-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			task_id: 'task-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'task-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const sessionOnly = encodeStopShellTaskRequest({
			sessionId: 'sess-1',
			taskId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeStopShellTaskRequest({
			sessionId: '',
			taskId: '',
		}).length, 0);
	});

	test('decodeStopShellTaskResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'stopped'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeStopShellTaskResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'stopped',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapStopShellTask(wire), {
			ok: true,
			message: 'stopped',
		});

		const empty = decodeStopShellTaskResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapStopShellTask(empty), {
			ok: false,
			message: undefined,
		});
	});
});

/** Same mapping as Agent.StopShellTask JSON unary (`ok: wire.success === true`). */
function mapStopShellTask(wire: StopShellTaskResponseWire): UniverseAgentStopShellTaskResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}



function protoStrings(encoded: Uint8Array): Map<number, string> {
	const strings = new Map<number, string>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 2) {
			strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return strings;
}

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}
