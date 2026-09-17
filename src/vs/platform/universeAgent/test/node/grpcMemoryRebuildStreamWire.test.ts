/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapMemoryRebuildEvent } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeMemoryRebuildEvent,
	encodeMemoryRebuildRequest,
} from '../../node/grpc/grpcMemoryRebuildStreamWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc MemoryService Rebuild protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeMemoryRebuildRequest writes scope=1 dry_run=2; omits empty/false; not JSON', () => {
		const encoded = encodeMemoryRebuildRequest({
			scope: 'global',
			dryRun: true,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			scope: 'global',
			dry_run: true,
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'global');
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(3));

		const scopeOnly = encodeMemoryRebuildRequest({
			scope: 'global',
			dryRun: false,
		});
		assert.strictEqual(protoStrings(scopeOnly).get(1), 'global');
		assert.ok(!protoVarints(scopeOnly).has(2));
		assert.notStrictEqual(scopeOnly[0], 0x7b);

		const dryRunOnly = encodeMemoryRebuildRequest({
			scope: '',
			dryRun: true,
		});
		assert.ok(!protoStrings(dryRunOnly).has(1));
		assert.strictEqual(protoVarints(dryRunOnly).get(2), 1);
		assert.notStrictEqual(dryRunOnly[0], 0x7b);

		assert.strictEqual(encodeMemoryRebuildRequest({
			scope: '',
			dryRun: false,
		}).length, 0);
	});

	test('decodeMemoryRebuildEvent reads phase=1 message=2 progress=3 files_processed=4 files_total=5 then mapMemoryRebuildEvent; unused unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'scanning'),
			encodeStringField(2, 'listing files'),
			encodeInt32Field(3, 40),
			encodeInt32Field(4, 8),
			encodeInt32Field(5, 20),
			encodeStringField(6, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeMemoryRebuildEvent(encoded);
		assert.deepStrictEqual(wire, {
			phase: 'scanning',
			message: 'listing files',
			progress: 40,
			files_processed: 8,
			files_total: 20,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapMemoryRebuildEvent(wire), {
			phase: 'scanning',
			message: 'listing files',
			progress: 40,
			filesProcessed: 8,
			filesTotal: 20,
		});

		const empty = decodeMemoryRebuildEvent(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			phase: undefined,
			message: undefined,
			progress: undefined,
			files_processed: undefined,
			files_total: undefined,
		});
		assert.deepStrictEqual(mapMemoryRebuildEvent(empty), {
			phase: '',
			message: '',
			progress: 0,
			filesProcessed: 0,
			filesTotal: 0,
		});

		const unusedOnly = decodeMemoryRebuildEvent(encodeStringField(6, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			phase: undefined,
			message: undefined,
			progress: undefined,
			files_processed: undefined,
			files_total: undefined,
		});
		assert.deepStrictEqual(mapMemoryRebuildEvent(unusedOnly), {
			phase: '',
			message: '',
			progress: 0,
			filesProcessed: 0,
			filesTotal: 0,
		});

		const lastWins = decodeMemoryRebuildEvent(Buffer.concat([
			encodeInt32Field(3, 1),
			encodeInt32Field(3, 40),
			encodeInt32Field(4, 1),
			encodeInt32Field(4, 8),
			encodeInt32Field(5, 1),
			encodeInt32Field(5, 20),
		]));
		assert.strictEqual(lastWins.progress, 40);
		assert.strictEqual(lastWins.files_processed, 8);
		assert.strictEqual(lastWins.files_total, 20);
		assert.strictEqual(mapMemoryRebuildEvent(lastWins).progress, 40);
		assert.strictEqual(mapMemoryRebuildEvent(lastWins).filesProcessed, 8);
		assert.strictEqual(mapMemoryRebuildEvent(lastWins).filesTotal, 20);

		const zeroPresent = decodeMemoryRebuildEvent(Buffer.concat([
			encodeVarintZero(3),
			encodeVarintZero(4),
			encodeVarintZero(5),
		]));
		assert.strictEqual(zeroPresent.progress, 0);
		assert.strictEqual(zeroPresent.files_processed, 0);
		assert.strictEqual(zeroPresent.files_total, 0);
		assert.strictEqual(mapMemoryRebuildEvent(zeroPresent).progress, 0);
		assert.strictEqual(mapMemoryRebuildEvent(zeroPresent).filesProcessed, 0);
		assert.strictEqual(mapMemoryRebuildEvent(zeroPresent).filesTotal, 0);
		assert.strictEqual(encodeInt32Field(3, 0).length, 0);
		assert.strictEqual(encodeInt32Field(4, 0).length, 0);
		assert.strictEqual(encodeInt32Field(5, 0).length, 0);
	});

	test('memory rebuild stream wire is MemoryService.Rebuild only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcMemoryRebuildStreamWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeMemoryRebuildRequest\b/.test(source));
		assert.ok(/\bdecodeMemoryRebuildEvent\b/.test(source));
		assert.ok(/\bmapMemoryRebuildEvent\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\bencodeInt32Field\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('openRebuildMemoryStream stays JSON makeServerStreamClient; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const rebuild = extractMethod(source, 'openRebuildMemoryStream');
		assert.ok(rebuild.includes('makeServerStreamClient<Record<string, unknown>'), 'openRebuildMemoryStream must stay JSON makeServerStreamClient');
		assert.ok(!rebuild.includes('makeServerStreamBytesClient'), 'openRebuildMemoryStream must not use makeServerStreamBytesClient');
		assert.ok(!rebuild.includes('encodeMemoryRebuildRequest'), 'openRebuildMemoryStream must not call encodeMemoryRebuildRequest');
		assert.ok(!rebuild.includes('decodeMemoryRebuildEvent'), 'openRebuildMemoryStream must not call decodeMemoryRebuildEvent');
		assert.ok(rebuild.includes('mapMemoryRebuildEvent'), 'openRebuildMemoryStream still calls mapMemoryRebuildEvent');
		assert.ok(!source.includes('grpcMemoryRebuildStreamWire'));

		assert.ok(!extractMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'saveSkillContent').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'connect').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'resolveTurn').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'resolveAnchor').includes('makeUnaryClient<'));

		const watch = extractMethod(source, 'openWatchConfigStream');
		assert.ok(watch.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watch.includes('makeServerStreamBytesClient'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcMemoryRebuildStreamWire.ts')));
	assert.ok(dir, 'grpcMemoryRebuildStreamWire.ts not found from cwd or import.meta');
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

function encodeVarintZero(field: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(0),
	]);
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
