/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/workbench/api/common/extHostDocumentContentProviders.ts';

function extHostDocumentContentProvidersSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../common/extHostDocumentContentProviders.ts'),
		path.join(thisDir, '../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `extHostDocumentContentProviders.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ExtHostDocumentContentProviders leftover fire-and-forget catch scan (D666)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('virtual-document then leftover site is double-chain + finally; single-chain gone in this file only', () => {
		// $provideTextDocumentContent returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(extHostDocumentContentProvidersSourcePath(), 'utf8');
		const doubleCatchFinally = `})
					.catch(onUnexpectedError)
					.catch(onUnexpectedError)
					.finally(() => {
						if (lastEvent === thisEvent) {
							lastEvent = undefined;
						}
					});`;
		const singleCatchFinally = `})
					.catch(onUnexpectedError)
					.finally(() => {
						if (lastEvent === thisEvent) {
							lastEvent = undefined;
						}
					});`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.\$provideTextDocumentContent\(handle, uri\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCatchFinally));
		assert.ok(!source.includes(singleCatchFinally));
		assert.ok(source.includes('if (lastEvent === thisEvent)'));
		assert.ok(source.includes('lastEvent = undefined;'));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/\.catch\(/g) ?? []).length, 2);
		assert.strictEqual((source.match(/\.finally\(/g) ?? []).length, 1);
	});
});
