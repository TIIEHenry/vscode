/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentTrigger } from '../../common/universeAgentTypes.js';
import {
	mapDeleteTriggerResponse,
	mapFireTriggerResponse,
	mapListTriggersResponse,
	mapSetTriggerEnabledResponse,
	mapTriggerDto,
	mapUpsertTriggerResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeDeleteTriggerResponse,
	decodeFireTriggerResponse,
	decodeListTriggersResponse,
	decodeSetTriggerEnabledResponse,
	decodeUpsertTriggerResponse,
	encodeDeleteTriggerRequest,
	encodeFireTriggerRequest,
	encodeListTriggersRequest,
	encodeSetTriggerEnabledRequest,
	encodeUpsertTriggerRequest,
} from '../../node/grpc/grpcTriggerUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodePresentMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc TriggerService List/Upsert/Delete/SetEnabled/Fire protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeListTriggersRequest writes scope=1 scope_id=2 type_filter=3; omits empty; not JSON', () => {
		const encoded = encodeListTriggersRequest({
			scope: 'session',
			scopeId: 'sess-1',
			typeFilter: 'schedule',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			scope: 'session',
			scope_id: 'sess-1',
			type_filter: 'schedule',
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'session');
		assert.strictEqual(protoStrings(encoded).get(2), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(3), 'schedule');
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));

		const noFilter = encodeListTriggersRequest({ scope: 'session', scopeId: 'sess-1', typeFilter: '' });
		assert.strictEqual(protoStrings(noFilter).get(1), 'session');
		assert.strictEqual(protoStrings(noFilter).get(2), 'sess-1');
		assert.ok(!protoStrings(noFilter).has(3));
		assert.notStrictEqual(noFilter[0], 0x7b);

		assert.strictEqual(encodeListTriggersRequest({ scope: '', scopeId: '', typeFilter: '' }).length, 0);
	});

	test('decodeListTriggersResponse reads triggers=1 TriggerDto 1-10 then mapper; unused unread', () => {
		const trigger = Buffer.concat([
			encodeStringField(1, 'trg-1'),
			encodeStringField(2, 'nightly'),
			encodeStringField(3, 'schedule'),
			encodeStringField(4, 'run'),
			encodeInt32Field(5, 1),
			encodeStringField(6, 'paused'),
			encodeMessageField(7, encodePresentMessageField(2, encodeStringField(1, 'sess-9'))),
			encodeInt64Field(8, 60_000),
			encodeStringField(9, '0 * * * *'),
			encodeInt64Field(10, 1_700_000_000_000),
			encodeStringField(11, 'unused-nested'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, trigger),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeListTriggersResponse(encoded);
		assert.deepStrictEqual(wire, {
			triggers: [{
				trigger_id: 'trg-1',
				name: 'nightly',
				type: 'schedule',
				prompt_template: 'run',
				enabled: true,
				pause_reason: 'paused',
				target: {
					self: undefined,
					bound_session: { session_id: 'sess-9' },
					new_session: undefined,
				},
				interval_ms: 60_000,
				cron_expression: '0 * * * *',
				run_at_epoch_ms: 1_700_000_000_000,
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListTriggersResponse(wire), {
			triggers: [{
				triggerId: 'trg-1',
				name: 'nightly',
				type: 'schedule',
				promptTemplate: 'run',
				enabled: true,
				pauseReason: 'paused',
				target: { kind: 'boundSession', sessionId: 'sess-9' },
				intervalMs: 60_000,
				cronExpression: '0 * * * *',
				runAtEpochMs: 1_700_000_000_000,
			}],
		});

		const empty = decodeListTriggersResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { triggers: [] });
		assert.deepStrictEqual(mapListTriggersResponse(empty), { triggers: [] });

		const omitted = decodeListTriggersResponse(encodeMessageField(1, encodeStringField(1, 'only')));
		assert.deepStrictEqual(mapListTriggersResponse(omitted), {
			triggers: [mapTriggerDto({ trigger_id: 'only' })],
		});
		assert.deepStrictEqual(mapTriggerDto({}), {
			triggerId: '',
			name: '',
			type: '',
			promptTemplate: '',
			enabled: false,
			pauseReason: '',
			target: { kind: 'unspecified' },
			intervalMs: 0,
			cronExpression: '',
			runAtEpochMs: 0,
		});
	});

	test('encodeUpsertTriggerRequest writes scope=1 scope_id=2 trigger=3; self empty present; omits empty/0/false', () => {
		const encoded = encodeUpsertTriggerRequest({
			scope: 'session',
			scopeId: 'sess-1',
			trigger: sampleTrigger(),
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			scope: 'session',
			scope_id: 'sess-1',
			trigger: { trigger_id: 'trg-1' },
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'session');
		assert.strictEqual(protoStrings(encoded).get(2), 'sess-1');
		const trigger = mustNested(encoded, 3);
		assert.strictEqual(protoStrings(trigger).get(1), 'trg-1');
		assert.strictEqual(protoStrings(trigger).get(2), 'nightly');
		assert.strictEqual(protoStrings(trigger).get(3), 'schedule');
		assert.strictEqual(protoStrings(trigger).get(4), 'run');
		assert.strictEqual(protoVarints(trigger).get(5), 1);
		assert.strictEqual(protoStrings(trigger).get(6), 'paused');
		assert.strictEqual(protoVarints(trigger).get(8), 60_000);
		assert.strictEqual(protoStrings(trigger).get(9), '0 * * * *');
		assert.strictEqual(protoVarints(trigger).get(10), 1_700_000_000_000);
		const target = mustNested(trigger, 7);
		const self = mustNested(target, 1);
		assert.strictEqual(self.length, 0);
		assert.ok(!protoNested(target, 2));
		assert.ok(!protoNested(target, 3));

		const bound = encodeUpsertTriggerRequest({
			scope: 'project',
			scopeId: '/repo',
			trigger: sampleTrigger({
				target: { kind: 'boundSession', sessionId: 'sess-9' },
			}),
		});
		assert.strictEqual(protoStrings(mustNested(mustNested(bound, 3), 7)).get(1), undefined);
		assert.strictEqual(protoStrings(mustNested(mustNested(mustNested(bound, 3), 7), 2)).get(1), 'sess-9');

		const neu = encodeUpsertTriggerRequest({
			scope: 'session',
			scopeId: 'sess-1',
			trigger: sampleTrigger({
				target: { kind: 'newSession', engineProfileId: 'prof-1' },
			}),
		});
		assert.strictEqual(protoStrings(mustNested(mustNested(mustNested(neu, 3), 7), 3)).get(1), 'prof-1');

		const omitted = encodeUpsertTriggerRequest({
			scope: '',
			scopeId: '',
			trigger: sampleTrigger({
				triggerId: '',
				name: '',
				type: '',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'unspecified' },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			}),
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoNested(omitted, 3));
		assert.notStrictEqual(omitted[0], 0x7b);

		const emptyBound = encodeUpsertTriggerRequest({
			scope: 'session',
			scopeId: 'sess-1',
			trigger: sampleTrigger({
				triggerId: '',
				name: '',
				type: '',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'boundSession', sessionId: '' },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			}),
		});
		const emptyBoundTarget = mustNested(mustNested(emptyBound, 3), 7);
		assert.strictEqual(mustNested(emptyBoundTarget, 2).length, 0);
		assert.ok(!protoNested(emptyBoundTarget, 1));
	});

	test('decodeUpsertTriggerResponse reads trigger=1 including empty self oneof; unused unread', () => {
		const trigger = Buffer.concat([
			encodeStringField(1, 'trg-2'),
			encodeStringField(2, 'hourly'),
			encodeMessageField(7, encodePresentMessageField(1, new Uint8Array(0))),
			encodeStringField(11, 'unused-nested'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, trigger),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeUpsertTriggerResponse(encoded);
		assert.deepStrictEqual(wire.trigger?.target, {
			self: {},
			bound_session: undefined,
			new_session: undefined,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapUpsertTriggerResponse(wire), {
			trigger: {
				triggerId: 'trg-2',
				name: 'hourly',
				type: '',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'self' },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			},
		});

		const empty = decodeUpsertTriggerResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { trigger: undefined });
		assert.deepStrictEqual(mapUpsertTriggerResponse(empty), {
			trigger: mapTriggerDto({}),
		});

		const newSession = decodeUpsertTriggerResponse(encodeMessageField(1, encodeMessageField(7, encodeMessageField(3, encodeStringField(1, 'prof-2')))));
		assert.deepStrictEqual(mapUpsertTriggerResponse(newSession).trigger.target, {
			kind: 'newSession',
			engineProfileId: 'prof-2',
		});
	});

	test('encodeDeleteTriggerRequest writes scope=1 scope_id=2 trigger_id=3; omits empty; not JSON', () => {
		const encoded = encodeDeleteTriggerRequest({
			scope: 'session',
			scopeId: 'sess-1',
			triggerId: 'trg-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			scope: 'session',
			scope_id: 'sess-1',
			trigger_id: 'trg-1',
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'session');
		assert.strictEqual(protoStrings(encoded).get(2), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(3), 'trg-1');
		assert.ok(!protoStrings(encoded).has(4));
		assert.strictEqual(encodeDeleteTriggerRequest({ scope: '', scopeId: '', triggerId: '' }).length, 0);
	});

	test('decodeDeleteTriggerResponse is empty then mapper; unused unread', () => {
		const encoded = encodeStringField(1, 'unused-field');
		const wire = decodeDeleteTriggerResponse(encoded);
		assert.deepStrictEqual(wire, {});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapDeleteTriggerResponse(wire), {});
		assert.deepStrictEqual(mapDeleteTriggerResponse(decodeDeleteTriggerResponse(new Uint8Array(0))), {});
	});

	test('encodeSetTriggerEnabledRequest writes 1-4; omits empty/false; not JSON', () => {
		const encoded = encodeSetTriggerEnabledRequest({
			scope: 'session',
			scopeId: 'sess-1',
			triggerId: 'trg-1',
			enabled: true,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			scope: 'session',
			scope_id: 'sess-1',
			trigger_id: 'trg-1',
			enabled: true,
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'session');
		assert.strictEqual(protoStrings(encoded).get(2), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(3), 'trg-1');
		assert.strictEqual(protoVarints(encoded).get(4), 1);

		const disabled = encodeSetTriggerEnabledRequest({
			scope: 'session',
			scopeId: 'sess-1',
			triggerId: 'trg-1',
			enabled: false,
		});
		assert.ok(!protoVarints(disabled).has(4));
		assert.strictEqual(protoStrings(disabled).get(3), 'trg-1');
		assert.notStrictEqual(disabled[0], 0x7b);

		assert.strictEqual(encodeSetTriggerEnabledRequest({
			scope: '',
			scopeId: '',
			triggerId: '',
			enabled: false,
		}).length, 0);
	});

	test('decodeSetTriggerEnabledResponse reads trigger=1 then mapper; unused unread', () => {
		const encoded = Buffer.concat([
			encodeMessageField(1, Buffer.concat([
				encodeStringField(1, 'trg-3'),
				encodeInt32Field(5, 1),
				encodeStringField(11, 'unused-nested'),
			])),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSetTriggerEnabledResponse(encoded);
		assert.strictEqual(wire.trigger?.trigger_id, 'trg-3');
		assert.strictEqual(wire.trigger?.enabled, true);
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSetTriggerEnabledResponse(wire), {
			trigger: {
				...mapTriggerDto({}),
				triggerId: 'trg-3',
				enabled: true,
			},
		});
		assert.deepStrictEqual(mapSetTriggerEnabledResponse(decodeSetTriggerEnabledResponse(new Uint8Array(0))), {
			trigger: mapTriggerDto({}),
		});
	});

	test('encodeFireTriggerRequest writes scope=1 scope_id=2 trigger_id=3; omits empty; not JSON', () => {
		const encoded = encodeFireTriggerRequest({
			scope: 'session',
			scopeId: 'sess-1',
			triggerId: 'trg-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			scope: 'session',
			scope_id: 'sess-1',
			trigger_id: 'trg-1',
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'session');
		assert.strictEqual(protoStrings(encoded).get(2), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(3), 'trg-1');
		assert.ok(!protoStrings(encoded).has(4));
		assert.strictEqual(encodeFireTriggerRequest({ scope: '', scopeId: '', triggerId: '' }).length, 0);
	});

	test('decodeFireTriggerResponse reads status=1 event_id=2 reason=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'FIRED'),
			encodeStringField(2, 'evt-9'),
			encodeStringField(3, 'ok'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeFireTriggerResponse(encoded);
		assert.deepStrictEqual(wire, {
			status: 'FIRED',
			event_id: 'evt-9',
			reason: 'ok',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapFireTriggerResponse(wire), {
			status: 'FIRED',
			eventId: 'evt-9',
			reason: 'ok',
		});

		const empty = decodeFireTriggerResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			status: undefined,
			event_id: undefined,
			reason: undefined,
		});
		assert.deepStrictEqual(mapFireTriggerResponse(empty), {
			status: '',
			eventId: '',
			reason: '',
		});
	});

	test('trigger unary wire is five unaries only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcTriggerUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeListTriggersRequest\b/.test(source));
		assert.ok(/\bdecodeListTriggersResponse\b/.test(source));
		assert.ok(/\bencodeUpsertTriggerRequest\b/.test(source));
		assert.ok(/\bdecodeUpsertTriggerResponse\b/.test(source));
		assert.ok(/\bencodeDeleteTriggerRequest\b/.test(source));
		assert.ok(/\bdecodeDeleteTriggerResponse\b/.test(source));
		assert.ok(/\bencodeSetTriggerEnabledRequest\b/.test(source));
		assert.ok(/\bdecodeSetTriggerEnabledResponse\b/.test(source));
		assert.ok(/\bencodeFireTriggerRequest\b/.test(source));
		assert.ok(/\bdecodeFireTriggerResponse\b/.test(source));
		assert.ok(/\bencodeMessageField\b/.test(source));
		assert.ok(/\bencodePresentMessageField\b/.test(source));
		assert.ok(!/\bRegisterSessionEngineTrigger\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});
});

function sampleTrigger(overrides: Partial<UniverseAgentTrigger> = {}): UniverseAgentTrigger {
	return {
		triggerId: 'trg-1',
		name: 'nightly',
		type: 'schedule',
		promptTemplate: 'run',
		enabled: true,
		pauseReason: 'paused',
		target: { kind: 'self' },
		intervalMs: 60_000,
		cronExpression: '0 * * * *',
		runAtEpochMs: 1_700_000_000_000,
		...overrides,
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcTriggerUnaryWire.ts')));
	assert.ok(dir, 'grpcTriggerUnaryWire.ts not found from cwd or import.meta');
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

function protoNested(encoded: Uint8Array, fieldNumber: number): Uint8Array | undefined {
	let found: Uint8Array | undefined;
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			found = field.bytes;
		}
	}
	return found;
}

function mustNested(encoded: Uint8Array, fieldNumber: number): Uint8Array {
	const nested = protoNested(encoded, fieldNumber);
	assert.ok(nested !== undefined);
	return nested;
}
