/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as eslint from 'eslint';
import * as path from 'path';
import { evaluateAgentImportBoundary } from '../src/vs/platform/universeAgent/test/common/agentImportBoundaryRules.ts';
import { createImportRuleListener } from './utils.ts';

const REPO_ROOT = path.normalize(path.join(import.meta.dirname, '../'));

function getRelativeFilename(context: eslint.Rule.RuleContext): string {
	const filename = path.normalize(context.filename);
	return filename.substring(REPO_ROOT.length).replace(/\\/g, '/').replace(/^\/+/, '');
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

		return createImportRuleListener((node, rawImportPath) => {
			for (const messageId of evaluateAgentImportBoundary(relativeFilename, rawImportPath)) {
				context.report({
					loc: node.loc,
					messageId,
					data: { importPath: rawImportPath },
				});
			}
		});
	}
};
