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
	mapHealthCheckResponse,
	mapShutdownResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeHealthCheckResponse,
	decodeShutdownResponse,
	encodeHealthCheckRequest,
	encodeShutdownRequest,
} from '../../node/grpc/grpcSystemUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc SystemService HealthCheck / Shutdown protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeHealthCheckRequest is empty proto, not JSON {}', () => {
		const encoded = encodeHealthCheckRequest();
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), '{}');
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({}));
		assert.deepStrictEqual(Array.from(readProtoFields(encoded)), []);
	});

	test('decodeHealthCheckResponse reads status=1 version=2 active_sessions=3 uptime_ms=4; unused unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'SERVING'),
			encodeStringField(2, '1.2.3'),
			encodeInt32Field(3, 4),
			encodeInt64Field(4, 1500),
			encodeStringField(5, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeHealthCheckResponse(encoded);
		assert.deepStrictEqual(wire, {
			status: 'SERVING',
			version: '1.2.3',
			active_sessions: 4,
			uptime_ms: 1500,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapHealthCheckResponse(wire), {
			status: 'SERVING',
			version: '1.2.3',
			activeSessions: 4,
			uptimeMs: 1500,
		});
		const empty = decodeHealthCheckResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			status: undefined,
			version: undefined,
			active_sessions: undefined,
			uptime_ms: undefined,
		});
		assert.deepStrictEqual(mapHealthCheckResponse(empty), {
			status: '',
			version: '',
			activeSessions: 0,
			uptimeMs: 0,
		});
	});

	test('encodeShutdownRequest writes force=1 grace_period_ms=2; omits false/0; not JSON', () => {
		const encoded = encodeShutdownRequest({ force: true, gracePeriodMs: 30000 });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ force: true, grace_period_ms: 30000 }));
		assert.strictEqual(protoVarints(encoded).get(1), 1);
		assert.strictEqual(protoVarints(encoded).get(2), 30000);
		const forceFalse = encodeShutdownRequest({ force: false, gracePeriodMs: 30000 });
		assert.ok(!protoVarints(forceFalse).has(1));
		assert.strictEqual(protoVarints(forceFalse).get(2), 30000);
		assert.notStrictEqual(forceFalse[0], 0x7b);
		const omitted = encodeShutdownRequest({ force: false, gracePeriodMs: 0 });
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(1));
		assert.ok(!protoVarints(omitted).has(2));
		assert.notStrictEqual(omitted[0], 0x7b);
	});

	test('decodeShutdownResponse reads accepted=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'shutting down'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeShutdownResponse(encoded);
		assert.deepStrictEqual(wire, { accepted: true, message: 'shutting down' });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapShutdownResponse(wire), {
			accepted: true,
			message: 'shutting down',
		});
		const empty = decodeShutdownResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { accepted: false, message: undefined });
		assert.deepStrictEqual(mapShutdownResponse(empty), { accepted: false, message: '' });
		const rejected = decodeShutdownResponse(encodeInt32Field(1, 0));
		assert.deepStrictEqual(rejected, { accepted: false, message: undefined });
		assert.deepStrictEqual(mapShutdownResponse(rejected), { accepted: false, message: '' });
	});

	test('system unary wire source has no JSON.stringify and does not encode Doctor/Connect', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcSystemUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(!/\bencodeDoctor|\bdecodeDoctor|\bmapDoctor/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect/.test(source));
		assert.ok(!/\bGetAuthNonce\b|\bAuthNonce\b/.test(source));
		assert.ok(!/\bgrpcClient\b/.test(source));
	});

	test('grpcClient HealthCheck / Shutdown use bytes; decode then map*', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcClient.ts'), 'utf8');
		const methods: Array<{ name: string; encoder: string; decoder: string; mapper: string }> = [
			{ name: 'healthCheck', encoder: 'encodeHealthCheckRequest', decoder: 'decodeHealthCheckResponse', mapper: 'mapHealthCheckResponse' },
			{ name: 'shutdown', encoder: 'encodeShutdownRequest', decoder: 'decodeShutdownResponse', mapper: 'mapShutdownResponse' },
		];
		for (const { name, encoder, decoder, mapper } of methods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(body.includes(mapper), `${name} must call ${mapper}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
			assert.ok(!body.includes('JSON.stringify'), `${name} must not JSON.stringify`);
		}
		assert.ok(source.includes('grpcSystemUnaryWire'));
	});
});

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
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
