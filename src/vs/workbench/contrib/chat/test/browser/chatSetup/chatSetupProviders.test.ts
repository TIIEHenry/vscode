/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { Range } from '../../../../../../editor/common/core/range.js';
import { createTextModel } from '../../../../../../editor/test/common/testTextModel.js';
import { LanguageFeaturesService } from '../../../../../../editor/common/services/languageFeaturesService.js';
import { ILanguageFeaturesService } from '../../../../../../editor/common/services/languageFeatures.js';
import { TestInstantiationService } from '../../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IMarker, IMarkerService, MarkerSeverity } from '../../../../../../platform/markers/common/markers.js';
import { IWorkbenchEnvironmentService } from '../../../../../services/environment/common/environmentService.js';
import { ChatEntitlementContext, ChatEntitlementRequests, ChatEntitlementService } from '../../../../../services/chat/common/chatEntitlementService.js';
import { IChatAgentService } from '../../../common/participants/chatAgents.js';
import { ChatSetupContribution } from '../../../browser/chatSetup/chatSetupContributions.js';
import { ChatCodeActionsProvider } from '../../../browser/chatSetup/chatSetupProviders.js';
import { IConfigurationService } from '../../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../../platform/configuration/test/common/testConfigurationService.js';
import { ContextKeyService } from '../../../../../../platform/contextkey/browser/contextKeyService.js';
import { IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IActionViewItemService } from '../../../../../../platform/actions/browser/actionViewItemService.js';
import { IChatSessionsService } from '../../../common/chatSessionsService.js';
import { IWorkbenchExtensionEnablementService } from '../../../../../services/extensionManagement/common/extensionManagement.js';
import { IExtensionService } from '../../../../../services/extensions/common/extensions.js';
import { IExtensionsWorkbenchService } from '../../../../extensions/common/extensions.js';
import { NullLogService, ILogService } from '../../../../../../platform/log/common/log.js';

suite('ChatSetupProviders - default window gating (INV-NO-COPILOT)', () => {

	const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createSetupContext() {
		return testDisposables.add(new class extends mock<ChatEntitlementContext>() {
			override readonly onDidChange = Event.None;
			override readonly state = {
				completed: false,
				hidden: false,
				disabledInWorkspace: false,
				disabled: false,
				untrusted: false,
				installed: false,
				entitlement: 0,
			};
			override update(): Promise<void> { return Promise.resolve(); }
		}());
	}

	function stubChatSetupContributionDeps(
		instantiationService: TestInstantiationService,
		options: { isSessionsWindow: boolean },
	): LanguageFeaturesService {
		const languageFeaturesService = testDisposables.add(new LanguageFeaturesService());
		const context = createSetupContext();
		const requests = testDisposables.add(new class extends mock<ChatEntitlementRequests>() { }());

		const chatEntitlementService = testDisposables.add(new class extends mock<ChatEntitlementService>() {
			override readonly context = { value: context } as unknown as ChatEntitlementService['context'];
			override readonly requests = { value: requests } as unknown as ChatEntitlementService['requests'];
			override readonly onDidChangeSentiment = Event.None;
			override get sentiment() { return { completed: false }; }
		}());

		instantiationService.stub(ILanguageFeaturesService, languageFeaturesService);
		instantiationService.stub(IChatAgentService, new class extends mock<IChatAgentService>() {
			override registerAgent() { return Disposable.None; }
			override registerAgentImplementation() { return Disposable.None; }
			override updateAgent() { }
		}());
		instantiationService.stub(IActionViewItemService, new class extends mock<IActionViewItemService>() {
			override register() { return Disposable.None; }
		}());
		instantiationService.stub(IChatSessionsService, new class extends mock<IChatSessionsService>() { }());
		instantiationService.stub(IContextKeyService, testDisposables.add(new ContextKeyService(new TestConfigurationService())));
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
			override get isSessionsWindow() { return options.isSessionsWindow; }
		}());
		instantiationService.stub(IConfigurationService, new TestConfigurationService());
		instantiationService.stub(ILogService, new NullLogService());

		return languageFeaturesService;
	}

	test('default Code window does not register ChatCodeActionsProvider', () => {
		const instantiationService = testDisposables.add(new TestInstantiationService());
		const languageFeaturesService = stubChatSetupContributionDeps(instantiationService, { isSessionsWindow: false });

		testDisposables.add(instantiationService.createInstance(ChatSetupContribution));

		const model = testDisposables.add(createTextModel('function foo() {\n\n}\n', 'typescript'));
		assert.strictEqual(
			languageFeaturesService.codeActionProvider.has(model),
			false,
			'default Code window must not register setup code action provider'
		);
	});

	test('ChatCodeActionsProvider returns no actions in default Code window', async () => {
		const instantiationService = testDisposables.add(new TestInstantiationService());
		const marker: IMarker = {
			owner: 'test',
			resource: undefined!,
			severity: MarkerSeverity.Error,
			message: 'test error',
			startLineNumber: 1,
			startColumn: 1,
			endLineNumber: 1,
			endColumn: 2,
		};
		instantiationService.stub(IMarkerService, {
			read: () => [marker],
		});
		instantiationService.stub(IWorkbenchEnvironmentService, new class extends mock<IWorkbenchEnvironmentService>() {
			override get isSessionsWindow() { return false; }
		}());

		const provider = instantiationService.createInstance(ChatCodeActionsProvider);
		const model = testDisposables.add(createTextModel('\n', 'typescript'));
		const range = new Range(1, 1, 1, 1);

		const result = await provider.provideCodeActions(model, range);
		assert.strictEqual(result?.actions.length, 0, 'default Code window must not surface Copilot editor code actions');
	});

	test('ChatCodeActionsProvider may surface Generate on empty line in Agents Window', async () => {
		const instantiationService = testDisposables.add(new TestInstantiationService());
		instantiationService.stub(IMarkerService, { read: () => [] });
		instantiationService.stub(IWorkbenchEnvironmentService, new class extends mock<IWorkbenchEnvironmentService>() {
			override get isSessionsWindow() { return true; }
		}());

		const provider = instantiationService.createInstance(ChatCodeActionsProvider);
		const model = testDisposables.add(createTextModel('\n', 'typescript'));
		const range = new Range(1, 1, 1, 1);

		const result = await provider.provideCodeActions(model, range);
		assert.ok(result && result.actions.length > 0, 'Agents Window may surface Generate on an empty line');
		assert.ok(result.actions.some(action => action.title === 'Generate'));
	});
});
