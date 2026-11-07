/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

function stripCssComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collectCssRules(css: string): { selector: string; body: string }[] {
	const rules: { selector: string; body: string }[] = [];
	const re = /([^{}]+)\{([^{}]*)\}/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(css))) {
		const selector = match[1].trim();
		if (!selector.startsWith('@')) {
			rules.push({ selector, body: match[2] });
		}
	}
	return rules;
}

suite('Image carousel navigation focus styling', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('normal theme uses active toolbar feedback without a focus ring', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/imageCarousel/browser/media/imageCarousel.css'), 'utf8'));
		const rule = collectCssRules(css).find(candidate =>
			candidate.selector.includes('.monaco-workbench:not(.hc-black):not(.hc-light)') &&
			candidate.selector.includes('.image-carousel-editor .nav-arrow:focus-visible:not(:disabled)'));
		assert.ok(rule, 'normal image carousel arrow focus rule');
		assert.match(rule!.body, /outline\s*:\s*none/);
		assert.match(rule!.body, /toolbar-activeBackground/);
		assert.match(rule!.body, /opacity\s*:\s*1\s*!important/);
	});

	test('high contrast themes retain a contrast focus ring', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/imageCarousel/browser/media/imageCarousel.css'), 'utf8'));
		const rule = collectCssRules(css).find(candidate =>
			candidate.selector.includes('.monaco-workbench.hc-black') &&
			candidate.selector.includes('.image-carousel-editor .nav-arrow:focus-visible:not(:disabled)'));
		assert.ok(rule, 'HC image carousel arrow focus rule');
		assert.match(rule!.body, /contrastActiveBorder/);
		assert.match(rule!.body, /outline\s*:\s*1px\s+solid/);
	});
});
