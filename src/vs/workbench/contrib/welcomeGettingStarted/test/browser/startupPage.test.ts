/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IS_NEW_KEY, IStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IOnboardingService } from '../../../welcomeOnboarding/common/onboardingService.js';
import { StartupPageRunnerContribution } from '../../browser/startupPage.js';

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
