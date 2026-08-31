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
import { IEnvironmentService } from '../../../../../../platform/environment/common/environment.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { NullLogService } from '../../../../../../platform/log/common/log.js';
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
		const contextKeyService = testDisposables.add(new ContextKeyService(instantiationService));

		const context = testDisposables.add(new class extends mock<ChatEntitlementContext>() {
			override readonly onDidChange = Event.None;
			override update() { }
		}());
		const requests = testDisposables.add(new class extends mock<ChatEntitlementRequests>() { }());

		const chatEntitlementService = testDisposables.add(new class extends mock<ChatEntitlementService>() {
			override readonly context = { value: context };
			override readonly requests = { value: requests };
			override readonly onDidChangeSentiment = Event.None;
			override get sentiment() { return { completed: true }; }
		}());

		instantiationService.stub(IActionViewItemService, testDisposables.add(new class extends mock<IActionViewItemService>() {
			override register() { return Disposable.None; }
		}()));
		instantiationService.stub(IChatSessionsService, testDisposables.add(new class extends mock<IChatSessionsService>() { }()));
		instantiationService.stub(IContextKeyService, contextKeyService);
		instantiationService.stub(IChatEntitlementService, chatEntitlementService);
		instantiationService.stub(IWorkbenchExtensionEnablementService, testDisposables.add(new class extends mock<IWorkbenchExtensionEnablementService>() { }()));
		instantiationService.stub(IExtensionsWorkbenchService, testDisposables.add(new class extends mock<IExtensionsWorkbenchService>() {
			override queryLocal() { return Promise.resolve([]); }
			override get onChange() { return Event.None; }
			override get local() { return []; }
		}()));
		instantiationService.stub(IExtensionService, testDisposables.add(new class extends mock<IExtensionService>() {
			override whenInstalledExtensionsRegistered() { return Promise.resolve(); }
			override get extensions() { return []; }
		}()));
		instantiationService.stub(IEnvironmentService, testDisposables.add(new class extends mock<IEnvironmentService>() {
			override get isExtensionDevelopment() { return false; }
		}()));
		instantiationService.stub(IConfigurationService, testDisposables.add(new TestConfigurationService()));

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
});
