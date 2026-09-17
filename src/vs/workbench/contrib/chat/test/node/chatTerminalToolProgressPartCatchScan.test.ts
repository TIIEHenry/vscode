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
const SOURCE_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts';

function chatTerminalToolProgressPartSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/widget/chatContentParts/toolInvocationParts/chatTerminalToolProgressPart.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatTerminalToolProgressPart.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatTerminalToolProgressPart leftover fire-and-forget catch scan (D675)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_toggleOutput leftover voids are double-chain; await / layout / refresh leftovers stay (D675)', () => {
		// _toggleOutput returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(chatTerminalToolProgressPartSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const trueCall = 'void this._toggleOutput(true)';
		const expandedCall = 'void this._toggleOutput(expanded)';
		const falseCall = 'void this._toggleOutput(false)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._toggleOutput\(true\)/g) ?? []).length, 6);
		assert.strictEqual((source.match(/void this\._toggleOutput\(expanded\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._toggleOutput\(false\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${trueCall}${doubleCatch};`));
		assert.ok(source.includes(`${expandedCall}${doubleCatch};`));
		assert.ok(source.includes(`${falseCall}${doubleCatch};`));
		assert.ok(!source.includes(`${trueCall};`));
		assert.ok(!source.includes(`${expandedCall};`));
		assert.ok(!source.includes(`${falseCall};`));
		assert.ok(!source.includes(`${trueCall}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${expandedCall}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${falseCall}.catch(onUnexpectedError);`));
		assert.ok(!/^\t+this\._toggleOutput\((?:true|false|expanded)\);/m.test(source));
		assert.strictEqual((source.match(/await this\._toggleOutput\(true\);/g) ?? []).length, 2);
		assert.strictEqual((source.match(/await this\._toggleOutput\(false\);/g) ?? []).length, 2);
		assert.ok(!source.includes('await this._toggleOutput(true).catch'));
		assert.ok(!source.includes('await this._toggleOutput(false).catch'));
		assert.strictEqual((source.match(/void this\._layoutMirrorWidth\(\);/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._outputView\.refresh\(\);/g) ?? []).length, 2);
		assert.ok(!source.includes('void this._layoutMirrorWidth().catch(onUnexpectedError)'));
		assert.ok(!source.includes('void this._outputView.refresh().catch(onUnexpectedError)'));
	});
});
