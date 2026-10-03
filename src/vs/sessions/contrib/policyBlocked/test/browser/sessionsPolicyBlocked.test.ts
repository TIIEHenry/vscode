/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationChangeEvent, IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { ChatConfiguration } from '../../../../../workbench/contrib/chat/common/constants.js';
import { IWorkbenchLayoutService } from '../../../../../workbench/services/layout/browser/layoutService.js';
import { AccountPolicyGateState, IAccountPolicyGateService } from '../../../../../workbench/services/policies/common/accountPolicyService.js';
import { workbenchInstantiationService } from '../../../../../workbench/test/browser/workbenchTestServices.js';
import { SessionsPolicyBlockedContribution } from '../../browser/policyBlocked.contribution.js';
import { SessionsBlockedReason, SessionsPolicyBlockedOverlay } from '../../browser/sessionsPolicyBlocked.js';

suite('SessionsPolicyBlockedOverlay', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mount(reason: SessionsBlockedReason): HTMLElement {
		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() { }());
		instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { }());
		instantiationService.stub(IWorkbenchLayoutService, new class extends mock<IWorkbenchLayoutService>() {
			override readonly mainContainer = container;
		}());

		store.add(instantiationService.createInstance(
			SessionsPolicyBlockedOverlay,
			container,
			reason === SessionsBlockedReason.AccountPolicyGate
				? { reason, accountName: 'octocat', approvedOrganizations: ['github'] }
				: { reason },
		));
		return container;
	}

	test('initial focus is inside the card', () => {
		const container = mount(SessionsBlockedReason.AccountPolicyGate);
		const card = container.querySelector('.sessions-policy-blocked-card');
		const overlay = container.querySelector('.sessions-policy-blocked-overlay');
		assert.ok(card);
		assert.ok(overlay);
		const active = document.activeElement;
		assert.ok(active);
		assert.ok(card.contains(active));
		assert.notStrictEqual(active, overlay);
		assert.ok((active as HTMLElement).matches('button, a[href], [role="button"]'));

		const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
		overlay.dispatchEvent(event);
		assert.strictEqual(event.defaultPrevented, true);
	});

	test('loading focus is the card', () => {
		const container = mount(SessionsBlockedReason.Loading);
		const card = container.querySelector('.sessions-policy-blocked-card') as HTMLElement | null;
		assert.ok(card);
		assert.strictEqual(card.tabIndex, 0);
		assert.strictEqual(document.activeElement, card);
		assert.strictEqual(card.querySelector('button, a[href], [role="button"]'), null);
	});

	test('user setting does not show the organization policy overlay, and removing the policy clears it', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const configuration = store.add(new AgentEnabledConfiguration(false, undefined));
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConfigurationService, configuration);
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() { }());
		instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { }());
		instantiationService.stub(IDefaultAccountService, new class extends mock<IDefaultAccountService>() {
			override readonly currentDefaultAccount = null;
		}());
		instantiationService.stub(IAccountPolicyGateService, new class extends mock<IAccountPolicyGateService>() {
			override gateInfo = { state: AccountPolicyGateState.Inactive };
			override readonly onDidChangeGateInfo = Event.None;
		}());
		instantiationService.stub(IWorkbenchLayoutService, new class extends mock<IWorkbenchLayoutService>() {
			override readonly mainContainer = container;
		}());

		store.add(instantiationService.createInstance(SessionsPolicyBlockedContribution));

		assert.strictEqual(container.querySelector('.sessions-policy-blocked-overlay'), null);
		assert.strictEqual(container.classList.contains('sessions-policy-blocked'), false);

		configuration.set(false, false);
		const overlay = container.querySelector('.sessions-policy-blocked-overlay');
		assert.ok(overlay);
		assert.strictEqual(overlay.querySelector('h2')?.textContent, 'Agents Disabled');
		assert.ok(overlay.textContent?.includes('Your organization has disabled Agents via policy.'));
		assert.strictEqual(container.classList.contains('sessions-policy-blocked'), true);

		configuration.set(false, undefined);
		assert.strictEqual(container.querySelector('.sessions-policy-blocked-overlay'), null);
		assert.strictEqual(container.classList.contains('sessions-policy-blocked'), false);
	});
});

class AgentEnabledConfiguration extends mock<IConfigurationService>() {
	private readonly emitter = new Emitter<IConfigurationChangeEvent>();
	readonly onDidChangeConfiguration = this.emitter.event;

	constructor(
		private userValue: boolean | undefined,
		private policyValue: boolean | undefined,
	) {
		super();
	}

	set(userValue: boolean | undefined, policyValue: boolean | undefined): void {
		this.userValue = userValue;
		this.policyValue = policyValue;
		const event: IConfigurationChangeEvent = {
			source: ConfigurationTarget.DEFAULT,
			affectedKeys: new Set([ChatConfiguration.AgentEnabled]),
			change: { keys: [ChatConfiguration.AgentEnabled], overrides: [] },
			affectsConfiguration: (key: string) => key === ChatConfiguration.AgentEnabled,
		};
		this.emitter.fire(event);
	}

	override inspect<T>(key: string) {
		if (key !== ChatConfiguration.AgentEnabled) {
			return { value: undefined };
		}
		const value = this.policyValue !== undefined ? this.policyValue : this.userValue;
		return {
			value: value as T,
			userValue: this.userValue as T | undefined,
			policyValue: this.policyValue as T | undefined,
		};
	}

	dispose(): void {
		this.emitter.dispose();
	}
}
