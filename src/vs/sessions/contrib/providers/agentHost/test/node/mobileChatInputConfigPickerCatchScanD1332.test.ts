/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/sessions/contrib/providers/agentHost/browser/mobile/mobileChatInputConfigPicker.ts';

function sourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/mobile/mobileChatInputConfigPicker.ts'),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `mobileChatInputConfigPicker.ts not found from ${candidates.join(' | ')}`);
	return found;
}

suite('MobileChatInputConfigPicker fire-and-forget catch scan (D1332)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('all sheet entry points catch presentation failures', () => {
		const source = fs.readFileSync(sourcePath(), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._showSheet\(\)/g) ?? []).length, 3);
		assert.strictEqual((source.match(/void this\._showSheet\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 3);
		assert.ok(!source.includes('void this._showSheet();'));
	});
});
