/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentResetErrorResult } from '../../common/universeAgentTypes.js';
import {
	decodeResetErrorResponse,
	encodeResetErrorRequest,
	type ResetErrorResponseWire,
} from '../../node/grpc/grpcResetErrorUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService ResetError protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeResetErrorRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeResetErrorRequest({
			nodeId: 'node-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			node_id: 'node-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'node-1',
		});
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeResetErrorRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeResetErrorResponse reads success=1; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeResetErrorResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapResetErrorResponse(wire), {
			success: true,
		});

		const empty = decodeResetErrorResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
		});
		assert.deepStrictEqual(mapResetErrorResponse(empty), {
			success: false,
		});
		assert.deepStrictEqual(mapResetErrorResponse({ success: false }), { success: false });
	});

	test('reset-error unary wire is RemoteAgentService.ResetError only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcResetErrorUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeResetErrorRequest\b/.test(source));
		assert.ok(/\bdecodeResetErrorResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bSetMaintenance\b|\bExitMaintenance\b/.test(source));
		assert.ok(!/\bencodeResetRequest\b|\bdecodeResetResponse\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY resetError still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const reset = extractAsyncMethod(source, 'resetError');
		assert.ok(reset.includes('makeUnaryClient<'), 'resetError still uses JSON makeUnaryClient');
		assert.ok(!reset.includes('makeUnaryBytesClient'), 'resetError must not use makeUnaryBytesClient this slice');
		assert.ok(!reset.includes('encodeResetErrorRequest'), 'resetError must not call encodeResetErrorRequest this slice');
		assert.ok(!reset.includes('decodeResetErrorResponse'), 'resetError must not call decodeResetErrorResponse this slice');
		assert.ok(reset.includes('node_id'), 'resetError still sends node_id JSON key');
		assert.ok(reset.includes('mapResetErrorResponse'), 'resetError still calls mapResetErrorResponse');
		assert.ok(!source.includes('grpcResetErrorUnaryWire'));
		assert.ok(!/\bWatch\b/.test(reset));
	});
});

/** Same mapping as RemoteAgent.ResetError JSON unary (`success: wire.success === true`). */
function mapResetErrorResponse(wire: ResetErrorResponseWire): UniverseAgentResetErrorResult {
	return {
		success: wire.success === true,
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcResetErrorUnaryWire.ts')));
	assert.ok(dir, 'grpcResetErrorUnaryWire.ts not found from cwd or import.meta');
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
