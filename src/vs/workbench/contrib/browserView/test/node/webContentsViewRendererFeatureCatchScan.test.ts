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
const SOURCE_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/webContentsViewRendererFeature.ts';

function webContentsViewRendererFeatureSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/browserView/electron-browser/features/webContentsViewRendererFeature.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `webContentsViewRendererFeature.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('WebContentsViewRendererFeature leftover fire-and-forget catch scan (D682)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_doScreenshot / _handleKeyEvent / setVisible / focus leftover voids are double-chain; DOM focus stays skipped', () => {
		// These methods return Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(webContentsViewRendererFeatureSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const screenshot = 'void this._doScreenshot()';
		const keyEvent = 'void this._handleKeyEvent(keyEvent)';
		const setVisibleTrue = 'void this._model.setVisible(true)';
		const setVisibleFalse = 'void this._model.setVisible(false)';
		const modelFocus = 'void this._model.focus()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._doScreenshot\(\)/g) ?? []).length, 4);
		assert.strictEqual((source.match(/void this\._handleKeyEvent\(keyEvent\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._model\.setVisible\(true\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._model\.setVisible\(false\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._model\.focus\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${screenshot}${doubleCatch}`));
		assert.ok(source.includes(`${keyEvent}${doubleCatch}`));
		assert.ok(source.includes(`${setVisibleTrue}${doubleCatch};`));
		assert.ok(source.includes(`${setVisibleFalse}${doubleCatch};`));
		assert.ok(source.includes(`${modelFocus}${doubleCatch};`));
		assert.ok(!source.includes(`${screenshot};`));
		assert.ok(!source.includes(`${keyEvent};`));
		assert.ok(!source.includes(`${setVisibleTrue};`));
		assert.ok(!source.includes(`${setVisibleFalse};`));
		assert.ok(!source.includes(`${modelFocus};`));
		assert.ok(!source.includes(`${screenshot}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${keyEvent}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${setVisibleTrue}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${setVisibleFalse}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${modelFocus}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this._container?.focus();'));
		assert.ok(!source.includes('this._container?.focus().catch'));
	});
});
