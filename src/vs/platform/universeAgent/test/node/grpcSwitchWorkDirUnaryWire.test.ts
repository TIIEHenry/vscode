/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSwitchWorkDirResult } from '../../common/universeAgentTypes.js';
import {
	decodeSwitchWorkDirResponse,
	encodeSwitchWorkDirRequest,
	type SwitchWorkDirResponseWire,
} from '../../node/grpc/grpcSwitchWorkDirUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService SwitchWorkDir protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSwitchWorkDirRequest writes session_id=1 agent_id=2 new_work_dir=3; omits empty; not JSON', () => {
		const encoded = encodeSwitchWorkDirRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			newWorkDir: '/tmp/work',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'root',
			new_work_dir: '/tmp/work',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			3: '/tmp/work',
		});
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));

		const emptyDir = encodeSwitchWorkDirRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			newWorkDir: '',
		});
		assert.strictEqual(protoStrings(emptyDir).get(1), 'sess-1');
		assert.strictEqual(protoStrings(emptyDir).get(2), 'root');
		assert.ok(!protoStrings(emptyDir).has(3));
		assert.ok(!protoStrings(emptyDir).has(4));
		assert.notStrictEqual(emptyDir[0], 0x7b);

		assert.strictEqual(encodeSwitchWorkDirRequest({
			sessionId: '',
			agentId: '',
			newWorkDir: '',
		}).length, 0);
	});

	test('decodeSwitchWorkDirResponse reads success=1 previous_work_dir=2 current_work_dir=3 message=4; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, '/old'),
			encodeStringField(3, '/new'),
			encodeStringField(4, 'switched'),
			encodeStringField(5, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSwitchWorkDirResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			previous_work_dir: '/old',
			current_work_dir: '/new',
			message: 'switched',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSwitchWorkDir(wire), {
			ok: true,
			previousWorkDir: '/old',
			currentWorkDir: '/new',
			message: 'switched',
		});

		const empty = decodeSwitchWorkDirResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			previous_work_dir: undefined,
			current_work_dir: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapSwitchWorkDir(empty), {
			ok: false,
			previousWorkDir: '',
			currentWorkDir: '',
			message: undefined,
		});
	});

	test('switch-workdir unary wire is SwitchWorkDir only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcSwitchWorkDirUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeSwitchWorkDirRequest\b/.test(source));
		assert.ok(/\bdecodeSwitchWorkDirResponse\b/.test(source));
		assert.ok(!/\bConnect\b|\bSaveSkillContent\b|\bGetModelPreferences\b|\bWatch\b|\bClearSessionDemoFake\b|\bResolveTurn\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});
});

/** Same mapping as Agent.SwitchWorkDir JSON unary (`ok: wire.success === true`). */
function mapSwitchWorkDir(wire: SwitchWorkDirResponseWire): UniverseAgentSwitchWorkDirResult {
	return {
		ok: wire.success === true,
		previousWorkDir: wire.previous_work_dir ?? '',
		currentWorkDir: wire.current_work_dir ?? '',
		message: wire.message,
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcSwitchWorkDirUnaryWire.ts')));
	assert.ok(dir, 'grpcSwitchWorkDirUnaryWire.ts not found from cwd or import.meta');
	return dir;
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
