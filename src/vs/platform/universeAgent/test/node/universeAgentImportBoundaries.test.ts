/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	createAgentImportBoundaryRule,
	evaluateAgentImportBoundary,
	normalizeToVsImportPath,
	type AgentImportBoundaryViolationId,
} from '../common/agentImportBoundaryRules.js';

suite('universeAgentImportBoundaries (eslint rule contract)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('workbench and sessions production code reject platform/universeAgent/node while node/electron-main allow it', () => {
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(
				'src/vs/workbench/contrib/conversation/browser/conversationLens.ts',
				'../../../../platform/universeAgent/node/grpc/grpcClient.js',
			),
			['forbiddenUniverseAgentNode'],
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(
				'src/vs/sessions/browser/sessionsView.ts',
				'../../platform/universeAgent/node/sessionViewHost.js',
			),
			['forbiddenUniverseAgentNode'],
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(
				'src/vs/workbench/contrib/conversation/browser/conversationLens.ts',
				'../../../../platform/universeAgent/common/universeAgentConnection.js',
			),
			[],
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(
				'src/vs/workbench/services/agent/electron-main/agentMainService.ts',
				'../../../../platform/universeAgent/node/sessionViewHost.js',
			),
			[],
		);
	});

	test('vendored common/sessionView rejects parent-directory imports and allows sibling imports', () => {
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(
				'src/vs/platform/universeAgent/common/sessionView/index.ts',
				'../universeAgentTypes.js',
			),
			['forbiddenSessionViewParent'],
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(
				'src/vs/platform/universeAgent/common/sessionView/index.ts',
				'./types.js',
			),
			[],
		);
	});

	test('relative ../../chat/... normalizes to contrib/chat/, allows chatContentParts, and keeps process/trajectory/visualize bans on legacy actions', () => {
		const regularFile = 'src/vs/workbench/contrib/conversation/browser/fakeFile.ts';
		const legacyActionFile = 'src/vs/workbench/contrib/conversation/browser/conversationCreateSnapshotActions.contribution.ts';

		assert.strictEqual(
			normalizeToVsImportPath('../../chat/browser/chatShellRouting.js', regularFile),
			'vs/workbench/contrib/chat/browser/chatShellRouting.js',
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(regularFile, '../../chat/browser/chatShellRouting.js'),
			['forbiddenConversationChatBoundary'],
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(regularFile, '../../chat/browser/widget/chatContentParts/chatContentCodePools.js'),
			[],
		);

		assert.deepStrictEqual(
			evaluateAgentImportBoundary(legacyActionFile, '../../chat/browser/chatShellRouting.js'),
			[],
		);
		for (const forbidden of [
			'../../chat/browser/widget/chatContentParts/chatThinkingContentPart.js',
			'../../chat/browser/widget/chatContentParts/chatToolInvocationPart.js',
			'../../chat/browser/widget/chatContentParts/chatCollapsibleContentPart.js',
			'../../thinkrail/browser/thinkrailWidget.js',
			'deepseek-harness/runtime',
			'dsh-client',
			'../../chat/browser/widget/chatContentParts/chatOutputItemRenderer.js',
			'../../chat/browser/chatWidget.js',
			'../../../../sessions/browser/sessions.js',
		]) {
			assert.deepStrictEqual(
				evaluateAgentImportBoundary(legacyActionFile, forbidden),
				['forbiddenConversationChatBoundary'],
				`legacy action must still reject ${forbidden}`,
			);
		}
	});

	test('rewriteConversationStubTurnSessionLinks and conversationTurnContentAdapter enforce file-specific import bans', () => {
		const rewriteFile = 'src/vs/workbench/contrib/conversation/browser/rewriteConversationStubTurnSessionLinks.ts';
		const adapterFile = 'src/vs/workbench/contrib/conversation/browser/conversationTurnContentAdapter.ts';

		assert.deepStrictEqual(
			evaluateAgentImportBoundary(rewriteFile, '../../../../platform/universeAgent/common/universeAgentConnection.js'),
			['forbiddenRewriteEngineImport'],
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(adapterFile, './rewriteConversationStubTurnSessionLinks.js'),
			['forbiddenAdapterRewriteImport'],
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(adapterFile, './conversationSessionChatService.js'),
			['forbiddenAdapterChatServiceImport'],
		);
		assert.deepStrictEqual(
			evaluateAgentImportBoundary(adapterFile, '../common/conversationSessionChat.js'),
			[],
		);
	});

	test('ESLint rule listener reports AST ImportDeclaration/ExportNamedDeclaration violations and ignores test files', () => {
		const rule = createAgentImportBoundaryRule('/workspace/vscode');
		const reports: Array<{ messageId: AgentImportBoundaryViolationId; importPath: string }> = [];
		const listener = rule.create({
			filename: '/workspace/vscode/src/vs/workbench/contrib/conversation/browser/rewriteConversationStubTurnSessionLinks.ts',
			report(descriptor) {
				reports.push({ messageId: descriptor.messageId, importPath: descriptor.data.importPath });
			},
		});

		listener.ImportDeclaration({
			source: { type: 'Literal', value: '../../chat/browser/ widget/chatContentParts/chatContentCodePools.js'.replace(' ', '') },
		});
		assert.deepStrictEqual(reports, []);

		listener.ImportDeclaration({
			source: { type: 'Literal', value: '../../chat/browser/chatShellRouting.js' },
		});
		listener.ExportNamedDeclaration({
			source: { type: 'Literal', value: '../../../../platform/universeAgent/common/universeAgentConnection.js' },
		});
		assert.deepStrictEqual(reports, [
			{ messageId: 'forbiddenConversationChatBoundary', importPath: '../../chat/browser/chatShellRouting.js' },
			{ messageId: 'forbiddenRewriteEngineImport', importPath: '../../../../platform/universeAgent/common/universeAgentConnection.js' },
		]);

		const testListener = rule.create({
			filename: '/workspace/vscode/src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts',
			report() {
				assert.fail('test files must be ignored by the rule listener');
			},
		});
		assert.deepStrictEqual(Object.keys(testListener), []);
	});
});
