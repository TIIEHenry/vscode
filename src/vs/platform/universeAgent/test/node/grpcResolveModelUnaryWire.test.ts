/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentResolveModelResult } from '../../common/universeAgentTypes.js';
import {
	decodeResolveModelResponse,
	encodeResolveModelRequest,
	type ResolveModelResponseWire,
} from '../../node/grpc/grpcResolveModelUnaryWire.js';
import {
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

	test('decodeResolveModelResponse unread nested ModelEntry; returns {}; mapper missing nested → no selected, empty arrays', () => {
		const nested = Buffer.concat([
			encodeStringField(1, 'unused-id'),
			encodeStringField(2, 'unused-type'),
			encodeStringField(5, 'unused-description'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, nested),
			encodeMessageField(2, nested),
			encodeMessageField(3, nested),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeResolveModelResponse(encoded);
		assert.deepStrictEqual(wire, {});
		assert.ok(!('selected' in wire));
		assert.ok(!('candidates' in wire));
		assert.ok(!('filtered' in wire));
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapResolveModelResponse(wire), {
			candidates: [],
			filtered: [],
		});
		assert.ok(!('selected' in mapResolveModelResponse(wire)));

		const empty = decodeResolveModelResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {});
		assert.ok(!('selected' in empty));
		assert.ok(!('candidates' in empty));
		assert.ok(!('filtered' in empty));
		assert.deepStrictEqual(mapResolveModelResponse(empty), {
			candidates: [],
			filtered: [],
		});
		assert.ok(!('selected' in mapResolveModelResponse(empty)));

		const unusedOnly = decodeResolveModelResponse(encodeStringField(4, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {});
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
		assert.ok(!/\bdecodeModelEntry\b|\blastBytes\b|\ballLengthDelimited\b/.test(source));
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

	test('ONLY resolveModel still JSON unary; skip Connect/SaveSkillContent/Watch', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const resolve = extractMethod(source, 'resolveModel');
		assert.ok(resolve.includes('makeUnaryClient<'), 'resolveModel still uses JSON makeUnaryClient');
		assert.ok(!resolve.includes('makeUnaryBytesClient'), 'resolveModel must not use makeUnaryBytesClient this slice');
		assert.ok(!resolve.includes('encodeResolveModelRequest'), 'resolveModel must not call encodeResolveModelRequest this slice');
		assert.ok(!resolve.includes('decodeResolveModelResponse'), 'resolveModel must not call decodeResolveModelResponse this slice');
		assert.ok(resolve.includes('session_id'), 'resolveModel still sends session_id JSON key');
		assert.ok(resolve.includes('type'), 'resolveModel still sends type JSON key');
		assert.ok(resolve.includes('mapResolveModelResponse'), 'resolveModel still calls mapResolveModelResponse');
		assert.ok(!source.includes('grpcResolveModelUnaryWire'));
		assert.ok(!/\bWatch\b/.test(resolve));
		assert.ok(!/\bSaveSkillContent\b/.test(resolve));
		assert.ok(!/\bConnect\b/.test(resolve));
	});

	test('skip Connect/SaveSkillContent/Watch; do not lock GetModelPreferences', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		assert.ok(!extractMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractMethod(source, 'connect').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('grpcResolveModelUnaryWire'));
		assert.ok(!watchBody.includes('makeUnaryBytesClient'));
	});
});

/** TEST mapper: missing nested selected/candidates/filtered → no selected, empty arrays. */
function mapResolveModelResponse(wire: ResolveModelResponseWire): UniverseAgentResolveModelResult {
	return {
		...(wire.selected ? { selected: mapModelEntry(wire.selected) } : {}),
		candidates: (wire.candidates ?? []).map(mapModelEntry),
		filtered: (wire.filtered ?? []).map(mapModelEntry),
	};
}

function mapModelEntry(wire: NonNullable<ResolveModelResponseWire['selected']>): NonNullable<UniverseAgentResolveModelResult['selected']> {
	return {
		id: wire.id ?? '',
		type: wire.type ?? '',
		enabled: wire.enabled === true,
		level: typeof wire.level === 'number' && Number.isFinite(wire.level) ? wire.level : 0,
		description: wire.description,
		cost: wire.cost,
		speed: wire.speed,
		provider: wire.provider ?? '',
		modelId: wire.model_id ?? '',
	};
}

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
