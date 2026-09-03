/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import type { ConnectionPhase } from '../../../../../platform/universeAgent/common/connectionHubTypes.js';
import type { HubAuthStatus, HubDeviceProjection, HubDirectoryStatus } from '../../../../../platform/universeAgent/common/hub.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IUniverseAgentHubService } from '../../../../../platform/universeAgent/common/hub.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	ConnectionPreferencesPane,
	formatConnectionProbeStatus,
	getConnectionEmptyCopy,
	getConnectionTestStatusText,
	IConnectionProfileEntry,
} from '../../browser/connectionPreferencesPane.js';
import {
	getUnsupportedEnvironmentCopy,
	shouldDrawDesktopConnectionControls,
} from '../../browser/engineSectionChrome.js';
import { createWebUnsupportedCapabilitySnapshot, WEB_UNSUPPORTED_REASON } from '../../../../../platform/universeAgent/browser/webUnsupported.js';
import type { UniverseAgentCapabilitySnapshot, UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	canConnectHubDevice,
	getHubAuthStatusLabel,
	getHubDeviceRowStatusLabel,
	getHubDirectoryBannerLabel,
	SAS_FORBIDDEN_BUTTON_PATTERNS,
} from '../../browser/connectionPreferencesPaneLabels.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { promptSasConfirmDialog } from '../../browser/connectionPreferencesPaneSas.js';
import { getConnectionPhaseStatusBarText, getConversationEngineStatusText } from '../../browser/conversationSessionStatus.js';
import { Dimension } from '../../../../../base/browser/dom.js';

const CONNECTION_EMPTY_COPY = 'No connection profiles yet';
const FAKE_PROFILE_LABELS = ['Local Engine', 'Home Server'];

function device(partial: Partial<HubDeviceProjection> & Pick<HubDeviceProjection, 'id' | 'name'>): HubDeviceProjection {
	return {
		presence: 'ONLINE',
		engineStatus: 'SERVING',
		engineIdentityId: 'engine-id-abcdef01',
		revoked: false,
		...partial,
	};
}

