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
const SOURCE_REL = 'src/vs/sessions/contrib/chat/browser/sessionCustomizations.ts';

function sessionCustomizationsSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionCustomizations.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionCustomizations.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionCustomizations leftover fire-and-forget catch scan (D605)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_reveal executeCommand OpenEditor void double-catch onUnexpectedError (D605)', () => {
		// Bare executeCommand voids leak on reject; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionCustomizationsSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = `void this._commandService.executeCommand(AICustomizationManagementCommands.OpenEditor, {
			section: customizationSections.get(customization.kind),
			revealUri: customization.uri,
		})`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private _reveal(customization: ISessionChatCustomization): void'));
		assert.strictEqual((source.match(/void this\._commandService\.executeCommand\(AICustomizationManagementCommands\.OpenEditor/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
