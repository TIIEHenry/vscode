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
const CHAT_INPUT_PART_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts';

function chatInputPartSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), CHAT_INPUT_PART_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/widget/input/chatInputPart.ts'),
		path.join(thisDir, '../../../../../../../', CHAT_INPUT_PART_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatInputPart.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatInputPart leftover fire-and-forget catch scan (D599)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('chatInputPart result.finally void double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatInputPartSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const finallyCall = 'void result.finally(() => this._updateInputContentContextKeys())';
		const doubleFinally = `${finallyCall}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private _requestProgrammaticLanguageModel('));
		assert.ok(source.includes('requestProgrammaticSelection('));
		assert.strictEqual((source.match(/void result\.finally\(\(\) => this\._updateInputContentContextKeys\(\)\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleFinally));
		assert.ok(source.includes(`${doubleFinally}\n\t\treturn result;`));
		assert.ok(!source.includes(`${finallyCall};`));
		assert.ok(!source.includes(`${finallyCall}.catch(onUnexpectedError);`));
		assert.ok(!source.includes('return result.finally'));
	});
});
