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
const SOURCE_REL = 'src/vs/sessions/contrib/sessionInputBanners/browser/sessionInputBannerWidget.ts';

function sessionInputBannerWidgetSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionInputBannerWidget.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionInputBannerWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionInputBannerWidget leftover fire-and-forget catch scan (D633)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onDidClick _runAction void double-catch onUnexpectedError (D633)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionInputBannerWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._runAction(action)';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _runAction(action: ISessionInputBannerAction): Promise<void> {'));
		assert.strictEqual((source.match(/void this\._runAction\(action\)/g) ?? []).length, 1);
		assert.ok(source.includes(`store.add(button.onDidClick(() => { ${doubleCall} }));`));
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('run: () => this._runAction(dropdownAction),'));
	});
});
