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

	test('AUXCLICK CLOSE_CHAT executeCommand void single-catch onUnexpectedError (D608)', () => {
		const source = fs.readFileSync(chatCompositeBarSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._commandService.executeCommand(CLOSE_CHAT_COMMAND_ID, { session, chat })';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._commandService\.executeCommand\(CLOSE_CHAT_COMMAND_ID, \{ session, chat \}\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${singleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(doubleCatch));
		assert.ok(source.includes('EventType.AUXCLICK'));
	});
});

suite('ChatCompositeBar leftover fire-and-forget catch scan (D616)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('inline renameChat void single-catch onUnexpectedError (D616)', () => {
		const source = fs.readFileSync(chatCompositeBarSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = '.renameChat(delegate.session, chat.resource, newTitle)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/\.renameChat\(delegate\.session, chat\.resource, newTitle\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}\n\t\t\t\t\t${singleCatch};`));
		assert.ok(!source.includes(doubleCatch));
		assert.ok(source.includes('CLOSE_CHAT_COMMAND_ID'));
	});
});
