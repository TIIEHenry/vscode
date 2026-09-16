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
	mapMemoryDeleteResponse,
	mapMemoryHistoryResponse,
	mapMemoryListResponse,
	mapMemoryReadResponse,
	mapMemoryReflectResponse,
	mapMemoryRevertResponse,
	mapMemorySaveResponse,
	mapMemorySearchDeepResponse,
	mapMemorySearchResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeMemoryDeleteResponse,
	decodeMemoryHistoryResponse,
	decodeMemoryListResponse,
	decodeMemoryReadResponse,
	decodeMemoryReflectResponse,
	decodeMemoryRevertResponse,
	decodeMemorySaveResponse,
	decodeMemorySearchDeepResponse,
	decodeMemorySearchResponse,
	encodeMemoryDeleteRequest,
	encodeMemoryHistoryRequest,
	encodeMemoryListRequest,
	encodeMemoryReadRequest,
	encodeMemoryReflectRequest,
	encodeMemoryRevertRequest,
	encodeMemorySaveRequest,
	encodeMemorySearchDeepRequest,
	encodeMemorySearchRequest,
} from '../../node/grpc/grpcMemoryUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc memory unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeMemorySaveRequest writes scope=1 content=2 category=3; omits empty, not JSON', () => {
		const encoded = encodeMemorySaveRequest({ scope: 'global', content: 'note', category: 'facts' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'global');
		assert.strictEqual(protoStrings(encoded).get(2), 'note');
		assert.strictEqual(protoStrings(encoded).get(3), 'facts');
		assert.ok(!protoStrings(encoded).has(4));
		assert.strictEqual(encodeMemorySaveRequest({ scope: '', content: '', category: '' }).length, 0);
	});

	test('decodeMemorySaveResponse reads 1-3 then mapper; unknown fields unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'saved'),
			encodeStringField(3, '/mem/facts.md'),
			encodeStringField(4, 'unused-field'),
		]);
		const wire = decodeMemorySaveResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'saved',
			file_path: '/mem/facts.md',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapMemorySaveResponse(wire), {
			success: true,
			message: 'saved',
			filePath: '/mem/facts.md',
		});
		assert.deepStrictEqual(decodeMemorySaveResponse(new Uint8Array(0)), {
			success: false,
			message: undefined,
			file_path: undefined,
		});
		assert.deepStrictEqual(mapMemorySaveResponse(decodeMemorySaveResponse(new Uint8Array(0))), {
			success: false,
			message: '',
			filePath: '',
		});
	});

	test('encodeMemorySearchRequest writes 1-4; omits empty/0, not JSON', () => {
		const encoded = encodeMemorySearchRequest({
			scope: 'project',
			query: 'auth',
			keywords: ['token', 'login'],
			limit: 10,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'project');
		assert.strictEqual(protoStrings(encoded).get(2), 'auth');
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 3), ['token', 'login']);
		assert.strictEqual(protoVarints(encoded).get(4), 10);
		const omitted = encodeMemorySearchRequest({ scope: '', query: '', keywords: [], limit: 0 });
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(4));
	});

	test('decodeMemorySearchResponse reads results=1; SearchResult 1-3/5-7; score=4 unread; unknown unread', () => {
		const result = Buffer.concat([
			encodeStringField(1, 'facts'),
			encodeStringField(2, 'auth.md'),
			encodeStringField(3, 'Auth'),
			encodeFixed64Skip(4, 1.5),
			encodeStringField(5, 'token store'),
			encodeInt32Field(6, 1),
			encodeStringField(7, 'global'),
			encodeStringField(8, 'unused-result'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, result),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeMemorySearchResponse(encoded);
		assert.deepStrictEqual(wire, {
			results: [{
				category: 'facts',
				filename: 'auth.md',
				title: 'Auth',
				snippet: 'token store',
				forgot: true,
				scope: 'global',
			}],
		});
		assert.ok(!('score' in (wire.results?.[0] ?? {})));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapMemorySearchResponse(wire), {
			results: [{
				category: 'facts',
				filename: 'auth.md',
				title: 'Auth',
				score: 0,
				snippet: 'token store',
				forgot: true,
				scope: 'global',
			}],
		});
		assert.deepStrictEqual(decodeMemorySearchResponse(new Uint8Array(0)), { results: [] });
		assert.deepStrictEqual(mapMemorySearchResponse(decodeMemorySearchResponse(new Uint8Array(0))), { results: [] });
	});

	test('encodeMemorySearchDeepRequest writes 1-6; omits empty/0/false, not JSON', () => {
		const encoded = encodeMemorySearchDeepRequest({
			scope: 'global',
			query: 'auth',
			keywords: ['token'],
			categories: ['facts'],
			limit: 5,
			includeContent: true,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'global');
		assert.strictEqual(protoStrings(encoded).get(2), 'auth');
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 3), ['token']);
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 4), ['facts']);
		assert.strictEqual(protoVarints(encoded).get(5), 5);
		assert.strictEqual(protoVarints(encoded).get(6), 1);
		const omitted = encodeMemorySearchDeepRequest({
			scope: '',
			query: '',
			keywords: [],
			categories: [],
			limit: 0,
			includeContent: false,
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(5));
		assert.ok(!protoVarints(omitted).has(6));
	});

	test('decodeMemorySearchDeepResponse reads results=1 searched_categories=2; unknown unread', () => {
		const result = Buffer.concat([
			encodeStringField(1, 'facts'),
			encodeStringField(2, 'auth.md'),
			encodeFixed64Skip(4, 2.25),
			encodeStringField(5, 'hit'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, result),
			encodeStringField(2, 'facts'),
			encodeStringField(2, 'prefs'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeMemorySearchDeepResponse(encoded);
		assert.deepStrictEqual(wire, {
			results: [{
				category: 'facts',
				filename: 'auth.md',
				title: undefined,
				snippet: 'hit',
				forgot: false,
				scope: undefined,
			}],
			searched_categories: ['facts', 'prefs'],
		});
		assert.ok(!('score' in (wire.results?.[0] ?? {})));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapMemorySearchDeepResponse(wire), {
			results: [{
				category: 'facts',
				filename: 'auth.md',
				title: '',
				score: 0,
				snippet: 'hit',
				forgot: false,
				scope: '',
			}],
			searchedCategories: ['facts', 'prefs'],
		});
		assert.deepStrictEqual(decodeMemorySearchDeepResponse(new Uint8Array(0)), {
			results: [],
			searched_categories: [],
		});
	});

	test('encodeMemoryReadRequest writes 1-6; omits empty/false, not JSON', () => {
		const encoded = encodeMemoryReadRequest({
			scope: 'project',
			category: 'facts',
			filename: 'auth.md',
			section: 'tokens',
			mode: 'full',
			forgot: true,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'project');
		assert.strictEqual(protoStrings(encoded).get(2), 'facts');
		assert.strictEqual(protoStrings(encoded).get(3), 'auth.md');
		assert.strictEqual(protoStrings(encoded).get(4), 'tokens');
		assert.strictEqual(protoStrings(encoded).get(5), 'full');
		assert.strictEqual(protoVarints(encoded).get(6), 1);
		const omitted = encodeMemoryReadRequest({
			scope: '',
			category: '',
			filename: '',
			section: '',
			mode: '',
			forgot: false,
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(6));
	});

	test('decodeMemoryReadResponse reads content=1 metadata=2; Metadata 1-7; unknown unread', () => {
		const metadata = Buffer.concat([
			encodeStringField(1, 'facts'),
			encodeStringField(2, 'auth.md'),
			encodeStringField(3, 'Auth'),
			encodeStringField(4, 'security'),
			encodeStringField(4, 'tokens'),
			encodeInt64Field(5, 11),
			encodeInt64Field(6, 22),
			encodeInt32Field(7, 3),
			encodeStringField(8, 'unused-meta'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, '# Auth'),
			encodeMessageField(2, metadata),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeMemoryReadResponse(encoded);
		assert.deepStrictEqual(wire, {
			content: '# Auth',
			metadata: {
				category: 'facts',
				filename: 'auth.md',
				title: 'Auth',
				tags: ['security', 'tokens'],
				created_at: 11,
				updated_at: 22,
				version: 3,
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapMemoryReadResponse(wire), {
			content: '# Auth',
			metadata: {
				category: 'facts',
				filename: 'auth.md',
				title: 'Auth',
				tags: ['security', 'tokens'],
				createdAt: 11,
				updatedAt: 22,
				version: 3,
			},
		});
		assert.deepStrictEqual(decodeMemoryReadResponse(new Uint8Array(0)), {
			content: undefined,
			metadata: undefined,
		});
		assert.deepStrictEqual(mapMemoryReadResponse(decodeMemoryReadResponse(new Uint8Array(0))), {
			content: '',
			metadata: {
				category: '',
				filename: '',
				title: '',
				tags: [],
				createdAt: 0,
				updatedAt: 0,
				version: 0,
			},
		});
	});

	test('encodeMemoryListRequest writes scope=1 category=2; omits empty, not JSON', () => {
		const encoded = encodeMemoryListRequest({ scope: 'global', category: 'facts' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'global');
		assert.strictEqual(protoStrings(encoded).get(2), 'facts');
		assert.ok(!protoStrings(encoded).has(3));
		assert.strictEqual(encodeMemoryListRequest({ scope: '', category: '' }).length, 0);
	});

	test('decodeMemoryListResponse reads categories=1; Category 1-3 FileSummary 1-3; unknown unread', () => {
		const file = Buffer.concat([
			encodeStringField(1, 'auth.md'),
			encodeStringField(2, 'Auth'),
			encodeInt64Field(3, 99),
			encodeStringField(4, 'unused-file'),
		]);
		const category = Buffer.concat([
			encodeStringField(1, 'facts'),
			encodeMessageField(2, file),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'unused-category'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, category),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeMemoryListResponse(encoded);
		assert.deepStrictEqual(wire, {
			categories: [{
				category: 'facts',
				files: [{
					filename: 'auth.md',
					title: 'Auth',
					updated_at: 99,
				}],
				file_count: 1,
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapMemoryListResponse(wire), {
			categories: [{
				category: 'facts',
				files: [{
					filename: 'auth.md',
					title: 'Auth',
					updatedAt: 99,
				}],
				fileCount: 1,
			}],
		});
		assert.deepStrictEqual(decodeMemoryListResponse(new Uint8Array(0)), { categories: [] });
	});

	test('encodeMemoryDeleteRequest writes 1-3; omits empty, not JSON', () => {
		const encoded = encodeMemoryDeleteRequest({ scope: 'global', category: 'facts', filename: 'auth.md' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'global');
		assert.strictEqual(protoStrings(encoded).get(2), 'facts');
		assert.strictEqual(protoStrings(encoded).get(3), 'auth.md');
		assert.ok(!protoStrings(encoded).has(4));
		assert.strictEqual(encodeMemoryDeleteRequest({ scope: '', category: '', filename: '' }).length, 0);
	});

	test('decodeMemoryDeleteResponse reads 1-2 then mapper; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'gone'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeMemoryDeleteResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'gone' });
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapMemoryDeleteResponse(wire), { success: true, message: 'gone' });
		assert.deepStrictEqual(decodeMemoryDeleteResponse(new Uint8Array(0)), {
			success: false,
			message: undefined,
		});
		assert.deepStrictEqual(mapMemoryDeleteResponse(decodeMemoryDeleteResponse(new Uint8Array(0))), {
			success: false,
			message: '',
		});
	});

	test('encodeMemoryReflectRequest writes scope=1 categories=2; omits empty, not JSON', () => {
		const encoded = encodeMemoryReflectRequest({ scope: 'project', categories: ['facts', 'prefs'] });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'project');
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 2), ['facts', 'prefs']);
		assert.strictEqual(encodeMemoryReflectRequest({ scope: '', categories: [] }).length, 0);
	});

	test('decodeMemoryReflectResponse reads diagnoses=1 summary=2; Diagnosis 1-5; unknown unread', () => {
		const diagnosis = Buffer.concat([
			encodeStringField(1, 'stale'),
			encodeStringField(2, 'facts'),
			encodeStringField(3, 'auth.md'),
			encodeStringField(4, 'old token'),
			encodeStringField(5, 'refresh'),
			encodeStringField(6, 'unused-diagnosis'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, diagnosis),
			encodeStringField(2, 'one stale'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeMemoryReflectResponse(encoded);
		assert.deepStrictEqual(wire, {
			diagnoses: [{
				type: 'stale',
				category: 'facts',
				filename: 'auth.md',
				description: 'old token',
				suggestion: 'refresh',
			}],
			summary: 'one stale',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapMemoryReflectResponse(wire), {
			diagnoses: [{
				type: 'stale',
				category: 'facts',
				filename: 'auth.md',
				description: 'old token',
				suggestion: 'refresh',
			}],
			summary: 'one stale',
		});
		assert.deepStrictEqual(decodeMemoryReflectResponse(new Uint8Array(0)), {
			diagnoses: [],
			summary: undefined,
		});
		assert.deepStrictEqual(mapMemoryReflectResponse(decodeMemoryReflectResponse(new Uint8Array(0))), {
			diagnoses: [],
			summary: '',
		});
	});

	test('encodeMemoryRevertRequest writes 1-4; omits empty/0, not JSON', () => {
		const encoded = encodeMemoryRevertRequest({
			scope: 'global',
			category: 'facts',
			filename: 'auth.md',
			targetVersion: 2,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'global');
		assert.strictEqual(protoStrings(encoded).get(2), 'facts');
		assert.strictEqual(protoStrings(encoded).get(3), 'auth.md');
		assert.strictEqual(protoVarints(encoded).get(4), 2);
		const omitted = encodeMemoryRevertRequest({
			scope: '',
			category: '',
			filename: '',
			targetVersion: 0,
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(4));
	});

	test('decodeMemoryRevertResponse reads 1-3 then mapper; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'reverted'),
			encodeInt32Field(3, 2),
			encodeStringField(4, 'unused-field'),
		]);
		const wire = decodeMemoryRevertResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'reverted',
			reverted_to_version: 2,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapMemoryRevertResponse(wire), {
			success: true,
			message: 'reverted',
			revertedToVersion: 2,
		});
		assert.deepStrictEqual(decodeMemoryRevertResponse(new Uint8Array(0)), {
			success: false,
			message: undefined,
			reverted_to_version: undefined,
		});
		assert.deepStrictEqual(mapMemoryRevertResponse(decodeMemoryRevertResponse(new Uint8Array(0))), {
			success: false,
			message: '',
			revertedToVersion: 0,
		});
	});

	test('encodeMemoryHistoryRequest writes 1-4; omits empty/0, not JSON', () => {
		const encoded = encodeMemoryHistoryRequest({
			scope: 'global',
			category: 'facts',
			filename: 'auth.md',
			limit: 20,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'global');
		assert.strictEqual(protoStrings(encoded).get(2), 'facts');
		assert.strictEqual(protoStrings(encoded).get(3), 'auth.md');
		assert.strictEqual(protoVarints(encoded).get(4), 20);
		assert.strictEqual(encodeMemoryHistoryRequest({
			scope: '',
			category: '',
			filename: '',
			limit: 0,
		}).length, 0);
	});

	test('decodeMemoryHistoryResponse reads changes=1; ChangeEntry 1-5; unknown unread', () => {
		const change = Buffer.concat([
			encodeInt32Field(1, 3),
			encodeStringField(2, 'updated'),
			encodeStringField(3, 'token note'),
			encodeInt64Field(4, 1700000000000),
			encodeStringField(5, 'agent'),
			encodeStringField(6, 'unused-change'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, change),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeMemoryHistoryResponse(encoded);
		assert.deepStrictEqual(wire, {
			changes: [{
				version: 3,
				change_type: 'updated',
				summary: 'token note',
				timestamp: 1700000000000,
				author: 'agent',
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapMemoryHistoryResponse(wire), {
			changes: [{
				version: 3,
				changeType: 'updated',
				summary: 'token note',
				timestamp: 1700000000000,
				author: 'agent',
			}],
		});
		assert.deepStrictEqual(decodeMemoryHistoryResponse(new Uint8Array(0)), { changes: [] });
		assert.deepStrictEqual(mapMemoryHistoryResponse(decodeMemoryHistoryResponse(new Uint8Array(0))), { changes: [] });
	});

	test('memory unary wire source has no JSON.stringify and no Rebuild stream codec', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcMemoryUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(!/\bencodeMemoryRebuild|\bdecodeMemoryRebuild|\bmapMemoryRebuild/.test(source));
	});

	test('grpcClient Memory unary uses bytes; Rebuild stream stays JSON', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const clientPath = path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcClient.ts');
		const source = fs.readFileSync(clientPath, 'utf8');
		const methods: Array<{ name: string; encoder: string; decoder: string; mapper: string }> = [
			{ name: 'saveMemory', encoder: 'encodeMemorySaveRequest', decoder: 'decodeMemorySaveResponse', mapper: 'mapMemorySaveResponse' },
			{ name: 'searchMemory', encoder: 'encodeMemorySearchRequest', decoder: 'decodeMemorySearchResponse', mapper: 'mapMemorySearchResponse' },
			{ name: 'searchDeepMemory', encoder: 'encodeMemorySearchDeepRequest', decoder: 'decodeMemorySearchDeepResponse', mapper: 'mapMemorySearchDeepResponse' },
			{ name: 'readMemory', encoder: 'encodeMemoryReadRequest', decoder: 'decodeMemoryReadResponse', mapper: 'mapMemoryReadResponse' },
			{ name: 'listMemory', encoder: 'encodeMemoryListRequest', decoder: 'decodeMemoryListResponse', mapper: 'mapMemoryListResponse' },
			{ name: 'deleteMemory', encoder: 'encodeMemoryDeleteRequest', decoder: 'decodeMemoryDeleteResponse', mapper: 'mapMemoryDeleteResponse' },
			{ name: 'reflectMemory', encoder: 'encodeMemoryReflectRequest', decoder: 'decodeMemoryReflectResponse', mapper: 'mapMemoryReflectResponse' },
			{ name: 'revertMemory', encoder: 'encodeMemoryRevertRequest', decoder: 'decodeMemoryRevertResponse', mapper: 'mapMemoryRevertResponse' },
			{ name: 'historyMemory', encoder: 'encodeMemoryHistoryRequest', decoder: 'decodeMemoryHistoryResponse', mapper: 'mapMemoryHistoryResponse' },
		];
		for (const { name, encoder, decoder, mapper } of methods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(body.includes(mapper), `${name} must call ${mapper}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
		}
		const rebuildStart = source.indexOf('\topenRebuildMemoryStream(');
		assert.ok(rebuildStart >= 0, 'missing openRebuildMemoryStream');
		const rebuildEnd = source.indexOf('\n\tasync ', rebuildStart + 1);
		const rebuild = source.slice(rebuildStart, rebuildEnd >= 0 ? rebuildEnd : source.length);
		assert.ok(rebuild.includes('makeServerStreamClient'), 'openRebuildMemoryStream must stay JSON server-stream');
		assert.ok(!rebuild.includes('makeUnaryBytesClient'), 'openRebuildMemoryStream must not use bytes unary');
	});
});

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

function protoRepeatedStrings(encoded: Uint8Array, fieldNumber: number): string[] {
	const values: string[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(Buffer.from(field.bytes).toString('utf8'));
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

/**
 * proto wire type 1 (64-bit). Production codec skips it and has no double helper.
 * Payload is IEEE 754 LE only so the skip is distinguishable from a decoded score.
 */
function encodeFixed64Skip(field: number, value: number): Buffer {
	const payload = Buffer.alloc(8);
	payload.writeDoubleLE(value, 0);
	return Buffer.concat([encodeVarint((field << 3) | 1), payload]);
}
