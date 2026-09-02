#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
 * UniverseAgentStudio I3a brand icon generator.
 *
 * Single vector source: resources/brand/universe-agent-studio.svg
 * Run from repo root or this directory:
 *   node build/brand/generate-icons.mjs
 *   npm --prefix build/brand install && npm --prefix build/brand run generate
 *
 * Toolchain (plan §4.2.3): node + sharp + png-to-ico + @fiahfy/icns.
 * Does not call gulp, iconutil, inkscape, or ImageMagick.
 * Missing optional packages: still write SVG derivatives; skip PNG/ICO/ICNS/BMP/XPM
 * that need that package and print a missing-tools report (exit 1).
 *--------------------------------------------------------------------------------------------*/

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const SOURCE_SIZE = 512;
const HICOLOR_SIZES = [16, 24, 32, 48, 64, 128, 256, 512];
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const FAVICON_SIZES = [16, 32, 48];
const ICNS_SLOTS = [
	{ osType: 'icp4', size: 16 },
	{ osType: 'icp5', size: 32 },
	{ osType: 'icp6', size: 64 },
	{ osType: 'ic07', size: 128 },
	{ osType: 'ic08', size: 256 },
	{ osType: 'ic09', size: 512 },
	{ osType: 'ic10', size: 1024 },
	{ osType: 'ic11', size: 32 },
	{ osType: 'ic12', size: 64 },
	{ osType: 'ic13', size: 256 },
	{ osType: 'ic14', size: 512 },
];
/** Exact pixel sizes of the upstream Inno wizard bitmaps (I3b consumes these paths). */
const INNO_BIG = [
	[100, 164, 314],
	[125, 192, 386],
	[150, 246, 459],
	[175, 273, 556],
	[200, 328, 604],
	[225, 355, 700],
	[250, 410, 797],
];
const INNO_SMALL = [
	[100, 55, 55],
	[125, 64, 68],
	[150, 83, 80],
	[175, 92, 97],
	[200, 110, 106],
	[225, 119, 123],
	[250, 138, 140],
];
const BRAND_BG = { r: 0x54, g: 0x6e, b: 0x7a, a: 255 };

const written = [];
const skipped = [];
const missingTools = [];

function rel(absPath) {
	return absPath.startsWith(repoRoot) ? absPath.slice(repoRoot.length + 1) : absPath;
}

async function writeOut(absPath, data) {
	await mkdir(dirname(absPath), { recursive: true });
	await writeFile(absPath, data);
	written.push(rel(absPath));
}

/**
 * ≤48px 粗线派生（方案 §4.2.2，脚本内写死）：
 * stroke-width 3→24；删除从圆心出发的三条辐射线；中心点 r 12→20。
 */
function deriveBoldSvg(svg) {
	return svg
		.replace(/stroke-width="3"/, 'stroke-width="24"')
		.replace(/\s*<line x1="256" y1="256"[^/\n]*\/>/g, '')
		.replace(/<circle cx="256" cy="256" r="12"/, '<circle cx="256" cy="256" r="20"');
}

