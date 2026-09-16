/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
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

	test('stop-shell-task unary wire is AgentService.StopShellTask only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcStopShellTaskUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeStopShellTaskRequest\b/.test(source));
		assert.ok(/\bdecodeStopShellTaskResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('stopShellTask still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const stop = extractAsyncMethod(source, 'stopShellTask');
		assert.ok(stop.includes('makeUnaryClient<'), 'stopShellTask still uses JSON makeUnaryClient');
		assert.ok(!stop.includes('makeUnaryBytesClient'), 'stopShellTask must not use makeUnaryBytesClient this slice');
		assert.ok(!stop.includes('encodeStopShellTaskRequest'), 'stopShellTask must not call encodeStopShellTaskRequest this slice');
		assert.ok(!stop.includes('decodeStopShellTaskResponse'), 'stopShellTask must not call decodeStopShellTaskResponse this slice');
		assert.ok(stop.includes('session_id'), 'stopShellTask still sends session_id JSON key');
		assert.ok(stop.includes('task_id'), 'stopShellTask still sends task_id JSON key');
		assert.ok(stop.includes('wire.success === true'), 'stopShellTask still maps success');
		assert.ok(!source.includes('grpcStopShellTaskUnaryWire'));
		assert.ok(!/\bWatch\b/.test(stop));
	});
});

/** Same mapping as Agent.StopShellTask JSON unary (`ok: wire.success === true`). */
function mapStopShellTask(wire: StopShellTaskResponseWire): UniverseAgentStopShellTaskResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcStopShellTaskUnaryWire.ts')));
	assert.ok(dir, 'grpcStopShellTaskUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
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
