/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as eslint from 'eslint';
import * as path from 'path';
import { createImportRuleListener } from './utils.ts';

const REPO_ROOT = path.normalize(path.join(import.meta.dirname, '../'));

const CHAT_CONTENT_PARTS_PREFIX = 'vs/workbench/contrib/chat/browser/widget/chatContentParts/';

const CONVERSATION_FORBIDDEN_SUBSTRINGS = [
	'chat/widget/chatListWidget',
	'chatWidget',
	'chat/browser/widget/input/',
	'agentSessions/',
	'chatRichLink',
	'vs/sessions',
	'chatThinkingContentPart',
	'chatToolInvocationPart',
	'chatCollapsibleContentPart',
	'thinkrail',
	'deepseek-harness',
	'dsh-client',
	'chatOutputItemRenderer',
] as const;

const KNOWN_LEGACY_CHAT_CONTRIBUTION_EXEMPTIONS = new Set([
	'src/vs/workbench/contrib/conversation/browser/conversationCreateSnapshotActions.contribution.ts',
	'src/vs/workbench/contrib/conversation/browser/conversationForkActions.contribution.ts',
	'src/vs/workbench/contrib/conversation/browser/conversationKillActions.contribution.ts',
]);

const REWRITE_FORBIDDEN_SUBSTRINGS = [
	'universeAgentConnection',
	'universeAgentSessionView',
	'grpc',
	'IUniverseAgent',
] as const;

function getRelativeFilename(context: eslint.Rule.RuleContext): string {
	const filename = path.normalize(context.filename);
	return filename.substring(REPO_ROOT.length).replace(/\\/g, '/').replace(/^\/+/, '');
}

function normalizeToVsImportPath(rawImportPath: string, relativeFilename: string): string {
	if (rawImportPath.startsWith('.')) {
		const joined = path.posix.join(path.posix.dirname(relativeFilename), rawImportPath);
		if (joined.startsWith('src/')) {
			return joined.substring('src/'.length);
		}
		return joined;
	}
	return rawImportPath;
}

export default new class implements eslint.Rule.RuleModule {

	readonly meta: eslint.Rule.RuleMetaData = {
		messages: {
			forbiddenUniverseAgentNode: 'Workbench and sessions production code must not import platform/universeAgent/node ({{importPath}}).',
			forbiddenSessionViewParent: 'Vendored common/sessionView must remain self-contained and not import parent directories ({{importPath}}).',
			forbiddenConversationChatBoundary: 'Forbidden import in contrib/conversation production code ({{importPath}}).',
			forbiddenRewriteEngineImport: 'rewriteConversationStubTurnSessionLinks must stay a local catalog projection with no engine connection or RPC import ({{importPath}}).',
			forbiddenAdapterRewriteImport: 'conversationTurnContentAdapter must not import rewriteConversationStubTurnSessionLinks ({{importPath}}).',
			forbiddenAdapterChatServiceImport: 'conversationTurnContentAdapter must inject IConversationSessionChatService from common/ to avoid the overlay->lens ESM cycle ({{importPath}}).',
		},
		schema: false,
	};

	create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener {
		const relativeFilename = getRelativeFilename(context);
		if (relativeFilename.endsWith('.test.ts') || relativeFilename.includes('/test/')) {
			return {};
		}

		const isWorkbenchOrSessionsNonNode = (
			relativeFilename.startsWith('src/vs/workbench/')
			|| relativeFilename.startsWith('src/vs/sessions/')
		) && !relativeFilename.includes('/node/') && !relativeFilename.includes('/electron-main/');

		const isSessionView = relativeFilename.startsWith('src/vs/platform/universeAgent/common/sessionView/');
		const isConversation = relativeFilename.startsWith('src/vs/workbench/contrib/conversation/');
		const isRewrite = relativeFilename === 'src/vs/workbench/contrib/conversation/browser/rewriteConversationStubTurnSessionLinks.ts';
		const isTurnAdapter = relativeFilename === 'src/vs/workbench/contrib/conversation/browser/conversationTurnContentAdapter.ts';

		if (!isWorkbenchOrSessionsNonNode && !isSessionView && !isConversation) {
			return {};
		}

		return createImportRuleListener((node, rawImportPath) => {
			const normalized = normalizeToVsImportPath(rawImportPath, relativeFilename);

			if (isWorkbenchOrSessionsNonNode) {
				if (rawImportPath.includes('platform/universeAgent/node/') || normalized.includes('platform/universeAgent/node/')) {
					context.report({
						loc: node.loc,
						messageId: 'forbiddenUniverseAgentNode',
						data: { importPath: rawImportPath },
					});
				}
			}

			if (isSessionView) {
				if (rawImportPath.startsWith('../')) {
					context.report({
						loc: node.loc,
						messageId: 'forbiddenSessionViewParent',
						data: { importPath: rawImportPath },
					});
				}
			}

			if (isConversation && !KNOWN_LEGACY_CHAT_CONTRIBUTION_EXEMPTIONS.has(relativeFilename)) {
				const hitsChatOutsideContentParts = normalized.includes('contrib/chat/') && !normalized.includes(CHAT_CONTENT_PARTS_PREFIX);
				const hitsForbiddenSubstring = CONVERSATION_FORBIDDEN_SUBSTRINGS.some(sub => normalized.includes(sub) || rawImportPath.includes(sub));
				if (hitsChatOutsideContentParts || hitsForbiddenSubstring) {
					context.report({
						loc: node.loc,
						messageId: 'forbiddenConversationChatBoundary',
						data: { importPath: rawImportPath },
					});
				}
			}

			if (isRewrite) {
				if (REWRITE_FORBIDDEN_SUBSTRINGS.some(sub => rawImportPath.includes(sub) || normalized.includes(sub))) {
					context.report({
						loc: node.loc,
						messageId: 'forbiddenRewriteEngineImport',
						data: { importPath: rawImportPath },
					});
				}
			}

			if (isTurnAdapter) {
				if (rawImportPath.includes('rewriteConversationStubTurnSessionLinks') || normalized.includes('rewriteConversationStubTurnSessionLinks')) {
					context.report({
						loc: node.loc,
						messageId: 'forbiddenAdapterRewriteImport',
						data: { importPath: rawImportPath },
					});
				}
				if (rawImportPath.includes('conversationSessionChatService') || normalized.includes('conversationSessionChatService')) {
					context.report({
						loc: node.loc,
						messageId: 'forbiddenAdapterChatServiceImport',
						data: { importPath: rawImportPath },
					});
				}
			}
		});
	}
};
