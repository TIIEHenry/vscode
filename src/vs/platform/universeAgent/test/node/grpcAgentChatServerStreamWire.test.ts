/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	encodeContinueGenerationRequest,
	encodeRegenerateRequest,
	encodeResumeRequest,
} from '../../node/grpc/grpcAgentChatServerStreamWire.js';
import { readProtoFields } from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService ContinueGeneration/Regenerate/Resume protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeContinueGenerationRequest writes session_id=1 agent_id=2 turn_id=3 message_id=4; omits empty; not JSON', () => {
		const encoded = encodeContinueGenerationRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
			turnId: 'turn-3',
			messageId: 'msg-4',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
			turn_id: 'turn-3',
			message_id: 'msg-4',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
			3: 'turn-3',
			4: 'msg-4',
		});
		assert.ok(!protoStrings(encoded).has(5));
		assert.ok(!protoVarints(encoded).has(1));

		const sessionOnly = encodeContinueGenerationRequest({
			sessionId: 'sess-1',
			agentId: '',
			turnId: '',
			messageId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.ok(!protoStrings(sessionOnly).has(3));
		assert.ok(!protoStrings(sessionOnly).has(4));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeContinueGenerationRequest({
			sessionId: '',
			agentId: '',
			turnId: '',
			messageId: '',
		}).length, 0);
	});

	test('encodeRegenerateRequest shares ContinueGeneration layout; not JSON', () => {
		const request = {
			sessionId: 'sess-1',
			agentId: 'agent-9',
			turnId: 'turn-3',
			messageId: 'msg-4',
		};
		const encoded = encodeRegenerateRequest(request);
		assert.deepStrictEqual(Buffer.from(encoded), Buffer.from(encodeContinueGenerationRequest(request)));
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
			3: 'turn-3',
			4: 'msg-4',
		});

		assert.strictEqual(encodeRegenerateRequest({
			sessionId: '',
			agentId: '',
			turnId: '',
			messageId: '',
		}).length, 0);
	});

	test('encodeResumeRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeResumeRequest({
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

		const sessionOnly = encodeResumeRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));

		assert.strictEqual(encodeResumeRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('continuation stream wire is ContinueGeneration/Regenerate/Resume only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcAgentChatServerStreamWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeContinueGenerationRequest\b/.test(source));
		assert.ok(/\bencodeRegenerateRequest\b/.test(source));
		assert.ok(/\bencodeResumeRequest\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bRebuild\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('openContinuationStream/openRegenerateStream/openResumeStream use bytes helper and decodeChatResponse', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		for (const { name, encoder } of [
			{ name: 'openContinuationStream', encoder: 'encodeContinueGenerationRequest' },
			{ name: 'openRegenerateStream', encoder: 'encodeRegenerateRequest' },
			{ name: 'openResumeStream', encoder: 'encodeResumeRequest' },
		]) {
			const body = extractMethod(source, name);
			assert.ok(body.includes('makeServerStreamBytesClient'), `${name} must use makeServerStreamBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes('decodeChatResponse'), `${name} must deserialize via decodeChatResponse`);
			assert.ok(!body.includes('makeServerStreamClient<'), `${name} must not use JSON makeServerStreamClient`);
			assert.ok(!body.includes('JSON.stringify'), `${name} must not JSON.stringify`);
		}
		assert.ok(source.includes('grpcAgentChatServerStreamWire'));
	});

	test('Watch / Rebuild / Connect / SaveSkillContent / ResolveTurn / ResolveAnchor stay JSON', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		assert.ok(!extractMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'saveSkillContent').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'connect').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'resolveTurn').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'resolveAnchor').includes('makeUnaryClient<'));

		const watch = extractMethod(source, 'openWatchConfigStream');
		assert.ok(watch.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watch.includes('makeServerStreamBytesClient'));

		const rebuild = extractMethod(source, 'openRebuildMemoryStream');
		assert.ok(rebuild.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!rebuild.includes('makeServerStreamBytesClient'));
	});

	test('makeServerStreamBytesClient serializes proto bytes; makeServerStreamClient stays JSON', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClientCalls.ts'), 'utf8');
		assert.ok(/\bexport function makeServerStreamBytesClient\b/.test(source));
		assert.ok(/\basUnaryProtoBytes\b/.test(source));
		const jsonStart = source.indexOf('export function makeServerStreamClient<');
		assert.ok(jsonStart >= 0, 'missing makeServerStreamClient');
		const jsonEnd = source.indexOf('export function makeServerStreamBytesClient<', jsonStart + 1);
		const jsonBody = source.slice(jsonStart, jsonEnd >= 0 ? jsonEnd : source.length);
		assert.ok(jsonBody.includes('JSON.stringify'), 'makeServerStreamClient must keep JSON.stringify');
		const bytesStart = source.indexOf('export function makeServerStreamBytesClient<');
		const bytesEnd = source.indexOf('\nexport function ', bytesStart + 1);
		const bytesBody = source.slice(bytesStart, bytesEnd >= 0 ? bytesEnd : source.length);
		assert.ok(!bytesBody.includes('JSON.stringify'), 'makeServerStreamBytesClient must not JSON.stringify');
		assert.ok(bytesBody.includes('asUnaryProtoBytes'), 'makeServerStreamBytesClient must serialize via asUnaryProtoBytes');
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcAgentChatServerStreamWire.ts')));
	assert.ok(dir, 'grpcAgentChatServerStreamWire.ts not found from cwd or import.meta');
	return dir;
}

function extractMethod(source: string, name: string): string {
	const asyncStart = source.indexOf(`\tasync ${name}(`);
	const start = asyncStart >= 0 ? asyncStart : source.indexOf(`\t${name}(`);
	assert.ok(start >= 0, `missing ${name}(`);
	const rest = source.slice(start + 1);
	const next = rest.search(/\n\t(async |\w+\()/);
	const end = next >= 0 ? start + 1 + next : source.length;
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
