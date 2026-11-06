/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationChangeEvent } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConversationEditorPart } from '../../../../services/editor/common/editorGroupsService.js';
import { MOUSE_BACK_FORWARD_NAVIGATION_SETTING } from '../../../../services/history/common/history.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationNavigationContribution } from '../../browser/conversationNavigation.contribution.js';
import { IConversationNavigationService } from '../../browser/conversationNavigationService.js';
import { IConversationSessionChatService } from '../../browser/conversationSessionChatService.js';
import { IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { createEmptyConversationSessionChatService, createNoopConversationSessionWindowService } from './conversationTimelineLinkTestStubs.js';

const SESSION_KEY = 'session-mouse-nav';

suite('ConversationNavigationContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountMouseNavigation(options?: { readonly enabled?: boolean }): {
		readonly configurationService: TestConfigurationService;
		readonly layoutService: IWorkbenchLayoutService;
		readonly goBackCalls: number;
		disposeContribution: () => void;
		dispatchMouseBack: () => void;
	} {
		const sessionBar = document.createElement('div');
		const sessionWindow = document.createElement('div');
		document.body.appendChild(sessionBar);
		document.body.appendChild(sessionWindow);
		store.add({ dispose: () => { sessionBar.remove(); sessionWindow.remove(); } });

		let goBackCalls = 0;
		let leafSessionKeys: string[] = [SESSION_KEY];
		const visibleWindowsEmitter = store.add(new Emitter<void>());
		const configurationService = new TestConfigurationService({
			[MOUSE_BACK_FORWARD_NAVIGATION_SETTING]: options?.enabled ?? true,
		});

		const instantiationService = workbenchInstantiationService({
			configurationService: () => configurationService,
		}, store);
		const layoutService = instantiationService.get(IWorkbenchLayoutService);
		(layoutService as { hasFocus(part: Parts): boolean }).hasFocus = (part: Parts) => part === Parts.CONVERSATION_PART;

		instantiationService.stub(IConversationNavigationService, {
			_serviceBrand: undefined,
			onDidChangeStack: Event.None,
			registerPart: () => ({ dispose: () => { } }),
			canGoBack: () => false,
			canGoForward: () => false,
			goBack: async () => {
				goBackCalls++;
			},
			goForward: async () => { },
		});
		instantiationService.stub(IConversationSessionWindowService, {
			...createNoopConversationSessionWindowService(),
			onDidChangeVisibleWindows: visibleWindowsEmitter.event,
			getAllLeafSessionKeys: () => leafSessionKeys,
			getLeafSlots: () => ({
				sessionKey: SESSION_KEY,
				container: sessionBar,
				sessionBar,
				sessionWindow,
				editorPartHost: sessionWindow,
			}),
		});
		instantiationService.stub(IConversationSessionChatService, {
			...createEmptyConversationSessionChatService(),
			getConversationPart: () => ({ sessionKey: SESSION_KEY } as IConversationEditorPart),
		});

		const contribution = instantiationService.createInstance(ConversationNavigationContribution);
		// The contribution keeps one store per mounted leaf and only releases it
		// when that leaf disappears, so tear down by closing the leaf first.
		let contributionDisposed = false;
		const disposeContribution = () => {
			if (contributionDisposed) {
				return;
			}
			contributionDisposed = true;
			leafSessionKeys = [];
			visibleWindowsEmitter.fire();
			contribution.dispose();
		};
		store.add({ dispose: disposeContribution });

		const dispatchMouseBack = () => {
			layoutService.mainContainer.dispatchEvent(new MouseEvent('mousedown', {
				button: 3,
				bubbles: true,
				cancelable: true,
			}));
		};

		return {
			configurationService,
			layoutService,
			get goBackCalls() { return goBackCalls; },
			disposeContribution,
			dispatchMouseBack,
		};
	}

	function fireMouseNavigationSettingChange(configurationService: TestConfigurationService): void {
		configurationService.onDidChangeConfigurationEmitter.fire({
			affectsConfiguration: (section: string) => section === MOUSE_BACK_FORWARD_NAVIGATION_SETTING,
		} as unknown as IConfigurationChangeEvent);
	}

	test('registers only one mouse-back handler after toggling mouse navigation setting', async () => {
		const harness = mountMouseNavigation();
		harness.dispatchMouseBack();
		assert.strictEqual(harness.goBackCalls, 1);

		await harness.configurationService.setUserConfiguration(MOUSE_BACK_FORWARD_NAVIGATION_SETTING, false);
		fireMouseNavigationSettingChange(harness.configurationService);
		await harness.configurationService.setUserConfiguration(MOUSE_BACK_FORWARD_NAVIGATION_SETTING, true);
		fireMouseNavigationSettingChange(harness.configurationService);

		harness.dispatchMouseBack();
		assert.strictEqual(harness.goBackCalls, 2);
	});

	test('mouse back does not navigate after contribution dispose', () => {
		const harness = mountMouseNavigation();
		harness.disposeContribution();
		harness.dispatchMouseBack();
		assert.strictEqual(harness.goBackCalls, 0);
	});
});
