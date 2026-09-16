/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentPauseAgentResult } from '../../common/universeAgentTypes.js';
import {
	decodePauseResponse,
	encodePauseRequest,
	type PauseResponseWire,
} from '../../node/grpc/grpcPauseUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Pause protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodePauseRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodePauseRequest({
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

		const sessionOnly = encodePauseRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodePauseRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('decodePauseResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'paused'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodePauseResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'paused',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapPauseAgent(wire), {
			ok: true,
			message: 'paused',
		});

		const empty = decodePauseResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapPauseAgent(empty), {
			ok: false,
			message: undefined,
		});
	});

	test('pause unary wire is AgentService.Pause only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcPauseUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodePauseRequest\b/.test(source));
		assert.ok(/\bdecodePauseResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('pauseAgent still JSON unary; skip Connect/SaveSkillContent/Watch/GetModelPreferences/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const pause = extractAsyncMethod(source, 'pauseAgent');
		assert.ok(pause.includes('makeUnaryClient<'), 'pauseAgent still uses JSON makeUnaryClient');
		assert.ok(!pause.includes('makeUnaryBytesClient'), 'pauseAgent must not use makeUnaryBytesClient this slice');
		assert.ok(!pause.includes('encodePauseRequest'), 'pauseAgent must not call encodePauseRequest this slice');
		assert.ok(!pause.includes('decodePauseResponse'), 'pauseAgent must not call decodePauseResponse this slice');
		assert.ok(pause.includes('session_id'), 'pauseAgent still sends session_id JSON key');
		assert.ok(pause.includes('agent_id'), 'pauseAgent still sends agent_id JSON key');
		assert.ok(pause.includes('wire.success === true'), 'pauseAgent still maps success');
		assert.ok(!source.includes('grpcPauseUnaryWire'));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

/** Same mapping as Agent.Pause JSON unary (`ok: wire.success === true`). */
function mapPauseAgent(wire: PauseResponseWire): UniverseAgentPauseAgentResult {
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcPauseUnaryWire.ts')));
	assert.ok(dir, 'grpcPauseUnaryWire.ts not found from cwd or import.meta');
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
