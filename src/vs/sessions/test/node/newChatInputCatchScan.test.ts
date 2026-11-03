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

function assertImportsOnUnexpectedError(source: string): void {
	assert.ok(
		/import\s*\{[^}]*\bonUnexpectedError\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/\.\.\/\.\.\/base\/common\/errors\.js['"]/.test(source),
		"newChatInput.ts must import onUnexpectedError from base/common/errors.js"
	);
}

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

	test('OTEL status hover executeCommand voids catch onUnexpectedError (D594)', () => {
		const source = fs.readFileSync(newChatInputSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const openDocs = `void this.commandService.executeCommand('vscode.open', URI.parse(OTEL_DOCS_URL))`;
		const openSettings = `void this.commandService.executeCommand(OPEN_OTEL_SETTINGS_COMMAND)`;
		assertImportsOnUnexpectedError(source);
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\('vscode\.open', URI\.parse\(OTEL_DOCS_URL\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.commandService\.executeCommand\(OPEN_OTEL_SETTINGS_COMMAND\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${openDocs}${singleCatch};`));
		assert.ok(source.includes(`${openSettings}${singleCatch};`));
		assert.ok(!source.includes(`${openDocs};`));
		assert.ok(!source.includes(`${openSettings};`));
		assert.ok(!source.includes(doubleCatch));
		assert.strictEqual((source.match(/this\.hoverService\.hideHover\(true\);/g) ?? []).length, 2);
	});
});

suite('NewChatInput leftover fire-and-forget catch scan (D602)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('toggleDictation voids catch onUnexpectedError (D602)', () => {
		const source = fs.readFileSync(newChatInputSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const pillVoid = 'void this.toggleDictation()';
		const toggleHelper = 'const toggle = () => this.toggleDictation()';
		assertImportsOnUnexpectedError(source);
		assert.strictEqual((source.match(/void this\.toggleDictation\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${pillVoid}${singleCatch};`));
		assert.ok(!source.includes(`${pillVoid};`));
		assert.ok(!source.includes(doubleCatch));
		assert.strictEqual((source.match(/const toggle = \(\) => this\.toggleDictation\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${toggleHelper}${singleCatch};`));
		assert.ok(!source.includes(`${toggleHelper};`));
	});
});

suite('NewChatInput leftover fire-and-forget catch scan (D610)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('dictation command handler toggleDictation catch onUnexpectedError (D610)', () => {
		const source = fs.readFileSync(newChatInputSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const handlerCall = 'activeDictationComposer?.toggleDictation()';
		assertImportsOnUnexpectedError(source);
		assert.strictEqual((source.match(/activeDictationComposer\?\.toggleDictation\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${handlerCall}?${singleCatch}`));
		assert.ok(!source.includes('handler: () => activeDictationComposer?.toggleDictation(),'));
		assert.ok(!source.includes(doubleCatch));
		assert.ok(!source.includes(`${handlerCall};`));
	});
});
