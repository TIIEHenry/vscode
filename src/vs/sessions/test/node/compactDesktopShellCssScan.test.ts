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

function readRepoFile(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

function stripCssComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collectCssRules(css: string): { selector: string; body: string }[] {
	const rules: { selector: string; body: string }[] = [];
	const re = /([^{}]+)\{([^{}]*)\}/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(css))) {
		const selector = match[1].trim();
		if (selector.startsWith('@')) {
			continue;
		}
		rules.push({ selector, body: match[2] });
	}
	return rules;
}

suite('Compact desktop shell CSS scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('compact desktop shell overlay uses nav height variable and nav host has higher z-index', () => {
		const css = stripCssComments(readRepoFile('src/vs/sessions/browser/parts/compactDesktop/compactDesktopShell.css'));
		const rules = collectCssRules(css);

		const overlayRule = rules.find(rule => rule.selector.includes('.part.sidebar.compact-desktop-overlay-sidebar'));
		assert.ok(overlayRule, 'compact desktop overlay sidebar rule must exist');
		assert.ok(overlayRule.body.includes('--compact-desktop-nav-height'), 'overlay top must use --compact-desktop-nav-height');
		assert.ok(!/top\s*:\s*0/.test(overlayRule.body), 'overlay top must not be top: 0');

		const navHostRule = rules.find(rule => rule.selector.includes('.compact-desktop-nav-host'));
		assert.ok(navHostRule, 'compact desktop nav host rule must exist');
		assert.match(navHostRule.body, /position\s*:\s*relative/);

		const overlayZIndexMatch = overlayRule.body.match(/z-index\s*:\s*(\d+)/);
		const navHostZIndexMatch = navHostRule.body.match(/z-index\s*:\s*(\d+)/);
		assert.ok(overlayZIndexMatch, 'overlay sidebar must have numeric z-index');
		assert.ok(navHostZIndexMatch, 'nav host must have numeric z-index');
		const overlayZIndex = parseInt(overlayZIndexMatch[1], 10);
		const navHostZIndex = parseInt(navHostZIndexMatch[1], 10);
		assert.ok(navHostZIndex > overlayZIndex, `nav host z-index (${navHostZIndex}) must be higher than overlay z-index (${overlayZIndex})`);
	});
});
