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
	decodeRespondQuestionResponse,
	decodeSendClientToolResponseResponse,
	encodeRespondQuestionRequest,
	encodeSendClientToolResponseRequest,
} from '../../node/grpc/grpcAgentQuestionToolWire.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc agent question/client-tool unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeRespondQuestionRequest writes nested field numbers; map entry key=1 value=2 message not string; not JSON', () => {
		const encoded = encodeRespondQuestionRequest({
			sessionId: 'sess-1',
			questionId: 'q-1',
			answers: { itemA: { selectedLabels: ['yes', 'maybe'] } },
			customText: 'other',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.ok(!Buffer.from(encoded).toString('utf8').startsWith('{'));
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		const responses = protoMessages(encoded, 2);
		assert.strictEqual(responses.length, 1);
		const response = responses[0]!;
		assert.strictEqual(protoStrings(response).get(1), 'q-1');
		assert.strictEqual(protoStrings(response).get(3), 'other');
		const entries = protoMessages(response, 2);
		assert.strictEqual(entries.length, 1);
		assert.strictEqual(protoStrings(entries[0]!).get(1), 'itemA');
		const values = protoMessages(entries[0]!, 2);
		assert.strictEqual(values.length, 1);
		assert.notStrictEqual(Buffer.from(values[0]!).toString('utf8'), 'yes');
		assert.notStrictEqual(protoStrings(entries[0]!).get(2), 'yes');
		assert.deepStrictEqual(protoRepeatedStrings(values[0]!, 1), ['yes', 'maybe']);
		assert.ok(!protoStrings(encoded).has(3));
	});

	test('encodeRespondQuestionRequest omits empty custom_text, empty map, empty nested QuestionResponse', () => {
		const noCustom = encodeRespondQuestionRequest({
			sessionId: 'sess-1',
			questionId: 'q-1',
			customText: '',
		});
		assert.notStrictEqual(noCustom[0], 0x7b);
		const response = protoMessages(noCustom, 2)[0]!;
		assert.strictEqual(protoStrings(response).get(1), 'q-1');
		assert.ok(!protoStrings(response).has(3));
		assert.strictEqual(protoMessages(response, 2).length, 0);

		const emptyAnswers = encodeRespondQuestionRequest({
			sessionId: 'sess-1',
			questionId: 'q-1',
			answers: {},
		});
		assert.strictEqual(protoMessages(protoMessages(emptyAnswers, 2)[0]!, 2).length, 0);

		const emptyNested = encodeRespondQuestionRequest({
			sessionId: 'sess-1',
			questionId: '',
			answers: {},
			customText: '',
		});
		assert.strictEqual(protoStrings(emptyNested).get(1), 'sess-1');
		assert.strictEqual(protoMessages(emptyNested, 2).length, 0);

		assert.strictEqual(encodeRespondQuestionRequest({
			sessionId: '',
			questionId: '',
			answers: { '': { selectedLabels: [] } },
			customText: '',
		}).length, 0);
	});

	test('decodeRespondQuestionResponse reads success=1 error=2; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'expired'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.deepStrictEqual(decodeRespondQuestionResponse(encoded), {
			ok: true,
			message: 'expired',
		});
		assert.strictEqual(JSON.stringify(decodeRespondQuestionResponse(encoded)).includes('unused'), false);
		assert.deepStrictEqual(decodeRespondQuestionResponse(new Uint8Array(0)), {
			ok: false,
			message: undefined,
		});
	});

	test('encodeSendClientToolResponseRequest writes nested 1-5; CanvasRefData 1-4 no 5+; false/empty omit; not JSON', () => {
		const encoded = encodeSendClientToolResponseRequest({
			sessionId: 'sess-1',
			callId: 'call-1',
			isError: true,
			content: 'done',
			metadataJson: '{"k":1}',
			canvasRefs: [{
				canvasId: 'c1',
				revisionId: 'r1',
				title: 'Board',
				sourceHash: 'hash-1',
			}],
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.ok(!Buffer.from(encoded).toString('utf8').startsWith('{'));
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		const responses = protoMessages(encoded, 2);
		assert.strictEqual(responses.length, 1);
		const response = responses[0]!;
		assert.strictEqual(protoStrings(response).get(1), 'call-1');
		assert.strictEqual(protoVarints(response).get(2), 1);
		assert.strictEqual(protoStrings(response).get(3), 'done');
		assert.strictEqual(protoStrings(response).get(4), '{"k":1}');
		const refs = protoMessages(response, 5);
		assert.strictEqual(refs.length, 1);
		assert.strictEqual(protoStrings(refs[0]!).get(1), 'c1');
		assert.strictEqual(protoStrings(refs[0]!).get(2), 'r1');
		assert.strictEqual(protoStrings(refs[0]!).get(3), 'Board');
		assert.strictEqual(protoStrings(refs[0]!).get(4), 'hash-1');
		assert.ok(!protoStrings(refs[0]!).has(5));
		assert.ok(!protoVarints(refs[0]!).has(5));
	});

	test('encodeSendClientToolResponseRequest omits is_error false, empty strings, empty nested, empty source_hash', () => {
		const omitted = encodeSendClientToolResponseRequest({
			sessionId: 'sess-1',
			callId: 'call-1',
			isError: false,
			content: '',
			metadataJson: '',
			canvasRefs: [{
				canvasId: 'c1',
				revisionId: '',
				title: '',
				sourceHash: '',
			}],
		});
		assert.notStrictEqual(omitted[0], 0x7b);
		const response = protoMessages(omitted, 2)[0]!;
		assert.strictEqual(protoStrings(response).get(1), 'call-1');
		assert.ok(!protoVarints(response).has(2));
		assert.ok(!protoStrings(response).has(3));
		assert.ok(!protoStrings(response).has(4));
		const refs = protoMessages(response, 5);
		assert.strictEqual(refs.length, 1);
		assert.strictEqual(protoStrings(refs[0]!).get(1), 'c1');
		assert.ok(!protoStrings(refs[0]!).has(4));
		assert.ok(!protoStrings(refs[0]!).has(5));

		const emptyNested = encodeSendClientToolResponseRequest({
			sessionId: 'sess-1',
			callId: '',
			isError: false,
			content: '',
			metadataJson: '',
			canvasRefs: [],
		});
		assert.strictEqual(protoStrings(emptyNested).get(1), 'sess-1');
		assert.strictEqual(protoMessages(emptyNested, 2).length, 0);

		assert.strictEqual(encodeSendClientToolResponseRequest({
			sessionId: '',
			callId: '',
			isError: false,
			canvasRefs: [{ canvasId: '', revisionId: '', title: '' }],
		}).length, 0);
	});

	test('decodeSendClientToolResponseResponse reads success=1 error=2; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'expired'),
			encodeMessageField(3, encodeStringField(1, 'unused-nested')),
		]);
		assert.deepStrictEqual(decodeSendClientToolResponseResponse(encoded), {
			ok: true,
			message: 'expired',
		});
		assert.strictEqual(JSON.stringify(decodeSendClientToolResponseResponse(encoded)).includes('unused'), false);
		assert.deepStrictEqual(decodeSendClientToolResponseResponse(new Uint8Array(0)), {
			ok: false,
			message: undefined,
		});
	});

	test('grpcClient respondQuestion and sendClientToolResponse use bytes', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const clientPath = path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcClient.ts');
		const source = fs.readFileSync(clientPath, 'utf8');
		const methods: Array<{ name: string; encoder: string; decoder: string }> = [
			{ name: 'respondQuestion', encoder: 'encodeRespondQuestionRequest', decoder: 'decodeRespondQuestionResponse' },
			{ name: 'sendClientToolResponse', encoder: 'encodeSendClientToolResponseRequest', decoder: 'decodeSendClientToolResponseResponse' },
		];
		for (const { name, encoder, decoder } of methods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
			assert.ok(!body.includes('JSON.stringify'), `${name} must not JSON.stringify`);
			assert.ok(!body.includes('questionAnswersWire'), `${name} must not use JSON answers helper`);
			assert.ok(!body.includes('canvasRefsWire'), `${name} must not use JSON canvas helper`);
		}
	});
});

function protoStrings(encoded: Uint8Array): Map<number, string> {
	const strings = new Map<number, string>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 2) {
			strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return strings;
}

function protoRepeatedStrings(encoded: Uint8Array, fieldNumber: number): string[] {
	const values: string[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return values;
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

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}
