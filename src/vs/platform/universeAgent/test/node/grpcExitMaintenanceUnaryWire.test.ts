/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentExitMaintenanceResult } from '../../common/universeAgentTypes.js';
import {
	decodeExitMaintenanceResponse,
	encodeExitMaintenanceRequest,
	type ExitMaintenanceResponseWire,
} from '../../node/grpc/grpcExitMaintenanceUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService ExitMaintenance protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeExitMaintenanceRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeExitMaintenanceRequest({
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

		assert.strictEqual(encodeExitMaintenanceRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeExitMaintenanceResponse reads success=1; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeExitMaintenanceResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapExitMaintenance(wire), {
			success: true,
		});

		const empty = decodeExitMaintenanceResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
		});
		assert.deepStrictEqual(mapExitMaintenance(empty), {
			success: false,
		});

		const encodedFalse = Buffer.from([0x08, 0x00]);
		const falsy = decodeExitMaintenanceResponse(encodedFalse);
		assert.deepStrictEqual(falsy, {
			success: false,
		});
		assert.deepStrictEqual(mapExitMaintenance(falsy), {
			success: false,
		});
	});

	test('exit-maintenance unary wire is RemoteAgentService.ExitMaintenance only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcExitMaintenanceUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeExitMaintenanceRequest\b/.test(source));
		assert.ok(/\bdecodeExitMaintenanceResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSetMaintenance\b/.test(source));
		assert.ok(!/\bResetError\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('exitMaintenance uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const exit = extractAsyncMethod(source, 'exitMaintenance');
		assert.ok(exit.includes('makeUnaryBytesClient'), 'exitMaintenance must use makeUnaryBytesClient');
		assert.ok(exit.includes('encodeExitMaintenanceRequest'), 'exitMaintenance must call encodeExitMaintenanceRequest');
		assert.ok(exit.includes('decodeExitMaintenanceResponse'), 'exitMaintenance must call decodeExitMaintenanceResponse');
		assert.ok(exit.includes('mapExitMaintenanceResponse'), 'exitMaintenance still calls mapExitMaintenanceResponse');
		assert.ok(!exit.includes('makeUnaryClient<'), 'exitMaintenance must not use JSON makeUnaryClient');
		assert.ok(!exit.includes('JSON.stringify'), 'exitMaintenance must not JSON.stringify');

		assert.ok(source.includes('grpcExitMaintenanceUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

/** Same mapping as RemoteAgent.ExitMaintenance JSON unary (`success: wire.success === true`). */
function mapExitMaintenance(wire: ExitMaintenanceResponseWire): UniverseAgentExitMaintenanceResult {
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcExitMaintenanceUnaryWire.ts')));
	assert.ok(dir, 'grpcExitMaintenanceUnaryWire.ts not found from cwd or import.meta');
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
