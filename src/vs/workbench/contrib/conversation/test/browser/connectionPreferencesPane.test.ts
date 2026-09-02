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
			forgetConnectionProfile: async () => ({ ok: true }),
			isEncryptionAvailable: async () => true,
			...overrides,
		};
	}

	function createConnectionStub(overrides: Partial<IUniverseAgentConnection> = {}): IUniverseAgentConnection {
		return {
			_serviceBrand: undefined,
			isEngineConnected: () => false,
			getConnectionPhase: () => ({ kind: 'disconnected' }),
			getTransportState: () => 'idle',
			getConnectionSnapshot: () => ({
				transport: 'idle',
				pairingPending: false,
				channelAlive: false,
				capabilities: { methods: [], toolFamilies: [] },
			}),
			getCapabilitySnapshot: () => ({ methods: [], toolFamilies: [] }),
			onDidChangeConnection: Event.None,
			onDidFileMutation: Event.None,
			onDidTurnSettle: Event.None,
			connect: async () => ({ sessionToken: undefined, workDir: undefined, methods: [] }),
			connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			disconnect: async () => { },
			listSessions: async () => ({ sessions: [] }),
			createSession: async () => ({ sessionId: 's' }),
			deleteSession: async () => { },
			getHistory: async () => ({ events: [] }),
			subscribeSessionEventStream: () => ({ dispose: () => { } }),
			chat: async () => { },
			listSkills: async () => ({ skills: [] }),
			setSkillEnabled: async () => ({ ok: true }),
			getSkillInfo: async () => ({ name: '', content: '', source: 'unknown', enabled: false }),
			listAgentProfiles: async () => ({ profiles: [] }),
			saveAgentProfile: async (request) => ({ profile: request.profile }),
			deleteAgentProfile: async () => ({ ok: true }),
			resetAgentProfile: async () => ({ ok: true }),
			listMcpServers: async () => ({ servers: [] }),
			getMcpServerStatuses: async () => ({ statuses: [] }),
			getMcpServerTools: async () => ({ tools: [] }),
			listPlugins: async () => ({ plugins: [] }),
			getPluginInfo: async () => ({ summary: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const }, hooks: [] }),
			enablePlugin: async () => ({ plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }),
			reloadPlugin: async () => ({ plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } }),
			unloadPlugin: async () => ({ removedHookCount: 0 }),
			scanNewPlugins: async () => ({ newPlugins: [], skippedCount: 0 }),
			toggleMcpServer: async () => ({ ok: true }),
			addMcpServer: async () => ({ ok: true }),
			updateMcpServer: async () => ({ ok: true }),
			removeMcpServer: async () => ({ ok: true }),
			listTools: async () => ({ tools: [] }),
			listModels: async () => ({ models: [] }),
			...overrides,
		};
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
		} as unknown as IDialogService);
		const pane = store.add(instantiationService.createInstance(ConnectionPreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		return pane;
	}

	test('getConnectionTestStatusText reuses StatusBar phase copy', () => {
		assert.strictEqual(getConnectionTestStatusText(), getConnectionPhaseStatusBarText({ kind: 'disconnected' }));
		assert.strictEqual(getConnectionTestStatusText({ kind: 'connected', path: 'direct' }), 'Engine · Direct');
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

	test('Test Connection click surfaces honest status without faking success', () => {
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
});

suite('Conversation Session StatusBar H4a negative', () => {
	test('engine status copy stays not connected before H4b phase wiring', () => {
		assert.strictEqual(getConversationEngineStatusText(), 'Engine not connected');
	});
});
