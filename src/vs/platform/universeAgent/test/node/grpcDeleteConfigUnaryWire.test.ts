/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentDeleteRemoteAgentConfigResult } from '../../common/universeAgentTypes.js';
import {
	decodeDeleteConfigResponse,
	encodeDeleteConfigRequest,
	type DeleteRemoteAgentConfigResponseWire,
} from '../../node/grpc/grpcDeleteConfigUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService DeleteConfig protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeDeleteConfigRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeDeleteConfigRequest({
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

		assert.strictEqual(encodeDeleteConfigRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeDeleteConfigResponse reads success=1; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeDeleteConfigResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse(wire), {
			success: true,
		});

		const empty = decodeDeleteConfigResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
		});
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse(empty), {
			success: false,
		});
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse({ success: false }), { success: false });

		const unusedOnly = decodeDeleteConfigResponse(encodeStringField(2, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
		});
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse(unusedOnly), { success: false });

		const explicitFalse = decodeDeleteConfigResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
		});
		assert.deepStrictEqual(mapDeleteRemoteAgentConfigResponse(explicitFalse), { success: false });
	});

	test('delete-config unary wire is RemoteAgentService.DeleteConfig only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcDeleteConfigUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeDeleteConfigRequest\b/.test(source));
		assert.ok(/\bdecodeDeleteConfigResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bSetMaintenance\b|\bExitMaintenance\b|\bResetError\b/.test(source));
		assert.ok(!/\bSaveConfig\b|\bListConfigs\b|\bGetConfig\b|\bReload\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('deleteRemoteAgentConfig uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const del = extractAsyncMethod(source, 'deleteRemoteAgentConfig');
		assert.ok(del.includes('makeUnaryBytesClient'), 'deleteRemoteAgentConfig must use makeUnaryBytesClient');
		assert.ok(del.includes('encodeDeleteConfigRequest'), 'deleteRemoteAgentConfig must call encodeDeleteConfigRequest');
		assert.ok(del.includes('decodeDeleteConfigResponse'), 'deleteRemoteAgentConfig must call decodeDeleteConfigResponse');
		assert.ok(del.includes('mapDeleteRemoteAgentConfigResponse'), 'deleteRemoteAgentConfig still calls mapDeleteRemoteAgentConfigResponse');
		assert.ok(!del.includes('makeUnaryClient<'), 'deleteRemoteAgentConfig must not use JSON makeUnaryClient');
		assert.ok(!del.includes('JSON.stringify'), 'deleteRemoteAgentConfig must not JSON.stringify');

		assert.ok(source.includes('grpcDeleteConfigUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

/** Same mapping as RemoteAgent.DeleteConfig JSON unary (`success: wire.success === true`). */
function mapDeleteRemoteAgentConfigResponse(wire: DeleteRemoteAgentConfigResponseWire): UniverseAgentDeleteRemoteAgentConfigResult {
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcDeleteConfigUnaryWire.ts')));
	assert.ok(dir, 'grpcDeleteConfigUnaryWire.ts not found from cwd or import.meta');
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
