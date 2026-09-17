/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

suite('grpcClientCalls makeClientStreamBytesClient', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('makeClientStreamBytesClient exists; serializes proto bytes; JSON makeClientStreamClient stays', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClientCalls.ts'), 'utf8');
		assert.ok(/\bexport function makeClientStreamBytesClient\b/.test(source), 'identifier makeClientStreamBytesClient must exist');
		assert.ok(/\bexport function makeClientStreamClient\b/.test(source), 'JSON makeClientStreamClient must stay');

		const jsonStart = source.indexOf('export function makeClientStreamClient<');
		assert.ok(jsonStart >= 0, 'missing makeClientStreamClient');
		const jsonEnd = source.indexOf('export function makeClientStreamBytesClient<', jsonStart + 1);
		const jsonBody = source.slice(jsonStart, jsonEnd >= 0 ? jsonEnd : source.length);
		assert.ok(jsonBody.includes('JSON.stringify'), 'makeClientStreamClient must keep JSON.stringify');
		assert.ok(jsonBody.includes('JSON.parse'), 'makeClientStreamClient must keep JSON.parse');
		assert.ok(jsonBody.includes('createStreamCloseGate'));
		assert.ok(jsonBody.includes("gate.finish({ kind: 'error'"));
		assert.ok(jsonBody.includes("gate.finish({ kind: 'remote'"));
		assert.ok(jsonBody.includes('gate.closeLocal()'));
		assert.ok(jsonBody.includes('call.cancel()'));
		assert.ok(jsonBody.includes('call.end()'));
		assert.ok(jsonBody.includes('call.write('));

		const bytesStart = source.indexOf('export function makeClientStreamBytesClient<');
		assert.ok(bytesStart >= 0, 'missing makeClientStreamBytesClient');
		const bytesEnd = source.indexOf('\nexport function ', bytesStart + 1);
		const bytesBody = source.slice(bytesStart, bytesEnd >= 0 ? bytesEnd : source.length);
		assert.ok(!bytesBody.includes('JSON.stringify'), 'makeClientStreamBytesClient must not JSON.stringify');
		assert.ok(!bytesBody.includes('JSON.parse'), 'makeClientStreamBytesClient must not JSON.parse');
		assert.ok(bytesBody.includes('asUnaryProtoBytes'), 'makeClientStreamBytesClient must serialize via asUnaryProtoBytes');
		assert.ok(bytesBody.includes('decode: (buffer: Buffer) => TResponse'), 'makeClientStreamBytesClient must take caller decode');
		assert.ok(bytesBody.includes('(buffer: Buffer) => decode(buffer)'));
		assert.ok(bytesBody.includes('write(chunk: Uint8Array)'));
		assert.ok(bytesBody.includes('createStreamCloseGate'));
		assert.ok(bytesBody.includes("gate.finish({ kind: 'error'"));
		assert.ok(bytesBody.includes("gate.finish({ kind: 'remote'"));
		assert.ok(bytesBody.includes('gate.closeLocal()'));
		assert.ok(bytesBody.includes('call.cancel()'));
		assert.ok(bytesBody.includes('call.end()'));
		assert.ok(bytesBody.includes('call.write('));
	});

	test('openUploadAttachmentStream stays makeClientStreamClient JSON this slice; skip leftover RPCs', () => {
		const client = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const upload = extractMethod(client, 'openUploadAttachmentStream');
		assert.ok(upload.includes('makeClientStreamClient<Record<string, unknown>'), 'openUploadAttachmentStream must stay JSON client-stream this slice');
		assert.ok(!upload.includes('makeClientStreamBytesClient'), 'openUploadAttachmentStream must not wire makeClientStreamBytesClient this slice');
		assert.ok(!upload.includes('encodeUploadChunk'));
		assert.ok(!upload.includes('decodeUploadResponse'));
		assert.ok(!upload.includes('JSON.stringify'), 'JSON.stringify lives in makeClientStreamClient, not the method body');

		assert.ok(!extractAsyncMethod(client, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(client, 'saveSkillContent').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(client, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(client, 'connect').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(client, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(client, 'resolveTurn').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(client, 'resolveAnchor').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(client, 'resolveAnchor').includes('makeUnaryClient<'));

		const watch = extractMethod(client, 'openWatchConfigStream');
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcClientCalls.ts')));
	assert.ok(dir, 'grpcClientCalls.ts not found from cwd or import.meta');
	return dir;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}

function extractMethod(source: string, name: string): string {
	const start = source.indexOf(`\t${name}(`);
	assert.ok(start >= 0, `missing ${name}(`);
	const from = start + 1;
	const next = source.slice(from).search(/\n\t(?:async )?[A-Za-z][A-Za-z0-9]*\(/);
	const end = next >= 0 ? from + next : source.length;
	return source.slice(start, end);
}