suite('ConnectionPreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHubStub(overrides: Partial<IUniverseAgentHubService> = {}): IUniverseAgentHubService {
		return {
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
			...overrides,
		};
	}

	function createConnectionStub(overrides: Partial<IUniverseAgentConnection> = {}): IUniverseAgentConnection {
		return createConversationConnectionTestStub(overrides);
	}

	function getPaneList(pane: ConnectionPreferencesPane): WorkbenchList<IConnectionProfileEntry> {
		return (pane as unknown as { list: WorkbenchList<IConnectionProfileEntry> }).list;
	}

	function getPaneEntries(pane: ConnectionPreferencesPane): IConnectionProfileEntry[] {
		return (pane as unknown as { entries: IConnectionProfileEntry[] }).entries;
	}

	function mountPane(
		hubOverrides?: Partial<IUniverseAgentHubService>,
		connectionOverrides?: Partial<IUniverseAgentConnection>,
	): ConnectionPreferencesPane {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentHubService, createHubStub(hubOverrides));
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub(connectionOverrides));
		instantiationService.stub(IDialogService, {
			_serviceBrand: undefined,
			prompt: async () => ({ result: false }),
			confirm: async () => ({ confirmed: true }),
			input: async () => ({ confirmed: true, values: ['Renamed Studio'] }),
		} as unknown as IDialogService);
		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		return pane;
	}

	test('getConnectionTestStatusText reuses StatusBar phase copy', () => {
		assert.strictEqual(getConnectionTestStatusText(), getConnectionPhaseStatusBarText({ kind: 'disconnected' }));
		assert.strictEqual(getConnectionTestStatusText({ kind: 'connected', path: 'direct' }), 'Engine · Direct');
		assert.strictEqual(
			formatConnectionProbeStatus({ ok: true, path: 'direct', authority: '203.0.113.1:7443', latencyMs: 42 }),
			'Reachable · direct · 42 ms',
		);
		assert.strictEqual(
			formatConnectionProbeStatus({ ok: false, code: 'transport_failed', reason: 'timeout' }),
			'timeout',
		);
	});

	test('getConnectionEmptyCopy returns honest roster-empty copy', () => {
		assert.strictEqual(getConnectionEmptyCopy(), CONNECTION_EMPTY_COPY);
	});

	test('presence matrix six row labels are distinct and honest', () => {
		const offline = getHubDeviceRowStatusLabel(device({ id: '1', name: 'A', presence: 'OFFLINE', engineStatus: null }));
		const notServing = getHubDeviceRowStatusLabel(device({ id: '2', name: 'B', engineStatus: 'NOT_SERVING' }));
		const available = getHubDeviceRowStatusLabel(device({ id: '3', name: 'C', engineStatus: 'SERVING' }));
		const revoked = getHubDeviceRowStatusLabel(device({ id: '4', name: 'D', revoked: true }));
		const authExpiredBanner = getHubDirectoryBannerLabel({ kind: 'authExpired' });
		const unreachableBanner = getHubDirectoryBannerLabel({ kind: 'unreachable', reason: 'network' });

		assert.strictEqual(offline, 'Offline (unreachable via Hub)');
		assert.strictEqual(notServing, 'Engine unavailable');
		assert.strictEqual(available, 'Available');
		assert.strictEqual(revoked, 'Revoked');
		assert.strictEqual(authExpiredBanner, 'Hub sign-in expired');
		assert.strictEqual(unreachableBanner, 'Hub unreachable');

		const labels = [offline, notServing, available, revoked, authExpiredBanner, unreachableBanner];
		assert.strictEqual(new Set(labels).size, labels.length, 'matrix labels must not alias each other');
	});

	test('canConnectHubDevice respects matrix connect button rules', () => {
		const okDirectory: HubDirectoryStatus = { kind: 'ok', devices: [] };
		assert.strictEqual(canConnectHubDevice(device({ id: '1', name: 'A' }), okDirectory), true);
		assert.strictEqual(canConnectHubDevice(device({ id: '2', name: 'B', presence: 'OFFLINE', engineStatus: null }), okDirectory), false);
		assert.strictEqual(canConnectHubDevice(device({ id: '3', name: 'C', engineStatus: 'NOT_SERVING' }), okDirectory), false);
		assert.strictEqual(canConnectHubDevice(device({ id: '4', name: 'D', revoked: true }), okDirectory), false);
		assert.strictEqual(canConnectHubDevice(device({ id: '5', name: 'E' }), { kind: 'authExpired' }), false);
	});

	test('SAS dialog exposes only confirm and cancel buttons without skip/trust', async () => {
		let capturedButtons: readonly { label: string }[] | undefined;
		const dialogService = {
			_serviceBrand: undefined,
			prompt: async (config: { buttons: readonly { label: string }[] }) => {
				capturedButtons = config.buttons;
				return { result: false };
			},
		} as unknown as IDialogService;

		const result = await promptSasConfirmDialog(dialogService, {
			displayName: 'Home Engine',
			sasCode: '0H4X-JVFQ',
			engineIdentityId: 'abcdef0123456789',
		});

		assert.strictEqual(result.confirmed, false);
		assert.ok(capturedButtons);
		assert.strictEqual(capturedButtons!.length, 2);
		assert.strictEqual(result.buttonLabels.length, 2);

		for (const label of result.buttonLabels) {
			for (const pattern of SAS_FORBIDDEN_BUTTON_PATTERNS) {
				assert.ok(!pattern.test(label), `forbidden SAS button label: ${label}`);
			}
		}
		assert.ok(!/skip|trust|跳过|信任/i.test(result.buttonLabels.join(' ')));
	});

	test('Hub signedIn does not make isEngineConnected true', () => {
		const hub = createHubStub({ getAuthStatus: () => ({ kind: 'signedIn', email: 'a@example.com' }) });
		const connection = createConnectionStub({
			isEngineConnected: () => false,
			getConnectionPhase: () => ({ kind: 'disconnected' }),
		});

		assert.strictEqual(hub.getAuthStatus().kind, 'signedIn');
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getConnectionPhase().kind, 'disconnected');
	});

	test('pane title remains Connection with honest empty welcome', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		const title = container.querySelector('h2') as HTMLElement;
		assert.ok(title);
		assert.strictEqual(title.textContent, 'Connection');

		const emptyWelcome = container.querySelector('.connection-empty-welcome') as HTMLElement;
		assert.ok(emptyWelcome);
		assert.strictEqual(emptyWelcome.textContent, CONNECTION_EMPTY_COPY);

		container.remove();
	});

	test('pane renders four zones including hub account and devices', () => {
		const pane = mountPane({ getAuthStatus: () => ({ kind: 'signedIn', email: 'a@example.com' }) });
		const container = pane.getDomNode();

		assert.ok(container.querySelector('.connection-hub-account'));
		assert.ok(container.querySelector('.connection-hub-devices'));
		assert.ok(container.querySelector('.connection-direct-address'));
		assert.ok(container.querySelector('.connection-profiles'));
		assert.ok(container.querySelector('.connection-test-section'));
		assert.ok(container.querySelector('.connection-remote-io-hint'));

		container.remove();
	});

	test('direct address zone exposes allowPrivateNetwork checkbox default unchecked', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const checkbox = container.querySelector('#connection-allow-private-network') as HTMLInputElement;
		assert.ok(checkbox);
		assert.strictEqual(checkbox.checked, false);
		container.remove();
	});

	test('pane has empty WorkbenchList without service-disconnected wording in welcome', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const list = getPaneList(pane);

		assert.ok(list instanceof WorkbenchList, 'Connection pane must construct WorkbenchList');
		assert.ok(container.querySelector('.connection-list'));
		assert.deepStrictEqual(getPaneEntries(pane), []);
		assert.strictEqual(list.length, 0);

		const emptyWelcome = container.querySelector('.connection-empty-welcome') as HTMLElement;
		const welcomeText = emptyWelcome.textContent ?? '';
		assert.ok(!/not connected/i.test(welcomeText), 'empty welcome must not say not connected');
		assert.ok(!/no engine/i.test(welcomeText), 'empty welcome must not say no engine');

		container.remove();
	});

	test('pane does not seed fake connection profile rows', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		const combined = container.textContent ?? '';

		for (const label of FAKE_PROFILE_LABELS) {
			assert.ok(!combined.includes(label), `pane must not seed fake ${label} row`);
		}

		assert.strictEqual(getPaneEntries(pane).length, 0);
		assert.strictEqual(getPaneList(pane).length, 0);

		container.remove();
	});

	test('Test Connection without active profile keeps honest disconnected copy', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		const testButton = container.querySelector('.connection-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);
		assert.strictEqual(testStatus.textContent, '');

		testButton.click();
		assert.strictEqual(testStatus.textContent, getConnectionTestStatusText());
		assert.notStrictEqual(testStatus.textContent, 'Connected');

		container.remove();
	});

	test('Test active profile calls probeConnectionProfile once', async () => {
		let probedProfileId: string | undefined;
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'profile-1',
				displayName: 'Studio',
				state: 'active',
				hasTrust: true,
				targetKind: 'hubDevice',
			}],
		}, {
			probeConnectionProfile: async profileId => {
				probedProfileId = profileId;
				return { ok: true, path: 'hubRelay', authority: 'relay.example.com', latencyMs: 12 };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'profile-1';

		const testButton = container.querySelector('.connection-test-row .monaco-button') as HTMLButtonElement | null;
		assert.ok(testButton);
		testButton.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(probedProfileId, 'profile-1');
		const status = container.querySelector('.connection-test-status');
		assert.strictEqual(status?.textContent, 'Reachable · hubRelay · 12 ms');
		container.remove();
	});

	test('hub auth badge reflects signed-in state separately from engine phase', () => {
		const pane = mountPane(
			{ getAuthStatus: () => ({ kind: 'signedIn', email: 'user@hub.example' } as HubAuthStatus) },
			{ getConnectionPhase: () => ({ kind: 'disconnected' } as ConnectionPhase) },
		);
		const container = pane.getDomNode();
		const badge = container.querySelector('.connection-hub-auth-badge') as HTMLElement;
		assert.ok(badge);
		assert.strictEqual(badge.textContent, getHubAuthStatusLabel({ kind: 'signedIn', email: 'user@hub.example' }));
		const phase = container.querySelector('.connection-phase-label') as HTMLElement;
		assert.ok(phase);
		assert.strictEqual(phase.textContent, getConnectionPhaseStatusBarText({ kind: 'disconnected' }));
		container.remove();
	});

	test('layout under 600px applies is-narrow from pane width', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		pane.layout(new Dimension(599, 800));
		assert.ok(container.classList.contains('is-narrow'));
		assert.ok(!container.classList.contains('is-compact'));

		pane.layout(new Dimension(299, 800));
		assert.ok(container.classList.contains('is-narrow'));
		assert.ok(container.classList.contains('is-compact'));

		pane.layout(new Dimension(600, 800));
		assert.ok(!container.classList.contains('is-narrow'));
		assert.ok(!container.classList.contains('is-compact'));

		container.remove();
	});

	test('E2-1: desktop disconnected still draws Hub / Direct / Test', () => {
		assert.strictEqual(shouldDrawDesktopConnectionControls({ phase: { kind: 'disconnected' } }), true);

		const pane = mountPane();
		const container = pane.getDomNode();
		const hub = container.querySelector('.connection-hub-account') as HTMLElement;
		const direct = container.querySelector('.connection-direct-address') as HTMLElement;
		const test = container.querySelector('.connection-test-section') as HTMLElement;
		const notice = container.querySelector('.connection-environment-notice') as HTMLElement;

		assert.ok(hub);
		assert.ok(direct);
		assert.ok(test);
		assert.notStrictEqual(hub.style.display, 'none');
		assert.notStrictEqual(direct.style.display, 'none');
		assert.notStrictEqual(test.style.display, 'none');
		assert.strictEqual(notice.style.display, 'none');
		assert.ok(!(hub.textContent ?? '').includes(getUnsupportedEnvironmentCopy()));

		container.remove();
	});

	test('E2-1: Web unsupported_environment omits desktop controls and shows named copy', () => {
		const capabilities = createWebUnsupportedCapabilitySnapshot();
		const snapshot: UniverseAgentConnectionSnapshot = {
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities,
		};

		assert.strictEqual(shouldDrawDesktopConnectionControls({
			phase: { kind: 'disconnected' },
			snapshot,
			capabilities,
		}), false);
		assert.strictEqual(shouldDrawDesktopConnectionControls({
			phase: { kind: 'failed', code: 'unsupported_environment', reason: WEB_UNSUPPORTED_REASON },
		}), false);

		const pane = mountPane(undefined, {
			getConnectionPhase: () => ({ kind: 'disconnected' }),
			getCapabilitySnapshot: () => capabilities as UniverseAgentCapabilitySnapshot,
			getConnectionSnapshot: () => snapshot,
		});
		const container = pane.getDomNode();
		const hub = container.querySelector('.connection-hub-account') as HTMLElement;
		const devices = container.querySelector('.connection-hub-devices') as HTMLElement;
		const direct = container.querySelector('.connection-direct-address') as HTMLElement;
		const test = container.querySelector('.connection-test-section') as HTMLElement;
		const notice = container.querySelector('.connection-environment-notice') as HTMLElement;

		assert.strictEqual(hub.style.display, 'none');
		assert.strictEqual(devices.style.display, 'none');
		assert.strictEqual(direct.style.display, 'none');
		assert.strictEqual(test.style.display, 'none');
		assert.notStrictEqual(notice.style.display, 'none');
		assert.strictEqual(notice.textContent, getUnsupportedEnvironmentCopy());
		assert.strictEqual(getUnsupportedEnvironmentCopy(), '此环境不支持本机 Engine 连接');

		container.remove();
	});

	test('device Connect creates a hubDevice profile then dials it', async () => {
		let added: { readonly hubDeviceId: string; readonly displayName?: string } | undefined;
		let connectedProfileId: string | undefined;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			addHubDeviceProfile: async input => {
				added = input;
				return { ok: true, profileId: 'hub-profile-1' };
			},
		}, {
			connectProfile: async profileId => {
				connectedProfileId = profileId;
				return { ok: true, path: 'hubRelay', pairingPending: false };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const connectButton = container.querySelector('.connection-hub-device-row .monaco-button') as HTMLButtonElement | null;
		assert.ok(connectButton);
		connectButton.click();
		await Promise.resolve();
		await Promise.resolve();

		assert.deepStrictEqual(added, { hubDeviceId: 'dev-1', displayName: 'Studio' });
		assert.strictEqual(connectedProfileId, 'hub-profile-1');
		container.remove();
	});

	test('device Connect failure writes testStatus', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			addHubDeviceProfile: async () => ({ ok: false, code: 'hub_session_required', reason: 'hub session required' }),
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const connectButton = container.querySelector('.connection-hub-device-row .monaco-button') as HTMLButtonElement | null;
		assert.ok(connectButton);
		connectButton.click();
		await Promise.resolve();
		await Promise.resolve();

		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(testStatus.textContent, 'hub session required');
		container.remove();
	});

	test('SAS cancel calls cancelPairing once', async () => {
		let cancelCalls = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			listConnectionProfiles: () => [{
				profileId: 'hub-profile-1',
				displayName: 'Studio',
				state: 'pairingPending',
				hasTrust: false,
				targetKind: 'hubDevice',
			}],
		}, {
			connectProfile: async () => ({
				ok: true,
				path: 'hubRelay',
				pairingPending: true,
				sasCode: 'ABCD-EFGH',
				engineIdentityId: '0123456789abcdef',
			}),
			cancelPairing: async () => {
				cancelCalls++;
			},
		});
		const container = pane.getDomNode();
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'hub-profile-1';
		await (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('hub-profile-1');
		assert.strictEqual(cancelCalls, 1);
		container.remove();
	});

	test('SAS confirm calls confirmPairing once with handshake sasCode', async () => {
		let confirmCalls = 0;
		const handshakeSas = 'ABCD-EFGH';
		const handshakeEngineId = '0123456789abcdef';
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentHubService, createHubStub({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			listConnectionProfiles: () => [{
				profileId: 'hub-profile-1',
				displayName: 'Studio',
				state: 'pairingPending',
				hasTrust: false,
				targetKind: 'hubDevice',
			}],
		}));
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub({
			connectProfile: async () => ({
				ok: true,
				path: 'hubRelay',
				pairingPending: true,
				sasCode: handshakeSas,
				engineIdentityId: handshakeEngineId,
			}),
			confirmPairing: async () => {
				confirmCalls++;
				return { ok: true, path: 'hubRelay', pairingPending: false, sessionToken: 'tok' };
			},
		}));
		instantiationService.stub(IDialogService, {
			_serviceBrand: undefined,
			prompt: async (config: { detail?: string; buttons: readonly { run: () => boolean }[] }) => {
				assert.ok(config.detail?.includes(handshakeSas));
				assert.ok(!config.detail?.includes('directory-engine-id'));
				return { result: config.buttons[0].run() };
			},
		} as unknown as IDialogService);

		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'hub-profile-1';
		await (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('hub-profile-1');
		assert.strictEqual(confirmCalls, 1);
		container.remove();
	});

	test('revoked device row disables Rename and Revoke', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({
				kind: 'ok',
				devices: [device({ id: 'dev-1', name: 'Studio', revoked: true })],
			}),
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const rename = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Rename') as HTMLButtonElement | undefined;
		const revoke = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Revoke') as HTMLButtonElement | undefined;
		assert.ok(rename);
		assert.ok(revoke);
		assert.strictEqual(rename.disabled, true);
		assert.strictEqual(revoke.disabled, true);
		container.remove();
	});

	test('device Rename cancel does not call hub rename', async () => {
		let renamed = false;
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentHubService, createHubStub({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			renameDevice: async () => {
				renamed = true;
				return { ok: true };
			},
		}));
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub());
		instantiationService.stub(IDialogService, {
			_serviceBrand: undefined,
			prompt: async () => ({ result: false }),
			confirm: async () => ({ confirmed: true }),
			input: async () => ({ confirmed: false, values: ['Studio'] }),
		} as unknown as IDialogService);
		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const rename = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Rename') as HTMLButtonElement | undefined;
		assert.ok(rename);
		rename.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(renamed, false);
		container.remove();
	});

	test('device Revoke confirm rejected does not call hub revoke', async () => {
		let revoked = false;
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentHubService, createHubStub({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			revokeDevice: async () => {
				revoked = true;
				return { ok: true };
			},
		}));
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub());
		instantiationService.stub(IDialogService, {
			_serviceBrand: undefined,
			prompt: async () => ({ result: false }),
			confirm: async () => ({ confirmed: false }),
			input: async () => ({ confirmed: true, values: ['Renamed Studio'] }),
		} as unknown as IDialogService);
		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const revoke = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Revoke') as HTMLButtonElement | undefined;
		assert.ok(revoke);
		revoke.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(revoked, false);
		container.remove();
	});

	test('confirmDeviceCode success clears input', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			confirmDeviceCode: async () => ({ ok: true }),
		});
		const container = pane.getDomNode();
		const codeInput = container.querySelector('.connection-hub-device-code input') as HTMLInputElement | null;
		const confirm = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === 'Confirm') as HTMLButtonElement | undefined;
		assert.ok(codeInput);
		assert.ok(confirm);
		codeInput.value = 'ABCD-1234';
		confirm.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(codeInput.value, '');
		container.remove();
	});

	test('device Rename / Revoke / Confirm call hub methods', async () => {
		let renamed: { id: string; name: string } | undefined;
		let revoked: string | undefined;
		let confirmed: string | undefined;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			renameDevice: async (id, name) => {
				renamed = { id, name };
				return { ok: true };
			},
			revokeDevice: async id => {
				revoked = id;
				return { ok: true };
			},
			confirmDeviceCode: async code => {
				confirmed = code;
				return { ok: true };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const rename = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Rename') as HTMLButtonElement | undefined;
		const revoke = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Revoke') as HTMLButtonElement | undefined;
		const confirm = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === 'Confirm') as HTMLButtonElement | undefined;
		const codeInput = container.querySelector('.connection-hub-device-code input') as HTMLInputElement | null;
		assert.ok(rename);
		assert.ok(revoke);
		assert.ok(confirm);
		assert.ok(codeInput);

		rename.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(renamed, { id: 'dev-1', name: 'Renamed Studio' });

		revoke.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(revoked, 'dev-1');

		codeInput.value = 'ABCD-1234';
		confirm.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(confirmed, 'ABCD-1234');
		container.remove();
	});
});

suite('Conversation Session StatusBar H4a negative', () => {
	test('engine status copy stays not connected before H4b phase wiring', () => {
		assert.strictEqual(getConversationEngineStatusText(), 'Engine not connected');
	});
});
