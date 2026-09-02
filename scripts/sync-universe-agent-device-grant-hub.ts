/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Vendors ADR-261 crypto + Hub control-plane HTTP helpers from Desktop engine/.
//
//   npx tsx scripts/sync-universe-agent-device-grant-hub.ts
//
// Source: UniverseAgentDesktop/apps/desktop/src/main/engine/

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_REPO = process.env['UA_DESKTOP_REPO'] ?? path.resolve(ROOT, '../UniverseAgentDesktop');
const ENGINE_DIR = path.join(DESKTOP_REPO, 'apps/desktop/src/main/engine');
const DEVICE_GRANT_DIR = path.join(ROOT, 'src/vs/platform/universeAgent/node/deviceGrant');
const HUB_DIR = path.join(ROOT, 'src/vs/platform/universeAgent/node/hub');

const DEVICE_GRANT_FILES = [
	'device-grant-crypto.ts',
	'tls-pin.ts',
	'observe-candidate-leaf.ts',
] as const;

const HUB_FILES = [
	'hub-auth-client.ts',
	'hub-relay-ticket-client.ts',
	'host-normalize.ts',
] as const;

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

function rewriteHubTypesImport(content: string): string {
	return content.replace("from './types.js'", "from './hubTypes.js'");
}

function processFile(relativePath: string, destDir: string): void {
	const srcPath = path.join(ENGINE_DIR, relativePath);
	let content = fs.readFileSync(srcPath, 'utf-8');
	content = convertIndentation(content);
	content = content.split('\n').map(line => line.trimEnd()).join('\n');
	if (relativePath === 'host-normalize.ts') {
		content = rewriteHubTypesImport(content);
	}
	const destPath = path.join(destDir, relativePath);
	fs.mkdirSync(destDir, { recursive: true });
	if (!content.endsWith('\n')) {
		content += '\n';
	}
	fs.writeFileSync(destPath, content, 'utf-8');
	console.log(`  ${path.relative(ROOT, destPath)}`);
}

function writeHubTypes(): void {
	const content = `/**
 * Minimal branded host/url types for vendored host-normalize (Desktop engine/types.ts excerpt).
 */
export type NormalizedHost = string & { readonly __brand: 'NormalizedHost' }
export type NormalizedUrl = string & { readonly __brand: 'NormalizedUrl' }
`;
	const destPath = path.join(HUB_DIR, 'hubTypes.ts');
	fs.writeFileSync(destPath, convertIndentation(content), 'utf-8');
	console.log(`  ${path.relative(ROOT, destPath)}`);
}

function writeSyncDoc(destDir: string, label: string, commitHash: string, scriptName: string): void {
	const doc = `# ${label} sync

Source: \`UniverseAgentDesktop/apps/desktop/src/main/engine/\`

Commit: \`${commitHash}\`

Regenerate:

\`\`\`bash
npx tsx scripts/${scriptName}
\`\`\`

Do not hand-edit vendored files; change upstream and re-sync.
`;
	fs.writeFileSync(path.join(destDir, 'SYNC.md'), doc, 'utf-8');
	console.log(`  ${path.relative(ROOT, path.join(destDir, 'SYNC.md'))}`);
}

function main(): void {
	if (!fs.existsSync(ENGINE_DIR)) {
		console.error(`ERROR: Cannot find ${ENGINE_DIR}`);
		console.error('Clone UniverseAgentDesktop as a sibling of the VS Code repo or set UA_DESKTOP_REPO.');
		process.exit(1);
	}

	const commitHash = getSourceCommitHash();
	console.log(`Syncing deviceGrant + hub from UniverseAgentDesktop @ ${commitHash}`);
	console.log();

	for (const file of DEVICE_GRANT_FILES) {
		processFile(file, DEVICE_GRANT_DIR);
	}
	writeSyncDoc(DEVICE_GRANT_DIR, 'deviceGrant', commitHash, 'sync-universe-agent-device-grant-hub.ts');

	for (const file of HUB_FILES) {
		processFile(file, HUB_DIR);
	}
	writeHubTypes();
	writeSyncDoc(HUB_DIR, 'hub', commitHash, 'sync-universe-agent-device-grant-hub.ts');

	console.log();
	console.log('Done.');
}

main();
