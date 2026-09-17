/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentTestModelProfileResult } from '../../common/universeAgentTypes.js';
import {
	decodeTestModelProfileResponse,
	encodeTestModelProfileRequest,
	type TestModelProfileResponseWire,
} from '../../node/grpc/grpcTestModelProfileUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService TestModelProfile protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeTestModelProfileRequest writes provider_id=1 model_id=2 api_key=3 base_url=4 protocol=5 params=6 MapEntry; omits empty; not JSON', () => {
		const encoded = encodeTestModelProfileRequest({
			providerId: 'prov-1',
			modelId: 'gpt-test',
			apiKey: 'sk-test',
			baseUrl: 'https://api.example',
			protocol: 'openai',
			params: { temperature: '0.2', max_tokens: '128' },
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			provider_id: 'prov-1',
			model_id: 'gpt-test',
			api_key: 'sk-test',
			base_url: 'https://api.example',
			protocol: 'openai',
			params: { temperature: '0.2', max_tokens: '128' },
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'prov-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'gpt-test');
		assert.strictEqual(protoStrings(encoded).get(3), 'sk-test');
		assert.strictEqual(protoStrings(encoded).get(4), 'https://api.example');
		assert.strictEqual(protoStrings(encoded).get(5), 'openai');
		const params = protoMessages(encoded, 6);
		assert.strictEqual(params.length, 2);
		assert.strictEqual(protoStrings(params[0]!).get(1), 'temperature');
		assert.strictEqual(protoStrings(params[0]!).get(2), '0.2');
		assert.ok(!protoStrings(params[0]!).has(3));
		assert.strictEqual(protoStrings(params[1]!).get(1), 'max_tokens');
		assert.strictEqual(protoStrings(params[1]!).get(2), '128');
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(6));

		const omitted = encodeTestModelProfileRequest({
			providerId: 'prov-1',
			modelId: '',
			apiKey: '',
			baseUrl: '',
			protocol: 'openai',
			params: { temperature: '0.2' },
		});
		assert.strictEqual(protoStrings(omitted).get(1), 'prov-1');
		assert.ok(!protoStrings(omitted).has(2));
		assert.ok(!protoStrings(omitted).has(3));
		assert.ok(!protoStrings(omitted).has(4));
		assert.strictEqual(protoStrings(omitted).get(5), 'openai');
		const omittedParams = protoMessages(omitted, 6);
		assert.strictEqual(omittedParams.length, 1);
		assert.strictEqual(protoStrings(omittedParams[0]!).get(1), 'temperature');
		assert.strictEqual(protoStrings(omittedParams[0]!).get(2), '0.2');
		assert.notStrictEqual(omitted[0], 0x7b);

		const emptyParams = encodeTestModelProfileRequest({
			providerId: 'prov-1',
			modelId: 'gpt-test',
			apiKey: '',
			baseUrl: '',
			protocol: '',
			params: {},
		});
		assert.strictEqual(protoStrings(emptyParams).get(1), 'prov-1');
		assert.strictEqual(protoStrings(emptyParams).get(2), 'gpt-test');
		assert.strictEqual(protoMessages(emptyParams, 6).length, 0);

		const emptyKeyValue = encodeTestModelProfileRequest({
			providerId: 'prov-1',
			modelId: '',
			apiKey: '',
			baseUrl: '',
			protocol: '',
			params: { '': '', temperature: '0.2' },
		});
		const emptyKeyValueParams = protoMessages(emptyKeyValue, 6);
		assert.strictEqual(emptyKeyValueParams.length, 1);
		assert.strictEqual(protoStrings(emptyKeyValueParams[0]!).get(1), 'temperature');
		assert.strictEqual(protoStrings(emptyKeyValueParams[0]!).get(2), '0.2');

		assert.strictEqual(encodeTestModelProfileRequest({
			providerId: '',
			modelId: '',
			apiKey: '',
			baseUrl: '',
			protocol: '',
			params: {},
		}).length, 0);
	});

	test('decodeTestModelProfileResponse reads success=1 error_message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'refused'),
			encodeStringField(3, 'unused-field'),
			encodeStringField(6, 'unused-params'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeTestModelProfileResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			error_message: 'refused',
		});
		assert.ok(!('params' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapTestModelProfile(wire), {
			ok: true,
			message: 'refused',
		});

		const empty = decodeTestModelProfileResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			error_message: undefined,
		});
		assert.deepStrictEqual(mapTestModelProfile(empty), {
			ok: false,
			message: undefined,
		});
	});

	test('test-model-profile unary wire is TestModelProfile only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcTestModelProfileUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(!source.includes('encodeMap'));
		assert.ok(/\bencodeTestModelProfileRequest\b/.test(source));
		assert.ok(/\bdecodeTestModelProfileResponse\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\bencodeMessageField\b/.test(source));
		assert.ok(/\bencodeStringStringMap\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bConnect\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('testModelProfile uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const method = extractAsyncMethod(source, 'testModelProfile');
		assert.ok(method.includes('makeUnaryBytesClient'), 'testModelProfile must use makeUnaryBytesClient');
		assert.ok(method.includes('encodeTestModelProfileRequest'), 'testModelProfile must call encodeTestModelProfileRequest');
		assert.ok(method.includes('decodeTestModelProfileResponse'), 'testModelProfile must call decodeTestModelProfileResponse');
		assert.ok(method.includes('ok: wire.success === true'), 'testModelProfile must keep ok: wire.success === true');
		assert.ok(method.includes('message: wire.error_message'), 'testModelProfile must keep message: wire.error_message');
		assert.ok(!method.includes('makeUnaryClient<'), 'testModelProfile must not use JSON makeUnaryClient');
		assert.ok(!method.includes('JSON.stringify'), 'testModelProfile must not JSON.stringify');

		assert.ok(source.includes('grpcTestModelProfileUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		assert.ok(!source.includes('openWatchConfigStream') || !extractOpenWatchConfigStream(source).includes('makeServerStreamBytesClient'));
	});
});

/** Same mapping as Agent.TestModelProfile JSON unary (`ok: wire.success === true`). */
function mapTestModelProfile(wire: TestModelProfileResponseWire): UniverseAgentTestModelProfileResult {
	return {
		ok: wire.success === true,
		message: wire.error_message,
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcTestModelProfileUnaryWire.ts')));
	assert.ok(dir, 'grpcTestModelProfileUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}

function extractOpenWatchConfigStream(source: string): string {
	const start = source.indexOf('\topenWatchConfigStream(');
	assert.ok(start >= 0, 'missing openWatchConfigStream(');
	const nextMethod = source.indexOf('\n\tasync ', start + 1);
	const nextOpen = source.indexOf('\n\topen', start + 1);
	const candidates = [nextMethod, nextOpen].filter(index => index >= 0);
	const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
	return source.slice(start, end);
}

function protoMessages(encoded: Uint8Array, fieldNumber: number): Uint8Array[] {
	const values: Uint8Array[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(field.bytes);
		}
	}
	return values;
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
