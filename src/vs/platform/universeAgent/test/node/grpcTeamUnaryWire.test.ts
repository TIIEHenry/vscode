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
	decodeAbortTeamResponse,
	decodeCreateTeamResponse,
	decodeKillMemberResponse,
	decodeMessageMemberResponse,
	decodeStartMemberResponse,
	decodeTaskCancelResponse,
	decodeTaskUpdateResponse,
	encodeAbortTeamRequest,
	encodeCreateTeamRequest,
	encodeKillMemberRequest,
	encodeMessageMemberRequest,
	encodeStartMemberRequest,
	encodeTaskCancelRequest,
	encodeTaskUpdateRequest,
} from '../../node/grpc/grpcTeamUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc team mutator unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeStartMemberRequest writes 1-7; omits empty/false; not JSON', () => {
		const encoded = encodeStartMemberRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			memberName: 'Alice',
			presetId: 'reviewer',
			systemPrompt: 'be brief',
			modelType: 'fast',
			dynamic: true,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			3: 'Alice',
			4: 'reviewer',
			5: 'be brief',
			6: 'fast',
		});
		assert.strictEqual(protoVarints(encoded).get(7), 1);
		const omitted = encodeStartMemberRequest({
			sessionId: '',
			agentId: '',
			memberName: '',
			presetId: '',
			systemPrompt: '',
			modelType: '',
			dynamic: false,
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(7));
	});

	test('decodeStartMemberResponse reads 1-3 as bool dynamic; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'member:9'),
			encodeStringField(2, 'Alice'),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'unused-field'),
		]);
		const decoded = decodeStartMemberResponse(encoded);
		assert.deepStrictEqual(decoded, {
			memberAgentId: 'member:9',
			memberName: 'Alice',
			dynamic: true,
		});
		assert.strictEqual(decoded.dynamic, true);
		assert.strictEqual(typeof decoded.dynamic, 'boolean');
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.deepStrictEqual(decodeStartMemberResponse(new Uint8Array(0)), {
			memberAgentId: '',
			memberName: '',
			dynamic: false,
		});
	});

	test('encodeKillMemberRequest writes 1-3; omits empty; not JSON', () => {
		const encoded = encodeKillMemberRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			memberName: 'Alice',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			3: 'Alice',
		});
		assert.strictEqual(encodeKillMemberRequest({ sessionId: '', agentId: '', memberName: '' }).length, 0);
	});

	test('decodeKillMemberResponse reads success=1 message=2; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'stopped'),
			encodeStringField(3, 'unused-field'),
		]);
		const decoded = decodeKillMemberResponse(encoded);
		assert.deepStrictEqual(decoded, { ok: true, message: 'stopped' });
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.deepStrictEqual(decodeKillMemberResponse(new Uint8Array(0)), { ok: false, message: undefined });
	});

	test('encodeCreateTeamRequest writes repeated task_descriptions=3; omits empty items; not JSON', () => {
		const encoded = encodeCreateTeamRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			taskDescriptions: ['investigate', '', 'review'],
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'root');
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 3), ['investigate', 'review']);
		assert.strictEqual(encodeCreateTeamRequest({ sessionId: '', agentId: '', taskDescriptions: [] }).length, 0);
		assert.ok(!protoRepeatedStrings(encodeCreateTeamRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			taskDescriptions: ['', ''],
		}), 3).length);
	});

	test('decodeCreateTeamResponse reads team_id=1 member_count=2; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 7),
			encodeInt32Field(2, 3),
			encodeStringField(3, 'unused-field'),
		]);
		const decoded = decodeCreateTeamResponse(encoded);
		assert.deepStrictEqual(decoded, { teamId: 7, memberCount: 3 });
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.deepStrictEqual(decodeCreateTeamResponse(new Uint8Array(0)), { teamId: 0, memberCount: 0 });
	});

	test('encodeAbortTeamRequest writes 1-4; omits empty/0; not JSON', () => {
		const encoded = encodeAbortTeamRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			teamId: 7,
			reason: 'done',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			4: 'done',
		});
		assert.strictEqual(protoVarints(encoded).get(3), 7);
		const omitted = encodeAbortTeamRequest({ sessionId: '', agentId: '', teamId: 0, reason: '' });
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(3));
	});

	test('decodeAbortTeamResponse reads 1-3; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'aborted'),
			encodeStringField(3, 'Alice'),
			encodeStringField(3, 'Bob'),
			encodeStringField(4, 'unused-field'),
		]);
		const decoded = decodeAbortTeamResponse(encoded);
		assert.deepStrictEqual(decoded, {
			ok: true,
			message: 'aborted',
			stoppedMembers: ['Alice', 'Bob'],
		});
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.deepStrictEqual(decodeAbortTeamResponse(new Uint8Array(0)), {
			ok: false,
			message: undefined,
			stoppedMembers: [],
		});
	});

	test('encodeTaskUpdateRequest writes 1-5; omits empty; not JSON', () => {
		const encoded = encodeTaskUpdateRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			taskId: 'task-1',
			newStatus: 'COMPLETED',
			message: 'done',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			3: 'task-1',
			4: 'COMPLETED',
			5: 'done',
		});
		assert.strictEqual(encodeTaskUpdateRequest({
			sessionId: '',
			agentId: '',
			taskId: '',
			newStatus: '',
			message: '',
		}).length, 0);
	});

	test('decodeTaskUpdateResponse reads success=1 message=2; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'updated'),
			encodeStringField(3, 'unused-field'),
		]);
		const decoded = decodeTaskUpdateResponse(encoded);
		assert.deepStrictEqual(decoded, { ok: true, message: 'updated' });
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.deepStrictEqual(decodeTaskUpdateResponse(new Uint8Array(0)), { ok: false, message: undefined });
	});

	test('encodeTaskCancelRequest writes 1-3; omits empty; not JSON', () => {
		const encoded = encodeTaskCancelRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			taskId: 'task-1',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			3: 'task-1',
		});
		assert.strictEqual(encodeTaskCancelRequest({ sessionId: '', agentId: '', taskId: '' }).length, 0);
	});

	test('decodeTaskCancelResponse reads success=1 message=2; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'cancelled'),
			encodeStringField(3, 'unused-field'),
		]);
		const decoded = decodeTaskCancelResponse(encoded);
		assert.deepStrictEqual(decoded, { ok: true, message: 'cancelled' });
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.deepStrictEqual(decodeTaskCancelResponse(new Uint8Array(0)), { ok: false, message: undefined });
	});

	test('encodeMessageMemberRequest writes 1-4; omits empty; not JSON', () => {
		const encoded = encodeMessageMemberRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			memberName: 'Alice',
			content: 'please review',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			3: 'Alice',
			4: 'please review',
		});
		assert.strictEqual(encodeMessageMemberRequest({
			sessionId: '',
			agentId: '',
			memberName: '',
			content: '',
		}).length, 0);
	});

	test('decodeMessageMemberResponse reads success=1 message=2; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'queued'),
			encodeStringField(3, 'unused-field'),
		]);
		const decoded = decodeMessageMemberResponse(encoded);
		assert.deepStrictEqual(decoded, { ok: true, message: 'queued' });
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.deepStrictEqual(decodeMessageMemberResponse(new Uint8Array(0)), { ok: false, message: undefined });
	});

	test('team mutator wire source has no JSON.stringify and does not redo catalog reads', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const candidates = [
			path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc/grpcTeamUnaryWire.ts'),
			path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc/grpcTeamUnaryWire.ts'),
		];
		const sourcePath = candidates.find(candidate => fs.existsSync(candidate));
		assert.ok(sourcePath, 'grpcTeamUnaryWire.ts not found from cwd or import.meta');
		const source = fs.readFileSync(sourcePath, 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(!/\bencodeListTeamsRequest|\bdecodeListTeamsResponse/.test(source));
		assert.ok(!/\bencodeMemberStatusRequest|\bdecodeMemberStatusResponse/.test(source));
		assert.ok(!/\bencodeTaskListRequest|\bdecodeTaskListResponse/.test(source));
		assert.ok(!/\bencodeTeamInfoRequest|\bdecodeTeamInfoResponse/.test(source));
	});

	test('grpcClient Team seven mutators use bytes; decode is TS result not JSON {success}', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const candidates = [
			path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc/grpcClient.ts'),
			path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc/grpcClient.ts'),
		];
		const clientPath = candidates.find(candidate => fs.existsSync(candidate));
		assert.ok(clientPath, 'grpcClient.ts not found from cwd or import.meta');
		const source = fs.readFileSync(clientPath, 'utf8');
		const methods: Array<{ name: string; encoder: string; decoder: string }> = [
			{ name: 'startMember', encoder: 'encodeStartMemberRequest', decoder: 'decodeStartMemberResponse' },
			{ name: 'killMember', encoder: 'encodeKillMemberRequest', decoder: 'decodeKillMemberResponse' },
			{ name: 'createTeam', encoder: 'encodeCreateTeamRequest', decoder: 'decodeCreateTeamResponse' },
			{ name: 'abort', encoder: 'encodeAbortTeamRequest', decoder: 'decodeAbortTeamResponse' },
			{ name: 'taskUpdate', encoder: 'encodeTaskUpdateRequest', decoder: 'decodeTaskUpdateResponse' },
			{ name: 'taskCancel', encoder: 'encodeTaskCancelRequest', decoder: 'decodeTaskCancelResponse' },
			{ name: 'messageMember', encoder: 'encodeMessageMemberRequest', decoder: 'decodeMessageMemberResponse' },
		];
		for (const { name, encoder, decoder } of methods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
			assert.ok(!body.includes('JSON.stringify'), `${name} must not JSON.stringify`);
			assert.ok(!body.includes('wire.success'), `${name} must not remap JSON {success}`);
		}
	});
});

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

function protoRepeatedStrings(encoded: Uint8Array, fieldNumber: number): string[] {
	const values: string[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return values;
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
