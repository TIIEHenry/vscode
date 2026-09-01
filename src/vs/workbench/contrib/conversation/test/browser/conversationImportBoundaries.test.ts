/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const CONVERSATION_ROOT = path.join(__dirname, '../../');
const CHAT_CONTENT_PARTS_PREFIX = 'vs/workbench/contrib/chat/browser/widget/chatContentParts/';

const FORBIDDEN_IMPORT_SUBSTRINGS = [
	'chat/widget/chatListWidget',
	'chatWidget',
	'chat/browser/widget/input/',
	'agentSessions/',
] as const;

function isProductionSourceFile(filePath: string): boolean {
	const normalized = filePath.split(path.sep).join('/');
	return normalized.endsWith('.ts')
		&& !normalized.endsWith('.test.ts')
		&& !normalized.includes('/test/');
}

function collectProductionFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'test') {
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

function isForbiddenChatImport(importPath: string): boolean {
	if (importPath.includes('contrib/chat/')) {
		return !importPath.includes(CHAT_CONTENT_PARTS_PREFIX);
	}
	return FORBIDDEN_IMPORT_SUBSTRINGS.some(forbidden => importPath.includes(forbidden));
}

suite('conversationImportBoundaries', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('production contrib/conversation files respect chat import boundaries', () => {
		const violations: string[] = [];
		for (const filePath of collectProductionFiles(CONVERSATION_ROOT)) {
			const relativePath = path.relative(CONVERSATION_ROOT, filePath).split(path.sep).join('/');
			const source = fs.readFileSync(filePath, 'utf8');
			for (const importPath of extractImportPaths(source)) {
				if (isForbiddenChatImport(importPath)) {
					violations.push(`${relativePath}: ${importPath}`);
				}
			}
		}

		assert.deepStrictEqual(
			violations,
			[],
			`Forbidden imports in contrib/conversation production code:\n${violations.join('\n')}`,
		);
	});
});
