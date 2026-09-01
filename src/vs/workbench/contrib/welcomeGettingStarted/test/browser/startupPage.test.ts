/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IS_NEW_KEY, IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { UNKNOWN_EMPTY_WINDOW_WORKSPACE } from '../../../../../platform/workspace/common/workspace.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { TestEditorService, TestEnvironmentService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IOnboardingService } from '../../../welcomeOnboarding/common/onboardingService.js';
import { isCopilotWalkthroughCategory, restoreWalkthroughsConfigurationKey, StartupPageRunnerContribution } from '../../browser/startupPage.js';

suite('StartupPageRunnerContribution - default window onboarding (INV-NO-COPILOT)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createContribution(options: {
		isSessionsWindow: boolean;
		isNewApplicationStorage: boolean;
	}): { showCalled: boolean } {
		const tracker = { showCalled: false };

		const onboardingService: IOnboardingService = {
			_serviceBrand: undefined,
			onDidDismiss: Event.None,
			show: () => { tracker.showCalled = true; },
		};

		const configurationService = new TestConfigurationService({
			'workbench.welcomePage.experimentalOnboarding': true,
		});

		const contextKeyService = new MockContextKeyService();
		contextKeyService.createKey(IsSessionsWindowContext.key, options.isSessionsWindow);

		const storageService = store.add(new TestStorageService());
		if (options.isNewApplicationStorage) {
			storageService.store(IS_NEW_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
		}

		const instantiationService = workbenchInstantiationService({
			configurationService: () => configurationService,
			contextKeyService: () => contextKeyService,
		}, store);

		instantiationService.stub(IOnboardingService, onboardingService);
		instantiationService.stub(IStorageService, storageService);

		store.add(instantiationService.createInstance(StartupPageRunnerContribution));

		return tracker;
	}

	test('default window does not call onboardingService.show even when APPLICATION storage is new', () => {
		const tracker = createContribution({
			isSessionsWindow: false,
			isNewApplicationStorage: true,
		});

		assert.strictEqual(tracker.showCalled, false);
	});

	test('Agents window calls onboardingService.show when APPLICATION storage is new', () => {
		const tracker = createContribution({
			isSessionsWindow: true,
			isNewApplicationStorage: true,
		});

		assert.strictEqual(tracker.showCalled, true);
	});
});

suite('StartupPageRunnerContribution - walkthrough restore (INV-NO-COPILOT)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('isCopilotWalkthroughCategory detects copilotWelcome categories', () => {
		assert.strictEqual(isCopilotWalkthroughCategory('GitHub.copilot-chat#copilotWelcome'), true);
		assert.strictEqual(isCopilotWalkthroughCategory('copilotWelcome'), true);
		assert.strictEqual(isCopilotWalkthroughCategory('GitHub.vscode#Setup'), false);
		assert.strictEqual(isCopilotWalkthroughCategory(undefined), false);
	});

	async function createWalkthroughRestoreContribution(options: {
		isSessionsWindow: boolean;
		category: string;
	}): Promise<{ openEditorCalls: number; storageService: TestStorageService }> {
		const tracker = { openEditorCalls: 0 };

		const onboardingService: IOnboardingService = {
			_serviceBrand: undefined,
			onDidDismiss: Event.None,
			show: () => { },
		};

		const configurationService = new TestConfigurationService();

		const contextKeyService = new MockContextKeyService();
		contextKeyService.createKey(IsSessionsWindowContext.key, options.isSessionsWindow);

		const storageService = store.add(new TestStorageService());
		storageService.store(
			restoreWalkthroughsConfigurationKey,
			JSON.stringify({ folder: UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, category: options.category, step: 'copilot.setup.signIn' }),
			StorageScope.PROFILE,
			StorageTarget.MACHINE
		);

		const environmentService = Object.create(TestEnvironmentService);
		environmentService.isSessionsWindow = options.isSessionsWindow;

		const editorService = store.add(new class extends TestEditorService {
			override async openEditor(): Promise<undefined> {
				tracker.openEditorCalls++;
				return undefined;
			}
		}());

		const instantiationService = workbenchInstantiationService({
			configurationService: () => configurationService,
			contextKeyService: () => contextKeyService,
			editorService: () => editorService,
			environmentService: () => environmentService,
		}, store);

		instantiationService.stub(IOnboardingService, onboardingService);
		instantiationService.stub(IStorageService, storageService);
		instantiationService.stub(IWorkbenchEnvironmentService, environmentService);
		instantiationService.stub(IEditorService, editorService);

		store.add(instantiationService.createInstance(StartupPageRunnerContribution));
		await timeout(0);

		return { openEditorCalls: tracker.openEditorCalls, storageService };
	}

	test('default Code window skips restoring Copilot walkthrough and clears storage', async () => {
		const { openEditorCalls, storageService } = await createWalkthroughRestoreContribution({
			isSessionsWindow: false,
			category: 'GitHub.copilot-chat#copilotWelcome',
		});

		assert.strictEqual(openEditorCalls, 0);
		assert.strictEqual(storageService.get(restoreWalkthroughsConfigurationKey, StorageScope.PROFILE), undefined);
	});

	test('Agents window still restores Copilot walkthrough', async () => {
		const { openEditorCalls, storageService } = await createWalkthroughRestoreContribution({
			isSessionsWindow: true,
			category: 'GitHub.copilot-chat#copilotWelcome',
		});

		assert.strictEqual(openEditorCalls, 1);
		assert.strictEqual(storageService.get(restoreWalkthroughsConfigurationKey, StorageScope.PROFILE), undefined);
	});
});
