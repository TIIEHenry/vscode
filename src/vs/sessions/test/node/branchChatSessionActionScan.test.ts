/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ACTION_REL = 'src/vs/sessions/contrib/chat/browser/branchChatSessionAction.ts';

function branchChatSessionActionSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), ACTION_REL),
		path.join(thisDir, '../../contrib/chat/browser/branchChatSessionAction.ts'),
		path.join(thisDir, '../../../../../', ACTION_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `branchChatSessionAction.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('Sessions - BranchChatSessionAction Source Scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('branchChatSessionAction contract: registration and ContextKeyExpr.false() removed', () => {
		const source = fs.readFileSync(branchChatSessionActionSourcePath(), 'utf8');

		assert.ok(source.includes("export const ACTION_ID_BRANCH_CHAT_SESSION = 'workbench.action.chat.branchChatSession';"));
		assert.ok(source.includes('static readonly ID = ACTION_ID_BRANCH_CHAT_SESSION;'));
		assert.ok(source.includes("id: MenuId.ChatMessageCheckpoint"));
		assert.ok(source.includes("ChatContextKeys.lockedToCodingAgent.negate()"));

		// ContextKeyExpr.false() must be removed
		assert.ok(!source.includes('ContextKeyExpr.false()'), 'ContextKeyExpr.false() should be removed to enable the action');
	});

	test('branchChatSessionAction contract: loadSessionFromData, openSession, dispose in finally', () => {
		const source = fs.readFileSync(branchChatSessionActionSourcePath(), 'utf8');

		// The placeholder error must not be present
		assert.ok(!source.includes('Branching chat sessions is not yet supported'), 'Not supported placeholder error must be removed');

		// Model loaded with correct owner and reason
		assert.ok(source.includes("const modelRef = chatService.loadSessionFromData(serializedData, 'BranchChatSessionAction', 'currentSession');"));

		// Session opened in ChatViewPaneTarget with currentSession reason
		assert.ok(source.includes("await widgetService.openSession(newSessionResource, ChatViewPaneTarget, { sessionTypeSelectionReason: 'currentSession' });"));

		// modelRef disposed in finally
		assert.ok(source.includes('try {'));
		assert.ok(source.includes('} finally {'));
		assert.ok(source.includes('modelRef.dispose();'));

		// Slicing history and clearing custom title
		assert.ok(source.includes('delete serializedData.customTitle;'));
		assert.ok(source.includes('serializedData.sessionId = generateUuid();'));
		assert.ok(source.includes('serializedData.requests = serializedData.requests.slice(0, checkpointIndex);'));
		assert.ok(source.includes('delete request.shouldBeRemovedOnSend;'));
	});
});
