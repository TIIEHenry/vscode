/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { mainWindow } from '../../../../base/browser/window.js';
import { disposableTimeout } from '../../../../base/common/async.js';
import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { onboardingScenarioRegistry } from '../../../../workbench/contrib/onboarding/common/onboardingRegistry.js';
import { isOnboardingDeveloperModeEnabled, IOnboardingScenarioService } from '../../../../workbench/contrib/onboarding/common/onboardingScenarioService.js';
import { findOnboardingTarget, pulseOnboardingTarget } from '../../../../workbench/contrib/onboarding/browser/spotlight/onboardingTarget.js';
import { ISessionsManagementService } from '../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';
import { TOTAL_SESSIONS_KEY } from '../../sessions/browser/sessionsLifecycleTracker.js';
import { watchNewSessionTourActivation } from './newSessionTourActivation.js';
import { NewSessionTourPulseModel } from './newSessionTourPulse.js';
import { createNewSessionTour, NEW_SESSION_TOUR_ID } from './tours/newSessionTour.js';

const NEW_SESSION_BUTTON_TARGET = 'sessions.newSession.button';

/**
 * Registers the "new session" onboarding tour and decides *when* it should run.
 *
 * The tour targets brand-new users: it only triggers while the number of
 * sessions the user has ever started (persisted by the sessions telemetry
 * tracker under {@link TOTAL_SESSIONS_KEY}) is at most {@link MAX_SESSIONS_FOR_TOUR}.
 * When an eligible user sends a request, we wait {@link VISIBILITY_DELAY_MS}
 * and only then pulse the "New Session" button — and only if that session is
 * still in the visible grid. While the pulse is showing, leaving that grid
 * ends it without starting the tour and cancels the wait, so coming back does
 * not resume it. A different session's request drops the current pulse and
 * waits again. A follow-up in the same still-visible session keeps the pulse.
 * An ineligible request cancels both the wait and the pulse, so a late
 * callback cannot light the button. Accepting that pulse — click, touch, or
 * Enter/Space on the button, or opening the new-session view from a created
 * session — flips the tour's trigger signal. The onboarding engine handles
 * showing the tour at most once.
 *
 * The `onboarding.developerMode` setting bypasses the session-count gate so the
 * tour can be triggered on demand for testing.
 */
class NewSessionTourContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'sessions.contrib.onboardingTours.newSessionTour';

	/** Only nudge users who are still in their first few sessions. */
	private static readonly MAX_SESSIONS_FOR_TOUR = 3;
	/** Delay after a request before checking the session is still visible. */
	private static readonly VISIBILITY_DELAY_MS = 5_000;

	private readonly _pulse = this._register(new MutableDisposable<DisposableStore>());
	private readonly _pulseModel: NewSessionTourPulseModel;

	constructor(
		@ISessionsManagementService sessionsManagementService: ISessionsManagementService,
		@IOnboardingScenarioService private readonly onboardingScenarioService: IOnboardingScenarioService,
		@ISessionsService private readonly sessionsService: ISessionsService,
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();

		this._pulseModel = this._register(new NewSessionTourPulseModel({
			isEligible: () => this._isEligibleUser(),
			hasBeenShown: () => this.onboardingScenarioService.hasBeenShown(NEW_SESSION_TOUR_ID),
			isSessionVisible: sessionId => this.sessionsService.visibleSessions.get().some(session => session?.sessionId === sessionId),
			schedule: callback => disposableTimeout(callback, NewSessionTourContribution.VISIBILITY_DELAY_MS),
		}, sessionId => this._syncPulse(sessionId)));

		this._register(onboardingScenarioRegistry.register(createNewSessionTour(this._pulseModel.signal)));
		this._register(sessionsManagementService.onWillSendRequest(session => this._pulseModel.onWillSendRequest(session.sessionId)));
		// Ending the pulse clears only the button listeners, not this autorun.
		this._register(autorun(reader => {
			this.sessionsService.visibleSessions.read(reader);
			this._pulseModel.reevaluate();
		}));
	}

	private _isEligibleUser(): boolean {
		if (isOnboardingDeveloperModeEnabled(this.configurationService, NEW_SESSION_TOUR_ID)) {
			return true;
		}
		const sessionsStarted = this.storageService.getNumber(TOTAL_SESSIONS_KEY, StorageScope.APPLICATION, 0);
		return sessionsStarted <= NewSessionTourContribution.MAX_SESSIONS_FOR_TOUR;
	}

	private _syncPulse(sessionId: string | undefined): void {
		this._pulse.clear();
		if (!sessionId) {
			return;
		}

		const target = findOnboardingTarget(mainWindow, NEW_SESSION_BUTTON_TARGET);
		if (!target) {
			this._pulseModel.releaseUnshown();
			return;
		}

		const pulse = new DisposableStore();
		pulse.add(pulseOnboardingTarget(target));
		pulse.add(watchNewSessionTourActivation(target, this.sessionsService, () => {
			this._pulseModel.accept();
		}));
		this._pulse.value = pulse;
	}
}

registerWorkbenchContribution2(NewSessionTourContribution.ID, NewSessionTourContribution, WorkbenchPhase.AfterRestored);
