/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Copies production sources from Desktop `session-core` into
// `src/vs/platform/universeAgent/common/sessionView/` (view layer) and
// `src/vs/platform/universeAgent/node/sessionCore/` (Actor / fold runtime).
// Run via:
//
//   npx tsx scripts/sync-universe-agent-session-core.ts
//
// Transformations applied:
//   1. Skips `*.test.ts`, `testing/`, and both barrels (`index.ts`, `view/index.ts`) —
//      vscode writes its own, and the upstream core barrel re-exports the skipped `testing/`.
//   2. Converts 2-space indentation to tabs.
//   3. Rewrites `./view/*.js` references to `../../common/sessionView/*.js` in non-view
//      files, in both `from '...'` and inline `import('...')` type positions.
//   4. Drops import specifiers the vendored file never references, so the tree compiles
//      under this repo's `noUnusedLocals`. Upstream carries dead imports we cannot edit
//      by hand; pruning belongs to the generator.
//   5. Preserves upstream file headers verbatim.
//
// After sync, maintain `common/sessionView/index.ts` by hand (do not vendor upstream index).

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_REPO = process.env['UA_DESKTOP_REPO'] ?? path.resolve(ROOT, '../UniverseAgentDesktop');
const SOURCE_DIR = path.join(DESKTOP_REPO, 'packages/session-core/src');
const SESSION_VIEW_DIR = path.join(ROOT, 'src/vs/platform/universeAgent/common/sessionView');
const SESSION_CORE_DIR = path.join(ROOT, 'src/vs/platform/universeAgent/node/sessionCore');

const EXCLUDE_DIR_NAMES = new Set([
	'testing',
	'node_modules',
]);

const EXCLUDE_RELATIVE_FILES = new Set([
	'index.ts',
	'view/index.ts',
]);

function getSourceCommitHash(): string {
	// Set when re-syncing the pin recorded in SYNC.md from an exported tree rather
	// than from a live checkout, so the pin survives the round trip.
	const pinned = process.env['UA_DESKTOP_COMMIT'];
	if (pinned) {
		return pinned.trim();
	}
	try {
		return execSync('git rev-parse HEAD', { cwd: DESKTOP_REPO, encoding: 'utf-8' }).trim();
	} catch {
		return 'unknown';
	}
}

function convertIndentation(content: string): string {
	const lines = content.split('\n');
	return lines.map(line => {
		const match = line.match(/^( +)/);
		if (!match) {
			return line;
		}
		const spaces = match[1].length;
		const tabs = Math.floor(spaces / 2);
		const remainder = spaces % 2;
		return '\t'.repeat(tabs) + ' '.repeat(remainder) + line.slice(spaces);
	}).join('\n');
}

function rewriteViewImports(content: string): string {
	return content
		.replace(/from '\.\/view\/([^']+\.js)'/g, 'from \'../../common/sessionView/$1\'')
		.replace(/import\('\.\/view\/([^']+\.js)'\)/g, 'import(\'../../common/sessionView/$1\')');
}

