/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentInstallSessionDemoFakeResult } from '../../common/universeAgentTypes.js';
import { mapFireTriggerWebhookStatus } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeFireTriggerWebhookResponse,
	decodeInstallSessionDemoFakeResponse,
	encodeFireTriggerWebhookRequest,
	encodeInstallSessionDemoFakeRequest,
	type InstallSessionDemoFakeResponseWire,
} from '../../node/grpc/grpcFireTriggerWebhookUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

/** Binary payload that is not valid UTF-8 and not a JSON object (`{` present as raw bytes). */
const QUEUES_PAYLOAD = Uint8Array.from([0x00, 0xff, 0xfe, 0x7b, 0x22]);

suite('grpc AgentService FireTriggerWebhook / InstallSessionDemoFake protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeFireTriggerWebhookRequest writes session_id=1 trigger_id=2 payload_json=3; omits empty/absent; not JSON', () => {
		const encoded = encodeFireTriggerWebhookRequest({
			sessionId: 'sess-1',
			triggerId: 'trg-9',
			payloadJson: '{"k":1}',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			trigger_id: 'trg-9',
			payload_json: '{"k":1}',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'trg-9',
			3: '{"k":1}',
		});
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));

		const noPayload = encodeFireTriggerWebhookRequest({
			sessionId: 'sess-1',
			triggerId: 'trg-9',
			payloadJson: '',
		});
		assert.strictEqual(protoStrings(noPayload).get(1), 'sess-1');
		assert.strictEqual(protoStrings(noPayload).get(2), 'trg-9');
		assert.ok(!protoStrings(noPayload).has(3));
		assert.notStrictEqual(noPayload[0], 0x7b);

		assert.strictEqual(encodeFireTriggerWebhookRequest({
			sessionId: '',
			triggerId: '',
			payloadJson: '',
		}).length, 0);
	});

	test('decodeFireTriggerWebhookResponse reads status=1 enum 0-4 event_id=2 reason=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'evt-9'),
			encodeStringField(3, 'ok'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeFireTriggerWebhookResponse(encoded);
		assert.deepStrictEqual(wire, {
			status: 1,
			event_id: 'evt-9',
			reason: 'ok',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.strictEqual(mapFireTriggerWebhookStatus(wire.status), 'FIRE_TRIGGER_WEBHOOK_STATUS_QUEUED');
		assert.deepStrictEqual({
			status: mapFireTriggerWebhookStatus(wire.status),
			eventId: wire.event_id ?? '',
			reason: wire.reason ?? '',
		}, {
			status: 'FIRE_TRIGGER_WEBHOOK_STATUS_QUEUED',
			eventId: 'evt-9',
			reason: 'ok',
		});

		const names = [0, 1, 2, 3, 4].map(value => {
			const body = value === 0
				? encodeEnumInclZero(1, 0)
				: encodeInt32Field(1, value);
			return mapFireTriggerWebhookStatus(decodeFireTriggerWebhookResponse(body).status);
		});
		assert.deepStrictEqual(names, [
			'FIRE_TRIGGER_WEBHOOK_STATUS_UNSPECIFIED',
			'FIRE_TRIGGER_WEBHOOK_STATUS_QUEUED',
			'FIRE_TRIGGER_WEBHOOK_STATUS_EXECUTED',
			'FIRE_TRIGGER_WEBHOOK_STATUS_REJECTED',
			'FIRE_TRIGGER_WEBHOOK_STATUS_SKIPPED',
		]);

		const empty = decodeFireTriggerWebhookResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			status: undefined,
			event_id: undefined,
			reason: undefined,
		});
		assert.strictEqual(mapFireTriggerWebhookStatus(empty.status), '');
		assert.deepStrictEqual({
			status: mapFireTriggerWebhookStatus(empty.status),
			eventId: empty.event_id ?? '',
			reason: empty.reason ?? '',
		}, {
			status: '',
			eventId: '',
			reason: '',
		});
	});

	test('encodeInstallSessionDemoFakeRequest writes session_id=1 queues_payload=2 bytes content_type=3 playbook_id=4; omits empty; not JSON/base64', () => {
		const encoded = encodeInstallSessionDemoFakeRequest({
			sessionId: 'sess-1',
			queuesPayload: QUEUES_PAYLOAD,
			contentType: 'application/vnd.universe.scripted-queues.v1+json',
			playbookId: 'pb-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			queues_payload: Buffer.from(QUEUES_PAYLOAD).toString('base64'),
			content_type: 'application/vnd.universe.scripted-queues.v1+json',
			playbook_id: 'pb-1',
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []), Buffer.from(QUEUES_PAYLOAD));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []).toString('utf8'), Buffer.from(QUEUES_PAYLOAD).toString('base64'));
		assert.strictEqual(protoStrings(encoded).get(3), 'application/vnd.universe.scripted-queues.v1+json');
		assert.strictEqual(protoStrings(encoded).get(4), 'pb-1');
		assert.ok(!protoStrings(encoded).has(5));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const omitted = encodeInstallSessionDemoFakeRequest({
			sessionId: '',
			queuesPayload: new Uint8Array(0),
			contentType: '',
			playbookId: '',
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoBytes(omitted, 2));
	});

	test('decodeInstallSessionDemoFakeResponse reads success=1 message=2 reason_code=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'installed'),
			encodeStringField(3, 'OK'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeInstallSessionDemoFakeResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'installed',
			reason_code: 'OK',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapInstallSessionDemoFake(wire), {
			ok: true,
			message: 'installed',
			reasonCode: 'OK',
		});

		const empty = decodeInstallSessionDemoFakeResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			reason_code: undefined,
		});
		assert.deepStrictEqual(mapInstallSessionDemoFake(empty), {
			ok: false,
			message: undefined,
			reasonCode: '',
		});
	});

	test('fire-trigger-webhook unary wire is FireTriggerWebhook + InstallSessionDemoFake only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcFireTriggerWebhookUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeFireTriggerWebhookRequest\b/.test(source));
		assert.ok(/\bdecodeFireTriggerWebhookResponse\b/.test(source));
		assert.ok(/\bencodeInstallSessionDemoFakeRequest\b/.test(source));
		assert.ok(/\bdecodeInstallSessionDemoFakeResponse\b/.test(source));
		assert.ok(/\bencodeBytesField\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bClearSessionDemoFake\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('fireTriggerWebhook / installSessionDemoFake use bytes then map*; skip Connect/SaveSkillContent/Watch', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const fire = extractAsyncMethod(source, 'fireTriggerWebhook');
		assert.ok(fire.includes('makeUnaryBytesClient'), 'fireTriggerWebhook must use makeUnaryBytesClient');
		assert.ok(fire.includes('encodeFireTriggerWebhookRequest'), 'fireTriggerWebhook must call encodeFireTriggerWebhookRequest');
		assert.ok(fire.includes('decodeFireTriggerWebhookResponse'), 'fireTriggerWebhook must call decodeFireTriggerWebhookResponse');
		assert.ok(fire.includes('mapFireTriggerWebhookStatus'), 'fireTriggerWebhook must call mapFireTriggerWebhookStatus');
		assert.ok(!fire.includes('makeUnaryClient<'), 'fireTriggerWebhook must not use JSON makeUnaryClient');
		assert.ok(!fire.includes('JSON.stringify'), 'fireTriggerWebhook must not JSON.stringify');

		const install = extractAsyncMethod(source, 'installSessionDemoFake');
		assert.ok(install.includes('makeUnaryBytesClient'), 'installSessionDemoFake must use makeUnaryBytesClient');
		assert.ok(install.includes('encodeInstallSessionDemoFakeRequest'), 'installSessionDemoFake must call encodeInstallSessionDemoFakeRequest');
		assert.ok(install.includes('decodeInstallSessionDemoFakeResponse'), 'installSessionDemoFake must call decodeInstallSessionDemoFakeResponse');
		assert.ok(!install.includes('makeUnaryClient<'), 'installSessionDemoFake must not use JSON makeUnaryClient');
		assert.ok(!install.includes('JSON.stringify'), 'installSessionDemoFake must not JSON.stringify');
		assert.ok(!install.includes('bytesToBase64'), 'installSessionDemoFake must not base64 queues_payload');

		assert.ok(source.includes('grpcFireTriggerWebhookUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

/** Same mapping as Agent.InstallSessionDemoFake JSON unary (`ok: wire.success === true`). */
function mapInstallSessionDemoFake(wire: InstallSessionDemoFakeResponseWire): UniverseAgentInstallSessionDemoFakeResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		reasonCode: wire.reason_code ?? '',
	};
}

function encodeEnumInclZero(field: number, value: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(value),
	]);
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcFireTriggerWebhookUnaryWire.ts')));
	assert.ok(dir, 'grpcFireTriggerWebhookUnaryWire.ts not found from cwd or import.meta');
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

function protoBytes(encoded: Uint8Array, fieldNumber: number): Uint8Array | undefined {
	let found: Uint8Array | undefined;
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			found = field.bytes;
		}
	}
	return found;
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
