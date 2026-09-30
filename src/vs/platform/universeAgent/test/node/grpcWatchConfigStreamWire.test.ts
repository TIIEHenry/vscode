/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapConfigChangedEvent } from '../../node/grpc/grpcClientMappers.js';
import { decodeConfigChangedEvent, encodeWatchConfigRequest } from '../../node/grpc/grpcWatchConfigStreamWire.js';
import {
	allLengthDelimited,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc ConfigService Watch protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeWatchConfigRequest writes repeated keys=1; empty keys and empty strings omitted; not JSON', () => {
		const encoded = encodeWatchConfigRequest({ keys: ['theme', 'locale'] });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		const keys = allLengthDelimited(readProtoFields(encoded), 1).map(value => Buffer.from(value).toString('utf8'));
		assert.deepStrictEqual(keys, ['theme', 'locale']);
		assert.ok(!protoVarints(encoded).has(1));

		const skippedEmpty = encodeWatchConfigRequest({ keys: ['theme', ''] });
		assert.deepStrictEqual(allLengthDelimited(readProtoFields(skippedEmpty), 1).map(value => Buffer.from(value).toString('utf8')), ['theme']);

		assert.strictEqual(encodeWatchConfigRequest({ keys: [] }).length, 0);
		assert.strictEqual(encodeWatchConfigRequest({ keys: [''] }).length, 0);
	});

	test('decodeConfigChangedEvent reads key=1 old_value=2 new_value=3 scope=4 timestamp=5; maps through mapConfigChangedEvent', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'theme'),
			encodeStringField(2, 'light'),
			encodeStringField(3, 'dark'),
			encodeStringField(4, 'session'),
			encodeVarintZero(5),
			encodeStringField(9, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeConfigChangedEvent(encoded);
		assert.deepStrictEqual(wire, {
			key: 'theme',
			old_value: 'light',
			new_value: 'dark',
			scope: 'session',
			timestamp: 0,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapConfigChangedEvent(wire), {
			key: 'theme',
			oldValue: 'light',
			newValue: 'dark',
			scope: 'session',
			timestamp: 0,
		});

		const emptyStrings = decodeConfigChangedEvent(Buffer.concat([
			encodePresentMessageField(1, new Uint8Array(0)),
			encodePresentMessageField(2, new Uint8Array(0)),
			encodePresentMessageField(3, new Uint8Array(0)),
			encodePresentMessageField(4, new Uint8Array(0)),
		]));
		assert.deepStrictEqual(mapConfigChangedEvent(emptyStrings), {
			key: '',
			oldValue: '',
			newValue: '',
			scope: '',
			timestamp: 0,
		});
		assert.deepStrictEqual(mapConfigChangedEvent(decodeConfigChangedEvent(new Uint8Array(0))), {
			key: '',
			oldValue: '',
			newValue: '',
			scope: '',
			timestamp: 0,
		});
	});

	test('watch wire is ConfigService.Watch only; openWatchConfigStream uses makeServerStreamBytesClient', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcWatchConfigStreamWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeWatchConfigRequest\b/.test(source));
		assert.ok(/\bdecodeConfigChangedEvent\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bResolveAnchor\b|\bPtyStream\b|\bSaveSkillContent\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));

		const client = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		assert.ok(client.includes('grpcWatchConfigStreamWire'));
		const watch = extractMethod(client, 'openWatchConfigStream');
		assert.ok(watch.includes('makeServerStreamBytesClient'));
		assert.ok(watch.includes('encodeWatchConfigRequest'));
		assert.ok(watch.includes('decodeConfigChangedEvent'));
		assert.ok(watch.includes('mapConfigChangedEvent'));
		assert.ok(!watch.includes('makeServerStreamClient<'));
		assert.ok(!watch.includes('makeUnaryBytesClient'));
		assert.ok(!watch.includes('JSON.stringify'));
	});
});

function encodeVarintZero(field: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(0),
	]);
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcWatchConfigStreamWire.ts')));
	assert.ok(dir, 'grpcWatchConfigStreamWire.ts not found from cwd or import.meta');
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

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}
