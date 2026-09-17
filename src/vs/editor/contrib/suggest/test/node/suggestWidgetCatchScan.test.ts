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
const SOURCE_REL = 'src/vs/editor/contrib/suggest/browser/suggestWidget.ts';

function suggestWidgetSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/suggestWidget.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `suggestWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SuggestWidget leftover fire-and-forget catch scan (D673)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_currentSuggestionDetails.then leftover site keeps then body and is double-chain; single-chain gone (D673)', () => {
		// _currentSuggestionDetails is CancelablePromise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(suggestWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const thenSite = `this._currentSuggestionDetails.then(() => {
				if (index >= this._list.length || item !== this._list.element(index)) {
					return;
				}

				// item can have extra information, so re-render
				this._ignoreFocusEvents = true;
				this._list.splice(index, 1, [item]);
				this._list.setFocus([index]);
				this._ignoreFocusEvents = false;

				if (this._isDetailsVisible()) {
					this._showDetails(false, false);
				} else {
					this.element.domNode.classList.remove('docs-side');
				}

				this.editor.setAriaOptions({ activeDescendant: this._list.getElementID(index) });
			})`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\._currentSuggestionDetails\.then\(/g) ?? []).length, 1);
		assert.strictEqual((source.split(thenSite).length - 1), 1);
		assert.ok(source.includes(`${thenSite}${doubleCatch};`));
		assert.ok(!source.includes(`${thenSite};`));
		assert.ok(!source.includes(`${thenSite}.catch(onUnexpectedError);`));
		assert.ok(!source.includes('\t\t}).catch(onUnexpectedError);'));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\.catch\(/g) ?? []).length, 2);
	});
});
