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
import { mapDoctorResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeDoctorResponse,
	decodeHealthCheckResponse,
	decodeShutdownResponse,
	encodeDoctorRequest,
	encodeHealthCheckRequest,
	encodeShutdownRequest,
} from '../../node/grpc/grpcSystemUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc SystemService HealthCheck / Shutdown / Doctor protobuf wire', () => {

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

	test('encodeDoctorRequest is empty proto, not JSON {}', () => {
		const encoded = encodeDoctorRequest();
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), '{}');
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({}));
		assert.deepStrictEqual(Array.from(readProtoFields(encoded)), []);
	});

	test('decodeDoctorResponse reads checks=1 all_passed=2; nested DoctorCheck 1-4; unused unread', () => {
		const passed = Buffer.concat([
			encodeStringField(1, 'disk'),
			encodeInt32Field(2, 1),
			encodeStringField(3, 'ok'),
			encodeStringField(4, 'grow volume'),
			encodeStringField(5, 'unused-nested'),
		]);
		const failed = Buffer.concat([
			encodeStringField(1, 'net'),
			encodeStringField(3, 'down'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, passed),
			encodeMessageField(1, failed),
			encodeInt32Field(2, 1),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeDoctorResponse(encoded);
		assert.deepStrictEqual(wire, {
			checks: [
				{ name: 'disk', passed: true, message: 'ok', fix_hint: 'grow volume' },
				{ name: 'net', passed: undefined, message: 'down', fix_hint: undefined },
			],
			all_passed: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapDoctorResponse(wire), {
			checks: [
				{ name: 'disk', passed: true, message: 'ok', fixHint: 'grow volume' },
				{ name: 'net', passed: false, message: 'down', fixHint: '' },
			],
			allPassed: true,
		});

		const empty = decodeDoctorResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { checks: [], all_passed: undefined });
		assert.deepStrictEqual(mapDoctorResponse(empty), { checks: [], allPassed: false });

		const omitted = decodeDoctorResponse(encodeMessageField(1, encodeStringField(1, 'solo')));
		assert.deepStrictEqual(omitted, {
			checks: [{ name: 'solo', passed: undefined, message: undefined, fix_hint: undefined }],
			all_passed: undefined,
		});
		assert.deepStrictEqual(mapDoctorResponse(omitted), {
			checks: [{ name: 'solo', passed: false, message: '', fixHint: '' }],
			allPassed: false,
		});
	});

	test('system unary wire source has no JSON.stringify; Doctor encoded; no Connect', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcSystemUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeDoctorRequest\b/.test(source));
		assert.ok(/\bdecodeDoctorResponse\b/.test(source));
		assert.ok(/\bdecodeDoctorCheck\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect/.test(source));
		assert.ok(!/\bGetAuthNonce\b|\bAuthNonce\b/.test(source));
		assert.ok(!/\bgrpcClient\b/.test(source));
	});

	test('doctor unary stays JSON on the System client; encode/decode not wired', () => {
		const client = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const body = extractAsyncMethod(client, 'doctor');
		assert.ok(body.includes('makeUnaryClient<'), 'doctor must stay JSON until a later slice wires bytes');
		assert.ok(!body.includes('makeUnaryBytesClient'), 'doctor must not be wired yet');
		assert.ok(!body.includes('encodeDoctorRequest'), 'doctor must not call encodeDoctorRequest');
		assert.ok(!body.includes('decodeDoctorResponse'), 'doctor must not call decodeDoctorResponse');
		assert.ok(!body.includes('JSON.stringify'), 'doctor must not JSON.stringify');
	});

	test('grpcClient HealthCheck / Shutdown use bytes; decode then map*', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
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

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcSystemUnaryWire.ts')));
	assert.ok(dir, 'grpcSystemUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

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
