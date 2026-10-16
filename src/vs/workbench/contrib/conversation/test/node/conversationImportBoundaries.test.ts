/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	CONVERSATION_SRC_ROOT,
	assertConversationSourceScan,
	collectConversationProductionFiles,
	extractImportPaths,
} from '../node/conversationImportBoundaryScan.js';

const CHAT_CONTENT_PARTS_PREFIX = 'vs/workbench/contrib/chat/browser/widget/chatContentParts/';

const FORBIDDEN_IMPORT_SUBSTRINGS = [
	'chat/widget/chatListWidget',
	'chatWidget',
	'chat/browser/widget/input/',
	'agentSessions/',
	'chatRichLink',
	'vs/sessions',
] as const;

/**
 * Documented gap (architecture-2026-10-16-concrete.md §5 / B7):
 * Legacy contribution action files that still directly import chat actions/services
 * for fallback execution pending architectural migration out of contrib/conversation.
 */
const KNOWN_LEGACY_CHAT_CONTRIBUTION_EXEMPTIONS = new Set([
	'browser/conversationCreateSnapshotActions.contribution.ts',
	'browser/conversationForkActions.contribution.ts',
	'browser/conversationKillActions.contribution.ts',
]);

function normalizeChatImportPath(importPath: string, importerFilePath?: string): string {
	if (importPath.startsWith('.') && importerFilePath) {
		const resolved = path.resolve(path.dirname(importerFilePath), importPath);
		const srcRoot = path.resolve(CONVERSATION_SRC_ROOT, '../../../..');
		return path.relative(srcRoot, resolved).split(path.sep).join('/');
	}
	return importPath;
}

function isForbiddenChatImport(importPath: string, importerFilePath?: string): boolean {
	const normalized = normalizeChatImportPath(importPath, importerFilePath);
	if (normalized.includes('contrib/chat/')) {
		return !normalized.includes(CHAT_CONTENT_PARTS_PREFIX);
	}
	return FORBIDDEN_IMPORT_SUBSTRINGS.some(forbidden => normalized.includes(forbidden));
}

suite('conversationImportBoundaries', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('production contrib/conversation files respect chat import boundaries', () => {
		const files = collectConversationProductionFiles();
		assertConversationSourceScan(files);

		const violations: string[] = [];
		for (const filePath of files) {
			const relativePath = path.relative(CONVERSATION_SRC_ROOT, filePath).split(path.sep).join('/');
			if (KNOWN_LEGACY_CHAT_CONTRIBUTION_EXEMPTIONS.has(relativePath)) {
				continue;
			}
			const source = fs.readFileSync(filePath, 'utf8');
			for (const importPath of extractImportPaths(source)) {
				if (isForbiddenChatImport(importPath, filePath)) {
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

	test('relative ../../chat/... import paths normalize to contrib/chat/ and are detected', () => {
		const fakeFilePath = path.join(CONVERSATION_SRC_ROOT, 'browser/fakeFile.ts');
		assert.strictEqual(
			isForbiddenChatImport('../../chat/browser/chatShellRouting.js', fakeFilePath),
			true,
		);
		assert.strictEqual(
			isForbiddenChatImport('../../chat/browser/widget/chatContentParts/chatContentCodePools.js', fakeFilePath),
			false,
		);
	});

	test('rewriteConversationStubTurnSessionLinks does not import engine connection or RPC', () => {
		const rewritePath = path.join(CONVERSATION_SRC_ROOT, 'browser/rewriteConversationStubTurnSessionLinks.ts');
		const source = fs.readFileSync(rewritePath, 'utf8');
		const imports = extractImportPaths(source);
		assert.deepStrictEqual(
			imports.filter(importPath =>
				importPath.includes('universeAgentConnection')
				|| importPath.includes('universeAgentSessionView')
				|| importPath.includes('grpc')
				|| importPath.includes('IUniverseAgent')),
			[],
			'D472 rewrite must stay a local catalog projection with no new RPC',
		);
	});

	test('conversationTurnContentAdapter does not rewrite stub session links', () => {
		const adapterPath = path.join(CONVERSATION_SRC_ROOT, 'browser/conversationTurnContentAdapter.ts');
		const source = fs.readFileSync(adapterPath, 'utf8');
		const imports = extractImportPaths(source);
		assert.deepStrictEqual(
			imports.filter(importPath => importPath.includes('rewriteConversationStubTurnSessionLinks')),
			[],
			'D472 adapter must not rewrite href/text; projection writes conversation-chat',
		);
	});

	test('conversationTurnContentAdapter does not import conversationSessionChatService', () => {
		const adapterPath = path.join(CONVERSATION_SRC_ROOT, 'browser/conversationTurnContentAdapter.ts');
		const source = fs.readFileSync(adapterPath, 'utf8');
		const imports = extractImportPaths(source);
		assert.deepStrictEqual(
			imports.filter(importPath => importPath.includes('conversationSessionChatService')),
			[],
			'adapter must inject IConversationSessionChatService from common/ to avoid the overlay→lens ESM cycle',
		);
	});
});