function stripComments(content: string): string {
	return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Drops non-exported top-level `function` declarations that nothing else references.
 * Upstream split some helpers into per-fold modules but left the original copy
 * behind; the live copy lives in the fold module, so the leftover is dead here.
 */
function pruneUnusedLocalFunctions(content: string): string {
	for (;;) {
		const lines = content.split('\n');
		const bodyless = stripComments(content);
		let removedAt = -1;

		for (let i = 0; i < lines.length && removedAt < 0; i++) {
			const declared = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(lines[i]);
			if (!declared) {
				continue;
			}
			const name = declared[1];
			const references = bodyless.match(new RegExp(`\\b${name}\\b`, 'g'));
			if (!references || references.length > 1) {
				continue;
			}
			// Walk to the closing brace of the body. A multi-line signature keeps
			// depth at 0 for several lines, so only look for the close once the
			// body has actually opened.
			let depth = 0;
			let opened = false;
			let end = -1;
			for (let j = i; j < lines.length; j++) {
				for (const ch of stripComments(lines[j])) {
					if (ch === '{') {
						depth++;
						opened = true;
					} else if (ch === '}') {
						depth--;
					}
				}
				if (opened && depth === 0) {
					end = j;
					break;
				}
			}
			if (end > i) {
				lines.splice(i, end - i + 1);
				removedAt = i;
			}
		}

		if (removedAt < 0) {
			return content;
		}
		content = lines.join('\n');
	}
}

/**
 * Removes import specifiers whose name never appears outside the import block.
 * Deliberately conservative: an identifier mentioned anywhere else in the file —
 * even in a comment — is kept, so this can leave a specifier behind but never
 * strips one that is in use.
 */
function pruneUnusedImportSpecifiers(content: string): string {
	const lines = content.split('\n');

	// Lines belonging to an import declaration, so the usage scan never counts a
	// name's own import as a reference to it.
	const importLine = new Array<boolean>(lines.length).fill(false);
	const multiline: { start: number; end: number }[] = [];
	const single: number[] = [];

	for (let i = 0; i < lines.length; i++) {
		if (/^import(?:\s+type)?\s*\{\s*$/.test(lines[i])) {
			const end = lines.findIndex((line, j) => j > i && /^\}\s*from\s*'/.test(line));
			if (end > i) {
				multiline.push({ start: i, end });
				for (let j = i; j <= end; j++) {
					importLine[j] = true;
				}
				i = end;
			}
		} else if (/^import(?:\s+type)?\s*\{[^}]*\}\s*from\s*'/.test(lines[i])) {
			single.push(i);
			importLine[i] = true;
		}
	}
	if (multiline.length === 0 && single.length === 0) {
		return content;
	}

	// Comments are stripped so a name mentioned only in prose (upstream documents
	// invariants by naming the helper that enforces them) does not read as a use.
	const bodyText = stripComments(lines.filter((_line, index) => !importLine[index]).join('\n'));
	const specifierName = (raw: string) => raw.trim().replace(/,$/, '').replace(/^type\s+/, '');
	const isUsed = (name: string) =>
		/^[A-Za-z_$][\w$]*$/.test(name) && new RegExp(`\\b${name}\\b`).test(bodyText);

	const drop = new Set<number>();
	for (const block of multiline) {
		for (let i = block.start + 1; i < block.end; i++) {
			const name = specifierName(lines[i]);
			if (/^[A-Za-z_$][\w$]*$/.test(name) && !isUsed(name)) {
				drop.add(i);
			}
		}
	}
	for (const i of single) {
		const decl = lines[i];
		const inner = decl.slice(decl.indexOf('{') + 1, decl.lastIndexOf('}'));
		const kept = inner.split(',').filter(part => {
			const name = specifierName(part);
			return !/^[A-Za-z_$][\w$]*$/.test(name) || isUsed(name);
		});
		if (kept.length === 0) {
			drop.add(i);
		} else if (kept.length !== inner.split(',').filter(p => p.trim()).length) {
			lines[i] = `${decl.slice(0, decl.indexOf('{') + 1)} ${kept.map(p => p.trim()).join(', ')} ${decl.slice(decl.lastIndexOf('}'))}`;
		}
	}

	return lines
		.filter((_line, index) => !drop.has(index))
		.join('\n')
		// A multi-line block emptied of every specifier leaves `import {` / `} from '...'`.
		.replace(/^import(?:\s+type)?\s*\{\n\}\s*from\s*'[^']*'\n?/gm, '');
}

function discoverSourceFiles(): string[] {
	const results: string[] = [];

	function walk(dir: string, relBase: string): void {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (EXCLUDE_DIR_NAMES.has(entry.name)) {
					continue;
				}
				const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
				walk(path.join(dir, entry.name), rel);
			} else if (entry.isFile()) {
				if (!entry.name.endsWith('.ts')) {
					continue;
				}
				if (entry.name.endsWith('.test.ts')) {
					continue;
				}
				const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
				if (EXCLUDE_RELATIVE_FILES.has(rel.replace(/\\/g, '/'))) {
					continue;
				}
				results.push(rel);
			}
		}
	}

	walk(SOURCE_DIR, '');
	results.sort((a, b) => a.localeCompare(b));
	return results;
}

