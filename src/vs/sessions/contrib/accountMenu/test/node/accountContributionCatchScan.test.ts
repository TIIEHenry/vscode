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
const ACCOUNT_REL = 'src/vs/sessions/contrib/accountMenu/browser/account.contribution.ts';

function accountContributionSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), ACCOUNT_REL),
		path.join(thisDir, '../../browser/account.contribution.ts'),
		path.join(thisDir, '../../../../../../../', ACCOUNT_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `account.contribution.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('Account contribution leftover fire-and-forget catch scan (D606)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('CHAT_PET_OPEN_ACHIEVEMENTS executeCommand void double-catch onUnexpectedError (D606)', () => {
		// Bare executeCommand voids leak on reject; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(accountContributionSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.commandService.executeCommand(CHAT_PET_OPEN_ACHIEVEMENTS_COMMAND_ID)';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(CHAT_PET_OPEN_ACHIEVEMENTS_COMMAND_ID\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes(`this.hoverService.hideHover(true);\n\t\t\tthis.clickPanelDisposable.clear();\n\t\t\t${doubleCall}`));
		assert.ok(source.includes('() => this.commandService.executeCommand(MANAGE_CHAT_COMMAND_ID, \'@provider:"Copilot"\')'));
		assert.ok(source.includes('() => this.commandService.executeCommand(MANAGE_CHAT_COMMAND_ID, \'@provider:"ChatGPT"\')'));
		assert.ok(!source.includes('void this.commandService.executeCommand(MANAGE_CHAT_COMMAND_ID'));
	});
});
