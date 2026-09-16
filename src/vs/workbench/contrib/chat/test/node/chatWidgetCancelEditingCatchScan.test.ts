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
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';

function chatWidgetSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), CHAT_WIDGET_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/widget/chatWidget.ts'),
		path.join(thisDir, '../../../../../../../', CHAT_WIDGET_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatWidget leftover fire-and-forget catch scan (D583)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('chatWidget cancelEditing voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleCancel = `void this.cancelEditing()${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('async cancelEditing('));
		assert.strictEqual((source.match(/void this\.cancelEditing\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.ok(source.includes(doubleCancel));
		assert.ok(!source.includes('void this.cancelEditing();'));
		assert.ok(!source.includes('void this.cancelEditing().catch(onUnexpectedError);'));
	});
});
