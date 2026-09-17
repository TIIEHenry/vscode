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
const CLAUDE_PICKER_REL = 'src/vs/sessions/contrib/providers/agentHost/browser/agentHostClaudePermissionModePicker.ts';

function claudePermissionModePickerSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), CLAUDE_PICKER_REL),
		path.join(thisDir, '../../browser/agentHostClaudePermissionModePicker.ts'),
		path.join(thisDir, '../../../../../../../../', CLAUDE_PICKER_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentHostClaudePermissionModePicker.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentHostClaudePermissionModePicker leftover fire-and-forget catch scan (D609)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Learn more opener void double-catch onUnexpectedError (D609)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(claudePermissionModePickerSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._openerService.open(URI.parse(CLAUDE_PERMISSION_MODE_LEARN_MORE_URL))';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._openerService\.open\(URI\.parse\(CLAUDE_PERMISSION_MODE_LEARN_MORE_URL\)\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('protected override _handleFooterActionItem(item: IAgentHostSessionEnumPickerItem): boolean'));
	});
});
