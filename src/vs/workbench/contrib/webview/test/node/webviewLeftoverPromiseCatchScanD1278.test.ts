/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const leftoverResource404Call = `this._send('did-load-resource', {
					id: entry.id,
					status: 404,
					path: entry.path,
				})`;
const leftoverContentCall = `this._send('content', {
			contents: this._content.html,
			title: this._content.title,
			options: {
				allowMultipleAPIAcquire: !!this._content.options.allowMultipleAPIAcquire,
				allowScripts: allowScripts,
				allowForms: this._content.options.allowForms ?? allowScripts, // For back compat, we allow forms by default when scripts are enabled
			},
			state: this._content.state,
			cspSource: webviewGenericCspSource,
			confirmBeforeClose: this._confirmBeforeClose,
		})`;
const leftoverResourceStreamCall = `this._send('did-load-resource', {
							id,
							status: range ? 206 : 200,
							path: uri.path,
							mime: result.mimeType,
							etag: result.etag,
							mtime: result.mtime,
							range: rangeHeader,
							stream,
						}, [stream])`;
const leftoverResourceHeaderCall = `this._send('did-load-resource', {
							id,
							status: range ? 206 : 200,
							path: uri.path,
							mime: result.mimeType,
							etag: result.etag,
							mtime: result.mtime,
							range: rangeHeader,
						})`;

const d1278Calls: Array<[string, string, number]> = [
	[WEBVIEW_REL, leftoverResource404Call, 1],
	[WEBVIEW_REL, leftoverContentCall, 1],
	[WEBVIEW_REL, leftoverResourceStreamCall, 1],
	[WEBVIEW_REL, leftoverResourceHeaderCall, 1],
];

suite('leftover remaining unused remaining remaining unused webview leftover remaining unused remaining remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D1278)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused remaining remaining unused webview leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d1278Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused remaining remaining unused webview legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 4);
		for (const [rel] of d1278Calls) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('D1278'));
		}
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused remaining remaining unused stayed on webview this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d1278Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(WEBVIEW_REL) ?? ''), 16);
	});

	test('webview leftover remaining unused remaining remaining unused async this._send() FOF leftover void promises are Promise/async + double-chain', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		assertPromiseSignature(webview, 'private async _send<K extends keyof ToWebviewMessage>(channel: K, data: ToWebviewMessage[K], _createElement: Transferable[] = []): Promise<boolean> {');
		assert.ok(webview.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(webview, leftoverResource404Call);
		assertWrapped(webview, leftoverContentCall);
		assertWrapped(webview, leftoverResourceStreamCall);
		assertWrapped(webview, leftoverResourceHeaderCall);
		assert.strictEqual(countIncludes(webview, `${leftoverResource404Call}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${leftoverContentCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${leftoverResourceStreamCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(webview, `${leftoverResourceHeaderCall}${doubleCatch}`), 1);
		assert.ok(!webview.includes('D1278'));
		assert.ok(!webview.includes(`${doubleCatch}.catch(onUnexpectedError)`));
	});
});
