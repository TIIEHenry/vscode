/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const DIALOG_REL = 'src/vs/sessions/browser/sessionsSignInDialog.ts';

function sessionsSignInDialogSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), DIALOG_REL),
		path.join(thisDir, '../../browser/sessionsSignInDialog.ts'),
		path.join(thisDir, '../../../../../', DIALOG_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsSignInDialog.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionsSignInDialog leftover fire-and-forget catch scan (D578/D586)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('constructor show void catches onUnexpectedError', () => {
		const source = fs.readFileSync(sessionsSignInDialogSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.show()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assert.ok(source.includes('async show('));
		assert.strictEqual((source.match(/void this\.show\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${singleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(doubleCatch));
	});

	test('footer executeCommand RETURN_TO_VSCODE_EDITOR void catches onUnexpectedError (D586)', () => {
		const source = fs.readFileSync(sessionsSignInDialogSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void commandService.executeCommand<void>(RETURN_TO_VSCODE_EDITOR_COMMAND_ID)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void commandService\.executeCommand<void>\(RETURN_TO_VSCODE_EDITOR_COMMAND_ID\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${singleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(doubleCatch));
		assert.ok(source.includes(`void this.show()${singleCatch};`));
	});
});
