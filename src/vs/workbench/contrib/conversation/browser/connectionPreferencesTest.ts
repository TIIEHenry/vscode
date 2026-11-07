/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { getConnectionPhaseTone } from './connectionPreferencesPaneLabels.js';
import { formatConnectionProbeStatus, getConnectionRemoteIoHintCopy, getConnectionTestStatusText, writeStatus } from './connectionPreferencesZone.js';

export interface IConnectionPreferencesTestHost {
	/** The pane's list selection; the profile probe settles against it. */
	getActiveProfileId(): string | undefined;
}

/** Test Connection zone. Owns the probe generations; the profile list only bumps {@link invalidateProfileProbe}. */
export class ConnectionPreferencesTest extends Disposable {

	readonly element: HTMLElement;
	readonly status: HTMLElement;
	private testGeneration = 0;
	/** `testGeneration` of the most recent Test click; selection changes bump the generation but start no run. */
	private latestTestRunGeneration = 0;

	constructor(
		parent: HTMLElement,
		private readonly host: IConnectionPreferencesTestHost,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
	) {
		super();
		this.element = DOM.append(parent, DOM.$('.connection-zone.connection-test-section'));
		const testRow = DOM.append(this.element, DOM.$('.connection-test-row'));
		const testButton = this._register(new Button(testRow, { ...defaultButtonStyles, secondary: true }));
		testButton.label = localize('ua.connectionTestActiveProfile', "Test active profile");
		this.status = DOM.append(testRow, DOM.$('.connection-status.connection-test-status'));
		this.status.setAttribute('role', 'status');
		this.status.setAttribute('aria-live', 'polite');
		this._register(testButton.onDidClick(() => void this.handleTestConnection().catch(onUnexpectedError).catch(onUnexpectedError)));

		const remoteIoHint = DOM.append(this.element, DOM.$('.connection-remote-io-hint'));
		remoteIoHint.textContent = getConnectionRemoteIoHintCopy();
	}

	/** A different profile was selected: an in-flight profile probe no longer owns the result. */
	invalidateProfileProbe(): void {
		this.testGeneration++;
	}

	/** A discarded test must not leave "Testing…" hanging; a result already painted stays. */
	private clearStaleTestStatus(testingCopy: string): void {
		if (this._store.isDisposed || this.status.textContent !== testingCopy) {
			return;
		}
		writeStatus(this.status, '');
	}

	private async handleTestConnection(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		const generation = ++this.testGeneration;
		this.latestTestRunGeneration = generation;
		const profileAtStart = this.host.getActiveProfileId();
		const startedSnapshot = this.connectionService.getConnectionSnapshot();
		const startedEngineIdentityId = readPublishedEngineIdentityId(startedSnapshot);
		const startedLinkId = readPublishedLinkId(startedSnapshot);
		const testingCopy = localize('ua.connectionTestRunning', "Testing…");
		/** Profile probes settle on generation + profile only; a current-connection reconnect must not discard them. */
		const profileProbeCurrent = (): boolean =>
			!this._store.isDisposed && generation === this.testGeneration && profileAtStart === this.host.getActiveProfileId();
		/** The no-profile probe tests this very connection, so its published identity and link stay in the gate. */
		const engineProbeCurrent = (): boolean => {
			if (!profileProbeCurrent()) {
				return false;
			}
			const current = this.connectionService.getConnectionSnapshot();
			return readPublishedEngineIdentityId(current) === startedEngineIdentityId && readPublishedLinkId(current) === startedLinkId;
		};
		/**
		 * Stale but alive: clear a hanging "Testing…" once, then tell the caller to drop the result.
		 * A newer Test click owns the "Testing…" on screen, so an older run leaves it alone.
		 */
		const discarded = (isCurrent: () => boolean): boolean => {
			if (isCurrent()) {
				return false;
			}
			if (generation === this.latestTestRunGeneration) {
				this.clearStaleTestStatus(testingCopy);
			}
			return true;
		};
		if (!profileAtStart) {
			if (typeof this.connectionService.probeEngine === 'function') {
				writeStatus(this.status, testingCopy);
				try {
					const result = await this.connectionService.probeEngine();
					if (discarded(engineProbeCurrent)) {
						return;
					}
					writeStatus(
						this.status,
						formatConnectionProbeStatus(
							result,
							getConnectionTestStatusText(
								this.connectionService.getConnectionPhase(),
								this.connectionService.getConnectionSnapshot().pairingPending,
							),
						),
						result.ok
							? getConnectionPhaseTone(
								this.connectionService.getConnectionPhase(),
								this.connectionService.getConnectionSnapshot().pairingPending,
							)
							: 'error',
					);
				} catch (error) {
					if (discarded(engineProbeCurrent)) {
						return;
					}
					const reason = error instanceof Error && error.message ? error.message : String(error);
					writeStatus(this.status, reason, 'error');
				}
				return;
			}
			writeStatus(this.status, getConnectionTestStatusText());
			return;
		}
		writeStatus(this.status, testingCopy);
		try {
			const result = await this.connectionService.probeConnectionProfile(profileAtStart);
			if (discarded(profileProbeCurrent)) {
				return;
			}
			if (!result.ok && result.code === 'pairing_required') {
				writeStatus(
					this.status,
					localize(
						'ua.connectionProbePairingRequired',
						"This profile is not paired yet. Select Connect to complete pairing.",
					),
					'neutral',
				);
				return;
			}
			writeStatus(this.status, formatConnectionProbeStatus(result), result.ok ? 'success' : 'error');
		} catch (error) {
			if (discarded(profileProbeCurrent)) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.status, reason, 'error');
		}
	}
}
