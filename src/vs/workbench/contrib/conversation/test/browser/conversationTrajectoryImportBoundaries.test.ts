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

const FORBIDDEN_IMPORT_SUBSTRINGS = [
	'deepseek-harness',
	'dsh-client',
] as const;

function isForbiddenTrajectoryImport(importPath: string): boolean {
	return FORBIDDEN_IMPORT_SUBSTRINGS.some(forbidden => importPath.includes(forbidden));
}

suite('conversationTrajectoryImportBoundaries', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('production contrib/conversation files do not import harness runtime paths', () => {
		const files = collectConversationProductionFiles();
		assertConversationSourceScan(files);

		const violations: string[] = [];
		for (const filePath of files) {
			const relativePath = path.relative(CONVERSATION_SRC_ROOT, filePath).split(path.sep).join('/');
			const source = fs.readFileSync(filePath, 'utf8');
			for (const importPath of extractImportPaths(source)) {
				if (isForbiddenTrajectoryImport(importPath)) {
					violations.push(`${relativePath}: ${importPath}`);
				}
			}
		}

		assert.deepStrictEqual(
			violations,
			[],
			`Forbidden harness imports in contrib/conversation production code:\n${violations.join('\n')}`,
		);
	});
});
