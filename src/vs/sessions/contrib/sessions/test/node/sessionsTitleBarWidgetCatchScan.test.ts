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
const TITLEBAR_REL = 'src/vs/sessions/contrib/sessions/browser/sessionsTitleBarWidget.ts';

function sessionsTitleBarWidgetSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), TITLEBAR_REL),
		path.join(thisDir, '../../browser/sessionsTitleBarWidget.ts'),
		path.join(thisDir, '../../../../../../../', TITLEBAR_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsTitleBarWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionsTitleBarWidget leftover fire-and-forget catch scan (D629)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_openBlockedSession openSessionToSide / openSession double-catch onUnexpectedError (D629)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionsTitleBarWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const openToSide = 'this.sessionsService.openSessionToSide(session, { preserveFocus, source: \'sessionsList\' })';
		const openSession = 'this.sessionsService.openSession(resource, { preserveFocus, source: \'sessionsList\' })';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private _openBlockedSession(resource: URI, preserveFocus: boolean, sideBySide: boolean): void'));
		assert.strictEqual((source.match(/this\.sessionsService\.openSessionToSide\(session, \{ preserveFocus, source: 'sessionsList' \}\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/this\.sessionsService\.openSession\(resource, \{ preserveFocus, source: 'sessionsList' \}\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${openToSide}${doubleCatch};`));
		assert.ok(source.includes(`${openSession}${doubleCatch};`));
		assert.ok(!source.includes(`${openToSide};`));
		assert.ok(!source.includes(`${openSession};`));
		assert.ok(!source.includes(`${openToSide}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${openSession}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this.commandService.executeCommand(SHOW_SESSIONS_PICKER_COMMAND_ID);'));
		assert.ok(!source.includes('this.commandService.executeCommand(SHOW_SESSIONS_PICKER_COMMAND_ID).catch'));
	});
});
