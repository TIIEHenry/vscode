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
const SOURCE_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts';

function inlineChatControllerSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/inlineChatController.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `inlineChatController.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('InlineChatController leftover fire-and-forget catch scan (D663)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('replay controller.run leftover site is one and double-chain (D663)', () => {
		// run returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(inlineChatControllerSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void controller.run({ message, autoSend: true })';
		assert.ok(source.includes("import { CancellationError, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('Must remain un-awaited so the shared widget clears its submit guard before the replay submits.'));
		assert.strictEqual((source.match(/void controller\.run\(\{ message, autoSend: true \}\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('openEditor SIDE_GROUP leftover site remains D145-style single-chain', () => {
		const source = fs.readFileSync(inlineChatControllerSourcePath(), 'utf8');
		const call = 'this.#editorService.openEditor({ resource: entry.modifiedURI }, SIDE_GROUP)';
		assert.strictEqual((source.match(/this\.#editorService\.openEditor\(\{ resource: entry\.modifiedURI \}, SIDE_GROUP\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError).catch(onUnexpectedError);`));
	});
});
