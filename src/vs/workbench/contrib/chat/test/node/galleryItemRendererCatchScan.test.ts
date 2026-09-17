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
const GALLERY_ITEM_RENDERER_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/galleryItemRenderer.ts';

function galleryItemRendererSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), GALLERY_ITEM_RENDERER_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/aiCustomization/galleryItemRenderer.ts'),
		path.join(thisDir, '../../../../../../../', GALLERY_ITEM_RENDERER_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `galleryItemRenderer.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('GalleryItemRenderer leftover fire-and-forget catch scan (D592)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('galleryItemRenderer leftover list-renderer Install onDidClick voids double-catch onUnexpectedError (D592)', () => {
		// Inner try/finally is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(galleryItemRendererSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void \(async \(\) => \{/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\)\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(`})()${doubleCatch};`));
		assert.ok(source.includes('await this._provider.install(element);'));
		assert.ok(!source.includes('installButton.onDidClick(async () => {'));
		assert.ok(!source.includes('onDidClick(async () => {'));
		assert.ok(!source.includes('onDidClick(async'));
		assert.ok(!source.includes('})().catch(onUnexpectedError);'));
	});
});
