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
const NEW_CHAT_INPUT_REL = 'src/vs/sessions/contrib/chat/browser/newChatInput.ts';

function newChatInputSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), NEW_CHAT_INPUT_REL),
		path.join(thisDir, '../../contrib/chat/browser/newChatInput.ts'),
		path.join(thisDir, '../../../../../', NEW_CHAT_INPUT_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `newChatInput.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('NewChatInput leftover fire-and-forget catch scan (D594)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('OTEL status hover executeCommand voids double-catch onUnexpectedError (D594)', () => {
		// Bare executeCommand voids leak on reject; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(newChatInputSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const openDocs = `void this.commandService.executeCommand('vscode.open', URI.parse(OTEL_DOCS_URL))`;
		const openSettings = `void this.commandService.executeCommand(OPEN_OTEL_SETTINGS_COMMAND)`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\('vscode\.open', URI\.parse\(OTEL_DOCS_URL\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(OPEN_OTEL_SETTINGS_COMMAND\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${openDocs}${doubleCatch};`));
		assert.ok(source.includes(`${openSettings}${doubleCatch};`));
		assert.ok(!source.includes(`${openDocs};`));
		assert.ok(!source.includes(`${openSettings};`));
		assert.ok(!source.includes(`${openDocs}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${openSettings}.catch(onUnexpectedError);`));
		assert.strictEqual((source.match(/this\.hoverService\.hideHover\(true\);/g) ?? []).length, 2);
		assert.ok(source.includes('void this.toggleDictation();'));
		assert.ok(!source.includes('void this.toggleDictation().catch'));
	});
});
