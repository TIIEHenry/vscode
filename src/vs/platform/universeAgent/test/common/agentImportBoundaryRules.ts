/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const CHAT_CONTENT_PARTS_PREFIX = 'vs/workbench/contrib/chat/browser/widget/chatContentParts/';

const CONVERSATION_ALWAYS_FORBIDDEN_SUBSTRINGS = [
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

export type AgentImportBoundaryViolationId =
	| 'forbiddenUniverseAgentNode'
	| 'forbiddenSessionViewParent'
	| 'forbiddenConversationChatBoundary'
	| 'forbiddenRewriteEngineImport'
	| 'forbiddenAdapterRewriteImport'
	| 'forbiddenAdapterChatServiceImport';

function posixJoinAndNormalize(dir: string, rel: string): string {
	const combined = `${dir}/${rel}`.split('/');
	const stack: string[] = [];
	for (const part of combined) {
		if (!part || part === '.') {
			continue;
		}
		if (part === '..') {
			if (stack.length > 0 && stack[stack.length - 1] !== '..') {
				stack.pop();
			} else {
				stack.push('..');
			}
		} else {
			stack.push(part);
		}
	}
	return stack.join('/');
}

export function normalizeToVsImportPath(rawImportPath: string, relativeFilename: string): string {
	const cleanFile = relativeFilename.replace(/\\/g, '/').replace(/^\/+/, '');
	if (rawImportPath.startsWith('.')) {
		const lastSlash = cleanFile.lastIndexOf('/');
		const dir = lastSlash >= 0 ? cleanFile.slice(0, lastSlash) : '';
		const joined = posixJoinAndNormalize(dir, rawImportPath);
		if (joined.startsWith('src/')) {
			return joined.slice('src/'.length);
		}
		return joined;
	}
	return rawImportPath;
}

export function evaluateAgentImportBoundary(
	relativeFilename: string,
	rawImportPath: string,
): AgentImportBoundaryViolationId[] {
	const cleanFile = relativeFilename.replace(/\\/g, '/').replace(/^\/+/, '');
	if (cleanFile.endsWith('.test.ts') || cleanFile.includes('/test/')) {
		return [];
	}

	const violations: AgentImportBoundaryViolationId[] = [];
	const normalized = normalizeToVsImportPath(rawImportPath, cleanFile);

	const isWorkbenchOrSessionsNonNode = (
		cleanFile.startsWith('src/vs/workbench/')
		|| cleanFile.startsWith('src/vs/sessions/')
	) && !cleanFile.includes('/node/') && !cleanFile.includes('/electron-main/');

	if (isWorkbenchOrSessionsNonNode) {
		if (rawImportPath.includes('platform/universeAgent/node/') || normalized.includes('platform/universeAgent/node/')) {
			violations.push('forbiddenUniverseAgentNode');
		}
	}

	if (cleanFile.startsWith('src/vs/platform/universeAgent/common/sessionView/')) {
		if (rawImportPath.startsWith('../')) {
			violations.push('forbiddenSessionViewParent');
		}
	}

	if (cleanFile.startsWith('src/vs/workbench/contrib/conversation/')) {
		const hitsAlwaysForbiddenSubstring = CONVERSATION_ALWAYS_FORBIDDEN_SUBSTRINGS.some(
			sub => rawImportPath.includes(sub) || normalized.includes(sub),
		);
		const hitsRawChatOutsideContentParts = rawImportPath.includes('contrib/chat/') && !rawImportPath.includes(CHAT_CONTENT_PARTS_PREFIX);
		const hitsNormalizedChatOutsideContentParts = !KNOWN_LEGACY_CHAT_CONTRIBUTION_EXEMPTIONS.has(cleanFile)
			&& normalized.includes('contrib/chat/')
			&& !normalized.includes(CHAT_CONTENT_PARTS_PREFIX);

		if (hitsAlwaysForbiddenSubstring || hitsRawChatOutsideContentParts || hitsNormalizedChatOutsideContentParts) {
			violations.push('forbiddenConversationChatBoundary');
		}
	}

	if (cleanFile === 'src/vs/workbench/contrib/conversation/browser/rewriteConversationStubTurnSessionLinks.ts') {
		if (REWRITE_FORBIDDEN_SUBSTRINGS.some(sub => rawImportPath.includes(sub) || normalized.includes(sub))) {
			violations.push('forbiddenRewriteEngineImport');
		}
	}

	if (cleanFile === 'src/vs/workbench/contrib/conversation/browser/conversationTurnContentAdapter.ts') {
		if (rawImportPath.includes('rewriteConversationStubTurnSessionLinks') || normalized.includes('rewriteConversationStubTurnSessionLinks')) {
			violations.push('forbiddenAdapterRewriteImport');
		}
		if (rawImportPath.includes('conversationSessionChatService') || normalized.includes('conversationSessionChatService')) {
			violations.push('forbiddenAdapterChatServiceImport');
		}
	}

	return violations;
}
