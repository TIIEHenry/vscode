/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { constObservable, observableValue } from '../../../../../base/common/observable.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ContextKeyService } from '../../../../../platform/contextkey/browser/contextKeyService.js';
import { SessionWorkspacePickerVisibleContext } from '../../../../common/contextkeys.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { IOnboardingScenarioService } from '../../../../../workbench/contrib/onboarding/common/onboardingScenarioService.js';
import { ChatEntitlement, IChatEntitlementService } from '../../../../../workbench/services/chat/common/chatEntitlementService.js';
import { NewSessionViewTourTrigger } from '../../browser/newSessionViewTourTrigger.js';

suite('NewSessionViewTourTrigger', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('waits for the actual visible-session restore before triggering', () => {
		const configurationService = new TestConfigurationService();
		const contextKeyService = disposables.add(new ContextKeyService(configurationService));
		SessionWorkspacePickerVisibleContext.bindTo(contextKeyService).set(true);
		const initialRestoreComplete = observableValue<boolean>('initialRestoreComplete', false);
		const sessionsService = new class extends mock<ISessionsService>() {
			override readonly activeSession = observableValue('activeSession', undefined);
			override readonly initialRestoreComplete = initialRestoreComplete;
		}();
		const entitlement = observableValue('entitlement', ChatEntitlement.Available);
		const entitlementService = new class extends mock<IChatEntitlementService>() {
			override readonly onDidChangeEntitlement = Event.None;
			override readonly entitlementObs = entitlement;
			override get entitlement(): ChatEntitlement { return entitlement.get(); }
		}();
		const onboardingService = new class extends mock<IOnboardingScenarioService>() {
			override hasBeenShown(): boolean { return false; }
		}();
		const trigger = disposables.add(new NewSessionViewTourTrigger(
			'test.restoreGatedTour',
			onboardingService,
			sessionsService,
			disposables.add(new InMemoryStorageService()),
			configurationService,
			contextKeyService,
			entitlementService,
		));

		const beforeRestore = trigger.signal.get();
		initialRestoreComplete.set(true, undefined);

		assert.deepStrictEqual({ beforeRestore, afterRestore: trigger.signal.get() }, { beforeRestore: false, afterRestore: true });
	});

	test('does not treat quick chat as the new-session view', () => {
		const configurationService = new TestConfigurationService();
		const contextKeyService = disposables.add(new ContextKeyService(configurationService));
		SessionWorkspacePickerVisibleContext.bindTo(contextKeyService).set(true);
		const quickChat = session(true);
		const draft = session(false);
		const activeSession = observableValue<IActiveSession | undefined>('activeSession', quickChat);
		const sessionsService = new class extends mock<ISessionsService>() {
			override readonly activeSession = activeSession;
			override readonly initialRestoreComplete = observableValue('initialRestoreComplete', true);
		}();
		const entitlement = observableValue('entitlement', ChatEntitlement.Available);
		const entitlementService = new class extends mock<IChatEntitlementService>() {
			override readonly onDidChangeEntitlement = Event.None;
			override readonly entitlementObs = entitlement;
			override get entitlement(): ChatEntitlement { return entitlement.get(); }
		}();
		const onboardingService = new class extends mock<IOnboardingScenarioService>() {
			override hasBeenShown(): boolean { return false; }
		}();
		const trigger = disposables.add(new NewSessionViewTourTrigger(
			'test.quickChatGatedTour',
			onboardingService,
			sessionsService,
			disposables.add(new InMemoryStorageService()),
			configurationService,
			contextKeyService,
			entitlementService,
		));

		const duringQuickChat = trigger.signal.get();
		activeSession.set(draft, undefined);

		assert.deepStrictEqual({ duringQuickChat, afterDraft: trigger.signal.get() }, { duringQuickChat: false, afterDraft: true });
	});
});

function session(quickChat: boolean): IActiveSession {
	return new class extends mock<IActiveSession>() {
		override readonly isCreated = constObservable(false);
		override readonly isQuickChat = constObservable(quickChat);
	}();
}
