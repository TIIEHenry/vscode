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
const SOURCE_REL = 'src/vs/workbench/contrib/chat/browser/widget/input/editor/agentHostInputCompletions.ts';

function agentHostInputCompletionsSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/widget/input/editor/agentHostInputCompletions.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentHostInputCompletions.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentHostInputCompletions leftover fire-and-forget catch scan (D651)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('existing and added scheme _registerForScheme voids are double-caught; bare/single-chain gone in this file only', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(agentHostInputCompletionsSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const registerVoid = 'void this._registerForScheme(scheme)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _registerForScheme(scheme: string): Promise<void> {'));
		assert.ok(source.includes('for (const scheme of this._chatSessionsService.getContentProviderSchemes())'));
		assert.ok(source.includes('for (const scheme of added)'));
		assert.strictEqual((source.match(/void this\._registerForScheme\(scheme\)/g) ?? []).length, 2);
		assert.strictEqual((source.split(`${registerVoid}${doubleCatch};`).length - 1), 2);
		assert.ok(!source.includes(`${registerVoid};`));
		assert.ok(!source.includes(`${registerVoid}.catch(onUnexpectedError);`));
	});
});