/** 浅底变体：对主源填色 / 描边做通道反色，不引用 singular-white.svg。 */
function deriveInvertedSvg(svg) {
	return svg
		.replace(/#546E7A/gi, '#__BRAND_BG__')
		.replace(/#FFFFFF/gi, '#__BRAND_FG__')
		.replace(/#__BRAND_BG__/g, '#AB9185')
		.replace(/#__BRAND_FG__/g, '#000000')
		.replace('aria-label="UniverseAgentStudio"', 'aria-label="UniverseAgentStudio Light"');
}

function svgForSize(fullSvg, boldSvg, size) {
	return size <= 48 ? boldSvg : fullSvg;
}

async function tryLoad(name) {
	const require = createRequire(import.meta.url);
	const candidates = [];
	try {
		candidates.push(require.resolve(name));
	} catch {
		// fall through
	}
	candidates.push(join(__dirname, 'node_modules', name, 'package.json'));
	for (const candidate of candidates) {
		try {
			const spec = candidate.endsWith('package.json')
				? pathToFileURL(join(dirname(candidate), (await readPackageMain(candidate)))).href
				: pathToFileURL(candidate).href;
			return await import(spec);
		} catch {
			// try next
		}
	}
	try {
		return await import(name);
	} catch {
		missingTools.push(name);
		return undefined;
	}
}

async function readPackageMain(packageJsonPath) {
	const pkg = JSON.parse(await readFile(packageJsonPath, 'utf8'));
	const main = pkg.module || pkg.main || 'index.js';
	return main;
}

function encodeBmp24(width, height, rgba) {
	const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
	const pixelSize = rowSize * height;
	const buf = Buffer.alloc(54 + pixelSize);
	buf.write('BM', 0);
	buf.writeUInt32LE(54 + pixelSize, 2);
	buf.writeUInt32LE(54, 10);
	buf.writeUInt32LE(40, 14);
	buf.writeInt32LE(width, 18);
	buf.writeInt32LE(height, 22);
	buf.writeUInt16LE(1, 26);
	buf.writeUInt16LE(24, 28);
	buf.writeUInt32LE(pixelSize, 34);
	for (let y = 0; y < height; y++) {
		const srcY = height - 1 - y;
		const destRow = 54 + y * rowSize;
		for (let x = 0; x < width; x++) {
			const i = (srcY * width + x) * 4;
			const dest = destRow + x * 3;
			buf[dest] = rgba[i + 2];
			buf[dest + 1] = rgba[i + 1];
			buf[dest + 2] = rgba[i];
		}
	}
	return buf;
}

const XPM_CHARS = '.+@#$%&*=-;:>,<1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

function xpmKey(index, cpp) {
	const base = XPM_CHARS.length;
	let n = index;
	let key = '';
	for (let i = 0; i < cpp; i++) {
		key = XPM_CHARS[n % base] + key;
		n = Math.floor(n / base);
	}
	return key;
}

function encodeXpm(width, height, rgba, name) {
	const palette = new Map();
	const order = [];
	const pixelIdx = new Uint32Array(width * height);

	for (let i = 0; i < width * height; i++) {
		const o = i * 4;
		const a = rgba[o + 3];
		const hex = a < 16
			? 'none'
			: `#${[rgba[o], rgba[o + 1], rgba[o + 2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
		let idx = palette.get(hex);
		if (idx === undefined) {
			idx = order.length;
			palette.set(hex, idx);
			order.push(hex);
		}
		pixelIdx[i] = idx;
	}

	let cpp = 1;
	while (XPM_CHARS.length ** cpp < order.length) {
		cpp += 1;
		if (cpp > 4) {
			throw new Error(`XPM palette overflow (${order.length} colors)`);
		}
	}
	const keys = order.map((_, i) => xpmKey(i, cpp));

	const lines = [
		'/* XPM */',
		`static char * ${name}[] = {`,
		`"${width} ${height} ${order.length} ${cpp}",`,
	];
	for (let i = 0; i < order.length; i++) {
		const hex = order[i];
		const color = hex === 'none' ? 'None' : hex;
		lines.push(`"${keys[i]}\tc ${color}",`);
	}
	for (let y = 0; y < height; y++) {
		let row = '';
		for (let x = 0; x < width; x++) {
			row += keys[pixelIdx[y * width + x]];
		}
		const comma = y === height - 1 ? '' : ',';
		lines.push(`"${row}"${comma}`);
	}
	lines.push('};', '');
	return lines.join('\n');
}

function fillCanvas(width, height, iconRgba, iconSize) {
	const out = Buffer.alloc(width * height * 4);
	for (let i = 0; i < width * height; i++) {
		out[i * 4] = BRAND_BG.r;
		out[i * 4 + 1] = BRAND_BG.g;
		out[i * 4 + 2] = BRAND_BG.b;
		out[i * 4 + 3] = BRAND_BG.a;
	}
	const ox = Math.floor((width - iconSize) / 2);
	const oy = Math.floor((height - iconSize) / 2);
	for (let y = 0; y < iconSize; y++) {
		for (let x = 0; x < iconSize; x++) {
			const dx = ox + x;
			const dy = oy + y;
			if (dx < 0 || dy < 0 || dx >= width || dy >= height) {
				continue;
			}
			const si = (y * iconSize + x) * 4;
			const a = iconRgba[si + 3] / 255;
			if (a <= 0) {
				continue;
			}
			const di = (dy * width + dx) * 4;
			out[di] = Math.round(iconRgba[si] * a + out[di] * (1 - a));
			out[di + 1] = Math.round(iconRgba[si + 1] * a + out[di + 1] * (1 - a));
			out[di + 2] = Math.round(iconRgba[si + 2] * a + out[di + 2] * (1 - a));
			out[di + 3] = 255;
		}
	}
	return out;
}

async function main() {
	const sourcePath = join(repoRoot, 'resources', 'brand', 'universe-agent-studio.svg');
	const fullSvg = await readFile(sourcePath, 'utf8');
	if (!fullSvg.includes('aria-label="UniverseAgentStudio"')) {
		throw new Error(`${rel(sourcePath)} must use aria-label="UniverseAgentStudio"`);
	}
	const boldSvg = deriveBoldSvg(fullSvg);
	const lightSvg = deriveInvertedSvg(fullSvg);

	await writeOut(join(repoRoot, 'resources', 'brand', 'universe-agent-studio-bold.svg'), boldSvg);
	await writeOut(join(repoRoot, 'resources', 'brand', 'universe-agent-studio-light.svg'), lightSvg);
	await writeOut(join(repoRoot, 'src', 'vs', 'workbench', 'browser', 'media', 'code-icon.svg'), fullSvg);

	const sharpMod = await tryLoad('sharp');
	const pngToIcoMod = await tryLoad('png-to-ico');
	const icnsMod = await tryLoad('@fiahfy/icns');

	const sharp = sharpMod?.default ?? sharpMod;
	const pngToIco = pngToIcoMod?.default ?? pngToIcoMod;
	const Icns = icnsMod?.Icns;
	const IcnsImage = icnsMod?.IcnsImage;

	if (!sharp) {
		skipped.push('all PNG / ICO / ICNS / BMP / XPM raster outputs (sharp missing)');
		printReport();
		process.exitCode = 1;
		return;
	}

	const pngCache = new Map();

	async function renderPng(size) {
		const cached = pngCache.get(size);
		if (cached) {
			return cached;
		}
		const svg = svgForSize(fullSvg, boldSvg, size);
		const buf = await sharp(Buffer.from(svg), { density: 72 * (size / SOURCE_SIZE) })
			.resize(size, size)
			.png()
			.toBuffer();
		pngCache.set(size, buf);
		return buf;
	}

	async function renderRgba(size) {
		const svg = svgForSize(fullSvg, boldSvg, size);
		return sharp(Buffer.from(svg), { density: 72 * (size / SOURCE_SIZE) })
			.resize(size, size)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
	}

	// Linux pixmap + hicolor
	await writeOut(join(repoRoot, 'resources', 'linux', 'code.png'), await renderPng(512));
	for (const size of HICOLOR_SIZES) {
		const dest = join(
			repoRoot,
			'resources',
			'linux',
			'icons',
			'hicolor',
			`${size}x${size}`,
			'apps',
			'universe-agent-studio.png',
		);
		await writeOut(dest, await renderPng(size));
	}

	const xpmRgba = await renderRgba(512);
	await writeOut(
		join(repoRoot, 'resources', 'linux', 'rpm', 'code.xpm'),
		encodeXpm(xpmRgba.info.width, xpmRgba.info.height, xpmRgba.data, 'code_xpm'),
	);

	// Windows PNGs
	await writeOut(join(repoRoot, 'resources', 'win32', 'code_70x70.png'), await renderPng(70));
	await writeOut(join(repoRoot, 'resources', 'win32', 'code_150x150.png'), await renderPng(150));

	if (pngToIco) {
		const icoInputs = [];
		for (const size of ICO_SIZES) {
			icoInputs.push(await renderPng(size));
		}
		await writeOut(join(repoRoot, 'resources', 'win32', 'code.ico'), await pngToIco(icoInputs));

		const favInputs = [];
		for (const size of FAVICON_SIZES) {
			favInputs.push(await renderPng(size));
		}
		await writeOut(join(repoRoot, 'resources', 'server', 'favicon.ico'), await pngToIco(favInputs));
	} else {
		skipped.push('resources/win32/code.ico');
		skipped.push('resources/server/favicon.ico');
	}

	for (const [dpi, w, h] of INNO_BIG) {
		const iconSize = Math.min(w, h);
		const { data } = await renderRgba(iconSize);
		const canvas = fillCanvas(w, h, data, iconSize);
		await writeOut(join(repoRoot, 'resources', 'win32', `inno-big-${dpi}.bmp`), encodeBmp24(w, h, canvas));
	}
	for (const [dpi, w, h] of INNO_SMALL) {
		const iconSize = Math.min(w, h);
		const { data } = await renderRgba(iconSize);
		const canvas = fillCanvas(w, h, data, iconSize);
		await writeOut(join(repoRoot, 'resources', 'win32', `inno-small-${dpi}.bmp`), encodeBmp24(w, h, canvas));
	}

	// macOS ICNS
	if (Icns && IcnsImage) {
		const icns = new Icns();
		for (const slot of ICNS_SLOTS) {
			icns.append(IcnsImage.fromPNG(await renderPng(slot.size), slot.osType));
		}
		await writeOut(join(repoRoot, 'resources', 'darwin', 'code.icns'), icns.data);
	} else {
		skipped.push('resources/darwin/code.icns');
	}

	// Web / server
	await writeOut(join(repoRoot, 'resources', 'server', 'code-192.png'), await renderPng(192));
	await writeOut(join(repoRoot, 'resources', 'server', 'code-512.png'), await renderPng(512));

	printReport();
	if (missingTools.length) {
		process.exitCode = 1;
	}
}

function printReport() {
	console.log(`Wrote ${written.length} file(s):`);
	for (const p of written) {
		console.log(`  ${p}`);
	}
	if (skipped.length) {
		console.log('Skipped:');
		for (const p of skipped) {
			console.log(`  ${p}`);
		}
	}
	if (missingTools.length) {
		console.log(`Missing tools/packages: ${missingTools.join(', ')}`);
	} else {
		console.log('Missing tools/packages: none (node sharp / png-to-ico / @fiahfy/icns)');
	}
}

main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
