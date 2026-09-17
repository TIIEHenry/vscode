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
const MODE_PICKER_REL = 'src/vs/sessions/contrib/providers/copilotChatSessions/browser/modePicker.ts';

function modePickerSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), MODE_PICKER_REL),
		path.join(thisDir, '../../browser/modePicker.ts'),
		path.join(thisDir, '../../../../../../../../', MODE_PICKER_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `modePicker.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ModePicker leftover fire-and-forget catch scan (D601)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('configure OpenEditor executeCommand void double-catch onUnexpectedError (D601)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(modePickerSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, AICustomizationManagementSection.Agents)';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(AICustomizationManagementCommands\.OpenEditor, AICustomizationManagementSection\.Agents\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this._selectMode(item.mode);'));
		assert.ok(!source.includes('this._selectMode(item.mode).catch'));
	});
});
