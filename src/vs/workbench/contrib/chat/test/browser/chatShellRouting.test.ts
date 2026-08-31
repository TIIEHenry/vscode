/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { BugIndicatingError } from '../../../../../base/common/errors.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { OS } from '../../../../../base/common/platform.js';
import { KeybindingsRegistry } from '../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { BrowserWorkbenchEnvironmentService } from '../../../../services/environment/browser/environmentService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { workbenchInstantiationService, TestProductService } from '../../../../test/browser/workbenchTestServices.js';
import { ASK_QUICK_QUESTION_ACTION_ID } from '../../browser/actions/chatQuickInputActions.js';
import { shouldRegisterChatEditorResolver } from '../../browser/chat.shared.contribution.js';
import { focusConversationPart, isDefaultCodeWindow, shouldRouteChatEditorToConversation } from '../../browser/chatShellRouting.js';
import { ChatSessionPosition, openChatSession } from '../../browser/chatSessions/chatSessions.contribution.js';
import { IAgentHostImportConversationStore } from '../../browser/agentSessions/agentHost/agentHostImportConversationStore.js';
import { ChatContextKeys } from '../../common/actions/chatContextKeys.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationPart } from '../../../browser/parts/conversation/conversationPart.js';
import type { Turn } from '../../../../../platform/agentHost/common/state/sessionState.js';
import { URI } from '../../../../../base/common/uri.js';

import '../../browser/chat.shared.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

class DefaultCodeWindowEnvironmentService extends BrowserWorkbenchEnvironmentService {
	override get isSessionsWindow(): boolean {
		return false;
	}
}

class AgentsWindowEnvironmentService extends BrowserWorkbenchEnvironmentService {
	override get isSessionsWindow(): boolean {
		return true;
	}
}

const testEnvOptions = Object.create(null);
const testLogsHome = URI.file('tests').with({ scheme: 'vscode-tests' });

const defaultWindow: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.enabled.key]: true,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

suite('chatShellRouting (M5 slice 1)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('isDefaultCodeWindow and shouldRouteChatEditorToConversation branch on window type', () => {
		const defaultEnv = new DefaultCodeWindowEnvironmentService('', testLogsHome, testEnvOptions, TestProductService);
		const agentsEnv = new AgentsWindowEnvironmentService('', testLogsHome, testEnvOptions, TestProductService);

		const defaultService = workbenchInstantiationService({ environmentService: () => defaultEnv }, store);
		const agentsService = workbenchInstantiationService({ environmentService: () => agentsEnv }, store);

		defaultService.invokeFunction(accessor => {
			assert.strictEqual(isDefaultCodeWindow(accessor), true);
			assert.strictEqual(shouldRouteChatEditorToConversation(accessor), true);
		});
		agentsService.invokeFunction(accessor => {
			assert.strictEqual(isDefaultCodeWindow(accessor), false);
			assert.strictEqual(shouldRouteChatEditorToConversation(accessor), false);
		});
	});

	test('openChatSession fails fast for default-window Editor before session side effects', async () => {
		let importStoreSetCalled = false;
		const importStore: IAgentHostImportConversationStore = {
			_serviceBrand: undefined,
			set: () => { importStoreSetCalled = true; },
			take: () => undefined,
			rename: () => { },
		};

		const instantiationService = workbenchInstantiationService({}, store);
		instantiationService.stub(IWorkbenchEnvironmentService, new DefaultCodeWindowEnvironmentService('', testLogsHome, testEnvOptions, TestProductService));
		instantiationService.stub(IAgentHostImportConversationStore, importStore);

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		conversationPart.create(document.createElement('div'));
		instantiationService.stub(IConversationPartService, conversationPart);

		await assert.rejects(
			() => instantiationService.invokeFunction(accessor => openChatSession(accessor, {
				type: 'local',
				displayName: 'Chat',
				position: ChatSessionPosition.Editor,
			}, {
				prompt: 'hello',
				importConversation: { turns: [{ id: 'turn-1' } as Turn], model: undefined },
			})),
			(err: unknown) => err instanceof BugIndicatingError,
		);
		assert.strictEqual(importStoreSetCalled, false);
	});

	test('openChatSession routes default-window Sidebar to Conversation without throwing', async () => {
		let focusCalled = false;
		const instantiationService = workbenchInstantiationService({}, store);
		instantiationService.stub(IWorkbenchEnvironmentService, new DefaultCodeWindowEnvironmentService('', testLogsHome, testEnvOptions, TestProductService));

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		conversationPart.create(document.createElement('div'));
		const originalFocus = conversationPart.focus.bind(conversationPart);
		conversationPart.focus = () => {
			focusCalled = true;
			originalFocus();
		};
		instantiationService.stub(IConversationPartService, conversationPart);

		await instantiationService.invokeFunction(accessor => openChatSession(accessor, {
			type: 'local',
			displayName: 'Chat',
			position: ChatSessionPosition.Sidebar,
		}));

		assert.strictEqual(focusCalled, true);
	});

	test('shouldRegisterChatEditorResolver is false in default Code window', () => {
		assert.strictEqual(shouldRegisterChatEditorResolver(false), false);
		assert.strictEqual(shouldRegisterChatEditorResolver(true), true);
	});

	test('Quick Chat toggle keybinding and title bar menu are Agents Window only', () => {
		const keybinding = KeybindingsRegistry.getDefaultKeybindingsForOS(OS)
			.find(item => item.command === ASK_QUICK_QUESTION_ACTION_ID);
		assert.ok(keybinding, 'Quick Chat toggle keybinding should be registered');
		assert.ok(keybinding.when, 'Quick Chat keybinding should have a when clause');
		assert.strictEqual(evalWhen(keybinding.when, defaultWindow), false);
		assert.strictEqual(evalWhen(keybinding.when, agentsWindow), true);

		const menuItem = MenuRegistry.getMenuItems(MenuId.ChatTitleBarMenu)
			.filter(isIMenuItem)
			.find(item => item.command.id === ASK_QUICK_QUESTION_ACTION_ID);
		assert.ok(menuItem, 'Quick Chat title bar menu item should be registered');
		assert.ok(menuItem.when, 'Quick Chat title bar menu item should have a when clause');
		assert.strictEqual(evalWhen(menuItem.when, defaultWindow), false);
		assert.strictEqual(evalWhen(menuItem.when, agentsWindow), true);
	});

	test('focusConversationPart shows and focuses ConversationPart', async () => {
		const instantiationService = workbenchInstantiationService({}, store);
		instantiationService.stub(IWorkbenchEnvironmentService, new DefaultCodeWindowEnvironmentService('', testLogsHome, testEnvOptions, TestProductService));

		let focusCalled = false;
		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		conversationPart.create(document.createElement('div'));
		const originalFocus = conversationPart.focus.bind(conversationPart);
		conversationPart.focus = () => {
			focusCalled = true;
			originalFocus();
		};
		instantiationService.stub(IConversationPartService, conversationPart);

		await instantiationService.invokeFunction(accessor => focusConversationPart(accessor));
		assert.strictEqual(focusCalled, true);
	});
});
