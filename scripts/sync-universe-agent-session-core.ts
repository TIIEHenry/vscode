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
//   1. Skips `*.test.ts`, `testing/`, and `view/index.ts` (vscode writes its own barrel).
//   2. Converts 2-space indentation to tabs.
//   3. Rewrites `./view/*.js` imports to `../../common/sessionView/*.js` in non-view files.
//   4. Preserves upstream file headers verbatim.
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
	'view/index.ts',
]);

function getSourceCommitHash(): string {
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
	return content.replace(/from '\.\/view\/([^']+\.js)'/g, "from '../../common/sessionView/$1'");
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
