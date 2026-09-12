/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(thisDir, '../../../../../../');
const BRAND_DIR = path.join(REPO_ROOT, 'resources', 'brand');
const GENERATE_ICONS_PATH = path.join(REPO_ROOT, 'build', 'brand', 'generate-icons.mjs');
const nodeRequire = createRequire(import.meta.url);

type BrandDerive = {
	deriveBoldSvg: (svg: string) => string;
	deriveInvertedSvg: (svg: string) => string;
	svgForSize: (fullSvg: string, boldSvg: string, size: number) => string;
};

function readBrandSvg(name: string): string {
	return fs.readFileSync(path.join(BRAND_DIR, name), 'utf8');
}

suite('universeAgentBrandDerive', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	let deriveBoldSvg: BrandDerive['deriveBoldSvg'];
	let deriveInvertedSvg: BrandDerive['deriveInvertedSvg'];
	let svgForSize: BrandDerive['svgForSize'];
	let source: string;
	let bold: string;
	let light: string;

	suiteSetup(() => {
		const brand = nodeRequire(GENERATE_ICONS_PATH) as BrandDerive;
		deriveBoldSvg = brand.deriveBoldSvg;
		deriveInvertedSvg = brand.deriveInvertedSvg;
		svgForSize = brand.svgForSize;
		source = readBrandSvg('universe-agent-studio.svg');
		bold = readBrandSvg('universe-agent-studio-bold.svg');
		light = readBrandSvg('universe-agent-studio-light.svg');
	});

	test('source SVG has UniverseAgentStudio aria-label', () => {
		assert.ok(source.includes('aria-label="UniverseAgentStudio"'));
	});

	test('deriveBoldSvg matches checked-in bold', () => {
		const derived = deriveBoldSvg(source);
		assert.strictEqual(derived, bold);
		assert.ok(derived.includes('stroke-width="24"'));
		assert.ok(!derived.includes('stroke-width="3"'));
		assert.strictEqual((derived.match(/<line x1="256" y1="256"/g) ?? []).length, 0);
		assert.ok(derived.includes('<circle cx="256" cy="256" r="20"'));
		assert.ok(!derived.includes('<circle cx="256" cy="256" r="12"'));
		assert.ok(derived.includes('<circle cx="256" cy="256" r="188"/>'));
		assert.ok(derived.includes('<polygon points="256,392 374,324 374,188 256,120 138,188 138,324"/>'));
		assert.ok(derived.includes('<polygon points="256,334 200,217 312,217"/>'));
	});

	test('deriveInvertedSvg matches checked-in light', () => {
		const derived = deriveInvertedSvg(source);
		assert.strictEqual(derived, light);
		assert.ok(derived.includes('#AB9185'));
		assert.ok(!derived.includes('#546E7A'));
		assert.ok(derived.includes('#000000'));
		assert.ok(!/#FFFFFF/i.test(derived));
		assert.ok(derived.includes('aria-label="UniverseAgentStudio Light"'));
		assert.strictEqual((derived.match(/<line x1="256" y1="256"/g) ?? []).length, 3);
		assert.ok(!derived.includes('singular-white'));
	});

	test('svgForSize uses bold at <=48 and full at 64', () => {
		for (const size of [16, 24, 32, 48]) {
			assert.strictEqual(svgForSize(source, bold, size), bold);
		}
		assert.strictEqual(svgForSize(source, bold, 64), source);
	});
});
