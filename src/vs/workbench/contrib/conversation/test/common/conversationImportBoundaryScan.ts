/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * D16: compiled tests live under `out/`. `__dirname` + `../../` therefore scanned
 * `out/vs/workbench/contrib/conversation` for `*.ts` and silently passed on an
 * empty set. Walk repo `src/` from `import.meta.url` instead (same pattern as
 * `universeAgentImportBoundaries.test.ts`).
 */
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(thisDir, '../../../../../../..');

export const CONVERSATION_SRC_ROOT = path.join(REPO_ROOT, 'src/vs/workbench/contrib/conversation');

/** Floor so an empty / wrong-tree scan fails before the violation list is checked. */
export const MIN_CONVERSATION_PRODUCTION_FILES = 80;

export function isConversationProductionSourceFile(filePath: string): boolean {
	const normalized = filePath.split(path.sep).join('/');
	return normalized.endsWith('.ts')
		&& !normalized.endsWith('.test.ts')
		&& !normalized.includes('/test/');
}

export function collectConversationProductionFiles(dir: string = CONVERSATION_SRC_ROOT): string[] {
	if (!fs.existsSync(dir)) {
		return [];
	}

	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'test') {
				continue;
			}
			results.push(...collectConversationProductionFiles(fullPath));
		} else if (isConversationProductionSourceFile(fullPath)) {
			results.push(fullPath);
		}
	}
	return results;
}

export function extractImportPaths(source: string): string[] {
	const imports: string[] = [];
	const importRegex = /from\s+['"]([^'"]+)['"]/g;
	let match: RegExpExecArray | null;
	while ((match = importRegex.exec(source)) !== null) {
		imports.push(match[1]);
	}
	return imports;
}

export function assertConversationSourceScan(files: readonly string[]): void {
	assert.ok(
		fs.existsSync(CONVERSATION_SRC_ROOT),
		`conversation src root missing: ${CONVERSATION_SRC_ROOT}`,
	);
	assert.ok(
		files.length >= MIN_CONVERSATION_PRODUCTION_FILES,
		`expected >= ${MIN_CONVERSATION_PRODUCTION_FILES} production .ts under ${CONVERSATION_SRC_ROOT}, found ${files.length} (empty scan is a false green)`,
	);
}
