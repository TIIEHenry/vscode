/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const CHAT_BAR_REL = 'src/vs/sessions/browser/parts/chatCompositeBar.ts';

function chatCompositeBarSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), CHAT_BAR_REL),
		path.join(thisDir, '../../browser/parts/chatCompositeBar.ts'),
		path.join(thisDir, '../../../../../', CHAT_BAR_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatCompositeBar.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatCompositeBar leftover fire-and-forget catch scan (D608)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('AUXCLICK CLOSE_CHAT executeCommand void double-catch onUnexpectedError (D608)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatCompositeBarSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._commandService.executeCommand(CLOSE_CHAT_COMMAND_ID, { session, chat })';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._commandService\.executeCommand\(CLOSE_CHAT_COMMAND_ID, \{ session, chat \}\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('EventType.AUXCLICK'));
		assert.ok(source.includes('.renameChat(delegate.session, chat.resource, newTitle)\n\t\t\t\t\t.catch(onUnexpectedError);'));
		assert.ok(!source.includes('.renameChat(delegate.session, chat.resource, newTitle)\n\t\t\t\t\t.catch(onUnexpectedError).catch(onUnexpectedError);'));
	});
});
