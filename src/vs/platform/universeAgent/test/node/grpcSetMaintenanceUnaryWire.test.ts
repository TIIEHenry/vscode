/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSetMaintenanceResult } from '../../common/universeAgentTypes.js';
import {
	decodeSetMaintenanceResponse,
	encodeSetMaintenanceRequest,
	type SetMaintenanceResponseWire,
} from '../../node/grpc/grpcSetMaintenanceUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService SetMaintenance protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSetMaintenanceRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeSetMaintenanceRequest({
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

		assert.strictEqual(encodeSetMaintenanceRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeSetMaintenanceResponse reads success=1; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSetMaintenanceResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSetMaintenance(wire), {
			success: true,
		});

		const empty = decodeSetMaintenanceResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
		});
		assert.deepStrictEqual(mapSetMaintenance(empty), {
			success: false,
		});

		const unusedOnly = decodeSetMaintenanceResponse(encodeStringField(2, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
		});
		assert.deepStrictEqual(mapSetMaintenance(unusedOnly), {
			success: false,
		});

		const explicitFalse = decodeSetMaintenanceResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
		});
		assert.deepStrictEqual(mapSetMaintenance(explicitFalse), {
			success: false,
		});
	});

	test('set-maintenance unary wire is RemoteAgentService.SetMaintenance only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcSetMaintenanceUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeSetMaintenanceRequest\b/.test(source));
		assert.ok(/\bdecodeSetMaintenanceResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bExitMaintenance\b|\bResetError\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY setMaintenance still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const setMaintenance = extractAsyncMethod(source, 'setMaintenance');
		assert.ok(setMaintenance.includes('makeUnaryClient<'), 'setMaintenance still uses JSON makeUnaryClient');
		assert.ok(!setMaintenance.includes('makeUnaryBytesClient'), 'setMaintenance must not use makeUnaryBytesClient this slice');
		assert.ok(!setMaintenance.includes('encodeSetMaintenanceRequest'), 'setMaintenance must not call encodeSetMaintenanceRequest this slice');
		assert.ok(!setMaintenance.includes('decodeSetMaintenanceResponse'), 'setMaintenance must not call decodeSetMaintenanceResponse this slice');
		assert.ok(setMaintenance.includes('node_id'), 'setMaintenance still sends node_id JSON key');
		assert.ok(setMaintenance.includes('mapSetMaintenanceResponse'), 'setMaintenance still maps via mapSetMaintenanceResponse');
		assert.ok(!source.includes('grpcSetMaintenanceUnaryWire'));
		assert.ok(!/\bWatch\b/.test(setMaintenance));
	});
});

/** Same mapping as RemoteAgent.SetMaintenance JSON unary (`success: wire.success === true`). */
function mapSetMaintenance(wire: SetMaintenanceResponseWire): UniverseAgentSetMaintenanceResult {
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcSetMaintenanceUnaryWire.ts')));
	assert.ok(dir, 'grpcSetMaintenanceUnaryWire.ts not found from cwd or import.meta');
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
