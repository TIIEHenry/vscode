/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IS_NEW_KEY, IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IWorkspaceContextService, UNKNOWN_EMPTY_WINDOW_WORKSPACE } from '../../../../../platform/workspace/common/workspace.js';
import { testWorkspace, TestWorkspace } from '../../../../../platform/workspace/test/common/testWorkspace.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { TestContextService, TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { TestEditorService, TestEnvironmentService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IOnboardingService } from '../../../welcomeOnboarding/common/onboardingService.js';
import { isCopilotWalkthroughCategory, isShowWelcomeOnStartupChecked, restoreWalkthroughsConfigurationKey, StartupPageRunnerContribution, walkthroughRestoreFolderMatches } from '../../browser/startupPage.js';

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
		folder?: string;
		folders?: readonly { uri: URI }[];
		startupEditor?: string;
	}): Promise<{ openEditorCalls: number; storageService: TestStorageService }> {
		const tracker = { openEditorCalls: 0 };

		const onboardingService: IOnboardingService = {
			_serviceBrand: undefined,
			onDidDismiss: Event.None,
			show: () => { },
		};

		const configurationService = new TestConfigurationService(
			options.startupEditor ? { 'workbench.startupEditor': options.startupEditor } : {}
		);

		const contextKeyService = new MockContextKeyService();
		contextKeyService.createKey(IsSessionsWindowContext.key, options.isSessionsWindow);

		const storageService = store.add(new TestStorageService());
		storageService.store(
			restoreWalkthroughsConfigurationKey,
			JSON.stringify({ folder: options.folder ?? UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, category: options.category, step: 'copilot.setup.signIn' }),
			StorageScope.PROFILE,
			StorageTarget.MACHINE
		);

		const environmentService = Object.create(TestEnvironmentService);
		Object.defineProperty(environmentService, 'isSessionsWindow', {
			get: () => options.isSessionsWindow,
			enumerable: true,
			configurable: true,
		});

		const editorService = store.add(new class extends TestEditorService {
			override async openEditor(): Promise<undefined> {
				tracker.openEditorCalls++;
				return undefined;
			}
		}());

		const contextService = new TestContextService(
			options.folders !== undefined ? testWorkspace(...options.folders.map(f => f.uri)) : TestWorkspace
		);

		const instantiationService = workbenchInstantiationService({
			configurationService: () => configurationService,
			contextKeyService: () => contextKeyService,
			editorService: () => editorService,
			environmentService: () => environmentService,
		}, store);

		instantiationService.stub(IWorkspaceContextService, contextService);
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

	test('empty workspace with different stored folder does not throw and still opens welcome page while keeping restore key', async () => {
		const otherFolderUri = URI.file('/tmp/stored-folder');
		const { openEditorCalls, storageService } = await createWalkthroughRestoreContribution({
			isSessionsWindow: false,
			category: 'someCategory',
			folder: otherFolderUri.toString(),
			folders: [],
			startupEditor: 'welcomePage',
		});

		assert.strictEqual(openEditorCalls, 1);
		assert.notStrictEqual(storageService.get(restoreWalkthroughsConfigurationKey, StorageScope.PROFILE), undefined);
	});
});

suite('walkthroughRestoreFolderMatches', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const folderUri = URI.file('/tmp/walkthrough-restore-test');
	const otherFolderUri = URI.file('/tmp/other-folder');

	test('empty folders and empty-window restore id matches without reading folder uri', () => {
		let threw = false;
		let result: boolean | undefined;
		try {
			result = walkthroughRestoreFolderMatches(UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, []);
		} catch {
			threw = true;
		}
		assert.strictEqual(threw, false);
		assert.strictEqual(result, true);
	});

	test('empty folders and stored folder uri does not match without throwing', () => {
		let threw = false;
		let result: boolean | undefined;
		try {
			result = walkthroughRestoreFolderMatches(folderUri.toString(), []);
		} catch {
			threw = true;
		}
		assert.strictEqual(threw, false);
		assert.strictEqual(result, false);
	});

	test('first workspace folder uri string matches restore folder', () => {
		const folders = [{ uri: folderUri }];
		const result = walkthroughRestoreFolderMatches(folderUri.toString(), folders);
		assert.strictEqual(result, true);
	});

	test('first workspace folder uri string differs from restore folder', () => {
		const folders = [{ uri: folderUri }];
		const result = walkthroughRestoreFolderMatches(otherFolderUri.toString(), folders);
		assert.strictEqual(result, false);
	});
});

suite('isShowWelcomeOnStartupChecked', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('welcomePage and welcomePageInEmptyWorkbench are checked', () => {
		assert.strictEqual(isShowWelcomeOnStartupChecked('welcomePage'), true);
		assert.strictEqual(isShowWelcomeOnStartupChecked('welcomePageInEmptyWorkbench'), true);
	});

	test('none, readme, newUntitledFile, terminal, agentSessionsWelcomePage, and undefined are unchecked', () => {
		assert.strictEqual(isShowWelcomeOnStartupChecked('none'), false);
		assert.strictEqual(isShowWelcomeOnStartupChecked('readme'), false);
		assert.strictEqual(isShowWelcomeOnStartupChecked('newUntitledFile'), false);
		assert.strictEqual(isShowWelcomeOnStartupChecked('terminal'), false);
		assert.strictEqual(isShowWelcomeOnStartupChecked('agentSessionsWelcomePage'), false);
		assert.strictEqual(isShowWelcomeOnStartupChecked(undefined), false);
	});
});
