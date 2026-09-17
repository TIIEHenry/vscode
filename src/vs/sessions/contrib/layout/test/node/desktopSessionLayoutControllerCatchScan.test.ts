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
const LAYOUT_REL = 'src/vs/sessions/contrib/layout/browser/desktopSessionLayoutController.ts';

function desktopSessionLayoutControllerSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), LAYOUT_REL),
		path.join(thisDir, '../../browser/desktopSessionLayoutController.ts'),
		path.join(thisDir, '../../../../../../../', LAYOUT_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `desktopSessionLayoutController.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('DesktopSessionLayoutController leftover fire-and-forget catch scan (D604)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('openView / openViewContainer / _openDefaultAuxiliaryBarContainer voids double-catch onUnexpectedError (D604)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(desktopSessionLayoutControllerSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const openView = 'void this._viewsService.openView(CHANGES_VIEW_ID, false)';
		const openContainer = 'void this._viewsService.openViewContainer(savedContainerId, false)';
		const openDefault = 'void this._openDefaultAuxiliaryBarContainer()';
		const openDefaultId = 'void this._openDefaultAuxiliaryBarContainer(defaultContainerId)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._viewsService\.openView\(CHANGES_VIEW_ID, false\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._viewsService\.openViewContainer\(savedContainerId, false\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._openDefaultAuxiliaryBarContainer\(\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._openDefaultAuxiliaryBarContainer\(defaultContainerId\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 7);
		assert.ok(source.includes(`${openView}${doubleCatch};`));
		assert.ok(source.includes(`${openContainer}${doubleCatch};`));
		assert.ok(source.includes(`${openDefault}${doubleCatch};`));
		assert.ok(source.includes(`${openDefaultId}${doubleCatch};`));
		assert.ok(!source.includes(`${openView};`));
		assert.ok(!source.includes(`${openContainer};`));
		assert.ok(!source.includes(`${openDefault};`));
		assert.ok(!source.includes(`${openDefaultId};`));
		assert.ok(!source.includes(`${openView}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${openContainer}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${openDefault}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${openDefaultId}.catch(onUnexpectedError);`));
		assert.ok(source.includes('return this._viewsService.openView(CHANGES_VIEW_ID, false);'));
		assert.ok(source.includes('return this._viewsService.openViewContainer(containerId, false);'));
		assert.ok(!source.includes('return this._viewsService.openView(CHANGES_VIEW_ID, false).catch'));
		assert.ok(!source.includes('return this._viewsService.openViewContainer(containerId, false).catch'));
	});
});
