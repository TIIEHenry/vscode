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

function readHeaderSource(): string {
	const candidates = [
		path.join(process.cwd(), 'src/vs/workbench/contrib/agentsVoice/browser/components/headerComponent.ts'),
		path.join(thisDir, '../../browser/components/headerComponent.ts'),
	];
	const sourcePath = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(sourcePath, `headerComponent.ts not found from ${candidates.join(' | ')}`);
	return fs.readFileSync(sourcePath, 'utf8');
}

suite('agentsVoice header interaction (keyboard PTT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('push-to-talk mic supports keyboard press and release without repeated starts', () => {
		const source = readHeaderSource();
		assert.ok(source.includes("micBtn.onkeydown = (e: KeyboardEvent) => {"));
		assert.ok(source.includes("if (e.key !== 'Enter' && e.key !== ' ')"));
		assert.ok(source.includes("if (e.repeat || keyboardMicActive)"));
		assert.ok(source.includes("keyboardMicActive = true;"));
		assert.ok(source.includes("props.onMicDown(e);"));
		assert.ok(source.includes('micBtn.onkeyup = (e: KeyboardEvent) => {'));
		assert.ok(source.includes("keyboardMicActive = false;"));
		assert.ok(source.includes("props.onMicUp();"));
		assert.ok(source.includes('micBtn.onblur = () => {'));
	});

	test('voice controls expose a visible keyboard focus ring', () => {
		const source = readHeaderSource();
		assert.ok(source.includes("el.classList.add('agents-voice-control');"));
		assert.ok(source.includes("micBtn.classList.add('agents-voice-control');"));
		assert.ok(source.includes(".agents-voice-control:focus-visible"));
		assert.ok(source.includes("var(--vscode-focusBorder)"));
	});
});
