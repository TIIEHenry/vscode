/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { IConversationSessionChatService } from '../../../conversation/browser/conversationSessionChatService.js';
import { IConversationSessionWindowService } from '../../../conversation/browser/conversationSessionWindowService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { navigatorRevealSessionNotOpenCopy, revealNavigatorAgentInConversation } from '../../browser/navigatorReveal.js';

suite('navigatorReveal bound session', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mount(visible: readonly string[]) {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const focusCalls: string[] = [];
		const breadcrumbCalls: Array<{ sessionKey: string; chatId: string }> = [];
		const openCalls: Array<{ sessionKey: string; chatId: string; title?: string }> = [];
		const closeCalls: string[] = [];
		const infoCalls: string[] = [];
		let dialogOpen = true;
		instantiationService.stub(IConversationPartService, {
			focus: () => { focusCalls.push('focus'); },
		} as IConversationPartService);
		instantiationService.stub(IConversationSessionWindowService, {
			getVisibleSessionKeys: () => visible.slice(),
			isSessionWindowVisible: (sessionKey: string) => visible.includes(sessionKey),
		} as unknown as IConversationSessionWindowService);
		instantiationService.stub(IConversationRosterService, {
			getActiveSessionId: () => {
				throw new Error('reveal must not read the roster active session');
			},
			switchSession: () => {
				throw new Error('reveal must not switch session');
			},
		} as unknown as IConversationRosterService);
		instantiationService.stub(IConversationSessionChatService, {
			findOpenTabForChat: (_sessionKey: string, chatId: string) => chatId === 'sub:existing' ? {} : undefined,
			isSubAgentDialogOpen: () => dialogOpen,
			closeSubAgentDialog: (sessionKey: string) => { closeCalls.push(sessionKey); },
			navigateAgentBreadcrumb: async (sessionKey: string, chatId: string) => {
				breadcrumbCalls.push({ sessionKey, chatId });
			},
			openSubAgent: async (sessionKey: string, chatId: string, title?: string) => {
				openCalls.push({ sessionKey, chatId, title });
			},
		} as unknown as IConversationSessionChatService);
		instantiationService.stub(INotificationService, {
			info: (message: string | Error) => {
				infoCalls.push(typeof message === 'string' ? message : message.message);
			},
			error: () => {
				throw new Error('reveal success path must not notify error');
			},
		} as unknown as INotificationService);
		return { instantiationService, focusCalls, breadcrumbCalls, openCalls, closeCalls, infoCalls, setDialogOpen(open: boolean) { dialogOpen = open; } };
	}

	test('root on a visible leaf uses the breadcrumb and does not open a sub-agent', async () => {
		const harness = mount(['leaf-a']);
		await harness.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, 'root', 'Root', 'leaf-a'));
		assert.deepStrictEqual(harness.breadcrumbCalls, [{ sessionKey: 'leaf-a', chatId: 'default' }]);
		assert.deepStrictEqual(harness.closeCalls, ['leaf-a']);
		assert.deepStrictEqual(harness.openCalls, []);
		assert.deepStrictEqual(harness.infoCalls, []);
		assert.deepStrictEqual(harness.focusCalls, ['focus']);
	});

	test('existing tab on a visible leaf uses the breadcrumb', async () => {
		const harness = mount(['leaf-a']);
		harness.setDialogOpen(false);
		await harness.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, 'sub:existing', 'Existing', 'leaf-a'));
		assert.deepStrictEqual(harness.breadcrumbCalls, [{ sessionKey: 'leaf-a', chatId: 'sub:existing' }]);
		assert.deepStrictEqual(harness.openCalls, []);
		assert.deepStrictEqual(harness.closeCalls, []);
		assert.deepStrictEqual(harness.focusCalls, ['focus']);
	});

	test('stamp that is not the roster active session still opens that visible leaf', async () => {
		const harness = mount(['leaf-a']);
		harness.setDialogOpen(false);
		await harness.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, 'sub:alpha', 'Alpha', 'leaf-a'));
		assert.deepStrictEqual(harness.openCalls, [{ sessionKey: 'leaf-a', chatId: 'sub:alpha', title: 'Alpha' }]);
		assert.deepStrictEqual(harness.breadcrumbCalls, []);
		assert.deepStrictEqual(harness.infoCalls, []);
		assert.deepStrictEqual(harness.focusCalls, ['focus']);
	});

	test('missing visible leaf notices and does not pull the conversation seat', async () => {
		const harness = mount(['leaf-a']);
		await harness.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, 'sub:alpha', 'Alpha', 'other-session'));
		await harness.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, 'sub:alpha', 'Alpha', '   '));
		await harness.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, 'sub:alpha', 'Alpha'));
		assert.deepStrictEqual(harness.infoCalls, [
			navigatorRevealSessionNotOpenCopy,
			navigatorRevealSessionNotOpenCopy,
			navigatorRevealSessionNotOpenCopy,
		]);
		assert.deepStrictEqual(harness.openCalls, []);
		assert.deepStrictEqual(harness.breadcrumbCalls, []);
		assert.deepStrictEqual(harness.focusCalls, []);
	});
});
