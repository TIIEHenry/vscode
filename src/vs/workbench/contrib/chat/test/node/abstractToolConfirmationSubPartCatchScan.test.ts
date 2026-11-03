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
const SOURCE_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/abstractToolConfirmationSubPart.ts';

function abstractToolConfirmationSubPartSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/abstractToolConfirmationSubPart.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `abstractToolConfirmationSubPart.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AbstractToolConfirmationSubPart leftover fire-and-forget catch scan (D655)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('closeEditors(toClose) is single-chain; bare / double-chain gone in this file only', () => {
		const source = fs.readFileSync(abstractToolConfirmationSubPartSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'this._editorService.closeEditors(toClose)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\._editorService\.closeEditors\(toClose\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${singleCatch};`) || source.includes(`void ${call}${singleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`void ${call};`));
		assert.ok(!source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`void ${call}${doubleCatch};`));
	});
});
