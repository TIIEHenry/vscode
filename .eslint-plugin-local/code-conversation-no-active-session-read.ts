/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as eslint from 'eslint';
import type * as ESTree from 'estree';

/**
 * Conversation leaves read and write with their own session id. The roster's
 * global active session is for entries without a leaf (roster, session list,
 * status bar, startup restore, command palette). Files that may still read it
 * are listed as ignores in eslint.config.js.
 */
export default new class ConversationNoActiveSessionRead implements eslint.Rule.RuleModule {

	readonly meta: eslint.Rule.RuleMetaData = {
		messages: {
			noActiveSessionRead: 'Use the leaf\'s bound session id (getBoundSessionId / listSessionId / sessionKey) instead of the roster\'s getActiveSessionId().',
		},
		schema: false,
	};

	create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener {
		return {
			CallExpression(node: ESTree.CallExpression) {
				const callee = node.callee;
				if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier' && callee.property.name === 'getActiveSessionId') {
					context.report({ node, messageId: 'noActiveSessionRead' });
				}
			},
		};
	}
};