function processFile(relativePath: string): void {
	const normalized = relativePath.replace(/\\/g, '/');
	const srcPath = path.join(SOURCE_DIR, relativePath);
	let content = fs.readFileSync(srcPath, 'utf-8');
	content = convertIndentation(content);
	content = content.split('\n').map(line => line.trimEnd()).join('\n');

	const isViewFile = normalized.startsWith('view/');
	if (!isViewFile) {
		content = rewriteViewImports(content);
	}
	content = pruneUnusedLocalFunctions(content);
	content = pruneUnusedImportSpecifiers(content);

	const destDir = isViewFile
		? path.join(SESSION_VIEW_DIR, path.dirname(normalized.slice('view/'.length)))
		: SESSION_CORE_DIR;
	const destFileName = isViewFile ? path.basename(normalized) : path.basename(normalized);
	const destPath = path.join(destDir, destFileName);

	fs.mkdirSync(destDir, { recursive: true });
	if (!content.endsWith('\n')) {
		content += '\n';
	}
	fs.writeFileSync(destPath, content, 'utf-8');
	console.log(`  ${path.relative(ROOT, destPath)}`);
}

function writeSyncDoc(destDir: string, commitHash: string): void {
	const doc = `# session-core sync

Source: \`UniverseAgentDesktop/packages/session-core/src\`

Commit: \`${commitHash}\`

Regenerate:

\`\`\`bash
npx tsx scripts/sync-universe-agent-session-core.ts
\`\`\`

Do not hand-edit vendored files; change upstream and re-sync.
`;
	fs.writeFileSync(path.join(destDir, 'SYNC.md'), doc, 'utf-8');
	console.log(`  ${path.relative(ROOT, path.join(destDir, 'SYNC.md'))}`);
}

function assertSessionViewHasNoParentImports(): void {
	const violations: string[] = [];
	for (const entry of fs.readdirSync(SESSION_VIEW_DIR, { withFileTypes: true })) {
		if (!entry.isFile() || !entry.name.endsWith('.ts') || entry.name === 'index.ts') {
			continue;
		}
		const content = fs.readFileSync(path.join(SESSION_VIEW_DIR, entry.name), 'utf-8');
		if (/from '\.\.\//.test(content)) {
			violations.push(entry.name);
		}
	}
	if (violations.length > 0) {
		console.error('ERROR: common/sessionView must not import parent paths:');
		for (const file of violations) {
			console.error(`  ${file}`);
		}
		process.exit(1);
	}
}

function main(): void {
	if (!fs.existsSync(SOURCE_DIR)) {
		console.error(`ERROR: Cannot find ${SOURCE_DIR}`);
		console.error('Clone UniverseAgentDesktop as a sibling of the VS Code repo or set UA_DESKTOP_REPO.');
		process.exit(1);
	}

	const commitHash = getSourceCommitHash();
	console.log(`Syncing session-core from UniverseAgentDesktop @ ${commitHash}`);
	console.log(`  Source: ${SOURCE_DIR}`);
	console.log(`  View:   ${SESSION_VIEW_DIR}`);
	console.log(`  Core:   ${SESSION_CORE_DIR}`);
	console.log();

	for (const relativePath of discoverSourceFiles()) {
		processFile(relativePath);
	}

	writeSyncDoc(SESSION_VIEW_DIR, commitHash);
	writeSyncDoc(SESSION_CORE_DIR, commitHash);
	assertSessionViewHasNoParentImports();

	console.log();
	console.log('Done. Update common/sessionView/index.ts by hand if view exports changed.');
}

main();
