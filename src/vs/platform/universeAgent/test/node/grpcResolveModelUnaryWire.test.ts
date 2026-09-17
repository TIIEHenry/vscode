/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapResolveModelResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeResolveModelResponse,
	encodeResolveModelRequest,
} from '../../node/grpc/grpcResolveModelUnaryWire.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc ConfigService ResolveModel protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeResolveModelRequest writes session_id=1 type=2; omits empty; not JSON', () => {
		const encoded = encodeResolveModelRequest({
			sessionId: 'sess-1',
			type: 'chat',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			type: 'chat',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'chat',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const sessionOnly = encodeResolveModelRequest({
			sessionId: 'sess-1',
			type: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		const typeOnly = encodeResolveModelRequest({
			sessionId: '',
			type: 'chat',
		});
		assert.ok(!protoStrings(typeOnly).has(1));
		assert.strictEqual(protoStrings(typeOnly).get(2), 'chat');

		assert.strictEqual(encodeResolveModelRequest({
			sessionId: '',
			type: '',
		}).length, 0);
	});

	test('decodeResolveModelResponse reads selected=1 candidates=2 filtered=3 ModelEntry; mapper non-empty', () => {
		const selected = Buffer.concat([
			encodeStringField(1, 'fast'),
			encodeStringField(2, 'chat'),
			encodeInt32Field(3, 1),
			encodeInt32Field(4, 7),
			encodeStringField(5, 'fast chat'),
			encodeStringField(6, 'low'),
			encodeStringField(7, 'high'),
			encodeStringField(8, 'openai'),
			encodeStringField(9, 'gpt-fast'),
			encodeStringField(10, 'unused-nested'),
		]);
		const candidate = Buffer.concat([
			encodeStringField(1, 'cand-1'),
			encodeStringField(2, 'chat'),
			encodeInt32Field(3, 1),
			encodeStringField(9, 'gpt-cand'),
		]);
		const sparseCandidate = encodeStringField(1, 'cand-2');
		const filtered = Buffer.concat([
			encodeStringField(1, 'filt-1'),
			encodeStringField(2, 'embed'),
			encodeStringField(8, 'local'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, selected),
			encodeMessageField(2, candidate),
			encodeMessageField(2, sparseCandidate),
			encodeMessageField(3, filtered),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeResolveModelResponse(encoded);
		assert.deepStrictEqual(wire, {
			selected: {
				id: 'fast',
				type: 'chat',
				enabled: true,
				level: 7,
				description: 'fast chat',
				cost: 'low',
				speed: 'high',
				provider: 'openai',
				model_id: 'gpt-fast',
			},
			candidates: [
				{
					id: 'cand-1',
					type: 'chat',
					enabled: true,
					level: undefined,
					description: undefined,
					cost: undefined,
					speed: undefined,
					provider: undefined,
					model_id: 'gpt-cand',
				},
				{
					id: 'cand-2',
					type: '',
					enabled: false,
					level: undefined,
					description: undefined,
					cost: undefined,
					speed: undefined,
					provider: undefined,
					model_id: undefined,
				},
			],
			filtered: [
				{
					id: 'filt-1',
					type: 'embed',
					enabled: false,
					level: undefined,
					description: undefined,
					cost: undefined,
					speed: undefined,
					provider: 'local',
					model_id: undefined,
				},
			],
		});
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		const mapped = mapResolveModelResponse(wire);
		assert.deepStrictEqual(mapped, {
			selected: {
				id: 'fast',
				type: 'chat',
				enabled: true,
				level: 7,
				description: 'fast chat',
				cost: 'low',
				speed: 'high',
				provider: 'openai',
				modelId: 'gpt-fast',
			},
			candidates: [
				{
					id: 'cand-1',
					type: 'chat',
					enabled: true,
					level: 0,
					description: undefined,
					cost: undefined,
					speed: undefined,
					provider: '',
					modelId: 'gpt-cand',
				},
				{
					id: 'cand-2',
					type: '',
					enabled: false,
					level: 0,
					description: undefined,
					cost: undefined,
					speed: undefined,
					provider: '',
					modelId: '',
				},
			],
			filtered: [
				{
					id: 'filt-1',
					type: 'embed',
					enabled: false,
					level: 0,
					description: undefined,
					cost: undefined,
					speed: undefined,
					provider: 'local',
					modelId: '',
				},
			],
		});
		assert.ok(mapped.selected);
		assert.ok(mapped.candidates.length > 0);
		assert.ok(mapped.filtered.length > 0);

		const empty = decodeResolveModelResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			candidates: [],
			filtered: [],
		});
		assert.ok(!('selected' in empty));
		assert.deepStrictEqual(mapResolveModelResponse(empty), {
			candidates: [],
			filtered: [],
		});
		assert.ok(!('selected' in mapResolveModelResponse(empty)));

		const unusedOnly = decodeResolveModelResponse(encodeStringField(4, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			candidates: [],
			filtered: [],
		});
		assert.strictEqual(JSON.stringify(unusedOnly).includes('unused'), false);
		assert.deepStrictEqual(mapResolveModelResponse(unusedOnly), {
			candidates: [],
			filtered: [],
		});
	});

	test('resolve-model unary wire is ConfigService.ResolveModel only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcResolveModelUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeResolveModelRequest\b/.test(source));
		assert.ok(/\bdecodeResolveModelResponse\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\breadProtoFields\b/.test(source));
		assert.ok(/\bdecodeModelEntry\b/.test(source));
		assert.ok(/\blastBytes\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!/\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bSwitchModel\b|\bListModels\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('resolveModel uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const resolve = extractMethod(source, 'resolveModel');
		assert.ok(resolve.includes('makeUnaryBytesClient'), 'resolveModel must use makeUnaryBytesClient');
		assert.ok(resolve.includes('encodeResolveModelRequest'), 'resolveModel must call encodeResolveModelRequest');
		assert.ok(resolve.includes('decodeResolveModelResponse'), 'resolveModel must call decodeResolveModelResponse');
		assert.ok(resolve.includes('mapResolveModelResponse'), 'resolveModel still calls mapResolveModelResponse');
		assert.ok(!resolve.includes('makeUnaryClient<'), 'resolveModel must not use JSON makeUnaryClient');
		assert.ok(!resolve.includes('JSON.stringify'), 'resolveModel must not JSON.stringify');
		assert.ok(source.includes('grpcResolveModelUnaryWire'));
		assert.ok(!/\bWatch\b/.test(resolve));
		assert.ok(!/\bSaveSkillContent\b/.test(resolve));
		assert.ok(!/\bConnect\b/.test(resolve));
		assert.ok(!/\bResolveTurn\b/.test(resolve));
		assert.ok(!/\bResolveAnchor\b/.test(resolve));
	});

	test('skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor; do not lock GetModelPreferences', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		assert.ok(!extractMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('grpcResolveModelUnaryWire'));
		assert.ok(!watchBody.includes('makeUnaryBytesClient'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcResolveModelUnaryWire.ts')));
	assert.ok(dir, 'grpcResolveModelUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractMethod(source: string, name: string): string {
	const asyncStart = source.indexOf(`\tasync ${name}(`);
	const start = asyncStart >= 0 ? asyncStart : source.indexOf(`\t${name}(`);
	assert.ok(start >= 0, `missing ${name}(`);
	const rest = source.slice(start + 1);
	const next = rest.search(/\n\t(async |\w+\()/);
	const end = next >= 0 ? start + 1 + next : source.length;
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
