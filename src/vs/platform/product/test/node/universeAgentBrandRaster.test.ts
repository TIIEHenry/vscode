/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(thisDir, '../../../../../../');
const GENERATE_ICONS_PATH = path.join(REPO_ROOT, 'build', 'brand', 'generate-icons.mjs');
const nodeRequire = createRequire(import.meta.url);

type BrandRaster = {
	encodeBmp24: (width: number, height: number, rgba: ArrayLike<number>) => Buffer;
	encodeXpm: (width: number, height: number, rgba: ArrayLike<number>, name: string) => string;
	fillCanvas: (width: number, height: number, iconRgba: ArrayLike<number>, iconSize: number) => Buffer;
};

function rgbaAt(buf: Buffer, width: number, x: number, y: number): number[] {
	const i = (y * width + x) * 4;
	return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}

suite('universeAgentBrandRaster', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	let encodeBmp24: BrandRaster['encodeBmp24'];
	let encodeXpm: BrandRaster['encodeXpm'];
	let fillCanvas: BrandRaster['fillCanvas'];

	suiteSetup(() => {
		const brand = nodeRequire(GENERATE_ICONS_PATH) as BrandRaster;
		encodeBmp24 = brand.encodeBmp24;
		encodeXpm = brand.encodeXpm;
		fillCanvas = brand.fillCanvas;
	});

	test('encodeBmp24 writes BM header, 24-bit DIB, and bottom-up BGR with row pad', () => {
		const buf = encodeBmp24(2, 1, [255, 0, 0, 255, 0, 0, 255, 255]);
		assert.strictEqual(buf.toString('ascii', 0, 2), 'BM');
		assert.strictEqual(buf.readInt32LE(18), 2);
		assert.strictEqual(buf.readInt32LE(22), 1);
		assert.strictEqual(buf.readUInt16LE(28), 24);
		assert.strictEqual(buf.readUInt32LE(34), 8);
		assert.strictEqual(buf.length, 54 + 8);
		assert.deepStrictEqual(Array.from(buf.subarray(54, 62)), [0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00]);
	});

	test('encodeXpm writes header, #FF0000 and None, and named array without singular-white', () => {
		const xpm = encodeXpm(2, 1, [255, 0, 0, 255, 0, 0, 0, 0], 'code_xpm');
		assert.ok(xpm.includes('"2 1 2 1"'));
		assert.ok(xpm.includes('#FF0000'));
		assert.ok(xpm.includes('None'));
		assert.ok(xpm.includes('static char * code_xpm[]'));
		assert.ok(!xpm.includes('singular-white'));
	});

	test('fillCanvas paints brand corners and centered 2x2 opaque white', () => {
		const white2x2 = [
			255, 255, 255, 255,
			255, 255, 255, 255,
			255, 255, 255, 255,
			255, 255, 255, 255,
		];
		const out = fillCanvas(4, 4, white2x2, 2);
		const brand = [0x54, 0x6E, 0x7A, 255];
		const white = [255, 255, 255, 255];
		assert.deepStrictEqual(rgbaAt(out, 4, 0, 0), brand);
		assert.deepStrictEqual(rgbaAt(out, 4, 3, 0), brand);
		assert.deepStrictEqual(rgbaAt(out, 4, 0, 3), brand);
		assert.deepStrictEqual(rgbaAt(out, 4, 3, 3), brand);
		assert.deepStrictEqual(rgbaAt(out, 4, 1, 1), white);
		assert.deepStrictEqual(rgbaAt(out, 4, 2, 1), white);
		assert.deepStrictEqual(rgbaAt(out, 4, 1, 2), white);
		assert.deepStrictEqual(rgbaAt(out, 4, 2, 2), white);
	});
});
