/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(thisDir, '../../../../../../');
const WORKBENCH_ROOT = path.join(REPO_ROOT, 'src/vs/workbench');
const SESSIONS_ROOT = path.join(REPO_ROOT, 'src/vs/sessions');

const FORBIDDEN_IMPORT_SUBSTRINGS = [
	'platform/universeAgent/node/',
] as const;

const EXCLUDED_DIR_NAMES = new Set([
	'test',
	'node',
	'electron-main',
]);

function isProductionSourceFile(filePath: string): boolean {
	const normalized = filePath.split(path.sep).join('/');
	return normalized.endsWith('.ts')
		&& !normalized.endsWith('.test.ts')
		&& !normalized.includes('/test/');
}

function collectProductionFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) {
		return [];
	}

	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (EXCLUDED_DIR_NAMES.has(entry.name)) {
				continue;
			}
			results.push(...collectProductionFiles(fullPath));
		} else if (isProductionSourceFile(fullPath)) {
			results.push(fullPath);
		}
	}
	return results;
}

function extractImportPaths(source: string): string[] {
	const imports: string[] = [];
	const importRegex = /from\s+['"]([^'"]+)['"]/g;
	let match: RegExpExecArray | null;
	while ((match = importRegex.exec(source)) !== null) {
		imports.push(match[1]);
	}
	return imports;
}

function isForbiddenUniverseAgentNodeImport(importPath: string): boolean {
	return FORBIDDEN_IMPORT_SUBSTRINGS.some(forbidden => importPath.includes(forbidden));
}

suite('universeAgentImportBoundaries', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('workbench and sessions production code must not import platform/universeAgent/node', () => {
		const scanRoots = [
			{ label: 'workbench', root: WORKBENCH_ROOT },
			{ label: 'sessions', root: SESSIONS_ROOT },
		];

		const violations: string[] = [];
		for (const { label, root } of scanRoots) {
			for (const filePath of collectProductionFiles(root)) {
				const relativePath = `${label}/${path.relative(root, filePath).split(path.sep).join('/')}`;
				const source = fs.readFileSync(filePath, 'utf8');
				for (const importPath of extractImportPaths(source)) {
					if (isForbiddenUniverseAgentNodeImport(importPath)) {
						violations.push(`${relativePath}: ${importPath}`);
					}
				}
			}
		}

		assert.deepStrictEqual(
			violations,
			[],
			`Forbidden imports in workbench/sessions production code:\n${violations.join('\n')}`,
		);
	});
});
