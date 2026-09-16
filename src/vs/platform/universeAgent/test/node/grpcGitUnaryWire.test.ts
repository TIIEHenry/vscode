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
	decodeReadGitChangesResponse,
	decodeReadGitFileDiffResponse,
	decodeReadGitSummaryResponse,
	decodeWriteGitWriteResponse,
	encodeReadGitChangesRequest,
	encodeReadGitFileDiffRequest,
	encodeReadGitSummaryRequest,
	encodeWriteGitApplyHunksRequest,
	encodeWriteGitCommitRequest,
	encodeWriteGitStagePathsRequest,
} from '../../node/grpc/grpcGitUnaryWire.js';
import {
	mapReadGitChangesResponse,
	mapReadGitFileDiffResponse,
	mapReadGitSummaryResponse,
	mapWriteGitWriteResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc git unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeReadGitSummaryRequest writes session_id field 1, not JSON', () => {
		const encoded = encodeReadGitSummaryRequest({ sessionId: 'sess-1' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodeReadGitSummaryRequest({ sessionId: '' }).length, 0);
	});

	test('encodeReadGitChangesRequest is the same session_id field 1 encoder', () => {
		const encoded = encodeReadGitChangesRequest({ sessionId: 'sess-1' });
		assert.deepStrictEqual(Buffer.from(encoded), Buffer.from(encodeReadGitSummaryRequest({ sessionId: 'sess-1' })));
		assert.strictEqual(encodeReadGitChangesRequest({ sessionId: '' }).length, 0);
	});

	test('decodeReadGitSummaryResponse reads 1-4 then mapper; unknown fields unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeStringField(3, 'main'),
			encodeInt32Field(4, 3),
			encodeStringField(5, 'unused-field'),
		]);
		const wire = decodeReadGitSummaryResponse(encoded);
		assert.deepStrictEqual(wire, {
			supported: true,
			reason: 'ok',
			branch: 'main',
			change_count: 3,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapReadGitSummaryResponse(wire), {
			supported: true,
			reason: 'ok',
			branch: 'main',
			changeCount: 3,
		});
		assert.deepStrictEqual(decodeReadGitSummaryResponse(new Uint8Array(0)), {
			supported: false,
			reason: undefined,
			branch: undefined,
			change_count: undefined,
		});
		assert.deepStrictEqual(mapReadGitSummaryResponse(decodeReadGitSummaryResponse(new Uint8Array(0))), {
			supported: false,
			reason: '',
			branch: '',
			changeCount: 0,
		});
	});

	test('decodeReadGitChangesResponse reads entries field 4; GitChangeEntryProto 1-4; unknown unread', () => {
		const entry = Buffer.concat([
			encodeStringField(1, 'src/a.ts'),
			encodeStringField(2, 'src/old.ts'),
			encodeStringField(3, 'renamed'),
			encodeStringField(4, 'unstaged'),
			encodeStringField(5, 'unused-entry'),
		]);
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeStringField(3, 'main'),
			encodeMessageField(4, entry),
			encodeStringField(5, 'unused-field'),
		]);
		const wire = decodeReadGitChangesResponse(encoded);
		assert.deepStrictEqual(wire, {
			supported: true,
			reason: 'ok',
			branch: 'main',
			entries: [{
				path: 'src/a.ts',
				old_path: 'src/old.ts',
				kind: 'renamed',
				index_state: 'unstaged',
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapReadGitChangesResponse(wire), {
			supported: true,
			reason: 'ok',
			branch: 'main',
			entries: [{
				path: 'src/a.ts',
				oldPath: 'src/old.ts',
				kind: 'renamed',
				indexState: 'unstaged',
			}],
		});
		assert.deepStrictEqual(decodeReadGitChangesResponse(new Uint8Array(0)), {
			supported: false,
			reason: undefined,
			branch: undefined,
			entries: [],
		});
		assert.deepStrictEqual(mapReadGitChangesResponse(decodeReadGitChangesResponse(new Uint8Array(0))), {
			supported: false,
			reason: '',
			branch: '',
			entries: [],
		});
	});

	test('encodeReadGitFileDiffRequest writes session_id=1 path=2 index_state=3; omits empty', () => {
		const encoded = encodeReadGitFileDiffRequest({ sessionId: 'sess-1', path: 'src/a.ts', indexState: 'unstaged' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'src/a.ts');
		assert.strictEqual(protoStrings(encoded).get(3), 'unstaged');
		assert.ok(!protoStrings(encoded).has(4));
		assert.strictEqual(encodeReadGitFileDiffRequest({ sessionId: '', path: '', indexState: '' }).length, 0);
	});

	test('decodeReadGitFileDiffResponse reads 1-4 then mapper; unknown fields unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeStringField(3, 'src/a.ts'),
			encodeStringField(4, '@@ -1 +1 @@\n-a\n+b\n'),
			encodeStringField(5, 'unused-field'),
		]);
		const wire = decodeReadGitFileDiffResponse(encoded);
		assert.deepStrictEqual(wire, {
			supported: true,
			reason: 'ok',
			path: 'src/a.ts',
			unified_diff: '@@ -1 +1 @@\n-a\n+b\n',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapReadGitFileDiffResponse(wire), {
			supported: true,
			reason: 'ok',
			path: 'src/a.ts',
			unifiedDiff: '@@ -1 +1 @@\n-a\n+b\n',
		});
		assert.deepStrictEqual(decodeReadGitFileDiffResponse(new Uint8Array(0)), {
			supported: false,
			reason: undefined,
			path: undefined,
			unified_diff: undefined,
		});
		assert.deepStrictEqual(mapReadGitFileDiffResponse(decodeReadGitFileDiffResponse(new Uint8Array(0))), {
			supported: false,
			reason: '',
			path: '',
			unifiedDiff: '',
		});
	});

	test('encodeWriteGitStagePathsRequest writes session_id=1 and GitArgvCommand.argv=1; omits empty', () => {
		const encoded = encodeWriteGitStagePathsRequest({
			sessionId: 'sess-1',
			commands: [
				{ argv: ['git', 'add', '--', 'a.ts'] },
				{ argv: ['git', 'add', '-u'] },
			],
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.deepStrictEqual(
			protoMessages(encoded, 2).map(command => protoRepeatedStrings(command, 1)),
			[['git', 'add', '--', 'a.ts'], ['git', 'add', '-u']],
		);
		assert.strictEqual(encodeWriteGitStagePathsRequest({ sessionId: '', commands: [] }).length, 0);
		const emptyArgv = encodeWriteGitStagePathsRequest({ sessionId: '', commands: [{ argv: [] }] });
		assert.strictEqual(emptyArgv.length, 0);
	});

	test('encodeWriteGitCommitRequest writes 1-4 and omits false bools', () => {
		const encoded = encodeWriteGitCommitRequest({
			sessionId: 'sess-1',
			message: 'fix: git wire',
			signOff: true,
			amend: true,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'fix: git wire');
		assert.strictEqual(protoVarints(encoded).get(3), 1);
		assert.strictEqual(protoVarints(encoded).get(4), 1);
		const omitted = encodeWriteGitCommitRequest({
			sessionId: '',
			message: '',
			signOff: false,
			amend: false,
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(3));
		assert.ok(!protoVarints(omitted).has(4));
	});

	test('encodeWriteGitApplyHunksRequest writes session_id=1 argv=2 patches=3; omits empty', () => {
		const encoded = encodeWriteGitApplyHunksRequest({
			sessionId: 'sess-1',
			argv: ['git', 'apply', '--cached'],
			patches: ['@@ -1 +1 @@\n-a\n+b\n'],
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 2), ['git', 'apply', '--cached']);
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 3), ['@@ -1 +1 @@\n-a\n+b\n']);
		assert.strictEqual(encodeWriteGitApplyHunksRequest({ sessionId: '', argv: [], patches: [] }).length, 0);
	});

	test('decodeWriteGitWriteResponse reads 1-6 then mapper; unknown fields unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'denied'),
			encodeInt32Field(5, 1),
			encodeStringField(6, 'staged'),
			encodeStringField(7, 'unused-field'),
		]);
		const wire = decodeWriteGitWriteResponse(encoded);
		assert.deepStrictEqual(wire, {
			supported: true,
			reason: 'ok',
			success: true,
			error_message: 'denied',
			exit_code: 1,
			stdout: 'staged',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapWriteGitWriteResponse(wire), {
			supported: true,
			reason: 'ok',
			success: true,
			errorMessage: 'denied',
			exitCode: 1,
			stdout: 'staged',
		});
		assert.deepStrictEqual(decodeWriteGitWriteResponse(new Uint8Array(0)), {
			supported: false,
			reason: undefined,
			success: false,
			error_message: undefined,
			exit_code: undefined,
			stdout: undefined,
		});
		assert.deepStrictEqual(mapWriteGitWriteResponse(decodeWriteGitWriteResponse(new Uint8Array(0))), {
			supported: false,
			reason: '',
			success: false,
			errorMessage: '',
			exitCode: 0,
			stdout: '',
		});
	});

	test('grpcClient Git six unaries use bytes', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const clientPath = path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcClient.ts');
		const source = fs.readFileSync(clientPath, 'utf8');
		const gitMethods: Array<{ name: string; encoder: string; decoder: string }> = [
			{ name: 'readGitSummary', encoder: 'encodeReadGitSummaryRequest', decoder: 'decodeReadGitSummaryResponse' },
			{ name: 'readGitChanges', encoder: 'encodeReadGitChangesRequest', decoder: 'decodeReadGitChangesResponse' },
			{ name: 'readGitFileDiff', encoder: 'encodeReadGitFileDiffRequest', decoder: 'decodeReadGitFileDiffResponse' },
			{ name: 'writeGitStagePaths', encoder: 'encodeWriteGitStagePathsRequest', decoder: 'decodeWriteGitWriteResponse' },
			{ name: 'writeGitCommit', encoder: 'encodeWriteGitCommitRequest', decoder: 'decodeWriteGitWriteResponse' },
			{ name: 'writeGitApplyHunks', encoder: 'encodeWriteGitApplyHunksRequest', decoder: 'decodeWriteGitWriteResponse' },
		];
		for (const { name, encoder, decoder } of gitMethods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
		}
		assert.ok(extractAsyncMethod(source, 'readGitSummary').includes('mapReadGitSummaryResponse'));
		assert.ok(extractAsyncMethod(source, 'readGitChanges').includes('mapReadGitChangesResponse'));
		assert.ok(extractAsyncMethod(source, 'readGitFileDiff').includes('mapReadGitFileDiffResponse'));
		assert.ok(extractAsyncMethod(source, 'writeGitStagePaths').includes('mapWriteGitWriteResponse'));
		assert.ok(extractAsyncMethod(source, 'writeGitCommit').includes('mapWriteGitWriteResponse'));
		assert.ok(extractAsyncMethod(source, 'writeGitApplyHunks').includes('mapWriteGitWriteResponse'));
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
