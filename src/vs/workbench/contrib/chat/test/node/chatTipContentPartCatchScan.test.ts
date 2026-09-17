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
const TIP_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatTipContentPart.ts';

function chatTipContentPartSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), TIP_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/widget/chatContentParts/chatTipContentPart.ts'),
		path.join(thisDir, '../../../../../../../', TIP_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatTipContentPart.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatTipContentPart leftover fire-and-forget catch scan (D653)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('actionHandler _handleTipAction is double-chain; bare/single-chain gone in this file only', () => {
		// _handleTipAction returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatTipContentPartSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'this._handleTipAction(link, md)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\._handleTipAction\(link, md\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
