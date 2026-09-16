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
const WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatAttachmentWidgets.ts';

function chatAttachmentWidgetsSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), WIDGET_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/attachments/chatAttachmentWidgets.ts'),
		path.join(thisDir, '../../../../../../../', WIDGET_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatAttachmentWidgets.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatAttachmentWidgets leftover fire-and-forget catch scan (D581)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('loadImageBytes void is double-caught; bare/single-chain gone in this file only', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatAttachmentWidgetsSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.loadImageBytes(resource, renderImageElements)';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('async loadImageBytes('));
		assert.strictEqual((source.match(/void this\.loadImageBytes\(resource, renderImageElements\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
