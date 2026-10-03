/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IDefaultAccount } from '../../../../../base/common/defaultAccount.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { ConfigurationTarget, IConfigurationChangeEvent, IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { IDefaultAccountService, IManagedSettingsCompatibilityError, MANAGED_SETTINGS_UPDATE_REQUIRED_ERROR_CODE } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IOpenerService } from '../../../../../platform/opener/common/opener.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { ChatConfiguration } from '../../../../../workbench/contrib/chat/common/constants.js';
import { IWorkbenchLayoutService } from '../../../../../workbench/services/layout/browser/layoutService.js';
import { AccountPolicyGateState, AccountPolicyGateUnsatisfiedReason, IAccountPolicyGateInfo, IAccountPolicyGateService } from '../../../../../workbench/services/policies/common/accountPolicyService.js';
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
			override readonly managedSettingsCompatibilityError = null;
			override readonly onDidChangeManagedSettingsCompatibilityError = Event.None;
			override readonly onDidChangeDefaultAccount = Event.None;
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

	test('client update required blocks even when the freshness gate is inactive, names the version, and clears', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const account = store.add(new CompatibilityAccount());
		const gate = store.add(new MutableGate());
		const commands: string[] = [];
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConfigurationService, new class extends mock<IConfigurationService>() {
			override readonly onDidChangeConfiguration = Event.None;
			override inspect() {
				return { value: true, policyValue: undefined };
			}
		}());
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() {
			override executeCommand(id: string): Promise<undefined> {
				commands.push(id);
				return Promise.resolve(undefined);
			}
		}());
		instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { }());
		instantiationService.stub(IProductService, new class extends mock<IProductService>() {
			override readonly nameShort = 'Agents';
			override readonly urlProtocol = 'universe-agent';
		}());
		instantiationService.stub(IDefaultAccountService, account);
		instantiationService.stub(IAccountPolicyGateService, gate);
		instantiationService.stub(IWorkbenchLayoutService, new class extends mock<IWorkbenchLayoutService>() {
			override readonly mainContainer = container;
		}());

		store.add(instantiationService.createInstance(SessionsPolicyBlockedContribution));
		assert.strictEqual(container.querySelector('.sessions-policy-blocked-overlay'), null);

		account.setError({ errorCode: MANAGED_SETTINGS_UPDATE_REQUIRED_ERROR_CODE, minimumClientVersion: '1.135.0' });
		let overlay = container.querySelector('.sessions-policy-blocked-overlay');
		assert.ok(overlay);
		assert.strictEqual(overlay.querySelector('h2')?.textContent, 'Update Required');
		assert.ok(overlay.textContent?.includes('Update Agents to version 1.135.0 or later before starting an agent.'));
		assert.ok(!overlay.textContent?.includes('octocat'));
		assert.deepStrictEqual(
			[...overlay.querySelectorAll('.monaco-button')].map(button => button.textContent),
			['Check for Updates', 'Open VS Code'],
		);
		assert.strictEqual(document.activeElement?.textContent, 'Check for Updates');
		(document.activeElement as HTMLElement).click();
		assert.deepStrictEqual(commands, ['update.checkForUpdate']);

		gate.setGate({
			state: AccountPolicyGateState.Restricted,
			reason: AccountPolicyGateUnsatisfiedReason.OrgNotApproved,
			approvedOrganizations: ['github'],
		});
		overlay = container.querySelector('.sessions-policy-blocked-overlay');
		assert.ok(overlay);
		assert.strictEqual(overlay.querySelector('h2')?.textContent, 'Update Required');
		assert.ok(!overlay.textContent?.includes('octocat'));

		account.setError(null);
		overlay = container.querySelector('.sessions-policy-blocked-overlay');
		assert.ok(overlay);
		assert.strictEqual(overlay.querySelector('h2')?.textContent, 'Sign-In Required');
		assert.ok(overlay.textContent?.includes('octocat'));
	});

	test('another unapproved account replaces the named account without a gate change, then a satisfied gate clears the overlay', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const account = store.add(new MutableAccount('octocat'));
		const gate = store.add(new MutableGate({
			state: AccountPolicyGateState.Restricted,
			reason: AccountPolicyGateUnsatisfiedReason.OrgNotApproved,
			approvedOrganizations: ['github'],
		}));
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConfigurationService, new class extends mock<IConfigurationService>() {
			override readonly onDidChangeConfiguration = Event.None;
			override inspect() {
				return { value: true, policyValue: undefined };
			}
		}());
		instantiationService.stub(ICommandService, new class extends mock<ICommandService>() { }());
		instantiationService.stub(IOpenerService, new class extends mock<IOpenerService>() { }());
		instantiationService.stub(IDefaultAccountService, account);
		instantiationService.stub(IAccountPolicyGateService, gate);
		instantiationService.stub(IWorkbenchLayoutService, new class extends mock<IWorkbenchLayoutService>() {
			override readonly mainContainer = container;
		}());

		store.add(instantiationService.createInstance(SessionsPolicyBlockedContribution));

		const read = () => {
			const overlay = container.querySelector('.sessions-policy-blocked-overlay');
			return {
				title: overlay?.querySelector('h2')?.textContent ?? null,
				description: overlay?.querySelector('p')?.textContent ?? null,
				blocked: container.classList.contains('sessions-policy-blocked'),
			};
		};
		const seen = [read()];
		const painted = container.querySelector('.sessions-policy-blocked-overlay');
		account.setAccountName('octocat');
		const unchanged = container.querySelector('.sessions-policy-blocked-overlay') === painted;
		account.setAccountName('hubot');
		seen.push(read());
		gate.setGate({ state: AccountPolicyGateState.Satisfied, approvedOrganizations: ['github'] });
		seen.push(read());

		assert.deepStrictEqual({ unchanged, seen }, {
			unchanged: true,
			seen: [
				{
					title: 'Sign-In Required',
					description: 'The account "octocat" is not a member of an organization that your administrator allows for Agents.',
					blocked: true,
				},
				{
					title: 'Sign-In Required',
					description: 'The account "hubot" is not a member of an organization that your administrator allows for Agents.',
					blocked: true,
				},
				{
					title: null,
					description: null,
					blocked: false,
				},
			],
		});
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

