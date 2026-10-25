/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IUniverseAgentHubService } from '../../../../platform/universeAgent/common/hub.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentListDevicesResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { ConnectionPreferencesPane } from './connectionPreferencesPane.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';
import { Dimension } from '../../../../base/browser/dom.js';

suite('ConnectionPreferencesPane (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listDevices after dispose does not paint hub device rows', async () => {
		let resolveList!: (value: UniverseAgentListDevicesResult) => void;
		const listDevices = new Promise<UniverseAgentListDevicesResult>(resolve => {
			resolveList = resolve;
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			listDevices: () => listDevices,
		});

		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentHubService, {
			_serviceBrand: undefined,
			getActiveHubBaseUrl: () => undefined,
			setActiveHubBaseUrl: () => { },
			getAuthStatus: () => ({ kind: 'signedOut' }),
			getDirectoryStatus: () => ({ kind: 'idle' }),
			listConnectionProfiles: () => [],
			onDidChangeAuthStatus: Event.None,
			onDidChangeDirectory: Event.None,
			onDidChangeProfiles: Event.None,
			login: async () => ({ ok: true }),
			logout: async () => { },
			changePassword: async () => ({ ok: true }),
			refreshDirectory: async () => ({ kind: 'idle' }),
			renameDevice: async () => ({ ok: true }),
			revokeDevice: async () => ({ ok: true }),
			confirmDeviceCode: async () => ({ ok: true }),
			addDirectAddressProfile: async () => ({ ok: true, profileId: 'direct-profile-1' }),
			addHubDeviceProfile: async () => ({ ok: true, profileId: 'hub-profile-1' }),
			forgetConnectionProfile: async () => ({ ok: true }),
			isEncryptionAvailable: async () => true,
		});
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		instantiationService.stub(IDialogService, {
			_serviceBrand: undefined,
			prompt: async () => ({ result: false }),
			confirm: async () => ({ confirmed: true }),
			input: async () => ({ confirmed: true, values: ['Renamed Studio'] }),
		} as unknown as IDialogService);

		const pane = instantiationService.createInstance(ConnectionPreferencesPane);
		container.appendChild(pane.getDomNode());
		pane.layout(new Dimension(800, 800));
		await timeout(0);

		pane.dispose();

		resolveList({
			devices: [{
				deviceId: 'eng-late',
				displayName: 'late-after-dispose',
				role: '',
				platform: '',
				pairedAt: 0,
				lastSeenAt: 0,
				active: false,
			}],
		});
		await timeout(0);

		assert.ok(!(pane.getDomNode().textContent ?? '').includes('late-after-dispose'));
	});

	test('late probeEngine after dispose does not paint test status', async () => {
		let resolveProbe!: (value: { ok: true; engineIdentityId: string }) => void;
		const probe = new Promise<{ ok: true; engineIdentityId: string }>(resolve => {
			resolveProbe = resolve;
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			probeEngine: () => probe,
		});

		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentHubService, {
			_serviceBrand: undefined,
			getActiveHubBaseUrl: () => undefined,
			setActiveHubBaseUrl: () => { },
			getAuthStatus: () => ({ kind: 'signedOut' }),
			getDirectoryStatus: () => ({ kind: 'idle' }),
			listConnectionProfiles: () => [],
			onDidChangeAuthStatus: Event.None,
			onDidChangeDirectory: Event.None,
			onDidChangeProfiles: Event.None,
			login: async () => ({ ok: true }),
			logout: async () => { },
			changePassword: async () => ({ ok: true }),
			refreshDirectory: async () => ({ kind: 'idle' }),
			renameDevice: async () => ({ ok: true }),
			revokeDevice: async () => ({ ok: true }),
			confirmDeviceCode: async () => ({ ok: true }),
			addDirectAddressProfile: async () => ({ ok: true, profileId: 'direct-profile-1' }),
			addHubDeviceProfile: async () => ({ ok: true, profileId: 'hub-profile-1' }),
			forgetConnectionProfile: async () => ({ ok: true }),
			isEncryptionAvailable: async () => true,
		});
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		instantiationService.stub(IDialogService, {
			_serviceBrand: undefined,
			prompt: async () => ({ result: false }),
			confirm: async () => ({ confirmed: true }),
			input: async () => ({ confirmed: true, values: ['Renamed Studio'] }),
		} as unknown as IDialogService);

		const pane = instantiationService.createInstance(ConnectionPreferencesPane);
		container.appendChild(pane.getDomNode());
		pane.layout(new Dimension(800, 800));
		pane.selectZone('test');

		const testButton = pane.getDomNode().querySelector('.connection-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = pane.getDomNode().querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);

		testButton.click();
		await timeout(0);

		pane.dispose();

		resolveProbe({ ok: true, engineIdentityId: 'late-engine' });
		await timeout(0);

		assert.ok(!(testStatus.textContent ?? '').includes('Reachable'));
	});

	test('narrow navigation returns focus to Back when opening a detail section', async () => {
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
		});
		const container = document.createElement('div');
		document.body.appendChild(container);
		store.add({ dispose: () => container.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const pane = instantiationService.createInstance(ConnectionPreferencesPane);
		container.appendChild(pane.getDomNode());
		pane.layout(new Dimension(480, 600));

		const backButton = pane.getDomNode().querySelector('.connection-preferences-back') as HTMLButtonElement;
		backButton.click();
		const navHost = pane.getDomNode().querySelector('.connection-preferences-nav') as HTMLElement;
		const navFocusProbe = document.createElement('button');
		navFocusProbe.type = 'button';
		navHost.appendChild(navFocusProbe);
		navFocusProbe.focus();

		// The Back button is the first reachable control after the nav is hidden.
		pane.selectZone('direct');
		await timeout(0);
		assert.strictEqual(backButton.hidden, false);
		assert.strictEqual(document.activeElement, backButton);
		assert.strictEqual(pane.getDomNode().classList.contains('is-showing-detail'), true);
	});
});
