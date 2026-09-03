/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	CONVERSATION_SRC_ROOT,
	assertConversationSourceScan,
	collectConversationProductionFiles,
	extractImportPaths,
} from '../common/conversationImportBoundaryScan.js';

const CHAT_CONTENT_PARTS_PREFIX = 'vs/workbench/contrib/chat/browser/widget/chatContentParts/';

const FORBIDDEN_IMPORT_SUBSTRINGS = [
	'chat/widget/chatListWidget',
	'chatWidget',
	'chat/browser/widget/input/',
	'agentSessions/',
] as const;

function isForbiddenChatImport(importPath: string): boolean {
	if (importPath.includes('contrib/chat/')) {
		return !importPath.includes(CHAT_CONTENT_PARTS_PREFIX);
	}
	return FORBIDDEN_IMPORT_SUBSTRINGS.some(forbidden => importPath.includes(forbidden));
}

suite('conversationImportBoundaries', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('production contrib/conversation files respect chat import boundaries', () => {
		const files = collectConversationProductionFiles();
		assertConversationSourceScan(files);

		const violations: string[] = [];
		for (const filePath of files) {
			const relativePath = path.relative(CONVERSATION_SRC_ROOT, filePath).split(path.sep).join('/');
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
