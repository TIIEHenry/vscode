/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createEmptyCapabilitySnapshot } from '../../../../../platform/universeAgent/node/grpcCapabilityProbe.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	EnginePreferencesPane,
	getEngineTestStatusText,
} from '../../browser/enginePreferencesPane.js';
import { getUnsupportedEnvironmentCopy } from '../../browser/engineSectionChrome.js';
import { createWebUnsupportedCapabilitySnapshot, WEB_UNSUPPORTED_REASON } from '../../../../../platform/universeAgent/browser/webUnsupported.js';
import type { UniverseAgentCapabilitySnapshot, UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { getConnectionPhaseStatusBarText } from '../../browser/conversationSessionStatus.js';
import { Dimension } from '../../../../../base/browser/dom.js';

const ENGINE_DISCONNECTED_COPY = getConnectionPhaseStatusBarText({ kind: 'disconnected' });
const FAKE_ENGINE_LABELS = ['Local Engine', '127.0.0.1:8080'];

suite('EnginePreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(connected = false, overrides: Partial<IUniverseAgentConnection> = {}): IUniverseAgentConnection {
		const capabilities = createEmptyCapabilitySnapshot();
		return {
			_serviceBrand: undefined,
			isEngineConnected: () => connected,
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getTransportState: () => (connected ? 'ok' : 'idle'),
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle',
				sessionToken: connected ? 'tok' : undefined,
				pairingPending: false,
				channelAlive: connected,
				sharedFsRootSent: false,
				capabilities,
			}),
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: Event.None,
			onDidFileMutation: Event.None,
			onDidTurnSettle: Event.None,
			onDidChangeTeamRuntime: Event.None,
			requestAgentTreeRefresh: () => { },
			getNavigatorCapability: () => 'UNKNOWN' as const,
			team: {
				memberStatus: async () => [],
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
			connect: async () => ({ methods: [], events: [], sessionToken: 'tok' }),
			connectProfile: async () => ({ ok: false, code: 'transport_failed', reason: 'stub' }),
			disconnect: async () => { },
			listSessions: async () => ({ sessions: [] }),
			createSession: async () => ({ sessionId: 's' }),
			deleteSession: async () => { },
			getHistory: async () => ({ envelopes: [] }),
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

	function mountPane(connected = false, overrides: Partial<IUniverseAgentConnection> = {}): EnginePreferencesPane {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub(connected, overrides));
		const pane = store.add(instantiationService.createInstance(EnginePreferencesPane));
		const container = pane.getDomNode();
		document.body.appendChild(container);
		return pane;
	}

	test('getEngineTestStatusText reuses StatusBar phase copy', () => {
		assert.strictEqual(getEngineTestStatusText(), ENGINE_DISCONNECTED_COPY);
		assert.strictEqual(getEngineTestStatusText({ kind: 'connected', path: 'hubRelay' }), 'Engine · Hub relay');
	});

	test('pane title remains Engine and disconnected banner reuses StatusBar copy', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		const title = container.querySelector('h2') as HTMLElement;
		assert.ok(title);
		assert.strictEqual(title.textContent, 'Engine');

		assert.strictEqual(container.querySelector('.engine-empty-welcome'), null);
		const banner = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;
		assert.ok(banner);
		assert.strictEqual(banner.textContent, ENGINE_DISCONNECTED_COPY);
		assert.ok(!(container.textContent ?? '').includes('No engines yet'));

		container.remove();
	});

	test('layout under 600px applies is-narrow and Back returns to nav', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		pane.layout(new Dimension(599, 800));
		assert.ok(container.classList.contains('is-narrow'));
		assert.ok(!container.classList.contains('is-compact'));
		assert.ok(container.classList.contains('is-showing-detail'));
		const back = container.querySelector('.engine-preferences-back') as HTMLButtonElement;
		assert.ok(back);
		assert.strictEqual(back.hidden, false);

		back.click();
		assert.ok(!container.classList.contains('is-showing-detail'));
		assert.strictEqual(back.hidden, true);

		pane.layout(new Dimension(299, 800));
		assert.ok(container.classList.contains('is-narrow'));
		assert.ok(container.classList.contains('is-compact'));

		pane.layout(new Dimension(600, 800));
		assert.ok(!container.classList.contains('is-narrow'));
		assert.ok(!container.classList.contains('is-compact'));
		assert.ok(!container.classList.contains('is-showing-detail'));

		container.remove();
	});

	test('disconnected pane keeps nine-section navigation with zero catalog rows and zero write buttons', async () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();
		pane.layout(new Dimension(900, 800));
		await new Promise(resolve => setTimeout(resolve, 0));

		const navLabels = [...container.querySelectorAll('.engine-preferences-nav-label')].map(el => el.textContent);
		assert.strictEqual(navLabels.length, 9);

		pane.selectSection('skills');
		const skillsSection = container.querySelector('.engine-skills-section') as HTMLElement;
		assert.ok(skillsSection);
		assert.strictEqual(skillsSection.style.display, '');
		assert.strictEqual(skillsSection.querySelectorAll('.engine-skill-row').length, 0);
		const writeToolbar = skillsSection.querySelector('.engine-catalog-write-toolbar') as HTMLElement | null;
		if (writeToolbar) {
			assert.strictEqual(writeToolbar.style.display, 'none');
		}

		const combined = container.textContent ?? '';
		assert.ok(!/Engine is connected\./.test(combined), 'pane must not wash disconnect into connected');
		assert.ok(!/copilot/i.test(combined), 'pane must not mention Copilot');
		assert.ok(!/open chat/i.test(combined), 'pane must not mention Open Chat');
		assert.ok(!/sync/i.test(combined.toLowerCase()), 'pane must not claim synced catalog when disconnected');

		container.remove();
	});

	test('pane has no chat widgets or editable engine fields', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		assert.strictEqual(container.querySelector('.chat-widget'), null);
		assert.strictEqual(container.querySelector('.chat-setup'), null);
		assert.strictEqual(container.querySelector('.engine-field-row'), null);
		assert.strictEqual(container.querySelector('.engine-field-input'), null);
		assert.ok(!/\(command:/.test(container.innerHTML), 'pane must not include command buttons');

		container.remove();
	});

	test('pane does not seed fake engine rows', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();
		const combined = container.textContent ?? '';

		for (const label of FAKE_ENGINE_LABELS) {
			assert.ok(!combined.includes(label), `pane must not seed fake ${label} row`);
		}

		container.remove();
	});

	test('Test Engine click surfaces honest status without faking success when disconnected', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		const testButton = container.querySelector('.engine-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.engine-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);
		assert.strictEqual(testStatus.textContent, '');

		testButton.click();
		assert.strictEqual(testStatus.textContent, getEngineTestStatusText());
		assert.notStrictEqual(testStatus.textContent, 'Connected');

		container.remove();
	});

	test('E2-1: desktop disconnected still draws Test Engine and Engine not connected', () => {
		const pane = mountPane(false);
		const container = pane.getDomNode();

		const testRow = container.querySelector('.engine-test-row') as HTMLElement;
		const testButton = container.querySelector('.engine-test-row .monaco-button') as HTMLButtonElement;
		const banner = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;
		assert.ok(testRow);
		assert.ok(testButton);
		assert.notStrictEqual(testRow.style.display, 'none');
		assert.strictEqual(banner.textContent, ENGINE_DISCONNECTED_COPY);
		assert.notStrictEqual(banner.textContent, getUnsupportedEnvironmentCopy());
		assert.ok((container.textContent ?? '').includes('Open Connection'));

		container.remove();
	});

	test('E2-1: Web unsupported_environment omits Test Engine and shows named copy', () => {
		const capabilities = createWebUnsupportedCapabilitySnapshot();
		const snapshot: UniverseAgentConnectionSnapshot = {
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities,
		};
		const pane = mountPane(false, {
			getConnectionPhase: () => ({ kind: 'disconnected' }),
			getCapabilitySnapshot: () => capabilities as UniverseAgentCapabilitySnapshot,
			getConnectionSnapshot: () => snapshot,
			connectProfile: async () => ({ ok: false, code: 'unsupported_environment', reason: WEB_UNSUPPORTED_REASON }),
		});
		const container = pane.getDomNode();

		const testRow = container.querySelector('.engine-test-row') as HTMLElement;
		const banner = container.querySelector('.engine-preferences-disconnected-copy') as HTMLElement;
		const bannerTest = [...container.querySelectorAll('.engine-preferences-disconnected-actions .monaco-button')]
			.find(el => (el.textContent ?? '').includes('Test Engine')) as HTMLElement | undefined;

		assert.ok(testRow);
		assert.strictEqual(testRow.style.display, 'none');
		assert.ok(bannerTest);
		assert.strictEqual(bannerTest.style.display, 'none');
		assert.strictEqual(banner.textContent, getUnsupportedEnvironmentCopy());
		assert.strictEqual(getUnsupportedEnvironmentCopy(), '此环境不支持本机 Engine 连接');
		assert.notStrictEqual(banner.textContent, ENGINE_DISCONNECTED_COPY);

		container.remove();
	});
});
