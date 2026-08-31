/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { ContextKeyService } from '../../../../../../platform/contextkey/browser/contextKeyService.js';
import { IWorkbenchEnvironmentService } from '../../../../../services/environment/common/environmentService.js';
import { IChatEntitlementService } from '../../../../../services/chat/common/chatEntitlementService.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService, ILogService } from '../../../../../../platform/log/common/log.js';
import { IActionViewItemService } from '../../../../../../platform/actions/browser/actionViewItemService.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { ChatEntitlementContext, ChatEntitlementRequests, ChatEntitlementService } from '../../../../../services/chat/common/chatEntitlementService.js';
import { IWorkbenchExtensionEnablementService } from '../../../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../../../services/extensions/common/extensions.js';
import { IExtensionsWorkbenchService } from '../../../../extensions/common/extensions.js';
import { CHAT_SETUP_ACTION_ID, CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID } from '../../../browser/actions/chatActions.js';
import { ChatSetupContribution } from '../../../browser/chatSetup/chatSetupContributions.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { IChatSessionsService } from '../../../common/chatSessionsService.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

function getMenuItem(menuId: MenuId, commandId: string) {
	return MenuRegistry.getMenuItems(menuId)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const setupReady: Record<string, ContextKeyValue> = {
	[ChatContextKeys.Setup.hidden.key]: false,
	[ChatContextKeys.Setup.disabledInWorkspace.key]: false,
	[ChatContextKeys.Setup.completed.key]: false,
	[ChatContextKeys.Entitlement.canSignUp.key]: true,
};

const defaultWindow: Record<string, ContextKeyValue> = {
	...setupReady,
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...setupReady,
	[IsSessionsWindowContext.key]: true,
};

const f1FalseSetupCommandIds = [
	CHAT_SETUP_ACTION_ID,
	CHAT_SETUP_SUPPORT_ANONYMOUS_ACTION_ID,
	'workbench.action.chat.triggerSetupForceSignIn',
	'workbench.action.chat.triggerSetupAnonymousWithoutDialog',
];

const editorSetupCommandIds = [
	'chat.internal.explain',
	'chat.internal.fix',
	'chat.internal.review',
];

suite('ChatSetupContributions - default window chrome (INV-NO-COPILOT)', () => {

	const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		const instantiationService = testDisposables.add(new TestInstantiationService());
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		const contextKeyService = testDisposables.add(new ContextKeyService(new TestConfigurationService()));

		const context = testDisposables.add(new class extends mock<ChatEntitlementContext>() {
			override readonly onDidChange = Event.None;
			override update(): Promise<void> { return Promise.resolve(); }
		}());
		const requests = testDisposables.add(new class extends mock<ChatEntitlementRequests>() { }());

		const chatEntitlementService = testDisposables.add(new class extends mock<ChatEntitlementService>() {
			override readonly context = { value: context } as unknown as ChatEntitlementService['context'];
			override readonly requests = { value: requests } as unknown as ChatEntitlementService['requests'];
			override readonly onDidChangeSentiment = Event.None;
			override get sentiment() { return { completed: true }; }
		}());

		instantiationService.stub(IActionViewItemService, new class extends mock<IActionViewItemService>() {
			override register() { return Disposable.None; }
		}());
		instantiationService.stub(IChatSessionsService, new class extends mock<IChatSessionsService>() { }());
		instantiationService.stub(IContextKeyService, contextKeyService);
		instantiationService.stub(IChatEntitlementService, chatEntitlementService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, new class extends mock<IWorkbenchExtensionEnablementService>() { }());
		instantiationService.stub(IExtensionsWorkbenchService, new class extends mock<IExtensionsWorkbenchService>() {
			override queryLocal() { return Promise.resolve([]); }
			override get onChange() { return Event.None; }
			override get local() { return []; }
		}());
		instantiationService.stub(IExtensionService, {
			whenInstalledExtensionsRegistered: () => Promise.resolve(true),
			extensions: [],
		});
		instantiationService.stub(IWorkbenchEnvironmentService, new class extends mock<IWorkbenchEnvironmentService>() {
			override get isExtensionDevelopment() { return false; }
			override get isSessionsWindow() { return false; }
		}());
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		instantiationService.stub(ILogService, new NullLogService());

		testDisposables.add(instantiationService.createInstance(ChatSetupContribution));
	});

	test('Chat setup API commands stay off Command Palette (f1: false)', () => {
		for (const commandId of f1FalseSetupCommandIds) {
			const item = getCommandPaletteItem(commandId);
			assert.strictEqual(item, undefined, `${commandId} must not appear in Command Palette (f1: false)`);
		}
	});

	test('default Code window hides internal setup editor context menu items', () => {
		for (const commandId of editorSetupCommandIds) {
			const item = getMenuItem(MenuId.EditorContext, commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} editor context item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in editor context menu`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`Agents Window may show ${commandId} in editor context menu`
			);
		}
	});

	test('default Code window hides Copilot Sign In title bar entry', () => {
		const item = getMenuItem(MenuId.TitleBarAdjacentCenter, 'workbench.action.chat.signInIndicator');
		assert.ok(item, 'title bar sign-in should remain registered for Agents Window');
		assert.ok(item.when, 'title bar sign-in menu item should have a when clause');

		assert.strictEqual(
			evalWhen(item.when, defaultWindow),
			false,
			'default Code window must hide title bar sign-in entry'
		);
	});

	test('default Code window hides Copilot upgrade and budget title bar menu items', () => {
		const quotaExceeded: Record<string, ContextKeyValue> = {
			[ChatContextKeys.chatQuotaExceeded.key]: true,
		};
		const upgradeItem = getMenuItem(MenuId.ChatTitleBarMenu, 'workbench.action.chat.upgradePlan');
		const budgetItem = getMenuItem(MenuId.ChatTitleBarMenu, 'workbench.action.chat.manageAdditionalSpend');
		assert.ok(upgradeItem?.when, 'upgrade plan menu item should have a when clause');
		assert.ok(budgetItem?.when, 'manage budget menu item should have a when clause');

		const freePlan: Record<string, ContextKeyValue> = {
			...setupReady,
			[IsSessionsWindowContext.key]: true,
			[ChatContextKeys.Entitlement.planFree.key]: true,
			...quotaExceeded,
		};
		const proPlan: Record<string, ContextKeyValue> = {
			...setupReady,
			[IsSessionsWindowContext.key]: true,
			[ChatContextKeys.Entitlement.planPro.key]: true,
			...quotaExceeded,
		};

		assert.strictEqual(
			evalWhen(upgradeItem!.when, { ...freePlan, [IsSessionsWindowContext.key]: false }),
			false,
			'default Code window must hide upgrade plan title bar menu item'
		);
		assert.strictEqual(
			evalWhen(budgetItem!.when, { ...proPlan, [IsSessionsWindowContext.key]: false }),
			false,
			'default Code window must hide manage budget title bar menu item'
		);
		assert.strictEqual(
			evalWhen(upgradeItem!.when, freePlan),
			true,
			'Agents Window may show upgrade plan title bar menu item'
		);
	});
});
