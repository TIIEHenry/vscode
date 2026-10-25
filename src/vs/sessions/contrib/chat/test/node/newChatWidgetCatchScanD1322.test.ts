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
const SOURCE_REL = 'src/vs/sessions/contrib/chat/browser/newChatWidget.ts';

function sourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/newChatWidget.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `newChatWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('NewChatWidget fire-and-forget catch scan (D1322)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('background prompt refresh and draft creation use double catches', () => {
		const source = fs.readFileSync(sourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._refreshPromptOptions\(\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._createNewSession\([^\n;]+/g) ?? []).length, 3);
		assert.ok(source.includes(`void this._refreshPromptOptions()${doubleCatch};`));
		assert.strictEqual((source.match(new RegExp(`void this\\._createNewSession\\([^\\n;]+${doubleCatch}`, 'g')) ?? []).length, 3);
		assert.ok(!source.includes('void this._refreshPromptOptions();'));
		assert.ok(!source.includes('void this._createNewSession(restoredFolderUri);'));
		assert.ok(!source.includes('void this._createNewSession(folderUri);'));
	});
});
