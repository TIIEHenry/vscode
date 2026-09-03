/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(thisDir, '../../../../../../');
const SESSION_VIEW_HOST_PATH = path.join(REPO_ROOT, 'src/vs/platform/universeAgent/node/sessionViewHost.ts');

function countOccurrences(source: string, needle: string): number {
	let count = 0;
	let index = 0;
	while ((index = source.indexOf(needle, index)) !== -1) {
		count += 1;
		index += needle.length;
	}
	return count;
}

function extractMethodBody(source: string, methodName: string): string | undefined {
	const signature = `private ${methodName}(`;
	const start = source.indexOf(signature);
	if (start < 0) {
		return undefined;
	}
	const braceStart = source.indexOf('{', start);
	if (braceStart < 0) {
		return undefined;
	}
	let depth = 0;
	for (let i = braceStart; i < source.length; i++) {
		const ch = source[i];
		if (ch === '{') {
			depth += 1;
		} else if (ch === '}') {
			depth -= 1;
			if (depth === 0) {
				return source.slice(braceStart, i + 1);
			}
		}
	}
	return undefined;
}

suite('SessionViewHost post discipline (F2)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('core.post and takeIntents each appear once inside postAndDrain / drainIntents', () => {
		const source = fs.readFileSync(SESSION_VIEW_HOST_PATH, 'utf8');

		assert.strictEqual(countOccurrences(source, 'this.core.post('), 1, 'expected exactly one core.post call site');
		assert.strictEqual(countOccurrences(source, 'this.core.takeIntents('), 1, 'expected exactly one core.takeIntents call site');

		const postAndDrainBody = extractMethodBody(source, 'postAndDrain');
		const drainIntentsBody = extractMethodBody(source, 'drainIntents');
		assert.ok(postAndDrainBody, 'postAndDrain method not found');
		assert.ok(drainIntentsBody, 'drainIntents method not found');

		assert.ok(postAndDrainBody!.includes('this.core.post('), 'core.post must live inside postAndDrain');
		assert.ok(drainIntentsBody!.includes('this.core.takeIntents('), 'takeIntents must live inside drainIntents');
	});
});
