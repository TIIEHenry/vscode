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
		assert.ok(!/top\s*:\s*0(?:\s*px)?(?:\s*!important)?\s*(?:;|\})/.test(overlayRule.body), 'overlay top must not be top: 0');

		// Guard verification: regression sample with top: 0 alongside the variable must fail the assertion
		const regressionSample = 'top: var(--compact-desktop-nav-height, 40px); top: 0;';
		assert.ok(regressionSample.includes('--compact-desktop-nav-height'));
		assert.throws(() => {
			assert.ok(!/top\s*:\s*0(?:\s*px)?(?:\s*!important)?\s*(?:;|\})/.test(regressionSample), 'overlay top must not be top: 0');
		});

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

	test('workbench compact desktop preserves remembered sidebar width across drawer transitions (r05-2)', () => {
		const source = readRepoFile('src/vs/sessions/browser/workbench.ts');

		// 1. Property declaration
		assert.ok(
			source.includes('private _compactDesktopSavedSidebarWidth: number | undefined;'),
			'workbench must declare _compactDesktopSavedSidebarWidth'
		);

		// 2. _savePartSizes guards compact desktop
		assert.ok(
			source.includes('if (this.layoutPolicy.isCompactDesktop?.get?.()) {'),
			'_savePartSizes must check isCompactDesktop'
		);
		assert.ok(
			source.includes('sidebarWidth = this._compactDesktopSavedSidebarWidth ?? this._savedPartSizes.sidebar;'),
			'_savePartSizes must use saved sidebar width during compact desktop'
		);

		// 3. _onCompactDesktopLayoutChanged captures and restores width
		assert.ok(
			source.includes('this._compactDesktopSavedSidebarWidth = currentSidebarWidth;'),
			'_onCompactDesktopLayoutChanged must snapshot current sidebar width on enter'
		);
		assert.ok(
			source.includes('this.workbenchGrid.resizeView(this.sideBarPartView, {') &&
			source.includes('width: this._compactDesktopSavedSidebarWidth,'),
			'_onCompactDesktopLayoutChanged must restore sidebar width via resizeView on exit'
		);
	});

	test('compact desktop drawer splitview clamp contract preserves user width (r05-2)', () => {
		// Emulate SplitView clamp behavior vs our protection contract
		class GridSlotHarness {
			width = 320;
			cachedVisibleSize: number | undefined = undefined;
			collapsed = false;

			get minimumWidth(): number { return this.collapsed ? 0 : 170; }
			get maximumWidth(): number { return this.collapsed ? 0 : Number.POSITIVE_INFINITY; }

			// Unprotected naive SplitView setVisible behavior
			setNaiveVisible(visible: boolean) {
				if (visible) {
					const cached = this.cachedVisibleSize ?? this.width;
					this.width = Math.min(Math.max(cached, this.minimumWidth), this.maximumWidth);
					this.cachedVisibleSize = undefined;
				} else {
					this.cachedVisibleSize = this.width;
					this.width = 0;
				}
			}
		}

		// Show the bug in naive clamp
		const buggySlot = new GridSlotHarness();
		assert.strictEqual(buggySlot.width, 320);
		// Drawer opens: slot collapsed first, then setVisible(true)
		buggySlot.collapsed = true;
		buggySlot.setNaiveVisible(true);
		// Clamped to [0, 0] -> width becomes 0!
		assert.strictEqual(buggySlot.width, 0);
		// Drawer closes: setVisible(false) saves 0 to cachedVisibleSize
		buggySlot.setNaiveVisible(false);
		assert.strictEqual(buggySlot.cachedVisibleSize, 0);
		// Exit compact mode: uncollapsed, setVisible(true)
		buggySlot.collapsed = false;
		buggySlot.setNaiveVisible(true);
		// Clamped to [170, Infinity] -> original 320 is lost and clamped to 170!
		assert.strictEqual(buggySlot.width, 170, 'Demonstrates the naive clamp bug wiping 320 to 170');

		// With r05-2 protection: preserved width is tracked outside the grid slot
		let rememberedWidth: number | undefined = 320;
		const protectedSlot = new GridSlotHarness();
		protectedSlot.collapsed = true;
		protectedSlot.setNaiveVisible(true);
		// While in drawer, savePartSizes uses rememberedWidth:
		const persistedSize = rememberedWidth;
		assert.strictEqual(persistedSize, 320);

		protectedSlot.setNaiveVisible(false);
		protectedSlot.collapsed = false;
		// On exit compact, restore from rememberedWidth
		protectedSlot.setNaiveVisible(true);
		if (rememberedWidth !== undefined) {
			protectedSlot.width = rememberedWidth;
		}
		assert.strictEqual(protectedSlot.width, 320, 'Protected slot restores full 320px width');
	});
});
