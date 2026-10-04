/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const DIALOG_REL = 'src/vs/base/browser/ui/dialog/dialog.css';
const ONBOARDING_REL = 'src/vs/workbench/contrib/welcomeOnboarding/browser/media/variationA.css';

function readRepoFile(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found!, 'utf8');
}

function stripCssComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

suite('modal mask has no backdrop-filter', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('dialog dim and onboarding overlay keep a translucent mask and drop only the blur', () => {
		const dialog = stripCssComments(readRepoFile(DIALOG_REL));
		const onboarding = stripCssComments(readRepoFile(ONBOARDING_REL));

		assert.ok(!dialog.includes('backdrop-filter'), 'dialog.css must not blur the modal mask');
		assert.ok(!onboarding.includes('backdrop-filter'), 'variationA.css must not blur the onboarding mask');

		assert.ok(
			dialog.includes('.monaco-dialog-modal-block.dimmed {\n\tbackground: var(--vscode-widget-shadow, rgba(0, 0, 0, 0.45));\n}'),
			'dialog dim keeps its translucent background',
		);
		assert.ok(dialog.includes('box-shadow: var(--vscode-shadow-xl);'), 'dialog box keeps its floating shadow');

		assert.ok(onboarding.includes('background: rgba(0, 0, 0, 0.4);'), 'onboarding overlay keeps its translucent background');
		assert.ok(onboarding.includes('.onboarding-a-card {'), 'onboarding card rule remains');
		const cardStart = onboarding.indexOf('.onboarding-a-card {');
		const cardEnd = onboarding.indexOf('}', cardStart);
		const cardBody = onboarding.slice(cardStart, cardEnd);
		assert.ok(cardBody.includes('box-shadow:'), 'onboarding card keeps its floating shadow');
	});
});