class CompatibilityAccount extends mock<IDefaultAccountService>() {
	private readonly emitter = new Emitter<IManagedSettingsCompatibilityError | null>();
	readonly onDidChangeManagedSettingsCompatibilityError = this.emitter.event;
	private error: IManagedSettingsCompatibilityError | null = null;

	get managedSettingsCompatibilityError(): IManagedSettingsCompatibilityError | null {
		return this.error;
	}

	override readonly onDidChangeDefaultAccount = Event.None;
	override currentDefaultAccount: IDefaultAccount | null = {
		authenticationProvider: { id: 'github', name: 'GitHub', enterprise: false },
		accountName: 'octocat',
		sessionId: 'session',
		enterprise: false,
	};

	setError(error: IManagedSettingsCompatibilityError | null): void {
		this.error = error;
		this.emitter.fire(error);
	}

	dispose(): void {
		this.emitter.dispose();
	}
}

class MutableAccount extends mock<IDefaultAccountService>() {
	private readonly emitter = new Emitter<IDefaultAccount | null>();
	readonly onDidChangeDefaultAccount = this.emitter.event;
	readonly onDidChangeManagedSettingsCompatibilityError = Event.None;
	readonly managedSettingsCompatibilityError = null;
	currentDefaultAccount: IDefaultAccount | null;

	constructor(accountName: string) {
		super();
		this.currentDefaultAccount = this.account(accountName);
	}

	setAccountName(accountName: string): void {
		this.currentDefaultAccount = this.account(accountName);
		this.emitter.fire(this.currentDefaultAccount);
	}

	private account(accountName: string): IDefaultAccount {
		return {
			authenticationProvider: { id: 'github', name: 'GitHub', enterprise: false },
			accountName,
			sessionId: 'session',
			enterprise: false,
		};
	}

	dispose(): void {
		this.emitter.dispose();
	}
}

class MutableGate extends mock<IAccountPolicyGateService>() {
	private readonly emitter = new Emitter<IAccountPolicyGateInfo>();
	readonly onDidChangeGateInfo = this.emitter.event;
	private info: IAccountPolicyGateInfo;

	constructor(initial: IAccountPolicyGateInfo = { state: AccountPolicyGateState.Inactive }) {
		super();
		this.info = initial;
	}

	get gateInfo(): IAccountPolicyGateInfo {
		return this.info;
	}

	setGate(info: IAccountPolicyGateInfo): void {
		this.info = info;
		this.emitter.fire(info);
	}

	dispose(): void {
		this.emitter.dispose();
	}
}
