/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
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
	formatConnectProfileStatusText,
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
	connectionDeviceListFailureMessage,
	connectionDeviceRevokeFailureMessage,
	connectionDeviceRotateTokenFailureMessage,
} from '../../browser/connectionDeviceList.js';
import {
	CONNECTION_DEVICE_PAIR_REJECT_LABEL,
	CONNECTION_DEVICE_PENDING_EMPTY_COPY,
	connectionDevicePendingListFailureMessage,
} from '../../browser/connectionDevicePair.js';
import {
	canConnectHubDevice,
	getHubAuthStatusLabel,
	getHubDeviceRowStatusLabel,
	getHubDirectoryBannerLabel,
	HUB_CHANGE_PASSWORD_BUTTON_LABEL,
	HUB_LOGIN_BUTTON_LABEL,
	isRecoverTrustConnectResult,
	isForbiddenSasButtonLabel,
	SAS_CANCEL_BUTTON_LABEL,
	SAS_CONFIRM_BUTTON_LABEL,
	SAS_FORBIDDEN_BUTTON_PATTERNS,
} from '../../browser/connectionPreferencesPaneLabels.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';
import { promptSasConfirmDialog, promptSasConfirmInPane } from '../../browser/connectionPreferencesPaneSas.js';
import { getConnectionPhaseStatusBarText, getConversationEngineStatusText } from '../../browser/conversationSessionStatus.js';
import { conversationIdentityStripClass } from '../../browser/conversationIdentityStrip.js';
import {
	applyConnectionPaneIdentityStripReservation,
	boxesOverlap,
	connectionPaneIdentityReservationHostClass,
	connectionPaneIdentityReservedTopVar,
} from '../../browser/connectionPaneIdentityStripReservation.js';
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

	function mountPaneInWorkbench(
		hubOverrides?: Partial<IUniverseAgentHubService>,
		connectionOverrides?: Partial<IUniverseAgentConnection>,
	): { readonly pane: ConnectionPreferencesPane; readonly workbench: HTMLElement } {
		if (!document.getElementById('connection-pane-zone-css')) {
			const style = document.createElement('style');
			style.id = 'connection-pane-zone-css';
			style.textContent = '.monaco-workbench .connection-preferences-pane .connection-zone:not(.is-active-zone) { display: none; }';
			document.head.appendChild(style);
		}
		const workbench = document.createElement('div');
		workbench.className = 'monaco-workbench';
		document.body.appendChild(workbench);
		const pane = mountPane(hubOverrides, connectionOverrides);
		workbench.appendChild(pane.getDomNode());
		return { pane, workbench };
	}

	async function waitForPairingDialog(container: ParentNode): Promise<HTMLElement> {
		for (let i = 0; i < 20; i++) {
			const dialog = container.querySelector('.connection-pairing-confirm .monaco-dialog-box') as HTMLElement | null;
			if (dialog) {
				return dialog;
			}
			await Promise.resolve();
		}
		assert.fail('SAS confirm dialog did not appear');
	}

	function assertSasVisibleBesideActiveZone(container: ParentNode, zoneClass: string, sasCode: string): HTMLElement {
		const activeZone = container.querySelector(`${zoneClass}.is-active-zone`) as HTMLElement | null;
		assert.ok(activeZone, `${zoneClass} must stay the active zone while SAS is shown`);
		const host = container.querySelector('.connection-pairing-confirm') as HTMLElement | null;
		const dialog = host?.querySelector('.monaco-dialog-box') as HTMLElement | null;
		assert.ok(host && dialog, 'SAS confirm must render when pairing is pending');
		assert.ok(dialog.textContent?.includes(sasCode), 'SAS code must be visible beside the active zone');
		const profiles = container.querySelector('.connection-profiles') as HTMLElement | null;
		assert.ok(profiles);
		assert.ok(!profiles.classList.contains('is-active-zone'), 'must not switch to Connection profiles to reveal SAS');
		assert.ok(!profiles.contains(dialog), 'SAS must not be trapped under hidden profiles');
		for (const zone of container.querySelectorAll('.connection-zone:not(.is-active-zone)')) {
			assert.ok(!zone.contains(dialog), 'SAS must not sit inside a hidden Connect zone');
		}
		assert.ok(
			activeZone.contains(dialog) || activeZone.nextElementSibling === host,
			'SAS confirm must sit in or immediately after the active Connect zone',
		);
		assert.strictEqual(getComputedStyle(profiles).display, 'none');
		assert.notStrictEqual(getComputedStyle(dialog).display, 'none');
		assert.notStrictEqual(getComputedStyle(host).display, 'none');
		assert.notStrictEqual(getComputedStyle(activeZone).display, 'none');
		const buttons = getPairingConfirmButtons(container);
		assert.strictEqual(buttons.length, 2);
		assert.strictEqual(buttons[0].textContent, SAS_CONFIRM_BUTTON_LABEL);
		assert.strictEqual(buttons[1].textContent, SAS_CANCEL_BUTTON_LABEL);
		return dialog;
	}

	function mountIdentityStripInConversation(bottom = 40, top = 8, width = 240): HTMLElement {
		const workbench = document.createElement('div');
		workbench.className = 'monaco-workbench';
		const part = document.createElement('div');
		part.className = 'part conversation';
		const strip = document.createElement('div');
		strip.className = conversationIdentityStripClass;
		strip.textContent = 'Engine not connected';
		part.appendChild(strip);
		workbench.appendChild(part);
		document.body.appendChild(workbench);
		store.add(toDisposable(() => workbench.remove()));
		strip.getBoundingClientRect = () => DOMRect.fromRect({ x: 10, y: top, width, height: bottom - top });
		return strip;
	}

	function modalBoxFromReservation(modalBlock: HTMLElement, height = 400, width = 800): { top: number; right: number; bottom: number; left: number } {
		const reserved = parseFloat(modalBlock.style.top || '0');
		return { top: reserved, right: width, bottom: reserved + height, left: 0 };
	}

	test('D28 Connection modal layout reserves identity strip and pane box does not overlap', () => {
		const strip = mountIdentityStripInConversation(40, 8, 240);
		const { pane, modalBlock } = mountPaneInPreferencesModal();
		store.add(toDisposable(() => modalBlock.remove()));
		modalBlock.style.position = 'fixed';
		modalBlock.style.left = '0';
		modalBlock.style.width = '800px';
		modalBlock.style.height = '400px';

		pane.layout(new Dimension(800, 400));

		assert.ok(modalBlock.classList.contains(connectionPaneIdentityReservationHostClass));
		assert.strictEqual(modalBlock.style.getPropertyValue(connectionPaneIdentityReservedTopVar), '40px');
		assert.strictEqual(modalBlock.style.top, '40px');

		const stripBox = strip.getBoundingClientRect();
		const paneHostBox = modalBoxFromReservation(modalBlock);
		assert.ok(!boxesOverlap(stripBox, paneHostBox), 'Connection pane host must start at or below the identity strip');
	});

	test('D28 reservation is zero when identity strip is absent', () => {
		const { pane, modalBlock } = mountPaneInPreferencesModal();
		store.add(toDisposable(() => modalBlock.remove()));
		pane.layout(new Dimension(800, 400));
		assert.ok(modalBlock.classList.contains(connectionPaneIdentityReservationHostClass));
		assert.strictEqual(modalBlock.style.getPropertyValue(connectionPaneIdentityReservedTopVar), '0px');
		assert.strictEqual(modalBlock.style.top, '0px');
	});

	test('D28 applyConnectionPaneIdentityStripReservation fails closed if pane would overlap strip', () => {
		const strip = mountIdentityStripInConversation(56, 0, 320);
		const modalBlock = document.createElement('div');
		modalBlock.className = 'monaco-modal-editor-block';
		modalBlock.style.position = 'fixed';
		modalBlock.style.top = '0';
		modalBlock.style.left = '0';
		modalBlock.style.width = '640px';
		modalBlock.style.height = '480px';
		const pane = document.createElement('div');
		pane.className = 'connection-preferences-pane';
		modalBlock.appendChild(pane);
		document.body.appendChild(modalBlock);
		store.add(toDisposable(() => modalBlock.remove()));

		applyConnectionPaneIdentityStripReservation(pane);

		const reserved = parseFloat(modalBlock.style.top);
		assert.strictEqual(reserved, 56);
		assert.ok(!boxesOverlap(strip.getBoundingClientRect(), modalBoxFromReservation(modalBlock, 480, 640)));
	});

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
		const checkbox = container.querySelector('#connection-allow-private-network') as HTMLElement;
		assert.ok(checkbox);
		assert.strictEqual(checkbox.getAttribute('role'), 'checkbox');
		assert.strictEqual(checkbox.getAttribute('aria-checked'), 'false');
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
		pane.layout(new Dimension(800, 800));
		pane.selectZone('direct');
		const hostInput = (pane as unknown as { directHostInput: HTMLInputElement }).directHostInput;
		const portInput = (pane as unknown as { directPortInput: HTMLInputElement }).directPortInput;
		const allowPrivate = (pane as unknown as { directAllowPrivateCheckbox: HTMLInputElement }).directAllowPrivateCheckbox;
		hostInput.value = '127.0.0.1';
		portInput.value = '50061';
		allowPrivate.checked = true;
		await (pane as unknown as { handleConnectDirectAddress(): Promise<void> }).handleConnectDirectAddress();
		assert.deepStrictEqual(forgotIds, ['direct-old']);
		assert.strictEqual(addCalls, 1);
		const status = container.querySelector('.connection-direct-address-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(status.textContent, formatConnectProfileStatusText({
			ok: true,
			path: 'direct',
			pairingPending: false,
		}));
		assert.ok(!status.textContent?.includes('ok=true'), `directStatus=${status.textContent}`);
		assert.notStrictEqual(status.textContent, 'Connected');
		assert.strictEqual(testStatus.textContent, '');
		container.remove();
	});

	test('formatConnectProfileStatusText is readable and never claims Connected', () => {
		assert.strictEqual(
			formatConnectProfileStatusText({ ok: true, path: 'direct', pairingPending: false }),
			'Handshake succeeded — pairing not pending.',
		);
		assert.strictEqual(
			formatConnectProfileStatusText({
				ok: true,
				path: 'direct',
				pairingPending: true,
				sasCode: 'ABCD-EFGH',
			}),
			'Pairing pending — not connected yet.',
		);
		assert.ok(!formatConnectProfileStatusText({
			ok: true,
			path: 'direct',
			pairingPending: true,
			sasCode: 'ABCD-EFGH',
		}).includes('ABCD-EFGH'));
		assert.strictEqual(
			formatConnectProfileStatusText({
				ok: true,
				path: 'hubRelay',
				pairingPending: true,
				recoverTrust: true,
				leafSha256Hex: 'a'.repeat(64),
			}),
			'Trust recovery required — not connected yet.',
		);
		assert.strictEqual(
			formatConnectProfileStatusText({ ok: false, code: 'hub_session_required', reason: 'hub session required' }),
			'hub session required',
		);
		assert.strictEqual(
			formatConnectProfileStatusText(
				{ ok: true, path: 'direct', pairingPending: true, sasCode: 'ABCD-EFGH' },
				{ dialogError: 'dialog exploded' },
			),
			'Pairing dialog failed — dialog exploded',
		);
		assert.ok(!formatConnectProfileStatusText({
			ok: true,
			path: 'direct',
			pairingPending: false,
		}).includes('Connected'));
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
		const hubStatus = container.querySelector('.connection-hub-connect-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(hubStatus.textContent, 'Handshake succeeded — pairing not pending.');
		assert.ok(!hubStatus.textContent?.includes('ok=true'));
		assert.notStrictEqual(hubStatus.textContent, 'Connected');
		assert.strictEqual(testStatus.textContent, '');
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
		const hubStatus = container.querySelector('.connection-hub-connect-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(hubStatus.textContent?.includes('still pairing pending'));
		assert.ok(!hubStatus.textContent?.includes('ok=true'));
		assert.ok(!hubStatus.classList.contains('is-success'));
		assert.strictEqual(testStatus.textContent, '');
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
		const hubStatus = container.querySelector('.connection-hub-connect-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(hubStatus.textContent?.includes('dialog exploded'));
		assert.ok(hubStatus.textContent?.includes('Pairing dialog failed'));
		assert.ok(!hubStatus.textContent?.includes('ok=true'));
		assert.ok(!hubStatus.textContent?.includes('ABCD-EFGH'));
		assert.strictEqual(testStatus.textContent, '');
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
		const hubStatus = container.querySelector('.connection-hub-connect-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(String(hubStatus.textContent), 'Connecting…');
		assert.strictEqual(testStatus.textContent, '');
		resolveConnect!({
			ok: true,
			path: 'direct',
			pairingPending: true,
			sasCode: 'ABCD-EFGH',
			engineIdentityId: '0123456789abcdef',
		});
		await Promise.resolve();
		await Promise.resolve();
		const pairingStatusText = String(hubStatus.textContent);
		assert.strictEqual(pairingStatusText, 'Pairing pending — not connected yet.');
		assert.ok(hubStatus.classList.contains('is-warning'));
		assert.ok(!pairingStatusText.includes('ok=true'));
		assert.ok(!pairingStatusText.includes('ABCD-EFGH'));
		assert.notStrictEqual(pairingStatusText, 'Connected');
		assert.strictEqual(testStatus.textContent, '');
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
		assert.ok(!testStatus.classList.contains('is-error'));

		testButton.click();
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(testStatus.textContent, 'Unreachable — stub');
		assert.notStrictEqual(testStatus.textContent, 'Connected');
		assert.ok(testStatus.classList.contains('is-error'), 'an unreachable probe must read as an error');

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

	test('wide layout keeps left nav and a single active zone', () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));

		assert.ok(!container.classList.contains('is-narrow'));
		const navLabels = [...container.querySelectorAll('.connection-preferences-nav-label')].map(el => el.textContent);
		assert.ok(navLabels.includes('Hub account'));
		assert.ok(navLabels.includes('Direct Address'));
		assert.ok(container.querySelector('.connection-hub-account.is-active-zone'));
		assert.ok(!container.querySelector('.connection-direct-address.is-active-zone'));
		assert.ok(container.querySelector('.monaco-inputbox'));

		container.remove();
	});

	test('every action row leads with at most one primary button', () => {
		const pane = mountPane({ getAuthStatus: () => ({ kind: 'signedIn', email: 'a@example.com' }) });
		const container = pane.getDomNode();

		const rows = [...container.querySelectorAll('.connection-actions')];
		assert.ok(rows.length > 0);
		for (const row of rows) {
			const buttons = [...row.querySelectorAll('.monaco-button')];
			assert.ok(buttons.length > 0, `${row.className} must hold at least one button`);
			const primary = buttons.filter(button => !button.classList.contains('secondary'));
			assert.ok(primary.length <= 1, `${row.className} must not stack primary buttons`);
			if (primary.length === 1) {
				assert.strictEqual(buttons[0], primary[0], `${row.className} must lead with its primary button`);
			}
		}

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
		const back = container.querySelector('.connection-preferences-back') as HTMLButtonElement;
		assert.ok(back);
		assert.strictEqual(back.hidden, false);
		assert.ok(container.querySelector('.connection-hub-account.is-active-zone'));

		back.click();
		assert.ok(!container.classList.contains('is-showing-detail'));
		assert.strictEqual(back.hidden, true);
		const nav = container.querySelector('.connection-preferences-nav') as HTMLElement;
		assert.ok(nav);
		const hubNav = [...container.querySelectorAll('.connection-preferences-nav-label')]
			.find(el => el.textContent === 'Hub account');
		assert.ok(hubNav);
		pane.selectZone('hub');
		assert.ok(container.classList.contains('is-showing-detail'));
		assert.strictEqual(back.hidden, false);
		const body = container.querySelector('.connection-preferences-body') as HTMLElement;
		assert.ok(body);
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
		const navLabels = () => [...container.querySelectorAll('.connection-preferences-nav-label')].map(el => el.textContent);
		assert.ok(!navLabels().includes('Devices'));

		auth = { kind: 'signedIn', email: 'user@hub.example' };
		onDidChangeAuthStatus.fire(auth);
		const back = container.querySelector('.connection-preferences-back') as HTMLButtonElement;
		back.click();
		assert.ok(navLabels().includes('Devices'));

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
		pane.selectZone('devices');
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

	test('device Connect failure writes the visible Devices status', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			addHubDeviceProfile: async () => ({ ok: false, code: 'hub_session_required', reason: 'hub session required' }),
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('devices');
		await Promise.resolve();

		const connectButton = container.querySelector('.connection-hub-device-row .monaco-button') as HTMLButtonElement | null;
		assert.ok(connectButton);
		connectButton.click();
		await Promise.resolve();
		await Promise.resolve();

		const devicesStatus = container.querySelector('.connection-hub-devices-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(devicesStatus.textContent, 'hub session required');
		assert.ok(devicesStatus.classList.contains('is-error'));
		assert.strictEqual(testStatus.textContent, '');
		assert.notStrictEqual(devicesStatus.textContent, 'Connected');
		container.remove();
	});

	test('device Connect Connecting and handshake failure stay in the visible Devices status', async () => {
		let resolveConnect: ((value: { ok: false; code: 'transport_failed'; reason: string }) => void) | undefined;
		const connectPromise = new Promise<{ ok: false; code: 'transport_failed'; reason: string }>(resolve => {
			resolveConnect = resolve;
		});
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			addHubDeviceProfile: async () => ({ ok: true, profileId: 'hub-profile-1' }),
		}, {
			connectProfile: async () => connectPromise,
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('devices');
		await Promise.resolve();

		const connectButton = container.querySelector('.connection-hub-device-row .monaco-button') as HTMLButtonElement | null;
		assert.ok(connectButton);
		connectButton.click();
		await Promise.resolve();
		await Promise.resolve();

		const devicesStatus = container.querySelector('.connection-hub-devices-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(devicesStatus.textContent, 'Connecting…');
		assert.strictEqual(testStatus.textContent, '');
		resolveConnect!({ ok: false, code: 'transport_failed', reason: 'dial refused' });
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(devicesStatus.textContent, 'dial refused');
		assert.ok(devicesStatus.classList.contains('is-error'));
		assert.strictEqual(testStatus.textContent, '');
		assert.notStrictEqual(devicesStatus.textContent, 'Connected');
		container.remove();
	});

	test('direct Connect failure writes the visible Direct Address status', async () => {
		const pane = mountPane({
			addDirectAddressProfile: async () => ({ ok: false, code: 'private_network_blocked', reason: 'private network blocked' }),
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('direct');

		const hostInput = (pane as unknown as { directHostInput: { value: string } }).directHostInput;
		const portInput = (pane as unknown as { directPortInput: { value: string } }).directPortInput;
		hostInput.value = '127.0.0.1';
		portInput.value = '50061';
		await (pane as unknown as { handleConnectDirectAddress(): Promise<void> }).handleConnectDirectAddress();

		const status = container.querySelector('.connection-direct-address-status') as HTMLElement;
		assert.strictEqual(status.textContent, 'private network blocked');
		assert.ok(status.classList.contains('is-error'));
		container.remove();
	});

	test('direct Connect thrown handshake writes the visible Direct Address status', async () => {
		const pane = mountPane({
			addDirectAddressProfile: async () => ({ ok: true, profileId: 'direct-profile-1' }),
		}, {
			connectProfile: async () => {
				throw new Error('Setting the TLS ServerName to an IP address is not permitted.');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('direct');

		const hostInput = (pane as unknown as { directHostInput: { value: string } }).directHostInput;
		const portInput = (pane as unknown as { directPortInput: { value: string } }).directPortInput;
		const allowPrivate = (pane as unknown as { directAllowPrivateCheckbox: { checked: boolean } }).directAllowPrivateCheckbox;
		hostInput.value = '127.0.0.1';
		portInput.value = '50061';
		allowPrivate.checked = true;
		await (pane as unknown as { handleConnectDirectAddress(): Promise<void> }).handleConnectDirectAddress();

		const status = container.querySelector('.connection-direct-address-status') as HTMLElement;
		assert.ok(status.textContent?.includes('TLS ServerName'));
		assert.ok(status.classList.contains('is-error'));
		container.remove();
	});

	test('direct Connect pairing pending writes readable Direct status, not a diagnostic dump', async () => {
		const pane = mountPane({
			addDirectAddressProfile: async () => ({ ok: true, profileId: 'direct-profile-1' }),
			listConnectionProfiles: () => [{
				profileId: 'direct-profile-1',
				displayName: '127.0.0.1:50061',
				state: 'pairingPending',
				hasTrust: false,
				targetKind: 'directAddress',
			}],
		}, {
			connectProfile: async () => ({
				ok: true,
				path: 'direct',
				pairingPending: true,
				sasCode: 'ABCD-EFGH',
				engineIdentityId: '0123456789abcdef',
			}),
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('direct');

		const hostInput = (pane as unknown as { directHostInput: { value: string } }).directHostInput;
		const portInput = (pane as unknown as { directPortInput: { value: string } }).directPortInput;
		const allowPrivate = (pane as unknown as { directAllowPrivateCheckbox: { checked: boolean } }).directAllowPrivateCheckbox;
		hostInput.value = '127.0.0.1';
		portInput.value = '50061';
		allowPrivate.checked = true;
		const flow = (pane as unknown as { handleConnectDirectAddress(): Promise<void> }).handleConnectDirectAddress();
		await waitForPairingDialog(container);

		const status = container.querySelector('.connection-direct-address-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(status.textContent, 'Pairing pending — not connected yet.');
		assert.ok(status.classList.contains('is-warning'));
		assert.ok(!status.textContent?.includes('ok=true'));
		assert.ok(!status.textContent?.includes('ABCD-EFGH'));
		assert.notStrictEqual(status.textContent, 'Connected');
		assert.strictEqual(testStatus.textContent, '');
		clickPairingCancel(container);
		await flow;
		container.remove();
	});

	test('direct Connect SAS confirm stays visible in Direct zone without switching to profiles', async () => {
		let confirmCalls = 0;
		const handshakeSas = 'R6X5-F0R1';
		const { pane, workbench } = mountPaneInWorkbench({
			addDirectAddressProfile: async () => ({ ok: true, profileId: 'direct-profile-1' }),
			listConnectionProfiles: () => [{
				profileId: 'direct-profile-1',
				displayName: '127.0.0.1:50061',
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
		pane.layout(new Dimension(800, 800));
		pane.selectZone('direct');

		const hostInput = (pane as unknown as { directHostInput: { value: string } }).directHostInput;
		const portInput = (pane as unknown as { directPortInput: { value: string } }).directPortInput;
		const allowPrivate = (pane as unknown as { directAllowPrivateCheckbox: { checked: boolean } }).directAllowPrivateCheckbox;
		hostInput.value = '127.0.0.1';
		portInput.value = '50061';
		allowPrivate.checked = true;

		const flow = (pane as unknown as { handleConnectDirectAddress(): Promise<void> }).handleConnectDirectAddress();
		await waitForPairingDialog(container);
		assertSasVisibleBesideActiveZone(container, '.connection-direct-address', handshakeSas);
		clickPairingConfirm(container);
		await flow;
		assert.strictEqual(confirmCalls, 1);
		workbench.remove();
	});

	test('pairing pending after Direct Connect shows SAS confirm even if host was parked under Profiles', async () => {
		const handshakeSas = 'R6X5-F0R1';
		const { pane, workbench } = mountPaneInWorkbench({
			addDirectAddressProfile: async () => ({ ok: true, profileId: 'direct-profile-1' }),
			listConnectionProfiles: () => [{
				profileId: 'direct-profile-1',
				displayName: '127.0.0.1:50061',
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
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		const profiles = container.querySelector('.connection-profiles') as HTMLElement;
		const parkedHost = (pane as unknown as { pairingConfirmHost: HTMLElement }).pairingConfirmHost;
		profiles.appendChild(parkedHost);
		pane.selectZone('direct');

		const hostInput = (pane as unknown as { directHostInput: { value: string } }).directHostInput;
		const portInput = (pane as unknown as { directPortInput: { value: string } }).directPortInput;
		const allowPrivate = (pane as unknown as { directAllowPrivateCheckbox: { checked: boolean } }).directAllowPrivateCheckbox;
		hostInput.value = '127.0.0.1';
		portInput.value = '50061';
		allowPrivate.checked = true;

		const flow = (pane as unknown as { handleConnectDirectAddress(): Promise<void> }).handleConnectDirectAddress();
		const dialog = await waitForPairingDialog(container);
		assertSasVisibleBesideActiveZone(container, '.connection-direct-address', handshakeSas);
		assert.ok(!profiles.contains(dialog), 'pairing pending must lift SAS out of hidden Profiles');
		clickPairingCancel(container);
		await flow;
		workbench.remove();
	});

	test('device Connect SAS confirm stays visible in Devices zone without switching to profiles', async () => {
		const handshakeSas = 'R6X5-F0R1';
		const studio = device({ id: 'dev-1', name: 'Studio' });
		const { pane, workbench } = mountPaneInWorkbench({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [studio] }),
			addHubDeviceProfile: async () => ({ ok: true, profileId: 'hub-profile-1' }),
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
				sasCode: handshakeSas,
				engineIdentityId: '0123456789abcdef',
			}),
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('devices');
		await Promise.resolve();

		const flow = (pane as unknown as { handleConnectDevice(device: HubDeviceProjection): Promise<void> }).handleConnectDevice(studio);
		await waitForPairingDialog(container);
		assertSasVisibleBesideActiveZone(container, '.connection-hub-devices', handshakeSas);
		const devicesStatus = container.querySelector('.connection-hub-devices-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(devicesStatus.textContent, 'Pairing pending — not connected yet.');
		assert.ok(devicesStatus.classList.contains('is-warning'));
		assert.ok(!devicesStatus.textContent?.includes('ok=true'));
		assert.notStrictEqual(devicesStatus.textContent, 'Connected');
		assert.strictEqual(testStatus.textContent, '');
		clickPairingCancel(container);
		await flow;
		workbench.remove();
	});

	test('profile Connect Connecting and handshake failure stay in the visible Profiles status', async () => {
		let resolveConnect: ((value: { ok: false; code: 'transport_failed'; reason: string }) => void) | undefined;
		const connectPromise = new Promise<{ ok: false; code: 'transport_failed'; reason: string }>(resolve => {
			resolveConnect = resolve;
		});
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'profile-1',
				displayName: 'Studio',
				state: 'active',
				hasTrust: true,
				targetKind: 'hubDevice',
			}],
		}, {
			connectProfile: async () => connectPromise,
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('profiles');
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'profile-1';

		const flow = (pane as unknown as { handleConnectSelectedProfile(): Promise<void> }).handleConnectSelectedProfile();
		await Promise.resolve();
		await Promise.resolve();

		const profilesStatus = container.querySelector('.connection-profiles-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(profilesStatus.textContent, 'Connecting…');
		assert.strictEqual(testStatus.textContent, '');
		resolveConnect!({ ok: false, code: 'transport_failed', reason: 'dial refused' });
		await flow;
		assert.strictEqual(profilesStatus.textContent, 'dial refused');
		assert.ok(profilesStatus.classList.contains('is-error'));
		assert.ok(!profilesStatus.classList.contains('is-success'));
		assert.strictEqual(testStatus.textContent, '');
		assert.notStrictEqual(profilesStatus.textContent, 'Connected');
		container.remove();
	});

	test('profile Connect pairing pending writes readable Profiles status, not Test zone', async () => {
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'profile-1',
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
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('profiles');
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'profile-1';

		const flow = (pane as unknown as { handleConnectSelectedProfile(): Promise<void> }).handleConnectSelectedProfile();
		await waitForPairingDialog(container);

		const profilesStatus = container.querySelector('.connection-profiles-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(profilesStatus.textContent, 'Pairing pending — not connected yet.');
		assert.ok(profilesStatus.classList.contains('is-warning'));
		assert.ok(!profilesStatus.textContent?.includes('ok=true'));
		assert.ok(!profilesStatus.textContent?.includes('ABCD-EFGH'));
		assert.notStrictEqual(profilesStatus.textContent, 'Connected');
		assert.strictEqual(testStatus.textContent, '');
		clickPairingCancel(container);
		await flow;
		container.remove();
	});

	test('profile Connect without a selection writes the visible Profiles warning', async () => {
		const pane = mountPane();
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('profiles');
		(pane as unknown as { activeProfileId?: string }).activeProfileId = undefined;

		await (pane as unknown as { handleConnectSelectedProfile(): Promise<void> }).handleConnectSelectedProfile();

		const profilesStatus = container.querySelector('.connection-profiles-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(profilesStatus.textContent, 'Select a connection profile first.');
		assert.ok(profilesStatus.classList.contains('is-warning'));
		assert.ok(!profilesStatus.classList.contains('is-success'));
		assert.strictEqual(testStatus.textContent, '');
		container.remove();
	});

	test('Forget failure writes the visible Profiles status', async () => {
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'profile-1',
				displayName: 'Studio',
				state: 'active',
				hasTrust: true,
				targetKind: 'hubDevice',
			}],
			forgetConnectionProfile: async () => ({ ok: false, code: 'forget_failed', reason: 'forget blocked' }),
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('profiles');
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'profile-1';

		await (pane as unknown as { handleForgetSelectedProfile(): Promise<void> }).handleForgetSelectedProfile();

		const profilesStatus = container.querySelector('.connection-profiles-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(profilesStatus.textContent, 'forget blocked');
		assert.ok(profilesStatus.classList.contains('is-error'));
		assert.ok(!profilesStatus.classList.contains('is-success'));
		assert.strictEqual(testStatus.textContent, '');
		assert.notStrictEqual(profilesStatus.textContent, 'Connected');
		container.remove();
	});

	test('Hub-zone connect Connecting and failure stay in the visible Hub status', async () => {
		let resolveConnect: ((value: { ok: false; code: 'transport_failed'; reason: string }) => void) | undefined;
		const connectPromise = new Promise<{ ok: false; code: 'transport_failed'; reason: string }>(resolve => {
			resolveConnect = resolve;
		});
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@hub.example' }),
			listConnectionProfiles: () => [{
				profileId: 'hub-profile-1',
				displayName: 'Studio',
				state: 'active',
				hasTrust: true,
				targetKind: 'hubDevice',
			}],
		}, {
			connectProfile: async () => connectPromise,
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('hub');

		const flow = (pane as unknown as { connectProfileWithPairing(profileId: string): Promise<void> }).connectProfileWithPairing('hub-profile-1');
		await Promise.resolve();
		await Promise.resolve();

		const hubStatus = container.querySelector('.connection-hub-connect-status') as HTMLElement;
		const authBadge = container.querySelector('.connection-hub-auth-badge') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(hubStatus.textContent, 'Connecting…');
		assert.strictEqual(testStatus.textContent, '');
		assert.strictEqual(authBadge.textContent, getHubAuthStatusLabel({ kind: 'signedIn', email: 'user@hub.example' }));
		resolveConnect!({ ok: false, code: 'transport_failed', reason: 'hub relay refused' });
		await flow;
		assert.strictEqual(hubStatus.textContent, 'hub relay refused');
		assert.ok(hubStatus.classList.contains('is-error'));
		assert.ok(!hubStatus.classList.contains('is-success'));
		assert.strictEqual(testStatus.textContent, '');
		assert.notStrictEqual(hubStatus.textContent, 'Connected');
		assert.strictEqual(authBadge.textContent, getHubAuthStatusLabel({ kind: 'signedIn', email: 'user@hub.example' }));
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
		const hubStatus = container.querySelector('.connection-hub-connect-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(hubStatus.textContent, 'Handshake succeeded — pairing not pending.');
		assert.ok(!hubStatus.textContent?.includes('ok=true'));
		assert.notStrictEqual(hubStatus.textContent, 'Connected');
		assert.strictEqual(testStatus.textContent, '');
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
		const hubStatus = container.querySelector('.connection-hub-connect-status') as HTMLElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.strictEqual(hubStatus.textContent, 'Handshake succeeded — pairing not pending.');
		assert.ok(!hubStatus.textContent?.includes('ok=true'));
		assert.notStrictEqual(hubStatus.textContent, 'Connected');
		assert.strictEqual(testStatus.textContent, '');
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

	test('device Rename throw paints hub directory banner', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			renameDevice: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const rename = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Rename') as HTMLButtonElement | undefined;
		assert.ok(rename);
		rename.click();
		await Promise.resolve();
		await Promise.resolve();
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.strictEqual(banner.textContent, 'boom');
		assert.notStrictEqual(banner.style.display, 'none');
		assert.ok(banner.classList.contains('is-error'));
		container.remove();
	});

	test('device Rename ok false paints hub directory banner error', async () => {
		let refreshed = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			renameDevice: async () => ({ ok: false, code: 'denied', reason: 'denied' }),
			refreshDirectory: async () => {
				refreshed++;
				return { kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] };
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const rename = [...container.querySelectorAll('.connection-hub-device-actions .monaco-button')]
			.find(button => button.textContent === 'Rename') as HTMLButtonElement | undefined;
		assert.ok(rename);
		rename.click();
		await Promise.resolve();
		await Promise.resolve();
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.ok(banner.textContent?.includes('denied'));
		assert.notStrictEqual(banner.style.display, 'none');
		assert.ok(banner.classList.contains('is-error'));
		assert.strictEqual(refreshed, 0);
		container.remove();
	});

	test('Refresh devices throw paints hub directory banner', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			refreshDirectory: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const refresh = [...container.querySelectorAll('.connection-hub-actions .monaco-button')]
			.find(button => button.textContent === 'Refresh devices') as HTMLButtonElement | undefined;
		assert.ok(refresh);
		refresh.click();
		await Promise.resolve();
		await Promise.resolve();
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.strictEqual(banner.textContent, 'boom');
		assert.notStrictEqual(banner.style.display, 'none');
		assert.ok(banner.classList.contains('is-error'));
		container.remove();
	});

	test('hub login throw paints hub auth badge', async () => {
		const pane = mountPane({
			login: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const signIn = [...container.querySelectorAll('.connection-hub-actions .monaco-button')]
			.find(button => button.textContent === HUB_LOGIN_BUTTON_LABEL) as HTMLButtonElement | undefined;
		assert.ok(signIn);
		signIn.click();
		await Promise.resolve();
		await Promise.resolve();
		const badge = container.querySelector('.connection-hub-auth-badge') as HTMLElement;
		assert.ok(badge);
		assert.strictEqual(badge.textContent, 'boom');
		assert.ok(badge.classList.contains('is-error'));
		container.remove();
	});

	test('hub changePassword throw paints hub auth badge', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'mustChangePassword', email: 'user@hub.example' }),
			changePassword: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const changePassword = [...container.querySelectorAll('.connection-hub-actions .monaco-button')]
			.find(button => button.textContent === HUB_CHANGE_PASSWORD_BUTTON_LABEL) as HTMLButtonElement | undefined;
		assert.ok(changePassword);
		changePassword.click();
		await Promise.resolve();
		await Promise.resolve();
		const badge = container.querySelector('.connection-hub-auth-badge') as HTMLElement;
		assert.ok(badge);
		assert.strictEqual(badge.textContent, 'boom');
		assert.ok(badge.classList.contains('is-error'));
		container.remove();
	});

	test('Test active profile probeConnectionProfile throw paints test status', async () => {
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'profile-1',
				displayName: 'Studio',
				state: 'active',
				hasTrust: true,
				targetKind: 'hubDevice',
			}],
		}, {
			probeConnectionProfile: async () => {
				throw new Error('boom');
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
		const status = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.textContent, 'boom');
		assert.ok(status.classList.contains('is-error'));
		container.remove();
	});

	test('hub logout throw paints hub auth badge', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			logout: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const signOut = [...container.querySelectorAll('.connection-hub-actions .monaco-button')]
			.find(button => button.textContent === 'Sign out') as HTMLButtonElement | undefined;
		assert.ok(signOut);
		signOut.click();
		await Promise.resolve();
		await Promise.resolve();
		const badge = container.querySelector('.connection-hub-auth-badge') as HTMLElement;
		assert.ok(badge);
		assert.strictEqual(badge.textContent, 'boom');
		assert.ok(badge.classList.contains('is-error'));
		container.remove();
	});

	test('hub fallback revokeDevice throw paints hub directory banner', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			revokeDevice: async () => {
				throw new Error('boom');
			},
		}, {
			isEngineConnected: () => false,
			revoke: async () => ({ success: true, message: '' }),
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.strictEqual(banner.textContent, 'boom');
		assert.notStrictEqual(banner.style.display, 'none');
		assert.ok(banner.classList.contains('is-error'));
		container.remove();
	});

	test('hub fallback revokeDevice ok false paints hub directory banner error', async () => {
		let refreshed = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			revokeDevice: async () => ({ ok: false, code: 'denied', reason: 'denied' }),
			refreshDirectory: async () => {
				refreshed++;
				return { kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] };
			},
		}, {
			isEngineConnected: () => false,
			revoke: async () => ({ success: true, message: '' }),
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.ok(banner.textContent?.includes('denied'));
		assert.notStrictEqual(banner.style.display, 'none');
		assert.ok(banner.classList.contains('is-error'));
		assert.strictEqual(refreshed, 0);
		container.remove();
	});

	test('hub fallback confirmDeviceCode throw paints device code status', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			confirmDeviceCode: async () => {
				throw new Error('boom');
			},
		}, {
			isEngineConnected: () => false,
			pairApprove: async () => ({ success: true, deviceId: '', message: '' }),
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		await Promise.resolve();

		const confirm = [...container.querySelectorAll('.connection-hub-device-code .monaco-button')]
			.find(button => button.textContent === 'Confirm') as HTMLButtonElement | undefined;
		const codeInput = container.querySelector('.connection-hub-device-code input') as HTMLInputElement | null;
		assert.ok(confirm);
		assert.ok(codeInput);
		codeInput.value = 'ABCD-1234';
		confirm.click();
		await Promise.resolve();
		await Promise.resolve();
		const status = container.querySelector('.connection-hub-device-code-status') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.textContent, 'boom');
		assert.ok(status.classList.contains('is-error'));
		container.remove();
	});

	test('Add Direct throw paints direct address status', async () => {
		const pane = mountPane({
			addDirectAddressProfile: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('direct');

		const add = [...container.querySelectorAll('.connection-direct-actions .monaco-button')]
			.find(button => button.textContent === 'Add') as HTMLButtonElement | undefined;
		assert.ok(add);
		add.click();
		await Promise.resolve();
		await Promise.resolve();
		const status = container.querySelector('.connection-direct-address-status') as HTMLElement;
		assert.ok(status);
		assert.strictEqual(status.textContent, 'boom');
		assert.ok(status.classList.contains('is-error'));
		container.remove();
	});

	test('Disconnect throw paints visible Profiles status', async () => {
		const pane = mountPane({}, {
			disconnect: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('profiles');

		const disconnect = [...container.querySelectorAll('.connection-profile-actions .monaco-button')]
			.find(button => button.textContent === 'Disconnect') as HTMLButtonElement | undefined;
		assert.ok(disconnect);
		disconnect.click();
		await Promise.resolve();
		await Promise.resolve();
		const profilesStatus = container.querySelector('.connection-profiles-status') as HTMLElement;
		assert.ok(profilesStatus);
		assert.strictEqual(profilesStatus.textContent, 'boom');
		assert.ok(profilesStatus.classList.contains('is-error'));
		container.remove();
	});

	test('Forget throw paints visible Profiles status', async () => {
		const pane = mountPane({
			listConnectionProfiles: () => [{
				profileId: 'profile-1',
				displayName: 'Studio',
				state: 'active',
				hasTrust: true,
				targetKind: 'hubDevice',
			}],
			forgetConnectionProfile: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('profiles');
		(pane as unknown as { activeProfileId: string }).activeProfileId = 'profile-1';

		await (pane as unknown as { handleForgetSelectedProfile(): Promise<void> }).handleForgetSelectedProfile();

		const profilesStatus = container.querySelector('.connection-profiles-status') as HTMLElement;
		assert.strictEqual(profilesStatus.textContent, 'boom');
		assert.ok(profilesStatus.classList.contains('is-error'));
		container.remove();
	});

	test('addHubDeviceProfile throw paints visible Devices connect status', async () => {
		const studio = device({ id: 'dev-1', name: 'Studio' });
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [studio] }),
			addHubDeviceProfile: async () => {
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('devices');
		await Promise.resolve();

		await (pane as unknown as { handleConnectDevice(device: HubDeviceProjection): Promise<void> }).handleConnectDevice(studio);

		const devicesStatus = container.querySelector('.connection-hub-devices-status') as HTMLElement;
		assert.ok(devicesStatus);
		assert.strictEqual(devicesStatus.textContent, 'boom');
		assert.ok(devicesStatus.classList.contains('is-error'));
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

	test('Revoke success false with message paints hub directory banner error', async () => {
		let refreshed = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			refreshDirectory: async () => {
				refreshed++;
				return { kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] };
			},
		}, {
			isEngineConnected: () => true,
			revoke: async () => ({ success: false, message: 'denied' }),
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.ok(banner.textContent?.includes('denied'));
		assert.ok(banner.classList.contains('is-error'));
		assert.notStrictEqual(banner.style.display, 'none');
		assert.strictEqual(refreshed, 0);
		container.remove();
	});

	test('Revoke throw paints hub directory banner error', async () => {
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
			revoke: async () => {
				throw new Error('boom');
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.ok(banner.textContent?.includes('boom'));
		assert.ok(banner.classList.contains('is-error'));
		assert.notStrictEqual(banner.style.display, 'none');
		assert.strictEqual(hubRevoked, undefined);
		container.remove();
	});

	test('Revoke success false with empty message still paints hub directory banner fallback', async () => {
		let refreshed = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			refreshDirectory: async () => {
				refreshed++;
				return { kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] };
			},
		}, {
			isEngineConnected: () => true,
			revoke: async () => ({ success: false, message: '' }),
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.strictEqual(banner.textContent, connectionDeviceRevokeFailureMessage(''));
		assert.ok(banner.classList.contains('is-error'));
		assert.notStrictEqual(banner.style.display, 'none');
		assert.strictEqual(refreshed, 0);
		container.remove();
	});

	test('Revoke success true still refreshes directory', async () => {
		let refreshed = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] }),
			refreshDirectory: async () => {
				refreshed++;
				return { kind: 'ok', devices: [device({ id: 'dev-1', name: 'Studio' })] };
			},
		}, {
			isEngineConnected: () => true,
			revoke: async () => ({ success: true, message: 'revoked' }),
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.strictEqual(banner.textContent, 'revoked');
		assert.ok(!banner.classList.contains('is-error'));
		assert.notStrictEqual(banner.style.display, 'none');
		assert.strictEqual(refreshed, 1);
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
		disconnected.selectZone('devices');
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
		noHook.selectZone('devices');
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
		pane.selectZone('devices');
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
		pane.selectZone('devices');
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listDevicesCalls, 1);
		assert.strictEqual(container.querySelector('.connection-hub-device-name'), null);
		container.remove();
	});

	test('ListDevices success then throw keeps last snapshot and paints devices status', async () => {
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
				if (listDevicesCalls === 1) {
					return {
						devices: [{
							deviceId: 'eng-1',
							displayName: 'Phone',
							role: '',
							platform: '',
							pairedAt: 0,
							lastSeenAt: 0,
							active: false,
						}],
					};
				}
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('devices');
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listDevicesCalls, 1);
		assert.strictEqual(container.querySelector('.connection-hub-device-name')?.textContent, 'Phone');

		await (pane as unknown as { refreshEngineDeviceLists(): Promise<void> }).refreshEngineDeviceLists();
		assert.ok(listDevicesCalls >= 2);
		assert.strictEqual(container.querySelector('.connection-hub-device-name')?.textContent, 'Phone');
		assert.notStrictEqual(container.querySelector('.connection-hub-device-name')?.textContent, 'Hub Studio');
		const devicesStatus = container.querySelector('.connection-hub-devices-status') as HTMLElement;
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.strictEqual(devicesStatus.textContent, connectionDeviceListFailureMessage('boom'));
		assert.ok(devicesStatus.classList.contains('is-error'));
		assert.strictEqual(banner.textContent, connectionDeviceListFailureMessage('boom'));
		assert.notStrictEqual(banner.style.display, 'none');
		assert.ok(!devicesStatus.textContent?.includes('No pending pairing requests'));
		container.remove();
	});

	test('ListPending success then throw keeps last snapshot and paints pending fail note', async () => {
		let listPendingCalls = 0;
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
		}, {
			isEngineConnected: () => true,
			listPending: async () => {
				listPendingCalls++;
				if (listPendingCalls === 1) {
					return {
						pending: [{
							pairingCode: '123456',
							deviceId: 'dev-1',
							displayName: 'Phone',
							platform: 'ios',
							requestedAt: 0,
							expiresInSeconds: 0,
						}],
					};
				}
				throw new Error('boom');
			},
		});
		const container = pane.getDomNode();
		pane.layout(new Dimension(800, 800));
		pane.selectZone('devices');
		await Promise.resolve();
		await Promise.resolve();
		assert.strictEqual(listPendingCalls, 1);
		const row = container.querySelector('.connection-engine-pending-row') as HTMLElement | null;
		assert.ok(row);
		assert.strictEqual(row.textContent, 'Phone — 123456 — ios');

		await (pane as unknown as { refreshEngineDeviceLists(): Promise<void> }).refreshEngineDeviceLists();
		assert.ok(listPendingCalls >= 2);
		const leftover = container.querySelector('.connection-engine-pending-row') as HTMLElement | null;
		assert.ok(leftover);
		assert.strictEqual(leftover.textContent, 'Phone — 123456 — ios');
		const pendingEmpty = container.querySelector('.connection-engine-pending-empty') as HTMLElement;
		assert.strictEqual(pendingEmpty.textContent, connectionDevicePendingListFailureMessage('boom'));
		assert.ok(pendingEmpty.classList.contains('is-error'));
		assert.notStrictEqual(pendingEmpty.style.display, 'none');
		assert.notStrictEqual(pendingEmpty.textContent, CONNECTION_DEVICE_PENDING_EMPTY_COPY);
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

	test('RotateToken success false with message paints hub directory banner error', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'hub-1', name: 'Hub Studio' })] }),
		}, {
			isEngineConnected: () => true,
			rotateToken: async () => ({ success: false, message: 'denied' }),
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.ok(banner.textContent?.includes('denied'));
		assert.ok(banner.classList.contains('is-error'));
		assert.notStrictEqual(banner.style.display, 'none');
		container.remove();
	});

	test('RotateToken throw paints hub directory banner error', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'hub-1', name: 'Hub Studio' })] }),
		}, {
			isEngineConnected: () => true,
			rotateToken: async () => {
				throw new Error('boom');
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.ok(banner.textContent?.includes('boom'));
		assert.ok(banner.classList.contains('is-error'));
		assert.notStrictEqual(banner.style.display, 'none');
		container.remove();
	});

	test('RotateToken success false with empty message still paints hub directory banner fallback', async () => {
		const pane = mountPane({
			getAuthStatus: () => ({ kind: 'signedIn', email: 'user@example.com' }),
			getDirectoryStatus: () => ({ kind: 'ok', devices: [device({ id: 'hub-1', name: 'Hub Studio' })] }),
		}, {
			isEngineConnected: () => true,
			rotateToken: async () => ({ success: false, message: '' }),
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
		const banner = container.querySelector('.connection-hub-directory-banner') as HTMLElement;
		assert.ok(banner);
		assert.strictEqual(banner.textContent, connectionDeviceRotateTokenFailureMessage(''));
		assert.ok(banner.classList.contains('is-error'));
		assert.notStrictEqual(banner.style.display, 'none');
		container.remove();
	});
});

suite('Conversation Session StatusBar H4a negative', () => {
	test('engine status copy stays not connected before H4b phase wiring', () => {
		assert.strictEqual(getConversationEngineStatusText(), 'Engine not connected');
	});
});
