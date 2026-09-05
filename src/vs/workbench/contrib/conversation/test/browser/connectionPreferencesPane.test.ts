/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
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
	directAddressEndpointLabel,
	findDirectAddressProfilesForEndpoint,
	formatConnectProfileDiagnostics,
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
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentConnectionSnapshot,
	UniverseAgentListDevicesResult,
	UniverseAgentPairApproveRequest,
	UniverseAgentPairRejectRequest,
	UniverseAgentRevokeRequest,
	UniverseAgentRotateTokenRequest,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	CONNECTION_DEVICE_ROTATE_TOKEN_LABEL,
} from '../../browser/connectionDeviceList.js';
import {
	CONNECTION_DEVICE_PAIR_REJECT_LABEL,
	CONNECTION_DEVICE_PENDING_EMPTY_COPY,
} from '../../browser/connectionDevicePair.js';
import {
	canConnectHubDevice,
	getHubAuthStatusLabel,
	getHubDeviceRowStatusLabel,
	getHubDirectoryBannerLabel,
	isRecoverTrustConnectResult,
	RECOVER_TRUST_CONFIRM_BUTTON_LABEL,
	isForbiddenSasButtonLabel,
	SAS_CONFIRM_BUTTON_LABEL,
	SAS_FORBIDDEN_BUTTON_PATTERNS,
} from '../../browser/connectionPreferencesPaneLabels.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';
import { promptSasConfirmDialog, promptSasConfirmInPane } from '../../browser/connectionPreferencesPaneSas.js';
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

	function getPairingConfirmButtons(container: ParentNode): readonly HTMLButtonElement[] {
		return Array.from(container.querySelectorAll('.connection-pairing-confirm .dialog-buttons .monaco-button')) as HTMLButtonElement[];
	}

	function clickPairingConfirm(container: ParentNode): void {
		const buttons = getPairingConfirmButtons(container);
		assert.ok(buttons[0], 'pairing confirm button must be visible');
		buttons[0].click();
	}

	function clickPairingCancel(container: ParentNode): void {
		const buttons = getPairingConfirmButtons(container);
		assert.ok(buttons[1], 'pairing cancel button must be visible');
		buttons[1].click();
	}

	function mountPaneInPreferencesModal(
		hubOverrides?: Partial<IUniverseAgentHubService>,
		connectionOverrides?: Partial<IUniverseAgentConnection>,
	): { readonly pane: ConnectionPreferencesPane; readonly modalBlock: HTMLElement } {
		const modalBlock = document.createElement('div');
		modalBlock.className = 'monaco-modal-editor-block';
		modalBlock.style.overflow = 'hidden';
		document.body.appendChild(modalBlock);
		const pane = mountPane(hubOverrides, connectionOverrides);
		modalBlock.appendChild(pane.getDomNode());
		return { pane, modalBlock };
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
		assert.strictEqual(
			formatConnectionProbeStatus({ ok: true, engineIdentityId: 'eng' }, 'Engine · Direct'),
			'Reachable — Engine · Direct',
		);
		assert.strictEqual(
			formatConnectionProbeStatus({ ok: false, reason: 'timeout' }, 'Engine not connected'),
			'Unreachable — timeout',
		);
	});

	test('getConnectionEmptyCopy returns honest roster-empty copy', () => {
		assert.strictEqual(getConnectionEmptyCopy(), CONNECTION_EMPTY_COPY);
	});

	test('listConnectionProfiles returning a Promise does not throw while rendering', () => {
		const pane = mountPane({
			listConnectionProfiles: () => Promise.resolve([]) as unknown as [],
		});
		assert.deepStrictEqual(getPaneEntries(pane), []);
		pane.getDomNode().remove();
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
			assert.ok(!isForbiddenSasButtonLabel(label), `forbidden SAS button label: ${label}`);
		}
		assert.ok(!isForbiddenSasButtonLabel(SAS_CONFIRM_BUTTON_LABEL));
	});

	test('SAS in-pane confirm exposes monaco-dialog-box with confirm and cancel only', async () => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const flow = promptSasConfirmDialog({ prompt: async () => ({ result: false }) } as unknown as IDialogService, {
			displayName: 'Home Engine',
			sasCode: '0H4X-JVFQ',
			engineIdentityId: 'abcdef0123456789',
		}, host);
		await Promise.resolve();
		const dialogBox = host.querySelector('.monaco-dialog-box');
		assert.ok(dialogBox);
		const buttons = getPairingConfirmButtons(host);
		assert.strictEqual(buttons.length, 2);
		clickPairingCancel(host);
		const result = await flow;
		assert.strictEqual(result.confirmed, false);
		host.remove();
	});

	test('SAS confirm button label rejects skip/trust primary actions only', () => {
		assert.ok(isForbiddenSasButtonLabel('Skip'));
		assert.ok(isForbiddenSasButtonLabel('Trust this Engine'));
		assert.ok(isForbiddenSasButtonLabel('跳过配对'));
		assert.ok(isForbiddenSasButtonLabel('信任并继续'));
		assert.ok(!isForbiddenSasButtonLabel(SAS_CONFIRM_BUTTON_LABEL));
		assert.ok(!isForbiddenSasButtonLabel('已在 Engine 上验证'));
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

	test('findDirectAddressProfilesForEndpoint matches canonical host:port label only', () => {
		const profiles = [
			{
				profileId: 'direct-1',
				displayName: '127.0.0.1:50061',
				state: 'active' as const,
				hasTrust: true,
				targetKind: 'directAddress' as const,
			},
			{
				profileId: 'direct-2',
				displayName: 'debug-engine',
				state: 'active' as const,
				hasTrust: true,
				targetKind: 'directAddress' as const,
			},
			{
				profileId: 'hub-1',
				displayName: '127.0.0.1:50061',
				state: 'active' as const,
				hasTrust: true,
				targetKind: 'hubDevice' as const,
			},
		];
		assert.deepStrictEqual(
			findDirectAddressProfilesForEndpoint(profiles, '127.0.0.1', 50061).map(p => p.profileId),
			['direct-1'],
		);
		assert.deepStrictEqual(
			findDirectAddressProfilesForEndpoint(profiles, '127.0.0.1', 50061, 'debug-engine').map(p => p.profileId),
			['direct-1', 'direct-2'],
		);
		assert.strictEqual(directAddressEndpointLabel('127.0.0.1', 50061), '127.0.0.1:50061');
	});

	test('Direct Connect forgets existing endpoint profile and recreates with allowPrivateNetwork', async () => {
		let addCalls = 0;
		const forgotIds: string[] = [];
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'direct-old',
				displayName: '127.0.0.1:50061',
				state: 'active',
				hasTrust: true,
				targetKind: 'directAddress',
			}],
			forgetConnectionProfile: async profileId => {
				forgotIds.push(profileId);
				return { ok: true };
			},
			addDirectAddressProfile: async input => {
				addCalls++;
				assert.strictEqual(input.host, '127.0.0.1');
				assert.strictEqual(input.port, 50061);
				assert.strictEqual(input.allowPrivateNetwork, true);
				return { ok: true, profileId: 'direct-new' };
			},
		}, {
			connectProfile: async profileId => {
				assert.strictEqual(profileId, 'direct-new');
				return { ok: true, path: 'direct', pairingPending: false };
			},
		});
		const container = pane.getDomNode();
		const hostInput = (pane as unknown as { directHostInput: HTMLInputElement }).directHostInput;
		const portInput = (pane as unknown as { directPortInput: HTMLInputElement }).directPortInput;
		const allowPrivate = (pane as unknown as { directAllowPrivateCheckbox: HTMLInputElement }).directAllowPrivateCheckbox;
		hostInput.value = '127.0.0.1';
		portInput.value = '50061';
		allowPrivate.checked = true;
		await (pane as unknown as { handleConnectDirectAddress(): Promise<void> }).handleConnectDirectAddress();
		assert.deepStrictEqual(forgotIds, ['direct-old']);
		assert.strictEqual(addCalls, 1);
		const testStatus = (pane as unknown as { testStatus: HTMLElement }).testStatus;
		assert.ok(testStatus.textContent?.includes('ok=true'), `testStatus=${testStatus.textContent}`);
		assert.ok(testStatus.textContent?.includes('pairingPending=false'));
		container.remove();
	});

	test('formatConnectProfileDiagnostics omits SAS secrets', () => {
		const text = formatConnectProfileDiagnostics({
			ok: true,
			path: 'direct',
			pairingPending: true,
			sasCode: 'ABCD-EFGH',
			engineIdentityId: '0123456789abcdef',
		});
		assert.ok(text.includes('hasSas=true'));
		assert.ok(!text.includes('ABCD-EFGH'));
		assert.ok(!text.includes('0123456789abcdef'));
	});

	test('connectProfileWithPairing writes diagnostics when pairing not pending', async () => {
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'direct-profile-1',
				displayName: '127.0.0.1:50061',
				state: 'active',
				hasTrust: true,
				targetKind: 'directAddress',
			}],
		}, {
			connectProfile: async () => ({
				ok: true,
				path: 'direct',
				pairingPending: false,
			}),
		});
		const container = pane.getDomNode();
		document.body.appendChild(container);
		await (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('direct-profile-1');
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(testStatus.textContent, 'ok=true pairingPending=false hasSas=false recoverTrust=false');
		container.remove();
	});

	test('connectProfileWithPairing surfaces profile pairingPending mismatch as visible failure', async () => {
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'direct-profile-1',
				displayName: 'debug-engine',
				state: 'pairingPending',
				hasTrust: false,
				targetKind: 'directAddress',
			}],
		}, {
			connectProfile: async () => ({
				ok: true,
				path: 'direct',
				pairingPending: false,
			}),
		});
		const container = pane.getDomNode();
		document.body.appendChild(container);
		await (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('direct-profile-1');
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testStatus.textContent?.includes('still pairing pending'));
		assert.ok(testStatus.textContent?.includes('profilePairingPending=true'));
		assert.ok(testStatus.textContent?.includes('pairingPending=false'));
		container.remove();
	});

	test('connectProfileWithPairing records pairing prompt throw in testStatus diagnostics', async () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentHubService, createHubStub({
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
				sasCode: 'ABCD-EFGH',
				engineIdentityId: '0123456789abcdef',
			}),
			cancelPairing: async () => { },
		}));
		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		const brokenHost = document.createElement('div');
		brokenHost.append = (() => {
			throw new Error('dialog exploded');
		}) as typeof brokenHost.append;
		(pane as unknown as { pairingConfirmHost: HTMLElement }).pairingConfirmHost = brokenHost;
		await (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('hub-profile-1');
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testStatus.textContent?.includes('dialogError=dialog exploded'));
		assert.ok(testStatus.textContent?.includes('hasSas=true'));
		assert.ok(!testStatus.textContent?.includes('ABCD-EFGH'));
		container.remove();
	});

	test('promptSasConfirmInPane propagates render failures', async () => {
		const host = document.createElement('div');
		host.append = (() => {
			throw new Error('dialog exploded');
		}) as typeof host.append;
		await assert.rejects(
			() => promptSasConfirmInPane(host, {
				displayName: 'Studio',
				sasCode: 'ABCD-EFGH',
				engineIdentityId: '0123456789abcdef',
			}),
			/dialog exploded/,
		);
	});

	test('connectProfileWithPairing writes diagnostics before pairing prompt resolves', async () => {
		let resolveConnect: ((value: { ok: true; path: 'direct'; pairingPending: true; sasCode: string; engineIdentityId: string }) => void) | undefined;
		const connectPromise = new Promise<{ ok: true; path: 'direct'; pairingPending: true; sasCode: string; engineIdentityId: string }>(resolve => {
			resolveConnect = resolve;
		});
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'direct-profile-1',
				displayName: 'debug-engine',
				state: 'pairingPending',
				hasTrust: false,
				targetKind: 'directAddress',
			}],
		}, {
			connectProfile: async () => connectPromise,
		});
		const container = pane.getDomNode();
		const flow = (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('direct-profile-1');
		await Promise.resolve();
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(testStatus.textContent, 'Connecting…');
		resolveConnect!({
			ok: true,
			path: 'direct',
			pairingPending: true,
			sasCode: 'ABCD-EFGH',
			engineIdentityId: '0123456789abcdef',
		});
		await Promise.resolve();
		await Promise.resolve();
		assert.ok(testStatus.textContent?.includes('ok=true'));
		assert.ok(testStatus.textContent?.includes('pairingPending=true'));
		assert.ok(testStatus.textContent?.includes('hasSas=true'));
		assert.ok(!testStatus.textContent?.includes('ABCD-EFGH'));
		assert.ok(container.querySelector('.connection-pairing-confirm .monaco-dialog-box'));
		clickPairingCancel(container);
		await flow;
		container.remove();
	});

	test('pairing confirm completes inside Preferences modal block', async () => {
		let confirmCalls = 0;
		const handshakeSas = 'ABCD-EFGH';
		const { pane, modalBlock } = mountPaneInPreferencesModal({
			listConnectionProfiles: () => [{
				profileId: 'direct-profile-1',
				displayName: 'debug-engine',
				state: 'pairingPending',
				hasTrust: false,
				targetKind: 'directAddress',
			}],
		}, {
			connectProfile: async () => ({
				ok: true,
				path: 'direct',
				pairingPending: true,
				sasCode: handshakeSas,
				engineIdentityId: '0123456789abcdef',
			}),
			confirmPairing: async () => {
				confirmCalls++;
				return { ok: true, path: 'direct', pairingPending: false, sessionToken: 'tok' };
			},
		});
		const container = pane.getDomNode();
		const flow = (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('direct-profile-1');
		await Promise.resolve();
		const dialogBox = modalBlock.querySelector('.connection-pairing-confirm .monaco-dialog-box') as HTMLElement;
		assert.ok(dialogBox);
		assert.ok(dialogBox.textContent?.includes(handshakeSas));
		clickPairingConfirm(container);
		await flow;
		assert.strictEqual(confirmCalls, 1);
		modalBlock.remove();
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

	test('Test Connection without active profile keeps honest disconnected copy', async () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		const testButton = container.querySelector('.connection-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);
		assert.strictEqual(testStatus.textContent, '');

		testButton.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(testStatus.textContent, 'Unreachable — stub');
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
		assert.ok(!container.classList.contains('is-showing-detail'));

		container.remove();
	});

	test('layout under 600px shows Back and returns to zone nav', () => {
		const pane = mountPane();
		const container = pane.getDomNode();

		pane.layout(new Dimension(599, 800));
		assert.ok(container.classList.contains('is-narrow'));
		assert.ok(container.classList.contains('is-showing-detail'));
		assert.strictEqual(container.querySelector('button[data-zone="hub"]')?.getAttribute('aria-current'), 'true');
		const back = container.querySelector('.connection-preferences-back') as HTMLButtonElement;
		assert.ok(back);
		assert.strictEqual(back.hidden, false);
		assert.ok(container.querySelector('.connection-hub-account.is-active-zone'));

		back.click();
		assert.ok(!container.classList.contains('is-showing-detail'));
		assert.strictEqual(back.hidden, true);
		const nav = container.querySelector('.connection-preferences-nav') as HTMLElement;
		assert.ok(nav);
		const hubNav = nav.querySelector('button[data-zone="hub"]') as HTMLButtonElement;
		assert.ok(hubNav);
		hubNav.click();
		assert.ok(container.classList.contains('is-showing-detail'));
		assert.strictEqual(back.hidden, false);
		const body = container.querySelector('.connection-preferences-body') as HTMLElement;
		assert.ok(body);
		assert.ok(!body.contains(back));
		assert.ok(body.contains(container.querySelector('.connection-hub-account')));

		container.remove();
	});

	test('narrow Devices nav appears after Hub sign-in without resize', () => {
		let auth: HubAuthStatus = { kind: 'signedOut' };
		const onDidChangeAuthStatus = store.add(new Emitter<HubAuthStatus>());
		const pane = mountPane({
			getAuthStatus: () => auth,
			onDidChangeAuthStatus: onDidChangeAuthStatus.event,
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(599, 800));
		const devicesNav = container.querySelector('button[data-zone="devices"]') as HTMLButtonElement;
		assert.ok(devicesNav);
		assert.strictEqual(devicesNav.hidden, true);

		auth = { kind: 'signedIn', email: 'user@hub.example' };
		onDidChangeAuthStatus.fire(auth);
		assert.strictEqual(devicesNav.hidden, false);

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
		const flow = (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('hub-profile-1');
		await Promise.resolve();
		clickPairingCancel(container);
		await flow;
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
			prompt: async () => {
				throw new Error('dialogService must not be used for pairing inside Connection pane');
			},
		} as unknown as IDialogService);

		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'hub-profile-1';
		const flow = (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('hub-profile-1');
		await Promise.resolve();
		const detail = container.querySelector('.connection-pairing-confirm .dialog-message-detail') as HTMLElement;
		assert.ok(detail?.textContent?.includes(handshakeSas));
		assert.ok(!detail?.textContent?.includes('directory-engine-id'));
		clickPairingConfirm(container);
		await flow;
		assert.strictEqual(confirmCalls, 1);
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testStatus.textContent?.includes('ok=true'));
		assert.ok(testStatus.textContent?.includes('pairingPending=false'));
		container.remove();
	});

	test('SAS confirm still opens when capability snapshot looks web-unsupported', async () => {
		let confirmCalls = 0;
		const handshakeSas = 'ABCD-EFGH';
		const capabilities = createWebUnsupportedCapabilitySnapshot();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentHubService, createHubStub({
			listConnectionProfiles: () => [{
				profileId: 'direct-profile-1',
				displayName: 'debug-engine',
				state: 'pairingPending',
				hasTrust: false,
				targetKind: 'directAddress',
			}],
		}));
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub({
			getCapabilitySnapshot: () => capabilities,
			getConnectionSnapshot: () => ({
				transport: 'idle',
				pairingPending: true,
				channelAlive: false,
				sharedFsRootSent: false,
				capabilities,
			}),
			connectProfile: async () => ({
				ok: true,
				path: 'direct',
				pairingPending: true,
				sasCode: handshakeSas,
				engineIdentityId: '0123456789abcdef',
			}),
			confirmPairing: async () => {
				confirmCalls++;
				return { ok: true, path: 'direct', pairingPending: false, sessionToken: 'tok' };
			},
		}));
		instantiationService.stub(IDialogService, {
			_serviceBrand: undefined,
			prompt: async () => {
				throw new Error('dialogService must not be used for pairing inside Connection pane');
			},
		} as unknown as IDialogService);

		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		const flow = (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('direct-profile-1');
		await Promise.resolve();
		assert.ok(container.querySelector('.connection-pairing-confirm .dialog-message-detail')?.textContent?.includes(handshakeSas));
		clickPairingConfirm(container);
		await flow;
		assert.strictEqual(confirmCalls, 1);
		container.remove();
	});

	test('recoverTrust confirm shows identity+fingerprint dialog then confirmPairing', async () => {
		let confirmCalls = 0;
		let promptedTitle: string | undefined;
		let promptedDetail: string | undefined;
		const leafFp = 'a'.repeat(64);
		const engineId = 'eng-recover-identity-01';
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
				recoverTrust: true,
				engineIdentityId: engineId,
				leafSha256Hex: leafFp,
			}),
			confirmPairing: async () => {
				confirmCalls++;
				return { ok: true, path: 'hubRelay', pairingPending: false, sessionToken: 'tok' };
			},
		}));
		instantiationService.stub(IDialogService, {
			_serviceBrand: undefined,
			prompt: async () => {
				throw new Error('dialogService must not be used for pairing inside Connection pane');
			},
		} as unknown as IDialogService);

		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'hub-profile-1';
		const flow = (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('hub-profile-1');
		await Promise.resolve();
		const dialogBox = container.querySelector('.connection-pairing-confirm .monaco-dialog-box') as HTMLElement;
		assert.ok(dialogBox);
		promptedTitle = dialogBox.querySelector('.dialog-message')?.textContent ?? undefined;
		promptedDetail = dialogBox.querySelector('.dialog-message-detail')?.textContent ?? undefined;
		assert.ok(promptedDetail?.includes(engineId));
		assert.ok(promptedDetail?.includes(leafFp));
		assert.ok(promptedDetail?.includes('does not use a pairing code'));
		assert.ok(!promptedDetail?.includes('ABCD-EFGH'));
		clickPairingConfirm(container);
		await flow;
		assert.strictEqual(confirmCalls, 1);
		assert.ok(promptedTitle?.includes('Studio'));
		assert.ok(promptedDetail);
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testStatus.textContent?.includes('ok=true'));
		assert.ok(testStatus.textContent?.includes('pairingPending=false'));
		container.remove();
	});

	test('active profile label drops pairing pending when connection phase is connected', () => {
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: '127.0.0.1:50061',
				displayName: '127.0.0.1:50061',
				state: 'pairingPending',
				hasTrust: true,
				targetKind: 'directAddress',
			}],
		}, {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: createEmptyTestCapabilitySnapshot(),
			}),
		});
		const container = pane.getDomNode();
		(pane as unknown as { activeProfileId: string }).activeProfileId = '127.0.0.1:50061';
		const label = (pane as unknown as { getProfileStateLabel(profile: { profileId: string; displayName: string; state: string; hasTrust: boolean; targetKind: string }): string }).getProfileStateLabel({
			profileId: '127.0.0.1:50061',
			displayName: '127.0.0.1:50061',
			state: 'pairingPending',
			hasTrust: true,
			targetKind: 'directAddress',
		});
		assert.strictEqual(label, 'Paired');
		container.remove();
	});

	test('active profile label shows Paired when connected without trust', () => {
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: '127.0.0.1:50061',
				displayName: '127.0.0.1:50061',
				state: 'active',
				hasTrust: false,
				targetKind: 'directAddress',
			}],
		}, {
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: createEmptyTestCapabilitySnapshot(),
			}),
		});
		const container = pane.getDomNode();
		(pane as unknown as { activeProfileId: string }).activeProfileId = '127.0.0.1:50061';
		const label = (pane as unknown as { getProfileStateLabel(profile: { profileId: string; displayName: string; state: string; hasTrust: boolean; targetKind: string }): string }).getProfileStateLabel({
			profileId: '127.0.0.1:50061',
			displayName: '127.0.0.1:50061',
			state: 'active',
			hasTrust: false,
			targetKind: 'directAddress',
		});
		assert.strictEqual(label, 'Paired');
		container.remove();
	});

	test('isRecoverTrustConnectResult requires fingerprint path without SAS', () => {
		assert.strictEqual(isRecoverTrustConnectResult({
			ok: true,
			pairingPending: true,
			recoverTrust: true,
			leafSha256Hex: 'ab',
			engineIdentityId: 'id',
		}), true);
		assert.strictEqual(isRecoverTrustConnectResult({
			ok: true,
			pairingPending: true,
			sasCode: 'ABCD-EFGH',
			engineIdentityId: 'id',
		}), false);
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
		assert.strictEqual(rename.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(revoke.getAttribute('aria-disabled'), 'true');
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

	test('Test Connection probes the engine instead of echoing phase only', async () => {
		let probed = false;
		const pane = mountPane(undefined, {
			probeEngine: async () => {
				probed = true;
				return { ok: true, engineIdentityId: 'eng-1' };
			},
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
		});
		const container = pane.getDomNode();
		const testButton = container.querySelector('.connection-test-row .monaco-button') as HTMLButtonElement | null;
		assert.ok(testButton);
		testButton.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(probed, true);
		const status = container.querySelector('.connection-test-status');
		assert.ok(status?.textContent?.startsWith('Reachable —'));
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

	test('DeviceService.Revoke does not send when disconnected or hook missing', async () => {
		const revokeCalls: UniverseAgentRevokeRequest[] = [];
		let hubRevoked: string | undefined;
		const disconnected = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			revokeDevice: async id => {
				hubRevoked = id;
				return { ok: true };
			},
		}, {
			isEngineConnected: () => false,
			revoke: async request => {
				revokeCalls.push(request);
				return { success: true, message: '' };
			},
		});
		const container = disconnected.getDomNode();
		disconnected.layout(new Dimension(800, 800));
		await Promise.resolve();
		const revoke = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Revoke') as HTMLButtonElement | undefined;
		assert.ok(revoke);
		revoke.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(hubRevoked, 'dev-1');
		assert.deepStrictEqual(revokeCalls, []);

		const noHook = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-2', name: 'Phone' })] }),
			revokeDevice: async id => {
				hubRevoked = id;
				return { ok: true };
			},
		}, {
			isEngineConnected: () => true,
		});
		const noHookContainer = noHook.getDomNode();
		noHook.layout(new Dimension(800, 800));
		await Promise.resolve();
		const noHookRevoke = [...noHookContainer.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Revoke') as HTMLButtonElement | undefined;
		assert.ok(noHookRevoke);
		noHookRevoke.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(hubRevoked, 'dev-2');
		assert.deepStrictEqual(revokeCalls, []);
		container.remove();
		noHookContainer.remove();
	});

	test('DeviceService.Revoke sends empty device_id as-is when connected', async () => {
		const revokeCalls: UniverseAgentRevokeRequest[] = [];
		let hubRevoked: string | undefined;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: '', name: '' })] }),
			revokeDevice: async id => {
				hubRevoked = id;
				return { ok: true };
			},
		}, {
			isEngineConnected: () => true,
			revoke: async request => {
				revokeCalls.push(request);
				return { success: true, message: '' };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();
		const revoke = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Revoke') as HTMLButtonElement | undefined;
		assert.ok(revoke);
		revoke.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(hubRevoked, undefined);
		assert.deepStrictEqual(revokeCalls, [{ deviceId: '' }]);
		container.remove();
	});

	test('DeviceService.Revoke sends selected device id without inventing defaults', async () => {
		const revokeCalls: UniverseAgentRevokeRequest[] = [];
		let hubRevoked: string | undefined;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			revokeDevice: async id => {
				hubRevoked = id;
				return { ok: true };
			},
		}, {
			isEngineConnected: () => true,
			revoke: async request => {
				revokeCalls.push(request);
				return { success: false, message: '' };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();
		const revoke = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Revoke') as HTMLButtonElement | undefined;
		assert.ok(revoke);
		revoke.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(hubRevoked, undefined);
		assert.deepStrictEqual(revokeCalls, [{ deviceId: 'dev-1' }]);
		container.remove();
	});

	test('ListPending / PairApprove / PairReject do not send when disconnected or hook missing', async () => {
		const approveCalls: UniverseAgentPairApproveRequest[] = [];
		const rejectCalls: UniverseAgentPairRejectRequest[] = [];
		let listPendingCalls = 0;
		let hubConfirmed: string | undefined;
		const disconnected = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			confirmDeviceCode: async code => {
				hubConfirmed = code;
				return { ok: true };
			},
		}, {
			isEngineConnected: () => false,
			listPending: async () => {
				listPendingCalls++;
				return { pending: [] };
			},
			pairApprove: async request => {
				approveCalls.push(request);
				return { success: true, deviceId: '', message: '' };
			},
			pairReject: async request => {
				rejectCalls.push(request);
				return { success: true, message: '' };
			},
		});
		const container = disconnected.getDomNode();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listPendingCalls, 0);
		const confirm = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === 'Confirm') as HTMLButtonElement | undefined;
		const reject = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === CONNECTION_DEVICE_PAIR_REJECT_LABEL) as HTMLButtonElement | undefined;
		const codeInput = container.querySelector('.connection-hub-device-code input') as HTMLInputElement | null;
		assert.ok(confirm);
		assert.ok(reject);
		assert.ok(codeInput);
		codeInput.value = 'ABCD-1234';
		confirm.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(hubConfirmed, 'ABCD-1234');
		assert.deepStrictEqual(approveCalls, []);
		reject.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(rejectCalls, []);

		const noHook = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
		}, {
			isEngineConnected: () => true,
		});
		const noHookContainer = noHook.getDomNode();
		await Promise.resolve();
		await Promise.resolve();
		const noHookConfirm = [...noHookContainer.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === 'Confirm') as HTMLButtonElement | undefined;
		const noHookReject = [...noHookContainer.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === CONNECTION_DEVICE_PAIR_REJECT_LABEL) as HTMLButtonElement | undefined;
		assert.ok(noHookConfirm);
		assert.ok(noHookReject);
		noHookConfirm.click();
		noHookReject.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(approveCalls, []);
		assert.deepStrictEqual(rejectCalls, []);
		container.remove();
		noHookContainer.remove();
	});

	test('ListPending / PairApprove / PairReject send empty ids as-is when connected', async () => {
		const approveCalls: UniverseAgentPairApproveRequest[] = [];
		const rejectCalls: UniverseAgentPairRejectRequest[] = [];
		let listPendingCalls = 0;
		let hubConfirmed: string | undefined;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedOut' }),
			confirmDeviceCode: async code => {
				hubConfirmed = code;
				return { ok: true };
			},
		}, {
			isEngineConnected: () => true,
			listPending: async () => {
				listPendingCalls++;
				return { pending: [] };
			},
			pairApprove: async request => {
				approveCalls.push(request);
				return { success: true, deviceId: '', message: '' };
			},
			pairReject: async request => {
				rejectCalls.push(request);
				return { success: true, message: '' };
			},
		});
		const container = pane.getDomNode();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listPendingCalls, 1);
		assert.strictEqual(container.querySelector('.connection-engine-pending-empty')?.textContent, CONNECTION_DEVICE_PENDING_EMPTY_COPY);

		const confirm = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === 'Confirm') as HTMLButtonElement | undefined;
		const reject = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === CONNECTION_DEVICE_PAIR_REJECT_LABEL) as HTMLButtonElement | undefined;
		assert.ok(confirm);
		assert.ok(reject);
		confirm.click();
		await Promise.resolve();
		await Promise.resolve();
		reject.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(hubConfirmed, undefined);
		assert.deepStrictEqual(approveCalls, [{ pairingCode: '', displayName: '', role: '' }]);
		assert.deepStrictEqual(rejectCalls, [{ pairingCode: '' }]);
		assert.ok(listPendingCalls >= 1);
		container.remove();
	});

	test('PairApprove / PairReject send selected pending ids without inventing defaults', async () => {
		const approveCalls: UniverseAgentPairApproveRequest[] = [];
		const rejectCalls: UniverseAgentPairRejectRequest[] = [];
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
		}, {
			isEngineConnected: () => true,
			listPending: async () => ({
				pending: [{
					pairingCode: '123456',
					deviceId: 'dev-1',
					displayName: 'Phone',
					platform: 'ios',
					requestedAt: 0,
					expiresInSeconds: 0,
				}],
			}),
			pairApprove: async request => {
				approveCalls.push(request);
				return { success: true, deviceId: 'dev-1', message: '' };
			},
			pairReject: async request => {
				rejectCalls.push(request);
				return { success: true, message: '' };
			},
		});
		const container = pane.getDomNode();
		await Promise.resolve();
		await Promise.resolve();
		const row = container.querySelector('.connection-engine-pending-row') as HTMLElement | null;
		assert.ok(row);
		assert.strictEqual(row.textContent, 'Phone — 123456 — ios');
		row.click();
		const confirm = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === 'Confirm') as HTMLButtonElement | undefined;
		const reject = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === CONNECTION_DEVICE_PAIR_REJECT_LABEL) as HTMLButtonElement | undefined;
		assert.ok(confirm);
		assert.ok(reject);
		confirm.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(approveCalls, [{ pairingCode: '123456', displayName: 'Phone', role: '' }]);
		const rowAfterApprove = container.querySelector('.connection-engine-pending-row') as HTMLElement | null;
		assert.ok(rowAfterApprove);
		rowAfterApprove.click();
		reject.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(rejectCalls, [{ pairingCode: '123456' }]);
		container.remove();
	});

	test('ListDevices does not send when disconnected or hook missing', async () => {
		let listDevicesCalls = 0;
		const disconnected = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({
				kind: 'ok',
				devices: [device({ id: 'hub-1', name: 'Hub Studio' })],
			}),
		}, {
			isEngineConnected: () => false,
			listDevices: async () => {
				listDevicesCalls++;
				return { devices: [] };
			},
		});
		const disconnectedContainer = disconnected.getDomNode();
		disconnected.layout(new Dimension(800, 800));
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listDevicesCalls, 0);
		const hubName = disconnectedContainer.querySelector('.connection-hub-device-name');
		assert.strictEqual(hubName?.textContent, 'Hub Studio');

		const noHook = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({
				kind: 'ok',
				devices: [device({ id: 'hub-2', name: 'Hub Phone' })],
			}),
		}, {
			isEngineConnected: () => true,
		});
		const noHookContainer = noHook.getDomNode();
		noHook.layout(new Dimension(800, 800));
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listDevicesCalls, 0);
		assert.strictEqual(noHookContainer.querySelector('.connection-hub-device-name')?.textContent, 'Hub Phone');
		disconnectedContainer.remove();
		noHookContainer.remove();
	});

	test('ListDevices replaces paired list with empty ids as-is when connected', async () => {
		let listDevicesCalls = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({
				kind: 'ok',
				devices: [device({ id: 'hub-1', name: 'Hub Studio' })],
			}),
		}, {
			isEngineConnected: () => true,
			listDevices: async (): Promise<UniverseAgentListDevicesResult> => {
				listDevicesCalls++;
				return {
					devices: [{
						deviceId: '',
						displayName: '',
						role: '',
						platform: '',
						pairedAt: 0,
						lastSeenAt: 0,
						active: false,
					}],
				};
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listDevicesCalls, 1);
		const name = container.querySelector('.connection-hub-device-name');
		assert.ok(name);
		assert.strictEqual(name.textContent, '');
		assert.notStrictEqual(name.textContent, 'Hub Studio');
		container.remove();
	});

	test('ListDevices empty devices[] does not invent Hub rows', async () => {
		let listDevicesCalls = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({
				kind: 'ok',
				devices: [device({ id: 'hub-1', name: 'Hub Studio' })],
			}),
		}, {
			isEngineConnected: () => true,
			listDevices: async () => {
				listDevicesCalls++;
				return { devices: [] };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listDevicesCalls, 1);
		assert.strictEqual(container.querySelector('.connection-hub-device-name'), null);
		container.remove();
	});

	test('RotateToken does not send when disconnected or hook missing', async () => {
		const rotateCalls: UniverseAgentRotateTokenRequest[] = [];
		const disconnected = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'hub-1', name: 'Hub Studio' })] }),
		}, {
			isEngineConnected: () => false,
			rotateToken: async request => {
				rotateCalls.push(request);
				return { success: true, message: '' };
			},
		});
		const disconnectedContainer = disconnected.getDomNode();
		disconnected.layout(new Dimension(800, 800));
		await Promise.resolve();
		await Promise.resolve();
		const disconnectedRotate = [...disconnectedContainer.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === CONNECTION_DEVICE_ROTATE_TOKEN_LABEL) as HTMLButtonElement | undefined;
		assert.ok(disconnectedRotate);
		disconnectedRotate.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(rotateCalls, []);

		const noHook = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'hub-2', name: 'Hub Phone' })] }),
		}, {
			isEngineConnected: () => true,
		});
		const noHookContainer = noHook.getDomNode();
		noHook.layout(new Dimension(800, 800));
		await Promise.resolve();
		await Promise.resolve();
		const noHookRotate = [...noHookContainer.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === CONNECTION_DEVICE_ROTATE_TOKEN_LABEL) as HTMLButtonElement | undefined;
		assert.ok(noHookRotate);
		noHookRotate.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(rotateCalls, []);
		disconnectedContainer.remove();
		noHookContainer.remove();
	});

	test('RotateToken sends empty device_id as-is when connected with no selection', async () => {
		const rotateCalls: UniverseAgentRotateTokenRequest[] = [];
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedOut' }),
		}, {
			isEngineConnected: () => true,
			rotateToken: async request => {
				rotateCalls.push(request);
				return { success: false, message: '' };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();
		await Promise.resolve();
		const rotate = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === CONNECTION_DEVICE_ROTATE_TOKEN_LABEL) as HTMLButtonElement | undefined;
		assert.ok(rotate);
		rotate.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(rotateCalls, [{ deviceId: '' }]);
		container.remove();
	});

	test('RotateToken sends selected paired device_id without inventing defaults', async () => {
		const rotateCalls: UniverseAgentRotateTokenRequest[] = [];
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
		}, {
			isEngineConnected: () => true,
			listDevices: async (): Promise<UniverseAgentListDevicesResult> => ({
				devices: [{
					deviceId: '  dev  ',
					displayName: '  Phone  ',
					role: '',
					platform: '',
					pairedAt: 0,
					lastSeenAt: 0,
					active: false,
				}],
			}),
			rotateToken: async request => {
				rotateCalls.push(request);
				return { success: true, message: '' };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();
		await Promise.resolve();
		const list = (pane as unknown as { hubDevicesList: WorkbenchList<HubDeviceProjection> }).hubDevicesList;
		list.setSelection([0]);
		const rotate = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === CONNECTION_DEVICE_ROTATE_TOKEN_LABEL) as HTMLButtonElement | undefined;
		assert.ok(rotate);
		rotate.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.deepStrictEqual(rotateCalls, [{ deviceId: '  dev  ' }]);
		container.remove();
	});
});

suite('Conversation Session StatusBar H4a negative', () => {
	test('engine status copy stays not connected before H4b phase wiring', () => {
		assert.strictEqual(getConversationEngineStatusText(), 'Engine not connected');
	});
});
