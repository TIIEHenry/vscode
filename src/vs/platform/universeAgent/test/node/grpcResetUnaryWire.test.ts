/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentResetAgentResult } from '../../common/universeAgentTypes.js';
import {
	decodeResetResponse,
	encodeResetRequest,
	type ResetResponseWire,
} from '../../node/grpc/grpcResetUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Reset protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeResetRequest writes session_id=1 agent_id=2; clear_profile_only=3 only when true; omits empty/false; not JSON', () => {
		const encoded = encodeResetRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
			clearProfileOnly: true,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
			clear_profile_only: true,
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
		});
		assert.strictEqual(protoVarints(encoded).get(3), 1);
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const omittedFalse = encodeResetRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
			clearProfileOnly: false,
		});
		assert.strictEqual(protoStrings(omittedFalse).get(1), 'sess-1');
		assert.strictEqual(protoStrings(omittedFalse).get(2), 'agent-9');
		assert.ok(!protoVarints(omittedFalse).has(3));
		assert.notStrictEqual(omittedFalse[0], 0x7b);

		const omittedAbsent = encodeResetRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
		});
		assert.strictEqual(protoStrings(omittedAbsent).get(1), 'sess-1');
		assert.ok(!protoVarints(omittedAbsent).has(3));

		const sessionOnly = encodeResetRequest({
			sessionId: 'sess-1',
			agentId: '',
			clearProfileOnly: false,
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.ok(!protoVarints(sessionOnly).has(3));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeResetRequest({
			sessionId: '',
			agentId: '',
			clearProfileOnly: false,
		}).length, 0);
	});

	test('decodeResetResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'reset'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeResetResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'reset',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapReset(wire), {
			ok: true,
			message: 'reset',
		});

		const empty = decodeResetResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapReset(empty), {
			ok: false,
			message: undefined,
		});
	});

	test('reset unary wire is Reset only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcResetUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeResetRequest\b/.test(source));
		assert.ok(/\bdecodeResetResponse\b/.test(source));
		assert.ok(/\bencodeInt32Field\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!/\bResetAgentProfile\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('resetAgent uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const reset = extractAsyncMethod(source, 'resetAgent');
		assert.ok(reset.includes('makeUnaryBytesClient'), 'resetAgent must use makeUnaryBytesClient');
		assert.ok(reset.includes('encodeResetRequest'), 'resetAgent must call encodeResetRequest');
		assert.ok(reset.includes('decodeResetResponse'), 'resetAgent must call decodeResetResponse');
		assert.ok(reset.includes('ok: wire.success === true'), 'resetAgent must keep ok: wire.success === true');
		assert.ok(reset.includes('message: wire.message'), 'resetAgent must keep message: wire.message');
		assert.ok(!reset.includes('makeUnaryClient<'), 'resetAgent must not use JSON makeUnaryClient');
		assert.ok(!reset.includes('JSON.stringify'), 'resetAgent must not JSON.stringify');

		assert.ok(source.includes('grpcResetUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

/** Same mapping as Agent.Reset JSON unary (`ok: wire.success === true`). */
function mapReset(wire: ResetResponseWire): UniverseAgentResetAgentResult {
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcResetUnaryWire.ts')));
	assert.ok(dir, 'grpcResetUnaryWire.ts not found from cwd or import.meta');
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
