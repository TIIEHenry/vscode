/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const PRELOADS_REL = 'src/vs/workbench/contrib/notebook/browser/view/renderers/webviewPreloads.ts';
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function resolvePreloads(): string {
	const candidates = [
		path.join(process.cwd(), PRELOADS_REL),
		path.join(thisDir, '../../browser/view/renderers/webviewPreloads.ts'),
		path.join(thisDir, '../../../../../../../', PRELOADS_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `webviewPreloads.ts not found (${candidates.join(' | ')})`);
	return found;
}

suite('Notebook renderer load retry', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('load drops _loadPromise only when the rejected attempt is still current', () => {
		const source = fs.readFileSync(resolvePreloads(), 'utf8');
		const start = source.indexOf('private load(): Promise<rendererApi.RendererApi | undefined> {');
		const end = source.indexOf('private async _load():', start);
		assert.ok(start >= 0 && end > start, 'Renderer.load not found');
		const load = source.slice(start, end);
		const catchAt = load.indexOf('promise.catch(() => {');
		const stillCurrent = load.indexOf('if (this._loadPromise === promise) {', catchAt);
		const clear = load.indexOf('this._loadPromise = undefined;', stillCurrent);
		assert.ok(catchAt >= 0 && stillCurrent > catchAt && clear > stillCurrent, 'rejected attempt must clear _loadPromise only while it is still current');
		assert.strictEqual((load.match(/this\._load\(\)/g) ?? []).length, 1, 'one load call must not retry');
		assert.ok(load.includes('return this._loadPromise;'));
		assert.ok(!source.includes(doubleCatch));
	});
});
