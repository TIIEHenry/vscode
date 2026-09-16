/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSuspendLoopResult } from '../../common/universeAgentTypes.js';
import {
	decodeSuspendLoopResponse,
	encodeSuspendLoopRequest,
	type SuspendLoopResponseWire,
} from '../../node/grpc/grpcSuspendLoopUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService SuspendLoop protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSuspendLoopRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeSuspendLoopRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const sessionOnly = encodeSuspendLoopRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeSuspendLoopRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('decodeSuspendLoopResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'suspended'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSuspendLoopResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'suspended',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSuspendLoop(wire), {
			ok: true,
			message: 'suspended',
		});

		const empty = decodeSuspendLoopResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapSuspendLoop(empty), {
			ok: false,
			message: undefined,
		});
	});

	test('suspend-loop unary wire is AgentService.SuspendLoop only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcSuspendLoopUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeSuspendLoopRequest\b/.test(source));
		assert.ok(/\bdecodeSuspendLoopResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bencodePauseRequest\b/.test(source));
		assert.ok(!/\bdecodePauseResponse\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('suspendLoop still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const suspend = extractAsyncMethod(source, 'suspendLoop');
		assert.ok(suspend.includes('makeUnaryClient<'), 'suspendLoop still uses JSON makeUnaryClient');
		assert.ok(!suspend.includes('makeUnaryBytesClient'), 'suspendLoop must not use makeUnaryBytesClient this slice');
		assert.ok(!suspend.includes('encodeSuspendLoopRequest'), 'suspendLoop must not call encodeSuspendLoopRequest this slice');
		assert.ok(!suspend.includes('decodeSuspendLoopResponse'), 'suspendLoop must not call decodeSuspendLoopResponse this slice');
		assert.ok(suspend.includes('session_id'), 'suspendLoop still sends session_id JSON key');
		assert.ok(suspend.includes('agent_id'), 'suspendLoop still sends agent_id JSON key');
		assert.ok(suspend.includes('wire.success === true'), 'suspendLoop still maps success');
		assert.ok(!source.includes('grpcSuspendLoopUnaryWire'));
	});
});

/** Same mapping as Agent.SuspendLoop JSON unary (`ok: wire.success === true`). */
function mapSuspendLoop(wire: SuspendLoopResponseWire): UniverseAgentSuspendLoopResult {
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcSuspendLoopUnaryWire.ts')));
	assert.ok(dir, 'grpcSuspendLoopUnaryWire.ts not found from cwd or import.meta');
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
