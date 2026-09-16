/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentResumeLoopResult } from '../../common/universeAgentTypes.js';
import {
	decodeResumeLoopResponse,
	encodeResumeLoopRequest,
	type ResumeLoopResponseWire,
} from '../../node/grpc/grpcResumeLoopUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService ResumeLoop protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeResumeLoopRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeResumeLoopRequest({
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

		const sessionOnly = encodeResumeLoopRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeResumeLoopRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('decodeResumeLoopResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'resumed'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeResumeLoopResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'resumed',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapResumeLoop(wire), {
			ok: true,
			message: 'resumed',
		});

		const empty = decodeResumeLoopResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapResumeLoop(empty), {
			ok: false,
			message: undefined,
		});
	});

	test('resumeLoop unary wire is AgentService.ResumeLoop only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcResumeLoopUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeResumeLoopRequest\b/.test(source));
		assert.ok(/\bdecodeResumeLoopResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bencodePauseRequest\b|\bdecodePauseResponse\b|\bpauseAgent\b/.test(source));
		assert.ok(!/\bresumeSession\b|\bencodeResumeSessionRequest\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('resumeLoop still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const resumeLoop = extractAsyncMethod(source, 'resumeLoop');
		assert.ok(resumeLoop.includes('makeUnaryClient<'), 'resumeLoop still uses JSON makeUnaryClient');
		assert.ok(!resumeLoop.includes('makeUnaryBytesClient'), 'resumeLoop must not use makeUnaryBytesClient this slice');
		assert.ok(!resumeLoop.includes('encodeResumeLoopRequest'), 'resumeLoop must not call encodeResumeLoopRequest this slice');
		assert.ok(!resumeLoop.includes('decodeResumeLoopResponse'), 'resumeLoop must not call decodeResumeLoopResponse this slice');
		assert.ok(resumeLoop.includes('session_id'), 'resumeLoop still sends session_id JSON key');
		assert.ok(resumeLoop.includes('agent_id'), 'resumeLoop still sends agent_id JSON key');
		assert.ok(resumeLoop.includes('wire.success === true'), 'resumeLoop still maps success');
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bConnect\b|\bResolveTurn\b/.test(resumeLoop));
		assert.ok(!source.includes('grpcResumeLoopUnaryWire'));
	});
});

/** Same mapping as Agent.ResumeLoop JSON unary (`ok: wire.success === true`). */
function mapResumeLoop(wire: ResumeLoopResponseWire): UniverseAgentResumeLoopResult {
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcResumeLoopUnaryWire.ts')));
	assert.ok(dir, 'grpcResumeLoopUnaryWire.ts not found from cwd or import.meta');
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
